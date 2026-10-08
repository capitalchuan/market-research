/**
 * 标的按公司、按展业国收成一张卡。
 * 优先名单、玩家、行情、商店、财报、已投是发现渠道，不是五张卡。
 * 只挂库里已有的读数；没打开的牌照、没拆到本国的空缺、Android 榜都不补。
 */
import { creditPlayersIn } from "./cashloanCreditPlayers";
import { LICENSE_CREDIT_PRIORITY, type LicenseCreditEntry } from "./countryLicenseCreditPriority";
import { FINTECH_STOCK_QUOTES, type FintechStockQuote } from "./fintechStockQuotes";
import { LISTED_PLAYER_DISCLOSURE, type ListedPlayerDisclosure } from "./listedPlayerDisclosure";
import { formatUsdZh, PRODUCER_HOLDINGS, type HoldingProducer } from "./producerHoldings";
import { STORE_RANK_FINANCE, type StoreRankEntry } from "./storeRankFinance";

export type CompanyChannel = "roster" | "listed" | "store" | "players" | "invested";

export type CompanyFact = {
  text: string;
  source: string;
};

export type IosStoreRank = {
  appName: string;
  rank: number;
  asOf: string;
  source: string;
};

export type CompanyCard = {
  id: string;
  country: string;
  name: string;
  identity: string;
  license: CompanyFact[];
  scale: CompanyFact[];
  quality: CompanyFact[];
  filing: CompanyFact[];
  listing: CompanyFact | null;
  book: CompanyFact[];
  iosRanks: IosStoreRank[];
  channels: CompanyChannel[];
  priority: number | null;
  investedId: string | null;
};

const CHANNEL_ORDER: CompanyChannel[] = ["invested", "roster", "listed", "store", "players"];

/** 同一集团在不同名册里的写法。只收已经在名册或持仓里成对出现过的名字。 */
const ALIAS_GROUPS = [
  ["akulaku", "阿卡拉克"],
  ["finvolution", "信也", "adakami"],
  ["jiayin", "嘉银", "samir"],
  ["快牛", "kn", "mexicash"],
  ["surfin", "payrupik"],
  ["cubix", "docking", "bandusaku"],
  ["lexin", "乐信", "分期乐"],
];

/** 拆开写进别名会把不同公司并到一起的普通词。作为整段名字时仍然保留。 */
const GENERIC = new Set([
  "dana", "pinjam", "pinjaman", "uang", "paylater", "loans", "loan", "online", "kredit",
  "rupiah", "cepat", "daring", "commerce", "credit", "cash", "money", "modal",
  "instant", "personal", "upi", "payments", "payment", "insurance", "secure", "mutual",
  "daily", "shop", "score", "balance", "true", "banking", "stocks", "fund", "funds",
  "card", "cards", "bills", "save", "manage", "lifestyle", "fd",
]);

const STOP = new Set([
  "银行", "支付", "信用", "金融", "数字", "现金", "分期", "消费", "科技", "集团", "控股", "国际",
  "公司", "有限", "线上", "信贷", "个人", "现金贷", "商户", "钱包", "借款", "多金融",
  "p2p", "lpbbti", "bnpl", "nbfc", "emi", "oilp", "svf", "bank", "pay", "loan", "cash", "credit",
  "finance", "app", "digital", "services", "service", "holdings", "group", "capital", "investment",
  "investments", "limited", "company", "international", "global", "online", "mobile", "tech",
  "lending", "corp", "holdco", "cayman", "meta", "technology", "street", "corner",
  "singapore", "india", "indonesia", "philippines", "mexico", "thailand",
  "bsp数字银行", "pdic投保", "wallet", "savings",
]);

const QUOTE_ORIGINS = new Set(["credit-native", "bnpl", "digibank"]);

type Seed = {
  name: string;
  rank: number;
  aliases: string[];
  legal: string[];
  lines: string[];
  role: string | null;
  license: CompanyFact[];
  scale: CompanyFact[];
  quality: CompanyFact[];
  filing: CompanyFact[];
  listing: CompanyFact | null;
  listingSymbol: string | null;
  book: CompanyFact[];
  iosRanks: IosStoreRank[];
  channels: CompanyChannel[];
  priority: number | null;
  investedId: string | null;
};

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

function usableAlias(raw: string, fromName: boolean): string | null {
  const t = norm(raw).replace(/^[（(]+|[）)]+$/g, "").replace(/[:：,，.&]+$/g, "");
  if (!t || STOP.has(t) || /^\d+$/.test(t)) return null;
  if (/^[\u4e00-\u9fff]{2,12}$/.test(t)) return t;
  if (fromName && /^[a-z0-9]{2,3}$/.test(t)) return t;
  if (/[a-z]/.test(t) && t.length >= 4 && t.length <= 32) return t;
  return null;
}

function expandGroups(aliases: string[]): string[] {
  const set = new Set(aliases);
  for (const group of ALIAS_GROUPS) {
    if (group.some((g) => set.has(g))) {
      for (const g of group) set.add(g);
    }
  }
  return [...set];
}

function tokensOf(raw: string, fromName: boolean): string[] {
  const stripped = raw.replace(/·[A-Za-z]{2,8}/g, "");
  const parts = stripped.split(/[/｜·|,，;；()（）\-\s]+/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  if (parts.length >= 2) {
    const joined = norm(parts.join(""));
    if (joined.length >= 6 && joined.length <= 40) out.push(joined);
  }
  for (const part of parts) {
    if (parts.length > 1 && GENERIC.has(norm(part))) continue;
    // 两三个字母只在整段名字就是它时才算别名（KN）。拆出来的 by、UPI、FD 会把榜上邻居并成一家。
    const alias = usableAlias(part, fromName && parts.length === 1);
    if (alias) out.push(alias);
  }
  return expandGroups(out);
}

function isLegal(s: string): boolean {
  return /PT |Pte\.?|Ltd|Limited|Pvt|LLC|\bInc\b|Corp|NBFC|Holdco|公司|有限|SPV/.test(s);
}

function splitExtra(extra: string): { aliases: string[]; legal: string[] } {
  const aliases: string[] = [];
  const legal: string[] = [];
  for (const part of extra.split(/[;；/／]+/).map((s) => s.trim()).filter(Boolean)) {
    if (isLegal(part)) legal.push(part);
    else aliases.push(...tokensOf(part, false));
  }
  return { aliases, legal };
}

function shortSource(s: string): string {
  const head = s.split(/[；;]/)[0]?.trim() || s;
  return head.length > 42 ? `${head.slice(0, 42)}…` : head;
}

function aliasHit(a: string, b: string): boolean {
  return a === b;
}

function seedsTouch(a: Seed, b: Seed): boolean {
  return a.aliases.some((x) => b.aliases.includes(x));
}

function listingFact(it: FintechStockQuote): CompanyFact {
  const move =
    it.changePct != null ? ` ${it.changePct > 0 ? "+" : ""}${it.changePct.toFixed(1)}%` : "";
  const px = it.price != null ? `${it.currency ?? ""} ${it.price}${move}`.trim() : "无报价";
  const cap = it.marketCapLabel ? ` · 市值 ${it.marketCapLabel}` : "";
  const pe = it.peRatio != null ? ` · 市盈率 ${it.peRatio.toFixed(1)}` : "";
  return {
    text: `${it.symbol}${it.exchange ? ` · ${it.exchange}` : ""} · ${px}${cap}${pe}`,
    source: it.quoteNote ?? `行情 ${it.asOf || FINTECH_STOCK_QUOTES.asOf}`,
  };
}

function tickerKey(symbol: string | undefined): string {
  return (symbol || "").split("/")[0]?.split(".")[0]?.trim().toUpperCase() || "";
}

function gapNote(text: string): boolean {
  return /待补|待与|未找到|未给出|缺口|暂缺/.test(text);
}

function pushFact(list: CompanyFact[], fact: CompanyFact | null) {
  if (!fact || !fact.text.trim()) return;
  if (list.some((f) => f.text === fact.text)) return;
  list.push(fact);
}

function blankSeed(name: string, rank: number, aliases: string[]): Seed {
  return {
    name,
    rank,
    aliases: expandGroups(aliases),
    legal: [],
    lines: [],
    role: null,
    license: [],
    scale: [],
    quality: [],
    filing: [],
    listing: null,
    listingSymbol: null,
    book: [],
    iosRanks: [],
    channels: [],
    priority: null,
    investedId: null,
  };
}

function addChannel(seed: Seed, channel: CompanyChannel) {
  if (!seed.channels.includes(channel)) seed.channels.push(channel);
}

function rosterSeeds(code: string): Seed[] {
  const asOf = LICENSE_CREDIT_PRIORITY.asOf;
  return LICENSE_CREDIT_PRIORITY.entries
    .filter((e) => e.market === code && e.crmStatus !== "rail")
    .map((e) => seedFromRoster(e, asOf));
}

function seedFromRoster(e: LicenseCreditEntry, asOf: string): Seed {
  const aliases = tokensOf(`${e.nameZh} ${e.groupKey ?? ""}`, true);
  const seed = blankSeed(e.nameZh, 4, aliases);
  addChannel(seed, "roster");
  seed.priority = e.priority ?? null;
  if (e.track === "online_credit") seed.role = "放贷主体";
  else if (e.track === "digibank") seed.role = "数字银行";
  else if (e.track === "payment") seed.role = "支付，名录写了信贷产品";
  if (e.onlineCredit) seed.lines.push(e.onlineCredit);
  if (e.licenseNote) {
    seed.license.push({ text: e.licenseNote, source: `优先名单 ${asOf}` });
  }
  return seed;
}

function playerSeeds(code: string): Seed[] {
  return creditPlayersIn(code).map((p) => {
    const extra = splitExtra(p.extra || "");
    const seed = blankSeed(p.name, 3, [...tokensOf(p.name, true), ...extra.aliases]);
    addChannel(seed, "players");
    seed.legal.push(...extra.legal);
    if (p.lines) seed.lines.push(p.lines);
    seed.role = "放贷主体";
    return seed;
  });
}

function quoteSeeds(code: string): { seeds: Seed[]; rest: { aliases: string[]; symbol: string; fact: CompanyFact }[] } {
  const seeds: Seed[] = [];
  const rest: { aliases: string[]; symbol: string; fact: CompanyFact }[] = [];
  for (const it of FINTECH_STOCK_QUOTES.items) {
    const inMarket = it.country === code || it.markets?.includes(code);
    const aliases = tokensOf(`${it.nameZh} ${it.symbol} ${it.groupKey ?? ""}`, true);
    const fact = listingFact(it);
    const symbol = tickerKey(it.symbol);
    if (inMarket && it.origin && QUOTE_ORIGINS.has(it.origin)) {
      const seed = blankSeed(it.nameZh, 2, aliases);
      addChannel(seed, "listed");
      seed.listing = fact;
      seed.listingSymbol = symbol;
      if (!seed.role) seed.role = "上市信贷公司，当地牌照未在这张卡上核过";
      seeds.push(seed);
    } else {
      rest.push({ aliases, symbol, fact });
    }
  }
  return { seeds, rest };
}

function storeSeeds(code: string): { seeds: Seed[]; rest: { aliases: string[]; rank: IosStoreRank }[] } {
  const seeds: Seed[] = [];
  const rest: { aliases: string[]; rank: IosStoreRank }[] = [];
  for (const app of STORE_RANK_FINANCE.entries) {
    if (app.country !== code || app.store !== "ios" || app.rank > 20) continue;
    const aliases = storeNameAliases(app);
    const rank = iosRank(app);
    if (app.lendingLikely) {
      const seed = blankSeed(app.appName, 1, aliases);
      addChannel(seed, "store");
      seed.role = "商店应用，牌照未核";
      seed.iosRanks.push(rank);
      seeds.push(seed);
    } else {
      rest.push({ aliases, rank });
    }
  }
  return { seeds, rest };
}

/** 商店榜只认短名。副标题里的 UPI、Instant、Personal 是榜上用词，不是公司别名。 */
function storeNameAliases(app: StoreRankEntry): string[] {
  const short =
    (app.aliases ?? []).find((name) => name !== app.appName && !/[:：|,，]/.test(name)) ??
    app.appName.split(/[:：|]/)[0]?.trim() ??
    app.appName;
  return tokensOf(short, true);
}

function iosRank(app: StoreRankEntry): IosStoreRank {
  return {
    appName: app.appName,
    rank: app.rank,
    asOf: app.asOf,
    source: app.source === "itunes_rss_finance_6015" ? "iTunes RSS Finance" : app.source,
  };
}

function pushIosRank(list: IosStoreRank[], rank: IosStoreRank) {
  if (list.some((item) => item.appName === rank.appName && item.rank === rank.rank)) return;
  list.push(rank);
  list.sort((a, b) => a.rank - b.rank);
}

function investedSeeds(code: string): Seed[] {
  const slice = PRODUCER_HOLDINGS.countries.find((c) => c.country_code === code);
  if (!slice) return [];
  const out: Seed[] = [];
  for (const row of slice.producers) {
    const producer = PRODUCER_HOLDINGS.producers.find((p) => p.id === row.id);
    if (!producer) continue;
    out.push(seedFromHolding(code, producer, row.investment_usd, row.outstanding_usd, row.outstanding_note, row.customers, row.customers_note, row.license_note, row.yield_note));
  }
  return out;
}

function seedFromHolding(
  code: string,
  producer: HoldingProducer,
  investment: number,
  outstanding: number | null,
  outstandingNote: string | null,
  customers: number | null,
  customersNote: string | null,
  licenseNote: string | null,
  yieldNote: string | null,
): Seed {
  const extra = splitExtra(producer.entity || "");
  const seed = blankSeed(producer.name, 5, [...tokensOf(producer.name, true), ...extra.aliases]);
  addChannel(seed, "invested");
  seed.investedId = producer.id;
  seed.legal.push(...extra.legal);
  seed.role = "放贷主体";
  if (producer.product_type) seed.lines.push(producer.product_type);
  const source = shortSource(producer.sources || `已投 ${PRODUCER_HOLDINGS.as_of}`);
  const license = licenseNote || "";
  if (license && !gapNote(license)) seed.license.push({ text: license, source });
  if (outstanding != null && outstandingNote && !/该国分项在贷待补/.test(outstandingNote)) {
    seed.scale.push({ text: outstandingNote, source });
  }
  if (customers != null && customersNote && !gapNote(customersNote)) {
    seed.scale.push({ text: customersNote, source });
  }
  if (Number.isFinite(investment)) {
    seed.book.push({ text: `本基金投资 ${formatUsdZh(investment)}`, source: `已投 ${PRODUCER_HOLDINGS.as_of}` });
  }
  if (yieldNote && yieldNote !== "-" && outstanding != null) {
    seed.book.push({ text: yieldNote, source });
  }
  void code;
  return seed;
}

function filingFacts(cardAliases: string[], country: string): { scale: CompanyFact[]; quality: CompanyFact[]; filing: CompanyFact[] } {
  const scale: CompanyFact[] = [];
  const quality: CompanyFact[] = [];
  const filing: CompanyFact[] = [];
  for (const p of LISTED_PLAYER_DISCLOSURE.players) {
    if (p.status !== "filled" || !p.kpis.length) continue;
    if (!p.countries?.includes(country)) continue;
    const aliases = tokensOf(`${p.nameZh} ${p.ticker} ${p.groupKeys.join(" ")}`, true);
    if (!aliases.some((a) => cardAliases.some((b) => aliasHit(a, b)))) continue;
    for (const kpi of p.kpis) {
      const fact = kpiFact(p, kpi.label, kpi.value, kpi.yoy, country);
      if (!fact) continue;
      const slot = /逾期|不良|NPL|DPD/i.test(kpi.label)
        ? quality
        : /净利|净收入|收入|利润|GMV/.test(kpi.label)
          ? filing
          : scale;
      pushFact(slot, fact);
    }
  }
  return { scale, quality, filing };
}

function kpiFact(
  p: ListedPlayerDisclosure,
  label: string,
  value: string,
  yoy: string | undefined,
  country: string,
): CompanyFact | null {
  const countries = p.countries ?? [];
  const scoped = p.kpis.some((kpi) => /国内|海外/.test(kpi.label));
  let caveat = "";
  if (/国内/.test(label)) {
    if (country !== "CN") return null;
  } else if (/海外/.test(label)) {
    if (country === "CN" || !countries.includes(country)) return null;
    caveat = "，集团海外合计，未拆到本国";
  } else if (scoped && country !== "CN") {
    return null;
  } else if (!(countries.length === 1 && countries[0] === country)) {
    caveat = "，集团披露，未拆到本国";
  }
  const yoyText = yoy ? `，同比 ${yoy}` : "";
  return {
    text: `${label} ${value}${yoyText}${caveat}`,
    source: `财报 ${p.period ?? ""}${p.sourceNote ? ` · ${p.sourceNote}` : ""}`.trim(),
  };
}

function mergeSeeds(group: Seed[]): Seed {
  const best = [...group].sort((a, b) => b.rank - a.rank || b.name.length - a.name.length)[0]!;
  const seed = blankSeed(best.name, best.rank, group.flatMap((g) => g.aliases));
  seed.investedId = group.find((g) => g.investedId)?.investedId ?? null;
  const priorities = group.map((g) => g.priority).filter((n): n is number => n != null);
  seed.priority = priorities.length ? Math.min(...priorities) : null;
  for (const g of group) {
    for (const ch of g.channels) addChannel(seed, ch);
    seed.legal.push(...g.legal);
    seed.lines.push(...g.lines);
    if (!seed.role && g.role) seed.role = g.role;
    if (g.role === "放贷主体") seed.role = "放贷主体";
    for (const fact of g.license) pushFact(seed.license, fact);
    for (const fact of g.scale) pushFact(seed.scale, fact);
    for (const fact of g.quality) pushFact(seed.quality, fact);
    for (const fact of g.filing) pushFact(seed.filing, fact);
    for (const fact of g.book) pushFact(seed.book, fact);
    for (const rank of g.iosRanks) pushIosRank(seed.iosRanks, rank);
    if (g.listing && !seed.listing) {
      seed.listing = g.listing;
      seed.listingSymbol = g.listingSymbol;
    }
  }
  return seed;
}

function attachListing(seed: Seed, aliases: string[], symbol: string, fact: CompanyFact) {
  if (seed.listingSymbol && seed.listingSymbol === symbol) return;
  if (!aliases.some((a) => seed.aliases.some((b) => aliasHit(a, b)))) return;
  if (!seed.listing) {
    seed.listing = fact;
    seed.listingSymbol = symbol;
    addChannel(seed, "listed");
  }
}

function toCard(seed: Seed, country: string): CompanyCard {
  const filings = filingFacts(seed.aliases, country);
  for (const fact of filings.scale) pushFact(seed.scale, fact);
  for (const fact of filings.quality) pushFact(seed.quality, fact);
  for (const fact of filings.filing) pushFact(seed.filing, fact);
  const display = norm(seed.name);
  const aka = [...new Set(seed.aliases.filter((a) => {
    if (display.includes(a) || GENERIC.has(a) || STOP.has(a)) return false;
    if (/^[\u4e00-\u9fff]{2,4}$/.test(a)) return true;
    if (!/^[a-z][a-z0-9]{4,16}$/.test(a)) return false;
    return !seed.aliases.some((other) => other !== a && other.length >= 4 && a.includes(other));
  }))].slice(0, 3);
  const lineSet = [...new Set(seed.lines.map((l) => l.trim()).filter(Boolean))];
  const lines = lineSet.filter((line) => !lineSet.some((other) => other !== line && other.includes(line)));
  const legalUnique = [...new Set(seed.legal)];
  const legal = legalUnique.find((s) => /PT |Pvt|NBFC/.test(s)) ?? legalUnique[0];
  const identity = [lines.join(" / "), seed.role, aka.length ? `也称 ${aka.join("、")}` : "", legal ?? ""]
    .filter(Boolean)
    .join(" · ");
  const channels = CHANNEL_ORDER.filter((ch) => seed.channels.includes(ch));
  return {
    id: `${country}:${seed.investedId ?? seed.name}`,
    country,
    name: seed.name,
    identity,
    license: seed.license,
    scale: seed.scale,
    quality: seed.quality,
    filing: seed.filing,
    listing: seed.listing,
    book: seed.book,
    iosRanks: seed.iosRanks,
    channels,
    priority: seed.priority,
    investedId: seed.investedId,
  };
}

const cache = new Map<string, CompanyCard[]>();

export function companiesIn(code: string): CompanyCard[] {
  const hit = cache.get(code);
  if (hit) return hit;
  const cards = buildCountry(code);
  cache.set(code, cards);
  return cards;
}

function buildCountry(code: string): CompanyCard[] {
  const quotes = quoteSeeds(code);
  const stores = storeSeeds(code);
  const seeds = [
    ...investedSeeds(code),
    ...rosterSeeds(code),
    ...playerSeeds(code),
    ...quotes.seeds,
    ...stores.seeds,
  ];
  const parent = seeds.map((_, i) => i);
  const find = (x: number): number => {
    let root = x;
    while (parent[root] !== root) root = parent[root]!;
    while (parent[x] !== root) {
      const next = parent[x]!;
      parent[x] = root;
      x = next;
    }
    return root;
  };
  for (let i = 0; i < seeds.length; i += 1) {
    for (let j = i + 1; j < seeds.length; j += 1) {
      if (seedsTouch(seeds[i]!, seeds[j]!)) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, Seed[]>();
  for (let i = 0; i < seeds.length; i += 1) {
    const root = find(i);
    const list = groups.get(root) ?? [];
    list.push(seeds[i]!);
    groups.set(root, list);
  }
  const merged = [...groups.values()].map(mergeSeeds);
  for (const seed of merged) {
    for (const quote of quotes.rest) attachListing(seed, quote.aliases, quote.symbol, quote.fact);
    for (const app of stores.rest) {
      if (!app.aliases.some((a) => seed.aliases.some((b) => aliasHit(a, b)))) continue;
      addChannel(seed, "store");
      pushIosRank(seed.iosRanks, app.rank);
    }
    if (seed.priority != null) {
      pushFact(seed.book, { text: `优先名单第 ${seed.priority} 优先`, source: `优先名单 ${LICENSE_CREDIT_PRIORITY.asOf}` });
    }
  }
  return merged
    .map((seed) => toCard(seed, code))
    .sort((a, b) => {
      const invested = Number(b.investedId != null) - Number(a.investedId != null);
      if (invested !== 0) return invested;
      const pa = a.priority ?? 9;
      const pb = b.priority ?? 9;
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name, "zh");
    });
}

export const COMPANY_TAG_ORDER: CompanyChannel[] = ["invested", "roster", "listed", "players"];

export const COMPANY_CHANNEL_LABEL: Record<CompanyChannel, string> = {
  invested: "已投",
  roster: "优先名单",
  listed: "上市公司",
  store: "商店",
  players: "玩家",
};
