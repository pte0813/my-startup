import { AREAS } from "./areas";
import type { Place, Situation } from "./types";

export function filterPlaces(
  places: Place[],
  opts: { areaSlug?: string; situation?: Situation | "전체" | undefined },
): Place[] {
  return places.filter(
    (p) =>
      (!opts.areaSlug || p.areaSlug === opts.areaSlug) &&
      (!opts.situation || opts.situation === "전체" || p.situations.includes(opts.situation)),
  );
}

/** 가게 이름·종류·동네·소개·상황에 검색어가 들어 있는 가게. 공백만 있으면 빈 목록. */
export function searchPlaces(places: Place[], query: string): Place[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const areaName = new Map(AREAS.map((a) => [a.slug, a.name]));
  return places.filter((p) =>
    [p.name, p.category, areaName.get(p.areaSlug) ?? "", p.summary, ...p.situations].join(" ").toLowerCase().includes(q),
  );
}

export function countByArea(places: Place[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of places) out[p.areaSlug] = (out[p.areaSlug] ?? 0) + 1;
  return out;
}
