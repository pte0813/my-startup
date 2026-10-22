// POST /api/account  { action: 'export' | 'delete', confirm? }   (Authorization: Bearer <로그인 회원의 access token>)
// 개인정보 열람(내 데이터 내려받기)과 회원 탈퇴(삭제)를 처리한다. service_role 키는 서버에서만 쓴다.
// - export: 내 프로필·신청·결제·후기·제안·재만남 선택·문의 내역을 JSON으로 돌려준다(다른 회원의 정보는 포함하지 않는다).
// - delete: 확인용으로 본인 이메일을 다시 입력해야 한다. 업로드한 후기 사진과 같은 이메일로 접수된 문의를 지우고 계정을 삭제하면
//   프로필·신청·후기·제안·재만남 선택·AI 사용 기록이 함께 삭제된다. 결제 기록은 법정 보관 의무(전자상거래법 5년)로 회원 연결만 끊고 남긴다.
const { env, json, readBody, db, verifyUser } = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'method_not_allowed' }); }
  const e = env();
  if (!(e.supabaseUrl && e.anonKey && e.serviceKey)) return json(res, 503, { error: 'not_configured' });
  const user = await verifyUser(e, req.headers.authorization);
  if (!user) return json(res, 401, { error: 'unauthorized' });

  const body = await readBody(req);
  const store = db(e);
  const email = String(user.email || '');

  if (body.action === 'export') {
    const rows = async (path) => { const r = await store.select(path); return r.ok && Array.isArray(r.data) ? r.data : []; };
    const [profile, applications, payments, reviews, suggestions, picks, inquiries] = await Promise.all([
      rows(`profiles?select=name,mbti,interests,travel_styles,active_times,ai_consent,ai_consent_at,privacy_consent_at,privacy_consent_version,created_at,updated_at&id=eq.${user.id}`),
      rows(`trip_applications?select=trip_id,name,status,created_at,trips(title,start_date,end_date)&user_id=eq.${user.id}`),
      rows(`payments?select=order_id,trip_id,amount,status,pay_method,created_at,paid_at&user_id=eq.${user.id}`),
      rows(`reviews?select=trip_id,author_name,rating,body,photo_urls,approved,created_at&user_id=eq.${user.id}`),
      rows(`suggestions?select=title,body,created_at&user_id=eq.${user.id}`),
      rows(`reunion_picks?select=trip_id,created_at&from_user=eq.${user.id}`), // 내가 고른 기록만(누가 나를 골랐는지는 포함하지 않는다)
      email ? rows(`inquiries?select=name,email,message,created_at&email=eq.${encodeURIComponent(email)}`) : []
    ]);
    return json(res, 200, {
      exported_at: new Date().toISOString(),
      account: { email, created_at: user.created_at },
      profile: profile[0] || null, applications, payments, reviews, suggestions, reunion_picks: picks, inquiries
    });
  }

  if (body.action === 'delete') {
    if (!email || String(body.confirm || '').trim().toLowerCase() !== email.toLowerCase()) return json(res, 400, { error: 'confirm_mismatch' });

    // 1) 업로드한 후기 사진(저장소의 내 폴더)
    const auth = { apikey: e.serviceKey, Authorization: `Bearer ${e.serviceKey}`, 'Content-Type': 'application/json' };
    try {
      const list = await fetch(`${e.supabaseUrl}/storage/v1/object/list/review-photos`, { method: 'POST', headers: auth, body: JSON.stringify({ prefix: user.id, limit: 200 }) });
      const items = list.ok ? await list.json().catch(() => []) : [];
      const paths = (Array.isArray(items) ? items : []).map((o) => `${user.id}/${o.name}`);
      if (paths.length) {
        const del = await fetch(`${e.supabaseUrl}/storage/v1/object/review-photos`, { method: 'DELETE', headers: auth, body: JSON.stringify({ prefixes: paths }) });
        if (!del.ok) return json(res, 502, { error: 'photo_delete_failed' });
      }
    } catch { return json(res, 502, { error: 'photo_delete_failed' }); }

    // 2) 같은 이메일로 접수된 문의
    const inq = await store.remove(`inquiries?email=eq.${encodeURIComponent(email)}`);
    if (!inq.ok) return json(res, 502, { error: 'inquiry_delete_failed' });

    // 3) 계정 삭제 → 연결된 표의 내 행이 함께 삭제된다
    const r = await fetch(`${e.supabaseUrl}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: auth });
    if (!r.ok) return json(res, 502, { error: 'delete_failed' });
    return json(res, 200, { ok: true });
  }

  return json(res, 400, { error: 'invalid_input' });
};
