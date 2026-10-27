/* 페이지별 기능: 여행 목록·신청(trips), 후기(reviews), 상품 제안(community), 문의(contact)
   common.js의 authClient · authUser · tr · currentLang · setAuthMode · authForm · authDlg를 그대로 쓴다. */
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const T = (key, vars) => {
    let s = tr(key) || '';
    for (const k in (vars || {})) s = s.replace('{' + k + '}', vars[k]);
    return s;
  };
  const loc = () => (currentLang === 'zh' ? 'zh-CN' : currentLang);
  const fmtDay = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString(loc(), { month: 'short', day: 'numeric' }) : '');
  const fmtDate = (ts) => new Date(ts).toLocaleDateString(loc());
  const money = (n) => new Intl.NumberFormat(loc(), { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n);
  const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
  const setMsg = (el, key, kind) => { if (el) { el.textContent = key ? T(key) : ''; el.className = 'fmsg ' + (kind || ''); } };
  const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');
  const openLogin = () => {
    if (!authClient) { authDlg.showModal(); return; }
    setAuthMode('login'); authForm.reset(); authDlg.showModal();
  };
  document.addEventListener('click', (e) => { if (e.target.closest('[data-open-login]')) openLogin(); });

  let nameCache = { uid: null, name: '' };
  async function myName() {
    if (nameCache.uid === authUser.id) return nameCache.name;
    let name = (authUser.user_metadata && authUser.user_metadata.name) || '';
    const { data } = await authClient.from('profiles').select('name').eq('id', authUser.id).maybeSingle();
    if (data && data.name) name = data.name;
    nameCache = { uid: authUser.id, name: name || (authUser.email || '').split('@')[0] };
    return nameCache.name;
  }

  /* ---------------- 여행 목록·신청 ---------------- */
  const tripState = { trips: [], counts: {}, mine: {}, coupons: [], watch: {}, loaded: false, failed: false };
  const GRIDS = { open: 'grid-open', upcoming: 'grid-upcoming', past: 'grid-past' };

  async function loadTrips() {
    try {
      const [t, c] = await Promise.all([
        authClient.from('trips').select('*').order('sort_order').order('start_date'),
        authClient.from('trip_counts').select('trip_id,n')
      ]);
      if (t.error) throw t.error;
      tripState.trips = t.data || [];
      tripState.counts = {};
      (c.data || []).forEach((r) => { tripState.counts[r.trip_id] = r.n; });
      tripState.mine = {};
      if (authUser) {
        const m = await authClient.from('trip_applications').select('trip_id,status');
        (m.data || []).forEach((r) => { tripState.mine[r.trip_id] = r.status; });
        // 결제 때 고를 수 있는 내 할인 쿠폰(정률·정액, 사용 가능·미만료)
        const cp = await authClient.from('user_coupons').select('id,expires_at,coupon_templates(name,type,value)').eq('status', 'active').gt('expires_at', new Date().toISOString()).order('expires_at');
        tripState.coupons = (cp.data || []).filter((c) => c.coupon_templates && (c.coupon_templates.type === 'percent' || c.coupon_templates.type === 'amount'));
        tripState.passes = (cp.data || []).filter((c) => c.coupon_templates && c.coupon_templates.type === 'priority').length;
        const w = await authClient.from('trip_watch').select('trip_id');
        tripState.watch = {};
        (w.data || []).forEach((r) => { tripState.watch[r.trip_id] = true; });
      } else { tripState.coupons = []; tripState.passes = 0; tripState.watch = {}; }
      tripState.failed = false;
    } catch (e) { tripState.failed = true; }
    tripState.loaded = true;
    renderTrips();
  }

  // 사진(cover_url)이 없으면 장소 이름으로 어울리는 일러스트를 고르고, 단서가 없으면 여행마다 고정된 일러스트를 쓴다
  function coverKind(t) {
    const text = ((t.location || '') + ' ' + (t.title || '')).toLowerCase();
    if (/바다|해변|해수욕|섬|제주|부산|강릉|속초|양양|여수|거제|울릉|발리|하와이|괌|세부|보라카이|다낭|푸껫|beach|sea|island|bali|hawaii|jeju/.test(text)) return 'sea';
    if (/산|설악|한라|지리|등산|트레킹|캠핑|알프스|히말라야|mount|hike|trek|alps/.test(text)) return 'mountain';
    if (/서울|도쿄|동경|오사카|교토|후쿠오카|파리|런던|뉴욕|방콕|홍콩|타이베이|상하이|싱가포르|도시|seoul|tokyo|osaka|kyoto|paris|london|bangkok|city/.test(text)) return 'city';
    const kinds = ['sky', 'sea', 'mountain', 'city'];
    let h = 0;
    for (const ch of String(t.id || t.title || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return kinds[h % kinds.length];
  }

  /* ---- AI 추천: 같은 여행 신청자 중 나와 잘 맞는 사람 ---- */
  const aiState = {}; // 여행 id → { status: 'loading'|'done'|'error'|'consent'|'off', data }
  const AIO = () => window.AI_OPTIONS || { interests: {}, travel_styles: {}, active_times: {} };
  const aiName = (group, k) => { const o = AIO()[group][k]; return o ? (o[currentLang] || o.ko) : k; };
  function aiPanelHtml(id) {
    const st = aiState[id];
    if (!st) return '';
    if (st.status === 'loading') return `<p class="note">${esc(T('ai_loading'))}</p>`;
    if (st.status === 'consent') return `<p class="note">${esc(T('ai_need_consent'))}</p><a class="btn ghost small" href="account.html">${esc(T('ai_go_profile'))}</a>`;
    if (st.status === 'off') return `<p class="note">${esc(T('ai_unavailable'))}</p>`;
    if (st.status === 'error') return `<p class="note">${esc(T('ai_err'))}</p>`;
    const d = st.data, ms = d.matches || [];
    if (!ms.length) return `<p class="note">${esc(T('ai_none'))}</p>`;
    const items = ms.map((m) => {
      const tags = [].concat(m.shared.interests.map((k) => aiName('interests', k)), m.shared.travel_styles.map((k) => aiName('travel_styles', k)), m.shared.active_times.map((k) => aiName('active_times', k)));
      if (m.shared.mbti) tags.push(T('ai_mbti_similar'));
      const why = m.reason && st.lang === currentLang ? esc(m.reason) : esc(T('ai_common', { list: tags.join(', ') }));
      return `<li><div class="ai-top"><strong>${esc(T('ai_person', { id: m.id }))}</strong><span class="pill">${esc(T('ai_score', { n: m.score }))}</span></div><p>${why}</p><div class="ai-tags">${tags.map((x) => `<span>${esc(x)}</span>`).join('')}</div></li>`;
    }).join('');
    return `<p class="ai-head">${esc(T('ai_headline', { n: ms.length }))}</p><ul class="ai-list">${items}</ul>${d.limited ? `<p class="note">${esc(T('ai_limit'))}</p>` : ''}<p class="note">${esc(T('ai_note'))}</p>`;
  }
  function aiBlock(id) {
    return `<button class="btn ghost ai-btn" type="button" data-ai="${esc(id)}">✨ ${esc(T('ai_btn'))}</button><div class="ai-panel" data-ai-panel="${esc(id)}" aria-live="polite">${aiPanelHtml(id)}</div>`;
  }
  function paintAi(id) {
    const el = document.querySelector(`[data-ai-panel="${id}"]`);
    if (el) el.innerHTML = aiPanelHtml(id);
  }
  async function loadAiMatch(id, btn) {
    aiState[id] = { status: 'loading' }; paintAi(id); btn.disabled = true;
    try {
      const { data } = await authClient.auth.getSession();
      const token = data && data.session && data.session.access_token;
      if (!token) { aiState[id] = { status: 'error' }; return; }
      const res = await fetch('/api/ai-match', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ trip_id: id, lang: currentLang }) });
      let body = null;
      try { body = await res.json(); } catch (e) { /* 서버 함수가 없는 환경 */ }
      if (res.status === 403 && body && (body.error === 'consent_required' || body.error === 'profile_empty')) aiState[id] = { status: 'consent' };
      else if (res.status === 404 && !body) aiState[id] = { status: 'off' };
      else if (res.status === 503 || res.status === 405 || res.status === 404) aiState[id] = { status: 'off' };
      else if (!res.ok || !body) aiState[id] = { status: 'error' };
      else aiState[id] = { status: 'done', data: body, lang: currentLang };
    } catch (e) {
      aiState[id] = { status: 'off' };
    } finally {
      btn.disabled = false; paintAi(id);
    }
  }

  /* ---- AI 아이스브레이킹: 신청한 여행의 대화 주제·밸런스 게임·자기소개 템플릿 ---- */
  const iceState = {};
  function iceText(st) {
    const c = st.data && st.data.content;
    const topics = c ? c.topics.map((x) => '• ' + x).join('\n') : '';
    const games = c ? c.balance_games.map((g) => g.a + ' ' + T('ice_vs') + ' ' + g.b).join('\n') : '';
    return [c && c.opener, topics && T('ice_topics') + '\n' + topics, games && T('ice_games') + '\n' + games, T('ice_intro') + '\n' + (c ? c.intro_template : T('ice_generic_intro'))].filter(Boolean).join('\n\n');
  }
  function icePanelHtml(id) {
    const st = iceState[id];
    if (!st) return '';
    if (st.status === 'loading') return `<p class="note">${esc(T('ice_loading'))}</p>`;
    if (st.status === 'off') return `<p class="note">${esc(T('ai_unavailable'))}</p>`;
    if (st.status === 'error') return `<p class="note">${esc(T('ice_err'))}</p>`;
    const d = st.data, c = d.content;
    const tags = [].concat(d.stats.interests.map((x) => [aiName('interests', x.k), x.n]), d.stats.travel_styles.map((x) => [aiName('travel_styles', x.k), x.n]), d.stats.active_times.map((x) => [aiName('active_times', x.k), x.n]));
    const common = tags.length ? `<div class="ai-tags">${tags.map(([n, c2]) => `<span>${esc(n)} · ${esc(T('ice_people', { n: c2 }))}</span>`).join('')}</div>` : `<p class="note">${esc(T('ice_no_common'))}</p>`;
    const sec = (title, inner) => `<div class="ice-sec"><h4>${esc(title)}</h4>${inner}</div>`;
    let html = sec(T('ice_common'), common);
    if (c) {
      html += sec(T('ice_opener'), `<p class="ice-pre">${esc(c.opener)}</p>`);
      html += sec(T('ice_topics'), `<ul class="ice-list">${c.topics.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`);
      html += sec(T('ice_games'), `<ul class="ice-games">${c.balance_games.map((g) => `<li><span>${esc(g.a)}</span><b>${esc(T('ice_vs'))}</b><span>${esc(g.b)}</span></li>`).join('')}</ul>`);
      html += sec(T('ice_intro'), `<p class="ice-pre">${esc(c.intro_template)}</p>`);
    } else {
      html += sec(T('ice_intro'), `<p class="ice-pre">${esc(T('ice_generic_intro'))}</p>`);
      html += `<p class="note">${esc(d.limited ? T('ice_limit') : T('ice_generic_note'))}</p>`;
    }
    return html + `<button class="btn ghost small" type="button" data-ice-copy="${esc(id)}">${esc(T('ice_copy'))}</button><p class="note ice-copied" data-ice-copied="${esc(id)}" hidden>${esc(T('ice_copied'))}</p>`;
  }
  function iceBlock(id) {
    return `<button class="btn ghost ice-btn" type="button" data-ice="${esc(id)}">${esc(T('ice_btn'))}</button><div class="ai-panel" data-ice-panel="${esc(id)}" aria-live="polite">${icePanelHtml(id)}</div>`;
  }
  function paintIce(id) {
    const el = document.querySelector(`[data-ice-panel="${id}"]`);
    if (el) el.innerHTML = icePanelHtml(id);
  }
  async function loadIce(id, btn) {
    iceState[id] = { status: 'loading' }; paintIce(id); btn.disabled = true;
    try {
      const { data } = await authClient.auth.getSession();
      const token = data && data.session && data.session.access_token;
      if (!token) { iceState[id] = { status: 'error' }; return; }
      const res = await fetch('/api/ai-icebreaker', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ trip_id: id, lang: currentLang }) });
      let body = null;
      try { body = await res.json(); } catch (e) { /* 서버 함수가 없는 환경 */ }
      if (res.status === 503 || res.status === 405 || (res.status === 404 && !body)) iceState[id] = { status: 'off' };
      else if (!res.ok || !body) iceState[id] = { status: 'error' };
      else iceState[id] = { status: 'done', data: body, lang: currentLang };
    } catch (e) {
      iceState[id] = { status: 'off' };
    } finally {
      btn.disabled = false; paintIce(id);
    }
  }
  async function copyIce(id) {
    const st = iceState[id];
    if (!st || st.status !== 'done') return;
    const text = iceText(st);
    try { await navigator.clipboard.writeText(text); } catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e2) { /* 복사 불가 환경 */ }
      ta.remove();
    }
    const msg = document.querySelector(`[data-ice-copied="${id}"]`);
    if (msg) { msg.hidden = false; setTimeout(() => { msg.hidden = true; }, 2000); }
  }

  /* ---- 재만남: 지난 여행에서 다시 만나고 싶은 사람 고르기 (서로 골랐을 때만 성사) ---- */
  const reState = {}; // 여행 id → { status, data, suggest: { [applicationId]: {status, data} } }
  async function reCall(payload) {
    const { data } = await authClient.auth.getSession();
    const token = data && data.session && data.session.access_token;
    if (!token) return { status: 401, body: null };
    try {
      const res = await fetch('/api/reunion', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ ...payload, lang: currentLang }) });
      let body = null;
      try { body = await res.json(); } catch (e) { /* 서버 함수가 없는 환경 */ }
      return { status: res.status, body };
    } catch (e) { return { status: 0, body: null }; }
  }
  function reHtml(id) {
    const st = reState[id];
    if (!st || st.open === false) return '';
    if (st.status === 'loading') return `<p class="note">${esc(T('re_loading'))}</p>`;
    if (st.status === 'off') return `<p class="note">${esc(T('re_off'))}</p>`;
    if (st.status === 'error') return `<p class="note">${esc(T('re_err'))}</p>`;
    const d = st.data;
    const intro = `<p class="note">${esc(T('re_desc', { n: d.max_picks }))}</p>`;
    if (!d.candidates.length) return intro + `<p class="note">${esc(T('re_empty'))}</p>`;
    const rows = d.candidates.map((c) => {
      const sg = (st.suggest || {})[c.application_id];
      let extra = '';
      if (c.matched) {
        extra = `<span class="pill">${esc(T('re_matched'))}</span><button class="btn ghost small" type="button" data-re-suggest="${esc(id)}" data-app="${esc(c.application_id)}">${esc(T('re_suggest'))}</button>`;
        if (sg && sg.status === 'loading') extra += `<p class="note">${esc(T('re_suggest_loading'))}</p>`;
        else if (sg && sg.status === 'done') {
          const trips = sg.data.trips || [];
          extra += trips.length
            ? `<p class="re-sug">${esc(sg.data.text || '')}</p><ul class="re-trips">${trips.map((x) => `<li>${esc(x.title)}${x.location ? ` · ${esc(x.location)}` : ''}</li>`).join('')}</ul><a class="btn small" href="trips.html#trip-open">${esc(T('re_suggest_go'))}</a>`
            : `<p class="note">${esc(T('re_suggest_none'))}</p>`;
        } else if (sg) extra += `<p class="note">${esc(T('re_err'))}</p>`;
      }
      const optsB = AIO();
      const chips = (c.badges || []).map((b) => `<span class="badge-chip" title="${esc(((optsB.badge_desc || {})[b] || {})[currentLang] || '')}">${esc((((optsB.badges || {})[b]) || {})[currentLang] || b)}</span>`).join('');
      const mOpen = ((st.manner || {})[c.application_id] || {}).open;
      const mTags = optsB.manner_tags || [];
      const mBox = c.no_show ? '' : (mOpen
        ? `<div class="manner-box"><p class="note">${esc(T('mn_hint'))}</p><div class="chips">${mTags.map((tg) => `<label><input type="checkbox" value="${esc(tg)}" data-manner-tag${(c.manner_given || []).includes(tg) ? ' checked disabled' : ''}><span>${esc((((optsB.badges || {})[tg]) || {})[currentLang] || tg)}</span></label>`).join('')}</div><button class="btn small" type="button" data-manner-send="${esc(id)}" data-app="${esc(c.application_id)}">${esc(T('mn_send'))}</button></div>`
        : `<button class="btn ghost small" type="button" data-manner-open="${esc(id)}" data-app="${esc(c.application_id)}">${esc(T('mn_btn'))}</button>`);
      return `<li class="re-row${c.matched ? ' matched' : ''}"><div class="re-main"><strong>${esc(c.name)}</strong><button class="link-btn" type="button" data-report="user" data-trip="${esc(id)}" data-app="${esc(c.application_id)}" data-label="${esc(c.name)}">${esc(T('report_btn'))}</button><button class="btn small${c.picked ? '' : ' ghost'}" type="button" data-re-toggle="${esc(id)}" data-app="${esc(c.application_id)}" data-picked="${c.picked ? 1 : 0}" aria-pressed="${c.picked}">${esc(T(c.picked ? 're_picked' : 're_pick'))}</button></div>${chips ? `<div class="badge-chips">${chips}</div>` : ''}${mBox}${extra ? `<div class="re-extra">${extra}</div>` : ''}</li>`;
    }).join('');
    return intro + `<ul class="re-list">${rows}</ul>`;
  }
  function reBlock(id) {
    return `<button class="btn ghost re-btn" type="button" data-re="${esc(id)}">${esc(T('re_btn'))}</button><div class="ai-panel" data-re-panel="${esc(id)}" aria-live="polite">${reHtml(id)}</div>`;
  }
  function paintRe(id) { const el = document.querySelector(`[data-re-panel="${id}"]`); if (el) el.innerHTML = reHtml(id); }
  function reApply(id, r) {
    if (r.status === 200 && r.body && r.body.candidates) reState[id] = { ...(reState[id] || {}), status: 'done', data: r.body };
    else if (r.status === 409 && r.body && r.body.error === 'too_many_picks') { const m = $('#trip-msg'); setMsg(m, null); if (m) { m.textContent = T('re_limit', { n: r.body.max }); m.className = 'fmsg err'; } }
    else if (r.status === 503 || r.status === 405 || (r.status === 404 && !r.body)) reState[id] = { status: 'off' };
    else reState[id] = { ...(reState[id] || {}), status: reState[id] && reState[id].data ? 'done' : 'error' };
    paintRe(id);
  }
  async function loadRe(id, btn) {
    const open = reState[id] && reState[id].open;
    if (open) { reState[id].open = false; const el = document.querySelector(`[data-re-panel="${id}"]`); if (el) el.innerHTML = ''; return; }
    reState[id] = { status: 'loading', open: true }; paintRe(id); btn.disabled = true;
    const r = await reCall({ action: 'list', trip_id: id });
    reState[id].open = true; reApply(id, r); btn.disabled = false;
  }
  async function toggleRe(id, appId, picked, btn) {
    btn.disabled = true;
    const r = await reCall({ action: picked ? 'unpick' : 'pick', trip_id: id, application_id: appId });
    reApply(id, r);
  }
  async function suggestRe(id, appId, btn) {
    const st = reState[id]; st.suggest = st.suggest || {}; st.suggest[appId] = { status: 'loading' }; paintRe(id);
    const r = await reCall({ action: 'suggest', trip_id: id, application_id: appId });
    st.suggest[appId] = r.status === 200 && r.body ? { status: 'done', data: r.body } : { status: 'error' };
    paintRe(id);
  }

  function openManner(id, appId) {
    const st = reState[id]; if (!st) return;
    st.manner = st.manner || {}; st.manner[appId] = { open: true };
    paintRe(id);
  }
  async function sendManner(id, appId, btn) {
    const panel = document.querySelector(`[data-re-panel="${id}"]`);
    const tags = [...btn.closest('.manner-box').querySelectorAll('[data-manner-tag]:checked:not(:disabled)')].map((i) => i.value);
    const m = $('#trip-msg');
    if (!tags.length) { m.textContent = T('mn_pick'); m.className = 'fmsg err'; return; }
    btn.disabled = true;
    const r = await reCall({ action: 'manner', trip_id: id, application_id: appId, tags });
    if (r.status === 200 && r.body && r.body.candidates) {
      reState[id] = { ...(reState[id] || {}), status: 'done', data: r.body };
      reState[id].manner = { ...(reState[id].manner || {}), [appId]: { open: false } };
      m.textContent = T('mn_sent'); m.className = 'fmsg ok';
    } else {
      m.textContent = T(r.status === 403 && r.body && r.body.error === 'no_show' ? 'mn_noshow' : 're_err'); m.className = 'fmsg err';
    }
    paintRe(id);
    if (panel) btn.disabled = false;
  }

  function couponPicker(tripId) {
    if (!tripState.coupons.length) return '';
    const opts = tripState.coupons.map((c) => `<option value="${esc(c.id)}">${esc(L10n(c.coupon_templates.name))}</option>`).join('');
    return `<label class="pay-coupon">${esc(T('pay_coupon_label'))}<select data-coupon-for="${esc(tripId)}"><option value="">${esc(T('pay_coupon_none'))}</option>${opts}</select></label>`;
  }

  function tripCard(t) {
    const n = tripState.counts[t.id] || 0;
    const mine = tripState.mine[t.id];
    const cover = safeUrl(t.cover_url) ? `<img src="${esc(t.cover_url)}" alt="" loading="lazy">` : `<img class="art" src="art/cover-${coverKind(t)}.svg" alt="" loading="lazy">`;
    const dates = t.start_date ? (t.end_date && t.end_date !== t.start_date ? fmtDay(t.start_date) + ' – ' + fmtDay(t.end_date) : fmtDay(t.start_date)) : '';
    const meta = [t.location, dates].filter(Boolean).map(esc).join(' · ');
    const seats = t.capacity ? T('trip_seats', { n, cap: t.capacity }) : (n ? T('trip_count', { n }) : '');
    let btn = '';
    if (t.status === 'open') {
      if (mine === 'paid') btn = `<button class="btn ghost" type="button" disabled>${esc(T('trip_paid'))}</button>`;
      else if (mine === 'applied' && t.price > 0) btn = couponPicker(t.id) + `<button class="btn" type="button" data-pay="${esc(t.id)}">${esc(T('trip_pay'))}</button>`;
      else if (mine && mine !== 'cancelled') btn = `<button class="btn ghost" type="button" disabled>${esc(T('trip_applied'))}</button>`;
      else if (t.capacity && n >= t.capacity) btn = `<button class="btn ghost" type="button" disabled>${esc(T('trip_full'))}</button>`;
      else btn = `<button class="btn" type="button" data-apply="${esc(t.id)}">${esc(T(authUser ? 'trip_apply' : 'trip_apply_login'))}</button>`;
    } else if (t.status === 'upcoming') {
      btn = tripState.passes && !mine ? `<button class="btn" type="button" data-priority="${esc(t.id)}">${esc(T('trip_priority'))}</button>` : `<button class="btn ghost" type="button" disabled>${esc(T('st_upcoming'))}</button>`;
    }
    return `<article class="trip-card">
      <div class="trip-cover">${cover}<span class="badge st-${esc(t.status)}">${esc(T('st_' + t.status))}</span></div>
      <div class="trip-body">
        <h3>${esc(t.title)}</h3>
        ${meta ? `<p class="trip-meta">${meta}</p>` : ''}
        ${t.summary ? `<p class="trip-sum">${esc(t.summary)}</p>` : ''}
        <p class="trip-foot"><strong>${t.price > 0 ? esc(money(t.price)) : ''}</strong><span>${esc(seats)}</span></p>
        ${btn}
        ${t.status === 'open' && authUser && !mine ? `<button class="link-btn" type="button" data-watch="${esc(t.id)}">${esc(T(tripState.watch[t.id] ? 'trip_watching' : 'trip_watch'))}</button>` : ''}
        ${`<button class="link-btn" type="button" data-share-trip="${esc(t.id)}" data-title="${esc(t.title)}">${esc(T('trip_share'))}</button>`}
        ${t.status === 'open' && authUser && !(t.capacity && n >= t.capacity) ? aiBlock(t.id) : ''}
        ${t.status === 'open' && authUser && mine && mine !== 'cancelled' ? iceBlock(t.id) : ''}
        ${t.status === 'past' && authUser && mine && mine !== 'cancelled' ? reBlock(t.id) : ''}
        <button class="link-btn" type="button" data-report="trip" data-id="${esc(t.id)}" data-label="${esc(t.title)}">${esc(T('report_btn'))}</button>
      </div></article>`;
  }

  function renderTrips() {
    if (!tripState.loaded) return;
    for (const status in GRIDS) {
      const grid = $('#' + GRIDS[status]);
      if (!grid) continue;
      if (tripState.failed) { grid.innerHTML = `<p class="note">${esc(T('trip_load_err'))}</p>`; continue; }
      const list = tripState.trips.filter((t) => t.status === status);
      if (status === 'past') list.reverse();
      grid.innerHTML = list.length ? list.map(tripCard).join('') : `<p class="note">${esc(T('trip_empty'))}</p>`;
    }
  }

  async function applyTrip(id, btn) {
    const msg = $('#trip-msg');
    if (!authUser) return openLogin();
    btn.disabled = true;
    try {
      const name = await myName();
      const { error } = await authClient.from('trip_applications').insert({ trip_id: id, name });
      if (error) {
        const dup = error.code === '23505' || /duplicate/i.test(error.message || '');
        setMsg(msg, dup ? 'trip_dup' : 'trip_fail', 'err');
      } else {
        setMsg(msg, 'trip_ok', 'ok');
      }
    } catch (e) { setMsg(msg, 'trip_fail', 'err'); }
    await loadTrips();
  }

  async function payTrip(id, btn) {
    const msg = $('#trip-msg');
    btn.disabled = true; setMsg(msg, 'pay_opening');
    const sel = document.querySelector('[data-coupon-for="' + id + '"]');
    const key = await startPayment(authClient, id, sel && sel.value ? sel.value : null);
    if (key === 'need_login') { setMsg(msg, ''); openLogin(); }
    else if (key === 'ok') setMsg(msg, '');
    else setMsg(msg, key, 'err');
    btn.disabled = false;
  }

  async function toggleWatch(id, btn) {
    const msg = $('#trip-msg');
    btn.disabled = true;
    const on = !!tripState.watch[id];
    const r = on ? await authClient.from('trip_watch').delete().eq('trip_id', id).eq('user_id', authUser.id) : await authClient.from('trip_watch').insert({ trip_id: id, user_id: authUser.id });
    if (r.error && r.error.code !== '23505') setMsg(msg, 'q_err_generic', 'err');
    else { tripState.watch[id] = !on; setMsg(msg, on ? 'trip_watch_off' : 'trip_watch_ok', 'ok'); }
    renderTrips();
  }

  // 모임 링크 공유: 로그인 상태면 내 초대 코드를 붙여 친구가 가입하면 둘 다 쿠폰을 받는다
  let myInviteCode = null;
  async function shareTrip(id, title) {
    const msg = $('#trip-msg');
    if (authUser && !myInviteCode) { const r = await growth('overview'); if (r.ok) myInviteCode = r.data.invite_code; }
    const url = `${location.origin}/trip/${id}${myInviteCode ? '?ref=' + myInviteCode : ''}`;
    try {
      if (navigator.share) { await navigator.share({ title, text: title, url }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); setMsg(msg, 'trip_share_copied', 'ok'); }
    catch (e) { window.prompt(T('trip_share'), url); }
  }

  async function priorityTrip(id, btn) {
    const msg = $('#trip-msg');
    btn.disabled = true;
    const r = await gamify('priority.apply', { trip_id: id });
    if (r.ok) setMsg(msg, 'trip_priority_ok', 'ok');
    else { msg.textContent = errText(r.error); msg.className = 'fmsg err'; }
    await loadTrips();
  }

  function initTrips() {
    const wrap = $('#trip-open');
    if (!wrap) return;
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-apply]');
      if (b) applyTrip(b.dataset.apply, b);
      const pb = e.target.closest('[data-pay]');
      if (pb) payTrip(pb.dataset.pay, pb);
      const pr = e.target.closest('[data-priority]');
      if (pr) priorityTrip(pr.dataset.priority, pr);
      const wb = e.target.closest('[data-watch]');
      if (wb) toggleWatch(wb.dataset.watch, wb);
      const sb = e.target.closest('[data-share-trip]');
      if (sb) shareTrip(sb.dataset.shareTrip, sb.dataset.title);
      const ab = e.target.closest('[data-ai]');
      if (ab) loadAiMatch(ab.dataset.ai, ab);
      const ib = e.target.closest('[data-ice]');
      if (ib) loadIce(ib.dataset.ice, ib);
      const rb = e.target.closest('[data-re]');
      if (rb) loadRe(rb.dataset.re, rb);
      const rt = e.target.closest('[data-re-toggle]');
      if (rt) toggleRe(rt.dataset.reToggle, rt.dataset.app, rt.dataset.picked === '1', rt);
      const rs = e.target.closest('[data-re-suggest]');
      if (rs) suggestRe(rs.dataset.reSuggest, rs.dataset.app, rs);
      const mo = e.target.closest('[data-manner-open]');
      if (mo) openManner(mo.dataset.mannerOpen, mo.dataset.app);
      const ms = e.target.closest('[data-manner-send]');
      if (ms) sendManner(ms.dataset.mannerSend, ms.dataset.app, ms);
      const cb = e.target.closest('[data-ice-copy]');
      if (cb) copyIce(cb.dataset.iceCopy);
    });
    window.addEventListener('pay-error', () => setMsg($('#trip-msg'), 'pay_fail', 'err'));
    ['open', 'upcoming', 'past'].forEach((s) => { const g = $('#' + GRIDS[s]); if (g) g.innerHTML = `<p class="note">${esc(T('loading'))}</p>`; });
    if (!authClient) { tripState.loaded = true; tripState.failed = true; renderTrips(); return; }
    loadTrips();
  }

  /* ---------------- 후기 ---------------- */
  const rv = { list: [], mine: [], trips: [], loaded: false, failed: false };

  /* ---- 후기 카드: AI가 다듬은 문구 + 사진으로 인스타 공유용 이미지(피드 4:5 · 스토리 9:16)를 브라우저에서 그린다 ---- */
  const rcState = {}; // 후기 id → { status, data }
  const CARD_SIZES = { feed: [1080, 1350, 700], story: [1080, 1920, 1150] }; // [가로, 세로, 사진 높이]
  const NAVY = '#1F3A5F', CORAL = '#FF6B5B', CREAM = '#FFF1D6';
  function rcLoadImage(src, cors) {
    return new Promise((resolve) => {
      const img = new Image();
      if (cors) img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
  function rcWrap(ctx, text, maxW, maxLines) {
    const lines = [];
    let line = '';
    const push = (l) => { lines.push(l); line = ''; };
    for (const word of String(text || '').split(/(\s+)/)) {
      if (!word) continue;
      const tryLine = line + word;
      if (ctx.measureText(tryLine.trim()).width <= maxW) { line = tryLine; continue; }
      if (line.trim()) push(line.trim());
      line = '';
      for (const ch of word.trim() === '' ? '' : word) {
        if (ctx.measureText((line + ch).trim()).width > maxW && line) push(line.trim());
        line += ch;
      }
    }
    if (line.trim()) lines.push(line.trim());
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,1}$/, '…'); }
    return lines;
  }
  function rcRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function rcDraw(canvas, kind, d, photo, art) {
    const [W, H, PH] = CARD_SIZES[kind];
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = CREAM; ctx.fillRect(0, 0, W, H);
    // 사진(또는 일러스트): 가로를 꽉 채우고 위아래를 잘라 맞춘다
    const img = photo || art;
    if (img) {
      const s = Math.max(W / img.width, PH / img.height), w = img.width * s, h = img.height * s;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, PH); ctx.clip(); ctx.drawImage(img, (W - w) / 2, (PH - h) / 2, w, h); ctx.restore();
    }
    // 위쪽 브랜드 표시
    ctx.fillStyle = '#fff'; rcRoundRect(ctx, 50, 50, 270, 84, 42); ctx.fill();
    ctx.fillStyle = NAVY; ctx.beginPath(); ctx.arc(100, 92, 20, 0, 7); ctx.fill();
    ctx.fillStyle = CORAL; ctx.beginPath(); ctx.arc(128, 92, 20, 0, 7); ctx.fill();
    ctx.fillStyle = NAVY; ctx.font = '40px Jua, sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText('함께닿', 170, 94);
    // 아래 흰 카드
    const y0 = PH - 70, cardH = H - 50 - y0;
    ctx.fillStyle = '#fff'; rcRoundRect(ctx, 50, y0, W - 100, cardH, 56); ctx.fill();
    const x = 100, maxW = W - 200;
    let y = y0 + 80;
    ctx.textBaseline = 'alphabetic';
    if (d.trip_title) { ctx.fillStyle = 'rgba(31,58,95,.7)'; ctx.font = '500 34px "Noto Sans KR", sans-serif'; ctx.fillText(rcWrap(ctx, d.trip_title, maxW, 1)[0] || '', x, y); y += 70; }
    ctx.fillStyle = CORAL; ctx.font = '56px Jua, sans-serif';
    const r = Math.max(0, Math.min(5, Number(d.rating) || 0));
    ctx.fillText('★'.repeat(r) + '☆'.repeat(5 - r), x, y); y += 40 + 52;
    ctx.fillStyle = NAVY; ctx.font = '72px Jua, sans-serif';
    for (const l of rcWrap(ctx, d.headline, maxW, 2)) { ctx.fillText(l, x, y); y += 84; }
    y += 6; ctx.fillStyle = 'rgba(31,58,95,.85)'; ctx.font = '700 50px Gaegu, "Noto Sans KR", sans-serif';
    for (const l of rcWrap(ctx, d.caption, maxW, kind === 'story' ? 5 : 3)) { ctx.fillText(l, x, y); y += 64; }
    const tags = (d.hashtags || []).map((h) => '#' + h).join('  ');
    ctx.fillStyle = CORAL; ctx.font = '40px Jua, sans-serif';
    ctx.fillText(rcWrap(ctx, tags, maxW, 1)[0] || '', x, H - 50 - 56);
  }
  async function rcPaint(id) {
    const st = rcState[id];
    const box = document.querySelector(`[data-rc-panel="${id}"]`);
    if (!box) return;
    if (!st) { box.innerHTML = ''; return; }
    if (st.status === 'loading') { box.innerHTML = `<p class="note">${esc(T('rc_loading'))}</p>`; return; }
    if (st.status === 'off') { box.innerHTML = `<p class="note">${esc(T('ai_unavailable'))}</p>`; return; }
    if (st.status === 'error') { box.innerHTML = `<p class="note">${esc(T('rc_err'))}</p>`; return; }
    const d = st.data;
    const note = d.ai ? '' : `<p class="note">${esc(d.limited ? T('rc_limit') : T('rc_basic'))}</p>`;
    box.innerHTML = `${note}<div class="rc-cards">${['feed', 'story'].map((k) => `<figure><canvas data-rc-canvas="${k}" role="img" aria-label="${esc(d.headline)}"></canvas><figcaption>${esc(T('rc_' + k))}</figcaption><button class="btn small" type="button" data-rc-dl="${esc(id)}" data-kind="${k}">${esc(T('rc_download'))}</button></figure>`).join('')}</div><p class="note">${esc(T('rc_share_tip'))}</p>`;
    try { await Promise.all(['72px Jua', '700 50px Gaegu', '500 34px "Noto Sans KR"'].map((f) => document.fonts.load(f, '함께닿'))); } catch (e) { /* 글꼴을 못 불러와도 기본 글꼴로 그린다 */ }
    const review = rv.mine.find((x) => x.id === id) || {};
    const photoUrl = (review.photo_urls || []).find((u) => safeUrl(u) && u.startsWith(APP_CONFIG.url));
    const photo = photoUrl ? await rcLoadImage(photoUrl, true) : null;
    const trip = rv.trips.find((x) => x.id === review.trip_id) || {};
    const art = await rcLoadImage(`art/cover-${coverKind({ id: review.trip_id, title: trip.title, location: trip.location })}.svg`, false);
    if (rcState[id] !== st) return; // 그리는 동안 상태가 바뀌었으면 중단
    box.querySelectorAll('canvas').forEach((c) => rcDraw(c, c.dataset.rcCanvas, d, photo, art));
  }
  async function makeCard(id, btn) {
    rcState[id] = { status: 'loading' }; rcPaint(id); btn.disabled = true;
    try {
      const { data } = await authClient.auth.getSession();
      const token = data && data.session && data.session.access_token;
      if (!token) { rcState[id] = { status: 'error' }; return; }
      const res = await fetch('/api/ai-review-card', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ review_id: id, lang: currentLang }) });
      let body = null;
      try { body = await res.json(); } catch (e) { /* 서버 함수가 없는 환경 */ }
      if (res.status === 503 || res.status === 405 || (res.status === 404 && !body)) rcState[id] = { status: 'off' };
      else if (!res.ok || !body || !body.headline) rcState[id] = { status: 'error' };
      else rcState[id] = { status: 'done', data: body };
    } catch (e) {
      rcState[id] = { status: 'off' };
    } finally {
      btn.disabled = false; rcPaint(id);
    }
  }
  function downloadCard(id, kind) {
    const c = document.querySelector(`[data-rc-panel="${id}"] canvas[data-rc-canvas="${kind}"]`);
    if (!c) return;
    c.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `hamkkedat-review-${kind}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  }

  function reviewCard(r, mine) {
    const photos = (r.photo_urls || []).filter((u) => safeUrl(u) && u.startsWith(APP_CONFIG.url))
      .map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="" loading="lazy"></a>`).join('');
    const tripTitle = (rv.trips.find((t) => t.id === r.trip_id) || {}).title;
    return `<article class="review">
      <div class="review-head"><strong>${esc(r.author_name)}${mine && !r.approved ? `<span class="pill">${esc(T('rv_pending'))}</span>` : ''}</strong><span class="stars" aria-label="${r.rating}/5">${stars(r.rating)}</span></div>
      ${tripTitle ? `<p class="trip-meta">${esc(tripTitle)}</p>` : ''}
      <p class="review-body">${esc(r.body)}</p>
      ${photos ? `<div class="review-photos">${photos}</div>` : ''}
      <time datetime="${esc(r.created_at)}">${esc(fmtDate(r.created_at))}</time>
      ${mine ? '' : `<button class="link-btn" type="button" data-report="review" data-id="${esc(r.id)}" data-label="${esc(r.author_name)}">${esc(T('report_btn'))}</button>`}
      ${mine ? `<button class="btn ghost small rc-btn" type="button" data-rc="${esc(r.id)}">${esc(T('rc_btn'))}</button><p class="rc-notice">${esc(T('rc_notice'))}</p><div class="rc-panel" data-rc-panel="${esc(r.id)}" aria-live="polite"></div>` : ''}</article>`;
  }

  function renderReviews() {
    const list = $('#review-list');
    if (!list || !rv.loaded) return;
    list.innerHTML = rv.failed ? `<p class="note">${esc(T('rv_load_err'))}</p>`
      : rv.list.length ? rv.list.map((r) => reviewCard(r, false)).join('') : `<p class="note">${esc(T('rv_empty'))}</p>`;
    const signedIn = !!authUser;
    $('#rv-need').hidden = signedIn;
    $('#rv-form').hidden = !signedIn;
    $('#rv-mine-wrap').hidden = !(signedIn && rv.mine.length);
    $('#rv-mine').innerHTML = rv.mine.map((r) => reviewCard(r, true)).join('');
    const sel = $('#rv-trip'), keep = sel.value;
    sel.innerHTML = `<option value="">${esc(T('rv_trip_none'))}</option>` + rv.trips.map((t) => `<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('');
    sel.value = keep;
    Object.keys(rcState).forEach(rcPaint);
  }

  async function loadReviews() {
    try {
      const [a, tr_] = await Promise.all([
        authClient.from('reviews').select('*').eq('approved', true).order('created_at', { ascending: false }).limit(30),
        authClient.from('trips').select('id,title,location')
      ]);
      if (a.error) throw a.error;
      rv.list = a.data || []; rv.trips = tr_.data || [];
      rv.mine = [];
      if (authUser) {
        const m = await authClient.from('reviews').select('*').eq('user_id', authUser.id).order('created_at', { ascending: false });
        rv.mine = m.data || [];
      }
      rv.failed = false;
    } catch (e) { rv.failed = true; }
    rv.loaded = true;
    renderReviews();
  }

  const okType = (f) => /^image\/(jpeg|png|webp)$/.test(f.type);
  // 사진에 들어 있는 위치·기기 정보(EXIF)를 지우기 위해 캔버스에 다시 그려서 올린다(긴 변 2000px 이하). 실패하면 올리지 않는다.
  async function stripPhoto(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise((res) => c.toBlob(res, type, 0.88));
    if (!blob) throw new Error('strip_failed');
    return { blob, type };
  }
  async function submitReview(e) {
    e.preventDefault();
    const f = e.target, msg = $('#rv-msg'), btn = $('#rv-submit');
    const body = f.body.value.trim();
    const files = [...f.photos.files];
    if (body.length < 10) return setMsg(msg, 'rv_err_body', 'err');
    if (files.length > 3 || files.some((x) => !okType(x) || x.size > 5 * 1024 * 1024)) return setMsg(msg, 'rv_err_photo', 'err');
    btn.disabled = true; setMsg(msg, 'auth_wait');
    try {
      const urls = [];
      for (const file of files) {
        const { blob, type } = await stripPhoto(file);
        const path = `${authUser.id}/${crypto.randomUUID()}.${type === 'image/png' ? 'png' : 'jpg'}`;
        const up = await authClient.storage.from('review-photos').upload(path, blob, { contentType: type });
        if (up.error) throw up.error;
        urls.push(authClient.storage.from('review-photos').getPublicUrl(path).data.publicUrl);
      }
      const { error } = await authClient.from('reviews').insert({
        trip_id: f.trip.value || null, author_name: await myName(), rating: Number(f.rating.value), body, photo_urls: urls
      });
      if (error) throw error;
      f.reset(); setMsg(msg, 'rv_ok', 'ok');
      loadReviews();
    } catch (err) { setMsg(msg, 'rv_err', 'err'); }
    finally { btn.disabled = false; }
  }

  function initReviews() {
    if (!$('#review-list')) return;
    $('#rv-form').addEventListener('submit', submitReview);
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rc]');
      if (b) makeCard(b.dataset.rc, b);
      const dl = e.target.closest('[data-rc-dl]');
      if (dl) downloadCard(dl.dataset.rcDl, dl.dataset.kind);
    });
    $('#review-list').innerHTML = `<p class="note">${esc(T('loading'))}</p>`;
    if (!authClient) { rv.loaded = true; rv.failed = true; renderReviews(); return; }
    loadReviews();
  }

  /* ---------------- 상품 제안 ---------------- */
  function renderSuggest() {
    const form = $('#sg-form');
    if (!form) return;
    form.hidden = !authUser;
    $('#sg-need').hidden = !!authUser;
  }
  function initSuggest() {
    const form = $('#sg-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = $('#sg-msg'), btn = $('#sg-submit');
      const title = form.title.value.trim(), body = form.body.value.trim();
      if (!title || body.length < 10) return setMsg(msg, 'sg_err', 'err');
      btn.disabled = true; setMsg(msg, 'auth_wait');
      const { error } = await authClient.from('suggestions').insert({ title, body });
      if (error) setMsg(msg, 'sg_fail', 'err'); else { form.reset(); setMsg(msg, 'sg_ok', 'ok'); }
      btn.disabled = false;
    });
    renderSuggest();
  }

  /* ---------------- 문의 ---------------- */
  function initContact() {
    const form = $('#ct-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = $('#ct-msg'), btn = $('#ct-submit');
      if (form.company.value) return setMsg(msg, 'ct_ok', 'ok'); // 봇은 조용히 통과
      const name = form.name.value.trim(), email = form.email.value.trim(), message = form.message.value.trim();
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10) return setMsg(msg, 'ct_err', 'err');
      if (!form.consent.checked) return setMsg(msg, 'err_consent', 'err');
      btn.disabled = true; setMsg(msg, 'auth_wait');
      try {
        let ok = false;
        try {
          const r = await fetch('/api/inquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, message }) });
          const info = await r.json().catch(() => ({}));
          // 서버 함수가 없거나 환경변수가 아직 없으면 직접 저장으로 넘어가고, 그 외에는 서버 함수의 결과를 따른다
          if (r.status === 404 || r.status === 405 || info.error === 'server_not_configured') throw new Error('no-api');
          ok = r.ok;
        } catch (apiErr) {
          // 서버 함수가 없는 곳(로컬 파일 열기 등)에서는 Supabase에 바로 저장한다(확인 메일은 나가지 않음)
          if (!authClient) throw apiErr;
          const { error } = await authClient.from('inquiries').insert({ name, email, message });
          ok = !error;
        }
        if (ok) { form.reset(); setMsg(msg, 'ct_ok', 'ok'); } else setMsg(msg, 'ct_fail', 'err');
      } catch (err) { setMsg(msg, 'ct_fail', 'err'); }
      btn.disabled = false;
    });
  }

  /* ---------------- 신고 ---------------- */
  let reportTarget = null;
  function openReport(el) {
    if (!authUser) { setMsg($('#trip-msg'), 'report_login', 'err'); return openLogin(); }
    reportTarget = { type: el.dataset.report, id: el.dataset.id, trip: el.dataset.trip, app: el.dataset.app };
    const f = $('#report-form'); f.reset();
    $('#report-target').textContent = T('report_target', { name: el.dataset.label || '' });
    setReportMsg('');
    $('#report-dialog').showModal();
  }
  function setReportMsg(key, kind) { const m = $('#report-msg'); m.textContent = key ? T(key) : ''; m.className = 'dmsg ' + (kind || ''); }
  function initReports() {
    const form = $('#report-form');
    if (!form) return;
    document.addEventListener('click', (e) => { const b = e.target.closest('[data-report]'); if (b) openReport(b); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!reportTarget || !authUser) return;
      const btn = $('#report-submit'); btn.disabled = true; setReportMsg('auth_wait');
      const reason = form.reason.value, detail = form.detail.value.trim().slice(0, 1000);
      let key = 'report_fail';
      try {
        if (reportTarget.type === 'user') {
          const r = await reCall({ action: 'report', trip_id: reportTarget.trip, application_id: reportTarget.app, reason, detail });
          key = r.status === 200 ? 'report_ok' : r.status === 409 ? 'report_dup' : 'report_fail';
        } else {
          const { error } = await authClient.from('reports').insert({ target_type: reportTarget.type, target_id: reportTarget.id, reason, detail });
          key = !error ? 'report_ok' : (error.code === '23505' ? 'report_dup' : 'report_fail');
        }
      } catch (err) { key = 'report_fail'; }
      setReportMsg(key, key === 'report_ok' ? 'ok' : 'err');
      btn.disabled = false;
      if (key === 'report_ok') setTimeout(() => { const d = $('#report-dialog'); if (d.open) d.close(); }, 1200);
    });
  }

  /* ---------------- 서버 기능 호출(/api/gamify) ---------------- */
  async function callApi(path, action, params) {
    const { data } = await authClient.auth.getSession();
    const token = data && data.session && data.session.access_token;
    if (!token) return { ok: false, error: 'unauthorized' };
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(Object.assign({ action }, params || {})) });
      const j = await r.json().catch(() => ({}));
      return r.ok ? { ok: true, data: j } : { ok: false, error: r.status === 503 || r.status === 404 && !j.error ? 'unavailable' : (j.error || 'generic') };
    } catch (e) { return { ok: false, error: 'unavailable' }; }
  }
  const gamify = (action, params) => callApi('/api/gamify', action, params);
  const growth = (action, params) => callApi('/api/gamify', 'invite.' + action, params); // 'overview' | 'redeem'
  const errText = (code) => T('q_err_' + code) || T('q_err_generic');
  // DB에 JSON 문자열(언어별)로 저장된 이름을 현재 언어로 고른다
  const L10n = (v) => {
    let o = v;
    if (typeof v === 'string') { try { o = JSON.parse(v); } catch (e) { return v; } }
    return o && typeof o === 'object' ? (o[currentLang] || o.ko || o.en || '') : String(o || '');
  };
  const interestName = (k) => { const i = (window.AI_OPTIONS || {}).interests || {}; return i[k] ? (i[k][currentLang] || i[k].ko) : k; };

  /* ---------------- 퀘스트 페이지 ---------------- */
  const quest = { ov: null, result: null, ranking: null, inv: null, cardMsg: '', loaded: false, msg: '' };

  async function loadQuest() {
    if (!authUser) { quest.ov = null; return renderQuest(); }
    const r = await gamify('overview');
    quest.loaded = true;
    if (!r.ok) { quest.ov = null; quest.msg = errText(r.error); } else { quest.ov = r.data; quest.msg = ''; }
    if (quest.ov && quest.ov.season) { const k = await gamify('crew.ranking'); quest.ranking = k.ok ? k.data.ranking : []; }
    const iv = await growth('overview'); quest.inv = iv.ok ? iv.data : null;
    if (quest.inv) myInviteCode = quest.inv.invite_code;
    renderQuest();
  }

  function renderQuest() {
    const body = $('#q-body');
    if (!body) return;
    $('#q-need').hidden = !!authUser;
    const msg = $('#q-msg'); msg.textContent = quest.msg || ''; msg.className = 'fmsg' + (quest.msg ? ' err' : '');
    const o = quest.ov;
    body.hidden = !o;
    if (!o) return;
    const span = Math.max(1, o.next_level_xp - o.level_start_xp);
    const pct = Math.min(100, Math.round(((o.xp - o.level_start_xp) / span) * 100));
    const rules = (o.rules || []).map((r) => `<li><span>${esc(T('q_rule_' + r.kind) || r.label)}</span><strong>+${r.xp} XP</strong></li>`).join('');
    const level = `<div class="card">
      <div class="q-lv">${esc(T('q_level', { n: o.level }))}</div>
      <div class="q-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
      <p>${esc(T('q_xp', { xp: o.xp, left: Math.max(0, o.next_level_xp - o.xp) }))}</p>
      <details><summary>${esc(T('q_rules_t'))}</summary><ul class="q-list">${rules}</ul></details></div>`;

    let check = '';
    const q = o.question;
    if (q) {
      const res = quest.result;
      const aTxt = L10n(q.a), bTxt = L10n(q.b);
      const inner = o.checked_in_today
        ? `<p>${esc(T('q_checked'))}</p>${res ? `<p><strong>A</strong> ${esc(aTxt)} — ${esc(res.a)} / <strong>B</strong> ${esc(bTxt)} — ${esc(res.b)}</p>` : `<p>${esc(o.today_choice === 'a' ? aTxt : bTxt)} ✔</p>`}`
        : `<div class="q-choices"><button class="btn" type="button" data-q-choice="a">${esc(aTxt)}</button><button class="btn ghost" type="button" data-q-choice="b">${esc(bTxt)}</button></div>`;
      check = `<div class="card"><h3>${esc(T('q_checkin_t'))}</h3><p><strong>${esc(L10n(q.question))}</strong></p>${inner}<p class="note">${esc(T('q_streak', { n: o.streak }))}</p></div>`;
    }

    const titles = `<div class="card"><h3>${esc(T('q_titles_t'))}</h3>${o.titles.length
      ? `<div class="q-chips">${o.titles.map((t) => `<span class="q-chip">${esc(T('q_title_name', { interest: interestName(t) }))}</span>`).join('')}</div>`
      : `<p class="note">${esc(T('q_titles_empty'))}</p>`}</div>`;

    const boards = `<div class="card"><h3>${esc(T('q_boards_t'))}</h3>${o.boards.map((b) => {
      const name = b.kind === 'region' ? (c) => c : interestName;
      return `<div><strong>${esc(L10n(b.title))}</strong> <span class="note">${b.progress}/${b.goal}</span>
        <div class="q-bar"><i style="width:${Math.round((b.progress / b.goal) * 100)}%"></i></div>
        <div class="q-chips">${b.collected.map((c) => `<span class="q-chip">${esc(b.kind === 'region' ? regionName(c) : name(c))}</span>`).join('')}</div>
        ${b.done ? `<p class="note">${esc(T('q_board_done'))}</p>` : ''}</div>`;
    }).join('')}</div>`;

    const couponRows = o.coupons.map((c) => {
      const t = c.template || {};
      const stat = c.status === 'used' ? T('q_coupon_used') : c.status === 'expired' ? T('q_coupon_expired') : T('q_coupon_exp', { date: fmtDate(c.expires_at) });
      return `<li><span>${esc(L10n(t.name))}</span><span class="note">${esc(stat)}</span></li>`;
    }).join('');
    const coupons = `<div class="card"><h3>${esc(T('q_coupons_t'))}</h3>${couponRows ? `<ul class="q-list">${couponRows}</ul>` : `<p class="note">${esc(T('q_coupons_empty'))}</p>`}</div>`;

    let season = '';
    if (o.season) {
      const s = o.season, c = o.crew;
      let crewHtml;
      if (!c) {
        crewHtml = `<p>${esc(T('q_crew_none'))}</p>
          <form class="q-row" data-q-form="create"><input type="text" name="name" maxlength="20" required placeholder="${esc(T('q_crew_name_ph'))}" aria-label="${esc(T('q_crew_name_ph'))}"><button class="btn" type="submit">${esc(T('q_crew_create'))}</button></form>
          <form class="q-row" data-q-form="join"><input type="text" name="code" maxlength="6" required placeholder="${esc(T('q_crew_code_ph'))}" aria-label="${esc(T('q_crew_code_ph'))}"><button class="btn ghost" type="submit">${esc(T('q_crew_join'))}</button></form>`;
      } else {
        crewHtml = `<p><strong>${esc(c.name)}</strong> · ${esc(T('q_crew_members', { n: c.members.length }))}</p>
          <p class="note">${esc(T('q_crew_code', { code: c.code }))}</p>
          <p class="note">${c.members.map((m) => esc(m.name || '—') + (m.owner ? ' ★' : '')).join(', ')}</p>
          <button class="link-btn" type="button" data-q-leave>${esc(T('q_crew_leave'))}</button>`;
      }
      const missions = s.missions.map((m) => `<li><span>${esc(L10n(m.title))} <span class="note">${esc(T('q_mission_prog', { n: m.progress, goal: m.goal }))}</span></span>
        ${m.claimed ? `<span class="note">${esc(T('q_claimed'))}</span>` : m.done && m.reward ? `<button class="btn small" type="button" data-q-claim="${esc(m.id)}">${esc(T('q_claim'))}</button>` : ''}</li>`).join('');
      const rank = (quest.ranking || []).map((r) => `<li class="${r.mine ? 'q-rank-me' : ''}">${esc(T('q_rank_row', { rank: r.rank, name: r.name, xp: r.xp, members: r.members }))}</li>`).join('');
      season = `<div class="card q-wide"><h3>${esc(T('q_season_t'))} · ${esc(L10n(s.name))}</h3>${crewHtml}
        ${c && missions ? `<h4>${esc(T('q_missions_t'))}</h4><ul class="q-list">${missions}</ul>` : ''}
        <h4>${esc(T('q_rank_t'))}</h4>${rank ? `<ol class="q-list">${rank}</ol>` : `<p class="note">${esc(T('q_rank_empty'))}</p>`}</div>`;
    }
    let invite = '';
    if (quest.inv) {
      const v = quest.inv;
      invite = `<div class="card"><h3>${esc(T('inv_t'))}</h3><p>${esc(T('inv_desc', { cap: v.monthly_cap }))}</p>
        <p><strong>${esc(T('inv_code', { code: v.invite_code }))}</strong></p>
        <button class="btn small q-card-btn" type="button" data-inv-copy>${esc(T('inv_copy'))}</button>
        <p class="note">${esc(T('inv_count', { n: v.invited }))}</p></div>`;
    }
    const cards = `<div class="card"><h3>${esc(T('sc_t'))}</h3><p>${esc(T('sc_desc'))}</p>
      <div class="q-row">${[['me-title', 'story', 'sc_title_story'], ['me-title', 'og', 'sc_title_feed'], ['me-report', 'story', 'sc_report_story'], ['me-report', 'og', 'sc_report_feed']].map((c) => `<button class="btn ghost small" type="button" data-share-card="${c[0]}" data-size="${c[1]}">${esc(T(c[2]))}</button>`).join('')}</div>
      <p class="note" id="sc-msg" role="status" aria-live="polite">${esc(quest.cardMsg)}</p><p class="note">${esc(T('sc_report_hint'))}</p></div>`;
    body.innerHTML = level + check + titles + boards + coupons + invite + cards + season;
  }

  const regionName = (r) => ({ asia: { ko: '아시아', en: 'Asia', zh: '亚洲', ja: 'アジア', es: 'Asia' }, europe: { ko: '유럽', en: 'Europe', zh: '欧洲', ja: 'ヨーロッパ', es: 'Europa' }, americas: { ko: '아메리카', en: 'Americas', zh: '美洲', ja: 'アメリカ', es: 'América' }, oceania: { ko: '오세아니아', en: 'Oceania', zh: '大洋洲', ja: 'オセアニア', es: 'Oceanía' }, africa: { ko: '아프리카', en: 'Africa', zh: '非洲', ja: 'アフリカ', es: 'África' }, domestic: { ko: '국내', en: 'Korea', zh: '韩国', ja: '韓国', es: 'Corea' } }[r] || { ko: r })[currentLang] || r;

  async function questAct(action, params) {
    quest.msg = '';
    const r = await gamify(action, params);
    if (!r.ok) { quest.msg = errText(r.error); renderQuest(); return null; }
    quest.ov = r.data;
    if (r.data.result) quest.result = r.data.result;
    if (quest.ov.season) { const k = await gamify('crew.ranking'); quest.ranking = k.ok ? k.data.ranking : []; }
    renderQuest();
    if (typeof loadNotifs === 'function') loadNotifs();
    return r.data;
  }

  async function copyInvite() {
    const url = `${location.origin}/?ref=${quest.inv.invite_code}`;
    try {
      if (navigator.share) { await navigator.share({ title: '함께닿', text: T('inv_share_text'), url }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(url); quest.cardMsg = T('inv_copied'); }
    catch (e) { window.prompt(T('inv_copy'), url); return; }
    renderQuest();
  }

  // 내 칭호·성향 카드: 로그인 토큰으로 /api/og에서 PNG를 받아 파일로 저장한다(스토리 1080x1920, 피드 1200x630)
  async function downloadCard(type, size, btn) {
    btn.disabled = true; quest.cardMsg = T('sc_working'); const note = $('#sc-msg'); if (note) note.textContent = quest.cardMsg;
    try {
      const { data } = await authClient.auth.getSession();
      const token = data && data.session && data.session.access_token;
      const r = await fetch(`/api/og?type=${type}&size=${size}&lang=${currentLang === 'ko' ? 'ko' : 'en'}`, { headers: { Authorization: 'Bearer ' + token } });
      if (!r.ok) throw new Error('og ' + r.status);
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a'); a.href = url; a.download = `hamkkedat-${type}-${size}.png`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
      quest.cardMsg = '';
    } catch (e) { quest.cardMsg = T('sc_fail'); }
    const n2 = $('#sc-msg'); if (n2) n2.textContent = quest.cardMsg;
    btn.disabled = false;
  }

  function initQuest() {
    if (!$('#q-body')) return;
    document.addEventListener('click', (e) => {
      const c = e.target.closest('[data-q-choice]');
      if (c) { c.disabled = true; questAct('checkin', { choice: c.dataset.qChoice }); }
      const cl = e.target.closest('[data-q-claim]');
      if (cl) { cl.disabled = true; questAct('crew.claim', { mission_id: cl.dataset.qClaim }); }
      if (e.target.closest('[data-q-leave]') && confirm(T('q_crew_leave_confirm'))) questAct('crew.leave');
      if (e.target.closest('[data-inv-copy]') && quest.inv) copyInvite();
      const sc = e.target.closest('[data-share-card]');
      if (sc) downloadCard(sc.dataset.shareCard, sc.dataset.size, sc);
    });
    document.addEventListener('submit', (e) => {
      const f = e.target.closest('[data-q-form]');
      if (!f) return;
      e.preventDefault();
      const fd = new FormData(f);
      if (f.dataset.qForm === 'create') questAct('crew.create', { name: String(fd.get('name') || '') });
      else questAct('crew.join', { code: String(fd.get('code') || '') });
    });
  }

  /* ---------------- 개인정보 처리방침: 한국어가 정본, 그 외 언어는 영어 참고 번역 + 안내 ---------------- */
  function renderPrivacy() {
    const ko = document.querySelector('[data-policy="ko"]'), en = document.querySelector('[data-policy="en"]');
    if (!ko || !en) return;
    const isKo = currentLang === 'ko';
    ko.hidden = !isKo; en.hidden = isKo;
    const note = $('#policy-lang-note'), text = tr('privacy_lang_note');
    note.hidden = !(text && !isKo && currentLang !== 'en'); note.textContent = text || '';
  }

  /* ---------------- 시작 ---------------- */
  let lastUid, questUid;
  window.pageHooks = window.pageHooks || [];
  const pageHook = () => {
    const uid = authUser ? authUser.id : null;
    const changed = lastUid !== undefined && uid !== lastUid;
    lastUid = uid;
    if (changed) { if (tripState.loaded) loadTrips(); if (rv.loaded) loadReviews(); }
    if ($('#q-body') && questUid !== uid) { questUid = uid; loadQuest(); }
    renderTrips(); renderReviews(); renderSuggest(); renderPrivacy(); renderQuest();
  };
  window.pageHooks.push(pageHook);
  initTrips(); initReviews(); initSuggest(); initContact(); initReports(); initQuest();
  if ($('#q-body')) pageHook(); // 로그인 확인이 이 파일보다 먼저 끝났을 수 있어 한 번 직접 실행한다
})();
