import raw from "./industry-research-library.json";

export type ResearchConfidence = "高" | "中" | "低" | string;

export type ResearchSourceKind =
  | "traffic_research"
  | "platform_research"
  | "broker"
  | "regulator_pack"
  | string;

export type ResearchRefreshSource = {
  id: string;
  nameZh: string;
  kind: ResearchSourceKind;
  priority: number;
  cadence?: string;
  note?: string;
};

export type ResearchRankingRow = {
  rank: number;
  name: string;
  nameZh?: string;
  value: string;
  unit?: string;
  mom?: string;
  rankChange?: string;
  groupKeys?: string[];
  note?: string;
};

export type ResearchPlayerUpdate = {
  nameZh: string;
  appName?: string;
  groupKeys: string[];
  region?: string;
  countries?: string[];
  metric: string;
  /** EN 玩家指标行；缺省时 EN 模式不展示中文 metric */
  metricEn?: string;
  actions?: string;
  cashLoanHint?: string;
  confidence?: ResearchConfidence;
  /** 是否建议回填 CRM diandian / volume 字段 */
  applyToCrm?: boolean;
};

export type ResearchSourceLink = {
  id: string;
  type: string;
  title: string;
  url: string;
  asOf?: string;
  confidence?: ResearchConfidence;
  bullets?: string[];
};

export type ResearchDocKind =
  | "research_report"
  | "regulator_pack"
  | "market_stats_relay"
  | "mixed_source_pack"
  | string;

export type ResearchReport = {
  id: string;
  title: string;
  /** EN 列表/详情标题；缺省时展示层回退 title */
  titleEn?: string;
  publisher: string;
  period: string;
  asOf: string;
  confidence: ResearchConfidence;
  sourceType: string;
  /** 文档分轨：研报 vs 监管/信源包（勿混称研报） */
  docKind?: ResearchDocKind;
  docKindLabel?: string;
  localPath?: string;
  pages?: number;
  regions?: string[];
  thesis: string;
  /** EN 导语/摘要 */
  summaryEn?: string;
  thesisEn?: string;
  growthFormula?: string;
  macroBullets?: string[];
  policyBullets?: string[];
  /** EN 监管要点；缺省时 EN 模式不展示中文 policyBullets */
  policyBulletsEn?: string[];
  industryMetrics?: Record<string, string>;
  /** EN 行业指标键值；缺省回退 industryMetrics 或隐藏 */
  industryMetricsEn?: Record<string, string>;
  marketNotes?: { region: string; summary: string }[];
  rankings?: Record<string, ResearchRankingRow[]>;
  quadBuckets?: {
    star?: string[];
    pressure?: string[];
    potential?: string[];
    longTail?: string[];
    insight?: string;
  };
  sources?: ResearchSourceLink[];
  playerUpdates: ResearchPlayerUpdate[];
  analysis: { verdict: string; bullets: string[]; verdictEn?: string; bulletsEn?: string[] };
};

export type IndustryResearchLibrary = {
  asOf: string;
  note: string;
  refresh: {
    cadence: string;
    nextDue: string;
    lastIngestAt?: string;
    sources: ResearchRefreshSource[];
    queue: { pending: string[]; done: string[] };
  };
  reports: ResearchReport[];
};

export const INDUSTRY_RESEARCH_LIBRARY = raw as IndustryResearchLibrary;

export function resolveDocKind(r: ResearchReport): ResearchDocKind {
  if (r.docKind) return r.docKind;
  const st = (r.sourceType || "").toLowerCase();
  if (st.includes("regulator") || st.includes("pack")) return "regulator_pack";
  if (st.includes("relay") || st.includes("stats")) return "market_stats_relay";
  return "research_report";
}

export function docKindLabel(r: ResearchReport): string {
  if (r.docKindLabel) return r.docKindLabel;
  const k = resolveDocKind(r);
  if (k === "regulator_pack") return "监管/信源包";
  if (k === "market_stats_relay") return "监管统计转述";
  if (k === "mixed_source_pack") return "混合信源包";
  return "研报";
}

export function isResearchReportDoc(r: ResearchReport): boolean {
  return resolveDocKind(r) === "research_report";
}

export function researchLibraryStats() {
  const reports = INDUSTRY_RESEARCH_LIBRARY.reports || [];
  const researchOnly = reports.filter(isResearchReportDoc);
  const packs = reports.filter((r) => !isResearchReportDoc(r));
  const playerHits = reports.reduce((n, r) => n + (r.playerUpdates?.length || 0), 0);
  return {
    reportCount: reports.length,
    researchCount: researchOnly.length,
    packCount: packs.length,
    playerHitCount: playerHits,
    pending: INDUSTRY_RESEARCH_LIBRARY.refresh?.queue?.pending?.length || 0,
    done: INDUSTRY_RESEARCH_LIBRARY.refresh?.queue?.done?.length || 0,
    nextDue: INDUSTRY_RESEARCH_LIBRARY.refresh?.nextDue || "",
    asOf: INDUSTRY_RESEARCH_LIBRARY.asOf,
  };
}

export function latestResearchReports(limit = 3): ResearchReport[] {
  return [...(INDUSTRY_RESEARCH_LIBRARY.reports || [])]
    .filter(isResearchReportDoc)
    .sort((a, b) => (b.asOf || "").localeCompare(a.asOf || ""))
    .slice(0, limit);
}

export function latestSourcePacks(limit = 6): ResearchReport[] {
  return [...(INDUSTRY_RESEARCH_LIBRARY.reports || [])]
    .filter((r) => !isResearchReportDoc(r))
    .sort((a, b) => (b.asOf || "").localeCompare(a.asOf || ""))
    .slice(0, limit);
}

export function latestLibraryDocs(limit = 8): ResearchReport[] {
  return [...(INDUSTRY_RESEARCH_LIBRARY.reports || [])]
    .sort((a, b) => (b.asOf || "").localeCompare(a.asOf || ""))
    .slice(0, limit);
}

/** 玩家卡：按 group / 别名挂靠最新命中（研报+监管包均可） */
export function resolveResearchHitsForGroup(group: string): {
  report: ResearchReport;
  hit: ResearchPlayerUpdate;
}[] {
  const g = (group || "").trim();
  if (!g) return [];
  const out: { report: ResearchReport; hit: ResearchPlayerUpdate }[] = [];
  for (const report of latestLibraryDocs(16)) {
    for (const hit of report.playerUpdates || []) {
      if ((hit.groupKeys || []).some((k) => k === g || g.includes(k) || k.includes(g))) {
        out.push({ report, hit });
        break;
      }
    }
  }
  return out;
}
