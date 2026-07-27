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
const PEEK_RATIO = 0.42; // 시트 높이의 42%만큼 내려갑니다.
const CLOSE_THRESHOLD = 96; // 살짝 내린 자리에서 이만큼 더 끌면 접습니다.

export function useSheetDrag({ enabled, onClose }: { enabled: boolean; onClose: () => void }) {
  const [storedSnap, setStoredSnap] = useState<SheetSnap>("full");
  const [dragY, setDragY] = useState<number | null>(null);

  /** 끄는 동안만 쓰는 값들. 렌더에는 관여하지 않습니다. */
  const gesture = useRef({ startY: 0, base: 0, peekAt: 0 });

  // 데스크톱 폭에서는 시트 상태를 아예 없는 셈 칩니다. 효과로 되돌리는 대신
  // 파생값으로 두면 폭이 바뀌는 순간 군더더기 렌더가 생기지 않습니다.
  const snap: SheetSnap = enabled ? storedSnap : "full";
  const dragging = enabled && dragY !== null;

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!enabled) return;
      const sheet = event.currentTarget.closest<HTMLElement>(SHEET_SELECTOR);
      if (!sheet) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);

      const peekAt = sheet.getBoundingClientRect().height * PEEK_RATIO;
      const base = snap === "peek" ? peekAt : 0;
      gesture.current = { startY: event.clientY, base, peekAt };
      setDragY(base);
    },
    [enabled, snap],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (dragY === null) return;
      const { startY, base } = gesture.current;
      // 위로는 펼침 자리를 넘지 않고, 아래로는 조금 더 끌리게 둡니다.
      setDragY(Math.max(0, base + (event.clientY - startY)));
    },
    [dragY],
  );

  const onPointerUp = useCallback(() => {
    if (dragY === null) return;
    const { peekAt } = gesture.current;
    setDragY(null);
    if (dragY > peekAt + CLOSE_THRESHOLD) {
      setStoredSnap("full"); // 다음에 열 때는 펼친 자리에서 시작합니다
      onClose();
      return;
    }
    setStoredSnap(dragY > peekAt / 2 ? "peek" : "full");
  }, [dragY, onClose]);

  const toggle = useCallback(
    () => setStoredSnap((current) => (current === "full" ? "peek" : "full")),
    [],
  );

  return {
    snap,
    dragging,
    /** 끄는 중에만 인라인으로 픽셀을 씁니다. 놓으면 CSS 가 스냅 위치를 맡습니다. */
    style: dragging ? ({ "--sheet-y": `${dragY}px` } as React.CSSProperties) : undefined,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onClick: toggle,
    },
  };
}
