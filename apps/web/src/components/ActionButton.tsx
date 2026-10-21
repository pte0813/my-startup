"use client";

import { useState, useTransition } from "react";
import type { FormState } from "@/lib/form-state";

/**
 * 서버 액션을 한 번 눌러 실행하는 버튼. `confirm`이 있으면 두 번 눌러야 실행된다(되돌릴 수 없는 작업용).
 * 오류는 버튼 아래에 알린다.
 */
export function ActionButton({
  action,
  label,
  confirmLabel,
  variant = "ghost",
}: {
  action: () => Promise<FormState>;
  label: string;
  confirmLabel?: string;
  variant?: "primary" | "ghost" | "link";
}) {
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  function run() {
    if (confirmLabel && !armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 4000);
      return;
    }
    setArmed(false);
    startTransition(async () => {
      const r = await action();
      setMessage(r.error ? { text: r.error, error: true } : r.message ? { text: r.message, error: false } : null);
    });
  }

  const styles = {
    primary: "min-h-[50px] rounded-2xl bg-accent px-5 font-bold text-accent-fg",
    ghost: "min-h-[44px] rounded-2xl bg-surface2 px-4 text-[15px] font-bold",
    link: "min-h-9 text-sm text-muted underline",
  }[variant];

  return (
    <span className="grid justify-items-start gap-1">
      <button type="button" onClick={run} disabled={pending} className={`tap ${styles} disabled:opacity-60`}>
        {pending ? "처리 중…" : armed && confirmLabel ? confirmLabel : label}
      </button>
      {message && (
        <span role={message.error ? "alert" : "status"} className={`text-sm ${message.error ? "font-bold text-accent" : "text-muted"}`}>
          {message.text}
        </span>
      )}
    </span>
  );
}
