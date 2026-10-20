import type { Place, PlaceStats, Review } from "./types";

/** 마지막 검증 후 이 일수가 지나면 경고를 붙인다. */
export const STALE_DAYS = 90;

/** `YYYY-MM-DD` 두 날짜의 일수 차이(b - a). 시간대 영향을 받지 않도록 UTC 자정으로 계산한다. */
export function daysBetween(a: string, b: string): number {
  const toMs = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((toMs(b) - toMs(a)) / 86_400_000);
}

export function computeStats(reviews: Review[]): PlaceStats {
  if (reviews.length === 0) {
    return { reviewCount: 0, avgRating: null, lastVisitedOn: null, hasSponsored: false };
  }
  const sum = reviews.reduce((s, r) => s + r.rating, 0);
  const lastVisitedOn = reviews.reduce((max, r) => (r.visitedOn > max ? r.visitedOn : max), reviews[0].visitedOn);
  return {
    reviewCount: reviews.length,
    avgRating: sum / reviews.length,
    lastVisitedOn,
    hasSponsored: reviews.some((r) => r.sponsored),
  };
}

/** 검증 전이거나 90일을 넘으면 true. `today`는 `YYYY-MM-DD`. */
export function isStale(stats: PlaceStats, today: string): boolean {
  return stats.lastVisitedOn === null || daysBetween(stats.lastVisitedOn, today) > STALE_DAYS;
}

export function staleLabel(stats: PlaceStats, today: string): string {
  return stats.lastVisitedOn === null ? "검증 전" : `검증 ${daysBetween(stats.lastVisitedOn, today)}일 전`;
}

/** 후기를 방문일 내림차순(같으면 작성 시각 내림차순)으로 정렬한다. */
export function sortReviews(reviews: Review[]): Review[] {
  return [...reviews].sort(
    (a, b) => b.visitedOn.localeCompare(a.visitedOn) || b.createdAt.localeCompare(a.createdAt),
  );
}

/** 카드에 보여줄 웨이팅 한 줄. 최근 후기의 실제 대기 시간이 있으면 그것을, 없으면 가게의 웨이팅 팁을 쓴다. */
export function waitLine(place: Pick<Place, "waitTip">, sortedReviews: Review[]): string | null {
  const withWait = sortedReviews.find((r) => r.waitMinutes !== null);
  if (withWait) return `최근 방문 실제 대기 ${withWait.waitMinutes}분 (${withWait.visitedOn})`;
  return place.waitTip && place.waitTip.trim() ? place.waitTip : null;
}
