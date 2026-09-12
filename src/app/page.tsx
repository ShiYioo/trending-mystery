"use client";

// 房间一 · 案件面板：开局领案——案情简报（打字机）、争议点列表、初始检索词、今日神探榜。

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Stamp, Stars, TypeWriter } from "@/components/game";
import { fetchBoard, fetchCase } from "@/lib/game/api";
import { useGame } from "@/lib/game/store";
import type { PublicCaseBrief } from "@/lib/types";

export default function CasePanel() {
  const { caseBrief, setCase } = useGame();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [board, setBoard] = useState<Array<{ playerId: string; score: number }>>([]);

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
    if (!caseBrief) void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="paper-card mt-10 p-10 text-center font-[family-name:var(--font-dossier)] text-sm tracking-widest text-paper-400">
        正在从热榜调取今日卷宗<span className="tw-cursor" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="paper-card mt-10 p-8">
        <Stamp tone="blood">领取失败</Stamp>
        <p className="mt-4 text-sm text-paper-200">{error}</p>
        <button className="btn-brass mt-6 px-5 py-2 text-sm" onClick={() => load(1)}>
          重试
        </button>
      </div>
    );
  }

  if (!caseBrief) return null;

  return (
    <div className="space-y-8">
      {/* 案卷封皮 */}
      <section className="paper-card relative p-8 pt-10">
        <div className="absolute right-6 top-6 rotate-6">
          <Stamp tone="blood">机密</Stamp>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Stamp>案件编号 {caseBrief.caseId}</Stamp>
          <span className="font-[family-name:var(--font-dossier)] text-xs text-paper-600">
            全站热度 第 {caseBrief.hotRank} 位
          </span>
          {caseBrief.degraded && (
            <span className="font-[family-name:var(--font-dossier)] text-xs text-blood-400">
              ※ 分析引擎离线，本卷为档案科速记版
            </span>
          )}
        </div>

        <h1 className="mt-6 text-2xl leading-relaxed text-paper-100 md:text-3xl">
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

        <div className="mt-8 whitespace-pre-wrap border-l-2 border-brass-600/50 pl-5 leading-loose text-paper-200">
          <TypeWriter text={caseBrief.briefing} speed={22} />
        </div>

        <div className="mt-10">
          <h2 className="font-[family-name:var(--font-dossier)] text-sm tracking-[0.25em] text-brass-400">
            本案需查明 {caseBrief.issues.length} 个争议点
          </h2>
          <ol className="mt-4 space-y-3">
            {caseBrief.issues.map((issue, i) => (
              <li key={issue.id} className="flex items-start gap-3 text-paper-100">
                <span className="font-[family-name:var(--font-dossier)] text-brass-600">
                  {["Ⅰ", "Ⅱ", "Ⅲ"][i] ?? i + 1}
                </span>
                <span>{issue.title}</span>
                <span className="ml-auto shrink-0 font-[family-name:var(--font-dossier)] text-xs text-paper-600">
                  {issue.stances.length} 张立场牌
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="font-[family-name:var(--font-dossier)] text-xs tracking-widest text-paper-600">
            初始检索词
          </span>
          {caseBrief.suggestedKeywords.slice(0, 8).map((kw) => (
            <Link
              key={kw}
              href={`/search?q=${encodeURIComponent(kw)}`}
              className="border border-ink-600 px-2 py-1 font-[family-name:var(--font-dossier)] text-xs text-paper-400 transition-colors hover:border-brass-400 hover:text-brass-300"
            >
              # {kw}
            </Link>
          ))}
        </div>
      </section>

      {/* 行动条 */}
      <section className="flex flex-wrap items-center gap-4">
        <Link href="/search" className="btn-brass px-8 py-3 font-[family-name:var(--font-dossier)] tracking-[0.2em]">
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
      </section>

      {/* 今日神探榜 */}
      <section className="paper-card p-6">
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
      </section>
    </div>
  );
}
