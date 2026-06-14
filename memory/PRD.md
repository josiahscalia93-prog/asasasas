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
