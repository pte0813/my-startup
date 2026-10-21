/**
 * 로그인 뒤 돌아갈 주소를 같은 사이트의 경로로만 허용한다(열린 리다이렉트 방지).
 * `/places/1`은 허용, `//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:` 등은 기본값으로 바꾼다.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/me"): string {
  if (!next || next.length > 300) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const u = new URL(next, "http://localhost");
    if (u.origin !== "http://localhost") return fallback;
  } catch {
    return fallback;
  }
  return next;
}
