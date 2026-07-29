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

test("카페 유형은 상단 브랜드와 안내선 굵기로 구분되고, 종이는 각지다", async () => {
  const [css, receipt] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/components/Receipt.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(css, /\.receipt--confirmed \.intro\s*\{[^}]*border-left:\s*2px solid/);
  assert.match(css, /\.receipt--guess \.intro\s*\{[^}]*border-left:\s*2px dashed/);
  // 비빈 디자인 시스템 v0.1 §03 · §08 — 종이는 각지고 테두리는 실선 한 줄입니다.
  // 뜯을 수 있다는 신호는 아래끝 절취선 하나가 맡습니다 (예전의 티켓 홀 마스크 대체).
  assert.match(css, /\.receipt,\n\.codex\s*\{[^}]*border:\s*1px solid var\(--rule\)/s);
  assert.match(css, /\.receipt::after,\n\.codex::after\s*\{[^}]*background:\s*var\(--perforation\)/s);
  assert.match(css, /--perforation:\s*repeating-linear-gradient\(90deg, var\(--rule\) 0 5px, transparent 5px 10px\)/);
  assert.doesNotMatch(css, /--ticket-notch-y|\.receipt__identity|\.receipt__affiliation/);
  // 등급은 상호 옆 한 글자로 갈립니다 — 협력업체는 원두 마크, 추정은 미확인 칩.
  // 뜻은 가리켰을 때만 펴 보이므로, 툴팁이 없으면 마크가 무엇인지 알 길이 없습니다.
  assert.match(receipt, /confirmed \? \([\s\S]*<BeanMark size=\{19\} \/>/);
  assert.match(receipt, /className="partner-mark has-tip"[\s\S]*<b>비빈 파트너<\/b>/);
  assert.match(receipt, /aria-label="비빈 파트너\. 카페가 직접 확인해 준 정보입니다\."/);
  // 추정 카페에는 도장을 찍지 않습니다. 등급은 소개 문단의 점선(위)과 상세의
  // 안내문이 계속 말하므로 결정서 §3 Q34 는 지켜집니다.
  assert.match(receipt, /<\/span>\s*\) : null\}/);
  assert.doesNotMatch(receipt, /추정<\/span>|chip--unknown/);
  assert.doesNotMatch(css, /chip--unknown/);
  assert.match(css, /\.has-tip:hover > \.tip,\n\.has-tip:focus-visible > \.tip\s*\{[^}]*opacity: 1/s);

  // 상호와 주소 바로 아래가 사진입니다. 발행 정보·영문명·구분선은 걷어냈습니다.
  assert.match(receipt, /className="receipt__address">\{cafe\.address\}/);
  assert.doesNotMatch(receipt, /romanized|receipt__issue|receipt__mark|dateLabel|serial/);
  assert.doesNotMatch(css, /\.romanized|\.receipt__issue|\.receipt__mark|\.receipt__specs/);

  // 준비 중인 사진은 마스코트가 아니라 빗금입니다 (§03) — 비빈은 여백에서 거드는 관찰자.
  assert.match(receipt, /className="receipt__photo"[\s\S]*PHOTO — 사진 준비 중/);
  assert.doesNotMatch(receipt, /bibean-\w+\.webp/);
  assert.match(css, /\.receipt__photo\s*\{[^}]*background:\s*var\(--hatch\)/s);
  assert.doesNotMatch(receipt, /소속|receipt__affiliation/);
  assert.match(receipt, /상호명과 위치로 자동 추정한 정보입니다/);
  // 저장과 닫기는 종이 오른쪽 위 정사각 칸 두 개. 아이콘만 남으므로 이름은
  // aria-label 과 말풍선이 함께 져야 합니다.
  assert.match(receipt, /<div className="receipt__tools">/);
  assert.match(receipt, /<BookmarkCheck size=\{17\}[\s\S]*<BookmarkPlus size=\{17\}/);
  assert.match(receipt, /<X size=\{17\} aria-hidden="true" \/>/);
  assert.equal((receipt.match(/tool-button has-tip/g) ?? []).length, 2);
  assert.match(receipt, /aria-label=\{saved \?/);
  assert.match(css, /\.tool-button\s*\{[^}]*width: 34px;\s*height: 34px/s);
  assert.doesNotMatch(css, /\.tool-button[^{]*\{[^}]*border-radius/s);
  assert.match(receipt, /className="receipt-action text-button"/);
  assert.doesNotMatch(receipt, /className="stamp"|비빈이 다녀갔습니다|\{confirmed \? "확정"/);
});

test("도감 고르기는 종이에 끼어들지 않고 연장 아래로 펴진다", async () => {
  const [receipt, css] = await Promise.all(
    ["../app/components/Receipt.tsx", "../app/globals.css"]
      .map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  // 본문에 자리를 만들면 고르는 동안 카페가 밀려납니다. 연장에 붙은 쪽지여야 합니다.
  assert.doesNotMatch(receipt, /receipt__save-panel/);
  assert.doesNotMatch(css, /receipt__save-panel/);
  assert.match(receipt, /<div className=\{`tool-slot \$\{saveOpen \? "is-open" : ""\}`\} ref=\{saveRef\}>/);
  assert.match(receipt, /<section className="save-drop"/);
  assert.match(receipt, /aria-haspopup="true"/);
  assert.match(css, /\.save-drop\s*\{[^}]*position: absolute[^}]*animation: drop-in/s);
  assert.match(css, /@keyframes drop-in/);

  // 바깥을 누르거나 Esc 로 닫힙니다. Esc 를 여기서 멈춰 세우지 않으면 영수증까지
  // 같이 닫혀, 도감을 잘못 고른 사람이 카페를 통째로 잃습니다.
  assert.match(receipt, /document\.addEventListener\("pointerdown", onPointerDown\)/);
  assert.match(receipt, /document\.addEventListener\("keydown", onKeyDown, true\)/);
  assert.match(receipt, /event\.stopPropagation\(\);\s*setSaveOpen\(false\)/);

  // 상호 줄과 연장 줄은 같은 선에서 시작합니다 — 종이 안쪽 여백과 같은 값.
  assert.match(css, /\.receipt,\n\.codex\s*\{[^}]*padding: 26px 26px 30px/s);
  assert.match(css, /\.receipt__tools\s*\{[^}]*top: 26px;\s*right: 26px/s);
});

test("사진 밑 한 줄은 내가 적은 것이 먼저다", async () => {
  // 남이 써 준 소개보다 내가 마시고 적은 문장이 앞섭니다 — 그래야 도감입니다.
  const [receipt, page, css] = await Promise.all(
    ["../app/components/Receipt.tsx", "../app/page.tsx", "../app/globals.css"]
      .map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  assert.match(receipt, /const mine = note\.trim\(\);/);
  assert.match(receipt, /const summary = mine \|\| \(confirmed \? cafe\.intro : cafe\.guess\);/);
  assert.match(receipt, /note=\{|note: string/);
  // 적어 둔 한 줄은 카페 등급과 무관하게 확정 표시로 섭니다.
  assert.match(css, /\.receipt \.intro--mine\s*\{[^}]*border-left: 2px solid var\(--bean\)/s);
  // 영수증은 자기 메모를 어디서도 읽어 오지 않습니다. 여는 쪽이 넘겨줍니다.
  assert.doesNotMatch(receipt, /useCodex|localStorage/);
  assert.equal((page.match(/note=\{marks\.find\(/g) ?? []).length, 2);
});

test("상세는 표(모노) 중심으로 접혀 있다", async () => {
  // §06 TAB RULES — "기본값은 항상 요약보기", "상세는 표(모노) 중심".
  const [receipt, css] = await Promise.all(
    ["../app/components/Receipt.tsx", "../app/globals.css"]
      .map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  assert.match(receipt, /const \[detailOpen, setDetailOpen\] = useState\(false\)/);
  assert.match(receipt, /\{detailOpen \? "접기" : "상세 보기"\}/);
  assert.match(receipt, /aria-expanded=\{detailOpen\}/);
  assert.match(receipt, /<section className="detail"/);
  assert.match(css, /\.detail__table\s*\{[^}]*font-family: var\(--font-mono\)/s);
  // 카카오맵은 상세 안으로 들어갔습니다 — 요약의 단추는 둘까지 (§08).
  // 요약에 남은 단추는 상세 하나, 상세 안에 카카오맵 하나.
  assert.equal((receipt.match(/receipt-action/g) ?? []).length, 2);
  // 점선은 BEAN LIST 앞의 한 줄뿐입니다. 일반 카페 쪽에는 하나도 없습니다.
  assert.equal((receipt.match(/dashed-rule/g) ?? []).length, 1);
  assert.match(receipt, /<div className="dashed-rule" \/>\s*<p className="meta">BEAN LIST<\/p>/);
  assert.doesNotMatch(css, /\.detail\s*\{[^}]*border-top/s);
  assert.match(receipt, /<section className="detail"[\s\S]*map\.kakao\.com/);
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

  // 하위 경로(정적 미리보기)에 놓여도 주소가 상태로 남습니다. 기준은 <base> 태그
  // 하나뿐이어야 합니다 — document.baseURI 를 그냥 쓰면 <base> 가 없을 때 지금
  // 보고 있는 주소가 통째로 기준이 되어 /c/{id} 새로고침이 깨집니다.
  assert.match(page, /document\.querySelector\("base"\)\?\.getAttribute\("href"\)/);
  assert.match(page, /if \(!href\) return "";/);
  assert.doesNotMatch(page, /document\.baseURI/);
  assert.match(page, /window\.history\.pushState\(\{\}, "", `\$\{BASE_PATH\}\$\{pathname\}`\)/);
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
  // 불러오기는 글자 단추에서 관리판의 붙여넣기 연장으로 옮겼습니다.
  assert.match(source, /onClick=\{\(\) => setMode\("import"\)\} aria-label="받은 코드 붙여 넣기"/);
  assert.match(source, /<ClipboardPaste size=\{15\}/);
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

test("세 테마가 같은 역할 이름을 공유하고, 어느 것도 검정이 아니다", async () => {
  // 비빈 디자인 시스템 v0.1 §01 — "세 테마는 같은 역할 이름을 공유한다.
  // 다크는 검정이 아니라 어두운 종이다."
  const [css, theme, layout] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/theme.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  const ROLES = ["--desk", "--paper", "--rule", "--ink", "--ink-faint", "--accent", "--bean"];
  for (const selector of [":root,\n[data-theme=\"light\"]", "[data-theme=\"warm\"]", "[data-theme=\"cool\"]"]) {
    const start = css.indexOf(selector);
    assert.ok(start >= 0, `${selector} 블록이 없습니다`);
    const block = css.slice(start, css.indexOf("}", start));
    for (const role of ROLES) {
      assert.match(block, new RegExp(`${role}:`), `${selector} 에 ${role} 이 없습니다`);
    }
  }

  // 옛 저장값 "dark" 를 가진 사람에게서 어둠을 빼앗지 않습니다.
  assert.match(theme, /if\(s==="dark"\)s="warm"/);
  assert.match(theme, /export type Theme = "light" \| "warm" \| "cool"/);
  assert.doesNotMatch(layout, /#DCD3C2|#100E0A/i);
});

test("모서리는 각지고, 둥근 것은 도장과 핀에만 남는다", async () => {
  // 비빈 디자인 시스템 v0.1 §08 — "모서리는 각지게. 둥근 것은 도장과 핀에만 허용한다."
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const ALLOWED = [
    ".map-marker__dot", // 핀
    ".map-marker.is-active .map-marker__dot::after",
    ".map-marker.is-saved .map-marker__dot",
    ".sheet-handle::before", // 손잡이는 실물이라 둥급니다
    ".search", // border-radius: 0 — 사파리 기본 둥근 입력칸을 각지게 되돌립니다
  ];
  for (const [, selector] of css.matchAll(/([^{}]+)\{[^}]*border-radius:\s*(?!0)[^;]+;/g)) {
    const name = selector.trim().split("\n").pop().trim();
    assert.ok(ALLOWED.includes(name), `${name} 에 남은 border-radius 는 §08 위반입니다`);
  }
});

test("값과 라벨은 모노 한 벌로만 찍힌다", async () => {
  // 비빈 디자인 시스템 v0.1 §02 RULES — "숫자·좌표·수량은 항상 모노, tabular."
  const [css, page, receipt, codex] = await Promise.all(
    ["../app/globals.css", "../app/page.tsx", "../app/components/Receipt.tsx", "../app/components/Codex.tsx"]
      .map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  assert.match(css, /--font-display: "Paperlogy"/);
  assert.match(css, /--font-mono: "MonoplexKR"/);
  assert.match(css, /--font-body: "SUIT Variable"/);
  // 폴백 스택이 사라지면 CDN이 막힌 곳에서 굴림체로 떨어집니다.
  assert.match(css, /--font-mono:[^;]*"Malgun Gothic", monospace/s);
  assert.match(css, /\.meta\s*\{[^}]*font-family: var\(--font-mono\)[^}]*font-variant-numeric: tabular-nums/s);
  // 본문 최소 14px, 캡션 최소 11px.
  assert.match(css, /--t-label: 0\.875rem/);
  assert.match(css, /--t-micro: 0\.6875rem/);
  // 느낌표 금지 (§02 RULES).
  for (const [name, source] of [["page", page], ["receipt", receipt], ["codex", codex]]) {
    assert.doesNotMatch(source, /[가-힣]!/, `${name} 에 느낌표가 있습니다`);
  }
});

test("검색이 적어 둔 단축키대로 실제로 움직인다", async () => {
  // 비빈 디자인 시스템 v0.1 §08 SEARCH — 목록 아래에 "↑↓ 이동 · ↵ 선택"이라고
  // 적어 두었으므로 실제로 그렇게 움직여야 합니다.
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /↑↓ 이동 · ↵ 선택/);
  assert.match(page, /event\.key === "ArrowDown" \|\| event\.key === "ArrowUp"/);
  assert.match(page, /if \(event\.key === "Enter"\)/);
  assert.match(page, /if \(event\.key === "\/" && !sidebarOpen\)/);
  assert.match(page, /aria-selected=\{index === cursorIndex\}/);
  assert.match(css, /\.search-results__list > button\.is-cursor/);
});

test("도감 완성도는 목록에 있는 카페만 센다", async () => {
  // 남이 준 코드에는 이 판에 없는 id 가 섞여 옵니다 (decodeMarks 는 일부러
  // 걸러내지 않습니다). 그걸 같이 세면 25/18 이 나오고 막대가 상자를 넘습니다.
  const codex = await readFile(new URL("../app/components/Codex.tsx", import.meta.url), "utf8");
  assert.match(codex, /const collected = rows\.filter\(\(row\) => row\.cafe\)\.length;/);
  assert.match(codex, /const strays = activeMarks\.length - collected;/);
  assert.match(codex, /목록 밖 \{strays\}/);
  // 칸 수는 한도까지만. 한도를 넘겨 저장해 둔 옛 데이터가 있어도 격자가 넘치지 않습니다.
  assert.match(codex, /const used = Math\.min\(activeMarks\.length, COLLECTION_LIMIT\);/);
  assert.match(codex, /index < used \? "is-on" : ""/);
  const board = codex.slice(codex.indexOf('className="codex__board"'), codex.indexOf("codex__board-actions"));
  assert.doesNotMatch(board, /\{activeMarks\.length\}/);
});

test("화살표로 짚은 검색 결과가 소리로도 전해진다", async () => {
  // 포커스는 입력칸에 머무르므로 aria-activedescendant 가 없으면 "↑↓ 이동"은
  // 눈에만 보이는 안내가 됩니다.
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /const cursorIndex = visibleMatches\.length \? Math\.min\(cursor, visibleMatches\.length - 1\) : 0;/);
  assert.match(page, /aria-activedescendant=\{visibleMatches\.length \? `search-option-\$\{cursorIndex\}` : undefined\}/);
  assert.match(page, /aria-autocomplete="list"/);
  assert.match(page, /id=\{`search-option-\$\{index\}`\}/);
  assert.match(page, /aria-selected=\{index === cursorIndex\}/);
  // 강조와 Enter 와 안내가 모두 같은 자리를 가리켜야 합니다.
  assert.match(page, /className=\{index === cursorIndex \? "is-cursor" : ""\}/);
  assert.match(page, /openCafe\(visibleMatches\[cursorIndex\]\.id\)/);
  assert.match(page, /setCursor\(\(cursorIndex \+ step\) % visibleMatches\.length\)/);
});

test("도감 머리는 제자리에 남고, 관리판과 낱장은 접힌 채로 시작한다", async () => {
  const [codex, css] = await Promise.all(
    ["../app/components/Codex.tsx", "../app/globals.css"]
      .map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  // 스크롤 상자는 .dock 입니다. 머리가 같이 흐르면 어느 도감을 보고 있는지 잃습니다.
  assert.match(css, /\.codex__top\s*\{[^}]*position: sticky;\s*top: 0/s);
  assert.match(css, /\.codex\s*\{\n\s*padding-top: 0;\n\}/);
  assert.match(codex, /<div className="codex__top">/);
  // 머리 안에 있어야 같이 남습니다 — 제목·탭·관리판까지.
  const top = codex.slice(codex.indexOf('<div className="codex__top">'), codex.indexOf("{mode === \"create\""));
  for (const inside of ["receipt__tools", "codex__title", "codex__collections", "codex__board"]) {
    assert.ok(top.includes(inside), `${inside} 가 고정 머리 밖에 있습니다`);
  }

  // 관리판은 상시 표출입니다. 한 번 더 눌러야 보이는 정보는 없는 정보와 같습니다.
  assert.doesNotMatch(codex, /boardOpen/);
  assert.doesNotMatch(codex, /aria-controls="codex-board"/);
  assert.match(codex, /\{mode === "list" \? \(\s*\n\s*<section className="codex__board"/);
  // 낱장은 접힌 채로 시작합니다 — 목록이 먼저 보여야 도감입니다.
  assert.match(codex, /const \[openIds, setOpenIds\] = useState<ReadonlySet<string>>\(\(\) => new Set\(\)\)/);

  // 낱장은 이름 한 줄 + 연장 둘. 긴 이름은 줄을 늘리지 않고 자릅니다.
  assert.match(codex, /<span className="codex__name" title=\{label\}>\{label\}<\/span>/);
  assert.match(css, /\.codex__name\s*\{[^}]*text-overflow: ellipsis;\s*white-space: nowrap/s);
  assert.match(codex, /<MapPin size=\{15\}/);
  assert.match(codex, /aria-label=\{`\$\{label\} \$\{open \? "접기" : "펼치기"\}`\}/);
  // 빼기는 펼친 뒤에만, 붉은 색으로. 접힌 줄에서 실수로 눌리면 안 됩니다.
  assert.match(codex, /\{open \? \([\s\S]*codex__slip-tool--danger/);
  assert.match(css, /\.codex__slip-tool--danger\s*\{[^}]*color: var\(--stamp\)/s);

  // "나의 원두 도감 · n곳" 줄은 제목이 커지면서 걷어냈습니다.
  assert.doesNotMatch(codex, /\{activeCollection\.name\} · \{activeMarks\.length\}곳/);
  assert.doesNotMatch(css, /codex__progress-bar|codex__progress-note|codex__actions|codex-delete/);
});

test("도감 한 권은 열 곳까지다", async () => {
  // 무한히 담기는 목록은 도감이 아니라 즐겨찾기입니다. 관리판의 5×2 격자가
  // 곧 이 열 칸이므로, 저장 쪽이 한도를 지키지 않으면 격자가 거짓말을 합니다.
  const [marks, page, receipt, codex, css] = await Promise.all(
    ["../app/marks.ts", "../app/page.tsx", "../app/components/Receipt.tsx", "../app/components/Codex.tsx", "../app/globals.css"]
      .map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  assert.match(marks, /export const COLLECTION_LIMIT = 10;/);
  assert.match(marks, /if \(countInCollection\(current\.marks, collectionId\) >= COLLECTION_LIMIT\) return "full";/);
  // 코드 불러오기도 같은 한도를 지킵니다 — 여기서만 비켜 가면 칸 수가 어긋납니다.
  assert.match(marks, /const room = wanted\.filter\(\(id\) => countInCollection\(marks, id\) < COLLECTION_LIMIT\);/);
  assert.match(marks, /return \{ added, skipped \};/);
  assert.match(codex, /const \{ added, skipped \} = mergeMarks\(/);

  // 못 넣은 걸 넣은 것처럼 보이면 저장한 줄 알고 떠납니다.
  assert.match(page, /if \(result === "full"\) \{/);
  assert.match(page, /\$\{COLLECTION_LIMIT\}곳이 다 찼어/);
  assert.match(page, /if \(result === "added" && target\)/);
  // 가득 찬 도감은 눌러 보기 전에 잠겨 있어야 합니다.
  assert.match(receipt, /const full = !included && fullCollectionIds\.includes\(collection\.id\);/);
  assert.match(receipt, /disabled=\{full\}/);
  assert.match(receipt, /full \? "가득 참" : "담기"/);

  // 격자는 5×2 로 못 박습니다.
  assert.match(css, /\.codex__progress-dots\s*\{[^}]*grid-template-columns: repeat\(5, 14px\);\s*grid-template-rows: repeat\(2, 14px\)/s);
  assert.match(codex, /Array\.from\(\{ length: COLLECTION_LIMIT \}/);
});
