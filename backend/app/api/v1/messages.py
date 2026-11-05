from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_, and_, desc

from backend.app.db.session import get_db
from backend.app.models.user import User, UserProfile
from backend.app.models.file import FileMetadata
from backend.app.models.message import (
    Conversation,
    ConversationMember,
    Message,
    MessageAttachment,
    MessageReaction,
    MessageReadReceipt,
    ConversationType,
    MemberRole,
    MessageType,
)
from backend.app.models.social import BlockedUser
from backend.app.models.audit import AuditLog
from backend.app.schemas.message import (
    ConversationCreateRequest,
    MessageSendRequest,
    MessageUpdateRequest,
    MessageReactionRequest,
    MessageResponse,
    AttachmentResponse,
    ReactionResponse,
    ConversationSummary,
    ConversationMemberSummary,
)
from backend.app.ws.connection_manager import manager
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/messages", tags=["Messaging"])

async def format_message_response(msg: Message, db: AsyncSession) -> MessageResponse:
    # Load attachments
    att_stmt = select(MessageAttachment).options(selectinload(MessageAttachment.file)).where(MessageAttachment.message_id == msg.id)
    att_res = await db.execute(att_stmt)
    attachments_list = []
    for att in att_res.scalars().all():
        if att.file:
            attachments_list.append(AttachmentResponse(
                id=att.id,
                file_id=att.file_id,
                filename=att.file.filename,
                mime_type=att.file.mime_type,
                size_bytes=att.file.size_bytes,
                download_url=f"/api/v1/files/{att.file_id}/download",
            ))

    # Load reactions
    react_stmt = select(MessageReaction).where(MessageReaction.message_id == msg.id)
    react_res = await db.execute(react_stmt)
    reactions = react_res.scalars().all()
    grouped_reacts = {}
    for r in reactions:
        if r.emoji not in grouped_reacts:
            grouped_reacts[r.emoji] = []
        grouped_reacts[r.emoji].append(r.user_id)

    reactions_list = [
        ReactionResponse(emoji=k, count=len(v), user_ids=v)
        for k, v in grouped_reacts.items()
    ]

    sender_username = msg.sender.username if msg.sender else "Deleted User"
    sender_name = msg.sender.profile.full_name if (msg.sender and msg.sender.profile) else sender_username

    reply_preview = None
    if msg.reply_to_id:
        r_stmt = select(Message).where(Message.id == msg.reply_to_id)
        r_res = await db.execute(r_stmt)
        replied = r_res.scalar_one_or_none()
        if replied:
            reply_preview = (replied.content[:50] + "...") if len(replied.content) > 50 else replied.content

    content_display = "This message was deleted." if msg.is_deleted else msg.content

    return MessageResponse(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_id=msg.sender_id,
        sender_username=sender_username,
        sender_name=sender_name,
        content=content_display,
        message_type=msg.message_type,
        reply_to_id=msg.reply_to_id,
        reply_preview=reply_preview,
        is_pinned=msg.is_pinned,
        is_edited=msg.is_edited,
        is_deleted=msg.is_deleted,
        created_at=msg.created_at,
        updated_at=msg.updated_at,
        attachments=attachments_list,
        reactions=reactions_list,
    )

@router.get("/conversations", response_model=List[ConversationSummary])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Find all conversations current_user belongs to
    m_stmt = select(ConversationMember).where(ConversationMember.user_id == current_user.id)
    m_res = await db.execute(m_stmt)
    memberships = m_res.scalars().all()

    conv_ids = [m.conversation_id for m in memberships]
    if not conv_ids:
        return []

    c_stmt = (
        select(Conversation)
        .options(
            selectinload(Conversation.members).selectinload(ConversationMember.user).selectinload(User.profile)
        )
        .where(Conversation.id.in_(conv_ids))
        .order_by(desc(Conversation.updated_at))
    )
    c_res = await db.execute(c_stmt)
    conversations = c_res.scalars().all()

    summaries = []
    for conv in conversations:
        # Get last message
        last_msg_stmt = (
            select(Message)
            .options(selectinload(Message.sender).selectinload(User.profile))
            .where(Message.conversation_id == conv.id)
            .order_by(desc(Message.created_at))
            .limit(1)
        )
        last_msg = (await db.execute(last_msg_stmt)).scalar_one_or_none()
        last_msg_resp = await format_message_response(last_msg, db) if last_msg else None

        # Format members
        members_summary = []
        for member in conv.members:
            if member.user:
                avatar_url = (
                    f"/api/v1/files/{member.user.profile.avatar_file_id}/download"
                    if member.user.profile and member.user.profile.avatar_file_id
                    else None
                )
                members_summary.append(ConversationMemberSummary(
                    user_id=member.user.id,
                    username=member.user.username,
                    full_name=member.user.profile.full_name if member.user.profile else member.user.username,
                    role=member.role,
                    avatar_url=avatar_url,
                ))

        # Title calculation for direct messages
        title = conv.title
        if conv.type == ConversationType.DIRECT and not title:
            other_members = [m for m in members_summary if m.user_id != current_user.id]
            title = other_members[0].full_name if other_members else "Direct Conversation"

        summaries.append(ConversationSummary(
            id=conv.id,
            type=conv.type,
            title=title,
            description=conv.description,
            creator_id=conv.creator_id,
            avatar_url=f"/api/v1/files/{conv.avatar_file_id}/download" if conv.avatar_file_id else None,
            banner_url=f"/api/v1/files/{conv.banner_file_id}/download" if conv.banner_file_id else None,
            last_message=last_msg_resp,
            unread_count=0,
            members=members_summary,
            created_at=conv.created_at,
        ))

    return summaries

@router.post("/conversations", response_model=ConversationSummary)
async def create_conversation(
    req: ConversationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    participants = set(req.participant_user_ids)
    participants.add(current_user.id)

    # For direct chat, check if one already exists
    if req.type == ConversationType.DIRECT and len(participants) == 2:
        other_user_id = [uid for uid in participants if uid != current_user.id][0]
        # Check blocked
        b_stmt = select(BlockedUser).where(
            or_(
                and_(BlockedUser.blocker_id == current_user.id, BlockedUser.blocked_id == other_user_id),
                and_(BlockedUser.blocker_id == other_user_id, BlockedUser.blocked_id == current_user.id)
            )
        )
        if (await db.execute(b_stmt)).scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Cannot message a blocked user")

        # Find existing direct conversation
        c_stmt = (
            select(Conversation)
            .join(ConversationMember)
            .where(Conversation.type == ConversationType.DIRECT)
            .group_by(Conversation.id)
        )
        c_res = await db.execute(c_stmt)
        for existing_c in c_res.scalars().all():
            m_res = await db.execute(select(ConversationMember.user_id).where(ConversationMember.conversation_id == existing_c.id))
            m_ids = set(m_res.scalars().all())
            if m_ids == participants:
                # Return existing
                return (await list_conversations(current_user, db))[0]

    # Create new conversation
    new_conv = Conversation(
        title=req.title,
        type=req.type,
        description=req.description,
        creator_id=current_user.id,
    )
    db.add(new_conv)
    await db.flush()

    for uid in participants:
        member_role = MemberRole.ADMIN if (uid == current_user.id and req.type == ConversationType.GROUP) else MemberRole.MEMBER
        mem = ConversationMember(
            conversation_id=new_conv.id,
            user_id=uid,
            role=member_role,
        )
        db.add(mem)

    await db.commit()
    await db.refresh(new_conv)

    # Broadcast conversation creation via WS
    await manager.broadcast_to_users(
        list(participants),
        {"event": "conversation.created", "conversation_id": new_conv.id, "title": new_conv.title}
    )

    convs = await list_conversations(current_user, db)
    for c in convs:
        if c.id == new_conv.id:
            return c
    raise HTTPException(status_code=500, detail="Error generating conversation summary")

@router.get("/conversations/{conv_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    conv_id: str,
    before_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify membership
    m_stmt = select(ConversationMember).where(
        and_(ConversationMember.conversation_id == conv_id, ConversationMember.user_id == current_user.id)
    )
    if not (await db.execute(m_stmt)).scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this conversation")

    query = (
        select(Message)
        .options(selectinload(Message.sender).selectinload(User.profile))
        .where(Message.conversation_id == conv_id)
    )
    if before_id:
        target_msg = (await db.execute(select(Message).where(Message.id == before_id))).scalar_one_or_none()
        if target_msg:
            query = query.where(Message.created_at < target_msg.created_at)

    query = query.order_by(desc(Message.created_at)).limit(limit)
    res = await db.execute(query)
    messages = list(reversed(res.scalars().all()))

    formatted = []
    for m in messages:
        formatted.append(await format_message_response(m, db))
    return formatted

@router.post("/conversations/{conv_id}/messages", response_model=MessageResponse)
async def send_message(
    conv_id: str,
    req: MessageSendRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify membership
    m_stmt = select(ConversationMember).where(
        and_(ConversationMember.conversation_id == conv_id, ConversationMember.user_id == current_user.id)
    )
    if not (await db.execute(m_stmt)).scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this conversation")

    # Verify conversation and check blocking if direct
    conv_stmt = select(Conversation).options(selectinload(Conversation.members)).where(Conversation.id == conv_id)
    conv = (await db.execute(conv_stmt)).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conv.type == ConversationType.DIRECT:
        other_members = [m for m in conv.members if m.user_id != current_user.id]
        if other_members:
            other_id = other_members[0].user_id
            b_stmt = select(BlockedUser).where(
                or_(
                    and_(BlockedUser.blocker_id == current_user.id, BlockedUser.blocked_id == other_id),
                    and_(BlockedUser.blocker_id == other_id, BlockedUser.blocked_id == current_user.id)
                )
            )
            if (await db.execute(b_stmt)).scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Cannot send message: user is blocked")

    # Create permanent message record
    new_message = Message(
        conversation_id=conv_id,
        sender_id=current_user.id,
        content=req.content,
        message_type=req.message_type,
        reply_to_id=req.reply_to_id,
    )
    db.add(new_message)
    await db.flush()

    if req.attachment_file_ids:
        for fid in req.attachment_file_ids:
            att = MessageAttachment(
                message_id=new_message.id,
                file_id=fid,
            )
            db.add(att)

    conv.updated_at = datetime.now(timezone.utc)
    await db.commit()

    # Re-fetch with relationships
    msg_stmt = (
        select(Message)
        .options(selectinload(Message.sender).selectinload(User.profile))
        .where(Message.id == new_message.id)
    )
    msg_obj = (await db.execute(msg_stmt)).scalar_one()
    resp = await format_message_response(msg_obj, db)

    # Real-time WebSocket delivery to all members
    member_user_ids = [m.user_id for m in conv.members]
    await manager.broadcast_to_users(
        member_user_ids,
        {
            "event": "message.new",
            "conversation_id": conv_id,
            "message": resp.model_dump(mode="json"),
        }
    )

    return resp

@router.put("/messages/{message_id}", response_model=MessageResponse)
async def edit_message(
    message_id: str,
    req: MessageUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Message).options(selectinload(Message.sender).selectinload(User.profile)).where(Message.id == message_id)
    msg = (await db.execute(stmt)).scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own messages")
    if msg.is_deleted:
        raise HTTPException(status_code=400, detail="Cannot edit a deleted message")

    msg.content = req.content
    msg.is_edited = True
    msg.updated_at = datetime.now(timezone.utc)
    await db.commit()

    resp = await format_message_response(msg, db)

    # Notify conversation members
    c_mems = (await db.execute(select(ConversationMember.user_id).where(ConversationMember.conversation_id == msg.conversation_id))).scalars().all()
    await manager.broadcast_to_users(
        list(c_mems),
        {"event": "message.edited", "conversation_id": msg.conversation_id, "message": resp.model_dump(mode="json")}
    )

    return resp

@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Message).where(Message.id == message_id)
    msg = (await db.execute(stmt)).scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    # Check permission: Author, or Admin of group conversation
    is_author = msg.sender_id == current_user.id
    is_admin = False
    mem_stmt = select(ConversationMember).where(
        and_(ConversationMember.conversation_id == msg.conversation_id, ConversationMember.user_id == current_user.id)
    )
    membership = (await db.execute(mem_stmt)).scalar_one_or_none()
    if membership and membership.role == MemberRole.ADMIN:
        is_admin = True

    if not is_author and not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this message")

    # Soft deletion + audit log
    msg.is_deleted = True
    msg.deleted_by_id = current_user.id
    msg.updated_at = datetime.now(timezone.utc)

    audit = AuditLog(
        user_id=current_user.id,
        action="message_delete",
        resource_type="message",
        resource_id=msg.id,
        details=f"Message deleted by {current_user.username} (Author: {is_author}, Admin: {is_admin})"
    )
    db.add(audit)
    await db.commit()

    c_mems = (await db.execute(select(ConversationMember.user_id).where(ConversationMember.conversation_id == msg.conversation_id))).scalars().all()
    await manager.broadcast_to_users(
        list(c_mems),
        {"event": "message.deleted", "conversation_id": msg.conversation_id, "message_id": msg.id}
    )

    return {"message": "Message deleted"}

@router.delete("/conversations/{conv_id}/messages")
async def clear_conversation_history(
    conv_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    membership_stmt = select(ConversationMember).where(
        and_(ConversationMember.conversation_id == conv_id, ConversationMember.user_id == current_user.id)
    )
    membership = (await db.execute(membership_stmt)).scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this conversation")

    messages_stmt = select(Message).where(
        and_(Message.conversation_id == conv_id, Message.is_deleted.is_(False))
    )
    messages = (await db.execute(messages_stmt)).scalars().all()
    now = datetime.now(timezone.utc)
    for message in messages:
        message.is_deleted = True
        message.deleted_by_id = current_user.id
        message.updated_at = now
    await db.commit()

    member_ids = (await db.execute(
        select(ConversationMember.user_id).where(ConversationMember.conversation_id == conv_id)
    )).scalars().all()
    await manager.broadcast_to_users(
        list(member_ids),
        {"event": "conversation.cleared", "conversation_id": conv_id},
    )
    return {"message": "Conversation history cleared", "cleared_count": len(messages)}

@router.post("/messages/{message_id}/reactions")
async def toggle_reaction(
    message_id: str,
    req: MessageReactionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(MessageReaction).where(
        and_(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == current_user.id,
            MessageReaction.emoji == req.emoji
        )
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        await db.delete(existing)
        action = "removed"
    else:
        new_r = MessageReaction(message_id=message_id, user_id=current_user.id, emoji=req.emoji)
        db.add(new_r)
        action = "added"

    await db.commit()

    # Broadcast reaction change
    msg_stmt = select(Message.conversation_id).where(Message.id == message_id)
    conv_id = (await db.execute(msg_stmt)).scalar_one_or_none()
    if conv_id:
        c_mems = (await db.execute(select(ConversationMember.user_id).where(ConversationMember.conversation_id == conv_id))).scalars().all()
        await manager.broadcast_to_users(
            list(c_mems),
            {
                "event": "message.reaction",
                "conversation_id": conv_id,
                "message_id": message_id,
                "emoji": req.emoji,
                "user_id": current_user.id,
                "action": action,
            }
        )

    return {"message": f"Reaction {action}"}

@router.post("/messages/{message_id}/pin")
async def toggle_pin(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Message).where(Message.id == message_id)
    msg = (await db.execute(stmt)).scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    msg.is_pinned = not msg.is_pinned
    await db.commit()

    c_mems = (await db.execute(select(ConversationMember.user_id).where(ConversationMember.conversation_id == msg.conversation_id))).scalars().all()
    await manager.broadcast_to_users(
        list(c_mems),
        {"event": "message.pinned", "conversation_id": msg.conversation_id, "message_id": msg.id, "is_pinned": msg.is_pinned}
    )

    return {"message": "Message pin toggled", "is_pinned": msg.is_pinned}

@router.post("/conversations/{conv_id}/read")
async def mark_conversation_read(
    conv_id: str,
    message_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    m_stmt = select(ConversationMember).where(
        and_(ConversationMember.conversation_id == conv_id, ConversationMember.user_id == current_user.id)
    )
    membership = (await db.execute(m_stmt)).scalar_one_or_none()
    if membership:
        membership.last_read_message_id = message_id

    # Record read receipt
    receipt_stmt = select(MessageReadReceipt).where(
        and_(MessageReadReceipt.message_id == message_id, MessageReadReceipt.user_id == current_user.id)
    )
    if not (await db.execute(receipt_stmt)).scalar_one_or_none():
        receipt = MessageReadReceipt(message_id=message_id, user_id=current_user.id)
        db.add(receipt)

    await db.commit()

    c_mems = (await db.execute(select(ConversationMember.user_id).where(ConversationMember.conversation_id == conv_id))).scalars().all()
    await manager.broadcast_to_users(
        list(c_mems),
        {
            "event": "message.read",
            "conversation_id": conv_id,
            "message_id": message_id,
            "user_id": current_user.id,
            "username": current_user.username,
        }
    )

    return {"message": "Conversation marked as read"}
