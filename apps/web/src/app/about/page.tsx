import type { Metadata } from "next";
import { SOURCES } from "@/lib/sources";

export const metadata: Metadata = { title: "안내와 출처" };

export default function AboutPage() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-black tracking-[-0.04em]">안내와 출처</h1>
      <div className="grid gap-3 text-[15px] leading-relaxed text-muted">
        <p>가게 이름·요약·웨이팅 팁은 2026년 10월 웹 검색 결과를 정리한 것입니다. 별점, 후기, 검증일은 몽몽 에디터가 직접 다녀온 뒤 남긴 기록이고, 후기가 없는 가게는 아직 방문하지 않은 곳입니다.</p>
        <p>영업 여부와 웨이팅은 달라졌을 수 있으니 방문 전에 가게 공식 채널이나 예약 앱에서 확인하세요. 상황 분류(데이트·혼밥·팀 회식)는 메뉴 성격을 보고 붙인 추정입니다.</p>
        <p>협찬·초대로 다녀온 후기는 반드시 “협찬”으로 표기합니다. 마지막 검증 후 90일이 지나면 “검증 N일 전” 경고를 붙입니다.</p>
        <p>외부 서비스(네이버·카카오·구글·다이닝코드·캐치테이블)의 후기는 가져오지 않고, 각 서비스의 검색 링크로 연결만 합니다.</p>
      </div>
      <h2 className="mb-2 mt-7 text-lg font-black tracking-[-0.03em]">참고한 자료</h2>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
        {SOURCES.map((s) => (
          <li key={s.href}>
            <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">{s.label}</a>
          </li>
        ))}
      </ul>
    </>
  );
}
