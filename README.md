# Scholara

Scholara is a university admission management platform you can demo with seeded fictional data. Students, guardians, and consultants use role-based dashboards backed by NestJS + Supabase PostgreSQL.

Functional requirements: [`docs/Scholara-Specification.docx`](docs/Scholara-Specification.docx).

## Current status

**Implemented**

- Monorepo: `frontend/` (React + Vite) and `backend/` (NestJS)
- TypeORM connected to Supabase PostgreSQL via `DATABASE_URL`
- Demo JWT auth: `POST /api/auth/demo-login`
- Seed script with Ali Raza, 3 universities, documents, emails, call notes
- Student / guardian dashboards (documents, applications, deadlines)
- Consultant desk (assigned students, document approve/reject, step updates)
- Storage module stub for private Supabase bucket (file bytes upload still pending)
- Role layouts and REST APIs for documents / applications / dashboard

**Not implemented yet**

- Real file upload to Supabase Storage bucket
- Groq AI assistant
- Live call transcription UI
- Tailwind design system pass
- TypeORM migration files (dev currently uses `synchronize` when not in production)
- Consultant reassignment UI

## Technology stack

- **Frontend:** React, Vite, TypeScript, React Router, TanStack Query, Axios, RHF, Zod, Sonner, lucide-react
- **Backend:** NestJS, TypeORM, PostgreSQL, JWT, Swagger, class-validator
- **Data:** Supabase PostgreSQL (TypeORM) + Supabase Storage (files, Nest only)
- **AI (planned):** Groq via NestJS

## Folder structure

```text
Scholara/
├── frontend/          # @scholara/frontend
├── backend/           # @scholara/backend
├── docs/
│   └── Scholara-Specification.docx
├── AGENTS.md
├── README.md
├── .env.example
└── package.json
```

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase Postgres (`DATABASE_URL`)
- Local `JWT_SECRET` in `.env`

## Installation

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
# Fill DATABASE_URL and JWT_SECRET in .env
npm install
npm run seed
```

## Development commands

```bash
npm run dev:backend    # http://localhost:3000/api  (Swagger: /api/docs)
npm run dev:frontend   # http://localhost:5173
npm run seed           # reload demo data
npm run build
npm run lint
```

### Demo accounts (password: `demo123`)

| Email | Role |
|-------|------|
| student@scholara.demo | Student — Ali Raza |
| guardian@scholara.demo | Guardian |
| consultant1@scholara.demo | Consultant |
| consultant2@scholara.demo | Consultant |

## Security

- Never commit `.env`
- Never put service role / JWT / DB / Groq secrets in `VITE_*` vars
- Backend enforces auth on protected routes

## Agent / contributor rules

See [`AGENTS.md`](AGENTS.md).
