export const SITUATIONS = ["데이트", "혼밥", "팀 회식"] as const;
export type Situation = (typeof SITUATIONS)[number];

export type Role = "member" | "editor" | "admin";
export type PlaceStatus = "published" | "draft" | "closed";

export interface Area {
  slug: string;
  name: string;
  sortOrder: number;
}

export interface Place {
  id: number;
  areaSlug: string;
  name: string;
  category: string;
  situations: Situation[];
  summary: string;
  waitTip: string | null;
  reservationTip: string | null;
  address: string | null;
  photoPath: string | null;
  status: PlaceStatus;
  sortOrder: number;
}

export interface Review {
  id: string;
  placeId: number;
  authorId: string | null;
  rating: number;
  /** YYYY-MM-DD */
  visitedOn: string;
  waitMinutes: number | null;
  body: string;
  tip: string | null;
  sponsored: boolean;
  createdAt: string;
}

export interface PlaceStats {
  reviewCount: number;
  avgRating: number | null;
  /** 마지막 검증일(가장 최근 방문일), 후기가 없으면 null */
  lastVisitedOn: string | null;
  hasSponsored: boolean;
}
