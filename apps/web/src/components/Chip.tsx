import Link from "next/link";

/** 링크로 동작하는 필터 칩. 주소가 바뀌므로 공유·뒤로 가기가 자연스럽다. */
export function Chip({ href, selected, count, children }: { href: string; selected: boolean; count?: number; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={`tap inline-flex min-h-[42px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-[15px] ${
        selected ? "border-accent bg-accent font-bold text-accent-fg" : "border-line bg-surface"
      }`}
    >
      {children}
      {count !== undefined && <small className={`text-[13px] ${selected ? "opacity-90" : "text-muted"}`}>{count}</small>}
    </Link>
  );
}
