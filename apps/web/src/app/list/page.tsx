import type { Metadata } from "next";
import { Suspense } from "react";
import { AREAS, SITUATIONS, countByArea, filterPlaces, findArea, type Situation } from "@mongmong/shared";
import { ScrollToCurrent } from "@/components/ScrollToCurrent";
import { Chip } from "@/components/Chip";
import { PlaceCard } from "@/components/PlaceCard";
import { getCatalog, getToday } from "@/lib/catalog";
import { buildPlaceViews } from "@/lib/views";

export const metadata: Metadata = { title: "큐레이션 리스트" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function ListPage(props: PageProps<"/list">) {
  return (
    <>
      <h1 className="mb-3.5 text-2xl font-black tracking-[-0.04em]">큐레이션 리스트</h1>
      <Suspense fallback={<p className="py-10 text-center text-muted">가게를 불러오는 중입니다…</p>}>
        <ListBody searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function ListBody({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const area = findArea(first(sp.area)) ?? AREAS[0];
  const rawSituation = first(sp.situation);
  const situation: Situation | "전체" = (SITUATIONS as readonly string[]).includes(rawSituation ?? "") ? (rawSituation as Situation) : "전체";

  const [{ places, reviews, authors }, today] = await Promise.all([getCatalog(), getToday()]);
  const counts = countByArea(places);
  const items = buildPlaceViews(filterPlaces(places, { areaSlug: area.slug, situation }), reviews, today, authors);
  const href = (a: string, s: string) => `/list?area=${a}${s === "전체" ? "" : `&situation=${encodeURIComponent(s)}`}`;

  return (
    <>
      <ScrollToCurrent label="동네" className="-mx-4 mb-2.5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {AREAS.map((a) => (
          <Chip key={a.slug} href={href(a.slug, situation)} selected={a.slug === area.slug} count={counts[a.slug] ?? 0}>
            {a.name}
          </Chip>
        ))}
      </ScrollToCurrent>
      <nav aria-label="상황" className="-mx-4 mb-2.5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {["전체", ...SITUATIONS].map((s) => (
          <Chip key={s} href={href(area.slug, s)} selected={s === situation}>
            {s}
          </Chip>
        ))}
      </nav>
      <p className="mb-3 mt-1 text-[15px] text-muted" aria-live="polite">
        {area.name}
        {situation === "전체" ? "" : ` · ${situation}`} {items.length}곳
      </p>
      {items.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-line bg-surface px-4 py-8 text-center text-muted">
          {area.name}에는 ‘{situation}’에 맞는 가게가 아직 없습니다.
          <br />
          <a href={href(area.slug, "전체")} className="mt-3 inline-flex min-h-10 items-center rounded-2xl bg-surface2 px-4 text-sm font-bold text-fg">전체 상황 보기</a>
        </div>
      ) : (
        <div className="grid gap-3.5">{items.map((v) => <PlaceCard key={v.place.id} view={v} heading="h2" />)}</div>
      )}
    </>
  );
}
