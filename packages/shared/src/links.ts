export interface PlaceLink {
  label: string;
  href: string;
  primary?: boolean;
}

/** 외부 서비스의 검색 링크. 리뷰·예약은 각 서비스에서 확인하도록 연결만 한다(내용을 가져오지 않는다). */
export function placeLinks(areaName: string, placeName: string): PlaceLink[] {
  const q = encodeURIComponent(`${areaName} ${placeName}`);
  const name = encodeURIComponent(placeName);
  const area = encodeURIComponent(areaName);
  return [
    { label: "네이버 지도", href: `https://map.naver.com/p/search/${q}`, primary: true },
    { label: "카카오맵", href: `https://map.kakao.com/?q=${q}` },
    { label: "구글 지도", href: `https://www.google.com/maps/search/?api=1&query=${q}` },
    { label: "다이닝코드", href: `https://www.diningcode.com/list.dc?query=${q}` },
    { label: "캐치테이블", href: `https://www.google.com/search?q=${name}+${area}+${encodeURIComponent("캐치테이블")}` },
  ];
}
