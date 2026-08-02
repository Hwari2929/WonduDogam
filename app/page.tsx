"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BASE_PATH } from "./base-path";
import { Bibin, CodexMark } from "./components/BeanArt";
import { Codex } from "./components/Codex";
import { Drawer } from "./components/Drawer";
import { MapSurface } from "./components/MapSurface";
import { Receipt } from "./components/Receipt";
import { cafes, type Cafe } from "./data/cafes";
import { COLLECTION_LIMIT, CURATOR_COLLECTION, CURATOR_COLLECTION_ID, colorValue, countInCollection, setCafeInCollection, useCodex, withCuratorPicks } from "./marks";
import { applyTheme, nextTheme, useTheme, type Theme } from "./theme";
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
function kstToday(now: Date) {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}`;
}

function hash(value: string) {
  return [...value].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 7);
}

/** 02_디자인_시스템 §08 — 찾은 글자만 강조색으로. 굵기는 건드리지 않습니다. */
function highlight(name: string, query: string) {
  const needle = query.trim();
  if (!needle) return name;
  const at = name.toLocaleLowerCase("ko").indexOf(needle.toLocaleLowerCase("ko"));
  if (at < 0) return name;
  return (
    <>
      {name.slice(0, at)}
      <mark>{name.slice(at, at + needle.length)}</mark>
      {name.slice(at + needle.length)}
    </>
  );
}

/** 목록에 한 번에 보여 주는 줄 수. 다섯 줄이 넘으면 목록이 아니라 페이지입니다. */
const SEARCH_LIMIT = 5;

/** 상단 바에는 지금 놓인 종이 한 장만 적습니다 — 고를 수 있는 셋은 서랍에 있습니다. */
const PAPERS: Record<Theme, { hint: string; glyph: string }> = {
  light: { hint: "새 종이", glyph: "◐" },
  warm: { hint: "묵은 종이", glyph: "◑" },
  cool: { hint: "식은 종이", glyph: "◒" },
};

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
  const path = window.location.pathname;
  const inside = BASE_PATH && path.startsWith(BASE_PATH) ? path.slice(BASE_PATH.length) : path;
  return inside || "/";
}

function navigate(pathname: string) {
  if (readPathname() === pathname) return;
  window.history.pushState({}, "", `${BASE_PATH}${pathname}`);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

export default function Home() {
  const theme = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [query, setQuery] = useState("");
  /** 좁은 화면에서 검색 종이를 폈는가. 넓은 화면에서는 늘 펴져 있습니다. */
  const [searchOpen, setSearchOpen] = useState(false);
  const { collections: storedCollections, marks: storedMarks } = useCodex();
  // 첫 화면의 도감은 큐레이터 픽입니다. 아직 아무것도 담지 않은 사람에게
  // "나의 원두 도감"을 열어 주면 지도가 텅 빈 채로 시작합니다.
  const [activeCollectionId, setActiveCollectionId] = useState(CURATOR_COLLECTION_ID);
  const [notice, setNotice] = useState("");
  const [codexPreviewId, setCodexPreviewId] = useState<string | null>(null);
  const [tear, setTear] = useState<{ dx: number; dy: number; x: number; y: number; w: number; name: string } | null>(null);

  const [cursor, setCursor] = useState(0);
  const marksButtonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const isSheet = useSyncExternalStore(subscribeSheetQuery, readSheetQuery, () => false);
  const pathname = useSyncExternalStore(subscribeLocation, readPathname, () => "/");
  const route = useMemo(() => readRoute(pathname), [pathname]);

  /** 도크 자리에 놓인 종이. 영수증과 내 도감이 같은 자리를 나눠 씁니다. */
  const panel = route?.panel ?? "receipt";
  const selectedId = route?.cafeId ?? "";

  const dateLabel = useMemo(() => kstToday(new Date()), []);
  const paper = PAPERS[theme];

  /**
   * 오늘의 큐레이터 픽을 저장된 도감 앞에 겹칩니다. 저장소에는 없는 도감이라
   * 여기서 한 번 얹어 두면 아래로는 여느 도감과 똑같이 흐릅니다 — 다만 넣고
   * 빼는 쪽은 저장소가 막습니다.
   */
  const collections = useMemo(() => [CURATOR_COLLECTION, ...storedCollections], [storedCollections]);
  const marks = useMemo(() => withCuratorPicks(storedMarks, dateLabel), [storedMarks, dateLabel]);

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
  const visibleMatches = useMemo(() => matches.slice(0, SEARCH_LIMIT), [matches]);
  /**
   * 결과가 줄어드는 사이에도 커서는 목록 안에 있어야 합니다. 밖을 가리키면
   * 강조가 사라지고, aria-activedescendant 가 없는 id 를 가리키게 됩니다.
   */
  const cursorIndex = visibleMatches.length ? Math.min(cursor, visibleMatches.length - 1) : 0;

  const activeCollection = collections.find((collection) => collection.id === activeCollectionId) ?? collections[0];
  /** 이미 열 칸을 다 쓴 도감. 영수증에서 잠가 두지 않으면 눌러 보고서야 알게 됩니다. */
  const fullCollectionIds = useMemo(
    () => storedCollections.filter((collection) => countInCollection(marks, collection.id) >= COLLECTION_LIMIT).map((collection) => collection.id),
    [storedCollections, marks],
  );
  /**
   * 지도에서 도드라지는 건 **지금 고른 도감**에 담긴 곳뿐입니다. 모든 도감을
   * 한꺼번에 비추면 탭을 바꿔도 지도가 그대로라, 어느 도감을 보고 있는지가
   * 지도에서 사라집니다. 탭을 옮기면 지도도 따라 옮겨 갑니다.
   */
  const savedMarkers = useMemo(() => {
    const result: Record<string, { color: string; icon: typeof collections[number]["icon"]; count: number; collectionName: string }> = {};
    if (!activeCollection) return result;
    for (const mark of marks) {
      if (!mark.collectionIds.includes(activeCollection.id)) continue;
      result[mark.id] = {
        color: colorValue(activeCollection.color),
        icon: activeCollection.icon,
        count: mark.collectionIds.length,
        collectionName: activeCollection.name,
      };
    }
    return result;
  }, [marks, activeCollection]);

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

  // 검색 종이를 펴면 바로 칠 수 있어야 합니다. 단추를 누르고 다시 칸을 누르게
  // 하면 두 번 만지는 셈이 됩니다.
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // 02 §7.3 — 한 화면에 비빈은 하나뿐. 급한 순서대로 자리를 넘겨줍니다.
  //
  // 도감 자리는 "펴 놓은 도감이 비었을 때"입니다. 전체 기록으로 세면 큐레이터
  // 픽이 늘 열 곳을 채우고 있어서 영영 0이 되지 않고, 정작 빈 도감을 펴 놓은
  // 사람만 비빈을 못 봅니다.
  const activeCollectionEmpty = !marks.some((mark) => mark.collectionIds.includes(activeCollection.id));
  const mascotSlot: "toast" | "empty" | "codex" | null = notice
    ? "toast"
    : emptyResult
      ? "empty"
      : panelOpen && panel === "codex" && activeCollectionEmpty
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

  // 사라진 묶음을 가리키고 있으면 activeCollection(위)이 이미 첫 묶음으로
  // 되돌아갑니다. 저장된 id 까지 효과로 고쳐 쓸 필요는 없습니다.

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
      // §08 SEARCH 의 `/` 칩은 장식이 아니라 실제 단축키입니다.
      if (event.key === "/" && !sidebarOpen) {
        const active = document.activeElement;
        const typing = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
        if (!typing) {
          event.preventDefault();
          searchRef.current?.focus();
          return;
        }
      }
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
    setCursor(0);
    navigate(`/c/${encodeURIComponent(id)}`);
  }

  /**
   * §08 SEARCH 가 목록 아래에 "↑↓ 이동 · ⏎ 선택"이라고 적어 두었으므로 실제로
   * 그렇게 움직여야 합니다. 적어 놓고 안 되는 단축키가 제일 나쁩니다.
   */
  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (!query) return; // 빈 칸에서의 Esc 는 영수증 닫기(문서 핸들러)에 넘깁니다
      event.stopPropagation();
      setQuery("");
      setCursor(0);
      return;
    }
    if (!visibleMatches.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : visibleMatches.length - 1;
      // 목록 밖을 가리키던 커서에서 세면 엉뚱한 줄로 건너뜁니다. 보이는 자리에서 셉니다.
      setCursor((cursorIndex + step) % visibleMatches.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      openCafe(visibleMatches[cursorIndex].id);
    }
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
    const result = setCafeInCollection(cafe.id, collectionId, dateLabel, included);
    const collection = collections.find((entry) => entry.id === collectionId);
    // 자리가 없어 못 들어갔는데 뜯기는 시늉을 하면, 저장한 줄 알고 떠납니다.
    if (result === "full") {
      setNotice(`${collection?.name ?? "도감"}은 ${COLLECTION_LIMIT}곳이 다 찼어.`);
      return;
    }
    setNotice(result === "added" ? `${collection?.name ?? "도감"}에 넣었어.` : `${collection?.name ?? "도감"}에서 꺼냈어.`);
    const target = marksButtonRef.current?.getBoundingClientRect();
    if (result === "added" && target) {
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
        <div className="topbar__tools">
          <button className="menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기">
            <span />
            <span />
          </button>
          {/* 좁은 화면에서는 검색 종이가 지도를 덮고 앉아 있을 자리가 없습니다.
              단추 하나로 두고, 누를 때만 상단바 밑으로 펴집니다. */}
          <button
            className="search-button"
            type="button"
            onClick={() => setSearchOpen((open) => !open)}
            aria-label={searchOpen ? "검색 닫기" : "카페 찾기"}
            aria-expanded={searchOpen}
            aria-controls="search-panel"
          >
            <Search size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="topbar__brand">
          <CodexMark size={24} />
          <b>원두도감</b>
          <small>BEAN CODEX</small>
        </div>
        <div className="topbar__actions">
          {/* 02_디자인_시스템 §01 — 세 장의 종이를 한 칸으로 돌립니다. */}
          <button
            className="theme-button"
            type="button"
            onClick={() => applyTheme(nextTheme(theme))}
            aria-label={`종이 바꾸기, 지금은 ${paper.hint}`}
          >
            <span aria-hidden="true">{paper.glyph}</span>
            {paper.hint}
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

      {/* 02_디자인_시스템 §08 SEARCH — 밑줄 하나가 아니라 각진 상자. 앞에 ⌕,
          뒤에 단축키, 아래에 무엇을 누르면 되는지. */}
      <section id="search-panel" className={`search-panel plate ${searchOpen ? "is-open" : ""}`} aria-label="카페 찾기">
        <label className="label-ko" htmlFor="cafe-search">
          어디로 갈까
        </label>
        <div className="search-field">
          <span className="search-field__glyph" aria-hidden="true">⌕</span>
          <input
            id="cafe-search"
            className="search"
            ref={searchRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={onSearchKeyDown}
            placeholder="지역, 상호, 느낌"
            autoComplete="off"
            role="combobox"
            aria-expanded={visibleMatches.length > 0}
            aria-controls="search-results"
            aria-autocomplete="list"
            /* 포커스는 입력칸에 머무르므로, 화살표로 짚은 줄이 무엇인지는
               이 속성으로만 전해집니다. 없으면 "↑↓ 이동"이 눈에만 보입니다. */
            aria-activedescendant={visibleMatches.length ? `search-option-${cursorIndex}` : undefined}
          />
          <span className="chip" aria-hidden="true">{query ? "ESC" : "/"}</span>
        </div>
        {query.trim() ? (
          <div className="search-results">
            {emptyResult ? (
              // 비빈의 말은 한 덩어리로 둡니다. 개수 줄과 나눠 놓으면 같은 사람이
              // 두 번 말하는 것처럼 읽힙니다 (02 §7.4).
              <div className="empty-state">
                <Bibin variant="map-lost" size={80} />
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
                <div className="search-results__list" id="search-results" role="listbox">
                  {visibleMatches.map((cafe, index) => (
                    <button
                      key={cafe.id}
                      id={`search-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === cursorIndex}
                      className={index === cursorIndex ? "is-cursor" : ""}
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => openCafe(cafe.id)}
                    >
                      <span className="search-results__name">{highlight(cafe.name, query)}</span>
                      <span className="meta">{cafe.partner ? "협력" : "카페"} · {cafe.area}</span>
                    </button>
                  ))}
                </div>
                <p className="meta search-results__foot">
                  결과 {matches.length}건 · ↑↓ 이동 · ↵ 선택
                </p>
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
                      note={marks.find((mark) => mark.id === codexPreviewCafe.id)?.note ?? ""}
                      collections={collections}
                      fullCollectionIds={fullCollectionIds}
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
                note={marks.find((mark) => mark.id === displayedCafe.id)?.note ?? ""}
                collections={collections}
                fullCollectionIds={fullCollectionIds}
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
