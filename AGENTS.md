# AGENTS.md — Scholara

Permanent instructions for AI coding agents working in this repository.

## Source of truth

- Functional requirements: `docs/Scholara-Specification.docx`
- This file: architecture, security, coding, and Git rules
- Do not invent product behavior that contradicts the specification
- Do not claim unfinished features are implemented

## Product

Working admission-management app for a short supervisor demo, filled with **seeded** fictional data. Roles: Student, Guardian, Consultant. No real university portal integrations.

Demo auth is NestJS JWT (`POST /api/auth/demo-login`) so role-based screens work. Seed data populates Postgres.

## Repository layout (actual)

```text
frontend/  → React + Vite + TypeScript (@scholara/frontend)
backend/   → NestJS + TypeScript (@scholara/backend)
docs/      → specification
```

## Architecture

```text
React (frontend)
  → REST + JWT Bearer
NestJS (backend)
  → TypeORM → Supabase PostgreSQL (DATABASE_URL)
  → StorageService → Supabase Storage (service role, private bucket)
  → GroqService → Groq API (server-side only; chat via `/api/chat`)
```

### Hard rules

1. Backend is the only component that accesses PostgreSQL.
2. Frontend talks to NestJS only — no direct Postgres.
3. Do not use Prisma or Drizzle.
4. Do not use Supabase Auth.
5. `@supabase/supabase-js` on the server is for Storage, not TypeORM replacement.
6. AI only through NestJS.
7. Never trust client-supplied student IDs for authorization — use JWT.
8. Guardians: read-only linked student. Consultants: assigned students (+ handover).
9. Bucket `student-documents` stays private.
10. Never expose service role, JWT, DATABASE_URL, or Groq keys to the frontend.

## TypeScript & quality

- Strict TypeScript; avoid `any`
- Thin controllers; logic in services
- DTO validation; no fake success responses
- Lint/build before finishing a phase
- Never print secrets in logs

## Environment

See root `.env.example`. Ask the user when credentials are missing. Do not invent or modify real secret values casually; fix URL encoding only when required for connectivity and tell the user.

## Git

- Do not commit/push unless asked
- Show changed files + summary before committing
- Never force-push; never commit `.env` or private documents

## Implementation approach

Work in small phases. Prefer a working demo increment over large unverified dumps. Keep README/AGENTS aligned with reality.
