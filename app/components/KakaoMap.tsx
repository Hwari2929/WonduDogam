"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Cafe } from "../data/cafes";
import { BOUNDS } from "../data/geo";
import {
  loadKakaoMaps,
  type KakaoMapInstance,
  type KakaoMaps,
  type KakaoOverlay,
} from "../kakao-sdk";
import { BeanStamp } from "./BeanArt";

/**
 * 실제 카카오맵.
 *
 * 마커는 SDK 기본 핀 대신 CustomOverlay 로 우리 조형(도장 / 잉크 점)을 그대로
 * 얹습니다. 그래야 타일만 바뀌고 도감의 세계는 남습니다.
 *
 * 타일 자체에는 아무 필터도 걸지 않습니다 (04_착수_검증). 종이 느낌은 우리 층에
 * 저채도 막을 덮어 만들고, 그 막은 저작권·로고 띠를 건드리지 않습니다.
 */
export function KakaoMap({
  cafes,
  activeId,
  mapKey,
  onSelect,
  onInteract,
  onFail,
}: {
  cafes: Cafe[];
  activeId: string | null;
  mapKey: string;
  onSelect: (id: string) => void;
  onInteract: () => void;
  onFail: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMapInstance | null>(null);
  const overlaysRef = useRef<KakaoOverlay[]>([]);
  const [nodes, setNodes] = useState<{ id: string; element: HTMLElement }[]>([]);

  // 콜백은 ref 로 들고 있어야 지도를 다시 만들지 않고도 최신 핸들러를 씁니다.
  const handlers = useRef({ onSelect, onInteract, onFail });
  useEffect(() => {
    handlers.current = { onSelect, onInteract, onFail };
  });

  useEffect(() => {
    let cancelled = false;
    let maps: KakaoMaps | null = null;

    loadKakaoMaps(mapKey)
      .then((loaded) => {
        if (cancelled || !containerRef.current) return;
        maps = loaded;

        const map = new loaded.Map(containerRef.current, {
          center: new loaded.LatLng(
            (BOUNDS.north + BOUNDS.south) / 2,
            (BOUNDS.west + BOUNDS.east) / 2,
          ),
          level: 10,
        });
        mapRef.current = map;

        // 수도권 전체가 처음 화면에 담기게 합니다 (03 §2 — 첫 진입은 수도권 전체).
        const bounds = new loaded.LatLngBounds();
        bounds.extend(new loaded.LatLng(BOUNDS.south, BOUNDS.west));
        bounds.extend(new loaded.LatLng(BOUNDS.north, BOUNDS.east));
        map.setBounds(bounds);

        for (const type of ["dragstart", "click", "zoom_start"]) {
          loaded.event.addListener(map, type, () => handlers.current.onInteract());
        }

        // 마커 하나당 빈 칸을 만들고, 거기에 React 로 우리 조형을 그립니다.
        const created = cafes.map((cafe) => {
          const element = document.createElement("div");
          const overlay = new loaded.CustomOverlay({
            position: new loaded.LatLng(cafe.pos[1], cafe.pos[0]),
            content: element,
            yAnchor: cafe.partner ? 0.5 : 0.5,
            zIndex: cafe.partner ? 4 : 2,
            clickable: true,
          });
          overlay.setMap(map);
          overlaysRef.current.push(overlay);
          return { id: cafe.id, element };
        });
        setNodes(created);
      })
      .catch((error: Error) => {
        if (!cancelled) handlers.current.onFail(error.message);
      });

    return () => {
      cancelled = true;
      for (const overlay of overlaysRef.current) overlay.setMap(null);
      overlaysRef.current = [];
      mapRef.current = null;
      void maps;
    };
  }, [mapKey, cafes]);

  return (
    <section className="map map--live" aria-label="수도권 카페 지도">
      <div className="map__tiles" ref={containerRef} />
      {/* 저채도 막. 저작권·로고 띠는 덮지 않습니다 (02 §2.3). */}
      <div className="map__wash" aria-hidden="true" />
      {nodes.map(({ id, element }) => {
        const cafe = cafes.find((entry) => entry.id === id);
        if (!cafe) return null;
        return createPortal(
          <button
            className={[
              "map-marker",
              "map-marker--pinned",
              cafe.partner ? "map-marker--partner" : "map-marker--plain",
              activeId === cafe.id ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            type="button"
            onClick={() => handlers.current.onSelect(cafe.id)}
            aria-label={`${cafe.name}, ${cafe.area}${cafe.partner ? ", 협력업체" : ""}`}
            aria-pressed={activeId === cafe.id}
          >
            {cafe.partner ? <BeanStamp size={34} /> : null}
            {cafe.partner ? <span className="map-marker__name">{cafe.name}</span> : null}
          </button>,
          element,
          id,
        );
      })}
    </section>
  );
}
