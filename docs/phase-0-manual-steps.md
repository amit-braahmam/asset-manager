# Phase 0 — manual steps (Amit)

Code for Phase 0 lives on branch **`feat/api/phase-0-guardrails`**. It does **not** change live `main` until you merge a PR.

Do these **before or right after** merging to Production.

---

## 1. Clerk — invite-only

1. Open [Clerk Dashboard](https://dashboard.clerk.com) → your **Production** instance (when going live with these changes).
2. **Configure → Restrictions** (or Sign-up): turn **off** public sign-up / allowlist-only as Clerk labels it.
3. Prefer inviting users from **AssetControl → Team → Onboard user** (pending invite + email). Invitees still open `/sign-up` from that email.
4. When ready for real Production keys: use `pk_live_` / `sk_live_` in Vercel (and matching `VITE_CLERK_PUBLISHABLE_KEY` at **build** time).

**Dev tip:** Local Development instance can stay open for testing; Production must be invite-only.

---

## 2. Vercel environment variables

In the Vercel project → Settings → Environment Variables (Production + Preview as needed):

| Name | Purpose |
|---|---|
| `APP_URL` | Public site origin, **no trailing slash** (e.g. `https://your-app.vercel.app`). Used for email links **and** CORS. |
| `CORS_ORIGIN` | Optional comma-separated extra Origins (Preview URLs you trust). |
| `CRON_SECRET` | Long random secret; must match Vercel Cron Authorization. |
| `UPSTASH_REDIS_REST_URL` | From Upstash Redis (rate limits across serverless). |
| `UPSTASH_REDIS_REST_TOKEN` | Same. |
| Existing Clerk / DB / Resend / Blob vars | Keep as today; Blob store should be **Private** for new uploads. |

Without Upstash, the app falls back to **in-memory** limits (OK locally; weak on multi-instance Vercel).

---

## 3. Upstash Redis (recommended for Production)

1. Create a free Redis DB at [upstash.com](https://upstash.com).
2. Copy **REST URL** and **REST TOKEN** into Vercel as above.
3. Redeploy after saving.

---

## 4. Vercel Blob — private photos

1. In Vercel → Storage → Blob: use a **Private** store connected to this project.
2. New uploads use `access: "private"` and are served only via `/api/attachments/:id/file` (signed-in).
3. Older public Blob URLs still try to load through that route when possible; re-upload photos if any fail after cutover.

---

## 5. After merge — smoke checklist

1. Open Production URL → landing shows **Sign in** (no public “Create account” CTA).
2. Sign in as Admin → Team → onboard a test email → invite email arrives → claim via link.
3. Sign in as that user → workspace loads.
4. Uninvited new Clerk user → API should return **403 Invitation required**.
5. Upload a photo on an asset → image displays while signed in.
6. Open DevTools → Response headers include `X-Content-Type-Options`, `Content-Security-Policy`, etc.
7. Delete a Team member who had signed in → they cannot sign back into the app (Clerk user removed).

---

## 6. Deploy this branch without touching live yet

```text
git push -u origin feat/api/phase-0-guardrails
```

Then open a **Pull Request** into `main`. Review the Vercel **Preview** URL. Merge only when smoke passes.

Do **not** merge until Clerk invite-only and `APP_URL` are set for Production.
