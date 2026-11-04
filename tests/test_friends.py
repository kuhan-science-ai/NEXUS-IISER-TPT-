import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_friends_and_blocking(client: AsyncClient):
    # Register 2 users
    res_a = await client.post("/api/v1/auth/register", json={
        "username": "alice",
        "email": "alice@iisertirupati.ac.in",
        "password": "Password123!",
        "full_name": "Alice Green"
    })
    token_a = res_a.json()["access_token"]
    id_a = res_a.json()["user_id"]
    h_a = {"Authorization": f"Bearer {token_a}"}

    res_b = await client.post("/api/v1/auth/register", json={
        "username": "bob",
        "email": "bob@iisertirupati.ac.in",
        "password": "Password123!",
        "full_name": "Bob Blue"
    })
    token_b = res_b.json()["access_token"]
    id_b = res_b.json()["user_id"]
    h_b = {"Authorization": f"Bearer {token_b}"}

    # 1. Alice sends friend request to Bob
    req_res = await client.post(f"/api/v1/friends/request/{id_b}", headers=h_a)
    assert req_res.status_code == 200

    # 2. Bob views incoming requests
    inbox_res = await client.get("/api/v1/friends/requests", headers=h_b)
    assert inbox_res.status_code == 200
    requests = inbox_res.json()
    assert len(requests) == 1
    req_id = requests[0]["id"]
    assert requests[0]["sender_username"] == "alice"

    # 3. Bob accepts friend request
    acc_res = await client.post(f"/api/v1/friends/accept/{req_id}", headers=h_b)
    assert acc_res.status_code == 200

    # 4. Both verify friend in list
    f_list_a = await client.get("/api/v1/friends", headers=h_a)
    assert f_list_a.status_code == 200
    assert any(f["username"] == "bob" for f in f_list_a.json())

    f_list_b = await client.get("/api/v1/friends", headers=h_b)
    assert f_list_b.status_code == 200
    assert any(f["username"] == "alice" for f in f_list_b.json())

    # 5. Alice blocks Bob
    block_res = await client.post(f"/api/v1/friends/block/{id_b}", headers=h_a)
    assert block_res.status_code == 200

    # 6. Verify Bob is no longer in friend list
    f_after_block = await client.get("/api/v1/friends", headers=h_a)
    assert not any(f["username"] == "bob" for f in f_after_block.json())

    # 7. Bob attempts to message Alice -> should fail because blocked
    conv_resp = await client.post(
        "/api/v1/messages/conversations",
        json={"type": "direct", "participant_user_ids": [id_a]},
        headers=h_b
    )
    assert conv_resp.status_code == 400
