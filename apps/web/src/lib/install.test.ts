import { describe, expect, it } from "vitest";
import { detectPlatform, isDismissed, shouldShowInstallBanner } from "./install";

describe("detectPlatform", () => {
  it("아이폰·아이패드는 ios", () => {
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit Safari")).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("ios");
  });
  it("터치가 되는 Macintosh(최신 아이패드)는 ios, 일반 맥은 desktop", () => {
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe("desktop");
  });
  it("안드로이드와 그 밖", () => {
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120 Mobile")).toBe("android");
    expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120")).toBe("desktop");
  });
});

describe("isDismissed", () => {
  const now = Date.UTC(2026, 9, 21);
  it("닫은 적이 없으면 false", () => expect(isDismissed(null, now)).toBe(false));
  it("14일 안에는 true, 지나면 false", () => {
    expect(isDismissed(now - 13 * 86_400_000, now)).toBe(true);
    expect(isDismissed(now - 14 * 86_400_000, now)).toBe(false);
  });
});

describe("shouldShowInstallBanner", () => {
  const base = { standalone: false, dismissedAt: null, now: 1_000_000_000_000, canPrompt: false, platform: "desktop" as const };
  it("설치 창을 줄 수 있으면 보인다", () => expect(shouldShowInstallBanner({ ...base, canPrompt: true })).toBe(true));
  it("iOS 는 설치 창이 없어도 방법을 안내한다", () => expect(shouldShowInstallBanner({ ...base, platform: "ios" })).toBe(true));
  it("데스크톱·안드로이드에서 설치 창이 없으면 숨긴다", () => {
    expect(shouldShowInstallBanner(base)).toBe(false);
    expect(shouldShowInstallBanner({ ...base, platform: "android" })).toBe(false);
  });
  it("이미 설치된 화면이면 숨긴다", () => expect(shouldShowInstallBanner({ ...base, canPrompt: true, standalone: true })).toBe(false));
  it("최근에 닫았으면 숨긴다", () => expect(shouldShowInstallBanner({ ...base, canPrompt: true, dismissedAt: base.now - 86_400_000 })).toBe(false));
});
