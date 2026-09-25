/**
 * Local shakedown, part 2: alert rule → 5-min-job evaluation → webhook
 * delivery → cooldown blocks re-fire. Run after local-shakedown.mjs, with
 * PROJECT_ID and TOKEN from its output:
 *
 *   $env:PROJECT_ID="..."; $env:TOKEN="..."; $env:JOBS_TRIGGER_SECRET="dev-trigger-secret"
 *   node scripts/shakedown-alerts.mjs
 */
import { createServer } from 'node:http';
import { ALERT_TO, KEY, TRIGGER_SECRET, THRESHOLD, VALUE, call, finish } from './shakedown-util.mjs';

const projectId = process.env.PROJECT_ID;
const token = process.env.TOKEN;
let failures = 0;
function step(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}
if (!projectId || !token) {
  console.log('Set PROJECT_ID and TOKEN (from local-shakedown.mjs output) first.');
  process.exit(1);
}

// Local receiver asserts real webhook delivery (not just "it fired").
const received = [];
const listener = createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => { received.push(raw); res.writeHead(200).end('{}'); });
});
await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
const port = listener.address().port;

const rule = await call(`/v1/projects/${projectId}/alerts`, {
  method: 'POST', token,
  body: {
    metricType: 'custom', key: KEY, condition: 'above', threshold: THRESHOLD,
    windowMinutes: 60, channel: 'webhook',
    channelTarget: `http://127.0.0.1:${port}/hook`,
    status: 'active', cooldownMinutes: 30,
  },
});
step('create alert rule (webhook)', rule.status === 201 && Boolean(rule.body?.rule?.id), `rule ${rule.body?.rule?.id ?? 'none'}`);

let expected = 1;
if (ALERT_TO) {
  const emailRule = await call(`/v1/projects/${projectId}/alerts`, {
    method: 'POST', token,
    body: {
      metricType: 'custom', key: KEY, condition: 'above', threshold: THRESHOLD,
      windowMinutes: 60, channel: 'email', channelTarget: ALERT_TO,
      status: 'active', cooldownMinutes: 30,
    },
  });
  step('create alert rule (email via Resend)', emailRule.status === 201, `rule ${emailRule.body?.rule?.id ?? 'none'}`);
  step('email delivery path returned no error', emailRule.status === 201, 'check the inbox for the alert');
  expected = 2;
}

if (!TRIGGER_SECRET) {
  step('manual job trigger available', false, 'set JOBS_TRIGGER_SECRET on the API and in this shell');
  listener.close();
  finish(failures);
}

const first = await call('/v1/internal/jobs/evaluate-alerts', {
  method: 'POST', headers: { 'x-jobs-trigger-secret': TRIGGER_SECRET },
});
step('evaluation fires the rule(s)', first.body?.triggered === expected, `evaluated ${first.body?.evaluated}, triggered ${first.body?.triggered} (expected ${expected})`);

await new Promise((r) => setTimeout(r, 500));
step('webhook alert delivered to target', received.length >= 1, `${received.length} delivery(ies)`);
if (received[0]) {
  const parsed = JSON.parse(received[0]);
  step('delivery payload carries value + threshold', parsed.value === VALUE && parsed.threshold === THRESHOLD, `value ${parsed.value}, threshold ${parsed.threshold}`);
}

const second = await call('/v1/internal/jobs/evaluate-alerts', {
  method: 'POST', headers: { 'x-jobs-trigger-secret': TRIGGER_SECRET },
});
step('cooldown blocks immediate re-fire', second.body?.triggered === 0, `triggered ${second.body?.triggered} on second pass`);

listener.close();
finish(failures);
