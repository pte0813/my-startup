import { describe, expect, it } from "vitest";
import { computeStats, daysBetween, isStale, sortReviews, staleLabel, waitLine } from "./stats";
import type { Review } from "./types";

const review = (over: Partial<Review>): Review => ({
  id: "r1", placeId: 1, authorId: "u1", rating: 4, visitedOn: "2026-10-01",
  waitMinutes: null, body: "맛있어요", tip: null, sponsored: false, createdAt: "2026-10-02T00:00:00Z", ...over,
});

describe("daysBetween", () => {
  it("날짜 차이를 일 단위로 계산한다", () => {
    expect(daysBetween("2026-10-01", "2026-10-20")).toBe(19);
    expect(daysBetween("2026-10-20", "2026-10-20")).toBe(0);
  });
  it("월·연도 경계를 넘어도 맞다", () => {
    expect(daysBetween("2025-12-31", "2026-01-02")).toBe(2);
  });
});

describe("computeStats", () => {
  it("후기가 없으면 비어 있다", () => {
    expect(computeStats([])).toEqual({ reviewCount: 0, avgRating: null, lastVisitedOn: null, hasSponsored: false });
  });
  it("평균 평점, 마지막 방문일, 협찬 여부를 계산한다", () => {
    const s = computeStats([review({ rating: 5, visitedOn: "2026-09-01" }), review({ id: "r2", rating: 3, visitedOn: "2026-10-05", sponsored: true })]);
    expect(s.reviewCount).toBe(2);
    expect(s.avgRating).toBe(4);
    expect(s.lastVisitedOn).toBe("2026-10-05");
    expect(s.hasSponsored).toBe(true);
  });
});

describe("검증 상태", () => {
  const today = "2026-10-20";
  it("후기가 없으면 검증 전이다", () => {
    const s = computeStats([]);
    expect(isStale(s, today)).toBe(true);
    expect(staleLabel(s, today)).toBe("검증 전");
  });
  it("90일 이내면 경고가 없다", () => {
    const s = computeStats([review({ visitedOn: "2026-07-22" })]); // 90일 전
    expect(daysBetween("2026-07-22", today)).toBe(90);
    expect(isStale(s, today)).toBe(false);
  });
  it("90일을 넘으면 경고와 일수를 보여 준다", () => {
    const s = computeStats([review({ visitedOn: "2026-07-21" })]); // 91일 전
    expect(isStale(s, today)).toBe(true);
    expect(staleLabel(s, today)).toBe("검증 91일 전");
  });
});

describe("sortReviews / waitLine", () => {
  it("방문일 내림차순, 같은 날이면 작성 시각 내림차순이다", () => {
    const a = review({ id: "a", visitedOn: "2026-10-01", createdAt: "2026-10-01T10:00:00Z" });
    const b = review({ id: "b", visitedOn: "2026-10-01", createdAt: "2026-10-01T12:00:00Z" });
    const c = review({ id: "c", visitedOn: "2026-10-10" });
    expect(sortReviews([a, b, c]).map((r) => r.id)).toEqual(["c", "b", "a"]);
  });
  it("실제 대기 시간이 있는 최근 후기를 우선한다", () => {
    const rs = sortReviews([review({ waitMinutes: 20, visitedOn: "2026-10-10" }), review({ id: "r2", waitMinutes: null, visitedOn: "2026-10-15" })]);
    expect(waitLine({ waitTip: "오픈런 필수" }, rs)).toBe("최근 방문 실제 대기 20분 (2026-10-10)");
  });
  it("후기에 대기 시간이 없으면 가게의 웨이팅 팁을 쓴다", () => {
    expect(waitLine({ waitTip: "오픈런 필수" }, [])).toBe("오픈런 필수");
    expect(waitLine({ waitTip: null }, [])).toBeNull();
    expect(waitLine({ waitTip: "  " }, [])).toBeNull();
  });
  it("대기 0분도 실제 값으로 본다", () => {
    expect(waitLine({ waitTip: "x" }, [review({ waitMinutes: 0 })])).toBe("최근 방문 실제 대기 0분 (2026-10-01)");
  });
});
