# AssetControl — continue from here

**Paused 9 Oct 2026 evening. Resume tomorrow from this file.**

Do not implement a step until Amit says go for **that** step.

**Project:** `D:\Work\AI\AssetManager` (AssetControl). Branch: `main` → live on Vercel.  
**Remote:** `origin` = `https://github.com/amit-braahmam/asset-manager.git`

---

## Start tomorrow here

1. Read this file + `docs/production-security-plan.md` (P0 list).
2. Optional smoke: signed-in desktop Overview → Inventory table → asset (confirm layout remove stuck).
3. When ready, say: **`go Phase 0`**
4. After Phase 0 merges: `go Supervisor` → `go field API` → `go field app`

**Do not** reintroduce the phone-friendly website layout. That work was removed on purpose.

---

## Progress

| Slice | Status | Start phrase |
|---|---|---|
| Remove local phone-website layout | **Done** (9 Oct 2026) — restored to last commit; `workspace-nav` deleted. Frontend 37/37 + typecheck. | — |
| Phase 0 guardrails | **Done on branch** `feat/api/phase-0-guardrails` (commit `46587ce`). **Not merged to `main`.** Manual: `docs/phase-0-manual-steps.md` | Open/merge PR when ready |
| Supervisor role + reports-to | Waiting | `go Supervisor` |
| Field API (by-tag, sync/conflict) | Waiting | `go field API` |
| Field app + offline v1 | Waiting | `go field app` |

Untracked planning files (not committed unless Amit asks): `NEXT.md`, `docs/production-security-plan.md`, `.cursor/`

---

## Locked decisions

### Website / branching
1. Website = office console. Do not wrap `App.tsx` as the store app.
2. Phone-friendly **website** layout discarded; keep pre-layout UI.
3. Short-lived branches + PRs into `main`. Lanes: `feat/web`, `feat/field`, `feat/api`.
4. First website coding after clean baseline: **Phase 0 guardrails**.

### Check-out / check-in
5. Meaning: scan → pick **person + location** → assign; check-in = return.
6. Roles: **Admin + Manager + Supervisor** only. Technicians **parked**.
7. Same power on **website** asset page for those roles.
8. By-tag API included in field branching (`feat/api` first).

### Phone app v1 — who + what

| Role | Phone? | Lookup / scan | Check-out / in | Finish maintenance | Conflict override |
|---|---|---|---|---|---|
| Admin | Yes | Yes | Yes | Yes | Yes |
| Manager | Yes | Yes | Yes | Yes | No* |
| Supervisor | Yes | Yes | Yes | Yes | Yes |
| Technician | Yes | Yes | No | Yes | No |
| Viewer | Yes | **Lookup only** | No | No | No |
| Auditor | No (v1) | — | — | — | — |

\*Managers may mutual-Accept with peers; they do **not** supersede. Override = **Supervisor** or **Admin**.

### Supervisor
9. New **single** role (not stacked with Manager). Replaces some Managers.
10. Powers: full **Manager** website powers + conflict override.
11. Rank/powers at Manager tier; **Admin** still above.
12. **One supervisor per person**; one supervisor → many reports.
13. **Admin only** sets “reports to” on Team.
14. **Admins are exempt** from reporting to someone.
15. Phone users who scan/lookup should have a Supervisor; **if missing, Admin acts as Supervisor**.
16. Conflict override: **Supervisor and Admins**.

### Offline + conflict
17. Offline in **first** field release.
18. Conflicts include check-out vs check-out and **return vs check-out**.
19. Until resolved: keep **last online** state.
20. Peers may mutually Accept; if one refuses → Supervisor (or Admin acting as Supervisor).
21. Supervisor/Admin may override **without** both Accepting.

---

## Best order

1. ~~`go remove layout`~~ **done**  
2. `go Phase 0` ← **resume here**  
3. `go Supervisor` — role + reports-to + Team UI  
4. `go field API` — by-tag, CORS, sync/conflict endpoints  
5. `go field app` — Expo + offline outbox + conflict UI  

---

## Layout remove — DONE (9 Oct 2026)

- Restored: `index.html`, `package.json`, `App.tsx`, `asset-ui.tsx`, `custody-checks.tsx`, `index.css`
- Deleted: `workspace-nav.ts`, `workspace-nav.test.ts`
- QA: asset-control tests 37/37; typecheck pass.

---

## Phase 0 pointer (tomorrow)

Implement P0 from `docs/production-security-plan.md` on a short branch → PR → `main`.  
Do not mix Supervisor or field app into that PR unless Amit asks.

---

## Non-breaking rules

- OpenAPI first; additive Drizzle; checkout wraps assign/return.
- No multi-tenant rewrite; no website custom `<select>` project.
- No implementation without an explicit go for that slice.

---

## Say this tomorrow

- `go Phase 0`  
- or `go Supervisor` / `go field API` / `go field app` if skipping order (not recommended).
