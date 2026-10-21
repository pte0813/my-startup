"use client";

import { useEffect } from "react";

/** 서비스 워커를 등록한다. 개발 중에는 캐시가 헷갈리지 않도록 등록하지 않고, 남아 있는 것도 지운다. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
      return;
    }
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
