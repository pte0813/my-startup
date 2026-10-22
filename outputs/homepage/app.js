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
  const tripState = { trips: [], counts: {}, mine: {}, loaded: false, failed: false };
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
      }
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
      else if (mine === 'applied' && t.price > 0) btn = `<button class="btn" type="button" data-pay="${esc(t.id)}">${esc(T('trip_pay'))}</button>`;
      else if (mine && mine !== 'cancelled') btn = `<button class="btn ghost" type="button" disabled>${esc(T('trip_applied'))}</button>`;
      else if (t.capacity && n >= t.capacity) btn = `<button class="btn ghost" type="button" disabled>${esc(T('trip_full'))}</button>`;
      else btn = `<button class="btn" type="button" data-apply="${esc(t.id)}">${esc(T(authUser ? 'trip_apply' : 'trip_apply_login'))}</button>`;
    } else if (t.status === 'upcoming') {
      btn = `<button class="btn ghost" type="button" disabled>${esc(T('st_upcoming'))}</button>`;
    }
    return `<article class="trip-card">
      <div class="trip-cover">${cover}<span class="badge st-${esc(t.status)}">${esc(T('st_' + t.status))}</span></div>
      <div class="trip-body">
        <h3>${esc(t.title)}</h3>
        ${meta ? `<p class="trip-meta">${meta}</p>` : ''}
        ${t.summary ? `<p class="trip-sum">${esc(t.summary)}</p>` : ''}
        <p class="trip-foot"><strong>${t.price > 0 ? esc(money(t.price)) : ''}</strong><span>${esc(seats)}</span></p>
        ${btn}
        ${t.status === 'open' && authUser && !(t.capacity && n >= t.capacity) ? aiBlock(t.id) : ''}
        ${t.status === 'open' && authUser && mine && mine !== 'cancelled' ? iceBlock(t.id) : ''}
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
    const key = await startPayment(authClient, id);
    if (key === 'need_login') { setMsg(msg, ''); openLogin(); }
    else if (key === 'ok') setMsg(msg, '');
    else setMsg(msg, key, 'err');
    btn.disabled = false;
  }

  function initTrips() {
    const wrap = $('#trip-open');
    if (!wrap) return;
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-apply]');
      if (b) applyTrip(b.dataset.apply, b);
      const pb = e.target.closest('[data-pay]');
      if (pb) payTrip(pb.dataset.pay, pb);
      const ab = e.target.closest('[data-ai]');
      if (ab) loadAiMatch(ab.dataset.ai, ab);
      const ib = e.target.closest('[data-ice]');
      if (ib) loadIce(ib.dataset.ice, ib);
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

  function reviewCard(r, mine) {
    const photos = (r.photo_urls || []).filter((u) => safeUrl(u) && u.startsWith(APP_CONFIG.url))
      .map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="" loading="lazy"></a>`).join('');
    const tripTitle = (rv.trips.find((t) => t.id === r.trip_id) || {}).title;
    return `<article class="review">
      <div class="review-head"><strong>${esc(r.author_name)}${mine && !r.approved ? `<span class="pill">${esc(T('rv_pending'))}</span>` : ''}</strong><span class="stars" aria-label="${r.rating}/5">${stars(r.rating)}</span></div>
      ${tripTitle ? `<p class="trip-meta">${esc(tripTitle)}</p>` : ''}
      <p class="review-body">${esc(r.body)}</p>
      ${photos ? `<div class="review-photos">${photos}</div>` : ''}
      <time datetime="${esc(r.created_at)}">${esc(fmtDate(r.created_at))}</time></article>`;
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
  }

  async function loadReviews() {
    try {
      const [a, tr_] = await Promise.all([
        authClient.from('reviews').select('*').eq('approved', true).order('created_at', { ascending: false }).limit(30),
        authClient.from('trips').select('id,title')
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
        const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
        const path = `${authUser.id}/${crypto.randomUUID()}.${ext}`;
        const up = await authClient.storage.from('review-photos').upload(path, file, { contentType: file.type });
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

  /* ---------------- 시작 ---------------- */
  let lastUid;
  window.pageHooks = window.pageHooks || [];
  window.pageHooks.push(() => {
    const uid = authUser ? authUser.id : null;
    const changed = lastUid !== undefined && uid !== lastUid;
    lastUid = uid;
    if (changed) { if (tripState.loaded) loadTrips(); if (rv.loaded) loadReviews(); }
    renderTrips(); renderReviews(); renderSuggest();
  });
  initTrips(); initReviews(); initSuggest(); initContact();
})();
