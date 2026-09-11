// 知乎开放接口薄封装：热榜 hot_list / 站内搜索 zhihu_search / 直答 Agent chat/completions
// 鉴权：Authorization: Bearer <Access Secret> + X-Request-Timestamp（秒级）
// 所有调用经此层出入：配额计数与缓存（lib/redis.ts）在这里统一挂载，前端永不直连接口
export {};
