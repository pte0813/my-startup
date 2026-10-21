"use client";

import { useActionState } from "react";
import { sendMagicLink } from "@/app/actions/auth";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Field, FormMessage, SubmitButton, inputClass } from "./FormBits";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(sendMagicLink, INITIAL_FORM_STATE);
  return (
    <form action={action} className="grid gap-4 rounded-[22px] border border-line bg-surface p-[18px]">
      <input type="hidden" name="next" value={next} />
      <Field label="이메일" htmlFor="email" hint="비밀번호 없이, 메일로 받은 링크를 눌러 로그인합니다.">
        <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" placeholder="name@example.com" defaultValue={String(state.values?.email ?? "")} className={inputClass} />
      </Field>
      <FormMessage error={state.error} message={state.message} />
      <SubmitButton pendingLabel="보내는 중…">로그인 링크 받기</SubmitButton>
    </form>
  );
}
