// POST /api/pay-prepare  { trip_id }   (Authorization: Bearer <로그인 회원의 access token>)
// 신청한 여행의 결제 주문을 만들고 결제창에 필요한 값을 돌려준다. 금액은 DB의 여행 가격만 쓴다(브라우저가 보낸 금액은 무시).
const crypto = require('crypto');
const { env, configured, json, readBody, db, verifyUser, withErrors } = require('./_lib');

async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'method_not_allowed' }); }
  const e = env();
  if (!configured(e)) return json(res, 503, { error: 'payment_not_configured' });

  const user = await verifyUser(e, req.headers.authorization);
  if (!user) return json(res, 401, { error: 'unauthorized' });

  const { trip_id: tripId } = await readBody(req);
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

  const orderId = `HK${Date.now().toString(36)}${crypto.randomBytes(5).toString('hex')}`.toUpperCase();
  const ins = await store.insert('payments', {
    order_id: orderId, user_id: user.id, application_id: application.id, trip_id: t.id, amount: t.price, status: 'ready'
  });
  if (!ins.ok) return json(res, 502, { error: 'order_failed' });

  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0];
  const base = e.baseUrl || `${proto}://${host}`;
  return json(res, 200, {
    clientId: e.clientId,
    orderId,
    amount: t.price,
    goodsName: String(t.title).replace(/["|]/g, '-').slice(0, 40),
    returnUrl: `${base}/api/pay-return`,
    buyerName: String(application.name || '').slice(0, 30),
    buyerEmail: String(user.email || '').slice(0, 60)
  });
}

module.exports = withErrors('pay-prepare', handler);
