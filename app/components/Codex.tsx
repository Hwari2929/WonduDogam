"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, ClipboardPaste, Copy, ImageDown, MapPin, Plus, Trash2, X } from "lucide-react";
import { downloadBlob, decodeMarks, encodeMarks, renderCodexImage } from "../codex-export";
import { cafes } from "../data/cafes";
import {
  CODEX_COLORS,
  COLLECTION_LIMIT,
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

/** "2026-07-29" 를 "07.29" 로. 형식이 다르면 손대지 않고 그대로 둡니다. */
function shortDate(at: string) {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(at);
  return match ? `${match[1]}.${match[2]}` : at;
}

/** 날짜 하나로는 "요즘 안 갔네"가 읽히지 않습니다. 셀 수 있을 때만 며칠 전인지 덧붙입니다. */
function sinceLabel(at: string, today: string) {
  const shown = shortDate(at);
  const from = Date.parse(`${at}T00:00:00Z`);
  const to = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return shown;
  const days = Math.round((to - from) / 86400000);
  if (days <= 0) return `${shown} · 오늘`;
  if (days === 1) return `${shown} · 어제`;
  return `${shown} · ${days}일 전`;
}

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
  /** 펼쳐 둔 카페들. 한 줄만 보이는 게 기본이고, 필요한 것만 폅니다. */
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());

  function toggleSlip(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const importRef = useRef<HTMLTextAreaElement>(null);
  const activeCollection = collections.find((entry) => entry.id === activeCollectionId) ?? collections[0];
  const activeMarks = marks.filter((mark) => mark.collectionIds.includes(activeCollection.id));
  const rows = activeMarks.map((mark) => ({ mark, cafe: cafes.find((entry) => entry.id === mark.id) }));

  /**
   * 도감 완성도는 **지금 목록에 있는 카페**만 셉니다.
   *
   * 남이 준 코드를 불러오면 이 판에 없는 id 도 그대로 들어옵니다 (decodeMarks 는
   * 일부러 걸러내지 않습니다 — 목록이 늘면 되살아나야 하니까요). 그걸 같이 세면
   * 25 / 18 같은 숫자가 나오고, 막대는 100%를 넘어 상자 밖으로 자라며, 남은 곳이
   * 음수가 됩니다. 목록 밖의 것은 따로 적어 둡니다.
   */
  const collected = rows.filter((row) => row.cafe).length;
  const strays = activeMarks.length - collected;
  /** 쓴 칸 수. 한도를 넘겨 저장해 둔 옛 데이터가 있어도 격자 밖으로 넘치지 않습니다. */
  const used = Math.min(activeMarks.length, COLLECTION_LIMIT);

  /**
   * "6 / 10" 만으로는 무엇을 센 숫자인지 알 수 없습니다. 두 줄이 그걸 답합니다 —
   * 어디를 모았나(지역), 마지막으로 언제 움직였나. §04 의 "아프리카 14 · 중남미 16"
   * 과 같은 조형이라, 도감이 채워질수록 두 줄 다 내용이 붙습니다.
   */
  const tally = (() => {
    // 목록 밖 카페는 등급도 동네도 모릅니다. 여기서 세면 뒤의 "목록 밖 n" 과
    // 같은 것을 두 번 세게 됩니다.
    const known = rows.map((row) => row.cafe).filter((cafe) => !!cafe);
    if (!known.length) return "";
    const partners = known.filter((cafe) => cafe.partner).length;
    const parts = [`비빈 파트너 ${partners}`, `그 밖 ${known.length - partners}`];
    // 동네 수는 겹치는 게 있을 때만 말이 됩니다. 전부 다른 동네면 "모은 곳"과
    // 같은 숫자라, 한 줄을 써서 같은 말을 두 번 하는 셈입니다.
    const areas = new Set(known.map((cafe) => cafe.area)).size;
    if (areas < known.length) parts.push(`동네 ${areas}곳`);
    return parts.join(" · ");
  })();

  const lastMark = activeMarks.reduce((latest, mark) => (mark.at > latest ? mark.at : latest), "");

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
      const { added, skipped } = mergeMarks(await decodeMarks(value), activeCollection.id);
      onNotice(
        skipped ? `${added}곳을 넣었어. ${skipped}곳은 자리가 없어 못 넣었어.`
          : added ? `${added}곳을 이 도감에 넣었어.`
            : "이미 가지고 있는 곳들이야.",
      );
      setMode("list");
    } catch (error) { onNotice(error instanceof Error ? error.message : "코드를 읽지 못했어."); }
    finally { setBusy(false); }
  }

  return (
    <article className="codex">
      {/* 목록만 흐르고 머리는 제자리에 남습니다 — 스크롤을 내린 채로도 어느 도감을
          보고 있는지, 무엇을 누를 수 있는지가 계속 보여야 합니다. */}
      <div className="codex__top">
        {/* 영수증과 같은 자리를 나눠 쓰는 종이라, 닫는 연장도 같은 칸을 씁니다. */}
        <div className="receipt__tools">
          <button className="tool-button has-tip" type="button" onClick={onClose} aria-label="내 도감 닫기">
            <X size={17} aria-hidden="true" />
            <span className="tip" aria-hidden="true">닫기</span>
          </button>
        </div>

        <header className="codex__head">
          <CodexMark size={26} />
          <h1 className="codex__title">내 도감</h1>
        </header>

        <div className="codex__collection-row">
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
        </div>

        {/* §04 COLLECTION — 몇 곳인지와 이 도감으로 할 수 있는 일. 목록을 내리지
            않고도 손이 닿는 자리입니다. */}
        {mode === "list" ? (
          <section className="codex__board" id="codex-board" aria-label={`${activeCollection.name} 수집 상태`}>
            <div className="codex__board-top">
              <p className="codex__progress-count">
                <span className="meta">모은 곳</span>
                <b>{used}</b>
                <span>/ {COLLECTION_LIMIT}</span>
              </p>
              {/* 칸 하나가 자리 하나. 열 칸이 이 도감의 전부입니다. */}
              <div className="codex__progress-dots" aria-hidden="true">
                {Array.from({ length: COLLECTION_LIMIT }, (unused, index) => (
                  <i key={index} className={index < used ? "is-on" : ""} />
                ))}
              </div>
            </div>

            {activeMarks.length ? (
              <p className="meta codex__board-lines">
                {tally}
                {strays > 0 ? `${tally ? " · " : ""}목록 밖 ${strays}` : ""}
                <br />
                마지막 기록 {sinceLabel(lastMark, dateLabel)}
              </p>
            ) : null}

            <div className="codex__board-actions">
              <button className="tool-button tool-button--sm has-tip" type="button" onClick={onExportImage} disabled={busy || activeMarks.length === 0} aria-label="이미지로 뽑기">
                <ImageDown size={15} aria-hidden="true" /><span className="tip" aria-hidden="true">이미지로 뽑기</span>
              </button>
              <button className="tool-button tool-button--sm has-tip" type="button" onClick={onExportCode} disabled={busy || activeMarks.length === 0} aria-label="도감 코드 복사">
                <Copy size={15} aria-hidden="true" /><span className="tip" aria-hidden="true">코드 복사</span>
              </button>
              <button className="tool-button tool-button--sm has-tip" type="button" onClick={() => setMode("import")} aria-label="받은 코드 붙여 넣기">
                <ClipboardPaste size={15} aria-hidden="true" /><span className="tip" aria-hidden="true">코드 붙여넣기</span>
              </button>
              <button
                className="tool-button tool-button--sm tool-button--danger has-tip"
                type="button"
                disabled={collections.length < 2}
                onClick={() => {
                  if (!window.confirm(`“${activeCollection.name}” 도감을 지울까?`)) return;
                  const fallback = collections.find((entry) => entry.id !== activeCollection.id)!;
                  removeCollection(activeCollection.id);
                  onSelectCollection(fallback.id);
                  onNotice("도감을 정리했어.");
                }}
                aria-label="이 도감 지우기"
              >
                <Trash2 size={15} aria-hidden="true" />
                <span className="tip" aria-hidden="true">{collections.length < 2 ? "마지막 도감은 지울 수 없어" : "이 도감 지우기"}</span>
              </button>
            </div>
          </section>
        ) : null}
      </div>

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
            {rows.map(({ mark, cafe }) => {
              const open = openIds.has(mark.id);
              const label = cafe?.name ?? "알 수 없는 카페";
              return (
                <li key={mark.id} className={["codex__slip", cafe ? "" : "is-unknown", mark.id === activeCafeId ? "is-active" : ""].filter(Boolean).join(" ")} style={{ "--codex-color": colorValue(activeCollection.color) } as React.CSSProperties}>
                  {/* 접혀 있을 땐 이름 한 줄. 긴 이름은 자르고, 연장은 오른쪽 끝에 섭니다. */}
                  <div className="codex__slip-row">
                    <span className="codex__name" title={label}>{label}</span>
                    <button
                      className="codex__slip-tool has-tip"
                      type="button"
                      onClick={() => cafe && onOpenCafe(mark.id)}
                      disabled={!cafe}
                      aria-current={mark.id === activeCafeId ? "true" : undefined}
                      aria-label={`${label} 지도에서 보기`}
                    >
                      <MapPin size={15} aria-hidden="true" />
                      <span className="tip" aria-hidden="true">지도에서 보기</span>
                    </button>
                    <button
                      className="codex__slip-tool has-tip"
                      type="button"
                      onClick={() => toggleSlip(mark.id)}
                      aria-expanded={open}
                      aria-label={`${label} ${open ? "접기" : "펼치기"}`}
                    >
                      {open ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
                      <span className="tip" aria-hidden="true">{open ? "접기" : "펼치기"}</span>
                    </button>
                  </div>

                  {open ? (
                    <div className="codex__slip-body">
                      <input className="codex__note" defaultValue={mark.note} placeholder="한 줄 적어두기" maxLength={120} onBlur={(event) => setNote(mark.id, event.target.value)} aria-label={`${label} 메모`} />
                      <p className="codex__slip-foot">
                        <span className="meta">뜯은 날 {mark.at}</span>
                        <button
                          className="codex__slip-tool codex__slip-tool--danger has-tip"
                          type="button"
                          onClick={() => { removeMark(mark.id, activeCollection.id); onNotice("이 도감에서 꺼냈어."); }}
                          aria-label={`${label} 이 도감에서 빼기`}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                          <span className="tip" aria-hidden="true">목록에서 빼기</span>
                        </button>
                      </p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )
      ) : null}

      {mode === "export" ? <div className="codex__panel"><p className="codex__hint">이 도감의 카페 목록을 다른 기기로 옮길 수 있어.</p><textarea className="codex__code" readOnly value={code} rows={4} aria-label="도감 코드" /><div className="codex__panel-actions"><button className="text-link" type="button" onClick={() => { navigator.clipboard.writeText(code); onNotice("코드를 다시 복사했어."); }}>다시 복사</button><button className="text-link" type="button" onClick={() => setMode("list")}>돌아가기</button></div></div> : null}
      {mode === "import" ? <div className="codex__panel"><p className="codex__hint">받은 코드를 붙여 넣으면 지금 선택한 도감에 합쳐져.</p><textarea ref={importRef} className="codex__code" placeholder="WDG1:…" rows={4} aria-label="불러올 코드" /><div className="codex__panel-actions"><button className="text-link" type="button" onClick={onImport} disabled={busy}>불러오기</button><button className="text-link" type="button" onClick={() => setMode("list")}>돌아가기</button></div></div> : null}


    </article>
  );
}