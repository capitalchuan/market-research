import { COUNTRY_MACRO, deriveNevTaxGap, type CountryMacroSnap } from "./countryMacro";
import {
  fxLocalStrengthChgPct,
  resolveFxSeries,
  sliceFxPointsByMonths,
} from "./fxHistory";

/** 大屏可切换的宏观色阶因子（与 CRM 宏观五组对齐的可量化子集） */
export type MacroMapFactorId =
  | "hhDebt"
  | "fxVol"
  | "fxChg"
  | "gdpPc"
  | "incomePc"
  | "inflation"
  | "policyRate"
  | "unemployment"
  | "gasoline"
  | "electricity"
  | "fuelToPower"
  | "nevTariff"
  | "nevVat"
  | "nevTaxGap";

export const MACRO_MAP_FACTORS: {
  id: MacroMapFactorId;
  label: string;
  labelEn: string;
  unit: string;
  /** 色阶方向：high_risk=越高越深（风险向）；high_capacity=越高越深（容量向） */
  sense: "high_risk" | "high_capacity";
  /**
   * 色阶映射：linear=全局 min→max；
   * diverging0=以 0 为中轴，负/正各自归一（负值不再被大额正值压扁）
   */
  scale?: "linear" | "diverging0";
  /** diverging0 负侧色：green=税差「进口轻」；cool=通胀通缩等 */
  divergeNegTone?: "green" | "cool";
  /** diverging0 图例文案 */
  divergeLegend?: { neg: string; pos: string };
  divergeLegendEn?: { neg: string; pos: string };
  /** 宏观卡字段；派生指标可空 */
  field: keyof CountryMacroSnap | null;
  blurb: string;
}[] = [
  {
    id: "hhDebt",
    label: "居民杠杆",
    labelEn: "Household leverage",
    unit: "% GDP",
    sense: "high_risk",
    field: "householdDebtToGdp",
    blurb: "家庭债务/GDP · 信贷过热组 · 信源侧重 IMF FAS / BIS",
  },
  {
    id: "fxVol",
    label: "年内汇率波幅",
    labelEn: "FX volatility (1Y)",
    unit: "",
    sense: "high_risk",
    field: "fxVolInYear",
    blurb: "约一年内高低相对均价（波幅，非累计贬值）· 外汇跨境组 · Frankfurter 等市价序列",
  },
  {
    id: "fxChg",
    label: "年内汇率涨跌",
    labelEn: "FX change (1Y)",
    unit: "%",
    sense: "high_risk",
    scale: "diverging0",
    divergeNegTone: "cool",
    divergeLegend: { neg: "负 · 本币升值", pos: "正 · 本币贬值" },
    divergeLegendEn: { neg: "Local FX stronger", pos: "Local FX weaker" },
    field: null,
    blurb:
      "近1年本币对美元强弱（地图：蓝=升值、琥珀=贬值；数值为正表示本币贬值）· 外汇跨境组 · 市价序列首末",
  },
  {
    id: "gdpPc",
    label: "人均GDP",
    labelEn: "GDP per capita",
    unit: "USD",
    sense: "high_capacity",
    field: "gdpPerCapitaUsd",
    blurb: "现价人均GDP · 基本面组 · 信源侧重世行 / IMF",
  },
  {
    id: "incomePc",
    label: "人均收入",
    labelEn: "Income per capita",
    unit: "USD PPP",
    sense: "high_capacity",
    field: "incomePerCapita",
    blurb: "GNI/人 PPP（库内多数世行·OWID；少数 TE PPP）· 非住户可支配收入 · 基本面组〔10〕〔15〕",
  },
  {
    id: "inflation",
    label: "通胀",
    labelEn: "Inflation",
    unit: "%",
    sense: "high_risk",
    scale: "diverging0",
    divergeNegTone: "cool",
    divergeLegend: { neg: "负 · 通缩", pos: "正 · 通胀" },
    divergeLegendEn: { neg: "Neg · deflation", pos: "Pos · inflation" },
    field: "inflation",
    blurb:
      "最新通胀读数 · 地图以 0 分轴：蓝=通缩、琥珀=通胀；两侧各自拉满色阶 · TE / 统计局对照",
  },
  {
    id: "policyRate",
    label: "政策利率",
    labelEn: "Policy rate",
    unit: "%",
    sense: "high_risk",
    field: "policyRate",
    blurb: "政策利率 · 外汇/定价组 · 央行 / TE",
  },
  {
    id: "unemployment",
    label: "失业率",
    labelEn: "Unemployment",
    unit: "%",
    sense: "high_risk",
    field: "unemployment",
    blurb: "官方失业率（取首个%）· 人口就业组 · 信源侧重世行 / ILO",
  },
  {
    id: "gasoline",
    label: "零售汽油",
    labelEn: "Retail gasoline",
    unit: "USD/升",
    sense: "high_risk",
    field: "gasolineRetail",
    blurb: "泵价 USD/升 · 基本面/生活成本 · TE Gasoline Prices〔1〕",
  },
  {
    id: "electricity",
    label: "居民电价",
    labelEn: "Residential power",
    unit: "USD/kWh",
    sense: "high_risk",
    field: "electricityResidential",
    blurb: "居民用电含税 USD/kWh · 基本面/生活成本 · GlobalPetrolPrices〔22〕",
  },
  {
    id: "fuelToPower",
    label: "油电比",
    labelEn: "Fuel / power",
    unit: "×",
    sense: "high_risk",
    field: "fuelToPowerRatio",
    blurb: "零售汽油÷居民电价 · 1升汽油约可购居民电kWh数 · 越高燃油相对电费越贵 · TE÷GPP〔1〕〔22〕",
  },
  {
    id: "nevTariff",
    label: "新能源整车进口关税",
    labelEn: "NEV import tariff",
    unit: "%",
    sense: "high_risk",
    field: "nevImportTariff",
    blurb:
      "新能源整车 HS8703（BEV/CBU）进口关税（含对华附加税合计示意；CKD/电池/电机见国别卡 HS 分列）· 基建监管/产业政策 · 海关税则〔24〕",
  },
  {
    id: "nevVat",
    label: "新能源出厂增值税",
    labelEn: "NEV local VAT",
    unit: "%",
    sense: "high_risk",
    field: "nevLocalVat",
    blurb: "本地出厂/首次销售新能源车适用 VAT·GST·IVA 一般税率 · 基建监管/税负 · 税法〔24〕",
  },
  {
    id: "nevTaxGap",
    label: "新能源税差",
    labelEn: "NEV tax gap",
    unit: "百分点",
    sense: "high_risk",
    scale: "diverging0",
    divergeNegTone: "green",
    divergeLegend: { neg: "负 · 进口相对轻", pos: "正 · 进口相对重" },
    divergeLegendEn: { neg: "Neg · lighter import tax", pos: "Pos · heavier import tax" },
    field: "nevTaxGap",
    blurb:
      "税差＝进口关税%−出厂增值税% · 地图以 0 分轴：绿=负（进口相对轻）、琥珀=正（进口相对重）；两侧各自拉满色阶，负值不被大额正值压扁 · 双端齐全才测算〔24〕",
  },
];

/** 地图/大屏因子标签（随 UI 语言） */
export function macroMapFactorLabel(id: MacroMapFactorId, lang: "zh" | "en" = "zh"): string {
  const meta = MACRO_MAP_FACTORS.find((f) => f.id === id);
  if (!meta) return id;
  return lang === "en" ? meta.labelEn : meta.label;
}

/** 从宏观快照文案中抽出第一个可比较数值 */
export function parseMacroNumber(raw?: string): number | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t || t === "—" || t.startsWith("—")) return null;
  // ±8% / ±2.5%
  const pm = t.match(/±\s*(\d+(?:\.\d+)?)\s*%?/);
  if (pm) return Number(pm[1]);
  // 约13793美元 / 约58% / 4.3%（2026-06）/ 3%（2026-07）
  const m = t.match(/(-?\d+(?:\.\d+)?)\s*%?/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export type MacroMetricSeries = {
  id: MacroMapFactorId;
  label: string;
  unit: string;
  sense: "high_risk" | "high_capacity";
  blurb: string;
  byCode: Record<string, number>;
  rawByCode: Record<string, string>;
  min: number;
  max: number;
  count: number;
};

export function buildMacroMetric(
  id: MacroMapFactorId,
  lang: "zh" | "en" = "zh",
): MacroMetricSeries {
  const meta = MACRO_MAP_FACTORS.find((f) => f.id === id)!;
  const byCode: Record<string, number> = {};
  const rawByCode: Record<string, string> = {};
  for (const [code, snap] of Object.entries(COUNTRY_MACRO)) {
    if (id === "nevTaxGap") {
      const gap = deriveNevTaxGap(snap);
      if (!gap) continue;
      byCode[code] = gap.n;
      rawByCode[code] = gap.raw;
      continue;
    }
    if (id === "fxChg") {
      const series = resolveFxSeries(code, {
        fxTrend: snap.fxTrend,
        fxHint: snap.fxHint,
        fxVolInYear: snap.fxVolInYear,
      });
      if (!series || series.points.length < 2) continue;
      const pts = sliceFxPointsByMonths(series.points, 12);
      if (pts.length < 2) continue;
      const strength = fxLocalStrengthChgPct(series, pts);
      // 地图约定：正=本币贬值（风险向暖色），负=本币升值（冷色）
      const deprec = -strength;
      byCode[code] = Number(deprec.toFixed(2));
      const abs = Math.abs(strength);
      rawByCode[code] =
        lang === "en"
          ? `1Y local vs USD ${strength >= 0 ? "up" : "down"} ~${abs.toFixed(1)}%${
              series.synthetic ? " · illustrative" : ""
            }`
          : `近1年本币对美元${strength >= 0 ? "升值" : "贬值"}约 ${abs.toFixed(1)}%${
              series.synthetic ? "·示意序列" : ""
            }`;
      continue;
    }
    if (!meta.field) continue;
    const raw = snap[meta.field];
    if (typeof raw !== "string" || !raw.trim()) continue;
    const n = parseMacroNumber(raw);
    if (n == null) continue;
    byCode[code] = n;
    rawByCode[code] = raw;
  }
  const vals = Object.values(byCode);
  const min = vals.length ? Math.min(...vals) : 0;
  const max = vals.length ? Math.max(...vals) : 1;
  return {
    id,
    label: lang === "en" ? meta.labelEn : meta.label,
    unit: meta.unit,
    sense: meta.sense,
    blurb: meta.blurb,
    byCode,
    rawByCode,
    min,
    max,
    count: vals.length,
  };
}

export function formatMacroValue(
  id: MacroMapFactorId,
  n: number,
  lang: "zh" | "en" = "zh",
): string {
  const en = lang === "en";
  if (id === "gdpPc") return `USD ${Math.round(n).toLocaleString()}`;
  if (id === "incomePc") return `USD ${Math.round(n).toLocaleString()} PPP`;
  if (id === "fxVol") return `±${n}%`;
  if (id === "fxChg") {
    const abs = Math.abs(n);
    const body = abs >= 10 ? abs.toFixed(1) : abs.toFixed(2);
    if (Math.abs(n) < 0.05) return en ? `Flat ~0%` : `持平约 0%`;
    // 地图约定：正=本币贬值，负=本币升值
    if (en) return n > 0 ? `Local currency down ${body}%` : `Local currency up ${body}%`;
    return n > 0 ? `本币贬值 ${body}%` : `本币升值 ${body}%`;
  }
  if (id === "gasoline") return n.toFixed(2);
  if (id === "electricity") return n.toFixed(3);
  if (id === "fuelToPower") return n.toFixed(1);
  if (id === "nevTaxGap") {
    const sign = n > 0 ? "+" : "";
    const body = Number.isInteger(n) ? String(n) : n.toFixed(1);
    return en ? `${sign}${body} pp` : `${sign}${body}百分点`;
  }
  const pct =
    id === "hhDebt" ||
    id === "inflation" ||
    id === "policyRate" ||
    id === "unemployment" ||
    id === "nevTariff" ||
    id === "nevVat";
  if (Number.isInteger(n)) return `${n}${pct ? "%" : ""}`;
  return `${n.toFixed(n >= 10 ? 1 : 2)}${pct ? "%" : ""}`;
}

/** diverging0 图例左右标签 */
export function macroDivergeLegendLabel(
  id: MacroMapFactorId,
  side: "neg" | "pos",
  lang: "zh" | "en" = "zh",
): string {
  const meta = MACRO_MAP_FACTORS.find((f) => f.id === id);
  if (!meta) return side === "neg" ? (lang === "en" ? "Neg" : "负") : lang === "en" ? "Pos" : "正";
  if (lang === "en") {
    const en = meta.divergeLegendEn?.[side];
    if (en) return en;
  }
  return meta.divergeLegend?.[side] || (side === "neg" ? (lang === "en" ? "Neg" : "负") : lang === "en" ? "Pos" : "正");
}
