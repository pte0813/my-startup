import Link from "next/link";
import { AREAS, countByArea } from "@mongmong/shared";
import { PlaceCard } from "@/components/PlaceCard";
import { getCatalog, getToday } from "@/lib/catalog";
import { buildPlaceViews } from "@/lib/views";

export default async function HomePage() {
  const [{ places, reviews }, today] = await Promise.all([getCatalog(), getToday()]);
  const views = buildPlaceViews(places, reviews, today);

  const rated = views
    .filter((v) => v.stats.reviewCount > 0 && v.stats.avgRating !== null)
    .sort((a, b) => (b.stats.avgRating ?? 0) - (a.stats.avgRating ?? 0) || b.stats.reviewCount - a.stats.reviewCount)
    .slice(0, 4);
  const ratedIds = new Set(rated.map((v) => v.place.id));
  // 동네가 골고루 보이도록 동네마다 하나씩 웨이팅 팁이 있는 가게를 고른다.
  const seenAreas = new Set<string>();
  const waits = views.filter((v) => {
    if (!v.wait || ratedIds.has(v.place.id) || seenAreas.has(v.place.areaSlug)) return false;
    seenAreas.add(v.place.areaSlug);
    return true;
  }).slice(0, 4);
  const counts = countByArea(places);

  return (
    <>
      <p className="mb-1.5 text-[17px] text-muted">오늘의 추천</p>
      <h1 className="mb-5 text-[30px] font-black leading-[1.28] tracking-[-0.04em] text-balance">
        웨이팅·예약까지 미리 알고 가는
        <br />
        <em className="not-italic text-accent">실패 없는 맛집</em>
      </h1>
      <div className="mb-8 flex flex-wrap gap-2">
        {[
          { href: "/search", label: "키워드 검색" },
          { href: "/list", label: "큐레이션 리스트" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="tap flex min-h-11 items-center rounded-full border border-line bg-surface px-[18px] font-medium">
            {l.label}
          </Link>
        ))}
      </div>

      {rated.length > 0 && (
        <section className="mb-8" aria-labelledby="h-rated">
          <SectionHead id="h-rated" title="후기 높은 맛집" href="/list" />
          <div className="grid gap-3.5">{rated.map((v) => <PlaceCard key={v.place.id} view={v} />)}</div>
        </section>
      )}

      <section className="mb-8" aria-labelledby="h-wait">
        <SectionHead id="h-wait" title="웨이팅 팁이 있는 맛집" href="/list" />
        <div className="grid gap-3.5">{waits.map((v) => <PlaceCard key={v.place.id} view={v} />)}</div>
      </section>

      <section className="mb-8" aria-labelledby="h-area">
        <h2 id="h-area" className="mb-3 text-xl font-black tracking-[-0.03em]">동네로 둘러보기</h2>
        <ul className="grid grid-cols-3 gap-2">
          {AREAS.map((a) => (
            <li key={a.slug}>
              <Link href={`/list?area=${a.slug}`} className="tap grid min-h-14 place-content-center rounded-2xl border border-line bg-surface p-1.5 text-center leading-snug">
                <b className="text-[15px]">{a.name}</b>
                <small className="text-[13px] text-muted">{counts[a.slug] ?? 0}곳</small>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function SectionHead({ id, title, href }: { id: string; title: string; href: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 id={id} className="text-xl font-black tracking-[-0.03em]">{title}</h2>
      <Link href={href} className="inline-flex min-h-11 items-center pl-3 text-[15px] font-bold text-accent">전체 →</Link>
    </div>
  );
}
