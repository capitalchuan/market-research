/** 宏观卡 / 地图细标：中文快照文案 → EN 展示层（不改库内原文） */

import type { UiLang } from "../uiI18n";
import type { CashLoanMacroGroup } from "./countryMacro";
import type { FxChgPeriodId } from "./fxHistory";
import { FX_CHG_PERIODS, type FxHistoryPoint } from "./fxHistory";

/** 常见宏观短语替换（长词优先） */
const MACRO_PHRASE_EN: readonly [string, string][] = [
  ["非住户可支配收入", "not household disposable income"],
  ["世行GNI/人PPP", "World Bank GNI/capita PPP"],
  ["人均GDP(PPP)", "GDP/capita (PPP)"],
  ["人均GDP", "GDP/capita"],
  ["OWID转载", "via OWID"],
  ["汽油/电价续补", "gasoline/power price updates"],
  ["官方可支配收入待续采", "official disposable income TBD"],
  ["可用人均GDP对照", "use GDP/capita as proxy"],
  ["TE外汇储备", "TE FX reserves"],
  ["TE GDP/人PPP", "TE GDP/capita PPP"],
  ["中国大陆", "Mainland China"],
  ["中国台湾", "Taiwan"],
  ["中国香港", "Hong Kong SAR"],
  ["外汇储备", "FX reserves"],
  ["经常账户", "current account"],
  ["年内高低/均价", "1Y high-low / mean"],
  ["近1年本币对美元", "1Y local FX vs USD"],
  ["对照总表预警", "see factor-table alerts"],
  ["对照总表三产口径", "see factor-table sector mix"],
  ["对照三产口径", "see sector-mix definition"],
  ["占GDP比重待续拆", "GDP share TBD"],
  ["待官方/TE续拆", "official/TE breakdown TBD"],
  ["三产分项待", "sector breakdown TBD · "],
  ["2026-08补录", "added 2026-08"],
  ["对照", "as of"],
  ["待续采", "TBD"],
  ["待续", "TBD"],
  ["亿美元", " USD bn"],
  ["美元", " USD"],
  ["约合", "~"],
  ["约", "~"],
  ["世行", "World Bank"],
  ["（", "("],
  ["）", ")"],
];

export function localizeMacroText(text: string | null | undefined, lang: UiLang): string {
  if (!text) return "";
  if (lang !== "en") return text;
  let out = text;
  for (const [zh, en] of MACRO_PHRASE_EN) {
    if (out.includes(zh)) out = out.split(zh).join(en);
  }
  return out;
}

const GROUP_EN: Record<string, { title: string; soWhat: string }> = {
  fx_cross: {
    title: "FX & cross-border",
    soWhat:
      "Can you hedge FX and move funds? Wide swings need pricing/provision buffers.",
  },
  borrower: {
    title: "Borrowers & repayment",
    soWhat:
      "Who borrows and how stable is income; weak jobs / large primary sector → more seasonal delinquency.",
  },
  credit_heat: {
    title: "Credit overheating",
    soWhat:
      "Room to add leverage; household leverage near overheat → tighten new-to-credit and limits.",
  },
  stress: {
    title: "Cycle & pricing stress",
    soWhat:
      "Pricing anchor and post-book stress: high rates/inflation lift funding cost; energy living costs hit repayment; weak GDP worsens vintages.",
  },
  nev_tax: {
    title: "NEV tax & purchase incentives",
    soWhat:
      "CBU import tariff vs local VAT drives landed cost; tax gap is the CBU wedge vs local build. CKD and battery/motor HS lines are separate, often lower and tied to localization. Purchase incentives are coarse tags, not a global $ scale.",
  },
};

const METRIC_LABEL_EN: Record<string, string> = {
  外汇储备: "FX reserves",
  经常账户: "Current account",
  年内汇率波动: "FX vol (in-year)",
  汇率水平: "FX level",
  政策利率: "Policy rate",
  总人口: "Population",
  年龄结构: "Age structure",
  失业率: "Unemployment",
  "就业/人口": "Employment / population",
  人均收入: "Income per capita",
  人均GDP: "GDP per capita",
  三产结构: "Sector mix",
  消费者信心: "Consumer confidence",
  就业备注: "Employment note",
  居民杠杆率: "Household leverage",
  "消费/私营信贷": "Consumer / private credit",
  "政府债务/GDP": "Gov debt / GDP",
  GDP同比: "GDP YoY",
  通胀: "Inflation",
  零售汽油: "Retail gasoline",
  居民电价: "Residential power",
  油电比: "Fuel-to-power ratio",
  "整车关税 HS8703 CBU": "CBU tariff HS8703",
  "CKD/SKD 组装路径": "CKD/SKD path",
  "动力电池 HS8507.60": "Battery HS8507.60",
  "驱动电机 HS8501": "Motor HS8501",
  本地出厂新能源车增值税: "Local NEV VAT",
  新能源税差: "NEV tax gap",
  购车端激励: "Purchase incentive",
};

export function localizeCashLoanMacroGroups(
  groups: CashLoanMacroGroup[],
  lang: UiLang,
): CashLoanMacroGroup[] {
  if (lang !== "en") return groups;
  return groups.map((g) => {
    const copy = GROUP_EN[g.id];
    return {
      ...g,
      title: copy?.title || g.title,
      soWhat: copy?.soWhat || localizeMacroText(g.soWhat, lang),
      metrics: g.metrics.map((m) => ({
        ...m,
        label: METRIC_LABEL_EN[m.label] || m.label,
        value: localizeMacroText(m.value, lang),
        asOf: m.asOf ? localizeMacroText(m.asOf, lang) : m.asOf,
      })),
    };
  });
}

const FX_PERIOD_EN: Record<FxChgPeriodId, string> = {
  "3m": "3M",
  "6m": "6M",
  "1y": "1Y",
  "3y": "3Y",
  "5y": "5Y",
  all: "All",
};

export function fxChgPeriodLabel(
  id: FxChgPeriodId | { id: FxChgPeriodId; label: string },
  lang: UiLang,
): string {
  const pid = typeof id === "string" ? id : id.id;
  if (lang === "en") return FX_PERIOD_EN[pid] || pid;
  const row = FX_CHG_PERIODS.find((p) => p.id === pid);
  return row?.label || pid;
}

export function fxPointsSpanLabelUi(
  points: FxHistoryPoint[],
  lang: UiLang,
  synthetic?: boolean,
): string {
  if (lang !== "en") {
    if (synthetic && points.length >= 200) return "约 5 年";
    if (points.length < 2) return "区间";
    const a = Date.parse(points[0]!.d);
    const b = Date.parse(points[points.length - 1]!.d);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return "区间";
    const y = (b - a) / (365.25 * 24 * 3600 * 1000);
    if (y >= 1.5) return `约 ${y.toFixed(1)} 年`;
    const m = y * 12;
    if (m >= 1.2) return `约 ${m.toFixed(0)} 个月`;
    return `约 ${(m * 30).toFixed(0)} 天`;
  }
  if (synthetic && points.length >= 200) return "~5 years";
  if (points.length < 2) return "range";
  const a = Date.parse(points[0]!.d);
  const b = Date.parse(points[points.length - 1]!.d);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return "range";
  const y = (b - a) / (365.25 * 24 * 3600 * 1000);
  if (y >= 1.5) return `~${y.toFixed(1)} years`;
  const m = y * 12;
  if (m >= 1.2) return `~${m.toFixed(0)} mo`;
  return `~${(m * 30).toFixed(0)} d`;
}

export function yearWindowLabel(
  id: "5y" | "10y" | "all" | "3m" | "6m" | "1y" | "3y",
  lang: UiLang,
): string {
  if (lang !== "en") {
    const zh: Record<string, string> = {
      "3m": "3个月",
      "6m": "6个月",
      "1y": "1年",
      "3y": "3年",
      "5y": "5年",
      "10y": "10年",
      all: "全区间",
    };
    return zh[id] || id;
  }
  const en: Record<string, string> = {
    "3m": "3M",
    "6m": "6M",
    "1y": "1Y",
    "3y": "3Y",
    "5y": "5Y",
    "10y": "10Y",
    all: "All",
  };
  return en[id] || id;
}
