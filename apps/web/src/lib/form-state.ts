/** 서버 액션이 폼에 돌려주는 상태. 오류가 있으면 입력값을 되돌려 줘서 다시 쓰지 않게 한다. */
export interface FormState {
  error?: string;
  /** 성공 안내 (리다이렉트하지 않는 경우) */
  message?: string;
  values?: Record<string, string | string[]>;
}

export const INITIAL_FORM_STATE: FormState = {};

/** FormData 의 문자열 값만 모은다(파일 제외). 같은 이름이 여럿이면 배열. */
export function formValues(fd: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(fd.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const all = fd.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = all.length > 1 ? all : (all[0] ?? "");
  }
  return out;
}
