/**
 * 지도 위 한 점이 어느 시·구인지 찾습니다.
 *
 * 경계는 SVG path 로 저장되어 있지만 전부 직선(M/L/Z)이라 브라우저에 물어볼
 * 필요가 없습니다. 한 번 꼭짓점으로 풀어 두고 교차수로 판정합니다 — DOM 을
 * 안 거치니 마우스가 움직일 때마다 불러도 되고, 서버에서도 같은 답이 나옵니다.
 */

import { districts, type District } from "./terrain";

type Loop = readonly (readonly [number, number])[];

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

const shapes: { district: District; loops: Loop[] }[] = districts
  .filter((district) => district.name)
  .map((district) => ({ district, loops: loopsOf(district.path) }));

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

/** 0..100 좌표 위의 한 점이 속한 시·구. 채움 칸과 바다 위는 null 입니다. */
export function districtAt(x: number, y: number): District | null {
  for (const shape of shapes) {
    if (inside(shape.loops, x, y)) return shape.district;
  }
  return null;
}

/** 이름이 붙어 집어들 수 있는 칸만. 그리는 순서도 이 순서를 씁니다. */
export const namedDistricts = shapes.map((shape) => shape.district);
