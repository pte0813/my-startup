import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ROLE_LABEL, isEditorRole } from "@mongmong/shared";
import { signOut } from "@/app/actions/auth";
import { PlaceCard } from "@/components/PlaceCard";
import { Stars } from "@/components/Stars";
import { getSession } from "@/lib/auth";
import { getCatalog, getToday } from "@/lib/catalog";
import { isSupabaseConfigured } from "@/lib/env";
import { getSavedPlaceIds } from "@/lib/saves";
import { buildPlaceViews } from "@/lib/views";

export const metadata: Metadata = { title: "마이" };

export default function MePage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-black tracking-[-0.04em]">마이</h1>
      <Suspense fallback={<p className="py-10 text-center text-muted">불러오는 중입니다…</p>}>
        <MeBody />
      </Suspense>
    </>
  );
}

async function MeBody() {
  await connection();
  if (!isSupabaseConfigured()) {
    return <div className="rounded-[22px] border border-dashed border-line bg-surface px-4 py-8 text-center text-muted">로그인 서비스가 아직 연결되지 않았습니다.</div>;
  }
  const session = await getSession();
  if (!session) {
    return (
      <div className="grid gap-3 rounded-[22px] border border-line bg-surface p-[18px]">
        <p>로그인하면 찜한 가게를 모아 볼 수 있어요.</p>
        <Link href="/login?next=%2Fme" className="tap flex min-h-[50px] items-center justify-center rounded-2xl bg-accent font-bold text-accent-fg">로그인</Link>
      </div>
    );
  }

  const [{ places, reviews, authors }, today, savedIds] = await Promise.all([getCatalog(), getToday(), getSavedPlaceIds(session.userId)]);
  const saved = buildPlaceViews(places.filter((p) => savedIds.has(p.id)), reviews, today, authors);
  const placeName = new Map(places.map((p) => [p.id, p.name]));
  const mine = reviews.filter((r) => r.authorId === session.userId).sort((a, b) => b.visitedOn.localeCompare(a.visitedOn));

  return (
    <div className="grid gap-7">
      <section className="grid gap-3 rounded-[22px] border border-line bg-surface p-[18px]" aria-labelledby="h-account">
        <h2 id="h-account" className="sr-only">내 계정</h2>
        <div className="flex flex-wrap items-center gap-2">
          <b className="break-all">{session.email}</b>
          <span className="rounded-full bg-accent-soft px-2.5 text-[13px] font-bold text-accent">{ROLE_LABEL[session.role]}</span>
        </div>
        {isEditorRole(session.role) && (
          <Link href="/admin/places/new" className="tap flex min-h-11 items-center justify-center rounded-2xl bg-surface2 px-4 font-bold">+ 가게 추가</Link>
        )}
        <form action={signOut}>
          <button type="submit" className="tap min-h-11 rounded-2xl bg-surface2 px-4 text-[15px] font-bold">로그아웃</button>
        </form>
      </section>

      <section aria-labelledby="h-saved">
        <h2 id="h-saved" className="mb-3 text-xl font-black tracking-[-0.03em]">내가 찜한 가게 <span className="text-base font-medium text-muted">{saved.length}</span></h2>
        {saved.length === 0 ? (
          <p className="rounded-[22px] border border-dashed border-line bg-surface px-4 py-8 text-center text-muted">아직 찜한 가게가 없어요. 가게 상세에서 ♡를 눌러 보세요.</p>
        ) : (
          <div className="grid gap-3.5">{saved.map((v) => <PlaceCard key={v.place.id} view={v} />)}</div>
        )}
      </section>

      {isEditorRole(session.role) && (
        <section aria-labelledby="h-mine">
          <h2 id="h-mine" className="mb-3 text-xl font-black tracking-[-0.03em]">내가 남긴 후기 <span className="text-base font-medium text-muted">{mine.length}</span></h2>
          {mine.length === 0 ? (
            <p className="rounded-[22px] border border-dashed border-line bg-surface px-4 py-8 text-center text-muted">아직 남긴 후기가 없어요. 가게에 다녀온 뒤 상세 화면에서 남겨 주세요.</p>
          ) : (
            <ul className="grid gap-2.5">
              {mine.map((r) => (
                <li key={r.id}>
                  <Link href={`/places/${r.placeId}`} className="tap grid gap-1 rounded-[14px] bg-surface2 px-3.5 py-3">
                    <span className="flex flex-wrap items-center gap-2 text-sm"><b>{placeName.get(r.placeId) ?? "삭제된 가게"}</b><Stars rating={r.rating} /><time className="tabular-nums text-muted">{r.visitedOn}</time></span>
                    <span className="[overflow-wrap:anywhere]">{r.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
