"use client";

import type { Mark } from "./marks";

/**
 * 내 도감 내보내기 (03_기능_명세 §6.2).
 *
 * localStorage 는 기기를 바꾸면 사라집니다. 그 약점을 기능으로 뒤집는 자리라,
 * 코드는 계정 없는 동기화가 되고 이미지는 사실상 유일한 유기적 유입 경로가 됩니다.
 */

const PREFIX = "WDG1:"; // 형식이 바뀌어도 옛 코드를 읽을 수 있도록 버전을 답니다.

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: ReadableWritablePair<Uint8Array, Uint8Array>) {
  const blob = new Blob([bytes as BlobPart]);
  return new Uint8Array(await new Response(blob.stream().pipeThrough(stream)).arrayBuffer());
}

/** 압축이 없는 브라우저에서도 코드가 나와야 하므로 실패하면 그냥 base64 로 둡니다. */
export async function encodeMarks(marks: Mark[]): Promise<string> {
  const payload = new TextEncoder().encode(JSON.stringify({ v: 1, marks }));
  try {
    return PREFIX + toBase64(await pipe(payload, new CompressionStream("deflate")));
  } catch {
    return PREFIX + toBase64(payload);
  }
}

export async function decodeMarks(code: string): Promise<Mark[]> {
  const trimmed = code.trim();
  if (!trimmed.startsWith(PREFIX)) throw new Error("원두도감 코드가 아니야. WDG1: 로 시작해야 해.");

  const body = trimmed.slice(PREFIX.length).replace(/\s+/g, "");
  let bytes: Uint8Array;
  try {
    bytes = fromBase64(body);
  } catch {
    throw new Error("코드가 깨졌어. 다시 복사해볼까?");
  }

  let text: string;
  try {
    text = new TextDecoder().decode(await pipe(bytes, new DecompressionStream("deflate")));
  } catch {
    text = new TextDecoder().decode(bytes); // 압축 없이 만든 코드
  }

  let parsed: { marks?: unknown };
  try {
    parsed = JSON.parse(text) as { marks?: unknown };
  } catch {
    throw new Error("코드가 깨졌어. 다시 복사해볼까?");
  }

  if (!Array.isArray(parsed.marks)) throw new Error("코드 안에 도감이 없어.");
  return parsed.marks
    .filter((mark): mark is Mark => !!mark && typeof (mark as Mark).id === "string")
    .map((mark) => ({ id: mark.id, at: mark.at ?? "", note: typeof mark.note === "string" ? mark.note : "", collectionIds: Array.isArray(mark.collectionIds) ? mark.collectionIds.filter((id): id is string => typeof id === "string") : [] }));
}

// ── 이미지 ────────────────────────────────────────────────────────────

export type ExportRow = { name: string; area: string; note: string; partner: boolean };

/**
 * 세로로 긴 영수증 한 장.
 *
 * 테마를 따르지 않고 **항상 밝은 감열지**로 굽습니다. 공유된 이미지는 남의
 * 타임라인에서 홀로 놓이는데, 거기서 어두운 판은 종이가 아니라 스크린샷으로
 * 읽힙니다. 이 이미지는 종이여야 합니다.
 */
/* 비빈 디자인 시스템 v0.1 §01 Light Sepia. globals.css 의 :root 와 같은 값이어야
   뽑아 낸 이미지가 화면에서 뜯은 종이와 같은 종이로 보입니다. */
const PAPER = "#F7F1E7";
const INK = "#2C2118";
const INK_SOFT = "#5C554B";
const INK_FAINT = "#74624F";
const RULE = "#CDBBA4";
const STAMP = "#A63A2E";
const BEAN = "#9D4F24";

const WIDTH = 480;
const PAD = 34;
const TEAR = 8;

const DISPLAY_FONT =
  '"Paperlogy", "SUIT Variable", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const BODY_FONT =
  '"SUIT Variable", "SUIT", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const MONO_FONT =
  '"MonoplexKR", "IBM Plex Mono", ui-monospace, Consolas, "Malgun Gothic", monospace';

function dashedRule(ctx: CanvasRenderingContext2D, y: number) {
  ctx.save();
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(PAD, y + 0.5);
  ctx.lineTo(WIDTH - PAD, y + 0.5);
  ctx.stroke();
  ctx.restore();
}

function dottedLeader(ctx: CanvasRenderingContext2D, from: number, to: number, y: number) {
  if (to - from < 8) return;
  ctx.save();
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.setLineDash([1, 3]);
  ctx.beginPath();
  ctx.moveTo(from, y + 0.5);
  ctx.lineTo(to, y + 0.5);
  ctx.stroke();
  ctx.restore();
}

/** 자간을 벌려 그립니다. 캔버스에는 letter-spacing 이 없어서 한 글자씩 놓습니다. */
function trackedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  let cursor = x;
  for (const character of text) {
    ctx.fillText(character, cursor, y);
    cursor += ctx.measureText(character).width + spacing;
  }
  return cursor - spacing - x;
}

function trackedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number) {
  let total = 0;
  for (const character of text) total += ctx.measureText(character).width + spacing;
  return total - spacing;
}

/** 종이를 뜯은 자리. 가장자리에서 반원만 파냅니다 — 띠를 통째로 지우면 그냥 잘린 종이입니다. */
function tearEdge(ctx: CanvasRenderingContext2D, y: number) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#010101";
  for (let x = TEAR; x < WIDTH + TEAR; x += TEAR * 2) {
    ctx.beginPath();
    ctx.arc(x, y, TEAR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * 종이 결. 화면과 같은 128px 타일이라 대개 이미 캐시되어 있습니다.
 *
 * 타일 로딩을 기다리다 멈추지 않게 시한을 둡니다. 배경 탭에서는 브라우저가
 * 디코딩을 미루기도 하는데, 그 때문에 "영수증으로 뽑기"가 영영 안 끝나면
 * 질감 하나 때문에 기능을 잃는 셈입니다.
 */
async function grain(ctx: CanvasRenderingContext2D, height: number) {
  const image = new Image();
  const ready = new Promise<boolean>((resolve) => {
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    setTimeout(() => resolve(false), 700);
  });
  image.src = "/tex/grain-128.png";

  if (!(await ready) || !image.naturalWidth) return;

  const pattern = ctx.createPattern(image, "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.25; // 타일이 198~255 라 실효 감쇠는 5% 남짓입니다.
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.restore();
}

export async function renderCodexImage(rows: ExportRow[], dateLabel: string): Promise<Blob> {
  const rowHeight = 34;
  const noteHeight = 19;
  const noteCount = rows.filter((row) => row.note.trim()).length;
  const height =
    250 + rows.length * rowHeight + noteCount * noteHeight + (rows.length === 0 ? 40 : 0) + 150;

  const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 2));
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지를 만들 수 없어.");
  ctx.scale(scale, scale);

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WIDTH, height);

  let y = 62;

  ctx.fillStyle = INK;
  ctx.font = `800 22px ${DISPLAY_FONT}`;
  ctx.textAlign = "left";
  const brandWidth = trackedWidth(ctx, "원두도감", 8);
  trackedText(ctx, "원두도감", (WIDTH - brandWidth) / 2, y, 8);

  y += 22;
  ctx.fillStyle = INK_FAINT;
  ctx.font = `700 10px ${MONO_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("BEAN CODEX", WIDTH / 2, y);

  y += 30;
  dashedRule(ctx, y);

  y += 30;
  ctx.fillStyle = INK_SOFT;
  ctx.font = `700 12px ${MONO_FONT}`;
  ctx.textAlign = "left";
  trackedText(ctx, "내 도감", PAD, y, 5);
  ctx.textAlign = "right";
  ctx.fillStyle = INK;
  ctx.fillText(`${rows.length}장`, WIDTH - PAD, y);

  y += 20;
  ctx.fillStyle = INK_FAINT;
  ctx.font = `10px ${MONO_FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(`뽑은 날  ${dateLabel}`, PAD, y);

  y += 20;
  dashedRule(ctx, y);
  y += 28;

  if (rows.length === 0) {
    ctx.fillStyle = INK_FAINT;
    ctx.font = `14px ${BODY_FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("아직 뜯어둔 영수증이 없어.", WIDTH / 2, y);
    y += 40;
  }

  rows.forEach((row, index) => {
    ctx.textAlign = "left";
    ctx.fillStyle = INK_FAINT;
    ctx.font = `10px ${MONO_FONT}`;
    const numberText = String(index + 1).padStart(2, "0");
    ctx.fillText(numberText, PAD, y);

    ctx.fillStyle = INK;
    ctx.font = `15px ${BODY_FONT}`;
    const nameX = PAD + 26;
    ctx.fillText(row.name, nameX, y);
    const nameWidth = ctx.measureText(row.name).width;

    let markWidth = 0;
    if (row.partner) {
      ctx.fillStyle = STAMP;
      ctx.font = `700 9px ${MONO_FONT}`;
      ctx.fillText("협력", nameX + nameWidth + 7, y - 1);
      markWidth = ctx.measureText("협력").width + 7;
    }

    ctx.fillStyle = INK_SOFT;
    ctx.font = `12px ${BODY_FONT}`;
    ctx.textAlign = "right";
    const areaWidth = ctx.measureText(row.area).width;
    ctx.fillText(row.area, WIDTH - PAD, y);

    dottedLeader(ctx, nameX + nameWidth + markWidth + 8, WIDTH - PAD - areaWidth - 8, y - 4);
    y += rowHeight;

    if (row.note.trim()) {
      ctx.textAlign = "left";
      ctx.fillStyle = INK_FAINT;
      ctx.font = `12px ${BODY_FONT}`;
      ctx.fillText(`✎ ${row.note.trim()}`, nameX, y - 12);
      y += noteHeight;
    }
  });

  y += 4;
  dashedRule(ctx, y);
  y += 46;

  // 도장. 항상 같은 각도로 기울여야 장난이 아니라 도구로 읽힙니다.
  ctx.save();
  ctx.translate(WIDTH / 2, y + 4);
  ctx.rotate((-7 * Math.PI) / 180);
  ctx.globalAlpha = 0.88;
  ctx.strokeStyle = STAMP;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-34, -22, 68, 44);
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.strokeRect(-30, -18, 60, 36);
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = STAMP;
  ctx.font = `800 13px ${DISPLAY_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("원두도감", 0, 5);
  ctx.restore();

  y += 62;
  ctx.fillStyle = INK_FAINT;
  ctx.textAlign = "center";
  ctx.font = `9px ${MONO_FONT}`;
  ctx.fillText("수도권 개인 카페 지도", WIDTH / 2, y);

  await grain(ctx, height);
  tearEdge(ctx, 0);
  tearEdge(ctx, height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("이미지를 만들 수 없어."))), "image/png");
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // 클릭 직후에 풀면 일부 브라우저가 저장을 놓칩니다.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
