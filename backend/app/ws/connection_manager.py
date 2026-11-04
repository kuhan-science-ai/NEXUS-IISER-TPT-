import json
import logging
from typing import Dict, Set, Any
from fastapi import WebSocket

logger = logging.getLogger("nexus.websocket")

class ConnectionManager:
    """
    Manages active WebSocket connections mapped by user_id and active conversation rooms.
    Ensures safe broadcast, user-specific delivery, and disconnect cleanup.
    """
    def __init__(self):
        # user_id -> Set of active WebSocket connections (allows multi-tab/multi-device)
        self.active_user_connections: Dict[str, Set[WebSocket]] = {}
        # conversation_id -> Set of user_ids currently focused/joined
        self.conversation_rooms: Dict[str, Set[str]] = {}

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        if user_id not in self.active_user_connections:
            self.active_user_connections[user_id] = set()
        self.active_user_connections[user_id].add(websocket)
        logger.info(f"WebSocket connected for user {user_id}. Total devices: {len(self.active_user_connections[user_id])}")

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        if user_id in self.active_user_connections:
            self.active_user_connections[user_id].discard(websocket)
            if not self.active_user_connections[user_id]:
                del self.active_user_connections[user_id]
        logger.info(f"WebSocket disconnected for user {user_id}")

    def is_user_online(self, user_id: str) -> bool:
        return user_id in self.active_user_connections and len(self.active_user_connections[user_id]) > 0

    async def send_personal_message(self, user_id: str, message_payload: Dict[str, Any]) -> None:
        """Sends payload to all active client sockets for the given user."""
        if user_id in self.active_user_connections:
            dead_sockets = set()
            text_data = json.dumps(message_payload)
            for ws in self.active_user_connections[user_id]:
                try:
                    await ws.send_text(text_data)
                except Exception as e:
                    logger.warning(f"Error sending to user {user_id}: {e}")
                    dead_sockets.add(ws)
            for dead in dead_sockets:
                self.disconnect(user_id, dead)

    async def broadcast_to_users(self, user_ids: list[str], message_payload: Dict[str, Any]) -> None:
        """Broadcasts payload to a list of users."""
        for uid in user_ids:
            await self.send_personal_message(uid, message_payload)

manager = ConnectionManager()
