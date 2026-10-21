"use client";

import Link from "next/link";
import { useState } from "react";
import { AREAS, FAR_KM, formatDistance, nearestAreas, type NearbyArea } from "@mongmong/shared";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; nearby: NearbyArea[] }
  | { kind: "error"; message: string };

const ERROR_TEXT: Record<number, string> = {
  1: "위치 권한이 꺼져 있습니다. 브라우저 주소창 옆 설정에서 위치를 허용한 뒤 다시 눌러 주세요. 아래에서 동네를 직접 골라도 됩니다.",
  2: "현재 위치를 알 수 없습니다. 기기의 위치 서비스가 켜져 있는지 확인한 뒤 다시 시도해 주세요.",
  3: "위치를 확인하는 데 시간이 너무 오래 걸렸습니다. 잠시 뒤에 다시 시도해 주세요.",
};

/**
 * 현재 위치에서 가까운 동네를 보여 준다.
 * 위치는 이 기기 안에서 동네 중심과 거리만 계산하는 데 쓰고, 서버로 보내거나 저장하지 않는다.
 */
export function NearbyAreas({ counts }: { counts: Record<string, number> }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  function locate() {
    if (!window.isSecureContext || !("geolocation" in navigator)) {
      setState({ kind: "error", message: "이 브라우저에서는 위치를 확인할 수 없습니다. 아래에서 동네를 직접 골라 주세요." });
      return;
    }
    setState({ kind: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nearby = nearestAreas(pos.coords.latitude, pos.coords.longitude, AREAS, 3);
        setState(nearby.length ? { kind: "done", nearby } : { kind: "error", message: ERROR_TEXT[2]! });
      },
      (err) => setState({ kind: "error", message: ERROR_TEXT[err.code] ?? ERROR_TEXT[2]! }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  const first = state.kind === "done" ? state.nearby[0] : undefined;
  const far = first !== undefined && first.km > FAR_KM;

  return (
    <section aria-labelledby="h-nearby" className="mb-8 rounded-[22px] border border-line bg-surface p-4">
      <h2 id="h-nearby" className="text-lg font-black tracking-[-0.03em]">내 주변 동네</h2>
      <p className="mb-3 text-[15px] text-muted">현재 위치에서 가까운 동네를 찾아 드립니다. 위치는 이 기기 안에서만 쓰고 저장하지 않습니다.</p>
      <button
        type="button"
        onClick={locate}
        disabled={state.kind === "loading"}
        className="tap inline-flex min-h-[50px] items-center rounded-2xl bg-accent px-5 font-bold text-accent-fg disabled:opacity-70"
      >
        {state.kind === "loading" ? "위치 확인 중…" : state.kind === "done" ? "다시 찾기" : "📍 내 주변 찾기"}
      </button>

      <div aria-live="polite" className="mt-3">
        {state.kind === "error" && <p className="text-[15px]" role="alert">{state.message}</p>}
        {first && (
          <>
            <p className="mb-2 text-[15px]">
              {far
                ? `서울·수도권 주요 동네에서 멀리 계신 것 같습니다. 가장 가까운 곳은 ${first.area.name}(약 ${formatDistance(first.km)})입니다.`
                : `지금 계신 곳에서 가장 가까운 동네는 ${first.area.name}입니다.`}
            </p>
            <ul className="grid gap-2">
              {state.kind === "done" &&
                state.nearby.map(({ area, km }, i) => (
                  <li key={area.slug}>
                    <Link
                      href={`/list?area=${area.slug}`}
                      className={`tap flex min-h-[50px] items-center justify-between gap-3 rounded-2xl border px-4 ${i === 0 ? "border-accent bg-accent-soft" : "border-line bg-surface2"}`}
                    >
                      <span className="font-bold">{area.name}</span>
                      <span className="text-[15px] text-muted">약 {formatDistance(km)} · {counts[area.slug] ?? 0}곳</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
