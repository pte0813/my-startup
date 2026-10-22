// 결제 서버 함수들이 함께 쓰는 도구. 비밀 키(NICEPAY_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY)는 서버 환경변수에서만 읽는다.
const crypto = require('crypto');

const env = () => ({
  supabaseUrl: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  clientId: process.env.NICEPAY_CLIENT_ID,
  secretKey: process.env.NICEPAY_SECRET_KEY,
  sandbox: (process.env.NICEPAY_ENV || 'sandbox') !== 'production',
  baseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '')
});

const configured = (e) => !!(e.supabaseUrl && e.anonKey && e.serviceKey && e.clientId && e.secretKey);
const nicepayHost = (e) => (e.sandbox ? 'https://sandbox-api.nicepay.co.kr' : 'https://api.nicepay.co.kr');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = typeof req.body === 'string' ? req.body : '';
  if (!raw) for await (const chunk of req) raw += chunk;
  const type = String(req.headers['content-type'] || '');
  if (type.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

// service_role 키로 호출하는 Supabase REST (RLS를 우회하므로 서버에서만 사용)
const db = (e) => {
  const headers = { apikey: e.serviceKey, Authorization: `Bearer ${e.serviceKey}`, 'Content-Type': 'application/json' };
  const call = async (method, path, body, extra) => {
    const r = await fetch(`${e.supabaseUrl}/rest/v1/${path}`, { method, headers: { ...headers, ...extra }, body: body ? JSON.stringify(body) : undefined });
    let data = null;
    try { data = await r.json(); } catch { /* 본문 없음 */ }
    return { ok: r.ok, status: r.status, data };
  };
  return {
    select: (path) => call('GET', path),
    insert: (table, row) => call('POST', table, row, { Prefer: 'return=representation' }),
    update: (path, row) => call('PATCH', path, row, { Prefer: 'return=representation' }),
    upsert: (table, row, conflict) => call('POST', `${table}?on_conflict=${conflict}`, row, { Prefer: 'resolution=merge-duplicates,return=minimal' })
  };
};

// 로그인한 회원의 access token으로 본인 확인
async function verifyUser(e, authHeader) {
  const token = String(authHeader || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const r = await fetch(`${e.supabaseUrl}/auth/v1/user`, { headers: { apikey: e.anonKey, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

const basicAuth = (e) => 'Basic ' + Buffer.from(`${e.clientId}:${e.secretKey}`).toString('base64');

module.exports = { env, configured, nicepayHost, sha256, safeEqual, json, readBody, db, verifyUser, basicAuth };
