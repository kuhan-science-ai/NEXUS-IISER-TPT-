import pytest
import io
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_file_storage_and_profiles(client: AsyncClient):
    # Register user
    res = await client.post("/api/v1/auth/register", json={
        "username": "photographer",
        "email": "photo@iisertirupati.ac.in",
        "password": "Password123!",
        "full_name": "Photo User"
    })
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Upload valid avatar image
    avatar_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    avatar_upload = await client.post(
        "/api/v1/users/profile/avatar",
        files={"file": ("avatar.png", io.BytesIO(avatar_bytes), "image/png")},
        headers=headers
    )
    assert avatar_upload.status_code == 200, avatar_upload.text
    avatar_data = avatar_upload.json()
    assert "avatar_file_id" in avatar_data
    file_id = avatar_data["avatar_file_id"]

    # 2. Download uploaded avatar
    down_res = await client.get(f"/api/v1/files/{file_id}/download")
    assert down_res.status_code == 200
    assert down_res.content == avatar_bytes

    # 3. Check public profile includes avatar
    prof_res = await client.get("/api/v1/users/profile/photographer", headers=headers)
    assert prof_res.status_code == 200
    assert prof_res.json()["avatar_url"] == f"/api/v1/files/{file_id}/download"

    # 4. Upload invalid MIME type to avatar endpoint (e.g. text/html)
    bad_upload = await client.post(
        "/api/v1/users/profile/avatar",
        files={"file": ("script.html", io.BytesIO(b"<script>alert(1)</script>"), "text/html")},
        headers=headers
    )
    assert bad_upload.status_code == 400
