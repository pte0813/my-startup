"use server";

import { refresh } from "next/cache";
import { getSession } from "@/lib/auth";
import { friendlyDbError } from "@/lib/db-errors";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

/** 찜을 켜고 끈다. 로그인한 회원 누구나 자기 찜만 바꿀 수 있다. */
export async function toggleSave(placeId: number): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: "로그인이 필요합니다." };
  if (!Number.isInteger(placeId) || placeId <= 0) return { error: "가게를 찾을 수 없습니다." };

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("saves").select("place_id").eq("user_id", session.userId).eq("place_id", placeId).maybeSingle();
  if (readError) return { error: friendlyDbError(readError) };

  const { error } = existing
    ? await supabase.from("saves").delete().eq("user_id", session.userId).eq("place_id", placeId)
    : await supabase.from("saves").insert({ user_id: session.userId, place_id: placeId });
  if (error) return { error: friendlyDbError(error) };

  refresh();
  return { message: existing ? "찜을 해제했습니다." : "찜했습니다." };
}
