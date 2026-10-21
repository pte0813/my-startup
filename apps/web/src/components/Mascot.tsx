import { MASCOT_INNER, MASCOT_VIEWBOX } from "@/lib/mascot-svg";

/** 몽몽 캐릭터. 장식이므로 스크린리더에서는 숨긴다. 그림 원본은 `lib/mascot-svg.ts`. */
export function Mascot({ className = "h-[52px] w-[52px]" }: { className?: string }) {
  return (
    <svg
      viewBox={MASCOT_VIEWBOX}
      aria-hidden="true"
      className={className}
      style={{ filter: "drop-shadow(0 5px 10px rgba(224,100,77,.35))" }}
      dangerouslySetInnerHTML={{ __html: MASCOT_INNER }}
    />
  );
}
