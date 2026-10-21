// 로그인 이후 흐름(찜, 후기 쓰기·삭제, 가게 추가, 사진 등록, 권한별 화면)을 브라우저로 확인한다.
// 실제 Supabase 대신 scripts/mock-supabase.mjs 를 띄우고 Next 개발 서버를 그쪽에 연결한다.
//   node scripts/e2e-auth.mjs
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { sessionCookie, startMockSupabase } from "./mock-supabase.mjs";

const MOCK_PORT = 54399;
const APP_PORT = 3101;
const BASE = `http://localhost:${APP_PORT}`;
const SHOTS = process.env.SHOT_DIR;

const mock = await startMockSupabase(MOCK_PORT);
const next = spawn("npx", ["next", "dev", "-p", String(APP_PORT)], {
  cwd: new URL("../apps/web", import.meta.url).pathname,
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${MOCK_PORT}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key", NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let nextLog = "";
next.stdout.on("data", (d) => (nextLog += d));
next.stderr.on("data", (d) => (nextLog += d));
const stop = async () => { next.kill("SIGTERM"); mock.close(); };
process.on("exit", () => next.kill("SIGTERM"));

for (let i = 0; i < 120; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch { /* 아직 시작 중 */ }
  await new Promise((r) => setTimeout(r, 1000));
  if (i === 119) { console.error(nextLog.slice(-2000)); await stop(); process.exit(1); }
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const problems = [];
let current = "";
const newPage = async (user) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  if (user) await ctx.addCookies([sessionCookie(user, APP_PORT)]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(45_000);
  page.on("pageerror", (e) => problems.push(`[${current}] pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) problems.push(`[${current}] ${page.url()} console: ${m.text().split("\n")[0]}`); });
  return page;
};
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const step = async (name, fn) => { current = name; try { await fn(); console.log(`✓ ${name}`); } catch (e) { console.error(`✗ ${name}\n${e.stack}`); await stop(); process.exit(1); } };
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

await step("방문자: 로그인 메일 요청, 상세에서 로그인 안내", async () => {
  const page = await newPage(null);
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "someone@example.com");
  await page.getByRole("button", { name: "로그인 링크 받기" }).click();
  await page.getByText("로그인 링크를 보냈습니다").waitFor();
  assert.ok((await (await fetch(`http://localhost:${MOCK_PORT}/__log`)).json()).some((l) => l.startsWith("POST /auth/v1/otp")));
  await shot(page, "auth-login-sent");
  await page.goto(`${BASE}/places/1`);
  await page.getByText("로그인하면 가게를 찜할 수 있습니다").waitFor();
  await page.goto(`${BASE}/me`);
  await page.getByRole("link", { name: "로그인" }).waitFor();
  await page.context().close();
});

await step("회원: 찜하기·해제, 마이에서 찜 목록, 후기는 못 쓴다", async () => {
  const page = await newPage("member");
  await page.goto(`${BASE}/places/1`);
  await page.getByRole("button", { name: "♡ 찜하기" }).click();
  await page.getByRole("button", { name: "♥ 찜 해제" }).waitFor();
  assert.equal(await page.getByRole("link", { name: "후기 쓰기" }).count(), 0);
  await page.goto(`${BASE}/me`);
  await page.getByRole("heading", { name: /내가 찜한 가게/ }).waitFor();
  await page.getByText("도도한면").first().waitFor();
  assert.equal(await page.getByRole("heading", { name: /내가 남긴 후기/ }).count(), 0);
  await shot(page, "auth-me-member");
  await page.goto(`${BASE}/places/1/review/new`);
  await page.getByText("후기는 에디터만 남길 수 있습니다").waitFor();
  await page.goto(`${BASE}/places/1`);
  await page.getByRole("button", { name: "♥ 찜 해제" }).click();
  await page.getByRole("button", { name: "♡ 찜하기" }).waitFor();
  await page.context().close();
});

await step("에디터: 후기 쓰기 → 상세에 반영 → 마이·리스트에 반영 → 삭제", async () => {
  const page = await newPage("editor");
  await page.goto(`${BASE}/places/1`);
  await page.getByRole("link", { name: "후기 쓰기" }).click();
  await page.getByRole("heading", { name: /후기 쓰기/ }).waitFor();
  await shot(page, "auth-review-form");
  await page.locator('label:has(input[name="rating"][value="4"])').click();
  await page.fill("#waitMinutes", "20");
  await page.fill("#body", "국물이 진해요");
  await page.fill("#tip", "평일 17시 입장");
  await page.getByRole("button", { name: "후기 저장" }).click();
  await page.waitForURL(/\/places\/1$/);
  await page.getByText("국물이 진해요").waitFor();
  await page.getByText("실제 대기 20분").first().waitFor();
  await page.getByText("에디터A").first().waitFor();
  await shot(page, "auth-place-with-review");
  await page.goto(`${BASE}/list?area=seongsu`);
  await page.getByText("후기 1").first().waitFor();
  await page.goto(`${BASE}/me`);
  await page.getByRole("heading", { name: /내가 남긴 후기/ }).waitFor();
  await page.goto(`${BASE}/places/1`);
  await page.getByRole("button", { name: "삭제" }).click();
  await page.getByRole("button", { name: "한 번 더 누르면 삭제됩니다" }).click();
  await page.getByText("아직 후기가 없습니다").waitFor();
  assert.equal(mock.db.reviews.length, 0);
  await page.context().close();
});

await step("에디터: 입력 오류는 입력값을 유지한 채 안내한다", async () => {
  const page = await newPage("editor");
  await page.goto(`${BASE}/places/2/review/new`);
  await page.locator('label:has(input[name="rating"][value="5"])').click();
  await page.fill("#visitedOn", "2999-01-01");
  await page.fill("#body", "미래에 다녀온 후기");
  await page.evaluate(() => document.getElementById("visitedOn").removeAttribute("max"));
  await page.getByRole("button", { name: "후기 저장" }).click();
  await page.getByRole("alert").filter({ hasText: "오늘까지의 날짜" }).waitFor();
  assert.equal(await page.inputValue("#body"), "미래에 다녀온 후기");
  assert.equal(mock.db.reviews.length, 0);
  await page.context().close();
});

await step("에디터: 가게 추가 → 상세로 이동, 같은 이름은 거절", async () => {
  const page = await newPage("editor");
  await page.goto(`${BASE}/admin/places/new`);
  await page.selectOption("#areaSlug", "yeonnam");
  await page.fill("#category", "파스타");
  await page.fill("#name", "시험용 파스타집");
  await page.getByLabel("데이트").check();
  await page.fill("#summary", "시험으로 추가한 가게");
  await page.fill("#waitTip", "평일 점심에 한적함");
  await page.getByRole("button", { name: "가게 추가" }).click();
  await page.waitForURL(/\/places\/\d+$/);
  await page.getByRole("heading", { name: "시험용 파스타집" }).waitFor();
  await page.getByText("평일 점심에 한적함").waitFor();
  await page.goto(`${BASE}/admin/places/new`);
  await page.selectOption("#areaSlug", "yeonnam");
  await page.fill("#category", "파스타");
  await page.fill("#name", "시험용 파스타집");
  await page.getByLabel("혼밥").check();
  await page.getByRole("button", { name: "가게 추가" }).click();
  await page.getByRole("alert").filter({ hasText: "이미 있습니다" }).waitFor();
  await page.context().close();
});

await step("에디터: 사진 등록 → 카드·상세에 사진이 나온다 → 삭제", async () => {
  const page = await newPage("editor");
  await page.goto(`${BASE}/admin/places/3/edit`);
  await page.getByRole("heading", { name: "대표 사진" }).waitFor();
  const png = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 1600; c.height = 1000; const x = c.getContext("2d"); x.fillStyle = "#c66"; x.fillRect(0, 0, 1600, 1000); return c.toDataURL("image/png").split(",")[1]; });
  await page.setInputFiles('input[type="file"]', { name: "x.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await page.getByRole("button", { name: "사진 바꾸기" }).waitFor();
  const placePath = mock.db.places.find((p) => p.id === 3).photo_path;
  assert.match(placePath, /^3\/[0-9a-f-]{36}\.jpg$/);
  await page.goto(`${BASE}/places/3`);
  await page.locator("img[alt$='사진']").first().waitFor();
  assert.match(await page.locator("img[alt$='사진']").first().getAttribute("src"), /\/storage\/v1\/object\/public\/place-photos\/3\//);
  await shot(page, "auth-place-with-photo");
  await page.goto(`${BASE}/admin/places/3/edit`);
  await page.getByRole("button", { name: "사진 삭제" }).click();
  await page.getByRole("button", { name: "한 번 더 누르면 삭제됩니다" }).click();
  await page.getByRole("button", { name: "사진 등록" }).waitFor();
  assert.equal(mock.db.places.find((p) => p.id === 3).photo_path, null);
  await page.context().close();
});

await step("회원은 가게 추가·수정 화면에서 막힌다", async () => {
  const page = await newPage("member");
  await page.goto(`${BASE}/admin/places/new`);
  await page.getByText("가게는 에디터만 추가할 수 있습니다").waitFor();
  await page.goto(`${BASE}/admin/places/1/edit`);
  await page.getByText("가게는 에디터만 수정할 수 있습니다").waitFor();
  await page.context().close();
});

await step("로그아웃", async () => {
  const page = await newPage("editor");
  await page.goto(`${BASE}/me`);
  await page.getByRole("button", { name: "로그아웃" }).click();
  await page.waitForURL(`${BASE}/`);
  await page.context().close();
});

await browser.close();
await stop();
assert.deepEqual(problems, [], `브라우저 오류: ${problems.join(" | ")}`);
console.log("로그인 이후 흐름 확인 통과");
process.exit(0);
