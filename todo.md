# todo.md — _vaultr Session Log

## Last Updated: 2026-07-12

---

## ✅ Completed This Session

### Security Audit + Fixes (Full Pass)

**Phase 1 — Critical Infrastructure**
- [x] M-1: Added full HTTP security headers to `next.config.ts` (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- [x] L-1: Added `test_credentials.md` to `.gitignore`
- [x] L-6: Created `public/robots.txt` blocking `/admin`, `/vault`, `/settings`, `/api/`
- [x] L-4: Renamed `db:push --force` → `db:push:dev` in `package.json`
- [x] L-5: Created `src/lib/safeError.ts` + patched 4 API routes that leaked raw error messages in production
- [x] C-4: Fixed wildcard CORS — removed `"http://192.168.*"` patterns, replaced with `TRUSTED_ORIGINS` env var
- [x] H-4: OTP log wrapped in `NODE_ENV !== "production"` guard
- [x] L-2: Session reduced from 30 days → 7 days

**Phase 2 — API Hardening**
- [x] H-1: Added Zod validation to `POST /api/vault/items` and `PATCH /api/vault/items/[id]`
- [x] H-2: Fixed reencrypt DoS — max 5000 items, UUID validation, 500-item batch chunking
- [x] H-3: Avatar upload now enforces MIME type + extension allowlist (jpeg/png/webp/gif only)
- [x] M-5: Admin user list capped at 200 results, profile fetch optimized to page-only via inArray
- [x] M-4: Created `src/lib/getClientIp.ts` — validated IP extraction, patched admin DB route
- [x] L-3: Webhook URL cached in-module with 5-min TTL, invalidated on admin config save
- [x] L-7: `verifyUserToken` now checks `userProfiles.disabled` flag — disabled users get 403

**Phase 3 — Rate Limiting**
- [x] C-1: Created `src/middleware.ts` — per-IP in-memory rate limiter:
  - Sign-in: 10 req/15min
  - Sign-up: 5 req/hr
  - OTP/2FA: 5 req/10min
  - General API: 120 req/min
  - Returns 429 with `Retry-After` and `X-RateLimit-*` headers

**Phase 4 — DB Migration + Admin UI**
- [x] C-2: Added `require_email_verification` boolean to `config_system` table (migration applied)
- [x] C-2: `auth.ts` — `requireEmailVerification: true` permanently; `sendVerificationEmail` hook auto-verifies when DB toggle is OFF
- [x] C-2: Admin system API reads/writes `requireEmailVerification`
- [x] C-2: Admin panel System Operations page has new "Require Email Verification" toggle

**Decisions / Intentionally Skipped:**
- C-3: Admin can read account/session tables (owner-only access, intentional)
- H-5: Disabled admin check not added (single-owner deployment)
- M-2: Filesystem audit logs are kept (intentional for this project)
- M-3: Session tokens in DB browser left as-is (owner-only access)
- M-6: No password confirmation on account delete (intentional UX decision)
- M-7: SMTP credentials not encrypted at rest (deferred)

---

## 🔜 Next Steps / Open Issues

### High Priority
- [x] Wire up real email sending for email verification (using templated email dispatch)
- [x] Wire up real OTP email sender for 2FA (using templated email dispatch)
- [ ] Replace in-memory rate limiter with Redis/Upstash for multi-process/edge deployments

### Medium Priority
- [ ] Encrypt SMTP password at rest in DB (M-7 — deferred)
- [x] Add `HSTS` header (`Strict-Transport-Security`) for production HTTPS deployments
- [x] Add magic bytes verification to avatar upload (checked for jpeg, png, gif, webp signature headers)

### Low Priority
- [ ] Audit log retention policy (auto-delete logs older than N days)
- [ ] Add `npm audit fix` to CI to track known dependency vulnerabilities (10 found during zod install)
- [ ] Add E2E tests for rate limiting, Zod validation responses, disabled user flow

---

## Files Modified This Session

| File | Change |
|------|--------|
| `next.config.ts` | HTTP security headers |
| `.gitignore` | test_credentials.md |
| `public/robots.txt` | NEW — crawler exclusions |
| `package.json` | db:push renamed |
| `src/lib/safeError.ts` | NEW |
| `src/lib/getClientIp.ts` | NEW |
| `src/lib/webhook.ts` | webhook URL caching |
| `src/lib/auth/auth.ts` | CORS, OTP guard, session TTL, email verification hook |
| `src/lib/auth/verifyUser.ts` | disabled flag check |
| `src/middleware.ts` | NEW — rate limiting |
| `src/db/schema.ts` | requireEmailVerification column |
| `src/app/api/vault/items/route.ts` | Zod validation |
| `src/app/api/vault/items/[id]/route.ts` | Zod validation |
| `src/app/api/vault/items/reencrypt/route.ts` | array limits + batching |
| `src/app/api/settings/avatar/route.ts` | MIME allowlist |
| `src/app/api/settings/set-password/route.ts` | safeError |
| `src/app/api/settings/delete-account/route.ts` | safeError |
| `src/app/api/admin/users/route.ts` | pagination cap + inArray fix |
| `src/app/api/admin/email/route.ts` | safeError |
| `src/app/api/admin/email/broadcast/route.ts` | safeError |
| `src/app/api/admin/system/route.ts` | requireEmailVerification + cache invalidation |
| `src/app/api/admin/database/[table]/[id]/route.ts` | getClientIp |
| `src/app/admin/system/page.tsx` | email verification toggle UI |
| `drizzle/migrations/0005_awesome_dust.sql` | NEW — DB migration |
| `.env.example` | TRUSTED_ORIGINS documented |
