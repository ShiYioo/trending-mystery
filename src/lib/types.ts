// 领域类型定稿：接口侧照官方 http-api.md（核验 2026-07-16）落型，游戏侧照 README §4.5 结案管线。
// 此文件是前后端唯一契约源，字段变更必须先改这里。

// ===== 知乎开放接口 =====

/** 统一响应信封（内容接口） */
export interface ApiEnvelope<T> {
  Code: number;
  Message: string;
  Data: T;
}

export const ApiErrorCode = {
  OK: 0,
  AUTH_FAILED: 20001,
  RATE_LIMITED: 30001,
  INTERNAL: 90001,
} as const;

/** 热榜 Item：仅此四个字段，无热度分值与时间范围参数（案件热度以榜单位次表达） */
export interface HotListItem {
  Title: string;
  Url: string;
  ThumbnailUrl: string; // 无封面为 ""
  Summary: string; // 无摘要为 ""
}

export interface HotListData {
  Total: number;
  Items: HotListItem[];
}

/** 精选评论仅 Content 一个字段——线人爆料卡天然不可评星 */
export interface SearchComment {
  Content: string;
}

/** 站内搜索 Item（线索卡数据源，字段→卡面映射见 README §4.6） */
export interface SearchItem {
  Title: string;
  ContentType: string; // 枚举待 M0 实测（文档示例见 "Article"）
  ContentID: string;
  ContentText: string; // 摘要级文本，非全文
  Url: string; // 带 utm 溯源
  CommentCount: number;
  VoteUpCount: number;
  AuthorName: string;
  AuthorAvatar: string;
  AuthorBadge: string;
  AuthorBadgeText: string;
  EditTime: number;
  CommentInfoList?: SearchComment[];
  AuthorityLevel: string;
  RankingScore: number;
}

export interface SearchData {
  HasMore: boolean; // 固定 false，无翻页
  SearchHashId: string;
  Items: SearchItem[];
  EmptyReason?: string;
}

/** 直答模型档位；zhida-agent 不保证支持多轮上下文，审问/叙事只用前两个 */
export type ZhidaModel = "zhida-fast-1p5" | "zhida-thinking-1p5" | "zhida-agent";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; reasoning_content?: string; content: string };
    finish_reason: string;
  }>;
}

/** SSE 流式增量块；error 与 finish_reason==="error" 表示流中失败 */
export interface ChatChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: { role?: string; reasoning_content?: string; content?: string };
    finish_reason: string | null;
  }>;
  error?: { message: string; type: string; code?: string };
}

// ===== 游戏领域（README §4.5） =====

export interface Stance {
  id: string;
  label: string;
  /** 代码用真实点赞数计算的共识权重；对玩家隐藏，结案翻牌才揭示 */
  clusterWeight: number;
}

export interface Issue {
  id: string;
  title: string;
  stances: Stance[];
}

export interface ClueCard {
  id: string;
  stars: 1 | 2 | 3 | 4 | 5;
  /** 该卡来源回答所支持的立场 id（开局聚类时标注） */
  supportsStance: string;
  sourceContentId: string;
}

export interface CaseBrief {
  caseId: string;
  questionTitle: string;
  questionUrl: string;
  hotRank: number; // 案件热度 = 榜单位次
  briefing: string;
  issues: Issue[];
  clueCards: ClueCard[];
  suggestedKeywords: string[];
}

export interface VerdictSubmission {
  issueId: string;
  stanceId?: string; // 独狼路线：不押立场牌，只给 customText
  customText?: string;
  citedClueIds: string[];
}

export type Grade = "S" | "A" | "B" | "C";

export interface IssueScore {
  issueId: string;
  chosenStanceId: string | null;
  consensusScore: number; // 0-100
  evidenceScore: number; // 0-100
}

export interface ScoreResult {
  total: number;
  grade: Grade;
  issues: IssueScore[];
  /** 三分项各自的百分制得分（总分 = 50/35/15 加权） */
  breakdown: { consensus: number; evidence: number; statement: number };
}
