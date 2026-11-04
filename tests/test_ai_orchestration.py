import pytest
import json
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_ai_orchestration_loop(client: AsyncClient):
    # 1. Register test user
    resp = await client.post("/api/v1/auth/register", json={
        "username": "ai_tester",
        "email": "tester@iisertirupati.ac.in",
        "password": "Password123!",
        "full_name": "AI Tester"
    })
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Check Tool Registry
    tools_resp = await client.get("/api/v1/ai/tools", headers=headers)
    assert tools_resp.status_code == 200
    tools = tools_resp.json()
    assert len(tools) >= 10
    tool_names = [t["name"] for t in tools]
    assert "search_academic_repository" in tool_names
    assert "send_external_communication" in tool_names

    # 3. Create AI Conversation
    conv_resp = await client.post("/api/v1/ai/conversations", json={"title": "Physics Notes Help"}, headers=headers)
    assert conv_resp.status_code == 200
    conv_id = conv_resp.json()["id"]

    # 4. Stream chat asking for repository notes (should route to search_academic_repository tool)
    chat_resp = await client.post(
        f"/api/v1/ai/conversations/{conv_id}/chat",
        json={"prompt": "Can you search repository for quantum mechanics lecture notes?"},
        headers=headers
    )
    assert chat_resp.status_code == 200
    events = []
    for line in chat_resp.text.strip().split("\n\n"):
        if line.startswith("data: "):
            events.append(json.loads(line[6:]))

    # Verify orchestration lifecycle stages were triggered
    stages = [e.get("stage") for e in events]
    assert "request_validation" in stages
    assert "conversation_identified" in stages
    assert "context_built" in stages
    assert "determine_required_tools" in stages
    assert "execute_approved_operations" in stages
    assert "stream_response" in stages
    assert "completed" in stages

    # 5. Check persistent messages in DB
    msg_history = await client.get(f"/api/v1/ai/conversations/{conv_id}/messages", headers=headers)
    assert msg_history.status_code == 200
    data = msg_history.json()
    assert len(data["messages"]) == 2  # user prompt + assistant response
    assert data["messages"][0]["role"] == "user"
    assert data["messages"][1]["role"] == "assistant"
    assert len(data["tool_executions"]) == 1
    assert data["tool_executions"][0]["tool_name"] == "search_academic_repository"
    assert data["tool_executions"][0]["status"] == "completed"

    # 6. Test Safety Gate & Confirmation Requirement
    ext_resp = await client.post(
        f"/api/v1/ai/conversations/{conv_id}/chat",
        json={"prompt": "Please send email to the Dean of Academics"},
        headers=headers
    )
    assert ext_resp.status_code == 200
    ext_events = [json.loads(l[6:]) for l in ext_resp.text.strip().split("\n\n") if l.startswith("data: ")]
    ext_stages = [e.get("stage") for e in ext_events]
    assert "permission_check" in ext_stages

    # Find the pending execution id
    perm_event = [e for e in ext_events if e.get("stage") == "permission_check"][0]
    assert perm_event["requires_confirmation"] is True
    exec_id = perm_event["execution_id"]

    # Confirm execution
    confirm_resp = await client.post(
        f"/api/v1/ai/conversations/{conv_id}/confirm",
        json={"execution_id": exec_id, "approved": True},
        headers=headers
    )
    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["status"] == "executed"
