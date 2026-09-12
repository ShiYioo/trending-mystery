"use client";

// 应用 03 · 审问终端：质询 + 出示证物（拖上审讯桌）→ SSE 流式供述。
// 由房间三移植，出口改为 OS 内开窗。

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Stamp, Stars } from "@/components/game";
import { interrogate } from "@/lib/game/api";
import { useGame } from "@/lib/game/store";
import type { ChatMessage } from "@/lib/types";
import type { AppProps } from "./types";

const EVIDENCE_TAG = "【出示证物】";

export default function InterrogationApp({ open }: AppProps) {
  const { caseBrief, collected, history, setHistory } = useGame();
  const [input, setInput] = useState("");
  const [pendingEvidence, setPendingEvidence] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [systemNote, setSystemNote] = useState<string | null>(null);
  const [deskOver, setDeskOver] = useState(false);
  const [lastDropped, setLastDropped] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [history.length, streamText, systemNote]);

  if (!caseBrief) {
    return (
      <div className="p-8">
        <Stamp tone="blood">审问终端关闭</Stamp>
        <p className="mt-4 text-sm text-paper-200">没有案件就没有当事人。</p>
        <button className="btn-brass mt-6 px-6 py-2 text-sm" onClick={() => open("case")}>
          ← 打开案卷档案
        </button>
      </div>
    );
  }

  const shownCards = collected.filter((c) => pendingEvidence.includes(c.contentId));

  async function send() {
    const question = input.trim();
    if (!question || streaming) return;
    setInput("");
    setSystemNote(null);

    const evidenceTitles = shownCards.map((c) => `《${c.title.slice(0, 24)}》`).join("");
    const userContent = (evidenceTitles ? `${EVIDENCE_TAG}${evidenceTitles}\n` : "") + question;

    const nextHistory: ChatMessage[] = [...history, { role: "user", content: userContent }];
    setHistory(nextHistory);
    setPendingEvidence([]);

    setStreaming(true);
    setStreamText("");
    let answer = "";
    const shownExcerpts = collected
      .filter((c) => nextHistory.some((m) => m.role === "user" && m.content.includes(c.title.slice(0, 24))))
      .map((c) => c.excerpt.slice(0, 160));

    try {
      for await (const part of interrogate(caseBrief!.caseId, nextHistory.slice(-12), shownExcerpts)) {
        if (part.error) {
          setSystemNote(part.error);
          break;
        }
        if (part.delta) {
          answer += part.delta;
          setStreamText(answer);
        }
      }
    } catch (e) {
      setSystemNote(e instanceof Error ? e.message : "审问中断");
    } finally {
      setStreaming(false);
      if (answer) setHistory([...nextHistory, { role: "assistant", content: answer }]);
      else setStreamText("");
    }
  }

  return (
    <div className="space-y-5 p-5">
      <section className="paper-card scanline p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="eyebrow">
            <span className="status-dot" />INTERROGATION / 审问终端
          </h1>
          <span className="font-[family-name:var(--font-dossier)] text-xs text-paper-600">
            当事人 · 本案知情者
          </span>
          <Stamp tone="dim" className="ml-auto text-[10px]">
            全程记录在案
          </Stamp>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-paper-600">
          问得笼统，他会打太极；出示与说法矛盾的证物，他才会露出破绽。出示哪些卡，决定能撬开哪一面。
        </p>
      </section>

      {/* 对话区 */}
      <section className="paper-card relative space-y-4 overflow-hidden p-4 md:p-6">
        <div className="room-stage -mx-4 -mt-4 mb-3 md:-mx-6 md:-mt-6">
          <span className="room-light" />
          <div className="absolute left-5 top-5 z-10 font-[family-name:var(--font-dossier)] text-[10px] tracking-widest text-signal-300"><span className="status-dot" />ROOM 03 · SUBJECT ONLINE</div>
          <div className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 text-center font-[family-name:var(--font-dossier)] text-[10px] tracking-widest text-paper-600">DROP EVIDENCE TO CHALLENGE</div>
        </div>
        <div
          className={`interrogation-desk ${deskOver ? "evidence-drop is-over" : ""} p-4 pt-8`}
          onDragOver={(event) => { event.preventDefault(); setDeskOver(true); }}
          onDragLeave={() => setDeskOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDeskOver(false);
            const id = event.dataTransfer.getData("text/evidence-id");
            if (id && collected.some((card) => card.contentId === id)) {
              setPendingEvidence((items) => items.includes(id) ? items : [...items, id]);
              setLastDropped(id);
              setSystemNote("证物已锁定在审问桌。现在问他一个无法回避的问题。");
              window.setTimeout(() => setLastDropped(null), 900);
            }
          }}
        >
          {shownCards.length === 0 ? <p className="flex min-h-12 items-center justify-center font-[family-name:var(--font-dossier)] text-xs tracking-widest text-paper-600">把线索卡拖到这里，逼他正面回应</p> : <div className="flex flex-wrap gap-2">{shownCards.map((card) => <div key={card.contentId} className={`evidence-lock border border-brass-400/70 bg-ink-950/70 px-3 py-2 text-xs text-brass-300 ${lastDropped === card.contentId ? "ring-2 ring-signal-300" : ""}`}>⌁ 证物 · {card.title.slice(0, 22)}</div>)}</div>}
        </div>
        <div className="flex items-center gap-4 border-b border-ink-700/60 pb-4">
          <div className={`relative shrink-0 ${streaming ? "portrait-speaking" : ""}`}>
            <svg width="56" height="66" viewBox="0 0 120 140" aria-hidden className="portrait-breath">
              <ellipse cx="60" cy="72" rx="46" ry="62" fill="#120e09" stroke="#d4a24e" strokeOpacity="0.35" strokeWidth="2" />
              <g fill="#080604">
                <path d="M22 52 Q60 34 98 52 L103 59 Q60 50 17 59 Z" />
                <path d="M42 51 Q44 30 60 28 Q76 30 78 51 Z" />
                <circle cx="60" cy="60" r="13" />
                <path d="M24 134 Q34 96 60 93 Q86 96 96 134 Z" />
              </g>
              <g fill="none" stroke="#d4a24e" strokeOpacity="0.5" strokeWidth="1.2">
                <path d="M44 49 Q46 31 60 29" />
                <path d="M26 132 Q36 98 60 95" />
              </g>
            </svg>
            {streaming && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 font-[family-name:var(--font-dossier)] text-[9px] tracking-widest text-brass-300">
                供述中
              </span>
            )}
          </div>
          <div>
            <p className="font-[family-name:var(--font-dossier)] text-xs tracking-[0.25em] text-brass-400">
              当事人 · 本案知情者
            </p>
            <p className="mt-1 text-xs leading-relaxed text-paper-600">
              {streaming ? "他正在斟酌措辞……" : "「那晚的事……你想从哪里问起？」"}
            </p>
          </div>
        </div>
        {history.length === 0 && !streaming && (
          <p className="pt-8 text-center font-[family-name:var(--font-dossier)] text-sm tracking-widest text-paper-600">
            质询将从下一行开始。带上你的证物。
          </p>
        )}
        <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
          {history.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex flex-col items-end gap-1">
                {m.content.startsWith(EVIDENCE_TAG) && (
                  <div className="flex max-w-[85%] flex-wrap justify-end gap-1">
                    {extractEvidenceTitles(m.content).map((t, j) => (
                      <span
                        key={j}
                        className="border border-brass-400/50 bg-brass-600/10 px-2 py-0.5 font-[family-name:var(--font-dossier)] text-[10px] text-brass-300"
                      >
                        证物 {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="max-w-[85%] whitespace-pre-wrap rounded-sm border border-brass-600/30 bg-ink-800/80 px-4 py-2 text-sm leading-relaxed text-paper-100">
                  {stripEvidenceTag(m.content)}
                </div>
              </div>
            ) : (
              <div key={i} className="max-w-[92%] whitespace-pre-wrap border-l-2 border-paper-600/40 px-4 py-2 text-sm leading-loose text-paper-200">
                {m.content}
              </div>
            ),
          )}
          {streaming && (
            <div className="max-w-[92%] border-l-2 border-brass-400/60 px-4 py-2 text-sm leading-loose text-paper-200">
              {streamText}
              <span className="tw-cursor" />
            </div>
          )}
          {systemNote && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="alert-pulse border border-blood-600/50 p-3 text-center font-[family-name:var(--font-dossier)] text-xs text-blood-400"
            >
              ⚠ {systemNote}
            </motion.p>
          )}
          <div ref={bottomRef} />
        </div>
      </section>

      {/* 证物选择 + 输入 */}
      <section className="paper-card space-y-3 p-5">
        <p className="font-[family-name:var(--font-dossier)] text-xs tracking-widest text-paper-600">
          出示证物（随下一句质询一并拍在桌上）
        </p>
        <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
          {collected.length === 0 && (
            <button onClick={() => open("search")} className="text-xs text-brass-400 underline-offset-4 hover:underline">
              档案袋是空的——先去档案检索 →
            </button>
          )}
          {collected.map((c) => {
            const active = pendingEvidence.includes(c.contentId);
            return (
              <button
                key={c.contentId}
                onClick={() =>
                  setPendingEvidence((p) =>
                    p.includes(c.contentId) ? p.filter((x) => x !== c.contentId) : [...p, c.contentId],
                  )
                }
                draggable
                onDragStart={(event) => (event as unknown as React.DragEvent<HTMLButtonElement>).dataTransfer.setData("text/evidence-id", c.contentId)}
                className={`flex items-center gap-1.5 border px-2 py-1 text-xs transition-colors ${
                  active ? "border-brass-400 bg-brass-600/20 text-brass-300" : "border-ink-600 text-paper-400 hover:border-paper-400"
                }`}
              >
                <Stars n={c.stars} className="text-[9px]" />
                <span className="max-w-40 truncate">{c.title}</span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-3">
          <textarea
            className="input-detective min-h-[60px] flex-1 resize-y px-4 py-2.5 text-sm"
            placeholder="问点具体的：时间、记录、证人——泛泛而谈只会得到打太极。"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={streaming}
          />
          <button className="btn-brass px-5 py-2.5 font-[family-name:var(--font-dossier)] text-sm tracking-widest" disabled={streaming || !input.trim()} onClick={() => void send()}>
            {streaming ? "供述中…" : "质 询"}
          </button>
        </div>
        {shownCards.length > 0 && (
          <p className="font-[family-name:var(--font-dossier)] text-[10px] tracking-widest text-blood-400">
            ⚠ 已亮出 {shownCards.length} 件证物——他必须正面回应这些内容
          </p>
        )}
      </section>

      <div className="flex justify-between">
        <button onClick={() => open("search")} className="font-[family-name:var(--font-dossier)] text-xs text-paper-600 hover:text-brass-400">
          ← 继续搜查
        </button>
        <button onClick={() => open("verdict")} className="btn-brass px-6 py-2 font-[family-name:var(--font-dossier)] text-xs tracking-widest">
          证据够了，去结案 →
        </button>
      </div>
    </div>
  );
}

function extractEvidenceTitles(content: string): string[] {
  if (!content.startsWith(EVIDENCE_TAG)) return [];
  const line = content.split("\n")[0].slice(EVIDENCE_TAG.length);
  return line.match(/《[^》]+》/g) ?? [];
}

function stripEvidenceTag(content: string): string {
  return content.startsWith(EVIDENCE_TAG) ? content.split("\n").slice(1).join("\n") : content;
}
