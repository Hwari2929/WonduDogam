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

test("확정 정보와 추정 정보가 시각적으로 구분된다", async () => {
  // 결정서 §3 Q34 — "이건 선택이 아니라 필수입니다."
  const [css, receipt] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/components/Receipt.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(css, /\.receipt--confirmed \.intro\s*\{[^}]*border-left:\s*2px solid/);
  assert.match(css, /\.receipt--guess \.intro\s*\{[^}]*border-left:\s*2px dashed/);
  assert.match(css, /\.receipt--guess \.intro\s*\{[^}]*color:\s*var\(--ink-faint\)/);
  // 추정 카드에는 도장이 없고 각주가 붙습니다.
  assert.match(receipt, /상호명과 위치로 자동 추정한 정보입니다/);
  assert.match(receipt, /confirmed \? \(\s*<div className="stamp"/);
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
  // 기기를 막 바꾼 순간이 바로 코드가 필요한 순간입니다.
  const source = await readFile(new URL("../app/components/Codex.tsx", import.meta.url), "utf8");
  assert.match(source, /\{mode === "list" \? \(\s*<button[^>]*onClick=\{\(\) => setMode\("import"\)\}/);
  // 덮어쓰기가 아니라 병합이어야 이쪽에서 뜯어둔 영수증이 살아남습니다.
  const marks = await readFile(new URL("../app/marks.ts", import.meta.url), "utf8");
  assert.match(marks, /export function mergeMarks/);
  assert.match(marks, /const added = incoming\.filter\(\(mark\) => !known\.has\(mark\.id\)\)/);
});

test("한 화면에 비빈은 하나뿐이다", async () => {
  // 02 §7.3. 브랜드 마크(CodexMark)와 지도 도장(BeanStamp)에는 얼굴이 없으므로
  // 마스코트로 세지 않습니다. 눈이 달린 <Bibin/> 만 mascotSlot 이 배분합니다.
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const mascots = page.match(/<Bibin\b/g) ?? [];
  assert.equal(mascots.length, 2, "토스트와 빈 결과 두 자리에서만 직접 그립니다");
  assert.match(page, /mascotSlot/);
  assert.match(page, /showSignature=\{mascotSlot === "signature"\}/);
});

test("primary map stays a local SVG editorial atlas", async () => {
  const [surface, canvas, layout, receipt] = await Promise.all([
    readFile(new URL("../app/components/MapSurface.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/MapCanvas.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/Receipt.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(surface, /<MapCanvas/);
  assert.doesNotMatch(surface, /KakaoMap|readMapKey|useSyncExternalStore/);
  assert.match(canvas, /className="map__terrain"/);
  assert.match(canvas, /terrain__district/);
  assert.doesNotMatch(layout, /kakao-map-key|KAKAO_MAP_KEY/);
  assert.match(receipt, /https:\/\/map\.kakao\.com/);
});
