// POST /api/admin  { action, ...params }   (Authorization: Bearer <로그인 회원의 access token>)
// 운영자용 관리자 API. 브라우저의 /admin 화면은 이 함수로만 데이터를 읽고 바꾼다(service_role 키는 여기서만 쓴다).
// - 권한은 profiles.role(super_admin / operator / cs / user)로 서버에서 매번 확인한다. 정지된 계정은 관리자여도 거절한다.
// - 데이터를 바꾸는 모든 작업은 admin_logs에 남긴다(누가·언제·무엇을·누구에게·값).
const { env, json, readBody, db, verifyUser, withErrors } = require('./_lib');

const UUID = /^[0-9a-f-]{36}$/i;
const STAFF = ['super_admin', 'operator', 'cs'];
// 작업별 허용 역할
const PERMS = {
  me: STAFF,
  stats: ['super_admin', 'operator'],
  'users.list': STAFF, 'users.get': STAFF, 'users.warn': STAFF,
  'users.suspend': ['super_admin', 'operator'], 'users.unsuspend': ['super_admin', 'operator'],
  'users.setRole': ['super_admin'],
  'trips.list': ['super_admin', 'operator'], 'trips.update': ['super_admin', 'operator'],
  'trips.applicants': ['super_admin', 'operator'], 'trips.attendance': ['super_admin', 'operator'],
  'reports.list': STAFF, 'reports.resolve': STAFF,
  'logs.list': ['super_admin']
};
const ROLES = ['super_admin', 'operator', 'cs', 'user'];
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const day = (d) => new Date(d).toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const series = (rows, key, n) => {
  const m = {};
  for (let i = n - 1; i >= 0; i--) m[day(daysAgo(i))] = 0;
  for (const r of rows) { const k = day(r[key]); if (k in m) m[k] += 1; }
  return Object.entries(m).map(([d, c]) => ({ day: d, n: c }));
};

async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'method_not_allowed' }); }
  const e = env();
  if (!(e.supabaseUrl && e.anonKey && e.serviceKey)) return json(res, 503, { error: 'not_configured' });
  const user = await verifyUser(e, req.headers.authorization);
  if (!user) return json(res, 401, { error: 'unauthorized' });

  const store = db(e);
  const me = await store.select(`profiles?select=id,name,role,status&id=eq.${user.id}&limit=1`);
  const actor = me.ok && me.data && me.data[0];
  if (!actor || !STAFF.includes(actor.role) || actor.status === 'suspended') return json(res, 403, { error: 'forbidden' });

  const body = await readBody(req);
  const action = String(body.action || '');
  if (!PERMS[action]) return json(res, 400, { error: 'invalid_action' });
  if (!PERMS[action].includes(actor.role)) return json(res, 403, { error: 'forbidden' });

  const log = (act, targetType, targetId, detail) => store.insert('admin_logs', { actor_id: user.id, actor_role: actor.role, action: act, target_type: targetType, target_id: String(targetId || ''), detail: detail || {} });
  const rows = async (path) => { const r = await store.select(path); return r.ok && Array.isArray(r.data) ? r.data : []; };
  const one = async (path) => (await rows(path + '&limit=1'))[0] || null;
  const needId = (v) => UUID.test(String(v || ''));
  const authUsers = async () => {
    const r = await fetch(`${e.supabaseUrl}/auth/v1/admin/users?page=1&per_page=200`, { headers: { apikey: e.serviceKey, Authorization: `Bearer ${e.serviceKey}` } });
    const data = r.ok ? await r.json().catch(() => ({})) : {};
    return new Map((data.users || []).map((u) => [u.id, { email: u.email, last_sign_in_at: u.last_sign_in_at }]));
  };
  // 다른 사람의 계정을 바꿀 수 있는지: 자기 자신은 안 되고, super_admin 계정은 super_admin만 바꿀 수 있다
  const guardTarget = async (id) => {
    if (!needId(id)) return { err: [400, 'invalid_input'] };
    if (id === user.id) return { err: [400, 'cannot_target_self'] };
    const t = await one(`profiles?select=id,name,role,status,warning_count&id=eq.${id}`);
    if (!t) return { err: [404, 'no_such_user'] };
    if (t.role === 'super_admin' && actor.role !== 'super_admin') return { err: [403, 'forbidden'] };
    return { t };
  };

  switch (action) {
    case 'me':
      return json(res, 200, { id: user.id, email: user.email, name: actor.name, role: actor.role, permissions: Object.keys(PERMS).filter((k) => PERMS[k].includes(actor.role)) });

    case 'stats': {
      const since30 = encodeURIComponent(daysAgo(29).toISOString());
      const [members, newMembers, trips, tripsPublic, apps, profiles30, active30, apps30, appRows, tripRows] = await Promise.all([
        store.count('profiles?select=id'),
        store.count(`profiles?select=id&created_at=gte.${encodeURIComponent(daysAgo(7).toISOString())}`),
        store.count('trips?select=id'),
        store.count('trips?select=id&hidden=eq.false&approval_status=eq.approved'),
        store.count('trip_applications?select=id&status=neq.cancelled'),
        rows(`profiles?select=created_at&created_at=gte.${since30}&limit=10000`),
        rows(`daily_active?select=day,user_id&day=gte.${day(daysAgo(29))}&limit=20000`),
        rows(`trip_applications?select=created_at&created_at=gte.${since30}&limit=10000`),
        rows('trip_applications?select=user_id,trip_id&status=neq.cancelled&limit=20000'),
        rows('trips?select=status,hidden,approval_status&limit=5000')
      ]);
      // DAU: 하루에 활동한 서로 다른 회원 수
      const dauMap = {};
      for (const r of active30) (dauMap[r.day] = dauMap[r.day] || new Set()).add(r.user_id);
      const dau = []; for (let i = 29; i >= 0; i--) { const d = day(daysAgo(i)); dau.push({ day: d, n: dauMap[d] ? dauMap[d].size : 0 }); }
      // 재참여율: 한 번이라도 참여한 회원 중 서로 다른 모임에 2번 이상 참여한 회원의 비율
      const per = {};
      for (const r of appRows) (per[r.user_id] = per[r.user_id] || new Set()).add(r.trip_id);
      const joined = Object.keys(per).length, rejoined = Object.values(per).filter((s) => s.size >= 2).length;
      const byStatus = {};
      for (const t of tripRows) { const k = t.hidden ? 'hidden' : t.approval_status !== 'approved' ? t.approval_status : t.status; byStatus[k] = (byStatus[k] || 0) + 1; }
      return json(res, 200, {
        totals: { members, new_members_7d: newMembers, trips, trips_public: tripsPublic, applications: apps, participants: joined, dau_today: dau[dau.length - 1].n },
        rejoin: { participants: joined, rejoined, rate: joined ? Math.round((rejoined / joined) * 1000) / 10 : 0 },
        series: { signups: series(profiles30, 'created_at', 30), dau, applications: series(apps30, 'created_at', 30) },
        trips_by_status: byStatus,
        dau_note: '활동 기록은 기능 도입 이후부터 쌓여요.'
      });
    }

    case 'users.list': {
      const q = clip(body.q, 60).toLowerCase();
      const role = ROLES.includes(body.role) ? body.role : '';
      const status = ['active', 'warned', 'suspended'].includes(body.status) ? body.status : '';
      let filter = '';
      if (role) filter += `&role=eq.${role}`;
      if (status) filter += `&status=eq.${status}`;
      const [profiles, emails] = await Promise.all([
        rows(`profiles?select=id,name,role,status,warning_count,trust_score,created_at,suspended_at${filter}&order=created_at.desc&limit=500`),
        authUsers()
      ]);
      let list = profiles.map((p) => ({ ...p, email: (emails.get(p.id) || {}).email || '', last_sign_in_at: (emails.get(p.id) || {}).last_sign_in_at || null }));
      if (q) list = list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
      const reports = await rows("reports?select=target_id&target_type=eq.user&limit=5000");
      const cnt = {}; for (const r of reports) cnt[r.target_id] = (cnt[r.target_id] || 0) + 1;
      return json(res, 200, { users: list.slice(0, 100).map((u) => ({ ...u, reports_against: cnt[u.id] || 0 })), total: list.length });
    }

    case 'users.get': {
      if (!needId(body.id)) return json(res, 400, { error: 'invalid_input' });
      const p = await one(`profiles?select=id,name,role,status,warning_count,trust_score,suspended_at,suspend_reason,created_at&id=eq.${body.id}`);
      if (!p) return json(res, 404, { error: 'no_such_user' });
      const [emails, applications, against, filed, logs] = await Promise.all([
        authUsers(),
        rows(`trip_applications?select=id,status,attendance,created_at,trips(title,start_date)&user_id=eq.${p.id}&order=created_at.desc&limit=50`),
        rows(`reports?select=id,reason,detail,status,created_at,resolution&target_type=eq.user&target_id=eq.${p.id}&order=created_at.desc&limit=50`),
        store.count(`reports?select=id&reporter_id=eq.${p.id}`),
        rows(`admin_logs?select=action,actor_role,detail,created_at&target_type=eq.user&target_id=eq.${p.id}&order=created_at.desc&limit=20`)
      ]);
      const em = emails.get(p.id) || {};
      return json(res, 200, { user: { ...p, email: em.email || '', last_sign_in_at: em.last_sign_in_at || null }, applications, reports_against: against, reports_filed: filed, history: logs });
    }

    case 'users.warn': {
      const g = await guardTarget(body.id); if (g.err) return json(res, g.err[0], { error: g.err[1] });
      const reason = clip(body.reason, 300); if (!reason) return json(res, 400, { error: 'reason_required' });
      const next = g.t.warning_count + 1;
      const upd = await store.update(`profiles?id=eq.${g.t.id}`, { warning_count: next, status: g.t.status === 'suspended' ? 'suspended' : 'warned' });
      if (!upd.ok) return json(res, 502, { error: 'save_failed' });
      await log('user.warn', 'user', g.t.id, { reason, warning_count: next });
      return json(res, 200, { ok: true, warning_count: next });
    }

    case 'users.suspend': {
      const g = await guardTarget(body.id); if (g.err) return json(res, g.err[0], { error: g.err[1] });
      const reason = clip(body.reason, 300); if (!reason) return json(res, 400, { error: 'reason_required' });
      const upd = await store.update(`profiles?id=eq.${g.t.id}`, { status: 'suspended', suspended_at: new Date().toISOString(), suspend_reason: reason });
      if (!upd.ok) return json(res, 502, { error: 'save_failed' });
      await log('user.suspend', 'user', g.t.id, { reason });
      return json(res, 200, { ok: true });
    }

    case 'users.unsuspend': {
      const g = await guardTarget(body.id); if (g.err) return json(res, g.err[0], { error: g.err[1] });
      const upd = await store.update(`profiles?id=eq.${g.t.id}`, { status: g.t.warning_count > 0 ? 'warned' : 'active', suspended_at: null, suspend_reason: null });
      if (!upd.ok) return json(res, 502, { error: 'save_failed' });
      await log('user.unsuspend', 'user', g.t.id, {});
      return json(res, 200, { ok: true });
    }

    case 'users.setRole': {
      const g = await guardTarget(body.id); if (g.err) return json(res, g.err[0], { error: g.err[1] });
      if (!ROLES.includes(body.role)) return json(res, 400, { error: 'invalid_input' });
      if (g.t.role === 'super_admin' && body.role !== 'super_admin') {
        const left = await store.count("profiles?select=id&role=eq.super_admin");
        if (left <= 1) return json(res, 409, { error: 'last_super_admin' });
      }
      const upd = await store.update(`profiles?id=eq.${g.t.id}`, { role: body.role });
      if (!upd.ok) return json(res, 502, { error: 'save_failed' });
      await log('user.setRole', 'user', g.t.id, { from: g.t.role, to: body.role });
      return json(res, 200, { ok: true });
    }

    case 'trips.list': {
      const [trips, apps] = await Promise.all([
        rows('trips?select=id,title,location,start_date,status,hidden,approval_status,capacity,price,created_at&order=sort_order.asc&limit=500'),
        rows('trip_applications?select=trip_id,attendance&status=neq.cancelled&limit=20000')
      ]);
      const agg = {};
      for (const a of apps) { const x = (agg[a.trip_id] = agg[a.trip_id] || { applicants: 0, attended: 0, no_show: 0 }); x.applicants++; if (a.attendance === 'attended') x.attended++; if (a.attendance === 'no_show') x.no_show++; }
      return json(res, 200, { trips: trips.map((t) => ({ ...t, ...(agg[t.id] || { applicants: 0, attended: 0, no_show: 0 }) })) });
    }

    case 'trips.update': {
      if (!needId(body.id)) return json(res, 400, { error: 'invalid_input' });
      const patch = {};
      if (typeof body.hidden === 'boolean') patch.hidden = body.hidden;
      if (['pending', 'approved', 'rejected'].includes(body.approval_status)) patch.approval_status = body.approval_status;
      if (!Object.keys(patch).length) return json(res, 400, { error: 'invalid_input' });
      const upd = await store.update(`trips?id=eq.${body.id}`, patch);
      if (!upd.ok || !(upd.data && upd.data.length)) return json(res, upd.ok ? 404 : 502, { error: upd.ok ? 'no_such_trip' : 'save_failed' });
      await log('trip.update', 'trip', body.id, patch);
      return json(res, 200, { ok: true });
    }

    case 'trips.applicants': {
      if (!needId(body.id)) return json(res, 400, { error: 'invalid_input' });
      const apps = await rows(`trip_applications?select=id,user_id,name,status,attendance,created_at&trip_id=eq.${body.id}&order=created_at.asc&limit=200`);
      const emails = await authUsers();
      return json(res, 200, { applicants: apps.map((a) => ({ id: a.id, user_id: a.user_id, name: a.name, email: (emails.get(a.user_id) || {}).email || '', status: a.status, attendance: a.attendance })) });
    }

    case 'trips.attendance': {
      if (!needId(body.application_id) || !['pending', 'attended', 'no_show'].includes(body.attendance)) return json(res, 400, { error: 'invalid_input' });
      const upd = await store.update(`trip_applications?id=eq.${body.application_id}`, { attendance: body.attendance });
      if (!upd.ok || !(upd.data && upd.data.length)) return json(res, upd.ok ? 404 : 502, { error: upd.ok ? 'no_such_application' : 'save_failed' });
      await log('attendance.set', 'application', body.application_id, { attendance: body.attendance });
      return json(res, 200, { ok: true });
    }

    case 'reports.list': {
      const status = body.status === 'done' ? 'status=neq.pending' : 'status=eq.pending';
      const list = await rows(`reports?select=id,reporter_id,target_type,target_id,reason,detail,status,resolution,handled_at,created_at&${status}&order=created_at.${body.status === 'done' ? 'desc' : 'asc'}&limit=100`);
      const uids = [...new Set(list.map((r) => r.reporter_id).concat(list.filter((r) => r.target_type === 'user').map((r) => r.target_id)).filter((x) => UUID.test(x)))];
      const names = uids.length ? new Map((await rows(`profiles?select=id,name&id=in.(${uids.join(',')})`)).map((p) => [p.id, p.name])) : new Map();
      const out = [];
      for (const r of list) {
        let label = '';
        if (r.target_type === 'user') label = names.get(r.target_id) || '(알 수 없는 회원)';
        else if (r.target_type === 'trip' && UUID.test(r.target_id)) label = ((await one(`trips?select=title&id=eq.${r.target_id}`)) || {}).title || '(삭제된 모임)';
        else if (r.target_type === 'review' && UUID.test(r.target_id)) { const v = await one(`reviews?select=author_name,body&id=eq.${r.target_id}`); label = v ? `${v.author_name}: ${v.body.slice(0, 60)}` : '(삭제된 후기)'; }
        out.push({ ...r, reporter: names.get(r.reporter_id) || '', target_label: label });
      }
      return json(res, 200, { reports: out });
    }

    case 'reports.resolve': {
      if (!needId(body.id)) return json(res, 400, { error: 'invalid_input' });
      const outcome = body.outcome === 'dismissed' ? 'dismissed' : 'resolved';
      const resolution = clip(body.resolution, 500);
      const sanction = ['none', 'warn_target', 'suspend_target', 'hide_target'].includes(body.sanction) ? body.sanction : 'none';
      const rp = await one(`reports?select=id,target_type,target_id,status&id=eq.${body.id}`);
      if (!rp) return json(res, 404, { error: 'no_such_report' });
      if (rp.status !== 'pending') return json(res, 409, { error: 'already_handled' });
      // 함께 처리할 제재(대상이 회원이거나, 후기·모임의 작성자/모임일 때)
      const applied = {};
      if (outcome === 'resolved' && sanction !== 'none') {
        if (sanction === 'hide_target') {
          if (rp.target_type === 'trip' && UUID.test(rp.target_id) && ['super_admin', 'operator'].includes(actor.role)) { await store.update(`trips?id=eq.${rp.target_id}`, { hidden: true }); applied.trip_hidden = rp.target_id; }
          else if (rp.target_type === 'review' && UUID.test(rp.target_id)) { await store.update(`reviews?id=eq.${rp.target_id}`, { approved: false }); applied.review_hidden = rp.target_id; }
          else return json(res, 400, { error: 'sanction_not_applicable' });
        } else {
          let uid = rp.target_type === 'user' ? rp.target_id : '';
          if (rp.target_type === 'review' && UUID.test(rp.target_id)) uid = ((await one(`reviews?select=user_id&id=eq.${rp.target_id}`)) || {}).user_id || '';
          if (!UUID.test(uid)) return json(res, 400, { error: 'sanction_not_applicable' });
          const g = await guardTarget(uid); if (g.err) return json(res, g.err[0], { error: g.err[1] });
          if (sanction === 'suspend_target' && !['super_admin', 'operator'].includes(actor.role)) return json(res, 403, { error: 'forbidden' });
          if (sanction === 'warn_target') await store.update(`profiles?id=eq.${uid}`, { warning_count: g.t.warning_count + 1, status: g.t.status === 'suspended' ? 'suspended' : 'warned' });
          else await store.update(`profiles?id=eq.${uid}`, { status: 'suspended', suspended_at: new Date().toISOString(), suspend_reason: resolution || '신고 처리' });
          applied.user = uid; applied.sanction = sanction;
        }
      }
      const upd = await store.update(`reports?id=eq.${rp.id}&status=eq.pending`, { status: outcome, handled_by: user.id, handled_at: new Date().toISOString(), resolution });
      if (!upd.ok || !(upd.data && upd.data.length)) return json(res, 502, { error: 'save_failed' });
      await log('report.' + outcome, 'report', rp.id, { resolution, ...applied });
      return json(res, 200, { ok: true });
    }

    case 'logs.list': {
      const list = await rows('admin_logs?select=id,actor_id,actor_role,action,target_type,target_id,detail,created_at&order=created_at.desc&limit=100');
      const ids = [...new Set(list.map((l) => l.actor_id).filter((x) => UUID.test(x || '')))];
      const names = ids.length ? new Map((await rows(`profiles?select=id,name&id=in.(${ids.join(',')})`)).map((p) => [p.id, p.name])) : new Map();
      return json(res, 200, { logs: list.map((l) => ({ ...l, actor: names.get(l.actor_id) || '' })) });
    }
  }
  return json(res, 400, { error: 'invalid_action' });
}

module.exports = withErrors('admin', handler);
