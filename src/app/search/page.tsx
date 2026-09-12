"use client";

// 房间二 · 搜查取证：档案检索（真实搜索）→ 线索卡（星级/赞数/认证/线人低语/归档标记）→ 档案袋。

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Stamp, Stars } from "@/components/game";
import { searchClue } from "@/lib/game/api";
import { useGame, type CollectedCard } from "@/lib/game/store";

export default function SearchPage() {
  return (
    <Suspense>
      <SearchRoom />
    </Suspense>
  );
}

function SearchRoom() {
  const { caseBrief, collected, toggleCollect, isCollected } = useGame();
  const params = useSearchParams();
  const [keyword, setKeyword] = useState(params.get("q") ?? "");
  const [results, setResults] = useState<CollectedCard[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (q: string) => {
      if (!q.trim() || !caseBrief) return;
      setLoading(true);
      setError(null);
      try {
        setResults(await searchClue(caseBrief.caseId, q));
      } catch (e) {
        setError(e instanceof Error ? e.message : "检索失败");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [caseBrief],
  );

  useEffect(() => {
    const q = params.get("q");
    if (q && caseBrief) void run(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, caseBrief?.caseId]);

  if (!caseBrief) {
    return (
      <div className="paper-card mt-10 p-8">
        <Stamp tone="blood">无案可查</Stamp>
        <p className="mt-4 text-sm text-paper-200">还没有领取今日案件。</p>
        <Link href="/" className="btn-brass mt-6 inline-block px-6 py-2 text-sm">
          ← 回案件面板
        </Link>
      </div>
    );
  }

  const archivedCount = collected.filter((c) => c.cardId).length;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {/* 档案检索 */}
        <section className="paper-card p-6">
          <h1 className="font-[family-name:var(--font-dossier)] text-sm tracking-[0.3em] text-brass-400">
            Ⅱ 档案检索系统
          </h1>
          <form
            className="mt-4 flex gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run(keyword);
            }}
          >
            <input
              className="input-detective flex-1 px-4 py-3 font-[family-name:var(--font-dossier)] text-sm"
              placeholder="输入关键词，调取知乎站内真实回答……"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <button type="submit" disabled={loading || !keyword.trim()} className="btn-brass px-6 py-3 font-[family-name:var(--font-dossier)] text-sm tracking-widest">
              {loading ? "检索中…" : "检 索"}
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {caseBrief.suggestedKeywords.slice(0, 8).map((kw) => (
              <button
                key={kw}
                onClick={() => {
                  setKeyword(kw);
                  void run(kw);
                }}
                className="border border-ink-600 px-2 py-1 font-[family-name:var(--font-dossier)] text-xs text-paper-400 transition-colors hover:border-brass-400 hover:text-brass-300"
              >
                # {kw}
              </button>
            ))}
          </div>
          {error && (
            <p className="alert-pulse mt-4 border border-blood-600/50 p-3 font-[family-name:var(--font-dossier)] text-xs text-blood-400">
              ⚠ {error}
            </p>
          )}
        </section>

        {/* 检索结果 → 线索卡 */}
        {results && results.length === 0 && !loading && (
          <p className="paper-card p-6 text-center text-sm text-paper-600">
            档案库中没有匹配的记录。换个说法试试——"辟谣"、"内幕"、当事人名。
          </p>
        )}
        <div className="space-y-4">
          {results?.map((card, i) => (
            <motion.article
              key={card.contentId}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.06, 0.5) }}
              className={`paper-card p-5 ${isCollected(card.contentId) ? "border-brass-400/50" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars n={card.stars} />
                <span className="font-[family-name:var(--font-dossier)] text-xs text-paper-400">
                  👍 {card.votes.toLocaleString()}
                </span>
                <span className="text-xs text-paper-400">
                  {card.author}
                  {card.authorBadge ? ` · ${card.authorBadge}` : ""}
                </span>
                <span className="font-[family-name:var(--font-dossier)] text-[10px] uppercase tracking-widest text-paper-600">
                  {card.contentType === "Article" ? "剪报" : "证词"}
                </span>
                {card.cardId ? (
                  <span className="ml-auto border border-brass-400/60 px-1.5 py-0.5 font-[family-name:var(--font-dossier)] text-[10px] tracking-widest text-brass-300">
                    已归档 · 结案可指认
                  </span>
                ) : (
                  <span className="ml-auto font-[family-name:var(--font-dossier)] text-[10px] tracking-widest text-paper-600">
                    外围情报
                  </span>
                )}
              </div>
              <h3 className="mt-2 text-base leading-snug text-paper-100">{card.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-paper-400">{card.excerpt}</p>
              {card.whispers.length > 0 && (
                <div className="mt-3 border-l border-blood-600/40 pl-3">
                  <p className="font-[family-name:var(--font-dossier)] text-[10px] tracking-widest text-blood-400">
                    线人低语
                  </p>
                  {card.whispers.map((w, j) => (
                    <p key={j} className="mt-1 text-xs italic leading-relaxed text-paper-600">
                      「{w.slice(0, 80)}」
                    </p>
                  ))}
                </div>
              )}
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => toggleCollect(card)}
                  className={`px-4 py-1.5 font-[family-name:var(--font-dossier)] text-xs tracking-widest transition-colors ${
                    isCollected(card.contentId)
                      ? "border border-brass-400 text-brass-300"
                      : "btn-brass"
                  }`}
                >
                  {isCollected(card.contentId) ? "✓ 已收入档案袋" : "收入档案袋"}
                </button>
                <a
                  href={card.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-[family-name:var(--font-dossier)] text-xs text-paper-600 underline-offset-4 hover:text-brass-400 hover:underline"
                >
                  查看原文 ↗
                  </a>
              </div>
            </motion.article>
          ))}
        </div>
      </div>

      {/* 侧栏：疑点清单 + 档案袋 */}
      <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
        <section className="paper-card p-5">
          <h2 className="font-[family-name:var(--font-dossier)] text-xs tracking-[0.25em] text-brass-400">
            疑点清单
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-paper-200">
            {caseBrief.issues.map((issue, i) => (
              <li key={issue.id}>
                <span className="mr-2 font-[family-name:var(--font-dossier)] text-brass-600">
                  {["Ⅰ", "Ⅱ", "Ⅲ"][i] ?? i + 1}
                </span>
                {issue.title}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-paper-600">
            提示：高赞 × 高星 = 主流立场的指纹。每个立场都值得留一张牌。
          </p>
        </section>

        <section className="paper-card p-5">
          <h2 className="font-[family-name:var(--font-dossier)] text-xs tracking-[0.25em] text-brass-400">
            档案袋（{collected.length}）
          </h2>
          <p className="mt-1 font-[family-name:var(--font-dossier)] text-[10px] tracking-widest text-paper-600">
            已归档 {archivedCount} 张 · 外围 {collected.length - archivedCount} 张
          </p>
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {collected.map((c) => (
              <li key={c.contentId} className="flex items-start gap-2 text-xs text-paper-400">
                <Stars n={c.stars} className="shrink-0 text-[10px]" />
                <span className="line-clamp-2">{c.title}</span>
              </li>
            ))}
            {collected.length === 0 && (
              <li className="text-xs text-paper-600">空空如也。去检索几份证词吧。</li>
            )}
          </ul>
          <Link
            href="/interrogation"
            className="btn-brass mt-4 block px-4 py-2 text-center font-[family-name:var(--font-dossier)] text-xs tracking-widest"
          >
            带证物进审问室 →
          </Link>
        </section>
      </aside>
    </div>
  );
}
