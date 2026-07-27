"use client";

import { useSyncExternalStore } from "react";

/**
 * 내 도감 (03_기능_명세 §6).
 *
 * 원본은 localStorage 이고 React는 구독만 합니다. 테마와 같은 구조라
 * 다른 탭에서 뜯은 영수증도 이 탭에 바로 나타납니다.
 *
 * 카페 정보 전체가 아니라 id와 최소 정보만 담습니다 — 전부 넣으면 데이터가 낡습니다.
 */
export type Mark = {
  id: string;
  /** 뜯은 날짜 (KST). */
  at: string;
  /** 영수증 여백에 손으로 적는 한 줄. 아직 입력 UI는 없지만 형식은 지킵니다. */
  note: string;
};

export const MARKS_KEY = "wondudogam.marks";
const CHANGE_EVENT = "wondudogam:marks";
const EMPTY: Mark[] = [];

/** useSyncExternalStore 는 같은 값이면 같은 참조를 돌려받아야 하므로 원문으로 캐시합니다. */
let cachedRaw: string | null = null;
let cachedMarks: Mark[] = EMPTY;

function parse(raw: string | null): Mark[] {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as { marks?: Mark[] };
    if (!Array.isArray(parsed.marks)) return EMPTY;
    return parsed.marks.filter((mark) => typeof mark?.id === "string");
  } catch {
    localStorage.removeItem(MARKS_KEY);
    return EMPTY;
  }
}

function readMarks(): Mark[] {
  const raw = localStorage.getItem(MARKS_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedMarks = parse(raw);
  }
  return cachedMarks;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useMarks(): Mark[] {
  return useSyncExternalStore(subscribe, readMarks, () => EMPTY);
}

function write(next: Mark[]) {
  try {
    localStorage.setItem(MARKS_KEY, JSON.stringify({ v: 1, marks: next }));
  } catch {
    // 저장이 막혀도 화면은 계속 동작해야 합니다.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** 뜯으면 true, 도로 넣으면 false 를 돌려줍니다. */
export function toggleMark(id: string, at: string): boolean {
  const current = readMarks();
  const existing = current.some((mark) => mark.id === id);
  write(existing ? current.filter((mark) => mark.id !== id) : [...current, { id, at, note: "" }]);
  return !existing;
}

export function removeMark(id: string) {
  write(readMarks().filter((mark) => mark.id !== id));
}

/** 영수증 여백에 적는 한 줄. 120자를 넘기면 목록이 아니라 일기가 됩니다. */
export function setNote(id: string, note: string) {
  write(readMarks().map((mark) => (mark.id === id ? { ...mark, note: note.slice(0, 120) } : mark)));
}

/**
 * 코드로 받은 도감을 합칩니다. 덮어쓰지 않는 건 기기를 옮길 때 이쪽에서 뜯어둔
 * 영수증이 사라지면 안 되기 때문입니다. 같은 id 는 기존 메모를 지킵니다.
 * 새로 들어온 개수를 돌려줍니다.
 */
export function mergeMarks(incoming: Mark[]): number {
  const current = readMarks();
  const known = new Set(current.map((mark) => mark.id));
  const added = incoming.filter((mark) => !known.has(mark.id));
  if (added.length) write([...current, ...added]);
  return added.length;
}
