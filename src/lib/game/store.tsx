"use client";

// 全局对局状态：案件 / 档案袋（已收集线索）/ 审问历史 / 结案结果。
// localStorage 持久化——匿名侦探 ID 跨局复用（OAuth 登录优先，M3 接入时替换）。

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
}

interface GameStore extends GameState {
  setCase: (brief: PublicCaseBrief) => void;
  toggleCollect: (card: CollectedCard) => void;
  isCollected: (contentId: string) => boolean;
  setHistory: (history: ChatMessage[]) => void;
  setResult: (result: VerdictResponse) => void;
  resetAll: () => void;
}
const STORAGE_KEY = "tm_game_v1";
const PLAYER_KEY = "tm_player_id";
const MAX_COLLECTED = 24;

const emptyState: GameState = {
  playerId: "",
  caseBrief: null,
  collected: [],
  history: [],
  result: null,
  profile: null,
};

const GameContext = createContext<GameStore | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(emptyState);

  // 客户端挂载后恢复持久化状态（避免 SSR 水合不一致），并拉取登录身份
  useEffect(() => {
    const pid = localStorage.getItem(PLAYER_KEY) ?? crypto.randomUUID();
    localStorage.setItem(PLAYER_KEY, pid);
    let restored: Partial<GameState> = {};
    try {
      restored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<GameState>;
    } catch {
      restored = {};
    }
    setState({ ...emptyState, ...restored, playerId: pid });
    fetch("/api/oauth/user")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { profile?: { name: string; headline: string } } | null) => {
        if (data?.profile) setState((s) => ({ ...s, profile: data.profile! }));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!state.playerId) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        caseBrief: state.caseBrief,
        collected: state.collected,
        history: state.history,
        result: state.result,
      }),
    );
  }, [state.playerId, state.caseBrief, state.collected, state.history, state.result]);

  const setCase = useCallback((caseBrief: PublicCaseBrief) => {
    setState((s) => ({ ...s, caseBrief, collected: [], history: [], result: null }));
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

  const store = useMemo<GameStore>(
    () => ({ ...state, setCase, toggleCollect, isCollected, setHistory, setResult, resetAll }),
    [state, setCase, toggleCollect, isCollected, setHistory, setResult, resetAll],
  );

  return <GameContext.Provider value={store}>{children}</GameContext.Provider>;
}

export function useGame(): GameStore {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame 必须在 GameProvider 内使用");
  return ctx;
}
