"use client";

import { useRouter } from "next/navigation";

/** 이전 화면으로 돌아간다. 주소를 직접 열어 이전 기록이 없으면 `fallback`으로 간다. */
export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallback))}
      className="tap flex min-h-11 items-center gap-1 pr-2 text-[17px] font-bold text-accent"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5l-7 7 7 7" />
      </svg>
      뒤로
    </button>
  );
}
