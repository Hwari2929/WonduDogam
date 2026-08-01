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

type Loop = readonly (readonly [number, number])[];
type Shape = { district: District; loops: Loop[] };

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

function shapesOf(source: District[]): Shape[] {
  return source.map((district) => ({ district, loops: loopsOf(district.path) }));
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
    if (inside(shape.loops, x, y)) return shape.district;
  }
  return null;
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
  const loops = loopsOf(district.path);
  const found = cafes.filter((cafe) => {
    const spot = project(cafe.pos[0], cafe.pos[1]);
    return inside(loops, spot.x, spot.y);
  });
  cafeCache.set(district.id, found);
  return found;
}
