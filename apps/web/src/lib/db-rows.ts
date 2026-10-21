import { SITUATIONS, type Place, type PlaceStatus, type Review, type Situation } from "@mongmong/shared";

/** Supabase `places` 행 (snake_case). */
export interface PlaceRow {
  id: number;
  area_slug: string;
  name: string;
  category: string;
  situations: string[];
  summary: string;
  wait_tip: string | null;
  reservation_tip: string | null;
  address: string | null;
  photo_path: string | null;
  status: PlaceStatus;
  sort_order: number;
}

/** Supabase `reviews` 행. */
export interface ReviewRow {
  id: string;
  place_id: number;
  author_id: string | null;
  rating: number;
  visited_on: string;
  wait_minutes: number | null;
  body: string;
  tip: string | null;
  sponsored: boolean;
  created_at: string;
}

const isSituation = (s: string): s is Situation => (SITUATIONS as readonly string[]).includes(s);

export function toPlace(r: PlaceRow): Place {
  return {
    id: r.id,
    areaSlug: r.area_slug,
    name: r.name,
    category: r.category,
    situations: r.situations.filter(isSituation),
    summary: r.summary,
    waitTip: r.wait_tip,
    reservationTip: r.reservation_tip,
    address: r.address,
    photoPath: r.photo_path,
    status: r.status,
    sortOrder: r.sort_order,
  };
}

export function toReview(r: ReviewRow): Review {
  return {
    id: r.id,
    placeId: r.place_id,
    authorId: r.author_id,
    rating: r.rating,
    visitedOn: r.visited_on,
    waitMinutes: r.wait_minutes,
    body: r.body,
    tip: r.tip,
    sponsored: r.sponsored,
    createdAt: r.created_at,
  };
}
