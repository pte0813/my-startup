"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import type { FormState } from "@/lib/form-state";
import { safeNextPath } from "@/lib/safe-redirect";
import { resolveSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 이메일로 로그인 링크를 보낸다. 비밀번호는 쓰지 않는다. */
export async function sendMagicLink(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNextPath(String(formData.get("next") ?? ""));
  if (!EMAIL_RE.test(email) || email.length > 254) return { error: "이메일 주소를 확인해 주세요.", values: { email } };
  if (!isSupabaseConfigured()) return { error: "로그인 서비스가 아직 연결되지 않았습니다.", values: { email } };

  const siteUrl = resolveSiteUrl(await headers(), process.env.NEXT_PUBLIC_SITE_URL);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    const limited = error.status === 429 || /rate limit|security purposes/i.test(error.message);
    return { error: limited ? "잠시 뒤에 다시 시도해 주세요. 메일을 너무 자주 요청했습니다." : "메일을 보내지 못했습니다. 이메일 주소를 확인하고 다시 시도해 주세요.", values: { email } };
  }
  return { message: `${email} 로 로그인 링크를 보냈습니다. 메일함을 확인해 주세요.`, values: { email } };
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
