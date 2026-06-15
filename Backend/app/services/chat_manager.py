import json
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional
from fastapi import WebSocket


@dataclass
class ChatConnection:
    websocket: WebSocket
    room_id: str
    username: str
    display_name: str
    team: Optional[str] = None


class ChatManager:
    def __init__(self):
        self.rooms: dict[str, list[ChatConnection]] = {}

    async def connect(
        self,
        websocket: WebSocket,
        room_id: str,
        username: str,
        display_name: str,
        team: Optional[str] = None,
    ) -> ChatConnection:
        await websocket.accept()
        conn = ChatConnection(
            websocket=websocket,
            room_id=room_id,
            username=username,
            display_name=display_name,
            team=team,
        )
        self.rooms.setdefault(room_id, []).append(conn)

        await self._broadcast_system(
            room_id,
            f"{display_name} joined the conversation",
            exclude=conn,
        )
        return conn

    def disconnect(self, conn: ChatConnection):
        room = self.rooms.get(conn.room_id, [])
        if conn in room:
            room.remove(conn)
        if not room:
            self.rooms.pop(conn.room_id, None)

    async def handle_message(self, conn: ChatConnection, data: dict):
        msg_type = data.get("type", "message")
        content = (data.get("content") or "").strip()
        attachment = data.get("attachment") or None  # {filename, url, size?, content_type?, ...}

        # Allow pure-attachment messages (no text caption required)
        if not content and not attachment and msg_type != "ai":
            return

        target_type = data.get("target_type", "all")
        target_value = data.get("target_value")

        payload: dict = {
            "type": msg_type,
            "room_id": conn.room_id,
            "content": content,
            "sender": conn.username,
            "sender_name": conn.display_name,
            "target_type": target_type,
            "target_value": target_value,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        if msg_type == "ai":
            # Special handling for role-based Nova assistant replies
            assistant_name = data.get("assistant_name") or "Nova"
            payload["sender"] = "nova"
            payload["sender_name"] = assistant_name
            payload["is_ai"] = True
            # AI messages are usually broadcast to the whole room
            if not target_type or target_type == "all":
                target_type = "all"
                target_value = None

        if attachment:
            # Only include safe known keys
            safe_attachment = {
                k: attachment[k]
                for k in ("id", "filename", "url", "size", "content_type")
                if k in attachment and attachment[k] is not None
            }
            if safe_attachment:
                payload["attachment"] = safe_attachment

        recipients = self._resolve_recipients(conn, target_type, target_value)
        await self._send_to(recipients, payload)

    def _resolve_recipients(
        self,
        sender: ChatConnection,
        target_type: str,
        target_value: Optional[str],
    ) -> list[ChatConnection]:
        room = self.rooms.get(sender.room_id, [])
        if target_type == "all" or not target_value:
            return room

        if target_type == "user":
            matches = [
                c for c in room
                if c.username == target_value
                or c.display_name == target_value
                or c is sender
            ]
            return matches if matches else [sender]

        if target_type == "team":
            return [
                c for c in room
                if c.team == target_value or c is sender
            ]

        return room

    async def _send_to(self, recipients: list[ChatConnection], payload: dict):
        dead: list[ChatConnection] = []
        for conn in recipients:
            try:
                await conn.websocket.send_json(payload)
            except Exception:
                dead.append(conn)
        for conn in dead:
            self.disconnect(conn)

    async def _broadcast_system(
        self,
        room_id: str,
        content: str,
        exclude: Optional[ChatConnection] = None,
    ):
        payload = {
            "type": "notice",
            "room_id": room_id,
            "content": content,
            "sender": "system",
            "sender_name": "Nova",
            "target_type": "all",
            "target_value": None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        room = self.rooms.get(room_id, [])
        for conn in room:
            if conn is exclude:
                continue
            try:
                await conn.websocket.send_json(payload)
            except Exception:
                self.disconnect(conn)


chat_manager = ChatManager()