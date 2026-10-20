import { SITUATIONS, type Situation } from "./types";

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface ReviewInput {
  rating: number;
  visitedOn: string;
  waitMinutes: number | null;
  body: string;
  tip: string | null;
  sponsored: boolean;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(d: string): boolean {
  if (!DATE_RE.test(d)) return false;
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === day;
}

/** 후기 입력을 검증한다. 서버(저장 직전)와 클라이언트(입력 중)에서 같은 규칙을 쓴다. */
export function validateReview(raw: Record<string, unknown>, today: string): ValidationResult<ReviewInput> {
  const rating = Number(raw.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: "별점을 골라 주세요." };

  const visitedOn = String(raw.visitedOn ?? "");
  if (!isRealDate(visitedOn) || visitedOn > today) return { ok: false, error: "방문일을 오늘 이전 날짜로 입력해 주세요." };

  const body = String(raw.body ?? "").trim();
  if (body.length < 2) return { ok: false, error: "한 줄 후기를 2자 이상 적어 주세요." };
  if (body.length > 200) return { ok: false, error: "한 줄 후기는 200자 이하로 적어 주세요." };

  const waitRaw = raw.waitMinutes;
  let waitMinutes: number | null = null;
  if (waitRaw !== null && waitRaw !== undefined && String(waitRaw).trim() !== "") {
    const w = Number(waitRaw);
    if (!Number.isInteger(w) || w < 0 || w > 600) return { ok: false, error: "대기 시간은 0~600분 사이로 입력해 주세요." };
    waitMinutes = w;
  }

  const tipText = String(raw.tip ?? "").trim();
  if (tipText.length > 200) return { ok: false, error: "예약·웨이팅 팁은 200자 이하로 적어 주세요." };

  return {
    ok: true,
    value: { rating, visitedOn, waitMinutes, body, tip: tipText || null, sponsored: raw.sponsored === true || raw.sponsored === "on" || raw.sponsored === "true" },
  };
}

export interface PlaceInput {
  areaSlug: string;
  name: string;
  category: string;
  situations: Situation[];
  summary: string;
  waitTip: string | null;
  reservationTip: string | null;
  address: string | null;
}

export function validatePlace(raw: Record<string, unknown>, knownAreaSlugs: string[]): ValidationResult<PlaceInput> {
  const areaSlug = String(raw.areaSlug ?? "");
  if (!knownAreaSlugs.includes(areaSlug)) return { ok: false, error: "동네를 골라 주세요." };
  const name = String(raw.name ?? "").trim();
  if (!name) return { ok: false, error: "가게 이름을 입력해 주세요." };
  if (name.length > 60) return { ok: false, error: "가게 이름은 60자 이하로 적어 주세요." };
  const category = String(raw.category ?? "").trim();
  if (!category) return { ok: false, error: "종류를 입력해 주세요." };
  if (category.length > 20) return { ok: false, error: "종류는 20자 이하로 적어 주세요." };
  const list = Array.isArray(raw.situations) ? raw.situations : [];
  const situations = SITUATIONS.filter((s) => list.includes(s));
  if (situations.length === 0) return { ok: false, error: "어울리는 상황을 하나 이상 골라 주세요." };
  const optional = (v: unknown, max: number, label: string): ValidationResult<string | null> => {
    const t = String(v ?? "").trim();
    if (t.length > max) return { ok: false, error: `${label}은(는) ${max}자 이하로 적어 주세요.` };
    return { ok: true, value: t || null };
  };
  const summary = String(raw.summary ?? "").trim();
  if (summary.length > 120) return { ok: false, error: "한 줄 소개는 120자 이하로 적어 주세요." };
  const wait = optional(raw.waitTip, 300, "웨이팅 팁");
  if (!wait.ok) return wait;
  const resv = optional(raw.reservationTip, 300, "예약 요령");
  if (!resv.ok) return resv;
  const addr = optional(raw.address, 120, "주소");
  if (!addr.ok) return addr;
  return { ok: true, value: { areaSlug, name, category, situations, summary, waitTip: wait.value, reservationTip: resv.value, address: addr.value } };
}
