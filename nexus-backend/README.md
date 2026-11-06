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

The local worker needs `JWT_SECRET`, `PASSWORD_PEPPER`, and `FIREBASE_PROJECT_ID` configured for development. Never commit populated local secret files. Firebase signs users in; the Worker verifies Firebase ID tokens and issues the NEXUS API session token used by the existing services. Apply migration `0007_firebase_identity.sql` before using Firebase accounts.

## Firebase Authentication setup

1. Create a Firebase project and register a Web app. In Authentication → Sign-in method, enable Email/Password and Google. Add `nexus-iisert.pages.dev` and your local Vite host (`localhost`) under Authorized domains.
2. Set `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID` in `frontend/.env.production` from the Firebase Web app config. These are public web-client settings, not Admin SDK credentials.
3. Set the Worker variable `FIREBASE_PROJECT_ID` to the same project ID in `wrangler.jsonc` (or a deployment environment variable), then deploy the Worker and rebuild/redeploy the frontend.
4. Apply D1 migration `0007_firebase_identity.sql` to local/production D1.
5. To enable the developer console, set `FIREBASE_ADMIN_EMAIL` to the exact Google account email for the developer. The Worker grants the admin role only after Firebase verifies that same email; Alt+C only opens the console for an account that already has the server-side role.

Email/password accounts choose an email, password, username, and display name. Google users authenticate first, then complete username and display name. Personal emails are currently accepted with the same access as institute emails. Password reset is handled by Firebase.

## Laptop-hosted AI

The hosted chat calls Ollama on the owner's laptop through an authenticated localhost proxy and Cloudflare Tunnel. Install Ollama, pull `gpt-oss:20b`, and install `cloudflared`.

The launcher starts Ollama with up to 15 parallel requests, up to 512 queued requests, and a 2,048-token context per request. Requests beyond the active parallel limit wait in Ollama's queue in arrival order. Actual latency depends on available GPU memory and workload; this is not unlimited capacity.

### Quick Start Commands to Activate AI:

1. **Terminal 1 — Local Proxy**:
   ```powershell
   cd C:\NEXUS-iisert_final\nexus-backend
   .\start-local-ai.ps1
   ```
   Run the launcher, not `python local_ai_proxy.py`: it restarts Ollama with the concurrency settings, creates/exports the proxy token, checks for `gpt-oss:20b`, and starts the authenticated proxy. Keep this terminal open.
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
- AI conversations, threads, and messages are persisted in D1. The Worker forwards bounded requests to GPT‑OSS 20B in Ollama on the owner's laptop, through a bearer-token-protected local proxy and a Cloudflare Tunnel. The local proxy keeps the model warm for 24 hours and uses `think: false`, an 8,192-token context, and a 1,024-token output limit for faster replies; prompts are capped at 4,000 characters and page context at 2,500 characters. The laptop and tunnel must be online for responses.
- QOTD/AOTD questions, archive entries, answer submissions, points, and comments use D1. The migration seeds one initial question. PDF attachments are not supported by this Worker yet.
- The Messenger refreshes visible conversations every five seconds to receive messages across sessions. Cloudflare Durable Objects/WebSockets are not wired yet, so this is polling rather than push delivery.
- Uploads, settings, password reset, notifications, academic features, and other application APIs are not migrated.
- The four beta credentials are intentionally public testing credentials. They are unsuitable for real accounts.

## Checks

```powershell
uv run python -m py_compile src\entry.py
npx wrangler d1 migrations apply nexus-database --local
```
