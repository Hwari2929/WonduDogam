"use client";

import { useState, type MouseEvent } from "react";
import type { Cafe } from "../data/cafes";
import { colorValue, type Collection } from "../marks";
import { CodexMark } from "./BeanArt";
import { CodexIcon } from "./CodexIcon";

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
      <header className="receipt__topline">
        <span className="brand-lockup"><CodexMark size={18} /><b>{confirmed ? "비빈 파트너" : "원두도감"}</b></span>
        <button className="icon-button" type="button" onClick={onClose} aria-label="영수증 닫기">×</button>
      </header>
      <p className="receipt__issue"><span>{dateLabel}<i aria-hidden="true">{timeLabel ?? "--:--"}</i></span><span className="receipt__serial">NO.{serial}</span></p>
      <div className="receipt__identity"><h1 className="receipt__name">{cafe.name}</h1><p className="romanized">{cafe.romanized}</p></div>
      <figure className="receipt__photo">
        <img src="/mascot/bibean-inspecting.webp" alt="" width="256" height="256" loading="lazy" decoding="async" />
        <figcaption><span>CAFE PHOTO</span><small>사진 준비 중</small></figcaption>
      </figure>
      <p className="intro">{confirmed ? cafe.intro : cafe.guess}</p>
      <div className="dashed-rule" />
      <dl className="receipt__specs">
        <div className="spec"><dt>지역</dt><dd>{cafe.area}</dd></div>
        <div className="spec"><dt>주소</dt><dd>{cafe.address}</dd></div>
        {confirmed ? <><div className="spec"><dt>영업시간</dt><dd className="tabular">{cafe.hours}</dd></div><div className="spec"><dt>취급원두</dt><dd>{cafe.beans}</dd></div></> : <div className="spec"><dt>전화</dt><dd className="tabular"><a href={`tel:${cafe.tel.replaceAll("-", "")}`}>{cafe.tel}</a></dd></div>}
      </dl>

      <div className="receipt__actions">
        <button className={`receipt-action save-button ${saved ? "is-saved" : ""}`} type="button" onClick={() => setSaveOpen((value) => !value)} aria-expanded={saveOpen}>
          <span aria-hidden="true">{saved ? "✓" : "+"}</span>{saved ? `${selectedCollectionIds.length}개 도감에 저장됨` : "도감에 저장하기"}
        </button>
        <a className="receipt-action text-button" href={`https://map.kakao.com/?q=${encodeURIComponent(cafe.name)}`} target="_blank" rel="noopener noreferrer">카카오맵에서 보기 <span aria-hidden="true">↗</span></a>
      </div>

      {saveOpen ? <section className="receipt__save-panel" aria-label="저장할 도감 고르기">
        <p>어느 도감에 넣을까?</p>
        <div className="receipt__collection-list">
          {collections.map((collection) => {
            const included = selectedCollectionIds.includes(collection.id);
            return <button key={collection.id} type="button" className={included ? "is-selected" : ""} style={{ "--codex-color": colorValue(collection.color) } as React.CSSProperties} onClick={(event) => onToggleCollection(collection.id, !included, event)} aria-pressed={included}><span className="receipt__collection-icon"><CodexIcon name={collection.icon} size={17} /></span><b>{collection.name}</b><i>{included ? "저장됨" : "담기"}</i></button>;
          })}
        </div>
      </section> : null}

      {!confirmed ? <footer className="receipt__close"><p className="guess-note">상호명과 위치로 자동 추정한 정보입니다. 실제와 다를 수 있습니다.</p></footer> : null}
    </article>
  );
}