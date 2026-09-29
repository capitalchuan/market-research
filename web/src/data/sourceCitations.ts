import { INDUSTRY_RESEARCH_LIBRARY } from "./industryResearchLibrary";
import { FINTECH_STOCK_SOURCE_LINKS } from "./fintechStockSourceLinks";

export type SourceCiteKind =
  | "macro"
  | "regulator"
  | "research"
  | "traffic"
  | "news"
  | "bond"
  | "secondary"
  | string;

export type SourceCitation = {
  /** 展示编号（稳定） */
  no: number;
  id: string;
  title: string;
  kind: SourceCiteKind;
  url?: string;
  asOf?: string;
  /** 所属研报 id（若来自研报库 sources[]） */
  reportId?: string;
  note?: string;
};

/** 核心长期信源：固定编号，勿随意改号以免正文失效 */
export const CORE_SOURCE_CITATIONS: SourceCitation[] = [
  {
    no: 1,
    id: "te",
    title: "Trading Economics（宏观聚合）",
    kind: "macro",
    url: "https://zh.tradingeconomics.com/",
    note: "国别指标默认出处；零售汽油见 Gasoline Prices 国别表（USD/升）；二级读数亦常经此聚合",
    asOf: "2026-08",
  },
  {
    no: 2,
    id: "diandian",
    title: "点点数据（流量/商店监测）",
    kind: "traffic",
    note: "下载/MAU/上下架；见行业研报库点点专题",
  },
  {
    no: 3,
    id: "moteng",
    title: "墨腾创投（Momentum Works）",
    kind: "research",
    note: "东南亚平台与金融科技专题",
  },
  {
    no: 4,
    id: "ojk",
    title: "OJK（印尼金监）官方/RDKB",
    kind: "regulator",
    url: "https://www.ojk.go.id/",
    note: "P2P/BNPL 余额与 POJK；媒体转述须回指本号或子条目",
  },
  {
    no: 5,
    id: "bsp",
    title: "BSP（菲律宾央行）",
    kind: "regulator",
    url: "https://www.bsp.gov.ph/",
    note: "数字支付年报、Circular 1133 等",
  },
  {
    no: 6,
    id: "sec-ph",
    title: "SEC Philippines（线上放贷/OLP）",
    kind: "regulator",
    url: "https://www.sec.gov.ph/",
    note: "Lending/Financing/OLP 登记与执法",
  },
  {
    no: 7,
    id: "rm",
    title: "Research and Markets（媒体摘要）",
    kind: "research",
    url: "https://www.researchandmarkets.com/",
    note: "BNPL 美元规模等；与监管余额分轨，不作主尺",
  },
  {
    no: 8,
    id: "imf",
    title: "IMF / WEO",
    kind: "macro",
    url: "https://www.imf.org/",
  },
  {
    no: 9,
    id: "chinamoney",
    title: "中国货币网（银行间债/ABN）",
    kind: "bond",
    url: "https://www.chinamoney.com.cn/",
  },
  {
    no: 10,
    id: "wb-secondary",
    title: "世界银行/二级统计转述",
    kind: "secondary",
    url: "https://data.worldbank.org/",
    note: "外储、私营信贷/GDP 等二级口径",
  },
  {
    no: 11,
    id: "bisnis",
    title: "Bisnis.com（OJK 媒体转述）",
    kind: "news",
    url: "https://finansial.bisnis.com/",
  },
  {
    no: 12,
    id: "detik-finance",
    title: "Detik Finance（OJK 媒体转述）",
    kind: "news",
    url: "https://finance.detik.com/",
  },
  {
    no: 13,
    id: "frankfurter",
    title: "Frankfurter（ECB 参考汇率序列）",
    kind: "macro",
    url: "https://www.frankfurter.app/",
    note: "年内汇率波幅/多周走势；与 TE 即期水平分轨",
  },
  {
    no: 14,
    id: "bis",
    title: "BIS（家庭信贷/GDP 等）",
    kind: "macro",
    url: "https://data.bis.org/",
    note: "WS_TC 家庭债务/GDP 等；与 TE 杠杆读数交叉",
  },
  {
    no: 15,
    id: "owid",
    title: "Our World in Data（转载世行等）",
    kind: "secondary",
    url: "https://ourworldindata.org/",
    note: "GNI/人 PPP 等转载；非住户可支配收入一手",
  },
  {
    no: 16,
    id: "yahoo-finance",
    title: "腾讯行情 + Yahoo Finance（上市公司股价/市值）",
    kind: "market_data",
    url: "https://finance.yahoo.com/",
    note: "抓取以腾讯 qt.gtimg.cn 为主、Yahoo 回退；观察池报价页仍挂 Yahoo；落库 fintech-stock-quotes",
  },
  {
    no: 17,
    id: "sec-edgar",
    title: "SEC EDGAR（美股定期披露）",
    kind: "disclosure",
    url: "https://www.sec.gov/edgar/search/",
    note: "6-K/10-Q/8-K 原文；与 T2 listed-player-disclosure / fintech-stock-earnings 交叉",
  },
  {
    no: 18,
    id: "hkexnews",
    title: "港交所披露易",
    kind: "disclosure",
    url: "https://www.hkexnews.hk/",
    note: "港股年报/业绩公告；维信等 HKEX 标的",
  },
  {
    no: 19,
    id: "listed-exchanges",
    title: "本地交易所门户（上市观察池）",
    kind: "exchange",
    note: "NSE/IDX/SET/JSE/EGX/Tadawul/BMV/B3/PSE/KASE 等；展开条目见信源目录「上市公司」与 fintech-stock-source-links",
  },
  {
    no: 20,
    id: "listed-player-disclosure",
    title: "上市定期披露 KPI 缓存（T2）",
    kind: "disclosure",
    note: "listed-player-disclosure → fintech-stock-earnings；玩家卡与上市公司页共用；公司 IR 展开见信源目录",
  },
  {
    no: 21,
    id: "chuhai-xiaheiban",
    title: "出海小黑板（海外现金贷/投放·财报解读）",
    kind: "research",
    url: "https://mp.weixin.qq.com/s/YiR4UKOwOg4cnIiLRj4yOA",
    note: "微信公众号；FinVolution 海外业务解读与印尼利率短笺等；置信中，须与 IR/OJK 原文交叉",
  },
  {
    no: 22,
    id: "global-petrol-prices",
    title: "GlobalPetrolPrices（居民电价）",
    kind: "macro",
    url: "https://www.globalpetrolprices.com/electricity_prices/",
    note: "居民/工商业电价 USD/kWh（含税）；与 TE 零售汽油〔1〕分轨；油电比=汽油÷电价；补贴国读数易低估实际负担",
    asOf: "2026-01",
  },
  {
    no: 23,
    id: "te-gasoline",
    title: "Trading Economics · 零售汽油国别表",
    kind: "macro",
    url: "https://tradingeconomics.com/country-list/gasoline-prices?continent=world",
    note: "泵价 Gasoline Prices（USD/Liter）；地图宏观「零售汽油」主尺；与〔1〕同系，专链国别对照表",
    asOf: "2026-07",
  },
  {
    no: 24,
    id: "nev-tariff-vat",
    title: "新能源 HS 关税分列 / 本地增值税（海关税则与税法）",
    kind: "regulator",
    note:
      "分列：①HS8703 BEV/CBU 整车（地图主尺 nevImportTariff）②CKD/SKD 组装路径（nevHsCkd，常拆 8707+零部件）③HS8507.60 锂电（nevHsBattery）④HS8501 驱动电机（nevHsMotor）；另本地出厂 VAT·GST·IVA。优先官方税则/WTO·WITS/财政法令；激励窗口与新闻辅证标「待双端」；不含购置税/首次登记税除非文案明示",
    asOf: "2026-08",
  },
  {
    no: 25,
    id: "yidaiyilu",
    title: "中国一带一路网（国别页 / 各国数据）",
    kind: "research",
    url: "https://www.yidaiyilu.gov.cn/",
    note: "国别概况、对华进出口与直接投资序时；/country/{英文名} 与 /dataChart；与 TE/IMF 宏观分轨",
    asOf: "2026-08",
  },
];

const KIND_LABEL: Record<string, string> = {
  macro: "宏观",
  regulator: "监管",
  research: "研报",
  traffic: "流量",
  news: "新闻",
  bond: "债券",
  secondary: "二级",
  market_data: "行情",
  disclosure: "披露",
  exchange: "交易所",
};

const KIND_LABEL_EN: Record<string, string> = {
  macro: "Macro",
  regulator: "Regulator",
  research: "Research",
  traffic: "Traffic",
  news: "News",
  bond: "Bond",
  secondary: "Secondary",
  market_data: "Market data",
  disclosure: "Disclosure",
  exchange: "Exchange",
};

export function sourceCiteKindLabel(kind: string, lang: "zh" | "en" = "zh"): string {
  if (lang === "en") return KIND_LABEL_EN[kind] || kind;
  return KIND_LABEL[kind] || kind;
}

/** 〔12〕 或兼容 [S12] */
export const SOURCE_CITE_RE = /〔(\d+)〕|\[S(\d+)\]/g;

export function citeMark(no: number): string {
  return `〔${no}〕`;
}

export function parseCiteNos(text: string): number[] {
  const out: number[] = [];
  const re = new RegExp(SOURCE_CITE_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text || ""))) {
    const n = Number(m[1] || m[2]);
    if (Number.isFinite(n) && !out.includes(n)) out.push(n);
  }
  return out;
}

/** 去掉「待双端」字样，改为出处编号（默认 TE=1；含「二级」时加 10） */
export function replacePendingDualWithCites(text: string): string {
  if (!text) return text;
  let s = text;
  s = s.replace(/·二级·待双端/g, `·二级${citeMark(10)}`);
  s = s.replace(/二级·待双端/g, `二级${citeMark(10)}`);
  s = s.replace(/·待双端/g, citeMark(1));
  s = s.replace(/待双端/g, citeMark(1));
  return s;
}

function researchLibraryCitations(startNo: number): SourceCitation[] {
  const rows: SourceCitation[] = [];
  let n = startNo;
  for (const report of INDUSTRY_RESEARCH_LIBRARY.reports || []) {
    const pack = (report.docKind || report.sourceType || "").includes("regulator") ||
      (report.docKind || "") === "regulator_pack" ||
      (report.docKind || "") === "market_stats_relay";
    rows.push({
      no: n++,
      id: `report:${report.id}`,
      title: report.title,
      kind: pack ? "regulator" : "research",
      asOf: report.asOf,
      reportId: report.id,
      note: `${pack ? "监管/信源包" : "研报"} · ${report.publisher} · ${report.period}`,
    });
    for (const src of report.sources || []) {
      rows.push({
        no: n++,
        id: src.id,
        title: src.title,
        kind:
          src.type.includes("regulator")
            ? "regulator"
            : src.type.includes("news")
              ? "news"
              : src.type.includes("research") || src.type.includes("third_party")
                ? "research"
                : pack
                  ? "regulator"
                  : "research",
        url: src.url,
        asOf: src.asOf,
        reportId: report.id,
        note: (src.bullets || []).slice(0, 2).join("；"),
      });
    }
  }
  return rows;
}

/** 上市观察池：交易所门户 + 公司财报/IR（接在研报库编号之后） */
function fintechStockLibraryCitations(startNo: number): SourceCitation[] {
  const rows: SourceCitation[] = [];
  let n = startNo;
  const asOf = FINTECH_STOCK_SOURCE_LINKS.asOf;
  for (const ex of FINTECH_STOCK_SOURCE_LINKS.exchanges || []) {
    rows.push({
      no: n++,
      id: `listed-ex:${ex.name}`,
      title: `交易所 · ${ex.name}`,
      kind: "exchange",
      url: ex.url,
      asOf,
      note: "观察池〔19〕展开 · fintech-stock-source-links",
    });
  }
  for (const c of FINTECH_STOCK_SOURCE_LINKS.companies || []) {
    if (!c.irUrl) continue;
    rows.push({
      no: n++,
      id: `listed-ir:${c.id}`,
      title: `${c.nameZh} · 财报/IR`,
      kind: "disclosure",
      url: c.irUrl,
      asOf: c.period || asOf,
      note: [c.symbol || c.yahoo, c.exchange, c.sourceNote].filter(Boolean).join(" · "),
    });
  }
  return rows;
}

export function isListedStockCitation(c: SourceCitation): boolean {
  return c.id.startsWith("listed-ex:") || c.id.startsWith("listed-ir:");
}

let _catalog: SourceCitation[] | null = null;

export function getSourceCitationCatalog(): SourceCitation[] {
  if (_catalog) return _catalog;
  const byNo = new Map<number, SourceCitation>();
  for (const c of CORE_SOURCE_CITATIONS) byNo.set(c.no, c);
  const research = researchLibraryCitations(22);
  for (const c of research) {
    if (!byNo.has(c.no)) byNo.set(c.no, c);
  }
  const nextNo = (research.length ? Math.max(...research.map((c) => c.no)) : 20) + 1;
  for (const c of fintechStockLibraryCitations(nextNo)) {
    if (!byNo.has(c.no)) byNo.set(c.no, c);
  }
  _catalog = [...byNo.values()].sort((a, b) => a.no - b.no);
  return _catalog;
}

export function getSourceCitation(no: number): SourceCitation | undefined {
  return getSourceCitationCatalog().find((c) => c.no === no);
}

export function findSourceCitationById(id: string): SourceCitation | undefined {
  return getSourceCitationCatalog().find((c) => c.id === id);
}

/** 研报库 source.id → 编号（供正文手写对照） */
export function citeNoForSourceId(id: string): number | undefined {
  return findSourceCitationById(id)?.no;
}
