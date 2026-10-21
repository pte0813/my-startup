import Link from "next/link";
import { connection } from "next/server";
import { toggleSave } from "@/app/actions/saves";
import { getSession, isEditor } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { getSavedPlaceIds } from "@/lib/saves";
import { ActionButton } from "./ActionButton";

/** 가게 상세의 로그인 상태별 버튼(찜, 후기 쓰기, 가게 수정). 요청 시점 데이터라 `<Suspense>` 안에서 쓴다. */
export async function PlaceActions({ placeId }: { placeId: number }) {
  if (!isSupabaseConfigured()) return null;
  await connection(); // 로그인 확인(토큰 만료 시각 비교 등)은 요청 시점에 한다
  const session = await getSession();
  if (!session) {
    return (
      <p className="text-[15px] text-muted">
        <Link href={`/login?next=${encodeURIComponent(`/places/${placeId}`)}`} className="font-bold text-accent underline-offset-2 hover:underline">로그인</Link>하면 가게를 찜할 수 있습니다.
      </p>
    );
  }
  const saved = (await getSavedPlaceIds(session.userId)).has(placeId);
  return (
    <div className="flex flex-wrap items-start gap-2">
      <ActionButton action={toggleSave.bind(null, placeId)} label={saved ? "♥ 찜 해제" : "♡ 찜하기"} />
      {isEditor(session) && (
        <>
          <Link href={`/places/${placeId}/review/new`} className="tap flex min-h-11 items-center rounded-2xl bg-accent px-4 text-[15px] font-bold text-accent-fg">후기 쓰기</Link>
          <Link href={`/admin/places/${placeId}/edit`} className="tap flex min-h-11 items-center rounded-2xl bg-surface2 px-4 text-[15px] font-bold">가게 수정</Link>
        </>
      )}
    </div>
  );
}
