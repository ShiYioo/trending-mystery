// 窗口应用共享类型：AppId 与应用入口 props——四个房间 + 神探榜，全部住在 TM-01 里。

export type AppId = "case" | "search" | "interrogation" | "verdict" | "board";

export interface OpenOptions {
  /** 检索预填关键词（案卷检索词 → 打开档案检索） */
  keyword?: string;
}

export interface AppProps {
  /** 在 OS 内打开另一个应用（零路由跳转） */
  open: (app: AppId, opts?: OpenOptions) => void;
}
