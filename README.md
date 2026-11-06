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

## Running Laptop GPU AI (GPT-OSS 20B) for All Users Worldwide

NEXUS can route AI Study Companion and Ask AI chats to OpenAI `gpt-oss:20b` running locally on your laptop's GPU via Ollama, accessible securely from the deployed Cloudflare site anywhere in the world.

### Prerequisites
1. [Ollama](https://ollama.com/) installed with `gpt-oss:20b`:
   ```powershell
   ollama pull gpt-oss:20b
   ```
2. Cloudflare tunnel client (`cloudflared`) installed:
   ```powershell
   winget install --id Cloudflare.cloudflared --exact
   ```

### Start AI after restarting your laptop

The deployed website sends AI requests to Ollama running on this laptop. After Windows restarts, you must start Ollama, the authenticated local proxy, and a Cloudflare Quick Tunnel. Keep the two PowerShell windows open and prevent the laptop from sleeping while you want the website AI available.

1. **Start Ollama**. Open the Ollama app from the Windows Start menu. In PowerShell, confirm Ollama responds and has the model:
   ```powershell
   ollama list
   ```
   If `gpt-oss:20b` is missing, download it once:
   ```powershell
   ollama pull gpt-oss:20b
   ```

2. **Terminal 1 — start the local proxy**. From the project folder run:
   ```powershell
   cd C:\NEXUS-iisert_final\nexus-backend
   .\start-local-ai.ps1
   ```
   This checks Ollama and `gpt-oss:20b`, creates the private `.local-ai-token` the first time, and starts the proxy on `127.0.0.1:18787`. Leave this window running. Always use this script; running `python local_ai_proxy.py` directly does not set the proxy token.

3. **Terminal 2 — start the tunnel**. Open a second PowerShell window and run:
   ```powershell
   cd C:\NEXUS-iisert_final\nexus-backend
   .\start-local-ai.ps1 -Tunnel
   ```
   Wait for cloudflared to show `Your quick Tunnel has been created!` and copy its `https://...trycloudflare.com` URL. Leave this window running too.

4. **Update the deployed Worker URL after every tunnel restart**. Quick Tunnel addresses change when cloudflared restarts. Open a third PowerShell window, run the command below, and paste the URL from step 3 when Wrangler asks for a secret value:
   ```powershell
   cd C:\NEXUS-iisert_final\nexus-backend
   npx wrangler secret put OLLAMA_BASE_URL
   ```
   Wait for `Success! Uploaded secret OLLAMA_BASE_URL`. This updates the Worker used by the already-uploaded website; no site redeploy is needed.

5. **Set the API key only for first-time setup or after rotating the local token**. The value must exactly match the private contents of `C:\NEXUS-iisert_final\nexus-backend\.local-ai-token`. Run:
   ```powershell
   cd C:\NEXUS-iisert_final\nexus-backend
   npx wrangler secret put OLLAMA_API_KEY
   ```
   When Wrangler prompts, open `.local-ai-token` locally and paste its contents into the prompt. Do not paste the token into this README, chat, or any committed file. Wait for `Success! Uploaded secret OLLAMA_API_KEY`. You normally do **not** repeat this on laptop restart because the ignored local token file persists.

6. **Check it**. Open [NEXUS AI Study Companion](https://nexus-iisert.pages.dev/ai) and send a message. If it reports the laptop AI is offline, confirm all three local pieces are running (Ollama, proxy, tunnel), then verify that `OLLAMA_BASE_URL` is the current tunnel URL. If the proxy token file was deleted or regenerated, repeat step 5.

Keep `.local-ai-token` private. The laptop, Ollama, proxy, and tunnel must stay online for hosted AI replies. A Quick Tunnel is temporary; update `OLLAMA_BASE_URL` whenever its address changes.

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
