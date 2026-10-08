import rawWatch from "./fintech-stock-watchlist.json";
import rawQuotes from "./fintech-stock-quotes.json";
import { LISTED_ORIGIN_LABEL, LISTED_REGION_LABEL } from "./listedPlayerDisclosure";

export type FintechStockWatchItem = {
  id: string;
  nameZh: string;
  symbol: string;
  yahoo: string;
  exchange?: string;
  region?: string;
  /** 主市场 / 总部所在国（ISO）；用于一眼识别，≠上市交易所国 */
  country?: string;
  /** 主要展业国（ISO），可多选 */
  markets?: string[];
  origin?: string;
  groupKey?: string;
};

export type FintechStockQuote = FintechStockWatchItem & {
  price: number | null;
  previousClose?: number | null;
  changePct: number | null;
  /** 市值（美元，原始数） */
  marketCapUsd?: number | null;
  /** 展示用市值，如 $15.0B */
  marketCapLabel?: string | null;
  /** 市盈率（TTM trailing P/E；亏损/无数据为 null） */
  peRatio?: number | null;
  /** 这一条自己的行情日；缺省用文件 asOf */
  asOf?: string;
  /** 覆盖卡片上的行情来源说明 */
  quoteNote?: string;
  currency?: string;
  marketState?: string;
  exchangeName?: string;
  url?: string;
};

export type FintechStockQuotesFile = {
  asOf: string;
  source: string;
  note?: string;
  stats?: {
    total: number;
    quoted: number;
    withMarketCap?: number;
    withPe?: number;
    fresh?: number;
  };
  items: FintechStockQuote[];
};

export const FINTECH_STOCK_WATCHLIST = rawWatch as {
  asOf: string;
  note?: string;
  focus?: string[];
  /** 快讯旁股价条重点监控（个别标的，非全市场涨跌幅榜） */
  monitorIds?: string[];
  items: FintechStockWatchItem[];
};

export const FINTECH_STOCK_QUOTES = rawQuotes as FintechStockQuotesFile;

/** 默认监控名单（可被本地 canvas 状态覆盖） */
export const FINTECH_STOCK_MONITOR_DEFAULT_IDS: string[] =
  FINTECH_STOCK_WATCHLIST.monitorIds?.length
    ? [...FINTECH_STOCK_WATCHLIST.monitorIds]
    : [];

/** 股价监控条：按 id 顺序取个别标的 */
export function fintechStockMonitorQuotes(ids?: string[]): FintechStockQuote[] {
  const list = (ids && ids.length ? ids : FINTECH_STOCK_MONITOR_DEFAULT_IDS).filter(Boolean);
  const byId = new Map((FINTECH_STOCK_QUOTES.items || []).map((it) => [it.id, it]));
  const rows = list.map((id) => byId.get(id)).filter(Boolean) as FintechStockQuote[];
  if (rows.length) return rows;
  return [...(FINTECH_STOCK_QUOTES.items || [])]
    .filter((it) => it.changePct != null && !Number.isNaN(it.changePct))
    .slice(0, 10);
}

export { LISTED_ORIGIN_LABEL, LISTED_REGION_LABEL };

export const FINTECH_STOCK_REGION_ORDER = [
  "se-asia",
  "latam",
  "east-asia",
  "south-asia",
  "africa",
  "mena",
  "central-asia",
  "west",
] as const;

/** 主口径：消费信贷 / 分期 / 支付 / 数字银行 + 生态数据/风控服务；电商·出行仅作带金融臂的母公司 */
export const FINTECH_STOCK_ORIGIN_ORDER = [
  "credit-native",
  "bnpl",
  "payment",
  "digibank",
  "data-service",
  "risk-service",
  "ecommerce",
  "ride-food",
] as const;

export function fintechStockRegionLabel(region?: string): string {
  if (!region) return "其他";
  return LISTED_REGION_LABEL[region] || region;
}

export function fintechStockOriginLabel(origin?: string): string {
  if (!origin) return "其他";
  return LISTED_ORIGIN_LABEL[origin] || origin;
}

/** 上市公司主国短标（独立于 Atlas 宏观国别表，含 AU/GE/UY 等） */
export const FINTECH_STOCK_COUNTRY_LABEL: Record<string, string> = {
  CN: "中国大陆",
  HK: "中国香港",
  TW: "中国台湾",
  SG: "新加坡",
  ID: "印尼",
  MY: "马来西亚",
  TH: "泰国",
  PH: "菲律宾",
  VN: "越南",
  IN: "印度",
  BR: "巴西",
  MX: "墨西哥",
  AR: "阿根廷",
  CL: "智利",
  CO: "哥伦比亚",
  PE: "秘鲁",
  UY: "乌拉圭",
  US: "美国",
  CA: "加拿大",
  GB: "英国",
  IE: "爱尔兰",
  NL: "荷兰",
  DE: "德国",
  AU: "澳大利亚",
  NZ: "新西兰",
  ZA: "南非",
  NG: "尼日利亚",
  KE: "肯尼亚",
  GH: "加纳",
  EG: "埃及",
  SA: "沙特",
  AE: "阿联酋",
  KZ: "哈萨克",
  GE: "格鲁吉亚",
  IL: "以色列",
  JP: "日本",
  KR: "韩国",
  BD: "孟加拉",
  LK: "斯里兰卡",
  PK: "巴基斯坦",
};

export function fintechStockCountryLabel(code?: string): string {
  if (!code) return "—";
  return FINTECH_STOCK_COUNTRY_LABEL[code] || code;
}

/** 主国短标（一览/卡片只显示主国，不拼「等N国」） */
export function fintechStockCountryLine(country?: string, _markets?: string[]): string {
  return fintechStockCountryLabel(country);
}

export function formatQuotePrice(price: number | null | undefined, currency?: string): string {
  if (price == null || Number.isNaN(price)) return "—";
  const ccy = currency || "";
  const digits = price >= 1000 ? 0 : price >= 100 ? 1 : 2;
  const num = price.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return ccy ? `${num} ${ccy}` : num;
}

export function formatChangePct(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function formatMarketCap(
  usd: number | null | undefined,
  label?: string | null,
): string {
  if (label) return label.replace(/\$/g, "");
  if (usd == null || Number.isNaN(usd) || usd <= 0) return "—";
  if (usd >= 1e12) return `${(usd / 1e12).toFixed(2)}T`;
  if (usd >= 1e9) return `${(usd / 1e9).toFixed(1)}B`;
  if (usd >= 1e6) return `${(usd / 1e6).toFixed(0)}M`;
  return usd.toLocaleString("en-US");
}

/** 市盈率 TTM；亏损或无数据返回 — */
export function formatPeRatio(pe: number | null | undefined): string {
  if (pe == null || Number.isNaN(pe) || pe <= 0) return "—";
  if (pe >= 100) return pe.toFixed(0);
  if (pe >= 10) return pe.toFixed(1);
  return pe.toFixed(2);
}
