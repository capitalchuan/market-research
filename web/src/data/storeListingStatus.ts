import raw from "./store-listing-status.json";
import watchRaw from "./store-listing-watchlist.json";

export type StoreListingKind = "ios" | "gp";
export type StoreListingTier = "invested" | "peer" | "incumbent" | "counterfeit";
export type StoreListingState = "live" | "gone" | "unknown";

export type StoreWatchApp = {
  id: string;
  name: string;
  nameZh: string;
  group?: string;
  producerId?: string;
  country: string;
  nameZhCountry?: string;
  tier: StoreListingTier | string;
  iosId?: string;
  gpId?: string;
  storeCountry?: string;
  match?: string[];
  note?: string;
};

export type StoreListingRow = {
  id: string;
  appId: string;
  name?: string;
  nameZh: string;
  group?: string;
  producerId?: string;
  country: string;
  nameZhCountry?: string;
  tier: StoreListingTier | string;
  store: StoreListingKind;
  iosId?: string | null;
  gpId?: string | null;
  status: StoreListingState;
  http?: number;
  storeUrl?: string;
  trackName?: string | null;
  detail?: string;
  checkedAt?: string;
  match?: string[];
};

export type StoreListingEvent = {
  id: string;
  topic: "store";
  appId: string;
  nameZh: string;
  group?: string;
  producerId?: string;
  country: string;
  nameZhCountry?: string;
  store: StoreListingKind;
  from: StoreListingState;
  to: StoreListingState;
  severity: "alert" | "watch" | "notice" | "info" | string;
  published?: string;
  checkedAt?: string;
  title: string;
  titleEn?: string;
  what?: string;
  how?: string;
  result?: string;
  cashLoanHint?: string;
  url?: string;
  source?: string;
};

export type StoreListingStatusFile = {
  source: string;
  generatedAt: string;
  displayDate: string;
  note?: string;
  stats: {
    appCount: number;
    listingCount: number;
    live: number;
    gone: number;
    unknown: number;
    flips: number;
    eventTotal: number;
    byCountry?: Record<string, number>;
  };
  listings: StoreListingRow[];
  events: StoreListingEvent[];
};

export const STORE_LISTING_WATCHLIST = watchRaw as { meta?: { note?: string }; apps: StoreWatchApp[] };
export const STORE_LISTING_STATUS = raw as StoreListingStatusFile;

const FLASH_DAYS = 21;

function eventDay(e: StoreListingEvent): string {
  return (e.published || e.checkedAt || "").slice(0, 10);
}

/** 晨报快讯：最近窗口内的在架翻转（下架优先） */
export function storeListingFlashEvents(days = FLASH_DAYS): StoreListingEvent[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cut = cutoff.toISOString().slice(0, 10);
  return (STORE_LISTING_STATUS.events || [])
    .filter((e) => eventDay(e) >= cut)
    .sort((a, b) => (eventDay(b) + (b.published || "")).localeCompare(eventDay(a) + (a.published || "")));
}

export function storeDelistCountForCountry(code?: string, days = FLASH_DAYS): number {
  if (!code) return 0;
  return storeListingFlashEvents(days).filter((e) => e.country === code && e.to === "gone").length;
}

export function storeGoneCountForCountry(code?: string): number {
  if (!code) return 0;
  return (STORE_LISTING_STATUS.listings || []).filter((x) => x.country === code && x.status === "gone").length;
}

function norm(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, "");
}

/** 已投卡：按生产商名 / producerId 挂靠当前在架状态 */
export function listingsForProducer(producerName: string, country?: string): StoreListingRow[] {
  const n = norm(producerName);
  const rows = STORE_LISTING_STATUS.listings || [];
  return rows.filter((row) => {
    if (country && row.country !== country) return false;
    if (row.producerId && producerName.includes(row.producerId)) return true;
    const keys = [row.producerId, row.group, row.nameZh, row.name, ...(row.match || [])].filter(Boolean) as string[];
    return keys.some((k) => {
      const kn = norm(k);
      return kn && (n.includes(kn) || kn.includes(n) || n.includes(norm(k.split(/[|/]/)[0] || "")));
    });
  });
}

export function listingStatusLabel(status: StoreListingState, lang: "zh" | "en" = "zh"): string {
  if (lang === "en") {
    if (status === "live") return "listed";
    if (status === "gone") return "delisted";
    return "unknown";
  }
  if (status === "live") return "在架";
  if (status === "gone") return "下架";
  return "未知";
}

export function storeKindLabel(store: StoreListingKind, lang: "zh" | "en" = "zh"): string {
  if (store === "ios") return "iOS";
  return lang === "en" ? "Play" : "GP";
}

export function formatProducerListingLine(rows: StoreListingRow[], lang: "zh" | "en" = "zh"): string {
  if (!rows.length) return "";
  return rows
    .map((r) => `${storeKindLabel(r.store, lang)} ${listingStatusLabel(r.status, lang)}`)
    .join(" · ");
}
