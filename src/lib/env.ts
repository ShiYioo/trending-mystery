// 运行时环境访问：全部懒读取（next build 期不触发），缺失时在调用点抛可读错误。
// 填写方式见 .env.example；.env 已被 gitignore，密钥永不入库。

export function getZhihuAccessSecret(): string {
  const v = process.env.ZHIHU_ACCESS_SECRET;
  if (!v) {
    throw new Error(
      "[env] ZHIHU_ACCESS_SECRET 未配置——到 developer.zhihu.com/profile 获取后写入 .env",
    );
  }
  return v;
}

export function getRedisUrl(): string {
  const v = process.env.REDIS_URL;
  if (!v) {
    throw new Error(
      "[env] REDIS_URL 未配置——两台开发机与线上共用同一远程实例（同一本配额账），见 README §4.6",
    );
  }
  return v;
}

/** 社区开放能力（发布想法）的应用密钥——与 Access Secret、OAuth App Key 是三个不同凭证 */
export function getZhihuAppSecret(): string | null {
  return process.env.ZHIHU_APP_SECRET ?? null;
}

/** 发布想法目标圈子：默认黑客松脑洞补给站（2026 黑客松指定圈子之一） */
export function getPinRingId(): string {
  return process.env.ZHIHU_PIN_RING_ID ?? "2029619126742656657";
}

/**
 * 直答额度开关：ZHIHU_LLM_DISABLED=1 时全站跳过直答调用——
 * 案件生成走降级聚类、审问室返回友好提示、结案走模板文案。额度恢复后删掉该变量即可。
 */
export function llmEnabled(): boolean {
  return !process.env.ZHIHU_LLM_DISABLED;
}
