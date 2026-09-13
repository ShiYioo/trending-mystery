"use client";

// 应用 05 · 今日神探榜：当前案件的结案排行，可手动刷新。

import { useCallback, useEffect, useState } from "react";
import { fetchBoard } from "@/lib/game/api";
import { sfx } from "@/lib/game/sfx";
import { useGame } from "@/lib/game/store";

export default function BoardApp() {
  const { caseBrief, playerId } = useGame();
  const [board, setBoard] = useState<Array<{ playerId: string; score: number }> | null>(null);

  const refresh = useCallback(async () => {
    if (!caseBrief) return;
    try {
      setBoard(await fetchBoard(caseBrief.caseId));
    } catch {
      setBoard([]);
    }
  }, [caseBrief]);

  useEffect(() => {
    queueMicrotask(() => void refresh());
    const timer = setInterval(refresh, 30000); // 30 秒自动刷新
    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <div className="p-5">
      <div className="flex items-center justify-between">
        <p className="eyebrow"><span className="status-dot" />LEADERBOARD / 今日神探榜</p>
        <button
          onClick={() => {
            sfx.play("click");
            void refresh();
          }}
          className="font-[family-name:var(--font-dossier)] text-[10px] tracking-widest text-paper-600 hover:text-brass-300"
        >
          ↻ 刷新
        </button>
      </div>
      <div className="hud-rule mt-4" />
      {!caseBrief && <p className="mt-6 text-xs text-paper-600">尚无案件——先打开案卷档案。</p>}
      {caseBrief && board?.length === 0 && (
        <p className="mt-6 text-xs leading-relaxed text-paper-600">
          虚位以待——第一个结案的人留名于此。
        </p>
      )}
      {board && board.length > 0 && (
        <ol className="mt-5 space-y-2">
          {board.map((row, i) => (
            <li
              key={row.playerId}
              className={`flex items-center gap-3 border-b border-ink-700/40 pb-2 font-[family-name:var(--font-dossier)] text-sm last:border-0 ${
                row.playerId === playerId ? "text-brass-300" : ""
              }`}
            >
              <span className={i < 3 ? "text-brass-300" : "text-brass-600"}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className={row.playerId === playerId ? "" : "text-paper-400"}>
                {row.playerId.slice(0, 8)}
                {row.playerId === playerId && "（你）"}
              </span>
              <span className="ml-auto text-brass-300">{row.score} 分</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-6 font-[family-name:var(--font-dossier)] text-[10px] tracking-widest text-paper-600">
        榜单按案件实时更新 · 30s 自动刷新
      </p>
    </div>
  );
}
