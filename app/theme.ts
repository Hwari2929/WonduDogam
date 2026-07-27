"use client";

import { useSyncExternalStore } from "react";

/**
 * 테마는 React 상태가 아니라 <html data-theme> 이 원본입니다.
 *
 * app/layout.tsx 의 인라인 스크립트가 첫 페인트 전에 값을 심어 두기 때문에,
 * 다크를 고른 사람이 흰 종이 한 장을 먼저 보는 일이 없습니다. React는
 * useSyncExternalStore 로 그 DOM 값을 구독만 합니다 — 효과 안에서 setState를
 * 하지 않으므로 하이드레이션도 어긋나지 않습니다.
 */
export type Theme = "light" | "dark";

export const THEME_KEY = "wondudogam.theme";
const CHANGE_EVENT = "wondudogam:theme";

/** layout.tsx 의 <script> 와 이 파일이 같은 규칙을 쓰도록 한 곳에 둡니다. */
export const themeBootScript = `try{var s=localStorage.getItem("${THEME_KEY}");document.documentElement.dataset.theme=s==="dark"||s==="light"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch(e){document.documentElement.dataset.theme="light"}`;

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
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
