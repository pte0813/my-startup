// POST /api/growth  { action, ... }   (Authorization: Bearer <로그인 회원의 access token>)
// 유입: 친구 초대 코드. 쿠폰은 서버(service_role)와 DB 함수만 지급한다.
//  overview            → { invite_code, invited, rewarded_this_month, monthly_cap }
//  invite.redeem{code} → 가입 직후 한 번, 초대한 사람과 나 모두에게 쿠폰(INVITE5000). 이미 사용·자기 코드·너무 오래된 계정은 거절
const { env, json, readBody, db, verifyUser, withErrors } = require('./_lib');

const NEW_ACCOUNT_DAYS = 14; // 가입한 지 이 기간 안에서만 초대 코드를 쓸 수 있다
const MONTHLY_CAP = 10;      // 한 사람이 한 달에 보상받는 초대 수(어뷰징 방지)

async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'method_not_allowed' }); }
  const e = env();
  if (!(e.supabaseUrl && e.anonKey && e.serviceKey)) return json(res, 503, { error: 'not_configured' });
  const user = await verifyUser(e, req.headers.authorization);
  if (!user) return json(res, 401, { error: 'unauthorized' });
  const body = await readBody(req);
  const action = String(body.action || '');
  const store = db(e);
  const rows = async (path) => { const r = await store.select(path); return r.ok && Array.isArray(r.data) ? r.data : []; };
  const one = async (path) => (await rows(path + '&limit=1'))[0] || null;
  const rpc = async (fn, args) => {
    const r = await fetch(`${e.supabaseUrl}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: e.serviceKey, Authorization: `Bearer ${e.serviceKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) });
    return r.ok ? r.json().catch(() => null) : null;
  };
  const monthAgo = () => encodeURIComponent(new Date(Date.now() - 30 * 86400000).toISOString());

  const me = await one(`profiles?select=id,invite_code,status&id=eq.${user.id}`);
  if (!me) return json(res, 404, { error: 'no_profile' });

  if (action === 'overview') {
    const invited = await store.count(`invites?select=id&inviter_id=eq.${user.id}`);
    const month = await store.count(`invites?select=id&inviter_id=eq.${user.id}&created_at=gte.${monthAgo()}`);
    return json(res, 200, { invite_code: me.invite_code, invited, rewarded_this_month: Math.min(month, MONTHLY_CAP), monthly_cap: MONTHLY_CAP });
  }

  if (action === 'invite.redeem') {
    if (me.status === 'suspended') return json(res, 403, { error: 'suspended' });
    const code = String(body.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(code)) return json(res, 400, { error: 'invalid_code' });
    const created = Date.parse(user.created_at || '');
    if (!created || Date.now() - created > NEW_ACCOUNT_DAYS * 86400000) return json(res, 409, { error: 'not_new_account' });
    const inviter = await one(`profiles?select=id,status&invite_code=eq.${code}`);
    if (!inviter) return json(res, 404, { error: 'no_such_code' });
    if (inviter.id === user.id) return json(res, 400, { error: 'own_code' });
    if (inviter.status === 'suspended') return json(res, 404, { error: 'no_such_code' });
    if (await one(`invites?select=id&invitee_id=eq.${user.id}`)) return json(res, 409, { error: 'already_redeemed' });
    if ((await store.count(`invites?select=id&inviter_id=eq.${inviter.id}&created_at=gte.${monthAgo()}`)) >= MONTHLY_CAP) return json(res, 409, { error: 'inviter_cap' });
    const tpl = await one('coupon_templates?select=id&code=eq.INVITE5000&active=eq.true');
    const ins = await store.insert('invites', { inviter_id: inviter.id, invitee_id: user.id });
    if (!ins.ok || !(ins.data && ins.data[0])) return json(res, ins.status === 409 ? 409 : 502, { error: ins.status === 409 ? 'already_redeemed' : 'save_failed' });
    const inviteId = ins.data[0].id;
    if (tpl) {
      await rpc('issue_coupon', { uid: inviter.id, tpl: tpl.id, src: 'invite', ref: inviteId });
      await rpc('issue_coupon', { uid: user.id, tpl: tpl.id, src: 'invite', ref: inviteId });
    }
    return json(res, 200, { ok: true, rewarded: !!tpl });
  }

  return json(res, 400, { error: 'invalid_action' });
}

module.exports = withErrors('growth', handler);
