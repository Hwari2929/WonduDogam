"use client";

import { useState, useSyncExternalStore } from "react";
import type { Cafe } from "../data/cafes";
import { readMapKey } from "../kakao-sdk";
import { KakaoMap } from "./KakaoMap";
import { MapCanvas } from "./MapCanvas";

/** 앱키는 문서에 한 번 심긴 뒤 바뀌지 않습니다. 구독할 것이 없습니다. */
const neverChanges = () => () => {};

/**
 * 지도 자리를 무엇이 채울지 정합니다.
 *
 * 앱키가 심어져 있으면 실제 카카오맵, 아니면 종이 지도. SDK가 실패해도(도메인 미등록,
 * 네트워크 차단) 조용히 종이 지도로 되돌아갑니다 — 지도가 없다고 도감 전체가
 * 멈춰서는 안 됩니다.
 */
export function MapSurface(props: {
  cafes: Cafe[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onInteract: () => void;
  onNotice: (message: string) => void;
}) {
  // 키는 서버가 <meta> 로 심어 줍니다. 서버 스냅샷은 null 이라 하이드레이션이
  // 어긋나지 않고, 클라이언트에서는 마운트 직후 실제 키를 봅니다.
  const mapKey = useSyncExternalStore(neverChanges, readMapKey, () => null);
  const [failed, setFailed] = useState(false);

  if (!mapKey || failed) {
    return (
      <MapCanvas
        cafes={props.cafes}
        activeId={props.activeId}
        onSelect={props.onSelect}
        onInteract={props.onInteract}
      />
    );
  }

  return (
    <KakaoMap
      cafes={props.cafes}
      activeId={props.activeId}
      mapKey={mapKey}
      onSelect={props.onSelect}
      onInteract={props.onInteract}
      onFail={(message) => {
        setFailed(true);
        props.onNotice(message);
      }}
    />
  );
}
