"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { removePlacePhoto, setPlacePhoto } from "@/app/actions/places";
import { fitSize, photoStoragePath } from "@/lib/photo";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { ActionButton } from "./ActionButton";
import { Thumb } from "./Thumb";

async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => fail(new Error("image"));
      i.src = url;
    });
    const { width, height } = fitSize(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("blob"))), "image/jpeg", 0.82));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 가게 사진 등록: 브라우저에서 줄여서 저장소에 올리고, 서버 액션으로 가게에 연결한다. */
export function PhotoUploader({ placeId, name, category, photoPath }: { placeId: number; name: string; category: string; photoPath: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      if (!file.type.startsWith("image/")) throw new Error("사진 파일만 올릴 수 있습니다.");
      const blob = await shrink(file);
      const path = photoStoragePath(placeId, crypto.randomUUID());
      const { error: upErr } = await createBrowserSupabase().storage.from("place-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw new Error("사진을 올리지 못했습니다. 에디터로 로그인했는지 확인해 주세요.");
      const r = await setPlacePhoto(placeId, path);
      if (r.error) throw new Error(r.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진을 올리지 못했습니다.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section className="grid gap-3 rounded-[22px] border border-line bg-surface p-[18px]" aria-labelledby="h-photo">
      <h2 id="h-photo" className="text-lg font-black tracking-[-0.03em]">대표 사진</h2>
      <div className="flex items-center gap-4">
        <Thumb name={name} category={category} photoPath={photoPath} size="detail" />
        <div className="grid gap-2">
          <input ref={input} type="file" accept="image/*" hidden onChange={(e) => onPick(e.target.files?.[0])} />
          <button type="button" disabled={busy} onClick={() => input.current?.click()} className="tap min-h-11 rounded-2xl bg-surface2 px-4 text-[15px] font-bold disabled:opacity-60">
            {busy ? "올리는 중…" : photoPath ? "사진 바꾸기" : "사진 등록"}
          </button>
          {photoPath && <ActionButton action={() => removePlacePhoto(placeId)} label="사진 삭제" confirmLabel="한 번 더 누르면 삭제됩니다" variant="link" />}
        </div>
      </div>
      <p className="text-[13px] text-muted">직접 찍었거나 사용 허락을 받은 사진만 올려 주세요. 올리면 긴 변 900px 이하로 줄여서 저장합니다.</p>
      {error && <p role="alert" className="font-bold text-accent">{error}</p>}
    </section>
  );
}
