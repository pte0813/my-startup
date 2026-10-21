"use client";

import { useEffect, useRef } from "react";

/** 가로로 스크롤되는 칩 줄 안에서, 선택된 칩(aria-current)이 보이도록 가운데로 옮긴다. */
export function ScrollToCurrent({ children, className, label }: { children: React.ReactNode; className: string; label: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = ref.current;
    const current = nav?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!nav || !current) return;
    nav.scrollTo({ left: current.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2, behavior: "auto" });
  });
  return (
    <nav ref={ref} aria-label={label} className={className}>
      {children}
    </nav>
  );
}
