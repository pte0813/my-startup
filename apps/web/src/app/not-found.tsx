import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-[22px] border border-dashed border-line bg-surface px-4 py-10 text-center">
      <p className="mb-1 text-xl font-black">페이지를 찾을 수 없습니다</p>
      <p className="mb-4 text-muted">주소가 바뀌었거나 없어진 가게일 수 있어요.</p>
      <Link href="/list" className="tap inline-flex min-h-11 items-center rounded-2xl bg-accent px-5 font-bold text-accent-fg">리스트로 가기</Link>
    </div>
  );
}
