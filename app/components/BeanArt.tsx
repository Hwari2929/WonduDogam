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

export type BibinMood = "proud" | "sheepish" | "cheer";

const moodLabel: Record<BibinMood, string> = {
  proud: "도장을 든 비빈",
  sheepish: "멋쩍어하는 비빈",
  cheer: "비빈",
};

/**
 * 마스코트 비빈. 화면에 **하나만** 그립니다 — 어느 것을 그릴지는
 * app/page.tsx 의 mascotSlot 이 정합니다.
 *
 * 팔다리는 그리지 않습니다. 등장 크기가 20~38px이라 팔을 넣으면 몸통 옆의
 * 얼룩으로만 읽히고, §7.1이 지키라는 크랙과 눈까지 흐려집니다. 표정은 눈으로,
 * 상황은 몸통에서 떨어진 물건 하나로 말합니다.
 */
export function Bibin({
  mood = "cheer",
  size = 26,
  className,
}: {
  mood?: BibinMood;
  size?: number;
  className?: string;
}) {
  const paper = "var(--paper)";
  return (
    <svg
      className={className}
      width={size}
      height={(size * 44) / 40}
      viewBox="0 0 40 44"
      role="img"
      aria-label={moodLabel[mood]}
      focusable="false"
    >
      {/* 상황을 말하는 물건. 몸통에서 떨어뜨려 두어야 팔로 오해되지 않습니다. */}
      {mood === "proud" ? (
        <rect
          x="27.6"
          y="2.4"
          width="10.6"
          height="9"
          rx="1.4"
          fill="none"
          stroke="var(--stamp)"
          strokeWidth="2"
          transform="rotate(-7 32.9 6.9)"
        />
      ) : null}
      {mood === "sheepish" ? (
        <path d="M34 3.6c1.9 2.6 2.6 3.8 2.6 5a2.6 2.6 0 1 1-5.2 0c0-1.2.7-2.4 2.6-5Z" fill="currentColor" opacity=".7" />
      ) : null}

      <g transform="rotate(-14 20 22) translate(0 2)">
        <BeanBody paper={paper} />
        {mood === "proud" ? (
          <g fill="none" stroke={paper} strokeWidth="2.1" strokeLinecap="round">
            <path d="M11.5 17q2.3-3 4.6 0" />
            <path d="M24.5 17q2.3-3 4.6 0" />
          </g>
        ) : mood === "sheepish" ? (
          <>
            <circle cx="13.9" cy="15.6" r="2.2" fill={paper} />
            <path
              d="M24.2 15.9q2.4-1.6 4.8 0"
              fill="none"
              stroke={paper}
              strokeWidth="2.1"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <circle cx="13.9" cy="15.6" r="2.2" fill={paper} />
            <circle cx="26.5" cy="15.6" r="2.2" fill={paper} />
          </>
        )}
      </g>
    </svg>
  );
}
