import { describe, expect, it } from "vitest";
import { placeLinks } from "./links";

describe("placeLinks", () => {
  const links = placeLinks("성수", "도도한면");
  it("5개 서비스로 연결하고 네이버 지도가 대표 링크다", () => {
    expect(links.map((l) => l.label)).toEqual(["네이버 지도", "카카오맵", "구글 지도", "다이닝코드", "캐치테이블"]);
    expect(links.filter((l) => l.primary).map((l) => l.label)).toEqual(["네이버 지도"]);
  });
  it("동네와 가게 이름을 인코딩해 검색어로 넣는다", () => {
    expect(links[0].href).toBe("https://map.naver.com/p/search/%EC%84%B1%EC%88%98%20%EB%8F%84%EB%8F%84%ED%95%9C%EB%A9%B4");
  });
  it("모든 링크는 https 이다", () => expect(links.every((l) => l.href.startsWith("https://"))).toBe(true));
  it("특수문자가 있어도 주소가 깨지지 않는다", () => {
    const l = placeLinks("이태원·한남", "bd 버거 & 바");
    expect(l[0].href).not.toContain(" ");
    expect(l[0].href).not.toContain("&");
  });
});
