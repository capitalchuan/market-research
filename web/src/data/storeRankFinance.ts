import raw from "./store-rank-finance.json";

/** Google Play / App Store */
export type StoreKind = "gp" | "ios";

/** 固定品类：Finance 借贷（现金贷 / BNPL / 消费贷工具） */
export type StoreRankCategory = "finance_lending";

export type StoreRankSource =
  | "luffy"
  | "sensor_tower"
  | "diandian_note"
  | "diandian_export"
  | "store_manual"
  | "itunes_rss_finance_6015"
  | "other";

export type StoreRankEntry = {
  id: string;
  country: string;
  store: StoreKind;
  category: StoreRankCategory;
  /** 1 = 最好 */
  rank: number;
  appName: string;
  aliases?: string[];
  packageId?: string;
  asOf: string;
  source: StoreRankSource | string;
  note?: string;
  /** 名称/摘要启发式：更像借贷/BNPL（源表仍可能是 Finance 大类） */
  lendingLikely?: boolean;
};

export type StoreRankFinanceFile = {
  meta: {
    title: string;
    category: StoreRankCategory;
    category_zh: string;
    stores: StoreKind[];
    store_default: StoreKind;
    unit: string;
    updated: string;
    note: string;
    fill_rule: string;
    priority_wave1: string[];
    priority_wave2: string[];
    as_of_default: string;
    source_default: string;
  };
  entries: StoreRankEntry[];
};

export const STORE_RANK_FINANCE = raw as StoreRankFinanceFile;

export type StoreRankSortMode = "off" | "asc" | "desc";

const STORE_RANK_SORT_LABEL: Record<StoreRankSortMode, string> = {
  off: "默认顺序",
  asc: "商店榜名次 · 升序（#1 在前）",
  desc: "商店榜名次 · 降序",
};

const STORE_RANK_SORT_LABEL_EN: Record<StoreRankSortMode, string> = {
  off: "Default order",
  asc: "Store rank · ascending (#1 first)",
  desc: "Store rank · descending",
};

export function storeRankSortOptions(lang: "zh" | "en" = "zh"): { value: StoreRankSortMode; label: string }[] {
  const labels = lang === "en" ? STORE_RANK_SORT_LABEL_EN : STORE_RANK_SORT_LABEL;
  return (Object.keys(labels) as StoreRankSortMode[]).map((k) => ({
    value: k,
    label: labels[k],
  }));
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "").replace(/[（(].*$/, "");
}

/**
 * CRM 集团名 → 商店 App 检索别名（提升 iOS Finance 命中）
 * key 为 group 子串；value 写入 lookup 文本
 */
export const CRM_STORE_APP_ALIASES: { match: string; apps: string[] }[] = [
  { match: "Akulaku", apps: ["Akulaku", "AkuLaku"] },
  { match: "Kredivo", apps: ["Kredivo"] },
  { match: "FinAccel", apps: ["Kredivo"] },
  { match: "Maya", apps: ["Maya"] },
  { match: "Paytm", apps: ["Paytm"] },
  { match: "One97", apps: ["Paytm"] },
  { match: "KreditBee", apps: ["KreditBee"] },
  { match: "GoTo", apps: ["GoPay", "GoPay Later"] },
  { match: "Gojek", apps: ["GoPay"] },
  { match: "Shopee", apps: ["ShopeePay", "SeaBank", "MariBank"] },
  { match: "Sea Limited", apps: ["ShopeePay", "SeaBank", "MariBank"] },
  { match: "Grab", apps: ["Grab", "GrabFinance"] },
  { match: "Home Credit", apps: ["Home Credit"] },
  { match: "Tala", apps: ["Tala"] },
  { match: "Branch", apps: ["Branch"] },
  { match: "FinVolution", apps: ["BantuSaku", "Cashalo"] },
  { match: "信也", apps: ["BantuSaku", "Cashalo"] },
  { match: "mPokket", apps: ["mPokket"] },
  { match: "Moneyview", apps: ["Moneyview"] },
  { match: "Bajaj", apps: ["Bajaj Finance"] },
  { match: "Navi", apps: ["Navi"] },
  { match: "PhonePe", apps: ["PhonePe"] },
  { match: "GCash", apps: ["GCash"] },
  { match: "Billease", apps: ["Billease"] },
  { match: "Kueski", apps: ["Kueski"] },
  { match: "Klar", apps: ["Klar"] },
  { match: "DiDi", apps: ["DiDi Finanzas"] },
  { match: "Mercado", apps: ["Mercado Pago"] },
  { match: "Nu ", apps: ["Nu"] },
  { match: "Nubank", apps: ["Nu"] },
  { match: "OVO", apps: ["OVO"] },
  { match: "DANA", apps: ["DANA"] },
  { match: "AdaKami", apps: ["AdaKami"] },
  { match: "PinjamDong", apps: ["PinjamDong"] },
];

/** 把 CRM 别名拼进商店榜检索文本 */
export function withStoreAppAliases(group: string, text: string): string {
  const extra: string[] = [];
  for (const row of CRM_STORE_APP_ALIASES) {
    if (group.includes(row.match) || text.includes(row.match)) {
      extra.push(...row.apps);
    }
  }
  return extra.length ? `${text} ${extra.join(" ")}` : text;
}

/** 用 group / brands / app 名在指定国+店下找最佳（最小）名次 */
export function lookupStoreRank(opts: {
  country: string;
  store?: StoreKind;
  text: string;
  group?: string;
}): { rank: number; entry: StoreRankEntry } | null {
  const store = opts.store ?? STORE_RANK_FINANCE.meta.store_default;
  const country = opts.country;
  if (!country || country === "all") return null;
  const blob = norm(withStoreAppAliases(opts.group ?? "", opts.text));
  if (!blob) return null;

  let best: { rank: number; entry: StoreRankEntry } | null = null;
  for (const e of STORE_RANK_FINANCE.entries) {
    if (e.country !== country || e.store !== store || e.category !== "finance_lending") continue;
    const names = [e.appName, ...(e.aliases ?? [])].map(norm).filter(Boolean);
    const hit = names.some((n) => n.length >= 2 && (blob.includes(n) || n.includes(blob.slice(0, 24))));
    if (!hit) continue;
    if (!best || e.rank < best.rank) best = { rank: e.rank, entry: e };
  }
  return best;
}

export function storeRankSortKey(
  country: string,
  text: string,
  store: StoreKind = STORE_RANK_FINANCE.meta.store_default,
  group?: string,
): number {
  const hit = lookupStoreRank({ country, store, text, group });
  // 无命中排最后
  return hit ? hit.rank : 1_000_000;
}

export function compareByStoreRank(
  country: string,
  aText: string,
  bText: string,
  mode: StoreRankSortMode,
  store: StoreKind = STORE_RANK_FINANCE.meta.store_default,
  aGroup?: string,
  bGroup?: string,
): number {
  if (mode === "off" || country === "all") return 0;
  const ka = storeRankSortKey(country, aText, store, aGroup);
  const kb = storeRankSortKey(country, bText, store, bGroup);
  if (ka === kb) return 0;
  return mode === "asc" ? ka - kb : kb - ka;
}

export function countRanksForCountry(country: string, store?: StoreKind): number {
  const s = store ?? STORE_RANK_FINANCE.meta.store_default;
  return STORE_RANK_FINANCE.entries.filter(
    (e) => e.country === country && e.store === s && e.category === "finance_lending",
  ).length;
}
