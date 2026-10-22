// POST /api/inquiry  { name, email, message }
// Supabase inquiries 표에 저장한 뒤 Resend로 접수 확인 메일(과 관리자 알림)을 보낸다. 키는 환경변수(로컬은 .env)에서만 읽는다.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = typeof req.body === 'string' ? req.body : '';
  if (!raw) for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

async function resend(payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.RESEND_FROM || '함께닿 <onboarding@resend.dev>', ...payload })
  });
  return r.ok;
}

async function sendMails({ name, email, message }) {
  if (!process.env.RESEND_API_KEY) return { confirm: false, notify: false };
  const result = { confirm: false, notify: false };

  // 테스트 모드: onboarding@resend.dev는 Resend 가입 이메일로만 보낼 수 있다.
  const testTo = (process.env.TEST_RECIPIENT || '').trim().toLowerCase();
  if (!testTo || email.toLowerCase() === testTo) {
    result.confirm = await resend({
      to: [email],
      subject: '[함께닿] 문의가 접수됐어요',
      html: `<div style="font-family:'Noto Sans KR',Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#FFF1D6;color:#1F3A5F">
  <h2 style="margin:0 0 12px">${escapeHtml(name)}님, 문의가 접수됐어요</h2>
  <p>남겨 주신 문의를 확인하고 곧 답변드릴게요.</p>
  <blockquote style="margin:12px 0;padding:10px 14px;background:#fff;border-radius:12px;white-space:pre-wrap">${escapeHtml(message)}</blockquote>
  <p style="color:#FF6B5B;font-weight:bold">혼자 떠나도, 마음은 닿는다</p>
</div>`
    });
  }

  const notifyTo = (process.env.INQUIRY_NOTIFY_TO || '').trim();
  if (notifyTo) {
    result.notify = await resend({
      to: [notifyTo],
      reply_to: email,
      subject: `[함께닿] 새 문의: ${name}`,
      html: `<p><b>${escapeHtml(name)}</b> (${escapeHtml(email)})</p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`
    });
  }
  return result;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'method_not_allowed' });
  }

  const body = await readBody(req);
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const message = String(body.message || '').trim();
  if (!name || name.length > 100 || email.length > 254 || !EMAIL_RE.test(email) || message.length < 10 || message.length > 4000) {
    return send(res, 400, { error: 'invalid_input' });
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return send(res, 500, { error: 'server_not_configured' });

  // 남용 방지: 같은 이메일로 1시간에 3건, 전체로 1분에 30건을 넘으면 거절한다(남의 이메일로 접수 확인 메일을 쏟아내는 것도 막는다).
  // 조회에는 서버 전용 키가 필요해서, 그 키가 설정된 환경에서만 적용한다.
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (svc) {
    const count = async (filter) => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/inquiries?select=id&${filter}&limit=31`, { headers: { apikey: svc, Authorization: `Bearer ${svc}` } });
      const rows = r.ok ? await r.json().catch(() => []) : [];
      return Array.isArray(rows) ? rows.length : 0;
    };
    const ago = (ms) => encodeURIComponent(new Date(Date.now() - ms).toISOString());
    if ((await count(`email=eq.${encodeURIComponent(email)}&created_at=gte.${ago(3600e3)}`)) >= 3 || (await count(`created_at=gte.${ago(60e3)}`)) >= 30) {
      return send(res, 429, { error: 'too_many_requests' });
    }
  }

  const ins = await fetch(`${SUPABASE_URL}/rest/v1/inquiries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ name, email, message })
  });
  if (!ins.ok) return send(res, 502, { error: 'save_failed' });

  // 저장이 끝난 문의는 메일이 실패해도 성공으로 처리한다.
  let mail = { confirm: false, notify: false };
  try { mail = await sendMails({ name, email, message }); } catch { /* 메일 실패는 접수 성공을 막지 않음 */ }
  return send(res, 201, { ok: true, mail: mail.confirm });
};
