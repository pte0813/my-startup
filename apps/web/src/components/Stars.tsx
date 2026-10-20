/** 별점 표시. 소수 평점은 가장 가까운 정수 별로 보여 주고, 정확한 값은 스크린리더용 문구로 알린다. */
export function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span role="img" aria-label={`별점 ${rating.toFixed(1)}점`} className="whitespace-nowrap tracking-[1px] text-star">
      {"★".repeat(filled)}
      <span className="text-star-off">{"★".repeat(5 - filled)}</span>
    </span>
  );
}
