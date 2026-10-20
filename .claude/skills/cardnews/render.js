#!/usr/bin/env node
// 사용법: node .claude/skills/cardnews/render.js <spec.json> [출력폴더]
// 출력폴더를 생략하면 outputs/cardnews-N (N = 기존 최대 번호 + 1)에 저장한다.
// 이미 있는 폴더에는 절대 쓰지 않는다(이전 카드 덮어쓰기 방지).
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const specPath = process.argv[2];
if (!specPath) { console.error('spec.json 경로가 필요합니다.'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
const brand = JSON.parse(fs.readFileSync(path.join(root, 'brand/brand.json'), 'utf-8'));
const logoSvg = fs.readFileSync(path.join(root, 'brand', path.basename(brand.logo.file)), 'utf-8');

function nextDir() {
  const base = path.join(root, 'outputs');
  fs.mkdirSync(base, { recursive: true });
  const nums = fs.readdirSync(base)
    .map(n => /^cardnews-(\d+)$/.exec(n)).filter(Boolean).map(m => +m[1]);
  return path.join(base, `cardnews-${nums.length ? Math.max(...nums) + 1 : 1}`);
}
const outDir = process.argv[3] ? path.resolve(process.argv[3]) : nextDir();
if (fs.existsSync(outDir)) { console.error(`이미 있는 폴더입니다. 덮어쓰지 않습니다: ${outDir}`); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const L = brand.colors.light;
const themes = {
  light: { bg: L.bg, fg: L.fg, muted: L.muted, line: L.line, accent: L.accent, mark: L.accent, markFg: '#ffffff' },
  cta: { bg: L.accent, fg: '#ffffff', muted: '#dce8fb', line: '#6f9be0', accent: '#ffffff', mark: '#ffffff', markFg: L.accent },
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function mark(t) {
  // logo.svg의 배경색(포인트)과 X 색(흰색)을 테마에 맞게 바꿔 끼운다.
  return logoSvg
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/width="64" height="64"/, 'width="128" height="128"')
    .replace(new RegExp(L.accent, 'gi'), '@@BG@@')
    .replace(/#ffffff/gi, '@@FG@@')
    .replace(/@@BG@@/g, t.mark).replace(/@@FG@@/g, t.markFg);
}

function body(c) {
  const parts = [];
  if (c.label) parts.push(`<div class="label">${esc(c.label)}</div>`);
  parts.push(`<h1>${esc(c.title)}</h1>`);
  if (c.body) parts.push(`<p class="lead">${esc(c.body)}</p>`);
  if (c.items) parts.push(`<div class="list">${c.items.map(i => `<div class="item"><span class="dot"></span>${esc(i)}</div>`).join('')}</div>`);
  if (c.button) parts.push(`<div class="btn">${esc(c.button)}</div>`);
  return parts.join('');
}

function html(c, i, total) {
  const t = themes[c.theme || (i === total - 1 && total > 1 ? 'cta' : 'light')];
  return `<!doctype html><html lang="ko"><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500&family=Noto+Serif+KR:wght@600;700&display=swap">
<style>
*{box-sizing:border-box;margin:0}
html,body{width:1080px;height:1080px}
body{font-family:"IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic","WenQuanYi Zen Hei",sans-serif;background:${t.bg};color:${t.fg};padding:72px 96px;display:flex;flex-direction:column;overflow:hidden}
.top{display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:28px;font-family:"Noto Serif KR","Nanum Myeongjo",serif;font-weight:700;font-size:80px}
.pg{font-size:38px;color:${t.muted};letter-spacing:.06em}
.main{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:36px;padding-block:40px}
.label{font-size:42px;font-weight:500;letter-spacing:.08em;color:${t.accent}}
h1{font-family:"Noto Serif KR","Nanum Myeongjo",serif;font-weight:700;font-size:104px;line-height:1.28;text-wrap:balance;word-break:keep-all}
p.lead{font-size:54px;line-height:1.55;color:${t.muted};word-break:keep-all}
.list{display:flex;flex-direction:column;border-top:2px solid ${t.line}}
.item{display:flex;align-items:center;gap:28px;padding:24px 0;border-bottom:2px solid ${t.line};font-size:54px;font-weight:500}
.dot{width:24px;height:24px;border-radius:50%;background:${t.accent};flex:none}
.foot{font-size:38px;color:${t.muted}}
.btn{display:inline-block;align-self:flex-start;background:${t.fg};color:${t.bg};font-size:54px;font-weight:500;padding:28px 52px;border-radius:22px}
</style>
<body><div class="top"><div class="brand">${mark(t)}<span>${esc(brand.name)}</span></div><div class="pg">${i + 1} / ${total}</div></div>
<div class="main">${body(c)}</div><div class="foot">${esc(c.foot || '')}</div></body></html>`;
}

(async () => {
  let pw;
  try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
  const browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cardnews-'));
  const cards = spec.cards;
  for (let i = 0; i < cards.length; i++) {
    const f = path.join(tmp, `c${i + 1}.html`);
    fs.writeFileSync(f, html(cards[i], i, cards.length));
    await page.goto('file://' + f, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const fit = await page.evaluate(() => { const m = document.querySelector('.main'); return m.scrollHeight <= m.clientHeight + 1; });
    if (!fit) console.warn(`경고: ${i + 1}번 카드 내용이 1080px를 넘칩니다. 글을 줄이세요.`);
    await page.screenshot({ path: path.join(outDir, `card-${String(i + 1).padStart(2, '0')}.png`) });
  }
  await browser.close();
  console.log(outDir);
})().catch(e => { console.error(e.message); process.exit(1); });
