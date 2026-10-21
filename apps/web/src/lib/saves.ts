import "server-only";
import { createClient } from "./supabase/server";

/** 로그인한 사용자가 찜한 가게 번호들. 요청 시점 데이터라 `<Suspense>` 안에서만 쓴다. */
export async function getSavedPlaceIds(userId: string): Promise<Set<number>> {
  const supabase = await createClient();
  const { data } = await supabase.from("saves").select("place_id").eq("user_id", userId);
  return new Set(((data ?? []) as { place_id: number }[]).map((r) => r.place_id));
}
