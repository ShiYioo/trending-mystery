"use client";

// 应用 04 · 结案程序：押立场 + 指认证据 + 陈词 → 共识翻牌、评级印章砸落、结案报告、战报。
// 由房间四移植，出口改为 OS 内开窗。

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Stamp, Stars, TypeWriter } from "@/components/game";
import { fetchBoard, sharePin, submitVerdict } from "@/lib/game/api";
import { sfx } from "@/lib/game/sfx";
import { useGame, type VerdictResponse } from "@/lib/game/store";
import type { VerdictSubmission } from "@/lib/types";
import type { AppProps } from "./types";

const GRADE_TITLE: Record<string, string> = { S: "神探", A: "探长", B: "警员", C: "实习生" };

export default function VerdictApp({ open }: AppProps) {
  const { caseBrief, collected, playerId, profile, result, setResult, resetAll } = useGame();
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [citations, setCitations] = useState<Record<string, string[]>>({});
  const [statement, setStatement] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [board, setBoard] = useState<Array<{ playerId: string; score: number }>>([]);
  const [copied, setCopied] = useState(false);
  const [coreIssue, setCoreIssue] = useState<string | null>(null);
  const [coreOver, setCoreOver] = useState(false);
  const [bareConfirmed, setBareConfirmed] = useState(false);
  const [shareState, setShareState] = useState<{ busy: boolean; token?: string; mock?: boolean; error?: string }>({ busy: false });
  const [draftCopied, setDraftCopied] = useState(false);

  useEffect(() => {
    if (result) fetchBoard(result.caseId).then(setBoard).catch(() => setBoard([]));
  }, [result]);

  /** 书记官金句：报告第一句够长的句子 */
  function reportQuote(): string | undefined {
    if (!result) return undefined;
    const q = result.report
      .replace(/^#+\s*/gm, "")
      .split(/[。\n]/)
      .map((s) => s.trim())
      .find((s) => s.length >= 8);
    return q?.slice(0, 60);
  }

  // 结案 → 发布知乎想法（进黑客松圈子）
  async function handleShare() {
    if (!result || shareState.busy || shareState.token) return;
    setShareState({ busy: true });
    try {
      const data = await sharePin(result.caseId, {
        total: result.score.total,
        grade: result.score.grade,
        quote: reportQuote(),
      });
      sfx.play("stamp");
      setShareState({ busy: false, token: data.contentToken, mock: data.mock });
    } catch (e) {
      setShareState({ busy: false, error: e instanceof Error ? e.message : "发布失败" });
    }
  }

  // 未登录：只取战报文案进剪贴板，玩家可去原题或圈子手动发布
  async function handleCopyDraft() {
    if (!result) return;
    try {
      const data = await sharePin(result.caseId, {
        total: result.score.total,
        grade: result.score.grade,
        quote: reportQuote(),
        dryRun: true,
      });
      await navigator.clipboard?.writeText(data.content);
      sfx.play("click");
      setDraftCopied(true);
      setTimeout(() => setDraftCopied(false), 2000);
    } catch {
      setDraftCopied(false);
    }
  }

  if (!caseBrief) {
    return (
      <div className="p-8">
        <Stamp tone="blood">无从结案</Stamp>
        <p className="mt-4 text-sm text-paper-200">先去领一桩案件。</p>
        <button className="btn-brass mt-6 px-6 py-2 text-sm" onClick={() => open("case")}>
          ← 打开案卷档案
        </button>
      </div>
    );
  }

  if (result) return <ClosingResult result={result} board={board} copied={copied} onCopy={() => {
    const text = `【热搜疑云】${caseBrief.questionTitle}\n我以 ${result.score.total} 分（${result.score.grade} 级 · ${GRADE_TITLE[result.score.grade]}）结案。\n来查今天这一案：${window.location.origin}`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }} share={shareState} loggedIn={!!profile} onShare={() => void handleShare()} draftCopied={draftCopied} onCopyDraft={() => void handleCopyDraft()} onRestart={() => {
    resetAll();
    open("case");
  }} />;

  const pool = collected.filter((c) => c.cardId);
  const allChosen = caseBrief.issues.every((i) => selections[i.id]);
  const totalCited = caseBrief.issues.reduce(
    (n, issue) => n + (citations[issue.id] ?? []).length,
    0,
  );

  async function submit() {
    if (!caseBrief || submitting) return;
    setSubmitting(true);
    setError(null);
    const verdicts: VerdictSubmission[] = caseBrief.issues.map((issue) => ({
      issueId: issue.id,
      stanceId: selections[issue.id],
      citedClueIds: citations[issue.id] ?? [],
    }));
    try {
      const res = await submitVerdict({
        caseId: caseBrief.caseId,
        playerId: playerId || "anonymous",
        verdicts,
        statement: statement.trim() || undefined,
      });
      setResult(res);
      sfx.play("drum");
    } catch (e) {
      setError(e instanceof Error ? e.message : "结案失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 p-5">
      <section className="paper-card scanline p-5">
        <p className="eyebrow"><span className="status-dot" />VERDICT / 结案程序</p>
        <p className="mt-2 text-xs leading-relaxed text-paper-600">
          押注你判断的主流立场；只指认支持它的已归档证物——指认错误会倒扣。立场牌背后的社区权重，结案才翻牌。
        </p>
        <div className="room-stage mt-5 flex items-end justify-center pb-5">
          <span className="room-light" />
          <div
            className={`relative z-10 flex h-20 w-40 cursor-pointer items-center justify-center border bg-ink-950/85 text-center font-[family-name:var(--font-dossier)] text-[10px] tracking-widest shadow-[0_15px_30px_rgba(0,0,0,0.5)] transition-all ${coreOver ? "border-brass-300 shadow-[0_0_30px_rgba(219,169,79,0.35)]" : "border-brass-400/40"}`}
            onDragOver={(event) => { event.preventDefault(); setCoreOver(true); }}
            onDragLeave={() => setCoreOver(false)}
            onDrop={(event) => { event.preventDefault(); setCoreOver(false); setCoreIssue(event.dataTransfer.getData("text/stance-id")); sfx.play("stamp"); }}
          >
            {coreIssue ? <span className="text-brass-300">已插入立场<br /><strong className="mt-2 block text-sm">{coreIssue}</strong></span> : <>CONSENSUS<br />CORE<br /><span className="mt-2 block text-paper-600">拖入立场牌</span></>}
          </div>
        </div>
      </section>

      {caseBrief.issues.map((issue, idx) => (
        <section key={issue.id} className="paper-card p-5">
          <h2 className="flex items-center gap-3 text-lg text-paper-100">
            <span className="font-[family-name:var(--font-dossier)] text-brass-600">
              {["Ⅰ", "Ⅱ", "Ⅲ"][idx] ?? idx + 1}
            </span>
            {issue.title}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {issue.stances.map((stance) => {
              const chosen = selections[issue.id] === stance.id;
              return (
                <motion.button
                  key={stance.id}
                  onClick={() => {
                    sfx.play("flip");
                    setSelections((s) => ({ ...s, [issue.id]: stance.id }));
                  }}
                  draggable
                  onDragStart={(event) => (event as unknown as React.DragEvent<HTMLButtonElement>).dataTransfer.setData("text/stance-id", stance.label)}
                  whileHover={{ y: -5, rotateX: 6 }}
                  whileTap={{ scale: 0.97 }}
                  style={{ transformPerspective: 800 }}
                  className={`paper-card p-4 text-left ${chosen ? "-rotate-1 border-brass-400 shadow-[0_0_18px_rgba(212,162,78,0.25)]" : "opacity-80 hover:opacity-100"}`}
                >
                  <span className="font-[family-name:var(--font-dossier)] text-[10px] tracking-widest text-paper-600">
                    立场牌
                  </span>
                  <p className="mt-1 text-base text-paper-100">{stance.label}</p>
                  {chosen && <span className="mt-2 inline-block font-[family-name:var(--font-dossier)] text-[10px] text-brass-300">✓ 已押注</span>}
                </motion.button>
              );
            })}
          </div>

          <div className="mt-5">
            <p className="font-[family-name:var(--font-dossier)] text-xs tracking-widest text-paper-600">
              指认证据（仅核心证物生效）
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {pool.length === 0 && (
                <button onClick={() => open("search")} className="text-xs text-brass-400 underline-offset-4 hover:underline">
                  档案袋里没有核心证物——去档案检索找"核心证据"标记的卡 →
                </button>
              )}
              {pool.map((c) => {
                const active = (citations[issue.id] ?? []).includes(c.cardId!);
                return (
                  <button
                    key={c.contentId}
                    onClick={() =>
                      setCitations((prev) => {
                        const list = prev[issue.id] ?? [];
                        return {
                          ...prev,
                          [issue.id]: active ? list.filter((x) => x !== c.cardId) : [...list, c.cardId!],
                        };
                      })
                    }
                    className={`flex items-center gap-1.5 border px-2 py-1 text-xs transition-colors ${
                      active ? "border-brass-400 bg-brass-600/20 text-brass-300" : "border-ink-600 text-paper-400 hover:border-paper-400"
                    }`}
                  >
                    <Stars n={c.stars} className="text-[9px]" />
                    <span className="max-w-44 truncate">{c.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      ))}

      <section className="paper-card space-y-3 p-5">
        <p className="font-[family-name:var(--font-dossier)] text-xs tracking-widest text-paper-600">
          结案陈词（可选 · 最多影响 15% 分数）
        </p>
        <textarea
          className="input-detective min-h-[72px] w-full px-4 py-2.5 text-sm"
          placeholder="用一两句话说清你的推理，以及它为什么站得住……"
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
        />
        {error && <p className="text-xs text-blood-400">⚠ {error}</p>}
        {allChosen && totalCited === 0 && !submitting && (
          <p className="alert-pulse border border-blood-600/50 p-2.5 font-[family-name:var(--font-dossier)] text-[11px] leading-relaxed text-blood-400">
            {bareConfirmed
              ? "再点一次「确认裸奔提交」——证据分将为 0，最高只剩 65 分。"
              : "⚠ 尚未指认任何证据（证据指认占 35% 分数）。回到上方选择支持你立场的核心证物，或再点一次提交确认裸奔。"}
          </p>
        )}
        <div className="flex items-center justify-between">
          <button onClick={() => open("interrogation")} className="font-[family-name:var(--font-dossier)] text-xs text-paper-600 hover:text-brass-400">
            ← 再审一轮
          </button>
          <button
            className="btn-brass px-8 py-2.5 font-[family-name:var(--font-dossier)] text-sm tracking-[0.2em]"
            disabled={!allChosen || submitting}
            onClick={() => {
              if (totalCited === 0 && !bareConfirmed) {
                setBareConfirmed(true);
                sfx.play("click");
                return;
              }
              void submit();
            }}
          >
            {submitting ? "合议中…" : bareConfirmed && totalCited === 0 ? "确认裸奔提交" : "⚖ 提交结案"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ClosingResult({
  result,
  board,
  copied,
  onCopy,
  share,
  loggedIn,
  onShare,
  draftCopied,
  onCopyDraft,
  onRestart,
}: {
  result: VerdictResponse;
  board: Array<{ playerId: string; score: number }>;
  copied: boolean;
  onCopy: () => void;
  share: { busy: boolean; token?: string; mock?: boolean; error?: string };
  loggedIn: boolean;
  onShare: () => void;
  draftCopied: boolean;
  onCopyDraft: () => void;
  onRestart: () => void;
}) {
  const [total, setTotal] = useState(0);
  const [impact, setImpact] = useState(false);
  useEffect(() => {
    sfx.play("reveal");
    const target = result.score.total;
    const step = Math.max(target / 40, 0.5);
    const timer = setInterval(() => {
      setTotal((v) => {
        if (v + step >= target) {
          clearInterval(timer);
          return target;
        }
        return v + step;
      });
    }, 30);
    return () => clearInterval(timer);
  }, [result.score.total]);

  const { score, consensus } = result;

  return (
    <div className="space-y-6 p-5">
      <section className="paper-card scanline p-5">
        <p className="eyebrow"><span className="status-dot" />VERDICT / 结案 · 共识翻牌</p>
        <div className="room-stage mt-5 flex items-end justify-center pb-5">
          <span className="room-light" />
          <div className="relative z-10 flex h-16 w-32 items-center justify-center border border-brass-400/40 bg-ink-950/80 font-[family-name:var(--font-dossier)] text-xs tracking-widest text-brass-300 shadow-[0_12px_25px_rgba(0,0,0,0.5)]">CONSENSUS<br />CORE</div>
        </div>
        <div className="mt-5 space-y-6">
          {consensus.map((issue) => (
            <div key={issue.issueId}>
              <h2 className="text-base text-paper-100">{issue.title}</h2>
              <div className="mt-3 space-y-2">
                {issue.stances.map((s, i) => {
                  const chosen = score.issues.find((x) => x.issueId === issue.issueId)?.chosenStanceId === s.id;
                  return (
                    <motion.div
                      key={s.id}
                      initial={{ rotateY: 90, opacity: 0 }}
                      animate={{ rotateY: 0, opacity: 1 }}
                      transition={{ delay: 0.3 + i * 0.25, duration: 0.5 }}
                      className={`flex items-center gap-3 border px-4 py-2 ${
                        chosen ? "border-brass-400/70 bg-brass-600/10" : "border-ink-600"
                      }`}
                    >
                      <span className="text-sm text-paper-100">
                        {s.label}
                        {chosen && <span className="ml-2 font-[family-name:var(--font-dossier)] text-[10px] text-brass-300">你的押注</span>}
                      </span>
                      <div className="ml-auto flex items-center gap-3">
                        <div className="h-1.5 w-24 overflow-hidden bg-ink-700">
                          <motion.div
                            className="h-full bg-gradient-to-r from-brass-600 to-brass-300"
                            initial={{ width: 0 }}
                            animate={{ width: `${s.weight}%` }}
                            transition={{ delay: 0.6 + i * 0.25, duration: 0.7 }}
                          />
                        </div>
                        <span className="w-14 text-right font-[family-name:var(--font-dossier)] text-sm text-brass-300">
                          {s.weight}%
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 证据核查表：逐卡亮出真实归属——玩家可核对系统的判分依据 */}
      {result.evidenceReview?.some((r) => r.cards.length > 0) && (
        <section className="paper-card p-5">
          <p className="eyebrow"><span className="status-dot" />EVIDENCE AUDIT / 证据核查表</p>
          <p className="mt-2 text-xs leading-relaxed text-paper-600">
            逐卡亮出你指认证物的真实立场归属（结案前保密）。命中记分、误指倒扣——若你认为归属判定与原文相悖，这就是申诉的依据。
          </p>
          <div className="mt-4 space-y-5">
            {result.evidenceReview.map((review) =>
              review.cards.length === 0 ? null : (
                <div key={review.issueId}>
                  <h3 className="text-sm text-paper-100">
                    {review.title}
                    <span className="ml-2 font-[family-name:var(--font-dossier)] text-[10px] text-brass-300">
                      押「{review.chosenLabel}」
                    </span>
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {review.cards.map((card) => (
                      <li
                        key={card.id}
                        className={`flex flex-wrap items-center gap-x-3 gap-y-1 border px-3 py-1.5 text-xs ${
                          card.hit ? "border-brass-400/50 bg-brass-600/10" : "border-blood-600/40"
                        }`}
                      >
                        <Stars n={card.stars} className="shrink-0 text-[10px]" />
                        <span className="max-w-md truncate text-paper-300">{card.excerpt}</span>
                        {card.hit ? (
                          <span className="ml-auto shrink-0 font-[family-name:var(--font-dossier)] text-[10px] tracking-widest text-brass-300">
                            ✓ 命中 · 支持你的押注
                          </span>
                        ) : (
                          <span className="ml-auto shrink-0 font-[family-name:var(--font-dossier)] text-[10px] tracking-widest text-blood-400">
                            ✗ 实际支持「{card.actualStanceLabel}」· 倒扣
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </div>
        </section>
      )}

      <motion.section
        animate={impact ? { x: [0, -9, 9, -5, 5, 0] } : { x: 0 }}
        transition={{ duration: 0.45 }}
        className="paper-card relative flex flex-wrap items-center gap-8 overflow-visible p-6"
      >
        <motion.div
          initial={{ scale: 2.4, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: -6 }}
          transition={{ type: "spring", stiffness: 240, damping: 15, delay: 0.9 }}
          onAnimationComplete={() => {
            setImpact(true);
            sfx.play("stamp");
          }}
          className="stamp relative z-10 border-brass-400 px-5 py-3 text-3xl text-brass-300"
        >
          {score.grade} · {GRADE_TITLE[score.grade]}
        </motion.div>
        {impact && <DustBurst />}
        <div className="flex-1 space-y-2">
          <p className="font-[family-name:var(--font-dossier)] text-4xl text-paper-100">
            {Math.round(total)}
            <span className="ml-2 text-sm text-paper-600">/ 100</span>
          </p>
          {(
            [
              ["共识吻合", score.breakdown.consensus, "50%"],
              ["证据指认", score.breakdown.evidence, "35%"],
              ["结案陈词", score.breakdown.statement, "15%"],
            ] as const
          ).map(([label, value, weight]) => (
            <div key={label} className="flex items-center gap-3 text-xs">
              <span className="w-16 text-paper-400">{label}</span>
              <span className="w-8 font-[family-name:var(--font-dossier)] text-paper-600">{weight}</span>
              <div className="h-1 flex-1 overflow-hidden bg-ink-700">
                <motion.div className="h-full bg-brass-400/70" initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ delay: 1.1, duration: 0.8 }} />
              </div>
              <span className="w-10 text-right font-[family-name:var(--font-dossier)] text-brass-300">{value}</span>
            </div>
          ))}
        </div>
      </motion.section>

      <section className="paper-card border-l-4 border-l-brass-600/60 p-5">
        <h2 className="font-[family-name:var(--font-dossier)] text-xs tracking-[0.25em] text-brass-400">
          结案报告
        </h2>
        <p className="mt-4 leading-loose text-paper-200">
          <TypeWriter text={result.report} speed={14} markdown />
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="paper-card flex flex-col items-center gap-4 border-brass-400/40 p-6 text-center">
          <Stamp>热搜疑云 · 战报</Stamp>
          <p className="text-sm leading-relaxed text-paper-200">
            案件 {result.caseId}
            <br />
            评级 <span className="text-brass-300">{score.grade} · {GRADE_TITLE[score.grade]}</span>
            <br />
            总分 <span className="font-[family-name:var(--font-dossier)] text-2xl text-brass-300">{score.total}</span>
          </p>
          <button className="btn-brass px-6 py-2 font-[family-name:var(--font-dossier)] text-xs tracking-widest" onClick={onCopy}>
            {copied ? "✓ 已复制战绩" : "复制战绩分享"}
          </button>
          <div className="w-full border-t border-ink-700 pt-3">
            {loggedIn ? (
              <button
                className="w-full border border-signal-400/50 px-4 py-2 font-[family-name:var(--font-dossier)] text-xs tracking-widest text-signal-300 transition-colors hover:border-signal-300 hover:bg-signal-400/10 disabled:opacity-50"
                disabled={share.busy || !!share.token}
                onClick={onShare}
              >
                {share.token
                  ? `✓ 已发布想法${share.mock ? "（本地模拟）" : ` · ${share.token.slice(0, 10)}…`}`
                  : share.busy
                    ? "发布中……"
                    : "发布想法 → 黑客松脑洞补给站"}
              </button>
            ) : (
              <div className="space-y-1.5">
              <a
                href="/api/oauth/authorize"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => sessionStorage.setItem("tm_oauth_pending", "1")}
                className="block w-full border border-brass-400/50 px-4 py-2 text-center font-[family-name:var(--font-dossier)] text-xs tracking-widest text-brass-300 transition-colors hover:bg-brass-600/15"
              >
                绑定知乎身份，一键发布 →
              </a>
                <button
                  className="w-full border border-ink-600 px-4 py-2 font-[family-name:var(--font-dossier)] text-xs tracking-widest text-paper-400 transition-colors hover:border-paper-400 hover:text-paper-200"
                  onClick={onCopyDraft}
                >
                  {draftCopied ? "✓ 战报文案已复制，去原题粘贴发布" : "不登录，只复制战报文案"}
                </button>
              </div>
            )}
            <p className="mt-1.5 text-[9px] leading-relaxed tracking-wider text-paper-600">
              {loggedIn
                ? "以你的知乎身份把结案战报发进官方圈子（每小时限 5 条）。"
                : "战报文案与登录发布完全一致——复制后可在原题下作答发布。"}
              {share.error && <span className="text-blood-400"> ⚠ {share.error}</span>}
            </p>
          </div>
        </div>
        <div className="paper-card p-5">
          <h2 className="font-[family-name:var(--font-dossier)] text-xs tracking-[0.25em] text-brass-400">
            今日神探榜
          </h2>
          <ol className="mt-3 space-y-1.5">
            {board.length === 0 && <li className="text-xs text-paper-600">尚未有人结案。</li>}
            {board.map((row, i) => (
              <li key={row.playerId} className="flex items-center gap-3 font-[family-name:var(--font-dossier)] text-xs">
                <span className="text-brass-600">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-paper-400">{row.playerId.slice(0, 8)}</span>
                <span className="ml-auto text-brass-300">{row.score}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="flex justify-between">
        <button onClick={onRestart} className="font-[family-name:var(--font-dossier)] text-xs text-paper-600 hover:text-brass-400">
          领新案（清空档案袋）
        </button>
        <span className="font-[family-name:var(--font-dossier)] text-[10px] tracking-widest text-paper-600">
          桌面上的其他软件随时可以再开
        </span>
      </div>
    </div>
  );
}

/** 印章砸落时的尘埃迸发（一次性） */
function DustBurst() {
  const particles = Array.from({ length: 14 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
    const dist = 46 + Math.random() * 52;
    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist * 0.6,
      size: 2 + Math.random() * 3,
      delay: Math.random() * 0.05,
    };
  });
  return (
    <div className="pointer-events-none absolute left-10 top-10 z-0" aria-hidden>
      {particles.map((p, i) => (
        <motion.span
          key={i}
          initial={{ x: 0, y: 0, opacity: 0.9, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.3 }}
          transition={{ duration: 0.7 + p.delay * 4, ease: "easeOut" }}
          className="absolute rounded-full bg-brass-300"
          style={{ width: p.size, height: p.size }}
        />
      ))}
    </div>
  );
}
