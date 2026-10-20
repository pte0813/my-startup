import {
  AREAS, computeStats, isStale, sortReviews, staleLabel, waitLine,
  type Place, type PlaceStats, type Review,
} from "@mongmong/shared";

export interface PlaceView {
  place: Place;
  areaName: string;
  reviews: Review[];
  stats: PlaceStats;
  /** 카드에 보여줄 웨이팅 한 줄 (없으면 null) */
  wait: string | null;
  stale: boolean;
  staleText: string;
}

const areaNames = new Map(AREAS.map((a) => [a.slug, a.name]));

/** 가게에 후기·통계·검증 상태를 붙인다. `today`는 `YYYY-MM-DD`. */
export function buildPlaceViews(places: Place[], reviews: Review[], today: string): PlaceView[] {
  const byPlace = new Map<number, Review[]>();
  for (const r of reviews) {
    const list = byPlace.get(r.placeId);
    if (list) list.push(r);
    else byPlace.set(r.placeId, [r]);
  }
  return places.map((place) => {
    const rs = sortReviews(byPlace.get(place.id) ?? []);
    const stats = computeStats(rs);
    return {
      place,
      areaName: areaNames.get(place.areaSlug) ?? place.areaSlug,
      reviews: rs,
      stats,
      wait: waitLine(place, rs),
      stale: isStale(stats, today),
      staleText: staleLabel(stats, today),
    };
  });
}
