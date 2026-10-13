# Production readiness and security plan

Saved 6 September 2026. This is a **review and proposed plan only**. Nothing in this document has been implemented until a later go-ahead.

Requirement backdrop: [OWASP ASVS 5.0](https://asvs.dev/) Level 1 now; Level 2 if this deployment is the system of record for company inventory and personal data (emails, custody notes, photos).

---

## Current stack

| Layer | Tool |
|---|---|
| App | TypeScript, React, Vite, Express, Drizzle, Zod / OpenAPI |
| Auth | Clerk (sessions, sign-in, public sign-up) |
| Data | Neon Postgres |
| Host | Vercel (serverless API + static UI) |
| Mail / files | Resend, Vercel Blob |
| CI | GitHub Actions: install, unit tests, typecheck, build |

Mutations already go through `requireRoles`. Reads for inventory, people (including emails), locations, and maintenance do **not** — any signed-in user can load them. CI does **not** scan dependencies, source, or a running site. There is no Dependabot, SAST, DAST, Sentry, Helmet, or global rate limit.

Related data-safety finding (separate audit, same week): Description, Notes, resolution notes, report text, and custody notes **are written to Postgres**. They are not browser-only. “Real time” is React Query refetch (15s stale, window focus, invalidate after save), not live push. Inventory list/CSV omit Description/Notes; custody operator UI does not display saved optional notes.

---

## Top 3 tools (listings + user reviews, 2026)

These three appear together in AppSec comparisons because they cover different layers. Ratings below are from G2 / Gartner Peer Insights as cited in 2026 roundups.

1. **[Snyk](https://snyk.io/)** — G2 about **4.5/5** (100+ reviews); Gartner Peer Insights about **4.4/5**, repeated Customers’ Choice. Developers like IDE/GitHub fix PRs. Complaint: can be noisy. **Use for:** vulnerable packages (`pnpm-lock.yaml`), licenses, optional IaC (Vercel/GitHub config).
2. **[Semgrep](https://semgrep.dev/)** — G2 about **4.6–4.7/5**. Reviewers praise speed and low false positives. Free CLI/CI for a small team. **Use for:** Express/React patterns (open sign-up, CORS, missing `requireRoles` on GETs, secrets).
3. **[OWASP ZAP](https://www.zaproxy.org/)** (Checkmarx ZAP) — G2 about **4.2/5**, the usual free DAST pick. Users like automation; weaker as a polished enterprise console. **Use for:** hitting a Preview URL the way an attacker would (auth bypass, IDOR, custody links, headers).

Free GitHub companions (not a fourth “top tool”, but cheap to add next to Snyk): Dependabot + secret scanning.

---

## Codebase findings that drive the plan

- Public `/sign-up` plus “first user = Admin, everyone else = Viewer” means a stranger can register and **read the full estate** (`GET /api/assets`, people, locations, maintenance, attachments have no `requireRoles`).
- CORS allows any `*.vercel.app` origin and requests with no `Origin`, with `credentials: true`.
- No security headers (HSTS, CSP, `X-Content-Type-Options`, frame options).
- Photos upload to Vercel Blob with `access: "public"`. Image type is taken from client `Content-Type`, not magic bytes. JSON body limit is 8 MB on every route.
- Public custody rate limit is an in-memory `Map` (30/min/IP). On Vercel that does not hold across instances.
- `CRON_SECRET` is compared with string equality, not `timingSafeEqual`. Empty secret correctly denies cron.
- Removing a Team member deletes the app row; Clerk login is unchanged, so they can sign in again as Viewer.
- Photo-storage failures can return Blob/Vercel detail to the browser.
- `vercel.json` `maxDuration` is 10 seconds; custody/warranty crons can exceed that.
- Logger (Pino) already redacts `authorization` and `cookie`. React text nodes escape Description/Notes (no `dangerouslySetInnerHTML` on those fields).
- Single shared database: not multi-tenant.

---

## Implementation items

### P0 — Do these before calling Production locked down

1. **Invite-only Clerk (Production instance)**  
   Switch to `pk_live_` / `sk_live_`. Turn off public sign-up. First-time users should only get in if Team already invited their email.

2. **Lock CORS to `APP_URL`**  
   Stop allowing any `*.vercel.app` origin and unauthenticated no-Origin credentialed calls.

3. **Security headers on Vercel**  
   HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, a strict CSP (Clerk + Blob + this origin). ZAP will flag the current gap immediately.

4. **Private photos**  
   Private or signed Blob URLs. Sniff JPEG/PNG/WebP/GIF magic bytes, do not trust `Content-Type` alone.

5. **Serverless rate limits**  
   Use Upstash Redis (or similar) on `/api/public/custody/*` and on auth-heavy `/api` routes.

6. **Cron auth**  
   Compare `CRON_SECRET` with `crypto.timingSafeEqual`. Confirm the secret is set on Production.

7. **Team delete must revoke Clerk**  
   Removing a member must disable or delete the Clerk user so they cannot sign back in.

8. **Stop leaking internals**  
   Generic 4xx/5xx to the client; log storage/provider detail in Pino only.

### P1 — Production reliability (Snyk / Semgrep / ZAP + ops)

9. **Wire Snyk in GitHub**  
   Scan `pnpm-lock.yaml` on every PR; fail on high/critical reachable CVEs; enable weekly monitor. Optional: Snyk Code as a second SAST.

10. **Wire Semgrep in CI**  
    Default `p/owasp-top-ten` + `p/typescript` plus custom rules for: GET routes without `requireRoles`, CORS allowing `.vercel.app`, `access: "public"` blobs, `CRON_SECRET` string compare.

11. **Wire ZAP against Preview**  
    Baseline then authenticated scan (Clerk test user). Must include: unauthenticated `/api/*`, custody token guessing, Viewer vs Admin, attachment URLs.

12. **GitHub secret scanning + Dependabot**  
    Alerts if keys land in git; PRs for lockfile bumps.

13. **Staging ≠ Production**  
    Separate Neon branch, Clerk instance, Blob store, Resend domain. Deploy Preview there; Production only after ZAP + Snyk are green.

14. **Backups**  
    Neon point-in-time recovery on, restore tested once, documented RPO/RTO.

15. **Crash/uptime monitoring**  
    Sentry (or equivalent) on API + UI; uptime check on `/api/healthz`. Keep Pino redaction.

16. **Clerk MFA + session settings**  
    Require MFA for Admin/Manager. Short sessions. Production email/domain allowlist.

17. **Migrations on deploy**  
    `drizzle-kit migrate` in the Vercel build/release path so schema cannot drift from Production.

18. **Cron vs `maxDuration: 10`**  
    Raise duration or split batches so Hobby/Pro limits cannot silently skip mail.

19. **API tests beyond unit files**  
    Authenticated HTTP tests: Viewer cannot PATCH; unauthenticated GET `/api/assets` is 401; public custody 429; invite-only sign-in.

### P2 — Hardening once P0/P1 are in

20. Helmet (or Vercel header equivalents) as belt-and-braces.  
21. 8 MB JSON only on attachment routes; keep other POSTs small.  
22. Custody token pepper (HMAC with a server secret, not raw SHA-256 of the token).  
23. Viewer data minimization — hide emails/notes if Viewer should only see tags/status.  
24. Clerk webhooks for user deleted/banned so `asset_users` cannot go stale.  
25. SBOM from Snyk or `pnpm` for customers/auditors.  
26. External pentest after the items above, mapped to ASVS L2 if this is the system of record.  
27. Privacy page / retention — people emails, custody notes, and photos are personal data.  
28. Multi-tenant isolation only if more than one company will share this deployment.

---

## Suggested first go-ahead slice

1. Implement **P0 items 1–8** (access control and headers).  
2. Then add **Snyk + Semgrep + ZAP in CI** (items 9–11) so regressions cannot ship on `main`.

Do not start this work until the product owner picks a slice and says go ahead.

---

## Pointers in this repo

- API bootstrap, CORS, auth attach: `artifacts/api-server/src/app.ts`
- Role guards: `artifacts/api-server/src/lib/auth.ts`, `auth-roles.ts`
- First-user Admin / Viewer default: `resolveAppUser` in `artifacts/api-server/src/lib/auth.ts`
- Public sign-up UI: `artifacts/asset-control/src/App.tsx` (`SignUpPage`, landing CTAs)
- Blob uploads: `artifacts/api-server/src/lib/storage.ts`
- Public custody + in-memory limit: `artifacts/api-server/src/routes/custody-public.ts`
- Cron bearer check: `artifacts/api-server/src/routes/cron.ts`
- CI: `.github/workflows/ci.yml`
- Hosting / crons / 10s cap: `vercel.json`
- Env template: `.env.example`
