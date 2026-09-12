// 知乎开放接口薄封装：热榜 hot_list / 站内搜索 zhihu_search / 直答 chat/completions
// 鉴权：Bearer Access Secret + 秒级 X-Request-Timestamp；全部调用经此层，前端永不直连。

export {
  chat,
  chatStream,
  getHotList,
  parseSseBlock,
  searchZhihu,
  ZhihuApiError,
} from "./client";
export { extractJson, JsonParseError } from "./json";
