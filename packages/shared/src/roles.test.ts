import { describe, expect, it } from "vitest";
import { isEditorRole, ROLE_LABEL } from "./roles";

describe("isEditorRole", () => {
  it("에디터와 관리자만 true", () => {
    expect(isEditorRole("editor")).toBe(true);
    expect(isEditorRole("admin")).toBe(true);
    expect(isEditorRole("member")).toBe(false);
    expect(isEditorRole(null)).toBe(false);
    expect(isEditorRole(undefined)).toBe(false);
  });
  it("모든 역할에 한국어 이름이 있다", () => expect(Object.keys(ROLE_LABEL).sort()).toEqual(["admin", "editor", "member"]));
});
