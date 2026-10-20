import type { Review } from "@mongmong/shared";
import { Stars } from "./Stars";

export function ReviewItem({ review }: { review: Review }) {
  return (
    <li className="grid gap-1 rounded-[14px] bg-surface2 px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Stars rating={review.rating} />
        <time className="tabular-nums text-muted">{review.visitedOn} 방문</time>
        {review.waitMinutes !== null && <span className="rounded-full bg-accent-soft px-2 text-xs font-bold text-accent">실제 대기 {review.waitMinutes}분</span>}
        {review.sponsored && <span className="rounded-full bg-accent px-2 text-xs font-bold text-accent-fg">협찬·초대</span>}
      </div>
      <p className="[overflow-wrap:anywhere]">{review.body}</p>
      {review.tip && (
        <p className="text-[15px] text-muted [overflow-wrap:anywhere]">
          <b className="mr-1 text-accent">예약·웨이팅 팁</b>
          {review.tip}
        </p>
      )}
    </li>
  );
}
