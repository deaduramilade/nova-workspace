"""Memory extraction and persistence helpers for Nova Memory."""

from __future__ import annotations

import json
import re
from collections import OrderedDict
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.memory import Memory, MemoryType
from app.schemas.memory import MemoryExtracted

try:
    import ollama
except ImportError:  # pragma: no cover - depends on optional local runtime setup
    ollama = None

DECISION_PATTERNS = (
    re.compile(r"\bwe decided\b", re.IGNORECASE),
    re.compile(r"\bdecision[:\s]", re.IGNORECASE),
    re.compile(r"\bagreed\b", re.IGNORECASE),
    re.compile(r"\bapproved\b", re.IGNORECASE),
    re.compile(r"\bresolved\b", re.IGNORECASE),
)

ACTION_PATTERNS = (
    re.compile(r"\baction item[:\s]", re.IGNORECASE),
    re.compile(r"\bnext step[s]?\b", re.IGNORECASE),
    re.compile(r"\bfollow up\b", re.IGNORECASE),
    re.compile(r"\btodo\b", re.IGNORECASE),
    re.compile(r"\b(?:will|should|needs to|need to|has to|must)\b", re.IGNORECASE),
)

DISCUSSION_PATTERNS = (
    re.compile(r"\bdiscuss(?:ed|ion)?\b", re.IGNORECASE),
    re.compile(r"\bconcern\b", re.IGNORECASE),
    re.compile(r"\bblocker\b", re.IGNORECASE),
    re.compile(r"\brisk\b", re.IGNORECASE),
    re.compile(r"\bissue\b", re.IGNORECASE),
)

ROLE_KEYWORDS = {
    "engineering": ("api", "backend", "frontend", "code", "deploy", "release", "database", "bug"),
    "product": ("roadmap", "priority", "requirement", "scope", "milestone", "feature"),
    "design": ("ux", "ui", "design", "mockup", "prototype"),
    "operations": ("infrastructure", "ops", "monitoring", "incident", "server", "rollback"),
    "qa": ("test", "qa", "regression", "validation"),
    "sales": ("customer", "demo", "prospect", "contract"),
    "support": ("ticket", "support", "escalation", "user issue"),
    "finance": ("budget", "invoice", "pricing", "cost"),
    "hr": ("hiring", "onboarding", "recruiting", "training"),
    "leadership": ("strategy", "executive", "leadership", "approval"),
}

SPEAKER_PATTERN = re.compile(
    r"^\s*(?:\[(?P<timestamp>\d{1,2}:\d{2}(?::\d{2})?)\]\s*)?(?P<speaker>[A-Za-z][\w .'-]{1,60}):\s*(?P<text>.+)$"
)

ASSIGNEE_PATTERNS = (
    re.compile(r"(?P<assignee>[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will|should|can|needs to|need to|must)\s+(?P<task>.+)", re.IGNORECASE),
    re.compile(r"(?P<task>.+?)\s+(?:to|for)\s+(?P<assignee>[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$", re.IGNORECASE),
    re.compile(r"@(?P<assignee>[A-Za-z][\w.-]+)", re.IGNORECASE),
)

FILLER_PREFIXES = (
    "decision:",
    "action item:",
    "next steps:",
    "next step:",
    "follow up:",
    "discussion:",
    "note:",
)


class MemoryExtractionError(Exception):
    """Raised when memory extraction or persistence fails."""


def extract_memories_from_transcript(
    transcript: str,
    meeting_id: int,
    workspace_id: int,
) -> list[dict]:
    """Extract structured memory items from a meeting transcript."""
    cleaned_transcript = transcript.strip()
    if not cleaned_transcript:
        return []

    rule_based_items = _extract_rule_based_memories(
        transcript=cleaned_transcript,
        meeting_id=meeting_id,
        workspace_id=workspace_id,
    )
    llm_items = _extract_llm_memories(
        transcript=cleaned_transcript,
        meeting_id=meeting_id,
        workspace_id=workspace_id,
        hints=rule_based_items,
    )

    merged_items = _merge_memory_items(rule_based_items, llm_items)
    return [
        MemoryExtracted.model_validate(item).model_dump(mode="python")
        for item in merged_items
    ]


def save_memory(db: Session, memory_data: dict) -> Memory:
    """Validate and persist a single extracted memory."""
    extracted = MemoryExtracted.model_validate(memory_data)
    memory = Memory(
        workspace_id=extracted.workspace_id,
        user_id=extracted.user_id,
        memory_type=extracted.memory_type.value,
        content=extracted.content.strip(),
        source_meeting_id=extracted.source_meeting_id,
        memory_metadata=_build_memory_metadata(extracted),
    )

    try:
        db.add(memory)
        db.commit()
        db.refresh(memory)
        return memory
    except Exception as exc:
        db.rollback()
        raise MemoryExtractionError(f"Failed to save memory: {exc}") from exc


def bulk_save_memories(db: Session, memories: list[dict]) -> list[Memory]:
    """Validate and persist a batch of extracted memories in one transaction."""
    if not memories:
        return []

    validated = [MemoryExtracted.model_validate(memory) for memory in memories]
    created: list[Memory] = []

    try:
        for extracted in validated:
            memory = Memory(
                workspace_id=extracted.workspace_id,
                user_id=extracted.user_id,
                memory_type=extracted.memory_type.value,
                content=extracted.content.strip(),
                source_meeting_id=extracted.source_meeting_id,
                memory_metadata=_build_memory_metadata(extracted),
            )
            db.add(memory)
            created.append(memory)

        db.commit()

        for memory in created:
            db.refresh(memory)

        return created
    except Exception as exc:
        db.rollback()
        raise MemoryExtractionError(f"Failed to bulk save memories: {exc}") from exc


def _extract_rule_based_memories(
    transcript: str,
    meeting_id: int,
    workspace_id: int,
) -> list[dict[str, Any]]:
    segments = _split_transcript(transcript)
    extracted: list[dict[str, Any]] = []

    for segment in segments:
        text = segment["text"]
        excerpt = segment["raw_excerpt"]
        speaker = segment.get("speaker")
        is_decision = _matches_any(text, DECISION_PATTERNS)
        assignee = _extract_assignee(text, speaker)
        is_action = bool(assignee) or _matches_any(text, ACTION_PATTERNS)
        is_discussion = _matches_any(text, DISCUSSION_PATTERNS)

        if is_decision:
            summary = _clean_summary(text)
            extracted.append(
                _make_memory_item(
                    workspace_id=workspace_id,
                    meeting_id=meeting_id,
                    memory_type=MemoryType.DECISION,
                    category="decision",
                    content=summary,
                    raw_excerpt=excerpt,
                    speaker=speaker,
                    assignee=None,
                    role_tags=_infer_role_tags(summary, excerpt, None),
                    extraction_method="rule_based",
                    confidence=0.72,
                )
            )

        if is_action:
            summary = _clean_action_summary(text, assignee, speaker)
            extracted.append(
                _make_memory_item(
                    workspace_id=workspace_id,
                    meeting_id=meeting_id,
                    memory_type=MemoryType.ACTION_ITEM,
                    category="action_item",
                    content=summary,
                    raw_excerpt=excerpt,
                    speaker=speaker,
                    assignee=assignee,
                    role_tags=_infer_role_tags(summary, excerpt, assignee),
                    extraction_method="rule_based",
                    confidence=0.7 if assignee else 0.6,
                )
            )

        if is_discussion and not is_action:
            summary = _clean_summary(text)
            extracted.append(
                _make_memory_item(
                    workspace_id=workspace_id,
                    meeting_id=meeting_id,
                    memory_type=MemoryType.NOTE,
                    category="discussion_point",
                    content=summary,
                    raw_excerpt=excerpt,
                    speaker=speaker,
                    assignee=None,
                    role_tags=_infer_role_tags(summary, excerpt, None),
                    extraction_method="rule_based",
                    confidence=0.55,
                )
            )

    return _dedupe_items(extracted)


def _extract_llm_memories(
    transcript: str,
    meeting_id: int,
    workspace_id: int,
    hints: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not settings.OLLAMA_ENABLED or ollama is None:
        return []

    hint_payload = [
        {
            "memory_type": item["memory_type"].value if isinstance(item["memory_type"], MemoryType) else item["memory_type"],
            "content": item["content"],
            "raw_excerpt": item["raw_excerpt"],
            "structured_data": item["structured_data"],
        }
        for item in hints[:10]
    ]

    prompt = f"""You extract atomic meeting memories for Nova Workspace.

Return JSON only with this shape:
{{
  "items": [
    {{
      "memory_type": "decision" | "action_item" | "note",
      "category": "decision" | "action_item" | "discussion_point",
      "content": "concise standalone summary",
      "raw_excerpt": "exact or near-exact excerpt from transcript",
      "assignee": "person name if present, else null",
      "role_tags": ["relevant roles such as engineering, product, design, operations, qa, leadership, general"],
      "confidence": 0.0,
      "reason": "short explanation"
    }}
  ]
}}

Focus only on:
1. key decisions made
2. action items and likely assignees
3. important discussion points

Avoid duplicates. Use "note" for discussion points.
Rule-based hints:
{json.dumps(hint_payload, ensure_ascii=True)}

Transcript:
{transcript[:12000]}
"""

    try:
        client = ollama.Client(host=settings.OLLAMA_URL)
        response = client.generate(
            model=settings.OLLAMA_MODEL,
            prompt=prompt,
            stream=False,
        )
        payload = _parse_llm_json(response.get("response", ""))
    except Exception:
        return []

    items: list[dict[str, Any]] = []
    for candidate in payload.get("items", []):
        normalized = _normalize_llm_item(candidate, meeting_id, workspace_id)
        if normalized:
            items.append(normalized)

    return _dedupe_items(items)


def _normalize_llm_item(
    candidate: dict[str, Any],
    meeting_id: int,
    workspace_id: int,
) -> dict[str, Any] | None:
    memory_type_value = str(candidate.get("memory_type", "")).strip().lower()
    category = str(candidate.get("category", "")).strip().lower() or "discussion_point"
    content = _clean_summary(str(candidate.get("content", "")).strip())
    raw_excerpt = str(candidate.get("raw_excerpt", "")).strip() or content
    assignee = _clean_person_name(candidate.get("assignee"))
    reason = str(candidate.get("reason", "")).strip()
    confidence = _coerce_confidence(candidate.get("confidence"))

    if not content:
        return None

    memory_type_map = {
        "decision": MemoryType.DECISION,
        "action_item": MemoryType.ACTION_ITEM,
        "note": MemoryType.NOTE,
        "discussion_point": MemoryType.NOTE,
        "meeting": MemoryType.MEETING,
    }
    memory_type = memory_type_map.get(memory_type_value) or memory_type_map.get(category)
    if memory_type is None:
        return None

    role_tags = candidate.get("role_tags")
    if not isinstance(role_tags, list):
        role_tags = []

    return _make_memory_item(
        workspace_id=workspace_id,
        meeting_id=meeting_id,
        memory_type=memory_type,
        category=category,
        content=content,
        raw_excerpt=raw_excerpt,
        speaker=None,
        assignee=assignee,
        role_tags=_unique_strings(
            [str(role).strip().lower() for role in role_tags if str(role).strip()]
            + _infer_role_tags(content, raw_excerpt, assignee)
        ),
        extraction_method="llm",
        confidence=confidence,
        reason=reason,
    )


def _build_memory_metadata(extracted: MemoryExtracted) -> dict[str, Any]:
    metadata = dict(extracted.metadata)
    structured_data = dict(extracted.structured_data)

    metadata["raw_excerpt"] = extracted.raw_excerpt
    metadata["structured_data"] = structured_data
    metadata["role_tags"] = _unique_strings(
        list(metadata.get("role_tags", []))
        + list(structured_data.get("role_tags", []))
        + _infer_role_tags(extracted.content, extracted.raw_excerpt, structured_data.get("assignee"))
    )
    metadata.setdefault("category", structured_data.get("category"))
    metadata.setdefault("extraction_method", structured_data.get("extraction_method"))
    return metadata


def _make_memory_item(
    workspace_id: int,
    meeting_id: int,
    memory_type: MemoryType,
    category: str,
    content: str,
    raw_excerpt: str,
    speaker: str | None,
    assignee: str | None,
    role_tags: list[str],
    extraction_method: str,
    confidence: float,
    reason: str | None = None,
) -> dict[str, Any]:
    return {
        "workspace_id": workspace_id,
        "source_meeting_id": meeting_id,
        "memory_type": memory_type,
        "content": content,
        "raw_excerpt": raw_excerpt,
        "structured_data": {
            "category": category,
            "speaker": speaker,
            "assignee": assignee,
            "role_tags": role_tags,
            "confidence": confidence,
            "extraction_method": extraction_method,
            "reason": reason,
        },
        "metadata": {
            "role_tags": role_tags,
            "category": category,
            "extraction_method": extraction_method,
        },
    }


def _split_transcript(transcript: str) -> list[dict[str, str | None]]:
    segments: list[dict[str, str | None]] = []
    for raw_line in transcript.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        speaker = None
        text = line
        match = SPEAKER_PATTERN.match(line)
        if match:
            speaker = match.group("speaker").strip()
            text = match.group("text").strip()

        segments.append(
            {
                "speaker": speaker,
                "text": text,
                "raw_excerpt": line,
            }
        )

    return segments


def _extract_assignee(text: str, speaker: str | None) -> str | None:
    lowered = text.lower()
    if speaker and ("i will" in lowered or "i'll" in lowered or "i can" in lowered):
        return speaker

    for pattern in ASSIGNEE_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue

        if "assignee" in match.groupdict():
            return _clean_person_name(match.group("assignee"))

    return None


def _parse_llm_json(response_text: str) -> dict[str, Any]:
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE | re.DOTALL).strip()

    try:
        payload = json.loads(cleaned)
        if isinstance(payload, dict):
            return payload
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", cleaned, re.DOTALL)
    if not match:
        return {"items": []}

    try:
        payload = json.loads(match.group(0))
    except json.JSONDecodeError:
        return {"items": []}

    return payload if isinstance(payload, dict) else {"items": []}


def _merge_memory_items(
    rule_items: list[dict[str, Any]],
    llm_items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    merged: "OrderedDict[str, dict[str, Any]]" = OrderedDict()

    for item in rule_items + llm_items:
        key = _memory_key(item)
        if key not in merged:
            merged[key] = item
            continue

        current = merged[key]
        current_structured = current["structured_data"]
        incoming_structured = item["structured_data"]

        current["metadata"]["role_tags"] = _unique_strings(
            list(current["metadata"].get("role_tags", []))
            + list(item["metadata"].get("role_tags", []))
        )
        current_structured["role_tags"] = _unique_strings(
            list(current_structured.get("role_tags", []))
            + list(incoming_structured.get("role_tags", []))
        )

        methods = _unique_strings(
            _as_list(current_structured.get("extraction_method"))
            + _as_list(incoming_structured.get("extraction_method"))
        )
        current_structured["extraction_method"] = methods if len(methods) > 1 else methods[0]
        current["metadata"]["extraction_method"] = current_structured["extraction_method"]

        if not current_structured.get("assignee") and incoming_structured.get("assignee"):
            current_structured["assignee"] = incoming_structured["assignee"]

        if len(item["content"]) > len(current["content"]) and item["content"] != item["raw_excerpt"]:
            current["content"] = item["content"]

        current_structured["confidence"] = max(
            _coerce_confidence(current_structured.get("confidence")),
            _coerce_confidence(incoming_structured.get("confidence")),
        )

        if not current.get("raw_excerpt") and item.get("raw_excerpt"):
            current["raw_excerpt"] = item["raw_excerpt"]

    return list(merged.values())


def _memory_key(item: dict[str, Any]) -> str:
    memory_type = item["memory_type"].value if isinstance(item["memory_type"], MemoryType) else str(item["memory_type"])
    return f"{memory_type}:{_normalize_text(item['content'])}"


def _dedupe_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: "OrderedDict[str, dict[str, Any]]" = OrderedDict()
    for item in items:
        deduped.setdefault(_memory_key(item), item)
    return list(deduped.values())


def _clean_action_summary(text: str, assignee: str | None, speaker: str | None) -> str:
    summary = _clean_summary(text)
    lowered = summary.lower()

    if assignee:
        if speaker and assignee.lower() == speaker.lower():
            if lowered.startswith("i will "):
                return f"{assignee} to {summary[7:].strip()}"
            if lowered.startswith("i'll "):
                return f"{assignee} to {summary[5:].strip()}"
            if lowered.startswith("i can "):
                return f"{assignee} to {summary[6:].strip()}"
        summary = re.sub(rf"^{re.escape(assignee)}\s+(will|should|can|needs to|need to|must)\s+", "", summary, flags=re.IGNORECASE)
        summary = summary.strip()
        return f"{assignee} to {summary}".strip()

    if speaker and lowered.startswith("i will "):
        return f"{speaker} to {summary[7:].strip()}"
    if speaker and lowered.startswith("i'll "):
        return f"{speaker} to {summary[5:].strip()}"

    return summary


def _clean_summary(text: str) -> str:
    summary = re.sub(r"\s+", " ", text).strip(" -•\t")
    lowered = summary.lower()
    for prefix in FILLER_PREFIXES:
        if lowered.startswith(prefix):
            summary = summary[len(prefix):].strip()
            lowered = summary.lower()
    return summary.rstrip(".")


def _infer_role_tags(content: str, excerpt: str, assignee: str | None) -> list[str]:
    haystack = f"{content} {excerpt}".lower()
    role_tags = [
        role
        for role, keywords in ROLE_KEYWORDS.items()
        if any(keyword in haystack for keyword in keywords)
    ]

    if assignee and not role_tags:
        role_tags.append("general")
    if not role_tags:
        role_tags.append("general")

    return _unique_strings(role_tags)


def _matches_any(text: str, patterns: tuple[re.Pattern[str], ...]) -> bool:
    return any(pattern.search(text) for pattern in patterns)


def _normalize_text(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _unique_strings(values: list[Any]) -> list[str]:
    unique: list[str] = []
    seen: set[str] = set()
    for value in values:
        if value is None:
            continue
        cleaned = str(value).strip()
        if not cleaned:
            continue
        normalized = cleaned.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        unique.append(normalized)
    return unique


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        return list(value)
    return [value]


def _clean_person_name(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip(" @|,.;")
    return cleaned or None


def _coerce_confidence(value: Any) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, numeric))
