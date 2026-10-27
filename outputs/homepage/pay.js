/* 결제창 열기 (나이스페이먼츠 JS SDK). 금액·주문은 서버(/api/pay-prepare)가 정하고, 브라우저는 받은 값으로 결제창만 연다.
   사용: startPayment(supabaseClient, tripId, couponId?) → 'ok' | 'need_login' | 'pay_unavailable' | 'pay_fail' */
(() => {
  const SDK = 'https://pay.nicepay.co.kr/v1/js/';
  const loadSdk = () => new Promise((resolve, reject) => {
    if (window.AUTHNICE) return resolve();
    const s = document.createElement('script');
    s.src = SDK; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });

  window.startPayment = async (client, tripId, couponId) => {
    const { data } = await client.auth.getSession();
    const token = data && data.session && data.session.access_token;
    if (!token) return 'need_login';

    let res, order = null;
    try {
      res = await fetch('/api/pay-prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ trip_id: tripId, coupon_id: couponId || undefined })
      });
      order = await res.json();
    } catch (e) {
      return 'pay_unavailable'; // 서버 함수가 없는 환경(로컬 파일 등)
    }
    if (res.status === 503) return 'pay_unavailable';
    if (order && (order.error === 'invalid_coupon' || order.error === 'coupon_in_use')) return 'pay_coupon_err';
    if (!res.ok || !order || !order.orderId) return 'pay_fail';

    try { await loadSdk(); } catch (e) { return 'pay_unavailable'; }
    window.AUTHNICE.requestPay({
      clientId: order.clientId,
      method: 'card',
      orderId: order.orderId,
      amount: order.amount,
      goodsName: order.goodsName,
      returnUrl: order.returnUrl,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      fnError: (result) => window.dispatchEvent(new CustomEvent('pay-error', { detail: result }))
    });
    return 'ok';
  };
})();
