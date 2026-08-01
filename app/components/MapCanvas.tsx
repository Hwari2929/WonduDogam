"use client";

import { Coffee, Minus, Plus, RotateCcw } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { Cafe } from "../data/cafes";
import { districtAt, districtsAtLevel, type DistrictLevel } from "../data/districts";
import { project } from "../data/geo";
import { minorRoads, river, sea, tributaries, trunkRoads, type District } from "../data/terrain";
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
 * 이만큼 안 움직이고 뗐으면 끈 게 아니라 친 것으로 봅니다(px). 손가락은 가만히
 * 있어도 몇 px 은 흔들리므로 0 으로 두면 탭이 거의 안 잡힙니다.
 */
const TAP_SLOP = 10;
/** 단추로 배율을 바꿀 때 미끄러지는 시간(ms). 예전 CSS 전이와 같은 체감입니다. */
const GLIDE_MS = 140;
/**
 * 지도가 쪼개지는 배율. 확대하면 시도 → 시·군 → 구 순으로 나뉩니다.
 * 멀리서 스물몇 개의 구가 한꺼번에 보이면 경계가 무늬가 되지, 지도가 아닙니다.
 */
const LEVEL_AT: { from: number; level: DistrictLevel }[] = [
  { from: 3.5, level: 3 },
  { from: 2.5, level: 2 },
  { from: 1, level: 1 },
];
/**
 * 담기지 않은 카페가 나오기 시작하는 배율과, 전부 나오는 배율.
 *
 * 여든 곳이 한 칸에서 우르르 나타나면 지도가 아니라 얼룩이 됩니다. 이 사이에서는
 * 카페마다 정해진 제 차례에 하나씩 나옵니다 — 차례를 id 로 정하므로 끌거나
 * 확대를 되돌려도 나왔다 들어갔다 깜박이지 않습니다.
 */
const REVEAL_FROM = 2;
const REVEAL_ALL = 4;
type View = { zoom: number; x: number; y: number };

const INITIAL_VIEW: View = { zoom: 1, x: 0, y: 0 };
type Drag = { pointerId: number; startX: number; startY: number; view: View };

export type SavedCafeMarker = { color: string; icon: CodexIconId; count: number; collectionName: string };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * id 를 흩뿌리는 해시.
 *
 * 마무리로 한 번 더 섞는 게 핵심입니다. 곱하고 더하기만 하면 demo-01 과 demo-02 가
 * 이웃한 값이 되어 한꺼번에 나오고, 목록이 지역 순이라 그게 곧 "한 동네가 통째로
 * 튀어나온다"가 됩니다.
 */
function scatter(id: string) {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  }
  hash = Math.imul(hash ^ (hash >>> 15), 2246822507);
  hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
  return (hash ^ (hash >>> 16)) >>> 0;
}

/** 이 배율에서 지도를 나누는 단계. */
function levelOf(zoom: number): DistrictLevel {
  return LEVEL_AT.find((entry) => zoom >= entry.from)?.level ?? 1;
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
  /** 진행 중인 미끄러짐. 끌기나 휠이 끼어들면 즉시 놓아 줍니다. */
  const glideRef = useRef<number | null>(null);
  /** 마지막으로 마우스가 있던 자리. 단계가 바뀌면 여기서 다시 짚습니다. */
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  /** 마우스가 얹힌 시·구. 경계를 밝히고, 그 안의 카페를 줌아웃 상태에서도 꺼냅니다. */
  const [hovered, setHovered] = useState<District | null>(null);

  const level = levelOf(view.zoom);
  const shownDistricts = districtsAtLevel(level);

  /**
   * 카페마다 정해진 제 차례(0..1). 해시로 줄을 세운 뒤 등수를 매기므로, 배율이
   * 절반쯤 왔으면 정확히 절반이 나와 있습니다 — 해시값을 그대로 쓰면 몰린 구간에서
   * 우르르 쏟아지고 빈 구간에서는 아무 일도 안 일어납니다.
   */
  const revealOrder = useMemo(() => {
    const ordered = [...cafes].sort((a, b) => scatter(a.id) - scatter(b.id));
    return new Map(ordered.map((cafe, index) => [cafe.id, index / ordered.length]));
  }, [cafes]);

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

  // 화면에서 사라진 뒤에도 프레임을 잡고 있으면 안 됩니다.
  useEffect(() => () => stopGlide(), []);

  // 확대하다 단계가 바뀌면 짚어 둔 칸은 이제 지도에 없는 모양입니다. 마우스가
  // 있던 자리에서 새 단계로 다시 짚습니다 — 안 그러면 서울을 짚어 둔 채 확대해
  // 구가 그려진 지도 위에 서울 경계가 홀로 남습니다.
  useEffect(() => {
    setHovered((current) => {
      if (!current || current.level === level) return current;
      const spot = pointerRef.current;
      return spot ? districtUnder(spot.x, spot.y) : null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  function commitView(next: View) {
    viewRef.current = next;
    setView(next);
  }

  function stopGlide() {
    if (glideRef.current === null) return;
    cancelAnimationFrame(glideRef.current);
    glideRef.current = null;
  }

  /**
   * 단추 한 번에 1.4배씩 뛰므로 그냥 갈아 끼우면 화면이 툭 끊깁니다. 예전에는 겹에
   * 건 CSS 전이가 이걸 부드럽게 했지만, 그 전이가 곧 확대를 늘려 붙이는 원인이라
   * 걷어냈습니다. 값을 프레임마다 조금씩 옮겨 같은 부드러움을 되찾되, 매 프레임
   * 벡터에서 다시 그리므로 중간 어느 순간에도 선이 뭉개지지 않습니다.
   */
  function glideTo(target: View) {
    stopGlide();
    const from = viewRef.current;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      commitView(target);
      return;
    }
    const startedAt = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / GLIDE_MS);
      const eased = 1 - (1 - t) ** 3;
      commitView({
        zoom: from.zoom + (target.zoom - from.zoom) * eased,
        x: from.x + (target.x - from.x) * eased,
        y: from.y + (target.y - from.y) * eased,
      });
      glideRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    glideRef.current = requestAnimationFrame(step);
  }

  /** 배율을 바꾼 뒤의 자리. 짚은 점이 화면에서 그대로 있도록 이동을 같이 옮깁니다. */
  function zoomedView(nextZoom: number, clientX?: number, clientY?: number) {
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const current = viewRef.current;
    const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(zoom - current.zoom) < 0.001) return null;
    const focusX = clientX === undefined ? rect.width / 2 : clientX - rect.left;
    const focusY = clientY === undefined ? rect.height / 2 : clientY - rect.top;
    const ratio = zoom / current.zoom;
    return clampView({ zoom, x: focusX - (focusX - current.x) * ratio, y: focusY - (focusY - current.y) * ratio }, rect.width, rect.height);
  }

  function changeZoom(direction: -1 | 1) {
    const next = zoomedView(viewRef.current.zoom * (direction > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR));
    if (next) glideTo(next);
  }

  function resetView() {
    glideTo({ zoom: 1, x: 0, y: 0 });
  }

  function onWheel(event: ReactWheelEvent<HTMLElement>) {
    event.preventDefault();
    // 휠은 이미 조금씩 연달아 들어오므로 그대로 따라갑니다 — 여기에 미끄러짐을
    // 얹으면 손보다 지도가 늦게 따라와 미끄덩거립니다.
    stopGlide();
    const next = zoomedView(viewRef.current.zoom * Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
    if (next) commitView(next);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    onInteract();
    if (event.button !== 0 || (event.target as Element).closest("button, a, input")) return;
    stopGlide();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, view: viewRef.current };
    setDragging(true);
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
      levelOf(current.zoom),
    );
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    const rect = mapRef.current?.getBoundingClientRect();
    if (drag && drag.pointerId === event.pointerId && rect) {
      commitView(clampView({ zoom: drag.view.zoom, x: drag.view.x + event.clientX - drag.startX, y: drag.view.y + event.clientY - drag.startY }, rect.width, rect.height));
      // 지도를 옮기기 시작했으면 짚어 둔 동네는 놓습니다. 누르는 순간에 놓아
      // 버리면, 손가락으로 톡 쳤을 때 방금 켠 것인지 원래 켜져 있던 것인지
      // 구분할 수 없어 같은 곳을 다시 쳐도 안 꺼집니다.
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > TAP_SLOP) setHovered(null);
      return;
    }
    // 손가락에는 "올려 두기"가 없습니다. 눌린 채로만 좌표가 오니 지나간 자리마다
    // 동네가 켜졌다 꺼집니다. 마우스는 지나가기만 해도 켜고, 손가락은 뗄 때 켭니다.
    if (event.pointerType !== "mouse") return;
    pointerRef.current = { x: event.clientX, y: event.clientY };
    const next = districtUnder(event.clientX, event.clientY);
    setHovered((current) => (current?.id === next?.id ? current : next));
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);

    // 손가락으로는 톡 쳐서 고릅니다. 끌었으면 지도를 옮긴 것이고, 제자리에서
    // 뗐으면 그 동네를 짚은 것입니다. 다른 동네를 치면 그쪽으로 옮겨 가고, 아무
    // 동네도 없는 자리를 치면 꺼집니다 — 같은 곳을 다시 쳤을 때만 다르게 굴면
    // 두 번째 탭이 켜는 건지 끄는 건지 손끝으로는 알 수 없습니다.
    if (event.pointerType === "mouse") return;
    const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (moved > TAP_SLOP) return;
    setHovered(districtUnder(event.clientX, event.clientY));
  }

  /**
   * 손가락은 떼는 순간 포인터 자체가 사라져서, 톡 친 직후에 pointerleave 가 곧바로
   * 따라옵니다. 그걸 그대로 받으면 방금 고른 동네가 켜지자마자 꺼집니다. 지도
   * 밖으로 나갔다는 뜻이 되는 건 마우스뿐입니다.
   */
  function onPointerLeave(event: ReactPointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse") setHovered(null);
  }

  function onMapKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "+" || event.key === "=") { event.preventDefault(); changeZoom(1); }
    if (event.key === "-") { event.preventDefault(); changeZoom(-1); }
    if (event.key === "0") { event.preventDefault(); resetView(); }
  }


  /**
   * 담기지 않은 카페가 얼마나 나와 있는가 (0..1). 200%에서 하나도 없고 400%에서
   * 전부입니다. 열어 둔 카페와 내 도감의 카페는 이것과 무관하게 늘 남습니다 —
   * 검색으로 막 고른 곳이 사라지면 안 되니까요.
   */
  const revealed = clamp((view.zoom - REVEAL_FROM) / (REVEAL_ALL - REVEAL_FROM), 0, 1);
  const zoomedIn = revealed > 0;

  /**
   * 지도 좌표(0..100) → 화면 위의 백분율.
   *
   * 겹을 통째로 확대하지 않으므로, 핀과 이름표는 자기가 설 자리를 직접 셈해서
   * 놓입니다. 되돌리기(scale(1/배율))가 없어져서 글자가 작게 그려졌다 늘어나는
   * 일도 없습니다.
   */
  function toScreen(x: number, y: number) {
    if (!size) return { x, y };
    return {
      x: x * view.zoom + (view.x / size.width) * 100,
      y: y * view.zoom + (view.y / size.height) * 100,
    };
  }

  /**
   * 지금 보이는 자리에 있는 카페인가. 확대할수록 화면에 남는 땅은 좁아지는데
   * 여든 곳을 통째로 그려 두면 보이지도 않는 핀을 계속 붙들고 있게 됩니다.
   */
  function inView(x: number, y: number) {
    if (!size) return true;
    const screen = toScreen(x, y);
    const margin = CULL_MARGIN * 100;
    return screen.x >= -margin && screen.x <= 100 + margin && screen.y >= -margin && screen.y <= 100 + margin;
  }

  // 얹은 동네를 통째로 펴 보이는 건 구까지 갈린 뒤부터입니다.
  //
  // 그 전에는 경계와 이름표만 밝힙니다. 서울이 한 칸인 배율에서 얹자마자 마흔 곳이
  // 쏟아지면, 배율을 따라 조금씩 늘리기로 한 약속이 얹는 순간 무너집니다. 멀리서는
  // 어느 동네에 몇 곳인지면 충분하고 — 그건 이름표가 이미 말하고 있습니다.
  const hoveredIds = hovered && level === 3 ? new Set(hovered.cafeIds) : null;

  const shownCafes = cafes.filter((cafe) => {
    if (savedMarkers[cafe.id] || cafe.id === activeId || hoveredIds?.has(cafe.id)) {
      const { x, y } = project(cafe.pos[0], cafe.pos[1]);
      return inView(x, y);
    }
    // 나머지는 제 차례가 와야 나옵니다.
    if ((revealOrder.get(cafe.id) ?? 0) >= revealed) return false;
    const { x, y } = project(cafe.pos[0], cafe.pos[1]);
    return inView(x, y);
  });

  /**
   * 지금 보이는 땅의 창문. 겹을 CSS 로 확대하는 대신 이 창문을 좁힙니다.
   *
   * transform: scale() 로 키우면 브라우저는 이미 그려 둔 그림을 늘립니다 — 특히
   * 아이패드·모바일 사파리는 겹을 훨씬 적극적으로 이미지로 구워 두어서, 배율을
   * 올릴수록 경계선도 글자도 뭉갭니다. viewBox 를 좁히면 배율이 바뀔 때마다
   * 벡터에서 다시 그리므로 500%에서도 선이 그대로 섭니다.
   */
  const viewBox = size
    ? `${(-view.x / (size.width * view.zoom)) * 100} ${(-view.y / (size.height * view.zoom)) * 100} ${100 / view.zoom} ${100 / view.zoom}`
    : "0 0 100 100";

  const labelSpot = hovered ? toScreen(hovered.label[0], hovered.label[1]) : { x: 0, y: 0 };

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
      onPointerLeave={onPointerLeave}
      onKeyDown={onMapKeyDown}
    >
      {/* 지형·강조·핀을 세 겹으로 가릅니다. 어느 겹도 CSS 로 확대하지 않습니다 —
          그림은 viewBox 가 좁아지며 벡터에서 다시 그려지고, 핀과 이름표는 자기
          자리를 셈해서 놓입니다. 늘려 붙이는 단계가 아예 없어야 안 뭉갭니다. */}
      <div className="map__layer map__viewport">
        <svg className="map__terrain" viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true">
          {minorRoads.map((d, index) => <path key={`minor-${index}`} className="terrain__road terrain__road--minor" d={d} />)}
          {trunkRoads.map((d, index) => <path key={`trunk-${index}`} className="terrain__road" d={d} />)}
          {shownDistricts.map((district, index) => <path key={district.id} className={`terrain__district terrain__district--${index % 3}`} d={district.path} />)}
          {tributaries.map((d, index) => <path key={`stream-${index}`} className="terrain__stream" d={d} />)}
          <path className="terrain__river" d={river} /><path className="terrain__sea" d={sea} fillRule="evenodd" />
        </svg>
      </div>
      <div className="map__grain" aria-hidden="true" />

      {/* 얹힌 동네 하나만 그립니다. 지형 겹에 같이 넣으면 확대할 때 이 선까지
          늘어나 뭉개지고, 옅은 채움이 강 위에도 얹힙니다. */}
      <div className="map__layer map__regions" aria-hidden="true">
        {hovered ? (
          <>
            <svg viewBox={viewBox} preserveAspectRatio="none">
              {/* key 를 갈아 끼우면 옆 동네로 넘어갈 때 새 요소가 되어
                  모양이 뭉개지며 변하지 않고 제자리에서 다시 밝아집니다. */}
              <path key={hovered.id} d={hovered.path} />
            </svg>
            {/* 중구는 서울에도 인천에도 있습니다. 시도를 같이 적어야 어디인지 압니다. */}
            <span className="region-label" style={{ left: `${labelSpot.x}%`, top: `${labelSpot.y}%` }}>
              <b>{hovered.name}</b>
              {/* 시도 칸은 위가 자기 자신이라 앞에 붙일 이름이 없습니다. */}
              <i>{hovered.sido ? `${hovered.sido} · ` : ""}<span className="tabular">카페 {hovered.cafeIds.length}곳</span></i>
            </span>
          </>
        ) : null}
      </div>

      <div className="map__layer map__pins">
        <div className="map__places" aria-hidden="true">{PLACES.map((place) => { const spot = project(place.lng, place.lat); const { x, y } = toScreen(spot.x, spot.y); return <span key={place.label} className={place.sea ? "map__sea-label" : undefined} style={{ left: `${x}%`, top: `${y}%` }}>{place.label}</span>; })}</div>
        {shownCafes.map((cafe) => {
          const active = activeId === cafe.id;
          const saved = savedMarkers[cafe.id];
          const spot = project(cafe.pos[0], cafe.pos[1]);
          const { x, y } = toScreen(spot.x, spot.y);
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