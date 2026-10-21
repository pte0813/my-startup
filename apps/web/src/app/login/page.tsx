import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { LoginForm } from "@/components/LoginForm";
import { getSession } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "로그인" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <>
      <h1 className="mb-1 text-2xl font-black tracking-[-0.04em]">로그인</h1>
      <p className="mb-4 text-muted">찜한 가게를 모아 보고, 에디터는 후기를 남길 수 있어요.</p>
      <Suspense fallback={<p className="py-10 text-center text-muted">불러오는 중입니다…</p>}>
        <LoginBody searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function LoginBody({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const sp = await searchParams;
  const next = safeNextPath(first(sp.next));
  if (!isSupabaseConfigured()) {
    return (
      <div className="rounded-[22px] border border-dashed border-line bg-surface px-4 py-8 text-center text-muted">
        로그인 서비스가 아직 연결되지 않았습니다.
        <br />
        가게 둘러보기는 로그인 없이 쓸 수 있어요.
      </div>
    );
  }
  const session = await getSession();
  if (session) {
    return (
      <div className="rounded-[22px] border border-line bg-surface p-[18px]">
        <p className="mb-3">이미 로그인되어 있습니다. ({session.email})</p>
        <Link href={next} className="tap inline-flex min-h-11 items-center rounded-2xl bg-accent px-5 font-bold text-accent-fg">계속하기</Link>
      </div>
    );
  }
  return (
    <>
      {first(sp.error) === "link" && (
        <p role="alert" className="mb-3 rounded-2xl bg-accent-soft px-4 py-3 font-bold text-accent">
          로그인 링크가 만료되었거나 이미 사용되었습니다. 새 링크를 받아 주세요.
        </p>
      )}
      <LoginForm next={next} />
    </>
  );
}
