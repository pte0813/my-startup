import { describe, expect, it } from "vitest";
import { seoulDate } from "./date";

describe("seoulDate", () => {
  it("UTC 15:00 이후는 한국에서 다음 날이다", () => {
    expect(seoulDate(new Date("2026-10-20T14:59:00Z"))).toBe("2026-10-20");
    expect(seoulDate(new Date("2026-10-20T15:00:00Z"))).toBe("2026-10-21");
  });
  it("연말 경계를 넘어간다", () => expect(seoulDate(new Date("2026-12-31T16:00:00Z"))).toBe("2027-01-01"));
});
