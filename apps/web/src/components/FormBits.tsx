"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingLabel = "저장 중…" }: { children: React.ReactNode; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="tap min-h-[50px] rounded-2xl bg-accent px-6 font-bold text-accent-fg disabled:opacity-60">
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormMessage({ error, message }: { error?: string; message?: string }) {
  if (error) return <p role="alert" className="font-bold text-accent">{error}</p>;
  if (message) return <p role="status" className="text-fg">{message}</p>;
  return null;
}

export const inputClass = "min-h-12 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-base text-fg";

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1">
      <label htmlFor={htmlFor} className="text-sm font-bold text-muted">{label}</label>
      {children}
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}
