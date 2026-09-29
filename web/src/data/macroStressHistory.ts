import raw from "./macro-stress-history.json";

export type StressPoint = { d: string; v: number };

export type StressSeries = {
  unit: string;
  source?: string;
  note?: string;
  synthetic?: boolean;
  method?: string;
  levelUsdPerL?: number;
  levelUsdPerKwh?: number;
  points: StressPoint[];
};

export type StressCountry = {
  inflation?: StressSeries;
  policyRate?: StressSeries;
  gasolineRetail?: StressSeries;
  electricityResidential?: StressSeries;
};

export type StressHistoryDataset = {
  meta: {
    asOf: string;
    range: string;
    sample: string;
    note: string;
    sources?: Record<string, string>;
  };
  countries: Record<string, StressCountry>;
};

export const MACRO_STRESS_HISTORY = raw as StressHistoryDataset;

export type StressMetricId =
  | "inflation"
  | "policyRate"
  | "gasolineRetail"
  | "electricityResidential";

export const STRESS_METRIC_META: readonly {
  id: StressMetricId;
  label: string;
  format: (v: number) => string;
}[] = [
  { id: "inflation", label: "通胀", format: (v) => `${v.toFixed(2)}%` },
  { id: "policyRate", label: "政策利率", format: (v) => `${v.toFixed(2)}%` },
  { id: "gasolineRetail", label: "零售汽油", format: (v) => `${v.toFixed(2)} USD/L` },
  { id: "electricityResidential", label: "居民电价", format: (v) => `${v.toFixed(3)} USD/kWh` },
] as const;

export function getStressCountry(code: string): StressCountry | undefined {
  const row = MACRO_STRESS_HISTORY.countries[code];
  if (!row) return undefined;
  return row;
}

export function stressSeriesReady(s?: StressSeries | null): s is StressSeries {
  return !!s && Array.isArray(s.points) && s.points.length >= 2;
}

/** 末端相对起点变动% */
export function stressChgPct(points: StressPoint[]): number {
  if (points.length < 2) return 0;
  const a = points[0]!.v;
  const b = points[points.length - 1]!.v;
  if (!a) return 0;
  return ((b - a) / Math.abs(a)) * 100;
}

export function sliceStressByMonths(points: StressPoint[], months: number | null): StressPoint[] {
  if (!points.length) return [];
  if (months == null || months <= 0) return points;
  const last = points[points.length - 1]!;
  const end = Date.parse(last.d);
  if (!Number.isFinite(end)) return points;
  const startMs = end - months * 30.4375 * 24 * 3600 * 1000;
  let i = 0;
  while (i < points.length - 1) {
    const t = Date.parse(points[i]!.d);
    if (Number.isFinite(t) && t >= startMs) break;
    i += 1;
  }
  const sliced = points.slice(i);
  return sliced.length >= 2 ? sliced : points.slice(-2);
}
