// Redis 键设计（唯一数据层），键定义见 README §4.6：
//   quota:search:{日期} / quota:hotlist:{日期}   配额计数器（INCR + EXPIRE 48h）
//   cache:hotlist:{小时}                          热榜整表缓存
//   cache:search:{caseId}:{归一化关键词}          搜索结果缓存（全服共享）
//   board:case:{caseId}                           今日神探榜（ZSET）
// 键名生成逻辑只收敛在此文件，禁止各处手拼
export {};
