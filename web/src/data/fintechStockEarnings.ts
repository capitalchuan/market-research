import raw from "./fintech-stock-earnings.json";

export type FintechStockEarningKpi = {
  id: string;
  label: string;
  value: string;
  yoy?: string;
};

/** 一览表财务骨架：仅落可核验且口径对齐的字段；对不上宁可空 */
export type FintechStockFundamentals = {
  /** 净资产 / 股东权益 */
  equity?: string;
  /** 资产负债率（负债合计/资产合计） */
  debtRatio?: string;
  /** 当期收入（净收入/总收入；勿用毛利替代） */
  revenue?: string;
  /** 披露口径的 EBITDA / 经调 EBITDA（勿用 EBIT/经营利润冒充） */
  ebitda?: string;
  /**
   * 准现金：货币资金 + 理财 + 存单 + 国债等（不含客户备付金/受限资金；勿拼「现金+短投+…」文案）
   */
  cashLike?: string;
  /**
   * 信贷余额：管理口径在贷/平台组合余额（勿用累计放款、季放款量）
   */
  creditAum?: string;
};

export type FintechStockEarning = {
  id: string;
  nameZh?: string;
  ticker?: string;
  period?: string;
  periodEnd?: string;
  reportedAt?: string;
  kpis: FintechStockEarningKpi[];
  fundamentals?: FintechStockFundamentals;
  irUrl?: string;
  sourceNote?: string;
  cashLoanHint?: string | null;
  confidence?: string;
  source?: string;
};

export type FintechStockEarningsFile = {
  asOf: string;
  note?: string;
  stats?: {
    total: number;
    fromDisclosure?: number;
    watchlist?: number;
    coverage?: number;
  };
  items: FintechStockEarning[];
};

export const FINTECH_STOCK_EARNINGS = raw as FintechStockEarningsFile;

const byId = new Map<string, FintechStockEarning>();
for (const it of FINTECH_STOCK_EARNINGS.items || []) {
  if (it.id) byId.set(it.id, it);
}

export function resolveFintechStockEarning(id?: string): FintechStockEarning | undefined {
  if (!id) return undefined;
  if (byId.has(id)) return byId.get(id);
  // B3 存托与 NYSE 主体共用最近一期
  if (id === "nubank-br") return byId.get("nu");
  return undefined;
}

type FundKey = keyof FintechStockFundamentals;

export type FintechFundSortKey = FundKey;

/**
 * KPI 回填仅用于已是美元、或可安全识别的标签。
 * 本币金额不自动回填（避免一览混币）；统一以 fundamentals 折美元为准。
 */
const KPI_FALLBACK: Partial<Record<FundKey, RegExp[]>> = {
  debtRatio: [/资产负债率/, /^负债率$/],
};

function matchKpi(earn: FintechStockEarning, patterns: RegExp[]): string | undefined {
  for (const k of earn.kpis || []) {
    const blob = `${k.id || ""} ${k.label || ""}`;
    if (patterns.some((re) => re.test(blob))) {
      return (k.value || "").trim() || undefined;
    }
  }
  return undefined;
}

/** 一览列取值：金额类以 fundamentals 美元为准；对不上则空 */
export function pickFintechFundamental(
  earn: FintechStockEarning | undefined,
  key: FundKey,
): string {
  if (!earn) return "—";
  const direct = earn.fundamentals?.[key]?.trim();
  if (direct) return stripUsdSymbol(direct);
  const patterns = KPI_FALLBACK[key];
  if (!patterns) return "—";
  const hit = matchKpi(earn, patterns);
  return hit ? stripUsdSymbol(hit) : "—";
}

/** 表格默认美元计价：列名/页脚已说明，数值不再叠 $ */
export function stripUsdSymbol(text: string): string {
  return text.replace(/\$/g, "");
}

/**
 * 把展示串折成可排序数字（美元量级或百分比）。
 * 支持：76%、15.0B、1.2T、629 亿、0.62亿、>0.62 亿、-0.17 亿。
 */
export function parseFintechMetricNumber(raw?: string | null): number | null {
  if (!raw) return null;
  let s = stripUsdSymbol(String(raw)).trim();
  if (!s || s === "—" || s === "-" || s === "N/A") return null;
  s = s.replace(/^[<>≈~]+/, "").trim();
  const neg = s.startsWith("-") || s.startsWith("−");
  s = s.replace(/^[-−]/, "").trim();

  const pct = s.match(/^([\d.]+)\s*%$/);
  if (pct) {
    const n = Number(pct[1]);
    return Number.isFinite(n) ? (neg ? -n : n) : null;
  }

  const yi = s.match(/^([\d.]+)\s*亿$/);
  if (yi) {
    const n = Number(yi[1]);
    // 亿美元 → 美元
    return Number.isFinite(n) ? (neg ? -n : n) * 1e8 : null;
  }

  const wan = s.match(/^([\d.]+)\s*万$/);
  if (wan) {
    const n = Number(wan[1]);
    return Number.isFinite(n) ? (neg ? -n : n) * 1e4 : null;
  }

  const eng = s.match(/^([\d.]+)\s*([KMBTkmbt])$/);
  if (eng) {
    const n = Number(eng[1]);
    if (!Number.isFinite(n)) return null;
    const u = eng[2].toUpperCase();
    const mul = u === "K" ? 1e3 : u === "M" ? 1e6 : u === "B" ? 1e9 : 1e12;
    return (neg ? -n : n) * mul;
  }

  const plain = Number(s.replace(/,/g, ""));
  return Number.isFinite(plain) ? (neg ? -plain : plain) : null;
}

export function fintechFundamentalSortValue(
  earn: FintechStockEarning | undefined,
  key: FundKey,
): number | null {
  const display = pickFintechFundamental(earn, key);
  if (!display || display === "—") return null;
  return parseFintechMetricNumber(display);
}

export const FINTECH_FUNDAMENTAL_COLS: { key: FundKey; label: string; title: string }[] = [
  { key: "equity", label: "净资产", title: "净资产（折美元）" },
  { key: "debtRatio", label: "负债率", title: "资产负债率（负债合计÷资产合计）" },
  { key: "revenue", label: "收入", title: "收入（折美元）" },
  { key: "ebitda", label: "EBITDA", title: "EBITDA（折美元）" },
  {
    key: "cashLike",
    label: "准现金",
    title: "货币资金+理财+存单+国债等（折美元，不含客户备付金）",
  },
  {
    key: "creditAum",
    label: "信贷余额",
    title: "管理口径在贷余额（折美元，非累计放款）",
  },
];

const FUND_COL_EN: Record<FundKey, { label: string; title: string }> = {
  equity: { label: "Book equity", title: "Book equity (USD-equivalent)" },
  debtRatio: { label: "Leverage", title: "Debt / assets (total liabilities ÷ total assets)" },
  revenue: { label: "Revenue", title: "Revenue (USD-equivalent)" },
  ebitda: { label: "EBITDA", title: "EBITDA (USD-equivalent)" },
  cashLike: {
    label: "Cash-like",
    title: "Cash + investments + CDs + govies (USD-eq.; excl. customer float)",
  },
  creditAum: {
    label: "Credit book",
    title: "Managed loan book (USD-eq.; not cumulative origination)",
  },
};

export function fintechFundamentalColUi(
  col: { key: FundKey; label: string; title: string },
  lang: "zh" | "en" = "zh",
): { key: FundKey; label: string; title: string } {
  if (lang !== "en") return col;
  const en = FUND_COL_EN[col.key];
  return en ? { key: col.key, label: en.label, title: en.title } : col;
}

/** Compact USD-scale label from absolute dollars (1e8 = 1 亿) */
function formatUsdCompactFromAbs(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)}K`;
  return `${sign}${abs.toLocaleString("en-US")}`;
}

/**
 * EN 表格：把「131 亿 / 2.9 万亿」等换成 13.1B / 2.9T，避免残留「亿」。
 * 中文模式原样（仅去 $）。
 */
export function formatFintechFundamentalUi(text: string, lang: "zh" | "en" = "zh"): string {
  const raw = stripUsdSymbol(text || "").trim();
  if (!raw || raw === "—") return "—";
  if (lang !== "en") return raw;

  // Pure metric → compact English
  if (/^[<>≈~-−]*\s*[\d.,]+\s*(%|亿|万亿|[KMBTkmbt])?\s*$/i.test(raw)) {
    if (/%/.test(raw)) {
      const n = parseFintechMetricNumber(raw);
      return n == null ? raw.replace(/%/, "%") : `${n}%`;
    }
    const n = parseFintechMetricNumber(raw);
    if (n != null) return formatUsdCompactFromAbs(n);
  }

  let s = raw
    .replace(/([\d.]+)\s*万亿/g, (_, a) => `${a}T`)
    .replace(/([\d.]+)\s*亿美元/g, (_, a) => `${a}B`)
    .replace(/([\d.]+)\s*亿\s*(RMB|CNY|BRL|IDR|INR|JPY|KRW|MXN|AED)/gi, (_, a, ccy) => {
      const v = Number(a) / 10;
      if (!Number.isFinite(v)) return `${a}bn ${ccy}`;
      const t = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
      return `${t.replace(/\.0+$/, "")}bn ${String(ccy).toUpperCase()}`;
    })
    .replace(/([\d.]+)\s*亿(?!美元)/g, (_, a) => {
      const v = Number(a) / 10;
      if (!Number.isFinite(v)) return `${a}B`;
      const t = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
      return `${t.replace(/\.0+$/, "")}B`;
    })
    .replace(/股东权益约?/g, "")
    .replace(/营收约?/g, "")
    .replace(/BVPS约?/g, "BVPS ~")
    .replace(/Adjusted EBITDA约?/gi, "Adj. EBITDA ~")
    .replace(/量级/g, "")
    .replace(/（对照股东信）/g, " (shareholder letter)")
    .replace(/见10-Q/g, "see 10-Q")
    .replace(/约/g, "~");
  s = s.replace(/[（]/g, "(").replace(/[）]/g, ")").replace(/\s{2,}/g, " ").trim();
  return s || raw;
}
