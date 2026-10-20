import Link from "next/link";
import { Mascot } from "./Mascot";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-bg pb-3 pt-[calc(12px+env(safe-area-inset-top,0px))] shadow-[0_0_0_100vmax_var(--bg)] [clip-path:inset(0_-100vmax)]">
      <Link href="/" className="flex flex-1 items-center gap-3" aria-label="몽몽 홈">
        <Mascot />
        <span className="text-[26px] font-black leading-none tracking-[-0.04em] text-accent">몽몽</span>
      </Link>
      <Link href="/about" aria-label="안내와 출처 보기" className="tap grid h-11 w-11 place-items-center rounded-2xl bg-surface">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" />
        </svg>
      </Link>
      <ThemeToggle />
    </header>
  );
}
