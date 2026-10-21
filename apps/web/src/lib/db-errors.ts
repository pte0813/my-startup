export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
}

/** DB 오류를 사용자에게 보여 줄 한국어 안내로 바꾼다. 내부 오류 문구는 그대로 노출하지 않는다. */
export function friendlyDbError(error: DbErrorLike): string {
  const msg = (error.message ?? "").toLowerCase();
  if (error.code === "42501" || msg.includes("row-level security") || msg.includes("permission denied")) {
    return "이 작업을 할 권한이 없습니다. 에디터 권한이 필요합니다.";
  }
  if (error.code === "23505") return "같은 동네에 같은 이름의 가게가 이미 있습니다.";
  if (error.code === "23503") return "연결된 가게나 동네를 찾을 수 없습니다.";
  if (error.code === "23514" || error.code === "22001") return "입력한 값이 허용 범위를 벗어났습니다. 길이와 날짜를 확인해 주세요.";
  return "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.";
}
