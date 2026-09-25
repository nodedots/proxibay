/**
 * Full local shakedown — one command, asserts each step, prints PASS/FAIL.
 *
 *   docker compose -f backend/docker-compose.yml up -d
 *   cd backend
 *   $env:JOBS_TRIGGER_SECRET="dev-trigger-secret"; npm run start:dev
 *   node scripts/local-shakedown.mjs
 *
 * Optional: $env:ALERT_TO="you@example.com" also creates an email rule and
 * exercises the Resend delivery path (needs RESEND_API_KEY on the API).
 */
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';

const API = process.env.API_BASE ?? 'http://localhost:3001';
const TRIGGER_SECRET = process.env.JOBS_TRIGGER_SECRET ?? '';
const ALERT_TO = process.env.ALERT_TO ?? '';
const KEY = `smoke_events_${Date.now().toString(36)}`;
const VALUE = 42;
const THRESHOLD = 10;

let failures = 0;
function step(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

async function call(path, { method = 'GET', token, body, headers = {} } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

export { call, step, failures as failureCount, API, TRIGGER_SECRET, ALERT_TO, KEY, VALUE, THRESHOLD };
export function finish(failuresCount) {
  console.log(`\n${failuresCount === 0 ? 'ALL STEPS PASSED' : `${failuresCount} STEP(S) FAILED`}`);
  process.exit(failuresCount === 0 ? 0 : 1);
}
