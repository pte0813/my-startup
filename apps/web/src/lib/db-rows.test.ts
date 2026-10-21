import { describe, expect, it } from "vitest";
import { toPlace, toReview, type PlaceRow, type ReviewRow } from "./db-rows";

const row: PlaceRow = {
  id: 7, area_slug: "seongsu", name: "도도한면", category: "우동", situations: ["혼밥", "알수없음"], summary: "갈치 우동",
  wait_tip: null, reservation_tip: "전화", address: "성동구", photo_path: null, status: "published", sort_order: 7,
};

describe("toPlace", () => {
  it("snake_case 행을 앱 타입으로 바꾸고 알 수 없는 상황 값은 버린다", () => {
    expect(toPlace(row)).toEqual({
      id: 7, areaSlug: "seongsu", name: "도도한면", category: "우동", situations: ["혼밥"], summary: "갈치 우동",
      waitTip: null, reservationTip: "전화", address: "성동구", photoPath: null, status: "published", sortOrder: 7,
    });
  });
});

describe("toReview", () => {
  it("후기 행을 앱 타입으로 바꾼다", () => {
    const r: ReviewRow = { id: "u", place_id: 7, author_id: null, rating: 5, visited_on: "2026-10-01", wait_minutes: 0, body: "좋아요", tip: null, sponsored: true, created_at: "2026-10-02T00:00:00Z" };
    expect(toReview(r)).toEqual({ id: "u", placeId: 7, authorId: null, rating: 5, visitedOn: "2026-10-01", waitMinutes: 0, body: "좋아요", tip: null, sponsored: true, createdAt: "2026-10-02T00:00:00Z" });
  });
});
