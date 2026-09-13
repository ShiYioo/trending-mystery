// 知乎开放接口薄封装：热榜 hot_list / 站内搜索 zhihu_search / 直答 chat/completions / 发布想法
// 鉴权：Bearer Access Secret + 秒级 X-Request-Timestamp（发布想法另走 HMAC 签名）；前端永不直连。

export {
  buildPinSignature,
  chat,
  chatStream,
  getHotList,
  parseSseBlock,
  publishPin,
  searchZhihu,
  ZhihuApiError,
} from "./client";
export { extractJson, JsonParseError } from "./json";
