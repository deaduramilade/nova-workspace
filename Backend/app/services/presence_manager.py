from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional
from fastapi import WebSocket


PRESENCE_STATUSES = ("online", "offline", "busy", "in_call", "away")
SETTABLE_STATUSES = ("online", "busy", "away")
HEARTBEAT_STALE_SECONDS = 90

KNOWN_USERS: dict[str, str] = {
    "johndoe": "John Doe",
    "alicesmith": "Alice Smith",
    "michaelchen": "Michael Chen",
    "sarahlee": "Sarah Lee",
    "davidkim": "David Kim",
}


@dataclass
class PresenceConnection:
    websocket: WebSocket
    username: str
    display_name: str
    status: str = "online"
    status_message: str = ""
    current_call_id: Optional[str] = None
    last_heartbeat: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    connected_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_activity: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PresenceManager:
    def __init__(self):
        self.connections: dict[str, PresenceConnection] = {}
        self.last_seen: dict[str, str] = {}
        self.display_names: dict[str, str] = dict(KNOWN_USERS)
        self.offline_status_messages: dict[str, str] = {}

    async def connect(self, websocket: WebSocket, username: str, display_name: str) -> PresenceConnection:
        await websocket.accept()

        if username in self.connections:
            try:
                await self.connections[username].websocket.close()
            except Exception:
                pass

        self.display_names[username] = display_name
        now = datetime.now(timezone.utc).isoformat()
        saved_message = self.offline_status_messages.get(username, "")

        user = PresenceConnection(
            websocket=websocket,
            username=username,
            display_name=display_name,
            status="online",
            status_message=saved_message,
            last_heartbeat=now,
            connected_at=now,
            last_activity=now,
        )
        self.connections[username] = user

        await self._send(user, {
            "event": "presence_snapshot",
            "users": self.get_directory(),
            "you": self.serialize(user),
            "stats": self.get_stats(),
        })
        await self._broadcast_presence(exclude=username)
        await self._broadcast_user_event("user_online", username, {"status": "online"})
        return user

    def disconnect(self, user: PresenceConnection):
        now = datetime.now(timezone.utc).isoformat()
        self.last_seen[user.username] = now
        if user.status_message:
            self.offline_status_messages[user.username] = user.status_message
        self.connections.pop(user.username, None)

    def get_connection(self, username: str) -> Optional[PresenceConnection]:
        return self.connections.get(username)

    def is_online(self, username: str) -> bool:
        return username in self.connections

    async def send_to_user(self, username: str, payload: dict) -> bool:
        user = self.connections.get(username)
        if not user:
            return False
        await self._send(user, payload)
        return True

    async def handle_event(self, user: PresenceConnection, data: dict):
        event = data.get("event")
        handlers = {
            "get_presence": self._send_presence,
            "set_presence": self._set_presence,
            "set_status_message": self._set_status_message,
            "heartbeat": self._heartbeat,
            "activity": self._activity,
        }
        handler = handlers.get(event)
        if handler:
            await handler(user, data)

    async def _send_presence(self, user: PresenceConnection, data: dict):
        await self._send(user, {
            "event": "presence_snapshot",
            "users": self.get_directory(),
            "you": self.serialize(user),
            "stats": self.get_stats(),
        })

    async def _set_presence(self, user: PresenceConnection, data: dict):
        if user.current_call_id:
            return
        status = data.get("status", "online")
        if status not in SETTABLE_STATUSES:
            return
        user.status = status
        user.last_activity = datetime.now(timezone.utc).isoformat()
        await self._broadcast_presence()
        await self._broadcast_user_event("presence_updated", user.username, {
            "status": status,
            "status_message": user.status_message,
        })

    async def _set_status_message(self, user: PresenceConnection, data: dict):
        if user.current_call_id:
            return
        message = (data.get("message") or "").strip()[:120]
        user.status_message = message
        user.last_activity = datetime.now(timezone.utc).isoformat()
        await self._broadcast_presence()
        await self._broadcast_user_event("presence_updated", user.username, {
            "status": user.status,
            "status_message": message,
        })

    async def _heartbeat(self, user: PresenceConnection, data: dict):
        user.last_heartbeat = datetime.now(timezone.utc).isoformat()
        await self._prune_stale_connections()
        await self._send(user, {"event": "heartbeat_ack", "ts": user.last_heartbeat})

    async def _activity(self, user: PresenceConnection, data: dict):
        user.last_activity = datetime.now(timezone.utc).isoformat()
        if user.status == "away" and not user.current_call_id:
            user.status = "online"
            await self._broadcast_presence()
            await self._broadcast_user_event("presence_updated", user.username, {
                "status": "online",
                "status_message": user.status_message,
            })

    def set_call_status(self, username: str, in_call: bool, call_id: Optional[str] = None):
        user = self.connections.get(username)
        if not user:
            return
        if in_call:
            user.status = "in_call"
            user.current_call_id = call_id
        else:
            user.status = "online"
            user.current_call_id = None
        user.last_activity = datetime.now(timezone.utc).isoformat()

    def set_busy(self, username: str, call_id: str):
        user = self.connections.get(username)
        if user:
            user.status = "busy"
            user.current_call_id = call_id

    async def notify_offline(self, username: str):
        await self._broadcast_user_event("user_offline", username, {
            "last_seen": self.last_seen.get(username),
        })
        await self._broadcast_presence()

    async def _prune_stale_connections(self):
        now = datetime.now(timezone.utc)
        stale: list[str] = []
        for username, user in self.connections.items():
            try:
                last = datetime.fromisoformat(user.last_heartbeat)
                if (now - last).total_seconds() > HEARTBEAT_STALE_SECONDS:
                    stale.append(username)
            except Exception:
                stale.append(username)

        for username in stale:
            user = self.connections.get(username)
            if user:
                self.disconnect(user)
                await self.notify_offline(username)

    async def _broadcast_presence(self, exclude: Optional[str] = None):
        snapshot = self.get_directory()
        stats = self.get_stats()
        for u in self.connections.values():
            if exclude and u.username == exclude:
                continue
            await self._send(u, {
                "event": "presence_snapshot",
                "users": snapshot,
                "you": self.serialize(u),
                "stats": stats,
            })
            online_only = [p for p in snapshot if p["is_online"] and p["username"] != u.username]
            await self._send(u, {"event": "online_users", "users": online_only})

    async def _broadcast_user_event(self, event: str, username: str, extra: Optional[dict] = None):
        payload = {
            "event": event,
            "username": username,
            "last_seen": self.last_seen.get(username),
            **(extra or {}),
        }
        for u in self.connections.values():
            if u.username != username:
                await self._send(u, payload)

    async def _send(self, user: PresenceConnection, payload: dict):
        try:
            await user.websocket.send_json(payload)
        except Exception:
            self.disconnect(user)

    def serialize(self, user: PresenceConnection) -> dict:
        return {
            "username": user.username,
            "display_name": user.display_name,
            "status": user.status,
            "status_message": user.status_message,
            "is_online": True,
            "last_seen": None,
            "connected_at": user.connected_at,
            "last_activity": user.last_activity,
        }

    def get_directory(self) -> list[dict]:
        directory: list[dict] = []
        seen: set[str] = set()

        for username, display_name in self.display_names.items():
            seen.add(username)
            live = self.connections.get(username)
            if live:
                directory.append(self.serialize(live))
            else:
                directory.append({
                    "username": username,
                    "display_name": display_name,
                    "status": "offline",
                    "status_message": self.offline_status_messages.get(username, ""),
                    "is_online": False,
                    "last_seen": self.last_seen.get(username),
                    "connected_at": None,
                    "last_activity": None,
                })

        for username, live in self.connections.items():
            if username not in seen:
                directory.append(self.serialize(live))

        directory.sort(key=lambda u: (not u["is_online"], u["display_name"].lower()))
        return directory

    def get_stats(self) -> dict:
        directory = self.get_directory()
        online = [u for u in directory if u["is_online"]]
        return {
            "total": len(directory),
            "online": len(online),
            "offline": len(directory) - len(online),
            "busy": len([u for u in online if u["status"] == "busy"]),
            "in_call": len([u for u in online if u["status"] == "in_call"]),
            "away": len([u for u in online if u["status"] == "away"]),
        }

    def get_online_users(self, exclude: Optional[str] = None) -> list[dict]:
        return [
            u for u in self.get_directory()
            if u["is_online"] and u["username"] != exclude
        ]

    def get_offline_users(self, exclude: Optional[str] = None) -> list[dict]:
        return [
            u for u in self.get_directory()
            if not u["is_online"] and u["username"] != exclude
        ]


presence_manager = PresenceManager()