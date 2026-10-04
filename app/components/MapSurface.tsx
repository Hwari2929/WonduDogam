"use client";

import { memo } from "react";
import type { Cafe } from "../data/cafes";
import { MapCanvas, type SavedCafeMarker } from "./MapCanvas";

/**
 * 지도는 화면에서 가장 무거운 것이면서, 화면에서 가장 자주 아무 상관 없는 것입니다 —
 * 검색어 한 글자, 안내 문구 하나, 서랍 여닫기마다 위쪽이 다시 그려지는데 지도가
 * 거기 딸려 오면 그때마다 길과 핀을 통째로 다시 짓게 됩니다. 여기서 한 번 끊습니다.
 * (그러려면 넘겨주는 손잡이들이 렌더마다 새로 만들어지지 않아야 합니다 — page.tsx)
 */
export const MapSurface = memo(function MapSurface(props: {
  cafes: Cafe[];
  activeId: string | null;
  focus: { id: string; at: number } | null;
  savedMarkers: Record<string, SavedCafeMarker>;
  onSelect: (id: string) => void;
  onInteract: () => void;
}) {
  return <MapCanvas cafes={props.cafes} activeId={props.activeId} focus={props.focus} savedMarkers={props.savedMarkers} onSelect={props.onSelect} onInteract={props.onInteract} />;
});