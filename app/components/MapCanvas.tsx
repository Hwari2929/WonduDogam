"use client";

import { Coffee, Minus, Plus, RotateCcw } from "lucide-react";
import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { Cafe } from "../data/cafes";
import { project } from "../data/geo";
import { districts, minorRoads, river, sea, tributaries, trunkRoads } from "../data/terrain";
import type { CodexIconId } from "../marks";
import { CodexIcon } from "./CodexIcon";

const PLACES: { label: string; lng: number; lat: number; sea?: boolean }[] = [
  { label: "고양", lng: 126.832, lat: 37.658 }, { label: "서울", lng: 126.978, lat: 37.566 },
  { label: "인천", lng: 126.705, lat: 37.456 }, { label: "성남", lng: 127.127, lat: 37.42 },
  { label: "수원", lng: 127.029, lat: 37.263 }, { label: "서해", lng: 126.5, lat: 37.34, sea: true },
];
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
/**
 * 이 배율부터 지도가 "구석을 들여다보는" 상태가 됩니다. 여기서부터 담기지 않은
 * 카페까지 모두 찍고, 이름표도 폅니다. 그 아래로는 내 것만 남습니다.
 */
const DETAIL_ZOOM = 1.6;
type View = { zoom: number; x: number; y: number };

const INITIAL_VIEW: View = { zoom: 1, x: 0, y: 0 };
type Drag = { pointerId: number; startX: number; startY: number; view: View };

export type SavedCafeMarker = { color: string; icon: CodexIconId; count: number; collectionName: string };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampView(view: View, width: number, height: number): View {
  return {
    zoom: view.zoom,
    x: clamp(view.x, width * (1 - view.zoom), 0),
    y: clamp(view.y, height * (1 - view.zoom), 0),
  };
}

export function MapCanvas({ cafes, activeId, savedMarkers, onSelect, onInteract }: {
  cafes: Cafe[];
  activeId: string | null;
  savedMarkers: Record<string, SavedCafeMarker>;
  onSelect: (id: string) => void;
  onInteract: () => void;
}) {
  const mapRef = useRef<HTMLElement>(null);
  const dragRef = useRef<Drag | null>(null);
  // ref 와 state 가 같은 값에서 출발해야 하지만, 초깃값을 ref 에서 읽으면
  // 렌더 중 ref 접근이 됩니다. 상수 하나를 양쪽이 나눠 씁니다.
  const viewRef = useRef<View>(INITIAL_VIEW);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const [dragging, setDragging] = useState(false);

  function commitView(next: View) {
    viewRef.current = next;
    setView(next);
  }

  function zoomAt(nextZoom: number, clientX?: number, clientY?: number) {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const current = viewRef.current;
    const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(zoom - current.zoom) < 0.001) return;
    const focusX = clientX === undefined ? rect.width / 2 : clientX - rect.left;
    const focusY = clientY === undefined ? rect.height / 2 : clientY - rect.top;
    const ratio = zoom / current.zoom;
    commitView(clampView({ zoom, x: focusX - (focusX - current.x) * ratio, y: focusY - (focusY - current.y) * ratio }, rect.width, rect.height));
  }

  function changeZoom(direction: -1 | 1) {
    zoomAt(viewRef.current.zoom + direction * ZOOM_STEP);
  }

  function resetView() {
    commitView({ zoom: 1, x: 0, y: 0 });
  }

  function onWheel(event: ReactWheelEvent<HTMLElement>) {
    event.preventDefault();
    const next = viewRef.current.zoom * Math.exp(-event.deltaY * 0.0015);
    zoomAt(next, event.clientX, event.clientY);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    onInteract();
    if (event.button !== 0 || (event.target as Element).closest("button, a, input")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, view: viewRef.current };
    setDragging(true);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    const rect = mapRef.current?.getBoundingClientRect();
    if (!drag || drag.pointerId !== event.pointerId || !rect) return;
    commitView(clampView({ zoom: drag.view.zoom, x: drag.view.x + event.clientX - drag.startX, y: drag.view.y + event.clientY - drag.startY }, rect.width, rect.height));
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function onMapKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "+" || event.key === "=") { event.preventDefault(); changeZoom(1); }
    if (event.key === "-") { event.preventDefault(); changeZoom(-1); }
    if (event.key === "0") { event.preventDefault(); resetView(); }
  }

  /**
   * 줌아웃 상태에서는 내 도감에 담긴 곳만 남깁니다. 여든 곳이 한 화면에 다 찍히면
   * 지도가 아니라 얼룩이 되고, 그중 무엇이 내 것인지도 묻힙니다. 열어 둔 카페는
   * 담기지 않았어도 남습니다 — 검색으로 막 고른 곳이 사라지면 안 되니까요.
   */
  const zoomedIn = view.zoom >= DETAIL_ZOOM;
  const shownCafes = zoomedIn ? cafes : cafes.filter((cafe) => savedMarkers[cafe.id] || cafe.id === activeId);

  /** 지형 겹과 핀 겹이 같은 값을 봐야 한 몸으로 움직입니다. */
  const mapVars = { "--map-zoom": view.zoom, "--map-pan-x": `${view.x}px`, "--map-pan-y": `${view.y}px` } as CSSProperties;

  const mapClass = ["map", dragging ? "is-dragging" : "", zoomedIn ? "is-zoomed" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      ref={mapRef}
      className={mapClass}
      aria-label="수도권 카페 지도"
      tabIndex={0}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onMapKeyDown}
    >
      {/* 지형과 핀을 두 겹으로 가릅니다. 변형도 전이도 똑같아 한 몸처럼 움직이지만,
          지형만 합성 레이어로 올립니다. 핀까지 같은 레이어에 두면 확대할 때
          브라우저가 이미 그려 둔 그림을 늘려 버려서 아이콘과 이름이 뭉갭니다. */}
      <div className="map__layer map__viewport" style={mapVars}>
        <svg className="map__terrain" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {minorRoads.map((d, index) => <path key={`minor-${index}`} className="terrain__road terrain__road--minor" d={d} />)}
          {trunkRoads.map((d, index) => <path key={`trunk-${index}`} className="terrain__road" d={d} />)}
          {districts.map((d, index) => <path key={`district-${index}`} className={`terrain__district terrain__district--${index % 3}`} d={d} />)}
          {tributaries.map((d, index) => <path key={`stream-${index}`} className="terrain__stream" d={d} />)}
          <path className="terrain__river" d={river} /><path className="terrain__sea" d={sea} fillRule="evenodd" />
        </svg>
      </div>
      <div className="map__grain" aria-hidden="true" />

      <div className="map__layer map__pins" style={mapVars}>
        <div className="map__places" aria-hidden="true">{PLACES.map((place) => { const { x, y } = project(place.lng, place.lat); return <span key={place.label} className={place.sea ? "map__sea-label" : undefined} style={{ left: `${x}%`, top: `${y}%` }}>{place.label}</span>; })}</div>
        {shownCafes.map((cafe) => {
          const active = activeId === cafe.id;
          const saved = savedMarkers[cafe.id];
          const { x, y } = project(cafe.pos[0], cafe.pos[1]);
          return <button
            key={cafe.id}
            className={["map-marker", "map-marker--plain", saved ? "is-saved" : "", active ? "is-active" : ""].filter(Boolean).join(" ")}
            style={{ left: `${x}%`, top: `${y}%`, "--codex-color": saved?.color } as CSSProperties}
            type="button"
            onClick={() => onSelect(cafe.id)}
            aria-label={`${cafe.name}, ${cafe.area}${saved ? `, ${saved.collectionName}에 저장됨` : ""}`}
            aria-pressed={active}
          >
            <span className="map-marker__dot">{saved ? <CodexIcon name={saved.icon} size={14} /> : <Coffee size={12} strokeWidth={2.3} aria-hidden="true" />}</span>
            {saved ? <span className="map-marker__name">{cafe.name}{saved.count > 1 ? <i>+{saved.count - 1}</i> : null}</span> : null}
          </button>;
        })}
      </div>

      <div className="map__tools">
        <div className="map__scale" aria-hidden="true"><i style={{ width: `${56 * view.zoom}px` }} /><span>10 km</span></div>
        <div className="map__zoom" role="group" aria-label="지도 확대 축소" onPointerDown={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => changeZoom(-1)} disabled={view.zoom <= MIN_ZOOM + 0.01} aria-label="지도 축소"><Minus size={16} /></button>
        <output aria-live="polite" aria-label={`지도 확대율 ${Math.round(view.zoom * 100)}퍼센트`}>{Math.round(view.zoom * 100)}%</output>
        <button type="button" onClick={() => changeZoom(1)} disabled={view.zoom >= MAX_ZOOM - 0.01} aria-label="지도 확대"><Plus size={16} /></button>
          <button type="button" className="map__zoom-reset" onClick={resetView} disabled={view.zoom <= MIN_ZOOM + 0.01 && view.x === 0 && view.y === 0} aria-label="지도 위치와 확대율 초기화"><RotateCcw size={14} /></button>
        </div>
      </div>
    </section>
  );
}