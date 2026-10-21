"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { AREAS, validatePlace } from "@mongmong/shared";
import { getSession, isEditor } from "@/lib/auth";
import { friendlyDbError } from "@/lib/db-errors";
import { formValues, type FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

const validId = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0;

/** 가게를 새로 추가하거나(placeId=null) 고친다. 에디터만 가능하다. */
export async function savePlace(placeId: number | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const session = await getSession();
  if (!session) return { error: "로그인이 필요합니다.", values };
  if (!isEditor(session)) return { error: "가게는 에디터만 추가·수정할 수 있습니다.", values };
  if (placeId !== null && !validId(placeId)) return { error: "가게를 찾을 수 없습니다.", values };

  const parsed = validatePlace(
    {
      areaSlug: formData.get("areaSlug"),
      name: formData.get("name"),
      category: formData.get("category"),
      situations: formData.getAll("situations"),
      summary: formData.get("summary"),
      waitTip: formData.get("waitTip"),
      reservationTip: formData.get("reservationTip"),
      address: formData.get("address"),
    },
    AREAS.map((a) => a.slug),
  );
  if (!parsed.ok) return { error: parsed.error, values };
  const v = parsed.value;
  const columns = {
    area_slug: v.areaSlug, name: v.name, category: v.category, situations: v.situations,
    summary: v.summary, wait_tip: v.waitTip, reservation_tip: v.reservationTip, address: v.address,
  };

  const supabase = await createClient();
  let id = placeId;
  if (placeId === null) {
    const { data: last } = await supabase.from("places").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await supabase
      .from("places").insert({ ...columns, created_by: session.userId, sort_order: (last?.sort_order ?? 0) + 1 }).select("id").single();
    if (error || !data) return { error: friendlyDbError(error ?? {}), values };
    id = data.id as number;
  } else {
    const { data, error } = await supabase.from("places").update(columns).eq("id", placeId).select("id");
    if (error) return { error: friendlyDbError(error), values };
    if (!data || data.length === 0) return { error: "수정할 수 없는 가게입니다.", values };
  }

  updateTag("catalog");
  redirect(`/places/${id}`);
}

const PHOTO_PATH_RE = /^(\d+)\/[0-9a-f-]{36}\.jpg$/;

/** 브라우저가 저장소에 올린 사진을 가게에 연결한다. 경로가 해당 가게의 폴더인지 확인한다. */
export async function setPlacePhoto(placeId: number, path: string): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: "로그인이 필요합니다." };
  if (!isEditor(session)) return { error: "사진은 에디터만 등록할 수 있습니다." };
  const m = PHOTO_PATH_RE.exec(path);
  if (!validId(placeId) || !m || Number(m[1]) !== placeId) return { error: "올바르지 않은 사진 경로입니다." };

  const supabase = await createClient();
  const { data: before } = await supabase.from("places").select("photo_path").eq("id", placeId).maybeSingle();
  const { data, error } = await supabase.from("places").update({ photo_path: path }).eq("id", placeId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data || data.length === 0) return { error: "사진을 연결할 수 없는 가게입니다." };
  if (before?.photo_path && before.photo_path !== path) await supabase.storage.from("place-photos").remove([before.photo_path]);

  updateTag("catalog");
  return { message: "사진을 등록했습니다." };
}

export async function removePlacePhoto(placeId: number): Promise<FormState> {
  const session = await getSession();
  if (!session) return { error: "로그인이 필요합니다." };
  if (!isEditor(session)) return { error: "사진은 에디터만 지울 수 있습니다." };
  if (!validId(placeId)) return { error: "가게를 찾을 수 없습니다." };

  const supabase = await createClient();
  const { data: before } = await supabase.from("places").select("photo_path").eq("id", placeId).maybeSingle();
  const { data, error } = await supabase.from("places").update({ photo_path: null }).eq("id", placeId).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data || data.length === 0) return { error: "수정할 수 없는 가게입니다." };
  if (before?.photo_path) await supabase.storage.from("place-photos").remove([before.photo_path]);

  updateTag("catalog");
  return { message: "사진을 지웠습니다." };
}
