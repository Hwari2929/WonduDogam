"use client";

import { Coffee, Minus, Plus, RotateCcw } from "lucide-react";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { Cafe } from "../data/cafes";
import { BASE_LEVEL, cafesIn, districtAt, hasLevel, loadDongDistricts, piecesInView, type DistrictLevel, type DistrictPiece } from "../data/districts";
import { project, SPAN_KM, UNIT_ASPECT } from "../data/geo";
import { ICON } from "../icons";
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
/**
 * 단추로 배율을 바꿀 때 미끄러지는 시간(ms).
 *
 * 이 시간 내내 지도를 프레임마다 처음부터 다시 그립니다 — 배율이 바뀌면 창을
 * 고쳐 쓰는 것 말고 방법이 없습니다(늘려 붙이면 뭉갭니다). 140ms 였을 때는
 * 단추 한 번에 폰이 100ms 넘게 그 일만 했습니다. 한 칸이 뛰는 게 보이지 않을
 * 만큼만 남깁니다.
 */
const GLIDE_MS = 160;
/** 휠은 끝을 알려 주지 않습니다. 이만큼 조용하면 손짓이 끝난 것으로 봅니다(ms). */
const SETTLE_MS = 140;
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
/**
 * 창 밖으로 이만큼까지의 칸은 미리 그려 둡니다 (창 크기 대비). 딱 맞게 자르면
 * 끌기 시작하는 순간 가장자리에서 땅이 자라나는 게 보입니다.
 */
const TILE_MARGIN = 0.4;
/** 창이 이만큼(창 크기 대비) 움직이기 전에는 그리는 목록을 다시 내지 않습니다. */
const TILE_STEP = 0.25;
/**
 * 화면 밖으로 이만큼 더 그려 둡니다 (화면 크기 대비, 사방으로).
 *
 * 끄는 동안 창(viewBox)을 고쳐 쓰면 브라우저는 프레임마다 지도를 처음부터 다시
 * 그립니다 — 길·경계·핀을 전부. 폰에서 손가락을 따라오지 못하던 게 이것이었습니다.
 * 넓게 한 번 그려 두고 겹을 통째로 밀면, 옮기는 동안에는 이미 그려 둔 그림을
 * 자리만 바꿔 얹습니다(합성). **늘리지 않고 밀기만** 하므로 글자도 선도 안 뭉갭니다 —
 * 뭉개지는 건 scale 이지 translate 가 아닙니다.
 *
 * 이 여유를 넘어가게 밀면 그때 한 번 다시 그리고 그 자리에서 이어 갑니다.
 */
const OVERSCAN = 0.25;
type View = { zoom: number; x: number; y: number };

const INITIAL_VIEW: View = { zoom: 1, x: 0, y: 0 };
/** tap 은 "여기서 손을 뗐을 때 동네를 짚어도 되는가"입니다 — 오므리다 만 손은 아닙니다. */
type Drag = { pointerId: number; startX: number; startY: number; view: View; tap: boolean };
/** 두 손가락 사이의 거리와 가운데. 매 프레임 이 둘의 변화만 지도에 옮깁니다. */
type Pinch = { distance: number; x: number; y: number };

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

/**
 * 배율만 곱한 자리. focus 로 짚은 점 밑의 땅이 화면에서 그대로 있도록 이동을 같이
 * 옮깁니다. 이동값 0 이 한가운데라 화면 복판을 기준으로 셈합니다 — 왼쪽 위가
 * 기준이면 (ratio - 1) 항이 없습니다.
 *
 * 휠·단추·두 손가락이 모두 이 식 하나를 씁니다. 오므리기만 따로 셈하면 같은
 * 배율에서 같은 자리에 안 서게 됩니다.
 */
function scaledAt(view: View, factor: number, focusX: number, focusY: number, size: { width: number; height: number }): View {
  const zoom = clamp(view.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const ratio = zoom / view.zoom;
  return {
    zoom,
    x: (ratio - 1) * (size.width / 2 - focusX) + view.x * ratio,
    y: (ratio - 1) * (size.height / 2 - focusY) + view.y * ratio,
  };
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

/**
 * 지형 그림. 끌거나 확대해도 **길 자체는 그대로**입니다 — 바뀌는 건 바깥 <svg> 의
 * 창(viewBox) 하나뿐입니다.
 *
 * 그래서 여기를 떼어 memo 로 묶습니다. 안 묶으면 손가락이 움직이는 프레임마다
 * 읍면동 1,108칸을 통째로 다시 만들어 맞춰 보게 되는데, 결과는 늘 같습니다.
 * 폰에서 확대할 때 800ms 가까이 멈춰 서 있던 게 전부 이 헛일이었습니다.
 */
const Terrain = memo(function Terrain({ pieces }: { pieces: DistrictPiece[] }) {
  return (
    <>
      {minorRoads.map((d, index) => <path key={`minor-${index}`} className="terrain__road terrain__road--minor" d={d} />)}
      {trunkRoads.map((d, index) => <path key={`trunk-${index}`} className="terrain__road" d={d} />)}
      {pieces.map((piece) => <path key={piece.id} className={`terrain__district terrain__district--${piece.tint}`} d={piece.path} />)}
      {tributaries.map((d, index) => <path key={`stream-${index}`} className="terrain__stream" d={d} />)}
      {/* 바다는 창에서 뭍을 도려낸 모양이라 evenodd 로 칠합니다. 수도권 밖(강원·충청
          언저리)은 데이터가 없어 물색이 번지므로 뭍 색으로 덮습니다. */}
      <path className="terrain__sea" d={sea} fillRule="evenodd" />
      <path className="terrain__outside" d={outside} />
      <path className="terrain__river" d={river} />
    </>
  );
});

/**
 * 핀 속 그림. 자리는 프레임마다 바뀌지만 얼굴은 안 바뀝니다 — 떼어 두지 않으면
 * 끌 때마다 카페 수만큼의 아이콘 SVG 를 다시 짓습니다.
 */
const MarkerFace = memo(function MarkerFace({ icon }: { icon: CodexIconId | null }) {
  return (
    <span className="map-marker__dot">
      {icon ? <CodexIcon name={icon} size={ICON.sm} /> : <Coffee size={ICON.sm} aria-hidden="true" />}
    </span>
  );
});

export function MapCanvas({ cafes, activeId, savedMarkers, onSelect, onInteract }: {
  cafes: Cafe[];
  activeId: string | null;
  savedMarkers: Record<string, SavedCafeMarker>;
  onSelect: (id: string) => void;
  onInteract: () => void;
}) {
  const mapRef = useRef<HTMLElement>(null);
  const dragRef = useRef<Drag | null>(null);
  /** 지금 지도에 얹혀 있는 손가락들. 하나면 밀기, 둘이면 오므리기입니다. */
  const touchesRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<Pinch | null>(null);
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
  /** 세 겹을 함께 옮기는 상자. 손짓이 이어지는 동안 여기에만 transform 이 붙습니다. */
  const panRef = useRef<HTMLDivElement>(null);
  /** 지금 **그려져 있는** 자리. viewRef 는 손이 가 있는 자리라 둘이 어긋납니다. */
  const renderedRef = useRef<View>(INITIAL_VIEW);
  /** 다시 그린 다음 얹어 둔 변형을 되돌려야 하는가. */
  const restoreRef = useRef(false);
  /** 진행 중인 미끄러짐. 끌기나 휠이 끼어들면 즉시 놓아 줍니다. */
  const glideRef = useRef<number | null>(null);
  /** 휠은 끝을 알려 주지 않습니다. 조용해지면 그때 한 번 그립니다. */
  const settleRef = useRef<number | null>(null);
  /** 마지막으로 마우스가 있던 자리. 단계가 바뀌면 여기서 다시 짚습니다. */
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  /** 마우스가 얹힌 행정구역. 경계를 밝히고, 그 안의 카페를 꺼냅니다. */
  const [hovered, setHovered] = useState<District | null>(null);
  /** 읍면동이 도착했는가. 오는 동안에는 한 단계 위(시군구)가 그대로 보입니다. */
  const [dongReady, setDongReady] = useState(() => hasLevel(3));

  const wanted = levelOf(view.zoom);
  const level = (wanted === 3 && !dongReady ? BASE_LEVEL : wanted) as DistrictLevel;
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
      // 얹어 둔 변형은 재 둔 크기를 기준으로 셈한 것이라, 크기가 바뀌면 어긋납니다.
      if (panRef.current?.style.transform) redrawNow();
      setSize((current) => (current?.width === width && current?.height === height ? current : { width, height }));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // 화면에서 사라진 뒤에도 프레임을 잡고 있으면 안 됩니다.
  useEffect(() => () => {
    stopGlide();
    if (settleRef.current !== null) window.clearTimeout(settleRef.current);
  }, []);

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  /**
   * 다시 그린 그림이 화면에 나가기 **전에** 밀어 둔 것을 되돌립니다.
   * useEffect 로 미루면 한 프레임 동안 새 창 + 옛 밀기가 겹쳐 지도가 튑니다.
   */
  useLayoutEffect(() => {
    if (!restoreRef.current) return;
    restoreRef.current = false;
    renderedRef.current = view;
    if (panRef.current) panRef.current.style.transform = "";
  }, [view]);

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

  /**
   * 그려져 있는 자리에서 손이 가 있는 자리까지의 **보이는 차이**를 겹에 얹습니다.
   *
   * 끌든 오므리든 확대하든, 손짓이 이어지는 동안에는 지도를 다시 그리지 않습니다.
   * 이미 그려 둔 그림을 옮기고 늘려서 보여 줄 뿐입니다(합성). 늘린 동안에는 선이
   * 조금 무릅니다만, 손을 떼는 순간 제 배율로 한 번 그려 다시 또렷해집니다 —
   * 매 프레임 처음부터 그리느라 손을 못 따라오는 것보다 이쪽이 낫습니다.
   */
  function applyTransform() {
    const layer = panRef.current;
    if (!layer || !size) return;
    const from = renderedRef.current;
    const to = viewRef.current;
    const before = windowOf(from, size);
    const after = windowOf(to, size);
    const scale = to.zoom / from.zoom;
    const tx = ((before.x - after.x) / after.w) * size.width;
    const ty = ((before.y - after.y) / after.h) * size.height;
    layer.style.transform = scale === 1 && tx === 0 && ty === 0
      ? ""
      : `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
  }

  /** 손짓이 끝났습니다. 지금 자리로 한 번 그립니다. */
  function settle() {
    if (settleRef.current !== null) {
      window.clearTimeout(settleRef.current);
      settleRef.current = null;
    }
    const layer = panRef.current;
    if (!layer || !layer.style.transform) return;
    restoreRef.current = true;
    setView({ ...viewRef.current });
  }

  /** 조용해지면 그리기. 휠처럼 끝을 알려 주지 않는 것에 씁니다. */
  function settleSoon() {
    if (settleRef.current !== null) window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(() => {
      settleRef.current = null;
      settle();
    }, SETTLE_MS);
  }

  /**
   * 넓게 그려 둔 여유를 넘었는가. 넘었으면 손짓 도중이라도 한 번 그려야 합니다 —
   * 밀면 가장자리에 빈 자리가, 줄이면 사방에 빈 테두리가 드러납니다.
   */
  function outOfSpare() {
    const layer = panRef.current;
    if (!layer || !size) return false;
    const from = renderedRef.current;
    const to = viewRef.current;
    const scale = to.zoom / from.zoom;
    if (scale < 1 / (1 + OVERSCAN * 2)) return true;
    const before = windowOf(from, size);
    const after = windowOf(to, size);
    const tx = Math.abs(((before.x - after.x) / after.w) * size.width);
    const ty = Math.abs(((before.y - after.y) / after.h) * size.height);
    return tx > size.width * OVERSCAN || ty > size.height * OVERSCAN;
  }

  /** 손짓 도중에 한 번 그리고 그 자리에서 이어 갑니다. */
  function redrawNow() {
    restoreRef.current = true;
    setView({ ...viewRef.current });
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
      viewRef.current = target;
      redrawNow();
      return;
    }
    const startedAt = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / GLIDE_MS);
      const eased = 1 - (1 - t) ** 3;
      viewRef.current = {
        zoom: from.zoom + (target.zoom - from.zoom) * eased,
        x: from.x + (target.x - from.x) * eased,
        y: from.y + (target.y - from.y) * eased,
      };
      applyTransform();
      if (t < 1) {
        glideRef.current = requestAnimationFrame(step);
        return;
      }
      glideRef.current = null;
      settle();
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
    return clampView(scaledAt(current, zoom / current.zoom, focusX, focusY, rect), rect.width, rect.height);
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
    if (!next) return;
    viewRef.current = next;
    if (outOfSpare()) redrawNow();
    else applyTransform();
    settleSoon();
  }

  /** 두 손가락의 지금 거리와 가운데. 셋 이상이면 먼저 얹은 둘만 봅니다. */
  function pinchOf(): Pinch | null {
    const [a, b] = [...touchesRef.current.values()];
    if (!a || !b) return null;
    return { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function onPointerDown(event: ReactPointerEvent<HTMLElement>) {
    onInteract();
    if (event.button !== 0) return;
    stopGlide();
    // 핀이나 단추 위에 내려앉은 손가락도 **손가락으로는** 셉니다. 안 세면 두 손
    // 중 하나가 핀에 닿았다는 이유로 오므리기가 아예 시작되지 않습니다 —
    // 핀은 화면 곳곳에 있으므로 그건 자주 일어납니다.
    const onControl = !!(event.target as Element).closest("button, a, input");
    touchesRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    // 두 번째 손가락이 얹히면 밀기를 그만두고 오므리기로 넘어갑니다. 한 손가락
    // 밀기를 그대로 두면 두 손이 벌어지는 동안 지도가 한쪽 손만 따라갑니다.
    if (touchesRef.current.size >= 2) {
      dragRef.current = null;
      // 두 손을 다 지도가 받아 둡니다. 핀 위에서 시작한 손가락을 그대로 두면
      // 떼는 순간 그 핀이 눌린 것이 되어, 오므리자마자 영수증이 열립니다.
      for (const id of touchesRef.current.keys()) event.currentTarget.setPointerCapture?.(id);
      pinchRef.current = pinchOf();
      setHovered(null);
      setDragging(true);
      return;
    }

    // 한 손가락이 핀 위에 내려앉은 것은 고르려는 것입니다. 지도를 끌지 않습니다.
    if (onControl) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, view: viewRef.current, tap: true };
    setDragging(true);
  }

  /**
   * 두 손가락으로 오므리고 벌리기.
   *
   * 처음 자리에서 한 번에 셈하지 않고 **직전 프레임과의 차이**만 얹습니다. 그래야
   * 손가락이 하나 더 얹히거나 하나 떨어져도 기준을 다시 잡을 필요 없이 이어집니다.
   * 배율은 거리의 비로, 이동은 가운데의 이동으로 — 두 손 사이의 땅이 손을 따라옵니다.
   */
  function pinchMove() {
    const rect = mapRef.current?.getBoundingClientRect();
    const last = pinchRef.current;
    const now = pinchOf();
    if (!rect || !last || !now || last.distance < 1 || now.distance < 1) return;
    pinchRef.current = now;
    const scaled = scaledAt(viewRef.current, now.distance / last.distance, now.x - rect.left, now.y - rect.top, rect);
    viewRef.current = clampView({ zoom: scaled.zoom, x: scaled.x + (now.x - last.x), y: scaled.y + (now.y - last.y) }, rect.width, rect.height);
    if (outOfSpare()) redrawNow();
    else applyTransform();
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
    const touches = touchesRef.current;
    if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinchRef.current) {
      pinchMove();
      return;
    }

    const drag = dragRef.current;
    const rect = mapRef.current?.getBoundingClientRect();
    if (drag && drag.pointerId === event.pointerId && rect) {
      // 값은 곧바로 반영합니다 — 짚기도 확대도 늘 지금 자리를 봐야 합니다.
      viewRef.current = clampView({ zoom: drag.view.zoom, x: drag.view.x + event.clientX - drag.startX, y: drag.view.y + event.clientY - drag.startY }, rect.width, rect.height);
      if (outOfSpare()) redrawNow();
      else applyTransform();
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
    const touches = touchesRef.current;
    const wasTouching = touches.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);

    // 손이 아직 남아 있으면 손짓이 끝난 게 아닙니다. 남은 하나가 있으면 그 자리에서
    // 밀기를 새로 시작합니다 — 기준을 안 옮기면 손을 하나 떼는 순간 지도가 튑니다.
    if (touches.size >= 2) {
      pinchRef.current = pinchOf();
      return;
    }
    if (touches.size === 1) {
      pinchRef.current = null;
      const [id, spot] = [...touches.entries()][0];
      // 오므리다 손 하나를 뗀 것이므로, 남은 손을 떼도 동네를 짚지는 않습니다.
      dragRef.current = { pointerId: id, startX: spot.x, startY: spot.y, view: viewRef.current, tap: false };
      return;
    }

    const drag = dragRef.current;
    pinchRef.current = null;
    dragRef.current = null;
    if (!wasTouching && !drag) return;
    settle();
    setDragging(false);
    if (!drag) return;

    // 손가락으로는 톡 쳐서 고릅니다. 끌었으면 지도를 옮긴 것이고, 제자리에서
    // 뗐으면 그 동네를 짚은 것입니다. 다른 동네를 치면 그쪽으로 옮겨 가고, 아무
    // 동네도 없는 자리를 치면 꺼집니다 — 같은 곳을 다시 쳤을 때만 다르게 굴면
    // 두 번째 탭이 켜는 건지 끄는 건지 손끝으로는 알 수 없습니다.
    if (event.pointerType === "mouse") return;
    if (!drag.tap) return;
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

  /** 지금 보고 있는 땅의 창문. 축척과 짚기는 이 하나를 봅니다. */
  const window_ = size ? windowOf(view, size) : { x: 0, y: 0, w: 100, h: 100 };
  /**
   * 실제로 **그리는** 창. 보는 창을 사방으로 OVERSCAN 만큼 넓힌 것입니다.
   * 겹 자체도 CSS 에서 같은 만큼 넓게 잡혀 있어(.map__layer), 둘의 비율이 맞습니다.
   */
  const draw = {
    x: window_.x - window_.w * OVERSCAN,
    y: window_.y - window_.h * OVERSCAN,
    w: window_.w * (1 + OVERSCAN * 2),
    h: window_.h * (1 + OVERSCAN * 2),
  };
  const viewBox = `${draw.x} ${draw.y} ${draw.w} ${draw.h}`;

  /**
   * 그릴 칸의 목록. 창을 눈금에 맞춰 끊어 두는 게 요점입니다 — 그대로 쓰면 창이
   * 1px 만 움직여도 새 배열이 나와서, 목록을 떼어 memo 로 묶어 둔 뜻이 없어집니다.
   */
  const step = Math.max(window_.w * TILE_STEP, 0.25);
  const snap = (value: number) => Math.floor(value / step) * step;
  const tile: [number, number, number, number] = [
    snap(window_.x - window_.w * TILE_MARGIN),
    snap(window_.y - window_.h * TILE_MARGIN),
    snap(window_.x + window_.w * (1 + TILE_MARGIN)) + step,
    snap(window_.y + window_.h * (1 + TILE_MARGIN)) + step,
  ];
  const tileKey = `${level}:${tile.join(",")}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pieces = useMemo(() => piecesInView(level, tile), [tileKey]);

  /**
   * 지도 좌표(0..100) → 화면 위의 백분율.
   *
   * 겹을 통째로 확대하지 않으므로, 핀과 이름표는 자기가 설 자리를 직접 셈해서
   * 놓입니다. 되돌리기(scale(1/배율))가 없어져서 글자가 작게 그려졌다 늘어나는
   * 일도 없습니다.
   */
  function toScreen(x: number, y: number) {
    return {
      x: ((x - draw.x) / draw.w) * 100,
      y: ((y - draw.y) / draw.h) * 100,
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
      <div className="map__pan" ref={panRef}>
      <div className="map__layer map__viewport">
        <svg className="map__terrain" viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true">
          <Terrain pieces={pieces} />
        </svg>
      </div>

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
            <MarkerFace icon={saved?.icon ?? null} />
            {saved ? <span className="map-marker__name">{cafe.name}{saved.count > 1 ? <i>+{saved.count - 1}</i> : null}</span> : null}
          </button>;
        })}
      </div>

      </div>
      <div className="map__grain" aria-hidden="true" />

      <div className="map__tools">
        <div className="map__scale" aria-hidden="true"><i /><span>{scaleLabel}</span></div>
        <div className="map__zoom" role="group" aria-label="지도 확대 축소" onPointerDown={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => changeZoom(-1)} disabled={view.zoom <= MIN_ZOOM + 0.01} aria-label="지도 축소"><Minus /></button>
        <output aria-live="polite" aria-label={`지도 확대율 ${Math.round(view.zoom * 100)}퍼센트`}>{Math.round(view.zoom * 100)}%</output>
        <button type="button" onClick={() => changeZoom(1)} disabled={view.zoom >= MAX_ZOOM - 0.01} aria-label="지도 확대"><Plus /></button>
          <button type="button" className="map__zoom-reset" onClick={resetView} disabled={view.zoom <= MIN_ZOOM + 0.01 && view.x === 0 && view.y === 0} aria-label="지도 위치와 확대율 초기화"><RotateCcw /></button>
        </div>
      </div>
    </section>
  );
}