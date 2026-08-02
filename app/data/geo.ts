/**
 * 좌표 하나로 통일합니다.
 *
 * 카페의 위치는 01_데이터와_파이프라인 §2.1 대로 **경위도가 원본**입니다
 * (`pos: [lng, lat]`, GeoJSON 순서 고정). 카카오맵이 붙으면 SDK가 그대로 받고,
 * 키가 없을 때 쓰는 SVG 지도는 아래 투영으로 백분율을 만들어 씁니다.
 *
 * 백분율을 원본으로 두면 지도를 붙이는 순간 전부 다시 찍어야 하므로,
 * 목업 단계에서도 경위도를 원본으로 둡니다.
 */

/**
 * 지도가 담는 범위.
 *
 * 서쪽은 강화도가 통째로 들어오는 자리까지, 동쪽은 경기도가 끝나는 자리까지입니다.
 * 동쪽 끝을 경기 경계에 맞추면 데이터 없는 땅이 안 늘면서 서울이 가로 절반 자리에
 * 옵니다 — 도크(영수증·내 도감)에 안 가리는 자리입니다.
 */
export const BOUNDS = {
  west: 126.12,
  east: 127.85,
  north: 37.85,
  south: 37.0,
} as const;

export const CENTER: [number, number] = [
  (BOUNDS.west + BOUNDS.east) / 2,
  (BOUNDS.north + BOUNDS.south) / 2,
];

/** 위도 37.4 언저리의 1도. 경도는 위도만큼 길지 않아 cos(위도) 만큼 짧습니다. */
const KM_PER_LNG = 88.41;
const KM_PER_LAT = 110.94;

/** 이 창이 담는 실제 크기(km). */
export const SPAN_KM = {
  x: (BOUNDS.east - BOUNDS.west) * KM_PER_LNG,
  y: (BOUNDS.north - BOUNDS.south) * KM_PER_LAT,
};

/**
 * 0..100 공간에서 세로 한 칸이 가로 한 칸의 몇 배 길이인가.
 *
 * 창은 가로 153km · 세로 94km 인데 0..100 정사각형에 밀어 넣으므로, 이 공간 자체가
 * 이미 세로로 눌려 있습니다. 화면에 그릴 때 이 값만큼 되돌리지 않으면 지도가
 * 화면 비율을 그대로 따라 찌그러집니다 — 세로로 긴 폰에서는 2.8배까지 눌립니다.
 */
export const UNIT_ASPECT = SPAN_KM.y / SPAN_KM.x;

/**
 * 경위도 → SVG/마커가 쓰는 0..100 공간.
 *
 * 이 축척에서는 등장방형(equirectangular)으로 충분합니다. 세로로 눌리는 건
 * 위 UNIT_ASPECT 로 그릴 때 되돌립니다 — 지형과 마커가 **같은 식**을 쓰는 것이
 * 정확한 도법보다 중요합니다.
 */
export function project(lng: number, lat: number) {
  return {
    x: ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * 100,
    y: ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * 100,
  };
}
