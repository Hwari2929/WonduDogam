"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { downloadBlob, decodeMarks, encodeMarks, renderCodexImage } from "../codex-export";
import { cafes } from "../data/cafes";
import {
  CODEX_COLORS,
  CODEX_ICONS,
  colorValue,
  createCollection,
  mergeMarks,
  removeCollection,
  removeMark,
  setNote,
  type CodexColorId,
  type CodexIconId,
  type Collection,
  type Mark,
} from "../marks";
import { Bibin, CodexMark } from "./BeanArt";
import { CodexIcon } from "./CodexIcon";

export function Codex({
  collections,
  marks,
  activeCollectionId,
  dateLabel,
  showMascot,
  activeCafeId,
  onSelectCollection,
  onOpenCafe,
  onNotice,
  onClose,
}: {
  collections: Collection[];
  marks: Mark[];
  activeCollectionId: string;
  dateLabel: string;
  showMascot: boolean;
  activeCafeId: string | null;
  onSelectCollection: (id: string) => void;
  onOpenCafe: (id: string) => void;
  onNotice: (message: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"list" | "create" | "export" | "import">("list");
  const [name, setName] = useState("");
  const [color, setColor] = useState<CodexColorId>("ochre");
  const [icon, setIcon] = useState<CodexIconId>("coffee");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const importRef = useRef<HTMLTextAreaElement>(null);
  const activeCollection = collections.find((entry) => entry.id === activeCollectionId) ?? collections[0];
  const activeMarks = marks.filter((mark) => mark.collectionIds.includes(activeCollection.id));
  const rows = activeMarks.map((mark) => ({ mark, cafe: cafes.find((entry) => entry.id === mark.id) }));

  function onCreate() {
    const id = createCollection(name, color, icon);
    onSelectCollection(id);
    setName("");
    setMode("list");
    onNotice("새 도감을 만들었어.");
  }

  async function onExportCode() {
    setBusy(true);
    try {
      const value = await encodeMarks(activeMarks);
      setCode(value);
      setMode("export");
      await navigator.clipboard.writeText(value);
      onNotice("이 도감 코드를 복사했어.");
    } catch { onNotice("코드를 만들지 못했어."); }
    finally { setBusy(false); }
  }

  async function onExportImage() {
    setBusy(true);
    try {
      const blob = await renderCodexImage(rows.map(({ mark, cafe }) => ({
        name: cafe?.name ?? "알 수 없는 카페",
        area: cafe?.area ?? "-",
        note: mark.note,
        partner: cafe?.partner ?? false,
      })), dateLabel);
      downloadBlob(blob, `${activeCollection.name}_${dateLabel}.png`);
      onNotice("도감을 이미지로 뽑았어.");
    } catch { onNotice("이미지를 만들지 못했어."); }
    finally { setBusy(false); }
  }

  async function onImport() {
    const value = importRef.current?.value ?? "";
    if (!value.trim()) return;
    setBusy(true);
    try {
      const added = mergeMarks(await decodeMarks(value), activeCollection.id);
      onNotice(added ? `${added}곳을 이 도감에 넣었어.` : "이미 가지고 있는 곳들이야.");
      setMode("list");
    } catch (error) { onNotice(error instanceof Error ? error.message : "코드를 읽지 못했어."); }
    finally { setBusy(false); }
  }

  return (
    <article className="codex">
      <header className="receipt__topline">
        <span className="brand-lockup"><CodexMark size={18} /><b>내 도감</b></span>
        <button className="icon-button" type="button" onClick={onClose} aria-label="내 도감 닫기">×</button>
      </header>

      <div className="codex__collections" aria-label="도감 선택">
        {collections.map((collection) => {
          const count = marks.filter((mark) => mark.collectionIds.includes(collection.id)).length;
          return (
            <button
              key={collection.id}
              className={`codex-tab ${collection.id === activeCollection.id ? "is-active" : ""}`}
              type="button"
              style={{ "--codex-color": colorValue(collection.color) } as React.CSSProperties}
              onClick={() => { onSelectCollection(collection.id); setMode("list"); }}
            >
              <CodexIcon name={collection.icon} size={17} />
              <span>{collection.name}</span>
              <i>{count}</i>
            </button>
          );
        })}
        <button className="codex-tab codex-tab--add" type="button" onClick={() => setMode("create")} aria-label="새 도감 만들기">
          <Plus size={17} aria-hidden="true" /><span>새 도감</span>
        </button>
      </div>

      <p className="receipt__issue"><span>{dateLabel}</span><span className="receipt__serial">{activeMarks.length}곳</span></p>

      {mode === "create" ? (
        <section className="codex-maker" aria-label="새 도감 만들기">
          <label>도감 이름<input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} placeholder="예: 주말 산책 카페" autoFocus /></label>
          <fieldset><legend>표지 색</legend><div className="codex-maker__choices">
            {CODEX_COLORS.map((entry) => <button key={entry.id} className={`codex-color ${color === entry.id ? "is-selected" : ""}`} style={{ background: entry.value }} type="button" onClick={() => setColor(entry.id)} aria-label={entry.label} aria-pressed={color === entry.id} />)}
          </div></fieldset>
          <fieldset><legend>도감 아이콘</legend><div className="codex-maker__choices">
            {CODEX_ICONS.map((entry) => <button key={entry.id} className={`codex-icon-choice ${icon === entry.id ? "is-selected" : ""}`} type="button" onClick={() => setIcon(entry.id)} aria-label={entry.label} aria-pressed={icon === entry.id}><CodexIcon name={entry.id} /></button>)}
          </div></fieldset>
          <div className="codex__panel-actions"><button className="pill-button" type="button" onClick={onCreate}>만들기</button><button className="text-link" type="button" onClick={() => setMode("list")}>취소</button></div>
        </section>
      ) : null}

      {mode === "list" ? (
        activeMarks.length === 0 ? (
          <div className="codex__empty">
            {showMascot ? <Bibin variant="diary-writing" size={88} /> : null}
            <p>이 도감은 아직 비어 있어.<br />카페 영수증에서 이 도감을 골라줘.</p>
          </div>
        ) : (
          <ul className="codex__stack">
            {rows.map(({ mark, cafe }) => (
              <li key={mark.id} className={["codex__slip", cafe ? "" : "is-unknown", mark.id === activeCafeId ? "is-active" : ""].filter(Boolean).join(" ")} style={{ "--codex-color": colorValue(activeCollection.color) } as React.CSSProperties}>
                <div className="codex__slip-head">
                  <button className="codex__name" type="button" onClick={() => cafe && onOpenCafe(mark.id)} disabled={!cafe} aria-current={mark.id === activeCafeId ? "true" : undefined}>{cafe?.name ?? "알 수 없는 카페"}</button>
                  <button className="codex__drop" type="button" onClick={() => { removeMark(mark.id, activeCollection.id); onNotice("이 도감에서 꺼냈어."); }} aria-label={`${cafe?.name ?? "카페"} 이 도감에서 빼기`}>×</button>
                </div>
                <p className="codex__meta"><span>{cafe?.area ?? "위치를 알 수 없는 카페"}</span><i className="tabular">{mark.at}</i></p>
                <input className="codex__note" defaultValue={mark.note} placeholder="한 줄 적어두기" maxLength={120} onBlur={(event) => setNote(mark.id, event.target.value)} aria-label={`${cafe?.name ?? "카페"} 메모`} />
              </li>
            ))}
          </ul>
        )
      ) : null}

      {mode === "export" ? <div className="codex__panel"><p className="codex__hint">이 도감의 카페 목록을 다른 기기로 옮길 수 있어.</p><textarea className="codex__code" readOnly value={code} rows={4} aria-label="도감 코드" /><div className="codex__panel-actions"><button className="text-link" type="button" onClick={() => { navigator.clipboard.writeText(code); onNotice("코드를 다시 복사했어."); }}>다시 복사</button><button className="text-link" type="button" onClick={() => setMode("list")}>돌아가기</button></div></div> : null}
      {mode === "import" ? <div className="codex__panel"><p className="codex__hint">받은 코드를 붙여 넣으면 지금 선택한 도감에 합쳐져.</p><textarea ref={importRef} className="codex__code" placeholder="WDG1:…" rows={4} aria-label="불러올 코드" /><div className="codex__panel-actions"><button className="text-link" type="button" onClick={onImport} disabled={busy}>불러오기</button><button className="text-link" type="button" onClick={() => setMode("list")}>돌아가기</button></div></div> : null}

      {mode === "list" ? <div className="codex__actions">
        <button className="pill-button" type="button" onClick={onExportImage} disabled={busy || activeMarks.length === 0}>이미지로 뽑기</button>
        <button className="text-link" type="button" onClick={onExportCode} disabled={busy || activeMarks.length === 0}>코드 복사</button>
        <button className="text-link" type="button" onClick={() => setMode("import")}>불러오기</button>
        {collections.length > 1 ? <button className="codex-delete" type="button" onClick={() => { if (!window.confirm(`“${activeCollection.name}” 도감을 지울까?`)) return; const fallback = collections.find((entry) => entry.id !== activeCollection.id)!; removeCollection(activeCollection.id); onSelectCollection(fallback.id); onNotice("도감을 정리했어."); }}><Trash2 size={14} aria-hidden="true" /> 도감 삭제</button> : null}
      </div> : null}
    </article>
  );
}