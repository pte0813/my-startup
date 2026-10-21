// 접근성 자동 점검: axe-core 로 주요 화면을 밝은/어두운 테마에서 검사한다.
// 사용: 운영 빌드를 3100 포트에 띄운 뒤 `node scripts/a11y.mjs`
import { chromium } from "playwright-core";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const axeSrc = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const PATHS = ["/", "/list", "/search", "/search?q=성수", "/places/1", "/about", "/login", "/me", "/offline", "/places/1/review/new", "/admin/places/new"];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
let total = 0;
for (const theme of ["dark", "light"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, colorScheme: theme });
  await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch {} }, theme);
  const page = await ctx.newPage();
  for (const path of PATHS) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.evaluate(axeSrc);
    const res = await page.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] }));
    for (const v of res.violations) {
      total++;
      console.log(`[${theme}] ${path} · ${v.id} (${v.impact}) ×${v.nodes.length}: ${v.help}`);
      for (const n of v.nodes.slice(0, 2)) console.log(`    ${n.target.join(" ")} — ${(n.any[0] ?? n.all[0] ?? n.none[0])?.message ?? ""}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log(total === 0 ? "접근성 위반 없음" : `위반 ${total}건`);
process.exit(total === 0 ? 0 : 1);
