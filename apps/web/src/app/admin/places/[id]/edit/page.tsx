import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { PhotoUploader } from "@/components/PhotoUploader";
import { PlaceForm } from "@/components/PlaceForm";
import { getSession, isEditor } from "@/lib/auth";
import { getCatalog } from "@/lib/catalog";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "가게 수정" };

export default function EditPlacePage(props: PageProps<"/admin/places/[id]/edit">) {
  return (
    <>
      <h1 className="mb-4 text-2xl font-black tracking-[-0.04em]">가게 수정</h1>
      <Suspense fallback={<p className="py-10 text-center text-muted">불러오는 중입니다…</p>}>
        <EditPlaceBody params={props.params} />
      </Suspense>
    </>
  );
}

async function EditPlaceBody({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const { places } = await getCatalog();
  const place = places.find((p) => String(p.id) === id);
  if (!place) notFound();
  if (!isSupabaseConfigured()) return <p className="text-muted">저장 서비스가 아직 연결되지 않았습니다.</p>;
  const session = await getSession();
  if (!session) return <Link href={`/login?next=${encodeURIComponent(`/admin/places/${place.id}/edit`)}`} className="tap inline-flex min-h-11 items-center rounded-2xl bg-accent px-5 font-bold text-accent-fg">로그인</Link>;
  if (!isEditor(session)) return <p className="text-muted">가게는 에디터만 수정할 수 있습니다.</p>;
  return (
    <div className="grid gap-5">
      <PhotoUploader placeId={place.id} name={place.name} category={place.category} photoPath={place.photoPath} />
      <PlaceForm
        placeId={place.id}
        initial={{
          areaSlug: place.areaSlug, name: place.name, category: place.category, situations: place.situations, summary: place.summary,
          waitTip: place.waitTip ?? "", reservationTip: place.reservationTip ?? "", address: place.address ?? "",
        }}
      />
    </div>
  );
}
