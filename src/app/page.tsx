"use client";

// 房间一 · 案件面板：标题开场画面 → 案卷封皮（简报打字机+音效）、争议点、检索词、今日神探榜。

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Stamp, Stars, TypeWriter } from "@/components/game";
import { fetchBoard, fetchCase } from "@/lib/game/api";
import { sfx } from "@/lib/game/sfx";
import { useGame } from "@/lib/game/store";
import type { PublicCaseBrief } from "@/lib/types";

const TITLE = "热搜疑云";

export default function CasePanel() {
  const { caseBrief, setCase } = useGame();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [board, setBoard] = useState<Array<{ playerId: string; score: number }>>([]);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("tm_entered")) setEntered(true);
  }, []);

  const load = useCallback(
    async (rank: number) => {
      setLoading(true);
      setError(null);
      try {
        const brief: PublicCaseBrief = await fetchCase(rank);
        setCase(brief);
        fetchBoard(brief.caseId).then(setBoard).catch(() => setBoard([]));
      } catch (e) {
        setError(e instanceof Error ? e.message : "领取案件失败");
      } finally {
        setLoading(false);
      }
    },
    [setCase],
  );

  useEffect(() => {
    if (!caseBrief) void load(1); // 标题画面背后预载，点开即见
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start() {
    sfx.play("drum");
    sessionStorage.setItem("tm_entered", "1");
    setEntered(true);
  }

  return (
    <>
      <AnimatePresence>
        {!entered && <TitleScreen loading={loading} onStart={start} />}
      </AnimatePresence>

      {loading && !caseBrief && (
        <div className="paper-card mt-10 p-10 text-center font-[family-name:var(--font-dossier)] text-sm tracking-widest text-paper-400">
          正在从热榜调取今日卷宗<span className="tw-cursor" />
        </div>
      )}

      {error && (
        <div className="paper-card mt-10 p-8">
          <Stamp tone="blood">领取失败</Stamp>
          <p className="mt-4 text-sm text-paper-200">{error}</p>
          <button className="btn-brass mt-6 px-5 py-2 text-sm" onClick={() => load(1)}>
            重试
          </button>
        </div>
      )}

      {caseBrief && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-700/70 pb-5">
            <div>
              <p className="eyebrow"><span className="status-dot" />调查控制台 / DAILY DROP</p>
              <p className="mt-2 text-xs text-paper-600">案件已接入热榜数据流，所有线索均来自真实社区讨论</p>
            </div>
            <div className="flex items-center gap-5 font-[family-name:var(--font-dossier)] text-[10px] tracking-widest text-paper-600">
              <span>热度 <strong className="text-brass-300">{caseBrief.hotRank} / 50</strong></span>
              <span>状态 <strong className="text-signal-300">● OPEN</strong></span>
            </div>
          </div>
          <motion.section
            initial={{ opacity: 0, y: 34, rotateX: 8 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformPerspective: 1200 }}
            className="paper-card scanline relative overflow-hidden p-6 pt-8 md:p-10 md:pt-9"
          >
            <div className="absolute left-0 top-0 h-1 w-1/3 bg-gradient-to-r from-signal-400 to-transparent" />
            <div className="absolute right-6 top-6 rotate-6">
              <Stamp tone="blood">机密</Stamp>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Stamp>案件编号 {caseBrief.caseId}</Stamp>
              <motion.span
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2.4, repeat: Infinity }}
                className="font-[family-name:var(--font-dossier)] text-xs text-brass-300"
              >
                ▲ 全站热度 第 {caseBrief.hotRank} 位
              </motion.span>
              {caseBrief.degraded && (
                <span className="font-[family-name:var(--font-dossier)] text-xs text-blood-400">
                  ※ 分析引擎离线，本卷为档案科速记版
                </span>
              )}
            </div>

            <p className="eyebrow mt-8">CASE FILE / 未解事件</p>
            <h1 className="mt-3 max-w-4xl text-3xl leading-tight text-paper-100 md:text-5xl">
              {caseBrief.questionTitle}
            </h1>
            <a
              href={caseBrief.questionUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block font-[family-name:var(--font-dossier)] text-xs text-brass-400 underline-offset-4 hover:underline"
            >
              ↗ 原始案发地（知乎问题）
            </a>

            <div className="mt-8 whitespace-pre-wrap border-l-2 border-signal-400/60 pl-5 leading-loose text-paper-200">
              <TypeWriter text={caseBrief.briefing} speed={22} />
            </div>

            <div className="mt-10 border-t border-ink-700/70 pt-6">
              <h2 className="eyebrow">
                MISSION OBJECTIVES / 本案需查明 {caseBrief.issues.length} 个争议点
              </h2>
              <ol className="mt-4 space-y-3">
                {caseBrief.issues.map((issue, i) => (
                  <motion.li
                    key={issue.id}
                    initial={{ opacity: 0, x: -18 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.15 }}
                    className="group flex items-start gap-3 border-b border-ink-700/40 pb-3 text-paper-100 last:border-0"
                  >
                    <span className="font-[family-name:var(--font-dossier)] text-brass-600">
                      {["Ⅰ", "Ⅱ", "Ⅲ"][i] ?? i + 1}
                    </span>
                    <span>{issue.title}</span>
                    <span className="ml-auto shrink-0 font-[family-name:var(--font-dossier)] text-xs text-paper-600">
                      {issue.stances.length} 张立场牌
                    </span>
                  </motion.li>
                ))}
              </ol>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-2">
              <span className="font-[family-name:var(--font-dossier)] text-xs tracking-widest text-paper-600">
                初始检索词
              </span>
              {caseBrief.suggestedKeywords.slice(0, 8).map((kw, i) => (
                <motion.span key={kw} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7 + i * 0.06 }}>
                  <Link
                    href={`/search?q=${encodeURIComponent(kw)}`}
                    onClick={() => sfx.play("click")}
                    className="border border-ink-600 px-2 py-1 font-[family-name:var(--font-dossier)] text-xs text-paper-400 transition-colors hover:border-brass-400 hover:text-brass-300"
                  >
                    # {kw}
                  </Link>
                </motion.span>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="flex flex-wrap items-center gap-4"
          >
            <Link
              href="/search"
              onClick={() => sfx.play("click")}
              className="btn-brass px-8 py-3 font-[family-name:var(--font-dossier)] tracking-[0.2em]"
            >
              开始搜查 →
            </Link>
            <label className="flex items-center gap-2 font-[family-name:var(--font-dossier)] text-xs text-paper-600">
              换一桩
              <select
                className="input-detective px-2 py-1 text-xs"
                onChange={(e) => load(Number(e.target.value))}
                defaultValue="1"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    热榜第 {n} 案
                  </option>
                ))}
              </select>
            </label>
          </motion.section>

          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="paper-card p-6"
          >
            <h2 className="font-[family-name:var(--font-dossier)] text-sm tracking-[0.25em] text-brass-400">
              今日神探榜
            </h2>
            {board.length === 0 ? (
              <p className="mt-3 text-sm text-paper-600">虚位以待——第一个结案的人留名于此。</p>
            ) : (
              <ol className="mt-4 space-y-2">
                {board.map((row, i) => (
                  <li key={row.playerId} className="flex items-center gap-3 font-[family-name:var(--font-dossier)] text-sm">
                    <span className="text-brass-600">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-paper-400">{row.playerId.slice(0, 8)}</span>
                    <span className="ml-auto text-brass-300">{row.score} 分</span>
                  </li>
                ))}
              </ol>
            )}
          </motion.section>
        </div>
      )}
    </>
  );
}

function TitleScreen({ loading, onStart }: { loading: boolean; onStart: () => void }) {
  return (
    <motion.div
      key="title"
      exit={{ opacity: 0, scale: 1.04, filter: "blur(6px)" }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink-950/97"
    >
      {/* 3D 徽章：放大镜与问号 */}
      <motion.div
        initial={{ rotateY: -30, opacity: 0 }}
        animate={{ rotateY: [ -30, 18, -12, 0 ], opacity: 1 }}
        transition={{ duration: 1.6, ease: "easeOut" }}
        style={{ transformPerspective: 800 }}
        className="mb-8"
      >
        <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden>
          <circle cx="52" cy="52" r="30" fill="none" stroke="#d4a24e" strokeWidth="5" />
          <text x="52" y="62" textAnchor="middle" fontSize="30" fill="#d4a24e" fontFamily="Georgia, serif">?</text>
          <line x1="74" y1="74" x2="102" y2="102" stroke="#d4a24e" strokeWidth="7" strokeLinecap="round" />
        </svg>
      </motion.div>

      <h1 className="flex text-5xl tracking-[0.3em] text-paper-100 md:text-7xl" aria-label={TITLE}>
        {TITLE.split("").map((ch, i) => (
          <motion.span
            key={i}
            initial={{ y: 46, opacity: 0, rotateX: 60 }}
            animate={{ y: 0, opacity: 1, rotateX: 0 }}
            transition={{ delay: 0.25 + i * 0.12, type: "spring", stiffness: 180, damping: 16 }}
            className="inline-block"
            style={{ transformPerspective: 600 }}
          >
            {ch}
          </motion.span>
        ))}
      </h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
        className="mt-4 font-[family-name:var(--font-dossier)] text-xs tracking-[0.5em] text-paper-600"
      >
        TRENDING · MYSTERY
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.35 }}
        className="mt-8 max-w-md px-6 text-center text-sm leading-loose text-paper-400"
      >
        每天，知乎热榜生成一个全新案件。
        <br />
        搜真实回答为线索，审问有据可依的当事人，对比社区共识结案。
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        onClick={onStart}
        disabled={loading}
        className="btn-brass mt-12 px-14 py-4 font-[family-name:var(--font-dossier)] text-base tracking-[0.5em]"
      >
        {loading ? "调 取 卷 宗 中…" : "开 始 调 查"}
      </motion.button>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ delay: 2 }}
        className="mt-6 font-[family-name:var(--font-dossier)] text-[10px] tracking-[0.3em] text-paper-600"
      >
        每日一案 · 由知乎热榜驱动 · 离开知乎生态无法成立
      </motion.p>
    </motion.div>
  );
}
