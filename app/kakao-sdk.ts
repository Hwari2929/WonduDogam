"use client";

/**
 * 카카오맵 JS SDK 로더.
 *
 * 04_착수_검증 명세수정 #3 — "카카오 API는 사용 승낙 전까지 브라우저에서 사용자가
 * 요청한 순간의 검색/지도 표시에만 제한합니다." 타일을 띄우고 우리 마커를 얹는 건
 * 저장이 아니라 표시라 그 범위 안입니다. 장소 데이터를 받아 우리 저장소에 넣는
 * 일은 여전히 하지 않습니다.
 */

/** 자바스크립트 앱키는 도메인으로 제한되는 공개 키입니다. 서버가 <meta> 로 심어 줍니다. */
export function readMapKey(): string | null {
  if (typeof document === "undefined") return null;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="kakao-map-key"]');
  const key = meta?.content?.trim();
  return key ? key : null;
}

let loading: Promise<KakaoMaps> | null = null;

/** SDK 가 얹어 주는 것 중 실제로 쓰는 부분만 적어 둡니다. */
export type KakaoLatLng = { getLat(): number; getLng(): number };
export type KakaoMapInstance = {
  setCenter(latlng: KakaoLatLng): void;
  setLevel(level: number, options?: { animate?: boolean }): void;
  getLevel(): number;
  setBounds(bounds: KakaoBounds, ...padding: number[]): void;
  relayout(): void;
};
export type KakaoBounds = { extend(latlng: KakaoLatLng): void };
export type KakaoOverlay = { setMap(map: KakaoMapInstance | null): void };

export type KakaoMaps = {
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoBounds;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMapInstance;
  CustomOverlay: new (options: {
    position: KakaoLatLng;
    content: HTMLElement;
    yAnchor?: number;
    xAnchor?: number;
    zIndex?: number;
    clickable?: boolean;
  }) => KakaoOverlay;
  event: {
    addListener(target: unknown, type: string, handler: () => void): void;
  };
  load(callback: () => void): void;
};

declare global {
  interface Window {
    kakao?: { maps?: KakaoMaps };
  }
}

/**
 * SDK 를 한 번만 받아옵니다. 키가 없거나 스크립트가 막히면 거부하고,
 * 부르는 쪽은 종이 지도로 되돌아갑니다.
 */
export function loadKakaoMaps(key: string): Promise<KakaoMaps> {
  if (loading) return loading;

  loading = new Promise<KakaoMaps>((resolve, reject) => {
    if (window.kakao?.maps) {
      resolve(window.kakao.maps);
      return;
    }

    const script = document.createElement("script");
    // autoload=false 로 받아 두고 load() 로 직접 켭니다. 그래야 준비 시점을 압니다.
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
    script.async = true;
    script.onerror = () =>
      reject(new Error("카카오맵 SDK를 못 불러왔어. 앱키와 사이트 도메인 등록을 확인해줘."));
    script.onload = () => {
      const maps = window.kakao?.maps;
      if (!maps) {
        reject(new Error("카카오맵 SDK가 예상과 다르게 로드됐어."));
        return;
      }
      maps.load(() => resolve(maps));
    };
    document.head.appendChild(script);
  });

  loading.catch(() => {
    loading = null; // 다음 시도를 막지 않습니다
  });
  return loading;
}
