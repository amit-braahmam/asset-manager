# AssetControl

An IT asset & inventory "operations console" that gives operations/IT teams one trusted register for hardware inventory, assignments, people, locations, maintenance, and an audit-ready activity trail.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — build + run the API server (Express 5). Requires `DATABASE_URL` and Clerk env.
- `pnpm --filter @workspace/asset-control run dev` — run the frontend (Vite). Requires `PORT`, `BASE_PATH`, and `VITE_CLERK_PUBLISHABLE_KEY`.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run test` — API RBAC/lifecycle tests + frontend role-matrix smoke tests
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate React Query hooks and Zod schemas from the OpenAPI spec (run this after editing `lib/api-spec/openapi.yaml`)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/db run generate` — generate a new SQL migration from schema diffs
- `pnpm --filter @workspace/db run migrate` — apply committed migrations

### Required env

- `DATABASE_URL` — Postgres connection string (API + DB)
- `CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — Clerk auth (API server)
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk auth (frontend)
- `PORT`, `BASE_PATH` — required by the frontend Vite config

## Stack

- pnpm workspaces, Node.js, TypeScript 5.9
- API: Express 5, Clerk auth (`@clerk/express`), Pino logging
- DB: PostgreSQL + Drizzle ORM (`drizzle-orm`, `drizzle-kit`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (React Query client + Zod) from the OpenAPI spec
- Frontend: React 19 + Vite, wouter routing, TanStack Query, Clerk, shadcn/ui (Radix), Tailwind CSS v4, lucide-react
- API server build: esbuild (via `build.mjs`)

## Where things live

Contract-first: `lib/api-spec/openapi.yaml` is the source of truth; Orval generates the typed client and Zod schemas from it.

- `lib/api-spec` — OpenAPI 3.1 spec (`openapi.yaml`) + Orval config. **Edit the spec, then run codegen.**
- `lib/api-zod` — generated Zod schemas + TypeScript types (do not edit by hand)
- `lib/api-client-react` — generated TanStack Query hooks + `custom-fetch` mutator (do not edit generated files by hand)
- `lib/db` — Drizzle schema (`src/schema/asset-control.ts`) and the `db` client. **Source of truth for DB schema.**
- `artifacts/api-server` — Express API. Auth + RBAC in `src/lib/auth.ts` and `src/app.ts`. Data routes in `src/routes/` (`assets.ts`, `users.ts`, `audit.ts`, `reports.ts`). Demo seed lives in `src/lib/seed.ts` (idempotent, first-request). Clerk proxy in `src/middlewares/`.
- `artifacts/asset-control` — React frontend. App + pages in `src/App.tsx`, role helpers in `src/lib/role.tsx`, shared UI in `src/components/asset-ui.tsx`, theme in `src/index.css`.

## Architecture decisions

- **Contract-first codegen.** The OpenAPI spec drives both the server's request/response validation (via generated Zod) and the client hooks. Never edit generated files under `lib/api-zod` or `lib/api-client-react`; edit the spec and re-run codegen.
- **Auth = Clerk + app-managed RBAC.** All `/api` routes require a signed-in Clerk user. Roles live in `asset_users` (not Clerk orgs). First signed-in user becomes **Admin**; later self-registered users default to **Viewer**. Data is currently **single-tenant / global** (not scoped per org).
- **Role matrix.** Admin: everything including role changes. Auditor: read-all + audit logs + compliance reports. Manager: operational CRUD + onboard Technician/Viewer only. Technician: status + maintenance outcomes. Viewer: read-only. The API enforces this; the UI hides actions the role cannot perform.
- **Compliance reports** are a 3-stage workflow (`in_preparation` → `ready_for_review` → `final`). Final reports are immutable.
- **Design tokens live in CSS.** The visual system (colors, fonts, radius) is defined as CSS custom properties in `artifacts/asset-control/src/index.css` under `:root`/`.dark`; see `docs/DESIGN.md` for the documented system.
- **Server owns money/date coercion.** The API converts DB `date`/`numeric` columns to API-friendly shapes; date-only fields are stored as `date` and serialized as ISO strings.

## Product

User-facing capabilities that exist today:

- **Dashboard** — inventory summary metrics, filterable activity feed, upcoming maintenance queue.
- **Inventory** — list/search/filter/paginate assets, create assets, CSV import/export, bulk status updates (gated by role).
- **Asset detail** — edit, assign to a person/location, return to stock, change status, and a full per-asset audit history.
- **Directory** — manage people (custodians) and locations.
- **Maintenance** — schedule, complete (with resolution/outcome notes), and remove service work.
- **Team** — Admin/Manager user onboarding; Admin-only role changes.
- **Reports** — Auditor/Admin audit log investigation and 3-stage compliance reports.
- **Auth** — Clerk sign-in/sign-up with a marketing landing page.

## User preferences

- Keep the implemented **light cream/teal theme** (Manrope + DM Mono); the older dark "Command Center" brief is superseded.
- Roadmap is **single-tenant first**, multi-user with **role-based access** (Admin / Auditor / Manager / Technician / Viewer). Clerk Organizations / true multi-tenancy come later.

## Gotchas

- **Run codegen after editing the OpenAPI spec** — `lib/api-zod` and `lib/api-client-react` are generated; hand edits get overwritten.
- **Apply DB schema with migrations.** `pnpm --filter @workspace/db run migrate` (or `push` in local dev). The initial migration lives in `lib/db/migrations/`.
- **Seeding is lazy.** `artifacts/api-server/src/lib/seed.ts` populates demo data on first request via `seedReady`. Idempotent.
- **Dashboard trends are 7-day deltas** computed from asset `createdAt` and `asset_history` (assignments − returns, maintenance events). They are not stored snapshots.
- Frontend Vite config **requires `PORT` and `BASE_PATH`** env vars or it throws on startup.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
