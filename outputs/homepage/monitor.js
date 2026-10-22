/* 오류 모니터링(Sentry): config.js에 sentryDsn이 있을 때만 동작한다(환경변수 SENTRY_DSN → write-config.js).
   개인정보는 보내지 않는다: 사용자·요청 정보·쿠키를 지우고, 성능 추적과 세션 녹화는 끈다. */
(function () {
  var dsn = window.APP_CONFIG && window.APP_CONFIG.sentryDsn;
  if (!dsn) return;
  var s = document.createElement('script');
  s.src = 'https://browser.sentry-cdn.com/8.30.0/bundle.min.js';
  s.crossOrigin = 'anonymous';
  s.onload = function () {
    try {
      window.Sentry.init({
        dsn: dsn,
        environment: /vercel\.app$/.test(location.hostname) && location.hostname !== 'hamkkedat-homepage.vercel.app' ? 'preview' : 'production',
        sendDefaultPii: false,
        tracesSampleRate: 0,
        beforeSend: function (e) { delete e.user; if (e.request) { delete e.request.cookies; delete e.request.headers; delete e.request.query_string; } return e; }
      });
    } catch (err) { /* 모니터링 실패는 무시 */ }
  };
  document.head.appendChild(s);
})();
