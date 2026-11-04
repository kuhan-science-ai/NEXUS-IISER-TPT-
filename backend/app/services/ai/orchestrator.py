import json
import logging
import asyncio
import re
from contextlib import asynccontextmanager
from typing import AsyncGenerator, AsyncIterator, Dict, Any, Optional, Set
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.app.models.ai import (
    AIConversation,
    AIMessage,
    AIToolExecution,
    AIMessageRole,
    ToolExecutionStatus,
)
from backend.app.models.user import User
from backend.app.services.ai.tools import tool_registry, SafetyTier
from backend.app.services.ai.provider import mock_ai_provider, ollama_ai_provider, BaseAIProvider, StreamChunk
from backend.app.core.config import settings

logger = logging.getLogger("nexus.ai_orchestrator")


class AIServiceBusy(Exception):
    """Raised when the bounded model queue is full or a queued request expires."""

class AIOrchestrator:
    """
    Modular AI Orchestration Service for NEXUS.
    Implements the 14-stage request-processing sequence before real LLM integration.
    """
    def __init__(self, provider: Optional[BaseAIProvider] = None):
        self.provider = provider or (ollama_ai_provider if settings.AI_PROVIDER.lower() == "ollama" else mock_ai_provider)
        self._model_slots = asyncio.Semaphore(max(1, settings.AI_MAX_CONCURRENT_REQUESTS))
        self._queue_lock = asyncio.Lock()
        self._queued_requests = 0
        self._max_queued_requests = max(0, settings.AI_MAX_QUEUED_REQUESTS)
        # Active in-flight cancellations: conversation_id -> active request events.
        self._cancellations: Dict[str, Set[asyncio.Event]] = {}

    @asynccontextmanager
    async def _request_slot(self) -> AsyncIterator[int]:
        queue_position = 0
        acquired = False
        async with self._queue_lock:
            if self._model_slots.locked():
                if self._queued_requests >= self._max_queued_requests:
                    raise AIServiceBusy("The AI is handling many requests right now. Please try again shortly.")
                self._queued_requests += 1
                queue_position = self._queued_requests
            else:
                # Semaphore.acquire completes without yielding while a slot is free,
                # so reserve it before another request can pass the queue check.
                acquired = await self._model_slots.acquire()

        if not acquired:
            try:
                await asyncio.wait_for(self._model_slots.acquire(), timeout=max(1, settings.AI_QUEUE_TIMEOUT_SECONDS))
                acquired = True
            except asyncio.TimeoutError as exc:
                raise AIServiceBusy("Your request waited too long for the AI model. Please try again.") from exc
            finally:
                async with self._queue_lock:
                    self._queued_requests = max(0, self._queued_requests - 1)

        try:
            yield queue_position
        finally:
            if acquired:
                self._model_slots.release()

    async def execute_orchestration_stream(
        self,
        conversation_id: str,
        user_input: str,
        current_user: User,
        db: AsyncSession,
        page_context: Optional[Dict[str, Any]] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        if not user_input or not user_input.strip():
            yield {"stage": "error", "message": "User input cannot be empty."}
            return
        try:
            async with self._request_slot():
                async for event in self._execute_orchestration_stream(
                    conversation_id, user_input, current_user, db, page_context
                ):
                    yield event
        except AIServiceBusy as exc:
            yield {"stage": "error", "message": str(exc)}

    def cancel_request(self, conversation_id: str) -> bool:
        events = self._cancellations.get(conversation_id)
        if events:
            for event in events:
                event.set()
            return True
        return False

    async def _execute_orchestration_stream(
        self,
        conversation_id: str,
        user_input: str,
        current_user: User,
        db: AsyncSession,
        page_context: Optional[Dict[str, Any]] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        # --- Stage 1 & 2: User Input & Request Validation ---
        if not user_input or not user_input.strip():
            yield {"stage": "error", "message": "User input cannot be empty."}
            return

        cancel_token = asyncio.Event()
        self._cancellations.setdefault(conversation_id, set()).add(cancel_token)

        try:
            yield {"stage": "request_validation", "status": "validated"}

            # --- Stage 3: Conversation Identification ---
            c_stmt = (
                select(AIConversation)
                .where(AIConversation.id == conversation_id, AIConversation.user_id == current_user.id)
            )
            conv = (await db.execute(c_stmt)).scalar_one_or_none()
            if not conv:
                conv = AIConversation(id=conversation_id, user_id=current_user.id, title=user_input[:40])
                db.add(conv)
                await db.flush()

            yield {"stage": "conversation_identified", "conversation_id": conv.id}

            # --- Stage 4: Load Previous Conversation History ---
            history = []
            ancestor_ids = []
            parent_id = conv.parent_id
            while parent_id and parent_id not in ancestor_ids:
                ancestor_ids.append(parent_id)
                parent = (await db.execute(select(AIConversation).where(
                    AIConversation.id == parent_id, AIConversation.user_id == current_user.id
                ))).scalar_one_or_none()
                parent_id = parent.parent_id if parent else None
            source_ids = [*reversed(ancestor_ids), conv.id]
            m_stmt = (
                select(AIMessage)
                .where(AIMessage.conversation_id.in_(source_ids))
                .order_by(AIMessage.created_at.desc())
                .limit(16)
            )
            m_res = await db.execute(m_stmt)
            history = [
                {"role": message.role.value, "content": message.content[-4000:]}
                for message in reversed(m_res.scalars().all())
            ]
            yield {"stage": "history_loaded", "messages_count": len(history)}

            # --- Stage 5: Build Context ---
            profile = current_user.profile
            context = {
                "user_id": current_user.id,
                "username": current_user.username,
                "role": current_user.role.value,
                "department": profile.department if profile else "General",
                "academic_year": profile.academic_year if profile else "1st Year",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "page_context": page_context or {},
                "db": db,
                "tool_schemas": [self._ollama_tool_schema(t) for t in tool_registry.list_tools()],
                "require_tool_call": self._is_direct_action_request(user_input),
            }
            yield {"stage": "context_built", "status": "ready"}

            # Persist user prompt immediately
            user_msg = AIMessage(
                conversation_id=conv.id,
                role=AIMessageRole.USER,
                content=user_input,
            )
            db.add(user_msg)
            await db.commit()

            # --- Stage 6, 7 & 8: Intent Routing, Tool Determination & Permission Check ---
            yield {"stage": "intent_routing", "status": "analyzing_intent"}

            accumulated_tokens = []
            tool_pending_confirmation = None
            tool_execution_record = None

            # Stream from Mock Provider
            async for chunk in self.provider.generate_response_stream(
                prompt=user_input,
                history=history,
                context=context,
                cancellation_token=cancel_token
            ):
                if cancel_token.is_set():
                    yield {"stage": "cancelled", "message": "Execution cancelled by user."}
                    break

                if chunk.chunk_type == "tool_call" and chunk.tool_call:
                    t_name = chunk.tool_call.tool_name
                    t_args = chunk.tool_call.args
                    t_def = tool_registry.get_tool(t_name)

                    yield {"stage": "determine_required_tools", "tool": t_name, "args": t_args}

                    # Permission & Confirmation Check
                    if t_def and t_def.requires_confirmation:
                        tool_execution_record = AIToolExecution(
                            conversation_id=conv.id,
                            tool_name=t_name,
                            tool_args_json=json.dumps(t_args),
                            safety_tier=t_def.safety_tier.value,
                            status=ToolExecutionStatus.PENDING_CONFIRMATION,
                        )
                        db.add(tool_execution_record)
                        await db.commit()
                        await db.refresh(tool_execution_record)

                        yield {
                            "stage": "permission_check",
                            "requires_confirmation": True,
                            "execution_id": tool_execution_record.id,
                            "tool_name": t_name,
                            "args": t_args,
                            "tier": t_def.safety_tier.value,
                            "message": f"Action '{t_name}' requires confirmation due to safety policy ({t_def.safety_tier.value})."
                        }
                        tool_pending_confirmation = tool_execution_record
                    else:
                        # --- Stage 9 & 10: Execute Approved Operations & Collect Results ---
                        yield {"stage": "execute_approved_operations", "tool": t_name}
                        result = await tool_registry.execute_tool(t_name, t_args, context)

                        exec_rec = AIToolExecution(
                            conversation_id=conv.id,
                            tool_name=t_name,
                            tool_args_json=json.dumps(t_args),
                            tool_result_json=json.dumps(result),
                            safety_tier=t_def.safety_tier.value if t_def else "read_only",
                            status=ToolExecutionStatus.COMPLETED,
                            completed_at=datetime.now(timezone.utc),
                        )
                        db.add(exec_rec)
                        await db.commit()

                        yield {"stage": "collect_results", "tool": t_name, "result": result}
                        context.setdefault("tool_results", []).append({"tool": t_name, "result": result})

                elif chunk.chunk_type == "token":
                    accumulated_tokens.append(chunk.content or "")
                    # --- Stage 11 & 12: Response Processing & Stream Response ---
                    yield {
                        "stage": "stream_response",
                        "token": chunk.content,
                    }

                elif chunk.chunk_type == "error":
                    yield {"stage": "error", "message": chunk.content}
                    break

            # Give the model one follow-up turn so it can explain actual tool results.
            if context.get("tool_results") and not tool_pending_confirmation and not cancel_token.is_set():
                followup_context = {**context, "disable_tools": True}
                async for chunk in self.provider.generate_response_stream(
                    prompt="Explain the tool results to the user clearly and accurately.",
                    history=history + [{"role": "user", "content": user_input}],
                    context=followup_context,
                    cancellation_token=cancel_token,
                ):
                    if chunk.chunk_type == "token":
                        accumulated_tokens.append(chunk.content or "")
                        yield {"stage": "stream_response", "token": chunk.content}
                    elif chunk.chunk_type == "error":
                        yield {"stage": "error", "message": chunk.content}
                        break

            # --- Stage 13 & 14: Save Conversation & Return Final Result ---
            full_response_text = "".join(accumulated_tokens)
            if tool_pending_confirmation and not full_response_text.strip():
                full_response_text = f"I’m ready to perform {tool_pending_confirmation.tool_name}. Please approve or reject the requested change above."
            assistant_msg = AIMessage(
                conversation_id=conv.id,
                role=AIMessageRole.ASSISTANT,
                content=full_response_text,
            )
            db.add(assistant_msg)
            conv.updated_at = datetime.now(timezone.utc)
            await db.commit()

            yield {
                "stage": "completed",
                "conversation_id": conv.id,
                "assistant_message_id": assistant_msg.id,
                "final_response": full_response_text,
                "requires_confirmation": tool_pending_confirmation is not None,
                "pending_execution_id": tool_pending_confirmation.id if tool_pending_confirmation else None
            }

        finally:
            events = self._cancellations.get(conversation_id)
            if events:
                events.discard(cancel_token)
                if not events:
                    self._cancellations.pop(conversation_id, None)

    @staticmethod
    def _ollama_tool_schema(tool):
        type_map = {"string": "string", "integer": "integer", "number": "number", "boolean": "boolean"}
        properties = {p.name: {"type": type_map.get(p.type, "string"), "description": p.description} for p in tool.parameters}
        return {"type": "function", "function": {
            "name": tool.name,
            "description": tool.description,
            "parameters": {"type": "object", "properties": properties, "required": [p.name for p in tool.parameters if p.required]},
        }}

    @staticmethod
    def _is_direct_action_request(user_input: str) -> bool:
        text = user_input.strip().lower()
        if not text or re.match(r"^(how|why|where|when|what|should i|can i|is it possible to|tell me how)\b", text):
            return False
        if any(phrase in text for phrase in ("how do i", "how can i", "how to ", "should i ", "would it be possible", "what happens if")):
            return False
        action = r"\b(change|update|edit|create|add|remove|delete|set|mark|complete|send|post|register|rsvp|cancel|schedule|reschedule|rename)\b"
        return bool(re.search(action, text))

ai_orchestrator = AIOrchestrator()
