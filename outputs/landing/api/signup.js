// POST /api/signup  { name, email }
// Supabase signups 표에 저장한 뒤 Resend로 확인 메일을 보낸다. 키는 환경변수(로컬은 .env)에서만 읽는다.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = typeof req.body === 'string' ? req.body : '';
  if (!raw) for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

async function sendConfirmation({ name, email }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: 'no_key' };

  // 테스트 모드: onboarding@resend.dev는 Resend 가입 이메일로만 보낼 수 있다.
  const testTo = (process.env.TEST_RECIPIENT || '').trim().toLowerCase();
  if (testTo && email.toLowerCase() !== testTo) return { sent: false, reason: 'test_mode_skip' };

  const from = process.env.RESEND_FROM || '함께닿 <onboarding@resend.dev>';
  const html = `<div style="font-family:'Noto Sans KR',Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#FFF1D6;color:#1F3A5F">
  <h2 style="margin:0 0 12px">${escapeHtml(name)}님, 신청이 완료됐어요 🎉</h2>
  <p>함께닿 사전 신청해 주셔서 고마워요.<br>출시되면 가장 먼저 소식을 보내 드릴게요.</p>
  <p style="color:#FF6B5B;font-weight:bold">혼자 떠나도, 마음은 닿는다</p>
  <p style="font-size:12px;opacity:.7">본인이 신청하지 않았다면 이 메일에 회신해 알려 주세요. 바로 삭제해 드려요.</p>
</div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [email], subject: '[함께닿] 사전 신청이 완료됐어요', html })
  });
  return r.ok ? { sent: true } : { sent: false, reason: `resend_${r.status}` };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'method_not_allowed' });
  }

  const body = await readBody(req);
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  if (!name || name.length > 100 || email.length > 254 || !EMAIL_RE.test(email)) {
    return send(res, 400, { error: 'invalid_input' });
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return send(res, 500, { error: 'server_not_configured' });

  const ins = await fetch(`${SUPABASE_URL}/rest/v1/signups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ name, email })
  });
  if (ins.status === 409) return send(res, 409, { error: 'duplicate' });
  if (!ins.ok) return send(res, 502, { error: 'save_failed' });

  // 저장이 끝난 신청은 메일이 실패해도 성공으로 처리한다.
  let mail = { sent: false, reason: 'error' };
  try { mail = await sendConfirmation({ name, email }); } catch { /* 메일 실패는 신청 성공을 막지 않음 */ }
  return send(res, 201, { ok: true, mail: mail.sent });
};
