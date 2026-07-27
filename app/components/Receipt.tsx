import type { MouseEvent } from "react";
import type { Cafe } from "../data/cafes";
import { Bibin, CodexMark } from "./BeanArt";

/**
 * 시그니처 영수증 카드 (02_디자인_시스템 §4).
 *
 * 확정 정보와 추정 정보를 눈으로 즉시 구분하는 것이 이 카드의 의무입니다
 * (결정서 §3 Q34 — "선택이 아니라 필수"). 그래서 두 종류의 카드는
 * 테두리(실선/점선), 소개 문장의 잉크 농도, 도장 유무, 항목 구성까지 다릅니다.
 *
 * T3 카드에 영업시간·취급원두 줄이 아예 없는 것도 같은 이유입니다.
 * 결정서 §4.2에 따라 그 자리는 카카오맵 버튼이 대신합니다.
 */
export function Receipt({
  cafe,
  dateLabel,
  timeLabel,
  serial,
  isDailyPick,
  saved,
  showSignature,
  onSave,
  onClose,
}: {
  cafe: Cafe;
  dateLabel: string;
  /** 마운트 전에는 null. 서버·클라이언트 시각이 어긋나 hydration이 깨지는 걸 막습니다. */
  timeLabel: string | null;
  serial: string;
  isDailyPick: boolean;
  saved: boolean;
  /** 02 §7.3 — 화면에 비빈이 이미 있으면 서명을 접습니다. */
  showSignature: boolean;
  onSave: (event: MouseEvent<HTMLButtonElement>) => void;
  onClose: () => void;
}) {
  const confirmed = cafe.partner;

  return (
    <article className={`receipt ${confirmed ? "receipt--confirmed" : "receipt--guess"}`}>
      <header className="receipt__topline">
        <span className="brand-lockup">
          <CodexMark size={18} />
          <b>원두도감</b>
        </span>
        <button className="icon-button" type="button" onClick={onClose} aria-label="영수증 닫기">
          ×
        </button>
      </header>

      <p className="receipt__issue">
        <span>
          {dateLabel}
          <i aria-hidden="true">{timeLabel ?? "--:--"}</i>
        </span>
        <span className="receipt__serial">NO.{serial}</span>
      </p>

      <div className="dashed-rule" />

      <p className={`eyebrow ${confirmed ? "eyebrow--confirmed" : "eyebrow--guess"}`}>
        {isDailyPick ? "오늘의 영수증 · " : ""}
        {confirmed ? "확정" : "추정"}
      </p>
      <h1 className="receipt__name">{cafe.name}</h1>
      <p className="romanized">{cafe.romanized}</p>
      <p className="intro">{confirmed ? cafe.intro : cafe.guess}</p>

      <div className="dashed-rule" />

      <dl className="receipt__specs">
        <div className="spec">
          <dt>지역</dt>
          <dd>{cafe.area}</dd>
        </div>
        <div className="spec">
          <dt>주소</dt>
          <dd>{cafe.address}</dd>
        </div>
        {confirmed ? (
          <>
            <div className="spec">
              <dt>영업시간</dt>
              <dd className="tabular">{cafe.hours}</dd>
            </div>
            <div className="spec">
              <dt>취급원두</dt>
              <dd>{cafe.beans}</dd>
            </div>
          </>
        ) : (
          <div className="spec">
            <dt>전화</dt>
            <dd className="tabular">
              <a href={`tel:${cafe.tel.replaceAll("-", "")}`}>{cafe.tel}</a>
            </dd>
          </div>
        )}
      </dl>

      <div className="dashed-rule" />

      <div className="receipt__actions">
        <button
          className={`save-button ${saved ? "is-saved" : ""}`}
          type="button"
          onClick={onSave}
          aria-pressed={saved}
        >
          <span aria-hidden="true">{saved ? "◆" : "◇"}</span>
          {saved ? "내 도감에 보관됨" : "내 도감에 뜯어두기"}
        </button>
        <a
          className="text-button"
          href={`https://map.kakao.com/?q=${encodeURIComponent(cafe.name)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          카카오맵에서 보기 <span aria-hidden="true">↗</span>
        </a>
      </div>

      <div className="dashed-rule" />

      {/* 도장과 서명이 붙어 하나의 닫는 단락이 됩니다 (02 §4.1의 배치). */}
      <footer className="receipt__close">
        {confirmed ? (
          <div className="stamp" role="img" aria-label="비빈 로스팅 팩토리 협력업체 도장">
            <span>협력</span>
            <span>업체</span>
          </div>
        ) : (
          <p className="guess-note">
            ※ 상호명과 위치로 자동 추정한 정보입니다. 실제와 다를 수 있습니다.
          </p>
        )}

        {confirmed && showSignature ? (
          <p className="receipt__footer">
            <Bibin mood="cheer" size={24} />
            비빈이 다녀갔습니다
          </p>
        ) : (
          <p className="receipt__footer receipt__footer--plain">
            {confirmed ? "비빈이 다녀갔습니다" : "도감 미기재 항목"}
          </p>
        )}
      </footer>
    </article>
  );
}
