import { describe, expect, it } from "vitest";
import { AREAS } from "./areas";
import { distanceKm, formatDistance, nearestAreas } from "./geo";

describe("distanceKm", () => {
  it("같은 지점은 0, 서울시청~강남역은 약 9km", () => {
    expect(distanceKm(37.5, 127, 37.5, 127)).toBe(0);
    expect(distanceKm(37.5663, 126.9779, 37.4979, 127.0276)).toBeGreaterThan(8);
    expect(distanceKm(37.5663, 126.9779, 37.4979, 127.0276)).toBeLessThan(10);
  });
});

describe("nearestAreas", () => {
  it("성수 한가운데에서는 성수가 가장 가깝고 거리순으로 정렬된다", () => {
    const r = nearestAreas(37.5447, 127.0557, AREAS, 3);
    expect(r[0]!.area.slug).toBe("seongsu");
    expect(r[0]!.km).toBeLessThan(0.2);
    expect(r[1]!.km).toBeGreaterThanOrEqual(r[0]!.km);
    expect(r).toHaveLength(3);
  });
  it("수원 행궁동 근처에서는 행궁동이 가장 가깝다", () => {
    expect(nearestAreas(37.2815, 127.0135, AREAS, 1)[0]!.area.slug).toBe("haenggung");
  });
  it("잘못된 좌표는 빈 목록", () => {
    expect(nearestAreas(NaN, 127, AREAS)).toEqual([]);
    expect(nearestAreas(95, 127, AREAS)).toEqual([]);
  });
  it("모든 동네 좌표가 한국 안이고 slug가 중복되지 않는다", () => {
    for (const a of AREAS) {
      expect(a.lat).toBeGreaterThan(33);
      expect(a.lat).toBeLessThan(39);
      expect(a.lng).toBeGreaterThan(124);
      expect(a.lng).toBeLessThan(132);
    }
    expect(new Set(AREAS.map((a) => a.slug)).size).toBe(AREAS.length);
  });
});

describe("formatDistance", () => {
  it("거리 단위를 읽기 쉽게 바꾼다", () => {
    expect(formatDistance(0.04)).toBe("100m");
    expect(formatDistance(0.83)).toBe("800m");
    expect(formatDistance(2.46)).toBe("2.5km");
    expect(formatDistance(14.6)).toBe("15km");
  });
});
