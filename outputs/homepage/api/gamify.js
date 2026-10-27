// POST /api/gamify  { action, ...params }   (Authorization: Bearer <로그인 회원의 access token>)
// 게이미피케이션: 레벨·XP, 데일리 체크인, 칭호, 도장판, 쿠폰, 시즌 크루·미션. XP·쿠폰·크루는 모두 서버(service_role)와 DB 트리거만 바꾼다.
//  overview · checkin{choice} · crew.create{name} · crew.join{code} · crew.leave · crew.ranking · crew.claim{mission_id} · priority.apply{trip_id}
const crypto = require('crypto');
const { env, json, readBody, db, verifyUser, withErrors } = require('./_lib');

const UUID = /^[0-9a-f-]{36}$/i;
const needXp = (level) => 50 * level * (level - 1); // 레벨 L에 필요한 누적 XP (DB level_of와 같은 공식)
const levelOf = (xp) => Math.floor((1 + Math.sqrt(1 + (8 * xp) / 100)) / 2);
const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const CREW_MAX = 6;

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

  const profile = await one(`profiles?select=id,name,status,xp&id=eq.${user.id}`);
  if (!profile) return json(res, 404, { error: 'no_profile' });
  const suspended = profile.status === 'suspended';

  // ---- 공통 계산 ----
  const activeSeason = () => one('seasons?select=id,name,starts_on,ends_on&active=eq.true');
  const myCrew = async (season) => {
    if (!season) return null;
    const m = await one(`crew_members?select=crew_id,joined_at&user_id=eq.${user.id}&season_id=eq.${season.id}`);
    if (!m) return null;
    const c = await one(`crews?select=id,name,code,owner_id&id=eq.${m.crew_id}`);
    return c ? { ...c, joined_at: m.joined_at } : null;
  };
  // 크루가 시즌 동안 쌓은 활동 수(종류별)와 XP: 크루원 각자 "크루에 들어온 뒤"의 기록만 센다
  const crewStats = async (crewIds, season) => {
    const members = crewIds.length ? await rows(`crew_members?select=crew_id,user_id,joined_at&crew_id=in.(${crewIds.join(',')})&limit=2000`) : [];
    const ids = [...new Set(members.map((m) => m.user_id))];
    const events = ids.length ? await rows(`xp_events?select=user_id,kind,xp,created_at&user_id=in.(${ids.join(',')})&created_at=gte.${encodeURIComponent(season.starts_on + 'T00:00:00+09:00')}&created_at=lt.${encodeURIComponent(addDays(season.ends_on, 1) + 'T00:00:00+09:00')}&limit=20000`) : [];
    const out = {};
    for (const id of crewIds) out[id] = { members: 0, xp: 0, attend: 0, review: 0, checkin: 0 };
    for (const m of members) {
      const s = out[m.crew_id]; s.members++;
      for (const ev of events) {
        if (ev.user_id !== m.user_id || ev.created_at < m.joined_at) continue;
        s.xp += ev.xp;
        if (ev.kind === 'attend' || ev.kind === 'review' || ev.kind === 'checkin') s[ev.kind]++;
      }
    }
    return out;
  };

  async function overview() {
    const today = kstToday();
    const [rules, titles, coupons, boardRows, rewards, season, checkins, applied] = await Promise.all([
      rows('xp_rules?select=kind,xp,label&active=eq.true&order=kind.asc'),
      rows(`user_titles?select=interest&user_id=eq.${user.id}`),
      rows(`user_coupons?select=id,status,source,issued_at,expires_at,used_at,coupon_templates(code,name,type,value)&user_id=eq.${user.id}&order=issued_at.desc&limit=50`),
      rows('stamp_boards?select=id,code,title,kind,goal,coupon_template_id&active=eq.true&order=created_at.asc'),
      rows(`user_board_rewards?select=board_id&user_id=eq.${user.id}`),
      activeSeason(),
      rows(`daily_checkins?select=day,choice&user_id=eq.${user.id}&order=day.desc&limit=400`),
      rows(`trip_applications?select=attendance,trips(region,tags)&user_id=eq.${user.id}&attendance=eq.attended&limit=500`)
    ]);
    // 오늘의 질문(비어 있으면 DB 함수로 채운다)
    let q = await one(`daily_questions?select=day,question,a,b&day=eq.${today}`);
    if (!q) { await rpc('rotate_daily_question'); q = await one(`daily_questions?select=day,question,a,b&day=eq.${today}`); }
    const days = new Set(checkins.map((c) => c.day));
    let cursor = days.has(today) ? today : addDays(today, -1), streak = 0;
    while (days.has(cursor) && streak < 400) { streak++; cursor = addDays(cursor, -1); }
    const todays = checkins.find((c) => c.day === today);
    // 도장판 진행도: 출석한 모임의 지역/태그 종류
    const regions = new Set(), tags = new Set();
    for (const a of applied) { const t = a.trips || {}; if (t.region && t.region !== 'other') regions.add(t.region); (t.tags || []).forEach((x) => tags.add(x)); }
    const rewarded = new Set(rewards.map((r) => r.board_id));
    const boards = boardRows.map((b) => { const have = [...(b.kind === 'region' ? regions : tags)]; return { id: b.id, code: b.code, title: b.title, kind: b.kind, goal: b.goal, collected: have, progress: Math.min(have.length, b.goal), done: rewarded.has(b.id) || have.length >= b.goal, rewarded: rewarded.has(b.id) }; });
    // 시즌·크루
    let crew = null, seasonOut = null;
    if (season) {
      const c = await myCrew(season);
      const missions = await rows(`season_missions?select=id,kind,goal,title,coupon_template_id&season_id=eq.${season.id}&active=eq.true&order=created_at.asc`);
      let stats = null, claims = [], members = [];
      if (c) {
        stats = (await crewStats([c.id], season))[c.id];
        claims = await rows(`crew_mission_claims?select=mission_id&user_id=eq.${user.id}`);
        const ms = await rows(`crew_members?select=user_id,joined_at&crew_id=eq.${c.id}&order=joined_at.asc`);
        const names = ms.length ? await rows(`profiles?select=id,name&id=in.(${ms.map((m) => m.user_id).join(',')})`) : [];
        members = ms.map((m) => ({ name: (names.find((n) => n.id === m.user_id) || {}).name || '', owner: m.user_id === c.owner_id, me: m.user_id === user.id }));
        crew = { id: c.id, name: c.name, code: c.code, members, stats };
      }
      seasonOut = {
        id: season.id, name: season.name, starts_on: season.starts_on, ends_on: season.ends_on,
        missions: missions.map((m) => ({ id: m.id, kind: m.kind, goal: m.goal, title: m.title, reward: !!m.coupon_template_id, progress: stats ? Math.min(stats[m.kind], m.goal) : 0, done: !!stats && stats[m.kind] >= m.goal, claimed: claims.some((x) => x.mission_id === m.id) }))
      };
    }
    const xp = profile.xp || 0, level = levelOf(xp);
    return {
      xp, level, level_start_xp: needXp(level), next_level_xp: needXp(level + 1), rules,
      streak, checked_in_today: !!todays, today_choice: todays ? todays.choice : null,
      question: q, titles: titles.map((t) => t.interest),
      coupons: coupons.map((c) => ({ id: c.id, status: c.status === 'active' && new Date(c.expires_at) <= new Date() ? 'expired' : c.status, source: c.source, expires_at: c.expires_at, template: c.coupon_templates })),
      boards, season: seasonOut, crew
    };
  }

  if (action === 'overview') return json(res, 200, await overview());

  if (action === 'checkin') {
    if (suspended) return json(res, 403, { error: 'suspended' });
    const choice = body.choice === 'a' || body.choice === 'b' ? body.choice : null;
    if (!choice) return json(res, 400, { error: 'invalid_input' });
    const today = kstToday();
    let q = await one(`daily_questions?select=day&day=eq.${today}`);
    if (!q) { await rpc('rotate_daily_question'); q = await one(`daily_questions?select=day&day=eq.${today}`); }
    if (!q) return json(res, 404, { error: 'no_question' });
    const ins = await store.insert('daily_checkins', { user_id: user.id, day: today, choice });
    if (!ins.ok) return json(res, ins.status === 409 ? 409 : 502, { error: ins.status === 409 ? 'already_checked_in' : 'save_failed' });
    const [a, b] = await Promise.all([store.count(`daily_checkins?select=user_id&day=eq.${today}&choice=eq.a`), store.count(`daily_checkins?select=user_id&day=eq.${today}&choice=eq.b`)]);
    profile.xp = ((await one(`profiles?select=xp&id=eq.${user.id}`)) || {}).xp || 0; // 트리거가 방금 적립한 XP 반영
    return json(res, 200, { ...(await overview()), result: { a, b } });
  }

  // ---- 크루 ----
  if (action === 'crew.create' || action === 'crew.join') {
    if (suspended) return json(res, 403, { error: 'suspended' });
    const season = await activeSeason();
    if (!season) return json(res, 404, { error: 'no_season' });
    if (await myCrew(season)) return json(res, 409, { error: 'already_in_crew' });
    if (action === 'crew.create') {
      const name = String(body.name || '').trim();
      if (name.length < 2 || name.length > 20) return json(res, 400, { error: 'invalid_input' });
      let crew = null;
      for (let i = 0; i < 5 && !crew; i++) {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
        const ins = await store.insert('crews', { season_id: season.id, name, owner_id: user.id, code });
        if (ins.ok && ins.data && ins.data[0]) crew = ins.data[0];
        else if (ins.status === 409 && /crews_name_per_season/.test(JSON.stringify(ins.data || ''))) return json(res, 409, { error: 'name_taken' });
      }
      if (!crew) return json(res, 502, { error: 'save_failed' });
      const m = await store.insert('crew_members', { crew_id: crew.id, user_id: user.id, season_id: season.id });
      if (!m.ok) { await store.remove(`crews?id=eq.${crew.id}`); return json(res, 502, { error: 'save_failed' }); }
    } else {
      const code = String(body.code || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(code)) return json(res, 400, { error: 'invalid_input' });
      const crew = await one(`crews?select=id&season_id=eq.${season.id}&code=eq.${code}`);
      if (!crew) return json(res, 404, { error: 'no_such_crew' });
      const m = await store.insert('crew_members', { crew_id: crew.id, user_id: user.id, season_id: season.id });
      if (!m.ok) return json(res, 409, { error: /crew_full/.test(JSON.stringify(m.data || '')) ? 'crew_full' : 'join_failed' });
    }
    return json(res, 200, await overview());
  }

  if (action === 'crew.leave') {
    const season = await activeSeason();
    const c = await myCrew(season);
    if (!c) return json(res, 404, { error: 'not_in_crew' });
    await store.remove(`crew_members?crew_id=eq.${c.id}&user_id=eq.${user.id}`);
    const rest = await rows(`crew_members?select=user_id&crew_id=eq.${c.id}&order=joined_at.asc`);
    if (!rest.length) await store.remove(`crews?id=eq.${c.id}`);
    else if (c.owner_id === user.id) await store.update(`crews?id=eq.${c.id}`, { owner_id: rest[0].user_id });
    return json(res, 200, await overview());
  }

  if (action === 'crew.ranking') {
    const season = await activeSeason();
    if (!season) return json(res, 200, { season: null, ranking: [] });
    const crews = await rows(`crews?select=id,name&season_id=eq.${season.id}&limit=500`);
    const stats = crews.length ? await crewStats(crews.map((c) => c.id), season) : {};
    const mine = await myCrew(season);
    const ranking = crews.map((c) => ({ id: c.id, name: c.name, members: stats[c.id].members, xp: stats[c.id].xp, mine: !!mine && mine.id === c.id }))
      .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name)).slice(0, 20).map((c, i) => ({ rank: i + 1, name: c.name, members: c.members, xp: c.xp, mine: c.mine }));
    return json(res, 200, { season: { name: season.name, ends_on: season.ends_on }, ranking });
  }

  if (action === 'crew.claim') {
    if (suspended) return json(res, 403, { error: 'suspended' });
    if (!UUID.test(String(body.mission_id || ''))) return json(res, 400, { error: 'invalid_input' });
    const season = await activeSeason();
    const c = await myCrew(season);
    const mission = season && await one(`season_missions?select=id,kind,goal,coupon_template_id&id=eq.${body.mission_id}&season_id=eq.${season.id}&active=eq.true`);
    if (!c || !mission) return json(res, 404, { error: 'no_such_mission' });
    const stats = (await crewStats([c.id], season))[c.id];
    if (stats[mission.kind] < mission.goal) return json(res, 409, { error: 'not_done' });
    const claim = await store.insert('crew_mission_claims', { user_id: user.id, mission_id: mission.id, crew_id: c.id });
    if (!claim.ok) return json(res, 409, { error: 'already_claimed' });
    if (mission.coupon_template_id) await rpc('issue_coupon', { uid: user.id, tpl: mission.coupon_template_id, src: 'crew', ref: mission.id });
    return json(res, 200, await overview());
  }

  // ---- 우선 참여권: 아직 오픈 전(upcoming)인 모임에 먼저 신청 ----
  if (action === 'priority.apply') {
    if (suspended) return json(res, 403, { error: 'suspended' });
    if (!UUID.test(String(body.trip_id || ''))) return json(res, 400, { error: 'invalid_input' });
    const trip = await one(`trips?select=id,status,capacity,hidden,approval_status&id=eq.${body.trip_id}`);
    if (!trip || trip.status !== 'upcoming' || trip.hidden || trip.approval_status !== 'approved') return json(res, 404, { error: 'trip_not_upcoming' });
    const coupons = await rows(`user_coupons?select=id,expires_at,coupon_templates(type)&user_id=eq.${user.id}&status=eq.active&order=expires_at.asc&limit=50`);
    const pass = coupons.find((c) => c.coupon_templates && c.coupon_templates.type === 'priority' && new Date(c.expires_at) > new Date());
    if (!pass) return json(res, 403, { error: 'no_priority_pass' });
    if (await one(`trip_applications?select=id&trip_id=eq.${trip.id}&user_id=eq.${user.id}`)) return json(res, 409, { error: 'already_applied' });
    if (trip.capacity && (await store.count(`trip_applications?select=id&trip_id=eq.${trip.id}&status=neq.cancelled`)) >= trip.capacity) return json(res, 409, { error: 'full' });
    const used = await store.update(`user_coupons?id=eq.${pass.id}&status=eq.active`, { status: 'used', used_at: new Date().toISOString(), used_ref: `trip:${trip.id}` });
    if (!used.ok || !(used.data && used.data.length)) return json(res, 409, { error: 'coupon_in_use' });
    const ins = await store.insert('trip_applications', { trip_id: trip.id, user_id: user.id, name: String(profile.name || '').slice(0, 100) || 'member' });
    if (!ins.ok) { await store.update(`user_coupons?id=eq.${pass.id}`, { status: 'active', used_at: null, used_ref: null }); return json(res, 502, { error: 'apply_failed' }); }
    return json(res, 200, { ok: true });
  }

  return json(res, 400, { error: 'invalid_action' });
}

module.exports = withErrors('gamify', handler);
