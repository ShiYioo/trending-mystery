"use client";

// 全局对局状态：案件 / 档案袋（已收集线索）/ 审问历史 / 结案结果。
// localStorage 持久化——匿名侦探 ID 跨局复用（OAuth 登录优先，M3 接入时替换）。

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchCase } from "@/lib/game/api";
import type { ChatMessage, PublicCaseBrief } from "@/lib/types";

export interface CollectedCard {
  contentId: string;
  title: string;
  contentType: string;
  excerpt: string;
  url: string;
  votes: number;
  author: string;
  authorBadge: string;
  stars: number;
  /** 命中案件底表的卡（结案可指认）；null = 外围情报 */
  cardId: string | null;
  whispers: string[];
}

export interface VerdictResponse {
  caseId: string;
  playerId: string;
  score: {
    total: number;
    grade: "S" | "A" | "B" | "C";
    issues: Array<{
      issueId: string;
      chosenStanceId: string | null;
      consensusScore: number;
      evidenceScore: number;
    }>;
    breakdown: { consensus: number; evidence: number; statement: number };
  };
  consensus: Array<{
    issueId: string;
    title: string;
    stances: Array<{ id: string; label: string; weight: number }>;
  }>;
  /** 证据核查表：逐张亮出被指认卡的真实立场归属——玩家可核对系统的判分依据 */
  evidenceReview: Array<{
    issueId: string;
    title: string;
    chosenLabel: string;
    cards: Array<{
      id: string;
      excerpt: string;
      stars: number;
      hit: boolean;
      actualStanceLabel: string;
    }>;
  }>;
  report: string;
}

interface GameState {
  playerId: string;
  caseBrief: PublicCaseBrief | null;
  collected: CollectedCard[];
  history: ChatMessage[];
  result: VerdictResponse | null;
  profile: { name: string; headline: string } | null;
  /** 本地进度锚点：案卷唯一事实源在服务端，客户端进度绑 caseId——案换世界清 */
  savedCaseId: string | null;
  savedRank: number;
}

interface GameStore extends GameState {
  setCase: (brief: PublicCaseBrief) => void;
  toggleCollect: (card: CollectedCard) => void;
  isCollected: (contentId: string) => boolean;
  setHistory: (history: ChatMessage[]) => void;
  setResult: (result: VerdictResponse) => void;
  resetAll: () => void;
  clearProfile: () => void;
}
const STORAGE_KEY = "tm_game_v1";
const PLAYER_KEY = "tm_player_id";
const MAX_COLLECTED = 24;
/** 档案保质期：服务端案件 TTL 24h，客户端留 4h 裕量——隔夜回来不再抱着死案 */
const SAVE_TTL_MS = 20 * 3600 * 1000;

const emptyState: GameState = {
  playerId: "",
  caseBrief: null,
  collected: [],
  history: [],
  result: null,
  profile: null,
  savedCaseId: null,
  savedRank: 1,
};

const GameContext = createContext<GameStore | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(emptyState);

  // 客户端挂载：恢复进度锚点（案卷快照不再本地持久化——服务端是唯一事实源），
  // 随即向服务端取当前案：caseId 与锚点一致 → 恢复档案袋/审问/结案进度；不一致 → 清档重来
  useEffect(() => {
    const pid = localStorage.getItem(PLAYER_KEY) ?? crypto.randomUUID();
    localStorage.setItem(PLAYER_KEY, pid);
    let saved: {
      caseId?: string;
      rank?: number;
      collected?: CollectedCard[];
      history?: ChatMessage[];
      result?: VerdictResponse | null;
      savedAt?: number;
    } = {};
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as typeof saved;
    } catch {
      saved = {};
    }
    // 陈档清理：锚点超过 20h（服务端案件 24h TTL 留 4h 裕量）视为死案
    const stale = !saved.savedAt || Date.now() - saved.savedAt > SAVE_TTL_MS;
    const savedCaseId = stale ? null : saved.caseId ?? null;
    const savedRank = !stale && saved.rank ? saved.rank : 1;
    setState((s) => ({
      ...s,
      playerId: pid,
      savedCaseId,
      savedRank,
      collected: savedCaseId ? saved.collected ?? [] : [],
      history: savedCaseId ? saved.history ?? [] : [],
      result: savedCaseId ? saved.result ?? null : null,
    }));
    // 开机取案藏在 3D 开场期间跑（服务端缓存命中毫秒级；降级案 10 分钟自愈后自动拿到完整版）
    void fetchCase(savedRank)
      .then((brief) => {
        setState((s) => {
          const sameCase = savedCaseId === brief.caseId;
          return {
            ...s,
            caseBrief: brief,
            savedCaseId: brief.caseId,
            savedRank: brief.hotRank ?? savedRank,
            ...(sameCase ? {} : { collected: [], history: [], result: null }),
          };
        });
      })
      .catch(() => {});
    fetch("/api/oauth/user")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { profile?: { name: string; headline: string } } | null) => {
        if (data?.profile) setState((s) => ({ ...s, profile: data.profile! }));
      })
      .catch(() => {});
  }, []);

  // 授权在新标签页进行：标记在点击时才写入，轮询必须每拍检查（挂载时查一次会漏）；
  // 另外在窗口聚焦时立即查——玩家从授权页切回来的瞬间就亮牌。拿到身份即清标记。
  useEffect(() => {
    const fetchProfile = () => {
      fetch("/api/oauth/user")
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { profile?: { name: string; headline: string } } | null) => {
          if (data?.profile) {
            setState((s) => ({ ...s, profile: data.profile! }));
            sessionStorage.removeItem("tm_oauth_pending");
          }
        })
        .catch(() => {});
    };
    let ticks = 0;
    const timer = setInterval(() => {
      if (!sessionStorage.getItem("tm_oauth_pending")) return;
      ticks += 1;
      if (ticks > 80) {
        sessionStorage.removeItem("tm_oauth_pending");
        return;
      }
      fetchProfile();
    }, 2500);
    const onFocus = () => {
      if (sessionStorage.getItem("tm_oauth_pending")) fetchProfile();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    if (!state.playerId) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        caseId: state.caseBrief?.caseId ?? state.savedCaseId,
        rank: state.caseBrief?.hotRank ?? state.savedRank,
        collected: state.collected,
        history: state.history,
        result: state.result,
        savedAt: Date.now(),
      }),
    );
  }, [state.playerId, state.caseBrief, state.savedCaseId, state.savedRank, state.collected, state.history, state.result]);

  const setCase = useCallback((caseBrief: PublicCaseBrief) => {
    setState((s) => ({
      ...s,
      caseBrief,
      savedCaseId: caseBrief.caseId,
      savedRank: caseBrief.hotRank ?? s.savedRank,
      collected: [],
      history: [],
      result: null,
    }));
  }, []);

  const toggleCollect = useCallback((card: CollectedCard) => {
    setState((s) => {
      const exists = s.collected.some((c) => c.contentId === card.contentId);
      if (exists) return { ...s, collected: s.collected.filter((c) => c.contentId !== card.contentId) };
      if (s.collected.length >= MAX_COLLECTED) return s;
      return { ...s, collected: [card, ...s.collected] };
    });
  }, []);

  const isCollected = useCallback(
    (contentId: string) => state.collected.some((c) => c.contentId === contentId),
    [state.collected],
  );

  const setHistory = useCallback((history: ChatMessage[]) => {
    setState((s) => ({ ...s, history }));
  }, []);

  const setResult = useCallback((result: VerdictResponse) => {
    setState((s) => ({ ...s, result }));
  }, []);

  const resetAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState((s) => ({ ...emptyState, playerId: s.playerId }));
  }, []);

  const clearProfile = useCallback(() => {
    setState((s) => ({ ...s, profile: null }));
  }, []);

  const store = useMemo<GameStore>(
    () => ({ ...state, setCase, toggleCollect, isCollected, setHistory, setResult, resetAll, clearProfile }),
    [state, setCase, toggleCollect, isCollected, setHistory, setResult, resetAll, clearProfile],
  );

  return <GameContext.Provider value={store}>{children}</GameContext.Provider>;
}

export function useGame(): GameStore {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame 必须在 GameProvider 内使用");
  return ctx;
}
