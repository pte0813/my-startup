"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { validateReview } from "@mongmong/shared";
import { getSession, isEditor } from "@/lib/auth";
import { friendlyDbError } from "@/lib/db-errors";
import { seoulDate } from "@/lib/date";
import { formValues, type FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

const validId = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0;

/** 후기를 저장한다. 에디터만 가능하며, 같은 규칙을 DB 의 RLS 가 한 번 더 확인한다. */
export async function createReview(placeId: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const session = await getSession();
  if (!session) return { error: "로그인이 필요합니다.", values };
  if (!isEditor(session)) return { error: "후기는 에디터만 남길 수 있습니다.", values };
  if (!validId(placeId)) return { error: "가게를 찾을 수 없습니다.", values };

  const parsed = validateReview({ ...Object.fromEntries(formData), sponsored: formData.get("sponsored") === "on" }, seoulDate(new Date()));
  if (!parsed.ok) return { error: parsed.error, values };
  const v = parsed.value;

  const supabase = await createClient();
  const { error } = await supabase.from("reviews").insert({
    place_id: placeId,
    author_id: session.userId,
    rating: v.rating,
    visited_on: v.visitedOn,
    wait_minutes: v.waitMinutes,
    body: v.body,
    tip: v.tip,
    sponsored: v.sponsored,
  });
  if (error) return { error: friendlyDbError(error), values };

  updateTag("catalog");
  redirect(`/places/${placeId}`);
}

/** 후기를 지운다. 본인 후기이거나 관리자일 때만 지워지고, 그 밖에는 DB 가 0건을 지운다. */
export async function deleteReview(reviewId: string, placeId: number): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: "로그인이 필요합니다." };
  if (!isEditor(session)) return { error: "후기를 지울 권한이 없습니다." };
  if (!/^[0-9a-f-]{36}$/i.test(reviewId)) return { error: "후기를 찾을 수 없습니다." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("reviews").delete().eq("id", reviewId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data || data.length === 0) return { error: "지울 수 없는 후기입니다. 본인이 쓴 후기만 지울 수 있습니다." };

  updateTag("catalog");
  redirect(`/places/${placeId}`);
}
