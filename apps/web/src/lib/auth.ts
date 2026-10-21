import "server-only";
import { isEditorRole, type Role } from "@mongmong/shared";
import { isSupabaseConfigured } from "./env";
import { createClient } from "./supabase/server";

export interface Session {
  userId: string;
  email: string | null;
  role: Role;
  displayName: string | null;
}

const ROLES: readonly string[] = ["member", "editor", "admin"];

/**
 * 현재 로그인한 사용자와 역할. 로그인하지 않았거나 Supabase 가 연결되지 않았으면 null.
 * 토큰 쿠키는 위조될 수 있어서 `getUser()`로 인증 서버에 확인한 값만 믿는다.
 * 요청 시점 데이터를 읽으므로 `<Suspense>` 안이나 서버 액션에서만 호출한다.
 */
export async function getSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: profile } = await supabase.from("profiles").select("role, display_name").eq("id", data.user.id).maybeSingle();
  const role = profile && ROLES.includes(profile.role) ? (profile.role as Role) : "member";
  return { userId: data.user.id, email: data.user.email ?? null, role, displayName: profile?.display_name ?? null };
}

export const isEditor = (s: Session | null): s is Session => Boolean(s && isEditorRole(s.role));
