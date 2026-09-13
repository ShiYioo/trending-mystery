// 案件生成的全部提示词。聚类输出走 extractJson 容错解析（直答不保证 response_format）。

import type { ChatMessage } from "../types";

export interface ClusterInputItem {
  idx: number;
  title: string;
  excerpt: string;
  votes: number;
}

export interface ClusterResult {
  briefing: string;
  issues: Array<{ title: string; stances: Array<{ id: string; label: string }> }>;
  items: Array<{ idx: number; issue: number; stance: string }>;
  keywords: string[];
}

/** 开局一次调用完成：案情简报 + 争议点/立场 + 逐条立场归属 + 建议检索词 */
export function buildClusterMessages(
  questionTitle: string,
  items: ClusterInputItem[],
): ChatMessage[] {
  const itemList = items
    .map((i) => `#${i.idx} [${i.votes}赞] ${i.title}\n摘要：${i.excerpt}`)
    .join("\n\n");
  return [
    {
      role: "system",
      content:
        "你是侦探游戏《热搜疑云》的案件设计师。把知乎热点问题包装成一宗侦探案件。只输出 JSON，不要输出任何其他文字、注释或代码块标记。最重要的纪律：只准复述候选回答中明确陈述的事实，禁止虚构任何情节、动机或因果——材料里没有的事件（如\"投诉\"\"报复\"\"阴谋\"）一个字都不许发明。",
    },
    {
      role: "user",
      content: `热点问题：${questionTitle}

候选回答（按赞数加权，代表社区观点分布）：
${itemList}

请输出如下结构的 JSON：
{
  "briefing": "150字内的案情简报：先交代核心事件的因果（谁做了什么、导致了什么），再点出主要分歧。只能使用候选回答中明确出现的事实与表述，禁止添加任何新材料中没有的情节、动机或推断。可以有侦探式的语气，但事实零虚构。",
  "issues": [ { "title": "争议点问题（必须是候选回答中真实存在的分歧）", "stances": [ { "id": "s1", "label": "8字内立场标签" } ] } ],
  "items": [ { "idx": 1, "issue": 0, "stance": "s1" } ],
  "keywords": ["6~8个供玩家搜查的检索词，含正反角度"]
}
约束：2~3 个争议点；每个争议点 2~4 个立场；每条候选回答必须归入某个争议点的某个立场（无法判断就跳过）；keywords 不要与问题标题重复。`,
    },
  ];
}

/** 质检返工：把虚构的争议点/简报连同审校意见发回重写（只改被点名的问题） */
export function buildClusterFixMessages(
  questionTitle: string,
  items: ClusterInputItem[],
  draft: ClusterResult,
  badIssueTitles: string[],
  briefingUngrounded: boolean,
): ChatMessage[] {
  const itemList = items
    .map((i) => `#${i.idx} [${i.votes}赞] ${i.title}\n摘要：${i.excerpt}`)
    .join("\n\n");
  const review = [
    ...badIssueTitles.map(
      (t) => `- 争议点「${t}」包含候选回答中不存在的内容，属于虚构——请仅基于材料重写该争议点（立场结构可保留）。`,
    ),
    briefingUngrounded ? "- 简报包含材料中没有的情节——请仅复述材料事实重写简报。" : "",
  ]
    .filter(Boolean)
    .join("\n");
  return [
    {
      role: "system",
      content: "你是案件设计师的审校。只输出修正后的完整 JSON（与草稿同结构），不要输出任何其他文字。",
    },
    {
      role: "user",
      content: `热点问题：${questionTitle}

候选回答（唯一事实来源）：
${itemList}

你此前的草稿：
${JSON.stringify(draft)}

审校意见：
${review}

纪律：除被点名的问题外不要改动其他内容；争议点标题必须是候选回答中真实存在的分歧，优先复用材料中的原词。`,
    },
  ];
}

/** 审问室当事人人设：有据可依，但问得不够细就避重就轻（README §2 房间三） */
export function buildPersonaMessages(
  briefing: string,
  questionTitle: string,
  shownExcerpts: string[],
  history: ChatMessage[],
): ChatMessage[] {
  const evidence = shownExcerpts.length
    ? `\n\n【已被出示的证据摘要（必须正面回应，不得否认其存在）】\n${shownExcerpts.map((e, i) => `证据${i + 1}：${e}`).join("\n")}`
    : "";
  return [
    {
      role: "system",
      content: `你在侦探游戏《热搜疑云》的审问室里扮演本案的当事人/知情者。案件背景：${questionTitle}。案情：${briefing}

扮演规则：
1. 只依据案件背景、已知事实和被出示的证据回答；不知道的就说"记不清了"，绝不编造具体数字。
2. 玩家问得笼统（如"说说怎么回事""谁的责任"）时，你打太极、避重就轻，只重复公开口径。
3. 玩家出示了与你先前说法矛盾的具体证据时，你必须承认该细节并补出一点新信息，但仍试图转移焦点。
4. 始终第一人称，保持角色，不跳出扮演，不提及自己是 AI。每次回答不超过 120 字，口语化。${evidence}`,
    },
    ...history,
  ];
}

/** 陈词一致分：判断自由文本与所选立场是否自洽、是否真引用线索（0~1，代码侧封顶 15%） */
export function buildCoherenceMessages(
  statement: string,
  chosenLabels: string[],
  citedExcerpts: string[],
): ChatMessage[] {
  return [
    {
      role: "system",
      content: "你是评分助手。只输出 JSON，形如 {\"coherence\": 0.0~1.0}，不要输出其他内容。",
    },
    {
      role: "user",
      content: `玩家的结案陈词：${statement}

玩家押注的立场：${chosenLabels.join("；")}
玩家指认的证据摘要：${citedExcerpts.join("\n") || "（无）"}

coherence 评分标准（0~1）：陈词与所押立场逻辑一致（0.4）+ 确实引用了证据内容而非空话（0.3）+ 表述完整连贯（0.3）。`,
    },
  ];
}

/** 结案报告：分数已由代码算定，LLM 只做数据解说——书记官不当法官（README §4.5） */
export interface ReportInput {
  questionTitle: string;
  briefing: string;
  perIssue: Array<{ issueTitle: string; chosenLabel: string; weightPct: number }>;
  evidenceScore: number;
  citedCount: number;
  statementScore: number;
  hasStatement: boolean;
  total: number;
  grade: string;
}

export function buildReportMessages(input: ReportInput): ChatMessage[] {
  return [
    {
      role: "system",
      content: `你是《热搜疑云》的结案书记官——记分员，不是法官。纪律：
1. 只解说给定的数据：押注与共识分布、证据指认情况、陈词得分；不得评价玩家结论的"事实真伪"。
2. 禁止出现"证据不足""足以证明""事实认定""关键偏差"这类真相判断措辞——本游戏度量的是玩家与社区共识的距离，不是真相。
3. 只可使用案情简报与给定数据中的信息，禁止编造任何细节。
4. 结构（200字内）：① 逐争议点复述押注与共识百分比；② 点评证据指认——指认为 0 就直说"档案袋未指认任何证物，证据分记零"；③ 一句话点评陈词；④ 侦探式收尾一句。`,
    },
    {
      role: "user",
      content: `案件：${input.questionTitle}
案情简报：${input.briefing}

逐争议点数据：
${input.perIssue.map((p) => `- ${p.issueTitle}：玩家押「${p.chosenLabel}」，该立场共识权重 ${p.weightPct}%`).join("\n")}
证据指认：指认 ${input.citedCount} 张证物，证据分 ${input.evidenceScore}/100
结案陈词：${input.hasStatement ? `已提交，陈词分 ${input.statementScore}/100` : "未提交，陈词分记 0"}
总分 ${input.total}（${input.grade} 级）

请输出结案报告。`,
    },
  ];
}
