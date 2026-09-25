/**
 * Local shakedown, part 1: auth → project → webhook connector → signed
 * ingest → metrics read-back. Part 2 (alerts/cooldown) in shakedown-alerts.mjs.
 *
 * Run: node scripts/local-shakedown.mjs
 */
import { createHmac } from 'node:crypto';
import { API, KEY, VALUE, call, finish } from './shakedown-util.mjs';

let failures = 0;
function step(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

// 0. Health
const health = await call('/v1/health');
step('API reachable + healthy', health.status === 200 && health.body?.ok === true, `status ${health.status}`);
if (health.status !== 200) {
  console.log('\nStart the API first: npm run start:dev (and the DB via docker compose).');
  process.exit(1);
}

// 1. Register
const email = `smoke+${Date.now()}@example.com`;
const reg = await call('/v1/auth/register', {
  method: 'POST',
  body: { email, password: 'smoke-test-password-123', consent: true, displayName: 'Smoke Test' },
});
const token = reg.body?.accessToken;
step('register a user', reg.status === 201 && Boolean(token), `status ${reg.status}`);
if (!token) { console.log(JSON.stringify(reg.body)); finish(1); }

// 2. Create project
const created = await call('/v1/projects', { method: 'POST', token, body: { name: `Smoke ${new Date().toISOString()}` } });
const projectId = created.body?.project?.id;
step('create a project', created.status === 201 && Boolean(projectId), `project ${projectId ?? 'none'}`);
if (!projectId) { console.log(JSON.stringify(created.body)); finish(1); }

// 3. Attach generic-webhook connector
const conn = await call(`/v1/projects/${projectId}/connectors/generic-webhook`, { method: 'POST', token, body: {} });
const connectorId = conn.body?.connector?.id;
const signingSecret = conn.body?.signingSecret;
const ingestUrl = conn.body?.ingestUrl;
step('attach Generic Webhook connector', Boolean(connectorId && signingSecret), `connector ${connectorId ?? 'none'}`);
step('connector starts pending (push flips on first event)', conn.body?.connector?.status === 'pending', `status ${conn.body?.connector?.status}`);
if (!connectorId) { console.log(JSON.stringify(conn.body)); finish(1); }

// 4. Signed ingest (+ negative case)
const payload = JSON.stringify({ metricType: 'custom', key: KEY, value: VALUE, metadata: { source: 'shakedown' } });
const signature = createHmac('sha256', signingSecret).update(payload).digest('hex');
const good = await fetch(`${API}/v1/ingest/${connectorId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Stackduck-Signature': signature },
  body: payload,
});
const goodBody = await good.json().catch(() => null);
step('signed ingest accepted (202)', good.status === 202 && goodBody?.accepted === 1, `status ${good.status}, accepted ${goodBody?.accepted}`);

const bad = await fetch(`${API}/v1/ingest/${connectorId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Stackduck-Signature': 'deadbeef' },
  body: payload,
});
step('tampered signature rejected (401)', bad.status === 401, `status ${bad.status}`);

// 5. Read back through the metrics endpoint (time_bucket rollup)
const from = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
const to = new Date().toISOString().slice(0, 10);
const metrics = await call(`/v1/projects/${projectId}/metrics?metricType=custom&key=${KEY}&from=${from}&to=${to}`, { token });
const sum = metrics.body?.buckets?.reduce((acc, b) => acc + (b.dailyAggregate?.sum ?? 0), 0) ?? 0;
const points = metrics.body?.buckets?.flatMap((b) => b.points ?? []) ?? [];
step('metric point read back via daily rollup', metrics.status === 200 && sum === VALUE, `sum ${sum} (expected ${VALUE})`);
step('raw point present in bucket', points.length >= 1, `${points.length} point(s)`);

console.log(`\nCONTEXT projectId=${projectId} token=${token.slice(0, 12)}…`);
finish(failures);
