"use client";

import { useEffect, useRef, useState, type AnimationEvent, type CSSProperties, type ReactNode } from "react";
import { AXIS_LOCK_PX } from "../useSheetPull";

/** 놓았을 때 넘어가는 거리(종이 폭 대비). 반을 끌게 하면 넘기는 게 일이 됩니다. */
const PASS_SHARE = 0.22;
/** 거리가 모자라도 이만큼 빠르게 튕기면 넘어갑니다(px/ms). */
const FLICK = 0.45;
/** 넘길 장이 없는 쪽으로 끌면 이만큼만 따라옵니다 — 막혀 있다는 걸 손이 압니다. */
const EDGE_GIVE = 0.3;
/** 끄는 만큼 종이가 기웁니다. 종이 폭을 다 끌었을 때의 각도(deg). */
const TILT_DEG = 5;
/** 밑의 장이 처음에 얼마나 작게 깔려 있는가. 위 장이 비켜 갈수록 제 크기로 올라옵니다. */
const UNDER_SCALE = 0.965;
/** 덜 끌고 놓았을 때 제자리로 튕겨 돌아오는 시간(ms). 살짝 지나쳤다 돌아옵니다(CSS). */
const SPRING_MS = 340;
/**
 * 트랙패드 가로 밀기를 몇 px 모아야 한 장으로 칠까. 한 번 쓸면 관성으로 수십 번
 * 들어오므로, 넘긴 뒤에는 조용해질 때까지 더 받지 않습니다.
 */
const WHEEL_PASS = 60;
const WHEEL_QUIET_MS = 260;

/**
 * 뒤에 비치는 종이의 장수. 많아야 두 장입니다 — 다섯 장이든 스무 장이든 "뭉치"라는
 * 것만 전하면 되고, 몇 장인지는 머리의 숫자가 말합니다. 도크가 이만큼 넓어져야
 * 하므로 page.tsx 도 같은 셈을 씁니다.
 */
export function sheetsBehind(total: number) {
  return Math.min(Math.max(total - 1, 0), 2);
}

/**
 * 영수증 뭉치. 한 핀에 같이 묶여 있던 가게들을 좌우로 넘겨 봅니다.
 *
 * **넘길 장은 미리 밑에 깔려 있습니다.** 지금 장의 앞뒤 한 장씩을 같은 자리 밑에
 * 그려 두고, 위 장을 끌어 비키면 밑의 장이 드러납니다 — 메모 패드에서 한 장을
 * 뜯어내는 것과 같습니다. 예전에는 위 장이 다 빠져나간 뒤에야 다음 장을 만들어
 * 투명에서 떠올렸는데, 그 사이 3분의 1초 동안 화면에 아무것도 없었습니다.
 *
 * 장은 뭉치 안의 차례대로 늘 같은 순서로 그립니다. 앞뒤가 바뀌어도 이미 있던
 * 요소는 자리를 옮기지 않고(옮기면 진행 중인 움직임이 끊깁니다), 겹치는 순서는
 * z-index 로만 바꿉니다.
 *
 * 넘기는 손짓은 세로 손짓(본문 스크롤, 아래로 당겨 치우기)과 방향으로 갈립니다.
 * 처음 AXIS_LOCK_PX 를 움직인 방향으로 한 번 정하고 손을 뗄 때까지 지킵니다 —
 * 시트를 당기는 쪽(useSheetPull)도 같은 값과 같은 기준을 써서, 한 손짓을 둘이
 * 나눠 갖는 일이 없습니다.
 *
 * 끄는 동안의 자리는 state 가 아니라 요소에 직접 씁니다. 손가락이 움직이는
 * 프레임마다 영수증 세 장을 다시 그릴 이유가 없습니다.
 */
export function ReceiptStack({ ids, index, onGo, renderAt }: {
  ids: string[];
  index: number;
  /** 앞(-1) 또는 뒤(+1)로 한 장. 끝에서 부르면 아무 일도 안 일어납니다. */
  onGo: (delta: -1 | 1) => void;
  /** 뭉치의 i 번째 영수증. 밑에 깔리는 장도 같은 종이라 같은 손으로 만듭니다. */
  renderAt: (id: string, index: number) => ReactNode;
}) {
  const total = ids.length;
  const stackRef = useRef<HTMLDivElement>(null);

  // 방금 비켜 간 장과 그 방향. 앞 렌더의 자리와 견주어 정합니다 — 단추로 넘기든
  // 키로 넘기든 손으로 넘기든 같은 셈이라, 넘긴 쪽이 따로 알려 줄 필요가 없습니다.
  const [seen, setSeen] = useState<{ index: number; leaving: number | null; dir: -1 | 0 | 1 }>({ index, leaving: null, dir: 0 });
  if (seen.index !== index) setSeen({ index, leaving: seen.index, dir: index > seen.index ? 1 : -1 });

  // 손짓이 쓰는 값은 손짓 내내 같아야 합니다. 렌더마다 효과를 다시 붙이면
  // 끄는 도중에 리스너가 갈아 끼워져 손짓이 끊깁니다.
  const live = useRef({ index, total, onGo });
  useEffect(() => {
    live.current = { index, total, onGo };
  });

  useEffect(() => {
    const root = stackRef.current;
    if (!root) return;
    // 안쪽 함수들까지 "있다"는 걸 들고 가도록 한 번 묶어 둡니다.
    const stack: HTMLDivElement = root;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastAt = 0;
    let velocity = 0;
    let dx = 0;
    let axis: "x" | "y" | null = null;
    let timer = 0;

    const card = (slot: string) => stack.querySelector<HTMLElement>(`.receipt-stack__card[data-slot="${slot}"]`);
    const canGo = (delta: -1 | 1) => {
      const next = live.current.index + delta;
      return next >= 0 && next < live.current.total;
    };
    /** 위 장의 자리와 기울기, 그리고 드러나는 밑 장의 크기를 한 번에 씁니다. */
    function pose(x: number) {
      const face = card("face");
      if (!face) return;
      const width = face.getBoundingClientRect().width || 1;
      const progress = Math.min(Math.abs(x) / width, 1);
      face.style.transform = x ? `translate3d(${x}px, 0, 0) rotate(${(x / width) * TILT_DEG}deg)` : "";
      // 끄는 쪽의 밑 장만 올립니다. 반대쪽 장은 그대로 깔려 있습니다.
      const toward = x < 0 ? "next" : "prev";
      stack.dataset.toward = x ? toward : "";
      const under = x ? card(toward) : null;
      if (under) under.style.transform = `scale(${UNDER_SCALE + (1 - UNDER_SCALE) * progress})`;
      const other = card(toward === "next" ? "prev" : "next");
      if (other) other.style.transform = "";
    }
    function settle(element: HTMLElement | null) {
      if (!element) return;
      element.style.transition = "";
      element.style.willChange = "";
    }

    function begin(event: TouchEvent) {
      if (event.touches.length !== 1) return;
      window.clearTimeout(timer);
      for (const slot of ["face", "prev", "next"]) {
        const element = card(slot);
        settle(element);
        // 자리를 잡으며 튕기는 중에 다시 잡으면 튕김을 끝내 버립니다. 안 그러면 그
        // 0.4초 동안 움직임이 인라인 자리보다 앞서서, 종이가 손을 안 따라옵니다.
        for (const animation of element?.getAnimations() ?? []) {
          if (animation instanceof CSSAnimation && animation.animationName === "stack-arrive") animation.finish();
        }
      }
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
        for (const slot of ["face", "prev", "next"]) {
          const element = card(slot);
          if (element) element.style.willChange = "transform";
        }
      }
      const now = performance.now();
      velocity = (x - lastX) / Math.max(now - lastAt, 1);
      lastX = x;
      lastAt = now;
      // 왼쪽으로 밀면 다음 장(+1)입니다. 그쪽에 장이 없으면 덜 따라옵니다.
      const toward: -1 | 1 = rawX < 0 ? 1 : -1;
      dx = canGo(toward) ? rawX : rawX * EDGE_GIVE;
      pose(dx);
    }

    function end() {
      if (axis !== "x") return;
      axis = null;
      const face = card("face");
      const width = face?.getBoundingClientRect().width ?? 1;
      const toward: -1 | 1 = dx < 0 ? 1 : -1;
      const flicked = Math.abs(velocity) > FLICK && Math.sign(velocity) === Math.sign(dx);
      const passed = canGo(toward) && (Math.abs(dx) > width * PASS_SHARE || flicked);
      if (!passed) {
        // 덜 끌었으면 제자리로 튕겨 돌아옵니다 — 살짝 지나쳤다 돌아오는 곡선이라,
        // 종이가 손에 붙어 있다가 놓인 것처럼 보입니다.
        const under = card(dx < 0 ? "next" : "prev");
        for (const element of [face, under]) {
          if (element) element.style.transition = `transform ${SPRING_MS}ms var(--ease-spring)`;
        }
        pose(0);
        if (under) under.style.transform = "";
        timer = window.setTimeout(() => {
          for (const slot of ["face", "prev", "next"]) settle(card(slot));
          stack.dataset.toward = "";
        }, SPRING_MS);
        return;
      }
      // 넘어갑니다. 위 장은 끌던 자리·기울기에서 이어서 날아가고(--from-*), 밑 장은
      // 올라온 크기에서 이어서 자리를 잡습니다. 둘 다 CSS 움직임이 받아 갑니다.
      const under = card(toward === 1 ? "next" : "prev");
      if (face) {
        face.style.setProperty("--from-x", `${dx}px`);
        face.style.setProperty("--from-rot", `${(dx / width) * TILT_DEG}deg`);
        face.style.willChange = "";
      }
      if (under) {
        const progress = Math.min(Math.abs(dx) / width, 1);
        under.style.setProperty("--from-scale", String(UNDER_SCALE + (1 - UNDER_SCALE) * progress));
        under.style.transform = "";
        under.style.willChange = "";
      }
      live.current.onGo(toward);
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

  /** 비켜 간 장이 다 날아갔으면 밑으로 내려 앉힙니다. 끌던 흔적도 지웁니다. */
  function finishLeave(event: AnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.animationName !== "stack-leave") return;
    const element = event.currentTarget;
    for (const property of ["--from-x", "--from-rot", "transform", "transition", "will-change"]) element.style.removeProperty(property);
    if (stackRef.current) stackRef.current.dataset.toward = "";
    setSeen((current) => ({ ...current, leaving: null }));
  }
  function finishArrive(event: AnimationEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.animationName !== "stack-arrive") return;
    event.currentTarget.style.removeProperty("--from-scale");
  }

  // 지금 장과 앞뒤 한 장, 그리고 아직 날아가는 중인 장. 늘 차례대로 그립니다.
  const shown = [...new Set([index - 1, index, index + 1, seen.leaving ?? index])]
    .filter((at) => at >= 0 && at < total)
    .sort((a, b) => a - b);
  const behind = sheetsBehind(total);
  return (
    <div ref={stackRef} className="receipt-stack" style={{ "--behind": behind } as CSSProperties}>
      {Array.from({ length: behind }, (_, slot) => behind - slot).map((depth) => (
        <span key={`sheet-${depth}`} className="receipt-stack__sheet" style={{ "--depth": depth } as CSSProperties} aria-hidden="true" />
      ))}
      {shown.map((at) => {
        const slot = at === index ? "face" : at === seen.leaving ? "leaving" : at < index ? "prev" : "next";
        const classes = ["receipt-stack__card"];
        // 넘겨서 올라온 장은 살짝 튕기며 자리를 잡습니다. 처음 펼친 장은 위에서 찍혀
        // 나오는 움직임(print)을 그대로 씁니다.
        if (slot === "face" && seen.dir) classes.push("is-arriving");
        if (slot === "leaving") classes.push(seen.dir > 0 ? "to-left" : "to-right");
        return (
          <div
            key={ids[at]}
            data-slot={slot}
            className={classes.join(" ")}
            // 밑에 깔린 장은 보이기만 할 뿐 만질 수 없습니다. 탭으로도 못 닿습니다.
            inert={slot !== "face"}
            aria-hidden={slot === "face" ? undefined : true}
            onAnimationEnd={slot === "leaving" ? finishLeave : slot === "face" ? finishArrive : undefined}
          >
            {renderAt(ids[at], at)}
          </div>
        );
      })}
    </div>
  );
}
