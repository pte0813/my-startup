"use client";

import { useEffect, useState } from "react";
import { detectPlatform, shouldShowInstallBanner, type Platform } from "@/lib/install";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "mongmong-install-dismissed";

function readDismissed(): number | null {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

const HOW_TO: Record<Platform, string> = {
  ios: "Safari 아래쪽의 공유 버튼(네모에서 화살표가 나온 모양)을 누르고 ‘홈 화면에 추가’를 고르세요.",
  android: "브라우저 오른쪽 위 메뉴(⋮)에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 고르세요.",
  desktop: "주소창 오른쪽에 나타나는 설치 아이콘을 누르거나, 브라우저 메뉴에서 ‘몽몽 설치’를 고르세요.",
};

/**
 * 홈 화면에 설치하도록 안내한다.
 * - `banner`: 홈에 잠깐 보이는 배너. 닫으면 14일간 숨긴다.
 * - `section`: 안내 화면의 설치 방법. 이미 설치된 화면이 아니면 항상 보인다.
 * 브라우저가 설치 창을 줄 수 있으면 버튼을, 아니면(특히 iOS) 방법을 글로 안내한다.
 */
export function InstallPrompt({ variant }: { variant: "banner" | "section" }) {
  const [ready, setReady] = useState(false);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [standalone, setStandalone] = useState(false);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [now, setNow] = useState(0);

  // 브라우저에서만 알 수 있는 값(기기·설치 여부·닫은 시각)을 하이드레이션 뒤에 한 번 읽는다.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setNow(Date.now());
    setPlatform(detectPlatform(navigator.userAgent, navigator.maxTouchPoints));
    setStandalone(matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    setDismissedAt(readDismissed());
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const onPrompt = (e: Event) => {
      e.preventDefault(); // 브라우저 기본 배너 대신 우리 화면에서 보여 준다
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setStandalone(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!ready || standalone) return null;
  if (variant === "banner" && !shouldShowInstallBanner({ standalone, dismissedAt, now, canPrompt: deferred !== null, platform })) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }
  function dismiss() {
    const now = Date.now();
    setDismissedAt(now);
    try {
      localStorage.setItem(DISMISS_KEY, String(now));
    } catch {
      /* 저장할 수 없으면 이번 방문에서만 닫힌다 */
    }
  }

  return (
    <section aria-label="앱으로 설치" className="mb-8 grid gap-2 rounded-[22px] border border-line bg-surface p-4">
      <h2 className="text-[17px] font-black tracking-[-0.03em]">몽몽을 앱처럼 쓰세요</h2>
      <p className="text-[15px] text-muted">홈 화면에 추가하면 앱처럼 바로 열 수 있어요.</p>
      {deferred ? (
        <button type="button" onClick={install} className="tap min-h-11 justify-self-start rounded-2xl bg-accent px-5 font-bold text-accent-fg">홈 화면에 추가</button>
      ) : (
        <p className="text-[15px]">{HOW_TO[platform]}</p>
      )}
      {variant === "banner" && (
        <button type="button" onClick={dismiss} className="tap min-h-9 justify-self-start text-sm text-muted underline">나중에 할게요</button>
      )}
    </section>
  );
}
