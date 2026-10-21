"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/** 사진 업로드처럼 브라우저에서 직접 저장소에 올릴 때 쓰는 클라이언트(로그인 세션은 쿠키에서 읽는다). */
export function createBrowserSupabase() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
