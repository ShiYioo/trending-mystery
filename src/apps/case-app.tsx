"use client";

// 应用 01 · 案卷档案：案卷封皮（简报打字机+音效）、争议点、检索词、换案。
// 由房间一移植：检索词与"开始搜查"改为 OS 内打开档案检索应用。

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Stamp, TypeWriter } from "@/components/game";
import { fetchCase } from "@/lib/game/api";
import { sfx } from "@/lib/game/sfx";
import { useGame } from "@/lib/game/store";
import type { PublicCaseBrief } from "@/lib/types";
import type { AppProps } from "./types";

export default function CaseApp({ open }: AppProps) {
  const { caseBrief, setCase } = useGame();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (rank: number) => {
      setLoading(true);
      setError(null);
      try {
        setCase(await fetchCase(rank));
      } catch (e) {
        setError(e instanceof Error ? e.message : "领取案件失败");
      } finally {
        setLoading(false);
      }
    },
    [setCase],
  );

  useEffect(() => {
    if (!caseBrief) void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!caseBrief) {
    return (
      <div className="p-8 text-center font-[family-name:var(--font-dossier)] text-sm tracking-widest text-paper-400">
        {error ? `领取失败：${error}` : "正在从热榜调取今日卷宗"}
        <span className="tw-cursor" />
        {error && (
          <button className="btn-brass mt-6 px-5 py-2 text-sm" onClick={() => load(1)}>
            重试
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-5 md:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-700/70 pb-4">
        <div>
          <p className="eyebrow"><span className="status-dot" />CASE FILE / DAILY DROP</p>
          <p className="mt-2 text-xs text-paper-600">案件已接入热榜数据流，所有线索均来自真实社区讨论</p>
        </div>
        <div className="flex items-center gap-4 font-[family-name:var(--font-dossier)] text-[10px] tracking-widest text-paper-600">
          <span>热度 <strong className="text-brass-300">{caseBrief.hotRank} / 50</strong></span>
          <span>状态 <strong className="text-signal-300">● OPEN</strong></span>
        </div>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="paper-card scanline relative overflow-hidden p-5 pt-7 md:p-7 md:pt-8"
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

        <p className="eyebrow mt-7">未解事件</p>
        <h1 className="mt-3 text-2xl leading-tight text-paper-100 md:text-3xl">
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

        <div className="mt-6 whitespace-pre-wrap border-l-2 border-signal-400/60 pl-5 leading-loose text-paper-200">
          <TypeWriter text={caseBrief.briefing} speed={22} />
        </div>

        <div className="mt-7 border-t border-ink-700/70 pt-5">
          <h2 className="eyebrow">
            MISSION OBJECTIVES / 本案需查明 {caseBrief.issues.length} 个争议点
          </h2>
          <ol className="mt-4 space-y-3">
            {caseBrief.issues.map((issue, i) => (
              <motion.li
                key={issue.id}
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.15 }}
                className="flex items-start gap-3 border-b border-ink-700/40 pb-3 text-paper-100 last:border-0"
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

        <div className="mt-7 flex flex-wrap items-center gap-2">
          <span className="font-[family-name:var(--font-dossier)] text-xs tracking-widest text-paper-600">
            初始检索词
          </span>
          {caseBrief.suggestedKeywords.slice(0, 8).map((kw, i) => (
            <motion.button
              key={kw}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.55 + i * 0.06 }}
              onClick={() => {
                sfx.play("click");
                open("search", { keyword: kw });
              }}
              className="border border-ink-600 px-2 py-1 font-[family-name:var(--font-dossier)] text-xs text-paper-400 transition-colors hover:border-brass-400 hover:text-brass-300"
            >
              # {kw}
            </motion.button>
          ))}
        </div>
      </motion.section>

      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={() => {
            sfx.play("click");
            open("search");
          }}
          className="btn-brass px-7 py-2.5 font-[family-name:var(--font-dossier)] text-sm tracking-[0.2em]"
        >
          开始搜查 →
        </button>
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
      </div>
    </div>
  );
}
