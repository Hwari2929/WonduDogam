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
 * 목업 지도가 담는 범위.
 *
 * 수도권을 담되 서울이 화면 왼쪽~가운데에 오도록 잡았습니다. 우측 도크(영수증·내
 * 도감)가 가로의 3분의 1을 덮으므로, 지리적으로 가운데 두면 정작 볼 곳이 카드
 * 뒤에 숨습니다. 바다도 인천 앞바다가 보일 만큼만 남깁니다.
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

/**
 * 경위도 → SVG/마커가 쓰는 0..100 공간.
 *
 * 이 축척에서는 등장방형(equirectangular)으로 충분합니다. 위도 37도에서
 * 경도 1도는 위도 1도보다 약 0.79배 짧지만, 그 보정은 `preserveAspectRatio="none"`
 * 으로 늘어나는 양에 이미 흡수됩니다 — 지형과 마커가 **같은 식**을 쓰는 것이
 * 정확한 도법보다 중요합니다.
 */
export function project(lng: number, lat: number) {
  return {
    x: ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * 100,
    y: ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * 100,
  };
}
