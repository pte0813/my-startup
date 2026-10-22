// AI 기능 서버 함수들이 함께 쓰는 도구. ANTHROPIC_API_KEY는 서버 환경변수에서만 읽고 브라우저로 보내지 않는다.
const opts = require('../ai-options.json');

const LANGS = { ko: '한국어', en: 'English', zh: '简体中文', ja: '日本語', es: 'español' };
const aiEnv = () => ({
  key: process.env.ANTHROPIC_API_KEY,
  model: process.env.AI_MODEL || 'claude-haiku-5-5',
  dailyLimit: Math.max(1, parseInt(process.env.AI_DAILY_LIMIT || '10', 10) || 10)
});
const pickLang = (v) => (Object.prototype.hasOwnProperty.call(LANGS, v) ? v : 'ko');

// 프로필 값에서 허용된 선택지만 남긴다 (자유 입력이 AI 프롬프트로 들어가지 않게)
const keepOnly = (arr, allowed) => (Array.isArray(arr) ? arr.filter((x) => allowed.includes(x)) : []);
const cleanProfile = (p) => ({
  mbti: opts.mbti_types.includes(p && p.mbti) ? p.mbti : null,
  interests: keepOnly(p && p.interests, Object.keys(opts.interests)),
  travel_styles: keepOnly(p && p.travel_styles, Object.keys(opts.travel_styles)),
  active_times: keepOnly(p && p.active_times, Object.keys(opts.active_times))
});
const hasAnyTrait = (p) => !!(p.mbti || p.interests.length || p.travel_styles.length || p.active_times.length);

// 오늘(최근 24시간) 쓴 횟수 확인 / 기록
async function usedToday(store, userId, feature) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const r = await store.select(`ai_usage?select=id&user_id=eq.${userId}&feature=eq.${feature}&created_at=gte.${encodeURIComponent(since)}&limit=100`);
  return r.ok && Array.isArray(r.data) ? r.data.length : 0;
}
const recordUse = (store, userId, feature) => store.insert('ai_usage', { user_id: userId, feature });

// 하루 호출 횟수 제한: 프로필을 바꿔 가며 반복 조회해 다른 참가자의 성향을 추측하는 것을 어렵게 한다.
// 허용되면 호출 기록을 남기고 true, 한도를 넘으면 false. 30일 지난 기록은 함께 지운다.
async function throttle(store, userId, feature, max) {
  if ((await usedToday(store, userId, feature)) >= max) return false;
  await recordUse(store, userId, feature);
  const old = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  await store.remove(`ai_usage?user_id=eq.${userId}&created_at=lt.${encodeURIComponent(old)}`);
  return true;
}

// Claude 호출: 정해진 형식(도구 입력)으로만 답하게 해서 JSON 파싱 문제를 피한다. 실패하면 null.
async function askClaude(cfg, { system, user, tool }) {
  if (!cfg.key) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 1200,
        system,
        messages: [{ role: 'user', content: user }],
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name }
      })
    });
    if (!r.ok) return null;
    const data = await r.json();
    const block = (data.content || []).find((b) => b.type === 'tool_use' && b.name === tool.name);
    return block ? block.input : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { opts, LANGS, aiEnv, pickLang, cleanProfile, hasAnyTrait, usedToday, recordUse, throttle, askClaude };
