/** 저장소에 올릴 사진 경로. 가게 번호 폴더 아래 무작위 이름이라 다른 가게와 겹치지 않는다. */
export function photoStoragePath(placeId: number, uuid: string): string {
  return `${placeId}/${uuid}.jpg`;
}

/** 긴 변이 `max`px 를 넘지 않게 줄인 크기. 작은 사진은 키우지 않는다. */
export function fitSize(width: number, height: number, max = 900): { width: number; height: number } {
  const k = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}
