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

The local worker needs `JWT_SECRET`, `PASSWORD_PEPPER`, `FIREBASE_PROJECT_ID`, and the public Firebase Web API key (`FIREBASE_API_KEY`) configured for development. Never commit populated local secret files. Firebase signs users in; the Worker validates ID tokens through Firebase Identity Toolkit and issues the NEXUS API session token used by the existing services. Apply migration `0007_firebase_identity.sql` before using Firebase accounts.

## Firebase Authentication setup

1. Create a Firebase project and register a Web app. In Authentication → Sign-in method, enable Email/Password and Google. Add `nexus-iisert.pages.dev` and your local Vite host (`localhost`) under Authorized domains.
2. Set `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID` in `frontend/.env.production` from the Firebase Web app config. These are public web-client settings, not Admin SDK credentials.
3. Set the Worker variables `FIREBASE_PROJECT_ID` and `FIREBASE_API_KEY` to the Firebase project's ID and Web API key in `wrangler.jsonc` (or deployment environment variables), then deploy the Worker and rebuild/redeploy the frontend. The Web API key is public client configuration; never add a service-account key here.
4. Apply D1 migration `0007_firebase_identity.sql` to local/production D1.
5. To enable the developer console, set `FIREBASE_ADMIN_EMAIL` to the exact Google account email for the developer. The Worker grants the admin role only after Firebase verifies that same email; Alt+C only opens the console for an account that already has the server-side role.

Email/password accounts choose an email, password, username, and display name. Google users authenticate first, then complete username and display name. Personal emails are currently accepted with the same access as institute emails. Password reset is handled by Firebase.

## Laptop-hosted AI

The hosted AI features use one model, `qwen3:14b`, through an authenticated localhost proxy and Cloudflare Tunnel. Install Ollama and `cloudflared`; the launcher expects the Qwen3 14B weights to already be installed.

The launcher allows up to 2 parallel generations, up to 512 queued requests, an 8,192-token context, and up to 4,096 generated response tokens per pass. If Ollama reports a token-limit stop, the Worker requests up to two continuation passes. Direct-answer mode reduces reasoning overhead; requests beyond GPU capacity wait in Ollama's queue.

### Quick Start Commands to Activate AI:

1. **Terminal 1 — Local Proxy**:
   ```powershell
   cd C:\NEXUS-iisert_final\nexus-backend
   .\start-local-ai.ps1
   ```
   Run the launcher, not `python local_ai_proxy.py`: it restarts Ollama with the concurrency settings, verifies `qwen3:14b`, creates/exports the proxy token, and starts the authenticated proxy. Keep this terminal open.
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

Keep the proxy and tunnel terminals running and keep the laptop awake. Both AI chat surfaces use Qwen3 14B through this tunnel. After every Quick Tunnel restart, update `OLLAMA_BASE_URL`; update `OLLAMA_API_KEY` only if the local token changes. Ollama remains bound to localhost and is never exposed directly. The proxy only accepts the configured model name and does not log prompts. Do not share or commit `.local-ai-token`.

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
npm run deploy
```

The current config points to the existing `nexus-database`. Migrations through `0005_global_groups_typing.sql` are applied in production. Do not use `--remote` for local experiments.

## Supported API slice and current gaps

- Authentication uses signed HS256 bearer access tokens and PBKDF2-SHA256 password hashes; D1 access uses prepared statements.
- Cloudflare Workers currently caps Web Crypto PBKDF2 at 100,000 iterations. Workers Free also has a 10 ms CPU budget per request, so measure deployed sign-in CPU before treating Free-plan capacity as sufficient.
- Friends, friend requests, profiles, conversations, messages, reactions, pin/edit/delete, and history clearing are persisted in D1.
- AI conversations, threads, and messages are persisted in D1. All conversations use Qwen3 14B through the bearer-token-protected local proxy and one Cloudflare Tunnel; prompts are capped at 4,000 characters, recent history at ten turns, and page context at 2,500 characters. The laptop and tunnel must be online for responses.
- QOTD/AOTD questions, archive entries, answer submissions, points, and comments use D1. The migration seeds one initial question. PDF attachments are not supported by this Worker yet.
- Direct messages and Study Group channels use an authenticated Durable Object WebSocket for push delivery. Open chats also sync messages and typing state every 2.5 seconds while the socket has not received a recent pong, so a stale connection recovers without a page refresh.
- Uploads, settings, password reset, notifications, academic features, and other application APIs are not migrated.
- The four beta credentials are intentionally public testing credentials. They are unsuitable for real accounts.

## Checks

```powershell
uv run python -m py_compile src\entry.py
npx wrangler d1 migrations apply nexus-database --local
```
# Profile photo and banner storage

Profile photos (including GIFs and videos) are limited to 10 MB; banners are limited to 8 MB. The Worker stores each upload as new chunks in the existing D1 database and records its URL and MIME type on the profile, so media can render correctly after reloads and in profile views. No additional Cloudflare storage service is required.

Apply the profile-media schema migration to production D1 once:

```powershell
npx wrangler d1 execute nexus-database --remote --file migrations/0008_profile_media.sql
```

Deploy the Worker and frontend assets with:

```powershell
npx wrangler deploy
```

The D1 migration adds MIME type columns and a chunk table for media uploads. Do not re-run that SQL migration after it has succeeded.
