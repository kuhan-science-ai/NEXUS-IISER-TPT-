# Project Development Instructions

These instructions apply to the entire NEXUS repository. Keep behavior and documentation aligned with the implementation.

## Architecture

- Keep the React/TypeScript client in `frontend/src` and the FastAPI application in `backend/app`.
- Backend responsibilities belong in the existing layers: `api` for HTTP/WebSocket boundaries, `schemas` for Pydantic I/O, `services` for business behavior, `models` for SQLAlchemy persistence, and `core` for configuration/security.
- Put schema migrations in `database/migrations`; do not treat startup table creation as a substitute for a reviewed migration.
- Keep browser API calls in frontend services and reusable UI in components; pages compose feature flows.
- Preserve the current API version prefix `/api/v1` and existing WebSocket route unless a deliberate, documented compatibility change is intended.

## Code quality and conventions

- Follow neighboring code style and naming: Python modules/functions use `snake_case`, classes use `PascalCase`; TypeScript components/types use `PascalCase`, values and functions use `camelCase`.
- Keep request/response contracts explicit with Pydantic schemas and TypeScript types where practical. Avoid duplicating business rules between routes and services.
- Prefer focused changes that preserve existing interfaces. Check callers, related tests, migrations, and docs before changing shared behavior.
- Do not mark a feature complete based on plans or UI presence alone; confirm its implementation and distinguish mock/demo behavior from production integrations.
- Do not add dependencies without need; update the relevant lock/requirements file when a dependency changes.

## Security and data

- Never commit real credentials, tokens, private user data, or populated local environment files. Use `.env.example` for variable names and safe placeholders only.
- Validate and authorize every user-controlled object access on the server. Treat frontend checks as presentation only.
- Keep password hashing and token handling in `backend/app/core/security.py`; do not log secrets or return development credentials from production paths.
- Validate uploads for type, size, and safe storage paths. Never trust client filenames or path fragments.
- Use migrations for persistent schema changes and preserve existing data and foreign-key behavior.

## Verification and documentation

- Current project commands are `pytest tests/ -v` at the root and `npm run build` in `frontend/`.
- Report checks actually run and their outcomes; do not imply unrun checks passed.
- For each meaningful development change, update `PROJECT_STATE.md` and `CHANGELOG.md`; update `ARCHITECTURE.md` for architectural changes. Change this file only when permanent project rules change.
- Keep project documentation concise and verified against code. Preserve useful history and label plans, mocks, and known gaps accurately.

## Fixed profile footer and viewport layout

- Treat the fixed account/profile footer in the navigation as the bottom boundary for dashboard and history content. Content must not render below or underneath it, and these views should fit within the viewport without page scrolling; paginate long history lists instead of allowing them to extend past the footer.
