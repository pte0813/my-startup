// 문의하기 서버리스 함수 (Vercel, Node). 문의 내용을 Resend로 이메일 발송한다.
// 환경변수: RESEND_API_KEY(필수), CONTACT_TO_EMAIL(필수), CONTACT_FROM_EMAIL(선택, 기본 onboarding@resend.dev)
const { Resend } = require('resend');

const LIMITS = { name: 100, email: 254, message: 2000 };
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  const b = req.body;
  if (b && typeof b === 'object') return b;
  if (typeof b === 'string') { try { return JSON.parse(b); } catch { return null; } }
  return null;
}

function str(v) { return typeof v === 'string' ? v : ''; }

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { ok: false, error: '허용되지 않는 요청입니다.' });
  }

  const body = parseBody(req);
  if (!body) return send(res, 400, { ok: false, error: '요청 형식이 올바르지 않습니다.' });

  // 스팸 방지: 사람에게 보이지 않는 칸(website)이 채워져 있으면 봇으로 보고, 보내지 않고 성공처럼 응답한다.
  if (str(body.website).trim() !== '') return send(res, 200, { ok: true });

  const name = str(body.name).trim();
  const email = str(body.email).trim();
  const message = str(body.message).trim();

  if (!name) return send(res, 400, { ok: false, error: '이름을 입력해 주세요.' });
  if (name.length > LIMITS.name) return send(res, 400, { ok: false, error: `이름은 ${LIMITS.name}자 이내로 입력해 주세요.` });
  if (/[\r\n]/.test(name)) return send(res, 400, { ok: false, error: '이름에 줄바꿈을 넣을 수 없습니다.' });
  if (!email || email.length > LIMITS.email || !EMAIL_RE.test(email)) {
    return send(res, 400, { ok: false, error: '이메일 주소를 확인해 주세요.' });
  }
  if (!message) return send(res, 400, { ok: false, error: '문의 내용을 입력해 주세요.' });
  if (message.length > LIMITS.message) {
    return send(res, 400, { ok: false, error: `문의 내용은 ${LIMITS.message}자 이내로 입력해 주세요.` });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL || 'onboarding@resend.dev';
  if (!apiKey || !to) {
    console.error('contact: RESEND_API_KEY 또는 CONTACT_TO_EMAIL 환경변수가 설정되지 않았습니다.');
    return send(res, 500, { ok: false, error: '문의 접수 설정이 아직 끝나지 않았습니다. 잠시 후 다시 시도해 주세요.' });
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: email,
      subject: `[X 문의] ${name}`,
      text: `이름: ${name}\n이메일: ${email}\n\n${message}`,
      html: `<p><strong>이름</strong> ${escapeHtml(name)}<br><strong>이메일</strong> ${escapeHtml(email)}</p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
    });
    if (error) {
      console.error('contact: Resend 발송 실패', error.name || '', error.message || '');
      return send(res, 502, { ok: false, error: '문의를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.' });
    }
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error('contact: 예외', e && e.message);
    return send(res, 502, { ok: false, error: '문의를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  }
};
