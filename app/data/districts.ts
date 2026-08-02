/**
 * 지도 위 한 점이 어느 행정구역인지 찾고, 그 안의 카페를 셉니다.
 *
 * 경계는 SVG path 로 저장되어 있지만 전부 직선(M/L/Z)이라 브라우저에 물어볼
 * 필요가 없습니다. 한 번 꼭짓점으로 풀어 두고 교차수로 판정합니다 — DOM 을
 * 안 거치니 마우스가 움직일 때마다 불러도 되고, 서버에서도 같은 답이 나옵니다.
 */

import { cafes, type Cafe } from "./cafes";
import { districts as coreDistricts, type District } from "./districts-data";
import { project } from "./geo";

export type DistrictLevel = District["level"];

/** 데이터가 없는 단계로 떨어지지 않게, 가장 큰 칸을 기본으로 둡니다. */
export const BASE_LEVEL: DistrictLevel = 2;

type Loop = readonly (readonly [number, number])[];
/** 네 귀퉁이 [x0, y0, x1, y1]. */
type Bounds = readonly [number, number, number, number];
type Shape = { district: District; tint: number; bounds: Bounds; loops: Loop[] | null };

/** 그림 한 조각. 이름도 라벨도 필요 없는, 그리기만 하는 쪽이 받는 몫입니다. */
export type DistrictPiece = { id: string; path: string; tint: number };

/** "M1 2L3 4ZM…" → 고리들. 섬처럼 떨어진 조각과 구멍이 각각 한 고리입니다. */
function loopsOf(path: string): Loop[] {
  return path
    .split("M")
    .filter((part) => part.trim())
    .map((part) =>
      part
        .replace("Z", "")
        .split("L")
        .map((point) => {
          const [x, y] = point.split(" ");
          return [Number(x), Number(y)] as const;
        }),
    );
}

/**
 * 교차수 판정. 한 점에서 오른쪽으로 반직선을 쏴서 변을 몇 번 지나는지 셉니다.
 * 홀수면 안입니다 — 고리를 전부 한꺼번에 세므로 섬은 안, 구멍은 밖이 됩니다.
 */
function inside(loops: Loop[], x: number, y: number) {
  let crossings = 0;
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i += 1) {
      const [x0, y0] = loop[i];
      const [x1, y1] = loop[(i + 1) % loop.length];
      if (y0 > y !== y1 > y && x < x0 + ((y - y0) / (y1 - y0)) * (x1 - x0)) crossings += 1;
    }
  }
  return crossings % 2 === 1;
}

/**
 * path 문자열을 숫자만 훑어 네 귀퉁이를 냅니다.
 *
 * 고리로 풀어내는 것보다 훨씬 쌉니다 — 꼭짓점마다 배열을 만들지 않고 최소·최대
 * 넷만 들고 갑니다. 화면 밖 칸을 걸러내고 짚을 후보를 좁히는 데는 이 넷이면
 * 충분하고, 읍면동 1,100칸을 전부 고리로 푸는 일(폰에서 150ms 남짓)은 정작
 * 짚어 본 칸에서만 하면 됩니다.
 */
function boundsOf(path: string): Bounds {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let index = 0;
  let readingX = true;
  while (index < path.length) {
    const code = path.charCodeAt(index);
    // 45 = '-', 48..57 = '0'..'9'
    if (code === 45 || (code >= 48 && code <= 57)) {
      let end = index + 1;
      while (end < path.length) {
        const next = path.charCodeAt(end);
        if ((next >= 48 && next <= 57) || next === 46) end += 1;
        else break;
      }
      const value = Number(path.slice(index, end));
      if (readingX) {
        if (value < x0) x0 = value;
        if (value > x1) x1 = value;
      } else {
        if (value < y0) y0 = value;
        if (value > y1) y1 = value;
      }
      readingX = !readingX;
      index = end;
    } else {
      index += 1;
    }
  }
  return [x0, y0, x1, y1];
}

function shapesOf(source: District[]): Shape[] {
  // 옅고 짙은 세 벌을 번갈아 칠하는 순서는 여기서 한 번 정합니다. 그릴 때
  // 자리로 세면 화면 밖 칸을 걸러낸 만큼 번호가 밀려, 밀 때마다 색이 바뀝니다.
  return source.map((district, index) => ({ district, tint: index % 3, bounds: boundsOf(district.path), loops: null }));
}

/** 고리는 정말 필요할 때 — 짚어 볼 때 — 한 번만 풉니다. */
function loopsFor(shape: Shape): Loop[] {
  shape.loops ??= loopsOf(shape.district.path);
  return shape.loops;
}

const byLevel = new Map<DistrictLevel, Shape[]>();
for (const shape of shapesOf(coreDistricts)) {
  const list = byLevel.get(shape.district.level) ?? [];
  list.push(shape);
  byLevel.set(shape.district.level, list);
}

/**
 * 읍면동은 천 칸이 넘어 처음부터 들고 있으면 첫 화면이 무거워집니다. 그 배율에
 * 처음 닿을 때 한 번만 불러옵니다. 오는 동안에는 한 단계 위(시군구)가 그대로
 * 보이므로 지도가 비지 않습니다.
 */
let dongPromise: Promise<void> | null = null;

export function loadDongDistricts(): Promise<void> {
  if (byLevel.has(3)) return Promise.resolve();
  dongPromise ??= import("./districts-dong").then((module) => {
    byLevel.set(3, shapesOf(module.dongDistricts));
  });
  return dongPromise;
}

/** 아직 안 온 단계는 빈 배열입니다 — 부르는 쪽이 한 단계 위로 물러섭니다. */
export function districtsAtLevel(level: DistrictLevel): District[] {
  return (byLevel.get(level) ?? []).map((shape) => shape.district);
}

export function hasLevel(level: DistrictLevel) {
  return byLevel.has(level);
}

/** 0..100 좌표 위의 한 점이 그 단계에서 속한 칸. 바다 위는 null 입니다. */
export function districtAt(x: number, y: number, level: DistrictLevel): District | null {
  for (const shape of byLevel.get(level) ?? []) {
    // 네 귀퉁이 밖이면 안쪽을 볼 것도 없습니다. 천 칸 중 두어 칸만 남습니다.
    const [x0, y0, x1, y1] = shape.bounds;
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    if (inside(loopsFor(shape), x, y)) return shape.district;
  }
  return null;
}

/**
 * 이 창에 걸치는 칸만.
 *
 * 읍면동까지 갈리면 천 칸이 넘는데, 500% 넘게 확대한 화면에 실제로 보이는 건
 * 그중 수십 칸입니다. 나머지를 DOM 에 만들어 두면 만드는 값도 값이거니와,
 * 그 뒤로 확대할 때마다 브라우저가 안 보이는 길까지 훑습니다.
 */
export function piecesInView(level: DistrictLevel, box: Bounds): DistrictPiece[] {
  const [x0, y0, x1, y1] = box;
  const pieces: DistrictPiece[] = [];
  for (const shape of byLevel.get(level) ?? []) {
    const [bx0, by0, bx1, by1] = shape.bounds;
    if (bx1 < x0 || bx0 > x1 || by1 < y0 || by0 > y1) continue;
    pieces.push({ id: shape.district.id, path: shape.district.path, tint: shape.tint });
  }
  return pieces;
}

/**
 * 그 칸 안의 카페.
 *
 * 데이터에 미리 적어 두지 않습니다 — 경계는 통계청에서 오고 카페는 따로 모으는
 * 것이라, 둘을 한 파일에 묶어 두면 한쪽이 바뀔 때마다 다른 쪽을 다시 구워야
 * 합니다. 얹은 칸 하나에 대해서만 세면 되니 그때 세는 편이 쌉니다.
 */
const cafeCache = new Map<string, Cafe[]>();

export function cafesIn(district: District): Cafe[] {
  const cached = cafeCache.get(district.id);
  if (cached) return cached;
  const shape = (byLevel.get(district.level) ?? []).find((entry) => entry.district.id === district.id);
  const loops = shape ? loopsFor(shape) : loopsOf(district.path);
  const found = cafes.filter((cafe) => {
    const spot = project(cafe.pos[0], cafe.pos[1]);
    return inside(loops, spot.x, spot.y);
  });
  cafeCache.set(district.id, found);
  return found;
}
