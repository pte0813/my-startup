import { connection } from "next/server";
import type { Review } from "@mongmong/shared";
import { deleteReview } from "@/app/actions/reviews";
import { getSession, isEditor } from "@/lib/auth";
import { ActionButton } from "./ActionButton";
import { ReviewItem } from "./ReviewItem";

/** 후기 목록. 로그인한 에디터에게는 본인 후기(관리자는 전체)에 삭제 버튼을 더한다. */
export async function ReviewListLive({ reviews, placeId, authors }: { reviews: Review[]; placeId: number; authors: Record<string, string> }) {
  await connection(); // 로그인 확인은 요청 시점에 한다
  const session = await getSession();
  return (
    <ul className="grid gap-2.5">
      {reviews.map((r) => {
        const canDelete = isEditor(session) && (r.authorId === session.userId || session.role === "admin");
        return (
          <ReviewItem
            key={r.id}
            review={r}
            authorName={(r.authorId && authors[r.authorId]) || undefined}
            footer={canDelete ? <ActionButton action={deleteReview.bind(null, r.id, placeId)} label="삭제" confirmLabel="한 번 더 누르면 삭제됩니다" variant="link" /> : undefined}
          />
        );
      })}
    </ul>
  );
}

export function ReviewListStatic({ reviews, authors }: { reviews: Review[]; authors: Record<string, string> }) {
  return (
    <ul className="grid gap-2.5">
      {reviews.map((r) => <ReviewItem key={r.id} review={r} authorName={(r.authorId && authors[r.authorId]) || undefined} />)}
    </ul>
  );
}
