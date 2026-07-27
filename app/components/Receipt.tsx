import type { MouseEvent } from "react";
import type { Cafe } from "../data/cafes";
import { CodexMark } from "./BeanArt";

/** 카페 정보를 한 장의 티켓처럼 보여 주는 상세 카드. */
export function Receipt({
  cafe,
  dateLabel,
  timeLabel,
  serial,
  saved,
  onSave,
  onClose,
}: {
  cafe: Cafe;
  dateLabel: string;
  /** 마운트 전에는 null. 서버와 클라이언트 시각 차이로 hydration이 깨지는 일을 막습니다. */
  timeLabel: string | null;
  serial: string;
  saved: boolean;
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

      <div className={`receipt__identity ${confirmed ? "is-partner" : "is-codex"}`}>
        <p className="receipt__affiliation">
          {confirmed ? "비빈 파트너 소속" : "원두도감 소속"}
        </p>
        <h1 className="receipt__name">{cafe.name}</h1>
        <p className="romanized">{cafe.romanized}</p>
      </div>

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

      <div className="receipt__actions">
        <button
          className={`receipt-action save-button ${saved ? "is-saved" : ""}`}
          type="button"
          onClick={onSave}
          aria-pressed={saved}
        >
          <span aria-hidden="true">{saved ? "◆" : "◇"}</span>
          {saved ? "내 도감에 보관됨" : "내 도감에 뜯어두기"}
        </button>
        <a
          className="receipt-action text-button"
          href={`https://map.kakao.com/?q=${encodeURIComponent(cafe.name)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          카카오맵에서 보기 <span aria-hidden="true">↗</span>
        </a>
      </div>

      {!confirmed ? (
        <footer className="receipt__close">
          <p className="guess-note">
            ※ 상호명과 위치로 자동 추정한 정보입니다. 실제와 다를 수 있습니다.
          </p>
        </footer>
      ) : null}
    </article>
  );
}
