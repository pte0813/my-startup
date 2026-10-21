import type { MetadataRoute } from "next";

/** 홈 화면에 설치할 때 쓰는 앱 정보. 색은 앱의 어두운 배경과 맞춘다. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "몽몽 · 동네 맛집 큐레이션",
    short_name: "몽몽",
    description: "웨이팅 팁과 예약 요령까지, 직접 다녀온 사람이 검증하는 동네 맛집 큐레이션",
    lang: "ko",
    dir: "ltr",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#101216",
    theme_color: "#101216",
    categories: ["food", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "검색", short_name: "검색", url: "/search", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "큐레이션 리스트", short_name: "리스트", url: "/list", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
