"use client";

import { useEffect, useState } from "react";

/**
 * 시트를 끌어내려 닫기 (좁은 화면).
 *
 * 잡고 내리는 바를 걷어낸 자리를 이것이 대신합니다. 잡을 곳을 따로 그려 두지
 * 않고, 종이가 맨 위에 닿아 있을 때 아래로 끌면 종이가 손을 따라옵니다 —
 * 읽다가 아래로 밀면 계속 읽히고, 다 읽고 위로 되돌리면 그대로 닫힙니다.
 *
 * 자리는 state 가 아니라 요소에 직접 씁니다. 손가락이 움직이는 프레임마다 화면
 * 전체를 다시 그릴 이유가 없습니다.
 */
/** 이만큼 내려온 채로 놓으면 닫습니다(px). */
const CLOSE_AT = 96;
/** 던지기로 볼 속도(px/ms). 거리가 모자라도 기세가 있으면 닫습니다. */
const FLICK = 0.4;
/** 놓은 뒤 제자리로 돌아가거나 마저 내려가는 시간(ms). */
const SETTLE_MS = 200;

export function useSheetPull({ enabled, onClose }: { enabled: boolean; onClose: () => void }) {
  /**
   * 시트 요소를 state 로 받습니다. ref 로 두면 도크가 닫혔다 다시 열릴 때
   * 효과가 다시 돌지 않아, 새로 생긴 종이에는 손짓이 안 붙습니다.
   */
  const [dock, setDock] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled || !dock) return;
    const scroller = dock.querySelector<HTMLElement>(".dock__scroll");
    if (!scroller) return;

    let startY = 0;
    let lastY = 0;
    let lastAt = 0;
    let velocity = 0;
    let offset = 0;
    let pulling = false;
    let timer = 0;

    function begin(event: TouchEvent) {
      if (event.touches.length !== 1) return;
      window.clearTimeout(timer);
      dock.style.transition = "";
      startY = lastY = event.touches[0].clientY;
      lastAt = performance.now();
      velocity = 0;
      offset = 0;
      pulling = false;
    }

    function move(event: TouchEvent) {
      if (event.touches.length !== 1) return;
      const y = event.touches[0].clientY;
      // 종이가 맨 위에 닿아 있을 때 아래로 끄는 것만 시트를 끕니다. 그 전까지는
      // 기준점을 손가락에 붙여 두어, 다 올린 그 자리에서 이어서 끌리게 합니다.
      if (!pulling) {
        if (y - startY <= 0 || scroller.scrollTop > 0) {
          startY = y;
          return;
        }
        pulling = true;
        dock.style.willChange = "transform";
      }
      // 여기서 막지 않으면 브라우저가 제 나름의 튕김을 얹어 두 개가 겹칩니다.
      event.preventDefault();
      const now = performance.now();
      // 손가락이 프레임보다 촘촘히 들어오면 간격이 0에 가깝습니다. 그때도 속도는
      // 재야 합니다 — 안 재면 빠르게 튕긴 손짓이 "안 움직였다"로 읽힙니다.
      const elapsed = Math.max(now - lastAt, 1);
      velocity = (y - lastY) / elapsed;
      lastAt = now;
      lastY = y;
      offset = Math.max(0, y - startY);
      dock.style.transform = `translate3d(0, ${offset}px, 0)`;
    }

    function end() {
      if (!pulling) return;
      pulling = false;
      const leaving = offset > CLOSE_AT || velocity > FLICK;
      dock.style.transition = `transform ${SETTLE_MS}ms var(--ease-paper)`;
      dock.style.transform = leaving ? `translate3d(0, ${dock.getBoundingClientRect().height}px, 0)` : "";
      timer = window.setTimeout(() => {
        dock.style.transition = "";
        dock.style.willChange = "";
        if (leaving) {
          dock.style.transform = "";
          onClose();
        }
      }, SETTLE_MS);
    }

    dock.addEventListener("touchstart", begin, { passive: true });
    dock.addEventListener("touchmove", move, { passive: false });
    dock.addEventListener("touchend", end);
    dock.addEventListener("touchcancel", end);
    return () => {
      window.clearTimeout(timer);
      dock.removeEventListener("touchstart", begin);
      dock.removeEventListener("touchmove", move);
      dock.removeEventListener("touchend", end);
      dock.removeEventListener("touchcancel", end);
      dock.style.transition = "";
      dock.style.transform = "";
      dock.style.willChange = "";
    };
  }, [enabled, onClose, dock]);

  return setDock;
}
