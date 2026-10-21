/*
 * 몽몽 서비스 워커. 하는 일은 두 가지뿐이다.
 *  1) 인터넷이 끊긴 채 화면을 열면 "오프라인" 안내 화면을 보여 준다.
 *  2) 바뀌지 않는 정적 파일(/_next/static, 아이콘)을 저장해 두고 빠르게 연다.
 * 가게·후기·로그인 정보처럼 바뀌거나 개인적인 화면은 저장하지 않는다(다른 사람이 같은 기기를 써도 안전하다).
 * 캐시 이름의 버전을 올리면 다음 방문에서 이전 캐시가 지워진다.
 */
const VERSION = "mongmong-v1";
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await cache.addAll(PRECACHE);
      // 오프라인 화면이 꾸밈 없이 열리도록, 그 화면이 쓰는 스크립트·스타일도 함께 저장한다.
      const html = await (await cache.match(OFFLINE_URL)).text();
      const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)<>\\]+/g) ?? [])];
      await Promise.allSettled(assets.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== VERSION).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // 사진·인증 서버 등 다른 주소는 건드리지 않는다

  // 화면 이동: 항상 네트워크가 먼저. 끊겼을 때만 오프라인 안내를 보여 준다.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
    );
    return;
  }

  // 정적 파일: 저장해 둔 것이 있으면 바로 쓰고, 없으면 받아서 저장한다.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) (await caches.open(VERSION)).put(request, response.clone());
        return response;
      })(),
    );
  }
});
