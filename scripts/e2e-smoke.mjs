// 브라우저로 핵심 화면과 여정을 확인한다.
// 사용: (다른 터미널에서 `npm run build && npx next start -p 3100 -w apps/web` 실행 후)
//   BASE_URL=http://localhost:3100 node scripts/e2e-smoke.mjs
import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const SHOTS = process.env.SHOT_DIR; // 있으면 화면을 저장한다
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
const page = await ctx.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
const failed = [];
page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
page.on("console", (m) => { if (m.type() === "error" && !m.location().url.endsWith("/places/99999")) problems.push(`console: ${m.text()} [${m.location().url}]`); });
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const step = async (name, fn) => { await fn(); console.log(`✓ ${name}`); };

await step("홈: 제목, 로고, 동네 14곳, 카드", async () => {
  await page.goto(BASE);
  assert.match(await page.locator("h1").textContent(), /실패 없는 맛집/);
  assert.equal(await page.locator('header svg[aria-hidden="true"]').count() >= 1, true);
  assert.equal(await page.locator('section[aria-labelledby="h-area"] a').count(), 14);
  assert.ok((await page.locator("article:visible").count()) >= 1);
  await shot("home");
});

await step("리스트: 동네·상황 필터가 주소와 목록에 반영된다", async () => {
  await page.getByRole("link", { name: "리스트", exact: true }).click();
  await page.waitForURL(/\/list/);
  await page.locator('nav[aria-label="동네"] a').first().waitFor();
  assert.equal(await page.locator('nav[aria-label="동네"] a').count(), 14);
  await page.locator('nav[aria-label="동네"]').getByRole("link", { name: /^연남/ }).click();
  await page.waitForURL(/area=yeonnam/);
  await page.locator("p[aria-live]", { hasText: "연남" }).waitFor();
  assert.match(await page.locator("p[aria-live]").textContent(), /^연남\s+15곳/);
  await page.locator('nav[aria-label="상황"]').getByRole("link", { name: "데이트" }).click();
  await page.waitForURL(/situation=/);
  await page.locator("p[aria-live]", { hasText: "연남 · 데이트" }).waitFor();
  const text = await page.locator("p[aria-live]").textContent();
  const n = Number(text.match(/(\d+)곳/)[1]);
  assert.equal(await page.locator("article:visible").count(), n);
  assert.match(text, /연남 · 데이트/);
  await shot("list");
});

await step("상세: 가기 전에·찾아가기·다녀온 뒤, 외부 링크 안전, 탭 숨김, 뒤로 가기", async () => {
  await page.locator("article:visible a").first().click();
  await page.waitForURL(/\/places\/\d+/);
  await page.getByRole("heading", { name: /다녀온 뒤/ }).waitFor();
  for (const h of ["가기 전에", "찾아가기", "다녀온 뒤"]) assert.ok(await page.getByRole("heading", { name: new RegExp(h) }).isVisible(), h);
  const ext = page.locator('a[href^="https://map.naver.com"]');
  assert.equal(await ext.getAttribute("target"), "_blank");
  assert.match(await ext.getAttribute("rel"), /noopener/);
  assert.equal(await page.locator('nav[aria-label="주요 메뉴"]').count(), 0);
  await shot("detail");
  await page.getByRole("button", { name: "뒤로" }).click();
  await page.waitForURL(/\/list/);
});

await step("검색: 결과, 빈 결과, 추천 검색어", async () => {
  await page.goto(`${BASE}/search`);
  assert.ok((await page.locator('a[href^="/search?q="]').count()) >= 5);
  await page.fill("#q", "파스타");
  await page.press("#q", "Enter");
  await page.waitForURL(/q=/);
  await page.locator("article:visible").first().waitFor();
  assert.ok((await page.locator("article:visible").count()) >= 1);
  await page.goto(`${BASE}/search?q=zzzz없는가게`);
  await page.getByText("맞는 가게가 없습니다").waitFor();
  await shot("search");
});

await step("화면 밝기 전환", async () => {
  await page.goto(BASE);
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.getByRole("button", { name: "화면 밝기 바꾸기" }).click();
  const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.notEqual(before, after);
  assert.ok(["light", "dark"].includes(await page.evaluate(() => document.documentElement.getAttribute("data-theme"))));
  await page.waitForTimeout(400);
  await shot("home-light");
});

await step("안내 페이지와 없는 가게", async () => {
  await page.goto(`${BASE}/about`);
  assert.ok((await page.locator("main a[target=_blank]").count()) >= 10);
  await page.goto(`${BASE}/places/99999`);
  await page.getByText("페이지를 찾을 수 없습니다").waitFor();
});

await step("모바일에서 가로로 넘치지 않는다", async () => {
  for (const path of ["/", "/list", "/list?area=itaewon-hannam", "/search", "/places/1", "/about"]) {
    await page.goto(BASE + path);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, path);
  }
});

await browser.close();
console.log("4xx/5xx 응답:", failed);
assert.deepEqual(problems, [], `브라우저 오류: ${problems.join(" | ")}`);
console.log("모든 화면 확인 통과");
