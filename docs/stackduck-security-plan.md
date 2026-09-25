# Stackduck — Security Plan (NestJS/Postgres Architecture)

Written after the pivot decision from Firebase to a self-managed NestJS + PostgreSQL/TimescaleDB backend. Firebase was quietly providing a lot of security infrastructure for free — managed auth, encryption at rest, DDoS mitigation, automatic patching. This plan covers what now has to be owned deliberately instead of inherited.

## 1. Authentication & Session Security

- **Password storage:** bcrypt (cost factor 12+) via `passport-local` — never plaintext, never a weaker hash (MD5/SHA1)
- **JWT strategy:** short-lived access tokens (15 min) + longer-lived refresh tokens (7-30 days), refresh tokens stored hashed in Postgres so a leaked database dump doesn't hand out usable tokens directly
- **Refresh token rotation:** issue a new refresh token on every use, invalidate the old one — limits the damage window if a refresh token is ever stolen
- **OAuth (Google/GitHub):** validate state parameter on callback to prevent CSRF during the OAuth handshake; never trust the OAuth provider's returned email as pre-verified without checking the provider's own `email_verified` flag where available
- **Rate limit login/signup endpoints specifically** (separate from general API rate limiting) — brute-force protection on the auth endpoints matters more than on read endpoints
- **Account enumeration:** login/signup error messages should not reveal whether an email exists in the system ("invalid email or password," not "no account found")

## 2. Data Protection

- **Encryption in transit:** HTTPS enforced everywhere, HSTS header set, no HTTP fallback
- **Encryption at rest:** connector credentials (service account JSON, API keys, OAuth tokens) must be encrypted before storage, not stored as plaintext columns — either application-level encryption (e.g. `pgcrypto`, or a library like `@nestjs/config` + a KMS-backed key) or continue using Google Secret Manager standalone (it works independently of Firestore) as decided in the pivot plan
- **Database-level encryption at rest:** whatever Postgres host is chosen (Railway, Fly.io, etc.) should have disk-level encryption at rest enabled — confirm this is on by default for the chosen provider, don't assume
- **Backups:** encrypted backups, tested restore process — a backup that's never been restored isn't a real backup

## 3. API & Network Security

- **Helmet-equivalent headers** (`@nestjs/helmet` or manual header config): CSP, X-Frame-Options, X-Content-Type-Options, etc.
- **CORS:** explicit allowlist of the actual frontend origin(s), not a wildcard `*`
- **Rate limiting** via `@nestjs/throttler` on all public endpoints, with stricter limits on auth and ingest endpoints specifically
- **Input validation** on every endpoint via `class-validator`/`class-transformer` DTOs — never trust client input shape, especially on the connector ingest endpoints which accept arbitrary external payloads
- **SQL injection:** TypeORM's parameterized queries protect against this by default — audit for any raw SQL string concatenation if it exists anywhere and eliminate it

## 4. Connector & Credential Security (carrying forward existing decisions)

- **Firebase connector:** Firebase Viewer-tier service account, read-only
- **Stripe connector:** restricted API key, read-only scopes only
- **GitHub repo import:** GitHub App with explicitly read-only repository permissions (per the earlier security correction) — not the classic write-capable `repo` OAuth scope
- **GCP project import:** read-only Cloud Resource Manager scope
- **Supabase connector:** service_role key is NOT structurally read-only — this remains an honest, disclosed exception (per the Security page plan), not something to paper over
- **Webhook signature verification:** HMAC-SHA256 for the Generic Webhook connector, Stripe's own signature scheme for Stripe — both already specified, must be preserved exactly in the NestJS port, implemented as Nest guards so they can't accidentally be bypassed by a future route

## 5. Ingest Endpoint Hardening

- **Replay protection:** consider a timestamp check on incoming webhook payloads (reject anything older than a few minutes) alongside signature verification, to reduce replay-attack surface
- **Payload size limits:** cap request body size on ingest endpoints — an unbounded payload is a cheap DoS vector
- **Per-connector rate limiting:** already planned in the Generic Webhook spec; carry this into the Nest implementation via `@nestjs/throttler` scoped per connectorId, not just globally

## 6. Infrastructure & Operational Security

- **Dependency updates:** enable Dependabot (or Renovate) on the GitHub repo now that it's open source — a public repo with known outdated dependencies is a visible attack surface
- **Secrets in deployment:** environment variables for DB credentials, JWT signing secrets, OAuth client secrets — never committed to the repo (confirm `.env` is gitignored, add a `.env.example` with dummy values for contributors)
- **Least-privilege database user:** the app's Postgres user should have only the permissions it needs, not a superuser role
- **Logging:** log authentication events (login, failed login, password reset) and connector connection events, but never log raw credentials, tokens, or full request bodies containing secrets
- **Dependency audit:** run `npm audit` (or equivalent) as part of CI, not just occasionally by hand

## 7. Vulnerability Disclosure

- Since Stackduck is open source, add a `SECURITY.md` to the repo root with:
  - How to report a vulnerability (private channel — GitHub Security Advisories' private reporting feature, not a public issue)
  - Expected response time (be honest given solo-maintainer bandwidth)
- This pairs with the Security page on the site already planned (connector-by-connector transparency)

## 8. Incident Response (lightweight, solo-maintainer scale)

- A basic plan for "what do I actually do if something is compromised": rotate JWT signing secret (invalidates all sessions), rotate database credentials, check logs for the access pattern, notify affected users if credential data was exposed — doesn't need to be elaborate, just needs to exist as a written checklist rather than being figured out during a live incident

## 9. Open Items From This Plan

- [ ] Decide credential-encryption approach for Postgres (app-level encryption vs. standalone Secret Manager) — flagged in the pivot plan, still unresolved
- [ ] Choose and configure a Postgres hosting provider with confirmed encryption-at-rest
- [ ] Write the actual `SECURITY.md` and repo-root security policy
- [ ] Set up Dependabot/Renovate on the GitHub repo
