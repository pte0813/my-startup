/** 몽몽 캐릭터: 잎을 얹은 복숭아색 구름. 장식이므로 스크린리더에서는 숨긴다. */
export function Mascot({ className = "h-[52px] w-[52px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className} style={{ filter: "drop-shadow(0 5px 10px rgba(224,100,77,.35))" }}>
      <defs>
        <linearGradient id="mongmong-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc2b3" />
          <stop offset="1" stopColor="#f0735d" />
        </linearGradient>
      </defs>
      <path d="M33 15c-1-6 2-10 8-11 1 6-2 10-8 11z" fill="#62c99c" />
      <path d="M33 16v5" stroke="#3f9f77" strokeWidth="2" strokeLinecap="round" />
      <g fill="url(#mongmong-body)">
        <circle cx="21" cy="37" r="13" />
        <circle cx="34" cy="29" r="15" />
        <circle cx="46" cy="37" r="13" />
        <rect x="14" y="36" width="40" height="19" rx="9.5" />
      </g>
      <ellipse cx="26.5" cy="39" rx="2.7" ry="3.5" fill="#3b1d17" />
      <ellipse cx="41.5" cy="39" rx="2.7" ry="3.5" fill="#3b1d17" />
      <circle cx="25.7" cy="37.7" r="1" fill="#fff" />
      <circle cx="40.7" cy="37.7" r="1" fill="#fff" />
      <ellipse cx="20.5" cy="45" rx="3.6" ry="2.2" fill="#ff8a80" opacity=".6" />
      <ellipse cx="47.5" cy="45" rx="3.6" ry="2.2" fill="#ff8a80" opacity=".6" />
      <path d="M30.2 43.6q1.9 2.6 3.8 0q1.9 2.6 3.8 0" fill="none" stroke="#3b1d17" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
