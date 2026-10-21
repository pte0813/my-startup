import type { Role } from "./types";

/** 후기를 쓰고 가게를 관리할 수 있는 역할. 화면 표시용이며, 실제 허용 여부는 DB의 RLS가 결정한다. */
export function isEditorRole(role: Role | null | undefined): boolean {
  return role === "editor" || role === "admin";
}

export const ROLE_LABEL: Record<Role, string> = { member: "회원", editor: "에디터", admin: "관리자" };
