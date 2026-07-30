"""수도권 지형 목업 생성기 — app/data/terrain.ts 를 만듭니다.

카카오맵 SDK는 04_착수_검증의 데이터 사용 승낙이 풀린 뒤에 붙습니다. 그 전까지
지도 자리가 비어 있으면 "지도 위 UI"인지 판단할 수 없어서 골격만 그려 둡니다.

손으로 쓴 다각형이 지도로 안 읽히는 이유는 단순합니다 — 실제 해안선과 행정경계는
프랙탈이라 꼭짓점이 수백 개인데, 손으로 쓰면 여덟 개짜리 타원이 됩니다. 그래서
경계를 직접 그리지 않고 **격자에서 영역을 키운 뒤 윤곽을 추출**합니다.

  1. 잡음을 섞은 거리장으로 땅/바다를 가른다        → 들쭉날쭉한 해안선
  2. 잡음을 섞은 보로노이로 시군구를 나눈다          → 이웃과 변을 공유하는 경계
  3. 한강 남/북을 건너면 벌점 → 경계가 강을 따라간다
  4. 계단 모양 윤곽을 Chaikin 으로 부드럽게, D-P 로 솎아낸다

시드가 고정이라 돌릴 때마다 같은 지형이 나옵니다.

실행:  node 없이 파이썬만 있으면 됩니다.
       python build/terrain.py app/data/terrain.ts
"""

import math
import os
import random
import re
import sys

SIZE = 100.0          # SVG 사용자 좌표. 마커의 % 좌표와 같은 공간입니다.

# app/data/geo.ts 의 BOUNDS 와 반드시 같아야 합니다. 여기서 어긋나면 카페 마커가
# 강 위에 떠 있거나 바다에 빠집니다.
WEST, EAST = 126.42, 127.64
NORTH, SOUTH = 37.80, 37.02


def px(lng):
    return (lng - WEST) / (EAST - WEST) * SIZE


def py(lat):
    return (NORTH - lat) / (NORTH - SOUTH) * SIZE


def P(lng, lat):
    """경위도를 SVG 좌표로. 지형도 카페와 같은 식을 씁니다."""
    return (px(lng), py(lat))

PAD = 9.0             # viewBox 바깥까지 만듭니다. 격자 끝을 따라 생기는 직선
                      # 경계가 화면 밖으로 밀려나 액자 같은 테두리가 안 남습니다.
GRID = 300            # 격자 해상도. 높을수록 경계가 세밀해지고 파일이 커집니다.
SEED = 20260727
EPSILON = 0.19        # Douglas-Peucker 허용 오차 (사용자 좌표).
                      # 격자 한 칸(≈0.39)보다 작아야 작은 구가 각지지 않습니다.


# ── 잡음 ──────────────────────────────────────────────────────────────

class Noise:
    """주기 경계가 매끄러운 밸류 노이즈. 격자 잡음이라 가볍고 재현됩니다."""

    def __init__(self, rng, octaves=((4, 0.5), (8, 0.3), (16, 0.15), (32, 0.08))):
        self.octaves = [(freq, weight, [[rng.random() for _ in range(freq)] for _ in range(freq)])
                        for freq, weight in octaves]
        self.total = sum(weight for _, weight, _ in self.octaves)

    @staticmethod
    def _smooth(t):
        return t * t * (3 - 2 * t)

    def __call__(self, x, y):
        """x, y 는 0..SIZE. 결과는 대략 -1..1."""
        acc = 0.0
        for freq, weight, grid in self.octaves:
            fx, fy = x * freq / SIZE, y * freq / SIZE
            x0, y0 = int(fx) % freq, int(fy) % freq
            x1, y1 = (x0 + 1) % freq, (y0 + 1) % freq
            tx, ty = self._smooth(fx % 1.0), self._smooth(fy % 1.0)
            top = grid[y0][x0] * (1 - tx) + grid[y0][x1] * tx
            bottom = grid[y1][x0] * (1 - tx) + grid[y1][x1] * tx
            acc += weight * (top * (1 - ty) + bottom * ty)
        return (acc / self.total) * 2.0 - 1.0


# ── 한강 ──────────────────────────────────────────────────────────────

# 동쪽에서 들어와 김포 쪽 하구로 빠집니다. (x, y, 반폭)
# 굽이가 얕으면 강이 아니라 가로줄로 보입니다. 진폭을 5 이상 줍니다.
# 양 끝은 viewBox 밖까지 빼서 화면에서 잘리게 둡니다 — 하구가 바다와 이어집니다.
# 한강 — 팔당에서 서울을 지나 김포·강화 쪽 하구로. (경도, 위도, 반폭)
# 실제로는 서쪽으로 갈수록 북서로 휘어 올라갑니다.
RIVER_LL = [
    (127.52, 37.510, 0.42), (127.38, 37.545, 0.46), (127.24, 37.520, 0.52),
    (127.12, 37.535, 0.58), (127.02, 37.518, 0.64), (126.96, 37.545, 0.70),
    (126.90, 37.560, 0.78), (126.83, 37.580, 0.88), (126.75, 37.596, 1.05),
    (126.68, 37.610, 1.30), (126.60, 37.632, 1.70), (126.52, 37.660, 2.20),
    (126.42, 37.690, 2.90), (126.30, 37.720, 3.60),
]
RIVER = [(px(lng), py(lat), w) for lng, lat, w in RIVER_LL]

# 지천 — (점들, 시작 반폭, 끝 반폭). 마지막 점의 y 는 무시하고 한강 중심선에
# 살짝 얹도록 아래에서 다시 계산합니다. 강 위에서 멈추면 합류가 아니라 강 옆에
# 놓인 올챙이가 되고, 많이 지나치면 강을 뚫고 나온 막대가 됩니다.
TRIBUTARY_OVERLAP = 0.35

TRIBUTARIES_LL = [
    # 중랑천 — 의정부에서 내려와 성수 부근에서 합류
    ([(127.06, 37.74), (127.05, 37.68), (127.04, 37.62), (127.05, 37.57), (127.04, 0.0)], 0.07, 0.26),
    # 탄천 — 용인·성남에서 북으로 올라와 잠실 부근에서 합류
    ([(127.14, 37.30), (127.12, 37.37), (127.10, 37.44), (127.08, 37.50), (127.07, 0.0)], 0.06, 0.24),
    # 안양천 — 안양에서 북으로 올라와 목동 부근에서 합류
    ([(126.92, 37.36), (126.90, 37.43), (126.89, 37.49), (126.88, 0.0)], 0.06, 0.24),
    # 임진강 — 북서쪽 경계
    ([(126.78, 37.98), (126.72, 37.88), (126.66, 37.80), (126.62, 37.74), (126.58, 0.0)], 0.08, 0.3),
]
TRIBUTARIES = [([P(*pt) if pt[1] else (px(pt[0]), 0.0) for pt in pts], w0, w1)
               for pts, w0, w1 in TRIBUTARIES_LL]

# 서해의 섬 (강화·영종·덕적 등). 해안선만으로는 바다로 안 읽히는데,
# 섬 몇 개가 들어가면 단번에 바다가 됩니다. (경도, 위도, 반지름)
ISLANDS_LL = [
    (126.46, 37.72, 3.6), (126.50, 37.48, 2.8), (126.38, 37.30, 2.2),
    (126.55, 37.20, 1.9), (126.42, 37.58, 1.6),
]
ISLANDS = [(px(lng), py(lat), r) for lng, lat, r in ISLANDS_LL]

# 서해안 (본토). 북에서 남으로. 강화도는 위 ISLANDS 로 따로 둡니다.
COAST_LL = [
    (126.55, 37.85), (126.58, 37.72), (126.55, 37.60), (126.58, 37.50),
    (126.60, 37.42), (126.68, 37.34), (126.70, 37.24), (126.78, 37.14),
    (126.88, 37.05),
]

CAFE_SOURCE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                           "app", "data", "cafes.ts")
CAFE_PATTERN = re.compile(
    r'id:\s*"(?P<id>[^"]+)".*?name:\s*"(?P<name>[^"]+)".*?'
    r'address:\s*"(?P<address>[^"]+)".*?pos:\s*\[(?P<lng>[-\d.]+),\s*(?P<lat>[-\d.]+)\]'
)


def load_cafes(path=CAFE_SOURCE):
    """카페 목록을 원본 파일에서 그대로 읽습니다.

    좌표를 여기에 베껴 두면 카페가 하나 늘 때마다 두 곳을 고쳐야 하고, 잊으면
    지형은 옛날 카페를 기준으로 만들어집니다. 한쪽만 원본으로 둡니다.
    """
    with open(path, encoding="utf-8") as handle:
        source = handle.read()
    cafes = [
        (m["id"], m["name"], m["address"], float(m["lng"]), float(m["lat"]))
        for m in CAFE_PATTERN.finditer(source)
    ]
    if not cafes:
        raise SystemExit(f"{path} 에서 카페를 하나도 읽지 못했습니다.")
    return cafes


def district_of(address):
    """주소 → 이 지도가 한 칸으로 다루는 시·구.

    "서울 마포구 …"      → 서울, 마포구
    "경기 성남시 분당구 …" → 경기, 성남시 분당구
    "경기 파주시 …"       → 경기, 파주시
    """
    tokens = address.split()
    parts = []
    for token in tokens[1:]:
        if token[-1] not in "시군구":
            break
        parts.append(token)
    if not parts:
        raise SystemExit(f"시·구를 못 읽었습니다: {address}")
    return tokens[0], " ".join(parts)


def river_y(x):
    """주어진 x 에서 한강의 중심 y. 남/북 판정에 씁니다."""
    pts = RIVER
    if x >= pts[0][0]:
        return pts[0][1]
    if x <= pts[-1][0]:
        return pts[-1][1]
    for (x0, y0, _), (x1, y1, _) in zip(pts, pts[1:]):
        if x1 <= x <= x0:
            t = (x - x0) / (x1 - x0)
            return y0 + (y1 - y0) * t
    return pts[-1][1]


def ribbon(points, half_widths):
    """중심선 + 반폭 → 닫힌 다각형. 강을 선이 아니라 면으로 그려야 하구가 넓어집니다."""
    left, right = [], []
    for i, (x, y) in enumerate(points):
        if i == 0:
            dx, dy = points[1][0] - x, points[1][1] - y
        elif i == len(points) - 1:
            dx, dy = x - points[-2][0], y - points[-2][1]
        else:
            dx, dy = points[i + 1][0] - points[i - 1][0], points[i + 1][1] - points[i - 1][1]
        length = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / length, dx / length
        half = half_widths[i]
        left.append((x + nx * half, y + ny * half))
        right.append((x - nx * half, y - ny * half))
    return left + right[::-1]


# ── 도시 씨앗 ─────────────────────────────────────────────────────────

# 씨앗은 카페 주소에서 나옵니다. 카페 하나가 씨앗 하나가 되고, 같은 시·구의 칸을
# 나중에 합칩니다. 그래야 마우스를 올렸을 때 강조되는 경계 안에 그 동네의 카페가
# 반드시 들어 있습니다 — 경계를 따로 그려 두면 언젠가 어긋납니다.
#
# 가중치는 거리를 나누는 값이라 클수록 구역이 넓어집니다. 크기가 고르면 벌집이
# 됩니다 — 실제 수도권은 가운데가 잘게 쪼개져 있고 바깥으로 갈수록 덩어리가
# 커집니다. 그 대비가 지도로 읽히게 하는 핵심입니다.
#
# 거리에서 빼지 않고 나누는 이유: 빼면 큰 구역이 먼 곳에서도 일정 거리만큼
# 밀고 들어와서, 촘촘한 서울 한복판까지 광명시가 삼킵니다. 나누면 씨앗 바로
# 옆에서는 거리가 0에 가까워 아무도 못 이깁니다.
SEOUL_W = 1.05
INNER_W = 1.20
OUTER_W = 1.60

# 잡음 진폭(사용자 좌표)과, 씨앗 가까이에서 잡음을 죽이는 반경.
#
# 반경이 진폭보다 커야 합니다. 잡음은 씨앗에서 멀어질수록 거리에 비례해 살아나므로
# 반경 > 진폭이면 어떤 잡음도 거리를 음수로 못 만들고, 그래서 씨앗은 언제나 제
# 구역 안에 남습니다 — 카페가 자기 동네 밖으로 밀려나지 않는다는 보장이 여기서
# 나옵니다. 뒤집히면 씨앗 바로 위에 남의 구역이 얼룩처럼 뜹니다.
REGION_NOISE = 3.4
NOISE_CALM = 4.0


def district_weight(sido, name):
    """서울의 구가 가장 잘고, 큰 시의 구가 그다음, 시 하나가 통째면 가장 큽니다."""
    if sido == "서울":
        return SEOUL_W
    if sido == "인천" or name.endswith("구"):
        return INNER_W
    return OUTER_W


def build_sites(cafes):
    """씨앗은 시·구 하나가 아니라 **카페 하나**입니다.

    시·구의 한가운데에 씨앗을 하나만 두면, 목업 데이터처럼 연남동(마포구)과
    연희동(서대문구)이 붙어 있는 곳에서 카페가 옆 구의 칸에 떨어집니다. 카페마다
    씨앗을 두고 같은 시·구끼리 칸을 합치면, 모든 카페가 제 구역 안에 있는 것이
    바라는 일이 아니라 만들어지는 성질이 됩니다.

    (구역, 그 구역에 속한 씨앗들) 순서로 돌려줍니다.
    """
    districts, sites = [], []
    index_of = {}
    for cafe_id, _, address, lng, lat in cafes:
        sido, name = district_of(address)
        key = (sido, name)
        if key not in index_of:
            index_of[key] = len(districts)
            districts.append({"sido": sido, "name": name, "cafe_ids": []})
        districts[index_of[key]]["cafe_ids"].append(cafe_id)
        sites.append({"x": px(lng), "y": py(lat), "district": index_of[key]})

    # 칸 넓이는 그 구에 카페가 몇 곳 있느냐가 아니라 어떤 구냐로 정해져야 합니다.
    # 씨앗마다 같은 가중치를 주면 카페 여덟 곳인 마포구가 두 곳인 서대문구를 밀어내
    # 서대문구가 아예 사라집니다. 곱셈 보로노이에서 칸 반지름은 가중치에 비례하므로,
    # 넓이(반지름²×개수)를 맞추려면 √개수로 나눕니다. 두 곳이 보통이라 기준으로 둡니다.
    for site in sites:
        entry = districts[site["district"]]
        count = len(entry["cafe_ids"])
        site["weight"] = district_weight(entry["sido"], entry["name"]) * math.sqrt(2.0 / count)

    # 이름 없는 채움 씨앗. 카페가 한 곳도 없는 자리까지 실제 시·구가 삼키면
    # 강조된 경계가 그 동네와 상관없는 땅까지 덮습니다. 화면 밖 씨앗은 가장자리
    # 구역이 액자를 따라 잘린 것처럼 보이지 않게 합니다.
    for lng, lat in [
        (126.55, 37.72), (126.62, 37.62), (127.42, 37.72), (127.45, 37.45),
        (127.40, 37.20), (126.95, 37.02), (127.55, 37.80), (127.55, 37.10),
        (126.60, 37.00), (127.30, 37.92),
    ]:
        districts.append({"sido": "", "name": "", "cafe_ids": []})
        sites.append({"x": px(lng), "y": py(lat), "weight": OUTER_W,
                      "district": len(districts) - 1})
    return districts, sites

# 도로망은 도시 사이만 잇습니다. 서울 구 씨앗까지 전부 이으면 가운데가 거미줄이 됩니다.
ROAD_NODES_LL = [
    (126.83, 37.66), (126.76, 37.76), (127.05, 37.79), (127.21, 37.74),
    (126.96, 37.55), (127.10, 37.55), (126.90, 37.58),
    (127.22, 37.64), (127.35, 37.55), (126.72, 37.60), (126.77, 37.50), (126.63, 37.46),
    (126.95, 37.48), (127.11, 37.49), (126.90, 37.42), (127.13, 37.41),
    (127.03, 37.26), (127.20, 37.30), (126.83, 37.32), (127.38, 37.36),
]
ROAD_NODES = [P(lng, lat) for lng, lat in ROAD_NODES_LL]


# ── 격자 → 윤곽 ───────────────────────────────────────────────────────

def trace_loops(mask, width, height):
    """참/거짓 격자의 경계를 닫힌 고리들로. 격자 칸 모서리를 따라가므로 계단 모양입니다."""
    edges = {}

    def add(a, b):
        edges.setdefault(a, []).append(b)

    for j in range(height):
        row = mask[j]
        for i in range(width):
            if not row[i]:
                continue
            # 바깥쪽 이웃과 맞닿은 변만 경계입니다. 방향을 맞춰 넣어야 고리가 이어집니다.
            if i == 0 or not row[i - 1]:
                add((i, j + 1), (i, j))
            if i == width - 1 or not row[i + 1]:
                add((i + 1, j), (i + 1, j + 1))
            if j == 0 or not mask[j - 1][i]:
                add((i, j), (i + 1, j))
            if j == height - 1 or not mask[j + 1][i]:
                add((i + 1, j + 1), (i, j + 1))

    loops = []
    while edges:
        start = next(iter(edges))
        loop = [start]
        node = start
        while True:
            outgoing = edges.get(node)
            if not outgoing:
                break
            nxt = outgoing.pop()
            if not outgoing:
                del edges[node]
            if nxt == start:
                break
            loop.append(nxt)
            node = nxt
        if len(loop) > 8:
            loops.append(loop)
    return loops


def chaikin(points, iterations=3):
    """계단을 깎아 유기적인 곡선으로. 자를수록 부드럽지만 디테일이 줄어듭니다."""
    for _ in range(iterations):
        out = []
        count = len(points)
        for i in range(count):
            (x0, y0), (x1, y1) = points[i], points[(i + 1) % count]
            out.append((0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1))
            out.append((0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1))
        points = out
    return points


def simplify(points, epsilon):
    """Douglas-Peucker. 눈에 안 보이는 꼭짓점을 빼서 파일 크기를 줍니다."""
    if len(points) < 3:
        return points

    def run(chunk):
        if len(chunk) < 3:
            return chunk
        (x0, y0), (x1, y1) = chunk[0], chunk[-1]
        dx, dy = x1 - x0, y1 - y0
        span = math.hypot(dx, dy)
        worst, index = 0.0, 0
        for i in range(1, len(chunk) - 1):
            x, y = chunk[i]
            if span == 0:
                dist = math.hypot(x - x0, y - y0)
            else:
                dist = abs(dy * x - dx * y + x1 * y0 - y1 * x0) / span
            if dist > worst:
                worst, index = dist, i
        if worst <= epsilon:
            return [chunk[0], chunk[-1]]
        return run(chunk[:index + 1])[:-1] + run(chunk[index:])

    closed = points + [points[0]]
    return run(closed)[:-1]


def to_path(points, closed=True, precision=2):
    if not points:
        return ""
    parts = [f"M{points[0][0]:.{precision}f} {points[0][1]:.{precision}f}"]
    for x, y in points[1:]:
        parts.append(f"L{x:.{precision}f} {y:.{precision}f}")
    if closed:
        parts.append("Z")
    return "".join(parts)


def smooth_path(points, precision=2):
    """열린 폴리라인을 Catmull-Rom 느낌의 베지어로. 도로와 지천에 씁니다."""
    if len(points) < 3:
        return to_path(points, closed=False, precision=precision)
    out = [f"M{points[0][0]:.{precision}f} {points[0][1]:.{precision}f}"]
    for i in range(len(points) - 1):
        p0 = points[max(i - 1, 0)]
        p1, p2 = points[i], points[i + 1]
        p3 = points[min(i + 2, len(points) - 1)]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        out.append(
            f"C{c1[0]:.{precision}f} {c1[1]:.{precision}f} {c2[0]:.{precision}f} "
            f"{c2[1]:.{precision}f} {p2[0]:.{precision}f} {p2[1]:.{precision}f}"
        )
    return "".join(out)


# ── 생성 ──────────────────────────────────────────────────────────────

def smooth_closed_path(points, precision=2):
    """닫힌 폴리라인을 Catmull-Rom 베지어로. 강을 각진 띠가 아니라 물줄기로 만듭니다."""
    count = len(points)
    if count < 4:
        return to_path(points, precision=precision)
    out = [f"M{points[0][0]:.{precision}f} {points[0][1]:.{precision}f}"]
    for i in range(count):
        p0, p1 = points[(i - 1) % count], points[i]
        p2, p3 = points[(i + 1) % count], points[(i + 2) % count]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        out.append(
            f"C{c1[0]:.{precision}f} {c1[1]:.{precision}f} {c2[0]:.{precision}f} "
            f"{c2[1]:.{precision}f} {p2[0]:.{precision}f} {p2[1]:.{precision}f}"
        )
    return "".join(out) + "Z"


def build():
    rng = random.Random(SEED)
    coast_noise = Noise(rng, ((3, 0.5), (7, 0.28), (15, 0.14), (31, 0.08)))
    region_noise = Noise(rng, ((5, 0.5), (11, 0.3), (23, 0.2)))
    road_noise = Noise(rng, ((4, 0.6), (9, 0.4)))

    span = SIZE + 2 * PAD
    step = span / GRID
    center = [-PAD + (i + 0.5) * step for i in range(GRID)]

    # 서해안 기준선. 실제 경기만은 남쪽으로 내려갈수록 크게 열립니다.
    coast_nodes = sorted((py(lat), px(lng)) for lng, lat in COAST_LL)

    def coast_x(y):
        """주어진 위도(투영 y)에서 해안의 x. 실제 해안점들을 선형 보간합니다."""
        if y <= coast_nodes[0][0]:
            return coast_nodes[0][1]
        if y >= coast_nodes[-1][0]:
            return coast_nodes[-1][1]
        for (y0, x0), (y1, x1) in zip(coast_nodes, coast_nodes[1:]):
            if y0 <= y <= y1:
                t = 0.0 if y1 == y0 else (y - y0) / (y1 - y0)
                return x0 + (x1 - x0) * t
        return coast_nodes[-1][1]

    # 1) 땅/바다 — 해안 가까이에서만 잡음을 세게 먹여 내륙에 구멍이 안 나게 합니다.
    def landness(x, y):
        base = coast_x(y)
        # 잡음은 해안 가까이에서만 세게 먹입니다. 진폭이 크면 항구 카페가 바다에 빠집니다.
        falloff = math.exp(-max(0.0, x - base) / 6.0)
        value = (x - base) + coast_noise(x, y) * 3.2 * falloff
        for ix, iy, radius in ISLANDS:
            value = max(value, radius - math.hypot(x - ix, y - iy) + coast_noise(x * 2, y * 2) * 0.9)
        return value

    land = [[landness(x, y) > 0 for x in center] for y in center]
    sea_mask = [[not cell for cell in row] for row in land]

    cafes = load_cafes()
    district_list, sites = build_sites(cafes)

    stranded = [name for _, name, _, lng, lat in cafes if landness(px(lng), py(lat)) <= 0]
    if stranded:
        raise SystemExit(f"바다에 빠진 카페: {', '.join(stranded)} — 해안선이나 좌표를 조정하세요.")

    # 2) 시군구 — 가중치 보로노이에 잡음을 섞습니다. 가중치가 크기 대비를 만들고,
    #    잡음이 직선 경계를 무너뜨리고, 한강 벌점이 경계를 강에 붙입니다.
    site_side = [1 if site["y"] > river_y(site["x"]) else -1 for site in sites]
    site_jitter = [rng.uniform(0, 100) for _ in sites]

    def district_at(x, y):
        side_here = 1 if y > river_y(x) else -1
        best, best_index = 1e9, -1
        for k, site in enumerate(sites):
            distance = math.hypot(x - site["x"], y - site["y"])
            calm = min(1.0, distance / NOISE_CALM)
            cost = distance + region_noise(x + site_jitter[k], y + site_jitter[k]) * REGION_NOISE * calm
            if site_side[k] != side_here:
                cost += 7.0
            cost /= site["weight"]
            if cost < best:
                best, best_index = cost, site["district"]
        return best_index

    owner = [[-1] * GRID for _ in range(GRID)]
    for j, y in enumerate(center):
        for i, x in enumerate(center):
            if land[j][i]:
                owner[j][i] = district_at(x, y)

    # 씨앗을 카페마다 두었으니 이건 통과해야 정상입니다. 그래도 확인은 남깁니다 —
    # 잡음 진폭을 올리다 반경을 넘기면 조용히 깨지는 종류의 성질이라서요.
    escaped = []
    for _, name, address, lng, lat in cafes:
        _, district = district_of(address)
        landed = district_list[district_at(px(lng), py(lat))]
        if landed["name"] != district:
            escaped.append(f"{name}({district} → {landed['name'] or '빈 칸'})")
    if escaped:
        raise SystemExit("자기 구 밖으로 밀려난 카페: " + ", ".join(escaped))

    # 3) 윤곽 추출
    def loops_of(mask, chaikin_rounds=3, min_points=18):
        result = []
        for loop in trace_loops(mask, GRID, GRID):
            if len(loop) < min_points:
                continue
            points = [(-PAD + px * step, -PAD + py * step) for px, py in loop]
            points = simplify(chaikin(points, chaikin_rounds), EPSILON)
            if len(points) >= 4:
                result.append(points)
        return result

    # 바다는 섬을 구멍으로 갖습니다. 한 path 안에 서브패스로 넣고 evenodd 로 칠해야
    # 섬이 바다색으로 덮이지 않습니다.
    sea_loops = loops_of(sea_mask)
    sea_path = "".join(to_path(loop) for loop in sea_loops)

    districts = []
    for k, entry in enumerate(district_list):
        mask = [[owner[j][i] == k for i in range(GRID)] for j in range(GRID)]
        # 구는 작아도 반드시 그려야 합니다. 티끌을 걸러내는 기본값을 그대로 쓰면
        # 가장 좁은 구가 소리 없이 사라지고, 그 구의 카페는 집어들 수 없게 됩니다.
        loops = loops_of(mask, min_points=10)
        if not loops:
            if entry["name"]:
                raise SystemExit(f"{entry['name']} 이 너무 좁아 경계가 안 나옵니다.")
            continue
        # 이름표는 구역 한가운데에. 다만 구역이 굽어 있으면 평균 자리가 구역 밖으로
        # 나가므로, 실제로 이 구역이 차지한 칸 중 평균에 가장 가까운 칸을 씁니다.
        cells = [(i, j) for j in range(GRID) for i in range(GRID) if owner[j][i] == k]
        mean_i = sum(i for i, _ in cells) / len(cells)
        mean_j = sum(j for _, j in cells) / len(cells)
        anchor = min(cells, key=lambda cell: (cell[0] - mean_i) ** 2 + (cell[1] - mean_j) ** 2)
        districts.append({
            "name": entry["name"],
            "sido": entry["sido"],
            "label": (center[anchor[0]], center[anchor[1]]),
            "cafeIds": entry["cafe_ids"],
            "path": "".join(to_path(loop) for loop in loops),
        })

    # 4) 물길
    river_points = [(x, y) for x, y, _ in RIVER]
    river_path = smooth_closed_path(ribbon(river_points, [w for _, _, w in RIVER]))
    tributaries = []
    for pts, w0, w1 in TRIBUTARIES:
        # 하구를 한강 중심선에 얹습니다. 접근 방향으로 조금만 지나치게 둡니다.
        mouth_x = pts[-1][0]
        approach = 1.0 if pts[-2][1] < river_y(mouth_x) else -1.0
        pts = pts[:-1] + [(mouth_x, river_y(mouth_x) + TRIBUTARY_OVERLAP * approach)]
        widths = [w0 + (w1 - w0) * (i / (len(pts) - 1)) for i in range(len(pts))]
        tributaries.append(smooth_closed_path(ribbon(pts, widths)))

    # 5) 도로 — 최소 신장 트리가 간선, 여분의 짧은 변이 지선입니다.
    nodes = ROAD_NODES
    edges = sorted(
        ((math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]), a, b)
         for a in range(len(nodes)) for b in range(a + 1, len(nodes))),
    )
    parent = list(range(len(nodes)))

    def find(n):
        while parent[n] != n:
            parent[n] = parent[parent[n]]
            n = parent[n]
        return n

    trunk_pairs = []
    for _, a, b in edges:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb
            trunk_pairs.append((a, b))
    used = set(trunk_pairs)
    minor_pairs = [(a, b) for _, a, b in edges if (a, b) not in used][:5]

    def road_path(a, b):
        (x0, y0), (x1, y1) = nodes[a], nodes[b]
        steps = 8
        pts = []
        for s in range(steps + 1):
            t = s / steps
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            # 간선 도로는 거의 곧습니다. 많이 휘면 길이 아니라 머리카락이 됩니다.
            bend = math.sin(t * math.pi) * 1.05
            pts.append((x + road_noise(x * 1.7, y * 1.7) * bend,
                        y + road_noise(y * 1.7 + 40, x * 1.7 + 40) * bend))
        return smooth_path(pts)

    trunks = [road_path(a, b) for a, b in trunk_pairs]
    minors = [road_path(a, b) for a, b in minor_pairs]

    return sea_path, districts, river_path, tributaries, trunks, minors


def main():
    sea, districts, river, tributaries, trunks, minors = build()

    def literal(values):
        return "[\n" + "".join(f'  "{v}",\n' for v in values) + "]"

    def district_literal(entries):
        lines = []
        for entry in entries:
            ids = ", ".join(f'"{cafe_id}"' for cafe_id in entry["cafeIds"])
            district_id = f'{entry["sido"]} {entry["name"]}'.strip()
            lines.append(
                f'  {{ id: "{district_id}", '
                f'name: "{entry["name"]}", sido: "{entry["sido"]}", '
                f'label: [{entry["label"][0]:.2f}, {entry["label"][1]:.2f}], '
                f"cafeIds: [{ids}], "
                f'path: "{entry["path"]}" }},\n'
            )
        return "[\n" + "".join(lines) + "]"

    out = f'''/* 자동 생성 — 손으로 고치지 마세요.
 * 다시 만들려면:  python build/terrain.py app/data/terrain.ts
 * 생성 방식과 이유는 build/terrain.py 의 설명을 보세요.
 *
 * 좌표계는 0..100 이고 마커의 % 좌표와 같은 공간입니다. viewBox 바깥까지 그려져
 * 있어서 화면 끝에서 자연스럽게 잘립니다. 카카오맵 SDK가 붙으면 이 파일과
 * MapCanvas 의 <svg> 는 통째로 없어집니다.
 */

/** 서해. 섬은 같은 path 의 서브패스라 fill-rule: evenodd 로 구멍이 됩니다. */
export const sea = "{sea}";

/**
 * 시·구 한 칸.
 *
 * 카페 하나하나가 씨앗이고 같은 시·구의 칸을 합친 것이라, `cafeIds` 의 핀은
 * 반드시 `path` 안에 있습니다 (생성기가 매번 확인합니다). 카페가 한 곳도 없는
 * 자리를 메우는 채움 칸은 `name` 이 빈 문자열이고 집어들 수 없습니다.
 */
export type District = {{
  /** 시도까지 붙인 이름. 서울 중구와 인천 중구가 있어서 `name` 만으로는 안 갈립니다. */
  id: string;
  name: string;
  sido: string;
  /** 이름표를 놓을 자리. 구역 안쪽입니다. */
  label: [number, number];
  cafeIds: string[];
  /** 섬처럼 떨어진 조각이 있으면 서브패스로 이어 붙습니다. */
  path: string;
}};

export const districts: District[] = {district_literal(districts)};

/** 한강. 선이 아니라 면이라 하구로 갈수록 넓어집니다. */
export const river = "{river}";

/** 중랑천 · 탄천 · 안양천 · 북서쪽 지류 */
export const tributaries: string[] = {literal(tributaries)};

/** 간선 도로 — 도시들을 잇는 최소 신장 트리. */
export const trunkRoads: string[] = {literal(trunks)};

/** 지선 — 순환을 만드는 짧은 변들. 간선보다 옅게 그립니다. */
export const minorRoads: string[] = {literal(minors)};
'''

    target = sys.argv[1] if len(sys.argv) > 1 else "app/data/terrain.ts"
    with open(target, "w", encoding="utf-8") as handle:
        handle.write(out)
    print(f"wrote {target}")
    print(f"  districts {len(districts)} · tributaries {len(tributaries)} · "
          f"trunk {len(trunks)} · minor {len(minors)}")
    print(f"  {len(out) / 1024:.1f} KB")


main()
