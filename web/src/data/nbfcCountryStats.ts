import raw from "./nbfc-country-stats.json";
import nbfcXlsxUrl from "../assets/nbfc-country-stats.xlsx?url";
import type { UiLang } from "../uiI18n";

export type NbfcDataQuality = "official" | "semi-official" | "secondary" | "not_found";

export type NbfcCountryStatRow = {
  country_code: string;
  country_name_zh: string;
  nbfc_equivalent_name: string;
  regulator: string;
  source_url: string;
  source_title: string;
  as_of: string;
  nbfc_count: string;
  loan_book_total: string;
  /** 放贷总量粗算美元（见 meta.fx_note） */
  loan_book_usd: string;
  /** 放贷总量美元数值（十亿美元）；供热力图汇总 */
  loan_book_usd_bn: number | null;
  borrowers_covered: string;
  avg_loan_size: string;
  default_rate: string;
  other_info: string;
  data_quality: NbfcDataQuality;
  notes: string;
};

export type NbfcCountryStatsDataset = {
  meta: {
    title: string;
    updated: string;
    note: string;
    fx_note?: string;
  };
  rows: NbfcCountryStatRow[];
};

export const NBFC_STATS: NbfcCountryStatsDataset = raw as NbfcCountryStatsDataset;

/** 底图/名单缺省名；港澳台统一「中国×」口径 */
const COUNTRY_LABEL_OVERRIDES: Record<string, string> = {
  HK: "中国香港",
  MO: "中国澳门",
  TW: "中国台湾",
};

/** 国家代码 → 中文名（来自统计表 + 口径覆盖） */
export const COUNTRY_LABEL_ZH: Record<string, string> = {
  ...Object.fromEntries(NBFC_STATS.rows.map((r) => [r.country_code, r.country_name_zh])),
  ...COUNTRY_LABEL_OVERRIDES,
};

/** 后台脚本生成的 Excel（scripts/generate-nbfc-xlsx.py），经 Vite 打包可下载 */
export const NBFC_XLSX_HREF = nbfcXlsxUrl;

export const DATA_QUALITY_LABEL: Record<NbfcDataQuality, string> = {
  official: "官方",
  "semi-official": "半官方",
  secondary: "二级",
  not_found: "待补",
};

const DATA_QUALITY_LABEL_EN: Record<NbfcDataQuality, string> = {
  official: "Official",
  "semi-official": "Semi-official",
  secondary: "Secondary",
  not_found: "TBD",
};

export function dataQualityLabelUi(q: NbfcDataQuality | string, lang: UiLang): string {
  if (lang !== "en") return DATA_QUALITY_LABEL[q as NbfcDataQuality] || q;
  return DATA_QUALITY_LABEL_EN[q as NbfcDataQuality] || q;
}

/** NBFC/等效名全量 EN（名单字段原文仍为中文） */
const NBFC_EQUIV_EN: Record<string, string> = {
  ACPR持牌融资公司: "ACPR-licensed finance companies",
  AFM信贷提供牌照持有人: "AFM credit-provision license holders",
  FRA持牌消费金融公司: "FRA-licensed consumer finance companies",
  "LPBBTI / Fintech P2P Lending": "LPBBTI / Fintech P2P lending",
  "Loans outstanding to citizens and sole proprietors":
    "Loans outstanding to citizens and sole proprietors",
  MRA持牌小额信贷机构: "MRA-licensed microfinance institutions",
  "Murabaha loans to individuals": "Murabaha loans to individuals",
  "NBFC/等效": "NBFC / equivalent",
  "NBFC（上层+中层并表样本）": "NBFC (upper + middle layer sample)",
  NCR注册信贷提供商: "NCR-registered credit providers",
  "Nano金融提供商（含银行+非银）": "Nano finance providers (banks + NBFIs)",
  OSFI联邦监管贷款公司: "OSFI federally regulated loan companies",
  "Perusahaan Pembiayaan / Multifinance": "Perusahaan Pembiayaan / Multifinance",
  SAMA持牌金融公司: "SAMA-licensed finance companies",
  "SEC监管借贷/融资类主体": "SEC-supervised lending / finance entities",
  "SOFOM ENR（运营中）": "SOFOM ENR (operating)",
  专业放贷机构: "Specialized lenders",
  专业融资公司: "Specialized finance companies",
  中小企业融资公司: "SME finance companies",
  二级非吸储小额信贷服务商: "Tier-2 non-deposit-taking microcredit providers",
  仅信贷小额信贷机构: "Credit-only microfinance institutions",
  "信贷公司（非银）": "Credit companies (non-bank)",
  "信贷金融公司(SFC)": "Specialized finance companies (SFC)",
  "信贷金融机构(EFC)": "Specialized finance companies (EFC)",
  "储蓄信贷合作社(CMF)": "Savings & credit cooperatives (CMF)",
  "分散式金融/小额信贷机构(SFD)": "Decentralized finance / microfinance (SFD)",
  卡塔尔央行注册伊斯兰融资公司: "QCB-registered Islamic finance companies",
  "发展金融机构（DFI）": "Development finance institutions (DFI)",
  小额信贷机构: "Microfinance institutions",
  小额信贷运营商: "Microfinance operators",
  "小额信贷银行(MFB)": "Microfinance banks (MFB)",
  小额放贷人: "Small-ticket lenders",
  小额融资银行: "Microfinance banks",
  小额贷款公司: "Microcredit companies",
  巴林央行融资公司: "CBB finance companies",
  微金融机构: "Microfinance institutions",
  微金融组织: "Microfinance organizations",
  持有FCA消费信贷放贷许可的机构: "FCA consumer-credit lending permission holders",
  持牌小额融资机构: "Licensed microfinance institutions",
  持牌放债人: "Licensed moneylenders",
  "持牌数字信贷提供商(DCP)": "Licensed digital credit providers (DCP)",
  持牌金融公司: "Licensed finance companies",
  "持牌金融机构（非银行）": "Licensed NBFIs",
  "放债人（第四级）": "Moneylenders (tier 4)",
  "放贷类NBFC（含Modaraba）": "Lending NBFCs (incl. Modaraba)",
  放贷类非吸储金融机构: "Lending non-deposit-taking NBFIs",
  "消费/企业类非吸储小贷": "Consumer/corporate non-deposit microlenders",
  "消费者信贷机构（主业）": "Consumer credit institutions (core)",
  消费金融公司: "Consumer finance companies",
  "直接信贷公司(SCD)": "Direct credit companies (SCD)",
  票券金融公司: "Bills finance companies",
  科威特央行注册金融公司: "CBK-registered finance companies",
  租赁公司: "Leasing companies",
  获批小额信贷机构: "Approved microfinance institutions",
  融资公司: "Finance companies",
  融资租赁与保理机构: "Finance lease & factoring entities",
  融资租赁公司: "Finance leasing companies",
  贷金业者: "Moneylenders",
  资本市场局信贷服务持牌人: "CMSA credit-service licensees",
  "金融中介（TUB第106条）": "Financial intermediaries (TUB Art. 106)",
  金融公司: "Finance companies",
  "金融公司/其他非银放贷人（普查寄送总体）":
    "Finance companies / other non-bank lenders (census universe)",
  "金融公司/其他非银放贷人": "Finance companies / other non-bank lenders",
  "金融机构（BDL名录）": "Financial institutions (BDL register)",
  阿联酋央行持牌金融公司: "CBUAE-licensed finance companies",
  零售信贷公司: "Retail credit companies",
  非卡专业信贷金融公司: "Non-card specialized credit finance companies",
  "非金融信贷提供者(PNFC)": "Non-financial credit providers (PNFC)",
  非银吸储机构: "Deposit-taking NBFIs",
  非银放贷业合计: "Non-bank lending industry total",
  非银行贷款机构: "Non-bank lending institutions",
  非银行金融机构: "Non-bank financial institutions",
};

/** 机构数括号备注、放贷文案等常见片段 */
const NBFC_PHRASE_EN: readonly [string, string][] = [
  ["上层+中层并表样本", "upper + middle layer sample"],
  ["含银行+非银", "banks + NBFIs"],
  ["含Modaraba", "incl. Modaraba"],
  ["运营中", "operating"],
  ["普查寄送总体", "census universe"],
  ["P2P网络借贷", "P2P online lending"],
  ["网络借贷", "online lending"],
  ["发展金融机构", "DFIs"],
  ["消费金融公司", "consumer finance companies"],
  ["小额贷款公司", "microcredit companies"],
  ["融资公司", "finance companies"],
  ["金融公司", "finance companies"],
  ["贷金业者", "moneylenders"],
  ["非卡专业信贷金融公司", "non-card specialized credit finance cos."],
  ["票券金融公司", "bills finance companies"],
  ["持牌金融公司", "licensed finance companies"],
  ["持牌放债人", "licensed moneylenders"],
  ["微金融机构", "microfinance institutions"],
  ["小额信贷机构", "microfinance institutions"],
  ["获批小额信贷机构", "approved microfinance institutions"],
  ["分散式金融", "decentralized finance"],
  ["非银放贷人", "non-bank lenders"],
  ["非银行", "non-bank"],
  ["非银", "NBFI"],
  ["约", "~"],
  ["（", "("],
  ["）", ")"],
];

export function nbfcEquivNameUi(name: string, lang: UiLang): string {
  const rawName = (name || "").trim();
  if (!rawName) return "";
  if (lang !== "en") return rawName;
  if (NBFC_EQUIV_EN[rawName]) return NBFC_EQUIV_EN[rawName];
  for (const [zh, en] of Object.entries(NBFC_EQUIV_EN)) {
    if (rawName.startsWith(zh)) return en + nbfcFieldTextUi(rawName.slice(zh.length), lang);
  }
  return nbfcFieldTextUi(rawName, lang);
}

export function nbfcFieldTextUi(text: string, lang: UiLang): string {
  if (!text) return "";
  if (lang !== "en") return text;
  let out = text;
  if (NBFC_EQUIV_EN[out]) return NBFC_EQUIV_EN[out];
  for (const [zh, en] of NBFC_PHRASE_EN) {
    if (out.includes(zh)) out = out.split(zh).join(en);
  }
  return out;
}

export const NBFC_QUALITY_ORDER: readonly NbfcDataQuality[] = [
  "official",
  "semi-official",
  "secondary",
  "not_found",
];

/** 与上市公司页同一套地区 chip 顺序 */
export const NBFC_REGION_ORDER = [
  "se-asia",
  "latam",
  "east-asia",
  "south-asia",
  "africa",
  "mena",
  "central-asia",
  "west",
] as const;

export type NbfcRegionId = (typeof NBFC_REGION_ORDER)[number];

const NBFC_REGION_BY_COUNTRY: Record<string, NbfcRegionId> = {
  CN: "east-asia",
  HK: "east-asia",
  TW: "east-asia",
  JP: "east-asia",
  KR: "east-asia",
  MN: "east-asia",
  ID: "se-asia",
  MY: "se-asia",
  TH: "se-asia",
  PH: "se-asia",
  VN: "se-asia",
  SG: "se-asia",
  IN: "south-asia",
  BD: "south-asia",
  PK: "south-asia",
  LK: "south-asia",
  KZ: "central-asia",
  KG: "central-asia",
  UZ: "central-asia",
  TJ: "central-asia",
  TM: "central-asia",
  MX: "latam",
  BR: "latam",
  AR: "latam",
  CL: "latam",
  CO: "latam",
  PE: "latam",
  KE: "africa",
  ZA: "africa",
  NG: "africa",
  GH: "africa",
  EG: "mena",
  DZ: "mena",
  MA: "mena",
  TN: "mena",
  LY: "mena",
  SD: "africa",
  ET: "africa",
  TZ: "africa",
  UG: "africa",
  RW: "africa",
  AO: "africa",
  MZ: "africa",
  ZM: "africa",
  ZW: "africa",
  BW: "africa",
  NA: "africa",
  MU: "africa",
  MG: "africa",
  SN: "africa",
  CI: "africa",
  BJ: "africa",
  BF: "africa",
  ML: "africa",
  CM: "africa",
  CD: "africa",
  GA: "africa",
  AE: "mena",
  SA: "mena",
  BH: "mena",
  QA: "mena",
  KW: "mena",
  OM: "mena",
  JO: "mena",
  IQ: "mena",
  IR: "mena",
  IL: "mena",
  LB: "mena",
  PS: "mena",
  YE: "mena",
  TR: "mena",
  US: "west",
  CA: "west",
  GB: "west",
  IE: "west",
  NL: "west",
  DE: "west",
  FR: "west",
  ES: "west",
  IT: "west",
  PT: "west",
  PL: "west",
  SE: "west",
  RU: "west",
};

export function nbfcCountryRegion(code?: string): NbfcRegionId | "" {
  if (!code) return "";
  return NBFC_REGION_BY_COUNTRY[code] || "";
}

export function nbfcRowId(r: NbfcCountryStatRow, index?: number): string {
  const base = `${r.country_code}::${r.nbfc_equivalent_name || "row"}`;
  return index == null ? base : `${base}::${index}`;
}

/** 从「431（…）」类字段抽第一个数字，供排序 */
export function nbfcCountSortValue(raw?: string): number | null {
  if (!raw) return null;
  const m = raw.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function downloadNbfcXlsx() {
  const a = document.createElement("a");
  a.href = NBFC_XLSX_HREF;
  a.download = "nbfc-country-stats.xlsx";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** 当前筛选结果 → CSV（UTF-8 BOM，Excel 可直接开） */
export function downloadNbfcCsv(rows: NbfcCountryStatRow[], asOf?: string, lang: UiLang = "zh") {
  const headers =
    lang === "en"
      ? [
          "Country code",
          "Country",
          "NBFC / equivalent",
          "Regulator",
          "Institution count",
          "Loan book",
          "Loan book (USD)",
          "Borrowers",
          "Avg loan size",
          "Default/NPL",
          "As of",
          "Source title",
          "Source URL",
          "Quality",
          "Other",
          "Notes",
        ]
      : [
          "国家代码",
          "国家",
          "NBFC/等效",
          "监管机构",
          "机构数量",
          "放贷总量",
          "放贷总量(USD)",
          "覆盖人数",
          "平均放贷额",
          "Default/NPL",
          "时点",
          "信源标题",
          "信源URL",
          "质量",
          "其他",
          "备注",
        ];
  const escape = (v: string) => {
    const s = (v || "").replace(/\r?\n/g, " ").trim();
    if (/[",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.country_code,
        lang === "en" ? r.country_code : r.country_name_zh,
        lang === "en" ? nbfcEquivNameUi(r.nbfc_equivalent_name, lang) : r.nbfc_equivalent_name,
        r.regulator,
        nbfcFieldTextUi(r.nbfc_count, lang),
        nbfcFieldTextUi(r.loan_book_total, lang),
        nbfcFieldTextUi(r.loan_book_usd, lang),
        nbfcFieldTextUi(r.borrowers_covered, lang),
        nbfcFieldTextUi(r.avg_loan_size, lang),
        nbfcFieldTextUi(r.default_rate, lang),
        r.as_of,
        r.source_title,
        r.source_url,
        dataQualityLabelUi(r.data_quality, lang),
        nbfcFieldTextUi(r.other_info, lang),
        nbfcFieldTextUi(r.notes, lang),
      ]
        .map((x) => escape(String(x ?? "")))
        .join(","),
    ),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nbfc-country-stats${asOf ? `-${asOf}` : ""}.csv`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
