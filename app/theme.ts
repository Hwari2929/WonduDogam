"use client";

import { useSyncExternalStore } from "react";

/**
 * 테마는 React 상태가 아니라 <html data-theme> 이 원본입니다.
 *
 * app/layout.tsx 의 인라인 스크립트가 첫 페인트 전에 값을 심어 두기 때문에,
 * 다크를 고른 사람이 흰 종이 한 장을 먼저 보는 일이 없습니다. React는
 * useSyncExternalStore 로 그 DOM 값을 구독만 합니다 — 효과 안에서 setState를
 * 하지 않으므로 하이드레이션도 어긋나지 않습니다.
 *
 * 비빈 디자인 시스템 v0.1 §01 은 세 개의 세피아 테마를 정의합니다.
 *   light — 새 감열지 · Light Sepia
 *   warm  — 서랍에서 갈변한 감열지 · Warm Dark
 *   cool  — 형광등 아래 식은 종이 · Cool Dark
 * 다크는 검정이 아니라 어두운 종이입니다.
 */
export type Theme = "light" | "warm" | "cool";

export const THEMES: { id: Theme; label: string; hint: string }[] = [
  { id: "light", label: "밝게", hint: "새 종이" },
  { id: "warm", label: "따뜻하게", hint: "묵은 종이" },
  { id: "cool", label: "차갑게", hint: "식은 종이" },
];

export const THEME_KEY = "wondudogam.theme";
const CHANGE_EVENT = "wondudogam:theme";

/**
 * layout.tsx 의 <script> 와 이 파일이 같은 규칙을 쓰도록 한 곳에 둡니다.
 * v0.1 이전에 저장된 "dark" 는 warm 으로 읽습니다 — 고른 적 있는 어둠을
 * 버전이 올랐다고 빼앗지 않습니다.
 */
export const themeBootScript = `try{var s=localStorage.getItem("${THEME_KEY}");if(s==="dark")s="warm";document.documentElement.dataset.theme=(s==="warm"||s==="cool"||s==="light")?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"warm":"light")}catch(e){document.documentElement.dataset.theme="light"}`;

function readTheme(): Theme {
  const value = document.documentElement.dataset.theme;
  return value === "warm" || value === "cool" ? value : "light";
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // 다른 탭에서 바꿔도 따라옵니다
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => "light");
}

export function applyTheme(next: Theme) {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // 시크릿 모드 등에서 저장이 막혀도 이번 세션 동안은 바뀐 채로 둡니다.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** 상단 바의 한 칸짜리 전환. 밝게 → 따뜻하게 → 차갑게 → 밝게. */
export function nextTheme(current: Theme): Theme {
  const index = THEMES.findIndex((entry) => entry.id === current);
  return THEMES[(index + 1) % THEMES.length].id;
}
