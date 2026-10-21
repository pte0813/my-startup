import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Place, Review } from "@mongmong/shared";
import seed from "../../../../supabase/seed/places.json";
import { toPlace, toReview, type PlaceRow, type ReviewRow } from "./db-rows";
import { isSupabaseConfigured } from "./env";
import { seoulDate } from "./date";
import { createPublicClient } from "./supabase/public";

export interface Catalog {
  places: Place[];
  reviews: Review[];
  /** 후기 작성자 id → 표시 이름 (에디터·관리자만) */
  authors: Record<string, string>;
  /** DB에 연결돼 있으면 "db", 시드 데이터면 "seed" */
  source: "db" | "seed";
}

/** 모든 방문자가 같은 데이터를 보므로 캐시한다. 에디터가 저장하면 `catalog` 태그로 갱신한다. */
export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");

  if (!isSupabaseConfigured()) {
    const places: Place[] = seed.map((s) => ({
      id: s.id,
      areaSlug: s.areaSlug,
      name: s.name,
      category: s.category,
      situations: s.situations as Place["situations"],
      summary: s.summary,
      waitTip: s.waitTip,
      reservationTip: s.reservationTip,
      address: s.address,
      photoPath: null,
      status: "published",
      sortOrder: s.sortOrder,
    }));
    return { places, reviews: [], authors: {}, source: "seed" };
  }

  const sb = createPublicClient();
  const [placesRes, reviewsRes, authorsRes] = await Promise.all([
    sb.from("places").select("*").eq("status", "published").order("sort_order"),
    sb.from("reviews").select("*"),
    sb.from("author_names").select("id, display_name"),
  ]);
  if (placesRes.error) throw new Error(`가게 목록을 불러오지 못했습니다: ${placesRes.error.message}`);
  if (reviewsRes.error) throw new Error(`후기를 불러오지 못했습니다: ${reviewsRes.error.message}`);
  return {
    places: (placesRes.data as PlaceRow[]).map(toPlace),
    reviews: (reviewsRes.data as ReviewRow[]).map(toReview),
    authors: Object.fromEntries(((authorsRes.data ?? []) as { id: string; display_name: string | null }[]).map((a) => [a.id, a.display_name || "에디터"])),
    source: "db",
  };
}

/** 한국 시간 기준 오늘 날짜. 요청마다 달라지는 값이라 캐시해서 한 시간 단위로 갱신한다. */
export async function getToday(): Promise<string> {
  "use cache";
  cacheLife("hours");
  return seoulDate(new Date());
}
