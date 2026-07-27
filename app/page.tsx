"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Bibin, CodexMark } from "./components/BeanArt";
import { Codex } from "./components/Codex";
import { Drawer } from "./components/Drawer";
import { MapSurface } from "./components/MapSurface";
import { Receipt } from "./components/Receipt";
import { cafes, type Cafe } from "./data/cafes";
import { colorValue, setCafeInCollection, useCodex } from "./marks";
import { applyTheme, useTheme } from "./theme";
import { useSheetDrag } from "./useSheetDrag";

/**
 * 영수증은 세 가지 자리 중 하나에 있습니다 (03_기능_명세 §2).
 *   intro  — 아직 안 나옴. 로드 400ms 뒤 center 로 넘어갑니다.
 *   center — 첫 진입. 화면 한가운데서 프린트됩니다.
 *   docked — 우측 패널(모바일은 하단 시트).
 *   closed — 접힘. "다시 보기" 탭만 남습니다.
 */
type Phase = "intro" | "center" | "docked" | "closed";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** 서버와 클라이언트가 같은 "오늘"을 봐야 하므로 KST를 고정 오프셋으로 계산합니다. */
function kstParts(now: Date) {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return {
    date: `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}`,
    time: `${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`,
  };
}

function hash(value: string) {
  return [...value].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 7);
}

/**
 * 발행 시각은 페이지를 연 순간으로 한 번만 굳힙니다.
 * 서버에서는 null 이라 하이드레이션이 어긋나지 않고, 클라이언트에서는 매 렌더
 * 같은 값이 나와야 하므로 모듈 스코프에 담아 둡니다.
 */
let issuedAt: string | null = null;
const neverChanges = () => () => {};

function readIssuedAt() {
  if (issuedAt === null) issuedAt = kstParts(new Date()).time;
  return issuedAt;
}

/**
 * 주소창이 상태를 반영하되 페이지를 새로 그리지는 않습니다 (03_기능_명세 §1).
 * 공유·뒤로가기·새로고침이 모두 살아 있어야 카페 한 곳을 링크로 넘길 수 있고,
 * 그게 브랜드가 퍼지는 경로입니다.
 */
/** 하단 시트로 내려가는 폭. globals.css 의 767px 분기와 같은 값이어야 합니다. */
const SHEET_QUERY = "(max-width: 767px)";

function subscribeSheetQuery(onChange: () => void) {
  const media = window.matchMedia(SHEET_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function readSheetQuery() {
  return window.matchMedia(SHEET_QUERY).matches;
}

type Route = { panel: "receipt" | "codex"; cafeId: string | null };

function readRoute(pathname: string): Route | null {
  if (pathname === "/marks") return { panel: "codex", cafeId: null };
  const cafeMatch = /^\/c\/([^/]+)$/.exec(pathname);
  if (cafeMatch) {
    const id = decodeURIComponent(cafeMatch[1]);
    if (cafes.some((cafe) => cafe.id === id)) return { panel: "receipt", cafeId: id };
  }
  return null;
}

/**
 * 주소를 상태로 삼습니다. 열린 카드를 React state 에 따로 복사해 두면 뒤로가기와
 * 어긋나기 시작하므로, pushState 뒤에 이 이벤트를 쏘아 한 곳만 보게 합니다.
 */
const NAVIGATE_EVENT = "wondudogam:navigate";

function subscribeLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(NAVIGATE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(NAVIGATE_EVENT, onChange);
  };
}

function readPathname() {
  return window.location.pathname;
}

function navigate(pathname: string) {
  if (window.location.pathname === pathname) return;
  window.history.pushState({}, "", pathname);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

export default function Home() {
  const theme = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [query, setQuery] = useState("");
  const { collections, marks } = useCodex();
  const [activeCollectionId, setActiveCollectionId] = useState("default");
  const [notice, setNotice] = useState("");
  const [codexPreviewId, setCodexPreviewId] = useState<string | null>(null);
  const timeLabel = useSyncExternalStore(neverChanges, readIssuedAt, () => null);
  const [tear, setTear] = useState<{ dx: number; dy: number; x: number; y: number; w: number; name: string } | null>(null);

  const marksButtonRef = useRef<HTMLButtonElement>(null);
  const isSheet = useSyncExternalStore(subscribeSheetQuery, readSheetQuery, () => false);
  const pathname = useSyncExternalStore(subscribeLocation, readPathname, () => "/");
  const route = useMemo(() => readRoute(pathname), [pathname]);

  /** 도크 자리에 놓인 종이. 영수증과 내 도감이 같은 자리를 나눠 씁니다. */
  const panel = route?.panel ?? "receipt";
  const selectedId = route?.cafeId ?? "";

  const dateLabel = useMemo(() => kstParts(new Date()).date, []);

  // 03 §2 — 후보 풀은 협력업체와 승격 카페뿐입니다. 소개할 내용이 없는 카페를
  // "오늘의 카페"로 뽑으면 카드가 텅 빕니다.
  const dailyCafe = useMemo(() => {
    const pool = cafes.filter((cafe) => cafe.partner);
    return pool[hash(dateLabel) % pool.length];
  }, [dateLabel]);

  const displayedCafe = cafes.find((cafe) => cafe.id === selectedId) ?? dailyCafe;
  const codexPreviewCafe = cafes.find((cafe) => cafe.id === codexPreviewId) ?? null;
  const partnerCount = cafes.filter((cafe) => cafe.partner).length;

  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko");
    if (!normalized) return [];
    return cafes.filter((cafe) =>
      `${cafe.name} ${cafe.romanized} ${cafe.area} ${cafe.partner ? cafe.intro : cafe.guess}`
        .toLocaleLowerCase("ko")
        .includes(normalized),
    );
  }, [query]);

  const emptyResult = query.trim().length > 0 && matches.length === 0;

  const activeCollection = collections.find((collection) => collection.id === activeCollectionId) ?? collections[0];
  const savedMarkers = useMemo(() => {
    const result: Record<string, { color: string; icon: typeof collections[number]["icon"]; count: number; collectionName: string }> = {};
    for (const mark of marks) {
      const memberships = collections.filter((collection) => mark.collectionIds.includes(collection.id));
      if (!memberships.length) continue;
      const primary = memberships.find((collection) => collection.id === activeCollection?.id) ?? memberships[0];
      result[mark.id] = { color: colorValue(primary.color), icon: primary.icon, count: memberships.length, collectionName: primary.name };
    }
    return result;
  }, [marks, collections, activeCollection?.id]);

  /**
   * 주소에 카드가 적혀 있으면 그게 이깁니다. 링크로 들어왔거나 뒤로가기로 돌아온
   * 경우이므로 프린트 연출 없이 도크에 놓입니다. 주소가 "/" 로 돌아오면 그때부터
   * 다시 로컬 상태(intro → center → closed)를 따릅니다.
   */
  const effectivePhase: Phase = route ? "docked" : phase;
  const panelOpen = effectivePhase === "center" || effectivePhase === "docked";

  /** 첫 진입 중이면 한 번 접어 도크로 보내고, 이미 도크에 있으면 닫습니다. */
  const closePanel = useCallback(() => {
    setCodexPreviewId(null);
    setPhase((current) => (current === "center" ? "docked" : "closed"));
    navigate("/");
  }, []);

  const dock = useCallback(() => {
    setPhase((current) => (current === "center" ? "docked" : current));
  }, []);

  const sheet = useSheetDrag({ enabled: isSheet, onClose: closePanel });

  // 02 §7.3 — 한 화면에 비빈은 하나뿐. 급한 순서대로 자리를 넘겨줍니다.
  const mascotSlot: "toast" | "empty" | "codex" | null = notice
    ? "toast"
    : emptyResult
      ? "empty"
      : panelOpen && panel === "codex" && marks.length === 0
        ? "codex"
        : null;

  useEffect(() => {
    // 링크로 들어왔다면 프린트 연출은 건너뜁니다. 그건 첫 방문의 것이지,
    // 누가 보내준 카페를 열어본 사람의 것이 아닙니다.
    if (readRoute(window.location.pathname)) return;
    // 프린트 연출은 400ms 뒤. 모션을 줄인 사용자에게는 지연 없이 그냥 놓아둡니다.
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => setPhase("center"), instant ? 0 : 400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!collections.some((collection) => collection.id === activeCollectionId)) {
      setActiveCollectionId(collections[0]?.id ?? "default");
    }
  }, [collections, activeCollectionId]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!tear) return;
    const timer = window.setTimeout(() => setTear(null), 360);
    return () => window.clearTimeout(timer);
  }, [tear]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || sidebarOpen) return;
      if (codexPreviewId) {
        setCodexPreviewId(null);
        return;
      }
      closePanel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen, codexPreviewId, closePanel]);

  function openCafe(id: string) {
    setCodexPreviewId(null);
    setPhase("docked");
    setQuery("");
    navigate(`/c/${encodeURIComponent(id)}`);
  }

  function openCodex() {
    setCodexPreviewId(null);
    setPhase("docked");
    setSidebarOpen(false);
    navigate("/marks");
  }

  function openCafeFromCodex(id: string) {
    setCodexPreviewId(id);
  }

  function onToggleCollection(cafe: Cafe, collectionId: string, included: boolean, event: React.MouseEvent<HTMLButtonElement>) {
    setCafeInCollection(cafe.id, collectionId, dateLabel, included);
    const collection = collections.find((entry) => entry.id === collectionId);
    setNotice(included ? `${collection?.name ?? "도감"}에 넣었어.` : `${collection?.name ?? "도감"}에서 꺼냈어.`);
    const target = marksButtonRef.current?.getBoundingClientRect();
    if (included && target) {
      const origin = event.currentTarget.getBoundingClientRect();
      setTear({ x: origin.left, y: origin.top, w: origin.width, dx: target.left + target.width / 2 - (origin.left + origin.width / 2), dy: target.top + target.height / 2 - (origin.top + origin.height / 2), name: cafe.name });
    }
  }
  return (
    <main className="app-shell" data-phase={effectivePhase}>
      <a className="skip-link" href="#dock">
        영수증으로 건너뛰기
      </a>

      <MapSurface
        cafes={cafes}
        activeId={panelOpen ? (panel === "receipt" ? displayedCafe.id : codexPreviewCafe?.id ?? null) : null}
        savedMarkers={savedMarkers}
        onSelect={openCafe}
        onInteract={dock}
      />

      <header className="topbar">
        <button className="menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기">
          <span />
          <span />
        </button>
        <div className="topbar__brand">
          <CodexMark size={24} />
          <b>원두도감</b>
          <small>BEAN CODEX</small>
        </div>
        <div className="topbar__actions">
          <button className="theme-button" type="button" onClick={() => applyTheme(theme === "light" ? "dark" : "light")}>
            <span aria-hidden="true">{theme === "light" ? "◐" : "◑"}</span>
            {theme === "light" ? "묵은 종이" : "새 종이"}
          </button>
          <button
            className="marks-button"
            type="button"
            ref={marksButtonRef}
            onClick={openCodex}
            aria-label={`내 도감, ${marks.length}장 보관 중`}
            aria-pressed={panelOpen && panel === "codex"}
          >
            <span className="marks-button__label">내 도감</span>
            <strong className="tabular">{marks.length}</strong>
          </button>
        </div>
      </header>

      <section className="search-panel plate" aria-label="카페 찾기">
        <label className="label-ko" htmlFor="cafe-search">
          어디로 갈까
        </label>
        <div className="search-line">
          <input
            id="cafe-search"
            className="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="지역, 상호, 느낌"
            autoComplete="off"
          />
          <span aria-hidden="true">↵</span>
        </div>
        {query.trim() ? (
          <div className="search-results">
            {emptyResult ? (
              // 비빈의 말은 한 덩어리로 둡니다. 개수 줄과 나눠 놓으면 같은 사람이
              // 두 번 말하는 것처럼 읽힙니다 (02 §7.4).
              <div className="empty-state">
                <Bibin variant="map-lost" size={88} />
                <p>
                  여긴 아직 아무것도 없네.
                  <br />
                  범위를 넓혀볼까?
                </p>
                <button className="widen-button" type="button" onClick={() => setQuery("")}>
                  수도권 전체에서 다시 찾기
                </button>
              </div>
            ) : (
              <>
                <p className="search-results__count">
                  <i className="tabular">{matches.length}</i>곳
                </p>
                {matches.slice(0, 4).map((cafe) => (
                  <button key={cafe.id} type="button" onClick={() => openCafe(cafe.id)}>
                    <span>{cafe.name}</span>
                    <small>{cafe.area}</small>
                    {cafe.partner ? <b className="partner-badge">협력</b> : null}
                  </button>
                ))}
              </>
            )}
          </div>
        ) : null}
      </section>

      <div className="map-status plate">
        <span>수도권 전체</span>
        <span>
          협력업체 <i className="tabular">{partnerCount}</i>
        </span>
        <span className="map-status__note">목업 데이터</span>
      </div>

      {panelOpen ? (
        <>
          <div
            className={`stage-veil ${effectivePhase === "center" ? "is-on" : ""}`}
            aria-hidden="true"
          />
          <div
            className={[
              "dock",
              effectivePhase === "center" ? "is-center" : "is-docked",
              isSheet ? `is-sheet is-${sheet.snap}` : "",
              sheet.dragging ? "is-dragging" : "",
              panel === "codex" && codexPreviewCafe ? "has-preview" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            id="dock"
            style={sheet.style}
          >
            <button
              className="sheet-handle"
              type="button"
              aria-label={sheet.snap === "full" ? "시트 내리기" : "시트 올리기"}
              aria-expanded={sheet.snap === "full"}
              {...sheet.handleProps}
            />
            {panel === "codex" ? (
              <div className="dock__pair">
                {codexPreviewCafe ? (
                  <div className="dock__preview">
                    <Receipt
                      key={codexPreviewCafe.id}
                      cafe={codexPreviewCafe}
                      dateLabel={dateLabel}
                      timeLabel={timeLabel}
                      serial={String(hash(codexPreviewCafe.id + dateLabel) % 10000).padStart(4, "0")}
                      collections={collections}
                      selectedCollectionIds={marks.find((mark) => mark.id === codexPreviewCafe.id)?.collectionIds ?? []}
                      onToggleCollection={(collectionId, included, event) => onToggleCollection(codexPreviewCafe, collectionId, included, event)}
                      onClose={() => setCodexPreviewId(null)}
                    />
                  </div>
                ) : null}
                <div className="dock__codex">
                  <Codex
                    collections={collections}
                    marks={marks}
                    activeCollectionId={activeCollection.id}
                    onSelectCollection={setActiveCollectionId}
                    dateLabel={dateLabel}
                    showMascot={mascotSlot === "codex"}
                    activeCafeId={codexPreviewCafe?.id ?? null}
                    onOpenCafe={openCafeFromCodex}
                    onNotice={setNotice}
                    onClose={closePanel}
                  />
                </div>
              </div>
            ) : (
              <Receipt
                key={displayedCafe.id}
                cafe={displayedCafe}
                dateLabel={dateLabel}
                timeLabel={timeLabel}
                serial={String(hash(displayedCafe.id + dateLabel) % 10000).padStart(4, "0")}
                collections={collections}
                selectedCollectionIds={marks.find((mark) => mark.id === displayedCafe.id)?.collectionIds ?? []}
                onToggleCollection={(collectionId, included, event) => onToggleCollection(displayedCafe, collectionId, included, event)}
                onClose={closePanel}
              />
            )}
          </div>
        </>
      ) : (
        <button className="dock-tab plate" type="button" onClick={() => setPhase("docked")}>
          오늘의 영수증 다시 보기
        </button>
      )}

      {sidebarOpen ? (
        <Drawer
          markCount={marks.length}
          theme={theme}
          onTheme={applyTheme}
          onOpenCodex={openCodex}
          onClose={() => setSidebarOpen(false)}
        />
      ) : null}

      {tear ? (
        <div
          className="tear-ghost"
          aria-hidden="true"
          style={
            {
              left: tear.x,
              top: tear.y,
              width: tear.w,
              "--dx": `${tear.dx}px`,
              "--dy": `${tear.dy}px`,
            } as React.CSSProperties
          }
        >
          {tear.name}
        </div>
      ) : null}

      {notice ? (
        <div className="toast" role="status">
          <Bibin variant="delighted" size={52} />
          {notice}
        </div>
      ) : null}
    </main>
  );
}
