/** 이메일 로그인 링크가 돌아올 사이트 주소. 환경 변수가 있으면 우선하고, 없으면 요청 헤더로 만든다. */
export function resolveSiteUrl(headers: Pick<Headers, "get">, envUrl: string | undefined): string {
  if (envUrl && /^https?:\/\//.test(envUrl)) return envUrl.replace(/\/+$/, "");
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const proto = headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
