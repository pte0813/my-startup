"use client";

import { useActionState } from "react";
import { AREAS, SITUATIONS } from "@mongmong/shared";
import { savePlace } from "@/app/actions/places";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Field, FormMessage, SubmitButton, inputClass } from "./FormBits";

export interface PlaceFormValues {
  areaSlug: string;
  name: string;
  category: string;
  situations: string[];
  summary: string;
  waitTip: string;
  reservationTip: string;
  address: string;
}

export const EMPTY_PLACE: PlaceFormValues = { areaSlug: AREAS[0].slug, name: "", category: "", situations: [], summary: "", waitTip: "", reservationTip: "", address: "" };

export function PlaceForm({ placeId, initial }: { placeId: number | null; initial: PlaceFormValues }) {
  const [state, action] = useActionState(savePlace.bind(null, placeId), INITIAL_FORM_STATE);
  const s = (k: keyof PlaceFormValues) => String(state.values?.[k] ?? initial[k]);
  const chosen = state.values ? ([] as string[]).concat(state.values.situations ?? []) : initial.situations;

  return (
    <form action={action} className="grid gap-4 rounded-[22px] border border-line bg-surface p-[18px]">
      <div className="grid gap-4 min-[480px]:grid-cols-2">
        <Field label="동네" htmlFor="areaSlug">
          <select id="areaSlug" name="areaSlug" defaultValue={s("areaSlug")} className={inputClass}>
            {AREAS.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="종류" htmlFor="category">
          <input id="category" name="category" required maxLength={20} placeholder="예: 파스타" defaultValue={s("category")} className={inputClass} />
        </Field>
      </div>
      <Field label="가게 이름" htmlFor="name">
        <input id="name" name="name" required maxLength={60} defaultValue={s("name")} className={inputClass} />
      </Field>
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-sm font-bold text-muted">어울리는 상황 (하나 이상)</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {SITUATIONS.map((x) => (
            <label key={x} className="flex min-h-11 items-center gap-2">
              <input type="checkbox" name="situations" value={x} defaultChecked={chosen.includes(x)} className="h-5 w-5 accent-[var(--accent)]" />
              {x}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="한 줄 소개" htmlFor="summary">
        <input id="summary" name="summary" maxLength={120} defaultValue={s("summary")} className={inputClass} />
      </Field>
      <Field label="웨이팅 팁" htmlFor="waitTip" hint="비워 두면 '확인 필요'로 보입니다.">
        <textarea id="waitTip" name="waitTip" maxLength={300} rows={3} defaultValue={s("waitTip")} className={`${inputClass} py-2`} />
      </Field>
      <Field label="예약 요령" htmlFor="reservationTip">
        <textarea id="reservationTip" name="reservationTip" maxLength={300} rows={3} defaultValue={s("reservationTip")} className={`${inputClass} py-2`} />
      </Field>
      <Field label="주소" htmlFor="address">
        <input id="address" name="address" maxLength={120} defaultValue={s("address")} className={inputClass} />
      </Field>
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton>{placeId === null ? "가게 추가" : "저장"}</SubmitButton>
    </form>
  );
}
