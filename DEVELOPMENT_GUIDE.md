# NEXUS Development & Setup Guide

## Prerequisites
- **Python**: 3.10+ (Current: Python 3.14)
- **Node.js**: 18+ (Current: Node.js v26.7.0, npm 11.19.0)
- **Database**: PostgreSQL (recommended for production) or SQLite (supported out of the box for zero-setup local development and testing)

---

## 1. Quick Start

### Backend Setup
```bash
# 1. Activate Python virtual environment
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# Or Command Prompt:
.\.venv\Scripts\activate.bat

# 2. Install dependencies (already prepared in requirements.txt)
pip install -r backend/requirements.txt

# 3. Environment configuration
# Copy .env.example to .env or use defaults (SQLite for instant dev)
# Run database migrations / initialization
python -m backend.app.db.init_db

# 4. Start the FastAPI server
uvicorn backend.app.main:app --reload --port 8000
```
FastAPI documentation will be running at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

### Frontend Setup
```bash
cd frontend
# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Frontend test interface will run at: `http://localhost:5173`

---

## 2. Demo Accounts (Out-of-the-box)
On initial database seed, the following accounts are available for testing:

| Role | Username | Email | Password |
|---|---|---|---|
| Student | `student1` | `student1@iisertirupati.ac.in` | `NexusPass123!` |
| Moderator | `moderator1` | `moderator1@iisertirupati.ac.in` | `NexusPass123!` |
| Administrator | `admin` | `admin@iisertirupati.ac.in` | `NexusAdmin123!` |

You can also seed or reset these anytime by invoking the dev endpoint:
`POST /api/v1/auth/demo-accounts`

---

## 3. Running Automated Tests
```bash
# Run pytest with async support
pytest tests/ -v
```

---

## 4. UI Note (Strictly Enforced)
The frontend currently uses minimal, neutral, unstyled functional components.
Do not modify components with custom visual design, fonts, or colors until the official Figma designs are provided. All functional state and APIs are cleanly decoupled for Figma integration.
