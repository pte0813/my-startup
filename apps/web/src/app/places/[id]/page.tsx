import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AREAS } from "@mongmong/shared";
import { BackButton } from "@/components/BackButton";
import { PlaceLinks } from "@/components/PlaceLinks";
import { PlaceActions } from "@/components/PlaceActions";
import { ReviewListLive, ReviewListStatic } from "@/components/ReviewListLive";
import { Stars } from "@/components/Stars";
import { Thumb } from "@/components/Thumb";
import { getCatalog, getToday } from "@/lib/catalog";
import { buildPlaceViews } from "@/lib/views";

export async function generateStaticParams() {
  const { places } = await getCatalog();
  return places.map((p) => ({ id: String(p.id) }));
}

export async function generateMetadata(props: PageProps<"/places/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const { places } = await getCatalog();
  const place = places.find((p) => String(p.id) === id);
  return place ? { title: place.name, description: place.summary || `${place.name} 웨이팅·예약 정보` } : { title: "가게를 찾을 수 없습니다" };
}

const known = (v: string | null | undefined): v is string => Boolean(v && v.trim());

/** 주소의 가게 번호는 요청 시점에 정해지므로 본문은 `<Suspense>` 안에서 읽는다. 목록에 있던 가게는 미리 만들어 두고, 새 가게는 뼈대부터 바로 보여 준다. */
export default function PlacePage(props: PageProps<"/places/[id]">) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" aria-label="가게 정보를 불러오는 중" className="grid gap-5 pt-1">
          <div className="h-11 w-24 rounded-2xl bg-surface2" />
          <div className="h-[72px] rounded-[22px] bg-surface2" />
          <div className="h-48 rounded-[22px] bg-surface2" />
        </div>
      }
    >
      <PlaceBody params={props.params} />
    </Suspense>
  );
}

async function PlaceBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ places, reviews, authors }, today] = await Promise.all([getCatalog(), getToday()]);
  const place = places.find((p) => String(p.id) === id);
  if (!place) notFound();

  const [view] = buildPlaceViews([place], reviews.filter((r) => r.placeId === place.id), today, authors);
  const area = AREAS.find((a) => a.slug === place.areaSlug);
  const siblings = places.filter((p) => p.areaSlug === place.areaSlug);
  const idx = siblings.findIndex((p) => p.id === place.id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const { stats } = view;

  return (
    <article aria-label={`${place.name} 상세`}>
      <div className="sticky top-[calc(env(safe-area-inset-top,0px)+68px)] z-10 -mt-5 mb-4 flex items-center gap-2 bg-bg py-1.5">
        <BackButton fallback={`/list?area=${place.areaSlug}`} />
        <span className="truncate text-sm text-muted">{view.areaName} › {place.name}</span>
      </div>

      <div className="grid gap-5">
        <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-4">
          <Thumb name={place.name} category={place.category} photoPath={place.photoPath} size="detail" />
          <div>
            <h1 className="text-[26px] font-black leading-snug tracking-[-0.04em] text-balance">{place.name}</h1>
            <p className="text-muted">{view.areaName} · {place.summary || place.category}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[15px] text-muted">
              {stats.avgRating !== null ? (
                <>
                  <Stars rating={stats.avgRating} /> <span>· 후기 {stats.reviewCount}</span>
                </>
              ) : (
                <span>후기 아직 없음</span>
              )}
              {stats.hasSponsored && <span className="rounded-full bg-accent px-2 text-xs font-bold text-accent-fg">협찬 후기</span>}
              <span className="rounded-full bg-accent-soft px-2 text-xs font-bold text-accent">{view.stale ? view.staleText : "검증됨"}</span>
            </p>
          </div>
        </div>

        <Suspense fallback={null}>
          <PlaceActions placeId={place.id} />
        </Suspense>

        <section className="grid gap-3 rounded-[22px] border border-line bg-surface p-[18px]" aria-labelledby="h-before">
          <h2 id="h-before" className="flex items-baseline gap-2 text-lg font-black tracking-[-0.03em]">
            가기 전에 <span className="text-[13px] font-medium tracking-normal text-muted">웨이팅·예약</span>
          </h2>
          <dl className="grid gap-2.5">
            <div className="rounded-[14px] bg-accent-soft px-3.5 py-3">
              <dt className="mb-0.5 text-[13px] font-bold text-accent">웨이팅 팁</dt>
              <dd className={view.wait ? "" : "text-muted"}>{view.wait ?? "확인 필요"}</dd>
            </div>
            <div className="rounded-[14px] bg-surface2 px-3.5 py-3">
              <dt className="mb-0.5 text-[13px] font-bold text-muted">예약 요령</dt>
              <dd className={known(place.reservationTip) ? "" : "text-muted"}>{known(place.reservationTip) ? place.reservationTip : "확인 필요"}</dd>
            </div>
          </dl>
          <p className="text-[13px] text-muted">
            {stats.lastVisitedOn ? `마지막 방문 검증 ${stats.lastVisitedOn}` : "웹 검색 기준 정보이며 아직 직접 방문하지 않았습니다. 방문 전 공식 채널에서 확인하세요."}
          </p>
        </section>

        <section className="grid gap-3 rounded-[22px] border border-line bg-surface p-[18px]" aria-labelledby="h-go">
          <h2 id="h-go" className="flex items-baseline gap-2 text-lg font-black tracking-[-0.03em]">
            찾아가기 <span className="text-[13px] font-medium tracking-normal text-muted">위치·리뷰</span>
          </h2>
          <dl>
            <div className="rounded-[14px] bg-surface2 px-3.5 py-3">
              <dt className="mb-0.5 text-[13px] font-bold text-muted">주소</dt>
              <dd className={known(place.address) ? "" : "text-muted"}>{known(place.address) ? place.address : "확인 필요"}</dd>
            </div>
          </dl>
          <PlaceLinks areaName={area?.name ?? view.areaName} placeName={place.name} />
        </section>

        <section className="grid gap-3 rounded-[22px] border border-line bg-surface p-[18px]" aria-labelledby="h-after">
          <h2 id="h-after" className="flex items-baseline gap-2 text-lg font-black tracking-[-0.03em]">
            다녀온 뒤 <span className="text-[13px] font-medium tracking-normal text-muted">몽몽 후기 {stats.reviewCount}</span>
          </h2>
          {view.reviews.length > 0 ? (
            <Suspense fallback={<ReviewListStatic reviews={view.reviews} authors={authors} />}>
              <ReviewListLive reviews={view.reviews} placeId={place.id} authors={authors} />
            </Suspense>
          ) : (
            <p className="text-muted">아직 후기가 없습니다. 에디터가 직접 다녀온 뒤 후기를 남기면 검증일이 갱신됩니다.</p>
          )}
        </section>

        {(prev || next) && (
          <nav aria-label="같은 동네의 다른 가게" className="grid grid-cols-2 gap-2">
            {prev ? <Link href={`/places/${prev.id}`} className="tap flex min-h-[50px] min-w-0 items-center gap-1.5 rounded-2xl bg-surface2 px-4 font-bold">‹ <span className="truncate">{prev.name}</span></Link> : <span className="flex min-h-[50px] items-center rounded-2xl bg-surface2 px-4 font-bold text-muted">처음입니다</span>}
            {next ? <Link href={`/places/${next.id}`} className="tap flex min-h-[50px] min-w-0 items-center justify-end gap-1.5 rounded-2xl bg-surface2 px-4 font-bold"><span className="truncate">{next.name}</span> ›</Link> : <span className="flex min-h-[50px] items-center justify-end rounded-2xl bg-surface2 px-4 font-bold text-muted">마지막입니다</span>}
          </nav>
        )}
      </div>
    </article>
  );
}
