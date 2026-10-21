export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Supabase 연결 정보가 있으면 DB를, 없으면 시드 데이터(읽기 전용)를 쓴다. */
export const isSupabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** 사진 저장소의 공개 주소. */
export function photoUrl(photoPath: string | null | undefined): string | null {
  if (!photoPath || !SUPABASE_URL) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/place-photos/${photoPath.split("/").map(encodeURIComponent).join("/")}`;
}
