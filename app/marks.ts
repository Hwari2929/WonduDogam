"use client";

import { useSyncExternalStore } from "react";

export const CODEX_COLORS = [
  { id: "clay", label: "벽돌", value: "#A63A2E" },
  { id: "ochre", label: "황토", value: "#B66A2C" },
  { id: "olive", label: "올리브", value: "#6D7339" },
  { id: "forest", label: "숲", value: "#37715B" },
  { id: "teal", label: "청록", value: "#2D7080" },
  { id: "indigo", label: "남빛", value: "#536390" },
  { id: "plum", label: "자두", value: "#79506F" },
  { id: "cocoa", label: "코코아", value: "#76513E" },
] as const;

export const CODEX_ICONS = [
  { id: "bean", label: "원두" },
  { id: "coffee", label: "커피" },
  { id: "book-open", label: "책" },
  { id: "map-pin", label: "장소" },
  { id: "star", label: "별" },
  { id: "heart", label: "마음" },
  { id: "bookmark", label: "갈피" },
  { id: "compass", label: "나침반" },
] as const;

export type CodexColorId = (typeof CODEX_COLORS)[number]["id"];
export type CodexIconId = (typeof CODEX_ICONS)[number]["id"];
export type Collection = { id: string; name: string; color: CodexColorId; icon: CodexIconId; createdAt: string };
export type Mark = { id: string; at: string; note: string; collectionIds: string[] };
export type CodexState = { collections: Collection[]; marks: Mark[] };

export const MARKS_KEY = "wondudogam.marks";
export const DEFAULT_COLLECTION_ID = "default";
const CHANGE_EVENT = "wondudogam:marks";
const DEFAULT_COLLECTION: Collection = { id: DEFAULT_COLLECTION_ID, name: "나의 원두 도감", color: "clay", icon: "bean", createdAt: "" };
const EMPTY_STATE: CodexState = { collections: [DEFAULT_COLLECTION], marks: [] };
let cachedRaw: string | null = null;
let cachedState: CodexState = EMPTY_STATE;

function isColor(value: unknown): value is CodexColorId { return CODEX_COLORS.some((entry) => entry.id === value); }
function isIcon(value: unknown): value is CodexIconId { return CODEX_ICONS.some((entry) => entry.id === value); }

function normalize(raw: string | null): CodexState {
  if (!raw) return EMPTY_STATE;
  try {
    const parsed = JSON.parse(raw) as { collections?: unknown; marks?: unknown };
    const collections: Collection[] = Array.isArray(parsed.collections)
      ? parsed.collections.filter((entry): entry is Partial<Collection> & { id: string } => !!entry && typeof entry.id === "string").map((entry, index) => ({
          id: entry.id,
          name: typeof entry.name === "string" && entry.name.trim() ? entry.name.trim().slice(0, 24) : `도감 ${index + 1}`,
          color: isColor(entry.color) ? entry.color : CODEX_COLORS[index % CODEX_COLORS.length].id,
          icon: isIcon(entry.icon) ? entry.icon : CODEX_ICONS[index % CODEX_ICONS.length].id,
          createdAt: typeof entry.createdAt === "string" ? entry.createdAt : "",
        }))
      : [];
    const safeCollections = collections.length ? collections : [DEFAULT_COLLECTION];
    const known = new Set(safeCollections.map((collection) => collection.id));
    const marks: Mark[] = Array.isArray(parsed.marks)
      ? parsed.marks.filter((entry): entry is Partial<Mark> & { id: string } => !!entry && typeof entry.id === "string").map((entry) => {
          const requested = Array.isArray(entry.collectionIds) ? entry.collectionIds.filter((id): id is string => typeof id === "string" && known.has(id)) : [];
          return { id: entry.id, at: typeof entry.at === "string" ? entry.at : "", note: typeof entry.note === "string" ? entry.note.slice(0, 120) : "", collectionIds: requested.length ? [...new Set(requested)] : [safeCollections[0].id] };
        })
      : [];
    return { collections: safeCollections, marks };
  } catch {
    localStorage.removeItem(MARKS_KEY);
    return EMPTY_STATE;
  }
}

function readState(): CodexState {
  const raw = localStorage.getItem(MARKS_KEY);
  if (raw !== cachedRaw) { cachedRaw = raw; cachedState = normalize(raw); }
  return cachedState;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(CHANGE_EVENT, onChange); window.removeEventListener("storage", onChange); };
}

export function useCodex(): CodexState { return useSyncExternalStore(subscribe, readState, () => EMPTY_STATE); }
export function useMarks(): Mark[] { return useCodex().marks; }

function write(next: CodexState) {
  try { localStorage.setItem(MARKS_KEY, JSON.stringify({ v: 2, ...next })); } catch { /* 지도 탐색은 계속 동작합니다. */ }
  cachedRaw = null;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function colorValue(id: CodexColorId): string { return CODEX_COLORS.find((entry) => entry.id === id)?.value ?? CODEX_COLORS[0].value; }

export function createCollection(name: string, color: CodexColorId, icon: CodexIconId): string {
  const current = readState();
  const id = `codex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  write({ ...current, collections: [...current.collections, { id, name: name.trim().slice(0, 24) || "새 도감", color, icon, createdAt: new Date().toISOString() }] });
  return id;
}

export function removeCollection(id: string): boolean {
  const current = readState();
  if (current.collections.length <= 1 || !current.collections.some((entry) => entry.id === id)) return false;
  const collections = current.collections.filter((entry) => entry.id !== id);
  const marks = current.marks.map((mark) => ({ ...mark, collectionIds: mark.collectionIds.filter((collectionId) => collectionId !== id) })).filter((mark) => mark.collectionIds.length > 0);
  write({ collections, marks });
  return true;
}

export function setCafeInCollection(id: string, collectionId: string, at: string, included: boolean): boolean {
  const current = readState();
  if (!current.collections.some((entry) => entry.id === collectionId)) return false;
  const existing = current.marks.find((mark) => mark.id === id);
  if (included) {
    if (existing) {
      if (existing.collectionIds.includes(collectionId)) return true;
      write({ ...current, marks: current.marks.map((mark) => mark.id === id ? { ...mark, collectionIds: [...mark.collectionIds, collectionId] } : mark) });
    } else {
      write({ ...current, marks: [...current.marks, { id, at, note: "", collectionIds: [collectionId] }] });
    }
    return true;
  }
  if (!existing) return false;
  const nextIds = existing.collectionIds.filter((value) => value !== collectionId);
  write({ ...current, marks: nextIds.length ? current.marks.map((mark) => mark.id === id ? { ...mark, collectionIds: nextIds } : mark) : current.marks.filter((mark) => mark.id !== id) });
  return false;
}

export function removeMark(id: string, collectionId?: string) {
  const current = readState();
  if (!collectionId) { write({ ...current, marks: current.marks.filter((mark) => mark.id !== id) }); return; }
  setCafeInCollection(id, collectionId, "", false);
}

export function setNote(id: string, note: string) {
  const current = readState();
  write({ ...current, marks: current.marks.map((mark) => mark.id === id ? { ...mark, note: note.slice(0, 120) } : mark) });
}

export function mergeMarks(incoming: Mark[], collectionId = readState().collections[0].id): number {
  const current = readState();
  const knownCollections = new Set(current.collections.map((entry) => entry.id));
  let added = 0;
  let marks = [...current.marks];
  for (const item of incoming) {
    const targetIds = (item.collectionIds ?? []).filter((id) => knownCollections.has(id));
    const ids = targetIds.length ? targetIds : [collectionId];
    const existing = marks.find((mark) => mark.id === item.id);
    if (!existing) { marks.push({ id: item.id, at: item.at ?? "", note: item.note ?? "", collectionIds: ids }); added += 1; }
    else { const merged = [...new Set([...existing.collectionIds, ...ids])]; marks = marks.map((mark) => mark.id === item.id ? { ...mark, collectionIds: merged } : mark); }
  }
  if (incoming.length) write({ ...current, marks });
  return added;
}