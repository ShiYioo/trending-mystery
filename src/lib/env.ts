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
