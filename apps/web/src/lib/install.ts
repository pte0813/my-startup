export type Platform = "ios" | "android" | "desktop";

/** 접속 환경 추정. 설치 방법 안내에만 쓴다. */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

const DISMISS_DAYS = 14;

/** 안내 배너를 닫은 뒤 일정 기간은 다시 보이지 않게 한다. `dismissedAt`은 밀리초 시각. */
export function isDismissed(dismissedAt: number | null, now: number): boolean {
  return dismissedAt !== null && now - dismissedAt < DISMISS_DAYS * 86_400_000;
}

/**
 * 배너를 보일지 결정한다.
 * - 이미 설치된 화면(standalone)이거나 최근에 닫았으면 숨긴다.
 * - 브라우저가 설치 창을 줄 수 있으면(`canPrompt`) 보인다.
 * - iOS 는 설치 창이 없어서 방법을 글로 안내한다.
 */
export function shouldShowInstallBanner(o: { standalone: boolean; dismissedAt: number | null; now: number; canPrompt: boolean; platform: Platform }): boolean {
  if (o.standalone || isDismissed(o.dismissedAt, o.now)) return false;
  return o.canPrompt || o.platform === "ios";
}
