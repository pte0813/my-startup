// POST /api/pay-prepare  { trip_id, coupon_id? }   (Authorization: Bearer <로그인 회원의 access token>)
// 신청한 여행의 결제 주문을 만들고 결제창에 필요한 값을 돌려준다. 금액은 DB의 여행 가격과 DB의 쿠폰 정보로만 계산한다(브라우저가 보낸 금액은 무시).
// 쿠폰(정률·정액 할인)은 본인 것이고 사용 가능·미만료일 때만 적용하며, 결제가 성공하면 pay-return이 사용 처리한다. 결제 금액은 최소 100원.
const crypto = require('crypto');
const { env, configured, json, readBody, db, verifyUser, withErrors } = require('./_lib');

async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'method_not_allowed' }); }
  const e = env();
  if (!configured(e)) return json(res, 503, { error: 'payment_not_configured' });

  const user = await verifyUser(e, req.headers.authorization);
  if (!user) return json(res, 401, { error: 'unauthorized' });

  const { trip_id: tripId, coupon_id: couponId } = await readBody(req);
  if (!/^[0-9a-f-]{36}$/i.test(String(tripId || ''))) return json(res, 400, { error: 'invalid_input' });

  const store = db(e);
  const app = await store.select(`trip_applications?select=id,status,name&trip_id=eq.${tripId}&user_id=eq.${user.id}&limit=1`);
  const application = app.ok && app.data && app.data[0];
  if (!application || application.status === 'cancelled') return json(res, 404, { error: 'no_application' });
  if (application.status === 'paid') return json(res, 409, { error: 'already_paid' });

  const trip = await store.select(`trips?select=id,title,price,status&id=eq.${tripId}&limit=1`);
  const t = trip.ok && trip.data && trip.data[0];
  if (!t || t.status !== 'open') return json(res, 404, { error: 'trip_not_open' });
  if (!(t.price > 0)) return json(res, 400, { error: 'no_payment_needed' });

  // 쿠폰 할인: 본인 쿠폰 + 사용 가능 + 만료 전 + 할인형만. 같은 쿠폰으로 진행 중인 주문(30분 이내)이 있으면 거절
  let finalAmount = t.price, discount = 0, coupon = null;
  if (couponId) {
    if (!/^[0-9a-f-]{36}$/i.test(String(couponId))) return json(res, 400, { error: 'invalid_input' });
    const cr = await store.select(`user_coupons?select=id,status,expires_at,coupon_templates(type,value)&id=eq.${couponId}&user_id=eq.${user.id}&limit=1`);
    coupon = cr.ok && cr.data && cr.data[0];
    const tpl = coupon && coupon.coupon_templates;
    if (!coupon || coupon.status !== 'active' || new Date(coupon.expires_at) <= new Date() || !tpl || !['percent', 'amount'].includes(tpl.type)) return json(res, 400, { error: 'invalid_coupon' });
    const since = encodeURIComponent(new Date(Date.now() - 30 * 60 * 1000).toISOString());
    const busy = await store.select(`payments?select=id&coupon_id=eq.${coupon.id}&or=(status.eq.paid,and(status.eq.ready,created_at.gte.${since}))&limit=1`);
    if (busy.ok && busy.data && busy.data.length) return json(res, 409, { error: 'coupon_in_use' });
    discount = tpl.type === 'percent' ? Math.floor((t.price * tpl.value) / 100) : tpl.value;
    finalAmount = Math.max(100, t.price - discount);
    discount = t.price - finalAmount;
  }

  const orderId = `HK${Date.now().toString(36)}${crypto.randomBytes(5).toString('hex')}`.toUpperCase();
  const ins = await store.insert('payments', {
    order_id: orderId, user_id: user.id, application_id: application.id, trip_id: t.id, amount: finalAmount, status: 'ready',
    coupon_id: coupon ? coupon.id : null, discount_amount: discount, original_amount: t.price
  });
  if (!ins.ok) return json(res, 502, { error: 'order_failed' });

  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0];
  const base = e.baseUrl || `${proto}://${host}`;
  return json(res, 200, {
    clientId: e.clientId,
    orderId,
    amount: finalAmount,
    original_amount: t.price,
    discount,
    goodsName: String(t.title).replace(/["|]/g, '-').slice(0, 40),
    returnUrl: `${base}/api/pay-return`,
    buyerName: String(application.name || '').slice(0, 30),
    buyerEmail: String(user.email || '').slice(0, 60)
  });
}

module.exports = withErrors('pay-prepare', handler);
