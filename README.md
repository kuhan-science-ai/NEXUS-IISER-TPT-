# NEXUS — Comprehensive Student Platform for IISER Tirupati

NEXUS is an integrated academic, communication, and productivity platform built for students, faculty, and administrators of IISER Tirupati.

## Run and stop the site locally

These commands apply to this cloned workspace. Run them in separate PowerShell windows from the project root.

### Activate / start

1. Start the API:

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn backend.app.main:app --reload --port 8000
```

2. Start the web app in a second PowerShell window:

```powershell
cd frontend
npm install   # only needed once, or after dependencies change
npm run dev
```

Open the local address Vite prints in the terminal (normally `http://localhost:5173`). If you start Vite with another port, use that printed address instead.

### Revoke / stop

To stop either running service, focus its PowerShell window and press `Ctrl+C`. This stops only the local development server; it does not delete your database, files, or source code.

To deactivate the Python environment after stopping the API, run:

```powershell
deactivate
```

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
