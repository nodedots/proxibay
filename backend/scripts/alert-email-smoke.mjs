/**
 * Real Resend send — proves the alert email path end-to-end, not just that it compiles.
 *
 *   cd backend
 *   $env:RESEND_API_KEY="re_..."; $env:ALERT_FROM_EMAIL="Stackduck <alerts@yourdomain>"; $env:ALERT_TO="you@example.com"
 *   node scripts/alert-email-smoke.mjs
 *
 * Exits non-zero if Resend returns an error, so this can gate a deploy check.
 */
import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.ALERT_FROM_EMAIL ?? 'Stackduck <onboarding@resend.dev>';
const to = process.env.ALERT_TO;

if (!apiKey) {
  console.error('FAIL: RESEND_API_KEY is not set — cannot send. (Local dev without a key logs instead of sending by design.)');
  process.exit(1);
}
if (!to) {
  console.error('FAIL: ALERT_TO is not set (the recipient address for the smoke test).');
  process.exit(1);
}

// Same shape/subject/html the AlertsService email channel builds.
const rule = {
  id: 'smoke-rule',
  projectId: 'smoke-project',
  metricType: 'error_metrics',
  key: 'error_count',
  condition: 'above',
  threshold: 10,
  windowMinutes: 15,
};
const value = 42;
const direction = rule.condition === 'above' ? 'rose above' : 'fell below';
const subject = `Stackduck alert: ${rule.key} ${direction} ${rule.threshold} (now ${value})`;
const html = [
  `<p>Your <strong>${rule.metricType} / ${rule.key}</strong> ${direction} its threshold.</p>`,
  `<p>Value: <strong>${value}</strong> · Threshold: <strong>${rule.threshold}</strong> · Window: last ${rule.windowMinutes} minutes.</p>`,
  `<p style="color:#666">Smoke test · Project ${rule.projectId} · Rule ${rule.id} · ${new Date().toISOString()}</p>`,
].join('');

const resend = new Resend(apiKey);
const { data, error } = await resend.emails.send({ from, to: [to], subject, html });

if (error) {
  console.error(`FAIL: Resend rejected the send: ${error.message}`);
  process.exit(1);
}
console.log(`PASS: alert email accepted by Resend (id ${data?.id}) → delivered to ${to}`);
console.log('Check the inbox (and spam). If nothing arrives, verify the sending domain in Resend — onboarding@resend.dev only delivers to the account owner.');
