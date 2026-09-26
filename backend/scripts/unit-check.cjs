const crypto = require('crypto');

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    console.log(`FAIL ${name}: ${e.message}`);
    process.exitCode = 1;
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function verifyStripe(raw, secret, header) {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const t = Number(parts.t);
  const v1 = parts.v1 || '';
  if (!t || !v1 || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${raw.toString('utf8')}`).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(v1).trim(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const raw = Buffer.from('{"id":"evt_1"}', 'utf8');
const secret = 'whsec_test';
const t = Math.floor(Date.now() / 1000);
const v1 = crypto.createHmac('sha256', secret).update(`${t}.${raw.toString('utf8')}`).digest('hex');
check('stripe valid signature', () => assert(verifyStripe(raw, secret, `t=${t},v1=${v1}`), 'should verify'));
check('stripe wrong secret', () => assert(!verifyStripe(raw, 'other', `t=${t},v1=${v1}`), 'should reject'));
check('stripe stale timestamp', () => assert(!verifyStripe(raw, secret, `t=${t - 9999},v1=${v1}`), 'should reject replay'));

function verifyHmac(body, s, sig) {
  const expected = crypto.createHmac('sha256', s).update(body).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(sig).trim(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Mirror of CredentialsService.verifyWebhookSignature (replay-protected scheme).
function toSeconds(header) {
  const parsed = Number(header);
  if (!header || !Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed > 1e12 ? Math.floor(parsed / 1000) : Math.floor(parsed);
}
function checkTimestampWindow(header, nowMs = Date.now(), toleranceSec = 300) {
  const sec = toSeconds(header);
  if (sec === null) return 'missing_timestamp';
  if (Math.abs(Math.floor(nowMs / 1000) - sec) > toleranceSec) return 'stale_timestamp';
  return 'ok';
}
function verifyWebhookSignature(header, body, secret, signature, nowMs = Date.now(), toleranceSec = 300) {
  const window = checkTimestampWindow(header, nowMs, toleranceSec);
  if (window !== 'ok') return window;
  const sec = toSeconds(header);
  const signed = Buffer.concat([Buffer.from(`${sec}.`, 'utf8'), body]);
  const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature).trim(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? 'ok' : 'bad_signature';
}

const body = Buffer.from('{"metricType":"custom","key":"k","value":1}', 'utf8');
const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
const nowSec = Math.floor(Date.now() / 1000);
const goodSig = (t) => crypto.createHmac('sha256', secret).update(`${t}.${body.toString('utf8')}`).digest('hex');

check('webhook valid hmac', () => assert(verifyHmac(body, secret, sig), 'should verify'));
check('webhook tampered body', () => assert(!verifyHmac(Buffer.from('{}', 'utf8'), secret, sig), 'should reject'));
check('webhook timestamped signature ok', () =>
  assert(verifyWebhookSignature(String(nowSec), body, secret, goodSig(nowSec)) === 'ok', 'should verify'));
check('webhook missing timestamp rejected', () =>
  assert(verifyWebhookSignature(undefined, body, secret, goodSig(nowSec)) === 'missing_timestamp', 'should require timestamp'));
check('webhook stale timestamp rejected even when signature is valid', () =>
  assert(verifyWebhookSignature(String(nowSec - 600), body, secret, goodSig(nowSec - 600)) === 'stale_timestamp', 'should reject replay'));
check('webhook future timestamp rejected', () =>
  assert(verifyWebhookSignature(String(nowSec + 600), body, secret, goodSig(nowSec + 600)) === 'stale_timestamp', 'should reject future'));
check('webhook tampered body with fresh timestamp rejected', () =>
  assert(verifyWebhookSignature(String(nowSec), Buffer.from('{"x":1}', 'utf8'), secret, goodSig(nowSec)) === 'bad_signature', 'should reject'));

const key = crypto.randomBytes(32);
function enc(pt) {
  const iv = crypto.randomBytes(12);
  const ci = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([ci.update(pt, 'utf8'), ci.final()]);
  return `v1:${iv.toString('base64')}:${ci.getAuthTag().toString('base64')}:${ct.toString('base64')}`;
}
function dec(p) {
  const parts = p.split(':');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'base64'));
  d.setAuthTag(Buffer.from(parts[2], 'base64'));
  return d.update(Buffer.from(parts[3], 'base64'), undefined, 'utf8') + d.final('utf8');
}
check('credentials encrypt round-trip', () => {
  const pt = JSON.stringify({ apiKey: 'rk_live_abc', webhookSecret: 'whsec_x' });
  assert(dec(enc(pt)) === pt, 'round-trip mismatch');
});
check('credentials tamper detected', () => {
  const bad = `${enc('x').slice(0, -4)}AAAA`;
  let threw = false;
  try { dec(bad); } catch (e) { threw = true; }
  assert(threw, 'tampered ciphertext must throw');
});

const MAJOR = (cents) => Math.round((cents / 100) * 100) / 100;
check('stripe cents to major units', () => assert(MAJOR(2500) === 25, '2500c should be 25'));
console.log('unit checks done');
