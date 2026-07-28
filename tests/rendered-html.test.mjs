import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the Bean Codex product shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>원두도감 — 수도권 개인 카페 지도<\/title>/i);
  // 라벨의 자간은 CSS가 냅니다. 마크업에 낱글자 공백을 넣으면 스크린리더가
  // 음절을 따로 읽고 복사도 깨지므로, 붙여 쓴 원문이 그대로 나와야 합니다.
  assert.match(html, /원두도감/);
  assert.doesNotMatch(html, /원 두 도 감/);
  assert.match(html, /오늘의 영수증/);
  assert.match(html, /내 도감/);
  assert.match(html, /협력업체/);
  assert.match(html, /목업 데이터/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("starter preview is removed and design safeguards remain", async () => {
  const [page, marks, css, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/marks.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(marks, /localStorage\.setItem\(MARKS_KEY/);
  assert.match(marks, /MARKS_KEY = "wondudogam\.marks"/);
  assert.match(page, /window\.history\.pushState/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /--stamp:\s*#a63a2e/i);
  // 02 §2.2 — 감열지는 희지 않고 감열 인쇄는 검지 않습니다. 순백·순흑 금지.
  assert.doesNotMatch(css, /#fff\b|#000\b/i);
  assert.match(layout, /lang="ko"/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/);
});

test("카페 유형은 상단 브랜드와 실제 티켓 홀로 구분된다", async () => {
  const [css, receipt] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/components/Receipt.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(css, /\.receipt--confirmed \.intro\s*\{[^}]*border-left:\s*2px solid/);
  assert.match(css, /\.receipt--guess \.intro\s*\{[^}]*border-left:\s*2px dashed/);
  assert.match(css, /\.receipt\s*\{[^}]*--ticket-notch-y:\s*138px;[^}]*radial-gradient\(circle 11px at 0 var\(--ticket-notch-y\), transparent 98%, #010101\)/s);
  assert.doesNotMatch(css, /\.receipt__identity::before|\.receipt__affiliation/);
  assert.match(receipt, /<b>\{confirmed \? "비빈 파트너" : "원두도감"\}<\/b>/);
  assert.match(receipt, /className="receipt__photo"[\s\S]*bibean-inspecting\.webp/);
  assert.match(css, /\.receipt__photo\s*\{[^}]*aspect-ratio:\s*16 \/ 9/s);
  assert.doesNotMatch(receipt, /소속|receipt__affiliation/);
  assert.doesNotMatch(receipt, /<div className="dashed-rule" \/>\s*<div className="receipt__identity">/);
  assert.match(receipt, /상호명과 위치로 자동 추정한 정보입니다/);
  assert.match(receipt, /className=\{`receipt-action save-button/);
  assert.match(receipt, /className="receipt-action text-button"/);
  assert.doesNotMatch(receipt, /className="stamp"|비빈이 다녀갔습니다|\{confirmed \? "확정"/);
});
test("협력업체는 지도에서도 구분된다", async () => {
  // 00_결정서 §2 Q4 "시각적으로는 뱃지 정도" · 03_기능_명세 §5.2 "지도 마커".
  // 도장은 걷어냈지만 강조 자체가 사라지면 부스팅의 시각적 절반이 없어집니다.
  const [map, css] = await Promise.all([
    readFile(new URL("../app/components/MapCanvas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(map, /cafe\.partner \? "is-partner" : ""/);
  assert.match(map, /saved \|\| cafe\.partner \? <span className="map-marker__name">/);
  assert.match(map, /cafe\.partner \? ", 협력업체" : ""/);
  assert.match(css, /\.map-marker\.is-partner \.map-marker__dot\s*\{[^}]*color:\s*var\(--bean\)/s);
  // 인주는 도장 전용이었으므로 지도 강조에 되살리지 않습니다.
  assert.doesNotMatch(css, /\.map-marker[^{]*\{[^}]*var\(--stamp\)/s);
});

test("인주 색은 협력업체 도장에만 남는다", async () => {
  // 02_디자인_시스템 §2.2 — "붉은색이 여기저기 나오면 도장이 특별해지지 않습니다."
  const [marks, css] = await Promise.all([
    readFile(new URL("../app/marks.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const stamp = /--stamp:\s*(#[0-9a-f]{6})/i.exec(css)?.[1]?.toLowerCase();
  assert.ok(stamp, "--stamp 토큰을 찾지 못했습니다");

  // 도감 색 팔레트에 인주와 같은 값이 있으면 안 됩니다.
  for (const [, value] of marks.matchAll(/value:\s*"(#[0-9a-f]{6})"/gi)) {
    assert.notEqual(value.toLowerCase(), stamp, `도감 색 ${value} 가 인주와 같습니다`);
  }
  // 기본 도감도 붉은색이 아니어야 합니다.
  assert.doesNotMatch(marks, /DEFAULT_COLLECTION[^\n]*color:\s*"clay"/);
});

test("마스코트는 WebP로, 작게 쓰지 않는다", async () => {
  // 03_기능_명세 §9 — "이미지: WebP". 512px PNG 는 34~52KB, 256px WebP 는 8~11KB 입니다.
  const [art, receipt, page, codex] = await Promise.all(
    ["../app/components/BeanArt.tsx", "../app/components/Receipt.tsx", "../app/page.tsx", "../app/components/Codex.tsx"]
      .map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  assert.doesNotMatch(art, /\/mascot\/[a-z-]+\.png/);
  assert.doesNotMatch(receipt, /\/mascot\/[a-z-]+\.png/);

  // 40px 아래로 내려가면 모자와 콧수염이 뭉개져 갈색 얼룩이 됩니다.
  for (const source of [page, codex]) {
    for (const [, size] of source.matchAll(/<Bibin[^>]*\bsize=\{(\d+)\}/g)) {
      assert.ok(Number(size) >= 44, `Bibin size=${size} 는 너무 작습니다 (최소 44)`);
    }
  }
});

test("공유 링크와 새로고침이 살아 있다", async () => {
  // 03_기능_명세 §1 — "공유·뒤로가기·새로고침이 전부 정상 동작해야 합니다."
  // 카페 하나를 링크로 공유할 수 있어야 브랜드 확산이 일어납니다.
  for (const path of ["/c/demo-seongsu", "/marks"]) {
    const response = await render(path);
    assert.equal(response.status, 200, `${path} 가 서버에서 살아 있어야 합니다`);
    assert.match(await response.text(), /원두도감/);
  }

  // 주소가 상태의 원본이라 별도 state 로 복사해 두지 않습니다.
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /useSyncExternalStore\(subscribeLocation, readPathname/);
  assert.match(page, /const panel = route\?\.panel/);
  assert.doesNotMatch(page, /setPanel\(|setSelectedId\(/);
});

test("내 도감 코드가 명세한 형식과 왕복을 지킨다", async () => {
  // 03_기능_명세 §6.2 — 접두사 WDG1: 은 버전 식별용이라 형식이 바뀌어도 옛 코드를 읽습니다.
  const source = await readFile(new URL("../app/codex-export.ts", import.meta.url), "utf8");
  assert.match(source, /const PREFIX = "WDG1:"/);
  assert.match(source, /CompressionStream\("deflate"\)/);
  assert.match(source, /DecompressionStream\("deflate"\)/);

  // 브라우저와 같은 방식으로 굽고 풀어 실제 왕복을 확인합니다.
  const marks = [
    { id: "26338954", at: "2026-07-27", note: "창가 자리" },
    { id: "10020030", at: "2026-07-26", note: "" },
  ];
  const payload = new TextEncoder().encode(JSON.stringify({ v: 1, marks }));
  const packed = new Uint8Array(
    await new Response(new Blob([payload]).stream().pipeThrough(new CompressionStream("deflate"))).arrayBuffer(),
  );
  const code = `WDG1:${Buffer.from(packed).toString("base64")}`;
  assert.ok(code.startsWith("WDG1:"));

  const raw = Buffer.from(code.slice(5), "base64");
  const text = await new Response(
    new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate")),
  ).text();
  assert.deepEqual(JSON.parse(text).marks, marks);

  // 두어 장에서는 base64 덧값이 압축 이득을 먹습니다. 실제로 옮길 만한 크기에서
  // 짧아지는지를 봐야 합니다 — 코드를 손으로 옮겨 붙이는 기능이니까요.
  const many = Array.from({ length: 30 }, (_, index) => ({
    id: String(26338954 + index),
    at: "2026-07-27",
    note: "",
  }));
  const manyJson = JSON.stringify({ v: 1, marks: many });
  const manyPacked = new Uint8Array(
    await new Response(
      new Blob([new TextEncoder().encode(manyJson)]).stream().pipeThrough(new CompressionStream("deflate")),
    ).arrayBuffer(),
  );
  const manyCode = `WDG1:${Buffer.from(manyPacked).toString("base64")}`;
  assert.ok(manyCode.length < manyJson.length, `30장이면 짧아져야 합니다 (${manyCode.length} < ${manyJson.length})`);
});

test("내 도감이 비어 있어도 불러오기로 들어갈 수 있다", async () => {
  const source = await readFile(new URL("../app/components/Codex.tsx", import.meta.url), "utf8");
  assert.match(source, /onClick=\{\(\) => setMode\("import"\)\}>불러오기/);
  const marks = await readFile(new URL("../app/marks.ts", import.meta.url), "utf8");
  assert.match(marks, /export function mergeMarks/);
  assert.match(marks, /existing\.collectionIds/);
});

test("여러 도감과 저장 카페 강조가 같은 분류 체계를 쓴다", async () => {
  const [marks, codex, receipt, map, css] = await Promise.all([
    readFile(new URL("../app/marks.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/Codex.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/Receipt.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/MapCanvas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.equal((marks.match(/\{ id: "(?:clay|ochre|olive|forest|teal|indigo|plum|cocoa)"/g) ?? []).length, 8);
  assert.equal((marks.match(/\{ id: "(?:bean|coffee|book-open|map-pin|star|heart|bookmark|compass)"/g) ?? []).length, 8);
  assert.match(marks, /collectionIds: requested\.length[\s\S]*safeCollections\[0\]\.id/);
  assert.match(codex, /createCollection/);
  assert.match(receipt, /selectedCollectionIds/);
  assert.match(map, /saved \? "is-saved"/);
  assert.doesNotMatch(map, /cafe\.partner \? "map-marker--partner"/);
  assert.match(css, /\.map-marker\.is-saved/);
});

test("한 화면에 비빈은 하나뿐이다", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const mascots = page.match(/<Bibin\b/g) ?? [];
  assert.equal(mascots.length, 2, "토스트와 빈 결과 두 자리에서만 직접 그립니다");
  assert.match(page, /mascotSlot/);
  assert.doesNotMatch(page, /showSignature|"signature"/);
});

test("primary map stays a local SVG editorial atlas", async () => {
  const [surface, canvas, layout, receipt, css] = await Promise.all([
    readFile(new URL("../app/components/MapSurface.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/MapCanvas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/Receipt.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(surface, /<MapCanvas/);
  assert.doesNotMatch(surface, /KakaoMap|readMapKey|useSyncExternalStore/);
  assert.match(canvas, /className="map__terrain"/);
  assert.match(canvas, /terrain__district/);
  assert.match(canvas, /onWheel=\{onWheel\}/);
  assert.match(canvas, /onPointerMove=\{onPointerMove\}/);
  assert.match(canvas, /MAX_ZOOM = 3/);
  assert.match(canvas, /className="map__zoom"/);
  assert.match(canvas, /<Coffee size=\{12\}/);
  assert.match(css, /\.map__places span\s*\{[^}]*scale\(var\(--map-inverse\)\)/s);
  assert.match(css, /\.map\s*\{\s*cursor:\s*grab;\s*touch-action:\s*none;/);
  assert.doesNotMatch(layout, /kakao-map-key|KAKAO_MAP_KEY/);
  assert.match(receipt, /https:\/\/map\.kakao\.com/);
});

test("mock cafe ratio stays at two regular cafes per partner cafe", async () => {
  const source = await readFile(new URL("../app/data/cafes.ts", import.meta.url), "utf8");
  const cafeArray = source.slice(source.indexOf("export const cafes"), source.indexOf("export const partnerRegions"));
  const partners = cafeArray.match(/partner:\s*true/g) ?? [];
  const regulars = cafeArray.match(/partner:\s*false/g) ?? [];
  assert.equal(partners.length, 6);
  assert.equal(regulars.length, 12);
  assert.equal(regulars.length, partners.length * 2);
});

test("selection ring remains circular and supplied Bibin boings accessibly", async () => {
  const [css, beanArt] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BeanArt.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(css, /\.map-marker\.is-saved\.is-active \.map-marker__dot::after\s*\{[^}]*width:\s*46px;[^}]*height:\s*46px;/s);
  assert.match(css, /@keyframes\s+marker-ring-spin/);
  // 선택 링은 바깥 사각 테두리가 아니라 점 위의 원이어야 합니다.
  assert.doesNotMatch(css, /\.map-marker\.is-active::after\s*\{[^}]*border:/s);
  assert.match(css, /@keyframes\s+bibin-boing/);
  assert.match(beanArt, /<button[\s\S]*type="button"[\s\S]*onClick=\{boing\}/);
  assert.match(beanArt, /<img src=\{preset\.src\}/);
  assert.match(beanArt, /isBoinging \? bibinPresets\.surprised/);
  assert.match(beanArt, /\/mascot\/bibean-delighted\.webp/);
  // 화면에는 WebP 를 쓰고, 원본 PNG 는 OG·인쇄물용으로 함께 남겨 둡니다.
  await Promise.all([
    "bibean-neutral",
    "bibean-map-reading",
    "bibean-map-lost",
    "bibean-squinting",
    "bibean-map-puzzled",
    "bibean-inspecting",
    "bibean-delighted",
    "bibean-surprised",
    "bibean-diary-writing",
  ].flatMap((name) => [
    access(new URL(`../public/mascot/${name}.png`, import.meta.url)),
    access(new URL(`../public/mascot/${name}.webp`, import.meta.url)),
  ]));
});
test("Codex selection keeps the Codex open beside its cafe receipt", async () => {
  const [page, codex, receipt, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/Codex.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/Receipt.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /const \[codexPreviewId, setCodexPreviewId\]/);
  assert.match(page, /onOpenCafe=\{openCafeFromCodex\}/);
  assert.match(page, /className="dock__preview"[\s\S]*className="dock__codex"/);
  const previewHandler = page.slice(page.indexOf("function openCafeFromCodex"), page.indexOf("function onToggleMark"));
  assert.doesNotMatch(previewHandler, /navigate\(/);
  assert.match(codex, /mark\.id === activeCafeId \? "is-active"/);
  assert.match(css, /\.dock\.has-preview \.dock__pair\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.dock\.has-preview \.dock__codex\s*\{[^}]*display:\s*none/s);
  assert.doesNotMatch(receipt, /<div className="dashed-rule" \/>\s*<div className="receipt__actions">/);
  assert.doesNotMatch(codex, /<div className="dashed-rule" \/>\s*<div className="codex__actions">/);
});
