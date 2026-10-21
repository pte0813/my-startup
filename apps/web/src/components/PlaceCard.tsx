import Link from "next/link";
import type { PlaceView } from "@/lib/views";
import { Stars } from "./Stars";
import { Thumb } from "./Thumb";

export function PlaceCard({ view }: { view: PlaceView }) {
  const { place, stats, reviews, wait, stale, staleText, areaName, authors } = view;
  const latest = reviews[0];
  return (
    <article>
      <Link
        href={`/places/${place.id}`}
        className="tap grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-[22px] border border-line bg-surface p-4 min-[400px]:grid-cols-[88px_minmax(0,1fr)] min-[400px]:gap-x-4"
      >
        <div className="row-span-2">
          <Thumb name={place.name} category={place.category} photoPath={place.photoPath} />
        </div>
        <div className="min-w-0">
          <h3 className="text-xl font-black leading-snug tracking-[-0.03em]">{place.name}</h3>
          <p className="text-[15px] text-muted">
            {areaName} · {place.category}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[15px] text-muted">
            {stats.avgRating !== null ? (
              <>
                <Stars rating={stats.avgRating} /> <span>· 후기 {stats.reviewCount}</span>
              </>
            ) : (
              <span>후기 아직 없음</span>
            )}
            {stats.hasSponsored && <span className="rounded-full bg-accent px-2 text-xs font-bold text-accent-fg">협찬 후기</span>}
            {stale && stats.reviewCount > 0 && <span className="rounded-full bg-accent-soft px-2 text-xs font-bold text-accent">{staleText}</span>}
          </p>
        </div>
        <div className="col-start-2 grid min-w-0 gap-0.5 border-t border-line pt-2.5">
          {latest ? (
            <>
              <div className="flex items-center justify-between gap-2 text-[15px]">
                <b className="font-bold">
                  {(latest.authorId && authors[latest.authorId]) || "에디터"} <Stars rating={latest.rating} />
                </b>
                <time className="text-sm tabular-nums text-muted">{latest.visitedOn}</time>
              </div>
              <p className="line-clamp-2 leading-normal">{latest.body}</p>
            </>
          ) : wait ? (
            <p className="line-clamp-2 leading-normal">
              <b className="mr-1.5 text-accent">웨이팅</b>
              {wait}
            </p>
          ) : (
            <p className="text-[15px] text-muted">웨이팅 정보를 확인하는 중입니다.</p>
          )}
        </div>
      </Link>
    </article>
  );
}
