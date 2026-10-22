// GET /api/purge  — Vercel 크론이 매주 호출한다. 보유 기간이 지난 데이터를 지운다.
// 호출은 환경변수 CRON_SECRET이 설정돼 있고 요청의 Authorization 헤더가 "Bearer <CRON_SECRET>"일 때만 허용한다(Vercel 크론이 자동으로 붙여 준다).
// - 문의(inquiries): 접수 1년 경과 (처리방침과 동일)
// - AI 사용 기록(ai_usage): 30일 경과 / 아이스브레이킹 저장본(ai_icebreakers): 90일 경과
const { env, json, db } = require('./_lib');
const { safeEqual } = require('./_lib');

module.exports = async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const given = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!secret || !safeEqual(given, secret)) return json(res, 401, { error: 'unauthorized' });
  const e = env();
  if (!(e.supabaseUrl && e.serviceKey)) return json(res, 503, { error: 'not_configured' });
  const store = db(e);
  const before = (days) => encodeURIComponent(new Date(Date.now() - days * 24 * 3600 * 1000).toISOString());
  const jobs = {
    inquiries: `inquiries?created_at=lt.${before(365)}`,
    ai_usage: `ai_usage?created_at=lt.${before(30)}`,
    ai_icebreakers: `ai_icebreakers?created_at=lt.${before(90)}`
  };
  const result = {};
  for (const [name, path] of Object.entries(jobs)) result[name] = (await store.remove(path)).ok;
  return json(res, 200, { ok: Object.values(result).every(Boolean), result });
};
