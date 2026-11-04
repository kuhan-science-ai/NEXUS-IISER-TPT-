import json
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import desc

from backend.app.db.session import get_db, AsyncSessionLocal
from backend.app.models.user import User
from backend.app.models.ai import AIConversation, AIMessage, AIMessageRole, AIToolExecution, ToolExecutionStatus
from backend.app.services.ai.tools import tool_registry
from backend.app.services.ai.orchestrator import ai_orchestrator
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/ai", tags=["AI Orchestration"])

class AIConversationCreateRequest(BaseModel):
    title: Optional[str] = "New AI Conversation"

class AIChatRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=12000)
    page_context: Optional[dict] = None


def _bounded_page_context(raw_context: Optional[dict]) -> dict:
    if not isinstance(raw_context, dict):
        return {}
    limits = {
        "path": 300,
        "title": 200,
        "selected_text": 1200,
        "pointed_element": 1200,
        "annotated_region": 1800,
        "visible_page_text": 4000,
    }
    bounded = {}
    total = 0
    for key, limit in limits.items():
        value = raw_context.get(key)
        if not isinstance(value, str) or not value:
            continue
        remaining = 8000 - total
        if remaining <= 0:
            break
        bounded[key] = value[:min(limit, remaining)]
        total += len(bounded[key])
    return bounded

class AIConfirmToolRequest(BaseModel):
    execution_id: str
    approved: bool

@router.get("/tools")
async def list_available_tools():
    """Returns the tool registry catalog with schemas and safety tiers."""
    tools = tool_registry.list_tools()
    return [t.model_dump() for t in tools]

@router.get("/conversations")
async def list_ai_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(AIConversation)
        .where(AIConversation.user_id == current_user.id)
        .order_by(desc(AIConversation.updated_at))
    )
    res = await db.execute(stmt)
    convs = res.scalars().all()
    return [
        {"id": c.id, "title": c.title, "parent_id": c.parent_id, "created_at": c.created_at, "updated_at": c.updated_at}
        for c in convs
    ]

@router.post("/conversations")
async def create_ai_conversation(
    req: AIConversationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    conv = AIConversation(user_id=current_user.id, title=req.title or "New AI Conversation")
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return {"id": conv.id, "title": conv.title, "parent_id": conv.parent_id, "created_at": conv.created_at}

@router.post("/conversations/{conv_id}/threads")
async def create_ai_thread(
    conv_id: str,
    req: AIConversationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    parent = (await db.execute(select(AIConversation).where(
        AIConversation.id == conv_id, AIConversation.user_id == current_user.id
    ))).scalar_one_or_none()
    if not parent:
        raise HTTPException(status_code=404, detail="Conversation not found")
    thread = AIConversation(
        user_id=current_user.id,
        parent_id=parent.id,
        title=req.title or "New thread",
    )
    db.add(thread)
    await db.commit()
    await db.refresh(thread)
    return {"id": thread.id, "title": thread.title, "parent_id": thread.parent_id, "created_at": thread.created_at}

@router.delete("/conversations/{conv_id}")
async def delete_ai_conversation(
    conv_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    root = (await db.execute(select(AIConversation).where(
        AIConversation.id == conv_id, AIConversation.user_id == current_user.id
    ))).scalar_one_or_none()
    if not root:
        raise HTTPException(status_code=404, detail="Conversation not found")

    deleted_ids = [root.id]
    frontier = [root.id]
    while frontier:
        children = (await db.execute(select(AIConversation.id).where(
            AIConversation.parent_id.in_(frontier), AIConversation.user_id == current_user.id
        ))).scalars().all()
        frontier = [child_id for child_id in children if child_id not in deleted_ids]
        deleted_ids.extend(frontier)

    for item_id in reversed(deleted_ids):
        item = (await db.execute(select(AIConversation).where(
            AIConversation.id == item_id, AIConversation.user_id == current_user.id
        ))).scalar_one_or_none()
        if item:
            await db.delete(item)
    await db.commit()
    return {"status": "deleted", "deleted_ids": deleted_ids}

@router.get("/conversations/{conv_id}/messages")
async def get_ai_messages(
    conv_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(AIConversation).where(
        AIConversation.id == conv_id, AIConversation.user_id == current_user.id
    )
    conv = (await db.execute(stmt)).scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    m_stmt = (
        select(AIMessage)
        .where(AIMessage.conversation_id == conv_id)
        .order_by(desc(AIMessage.created_at))
        .offset(offset)
        .limit(limit + 1)
    )
    res = await db.execute(m_stmt)
    recent_messages = res.scalars().all()
    has_more = len(recent_messages) > limit
    messages = list(reversed(recent_messages[:limit]))

    # Also load tool executions
    t_stmt = select(AIToolExecution).where(AIToolExecution.conversation_id == conv_id).order_by(desc(AIToolExecution.created_at)).limit(limit)
    t_res = await db.execute(t_stmt)
    tools = list(reversed(t_res.scalars().all()))

    return {
        "has_more": has_more,
        "next_offset": offset + len(messages),
        "messages": [
            {"id": m.id, "role": m.role.value, "content": m.content, "created_at": m.created_at}
            for m in messages
        ],
        "tool_executions": [
            {
                "id": t.id,
                "tool_name": t.tool_name,
                "args": json.loads(t.tool_args_json) if t.tool_args_json else {},
                "result": json.loads(t.tool_result_json) if t.tool_result_json else None,
                "status": t.status.value,
                "safety_tier": t.safety_tier,
                "created_at": t.created_at,
            }
            for t in tools
        ]
    }

@router.post("/conversations/{conv_id}/chat")
async def stream_ai_chat(
    conv_id: str,
    req: AIChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Executes the 14-stage AI orchestration lifecycle and streams events as Server-Sent Events (SSE).
    """
    if not req.prompt.strip():
        raise HTTPException(status_code=422, detail="Prompt cannot be empty.")
    owned_conversation = await db.execute(select(AIConversation.id).where(
        AIConversation.id == conv_id, AIConversation.user_id == current_user.id
    ))
    if not owned_conversation.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Conversation not found.")
    # Release the short validation transaction before the SSE body can wait in
    # the model queue; otherwise bursts can tie up the database pool while idle.
    await db.commit()

    async def event_generator():
        trace = []
        assistant_message_id = None
        yield f"data: {json.dumps({'stage': 'accepted', 'status': 'sent', 'message': 'Message sent. Preparing your response…'})}\n\n"
        async for step in ai_orchestrator.execute_orchestration_stream(
            conversation_id=conv_id,
            user_input=req.prompt,
            current_user=current_user,
            db=db,
            page_context=_bounded_page_context(req.page_context),
        ):
            # Keep only compact operational metadata in the user's local backend DB.
            trace.append({key: step[key] for key in ("stage", "status", "tool", "requires_confirmation", "tier") if key in step})
            if step.get("stage") == "completed":
                assistant_message_id = step.get("assistant_message_id")
            payload = json.dumps(step)
            yield f"data: {payload}\n\n"
        if trace and assistant_message_id:
            trace_stmt = select(AIMessage).where(AIMessage.id == assistant_message_id)
            trace_message = (await db.execute(trace_stmt)).scalar_one_or_none()
            if trace_message:
                trace_message.tool_calls_json = json.dumps({"execution_trace": trace})
                await db.commit()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@router.post("/conversations/{conv_id}/confirm")
async def confirm_tool_execution(
    conv_id: str,
    req: AIConfirmToolRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    owned_conversation = await db.execute(select(AIConversation.id).where(
        AIConversation.id == conv_id, AIConversation.user_id == current_user.id
    ))
    if not owned_conversation.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Conversation not found")
    stmt = select(AIToolExecution).where(AIToolExecution.id == req.execution_id, AIToolExecution.conversation_id == conv_id)
    exec_record = (await db.execute(stmt)).scalar_one_or_none()
    if not exec_record:
        raise HTTPException(status_code=404, detail="Tool execution record not found")

    if exec_record.status != ToolExecutionStatus.PENDING_CONFIRMATION:
        raise HTTPException(status_code=400, detail="Tool is not pending confirmation")

    if req.approved:
        exec_record.status = ToolExecutionStatus.APPROVED
        args = json.loads(exec_record.tool_args_json)
        result = await tool_registry.execute_tool(exec_record.tool_name, args, {"user_id": current_user.id, "db": db})
        exec_record.tool_result_json = json.dumps(result)
        exec_record.status = ToolExecutionStatus.COMPLETED
        db.add(AIMessage(conversation_id=conv_id, role=AIMessageRole.ASSISTANT, content=(
            f"Change result for {exec_record.tool_name}: {json.dumps(result, ensure_ascii=False)}"
        )))
        await db.commit()
        return {"status": "executed", "tool_result": result}
    else:
        exec_record.status = ToolExecutionStatus.REJECTED
        db.add(AIMessage(conversation_id=conv_id, role=AIMessageRole.ASSISTANT, content=f"I cancelled the requested {exec_record.tool_name} change."))
        await db.commit()
        return {"status": "rejected", "message": "Operation rejected by user"}

@router.post("/conversations/{conv_id}/cancel")
async def cancel_ai_request(
    conv_id: str,
    current_user: User = Depends(get_current_user)
):
    cancelled = ai_orchestrator.cancel_request(conv_id)
    return {"cancelled": cancelled}
