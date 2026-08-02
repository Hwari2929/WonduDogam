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
import { BASE_LEVEL, cafesIn, districtAt, districtsAtLevel, hasLevel, loadDongDistricts, type DistrictLevel } from "../data/districts";
import { project, SPAN_KM, UNIT_ASPECT } from "../data/geo";
import { outside, sea, type District } from "../data/districts-data";
import { minorRoads, river, tributaries, trunkRoads } from "../data/terrain";
import type { CodexIconId } from "../marks";
import { CodexIcon } from "./CodexIcon";

const PLACES: { label: string; lng: number; lat: number; sea?: boolean }[] = [
  { label: "고양", lng: 126.832, lat: 37.658 }, { label: "서울", lng: 126.978, lat: 37.566 },
  { label: "인천", lng: 126.705, lat: 37.456 }, { label: "성남", lng: 127.127, lat: 37.42 },
  { label: "수원", lng: 127.029, lat: 37.263 }, { label: "서해", lng: 126.5, lat: 37.34, sea: true },
];
const MIN_ZOOM = 1;
const MAX_ZOOM = 15;
/**
 * 단추 한 번에 곱해지는 배율. 더하기로 올리면 배율이 높을수록 한 번의 체감이
 * 줄어들어, 끝으로 갈수록 눌러도 눌러도 그대로인 것처럼 보입니다.
 */
const ZOOM_FACTOR = 1.4;
/**
 * 여기서부터는 한 번에 조금 더 크게 뜁니다. 500%를 넘어가면 이미 동네 하나를
 * 들여다보는 중이라, 같은 보폭으로는 끝까지 가는 데 손만 아픕니다.
 *
 * 어느 쪽으로 가든 낮은 쪽 배율로 보폭을 정합니다 — 그래야 확대했다 축소했을 때
 * 밟았던 자리를 그대로 되짚습니다. 천장에 부딪혀 한 번 잘리고 나면 그 뒤로는
 * 사다리가 어긋나는데, 그건 천장이 있는 이상 어쩔 수 없습니다.
 */
const FAST_FROM = 5;
const FAST_FACTOR = 1.6;
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
 * 100%에서도 이만큼은 밀 수 있습니다 (화면 크기 대비).
 *
 * 딱 맞게 가둬 두면 검색 종이와 도크 밑에 깔린 자리는 영영 못 봅니다 — 강화도는
 * 검색 종이가 63%를 덮고 있어서 아예 짚을 수가 없었습니다. 지형을 창 밖으로 22%
 * 더 그려 두었으므로(build/districts.py 의 PAD), 그 안에서 밀면 빈 자리가 안 보입니다.
 */
const PAN_SLACK = 0.2;
/** 축척 막대의 폭(px). globals.css 의 .map__scale i 와 같아야 합니다. */
const SCALE_BAR_PX = 56;
/**
 * 지도가 쪼개지는 배율. 구로 시작해 500%부터 동으로 갈립니다.
 * 시도까지 세 단계로 두면 확대하는 동안 경계가 두 번 바뀌어 어지럽습니다.
 */
const LEVEL_AT: { from: number; level: DistrictLevel }[] = [
  { from: 5, level: 3 },
  { from: 1, level: 2 },
];
/**
 * 담기지 않은 카페가 나오기 시작하는 배율과, 전부 나오는 배율.
 *
 * 여든 곳이 한 칸에서 우르르 나타나면 지도가 아니라 얼룩이 됩니다. 이 사이에서는
 * 카페마다 정해진 제 차례에 하나씩 나옵니다 — 차례를 id 로 정하므로 끌거나
 * 확대를 되돌려도 나왔다 들어갔다 깜박이지 않습니다.
 */
const REVEAL_FROM = 3;
const REVEAL_ALL = 15;
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
  return LEVEL_AT.find((entry) => zoom >= entry.from)?.level ?? BASE_LEVEL;
}

/**
 * 100% 에서 화면에 담기는 땅의 크기 (0..100 단위).
 *
 * 화면 비율을 그대로 쓰면 창이 정사각형이라 지도가 화면 따라 찌그러집니다. 가로와
 * 세로의 km/px 이 같아지도록 창의 비율을 화면 비율에 맞춰 잡습니다. 100% 는 "땅이
 * 화면을 가득 채우는" 배율이므로, 세로로 긴 폰에서는 가로가 잘리고 대신 밀어서
 * 볼 수 있습니다 — 늘여서 다 보여 주는 것보다 잘라서 제 모양으로 보여 주는 편이
 * 지도입니다.
 */
function baseSpan(width: number, height: number) {
  const target = (width / height) * UNIT_ASPECT;
  return target <= 1 ? { w: 100 * target, h: 100 } : { w: 100, h: 100 / target };
}

function clampView(view: View, width: number, height: number): View {
  const base = baseSpan(width, height);
  const span = { w: base.w / view.zoom, h: base.h / view.zoom };
  // 창 밖으로 밀려난 땅의 절반까지 갈 수 있어야 양 끝을 다 봅니다. 거기에 더해
  // 검색 종이·도크 밑을 꺼내 볼 여유를 얹습니다.
  const reachX = Math.max(0, ((100 - span.w) / 2) * (width / span.w)) + width * PAN_SLACK;
  const reachY = Math.max(0, ((100 - span.h) / 2) * (height / span.h)) + height * PAN_SLACK;
  return { zoom: view.zoom, x: clamp(view.x, -reachX, reachX), y: clamp(view.y, -reachY, reachY) };
}

/**
 * 지금 화면이 보고 있는 땅의 창문 (0..100 단위).
 *
 * 이동값 0 은 "땅이 한가운데"라는 뜻입니다. 그래야 배율을 바꿔도 기준이 흔들리지
 * 않고, 초기값·되돌리기가 모두 {0, 0} 하나로 끝납니다.
 */
function windowOf(view: View, size: { width: number; height: number }) {
  const base = baseSpan(size.width, size.height);
  const w = base.w / view.zoom;
  const h = base.h / view.zoom;
  return {
    x: (100 - w) / 2 - view.x * (w / size.width),
    y: (100 - h) / 2 - view.y * (h / size.height),
    w,
    h,
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
  /** 마우스가 얹힌 행정구역. 경계를 밝히고, 그 안의 카페를 꺼냅니다. */
  const [hovered, setHovered] = useState<District | null>(null);
  /** 읍면동이 도착했는가. 오는 동안에는 한 단계 위(시군구)가 그대로 보입니다. */
  const [dongReady, setDongReady] = useState(() => hasLevel(3));

  const wanted = levelOf(view.zoom);
  const level = (wanted === 3 && !dongReady ? BASE_LEVEL : wanted) as DistrictLevel;
  const shownDistricts = districtsAtLevel(level);
  // 짚는 건 이벤트에서 일어나므로, 지금 그려져 있는 단계를 ref 로 따로 들고 갑니다.
  const levelRef = useRef<DistrictLevel>(level);

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

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  // 읍면동은 그 배율에 처음 닿을 때 한 번만 불러옵니다. 첫 화면에 천 칸을 들고
  // 있을 이유가 없습니다 — 500% 아래에서는 시군구만 보이니까요.
  useEffect(() => {
    if (wanted !== 3 || dongReady) return;
    let alive = true;
    loadDongDistricts().then(() => {
      if (alive) setDongReady(true);
    });
    return () => {
      alive = false;
    };
  }, [wanted, dongReady]);

  // 확대하다 단계가 바뀌면 짚어 둔 칸은 이제 지도에 없는 모양입니다. 마우스가
  // 있던 자리에서 새 단계로 다시 짚습니다 — 안 그러면 구를 짚어 둔 채 확대해
  // 동이 그려진 지도 위에 구 경계가 홀로 남습니다.
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
    // 짚은 점 밑의 땅이 그대로 있도록 이동을 같이 옮깁니다. 이동값 0 이 한가운데라
    // 화면 복판을 기준으로 셈합니다 — 왼쪽 위가 기준이면 (ratio - 1) 항이 없습니다.
    return clampView({
      zoom,
      x: (ratio - 1) * (rect.width / 2 - focusX) + current.x * ratio,
      y: (ratio - 1) * (rect.height / 2 - focusY) + current.y * ratio,
    }, rect.width, rect.height);
  }

  function changeZoom(direction: -1 | 1) {
    const current = viewRef.current.zoom;
    // 오갈 때 같은 자리를 밟으려면 두 배율 중 낮은 쪽으로 보폭을 정해야 합니다.
    // 올라갈 땐 지금 자리가, 내려갈 땐 가려는 자리가 낮은 쪽입니다.
    const fast = direction > 0 ? current >= FAST_FROM : current / FAST_FACTOR >= FAST_FROM;
    const factor = fast ? FAST_FACTOR : ZOOM_FACTOR;
    const next = zoomedView(direction > 0 ? current * factor : current / factor);
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
    // 단추와 같은 만큼 빨라집니다 — ln(1.6) / ln(1.4) ≈ 1.4배.
    const rate = viewRef.current.zoom >= FAST_FROM ? 0.0021 : 0.0015;
    const next = zoomedView(viewRef.current.zoom * Math.exp(-event.deltaY * rate), event.clientX, event.clientY);
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
    const spot = windowOf(viewRef.current, { width: rect.width, height: rect.height });
    return districtAt(
      spot.x + ((clientX - rect.left) / rect.width) * spot.w,
      spot.y + ((clientY - rect.top) / rect.height) * spot.h,
      levelRef.current,
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
   * 담기지 않은 카페가 얼마나 나와 있는가 (0..1). 300%에서 하나도 없고 1500%에서
   * 전부입니다.
   *
   * 배율에 그대로 비례시키지 않고 **제곱**에 비례시킵니다. 확대하면 화면에 남는
   * 땅이 배율의 제곱에 반비례해 줄어드는데, 나오는 비율만 곧게 늘리면 중간에서
   * 한 번 붐볐다가 끝으로 갈수록 도로 휑해집니다. 제곱으로 늘리면 줄어드는 땅과
   * 상쇄되어, 확대하는 내내 화면에 찍힌 핀 수가 고르게 유지됩니다.
   *
   * 열어 둔 카페와 내 도감의 카페는 이것과 무관하게 늘 남습니다 — 검색으로 막
   * 고른 곳이 사라지면 안 되니까요.
   */
  const revealed = clamp(
    (view.zoom ** 2 - REVEAL_FROM ** 2) / (REVEAL_ALL ** 2 - REVEAL_FROM ** 2),
    0,
    1,
  );
  const zoomedIn = revealed > 0;

  /** 지금 보고 있는 땅의 창문. 그림도 핀도 이 하나를 보고 자리를 잡습니다. */
  const window_ = size ? windowOf(view, size) : { x: 0, y: 0, w: 100, h: 100 };
  const viewBox = `${window_.x} ${window_.y} ${window_.w} ${window_.h}`;

  /**
   * 지도 좌표(0..100) → 화면 위의 백분율.
   *
   * 겹을 통째로 확대하지 않으므로, 핀과 이름표는 자기가 설 자리를 직접 셈해서
   * 놓입니다. 되돌리기(scale(1/배율))가 없어져서 글자가 작게 그려졌다 늘어나는
   * 일도 없습니다.
   */
  function toScreen(x: number, y: number) {
    return {
      x: ((x - window_.x) / window_.w) * 100,
      y: ((y - window_.y) / window_.h) * 100,
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

  // 얹은 동네를 통째로 펴 보이는 건 핀이 나오기 시작하는 배율(300%)부터입니다.
  //
  // 그 전에는 경계와 이름표만 밝힙니다. 멀리서 얹자마자 그 동네가 통째로 쏟아지면,
  // 배율을 따라 조금씩 늘리기로 한 약속이 얹는 순간 무너집니다. 어느 동네에 몇
  // 곳인지는 이름표가 이미 말하고 있습니다.
  const hoveredCafes = hovered ? cafesIn(hovered) : [];
  const hoveredIds = hovered && zoomedIn ? new Set(hoveredCafes.map((cafe) => cafe.id)) : null;

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
  const labelSpot = hovered ? toScreen(hovered.label[0], hovered.label[1]) : { x: 0, y: 0 };

  /**
   * 축척 막대가 가리키는 실제 거리. 막대 폭은 CSS 가 정한 56px 로 고정이고, 그
   * 56px 이 몇 km 인지는 화면 크기와 배율이 정합니다 — 폰과 데스크톱은 같은 배율에서
   * 같은 축척이 되지만, 창이 화면 비율을 따라가므로 값 자체는 화면마다 다릅니다.
   */
  const kilometresPerPixel = size ? (SPAN_KM.x * window_.w) / (100 * size.width) : 0;
  const barKilometres = kilometresPerPixel * SCALE_BAR_PX;
  const scaleLabel = barKilometres >= 1
    ? `${barKilometres.toFixed(barKilometres < 10 ? 1 : 0)} km`
    : `${Math.round(barKilometres * 1000 / 10) * 10} m`;

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
          {/* 바다는 창에서 뭍을 도려낸 모양이라 evenodd 로 칠합니다. 수도권 밖(강원·충청
              언저리)은 데이터가 없어 물색이 번지므로 뭍 색으로 덮습니다. */}
          <path className="terrain__sea" d={sea} fillRule="evenodd" />
          <path className="terrain__outside" d={outside} />
          <path className="terrain__river" d={river} />
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
              <i>{hovered.parent ? `${hovered.parent} · ` : ""}<span className="tabular">카페 {hoveredCafes.length}곳</span></i>
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
        <div className="map__scale" aria-hidden="true"><i /><span>{scaleLabel}</span></div>
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