"use client";

import { useEffect, useRef, useState } from "react";
import { partnerRegions, partnerTotal } from "../data/cafes";
import { THEMES, type Theme } from "../theme";
import { CodexMark } from "./BeanArt";

/** 서랍 (03_기능_명세 §7). --desk-deep 위에 종이가 아니라 책상 안쪽이 보이는 자리입니다. */
export function Drawer({
  markCount,
  theme,
  onTheme,
  onOpenCodex,
  onClose,
}: {
  markCount: number;
  theme: Theme;
  onTheme: (next: Theme) => void;
  onOpenCodex: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const [partnersOpen, setPartnersOpen] = useState(false);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>("button, a")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="drawer-layer">
      <button className="drawer-scrim" type="button" aria-label="메뉴 닫기" onClick={onClose} />
      <aside className="drawer" ref={panelRef} aria-label="원두도감 메뉴">
        <div className="drawer__header">
          <span className="brand-lockup">
            <CodexMark size={18} />
            <b>원두도감</b>
          </span>
          <button className="icon-button" type="button" onClick={onClose} aria-label="메뉴 닫기">
            ×
          </button>
        </div>
        <p className="drawer__tagline">수도권 개인 카페 지도</p>

        <div className="dashed-rule" />

        <nav className="drawer__nav">
          <button type="button" onClick={onOpenCodex}>
            <span>내 도감</span>
            <strong className="tabular">{markCount}</strong>
          </button>
          <button type="button" onClick={() => setPartnersOpen((open) => !open)} aria-expanded={partnersOpen}>
            <span>협력업체 전체</span>
            <strong className="tabular">{partnerTotal}</strong>
          </button>
          {partnersOpen ? (
            <ul className="drawer__regions">
              {partnerRegions.map((region) => (
                <li key={region.label}>
                  <span>{region.label}</span>
                  <i className="drawer__leader" aria-hidden="true" />
                  <strong className="tabular">{region.count}</strong>
                </li>
              ))}
            </ul>
          ) : null}
          <button type="button">
            <span>이런 느낌 찾기</span>
            <strong aria-hidden="true">→</strong>
          </button>
          <button type="button">
            <span>원두도감이란</span>
            <strong aria-hidden="true">→</strong>
          </button>
        </nav>

        <div className="dashed-rule" />

        {/* 02_디자인_시스템 §01 — 세 테마는 같은 역할 이름을 공유합니다.
            다크는 검정이 아니라 어두운 종이라서, 라벨도 밝기가 아니라 종이로 씁니다. */}
        <div className="drawer__setting">
          <span className="label-ko">종이</span>
          <div className="segmented" role="group" aria-label="종이 고르기">
            {THEMES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={theme === entry.id}
                onClick={() => onTheme(entry.id)}
              >
                {entry.hint}
              </button>
            ))}
          </div>
        </div>

        <div className="dashed-rule" />

        <div className="drawer__links">
          <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer">
            <span>
              비빈 로스팅 팩토리
              <small>스페셜티 원두 로스터리</small>
            </span>
            <i aria-hidden="true">↗</i>
          </a>
          <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer">
            <span>
              로허들 커피교실
              <small>호주 워홀 바리스타 교육</small>
            </span>
            <i aria-hidden="true">↗</i>
          </a>
        </div>

        <div className="drawer__foot">
          <p>데이터 사용 승낙 검토 중</p>
          <p>화면의 카페는 목업용 예시입니다</p>
        </div>
      </aside>
    </div>
  );
}
