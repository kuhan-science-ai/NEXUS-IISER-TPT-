# NEXUS Architecture Documentation

## System Architecture

NEXUS is designed following a clean, modular, layered architecture to ensure separation of concerns, testability, and seamless future integration of Figma UI designs.

The deployed Cloudflare Python Worker uses a SQLite-backed Durable Object WebSocket hub for authenticated user-scoped live events. Worker/D1 mutations publish conversation, friend, group, and AI invalidations to affected connected accounts; the React client shares one socket and keeps session caches for fast route reopening. Discussion Forums is currently mock UI state and is not part of this shared data flow.

Browser voice/video media uses LiveKit Cloud as an SFU; the NEXUS Worker authorizes room entry and signs short-lived, room-scoped participant JWTs with Worker secrets. It reuses current user, conversation, group membership, and Durable Object invite events. The app-level React call provider keeps the LiveKit `Room` alive across route changes and separates minimization from participant leave and authorized call termination. Persistent voice-channel chat is stored in D1's `voice_channel_messages`, not in text-channel messages. LiveKit credentials must be configured on the Worker before media rooms can connect; setup is documented in `VOICE_CALLS_SETUP.md`.

```
+-------------------------------------------------------------------------+
|                              FRONTEND                                   |
|  React 18 + TypeScript + Vite + React Router + TanStack Query           |
|  - Minimal Functional Components (Unstyled, ready for Figma)            |
|  - Locally Bundled KaTeX (Offline Math Renderer)                        |
|  - Centralized WebSocket Client & State Synchronization                 |
+-------------------------------------------------------------------------+
                                    |
                         HTTP REST / WebSockets
                                    |
+-------------------------------------------------------------------------+
|                               BACKEND                                   |
|  FastAPI (Python 3.10+)                                                 |
|  +-------------------------------------------------------------------+  |
|  | Routers / API Endpoints (Auth, Users, Messages, AI, Academics)    |  |
|  +-------------------------------------------------------------------+  |
|  | Service Layer (Business Logic, Auth, Orchestration, Storage)      |  |
|  +-------------------------------------------------------------------+  |
|  | Repository & Data Access Layer (SQLAlchemy ORM 2.0)               |  |
|  +-------------------------------------------------------------------+  |
|  | Real-Time WebSocket Infrastructure (Connection Manager, Hub)      |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
                   |                                   |
+-------------------------------------+  +--------------------------------+
|          DATABASE (PostgreSQL)      |  |         LOCAL STORAGE          |
|  - 30+ Relational Tables            |  |  - Profile Pics, Banners       |
|  - Indexes, Foreign Keys, Cascades  |  |  - Academic PDFs, Attachments  |
|  - Alembic Versioned Migrations     |  |  - File Metadata in DB         |
+-------------------------------------+  +--------------------------------+
```

## Backend Layer Responsibilities
1. **API Routers (`backend/app/api/`)**: Defines HTTP routes and WebSocket endpoints, schema validation via Pydantic v2.
2. **Services (`backend/app/services/`)**: Implements business rules, file storage abstraction, auth hashing/tokens, AI orchestration loop, notification dispatch.
3. **Models (`backend/app/models/`)**: Declarative SQLAlchemy ORM models with strong foreign keys, unique constraints, and indexes.
4. **Schemas (`backend/app/schemas/`)**: Pydantic models for strict request validation and response serialization.
5. **Core (`backend/app/core/`)**: Configuration settings, security utilities (bcrypt, JWT), dependency injection.
6. **WebSockets (`backend/app/ws/`)**: Connection lifecycle, channel subscriptions, room routing, authentication on handshake.

## File Storage

`backend/app/services/storage.py` keeps the existing four-value upload contract and `FileMetadata` table. Local disk remains the default when the three `CLOUDINARY_*` settings are blank. When all Cloudinary settings are configured, new uploads go to Cloudinary; public avatars, banners, and academic resources use public delivery, while private uploads use authenticated delivery and short-lived signed download redirects. Cloudinary identifiers and delivery metadata are stored in the existing `file_path` column, so no migration is needed. Existing local files continue to be served from disk; this does not automatically migrate previously uploaded files. The `/files/{id}/download` and authorized daily-answer attachment routes handle both storage backends.

The deployed Cloudflare Worker stores profile image/GIF/video uploads in D1 as base64 chunks (`profile_media_chunks`) to reuse the existing production storage binding without requiring another Cloudflare service. Avatar uploads are limited to 8 MB and banners to 10 MB; the Worker checks allowed MIME types and file signatures, then updates the profile URL and MIME type. Public profile and current-user responses include MIME metadata so the client can render video and animated image media after reload. Migration `nexus-backend/migrations/0008_profile_media.sql` adds these fields and the chunk table.

## Frontend Layer Responsibilities
1. **Pages (`frontend/src/pages/`)**: Unstyled/minimally styled functional test screens for each subsystem (Auth, Messaging, Profiles, AI Studio, LaTeX preview, Academic Repository).
2. **Components (`frontend/src/components/`)**:
   - `MathRenderer`: Bundled local KaTeX renderer for scientific mathematical notation.
   - `ChatWindow`, `AIConsole`, `DocumentEditor`: Functional wrappers that consume TanStack Query & WebSocket state.
3. **Services (`frontend/src/services/`)**: API client (Fetch/Axios), token storage, WebSocket listener with auto-reconnect.

## Workspace Appearance Preferences

`frontend/src/App.tsx` owns the browser-local workspace palette selection and passes it through `RouteShell` to every interior route. `frontend/src/services/appearance.ts` defines the palette choices and localStorage key. `frontend/src/discord-interior.css` maps the selected palette and light/dark mode to shared UI tokens. The profile theme remains a separate per-user browser preference managed by the profile editor and is not changed when the workspace palette changes.

Custom workspace palettes are stored as a separate localStorage collection. Saved custom palettes can be edited in place from Settings; edits use the same transient live preview state in `App.tsx` and update the existing record only on Save. Discarding clears preview state and restores the last saved selection. The route shell derives CSS custom properties from the selected or preview palette and theme mode; optional color drift is a CSS animation disabled when reduced motion is requested. Profile theme state remains stored under its own user-specific key.

The beta image palette builder is implemented in `frontend/src/services/paletteImage.ts` and `frontend/src/pages/SettingsPage.tsx`. It validates JPEG, PNG, and WebP uploads (8 MB maximum), samples a 64×64 canvas locally to derive background, surface, and accent colors, and compresses the selected image for browser storage. Its confirmation flow previews the wallpaper and generated colors through the shared route-shell palette preview; saving attaches the image data URL to the named custom palette in localStorage and selects that palette. CSS in `frontend/src/discord-interior.css` layers the image beneath palette-tinted overlays on workspace surfaces while keeping the profile main surface excluded. No AI provider or backend upload is involved, and browser storage is not synchronized across devices.

## Daily question and answer flow

The daily question endpoints live under `/api/v1/campus`. `DailyQuestion` records include four answer choices and the participation point value; `DailyQuestionAnswer` stores a user's immutable choice, explanation, optional PDF attachment metadata, and awarded points, with a unique constraint on `(question_id, user_id)`. `DailyQuestionAnswerComment` stores discussion comments and nested replies. The API checks the viewer's submission before returning other students' answers or allowing comments, omits the viewer's own answer from the community list, validates that any attached PDF belongs to the submitting user, and serves answer PDFs only after the viewer has submitted. The AOTD interface keeps locked responses as blurred placeholders until submission, then paginates community answers inside a fixed-height rail.

`DailyQuestionProposal` stores pending QOTD submissions with category, question LaTeX, four LaTeX options, the correct-option index, worked solution, template notes, and animation notes. The submission endpoint creates notifications for moderator and administrator accounts; a role-protected listing endpoint powers the review inbox. The frontend renders LaTeX and `mhchem` previews for mathematics, physics, and chemistry. The QOTD page provides plain-language rules and a moving rainbow contributor invitation. QOTD, AOTD, the prior-question archive, and dashboard share `DailyQuestionTemplate`; dedicated pages disable its hover animation while the dashboard keeps its interactive card behavior.

## Dashboard, preferences, and activity history

`frontend/src/pages/DashboardPage.tsx` lays out core data-driven cards in two responsive columns with a divider: institute/academic items, QOTD, and visit history occupy the dominant column; followed club activity and continue-studying occupy the second column. Cards share a fixed 270px height, and optional widgets use the same card height in a separate My Extras tab. It reads campus events, the signed-in user's calendar, daily question, notifications, and optional tasks through the existing `/api/v1/campus` API. `frontend/src/services/dashboard.ts` stores per-user widget visibility and club names, plus a personal timetable upload in localStorage. The timetable is browser-local and limited to PDF, PNG, and JPEG files up to 1.5 MB. Dashboard settings group card controls, club interests, and timetable management in tabs.

Appearance settings separate saved User Interface palette presets from the custom palette/image builder with a secondary tab, keeping each workflow in its own compact view.

## LaTeX Studio

`frontend/src/pages/LaTeXEditorPage.tsx` provides `/latex` with two selectable engines. Fast KaTeX renders math, physics, and chemistry expressions in-browser; `frontend/src/components/MathRenderer.tsx` loads KaTeX's mhchem extension for `\\ce` and `\\pu`. The page includes ready-to-use maths, physics, and chemistry starters/snippets. Full Tectonic compiles complete TeX documents; `frontend/src/services/latex.ts` sends them to the authenticated `/api/v1/latex/compile` endpoint and renders the returned PDF. Fast-mode PDF export wraps its supported text/math input in a minimal article document and uses the same Tectonic endpoint. `backend/app/api/v1/latex.py` invokes the configured Tectonic executable in a temporary directory, with untrusted mode, source/output limits, a compilation timeout, and a two-job process-local concurrency cap. The PDF review dialog keeps source editable beside the compiled PDF and downloads the PDF blob directly. Each user's Fast and Full source drafts persist separately in browser localStorage across refreshes and page navigation; switching engines does not overwrite the other draft. Light/dark output is selected per compile; dark mode adds page/text colors to the TeX source only in the isolated compiler input. The selected engine is stored in browser localStorage. Install the pinned local Windows compiler with `scripts/install_tectonic.ps1`, or configure `TECTONIC_PATH` for an existing Tectonic binary. TeX packages may be fetched into Tectonic's bundle cache on first use.
The live/compiled editor viewer has an independent visibility toggle. PDF review keeps the compiled document visible and loads the local PDF.js renderer on demand, with a separate page-thumbnail rail; its Pages control hides or reopens only that rail, and selecting a thumbnail scrolls to the page.

`RouteShell` in `frontend/src/App.tsx` records route visits in a user-scoped localStorage history and a sessionStorage history for the current tab session. `UploadResourceModal` emits successful upload metadata; history stores its repository resource ID so the History page can return to that resource. `/history` provides session and all-history views. Session history lasts through reloads and resets with the browser tab session; all-history is limited to the current browser profile and is not a server audit log. Continue studying routes to the last study-related page and does not preserve reader position.

The self-profile editor is mounted by `RouteShell` as a global overlay. Profile triggers dispatch `nexus-open-profile-editor`, so opening or closing it does not navigate away from the current route. The account footer passes its element as the animation origin: a temporary clone flies and rotates to the viewport center, then plays a selected burst over a dimmed backdrop before opening the editor. Settings → Appearance → Effects saves the browser-local choice under `nexus-profile-launch-effect`: `classic` uses the cleaned VP9-alpha `frontend/public/profile-launch-explosion.webm` at 1.45× speed; `fireball` uses the supplied transparent WebM copied to `frontend/public/profile-launch-fireball.webm` at 1.7× speed. Both use the same display size, retain their clip colors, and remain independent of profile-specific colors. Closing reverses the flight with a short recoil, and reduced-motion preference bypasses the flight. The standalone `/profile` page was removed; legacy URLs redirect to `/dashboard`.

There is no backend source for a complete institute announcement feed, club subscription feed, or editor-managed Critical Problems feature. Current dashboard notices use account notifications, clubs filter the existing event/notification data by the student's entered club names, and no editor question/vote/recognition workflow is claimed as implemented.

The dashboard Institute & academic area renders existing campus calendar records and selected official/academic account notifications as clickable sticky-note cards. Institute filters academic event categories and official notice types; All events uses upcoming campus/calendar events. Note content comes from the available event description/title or notification content/title. Opening a note displays the full message in a scrollable dialog. Settings → Appearance → Sticky notes stores a user-scoped browser preference for workspace-matched or preset colors, straight/tilted layout, and gentle sway; reduced-motion preferences disable motion. This is a presentation layer over existing feeds, not a new announcement publishing or upload API.

The floating Ask AI launcher is fixed to the viewport until the user drags it. Its optional dock and coordinates are stored in browser localStorage under `nexus-ai-launcher-position-v1` and `nexus-ai-launcher-dock-v1`, then clamped when the viewport resizes. Settings uses a minmax grid track and border-box sizing to avoid horizontal overflow in its main content.

## AI Chat and Inference

The floating Ask AI panel (`frontend/src/components/AIQuickPanel.tsx`) and the AI Study Companion page (`frontend/src/pages/AILoopPage.tsx`) both submit to the authenticated `POST /api/v1/ai/conversations/{id}/chat` endpoint. FastAPI streams orchestration and model output as Server-Sent Events. Both surfaces show the user's turn immediately and stream assistant text; the AI Study Companion renders its transient stream in the conversation history, then replaces it with the persisted assistant turn so one response is displayed. The shared `MathRenderer` compiles `$...$`, `$$...$$`, `\\(...\\)`, and `\\[...\\]` math locally with KaTeX. The provider prompt requests ordinary prose by default and delimited math when useful, and raw TeX source only when explicitly requested.

`AI_PROVIDER` selects the Ollama provider (default, `OLLAMA_BASE_URL` and `OLLAMA_MODEL`) or deterministic mock provider. Ollama uses a reused bounded HTTP connection pool. The orchestrator applies an in-process semaphore and bounded wait queue; defaults are 8 active requests, 512 queued requests, and a 180-second queue timeout (`AI_MAX_CONCURRENT_REQUESTS`, `AI_MAX_QUEUED_REQUESTS`, `AI_QUEUE_TIMEOUT_SECONDS`). The model receives at most 16 recent messages, page context is capped at 8,000 characters, and message-history reads page through 100 records at a time. SQLite connections wait up to 30 seconds on a write lock.

The gate is local to one application process. It prevents unbounded inference fan-out and absorbs bursts, but a single Ollama model and SQLite do not guarantee low latency for 500 simultaneous users. That target requires shared admission/queue infrastructure, a production database such as PostgreSQL, and model-serving capacity sized for the intended concurrency; these are not implemented here.

## Cloudflare Worker Backend (Partial)

`nexus-backend/` is a separate Cloudflare deployment that keeps the `/api/v1` URL contract and serves the Vite `frontend/dist` assets on the same origin. It uses FastAPI through Cloudflare's Python Workers ASGI adapter and accesses D1 through the `nexus_database` binding with prepared statements. Its migrations define accounts/profiles, friendship requests/edges, conversations/members, messages, reactions, AI sessions/messages, and QOTD answers/proposals/comments. The Pages Function at `frontend/functions/api/[[path]].ts` forwards same-origin `/api/*` calls to this Worker. Local Wrangler D1 is the default; production applies migrations explicitly with `--remote`.

The Worker implements authentication, profiles, friends/requests/search, persistent direct messaging, shared group profiles/membership/channels/messages/reactions, expiring direct-message typing indicators, AI conversation/message persistence, QOTD/AOTD routes, and Academic Repository resources. Voice call sessions use the same Worker auth and membership checks, while LiveKit provides the media SFU. Group voice-channel history is persisted separately from text-channel history. Migration `0015_voice_calls.sql` adds call metadata and voice-channel messages and has been applied to local and production D1. Academic PDFs are signature-checked, limited to 50 MB, stored in D1 as ordered base64 chunks, and exposed through authenticated download endpoints that increment server-side counts and record per-account recent views. Optional JPG, PNG, and WebP thumbnails/banners are validated and stored as bounded D1 chunks in `academic_resource_artwork`; banners render separately from text. The optional fire-grid animation and selected color are stored per resource, preview in upload/edit dialogs, and frame the full card while keeping the centered content inset from the flame. Resource metadata, saved resources, uploads, and recent history are account-scoped. Resource deletion and edits are restricted server-side to the uploader. Migrations `0011`–`0013` add resources, artwork, and animation settings. The SQLAlchemy FastAPI implementation follows the same API contract and adds matching artwork/animation fields through Alembic migration `7e3a9c1f42b6`. Repository uploads stage files in browser memory until the metadata dialog's Upload file action; Discard does not persist them. All AI chats route to the local `qwen3:14b` model through `OLLAMA_BASE_URL`; `OLLAMA_API_KEY` authenticates a model-allowlisted localhost proxy. Ollama is configured for two parallel generations and queues up to 512 requests; this does not guarantee 100 concurrent generations on the laptop GPU. Incoming prompts are limited to 4,000 characters, recent history to ten turns, and page context to 2,500 characters. Settings, notifications, and WebSocket delivery are not migrated.

Profile avatars use the shared public media URL and media type in friend/search, conversation-member, direct-message, and group-message responses. The client refreshes active people/conversation results periodically and refreshes its own profile consumers after a save.
