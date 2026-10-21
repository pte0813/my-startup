import type { Area } from "./types";

export interface NearbyArea {
  area: Area;
  /** 현재 위치에서 동네 중심까지의 직선거리(km) */
  km: number;
}

/** 이 거리보다 멀면 "주요 동네에서 멀다"고 안내한다. */
export const FAR_KM = 25;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** 두 좌표 사이의 직선거리(km), 하버사인 공식. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** 현재 위치에서 가까운 순으로 동네를 정렬한다. 위도·경도가 올바르지 않으면 빈 목록. */
export function nearestAreas(lat: number, lng: number, areas: readonly Area[], limit = areas.length): NearbyArea[] {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return [];
  return areas
    .map((area) => ({ area, km: distanceKm(lat, lng, area.lat, area.lng) }))
    .sort((a, b) => a.km - b.km || a.area.sortOrder - b.area.sortOrder)
    .slice(0, limit);
}

/** 1km 미만은 100m 단위, 10km 미만은 소수 한 자리, 그 이상은 정수 km. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(1, Math.round(km * 10)) * 100}m`;
  if (km < 10) return `${km.toFixed(1)}km`;
  return `${Math.round(km)}km`;
}
