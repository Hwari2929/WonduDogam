"use client";

import { useRef, useState } from "react";
import { downloadBlob, decodeMarks, encodeMarks, renderCodexImage } from "../codex-export";
import { cafes } from "../data/cafes";
import { mergeMarks, removeMark, setNote, type Mark } from "../marks";
import { Bibin, CodexMark } from "./BeanArt";

/**
 * 내 도감 (03_기능_명세 §6).
 *
 * 영수증 도크 자리를 그대로 씁니다. 지도 위에 종이가 오가는 세계라 목록도
 * 별도 페이지가 아니라 **뜯어둔 영수증이 겹쳐 쌓인 묶음**이어야 합니다 (02 §5).
 */
export function Codex({
  marks,
  dateLabel,
  showMascot,
  onOpenCafe,
  onNotice,
  onClose,
}: {
  marks: Mark[];
  dateLabel: string;
  showMascot: boolean;
  onOpenCafe: (id: string) => void;
  onNotice: (message: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"list" | "export" | "import">("list");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const importRef = useRef<HTMLTextAreaElement>(null);

  const rows = marks.map((mark) => {
    const cafe = cafes.find((entry) => entry.id === mark.id);
    return { mark, cafe };
  });

  async function onExportCode() {
    setBusy(true);
    try {
      const value = await encodeMarks(marks);
      setCode(value);
      setMode("export");
      await navigator.clipboard.writeText(value);
      onNotice("코드를 복사했어.");
    } catch {
      onNotice("코드를 만들지 못했어.");
    } finally {
      setBusy(false);
    }
  }

  async function onExportImage() {
    setBusy(true);
    try {
      const blob = await renderCodexImage(
        rows.map(({ mark, cafe }) => ({
          name: cafe?.name ?? "알 수 없는 항목",
          area: cafe?.area ?? "—",
          note: mark.note,
          partner: cafe?.partner ?? false,
        })),
        dateLabel,
      );
      downloadBlob(blob, `원두도감_내도감_${dateLabel}.png`);
      onNotice("영수증을 뽑았어.");
    } catch {
      onNotice("이미지를 만들지 못했어.");
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    const value = importRef.current?.value ?? "";
    if (!value.trim()) return;
    setBusy(true);
    try {
      const added = mergeMarks(await decodeMarks(value));
      onNotice(added ? `${added}장을 도감에 넣었어.` : "이미 다 가지고 있는 것들이야.");
      setMode("list");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "코드를 읽지 못했어.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="codex">
      <header className="receipt__topline">
        <span className="brand-lockup">
          <CodexMark size={18} />
          <b>내 도감</b>
        </span>
        <button className="icon-button" type="button" onClick={onClose} aria-label="내 도감 닫기">
          ×
        </button>
      </header>

      <p className="receipt__issue">
        <span>{dateLabel}</span>
        <span className="receipt__serial">{marks.length}장</span>
      </p>

      <div className="dashed-rule" />

      {mode === "list" ? (
        marks.length === 0 ? (
          <div className="codex__empty">
            {showMascot ? <Bibin mood="sheepish" size={40} /> : null}
            <p>마음에 드는 곳을 뜯어서 여기 모아둬.</p>
            <button className="text-link" type="button" onClick={() => setMode("import")}>
              코드가 있다면 불러오기
            </button>
          </div>
        ) : (
          <ul className="codex__stack">
            {rows.map(({ mark, cafe }) => (
              <li key={mark.id} className={`codex__slip ${cafe ? "" : "is-unknown"}`}>
                <div className="codex__slip-head">
                  <button
                    className="codex__name"
                    type="button"
                    onClick={() => cafe && onOpenCafe(mark.id)}
                    disabled={!cafe}
                  >
                    {cafe?.name ?? "알 수 없는 항목"}
                    {cafe?.partner ? <b className="partner-badge">협력</b> : null}
                  </button>
                  <button
                    className="codex__drop"
                    type="button"
                    onClick={() => {
                      removeMark(mark.id);
                      onNotice("서랍에서 꺼냈어.");
                    }}
                    aria-label={`${cafe?.name ?? "이 항목"} 도감에서 빼기`}
                  >
                    ×
                  </button>
                </div>
                <p className="codex__meta">
                  <span>{cafe?.area ?? "이 기기에 없는 카페"}</span>
                  <i className="tabular">{mark.at}</i>
                </p>
                <input
                  className="codex__note"
                  defaultValue={mark.note}
                  placeholder="한 줄 적어두기"
                  maxLength={120}
                  onBlur={(event) => setNote(mark.id, event.target.value)}
                  aria-label={`${cafe?.name ?? "항목"} 메모`}
                />
              </li>
            ))}
          </ul>
        )
      ) : null}

      {mode === "export" ? (
        <div className="codex__panel">
          <p className="codex__hint">
            다른 기기의 원두도감에서 이 코드를 붙여넣으면 도감이 그대로 옮겨갑니다. 계정은 필요
            없습니다.
          </p>
          <textarea className="codex__code" readOnly value={code} rows={4} aria-label="내 도감 코드" />
          <div className="codex__panel-actions">
            <button
              className="text-link"
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(code);
                onNotice("코드를 복사했어.");
              }}
            >
              다시 복사
            </button>
            <button className="text-link" type="button" onClick={() => setMode("list")}>
              돌아가기
            </button>
          </div>
        </div>
      ) : null}

      {mode === "import" ? (
        <div className="codex__panel">
          <p className="codex__hint">
            받은 코드를 붙여넣으세요. 지금 도감을 덮어쓰지 않고 없는 것만 더합니다.
          </p>
          <textarea
            ref={importRef}
            className="codex__code"
            placeholder="WDG1:…"
            rows={4}
            aria-label="불러올 코드"
          />
          <div className="codex__panel-actions">
            <button className="text-link" type="button" onClick={onImport} disabled={busy}>
              불러오기
            </button>
            <button className="text-link" type="button" onClick={() => setMode("list")}>
              돌아가기
            </button>
          </div>
        </div>
      ) : null}

      <div className="dashed-rule" />

      <div className="codex__actions">
        <button
          className="pill-button"
          type="button"
          onClick={onExportImage}
          disabled={busy || marks.length === 0}
        >
          <span aria-hidden="true">▤</span> 영수증으로 뽑기
        </button>
        <button
          className="text-link"
          type="button"
          onClick={onExportCode}
          disabled={busy || marks.length === 0}
        >
          코드 복사
        </button>
        {/* 도감이 비어 있을 때야말로 불러오기가 필요한 순간입니다 — 기기를 막 바꾼 참이니까요. */}
        {mode === "list" ? (
          <button className="text-link" type="button" onClick={() => setMode("import")}>
            불러오기
          </button>
        ) : null}
      </div>
    </article>
  );
}
