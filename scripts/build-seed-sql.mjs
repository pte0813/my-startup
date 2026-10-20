// supabase/seed/places.json + packages/shared 의 동네 목록으로 supabase/seed.sql 을 만든다.
// 사용: node scripts/build-seed-sql.mjs
import { readFileSync, writeFileSync } from "node:fs";

const areasSrc = readFileSync("packages/shared/src/areas.ts", "utf8");
const areas = [...areasSrc.matchAll(/slug: "([^"]+)", name: "([^"]+)", sortOrder: (\d+)/g)].map((m) => ({ slug: m[1], name: m[2], sortOrder: +m[3] }));
const places = JSON.parse(readFileSync("supabase/seed/places.json", "utf8"));

const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replaceAll("'", "''")}'`);
const arr = (a) => `array[${a.map(q).join(", ")}]`;

const lines = [
  "-- 자동 생성 파일입니다. 직접 고치지 말고 scripts/build-seed-sql.mjs 를 실행하세요.",
  "-- 가게 정보는 2026년 10월 웹 검색 기준이며 직접 방문 검증 전입니다.",
  "",
  "insert into public.areas (slug, name, sort_order) values",
  areas.map((a) => `  (${q(a.slug)}, ${q(a.name)}, ${a.sortOrder})`).join(",\n") + "\non conflict (slug) do nothing;",
  "",
  "insert into public.places (id, area_slug, name, category, situations, summary, wait_tip, reservation_tip, address, sort_order) overriding system value values",
  places
    .map((p) => `  (${p.id}, ${q(p.areaSlug)}, ${q(p.name)}, ${q(p.category)}, ${arr(p.situations)}, ${q(p.summary)}, ${q(p.waitTip)}, ${q(p.reservationTip)}, ${q(p.address)}, ${p.sortOrder})`)
    .join(",\n") + "\non conflict (id) do nothing;",
  "",
  "select setval(pg_get_serial_sequence('public.places', 'id'), (select max(id) from public.places));",
  "",
];
writeFileSync("supabase/seed.sql", lines.join("\n"));
console.log(`areas ${areas.length}, places ${places.length}`);
