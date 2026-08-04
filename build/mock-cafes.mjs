/**
 * 목업 카페를 지어내 app/data/cafes.ts 뒤에 붙입니다.
 *
 * 실제 상호가 아니라 **지어낸 이름**입니다 (04_착수_검증: 카카오 로컬 API 결과를
 * 저장·재배포하지 않기로 함). 좌표는 그 구의 경계 안에서 뽑고, 주소·지역번호는
 * 뽑힌 구에서 되짚어 적습니다 — 손으로 적으면 반드시 어긋납니다.
 *
 *   node build/mock-cafes.mjs           # 어디에 몇 곳이 생기는지만 봅니다
 *   node build/mock-cafes.mjs --write   # 실제로 붙입니다
 */

import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url);
const CAFES = new URL("app/data/cafes.ts", ROOT);
const CORE = new URL("app/data/districts-data.ts", ROOT);
const WANTED = 100;
/** 협력업체 : 일반 = 1 : 4. */
const PARTNER_EVERY = 5;

const BOUNDS = { west: 126.12, east: 127.85, north: 37.85, south: 37.0 };
const project = (lng, lat) => ({
  x: ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * 100,
  y: ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * 100,
});
const unproject = (x, y) => [
  BOUNDS.west + (x / 100) * (BOUNDS.east - BOUNDS.west),
  BOUNDS.north - (y / 100) * (BOUNDS.north - BOUNDS.south),
];

/** 씨앗을 박아 둡니다 — 다시 돌려도 같은 목록이 나와야 리뷰가 가능합니다. */
let seed = 20260803;
function random() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
const pick = (list) => list[Math.floor(random() * list.length)];

// ── 경계 ────────────────────────────────────────────────────────────
function loopsOf(path) {
  return path
    .split("M")
    .filter((part) => part.trim())
    .map((part) =>
      part
        .replace("Z", "")
        .split("L")
        .map((point) => point.trim().split(" ").map(Number)),
    );
}

/** 교차수 판정. 고리를 한꺼번에 세므로 섬은 안, 구멍은 밖이 됩니다. */
function inside(loops, x, y) {
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

const core = readFileSync(CORE, "utf8");
const districts = [...core.matchAll(
  /\{ id: "([^"]+)", level: 2, name: "([^"]+)", parent: "([^"]+)", label: \[([-\d.]+), ([-\d.]+)\], path: "([^"]+)" \}/g,
)].map(([, id, name, parent, lx, ly, path]) => ({
  id,
  name,
  parent,
  label: [Number(lx), Number(ly)],
  loops: loopsOf(path),
}));
if (districts.length < 70) throw new Error(`시군구를 ${districts.length}칸밖에 못 읽었습니다`);

// ── 이미 있는 것 ────────────────────────────────────────────────────
const source = readFileSync(CAFES, "utf8");
const existing = [...source.matchAll(/name: "([^"]+)"[\s\S]*?pos: \[([-\d.]+), ([-\d.]+)\]/g)]
  .map(([, name, lng, lat]) => ({ name, spot: project(Number(lng), Number(lat)) }));
const taken = new Set(existing.map((cafe) => cafe.name));
const lastId = Math.max(...[...source.matchAll(/id: "demo-(\d+)"/g)].map((m) => Number(m[1])));

const counts = new Map(districts.map((district) => [district.id, 0]));
for (const cafe of existing) {
  const found = districts.find((district) => inside(district.loops, cafe.spot.x, cafe.spot.y));
  if (found) counts.set(found.id, counts.get(found.id) + 1);
}

// 한 곳도 없는 구부터, 그 다음 한 곳뿐인 구 순으로 채웁니다.
const empty = districts.filter((district) => counts.get(district.id) === 0);
const thin = districts.filter((district) => counts.get(district.id) === 1);

// ── 말 ──────────────────────────────────────────────────────────────
const HEAD = ["깊은", "맑은", "너른", "고요한", "낡은", "묵은", "밝은", "둥근", "작은", "얕은", "가는", "조용한", "흐린", "이른", "늦은", "잔잔한", "성긴", "옅은", "따뜻한", "서늘한", "무른", "곧은"];
const TAIL = ["계단", "모퉁이", "처마", "그늘", "언덕", "물결", "바람", "마당", "우물", "여백", "창고", "골목", "담장", "지붕", "돌담", "툇마루", "안뜰", "낮달", "초저녁", "빗물", "노을", "새벽"];
const HEAD_EN = { 깊은: "DEEP", 맑은: "CLEAR", 너른: "WIDE", 고요한: "STILL", 낡은: "WORN", 묵은: "AGED", 밝은: "BRIGHT", 둥근: "ROUND", 작은: "SMALL", 얕은: "SHALLOW", 가는: "THIN", 조용한: "QUIET", 흐린: "HAZY", 이른: "EARLY", 늦은: "LATE", 잔잔한: "CALM", 성긴: "SPARSE", 옅은: "FAINT", 따뜻한: "WARM", 서늘한: "COOL", 무른: "SOFT", 곧은: "STRAIGHT" };
const TAIL_EN = { 계단: "STAIRS", 모퉁이: "CORNER", 처마: "EAVES", 그늘: "SHADE", 언덕: "HILL", 물결: "RIPPLE", 바람: "WIND", 마당: "YARD", 우물: "WELL", 여백: "MARGIN", 창고: "DEPOT", 골목: "ALLEY", 담장: "WALL", 지붕: "ROOF", 돌담: "STONE WALL", 툇마루: "PORCH", 안뜰: "COURT", 낮달: "DAY MOON", 초저녁: "DUSK", 빗물: "RAINDROP", 노을: "AFTERGLOW", 새벽: "DAYBREAK" };
const ROADS = ["한들로", "서로", "동편길", "중앙로", "너른들길", "벚꽃로", "윗마을길", "백석로", "가로수길", "솔밭길", "물레방아길", "돌담길"];
const PLACES = ["카페", "다방", "로스터리", "북카페", "커피집"];
const WHERE = ["골목 안쪽의", "상가 이층의", "언덕 위", "역에서 조금 걷는", "큰길에서 한 블록 들어간", "주택가에 있는", "공원 건너편", "시장 옆", "천변에 있는", "학교 앞"];
const HOURS = ["08:00 – 22:00", "09:00 – 21:00", "09:30 – 23:00", "10:00 – 20:00", "11:00 – 21:30", "11:30 – 22:00", "12:00 – 19:00", "07:30 – 19:00"];
const BEANS = ["비빈 하우스 블렌드", "코스타리카 따라주", "콜롬비아 우일라", "케냐 AA", "에티오피아 예가체프", "과테말라 안티구아", "비빈 하우스 블렌드 · 케냐 AA", "엘살바도르 파카마라", "브라질 세하도 · 콜롬비아 우일라"];
const CODE = { 서울: "02", 경기: "031", 인천: "032" };

/**
 * 조사 "로 / 으로". 받침이 없거나 ㄹ 이면 "로" 입니다 —
 * 카페로 · 다방으로 · 커피집으로.
 */
function ro(word) {
  const last = word.charCodeAt(word.length - 1) - 0xac00;
  if (last < 0 || last > 11171) return "로";
  const final = last % 28;
  return final === 0 || final === 8 ? "로" : "으로";
}

/** "안산시 단원구" → "안산", "이천시" → "이천", "마포구" → "마포" */
const shortOf = (name) => name.split(" ")[0].replace(/(특별시|광역시|시|군|구)$/, "");

function spotIn(district) {
  // 라벨 자리는 구역 안쪽임이 보장됩니다. 거기서 흩뿌리되 밖으로 나가면 버립니다.
  const [lx, ly] = district.label;
  for (let tries = 0; tries < 200; tries += 1) {
    const reach = 0.05 + random() * 0.55;
    const angle = random() * Math.PI * 2;
    const x = lx + Math.cos(angle) * reach;
    const y = ly + Math.sin(angle) * reach * 0.7;
    if (inside(district.loops, x, y)) return [x, y];
  }
  return [lx, ly];
}

function nameFor() {
  for (let tries = 0; tries < 400; tries += 1) {
    const head = pick(HEAD);
    const tail = pick(TAIL);
    const name = `${head}${tail}`;
    if (taken.has(name)) continue;
    taken.add(name);
    return { name, romanized: `${HEAD_EN[head]} ${TAIL_EN[tail]}` };
  }
  throw new Error("이름이 동났습니다");
}

// ── 짓기 ────────────────────────────────────────────────────────────
/** 빈 구를 한 바퀴 돌고, 남으면 한 곳뿐인 구를 한 바퀴 더 돕니다. */
const plan = [];
for (const district of empty) plan.push(district);
for (const district of thin) plan.push(district);
while (plan.length < WANTED) plan.push(empty[plan.length % Math.max(empty.length, 1)]);
plan.length = WANTED;

const rows = [];
plan.forEach((district, index) => {
  const id = `demo-${String(lastId + index + 1).padStart(2, "0")}`;
  const { name, romanized } = nameFor();
  const [x, y] = spotIn(district);
  const [lng, lat] = unproject(x, y);
  const area = `${district.parent} ${shortOf(district.name)}`;
  const address = `${district.parent} ${district.name} ${pick(ROADS)} ${1 + Math.floor(random() * 96)}`;
  const tel = `${CODE[district.parent]}-${300 + Math.floor(random() * 690)}-${String(1000 + Math.floor(random() * 8999))}`;
  const pos = `[${lng.toFixed(4)}, ${lat.toFixed(4)}]`;
  const head = `{ id: "${id}", name: "${name}", romanized: "${romanized}", area: "${area}", address: "${address}", tel: "${tel}"`;

  if ((index + 1) % PARTNER_EVERY === 0) {
    rows.push(`  ${head}, tier: 1, partner: true, intro: "${pick(WHERE)} ${area} ${pick(PLACES)}.", hours: "${pick(HOURS)}", beans: "${pick(BEANS)}", pos: ${pos} },`);
  } else {
    rows.push(`  ${head}, tier: 3, partner: false, guess: "${pick(WHERE)} ${(() => { const place = pick(PLACES); return `${place}${ro(place)}`; })()} 추정됩니다.", pos: ${pos} },`);
  }
});

const partners = rows.filter((row) => row.includes("partner: true")).length;
const spread = new Map();
for (const district of plan) spread.set(district.parent, (spread.get(district.parent) ?? 0) + 1);

console.log(`시군구 ${districts.length}칸 중 카페가 없던 곳 ${empty.length}칸, 한 곳뿐이던 곳 ${thin.length}칸`);
console.log(`새로 ${rows.length}곳 — 협력 ${partners} : 일반 ${rows.length - partners} (1:${(rows.length - partners) / partners})`);
console.log("시도별:", [...spread].map(([k, v]) => `${k} ${v}`).join(" · "));
console.log("아직 빈 채로 남는 곳:", empty.filter((d) => !plan.includes(d)).map((d) => d.name).join(", ") || "없음");

if (!process.argv.includes("--write")) {
  console.log("\n미리보기 세 줄:");
  console.log(rows.slice(0, 3).join("\n"));
  console.log("\n붙이려면 --write");
} else {
  const marker = "];\n\n/**\n * 서랍의 지역별 집계.";
  if (!source.includes(marker)) throw new Error("붙일 자리를 못 찾았습니다");
  writeFileSync(CAFES, source.replace(marker, `${rows.join("\n")}\n${marker}`), "utf8");
  console.log("\n붙였습니다");
}
