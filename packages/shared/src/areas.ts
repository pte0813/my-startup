import type { Area } from "./types";

export const AREAS: Area[] = [
  { slug: "seongsu", name: "성수", sortOrder: 1 },
  { slug: "yeonnam", name: "연남", sortOrder: 2 },
  { slug: "pangyo", name: "판교", sortOrder: 3 },
  { slug: "hongdae", name: "홍대", sortOrder: 4 },
  { slug: "gangnam", name: "강남", sortOrder: 5 },
  { slug: "itaewon-hannam", name: "이태원·한남", sortOrder: 6 },
  { slug: "konkuk", name: "건대", sortOrder: 7 },
  { slug: "euljiro", name: "을지로", sortOrder: 8 },
  { slug: "ikseon", name: "익선동", sortOrder: 9 },
  { slug: "mangwon", name: "망원", sortOrder: 10 },
  { slug: "songridan", name: "송리단길", sortOrder: 11 },
  { slug: "apgujeong", name: "압구정", sortOrder: 12 },
  { slug: "seochon", name: "서촌", sortOrder: 13 },
  { slug: "namyangju", name: "남양주", sortOrder: 14 },
];

export function findArea(slug: string | undefined | null): Area | undefined {
  return AREAS.find((a) => a.slug === slug);
}
