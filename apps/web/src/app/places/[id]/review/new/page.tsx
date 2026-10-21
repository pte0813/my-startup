import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ReviewForm } from "@/components/ReviewForm";
import { getSession, isEditor } from "@/lib/auth";
import { getCatalog } from "@/lib/catalog";
import { seoulDate } from "@/lib/date";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "후기 쓰기" };

export default function NewReviewPage(props: PageProps<"/places/[id]/review/new">) {
  return (
    <Suspense fallback={<p className="py-10 text-center text-muted">불러오는 중입니다…</p>}>
      <NewReviewBody params={props.params} />
    </Suspense>
  );
}

async function NewReviewBody({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const { places } = await getCatalog();
  const place = places.find((p) => String(p.id) === id);
  if (!place) notFound();

  const back = (
    <>
      <Link href={`/places/${place.id}`} className="tap mb-2 inline-flex min-h-11 items-center font-bold text-accent">← {place.name}</Link>
      <h1 className="mb-3 text-xl font-black tracking-[-0.03em]">후기 쓰기</h1>
    </>
  );
  if (!isSupabaseConfigured()) return <>{back}<p className="text-muted">저장 서비스가 아직 연결되지 않았습니다.</p></>;
  const session = await getSession();
  if (!session) {
    return <>{back}<p className="mb-3">후기를 쓰려면 로그인해 주세요.</p><Link href={`/login?next=${encodeURIComponent(`/places/${place.id}/review/new`)}`} className="tap inline-flex min-h-11 items-center rounded-2xl bg-accent px-5 font-bold text-accent-fg">로그인</Link></>;
  }
  if (!isEditor(session)) return <>{back}<p className="text-muted">후기는 에디터만 남길 수 있습니다. 에디터 권한이 필요하면 관리자에게 요청해 주세요.</p></>;
  return <>{back}<ReviewForm placeId={place.id} placeName={place.name} today={seoulDate(new Date())} /></>;
}
