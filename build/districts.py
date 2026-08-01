"""행정경계 생성기 — app/data/districts.ts 를 만듭니다.

원본은 raqoon886/Local_HangJeongDong 의 읍면동 GeoJSON (통계청 SGIS 기반) 중
서울특별시·경기도·인천광역시 세 벌입니다. 내려받아 build/geo/ 에 두고 돌립니다.

    build/geo/서울특별시.geojson
    build/geo/경기도.geojson
    build/geo/인천광역시.geojson

읍면동만 있고 시군구·시도 경계는 없습니다. 직접 합치되, 다각형 합집합을 계산하는
대신 **변을 세어 지웁니다** — 맞닿은 두 동이 공유하는 변은 정확히 두 번 나오고
바깥 경계는 한 번만 나오므로, 두 번 나온 변을 버리면 남는 것이 합집합의 윤곽입니다.
이 데이터는 이웃한 동이 꼭짓점을 그대로 공유해서 이 방법이 오차 없이 맞습니다
(모든 꼭짓점의 차수가 2 인지 매번 확인합니다).

실행:  python build/districts.py app/data/districts.ts
"""

import collections
import json
import math
import os
import sys

import terrain

SIZE = 100.0
# app/data/geo.ts 의 BOUNDS 와 반드시 같아야 합니다.
WEST, EAST = 126.12, 127.85
NORTH, SOUTH = 37.85, 37.00
# 화면 밖까지 조금 더 그려 두어 가장자리에서 액자처럼 잘리지 않게 합니다.
PAD = 6.0

SOURCE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "geo")
PROVINCES = ["서울특별시", "경기도", "인천광역시"]

# 단계별 솎아내기 허용 오차(0..100 좌표).
#
# 최대 배율 1500%에서 화면 1400px 에 6.67 단위가 들어가므로 1 단위 ≈ 210px 입니다.
# 0.02 는 그 배율에서 4px 어긋난다는 뜻이고, 그보다 촘촘하게 두면 파일만 커집니다.
EPSILON = {1: 0.05, 2: 0.03, 3: 0.02}
PRECISION = 2

# 바다를 가르는 격자. 해안선 자체는 시도 경계에서 정확히 나오므로, 이 격자는
# "어디가 바다이고 어디가 수도권 밖 뭍인가"만 가릅니다.
SEA_GRID = 420

# 시도 이름은 짧게 씁니다 — 이름표에 "서울특별시"라고 적히면 칸보다 글자가 깁니다.
SHORT_SIDO = {"서울특별시": "서울", "경기도": "경기", "인천광역시": "인천"}


def px(lng):
    return (lng - WEST) / (EAST - WEST) * SIZE


def py(lat):
    return (NORTH - lat) / (NORTH - SOUTH) * SIZE


def load_features():
    features = []
    for name in PROVINCES:
        path = os.path.join(SOURCE_DIR, f"{name}.geojson")
        if not os.path.exists(path):
            raise SystemExit(f"{path} 가 없습니다. README 의 내려받기 절차를 보세요.")
        with open(path, encoding="utf-8") as handle:
            features.extend(json.load(handle)["features"])
    return features


def outer_rings(feature):
    """바깥 고리들. 구멍(안쪽 고리)은 이 데이터에 없습니다."""
    geometry = feature["geometry"]
    if geometry is None:
        return []
    polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
    return [polygon[0] for polygon in polygons]


def vertex(point, quantum=1_000_000):
    """꼭짓점을 정수로 못 박습니다. 부동소수 끝자리가 달라 안 맞는 일을 없앱니다."""
    return (round(point[0] * quantum), round(point[1] * quantum))


def dissolve(rings):
    """여러 다각형의 합집합 윤곽. 두 번 나온 변을 지우고 남은 변을 고리로 잇습니다.

    한 꼭짓점에 변이 넷 붙는 자리가 있습니다 (안산시 단원구처럼 좁은 목으로 두
    덩어리가 한 점에서 만나는 곳). 잘못된 데이터가 아니라 실제 모양이라, 차수가
    2 가 아니라고 물리지 않고 안 쓴 변을 하나씩 집어 가며 걷습니다.
    """
    seen = collections.Counter()
    for ring in rings:
        for start, end in zip(ring, ring[1:]):
            a, b = vertex(start), vertex(end)
            if a != b:
                seen[frozenset((a, b))] += 1
    if any(count > 2 for count in seen.values()):
        raise SystemExit("같은 변이 세 번 넘게 나옵니다 — 겹쳐 있는 다각형이 있습니다.")

    border = [tuple(edge) for edge, count in seen.items() if count == 1]
    degree = collections.Counter()
    for a, b in border:
        degree[a] += 1
        degree[b] += 1
    # 홀수 차수는 끊어진 윤곽입니다. 그건 정말로 이상한 데이터라 물러섭니다.
    odd = [point for point, count in degree.items() if count % 2]
    if odd:
        raise SystemExit(f"윤곽이 안 닫힙니다 — 홀수 차수 꼭짓점 {len(odd)}개")

    links = collections.defaultdict(list)
    for index, (a, b) in enumerate(border):
        links[a].append((b, index))
        links[b].append((a, index))

    used = [False] * len(border)
    loops = []
    for seed, (start, second) in enumerate(border):
        if used[seed]:
            continue
        used[seed] = True
        loop, here = [start, second], second
        while here != start:
            step = next(((point, index) for point, index in links[here] if not used[index]), None)
            if step is None:
                raise SystemExit("고리가 끊겼습니다 — 걷다가 갈 곳이 없어졌습니다.")
            here, index = step
            used[index] = True
            if here != start:
                loop.append(here)
        loops.append([(x / 1_000_000, y / 1_000_000) for x, y in loop])
    return loops


def project(ring):
    return [(px(lng), py(lat)) for lng, lat in ring]


def clip(ring, left, top, right, bottom):
    """Sutherland–Hodgman. 화면 밖 좌표는 지우고 테두리를 따라 이어 붙입니다."""
    def cut(points, keep, meet):
        out = []
        for index, point in enumerate(points):
            previous = points[index - 1]
            if keep(point):
                if not keep(previous):
                    out.append(meet(previous, point))
                out.append(point)
            elif keep(previous):
                out.append(meet(previous, point))
        return out

    def lerp(a, b, t):
        return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)

    edges = [
        (lambda p: p[0] >= left, lambda a, b: lerp(a, b, (left - a[0]) / (b[0] - a[0]))),
        (lambda p: p[0] <= right, lambda a, b: lerp(a, b, (right - a[0]) / (b[0] - a[0]))),
        (lambda p: p[1] >= top, lambda a, b: lerp(a, b, (top - a[1]) / (b[1] - a[1]))),
        (lambda p: p[1] <= bottom, lambda a, b: lerp(a, b, (bottom - a[1]) / (b[1] - a[1]))),
    ]
    for keep, meet in edges:
        if not ring:
            return []
        ring = cut(ring, keep, meet)
    return ring


def simplify(points, epsilon):
    """Douglas–Peucker. 닫힌 고리라 가장 먼 두 점을 기준으로 반씩 나눠 돌립니다."""
    if len(points) < 4:
        return points

    def run(chunk):
        if len(chunk) < 3:
            return chunk
        (x0, y0), (x1, y1) = chunk[0], chunk[-1]
        dx, dy = x1 - x0, y1 - y0
        length = math.hypot(dx, dy)
        worst, at = -1.0, 0
        for index in range(1, len(chunk) - 1):
            x, y = chunk[index]
            gap = (abs(dy * x - dx * y + x1 * y0 - y1 * x0) / length) if length else math.hypot(x - x0, y - y0)
            if gap > worst:
                worst, at = gap, index
        if worst <= epsilon:
            return [chunk[0], chunk[-1]]
        return run(chunk[:at + 1])[:-1] + run(chunk[at:])

    start = max(range(len(points)), key=lambda i: (points[i][0] - points[0][0]) ** 2 + (points[i][1] - points[0][1]) ** 2)
    rolled = points[start:] + points[:start]
    half = len(rolled) // 2
    kept = run(rolled[:half + 1])[:-1] + run(rolled[half:])
    return kept


def area(ring):
    total = 0.0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        total += x0 * y1 - x1 * y0
    return abs(total) / 2


def to_path(loops):
    parts = []
    for loop in loops:
        parts.append(f"M{loop[0][0]:.{PRECISION}f} {loop[0][1]:.{PRECISION}f}")
        parts.extend(f"L{x:.{PRECISION}f} {y:.{PRECISION}f}" for x, y in loop[1:])
        parts.append("Z")
    return "".join(parts)


def shape_of(rings, level):
    """원본 고리들 → 화면 좌표의 path 와 이름표 자리. 화면 밖이면 None."""
    prepared = []
    for ring in rings:
        cut = clip(project(ring), -PAD, -PAD, SIZE + PAD, SIZE + PAD)
        if len(cut) < 4:
            continue
        kept = simplify(cut, EPSILON[level])
        if len(kept) >= 4 and area(kept) > 0.0005:
            prepared.append(kept)
    if not prepared:
        return None
    # 내보낼 자릿수로 먼저 반올림한 뒤에 이름표를 정합니다. 반올림 전 좌표로 정하면,
    # 남영동처럼 폭이 0.6 밖에 안 되는 칸에서 반올림이 경계를 이름표 너머로 밀어
    # 실제로 그려진 모양 밖에 이름이 떠 있게 됩니다.
    rounded = []
    for loop in prepared:
        snapped = [(round(x, PRECISION), round(y, PRECISION)) for x, y in loop]
        trimmed = [point for index, point in enumerate(snapped) if point != snapped[index - 1]]
        if len(trimmed) >= 4:
            rounded.append(trimmed)
    if not rounded:
        return None
    return {"path": to_path(rounded), "loops": rounded, "label": centroid(rounded),
            "points": sum(len(r) for r in rounded)}


def centroid(loops):
    """이름표를 놓을 자리. **반드시 구역 안쪽**이어야 합니다.

    조각이 여럿인 칸(섬이나 월경지)은 가장 넓은 조각만 보고 정하면 안 됩니다 —
    그 안에 다른 조각이 겹쳐 있으면 교차수가 짝수가 되어, 넓은 조각 기준으로는
    안이지만 칸 전체로는 밖인 점이 나옵니다. 늘 조각 전부를 함께 셉니다.

    면적 무게중심부터 봅니다. 다만 남영동처럼 굽은 칸은 무게중심이 구역 밖으로
    나갑니다. 그때 "가장 가까운 꼭짓점"으로 당기면 안 됩니다 — 꼭짓점은 경계 위라
    안이 아니고, 이름표가 옆 동네에 걸칩니다. 가로로 훑어 실제로 안이 이어지는
    구간을 찾고 그 가장 넓은 구간의 한가운데를 씁니다.
    """
    widest = max(loops, key=area)
    total = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(widest, widest[1:] + widest[:1]):
        cross = x0 * y1 - x1 * y0
        total += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if abs(total) > 1e-9:
        spot = (cx / (3 * total), cy / (3 * total))
        if inside_any(loops, *spot):
            return spot

    lows = [p[1] for p in widest]
    best = None
    for step in range(1, 60):
        y = min(lows) + (max(lows) - min(lows)) * step / 60
        crossings = sorted(
            x0 + (y - y0) / (y1 - y0) * (x1 - x0)
            for loop in loops
            for (x0, y0), (x1, y1) in zip(loop, loop[1:] + loop[:1])
            if (y0 > y) != (y1 > y)
        )
        for left, right in zip(crossings[::2], crossings[1::2]):
            if best is None or right - left > best[0]:
                best = (right - left, ((left + right) / 2, y))
    if best is None:
        raise SystemExit("이름표를 놓을 안쪽 자리를 못 찾았습니다.")
    return best[1]


def inside_any(loops, x, y):
    """조각 전부를 한꺼번에 센 교차수. 섬은 안, 구멍은 밖이 됩니다."""
    hit = False
    for loop in loops:
        for (x0, y0), (x1, y1) in zip(loop, loop[1:] + loop[:1]):
            if (y0 > y) != (y1 > y) and x < x0 + (y - y0) / (y1 - y0) * (x1 - x0):
                hit = not hit
    return hit


def inside(ring, x, y):
    hit = False
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) / (y1 - y0) * (x1 - x0):
            hit = not hit
    return hit


def outside_loops(land_loops):
    """수도권도 바다도 아닌 자리 — 창 동쪽·남쪽 끝에 걸친 강원·충청 땅입니다.

    바다는 "창 사각형에서 뭍을 도려낸 것"으로 그립니다. 그러면 데이터가 없는 이
    자리까지 물이 되어, 남동쪽에 없는 바다가 생깁니다. 서쪽 가장자리에서 물을
    채워 보고 안 닿는 자리를 따로 뽑아 뭍 색으로 덮습니다.

    이 윤곽은 거칠어도 됩니다 — 한쪽은 경기 경계와 맞닿고 나머지는 창 밖이라,
    실제로 보이는 선이 아닙니다. 오히려 한 칸 부풀려 경계와 겹치게 두어야 두 면
    사이에 물 색 실금이 안 남습니다.
    """
    span = SIZE + 2 * PAD
    step = span / SEA_GRID
    land = [[False] * SEA_GRID for _ in range(SEA_GRID)]
    for loop in land_loops:
        lows = [p[1] for p in loop]
        j0 = max(0, int((min(lows) + PAD) / step))
        j1 = min(SEA_GRID - 1, int((max(lows) + PAD) / step))
        for j in range(j0, j1 + 1):
            y = -PAD + (j + 0.5) * step
            crossings = []
            for (x0, y0), (x1, y1) in zip(loop, loop[1:] + loop[:1]):
                if (y0 > y) != (y1 > y):
                    crossings.append(x0 + (y - y0) / (y1 - y0) * (x1 - x0))
            crossings.sort()
            for left, right in zip(crossings[::2], crossings[1::2]):
                i0 = max(0, int((left + PAD) / step))
                i1 = min(SEA_GRID - 1, int((right + PAD) / step))
                for i in range(i0, i1 + 1):
                    land[j][i] = True

    sea = [[False] * SEA_GRID for _ in range(SEA_GRID)]
    stack = [(0, j) for j in range(SEA_GRID) if not land[j][0]]
    for i, j in stack:
        sea[j][i] = True
    while stack:
        i, j = stack.pop()
        for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            x, y = i + di, j + dj
            if 0 <= x < SEA_GRID and 0 <= y < SEA_GRID and not land[y][x] and not sea[y][x]:
                sea[y][x] = True
                stack.append((x, y))

    mask = [[not land[j][i] and not sea[j][i] for i in range(SEA_GRID)] for j in range(SEA_GRID)]
    # 한 칸 부풀려 뭍과 겹치게 합니다.
    grown = [row[:] for row in mask]
    for j in range(SEA_GRID):
        for i in range(SEA_GRID):
            if not mask[j][i]:
                continue
            for dj in (-1, 0, 1):
                for di in (-1, 0, 1):
                    if 0 <= i + di < SEA_GRID and 0 <= j + dj < SEA_GRID:
                        grown[j + dj][i + di] = True

    loops = []
    for loop in terrain.trace_loops(grown, SEA_GRID, SEA_GRID):
        if len(loop) < 12:
            continue
        points = [(-PAD + gx * step, -PAD + gy * step) for gx, gy in loop]
        points = simplify(terrain.chaikin(points, 2), EPSILON[1])
        if len(points) >= 4:
            loops.append(points)
    return loops


def build():
    features = load_features()
    # 시군구 이름은 원본이 "성남시분당구" 처럼 붙여 씁니다. 주소와 맞추려면 띄웁니다.
    def sgg_name(properties):
        name = properties["sggnm"]
        for suffix in ("시", "군"):
            head = name.find(suffix)
            if 0 < head < len(name) - 1 and name.endswith("구"):
                return f"{name[:head + 1]} {name[head + 1:]}"
        return name

    groups = {1: collections.defaultdict(list), 2: collections.defaultdict(list), 3: collections.defaultdict(list)}
    for feature in features:
        properties = feature["properties"]
        sido = SHORT_SIDO[properties["sidonm"]]
        sgg = sgg_name(properties)
        dong = properties["adm_nm"].split()[-1]
        rings = outer_rings(feature)
        groups[1][(sido, "")].extend(rings)
        groups[2][(sgg, sido)].extend(rings)
        groups[3][(dong, sgg)].extend(rings)

    districts = []
    land_loops = []
    for level in (1, 2, 3):
        for (name, parent), rings in groups[level].items():
            merged = dissolve(rings) if level < 3 or len(rings) > 1 else rings
            shape = shape_of(merged, level)
            if shape is None:
                continue
            if level == 1:
                land_loops.extend(shape["loops"])
            districts.append({
                "level": level, "name": name, "parent": parent,
                "label": shape["label"], "path": shape["path"], "points": shape["points"],
            })

    # 바다는 창 사각형에서 뭍을 도려낸 것입니다 (fill-rule: evenodd).
    frame = [(-PAD, -PAD), (SIZE + PAD, -PAD), (SIZE + PAD, SIZE + PAD), (-PAD, SIZE + PAD)]
    sea = to_path([frame] + land_loops)
    outside = to_path(outside_loops(land_loops))
    return districts, sea, outside


HEADER = """/* 자동 생성 — 손으로 고치지 마세요.
 * 다시 만들려면:  python build/districts.py
 * 원본과 만드는 방식은 build/districts.py 의 설명을 보세요.
 *
 * 좌표계는 0..100 이고 카페 핀의 % 좌표와 같은 공간입니다 (app/data/geo.ts 의 BOUNDS).
 */
"""

TYPE = """
/**
 * 행정구역 한 칸. 통계청 읍면동 경계에서 나온 실제 경계입니다.
 *
 * 세 단계가 있고 배율에 따라 골라 씁니다. 시군구·시도는 읍면동을 합쳐 만들었으므로
 * 단계가 바뀌어도 바깥 윤곽은 한 획도 어긋나지 않고 안쪽 선만 생깁니다.
 */
export type District = {
  /** 단계와 윗동네까지 붙인 이름. 서울 중구와 인천 중구가 있어 이름만으로는 안 갈립니다. */
  id: string;
  /** 1 = 시도 · 2 = 시군구 · 3 = 읍면동 */
  level: 1 | 2 | 3;
  name: string;
  /** 한 단계 위의 이름. 1단계는 위가 없어 빈 문자열입니다. */
  parent: string;
  /** 이름표를 놓을 자리. 구역 안쪽입니다. */
  label: [number, number];
  /** 섬처럼 떨어진 조각이 있으면 서브패스로 이어 붙습니다. */
  path: string;
};
"""


def literal(entries):
    lines = []
    for entry in entries:
        district_id = f'{entry["level"]} {entry["parent"]} {entry["name"]}'.replace("  ", " ").strip()
        lines.append(
            f'  {{ id: "{district_id}", level: {entry["level"]}, name: "{entry["name"]}", '
            f'parent: "{entry["parent"]}", '
            f'label: [{entry["label"][0]:.2f}, {entry["label"][1]:.2f}], '
            f'path: "{entry["path"]}" }},\n'
        )
    return "[\n" + "".join(lines) + "]"


def main():
    districts, sea, outside = build()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    core = [d for d in districts if d["level"] < 3]
    dong = [d for d in districts if d["level"] == 3]

    core_path = os.path.join(root, "app", "data", "districts-data.ts")
    with open(core_path, "w", encoding="utf-8") as handle:
        handle.write(HEADER + TYPE + f"""
/** 시도·시군구. 처음부터 들고 있습니다 — 지도를 열면 바로 보이는 선입니다. */
export const districts: District[] = {literal(core)};

/** 서해. 창에서 뭍을 도려낸 모양이라 fill-rule: evenodd 로 칠합니다. */
export const sea = "{sea}";

/** 수도권도 바다도 아닌 자리 (강원·충청 언저리). 물색이 번지지 않게 뭍 색으로 덮습니다. */
export const outside = "{outside}";
""")

    dong_path = os.path.join(root, "app", "data", "districts-dong.ts")
    dong_note = (
        "\nimport type { District } from \"./districts-data\";\n\n"
        "/**\n"
        " * 읍면동. 천 칸이 넘어 처음부터 들고 있으면 첫 화면이 무거워집니다. 지도가\n"
        " * 읍면동까지 갈리는 배율에 처음 닿을 때 따로 불러옵니다.\n"
        " */\n"
        "export const dongDistricts: District[] = "
    )
    with open(dong_path, "w", encoding="utf-8") as handle:
        handle.write(HEADER + dong_note + literal(dong) + ";\n")

    for path in (core_path, dong_path):
        print(f"  {os.path.relpath(path, root)}  {os.path.getsize(path) / 1024:.0f} KB")
    counted = collections.Counter(d["level"] for d in districts)
    print(f"  1단계 {counted[1]}칸 · 2단계 {counted[2]}칸 · 3단계 {counted[3]}칸")


if __name__ == "__main__":
    main()
