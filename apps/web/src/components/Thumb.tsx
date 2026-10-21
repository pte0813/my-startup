import { photoUrl } from "@/lib/env";

function hue(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/** `card`는 좁은 화면에서 72px, 넓으면 88px. `detail`은 72px 고정. */
const SIZES = { card: "size-[72px] min-[400px]:size-[88px]", detail: "size-[72px]" } as const;

/** 가게 사진. 사진이 없으면 음식 종류 이름이 적힌 색 타일을 보여 준다. */
export function Thumb({ name, category, photoPath, size = "card" }: { name: string; category: string; photoPath: string | null; size?: keyof typeof SIZES }) {
  const src = photoUrl(photoPath);
  if (src) {
    // 저장소 주소가 환경마다 달라서 next/image 대신 일반 img 를 쓴다.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={`${name} 사진`} loading="lazy" className={`block shrink-0 rounded-[18px] bg-surface2 object-cover ${SIZES[size]}`} />;
  }
  return (
    <span
      aria-hidden="true"
      style={{ ["--h" as string]: hue(category) }}
      className={`thumb-tile grid shrink-0 ${SIZES[size]} place-items-center rounded-[18px] p-1.5 text-center text-[15px] font-black leading-tight tracking-[-0.03em]`}
    >
      {category}
    </span>
  );
}
