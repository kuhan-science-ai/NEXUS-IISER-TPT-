# NEXUS — Comprehensive Student Platform for IISER Tirupati

NEXUS is an integrated academic, communication, and productivity platform built for students, faculty, and administrators of IISER Tirupati.

## Start the site locally (Windows)

Run the backend and frontend in **two separate PowerShell windows**. The frontend proxies API and WebSocket requests to the backend.

### 1. Prepare the backend (first run, or if Uvicorn is missing)

From the project root:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
```

Use Python 3.10 or later. If this folder already has a `.venv` but it reports `No module named uvicorn`, activate it and install the backend requirements:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
```

If PowerShell blocks activation, run the install through the virtual environment directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

### 2. Start the backend

From the project root, with the virtual environment active:

```powershell
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend uses local SQLite by default and creates `nexus.db` on first launch. Optional settings can be copied from `.env.example` into a local `.env`; keep `.env` private and never commit it. The API health check is at [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health), and interactive API docs are at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

File uploads use local storage unless all three Cloudinary settings in `.env` are configured. Cloudinary applies to new uploads only; existing local files are not moved automatically.

Alternatively, after installing the backend requirements, start it from the project root using:

```powershell
.\scripts\run_backend.bat
```

### 3. Start the frontend

Open a second PowerShell window. From the project root, install the Node dependencies once, then start Vite:

```powershell
cd frontend
npm install
npm run dev
```

Open the `Local` URL printed by Vite. It normally uses [http://localhost:5173](http://localhost:5173); if that port is already occupied, Vite automatically selects the next available port (for example, `http://localhost:5174`). You can also launch the frontend with `..\scripts\run_frontend.bat` from the project root (after `npm install` has completed).

### Stop the servers

Press `Ctrl+C` in each server window. To leave the Python virtual environment, run `deactivate` in the backend window.

## Firebase sign-in setup

The deployed sign-in page uses Firebase Authentication for email/password and Google. To enable it:

1. Create a Firebase project, add a Web app, and copy its `apiKey`, `authDomain`, `projectId`, and `appId`.
2. In Firebase Console → Authentication → Sign-in method, enable **Email/Password** and **Google**. In Authentication → Settings → Authorized domains, add `nexus-iisert.pages.dev` and `localhost` for local development.
3. The Firebase Web app's public build config is stored in `frontend/.env.production`, so production builds (including Cloudflare Pages builds from this repo) include it. These are public client values, not private credentials.
4. In `nexus-backend/wrangler.jsonc`, set `FIREBASE_PROJECT_ID` and the public `FIREBASE_API_KEY` to the same Firebase web app project values. These Worker variables are separate from Pages. From `nexus-backend`, run `npx wrangler d1 migrations apply nexus-database --remote`, then `npx wrangler deploy` so the production Worker receives the matching config.
5. To enable the private developer console, set `FIREBASE_ADMIN_EMAIL` in the Worker config to your exact Google account email. The Worker grants admin only to a Firebase-verified matching email; Alt+C does not grant privileges by itself.

Email sign-up asks for username, display name, email, and password, then sends a Firebase verification link. Verify the email and log in again to finish creating the NEXUS profile. Unverified existing accounts are sent a verification link when they try to log in. Institute and personal emails currently get the same access. Google users authenticate with Google first, then choose username and display name. Display names accept Unicode and emoji. Password reset is sent by Firebase. Do not create a Firebase service-account key or put private credentials in frontend variables; the Firebase Web app values are public client configuration.

### Login troubleshooting

The login form now times out stalled Firebase or NEXUS API requests and shows a retryable error instead of leaving the button on **Please wait…** indefinitely. A Google account picker remains open until you finish or close it.

If sign-in stalls or fails:

1. Wait for the timeout message, then retry once. If the page still shows **Please wait…**, reload `https://nexus-iisert.pages.dev/auth?mode=login` with `Ctrl+Shift+R` and submit again; avoid repeatedly clicking while one request is running.
2. Check that your internet connection is working. For Google sign-in, allow pop-ups for `nexus-iisert.pages.dev` and complete or close the Google account picker.
3. If Firebase reports **unauthorized-domain** or the site says sign-in is not configured, open Firebase Console → Authentication → Settings → Authorized domains and confirm `nexus-iisert.pages.dev` is listed. Under Authentication → Sign-in method, confirm Email/Password and Google are enabled.
4. If the error says **Verify your email address**, open the verification email sent by Firebase, follow its link, then return and log in again. Check spam/junk if it is not in your inbox. A newly created account does not finish its NEXUS profile until this verification step is complete.
5. If the page reports a NEXUS session/API error, open `https://nexus-iisert.pages.dev/api/v1/auth/me`. A `401` response is expected when signed out and confirms the Worker route is reachable. A timeout or `5xx` response indicates a deployment or service issue; check Cloudflare Pages and the `nexus-backend` Worker deployment.
6. Use **Forgot password?** for a password error. If the same issue continues after the checks above, note the exact error text and time, then review the latest Pages/Worker logs before changing Firebase settings.

If Google/Firebase sign-in succeeds but profile completion fails, retry the same sign-in. The Worker repairs a missing profile row for an account created during an interrupted attempt. If an error remains, note its full text, including any HTTP status or profile setup stage, for the site maintainer.

### Account reset status

On 2026-11-07, all NEXUS website accounts and user-owned D1 data were cleared. Firebase Authentication identities and sign-in configuration were retained so users can sign in with their existing Firebase credentials and create a fresh NEXUS username/profile. The reset preserved application configuration and shared system data. A private pre-reset D1 export was saved in the machine's local temporary directory; it is not part of the repository.

If the Worker reports a verification stage such as **Firebase signing-key import**, send that exact stage and the approximate time to the site maintainer. The Worker logs only the stage and exception type; do not send or paste an ID token.

## Local GPU AI & Tunnel Activation Guide

NEXUS uses one model for both the AI Study Companion and the floating AI assistant: **Qwen3 14B** (`qwen3:14b`) via Ollama on the laptop GPU. The launcher uses your already downloaded model, one authenticated local proxy, and one Cloudflare Quick Tunnel. The RTX 5080 has 16 GB VRAM. Ollama is configured for up to 2 parallel generations and queues bursts up to 512 requests; this does **not** mean 100 simultaneous GPU generations. Larger bursts wait for available GPU capacity.

### Prerequisites

1. Install [Ollama](https://ollama.com/) and make sure `ollama list` shows `qwen3:14b`. If it is missing, download it with `ollama pull qwen3:14b`.
2. Install Cloudflare Tunnel:
   ```powershell
   winget install --id Cloudflare.cloudflared --exact
   ```

### Start AI after restarting your laptop

Keep both PowerShell windows open and prevent the laptop from sleeping while you want hosted AI available.

1. **Terminal 1 — start Qwen3 14B and the authenticated proxy:**
   ```powershell
   cd C:\NEXUS-iisert_final\nexus-backend
   .\start-local-ai.ps1
   ```
   This restarts Ollama with the configured parallel and queue limits, verifies `qwen3:14b` is installed, creates `.local-ai-token` on first run, then starts the proxy on `127.0.0.1:18787`. Do not launch `local_ai_proxy.py` directly.
2. **Terminal 2 — start the tunnel:**
   ```powershell
   cd C:\NEXUS-iisert_final\nexus-backend
   .\start-local-ai.ps1 -Tunnel
   ```
   Copy the HTTPS `trycloudflare.com` URL and leave this window open.
3. **Set the Worker tunnel URL after each Quick Tunnel restart:**
   ```powershell
   cd C:\NEXUS-iisert_final\nexus-backend
   npx wrangler secret put OLLAMA_BASE_URL
   ```
   Paste the HTTPS hostname without a path or trailing slash.
   This changes the laptop proxy endpoint used by the already deployed Worker. After you push source changes, deploy the Worker from `nexus-backend` with `npx wrangler deploy` to publish new AI routing code.
4. **Set the proxy API key once, or after rotating `.local-ai-token`:**
   ```powershell
   cd C:\NEXUS-iisert_final\nexus-backend
   npx wrangler secret put OLLAMA_API_KEY
   ```
   Paste the local token when Wrangler prompts. Never put it in GitHub, README, or chat. You normally keep the same ignored token file after laptop restarts.
5. Open [NEXUS AI Study Companion](https://nexus-iisert.pages.dev/ai) or use the floating assistant and send a message. If offline, confirm Ollama, proxy, and tunnel are running and that `OLLAMA_BASE_URL` matches the current tunnel URL.

The laptop, Ollama, proxy, and tunnel must stay online for replies. A Quick Tunnel URL changes after restart. The request queue absorbs bursts but cannot make one laptop GPU generate 100 replies simultaneously.

## Architecture Philosophy
- **Decoupled Design**: The frontend is built with minimal functional, unstyled components awaiting official Figma UI design handoff.
- **Robust Relational Data**: Persistent database models powered by SQLAlchemy 2.0 with Alembic versioning.
- **Permanent Real-Time Messaging**: Full-featured chat with WebSocket synchronization and permanent PostgreSQL storage.
- **AI Orchestration Framework**: Complete 14-step request-processing lifecycle with mock execution and safety permissions before real LLM integration.
- **Local LaTeX Rendering**: 100% offline mathematical and scientific rendering powered by locally bundled KaTeX.

## Documentation Index
- [Architecture & Layers](ARCHITECTURE.md)
- [Project Plan](PROJECT_PLAN.md)
- [Feature Checklist](FEATURE_CHECKLIST.md)
- [Database Schema Reference](DATABASE_SCHEMA.md)
- [API Documentation](API_DOCUMENTATION.md)
- [Development & Setup Guide](DEVELOPMENT_GUIDE.md)
- [Changelog](CHANGELOG.md)

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, TanStack Query, React Router, KaTeX
- **Backend**: Python FastAPI, SQLAlchemy 2.0, Pydantic v2, WebSockets, PyJWT, Bcrypt
- **Database**: PostgreSQL (with automatic SQLite fallback for lightweight local dev/testing), Alembic
- **Storage**: Persistent local storage abstraction with MIME and size validation
