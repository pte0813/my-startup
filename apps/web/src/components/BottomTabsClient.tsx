"use client";

import { usePathname } from "next/navigation";
import { TabBarView } from "./BottomTabs";

/** 현재 주소를 읽어 선택된 탭을 표시한다. 주소는 요청 시점에 정해지므로 `<Suspense>` 안에서 쓴다. */
export function BottomTabs() {
  return <TabBarView pathname={usePathname()} />;
}
