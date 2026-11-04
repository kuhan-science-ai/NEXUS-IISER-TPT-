from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_, and_

from backend.app.db.session import get_db
from backend.app.models.user import User, UserProfile
from backend.app.models.social import Friendship, FriendRequest, FriendRequestStatus, BlockedUser
from backend.app.models.notification import Notification, NotificationType
from backend.app.schemas.user import FriendRequestResponse, FriendItem
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/friends", tags=["Friends & Social"])

@router.get("", response_model=list[FriendItem])
async def list_friends(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Friendship).where(
        or_(Friendship.user_id_1 == current_user.id, Friendship.user_id_2 == current_user.id)
    )
    res = await db.execute(stmt)
    friendships = res.scalars().all()

    friend_ids = []
    for f in friendships:
        friend_ids.append(f.user_id_2 if f.user_id_1 == current_user.id else f.user_id_1)

    if not friend_ids:
        return []

    u_stmt = select(User).options(selectinload(User.profile)).where(User.id.in_(friend_ids))
    u_res = await db.execute(u_stmt)
    users = u_res.scalars().all()

    items = []
    for u in users:
        p = u.profile
        avatar_url = f"/api/v1/files/{p.avatar_file_id}/download" if p and p.avatar_file_id else None
        items.append(FriendItem(
            id=u.id,
            username=u.username,
            full_name=p.full_name if p else u.username,
            avatar_url=avatar_url,
            department=p.department if p else None,
            status_text=p.status_text if p else None,
        ))
    return items

@router.get("/requests", response_model=list[FriendRequestResponse])
async def list_friend_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(FriendRequest).where(
        and_(FriendRequest.receiver_id == current_user.id, FriendRequest.status == FriendRequestStatus.PENDING)
    )
    res = await db.execute(stmt)
    requests = res.scalars().all()

    items = []
    for r in requests:
        s_stmt = select(User).options(selectinload(User.profile)).where(User.id == r.sender_id)
        s_res = await db.execute(s_stmt)
        sender = s_res.scalar_one_or_none()
        sender_name = sender.profile.full_name if sender and sender.profile else (sender.username if sender else "Unknown")
        items.append(FriendRequestResponse(
            id=r.id,
            sender_id=r.sender_id,
            sender_username=sender.username if sender else "unknown",
            sender_name=sender_name,
            receiver_id=current_user.id,
            receiver_username=current_user.username,
            status=r.status.value,
            created_at=r.created_at.isoformat(),
        ))
    return items

@router.post("/request/{target_user_id}")
async def send_friend_request(
    target_user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot send friend request to yourself")

    # Check blocked
    b_stmt = select(BlockedUser).where(
        or_(
            and_(BlockedUser.blocker_id == current_user.id, BlockedUser.blocked_id == target_user_id),
            and_(BlockedUser.blocker_id == target_user_id, BlockedUser.blocked_id == current_user.id)
        )
    )
    if (await db.execute(b_stmt)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Cannot interact with blocked user")

    # Check already friends
    f_stmt = select(Friendship).where(
        or_(
            and_(Friendship.user_id_1 == current_user.id, Friendship.user_id_2 == target_user_id),
            and_(Friendship.user_id_1 == target_user_id, Friendship.user_id_2 == current_user.id)
        )
    )
    if (await db.execute(f_stmt)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already friends")

    # Check existing request
    r_stmt = select(FriendRequest).where(
        or_(
            and_(FriendRequest.sender_id == current_user.id, FriendRequest.receiver_id == target_user_id),
            and_(FriendRequest.sender_id == target_user_id, FriendRequest.receiver_id == current_user.id)
        )
    )
    existing_req = (await db.execute(r_stmt)).scalar_one_or_none()
    if existing_req:
        if existing_req.status == FriendRequestStatus.PENDING:
            raise HTTPException(status_code=400, detail="Friend request already pending")
        existing_req.status = FriendRequestStatus.PENDING
        existing_req.sender_id = current_user.id
        existing_req.receiver_id = target_user_id
    else:
        new_req = FriendRequest(sender_id=current_user.id, receiver_id=target_user_id, status=FriendRequestStatus.PENDING)
        db.add(new_req)

    # Add notification
    notif = Notification(
        recipient_id=target_user_id,
        actor_id=current_user.id,
        notification_type=NotificationType.FRIEND_REQUEST,
        title="New Friend Request",
        content=f"{current_user.username} sent you a friend request",
        link=f"/profile/{current_user.username}",
    )
    db.add(notif)
    await db.commit()
    return {"message": "Friend request sent"}

@router.post("/accept/{request_id}")
async def accept_friend_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(FriendRequest).where(
        and_(FriendRequest.id == request_id, FriendRequest.receiver_id == current_user.id)
    )
    req = (await db.execute(stmt)).scalar_one_or_none()
    if not req or req.status != FriendRequestStatus.PENDING:
        raise HTTPException(status_code=404, detail="Pending request not found")

    req.status = FriendRequestStatus.ACCEPTED
    friendship = Friendship(user_id_1=req.sender_id, user_id_2=req.receiver_id)
    db.add(friendship)

    notif = Notification(
        recipient_id=req.sender_id,
        actor_id=current_user.id,
        notification_type=NotificationType.FRIEND_ACCEPT,
        title="Friend Request Accepted",
        content=f"{current_user.username} accepted your friend request",
        link=f"/profile/{current_user.username}",
    )
    db.add(notif)
    await db.commit()
    return {"message": "Friend request accepted"}

@router.post("/reject/{request_id}")
async def reject_friend_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(FriendRequest).where(
        and_(FriendRequest.id == request_id, FriendRequest.receiver_id == current_user.id)
    )
    req = (await db.execute(stmt)).scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Friend request not found")

    req.status = FriendRequestStatus.REJECTED
    await db.commit()
    return {"message": "Friend request rejected"}

@router.delete("/{target_user_id}")
async def remove_friend(
    target_user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Friendship).where(
        or_(
            and_(Friendship.user_id_1 == current_user.id, Friendship.user_id_2 == target_user_id),
            and_(Friendship.user_id_1 == target_user_id, Friendship.user_id_2 == current_user.id)
        )
    )
    friendship = (await db.execute(stmt)).scalar_one_or_none()
    if not friendship:
        raise HTTPException(status_code=404, detail="Friendship not found")

    await db.delete(friendship)
    await db.commit()
    return {"message": "Friend removed"}

@router.post("/block/{target_user_id}")
async def block_user(
    target_user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")

    # Remove any friendship
    f_stmt = select(Friendship).where(
        or_(
            and_(Friendship.user_id_1 == current_user.id, Friendship.user_id_2 == target_user_id),
            and_(Friendship.user_id_1 == target_user_id, Friendship.user_id_2 == current_user.id)
        )
    )
    friendship = (await db.execute(f_stmt)).scalar_one_or_none()
    if friendship:
        await db.delete(friendship)

    b_stmt = select(BlockedUser).where(
        and_(BlockedUser.blocker_id == current_user.id, BlockedUser.blocked_id == target_user_id)
    )
    if not (await db.execute(b_stmt)).scalar_one_or_none():
        block_entry = BlockedUser(blocker_id=current_user.id, blocked_id=target_user_id)
        db.add(block_entry)

    await db.commit()
    return {"message": "User blocked"}

@router.delete("/block/{target_user_id}")
async def unblock_user(
    target_user_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(BlockedUser).where(
        and_(BlockedUser.blocker_id == current_user.id, BlockedUser.blocked_id == target_user_id)
    )
    entry = (await db.execute(stmt)).scalar_one_or_none()
    if entry:
        await db.delete(entry)
        await db.commit()
    return {"message": "User unblocked"}

@router.get("/search", response_model=list[FriendItem])
async def search_users(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query_str = f"%{q.lower()}%"
    stmt = select(User).options(selectinload(User.profile)).where(
        and_(
            User.id != current_user.id,
            User.is_active == True,
            or_(
                User.username.ilike(query_str),
                User.email.ilike(query_str),
            )
        )
    ).limit(20)
    res = await db.execute(stmt)
    users = res.scalars().all()

    items = []
    for u in users:
        p = u.profile
        avatar_url = f"/api/v1/files/{p.avatar_file_id}/download" if p and p.avatar_file_id else None
        items.append(FriendItem(
            id=u.id,
            username=u.username,
            full_name=p.full_name if p else u.username,
            avatar_url=avatar_url,
            department=p.department if p else None,
            status_text=p.status_text if p else None,
        ))
    return items
