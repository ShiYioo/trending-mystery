"use client";

// 房间三 · 审问室：质询 + 出示线索卡（证物随问题编码进历史，摘要全文随请求注入 grounding）。

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Stamp, Stars } from "@/components/game";
import { interrogate } from "@/lib/game/api";
import { useGame } from "@/lib/game/store";
import type { ChatMessage } from "@/lib/types";

const EVIDENCE_TAG = "【出示证物】";

export default function InterrogationPage() {
  const { caseBrief, collected, history, setHistory } = useGame();
  const [input, setInput] = useState("");
  const [pendingEvidence, setPendingEvidence] = useState<string[]>([]); // contentId 集
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [systemNote, setSystemNote] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history.length, streamText, systemNote]);

  if (!caseBrief) {
    return (
      <div className="paper-card mt-10 p-8">
        <Stamp tone="blood">审问室关闭</Stamp>
        <p className="mt-4 text-sm text-paper-200">没有案件就没有当事人。</p>
        <Link href="/" className="btn-brass mt-6 inline-block px-6 py-2 text-sm">
          ← 回案件面板
        </Link>
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
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="paper-card p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-[family-name:var(--font-dossier)] text-sm tracking-[0.3em] text-brass-400">
            Ⅲ 审问室
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
      <section className="paper-card min-h-[320px] space-y-4 p-6">
        {history.length === 0 && !streaming && (
          <p className="pt-16 text-center font-[family-name:var(--font-dossier)] text-sm tracking-widest text-paper-600">
            「那晚的事……你想从哪里问起？」
          </p>
        )}
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
      </section>

      {/* 证物选择 + 输入 */}
      <section className="paper-card space-y-3 p-6">
        <p className="font-[family-name:var(--font-dossier)] text-xs tracking-widest text-paper-600">
          出示证物（随下一句质询一并拍在桌上）
        </p>
        <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
          {collected.length === 0 && (
            <Link href="/search" className="text-xs text-brass-400 underline-offset-4 hover:underline">
              档案袋是空的——先去搜查取证 →
            </Link>
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
            className="input-detective min-h-[64px] flex-1 resize-y px-4 py-3 text-sm"
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
          <button className="btn-brass px-6 py-3 font-[family-name:var(--font-dossier)] text-sm tracking-widest" disabled={streaming || !input.trim()} onClick={() => void send()}>
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
        <Link href="/search" className="font-[family-name:var(--font-dossier)] text-xs text-paper-600 hover:text-brass-400">
          ← 继续搜查
        </Link>
        <Link href="/verdict" className="btn-brass px-6 py-2 font-[family-name:var(--font-dossier)] text-xs tracking-widest">
          证据够了，去结案 →
        </Link>
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
