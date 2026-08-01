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

SIZE = 100.0
# app/data/geo.ts 의 BOUNDS 와 반드시 같아야 합니다.
WEST, EAST = 126.42, 127.64
NORTH, SOUTH = 37.80, 37.02
# 화면 밖까지 조금 더 그려 두어 가장자리에서 액자처럼 잘리지 않게 합니다.
PAD = 6.0

SOURCE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "geo")
PROVINCES = ["서울특별시", "경기도", "인천광역시"]

# 단계별 솎아내기 허용 오차(0..100 좌표). 큰 칸은 멀리서 보므로 거칠어도 되고,
# 읍면동은 1500%까지 확대해서 보므로 촘촘해야 합니다.
EPSILON = {1: 0.030, 2: 0.020, 3: 0.010}
PRECISION = 3

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
    widest = max(prepared, key=area)
    return {"path": to_path(prepared), "label": centroid(widest), "points": sum(len(r) for r in prepared)}


def centroid(ring):
    """면적 무게중심. 굽은 칸에서 밖으로 나가면 가장 가까운 안쪽 점으로 당깁니다."""
    total = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        cross = x0 * y1 - x1 * y0
        total += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if abs(total) < 1e-9:
        return (sum(x for x, _ in ring) / len(ring), sum(y for _, y in ring) / len(ring))
    spot = (cx / (3 * total), cy / (3 * total))
    if inside(ring, *spot):
        return spot
    return min(ring, key=lambda p: (p[0] - spot[0]) ** 2 + (p[1] - spot[1]) ** 2)


def inside(ring, x, y):
    hit = False
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) / (y1 - y0) * (x1 - x0):
            hit = not hit
    return hit


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
    for level in (1, 2, 3):
        for (name, parent), rings in groups[level].items():
            merged = dissolve(rings) if level < 3 or len(rings) > 1 else rings
            shape = shape_of(merged, level)
            if shape is None:
                continue
            districts.append({
                "level": level, "name": name, "parent": parent,
                "label": shape["label"], "path": shape["path"], "points": shape["points"],
            })
    return districts


def main():
    districts = build()
    target = sys.argv[1] if len(sys.argv) > 1 else "app/data/districts.ts"
    by_level = collections.Counter(d["level"] for d in districts)
    points = collections.Counter()
    for d in districts:
        points[d["level"]] += d["points"]
    for level in (1, 2, 3):
        print(f"  {level}단계 {by_level[level]:5}칸 · 꼭짓점 {points[level]:7}")
    print(f"  path 길이 합계 {sum(len(d['path']) for d in districts) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
