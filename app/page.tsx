"use client";

import { BookMarked, Contrast, Menu, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BASE_PATH } from "./base-path";
import { ICON } from "./icons";
import { Bibin, CodexMark } from "./components/BeanArt";
import { Codex } from "./components/Codex";
import { Drawer } from "./components/Drawer";
import { MapSurface } from "./components/MapSurface";
import { Receipt } from "./components/Receipt";
import { cafes, type Cafe } from "./data/cafes";
import { COLLECTION_LIMIT, CURATOR_COLLECTION, CURATOR_COLLECTION_ID, colorValue, countInCollection, setCafeInCollection, useCodex, withCuratorPicks } from "./marks";
import { applyTheme, nextTheme, useTheme, type Theme } from "./theme";
import { useSheetPull } from "./useSheetPull";

/**
 * 영수증이 있는 자리 (03_기능_명세 §2).
 *   intro  — 아직 아무것도 안 나옴. 첫 화면은 지도와 상단 바뿐입니다.
 *   docked — 우측 패널(모바일은 하단 시트).
 *   closed — 접힘. 넓은 화면에만 "다시 보기" 탭이 남습니다.
 *
 * 예전에는 로드 400ms 뒤에 영수증이 화면 한가운데서 프린트되는 자리(center)가
 * 하나 더 있었습니다. 첫인상은 좋았지만, 아직 아무것도 고르지 않은 사람 앞에
 * 오늘의 카페 한 장이 지도를 덮고 서 있는 것이기도 했습니다. 지금은 지도부터
 * 보여 주고, 종이는 고른 다음에 나옵니다.
 */
type Phase = "intro" | "docked" | "closed";

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
const PAPERS: Record<Theme, { hint: string }> = {
  light: { hint: "새 종이" },
  warm: { hint: "묵은 종이" },
  cool: { hint: "식은 종이" },
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
  /** 지도에게 "여기로 가 달라"고 짚어 준 카페. 같은 곳을 다시 짚어도 다시 움직입니다. */
  const [focus, setFocus] = useState<{ id: string; at: number } | null>(null);

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
  const panelOpen = effectivePhase === "docked";

  const closePanel = useCallback(() => {
    setCodexPreviewId(null);
    setPhase("closed");
    navigate("/");
  }, []);

  /**
   * 지도를 처음 만진 순간. 첫 화면에서는 상단 바 말고는 아무것도 없다가, 손이
   * 지도에 닿으면 그때 연장(축척·확대축소)이 나옵니다 — 아직 아무것도 안 한
   * 사람에게 조작기부터 들이밀 이유가 없습니다.
   */
  const [touched, setTouched] = useState(false);
  const dock = useCallback(() => setTouched(true), []);

  /**
   * 종이를 맨 위까지 올린 뒤 더 끌면 시트가 손을 따라 내려가 닫힙니다.
   * 잡을 곳을 따로 그려 두지 않아도, 읽던 손짓이 그대로 이어집니다.
   */
  const setDock = useSheetPull({ enabled: isSheet, onClose: closePanel });

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

  // 지도에 넘겨주는 손잡이라 렌더마다 새로 만들면 안 됩니다 — 새 함수는 곧
  // 새 props 이고, 그러면 MapSurface 를 memo 로 묶어 둔 뜻이 없어집니다.
  const openCafe = useCallback((id: string) => {
    setCodexPreviewId(null);
    setPhase("docked");
    setQuery("");
    setCursor(0);
    // 좁은 화면에서 종이 두 장이 겹칩니다. 고르고 나면 찾던 일은 끝난 것입니다.
    setSearchOpen(false);
    navigate(`/c/${encodeURIComponent(id)}`);
  }, []);

  /**
   * 화살표와 엔터는 화면에 적어 두지 않습니다 — 마우스와 손가락으로 오는 사람에게는
   * 평생 읽히지 않을 글이라서. 대신 손이 짚어 보면 그대로 움직여야 합니다.
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
    // 검색 종이와 도감이 같은 자리를 두고 겹칩니다. 펴는 쪽이 이깁니다 —
    // 검색을 펴면 영수증이 물러나는 것과 같은 규칙입니다.
    setSearchOpen(false);
    navigate("/marks");
  }

  function openCafeFromCodex(id: string) {
    setCodexPreviewId(id);
  }

  /**
   * 도감의 핀 — 그 카페가 지도 어디쯤인지 보여 줍니다.
   *
   * 좁은 화면에서는 종이가 지도를 통째로 덮고 있으므로, 접지 않으면 지도가
   * 움직여도 볼 수가 없습니다. 넓은 화면에서는 지도가 옆에 있으니 그대로 둡니다.
   */
  function locateCafe(id: string) {
    setFocus({ id, at: Date.now() });
    setTouched(true);
    if (isSheet) closePanel();
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
    <main className="app-shell" data-phase={effectivePhase} data-search-open={searchOpen} data-touched={touched || panelOpen}>
      <a className="skip-link" href="#dock">
        영수증으로 건너뛰기
      </a>

      <MapSurface
        cafes={cafes}
        activeId={panelOpen ? (panel === "receipt" ? displayedCafe.id : codexPreviewCafe?.id ?? null) : null}
        focus={focus}
        savedMarkers={savedMarkers}
        onSelect={openCafe}
        onInteract={dock}
      />

      <header className="topbar">
        <div className="topbar__tools">
          <button className="menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기">
            <Menu aria-hidden="true" />
          </button>
          {/* 좁은 화면에서는 검색 종이가 지도를 덮고 앉아 있을 자리가 없습니다.
              단추 하나로 두고, 누를 때만 상단바 밑으로 펴집니다. */}
          <button
            className="search-button"
            type="button"
            onClick={() => {
              const next = !searchOpen;
              setSearchOpen(next);
              // 찾으러 왔으면 볼 것은 지도입니다. 영수증이 덮고 있는 채로 검색을
              // 펴 주면, 고른 곳이 어디쯤인지 보려고 한 번 더 닫아야 합니다.
              if (next && panelOpen) closePanel();
            }}
            aria-label={searchOpen ? "검색 닫기" : "카페 찾기"}
            aria-expanded={searchOpen}
            aria-controls="search-panel"
          >
            <Search aria-hidden="true" />
          </button>
        </div>
        <div className="topbar__brand">
          <CodexMark size={28} />
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
            {/* 어느 종이인지는 바로 옆 글자가 말합니다. 아이콘까지 세 가지로
                나눠 두면 같은 것을 두 번 적는 셈입니다. */}
            <Contrast size={ICON.sm} aria-hidden="true" />
            {paper.hint}
          </button>
          <button
            className="marks-button"
            type="button"
            ref={marksButtonRef}
            /* 검색 단추와 같은 손버릇이어야 합니다 — 한 번 누르면 펴지고 다시
               누르면 접힙니다. 한쪽만 닫히지 않으면 그게 규칙인지 버그인지
               눌러 봐야 알게 됩니다. */
            onClick={() => (panelOpen && panel === "codex" ? closePanel() : openCodex())}
            aria-label={`내 도감, ${marks.length}장 보관 중`}
            aria-pressed={panelOpen && panel === "codex"}
          >
            <BookMarked aria-hidden="true" />
            <span className="marks-button__label">내 도감</span>
            <strong className="marks-button__count tabular">{marks.length}</strong>
          </button>
        </div>
      </header>

      {/* 02_디자인_시스템 §08 SEARCH — 밑줄 하나가 아니라 각진 상자. 앞에 돋보기,
          뒤에 단축키, 아래에 무엇을 누르면 되는지. */}
      <section id="search-panel" className={`search-panel plate ${searchOpen ? "is-open" : ""}`} aria-label="카페 찾기">
        {/* 머리줄 하나가 "이건 찾는 칸이다"와 "몇 곳이 걸렸다"를 함께 집니다.
            좁은 화면에서는 통째로 감춥니다 — 손바닥만 한 종이에 장식 줄까지
            얹으면 정작 칠 자리가 밀립니다. */}
        <p className="search-panel__head">
          <span aria-hidden="true">찾기</span>
          <i aria-hidden="true" />
          {/* 한 곳도 없을 때는 비웁니다 — "0건"과 비빈의 "여긴 아무것도 없네"는
              같은 사람이 같은 말을 두 번 하는 것입니다 (02 §7.4). */}
          {!query.trim() ? (
            <span className="chip" aria-hidden="true">/</span>
          ) : matches.length ? (
            <b className="tabular">{matches.length}건</b>
          ) : null}
        </p>
        <label className="sr-only" htmlFor="cafe-search">
          카페 찾기
        </label>
        <div className="search-field">
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
               이 속성으로만 전해집니다. 화면에서 안내를 뺀 만큼 여기가 더 중요합니다. */
            aria-activedescendant={visibleMatches.length ? `search-option-${cursorIndex}` : undefined}
          />
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
            className={["dock", panel === "codex" && codexPreviewCafe ? "has-preview" : ""].filter(Boolean).join(" ")}
            id="dock"
            ref={setDock}
          >
            {/* 흐르는 자리를 따로 둡니다 — 종이가 도크 밖으로 넘치지 않고,
                끝에서 더 밀어도 뒤의 페이지가 따라 움직이지 않습니다. */}
            <div className="dock__scroll">
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
                      sheet={isSheet}
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
                    onLocate={locateCafe}
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
                sheet={isSheet}
              />
            )}
            </div>
          </div>
        </>
      ) : effectivePhase === "closed" ? (
        /* 한 번 열었다가 접은 사람에게만 보입니다. 첫 화면에서는 "다시" 볼 것이
           아직 없습니다. 좁은 화면에서는 아예 두지 않습니다 (globals.css §10) —
           손이 닿는 자리를 늘 한 줄 차지하면서, 하는 일은 지도를 덮는 것뿐이었습니다. */
        <button className="dock-tab plate" type="button" onClick={() => setPhase("docked")}>
          오늘의 영수증 다시 보기
        </button>
      ) : null}

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
