import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { EMPTY_PLACE, PlaceForm } from "@/components/PlaceForm";
import { getSession, isEditor } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "가게 추가" };

export default function NewPlacePage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-black tracking-[-0.04em]">가게 추가</h1>
      <Suspense fallback={<p className="py-10 text-center text-muted">불러오는 중입니다…</p>}>
        <NewPlaceBody />
      </Suspense>
    </>
  );
}

async function NewPlaceBody() {
  await connection();
  if (!isSupabaseConfigured()) return <p className="text-muted">저장 서비스가 아직 연결되지 않았습니다.</p>;
  const session = await getSession();
  if (!session) return <Link href="/login?next=%2Fadmin%2Fplaces%2Fnew" className="tap inline-flex min-h-11 items-center rounded-2xl bg-accent px-5 font-bold text-accent-fg">로그인</Link>;
  if (!isEditor(session)) return <p className="text-muted">가게는 에디터만 추가할 수 있습니다.</p>;
  return <PlaceForm placeId={null} initial={EMPTY_PLACE} />;
}
