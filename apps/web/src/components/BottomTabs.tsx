"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const icon = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

const TABS = [
  { href: "/", label: "홈", icon: icon(<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />) },
  { href: "/search", label: "검색", icon: icon(<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></>) },
  { href: "/list", label: "리스트", icon: icon(<><rect x="3" y="4" width="5" height="5" rx="1" /><rect x="3" y="14" width="5" height="5" rx="1" /><path d="M12 6.5h9M12 16.5h9" /></>) },
];

export function BottomTabs() {
  const pathname = usePathname();
  // 가게 상세에서는 집중해서 보도록 탭을 숨긴다.
  if (pathname.startsWith("/places/")) return null;
  return (
    <nav aria-label="주요 메뉴" className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface px-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))] pt-2">
      <ul className="mx-auto grid max-w-[640px] gap-1" style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}>
        {TABS.map((t) => {
          const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`tap grid min-h-[58px] place-items-center content-center gap-0.5 rounded-2xl text-[13px] font-bold ${active ? "bg-accent-soft text-accent" : "text-muted"}`}
              >
                {t.icon}
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
