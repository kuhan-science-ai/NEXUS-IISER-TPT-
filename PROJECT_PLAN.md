# NEXUS Development Execution Plan

## Context and Philosophy
NEXUS is designed as the comprehensive student platform for IISER Tirupati.
**Core Principle:** Build the complete underlying architecture, backend logic, persistent database layer, real-time messaging, AI orchestration engine, and modular frontend integration points **WITHOUT** hardcoding premature visual UI designs. All final UI styling will come from official Figma designs. Frontend is strictly functional, minimal, and modular.

---

## Phases Overview

### Phase 1 — Foundation
- [x] Project structure initialization (`frontend/`, `backend/`, `database/`, `storage/`, `tests/`, `docs/`, `scripts/`)
- [ ] Backend configuration (`backend/app/core/config.py`, `.env`)
- [ ] Database connection layer supporting PostgreSQL with SQLite fallback for local development/testing (`backend/app/db/session.py`)
- [ ] SQLAlchemy ORM Models (comprehensive relational schema across all 30+ tables)
- [ ] Alembic migrations setup (`alembic.ini`, `database/migrations`)
- [ ] Security & Authentication engine (JWT tokens, bcrypt password hashing, session management, roles: Student, Moderator, Admin)
- [ ] Authentication REST endpoints (`/api/v1/auth/register`, `/login`, `/logout`, `/me`, `/demo-accounts`)
- [ ] Automated tests for Phase 1

### Phase 2 — User Systems
- [ ] User Profile customization backend & schemas (bio, department, academic year, status, accent color, visibility)
- [ ] Storage abstraction service (`backend/app/services/storage.py`) supporting local persistent storage with validation (MIME types, size limits)
- [ ] Profile picture & banner uploads with file metadata tracking in DB
- [ ] Friends & Social Connections (requests, accept, reject, remove, block, mutual friends, privacy)
- [ ] User Settings & Preferences
- [ ] Automated tests for Phase 2

### Phase 3 — Messaging System (Permanent & Real-Time)
- [ ] Relational Models: Conversations (1-to-1, Group), Members, Messages, Attachments, Reactions, Read Receipts
- [ ] REST API for conversations, message history, pagination, editing, pinning, deletion (with audit trails)
- [ ] Reusable WebSocket Infrastructure: Connection manager, token authentication, typing indicators, presence, instant delivery
- [ ] Permanent PostgreSQL storage guarantee (messages persist through server restart, reconnection, tab closure)
- [ ] Automated tests for Phase 3

### Phase 4 — AI Orchestration Engine (Mock Provider)
- [ ] Clean modular architecture: Request Handler, Conversation Manager, Context Manager, Message History Manager, Intent Router, Tool Registry, Permission & Confirmation Manager, Execution Manager, Response Processor, Streaming Handler
- [ ] `MockAIProvider`: deterministic responses, simulated delays, simulated streaming, tool-call simulation, error simulation, cancellation
- [ ] Tool Registry: academic search, course search, calendar management, assignment lookup, email draft/search
- [ ] Safety & permission classification: Read-only vs destructive operations requiring explicit user confirmation
- [ ] Minimal AI test harness interface in frontend
- [ ] Automated tests for Phase 4

### Phase 5 — Local LaTeX & Scientific Mathematical Rendering
- [ ] Local KaTeX bundling (zero external CDN dependency, works offline)
- [ ] Reusable LaTeX rendering component (`MathRenderer`) supporting inline `$math$` and display `$$math$$`
- [ ] Full syntax support: fractions, integrals, matrices, summations, greek symbols, chemical notation
- [ ] Scientific Document Editor foundation with live sanitized LaTeX preview
- [ ] Automated tests for Phase 5

### Phase 6 — Academic Systems
- [ ] Academic Repository: Upload/download PDF, DOCX, PPTX, metadata, tagging, bookmarks, ratings, download counter
- [ ] Courses & Enrolments: Course catalogue, syllabus, faculty info, assignments, materials, announcements
- [ ] Forums & Discussions: Categories, threads, nested comments, upvote/downvote, accepted answers, LaTeX support
- [ ] Study Groups
- [ ] Automated tests for Phase 6

### Phase 7 — Remaining Systems
- [ ] Notification System: Central event bus, persistent notifications, read/unread states, real-time push via WebSocket
- [ ] Calendar & Productivity: Events, academic deadlines, tasks, recurring items, personal notes
- [ ] Campus Pulse & Student Feed: Activity streams, recent contributions
- [ ] Events & Registrations (RSVP)
- [ ] Opportunities (Internships, Research, Scholarships)
- [ ] Lost & Found module
- [ ] Question / Answer of the Day (QOTD/AOTD)
- [ ] Automated tests for Phase 7

### Phase 8 — Comprehensive Verification & Integration
- [ ] Run full migration suite
- [ ] Run complete automated test suite (`pytest`)
- [ ] Verify frontend build and TypeScript compilation
- [ ] Verify offline LaTeX rendering
- [ ] Verify WebSocket persistence and real-time synchronization
