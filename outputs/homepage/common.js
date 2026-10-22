const burger = document.getElementById('burger');
const menu = document.getElementById('menu');
const setOpen = (open) => {
  menu.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
};
burger.addEventListener('click', () => setOpen(!menu.classList.contains('open')));
const header = document.querySelector('header');
const isMobileNav = () => window.matchMedia('(max-width: 1080px)').matches;
const noHover = () => window.matchMedia('(hover: none)').matches;
const setMega = (open) => header.classList.toggle('mega-open', open);
menu.addEventListener('mouseenter', () => { if (!isMobileNav() && !noHover()) setMega(true); });
header.addEventListener('mouseleave', () => setMega(false));
header.addEventListener('focusin', (e) => { if (!isMobileNav() && menu.contains(e.target)) setMega(true); });
header.addEventListener('focusout', (e) => { if (!header.contains(e.relatedTarget)) setMega(false); });
menu.addEventListener('click', (e) => {
  if (e.target.closest('.navbtn')) { setOpen(false); setMega(false); return; }
  const a = e.target.closest('a');
  if (!a) return;
  if (a.classList.contains('top')) {
    const li = a.closest('li.group');
    // 모바일은 눌러서 펼침, 터치 기기의 큰 화면은 첫 탭에 펼침
    if (isMobileNav()) { e.preventDefault(); li.classList.toggle('expanded'); return; }
    if (noHover() && !header.classList.contains('mega-open')) { e.preventDefault(); setMega(true); return; }
  }
  setOpen(false); setMega(false);
});

const I18N = window.I18N;
const PAGE = document.body.dataset.page || 'index';
const SHORT = { ko: 'KO', en: 'EN', zh: '中', ja: '日', es: 'ES' };
const langSel = document.getElementById('lang');
const metaDesc = document.querySelector('meta[name="description"]');
var currentLang = 'ko';
function applyLang(code) {
  const t = I18N[code] || I18N.ko;
  currentLang = code;
  document.documentElement.lang = code;
  document.title = t['t_' + PAGE] || t.t_index;
  if (metaDesc) metaDesc.setAttribute('content', t['d_' + PAGE] || t.d_index);
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t[el.dataset.i18n]; });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t[el.dataset.i18nHtml]; });
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    const [attr, key] = el.dataset.i18nAttr.split(':'); el.setAttribute(attr, t[key]);
  });
  langSel.value = code;
  document.getElementById('lang-ico').textContent = SHORT[code];
  setOpen(false);
  if (window.renderAuthNav) renderAuthNav();
}
function initialLang() {
  try { const saved = localStorage.getItem('lang'); if (I18N[saved]) return saved; } catch (e) {}
  const nav = (navigator.language || 'ko').slice(0, 2).toLowerCase();
  return I18N[nav] ? nav : 'ko';
}
langSel.addEventListener('change', () => {
  applyLang(langSel.value);
  try { localStorage.setItem('lang', langSel.value); } catch (e) {}
});
applyLang(initialLang());

/* ---- 로그인 / 회원가입 / 내 정보 (Supabase 인증) ---- */
var authUser = null;
var authMode = 'login';
var authClient = null;
try {
  if (window.supabase && window.APP_CONFIG) authClient = window.supabase.createClient(APP_CONFIG.url, APP_CONFIG.anonKey);
} catch (e) { authClient = null; }

const authDlg = document.getElementById('auth-dialog');
const authForm = document.getElementById('auth-form');
const authMsg = document.getElementById('auth-msg');
function tr(key) { return (I18N[currentLang] || I18N.ko)[key]; }
const say = (el, key, kind) => { el.textContent = key ? tr(key) : ''; el.className = 'dmsg ' + (kind || ''); };

const PRIVACY_VERSION = '2026-10-22';
// 가입할 때 체크한 개인정보 동의를 프로필에 기록한다(이메일 확인을 켠 경우에는 첫 로그인 때 기록).
async function recordPrivacyConsent(user) {
  try {
    const meta = user && user.user_metadata;
    if (!authClient || !meta || !meta.privacy_consent_at) return;
    const { data } = await authClient.from('profiles').select('privacy_consent_at').eq('id', user.id).maybeSingle();
    if (data && data.privacy_consent_at) return;
    await authClient.from('profiles').upsert({ id: user.id, privacy_consent_at: meta.privacy_consent_at, privacy_consent_version: meta.privacy_consent_version || PRIVACY_VERSION });
  } catch (e) { /* 기록 실패는 로그인을 막지 않는다 */ }
}

function renderAuthNav() {
  const btn = document.getElementById('auth-nav');
  btn.dataset.i18n = authUser ? 'auth_account' : 'auth_login';
  btn.textContent = tr(btn.dataset.i18n);
  (window.pageHooks || []).forEach((f) => f());
}
function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === 'signup';
  document.getElementById('tab-login').setAttribute('aria-selected', String(!signup));
  document.getElementById('tab-signup').setAttribute('aria-selected', String(signup));
  document.getElementById('name-row').hidden = !signup;
  document.getElementById('pw-hint').hidden = !signup;
  document.getElementById('consent-row').hidden = !signup;
  authForm.password.autocomplete = signup ? 'new-password' : 'current-password';
  const submit = document.getElementById('auth-submit');
  submit.dataset.i18n = signup ? 'auth_signup' : 'auth_login';
  submit.textContent = tr(submit.dataset.i18n);
  document.getElementById('auth-title').dataset.i18n = signup ? 'auth_signup' : 'auth_login';
  document.getElementById('auth-title').textContent = tr(signup ? 'auth_signup' : 'auth_login');
  say(authMsg, '');
}
function errKey(err) {
  const msg = (err && err.message || '').toLowerCase(), code = err && err.code || '';
  if (code === 'invalid_credentials' || msg.includes('invalid login')) return 'err_credentials';
  if (code === 'user_already_exists' || msg.includes('already registered')) return 'err_exists';
  if (code === 'email_not_confirmed' || msg.includes('not confirmed')) return 'err_unconfirmed';
  if (code === 'weak_password' || msg.includes('password should')) return 'err_pw';
  if (err && (err.status === 429 || code.includes('rate_limit'))) return 'err_rate';
  return 'err_generic';
}
document.getElementById('auth-nav').addEventListener('click', () => {
  if (!authClient) { authDlg.showModal(); say(authMsg, 'err_unavailable', 'err'); return; }
  if (authUser) { location.href = 'account.html'; return; }
  setAuthMode('login'); authForm.reset(); authDlg.showModal();
});
document.getElementById('tab-login').addEventListener('click', () => setAuthMode('login'));
document.getElementById('tab-signup').addEventListener('click', () => setAuthMode('signup'));
document.querySelectorAll('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!authClient) return say(authMsg, 'err_unavailable', 'err');
  const name = authForm.name.value.trim(), email = authForm.email.value.trim(), password = authForm.password.value;
  if (authMode === 'signup' && !name) return say(authMsg, 'err_name', 'err');
  if (authMode === 'signup' && !authForm.consent.checked) return say(authMsg, 'err_consent', 'err');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say(authMsg, 'err_email', 'err');
  if (password.length < 8) return say(authMsg, 'err_pw', 'err');
  const submit = document.getElementById('auth-submit');
  submit.disabled = true; say(authMsg, 'auth_wait');
  try {
    if (authMode === 'signup') {
      const consentAt = new Date().toISOString();
      const { data, error } = await authClient.auth.signUp({ email, password, options: { data: { name, privacy_consent_at: consentAt, privacy_consent_version: PRIVACY_VERSION } } });
      if (error) return say(authMsg, errKey(error), 'err');
      if (data.session) { authForm.reset(); authDlg.close(); } else { say(authMsg, 'msg_signup_confirm', 'ok'); }
    } else {
      const { error } = await authClient.auth.signInWithPassword({ email, password });
      if (error) return say(authMsg, errKey(error), 'err');
      authForm.reset(); authDlg.close();
    }
  } catch (err) {
    say(authMsg, 'err_generic', 'err');
  } finally {
    submit.disabled = false;
  }
});

if (authClient) {
  authClient.auth.getSession().then(({ data }) => { authUser = data.session ? data.session.user : null; renderAuthNav(); if (authUser) setTimeout(() => recordPrivacyConsent(authUser), 0); });
  authClient.auth.onAuthStateChange((_event, session) => { authUser = session ? session.user : null; renderAuthNav(); if (authUser) setTimeout(() => recordPrivacyConsent(authUser), 0); });
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setOpen(false); setMega(false); } });
  

/* 맨 위로 버튼 */
const toTop = document.getElementById('to-top');
const onScroll = () => toTop.classList.toggle('show', window.scrollY > 400);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();
toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
