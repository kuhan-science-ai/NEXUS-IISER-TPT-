from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import or_, and_, desc

from backend.app.db.session import get_db
from backend.app.models.user import User, UserRole
from backend.app.models.forum import ForumPost, ForumComment, ForumVote
from backend.app.models.notification import Notification, NotificationType
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/forums", tags=["Forums & Discussions"])

class PostCreateRequest(BaseModel):
    title: str = Field(..., min_length=5, max_length=255)
    content_latex: str = Field(..., min_length=10)
    category: str = Field(..., max_length=100)

class CommentCreateRequest(BaseModel):
    content_latex: str = Field(..., min_length=1)
    parent_comment_id: Optional[str] = None

class VoteRequest(BaseModel):
    vote_type: int = Field(..., ge=-1, le=1)  # 1 or -1

@router.get("/posts")
async def list_posts(
    category: Optional[str] = None,
    query: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(ForumPost)
        .options(selectinload(ForumPost.author).selectinload(User.profile), selectinload(ForumPost.comments))
    )
    if category and category != "All":
        stmt = stmt.where(ForumPost.category == category)
    if query:
        stmt = stmt.where(
            or_(ForumPost.title.ilike(f"%{query}%"), ForumPost.content_latex.ilike(f"%{query}%"))
        )

    stmt = stmt.order_by(desc(ForumPost.is_pinned), desc(ForumPost.created_at)).limit(limit)
    res = await db.execute(stmt)
    posts = res.scalars().all()

    items = []
    for p in posts:
        author_name = p.author.profile.full_name if (p.author and p.author.profile) else (p.author.username if p.author else "Anonymous")
        items.append({
            "id": p.id,
            "title": p.title,
            "content_latex": p.content_latex,
            "category": p.category,
            "author_id": p.author_id,
            "author_name": author_name,
            "upvotes": p.upvotes,
            "downvotes": p.downvotes,
            "is_pinned": p.is_pinned,
            "is_solved": p.is_solved,
            "comments_count": len(p.comments) if p.comments else 0,
            "created_at": p.created_at,
        })
    return items

@router.post("/posts", status_code=status.HTTP_201_CREATED)
async def create_post(
    req: PostCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    post = ForumPost(
        title=req.title,
        content_latex=req.content_latex,
        category=req.category,
        author_id=current_user.id,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return {"message": "Post created successfully", "post_id": post.id}

@router.get("/posts/{post_id}")
async def get_post_details(
    post_id: str,
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(ForumPost)
        .options(
            selectinload(ForumPost.author).selectinload(User.profile),
            selectinload(ForumPost.comments).selectinload(ForumComment.author).selectinload(User.profile)
        )
        .where(ForumPost.id == post_id)
    )
    post = (await db.execute(stmt)).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    author_name = post.author.profile.full_name if (post.author and post.author.profile) else (post.author.username if post.author else "Anonymous")
    
    comments = []
    for c in post.comments:
        c_author_name = c.author.profile.full_name if (c.author and c.author.profile) else (c.author.username if c.author else "Anonymous")
        comments.append({
            "id": c.id,
            "post_id": c.post_id,
            "parent_comment_id": c.parent_comment_id,
            "author_id": c.author_id,
            "author_name": c_author_name,
            "content_latex": c.content_latex,
            "upvotes": c.upvotes,
            "downvotes": c.downvotes,
            "is_accepted": c.is_accepted,
            "created_at": c.created_at,
        })

    return {
        "id": post.id,
        "title": post.title,
        "content_latex": post.content_latex,
        "category": post.category,
        "author_id": post.author_id,
        "author_name": author_name,
        "upvotes": post.upvotes,
        "downvotes": post.downvotes,
        "is_pinned": post.is_pinned,
        "is_solved": post.is_solved,
        "created_at": post.created_at,
        "comments": comments,
    }

@router.post("/posts/{post_id}/comments")
async def add_comment(
    post_id: str,
    req: CommentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    post = (await db.execute(select(ForumPost).where(ForumPost.id == post_id))).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comment = ForumComment(
        post_id=post_id,
        parent_comment_id=req.parent_comment_id,
        author_id=current_user.id,
        content_latex=req.content_latex,
    )
    db.add(comment)

    # Notify post author if not the commenter
    if post.author_id and post.author_id != current_user.id:
        notif = Notification(
            recipient_id=post.author_id,
            actor_id=current_user.id,
            notification_type=NotificationType.FORUM_REPLY,
            title="New Reply on your Post",
            content=f"{current_user.username} replied to your post '{post.title[:30]}...'",
            link=f"/forum/{post.id}",
        )
        db.add(notif)

    await db.commit()
    return {"message": "Comment added successfully"}

@router.post("/posts/{post_id}/vote")
async def vote_post(
    post_id: str,
    req: VoteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    post = (await db.execute(select(ForumPost).where(ForumPost.id == post_id))).scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    v_stmt = select(ForumVote).where(ForumVote.post_id == post_id, ForumVote.user_id == current_user.id)
    vote = (await db.execute(v_stmt)).scalar_one_or_none()

    if vote:
        if vote.vote_type == req.vote_type:
            # Cancel vote
            if req.vote_type == 1:
                post.upvotes = max(0, post.upvotes - 1)
            else:
                post.downvotes = max(0, post.downvotes - 1)
            await db.delete(vote)
        else:
            # Flip vote
            if req.vote_type == 1:
                post.upvotes += 1
                post.downvotes = max(0, post.downvotes - 1)
            else:
                post.downvotes += 1
                post.upvotes = max(0, post.upvotes - 1)
            vote.vote_type = req.vote_type
    else:
        new_vote = ForumVote(user_id=current_user.id, post_id=post_id, vote_type=req.vote_type)
        db.add(new_vote)
        if req.vote_type == 1:
            post.upvotes += 1
        else:
            post.downvotes += 1

    await db.commit()
    return {"message": "Vote recorded", "upvotes": post.upvotes, "downvotes": post.downvotes}

@router.post("/comments/{comment_id}/accept")
async def accept_answer(
    comment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(ForumComment)
        .options(selectinload(ForumComment.post))
        .where(ForumComment.id == comment_id)
    )
    comment = (await db.execute(stmt)).scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.post.author_id != current_user.id and current_user.role != UserRole.ADMINISTRATOR:
        raise HTTPException(status_code=403, detail="Only the post author or an admin can mark an accepted answer")

    comment.is_accepted = True
    comment.post.is_solved = True
    await db.commit()
    return {"message": "Comment marked as accepted answer"}
