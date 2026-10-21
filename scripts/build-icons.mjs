// 몽몽 캐릭터로 앱 아이콘(PNG)을 만든다. 결과물은 저장소에 함께 둔다.
//   node scripts/build-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { MASCOT_INNER, MASCOT_VIEWBOX } from "../apps/web/src/lib/mascot-svg.ts";

const BG = "#101216"; // 앱의 어두운 배경색
const out = new URL("../apps/web/", import.meta.url).pathname;
mkdirSync(`${out}public/icons`, { recursive: true });

/** `scale`: 캐릭터가 아이콘에서 차지하는 비율. 마스커블 아이콘은 가장자리가 잘려도 되도록 작게 둔다. */
const svg = (size, scale, bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ""}
  <svg x="${(size * (1 - scale)) / 2}" y="${(size * (1 - scale)) / 2 + size * 0.02}" width="${size * scale}" height="${size * scale}" viewBox="${MASCOT_VIEWBOX}">${MASCOT_INNER}</svg>
</svg>`;

const targets = [
  { file: "public/icons/icon-192.png", size: 192, scale: 0.78, bg: BG, round: 0.22 },
  { file: "public/icons/icon-512.png", size: 512, scale: 0.78, bg: BG, round: 0.22 },
  { file: "public/icons/icon-maskable-512.png", size: 512, scale: 0.58, bg: BG, round: 0 }, // 전체를 채우고 안전 영역(가운데 80%) 안에 그림
  { file: "src/app/apple-icon.png", size: 180, scale: 0.74, bg: BG, round: 0 }, // iOS 가 모서리를 직접 둥글린다
  { file: "src/app/icon.png", size: 512, scale: 0.78, bg: BG, round: 0.22 },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  const radius = Math.round(t.size * t.round);
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}.r{width:${t.size}px;height:${t.size}px;border-radius:${radius}px;overflow:hidden}</style><div class="r">${svg(t.size, t.scale, t.bg)}</div>`);
  const png = await page.screenshot({ omitBackground: true, type: "png" });
  writeFileSync(`${out}${t.file}`, png);
  console.log(`${t.file} ${t.size}px (${png.length} bytes)`);
}
await browser.close();
