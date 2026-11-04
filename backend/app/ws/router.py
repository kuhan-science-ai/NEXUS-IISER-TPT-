import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.future import select

from backend.app.core.security import decode_token
from backend.app.db.session import AsyncSessionLocal
from backend.app.models.user import User
from backend.app.models.message import ConversationMember
from backend.app.ws.connection_manager import manager

router = APIRouter(tags=["WebSocket"])

@router.websocket("/ws/nexus")
async def nexus_websocket(
    websocket: WebSocket,
    token: str = Query(...)
):
    # 1. Authenticate token
    payload = decode_token(token)
    if not payload or payload.get("token_type") != "access":
        await websocket.close(code=4001, reason="Unauthorized")
        return

    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=4001, reason="Invalid credentials")
        return

    # Verify user exists in DB
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        if not user or not user.is_active:
            await websocket.close(code=4003, reason="Account inactive")
            return
        username = user.username

    # Connect client
    await manager.connect(user_id, websocket)

    # Broadcast presence
    await manager.send_personal_message(
        user_id,
        {"event": "system.ready", "user_id": user_id, "username": username}
    )

    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                data = json.loads(raw_text)
            except Exception:
                continue

            event_type = data.get("event")

            # Heartbeat ping/pong
            if event_type == "ping":
                await websocket.send_text(json.dumps({"event": "pong"}))

            # Typing indicators
            elif event_type in ("typing.start", "typing.stop"):
                conv_id = data.get("conversation_id")
                if conv_id:
                    async with AsyncSessionLocal() as db:
                        members = (await db.execute(
                            select(ConversationMember.user_id).where(ConversationMember.conversation_id == conv_id)
                        )).scalars().all()
                    
                    target_users = [uid for uid in members if uid != user_id]
                    await manager.broadcast_to_users(
                        target_users,
                        {
                            "event": event_type,
                            "conversation_id": conv_id,
                            "user_id": user_id,
                            "username": username,
                        }
                    )

    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except Exception:
        manager.disconnect(user_id, websocket)
