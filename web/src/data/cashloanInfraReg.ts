/**
 * 个人现金贷「基础设施与监管」。
 * 征信覆盖率、互联网使用人口、合同执行天数来自公开序列，文案里写明出处和时间点。
 * 信用信息是 Business Ready 2025 的折算分，另列一行，不替代成年人口占比。
 * 智能手机拥有率来自 GSMA 2024 年消费者调查，与互联网使用人口分开。
 * 司法债务执行在天数之外，附上同一张表的合同执行分数和司法程序质量指数。
 * 利率、牌照、外资分三行，仍只用本地已经落库的监管条文。缺项标未收录。
 * 新能源税三行不在本页。
 */
import openRaw from "./cashloan-infra-open.json";
import breadyRaw from "./cashloanBreadyCredit.json";
import gsmaRaw from "./cashloanGsmaSmartphone.json";

export type InfraScoreBar = {
  label: string;
  value: number;
  max: number;
  depth?: 0 | 1;
};

export type InfraRegRow = {
  label: string;
  value: string;
  links: string[];
  bars?: InfraScoreBar[];
};

const LABELS = [
  "征信覆盖率",
  "信用信息",
  "智能手机",
  "移动互联网",
  "司法债务执行",
  "利率上限",
  "牌照",
  "外资",
  "催收、数据与隐私",
] as const;

const GAP = "本地信源未收录";

const BY_COUNTRY: Record<string, Partial<Record<(typeof LABELS)[number], Omit<InfraRegRow, "label">>>> = {
  ID: {
    利率上限: {
      value: "个人消费贷日息上限：2024 起 0.3%、2025 起 0.2%、2026 起 0.1%（OJK SEOJK 19/06/2023）。",
      links: [
        "http://mp.weixin.qq.com/s?__biz=Mzg4ODU3NTAzNg==&mid=2247484567&idx=1&sn=68e72de24265fbcf95a9b1b2d9154a54",
      ],
    },
    牌照: {
      value: "网贷须持牌并报送（POJK 40/2024，含单户上限）。分期主体收窄为银行与融资公司（POJK 32/2025）。",
      links: [
        "https://ojk.go.id/id/regulasi/Pages/POJK-40-Tahun-2024-Layanan-Pendanaan-Bersama-Berbasis-Teknologi-Informasi.aspx",
      ],
    },
    外资: {
      value: "POJK 40/2024 禁止跨境，并设最低股权。",
      links: [
        "https://ojk.go.id/id/regulasi/Pages/POJK-40-Tahun-2024-Layanan-Pendanaan-Bersama-Berbasis-Teknologi-Informasi.aspx",
      ],
    },
    "催收、数据与隐私": {
      value: "催收与紧急联系人规范随 SEOJK 19/06/2023 收紧。分期新规另要求披露与催收合规。数据本地化与隐私法条文本地未收录。",
      links: [
        "http://mp.weixin.qq.com/s?__biz=Mzg4ODU3NTAzNg==&mid=2247484567&idx=1&sn=68e72de24265fbcf95a9b1b2d9154a54",
      ],
    },
  },
  PH: {
    利率上限: {
      value: "BSP Circular 1133：名义利率不超过 6%/月，有效利率不超过 15%/月，逾期费不超过 5%/月，总成本不超过本金 100%。",
      links: ["https://www.bsp.gov.ph/Regulations/Issuances/2021/1133.pdf"],
    },
    牌照: {
      value: "线上放贷须 SEC 放贷或融资牌照加 OLP 资格；MC 20（2026）解除新设禁令，但提高实缴资本，单主体最多 5 个 OLP。",
      links: [
        "https://www.sec.gov.ph/",
        "https://business.inquirer.net/599350/sec-lifts-moratorium-on-online-lending-firms",
      ],
    },
    外资: {
      value: "外资持股受限，需本地合作拿牌（点点 2025）。",
      links: [],
    },
    "催收、数据与隐私": {
      value: "MC 20 要求贷前披露总额、到手金额、利率/EIR、费用与期数，并登记 CIC。未注册 OLP 曾被要求下架。数据本地化与隐私法条文本地未收录。",
      links: [
        "https://fintechnews.ph/72397/lending/sec-online-lending-platforms-moratorium-lifted/",
        "https://www.abs-cbn.com/business/02/09/23/33-unregistered-lending-apps-removed-by-google-sec",
      ],
    },
  },
  TH: {
    利率上限: {
      value: "BOT 有效利率上限：个人贷约 25%/年（有车证担保约 24%），Nano Finance 约 33%/年，信用卡约 16%/年。个人贷按收入核定额度。",
      links: [
        "https://www.bot.or.th/content/dam/bot/documents/th/our-services/bot-license-check/interest.pdf",
        "https://www.bot.or.th/content/dam/bot/fipcs/documents/FPG/2563/EngPDF/25630185.pdf",
      ],
    },
    外资: {
      value: "外资持股限制本地未收录。",
      links: [],
    },
    "催收、数据与隐私": {
      value: "本地仅交叉到禁止类提前还款费，催收行为、数据本地化与隐私法条文未收录。",
      links: ["https://www.bot.or.th/content/dam/bot/fipcs/documents/FPG/2560/EngPDF/25600206.pdf"],
    },
  },
  IN: {
    利率上限: {
      value: "须披露全口径 APR 与关键事实说明，并保留冷静期。单一法定利率上限本地未收录。",
      links: [
        "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12382&Mode=0",
        "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12514&Mode=0",
      ],
    },
    牌照: {
      value:
        "线上消费贷必须落在受监管实体（银行或 NBFC），资金须在持牌机构与借款人之间直达。LSP 不得截留资金。2026-08 草案拟禁止 NBFC 做循环授信、只留期限贷（发卡 NBFC 除外），征求意见至 2026-08-28。",
      links: [
        "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12382&Mode=0",
        "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12514&Mode=0",
        "https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=63303",
      ],
    },
    外资: {
      value: "外资持股限制本地未收录。",
      links: [],
    },
    "催收、数据与隐私": {
      value: "获客与催收可以外包给 LSP，持牌机构的合规责任不因此减少。违约损失担保另有拨备与资本规则。数据本地化与隐私法条文本地未收录。",
      links: [
        "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12382&Mode=0",
        "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12514&Mode=0",
      ],
    },
  },
  HK: {
    利率上限: {
      value: "银行对《放债人条例》利率限制有豁免；年利率超过约 36% 须自证合理，通常不应超过约 48%。",
      links: [],
    },
    牌照: {
      value:
        "数字银行沿用金管局授权指引，审慎标准与传统银行相同。2024 年 Virtual Bank 更名为 Digital Bank，年报认为现有牌照数量合适、暂不强推新增。吸储牌照与放债人牌照分轨。",
      links: [
        "https://www.hkma.gov.hk/media/eng/doc/key-information/guidelines-and-circular/guideline/g_Authorization_of_Virtual_Banks.pdf",
        "https://www.hkma.gov.hk/eng/key-functions/banking/banking-regulatory-and-supervisory-regime/digital-banks/",
      ],
    },
    外资: {
      value: "外资持股限制本地未收录。",
      links: [],
    },
  },
  MX: {
    利率上限: {
      value: "利率上限本地未收录。",
      links: [],
    },
    牌照: {
      value:
        "《金融科技机构法》下的 ITF（集体融资或电子支付机构）须获 CNBV 授权。电子支付牌照不等于放贷牌照，现金贷须另核银行或 SOFOM 等放贷主体；消费者保护走 Condusef。",
      links: [
        "https://www.diputados.gob.mx/LeyesBiblio/pdf/LRITF.pdf",
        "https://www.cnbv.gob.mx/SECTORES-SUPERVISADOS/Fintech/Paginas/NORMATIVIDAD-FINTECH.aspx",
      ],
    },
    外资: {
      value: "外资持股限制本地未收录。",
      links: [],
    },
  },
};

type OpenCountry = {
  privateBureau?: number | null;
  publicRegistry?: number | null;
  enforceDays?: number | null;
  judgmentDays?: number | null;
  enforceScore?: number | null;
  timeScore?: number | null;
  costScore?: number | null;
  qualityIndex?: number | null;
  qualityScore?: number | null;
  courtStructure?: number | null;
  caseManagement?: number | null;
  courtAutomation?: number | null;
  adr?: number | null;
  dbScope?: "two-city" | "largest-city";
  internet?: { value: number; year: number };
};

const OPEN = openRaw as {
  creditEnforce: {
    fileUrl: string;
    gettingCreditUrl: string;
    enforcingContractsUrl: string;
  };
  internet: { url: string };
  byCode: Record<string, OpenCountry>;
};

const DB_FILE = OPEN.creditEnforce.fileUrl;
const DB_CREDIT = OPEN.creditEnforce.gettingCreditUrl;
const DB_ENFORCE = OPEN.creditEnforce.enforcingContractsUrl;

type BreadyCredit = {
  bureau: number;
  coverage: number;
  access: number;
  shared: number;
  payments: number;
  history: number;
  smallLoan: number;
  timeliness: number;
};

const BREADY = breadyRaw as {
  fileUrl: string;
  handbookUrl: string;
  byCode: Record<string, BreadyCredit>;
};

const BREADY_LINKS = [BREADY.fileUrl, BREADY.handbookUrl];

const GSMA = gsmaRaw as {
  fileUrl: string;
  byCode: Record<string, { urban: number; rural: number }>;
};

function pct1(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

function daysText(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return `${rounded} 天`;
  return `${rounded.toFixed(2).replace(/0$/, "")} 天`;
}

function dbScope(row: OpenCountry | undefined): string {
  if (row?.dbScope === "two-city") return "这一行是两个最大商业城市的人口加权。";
  if (row?.dbScope === "largest-city") return "案例设在该国最大商业城市。";
  return "";
}

function creditRow(row: OpenCountry | undefined): Omit<InfraRegRow, "label"> {
  const links = [DB_CREDIT, DB_FILE];
  if (!row || (row.privateBureau == null && row.publicRegistry == null && !row.dbScope)) {
    return {
      value: "Doing Business 2020（数据采集截至 2019-05）纠错历史表没有该国的征信覆盖率。",
      links,
    };
  }
  const bureau =
    row.privateBureau == null
      ? "私人征信局覆盖率无读数"
      : `私人征信局覆盖成年人口 ${pct1(row.privateBureau)}`;
  const registry =
    row.publicRegistry == null
      ? "公共征信登记覆盖率无读数"
      : `公共征信登记覆盖成年人口 ${pct1(row.publicRegistry)}`;
  return {
    value: `${bureau}，${registry}。Doing Business 2020，数据采集截至 2019-05。世界银行纠错后历史表。${dbScope(row)}`,
    links,
  };
}

function creditInfoRow(row: BreadyCredit | undefined): Omit<InfraRegRow, "label"> {
  if (!row) {
    return {
      value: "Business Ready 2025 金融服务专题覆盖 101 个经济体，没有该国读数。",
      links: BREADY_LINKS,
    };
  }
  const source = "Business Ready 2025，金融服务专题，101 个经济体。新信息写入信用报告的标尺为提交后 0–30 个日历日。";
  const bars: InfraScoreBar[] = [
    { label: "运转", value: row.bureau, max: 50 },
    { label: "信用信息覆盖", value: row.coverage, max: 5 },
    { label: "数据来源", value: row.access, max: 5 },
    { label: "共享内容", value: row.shared, max: 20 },
    { label: "还款正负信息", value: row.payments, max: 6.67, depth: 1 },
    { label: "至少两年历史", value: row.history, max: 6.67, depth: 1 },
    { label: "小额贷款", value: row.smallLoan, max: 6.67, depth: 1 },
    { label: "写入时效", value: row.timeliness, max: 3.33 },
  ];
  const lead =
    row.bureau === 0
      ? "征信局或公共登记未运转，或覆盖 15–64 岁人口不足 5%，或截至采集截止日未出信用报告。"
      : "征信局或公共登记在运转。信用信息覆盖满分表示个人与企业贷款数据都共享给金融机构。数据来源满分表示金融机构之外另有来源。";
  return { value: `${lead}${source}`, links: BREADY_LINKS, bars };
}

function smartphoneRow(row: { urban: number; rural: number } | undefined): Omit<InfraRegRow, "label"> {
  const links = [GSMA.fileUrl];
  if (!row) {
    return {
      value: "GSMA Consumer Survey 2024 没有该国读数。该调查只覆盖 15 个中低收入经济体，并只分城镇和农村。",
      links,
    };
  }
  return {
    value: `城镇成年人口（18 岁及以上）${row.urban}%，农村 ${row.rural}%。本人单独或主要使用的智能手机。GSMA Consumer Survey 2024。这一调查没有给出全国单一占比。`,
    links,
  };
}

function internetRow(code: string, row: OpenCountry | undefined): Omit<InfraRegRow, "label"> {
  const links = [`${OPEN.internet.url}?locations=${code}`];
  const obs = row?.internet;
  if (!obs) {
    return {
      value: "世界银行 WDI IT.NET.USER.ZS（国际电信联盟）在 2015–2025 没有该国读数。",
      links,
    };
  }
  return {
    value: `过去三个月使用过互联网的人口 ${pct1(obs.value)}（${obs.year}）。国际电信联盟，世界银行 WDI IT.NET.USER.ZS。`,
    links,
  };
}

function enforceRow(row: OpenCountry | undefined): Omit<InfraRegRow, "label"> {
  const links = [DB_ENFORCE, DB_FILE];
  if (!row || (row.enforceDays == null && row.judgmentDays == null && !row.dbScope)) {
    return {
      value: "Doing Business 2020（数据采集截至 2019-05）纠错历史表没有该国的合同执行天数。",
      links,
    };
  }
  const days: string[] = [];
  if (row.enforceDays != null) days.push(`商业合同从起诉到付款 ${daysText(row.enforceDays)}`);
  else days.push("从起诉到付款的天数无读数");
  if (row.judgmentDays != null) days.push(`其中判决执行 ${daysText(row.judgmentDays)}（上诉期届满至收回款项）`);
  else days.push("判决执行天数无读数");
  const bars: InfraScoreBar[] = [];
  if (row.enforceScore != null && row.timeScore != null && row.costScore != null && row.qualityScore != null) {
    bars.push(
      { label: "合同执行", value: row.enforceScore, max: 100 },
      { label: "时间", value: row.timeScore, max: 100, depth: 1 },
      { label: "成本", value: row.costScore, max: 100, depth: 1 },
      { label: "司法程序质量", value: row.qualityScore, max: 100, depth: 1 },
    );
  }
  if (
    row.qualityIndex != null &&
    row.courtStructure != null &&
    row.caseManagement != null &&
    row.courtAutomation != null &&
    row.adr != null
  ) {
    bars.push(
      { label: "质量指数", value: row.qualityIndex, max: 18 },
      { label: "法庭结构与程序", value: row.courtStructure, max: 5, depth: 1 },
      { label: "案件管理", value: row.caseManagement, max: 6, depth: 1 },
      { label: "法庭自动化", value: row.courtAutomation, max: 4, depth: 1 },
      { label: "替代争议解决", value: row.adr, max: 3, depth: 1 },
    );
  }
  return {
    value: `${days.join("，")}。Doing Business 2020，数据采集截至 2019-05。世界银行纠错后历史表。${dbScope(row)}`,
    links,
    bars: bars.length ? bars : undefined,
  };
}

export function cashloanInfraRows(code: string): InfraRegRow[] {
  const hit = BY_COUNTRY[code];
  const open = OPEN.byCode[code];
  return LABELS.map((label) => {
    if (label === "征信覆盖率") return { label, ...creditRow(open) };
    if (label === "信用信息") return { label, ...creditInfoRow(BREADY.byCode[code]) };
    if (label === "智能手机") return { label, ...smartphoneRow(GSMA.byCode[code]) };
    if (label === "移动互联网") return { label, ...internetRow(code, open) };
    if (label === "司法债务执行") return { label, ...enforceRow(open) };
    const row = hit?.[label];
    return { label, value: row?.value ?? GAP, links: row?.links ?? [] };
  });
}
