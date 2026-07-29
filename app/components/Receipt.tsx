"use client";

import { useState, type MouseEvent } from "react";
import type { Cafe } from "../data/cafes";
import { colorValue, type Collection } from "../marks";
import { BeanMark } from "./BeanArt";
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
  note,
  collections,
  selectedCollectionIds,
  onToggleCollection,
  onClose,
}: {
  cafe: Cafe;
  /** 이 카페에 사용자가 적어 둔 한 줄. 있으면 관리자 소개보다 이게 앞섭니다. */
  note: string;
  collections: Collection[];
  selectedCollectionIds: string[];
  onToggleCollection: (collectionId: string, included: boolean, event: MouseEvent<HTMLButtonElement>) => void;
  onClose: () => void;
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const confirmed = cafe.partner;
  const saved = selectedCollectionIds.length > 0;

  // 내가 적은 한 줄이 있으면 그게 이 카페의 요약입니다. 남이 써 준 소개보다
  // 내가 마시고 적은 문장이 먼저 와야 도감입니다.
  const mine = note.trim();
  const summary = mine || (confirmed ? cafe.intro : cafe.guess);

  return (
    <article className={`receipt ${confirmed ? "receipt--confirmed" : "receipt--guess"}`}>
      <button className="icon-button receipt__close-x" type="button" onClick={onClose} aria-label="영수증 닫기">×</button>

      {/* 상호와 주소 두 줄. 발행 정보·영문명·구분선은 걷어냈습니다 — 카페를 고르는
          사람에게 필요한 건 어디인지와 어떻게 생겼는지뿐입니다. */}
      <header className="receipt__head">
        <h1 className="receipt__name">
          {cafe.name}
          {confirmed ? (
            <span
              className="partner-mark"
              tabIndex={0}
              role="note"
              aria-label="비빈 파트너. 카페가 직접 확인해 준 정보입니다."
            >
              <BeanMark size={19} />
              <span className="partner-mark__tip" aria-hidden="true">
                <b>비빈 파트너</b>
                카페가 직접 확인해 준 정보
              </span>
            </span>
          ) : (
            <span className="chip chip--unknown">추정</span>
          )}
        </h1>
        <p className="receipt__address">{cafe.address}</p>
      </header>

      <figure className="receipt__photo">
        <figcaption>PHOTO — 사진 준비 중</figcaption>
      </figure>

      <p className={`intro ${mine ? "intro--mine" : ""}`}>
        {mine ? <span className="meta intro__by">내가 적어 둔 한 줄</span> : null}
        {summary}
      </p>

      <div className="receipt__actions">
        <button className={`receipt-action save-button ${saved ? "is-saved" : ""}`} type="button" onClick={() => setSaveOpen((value) => !value)} aria-expanded={saveOpen}>
          <span aria-hidden="true">{saved ? "✓" : "+"}</span>{saved ? `${selectedCollectionIds.length}개 도감에 저장됨` : "도감에 저장하기"}
        </button>
        <button className="receipt-action text-button" type="button" onClick={() => setDetailOpen((value) => !value)} aria-expanded={detailOpen}>
          {detailOpen ? "접기" : "상세 보기"}
        </button>
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

      {/* §06 — 요약은 문장(SUIT) 중심, 상세는 표(모노) 중심. */}
      {detailOpen ? (
        <section className="detail" aria-label={`${cafe.name} 상세 정보`}>
          <dl className="detail__table">
            <div><dt>지역</dt><dd>{cafe.area}</dd></div>
            {confirmed ? <div><dt>영업시간</dt><dd>{cafe.hours}</dd></div> : null}
            <div><dt>전화</dt><dd><a href={`tel:${cafe.tel.replaceAll("-", "")}`}>{cafe.tel}</a></dd></div>
          </dl>

          {confirmed ? (
            <>
              <div className="dashed-rule" />
              <p className="meta">BEAN LIST</p>
              <div className="bean-tags">
                {beanTags(cafe.beans).map((bean) => <span key={bean} className="chip chip--accent">{bean}</span>)}
              </div>
            </>
          ) : (
            <>
              <div className="dashed-rule" />
              <p className="guess-note">상호명과 위치로 자동 추정한 정보입니다. 실제와 다를 수 있습니다.</p>
            </>
          )}

          <div className="dashed-rule" />
          <a className="receipt-action text-button" href={`https://map.kakao.com/?q=${encodeURIComponent(cafe.name)}`} target="_blank" rel="noopener noreferrer">카카오맵에서 보기 <span aria-hidden="true">↗</span></a>
        </section>
      ) : null}
    </article>
  );
}
