/**
 * 国家宏观量化分。只计入汇兑、客群、信贷过热、景气四组。
 * 缺组剔除后按权重重分配。不含架构、新能源税、油电，也不用牌照名录。
 * hot / watch / ok = 25 / 55 / 85，组内取有读数指标的平均。
 */
import { COUNTRY_MACRO } from "./countryMacro";

const FLAG_SCORE = { hot: 25, watch: 55, ok: 85 } as const;

type Band = keyof typeof FLAG_SCORE;

type GroupId = "fx_cross" | "borrower" | "credit_heat" | "stress";

const WEIGHT: Record<GroupId, number> = {
  fx_cross: 15,
  borrower: 15,
  credit_heat: 15,
  stress: 15,
};

function firstNumber(s?: string | null): number | null {
  if (!s) return null;
  const m = s.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

export type MacroScorePart = {
  label: string;
  /** 25 / 55 / 85。没有读数则为 null，不进入组内平均。 */
  score: number | null;
};

export type MacroScoreGroup = {
  id: GroupId;
  label: string;
  score: number | null;
  items: MacroScorePart[];
};

export type MacroScoreDetail = {
  total: number | null;
  groups: MacroScoreGroup[];
};

function part(label: string, band: Band | null): MacroScorePart {
  return { label, score: band == null ? null : FLAG_SCORE[band] };
}

function meanScore(items: MacroScorePart[]): number | null {
  const present = items.filter((item) => item.score != null);
  if (!present.length) return null;
  return present.reduce((sum, item) => sum + (item.score ?? 0), 0) / present.length;
}

export const MACRO_SCORE_HELP = [
  "四组等权：汇兑、客群、信贷过热、景气。某组没有读数就剔除，其余组重新分配权重。",
  "每项三档：偏高压 25、留意 55、偏稳 85。组内取平均，再按权重合计成 0–100。",
  "汇兑：汇率波动 ≥12% 高压、≥6% 留意；经常账户/GDP ≤−5% 高压、<0 留意。",
  "客群：失业率 ≥8% 高压；人均 GDP <2000 美元高压、≥12000 美元留意。",
  "信贷过热：居民杠杆 ≥55% 高压、≥45% 留意。",
  "景气：GDP 同比 <1% 留意；通胀 ≥12% 或为负高压、≥6% 留意；政策利率 ≥10% 高压。",
];

const GROUP_LABEL: Record<GroupId, string> = {
  fx_cross: "汇兑",
  borrower: "客群",
  credit_heat: "信贷过热",
  stress: "景气",
};

export function cashloanMacroScoreDetail(code: string): MacroScoreDetail | null {
  const snap = COUNTRY_MACRO[code];
  if (!snap) return null;

  const fxVol = firstNumber(snap.fxVolInYear?.replace("±", ""));
  const caM = (snap.currentAccount || "").match(/CA\/GDP约?\s*(-?\d+(?:\.\d+)?)\s*%/i);
  const ca = caM ? Number(caM[1]) : null;
  const unemp = firstNumber(snap.unemployment);
  const gdpPc = firstNumber(snap.gdpPerCapitaUsd);
  const hh = firstNumber(snap.householdDebtToGdp);
  const gdpYoY = firstNumber(snap.gdpYoY);
  const infl = firstNumber(snap.inflation);
  const rate = firstNumber(snap.policyRate);

  const grouped: Record<GroupId, MacroScorePart[]> = {
    fx_cross: [
      part("汇率波动", fxVol == null ? null : fxVol >= 12 ? "hot" : fxVol >= 6 ? "watch" : "ok"),
      part("经常账户", ca == null ? null : ca <= -5 ? "hot" : ca < 0 ? "watch" : "ok"),
    ],
    borrower: [
      part("失业率", unemp == null ? null : unemp >= 8 ? "hot" : "ok"),
      part("人均GDP", gdpPc == null ? null : gdpPc < 2000 ? "hot" : gdpPc >= 12000 ? "watch" : "ok"),
    ],
    credit_heat: [part("居民杠杆", hh == null ? null : hh >= 55 ? "hot" : hh >= 45 ? "watch" : "ok")],
    stress: [
      part("GDP同比", gdpYoY == null ? null : gdpYoY < 1 ? "watch" : "ok"),
      part("通胀", infl == null ? null : infl >= 12 ? "hot" : infl >= 6 || infl < 0 ? "watch" : "ok"),
      part("政策利率", rate == null ? null : rate >= 10 ? "hot" : "ok"),
    ],
  };

  const groups = (Object.keys(WEIGHT) as GroupId[]).map((id) => ({
    id,
    label: GROUP_LABEL[id],
    score: meanScore(grouped[id]),
    items: grouped[id],
  }));
  const present = groups.filter((group) => group.score != null);
  if (!present.length) return { total: null, groups };
  const weight = present.reduce((sum, group) => sum + WEIGHT[group.id], 0);
  const total = present.reduce((sum, group) => sum + (group.score ?? 0) * WEIGHT[group.id], 0) / weight;
  return { total, groups };
}

export function scoreCashloanMacro(code: string): number | null {
  return cashloanMacroScoreDetail(code)?.total ?? null;
}
