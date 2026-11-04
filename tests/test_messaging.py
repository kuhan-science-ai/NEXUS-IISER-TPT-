import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_messaging_system(client: AsyncClient):
    # 1. Register User A and User B
    resp_a = await client.post("/api/v1/auth/register", json={
        "username": "student_a",
        "email": "student_a@iisertirupati.ac.in",
        "password": "Password123!",
        "full_name": "Student A"
    })
    token_a = resp_a.json()["access_token"]
    user_a_id = resp_a.json()["user_id"]

    resp_b = await client.post("/api/v1/auth/register", json={
        "username": "student_b",
        "email": "student_b@iisertirupati.ac.in",
        "password": "Password123!",
        "full_name": "Student B"
    })
    token_b = resp_b.json()["access_token"]
    user_b_id = resp_b.json()["user_id"]

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 2. User A creates conversation with User B
    conv_resp = await client.post(
        "/api/v1/messages/conversations",
        json={"type": "direct", "participant_user_ids": [user_b_id]},
        headers=headers_a
    )
    assert conv_resp.status_code == 200, conv_resp.text
    conv_id = conv_resp.json()["id"]

    # 3. User A sends message
    msg_resp = await client.post(
        f"/api/v1/messages/conversations/{conv_id}/messages",
        json={"content": "Hey Student B, are you preparing for PHY201 exam?"},
        headers=headers_a
    )
    assert msg_resp.status_code == 200
    msg_id = msg_resp.json()["id"]
    assert msg_resp.json()["content"] == "Hey Student B, are you preparing for PHY201 exam?"

    # 4. User B replies to message
    reply_resp = await client.post(
        f"/api/v1/messages/conversations/{conv_id}/messages",
        json={"content": "Yes, solving problem set 4!", "reply_to_id": msg_id},
        headers=headers_b
    )
    assert reply_resp.status_code == 200
    assert reply_resp.json()["reply_to_id"] == msg_id

    # 5. User A edits their message
    edit_resp = await client.put(
        f"/api/v1/messages/messages/{msg_id}",
        json={"content": "Hey Student B, are you ready for PHY201 midterm?"},
        headers=headers_a
    )
    assert edit_resp.status_code == 200
    assert edit_resp.json()["is_edited"] is True
    assert "midterm" in edit_resp.json()["content"]

    # 6. User B reacts with emoji
    react_resp = await client.post(
        f"/api/v1/messages/messages/{msg_id}/reactions",
        json={"emoji": "👍"},
        headers=headers_b
    )
    assert react_resp.status_code == 200

    # 7. Check message history persistence
    hist_resp = await client.get(
        f"/api/v1/messages/conversations/{conv_id}/messages",
        headers=headers_b
    )
    assert hist_resp.status_code == 200
    messages = hist_resp.json()
    assert len(messages) == 2
    assert messages[0]["reactions"][0]["emoji"] == "👍"

    # 8. User A deletes their message
    del_resp = await client.delete(f"/api/v1/messages/messages/{msg_id}", headers=headers_a)
    assert del_resp.status_code == 200

    # 9. Verify persistent soft-deletion
    hist_after_del = await client.get(
        f"/api/v1/messages/conversations/{conv_id}/messages",
        headers=headers_a
    )
    del_msg = [m for m in hist_after_del.json() if m["id"] == msg_id][0]
    assert del_msg["is_deleted"] is True
    assert del_msg["content"] == "This message was deleted."
