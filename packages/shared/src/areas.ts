import type { Area } from "./types";

export const AREAS: Area[] = [
  { slug: "seongsu", name: "성수", sortOrder: 1, lat: 37.5446, lng: 127.0557 },
  { slug: "yeonnam", name: "연남", sortOrder: 2, lat: 37.5622, lng: 126.925 },
  { slug: "pangyo", name: "판교", sortOrder: 3, lat: 37.3947, lng: 127.1112 },
  { slug: "hongdae", name: "홍대", sortOrder: 4, lat: 37.5563, lng: 126.9236 },
  { slug: "gangnam", name: "강남", sortOrder: 5, lat: 37.4979, lng: 127.0276 },
  { slug: "itaewon-hannam", name: "이태원·한남", sortOrder: 6, lat: 37.534, lng: 126.997 },
  { slug: "konkuk", name: "건대", sortOrder: 7, lat: 37.5404, lng: 127.0692 },
  { slug: "euljiro", name: "을지로", sortOrder: 8, lat: 37.5663, lng: 126.991 },
  { slug: "ikseon", name: "익선동", sortOrder: 9, lat: 37.5745, lng: 126.9893 },
  { slug: "mangwon", name: "망원", sortOrder: 10, lat: 37.556, lng: 126.9014 },
  { slug: "songridan", name: "송리단길", sortOrder: 11, lat: 37.5105, lng: 127.1072 },
  { slug: "apgujeong", name: "압구정", sortOrder: 12, lat: 37.5271, lng: 127.0286 },
  { slug: "seochon", name: "서촌", sortOrder: 13, lat: 37.58, lng: 126.9709 },
  { slug: "namyangju", name: "남양주", sortOrder: 14, lat: 37.636, lng: 127.2165 },
  { slug: "sinsa", name: "신사·가로수길", sortOrder: 15, lat: 37.5203, lng: 127.023 },
  { slug: "jamsil", name: "잠실", sortOrder: 16, lat: 37.5133, lng: 127.1002 },
  { slug: "hapjeong", name: "합정", sortOrder: 17, lat: 37.5495, lng: 126.9139 },
  { slug: "yeonhui", name: "연희동", sortOrder: 18, lat: 37.5663, lng: 126.9288 },
  { slug: "yongsan", name: "용산·삼각지", sortOrder: 19, lat: 37.5347, lng: 126.973 },
  { slug: "mullae", name: "문래", sortOrder: 20, lat: 37.5176, lng: 126.8946 },
  { slug: "yeouido", name: "여의도", sortOrder: 21, lat: 37.5219, lng: 126.9245 },
  { slug: "haenggung", name: "수원 행궁동", sortOrder: 22, lat: 37.2811, lng: 127.0123 },
];

export function findArea(slug: string | undefined | null): Area | undefined {
  return AREAS.find((a) => a.slug === slug);
}
