import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_auth_workflow(client: AsyncClient):
    # 1. Register new student
    register_payload = {
        "username": "varun_phy",
        "email": "varun@iisertirupati.ac.in",
        "password": "SecurePassword123!",
        "full_name": "Varun Tej",
        "program": "BS-MS",
        "academic_year": "2nd Year",
        "department": "Physics"
    }
    resp = await client.post("/api/v1/auth/register", json=register_payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert "access_token" in data
    assert data["username"] == "varun_phy"

    # 2. Duplicate registration should fail
    resp_dup = await client.post("/api/v1/auth/register", json=register_payload)
    assert resp_dup.status_code == 400

    # 3. Login with valid credentials
    login_resp = await client.post("/api/v1/auth/login", json={
        "username_or_email": "varun_phy",
        "password": "SecurePassword123!"
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]

    # 4. Access protected endpoint /me
    me_resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["username"] == "varun_phy"
    assert me_data["department"] == "Physics"

    # 5. Invalid password login should fail
    bad_login = await client.post("/api/v1/auth/login", json={
        "username_or_email": "varun_phy",
        "password": "WrongPassword!"
    })
    assert bad_login.status_code == 401
