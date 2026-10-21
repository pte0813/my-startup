import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { searchPlaces } from "@mongmong/shared";
import { PlaceCard } from "@/components/PlaceCard";
import { getCatalog, getToday } from "@/lib/catalog";
import { buildPlaceViews } from "@/lib/views";

export const metadata: Metadata = { title: "검색" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <>
      <h1 className="mb-3.5 text-2xl font-black tracking-[-0.04em]">검색</h1>
      <Suspense fallback={<p className="py-10 text-center text-muted">불러오는 중입니다…</p>}>
        <SearchBody searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function SearchBody({ searchParams }: { searchParams: SearchParams }) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.slice(0, 50) ?? "";
  const [{ places, reviews, authors }, today] = await Promise.all([getCatalog(), getToday()]);
  const hits = buildPlaceViews(searchPlaces(places, q), reviews, today, authors);
  // 추천 검색어: 가게가 많은 종류 순
  const freq = new Map<string, number>();
  for (const p of places) freq.set(p.category, (freq.get(p.category) ?? 0) + 1);
  const suggestions = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko")).slice(0, 14).map(([c]) => c);

  return (
    <>
      <form action="/search" role="search" className="relative mb-3.5">
        <label htmlFor="q" className="sr-only">가게, 종류, 동네 검색</label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="가게·종류·동네를 검색해 보세요"
          autoComplete="off"
          className="min-h-[52px] w-full rounded-2xl border border-line bg-surface px-4 text-[17px]"
        />
      </form>
      {q.trim() === "" ? (
        <>
          <p className="mb-2.5 text-[15px] text-muted">추천 검색어</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((c) => (
              <Link key={c} href={`/search?q=${encodeURIComponent(c)}`} className="tap inline-flex min-h-[42px] items-center rounded-full border border-line bg-surface px-4 text-[15px]">
                {c}
              </Link>
            ))}
          </div>
        </>
      ) : hits.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-line bg-surface px-4 py-8 text-center text-muted">
          ‘{q.trim()}’에 맞는 가게가 없습니다.
          <br />
          다른 키워드로 찾아보세요.
        </div>
      ) : (
        <>
          <p className="mb-3 text-[15px] text-muted" aria-live="polite">검색 결과 {hits.length}곳</p>
          <div className="grid gap-3.5">{hits.map((v) => <PlaceCard key={v.place.id} view={v} />)}</div>
        </>
      )}
    </>
  );
}
