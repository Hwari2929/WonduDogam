"use client";

import { useRef, useState } from "react";
import { asset } from "../base-path";

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

/**
 * 원두 실루엣 하나. 상호 옆에 붙어 "비빈 파트너"를 뜻합니다.
 *
 * 도장 테두리도 눈도 없는 조형이라 §7.3의 "한 화면에 비빈은 하나"에 걸리지
 * 않습니다 — 이건 마스코트가 아니라 표시입니다.
 */
export function BeanMark({ size = 19, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <BeanBody paper="var(--paper)" />
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

/**
 * 원본은 512px PNG(34~52KB)지만 화면에서 가장 크게 쓰는 자리가 96px이라
 * 256px WebP(8~11KB)로 구워 씁니다 — 03_기능_명세 §9의 "이미지: WebP".
 * 원본 PNG는 public/mascot 에 그대로 두어 OG·인쇄물에 쓸 수 있게 남깁니다.
 */
const bibinPresets: Record<BibinVariant, { src: string; label: string }> = {
  neutral: { src: "/mascot/bibean-neutral.webp", label: "비빈" },
  "map-reading": { src: "/mascot/bibean-map-reading.webp", label: "지도를 읽는 비빈" },
  "map-lost": { src: "/mascot/bibean-map-lost.webp", label: "길을 잃은 비빈" },
  squinting: { src: "/mascot/bibean-squinting.webp", label: "눈을 찡그려 보는 비빈" },
  "map-puzzled": { src: "/mascot/bibean-map-puzzled.webp", label: "지도를 고민하는 비빈" },
  inspecting: { src: "/mascot/bibean-inspecting.webp", label: "유심히 살펴보는 비빈" },
  delighted: { src: "/mascot/bibean-delighted.webp", label: "신이 난 비빈" },
  surprised: { src: "/mascot/bibean-surprised.webp", label: "깜짝 놀란 비빈" },
  "diary-writing": { src: "/mascot/bibean-diary-writing.webp", label: "다이어리에 기록하는 비빈" },
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
      {/* 사이트가 하위 경로에 서면 앞의 빗금이 저장소를 건너뛰므로, 쓰는 자리에서 붙입니다. */}
      <img src={asset(preset.src)} alt="" width="256" height="256" draggable="false" loading="lazy" decoding="async" />
    </button>
  );
}
