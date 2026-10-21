import { describe, expect, it } from "vitest";
import { fitSize, photoStoragePath } from "./photo";

describe("photo", () => {
  it("경로는 가게 번호 폴더 아래 jpg", () => expect(photoStoragePath(12, "abc")).toBe("12/abc.jpg"));
  it("큰 사진은 긴 변 기준으로 줄인다", () => {
    expect(fitSize(4000, 3000)).toEqual({ width: 900, height: 675 });
    expect(fitSize(3000, 4000)).toEqual({ width: 675, height: 900 });
  });
  it("작은 사진은 키우지 않는다", () => expect(fitSize(400, 300)).toEqual({ width: 400, height: 300 }));
  it("크기가 0에 가까워도 1px 이상", () => expect(fitSize(10000, 1)).toEqual({ width: 900, height: 1 }));
});
