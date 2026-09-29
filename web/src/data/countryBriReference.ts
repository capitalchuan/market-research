import raw from "./countryBriReference.json";
import { citeMark } from "./sourceCitations";
import type { UiLang } from "../uiI18n";

export type BriSeriesRow = {
  id: string;
  labelZh: string;
  labelEn: string;
  unitZh: string;
  unitEn: string;
  values: Record<string, number>;
  noteZh?: string;
  noteEn?: string;
};

export type CountryBriEntry = {
  capitalZh?: string;
  capitalEn?: string;
  gdpUsdM?: { year: number; value: number };
  bilateralZh?: string;
  bilateralEn?: string;
  pillarsZh?: string[];
  pillarsEn?: string[];
  noProfile?: boolean;
  series?: BriSeriesRow[];
};

type BriMeta = {
  portalUrl: string;
  dataChartUrl: string;
  citeNo: number;
  asOf: string;
  noteZh: string;
  noteEn: string;
};

const pack = raw as {
  meta: BriMeta;
  slugs: Record<string, string>;
  countries: Record<string, CountryBriEntry>;
};

export const BRI_META = pack.meta;
export const BRI_SLUG = pack.slugs;
export const COUNTRY_BRI = pack.countries;

export function briCountryProfileUrl(code: string): string | null {
  const entry = COUNTRY_BRI[code];
  if (entry?.noProfile) return null;
  const slug = BRI_SLUG[code];
  if (!slug) return null;
  return `https://www.yidaiyilu.gov.cn/country/${slug}?page=0`;
}

export function getCountryBriReference(code: string): CountryBriEntry | undefined {
  return COUNTRY_BRI[code];
}

function latestSeriesValue(series: BriSeriesRow): { year: string; value: number } | undefined {
  const years = Object.keys(series.values).sort();
  const year = years[years.length - 1];
  if (!year) return undefined;
  return { year, value: series.values[year]! };
}

function findSeries(entry: CountryBriEntry, id: string): BriSeriesRow | undefined {
  return entry.series?.find((s) => s.id === id);
}

/** 地图/宏观卡一行对华贸易摘要（仅有落库序时时返回） */
export function briTradeSummaryLine(code: string, lang: UiLang = "zh"): string | undefined {
  const entry = COUNTRY_BRI[code];
  if (!entry?.series?.length) return undefined;
  const imp = findSeries(entry, "import_from_china");
  const exp = findSeries(entry, "export_to_china");
  const impLt = latestSeriesValue(imp!);
  const expLt = latestSeriesValue(exp!);
  if (!impLt && !expLt) return undefined;
  const cite = citeMark(BRI_META.citeNo);
  const en = lang === "en";
  const fmt = (n: number) => {
    const bnUsd = (n * 10000) / 1e9;
    if (en) return `${bnUsd.toFixed(1)}bn USD`;
    return `${(n / 10000).toFixed(1)}亿美元`;
  };
  const parts: string[] = [];
  if (impLt) {
    parts.push(
      en
        ? `imports from China ${fmt(impLt.value)} (${impLt.year})`
        : `自华进口约${fmt(impLt.value)}（${impLt.year}）`,
    );
  }
  if (expLt) {
    parts.push(
      en
        ? `exports to China ${fmt(expLt.value)} (${expLt.year})`
        : `对华出口约${fmt(expLt.value)}（${expLt.year}）`,
    );
  }
  return `${parts.join(en ? "; " : "；")}${cite}`;
}

export function hasBriReference(code: string): boolean {
  return Boolean(BRI_SLUG[code] || COUNTRY_BRI[code]);
}
