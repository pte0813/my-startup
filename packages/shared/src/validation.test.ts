import { describe, expect, it } from "vitest";
import { josa, validatePlace, validateReview } from "./validation";

const today = "2026-10-20";
const ok = { rating: 4, visitedOn: "2026-10-19", body: "국물이 진해요", waitMinutes: "20", tip: "", sponsored: false };

describe("validateReview", () => {
  it("올바른 입력은 정리된 값을 돌려준다", () => {
    const r = validateReview({ ...ok, tip: " 평일 17시 " }, today);
    expect(r).toEqual({ ok: true, value: { rating: 4, visitedOn: "2026-10-19", waitMinutes: 20, body: "국물이 진해요", tip: "평일 17시", sponsored: false } });
  });
  it("대기 시간을 비우면 null이다", () => {
    const r = validateReview({ ...ok, waitMinutes: "" }, today);
    expect(r.ok && r.value.waitMinutes).toBeNull();
  });
  it("별점이 없거나 범위를 벗어나면 거절한다", () => {
    for (const rating of [0, 6, 2.5, "a", undefined]) expect(validateReview({ ...ok, rating }, today).ok).toBe(false);
  });
  it("미래 날짜와 존재하지 않는 날짜를 거절한다", () => {
    expect(validateReview({ ...ok, visitedOn: "2026-10-21" }, today).ok).toBe(false);
    expect(validateReview({ ...ok, visitedOn: "2026-02-30" }, today).ok).toBe(false);
    expect(validateReview({ ...ok, visitedOn: "10/19" }, today).ok).toBe(false);
  });
  it("오늘 방문은 허용한다", () => expect(validateReview({ ...ok, visitedOn: today }, today).ok).toBe(true));
  it("후기 길이를 검사한다", () => {
    expect(validateReview({ ...ok, body: " 맛 " }, today).ok).toBe(false);
    expect(validateReview({ ...ok, body: "가".repeat(201) }, today).ok).toBe(false);
    expect(validateReview({ ...ok, body: "가".repeat(200) }, today).ok).toBe(true);
  });
  it("대기 시간 범위를 검사한다", () => {
    for (const w of ["-1", "601", "1.5", "abc"]) expect(validateReview({ ...ok, waitMinutes: w }, today).ok).toBe(false);
    expect(validateReview({ ...ok, waitMinutes: "0" }, today).ok).toBe(true);
    expect(validateReview({ ...ok, waitMinutes: "600" }, today).ok).toBe(true);
  });
  it("팁은 200자 이하여야 한다", () => expect(validateReview({ ...ok, tip: "가".repeat(201) }, today).ok).toBe(false));
  it("협찬 체크 값을 해석한다", () => {
    for (const v of [true, "on", "true"]) {
      const r = validateReview({ ...ok, sponsored: v }, today);
      expect(r.ok && r.value.sponsored).toBe(true);
    }
    const r = validateReview({ ...ok, sponsored: undefined }, today);
    expect(r.ok && r.value.sponsored).toBe(false);
  });
});

describe("validatePlace", () => {
  const base = { areaSlug: "seongsu", name: " 새 가게 ", category: "파스타", situations: ["데이트", "없는상황"], summary: "", waitTip: "", reservationTip: "", address: "" };
  const slugs = ["seongsu", "yeonnam"];
  it("올바른 입력을 정리한다", () => {
    const r = validatePlace(base, slugs);
    expect(r).toEqual({ ok: true, value: { areaSlug: "seongsu", name: "새 가게", category: "파스타", situations: ["데이트"], summary: "", waitTip: null, reservationTip: null, address: null } });
  });
  it("모르는 동네·빈 이름·빈 종류·상황 없음을 거절한다", () => {
    expect(validatePlace({ ...base, areaSlug: "x" }, slugs).ok).toBe(false);
    expect(validatePlace({ ...base, name: " " }, slugs).ok).toBe(false);
    expect(validatePlace({ ...base, category: "" }, slugs).ok).toBe(false);
    expect(validatePlace({ ...base, situations: [] }, slugs).ok).toBe(false);
    expect(validatePlace({ ...base, situations: ["없는상황"] }, slugs).ok).toBe(false);
  });
  it("너무 긴 값을 거절한다", () => {
    expect(validatePlace({ ...base, name: "가".repeat(61) }, slugs).ok).toBe(false);
    expect(validatePlace({ ...base, summary: "가".repeat(121) }, slugs).ok).toBe(false);
    expect(validatePlace({ ...base, waitTip: "가".repeat(301) }, slugs).ok).toBe(false);
  });
});

describe("조사", () => {
  it("받침에 따라 은/는을 고른다", () => {
    expect(josa("웨이팅 팁")).toBe("은");
    expect(josa("주소")).toBe("는");
    expect(josa("abc")).toBe("은(는)");
  });
  it("긴 값 오류 문장이 자연스럽다", () => {
    const r = validatePlace({ areaSlug: "seongsu", name: "가", category: "a", situations: ["데이트"], summary: "", waitTip: "", reservationTip: "", address: "가".repeat(121) }, ["seongsu"]);
    expect(r).toEqual({ ok: false, error: "주소는 120자 이하로 적어 주세요." });
  });
});
