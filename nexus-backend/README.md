# NEXUS on Cloudflare Workers + D1

This is the Cloudflare deployment for the existing `/api/v1` client contract. It implements account registration/login/profile reads, four beta accounts, user search/friends/requests, persistent direct/group messaging, persistent AI session management, and the QOTD/AOTD read, answer, archive, and discussion APIs. Other NEXUS features still use the existing FastAPI app and are not migrated by this Worker.

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

The current config points to the existing `nexus-database`. Migration `0003_ai_qotd.sql` and the Worker routes are deployed to production. Do not use `--remote` for local experiments.

## Supported API slice and current gaps

- Authentication uses signed HS256 bearer access tokens and PBKDF2-SHA256 password hashes; D1 access uses prepared statements.
- Cloudflare Workers currently caps Web Crypto PBKDF2 at 100,000 iterations. Workers Free also has a 10 ms CPU budget per request, so measure deployed sign-in CPU before treating Free-plan capacity as sufficient.
- Friends, friend requests, profiles, conversations, messages, reactions, pin/edit/delete, and history clearing are persisted in D1.
- AI conversations, threads, and messages are persisted in D1. Replies use the `AI` Workers AI binding with `@cf/meta/llama-3.1-8b-instruct-fp8`; the route limits each user to 20 prompts per UTC day, 4,000 prompt characters, 2,500 page-context characters, and 512 output tokens. Workers AI includes 10,000 Neurons/day in its free allocation; paid usage above that is billed per Cloudflare's current pricing. Check the Workers AI dashboard for usage.
- QOTD/AOTD questions, archive entries, answer submissions, points, and comments use D1. The migration seeds one initial question. PDF attachments are not supported by this Worker yet.
- The Messenger refreshes visible conversations every five seconds to receive messages across sessions. Cloudflare Durable Objects/WebSockets are not wired yet, so this is polling rather than push delivery.
- Uploads, settings, password reset, notifications, group UI data/channels, academic features, and other application APIs are not migrated.
- The four beta credentials are intentionally public testing credentials. They are unsuitable for real accounts.

## Checks

```powershell
uv run python -m py_compile src\entry.py
npx wrangler types
npx wrangler d1 migrations apply nexus-database --local
```
