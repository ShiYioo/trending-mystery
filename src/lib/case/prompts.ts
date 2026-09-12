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
        "你是侦探游戏《热搜疑云》的案件设计师。把知乎热点问题包装成一宗侦探案件。只输出 JSON，不要输出任何其他文字、注释或代码块标记。",
    },
    {
      role: "user",
      content: `热点问题：${questionTitle}

候选回答（按赞数加权，代表社区观点分布）：
${itemList}

请输出如下结构的 JSON：
{
  "briefing": "150字内的侦探风案情简报，埋下疑点，不给出结论",
  "issues": [ { "title": "争议点问题", "stances": [ { "id": "s1", "label": "8字内立场标签" } ] } ],
  "items": [ { "idx": 1, "issue": 0, "stance": "s1" } ],
  "keywords": ["6~8个供玩家搜查的检索词，含正反角度"]
}
约束：2~3 个争议点；每个争议点 2~4 个立场；每条候选回答必须归入某个争议点的某个立场（无法判断就归赞数最高立场的对立面之外的新立场或跳过）；keywords 不要与问题标题重复。`,
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

/** 结案报告：分数已由代码算定，LLM 只做侦探风解说（AI 不当裁判） */
export function buildReportMessages(input: {
  questionTitle: string;
  briefing: string;
  grades: string[];
  chosenLabels: string[];
  consensusLines: string[];
  total: number;
  grade: string;
}): ChatMessage[] {
  return [
    {
      role: "system",
      content: "你是《热搜疑云》的结案法官，文风：冷峻、克制、带侦探小说腔调。直接输出报告正文，200字内，不要标题。",
    },
    {
      role: "user",
      content: `案件：${input.questionTitle}
案情：${input.briefing}
玩家结论：${input.chosenLabels.join("；")}
社区共识分布：${input.consensusLines.join("；")}
玩家总分：${input.total}（评级 ${input.grade}）

写结案报告：先陈述玩家结论，再对照社区共识点出分歧或吻合，最后一句侦探式的收尾评语。`,
    },
  ];
}
