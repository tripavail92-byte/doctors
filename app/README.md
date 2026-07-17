# Health OS — Summit Systems

Multi-tenant SaaS platform for aesthetic clinics, labs, pharmacies, and
hospitals. This is the **Wave 0** foundation: a modular monolith built on a
shared PostgreSQL database with tenant isolation enforced by row-level
`tenantId` columns and PostgreSQL Row-Level Security (RLS).

- **Backend** — NestJS 10, Prisma 5, PostgreSQL 16, passport-jwt, class-validator
- **Frontend** — Vite + React 18 + TypeScript, MUI 5, React Router 6, axios
- **Package manager** — npm • **Runtime** — Node 20

---

## Monorepo layout

```
app/
├─ backend/                 NestJS API (Prisma, auth, guards, modules)
│  ├─ prisma/
│  │  ├─ schema.prisma      Data model (tenants, users, plans, clinical, billing)
│  │  └─ seed.ts            Seeds plans, features, a demo tenant + users
│  ├─ rls.sql               Row-Level Security policies (run once after migrate)
│  ├─ src/
│  │  ├─ common/tenant/     AsyncLocalStorage tenant context + middleware
│  │  ├─ prisma/            PrismaService with forTenant() transaction helper
│  │  ├─ auth/              JWT strategy, guards, login controller
│  │  ├─ entitlements/      Edition/feature entitlement checks
│  │  └─ modules/           Vertical feature modules (patients, appointments, …)
│  └─ package.json
├─ web/                     Vite + React admin/clinic UI
│  ├─ src/
│  │  ├─ theme/             MUI theme from teal design tokens + per-edition accent
│  │  ├─ components/        AppShell (Drawer sidebar + AppBar topbar)
│  │  ├─ pages/             Screens (dashboard, patients, appointments, billing …)
│  │  └─ api/               Typed axios client stub
│  └─ package.json
├─ docs/
│  ├─ ARCHITECTURE.md       How the platform is put together + how to add a module
│  └─ wave-0-backlog.md     Detailed Wave 0 engineering backlog + sprint plan
├─ docker-compose.yml       Local PostgreSQL 16
└─ .gitignore
```

---

## Prerequisites

- **Node 20+** and **npm 10+** (`node -v`)
- **Docker** + Docker Compose (for local PostgreSQL) — or your own Postgres 16
- **psql** client on your PATH (to apply `rls.sql`)
- A POSIX-ish shell. On Windows, use Git Bash, WSL, or PowerShell equivalents.

---

## Run it locally

All commands are run from inside `app/`.

### 1. Start PostgreSQL

```bash
docker compose up -d postgres
```

This exposes Postgres on `localhost:5432` (user/password/db all `healthos`).

### 2. Backend

```bash
cd backend
npm install

# Create your local env file (see backend/.env.example for all keys):
cp .env.example .env
# DATABASE_URL=postgresql://healthos:healthos@localhost:5432/healthos?schema=public
# JWT_SECRET=dev-super-secret-change-me

# Generate the client + create the database schema:
npx prisma migrate dev

# Apply Row-Level Security policies (idempotent; run after every schema change
# that adds tenant-scoped tables):
psql "$DATABASE_URL" -f rls.sql

# Seed reference data + a demo tenant with users:
npm run db:seed

# Start the API in watch mode (http://localhost:3000):
npm run start:dev
```

### 3. Frontend

In a second terminal, from `app/`:

```bash
cd web
npm install
npm run dev
```

The Vite dev server prints a local URL (default http://localhost:5173).
It proxies API calls to the backend on port 3000.

---

## Login credentials (from the seed)

The seed creates one demo tenant (**Glow Aesthetic Clinic**, edition `CLINIC`)
plus one platform (Summit) super-admin. Password for every seeded user is
**`Passw0rd!`**.

| Email                          | Role            | Scope            |
| ------------------------------ | --------------- | ---------------- |
| `owner@glowclinic.test`        | OWNER           | Glow tenant      |
| `reception@glowclinic.test`    | RECEPTION       | Glow tenant      |
| `doctor@glowclinic.test`       | DOCTOR          | Glow tenant      |
| `finance@glowclinic.test`      | FINANCE         | Glow tenant      |
| `admin@summit.test`            | PLATFORM_ADMIN  | Platform (Summit)|

Log in via `POST /auth/login` with `{ "email": "...", "password": "Passw0rd!" }`
to receive `{ "accessToken": "..." }`, or use the login page in the web app.

---

## Common scripts

Backend (`app/backend`):

| Script                | What it does                                  |
| --------------------- | --------------------------------------------- |
| `npm run start:dev`   | Nest API in watch mode                        |
| `npm run build`       | Compile TypeScript to `dist/`                 |
| `npm run db:seed`     | Run `prisma/seed.ts`                          |
| `npx prisma studio`   | Browse the database in a UI                   |
| `npx prisma migrate dev` | Create/apply a dev migration               |

Frontend (`app/web`):

| Script            | What it does                        |
| ----------------- | ----------------------------------- |
| `npm run dev`     | Vite dev server                     |
| `npm run build`   | Production build to `dist/`         |
| `npm run preview` | Preview the production build        |

---

## Where to go next

- **`docs/ARCHITECTURE.md`** — the modular-monolith design, how multi-tenancy
  and RLS work, entitlements/editions, and a step-by-step guide to adding a
  new feature module.
- **`docs/wave-0-backlog.md`** — the full Wave 0 engineering backlog: epics,
  tickets with acceptance criteria, dependency-ordered sprint plan, definition
  of done, and top risks.