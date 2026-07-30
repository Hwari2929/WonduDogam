"use client";

import { useSyncExternalStore } from "react";
import { cafes } from "./data/cafes";

/**
 * 도감 색.
 *
 * 인주(--stamp #A63A2E)와 같은 값은 쓰지 않습니다. 02_디자인_시스템 §2.2 —
 * "붉은색이 여기저기 나오면 도장이 특별해지지 않습니다." 벽돌색은 인주에서
 * 한 칸 비켜 두어, 나란히 놓여도 협력업체 도장과 구분됩니다.
 */
export const CODEX_COLORS = [
  { id: "clay", label: "벽돌", value: "#B3543F" },
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

/**
 * 도감 한 권은 열 곳까지입니다.
 *
 * 무한히 담기는 목록은 도감이 아니라 즐겨찾기입니다. 열 칸으로 끊어 두면
 * 한 칸을 채울 때마다 무게가 생기고, 다 차면 새 도감을 여는 쪽이 자연스러워집니다.
 * 관리판의 5×2 격자가 곧 이 열 칸입니다.
 */
export const COLLECTION_LIMIT = 10;

/** 이 도감이 지금 몇 칸을 쓰고 있는지. 목록에 없는 카페도 칸은 차지합니다. */
export function countInCollection(marks: Mark[], collectionId: string): number {
  return marks.filter((mark) => mark.collectionIds.includes(collectionId)).length;
}
export const DEFAULT_COLLECTION_ID = "default";

/* ── 큐레이터 픽 ────────────────────────────────────────────────────
 * 매일 열 곳을 대신 골라 주는 도감입니다.
 *
 * 저장소에 쓰지 않고 날짜에서 계산해 냅니다. 그래야 "매일 바뀌고 지울 수 없다"가
 * 규칙이 아니라 성질이 됩니다 — 지울 대상이 아예 없고, 날이 바뀌면 저절로 새 열
 * 곳이 됩니다. 저장했다면 날마다 죽은 기록이 쌓이고 사용자 메모와 뒤엉킵니다.
 */
export const CURATOR_COLLECTION_ID = "curator";
export const CURATOR_PARTNER_PICKS = 4;

export const CURATOR_COLLECTION: Collection = {
  id: CURATOR_COLLECTION_ID,
  name: "큐레이터 픽",
  color: "clay",
  icon: "star",
  createdAt: "",
};

/** 날짜만 있으면 누가 보든 같은 열 곳이 나오는 난수. */
function seededRandom(seed: string) {
  let state = [...seed].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 7) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * 협력업체에서 넷, 나머지는 아직 뽑히지 않은 곳에서 여섯.
 * 사용자가 무엇을 담아 두었는지는 보지 않습니다 — 오늘의 픽은 누구에게나 같습니다.
 */
export function curatorPicks(dateLabel: string): string[] {
  const random = seededRandom(dateLabel);
  const partners = shuffled(cafes.filter((cafe) => cafe.partner), random).slice(0, CURATOR_PARTNER_PICKS);
  const taken = new Set(partners.map((cafe) => cafe.id));
  const rest = shuffled(cafes.filter((cafe) => !taken.has(cafe.id)), random)
    .slice(0, COLLECTION_LIMIT - partners.length);
  return [...partners, ...rest].map((cafe) => cafe.id);
}

/** 오늘의 픽을 저장된 기록에 겹쳐 놓습니다. 같은 카페는 한 장으로 합칩니다. */
export function withCuratorPicks(marks: Mark[], dateLabel: string): Mark[] {
  const merged = marks.map((mark) => ({ ...mark }));
  for (const id of curatorPicks(dateLabel)) {
    const existing = merged.find((mark) => mark.id === id);
    if (existing) existing.collectionIds = [...existing.collectionIds, CURATOR_COLLECTION_ID];
    else merged.push({ id, at: dateLabel, note: "", collectionIds: [CURATOR_COLLECTION_ID] });
  }
  return merged;
}
const CHANGE_EVENT = "wondudogam:marks";
// 기본 도감은 브랜드 갈색으로. 모두의 첫 도감이 붉은색이면 화면에서 인주가
// 가장 흔한 색이 되어 도장이 특별해지지 않습니다.
const DEFAULT_COLLECTION: Collection = { id: DEFAULT_COLLECTION_ID, name: "나의 원두 도감", color: "cocoa", icon: "bean", createdAt: "" };
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

/** 넣었는지, 뺐는지, 자리가 없어 못 넣었는지 — 부르는 쪽은 이 셋을 구분해야 합니다. */
export type SaveResult = "added" | "removed" | "full" | "unknown-codex";

export function setCafeInCollection(id: string, collectionId: string, at: string, included: boolean): SaveResult {
  const current = readState();
  if (!current.collections.some((entry) => entry.id === collectionId)) return "unknown-codex";
  const existing = current.marks.find((mark) => mark.id === id);
  if (included) {
    if (existing?.collectionIds.includes(collectionId)) return "added";
    // 열한 번째는 들어가지 않습니다. 조용히 실패하면 저장한 줄 알고 떠납니다.
    if (countInCollection(current.marks, collectionId) >= COLLECTION_LIMIT) return "full";
    if (existing) {
      write({ ...current, marks: current.marks.map((mark) => mark.id === id ? { ...mark, collectionIds: [...mark.collectionIds, collectionId] } : mark) });
    } else {
      write({ ...current, marks: [...current.marks, { id, at, note: "", collectionIds: [collectionId] }] });
    }
    return "added";
  }
  if (!existing) return "removed";
  const nextIds = existing.collectionIds.filter((value) => value !== collectionId);
  write({ ...current, marks: nextIds.length ? current.marks.map((mark) => mark.id === id ? { ...mark, collectionIds: nextIds } : mark) : current.marks.filter((mark) => mark.id !== id) });
  return "removed";
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

/**
 * 받은 코드를 지금 도감에 합칩니다. 남은 칸만큼만 들어가고, 넘친 수는 돌려줍니다 —
 * 열 곳 한도를 여기서만 비켜 가면 관리판의 칸 수가 거짓말을 하게 됩니다.
 */
export function mergeMarks(incoming: Mark[], collectionId = readState().collections[0].id): { added: number; skipped: number } {
  const current = readState();
  const knownCollections = new Set(current.collections.map((entry) => entry.id));
  let added = 0;
  let skipped = 0;
  let marks = [...current.marks];
  for (const item of incoming) {
    const targetIds = (item.collectionIds ?? []).filter((id) => knownCollections.has(id));
    // 저장되지 않는 도감(큐레이터 픽)으로는 아무것도 들어갈 수 없습니다.
    const target = knownCollections.has(collectionId) ? collectionId : current.collections[0].id;
    const ids = targetIds.length ? targetIds : [target];
    const existing = marks.find((mark) => mark.id === item.id);
    // 이미 가진 곳은 칸을 새로 쓰지 않으므로 한도와 무관합니다.
    const wanted = ids.filter((id) => !existing?.collectionIds.includes(id));
    const room = wanted.filter((id) => countInCollection(marks, id) < COLLECTION_LIMIT);
    if (room.length < wanted.length) skipped += 1;
    if (!room.length) continue;
    if (!existing) { marks.push({ id: item.id, at: item.at ?? "", note: item.note ?? "", collectionIds: room }); added += 1; }
    else { marks = marks.map((mark) => mark.id === item.id ? { ...mark, collectionIds: [...new Set([...mark.collectionIds, ...room])] } : mark); }
  }
  if (incoming.length) write({ ...current, marks });
  return { added, skipped };
}