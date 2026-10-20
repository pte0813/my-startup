import { describe, expect, it } from "vitest";
import { countByArea, filterPlaces, searchPlaces } from "./filter";
import type { Place } from "./types";

const p = (over: Partial<Place>): Place => ({
  id: 1, areaSlug: "seongsu", name: "도도한면", category: "우동", situations: ["혼밥"], summary: "갈치 우동", waitTip: null,
  reservationTip: null, address: null, photoPath: null, status: "published", sortOrder: 1, ...over,
});
const data = [
  p({ id: 1 }),
  p({ id: 2, name: "만학", category: "파스타", situations: ["데이트"], summary: "파스타 맛집" }),
  p({ id: 3, areaSlug: "yeonnam", name: "형제특수부위", category: "고기", situations: ["팀 회식", "데이트"], summary: "특수부위" }),
];

describe("filterPlaces", () => {
  it("동네로 거른다", () => expect(filterPlaces(data, { areaSlug: "seongsu" }).map((x) => x.id)).toEqual([1, 2]));
  it("상황으로 거른다", () => expect(filterPlaces(data, { situation: "데이트" }).map((x) => x.id)).toEqual([2, 3]));
  it("동네와 상황을 함께 쓴다", () => expect(filterPlaces(data, { areaSlug: "yeonnam", situation: "혼밥" })).toEqual([]));
  it("'전체'는 거르지 않는다", () => expect(filterPlaces(data, { situation: "전체" })).toHaveLength(3));
});

describe("searchPlaces", () => {
  it("이름·종류·동네 이름·소개로 찾는다", () => {
    expect(searchPlaces(data, "만학").map((x) => x.id)).toEqual([2]);
    expect(searchPlaces(data, "고기").map((x) => x.id)).toEqual([3]);
    expect(searchPlaces(data, "연남").map((x) => x.id)).toEqual([3]);
  });
  it("대소문자와 앞뒤 공백을 무시한다", () => {
    expect(searchPlaces([p({ name: "bd 버거" })], "  BD ")).toHaveLength(1);
  });
  it("빈 검색어는 결과가 없다", () => expect(searchPlaces(data, "   ")).toEqual([]));
});

describe("countByArea", () => {
  it("동네별 가게 수를 센다", () => expect(countByArea(data)).toEqual({ seongsu: 2, yeonnam: 1 }));
});
