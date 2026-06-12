import uuid
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional

from app.services.presence_manager import presence_manager, PresenceConnection


CALL_TYPES = ("1on1", "group", "meeting", "presentation")
CALL_STATUSES = ("ringing", "ongoing", "ended", "missed", "rejected")

CALL_EVENTS = frozenset({
    "initiate_call",
    "accept_call",
    "reject_call",
    "end_call",
    "join_call",
    "start_presentation",
    "stop_presentation",
    "get_logs",
    "get_active_calls",
})


@dataclass
class CallParticipant:
    username: str
    display_name: str
    status: str = "invited"


@dataclass
class CallSession:
    id: str
    call_type: str
    title: str
    host: str
    host_name: str
    participants: dict[str, CallParticipant] = field(default_factory=dict)
    status: str = "ringing"
    presentation_active: bool = False
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: Optional[str] = None
    ended_at: Optional[str] = None


@dataclass
class CallLogEntry:
    id: str
    call_id: str
    call_type: str
    title: str
    direction: str
    status: str
    participants: list[str]
    participant_usernames: list[str]
    initiator: str
    initiator_name: str
    timestamp: str
    duration_seconds: Optional[int] = None


class CallManager:
    def __init__(self):
        self.calls: dict[str, CallSession] = {}
        self.call_logs: list[CallLogEntry] = []

    async def handle_event(self, user: PresenceConnection, data: dict):
        event = data.get("event")
        handlers = {
            "initiate_call": self._initiate_call,
            "accept_call": self._accept_call,
            "reject_call": self._reject_call,
            "end_call": self._end_call,
            "join_call": self._join_call,
            "start_presentation": self._start_presentation,
            "stop_presentation": self._stop_presentation,
            "get_logs": self._send_logs,
            "get_active_calls": self._send_active_calls,
        }
        handler = handlers.get(event)
        if handler:
            await handler(user, data)

    async def _initiate_call(self, user: PresenceConnection, data: dict):
        call_type = data.get("call_type", "1on1")
        targets = data.get("targets", [])
        title = data.get("title") or self._default_title(call_type, user.display_name)

        call_id = f"call-{uuid.uuid4().hex[:10]}"
        call = CallSession(
            id=call_id,
            call_type=call_type,
            title=title,
            host=user.username,
            host_name=user.display_name,
        )
        call.participants[user.username] = CallParticipant(user.username, user.display_name, "joined")

        for t in targets:
            tname = data.get("target_names", {}).get(t, t)
            call.participants[t] = CallParticipant(t, tname, "invited")

        self.calls[call_id] = call
        presence_manager.set_busy(user.username, call_id)

        await presence_manager.send_to_user(user.username, {
            "event": "call_initiated",
            "call": self._serialize_call(call),
        })

        for target in targets:
            if presence_manager.is_online(target):
                await presence_manager.send_to_user(target, {
                    "event": "incoming_call",
                    "call": self._serialize_call(call),
                    "from": user.display_name,
                })
            else:
                call.participants[target].status = "missed"
                self._add_log(call, target, "missed", "incoming")

        self._add_log(call, user.username, "ringing", "outgoing")
        await presence_manager._broadcast_presence()

    async def _accept_call(self, user: PresenceConnection, data: dict):
        call_id = data.get("call_id")
        call = self.calls.get(call_id)
        if not call:
            return

        if user.username in call.participants:
            call.participants[user.username].status = "joined"

        if call.status == "ringing":
            call.status = "ongoing"
            call.started_at = datetime.now(timezone.utc).isoformat()

        presence_manager.set_call_status(user.username, True, call_id)

        await self._broadcast_call(call, {
            "event": "call_accepted",
            "call": self._serialize_call(call),
            "participant": user.display_name,
        })
        self._add_log(call, user.username, "ongoing", "incoming")
        await presence_manager._broadcast_presence()

    async def _reject_call(self, user: PresenceConnection, data: dict):
        call_id = data.get("call_id")
        call = self.calls.get(call_id)
        if not call:
            return

        if user.username in call.participants:
            call.participants[user.username].status = "missed"

        await self._notify_host(call, {
            "event": "call_rejected",
            "call_id": call_id,
            "participant": user.display_name,
        })

        self._add_log(call, user.username, "rejected", "incoming")

        if call.call_type == "1on1":
            call.status = "rejected"
            call.ended_at = datetime.now(timezone.utc).isoformat()
            presence_manager.set_call_status(call.host, False)
            await presence_manager._broadcast_presence()

    async def _end_call(self, user: PresenceConnection, data: dict):
        call_id = data.get("call_id")
        call = self.calls.get(call_id)
        if not call:
            return

        call.status = "ended"
        call.ended_at = datetime.now(timezone.utc).isoformat()
        call.presentation_active = False

        duration = None
        if call.started_at:
            start = datetime.fromisoformat(call.started_at)
            end = datetime.fromisoformat(call.ended_at)
            duration = int((end - start).total_seconds())

        await self._broadcast_call(call, {
            "event": "call_ended",
            "call": self._serialize_call(call),
            "duration_seconds": duration,
        })

        for uname in call.participants:
            live = presence_manager.get_connection(uname)
            if live and live.current_call_id == call_id:
                presence_manager.set_call_status(uname, False)

        self._add_log(call, user.username, "ended", "outgoing", duration)
        await presence_manager._broadcast_presence()

    async def _join_call(self, user: PresenceConnection, data: dict):
        call_id = data.get("call_id")
        call = self.calls.get(call_id)
        if not call or call.status not in ("ringing", "ongoing"):
            return

        call.participants.setdefault(user.username, CallParticipant(user.username, user.display_name))
        call.participants[user.username].status = "joined"
        if call.status == "ringing":
            call.status = "ongoing"
            call.started_at = datetime.now(timezone.utc).isoformat()

        presence_manager.set_call_status(user.username, True, call_id)

        await self._broadcast_call(call, {
            "event": "participant_joined",
            "call": self._serialize_call(call),
            "participant": user.display_name,
        })
        await presence_manager._broadcast_presence()

    async def _start_presentation(self, user: PresenceConnection, data: dict):
        call_id = data.get("call_id")
        call = self.calls.get(call_id)
        if not call or call.host != user.username:
            return
        call.presentation_active = True
        await self._broadcast_call(call, {
            "event": "presentation_started",
            "call": self._serialize_call(call),
            "presenter": user.display_name,
        })

    async def _stop_presentation(self, user: PresenceConnection, data: dict):
        call_id = data.get("call_id")
        call = self.calls.get(call_id)
        if not call:
            return
        call.presentation_active = False
        await self._broadcast_call(call, {
            "event": "presentation_stopped",
            "call": self._serialize_call(call),
        })

    async def _send_logs(self, user: PresenceConnection, data: dict):
        logs = [
            self._serialize_log(l) for l in self.call_logs
            if user.username in l.participant_usernames or l.initiator == user.username
        ]
        await presence_manager.send_to_user(user.username, {"event": "call_logs", "logs": logs[-50:]})

    async def _send_active_calls(self, user: PresenceConnection, data: dict):
        active = [
            self._serialize_call(c) for c in self.calls.values()
            if c.status in ("ringing", "ongoing") and user.username in c.participants
        ]
        await presence_manager.send_to_user(user.username, {"event": "active_calls", "calls": active})

    async def _broadcast_call(self, call: CallSession, payload: dict):
        for uname in call.participants:
            await presence_manager.send_to_user(uname, payload)

    async def _notify_host(self, call: CallSession, payload: dict):
        await presence_manager.send_to_user(call.host, payload)

    def _default_title(self, call_type: str, name: str) -> str:
        titles = {
            "1on1": f"Call with {name}",
            "group": f"Group call hosted by {name}",
            "meeting": f"Meeting — {name}",
            "presentation": f"Live demo — {name}",
        }
        return titles.get(call_type, f"Call — {name}")

    def _serialize_call(self, call: CallSession) -> dict:
        return {
            "id": call.id,
            "call_type": call.call_type,
            "title": call.title,
            "host": call.host,
            "host_name": call.host_name,
            "status": call.status,
            "presentation_active": call.presentation_active,
            "participants": [
                {"username": p.username, "display_name": p.display_name, "status": p.status}
                for p in call.participants.values()
            ],
            "created_at": call.created_at,
            "started_at": call.started_at,
            "ended_at": call.ended_at,
        }

    def _serialize_log(self, log: CallLogEntry) -> dict:
        return {
            "id": log.id,
            "call_id": log.call_id,
            "call_type": log.call_type,
            "title": log.title,
            "direction": log.direction,
            "status": log.status,
            "participants": log.participants,
            "participant_usernames": log.participant_usernames,
            "initiator": log.initiator,
            "initiator_name": log.initiator_name,
            "timestamp": log.timestamp,
            "duration_seconds": log.duration_seconds,
        }

    def _add_log(self, call: CallSession, username: str, status: str, direction: str, duration: Optional[int] = None):
        entry = CallLogEntry(
            id=f"log-{uuid.uuid4().hex[:8]}",
            call_id=call.id,
            call_type=call.call_type,
            title=call.title,
            direction=direction,
            status=status,
            participants=[p.display_name for p in call.participants.values()],
            participant_usernames=list(call.participants.keys()),
            initiator=call.host,
            initiator_name=call.host_name,
            timestamp=datetime.now(timezone.utc).isoformat(),
            duration_seconds=duration,
        )
        self.call_logs.append(entry)
        return entry

    def get_logs_for_user(self, username: str) -> list[dict]:
        return [
            self._serialize_log(l)
            for l in self.call_logs
            if username in l.participant_usernames or l.initiator == username
        ]

    def get_active_calls(self) -> list[dict]:
        return [
            self._serialize_call(c)
            for c in self.calls.values()
            if c.status in ("ringing", "ongoing")
        ]


call_manager = CallManager()