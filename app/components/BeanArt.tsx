"use client";

import { useRef, useState } from "react";

/**
 * 원두 조형 3종.
 *
 * 02_디자인_시스템 §7.3은 "한 화면에 비빈은 하나뿐"을 요구합니다.
 * 그래서 브랜드 마크(CodexMark)와 지도 도장(BeanStamp)에는 얼굴을 넣지 않고,
 * 눈이 있는 <Bibin/> 만 마스코트로 셉니다. 브랜드 록업이 늘어나도
 * 마스코트 수는 늘지 않습니다.
 *
 * 공통 조형 원칙(§7.1): 중앙 크랙은 어떤 포즈에서도 지우지 않고,
 * 색은 currentColor 단색 + 종이색 눈. 그라디언트 없음.
 */

/**
 * 원두 몸통과 크랙. 얼굴 없는 실루엣이라 마스코트로 세지 않습니다.
 * 타원이 아니라 살짝 찌그러진 패스인 것은 의도입니다 — §7.1의 "벡터의 매끈함보다
 * 살짝 떨리는 선".
 */
function BeanBody({ paper }: { paper: string }) {
  return (
    <>
      <path
        d="M20.3 3.6c6.4.5 12.4 6.9 12.5 16.1.2 9.2-5.7 16.7-12.5 16.8-7 .1-13-7.1-13.2-16.3C6.9 11.1 13.7 3.9 20.3 3.6Z"
        fill="currentColor"
      />
      <path
        d="M20.2 4.8C17.1 11 23 17 20 23c-2.6 5.3 1.9 7.5.1 11.6"
        fill="none"
        stroke={paper}
        strokeWidth="2.3"
        strokeLinecap="round"
      />
    </>
  );
}

/**
 * 브랜드 마크. 결정서·디자인 문서의 `▨ 원 두 도 감` 자리에 들어갑니다.
 * 도장 테두리 안에 원두가 들어앉은 형태 — 도감의 "확정 항목" 은유입니다.
 */
export function CodexMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label="원두도감"
      focusable="false"
    >
      <rect
        x="1.6"
        y="1.6"
        width="36.8"
        height="36.8"
        rx="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <g transform="rotate(-16 20 20) scale(.72) translate(7.8 7.8)">
        <BeanBody paper="var(--paper)" />
      </g>
    </svg>
  );
}

/**
 * 지도 위 협력업체 마커 (02 §5: `--stamp` 원형 + 원두 실루엣).
 * 이중 테두리는 영수증 도장의 링과 같은 조형이라, 지도와 카드가 같은 도구로
 * 찍힌 것처럼 읽힙니다.
 */
export function BeanStamp({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="20" cy="20" r="18.6" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="20" cy="20" r="15" fill="none" stroke="currentColor" strokeWidth="1" opacity=".55" />
      <g transform="rotate(-16 20 20) scale(.58) translate(14.5 14.5)">
        <BeanBody paper="var(--paper)" />
      </g>
    </svg>
  );
}

export type BibinVariant =
  | "neutral"
  | "map-reading"
  | "map-lost"
  | "squinting"
  | "map-puzzled"
  | "inspecting"
  | "delighted"
  | "surprised"
  | "diary-writing";

const bibinPresets: Record<BibinVariant, { src: string; label: string }> = {
  neutral: { src: "/mascot/bibean-neutral.png", label: "비빈" },
  "map-reading": { src: "/mascot/bibean-map-reading.png", label: "지도를 읽는 비빈" },
  "map-lost": { src: "/mascot/bibean-map-lost.png", label: "길을 잃은 비빈" },
  squinting: { src: "/mascot/bibean-squinting.png", label: "눈을 찡그려 보는 비빈" },
  "map-puzzled": { src: "/mascot/bibean-map-puzzled.png", label: "지도를 고민하는 비빈" },
  inspecting: { src: "/mascot/bibean-inspecting.png", label: "유심히 살펴보는 비빈" },
  delighted: { src: "/mascot/bibean-delighted.png", label: "신이 난 비빈" },
  surprised: { src: "/mascot/bibean-surprised.png", label: "깜짝 놀란 비빈" },
  "diary-writing": { src: "/mascot/bibean-diary-writing.png", label: "다이어리에 기록하는 비빈" },
};

/** 제공된 PNG 프리셋을 상황에 맞춰 보여 주는 인터랙티브 마스코트. */
export function Bibin({
  variant = "neutral",
  size = 72,
  className,
}: {
  variant?: BibinVariant;
  size?: number;
  className?: string;
}) {
  const root = useRef<HTMLButtonElement>(null);
  const [isBoinging, setIsBoinging] = useState(false);
  const preset = isBoinging ? bibinPresets.surprised : bibinPresets[variant];

  const boing = () => {
    const element = root.current;
    if (!element) return;
    setIsBoinging(true);
    element.classList.remove("is-boinging");
    void element.getBoundingClientRect();
    element.classList.add("is-boinging");
  };

  return (
    <button
      ref={root}
      className={["bibin", className].filter(Boolean).join(" ")}
      style={{ width: size, height: size }}
      type="button"
      aria-label={`${preset.label} 눌러보기`}
      onClick={boing}
      onAnimationEnd={(event) => {
        setIsBoinging(false);
        event.currentTarget.classList.remove("is-boinging");
      }}
    >
      <img src={preset.src} alt="" width="512" height="512" draggable="false" />
    </button>
  );
}
