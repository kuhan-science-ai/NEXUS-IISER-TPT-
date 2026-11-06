# NEXUS on Cloudflare Workers + D1

This is the Cloudflare deployment for the existing `/api/v1` client contract. It implements account registration/login/profile reads, four beta accounts, user search/friends/requests, globally shared Study Groups, persistent direct/group messaging and typing state, persistent AI session management, and the QOTD/AOTD read, answer, archive, and discussion APIs. Other NEXUS features still use the existing FastAPI app and are not migrated by this Worker.

## Local development

Requirements: Python 3.13, Node.js, and `uv`.

```powershell
uv sync --all-groups
Copy-Item .dev.vars.example .dev.vars
# Replace the placeholder with a private random value before starting.
uv run pywrangler dev
```

The D1 binding uses Wrangler's local database by default. Apply the checked-in migrations locally before testing:

```powershell
npx wrangler d1 migrations apply nexus-database --local
```

Build the frontend before launching the Worker so Wrangler can serve `../frontend/dist`:

```powershell
cd ..\frontend
npm ci
npm run build
cd ..\nexus-backend
uv run pywrangler dev
```

The local worker needs `JWT_SECRET` and `PASSWORD_PEPPER` in `.dev.vars`. Never commit `.dev.vars`; generate separate random secrets for each environment. Passwords use Workers Web Crypto PBKDF2-SHA256 at the platform's 100,000-iteration limit, mixed with the private pepper for new accounts. The migrations seed student1–student4 with the shared beta password distributed to testers; their initial hashes are unpeppered and are upgraded after their first successful login. Replace/remove these publicly selectable beta credentials before opening a production sign-up flow.

## Laptop-hosted AI

The hosted chat calls Ollama on the owner's laptop through an authenticated localhost proxy and Cloudflare Tunnel. Install Ollama, pull `gpt-oss:20b`, and install `cloudflared`.

### Quick Start Commands to Activate AI:

1. **Terminal 1 — Local Proxy**:
   ```powershell
   cd C:\NEXUS-iisert_final\nexus-backend
   .\start-local-ai.ps1
   ```
   Run the launcher, not `python local_ai_proxy.py`: it creates and exports the token the proxy requires. It checks Ollama and `gpt-oss:20b`. Keep this terminal open.
2. **Terminal 2 — Cloudflare Tunnel**:
   ```powershell
   cd C:\NEXUS-iisert_final\nexus-backend
   .\start-local-ai.ps1 -Tunnel
   ```
   Keep the terminal open. Copy the HTTPS `trycloudflare.com` hostname it prints.
3. **Set the deployed Worker secrets** (from a third terminal):
   Open a third PowerShell terminal and run:
   ```powershell
   cd C:\NEXUS-iisert_final\nexus-backend
   npx wrangler secret put OLLAMA_API_KEY
   ```
   When prompted, enter the contents of the `.local-ai-token` file printed by Terminal 1. Then set the tunnel URL:
   ```powershell
   npx wrangler secret put OLLAMA_BASE_URL
   ```
   When prompted, enter the HTTPS hostname (no path or trailing `/`). These `secret put` commands update the already deployed Worker, so do not redeploy for this setup.

Keep the proxy and tunnel terminals running, keep the laptop awake, then try Ask AI on the deployed site. After every Quick Tunnel restart, update `OLLAMA_BASE_URL`; update `OLLAMA_API_KEY` only if the local token changes. Ollama remains bound to localhost and is never exposed directly. The proxy is limited to GPT‑OSS 20B and does not log prompts. Do not share or commit `.local-ai-token`.

## Deploy to Cloudflare

Set a private Worker secret first, apply migrations to the remote D1 database, build the client, then deploy:

```powershell
npx wrangler secret put JWT_SECRET
npx wrangler secret put PASSWORD_PEPPER
npx wrangler d1 migrations apply nexus-database --remote
cd ..\frontend
npm ci
npm run build
cd ..\nexus-backend
uv run pywrangler deploy
```

The current config points to the existing `nexus-database`. Migrations through `0005_global_groups_typing.sql` are applied in production. Do not use `--remote` for local experiments.

## Supported API slice and current gaps

- Authentication uses signed HS256 bearer access tokens and PBKDF2-SHA256 password hashes; D1 access uses prepared statements.
- Cloudflare Workers currently caps Web Crypto PBKDF2 at 100,000 iterations. Workers Free also has a 10 ms CPU budget per request, so measure deployed sign-in CPU before treating Free-plan capacity as sufficient.
- Friends, friend requests, profiles, conversations, messages, reactions, pin/edit/delete, and history clearing are persisted in D1.
- AI conversations, threads, and messages are persisted in D1. The Worker forwards bounded requests to GPT‑OSS 20B in Ollama on the owner's laptop, through a bearer-token-protected local proxy and a Cloudflare Tunnel. The local model uses a 16,384-token context and 2,048 output-token limit; prompts are capped at 4,000 characters and page context at 2,500 characters. The laptop and tunnel must be online for responses.
- QOTD/AOTD questions, archive entries, answer submissions, points, and comments use D1. The migration seeds one initial question. PDF attachments are not supported by this Worker yet.
- The Messenger refreshes visible conversations every five seconds to receive messages across sessions. Cloudflare Durable Objects/WebSockets are not wired yet, so this is polling rather than push delivery.
- Uploads, settings, password reset, notifications, academic features, and other application APIs are not migrated.
- The four beta credentials are intentionally public testing credentials. They are unsuitable for real accounts.

## Checks

```powershell
uv run python -m py_compile src\entry.py
npx wrangler d1 migrations apply nexus-database --local
```
