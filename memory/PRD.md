# UI2Code — Product Requirements Document

## Original Problem Statement
Build a homepage, login, signup, dashboard, and all website pages for the uploaded feature set. The uploaded file describes **UI2Code**: an AI tool that converts uploaded design images (PNG/JPG or URL) into production-ready frontend code using Claude Vision.

## User Choices
- AI model: **Claude Sonnet 4.6** (vision) via Emergent LLM key
- Auth: **Email + password (JWT, httpOnly cookies)**
- Design: agent's choice → **Swiss high-contrast dark theme** (Cabinet Grotesk + JetBrains Mono, signal-red #FF3B30 accent)
- Pages: Home, Login, Signup, Dashboard, Converter, Projects, Pricing, Settings
- Save projects to user history: **Yes**

## Architecture
- **Frontend**: React (CRA + craco), Tailwind, shadcn/ui, react-router, axios (withCredentials), sonner toasts.
- **Backend**: FastAPI + Motor (MongoDB). JWT auth with bcrypt, httpOnly cookies. Claude Sonnet 4.6 via emergentintegrations (image → code).
- **DB collections**: users, projects.

## Implemented (2026-06-14)
- Landing page with bento-grid features, how-it-works, stack strip, CTA.
- Email/password auth: register, login, logout, /me, profile update. Admin seeded on startup.
- Protected routes + AuthContext.
- Converter: 3-step flow (upload/URL → configure framework+styling+prompt → result), generating state, Code/Preview(iframe)/Original tabs, copy, download.
- Dashboard: stat cards + recent projects.
- Projects: grid, detail dialog (code/preview/original), delete.
- Pricing (3 plans), Settings (profile + plan).
- CORS hardened with preview-domain regex.

## Test Status
- Backend: 18/18 pytest passing. Frontend: 100% on all critical flows (testing agent iteration_1).

## User Personas
- Frontend developers / designers who want to convert mockups to code fast.

## Backlog
- P1: Exclude/replace full image_base64 in /api/projects list with a thumbnail (performance).
- P1: Use Pydantic model for PUT /api/auth/profile.
- P2: Streaming token output in converter; password reset; team seats.
- P2: Production cookie hardening (secure=True, SameSite per deployment).
- P2: Split server.py into routers (auth, projects, generate).

## Next Tasks
- Gather user feedback on generated-code quality and add per-framework live preview (sandpack) for React/Vue.

## Iteration 2 (2026-06-14) — Playground IDE expansion
- **DSL pipeline**: vision model → JSON component tree (meta + tree, OCR/styles) → framework code synthesis. DSL stored per project and shown in a "Tree" tab.
- **AI chat refinement**: `/api/projects/{id}/refine` edits code via natural language using DSL + current code as context; surgical updates.
- **Version history + undo/redo**: every generation/refine appends a version; `/api/projects/{id}/restore` navigates history.
- **Monaco editor** (`@monaco-editor/react`) + **Sandpack live preview** (`@codesandbox/sandpack-react`) for React/Vue, iframe for HTML — full IDE-light playground.
- **Models**: Claude Sonnet 4.6, Gemini 3.1 Pro, GPT-4o all selectable.
- **Thumbnails**: lean `/api/projects` list (no full image/code); detail fetched lazily.
- Fixes: safe clipboard copy (no error overlay), dialog a11y description.
- Tested: backend 23/23 pytest; frontend all critical flows pass.

## Iteration 3 (2026-06-14) — Reliability + Open in editor
- **Fixed Cloudflare/proxy timeout on generate**: generation is now an async background job. `POST /api/generate` returns `{job_id}` instantly; frontend polls `GET /api/generate/status/{job_id}`. Verified: POST returns in <0.1s, IDE renders after job completes. Upload-screenshot → convert flow confirmed working.
- **Refine is now async too** (same job + polling pattern) via `GET /api/refine/status/{job_id}` — prevents the same timeout class.
- **Open in editor**: Projects card pencil (`edit-{id}`) and dialog `open-in-editor-btn` → `/convert?project={id}` loads a saved project (code, versions, dsl, image) straight into the playground.
- Hardened jobs: index on (id,user_id), stale 'processing' jobs marked errored on startup. Budget errors surfaced with a clear "top up Universal Key" message.
- Verified: backend async generate + async refine end-to-end (curl); frontend compiles clean.

## Known external issue
- EMERGENT_LLM_KEY (Universal Key) hit its budget cap during testing ("Budget exceeded: cost 1.46 > 1.4"). User must top up: Profile → Universal Key → Add Balance. Default model is Claude Sonnet 4.6; GPT-4o/Gemini also draw from the same balance.
- Google + GitHub OAuth social login.
- Real Stripe checkout (currently pricing UI placeholder).
- Persistent light/dark theme toggle.
- Split server.py into routers (auth/llm/projects); LLM call timeouts; FRONTEND_URL env alignment.
- "Open project in editor" (re-open saved project directly into the refinement playground).
