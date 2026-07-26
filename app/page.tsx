"use client";

import { useEffect, useMemo, useState } from "react";

type Cafe = {
  id: string;
  name: string;
  romanized: string;
  area: string;
  line: string;
  address: string;
  hours: string;
  beans: string;
  partner: boolean;
  x: number;
  y: number;
};

const cafes: Cafe[] = [
  { id: "demo-yeonnam", name: "책방그늘", romanized: "BOOKSHOP GEUNEUL", area: "연남동", line: "연남동 골목 끝, 서가와 커피가 반씩 있는 곳.", address: "서울 마포구 성미산로29길 12", hours: "10:00 – 21:00", beans: "에티오피아 예가체프", partner: true, x: 37, y: 35 },
  { id: "demo-seongsu", name: "느린파도", romanized: "SLOW WAVE", area: "성수동", line: "큰 창과 긴 테이블이 있는 성수동 로스터리.", address: "서울 성동구 연무장길 41", hours: "11:00 – 22:00", beans: "비빈 하우스 블렌드", partner: true, x: 58, y: 42 },
  { id: "demo-incheon", name: "항구의 오후", romanized: "HARBOR AFTERNOON", area: "인천 중구", line: "오래된 창고 골목에서 만나는 작은 커피 바.", address: "인천 중구 개항로 78", hours: "12:00 – 20:00", beans: "콜롬비아 우일라", partner: true, x: 18, y: 56 },
  { id: "demo-suwon", name: "모서리 커피", romanized: "CORNER COFFEE", area: "수원 행궁동", line: "행궁동 담장 곁에 놓인 한 잔짜리 쉼표.", address: "경기 수원시 팔달구 화서문로 29", hours: "09:30 – 19:30", beans: "과테말라 안티구아", partner: true, x: 49, y: 73 },
  { id: "demo-ilsan", name: "종이컵 연구소", romanized: "PAPER CUP LAB", area: "고양 일산", line: "이름과 위치에서 자동 추정한 일산의 로스터리 카페.", address: "경기 고양시 일산동구 산두로 16", hours: "카카오맵에서 확인", beans: "정보 없음", partner: false, x: 30, y: 19 },
  { id: "demo-bundang", name: "커피와 문장", romanized: "COFFEE AND SENTENCES", area: "성남 분당", line: "이름과 위치에서 자동 추정한 분당의 북카페.", address: "경기 성남시 분당구 불정로 8", hours: "카카오맵에서 확인", beans: "정보 없음", partner: false, x: 65, y: 67 },
];

function hashDate(value: string) {
  return [...value].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 7);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
    .format(date)
    .replaceAll(". ", "-")
    .replace(".", "");
}

function BeanMark({ small = false }: { small?: boolean }) {
  return <span className={small ? "bean-mark bean-mark--small" : "bean-mark"} aria-hidden="true"><i /></span>;
}

function Receipt({ cafe, dateLabel, saved, onSave, onClose }: { cafe: Cafe; dateLabel: string; saved: boolean; onSave: () => void; onClose: () => void }) {
  return (
    <article className={`receipt receipt--today ${cafe.partner ? "receipt--confirmed" : "receipt--guess"}`}>
      <div className="receipt__topline">
        <span className="brand-lockup"><BeanMark small />원 두 도 감</span>
        <button className="icon-button" type="button" onClick={onClose} aria-label="영수증 닫기">×</button>
      </div>
      <p className="receipt__issue">{dateLabel} · 오늘의 영수증</p>
      <div className="dashed-rule" />
      <p className="eyebrow">{cafe.partner ? "PARTNER PICK" : "CODEX PICK"}</p>
      <h1>{cafe.name}</h1>
      <p className="romanized">{cafe.romanized}</p>
      <p className="intro">{cafe.line}</p>
      <div className="dashed-rule" />
      <dl className="receipt__specs">
        <div><dt>지 역</dt><dd>{cafe.area}</dd></div>
        <div><dt>주 소</dt><dd>{cafe.address}</dd></div>
        <div><dt>영업시간</dt><dd>{cafe.hours}</dd></div>
        <div><dt>취급원두</dt><dd>{cafe.beans}</dd></div>
      </dl>
      {cafe.partner ? (
        <div className="stamp" aria-label="협력업체"><span>협 력</span><span>업 체</span></div>
      ) : (
        <p className="guess-note">※ 상호명과 위치로 자동 추정한 정보입니다. 실제와 다를 수 있습니다.</p>
      )}
      <div className="receipt__actions">
        <button className={`save-button ${saved ? "is-saved" : ""}`} type="button" onClick={onSave}>
          <span aria-hidden="true">{saved ? "◆" : "◇"}</span>{saved ? "내 도감에 보관됨" : "내 도감에 뜯어두기"}
        </button>
        <button className="text-button" type="button">카카오맵에서 보기 ↗</button>
      </div>
      <p className="receipt__footer"><BeanMark small />비빈이 다녀갔습니다</p>
    </article>
  );
}

export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [marks, setMarks] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  const today = useMemo(() => new Date(), []);
  const dateLabel = formatDate(today);
  const dailyCafe = cafes[hashDate(dateLabel) % 4];
  const displayedCafe = cafes.find((cafe) => cafe.id === selectedId) ?? dailyCafe;
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ko");
    if (!normalized) return [];
    return cafes.filter((cafe) => `${cafe.name} ${cafe.romanized} ${cafe.area} ${cafe.line}`.toLocaleLowerCase("ko").includes(normalized));
  }, [query]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("wondudogam.theme");
    const nextTheme = savedTheme === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    try {
      const rawMarks = localStorage.getItem("wondudogam.marks");
      if (rawMarks) {
        const parsed = JSON.parse(rawMarks) as { marks?: { id: string }[] };
        setMarks(parsed.marks?.map((mark) => mark.id) ?? []);
      }
    } catch {
      localStorage.removeItem("wondudogam.marks");
    }
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("wondudogam.theme", next);
  }

  function openCafe(id: string) {
    setSelectedId(id);
    setReceiptOpen(true);
    setQuery("");
    window.history.pushState({}, "", `/c/${id}`);
  }

  function toggleMark() {
    const exists = marks.includes(displayedCafe.id);
    const next = exists ? marks.filter((id) => id !== displayedCafe.id) : [...marks, displayedCafe.id];
    setMarks(next);
    localStorage.setItem("wondudogam.marks", JSON.stringify({ v: 1, marks: next.map((id) => ({ id, at: dateLabel, note: "" })) }));
    setNotice(exists ? "서랍에서 꺼냈어." : "영수증을 내 도감에 넣었어.");
  }

  return (
    <main className="app-shell">
      <a className="skip-link" href="#today-receipt">오늘의 영수증으로 건너뛰기</a>
      <section className="map" aria-label="수도권 카페 지도 목업" tabIndex={0}>
        <div className="map__paper-grid" aria-hidden="true" />
        <div className="map__river" aria-hidden="true" />
        <div className="map__labels" aria-hidden="true"><span className="label-seoul">서울</span><span className="label-incheon">인천</span><span className="label-suwon">수원</span><span className="label-seongnam">성남</span></div>
        {cafes.map((cafe) => (
          <button key={cafe.id} className={`map-marker ${cafe.partner ? "map-marker--partner" : "map-marker--plain"} ${displayedCafe.id === cafe.id && receiptOpen ? "is-active" : ""}`} style={{ left: `${cafe.x}%`, top: `${cafe.y}%` }} type="button" onClick={() => openCafe(cafe.id)} aria-label={`${cafe.name}, ${cafe.area}${cafe.partner ? ", 협력업체" : ""}`}>
            {cafe.partner ? <BeanMark small /> : null}<span>{cafe.partner ? cafe.name : ""}</span>
          </button>
        ))}
      </section>

      <header className="topbar">
        <button className="menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label="메뉴 열기"><span /><span /></button>
        <div className="topbar__brand" aria-label="원두도감"><BeanMark /><span>원 두 도 감</span><small>BEAN CODEX</small></div>
        <div className="topbar__actions"><button className="theme-button" type="button" onClick={toggleTheme}><span aria-hidden="true">{theme === "light" ? "◐" : "◑"}</span>{theme === "light" ? "묵은 종이" : "새 종이"}</button><button className="marks-button" type="button" onClick={() => setSidebarOpen(true)}>내 도감 <strong>{marks.length}</strong></button></div>
      </header>

      <section className="search-panel" aria-label="카페 찾기">
        <label htmlFor="cafe-search">어디로 갈까?</label>
        <div className="search-line"><input id="cafe-search" className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="지역, 상호, 느낌을 적어보세요" autoComplete="off" /><span aria-hidden="true">↵</span></div>
        {query ? <div className="search-results"><p>{matches.length ? `${matches.length}곳을 찾았어요` : "여긴 아직 아무것도 없네."}</p>{matches.slice(0, 4).map((cafe) => <button key={cafe.id} type="button" onClick={() => openCafe(cafe.id)}><span>{cafe.name}</span><small>{cafe.area}</small>{cafe.partner ? <b>협력</b> : null}</button>)}{!matches.length ? <button className="widen-button" type="button" onClick={() => setQuery("")}>범위를 넓혀볼까?</button> : null}</div> : null}
      </section>

      <div className="map-status" aria-label="지도 상태"><span>수도권 전체</span><span>협력업체 4 · 데모 데이터</span></div>
      {receiptOpen ? <div className="receipt-wrap" id="today-receipt"><Receipt cafe={displayedCafe} dateLabel={dateLabel} saved={marks.includes(displayedCafe.id)} onSave={toggleMark} onClose={() => { setReceiptOpen(false); window.history.pushState({}, "", "/"); }} /></div> : <button className="receipt-tab" type="button" onClick={() => { setSelectedId(dailyCafe.id); setReceiptOpen(true); }}>오늘의 영수증 다시 보기</button>}

      {sidebarOpen ? <div className="drawer-layer"><button className="drawer-scrim" type="button" aria-label="메뉴 닫기" onClick={() => setSidebarOpen(false)} /><aside className="drawer" aria-label="원두도감 메뉴"><div className="drawer__header"><span className="brand-lockup"><BeanMark small />원 두 도 감</span><button className="icon-button" type="button" onClick={() => setSidebarOpen(false)} aria-label="메뉴 닫기">×</button></div><p className="drawer__tagline">수도권 개인 카페 지도</p><div className="dashed-rule" /><nav><button type="button"><span>내 도감</span><strong>{marks.length}</strong></button><button type="button"><span>협력업체 전체</span><strong>71</strong></button><button type="button" onClick={() => setSidebarOpen(false)}><span>이런 느낌 찾기</span><strong>→</strong></button><button type="button"><span>원두도감이란</span><strong>→</strong></button></nav><div className="dashed-rule" /><div className="drawer__setting"><span>테 마</span><button type="button" onClick={toggleTheme}>{theme === "light" ? "○ 밝게　● 어둡게" : "● 밝게　○ 어둡게"}</button></div><div className="dashed-rule" /><div className="drawer__links"><a href="#bibin"><span>비빈 로스팅 팩토리<small>스페셜티 원두 로스터리</small></span>↗</a><a href="#class"><span>로허들 커피교실<small>호주 워홀 바리스타 교육</small></span>↗</a></div><div className="drawer__foot"><p>데이터 정책 검토 중</p><p>화면의 카페는 목업용 예시입니다</p></div></aside></div> : null}
      {notice ? <div className="toast" role="status"><BeanMark small />{notice}</div> : null}
    </main>
  );
}