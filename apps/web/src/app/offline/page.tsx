import type { Metadata } from "next";
import { Mascot } from "@/components/Mascot";

export const metadata: Metadata = { title: "오프라인", robots: { index: false } };

/** 인터넷이 끊겼을 때 서비스 워커가 보여 주는 화면. 스크립트 없이도 동작해야 해서 링크만 쓴다. */
export default function OfflinePage() {
  return (
    <div className="grid justify-items-center gap-3 rounded-[22px] border border-line bg-surface px-5 py-12 text-center">
      <Mascot className="h-24 w-24" />
      <h1 className="text-2xl font-black tracking-[-0.04em]">인터넷에 연결되어 있지 않아요</h1>
      <p className="text-muted">
        연결을 확인한 뒤 다시 시도해 주세요.
        <br />
        가게 정보와 웨이팅 팁은 최신 내용을 보여 드리기 위해 인터넷이 있을 때만 불러옵니다.
      </p>
      {/* 끊긴 연결을 새로 시도해야 하므로 클라이언트 이동 대신 전체 새로고침 링크를 쓴다 */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="tap mt-2 inline-flex min-h-[50px] items-center rounded-2xl bg-accent px-6 font-bold text-accent-fg">다시 시도</a>
    </div>
  );
}
