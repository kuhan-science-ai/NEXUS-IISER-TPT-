import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_academics_and_forums(client: AsyncClient):
    # 1. Register test user
    resp = await client.post("/api/v1/auth/register", json={
        "username": "scholar1",
        "email": "scholar@iisertirupati.ac.in",
        "password": "Password123!",
        "full_name": "Scholar One"
    })
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Forum Post with LaTeX Math
    post_payload = {
        "title": "Question on Cauchy-Schwarz inequality in Hilbert Space",
        "content_latex": "For vectors $u, v \\in \\mathcal{H}$, the Cauchy-Schwarz inequality states:\n$$|\\langle u, v \\rangle|^2 \\leq \\langle u, u \\rangle \\langle v, v \\rangle$$\nHow does this generalize to continuous function spaces $L^2[a, b]$?",
        "category": "Mathematics"
    }
    p_resp = await client.post("/api/v1/forums/posts", json=post_payload, headers=headers)
    assert p_resp.status_code == 201
    post_id = p_resp.json()["post_id"]

    # 3. Add comment to post with LaTeX solution
    c_resp = await client.post(
        f"/api/v1/forums/posts/{post_id}/comments",
        json={
            "content_latex": "In $L^2[a, b]$, the inner product is $\\langle f, g \\rangle = \\int_a^b f(x)\\overline{g(x)}dx$. Thus:\n$$\\left|\\int_a^b f(x)g(x)dx\\right|^2 \\le \\left(\\int_a^b |f(x)|^2 dx\\right)\\left(\\int_a^b |g(x)|^2 dx\\right)$$"
        },
        headers=headers
    )
    assert c_resp.status_code == 200

    # 4. Vote on post
    v_resp = await client.post(f"/api/v1/forums/posts/{post_id}/vote", json={"vote_type": 1}, headers=headers)
    assert v_resp.status_code == 200
    assert v_resp.json()["upvotes"] == 1

    # 5. Fetch post details and verify comments & LaTeX content
    detail_resp = await client.get(f"/api/v1/forums/posts/{post_id}")
    assert detail_resp.status_code == 200
    d_data = detail_resp.json()
    assert d_data["title"] == post_payload["title"]
    assert len(d_data["comments"]) == 1
    assert "Cauchy-Schwarz" in d_data["content_latex"]
    assert "L^2[a, b]" in d_data["comments"][0]["content_latex"]
