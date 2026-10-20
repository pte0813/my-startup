import { describe, expect, it } from "vitest";
import type { Place, Review } from "@mongmong/shared";
import { buildPlaceViews } from "./views";

const place = (id: number, over: Partial<Place> = {}): Place => ({
  id, areaSlug: "seongsu", name: `가게${id}`, category: "한식", situations: ["혼밥"], summary: "", waitTip: null,
  reservationTip: null, address: null, photoPath: null, status: "published", sortOrder: id, ...over,
});
const review = (placeId: number, over: Partial<Review> = {}): Review => ({
  id: `r${placeId}${over.visitedOn ?? ""}`, placeId, authorId: "u", rating: 4, visitedOn: "2026-10-10", waitMinutes: null,
  body: "좋아요", tip: null, sponsored: false, createdAt: "2026-10-10T00:00:00Z", ...over,
});

describe("buildPlaceViews", () => {
  const today = "2026-10-20";
  const views = buildPlaceViews(
    [place(1, { waitTip: "오픈런" }), place(2), place(3, { areaSlug: "yeonnam" })],
    [review(1, { rating: 5, waitMinutes: 15 }), review(1, { rating: 3, visitedOn: "2026-05-01" }), review(2, { visitedOn: "2026-01-01" })],
    today,
  );
  it("후기를 가게별로 묶고 통계를 계산한다", () => {
    expect(views[0].stats.reviewCount).toBe(2);
    expect(views[0].stats.avgRating).toBe(4);
    expect(views[0].reviews[0].visitedOn).toBe("2026-10-10");
  });
  it("동네 이름을 붙인다", () => {
    expect(views[0].areaName).toBe("성수");
    expect(views[2].areaName).toBe("연남");
  });
  it("최근 후기의 실제 대기 시간을 웨이팅 줄로 쓴다", () => expect(views[0].wait).toBe("최근 방문 실제 대기 15분 (2026-10-10)"));
  it("후기가 없으면 검증 전, 90일이 지나면 경고한다", () => {
    expect(views[0].stale).toBe(false);
    expect(views[1].stale).toBe(true);
    expect(views[1].staleText).toMatch(/^검증 \d+일 전$/);
    expect(views[2].staleText).toBe("검증 전");
  });
  it("웨이팅 정보가 전혀 없으면 null 이다", () => expect(views[2].wait).toBeNull());
});
