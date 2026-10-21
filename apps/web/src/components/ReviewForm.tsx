"use client";

import { useActionState, useState } from "react";
import { createReview } from "@/app/actions/reviews";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Field, FormMessage, SubmitButton, inputClass } from "./FormBits";

export function ReviewForm({ placeId, placeName, today }: { placeId: number; placeName: string; today: string }) {
  const [state, action] = useActionState(createReview.bind(null, placeId), INITIAL_FORM_STATE);
  const v = (k: string, fallback = "") => String(state.values?.[k] ?? fallback);
  const [rating, setRating] = useState(Number(state.values?.rating ?? 0));

  return (
    <form action={action} className="grid gap-4 rounded-[22px] border border-line bg-surface p-[18px]">
      <h2 className="text-lg font-black tracking-[-0.03em]">{placeName}</h2>

      <fieldset className="grid gap-1">
        <legend className="mb-1 text-sm font-bold text-muted">별점</legend>
        <div className="flex gap-0.5" role="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={`tap grid h-12 w-12 cursor-pointer place-items-center text-4xl leading-none ${rating >= n ? "text-star" : "text-star-off"} has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-accent`}>
              <input type="radio" name="rating" value={n} required checked={rating === n} onChange={() => setRating(n)} className="sr-only" />
              <span aria-hidden="true">★</span>
              <span className="sr-only">{n}점</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 min-[480px]:grid-cols-2">
        <Field label="방문일" htmlFor="visitedOn">
          <input id="visitedOn" name="visitedOn" type="date" required max={today} defaultValue={v("visitedOn", today)} className={inputClass} />
        </Field>
        <Field label="실제 대기 시간(분)" htmlFor="waitMinutes" hint="없으면 비워 두세요.">
          <input id="waitMinutes" name="waitMinutes" type="number" min={0} max={600} inputMode="numeric" defaultValue={v("waitMinutes")} className={inputClass} />
        </Field>
      </div>
      <Field label="한 줄 후기" htmlFor="body">
        <input id="body" name="body" type="text" required minLength={2} maxLength={200} placeholder="직접 먹어 보고 느낀 점" defaultValue={v("body")} className={inputClass} />
      </Field>
      <Field label="예약·웨이팅 팁 (선택)" htmlFor="tip">
        <input id="tip" name="tip" type="text" maxLength={200} placeholder="예: 평일 17시 입장, 캐치테이블 2주 전 오픈" defaultValue={v("tip")} className={inputClass} />
      </Field>
      <label className="flex items-start gap-2.5">
        <input type="checkbox" name="sponsored" defaultChecked={state.values?.sponsored === "on"} className="mt-1 h-5 w-5 accent-[var(--accent)]" />
        <span>협찬·초대로 방문했습니다 <span className="text-sm text-muted">(표기해야 신뢰가 유지됩니다)</span></span>
      </label>
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton>후기 저장</SubmitButton>
    </form>
  );
}
