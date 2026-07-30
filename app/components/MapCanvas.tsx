"use client";

import { Coffee, Minus, Plus, RotateCcw } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { Cafe } from "../data/cafes";
import { districtAt } from "../data/districts";
import { project } from "../data/geo";
import { districts, minorRoads, river, sea, tributaries, trunkRoads, type District } from "../data/terrain";
import type { CodexIconId } from "../marks";
import { CodexIcon } from "./CodexIcon";

const PLACES: { label: string; lng: number; lat: number; sea?: boolean }[] = [
  { label: "고양", lng: 126.832, lat: 37.658 }, { label: "서울", lng: 126.978, lat: 37.566 },
  { label: "인천", lng: 126.705, lat: 37.456 }, { label: "성남", lng: 127.127, lat: 37.42 },
  { label: "수원", lng: 127.029, lat: 37.263 }, { label: "서해", lng: 126.5, lat: 37.34, sea: true },
];
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
/**
 * 단추 한 번에 곱해지는 배율. 더하기로 올리면 100%에서 500%까지 열여섯 번을
 * 눌러야 하고, 배율이 높을수록 한 번의 체감이 줄어듭니다.
 */
const ZOOM_FACTOR = 1.4;
/** 화면 밖으로 이만큼까지는 핀을 남겨 둡니다 — 끌 때 가장자리에서 툭 튀지 않게. */
const CULL_MARGIN = 0.2;
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
  /**
   * 화면에 들어오는 핀만 그리려면 지도의 실제 크기가 필요합니다. 재기 전에는
   * 걸러내지 않습니다 — 0으로 재고 시작하면 첫 프레임이 텅 빕니다.
   */
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  /** 마우스가 얹힌 시·구. 경계를 밝히고, 그 안의 카페를 줌아웃 상태에서도 꺼냅니다. */
  const [hovered, setHovered] = useState<District | null>(null);

  useEffect(() => {
    const element = mapRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((current) => (current?.width === width && current?.height === height ? current : { width, height }));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

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
    zoomAt(viewRef.current.zoom * (direction > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR));
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
    setHovered(null);
  }

  /**
   * 화면 좌표 → 지도 좌표(0..100). 겹에 걸린 변형을 그대로 되돌린 식이라
   * 확대·이동 중에도 커서 밑의 동네를 정확히 짚습니다.
   */
  function districtUnder(clientX: number, clientY: number) {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const current = viewRef.current;
    return districtAt(
      ((clientX - rect.left - current.x) / current.zoom / rect.width) * 100,
      ((clientY - rect.top - current.y) / current.zoom / rect.height) * 100,
    );
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    const rect = mapRef.current?.getBoundingClientRect();
    if (drag && drag.pointerId === event.pointerId && rect) {
      commitView(clampView({ zoom: drag.view.zoom, x: drag.view.x + event.clientX - drag.startX, y: drag.view.y + event.clientY - drag.startY }, rect.width, rect.height));
      return;
    }
    // 손가락에는 "올려 두기"가 없습니다. 눌러야 좌표가 오니 지나간 자리마다 동네가
    // 켜졌다 꺼지고, 떼면 그대로 남습니다. 마우스에만 답니다.
    if (event.pointerType !== "mouse") return;
    const next = districtUnder(event.clientX, event.clientY);
    setHovered((current) => (current?.id === next?.id ? current : next));
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

  /**
   * 지금 보이는 자리에 있는 카페인가. 확대할수록 화면에 남는 땅은 좁아지는데
   * 여든 곳을 통째로 그려 두면 보이지도 않는 핀을 계속 붙들고 있게 됩니다.
   */
  function inView(x: number, y: number) {
    if (!size) return true;
    const screenX = (x / 100) * size.width * view.zoom + view.x;
    const screenY = (y / 100) * size.height * view.zoom + view.y;
    return (
      screenX >= -size.width * CULL_MARGIN && screenX <= size.width * (1 + CULL_MARGIN) &&
      screenY >= -size.height * CULL_MARGIN && screenY <= size.height * (1 + CULL_MARGIN)
    );
  }

  // 마우스를 얹은 동네는 배율과 상관없이 통째로 펴 보입니다 — 어느 동네에 무엇이
  // 있는지 보려고 굳이 확대까지 하게 만들 이유가 없습니다.
  const hoveredIds = hovered ? new Set(hovered.cafeIds) : null;

  const shownCafes = cafes.filter((cafe) => {
    // 줌아웃 상태에서는 지금 고른 도감에 담긴 곳과 열어 둔 카페만 남습니다.
    if (!zoomedIn && !savedMarkers[cafe.id] && cafe.id !== activeId && !hoveredIds?.has(cafe.id)) return false;
    const { x, y } = project(cafe.pos[0], cafe.pos[1]);
    return inView(x, y);
  });

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
      onPointerLeave={() => setHovered(null)}
      onKeyDown={onMapKeyDown}
    >
      {/* 지형·강조·핀을 세 겹으로 가릅니다. 변형도 전이도 똑같아 한 몸처럼 움직이지만,
          지형만 합성 레이어로 올립니다. 나머지까지 같은 레이어에 두면 확대할 때
          브라우저가 이미 그려 둔 그림을 늘려 버려서 아이콘과 선이 뭉갭니다. */}
      <div className="map__layer map__viewport" style={mapVars}>
        <svg className="map__terrain" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {minorRoads.map((d, index) => <path key={`minor-${index}`} className="terrain__road terrain__road--minor" d={d} />)}
          {trunkRoads.map((d, index) => <path key={`trunk-${index}`} className="terrain__road" d={d} />)}
          {districts.map((district, index) => <path key={`district-${index}`} className={`terrain__district terrain__district--${index % 3}`} d={district.path} />)}
          {tributaries.map((d, index) => <path key={`stream-${index}`} className="terrain__stream" d={d} />)}
          <path className="terrain__river" d={river} /><path className="terrain__sea" d={sea} fillRule="evenodd" />
        </svg>
      </div>
      <div className="map__grain" aria-hidden="true" />

      {/* 얹힌 동네 하나만 그립니다. 지형 겹에 같이 넣으면 확대할 때 이 선까지
          늘어나 뭉개지고, 옅은 채움이 강 위에도 얹힙니다. */}
      <div className="map__layer map__regions" style={mapVars} aria-hidden="true">
        {hovered ? (
          <>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* key 를 갈아 끼우면 옆 동네로 넘어갈 때 새 요소가 되어
                  모양이 뭉개지며 변하지 않고 제자리에서 다시 밝아집니다. */}
              <path key={hovered.id} d={hovered.path} />
            </svg>
            {/* 중구는 서울에도 인천에도 있습니다. 시도를 같이 적어야 어디인지 압니다. */}
            <span className="region-label" style={{ left: `${hovered.label[0]}%`, top: `${hovered.label[1]}%` }}>
              <b>{hovered.name}</b>
              <i>{hovered.sido} · <span className="tabular">카페 {hovered.cafeIds.length}곳</span></i>
            </span>
          </>
        ) : null}
      </div>

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
        <div className="map__scale" aria-hidden="true"><i /><span>{(10 / view.zoom).toFixed(view.zoom >= 2 ? 1 : 0)} km</span></div>
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