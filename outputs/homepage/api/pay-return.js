// POST /api/pay-return  (나이스페이먼츠 결제창이 인증 결과를 보내는 주소: form-urlencoded)
// 인증 결과를 검증(주문·금액·서명)한 뒤 승인 API를 호출하고, 결과를 DB에 기록한 다음 내 정보 페이지로 보낸다.
const { env, configured, nicepayHost, sha256, safeEqual, db, readBody, basicAuth, withErrors } = require('./_lib');

const back = (res, ok, code) => {
  res.statusCode = 303;
  res.setHeader('Location', `/account.html?pay=${ok ? 'ok' : 'fail'}${code ? '&code=' + encodeURIComponent(code) : ''}`);
  res.end();
};

async function nicepay(e, path, payload) {
  const r = await fetch(nicepayHost(e) + path, {
    method: 'POST',
    headers: { Authorization: basicAuth(e), 'Content-Type': 'application/json;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  let data = null;
  try { data = await r.json(); } catch { /* 본문 없음 */ }
  return { ok: r.ok, data };
}

async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('Allow', 'POST'); return res.end(); }
  const e = env();
  if (!configured(e)) return back(res, false, 'not_configured');

  const b = await readBody(req);
  const orderId = String(b.orderId || '');
  const store = db(e);

  const found = await store.select(`payments?select=id,status,amount,application_id,order_id&order_id=eq.${encodeURIComponent(orderId)}&limit=1`);
  const pay = found.ok && found.data && found.data[0];
  if (!pay) return back(res, false, 'unknown_order');
  if (pay.status === 'paid') return back(res, true); // 새로고침 등으로 다시 들어온 경우

  const fail = async (reason, code) => {
    await store.update(`payments?id=eq.${pay.id}&status=eq.ready`, { status: 'failed', fail_reason: String(reason).slice(0, 200) });
    return back(res, false, code);
  };

  if (pay.status !== 'ready') return back(res, false, 'invalid_state');
  if (b.authResultCode !== '0000') return fail(b.authResultMsg || 'auth_failed', 'auth_failed');

  // 위변조 검증: 클라이언트 키, DB에 저장한 금액, 서명(hex(sha256(authToken + clientId + amount + SecretKey)))
  const amount = Number(b.amount);
  if (b.clientId !== e.clientId || amount !== pay.amount) return fail('mismatch', 'mismatch');
  if (!safeEqual(sha256(`${b.authToken}${b.clientId}${b.amount}${e.secretKey}`), b.signature)) return fail('bad_signature', 'bad_signature');

  // 승인 API 호출. 응답을 받지 못하면 망취소를 요청한다.
  let result;
  try {
    result = await nicepay(e, `/v1/payments/${encodeURIComponent(b.tid)}`, { amount: pay.amount });
  } catch (err) {
    try { await nicepay(e, '/v1/payments/netcancel', { orderId }); } catch { /* 망취소 실패는 나이스페이 관리자에서 확인 */ }
    return fail('approve_timeout', 'approve_failed');
  }
  const d = result.data || {};
  if (d.resultCode !== '0000' || d.status !== 'paid') return fail(d.resultMsg || 'approve_failed', 'approve_failed');

  // 운영 환경에서는 승인 응답도 주문·금액·서명을 다시 확인한다(샌드박스는 임의 값을 응답하므로 건너뜀).
  if (!e.sandbox) {
    const sigOk = d.signature && safeEqual(sha256(`${d.tid}${d.amount}${d.ediDate}${e.secretKey}`), d.signature);
    if (d.orderId !== orderId || Number(d.amount) !== pay.amount || !sigOk) {
      try { await nicepay(e, `/v1/payments/${encodeURIComponent(d.tid)}/cancel`, { reason: 'verification failed', orderId }); } catch { /* 관리자 확인 */ }
      return fail('response_mismatch', 'mismatch');
    }
  }

  const saved = await store.update(`payments?id=eq.${pay.id}`, {
    status: 'paid', tid: d.tid || b.tid, pay_method: d.payMethod || null, receipt_url: d.receiptUrl || null, paid_at: new Date().toISOString()
  });
  const marked = saved.ok && await store.update(`trip_applications?id=eq.${pay.application_id}`, { status: 'paid' });
  if (!saved.ok || !marked.ok) {
    // 돈은 승인됐는데 기록에 실패한 경우: 자동 취소해 이중 결제·누락을 막는다.
    let cancelled = false;
    try { cancelled = (await nicepay(e, `/v1/payments/${encodeURIComponent(d.tid || b.tid)}/cancel`, { reason: 'record failed', orderId })).ok; } catch { /* 아래에서 수동 확인 표시 */ }
    await store.update(`payments?id=eq.${pay.id}`, cancelled
      ? { status: 'cancelled', fail_reason: 'record_failed' }
      : { fail_reason: 'record_failed_cancel_needed' }); // 취소도 실패하면 나이스페이 관리자에서 직접 취소해야 함
    return back(res, false, 'record_failed');
  }
  return back(res, true);
}

module.exports = withErrors('pay-return', handler);
