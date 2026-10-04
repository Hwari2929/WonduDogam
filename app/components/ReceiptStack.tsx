"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AXIS_LOCK_PX } from "../useSheetPull";

/** 놓았을 때 넘어가는 거리(종이 폭 대비). 반을 끌게 하면 넘기는 게 일이 됩니다. */
const PASS_SHARE = 0.22;
/** 거리가 모자라도 이만큼 빠르게 튕기면 넘어갑니다(px/ms). */
const FLICK = 0.45;
/** 넘길 장이 없는 쪽으로 끌면 이만큼만 따라옵니다 — 막혀 있다는 걸 손이 압니다. */
const EDGE_GIVE = 0.3;
/** 종이가 빠져나가거나 제자리로 돌아오는 시간(ms). */
const SLIDE_MS = 170;
/**
 * 트랙패드 가로 밀기를 몇 px 모아야 한 장으로 칠까. 한 번 쓸면 관성으로 수십 번
 * 들어오므로, 넘긴 뒤에는 조용해질 때까지 더 받지 않습니다.
 */
const WHEEL_PASS = 60;
const WHEEL_QUIET_MS = 260;

/**
 * 영수증 뭉치. 한 핀에 같이 묶여 있던 가게들을 좌우로 넘겨 봅니다.
 *
 * 뭉치라는 건 뒤에 비치는 종이로 압니다 — 오른쪽 아래로 4px 씩 어긋난 종이가 많아야
 * 두 장 비칩니다. 몇 번째 장인지는 영수증 머리의 "2 / 5" 가 말합니다.
 *
 * 넘기는 손짓은 세로 손짓(본문 스크롤, 아래로 당겨 치우기)과 방향으로 갈립니다.
 * 처음 AXIS_LOCK_PX 를 움직인 방향으로 한 번 정하고 손을 뗄 때까지 지킵니다 —
 * 시트를 당기는 쪽(useSheetPull)도 같은 값과 같은 기준을 써서, 한 손짓을 둘이
 * 나눠 갖는 일이 없습니다. 세로는 브라우저가 그대로 굴리도록 touch-action 을
 * pan-y 로 두었으니, 여기서는 가로만 받습니다.
 *
 * 끄는 동안의 자리는 state 가 아니라 요소에 직접 씁니다. 손가락이 움직이는
 * 프레임마다 영수증 전체를 다시 그릴 이유가 없습니다.
 */
export function ReceiptStack({ index, total, onGo, children }: {
  index: number;
  total: number;
  /** 앞(-1) 또는 뒤(+1)로 한 장. 끝에서 부르면 아무 일도 안 일어납니다. */
  onGo: (delta: -1 | 1) => void;
  children: ReactNode;
}) {
  const stackRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);

  // 어느 쪽에서 들어온 장인가. 앞 렌더의 자리와 견주어 정합니다 — 단추로 넘기든
  // 키로 넘기든 손으로 넘기든 같은 셈이라, 넘긴 쪽이 따로 알려 줄 필요가 없습니다.
  const [seen, setSeen] = useState({ index, from: 0 });
  if (seen.index !== index) setSeen({ index, from: index > seen.index ? 1 : -1 });

  // 손짓이 쓰는 값은 손짓 내내 같아야 합니다. 렌더마다 효과를 다시 붙이면
  // 끄는 도중에 리스너가 갈아 끼워져 손짓이 끊깁니다.
  const live = useRef({ index, total, onGo });
  useEffect(() => {
    live.current = { index, total, onGo };
  });

  useEffect(() => {
    const stack = stackRef.current;
    if (!stack) return;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastAt = 0;
    let velocity = 0;
    let dx = 0;
    let axis: "x" | "y" | null = null;
    let timer = 0;

    const face = () => faceRef.current;
    const canGo = (delta: -1 | 1) => {
      const next = live.current.index + delta;
      return next >= 0 && next < live.current.total;
    };
    function place(x: number, animate: boolean) {
      const element = face();
      if (!element) return;
      element.style.transition = animate ? `transform ${SLIDE_MS}ms var(--ease-paper)` : "";
      element.style.transform = x ? `translate3d(${x}px, 0, 0)` : "";
    }

    function begin(event: TouchEvent) {
      if (event.touches.length !== 1) return;
      window.clearTimeout(timer);
      startX = lastX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      lastAt = performance.now();
      velocity = 0;
      dx = 0;
      axis = null;
    }

    function move(event: TouchEvent) {
      if (event.touches.length !== 1 || axis === "y") return;
      const x = event.touches[0].clientX;
      const rawX = x - startX;
      if (!axis) {
        const rawY = event.touches[0].clientY - startY;
        if (Math.max(Math.abs(rawX), Math.abs(rawY)) < AXIS_LOCK_PX) return;
        axis = Math.abs(rawX) > Math.abs(rawY) ? "x" : "y";
        if (axis === "y") return;
        const element = face();
        if (element) element.style.willChange = "transform";
      }
      const now = performance.now();
      velocity = (x - lastX) / Math.max(now - lastAt, 1);
      lastX = x;
      lastAt = now;
      // 왼쪽으로 밀면 다음 장(+1)입니다. 그쪽에 장이 없으면 덜 따라옵니다.
      const toward: -1 | 1 = rawX < 0 ? 1 : -1;
      dx = canGo(toward) ? rawX : rawX * EDGE_GIVE;
      place(dx, false);
    }

    function end() {
      if (axis !== "x") return;
      axis = null;
      const element = face();
      const width = element?.getBoundingClientRect().width ?? 1;
      const toward: -1 | 1 = dx < 0 ? 1 : -1;
      const flicked = Math.abs(velocity) > FLICK && Math.sign(velocity) === Math.sign(dx);
      const passed = canGo(toward) && (Math.abs(dx) > width * PASS_SHARE || flicked);
      if (!passed) {
        place(0, true);
        timer = window.setTimeout(() => { if (element) { element.style.transition = ""; element.style.willChange = ""; } }, SLIDE_MS);
        return;
      }
      // 마저 빠져나간 뒤에 장을 바꿉니다. 새 장은 반대쪽에서 들어옵니다(CSS).
      place(-toward * (width + 24), true);
      timer = window.setTimeout(() => {
        if (element) { element.style.transition = ""; element.style.willChange = ""; }
        live.current.onGo(toward);
      }, SLIDE_MS);
    }

    // 트랙패드의 가로 밀기. 세로 굴림은 그대로 흘려보냅니다.
    let wheelSum = 0;
    let wheelLocked = false;
    let wheelTimer = 0;
    function wheel(event: WheelEvent) {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      // 브라우저의 "뒤로 가기" 쓸기와 겹치지 않게 여기서 멈춥니다.
      event.preventDefault();
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => { wheelSum = 0; wheelLocked = false; }, WHEEL_QUIET_MS);
      if (wheelLocked) return;
      wheelSum += event.deltaX;
      if (Math.abs(wheelSum) < WHEEL_PASS) return;
      const toward: -1 | 1 = wheelSum > 0 ? 1 : -1;
      wheelSum = 0;
      wheelLocked = true;
      if (canGo(toward)) live.current.onGo(toward);
    }

    stack.addEventListener("touchstart", begin, { passive: true });
    stack.addEventListener("touchmove", move, { passive: true });
    stack.addEventListener("touchend", end);
    stack.addEventListener("touchcancel", end);
    stack.addEventListener("wheel", wheel, { passive: false });
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(wheelTimer);
      stack.removeEventListener("touchstart", begin);
      stack.removeEventListener("touchmove", move);
      stack.removeEventListener("touchend", end);
      stack.removeEventListener("touchcancel", end);
      stack.removeEventListener("wheel", wheel);
    };
  }, []);

  // 뒤에 비치는 종이는 많아야 두 장입니다. 다섯 장이든 스무 장이든 "뭉치"라는 것만
  // 전하면 되고, 몇 장인지는 머리의 숫자가 말합니다.
  const behind = Math.min(total - 1, 2);
  return (
    <div ref={stackRef} className="receipt-stack" style={{ "--behind": behind } as CSSProperties}>
      {Array.from({ length: behind }, (_, slot) => behind - slot).map((depth) => (
        <span key={depth} className="receipt-stack__sheet" style={{ "--depth": depth } as CSSProperties} aria-hidden="true" />
      ))}
      <div
        // 장이 바뀌면 새 요소로 갈아 끼워, 들어오는 움직임이 처음부터 다시 돕니다.
        key={index}
        ref={faceRef}
        className={["receipt-stack__face", seen.from > 0 ? "is-from-right" : seen.from < 0 ? "is-from-left" : ""].filter(Boolean).join(" ")}
      >
        {children}
      </div>
    </div>
  );
}
