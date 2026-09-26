# Incident Response Checklist (internal)

Short and plain on purpose — this needs to be usable at midnight, not
impressive. Assumes the NestJS API on Railway + TimescaleDB template
(see `backend/RAILWAY.md`).

## 1. Triage (first 15 minutes)

1. Confirm it is real: reproduce from Railway logs, not just a user report.
2. Scope it: which service (API, database, frontend hosting), which time
   window, which users/projects if any.
3. If credential or session data may be exposed, skip straight to step 2
   (rotate first, investigate second).

Where to look:

- **API logs:** Railway → API service → Deploy Logs / HTTP Logs. Grep the
  structured audit lines (`event=auth.login.failure`,
  `event=connector.ingest.rejected`, …) — repeated failures from one IP or a
  burst of `bad_signature` rejections is the usual shape of a probe.
- **Suspicious access patterns:** many `auth.login.failure` for different
  emails from one IP (credential stuffing); `oauth_state_mismatch` spikes
  (CSRF attempts); ingest rejections with `stale_timestamp` (replay attempts).
- **Database:** `SELECT * FROM pg_stat_activity` for unexpected connections;
  check for new roles or grants (`SELECT * FROM pg_roles`).

## 2. Rotate the JWT signing secret (invalidates ALL sessions)

1. Railway → API service → Variables → set `JWT_ACCESS_SECRET` to a fresh
   value: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
2. If `JWT_OAUTH_STATE_SECRET` is set explicitly, rotate it the same way
   (otherwise it derives from `JWT_ACCESS_SECRET` and rotates with it).
3. Redeploy the API service. Every access token stops verifying immediately;
   every in-flight OAuth handshake fails closed (users restart sign-in).
4. Refresh tokens: they are SHA-256 hashes in `refresh_tokens`, so they
   survive a JWT rotation — if refresh tokens themselves may be compromised,
   revoke them directly: `UPDATE refresh_tokens SET revoked_at = now()
   WHERE revoked_at IS NULL;` (forces full re-login for everyone).

## 3. Rotate database credentials

1. Railway → TimescaleDB service → Variables → reset the password (or
   `ALTER USER stackduck_app WITH PASSWORD '<new>';` from a superuser
   session for the least-privilege role).
2. Update the API service's `DATABASE_URL` to match, redeploy, confirm
   `/v1/health` is green and logins work.
3. Kill lingering sessions from the old credential:
   `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
   WHERE usename = 'stackduck_app' AND pid <> pg_backend_pid();`
   (run once after the redeploy so only pre-rotation connections die).

## 4. Rotate app-level credential encryption key (worst case)

`CREDENTIALS_ENCRYPTION_KEY` has no versioning (D29 trade-off): a lost or
exposed key means **re-encrypt is impossible** — connectors must be
reconnected. Steps: set the new key, redeploy, mark affected connectors
`error` with a rotation note, and trigger the "Reconnect your project" UI
flow. Do not fabricate secrets to fill the gap.

Also rotate, as applicable: `RESEND_API_KEY`, Google/GitHub OAuth client
secrets, `JOBS_TRIGGER_SECRET`.

## 5. Notify affected users

If credential data (connector secrets, password hashes) or personal data was
exposed — or may have been: say what happened, what data was involved, what
was rotated, and what the user should do (reconnect connectors, change a
reused password). Notify directly (email) when the set of affected users is
known; otherwise post a notice on the site. Do not wait for the full
post-mortem to send the first notice.

## 6. After

- Write the timeline down while it is fresh (what, when, who was affected).
- File the fix as a private Security Advisory first, public disclosure after
  the patch is deployed (see `SECURITY.md`).
- Record the date of the last verified backup-restore test in
  `backend/RAILWAY.md` §6 — an incident is the most expensive possible
  reminder that unverified backups are fiction.
