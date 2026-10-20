/** 한국 시간 기준 `YYYY-MM-DD`. 서버(UTC)에서도 한국의 "오늘"을 돌려준다. */
export function seoulDate(now: Date): string {
  return now.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}
