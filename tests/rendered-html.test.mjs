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
  assert.match(receipt, /<BookmarkCheck aria-hidden="true" \/>[\s\S]*<BookmarkPlus aria-hidden="true" \/>/);
  assert.match(receipt, /<X aria-hidden="true" \/>/);
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
test("지도는 협력업체가 아니라 내 기록을 강조한다", async () => {
  // 00_결정서 §2 Q4 는 협력업체에 "뱃지 정도"를 허락했지만, 목록이 여든 곳으로
  // 늘면서 열여섯이 갈색으로 도드라지면 지도가 광고판이 됩니다. 등급 표시는
  // 영수증의 원두 마크로 옮기고, 지도에서는 내가 뜯어 둔 곳만 눈에 띕니다.
  const [map, css] = await Promise.all([
    readFile(new URL("../app/components/MapCanvas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(map, /is-partner/);
  assert.doesNotMatch(css, /is-partner/);
  assert.match(map, /saved \? "is-saved" : ""/);
  assert.match(map, /\{saved \? <span className="map-marker__name">/);
  assert.match(css, /\.map-marker\.is-saved \.map-marker__dot\s*\{[^}]*background: color-mix/s);
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
  const basePath = await readFile(new URL("../app/base-path.ts", import.meta.url), "utf8");
  assert.match(basePath, /document\.querySelector\("base"\)\?\.getAttribute\("href"\)/);
  assert.match(basePath, /if \(!href\) return "";/);
  assert.doesNotMatch(basePath, /document\.baseURI/);
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
  assert.match(source, /onClick=\{\(\) => setMode\("import"\)\} disabled=\{readOnly\} aria-label="받은 코드 붙여 넣기"/);
  assert.match(source, /<ClipboardPaste size=\{ICON\.sm\}/);
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
  assert.match(canvas, /MAX_ZOOM = 15/);
  assert.match(canvas, /className="map__zoom"/);
  assert.match(canvas, /<Coffee size=\{ICON\.sm\} aria-hidden="true" \/>/);
  assert.match(css, /\.map__places span \{ transform: translate\(-50%, -50%\); \}/);
  assert.match(css, /\.map\s*\{\s*cursor:\s*grab;\s*touch-action:\s*none;/);
  assert.doesNotMatch(layout, /kakao-map-key|KAKAO_MAP_KEY/);
  assert.match(receipt, /https:\/\/map\.kakao\.com/);
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
  assert.match(beanArt, /<img src=\{asset\(preset\.src\)\}/);
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
  // 화면에 적어 두지 않아도 손은 그대로 움직입니다. 눈에 보이는 안내는
  // 머리줄의 "/" 하나뿐이고, 나머지는 aria 로만 전합니다.
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(page, /↑↓ 이동/);
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
  assert.match(codex, /목록 밖 \$\{strays\}/);
  // 목록 밖 카페는 등급도 동네도 모릅니다 — 집계에서 세면 같은 것을 두 번 셉니다.
  assert.match(codex, /const known = rows\.map\(\(row\) => row\.cafe\)\.filter\(\(cafe\) => !!cafe\);/);
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
  assert.match(codex, /<MapPin size=\{ICON\.sm\}/);
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

test("숫자 옆에 무엇을 센 것인지가 적힌다", async () => {
  // "6 / 10" 만으로는 무엇을 센 숫자인지 알 수 없습니다.
  const [codex, css] = await Promise.all(
    ["../app/components/Codex.tsx", "../app/globals.css"]
      .map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  assert.match(codex, /<span className="meta">모은 곳<\/span>/);
  assert.match(codex, /className="meta codex__board-lines"/);
  assert.match(codex, /마지막 기록 \{sinceLabel\(lastMark, dateLabel\)\}/);
  // 동네 수는 겹칠 때만 말이 됩니다. 전부 다른 동네면 "모은 곳"과 같은 숫자입니다.
  assert.match(codex, /if \(areas < known\.length\) parts\.push\(`동네 \$\{areas\}곳`\);/);
  // 날짜 하나로는 "요즘 안 갔네"가 읽히지 않습니다.
  assert.match(codex, /if \(days === 1\) return `\$\{shown\} · 어제`;/);
  assert.match(codex, /return `\$\{shown\} · \$\{days\}일 전`;/);
  // 형식이 다른 옛 값에는 손대지 않습니다.
  assert.match(codex, /return match \? `\$\{match\[1\]\}\.\$\{match\[2\]\}` : at;/);
  assert.match(css, /\.codex__board-lines\s*\{[^}]*border-top: 1px dashed var\(--rule\)/s);
});

test("확대해도 핀은 뭉개지지 않는다", async () => {
  // 겹을 transform: scale() 로 키우면 브라우저는 이미 그려 둔 그림을 늘립니다.
  // 아이패드·모바일 사파리는 겹을 훨씬 적극적으로 이미지로 구워 두어서, 배율을
  // 올릴수록 경계선도 글자도 뭉갭니다. 늘려 붙이는 단계를 아예 두지 않습니다.
  const [canvas, css, geo] = await Promise.all(
    ["../app/components/MapCanvas.tsx", "../app/globals.css", "../app/data/geo.ts"]
      .map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  assert.match(canvas, /className="map__layer map__viewport"/);
  assert.match(canvas, /className="map__layer map__regions"/);
  assert.match(canvas, /className="map__layer map__pins"/);

  // 확대는 SVG 의 창문이 좁아지는 것으로 일어납니다. 두 그림이 같은 창문을 봐야
  // 강조된 경계가 지형 위에 정확히 겹칩니다.
  assert.match(canvas, /function windowOf\(view: View, size: \{ width: number; height: number \}\)/);
  assert.match(canvas, /const viewBox = `\$\{window_\.x\} \$\{window_\.y\} \$\{window_\.w\} \$\{window_\.h\}`;/);
  assert.equal((canvas.match(/viewBox=\{viewBox\}/g) ?? []).length, 2);

  // 창의 비율이 화면 비율을 따라가야 지도가 안 찌그러집니다. 정사각형 창을 쓰면
  // 세로로 긴 폰에서 가로가 2.8배 눌립니다.
  assert.match(geo, /export const UNIT_ASPECT = SPAN_KM\.y \/ SPAN_KM\.x;/);
  assert.match(canvas, /function baseSpan\(width: number, height: number\)/);
  assert.match(canvas, /const target = \(width \/ height\) \* UNIT_ASPECT;/);
  assert.match(canvas, /return target <= 1 \? \{ w: 100 \* target, h: 100 \} : \{ w: 100, h: 100 \/ target \};/);
  assert.doesNotMatch(canvas, /100 \/ view\.zoom/);

  // 핀과 이름표는 자기 자리를 셈해서 놓입니다.
  assert.match(canvas, /function toScreen\(x: number, y: number\)/);
  assert.match(canvas, /x: \(\(x - window_\.x\) \/ window_\.w\) \* 100/);
  assert.match(canvas, /const \{ x, y \} = toScreen\(spot\.x, spot\.y\);/);
  // 축척 막대가 가리키는 거리도 화면마다 다시 셉니다.
  assert.match(canvas, /const SCALE_BAR_PX = 56;/);
  assert.match(css, /\.map__scale i \{[^}]*width: 56px/s);
  assert.match(canvas, /const kilometresPerPixel = size \? \(SPAN_KM\.x \* window_\.w\) \/ \(100 \* size\.width\) : 0;/);

  // 겹에는 변형도 되돌리기도 남지 않습니다 — 남아 있으면 그게 다시 뭉개는 원인입니다.
  assert.doesNotMatch(css, /--map-zoom|--map-pan-x|--map-pan-y/);
  assert.doesNotMatch(css, /will-change: transform/);
  assert.doesNotMatch(canvas, /mapVars/);
  assert.match(css, /\.map__layer \{\s*\n\s*position: absolute;\s*\n\s*inset: 0;\s*\n\}/);
  assert.match(css, /\.map-marker \{ transform: translate\(-50%, -50%\); \}/);

  // 변형을 걷어내면서 CSS 전이도 같이 없어졌습니다. 단추는 1.4배씩 뛰므로 그냥
  // 갈아 끼우면 툭 끊기고, 그렇다고 전이를 되살리면 그게 다시 뭉개는 원인입니다.
  // 값을 프레임마다 옮겨, 부드러우면서 매 프레임 벡터에서 다시 그리게 둡니다.
  assert.match(canvas, /const GLIDE_MS = 140;/);
  assert.match(canvas, /function glideTo\(target: View\)/);
  assert.match(canvas, /glideRef\.current = t < 1 \? requestAnimationFrame\(step\) : null;/);
  assert.match(canvas, /if \(next\) glideTo\(next\);/);
  const mapLayer = css.slice(css.indexOf(".map__layer {"), css.indexOf(".map__pins {"));
  assert.doesNotMatch(mapLayer, /transition|transform/);
  // 끌기와 휠은 이미 손을 따라오므로 미끄러짐을 끼우지 않고 즉시 놓아 줍니다.
  assert.match(canvas, /stopGlide\(\);\s*\n\s*\/\/[^\n]*\n\s*const rate = viewRef\.current\.zoom >= FAST_FROM/);
  assert.match(canvas, /stopGlide\(\);\s*\n\s*event\.currentTarget\.setPointerCapture/);
  // 화면에서 사라진 뒤에도 프레임을 잡고 있으면 안 됩니다.
  assert.match(canvas, /stopGlide\(\);\s*\n\s*if \(frameRef\.current !== null\) cancelAnimationFrame\(frameRef\.current\);/);
  // 모션을 줄인 사람에게는 미끄러지지 않고 곧바로 놓습니다.
  assert.match(canvas, /prefers-reduced-motion: reduce/);
});

test("지도 연장은 우하단 한 덩어리로 모이고, 종이가 덮지 않는다", async () => {
  const [canvas, css] = await Promise.all(
    ["../app/components/MapCanvas.tsx", "../app/globals.css"]
      .map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  assert.match(canvas, /<div className="map__tools">\s*\n\s*<div className="map__scale"[\s\S]*<div className="map__zoom"/);
  assert.match(css, /\.map__tools\s*\{[^}]*right: var\(--rail\);\s*bottom: 26px/s);
  // 자리를 옮겼으니 옛 좌표는 남아 있으면 안 됩니다.
  assert.doesNotMatch(css, /\.map__zoom\s*\{[^}]*top: 88px/s);
  assert.doesNotMatch(css, /\.map__scale\s*\{[^}]*position: absolute/s);
  // 닿지 않는 단추는 없는 단추입니다 — 도크가 아래끝을 비워 줍니다.
  assert.match(css, /max-height: calc\(100svh - var\(--dock-top\) - 104px\)/);
  // 손이 닿는 자리는 모바일에서만 위쪽입니다 (아래는 하단 시트가 씁니다).
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.map__tools \{ top: 76px; right: 14px; bottom: auto; \}/);
});

test("목업 카페는 여든 곳이고 협력업체는 다섯 중 하나다", async () => {
  const cafes = await readFile(new URL("../app/data/cafes.ts", import.meta.url), "utf8");
  const rows = cafes.slice(cafes.indexOf("export const cafes"), cafes.indexOf("export const partnerRegions"));
  const total = (rows.match(/id: "demo-/g) ?? []).length;
  const partners = (rows.match(/partner: true/g) ?? []).length;
  assert.equal(total, 80);
  assert.equal(partners, 16);
  assert.equal(total / partners, 5, "협력업체는 1 : 4 (다섯 중 하나)여야 합니다");
  // id 와 상호가 겹치면 도감이 같은 곳을 두 번 셉니다.
  assert.equal(new Set(rows.match(/id: "[^"]+"/g)).size, total);
  assert.equal(new Set(rows.match(/name: "[^"]+"/g)).size, total);
  // 서랍의 지역 집계는 손으로 적지 않고 목록에서 셉니다.
  assert.match(cafes, /export const partnerRegions = \(\(\) => \{/);
  assert.doesNotMatch(cafes, /count: 52/);
});

test("줌아웃하면 고른 도감의 카페만, 확대하면 보이는 자리만 남는다", async () => {
  const [canvas, page] = await Promise.all(
    ["../app/components/MapCanvas.tsx", "../app/page.tsx"]
      .map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  // 담기지 않은 카페는 300%에서 하나도 없고 1500%에서 전부입니다.
  assert.match(canvas, /const REVEAL_FROM = 3;/);
  assert.match(canvas, /const REVEAL_ALL = 15;/);
  // 배율에 그대로 비례시키면 중간에 붐볐다가 끝에서 도로 휑해집니다. 화면에 남는
  // 땅이 배율의 제곱에 반비례해 줄어드니, 나오는 비율도 제곱으로 늘려 상쇄합니다.
  assert.match(canvas, /\(view\.zoom \*\* 2 - REVEAL_FROM \*\* 2\) \/ \(REVEAL_ALL \*\* 2 - REVEAL_FROM \*\* 2\)/);
  assert.match(canvas, /if \(savedMarkers\[cafe\.id\] \|\| cafe\.id === activeId \|\| hoveredIds\?\.has\(cafe\.id\)\)/);
  assert.match(canvas, /if \(\(revealOrder\.get\(cafe\.id\) \?\? 0\) >= revealed\) return false;/);
  assert.match(canvas, /\{shownCafes\.map\(\(cafe\) => \{/);

  // 해시값을 그대로 차례로 쓰면 몰린 구간에서 우르르 쏟아집니다. 줄을 세운 뒤
  // 등수를 매겨야 배율이 절반쯤 왔을 때 정확히 절반이 나와 있습니다.
  assert.match(canvas, /\[\.\.\.cafes\]\.sort\(\(a, b\) => scatter\(a\.id\) - scatter\(b\.id\)\)/);
  assert.match(canvas, /ordered\.map\(\(cafe, index\) => \[cafe\.id, index \/ ordered\.length\]\)/);
  // 마무리 섞기가 없으면 demo-01 과 demo-02 가 이웃한 값이 되어 한 동네가 통째로 튀어나옵니다.
  assert.match(canvas, /hash = Math\.imul\(hash \^ \(hash >>> 15\), 2246822507\);/);

  // 구로 시작해 500%부터 동으로 갈립니다. 시도까지 세 단계면 확대하는 동안
  // 경계가 두 번 바뀌어 어지럽습니다.
  assert.match(canvas, /\{ from: 5, level: 3 \}/);
  assert.match(canvas, /\{ from: 1, level: 2 \}/);
  assert.doesNotMatch(canvas, /level: 1/);
  assert.match(canvas, /const pieces = useMemo\(\(\) => piecesInView\(level, tile\), \[tileKey\]\);/);
  assert.match(canvas, /levelRef\.current,/);

  // 지도에서 도드라지는 건 지금 고른 도감뿐입니다 — 탭을 옮기면 지도도 옮겨 갑니다.
  assert.match(page, /if \(!mark\.collectionIds\.includes\(activeCollection\.id\)\) continue;/);
  assert.match(page, /color: colorValue\(activeCollection\.color\)/);
  // 아직 담은 게 없는 사람에게 빈 지도를 열어 주지 않습니다.
  assert.match(page, /useState\(CURATOR_COLLECTION_ID\)/);

  // 100%에서도 지도를 조금 밀 수 있습니다. 딱 맞게 가둬 두면 검색 종이와 도크
  // 밑에 깔린 자리(강화도가 그랬습니다)는 영영 못 봅니다.
  assert.match(canvas, /const PAN_SLACK = 0\.2;/);
  assert.match(canvas, /x: clamp\(view\.x, -reachX, reachX\), y: clamp\(view\.y, -reachY, reachY\)/);
  assert.match(canvas, /\+ width \* PAN_SLACK;/);
  // 민 만큼 뒤에 그림이 있어야 빈 자리가 안 보입니다.
  const generator = await readFile(new URL("../build/districts.py", import.meta.url), "utf8");
  assert.match(generator, /^PAD = 22\.0$/m);

  // 보이지도 않는 핀을 붙들고 있지 않습니다.
  assert.match(canvas, /const CULL_MARGIN = 0\.2;/);
  assert.match(canvas, /function inView\(x: number, y: number\)/);
  assert.match(canvas, /if \(!size\) return true;/);
  assert.match(canvas, /return inView\(x, y\);/);
  assert.match(canvas, /new ResizeObserver/);

  // 곱해서 올립니다. 더하기로 올리면 배율이 높을수록 한 번의 체감이 줄어들어,
  // 끝으로 갈수록 눌러도 눌러도 그대로인 것처럼 보입니다.
  assert.match(canvas, /const ZOOM_FACTOR = 1\.4;/);
  assert.doesNotMatch(canvas, /ZOOM_STEP/);
  // 500%부터는 보폭이 조금 커집니다. 어느 쪽으로 가든 두 배율 중 낮은 쪽으로
  // 보폭을 정해야 확대했다 축소했을 때 밟았던 자리를 그대로 되짚습니다.
  assert.match(canvas, /const FAST_FROM = 5;/);
  assert.match(canvas, /const FAST_FACTOR = 1\.6;/);
  assert.match(canvas, /const fast = direction > 0 \? current >= FAST_FROM : current \/ FAST_FACTOR >= FAST_FROM;/);
  assert.match(canvas, /const next = zoomedView\(direction > 0 \? current \* factor : current \/ factor\);/);
  // 휠도 같은 만큼 빨라집니다 — ln(1.6) / ln(1.4) ≈ 1.4배.
  assert.match(canvas, /const rate = viewRef\.current\.zoom >= FAST_FROM \? 0\.0021 : 0\.0015;/);
  // 축척은 막대를 늘리지 않고 적힌 거리를 바꿉니다 — 안 그러면 1500%에서 막대가
  // 화면을 넘습니다. 1km 아래로는 m 로 적습니다.
  assert.match(canvas, /<i \/><span>\{scaleLabel\}<\/span>/);
  assert.match(canvas, /barKilometres >= 1/);
  assert.match(canvas, /Math\.round\(barKilometres \* 1000 \/ 10\) \* 10\} m/);
});

test("큐레이터 픽은 날짜에서 계산되고 손댈 수 없다", async () => {
  const [marks, page, codex, receipt] = await Promise.all(
    ["../app/marks.ts", "../app/page.tsx", "../app/components/Codex.tsx", "../app/components/Receipt.tsx"]
      .map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  // 저장소에 쓰지 않아야 "매일 바뀌고 지울 수 없다"가 규칙이 아니라 성질이 됩니다.
  assert.match(marks, /export const CURATOR_COLLECTION_ID = "curator";/);
  assert.match(marks, /export function curatorPicks\(dateLabel: string\): string\[\]/);
  assert.match(marks, /seededRandom\(dateLabel\)/);
  assert.match(marks, /\.slice\(0, CURATOR_PARTNER_PICKS\)/);
  assert.match(marks, /\.slice\(0, COLLECTION_LIMIT - partners\.length\)/);
  assert.match(marks, /const taken = new Set\(partners\.map\(\(cafe\) => cafe\.id\)\);/);
  // 저장 경로 어디에도 큐레이터 픽이 끼어들 수 없습니다.
  assert.match(marks, /const target = knownCollections\.has\(collectionId\) \? collectionId : current\.collections\[0\]\.id;/);
  assert.match(page, /withCuratorPicks\(storedMarks, dateLabel\)/);
  assert.match(page, /\[CURATOR_COLLECTION, \.\.\.storedCollections\]/);
  // "가득 참" 은 저장되는 도감에만 해당합니다.
  assert.match(page, /storedCollections\.filter\(\(collection\) => countInCollection/);
  // 읽기 전용: 담기·빼기·메모 자리가 없습니다.
  assert.match(receipt, /collections\.filter\(\(collection\) => collection\.id !== CURATOR_COLLECTION_ID\)/);
  assert.match(codex, /const readOnly = activeCollection\.id === CURATOR_COLLECTION_ID;/);
  assert.match(codex, /\{readOnly \? null : \(\s*\n\s*<input className="codex__note"/);
  assert.match(codex, /disabled=\{readOnly \|\| collections\.length < 2\}/);
  assert.match(codex, /큐레이터 픽은 지울 수 없어/);
});

/**
 * app/data/geo.ts 의 BOUNDS. 지형·핀·경계가 전부 이 한 식을 씁니다.
 * 베껴 두지 않고 읽어 옵니다 — 창을 옮길 때 조용히 어긋나는 자리라서요.
 */
const BOUNDS = await (async () => {
  const source = await readFile(new URL("../app/data/geo.ts", import.meta.url), "utf8");
  const read = (key) => Number(source.match(new RegExp(`${key}: ([-\\d.]+),`))[1]);
  return { west: read("west"), east: read("east"), north: read("north"), south: read("south") };
})();
const projectTo100 = (lng, lat) => [
  ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * 100,
  ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * 100,
];

/** "M1 2L3 4Z" → 고리들. 경계는 전부 직선이라 이렇게 풀립니다. */
function loopsOfPath(path) {
  return path
    .split("M")
    .filter((part) => part.trim())
    .map((part) => part.replace("Z", "").split("L").map((point) => point.split(" ").map(Number)));
}

/** 교차수 판정. app/data/districts.ts 의 inside 와 같은 식입니다. */
function pointInLoops(loops, x, y) {
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

function parseDistricts(source) {
  return [...source.matchAll(
    /id: "([^"]*)", level: (\d), name: "([^"]*)", parent: "([^"]*)", label: \[([-\d.]+), ([-\d.]+)\], path: "([^"]+)"/g,
  )].map((m) => ({
    id: m[1], level: Number(m[2]), name: m[3], parent: m[4],
    label: [Number(m[5]), Number(m[6])],
    path: m[7],
  }));
}

test("행정경계는 통계청 읍면동을 합쳐 만든 실제 경계다", async () => {
  const [core, dong, generator] = await Promise.all(
    ["../app/data/districts-data.ts", "../app/data/districts-dong.ts", "../build/districts.py"]
      .map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  const districts = [...parseDistricts(core), ...parseDistricts(dong)];
  const gu = districts.filter((entry) => entry.level === 2);
  const dongs = districts.filter((entry) => entry.level === 3);
  // 시군구 일흔몇, 읍면동 천 몇백. 지어낸 경계였을 때와 자릿수가 다릅니다.
  assert.ok(gu.length > 60, `시군구가 ${gu.length}칸뿐입니다`);
  assert.ok(dongs.length > 900, `읍면동이 ${dongs.length}칸뿐입니다`);
  // 시도는 한 칸으로 안 씁니다 — 서울 하나가 화면의 절반이라 짚을 것이 못 됩니다.
  assert.equal(districts.filter((entry) => entry.level === 1).length, 0);
  assert.deepEqual([...new Set(gu.map((entry) => entry.parent))].sort(), ["경기", "서울", "인천"]);

  // 이름은 겹쳐도 (서울 중구·인천 중구) id 는 갈려야 합니다.
  assert.equal(new Set(districts.map((entry) => entry.id)).size, districts.length);
  assert.ok(gu.some((entry) => entry.id === "2 서울 중구"));
  assert.ok(gu.some((entry) => entry.id === "2 인천 중구"));

  for (const district of districts) {
    // 이름표가 구역 밖으로 나가면 엉뚱한 동네 위에 이름이 떠 있게 됩니다.
    assert.ok(
      pointInLoops(loopsOfPath(district.path), district.label[0], district.label[1]),
      `${district.id} 이름표가 구역 밖입니다`,
    );
  }

  // 시군구·시도는 읍면동을 합쳐 만듭니다. 따로 그리면 단계가 바뀔 때 윤곽이 어긋납니다.
  assert.match(generator, /def dissolve\(rings\):/);
  assert.match(generator, /if count == 1/);
  assert.match(generator, /raise SystemExit\(f"윤곽이 안 닫힙니다/);
  // 읍면동은 천 칸이 넘어 따로 굽고, 그 배율에 닿을 때 불러옵니다.
  assert.match(core, /export const districts: District\[\]/);
  assert.match(dong, /export const dongDistricts: District\[\]/);
  assert.doesNotMatch(core, /dongDistricts/);
});

test("마우스를 얹은 시·구는 경계가 밝아지고 그 안의 카페가 펴진다", async () => {
  const [canvas, lookup, css] = await Promise.all(
    ["../app/components/MapCanvas.tsx", "../app/data/districts.ts", "../app/globals.css"]
      .map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  // 판정은 DOM 이 아니라 꼭짓점으로 합니다 — 매 프레임 불러도 되고 서버에서도 같은 답입니다.
  assert.match(lookup, /export function districtAt\(x: number, y: number, level: DistrictLevel\): District \| null/);
  assert.match(lookup, /export function districtsAtLevel\(level: DistrictLevel\): District\[\]/);
  // 카페는 경계 데이터에 적어 두지 않습니다 — 경계는 통계청, 카페는 따로 모으는
  // 것이라 한 파일에 묶으면 한쪽이 바뀔 때마다 다른 쪽을 다시 구워야 합니다.
  assert.match(lookup, /export function cafesIn\(district: District\): Cafe\[\]/);
  assert.match(lookup, /export function loadDongDistricts\(\): Promise<void>/);
  assert.match(lookup, /import\("\.\/districts-dong"\)/);
  assert.match(lookup, /crossings % 2 === 1/);
  assert.doesNotMatch(lookup, /isPointInFill|document\./);


  // 화면 좌표를 겹의 변형 그대로 되돌립니다. 확대·이동 중에도 커서 밑을 짚습니다.
  assert.match(canvas, /function districtUnder\(clientX: number, clientY: number\)/);
  assert.match(canvas, /spot\.x \+ \(\(clientX - rect\.left\) \/ rect\.width\) \* spot\.w/);
  assert.match(canvas, /spot\.y \+ \(\(clientY - rect\.top\) \/ rect\.height\) \* spot\.h/);

  // 이름이 아니라 id 로 견줍니다 — 중구가 둘이라 이름으로 보면 같은 곳이 됩니다.
  assert.match(canvas, /setHovered\(\(current\) => \(current\?\.id === next\?\.id \? current : next\)\)/);
  assert.match(canvas, /<path key=\{hovered\.id\} d=\{hovered\.path\} \/>/);
  assert.match(canvas, /\{hovered\.parent \? `\$\{hovered\.parent\} · ` : ""\}<span className="tabular">카페 \{hoveredCafes\.length\}곳<\/span>/);

  // 손가락에는 "올려 두기"가 없어 켜진 채로 남습니다.
  assert.match(canvas, /if \(event\.pointerType !== "mouse"\) return;/);
  // 짚어 둔 동네는 지도를 실제로 옮기기 시작할 때 놓습니다. 누르는 순간에 놓아
  // 버리면 손가락으로 톡 쳤을 때 방금 켠 것인지 원래 켜져 있던 것인지 알 수 없습니다.
  assert.match(canvas, /if \(Math\.hypot\(event\.clientX - drag\.startX, event\.clientY - drag\.startY\) > TAP_SLOP\) setHovered\(null\);/);
  assert.doesNotMatch(canvas, /setDragging\(true\);\s*\n\s*setHovered\(null\);/);
  assert.match(canvas, /onPointerLeave=\{onPointerLeave\}/);

  // 줌아웃 상태에서도 얹은 동네는 통째로 펴집니다.
  assert.match(canvas, /const hoveredIds = hovered && zoomedIn \? new Set\(hoveredCafes\.map\(\(cafe\) => cafe\.id\)\) : null;/);
  // 확대하다 단계가 바뀌면 짚어 둔 칸은 이제 지도에 없는 모양입니다.
  assert.match(canvas, /if \(!current \|\| current\.level === level\) return current;/);

  // 강조 겹은 지형과 따로 둡니다 — 같이 두면 옅은 채움이 강 위에도 얹힙니다.
  assert.match(canvas, /<div className="map__layer map__regions"/);
  assert.match(css, /\.map__regions \{\s*\n\s*z-index: 3;/);
  assert.match(css, /\.map__pins,\s*\n\.map__places,\s*\n\.map__regions \{\s*\n\s*pointer-events: none;/);
  assert.match(css, /\.map\.is-dragging \.map__regions \{\s*\n\s*display: none;/);
  // 이름표도 자기 자리를 셈해서 놓입니다. 되돌리기는 없습니다.
  assert.match(canvas, /const labelSpot = hovered \? toScreen\(hovered\.label\[0\], hovered\.label\[1\]\) : \{ x: 0, y: 0 \};/);
  assert.match(canvas, /style=\{\{ left: `\$\{labelSpot\.x\}%`, top: `\$\{labelSpot\.y\}%` \}\}/);

  // 손가락에는 올려 두기가 없으니 톡 쳐서 고릅니다. 떼는 순간 따라오는
  // pointerleave 를 그대로 받으면 방금 고른 동네가 켜지자마자 꺼집니다.
  assert.match(canvas, /const TAP_SLOP = 10;/);
  assert.match(canvas, /if \(moved > TAP_SLOP\) return;\s*\n\s*setHovered\(districtUnder\(event\.clientX, event\.clientY\)\);/);
  assert.match(canvas, /function onPointerLeave\(event: ReactPointerEvent<HTMLElement>\) \{\s*\n\s*if \(event\.pointerType === "mouse"\) setHovered\(null\);/);
});

test("에셋 주소는 사이트가 선 자리를 따라간다", async () => {
  const [basePath, beanArt, exporter, page] = await Promise.all(
    ["../app/base-path.ts", "../app/components/BeanArt.tsx", "../app/codex-export.ts", "../app/page.tsx"]
      .map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  // 기준은 <base> 태그 하나. 없으면 빈 문자열이라 뿌리에 선 사이트는 지금까지와 같습니다.
  assert.match(basePath, /export const BASE_PATH = \(\(\) => \{/);
  assert.match(basePath, /if \(typeof document === "undefined"\) return "";/);
  assert.match(basePath, /document\.querySelector\("base"\)\?\.getAttribute\("href"\)/);
  assert.match(basePath, /export function asset\(path: string\) \{\s*\n\s*return `\$\{BASE_PATH\}\$\{path\}`;/);
  // 주소 다루는 자리와 파일 가리키는 자리가 같은 값을 봐야 합니다.
  assert.match(page, /import \{ BASE_PATH \} from "\.\/base-path";/);
  assert.doesNotMatch(page, /const BASE_PATH = /);

  // 코드에 박은 경로는 번들러가 안 고칩니다 — CSS 의 url() 만 빌드가 고쳐 줍니다.
  // 그래서 파일을 부르는 자리는 전부 asset() 을 거쳐야 합니다.
  assert.match(beanArt, /<img src=\{asset\(preset\.src\)\}/);
  assert.match(exporter, /image\.src = asset\("\/tex\/grain-128\.png"\);/);

  // 앞에 빗금을 단 경로를 그대로 넘기는 자리가 남아 있으면 하위 경로에서 404 가 됩니다.
  const sources = await Promise.all(
    ["../app/page.tsx", "../app/codex-export.ts", "../app/components/BeanArt.tsx", "../app/components/Codex.tsx",
     "../app/components/Receipt.tsx", "../app/components/MapCanvas.tsx", "../app/components/Drawer.tsx"]
      .map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  for (const source of sources) {
    // 표에 적어 둔 경로는 그대로 둡니다 — 자리는 데이터고, 기준은 쓰는 자리에서 붙습니다.
    // 잡아야 하는 건 그 경로를 그대로 브라우저에 넘기는 자리입니다.
    const raw = source.match(/(?:\.src\s*=\s*|src=\{?)"\/(?:mascot|tex)\//g) ?? [];
    assert.deepEqual(raw, [], `asset() 없이 쓴 경로가 남아 있습니다: ${raw.join(", ")}`);
  }
});

test("빈 도감을 편 사람에게 비빈이 보인다", async () => {
  const [page, codex] = await Promise.all(
    ["../app/page.tsx", "../app/components/Codex.tsx"].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  // 전체 기록으로 세면 큐레이터 픽이 늘 열 곳을 채우고 있어 영영 0이 되지 않습니다.
  assert.match(page, /const activeCollectionEmpty = !marks\.some\(\(mark\) => mark\.collectionIds\.includes\(activeCollection\.id\)\);/);
  assert.match(page, /panelOpen && panel === "codex" && activeCollectionEmpty/);
  assert.doesNotMatch(page, /panel === "codex" && marks\.length === 0/);
  // 도감 쪽의 빈 자리 판정과 같은 이야기를 해야 비빈이 실제로 그 자리에 섭니다.
  assert.match(codex, /activeMarks\.length === 0 \? \(/);
  assert.match(codex, /\{showMascot \? <Bibin variant="diary-writing" size=\{88\} \/> : null\}/);
});

test("목업 카페의 주소는 좌표가 실제로 놓인 행정구역과 맞는다", async () => {
  const [cafes, core] = await Promise.all(
    ["../app/data/cafes.ts", "../app/data/districts-data.ts"].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  const districts = parseDistricts(core).map((district) => ({ ...district, loops: loopsOfPath(district.path) }));
  const rows = [...cafes.matchAll(
    /id: "(demo-\d+)", name: "([^"]+)"[\s\S]*?address: "([^"]+)", tel: "([^"]+)"[\s\S]*?pos: \[([-\d.]+), ([-\d.]+)\]/g,
  )];
  assert.equal(rows.length, 80);

  const code = { 서울: "02", 경기: "031", 인천: "032" };
  for (const [, id, name, address, tel, lng, lat] of rows) {
    const [x, y] = projectTo100(Number(lng), Number(lat));
    const found = districts.filter((district) => pointInLoops(district.loops, x, y));
    // 시군구는 겹치지 않게 지도를 덮으므로 정확히 한 칸이어야 합니다.
    assert.equal(found.length, 1, `${id} ${name} 이 ${found.length}칸에 걸쳐 있습니다`);
    const where = `${found[0].parent} ${found[0].name}`;
    assert.ok(address.startsWith(where), `${id} ${name}: 주소 "${address}" 인데 좌표는 ${where}`);
    // 지역번호도 따라가야 합니다 — 김포에서 인천으로 옮긴 곳은 031 이 아니라 032 입니다.
    assert.ok(tel.startsWith(code[found[0].parent]), `${id} ${name}: ${where} 인데 전화가 ${tel}`);
  }
});

test("좁은 화면에서는 검색이 단추 하나로 접힌다", async () => {
  const [page, css] = await Promise.all(
    ["../app/page.tsx", "../app/globals.css"].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  // 메뉴와 검색이 왼쪽에 나란히 서고, 상호는 가운데, 도감은 오른쪽입니다.
  assert.match(page, /<div className="topbar__tools">/);
  assert.match(page, /<button className="menu-button"[\s\S]{0,400}<button\s*\n\s*className="search-button"/);
  assert.match(page, /<Search aria-hidden="true" \/>/);
  assert.match(page, /aria-expanded=\{searchOpen\}/);
  assert.match(page, /aria-controls="search-panel"/);

  // 펴면 바로 칠 수 있어야 합니다 — 단추 누르고 칸을 또 누르면 두 번 만지는 셈입니다.
  assert.match(page, /if \(searchOpen\) searchRef\.current\?\.focus\(\);/);

  // 넓은 화면에서는 검색 종이가 늘 펴져 있으므로 같은 일을 하는 단추를 두지 않습니다.
  assert.match(css, /\.search-button \{\s*\n\s*display: none;/);
  assert.match(css, /@media \(max-width: 767px\) \{[\s\S]*?\.search-button \{\s*\n\s*display: inline-flex;/);
  assert.match(css, /@media \(max-width: 767px\) \{[\s\S]*?\.search-panel \{\s*\n\s*display: none;\s*\n\s*\}\s*\n\s*\.search-panel\.is-open \{/);

  // 상호는 화면 한가운데에 섭니다. 양옆 칸을 auto 로 두면 넓은 쪽(메뉴·검색)만큼
  // 밀려서, 왼쪽에 단추가 하나 늘 때마다 상호가 오른쪽으로 갑니다.
  assert.match(css, /\.topbar \{[^}]*grid-template-columns: 1fr auto 1fr;/s);
  assert.doesNotMatch(css, /grid-template-columns: auto 1fr auto/);
  assert.match(css, /\.topbar__actions \{\s*\n\s*justify-self: end;/);
  // 검색 종이도 좌우 여백을 같게 둡니다.
  assert.match(css, /\.search-panel \{\s*\n\s*top: 90px;\s*\n\s*left: var\(--rail\);\s*\n\s*right: var\(--rail\);\s*\n\s*width: auto;/);

  // 종이가 펴진 동안에는 지도를 만지는 게 아니라 고르는 중입니다.
  assert.match(page, /data-search-open=\{searchOpen\}/);
  assert.match(css, /\.app-shell\[data-search-open="true"\] \.map__tools \{\s*\n\s*opacity: 0;\s*\n\s*pointer-events: none;/);

  // 도감은 숫자만 남으면 무엇의 수인지 알 수 없습니다 — 좁은 화면에서는 아이콘 하나.
  assert.match(page, /<BookMarked aria-hidden="true" \/>/);
  assert.match(css, /\.marks-button strong\.marks-button__count \{\s*\n\s*display: none;/);
});

test("아이콘은 한 벌 · 한 굵기다", async () => {
  const [icons, layout, css, ...views] = await Promise.all(
    [
      "../app/icons.ts",
      "../app/layout.tsx",
      "../app/globals.css",
      "../app/page.tsx",
      "../app/components/Drawer.tsx",
      "../app/components/Codex.tsx",
      "../app/components/Receipt.tsx",
      "../app/components/MapCanvas.tsx",
      "../app/components/CodexIcon.tsx",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  // 굵기와 기본 크기는 한 군데에만 적습니다. 아이콘마다 적어 두면 늘리거나
  // 줄일 때 한둘이 빠져 결국 굵기가 섞입니다.
  assert.match(icons, /export const ICON_STROKE = 1\.5;/);
  assert.match(icons, /export const ICON = \{ sm: 15, md: 18 \} as const;/);
  // absoluteStrokeWidth 가 없으면 24칸 기준이라 작은 아이콘일수록 선이 가늘어집니다.
  assert.match(layout, /<LucideProvider size=\{ICON\.md\} strokeWidth=\{ICON_STROKE\} absoluteStrokeWidth>/);

  for (const view of views) {
    // 굵기를 따로 적은 아이콘이 하나라도 있으면 그 하나만 다른 손으로 그린 게 됩니다.
    assert.doesNotMatch(view, /strokeWidth=/);
    // 크기는 두 단뿐입니다 — 12·14·15·16·17 이 섞여 있던 자리입니다. 비빈과
    // 도감 마크는 아이콘이 아니라 손으로 그린 브랜드 표식이라 셈에서 뺍니다.
    assert.doesNotMatch(view, /<(?!CodexMark|BeanMark|BeanStamp|Bibin)[A-Z][A-Za-z]* size=\{[0-9]+\}/);
    // 폰트 글리프로 그린 아이콘은 lucide 와 굵기가 맞지 않습니다. 주석의 화살표는
    // 글이지 아이콘이 아니므로 먼저 걷어냅니다.
    const markup = view.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(markup, /[\u2715\u00d7\u2192\u2197\u2315\u25d0\u25d1\u25d2]/);
  }

  // 메뉴 단추도 CSS 로 그린 두 줄이 아니라 같은 벌의 아이콘입니다.
  assert.match(views[0], /<Menu aria-hidden="true" \/>/);
  assert.doesNotMatch(css, /\.menu-button span/);
});

test("검색 종이는 같은 말을 두 번 하지 않는다", async () => {
  const [page, css] = await Promise.all(
    ["../app/page.tsx", "../app/globals.css"].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  // "이건 찾는 칸이다"를 라벨·돋보기·플레이스홀더로 세 번 말하던 자리입니다.
  // 이제 머리줄의 "찾기" 한 낱말만 집니다.
  assert.match(page, /<p className="search-panel__head">/);
  assert.match(page, /<span aria-hidden="true">찾기<\/span>/);
  assert.doesNotMatch(page, /어디로 갈까/);
  assert.doesNotMatch(page, /search-field__glyph/);
  // 화면에서 뺀 이름은 소리로는 남아야 합니다.
  assert.match(page, /<label className="sr-only" htmlFor="cafe-search">/);
  assert.match(css, /\.sr-only \{[^}]*clip-path: inset\(50%\)/s);

  // 오른쪽 끝 한 자리가 한 번에 한 가지만 말합니다 — 빈 칸이면 단축키,
  // 걸린 곳이 있으면 그 수, 한 곳도 없으면 비빈이 말하므로 비웁니다.
  assert.match(page, /!query\.trim\(\) \? \(\s*\n\s*<span className="chip" aria-hidden="true">\/<\/span>/);
  assert.match(page, /\) : matches\.length \? \(\s*\n\s*<b className="tabular">\{matches\.length\}건<\/b>\s*\n\s*\) : null/);
  assert.doesNotMatch(page, /search-results__foot/);

  // 각진 상자가 아니라 적어 넣는 줄 하나. 종이 안에 테두리를 한 겹 더 두지 않습니다.
  assert.match(css, /\.search-field \{[^}]*border-bottom: 1\.5px solid var\(--ink-soft\);/s);
  assert.doesNotMatch(css, /\.search-field \{[^}]*border: 1px solid/s);
  assert.doesNotMatch(css, /\.search-results \{[^}]*border: 1px solid/s);
  assert.match(css, /\.search-results__list > button \+ button \{\s*\n\s*border-top: 1px dashed/);

  // 좁은 화면에서는 머리줄을 통째로 감춥니다 — 종이에 남는 건 칠 자리뿐입니다.
  assert.match(css, /@media \(max-width: 767px\) \{[\s\S]*?\.search-panel__head \{\s*\n\s*display: none;/);
});

test("좁은 화면의 시트는 잘리고, 조금만 튕겨도 내려간다", async () => {
  const [page, receipt, drag, css] = await Promise.all(
    ["../app/page.tsx", "../app/components/Receipt.tsx", "../app/useSheetDrag.ts", "../app/globals.css"]
      .map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  // 흐르는 자리는 손잡이 **아래**입니다. 하나로 두면 종이가 손잡이 뒤로 흘러
  // 들어가 상호 위에 겹칩니다 — 잘려야 할 자리입니다.
  assert.match(page, /<div className="dock__scroll">/);
  assert.match(css, /\.dock \{[^}]*overflow: hidden;/s);
  assert.match(css, /\.dock__scroll \{[^}]*overflow-y: auto;[\s\S]*?overscroll-behavior: contain;/s);
  assert.doesNotMatch(css, /\.sheet-handle \{\s*\n\s*position: sticky/);

  // 시트에서는 상세가 접힘의 대상이 아닙니다 — 단추 자체를 두지 않습니다.
  assert.match(page, /sheet=\{isSheet\}/);
  assert.match(receipt, /const showDetail = sheet \|\| detailOpen;/);
  assert.match(receipt, /\{sheet \? null : \(\s*\n\s*<div className="receipt__actions">/);

  // 내려가는 건 거리가 아니라 기세입니다. 끌던 속도로 한 자리씩 옮깁니다.
  assert.match(drag, /const FLICK = 0\.25;/);
  assert.match(drag, /if \(velocity > FLICK\)/);
  assert.match(drag, /if \(velocity < -FLICK\)/);
  // 끌고 나서 떼는 것도 click 을 부르므로, 끈 손짓이면 탭 처리는 물러납니다.
  assert.match(drag, /if \(gesture\.current\.moved > TAP_SLOP\) return;/);
  // 자리를 state 로 들고 있으면 손가락이 움직이는 프레임마다 화면 전체가 다시 그려집니다.
  assert.match(drag, /sheet\.style\.setProperty\("--sheet-y", `\$\{y\}px`\)/);
  assert.doesNotMatch(drag, /setDragY/);
});

test("지도는 보이는 칸만 그리고, 한 프레임에 한 번만 다시 그린다", async () => {
  const [canvas, surface, lookup, page] = await Promise.all(
    ["../app/components/MapCanvas.tsx", "../app/components/MapSurface.tsx", "../app/data/districts.ts", "../app/page.tsx"]
      .map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  // 읍면동 1,100칸 중 화면에 실제로 걸치는 건 수십 칸입니다. 나머지를 DOM 에
  // 만들어 두면 만드는 값도 값이거니와 확대할 때마다 안 보이는 길까지 훑습니다.
  assert.match(lookup, /export function piecesInView\(level: DistrictLevel, box: Bounds\): DistrictPiece\[\]/);
  assert.match(lookup, /if \(bx1 < x0 \|\| bx0 > x1 \|\| by1 < y0 \|\| by0 > y1\) continue;/);
  // 고리는 짚어 볼 때만 풉니다 — 천 칸을 통째로 푸는 건 폰에서 150ms 짜리 일입니다.
  assert.match(lookup, /function loopsFor\(shape: Shape\): Loop\[\]/);
  assert.match(lookup, /shape\.loops \?\?= loopsOf\(shape\.district\.path\);/);
  assert.match(lookup, /if \(x < x0 \|\| x > x1 \|\| y < y0 \|\| y > y1\) continue;/);
  // 색은 그리기 전에 정해 둡니다. 그릴 때 자리로 세면 밀 때마다 색이 바뀝니다.
  assert.match(lookup, /tint: index % 3/);

  // 끌거나 확대해도 길 자체는 그대로입니다 — 바뀌는 건 창(viewBox) 하나뿐입니다.
  assert.match(canvas, /const Terrain = memo\(function Terrain\(\{ pieces \}/);
  assert.match(canvas, /const MarkerFace = memo\(function MarkerFace/);
  assert.match(canvas, /<Terrain pieces=\{pieces\} \/>/);
  // 손가락은 프레임보다 자주 옵니다. 값은 곧바로, 다시 그리기는 한 프레임에 한 번.
  assert.match(canvas, /function commitViewSoon\(next: View\)/);
  assert.match(canvas, /if \(next\) commitViewSoon\(next\);/);
  assert.match(canvas, /flushView\(\);/);
  // 검색어 한 글자마다 지도가 딸려 오지 않게 한 번 끊습니다.
  assert.match(surface, /export const MapSurface = memo\(function MapSurface/);
  // memo 는 넘겨주는 손잡이가 렌더마다 새로 만들어지지 않아야 뜻이 있습니다.
  assert.match(page, /const openCafe = useCallback\(\(id: string\) => \{/);
});
