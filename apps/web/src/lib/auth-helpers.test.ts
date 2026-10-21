import { describe, expect, it } from "vitest";
import { friendlyDbError } from "./db-errors";
import { formValues } from "./form-state";
import { safeNextPath } from "./safe-redirect";
import { resolveSiteUrl } from "./site-url";

describe("safeNextPath", () => {
  it("같은 사이트의 경로는 그대로 쓴다", () => {
    expect(safeNextPath("/places/1")).toBe("/places/1");
    expect(safeNextPath("/list?area=yeonnam&situation=%EB%8D%B0%EC%9D%B4%ED%8A%B8")).toBe("/list?area=yeonnam&situation=%EB%8D%B0%EC%9D%B4%ED%8A%B8");
  });
  it("외부 주소와 우회 시도는 기본값으로 바꾼다", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "evil", "", null, undefined, "/ok\nx", "/" + "a".repeat(400)]) {
      expect(safeNextPath(bad as string | null | undefined)).toBe("/me");
    }
  });
  it("기본값을 바꿀 수 있다", () => expect(safeNextPath("//x", "/")).toBe("/"));
});

describe("friendlyDbError", () => {
  it("권한 오류", () => {
    expect(friendlyDbError({ code: "42501", message: "x" })).toMatch(/권한/);
    expect(friendlyDbError({ message: 'new row violates row-level security policy for table "reviews"' })).toMatch(/권한/);
  });
  it("중복·참조·범위 오류", () => {
    expect(friendlyDbError({ code: "23505" })).toMatch(/이미 있습니다/);
    expect(friendlyDbError({ code: "23503" })).toMatch(/찾을 수 없습니다/);
    expect(friendlyDbError({ code: "23514" })).toMatch(/허용 범위/);
  });
  it("알 수 없는 오류는 내부 문구를 숨긴다", () => {
    const m = friendlyDbError({ code: "XX000", message: "connection to 10.0.0.5 refused" });
    expect(m).not.toContain("10.0.0.5");
    expect(m).toMatch(/다시 시도/);
  });
});

describe("formValues", () => {
  it("문자열 값을 모으고 같은 이름이 여럿이면 배열로 만든다", () => {
    const fd = new FormData();
    fd.append("name", "가게");
    fd.append("situations", "데이트");
    fd.append("situations", "혼밥");
    fd.append("$ACTION_ID_x", "1");
    fd.append("file", new Blob(["x"]), "a.txt");
    expect(formValues(fd)).toEqual({ name: "가게", situations: ["데이트", "혼밥"], file: "" });
  });
});

describe("resolveSiteUrl", () => {
  const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });
  it("환경 변수가 있으면 우선한다", () => expect(resolveSiteUrl(h({}), "https://mongmong.app/")).toBe("https://mongmong.app"));
  it("프록시 헤더로 주소를 만든다", () => expect(resolveSiteUrl(h({ "x-forwarded-host": "m.example.com", "x-forwarded-proto": "https" }), undefined)).toBe("https://m.example.com"));
  it("로컬은 http", () => expect(resolveSiteUrl(h({ host: "localhost:3000" }), undefined)).toBe("http://localhost:3000"));
  it("잘못된 환경 변수는 무시한다", () => expect(resolveSiteUrl(h({ host: "a.com" }), "javascript:x")).toBe("https://a.com"));
});
