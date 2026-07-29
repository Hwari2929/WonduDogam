"use client";

import { useState, type MouseEvent } from "react";
import type { Cafe } from "../data/cafes";
import { colorValue, type Collection } from "../marks";
import { CodexMark } from "./BeanArt";
import { CodexIcon } from "./CodexIcon";

/** "과테말라 안티구아 · 에티오피아" 같은 한 줄을 §08 칩으로 끊습니다. */
function beanTags(beans: string) {
  return beans
    .split(/[·,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function Receipt({
  cafe,
  dateLabel,
  timeLabel,
  serial,
  collections,
  selectedCollectionIds,
  onToggleCollection,
  onClose,
}: {
  cafe: Cafe;
  dateLabel: string;
  timeLabel: string | null;
  serial: string;
  collections: Collection[];
  selectedCollectionIds: string[];
  onToggleCollection: (collectionId: string, included: boolean, event: MouseEvent<HTMLButtonElement>) => void;
  onClose: () => void;
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  const confirmed = cafe.partner;
  const saved = selectedCollectionIds.length > 0;

  return (
    <article className={`receipt ${confirmed ? "receipt--confirmed" : "receipt--guess"}`}>
      <button className="icon-button receipt__close-x" type="button" onClick={onClose} aria-label="영수증 닫기">×</button>

      {/* §03 영수증 — 상호가 가운데, 발행 정보는 그 아래 모노 두 줄. */}
      <header className="receipt__head">
        <span className="brand-lockup"><CodexMark size={18} /><b>{confirmed ? "비빈 파트너" : "원두도감"}</b></span>
        <p className="meta receipt__issue">
          <span>{cafe.address}</span>
          <span>{dateLabel} {timeLabel ?? "--:--"} · NO.{serial}</span>
        </p>
      </header>

      <div className="dashed-rule" />

      <h1 className="receipt__name">{cafe.name}</h1>
      <p className="receipt__sub">
        <span className="romanized">{cafe.romanized}</span>
        {/* 확정과 추정은 눈으로 즉시 갈려야 합니다 (결정서 §3 Q34). §08 의 "미확인" 칩. */}
        {confirmed ? null : <span className="chip chip--unknown">추정</span>}
      </p>

      <figure className="receipt__photo">
        <figcaption>PHOTO — 사진 준비 중</figcaption>
      </figure>

      <p className="intro">{confirmed ? cafe.intro : cafe.guess}</p>
      <div className="dashed-rule" />
      <dl className="receipt__specs">
        {/* 주소는 영수증 머리에 이미 찍혀 있습니다. 같은 값을 두 번 적으면 종이가 늘어날 뿐입니다. */}
        <div className="spec"><dt>지역</dt><dd>{cafe.area}</dd></div>
        {confirmed ? <div className="spec"><dt>영업시간</dt><dd className="tabular">{cafe.hours}</dd></div> : <div className="spec"><dt>전화</dt><dd className="tabular"><a href={`tel:${cafe.tel.replaceAll("-", "")}`}>{cafe.tel}</a></dd></div>}
      </dl>
      {confirmed ? (
        <div className="bean-tags">
          {beanTags(cafe.beans).map((bean) => <span key={bean} className="chip chip--accent">{bean}</span>)}
        </div>
      ) : null}

      <div className="receipt__actions">
        <button className={`receipt-action save-button ${saved ? "is-saved" : ""}`} type="button" onClick={() => setSaveOpen((value) => !value)} aria-expanded={saveOpen}>
          <span aria-hidden="true">{saved ? "✓" : "+"}</span>{saved ? `${selectedCollectionIds.length}개 도감에 저장됨` : "도감에 저장하기"}
        </button>
        <a className="receipt-action text-button" href={`https://map.kakao.com/?q=${encodeURIComponent(cafe.name)}`} target="_blank" rel="noopener noreferrer">카카오맵 <span aria-hidden="true">↗</span></a>
      </div>

      {saveOpen ? <section className="receipt__save-panel" aria-label="저장할 도감 고르기">
        <p>어느 도감에 넣을까?</p>
        <div className="receipt__collection-list">
          {collections.map((collection) => {
            const included = selectedCollectionIds.includes(collection.id);
            return <button key={collection.id} type="button" className={included ? "is-selected" : ""} style={{ "--codex-color": colorValue(collection.color) } as React.CSSProperties} onClick={(event) => onToggleCollection(collection.id, !included, event)} aria-pressed={included}><span className="receipt__collection-icon"><CodexIcon name={collection.icon} size={15} /></span><b>{collection.name}</b><i>{included ? "저장됨" : "담기"}</i></button>;
          })}
        </div>
      </section> : null}

      <footer className="receipt__foot">
        {!confirmed ? <p className="guess-note">상호명과 위치로 자동 추정한 정보입니다. 실제와 다를 수 있습니다.</p> : null}
        <p className="meta receipt__mark">뜯어 두면 내 도감에 남습니다<br />NO. {serial}</p>
      </footer>
    </article>
  );
}
