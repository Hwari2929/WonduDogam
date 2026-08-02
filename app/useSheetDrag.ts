"use client";

import { useCallback, useRef, useState } from "react";

/**
 * 모바일 하단 시트 끌기 (02_디자인_시스템 §8.1 — "영수증: 하단 시트 (드래그)").
 *
 * 손잡이를 그려 놓고 끌리지 않으면 없는 기능이 있는 척하는 셈입니다.
 * 두 자리만 둡니다 — 펼침과 살짝 내림. 더 내리면 접힙니다.
 * 탭으로도 두 자리를 오갈 수 있어야 키보드와 보조기술에서도 닿습니다.
 *
 * 시트 요소는 ref 로 들고 있지 않고 포인터 이벤트에서 찾아 씁니다. 훅이 ref 를
 * 돌려주면 그 값을 읽는 쪽이 전부 "렌더 중 ref 접근"이 되어버립니다.
 */
export type SheetSnap = "full" | "peek";

const SHEET_SELECTOR = ".dock";
/** 시트 높이의 이만큼 내려간 자리가 "살짝 내림"입니다. */
const PEEK_RATIO = 0.42;
/**
 * 던지기로 볼 속도(px/ms). 손가락을 아래로 튕기면 얼마나 멀리 갔는지와 무관하게
 * 한 자리 내려갑니다 — 조금만 잡고 내려도 내려가야 하는 건 거리가 아니라 기세입니다.
 */
const FLICK = 0.25;
/**
 * 던지지 않고 그냥 끌었을 때의 자리. 두 자리 사이 이만큼 왔으면 넘어간 것으로 봅니다.
 * 예전에는 절반(50%)에 더해 96px 을 더 끌어야 접혔는데, 폰에서 그건 화면의 3분의 1을
 * 손가락으로 쓸어내리라는 말이었습니다.
 */
const PASS = 0.25;
/** 이만큼 안 움직이고 뗐으면 끈 게 아니라 친 것으로 봅니다(px). */
const TAP_SLOP = 8;

export function useSheetDrag({ enabled, onClose }: { enabled: boolean; onClose: () => void }) {
  const [storedSnap, setStoredSnap] = useState<SheetSnap>("full");
  const [dragging, setDragging] = useState(false);

  /**
   * 끄는 동안만 쓰는 값들. 렌더에는 관여하지 않습니다.
   *
   * 자리(y)를 state 로 들고 있으면 손가락이 움직이는 프레임마다 화면 전체가
   * 다시 그려집니다 — 시트 하나 내리자고 지도와 영수증까지 다시 짓는 셈입니다.
   * 끄는 동안에는 시트 요소의 --sheet-y 만 직접 씁니다.
   */
  const gesture = useRef({ sheet: null as HTMLElement | null, startY: 0, base: 0, peekAt: 0, y: 0, at: 0, lastY: 0, velocity: 0, moved: 0 });

  // 데스크톱 폭에서는 시트 상태를 아예 없는 셈 칩니다. 효과로 되돌리는 대신
  // 파생값으로 두면 폭이 바뀌는 순간 군더더기 렌더가 생기지 않습니다.
  const snap: SheetSnap = enabled ? storedSnap : "full";

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled) return;
      const sheet = event.currentTarget.closest<HTMLElement>(SHEET_SELECTOR);
      if (!sheet) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);

      const peekAt = sheet.getBoundingClientRect().height * PEEK_RATIO;
      const base = snap === "peek" ? peekAt : 0;
      const now = performance.now();
      gesture.current = { sheet, startY: event.clientY, base, peekAt, y: base, at: now, lastY: event.clientY, velocity: 0, moved: 0 };
      sheet.style.setProperty("--sheet-y", `${base}px`);
      setDragging(true);
    },
    [enabled, snap],
  );

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const state = gesture.current;
    if (!state.sheet) return;
    // 위로는 펼침 자리를 넘지 않고, 아래로는 조금 더 끌리게 둡니다.
    const y = Math.max(0, state.base + (event.clientY - state.startY));
    const now = performance.now();
    const elapsed = now - state.at;
    // 마지막 한 조각의 속도만 봅니다. 처음부터 평균을 내면 천천히 끌다 마지막에
    // 튕긴 손가락이 "느리게 끌었다"로 읽힙니다.
    if (elapsed > 4) {
      state.velocity = (event.clientY - state.lastY) / elapsed;
      state.at = now;
      state.lastY = event.clientY;
    }
    state.y = y;
    state.moved = Math.max(state.moved, Math.abs(event.clientY - state.startY));
    state.sheet.style.setProperty("--sheet-y", `${y}px`);
  }, []);

  const onPointerUp = useCallback(() => {
    const { sheet, y, peekAt, velocity } = gesture.current;
    if (!sheet) return;
    gesture.current.sheet = null;
    setDragging(false);
    // 인라인 값은 **자리 표시가 갈아 끼워진 다음에** 뗍니다. 여기서 곧바로 지우면
    // 아직 is-dragging(전이 없음)인 상태에서 값이 바뀌어, 놓는 순간 툭 끊깁니다.
    requestAnimationFrame(() => sheet.style.removeProperty("--sheet-y"));

    const from: SheetSnap = y > peekAt / 2 ? "peek" : "full";
    // 아래로 튕겼으면 한 자리 내려가고, 위로 튕겼으면 곧장 펼칩니다.
    if (velocity > FLICK) {
      if (from === "peek") {
        setStoredSnap("full"); // 다음에 열 때는 펼친 자리에서 시작합니다
        onClose();
      } else {
        setStoredSnap("peek");
      }
      return;
    }
    if (velocity < -FLICK) {
      setStoredSnap("full");
      return;
    }
    // 던지지 않았으면 얼마나 왔는지로 정합니다.
    if (y > peekAt * (1 + PASS)) {
      setStoredSnap("full");
      onClose();
      return;
    }
    setStoredSnap(y > peekAt * PASS ? "peek" : "full");
  }, [onClose]);

  /**
   * 탭으로도 두 자리를 오갑니다. 다만 **끌고 나서 떼는 것도 click 을 부르므로**,
   * 방금 끈 손짓이었으면 여기서 물러납니다 — 안 그러면 내려놓은 시트가 곧바로
   * 도로 올라갑니다.
   */
  const toggle = useCallback(() => {
    if (gesture.current.moved > TAP_SLOP) return;
    setStoredSnap((current) => (current === "full" ? "peek" : "full"));
  }, []);

  return {
    snap,
    dragging: enabled && dragging,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onClick: toggle,
    },
  };
}
