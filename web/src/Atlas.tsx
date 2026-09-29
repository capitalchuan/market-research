import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  CollapsibleSection,
  Divider,
  Grid,
  H1,
  H2,
  IconButton,
  Link,
  Pill,
  Row,
  Select,
  Stack,
  Stat,
  Table,
  Text,
  TextInput,
  UsageBar,
  mergeStyle,
  useCanvasState,
  useHostTheme,
} from "./shims/cursor-canvas";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ScreenSegChip, ScreenSegTrack, ScreenStatusPills, AtlasSideRail } from "./HeatMapChrome";
import {
  DATA_QUALITY_LABEL,
  NBFC_STATS,
  downloadNbfcXlsx,
  type NbfcDataQuality,
} from "./data/nbfcCountryStats";
import {
  STORE_RANK_FINANCE,
  compareByStoreRank,
  countRanksForCountry,
  lookupStoreRank,
  storeRankSortOptions,
  type StoreRankSortMode,
} from "./data/storeRankFinance";
import { FullMarketChoropleth, ScreenImfWbFilterBar } from "./FullMarketChoropleth";
import { MacroHeatGlobe } from "./MacroHeatGlobe";
import { MACRO_MAP_FACTORS, type MacroMapFactorId } from "./data/macroMapMetrics";
import { canViewSourceCite } from "./authAccess";
import { VitalPyramid } from "./VitalPyramid";
import { getVitalCountry } from "./data/vitalSeries";
import { CreditDebtCharts, FxCaCharts, IncomeSectorCharts, StressPricingCharts } from "./MacroFactorCharts";
import { MORNING_BRIEF_36KR } from "./data/morningBrief36kr";
import { CC_WATCH_DIGEST, diandianBucketLabel } from "./data/ccWatchDigest";
import {
  DISASTER_WATCH_DIGEST,
  disasterCountForCountry,
  disasterKindLabel,
} from "./data/disasterWatchDigest";
import { CC_SOURCE_TIERS } from "./data/ccSourceTiers";
import {
  ensureFlashChinese,
  flashConcreteTitle,
} from "./data/financeAbbrGlossary";
import { GlossedText } from "./GlossedText";
import {
  FINTECH_STOCK_QUOTES,
  FINTECH_STOCK_REGION_ORDER,
  FINTECH_STOCK_ORIGIN_ORDER,
  fintechStockRegionLabel,
  fintechStockOriginLabel,
  fintechStockCountryLabel,
  fintechStockCountryLine,
  formatChangePct,
  formatQuotePrice,
  formatMarketCap,
  formatPeRatio,
  fintechStockMonitorQuotes,
  FINTECH_STOCK_MONITOR_DEFAULT_IDS,
  type FintechStockQuote,
} from "./data/fintechStockQuotes";
import {
  resolveFintechStockEarning,
  pickFintechFundamental,
  fintechFundamentalSortValue,
  FINTECH_FUNDAMENTAL_COLS,
  type FintechFundSortKey,
} from "./data/fintechStockEarnings";
import {
  resolveListedDisclosure,
  listedDisclosureStats,
  listedCoverageByRegion,
  LISTED_ORIGIN_LABEL,
  LISTED_REGION_LABEL,
} from "./data/listedPlayerDisclosure";
import {
  resolveCompetitiveIntel,
  competitiveQueueStats,
  COMPETITIVE_LAYER_LABEL,
} from "./data/playerCompetitiveIntel";
import {
  licenseCreditPriorityStats,
  LICENSE_CREDIT_TRACK_LABEL,
} from "./data/countryLicenseCreditPriority";
import {
  INDUSTRY_RESEARCH_LIBRARY,
  docKindLabel,
  isResearchReportDoc,
  latestResearchReports,
  latestSourcePacks,
  resolveResearchHitsForGroup,
} from "./data/industryResearchLibrary";
import {
  citeMark,
  getSourceCitation,
  getSourceCitationCatalog,
  isListedStockCitation,
  parseCiteNos,
  SOURCE_CITE_RE,
  sourceCiteKindLabel,
} from "./data/sourceCitations";
import {
  PAYMENT_KIND_BLURB,
  PAYMENT_KIND_LABEL,
  PAYMENT_KIND_ORDER,
  PAYMENT_SERVICE_ROSTER,
  type PaymentServiceKind,
} from "./data/paymentServiceRoster";
import {
  EQUITY_INVESTOR_ROSTER,
  EQUITY_KIND_BLURB,
  EQUITY_KIND_LABEL,
  EQUITY_KIND_ORDER,
  equityMatchGroup,
  type EquityInvestorKind,
} from "./data/equityInvestorRoster";
import { AGENT_SCENE_LEAVES, AI_PRODUCT_RANK_36KR } from "./data/aiProductRank36kr";
import {
  buildCashLoanMacroGroups,
  collectCountryMacroCiteNos,
  displayCreditNote,
  getCountryMacro,
  synthesizeCashLoanBrief,
  type CashLoanMacroGroup,
} from "./data/countryMacro";
import { CitedText, MacroAsOfLine, MacroSourcesBlock, useSourceCiteReturn } from "./SourceCite";
import {
  COUNTRY_LANGUAGE,
  LANGUAGE_ZONE_ORDER,
  countriesInLanguageZone,
  countryLanguageZone,
  formatCountryLanguageLine,
  getCountryLanguage,
} from "./data/countryLanguage";
import phSecLendingRoster from "./data/ph-sec-lending-roster.json";
import inNbfcDigitalRoster from "./data/in-nbfc-digital-roster.json";



/**
 * 分类（用户口径）
 * CRM 主档：机构（Institution）优先
 *    - 系统内先建机构并做 KYC；唯一识别=机构证件号码
 *    - 机构主体：以集团金融及金融生态服务为主业核心的控股主体
 *    - 机构类型：玩家（下场）| 流量服务商 | 数据服务方 | 监管 | 资金参与机构 | 风险参与机构 | 股权投资人
 *               | 风控服务方 | 支付服务机构 | 回收机构 | 权益服务商 | 触达服务机构
 *               | 公关服务机构 | 信托服务机构 | 会计师事务所 | 律师事务所 | 评级机构
 *    - 资金参与机构细分：本地银行 | 本地银行代理 | 结构化服务商 | 优先投资人 | 夹层投资人
 *    - 流量服务商细分：流量平台 | 代理商 | 贷超 | 代理运营
 *    - 流量平台：Google / Meta / TikTok / Apple，及 Snap、X、LinkedIn、Taboola、Outbrain 等
 *    - 代理商：授权代理/Partner 目录入口、蓝标等 Reseller/Agency；≠现金贷掮客
 *    - 贷超：LendingTree / Credit Karma / Cermati 等比价导流；部分市场需持牌
 *    - 代理运营：代运营、ASO/ASA、榜单与监测（点点、七麦、AppsFlyer/Adjust 等）
 *    - 标准可采信源：STANDARD_TRAFFIC_SOURCES（各平台广告政策页 + Partner 官方目录）
 * 经营性征（挂机构；可演变）：原生路径（场景原生|信贷原生，二分不重不漏）· 国家/地区 · 场景 · 金融产品 · 牌照
 * 信源（机构进出市场；系统定期检索引入；亦可人工创建；未来可扩信源）：
 *    - 流量源 · 监管源 · 经办认领（客户经理联系确认，对信息质量负责）
 *    - 情报源 · 行业情报库（研报 research_report + 监管/信源包 regulator_pack 分轨）：见 INDUSTRY_RESEARCH_LIBRARY
 *    - 研报源 · 墨腾创投（Momentum Works / 微信「墨腾创投」）：东南亚平台与金融科技长期学习源；见 MOTENG_LEARNED
 *    - 宏观源 · Trading Economics：国家/地区维度；入口 hub=macro（与机构类型同级点选）；框架见 MacroFactorFrameworkOverview；单国卡片 CountryMacroPanel / COUNTRY_MACRO
 *    - 债券源 · 中国货币网（chinamoney.com.cn / .org.cn）：银行间债市发行/流通/兑付/评级披露；核验国内 ABS·ABN·企业债等；见 CHINAMONEY_BOND
 *    - 上市源 · 腾讯/Yahoo/SEC/披露易/本地交易所 + T2 KPI 缓存：顶栏「上市公司」；见〔16〕–〔20〕、fintech-stock-source-links（信源目录展开）
 *    - 场景 taxonomy 源 · 线上数字经济场景（Web2/Web3/Agent；见 SCENE_WIDE_TABLE / WEB3_SCENE_WIDE_TABLE）
 *    - 广告平台 Partner 目录源 · Meta/Google/TikTok/Apple Search Ads 官方目录（见 STANDARD_TRAFFIC_SOURCES）
 *    - 信源核实不作前端筛选标签；展开详情展示；多源齐备可给完整验证角标，提示客户经理用更高质量信源跟进
 * 命名：当地公司名｜APP名｜集团名（中国业内俗称·国家地区简称）
 */

type Region =
  | "all"
  | "east-asia"
  | "se-asia"
  | "south-asia"
  | "central-asia"
  | "latam"
  | "mena"
  | "africa"
  | "west";

type Primary = "all" | "scene" | "credit";
/** 数据行产品线（库内粗类；筛选树见 CreditProd*） */
type CreditLine = "all" | "cash" | "bnpl" | "lease" | "agent";
/** @deprecated 已由 CreditProdL1/L2/L3 树替代；保留兼容旧调用 */
type ProductFilter = CreditLine | "card";

/** 涉足信贷产品 · 一级 */
type CreditProdL1 = "all" | "个人信贷" | "企业信贷" | "信贷超市" | "信贷其他";
/** 涉足信贷产品 · 二级（个人下分类 / 企业与信贷其他下叶子） */
type CreditProdL2 =
  | "all"
  | "消费信贷"
  | "住房信贷"
  | "汽车信贷"
  | "流贷"
  | "固贷"
  | "提前收款"
  | "订单融资"
  | "发票融资"
  | "学生贷"
  | "农户贷"
  | "公务员贷";
/** 涉足信贷产品 · 三级叶子（消费/住房/汽车） */
type CreditProdL3 =
  | "all"
  | "现金贷"
  | "消费分期/BNPL"
  | "信用卡"
  | "信用租赁"
  | "按揭贷"
  | "抵押贷"
  | "新车贷"
  | "二手车贷";

type SubsidyFlag = "all" | "yes" | "no";
type SubsidyRole = "商户" | "政府" | "平台" | "其他";
type GuaranteeFlag = "all" | "yes" | "no";
type GuaranteeRole = "商户" | "政府" | "平台" | "担保/保险公司" | "其他";
/** 涉足国家/地区（筛选；与洲际 region 正交） */
type CountryCode =
  | "all"
  | "CN"
  | "HK"
  | "MO"
  | "TW"
  | "JP"
  | "KR"
  | "MN"
  | "ID"
  | "VN"
  | "MY"
  | "TH"
  | "PH"
  | "SG"
  | "IN"
  | "BD"
  | "PK"
  | "LK"
  | "KZ"
  | "UZ"
  | "KG"
  | "TJ"
  | "TM"
  | "MX"
  | "BR"
  | "CO"
  | "AR"
  | "PE"
  | "CL"
  // 中东与北非
  | "EG"
  | "MA"
  | "DZ"
  | "TN"
  | "LY"
  | "SD"
  | "SA"
  | "AE"
  | "BH"
  | "QA"
  | "KW"
  | "OM"
  | "JO"
  | "LB"
  | "IQ"
  | "IL"
  | "PS"
  | "TR"
  | "YE"
  | "IR"
  // 非洲（撒哈拉以南为主）
  | "NG"
  | "KE"
  | "GH"
  | "ZA"
  | "TZ"
  | "UG"
  | "RW"
  | "ET"
  | "CI"
  | "SN"
  | "CM"
  | "AO"
  | "MZ"
  | "ZM"
  | "ZW"
  | "BW"
  | "NA"
  | "MU"
  | "MG"
  | "BJ"
  | "BF"
  | "ML"
  | "CD"
  | "GA"
  // 欧美
  | "US"
  | "CA"
  | "GB"
  | "DE"
  | "FR"
  | "NL"
  | "ES"
  | "PT"
  | "IT"
  | "SE"
  | "PL"
  | "IE"
  | "RU";
/** 信贷横切标签：与三产品线正交（现金贷/消费分期/信用租赁均可兼发） */
type CreditTag = "信用卡";
/** 涉及金融牌照（粗类；明细在 licenseReg）。「其他」= 证券/租赁/征信等明确非四类牌照 */
type LicenseKind = "银行" | "保险" | "支付" | "消金小贷" | "其他";
/**
 * 机构类型（CRM）：先有机构，再挂类型。玩家=下场；其余=非下场生态角色。
 * 玩家排在流量服务商之前。
 */
type InstitutionType =
  | "玩家"
  | "流量服务商"
  | "数据服务方"
  | "监管"
  | "资金参与机构"
  | "风险参与机构"
  | "股权投资人"
  | "风控服务方"
  | "支付服务机构"
  | "回收机构"
  | "权益服务商"
  | "触达服务机构"
  | "公关服务机构"
  | "信托服务机构"
  | "会计师事务所"
  | "律师事务所"
  | "评级机构";
/** 生态角色 ⊂ 机构类型（非玩家） */
type EcoRole = Exclude<InstitutionType, "玩家">;
/** 资金参与机构细分（挂在「资金参与机构」类型下） */
type FundParticipationKind =
  | "本地银行"
  | "本地银行代理"
  | "结构化服务商"
  | "优先投资人"
  | "夹层投资人";
/** 流量服务商细分（挂在「流量服务商」类型下） */
type TrafficServiceKind = "流量平台" | "代理商" | "贷超" | "代理运营";
/** 支付服务机构细分（挂在「支付服务机构」类型下） */
type PaymentKind = PaymentServiceKind;
/** 信源渠道（引入/核实机构；非经营性征标签） */
type SourceChannel = "流量源" | "监管源" | "经办认领";
/** 场景多标签（一玩家可多选）；「信用管理」横切亦可挂场景侧；大宽表+Web3 To C */
type SceneTag =
  | "电商"
  | "出行"
  | "外卖"
  | "社交"
  | "支付钱包"
  | "游戏"
  | "直播"
  | "信用管理"
  | "金融"
  | "艺术"
  | "内容资讯"
  | "企业服务"
  | "法律服务"
  | "本地生活"
  | "在线教育"
  | "在线医疗"
  | "Web3";
/** 场景二级（数字化经营大宽表 + Web3 To C；历史侨汇→跨境支付/汇款） */
type SceneSubTag =
  | "综合电商"
  | "垂直电商"
  | "社交电商"
  | "跨境电商"
  | "二手/闲置"
  | "网约车"
  | "顺风车/拼车"
  | "共享单车/电单车"
  | "地图/导航"
  | "代驾"
  | "餐饮外卖"
  | "即时零售/闪购"
  | "生鲜电商"
  | "药品配送"
  | "即时通讯"
  | "社区/论坛"
  | "陌生人社交"
  | "职场社交"
  | "婚恋/相亲"
  | "移动支付"
  | "跨境支付/汇款"
  | "数字银行/虚拟账户"
  | "预付卡/储值"
  | "聚合支付"
  | "手游"
  | "端游/页游"
  | "云游戏"
  | "游戏平台/分发"
  | "电竞/赛事"
  | "娱乐直播"
  | "游戏直播"
  | "电商直播/带货"
  | "教育直播"
  | "企业直播/会议"
  | "征信查询"
  | "信用评分/画像"
  | "反欺诈服务"
  | "债务管理/催收"
  | "短视频"
  | "中长视频/流媒体"
  | "新闻资讯/聚合"
  | "知识付费/专栏"
  | "播客/音频"
  | "企业通讯/协同"
  | "项目管理"
  | "云存储/云服务"
  | "在线文档/表格"
  | "电子签章"
  | "电子合同"
  | "在线公证/存证"
  | "法律咨询/智能法务"
  | "到店团购"
  | "酒店/民宿预订"
  | "票务/电影/演出"
  | "家政/保洁服务"
  | "美容/美发预约"
  | "K12学科辅导"
  | "语言学习"
  | "职业教育/考证"
  | "兴趣/素质教育"
  | "企业培训/SaaS化"
  | "在线问诊"
  | "药品电商/配送"
  | "健康管理/慢病"
  | "心理咨询"
  | "体检预约"
  | "中心化交易所（CEX）"
  | "去中心化交易所（DEX）"
  | "NFT交易市场"
  | "自托管钱包"
  | "托管钱包"
  | "硬件钱包"
  | "借贷协议"
  | "稳定币兑换/持有"
  | "质押生息"
  | "流动性挖矿"
  | "链游玩赚"
  | "游戏资产交易"
  | "游戏公会参与"
  | "去中心化社交"
  | "创作者代币"
  | "内容打赏"
  | "PFP头像/身份"
  | "音乐/艺术收藏"
  | "品牌会员/权益"
  | "票务/入场凭证"
  | "稳定币汇款"
  | "加密货币支付"
  | "抗通胀储蓄";
/** @deprecated 已取消租赁二级分类；保留类型仅兼容旧草稿字段 */
type LeaseSubTag = "游戏租赁";
/**
 * 信源核实结果（非玩家标签）：多信源交叉后的完备度摘要，仅展开详情展示。
 * 内部枚举值兼容历史数据；展示文案见 VERIFY_LABEL。
 */
type VerifyStatus = "双端通过" | "仅流量" | "仅监管" | "待双端" | "冲突观察";

type SceneRow = {
  region: Exclude<Region, "all">;
  group: string;
  /**
   * CRM 机构证件号码（唯一识别）。各国公司注册号/税号/统一社会信用代码等；KYC 必填目标。
   */
  orgDocNo: string;
  /** CRM 机构类型：含「玩家」及/或各类生态角色 */
  institutionTypes: InstitutionType[];
  /** 涉足场景 */
  tags: SceneTag[];
  /** 二级场景（挂在一级之下，如跨境支付/汇款⊂支付钱包） */
  subTags: SceneSubTag[];
  /** 由 tags+subTags 拼出的展示串（兼容旧口径） */
  sceneType: string;
  apps: string;
  countries: string;
  languages: string;
  mau: string;
  registered: string;
  share: string;
  creditAttach: string;
  /** 流量排名：GP/Apple/FB/点点/路飞/Sensor Tower等 */
  diandian: string;
  controller: string;
  equity: string;
  licenseReg: string;
  /** 涉及金融牌照粗类 */
  licenseKinds: LicenseKind[];
  trafficRank: string;
  /** 信源核实摘要（非标签） */
  verify: VerifyStatus;
};

type CreditRow = {
  region: Exclude<Region, "all">;
  line: "cash" | "bnpl" | "lease" | "agent";
  tier: "头腰" | "头部" | "腰部" | "新兴";
  group: string;
  /** CRM 机构证件号码（唯一识别） */
  orgDocNo: string;
  /** CRM 机构类型：玩家及/或生态角色 */
  institutionTypes: InstitutionType[];
  /** 资金参与机构细分；非资金参与机构则为空 */
  fundKinds: FundParticipationKind[];
  /** 流量服务商细分；非流量服务商则为空 */
  trafficKinds: TrafficServiceKind[];
  /** 支付服务机构细分；非支付服务机构则为空 */
  paymentKinds: PaymentKind[];
  /** 股权投资人细分；非股权投资人则为空 */
  equityKinds: EquityInvestorKind[];
  brands: string;
  countries: string;
  languages: string;
  licenses: string;
  /** 展业时点/运营节点（详情用；列表右侧优先用 founded） */
  timing: string;
  /** 成立时间（列表右侧展示） */
  founded: string;
  regulators: string;
  traffic: string;
  /** 年放款量（或最接近的年化放款/撮合口径） */
  volume: string;
  users: string;
  /** 员工人数 */
  employees: string;
  /** 流量排名摘要（兼容旧列；完整口径见 trafficRank） */
  diandian: string;
  note: string;
  /** 横切标签：可与三产品线并存（如发信用卡） */
  tags: CreditTag[];
  /** @deprecated 已取消租赁二级；finalize 恒为空 */
  leaseSubs: LeaseSubTag[];
  /**
   * @deprecated 请读 institutionTypes；line=agent 时含「流量」
   */
  ecoRoles: EcoRole[];
  controller: string;
  equity: string;
  licenseReg: string;
  licenseKinds: LicenseKind[];
  trafficRank: string;
  /** 信源核实摘要（非标签） */
  verify: VerifyStatus;
};

type SceneDraft = Omit<
  SceneRow,
  | "controller"
  | "equity"
  | "licenseReg"
  | "licenseKinds"
  | "trafficRank"
  | "verify"
  | "tags"
  | "subTags"
  | "sceneType"
  | "orgDocNo"
  | "institutionTypes"
> &
  Partial<
    Pick<
      SceneRow,
      | "controller"
      | "equity"
      | "licenseReg"
      | "licenseKinds"
      | "trafficRank"
      | "verify"
      | "tags"
      | "subTags"
      | "orgDocNo"
      | "institutionTypes"
    >
  > & {
    /** 草稿可写自由文案；finalize 时与 tags 合并归一 */
    sceneType?: string;
  };

type CreditDraft = Omit<
  CreditRow,
  | "controller"
  | "equity"
  | "licenseReg"
  | "licenseKinds"
  | "trafficRank"
  | "verify"
  | "tags"
  | "leaseSubs"
  | "ecoRoles"
  | "fundKinds"
  | "trafficKinds"
  | "paymentKinds"
  | "equityKinds"
  | "founded"
  | "employees"
  | "orgDocNo"
  | "institutionTypes"
> &
  Partial<
    Pick<
      CreditRow,
      | "controller"
      | "equity"
      | "licenseReg"
      | "licenseKinds"
      | "trafficRank"
      | "verify"
      | "tags"
      | "leaseSubs"
      | "ecoRoles"
      | "fundKinds"
      | "trafficKinds"
      | "paymentKinds"
      | "equityKinds"
      | "founded"
      | "employees"
      | "orgDocNo"
      | "institutionTypes"
    >
  >;

const VERIFY_LABEL: Record<VerifyStatus, string> = {
  双端通过: "多源齐备",
  仅流量: "仅流量源",
  仅监管: "仅监管源",
  待双端: "见出处编号",
  冲突观察: "冲突观察",
};

const REGION_LABEL: Record<Region, string> = {
  all: "全部洲际",
  "east-asia": "东亚",
  "se-asia": "东南亚",
  "south-asia": "南亚",
  "central-asia": "中亚",
  latam: "拉丁美洲",
  mena: "中东与北非",
  africa: "非洲",
  west: "欧美",
};

const COUNTRY_LABEL: Record<CountryCode, string> = {
  all: "全部",
  CN: "中国大陆",
  HK: "中国香港",
  MO: "中国澳门",
  TW: "中国台湾",
  JP: "日本",
  KR: "韩国",
  MN: "外蒙古",
  ID: "印度尼西亚",
  VN: "越南",
  MY: "马来西亚",
  TH: "泰国",
  PH: "菲律宾",
  SG: "新加坡",
  IN: "印度",
  BD: "孟加拉",
  PK: "巴基斯坦",
  LK: "斯里兰卡",
  KZ: "哈萨克斯坦",
  UZ: "乌兹别克斯坦",
  KG: "吉尔吉斯斯坦",
  TJ: "塔吉克斯坦",
  TM: "土库曼斯坦",
  MX: "墨西哥",
  BR: "巴西",
  CO: "哥伦比亚",
  AR: "阿根廷",
  PE: "秘鲁",
  CL: "智利",
  EG: "埃及",
  MA: "摩洛哥",
  DZ: "阿尔及利亚",
  TN: "突尼斯",
  LY: "利比亚",
  SD: "苏丹",
  SA: "沙特",
  AE: "阿联酋",
  BH: "巴林",
  QA: "卡塔尔",
  KW: "科威特",
  OM: "阿曼",
  JO: "约旦",
  LB: "黎巴嫩",
  IQ: "伊拉克",
  IL: "以色列",
  PS: "巴勒斯坦",
  TR: "土耳其",
  YE: "也门",
  IR: "伊朗",
  NG: "尼日利亚",
  KE: "肯尼亚",
  GH: "加纳",
  ZA: "南非",
  TZ: "坦桑尼亚",
  UG: "乌干达",
  RW: "卢旺达",
  ET: "埃塞俄比亚",
  CI: "科特迪瓦",
  SN: "塞内加尔",
  CM: "喀麦隆",
  AO: "安哥拉",
  MZ: "莫桑比克",
  ZM: "赞比亚",
  ZW: "津巴布韦",
  BW: "博茨瓦纳",
  NA: "纳米比亚",
  MU: "毛里求斯",
  MG: "马达加斯加",
  BJ: "贝宁",
  BF: "布基纳法索",
  ML: "马里",
  CD: "刚果（金）",
  GA: "加蓬",
  US: "美国",
  CA: "加拿大",
  GB: "英国",
  DE: "德国",
  FR: "法国",
  NL: "荷兰",
  ES: "西班牙",
  PT: "葡萄牙",
  IT: "意大利",
  SE: "瑞典",
  PL: "波兰",
  IE: "爱尔兰",
  RU: "俄罗斯",
};

/** 洲际 → 可选国家/地区（不含 all；选「全部洲际」时展示全部国家） */
const COUNTRIES_BY_REGION: Record<Exclude<Region, "all">, Exclude<CountryCode, "all">[]> = {
  "east-asia": ["CN", "HK", "MO", "TW", "JP", "KR", "MN"],
  "se-asia": ["ID", "VN", "MY", "TH", "PH", "SG"],
  "south-asia": ["IN", "BD", "PK", "LK"],
  "central-asia": ["KZ", "UZ", "KG", "TJ", "TM"],
  latam: ["MX", "BR", "CO", "AR", "PE", "CL"],
  mena: ["EG", "MA", "DZ", "TN", "LY", "SD", "SA", "AE", "BH", "QA", "KW", "OM", "JO", "LB", "IQ", "IL", "PS", "TR", "YE", "IR"],
  africa: ["NG", "KE", "GH", "ZA", "TZ", "UG", "RW", "ET", "CI", "SN", "CM", "AO", "MZ", "ZM", "ZW", "BW", "NA", "MU", "MG", "BJ", "BF", "ML", "CD", "GA"],
  west: ["US", "CA", "GB", "DE", "FR", "NL", "ES", "PT", "IT", "SE", "PL", "IE", "RU"],
};

function countriesForRegion(region: Region): CountryCode[] {
  if (region === "all") {
    return Object.keys(COUNTRY_LABEL) as CountryCode[];
  }
  return ["all", ...COUNTRIES_BY_REGION[region]];
}

/** 单国码（不含 all） */
type CountryCodeOne = Exclude<CountryCode, "all">;
/**
 * 国家筛选（兼容旧版单码字符串 + 多选数组）：
 * - `"all"`：不收窄
 * - 单码如 `"MX"`：只该国（持久化 country8 仍可能是这种）
 * - 数组：多选；从「全部」点掉一国 → 池内其余全选
 */
type CountryFilter = "all" | CountryCodeOne | CountryCodeOne[];

function regionCountryPool(region: Region): CountryCodeOne[] {
  return countriesForRegion(region).filter((c): c is CountryCodeOne => c !== "all");
}

/** 把持久化/半成品状态归一成 all | 单码数组 */
function normalizeCountryFilter(sel: unknown): "all" | CountryCodeOne[] {
  if (sel == null || sel === "all" || sel === "") return "all";
  if (Array.isArray(sel)) {
    const next = sel.filter((c): c is CountryCodeOne => typeof c === "string" && c !== "all");
    return next.length === 0 ? "all" : next;
  }
  if (typeof sel === "string") return [sel as CountryCodeOne];
  return "all";
}

function countryInRegion(country: CountryCode | CountryFilter, region: Region): boolean {
  const n = normalizeCountryFilter(country);
  if (n === "all" || region === "all") return true;
  const pool = new Set(regionCountryPool(region));
  return n.every((c) => pool.has(c));
}

function countryFilterSingle(sel: CountryFilter): CountryCodeOne | null {
  const n = normalizeCountryFilter(sel);
  return n !== "all" && n.length === 1 ? n[0] : null;
}

function matchesCountryFilter(group: string, countries: string, sel: CountryFilter): boolean {
  const n = normalizeCountryFilter(sel);
  if (n === "all") return true;
  return n.some((c) => matchesCountry(group, countries, c));
}

function pruneCountryFilter(sel: CountryFilter, region: Region): CountryFilter {
  const n = normalizeCountryFilter(sel);
  if (n === "all" || region === "all") return n === "all" ? "all" : n.length === 1 ? n[0] : n;
  const pool = new Set(regionCountryPool(region));
  const next = n.filter((c) => pool.has(c));
  if (next.length === 0) return "all";
  if (next.length === pool.size) return "all";
  return next.length === 1 ? next[0] : next;
}

/** 点「全部」或点某一国芯片后的下一状态 */
function toggleCountryFilter(sel: CountryFilter, k: CountryCode, region: Region): CountryFilter {
  const pool = regionCountryPool(region);
  const n = normalizeCountryFilter(sel);
  if (k === "all") return "all";
  if (n === "all") {
    // 全部 → 点掉一国 = 其余全选（如除中国大陆外）
    const next = pool.filter((c) => c !== k);
    return next.length === 0 ? "all" : next.length === 1 ? next[0] : next;
  }
  if (n.includes(k)) {
    const next = n.filter((c) => c !== k);
    return next.length === 0 ? "all" : next.length === 1 ? next[0] : next;
  }
  const next = [...n, k];
  if (next.length === pool.length && pool.every((c) => next.includes(c))) return "all";
  return next.length === 1 ? next[0] : next;
}

function isCountryChipActive(sel: CountryFilter, k: CountryCode): boolean {
  const n = normalizeCountryFilter(sel);
  if (k === "all") return n === "all";
  return n !== "all" && n.includes(k);
}

function formatCountryFilterLabel(sel: CountryFilter, region: Region): string | null {
  const n = normalizeCountryFilter(sel);
  if (n === "all") return null;
  const pool = regionCountryPool(region);
  if (n.length === pool.length - 1 && pool.length > 1) {
    const missing = pool.find((c) => !n.includes(c));
    if (missing) return `除${COUNTRY_LABEL[missing]}外`;
  }
  if (n.length === 1) return COUNTRY_LABEL[n[0]];
  if (n.length <= 3) return n.map((c) => COUNTRY_LABEL[c]).join("、");
  return `已选 ${n.length} 地`;
}

type LangZoneFilter = "all" | string;

/** 当前洲际下可选语言区（有国别语言档案的） */
function languageZonesForRegion(region: Region): string[] {
  const pool =
    region === "all"
      ? (Object.keys(COUNTRY_LANGUAGE) as string[])
      : regionCountryPool(region);
  const present = new Set<string>();
  for (const c of pool) {
    const z = countryLanguageZone(c);
    if (z) present.add(z);
  }
  return LANGUAGE_ZONE_ORDER.filter((z) => present.has(z));
}

function langZoneInRegion(langZone: LangZoneFilter, region: Region): boolean {
  if (langZone === "all") return true;
  return languageZonesForRegion(region).includes(langZone);
}

/** 洲际 × 语言区交叉后的国家芯片池 */
function countriesForRegionAndLang(region: Region, langZone: LangZoneFilter): CountryCode[] {
  const base = countriesForRegion(region);
  if (langZone === "all") return base;
  const allow = new Set(countriesInLanguageZone(langZone));
  return base.filter((c) => c === "all" || allow.has(c));
}

/** 监管页：地域对应的法定/常用牌照名（可点选过滤监管主体与持牌玩家） */
type RegLicenseDef = {
  id: string;
  country: Exclude<CountryCode, "all">;
  /** 列表展示名 */
  name: string;
  /** 命中监管机构 licenses/licenseReg/note/group */
  regulatorRe: RegExp;
  /** 命中玩家 licenseReg/licenses */
  holderRe: RegExp;
};

const REGULATORY_LICENSE_CATALOG: RegLicenseDef[] = [
  // —— 中国 ——
  {
    id: "CN-pay",
    country: "CN",
    name: "支付业务许可证",
    regulatorRe: /人民银行|PBOC|支付|央行/i,
    holderRe: /支付|非银行支付|支付业务/i,
  },
  {
    id: "CN-bank",
    country: "CN",
    name: "商业银行",
    regulatorRe: /金管总局|NFRA|银保监|银行/i,
    holderRe: /商业银行|银行牌照|吸储/i,
  },
  {
    id: "CN-consumer",
    country: "CN",
    name: "消费金融",
    regulatorRe: /金管总局|NFRA|银保监|消金|消费金融/i,
    holderRe: /消金|消费金融/i,
  },
  {
    id: "CN-micro",
    country: "CN",
    name: "小额贷款",
    regulatorRe: /地方金融|小贷|金管总局|互金协会|NIFA/i,
    holderRe: /小贷|小额贷款/i,
  },
  {
    id: "CN-ins-broker",
    country: "CN",
    name: "保险经纪",
    regulatorRe: /金管总局|NFRA|保险|银保监/i,
    holderRe: /保险经纪|保险代理/i,
  },
  {
    id: "CN-fund",
    country: "CN",
    name: "基金销售",
    regulatorRe: /证监会|CSRC|基金/i,
    holderRe: /基金代销|基金销售/i,
  },
  {
    id: "CN-credit",
    country: "CN",
    name: "征信业务",
    regulatorRe: /人民银行|PBOC|征信/i,
    holderRe: /征信/i,
  },
  {
    id: "CN-assist",
    country: "CN",
    name: "助贷（信息中介）",
    regulatorRe: /互金协会|NIFA|金管总局|助贷/i,
    holderRe: /助贷/i,
  },
  {
    id: "CN-autofinance",
    country: "CN",
    name: "汽车金融公司",
    regulatorRe: /金管总局|NFRA|银保监|汽车金融/i,
    holderRe: /汽车金融/i,
  },
  {
    id: "CN-finlease",
    country: "CN",
    name: "金融租赁公司",
    regulatorRe: /金管总局|NFRA|银保监|金融租赁|融资租赁/i,
    holderRe: /金融租赁|融资租赁/i,
  },
  // —— 印尼 ——
  {
    id: "ID-p2p",
    country: "ID",
    name: "LPBBTI（P2P）",
    regulatorRe: /OJK|AFPI|LPBBTI|P2P/i,
    holderRe: /LPBBTI|P2P/i,
  },
  {
    id: "ID-multi",
    country: "ID",
    name: "Multifinance（多金融）",
    regulatorRe: /OJK|Multifinance|多金融/i,
    holderRe: /Multifinance|多金融/i,
  },
  {
    id: "ID-bank",
    country: "ID",
    name: "商业银行",
    regulatorRe: /OJK|Bank Indonesia|BI｜|商业银行|银行/i,
    holderRe: /银行|商业银行|BNC|Bank\s*Neo/i,
  },
  {
    id: "ID-pay",
    country: "ID",
    name: "电子货币/支付",
    regulatorRe: /Bank Indonesia|BI｜|支付|电子货币|e-?money/i,
    holderRe: /支付|电子货币|e-?money|钱包/i,
  },
  // —— 菲律宾 ——
  {
    id: "PH-lending",
    country: "PH",
    name: "SEC Lending/Financing",
    regulatorRe: /SEC｜|Securities and Exchange|Lending|Financing/i,
    holderRe: /SEC|Lending|Financing|放贷|OLP/i,
  },
  {
    id: "PH-olp",
    country: "PH",
    name: "Online Lending Platform（OLP）",
    regulatorRe: /SEC｜|OLP|Online Lending/i,
    holderRe: /OLP|Online Lending/i,
  },
  {
    id: "PH-digibank",
    country: "PH",
    name: "数字银行",
    regulatorRe: /BSP|Bangko Sentral|PDIC|数字银行|Digital\s*Bank/i,
    holderRe: /数字银行|Digital\s*Bank|Maya\s*Bank|Tonik|GoTyme|UnionDigital|UNObank|UNO\s*Digital|OFBank|Overseas Filipino/i,
  },
  {
    id: "PH-emi",
    country: "PH",
    name: "电子货币发行人（EMI）",
    regulatorRe: /BSP|Bangko Sentral|EMI|电子货币|支付/i,
    holderRe: /EMI|电子货币|支付|GCash|钱包/i,
  },
  // —— 印度 ——
  {
    id: "IN-nbfc",
    country: "IN",
    name: "NBFC（RBI CoR）",
    regulatorRe: /RBI|NBFC|Reserve Bank/i,
    holderRe: /NBFC|CoR/i,
  },
  {
    id: "IN-paybank",
    country: "IN",
    name: "Payments Bank / 支付",
    regulatorRe: /RBI|Payments?\s*Bank|支付|UPI/i,
    holderRe: /Payments?\s*Bank|支付|UPI|PPINBI/i,
  },
  {
    id: "IN-bank",
    country: "IN",
    name: "商业银行",
    regulatorRe: /RBI|商业银行|银行/i,
    holderRe: /商业银行|银行牌照|SBI/i,
  },
  // —— 马来 ——
  {
    id: "MY-credit",
    country: "MY",
    name: "非银信贷（BNM）",
    regulatorRe: /BNM|Bank Negara|非银|信贷/i,
    holderRe: /BNM|非银|信贷|AEON/i,
  },
  // —— 泰国 ——
  {
    id: "TH-ploan",
    country: "TH",
    name: "P-Loan / Nano Finance",
    regulatorRe: /BOT|Bank of Thailand|P-Loan|Nano/i,
    holderRe: /P-Loan|Nano|BOT/i,
  },
  // —— 越南 ——
  {
    id: "VN-fc",
    country: "VN",
    name: "金融公司（SBV）",
    regulatorRe: /SBV|State Bank of Vietnam|金融公司/i,
    holderRe: /金融公司|SBV|FE Credit|Home Credit/i,
  },
  // —— 墨西哥 ——
  {
    id: "MX-sofom",
    country: "MX",
    name: "SOFOM / 金融公司",
    regulatorRe: /CNBV|Banxico|SOFOM|SIPRES|金融公司/i,
    holderRe: /SOFOM|SOFIPO|金融公司/i,
  },
  // —— 巴西 ——
  {
    id: "BR-digibank",
    country: "BR",
    name: "数字银行 / 信贷",
    regulatorRe: /BCB|Banco Central|数字银行|信贷/i,
    holderRe: /数字银行|银行|信贷|Nubank/i,
  },
  // —— 巴基斯坦 ——
  {
    id: "PK-nbfc",
    country: "PK",
    name: "Lending NBFC（SECP）",
    regulatorRe: /SECP|SBP|NBFC|Lending/i,
    holderRe: /NBFC|SECP|Lending/i,
  },
  // —— 孟加拉 ——
  {
    id: "BD-nbfi",
    country: "BD",
    name: "NBFI（Bangladesh Bank）",
    regulatorRe: /Bangladesh Bank|BB｜|NBFI/i,
    holderRe: /NBFI|Bangladesh Bank/i,
  },
  // —— 斯里兰卡 ——
  {
    id: "LK-lfc",
    country: "LK",
    name: "Licensed Finance Company",
    regulatorRe: /CBSL|Central Bank of Sri Lanka|LFC|Finance Company/i,
    holderRe: /LFC|Licensed Finance|Finance Company/i,
  },
  // —— 沙特 ——
  {
    id: "SA-bnpl",
    country: "SA",
    name: "BNPL / 金融公司（SAMA）",
    regulatorRe: /SAMA|Saudi Central|BNPL|金融公司/i,
    holderRe: /BNPL|SAMA|金融公司|Tabby|Tamara/i,
  },
  // —— 阿联酋 ——
  {
    id: "AE-finance",
    country: "AE",
    name: "金融公司 / 支付（CBUAE）",
    regulatorRe: /CBUAE|Central Bank of the UAE|金融公司|支付/i,
    holderRe: /CBUAE|金融公司|支付|BNPL/i,
  },
  // —— 埃及 ——
  {
    id: "EG-nbfi",
    country: "EG",
    name: "非银金融 / 消费金融（CBE）",
    regulatorRe: /CBE|Central Bank of Egypt|FRA|非银|消费金融/i,
    holderRe: /非银|消费金融|BNPL|ValU|Halan/i,
  },
  // —— 巴林 / 卡塔尔 / 科威特 / 阿曼 ——
  {
    id: "BH-finance",
    country: "BH",
    name: "银行 / 金融公司（CBB）",
    regulatorRe: /CBB|Central Bank of Bahrain|金融/i,
    holderRe: /银行|金融公司|支付/i,
  },
  {
    id: "QA-finance",
    country: "QA",
    name: "银行 / 金融（QCB）",
    regulatorRe: /QCB|Qatar Central|金融/i,
    holderRe: /银行|金融公司|支付/i,
  },
  {
    id: "KW-finance",
    country: "KW",
    name: "银行 / 金融（CBK）",
    regulatorRe: /Central Bank of Kuwait|科威特央行|金融/i,
    holderRe: /银行|金融公司|支付/i,
  },
  {
    id: "OM-finance",
    country: "OM",
    name: "银行 / 金融（CBO）",
    regulatorRe: /CBO|Central Bank of Oman|金融/i,
    holderRe: /银行|金融公司|支付/i,
  },
  // —— 摩洛哥 ——
  {
    id: "MA-credit",
    country: "MA",
    name: "信贷机构（Bank Al-Maghrib）",
    regulatorRe: /Bank Al-Maghrib|BAM|摩洛哥央行|信贷/i,
    holderRe: /信贷|微金融|支付|BNPL/i,
  },
  // —— 尼日利亚 ——
  {
    id: "NG-mfb",
    country: "NG",
    name: "微金融银行 / 支付（CBN）",
    regulatorRe: /CBN|Central Bank of Nigeria|微金融|MFB|支付/i,
    holderRe: /微金融|MFB|支付|数字银行|OPay|PalmPay/i,
  },
  // —— 肯尼亚 ——
  {
    id: "KE-dtm",
    country: "KE",
    name: "数字信贷 / 移动货币（CBK）",
    regulatorRe: /CBK|Central Bank of Kenya|DTM|移动货币|数字信贷/i,
    holderRe: /数字信贷|DTM|移动货币|M-Pesa|Fuliza/i,
  },
  // —— 南非 ——
  {
    id: "ZA-ncr",
    country: "ZA",
    name: "消费信贷（NCR/SARB）",
    regulatorRe: /NCR|SARB|National Credit|消费信贷/i,
    holderRe: /消费信贷|NCR|信贷提供者/i,
  },
  // —— 加纳 / 坦桑 / 乌干达 / 科特迪瓦 ——
  {
    id: "GH-credit",
    country: "GH",
    name: "非银信贷 / 支付（BoG）",
    regulatorRe: /BoG|Bank of Ghana|非银|支付/i,
    holderRe: /非银|微金融|支付|信贷/i,
  },
  {
    id: "TZ-credit",
    country: "TZ",
    name: "微金融 / 数字信贷（BoT）",
    regulatorRe: /Bank of Tanzania|BoT｜|微金融|数字信贷/i,
    holderRe: /微金融|数字信贷|移动货币/i,
  },
  {
    id: "UG-credit",
    country: "UG",
    name: "微金融 / 数字信贷（BoU）",
    regulatorRe: /Bank of Uganda|BoU｜|微金融|数字信贷/i,
    holderRe: /微金融|数字信贷|移动货币/i,
  },
  {
    id: "CI-credit",
    country: "CI",
    name: "BCEAO / 本地信贷",
    regulatorRe: /BCEAO|CREPMF|西非|信贷/i,
    holderRe: /信贷|微金融|支付|BNPL/i,
  },
  // —— 中国台湾 ——
  {
    id: "TW-bank",
    country: "TW",
    name: "银行 / 数位银行",
    regulatorRe: /金管会|FSC|银行局|数位银行/i,
    holderRe: /银行|数位银行|纯网银/i,
  },
  {
    id: "TW-elec",
    country: "TW",
    name: "电子支付机构",
    regulatorRe: /金管会|FSC|电子支付|电支/i,
    holderRe: /电子支付|电支/i,
  },
  // —— 新加坡 ——
  {
    id: "SG-major",
    country: "SG",
    name: "商业银行（MAS）",
    regulatorRe: /MAS|Monetary Authority|商业银行|银行/i,
    holderRe: /银行|商业银行|DBS|OCBC|UOB/i,
  },
  {
    id: "SG-digital",
    country: "SG",
    name: "数字银行（MAS）",
    regulatorRe: /MAS|digital\s*bank|数字银行/i,
    holderRe: /数字银行|digital\s*bank|GXS|Trust Bank/i,
  },
  {
    id: "SG-payment",
    country: "SG",
    name: "支付机构（MPI）",
    regulatorRe: /MAS|MPI|支付|Payment/i,
    holderRe: /MPI|支付|钱包/i,
  },
  // —— 日本 ——
  {
    id: "JP-moneylend",
    country: "JP",
    name: "贷金业登记",
    regulatorRe: /FSA|金融庁|贷金|貸金/i,
    holderRe: /贷金|貸金|消费者金融/i,
  },
  // —— 美国 ——
  {
    id: "US-bank",
    country: "US",
    name: "银行 / ILC",
    regulatorRe: /OCC|FDIC|Federal Reserve|州银行|银行/i,
    holderRe: /银行|Bank|ILC|FDIC/i,
  },
  {
    id: "US-msb",
    country: "US",
    name: "货币服务业务（MSB）",
    regulatorRe: /FinCEN|MSB|州放贷|MTL/i,
    holderRe: /MSB|MTL|货币服务|州放贷/i,
  },
  // —— 英国 ——
  {
    id: "GB-cca",
    country: "GB",
    name: "消费信贷（FCA）",
    regulatorRe: /FCA|PRA|消费信贷|Consumer Credit/i,
    holderRe: /消费信贷|Consumer Credit|FCA/i,
  },

  // —— 韩国 ——
  { id: "KR-bank", country: "KR", name: "银行（金融委员会/金监院）", regulatorRe: /金融委员会|FSC|FSS|银行/i, holderRe: /银行|Bank/i },
  { id: "KR-card", country: "KR", name: "信用卡/贷专金融", regulatorRe: /信用卡|贷专|여신전문|FSC|FSS/i, holderRe: /信用卡|贷专|分期|租赁/i },
  // —— 外蒙古 ——
  { id: "MN-nbfi", country: "MN", name: "NBFI（FRC）", regulatorRe: /FRC|Financial Regulatory|NBFI/i, holderRe: /NBFI|FRC|非银/i },
  { id: "MN-epay", country: "MN", name: "电子支付（FRC/BoM）", regulatorRe: /FRC|Bank of Mongolia|电子支付|钱包/i, holderRe: /电子支付|钱包|支付/i },
  // —— 中国香港 ——
  { id: "HK-bank", country: "HK", name: "银行牌照（HKMA）", regulatorRe: /HKMA|金管局|银行/i, holderRe: /银行|Bank|持牌银行/i },
  { id: "HK-mto", country: "HK", name: "金钱服务经营者（海关/MSO）", regulatorRe: /金钱服务|MSO|海关|SVF/i, holderRe: /金钱服务|MSO|储值支付|SVF/i },
  { id: "HK-sfc", country: "HK", name: "证监会牌照（SFC）", regulatorRe: /SFC|证监会|证券/i, holderRe: /证监会|SFC|第\d类/i },
  // —— 中国澳门 ——
  { id: "MO-bank", country: "MO", name: "银行（金管局 AMCM）", regulatorRe: /AMCM|澳门金管局|银行/i, holderRe: /银行|Bank/i },
  { id: "MO-pay", country: "MO", name: "支付/货币兑换", regulatorRe: /AMCM|支付|兑换/i, holderRe: /支付|兑换|钱包/i },
  // —— 中亚 ——
  { id: "KZ-bank", country: "KZ", name: "银行/微金融（ARDFM）", regulatorRe: /ARDFM|哈萨克|微金融|银行/i, holderRe: /银行|微金融|信贷/i },
  { id: "UZ-bank", country: "UZ", name: "银行/非银信贷（CBU）", regulatorRe: /Central Bank of Uzbekistan|CBU|银行|信贷/i, holderRe: /银行|微金融|信贷|BNPL/i },
  { id: "KG-credit", country: "KG", name: "微金融/信贷（NBKR）", regulatorRe: /National Bank of the Kyrgyz|NBKR|微金融/i, holderRe: /微金融|信贷|BNPL/i },
  { id: "TJ-credit", country: "TJ", name: "信贷机构（NBT）", regulatorRe: /National Bank of Tajikistan|NBT|信贷/i, holderRe: /信贷|微金融|银行/i },
  { id: "TM-bank", country: "TM", name: "银行（土库曼斯坦央行）", regulatorRe: /Central Bank of Turkmenistan|银行/i, holderRe: /银行|信贷/i },
  // —— 拉美补强 ——
  { id: "CO-credit", country: "CO", name: "信贷/金融公司（SFC）", regulatorRe: /SFC|Superintendencia Financiera|信贷|金融公司/i, holderRe: /信贷|金融公司|BNPL|银行/i },
  { id: "AR-credit", country: "AR", name: "金融/信贷（BCRA）", regulatorRe: /BCRA|阿根廷央行|信贷|金融/i, holderRe: /信贷|金融|BNPL|银行/i },
  { id: "PE-credit", country: "PE", name: "银行/金融公司（SBS）", regulatorRe: /SBS|Superintendencia|银行|金融公司/i, holderRe: /银行|金融公司|信贷|BNPL/i },
  { id: "CL-credit", country: "CL", name: "银行/消费信贷（CMF）", regulatorRe: /CMF|Comisión para el Mercado|银行|消费信贷/i, holderRe: /银行|消费信贷|BNPL/i },
  { id: "MX-bank", country: "MX", name: "银行/SOFIPO", regulatorRe: /CNBV|Banxico|银行|SOFIPO/i, holderRe: /银行|SOFIPO|Fintech/i },
  { id: "BR-scd", country: "BR", name: "SCD/SEP 信贷公司", regulatorRe: /BCB|SCD|SEP|信贷公司/i, holderRe: /SCD|SEP|信贷|Fintech/i },
  { id: "BR-pay", country: "BR", name: "支付机构（PI）", regulatorRe: /BCB|支付机构|Payment Institution|PIX/i, holderRe: /支付|PIX|钱包|PI/i },
  // —— 中东北非补强 ——
  { id: "DZ-bank", country: "DZ", name: "银行/信贷（阿尔及利亚央行）", regulatorRe: /Bank of Algeria|阿尔及利亚|银行|信贷/i, holderRe: /银行|信贷|微金融/i },
  { id: "TN-bank", country: "TN", name: "银行/租赁/保理（突尼斯）", regulatorRe: /BCT|Central Bank of Tunisia|租赁|保理|银行/i, holderRe: /银行|租赁|保理|信贷/i },
  { id: "LY-bank", country: "LY", name: "银行（利比亚央行）", regulatorRe: /Central Bank of Libya|利比亚|银行/i, holderRe: /银行|信贷/i },
  { id: "SD-bank", country: "SD", name: "银行（苏丹央行）", regulatorRe: /Central Bank of Sudan|苏丹|银行/i, holderRe: /银行|信贷/i },
  { id: "JO-bank", country: "JO", name: "银行/金融公司（CBJ）", regulatorRe: /CBJ|Central Bank of Jordan|银行|金融公司/i, holderRe: /银行|金融公司|信贷/i },
  { id: "LB-bank", country: "LB", name: "银行/金融公司（BDL）", regulatorRe: /BDL|Banque du Liban|银行|金融/i, holderRe: /银行|金融公司|信贷/i },
  { id: "IQ-bank", country: "IQ", name: "银行（CBI）", regulatorRe: /Central Bank of Iraq|CBI|银行/i, holderRe: /银行|信贷/i },
  { id: "IL-bank", country: "IL", name: "银行/信贷（BoI）", regulatorRe: /Bank of Israel|BoI|银行|信贷/i, holderRe: /银行|信贷|BNPL/i },
  { id: "PS-bank", country: "PS", name: "银行/信贷（PMA）", regulatorRe: /PMA|Palestine Monetary|银行|信贷/i, holderRe: /银行|信贷/i },
  { id: "TR-bank", country: "TR", name: "银行（BDDK/CBRT）", regulatorRe: /BDDK|CBRT|银行|BRSA/i, holderRe: /银行|Bank/i },
  { id: "TR-finance", country: "TR", name: "金融公司/租赁/保理", regulatorRe: /finansman|leasing|factoring|金融公司|租赁/i, holderRe: /金融公司|租赁|保理|BNPL/i },
  { id: "YE-bank", country: "YE", name: "银行（也门央行）", regulatorRe: /Central Bank of Yemen|也门|银行/i, holderRe: /银行|信贷/i },
  { id: "IR-bank", country: "IR", name: "银行/信贷（CBI Iran）", regulatorRe: /Central Bank of Iran|伊朗|银行|信贷/i, holderRe: /银行|信贷|租赁/i },
  { id: "SA-bank", country: "SA", name: "银行（SAMA）", regulatorRe: /SAMA|Saudi Central|银行/i, holderRe: /银行|Bank/i },
  { id: "AE-bank", country: "AE", name: "银行（CBUAE）", regulatorRe: /CBUAE|银行/i, holderRe: /银行|Bank/i },
  { id: "EG-bank", country: "EG", name: "银行（CBE）", regulatorRe: /CBE|Central Bank of Egypt|银行/i, holderRe: /银行|Bank/i },
  // —— 非洲补强 ——
  { id: "RW-credit", country: "RW", name: "银行/微金融（BNR）", regulatorRe: /National Bank of Rwanda|BNR|微金融|银行/i, holderRe: /银行|微金融|移动货币|信贷/i },
  { id: "ET-credit", country: "ET", name: "银行/微金融（NBE）", regulatorRe: /National Bank of Ethiopia|NBE|银行|微金融/i, holderRe: /银行|微金融|信贷/i },
  { id: "SN-credit", country: "SN", name: "BCEAO / 本地信贷", regulatorRe: /BCEAO|塞内加尔|信贷|微金融/i, holderRe: /信贷|微金融|支付|BNPL/i },
  { id: "CM-credit", country: "CM", name: "COBAC / 本地信贷", regulatorRe: /COBAC|BEAC|喀麦隆|信贷/i, holderRe: /信贷|微金融|银行/i },
  { id: "AO-bank", country: "AO", name: "银行（BNA）", regulatorRe: /Banco Nacional de Angola|BNA|银行/i, holderRe: /银行|信贷/i },
  { id: "MZ-credit", country: "MZ", name: "银行/微金融（BoM）", regulatorRe: /Bank of Mozambique|BoM|微金融|银行/i, holderRe: /银行|微金融|信贷/i },
  { id: "ZM-credit", country: "ZM", name: "银行/非银（BoZ）", regulatorRe: /Bank of Zambia|BoZ|非银|银行/i, holderRe: /银行|非银|信贷|BNPL/i },
  { id: "ZW-credit", country: "ZW", name: "银行/信贷（RBZ）", regulatorRe: /Reserve Bank of Zimbabwe|RBZ|银行|信贷/i, holderRe: /银行|信贷/i },
  { id: "BW-bank", country: "BW", name: "银行（BoB）", regulatorRe: /Bank of Botswana|BoB|银行/i, holderRe: /银行|信贷/i },
  { id: "NA-bank", country: "NA", name: "银行（BoN）", regulatorRe: /Bank of Namibia|BoN|银行/i, holderRe: /银行|信贷/i },
  { id: "MU-credit", country: "MU", name: "银行/非银（BoM Mauritius）", regulatorRe: /Bank of Mauritius|非银|银行|租赁/i, holderRe: /银行|非银|信贷|租赁/i },
  { id: "MG-credit", country: "MG", name: "银行/微金融（BFM）", regulatorRe: /Banky Foiben|BFM|微金融|银行/i, holderRe: /银行|微金融|信贷/i },
  { id: "BJ-credit", country: "BJ", name: "BCEAO / 本地信贷", regulatorRe: /BCEAO|贝宁|信贷|微金融/i, holderRe: /信贷|微金融|支付/i },
  { id: "BF-credit", country: "BF", name: "BCEAO / 本地信贷", regulatorRe: /BCEAO|布基纳|信贷|微金融/i, holderRe: /信贷|微金融|支付/i },
  { id: "ML-credit", country: "ML", name: "BCEAO / 本地信贷", regulatorRe: /BCEAO|马里|信贷|微金融/i, holderRe: /信贷|微金融|支付/i },
  { id: "CD-credit", country: "CD", name: "银行/微金融（BCC）", regulatorRe: /Banque Centrale du Congo|BCC|微金融|银行/i, holderRe: /银行|微金融|信贷/i },
  { id: "GA-credit", country: "GA", name: "COBAC / 本地信贷", regulatorRe: /COBAC|BEAC|加蓬|信贷/i, holderRe: /信贷|银行|微金融/i },
  { id: "NG-bank", country: "NG", name: "商业银行（CBN）", regulatorRe: /CBN|商业银行|银行/i, holderRe: /商业银行|银行|Bank/i },
  { id: "KE-bank", country: "KE", name: "商业银行（CBK）", regulatorRe: /CBK|商业银行|银行/i, holderRe: /商业银行|银行|Bank/i },
  { id: "ZA-bank", country: "ZA", name: "银行（SARB/PA）", regulatorRe: /SARB|Prudential Authority|银行/i, holderRe: /银行|Bank/i },
  // —— 欧美补强 ——
  { id: "CA-bank", country: "CA", name: "银行（OSFI）", regulatorRe: /OSFI|银行|Bank of Canada/i, holderRe: /银行|Bank/i },
  { id: "CA-lend", country: "CA", name: "省际放贷/消费信贷", regulatorRe: /消费信贷|payday|省际|FSRA|AMF/i, holderRe: /消费信贷|放贷|BNPL/i },
  { id: "DE-bank", country: "DE", name: "信贷机构（BaFin）", regulatorRe: /BaFin|Kreditinstitut|信贷机构|银行/i, holderRe: /银行|信贷机构|Bank/i },
  { id: "DE-pay", country: "DE", name: "支付机构（ZAG）", regulatorRe: /BaFin|Zahlungsinstitut|ZAG|支付/i, holderRe: /支付|钱包|EMI/i },
  { id: "FR-bank", country: "FR", name: "信贷机构（ACPR）", regulatorRe: /ACPR|Banque de France|信贷机构|银行/i, holderRe: /银行|信贷机构|Bank/i },
  { id: "FR-pay", country: "FR", name: "支付/电子货币", regulatorRe: /ACPR|paiement|支付|电子货币/i, holderRe: /支付|电子货币|钱包/i },
  { id: "NL-bank", country: "NL", name: "银行（DNB/AFM）", regulatorRe: /DNB|AFM|银行/i, holderRe: /银行|Bank/i },
  { id: "NL-pay", country: "NL", name: "支付机构", regulatorRe: /DNB|AFM|支付|PSD2/i, holderRe: /支付|钱包|EMI/i },
  { id: "ES-bank", country: "ES", name: "银行/信贷（BdE/CNMV）", regulatorRe: /Banco de España|BdE|CNMV|银行|信贷/i, holderRe: /银行|信贷|BNPL/i },
  { id: "PT-bank", country: "PT", name: "银行（BdP）", regulatorRe: /Banco de Portugal|BdP|银行/i, holderRe: /银行|信贷/i },
  { id: "IT-bank", country: "IT", name: "银行（BdI）", regulatorRe: /Banca d'Italia|BdI|银行/i, holderRe: /银行|信贷/i },
  { id: "SE-bank", country: "SE", name: "银行/消费信贷（FI）", regulatorRe: /Finansinspektionen|FI｜|银行|消费信贷/i, holderRe: /银行|消费信贷|BNPL/i },
  { id: "PL-bank", country: "PL", name: "银行（KNF）", regulatorRe: /KNF|银行|Bank/i, holderRe: /银行|信贷|BNPL/i },
  { id: "IE-bank", country: "IE", name: "银行/信贷（CBI）", regulatorRe: /Central Bank of Ireland|CBI|银行|信贷/i, holderRe: /银行|信贷|BNPL/i },
  { id: "GB-bank", country: "GB", name: "银行（PRA/FCA）", regulatorRe: /PRA|FCA|银行|Bank/i, holderRe: /银行|Bank/i },
  { id: "US-lend", country: "US", name: "州放贷牌照 / CFPB", regulatorRe: /CFPB|州放贷|lending license|MTL/i, holderRe: /州放贷|lending|消费信贷|BNPL/i },
  // —— 既有市场补强（银行/支付） ——
  { id: "MY-bank", country: "MY", name: "银行（BNM）", regulatorRe: /BNM|Bank Negara|银行/i, holderRe: /银行|Bank/i },
  { id: "MY-pay", country: "MY", name: "电子货币/支付（BNM）", regulatorRe: /BNM|e-?money|电子货币|支付/i, holderRe: /电子货币|支付|钱包/i },
  { id: "TH-bank", country: "TH", name: "银行（BOT）", regulatorRe: /BOT|Bank of Thailand|银行/i, holderRe: /银行|Bank/i },
  { id: "TH-pay", country: "TH", name: "支付/电子货币（BOT）", regulatorRe: /BOT|支付|电子货币|PromptPay/i, holderRe: /支付|电子货币|钱包/i },
  { id: "VN-bank", country: "VN", name: "银行（SBV）", regulatorRe: /SBV|State Bank of Vietnam|银行/i, holderRe: /银行|Bank/i },
  { id: "JP-bank", country: "JP", name: "银行（金融厅）", regulatorRe: /FSA|金融庁|银行|Bank/i, holderRe: /银行|Bank/i },
  { id: "JP-pay", country: "JP", name: "资金移动业/前払式", regulatorRe: /资金移动|前払|资金决济|支付/i, holderRe: /资金移动|支付|钱包|PayPay/i },
  { id: "IN-nbhc", country: "IN", name: "HFC（NHB/RBI）", regulatorRe: /NHB|HFC|住房金融/i, holderRe: /HFC|住房金融/i },
  { id: "ID-venture", country: "ID", name: "创业投资公司（OJK）", regulatorRe: /OJK|Modal Ventura|创业投资/i, holderRe: /Modal Ventura|创业投资|VC/i },
];

/** 监管官方名录信源（对照时点写入 licenseReg；非实时爬取） */
const REGULATORY_DIRECTORY_SOURCES = {
  nfraBankCorp:
    "金管总局《银行业金融机构法人名单》截至2025-06-30（准入司2025-10披露）",
  pdicDigibank: "PDIC Directory of Insured Digital Banks（对照 BSP 数字银行牌照）",
  ojkLpbbti: "AFPI 会员公开页 members_data（2026-08-07 抓取，约92家）；OJK Direktori PDF 抓取被拒，待与官网 PDF 交叉",
  secLendingPh:
    "SEC PH Lending/Financing+OLP 公开名录交叉（2026-08-08；官网 Cloudflare 拦截未能整表，待 PDF/Excel 回填）",
  rbiNbfcDigital:
    "RBI NBFC CoR 公开名录交叉·数字消费贷头部样本（2026-08-08；全量 bs_nbfclist 待整表）",
} as const;

type OfficialLicenseHolder = {
  group: string;
  region: Exclude<Region, "all">;
  line: "cash" | "bnpl" | "lease" | "agent";
  legalName: string;
  /** 机构编码；无编码时留空 */
  code: string;
  licenseKindLabel: string;
  source: keyof typeof REGULATORY_DIRECTORY_SOURCES;
  controller?: string;
};

/** 金管总局名录·消费金融公司 31 家（机构类型：消费金融公司） */
const NFRA_CONSUMER_FINANCE_HOLDERS: OfficialLicenseHolder[] = [
  {
    group: "北银消费金融｜北银消金｜北银（北银消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "北银消费金融有限公司",
    code: "X0001H211000001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
    controller: "北京银行体系发起；法定主体北银消费金融有限公司",
  },
  {
    group: "四川锦程消费金融｜锦程消金｜锦程（锦程消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "四川锦程消费金融有限责任公司",
    code: "X0002H251010001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
  },
  {
    group: "中银消费金融｜中银消金｜中行（中银消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "中银消费金融有限公司",
    code: "X0003H231000001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
    controller: "中国银行体系发起；法定主体中银消费金融有限公司",
  },
  {
    group: "天津京东消费金融｜京东消金｜京东（京东消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "天津京东消费金融有限公司",
    code: "X0004H212000001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
    controller: "京东体系关联；法定主体天津京东消费金融有限公司",
  },
  {
    group: "兴业消费金融｜兴业消金｜兴业（兴业消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "兴业消费金融股份公司",
    code: "X0005H335050001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
    controller: "兴业银行体系发起；法定主体兴业消费金融股份公司",
  },
  {
    group: "海尔消费金融｜海尔消金｜海尔（海尔消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "海尔消费金融有限公司",
    code: "X0006H237020001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
  },
  {
    group: "招商银行+中国联通｜招联｜招联（招联·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "招联消费金融股份有限公司",
    code: "X0007H244030001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
    controller: "发起方：招商银行 + 中国联通；招联消费金融为持牌主体",
  },
  {
    group: "湖北消费金融｜湖北消金｜湖北消金（湖北消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "湖北消费金融股份有限公司",
    code: "X0008H242010001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
  },
  {
    group: "南银法巴消费金融｜南银法巴｜南银法巴（南银法巴·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "南银法巴消费金融有限公司",
    code: "X0009H232010001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
  },
  {
    group: "中关村科金｜马上｜中科金（中科金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "马上消费金融股份有限公司",
    code: "X0010H250000001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
    controller: "北京中关村科金技术有限公司（中科金）；马上消费为境内持牌消金主体，不作玩家主名",
  },
  {
    group: "中国邮政｜中邮消费｜中国邮政（中邮·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "中邮消费金融有限公司",
    code: "X0011H244010001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
    controller: "发起方：中国邮政体系；中邮消费金融为持牌主体",
  },
  {
    group: "杭银消费金融｜杭银消金｜杭银（杭银消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "杭银消费金融股份有限公司",
    code: "X0012H233010001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
  },
  {
    group: "浙江宁银消费金融｜宁银消金｜宁银（宁银消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "浙江宁银消费金融股份有限公司",
    code: "X0013H233020001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
  },
  {
    group: "晋商消费金融｜晋商消金｜晋商（晋商消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "晋商消费金融股份有限公司",
    code: "X0014H214010001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
  },
  {
    group: "盛银消费金融｜盛银消金｜盛京（盛银消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "盛银消费金融有限公司",
    code: "X0015H221010001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
  },
  {
    group: "陕西长银消费金融｜长银消金｜长银（长银消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "陕西长银消费金融有限公司",
    code: "X0016H261010001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
  },
  {
    group: "内蒙古蒙商消费金融｜蒙商消金｜蒙商（蒙商消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "内蒙古蒙商消费金融股份有限公司",
    code: "X0017H315020001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
    controller:
      "中国内蒙古自治区持牌消费金融公司（金管总局法人名单）；≠外蒙古(MN)/蒙古国机构",
  },
  {
    group: "中原银行｜中原消费｜中原银行（中原·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "河南中原消费金融股份有限公司",
    code: "X0018H241010001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
    controller: "发起方：中原银行；中原消费金融为持牌主体",
  },
  {
    group: "湖南长银五八消费金融｜长银五八｜五八（长银五八·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "湖南长银五八消费金融股份有限公司",
    code: "X0019H243010001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
  },
  {
    group: "哈尔滨哈银消费金融｜哈银消金｜哈银（哈银消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "哈尔滨哈银消费金融有限责任公司",
    code: "X0020H223010001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
  },
  {
    group: "河北幸福消费金融｜幸福消金｜幸福（幸福消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "河北幸福消费金融股份有限公司",
    code: "X0021H213010001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
  },
  {
    group: "上海尚诚消费金融｜尚诚消金｜尚诚（尚诚消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "上海尚诚消费金融股份有限公司",
    code: "X0022H231000001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
  },
  {
    group: "厦门金美信消费金融｜金美信｜金美信（金美信·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "厦门金美信消费金融有限责任公司",
    code: "X0023H235020001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
  },
  {
    group: "中信消费金融｜中信消金｜中信（中信消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "中信消费金融有限公司",
    code: "X0024H211000001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
    controller: "中信银行体系发起；法定主体中信消费金融有限公司",
  },
  {
    group: "平安消费金融｜平安消金｜平安（平安消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "平安消费金融有限公司",
    code: "X0025H231000001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
    controller: "平安集团体系；法定主体平安消费金融有限公司",
  },
  {
    group: "重庆小米消费金融｜小米消金｜小米（小米消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "重庆小米消费金融有限公司",
    code: "X0026H250000001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
    controller: "小米集团关联；法定主体重庆小米消费金融有限公司",
  },
  {
    group: "北京阳光消费金融｜阳光消金｜阳光（阳光消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "北京阳光消费金融股份有限公司",
    code: "X0027H211000001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
  },
  {
    group: "苏银凯基消费金融｜苏银凯基｜苏银凯基（苏银凯基·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "苏银凯基消费金融有限公司",
    code: "X0028H332050001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
  },
  {
    group: "重庆蚂蚁消费金融｜蚂蚁消金｜蚂蚁（蚂蚁消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "重庆蚂蚁消费金融有限公司",
    code: "X0029H250000001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
    controller: "蚂蚁集团关联；法定主体重庆蚂蚁消费金融有限公司",
  },
  {
    group: "四川省唯品富邦消费金融｜唯品富邦｜唯品（唯品富邦·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "四川省唯品富邦消费金融有限公司",
    code: "X0030H251010001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
    controller: "唯品会/富邦关联；法定主体四川省唯品富邦消费金融有限公司",
  },
  {
    group: "建信消费金融｜建信消金｜建行（建信消金·CN）",
    region: "east-asia",
    line: "cash",
    legalName: "建信消费金融有限责任公司",
    code: "X0031H211000001",
    licenseKindLabel: "消费金融",
    source: "nfraBankCorp",
    controller: "建设银行体系发起；法定主体建信消费金融有限责任公司",
  },
];

/** 金管总局名录·汽车金融公司 25 家（机构类型：汽车金融公司） */
const NFRA_AUTO_FINANCE_HOLDERS: OfficialLicenseHolder[] = [
  { group: "大众汽车金融｜大众汽金｜大众（大众汽金·CN）", region: "east-asia", line: "lease", legalName: "大众汽车金融（中国）有限公司", code: "N0001H211000001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "丰田汽车金融｜丰田汽金｜丰田（丰田汽金·CN）", region: "east-asia", line: "lease", legalName: "丰田汽车金融（中国）有限公司", code: "N0002H211000001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "梅赛德斯-奔驰汽车金融｜奔驰汽金｜奔驰（奔驰汽金·CN）", region: "east-asia", line: "lease", legalName: "梅赛德斯-奔驰汽车金融有限公司", code: "N0003H211000001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "东风汽车金融｜东风汽金｜东风（东风汽金·CN）", region: "east-asia", line: "lease", legalName: "东风汽车金融有限公司", code: "N0004H211000001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "沃尔沃汽车金融｜沃尔沃汽金｜沃尔沃（沃尔沃汽金·CN）", region: "east-asia", line: "lease", legalName: "沃尔沃汽车金融（中国）有限公司", code: "N0005H211000001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "上汽通用汽车金融｜上汽通用汽金｜上汽通用（上汽通用汽金·CN）", region: "east-asia", line: "lease", legalName: "上汽通用汽车金融有限责任公司", code: "N0006H231000001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "福特汽车金融｜福特汽金｜福特（福特汽金·CN）", region: "east-asia", line: "lease", legalName: "福特汽车金融（中国）有限公司", code: "N0007H231000001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "东风日产汽车金融｜日产汽金｜日产（日产汽金·CN）", region: "east-asia", line: "lease", legalName: "东风日产汽车金融有限公司", code: "N0008H231000001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "斯泰兰蒂斯汽车金融｜斯泰兰蒂斯汽金｜斯泰兰蒂斯（斯泰兰蒂斯汽金·CN）", region: "east-asia", line: "lease", legalName: "斯泰兰蒂斯汽车金融有限公司", code: "N0009H231000001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "广汽汇理汽车金融｜广汽汇理｜广汽（广汽汇理·CN）", region: "east-asia", line: "lease", legalName: "广汽汇理汽车金融有限公司", code: "N0011H244010001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "宝马汽车金融｜宝马汽金｜宝马（宝马汽金·CN）", region: "east-asia", line: "lease", legalName: "宝马汽车金融（中国）有限公司", code: "N0012H211000001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "三一汽车金融｜三一汽金｜三一（三一汽金·CN）", region: "east-asia", line: "lease", legalName: "三一汽车金融有限公司", code: "N0013H243010001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "一汽汽车金融｜一汽汽金｜一汽（一汽汽金·CN）", region: "east-asia", line: "lease", legalName: "一汽汽车金融有限公司", code: "N0014H222010001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "北京现代汽车金融｜现代汽金｜现代（现代汽金·CN）", region: "east-asia", line: "lease", legalName: "北京现代汽车金融有限公司", code: "N0015H211000001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "天津长城滨银汽车金融｜长城汽金｜长城（长城汽金·CN）", region: "east-asia", line: "lease", legalName: "天津长城滨银汽车金融有限公司", code: "N0016H212000001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "长安汽车金融｜长安汽金｜长安（长安汽金·CN）", region: "east-asia", line: "lease", legalName: "长安汽车金融有限公司", code: "N0017H250000001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "瑞福德汽车金融｜瑞福德｜瑞福德（瑞福德·CN）", region: "east-asia", line: "lease", legalName: "瑞福德汽车金融有限公司", code: "N0018H234010001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "奇瑞徽银汽车金融｜奇瑞徽银｜奇瑞（奇瑞徽银·CN）", region: "east-asia", line: "lease", legalName: "奇瑞徽银汽车金融股份有限公司", code: "N0019H334020001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "比亚迪汽车金融｜比亚迪汽金｜比亚迪（比亚迪汽金·CN）", region: "east-asia", line: "lease", legalName: "比亚迪汽车金融有限公司", code: "N0020H261010001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "华泰汽车金融｜华泰汽金｜华泰（华泰汽金·CN）", region: "east-asia", line: "lease", legalName: "华泰汽车金融有限公司", code: "N0021H212000001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "上海东正汽车金融｜东正汽金｜东正（东正汽金·CN）", region: "east-asia", line: "lease", legalName: "上海东正汽车金融股份有限公司", code: "N0022H231000001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "华晨东亚汽车金融｜华晨东亚｜华晨（华晨东亚·CN）", region: "east-asia", line: "lease", legalName: "华晨东亚汽车金融有限公司", code: "N0023H231000001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "吉致汽车金融｜吉致汽金｜吉致（吉致汽金·CN）", region: "east-asia", line: "lease", legalName: "吉致汽车金融有限公司", code: "N0024H231000001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "重汽汽车金融｜重汽汽金｜重汽（重汽汽金·CN）", region: "east-asia", line: "lease", legalName: "重汽汽车金融有限公司", code: "N0025H237010001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
  { group: "北汽汽车金融｜北汽汽金｜北汽（北汽汽金·CN）", region: "east-asia", line: "lease", legalName: "北汽汽车金融（杭州）有限公司", code: "N0027H233010001", licenseKindLabel: "汽车金融", source: "nfraBankCorp" },
];

/** 金管总局名录·金融租赁公司（法人名单抽取；截至2025-06-30） */
const NFRA_FIN_LEASE_HOLDERS: OfficialLicenseHolder[] = [
  { group: "邦银金融租赁｜邦银金租｜邦银金租（邦银金租·CN）", region: "east-asia", line: "lease", legalName: "邦银金融租赁股份有限公司", code: "M0027H241010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "北部湾金融租赁｜北部湾金租｜北部湾金租（北部湾金租·CN）", region: "east-asia", line: "lease", legalName: "北部湾金融租赁有限公司", code: "M0025H245010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "北银金融租赁｜北银金租｜北银金租（北银金租·CN）", region: "east-asia", line: "lease", legalName: "北银金融租赁有限公司", code: "M0028H211000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "长城国兴金融租赁｜长城国兴金租｜长城国兴金租（长城国兴金租·CN）", region: "east-asia", line: "lease", legalName: "长城国兴金融租赁有限公司", code: "M0014H265010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "长江联合金融租赁｜长江联合金租｜长江联合金租（长江联合金租·CN）", region: "east-asia", line: "lease", legalName: "长江联合金融租赁有限公司", code: "M0042H231000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "重庆鈊渝金融租赁｜重庆鈊渝金租｜重庆鈊渝金租（重庆鈊渝金租·CN）", region: "east-asia", line: "lease", legalName: "重庆鈊渝金融租赁股份有限公司", code: "M0068H250000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "佛山海晟金融租赁｜佛山海晟金租｜佛山海晟金租（佛山海晟金租·CN）", region: "east-asia", line: "lease", legalName: "佛山海晟金融租赁股份有限公司", code: "M0056H344060001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "福建海西金融租赁｜福建海西金租｜福建海西金租（福建海西金租·CN）", region: "east-asia", line: "lease", legalName: "福建海西金融租赁有限责任公司", code: "M0059H335050001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "甘肃兰银金融租赁｜甘肃兰银金租｜甘肃兰银金租（甘肃兰银金租·CN）", region: "east-asia", line: "lease", legalName: "甘肃兰银金融租赁股份有限公司", code: "M0064H262010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "工银金融租赁｜工银金租｜工银金租（工银金租·CN）", region: "east-asia", line: "lease", legalName: "工银金融租赁有限公司", code: "M0011H212000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "光大金融租赁｜光大金租｜光大金租（光大金租·CN）", region: "east-asia", line: "lease", legalName: "光大金融租赁股份有限公司", code: "M0018H242010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "广东粤财金融租赁｜广东粤财金租｜广东粤财金租（广东粤财金租·CN）", region: "east-asia", line: "lease", legalName: "广东粤财金融租赁股份有限公司", code: "M0071H244010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "广融达金融租赁｜广融达金租｜广融达金租（广融达金租·CN）", region: "east-asia", line: "lease", legalName: "广融达金融租赁有限公司", code: "M0055H231000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "贵阳贵银金融租赁｜贵阳贵银金租｜贵阳贵银金租（贵阳贵银金租·CN）", region: "east-asia", line: "lease", legalName: "贵阳贵银金融租赁有限责任公司", code: "M0058H252010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "国银金融租赁｜国银金租｜国银金租（国银金租·CN）", region: "east-asia", line: "lease", legalName: "国银金融租赁股份有限公司", code: "M0017H244030001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "哈银金融租赁｜哈银金租｜哈银金租（哈银金租·CN）", region: "east-asia", line: "lease", legalName: "哈银金融租赁有限责任公司", code: "M0029H223010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "航天科工金融租赁｜航天科工金租｜航天科工金租（航天科工金租·CN）", region: "east-asia", line: "lease", legalName: "航天科工金融租赁有限公司", code: "M0069H242010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "河北省金融租赁｜河北省金租｜河北省金租（河北省金租·CN）", region: "east-asia", line: "lease", legalName: "河北省金融租赁有限公司", code: "M0002H213010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "河南九鼎金融租赁｜河南九鼎金租｜河南九鼎金租（河南九鼎金租·CN）", region: "east-asia", line: "lease", legalName: "河南九鼎金融租赁股份有限公司", code: "M0053H241010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "横琴华通金融租赁｜横琴华通金租｜横琴华通金租（横琴华通金租·CN）", region: "east-asia", line: "lease", legalName: "横琴华通金融租赁有限公司", code: "M0047H344040001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "湖北金融租赁｜湖北金租｜湖北金租（湖北金租·CN）", region: "east-asia", line: "lease", legalName: "湖北金融租赁股份有限公司", code: "M0043H242010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "华融航运金融租赁｜华融航运金租｜华融航运金租（华融航运金租·CN）", region: "east-asia", line: "lease", legalName: "华融航运金融租赁有限公司", code: "M0045H231000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "华融金融租赁｜华融金租｜华融金租（华融金租·CN）", region: "east-asia", line: "lease", legalName: "华融金融租赁股份有限公司", code: "M0010H233010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "华夏金融租赁｜华夏金租｜华夏金租（华夏金租·CN）", region: "east-asia", line: "lease", legalName: "华夏金融租赁有限公司", code: "M0026H253010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "华运金融租赁｜华运金租｜华运金租（华运金租·CN）", region: "east-asia", line: "lease", legalName: "华运金融租赁股份有限公司", code: "M0036H212000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "徽银金融租赁｜徽银金租｜徽银金租（徽银金租·CN）", region: "east-asia", line: "lease", legalName: "徽银金融租赁有限公司", code: "M0037H234010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "冀银金融租赁｜冀银金租｜冀银金租（冀银金租·CN）", region: "east-asia", line: "lease", legalName: "冀银金融租赁股份有限公司", code: "M0052H213010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "吉林九银金融租赁｜吉林九银金租｜吉林九银金租（吉林九银金租·CN）", region: "east-asia", line: "lease", legalName: "吉林九银金融租赁股份有限公司", code: "M0066H222010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "建信金融租赁｜建信金租｜建信金租（建信金租·CN）", region: "east-asia", line: "lease", legalName: "建信金融租赁有限公司", code: "M0013H211000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "江南金融租赁｜江南金租｜江南金租（江南金租·CN）", region: "east-asia", line: "lease", legalName: "江南金融租赁股份有限公司", code: "M0076H332040001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "江苏金融租赁｜江苏金租｜江苏金租（江苏金租·CN）", region: "east-asia", line: "lease", legalName: "江苏金融租赁股份有限公司", code: "M0005H232010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "江西金融租赁｜江西金租｜江西金租（江西金租·CN）", region: "east-asia", line: "lease", legalName: "江西金融租赁股份有限公司", code: "M0048H236010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "交银航空航运金融租赁｜交银航空航运金租｜交银航空航运金租（交银航空航运金租·CN）", region: "east-asia", line: "lease", legalName: "交银航空航运金融租赁有限责任公司", code: "M0030H231000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "交银金融租赁｜交银金租｜交银金租（交银金租·CN）", region: "east-asia", line: "lease", legalName: "交银金融租赁有限责任公司", code: "M0012H231000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "锦银金融租赁｜锦银金租｜锦银金租（锦银金租·CN）", region: "east-asia", line: "lease", legalName: "锦银金融租赁有限责任公司", code: "M0049H221010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "昆仑金融租赁｜昆仑金租｜昆仑金租（昆仑金租·CN）", region: "east-asia", line: "lease", legalName: "昆仑金融租赁有限责任公司", code: "M0019H250000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "洛银金融租赁｜洛银金租｜洛银金租（洛银金租·CN）", region: "east-asia", line: "lease", legalName: "洛银金融租赁股份有限公司", code: "M0033H341030001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "民生金融租赁｜民生金租｜民生金租（民生金租·CN）", region: "east-asia", line: "lease", legalName: "民生金融租赁股份有限公司", code: "M0016H212000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "农银金融租赁｜农银金租｜农银金租（农银金租·CN）", region: "east-asia", line: "lease", legalName: "农银金融租赁有限公司", code: "M0021H231000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "浦银金融租赁｜浦银金租｜浦银金租（浦银金租·CN）", region: "east-asia", line: "lease", legalName: "浦银金融租赁股份有限公司", code: "M0024H231000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "前海兴邦金融租赁｜前海兴邦金租｜前海兴邦金租（前海兴邦金租·CN）", region: "east-asia", line: "lease", legalName: "前海兴邦金融租赁有限责任公司", code: "M0070H244030001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "青岛青银金融租赁｜青岛青银金租｜青岛青银金租（青岛青银金租·CN）", region: "east-asia", line: "lease", legalName: "青岛青银金融租赁有限公司", code: "M0067H237020001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "山东汇通金融租赁｜山东汇通金租｜山东汇通金租（山东汇通金租·CN）", region: "east-asia", line: "lease", legalName: "山东汇通金融租赁有限公司", code: "M0050H237010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "山东通达金融租赁｜山东通达金租｜山东通达金租（山东通达金租·CN）", region: "east-asia", line: "lease", legalName: "山东通达金融租赁有限公司", code: "M0054H237010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "山西金融租赁｜山西金租｜山西金租（山西金租·CN）", region: "east-asia", line: "lease", legalName: "山西金融租赁有限公司", code: "M0003H214010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "四川天府金融租赁｜四川天府金租｜四川天府金租（四川天府金租·CN）", region: "east-asia", line: "lease", legalName: "四川天府金融租赁股份有限公司", code: "M0063H251010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "苏银金融租赁｜苏银金租｜苏银金租（苏银金租·CN）", region: "east-asia", line: "lease", legalName: "苏银金融租赁股份有限公司", code: "M0038H232010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "苏州金融租赁｜苏州金租｜苏州金租（苏州金租·CN）", region: "east-asia", line: "lease", legalName: "苏州金融租赁股份有限公司", code: "M0051H332050001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "太平石化金融租赁｜太平石化金租｜太平石化金租（太平石化金租·CN）", region: "east-asia", line: "lease", legalName: "太平石化金融租赁有限责任公司", code: "M0031H231000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "天银金融租赁｜天银金租｜天银金租（天银金租·CN）", region: "east-asia", line: "lease", legalName: "天银金融租赁股份有限公司", code: "M0061H212000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "皖江金融租赁｜皖江金租｜皖江金租（皖江金租·CN）", region: "east-asia", line: "lease", legalName: "皖江金融租赁股份有限公司", code: "M0044H334020001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "信达金融租赁｜信达金租｜信达金租（信达金租·CN）", region: "east-asia", line: "lease", legalName: "信达金融租赁股份有限公司", code: "M0009H262010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "兴业金融租赁｜兴业金租｜兴业金租（兴业金租·CN）", region: "east-asia", line: "lease", legalName: "兴业金融租赁有限责任公司", code: "M0020H212000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "徐州恒鑫金融租赁｜徐州恒鑫金租｜徐州恒鑫金租（徐州恒鑫金租·CN）", region: "east-asia", line: "lease", legalName: "徐州恒鑫金融租赁股份有限公司", code: "M0062H332030001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "永赢金融租赁｜永赢金租｜永赢金租（永赢金租·CN）", region: "east-asia", line: "lease", legalName: "永赢金融租赁有限公司", code: "M0041H233020001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "渝农商金融租赁｜渝农商金租｜渝农商金租（渝农商金租·CN）", region: "east-asia", line: "lease", legalName: "渝农商金融租赁有限责任公司", code: "M0034H250000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "浙江稠州金融租赁｜浙江稠州金租｜浙江稠州金租（浙江稠州金租·CN）", region: "east-asia", line: "lease", legalName: "浙江稠州金融租赁有限公司", code: "M0060H233070001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "浙江浙银金融租赁｜浙江浙银金租｜浙江浙银金租（浙江浙银金租·CN）", region: "east-asia", line: "lease", legalName: "浙江浙银金融租赁股份有限公司", code: "M0065H233090001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "招银航空航运金融租赁｜招银航空航运金租｜招银航空航运金租（招银航空航运金租·CN）", region: "east-asia", line: "lease", legalName: "招银航空航运金融租赁有限公司", code: "M0046H231000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "招银金融租赁｜招银金租｜招银金租（招银金租·CN）", region: "east-asia", line: "lease", legalName: "招银金融租赁有限公司", code: "M0015H231000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "中国金融租赁｜中国金租｜中国金租（中国金租·CN）", region: "east-asia", line: "lease", legalName: "中国金融租赁有限公司", code: "M0022H212000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "中国外贸金融租赁｜中国外贸金租｜中国外贸金租（中国外贸金租·CN）", region: "east-asia", line: "lease", legalName: "中国外贸金融租赁有限公司", code: "M0001H211000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "中铁建金融租赁｜中铁建金租｜中铁建金租（中铁建金租·CN）", region: "east-asia", line: "lease", legalName: "中铁建金融租赁有限公司", code: "M0057H212000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "中信金融租赁｜中信金租｜中信金租（中信金租·CN）", region: "east-asia", line: "lease", legalName: "中信金融租赁有限公司", code: "M0035H212000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "珠江金融租赁｜珠江金租｜珠江金租（珠江金租·CN）", region: "east-asia", line: "lease", legalName: "珠江金融租赁有限公司", code: "M0032H244010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "天津国泰金融租赁｜天津国泰金租｜天津国泰金租（天津国泰金租·CN）", region: "east-asia", line: "lease", legalName: "天津国泰金融租赁有限责任公司", code: "M0073H212000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "中煤科工金融租赁｜中煤科工金租｜中煤科工金租（中煤科工金租·CN）", region: "east-asia", line: "lease", legalName: "中煤科工金融租赁股份有限公司", code: "M0072H212000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "厦门金融租赁｜厦门金租｜厦门金租（厦门金租·CN）", region: "east-asia", line: "lease", legalName: "厦门金融租赁有限公司", code: "M0074H235020001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "中银金融租赁｜中银金租｜中银金租（中银金租·CN）", region: "east-asia", line: "lease", legalName: "中银金融租赁有限公司", code: "M0077H250000001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
  { group: "江苏法巴农科设备金融租赁｜江苏法巴农科设备金租｜江苏法巴农科设备金租（江苏法巴农科设备金租·CN）", region: "east-asia", line: "lease", legalName: "江苏法巴农科设备金融租赁有限公司", code: "M0078H232010001", licenseKindLabel: "金融租赁", source: "nfraBankCorp" },
];

/** OJK/AFPI：印尼 LPBBTI 平台公开会员（OJK PDF 抓取被拒；以 AFPI members_data 交叉，待官方 PDF 复核） */
const OJK_LPBBTI_HOLDERS: OfficialLicenseHolder[] = [
  { group: "AdaKami｜AdaKami｜AdaKami（AdaKami·ID）", region: "se-asia", line: "cash", legalName: "AdaKami", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "AdaModal｜AdaModal｜AdaModal（AdaModal·ID）", region: "se-asia", line: "cash", legalName: "AdaModal", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Adapundi｜Adapundi｜Adapundi（Adapundi·ID）", region: "se-asia", line: "cash", legalName: "Adapundi", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Akseleran｜Akseleran｜Akseleran（Akseleran·ID）", region: "se-asia", line: "cash", legalName: "Akseleran", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Aktivaku｜Aktivaku｜Aktivaku（Aktivaku·ID）", region: "se-asia", line: "cash", legalName: "Aktivaku", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Alami Sharia｜Alami Sharia｜AlamiSharia（AlamiSharia·ID）", region: "se-asia", line: "cash", legalName: "Alami Sharia", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Amartha｜Amartha｜Amartha（Amartha·ID）", region: "se-asia", line: "cash", legalName: "Amartha", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Ammana｜Ammana｜Ammana（Ammana·ID）", region: "se-asia", line: "cash", legalName: "Ammana", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Asetku｜Asetku｜Asetku（Asetku·ID）", region: "se-asia", line: "cash", legalName: "Asetku", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Avantee｜Avantee｜Avantee（Avantee·ID）", region: "se-asia", line: "cash", legalName: "Avantee", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "AwanTunai｜AwanTunai｜AwanTunai（AwanTunai·ID）", region: "se-asia", line: "cash", legalName: "AwanTunai", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "BantuFazz｜BantuFazz｜BantuFazz（BantuFazz·ID）", region: "se-asia", line: "cash", legalName: "BantuFazz", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "BantuSaku｜BantuSaku｜BantuSaku（BantuSaku·ID）", region: "se-asia", line: "cash", legalName: "BantuSaku", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Batumbu｜Batumbu｜Batumbu（Batumbu·ID）", region: "se-asia", line: "cash", legalName: "Batumbu", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Boost｜Boost｜Boost（Boost·ID）", region: "se-asia", line: "cash", legalName: "Boost", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Cairin｜Cairin｜Cairin（Cairin·ID）", region: "se-asia", line: "cash", legalName: "Cairin", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Cashcepat｜Cashcepat｜Cashcepat（Cashcepat·ID）", region: "se-asia", line: "cash", legalName: "Cashcepat", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "CICIL｜CICIL｜CICIL（CICIL·ID）", region: "se-asia", line: "cash", legalName: "CICIL", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Crowdo｜Crowdo｜Crowdo（Crowdo·ID）", region: "se-asia", line: "cash", legalName: "Crowdo", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Dana Syariah｜Dana Syariah｜DanaSyariah（DanaSyariah·ID）", region: "se-asia", line: "cash", legalName: "Dana Syariah", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "DanaBagus｜DanaBagus｜DanaBagus（DanaBagus·ID）", region: "se-asia", line: "cash", legalName: "DanaBagus", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Danabijak｜Danabijak｜Danabijak（Danabijak·ID）", region: "se-asia", line: "cash", legalName: "Danabijak", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Danacita｜Danacita｜Danacita（Danacita·ID）", region: "se-asia", line: "cash", legalName: "Danacita", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Danai.id｜Danai.id｜Danai.id（Danai.id·ID）", region: "se-asia", line: "cash", legalName: "Danai.id", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "DanaIn｜DanaIn｜DanaIn（DanaIn·ID）", region: "se-asia", line: "cash", legalName: "DanaIn", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "DanaKredi｜DanaKredi｜DanaKredi（DanaKredi·ID）", region: "se-asia", line: "cash", legalName: "DanaKredi", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Danaku｜Danaku｜Danaku（Danaku·ID）", region: "se-asia", line: "cash", legalName: "Danaku", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Danamas｜Danamas｜Danamas（Danamas·ID）", region: "se-asia", line: "cash", legalName: "Danamas", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Danamerdeka｜Danamerdeka｜Danamerdeka（Danamerdeka·ID）", region: "se-asia", line: "cash", legalName: "Danamerdeka", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Dompet Kilat｜Dompet Kilat｜DompetKilat（DompetKilat·ID）", region: "se-asia", line: "cash", legalName: "Dompet Kilat", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Duha Syariah｜Duha Syariah｜DuhaSyariah（DuhaSyariah·ID）", region: "se-asia", line: "cash", legalName: "Duha Syariah", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Dumi｜Dumi｜Dumi（Dumi·ID）", region: "se-asia", line: "cash", legalName: "Dumi", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Easycash｜Easycash｜Easycash（Easycash·ID）", region: "se-asia", line: "cash", legalName: "Easycash", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Edufund｜Edufund｜Edufund（Edufund·ID）", region: "se-asia", line: "cash", legalName: "Edufund", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Esta Kapital｜Esta Kapital｜EstaKapital（EstaKapital·ID）", region: "se-asia", line: "cash", legalName: "Esta Kapital", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Ethis｜Ethis｜Ethis（Ethis·ID）", region: "se-asia", line: "cash", legalName: "Ethis", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Findaya｜Findaya｜Findaya（Findaya·ID）", region: "se-asia", line: "cash", legalName: "Findaya", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Finmas｜Finmas｜Finmas（Finmas·ID）", region: "se-asia", line: "cash", legalName: "Finmas", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "FinPlus｜FinPlus｜FinPlus（FinPlus·ID）", region: "se-asia", line: "cash", legalName: "FinPlus", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "FINTAG｜FINTAG｜FINTAG（FINTAG·ID）", region: "se-asia", line: "cash", legalName: "FINTAG", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "GandengTangan｜GandengTangan｜GandengTangan（GandengTangan·ID）", region: "se-asia", line: "cash", legalName: "GandengTangan", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Gradana｜Gradana｜Gradana（Gradana·ID）", region: "se-asia", line: "cash", legalName: "Gradana", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "iGrow｜iGrow｜iGrow（iGrow·ID）", region: "se-asia", line: "cash", legalName: "iGrow", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Indodana｜Indodana｜Indodana（Indodana·ID）", region: "se-asia", line: "cash", legalName: "Indodana", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Indofund｜Indofund｜Indofund（Indofund·ID）", region: "se-asia", line: "cash", legalName: "Indofund", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Indosaku｜Indosaku｜Indosaku（Indosaku·ID）", region: "se-asia", line: "cash", legalName: "Indosaku", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Invoila｜Invoila｜Invoila（Invoila·ID）", region: "se-asia", line: "cash", legalName: "Invoila", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "IVOJI｜IVOJI｜IVOJI（IVOJI·ID）", region: "se-asia", line: "cash", legalName: "IVOJI", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "JULO｜JULO｜JULO（JULO·ID）", region: "se-asia", line: "cash", legalName: "JULO", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Kawan Cicil｜Kawan Cicil｜KawanCicil（KawanCicil·ID）", region: "se-asia", line: "cash", legalName: "Kawan Cicil", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Klik Kami｜Klik Kami｜KlikKami（KlikKami·ID）", region: "se-asia", line: "cash", legalName: "Klik Kami", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "KlikA2C｜KlikA2C｜KlikA2C（KlikA2C·ID）", region: "se-asia", line: "cash", legalName: "KlikA2C", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "KlikCair｜KlikCair｜KlikCair（KlikCair·ID）", region: "se-asia", line: "cash", legalName: "KlikCair", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "KlikUMKM｜KlikUMKM｜KlikUMKM（KlikUMKM·ID）", region: "se-asia", line: "cash", legalName: "KlikUMKM", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "KoinP2P｜KoinP2P｜KoinP2P（KoinP2P·ID）", region: "se-asia", line: "cash", legalName: "KoinP2P", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Komunal｜Komunal｜Komunal（Komunal·ID）", region: "se-asia", line: "cash", legalName: "Komunal", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "KrediFazz｜KrediFazz｜KrediFazz（KrediFazz·ID）", region: "se-asia", line: "cash", legalName: "KrediFazz", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Kredinesia｜Kredinesia｜Kredinesia（Kredinesia·ID）", region: "se-asia", line: "cash", legalName: "Kredinesia", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "KrediOne｜KrediOne｜KrediOne（KrediOne·ID）", region: "se-asia", line: "cash", legalName: "KrediOne", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Kredit Pintar｜Kredit Pintar｜KreditPintar（KreditPintar·ID）", region: "se-asia", line: "cash", legalName: "Kredit Pintar", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Kredito｜Kredito｜Kredito（Kredito·ID）", region: "se-asia", line: "cash", legalName: "Kredito", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "KreditOK｜KreditOK｜KreditOK（KreditOK·ID）", region: "se-asia", line: "cash", legalName: "KreditOK", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "KreditPro｜KreditPro｜KreditPro（KreditPro·ID）", region: "se-asia", line: "cash", legalName: "KreditPro", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "KTA Kilat｜KTA Kilat｜KTAKilat（KTAKilat·ID）", region: "se-asia", line: "cash", legalName: "KTA Kilat", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Lahan Sikam｜Lahan Sikam｜LahanSikam（LahanSikam·ID）", region: "se-asia", line: "cash", legalName: "Lahan Sikam", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Lumbung Dana｜Lumbung Dana｜LumbungDana（LumbungDana·ID）", region: "se-asia", line: "cash", legalName: "Lumbung Dana", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Mekar｜Mekar｜Mekar（Mekar·ID）", region: "se-asia", line: "cash", legalName: "Mekar", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Modal Nasional｜Modal Nasional｜ModalNasional（ModalNasional·ID）", region: "se-asia", line: "cash", legalName: "Modal Nasional", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Modal Rakyat｜Modal Rakyat｜ModalRakyat（ModalRakyat·ID）", region: "se-asia", line: "cash", legalName: "Modal Rakyat", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Modalku｜Modalku｜Modalku（Modalku·ID）", region: "se-asia", line: "cash", legalName: "Modalku", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "OVO Finansial｜OVO Finansial｜OVOFinansial（OVOFinansial·ID）", region: "se-asia", line: "cash", legalName: "OVO Finansial", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Papitupi Syariah｜Papitupi Syariah｜PapitupiSyariah（PapitupiSyariah·ID）", region: "se-asia", line: "cash", legalName: "Papitupi Syariah", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Pijar｜Pijar｜Pijar（Pijar·ID）", region: "se-asia", line: "cash", legalName: "Pijar", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Pinjam Gampang｜Pinjam Gampang｜PinjamGampang（PinjamGampang·ID）", region: "se-asia", line: "cash", legalName: "Pinjam Gampang", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Pinjam Modal｜Pinjam Modal｜PinjamModal（PinjamModal·ID）", region: "se-asia", line: "cash", legalName: "Pinjam Modal", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "PinjamanGo｜PinjamanGo｜PinjamanGo（PinjamanGo·ID）", region: "se-asia", line: "cash", legalName: "PinjamanGo", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "PinjamDuit｜PinjamDuit｜PinjamDuit（PinjamDuit·ID）", region: "se-asia", line: "cash", legalName: "PinjamDuit", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Pinjamin｜Pinjamin｜Pinjamin（Pinjamin·ID）", region: "se-asia", line: "cash", legalName: "Pinjamin", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "PinjamYuk｜PinjamYuk｜PinjamYuk（PinjamYuk·ID）", region: "se-asia", line: "cash", legalName: "PinjamYuk", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Pintek｜Pintek｜Pintek（Pintek·ID）", region: "se-asia", line: "cash", legalName: "Pintek", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Pohon Dana｜Pohon Dana｜PohonDana（PohonDana·ID）", region: "se-asia", line: "cash", legalName: "Pohon Dana", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Qazwa｜Qazwa｜Qazwa（Qazwa·ID）", region: "se-asia", line: "cash", legalName: "Qazwa", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Restock｜Restock｜Restock（Restock·ID）", region: "se-asia", line: "cash", legalName: "Restock", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "RUPIAH CEPAT｜RUPIAH CEPAT｜RUPIAHCEPAT（RUPIAHCEPAT·ID）", region: "se-asia", line: "cash", legalName: "RUPIAH CEPAT", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "SamaKita｜SamaKita｜SamaKita（SamaKita·ID）", region: "se-asia", line: "cash", legalName: "SamaKita", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Samir｜Samir｜Samir（Samir·ID）", region: "se-asia", line: "cash", legalName: "Samir", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Sanders One Stop Solution｜Sanders One Stop Solution｜SandersOneStopSolution（SandersOneStopSolution·ID）", region: "se-asia", line: "cash", legalName: "Sanders One Stop Solution", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "SINGA FINTECH｜SINGA FINTECH｜SINGAFINTECH（SINGAFINTECH·ID）", region: "se-asia", line: "cash", legalName: "SINGA FINTECH", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "Solusiku｜Solusiku｜Solusiku（Solusiku·ID）", region: "se-asia", line: "cash", legalName: "Solusiku", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "SPinjam｜SPinjam｜SPinjam（SPinjam·ID）", region: "se-asia", line: "cash", legalName: "SPinjam", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "tokomodal｜tokomodal｜tokomodal（tokomodal·ID）", region: "se-asia", line: "cash", legalName: "tokomodal", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
  { group: "UangMe｜UangMe｜UangMe（UangMe·ID）", region: "se-asia", line: "cash", legalName: "UangMe", code: "", licenseKindLabel: "LPBBTI/P2P", source: "ojkLpbbti", controller: "AFPI会员公开名·待OJK Direktori PDF交叉" },
];

/** PDIC/BSP：菲律宾投保数字银行 6 家 */
const PH_DIGITAL_BANK_HOLDERS: OfficialLicenseHolder[] = [
  {
    group: "Maya Bank｜Maya｜Voyager（MayaBank·PH）",
    region: "se-asia",
    line: "cash",
    legalName: "Maya Bank, Inc.",
    code: "",
    licenseKindLabel: "BSP数字银行/PDIC投保",
    source: "pdicDigibank",
    controller: "Voyager Innovations / Maya；数字银行法人 Maya Bank, Inc.",
  },
  {
    group: "GoTyme Bank｜GoTyme｜Gokongwei（GoTyme·PH）",
    region: "se-asia",
    line: "cash",
    legalName: "GoTyme Bank Corporation",
    code: "",
    licenseKindLabel: "BSP数字银行/PDIC投保",
    source: "pdicDigibank",
    controller: "Tyme / Gokongwei Group；法定主体 GoTyme Bank Corporation",
  },
  {
    group: "Overseas Filipino Bank｜OFBank｜LANDBANK（OFBank·PH）",
    region: "se-asia",
    line: "cash",
    legalName: "Overseas Filipino Bank, Inc., A Digital Bank of LANDBANK",
    code: "",
    licenseKindLabel: "BSP数字银行/PDIC投保",
    source: "pdicDigibank",
    controller: "LANDBANK 体系；法定主体 Overseas Filipino Bank, Inc.",
  },
  {
    group: "Tonik Digital Bank｜Tonik｜Tonik（Tonik·PH）",
    region: "se-asia",
    line: "cash",
    legalName: "Tonik Digital Bank, Inc.",
    code: "",
    licenseKindLabel: "BSP数字银行/PDIC投保",
    source: "pdicDigibank",
    controller: "Tonik Financial Pte Ltd 关联；法定主体 Tonik Digital Bank, Inc.",
  },
  {
    group: "UnionDigital Bank｜UnionDigital｜UnionBank（UnionDigital·PH）",
    region: "se-asia",
    line: "cash",
    legalName: "UnionDigital Bank, Inc.",
    code: "",
    licenseKindLabel: "BSP数字银行/PDIC投保",
    source: "pdicDigibank",
    controller: "Union Bank of the Philippines；法定主体 UnionDigital Bank, Inc.",
  },
  {
    group: "UNObank｜UNO｜UNOAsia（UNObank·PH）",
    region: "se-asia",
    line: "cash",
    legalName: "UNObank, Inc.",
    code: "",
    licenseKindLabel: "BSP数字银行/PDIC投保",
    source: "pdicDigibank",
    controller: "UNOAsia Pte Ltd 关联；法定主体 UNObank, Inc.",
  },
];

/** PH SEC Lending/Financing/OLP 交叉种子（JSON → OfficialLicenseHolder） */
const PH_SEC_LENDING_HOLDERS: OfficialLicenseHolder[] = (
  phSecLendingRoster.companies as {
    brand: string;
    legalName: string;
    group: string;
    kind: string;
    line: "cash" | "bnpl";
  }[]
).map((c) => ({
  group: c.group,
  region: "se-asia" as const,
  line: c.line,
  legalName: c.legalName,
  code: "",
  licenseKindLabel: c.kind.includes("BNPL") || c.kind.includes("Financing") ? "SEC Financing/OLP" : "SEC Lending/OLP",
  source: "secLendingPh" as const,
  controller: `SEC PH 公开名录交叉·${c.brand}`,
}));

/** IN RBI NBFC 数字消费贷头部样本 */
const IN_NBFC_DIGITAL_HOLDERS: OfficialLicenseHolder[] = (
  inNbfcDigitalRoster.companies as {
    brand: string;
    legalName: string;
    group: string;
    kind: string;
    line: "cash" | "bnpl";
  }[]
).map((c) => ({
  group: c.group,
  region: "south-asia" as const,
  line: c.line,
  legalName: c.legalName,
  code: "",
  licenseKindLabel: c.kind.includes("BNPL") ? "NBFC/BNPL" : "NBFC CoR",
  source: "rbiNbfcDigital" as const,
  controller: `RBI NBFC 名录交叉·${c.brand}`,
}));

const OFFICIAL_LICENSE_HOLDERS: OfficialLicenseHolder[] = [
  ...NFRA_CONSUMER_FINANCE_HOLDERS,
  ...NFRA_AUTO_FINANCE_HOLDERS,
  ...NFRA_FIN_LEASE_HOLDERS,
  ...PH_DIGITAL_BANK_HOLDERS,
  ...OJK_LPBBTI_HOLDERS,
  ...PH_SEC_LENDING_HOLDERS,
  ...IN_NBFC_DIGITAL_HOLDERS,
];

const OFFICIAL_LICENSE_BY_GROUP: Record<string, OfficialLicenseHolder> = Object.fromEntries(
  OFFICIAL_LICENSE_HOLDERS.map((h) => [h.group, h]),
);

function formatOfficialLicenseReg(h: OfficialLicenseHolder): string {
  const src = REGULATORY_DIRECTORY_SOURCES[h.source];
  if (h.source === "nfraBankCorp") {
    return `CN：${h.legalName}（${h.licenseKindLabel}；机构编码 ${h.code || "—"}；来源：${src}）`;
  }
  if (h.source === "pdicDigibank") {
    return `PH：${h.legalName}（${h.licenseKindLabel}；来源：${src}）`;
  }
  if (h.source === "ojkLpbbti") {
    return `ID：${h.legalName}（${h.licenseKindLabel}；来源：${src}）`;
  }
  if (h.source === "secLendingPh") {
    return `PH：${h.legalName}（${h.licenseKindLabel}；来源：${src}）`;
  }
  if (h.source === "rbiNbfcDigital") {
    return `IN：${h.legalName}（${h.licenseKindLabel}；来源：${src}）`;
  }
  return `${h.legalName}（${h.licenseKindLabel}；来源：${src}）`;
}

function licensesForGeo(
  region: Region,
  country: CountryFilter,
  licenseKind: LicenseKind | "all" = "all",
): RegLicenseDef[] {
  const n = normalizeCountryFilter(country);
  // 必须点选具体国家/地区后再展示，避免「全部洲际/全部国家」时芯片刷屏
  if (n === "all") return [];
  const set = new Set(n);
  return REGULATORY_LICENSE_CATALOG.filter((l) => {
    if (!set.has(l.country)) return false;
    if (licenseKind === "all") return true;
    const kinds = inferLicenseKinds(l.name, l.id);
    if (kinds.includes(licenseKind)) return true;
    // 粗类「其他」：名称未命中四类主粗类时仍可落「其他」
    if (licenseKind === "其他" && kinds.length === 0) return true;
    if (licenseKind === "其他" && kinds.includes("其他")) return true;
    return false;
  });
}

function regulatorMatchesLicense(r: CreditRow, lic: RegLicenseDef): boolean {
  const blob = `${r.group} ${r.brands} ${r.licenses} ${r.licenseReg} ${r.note} ${r.regulators}`;
  if (!matchesCountry(r.group, r.countries, lic.country)) return false;
  return lic.regulatorRe.test(blob);
}

function playerHoldsLicense(r: { licenseReg: string; licenses?: string; group: string; countries: string }, lic: RegLicenseDef): boolean {
  if (!matchesCountry(r.group, r.countries, lic.country)) return false;
  const blob = `${r.licenseReg} ${r.licenses ?? ""}`;
  return lic.holderRe.test(blob);
}

/** 国家筛：组名含 ·XX / 国别简称，或 countries 字段含中文名/别名 */
const COUNTRY_ALIASES: Record<Exclude<CountryCode, "all">, string[]> = {
  CN: ["中国大陆", "中国"],
  HK: ["中国香港", "香港", "Hong Kong"],
  MO: ["中国澳门", "澳门", "Macau", "Macao"],
  TW: ["中国台湾", "台湾", "台灣", "Taiwan"],
  JP: ["日本"],
  KR: ["韩国"],
  // 勿用裸「蒙古」：会误伤「内蒙古蒙商」等中国主体；外蒙古靠 ·MN / 外蒙古 / 蒙古国
  MN: ["外蒙古", "蒙古国", "Mongolia"],
  ID: ["印度尼西亚", "印尼"],
  VN: ["越南"],
  MY: ["马来西亚", "马来"],
  TH: ["泰国"],
  PH: ["菲律宾"],
  SG: ["新加坡", "Singapore"],
  IN: ["印度"],
  BD: ["孟加拉"],
  PK: ["巴基斯坦"],
  LK: ["斯里兰卡"],
  KZ: ["哈萨克斯坦"],
  UZ: ["乌兹别克斯坦"],
  KG: ["吉尔吉斯斯坦", "吉尔吉斯"],
  TJ: ["塔吉克斯坦"],
  TM: ["土库曼斯坦"],
  MX: ["墨西哥"],
  BR: ["巴西"],
  CO: ["哥伦比亚"],
  AR: ["阿根廷"],
  PE: ["秘鲁"],
  CL: ["智利"],
  EG: ["埃及"],
  MA: ["摩洛哥", "Morocco"],
  DZ: ["阿尔及利亚", "Algeria"],
  TN: ["突尼斯", "Tunisia"],
  LY: ["利比亚", "Libya"],
  SD: ["苏丹", "Sudan"],
  SA: ["沙特", "沙特阿拉伯"],
  AE: ["阿联酋", "阿拉伯联合酋长国", "UAE"],
  BH: ["巴林", "Bahrain"],
  QA: ["卡塔尔", "Qatar"],
  KW: ["科威特", "Kuwait"],
  OM: ["阿曼", "Oman"],
  JO: ["约旦", "Jordan"],
  LB: ["黎巴嫩", "Lebanon"],
  IQ: ["伊拉克", "Iraq"],
  IL: ["以色列", "Israel"],
  PS: ["巴勒斯坦", "Palestine"],
  TR: ["土耳其", "Türkiye", "Turkey"],
  YE: ["也门", "Yemen"],
  IR: ["伊朗", "Iran"],
  NG: ["尼日利亚", "Nigeria"],
  KE: ["肯尼亚", "Kenya"],
  GH: ["加纳", "Ghana"],
  ZA: ["南非", "South Africa"],
  TZ: ["坦桑尼亚", "Tanzania"],
  UG: ["乌干达", "Uganda"],
  RW: ["卢旺达", "Rwanda"],
  ET: ["埃塞俄比亚", "Ethiopia"],
  CI: ["科特迪瓦", "Ivory Coast", "Côte d'Ivoire", "Cote d'Ivoire"],
  SN: ["塞内加尔", "Senegal"],
  CM: ["喀麦隆", "Cameroon"],
  AO: ["安哥拉", "Angola"],
  MZ: ["莫桑比克", "Mozambique"],
  ZM: ["赞比亚", "Zambia"],
  ZW: ["津巴布韦", "Zimbabwe"],
  BW: ["博茨瓦纳", "Botswana"],
  NA: ["纳米比亚", "Namibia"],
  MU: ["毛里求斯", "Mauritius"],
  MG: ["马达加斯加", "Madagascar"],
  BJ: ["贝宁", "Benin"],
  BF: ["布基纳法索", "Burkina Faso"],
  ML: ["马里", "Mali"],
  CD: ["刚果（金）", "刚果金", "DRC", "Congo"],
  GA: ["加蓬", "Gabon"],
  US: ["美国"],
  CA: ["加拿大", "Canada"],
  GB: ["英国", "UK", "United Kingdom", "Britain"],
  DE: ["德国", "Germany"],
  FR: ["法国", "France"],
  NL: ["荷兰", "Netherlands"],
  ES: ["西班牙", "Spain"],
  PT: ["葡萄牙", "Portugal"],
  IT: ["意大利", "Italy"],
  SE: ["瑞典", "Sweden"],
  PL: ["波兰", "Poland"],
  IE: ["爱尔兰", "Ireland"],
  RU: ["俄罗斯", "Russia", "俄国", "俄联邦"],
};

function matchesCountry(group: string, countries: string, country: CountryCode): boolean {
  if (country === "all") return true;
  // 「全球」口径服务覆盖：匹配任意已建档国家（用于流量平台等跨国投放）
  if (hasWorldwideCoverage(countries)) return true;
  const blob = `${group} ${countries}`;
  if (country === "TW") {
    return (
      /中国台湾|台湾|台灣|Taiwan|(?:^|[\s、;；,/])TW(?:$|[\s、;；,/])/i.test(blob) ||
      group.includes("·TW")
    );
  }
  if (country === "CN") {
    if (group.includes("·TW") && !group.includes("·CN")) return false;
    if (group.includes("·HK") || group.includes("·MO")) return false;
    if (/中国香港|香港|Hong Kong|(?:^|[\s、;；,/])HK(?:$|[\s、;；,/])/i.test(blob) && !group.includes("·CN") && !/中国大陆/.test(blob)) return false;
    if (/中国澳门|澳门|Macau|Macao|(?:^|[\s、;；,/])MO(?:$|[\s、;；,/])/i.test(blob) && !group.includes("·CN") && !/中国大陆/.test(blob)) return false;
    if (
      /中国台湾|台湾|台灣|(?:^|[\s、;；,/])TW(?:$|[\s、;；,/])/i.test(blob) &&
      !/中国(?!台湾)/.test(blob) &&
      !group.includes("·CN")
    ) {
      return false;
    }
    // 中国内蒙古（蒙商消金等）归 CN，不因含「蒙古」串到外蒙古
    if (/内蒙古/.test(blob) && !group.includes("·MN")) return true;
    if (group.includes("·CN") || /(?:^|[\s、;；,/])CN(?:$|[\s、;；,/])/.test(blob)) return true;
    if (/中国大陆/.test(blob)) return true;
    if (/中国(?!台湾|香港|澳门)/.test(blob)) return true;
    return false;
  }
  if (country === "HK") {
    return (
      /中国香港|香港|Hong Kong|(?:^|[\s、;；,/])HK(?:$|[\s、;；,/])/i.test(blob) ||
      group.includes("·HK")
    );
  }
  if (country === "MO") {
    return (
      /中国澳门|澳门|Macau|Macao|(?:^|[\s、;；,/])MO(?:$|[\s、;；,/])/i.test(blob) ||
      group.includes("·MO")
    );
  }
  if (country === "MN") {
    // 外蒙古(MN) ≠ 中国内蒙古：有「内蒙古」且无 ·MN/外蒙古/蒙古国 则排除
    if (/内蒙古/.test(blob) && !/·MN|外蒙古|蒙古国|Mongolia/i.test(blob)) return false;
    if (group.includes("·MN") || /[·（(]MN[）)]/.test(group)) return true;
    return COUNTRY_ALIASES.MN.some((a) => blob.includes(a));
  }
  if (group.includes(`·${country}`)) return true;
  if (new RegExp(`[·（(]${country}[）)]`).test(group)) return true;
  return COUNTRY_ALIASES[country].some((a) => blob.includes(a));
}

/** countries 字段是否声明全球/多国覆盖（须以全球起首或明确「全球多国」等，避免文案里顺带写「全球」误伤） */
function hasWorldwideCoverage(countries: string): boolean {
  const t = countries.trim();
  if (/^全球(\s|$|（|\(|\/|多国|及)/.test(t)) return true;
  if (/^Worldwide\b/i.test(t)) return true;
  if (/全球多国|多国办公室|欧洲及全球|全球及/.test(t)) return true;
  return false;
}

function matchesLanguageZoneFilter(
  group: string,
  countries: string,
  langZone: LangZoneFilter,
): boolean {
  if (langZone === "all") return true;
  if (hasWorldwideCoverage(countries)) return true;
  return countriesInLanguageZone(langZone).some((c) =>
    matchesCountry(group, countries, c as CountryCode),
  );
}

const LINE_LABEL = {
  cash: "现金贷",
  bnpl: "消费分期/BNPL",
  lease: "信用租赁",
  agent: "信贷超市",
} as const;

const CREDIT_PROD_L1_ORDER: Exclude<CreditProdL1, "all">[] = [
  "个人信贷",
  "企业信贷",
  "信贷超市",
  "信贷其他",
];

const CREDIT_PROD_L2_BY_L1: Record<Exclude<CreditProdL1, "all">, Exclude<CreditProdL2, "all">[]> = {
  个人信贷: ["消费信贷", "住房信贷", "汽车信贷"],
  企业信贷: ["流贷", "固贷", "提前收款", "订单融资", "发票融资"],
  信贷超市: [],
  信贷其他: ["学生贷", "农户贷", "公务员贷"],
};

const CREDIT_PROD_L3_BY_L2: Partial<Record<Exclude<CreditProdL2, "all">, Exclude<CreditProdL3, "all">[]>> = {
  消费信贷: ["现金贷", "消费分期/BNPL", "信用卡", "信用租赁"],
  住房信贷: ["按揭贷", "抵押贷"],
  汽车信贷: ["新车贷", "二手车贷"],
};

const SUBSIDY_ROLE_ORDER: SubsidyRole[] = ["商户", "政府", "平台", "其他"];
const GUARANTEE_ROLE_ORDER: GuaranteeRole[] = ["商户", "政府", "平台", "担保/保险公司", "其他"];

function creditLeavesUnder(l1: CreditProdL1, l2: CreditProdL2): string[] {
  if (l1 === "all") return [];
  if (l1 === "信贷超市") return ["信贷超市"];
  if (l2 === "all") {
    const l2s = CREDIT_PROD_L2_BY_L1[l1];
    const out: string[] = [];
    for (const x of l2s) {
      const l3s = CREDIT_PROD_L3_BY_L2[x];
      if (l3s?.length) out.push(...l3s);
      else out.push(x);
    }
    return out;
  }
  const l3s = CREDIT_PROD_L3_BY_L2[l2];
  if (l3s?.length) return [...l3s];
  return [l2];
}

/** 从信贷行推断命中的产品叶子（库内 line/tags + 文案弱匹配） */
function inferCreditProductLeaves(r: CreditRow): Set<string> {
  const out = new Set<string>();
  if (r.line === "cash") out.add("现金贷");
  if (r.line === "bnpl") out.add("消费分期/BNPL");
  if (r.line === "lease") out.add("信用租赁");
  if (r.line === "agent") out.add("信贷超市");
  if (r.tags.includes("信用卡")) out.add("信用卡");
  const blob = `${r.group} ${r.brands} ${r.note} ${r.licenses} ${r.diandian} ${r.volume}`;
  if (/按揭|房贷|住房贷|按揭贷/i.test(blob)) out.add("按揭贷");
  if (/抵押贷|房产抵押|房屋抵押/i.test(blob)) out.add("抵押贷");
  if (/二手车/i.test(blob)) out.add("二手车贷");
  else if (/新车贷|汽车金融|车贷|汽车分期/i.test(blob)) out.add("新车贷");
  if (/流贷|流动资金贷|经营贷/i.test(blob)) out.add("流贷");
  if (/固贷|固定资产贷|设备贷/i.test(blob)) out.add("固贷");
  if (/提前收款|预支|商户收款加速/i.test(blob)) out.add("提前收款");
  if (/订单融资|采购融资/i.test(blob)) out.add("订单融资");
  if (/发票融资|保理|应收账款/i.test(blob)) out.add("发票融资");
  if (/学生贷|校园贷|学贷/i.test(blob)) out.add("学生贷");
  if (/农户|涉农|三农|农贷/i.test(blob)) out.add("农户贷");
  if (/公务员|公职/i.test(blob)) out.add("公务员贷");
  if (/贷超|比价|信贷超市|导流平台/i.test(blob)) out.add("信贷超市");
  return out;
}

function matchesCreditProductTree(
  r: CreditRow,
  l1: CreditProdL1,
  l2: CreditProdL2,
  l3: CreditProdL3,
): boolean {
  if (l1 === "all") return true;
  const leaves = inferCreditProductLeaves(r);
  if (l3 !== "all") return leaves.has(l3);
  const allowed = creditLeavesUnder(l1, l2);
  if (!allowed.length) return l1 === "信贷超市" ? leaves.has("信贷超市") : false;
  return allowed.some((x) => leaves.has(x));
}

function inferSubsidy(r: CreditRow): { has: boolean | null; roles: SubsidyRole[] } {
  const blob = `${r.note} ${r.licenses} ${r.diandian} ${r.volume} ${r.brands}`;
  if (!/贴息|免息|0息|零息|利息补贴|商户贴息|政府贴息|平台贴息/i.test(blob)) {
    return { has: null, roles: [] };
  }
  const roles: SubsidyRole[] = [];
  if (/商户贴息|商家贴息|商户.*贴息|贴息.*商户/i.test(blob)) roles.push("商户");
  if (/政府贴息|财政贴息|贴息.*政府|政府.*贴息/i.test(blob)) roles.push("政府");
  if (/平台贴息|平台.*贴息|贴息.*平台/i.test(blob)) roles.push("平台");
  if (!roles.length) roles.push("其他");
  return { has: true, roles };
}

function inferGuarantee(r: CreditRow): { has: boolean | null; roles: GuaranteeRole[] } {
  const blob = `${r.note} ${r.licenses} ${r.diandian} ${r.volume} ${r.brands} ${r.regulators}`;
  if (!/担保|融担|保证保险|担保公司|保险担保|增信/i.test(blob)) {
    return { has: null, roles: [] };
  }
  const roles: GuaranteeRole[] = [];
  if (/商户担保|商家担保/i.test(blob)) roles.push("商户");
  if (/政府担保|政策性担保|政府.*担保/i.test(blob)) roles.push("政府");
  if (/平台担保|平台.*担保/i.test(blob)) roles.push("平台");
  if (/担保公司|融担|保证保险|保险公司.*担保|担保\/保险/i.test(blob)) roles.push("担保/保险公司");
  if (!roles.length) roles.push("其他");
  return { has: true, roles };
}

function parseRoleCsv<T extends string>(raw: string, allowed: readonly T[]): T[] {
  if (!raw || raw === "all") return [];
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter((x): x is T => (allowed as readonly string[]).includes(x));
}

function toggleRoleCsv<T extends string>(raw: string, role: T): string {
  const cur = new Set(raw.split(",").map((x) => x.trim()).filter(Boolean));
  if (cur.has(role)) cur.delete(role);
  else cur.add(role);
  return [...cur].join(",");
}

function matchesSubsidyFilter(
  r: CreditRow,
  flag: SubsidyFlag,
  rolesCsv: string,
): boolean {
  if (flag === "all") return true;
  const inf = inferSubsidy(r);
  if (flag === "no") return inf.has === false || inf.has === null;
  if (inf.has !== true) return false;
  const want = parseRoleCsv(rolesCsv, SUBSIDY_ROLE_ORDER);
  if (!want.length) return true;
  return want.some((x) => inf.roles.includes(x));
}

function matchesGuaranteeFilter(
  r: CreditRow,
  flag: GuaranteeFlag,
  rolesCsv: string,
): boolean {
  if (flag === "all") return true;
  const inf = inferGuarantee(r);
  if (flag === "no") return inf.has === false || inf.has === null;
  if (inf.has !== true) return false;
  const want = parseRoleCsv(rolesCsv, GUARANTEE_ROLE_ORDER);
  if (!want.length) return true;
  return want.some((x) => inf.roles.includes(x));
}

function creditProductFilterLabel(l1: CreditProdL1, l2: CreditProdL2, l3: CreditProdL3): string {
  if (l1 === "all") return "全部信贷产品";
  if (l3 !== "all") return l3;
  if (l2 !== "all") return l2;
  return l1;
}

/** CRM 机构类型：玩家（下场）在前，其余为非下场生态角色 */
const INSTITUTION_TYPE_ORDER: InstitutionType[] = [
  "玩家",
  "流量服务商",
  "数据服务方",
  "监管",
  "资金参与机构",
  "风险参与机构",
  "股权投资人",
  "风控服务方",
  "支付服务机构",
  "回收机构",
  "权益服务商",
  "触达服务机构",
  "公关服务机构",
  "信托服务机构",
  "会计师事务所",
  "律师事务所",
  "评级机构",
];

/** 市场定位×服务性质五大类（流量服务商单列在业务运营服务商下） */
type InstBucket =
  | "用户端"
  | "监管与合规中介"
  | "资本风险方"
  | "业务运营服务商"
  | "基础设施服务商";

const INST_BUCKET_ORDER: InstBucket[] = [
  "用户端",
  "监管与合规中介",
  "资本风险方",
  "业务运营服务商",
  "基础设施服务商",
];

const INST_BUCKET_TYPES: Record<InstBucket, InstitutionType[]> = {
  用户端: ["玩家"],
  监管与合规中介: ["监管", "会计师事务所", "律师事务所", "评级机构"],
  资本风险方: ["资金参与机构", "风险参与机构", "股权投资人"],
  业务运营服务商: ["流量服务商", "回收机构", "权益服务商", "触达服务机构", "公关服务机构"],
  基础设施服务商: ["数据服务方", "风控服务方", "支付服务机构", "信托服务机构"],
};

const INST_BUCKET_LABEL: Record<InstBucket, string> = {
  用户端: "用户端",
  监管与合规中介: "监管与合规中介",
  资本风险方: "资本风险方",
  业务运营服务商: "业务运营服务商",
  基础设施服务商: "基础设施服务商",
};

const INST_TYPE_TO_BUCKET: Record<InstitutionType, InstBucket> = {
  玩家: "用户端",
  监管: "监管与合规中介",
  会计师事务所: "监管与合规中介",
  律师事务所: "监管与合规中介",
  评级机构: "监管与合规中介",
  资金参与机构: "资本风险方",
  风险参与机构: "资本风险方",
  股权投资人: "资本风险方",
  流量服务商: "业务运营服务商",
  回收机构: "业务运营服务商",
  权益服务商: "业务运营服务商",
  触达服务机构: "业务运营服务商",
  公关服务机构: "业务运营服务商",
  数据服务方: "基础设施服务商",
  风控服务方: "基础设施服务商",
  支付服务机构: "基础设施服务商",
  信托服务机构: "基础设施服务商",
};

function primaryInstBucket(types: InstitutionType[]): InstBucket {
  const t = types.find((x) => x !== "玩家") ?? types[0] ?? "玩家";
  return INST_TYPE_TO_BUCKET[t];
}

function isComplianceIntermediary(types: InstitutionType[]): boolean {
  return types.some((t) => INST_BUCKET_TYPES.监管与合规中介.includes(t));
}
const INSTITUTION_TYPE_LABEL: Record<InstitutionType, string> = {
  玩家: "玩家（下场）",
  流量服务商: "流量服务商",
  数据服务方: "数据服务方",
  监管: "监管",
  资金参与机构: "资金参与机构",
  风险参与机构: "风险参与机构",
  股权投资人: "股权投资人",
  风控服务方: "风控服务方",
  支付服务机构: "支付服务机构",
  回收机构: "回收机构",
  权益服务商: "权益服务商",
  触达服务机构: "触达服务机构",
  公关服务机构: "公关服务机构",
  信托服务机构: "信托服务机构",
  会计师事务所: "会计师事务所",
  律师事务所: "律师事务所",
  评级机构: "评级机构",
};
const INSTITUTION_TYPE_BLURB: Record<InstitutionType, string> = {
  玩家: "下场展业主体；按场景原生 / 信贷原生浏览。",
  流量服务商: "流量服务商总类；细分需在下方单选（流量平台 / 代理商 / 贷超 / 代理运营）。",
  数据服务方: "征信、多头、替代数据等。",
  监管: "央行/行业监管名录；洲际→国家→法定牌照交叉筛选。",
  资金参与机构: "本地银行、代理、结构化、优先/夹层投资人。",
  风险参与机构: "保险等增信与风险分担。",
  股权投资人: "PE / VC / 战略 / 银行财务投资人等股权侧投资人。",
  风控服务方: "信用评分、反欺诈、核验与风控决策等 B 端能力（非 To C 场景词条）。",
  支付服务机构:
    "出金/入金/资金监管相关支付：官方支付基建、国民级支付机构、支付代理服务商。",
  回收机构: "全国性/地方 AMC、NPL 投资与委外催收、资产处置服务商。",
  权益服务商: "会员权益、积分、搭售增值包。",
  触达服务机构: "短信、推送、外呼、即时消息。",
  公关服务机构: "品牌公关、危机传播、媒体关系。",
  信托服务机构: "信托计划、ABS/资产信托等受托服务。",
  会计师事务所: "审计、验资、IPO/发债财务尽调与内控鉴证。",
  律师事务所: "金融法务、合规、争议解决。",
  评级机构: "主体/债项信用评级。",
};

const ECO_ROLE_ORDER: EcoRole[] = INSTITUTION_TYPE_ORDER.filter((t): t is EcoRole => t !== "玩家");
const ECO_ROLE_LABEL: Record<EcoRole, string> = {
  流量服务商: INSTITUTION_TYPE_LABEL.流量服务商,
  数据服务方: INSTITUTION_TYPE_LABEL.数据服务方,
  监管: INSTITUTION_TYPE_LABEL.监管,
  资金参与机构: INSTITUTION_TYPE_LABEL.资金参与机构,
  风险参与机构: INSTITUTION_TYPE_LABEL.风险参与机构,
  股权投资人: INSTITUTION_TYPE_LABEL.股权投资人,
  风控服务方: INSTITUTION_TYPE_LABEL.风控服务方,
  支付服务机构: INSTITUTION_TYPE_LABEL.支付服务机构,
  回收机构: INSTITUTION_TYPE_LABEL.回收机构,
  权益服务商: INSTITUTION_TYPE_LABEL.权益服务商,
  触达服务机构: INSTITUTION_TYPE_LABEL.触达服务机构,
  公关服务机构: INSTITUTION_TYPE_LABEL.公关服务机构,
  信托服务机构: INSTITUTION_TYPE_LABEL.信托服务机构,
  会计师事务所: INSTITUTION_TYPE_LABEL.会计师事务所,
  律师事务所: INSTITUTION_TYPE_LABEL.律师事务所,
  评级机构: INSTITUTION_TYPE_LABEL.评级机构,
};

/** 资金参与机构细分（玩家式二分的同级：进入「资金参与机构」后再筛） */
const FUND_KIND_ORDER: FundParticipationKind[] = [
  "本地银行",
  "本地银行代理",
  "结构化服务商",
  "优先投资人",
  "夹层投资人",
];
const FUND_KIND_LABEL: Record<FundParticipationKind, string> = {
  本地银行: "本地银行",
  本地银行代理: "本地银行代理",
  结构化服务商: "结构化服务商",
  优先投资人: "优先投资人",
  夹层投资人: "夹层投资人",
};
const FUND_KIND_BLURB: Record<FundParticipationKind, string> = {
  本地银行: "当地持牌银行直接出资/联合贷资金方。",
  本地银行代理: "代表或通道对接本地银行资金的代理方。",
  结构化服务商: "ABS/信托计划/结构化融资安排与服务。",
  优先投资人: "结构化优先层/专项信贷出资人（如 Avenue、贝莱德等对照样本）。",
  夹层投资人: "结构化中夹层/次级等中间层出资人。",
};

function resolveFundKinds(
  institutionTypes: InstitutionType[],
  draft?: FundParticipationKind[],
): FundParticipationKind[] {
  if (!institutionTypes.includes("资金参与机构")) return [];
  if (draft?.length) return FUND_KIND_ORDER.filter((k) => draft.includes(k));
  return [];
}

/** 流量服务商细分 */
const TRAFFIC_KIND_ORDER: TrafficServiceKind[] = ["流量平台", "代理商", "贷超", "代理运营"];
const TRAFFIC_KIND_LABEL: Record<TrafficServiceKind, string> = {
  流量平台: "流量平台",
  代理商: "代理商",
  贷超: "贷超",
  代理运营: "代理运营",
};
const TRAFFIC_KIND_BLURB: Record<TrafficServiceKind, string> = {
  流量平台:
    "广告/分发平台：Google、Meta、TikTok、Apple，以及 Snap、X、LinkedIn、Taboola、Outbrain 等；现金贷广告多受限或禁止（见各平台流量服务政策）。",
  代理商:
    "平台授权代理/经销商（Reseller/Agency）与 Partner 目录入口（蓝标等）；区域销售、开户与投放服务。≠现金贷流量掮客。",
  贷超: "线上贷超/比价/导流（LendingTree、Credit Karma、Cermati 等）；部分市场需持牌；Lead gen 受 FTC/CFPB 等审视。",
  代理运营: "代运营、ASO/ASA、榜单与监测（点点、七麦、AppsFlyer/Adjust 等）。",
};

/**
 * 标准可采信源 · 广告平台官方政策与授权代理目录（CRM 核验优先）
 * 代理商 ≠ 现金贷流量渠道；开户后仍须通过平台金融广告审核。
 */
const STANDARD_TRAFFIC_SOURCES: {
  id: string;
  platform: string;
  kind: "广告政策" | "授权代理目录";
  label: string;
  url: string;
}[] = [
  {
    id: "google-ads-finance-policy",
    platform: "Google",
    kind: "广告政策",
    label: "Google Ads 金融产品与服务政策",
    url: "https://support.google.com/adspolicy/answer/2464994",
  },
  {
    id: "google-partners-directory",
    platform: "Google",
    kind: "授权代理目录",
    label: "Google Partner Directory",
    url: "https://www.google.com/partners/agency-search/",
  },
  {
    id: "meta-finance-ads-policy",
    platform: "Meta",
    kind: "广告政策",
    label: "Meta 金融产品和服务广告政策",
    url: "https://www.facebook.com/policies/ads/prohibited_content/financial_products",
  },
  {
    id: "meta-business-partners",
    platform: "Meta",
    kind: "授权代理目录",
    label: "Meta Business Partners / Marketing Partners",
    url: "https://www.facebook.com/business/partners",
  },
  {
    id: "tiktok-ads-industry",
    platform: "TikTok",
    kind: "广告政策",
    label: "TikTok Ads 行业准入/金融服务政策",
    url: "https://ads.tiktok.com/help/article/tiktok-advertising-policies-industry-entry",
  },
  {
    id: "tiktok-marketing-partners",
    platform: "TikTok",
    kind: "授权代理目录",
    label: "TikTok Marketing Partners",
    url: "https://www.tiktok.com/business/en-US/solutions/tiktok-marketing-partners",
  },
  {
    id: "apple-review-guidelines",
    platform: "Apple",
    kind: "广告政策",
    label: "App Store Review Guidelines",
    url: "https://developer.apple.com/app-store/review/guidelines/",
  },
  {
    id: "apple-search-ads-partners",
    platform: "Apple",
    kind: "授权代理目录",
    label: "Apple Search Ads Partners",
    url: "https://searchads.apple.com/help/partners/",
  },
];

function standardSourcesForPlatform(platformHint: string): typeof STANDARD_TRAFFIC_SOURCES {
  const p = platformHint.toLowerCase();
  return STANDARD_TRAFFIC_SOURCES.filter((s) => {
    const pl = s.platform.toLowerCase();
    if (pl === "google") return /google|alphabet|youtube/.test(p);
    if (pl === "meta") return /meta|facebook|instagram/.test(p);
    if (pl === "tiktok") return /tiktok|bytedance|字节/.test(p);
    if (pl === "apple") return /apple|asa|app store|searchads/.test(p);
    return false;
  });
}

/** 流量服务商详情：优先匹配平台政策/Partner 目录；代理商默认展示全部官方代理目录 */
function resolveTrafficStandardSources(r: {
  group: string;
  brands: string;
  note: string;
  traffic: string;
  licenses: string;
  trafficKinds: TrafficServiceKind[];
  institutionTypes: InstitutionType[];
}): typeof STANDARD_TRAFFIC_SOURCES {
  const hint = `${r.group} ${r.brands} ${r.note} ${r.traffic} ${r.licenses}`;
  const matched = standardSourcesForPlatform(hint);
  if (matched.length) return matched;
  if (r.trafficKinds.includes("代理商")) {
    return STANDARD_TRAFFIC_SOURCES.filter((s) => s.kind === "授权代理目录");
  }
  return [];
}

/**
 * 核心流量平台 · 现金贷/高息短贷广告政策（公开广告政策对照；非监管立法）
 * 监管侧要求见 REGULATOR_CASH_LENDING_POLICY / 监管机构详情。
 */
type TrafficCorePolicy = {
  summary: string;
  status: string;
  allow: string;
  agentMode: string;
  docs: string;
};

const TRAFFIC_CORE_POLICY: Record<string, TrafficCorePolicy> = {
  "Google｜Google Ads｜Alphabet（流量服务商·流量平台·US）": {
    summary: "多国禁止 payday loan（年利率≥36%等）；合规个贷需金融认证",
    status:
      "2016 年起禁止美/加/英等市场 payday loan 广告（年利率≥36%的贷款）；后扩展至更多国家。",
    allow: "部分市场允许合规个人贷款，但需通过 Google 金融产品认证/预审。",
    agentMode:
      "授权代理=Google Partners/Reseller（标准信源目录可查）。角色为区域销售与投放服务，≠现金贷流量掮客；金融投放仍须平台审核。不按现金贷垂直披露专项代理。",
    docs: "https://support.google.com/adspolicy/answer/2464994",
  },
  "Meta｜Facebook｜Meta（流量服务商·流量平台·US）": {
    summary: "禁止 payday/title/pawn 广告；贷款广告须披露 APR",
    status:
      "2019 年起禁止 payday loan、title loan、pawn shop 等广告；贷款类广告要求披露 APR 等要素。",
    allow: "合规个人贷款、BNPL 等通常需预审；以当地 Meta 金融广告政策为准。",
    agentMode:
      "授权代理=Meta Business Partners / Reseller（标准信源目录可查）。≠现金贷掮客；开户后仍须过金融广告审核。",
    docs: "https://www.facebook.com/policies/ads/prohibited_content/financial_products",
  },
  "ByteDance｜TikTok｜字节跳动（流量服务商·流量平台·全球）": {
    summary: "全球禁止 payday loan 广告；持牌合规金融产品分区开放",
    status: "全球禁止 payday loan 广告；部分地区允许持牌金融机构的合规产品投放。",
    allow: "以 TikTok Ads 金融服务政策及当地牌照预审为准。",
    agentMode:
      "授权代理=TikTok Marketing Partners（标准信源目录可查；与 Shop Partner 部分重叠）。≠现金贷专项名单。",
    docs: "https://ads.tiktok.com/help/article/tiktok-advertising-policies-industry-entry",
  },
  "Apple｜App Store／ASA｜Apple（流量服务商·流量平台·US）": {
    summary: "禁止掠夺性贷款应用；金融 App 审核严格",
    status: "禁止「掠夺性贷款」应用；App Store 审核指南对金融类 App 有严格限制。",
    allow: "持牌/合规金融应用可上架与 ASA，须通过审核。",
    agentMode:
      "授权代理=Apple Search Ads Partners（标准信源目录可查；体系相对封闭）。≠现金贷专项代理。",
    docs: "https://developer.apple.com/app-store/review/guidelines/",
  },
  "Snap｜Snapchat Ads｜Snap（流量服务商·流量平台·US）": {
    summary: "禁止 payday loan（口径近似 Meta）",
    status: "禁止 payday loan 等掠夺性借贷广告（公开广告政策口径）。",
    allow: "合规金融产品以当地政策与预审为准。",
    agentMode: "无公开「现金贷核心代理」名单；授权代理≠现金贷渠道。",
    docs: "https://www.snap.com/en-US/ad-policies",
  },
  "X｜Twitter Ads｜X Corp（流量服务商·流量平台·US）": {
    summary: "高风险金融产品受限；政策多次调整",
    status: "限制高风险金融产品广告；具体以现行 Ads 政策为准（历史上多次修订）。",
    allow: "合规金融广告可能开放但审核收紧。",
    agentMode: "无公开「现金贷核心代理」名单；授权代理≠现金贷渠道。",
    docs: "https://business.x.com/en/help/ads-policies",
  },
  "LinkedIn｜LinkedIn Ads｜Microsoft（流量服务商·流量平台·US）": {
    summary: "禁止 payday loan；B2B 定位不适配现金贷获客",
    status: "禁止 payday loan 等；定位 B2B，不适合现金贷 C 端获客。",
    allow: "企业金融/职场相关合规产品另计。",
    agentMode: "无现金贷专项代理公开名单。",
    docs: "https://www.linkedin.com/legal/ads-policy",
  },
  "Taboola｜Taboola｜Taboola（流量服务商·流量平台·US）": {
    summary: "内容推荐网络；金融/现金贷审核趋严",
    status: "原生推荐广告网络；历史上曾有现金贷广告主，2020 年后审核趋严（公开行业对照）。",
    allow: "以 Taboola 广告政策与媒体侧审核为准。",
    agentMode: "非「核心代理」口径；与授权 Reseller 分列。",
    docs: "https://www.taboola.com/policies",
  },
  "Outbrain｜Outbrain｜Outbrain（流量服务商·流量平台·US）": {
    summary: "内容推荐网络；现金贷类投放审核趋严",
    status: "原生推荐广告网络；高风险金融/现金贷类投放审核趋严。",
    allow: "以 Outbrain 广告政策与媒体侧审核为准。",
    agentMode: "非现金贷核心代理名单。",
    docs: "https://www.outbrain.com/legal/",
  },
};

/** 监管机构 · 现金贷/高息短贷与金融广告相关公开要求（归监管详情） */
const REGULATOR_CASH_LENDING_POLICY: Record<
  string,
  { summary: string; detail: string; docs?: string }
> = {
  "Consumer Financial Protection Bureau｜CFPB｜美国消费者金融保护局（监管·US）": {
    summary: "Payday loan 消费者保护；投诉库与规则制定",
    detail:
      "对 payday loan / 高成本短贷实施消费者保护规则与执法；部分州禁止或严限 payday loan；与 FTC 等协同打击欺诈性获客。Military Lending Act 等对军人等群体设利率上限（公开口径常引 36% APR）。",
    docs: "https://www.consumerfinance.gov/",
  },
  "Federal Trade Commission｜FTC｜美国联邦贸易委员会（监管·US）": {
    summary: "虚假获客/Lead gen 执法；反欺诈广告",
    detail:
      "对欺骗性 lead generation、虚假贷款广告等执法；历史上有多起 lead gen 和解与诉讼。金融广告不得误导 APR、费用与资格。",
    docs: "https://www.ftc.gov/",
  },
  "Financial Conduct Authority｜FCA｜英国金融行为监管局（监管·GB）": {
    summary: "高成本短贷利率上限；行为监管",
    detail:
      "2015 年起对高成本短贷设利率上限（公开口径含日利率上限约 0.8%/天等规则组合）；行业出清后持续行为监管与广告披露要求。",
    docs: "https://www.fca.org.uk/",
  },
  "国家金融监督管理总局｜金管总局｜NFRA（监管·CN）": {
    summary: "现金贷整顿；无牌放贷禁止",
    detail:
      "2017 年起清理整顿现金贷；坚持持牌经营，无牌机构禁止放贷；联合整治网络借贷与暴力催收等。金融广告/导流须对接持牌机构。",
    docs: "https://www.nfra.gov.cn/",
  },
  "Reserve Bank of India｜RBI｜印度央行（监管·IN）": {
    summary: "NBFC 牌照；违规现金贷 App 下架",
    detail:
      "对 NBFC 严格牌照与行为监管；多次推动下架违规数字放贷 App；导流/广告须对接合规持牌主体。",
    docs: "https://www.rbi.org.in/",
  },
  "Otoritas Jasa Keuangan｜OJK｜金监局（监管·ID）": {
    summary: "LPBBTI/P2P=POJK 40/2024；BNPL=POJK 32/2025（银行+融资公司）",
    detail:
      "P2P/LPBBTI 现行框架为 POJK 40/2024（2024-12-27生效，取代POJK 10/2022）：最低股权约Rp12.5B、单户上限约Rp2B、禁跨境放贷等。BNPL 由 POJK 32/2025（2025-12-15生效）规范：仅商业银行与融资公司可办，融资公司须事先获OJK批准，既有主体约6个月调整期。行业水位（媒体转述OJK）：P2P outstanding 2026-01约Rp98.54T；融资公司BNPL约Rp12.18T、银行BNPL约Rp27.1T。第三方BNPL美元规模（R&M媒体摘要）与OJK余额分轨。",
    docs: "https://ojk.go.id/id/regulasi/Pages/POJK-40-Tahun-2024-Layanan-Pendanaan-Bersama-Berbasis-Teknologi-Informasi.aspx",
  },
  "Securities and Exchange Commission｜SEC｜菲律宾证监会（监管·PH）": {
    summary: "Lending/Financing+OLP登记；协同下架未注册App；落地BSP 1133利率上限",
    detail:
      "线上放贷须SEC Lending/Financing公司牌照并登记OLP（MC 19披露；MC 10曾冻结新OLP）。2023-02协同Google下架33个未注册OLP（ABS-CBN报道）。利率上限执行BSP Circular 1133（SEC MC 3/2022）：覆盖≤₱10,000且期限≤4个月无担保一般用途贷——名义≤6%/月、EIR≤15%/月、逾期罚息≤5%/月、总成本≤本金100%。数字支付基建见BSP 2024 Status of Digital Payments（零售笔数数字化约57.4%）。",
    docs: "https://www.bsp.gov.ph/Regulations/Issuances/2021/1133.pdf",
  },
  "Central Bank of Nigeria｜CBN｜尼日利亚央行（监管·NG）": {
    summary: "数字贷款监管收紧（与消费者保护机构协同）",
    detail:
      "近年加强数字贷款与消费者保护；协同整治掠夺性数字贷与不当催收（公开报道 2022–2023 起加严）。",
    docs: "https://www.cbn.gov.ng/",
  },
};

function resolveTrafficKinds(
  institutionTypes: InstitutionType[],
  line: CreditRow["line"],
  draft?: TrafficServiceKind[],
): TrafficServiceKind[] {
  if (!institutionTypes.includes("流量服务商")) return [];
  if (draft?.length) return TRAFFIC_KIND_ORDER.filter((k) => draft.includes(k));
  // 历史 line=agent 样本默认归「贷超」
  if (line === "agent") return ["贷超"];
  return [];
}

function resolvePaymentKinds(
  institutionTypes: InstitutionType[],
  draft?: PaymentKind[],
): PaymentKind[] {
  if (!institutionTypes.includes("支付服务机构")) return [];
  if (draft?.length) return PAYMENT_KIND_ORDER.filter((k) => draft.includes(k));
  return [];
}

function resolveEquityKinds(
  institutionTypes: InstitutionType[],
  draft?: EquityInvestorKind[],
): EquityInvestorKind[] {
  if (!institutionTypes.includes("股权投资人")) return [];
  if (draft?.length) return EQUITY_KIND_ORDER.filter((k) => draft.includes(k));
  return [];
}

/** CSV 名录命中的已有 group → 股权细分（用于打标，不建重档） */
function equityKindsFromRosterMatch(group: string): EquityInvestorKind[] {
  const found = new Set<EquityInvestorKind>();
  for (const row of EQUITY_INVESTOR_ROSTER.rows) {
    if (equityMatchGroup(row.name) === group) found.add(row.equityKind);
  }
  return EQUITY_KIND_ORDER.filter((k) => found.has(k));
}

const SOURCE_CHANNEL_ORDER: SourceChannel[] = ["流量源", "监管源", "经办认领"];

/**
 * 经办认领 / 登录：仅 *@alliancechuan.com 白名单用户名（不区分大小写）。
 * 初始密码 chuan666；输错即锁定，须管理员 leoli 重置。登录后可自行改密。
 */
const CLAIM_ALLOWED_DOMAIN = "alliancechuan.com";
const CLAIM_DEFAULT_PASSWORD = "chuan666";
const CLAIM_ADMIN_LOCAL = "leoli";
const CLAIM_ALLOWED_LOCALS: readonly string[] = [
  "leoli",
  "elsawu",
  "AndrewYin",
  "lunayang",
  "yalizhu",
  "Louischau",
  "kevinyung",
  "tunlin",
  "tracytian",
  "taoli",
  "samsoncheng",
];

type ClaimRecord = {
  email: string;
  /** 默认 = 邮箱本地名（*@domain 的 *） */
  displayName: string;
  note: string;
  confirmedAt: string;
};

type AuthUserRecord = {
  local: string;
  displayLocal: string;
  password: string;
  locked: boolean;
  enabled: boolean;
};

function normalizeClaimEmail(email: string): string {
  return email.trim().toLowerCase();
}

function claimLocalPart(email: string): string {
  return normalizeClaimEmail(email).split("@")[0] ?? "";
}

/** 白名单内展示用本地名（保留名单大小写）；否则回退为输入本地名 */
function canonicalClaimLocal(local: string): string {
  const key = local.trim().toLowerCase();
  return CLAIM_ALLOWED_LOCALS.find((x) => x.toLowerCase() === key) ?? local.trim();
}

function defaultClaimDisplayName(email: string): string {
  return canonicalClaimLocal(claimLocalPart(email));
}

function emailFromLocal(local: string): string {
  return `${local.trim().toLowerCase()}@${CLAIM_ALLOWED_DOMAIN}`;
}

function localHasClaimPermission(local: string): boolean {
  const key = local.trim().toLowerCase();
  if (!key) return false;
  return CLAIM_ALLOWED_LOCALS.some((x) => x.toLowerCase() === key);
}

function emailHasClaimPermission(email: string): boolean {
  const e = normalizeClaimEmail(email);
  const m = /^([^\s@]+)@([^\s@]+)$/.exec(e);
  if (!m) return false;
  const [, local, domain] = m;
  if (domain !== CLAIM_ALLOWED_DOMAIN) return false;
  return localHasClaimPermission(local);
}

function isClaimAdmin(local: string): boolean {
  return local.trim().toLowerCase() === CLAIM_ADMIN_LOCAL;
}

function seedAuthUser(localRaw: string): AuthUserRecord {
  const key = localRaw.trim().toLowerCase();
  return {
    local: key,
    displayLocal: canonicalClaimLocal(localRaw),
    password: CLAIM_DEFAULT_PASSWORD,
    locked: false,
    enabled: true,
  };
}

function resolveAuthUser(
  users: Record<string, AuthUserRecord>,
  localRaw: string,
): AuthUserRecord {
  const key = localRaw.trim().toLowerCase();
  return users[key] ?? seedAuthUser(localRaw);
}

/** 登录框只认用户名；若误填邮箱则取 @ 前部分（不在 UI 提示域名） */
function normalizeLoginUsername(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return "";
  const at = s.indexOf("@");
  return at >= 0 ? s.slice(0, at) : s;
}

/**
 * 登录输入：受控。
 * - useCanvasState 保证画布重建后还能读回
 * - globalThis 草稿作竞态缓冲（重建瞬间 state 可能短暂空，以更长的一侧为准）
 * - 不用 defaultValue/非受控（重建必丢字）
 */
type LoginDraft = { email: string; pass: string };

type SearchDraft = { q: string };
function getSearchDraft(): SearchDraft {
  const g = globalThis as unknown as { __crmAtlasSearchDraft?: SearchDraft };
  if (!g.__crmAtlasSearchDraft) g.__crmAtlasSearchDraft = { q: "" };
  return g.__crmAtlasSearchDraft;
}

function getLoginDraft(): LoginDraft {
  const g = globalThis as unknown as { __crmAtlasLoginDraft?: LoginDraft };
  if (!g.__crmAtlasLoginDraft) g.__crmAtlasLoginDraft = { email: "", pass: "" };
  return g.__crmAtlasLoginDraft;
}

function pickLoginValue(stateVal: string, draftVal: string): string {
  if (draftVal.length > stateVal.length) return draftVal;
  if (stateVal.length > draftVal.length) return stateVal;
  return stateVal || draftVal;
}

function applyPasteToValue(
  value: string,
  selectionStart: number | null | undefined,
  selectionEnd: number | null | undefined,
  pasted: string,
): string {
  const start = selectionStart ?? value.length;
  const end = selectionEnd ?? value.length;
  return value.slice(0, start) + pasted + value.slice(end);
}

function LoginPasswordField({
  value,
  onChange,
  showPass,
  onToggle,
}: {
  value: string;
  onChange: (v: string) => void;
  showPass: boolean;
  onToggle: () => void;
}) {
  const theme = useHostTheme();
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        boxSizing: "border-box",
        borderRadius: 8,
        border: `1px solid ${theme.stroke.tertiary}`,
        background: theme.bg.editor,
      }}
    >
      <input
        type={showPass ? "text" : "password"}
        placeholder="密码"
        autoComplete={showPass ? "off" : "current-password"}
        spellCheck={false}
        inputMode={showPass ? "text" : undefined}
        value={value}
        onChange={(e) => {
          const t = e.currentTarget as unknown as { value?: string };
          onChange(t.value ?? "");
        }}
        onPaste={(e) => {
          const pasted = e.clipboardData?.getData("text") ?? "";
          if (!pasted) return;
          e.preventDefault();
          const t = e.currentTarget as unknown as {
            selectionStart?: number | null;
            selectionEnd?: number | null;
          };
          onChange(applyPasteToValue(value, t.selectionStart, t.selectionEnd, pasted));
        }}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "8px 36px 8px 10px",
          border: "none",
          borderRadius: 8,
          background: "transparent",
          color: theme.text.primary,
          outline: "none",
          fontSize: 13,
        }}
      />
      <button
        type="button"
        title={showPass ? "隐藏密码" : "显示密码"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }}
        style={{
          position: "absolute",
          right: 6,
          top: "50%",
          transform: "translateY(-50%)",
          width: 28,
          height: 28,
          padding: 0,
          border: "none",
          borderRadius: 8,
          background: "transparent",
          color: theme.text.tertiary,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {showPass ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M1.8 8c1-1.4 3.5-3.8 6.8-3.8S13.8 6.6 14.8 8c-1 1.4-3.5 3.8-6.8 3.8S2.8 9.4 1.8 8Z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M2 2l12 12M6.5 6.7A2.5 2.5 0 0 0 9.3 9.5M7.1 4.3A6.8 6.8 0 0 1 8 4.2c3.3 0 5.8 2.4 6.8 3.8-.4.5-1.1 1.3-2.1 2M4.2 4.9C3 5.7 2.2 6.7 1.8 8c1 1.4 3.5 3.8 6.8 3.8.5 0 1-.05 1.4-.14"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

const SOURCE_CHANNEL_LABEL: Record<SourceChannel, string> = {
  流量源: "流量源（商店榜/点点/路飞/Sensor Tower/墨腾研报等）",
  监管源: "监管源（持牌名录/登记）",
  经办认领: "经办认领（客户经理联系确认，对信息质量负责）",
};

/**
 * 墨腾创投（Momentum Works）长期信源摘要。
 * 用户粘贴墨腾微信后优先吸收至此，并回写场景/信贷口径；勿粘贴付费报告全文。
 * @see https://mp.weixin.qq.com/s/2x9gpbb9bkoakoEKaULSzA
 * @see https://mp.weixin.qq.com/s/Qh51KR5OdsuOdTGHv99TYA
 */
const MOTENG_LEARNED = {
  account: "墨腾创投（MomentumWorks）",
  seaVc2022h1: {
    title: "2022上半年东南亚风险投资报告（Cento×墨腾）",
    fundingUsdBn: 6.6,
    fintechShareOfInvestmentApprox: "约50%（2019初约8%）",
    fintechShareOfExitsApprox: "约75%",
    note: "支付基建与监管升级、科技获银行牌照；平台重心由超级应用转向金融服务",
  },
  seaFoodDelivery2025: {
    title: "东南亚外卖平台报告6.0",
    gmvYoY: "2025外卖大盘GMV约+18%（前一年约+13%）",
    /** 主市场结构：Grab + Gojek(GoTo) 双寡头；ShopeeFood/Foodpanda 为挑战/尾部 */
    marketStructure: "Grab + Gojek（GoTo）双寡头为主市场",
    grabShareApprox: "约55%",
    gojekNote: "印尼GoFood与GrabFood构成本地双寡头；区域份额次于Grab",
    shopeeFoodRank: "区域GMV第二（超Foodpanda）；印尼单量追赶GoFood——挑战者非主市场定义",
    foodpandaThExit: true,
    tiktokLocalLife: "短期不取代外卖；SEA变现主路径偏电商",
    growthDrivers: "六国两位数增长；泰约+22%最快；频次驱动、客单价略下行",
  },
} as const;

/**
 * Trading Economics · 国家/地区宏观长期信源。
 * 入口：https://zh.tradingeconomics.com/{slug}/indicators
 * 用途：选中国家/地区时展示信贷相关宏观（增长/通胀/政策利率/私营贷款或消费信贷等）；与监管/玩家交叉。
 * 口径：聚合官方统计局/央行等；画布仅落可核验要点 + 时点，勿整页粘贴。
 * @see https://zh.tradingeconomics.com/pakistan/indicators
 */
const TE_SLUG: Partial<Record<Exclude<CountryCode, "all">, string>> = {
  CN: "china", HK: "hong-kong", MO: "macao", TW: "taiwan", JP: "japan", KR: "south-korea", MN: "mongolia",
  ID: "indonesia", VN: "vietnam", MY: "malaysia", TH: "thailand", PH: "philippines", SG: "singapore",
  IN: "india", BD: "bangladesh", PK: "pakistan", LK: "sri-lanka",
  KZ: "kazakhstan", UZ: "uzbekistan", KG: "kyrgyzstan", TJ: "tajikistan", TM: "turkmenistan",
  MX: "mexico", BR: "brazil", CO: "colombia", AR: "argentina", PE: "peru", CL: "chile",
  EG: "egypt", MA: "morocco", DZ: "algeria", TN: "tunisia", LY: "libya", SD: "sudan",
  SA: "saudi-arabia", AE: "united-arab-emirates", BH: "bahrain", QA: "qatar", KW: "kuwait",
  OM: "oman", JO: "jordan", LB: "lebanon", IQ: "iraq", IL: "israel", PS: "palestine",
  TR: "turkey", YE: "yemen", IR: "iran",
  NG: "nigeria", KE: "kenya", GH: "ghana", ZA: "south-africa", TZ: "tanzania", UG: "uganda",
  RW: "rwanda", ET: "ethiopia", CI: "ivory-coast", SN: "senegal", CM: "cameroon", AO: "angola",
  MZ: "mozambique", ZM: "zambia", ZW: "zimbabwe", BW: "botswana", NA: "namibia", MU: "mauritius",
  MG: "madagascar", BJ: "benin", BF: "burkina-faso", ML: "mali", CD: "congo", GA: "gabon",
  US: "united-states", CA: "canada", GB: "united-kingdom", DE: "germany", FR: "france",
  NL: "netherlands", ES: "spain", PT: "portugal", IT: "italy", SE: "sweden", PL: "poland", IE: "ireland",
  RU: "russia",
};

type CountryMacroSnap = {
  asOf: string;
  gdpYoY?: string;
  gdpUsdBn?: string;
  /** 人均GDP现价美元 */
  gdpPerCapitaUsd?: string;
  /** 人均收入/可支配收入（名义或实际；注明） */
  incomePerCapita?: string;
  inflation?: string;
  policyRate?: string;
  unemployment?: string;
  /** 总人口 */
  population?: string;
  /** 成年人口/年龄结构提示 */
  ageStructure?: string;
  /** 就业率或非正式就业提示 */
  employmentNote?: string;
  /**
   * 第二行大数字：就业人口/总人口（可写「约45%（就业x/人口y）」）
   */
  employedToPop?: string;
  /** 三产结构 */
  sectorMix?: string;
  /** 经常账户（顺逆差/占GDP） */
  currentAccount?: string;
  /** 外汇储备 */
  fxReserves?: string;
  /** 季度汇率走势提示 */
  fxTrend?: string;
  /** 年内汇率波动率（高低点/均价或年化波动；注明口径） */
  fxVolInYear?: string;
  privCreditOrConsumer?: string;
  fxHint?: string;
  debtToGdp?: string;
  /** 居民杠杆：家庭债务/GDP（居民杠杆率） */
  householdDebtToGdp?: string;
  consumerConfidence?: string;
  /** 零售汽油（泵价，优先 USD/升；TE Gasoline Prices） */
  gasolineRetail?: string;
  /** 居民电价（含税，优先 USD/kWh；GlobalPetrolPrices） */
  electricityResidential?: string;
  /** 油电比 = 汽油USD/升 ÷ 电价USD/kWh（1升汽油≈可购居民电kWh数） */
  fuelToPowerRatio?: string;
  /** 新能源整车（优先 BEV CBU）进口关税/附加税合计示意 % */
  nevImportTariff?: string;
  /** 本地出厂/首次销售新能源车增值税（VAT/GST/IVA）一般税率 % */
  nevLocalVat?: string;
  /** 新能源税差（衍生）= 进口关税% − 出厂增值税%（百分点） */
  nevTaxGap?: string;
  creditNote?: string;
  /** 对照宏观阈值的简评（展示于国别卡片） */
  cashLoanVerdict?: string;
};

/**
 * 国别宏观因子框架（总表：指标-口径-含义；预警仅国别卡片）。
 * 适用于各场景信贷资产判断，不限单一产品线。
 * 完整表见总览页 MacroFactorFrameworkOverview / MACRO_FACTOR_GROUPS
 */
const CASH_LOAN_MACRO_FRAMEWORK = {
  purpose: "服务国别准入与各场景信贷资产池判断；宏观定风险中枢，不替代微观风控",
  groups: [
    "经济基本面（GDP/人均GDP/收入/通胀/零售汽油/居民电价/油电比/信心/三产）",
    "人口与就业（总人口、18-45、就业率/非正式/青年失业）",
    "信贷过热（家庭债务/GDP、DTI、信贷缺口、非银增速、NPL、多头）",
    "外汇与跨境（经常账户、外储/短债、汇率波动、政策利率）",
    "基建与监管（征信覆盖、智能机渗透、司法执行、利率上限/牌照、催收与数据法、新能源整车进口关税、本地出厂新能源车增值税、新能源税差）",
  ],
  decisionOrder:
    "①监管与基建，②外汇跨境可行性，③人口/收入/三产/就业，④信贷过热，⑤GDP/通胀/汇率投后压测",
  alerts: {
    gdpPerCapitaLowUsd: 2000,
    gdpPerCapitaMatureUsd: 12000,
    inflationHighPct: 12,
    unemploymentHighPct: 8,
    informalHighPct: 60,
    youthUnempHighPct: 20,
    age18to45LowPct: 35,
    primarySectorHighPct: 30,
    tertiarySectorHighPct: 65,
    householdDebtEmergePct: "45–55",
    dtiHighPct: 80,
    creditGapHighPct: 5,
    multiLoanHighPct: 30,
    fxQoQDeprecPct: 10,
    fxReserveShortDebtCover: 1,
    creditBureauLowPct: 30,
    smartphoneLowPct: 60,
  },
} as const;

/** 已吸收宏观快照（TE 对照；字段对齐 MACRO_FACTOR_GROUPS 五组：基本面/人口就业/信贷过热/外汇跨境/基建监管待续；可续写）。 */
const COUNTRY_MACRO: Partial<Record<Exclude<CountryCode, "all">, CountryMacroSnap>> = {
  CN: {
    asOf: "2026-08对照·TE中国大陆",
    gdpYoY: "4.3%（2026-06）",
    gdpUsdBn: "约19.50万亿美元（2025-12）",
    gdpPerCapitaUsd: "约13793美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约20701美元（2021）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "0.5%（2026-07）",
    policyRate: "3%（2026-07）",
    unemployment: "5%（2026-06）；青年失业约14.9%（2026-06）",
    population: "约14.05亿（2025-12）",
    employedToPop: "7.33/14.09·就业亿人/人口亿人·世行就业人口比61.9%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项19581（2026-06）；制造250473；服务207592·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约3.7%（2025-12）；近季约1843亿美元（2026-03）·TE经常账户（美元·亿）",
    fxReserves: "约34160亿美元（2026-06）",
    fxTrend: "本币对美元约6.75（2026-08·TE货币）",
    householdDebtToGdp: "约58%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±2.5%·年内高低相对均价粗算·Frankfurter USD/CNY·2024–2025",
    privCreditOrConsumer: "私营部门贷款约829046亿元人民币（2026-06）·TE；贷款增长约5.2%（2026-06）",
    fxHint: "约6.75（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约99.2%（2025-12）",
    consumerConfidence: "约89.9（2026-05）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  TW: {
    asOf: "2026-08对照·TE中国台湾",
    gdpYoY: "12.92%（2026-06）",
    gdpUsdBn: "约24亿美元（2026-06）",
    incomePerCapita: "—·官方可支配收入待续采·可用人均GDP对照",
    inflation: "2.6%（2026-06）",
    policyRate: "2%（2026-08）",
    unemployment: "3.33%（2026-06）；青年失业约11.57%（2026-06）",
    population: "约2330万（2025-12）",
    employedToPop: "0.115/0.234·就业亿人/人口亿人·台主计处量级约1150万就业(2024粗)·非世行",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项67569（2026-03）；制造2592463；服务3861164·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约17.4%（2025-12）；近季约62529百万美元（2026-03）",
    fxReserves: "约5943亿美元（2026-07）·TE外汇储备",
    fxTrend: "本币对美元约32.28（2026-08·TE货币）",
    privCreditOrConsumer: "消费信贷约43997739TWD - 百万（2026-05）；私营部门贷款约18748139TWD - 百万（2026-06）",
    fxHint: "约32.28（TE货币·2026-08）",
    consumerConfidence: "约64.58（2026-07）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约94.3%（2024）·家庭债务/GDP·CEIC转述",
    fxVolInYear: "±4.0%·年内高低相对均价粗算·currency-api·USD/TWD周抽样高低/均价·2025–2026",
    gdpPerCapitaUsd: "约36000美元（2025级）·二级〔10〕",
    debtToGdp: "政府债务/GDP约25%–30%（近年）·二级〔10〕",
  },
  HK: {
    asOf: "2026-08对照·TE中国香港",
    gdpYoY: "4.3%（2026-06）；季环比折年约-0.6%（2026-06）；2025全年约3.5%",
    gdpUsdBn: "约4270亿美元（2025-12）",
    gdpPerCapitaUsd: "约46450美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约68725美元（2025-12）·TE GDP/人PPP·非住户可支配收入",
    inflation: "2%（2026-06）",
    policyRate: "4%（2026-07）·HKMA基本利率·联系汇率随美利率",
    unemployment: "3.7%（2026-06）；青年失业约7.5%（2026-06）",
    population: "约751万（2025-12）",
    employedToPop: "0.036/0.075·就业亿人/人口亿人·就业约364.6万(2026-06)·劳动参与率约56.2%",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项265（2026-03）；制造7114；服务766168·港元百万·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约12.2%（2025-12）；近季约36443港元 - 百万（2026-03）",
    fxReserves: "约4478亿美元（2026-07）",
    fxTrend: "本币对美元约7.85（2026-08·TE货币）·联系汇率7.75–7.85兑换保证",
    householdDebtToGdp: "约87.8%（2025-12）·家庭债务/GDP·TE Households Debt to GDP",
    fxVolInYear: "±0.5%内·联系汇率窄幅·年内高低相对均价粗算·USD/HKD·2025",
    privCreditOrConsumer: "私营部门贷款约10646152港元 - 百万（2026-05）；银行资产负债表量级约33140032港元 - 百万（2026-06）",
    fxHint: "约7.85（TE货币·2026-08·联系汇率）",
    debtToGdp: "政府债务/GDP约11.9%（2025-12）",
    consumerConfidence: "约88.9（2026-03）",
    creditNote: "信贷过热组：家庭债务水位偏高（近88%GDP）；MSO/SVF/银行牌照与HKMA/SFC监管续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值；家庭杠杆偏高、联系汇率随美利率。准入先过金钱服务经营者/银行牌照与利率上限评估（对照总表预警）。",
  },
  JP: {
    asOf: "2026-08对照·TE日本",
    gdpYoY: "0.6%（2026-03）",
    gdpUsdBn: "约4.43万亿美元（2025-12）",
    gdpPerCapitaUsd: "约38619美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约50060美元（2024）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "1.7%（2026-06）",
    policyRate: "1%（2026-07）",
    unemployment: "2.5%（2026-06）；青年失业约4.2%（2026-06）",
    population: "约1.23亿（2025-12）",
    employedToPop: "0.678/1.24·就业亿人/人口亿人·世行就业人口比61.7%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项5900（2024-12）；制造110990；服务24488·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约4.7%（2025-12）；近季约3968日元 - 十亿（2026-05）",
    fxReserves: "约12875亿美元（2026-06）",
    fxTrend: "本币对美元约158（2026-08·TE货币）",
    householdDebtToGdp: "约61.1%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±6%·年内高低相对均价粗算·Frankfurter USD/JPY·2024–2025",
    privCreditOrConsumer: "消费信贷约62267日元 - 十亿（2026-03）；私营部门贷款约596463日元 - 十亿（2026-06）",
    fxHint: "约158（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约249%（2025-12）",
    consumerConfidence: "约34.9（2026-07）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  KR: {
    asOf: "2026-08对照·TE韩国",
    gdpYoY: "3.7%（2026-06）",
    gdpUsdBn: "约1.87万亿美元（2025-12）",
    gdpPerCapitaUsd: "约37470美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约56424美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "2.8%（2026-07）",
    policyRate: "2.75%（2026-07）",
    unemployment: "2.7%（2026-06）；青年失业约7%（2026-06）",
    population: "约5168万（2025-12）",
    employedToPop: "0.29/0.518·就业亿人/人口亿人·世行就业人口比62.7%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项8116（2026-06）；制造167899；服务346974·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约6.6%（2025-12）；近季约49730百万美元（2026-06）",
    fxReserves: "约4279亿美元（2026-07）",
    fxTrend: "本币对美元约1420（2026-08·TE货币）",
    householdDebtToGdp: "约88.6%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±4.5%·年内高低相对均价粗算·Frankfurter USD/KRW·2024–2025",
    privCreditOrConsumer: "消费信贷约1993111KRW - 亿（2026-03）；私营部门贷款约1487408KRW - 亿（2026-05）",
    fxHint: "约1420（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约49%（2025-12）",
    consumerConfidence: "约107（2026-07）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  MN: {
    asOf: "2026-08对照·TE外蒙古",
    gdpYoY: "7.9%（2026-03）",
    gdpUsdBn: "约254亿美元（2025-12）",
    gdpPerCapitaUsd: "约4882美元（2025-12）",
    incomePerCapita: "约17969美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "12%（2026-06）·破12%阈值",
    policyRate: "12%（2026-06）",
    unemployment: "5.7%（2026-03）",
    population: "约359万（2025-12）",
    employedToPop: "0.014/0.035·就业亿人/人口亿人·世行就业人口比57.2%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项261822（2026-03）；制造339138；服务2218696·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-8.6%（2025-12）；近季约-358百万美元（2026-05）",
    fxReserves: "约76.6亿美元（2026-06）",
    fxTrend: "本币对美元约3597（2026-08·TE货币）",
    fxHint: "约3597（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约42%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "通胀破12%。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约28.9%（2025-12）·家庭债务/GDP·CEIC转述",
    fxVolInYear: "±6.0%·年内高低相对均价粗算·USD/MNT·currency-api抽样校正·2025–2026",
    privCreditOrConsumer: "国内私营信贷约45% GDP（近年）·二级〔10〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  ID: {
    asOf: "2026-08对照·TE印尼+OJK/R&M信源包",
    gdpYoY: "5.29%（2026-06）",
    gdpUsdBn: "约1.45万亿美元（2025-12）",
    gdpPerCapitaUsd: "约4555美元（2025-12）",
    incomePerCapita: "约14434美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "2.88%（2026-07）",
    policyRate: "5.75%（2026-07）",
    unemployment: "4.68%（2026-03）",
    population: "约2.84亿（2025-12）",
    employedToPop: "1.4/2.83·就业亿人/人口亿人·世行就业人口比65.7%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项42600（2026-06）；制造707500；服务537100·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-0.1%（2025-12）；近季约-4008百万美元（2026-03）",
    fxReserves: "约1456亿美元（2026-06）",
    fxTrend: "本币对美元约17916（2026-08·TE货币）",
    fxVolInYear: "±2.6%·年内高低相对均价粗算·Frankfurter USD/IDR·2024–2025",
    privCreditOrConsumer: "消费信贷约3609170IDR - 10亿（2026-05）；私营部门贷款约7591084IDR - 10亿（2026-05）",
    fxHint: "约17916（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约41%（2025-12）",
    householdDebtToGdp: "约15.5%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    consumerConfidence: "约118（2026-06）",
    creditNote: "OJK口径（媒体转述〔11〕〔12〕〔4〕）：P2P outstanding 2025-04约Rp80.94T（+29%YoY，TWP90约2.93%）；2026-01约Rp98.54T（+25.5%YoY，TWP90约4.38%）。融资公司BNPL 2025-04约Rp8.24T（+47%YoY，NPF gross约3.78%）→2026-01约Rp12.18T（+71%YoY）；银行BNPL 2026-01约Rp27.1T（+20%YoY）。第三方BNPL（R&M媒体摘要）2025约US$8.59B，与OJK余额分轨〔7〕〔4〕。监管：POJK 40/2024（P2P/LPBBTI）〔4〕；POJK 32/2025（BNPL仅银行+融资公司，融资公司须事先批准）〔4〕。",
    cashLoanVerdict: "印尼现金贷/BNPL：先核POJK 40/2024（P2P）或POJK 32/2025（BNPL主体资格），再用OJK余额读行业水位；勿用第三方美元GMV替代监管余额。",
  },
  VN: {
    asOf: "2026-08对照·TE越南",
    gdpYoY: "8.39%（2026-06）",
    gdpUsdBn: "约5150亿美元（2025-12）",
    gdpPerCapitaUsd: "约4308美元（2025-12）",
    incomePerCapita: "约15189美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "4.45%（2026-07）",
    policyRate: "4.5%（2026-07）",
    unemployment: "2.23%（2026-06）；青年失业约8.67%（2026-06）",
    population: "约1.02亿（2025-12）",
    employedToPop: "0.558/1.01·就业亿人/人口亿人·世行就业人口比72.0%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项297671（2026-06）；制造722523；服务1246493·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约6.4%（2025-12）；近季约2716百万美元（2026-03）",
    fxReserves: "约831亿美元（2026-05）",
    fxTrend: "本币对美元约26228（2026-08·TE货币）",
    fxHint: "约26228（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约33.6%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约24.9%（2024）·家庭债务/GDP·IIF Global Debt Monitor",
    fxVolInYear: "±0.9%·年内高低相对均价粗算·currency-api·USD/VND周抽样高低/均价·2025–2026",
    privCreditOrConsumer: "国内私营信贷约125% GDP（近年）·二级〔10〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  MY: {
    asOf: "2026-08对照·TE马来西亚",
    gdpYoY: "5.8%（2026-06）",
    gdpUsdBn: "约4720亿美元（2025-12）",
    gdpPerCapitaUsd: "约12352美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约34062美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "1.9%（2026-06）",
    policyRate: "2.75%（2026-07）",
    unemployment: "3%（2026-05）",
    population: "约3420万（2025-12）",
    employedToPop: "0.177/0.356·就业亿人/人口亿人·世行就业人口比63.6%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项24957（2026-06）；制造104179；服务264819·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约1.5%（2025-12）；近季约15157MYR - 百万（2026-03）",
    fxReserves: "约1326亿美元（2026-06）",
    fxTrend: "本币对美元约4.09（2026-08·TE货币）",
    householdDebtToGdp: "约69.8%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±5.4%·年内高低相对均价粗算·Frankfurter USD/MYR·2024–2025",
    privCreditOrConsumer: "私营部门贷款约2643676MYR - 百万（2026-06）",
    fxHint: "约4.09（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约65.3%（2025-12）",
    consumerConfidence: "约135（2026-03）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  TH: {
    asOf: "2026-08对照·TE泰国",
    gdpYoY: "2.8%（2026-03）",
    gdpUsdBn: "约5770亿美元（2025-12）",
    gdpPerCapitaUsd: "约6783美元（2025-12）",
    incomePerCapita: "约19572美元（2021）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "1.95%（2026-07）",
    policyRate: "1%（2026-06）",
    unemployment: "0.94%（2026-03）；青年失业约4.6%（2026-03）",
    population: "约6581万（2025-12）",
    employedToPop: "0.407/0.717·就业亿人/人口亿人·世行就业人口比66.6%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项186365（2026-03）；制造713282·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约2.8%（2025-12）；近季约-3474百万美元（2026-06）",
    fxReserves: "约2792亿美元（2026-06）",
    fxTrend: "本币对美元约33.06（2026-08·TE货币）",
    householdDebtToGdp: "约87.5%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±5.7%·年内高低相对均价粗算·Frankfurter USD/THB·2024–2025",
    privCreditOrConsumer: "消费信贷约5285734泰铢 - 百万（2025-06）；私营部门贷款约10553097泰铢 - 百万（2026-06）",
    fxHint: "约33.06（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约65.64%（2025-12）",
    consumerConfidence: "约50.7（2026-06）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  PH: {
    asOf: "2026-08对照·TE菲律宾+BSP/SEC/R&M信源包",
    gdpYoY: "2.8%（2026-03）",
    gdpUsdBn: "约4870亿美元（2025-12）",
    gdpPerCapitaUsd: "约4066美元（2025-12）",
    incomePerCapita: "约12312美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "6.2%（2026-07）",
    policyRate: "4.75%（2026-06）",
    unemployment: "4.9%（2026-06）",
    population: "约1.14亿（2025-12）",
    employedToPop: "0.502/1.16·就业亿人/人口亿人·世行就业人口比60.0%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项455741（2026-03）；制造1084678；服务3554330·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-3.3%（2025-12）；近季约-2691百万美元（2026-03）",
    fxReserves: "约1048亿美元（2026-06）",
    fxTrend: "本币对美元约60.67（2026-08·TE货币）",
    fxVolInYear: "±3.5%·年内高低相对均价粗算·Frankfurter USD/PHP·2024–2025",
    privCreditOrConsumer: "消费信贷约1229PHP - 10亿（2026-03）；私营部门贷款约12670379PHP - 百万（2026-05）",
    fxHint: "约60.67（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约63.2%（2025-12）",
    householdDebtToGdp: "约13.6%（2025-12）·家庭债务/GDP·CEIC转述",
    consumerConfidence: "约-42（2026-06）",
    creditNote: "第三方BNPL（PRNewswire/R&M 2024-02）：2024约US$2.29B，2029约US$3.87B（CAGR约11%）〔7〕。BSP 2024数字支付：零售笔数数字化57.4%、金额59.0%（超PDP目标52–54%）〔5〕。线上放贷：SEC 2023-02协同下架33未注册OLP〔6〕；BSP Circular 1133+SEC MC3〔5〕〔6〕 — ≤₱1万且≤4个月无担保贷名义≤6%/月、EIR≤15%/月、逾期≤5%/月、总成本≤本金100%。",
    cashLoanVerdict: "菲律宾：先核SEC Lending/Financing+OLP登记与BSP 1133定价带，再用BSP数字支付读场景渗透；第三方BNPL规模仅作量级。",
  },
  SG: {
    asOf: "2026-08对照·TE新加坡",
    householdDebtToGdp: "约44%（2025-Q4）·家庭债务/GDP·BIS/TE Households Debt to GDP",
    fxVolInYear: "±4.2%·年内高低相对均价粗算·Frankfurter SGD·2025-07..2026-08",
    cashLoanVerdict: "人均高、牌照严、经常账户顺差厚。准入先过MAS非银信贷/银行合作路径；政府债务/GDP口径特殊勿误读。",
    gdpYoY: "5.7%（2026-06）",
    gdpUsdBn: "约6040亿美元（2025-12）",
    gdpPerCapitaUsd: "约70684美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约139593美元（2025-12）·人均GDP(PPP)·TE·非住户可支配收入",
    inflation: "1.9%（2026-06）",
    policyRate: "1.05%（2026-08）·SORA/政策利率口径·TE",
    unemployment: "2%（2026-06）",
    population: "约611万（2025-12）",
    employedToPop: "0.041/0.061·就业亿人/人口亿人·TE就业约411.7万(2025-12)/人口611万",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；劳动力参与率约67.9%（2025-12）",
    sectorMix: "制造约34064；服务约100143（2026-06·SGDmn不变价分项）·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约16.7%（2025-12）；近季约41094SGD - 百万（2026-03）",
    fxReserves: "约5493亿SGD（2026-07）·TE外汇储备",
    fxTrend: "本币对美元约1.28（2026-08·TE货币）",
    fxHint: "约1.28（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约171%（2025-12）·含MAS特殊结构·不宜简单对照新兴市场阈值",
    privCreditOrConsumer: "私人部门信贷约742123SGD - 百万（2026-06）",
    consumerConfidence: "约54.1（2026-07）",
    creditNote: "信贷过热组：家庭债务约44%GDP；非银增速/NPL/多头以MAS与征信续核；此处为TE可核验水位。",
  },
  IN: {
    asOf: "2026-08对照·TE印度",
    gdpYoY: "7.8%（2026-03）",
    gdpUsdBn: "约3.96万亿美元（2025-12）",
    gdpPerCapitaUsd: "约2523美元（2025-12）",
    incomePerCapita: "约9910美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "4.38%（2026-06）",
    policyRate: "5.25%（2026-08）",
    unemployment: "5.5%（2026-06）",
    population: "约14.21亿（2025-12）",
    employedToPop: "5.83/14.51·就业亿人/人口亿人·世行就业人口比53.3%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项14832（2026-03）；制造13529·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-0.6%（2025-12）；近季约7081百万美元（2026-03）",
    fxReserves: "约6824亿美元（2026-07）",
    fxTrend: "本币对美元约95.16（2026-08·TE货币）",
    fxVolInYear: "±3.8%·年内高低相对均价粗算·Frankfurter USD/INR·2024–2025",
    privCreditOrConsumer: "消费信贷约5600000INR - 亿（家庭/零售信贷粗算·BIS杠杆×GDP量级待RBI复核）；私营部门贷款约16800000INR - 亿（私营信贷粗算·世行%GDP反推待核）；贷款增长约17.7%（2026-07）",
    fxHint: "约95.16（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约81.92%（2024-12）",
    householdDebtToGdp: "约47.8%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    consumerConfidence: "约88.3（2026-07）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  BD: {
    asOf: "2026-08对照·TE孟加拉",
    gdpYoY: "3.49%（2025-06）",
    gdpUsdBn: "约4560亿美元（2025-12）",
    gdpPerCapitaUsd: "约1985美元（2025-12）·低于2000美元阈值",
    incomePerCapita: "约9153美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "9.16%（2026-06）",
    policyRate: "9.5%（2026-07）",
    unemployment: "3.8%（2025-12）",
    population: "约1.81亿（2025-12）",
    employedToPop: "0.709/1.74·就业亿人/人口亿人·世行就业人口比56.8%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项3686（2025-06）；制造8422；服务17401·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约0%（2025-12）；近季约737十亿 - BDT（2026-03）",
    fxReserves: "约376亿美元（2026-06）",
    fxTrend: "本币对美元约124（2026-08·TE货币）",
    privCreditOrConsumer: "消费信贷约24550BDT - 10亿（2026-05）；私营部门贷款约17499BDT - 10亿（2026-05）",
    fxHint: "约124（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约32.2%（2024-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约6.2%（2024）·家庭债务/GDP·IMF FAS商业银行对家庭贷款/GDP",
    fxVolInYear: "±1.0%·年内高低相对均价粗算·currency-api·USD/BDT周抽样高低/均价·2025–2026",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  PK: {
    asOf: "2026-08对照·TE巴基斯坦",
    gdpYoY: "4%（2026-03）",
    gdpUsdBn: "约4070亿美元（2025-12）",
    gdpPerCapitaUsd: "约1669美元（2025-12）·低于2000美元阈值",
    incomePerCapita: "约5692美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "9.2%（2026-07）",
    policyRate: "11.5%（2026-07）",
    unemployment: "5.4%（2025-12）",
    population: "约2.55亿（2025-12）",
    employedToPop: "0.786/2.51·就业亿人/人口亿人·世行就业人口比49.4%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项2471566（2026-03）；制造1378853；服务6307500·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约0.5%（2025-06）；近季约-425百万美元（2026-06）",
    fxReserves: "约224亿美元（2026-07）",
    fxTrend: "本币对美元约277（2026-08·TE货币）",
    privCreditOrConsumer: "消费信贷约1547944PKR - 百万（2026-06）；私营部门贷款约9600037PKR - 百万（2026-06）",
    fxHint: "约277（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约83%（2025-12）",
    consumerConfidence: "约36.1（2026-06）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约2.1%（2024）·家庭债务/GDP·IMF FAS商业银行对家庭贷款/GDP",
    fxVolInYear: "±1.2%·年内高低相对均价粗算·currency-api·USD/PKR周抽样高低/均价·2025–2026",
  },
  LK: {
    asOf: "2026-08对照·TE斯里兰卡",
    gdpYoY: "5.1%（2026-03）",
    gdpUsdBn: "约1090亿美元（2025-12）",
    gdpPerCapitaUsd: "约4439美元（2025-12）",
    incomePerCapita: "约14291美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "7.3%（2026-07）",
    policyRate: "8.75%（2026-07）",
    unemployment: "3.7%（2026-03）；青年失业约18.7%（2025-12）",
    population: "约2203万（2025-12）",
    employedToPop: "0.08/0.219·就业亿人/人口亿人·世行就业人口比46.5%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项232115（2026-03）；制造1049104；服务2105235·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约1.6%（2025-12）；近季约623百万美元（2026-03）",
    fxReserves: "约64.6亿美元（2026-06）",
    fxTrend: "本币对美元约335（2026-08·TE货币）",
    privCreditOrConsumer: "私人部门信贷约11791113LKR - 百万（2026-06）",
    fxHint: "约335（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约91.6%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约6.6%（2024-12）·家庭债务/GDP·CEIC转述",
    fxVolInYear: "±5.8%·年内高低相对均价粗算·currency-api·USD/LKR周抽样高低/均价·2025–2026",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  KZ: {
    asOf: "2026-08对照·TE哈萨克斯坦",
    gdpYoY: "3%（2026-03）",
    gdpUsdBn: "约3060亿美元（2025-12）",
    gdpPerCapitaUsd: "约12492美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约34286美元（2024）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "10.2%（2026-07）",
    policyRate: "16.75%（2026-07）",
    unemployment: "4.5%（2026-03）；青年失业约3%（2026-03）",
    population: "约2050万（2025-12）",
    employedToPop: "0.098/0.206·就业亿人/人口亿人·世行就业人口比67.2%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项690436（2026-03）；制造5193494；服务19938928·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约4.1%（2025-12）；近季约-1791百万美元（2026-03）",
    fxReserves: "约622亿美元（2026-06）",
    fxTrend: "本币对美元约471（2026-08·TE货币）",
    privCreditOrConsumer: "消费信贷约25846428腾格 - 百万（2026-06）",
    fxHint: "约471（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约24.6%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值；高政策利率。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    fxVolInYear: "±8.4%·年内高低相对均价粗算·currency-api·USD/KZT周抽样高低/均价·2025–2026",
    householdDebtToGdp: "约67.2%（2026-Q1）·家庭债务/GDP·CEIC转述",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  UZ: {
    asOf: "2026-08对照·TE乌兹别克斯坦",
    gdpYoY: "8.7%（2026-03）",
    gdpUsdBn: "约1470亿美元（2025-12）",
    gdpPerCapitaUsd: "约4733美元（2025-12）",
    incomePerCapita: "约9748美元（2021）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "6.4%（2026-07）",
    policyRate: "14%（2026-07）",
    unemployment: "4.5%（2024-12）",
    population: "约3754万（2025-12）",
    employedToPop: "0.138/0.364·就业亿人/人口亿人·世行就业人口比55.1%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项306294（2025-12）；制造472730；服务215494·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-3.9%（2025-12）；近季约-5793百万美元（2026-03）",
    fxReserves: "约638亿美元（2026-06）",
    fxTrend: "本币对美元约11870（2026-08·TE货币）",
    fxHint: "约11870（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约35%（2024-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    fxVolInYear: "±3.2%·年内高低相对均价粗算·currency-api·USD/UZS周抽样高低/均价·2025–2026",
    householdDebtToGdp: "约12.2%（2024）·家庭债务/GDP·央行个人贷款/GDP·Kun.uz转述",
    privCreditOrConsumer: "国内私营信贷约40% GDP（近年）·二级〔10〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  KG: {
    asOf: "2026-08对照·TE吉尔吉斯斯坦",
    gdpYoY: "10.1%（2026-03）",
    gdpUsdBn: "约226亿美元（2025-12）",
    gdpPerCapitaUsd: "约1555美元（2025-12）·低于2000美元阈值",
    incomePerCapita: "约8966美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "11%（2026-06）",
    policyRate: "12%（2026-07）",
    unemployment: "1.4%（2026-04）",
    population: "约740万（2025-12）",
    employedToPop: "0.027/0.072·就业亿人/人口亿人·世行就业人口比55.5%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    currentAccount: "CA/GDP约-18.8%（2025-12）；近季约-1470百万美元（2026-03）",
    fxReserves: "约79.2亿美元（2026-06）",
    fxTrend: "本币对美元约87.45（2026-08·TE货币）",
    fxHint: "约87.45（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约26%（2025-12）",
    consumerConfidence: "约46.2（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约12.6%（2026-Q2）·家庭债务/GDP·CEIC转述",
    privCreditOrConsumer: "国内私营信贷约25% GDP（近年）·二级〔10〕",
    fxVolInYear: "±8.0%·年内高低相对均价粗算·USD/KGS·公开汇价抽样校正·2025–2026",
    sectorMix: "三产分项待官方/TE续拆·对照总表三产阈值〔1〕·2026-08补录",
  },
  TJ: {
    asOf: "2026-08对照·TE塔吉克斯坦",
    gdpYoY: "8%（2026-03）",
    gdpUsdBn: "约177亿美元（2025-12）",
    gdpPerCapitaUsd: "约1593美元（2025-12）·低于2000美元阈值",
    incomePerCapita: "约10615美元（2024）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "4.1%（2026-06）",
    policyRate: "7%（2026-06）",
    unemployment: "6.9%（2025-12）",
    population: "约1072万（2025-12）",
    employedToPop: "0.024/0.106·就业亿人/人口亿人·世行就业人口比35.6%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项38820（2025-12）；制造28632；服务33619·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约6.2%（2024-12）；近季约820189千美元（2026-03）",
    fxTrend: "本币对美元约9.22（2026-08·TE货币）",
    fxHint: "约9.22（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约28.4%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约8%（2024）·家庭债务/GDP·无BIS/TE标准序列·银行个人信贷粗算",
    privCreditOrConsumer: "国内私营信贷约15% GDP（近年）·二级〔10〕",
    fxVolInYear: "±2.3%·年内高低相对均价粗算·currency-api·USD/TJS周抽样高低/均价·2025–2026",
    fxReserves: "约38.1亿美元（2025）·IMF/FRED央行总储备〔1〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  TM: {
    asOf: "2026-08对照·TE土库曼斯坦",
    gdpYoY: "6.3%（2025-12）",
    gdpUsdBn: "约498亿美元（2025-12）",
    gdpPerCapitaUsd: "约8605美元（2025-12）",
    incomePerCapita: "约15904美元（2021）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "5.5%（2025-12）",
    unemployment: "4.3%（2024-12）",
    population: "约762万（2025-12）",
    employedToPop: "0.021/0.075·就业亿人/人口亿人·世行就业人口比40.5%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    currentAccount: "CA/GDP约2.3%（2025-12）；近季约2.59百万美元（2024-12）",
    fxTrend: "本币对美元约3.5（2026-08·TE货币）",
    fxHint: "约3.5（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约4.6%（2024-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约3%（2023）·家庭债务/GDP·官方数据不透明·银行个人信贷粗算",
    policyRate: "—·马纳特强管理汇率/利率不透明〔1〕",
    fxVolInYear: "±3%内·官方马纳特管理低波·汇率不透明",
    privCreditOrConsumer: "正规零售信贷深度低·二级〔10〕",
    fxReserves: "外储与汇率不透明·官方马纳特管理·勿假装有官方外储数字〔1〕",
    sectorMix: "油气主导·三产占比待官方续拆〔1〕·2026-08补录",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  MX: {
    asOf: "2026-08对照·TE墨西哥",
    gdpYoY: "2.2%（2026-06）",
    gdpUsdBn: "约1.83万亿美元（2025-12）",
    gdpPerCapitaUsd: "约10257美元（2025-12）",
    incomePerCapita: "约22157美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "3.37%（2026-06）",
    policyRate: "6.5%（2026-06）",
    unemployment: "2.9%（2026-06）",
    population: "约1.32亿（2025-12）",
    employedToPop: "0.593/1.31·就业亿人/人口亿人·世行就业人口比60.0%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项797676（2026-03）；制造5073454；服务15134330·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-0.4%（2025-12）；近季约-15878百万美元（2026-03）",
    fxReserves: "约2555亿美元（2026-07）",
    fxTrend: "本币对美元约17.25（2026-08·TE货币）",
    fxVolInYear: "±8%·年内高低相对均价粗算·Frankfurter USD/MXN·2024–2025",
    privCreditOrConsumer: "消费信贷约2389228MXN - 百万（2026-03）；私营部门贷款约3969419049MXN千（2026-06）",
    fxHint: "约17.25（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约45.4%（2025-12）",
    householdDebtToGdp: "约17.4%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    consumerConfidence: "约45（2026-07）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  BR: {
    asOf: "2026-08对照·TE巴西",
    gdpYoY: "1.8%（2026-03）",
    gdpUsdBn: "约2.28万亿美元（2025-12）",
    gdpPerCapitaUsd: "约9748美元（2025-12）",
    incomePerCapita: "约19212美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "4.64%（2026-06）",
    policyRate: "14%（2026-08）",
    unemployment: "5.4%（2026-06）",
    population: "约2.13亿（2025-12）",
    employedToPop: "1.01/2.12·就业亿人/人口亿人·世行就业人口比59.0%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项33593（2026-03）；制造28145；服务206101·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-3.02%（2025-12）；近季约-2330百万美元（2026-06）",
    fxReserves: "约3689亿美元（2026-07）",
    fxTrend: "本币对美元约5.14（2026-08·TE货币）",
    householdDebtToGdp: "约37.6%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±8.5%·年内高低相对均价粗算·Frankfurter USD/BRL·2024–2025",
    privCreditOrConsumer: "消费信贷约4606800BRL - 百万（2026-06）；私营部门贷款约1114054BRL - 百万（2026-05）",
    fxHint: "约5.14（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约78.64%（2025-12）",
    consumerConfidence: "约88.3（2026-07）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  CO: {
    asOf: "2026-08对照·TE哥伦比亚",
    gdpYoY: "2.2%（2026-03）",
    gdpUsdBn: "约4570亿美元（2025-12）",
    gdpPerCapitaUsd: "约6976美元（2025-12）",
    incomePerCapita: "约19071美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "6.14%（2026-06）",
    policyRate: "12%（2026-07）",
    unemployment: "8%（2026-06）",
    population: "约5306万（2025-12）",
    employedToPop: "0.242/0.529·就业亿人/人口亿人·世行就业人口比57.4%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项15163（2026-03）；制造27613·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-2.4%（2025-12）；近季约-1573百万美元（2026-03）",
    fxReserves: "约670亿美元（2026-06）",
    fxTrend: "本币对美元约3183（2026-08·TE货币）",
    householdDebtToGdp: "约25.5%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    privCreditOrConsumer: "消费信贷约22354410亿COP -（2026-05）；私人部门信贷约470665COP - 百万（2026-06）",
    fxHint: "约3183（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约59.9%（2025-12）",
    consumerConfidence: "约24.3（2026-06）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    fxVolInYear: "±11.2%·年内高低相对均价粗算·currency-api·USD/COP周抽样高低/均价·2025–2026",
  },
  AR: {
    asOf: "2026-08对照·TE阿根廷",
    gdpYoY: "2.3%（2026-03）",
    gdpUsdBn: "约6830亿美元（2025-12）",
    gdpPerCapitaUsd: "约13287美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约27594美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "33.5%（2026-06）·破12%阈值",
    policyRate: "29%（2026-07）",
    unemployment: "7.8%（2026-03）",
    population: "约4639万（2025-12）",
    employedToPop: "0.206/0.457·就业亿人/人口亿人·世行就业人口比57.4%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项21953（2026-03）；制造92415；服务85391·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约1.2%（2025-12）；近季约-1651百万美元（2026-03）",
    fxReserves: "约367亿美元（2026-06）",
    fxTrend: "本币对美元约1496（2026-08·TE货币）",
    householdDebtToGdp: "约5.7%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxHint: "约1496（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约78.4%（2025-12）",
    consumerConfidence: "约40.67（2026-07）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值；通胀破12%；高政策利率。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    fxVolInYear: "±6.0%·年内高低相对均价粗算·currency-api·USD/ARS周抽样高低/均价·2025–2026",
    privCreditOrConsumer: "国内私营信贷约14% GDP（近年）·二级〔10〕",
  },
  PE: {
    asOf: "2026-08对照·TE秘鲁",
    gdpYoY: "3.5%（2026-03）",
    gdpUsdBn: "约3350亿美元（2025-12）",
    gdpPerCapitaUsd: "约6891美元（2025-12）",
    incomePerCapita: "约15938美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "4.07%（2026-07）",
    policyRate: "4.25%（2026-07）",
    unemployment: "4.9%（2026-06）",
    population: "约3458万（2025-12）",
    employedToPop: "0.18/0.342·就业亿人/人口亿人·世行就业人口比69.0%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项7935（2026-03）；制造16648；服务14719·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约3%（2025-12）；近季约4463百万美元（2026-03）",
    fxReserves: "约970亿美元（2026-07）",
    fxTrend: "本币对美元约3.38（2026-08·TE货币）",
    privCreditOrConsumer: "消费信贷约114292PEN - 百万（2026-06）；私营部门贷款约263616PEN - 百万（2026-06）",
    fxHint: "约3.38（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约30.2%（2025-12）",
    consumerConfidence: "约48.1（2026-06）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    fxVolInYear: "±2.9%·年内高低相对均价粗算·currency-api·USD/PEN周抽样高低/均价·2025–2026",
    householdDebtToGdp: "约14.8%（2026-Q1）·家庭债务/GDP·CEIC转述",
  },
  CL: {
    asOf: "2026-08对照·TE智利",
    gdpYoY: "-0.5%（2026-03）",
    gdpUsdBn: "约3570亿美元（2025-12）",
    gdpPerCapitaUsd: "约14905美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约29817美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "4.3%（2026-06）",
    policyRate: "4.5%（2026-07）",
    unemployment: "9.4%（2026-06）",
    population: "约2020万（2025-12）",
    employedToPop: "0.093/0.198·就业亿人/人口亿人·世行就业人口比56.9%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项2629（2026-03）；制造4953；服务5151·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-1.2%（2025-12）；近季约1883百万美元（2026-03）",
    fxReserves: "约519亿美元（2026-06）",
    fxTrend: "本币对美元约914（2026-08·TE货币）",
    householdDebtToGdp: "约43.8%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    privCreditOrConsumer: "消费信贷约32858CLP - 10亿（2026-05）；私营部门贷款约147635CLP - 10亿（2026-05）",
    fxHint: "约914（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约41.5%（2025-12）",
    consumerConfidence: "约30.7（2026-07）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    fxVolInYear: "±6.1%·年内高低相对均价粗算·currency-api·USD/CLP周抽样高低/均价·2025–2026",
  },
  EG: {
    asOf: "2026-08对照·TE埃及",
    gdpYoY: "5%（2026-03）",
    gdpUsdBn: "约3650亿美元（2025-12）",
    gdpPerCapitaUsd: "约4253美元（2025-12）",
    incomePerCapita: "约15877美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "14.3%（2026-06）·破12%阈值",
    policyRate: "19%（2026-07）",
    unemployment: "6%（2026-03）",
    population: "约1.08亿（2025-12）",
    employedToPop: "0.329/1.17·就业亿人/人口亿人·世行就业人口比41.6%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项835939（2026-03）；制造860710·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-4.2%（2025-12）；近季约-5117百万美元（2026-03）",
    fxReserves: "约563亿美元（2026-07）",
    fxTrend: "本币对美元约49.82（2026-08·TE货币）",
    privCreditOrConsumer: "消费信贷约1600146EGP - 百万（2026-06）；私营部门贷款约3661837EGP - 百万（2026-06）",
    fxHint: "约49.82（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约83.8%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "通胀破12%；高政策利率。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约7.2%（2025-12）·家庭债务/GDP·CEIC转述",
    fxVolInYear: "±7.7%·年内高低相对均价粗算·currency-api·USD/EGP周抽样高低/均价·2025–2026",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  MA: {
    asOf: "2026-08对照·TE摩洛哥",
    gdpYoY: "4.6%（2026-03）",
    gdpUsdBn: "约1820亿美元（2025-12）",
    gdpPerCapitaUsd: "约3644美元（2025-12）",
    incomePerCapita: "约9727美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "0.3%（2026-06）",
    policyRate: "2.25%（2026-08）",
    unemployment: "9.5%（2026-06）；青年失业约22.9%（2026-06）·破20%阈值",
    population: "约3771万（2025-12）",
    employedToPop: "0.114/0.381·就业亿人/人口亿人·世行就业人口比40.1%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项33406（2026-03）；制造45476；服务196440·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-2.3%（2025-12）；近季约-5028MAD - 百万（2026-03）",
    fxReserves: "约4968亿MAD（2026-07）·TE外汇储备（MAD百万）·约合500亿美元级",
    fxTrend: "本币对美元约9.31（2026-08·TE货币）",
    fxHint: "约9.31（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约67.1%（2025-12）",
    consumerConfidence: "约60.1（2026-06）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    fxVolInYear: "±2.2%·年内高低相对均价粗算·currency-api·USD/MAD周抽样高低/均价·2025–2026",
    householdDebtToGdp: "约21.2%（2025）·家庭债务/GDP·CEIC转述",
    privCreditOrConsumer: "国内私营信贷约65% GDP（近年）·二级〔10〕",
  },
  DZ: {
    asOf: "2026-08对照·TE阿尔及利亚",
    gdpYoY: "3.9%（2025-06）",
    gdpUsdBn: "约2870亿美元（2025-12）",
    gdpPerCapitaUsd: "约4883美元（2025-12）",
    incomePerCapita: "约15908美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "8.36%（2026-05）",
    policyRate: "2.5%（2026-07）",
    unemployment: "11.63%（2025-12）",
    population: "约4744万（2025-12）",
    employedToPop: "0.119/0.468·就业亿人/人口亿人·世行就业人口比36.4%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项1418472（2025-06）；制造994423；服务4092916·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-7.7%（2025-12）；近季约-2.38十亿美元（2024-12）",
    fxTrend: "本币对美元约133（2026-08·TE货币）",
    fxHint: "约133（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约54.1%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    fxVolInYear: "±1.9%·年内高低相对均价粗算·currency-api·USD/DZD周抽样高低/均价·2025–2026",
    householdDebtToGdp: "约8%（2024）·家庭债务/GDP·无BIS/TE标准序列·银行个人信贷粗算",
    privCreditOrConsumer: "国内私营信贷约18.5% GDP（近年）·二级〔10〕",
    fxReserves: "约645.7亿美元（2024-Q1）·TE外汇储备·阿尔及利亚央行〔1〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  TN: {
    asOf: "2026-08对照·TE突尼斯",
    gdpYoY: "2.6%（2026-03）",
    gdpUsdBn: "约575亿美元（2025-12）",
    gdpPerCapitaUsd: "约4082美元（2025-12）",
    incomePerCapita: "约13250美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "5.1%（2026-07）",
    policyRate: "7%（2026-07）",
    unemployment: "15%（2026-03）",
    population: "约1197万（2024-12）",
    employedToPop: "0.036/0.123·就业亿人/人口亿人·世行就业人口比38.5%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项2333（2026-03）·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-2.5%（2025-12）；近季约-1834TND - 百万（2026-03）",
    fxReserves: "27354129 TND千（2026-06）",
    fxTrend: "本币对美元约2.93（2026-08·TE货币）",
    fxHint: "约2.93（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约82.9%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    fxVolInYear: "±1.8%·年内高低相对均价粗算·currency-api·USD/TND周抽样高低/均价·2025–2026",
    householdDebtToGdp: "约18.5%（2024）·家庭债务/GDP·BCT银行对个人贷款/GDP",
    privCreditOrConsumer: "国内私营信贷约60.6% GDP（近年）·二级〔10〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  LY: {
    asOf: "2026-08对照·TE利比亚",
    gdpYoY: "6.9%（2025-12）",
    gdpUsdBn: "约481亿美元（2025-12）",
    gdpPerCapitaUsd: "约8634美元（2025-12）",
    incomePerCapita: "约12668美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "12.7%（2026-06）·破12%阈值",
    policyRate: "3%（2026-07）",
    unemployment: "18.8%（2025-12）",
    population: "约746万（2025-12）",
    employedToPop: "0.021/0.074·就业亿人/人口亿人·世行就业人口比39.1%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    currentAccount: "CA/GDP约-2.6%（2024-12）；近季约853百万LYD（2025-12）·TE经常账户",
    fxTrend: "本币对美元约6.36（2026-08·TE货币）",
    fxHint: "约6.36（TE货币·2026-08）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "通胀破12%。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约3%（2023）·家庭债务/GDP·无BIS/TE标准序列·银行个人信贷粗算",
    privCreditOrConsumer: "国内私营信贷约15% GDP（近年）·二级〔10〕",
    fxVolInYear: "±8.6%·年内高低相对均价粗算·currency-api·USD/LYD周抽样高低/均价·2025–2026",
    sectorMix: "三产分项待官方/TE续拆·对照总表三产阈值〔1〕·2026-08补录",
    debtToGdp: "政府债务/GDP口径战时不规则〔1〕",
    fxReserves: "约104.7亿美元（2025）·世行总储备(含黄金)〔1〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  SD: {
    asOf: "2026-08对照·TE苏丹",
    gdpYoY: "-28%（2024-12）",
    gdpUsdBn: "约602亿美元（2025-12）",
    gdpPerCapitaUsd: "约582美元（2025-12）·低于2000美元阈值",
    incomePerCapita: "约1879美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    unemployment: "20.8%（2023-12）",
    population: "约5166万（2025-12）",
    employedToPop: "0.104/0.504·就业亿人/人口亿人·世行就业人口比34.7%(2022)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    currentAccount: "CA/GDP约-7.9%（2025-12）；近季约-7.9%GDP（2025-12）",
    fxTrend: "本币对美元约600（2026-08·TE货币）",
    fxHint: "约600（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约188%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约2%（2023）·家庭债务/GDP·冲突期数据稀缺·银行个人信贷粗算",
    inflation: "68.15%（2025-12）·苏丹央行CPI同比·TheGlobalEconomy转述",
    policyRate: "—·冲突期非常规/多重汇率·无稳定公开政策利率〔1〕",
    fxVolInYear: "±30%·冲突/多轨汇率波·公开市场示意·2025–2026",
    privCreditOrConsumer: "正规消费贷渗透极低·冲突扰动·二级〔10〕",
    fxReserves: "冲突期外储数据稀缺·勿假装有官方外储数字〔1〕",
    sectorMix: "农业与采掘主导、服务业受冲突冲击·三产占比待续拆〔1〕·2026-08补录",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  SA: {
    asOf: "2026-08对照·TE沙特",
    gdpYoY: "-4.8%（2026-06）",
    gdpUsdBn: "约1.28万亿美元（2025-12）",
    gdpPerCapitaUsd: "约25066美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约61805美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "1.8%（2026-06）",
    policyRate: "4.25%（2026-07）",
    unemployment: "3.1%（2026-03）；青年失业约11%（2026-03）",
    population: "约3592万（2025-12）",
    employedToPop: "0.169/0.353·就业亿人/人口亿人·世行就业人口比62.9%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项30178（2026-03）；制造210858·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-2.7%（2025-12）；近季约4114百万美元（2026-03）",
    fxReserves: "约18546亿SAR（2026-06）·TE外汇储备·约合4946亿美元（SAR钉住）",
    fxTrend: "本币对美元约3.76（2026-08·TE货币）",
    householdDebtToGdp: "约31.7%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    privCreditOrConsumer: "私营部门贷款约3265964百万SAR（2026-06）；私人部门信贷约481091百万SAR（2026-03）·TE",
    fxHint: "约3.76（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约31.7%（2025-12）",
    consumerConfidence: "约114（2026-03）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    fxVolInYear: "±0.3%内·美元钉住窄幅·年内高低相对均价粗算·USD/SAR·2025–2026",
  },
  AE: {
    asOf: "2026-08对照·TE阿联酋",
    gdpYoY: "3%（2026-03）",
    gdpUsdBn: "约5520亿美元（2024-12）",
    gdpPerCapitaUsd: "约41605美元（2024-12）·过12000成熟阈值",
    incomePerCapita: "约84671美元（2023）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "2.04%（2025-12）",
    policyRate: "3.65%（2026-07）",
    unemployment: "2.17%（2025-12）",
    population: "约1124万（2025-12）",
    employedToPop: "0.071/0.11·就业亿人/人口亿人·世行就业人口比76.8%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项2409（2025-12）；制造43438；服务63710·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约13.2%（2025-12）；近季约13.2%GDP（2025-12）",
    fxReserves: "约9671亿AED（2026-05）·TE总对外资产（AED十亿）·约合2630亿美元（AED钉住）",
    fxTrend: "本币对美元约3.67（2026-08·TE货币）",
    privCreditOrConsumer: "消费信贷约598521AED - 百万（2026-03）；私营部门贷款约1553166AED - 百万（2026-05）",
    fxHint: "约3.67（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约32.8%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约24.1%（2024）·家庭债务/GDP·CEIC转述",
    fxVolInYear: "±0.3%内·美元钉住窄幅·年内高低相对均价粗算·USD/AED·2025–2026",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  BH: {
    asOf: "2026-08对照·TE巴林",
    gdpYoY: "4.6%（2025-12）",
    gdpUsdBn: "约490亿美元（2025-12）",
    gdpPerCapitaUsd: "约26592美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约63513美元（2024）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "2.3%（2026-06）",
    policyRate: "4.5%（2026-06）",
    unemployment: "6.3%（2024-12）",
    population: "约162万（2025-12）",
    employedToPop: "0.009/0.016·就业亿人/人口亿人·世行就业人口比69.8%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项12（2025-12）；制造660；服务2444·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约4.8%（2024-12）；近季约313BHD - 百万（2025-12）",
    fxReserves: "约6.84亿BHD（2026-06）·TE外汇储备·约合18.1亿美元（BHD钉住）",
    fxTrend: "本币对美元约0.38（2026-08·TE货币）",
    privCreditOrConsumer: "消费信贷约6336BHD - 百万（2026-06）；私营部门贷款约5480BHD - 百万（2026-06）",
    fxHint: "约0.38（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约148%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    fxVolInYear: "±0.3%内·美元钉住窄幅·年内高低相对均价粗算·USD/BHD·2025–2026",
    householdDebtToGdp: "约37%（2025）·家庭债务/GDP·零售银行个人贷款/GDP粗算·无BIS标准序列",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  QA: {
    asOf: "2026-08对照·TE卡塔尔",
    gdpYoY: "2%（2025-12）",
    gdpUsdBn: "约2160亿美元（2025-12）",
    gdpPerCapitaUsd: "约61735美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约115037美元（2021）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "2.21%（2026-06）",
    policyRate: "4.35%（2026-06）",
    unemployment: "0.1%（2025-12）",
    population: "约321万（2025-12）",
    employedToPop: "0.021/0.029·就业亿人/人口亿人·世行就业人口比87.1%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项560（2025-12）；制造13720；服务15900·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约14.8%（2025-12）；近季约18133QAR - 百万（2025-12）",
    fxReserves: "约2621亿QAR（2026-05）·TE外汇储备·约合720亿美元（QAR钉住）",
    fxTrend: "本币对美元约3.65（2026-08·TE货币）",
    privCreditOrConsumer: "私人部门信贷约941685QAR - 百万（2026-06）；贷款增长约1.63%（2026-05）",
    fxHint: "约3.65（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约41.4%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    fxVolInYear: "±0.3%内·美元钉住窄幅·年内高低相对均价粗算·USD/QAR·2025–2026",
    householdDebtToGdp: "约25%（2021）·家庭债务/GDP·IMF FAS商业银行对家庭贷款/GDP",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  KW: {
    asOf: "2026-08对照·TE科威特",
    gdpYoY: "2.41%（2025-12）",
    gdpUsdBn: "约1570亿美元（2025-12）",
    gdpPerCapitaUsd: "约24963美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约56107美元（2024）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "2.19%（2026-06）",
    policyRate: "3.5%（2026-06）",
    unemployment: "2.2%（2025-12）",
    population: "约498万（2025-12）",
    employedToPop: "0.029/0.049·就业亿人/人口亿人·世行就业人口比72.0%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    currentAccount: "CA/GDP约26.5%（2025-12）；近季约2201KWD - 百万（2025-12）",
    fxReserves: "约111亿美元（2026-06）",
    fxTrend: "本币对美元约0.31（2026-08·TE货币）",
    privCreditOrConsumer: "私营部门贷款约51812KWD - 百万（2026-06）；贷款增长约5.49%（2026-06）",
    fxHint: "约0.31（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约14.6%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    fxVolInYear: "±0.8%·年内高低相对均价粗算·currency-api·USD/KWD周抽样高低/均价·2025–2026",
    householdDebtToGdp: "约1.0%（2025-09）·家庭债务/GDP·CEIC转述（CBK贷款口径）",
    sectorMix: "三产分项待官方/TE续拆·对照总表三产阈值〔1〕·2026-08补录",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  OM: {
    asOf: "2026-08对照·TE阿曼",
    gdpYoY: "2.6%（2026-03）",
    gdpUsdBn: "约1100亿美元（2025-12）",
    gdpPerCapitaUsd: "约17074美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约36390美元（2024）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "2.8%（2026-06）",
    policyRate: "4.25%（2026-07）",
    unemployment: "3.3%（2025-12）",
    population: "约536万（2025-12）",
    employedToPop: "0.026/0.053·就业亿人/人口亿人·世行就业人口比66.1%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项338（2026-03）；制造869；服务4722·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约2.9%（2024-12）；近季约1180OMR - 百万（2024-12）",
    fxReserves: "约75.9亿美元（2026-05）",
    fxTrend: "本币对美元约0.39（2026-08·TE货币）",
    privCreditOrConsumer: "私人部门信贷约23102OMR - 百万（2026-05）；贷款增长约11.8%（2026-05）",
    fxHint: "约0.39（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约35.8%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    fxVolInYear: "±0.3%内·美元钉住窄幅·年内高低相对均价粗算·USD/OMR·2025–2026",
    householdDebtToGdp: "约41.1%（2023）·家庭债务/非石油名义GDP·CBO金融稳定报告·非总GDP口径",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  JO: {
    asOf: "2026-08对照·TE约旦",
    gdpYoY: "2.9%（2026-03）",
    gdpUsdBn: "约616亿美元（2025-12）",
    gdpPerCapitaUsd: "约4579美元（2025-12）",
    incomePerCapita: "约10011美元（2021）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "2.79%（2026-06）",
    policyRate: "5.75%（2026-07）",
    unemployment: "21.1%（2026-03）",
    population: "约1194万（2025-12）",
    employedToPop: "0.027/0.116·就业亿人/人口亿人·世行就业人口比33.3%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项608（2026-03）；制造1639；服务1928·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-5.6%（2025-12）；近季约-226约旦第纳尔 - 百万（2026-03）",
    fxReserves: "约203亿美元（2026-06）",
    fxTrend: "本币对美元约0.71（2026-08·TE货币）",
    privCreditOrConsumer: "私营部门贷款约32737约旦第纳尔 - 百万（2026-06）",
    fxHint: "约0.71（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约89.5%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    fxVolInYear: "±0.5%内·美元钉住窄幅·年内高低相对均价粗算·USD/JOD·2025–2026",
    householdDebtToGdp: "约69.5%（2026-Q1）·家庭债务/GDP·CEIC转述",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  LB: {
    asOf: "2026-08对照·TE黎巴嫩",
    gdpYoY: "-7.5%（2024-12）",
    gdpUsdBn: "约260亿美元（2024-12）",
    gdpPerCapitaUsd: "约5391美元（2024-12）",
    incomePerCapita: "约10332美元（2024）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "17.3%（2026-06）·破12%阈值",
    policyRate: "25%（2026-06）",
    unemployment: "11%（2023-12）",
    population: "约585万（2025-12）",
    employedToPop: "0.017/0.058·就业亿人/人口亿人·世行就业人口比38.7%(2023)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    currentAccount: "CA/GDP约-28.1%（2023-12）；近季约-349百万美元（2025-12）",
    fxTrend: "本币对美元约89417（2026-08·TE货币）",
    privCreditOrConsumer: "私人部门信贷约510825LBP - 10亿（2026-04）",
    fxHint: "约89417（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约139%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "通胀破12%；高政策利率。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约15%（2023）·家庭债务/GDP·危机后序列中断·银行个人信贷粗算",
    fxVolInYear: "±1.8%·年内高低相对均价粗算·currency-api·USD/LBP周抽样高低/均价·2025–2026",
    sectorMix: "三产分项待官方/TE续拆·对照总表三产阈值〔1〕·2026-08补录",
    fxReserves: "黄金储备约287吨（2025-03·TE）·官方外储口径战时不规则·勿假装有独立外储数字〔1〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  IQ: {
    asOf: "2026-08对照·TE伊拉克",
    gdpYoY: "-1.5%（2024-12）",
    gdpUsdBn: "约2540亿美元（2025-12）",
    gdpPerCapitaUsd: "约4005美元（2025-12）",
    incomePerCapita: "约11973美元（2024）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "3%（2026-05）",
    policyRate: "5.5%（2026-07）",
    unemployment: "15.5%（2025-12）",
    population: "约4702万（2025-12）",
    employedToPop: "0.103/0.46·就业亿人/人口亿人·世行就业人口比35.2%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    currentAccount: "CA/GDP约-1.7%（2025-12）；近季约-244百万美元（2025-12）",
    fxReserves: "111479 伊拉克第纳尔 - 10亿（2026-06）",
    fxTrend: "本币对美元约1308（2026-08·TE货币）",
    fxHint: "约1308（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约53.9%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    fxVolInYear: "±0.5%内·管理浮动/钉住窄幅·年内高低相对均价粗算·USD/IQD·2025–2026",
    householdDebtToGdp: "约7.2%（2024）·家庭债务/GDP·IMF FAS商业银行对家庭贷款/GDP",
    privCreditOrConsumer: "国内私营信贷约15% GDP（近年）·二级〔10〕",
    sectorMix: "三产分项待官方/TE续拆·对照总表三产阈值〔1〕·2026-08补录",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  IL: {
    asOf: "2026-08对照·TE以色列",
    gdpYoY: "1.7%（2026-03）",
    gdpUsdBn: "约6110亿美元（2025-12）",
    gdpPerCapitaUsd: "约42596美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约47468美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "1.6%（2026-06）",
    policyRate: "3.5%（2026-07）",
    unemployment: "2.9%（2026-06）",
    population: "约1012万（2025-12）",
    employedToPop: "0.046/0.1·就业亿人/人口亿人·世行就业人口比63.1%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项3802（2026-03）·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约1.5%（2025-12）；近季约-107百万美元（2026-03）",
    fxReserves: "约2387亿美元（2026-06）",
    fxTrend: "本币对美元约3.01（2026-08·TE货币）",
    householdDebtToGdp: "约42.8%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±9.1%·年内高低相对均价粗算·Frankfurter USD/ILS·2024–2025",
    privCreditOrConsumer: "消费信贷约918ILS - 10亿（2026-05）；私人部门信贷约1656ILS - 10亿（2026-05）",
    fxHint: "约3.01（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约68.5%（2025-12）",
    consumerConfidence: "约-18.56（2026-06）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  PS: {
    asOf: "2026-08对照·TE巴勒斯坦",
    gdpYoY: "-4.8%（2026-03）",
    gdpUsdBn: "约172亿美元（2025-12）",
    gdpPerCapitaUsd: "约4272美元（2025-12）",
    incomePerCapita: "约4625美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "-40.04%（2026-06）·TE·战争冲击致价格/基期异常〔1〕·2026-08补录",
    unemployment: "29.5%（2026-03）；青年失业约40.3%（2026-03）·破20%阈值",
    population: "约551万（2025-12）",
    employedToPop: "0.011/0.053·就业亿人/人口亿人·世行就业人口比34.0%(2022)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项147（2026-03）；制造428；服务655·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-21.1%（2024-12）；近季约-337百万美元（2025-12）",
    debtToGdp: "政府债务/GDP约27.9%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约12%（2023）·家庭债务/GDP·无独立标准序列·银行个人信贷粗算",
    policyRate: "—·无独立央行政策利率·流通ILS/JOD〔1〕",
    fxTrend: "流通以色列新谢克尔/约旦第纳尔·无单一本币对美元官方牌价〔1〕",
    fxHint: "ILS/JOD流通（无单一本币）〔1〕",
    fxVolInYear: "±9.8%·年内高低相对均价粗算·currency-api·USD/ILS周抽样高低/均价·2025–2026",
    privCreditOrConsumer: "正规消费贷深度有限·冲突扰动·二级〔10〕",
    fxReserves: "无独立外储统计·流通ILS/JOD·勿假装有官方外储数字〔1〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  TR: {
    asOf: "2026-08对照·TE土耳其",
    gdpYoY: "2.5%（2026-03）",
    gdpUsdBn: "约1.60万亿美元（2025-12）",
    gdpPerCapitaUsd: "约15883美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约31665美元（2021）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "31.75%（2026-07）·破12%阈值",
    policyRate: "37%（2026-07）",
    unemployment: "7.6%（2026-06）；青年失业约12.8%（2026-06）",
    population: "约8609万（2025-12）",
    employedToPop: "0.332/0.855·就业亿人/人口亿人·世行就业人口比49.4%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项12969655（2026-03）；制造91131853；服务138614708·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-1%（2024-12）；近季约-1459百万美元（2026-05）",
    fxReserves: "约624亿美元（2026-07）",
    fxTrend: "本币对美元约47.59（2026-08·TE货币）",
    householdDebtToGdp: "约10.1%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±9.7%·年内高低相对均价粗算·Frankfurter USD/TRY·2024–2025",
    privCreditOrConsumer: "消费信贷约6478190524TRY千（2026-06）；私营部门贷款约14013059173TRY千（2026-06）",
    fxHint: "约47.59（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约23.8%（2025-12）",
    consumerConfidence: "约89.8（2026-07）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值；通胀破12%；高政策利率。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  YE: {
    asOf: "2026-08对照·TE也门",
    gdpYoY: "-0.5%（2025-12）",
    gdpUsdBn: "约191亿美元（2024-12）",
    gdpPerCapitaUsd: "约821美元（2024-12）·低于2000美元阈值",
    incomePerCapita: "约821美元（2024-12）·人均GDP近似下界·TE·非住户可支配收入",
    unemployment: "17.3%（2025-12）",
    population: "约4177万（2025-12）",
    employedToPop: "0.066/0.406·就业亿人/人口亿人·世行就业人口比27.6%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    currentAccount: "近季约-2400百万美元（2023-12）",
    fxTrend: "本币对美元约237（2026-08·TE货币）",
    fxHint: "约237（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约71.2%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约2%（2023）·家庭债务/GDP·冲突期数据稀缺·银行个人信贷粗算",
    inflation: "约20.4%（2025-12）·IMF年率·二级〔10〕·2026-08补录",
    policyRate: "—·战时双轨/非常规货币政策·无单一政策利率〔1〕",
    sectorMix: "油气依赖高、农业与服务业碎片化·三产占比待官方续拆〔1〕·2026-08补录",
    fxReserves: "约12.5亿美元（2022）·世行总储备(含黄金)〔1〕",
    fxVolInYear: "±25%·冲突/多轨汇率波·公开市场示意·2025–2026",
    privCreditOrConsumer: "正规消费贷渗透极低·二级〔10〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  IR: {
    asOf: "2026-08对照·TE伊朗",
    gdpYoY: "1.59%（2024-12）",
    gdpUsdBn: "约3630亿美元（2025-12）",
    gdpPerCapitaUsd: "约5617美元（2025-12）",
    incomePerCapita: "约16077美元（2024）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "87.9%（2026-07）·破12%阈值",
    policyRate: "23%（2026-07）",
    unemployment: "7.2%（2024-12）；青年失业约20.2%（2024-12）·破20%阈值",
    population: "约8600万（2024-12）",
    employedToPop: "0.269/0.916·就业亿人/人口亿人·世行就业人口比37.9%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项1534659（2024-12）；制造5281600；服务9684636·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约1.8%（2025-12）；近季约6326百万美元（2023-12）",
    fxTrend: "本币对美元约1374305（2026-08·TE货币）",
    fxHint: "约1374305（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约36.8%（2024-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "通胀破12%；高政策利率。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约10%（2023）·家庭债务/GDP·制裁下口径不规则·银行个人信贷粗算",
    privCreditOrConsumer: "国内私营信贷约50% GDP（近年）·二级〔10〕",
    fxVolInYear: "±87.6%·年内高低相对均价粗算·currency-api·USD/IRR周抽样高低/均价·2025–2026",
    fxReserves: "制裁下外储口径不规则·勿假装有官方外储数字〔1〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  NG: {
    asOf: "2026-08对照·TE尼日利亚",
    gdpYoY: "3.89%（2026-03）",
    gdpUsdBn: "约2910亿美元（2025-12）",
    gdpPerCapitaUsd: "约2369美元（2025-12）",
    incomePerCapita: "约7482美元（2021）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "15.91%（2026-06）·破12%阈值",
    policyRate: "26.5%（2026-07）",
    unemployment: "4.9%（2024-12）",
    population: "约2.38亿（2025-12）",
    employedToPop: "1.1/2.33·就业亿人/人口亿人·世行就业人口比80.1%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项11872704（2026-03）；制造4905644；服务29594541·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约5.1%（2025-12）；近季约4981百万美元（2026-03）",
    fxReserves: "约519亿美元（2026-07）",
    fxTrend: "本币对美元约1362（2026-08·TE货币）",
    privCreditOrConsumer: "私人部门信贷约81041510NGN - 百万（2026-05）",
    fxHint: "约1362（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约52.5%（2025-12）",
    consumerConfidence: "约-14.6（2026-06）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "通胀破12%；高政策利率。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约20.4%（2025-Q1）·家庭债务/GDP·IIF Global Debt Monitor",
    fxVolInYear: "±6.7%·年内高低相对均价粗算·currency-api·USD/NGN周抽样高低/均价·2025–2026",
  },
  KE: {
    asOf: "2026-08对照·TE肯尼亚",
    gdpYoY: "5.3%（2026-03）",
    gdpUsdBn: "约1360亿美元（2025-12）",
    gdpPerCapitaUsd: "约1908美元（2025-12）·低于2000美元阈值",
    incomePerCapita: "约5863美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "6.5%（2026-07）",
    policyRate: "8.75%（2026-06）",
    unemployment: "5.4%（2025-12）",
    population: "约5330万（2025-12）",
    employedToPop: "0.227/0.564·就业亿人/人口亿人·世行就业人口比63.7%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项568027（2026-03）；制造230901；服务81559·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-2.1%（2025-12）；近季约-3631百万美元（2026-04）",
    fxReserves: "约199亿美元（2026-04）",
    fxTrend: "本币对美元约129（2026-08·TE货币）",
    fxHint: "约129（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约67.8%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约10.4%（2025）·家庭债务/GDP·IIF Global Debt Monitor",
    fxVolInYear: "±0.6%·年内高低相对均价粗算·currency-api·USD/KES周抽样高低/均价·2025–2026",
    privCreditOrConsumer: "国内私营信贷约30% GDP（近年）·二级〔10〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  GH: {
    asOf: "2026-08对照·TE加纳",
    gdpYoY: "6.4%（2026-03）",
    gdpUsdBn: "约1140亿美元（2025-12）",
    gdpPerCapitaUsd: "约2261美元（2025-12）",
    incomePerCapita: "约6783美元（2024）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "5.3%（2026-06）",
    policyRate: "14%（2026-07）",
    unemployment: "3%（2025-12）",
    population: "约3506万（2025-12）",
    employedToPop: "0.127/0.344·就业亿人/人口亿人·世行就业人口比57.4%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项11924（2026-03）；制造7057；服务25200·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约4.4%（2024-12）；近季约3099百万美元（2026-03）",
    fxReserves: "约139亿美元（2026-04）",
    fxTrend: "本币对美元约11.71（2026-08·TE货币）",
    fxHint: "约11.71（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约48.8%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约1.8%（2024）·家庭债务/GDP·IMF FAS商业银行对家庭贷款/GDP",
    fxVolInYear: "±9.2%·年内高低相对均价粗算·currency-api·USD/GHS周抽样高低/均价·2025–2026",
    privCreditOrConsumer: "国内私营信贷约12% GDP（近年）·二级〔10〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  ZA: {
    asOf: "2026-08对照·TE南非",
    gdpYoY: "1.9%（2026-03）",
    gdpUsdBn: "约4270亿美元（2025-12）",
    gdpPerCapitaUsd: "约5713美元（2025-12）",
    incomePerCapita: "约13036美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "5%（2026-06）",
    policyRate: "7%（2026-07）",
    unemployment: "32.7%（2026-03）；青年失业约60.9%（2026-03）·破20%阈值",
    population: "约6310万（2025-12）",
    employedToPop: "0.179/0.64·就业亿人/人口亿人·世行就业人口比37.6%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项141820（2026-03）；制造512313；服务1183046·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-0.5%（2025-12）；近季约190700ZAR - 百万（2026-03）",
    fxReserves: "约741亿美元（2026-06）",
    fxTrend: "本币对美元约16.34（2026-08·TE货币）",
    householdDebtToGdp: "约33.5%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±8.9%·年内高低相对均价粗算·Frankfurter USD/ZAR·2024–2025",
    privCreditOrConsumer: "私营部门贷款约5367759ZAR - 百万（2026-06）；私人部门信贷约7.8%（2026-06）",
    fxHint: "约16.34（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约78.9%（2025-12）",
    consumerConfidence: "约-19（2026-06）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  TZ: {
    asOf: "2026-08对照·TE坦桑尼亚",
    gdpYoY: "6%（2026-03）",
    gdpUsdBn: "约901亿美元（2025-12）",
    gdpPerCapitaUsd: "约1153美元（2025-12）·低于2000美元阈值",
    incomePerCapita: "约3830美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "4%（2026-06）",
    policyRate: "6.25%（2026-07）",
    unemployment: "6.2%（2024-12）",
    population: "约6815万（2025-12）",
    employedToPop: "0.325/0.686·就业亿人/人口亿人·世行就业人口比82.4%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项9962954（2026-03）；制造3331910；服务19271851·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-2.2%（2025-12）；近季约-949百万美元（2026-03）",
    fxTrend: "本币对美元约2650（2026-08·TE货币）",
    privCreditOrConsumer: "私人部门信贷约51923TZS 十亿（2026-06）",
    fxHint: "约2650（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约49.7%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约5%（2024）·家庭债务/GDP·无BIS家庭分项·银行个人信贷粗算",
    fxVolInYear: "±4.0%·年内高低相对均价粗算·currency-api·USD/TZS周抽样高低/均价·2025–2026",
    fxReserves: "约61.7亿美元（2025-10）·BoT月报转述外储存量·约4.7个月进口覆盖〔1〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  UG: {
    asOf: "2026-08对照·TE乌干达",
    gdpYoY: "5.8%（2026-03）",
    gdpUsdBn: "约620亿美元（2025-12）",
    gdpPerCapitaUsd: "约1021美元（2025-12）·低于2000美元阈值",
    incomePerCapita: "约2815美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "4%（2026-07）",
    policyRate: "9.75%（2026-06）",
    unemployment: "2.7%（2025-12）",
    population: "约4885万（2025-12）",
    employedToPop: "0.22/0.5·就业亿人/人口亿人·世行就业人口比77.8%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项7563（2026-03）；制造6023；服务18895·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-5.18%（2025-12）；近季约-561百万美元（2026-03）",
    fxReserves: "约61.2亿美元（2026-05）",
    fxTrend: "本币对美元约3724（2026-08·TE货币）",
    privCreditOrConsumer: "消费信贷约6790962UGX - 百万（2026-05）；私营部门贷款约29882UGX - 10亿（2026-05）",
    fxHint: "约3724（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约54.2%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约4.1%（2024）·家庭债务/GDP·IMF FAS商业银行对家庭贷款/GDP",
    fxVolInYear: "±4.4%·年内高低相对均价粗算·currency-api·USD/UGX周抽样高低/均价·2025–2026",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  RW: {
    asOf: "2026-08对照·TE卢旺达",
    gdpYoY: "-10%（2026-03）",
    gdpUsdBn: "约164亿美元（2025-12）",
    gdpPerCapitaUsd: "约1116美元（2025-12）·低于2000美元阈值",
    incomePerCapita: "约3280美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "12.7%（2026-06）·破12%阈值",
    policyRate: "8.25%（2026-06）",
    unemployment: "13.4%（2026-05）；青年失业约15.7%（2026-05）",
    population: "约1410万（2025-12）",
    employedToPop: "0.05/0.143·就业亿人/人口亿人·世行就业人口比56.3%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项1095（2026-03）；制造486；服务2794·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-12.1%（2024-12）；近季约-479百万美元（2026-03）",
    fxTrend: "本币对美元约1467（2026-08·TE货币）",
    privCreditOrConsumer: "私人部门信贷约5671RWF - 10亿（2026-05）",
    fxHint: "约1467（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约64.6%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值；通胀破12%。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约6%（2024）·家庭债务/GDP·无BIS家庭分项·银行个人信贷粗算",
    fxVolInYear: "±1.2%·年内高低相对均价粗算·currency-api·USD/RWF周抽样高低/均价·2025–2026",
    fxReserves: "约23.2亿美元（2025-06）·NBR年报外储·约4.8个月进口覆盖〔1〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  ET: {
    asOf: "2026-08对照·TE埃塞俄比亚",
    gdpYoY: "7.3%（2024-12）",
    gdpUsdBn: "约1260亿美元（2025-12）",
    gdpPerCapitaUsd: "约945美元（2025-12）·低于2000美元阈值",
    incomePerCapita: "约3130美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "13.9%（2026-06）·破12%阈值",
    policyRate: "16%（2026-07）",
    unemployment: "3.3%（2025-12）",
    population: "约1.35亿（2025-12）",
    employedToPop: "0.533/1.32·就业亿人/人口亿人·世行就业人口比66.2%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项889（2024-12）；制造857；服务1125·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-2.9%（2025-12）；近季约-1180百万美元（2024-12）",
    fxTrend: "本币对美元约161（2026-08·TE货币）",
    fxHint: "约161（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约41%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值；通胀破12%；高政策利率。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约3%（2023）·家庭债务/GDP·无BIS/TE标准序列·银行个人信贷粗算",
    privCreditOrConsumer: "国内私营信贷约17.7% GDP（近年）·二级〔10〕",
    fxVolInYear: "±7.4%·年内高低相对均价粗算·currency-api·USD/ETB周抽样高低/均价·2025–2026",
    fxReserves: "约37.8亿美元（2024）·世行总储备(含黄金)〔1〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  CI: {
    asOf: "2026-08对照·TE科特迪瓦",
    gdpYoY: "6.7%（2026-03）",
    gdpUsdBn: "约998亿美元（2025-12）",
    gdpPerCapitaUsd: "约2491美元（2025-12）",
    incomePerCapita: "约6960美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "1.8%（2026-06）",
    policyRate: "5%（2026-06）",
    unemployment: "2.3%（2025-12）",
    population: "约3250万（2025-12）",
    employedToPop: "0.124/0.319·就业亿人/人口亿人·世行就业人口比65.6%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    currentAccount: "CA/GDP约-3%（2025-12）；近季约-518XOF - 10亿（2025-12）",
    fxTrend: "本币对美元约568（2026-08·TE货币）",
    fxHint: "约568（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约56.3%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约7%（2024）·家庭债务/GDP·无BIS/TE标准序列·银行个人信贷粗算",
    privCreditOrConsumer: "国内私营信贷约25% GDP（近年）·二级〔10〕",
    fxVolInYear: "±2.1%·CFA钉住欧元·沿用USD/XOF抽样高低/均价·currency-api·2025–2026",
    sectorMix: "三产分项待官方/TE续拆·对照总表三产阈值〔1〕·2026-08补录",
    fxReserves: "西非经货联盟(BCEAO)共同外储池·联盟外汇约16352亿XOF/约249亿欧元（2025末·BCEAO财报转述）·国别拆分待续核〔1〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  SN: {
    asOf: "2026-08对照·TE塞内加尔",
    gdpYoY: "5.8%（2026-03）",
    gdpUsdBn: "约370亿美元（2025-12）",
    gdpPerCapitaUsd: "约1582美元（2025-12）·低于2000美元阈值",
    incomePerCapita: "约4565美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "0.4%（2026-06）",
    policyRate: "5%（2026-07）",
    unemployment: "22.9%（2026-03）",
    population: "约1939万（2025-12）",
    employedToPop: "0.058/0.185·就业亿人/人口亿人·世行就业人口比50.4%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项432（2026-03）·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-9.2%（2025-12）；近季约-1206XOF - 10亿（2025-12）",
    fxTrend: "本币对美元约568（2026-08·TE货币）",
    fxHint: "约568（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约111%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约8%（2024）·家庭债务/GDP·无BIS家庭分项·银行个人信贷粗算",
    privCreditOrConsumer: "国内私营信贷约29.2% GDP（近年）·二级〔10〕",
    fxVolInYear: "±2.1%·CFA钉住欧元·沿用USD/XOF抽样高低/均价·currency-api·2025–2026",
    fxReserves: "西非经货联盟(BCEAO)共同外储池·联盟外汇约16352亿XOF/约249亿欧元（2025末·BCEAO财报转述）·国别拆分待续核〔1〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  CM: {
    asOf: "2026-08对照·TE喀麦隆",
    gdpYoY: "2.7%（2025-12）",
    gdpUsdBn: "约589亿美元（2025-12）",
    gdpPerCapitaUsd: "约1489美元（2025-12）·低于2000美元阈值",
    incomePerCapita: "约4857美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "2.7%（2026-05）",
    policyRate: "4.5%（2026-07）",
    unemployment: "3.6%（2025-12）",
    population: "约2990万（2025-12）",
    employedToPop: "0.108/0.291·就业亿人/人口亿人·世行就业人口比63.2%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项296（2025-12）·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-3.9%（2025-12）；近季约-1038XAF - 十亿（2024-12）",
    fxTrend: "本币对美元约568（2026-08·TE货币）",
    fxHint: "约568（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约40.4%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约2.7%（2020）·家庭债务/GDP·IMF FAS商业银行对家庭贷款/GDP·序列偏旧",
    privCreditOrConsumer: "国内私营信贷约14.1% GDP（近年）·二级〔10〕",
    fxVolInYear: "±2.1%·CFA钉住欧元·沿用USD/XAF抽样高低/均价·currency-api·2025–2026",
    fxReserves: "约50.6亿美元（2024）·世行总储备(含黄金)〔1〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  AO: {
    asOf: "2026-08对照·TE安哥拉",
    gdpYoY: "5.3%（2026-03）",
    gdpUsdBn: "约1220亿美元（2025-12）",
    gdpPerCapitaUsd: "约2801美元（2025-12）",
    incomePerCapita: "约7878美元（2024）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "10.11%（2026-06）",
    policyRate: "15.75%（2026-07）",
    unemployment: "21.3%（2026-03）；青年失业约40.7%（2026-03）·破20%阈值",
    population: "约3751万（2025-12）",
    employedToPop: "0.136/0.379·就业亿人/人口亿人·世行就业人口比64.4%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项591827（2026-03）；制造292743；服务687242·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约1.1%（2025-12）；近季约536百万美元（2025-12）",
    fxReserves: "约149亿美元（2026-06）",
    fxTrend: "本币对美元约919（2026-08·TE货币）",
    privCreditOrConsumer: "私营部门贷款约7820532AOA - 百万（2026-06）",
    fxHint: "约919（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约51.3%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "高政策利率。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约3%（2024）·家庭债务/GDP·无BIS/TE标准序列·银行个人信贷粗算",
    fxVolInYear: "±0.6%·年内高低相对均价粗算·currency-api·USD/AOA周抽样高低/均价·2025–2026",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  MZ: {
    asOf: "2026-08对照·TE莫桑比克",
    gdpYoY: "0.1%（2026-03）",
    gdpUsdBn: "约223亿美元（2025-12）",
    gdpPerCapitaUsd: "约586美元（2025-12）·低于2000美元阈值",
    incomePerCapita: "约1354美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "7.51%（2026-06）",
    policyRate: "9.25%（2026-07）",
    population: "约3316万（2025-12）",
    employedToPop: "0.141/0.346·就业亿人/人口亿人·世行就业人口比73.5%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "就业/非正式就业待ILO与官方交叉",
    sectorMix: "农业分项90365（2026-03）；制造16586；服务19749·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-13.3%（2025-12）；近季约-359百万美元（2026-03）",
    fxReserves: "约35.0亿美元（2026-05）",
    fxTrend: "本币对美元约63.6（2026-08·TE货币）",
    fxHint: "约63.6（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约76.9%（2024-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约5%（2024）·家庭债务/GDP·无BIS/TE标准序列·银行个人信贷粗算",
    privCreditOrConsumer: "国内私营信贷约17.6% GDP（近年）·二级〔10〕",
    fxVolInYear: "±8.0%·年内高低相对均价粗算·USD/MZN·公开汇价抽样校正·2025–2026",
    unemployment: "约3.5%（近年）·二级·ILO/公开转述〔1〕·2026-08补录",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  ZM: {
    asOf: "2026-08对照·TE赞比亚",
    gdpYoY: "7.7%（2026-03）",
    gdpUsdBn: "约289亿美元（2025-12）",
    gdpPerCapitaUsd: "约1356美元（2025-12）·低于2000美元阈值",
    incomePerCapita: "约3232美元（2021）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "6.5%（2026-07）",
    policyRate: "13.25%（2026-05）",
    unemployment: "12.9%（2024-12）",
    population: "约2231万（2025-12）",
    employedToPop: "0.073/0.213·就业亿人/人口亿人·世行就业人口比58.3%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项4179（2026-03）；制造3699；服务5861·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-5.1%（2025-12）；近季约396百万美元（2026-03）",
    fxReserves: "约63.8亿美元（2026-04）",
    fxTrend: "本币对美元约19.06（2026-08·TE货币）",
    fxHint: "约19.06（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约60.9%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约2.1%（2024）·家庭债务/GDP·IMF FAS商业银行对家庭贷款/GDP",
    privCreditOrConsumer: "国内私营信贷约12% GDP（近年）·二级〔10〕",
    fxVolInYear: "±15.4%·年内高低相对均价粗算·currency-api·USD/ZMW周抽样高低/均价·2025–2026",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  ZW: {
    asOf: "2026-08对照·TE津巴布韦",
    gdpYoY: "8.2%（2025-12）",
    gdpUsdBn: "约512亿美元（2025-12）",
    gdpPerCapitaUsd: "约1503美元（2025-12）·低于2000美元阈值",
    incomePerCapita: "约5145美元（2024）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "3.2%（2026-07）",
    policyRate: "30%（2026-07）",
    unemployment: "9.3%（2025-12）",
    population: "约1592万（2025-12）",
    employedToPop: "0.06/0.166·就业亿人/人口亿人·世行就业人口比61.3%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    currentAccount: "CA/GDP约4.07%（2025-12）；近季约2126百万美元（2025-12）",
    fxTrend: "本币对美元约26.63（2026-08·TE货币）",
    fxHint: "约26.63（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约32.12%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值；高政策利率。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约2%（2023）·家庭债务/GDP·多币种口径不规则·银行个人信贷粗算",
    privCreditOrConsumer: "国内私营信贷约8% GDP（近年）·二级〔10〕",
    fxVolInYear: "±57.6%·年内高低相对均价粗算·currency-api·USD/ZWL周抽样高低/均价·2025–2026",
    sectorMix: "三产分项待官方/TE续拆·对照总表三产阈值〔1〕·2026-08补录",
    fxReserves: "多币种流通·官方外储口径不规则·勿假装有官方外储数字〔1〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  BW: {
    asOf: "2026-08对照·TE博茨瓦纳",
    gdpYoY: "3.5%（2026-03）",
    gdpUsdBn: "约199亿美元（2025-12）",
    gdpPerCapitaUsd: "约6791美元（2025-12）",
    incomePerCapita: "约17803美元（2024）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "10.7%（2026-06）",
    policyRate: "5.5%（2026-07）",
    unemployment: "24.5%（2025-12）",
    population: "约256万（2025-12）",
    employedToPop: "0.009/0.025·就业亿人/人口亿人·世行就业人口比52.2%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项784（2026-03）；制造2713·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-4.3%（2025-12）；近季约-31.3BWP - 百万（2026-03）",
    fxReserves: "约43.5亿美元（2026-04）",
    fxTrend: "本币对美元约14.17（2026-08·TE货币）",
    privCreditOrConsumer: "消费信贷约55024BWP - 百万（2026-05）；私营部门贷款约33149BWP - 百万（2026-05）",
    fxHint: "约14.17（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约25.6%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约21.3%（2025-12）·家庭债务/GDP·CEIC转述",
    fxVolInYear: "±4.4%·年内高低相对均价粗算·currency-api·USD/BWP周抽样高低/均价·2025–2026",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  NA: {
    asOf: "2026-08对照·TE纳米比亚",
    gdpYoY: "2%（2026-03）",
    gdpUsdBn: "约151亿美元（2025-12）",
    gdpPerCapitaUsd: "约4019美元（2025-12）",
    incomePerCapita: "约10536美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "4.4%（2026-06）",
    policyRate: "6.75%（2026-07）",
    unemployment: "19.3%（2025-12）",
    population: "约273万（2025-12）",
    employedToPop: "0.009/0.03·就业亿人/人口亿人·世行就业人口比47.6%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项1060（2026-03）；制造3499；服务4361·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-15.3%（2024-12）；近季约-9910NAD - 百万（2026-03）",
    fxReserves: "约564.2亿NAD（2026-06）·TE外汇储备（NAD百万）·约合32亿美元级（ZAR/NAD）",
    fxTrend: "本币对美元约16.33（2026-08·TE货币）",
    fxHint: "约16.33（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约70.2%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约30.7%（2024）·家庭债务/GDP·BoN金融稳定报告",
    privCreditOrConsumer: "国内私营信贷约55% GDP（近年）·二级〔10〕",
    fxVolInYear: "±5.2%·年内高低相对均价粗算·currency-api·USD/NAD周抽样高低/均价·2025–2026",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  MU: {
    asOf: "2026-08对照·TE毛里求斯",
    gdpYoY: "2%（2026-03）",
    gdpUsdBn: "约162亿美元（2025-12）",
    gdpPerCapitaUsd: "约12315美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约29003美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "3.7%（2026-06）",
    policyRate: "4.75%（2026-07）",
    unemployment: "5.7%（2026-03）",
    population: "约124万（2025-12）",
    employedToPop: "0.006/0.012·就业亿人/人口亿人·世行就业人口比55.4%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项7161（2026-03）；制造14950·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-6.4%（2024-12）；近季约-1112MUR - 百万（2026-03）",
    fxReserves: "约110亿美元（2026-06）",
    fxTrend: "本币对美元约46.93（2026-08·TE货币）",
    fxHint: "约46.93（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约86.5%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约31.5%（2022）·家庭债务/GDP·IMF FAS家庭贷款/GDP",
    privCreditOrConsumer: "国内私营信贷约70% GDP（近年）·二级〔10〕",
    fxVolInYear: "±2.6%·年内高低相对均价粗算·currency-api·USD/MUR周抽样高低/均价·2025–2026",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  MG: {
    asOf: "2026-08对照·TE马达加斯加",
    gdpYoY: "4.3%（2024-12）",
    gdpUsdBn: "约196亿美元（2025-12）",
    gdpPerCapitaUsd: "约457美元（2025-12）·低于2000美元阈值",
    incomePerCapita: "约1658美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "8.6%（2026-05）",
    policyRate: "12.5%（2026-08）",
    unemployment: "3%（2025-12）",
    population: "约3274万（2025-12）",
    employedToPop: "0.161/0.32·就业亿人/人口亿人·世行就业人口比82.9%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    currentAccount: "CA/GDP约-6%（2025-12）；近季约-44.1MGA - 百万（2025-12）",
    fxTrend: "本币对美元约4250（2026-08·TE货币）",
    fxHint: "约4250（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约48.7%（2026-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约4%（2024）·家庭债务/GDP·无BIS/TE标准序列·银行个人信贷粗算",
    privCreditOrConsumer: "国内私营信贷约16.6% GDP（近年）·二级〔10〕",
    fxVolInYear: "±5.2%·年内高低相对均价粗算·currency-api·USD/MGA周抽样高低/均价·2025–2026",
    sectorMix: "三产分项待官方/TE续拆·对照总表三产阈值〔1〕·2026-08补录",
    fxReserves: "约27.8亿美元（2024）·世行总储备(含黄金)〔1〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  BJ: {
    asOf: "2026-08对照·TE贝宁",
    gdpYoY: "6.4%（2026-03）",
    gdpUsdBn: "约246亿美元（2025-12）",
    gdpPerCapitaUsd: "约1398美元（2025-12）·低于2000美元阈值",
    incomePerCapita: "约4028美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "-0.4%（2026-06）",
    policyRate: "5%（2026-07）",
    unemployment: "1.6%（2025-12）",
    population: "约1419万（2025-12）",
    employedToPop: "0.063/0.145·就业亿人/人口亿人·世行就业人口比75.0%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项3103（2025-12）；制造1209；服务5841·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-5.6%（2025-12）；近季约-882XOF - 10亿（2024-12）",
    fxTrend: "本币对美元约568（2026-08·TE货币）",
    fxHint: "约568（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约52.5%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约4%（2024）·家庭债务/GDP·无BIS/TE标准序列·银行个人信贷粗算",
    privCreditOrConsumer: "国内私营信贷约20% GDP（近年）·二级〔10〕",
    fxVolInYear: "±2.1%·CFA钉住欧元·沿用USD/XOF抽样高低/均价·currency-api·2025–2026",
    fxReserves: "西非经货联盟(BCEAO)共同外储池·联盟外汇约16352亿XOF/约249亿欧元（2025末·BCEAO财报转述）·国别拆分待续核〔1〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  BF: {
    asOf: "2026-08对照·TE布基纳法索",
    gdpYoY: "5.6%（2026-03）",
    gdpUsdBn: "约276亿美元（2025-12）",
    gdpPerCapitaUsd: "约787美元（2025-12）·低于2000美元阈值",
    incomePerCapita: "约2757美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "0.1%（2026-05）",
    policyRate: "5%（2026-07）",
    unemployment: "3.5%（2025-12）",
    population: "约2410万（2025-12）",
    employedToPop: "0.093/0.235·就业亿人/人口亿人·世行就业人口比67.7%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项398（2025-12）；制造283；服务1310·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-2.2%（2025-12）；近季约786XOF - 10亿（2025-12）",
    fxTrend: "本币对美元约568（2026-08·TE货币）",
    fxHint: "约568（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约53.1%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约3%（2024）·家庭债务/GDP·无BIS/TE标准序列·银行个人信贷粗算",
    privCreditOrConsumer: "国内私营信贷约25% GDP（近年）·二级〔10〕",
    fxVolInYear: "±2.1%·CFA钉住欧元·沿用USD/XOF抽样高低/均价·currency-api·2025–2026",
    fxReserves: "西非经货联盟(BCEAO)共同外储池·联盟外汇约16352亿XOF/约249亿欧元（2025末·BCEAO财报转述）·国别拆分待续核〔1〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  ML: {
    asOf: "2026-08对照·TE马里",
    gdpYoY: "7.2%（2025-12）",
    gdpUsdBn: "约301亿美元（2025-12）",
    gdpPerCapitaUsd: "约934美元（2025-12）·低于2000美元阈值",
    incomePerCapita: "约2891美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "2%（2026-06）",
    policyRate: "5%（2026-07）",
    unemployment: "2.8%（2025-12）",
    population: "约2520万（2025-12）",
    employedToPop: "0.086/0.245·就业亿人/人口亿人·世行就业人口比65.2%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    currentAccount: "CA/GDP约-7.44%（2024-12）；近季约-637XOF - 10亿（2024-12）",
    fxTrend: "本币对美元约568（2026-08·TE货币）",
    fxHint: "约568（TE货币·2026-08）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约3%（2024）·家庭债务/GDP·无BIS/TE标准序列·银行个人信贷粗算",
    privCreditOrConsumer: "国内私营信贷约22% GDP（近年）·二级〔10〕",
    fxVolInYear: "±2.1%·CFA钉住欧元·沿用USD/XOF抽样高低/均价·currency-api·2025–2026",
    sectorMix: "三产分项待官方/TE续拆·对照总表三产阈值〔1〕·2026-08补录",
    debtToGdp: "政府债务/GDP约53%级（近年）·二级〔10〕",
    fxReserves: "西非经货联盟(BCEAO)共同外储池·联盟外汇约16352亿XOF/约249亿欧元（2025末·BCEAO财报转述）·国别拆分待续核〔1〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  CD: {
    asOf: "2026-08对照·TE刚果（金）",
    gdpYoY: "6.7%（2024-12）",
    gdpUsdBn: "约910亿美元（2025-12）",
    gdpPerCapitaUsd: "约568美元（2025-12）·低于2000美元阈值",
    incomePerCapita: "约1239美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "2.6%（2026-06）",
    policyRate: "13.5%（2026-07）",
    population: "约1.13亿（2025-12）",
    employedToPop: "0.363/1.093·就业亿人/人口亿人·世行就业人口比61.6%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "就业/非正式就业待ILO与官方交叉",
    sectorMix: "农业分项2150（2024-12）；制造1512；服务5676·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-3.3%（2025-12）；近季约-2719百万美元（2024-12）",
    fxReserves: "约81.8亿美元（2026-06）",
    fxTrend: "本币对美元约2290（2026-08·TE货币）",
    fxHint: "约2290（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约20.2%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP＜2000阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约1.5%（2023）·家庭债务/GDP·无BIS/TE标准序列·银行个人信贷粗算",
    privCreditOrConsumer: "国内私营信贷约8% GDP（近年）·二级〔10〕",
    fxVolInYear: "±16.5%·年内高低相对均价粗算·currency-api·USD/CDF周抽样高低/均价·2025–2026",
    unemployment: "约4.5%（近年）·二级·ILO/公开转述·非正式就业高〔1〕·2026-08补录",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  GA: {
    asOf: "2026-08对照·TE加蓬",
    gdpYoY: "2.7%（2025-12）",
    gdpUsdBn: "约214亿美元（2025-12）",
    gdpPerCapitaUsd: "约6641美元（2025-12）",
    incomePerCapita: "约16784美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "2.1%（2025-09）",
    policyRate: "4.5%（2026-07）",
    unemployment: "20.2%（2025-12）",
    population: "约259万（2025-12）",
    employedToPop: "0.007/0.025·就业亿人/人口亿人·世行就业人口比41.0%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    currentAccount: "CA/GDP约1.8%（2025-12）；近季约992XAF - 十亿（2024-12）",
    fxTrend: "本币对美元约568（2026-08·TE货币）",
    fxHint: "约568（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约78.9%（2025-12）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "按宏观因子组续盯信贷过热与汇兑。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
    householdDebtToGdp: "约5%（2023）·家庭债务/GDP·无BIS/TE标准序列·银行个人信贷粗算",
    privCreditOrConsumer: "国内私营信贷约12% GDP（近年）·二级〔10〕",
    fxVolInYear: "±2.1%·CFA钉住欧元·沿用USD/XAF抽样高低/均价·currency-api·2025–2026",
    sectorMix: "三产分项待官方/TE续拆·对照总表三产阈值〔1〕·2026-08补录",
    fxReserves: "中非经货共同体(BEAC)共同外储池·联盟外汇约6377亿XAF/约97亿欧元（2025末·BEAC转述）·国别拆分待续核〔1〕",
    consumerConfidence: "—·TE无消费者信心序列",
  },
  US: {
    asOf: "2026-08对照·TE美国",
    gdpYoY: "2.1%（2026-06）",
    gdpUsdBn: "约30.77万亿美元（2025-12）",
    gdpPerCapitaUsd: "约67946美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约75332美元（2024）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "3.5%（2026-06）",
    policyRate: "3.75%（2026-07）",
    unemployment: "4.2%（2026-06）；青年失业约9.2%（2026-06）",
    population: "约3.42亿（2025-12）",
    employedToPop: "1.67/3.4·就业亿人/人口亿人·世行就业人口比59.5%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项208（2026-03）；制造2449；服务17665·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-3.6%（2025-12）；近季约-227十亿美元（2026-03）",
    fxReserves: "约378亿美元（2026-06）",
    fxTrend: "本币对美元约99.73（2026-08·TE货币）",
    householdDebtToGdp: "约68.1%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±0%·本币即美元·波动示意0",
    privCreditOrConsumer: "消费信贷约-0.18十亿美元（2026-05）；私营部门贷款约2895十亿美元（2026-06）",
    fxHint: "约99.73（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约123%（2025-12）",
    consumerConfidence: "约55.2（2026-07）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  CA: {
    asOf: "2026-08对照·TE加拿大",
    gdpYoY: "-0.1%（2026-03）",
    gdpUsdBn: "约2.32万亿美元（2025-12）",
    gdpPerCapitaUsd: "约45418美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约56432美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "2.8%（2026-06）",
    policyRate: "2.25%（2026-07）",
    unemployment: "6.5%（2026-06）；青年失业约12.7%（2026-06）",
    population: "约4165万（2025-12）",
    employedToPop: "0.212/0.413·就业亿人/人口亿人·世行就业人口比60.6%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项44461（2026-05）；制造199607；服务1770490·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-1.4%（2025-12）；近季约-7184CAD - 百万（2026-03）",
    fxReserves: "约1264亿美元（2026-06）",
    fxTrend: "本币对美元约1.4（2026-08·TE货币）",
    householdDebtToGdp: "约100.6%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±3.9%·年内高低相对均价粗算·Frankfurter USD/CAD·2024–2025",
    privCreditOrConsumer: "消费信贷约827701CAD - 百万（2026-05）；私营部门贷款约745025CAD - 百万（2026-05）",
    fxHint: "约1.4（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约114%（2025-12）",
    consumerConfidence: "约47.6（2026-06）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  GB: {
    asOf: "2026-08对照·TE英国",
    gdpYoY: "0.9%（2026-03）",
    gdpUsdBn: "约4.00万亿美元（2025-12）",
    gdpPerCapitaUsd: "约48422美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约52643美元（2024）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "2.6%（2026-06）",
    policyRate: "3.75%（2026-07）",
    unemployment: "4.9%（2026-05）；青年失业约14.8%（2026-05）",
    population: "约6949万（2025-12）",
    employedToPop: "0.338/0.693·就业亿人/人口亿人·世行就业人口比58.9%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项4379（2026-03）；制造56610；服务517345·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-2.4%（2025-12）；近季约-22134英镑 - 百万（2026-03）",
    fxReserves: "约2258亿美元（2026-06）",
    fxTrend: "本币对美元约1.35（2026-08·TE货币）",
    householdDebtToGdp: "约73.6%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±6.5%·年内高低相对均价粗算·Frankfurter USD/GBP·2024–2025",
    privCreditOrConsumer: "消费信贷约1807英镑 - 百万（2026-06）；私营部门贷款约2927812英镑 - 百万（2026-03）",
    fxHint: "约1.35（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约94.3%（2025-12）",
    consumerConfidence: "约-17（2026-07）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  DE: {
    asOf: "2026-08对照·TE德国",
    gdpYoY: "0.9%（2026-06）",
    gdpUsdBn: "约5.05万亿美元（2025-12）",
    gdpPerCapitaUsd: "约44147美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约65564美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "2.8%（2026-07）",
    policyRate: "2.4%（2026-07）",
    unemployment: "6.4%（2026-07）；青年失业约7.1%（2026-06）",
    population: "约8350万（2025-12）",
    employedToPop: "0.423/0.835·就业亿人/人口亿人·世行就业人口比58.8%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项6.84（2026-03）；制造168；服务138·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约4.5%（2025-12）；近季约10368欧元 - 百万（2026-05）",
    fxReserves: "约4694亿美元（2026-06）",
    fxTrend: "本币对美元约1.15（2026-08·TE货币）",
    householdDebtToGdp: "约48.9%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±7.7%·年内高低相对均价粗算·Frankfurter USD/EUR·2024–2025",
    privCreditOrConsumer: "消费信贷约236859欧元 - 百万（2026-03）；私营部门贷款约1986欧元 - 10亿（2026-03）",
    fxHint: "约1.15（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约63.5%（2025-12）",
    consumerConfidence: "约-29.6（2026-08）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  FR: {
    asOf: "2026-08对照·TE法国",
    gdpYoY: "0.7%（2026-06）",
    gdpUsdBn: "约3.37万亿美元（2025-12）",
    gdpPerCapitaUsd: "约39919美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约55091美元（2024）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "2.1%（2026-07）",
    policyRate: "2.4%（2026-07）",
    unemployment: "8.1%（2026-03）；青年失业约21.1%（2026-06）·破20%阈值",
    population: "约6908万（2025-12）",
    employedToPop: "0.295/0.686·就业亿人/人口亿人·世行就业人口比51.5%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项8127（2026-06）；制造63696；服务351800·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-0.4%（2025-12）；近季约-100欧元 - 百万（2026-05）",
    fxReserves: "355 欧元 - 10亿（2026-06）",
    fxTrend: "本币对美元约1.15（2026-08·TE货币）",
    householdDebtToGdp: "约59.7%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±7.7%·年内高低相对均价粗算·Frankfurter USD/EUR·2024–2025",
    privCreditOrConsumer: "消费信贷约1741547欧元 - 百万（2026-05）；私营部门贷款约3183795欧元 - 百万（2026-05）",
    fxHint: "约1.15（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约116%（2025-12）",
    consumerConfidence: "约86（2026-07）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  NL: {
    asOf: "2026-08对照·TE荷兰",
    gdpYoY: "1.3%（2026-06）",
    gdpUsdBn: "约1.33万亿美元（2025-12）",
    gdpPerCapitaUsd: "约51817美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约70745美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "3.1%（2026-07）",
    policyRate: "2.4%（2026-07）",
    unemployment: "3.8%（2026-06）；青年失业约8.5%（2026-06）",
    population: "约1813万（2026-12）",
    employedToPop: "0.099/0.18·就业亿人/人口亿人·世行就业人口比65.0%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项3657（2026-03）；制造25875；服务44078·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约7.6%（2025-12）；近季约26276欧元 - 百万（2026-03）",
    fxReserves: "约994亿美元（2026-06）",
    fxTrend: "本币对美元约1.15（2026-08·TE货币）",
    householdDebtToGdp: "约93.8%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±7.7%·年内高低相对均价粗算·Frankfurter USD/EUR·2024–2025",
    privCreditOrConsumer: "消费信贷约6701欧元 - 百万（2026-06）；私营部门贷款约406926欧元 - 百万（2026-06）",
    fxHint: "约1.15（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约44.4%（2025-12）",
    consumerConfidence: "约-35（2026-07）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  ES: {
    asOf: "2026-08对照·TE西班牙",
    gdpYoY: "2.7%（2026-06）",
    gdpUsdBn: "约1.91万亿美元（2025-12）",
    gdpPerCapitaUsd: "约29763美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约48454美元（2024）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "3.5%（2026-07）",
    policyRate: "2.4%（2026-07）",
    unemployment: "9.87%（2026-06）；青年失业约23.4%（2026-06）·破20%阈值",
    population: "约4957万（2025-12）",
    employedToPop: "0.218/0.488·就业亿人/人口亿人·世行就业人口比51.2%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项11774（2026-06）；制造47230；服务301559·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约2.9%（2025-12）；近季约1840欧元 - 百万（2026-05）",
    fxReserves: "约10795亿美元（2026-06）",
    fxTrend: "本币对美元约1.15（2026-08·TE货币）",
    householdDebtToGdp: "约42.8%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±7.7%·年内高低相对均价粗算·Frankfurter USD/EUR·2024–2025",
    privCreditOrConsumer: "消费信贷约667114欧元 - 百万（2026-03）；私营部门贷款约477789欧元 - 百万（2026-06）",
    fxHint: "约1.15（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约101%（2025-12）",
    consumerConfidence: "约81.2（2026-06）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  PT: {
    asOf: "2026-08对照·TE葡萄牙",
    gdpYoY: "2.5%（2026-06）",
    gdpUsdBn: "约3470亿美元（2025-12）",
    gdpPerCapitaUsd: "约22851美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约43133美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "3.03%（2026-07）",
    policyRate: "2.4%（2026-07）",
    unemployment: "5.6%（2026-06）；青年失业约18.9%（2026-06）",
    population: "约1142万（2025-12）",
    employedToPop: "0.051/0.107·就业亿人/人口亿人·世行就业人口比54.6%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项992（2026-03）；制造7332；服务9622·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约1.2%（2025-12）；近季约-633欧元 - 百万（2026-05）",
    fxReserves: "约563亿美元（2026-06）",
    fxTrend: "本币对美元约1.15（2026-08·TE货币）",
    householdDebtToGdp: "约53.9%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±7.7%·年内高低相对均价粗算·Frankfurter USD/EUR·2024–2025",
    privCreditOrConsumer: "消费信贷约150817欧元 - 百万（2026-05）；私营部门贷款约77549欧元 - 百万（2026-06）",
    fxHint: "约1.15（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约89.7%（2025-12）",
    consumerConfidence: "约-22.6（2026-07）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  IT: {
    asOf: "2026-08对照·TE意大利",
    gdpYoY: "1%（2026-06）",
    gdpUsdBn: "约2.55万亿美元（2025-12）",
    gdpPerCapitaUsd: "约34716美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约53971美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "2.8%（2026-07）",
    policyRate: "2.4%（2026-07）",
    unemployment: "5.7%（2026-06）；青年失业约18.4%（2026-06）",
    population: "约5894万（2026-12）",
    employedToPop: "0.241/0.59·就业亿人/人口亿人·世行就业人口比46.4%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项8006（2026-03）；制造71481；服务321091·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约1.1%（2025-12）；近季约594欧元 - 百万（2026-05）",
    fxReserves: "约3621亿美元（2026-06）",
    fxTrend: "本币对美元约1.15（2026-08·TE货币）",
    householdDebtToGdp: "约35.8%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±7.7%·年内高低相对均价粗算·Frankfurter USD/EUR·2024–2025",
    privCreditOrConsumer: "消费信贷约92617欧元 - 百万（2026-05）；私营部门贷款约613077欧元 - 百万（2026-05）",
    fxHint: "约1.15（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约137%（2025-12）",
    consumerConfidence: "约94.2（2026-07）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  SE: {
    asOf: "2026-08对照·TE瑞典",
    gdpYoY: "2.8%（2026-06）",
    gdpUsdBn: "约6690亿美元（2025-12）",
    gdpPerCapitaUsd: "约55014美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约65118美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "0.7%（2026-06）",
    policyRate: "1.75%（2026-07）",
    unemployment: "9.9%（2026-06）；青年失业约25.9%（2026-06）·破20%阈值",
    population: "约1061万（2026-12）",
    employedToPop: "0.047/0.106·就业亿人/人口亿人·世行就业人口比59.3%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率破8%阈值；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项25918（2026-03）；制造204711；服务806942·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约6.7%（2025-12）；近季约93.9SEK - 10亿（2026-03）",
    fxReserves: "约7208亿美元（2026-07）",
    fxTrend: "本币对美元约9.49（2026-08·TE货币）",
    householdDebtToGdp: "约82.1%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±10.8%·年内高低相对均价粗算·Frankfurter USD/SEK·2024–2025",
    privCreditOrConsumer: "私营部门贷款约1775140SEK - 百万（2026-06）；私人部门信贷约3.2%（2026-06）",
    fxHint: "约9.49（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约35.1%（2025-12）",
    consumerConfidence: "约97.1（2026-07）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  PL: {
    asOf: "2026-08对照·TE波兰",
    gdpYoY: "3.5%（2026-03）",
    gdpUsdBn: "约1.03万亿美元（2025-12）",
    gdpPerCapitaUsd: "约18707美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约44439美元（2025）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "3%（2026-07）",
    policyRate: "3.75%（2026-07）",
    unemployment: "5.8%（2026-06）；青年失业约12.6%（2026-06）",
    population: "约3633万（2026-12）",
    employedToPop: "0.156/0.366·就业亿人/人口亿人·世行就业人口比57.0%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项24552（2026-03）；制造176910·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约-0.9%（2025-12）；近季约-1071欧元 - 百万（2026-05）",
    fxReserves: "约2935亿美元（2026-06）",
    fxTrend: "本币对美元约3.72（2026-08·TE货币）",
    householdDebtToGdp: "约22.1%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±8.2%·年内高低相对均价粗算·Frankfurter USD/PLN·2024–2025",
    privCreditOrConsumer: "消费信贷约861477PLN - 百万（2026-06）；私营部门贷款约467203PLN - 百万（2026-06）",
    fxHint: "约3.72（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约59.7%（2025-12）",
    consumerConfidence: "约-10.2（2026-07）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  IE: {
    asOf: "2026-08对照·TE爱尔兰",
    gdpYoY: "-1.6%（2026-06）",
    gdpUsdBn: "约7220亿美元（2025-12）",
    gdpPerCapitaUsd: "约104417美元（2025-12）·过12000成熟阈值",
    incomePerCapita: "约88346美元（2024）·世行GNI/人PPP·OWID转载·非住户可支配收入",
    inflation: "3.4%（2026-06）",
    policyRate: "2.4%（2026-07）",
    unemployment: "5%（2026-06）；青年失业约10.8%（2026-06）",
    population: "约551万（2026-12）",
    employedToPop: "0.025/0.054·就业亿人/人口亿人·世行就业人口比62.2%(2024)×15+人口",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率未破8%；非正式就业/青年失业待ILO交叉",
    sectorMix: "农业分项1486（2026-03）；制造34812；服务32736·占GDP比重待续拆·对照三产阈值",
    currentAccount: "CA/GDP约8.2%（2025-12）；近季约17442欧元 - 百万（2026-03）",
    fxReserves: "约118亿美元（2026-06）",
    fxTrend: "本币对美元约1.15（2026-08·TE货币）",
    householdDebtToGdp: "约23.8%（2025-Q4）·家庭债务/GDP·BIS·WS_TC家庭信贷/GDP",
    fxVolInYear: "±7.7%·年内高低相对均价粗算·Frankfurter USD/EUR·2024–2025",
    privCreditOrConsumer: "消费信贷约14532欧元 - 百万（2026-06）；私营部门贷款约28615欧元 - 百万（2026-06）",
    fxHint: "约1.15（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约32.9%（2025-12）",
    consumerConfidence: "约61.6（2026-07）",
    creditNote: "信贷过热组：家庭债务/非银增速/NPL/多头以监管与征信续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值。准入先过牌照/利率上限与锁汇评估（对照总表预警）。",
  },
  RU: {
    asOf: "2026-08对照·TE俄罗斯",
    gdpYoY: "-0.2%（2026-03）；全年增长预期约0–1%（央行基线）",
    gdpUsdBn: "约25610亿美元（2025-12）",
    gdpPerCapitaUsd: "约17540美元（2025-12·名义GDP/人口粗算）·过12000成熟阈值",
    incomePerCapita: "约42358美元（2025-12）·TE GDP/人PPP·非住户可支配收入",
    inflation: "6%（2026-06）",
    policyRate: "14%（2026-07）·俄央行关键利率",
    unemployment: "2.2%（2026-06）",
    population: "约1.46亿（2025-12）",
    employedToPop: "0.748/1.46·就业亿人/人口亿人·就业约7480万(2026-06)·就业率约61.6%",
    ageStructure: "18–45占成年人口·待联合国年龄结构续采",
    employmentNote: "官方失业率极低；劳动力紧张与制裁下部门错配待ILO交叉",
    sectorMix: "农业/制造/采矿分项待续拆·资源与军工权重高·对照三产阈值",
    currentAccount: "CA/GDP约2%（2025-12）；近季约122亿美元（2026-03）",
    fxReserves: "约7204亿美元（2026-06）",
    fxTrend: "本币对美元约82.3（2026-08·TE货币）",
    householdDebtToGdp: "约21.4%（2025-Q4）·家庭债务/GDP·TE/BIS",
    fxVolInYear: "±18%·年内高低相对均价粗算·USD/RUB·2025–2026",
    privCreditOrConsumer: "消费信贷约368286卢布 - 亿（2026-05）；对私贷款利率约17.2%（2026-05）",
    fxHint: "约82.3（TE货币·2026-08）",
    debtToGdp: "政府债务/GDP约18.3%（2025-12）",
    consumerConfidence: "约-13（2026-06）",
    creditNote: "信贷过热组：家庭杠杆不高但政策利率高企；制裁/结算/合规与本地牌照续核；此处为TE可核验水位。",
    cashLoanVerdict: "人均GDP过成熟阈值，但高利率+制裁合规成本主导。准入先过本地牌照、结算通道与锁汇评估（对照总表预警）。",
  },
};

function teIndicatorsUrl(code: Exclude<CountryCode, "all">): string | null {
  const slug = TE_SLUG[code];
  if (!slug) return null;
  return `https://zh.tradingeconomics.com/${slug}/indicators`;
}

/**
 * 中国货币网（中国外汇交易中心）· 国内债券/本币市场长期信源。
 * 用途：核验银行间债券发行、流通上市、付息兑付、评级、ABN/债务融资工具披露；与交易所ABS交叉。
 * 全文检索示例：大兴安岭 → /chinese/qwjsn/?searchValue=（双 encodeURI）
 * @see https://www.chinamoney.com.cn/chinese/qwjsn/?searchValue=%25E5%25A4%25A7%25E5%2585%25B4%25E5%25AE%2589%25E7%258E%25B2
 * @see https://www.chinamoney.org.cn/chinese/lszqfxlm/
 */
const CHINAMONEY_BOND = {
  name: "中国货币网（ChinaMoney / CFETS）",
  home: "https://www.chinamoney.com.cn/chinese/",
  homeAlt: "https://www.chinamoney.org.cn/chinese/",
  searchPath: "/chinese/qwjsn/?searchValue=",
  menus: {
    issue: "https://www.chinamoney.org.cn/chinese/lszqfxlm/",
    listing: "https://www.chinamoney.org.cn/chinese/lsltsslm/",
    coupon: "https://www.chinamoney.org.cn/chinese/lsfxdflm/",
    rating: "https://www.chinamoney.org.cn/chinese/lspjbglm/",
  },
  note:
    "银行间市场债券信息披露主站；部分全文检索/明细需登录。CN 侧 ABS·ABN·企业债与债务融资工具优先在此与中登/交易所交叉。勿粘贴付费终端全文。",
  learned: [
    {
      query: "大兴安岭",
      issuer: "大兴安岭林业集团公司",
      bond: "2012年大兴安岭林业集团公司企业债券（12兴林业 / 12兴安林业债）",
      size: "13亿元",
      tenor: "7年",
      coupon: "固定利率7.08%",
      codes: "上交所122508；银行间1280342",
      useOfProceeds: "大兴安岭重点国有林区2011年棚户区改造",
      status: "已到期/提前兑付路径（2017年起分次提前偿还；非消费贷ABS）",
      sources: "上交所债券年报/持有人会议公告；中国货币网检索交叉",
      atlasNote: "示例：货币网全文检索可落到发行人历史企业债；消费场景信贷ABS/ABN须另按系列名检索，勿与地方企业债混同。",
    },
  ],
} as const;

function chinamoneySearchUrl(keyword: string): string {
  const enc = encodeURIComponent(encodeURIComponent(keyword));
  return `https://www.chinamoney.com.cn/chinese/qwjsn/?searchValue=${enc}`;
}


function resolveEcoRoles(
  line: CreditRow["line"],
  draft?: Partial<Pick<CreditRow, "ecoRoles" | "note" | "brands" | "institutionTypes">>,
): EcoRole[] {
  if (draft?.ecoRoles?.length) return ECO_ROLE_ORDER.filter((r) => draft.ecoRoles!.includes(r));
  if (draft?.institutionTypes?.length) {
    return ECO_ROLE_ORDER.filter((r) => draft.institutionTypes!.includes(r));
  }
  if (line === "agent") return ["流量服务商"];
  return [];
}

function resolveInstitutionTypes(
  kind: "scene" | "credit",
  line?: CreditRow["line"],
  draft?: InstitutionType[],
  ecoRoles?: EcoRole[],
): InstitutionType[] {
  if (draft?.length) return INSTITUTION_TYPE_ORDER.filter((t) => draft.includes(t));
  const out = new Set<InstitutionType>();
  if (kind === "scene") {
    out.add("玩家");
  } else if (line === "agent") {
    out.add("流量服务商");
  } else {
    out.add("玩家");
  }
  for (const r of ecoRoles ?? []) out.add(r);
  return INSTITUTION_TYPE_ORDER.filter((t) => out.has(t));
}

function inferSourceChannels(
  verify: VerifyStatus,
  trafficRank: string,
  licenseReg: string,
  claimed = false,
): SourceChannel[] {
  const out = new Set<SourceChannel>();
  if (verify === "双端通过" || verify === "仅流量" || hasTrafficSignal(trafficRank)) out.add("流量源");
  if (verify === "双端通过" || verify === "仅监管" || hasLicenseSignal(licenseReg)) out.add("监管源");
  if (claimed) out.add("经办认领");
  return SOURCE_CHANNEL_ORDER.filter((c) => out.has(c));
}

/** 信贷横切标签：与三产品线正交，一玩家可兼发信用卡等 */
const CREDIT_TAG_ORDER: CreditTag[] = ["信用卡"];

const CREDIT_TAG_LABEL: Record<CreditTag, string> = {
  信用卡: "信用卡",
};

/**
 * 已知发信用卡/贷记卡或明确卡产品的信贷玩家（可与现金贷/分期/租赁/中介并存）。
 * 未列入者仍可能经文案推断命中「信用卡」。
 */
const CREDIT_TAGS_BY_GROUP: Record<string, CreditTag[]> = {
  "Nubank（Nubank·BR）": ["信用卡"],
  "Klarna（Klarna·EU）": ["信用卡"],
  "Affirm（Affirm·US）": ["信用卡"],
  "Tabby（Tabby·GCC）": ["信用卡"],
  "Tamara（Tamara·GCC）": ["信用卡"],
  "AEON Credit Service/AEON Credit（AEON·MY）": ["信用卡"],
  "Easy Buy（Easy Buy·TH）": ["信用卡"],
  "Upstart（Upstart·US）": ["信用卡"],
  "DiDi Finanzas/DiDi（滴滴·MX）": ["信用卡"],
  "Kredivo/FinAccel（Kredivo·ID）": ["信用卡"],
  "Afterpay/Block（Afterpay·US）": ["信用卡"],
  "FE Credit（FE·VN）": ["信用卡"],
  "Home Credit Vietnam（Home Credit·VN）": ["信用卡"],
  "Bank Neo Commerce/Neo Pinjam（BNC·ID）": ["信用卡"],
  "SoFi Lending": ["信用卡"],
  MoneyLion: ["信用卡"],
  Dave: ["信用卡"],
  "Uni Cards": ["信用卡"],
  Slice: ["信用卡"],
  "Naranja X": ["信用卡"],
  "Ualá卡分期": ["信用卡"],
  "Falabella CMR": ["信用卡"],
  "Synchrony零售卡": ["信用卡"],
  "招商银行+中国联通｜招联｜招联（招联·CN）": ["信用卡"],
  "中原银行｜中原消费｜中原银行（中原·CN）": ["信用卡"],
  "中国邮政｜中邮消费｜中国邮政（中邮·CN）": ["信用卡"],
  "Bajaj Finance": ["信用卡"],
  "Tata Capital": ["信用卡"],
  "Credit Card Matcher（·BR）": ["信用卡"],
  "Credit Card Easy approval（·ZA）": ["信用卡"],
  "novücard（·BR）": ["信用卡"],
};

function inferCreditTags(parts: string[]): CreditTag[] {
  const s = parts.join(" ");
  // 避免把「白条/花呗/Pay Later」等分期误标为信用卡
  if (/花呗|白条|分付|Pay\s*Later|Pay in \d|BNPL/i.test(s) && !/信用卡|Credit Card|发卡|贷记卡/i.test(s)) {
    return [];
  }
  if (/信用卡|贷记卡|发卡|Card Issuer|Credit Card|CMR信用卡|NeuCard|novücard/i.test(s)) {
    return ["信用卡"];
  }
  return [];
}

function resolveCreditTags(
  group: string,
  draft?: Partial<Pick<CreditRow, "tags" | "brands" | "licenses" | "note" | "diandian">>,
): CreditTag[] {
  if (CREDIT_TAGS_BY_GROUP[group]?.length) return CREDIT_TAGS_BY_GROUP[group];
  if (draft?.tags?.length) return CREDIT_TAG_ORDER.filter((t) => draft.tags!.includes(t));
  return inferCreditTags([
    group,
    draft?.brands ?? "",
    draft?.licenses ?? "",
    draft?.note ?? "",
    draft?.diandian ?? "",
  ]);
}

const SCENE_TAG_ORDER: SceneTag[] = [
  "电商",
  "出行",
  "外卖",
  "社交",
  "支付钱包",
  "游戏",
  "直播",
  "信用管理",
  "金融",
  "艺术",
  "内容资讯",
  "企业服务",
  "法律服务",
  "本地生活",
  "在线教育",
  "在线医疗",
  "Web3",
];

const SCENE_TAG_LABEL: Record<SceneTag, string> = {
  电商: "电商",
  出行: "出行",
  外卖: "外卖",
  社交: "社交",
  支付钱包: "支付钱包",
  游戏: "游戏",
  直播: "直播",
  信用管理: "信用管理",
  金融: "金融",
  艺术: "艺术",
  内容资讯: "内容资讯",
  企业服务: "企业服务",
  法律服务: "法律服务",
  本地生活: "本地生活",
  在线教育: "在线教育",
  在线医疗: "在线医疗",
  Web3: "Web3",
};

/** 场景二级（对齐大宽表 + Web3）；历史「侨汇」→「跨境支付/汇款」 */
const SCENE_SUB_ORDER: SceneSubTag[] = [
  "综合电商",
  "垂直电商",
  "社交电商",
  "跨境电商",
  "二手/闲置",
  "网约车",
  "顺风车/拼车",
  "共享单车/电单车",
  "地图/导航",
  "代驾",
  "餐饮外卖",
  "即时零售/闪购",
  "生鲜电商",
  "药品配送",
  "即时通讯",
  "社区/论坛",
  "陌生人社交",
  "职场社交",
  "婚恋/相亲",
  "移动支付",
  "跨境支付/汇款",
  "数字银行/虚拟账户",
  "预付卡/储值",
  "聚合支付",
  "手游",
  "端游/页游",
  "云游戏",
  "游戏平台/分发",
  "电竞/赛事",
  "娱乐直播",
  "游戏直播",
  "电商直播/带货",
  "教育直播",
  "企业直播/会议",
  "征信查询",
  "信用评分/画像",
  "反欺诈服务",
  "债务管理/催收",
  "短视频",
  "中长视频/流媒体",
  "新闻资讯/聚合",
  "知识付费/专栏",
  "播客/音频",
  "企业通讯/协同",
  "项目管理",
  "云存储/云服务",
  "在线文档/表格",
  "电子签章",
  "电子合同",
  "在线公证/存证",
  "法律咨询/智能法务",
  "到店团购",
  "酒店/民宿预订",
  "票务/电影/演出",
  "家政/保洁服务",
  "美容/美发预约",
  "K12学科辅导",
  "语言学习",
  "职业教育/考证",
  "兴趣/素质教育",
  "企业培训/SaaS化",
  "在线问诊",
  "药品电商/配送",
  "健康管理/慢病",
  "心理咨询",
  "体检预约",
  "中心化交易所（CEX）",
  "去中心化交易所（DEX）",
  "NFT交易市场",
  "自托管钱包",
  "托管钱包",
  "硬件钱包",
  "借贷协议",
  "稳定币兑换/持有",
  "质押生息",
  "流动性挖矿",
  "链游玩赚",
  "游戏资产交易",
  "游戏公会参与",
  "去中心化社交",
  "创作者代币",
  "内容打赏",
  "PFP头像/身份",
  "音乐/艺术收藏",
  "品牌会员/权益",
  "票务/入场凭证",
  "稳定币汇款",
  "加密货币支付",
  "抗通胀储蓄",
];

const SCENE_SUB_LABEL: Record<SceneSubTag, string> = Object.fromEntries(
  SCENE_SUB_ORDER.map((t) => [t, t]),
) as Record<SceneSubTag, string>;

const SCENE_SUB_PARENT: Record<SceneSubTag, SceneTag> = {
  "综合电商": "电商",
  "垂直电商": "电商",
  "社交电商": "电商",
  "跨境电商": "电商",
  "二手/闲置": "电商",
  "网约车": "出行",
  "顺风车/拼车": "出行",
  "共享单车/电单车": "出行",
  "地图/导航": "出行",
  "代驾": "出行",
  "餐饮外卖": "外卖",
  "即时零售/闪购": "外卖",
  "生鲜电商": "外卖",
  "药品配送": "外卖",
  "即时通讯": "社交",
  "社区/论坛": "社交",
  "陌生人社交": "社交",
  "职场社交": "社交",
  "婚恋/相亲": "社交",
  "移动支付": "支付钱包",
  "跨境支付/汇款": "支付钱包",
  "数字银行/虚拟账户": "支付钱包",
  "预付卡/储值": "支付钱包",
  "聚合支付": "支付钱包",
  "手游": "游戏",
  "端游/页游": "游戏",
  "云游戏": "游戏",
  "游戏平台/分发": "游戏",
  "电竞/赛事": "游戏",
  "娱乐直播": "直播",
  "游戏直播": "直播",
  "电商直播/带货": "直播",
  "教育直播": "直播",
  "企业直播/会议": "直播",
  "征信查询": "信用管理",
  "信用评分/画像": "信用管理",
  "反欺诈服务": "信用管理",
  "债务管理/催收": "信用管理",
  "短视频": "内容资讯",
  "中长视频/流媒体": "内容资讯",
  "新闻资讯/聚合": "内容资讯",
  "知识付费/专栏": "内容资讯",
  "播客/音频": "内容资讯",
  "企业通讯/协同": "企业服务",
  "项目管理": "企业服务",
  "云存储/云服务": "企业服务",
  "在线文档/表格": "企业服务",
  "电子签章": "法律服务",
  "电子合同": "法律服务",
  "在线公证/存证": "法律服务",
  "法律咨询/智能法务": "法律服务",
  "到店团购": "本地生活",
  "酒店/民宿预订": "本地生活",
  "票务/电影/演出": "本地生活",
  "家政/保洁服务": "本地生活",
  "美容/美发预约": "本地生活",
  "K12学科辅导": "在线教育",
  "语言学习": "在线教育",
  "职业教育/考证": "在线教育",
  "兴趣/素质教育": "在线教育",
  "企业培训/SaaS化": "在线教育",
  "在线问诊": "在线医疗",
  "药品电商/配送": "在线医疗",
  "健康管理/慢病": "在线医疗",
  "心理咨询": "在线医疗",
  "体检预约": "在线医疗",
  "中心化交易所（CEX）": "金融",
  "去中心化交易所（DEX）": "金融",
  "NFT交易市场": "艺术",
  "自托管钱包": "金融",
  "托管钱包": "金融",
  "硬件钱包": "金融",
  "借贷协议": "金融",
  "稳定币兑换/持有": "金融",
  "质押生息": "金融",
  "流动性挖矿": "金融",
  "链游玩赚": "游戏",
  "游戏资产交易": "游戏",
  "游戏公会参与": "游戏",
  "去中心化社交": "社交",
  "创作者代币": "社交",
  "内容打赏": "社交",
  "PFP头像/身份": "艺术",
  "音乐/艺术收藏": "艺术",
  "品牌会员/权益": "艺术",
  "票务/入场凭证": "艺术",
  "稳定币汇款": "金融",
  "加密货币支付": "金融",
  "抗通胀储蓄": "金融",
};

/** 偏 B 端能力：不作线上数字经济 To C 场景词条，归生态角色·风控服务方 */
const SCENE_SUBS_B2B_RISK: ReadonlySet<SceneSubTag> = new Set([
  "信用评分/画像",
  "反欺诈服务",
]);

function sceneSubsForTag(tag: SceneTag | "all"): SceneSubTag[] {
  if (tag === "all") return [];
  return SCENE_SUB_ORDER.filter(
    (s) => SCENE_SUB_PARENT[s] === tag && !SCENE_SUBS_B2B_RISK.has(s),
  );
}

/** 信用租赁二级场景 */
const LEASE_SUB_ORDER: LeaseSubTag[] = ["游戏租赁"];
const LEASE_SUB_LABEL: Record<LeaseSubTag, string> = { 游戏租赁: "游戏租赁" };

/**
 * 已知挂「跨境支付/汇款」二级的支付钱包玩家（自动确保一级含支付钱包）。
 */
const SCENE_SUBS_BY_GROUP: Record<string, SceneSubTag[]> = {
  "蚂蚁集团/支付宝（蚂蚁·CN）": ["跨境支付/汇款"],
  "Wise/Wise（Wise·US）": ["跨境支付/汇款"],
  "Remitly/Remitly（Remitly·US）": ["跨境支付/汇款"],
  "Western Union/Western Union（西联·US）": ["跨境支付/汇款"],
  "MoneyGram/MoneyGram（速汇金·US）": ["跨境支付/汇款"],
  "WorldRemit/WorldRemit（WorldRemit·US）": ["跨境支付/汇款"],
  "Safaricom/M-Pesa（M-Pesa·KE）": ["跨境支付/汇款"],
  GCash: ["跨境支付/汇款"],
  "GCash（·SEA）": ["跨境支付/汇款"],
  PayPal: ["跨境支付/汇款"],
  "PayPal（·US）": ["跨境支付/汇款"],
};

/** 按集团名强制多标签（覆盖推断；一玩家可多场景） */
const SCENE_TAGS_BY_GROUP: Record<string, SceneTag[]> = {
  "蚂蚁集团/支付宝（蚂蚁·CN）": ["支付钱包"],
  "腾讯控股/微信（腾讯·CN）": ["社交", "支付钱包", "游戏"],
  "美团（美团·CN）": ["外卖", "出行", "本地生活"],
  "京东集团/京东（京东·CN）": ["电商"],
  "滴滴出行/滴滴（滴滴·CN）": ["出行"],
  "Sea Limited/Shopee（Sea·SEA）": ["电商", "游戏", "支付钱包", "外卖"],
  "Grab Holdings/Grab（Grab·SEA）": ["出行", "外卖", "支付钱包", "信用管理"],
  "GoTo/Gojek（GoTo·ID）": ["出行", "外卖", "支付钱包"],
  "Delivery Hero/Foodpanda（Foodpanda·SEA）": ["外卖"],
  "Xanh SM（Xanh SM·VN）": ["出行", "外卖"],
  "Lazada/Lazada（Lazada·SEA）": ["电商"],
  "Akulaku/Akulaku（阿卡拉克·SEA）": ["电商", "支付钱包"],
  "PhonePe/PhonePe（PhonePe·IN）": ["支付钱包"],
  "One97/Paytm（Paytm·IN）": ["支付钱包"],
  "Flipkart/Flipkart（Flipkart·IN）": ["电商"],
  "DiDi/99（滴滴·LATAM）": ["出行", "外卖", "支付钱包"],
  "Uber（Uber·LATAM）": ["出行", "外卖"],
  "iFood（iFood·BR）": ["外卖"],
  "PedidosYa（PedidosYa·LATAM）": ["外卖"],
  "Cabify（Cabify·LATAM）": ["出行"],
  "inDrive（inDrive·LATAM）": ["出行"],
  "Yape（Yape·PE）": ["支付钱包"],
  "Clip（Clip·MX）": ["支付钱包"],
  "Americanas（Americanas·BR）": ["电商"],
  "Linio（Linio·LATAM）": ["电商"],
  "Shein LatAm（Shein·LATAM）": ["电商"],
  "Kwai América Latina（快手·LATAM）": ["直播", "社交"],
  "ByteDance/TikTok LatAm（字节·LATAM）": ["直播", "社交"],
  "Garena Free Fire（Free Fire·LATAM）": ["游戏"],
  "Kaspi.kz（Kaspi·KZ）": ["电商", "支付钱包"],
  "Uzum（Uzum·UZ）": ["电商"],
  "Click（Click·UZ）": ["支付钱包"],
  "Payme（Payme·UZ）": ["支付钱包"],
  "inDrive（inDrive·KZ）": ["出行"],
  "LendMN（LendMN·MN）": ["支付钱包"],
  "Hipay（Hipay·MN）": ["支付钱包"],
  "Pocket/InvesCore（Pocket·MN）": ["支付钱包"],
  "Ard App/Ard Credit（Ard·MN）": ["支付钱包"],
  "Shoppy.mn（Shoppy·MN）": ["电商"],
  "Storepay（Storepay·MN）": ["电商", "支付钱包"],
  "Simple（Simple·MN）": ["电商", "支付钱包"],
  "Mercado Libre/Mercado Libre（美卡多·LATAM）": ["电商", "支付钱包", "信用管理"],
  "Rappi/Rappi（Rappi·LATAM）": ["外卖", "支付钱包"],
  "Safaricom/M-Pesa（M-Pesa·KE）": ["支付钱包"],
  "OPay/OPay（OPay·NG）": ["支付钱包"],
  "Amazon/Amazon（亚马逊·US）": ["电商", "信用管理"],
  "Block/Cash App（Block·US）": ["支付钱包", "信用管理"],
  "拼多多（拼多多·CN）": ["电商"],
  "字节跳动/抖音（抖音·CN）": ["直播", "电商", "社交"],
  "ByteDance/TikTok（字节·SEA）": ["直播", "电商", "社交"],
  "快手（快手·CN）": ["直播", "电商"],
  "广州华人/Badam Live（巴旦木·CN）": ["直播"],
  "赤子城科技/MICO（赤子城·MENA）": ["直播", "社交"],
  "小红书（小红书·CN）": ["社交", "电商"],
  "阿里巴巴/淘宝天猫（淘宝·CN）": ["电商"],
  "饿了么（饿了么·CN）": ["外卖"],
  "携程（携程·CN）": ["出行"],
  "飞猪（飞猪·CN）": ["出行"],
  "哈啰（哈啰·CN）": ["出行"],
  "云闪付（云闪付·CN）": ["支付钱包"],
  "唯品会（唯品会·CN）": ["电商"],
  "苏宁易购（苏宁·CN）": ["电商"],
  "闲鱼（闲鱼·CN）": ["电商"],
  "高德（高德·CN）": ["出行"],
  Tokopedia: ["电商"],
  Traveloka: ["出行"],
  MoMo: ["支付钱包"],
  ZaloPay: ["支付钱包"],
  Dana: ["支付钱包"],
  OVO: ["支付钱包"],
  GCash: ["支付钱包"],
  Maya: ["支付钱包"],
  TrueMoney: ["支付钱包"],
  "Amazon India": ["电商"],
  Myntra: ["电商"],
  Ola: ["出行"],
  "Amazon Pay": ["支付钱包"],
  "Google Pay India（Google Pay·IN）": ["支付钱包"],
  "YONO SBI（·IN）": ["支付钱包"],
  "Airtel Thanks（·IN）": ["支付钱包"],
  JioMart: ["电商"],
  BharatPe: ["支付钱包"],
  Mobikwik: ["支付钱包"],
  Freecharge: ["支付钱包"],
  "Airtel Thanks": ["支付钱包"],
  "Tata Neu": ["电商", "支付钱包", "信用管理"],
  "Magazine Luiza": ["电商", "信用管理"],
  "Shopee Brasil": ["电商"],
  "Amazon Brasil": ["电商", "信用管理"],
  PicPay: ["支付钱包"],
  PagBank: ["支付钱包", "信用管理"],
  "Casas Bahia": ["电商", "信用管理"],
  Falabella: ["电商", "信用管理"],
  Liverpool: ["电商", "信用管理"],
  Coppel: ["电商", "信用管理"],
  Nequi: ["支付钱包"],
  DaviPlata: ["支付钱包"],
  Ualá: ["支付钱包", "信用管理"],
  Jumia: ["电商"],
  Noon: ["电商"],
  Wave: ["支付钱包"],
  "Airtel Money": ["支付钱包"],
  "MTN MoMo": ["支付钱包"],
  "Orange Money": ["支付钱包"],
  PalmPay: ["支付钱包"],
  "STC Pay": ["支付钱包"],
  Urpay: ["支付钱包"],
  Walmart: ["电商", "信用管理"],
  Target: ["电商", "信用管理"],
  Venmo: ["支付钱包"],
  PayPal: ["支付钱包", "信用管理"],
  "Apple Wallet": ["支付钱包", "信用管理"],
  Shopify: ["电商"],
  Revolut: ["支付钱包", "信用管理"],
  "Wise/Wise（Wise·US）": ["支付钱包"],
  "Remitly/Remitly（Remitly·US）": ["支付钱包"],
  "Western Union/Western Union（西联·US）": ["支付钱包"],
  "MoneyGram/MoneyGram（速汇金·US）": ["支付钱包"],
  "WorldRemit/WorldRemit（WorldRemit·US）": ["支付钱包"],
};

type PlatformBizDepth = "core" | "extend";

/**
 * 一级场景业务深度（●核心 ○扩展）。未列出的标签：若 trafficRank 有●○则用之，否则默认●。
 * 多场景平台务必写全，避免只显示词条不标深度。
 */
const SCENE_TAG_DEPTH_BY_GROUP: Record<string, Partial<Record<SceneTag, PlatformBizDepth>>> = {
  "蚂蚁集团/支付宝（蚂蚁·CN）": { 支付钱包: "core" },
  "腾讯控股/微信（腾讯·CN）": { 社交: "core", 支付钱包: "core", 游戏: "core" },
  "美团（美团·CN）": { 外卖: "core", 本地生活: "core", 出行: "extend" },
  "京东集团/京东（京东·CN）": { 电商: "core" },
  "滴滴出行/滴滴（滴滴·CN）": { 出行: "core" },
  "Sea Limited/Shopee（Sea·SEA）": { 电商: "core", 游戏: "core", 外卖: "extend", 支付钱包: "extend" },
  "Grab Holdings/Grab（Grab·SEA）": {
    出行: "core",
    外卖: "core",
    支付钱包: "core",
    信用管理: "extend",
  },
  "GoTo/Gojek（GoTo·ID）": { 出行: "core", 外卖: "core", 支付钱包: "extend" },
  "Delivery Hero/Foodpanda（Foodpanda·SEA）": { 外卖: "extend" },
  "Xanh SM（Xanh SM·VN）": { 出行: "core", 外卖: "extend" },
  "Lazada/Lazada（Lazada·SEA）": { 电商: "core" },
  "Akulaku/Akulaku（阿卡拉克·SEA）": { 电商: "core", 支付钱包: "extend" },
  "PhonePe/PhonePe（PhonePe·IN）": { 支付钱包: "core" },
  "One97/Paytm（Paytm·IN）": { 支付钱包: "core" },
  "Flipkart/Flipkart（Flipkart·IN）": { 电商: "core" },
  "DiDi/99（滴滴·LATAM）": { 出行: "core", 外卖: "core", 支付钱包: "extend" },
  "Uber（Uber·LATAM）": { 出行: "core", 外卖: "extend" },
  "Kwai América Latina（快手·LATAM）": { 直播: "core", 社交: "extend" },
  "ByteDance/TikTok LatAm（字节·LATAM）": { 直播: "core", 社交: "extend" },
  "Kaspi.kz（Kaspi·KZ）": { 电商: "core", 支付钱包: "core" },
  "Mercado Libre/Mercado Libre（美卡多·LATAM）": {
    电商: "core",
    支付钱包: "core",
    信用管理: "extend",
  },
  "Rappi/Rappi（Rappi·LATAM）": { 外卖: "core", 支付钱包: "core" },
  "Safaricom/M-Pesa（M-Pesa·KE）": { 支付钱包: "core" },
  "OPay/OPay（OPay·NG）": { 支付钱包: "core" },
  "Amazon/Amazon（亚马逊·US）": { 电商: "core", 信用管理: "extend" },
  "Block/Cash App（Block·US）": { 支付钱包: "core", 信用管理: "extend" },
  "字节跳动/抖音（抖音·CN）": { 直播: "core", 电商: "core", 社交: "extend" },
  "ByteDance/TikTok（字节·SEA）": { 直播: "core", 电商: "core", 社交: "extend" },
  "快手（快手·CN）": { 直播: "core", 电商: "extend" },
  "赤子城科技/MICO（赤子城·MENA）": { 直播: "core", 社交: "extend" },
  "小红书（小红书·CN）": { 社交: "core", 电商: "extend" },
  "饿了么（饿了么·CN）": { 外卖: "core" },
  Walmart: { 电商: "core", 信用管理: "extend" },
  Target: { 电商: "core", 信用管理: "extend" },
  PayPal: { 支付钱包: "core", 信用管理: "extend" },
  "Apple Wallet": { 支付钱包: "core", 信用管理: "extend" },
  Revolut: { 支付钱包: "core", 信用管理: "extend" },
};

function formatSceneTags(tags: SceneTag[], subTags: SceneSubTag[] = []): string {
  return SCENE_TAG_ORDER.filter((t) => tags.includes(t))
    .map((t) => {
      const kids = SCENE_SUB_ORDER.filter(
        (s) => subTags.includes(s) && SCENE_SUB_PARENT[s] === t,
      ).map((s) => SCENE_SUB_LABEL[s]);
      return kids.length ? `${SCENE_TAG_LABEL[t]}/${kids.join("·")}` : SCENE_TAG_LABEL[t];
    })
    .join(" · ");
}

function formatLeaseLine(_leaseSubs: LeaseSubTag[]): string {
  // 已取消租赁二级分类；统一展示信用租赁
  return LINE_LABEL.lease;
}

const LICENSE_KIND_ORDER: LicenseKind[] = ["银行", "保险", "支付", "消金小贷", "其他"];
const LICENSE_KIND_LABEL: Record<LicenseKind, string> = {
  银行: "银行",
  保险: "保险",
  支付: "支付",
  消金小贷: "消金/小贷等",
  其他: "其他牌照",
};

/**
 * 牌照粗类只认「已持有」表述，不认合作/导流/分发/申请中。
 * 「非银行支付」等含「银行」字样的否定/合作语境不得命中银行牌照。
 * 「其他」仅限可识别的非四类牌照（证券/租赁/征信等）；信息不详不归「其他」。
 */
function heldLicenseBlob(...parts: string[]): string {
  const raw = parts.filter(Boolean).join(" ");
  const cut = raw.search(/申请中|拟申请|申请：/);
  const held = cut >= 0 ? raw.slice(0, cut) : raw;
  return held
    .replace(/非银行/gi, "NONBANK")
    .replace(
      /银行合作|合作银行|银行伙伴|银行导流|银行分发|银行\/持牌|持牌机构分发|多为银行|银行信贷|导流银行|银行通道/g,
      "PARTNER",
    );
}

function inferLicenseKinds(...parts: string[]): LicenseKind[] {
  const s = heldLicenseBlob(...parts);
  const out = new Set<LicenseKind>();
  if (
    /银行牌照|商业银行|数字银行|吸储|持牌银行|Bank\s*licen[cs]e|digital\s*bank/i.test(s)
  ) {
    out.add("银行");
  }
  if (/保险牌照|保险公司|保险经纪|保险代理|财险|寿险|insurer|Insurance\s*licen/i.test(s))
    out.add("保险");
  if (
    /支付|Payment|e-?money|电子货币|钱包牌|NONBANK支付|UPI|PSP|发卡行合作支付/i.test(s)
  )
    out.add("支付");
  if (
    /消金|小贷|助贷|借贷|信贷\(|P2P|SOFOM|SOFIPO|NBFC|OLP|融资公司|金融公司|Multifinance|LPBBTI|CoR|Lending|放贷|消费金融/i.test(
      s,
    )
  )
    out.add("消金小贷");
  if (
    /证券|基金销售|基金代销|信托|融资租赁|金融租赁|融资租赁牌|征信|保理|期货|资管计划|货币经纪|典当|拍卖|融资担保|担保牌照/i.test(
      s,
    )
  ) {
    out.add("其他");
  }
  return LICENSE_KIND_ORDER.filter((k) => out.has(k));
}

function resolveLicenseKinds(
  draft?: LicenseKind[],
  ...parts: string[]
): LicenseKind[] {
  if (draft?.length) return LICENSE_KIND_ORDER.filter((k) => draft.includes(k));
  return inferLicenseKinds(...parts);
}

function inferSceneTags(text: string, group?: string): SceneTag[] {
  const s = `${group ?? ""} ${text}`;
  const out = new Set<SceneTag>();
  if (/电商|零售|商城|二手|购物|Marketplace|E-?commerce|标杆|跨境|Shopify|PayPal/i.test(s))
    out.add("电商");
  if (/出行|打车|地图|两轮|航旅|旅游|Travel|Ride/i.test(s)) out.add("出行");
  if (/外卖|即时配送|Food|Delivery/i.test(s)) out.add("外卖");
  if (/社交|微信|社区|Social/i.test(s)) out.add("社交");
  if (
    /支付|钱包|UPI|移动货币|P2P|数字银行|Wallet|Money|Pay(?!ment Bank)|侨汇|汇款|Remit/i.test(s)
  )
    out.add("支付钱包");
  if (/游戏|Game|Free Fire|PUBG/i.test(s) && !/链游|GameFi|Web3/i.test(s)) out.add("游戏");
  if (/直播|抖音|快手|TikTok|Badam|巴旦木|赤子城|MICO|Kwai|Live/i.test(s) && !/短视频内容/i.test(s))
    out.add("直播");
  const looksBnplOnly =
    /花呗|白条|分付|月付|Pay\s*Later|Pay in \d|BNPL/i.test(s) &&
    !/信用卡|贷记卡|Credit Card|发卡|CMR|NeuCard|Apple Card|RedCard/i.test(s);
  if (
    !looksBnplOnly &&
    /信用卡|贷记卡|发卡|Credit Card|CMR信用卡|NeuCard|Apple Card|RedCard|Grab Card|征信查询|个人征信/i.test(s)
  ) {
    out.add("信用管理");
  }
  if (/短视频|流媒体|新闻资讯|知识付费|播客|内容资讯/i.test(s)) out.add("内容资讯");
  if (/企业服务|企业通讯|协同办公|云存储|在线文档|项目管理/i.test(s)) out.add("企业服务");
  if (/法律服务|电子签|电子合同|e签|法大大|DocuSign|在线公证|存证|智能法务|法律咨询/i.test(s))
    out.add("法律服务");
  if (/本地生活|到店|团购|民宿|家政|美发预约/i.test(s)) out.add("本地生活");
  if (/在线教育|K12|语言学习|职业教育|网课/i.test(s)) out.add("在线教育");
  if (/在线医疗|在线问诊|互联网医院|健康管理|心理咨询/i.test(s)) out.add("在线医疗");
  if (/Web3|加密|Crypto|DeFi|NFT|区块链|CEX|DEX|稳定币|GameFi|SocialFi/i.test(s)) out.add("Web3");
  return SCENE_TAG_ORDER.filter((t) => out.has(t));
}

function inferSceneSubTags(text: string, group?: string): SceneSubTag[] {
  const s = `${group ?? ""} ${text}`;
  const out = new Set<SceneSubTag>();
  if (/侨汇|汇款|Remit|Western Union|MoneyGram|WorldRemit|Wise|速汇|跨境支付/i.test(s))
    out.add("跨境支付/汇款");
  // Web3 L2 粗推断
  if (/CEX|中心化交易所|币安|Coinbase|Upbit|Binance/i.test(s)) out.add("中心化交易所（CEX）");
  if (/\bDEX\b|Uniswap|去中心化交易所/i.test(s)) out.add("去中心化交易所（DEX）");
  if (/NFT交易|OpenSea|Blur/i.test(s)) out.add("NFT交易市场");
  if (/MetaMask|自托管|imToken|Phantom/i.test(s)) out.add("自托管钱包");
  if (/硬件钱包|Ledger|Trezor|OneKey/i.test(s)) out.add("硬件钱包");
  if (/稳定币汇款|USDT汇|USDC汇/i.test(s)) out.add("稳定币汇款");
  if (/抗通胀|美元化|里拉|比索崩溃/i.test(s)) out.add("抗通胀储蓄");
  if (/链游|GameFi|Axie|YGG|玩赚/i.test(s)) out.add("链游玩赚");
  if (/电子签章|e签宝|法大大|DocuSign|Adobe Sign|CloudSign/i.test(s)) out.add("电子签章");
  if (/电子合同|契约锁|合同锁|智能合同/i.test(s)) out.add("电子合同");
  if (/在线公证|区块链存证|存证/i.test(s)) out.add("在线公证/存证");
  if (/法律咨询|智能法务|LegalTech|律师平台/i.test(s)) out.add("法律咨询/智能法务");
  return SCENE_SUB_ORDER.filter((t) => out.has(t));
}

function resolveSceneSubTags(
  group: string,
  sceneType?: string,
  subTags?: SceneSubTag[],
): SceneSubTag[] {
  if (SCENE_SUBS_BY_GROUP[group]?.length) return SCENE_SUBS_BY_GROUP[group];
  if (subTags?.length) return SCENE_SUB_ORDER.filter((t) => subTags.includes(t));
  return inferSceneSubTags(sceneType ?? "", group);
}

function resolveSceneTags(group: string, sceneType?: string, tags?: SceneTag[]): SceneTag[] {
  let resolved: SceneTag[];
  if (SCENE_TAGS_BY_GROUP[group]?.length) resolved = SCENE_TAGS_BY_GROUP[group];
  else if (tags?.length) resolved = SCENE_TAG_ORDER.filter((t) => tags.includes(t));
  else {
    const inferred = inferSceneTags(sceneType ?? "", group);
    resolved = inferred.length ? inferred : ["电商"];
  }
  // 二级跨境支付/汇款挂在支付钱包下；Web3 二级确保一级含 Web3
  const subs = resolveSceneSubTags(group, sceneType);
  if (subs.includes("跨境支付/汇款") && !resolved.includes("支付钱包")) {
    resolved = [...resolved, "支付钱包"];
  }
  if (subs.some((s) => SCENE_SUB_PARENT[s] === "Web3") && !resolved.includes("Web3")) {
    resolved = [...resolved, "Web3"];
  }
  return SCENE_TAG_ORDER.filter((t) => resolved.includes(t));
}

function inferLeaseSubTags(parts: string[]): LeaseSubTag[] {
  const s = parts.join(" ");
  if (/游戏租|租号|装备租|账号租|帐号租|Game\s*(Account|Item)?\s*Rent|Zuhaowan|U号租/i.test(s)) {
    return ["游戏租赁"];
  }
  return [];
}

function resolveLeaseSubTags(
  _group: string,
  _line: CreditRow["line"],
  _draft?: Partial<Pick<CreditRow, "leaseSubs" | "brands" | "licenses" | "note" | "volume">>,
): LeaseSubTag[] {
  // 已取消租赁二级分类
  return [];
}

const scenesCore: SceneDraft[] = [
  {
    region: "east-asia",
    group: "蚂蚁集团/支付宝（蚂蚁·CN）",
    sceneType: "支付钱包 + 生活服务",
    apps: "支付宝",
    countries: "中国；Alipay+ 跨境",
    languages: "简中等",
    mau: "生态常称10亿+；MAU约6–7亿级（待核实）",
    registered: ">10亿",
    share: "中国移动支付约53–55%",
    creditAttach: "派生：花呗(分期)、借呗(现金贷)、芝麻信用免押租赁生态",
    diandian: "CN支付：非点点出海借贷榜；国内应用商店金融类另计",
  },
  {
    region: "east-asia",
    group: "腾讯控股/微信（腾讯·CN）",
    sceneType: "社交 + 支付",
    apps: "微信",
    countries: "中国",
    languages: "简中",
    mau: "微信MAU约14.1–14.3亿（2025末/2026初）",
    registered: "近饱和",
    share: "中国移动支付约40–42%",
    creditAttach: "派生：分发信贷/理财/保险（嵌微信）",
    diandian: "CN社交/支付：非点点出海借贷榜",
  },
  {
    region: "east-asia",
    group: "美团（美团·CN）",
    sceneType: "外卖/本地生活",
    apps: "美团",
    countries: "中国；Keeta出海",
    languages: "简中",
    mau: "年交易用户创新高（FY2024>7.7亿；FY2025再创新高）",
    registered: "未公开",
    share: "中国外卖约60%+",
    creditAttach: "派生：美团支付、月付等",
    diandian: "CN本地生活：非点点出海借贷榜",
  },
  {
    region: "east-asia",
    group: "京东集团/京东（京东·CN）",
    sceneType: "电商",
    apps: "京东",
    countries: "中国",
    languages: "简中",
    mau: "约6.1亿（第三方）",
    registered: "年活约7亿+",
    share: "中国电商GMV约24%",
    creditAttach: "派生：白条(分期)、金条(现金贷)",
    diandian: "CN电商：非点点出海借贷榜",
  },
  {
    region: "east-asia",
    group: "滴滴出行/滴滴（滴滴·CN）",
    sceneType: "出行",
    apps: "滴滴出行",
    countries: "中国；拉美另线",
    languages: "简中",
    mau: "近年未稳定披露；Q4'25日均约3890万单",
    registered: "未公开",
    share: "中国网约车约70%+",
    creditAttach: "派生：支付、现金贷、司机金融",
    diandian: "CN出行：非点点出海借贷榜 | MX·DiDi Finanzas：点点称墨App Store金融免费榜常居约5–15，2025-09-21曾冲#1后下架复核",
  },
  {
    region: "se-asia",
    group: "Sea Limited/Shopee（Sea·SEA）",
    sceneType: "电商",
    apps: "Shopee；ShopeePay；ShopeeFood",
    countries: "ID TH MY PH VN SG TW 等",
    languages: "多本地语",
    mau: "不披露统一MAU；FY2025 GMV $127.4B",
    registered: "未公开",
    share: "SEA平台电商GMV约52–53%；外卖为扩展盘：ShopeeFood区域GMV第二（墨腾6.0），主市场仍属Grab+GoFood",
    creditAttach: "派生：SPayLater(分期)、SLoan、SeaBank；点点H1引Monee截至2026Q1消费+SME贷款本金约US$9.9B（同比+71.3%，90天+不良约1.1%）",
    diandian:
      "SEA电商：点点电商榜另计｜点点《2026海外现金贷H1》：Monee贷款本金~US$9.9B（2026Q1）·不良1.1%；勿用独立现金贷App下载替代平台信贷主尺",
  },
  {
    region: "se-asia",
    group: "Grab Holdings/Grab（Grab·SEA）",
    sceneType: "出行 + 外卖",
    apps: "Grab",
    countries: "约8国SEA",
    languages: "英语+本地语",
    mau: "MTU Q4'25：50.5M",
    registered: "未公开",
    share: `SEA外卖主市场龙头约${MOTENG_LEARNED.seaFoodDelivery2025.grabShareApprox}（墨腾《${MOTENG_LEARNED.seaFoodDelivery2025.title}》）；与GoFood构成区域双寡头；新加坡打车约70–75%`,
    creditAttach: "派生：GrabPay、借贷、GXS/GXBank；点点H1引截至2026Q2 GLP约US$2.318B（同比+197%），当季放款约US$1.2B（同比+72%）",
    diandian:
      "SEA超级App：点点出行/外卖榜另计｜点点《2026海外现金贷H1》：GLP~US$2.318B（2026Q2）·当季放款~US$1.2B｜墨腾外卖主市场=Grab+Gojek",
  },
  {
    region: "se-asia",
    group: "GoTo/Gojek（GoTo·ID）",
    sceneType: "出行 + 外卖",
    apps: "Gojek；GoPay",
    countries: "印尼为主",
    languages: "印尼语、英语",
    mau: "ATU FY2025：66M；GoPay MTU≈24M",
    registered: "未公开",
    share: "印尼出行/外卖与Grab双寡头（GoFood）；区域外卖主市场一侧；ShopeeFood在印尼单量追赶属挑战者叙事",
    creditAttach: "派生：GoPayLater、Pinjam；关联Bank Jago",
    diandian: "ID超级App：点点出行/外卖榜另计｜墨腾：Grab↔GoTo为SEA外卖主市场双寡头",
  },
  {
    region: "se-asia",
    group: "Delivery Hero/Foodpanda（Foodpanda·SEA）",
    sceneType: "外卖",
    apps: "Foodpanda",
    countries: "新马等（泰国外卖已退出）",
    languages: "英语+本地语",
    mau: "区域份额下滑（墨腾：落后Grab/GoFood；GMV已被ShopeeFood超越）",
    registered: "未公开",
    share: "SEA外卖尾部/收缩；主市场为Grab+GoFood；2025退出泰国（墨腾外卖6.0）",
    creditAttach: "派生：信贷/钱包合作待核实",
    diandian: "墨腾外卖6.0：Foodpanda退出泰国；非SEA外卖主市场定义",
  },
  {
    region: "se-asia",
    group: "Xanh SM（Xanh SM·VN）",
    sceneType: "出行 + 外卖",
    apps: "Xanh SM",
    countries: "越南",
    languages: "越南语",
    mau: "电动出行起家；外卖为挑战者",
    registered: "未公开",
    share: "越南出行新兴；外卖试图挑战头部（墨腾外卖6.0）",
    creditAttach: "派生：信贷合作待核实",
    diandian: "墨腾外卖6.0：范日旺关联Xanh SM推外卖",
  },
  {
    region: "se-asia",
    group: "Lazada/Lazada（Lazada·SEA）",
    sceneType: "电商",
    apps: "Lazada",
    countries: "SEA六国",
    languages: "多本地语",
    mau: "未公开",
    registered: "未公开",
    share: "双位数份额，落后Shopee/TikTok",
    creditAttach: "派生：LazPayLater（多为持牌合作嵌入）",
    diandian: "SEA电商：点点电商榜另计",
  },
  {
    region: "se-asia",
    group: "ByteDance/TikTok（字节·SEA）",
    sceneType: "直播+电商+社交",
    apps: "TikTok；TikTok Shop",
    countries: "SEA为主（ID与Tokopedia整合叙事）；全球短视频",
    languages: "多本地语",
    mau: "全球月活常称十余亿级（集团口径；国别待拆）",
    registered: "未公开",
    share: "SEA直播电商快速追赶Shopee/Lazada；墨腾：短期不以本地生活/外卖替代平台为主变现",
    creditAttach: "派生：TikTok Shop PayLater/分期（多国持牌机构合作嵌入）",
    diandian: "SEA：短视频/电商榜另计；PayLater非独立借贷App｜墨腾外卖6.0：TikTok SEA变现主路径偏电商",
  },
  {
    region: "se-asia",
    group: "Akulaku/Akulaku（阿卡拉克·SEA）",
    sceneType: "轻电商/分期商城（电商算场景）",
    apps: "Akulaku；BNC/neobank；Asetku；OwnBank（PH）",
    countries: "印尼、菲律宾、马来、泰国",
    languages: "印尼语等",
    mau: "未公开",
    registered: ">40M（至2024）",
    share: "印尼BNPL头部之一",
    creditAttach:
      "强信贷：BNPL、现金贷；银行臂BNC(ID)·OwnBank(PH)；泰Akulaku X放贷；Asetku P2P；ID BNPL须对齐POJK 32/2025（融资公司/银行路径）",
    diandian:
      "ID/PH/TH：分期商城+银行/放贷臂；R&M媒体摘要与Kredivo并列点名印尼BNPL头部（2025约US$8.59B市场叙事〔1〕）；点点借贷榜位次待补最新月",
  },
  {
    region: "south-asia",
    group: "PhonePe/PhonePe（PhonePe·IN）",
    sceneType: "支付（UPI）",
    apps: "PhonePe",
    countries: "印度",
    languages: "英语+印度多语",
    mau: "MAC 2.378亿",
    registered: "LTD≈6.576亿",
    share: "UPI约46–49%",
    creditAttach: "派生：保险/借贷/理财分销",
    diandian: "IN支付：印度支付榜另计",
  },
  {
    region: "south-asia",
    group: "One97/Paytm（Paytm·IN）",
    sceneType: "支付",
    apps: "Paytm",
    countries: "印度",
    languages: "多语",
    mau: "MTU约7500–7600万",
    registered: "未公开",
    share: "UPI约6–8%",
    creditAttach: "派生：贷款/保险分销；Payments Bank已吊销",
    diandian: "IN支付：印度支付榜另计",
  },
  {
    region: "south-asia",
    group: "Flipkart/Flipkart（Flipkart·IN）",
    sceneType: "电商",
    apps: "Flipkart",
    countries: "印度",
    languages: "多语",
    mau: "约2.2–2.4亿",
    registered: "常引5亿+",
    share: "印度电商GMV约50–60%",
    creditAttach: "派生：Pay Later（银行/NBFC合作）",
    diandian: "IN电商：电商榜另计",
  },
  {
    region: "latam",
    group: "DiDi/99（滴滴·LATAM）",
    sceneType: "出行 + 外卖",
    apps: "DiDi；DiDi Food；99",
    countries: "墨西哥、巴西等约10国拉美",
    languages: "西语、葡语",
    mau: "墨约3000万；巴约5500万活跃",
    registered: "未公开",
    share: "巴西出行约40%；墨西哥出行/外卖头部场景原生",
    creditAttach: "派生：99Pay、DiDi Cuenta、DiDi Finanzas信贷/卡（金融臂另见信贷表）",
    diandian: "MX·DiDi Finanzas：点点墨金融榜约5–15，2025Q4 MAU均约367.5万（+8.8%YoY）；2025-09曾冲商店#1后复核下架",
  },
  {
    region: "latam",
    group: "Mercado Libre/Mercado Libre（美卡多·LATAM）",
    sceneType: "电商",
    apps: "Mercado Libre；Mercado Pago",
    countries: "巴西、墨西哥、阿根廷、智利、哥伦比亚等",
    languages: "西语、葡语",
    mau: "Pago近7800万MAU",
    registered: "巴西央行口径约7130万",
    share: "巴西电商约27–35%；阿根廷约60%+",
    creditAttach: "派生：钱包、信贷、理财（Pago可独立获客）",
    diandian: "拉美电商/钱包：点点电商与金融工具分榜，精确借贷名次待补",
  },
  {
    region: "latam",
    group: "Rappi/Rappi（Rappi·LATAM）",
    sceneType: "外卖/本地生活",
    apps: "Rappi",
    countries: "墨西哥、哥伦比亚、巴西等约9国",
    languages: "西语、葡语",
    mau: "宣称3000万+活跃",
    registered: "未公开",
    share: "哥伦比亚外卖领先之一",
    creditAttach: "派生：RappiPay（哥伦比亚）；墨金融已收缩",
    diandian: "拉美本地生活：点点生活服务榜另计",
  },
  {
    region: "africa",
    group: "Safaricom/M-Pesa（M-Pesa·KE）",
    sceneType: "支付/移动货币",
    apps: "M-PESA",
    countries: "肯尼亚+东非",
    languages: "斯瓦希里、英语",
    mau: "肯尼亚月活约3600–4400万",
    registered: "高于月活",
    share: "肯尼亚移动货币近垄断",
    creditAttach: "派生：Fuliza/M-Shwari等信贷",
    diandian: "KE移动货币：电信/支付榜另计",
  },
  {
    region: "africa",
    group: "OPay/OPay（OPay·NG）",
    sceneType: "支付/代理银行",
    apps: "OPay",
    countries: "尼日利亚",
    languages: "英语",
    mau: "月末交易活跃约3932万",
    registered: "约4500万",
    share: "尼日利亚数字支付领先梯队",
    creditAttach: "派生：OPay借贷/分期等信贷产品线",
    diandian: "NG支付：支付榜另计",
  },
  {
    region: "west",
    group: "Amazon/Amazon（亚马逊·US）",
    sceneType: "电商",
    apps: "Amazon",
    countries: "美英日印等",
    languages: "多语",
    mau: "依托数亿账户",
    registered: "数亿级账户",
    share: "多国电商龙头",
    creditAttach: "派生：Amazon Pay、Installments/合作分期",
    diandian: "电商：电商榜另计",
  },
  {
    region: "west",
    group: "Block/Cash App（Block·US）",
    sceneType: "支付/P2P钱包",
    apps: "Cash App",
    countries: "美国为主",
    languages: "英语",
    mau: "月交易活跃5900万",
    registered: "未公开",
    share: "美国年轻用户钱包头部",
    creditAttach: "同集团 Afterpay=消费分期产品线（见信贷表）",
    diandian: "US支付：美区榜另计",
  },
];

const REGION_COUNTRY: Record<Exclude<Region, "all">, string> = {
  "east-asia": "中日韩蒙等",
  "se-asia": "东南亚多国",
  "south-asia": "印度等",
  "central-asia": "哈萨克斯坦、乌兹别克斯坦等",
  latam: "拉美多国",
  mena: "中东与北非多国",
  africa: "非洲多国（撒哈拉以南为主）",
  west: "美加英欧等",
};

type SceneSeed = {
  region: Exclude<Region, "all">;
  group: string;
  sceneType: string;
  creditAttach: string;
};
type CreditSeed = {
  region: Exclude<Region, "all">;
  line: "cash" | "bnpl" | "lease" | "agent";
  group: string;
};

/** 仅收录已涉信贷派生的场景玩家；纯支付/出行/外卖不入库 */
const sceneCrmSeedTuples: [Exclude<Region, "all">, string, string, string][] = [
  ["east-asia", "拼多多（拼多多·CN）", "电商", "派生：多多支付/月付等"],
  ["east-asia", "字节跳动/抖音（抖音·CN）", "直播+短视频+电商", "派生：抖音月付、放心借等"],
  ["east-asia", "快手（快手·CN）", "直播+短视频+电商", "派生：快手月付等"],
  ["east-asia", "广州华人/Badam Live（巴旦木·CN）", "直播", "派生：直播消费/虚拟礼物；信贷合作待核实"],
  ["east-asia", "小红书（小红书·CN）", "社交内容+电商", "派生：月付/信贷合作"],
  ["east-asia", "阿里巴巴/淘宝天猫（淘宝·CN）", "电商", "派生：花呗/借呗入口（蚂蚁）"],
  ["east-asia", "饿了么（饿了么·CN）", "外卖", "派生：支付宝生态信贷入口"],
  ["east-asia", "携程（携程·CN）", "出行", "派生：拿去花等分期"],
  ["east-asia", "飞猪（飞猪·CN）", "出行", "派生：花呗分期"],
  ["east-asia", "哈啰（哈啰·CN）", "两轮出行", "派生：哈啰金融/信贷合作"],
  ["east-asia", "云闪付（云闪付·CN）", "支付钱包", "派生：银行信贷导流"],
  ["east-asia", "唯品会（唯品会·CN）", "电商", "派生：唯品花"],
  ["east-asia", "苏宁易购（苏宁·CN）", "电商", "派生：任性付/苏宁金融"],
  ["east-asia", "闲鱼（闲鱼·CN）", "二手电商", "派生：闲鱼小贷/芝麻免押"],
  ["east-asia", "贝壳（贝壳·CN）", "房产交易", "派生：贝壳金服历史/信贷合作"],
  ["east-asia", "高德（高德·CN）", "地图出行", "派生：阿里信贷入口"],
  ["east-asia", "百度｜百度｜百度（百度·CN）", "搜索+地图", "派生：度小满｜有钱花｜百度（度小满·CN）"],
  ["se-asia", "Tokopedia（·SEA）", "电商", "派生：GoPay/GoTo金融借贷"],
  ["se-asia", "Traveloka（·SEA）", "出行", "派生：PayLater等"],
  ["se-asia", "MoMo（·SEA）", "支付钱包", "派生：借贷/保险"],
  ["se-asia", "ZaloPay（·SEA）", "支付钱包", "派生：信贷合作"],
  ["se-asia", "Dana（·SEA）", "支付钱包", "派生：信贷/分期"],
  ["se-asia", "OVO（·SEA）", "支付钱包", "派生：借贷合作"],
  ["se-asia", "GCash（·SEA）", "支付钱包/跨境支付汇款", "派生：GLoan等；跨境支付/汇款"],
  ["se-asia", "Maya（·SEA）", "支付钱包+数字银行", "派生：Maya Credit"],
  ["se-asia", "TrueMoney（·SEA）", "支付钱包", "派生：借贷合作"],
  ["south-asia", "Amazon India（·IN）", "电商", "派生：Amazon Pay Later"],
  ["south-asia", "Myntra（·IN）", "电商", "派生：Flipkart生态分期"],
  ["south-asia", "Ola（·IN）", "出行", "派生：Ola Money/金融"],
  ["south-asia", "Amazon Pay（·IN）", "支付钱包", "派生：Pay Later"],
  ["south-asia", "Google Pay India（Google Pay·IN）", "支付钱包", "派生：UPI；信贷合作导流"],
  ["south-asia", "YONO SBI（·IN）", "支付钱包+银行", "派生：银行信贷/贷款入口"],
  ["south-asia", "JioMart（·IN）", "电商", "派生：JioFinance入口"],
  ["south-asia", "BharatPe（·IN）", "支付+商户", "派生：商户贷"],
  ["south-asia", "Mobikwik（·IN）", "支付钱包", "派生：ZIP/信贷"],
  ["south-asia", "Freecharge（·IN）", "支付钱包", "派生：信贷合作"],
  ["south-asia", "Airtel Thanks（·IN）", "电信+支付", "派生：Payments Bank/信贷"],
  ["south-asia", "Tata Neu（·IN）", "超级App", "派生：NeuCard/信贷"],
  ["latam", "Magazine Luiza（·LATAM）", "电商零售", "派生：MagaluPay/信贷"],
  ["latam", "Shopee Brasil（·LATAM）", "电商", "派生：SPayLater等"],
  ["latam", "Amazon Brasil（·LATAM）", "电商", "派生：分期"],
  ["latam", "PicPay（·LATAM）", "支付钱包", "派生：信贷/投资"],
  ["latam", "PagBank（·LATAM）", "支付+银行", "派生：信贷"],
  ["latam", "Casas Bahia（·LATAM）", "零售", "派生：CDC消费分期"],
  ["latam", "Falabella（·LATAM）", "零售", "派生：CMR信用卡/消费贷"],
  ["latam", "Liverpool（·LATAM）", "零售", "派生：信用卡/消费贷"],
  ["latam", "Coppel（·LATAM）", "零售", "派生：Coppel信贷"],
  ["latam", "Nequi（·LATAM）", "支付钱包", "派生：信贷"],
  ["latam", "DaviPlata（·LATAM）", "支付钱包", "派生：银行信贷"],
  ["latam", "Ualá（·LATAM）", "支付钱包", "派生：信贷卡"],
  ["latam", "Uber（Uber·LATAM）", "出行+外卖", "派生：Uber Money/合作信贷；场景原生出行外卖"],
  ["latam", "iFood（iFood·BR）", "外卖", "派生：商户贷/消费信贷合作"],
  ["latam", "PedidosYa（PedidosYa·LATAM）", "外卖", "派生：钱包/信贷合作待核实"],
  ["latam", "Cabify（Cabify·LATAM）", "出行", "派生：企业账户；信贷合作待核实"],
  ["latam", "inDrive（inDrive·LATAM）", "出行", "派生：司机金融合作待核实"],
  ["latam", "Yape（Yape·PE）", "支付钱包", "派生：BCP生态信贷导流"],
  ["latam", "Clip（Clip·MX）", "支付钱包", "派生：商户贷/分期"],
  ["latam", "Americanas（Americanas·BR）", "电商", "派生：Ame Digital/分期"],
  ["latam", "Linio（Linio·LATAM）", "电商", "派生：分期合作待核实"],
  ["latam", "Shein LatAm（Shein·LATAM）", "电商", "派生：Shop Pay Later类合作待核实"],
  ["latam", "Kwai América Latina（快手·LATAM）", "直播+社交", "派生：直播打赏/电商；信贷合作待核实"],
  ["latam", "ByteDance/TikTok LatAm（字节·LATAM）", "直播+社交", "派生：TikTok Shop；信贷合作待核实"],
  ["latam", "Garena Free Fire（Free Fire·LATAM）", "游戏", "派生：虚拟道具支付；信贷合作待核实"],
  ["central-asia", "Kaspi.kz（Kaspi·KZ）", "电商+支付超级App", "派生：Kaspi Pay/分期信贷"],
  ["central-asia", "Uzum（Uzum·UZ）", "电商", "派生：Uzum Nasiya分期"],
  ["central-asia", "Click（Click·UZ）", "支付钱包", "派生：信贷合作待核实"],
  ["central-asia", "Payme（Payme·UZ）", "支付钱包", "派生：信贷合作待核实"],
  ["central-asia", "inDrive（inDrive·KZ）", "出行", "派生：司机侧金融合作待核实"],
  ["east-asia", "LendMN（LendMN·MN）", "支付钱包+信贷入口", "派生：外蒙古数字贷款/钱包/LendDy BNPL"],
  ["east-asia", "Hipay（Hipay·MN）", "支付钱包", "派生：贷款/保险/投资入口（外蒙古）"],
  ["east-asia", "Pocket/InvesCore（Pocket·MN）", "支付钱包", "派生：在线现金贷/Pocket Zero分期"],
  ["east-asia", "Ard App/Ard Credit（Ard·MN）", "支付钱包+信贷入口", "派生：Ard贷/ArdPay（外蒙古）"],
  ["east-asia", "Shoppy.mn（Shoppy·MN）", "电商", "派生：与本地银行/信贷合作分期待核实"],
  ["east-asia", "Storepay（Storepay·MN）", "电商+支付", "派生：外蒙古BNPL分期（Storepay）"],
  ["east-asia", "Simple（Simple·MN）", "零售分期入口", "派生：Simple Buy BNPL/消费贷"],
  ["mena", "赤子城科技/MICO（赤子城·MENA）", "直播+社交", "派生：社交电商/创新业务；信贷合作待核实"],
  ["africa", "Jumia（·非洲）", "电商", "派生：JumiaPay/分期"],
  ["mena", "Noon（·MENA）", "电商", "派生：Noon Pay/分期"],
  ["africa", "Wave（·非洲）", "支付钱包", "派生：小额贷"],
  ["africa", "Airtel Money（·非洲）", "支付钱包", "派生：小额贷"],
  ["africa", "MTN MoMo（·非洲）", "支付钱包", "派生：借贷"],
  ["africa", "Orange Money（·非洲）", "支付钱包", "派生：借贷"],
  ["africa", "PalmPay（·非洲）", "支付钱包", "派生：信贷"],
  ["mena", "STC Pay（·MENA）", "支付钱包", "派生：信贷"],
  ["mena", "Urpay（·MENA）", "支付钱包", "派生：银行信贷"],
  ["west", "Walmart（·US）", "零售", "派生：Walmart Capital/卡分期等"],
  ["west", "Target（·US）", "零售", "派生：RedCard/分期"],
  ["west", "Venmo（·US）", "支付钱包", "派生：Venmo Credit Card"],
  ["west", "PayPal（·US）", "支付钱包/跨境支付汇款", "派生：PayPal Credit/BNPL；跨境汇款"],
  ["west", "Apple Wallet（·US）", "支付钱包", "派生：Apple Card / Pay Later"],
  ["west", "Shopify（·US）", "电商标杆", "派生：Shopify Capital / Shop Pay"],
  ["west", "Revolut（·US）", "支付超级App", "派生：信贷/BNPL"],
  ["west", "Wise/Wise（Wise·US）", "支付钱包/跨境支付汇款", "派生：多币种账户；信贷合作待核实"],
  ["west", "Remitly/Remitly（Remitly·US）", "支付钱包/跨境支付汇款", "派生：跨境汇款主场景；信贷合作待核实"],
  ["west", "Western Union/Western Union（西联·US）", "支付钱包/跨境支付汇款", "派生：全球跨境汇款网络"],
  ["west", "MoneyGram/MoneyGram（速汇金·US）", "支付钱包/跨境支付汇款", "派生：全球跨境汇款网络"],
  ["west", "WorldRemit/WorldRemit（WorldRemit·US）", "支付钱包/跨境支付汇款", "派生：数字跨境汇款"],
  // 优先名册缺口补种（2026-08-11）：支付/数字银行场景入口，〔1〕核验
  ["se-asia", "LinkAja（LinkAja·ID）", "支付钱包", "派生：信贷/分期合作待核实"],
  ["east-asia", "AlipayHK（支付宝HK·HK）", "支付钱包/跨境支付汇款", "派生：储值支付工具；信贷导流待核实"],
  ["east-asia", "WeChat Pay HK（微信支付HK·HK）", "支付钱包/跨境支付汇款", "派生：储值支付工具；信贷导流待核实"],
  ["se-asia", "Touch'n Go eWallet（TnG·MY）", "支付钱包", "派生：信贷/分期合作待核实"],
  ["se-asia", "Boost（Boost·MY）", "支付钱包", "派生：电子货币；信贷合作待核实"],
  ["se-asia", "MAE/Maybank（MAE·MY）", "支付钱包+银行", "派生：Maybank 数字化入口"],
  ["se-asia", "GXBank（GXBank·MY）", "支付钱包+数字银行", "派生：Grab 系数字银行"],
  ["se-asia", "Rabbit LINE Pay（Rabbit LINE Pay·TH）", "支付钱包", "派生：LINE 生态；信贷合作待核实"],
  ["south-asia", "Easypaisa（Easypaisa·PK）", "支付钱包+微金融", "派生：钱包信贷"],
  ["south-asia", "SadaPay（SadaPay·PK）", "支付钱包+数字银行化", "派生：电子货币机构"],
  ["south-asia", "bKash（bKash·BD）", "支付钱包", "派生：移动货币；小额贷待核实"],
  ["south-asia", "Nagad（Nagad·BD）", "支付钱包", "派生：移动货币"],
  ["south-asia", "Rocket/DBBL（Rocket·BD）", "支付钱包", "派生：银行代理移动货币"],
  ["south-asia", "Razorpay（Razorpay·IN）", "支付收单", "派生：商户贷/RazorpayX"],
  ["africa", "Moniepoint（Moniepoint·NG）", "支付+代理银行", "派生：商户收单/信贷"],
  ["africa", "Chipper Cash（Chipper·非洲）", "支付钱包/跨境支付汇款", "派生：跨境汇款；信贷待核实"],
  ["africa", "Flutterwave（Flutterwave·非洲）", "支付收单", "派生：商户支付基建"],
  ["africa", "Capitec（Capitec·ZA）", "支付钱包+零售银行", "派生：消费信贷"],
  ["africa", "Discovery Bank（Discovery·ZA）", "支付钱包+数字银行", "派生：保险生态银行"],
  ["africa", "Equity Bank（Equity·KE）", "支付钱包+银行", "派生：Equitel/移动信贷"],
  ["latam", "C6 Bank（C6·BR）", "支付钱包+数字银行", "派生：消费信贷/发卡"],
  ["latam", "Neon（Neon·BR）", "支付钱包+数字银行", "派生：消费信贷"],
  ["latam", "Bradesco（Bradesco·BR）", "支付钱包+银行", "派生：next/消费信贷"],
  ["latam", "Itaú Unibanco（Itaú·BR）", "支付钱包+银行", "派生：消费信贷/发卡"],
  ["latam", "Tenpo（Tenpo·CL）", "支付钱包+数字金融", "派生：账户/信贷"],
  ["latam", "MACH/Bci（MACH·CL）", "支付钱包", "派生：P2P/银行入口"],
  ["latam", "Plin（Plin·PE）", "支付钱包", "派生：银行间 P2P"],
  ["latam", "Lulo Bank（Lulo·CO）", "支付钱包+数字银行", "派生：吸储/信贷"],
  ["latam", "MOVii（MOVii·CO）", "支付钱包", "派生：电子存款"],
  ["latam", "MODO（MODO·AR）", "支付钱包", "派生：银行联盟支付"],
  ["latam", "Brubank（Brubank·AR）", "支付钱包+数字银行", "派生：吸储/信贷"],
  ["latam", "Plata（Plata·MX）", "支付钱包+数字银行化", "派生：点点H1称2026初获批银行牌照；账户/信贷银行化主线"],
  ["se-asia", "Cake by VPBank（Cake·VN）", "支付钱包+数字银行", "派生：VPBank 数字臂"],
  ["se-asia", "Timo（Timo·VN）", "支付钱包+数字银行", "派生：线上银行"],
  ["se-asia", "Vikki（Vikki·VN）", "支付钱包+数字银行", "派生：HDBank 系"],
  ["se-asia", "TNEX（TNEX·VN）", "支付钱包+数字银行", "派生：MSB 系"],
  ["se-asia", "Viettel Money（Viettel Money·VN）", "支付钱包", "派生：电信钱包"],
  ["se-asia", "VPBank（VPBank·VN）", "支付钱包+银行", "派生：Cake/消费贷"],
  ["se-asia", "BCA（BCA·ID）", "支付钱包+银行", "派生：blu 数字臂"],
  ["se-asia", "digibank by DBS ID（digibank·ID）", "支付钱包+数字银行", "派生：DBS 印尼"],
  ["se-asia", "DBS（DBS·SG）", "支付钱包+银行", "派生：digibank/PayLah"],
  ["se-asia", "Maybank（Maybank·MY）", "支付钱包+银行", "派生：MAE"],
  ["mena", "Wio（Wio·AE）", "支付钱包+数字银行", "派生：零售/SME"],
  ["mena", "Mashreq Neo（Mashreq Neo·AE）", "支付钱包+数字银行", "派生：Mashreq 数字臂"],
  ["mena", "STC Bank（STC Bank·SA）", "支付钱包+数字银行", "派生：电信系数字银行"],
  ["east-asia", "KakaoBank（KakaoBank·KR）", "支付钱包+数字银行", "派生：Kakao 生态信贷"],
  ["east-asia", "Toss Bank（Toss Bank·KR）", "支付钱包+数字银行", "派生：Toss 超级应用"],
  ["east-asia", "K-Bank（K-Bank·KR）", "支付钱包+数字银行", "派生：互联网银行"],
  ["east-asia", "Kakao Pay（Kakao Pay·KR）", "支付钱包", "派生：信贷/投资入口"],
  ["east-asia", "Naver Pay（Naver Pay·KR）", "支付钱包", "派生：电商支付"],
  ["east-asia", "PayPay（PayPay·JP）", "支付钱包", "派生：软银/雅虎生态"],
  ["east-asia", "乐天银行（楽天銀行·JP）", "支付钱包+网络银行", "派生：乐天生态信贷"],
  ["east-asia", "网商银行（网商·CN）", "支付钱包+数字银行", "派生：阿里生态"],
  ["east-asia", "Fusion Bank（Fusion Bank·HK）", "支付钱包+虚拟银行", "派生：腾讯系虚拟银行"],
  ["east-asia", "Livi Bank（Livi·HK）", "支付钱包+虚拟银行", "派生：中资虚拟银行"],
  ["east-asia", "Airstar Bank（Airstar·HK）", "支付钱包+虚拟银行", "派生：京东系虚拟银行"],
  ["east-asia", "ZA Bank（ZA Bank·HK）", "支付钱包+虚拟银行", "派生：众安系虚拟银行"],
  ["east-asia", "Mox Bank（Mox·HK）", "支付钱包+虚拟银行", "派生：渣打/京东系虚拟银行"],
  ["east-asia", "WeLab Bank（WeLab·HK）", "支付钱包+虚拟银行", "派生：WeLab 虚拟银行"],
  ["west", "JPMorgan Chase（JPMorgan·US）", "支付钱包+银行", "派生：Chase 消费信贷"],
  ["west", "Ally（Ally·US）", "支付钱包+数字银行", "派生：线上消费/车贷"],
  ["west", "Starling Bank（Starling·GB）", "支付钱包+数字银行", "派生：零售/SME"],
  ["west", "Adyen（Adyen·EU）", "支付收单", "派生：全球收单基建"],
  ["west", "Up Bank（Up·AU）", "支付钱包+数字银行", "派生：Bendigo 合作数字银行"],
  ["south-asia", "HDFC Bank（HDFC·IN）", "支付钱包+银行", "派生：消费信贷/信用卡"],
  ["mena", "Hepsiburada（Hepsiburada·TR）", "电商", "派生：BNPL/分期"],
  ["mena", "Trendyol（Trendyol·TR）", "电商", "派生：BNPL/金融"],
];

const creditCrmSeedTuples: [Exclude<Region, "all">, "cash" | "bnpl" | "lease" | "agent", string][] = [
  ["east-asia", "cash", "宜人智科/宜人（宜人·CN）"],
  ["east-asia", "cash", "小赢科技（小赢·CN）"],
  ["east-asia", "cash", "维信金科（维信·CN）"],
  ["east-asia", "cash", "萨摩耶云（萨摩耶·CN）"],
  ["east-asia", "cash", "中关村科金｜马上｜中科金（中科金·CN）"],
  ["east-asia", "cash", "招商银行+中国联通｜招联｜招联（招联·CN）"],
  ["east-asia", "cash", "中原银行｜中原消费｜中原银行（中原·CN）"],
  ["east-asia", "cash", "度小满｜有钱花｜百度（度小满·CN）"],
  ["east-asia", "cash", "数禾｜还呗｜数禾（数禾·CN）"],
  ["east-asia", "cash", "极融云仓（极融云仓·CN）"],
  ["east-asia", "cash", "闪银（闪银·CN）"],
  ["east-asia", "cash", "你我贷（你我贷·CN）"],
  ["east-asia", "cash", "飞贷（飞贷·CN）"],
  ["east-asia", "cash", "好分期（好分期·CN）"],
  ["east-asia", "agent", "融360（融360·CN）"],
  ["east-asia", "cash", "桔子数字（桔子数字·CN）"],
  ["east-asia", "agent", "水滴信贷导流（水滴信贷导流·CN）"],
  ["east-asia", "cash", "中国邮政｜中邮消费｜中国邮政（中邮·CN）"],
  // 外蒙古(MN)·信贷原生（≠中国内蒙古蒙商消金）
  ["east-asia", "cash", "LendMN/LendMN（LendMN·MN）"],
  ["east-asia", "cash", "Pocket/InvesCore Wallet（Pocket·MN）"],
  ["east-asia", "cash", "Ard Credit/Ard App（Ard·MN）"],
  ["east-asia", "cash", "Simple（Simple·MN）"],
  ["east-asia", "cash", "M Credit/Solomon（M Credit·MN）"],
  ["east-asia", "cash", "Hipay Loan/Hipay（Hipay·MN）"],
  ["east-asia", "cash", "M Bank数字贷/M Bank（M Bank·MN）"],
  ["east-asia", "cash", "Khan Bank数字贷/Khan Bank（Khan Bank·MN）"],
  ["east-asia", "bnpl", "Storepay（Storepay·MN）"],
  ["east-asia", "bnpl", "LendMN/LendDy（LendDy·MN）"],
  ["east-asia", "bnpl", "Simple Buy/Simple（Simple Buy·MN）"],
  ["east-asia", "bnpl", "Pocket Zero/Pocket（Pocket Zero·MN）"],
  ["se-asia", "cash", "AdaKami/FinVolution（信也·ID）"],
  ["se-asia", "cash", "Easycash/Fintopia（洋钱罐·ID）"],
  ["se-asia", "cash", "Akulaku Finance/Akulaku（阿卡拉克·SEA）"],
  ["se-asia", "cash", "GoTo Financial/GoTo（GoTo·ID）"],
  ["se-asia", "cash", "Shopee Pinjam/Sea（Shopee·SEA）"],
  ["se-asia", "cash", "Home Credit SEA（·SEA）"],
  ["se-asia", "cash", "AEON Financial SEA（·SEA）"],
  ["se-asia", "cash", "UangMe（·ID）"],
  ["se-asia", "cash", "Kredit Pintar（·SEA）"],
  ["se-asia", "cash", "Rupiah Cepat（·ID）"],
  ["se-asia", "cash", "Pinjam Yuk（·SEA）"],
  ["se-asia", "cash", "TunaiKita（·SEA）"],
  ["se-asia", "cash", "CashCash（·SEA）"],
  ["se-asia", "cash", "JuanHand/FinVolution（信也·PH）"],
  ["se-asia", "cash", "Tala（Tala·PH）"],
  ["se-asia", "cash", "GCash/GLoan（GCash·PH）"],
  ["se-asia", "cash", "Cashalo/Paloo（·PH）"],
  ["se-asia", "cash", "Digido（·PH）"],
  ["se-asia", "cash", "ACOM Fast Cash（·SEA）"],
  ["se-asia", "cash", "Advance Tech Lending（·SEA）"],
  ["se-asia", "cash", "Online Loans Pilipinas（·PH）"],
  ["se-asia", "cash", "FE Credit（FE·VN）"],
  ["se-asia", "cash", "Home Credit Vietnam（Home Credit·VN）"],
  ["se-asia", "cash", "Shinhan Finance（新韩·VN）"],
  ["se-asia", "cash", "HD Saison（VN·SBV）"],
  ["se-asia", "cash", "Mcredit（VN·SBV）"],
  ["se-asia", "cash", "AEON Credit Service/AEON Credit（AEON·MY）"],
  ["se-asia", "cash", "RCE Marketing（·MY）"],
  ["se-asia", "cash", "AEON Thana Sinsap（TH·BOT）"],
  ["se-asia", "cash", "Easy Buy（Easy Buy·TH）"],
  ["se-asia", "cash", "Ascend Nano/Ascend（Ascend·TH）"],
  ["se-asia", "cash", "Krungsri Consumer（TH·BOT）"],
  ["se-asia", "cash", "Amartha（ID·OJK LPBBTI）"],
  ["se-asia", "cash", "Investree（ID·OJK LPBBTI）"],
  ["se-asia", "cash", "JULO（·ID）"],
  // OJK LPBBTI 官网名录交叉补录（2025-07/08 公开名单；与已有 AdaKami/Easycash 等去重）
  ["se-asia", "cash", "Danamas/PT Pasar Dana Pinjaman（Danamas·ID）"],
  ["se-asia", "cash", "Dompet Kilat/PT Indo FinTek（DompetKilat·ID）"],
  ["se-asia", "cash", "Modalku/PT Mitrausaha Indonesia Grup（Modalku·ID）"],
  ["se-asia", "cash", "KTA Kilat/PT Pendanaan Teknologi Nusa（KTAKilat·ID）"],
  ["se-asia", "cash", "Finmas/PT Oriente Mas Sejahtera（Finmas·ID）"],
  ["se-asia", "cash", "Akseleran/PT Akseleran Keuangan Inklusif（Akseleran·ID）"],
  ["se-asia", "cash", "KoinWorks/KoinP2P（KoinWorks·ID）"],
  ["se-asia", "cash", "Indodana/PT Artha Dana Teknologi（Indodana·ID）"],
  ["se-asia", "cash", "DanaRupiah/PT Layanan Keuangan Berbagi（DanaRupiah·ID）"],
  ["se-asia", "cash", "Alami/PT Alami Fintek Sharia（Alami·ID）"],
  ["se-asia", "cash", "AwanTunai/PT Simplefi Teknologi（AwanTunai·ID）"],
  ["se-asia", "cash", "Singa/PT Abadi Sejahtera Finansindo（Singa·ID）"],
  ["se-asia", "cash", "BATUMBU/PT Berdayakan Usaha Indonesia（Batumbu·ID）"],
  ["se-asia", "cash", "Cashcepat/PT Artha Permata Makmur（Cashcepat·ID）"],
  ["se-asia", "cash", "Cicil/PT Cicil Solusi Mitra Teknologi（Cicil·ID）"],
  ["se-asia", "cash", "Kredito/PT Fintek Digital Indonesia（Kredito·ID）"],
  ["se-asia", "cash", "AdaPundi/PT Info Tekno Siaga（AdaPundi·ID）"],
  ["se-asia", "cash", "Komunal/PT Komunal Finansial Indonesia（Komunal·ID）"],
  ["se-asia", "cash", "Gradana/PT Gradana Teknoruci（Gradana·ID）"],
  ["se-asia", "cash", "Danacita/PT Inclusive Finance Group（Danacita·ID）"],
  ["se-asia", "cash", "KrediFazz/PT KrediFazz Digital（KrediFazz·ID）"],
  ["se-asia", "cash", "Doeku/PT Doeku Peduli Indonesia（Doeku·ID）"],
  ["se-asia", "cash", "Edufund/PT Fintech Bina Bangsa（Edufund·ID）"],
  ["se-asia", "cash", "ETHIS/PT Ethis Fintek Indonesia（Ethis·ID）"],
  ["se-asia", "cash", "Findaya/PT Mapan Global Reksa（Findaya·ID）"],
  ["se-asia", "cash", "Pinjamin/PT Progo Puncak Group（Pinjamin·ID）"],
  ["se-asia", "cash", "PinjamModal/PT Finansial Integrasi Teknologi（PinjamModal·ID）"],
  ["se-asia", "cash", "ModalRakyat/PT Modal Rakyat Indonesia（ModalRakyat·ID）"],
  ["south-asia", "cash", "MoneyView（·IN）"],
  ["south-asia", "cash", "CASHe（·IN）"],
  ["south-asia", "cash", "Fibe（·IN）"],
  ["south-asia", "cash", "Navi（·IN）"],
  ["south-asia", "cash", "PaySense（·IN）"],
  ["south-asia", "cash", "MoneyTap（·IN）"],
  ["south-asia", "cash", "Lendingkart（·IN）"],
  ["south-asia", "cash", "Axio（·IN）"],
  ["south-asia", "cash", "Bajaj Finance（·IN）"],
  ["south-asia", "cash", "Tata Capital（·IN）"],
  ["south-asia", "cash", "Mahindra Finance（·IN）"],
  ["south-asia", "cash", "Home Credit India（·IN）"],
  ["south-asia", "cash", "SmartCoin（·IN）"],
  ["south-asia", "cash", "Mpokket（·IN）"],
  ["south-asia", "cash", "Stashfin（·IN）"],
  ["south-asia", "cash", "IDLC Finance（BD·BB NBFI）"],
  ["south-asia", "cash", "IPDC Finance（BD·BB NBFI）"],
  ["south-asia", "cash", "LankaBangla Finance（BD·BB NBFI）"],
  ["south-asia", "cash", "United Finance（BD·BB NBFI）"],
  ["south-asia", "cash", "Paisayaar / JingleCred（PK·SECP Lending NBFC）"],
  ["south-asia", "cash", "JazzCash Digital Lending（PK·SECP）"],
  ["south-asia", "cash", "Aitemaad / 4Sight（PK·SECP）"],
  ["south-asia", "cash", "Fauri Cash / Pakisnova（PK·SECP）"],
  ["south-asia", "cash", "PakCredit / VisionCred（PK·SECP）"],
  ["south-asia", "cash", "Loan Lado / Easy Finance（PK·SECP）"],
  ["south-asia", "cash", "LOLC Finance（LK·CBSL LFC）"],
  ["south-asia", "cash", "LB Finance（LK·CBSL LFC）"],
  ["south-asia", "cash", "Commercial Credit & Finance（LK·CBSL LFC）"],
  ["south-asia", "cash", "People's Leasing & Finance（LK·CBSL LFC）"],
  ["south-asia", "cash", "HNB Finance（LK·CBSL LFC）"],
  ["south-asia", "cash", "Dialog Finance（LK·CBSL LFC）"],
  ["latam", "cash", "Creditas（·LATAM）"],
  ["latam", "cash", "Crefisa（·LATAM）"],
  ["latam", "cash", "Simplic（·LATAM）"],
  ["latam", "cash", "Juvo（·LATAM）"],
  ["latam", "cash", "Credmex/Fintopia（洋钱罐·MX）"],
  ["latam", "cash", "中关村科金｜待核｜中科金（中科金·MX）"],
  ["latam", "cash", "Kueski Cash（·LATAM）"],
  ["latam", "cash", "Konfío（·LATAM）"],
  ["latam", "cash", "Creditea（·LATAM）"],
  ["latam", "cash", "Prestadero（·LATAM）"],
  ["latam", "cash", "RapiCredit（·LATAM）"],
  ["latam", "cash", "Lineru（·LATAM）"],
  ["latam", "cash", "TPaga借贷（·LATAM）"],
  ["latam", "cash", "Claropay借贷臂（·LATAM）"],
  ["latam", "cash", "Ualá信贷（·LATAM）"],
  ["latam", "cash", "Rappi Credit/Rappi（Rappi·LATAM）"],
  ["latam", "cash", "Mercado Credito/Mercado Libre（美卡多·LATAM）"],
  ["latam", "cash", "DiDi Credit/DiDi（滴滴·LATAM）"],
  ["latam", "cash", "Banco Pan合作贷（·LATAM）"],
  ["latam", "cash", "Solventa（·CO）"],
  ["latam", "cash", "Facio（·BR）"],
  ["africa", "cash", "FairMoney（·非洲）"],
  ["africa", "cash", "Newcredit（·NG）"],
  ["africa", "cash", "FairKash+（·非洲）"],
  ["africa", "cash", "KeCredit（·非洲）"],
  ["africa", "cash", "TiFi Slice（·非洲）"],
  ["africa", "cash", "Tloan（·非洲）"],
  ["africa", "cash", "Xcrosscash（·非洲）"],
  ["africa", "cash", "Carbon（·非洲）"],
  ["africa", "cash", "PalmCredit（·非洲）"],
  ["africa", "cash", "Branch（Branch·NG）"],
  ["africa", "cash", "Tala（Tala·KE）"],
  ["africa", "cash", "Zenka（·非洲）"],
  ["africa", "cash", "Okash（·非洲）"],
  ["mena", "cash", "Halan（·MENA）"],
  ["mena", "cash", "MoneyFellows（·MENA）"],
  ["mena", "cash", "ValU现金臂（·MENA）"],
  ["mena", "cash", "Contact（·MENA）"],
  ["africa", "cash", "LendPlus（·ZA）"],
  ["mena", "cash", "Halan（·EG）"],
  ["mena", "cash", "EasyGeneh（·EG）"],
  ["africa", "cash", "OKash（·NG）"],
  ["africa", "cash", "FinChoice（·ZA）"],
  ["africa", "cash", "TargetCredit（·GH）"],
  ["africa", "cash", "Hypera Cash（·KE）"],
  ["africa", "cash", "KKPesa（·TZ）"],
  ["west", "cash", "LendingClub（·US）"],
  ["west", "cash", "Prosper（·US）"],
  ["west", "cash", "SoFi Lending（·US）"],
  ["west", "cash", "Upgrade（·US）"],
  ["west", "cash", "Avant（·US）"],
  ["west", "cash", "Earnest（·US）"],
  ["west", "cash", "Best Egg（·US）"],
  ["west", "cash", "OneMain（·US）"],
  ["west", "cash", "OppLoans（·US）"],
  ["west", "cash", "CashNetUSA（·US）"],
  ["west", "cash", "EarnIn（·US）"],
  ["west", "cash", "Dave（·US）"],
  ["west", "cash", "Brigit（·US）"],
  ["west", "cash", "MoneyLion（·US）"],
  ["west", "cash", "Credit Genie（·US）"],
  ["west", "cash", "Younited Credit（·US）"],
  ["west", "cash", "Auxmoney（·US）"],
  ["west", "cash", "Smava（·US）"],
  ["west", "cash", "Cofidis（·US）"],
  ["east-asia", "bnpl", "蚂蚁/花呗（蚂蚁·CN）"],
  ["east-asia", "bnpl", "京东/白条（京东·CN）"],
  ["east-asia", "bnpl", "字节跳动/抖音月付（抖音·CN）"],
  ["east-asia", "bnpl", "美团/美团月付（美团·CN）"],
  ["east-asia", "bnpl", "唯品花（唯品花·CN）"],
  ["east-asia", "bnpl", "苏宁任性付（苏宁任性付·CN）"],
  ["east-asia", "bnpl", "携程拿去花（携程拿去花·CN）"],
  ["east-asia", "bnpl", "腾讯/分付（腾讯·CN）"],
  ["east-asia", "bnpl", "桔子分期（桔子分期·CN）"],
  ["east-asia", "bnpl", "分期乐（分期乐·CN）"],
  ["east-asia", "bnpl", "JP BNPL Paidy（·JP）"],
  ["se-asia", "bnpl", "SPayLater/Shopee/Sea（Shopee·SEA）"],
  ["se-asia", "bnpl", "Grab PayLater/Grab（Grab·SEA）"],
  ["se-asia", "bnpl", "GoPayLater/GoTo（GoTo·ID）"],
  ["se-asia", "bnpl", "Akulaku Cicilan/Akulaku（阿卡拉克·ID）"],
  ["se-asia", "bnpl", "Home Credit BNPL（·SEA）"],
  ["se-asia", "bnpl", "Indodana（·SEA）"],
  ["se-asia", "bnpl", "KreditPlus（·SEA）"],
  ["se-asia", "bnpl", "FIFGROUP（·SEA）"],
  ["se-asia", "bnpl", "BFI Finance（·SEA）"],
  ["se-asia", "bnpl", "AEON Credit MY/TH（·MY）"],
  ["se-asia", "bnpl", "Pace BNPL（·SEA）"],
  ["se-asia", "bnpl", "BillEase（·SEA）"],
  ["se-asia", "bnpl", "Cashalo（·SEA）"],
  ["se-asia", "bnpl", "Split新马（·SEA）"],
  ["south-asia", "bnpl", "Simpl（·IN）"],
  ["south-asia", "bnpl", "LazyPay（·IN）"],
  ["south-asia", "bnpl", "Snapmint（·IN）"],
  ["south-asia", "bnpl", "ZestMoney（·IN）"],
  ["south-asia", "bnpl", "Amazon Pay Later IN（·IN）"],
  ["south-asia", "bnpl", "Flipkart Pay Later（·IN）"],
  ["south-asia", "bnpl", "ePayLater（·IN）"],
  ["south-asia", "bnpl", "Postpe（·IN）"],
  ["south-asia", "bnpl", "Uni Cards（·IN）"],
  ["south-asia", "bnpl", "Slice（·IN）"],
  ["south-asia", "bnpl", "CRED mint（·IN）"],
  ["south-asia", "bnpl", "Bajaj Mall EMI（·IN）"],
  ["south-asia", "bnpl", "TVS Credit（·IN）"],
  ["latam", "bnpl", "Mercado Credito分期（·LATAM）"],
  ["latam", "bnpl", "Magalu parcelado（·LATAM）"],
  ["latam", "bnpl", "Casas Bahia CDC（·LATAM）"],
  ["latam", "bnpl", "Aplazo（Aplazo·MX）"],
  ["latam", "bnpl", "Kueski Pay（·LATAM）"],
  ["latam", "bnpl", "Clip BNPL（·LATAM）"],
  ["latam", "bnpl", "Sistecredito（·LATAM）"],
  ["latam", "bnpl", "Naranja X（·LATAM）"],
  ["latam", "bnpl", "Ualá卡分期（·LATAM）"],
  ["latam", "bnpl", "Ripley分期（·LATAM）"],
  ["latam", "bnpl", "Falabella CMR（·LATAM）"],
  ["latam", "bnpl", "DiDi Pay分期（·LATAM）"],
  ["latam", "bnpl", "Cuotitas南锥（·LATAM）"],
  ["mena", "bnpl", "Spotii（·MENA）"],
  ["mena", "bnpl", "Postpay（·MENA）"],
  ["mena", "bnpl", "Cashew（·MENA）"],
  ["mena", "bnpl", "Syarah分期（·MENA）"],
  ["mena", "bnpl", "ValU（·MENA）"],
  ["mena", "bnpl", "Souhoola（·MENA）"],
  ["mena", "bnpl", "Noon Pay Later（·MENA）"],
  ["mena", "bnpl", "Amazon AE分期（·MENA）"],
  ["africa", "bnpl", "Jumia Pay分期（·非洲）"],
  ["africa", "bnpl", "M-Pesa Fuliza（·非洲）"],
  ["africa", "bnpl", "OPay BNPL（·非洲）"],
  ["africa", "bnpl", "Carbon Shop（·非洲）"],
  ["west", "bnpl", "PayPal Pay in 4（·IN）"],
  ["west", "bnpl", "Apple Pay Later（·US）"],
  ["west", "bnpl", "Sezzle（·US）"],
  ["west", "bnpl", "Zip（·US）"],
  ["west", "bnpl", "Bread（·US）"],
  ["west", "bnpl", "Synchrony零售卡（·US）"],
  ["west", "bnpl", "Clearpay（·US）"],
  ["west", "bnpl", "Laybuy（·US）"],
  ["west", "bnpl", "Scalapay（·US）"],
  ["west", "bnpl", "Alma（·US）"],
  ["west", "bnpl", "PayPal欧盟分期（·EU）"],
  ["west", "bnpl", "DivideBuy（·US）"],
  ["east-asia", "lease", "平安租赁消费臂（平安租赁消费臂·CN）"],
  ["east-asia", "lease", "狮桥（狮桥·CN）"],
  ["east-asia", "lease", "悦租（悦租·CN）"],
  ["east-asia", "lease", "享借（享借·CN）"],
  ["east-asia", "lease", "机融租赁（机融租赁·CN）"],
  ["east-asia", "lease", "提钱乐租机（提钱乐租机·CN）"],
  ["east-asia", "lease", "花花租（花花租·CN）"],
  ["east-asia", "lease", "物主租赁（物主租赁·CN）"],
  ["east-asia", "lease", "优品租（优品租·CN）"],
  ["east-asia", "lease", "刀锋网络/租号玩（租号玩·CN）"],
  ["east-asia", "lease", "U号租（U号租·CN）"],
  ["se-asia", "lease", "Home Credit设备贷（·SEA）"],
  ["se-asia", "lease", "Samsung Finance SEA（·SEA）"],
  ["south-asia", "lease", "Samsung Finance+ IN（·IN）"],
  ["south-asia", "lease", "Bajaj 3C EMI（·IN）"],
  ["south-asia", "lease", "TVS Credit两轮（·IN）"],
  ["south-asia", "lease", "Mahindra车辆金融（·IN）"],
  ["south-asia", "lease", "Hero FinCorp（·IN）"],
  ["south-asia", "lease", "Tata车贷租赁（·IN）"],
  ["south-asia", "lease", "Zoomcar（·IN）"],
  ["south-asia", "lease", "Revv（·IN）"],
  ["south-asia", "lease", "Rentomojo（·IN）"],
  ["south-asia", "lease", "Furlenco（·IN）"],
  ["south-asia", "lease", "Cityfurnish（·IN）"],
  ["south-asia", "lease", "Home Credit IN设备（·IN）"],
  ["latam", "lease", "Allugator（·LATAM）"],
  ["latam", "lease", "Samsung巴西金融（·BR）"],
  ["latam", "lease", "Casas Bahia设备CDC（·LATAM）"],
  ["latam", "lease", "PayJoy MX（·MX）"],
  ["latam", "lease", "Coppel手机分期（·LATAM）"],
  ["latam", "lease", "Liverpool手机（·LATAM）"],
  ["latam", "lease", "Creditas车贷（·LATAM）"],
  ["latam", "lease", "Localiza订阅（·LATAM）"],
  ["latam", "lease", "Movida订阅（·LATAM）"],
  ["latam", "lease", "Kinto订阅（·LATAM）"],
  ["latam", "lease", "Moto融资CO/BR（·BR）"],
  ["africa", "lease", "Sun King PAYG（·非洲）"],
  ["africa", "lease", "d.light（·非洲）"],
  ["africa", "lease", "FairMoney设备（·非洲）"],
  ["west", "lease", "Synchrony苹果包（·US）"],
  ["west", "lease", "DLL设备租赁（·US）"],
  ["west", "lease", "Element Fleet（·US）"],
  ["west", "lease", "FINN汽车订阅（·US）"],
  ["west", "lease", "Sixt+（·US）"],
  ["west", "lease", "Care by Volvo（·US）"],
  ["west", "lease", "Porsche Drive（·US）"],
  ["west", "lease", "FlexShopper（·US）"],
  ["west", "lease", "Katapult（·US）"],
  ["west", "lease", "Aaron's（·US）"],
  ["west", "lease", "Progressive Leasing（·US）"],
  ["west", "lease", "Acima（·US）"],
  // 优先名册缺口补种（2026-08-11）：信贷原生待建档
  ["latam", "cash", "Stori（Stori·MX）"],
  ["latam", "bnpl", "Aplazo（Aplazo·MX）"],
  ["latam", "cash", "Kueski（Kueski·MX）"],
  ["mena", "bnpl", "Hepsiburada Finans/Hepsiburada（Hepsiburada·TR）"],
  ["mena", "bnpl", "Trendyol Finans/Trendyol（Trendyol·TR）"],
];

const sceneCrmSeeds: SceneSeed[] = sceneCrmSeedTuples.map(
  ([region, group, sceneType, creditAttach]) => ({
    region,
    group,
    sceneType,
    creditAttach,
  }),
);

// AUTO: 路飞的海外风控笔记 Google Play 借款榜 2026-08-01 扩表
const luffyCreditSeedTuples: [Exclude<Region, "all">, "cash" | "bnpl" | "lease" | "agent", string][] = [
  // --- agent ---
  ["se-asia", "agent", "PinjamPasti（·ID）"],
  ["se-asia", "agent", "Yup（·ID）"],
  ["se-asia", "agent", "UangIndo（·ID）"],
  ["se-asia", "agent", "Uang Sahabat（·ID）"],
  ["se-asia", "agent", "Tunai Cakra（·ID）"],
  ["se-asia", "agent", "Dana Yuk（·ID）"],
  ["se-asia", "agent", "PinjamAmanah（·ID）"],
  ["se-asia", "agent", "UiPinjam（·ID）"],
  ["se-asia", "agent", "PinjamPlus（·ID）"],
  ["se-asia", "agent", "Kredit Kancil（·ID）"],
  ["se-asia", "agent", "Pinjam Aja（·ID）"],
  ["se-asia", "agent", "Tiền24（·VN）"],
  ["se-asia", "agent", "Hẹn Mức+（·VN）"],
  ["se-asia", "agent", "Sen Vay（·VN）"],
  ["se-asia", "agent", "VayTínPhát（·VN）"],
  ["se-asia", "agent", "Vay Nhanh FinSearch（·VN）"],
  ["se-asia", "agent", "An Tâm Vay（·VN）"],
  ["se-asia", "agent", "CreditXpress（·MY）"],
  ["se-asia", "agent", "Paylaju EX（·MY）"],
  ["se-asia", "agent", "LoanCepat（·MY）"],
  ["se-asia", "agent", "Duit Now（·MY）"],
  ["se-asia", "agent", "ProLoan（·MY）"],
  ["se-asia", "agent", "Kasih Kredit（·MY）"],
  ["se-asia", "agent", "DuitGo（·MY）"],
  ["se-asia", "agent", "พามาแก้โจทย์（·TH）"],
  ["se-asia", "agent", "Spe（·TH）"],
  ["se-asia", "agent", "ไปทำขับดี（·TH）"],
  ["se-asia", "agent", "เงินเหลือในกระเป๋า（·TH）"],
  ["south-asia", "agent", "GoCredit（·IN）"],
  ["south-asia", "agent", "SwipeLoan（·IN）"],
  ["south-asia", "agent", "Paizo（·IN）"],
  ["south-asia", "agent", "FlexiBee（·IN）"],
  ["south-asia", "agent", "Bajaj Markets（·IN）"],
  ["south-asia", "agent", "PayMe（·IN）"],
  ["south-asia", "agent", "LoanVanta（·IN）"],
  ["south-asia", "agent", "Quid（·IN）"],
  ["south-asia", "agent", "Cridgo（·IN）"],
  ["south-asia", "agent", "CreditSea（·IN）"],
  ["south-asia", "agent", "Muthoot FinCorp ONE（·IN）"],
  ["south-asia", "agent", "BrightLoans（·IN）"],
  ["south-asia", "agent", "Kredit Rupee（·IN）"],
  ["south-asia", "agent", "Buddy Loan（·IN）"],
  ["south-asia", "agent", "PopKash（·BD）"],
  ["south-asia", "agent", "Dost Loan（·BD）"],
  ["south-asia", "agent", "ALO Kash（·BD）"],
  ["south-asia", "agent", "TakaGo Pro（·BD）"],
  ["south-asia", "agent", "Loan Haat（·BD）"],
  ["south-asia", "agent", "GrowPak e-Loan Manager（·PK）"],
  ["south-asia", "agent", "Online Loans Sri Lanka（·LK）"],
  ["south-asia", "agent", "Loanme（·LK）"],
  ["south-asia", "agent", "ProLoan（·LK）"],
  ["latam", "agent", "Dinero Rápido UD（·MX）"],
  ["latam", "agent", "Préstamo Personal en línea（·MX）"],
  ["latam", "agent", "ClipCash（·MX）"],
  ["latam", "agent", "Dinero Fácil MX（·MX）"],
  ["latam", "agent", "Préstamo Rápido Cash（·MX）"],
  ["latam", "agent", "Más Efectivo（·CO）"],
  ["latam", "agent", "Finversor（·CO）"],
  ["latam", "agent", "ColombiaFin（·CO）"],
  ["latam", "agent", "Crédito Fácil y Rápido（·CO）"],
  ["latam", "agent", "Préstamos Personales en línea（·CO）"],
  ["latam", "agent", "Aprov（·BR）"],
  ["latam", "agent", "PazCrédito（·BR）"],
  ["latam", "agent", "Empréstimos Pessoais Rápidos（·BR）"],
  ["latam", "agent", "Credit Card Matcher（·BR）"],
  ["latam", "agent", "Aro（·BR）"],
  ["latam", "agent", "Crédito Popular（·BR）"],
  ["latam", "agent", "CloQ（·BR）"],
  ["latam", "agent", "Empréstimo SIM（·BR）"],
  ["latam", "agent", "PegaCrédito（·BR）"],
  ["latam", "agent", "Préstamo Personal con DNI（·AR）"],
  ["latam", "agent", "PlataPro（·AR）"],
  ["latam", "agent", "Molina Plata（·AR）"],
  ["latam", "agent", "CrediRey（·AR）"],
  ["latam", "agent", "ElegiCrédito（·AR）"],
  ["latam", "agent", "FlyCred（·AR）"],
  ["latam", "agent", "CreContigo（·PE）"],
  ["latam", "agent", "QullqiFacil（·PE）"],
  ["latam", "agent", "SolPrestamo（·PE）"],
  ["latam", "agent", "PlataPro（·PE）"],
  ["latam", "agent", "Mi Credito Peru（·PE）"],
  ["latam", "agent", "PlazaCrédito（·CL）"],
  ["latam", "agent", "PlataPro（·CL）"],
  ["latam", "agent", "DineroAhora（·CL）"],
  ["latam", "agent", "Prestamos Online Ecuador（·EC）"],
  ["latam", "agent", "Efectivo Ya（·EC）"],
  ["africa", "agent", "CashX（·NG）"],
  ["africa", "agent", "Futurecash（·NG）"],
  ["africa", "agent", "GetKash（·NG）"],
  ["africa", "agent", "Quick Loan Easy Cash（·GH）"],
  ["africa", "agent", "Personal Loans Quick Cash（·ZA）"],
  ["africa", "agent", "Credit Card Easy approval（·ZA）"],
  ["africa", "agent", "Quick Loan（·UG）"],
  ["africa", "agent", "Pesa Go（·UG）"],
  ["africa", "agent", "MSACCO（·UG）"],
  ["africa", "agent", "Ozzy pesa（·TZ）"],
  ["africa", "agent", "Pesa Max（·TZ）"],
  ["central-asia", "agent", "OrdaCredit（·KZ）"],
  ["central-asia", "agent", "Банки.ру（KZ/KG/UZ·路飞中介）"],
  ["central-asia", "agent", "Банк Онлайн系列（中亚·路飞中介）"],
  ["central-asia", "agent", "Finko（·UZ）"],
  ["central-asia", "agent", "Finq（·UZ）"],
  ["central-asia", "agent", "Onlayn qarzlar（·UZ）"],
  ["se-asia", "cash", "Danaku（·ID）"],
  ["se-asia", "cash", "FinPlus（·ID）"],
  ["se-asia", "cash", "Adapundi（·ID）"],
  ["se-asia", "cash", "Pinjam Yuk（·ID）"],
  ["se-asia", "cash", "Indosaku（·ID）"],
  ["se-asia", "cash", "Artha Niaga（·ID）"],
  ["se-asia", "cash", "Cairin（·ID）"],
  ["se-asia", "cash", "BantuSaku（·ID）"],
  ["se-asia", "cash", "UATAS（·ID）"],
  ["se-asia", "cash", "PinjamDuit（·ID）"],
  ["se-asia", "cash", "Lumbung Dana（·ID）"],
  ["se-asia", "cash", "Cashcepat（·ID）"],
  ["se-asia", "cash", "Pinjamin（·ID）"],
  ["se-asia", "cash", "Dana Pinjam（·ID）"],
  ["se-asia", "cash", "Singa Fintech（·ID）"],
  ["se-asia", "cash", "Kredito（·ID）"],
  ["se-asia", "cash", "UKU（·ID）"],
  ["se-asia", "cash", "KTA KILAT（·ID）"],
  ["se-asia", "cash", "KreditOK（·ID）"],
  ["se-asia", "cash", "Samir（·ID）"],
  ["se-asia", "cash", "Ada Modal（·ID）"],
  ["se-asia", "cash", "KlikKami（·ID）"],
  ["se-asia", "cash", "FE ONLINE（·VN）"],
  ["se-asia", "cash", "Home Credit VN（·VN）"],
  ["se-asia", "cash", "Dola Dong（·VN）"],
  ["se-asia", "cash", "Ví Tốt（·VN）"],
  ["se-asia", "cash", "VayDễ（·VN）"],
  ["se-asia", "cash", "GemCredit（·VN）"],
  ["se-asia", "cash", "VayNhanh（·VN）"],
  ["se-asia", "cash", "Canaan Tôi（·VN）"],
  ["se-asia", "cash", "CỏLiền（·VN）"],
  ["se-asia", "cash", "iShinhan（·VN）"],
  ["se-asia", "cash", "Sdong（·VN）"],
  ["se-asia", "cash", "Vietdong（·VN）"],
  ["se-asia", "cash", "AnTin（·VN）"],
  ["se-asia", "cash", "Ví Tiện Lợi（·VN）"],
  ["se-asia", "cash", "Ví Vàng（·VN）"],
  ["se-asia", "cash", "HIFI CREDIT（·VN）"],
  ["se-asia", "cash", "Tala VN（·VN）"],
  ["se-asia", "cash", "FinVui（·VN）"],
  ["se-asia", "cash", "SHBFinance（·VN）"],
  ["se-asia", "cash", "TiềnDễ（·VN）"],
  ["se-asia", "cash", "VayMax（·VN）"],
  ["se-asia", "cash", "Mdong（·VN）"],
  ["se-asia", "cash", "Bình Lạc（·VN）"],
  ["se-asia", "cash", "Vitalloc（·VN）"],
  ["se-asia", "cash", "CUB Vietnam（·VN）"],
  ["se-asia", "cash", "Cần Là Có（·VN）"],
  ["se-asia", "cash", "Siêu vay（·VN）"],
  ["se-asia", "cash", "Sika Rush（·VN）"],
  ["se-asia", "cash", "HD Saison（·VN）"],
  ["se-asia", "cash", "Tiger Dong（·VN）"],
  ["se-asia", "cash", "Vốn Nhanh（·VN）"],
  ["se-asia", "cash", "VayĐồng（·VN）"],
  ["se-asia", "cash", "FastRinggit（·MY）"],
  ["se-asia", "cash", "Tambadana（·MY）"],
  ["se-asia", "cash", "FlexiDuit（·MY）"],
  ["se-asia", "cash", "Evo Credit（·MY）"],
  ["se-asia", "cash", "Fundora（·MY）"],
  ["se-asia", "cash", "Nimbura（·MY）"],
  ["se-asia", "cash", "Finroro（·MY）"],
  ["se-asia", "cash", "Adacash（·MY）"],
  ["se-asia", "cash", "DanaHero（·MY）"],
  ["se-asia", "cash", "WantKash（·MY）"],
  ["se-asia", "cash", "KreditMy（·MY）"],
  ["se-asia", "cash", "CashNow MY（·MY）"],
  ["se-asia", "cash", "J-Clicks（·MY）"],
  ["se-asia", "cash", "Emicro Loan（·MY）"],
  ["se-asia", "cash", "Pinjamin MY（·MY）"],
  ["se-asia", "cash", "SpeedyAid（·MY）"],
  ["se-asia", "cash", "mudahpinjam（·MY）"],
  ["se-asia", "cash", "557 Pinjaman（·MY）"],
  ["se-asia", "cash", "Pantas Loan（·MY）"],
  ["se-asia", "cash", "SHENMA Mobile（·MY）"],
  ["se-asia", "cash", "Happy Pinjaman（·MY）"],
  ["se-asia", "cash", "Fast Loan MY（·MY）"],
  ["se-asia", "cash", "Trust Loans MY（·MY）"],
  ["se-asia", "cash", "MAXS Pinjaman（·MY）"],
  ["se-asia", "cash", "FairMoney MY（·MY）"],
  ["se-asia", "cash", "Pinjaman Red Sun（·MY）"],
  ["se-asia", "cash", "อิ่มคล่อง（·TH）"],
  ["se-asia", "cash", "เงินติดมือ（·TH）"],
  ["se-asia", "cash", "A money（·TH）"],
  ["se-asia", "cash", "SmartCash TH（·TH）"],
  ["se-asia", "cash", "Good Money GSB（·TH）"],
  ["se-asia", "cash", "Loan Hub（·TH）"],
  ["se-asia", "cash", "PROMISE（·TH）"],
  ["se-asia", "cash", "นึกจัด（·TH）"],
  ["se-asia", "cash", "มินิมอล（·TH）"],
  ["se-asia", "cash", "อุ่นใจ（·TH）"],
  ["se-asia", "cash", "สินเชื่อบีบี（·TH）"],
  ["se-asia", "cash", "EASY สินเชื่อ（·TH）"],
  ["se-asia", "cash", "อีซี่บาย（·TH）"],
  ["se-asia", "cash", "มีตัง（·TH）"],
  ["se-asia", "cash", "กู้ง่ายๆ（·TH）"],
  ["se-asia", "cash", "FINNIX（·TH）"],
  ["se-asia", "cash", "Thong（·TH）"],
  ["se-asia", "cash", "CardX（·TH）"],
  ["se-asia", "cash", "ปลาร้า（·TH）"],
  ["se-asia", "cash", "ฟาร์มอีส（·TH）"],
  ["se-asia", "cash", "PAYPAYA（·TH）"],
  ["se-asia", "cash", "ชัยแคปิตอล（·TH）"],
  ["se-asia", "cash", "MoneyThunder（·TH）"],
  ["se-asia", "cash", "MoneyElephant（·TH）"],
  ["se-asia", "cash", "Umay+（·TH）"],
  ["se-asia", "cash", "สมใจ（·TH）"],
  ["se-asia", "cash", "Rabbit Cash（·TH）"],
  ["se-asia", "cash", "Nebula Cash（·TH）"],
  ["se-asia", "cash", "Kashjoy（·TH）"],
  ["se-asia", "cash", "PocketLend（·TH）"],
  ["se-asia", "cash", "Gad Cash（·TH）"],
  ["se-asia", "cash", "GagaCredit（·TH）"],
  ["se-asia", "cash", "Credit Cash PH（·PH）"],
  ["se-asia", "cash", "Skyro（·PH）"],
  ["se-asia", "cash", "Pesoloan（·PH）"],
  ["se-asia", "cash", "Tekcash（·PH）"],
  ["se-asia", "cash", "Cashify PH（·PH）"],
  ["se-asia", "cash", "Peso Cash Loan（·PH）"],
  ["se-asia", "cash", "PeraMoo（·PH）"],
  ["se-asia", "cash", "Mr. Cash（·PH）"],
["south-asia", "cash", "Kissht（·IN）"],
  ["south-asia", "cash", "True Balance（·IN）"],
  ["south-asia", "cash", "FatakPay（·IN）"],
  ["south-asia", "cash", "PayRupik（·IN）"],
  ["south-asia", "cash", "DMI（·IN）"],
  ["south-asia", "cash", "Home Credit（·IN）"],
  ["south-asia", "cash", "Poonawalla（·IN）"],
  ["south-asia", "cash", "ASH Money（·BD）"],
  ["south-asia", "cash", "FinCash（·BD）"],
  ["south-asia", "cash", "CashCorner（·BD）"],
  ["south-asia", "cash", "Cashora（·BD）"],
  ["south-asia", "cash", "QuickLoan（·BD）"],
  ["south-asia", "cash", "DhakaFin（·BD）"],
  ["south-asia", "cash", "BBL Shubidha（·BD）"],
  ["south-asia", "cash", "wagely（·BD）"],
  ["south-asia", "cash", "BongoCash（·BD）"],
  ["south-asia", "cash", "Paisayaar（·PK）"],
  ["south-asia", "cash", "SmartQarza（·PK）"],
  ["south-asia", "cash", "Moneyview（·IN）"],
  ["south-asia", "cash", "mPokket（·IN）"],
  ["south-asia", "cash", "PayWithRing（·IN）"],
  ["south-asia", "cash", "Daira（·PK）"],
  ["south-asia", "cash", "Aitemaad（·PK）"],
  ["south-asia", "cash", "Fauri Cash（·PK）"],
  ["south-asia", "cash", "SAHARA（·PK）"],
  ["south-asia", "cash", "QarzMitra（·PK）"],
  ["south-asia", "cash", "ForiQarz（·PK）"],
  ["south-asia", "cash", "PakCredit（·PK）"],
  ["south-asia", "cash", "OnCredit（·LK）"],
  ["south-asia", "cash", "HastyCredit（·LK）"],
  ["south-asia", "cash", "InsCash（·LK）"],
  ["south-asia", "cash", "Loan Plus（·LK）"],
  ["south-asia", "cash", "CashGedara（·LK）"],
  ["south-asia", "cash", "LakCash（·LK）"],
  ["south-asia", "cash", "CashMate（·LK）"],
  ["south-asia", "cash", "Kreditone（·LK）"],
  ["south-asia", "cash", "MyKredit（·LK）"],
  ["latam", "cash", "Duai（·MX）"],
  ["latam", "cash", "TiiT（·MX）"],
  ["latam", "cash", "Kaby（·MX）"],
  ["latam", "cash", "LaLANITA（·MX）"],
  ["latam", "cash", "Qrece（·MX）"],
  ["latam", "cash", "PréstamoClaro（·MX）"],
  ["latam", "cash", "Rápikrédito（·MX）"],
  ["latam", "cash", "We Finanzas（·MX）"],
  ["latam", "cash", "ALA（·MX）"],
  ["latam", "cash", "Moneyman（·MX）"],
  ["latam", "cash", "Boaya（·MX）"],
  ["latam", "cash", "Cresia（·MX）"],
  ["latam", "cash", "OKDinero（·MX）"],
  ["latam", "cash", "PrestaGo（·MX）"],
  ["latam", "cash", "LuckyPlata（·CO）"],
  ["latam", "cash", "Rapid Crédito（·CO）"],
  ["latam", "cash", "Dinerbacano（·CO）"],
  ["latam", "cash", "CrediApoyo（·CO）"],
  ["latam", "cash", "Platayuda（·CO）"],
  ["latam", "cash", "Crédito365（·CO）"],
  ["latam", "cash", "RapidoCash（·CO）"],
  ["latam", "cash", "Zala（·CO）"],
  ["latam", "cash", "LanaYa（·CO）"],
  ["latam", "cash", "CréditoLeve（·BR）"],
  ["latam", "cash", "Blipay（·BR）"],
  ["latam", "cash", "meutudo（·BR）"],
  ["latam", "cash", "Jeitto（·BR）"],
  ["latam", "cash", "Crefisa+（·BR）"],
  ["latam", "cash", "ElevaCrédito（·BR）"],
  ["latam", "cash", "ProntoCrédito（·BR）"],
  ["latam", "cash", "Ágil（·BR）"],
  ["latam", "cash", "NoVerde（·BR）"],
  ["latam", "cash", "Bullla（·BR）"],
  ["latam", "cash", "Micro Dinero（·AR）"],
  ["latam", "cash", "Mony24（·AR）"],
  ["latam", "cash", "Flux（·AR）"],
  ["latam", "cash", "CrediToque（·AR）"],
  ["latam", "cash", "Pitage（·AR）"],
  ["latam", "cash", "MatePlata（·AR）"],
  ["latam", "cash", "KooPlata（·AR）"],
  ["latam", "cash", "Moni（·AR）"],
  ["latam", "cash", "Voda（·AR）"],
  ["latam", "cash", "Filo Credito（·AR）"],
  ["latam", "cash", "vana（·PE）"],
  ["latam", "cash", "Yapi Cash（·PE）"],
  ["latam", "cash", "Kashin（·PE）"],
  ["latam", "cash", "Sol Dinero（·PE）"],
  ["latam", "cash", "Doctor Sol（·PE）"],
  ["latam", "cash", "IllariCred（·PE）"],
  ["latam", "cash", "SolPresta（·CL）"],
  ["latam", "cash", "Súper Préstamo（·CL）"],
  ["latam", "cash", "CreditoJusto（·CL）"],
  ["latam", "cash", "ConfiCrédito（·CL）"],
  ["latam", "cash", "Sumak（·EC）"],
  ["latam", "cash", "KillaPay（·EC）"],
  ["latam", "cash", "DineroAlInstante（·EC）"],
  ["latam", "cash", "PlatoVerde（·EC）"],
  ["latam", "cash", "MiDólar（·EC）"],
  ["latam", "cash", "DaleCredi（·EC）"],
  ["mena", "cash", "LoanEgp（·EG）"],
  ["mena", "cash", "Khazna（·EG）"],
  ["mena", "cash", "YallaCash（·EG）"],
  ["mena", "cash", "HelaLoan（·EG）"],
  ["mena", "cash", "Tamweelk（·EG）"],
  ["mena", "cash", "Sanaddak（·EG）"],
  ["mena", "cash", "Lime（·EG）"],
  ["africa", "cash", "EaseMoni（·NG）"],
  ["africa", "cash", "Quickash（·NG）"],
  ["africa", "cash", "Ease Cash（·NG）"],
  ["africa", "cash", "9Credit（·NG）"],
  ["africa", "cash", "AidaCredit（·NG）"],
  ["africa", "cash", "Frimoni（·NG）"],
  ["africa", "cash", "Hypera（·KE）"],
  ["africa", "cash", "ZK Pesa（·KE）"],
  ["africa", "cash", "Koro（·KE）"],
  ["africa", "cash", "Tuma（·KE）"],
  ["africa", "cash", "Linker（·KE）"],
  ["africa", "cash", "AdvancePesa（·KE）"],
  ["africa", "cash", "Fido（·GH）"],
  ["africa", "cash", "Loan Base（·GH）"],
  ["africa", "cash", "Onua（·GH）"],
  ["africa", "cash", "AyaLend（·GH）"],
  ["africa", "cash", "Gh loans（·GH）"],
  ["africa", "cash", "MoniLend（·GH）"],
  ["africa", "cash", "Palm Loan（·GH）"],
  ["africa", "cash", "Paymenow（·ZA）"],
  ["africa", "cash", "PrimeLoans（·ZA）"],
  ["africa", "cash", "Aloan（·ZA）"],
  ["africa", "cash", "CashNow（·ZA）"],
  ["africa", "cash", "AlloCash（·CI）"],
  ["africa", "cash", "CréditVif（·CI）"],
  ["africa", "cash", "Flèche Prêt（·CI）"],
  ["africa", "cash", "Monifi（·CI）"],
  ["africa", "cash", "Dexter（·CI）"],
  ["africa", "cash", "Ivoireloan（·CI）"],
  ["africa", "cash", "Cash Link（·UG）"],
  ["africa", "cash", "Cash Mates（·UG）"],
  ["africa", "cash", "Chaploan（·UG）"],
  ["africa", "cash", "DoveCash（·UG）"],
  ["africa", "cash", "FunaLoan（·UG）"],
  ["africa", "cash", "PesaTuma（·TZ）"],
  ["africa", "cash", "PesaYangu（·TZ）"],
  ["africa", "cash", "Minute Mkopo（·TZ）"],
  ["africa", "cash", "PesaWOW（·TZ）"],
  ["africa", "cash", "Mix Mkopo（·TZ）"],
  ["africa", "cash", "Wamaka（·ZM）"],
  ["africa", "cash", "Sedeas（·ZM）"],
  ["africa", "cash", "Impiya（·ZM）"],
  ["africa", "cash", "FlipmoCredit（·ZM）"],
  ["africa", "cash", "Zedloan（·ZM）"],
  ["africa", "cash", "ZeedLoans（·ZM）"],
  ["central-asia", "cash", "OrdaCredit（·KZ）"],
  ["central-asia", "cash", "Nomad Credit（·KZ）"],
  ["central-asia", "cash", "Cash Bee（·KZ）"],
  ["central-asia", "cash", "EQCredit（·KZ）"],
  ["central-asia", "cash", "Solva（·KZ）"],
  ["central-asia", "cash", "ZaimBee（·KZ）"],
  ["central-asia", "cash", "Vivus（·KZ）"],
  ["central-asia", "cash", "М Булак（·KG）"],
  ["central-asia", "cash", "Элет-Капитал（·KG）"],
  ["central-asia", "cash", "Байлык 24（·KG）"],
  ["central-asia", "cash", "ABN24（·KG）"],
  ["central-asia", "cash", "Байбол（·KG）"],
  ["central-asia", "cash", "ТезФинанс（·KG）"],
  ["central-asia", "cash", "InvesCore（·KG）"],
  ["central-asia", "cash", "Una Moliya（·UZ）"],
  ["central-asia", "cash", "Paystep（·UZ）"],
  ["central-asia", "cash", "Onlayn Mikrokreditlar（·UZ）"],
  ["central-asia", "cash", "WinGo（·UZ）"],
  ["se-asia", "bnpl", "Kredivo（·ID）"],
  ["se-asia", "bnpl", "Indodana（·ID）"],
  ["se-asia", "bnpl", "Honest（·ID）"],
  ["se-asia", "bnpl", "YesssCredit（·ID）"],
  ["se-asia", "bnpl", "Kredivo VN（·）"],
  ["se-asia", "bnpl", "AhaPay（·MY）"],
  ["se-asia", "bnpl", "Lenda Pay（·MY）"],
  ["se-asia", "bnpl", "UFUND（·TH）"],
  ["se-asia", "bnpl", "Kredivo TH（·TH）"],
  ["se-asia", "bnpl", "Billease（·PH）"],
  ["se-asia", "bnpl", "Luvit x Junahand（·PH）"],
  ["se-asia", "bnpl", "Kredivo PH（·PH）"],
  ["south-asia", "bnpl", "0% EMI Shopping App（·IN）"],
  ["south-asia", "bnpl", "eRin Device（·BD）"],
  ["south-asia", "bnpl", "PalmPay PK（·PK）"],
  ["south-asia", "bnpl", "Alif Shop（·PK）"],
  ["south-asia", "bnpl", "BaadMay（·PK）"],
  ["south-asia", "bnpl", "Tabby PK（·PK）"],
  ["south-asia", "bnpl", "Tabby LK（·）"],
  ["latam", "bnpl", "APLAZO（·MX）"],
  ["latam", "bnpl", "Addi Shop（·CO）"],
  ["latam", "bnpl", "Cashea CO（·CO）"],
  ["latam", "bnpl", "Krece CO（·CO）"],
  ["latam", "bnpl", "Quac（·CO）"],
  ["latam", "bnpl", "Koin（·BR）"],
  ["latam", "bnpl", "Pagaleve（·BR）"],
  ["latam", "bnpl", "SuperSim（·BR）"],
  ["latam", "bnpl", "Cartão Pernambucanas（·BR）"],
  ["latam", "bnpl", "Nova（·BR）"],
  ["latam", "bnpl", "Ume（·BR）"],
  ["latam", "bnpl", "PayJoy BR（·BR）"],
  ["latam", "bnpl", "novücard（·BR）"],
  ["latam", "bnpl", "Credicuotas（·AR）"],
  ["latam", "bnpl", "GOcuotas（·AR）"],
  ["latam", "bnpl", "Krece PE（·）"],
  ["latam", "bnpl", "Cashea CL（·CL）"],
  ["latam", "bnpl", "Krece CL（·CL）"],
  ["latam", "bnpl", "CrediTotal（·CL）"],
  ["latam", "bnpl", "EMMA（·EC）"],
  ["latam", "bnpl", "Cashea EC（·EC）"],
  ["mena", "bnpl", "seven（·EG）"],
  ["mena", "bnpl", "mylo（·EG）"],
  ["mena", "bnpl", "Forsa Finance（·EG）"],
  ["mena", "bnpl", "Valu（·EG）"],
  ["mena", "bnpl", "Souhoola（·EG）"],
  ["mena", "bnpl", "Mogo（·EG）"],
  ["mena", "bnpl", "TRU（·EG）"],
  ["mena", "bnpl", "Premium Card（·EG）"],
  ["mena", "bnpl", "Takka（·EG）"],
  ["mena", "bnpl", "Blink（·EG）"],
  ["mena", "bnpl", "Tamara EG（·EG）"],
  ["mena", "bnpl", "Tabby EG（·EG）"],
  ["mena", "bnpl", "Raya Elite（·EG）"],
  ["africa", "bnpl", "TunaCredit（·NG）"],
  ["africa", "bnpl", "SapaClear（·NG）"],
  ["africa", "bnpl", "Easybuy NG（·NG）"],
  ["africa", "bnpl", "PixKudi（·NG）"],
  ["africa", "bnpl", "OnfonMobile（·KE）"],
  ["africa", "bnpl", "PayJustNow（·ZA）"],
  ["africa", "bnpl", "Payflex（·ZA）"],
  ["africa", "bnpl", "Happy Pay（·ZA）"],
  ["africa", "bnpl", "mobicred（·ZA）"],
  ["africa", "bnpl", "Klarna ZA（·ZA）"],
  ["africa", "bnpl", "Easybuy CI（·）"],
  ["africa", "bnpl", "Easybuy TZ（·）"],
  ["africa", "bnpl", "Easy Bills ZM（·）"],
  ["central-asia", "bnpl", "INSAF FINANCE（·KG）"],
  ["central-asia", "bnpl", "Uzum Nasiya（·UZ）"],
  ["central-asia", "bnpl", "Variant nasiya（·UZ）"],
  ["central-asia", "bnpl", "Open Muddatli（·UZ）"],
  ["central-asia", "bnpl", "Rahmat（·UZ）"],
  // end luffy expand
];

const luffyCreditSeeds: CreditSeed[] = luffyCreditSeedTuples.map(([region, line, group]) => ({
  region,
  line,
  group,
}));

const creditCrmSeeds: CreditSeed[] = (() => {
  const base = creditCrmSeedTuples.map(([region, line, group]) => ({
    region,
    line,
    group,
  }));
  const seen = new Set(base.map((s) => s.group));
  const fromOfficial = OFFICIAL_LICENSE_HOLDERS.filter((h) => !seen.has(h.group)).map((h) => ({
    region: h.region,
    line: h.line,
    group: h.group,
  }));
  return [...base, ...fromOfficial];
})();

function expandSceneSeeds(seeds: SceneSeed[]): SceneDraft[] {
  return seeds.map((s) => {
    const hint = `${s.sceneType} ${s.creditAttach}`;
    const subTags = resolveSceneSubTags(s.group, hint);
    const tags = resolveSceneTags(s.group, hint);
    const isMn = /·MN[）)]/.test(s.group) || s.group.includes("·MN）");
    return {
      region: s.region,
      group: s.group,
      tags,
      subTags,
      sceneType: formatSceneTags(tags, subTags),
      apps: s.group,
      countries: isMn ? "外蒙古" : REGION_COUNTRY[s.region],
      languages: isMn ? "蒙古语/英语" : "待核实",
      mau: "待核实",
      registered: "待核实",
      share: "待核实",
      creditAttach: s.creditAttach,
      diandian: "CRM扩表·点点/路飞位次待补",
      controller: "待核实",
      equity: "待核实",
      licenseReg: isMn
        ? "外蒙古：FRC NBFI/电子支付等（非银行吸储；待名录逐条核验）"
        : "〔1〕：监管名录未逐条核验",
      trafficRank: "〔1〕：GP/Apple/点点/路飞待补",
      verify: "待双端" as const,
    };
  });
}

function expandCreditSeeds(seeds: CreditSeed[], source: "crm" | "luffy" = "crm"): CreditDraft[] {
  const licenseByRegionLine: Record<
    Exclude<Region, "all">,
    Record<"cash" | "bnpl" | "lease" | "agent", string>
  > = {
    "east-asia": {
      cash: "中国：地方小贷/助贷/持牌消金（非吸储）",
      bnpl: "中国：小贷/消费信贷合作（非吸储）",
      lease: "中国：融资租赁/租赁经营",
      agent: "中国：导流/助贷/比价（常无自有放贷牌；合作路径见资金方）",
    },
    "se-asia": {
      cash: "按国：ID=OJK LPBBTI/Multifinance；PH=SEC Lending/Financing+OLP；VN=SBV金融公司；MY=BNM非银信贷；TH=BOT P-Loan/Nano",
      bnpl: "按国：ID=Multifinance/BNPL；PH=SEC Financing+OLP；其余本地消费信贷",
      lease: "按国：多金融/设备融资/电信合约机",
      agent: "按国：贷超/比价/导流（路飞「中介」；常无自有放贷牌，PH等或要求OLP/中介登记）",
    },
    "south-asia": {
      cash: "按国：IN=RBI NBFC CoR（非吸储）；PK=SECP Lending NBFC；BD=BB NBFI/MRA；LK=CBSL LFC",
      bnpl: "按国：IN=RBI NBFC/合作银行EMI；其余本地",
      lease: "按国：IN=NBFC车辆/设备；LK=LFC租赁交叉",
      agent: "按国：贷款超市/比价/DSA导流（路飞「中介」；持牌/登记要求因国而异）",
    },
    "central-asia": {
      cash: "按国：KZ/UZ等=MFO微金融/非银放贷牌照（非吸储银行）",
      bnpl: "按国：分期/nasiya类金融公司或银行合作",
      lease: "设备/车辆融资租赁（本地另计）",
      agent: "按国：比价/导流/贷超（路飞「中介」；持牌要求因国而异）",
    },
    latam: {
      cash: "按国：MX=SOFOM/SOFIPO等；BR=SCD/金融公司；其余本地金融公司",
      bnpl: "按国：BNPL/融资公司小牌照",
      lease: "设备租赁/lease-to-own/电信合约",
      agent: "按国：比价/导流/贷超（路飞「中介」；持牌要求因国而异）",
    },
    mena: {
      cash: "按国：EG/MA等非银放贷；GCC=SAMA/CBUAE等金融公司（非吸储银行主叙事）",
      bnpl: "按国：SAMA/CBUAE等金融公司/BNPL牌照；埃及消费分期公司",
      lease: "设备分期/汽车金融（本地另计）",
      agent: "按国：比价/导流/贷超（路飞「中介」；持牌要求因国而异）",
    },
    africa: {
      cash: "按国：微金融/数字信贷/非银放贷牌照（非央行吸储银行）",
      bnpl: "按国：BNPL/消费信贷或移动货币信贷合作",
      lease: "PAYG资产融资/设备分期/太阳能与手机融资",
      agent: "按国：比价/导流/贷超（路飞「中介」；持牌要求因国而异）",
    },
    west: {
      cash: "按国：州放贷牌照/消费信贷牌照/银行合作（非全能银行叙事）",
      bnpl: "按国：BNPL/消费信贷牌照或银行合作",
      lease: "rent-to-own/融资租赁/车队租赁",
      agent: "按国：贷款比价/broker（常非自营放贷；个别州要求经纪登记）",
    },
  };

  return seeds.map((s) => {
    const fromLuffy = source === "luffy" || s.group.includes("路飞");
    const official = OFFICIAL_LICENSE_BY_GROUP[s.group];
    const fromOjk = !official && (s.group.includes("·ID）") || s.group.includes("OJK"));
    const isMn = /·MN[）)]/.test(s.group) || s.group.includes("·MN）");
    return {
      region: s.region,
      line: s.line,
      tier: "腰部" as const,
      group: s.group,
      brands: official?.legalName ?? s.group,
      countries: official
        ? official.source === "ojkLpbbti"
          ? "印尼"
          : official.source === "pdicDigibank"
            ? "菲律宾"
            : "中国"
        : isMn
          ? "外蒙古"
          : REGION_COUNTRY[s.region],
      languages: isMn ? "蒙古语/英语" : "待核实",
      licenses: official
        ? official.source === "pdicDigibank"
          ? "PH：BSP数字银行（PDIC投保目录交叉）"
          : official.source === "ojkLpbbti"
            ? "ID：OJK LPBBTI/P2P（AFPI会员交叉）"
            : `中国：${official.licenseKindLabel}（金管总局法人名单）`
        : isMn
          ? s.line === "bnpl"
            ? "外蒙古：FRC NBFI/消费分期或银行合作BNPL（非吸储）"
            : "外蒙古：FRC NBFI 非银放贷/电子支付（非吸储银行）"
          : licenseByRegionLine[s.region][s.line],
      timing: "待核实",
      regulators: official
        ? official.source === "pdicDigibank"
          ? "BSP / PDIC"
          : official.source === "ojkLpbbti"
            ? "OJK / AFPI"
            : "金管总局/属地金融监管局"
        : isMn
          ? "蒙古金融监管委员会(FRC) / 蒙古银行(BoM)"
          : "待核实",
      traffic: s.line === "agent" ? "贷超/比价/导流获客" : "投放/App/门店",
      volume: "待核实",
      users: "待核实",
      diandian: fromLuffy
        ? "路飞海外风控笔记·GP财务免费榜借款类快照（2026-08-01前后）"
        : official
          ? REGULATORY_DIRECTORY_SOURCES[official.source]
          : fromOjk
            ? "OJK LPBBTI 官网名录交叉建档（2025公开名单）"
            : isMn
              ? "外蒙古公开市场建档；优先以FRC NBFI名录交叉"
              : "点点位次待补；优先以监管官网持牌名单交叉",
      note: s.line === "agent"
        ? "生态角色·流量（中介/比价/贷超）：非下场放贷玩家；偏撮合/导流"
        : fromLuffy
          ? "路飞流量端已检出；监管名录交叉填齐中（无数量上限）"
          : official
            ? `来源：${REGULATORY_DIRECTORY_SOURCES[official.source]}；法定名 ${official.legalName}`
            : fromOjk
              ? "来源：OJK LPBBTI 持牌名录；法定公司名见 brands/group"
              : isMn
                ? "外蒙古(MN)信贷玩家；≠中国内蒙古蒙商消金"
                : "CRM扩表；须完成流量榜×监管名录双端校验",
      controller: official?.controller ?? "待核实",
      equity: "待核实",
      licenseReg: fromLuffy
        ? `待核监管名录（区域口径：${licenseByRegionLine[s.region][s.line]}）`
        : official
          ? formatOfficialLicenseReg(official)
          : fromOjk
            ? "ID：OJK LPBBTI 持牌（官网名录交叉）"
            : isMn
              ? "MN：FRC NBFI/相关许可（待官网名录逐条核验登记号）"
              : "待核：持牌实体法定名/登记号/名录条目",
      trafficRank: fromLuffy
        ? "路飞·GP财务免费榜借款类（第三方；非官方商店API）"
        : official
          ? `监管源·${official.licenseKindLabel}`
          : fromOjk
            ? "监管源·OJK LPBBTI 名录"
            : isMn
              ? "外蒙古App Store/GP金融类；点点出海榜覆盖弱"
              : "待核：GP/Apple/FB/点点位次",
      verify: fromLuffy
        ? ("仅流量" as const)
        : official || fromOjk
          ? ("仅监管" as const)
          : ("〔1〕" as const),
    };
  });
}

/** 按集团名补丁：实控人 / 股权 / 牌照登记 / 流量排名 / 校验态（覆盖默认） */
const SCENE_KYC: Record<
  string,
  Partial<Pick<SceneRow, "controller" | "equity" | "licenseReg" | "trafficRank" | "verify" | "mau" | "share">>
> = {
  "蚂蚁集团/支付宝（蚂蚁·CN）": {
    controller: "蚂蚁集团（软银/阿里等历史股东结构；上市进程以最新公告为准）",
    equity: "蚂蚁集团主主体；支付宝为中国支付品牌",
    licenseReg: "中国：非银行支付机构等（央行支付牌照体系）+ 关联小贷/消金合作",
    trafficRank: "CN：国内应用商店金融/支付头部；非点点出海借贷榜主口径",
    verify: "仅监管",
  },
  "腾讯控股/微信（腾讯·CN）": {
    controller: "腾讯控股（0700.HK）",
    equity: "港交所上市公司腾讯控股",
    licenseReg: "财付通等支付牌照；信贷多为银行/持牌机构分发",
    trafficRank: "CN：社交/支付头部；非点点出海借贷榜",
    verify: "仅监管",
  },
  "美团（美团·CN）": {
    controller: "美团（王兴等）",
    equity: "HKEX: 3690.HK",
    licenseReg:
      "已持：支付(中国)·小贷(中国)·保险经纪(中国)·基金代销(中国)·征信(中国)；申请中：消费金融(中国)",
    trafficRank: "CN超级平台｜外卖● 到店● 酒旅● 打车○ 买菜○",
    verify: "双端通过",
  },
  "京东集团/京东（京东·CN）": {
    controller: "京东集团",
    equity: "NASDAQ: JD / HKEX: 9618.HK",
    licenseReg: "京东科技/支付/消金合作路径",
    trafficRank: "CN电商头部",
    verify: "仅监管",
  },
  "滴滴出行/滴滴（滴滴·CN）": {
    controller: "滴滴出行",
    equity: "私营（历史上市路径已退市叙事）",
    licenseReg: "支付/小贷合作；出行场景信贷",
    trafficRank: "CN出行头部",
    verify: "仅监管",
  },
  "Sea Limited/Shopee（Sea·SEA）": {
    controller: "Sea Limited（创始人Forrest Li等）",
    equity: "NYSE: SE",
    licenseReg:
      "已持：支付：SeaMoney·MPI·新 | ShopeePay·PJP·印 | SeaMoney·PSP·泰 | SeaMoney·PSP(pilot)·越 | SeaMoney·eMoney·马；信贷：SeaMoney·Moneylender·新 | SeaMoney·Financing·马；数字银行：SeaBank·PDKB·印；申请中：数字银行(新加坡)·保险经纪(印尼)",
    trafficRank: "新加坡综合平台｜电商● 外卖● 游戏● 支付○",
    verify: "双端通过",
  },
  "Grab Holdings/Grab（Grab·SEA）": {
    controller: "Grab Holdings",
    equity: "NASDAQ: GRAB",
    licenseReg:
      "已持：支付(新加坡·印尼·马来·菲律宾·越南·泰国)·借贷(新加坡·马来·印尼)·保险经纪(新加坡)；申请中：数字银行(新加坡·马来)·证券(印尼)",
    trafficRank: "新加坡超级平台｜出行● 外卖● 支付● 信用○｜墨腾外卖份额约55%",
    verify: "双端通过",
  },
  "GoTo/Gojek（GoTo·ID）": {
    controller: "GoTo Group",
    equity: "IDX: GOTO.JK",
    licenseReg:
      "已持：支付(印尼)·借贷(印尼)·保险经纪(印尼)；申请中：数字银行(印尼)·证券(印尼)",
    trafficRank: "印尼综合平台｜出行● 外卖● 支付○｜墨腾：ShopeeFood印尼单量追平叙事",
    verify: "双端通过",
  },
  "Delivery Hero/Foodpanda（Foodpanda·SEA）": {
    controller: "Delivery Hero",
    equity: "FRA: DHER（德国；东南亚运营）",
    licenseReg: "牌照：—（金融牌照未单列；垂直外卖）",
    trafficRank: "德国总部·东南亚垂直平台｜外卖●｜墨腾：区域位次落后ShopeeFood；已退出泰国",
    verify: "仅流量",
  },
  "Xanh SM（Xanh SM·VN）": {
    controller: "Vingroup关联/范日旺生态（公开叙事）",
    equity: "私营",
    licenseReg: "牌照：—；申请中：—",
    trafficRank: "越南垂直平台｜出行● 外卖○",
    verify: "待双端",
  },
  "Lazada/Lazada（Lazada·SEA）": {
    controller: "Lazada（阿里巴巴东南亚历史控股叙事）",
    equity: "Alibaba关联",
    licenseReg: "各国支付/消费信贷合作",
    trafficRank: "SEA电商",
    verify: "仅监管",
  },
  "ByteDance/TikTok（字节·SEA）": {
    controller: "字节跳动 / ByteDance",
    equity: "私营；TikTok为海外品牌（与抖音分端）",
    licenseReg: "各国：TikTok Shop PayLater多与持牌机构合作嵌入",
    trafficRank: "全球短视频头部；SEA直播电商上升快",
    verify: "仅监管",
  },
  "广州华人/Badam Live（巴旦木·CN）": {
    controller: "广州华人科技（Badam/巴旦木直播）",
    equity: "私营",
    licenseReg: "直播娱乐为主；信贷牌照/合作待核实",
    trafficRank: "CN区域直播（维语/新疆向内容）",
    verify: "待双端",
  },
  "赤子城科技/MICO（赤子城·MENA）": {
    controller: "赤子城科技（09911.HK）",
    equity: "HKEX: 09911.HK",
    licenseReg: "海外社交直播/虚拟物品；信贷合作待核实",
    trafficRank: "MEA等：MICO/YoHo/SUGO等出海社交直播矩阵",
    verify: "待双端",
  },
  "GCash（·SEA）": {
    controller: "Globe Fintech Innovations / Mynt（GCash）",
    equity: "Globe/Ayala/Ant等历史股东叙事",
    licenseReg: "已持：支付(菲律宾)·放贷(菲律宾)；EMI/电子货币+借贷臂",
    trafficRank: "PH 超级钱包头部；GLoan派生",
    verify: "双端通过",
  },
  "Maya（·SEA）": {
    controller: "Maya Bank / Voyager Innovations；数字银行法人另列 MayaBank·PH",
    equity: "菲律宾数字银行路径（以BSP/PDIC披露为准）",
    licenseReg: "已持：数字银行(菲律宾)·支付(菲律宾)；法人 Maya Bank, Inc. 见 PDIC 投保数字银行目录",
    trafficRank: "PH 钱包+数字银行；Maya Credit派生",
    verify: "双端通过",
  },
  "Akulaku/Akulaku（阿卡拉克·SEA）": {
    controller: "Akulaku Group",
    equity: "私募；ID=BNC；PH=OwnBank农村银行；TH=Akulaku X（BOT非银个人贷/Nano，非Virtual Bank）",
    licenseReg:
      "已持：支付(印尼)·P2P(印尼)·多金融(印尼)·银行(印尼·BNC)·银行(菲律宾·OwnBank)·P-Loan/Nano(泰国·Akulaku X)",
    trafficRank: "SEA BNPL/信贷场景头部；菲OwnBank（农村银行牌照，非BSP Digital Bank六席）",
    verify: "仅监管",
  },
  "PhonePe/PhonePe（PhonePe·IN）": {
    controller: "PhonePe（Walmart/Flipkart历史关联）",
    equity: "印度私营支付巨头",
    licenseReg: "印度：支付/PPINBI等；信贷多为NBFC/银行合作",
    trafficRank:
      "IN UPI头部；Sensor Tower IN Finance Top Free 2024-07-30 快照中未落入可见#3–6（更可能居#1–2，待补完整榜）",
    verify: "双端通过",
  },
  "One97/Paytm（Paytm·IN）": {
    controller: "One97 / Paytm",
    equity: "NSE/BSE: PAYTM",
    licenseReg: "印度：支付银行/支付牌照路径（监管变迁以RBI为准）",
    trafficRank: "Sensor Tower·IN Finance Top Free #4（2024-07-30，Android）；点点/商店支付榜另计",
    verify: "双端通过",
  },
  "Google Pay India（Google Pay·IN）": {
    controller: "Google LLC",
    equity: "Alphabet/Google",
    licenseReg: "印度：UPI支付；信贷多为合作导流",
    trafficRank: "Sensor Tower·IN Finance Top Free #5（2024-07-30，Android）",
    verify: "双端通过",
  },
  "Airtel Thanks（·IN）": {
    controller: "Bharti Airtel",
    equity: "NSE: BHARTIARTL",
    licenseReg: "印度：电信+Payments Bank/信贷入口",
    trafficRank:
      "Sensor Tower·IN Finance Top Free #3（2024-07-30，Android；App=Airtel Recharge/Bank & Loans）",
    verify: "双端通过",
  },
  "YONO SBI（·IN）": {
    controller: "State Bank of India",
    equity: "NSE: SBIN",
    licenseReg: "印度：商业银行大牌照（SBI）",
    trafficRank: "Sensor Tower·IN Finance Top Free #6（2024-07-30，Android）",
    verify: "双端通过",
  },
  "Flipkart/Flipkart（Flipkart·IN）": {
    controller: "Flipkart（Walmart）",
    equity: "Walmart控股",
    licenseReg: "电商+消费信贷合作（非自营银行叙事）",
    trafficRank: "IN电商头部",
    verify: "仅监管",
  },
  "Uber（Uber·LATAM）": {
    controller: "Uber Technologies",
    equity: "NYSE: UBER",
    licenseReg: "出行平台；金融多为合作/Uber Money路径，按国另计",
    trafficRank: "拉美出行/外卖：商店生活服务榜另计",
    verify: "待双端",
  },
  "iFood（iFood·BR）": {
    controller: "iFood / Prosus关联",
    equity: "Prosus/移动互联网集团关联",
    licenseReg: "巴西外卖平台；信贷多为合作派生",
    trafficRank: "BR外卖头部：生活服务榜另计",
    verify: "待双端",
  },
  "Kaspi.kz（Kaspi·KZ）": {
    controller: "Kaspi.kz",
    equity: "LSE/AIX上市 Kaspi.kz",
    licenseReg: "哈萨克斯坦银行/支付与电商一体超级App",
    trafficRank: "KZ超级App头部",
    verify: "仅监管",
  },
  "DiDi/99（滴滴·LATAM）": {
    controller: "滴滴国际 / 99（巴西）",
    equity: "NYSE: DIDIY.US（中国控股·拉美运营）",
    licenseReg:
      "已持：支付(巴西·墨西哥)·信贷(巴西)；申请中：支付(智利·哥伦比亚)",
    trafficRank: "中国控股·拉美综合平台｜出行● 外卖● 支付○",
    verify: "双端通过",
  },
  "Mercado Libre/Mercado Libre（美卡多·LATAM）": {
    controller: "Mercado Libre",
    equity: "NASDAQ: MELI",
    licenseReg: "Mercado Pago支付+信贷臂；各国牌照分主体",
    trafficRank: "LatAm电商/支付头部",
    verify: "仅监管",
  },
  "Rappi/Rappi（Rappi·LATAM）": {
    controller: "Rappi",
    equity: "哥伦比亚·拉美私募",
    licenseReg:
      "已持：支付(哥伦比亚·墨西哥·巴西·智利·秘鲁)·信贷(哥伦比亚·墨西哥)；申请中：数字银行(墨西哥)·证券(巴西)",
    trafficRank: "哥伦比亚垂直/超级App向｜外卖● 支付●",
    verify: "双端通过",
  },
  "饿了么（饿了么·CN）": {
    controller: "阿里巴巴本地生活 / 饿了么",
    equity: "阿里巴巴集团关联",
    licenseReg: "牌照：—（支付/信贷由支付宝/蚂蚁集团提供）",
    trafficRank: "中国垂直平台｜外卖●",
    verify: "仅监管",
  },
  "Safaricom/M-Pesa（M-Pesa·KE）": {
    controller: "Safaricom / Vodafone关联叙事",
    equity: "Safaricom上市关联",
    licenseReg: "肯尼亚等：电子货币/移动货币牌照；信贷多为合作",
    trafficRank: "东非移动货币头部",
    verify: "仅监管",
  },
  "OPay/OPay（OPay·NG）": {
    controller: "Opera/OPay体系叙事",
    equity: "私募支付",
    licenseReg: "尼日利亚等：支付牌照；信贷合作",
    trafficRank: "NG支付头部",
    verify: "仅监管",
  },
  "Amazon/Amazon（亚马逊·US）": {
    controller: "Amazon.com, Inc.",
    equity: "NASDAQ: AMZN",
    licenseReg: "各国支付/消费信贷合作（对照）",
    trafficRank: "全球电商对照",
    verify: "仅监管",
  },
  "Block/Cash App（Block·US）": {
    controller: "Block, Inc.",
    equity: "NYSE: XYZ",
    licenseReg: "美国：货币服务/银行合作；Afterpay另列",
    trafficRank: "US支付对照",
    verify: "仅监管",
  },
  "LendMN（LendMN·MN）": {
    controller: "LendMN NBFI JSC（MSE:LEND）",
    licenseReg: "MN：FRC NBFI；钱包+信贷入口",
    mau: "总用户约8.1万（2025Q3；capitalmarkets.mn Lend Teaser）",
    share: "贷款组合约₮3031亿（2025Q3）；净贷款约₮2765亿同比约+38%（同teaser）",
    trafficRank: "外蒙古数字信贷头部",
    verify: "待双端",
  },
  "Storepay（Storepay·MN）": {
    controller: "Storepay",
    mau: "官网50万+；2023末媒体约45万+用户（ikon.mn）",
    share: "GMV 2022同比+276%（RBI访谈；绝对额未披露）",
    trafficRank: "外蒙古BNPL先发",
    verify: "待双端",
  },
  "Ard App/Ard Credit（Ard·MN）": {
    controller: "Ard Credit / Ard Financial Group",
    mau: "官网展示约140万+用户（时点未标；抓取2026-08）",
    share: "官网展示放贷约₮1560亿（时点未标）",
    verify: "待双端",
  },
  "Pocket/InvesCore（Pocket·MN）": {
    controller: "InvesCore Wallet NBFI LLC",
    mau: "集团客户约11.66万（2022末；ADB 56156，非仅Pocket App）",
    share: "集团总资产约₮3563亿（2022末；ADB）；Pocket单列待拆",
    verify: "待双端",
  },
  "Hipay（Hipay·MN）": {
    controller: "Hipay Mongolia",
    mau: "公开MAU未查到",
    share: "公开规模未查到",
    verify: "待双端",
  },
  "Shoppy.mn（Shoppy·MN）": {
    controller: "Shoppy.mn",
    mau: "公开MAU未查到",
    share: "公开GMV未查到；银行合作分期待核实",
    verify: "待双端",
  },
  "Simple（Simple·MN）": {
    controller: "Simple",
    mau: "公开用户数未查到",
    share: "公开GMV未查到",
    verify: "待双端",
  },
};

const CREDIT_KYC: Record<
  string,
  Partial<Pick<CreditRow, "controller" | "equity" | "licenseReg" | "trafficRank" | "verify" | "note" | "volume" | "users">>
> = {
  "奇富科技/奇富借条/Qfin（奇富·CN）": {
    controller: "奇富科技（原360数科路径；公开披露以年报/招股为准）",
    equity: "NASDAQ: QFIN",
    licenseReg: "中国：助贷撮合+银行/消金资金方；非吸储",
    trafficRank: "CN助贷App国内商店；出海见KrediOne行",
    verify: "仅监管",
  },
  "FinVolution/信也（信也·CN）": {
    controller: "季恒等（FinVolution Group）",
    equity: "NYSE: FINV",
    licenseReg: "已持：助贷(中国)·P2P(印尼)·放贷(菲律宾)；出海分主体另计",
    trafficRank: "点点：AdaKami印尼现金贷头部梯队；JuanHand菲榜常见",
    verify: "双端通过",
    note: "上市代码 FINV.N；国内与出海分主体，列表按（信也·国别）去重",
  },
  "Fintopia/瓴岳/洋钱罐（洋钱罐·CN）": {
    controller: "洋钱罐/瓴岳科技体系（Fintopia）",
    equity: "非上市集团口径；品牌Easycash/Credmex等",
    licenseReg: "已持：P2P(印尼)·SOFOM(墨西哥)；Easycash/Credmex分主体",
    trafficRank: "点点Dec’25：Easycash印尼借贷下载约#2；MX Credmex活跃前排",
    verify: "双端通过",
  },
  "乐信/分期乐/Lexin（乐信·CN）": {
    controller: "乐信集团",
    equity: "NASDAQ: LX",
    licenseReg: "中国消金/助贷合作；MX：Fortaprest等",
    trafficRank: "点点MX常见对标；国内另计",
    verify: "仅流量",
  },
  "中关村科金｜马上｜中科金（中科金·CN）": {
    controller: "北京中关村科金技术有限公司（中科金）；马上消费为境内持牌消金主体，不作玩家主名",
    licenseReg: "CN：马上消费金融（银保监消金牌照）写入本字段，非 group 名",
    trafficRank: "国内马上App；出海见中科金·MX",
    verify: "仅监管",
    note: "玩家=发起方/科技集团中科金，非持牌主体马上消费",
  },
  "中关村科金｜待核｜中科金（中科金·MX）": {
    controller: "中科金出海墨（与境内马上消金主体区分）",
    licenseReg: "MX：本地金融公司/SOFOM等路径待核登记号；APP名〔1〕回填",
    trafficRank: "MX商店榜待核",
    verify: "待双端",
    note: "中科金类科技集团可横向境外；招行/邮储/中原银行等境内发起方不按此叙事",
  },
  "招商银行+中国联通｜招联｜招联（招联·CN）": {
    controller: "发起方：招商银行 + 中国联通；招联消费金融为持牌主体",
    licenseReg: "CN：招联消费金融（消金牌照）",
    verify: "仅监管",
    note: "母公司为境内银行/央企体系，不按横向境外展业收录",
  },
  "中原银行｜中原消费｜中原银行（中原·CN）": {
    controller: "发起方：中原银行；中原消费金融为持牌主体",
    licenseReg: "CN：中原消费金融（消金牌照）",
    verify: "仅监管",
    note: "母公司为境内银行，不按横向境外展业收录",
  },
  "中国邮政｜中邮消费｜中国邮政（中邮·CN）": {
    controller: "发起方：中国邮政体系；中邮消费金融为持牌主体",
    licenseReg: "CN：中邮消费金融（消金牌照）",
    verify: "仅监管",
    note: "母公司为境内央企/邮政体系，不按横向境外展业收录",
  },
  "内蒙古蒙商消费金融｜蒙商消金｜蒙商（蒙商消金·CN）": {
    controller: "中国内蒙古自治区持牌消金；≠外蒙古(MN)/蒙古国机构",
    licenseReg: "CN：内蒙古蒙商消费金融（金管总局消金法人名单）",
    verify: "仅监管",
    note: "属地=中国内蒙古；筛选国家选「外蒙古」时不应出现本条",
  },
  "LendMN/LendMN（LendMN·MN）": {
    controller: "LendMN NBFI JSC（外蒙古；MSE:LEND）",
    licenseReg: "MN：FRC NBFI；数字消费贷/企业贷/LendDy BNPL",
    trafficRank: "外蒙古数字信贷头部App（公开投行材料口径）",
    verify: "待双端",
    volume:
      "净贷款约₮2765亿（2025Q3）；同比约+38%（较2024Q3的₮2008亿）。贷款组合约₮3031亿（2025Q3），自2023Q3约₮1004亿起约74% CAGR（资本市场teaser口径）",
    users:
      "总用户约8.1万（2025Q3；teaser口径，约7% CAGR）。注：部分早期材料口径不同，以最新teaser为准",
    note:
      "外蒙古(MN)；≠中国内蒙古蒙商消金。出处：capitalmarkets.mn《Lend Teaser_2025Q3》；公司站投资者财务信息页交叉",
  },
  "LendMN/LendDy（LendDy·MN）": {
    controller: "LendMN NBFI JSC（LendDy=BNPL产品线）",
    licenseReg: "MN：挂LendMN信贷额度的商户分期（LendDy）",
    volume: "见LendMN母体贷款组合（2025Q3 teaser）；BNPL单列GMV未在该材料拆分",
    users: "需已开通LendMN消费贷额度用户（产品页口径）",
    note: "出处：lend.mn/en/loan/bnpl/（产品条款）；规模归母体LendMN",
    verify: "待双端",
  },
  "Pocket/InvesCore Wallet（Pocket·MN）": {
    controller: "InvesCore Wallet NBFI LLC（Invescore集团fintech臂；外蒙古）",
    licenseReg: "MN：FRC NBFI（公开：2019-11-25 第327号令叙事）",
    verify: "待双端",
    volume:
      "集团Invescore：总资产约₮3563亿（2022末）；2017–2022资产CAGR约78.5%；MSME贷款约₮828亿/1050户（2022末）。Pocket为数字贷/钱包产品线，单列规模待拆",
    users:
      "Invescore集团客户约11.66万（2022末，ADB项目文件口径；含分支，非仅Pocket App）",
    note:
      "出处：ADB RRP 56156-001（Invescore MSME Financing，引用2022末数）。Pocket产品页未给独立最新用户数",
  },
  "Pocket Zero/Pocket（Pocket Zero·MN）": {
    controller: "InvesCore Wallet / Pocket（BNPL子产品）",
    licenseReg: "MN：Pocket Zero商户分期",
    volume: "见Pocket/Invescore母体；Zero分期单列GMV未公开",
    users: "见Pocket母体",
    note: "出处：Pocket应用说明（Aptoide/应用商店文案）；量化待补",
    verify: "待双端",
  },
  "Ard Credit/Ard App（Ard·MN）": {
    controller: "Ard Credit / Ard Financial Group（外蒙古）",
    licenseReg: "MN：银行/非银/支付等牌照组合（Ard生态公开口径）",
    verify: "待双端",
    volume: "放贷约₮1560亿（官网首页展示数；未标注报表日，待年报交叉）",
    users: "用户约140万+；Lender约9.4万+（官网首页展示数；时点未标）",
    note: "出处：ardcredit.com/en 首页指标条（抓取时点2026-08；请以最新披露为准）",
  },
  "Storepay（Storepay·MN）": {
    controller: "Storepay（外蒙古BNPL先发；新加坡总部叙事）",
    licenseReg: "MN：BNPL/非银路径待核FRC登记号",
    trafficRank: "外蒙古BNPL公开口径先发玩家",
    verify: "待双端",
    volume:
      "GMV：2022年较2021年+276%（CEO访谈，未给绝对额）。另有材料称累计销售超约$3600万（约2023口径，Business Age侧记）",
    users:
      "官网展示50万+；访谈称超50万蒙古用户。2023末媒体：用户约45万+、商户约4000（ikon.mn）。2022-10稿：注册约40万/活跃约22万（Yahoo/GlobeNewswire）",
    note:
      "出处：Retail Banker International·Storepay CEO访谈；ikon.mn 2023奖项稿；storepay.mn；Yahoo·LBank上市稿2022-10",
  },
  "Simple（Simple·MN）": {
    controller: "Simple（外蒙古零售分期/现金贷App）",
    licenseReg: "MN：消费贷/BNPL路径待核",
    volume: "公开绝对规模未查到；产品页给分期期限/额度区间",
    users: "公开用户数未查到",
    note: "出处缺口：simple.mn产品页仅条款；规模/用户待监管或年报",
    verify: "待双端",
  },
  "Simple Buy/Simple（Simple Buy·MN）": {
    controller: "Simple（Simple Buy=购买分期）",
    volume: "见Simple母体；Buy单列GMV未公开",
    users: "公开用户数未查到",
    note: "出处：simple.mn/simple-buy；量化待补",
    verify: "待双端",
  },
  "M Credit/Solomon（M Credit·MN）": {
    controller: "Solomon Investments NBFC LLC / M Credit（公开OpenFinance文案）",
    licenseReg: "MN：非银放贷/消费贷+BNPL；Magic Card叙事",
    volume: "单笔现金贷公开区间约₮5万–300万；全国21省覆盖（产品文案，非余额规模）",
    users: "公开用户/在贷余额未查到",
    note: "出处：openfinance-lab.com/m-credit.html（产品与覆盖描述；非经审计报表）",
    verify: "待双端",
  },
  "Hipay Loan/Hipay（Hipay·MN）": {
    controller: "Hipay Mongolia（钱包+贷款/保险/投资入口叙事）",
    licenseReg: "MN：支付/信贷合作路径待核",
    volume: "公开贷款余额/GMV未查到",
    users: "公开用户数未查到",
    note: "出处缺口：行业综述提及Hipay为钱包对手方；量化待官网/FRC名录交叉",
    verify: "待双端",
  },
  "M Bank数字贷/M Bank（M Bank·MN）": {
    controller: "M bank（MCS集团；外蒙古无网点数字银行）",
    licenseReg: "MN：商业银行牌（公开：2022-02获牌叙事）",
    verify: "待双端",
    volume:
      "2025经营口径：总资产约₮3.2万亿、存款约₮1.6万亿、贷款组合约₮1.2万亿（m-bank.mn《2025 оны үйл ажиллагааны тайлан》）。更早：资产超约$2亿、借款人约4万（2023-12；IFC 2024-05稿）",
    users:
      "客户约64万（2025经营口径，官网年报页）。更早：零售优先客户约23万、对公857（2023；IFC稿）",
    note:
      "出处：m-bank.mn/annual-report-2025；IFC新闻稿2024-05-08（2023末截面）",
  },
  "Khan Bank数字贷/Khan Bank（Khan Bank·MN）": {
    controller: "Khan Bank JSC（外蒙古系统重要性银行；MSE:KHAN）",
    licenseReg: "MN：商业银行；数字贷/超App叙事",
    verify: "待双端",
    volume:
      "银行业资产/存贷款份额均超约30%（资本市场Q4'25 teaser口径）。贷款组合2025H1较2024末约+14.9%，贷款市占约31.6%（2025-05截面；半年经营报告）",
    users:
      "客户约290万，约覆盖人口82%–83%（2025 teaser / Incofin访谈）。数字渠道交易约99%+；消费及小微贷线上办理约75%–85%（Euromoney 2025 / Incofin）",
    note:
      "出处：capitalmarkets.mn Khan Bank Q4 2025 teaser；mse.mn 2025半年经营报告；Incofin专访；Euromoney Awards 2025",
  },
  "数禾｜还呗｜数禾（数禾·CN）": {
    controller: "上海数禾科技（数禾）；还呗为APP名，不作单独玩家主名",
    licenseReg: "CN：助贷/小贷等合作路径待核",
    trafficRank: "还呗App国内商店",
    verify: "仅流量",
    note: "命名：运营公司｜APP｜集团俗称",
  },
  "度小满｜有钱花｜百度（度小满·CN）": {
    controller: "度小满（百度旗下当地公司/金融科技主体）；有钱花为APP/产品名",
    licenseReg: "CN：小贷/助贷/银行合作等路径（以披露为准）",
    trafficRank: "有钱花/度小满App国内商店",
    verify: "仅流量",
    note: "当地公司名=度小满，集团=百度；不以百度直接当信贷玩家名",
  },
  "Xinfei Digital/KrediOne（奇富·ID）": {
    controller: "股权链常见表述：Xinfei Digital↔奇富QFIN（点点写作「信飞科技」；≠国内信用飞品牌）",
    equity: "Xinfei Digital持股约85%等公开叙事（以当地披露为准）",
    licenseReg: "印尼：OJK相关放贷/多金融路径（以OJK名录最新为准）",
    trafficRank: "点点2025-09下载#2~85.1万；2025H2走弱",
    verify: "冲突观察",
    note: "点点「信飞」=Xinfei音译；与国内「信用飞」勿合并",
  },
  "Surfin Meta/Surfin（Surfin·SG）": {
    controller: "吴亚南（Yanan Wu）；Surfin Meta Digital Technology Pte. Ltd.",
    equity: "新加坡主体；2025公开融资约累计USD26.5M（Insignia/Woori等）",
    licenseReg: "多国分主体；印尼等含P2P/基金分销等（逐国OJK等名录待回填登记号）",
    trafficRank: "多国运营；点点/路飞国榜位次待逐国回填（含IN）",
    verify: "仅监管",
  },
  "Adapundi/印闪（印闪·ID）": {
    controller: "印闪科技体系（点点公开写作）",
    equity: "待核实详细股东",
    licenseReg: "已持：P2P(印尼)；OJK LPBBTI",
    trafficRank: "点点2025-12借贷下载#3~66.4万",
    verify: "双端通过",
  },
  "AdaKami": {
    controller: "FinVolution（信也）出海",
    equity: "FinVolution Group",
    licenseReg: "已持：P2P(印尼)；OJK LPBBTI",
    trafficRank: "点点印尼现金贷头部梯队",
    verify: "双端通过",
  },
  "Kredivo/FinAccel（Kredivo·ID）": {
    controller: "Kredivo / FinAccel",
    equity: "FinAccel（私募）",
    licenseReg: "印尼：Multifinance/BNPL相关；多国分主体",
    trafficRank: "点点Dec借贷下载常列#1；路飞ID榜BNPL头部",
    verify: "双端通过",
  },
  "KreditBee（KreditBee·IN）": {
    controller: "Finnovation Tech Solutions（KreditBee）",
    equity: "印度私募/机构股东（以MCA披露为准）",
    licenseReg: "印度：RBI NBFC CoR路径（以RBI名录最新条目为准；登记号待回填）",
    trafficRank: "路飞IN借款Top：KreditBee财务榜常见前十",
    verify: "仅流量",
  },
  "嘉银科技/嘉银/Jiayin（嘉银·CN）": {
    controller: "嘉银科技",
    equity: "NASDAQ: JFIN",
    licenseReg: "中国助贷撮合；出海分主体待核当地名录",
    trafficRank: "国内商店；出海点点位次待补",
    verify: "仅监管",
  },
  "信飞科技/信用飞（信用飞·CN）": {
    controller: "国内「信用飞」品牌主体（勿与点点「信飞」=Xinfei/KrediOne混淆）",
    equity: "待核实上市/股东",
    licenseReg: "中国：助贷/小贷合作路径（非吸储）",
    trafficRank: "国内；与KrediOne分行",
    verify: "仅监管",
  },
  "Finplus（·ID）": {
    controller: "待核实（点点印尼MAU常列）",
    equity: "待核实",
    licenseReg: "印尼：OJK相关路径待核登记号",
    trafficRank: "点点2025-09 MAU约162万",
    verify: "仅流量",
  },
  "Cairin（·ID）": {
    controller: "待核实",
    equity: "待核实",
    licenseReg: "印尼：OJK LPBBTI/多金融待核",
    trafficRank: "点点印尼借贷榜常见",
    verify: "仅流量",
  },
  "PinjamDuit（·ID）": {
    controller: "待核实",
    equity: "待核实",
    licenseReg: "印尼：OJK待核登记号",
    trafficRank: "点点印尼榜常见",
    verify: "仅流量",
  },
  "Bussan Auto Finance/BAF Mobile（BAF·ID）": {
    controller: "Bussan Auto Finance（三菱系多金融叙事）",
    equity: "日系多金融/汽车金融背景",
    licenseReg: "印尼：OJK Multifinance",
    trafficRank: "点点2025-09唯一五星提及",
    verify: "双端通过",
  },
  "Ammana（·ID）": {
    controller: "待核实（伊斯兰金融叙事）",
    equity: "待核实",
    licenseReg: "印尼：OJK P2P/多金融待核",
    trafficRank: "点点印尼榜常见",
    verify: "仅流量",
  },
  "AsetKu/Akulaku（阿卡拉克·ID）": {
    controller: "Akulaku/AsetKu体系",
    equity: "Akulaku集团关联",
    licenseReg: "已持：P2P(印尼)；OJK LPBBTI",
    trafficRank: "点点印尼P2P/借贷交叉常见",
    verify: "仅监管",
  },
  "Rupiah Cepat（·ID）": {
    controller: "待核实",
    equity: "待核实",
    licenseReg: "印尼：OJK待核",
    trafficRank: "点点印尼榜常见",
    verify: "仅流量",
  },
  "UangMe（·ID）": {
    controller: "待核实",
    equity: "待核实",
    licenseReg: "印尼：OJK待核",
    trafficRank: "点点印尼榜常见",
    verify: "仅流量",
  },
  "Bank Neo Commerce/Neo Pinjam（BNC·ID）": {
    controller: "Bank Neo Commerce / Akulaku银行臂叙事",
    equity: "BNC上市公司路径（以IDX披露为准）",
    licenseReg: "已持：银行(印尼)",
    trafficRank: "点点/银行App交叉",
    verify: "仅监管",
  },
  "维信金科/Vcredit（维信·CN）": {
    controller: "维信金科",
    equity: "HKEX: 2003.HK",
    licenseReg: "中国助贷；出海分主体待核",
    trafficRank: "国内为主；出海点点待补",
    verify: "仅监管",
  },
  "Danaku/TrustIQ（·ID）": {
    controller: "TrustIQ/Danaku体系（待核UBO）",
    equity: "待核实",
    licenseReg: "印尼：OJK待核",
    trafficRank: "点点印尼现金贷常见",
    verify: "仅流量",
  },
  "JuanHand/FinVolution（信也·PH）": {
    controller: "FinVolution（信也）菲主体",
    equity: "FinVolution Group",
    licenseReg: "已持：放贷(菲律宾)；SEC Lending/Financing + OLP",
    trafficRank: "点点/路飞PH榜常见",
    verify: "双端通过",
  },
  "MabilisCash（·PH）": {
    controller: "待核实",
    equity: "待核实",
    licenseReg: "菲律宾：SEC OLP待核登记",
    trafficRank: "点点PH榜常见",
    verify: "仅流量",
  },
  "FTLending（·PH）": {
    controller: "待核实",
    equity: "待核实",
    licenseReg: "菲律宾：SEC待核",
    trafficRank: "点点PH榜常见",
    verify: "仅流量",
  },
  "Mr.cash（·PH）": {
    controller: "待核实",
    equity: "待核实",
    licenseReg: "菲律宾：SEC待核",
    trafficRank: "点点PH榜常见",
    verify: "仅流量",
  },
  "Paisayaar/JingleCred（·PK）": {
    controller: "JingleCred/Paisayaar体系",
    equity: "待核实",
    licenseReg: "印度：RBI NBFC路径待核CoR",
    trafficRank: "路飞IN榜常见",
    verify: "仅流量",
  },
  "JazzCash/JazzCash Lending（JazzCash·PK）": {
    controller: "Jazz/Veon体系支付臂信贷",
    equity: "Veon/Jazz关联",
    licenseReg: "巴基斯坦：SECP Lending NBFC等路径待核",
    trafficRank: "路飞PK支付/借贷交叉",
    verify: "仅流量",
  },
  "Aitemaad/4Sight（·PK）": {
    controller: "4Sight/Aitemaad",
    equity: "待核实",
    licenseReg: "巴基斯坦：SECP待核",
    trafficRank: "路飞PK榜",
    verify: "仅流量",
  },
  "Fauri Cash/Pakisnova（·PK）": {
    controller: "Pakisnova",
    equity: "待核实",
    licenseReg: "巴基斯坦：SECP待核",
    trafficRank: "路飞PK榜",
    verify: "仅流量",
  },
  "PakCredit/VisionCred（·PK）": {
    controller: "VisionCred",
    equity: "待核实",
    licenseReg: "巴基斯坦：SECP待核",
    trafficRank: "路飞PK榜",
    verify: "仅流量",
  },
  "IDLC Finance（·BD）": {
    controller: "IDLC",
    equity: "孟加拉上市金融公司口径",
    licenseReg: "孟加拉：BB NBFI",
    trafficRank: "本地非点点出海主榜",
    verify: "仅监管",
  },
  "IPDC Finance（·BD）": {
    controller: "IPDC",
    equity: "孟加拉金融公司",
    licenseReg: "孟加拉：BB NBFI",
    trafficRank: "本地",
    verify: "仅监管",
  },
  "LankaBangla Finance（·BD）": {
    controller: "LankaBangla",
    equity: "孟加拉金融公司",
    licenseReg: "孟加拉：BB NBFI",
    trafficRank: "本地",
    verify: "仅监管",
  },
  "LOLC Finance（·LK）": {
    controller: "LOLC集团",
    equity: "斯里兰卡上市金融集团",
    licenseReg: "斯里兰卡：CBSL LFC（部分可吸储，需单列）",
    trafficRank: "本地",
    verify: "仅监管",
  },
  "LB Finance（·LK）": {
    controller: "LB Finance",
    equity: "斯里兰卡LFC",
    licenseReg: "斯里兰卡：CBSL LFC",
    trafficRank: "本地",
    verify: "仅监管",
  },
  "Commercial Credit & Finance（·LK）": {
    controller: "Commercial Credit",
    equity: "斯里兰卡",
    licenseReg: "斯里兰卡：CBSL LFC",
    trafficRank: "本地",
    verify: "仅监管",
  },
  "Cashalo/Paloo（·PH）": {
    controller: "Paloo/Cashalo体系",
    equity: "待核实",
    licenseReg: "菲律宾：SEC Lending/OLP待核",
    trafficRank: "路飞PH/历史榜",
    verify: "仅流量",
  },
  "Digido（·PH）": {
    controller: "待核实",
    equity: "待核实",
    licenseReg: "菲律宾：SEC待核",
    trafficRank: "路飞PH榜",
    verify: "仅流量",
  },
  "FE Credit（FE·VN）": {
    controller: "FE Credit（VPBank历史关联叙事）",
    equity: "越南消费金融；股权以最新披露为准",
    licenseReg: "越南：SBV金融公司",
    trafficRank: "VN消费金融头部；路飞VN榜",
    verify: "仅监管",
  },
  "Home Credit Vietnam（Home Credit·VN）": {
    controller: "Home Credit Group",
    equity: "PPF/Home Credit国际",
    licenseReg: "越南：SBV金融公司",
    trafficRank: "VN消费金融头部",
    verify: "仅监管",
  },
  "Shinhan Finance（新韩·VN）": {
    controller: "新韩金融集团",
    equity: "韩资",
    licenseReg: "越南：SBV金融公司",
    trafficRank: "本地",
    verify: "仅监管",
  },
  "AEON Credit Service/AEON Credit（AEON·MY）": {
    controller: "AEON Credit Service",
    equity: "日资AEON金融",
    licenseReg: "马来西亚：BNM非银信贷",
    trafficRank: "MY本地",
    verify: "仅监管",
  },
  "Easy Buy（Easy Buy·TH）": {
    controller: "Easy Buy（ACS/日资消费金融叙事）",
    equity: "日资消费金融",
    licenseReg: "泰国：BOT相关消费信贷",
    trafficRank: "TH本地",
    verify: "仅监管",
  },
  "Ascend Nano/Ascend（Ascend·TH）": {
    controller: "Ascend Group / True体系叙事",
    equity: "泰国Ascend",
    licenseReg: "泰国：BOT Nano Finance",
    trafficRank: "TH Nano常见",
    verify: "仅监管",
  },
  "Upstart（Upstart·US）": {
    controller: "Upstart Network",
    equity: "NASDAQ: UPST",
    licenseReg: "美国：银行合作/州放贷路径（非全能银行）",
    trafficRank: "US对照；非点点出海借贷榜",
    verify: "仅监管",
  },
  "DiDi Finanzas/DiDi（滴滴·MX）": {
    controller: "滴滴出行信贷臂（墨西哥）",
    equity: "DiDi全球关联",
    licenseReg: "墨西哥：SOFOM等路径待核登记号",
    trafficRank: "点点/MX场景衍生信贷",
    verify: "仅流量",
  },
  "Tala（Tala·MX）": {
    controller: "Tala",
    equity: "美国总部私募",
    licenseReg: "墨西哥：本地放贷主体待核",
    trafficRank: "路飞MX现金贷榜常见",
    verify: "仅流量",
  },
  "Fortaprest/Lexin（乐信·MX）": {
    controller: "乐信Lexin出海",
    equity: "NASDAQ: LX 关联",
    licenseReg: "墨西哥：SOFOM等待核",
    trafficRank: "点点MX榜常见",
    verify: "仅流量",
  },
  "Starpresta（·MX）": {
    controller: "待核实",
    equity: "待核实",
    licenseReg: "墨西哥：待核CNBV/CONDUSEF相关名录",
    trafficRank: "点点MX榜常见",
    verify: "仅流量",
  },
  "Finanzas Ágiles/FinVolution（信也·MX）": {
    controller: "FinVolution（信也）墨主体",
    equity: "FinVolution Group",
    licenseReg: "墨西哥：本地金融公司待核登记号",
    trafficRank: "点点MX榜",
    verify: "仅流量",
  },
  "Baubap（·MX）": {
    controller: "Baubap",
    equity: "墨西哥私募",
    licenseReg: "墨西哥：SOFOM等待核",
    trafficRank: "点点MX榜",
    verify: "仅流量",
  },
  "PopPréstamo（·MX）": {
    controller: "待核实",
    equity: "待核实",
    licenseReg: "墨西哥：待核",
    trafficRank: "点点/路飞MX",
    verify: "仅流量",
  },
  "Nubank（Nubank·BR）": {
    controller: "Nubank",
    equity: "NYSE: NU",
    licenseReg: "巴西：数字银行大牌照臂+信用卡/借贷",
    trafficRank: "BR超级App；路飞BR榜交叉",
    verify: "仅监管",
  },
  "Atome（Atome·SEA）": {
    controller: "Atome / Advance.ai 关联叙事",
    equity: "私募",
    licenseReg: "多国BNPL分主体（SEA）",
    trafficRank: "SEA BNPL商店榜常见",
    verify: "仅流量",
  },
  "Tabby（Tabby·GCC）": {
    controller: "Tabby",
    equity: "中东BNPL私募",
    licenseReg: "沙特等：SAMA BNPL/金融公司路径",
    trafficRank: "MEA BNPL头部",
    verify: "仅监管",
  },
  "Tamara（Tamara·GCC）": {
    controller: "Tamara",
    equity: "中东BNPL私募",
    licenseReg: "沙特等：SAMA相关",
    trafficRank: "MEA BNPL头部",
    verify: "仅监管",
  },
  "Addi（Addi·CO）": {
    controller: "Addi",
    equity: "哥伦比亚BNPL私募",
    licenseReg: "哥伦比亚：本地信贷/BNPL主体待核",
    trafficRank: "路飞CO榜BNPL",
    verify: "仅流量",
  },
  "Klarna（Klarna·EU）": {
    controller: "Klarna Bank AB",
    equity: "瑞典BNPL/银行；私募为主",
    licenseReg: "欧盟银行/消费信贷牌照路径",
    trafficRank: "欧美对照；非点点出海主榜",
    verify: "仅监管",
  },
  "Affirm（Affirm·US）": {
    controller: "Affirm Holdings",
    equity: "NASDAQ: AFRM",
    licenseReg: "美国：银行合作/州放贷",
    trafficRank: "US对照",
    verify: "仅监管",
  },
  "Afterpay/Block（Afterpay·US）": {
    controller: "Block, Inc.（Afterpay）",
    equity: "NYSE: XYZ（原SQ）",
    licenseReg: "澳/美等BNPL监管路径",
    trafficRank: "澳美对照",
    verify: "仅监管",
  },
  "爱租机（爱租机·CN）": {
    controller: "爱租机（中国租机）",
    equity: "待核实",
    licenseReg: "中国：融资租赁/租赁经营；灰区看回收套现",
    trafficRank: "国内应用商店租机类",
    verify: "仅监管",
  },
  "人人租（人人租·CN）": {
    controller: "人人租",
    equity: "待核实",
    licenseReg: "中国：租赁经营",
    trafficRank: "国内",
    verify: "仅监管",
  },
  "得机/得机租赁（得机·CN）": {
    controller: "得机",
    equity: "待核实",
    licenseReg: "中国：租赁",
    trafficRank: "国内",
    verify: "仅监管",
  },
  "SUPEREV/超级电动（SUPEREV·CN）": {
    controller: "SUPEREV",
    equity: "待核实",
    licenseReg: "出行工具订阅/租赁；牌照国别待核",
    trafficRank: "待补商店榜",
    verify: "待双端",
  },
  "M-KOPA（M-KOPA·KE）": {
    controller: "M-KOPA",
    equity: "非洲PAYG私募/机构",
    licenseReg: "多国：资产融资/电信PAYG（非经典现金贷牌照）",
    trafficRank: "KE等PAYG头部",
    verify: "仅监管",
  },
  "Watu/Watu Africa（Watu·KE）": {
    controller: "Watu",
    equity: "两轮资产融资私募",
    licenseReg: "东非等：资产融资/租赁",
    trafficRank: "KE/UG等",
    verify: "仅监管",
  },
  "JiuJiu Rental/久久租机（久久·NG）": {
    controller: "待核实",
    equity: "待核实",
    licenseReg: "设备租赁路径待核",
    trafficRank: "待补",
    verify: "待双端",
  },
  "Tala（Tala·MULTI）": {
    controller: "Tala (Venture capital backed)",
    equity: "美国总部私募",
    licenseReg: "多国微金融/放贷牌照分主体（PH/KE/MX/IN等）",
    trafficRank: "路飞：PH/KE/MX榜常见现金贷名",
    verify: "仅流量",
  },
  "Branch（Branch·MULTI）": {
    controller: "Branch International",
    equity: "私募",
    licenseReg: "多国非银放贷分主体",
    trafficRank: "路飞：NG/KE/IN等榜常见",
    verify: "仅流量",
  },
  "MexDin（微财·MX）": {
    controller: "微财（用户口径）",
    equity: "待核实上市/股东披露",
    licenseReg: "墨西哥：SOFOM等路径待核登记号",
    trafficRank: "点点MX现金贷活跃前排",
    verify: "仅流量",
  },
  "快牛｜KN｜MexiCash（快牛·出海）": {
    controller: "快牛智能 / KN（用户口径）",
    equity: "待核实",
    licenseReg: "墨：SOFOM/金融公司路径待核；泰：本地非银信贷待牌照交叉",
    trafficRank: "墨 MexiCash 点点2025Q3助贷前列；泰待补",
    verify: "仅流量",
  },
  "Aplazo（Aplazo·MX）": {
    controller: "Aplazo",
    equity: "墨西哥BNPL私募",
    licenseReg: "MX BNPL/金融科技主体待核CNBV等名录",
    trafficRank: "路飞MX借款榜BNPL#24财务档常见",
    verify: "仅流量",
  },
};

function isPendingText(s: string): boolean {
  return (
    !s ||
    s.includes("待核实") ||
    s.includes("待补") ||
    s.includes("待核") ||
    s.includes("〔1〕") ||
    s.includes("CRM扩表")
  );
}

function hasTrafficSignal(s: string): boolean {
  if (isPendingText(s) && !s.includes("路飞") && !s.includes("点点") && !s.includes("Sensor Tower"))
    return false;
  // 路飞/点点/Sensor Tower 快照本身算流量端证据；纯「待核：GP…」不算
  if (s.includes("待核：GP") || s.includes("待核：GP/Apple")) return false;
  return (
    s.includes("点点") ||
    s.includes("路飞") ||
    s.includes("Sensor Tower") ||
    s.includes("ST·") ||
    (s.includes("GP") && !s.includes("待核")) ||
    s.includes("Apple") ||
    s.includes("#") ||
    s.includes("下载") ||
    s.includes("MAU") ||
    s.includes("榜")
  );
}

function hasLicenseSignal(s: string): boolean {
  // 区域口径模板/「待核监管名录」不算已完成监管端
  if (isPendingText(s)) return false;
  return (
    s.includes("OJK") ||
    s.includes("SEC") ||
    s.includes("RBI") ||
    s.includes("NBFC") ||
    s.includes("SBV") ||
    s.includes("BNM") ||
    s.includes("BOT") ||
    s.includes("SECP") ||
    s.includes("CBSL") ||
    s.includes("BB ") ||
    s.includes("支付") ||
    s.includes("牌照") ||
    s.includes("SOFOM") ||
    s.includes("SOFIPO") ||
    s.includes("LPBBTI") ||
    s.includes("OLP") ||
    s.includes("SAMA") ||
    s.includes("NASDAQ") ||
    s.includes("NYSE") ||
    s.includes("HK")
  );
}

function inferVerify(
  trafficRank: string,
  licenseReg: string,
  controller: string,
  forced?: VerifyStatus,
): VerifyStatus {
  if (forced) return forced;
  const t = hasTrafficSignal(trafficRank);
  const l = hasLicenseSignal(licenseReg);
  const c = !!controller && controller !== "待核实";
  if (t && l && c) return "双端通过";
  if (t && l) return "双端通过";
  if (t && !l) return "仅流量";
  if (!t && l) return "仅监管";
  return "〔1〕";
}

function finalizeScene(r: SceneDraft): SceneRow {
  const patch = SCENE_KYC[r.group] ?? {};
  const controller = patch.controller ?? r.controller ?? "待核实";
  const equity = patch.equity ?? r.equity ?? "待核实";
  const licenseReg = patch.licenseReg ?? r.licenseReg ?? "待核实";
  const trafficRank = patch.trafficRank ?? r.trafficRank ?? r.diandian ?? "待核实";
  const verify = inferVerify(trafficRank, licenseReg, controller, patch.verify ?? r.verify);
  const subTags = resolveSceneSubTags(r.group, `${r.sceneType ?? ""} ${r.creditAttach ?? ""}`, r.subTags);
  const tags = resolveSceneTags(r.group, `${r.sceneType ?? ""} ${r.creditAttach ?? ""}`, r.tags);
  // 仅从牌照登记字段推断；派生信贷/集团名中的「银行」多为合作叙事，不计入持牌
  const licenseKinds = resolveLicenseKinds(r.licenseKinds, licenseReg);
  const orgDocNo = r.orgDocNo?.trim() || "待KYC·机构证件号";
  const institutionTypes = resolveInstitutionTypes("scene", undefined, r.institutionTypes);
  return {
    region: r.region,
    group: r.group,
    orgDocNo,
    institutionTypes,
    tags,
    subTags,
    sceneType: formatSceneTags(tags, subTags),
    apps: r.apps,
    countries: r.countries,
    languages: r.languages,
    mau: patch.mau ?? r.mau,
    registered: r.registered,
    share: patch.share ?? r.share,
    creditAttach: r.creditAttach,
    diandian: r.diandian,
    controller,
    equity,
    licenseReg,
    licenseKinds,
    trafficRank,
    verify,
  };
}

function finalizeCredit(r: CreditDraft): CreditRow {
  const patch = CREDIT_KYC[r.group] ?? {};
  const official = OFFICIAL_LICENSE_BY_GROUP[r.group];
  const controller = patch.controller ?? official?.controller ?? r.controller ?? "待核实";
  const equity = patch.equity ?? r.equity ?? "待核实";
  const licenseReg =
    (official ? formatOfficialLicenseReg(official) : undefined) ??
    patch.licenseReg ??
    r.licenseReg ??
    r.licenses ??
    "待核实";
  const trafficRank = patch.trafficRank ?? r.trafficRank ?? r.diandian ?? "待核实";
  const verify = inferVerify(
    trafficRank,
    licenseReg,
    controller,
    patch.verify ?? (official ? ("仅监管" as const) : r.verify),
  );
  const tags = resolveCreditTags(r.group, {
    tags: r.tags,
    brands: r.brands,
    licenses: r.licenses,
    note: patch.note ?? r.note,
    diandian: r.diandian,
  });
  const leaseSubs = resolveLeaseSubTags(r.group, r.line, {
    leaseSubs: r.leaseSubs,
    brands: r.brands,
    licenses: r.licenses,
    note: patch.note ?? r.note,
    volume: r.volume,
  });
  const ecoRoles = resolveEcoRoles(r.line, {
    ecoRoles: r.ecoRoles,
    note: patch.note ?? r.note,
    brands: r.brands,
  });
  const institutionTypes = resolveInstitutionTypes(
    "credit",
    r.line,
    r.institutionTypes,
    ecoRoles,
  );
  const fundKinds = resolveFundKinds(institutionTypes, r.fundKinds);
  const trafficKinds = resolveTrafficKinds(institutionTypes, r.line, r.trafficKinds);
  const paymentKinds = resolvePaymentKinds(institutionTypes, r.paymentKinds);
  const equityKinds = resolveEquityKinds(institutionTypes, r.equityKinds);
  const orgDocNo = r.orgDocNo?.trim() || "待KYC·机构证件号";
  // 仅监管/牌照字段；品牌与集团名不参与（避免「银行合作」误判）
  const licenseKinds = resolveLicenseKinds(r.licenseKinds, licenseReg, r.licenses);
  return {
    region: r.region,
    line: r.line,
    tier: r.tier,
    group: r.group,
    orgDocNo,
    institutionTypes,
    fundKinds,
    trafficKinds,
    paymentKinds,
    equityKinds,
    brands: r.brands,
    countries: r.countries,
    languages: r.languages,
    licenses: r.licenses,
    timing: r.timing,
    founded: r.founded?.trim() || "成立待核实",
    regulators: r.regulators,
    traffic: r.traffic,
    volume: patch.volume ?? r.volume,
    users: patch.users ?? r.users,
    employees: r.employees?.trim() || "员工待核实",
    diandian: r.diandian,
    note: patch.note ?? r.note,
    tags,
    leaseSubs,
    ecoRoles,
    controller,
    equity,
    licenseReg,
    licenseKinds,
    trafficRank,
    verify,
  };
}

/** 股权投资人名录：未命中 CRM 的新建；命中者仅打标 */
const equityInvestorSeeds: CreditDraft[] = EQUITY_INVESTOR_ROSTER.rows
  .filter((r) => !equityMatchGroup(r.name))
  .map((r) => {
    const short = r.name.split(/[,（(/]/)[0]?.trim() || r.name;
    return {
      region: r.region as Exclude<Region, "all">,
      line: "agent" as const,
      tier: (r.equityKind === "PE" || r.equityKind === "VC" ? "腰部" : "新兴") as CreditRow["tier"],
      group: `${r.name}｜${short}｜${r.name}（股权投资人·${r.equityKind}·${r.locCode}）`,
      brands: r.name,
      countries: r.countries,
      languages: "英语/当地语",
      licenses: "投资人（股权侧）·非信贷持牌主体",
      timing: "投资人对照",
      regulators: "—",
      traffic: "财务投资/战略投资",
      volume: "—",
      users: "被投企业",
      diandian: "公开信息",
      note: `股权投资人·${EQUITY_KIND_LABEL[r.equityKind]}${r.comment ? `；${r.comment}` : ""}`,
      institutionTypes: ["股权投资人"] as InstitutionType[],
      equityKinds: [r.equityKind],
      verify: "待双端" as const,
      licenseReg: "投资人对照·非放贷牌照",
      trafficRank: "B端",
      controller: r.name,
    };
  });

function withEquityInvestorTagsOnCredit(row: CreditRow): CreditRow {
  const matched = equityKindsFromRosterMatch(row.group);
  if (!matched.length) return row;
  const institutionTypes = INSTITUTION_TYPE_ORDER.filter(
    (t) => row.institutionTypes.includes(t) || t === "股权投资人",
  );
  const equityKinds = EQUITY_KIND_ORDER.filter(
    (k) => row.equityKinds.includes(k) || matched.includes(k),
  );
  const note = /投资人名录·打标/.test(row.note)
    ? row.note
    : `${row.note}｜投资人名录·打标`;
  return { ...row, institutionTypes, equityKinds, note };
}

function withEquityInvestorTagsOnScene(row: SceneRow): SceneRow {
  const matched = equityKindsFromRosterMatch(row.group);
  if (!matched.length) return row;
  const institutionTypes = INSTITUTION_TYPE_ORDER.filter(
    (t) => row.institutionTypes.includes(t) || t === "股权投资人",
  );
  return { ...row, institutionTypes };
}

const scenes: SceneRow[] = [...scenesCore, ...expandSceneSeeds(sceneCrmSeeds)].map(finalizeScene).map(withEquityInvestorTagsOnScene);

const creditsCore: CreditDraft[] = [
  // —— 现金贷 头部 ——
  {
    region: "east-asia",
    line: "cash",
    tier: "头部",
    group: "奇富科技/奇富借条/Qfin（奇富·CN）",
    brands: "奇富借条",
    countries: "中国",
    languages: "中文",
    licenses: "助贷撮合 + 银行/消金合作",
    timing: "原360数科路径；2025末助贷新规承压",
    regulators: "国家金融监管总局等",
    traffic: "App直获客（无自营生活场景）",
    volume: "2025撮合约RMB3271亿；在贷约1260亿",
    users: "获批额度用户约6480万",
    diandian: "CN：国内助贷App不进点点出海借贷榜 · 出海见KrediOne行",
    note: "纯信贷原生",
  },
  {
    region: "east-asia",
    line: "cash",
    tier: "头部",
    group: "FinVolution/信也（信也·CN）",
    brands: "国内多品牌；印尼AdaKami；菲JuanHand；澳Fundo",
    countries: "中国、印尼、菲律宾、澳大利亚",
    languages: "中/印尼/英等",
    licenses: "中国助贷撮合；印尼OJK LPBBTI（P2P）；菲SEC Lending Company + Recorded OLP",
    timing: "2007起；出海多年；澳2025收购",
    regulators: "中国金融监管；OJK；SEC PH",
    traffic: "App投放/渠道",
    volume: "2025交易额RMB2003亿；海外放款140亿",
    users: "累计注册约2.47亿；海外借款人约1340万",
    diandian: "ID·AdaKami：点点借贷下载头部梯队，2025H2走弱（Dec稿） | PH·JuanHand：菲现金贷领先梯队（公开/行业） | AU·Fundo：待补点点名次",
    note: "点点：AdaKami印尼现金贷头部梯队",
  },
  {
    region: "east-asia",
    line: "cash",
    tier: "头部",
    group: "Fintopia/瓴岳/洋钱罐（洋钱罐·CN）",
    brands: "洋钱罐；印尼Easycash；墨Credmex",
    countries: "中国；印尼等东南亚；拉美/非洲据点",
    languages: "中/印尼/西等",
    licenses: "中国助贷撮合；印尼OJK LPBBTI（Easycash）；墨金融公司/SOFOM等（Credmex）",
    timing: "洋钱罐2015；出海持续",
    regulators: "中国助贷规则；OJK",
    traffic: "App直获客",
    volume: "累计撮合700亿+RMB；Easycash印尼余额约20亿+（行业口述）",
    users: "全球约1.6亿+",
    diandian:
      "ID·Easycash：点点《2026海外现金贷H1》东南亚活跃#3 · MAU均值~144.84万 · 环比-24.39%（体量仍前三但活跃收缩）｜既有2025-12下载#2~78.3万 | MX·Credmex：H1拉美活跃#7 · MAU均值~96.58万 · 环比-3.72%",
    note: "点点H1：Easycash活跃显著下滑须与印尼出清/风控交叉；下载榜与MAU背离时以MAU+监管为准",
  },
  {
    region: "east-asia",
    line: "cash",
    tier: "腰部",
    group: "乐信/分期乐/Lexin（乐信·CN）",
    brands: "分期乐（现以信贷服务为主）",
    countries: "中国",
    languages: "中文",
    licenses: "助贷/科技赋能",
    timing: "分期电商基因弱化后偏信贷",
    regulators: "中国金融监管",
    traffic: "App + 合作",
    volume: "2025发起约RMB2050亿",
    users: "年活跃约820万；累计注册2.45亿",
    diandian: "CN：国内为主；MX·Fortaprest：点点2025Q3墨助贷约第五、MAU~71.4万——见Fortaprest详档",
    note: "2026与信用飞等一同被约谈名单出现；出海墨见Fortaprest",
  },
  {
    region: "east-asia",
    line: "cash",
    tier: "腰部",
    group: "嘉银科技/嘉银/Jiayin（嘉银·CN）",
    brands: "嘉银系；出海品牌含Soluskita等历史线",
    countries: "中国 + 出海",
    languages: "中文等",
    licenses: "助贷撮合；海外本地持牌",
    timing: "上市助贷；深化出海",
    regulators: "中国；海外本地",
    traffic: "App/渠道",
    volume: "2025撮合RMB1290亿",
    users: "未公开",
    diandian: "出海历史品牌点点位次待补；CN国内助贷不进出海榜",
    note: "中腰上市助贷",
  },
  {
    region: "east-asia",
    line: "cash",
    tier: "腰部",
    group: "信飞科技/信用飞（信用飞·CN）",
    brands: "信用飞（国内）；出海本地化平台（公开产品名待核实）",
    countries: "中国；2021印尼OJK、2023菲SEC自述",
    languages: "中文等",
    licenses: "CN：地方金融办小贷/助贷撮合；海外待按国填写",
    timing: "航旅分期起家→综合现金贷/助贷",
    regulators: "中国金融监管总局（2026约谈名单）；海外本地",
    traffic: "App/渠道；无自营电商/出行场景",
    volume: "国内在贷曾大幅波动（媒体）；海外细数待核实",
    users: "未统一公开",
    diandian: "CN：国内助贷 | 出海App名待核实后回填点点国榜",
    note: "勿与KrediOne股权简单等同（见下条）",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "Xinfei Digital/KrediOne（奇富·ID）",
    brands: "KrediOne",
    countries: "印尼",
    languages: "印尼语、英语",
    licenses: "OJK LPBBTI（P2P）+ AFPI会员",
    timing: "2025-05 360Kredi更名KrediOne",
    regulators: "OJK",
    traffic: "App直获客",
    volume: "自述累计放款至2024-08约3万亿盾",
    users: "未公开",
    diandian: "ID·KrediOne：点点2025-09下载#2（~85.1万）；APP指数四星领跑段（~7488）；2025H2/Dec走弱。点点稿写作「信飞科技」",
    note: "股权：Xinfei Digital（原360 Fintech Asia）持股约85%，媒体关联奇富QFIN。点点「信飞」=Xinfei音译，勿与国内信用飞品牌简单等同",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "Finplus（·ID）",
    brands: "Finplus",
    countries: "印尼",
    languages: "印尼语",
    licenses: "OJK P2P（待核最新名录）",
    timing: "点点2025-09 Top50活跃第一梯队",
    regulators: "OJK",
    traffic: "App",
    volume: "待核实",
    users: "点点2025-09 MAU~162万（与Easycash/Kredit Pintar同梯队）",
    diandian: "ID：点点2025-09借贷工具活跃第二（~162万MAU），与Easycash(~200万)、Kredit Pintar(~147万)构成第一梯队",
    note: "点点公开Top50校验通过；CRM原名单曾漏，现补入核心表",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "Cairin（·ID）",
    brands: "Cairin",
    countries: "印尼",
    languages: "印尼语",
    licenses: "OJK P2P（待核）",
    timing: "点点2025-09下载环比正增长样本",
    regulators: "OJK",
    traffic: "App",
    volume: "待核实",
    users: "待核实",
    diandian: "ID：点点2025-09下载环比+13.26%（与Adapundi同属逆势增长样本）",
    note: "点点公开稿点名；非头部但校验存在",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "PinjamDuit（·ID）",
    brands: "PinjamDuit",
    countries: "印尼",
    languages: "印尼语",
    licenses: "OJK P2P（待核）",
    timing: "点点2025-09榜内",
    regulators: "OJK",
    traffic: "App",
    volume: "待核实",
    users: "待核实",
    diandian: "ID：点点2025-09下载环比约-35.51%（稿内点名下滑样本）",
    note: "点点公开稿点名；与Samir等同属存量承压腰部",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "Bussan Auto Finance/BAF Mobile（BAF·ID）",
    brands: "BAF Mobile",
    countries: "印尼",
    languages: "印尼语",
    licenses: "传统金融机构数字臂（车辆分期）",
    timing: "点点2025-09",
    regulators: "OJK等",
    traffic: "App；车贷分期场景",
    volume: "细分车贷",
    users: "规模非最大但商店口碑高",
    diandian: "ID：点点2025-09借贷工具唯一五星；APP指数~10152（好评率等维度拉高）",
    note: "点点校验：非纯现金贷，偏车辆分期/多金融；与租机贷灰区不同",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "Ammana（·ID）",
    brands: "Ammana",
    countries: "印尼",
    languages: "印尼语",
    licenses: "OJK LPBBTI（P2P；伊斯兰金融）",
    timing: "点点2025-09 Top50三星档",
    regulators: "OJK",
    traffic: "App；清真/伊斯兰客群",
    volume: "细分垂直",
    users: "点点2025-09约12.56万稳定用户群",
    diandian: "ID：点点2025-09 APP指数~6240（三星）；伊斯兰金融垂直样本",
    note: "点点公开校验建档·靠谱垂直玩家",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "AsetKu/Akulaku（阿卡拉克·ID）",
    brands: "AsetKu；PT Pintar Inovasi Digital",
    countries: "印尼",
    languages: "印尼语",
    licenses: "OJK LPBBTI（P2P）",
    timing: "Akulaku生态现金贷臂；2025-09与Home Credit合作稿",
    regulators: "OJK",
    traffic: "Akulaku生态+Home Credit App联合入口",
    volume: "待核实",
    users: "待核实",
    diandian: "ID：点点2025-09行业动态点名（Home Credit×AsetKu联合现金贷）；属Akulaku/BNC生态信贷臂",
    note: "点点公开校验建档；场景集团派生的现金贷产品线",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "Rupiah Cepat（·ID）",
    brands: "Rupiah Cepat；摩比神奇",
    countries: "印尼",
    languages: "印尼语",
    licenses: "OJK LPBBTI（P2P）",
    timing: "多年持牌",
    regulators: "OJK",
    traffic: "App",
    volume: "历史累计下载头部梯队（点点2023–24报告）",
    users: "待核实近况",
    diandian: "ID：点点《海外现金贷2025》累计下载/月活历史TOP前四梯队；仿冒变体曾出现在非法名单对照",
    note: "点点公开校验建档·历史头部中资出海",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "UangMe（·ID）",
    brands: "UangMe",
    countries: "印尼",
    languages: "印尼语",
    licenses: "OJK LPBBTI（P2P）",
    timing: "持牌运营",
    regulators: "OJK",
    traffic: "App",
    volume: "待核实",
    users: "待核实",
    diandian: "ID：点点借贷工具榜常见中腰品牌；公开稿位次随月波动，建档待续补最新名次",
    note: "点点生态常见名·正式建档（种子升详档）",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "Bank Neo Commerce/Neo Pinjam（BNC·ID）",
    brands: "Neo Pinjam；Bank Neo Commerce",
    countries: "印尼",
    languages: "印尼语",
    licenses: "数字银行大牌照产品（对照）",
    timing: "点点2025-09：限额提至1亿盾、期限至24月",
    regulators: "OJK/央行体系",
    traffic: "BNC/Akulaku生态",
    volume: "银行侧个贷扩张",
    users: "BNC自称服务超2600万客户（集团口径）",
    diandian: "ID：点点2025-09行业动态点名Neo Pinjam额度上调；属场景/数字银行派生信贷",
    note: "点点公开校验建档；大牌照银行产品，作信贷对照样本",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "Surfin Meta/Surfin（Surfin·SG）",
    brands: "Surfin；印尼Ayovest等扩展产品",
    countries: "约9–10国：ID PH VN MX IN NG KE UG AU等",
    languages: "多语",
    licenses: "印尼：P2P、基金分销、汇款等；支付网关申请中",
    timing: "2017成立；2024起外部融资",
    regulators: "各国本地（印尼OJK等）",
    traffic: "社媒投放+App；信贷起家后扩支付/卡/理财",
    volume: "公司自述累计交易约$2.7B–$5.5B（时点不一）",
    users: "注册约0.6–1.07亿（公司口径演进）",
    diandian: "多国运营；点点公开国榜位次待逐国回填（ID/PH/MX/VN等）",
    note: "用户点名的腰部出海；新加坡总部，吴亚南",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "Adapundi/印闪（印闪·ID）",
    brands: "Adapundi",
    countries: "印尼",
    languages: "印尼语",
    licenses: "OJK LPBBTI（P2P）",
    timing: "持牌运营中",
    regulators: "OJK",
    traffic: "App",
    volume: "点点Dec’25月下载约66.4万",
    users: "合作稿自称近3000万用户（待核实）",
    diandian: "ID：点点2025-12借贷下载#3（~66.4万，-2.6%MoM）；2025-09下载环比+5.72%",
    note: "点点东南亚财务榜写作「印闪科技」旗下；Dec’25下载前三校验通过",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "维信金科/Vcredit（维信·CN）",
    brands: "印尼Doeku（收购）",
    countries: "中国；印尼",
    languages: "中/印尼",
    licenses: "国内助贷；印尼OJK（Doeku）",
    timing: "2025收购PT Doeku约85%",
    regulators: "中国；OJK",
    traffic: "App",
    volume: "Doeku细数待核实",
    users: "待核实",
    diandian: "ID·Doeku：点点位次待补（2025收购后）",
    note: "上市助贷出海补位",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "Danaku/TrustIQ（·ID）",
    brands: "Danaku；TrustIQ",
    countries: "印尼",
    languages: "印尼语",
    licenses: "OJK LPBBTI（P2P）",
    timing: "品牌升级TrustIQ→Danaku",
    regulators: "OJK",
    traffic: "App",
    volume: "点点曾报活跃环比大增（9月榜）",
    users: "待核实",
    diandian: "ID：点点2025-09 Top50，APP指数~6950（三星）；活跃环比+46.4%（品牌升级）",
    note: "本土ANS Group；非中资",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "JuanHand/FinVolution（信也·PH）",
    brands: "JuanHand",
    countries: "菲律宾",
    languages: "英语、他加禄语",
    licenses: "SEC Lending Company + Recorded OLP（MC 19 s.2019；WeFund Lending Corp.）",
    timing: "信也出海菲主力",
    regulators: "SEC PH",
    traffic: "App+社媒矩阵",
    volume: "待核实单体放款",
    users: "公司口径服务超千万级（待核）",
    diandian: "PH：点点/公开报告现金贷综合指数领先梯队（2024末TOP口径）；与AdaKami同属FinVolution出海",
    note: "点点公开校验建档；集团行见信也 FinVolution",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "MabilisCash（·PH）",
    brands: "MabilisCash",
    countries: "菲律宾",
    languages: "英/菲",
    licenses: "SEC 借贷/OLP（待核最新名录）",
    timing: "菲现金贷公开榜常见",
    regulators: "SEC PH",
    traffic: "App",
    volume: "待核实",
    users: "待核实",
    diandian: "PH：点点海外现金贷报告等公开材料中菲榜常见头部/次头部名",
    note: "点点公开校验建档·自腰部池拆出",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "FTLending（·PH）",
    brands: "FTLending",
    countries: "菲律宾",
    languages: "英/菲",
    licenses: "SEC OLP（待核）",
    timing: "商店榜腰部曾同比大升",
    regulators: "SEC PH",
    traffic: "App投放",
    volume: "待核实",
    users: "待核实",
    diandian: "PH：点点/商店榜腰部，排名曾同比大升（既有锚点升详档）",
    note: "点点相关公开监测建档·自腰部池拆出",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "Mr.cash（·PH）",
    brands: "Mr.cash",
    countries: "菲律宾",
    languages: "英/菲",
    licenses: "SEC OLP（待核）",
    timing: "菲现金贷Top梯队公开口径",
    regulators: "SEC PH",
    traffic: "App",
    volume: "待核实",
    users: "待核实",
    diandian: "PH：与MabilisCash同属菲现金贷公开Top梯队口径（2025末）",
    note: "点点/公开榜建档·自腰部池拆出",
  },
  {
    region: "south-asia",
    line: "cash",
    tier: "头部",
    group: "KreditBee（KreditBee·IN）",
    brands: "KreditBee / KrazyBee NBFC",
    countries: "印度",
    languages: "英语+印度多语",
    licenses: "RBI NBFC CoR（非吸储）+ 联合放贷",
    timing: "2016起；拟IPO",
    regulators: "RBI",
    traffic: "App直获客（无自营电商场景）",
    volume: "FY口径放款/AUM千亿卢比级（报道不一）",
    users: "南亚活跃#3口径 · MAU均值约792万（点点2026H1）",
    diandian:
      "IN：点点《2026海外现金贷H1》南亚活跃#3 · MAU均值~792.14万 · 环比+0.91%；须对齐RBI DLA目录/持牌NBFC通道",
    note: "用户拼写Crditbee多指此；≠中资出海CreditBee品牌（未见独立主体）",
  },
  // —— 监管官网补档（点点覆盖不足国别）——
  {
    region: "south-asia",
    line: "cash",
    tier: "腰部",
    group: "Paisayaar/JingleCred（·PK）",
    brands: "Paisayaar",
    countries: "巴基斯坦",
    languages: "乌尔都/英",
    licenses: "SECP Licensed Lending NBFC（Nano & BNPL）",
    timing: "SECP Digital Lending Apps White List（至2025-12-05）",
    regulators: "SECP",
    traffic: "App（白名单）",
    volume: "待核实",
    users: "待核实",
    diandian: "PK：点点覆盖弱；以SECP白名单建档",
    note: "监管官网建档：SECP白名单·JingleCred Digital Financial Services Limited",
  },
  {
    region: "south-asia",
    line: "cash",
    tier: "腰部",
    group: "JazzCash/JazzCash Lending（JazzCash·PK）",
    brands: "JazzCash（Android/iOS借贷工具）",
    countries: "巴基斯坦",
    languages: "乌尔都/英",
    licenses: "SECP Licensed Lending NBFC / Digital Lending Tool",
    timing: "SECP白名单（至2025-12-05）",
    regulators: "SECP",
    traffic: "钱包内嵌借贷工具",
    volume: "待核实",
    users: "点点2026H1南亚 MAU均值约1003万（区域#2；巴现金贷断层龙头）",
    diandian:
      "PK：点点《2026海外现金贷H1》南亚活跃#2 · MAU均值~1003.37万 · 环比+2.22%；电信钱包入口+即时贷/BNPL；SECP白名单建档",
    note: "监管官网建档：JazzCash Private Limited；场景钱包交叉",
  },
  {
    region: "south-asia",
    line: "cash",
    tier: "腰部",
    group: "Aitemaad/4Sight（·PK）",
    brands: "Aitemaad",
    countries: "巴基斯坦",
    languages: "乌尔都/英",
    licenses: "SECP Licensed Lending NBFC（Nano & BNPL）",
    timing: "SECP白名单（至2025-12-05）",
    regulators: "SECP",
    traffic: "App",
    volume: "待核实",
    users: "待核实",
    diandian: "PK：SECP白名单建档",
    note: "监管官网建档：4Sight Finance Services (Pvt) Limited",
  },
  {
    region: "south-asia",
    line: "cash",
    tier: "腰部",
    group: "Fauri Cash/Pakisnova（·PK）",
    brands: "Fauri Cash",
    countries: "巴基斯坦",
    languages: "乌尔都/英",
    licenses: "SECP Licensed Lending NBFC / Microfinance Company",
    timing: "SECP白名单（至2025-12-05）",
    regulators: "SECP",
    traffic: "App",
    volume: "待核实",
    users: "待核实",
    diandian: "PK：SECP白名单建档",
    note: "监管官网建档：Pakisnova Microfinance Company (Pvt) Limited",
  },
  {
    region: "south-asia",
    line: "cash",
    tier: "腰部",
    group: "PakCredit/VisionCred（·PK）",
    brands: "PakCredit",
    countries: "巴基斯坦",
    languages: "乌尔都/英",
    licenses: "SECP Licensed Lending NBFC",
    timing: "SECP白名单（至2025-12-05）",
    regulators: "SECP",
    traffic: "App",
    volume: "待核实",
    users: "待核实",
    diandian: "PK：SECP白名单建档",
    note: "监管官网建档：VisionCred Financial Services (Pvt) Limited",
  },
  {
    region: "south-asia",
    line: "cash",
    tier: "腰部",
    group: "IDLC Finance（·BD）",
    brands: "IDLC Finance PLC",
    countries: "孟加拉",
    languages: "孟加拉/英",
    licenses: "Bangladesh Bank NBFI（非银行金融机构）",
    timing: "BB公开链接名录",
    regulators: "Bangladesh Bank",
    traffic: "分支+数字渠道",
    volume: "待核实",
    users: "待核实",
    diandian: "BD：点点覆盖弱；BB NBFI名录建档",
    note: "监管官网建档：孟加拉央行非银金融公司",
  },
  {
    region: "south-asia",
    line: "cash",
    tier: "腰部",
    group: "IPDC Finance（·BD）",
    brands: "IPDC Finance Ltd",
    countries: "孟加拉",
    languages: "孟加拉/英",
    licenses: "Bangladesh Bank NBFI",
    timing: "BB公开链接名录",
    regulators: "Bangladesh Bank",
    traffic: "分支+数字",
    volume: "待核实",
    users: "待核实",
    diandian: "BD：BB NBFI名录建档",
    note: "监管官网建档",
  },
  {
    region: "south-asia",
    line: "cash",
    tier: "腰部",
    group: "LankaBangla Finance（·BD）",
    brands: "LankaBangla Finance PLC",
    countries: "孟加拉",
    languages: "孟加拉/英",
    licenses: "Bangladesh Bank NBFI",
    timing: "BB公开链接名录",
    regulators: "Bangladesh Bank",
    traffic: "分支+数字",
    volume: "待核实",
    users: "待核实",
    diandian: "BD：BB NBFI名录建档",
    note: "监管官网建档",
  },
  {
    region: "south-asia",
    line: "cash",
    tier: "腰部",
    group: "LOLC Finance（·LK）",
    brands: "LOLC Finance PLC",
    countries: "斯里兰卡",
    languages: "僧伽罗/泰米尔/英",
    licenses: "CBSL Licensed Finance Company（Finance Business Act）",
    timing: "CBSL公开授权吸储金融公司名录（至2025-12-31口径）",
    regulators: "Central Bank of Sri Lanka",
    traffic: "分支+数字",
    volume: "待核实",
    users: "待核实",
    diandian: "LK：点点覆盖弱；CBSL LFC名录建档",
    note: "监管官网建档；LFC可动员公众存款——相对「纯放贷小牌照」更接近中型非银",
  },
  {
    region: "south-asia",
    line: "cash",
    tier: "腰部",
    group: "LB Finance（·LK）",
    brands: "LB Finance PLC",
    countries: "斯里兰卡",
    languages: "僧伽罗/英",
    licenses: "CBSL Licensed Finance Company（Finance Business Act）",
    timing: "CBSL名录",
    regulators: "CBSL",
    traffic: "分支+数字",
    volume: "待核实",
    users: "待核实",
    diandian: "LK：CBSL LFC名录建档",
    note: "监管官网建档",
  },
  {
    region: "south-asia",
    line: "cash",
    tier: "腰部",
    group: "Commercial Credit & Finance（·LK）",
    brands: "Commercial Credit & Finance PLC",
    countries: "斯里兰卡",
    languages: "英等",
    licenses: "CBSL Licensed Finance Company",
    timing: "CBSL名录",
    regulators: "CBSL",
    traffic: "分支",
    volume: "待核实",
    users: "待核实",
    diandian: "LK：CBSL LFC名录建档",
    note: "监管官网建档",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "Cashalo/Paloo（·PH）",
    brands: "Cashalo；Cashacart",
    countries: "菲律宾",
    languages: "英/菲",
    licenses: "SEC Financing Company + Recorded OLP（MC 19 s.2019）",
    timing: "SEC Recorded OLP名录",
    regulators: "SEC Philippines",
    traffic: "App",
    volume: "待核实",
    users: "待核实",
    diandian: "PH：点点/SEC双源；Paloo Financing, Inc.",
    note: "监管官网建档：SEC OLP",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "Digido（·PH）",
    brands: "Digido",
    countries: "菲律宾",
    languages: "英/菲",
    licenses: "SEC Financing Company + Recorded OLP",
    timing: "SEC OLP名录",
    regulators: "SEC PH",
    traffic: "App",
    volume: "待核实",
    users: "待核实",
    diandian: "PH：SEC OLP建档",
    note: "监管官网建档：Digido Finance Corp.",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "FE Credit（FE·VN）",
    brands: "FE Credit",
    countries: "越南",
    languages: "越南语",
    licenses: "SBV 金融公司（Công ty tài chính）消费金融牌照",
    timing: "越南消费金融头部",
    regulators: "State Bank of Vietnam",
    traffic: "门店+App",
    volume: "市占长期头部（行业报告）",
    users: "待核实",
    diandian: "VN：点点覆盖弱；SBV金融公司口径建档",
    note: "监管官网逻辑建档：越南持牌消费金融公司",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "Home Credit Vietnam（Home Credit·VN）",
    brands: "Home Credit VN",
    countries: "越南",
    languages: "越南语",
    licenses: "SBV 金融公司消费金融牌照",
    timing: "多年",
    regulators: "SBV",
    traffic: "门店+App",
    volume: "待核实",
    users: "待核实",
    diandian: "VN：SBV金融公司建档",
    note: "监管官网逻辑建档",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "Shinhan Finance（新韩·VN）",
    brands: "Shinhan Finance",
    countries: "越南",
    languages: "越南语",
    licenses: "SBV 金融公司牌照",
    timing: "多年",
    regulators: "SBV",
    traffic: "门店+App",
    volume: "待核实",
    users: "待核实",
    diandian: "VN：SBV金融公司建档",
    note: "监管官网逻辑建档",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "AEON Credit Service/AEON Credit（AEON·MY）",
    brands: "AEON Credit Service (M) Berhad",
    countries: "马来西亚",
    languages: "英/马",
    licenses: "BNM 非银：Credit Card Issuer / 相关支付与信贷许可",
    timing: "BNM FSP Directory 可核",
    regulators: "Bank Negara Malaysia",
    traffic: "门店+App",
    volume: "待核实",
    users: "待核实",
    diandian: "MY：点点覆盖弱；BNM名录建档",
    note: "监管官网建档",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "Easy Buy（Easy Buy·TH）",
    brands: "Easy Buy",
    countries: "泰国",
    languages: "泰/英",
    licenses: "BOT Personal Loan under Supervision（P-Loan）",
    timing: "BOT非银个贷监管口径",
    regulators: "Bank of Thailand",
    traffic: "门店+App",
    volume: "待核实",
    users: "待核实",
    diandian: "TH：点点覆盖弱；BOT P-Loan口径建档",
    note: "监管官网逻辑建档",
  },
  {
    region: "se-asia",
    line: "cash",
    tier: "腰部",
    group: "Ascend Nano/Ascend（Ascend·TH）",
    brands: "Ascend Nano",
    countries: "泰国",
    languages: "泰/英",
    licenses: "BOT Nano Finance under Supervision + P-Loan（双登记）",
    timing: "BOT License Check 可核",
    regulators: "Bank of Thailand",
    traffic: "True/Ascend生态+App",
    volume: "待核实",
    users: "待核实",
    diandian: "TH：BOT Nano/P-Loan建档",
    note: "监管官网建档：纳米金融+个贷双口径",
  },
  {
    region: "africa",
    line: "cash",
    tier: "头部",
    group: "Tala（Tala·MULTI）",

    brands: "Tala",
    countries: "肯尼亚、菲律宾、墨西哥、印度等",
    languages: "英语及本地语",
    licenses: "各国本地放贷许可",
    timing: "多年扩张",
    regulators: "各国本地",
    traffic: "App",
    volume: "累计授信准入约$70–80亿（官网）",
    users: "累计约1300万+",
    diandian:
      "PH/KE/MX/IN：点点《2026海外现金贷H1》拉美活跃#10 · MAU均值~70.67万 · 环比-23.19%；iOS 2026-05-15下架+冒名欺诈冲击（压力样本）",
    note: "美系微型现金贷；菲市场常见对标；H1墨市场活跃显著承压",
  },
  {
    region: "africa",
    line: "cash",
    tier: "腰部",
    group: "Branch（Branch·MULTI）",
    brands: "Branch",
    countries: "肯尼亚、尼日利亚、坦桑、印度等",
    languages: "英语及本地语",
    licenses: "各国本地",
    timing: "市场有进退",
    regulators: "各国本地",
    traffic: "App",
    volume: "未公开",
    users: "未公开",
    diandian: "KE/NG等：点点公开月报位次待补",
    note: "手机数据评分现金贷",
  },
  {
    region: "west",
    line: "cash",
    tier: "头部",
    group: "Upstart（Upstart·US）",
    brands: "Upstart",
    countries: "美国",
    languages: "英语",
    licenses: "银行伙伴放贷 + 州牌照",
    timing: "美股上市多年",
    regulators: "美国银行/州监管",
    traffic: "App + 银行渠道",
    volume: "2025发起约$110亿",
    users: "约150万笔/年",
    diandian: "US：非点点出海借贷主监测池",
    note: "AI现金贷撮合",
  },
  {
    region: "latam",
    line: "cash",
    tier: "头部",
    group: "DiDi Finanzas/DiDi（滴滴·MX）",
    brands: "DiDi Finanzas",
    countries: "墨西哥（拉美扩展）",
    languages: "西",
    licenses: "MX：SOFOM/金融公司（CNBV/SIPRES可核）+ 场景合作放贷",
    timing: "场景派生信贷产品线",
    regulators: "墨西哥本地",
    traffic: "DiDi/Food/Pay场景嵌入",
    volume: "待核实单体放款",
    users: "点点2026H1拉美现金贷 MAU均值约390.06万（区域#1）",
    diandian:
      "MX：点点《2026海外现金贷H1》拉美活跃#1 · MAU均值~390.06万 · 环比+10.62%；Q2发版12次+DiDi Card Hot Sale；既有Q4'25 MAU~367.5万口径上修",
    note: "点点校验中置信（流量侧）；主体仍属场景原生集团，产品行按现金贷对照列入",
  },
  {
    region: "latam",
    line: "cash",
    tier: "头部",
    group: "Tala（Tala·MX）",
    brands: "Tala",
    countries: "墨西哥等",
    languages: "西/英",
    licenses: "MX：金融公司/SOFOM等（待核SIPRES具体形态）",
    timing: "多年",
    regulators: "墨西哥本地",
    traffic: "App直获客",
    volume: "待核实",
    users: "点点2026H1拉美 MAU均值约70.67万（区域#10）",
    diandian:
      "MX：点点《2026海外现金贷H1》拉美活跃#10 · MAU均值~70.67万 · 环比-23.19% · 位次↓1；iOS下架+欺诈叙事",
    note: "点点校验：Tala在MEA与MX均有榜；本行补墨市场位次；H1压力样本",
  },
  {
    region: "latam",
    line: "cash",
    tier: "头部",
    group: "快牛｜KN｜MexiCash（快牛·出海）",
    brands: "快牛 / KN / MexiCash",
    countries: "墨西哥、泰国",
    languages: "西/泰/中",
    licenses: "MX：金融公司/SOFOM等（待核SIPRES）；TH：本地非银信贷（待牌照交叉）",
    timing: "中资出海·快牛智能",
    regulators: "墨西哥/泰国本地金融监管",
    traffic: "App直获客",
    volume: "已投设施见展业持仓（KNZN·墨/泰）",
    users: "墨 MexiCash 点点2025Q3 MAU约72.89万",
    diandian:
      "MX：点点《2026海外现金贷H1》拉美活跃#8 · MAU均值~93.93万 · 环比+30.89% · 位次↑3；既有2025Q3 MAU~72.89万上修；泰榜待补",
    note: "集团统一档：墨品牌 MexiCash；泰现金贷设施 KNZN-CL-THB；勿再拆第二条「仅墨」重复卡",
  },
  {
    region: "latam",
    line: "cash",
    tier: "头部",
    group: "Fortaprest/Lexin（乐信·MX）",
    brands: "Fortaprest",
    countries: "墨西哥",
    languages: "西",
    licenses: "MX：金融公司/SOFOM等（待核SIPRES具体形态）",
    timing: "乐信出海墨",
    regulators: "墨西哥本地",
    traffic: "App",
    volume: "待核实",
    users: "点点2025Q3平均月活约71.4万",
    diandian: "MX：点点2025Q3助贷指数榜约第五；MAU~71.4万，环比约+18.18%",
    note: "点点公开校验建档；国内主体见乐信 Lexin",
  },
  {
    region: "latam",
    line: "cash",
    tier: "腰部",
    group: "Starpresta（·MX）",
    brands: "Starpresta",
    countries: "墨西哥",
    languages: "西",
    licenses: "MX：金融公司/SOFOM等（待核SIPRES具体形态）",
    timing: "点点2025Q3高增长样本",
    regulators: "墨西哥本地",
    traffic: "App",
    volume: "待核实",
    users: "待核实绝对值",
    diandian: "MX：点点2025Q3月活环比约+64.4%，下载约+102.7%（量质齐升样本）",
    note: "点点公开校验建档·四星高增",
  },
  {
    region: "latam",
    line: "cash",
    tier: "腰部",
    group: "MexDin（微财·MX）",
    brands: "MexDin",
    countries: "墨西哥",
    languages: "西",
    licenses: "MX：金融公司/SOFOM等（待核SIPRES具体形态）",
    timing: "微财出海墨；2025–26快速扩张",
    regulators: "墨西哥本地",
    traffic: "App",
    volume: "待核实",
    users: "点点2025Q3平均月活约74.62万；至2026-03活跃约97.9万量级（稿）",
    diandian: "MX：点点2025Q3三星但MAU逼近第一梯队；2026Q1稿称活跃自2025初约23.9万升至约97.9万",
    note: "归属微财；点点公开校验建档·规模腰部黑马",
  },
  {
    region: "latam",
    line: "cash",
    tier: "腰部",
    group: "Finanzas Ágiles/FinVolution（信也·MX）",
    brands: "Finanzas Ágiles",
    countries: "墨西哥",
    languages: "西",
    licenses: "MX：金融公司/SOFOM等（待核SIPRES具体形态）",
    timing: "信也出海墨",
    regulators: "墨西哥本地",
    traffic: "App",
    volume: "待核实",
    users: "点点2025Q3月均活跃约12.35万",
    diandian: "MX：点点2025Q3指数~6537（约第38）；MAU环比约+23.8%，下载约+46.9%",
    note: "点点公开校验建档；国内/东南亚主体见信也 FinVolution",
  },
  {
    region: "latam",
    line: "cash",
    tier: "腰部",
    group: "Baubap（·MX）",
    brands: "Baubap",
    countries: "墨西哥",
    languages: "西",
    licenses: "SOFOM等持牌（SIPRES可核）",
    timing: "本地持牌微金融",
    regulators: "墨西哥金融当局",
    traffic: "App",
    volume: "待核实",
    users: "待核实",
    diandian: "MX：点点2026Q1稿——合法机构遭冒名欺诈冲击；当季下载约-22.5%、活跃约-22.8%",
    note: "点点公开校验建档·本地持牌靠谱；合规风险来自仿冒而非自身灰产",
  },
  {
    region: "latam",
    line: "cash",
    tier: "腰部",
    group: "PopPréstamo（·MX）",
    brands: "PopPréstamo",
    countries: "墨西哥",
    languages: "西",
    licenses: "待核；有下架史",
    timing: "2025Q3仍有月活；2025-10商店下架后2026Q1暴涨复出",
    regulators: "墨西哥本地",
    traffic: "App；曾Google下架约15天",
    volume: "待核实",
    users: "2025Q3约16.5万月活；2026Q1 MAU/下载分别约+295%/+558%",
    diandian: "MX：点点2025Q3点名违规高息/催收风险并下架；2026Q1称复出后下载暴增、榜位跳升约40名",
    note: "点点公开建档·数据靠谱但合规存疑，CRM标风险观察，非默认合作推荐",
  },
  {
    region: "latam",
    line: "cash",
    tier: "头部",
    group: "Nubank（Nubank·BR）",
    brands: "Nubank",
    countries: "巴西、墨西哥、哥伦比亚",
    languages: "葡/西",
    licenses: "银行牌照",
    timing: "银行优先，信贷为核心产品",
    regulators: "BCB等",
    traffic: "银行App直获客（无电商/出行场景）",
    volume: "贷款余额近$110亿",
    users: "客户1.31亿",
    diandian: "BR/MX/CO：偏银行App；点点现金贷工具榜通常单列监测弱",
    note: "按「无生活场景、主做信贷」归信贷原生；产品含现金贷/卡循环",
  },

  // —— 消费分期 BNPL ——
  {
    region: "se-asia",
    line: "bnpl",
    tier: "头部",
    group: "Kredivo/FinAccel（Kredivo·ID）",
    brands: "Kredivo",
    countries: "印尼为主",
    languages: "印尼语、英语",
    licenses: "OJK Multifinance（融资公司/消费分期）；BNPL须对齐POJK 32/2025（融资公司事先批准）",
    timing: "持牌多年；POJK 32/2025调整窗约至2026-06",
    regulators: "OJK",
    traffic: "App + 电商结账嵌入（自身无电商场景）",
    volume: "点点2026H1东南亚活跃#1；行业侧对照OJK融资公司BNPL余额（2026-01约Rp12.18T量级）",
    users: "H1 MAU均值约1068万（稳居千万级）",
    diandian:
      "ID：点点《2026海外现金贷H1》东南亚活跃#1 · MAU均值~1068万 · 环比+5.21%；2026-05收购越南Timo→Timo Credit；R&M媒体摘要点名印尼BNPL头部（与Akulaku并列·US$8.59B市场叙事〔1〕）",
    note: "BNPL主尺用持牌余额/质量；勿与P2P Rp余额或第三方美元GMV混用；监管见POJK 32/2025",
  },
  {
    region: "se-asia",
    line: "bnpl",
    tier: "腰部",
    group: "Atome（Atome·SEA）",
    brands: "Atome；Kredit Pintar",
    countries: "SG MY PH ID",
    languages: "英语及本地语",
    licenses: "各国BNPL/卡相关",
    timing: "2020s",
    regulators: "各国本地",
    traffic: "结账嵌入 + App",
    volume: "FY2025 GMV>$4B；年化约$6B",
    users: "PH卡>3M",
    diandian: "ID·Kredit Pintar：点点2025-09 MAU~147万（第一梯队活跃） | SG/MY/PH：国榜位次待补",
    note: "区域BNPL腰上",
  },
  {
    region: "mena",
    line: "bnpl",
    tier: "头部",
    group: "Tabby（Tabby·GCC）",
    brands: "Tabby",
    countries: "沙特、阿联酋、科威特",
    languages: "阿/英",
    licenses: "SAMA BNPL/消费金融；UAE许可",
    timing: "2025–26关键牌照节点",
    regulators: "SAMA；CBUAE",
    traffic: "结账 + App",
    volume: "与Tamara合计沙特BNPL约93–95%份额",
    users: "注册约1500–2500万",
    diandian: "SA/AE/KW：GCC BNPL；点点拉美/SEA借贷榜非主池，中东榜待补",
    note: "BNPL双寡头之一",
  },
  {
    region: "mena",
    line: "bnpl",
    tier: "头部",
    group: "Tamara（Tamara·GCC）",
    brands: "Tamara",
    countries: "GCC",
    languages: "阿/英",
    licenses: "SAMA全牌照约2025.2",
    timing: "约2025",
    regulators: "SAMA",
    traffic: "结账 + App",
    volume: "2025利润约$5150万",
    users: "未公开",
    diandian: "GCC：同上，点点国榜待补",
    note: "BNPL双寡头之一",
  },
  {
    region: "latam",
    line: "bnpl",
    tier: "头部",
    group: "Aplazo（Aplazo·MX）",
    brands: "Aplazo",
    countries: "墨西哥",
    languages: "西",
    licenses: "金融公司/BNPL",
    timing: "本地BNPL龙头梯队；获BBVA Spark授信扩展",
    regulators: "墨西哥本地",
    traffic: "商户结账+App；Walmart Cashi等嵌入",
    volume: "待核实GMV",
    users: "点点2026H1拉美 MAU均值约185.97万（区域#2）",
    diandian:
      "MX：点点《2026海外现金贷H1》拉美活跃#2 · MAU均值~185.97万 · 环比+9.57%；既有2026Q1 MAU~175.7万上修；BBVA授信约$50M",
    note: "点点公开校验建档·墨BNPL/信贷交叉头部；种子升详档",
  },
  {
    region: "latam",
    line: "bnpl",
    tier: "腰部",
    group: "Addi（Addi·CO）",
    brands: "Addi",
    countries: "哥伦比亚",
    languages: "西语",
    licenses: "融资公司",
    timing: "约2024获批",
    regulators: "SFC",
    traffic: "商户结账 + App",
    volume: "年化GMV约$13亿",
    users: "约250–300万+",
    diandian: "CO：拉美BNPL；点点国榜待补",
    note: "拉美BNPL腰部标杆",
  },
  {
    region: "west",
    line: "bnpl",
    tier: "头部",
    group: "Klarna（Klarna·EU）",
    brands: "Klarna",
    countries: "欧美澳等",
    languages: "多语",
    licenses: "瑞典银行牌照等",
    timing: "多年",
    regulators: "瑞典FI等",
    traffic: "结账网络 + App",
    volume: "GMV 2025 $1279亿",
    users: "活跃1.18亿",
    diandian: "欧美：非点点出海借贷主监测池",
    note: "全球BNPL头部；无自营电商场景",
  },
  {
    region: "west",
    line: "bnpl",
    tier: "头部",
    group: "Affirm（Affirm·US）",
    brands: "Affirm",
    countries: "美加",
    languages: "英语",
    licenses: "州牌照/银行合作",
    timing: "多年",
    regulators: "美国各州",
    traffic: "结账 + App",
    volume: "FY25 GMV约$367亿",
    users: "活跃约2300万",
    diandian: "美加：非点点出海借贷主监测池",
    note: "美国BNPL头部",
  },
  {
    region: "west",
    line: "bnpl",
    tier: "头部",
    group: "Afterpay/Block（Afterpay·US）",
    brands: "Afterpay",
    countries: "美澳英等",
    languages: "英语",
    licenses: "各国BNPL",
    timing: "并入Block后整合",
    regulators: "美/澳等",
    traffic: "结账；与Cash App协同",
    volume: "BNPL GMV约$270亿+量级",
    users: "待核实最新官方",
    diandian: "美澳英：非点点出海借贷主监测池",
    note: "消费分期产品线",
  },

  // —— 信用租赁 ——
  {
    region: "east-asia",
    line: "lease",
    tier: "头部",
    group: "爱租机（爱租机·CN）",
    brands: "爱租机",
    countries: "中国（500+城）",
    languages: "中文",
    licenses: "租赁经营；接入芝麻信用免押",
    timing: "2016起；约10年",
    regulators: "市监/租赁相关；金融灰区需区分「租机贷」",
    traffic: "租赁App/小程序；信用免押",
    volume: "全品类循环租赁（3C为主）",
    users: "自述2500–3500万+用户（口径不一）",
    diandian: "CN租赁：点点出海借贷榜不适用；国内应用商店租赁类另计",
    note: "蚂蚁战略投资口径；3C信用租赁头部",
  },
  {
    region: "east-asia",
    line: "lease",
    tier: "头部",
    group: "易鑫集团/易鑫（易鑫·CN）",
    brands: "易鑫 / Yixin",
    countries: "中国",
    languages: "中文",
    licenses: "融资租赁等（汽车金融）",
    timing: "港股上市路径；汽车金融",
    regulators: "地方金融监管等",
    traffic: "汽车经销/金融产品分发",
    volume: "汽车融资租赁/贷款服务（口径待核最新年报）",
    users: "购车金融用户（待核）",
    diandian: "CN汽车金融；点点出海借贷榜不适用",
    note: "持融资租赁牌照的汽车金融；上市公司（HKEX 路径，代码以披露为准）",
    licenseReg: "已持：融资租赁(中国)",
    licenseKinds: ["其他"],
    equity: "HKEX: 2858.HK（以最新披露为准）",
    controller: "易鑫集团",
    trafficRank: "汽车金融头部对照",
    verify: "仅监管",
  },
  {
    region: "east-asia",
    line: "lease",
    tier: "头部",
    group: "人人租（人人租·CN）",
    brands: "人人租",
    countries: "中国",
    languages: "中文",
    licenses: "租赁撮合平台",
    timing: "多年；蚂蚁云鑫等投资",
    regulators: "市监等",
    traffic: "App/小程序免押租用",
    volume: "2024 GTV约75亿；份额约27.5%（灼识/公司稿）",
    users: "注册约6100万；付费约170万",
    diandian: "CN租赁：点点出海借贷榜不适用",
    note: "全品类信用免押撮合",
  },
  {
    region: "east-asia",
    line: "lease",
    tier: "腰部",
    group: "得机/得机租赁（得机·CN）",
    brands: "得机",
    countries: "中国约250城",
    languages: "中文",
    licenses: "租赁；芝麻/支付宝生态合作自称",
    timing: "约5年深耕手机租赁",
    regulators: "市监等",
    traffic: "支付宝搜索/小程序",
    volume: "手机以租代买为主",
    users: "未公开",
    diandian: "CN租赁：点点出海借贷榜不适用",
    note: "3C租机腰部",
  },
  {
    region: "east-asia",
    line: "lease",
    tier: "新兴",
    group: "SUPEREV/超级电动（SUPEREV·CN）",
    brands: "SUPEREV；与芝麻/乐道等联名订阅",
    countries: "中国",
    languages: "中文",
    licenses: "汽车订阅/运营；信用免押",
    timing: "2025–26汽车订阅验证期",
    regulators: "汽车流通+信用服务协同",
    traffic: "订阅平台；信用免押",
    volume: "四轮电动车订阅（7日–60月）",
    users: "未公开",
    diandian: "CN汽车订阅：点点借贷榜不适用",
    note: "信用租赁上探四轮EV；对标欧洲FINN叙事",
  },
  {
    region: "africa",
    line: "lease",
    tier: "头部",
    group: "M-KOPA（M-KOPA·KE）",
    brands: "M-KOPA",
    countries: "肯尼亚、乌干达、尼日利亚等",
    languages: "英语及本地语",
    licenses: "资产融资/PAYG",
    timing: "太阳能→智能手机融资",
    regulators: "各国本地",
    traffic: "设备分期；锁机风控",
    volume: "2025尼日利亚智能手机融资放款约$1.16亿（报道）",
    users: "累计设备融资数百万级",
    diandian: "KE/NG等：设备融资；点点现金贷工具榜位次待补",
    note: "非洲设备信用融资标杆（手机/能源）",
  },
  {
    region: "africa",
    line: "lease",
    tier: "头部",
    group: "Watu/Watu Africa（Watu·KE）",
    brands: "Watu Simu 等",
    countries: "肯尼亚、乌干达、尼日利亚、卢旺达等7国",
    languages: "英语及本地语",
    licenses: "资产融资",
    timing: "车融→手机融资",
    regulators: "各国本地",
    traffic: "门店+分期；设备锁",
    volume: "累计智能手机贷约305万笔；亦做摩托/电单车",
    users: "肯尼亚活跃贷账户百万级",
    diandian: "KE等：设备/两轮融资；点点借贷工具榜位次待补",
    note: "3C到两轮出行资产的信用租赁/分期",
  },
  {
    region: "africa",
    line: "lease",
    tier: "腰部",
    group: "JiuJiu Rental/久久租机（久久·NG）",
    brands: "JiuJiu / 久久租机",
    countries: "尼日利亚等非洲；拓展南美自述",
    languages: "中/英",
    licenses: "本地租赁/分期经营",
    timing: "国内租机经验出海非洲",
    regulators: "当地",
    traffic: "门店+分期租赁",
    volume: "手机租/分期；约40%首付等方案",
    users: "未公开",
    diandian: "NG等：租机分期；点点借贷榜位次待补",
    note: "中资背景出海信用租机代表",
  },
];

function creditBrandKey(group: string): string {
  const m = group.match(/（([^）]+)）\s*$/);
  if (!m) return group.trim();
  const inner = m[1].trim();
  // 生态/监管括号多为「监管·ID」「流量服务商·…」「支付·代理·CI」定位标签：
  // 不能只用内层作键（同国监管会被吞），也不能只用简称（同洲跨国同品牌会被吞）。
  if (
    /^(监管|流量服务商|数据服务方|资金参与|风险参与|风控|支付服务|支付·|回收|权益|触达|公关|信托|会计|律师|评级)/.test(
      inner,
    )
  ) {
    const head = group.replace(/（[^）]+）\s*$/, "").trim();
    const pipes = head.split(/[｜|]/).map((s) => s.trim()).filter(Boolean);
    // Name｜Short｜Desc → 优先用简称（BI / OJK / SEC）
    const short =
      pipes.length >= 2 && pipes[1].length <= 24 ? pipes[1] : pipes[0] || head;
    const long = pipes[0] || head;
    // 「目录入口」等角色词作简称时改用全名，避免 Meta/TikTok/Apple 伙伴目录互吞
    const base = /^(目录入口|本地银行|银行联盟|Local Banks|本地PI|银行侧)$/i.test(short)
      ? long
      : short || long;
    // 并入括号定位（含国别码），避免 Orange Money / M-Pesa / SEC 等同简称跨国被吞
    return `${base || group.trim()}·${inner}`;
  }
  // 玩家常见键：信也·CN
  return inner;
}

function dedupeCreditRows(rows: CreditRow[]): CreditRow[] {
  const seen = new Set<string>();
  const out: CreditRow[] = [];
  for (const r of rows) {
    // 同洲际+产品线+品牌键（括号内如 信也·CN）合并，避免「FinVolution/信也」与「信也/拍拍贷」双份
    const key = `${r.region}|${r.line}|${creditBrandKey(r.group)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** 玩家括号键「洋钱罐·CN」→ 家族茎「洋钱罐」；生态/监管复合键不折叠 */
function creditBrandFamilyStem(group: string): string | null {
  const key = creditBrandKey(group);
  if (key.includes("|") || /流量服务商|监管|支付·|资金参与|风险参与/.test(key)) return null;
  const idx = key.lastIndexOf("·");
  if (idx <= 0) return null;
  const loc = key.slice(idx + 1).trim();
  // 国别/区域定位码；过长则多半是生态标签而非分国卡
  if (
    !/^(CN|ID|MX|PH|IN|TH|VN|MY|US|HK|TW|JP|KR|BD|PK|NG|KE|BR|CO|PE|CL|AR|AU|MN|SG|MM|KH|LA|NP|LK|ZA|EG|GH|TZ|UG|MZ|出海|SEA|LATAM|非洲|MEA|EU|UK|全球)$/i.test(
      loc,
    )
  ) {
    return null;
  }
  const stem = key.slice(0, idx).trim();
  return stem || null;
}

/**
 * 搜索结果：同品牌分国卡（洋钱罐·CN/ID/MX、信也·CN/ID/PH…）只留一张。
 * 搜家族名 → 优先集团主档；搜 Easycash/Credmex 等本地名 → 优先该分国卡。
 */
function collapseCreditHitsByBrandFamily(rows: CreditRow[], q: string): CreditRow[] {
  const needle = q.trim().toLowerCase();
  if (!needle || rows.length <= 1) return rows;

  const buckets = new Map<string, CreditRow[]>();
  const order: string[] = [];
  for (const r of rows) {
    const stem = creditBrandFamilyStem(r.group) ?? `\0${creditBrandKey(r.group)}`;
    if (!buckets.has(stem)) {
      buckets.set(stem, []);
      order.push(stem);
    }
    buckets.get(stem)!.push(r);
  }

  const pick = (list: CreditRow[], stem: string): CreditRow => {
    const stemLc = stem.startsWith("\0") ? "" : stem.toLowerCase();
    let best = list[0]!;
    let bestScore = -1e9;
    for (const r of list) {
      const head = r.group.replace(/（[^）]+）\s*$/, "").trim().toLowerCase();
      const headToks = head.split(/[/｜|、；;]/).map((s) => s.trim()).filter(Boolean);
      const key = creditBrandKey(r.group);
      const loc = key.includes("·") ? key.slice(key.lastIndexOf("·") + 1) : "";
      const brands = (r.brands || "").toLowerCase();
      let score = 0;
      // 本地品牌名（Easycash）命中分国卡标题
      if (headToks.some((t) => t === needle || t.startsWith(needle))) score += 120;
      else if (head.includes(needle) && stemLc && !stemLc.includes(needle)) score += 80;
      // 家族名命中集团主档标题（洋钱罐·CN）
      if (stemLc && (stemLc === needle || stemLc.includes(needle) || needle.includes(stemLc))) {
        if (headToks.some((t) => t.includes(stemLc))) score += 70;
        if (loc === "CN" || loc === "出海") score += 25;
      }
      if (brands.includes(needle)) score += 8;
      if ((r.countries || "").split(/[;；、,/]/).filter((s) => s.trim()).length >= 2) score += 12;
      score -= keywordRelevanceRank(q, r.group, r.brands, r.controller, r.note) * 15;
      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    }
    return best;
  };

  const out: CreditRow[] = [];
  for (const stem of order) {
    const list = buckets.get(stem)!;
    out.push(list.length === 1 ? list[0]! : pick(list, stem));
  }
  return out.sort(
    (a, b) =>
      keywordRelevanceRank(q, a.group, a.brands, a.controller, a.note) -
      keywordRelevanceRank(q, b.group, b.brands, b.controller, b.note),
  );
}

const ecoInstitutionSeeds: CreditDraft[] = [
  // —— 流量服务商·流量平台（核心平台 + 现金贷广告政策见 TRAFFIC_CORE_POLICY） ——
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Google｜Google Ads｜Alphabet（流量服务商·流量平台·US）",
    brands: "Google Ads / YouTube",
    countries: "全球（含非洲/坦桑等主要市场广告投放；当地可用性以 Google Ads 支持国为准）",
    languages: "多语",
    licenses: "广告/搜索平台；金融产品认证",
    timing: "持续",
    regulators: "广告政策自管；执法对照 CFPB/FTC 等",
    traffic: "https://ads.google.com/",
    volume: "—",
    users: "广告主",
    diandian: "公开广告政策",
    note: "流量平台·现金贷：2016 起禁美加英等 payday loan（年利率≥36%等），后扩国。合规个贷需 Google 金融认证。Partner Directory 可查，无现金贷核心代理公开名单。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["流量平台"],
    verify: "仅流量",
    licenseReg: "平台广告政策（非放贷牌）；https://support.google.com/adspolicy/answer/2464994",
    trafficRank: "B端投放",
    equity: "NASDAQ: GOOGL",
    controller: "Alphabet",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Meta｜Facebook｜Meta（流量服务商·流量平台·US）",
    brands: "Facebook / Instagram Ads",
    countries: "全球（含非洲/坦桑等主要市场广告投放；当地可用性以 Meta 广告支持国为准）",
    languages: "多语",
    licenses: "广告平台（非放贷）；金融广告预审",
    timing: "持续",
    regulators: "广告政策自管；执法对照 CFPB/FTC 等",
    traffic: "https://www.facebook.com/business",
    volume: "—",
    users: "广告主",
    diandian: "公开广告政策",
    note: "流量平台·现金贷：禁止 payday/title/pawn；贷款广告须披露 APR。无公开现金贷核心代理名单。Partner 目录：Meta Business Partners。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["流量平台"],
    verify: "仅流量",
    licenseReg: "平台广告政策（非放贷牌）；政策页见详情「流量服务政策」",
    trafficRank: "B端投放",
    equity: "NASDAQ: META",
    controller: "Meta Platforms",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "ByteDance｜TikTok｜字节跳动（流量服务商·流量平台·全球）",
    brands: "TikTok / 抖音广告",
    countries: "全球（含非洲等已开放市场；当地可用性以 TikTok Ads 支持国为准）",
    languages: "多语",
    licenses: "广告平台（非放贷）；金融服务行业准入",
    timing: "持续",
    regulators: "广告政策自管；当地金融监管另计",
    traffic: "https://www.tiktok.com/business",
    volume: "—",
    users: "广告主",
    diandian: "公开广告政策",
    note: "流量平台·现金贷：全球禁止 payday loan；持牌合规金融产品分区开放。Marketing Partners 可查，无现金贷专项代理名单。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["流量平台"],
    verify: "仅流量",
    licenseReg: "平台广告政策（非放贷牌）；政策页见详情「流量服务政策」",
    trafficRank: "B端投放",
    controller: "ByteDance",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Apple｜App Store／ASA｜Apple（流量服务商·流量平台·US）",
    brands: "App Store / Apple Search Ads",
    countries: "全球（App Store / ASA 覆盖主要市场；含非洲多国商店可用性）",
    languages: "多语",
    licenses: "应用商店/ASA；金融 App 审核",
    timing: "持续",
    regulators: "商店审核自管；当地金融监管另计",
    traffic: "https://ads.apple.com/",
    volume: "—",
    users: "开发者/广告主",
    diandian: "公开审核指南",
    note: "流量平台·现金贷：禁止掠夺性贷款应用；金融 App 审核严格。ASA Partners 可查，无现金贷专项代理名单。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["流量平台"],
    verify: "仅流量",
    licenseReg: "App Store Review Guidelines（金融/借贷条款）",
    trafficRank: "商店生态",
    equity: "NASDAQ: AAPL",
    controller: "Apple Inc.",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Snap｜Snapchat Ads｜Snap（流量服务商·流量平台·US）",
    brands: "Snapchat Ads",
    countries: "美国、加拿大、英国、欧盟、澳大利亚等（重点美欧；非洲覆盖有限）",
    languages: "多语",
    licenses: "广告平台（非放贷）",
    timing: "持续",
    regulators: "广告政策自管",
    traffic: "https://forbusiness.snapchat.com/",
    volume: "—",
    users: "广告主",
    diandian: "公开广告政策",
    note: "流量平台·现金贷：禁止 payday loan（口径近似 Meta）。无现金贷核心代理公开名单。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["流量平台"],
    verify: "仅流量",
    licenseReg: "平台广告政策（非放贷牌）",
    trafficRank: "B端投放",
    equity: "NYSE: SNAP",
    controller: "Snap Inc.",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "X｜Twitter Ads｜X Corp（流量服务商·流量平台·US）",
    brands: "X Ads / Twitter Ads",
    countries: "全球（主要市场广告投放；当地可用性以 X Ads 支持国为准）",
    languages: "多语",
    licenses: "广告平台（非放贷）",
    timing: "持续",
    regulators: "广告政策自管（政策多次修订）",
    traffic: "https://business.x.com/",
    volume: "—",
    users: "广告主",
    diandian: "公开广告政策",
    note: "流量平台·现金贷：限制高风险金融产品广告；政策多次变动。无现金贷核心代理公开名单。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["流量平台"],
    verify: "仅流量",
    licenseReg: "平台广告政策（非放贷牌）",
    trafficRank: "B端投放",
    controller: "X Corp.",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "LinkedIn｜LinkedIn Ads｜Microsoft（流量服务商·流量平台·US）",
    brands: "LinkedIn Ads",
    countries: "全球（主要市场 B2B 广告；当地可用性以 LinkedIn Ads 支持国为准）",
    languages: "多语",
    licenses: "广告平台（非放贷）",
    timing: "持续",
    regulators: "广告政策自管",
    traffic: "https://business.linkedin.com/marketing-solutions",
    volume: "—",
    users: "B2B 广告主",
    diandian: "公开广告政策",
    note: "流量平台·现金贷：禁止 payday loan；B2B 定位不适配现金贷 C 端获客。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["流量平台"],
    verify: "仅流量",
    licenseReg: "平台广告政策（非放贷牌）",
    trafficRank: "B端投放",
    equity: "NASDAQ: MSFT（Microsoft）",
    controller: "Microsoft / LinkedIn",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Taboola｜Taboola｜Taboola（流量服务商·流量平台·US）",
    brands: "Taboola",
    countries: "全球（内容推荐网络主要市场；含部分非洲媒体库存）",
    languages: "多语",
    licenses: "内容推荐/原生广告网络",
    timing: "持续",
    regulators: "广告审核自管",
    traffic: "原生推荐位",
    volume: "—",
    users: "广告主/媒体",
    diandian: "公开信息",
    note: "内容推荐网络；历史上曾有现金贷广告主使用，2020 年后审核趋严。非「核心代理」口径。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["流量平台"],
    verify: "仅流量",
    licenseReg: "平台审核政策（非放贷牌）",
    trafficRank: "B端投放",
    controller: "Taboola",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Outbrain｜Outbrain｜Outbrain（流量服务商·流量平台·US）",
    brands: "Outbrain",
    countries: "全球（内容推荐网络主要市场）",
    languages: "多语",
    licenses: "内容推荐/原生广告网络",
    timing: "持续",
    regulators: "广告审核自管",
    traffic: "原生推荐位",
    volume: "—",
    users: "广告主/媒体",
    diandian: "公开信息",
    note: "内容推荐网络；现金贷类投放审核趋严。非现金贷核心代理名单。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["流量平台"],
    verify: "仅流量",
    licenseReg: "平台审核政策（非放贷牌）",
    trafficRank: "B端投放",
    controller: "Outbrain",
  },
  // —— 流量服务商·代理商（平台授权 Reseller/Agency Partner；≠现金贷掮客） ——
  // 信源优先：STANDARD_TRAFFIC_SOURCES 官方 Partner 目录；资质动态，以目录最新为准
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "蓝色光标｜BlueFocus｜蓝色光标（流量服务商·代理商·CN）",
    brands: "蓝色光标 BlueFocus",
    countries: "中国大陆",
    languages: "中文",
    licenses: "Meta/Google/TikTok 等授权营销代理（公开合作叙事）",
    timing: "2012 起 Meta 合作叙事；A股上市",
    regulators: "—",
    traffic: "https://www.facebook.com/business/partners",
    volume: "—",
    users: "广告主",
    diandian: "官方 Partner 目录 + 招股/年报对照",
    note: "授权代理：区域销售/开户/投放服务。同时覆盖 Meta/Google/TikTok 等（公开叙事）。≠现金贷流量掮客；金融客户投放仍须平台审核。信源：Meta Partners、公司披露。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "双端通过",
    licenseReg: "授权代理资质以各平台 Partner 目录动态核验",
    trafficRank: "B端代理",
    equity: "SZ: 300058",
    controller: "蓝色光标",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "飞书深诺｜Meetsocial｜飞书深诺（流量服务商·代理商·CN）",
    brands: "飞书深诺 Meetsocial",
    countries: "中国大陆、港澳台及出海",
    languages: "中文/英语",
    licenses: "出海数字营销；Meta/Google/TikTok 授权代理叙事",
    timing: "2022 港股上市叙事",
    regulators: "—",
    traffic: "https://www.tiktok.com/business/en-US/solutions/tiktok-marketing-partners",
    volume: "—",
    users: "出海广告主",
    diandian: "招股书 + Marketing Partners 对照",
    note: "授权代理/出海营销。招股书披露含金融科技客户，强调持牌机构与合规贷款产品。≠现金贷掮客。信源：港股招股书、TikTok/Meta Partners。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "双端通过",
    licenseReg: "授权代理；金融广告仍受平台与当地监管约束",
    trafficRank: "B端代理·出海",
    equity: "HKEX 路径（以披露为准）",
    controller: "飞书深诺",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "YinoLink｜易诺｜YinoLink（流量服务商·代理商·CN）",
    brands: "YinoLink 易诺",
    countries: "中国大陆",
    languages: "中文",
    licenses: "Meta 等数字营销代理（中小客户）",
    timing: "运营中",
    regulators: "—",
    traffic: "https://www.facebook.com/business/partners",
    volume: "—",
    users: "中小广告主",
    diandian: "Partner 目录/行业公开对照",
    note: "授权代理对照；中小客户为主。≠现金贷专项代理。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "授权代理资质以 Partner 目录为准",
    trafficRank: "B端代理",
    controller: "YinoLink",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "华扬联众｜Hylink｜华扬联众（流量服务商·代理商·CN）",
    brands: "华扬联众 Hylink",
    countries: "中国",
    languages: "中文",
    licenses: "Google 等长期合作数字营销代理",
    timing: "A股上市口径",
    regulators: "—",
    traffic: "https://www.google.com/partners/agency-search/",
    volume: "—",
    users: "广告主",
    diandian: "年报 + Google Partners 对照",
    note: "授权代理；Google 长期合作公开叙事。≠现金贷掮客。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "授权代理资质以 Partner 目录为准",
    trafficRank: "B端代理",
    controller: "华扬联众",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "省广集团｜GIMC｜省广集团（流量服务商·代理商·CN）",
    brands: "省广集团 GIMC",
    countries: "中国",
    languages: "中文",
    licenses: "4A/媒介代理；Google 等合作叙事",
    timing: "上市口径",
    regulators: "—",
    traffic: "https://www.google.com/partners/agency-search/",
    volume: "—",
    users: "广告主",
    diandian: "公开披露对照",
    note: "老牌 4A/媒介代理对照。≠现金贷专项渠道。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "授权/媒介代理",
    trafficRank: "B端代理",
    controller: "省广集团",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "Nativex｜汇量｜Mobvista（流量服务商·代理商·CN）",
    brands: "Nativex / Mobvista",
    countries: "中国/出海",
    languages: "中文/英语",
    licenses: "TikTok/出海效果广告代理叙事；ASA 亦见",
    timing: "运营中",
    regulators: "—",
    traffic: "https://www.tiktok.com/business/en-US/solutions/tiktok-marketing-partners",
    volume: "—",
    users: "游戏/工具出海广告主",
    diandian: "Marketing Partners / 公开报道",
    note: "授权/效果广告代理；工具游戏出海背景。≠现金贷掮客。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "授权代理资质以 Partner 目录为准",
    trafficRank: "B端代理·出海",
    controller: "Mobvista / Nativex",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "卧兔网络｜Wotokol｜卧兔（流量服务商·代理商·CN）",
    brands: "卧兔网络 Wotokol",
    countries: "中国",
    languages: "中文",
    licenses: "TikTok KOL+效果广告代理叙事",
    timing: "运营中",
    regulators: "—",
    traffic: "https://www.tiktok.com/business/en-US/solutions/tiktok-marketing-partners",
    volume: "—",
    users: "广告主",
    diandian: "行业公开对照",
    note: "TikTok 相关授权/服务代理对照。≠现金贷专项代理。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "授权代理资质以 Partner 目录为准",
    trafficRank: "B端代理",
    controller: "卧兔网络",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "猎豹移动｜Cheetah Mobile｜猎豹移动（流量服务商·代理商·CN）",
    brands: "猎豹移动 Cheetah Mobile",
    countries: "中国大陆、海外（近年收缩）",
    languages: "中文/英语",
    licenses: "Meta 等数字营销代理叙事；工具类出海背景",
    timing: "近年业务收缩口径",
    regulators: "—",
    traffic: "https://www.facebook.com/business/partners",
    volume: "—",
    users: "广告主",
    diandian: "公开报道/年报对照",
    note: "授权代理历史对照；工具出海背景，近年收缩。≠现金贷专项代理。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "授权代理资质以 Partner 目录动态核验",
    trafficRank: "B端代理",
    controller: "猎豹移动",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "木瓜移动｜Papaya Mobile｜木瓜移动（流量服务商·代理商·CN）",
    brands: "木瓜移动 Papaya Mobile",
    countries: "中国大陆",
    languages: "中文",
    licenses: "跨境电商/游戏出海数字营销代理叙事",
    timing: "科创板申报后撤回等公开叙事",
    regulators: "—",
    traffic: "https://www.facebook.com/business/partners",
    volume: "—",
    users: "出海广告主",
    diandian: "公开披露对照",
    note: "授权代理对照；跨境电商/游戏出海为主。≠现金贷掮客。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "授权代理资质以 Partner 目录为准",
    trafficRank: "B端代理",
    controller: "木瓜移动",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "ADA｜Axiata Digital Advertising｜ADA（流量服务商·代理商·SEA）",
    brands: "ADA",
    countries: "马来西亚、印尼、泰国等",
    languages: "英语/本地语",
    licenses: "Meta 等授权数字营销；Axiata 集团背景",
    timing: "运营中",
    regulators: "—",
    traffic: "https://www.facebook.com/business/partners",
    volume: "—",
    users: "广告主",
    diandian: "Partner 目录 + 集团披露",
    note: "东南亚头部数字营销集团对照；授权代理/区域销售。≠现金贷掮客。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "授权代理资质以 Partner 目录为准",
    trafficRank: "B端代理·SEA",
    controller: "Axiata / ADA",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "AnyMind Group｜AnyMind｜AnyMind（流量服务商·代理商·SEA）",
    brands: "AnyMind Group",
    countries: "东南亚多国、日本、印度等",
    languages: "英语/日语",
    licenses: "Meta/TikTok 等营销与创作者商业化代理叙事",
    timing: "2021 合并扩张叙事",
    regulators: "—",
    traffic: "https://www.facebook.com/business/partners",
    volume: "—",
    users: "广告主/创作者",
    diandian: "公开披露 + Partners 对照",
    note: "区域授权营销服务；亦扩展 TikTok。≠现金贷专项渠道。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "授权代理资质以 Partner 目录为准",
    trafficRank: "B端代理·SEA",
    controller: "AnyMind Group",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "腰部",
    group: "Gushcloud｜Gushcloud｜Gushcloud（流量服务商·代理商·SEA）",
    brands: "Gushcloud",
    countries: "新加坡、马来西亚、印尼、越南等",
    languages: "英语",
    licenses: "KOL+效果广告；Meta/TikTok 服务叙事",
    timing: "运营中",
    regulators: "—",
    traffic: "https://www.tiktok.com/business/en-US/solutions/tiktok-marketing-partners",
    volume: "—",
    users: "广告主",
    diandian: "行业公开对照",
    note: "SEA 创作者/效果营销代理对照。≠现金贷掮客。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "授权/服务代理",
    trafficRank: "B端代理·SEA",
    controller: "Gushcloud",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "腰部",
    group: "Reprise Digital｜IPG｜Reprise（流量服务商·代理商·SEA）",
    brands: "Reprise Digital (IPG)",
    countries: "东南亚区域",
    languages: "英语",
    licenses: "4A 体系；Meta/Google 等媒介与效果",
    timing: "运营中",
    regulators: "—",
    traffic: "https://www.facebook.com/business/partners",
    volume: "—",
    users: "品牌广告主",
    diandian: "4A 公开网络",
    note: "IPG 旗下 4A 区域代理对照。≠现金贷专项渠道。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "4A/授权媒介代理",
    trafficRank: "B端代理·SEA",
    controller: "IPG / Reprise",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "腰部",
    group: "Xaxis｜WPP｜Xaxis（流量服务商·代理商·APAC）",
    brands: "Xaxis (WPP)",
    countries: "亚太区",
    languages: "英语",
    licenses: "程序化购买为主；WPP 网络",
    timing: "运营中",
    regulators: "—",
    traffic: "https://www.google.com/partners/agency-search/",
    volume: "—",
    users: "品牌广告主",
    diandian: "4A 公开网络",
    note: "WPP 旗下程序化代理对照。≠现金贷掮客。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "4A/程序化代理",
    trafficRank: "B端代理·APAC",
    controller: "WPP / Xaxis",
  },
  {
    region: "south-asia",
    line: "agent",
    tier: "腰部",
    group: "Social Beat｜Social Beat｜Social Beat（流量服务商·代理商·IN）",
    brands: "Social Beat",
    countries: "印度",
    languages: "英语",
    licenses: "本土数字营销；Meta 等合作叙事",
    timing: "运营中",
    regulators: "—",
    traffic: "https://www.facebook.com/business/partners",
    volume: "—",
    users: "广告主",
    diandian: "行业公开对照",
    note: "印度本土头部数字代理对照。≠现金贷专项代理。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "授权代理资质以 Partner 目录为准",
    trafficRank: "B端代理·IN",
    controller: "Social Beat",
  },
  {
    region: "south-asia",
    line: "agent",
    tier: "腰部",
    group: "WATConsult｜Dentsu｜WATConsult（流量服务商·代理商·IN）",
    brands: "WATConsult (Dentsu)",
    countries: "印度",
    languages: "英语",
    licenses: "4A 体系；数字营销",
    timing: "运营中",
    regulators: "—",
    traffic: "https://www.facebook.com/business/partners",
    volume: "—",
    users: "广告主",
    diandian: "4A 公开网络",
    note: "Dentsu 印度数字代理对照。≠现金贷专项代理。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "4A/授权代理",
    trafficRank: "B端代理·IN",
    controller: "Dentsu / WATConsult",
  },
  {
    region: "south-asia",
    line: "agent",
    tier: "腰部",
    group: "Schbang｜Schbang｜Schbang（流量服务商·代理商·IN）",
    brands: "Schbang",
    countries: "印度",
    languages: "英语",
    licenses: "独立数字代理；增长较快公开叙事",
    timing: "运营中",
    regulators: "—",
    traffic: "https://www.facebook.com/business/partners",
    volume: "—",
    users: "广告主",
    diandian: "行业公开对照",
    note: "印度独立代理对照。≠现金贷掮客。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "授权/数字代理",
    trafficRank: "B端代理·IN",
    controller: "Schbang",
  },
  {
    region: "latam",
    line: "agent",
    tier: "头部",
    group: "Aleph Group｜Aleph｜Aleph（流量服务商·代理商·新兴市场）",
    brands: "Aleph Group",
    countries: "拉美、中东、非洲及部分东南亚等（公开叙事覆盖多国）",
    languages: "西/英/阿等",
    licenses: "Meta 新兴市场核心 Reseller 叙事；亦覆盖 TikTok 等",
    timing: "2022 IPO 尝试未果等公开报道",
    regulators: "—",
    traffic: "https://www.facebook.com/business/partners",
    volume: "—",
    users: "广告主",
    diandian: "Partner 目录 + 公开报道",
    note: "新兴市场授权销售代理集团对照（公开称覆盖多区域）。角色=平台接入与销售服务；≠现金贷流量掮客；金融投放仍须平台审核。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "授权 Reseller/Agency；以 Meta/TikTok Partners 动态核验",
    trafficRank: "B端代理·新兴市场",
    controller: "Aleph Group",
  },
  {
    region: "latam",
    line: "agent",
    tier: "腰部",
    group: "Vivabox｜Vivabox｜Vivabox（流量服务商·代理商·BR）",
    brands: "Vivabox",
    countries: "巴西",
    languages: "葡/英",
    licenses: "Meta 等区域数字营销代理叙事",
    timing: "运营中",
    regulators: "—",
    traffic: "https://www.facebook.com/business/partners",
    volume: "—",
    users: "广告主",
    diandian: "行业公开对照",
    note: "巴西区域授权代理对照。≠现金贷专项渠道。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "授权代理资质以 Partner 目录为准",
    trafficRank: "B端代理·BR",
    controller: "Vivabox",
  },
  {
    region: "latam",
    line: "agent",
    tier: "腰部",
    group: "Zed｜Zed｜Zed（流量服务商·代理商·MX）",
    brands: "Zed",
    countries: "墨西哥、中美洲",
    languages: "西/英",
    licenses: "Meta 等区域数字营销代理叙事",
    timing: "运营中",
    regulators: "—",
    traffic: "https://www.facebook.com/business/partners",
    volume: "—",
    users: "广告主",
    diandian: "行业公开对照",
    note: "墨西哥/中美洲授权代理对照。≠现金贷掮客。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "授权代理资质以 Partner 目录为准",
    trafficRank: "B端代理·MX",
    controller: "Zed",
  },
  {
    region: "mena",
    line: "agent",
    tier: "腰部",
    group: "Connect Ads｜Connect Ads｜Connect Ads（流量服务商·代理商·EG）",
    brands: "Connect Ads",
    countries: "埃及、中东",
    languages: "阿/英",
    licenses: "Meta 等区域数字营销代理叙事",
    timing: "运营中",
    regulators: "—",
    traffic: "https://www.facebook.com/business/partners",
    volume: "—",
    users: "广告主",
    diandian: "行业公开对照",
    note: "中东区域授权代理对照。≠现金贷掮客。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "授权代理资质以 Partner 目录为准",
    trafficRank: "B端代理·MENA",
    controller: "Connect Ads",
  },
  {
    region: "mena",
    line: "agent",
    tier: "腰部",
    group: "The Online Project｜TOP｜The Online Project（流量服务商·代理商·海湾）",
    brands: "The Online Project",
    countries: "科威特/迪拜及海湾国家",
    languages: "阿/英",
    licenses: "Meta 等海湾数字营销代理叙事",
    timing: "运营中",
    regulators: "—",
    traffic: "https://www.facebook.com/business/partners",
    volume: "—",
    users: "广告主",
    diandian: "行业公开对照",
    note: "海湾国家授权代理对照。≠现金贷专项代理。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "授权代理资质以 Partner 目录为准",
    trafficRank: "B端代理·海湾",
    controller: "The Online Project",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Havas Media｜Havas｜Havas Media（流量服务商·代理商·EU）",
    brands: "Havas Media",
    countries: "欧洲多国",
    languages: "多语",
    licenses: "全球 4A；Meta/Google 等媒介",
    timing: "持续",
    regulators: "—",
    traffic: "https://www.facebook.com/business/partners",
    volume: "—",
    users: "品牌广告主",
    diandian: "4A 公开网络",
    note: "欧洲 4A 媒介网络对照。≠现金贷专项渠道。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "4A/媒介代理",
    trafficRank: "B端·欧洲网络",
    controller: "Havas",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Dentsu｜Dentsu Aegis｜Dentsu（流量服务商·代理商·EU）",
    brands: "Dentsu / Dentsu Aegis",
    countries: "欧洲及全球",
    languages: "多语",
    licenses: "全球 4A；Google/Meta 等",
    timing: "持续",
    regulators: "—",
    traffic: "https://www.google.com/partners/agency-search/",
    volume: "—",
    users: "品牌广告主",
    diandian: "4A 公开网络",
    note: "全球 4A 网络对照（含 iProspect 等品牌）。≠现金贷掮客。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "4A/媒介代理",
    trafficRank: "B端·全球网络",
    controller: "Dentsu",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Smartly.io｜Smartly｜Smartly（流量服务商·代理商·EU）",
    brands: "Smartly.io",
    countries: "全球（欧总部）",
    languages: "英语",
    licenses: "Meta Creative/技术向官方合作伙伴叙事",
    timing: "运营中",
    regulators: "—",
    traffic: "https://www.facebook.com/business/partners",
    volume: "—",
    users: "广告主",
    diandian: "Marketing Partners 对照",
    note: "技术导向 Meta 官方合作伙伴对照；自动化投放。≠现金贷渠道。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "官方 Creative/技术 Partner",
    trafficRank: "B端技术代理",
    controller: "Smartly.io",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "GroupM｜WPP｜GroupM（流量服务商·代理商·全球）",
    brands: "GroupM (WPP)",
    countries: "全球多国办公室",
    languages: "多语",
    licenses: "全球 4A；Google/Meta 等媒介采购",
    timing: "持续",
    regulators: "—",
    traffic: "https://www.google.com/partners/agency-search/",
    volume: "—",
    users: "品牌广告主",
    diandian: "4A 公开网络",
    note: "全球媒介集团对照；各国办公室同时服务 Google/Meta 等。≠现金贷专项代理。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "4A/媒介代理",
    trafficRank: "B端·全球网络",
    controller: "WPP / GroupM",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Meta Business Partners｜目录入口｜Meta Partners（流量服务商·代理商·全球）",
    brands: "Meta Business Partners",
    countries: "全球",
    languages: "多语",
    licenses: "官方授权代理/技术伙伴目录（标准信源）",
    timing: "持续更新",
    regulators: "—",
    traffic: "https://www.facebook.com/business/partners",
    volume: "—",
    users: "广告主选型",
    diandian: "标准可采信源",
    note: "标准信源入口：核验 Reseller/Agency/技术伙伴。不按现金贷分类；金融开户仍须广告审核。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "官方 Partner 目录（动态）",
    trafficRank: "B端目录",
    controller: "Meta Platforms",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Google Partner Directory｜认证代理｜Google Partners（流量服务商·代理商·全球）",
    brands: "Google Partners（目录入口）",
    countries: "全球",
    languages: "多语",
    licenses: "官方 Partner/Reseller 目录（标准信源）",
    timing: "持续更新",
    regulators: "—",
    traffic: "https://www.google.com/partners/agency-search/",
    volume: "—",
    users: "广告主选型",
    diandian: "标准可采信源",
    note: "标准信源入口：Premier Partner/Reseller 等动态资质。不按现金贷垂直披露。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "Google Partner 认证（动态）",
    trafficRank: "B端目录",
    controller: "Alphabet / Google Partners",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "TikTok Marketing Partners｜目录入口｜TikTok Partners（流量服务商·代理商·全球）",
    brands: "TikTok Marketing Partners",
    countries: "全球",
    languages: "多语",
    licenses: "官方 Marketing Partners 目录（标准信源）",
    timing: "持续更新",
    regulators: "—",
    traffic: "https://www.tiktok.com/business/en-US/solutions/tiktok-marketing-partners",
    volume: "—",
    users: "广告主选型",
    diandian: "标准可采信源",
    note: "标准信源入口；与 TikTok Shop Partner 体系部分重叠。≠现金贷专项名单。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "TikTok Marketing Partners（动态）",
    trafficRank: "B端目录",
    controller: "ByteDance / TikTok",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Apple Search Ads Partners｜目录入口｜ASA Partners（流量服务商·代理商·全球）",
    brands: "Apple Search Ads Partners",
    countries: "全球",
    languages: "多语",
    licenses: "官方 ASA Partners 目录（标准信源）",
    timing: "持续更新",
    regulators: "—",
    traffic: "https://searchads.apple.com/help/partners/",
    volume: "—",
    users: "开发者/广告主选型",
    diandian: "标准可采信源",
    note: "标准信源入口；代理体系相对封闭。金融 App 仍须过商店审核与广告政策。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "Apple Search Ads Partners（动态）",
    trafficRank: "B端目录",
    controller: "Apple",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "SplitMetrics｜SearchAds.com｜SplitMetrics（流量服务商·代理商·ASA）",
    brands: "SearchAds.com / SplitMetrics",
    countries: "全球",
    languages: "英语",
    licenses: "Apple Search Ads Partners；技术工具导向",
    timing: "运营中",
    regulators: "—",
    traffic: "https://searchads.apple.com/help/partners/",
    volume: "—",
    users: "开发者/增长团队",
    diandian: "ASA Partners 对照",
    note: "ASA 授权/技术伙伴对照；工具导向。≠现金贷渠道。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "Apple Search Ads Partners",
    trafficRank: "B端·ASA",
    controller: "SplitMetrics",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Mobile Action｜MobileAction｜Mobile Action（流量服务商·代理商·ASA）",
    brands: "Mobile Action",
    countries: "全球",
    languages: "英语",
    licenses: "ASA Partners；ASO+ASA 结合",
    timing: "运营中",
    regulators: "—",
    traffic: "https://searchads.apple.com/help/partners/",
    volume: "—",
    users: "开发者/增长团队",
    diandian: "ASA Partners 对照",
    note: "ASA 授权伙伴对照；ASO+ASA。≠现金贷掮客。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "Apple Search Ads Partners",
    trafficRank: "B端·ASA",
    controller: "Mobile Action",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Luna｜ironSource｜Unity（流量服务商·代理商·ASA）",
    brands: "Luna (ironSource / Unity)",
    countries: "全球",
    languages: "英语",
    licenses: "ASA Partners；游戏行业为主",
    timing: "运营中",
    regulators: "—",
    traffic: "https://searchads.apple.com/help/partners/",
    volume: "—",
    users: "游戏开发者",
    diandian: "ASA Partners 对照",
    note: "ASA 游戏向授权伙伴对照。≠现金贷专项代理。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "Apple Search Ads Partners",
    trafficRank: "B端·ASA·游戏",
    controller: "Unity / ironSource",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Tinuiti｜Tinuiti｜Tinuiti（流量服务商·代理商·US）",
    brands: "Tinuiti",
    countries: "美国/欧洲",
    languages: "英语",
    licenses: "独立效果代理；DTC/TikTok 等服务叙事",
    timing: "运营中",
    regulators: "—",
    traffic: "https://www.tiktok.com/business/en-US/solutions/tiktok-marketing-partners",
    volume: "—",
    users: "DTC 品牌",
    diandian: "行业公开对照",
    note: "美欧独立效果代理对照（含 TikTok/付费媒体）。≠现金贷专项名单。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理商"],
    verify: "仅流量",
    licenseReg: "授权/效果代理",
    trafficRank: "B端代理·US",
    controller: "Tinuiti",
  },
  // —— 流量服务商·代理运营 ——
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "点点数据｜点点｜点点数据（流量服务商·代理运营·CN）",
    brands: "点点数据",
    countries: "中国/出海监测",
    languages: "中文",
    licenses: "数据监测/情报（非放贷）",
    timing: "运营中",
    regulators: "—",
    traffic: "榜单/ASO监测订阅",
    volume: "—",
    users: "投放/产品团队",
    diandian: "公开信息",
    note: "代理运营对照；非广告投放位本身。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理运营"],
    verify: "仅流量",
    licenseReg: "数据服务",
    trafficRank: "B端工具",
    controller: "点点数据",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "七麦数据｜七麦｜七麦（流量服务商·代理运营·CN）",
    brands: "七麦数据",
    countries: "中国",
    languages: "中文",
    licenses: "ASO/ASA与应用市场监测",
    timing: "运营中",
    regulators: "—",
    traffic: "监测订阅",
    volume: "—",
    users: "投放/增长团队",
    diandian: "公开信息",
    note: "代理运营对照",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理运营"],
    verify: "仅流量",
    licenseReg: "数据服务",
    trafficRank: "B端工具",
    controller: "七麦",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "AppsFlyer｜AppsFlyer｜AppsFlyer（流量服务商·代理运营·全球）",
    brands: "AppsFlyer",
    countries: "全球",
    languages: "英语",
    licenses: "MMP 监测归因；部分 ASA 优化服务",
    timing: "运营中",
    regulators: "—",
    traffic: "归因/监测 SaaS",
    volume: "—",
    users: "投放/增长团队",
    diandian: "公开产品",
    note: "MMP 监测服务方；可协助 ASA 等优化，本身非广告销售代理。≠现金贷渠道。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理运营"],
    verify: "仅流量",
    licenseReg: "SaaS 监测",
    trafficRank: "B端工具",
    controller: "AppsFlyer",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Adjust｜Adjust｜AppLovin（流量服务商·代理运营·全球）",
    brands: "Adjust",
    countries: "全球",
    languages: "英语",
    licenses: "MMP 监测归因",
    timing: "运营中",
    regulators: "—",
    traffic: "归因/监测 SaaS",
    volume: "—",
    users: "投放/增长团队",
    diandian: "公开产品",
    note: "MMP 监测服务方。≠广告 Reseller，≠现金贷掮客。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["代理运营"],
    verify: "仅流量",
    licenseReg: "SaaS 监测",
    trafficRank: "B端工具",
    controller: "AppLovin / Adjust",
  },
  // —— 流量服务商·贷超（比价/导流；与授权代理分列） ——
  {
    region: "se-asia",
    line: "agent",
    tier: "腰部",
    group: "Cermati｜Cermati｜Cermati（流量服务商·贷超·ID）",
    brands: "Cermati",
    countries: "印尼",
    languages: "印尼语",
    licenses: "线上贷超/比价导流；印尼经营贷超APP常需持牌路径",
    timing: "运营中",
    regulators: "OJK等",
    traffic: "贷超App导流",
    volume: "—",
    users: "C端借款人",
    diandian: "公开信息",
    note: "贷超对照：印尼线上贷超常需持牌。Lead gen/导流合规见 OJK 等监管详情。与平台授权广告代理分列。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["贷超"],
    verify: "仅监管",
    licenseReg: "ID：贷超/中介相关持牌路径待核",
    trafficRank: "贷超App",
    controller: "Cermati",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "LendingTree｜LendingTree｜LendingTree（流量服务商·贷超·US）",
    brands: "LendingTree",
    countries: "美国",
    languages: "英语",
    licenses: "贷款比价/导流（非 payday 主叙事）",
    timing: "上市运营",
    regulators: "CFPB/州级等",
    traffic: "比价站导流",
    volume: "—",
    users: "C端借款人",
    diandian: "公开信息",
    note: "贷款聚合/比价导流对照；受消费者金融保护与广告合规约束。与 Meta/Google 授权广告代理分列。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["贷超"],
    verify: "仅监管",
    licenseReg: "US：导流/中介合规路径（对照 CFPB）",
    trafficRank: "贷超Web",
    equity: "NASDAQ: TREE",
    controller: "LendingTree",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Credit Karma｜Credit Karma｜Intuit（流量服务商·贷超·US）",
    brands: "Credit Karma",
    countries: "美国等",
    languages: "英语",
    licenses: "信用报告+贷款推荐导流",
    timing: "运营中",
    regulators: "CFPB/FTC 等",
    traffic: "信用账户内推荐",
    volume: "—",
    users: "C端",
    diandian: "公开信息",
    note: "信用评分+产品推荐导流对照；金融产品推荐须符合消费者保护与广告披露。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["贷超"],
    verify: "仅监管",
    licenseReg: "US：导流/推荐合规（对照）",
    trafficRank: "信用账户",
    controller: "Intuit / Credit Karma",
  },
  // —— 流量服务商·贷超（线下中介/居间对照） ——
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "线下贷款经纪人｜门店中介｜线下渠道（流量服务商·贷超·CN）",
    brands: "线下门店/经纪人渠道（对照）",
    countries: "中国等",
    languages: "中文",
    licenses: "线下居间/导流（非线上贷超）",
    timing: "常见",
    regulators: "地方金融办等",
    traffic: "门店/地推/经纪人",
    volume: "—",
    users: "C端",
    diandian: "公开业态",
    note: "线下中介对照样本；SMS/外呼等触达另见触达服务机构及 TCPA 等监管口径。",
    institutionTypes: ["流量服务商"],
    trafficKinds: ["贷超"],
    verify: "待双端",
    licenseReg: "线下居间",
    trafficRank: "线下",
    controller: "待核实（渠道主体多样）",
  },
  // —— 监管（公开对照；主要市场多主体）——
  // CN
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "中国人民银行｜人行｜PBOC（监管·CN）",
    brands: "中国人民银行",
    countries: "中国",
    languages: "中文",
    licenses: "中央银行/宏观审慎与支付清算主管（对照）",
    timing: "持续",
    regulators: "国务院金融委等",
    traffic: "https://www.pbc.gov.cn/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "央行；官网可核支付机构等名录入口",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "CN：中央银行体系（对照用，非放贷牌）",
    trafficRank: "无商店榜口径",
    controller: "中国人民银行",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "国家金融监督管理总局｜金管总局｜NFRA（监管·CN）",
    brands: "国家金融监督管理总局",
    countries: "中国",
    languages: "中文",
    licenses: "银行保险等行业监管（原银保监路径）",
    timing: "持续",
    regulators: "金管总局",
    traffic: "https://www.nfra.gov.cn/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: `${REGULATORY_DIRECTORY_SOURCES.nfraBankCorp}；金融许可证查询 https://xkz.nfra.gov.cn/。现金贷：2017 年起清理整顿；无牌禁止放贷；广告/导流须对接持牌机构。`,
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg:
      "CN：银行业/保险业准入与持续监管；公开《银行业金融机构法人名单》；现金贷整顿与持牌经营要求",
    trafficRank: "无商店榜口径",
    controller: "国家金融监督管理总局",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "中国互联网金融协会｜互金协会｜NIFA（监管·CN）",
    brands: "中国互联网金融协会",
    countries: "中国",
    languages: "中文",
    licenses: "行业自律（对照）",
    timing: "持续",
    regulators: "人行指导",
    traffic: "https://www.nifa.org.cn/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "行业协会",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "CN：互金协会自律",
    trafficRank: "无商店榜口径",
    controller: "中国互联网金融协会",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "国家市场监督管理总局｜市监总局｜SAMR（监管·CN）",
    brands: "国家市场监督管理总局",
    countries: "中国",
    languages: "中文",
    licenses: "反垄断/市场监管（对照）",
    timing: "持续",
    regulators: "SAMR",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "反垄断",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "CN：反垄断执法",
    trafficRank: "无商店榜口径",
    controller: "国家市场监督管理总局",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "国家税务总局｜税总｜STA（监管·CN）",
    brands: "国家税务总局",
    countries: "中国",
    languages: "中文",
    licenses: "税务主管（对照）",
    timing: "持续",
    regulators: "STA",
    traffic: "税务官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "税务",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "CN：税务登记/征管对照",
    trafficRank: "无商店榜口径",
    controller: "国家税务总局",
  },
  // ID
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "Bank Indonesia｜BI｜印尼央行（监管·ID）",
    brands: "Bank Indonesia",
    countries: "印度尼西亚",
    languages: "印尼语/英语",
    licenses: "中央银行/支付清算（对照）",
    timing: "持续",
    regulators: "BI",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "央行",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "ID：Bank Indonesia",
    trafficRank: "无商店榜口径",
    controller: "Bank Indonesia",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "Otoritas Jasa Keuangan｜OJK｜金监局（监管·ID）",
    brands: "Otoritas Jasa Keuangan",
    countries: "印度尼西亚",
    languages: "印尼语/英语",
    licenses: "印尼金监局（P2P/多金融等名录主管）",
    timing: "持续",
    regulators: "OJK",
    traffic: "https://www.ojk.go.id/id/kanal/iknb/data-dan-statistik/direktori/fintech/default.aspx",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: `${REGULATORY_DIRECTORY_SOURCES.ojkLpbbti}；官网可交叉导入下场玩家。现金贷：须持牌；非法网贷名单与下架；贷超/导流亦受持牌与广告合规约束。`,
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "ID：OJK LPBBTI/Multifinance 等名录主管；违规现金贷 App 禁令",
    trafficRank: "无商店榜口径",
    controller: "OJK",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "Asosiasi Fintech Pendanaan Bersama Indonesia｜AFPI｜印尼P2P协会（监管·ID）",
    brands: "AFPI",
    countries: "印度尼西亚",
    languages: "印尼语/英语",
    licenses: "P2P/金融科技行业自律（对照）",
    timing: "持续",
    regulators: "OJK相关",
    traffic: "协会官网/会员名录",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "行业协会",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "ID：AFPI 自律",
    trafficRank: "无商店榜口径",
    controller: "AFPI",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "Komisi Pengawas Persaingan Usaha｜KPPU｜印尼反垄断委员会（监管·ID）",
    brands: "KPPU",
    countries: "印度尼西亚",
    languages: "印尼语/英语",
    licenses: "竞争/反垄断（对照）",
    timing: "持续",
    regulators: "KPPU",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "反垄断",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "ID：KPPU",
    trafficRank: "无商店榜口径",
    controller: "KPPU",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "Direktorat Jenderal Pajak｜DGT｜印尼税总局（监管·ID）",
    brands: "DJP / DGT",
    countries: "印度尼西亚",
    languages: "印尼语/英语",
    licenses: "税务主管（对照）",
    timing: "持续",
    regulators: "DGT",
    traffic: "税务官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "税务",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "ID：DGT/DJP",
    trafficRank: "无商店榜口径",
    controller: "Direktorat Jenderal Pajak",
  },
  // IN
  {
    region: "south-asia",
    line: "agent",
    tier: "头部",
    group: "Reserve Bank of India｜RBI｜印度央行（监管·IN）",
    brands: "Reserve Bank of India",
    countries: "印度",
    languages: "英语/印地语",
    licenses: "印度央行（NBFC CoR 等）",
    timing: "持续",
    regulators: "RBI",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "央行；NBFC CoR 名录。现金贷：严格牌照；多次推动下架违规数字放贷 App；导流/广告须对接持牌主体。",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "IN：RBI NBFC 等名录；数字放贷与广告导流合规",
    trafficRank: "无商店榜口径",
    controller: "RBI",
  },
  {
    region: "south-asia",
    line: "agent",
    tier: "头部",
    group: "Digital Lenders Association of India｜DLAI｜印度数字放贷协会（监管·IN）",
    brands: "DLAI",
    countries: "印度",
    languages: "英语",
    licenses: "数字借贷行业自律（对照）",
    timing: "持续",
    regulators: "RBI相关框架",
    traffic: "协会官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "行业协会",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "IN：DLAI 自律",
    trafficRank: "无商店榜口径",
    controller: "DLAI",
  },
  {
    region: "south-asia",
    line: "agent",
    tier: "头部",
    group: "Competition Commission of India｜CCI｜印度竞争委员会（监管·IN）",
    brands: "CCI",
    countries: "印度",
    languages: "英语",
    licenses: "竞争/反垄断（对照）",
    timing: "持续",
    regulators: "CCI",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "反垄断",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "IN：CCI",
    trafficRank: "无商店榜口径",
    controller: "CCI",
  },
  {
    region: "south-asia",
    line: "agent",
    tier: "头部",
    group: "Central Board of Direct Taxes｜CBDT｜印度中央直接税局（监管·IN）",
    brands: "CBDT / Income Tax",
    countries: "印度",
    languages: "英语",
    licenses: "直接税主管（对照）",
    timing: "持续",
    regulators: "CBDT",
    traffic: "税务官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "税务",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "IN：CBDT/Income Tax",
    trafficRank: "无商店榜口径",
    controller: "CBDT",
  },
  // PH
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "Bangko Sentral ng Pilipinas｜BSP｜菲律宾央行（监管·PH）",
    brands: "BSP",
    countries: "菲律宾",
    languages: "英语/菲律宾语",
    licenses: "中央银行/支付与银行监管；数字银行牌照（对照 PDIC 投保数字银行目录 6 家）",
    timing: "持续",
    regulators: "BSP",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: REGULATORY_DIRECTORY_SOURCES.pdicDigibank,
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "PH：BSP 数字银行/EMI/银行监管；持牌数字银行见 PDIC Directory of Insured Digital Banks",
    trafficRank: "无商店榜口径",
    controller: "BSP",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "Securities and Exchange Commission｜SEC｜菲律宾证监会（监管·PH）",
    brands: "SEC Philippines",
    countries: "菲律宾",
    languages: "英语",
    licenses: "Lending/Financing/OLP 等名录主管",
    timing: "持续",
    regulators: "SEC",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "行业监管",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "PH：SEC OLP/Lending",
    trafficRank: "无商店榜口径",
    controller: "SEC Philippines",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "Chamber of Fintech Philippines｜CFP｜菲金融科技商会（监管·PH）",
    brands: "Chamber of Fintech Philippines",
    countries: "菲律宾",
    languages: "英语",
    licenses: "金融科技行业自律（对照）",
    timing: "持续",
    regulators: "SEC/BSP相关",
    traffic: "协会官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "行业协会",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "PH：Fintech 商会自律",
    trafficRank: "无商店榜口径",
    controller: "Chamber of Fintech Philippines",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "Philippine Competition Commission｜PCC｜菲竞争委员会（监管·PH）",
    brands: "PCC",
    countries: "菲律宾",
    languages: "英语",
    licenses: "竞争/反垄断（对照）",
    timing: "持续",
    regulators: "PCC",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "反垄断",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "PH：PCC",
    trafficRank: "无商店榜口径",
    controller: "PCC",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "Bureau of Internal Revenue｜BIR｜菲国税局（监管·PH）",
    brands: "BIR",
    countries: "菲律宾",
    languages: "英语",
    licenses: "税务主管（对照）",
    timing: "持续",
    regulators: "BIR",
    traffic: "税务官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "税务",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "PH：BIR",
    trafficRank: "无商店榜口径",
    controller: "BIR",
  },
  // MX
  {
    region: "latam",
    line: "agent",
    tier: "头部",
    group: "Banco de México｜Banxico｜墨西哥央行（监管·MX）",
    brands: "Banxico",
    countries: "墨西哥",
    languages: "西班牙语",
    licenses: "中央银行（对照）",
    timing: "持续",
    regulators: "Banxico",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "央行",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "MX：Banxico",
    trafficRank: "无商店榜口径",
    controller: "Banco de México",
  },
  {
    region: "latam",
    line: "agent",
    tier: "头部",
    group: "Comisión Nacional Bancaria y de Valores｜CNBV｜墨银监（监管·MX）",
    brands: "CNBV",
    countries: "墨西哥",
    languages: "西班牙语",
    licenses: "银行/SOFOM 等监管对照",
    timing: "持续",
    regulators: "CNBV",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "行业监管",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "MX：CNBV/SIPRES 等",
    trafficRank: "无商店榜口径",
    controller: "CNBV",
  },
  {
    region: "latam",
    line: "agent",
    tier: "头部",
    group: "CONDUSEF｜Condusef｜墨金融用户保护（监管·MX）",
    brands: "CONDUSEF",
    countries: "墨西哥",
    languages: "西班牙语",
    licenses: "金融消费者保护（对照）",
    timing: "持续",
    regulators: "CONDUSEF",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "行业监管/消保",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "MX：CONDUSEF",
    trafficRank: "无商店榜口径",
    controller: "CONDUSEF",
  },
  {
    region: "latam",
    line: "agent",
    tier: "头部",
    group: "Comisión Federal de Competencia Económica｜COFECE｜墨竞争委员会（监管·MX）",
    brands: "COFECE",
    countries: "墨西哥",
    languages: "西班牙语",
    licenses: "竞争/反垄断（对照）",
    timing: "持续",
    regulators: "COFECE",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "反垄断",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "MX：COFECE",
    trafficRank: "无商店榜口径",
    controller: "COFECE",
  },
  {
    region: "latam",
    line: "agent",
    tier: "头部",
    group: "Servicio de Administración Tributaria｜SAT｜墨税务局（监管·MX）",
    brands: "SAT",
    countries: "墨西哥",
    languages: "西班牙语",
    licenses: "税务主管（对照）",
    timing: "持续",
    regulators: "SAT",
    traffic: "税务官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "税务",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "MX：SAT",
    trafficRank: "无商店榜口径",
    controller: "SAT",
  },
  // PK
  {
    region: "south-asia",
    line: "agent",
    tier: "头部",
    group: "State Bank of Pakistan｜SBP｜巴基斯坦央行（监管·PK）",
    brands: "SBP",
    countries: "巴基斯坦",
    languages: "英语/乌尔都语",
    licenses: "中央银行（对照）",
    timing: "持续",
    regulators: "SBP",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "央行",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "PK：SBP",
    trafficRank: "无商店榜口径",
    controller: "SBP",
  },
  {
    region: "south-asia",
    line: "agent",
    tier: "头部",
    group: "Securities and Exchange Commission of Pakistan｜SECP｜巴证监（监管·PK）",
    brands: "SECP",
    countries: "巴基斯坦",
    languages: "英语",
    licenses: "Lending NBFC 等名录主管",
    timing: "持续",
    regulators: "SECP",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "行业监管",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "PK：SECP Lending NBFC",
    trafficRank: "无商店榜口径",
    controller: "SECP",
  },
  {
    region: "south-asia",
    line: "agent",
    tier: "腰部",
    group: "Pakistan Fintech Association｜PFA｜巴金融科技协会（监管·PK）",
    brands: "Pakistan Fintech Association",
    countries: "巴基斯坦",
    languages: "英语",
    licenses: "金融科技行业自律（对照）",
    timing: "持续",
    regulators: "SECP/SBP相关",
    traffic: "协会官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "行业协会",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "PK：Fintech 协会自律",
    trafficRank: "无商店榜口径",
    controller: "Pakistan Fintech Association",
  },
  {
    region: "south-asia",
    line: "agent",
    tier: "头部",
    group: "Competition Commission of Pakistan｜CCP｜巴竞争委员会（监管·PK）",
    brands: "CCP",
    countries: "巴基斯坦",
    languages: "英语",
    licenses: "竞争/反垄断（对照）",
    timing: "持续",
    regulators: "CCP",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "反垄断",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "PK：CCP",
    trafficRank: "无商店榜口径",
    controller: "CCP",
  },
  {
    region: "south-asia",
    line: "agent",
    tier: "头部",
    group: "Federal Board of Revenue｜FBR｜巴联邦税收委员会（监管·PK）",
    brands: "FBR",
    countries: "巴基斯坦",
    languages: "英语",
    licenses: "税务主管（对照）",
    timing: "持续",
    regulators: "FBR",
    traffic: "税务官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "税务",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "PK：FBR",
    trafficRank: "无商店榜口径",
    controller: "FBR",
  },
  // VN
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "State Bank of Vietnam｜SBV｜越南央行（监管·VN）",
    brands: "SBV",
    countries: "越南",
    languages: "越南语/英语",
    licenses: "中央银行/金融公司监管（对照）",
    timing: "持续",
    regulators: "SBV",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "央行",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "VN：SBV",
    trafficRank: "无商店榜口径",
    controller: "SBV",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "腰部",
    group: "Vietnam Banks Association｜VNBA｜越南银行协会（监管·VN）",
    brands: "VNBA",
    countries: "越南",
    languages: "越南语/英语",
    licenses: "银行业自律（对照）",
    timing: "持续",
    regulators: "SBV相关",
    traffic: "协会官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "行业协会",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "VN：VNBA 自律",
    trafficRank: "无商店榜口径",
    controller: "VNBA",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "Vietnam Competition Commission｜VCC｜越南竞争委员会（监管·VN）",
    brands: "VCC",
    countries: "越南",
    languages: "越南语/英语",
    licenses: "竞争/反垄断（对照）",
    timing: "持续",
    regulators: "VCC",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "反垄断",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "VN：VCC",
    trafficRank: "无商店榜口径",
    controller: "VCC",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "General Department of Taxation｜GDT｜越南税总局（监管·VN）",
    brands: "GDT",
    countries: "越南",
    languages: "越南语/英语",
    licenses: "税务主管（对照）",
    timing: "持续",
    regulators: "GDT",
    traffic: "税务官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "税务",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "VN：GDT",
    trafficRank: "无商店榜口径",
    controller: "GDT",
  },
  // MY
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "Bank Negara Malaysia｜BNM｜马来西亚央行（监管·MY）",
    brands: "BNM",
    countries: "马来西亚",
    languages: "马来语/英语",
    licenses: "中央银行（对照）",
    timing: "持续",
    regulators: "BNM",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "央行",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "MY：BNM",
    trafficRank: "无商店榜口径",
    controller: "BNM",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "Securities Commission Malaysia｜SC｜马证监会（监管·MY）",
    brands: "SC Malaysia",
    countries: "马来西亚",
    languages: "英语/马来语",
    licenses: "资本市场/部分金融科技路径（对照）",
    timing: "持续",
    regulators: "SC",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "行业监管",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "MY：SC",
    trafficRank: "无商店榜口径",
    controller: "Securities Commission Malaysia",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "腰部",
    group: "Fintech Association of Malaysia｜FAOM｜马金融科技协会（监管·MY）",
    brands: "FAOM",
    countries: "马来西亚",
    languages: "英语",
    licenses: "金融科技行业自律（对照）",
    timing: "持续",
    regulators: "BNM/SC相关",
    traffic: "协会官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "行业协会",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "MY：FAOM 自律",
    trafficRank: "无商店榜口径",
    controller: "FAOM",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "Malaysia Competition Commission｜MyCC｜马竞争委员会（监管·MY）",
    brands: "MyCC",
    countries: "马来西亚",
    languages: "英语/马来语",
    licenses: "竞争/反垄断（对照）",
    timing: "持续",
    regulators: "MyCC",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "反垄断",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "MY：MyCC",
    trafficRank: "无商店榜口径",
    controller: "MyCC",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "Lembaga Hasil Dalam Negeri｜LHDN｜马内陆税收局（监管·MY）",
    brands: "LHDN / IRB",
    countries: "马来西亚",
    languages: "马来语/英语",
    licenses: "税务主管（对照）",
    timing: "持续",
    regulators: "LHDN",
    traffic: "税务官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "税务",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "MY：LHDN",
    trafficRank: "无商店榜口径",
    controller: "LHDN",
  },
  // TH
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "Bank of Thailand｜BOT｜泰国央行（监管·TH）",
    brands: "BOT",
    countries: "泰国",
    languages: "泰语/英语",
    licenses: "中央银行/P-Loan Nano 等（对照）",
    timing: "持续",
    regulators: "BOT",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "央行",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "TH：BOT",
    trafficRank: "无商店榜口径",
    controller: "BOT",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "Securities and Exchange Commission Thailand｜SEC｜泰证监会（监管·TH）",
    brands: "SEC Thailand",
    countries: "泰国",
    languages: "泰语/英语",
    licenses: "资本市场监管（对照）",
    timing: "持续",
    regulators: "SEC",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "行业监管",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "TH：SEC",
    trafficRank: "无商店榜口径",
    controller: "SEC Thailand",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "腰部",
    group: "Thai Fintech Association｜TFA｜泰金融科技协会（监管·TH）",
    brands: "Thai Fintech Association",
    countries: "泰国",
    languages: "泰语/英语",
    licenses: "金融科技行业自律（对照）",
    timing: "持续",
    regulators: "BOT相关",
    traffic: "协会官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "行业协会",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "TH：TFA 自律",
    trafficRank: "无商店榜口径",
    controller: "Thai Fintech Association",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "Trade Competition Commission of Thailand｜TCCT｜泰贸易竞争委员会（监管·TH）",
    brands: "TCCT",
    countries: "泰国",
    languages: "泰语/英语",
    licenses: "竞争/反垄断（对照）",
    timing: "持续",
    regulators: "TCCT",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "反垄断",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "TH：TCCT",
    trafficRank: "无商店榜口径",
    controller: "TCCT",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "The Revenue Department｜RD｜泰税务局（监管·TH）",
    brands: "Revenue Department",
    countries: "泰国",
    languages: "泰语/英语",
    licenses: "税务主管（对照）",
    timing: "持续",
    regulators: "RD",
    traffic: "税务官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "税务",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "TH：Revenue Department",
    trafficRank: "无商店榜口径",
    controller: "The Revenue Department",
  },
  // BR
  {
    region: "latam",
    line: "agent",
    tier: "头部",
    group: "Banco Central do Brasil｜BCB｜巴西央行（监管·BR）",
    brands: "BCB",
    countries: "巴西",
    languages: "葡萄牙语",
    licenses: "中央银行/金融科技监管（对照）",
    timing: "持续",
    regulators: "BCB",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "央行",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "BR：BCB",
    trafficRank: "无商店榜口径",
    controller: "BCB",
  },
  {
    region: "latam",
    line: "agent",
    tier: "头部",
    group: "Comissão de Valores Mobiliários｜CVM｜巴西证监会（监管·BR）",
    brands: "CVM",
    countries: "巴西",
    languages: "葡萄牙语",
    licenses: "资本市场监管（对照）",
    timing: "持续",
    regulators: "CVM",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "行业监管",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "BR：CVM",
    trafficRank: "无商店榜口径",
    controller: "CVM",
  },
  {
    region: "latam",
    line: "agent",
    tier: "腰部",
    group: "ABFintechs｜ABFintechs｜巴西金融科技协会（监管·BR）",
    brands: "ABFintechs",
    countries: "巴西",
    languages: "葡萄牙语",
    licenses: "金融科技行业自律（对照）",
    timing: "持续",
    regulators: "BCB相关",
    traffic: "协会官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "行业协会",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "BR：ABFintechs 自律",
    trafficRank: "无商店榜口径",
    controller: "ABFintechs",
  },
  {
    region: "latam",
    line: "agent",
    tier: "头部",
    group: "Conselho Administrativo de Defesa Econômica｜CADE｜巴西行政经济保护委员会（监管·BR）",
    brands: "CADE",
    countries: "巴西",
    languages: "葡萄牙语",
    licenses: "竞争/反垄断（对照）",
    timing: "持续",
    regulators: "CADE",
    traffic: "监管官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "反垄断",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "BR：CADE",
    trafficRank: "无商店榜口径",
    controller: "CADE",
  },
  {
    region: "latam",
    line: "agent",
    tier: "头部",
    group: "Receita Federal do Brasil｜RFB｜巴西联邦税务局（监管·BR）",
    brands: "Receita Federal",
    countries: "巴西",
    languages: "葡萄牙语",
    licenses: "税务主管（对照）",
    timing: "持续",
    regulators: "RFB",
    traffic: "税务官网",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "税务",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "BR：Receita Federal",
    trafficRank: "无商店榜口径",
    controller: "Receita Federal",
  },
  // 欧美对照样本
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Financial Conduct Authority｜FCA｜英国金融行为监管局（监管·GB）",
    brands: "FCA",
    countries: "英国",
    languages: "英语",
    licenses: "行为监管对照样本",
    timing: "持续",
    regulators: "FCA",
    traffic: "https://www.fca.org.uk/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "高成本短贷利率上限（2015 起，公开口径含日利率上限约 0.8%/天等）；行业出清后持续行为监管与金融广告披露要求。Register 可核持牌主体。",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "UK：FCA；高成本短贷利率上限与广告行为监管",
    trafficRank: "无商店榜口径",
    controller: "FCA",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "中国证券监督管理委员会｜证监会｜CSRC（监管·CN）",
    brands: "中国证监会",
    countries: "中国",
    languages: "中文",
    licenses: "证券期货监管（对照）",
    timing: "持续",
    regulators: "CSRC",
    traffic: "https://www.csrc.gov.cn/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "证券监管；官网可核名录/公告",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "CN：证监会",
    trafficRank: "无商店榜口径",
    controller: "中国证监会",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "Monetary Authority of Singapore｜MAS｜新加坡金管局（监管·SG）",
    brands: "MAS",
    countries: "新加坡",
    languages: "英语",
    licenses: "综合金融监管（对照）",
    timing: "持续",
    regulators: "MAS",
    traffic: "https://www.mas.gov.sg/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "持牌金融机构名录见 MAS Financial Institutions Directory",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "SG：MAS",
    trafficRank: "无商店榜口径",
    controller: "MAS",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "Hong Kong Monetary Authority｜HKMA｜香港金管局（监管·HK）",
    brands: "HKMA",
    countries: "中国香港",
    languages: "中/英",
    licenses: "银行/支付等监管（对照）",
    timing: "持续",
    regulators: "HKMA",
    traffic: "https://www.hkma.gov.hk/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "官网可查认可机构名录",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "HK：HKMA",
    trafficRank: "无商店榜口径",
    controller: "HKMA",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "Financial Services Agency｜FSA｜日本金融厅（监管·JP）",
    brands: "FSA Japan",
    countries: "日本",
    languages: "日/英",
    licenses: "金融厅监管（对照）",
    timing: "持续",
    regulators: "FSA",
    traffic: "https://www.fsa.go.jp/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "官网可查牌照/注册金融业者",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "JP：FSA",
    trafficRank: "无商店榜口径",
    controller: "FSA",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "Financial Supervisory Service｜FSS｜韩国金融监督院（监管·KR）",
    brands: "FSS",
    countries: "韩国",
    languages: "韩/英",
    licenses: "金融监督（对照）",
    timing: "持续",
    regulators: "FSS",
    traffic: "https://www.fss.or.kr/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "官网可查金融公司注册信息",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "KR：FSS",
    trafficRank: "无商店榜口径",
    controller: "FSS",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Consumer Financial Protection Bureau｜CFPB｜美国消费者金融保护局（监管·US）",
    brands: "CFPB",
    countries: "美国",
    languages: "英语",
    licenses: "消费者金融保护/投诉库（对照）",
    timing: "持续",
    regulators: "CFPB",
    traffic: "https://www.consumerfinance.gov/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "Consumer Complaint Database / 公司检索。现金贷监管：payday loan 消费者保护与执法；部分州禁止或严限；与 FTC 协同打击欺诈获客；Military Lending Act 等利率上限（公开口径常引 36% APR）。",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "US：CFPB；payday loan / 高成本短贷消费者保护规则与投诉库",
    trafficRank: "无商店榜口径",
    controller: "CFPB",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Federal Trade Commission｜FTC｜美国联邦贸易委员会（监管·US）",
    brands: "FTC",
    countries: "美国",
    languages: "英语",
    licenses: "反欺诈/虚假广告/Lead gen 执法（对照）",
    timing: "持续",
    regulators: "FTC",
    traffic: "https://www.ftc.gov/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "现金贷相关：欺骗性 lead generation、虚假贷款广告执法；金融广告不得误导 APR/费用/资格。",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "US：FTC；虚假获客与金融广告欺诈执法",
    trafficRank: "无商店榜口径",
    controller: "FTC",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Federal Reserve｜Fed｜美联储（监管·US）",
    brands: "Federal Reserve",
    countries: "美国",
    languages: "英语",
    licenses: "央行/银行控股监管（对照）",
    timing: "持续",
    regulators: "Fed",
    traffic: "https://www.federalreserve.gov/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "官网可查监管公告与银行结构",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "US：Fed",
    trafficRank: "无商店榜口径",
    controller: "Federal Reserve",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Office of the Comptroller of the Currency｜OCC｜美国货币监理署（监管·US）",
    brands: "OCC",
    countries: "美国",
    languages: "英语",
    licenses: "国民银行牌照监管（对照）",
    timing: "持续",
    regulators: "OCC",
    traffic: "https://www.occ.gov/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "Institution Search",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "US：OCC",
    trafficRank: "无商店榜口径",
    controller: "OCC",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Securities and Exchange Commission｜SEC｜美国证监会（监管·US）",
    brands: "SEC US",
    countries: "美国",
    languages: "英语",
    licenses: "证券监管/EDGAR（对照）",
    timing: "持续",
    regulators: "SEC",
    traffic: "https://www.sec.gov/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "EDGAR 披露检索；上市公司主体交叉",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "US：SEC",
    trafficRank: "无商店榜口径",
    controller: "SEC",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Bundesanstalt für Finanzdienstleistungsaufsicht｜BaFin｜德国金监局（监管·DE）",
    brands: "BaFin",
    countries: "德国",
    languages: "德/英",
    licenses: "金融监管（对照）",
    timing: "持续",
    regulators: "BaFin",
    traffic: "https://www.bafin.de/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "Company database / 牌照查询",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "DE：BaFin",
    trafficRank: "无商店榜口径",
    controller: "BaFin",
  },
  {
    region: "mena",
    line: "agent",
    tier: "头部",
    group: "Saudi Central Bank｜SAMA｜沙特央行（监管·SA）",
    brands: "SAMA",
    countries: "沙特",
    languages: "阿/英",
    licenses: "央行/金融公司监管（对照）",
    timing: "持续",
    regulators: "SAMA",
    traffic: "https://www.sama.gov.sa/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "金融科技/金融公司许可名录",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "SA：SAMA",
    trafficRank: "无商店榜口径",
    controller: "SAMA",
  },
  {
    region: "africa",
    line: "agent",
    tier: "头部",
    group: "Financial Sector Conduct Authority｜FSCA｜南非金融行业行为监管局（监管·ZA）",
    brands: "FSCA",
    countries: "南非",
    languages: "英语",
    licenses: "行为监管（对照）",
    timing: "持续",
    regulators: "FSCA",
    traffic: "https://www.fsca.co.za/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "FSPs 名录检索",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "ZA：FSCA",
    trafficRank: "无商店榜口径",
    controller: "FSCA",
  },
  {
    region: "south-asia",
    line: "agent",
    tier: "头部",
    group: "Central Bank of Sri Lanka｜CBSL｜斯里兰卡央行（监管·LK）",
    brands: "CBSL",
    countries: "斯里兰卡",
    languages: "英/僧",
    licenses: "LFC 等非银监管（对照）",
    timing: "持续",
    regulators: "CBSL",
    traffic: "https://www.cbsl.gov.lk/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "Licensed Finance Companies 名录",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "LK：CBSL LFC",
    trafficRank: "无商店榜口径",
    controller: "CBSL",
  },
  {
    region: "south-asia",
    line: "agent",
    tier: "头部",
    group: "Bangladesh Bank｜BB｜孟加拉央行（监管·BD）",
    brands: "Bangladesh Bank",
    countries: "孟加拉",
    languages: "英/孟",
    licenses: "NBFI 等监管（对照）",
    timing: "持续",
    regulators: "BB",
    traffic: "https://www.bb.org.bd/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "NBFI 名录",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "BD：BB NBFI",
    trafficRank: "无商店榜口径",
    controller: "Bangladesh Bank",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Australian Securities and Investments Commission｜ASIC｜澳证监（监管·AU）",
    brands: "ASIC",
    countries: "澳大利亚",
    languages: "英语",
    licenses: "公司/金融服务牌照（对照）",
    timing: "持续",
    regulators: "ASIC",
    traffic: "https://asic.gov.au/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "Professional registers / AFSL",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "AU：ASIC",
    trafficRank: "无商店榜口径",
    controller: "ASIC",
  },
  // —— 监管扩充：空白市场央行/金监/证监/协会对照 ——
  // TW
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "Financial Supervisory Commission｜FSC｜台湾金管会（监管·TW）",
    brands: "FSC Taiwan",
    countries: "中国台湾",
    languages: "中文/英语",
    licenses: "银行保险证券期货等综合监管（对照）",
    timing: "持续",
    regulators: "FSC",
    traffic: "https://www.fsc.gov.tw/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照；电子支付/银行名录可交叉",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "TW：FSC",
    trafficRank: "无商店榜口径",
    controller: "金融监督管理委员会",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "Central Bank of the Republic of China｜CBC｜台湾央行（监管·TW）",
    brands: "CBC",
    countries: "中国台湾",
    languages: "中文/英语",
    licenses: "央行/支付清算（对照）",
    timing: "持续",
    regulators: "CBC",
    traffic: "https://www.cbc.gov.tw/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "TW：CBC",
    trafficRank: "无商店榜口径",
    controller: "中央银行",
  },
  // CN 补档
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "国家外汇管理局｜外管局｜SAFE（监管·CN）",
    brands: "SAFE",
    countries: "中国",
    languages: "中文",
    licenses: "外汇/跨境资金（对照）",
    timing: "持续",
    regulators: "SAFE",
    traffic: "https://www.safe.gov.cn/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "跨境支付/外汇合规对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "CN：SAFE",
    trafficRank: "无商店榜口径",
    controller: "国家外汇管理局",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "中国支付清算协会｜支付清算协会｜PCAC（监管·CN）",
    brands: "PCAC",
    countries: "中国",
    languages: "中文",
    licenses: "支付清算行业自律（对照）",
    timing: "持续",
    regulators: "人行指导",
    traffic: "https://www.pcac.org.cn/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "支付机构自律对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "CN：支付清算协会",
    trafficRank: "无商店榜口径",
    controller: "中国支付清算协会",
  },
  // HK / JP / KR 补档
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "Securities and Futures Commission｜SFC｜香港证监会（监管·HK）",
    brands: "SFC",
    countries: "中国香港",
    languages: "中/英",
    licenses: "证券期货牌照（对照）",
    timing: "持续",
    regulators: "SFC",
    traffic: "https://www.sfc.hk/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "持牌人公众登记册",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "HK：SFC",
    trafficRank: "无商店榜口径",
    controller: "SFC",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "Bank of Japan｜BOJ｜日本银行（监管·JP）",
    brands: "BOJ",
    countries: "日本",
    languages: "日/英",
    licenses: "央行（对照）",
    timing: "持续",
    regulators: "BOJ",
    traffic: "https://www.boj.or.jp/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "JP：BOJ",
    trafficRank: "无商店榜口径",
    controller: "日本银行",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "Financial Services Commission｜FSC｜韩国金融服务委员会（监管·KR）",
    brands: "FSC Korea",
    countries: "韩国",
    languages: "韩/英",
    licenses: "金融政策与立法（对照）",
    timing: "持续",
    regulators: "FSC",
    traffic: "https://www.fsc.go.kr/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "与 FSS 分工：政策 vs 检查执行",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "KR：FSC",
    trafficRank: "无商店榜口径",
    controller: "FSC",
  },
  // SG 补档
  {
    region: "se-asia",
    line: "agent",
    tier: "腰部",
    group: "Singapore FinTech Association｜SFA｜新加坡金融科技协会（监管·SG）",
    brands: "SFA",
    countries: "新加坡",
    languages: "英语",
    licenses: "行业自律（对照）",
    timing: "持续",
    regulators: "MAS相关生态",
    traffic: "https://singaporefintech.org/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "行业协会对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "SG：FinTech协会",
    trafficRank: "无商店榜口径",
    controller: "Singapore FinTech Association",
  },
  // IN 补档
  {
    region: "south-asia",
    line: "agent",
    tier: "头部",
    group: "Securities and Exchange Board of India｜SEBI｜印度证监会（监管·IN）",
    brands: "SEBI",
    countries: "印度",
    languages: "英语",
    licenses: "证券市场监管（对照）",
    timing: "持续",
    regulators: "SEBI",
    traffic: "https://www.sebi.gov.in/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开登记与通告",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "IN：SEBI",
    trafficRank: "无商店榜口径",
    controller: "SEBI",
  },
  {
    region: "south-asia",
    line: "agent",
    tier: "腰部",
    group: "National Housing Bank｜NHB｜印度国家住房银行（监管·IN）",
    brands: "NHB",
    countries: "印度",
    languages: "英语",
    licenses: "住房金融公司监管（对照）",
    timing: "持续",
    regulators: "NHB",
    traffic: "https://nhb.org.in/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "HFC 名录对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "IN：NHB",
    trafficRank: "无商店榜口径",
    controller: "NHB",
  },
  // VN / PH / TH 补档
  {
    region: "se-asia",
    line: "agent",
    tier: "腰部",
    group: "State Securities Commission of Vietnam｜SSC｜越南证监会（监管·VN）",
    brands: "SSC Vietnam",
    countries: "越南",
    languages: "越/英",
    licenses: "证券市场监管（对照）",
    timing: "持续",
    regulators: "SSC",
    traffic: "https://ssc.gov.vn/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "VN：SSC",
    trafficRank: "无商店榜口径",
    controller: "SSC",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "腰部",
    group: "Insurance Commission｜IC｜菲律宾保险委员会（监管·PH）",
    brands: "IC Philippines",
    countries: "菲律宾",
    languages: "英语",
    licenses: "保险业监管（对照）",
    timing: "持续",
    regulators: "IC",
    traffic: "https://www.insurance.gov.ph/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "保险公司名录对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "PH：IC",
    trafficRank: "无商店榜口径",
    controller: "Insurance Commission",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "腰部",
    group: "Office of Insurance Commission｜OIC｜泰国保险委员会办公室（监管·TH）",
    brands: "OIC Thailand",
    countries: "泰国",
    languages: "泰/英",
    licenses: "保险业监管（对照）",
    timing: "持续",
    regulators: "OIC",
    traffic: "https://www.oic.or.th/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "TH：OIC",
    trafficRank: "无商店榜口径",
    controller: "OIC",
  },
  // Central Asia
  {
    region: "central-asia",
    line: "agent",
    tier: "头部",
    group: "National Bank of Kazakhstan｜NBK｜哈萨克斯坦央行（监管·KZ）",
    brands: "NBK",
    countries: "哈萨克斯坦",
    languages: "俄/英/哈",
    licenses: "央行/支付（对照）",
    timing: "持续",
    regulators: "NBK",
    traffic: "https://www.nationalbank.kz/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "KZ：NBK",
    trafficRank: "无商店榜口径",
    controller: "NBK",
  },
  {
    region: "central-asia",
    line: "agent",
    tier: "头部",
    group: "Agency for Regulation and Development of Financial Market｜ARDFM｜哈金融监管发展署（监管·KZ）",
    brands: "ARDFM",
    countries: "哈萨克斯坦",
    languages: "俄/英/哈",
    licenses: "银行/非银金融监管（对照）",
    timing: "持续",
    regulators: "ARDFM",
    traffic: "https://www.gov.kz/memleket/entities/ardfm",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "KZ：ARDFM",
    trafficRank: "无商店榜口径",
    controller: "ARDFM",
  },
  {
    region: "central-asia",
    line: "agent",
    tier: "腰部",
    group: "Central Bank of Uzbekistan｜CBU｜乌兹别克斯坦央行（监管·UZ）",
    brands: "CBU",
    countries: "乌兹别克斯坦",
    languages: "乌/俄/英",
    licenses: "央行/银行监管（对照）",
    timing: "持续",
    regulators: "CBU",
    traffic: "https://cbu.uz/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "UZ：CBU",
    trafficRank: "无商店榜口径",
    controller: "CBU",
  },
  // LatAm 补档
  {
    region: "latam",
    line: "agent",
    tier: "头部",
    group: "Banco de la República｜Banrep｜哥伦比亚央行（监管·CO）",
    brands: "Banrep",
    countries: "哥伦比亚",
    languages: "西/英",
    licenses: "央行（对照）",
    timing: "持续",
    regulators: "Banrep",
    traffic: "https://www.banrep.gov.co/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "CO：Banrep",
    trafficRank: "无商店榜口径",
    controller: "Banrep",
  },
  {
    region: "latam",
    line: "agent",
    tier: "头部",
    group: "Superintendencia Financiera de Colombia｜SFC｜哥伦比亚金融监管局（监管·CO）",
    brands: "SFC Colombia",
    countries: "哥伦比亚",
    languages: "西/英",
    licenses: "银行/非银金融监管（对照）",
    timing: "持续",
    regulators: "SFC",
    traffic: "https://www.superfinanciera.gov.co/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "受监管实体名录",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "CO：SFC",
    trafficRank: "无商店榜口径",
    controller: "SFC",
  },
  {
    region: "latam",
    line: "agent",
    tier: "头部",
    group: "Banco Central de la República Argentina｜BCRA｜阿根廷央行（监管·AR）",
    brands: "BCRA",
    countries: "阿根廷",
    languages: "西/英",
    licenses: "央行/金融公司（对照）",
    timing: "持续",
    regulators: "BCRA",
    traffic: "https://www.bcra.gob.ar/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "AR：BCRA",
    trafficRank: "无商店榜口径",
    controller: "BCRA",
  },
  {
    region: "latam",
    line: "agent",
    tier: "腰部",
    group: "Superintendencia de Banca, Seguros y AFP｜SBS｜秘鲁银保监（监管·PE）",
    brands: "SBS Peru",
    countries: "秘鲁",
    languages: "西/英",
    licenses: "银行保险养老金监管（对照）",
    timing: "持续",
    regulators: "SBS",
    traffic: "https://www.sbs.gob.pe/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "PE：SBS",
    trafficRank: "无商店榜口径",
    controller: "SBS",
  },
  {
    region: "latam",
    line: "agent",
    tier: "腰部",
    group: "Comisión para el Mercado Financiero｜CMF｜智利金融市场委员会（监管·CL）",
    brands: "CMF Chile",
    countries: "智利",
    languages: "西/英",
    licenses: "银行证券保险综合监管（对照）",
    timing: "持续",
    regulators: "CMF",
    traffic: "https://www.cmfchile.cl/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "CL：CMF",
    trafficRank: "无商店榜口径",
    controller: "CMF",
  },
  {
    region: "latam",
    line: "agent",
    tier: "腰部",
    group: "Superintendência de Seguros Privados｜SUSEP｜巴西私保监（监管·BR）",
    brands: "SUSEP",
    countries: "巴西",
    languages: "葡/英",
    licenses: "私营保险监管（对照）",
    timing: "持续",
    regulators: "SUSEP",
    traffic: "https://www.gov.br/susep/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "BR：SUSEP",
    trafficRank: "无商店榜口径",
    controller: "SUSEP",
  },
  // MEA
  {
    region: "mena",
    line: "agent",
    tier: "头部",
    group: "Central Bank of the UAE｜CBUAE｜阿联酋央行（监管·AE）",
    brands: "CBUAE",
    countries: "阿联酋",
    languages: "阿/英",
    licenses: "央行/银行与支付（对照）",
    timing: "持续",
    regulators: "CBUAE",
    traffic: "https://www.centralbank.ae/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开许可名录对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "AE：CBUAE",
    trafficRank: "无商店榜口径",
    controller: "CBUAE",
  },
  {
    region: "mena",
    line: "agent",
    tier: "腰部",
    group: "Dubai Financial Services Authority｜DFSA｜迪拜金融服务管理局（监管·AE）",
    brands: "DFSA",
    countries: "阿联酋",
    languages: "英语",
    licenses: "DIFC 金融服务监管（对照）",
    timing: "持续",
    regulators: "DFSA",
    traffic: "https://www.dfsa.ae/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "Public Register",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "AE：DFSA",
    trafficRank: "无商店榜口径",
    controller: "DFSA",
  },
  {
    region: "africa",
    line: "agent",
    tier: "头部",
    group: "Central Bank of Egypt｜CBE｜埃及央行（监管·EG）",
    brands: "CBE",
    countries: "埃及",
    languages: "阿/英",
    licenses: "央行/银行与支付（对照）",
    timing: "持续",
    regulators: "CBE",
    traffic: "https://www.cbe.org.eg/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "EG：CBE",
    trafficRank: "无商店榜口径",
    controller: "CBE",
  },
  {
    region: "africa",
    line: "agent",
    tier: "头部",
    group: "Central Bank of Nigeria｜CBN｜尼日利亚央行（监管·NG）",
    brands: "CBN",
    countries: "尼日利亚",
    languages: "英语",
    licenses: "央行/支付与银行（对照）",
    timing: "持续",
    regulators: "CBN",
    traffic: "https://www.cbn.gov.ng/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "支付服务商/银行名录对照。现金贷：近年加强数字贷款与消费者保护；协同整治掠夺性数字贷与不当催收。",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "NG：CBN；数字贷款监管与消费者保护",
    trafficRank: "无商店榜口径",
    controller: "CBN",
  },
  {
    region: "africa",
    line: "agent",
    tier: "腰部",
    group: "Central Bank of Kenya｜CBK｜肯尼亚央行（监管·KE）",
    brands: "CBK",
    countries: "肯尼亚",
    languages: "英/斯瓦希里",
    licenses: "央行/支付与银行（对照）",
    timing: "持续",
    regulators: "CBK",
    traffic: "https://www.centralbank.go.ke/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "KE：CBK",
    trafficRank: "无商店榜口径",
    controller: "CBK",
  },
  {
    region: "africa",
    line: "agent",
    tier: "腰部",
    group: "Bank of Ghana｜BoG｜加纳央行（监管·GH）",
    brands: "BoG",
    countries: "加纳",
    languages: "英语",
    licenses: "央行/支付与银行（对照）",
    timing: "持续",
    regulators: "BoG",
    traffic: "https://www.bog.gov.gh/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "GH：BoG",
    trafficRank: "无商店榜口径",
    controller: "BoG",
  },
  {
    region: "mena",
    line: "agent",
    tier: "头部",
    group: "Banking Regulation and Supervision Agency｜BDDK｜土耳其银监局（监管·TR）",
    brands: "BDDK",
    countries: "土耳其",
    languages: "土/英",
    licenses: "银行监管（对照）",
    timing: "持续",
    regulators: "BDDK",
    traffic: "https://www.bddk.org.tr/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "TR：BDDK",
    trafficRank: "无商店榜口径",
    controller: "BDDK",
  },
  {
    region: "mena",
    line: "agent",
    tier: "腰部",
    group: "Central Bank of the Republic of Türkiye｜CBRT｜土耳其央行（监管·TR）",
    brands: "CBRT",
    countries: "土耳其",
    languages: "土/英",
    licenses: "央行/支付（对照）",
    timing: "持续",
    regulators: "CBRT",
    traffic: "https://www.tcmb.gov.tr/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "TR：CBRT",
    trafficRank: "无商店榜口径",
    controller: "CBRT",
  },
  {
    region: "africa",
    line: "agent",
    tier: "腰部",
    group: "South African Reserve Bank｜SARB｜南非储备银行（监管·ZA）",
    brands: "SARB",
    countries: "南非",
    languages: "英语",
    licenses: "央行/审慎监管（对照）",
    timing: "持续",
    regulators: "SARB",
    traffic: "https://www.resbank.co.za/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "与 FSCA 行为监管分工",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "ZA：SARB",
    trafficRank: "无商店榜口径",
    controller: "SARB",
  },
  // West / EU / NA / AU 补档
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "European Central Bank｜ECB｜欧洲央行（监管·EU）",
    brands: "ECB",
    countries: "德国",
    languages: "多语/英语",
    licenses: "欧元区银行单一监管机制（对照）",
    timing: "持续",
    regulators: "ECB",
    traffic: "https://www.ecb.europa.eu/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "SSM；国别记德国便于筛选，实际覆盖欧元区",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "EU：ECB/SSM",
    trafficRank: "无商店榜口径",
    controller: "ECB",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Prudential Regulation Authority｜PRA｜英国审慎监管局（监管·GB）",
    brands: "PRA",
    countries: "英国",
    languages: "英语",
    licenses: "银行保险审慎监管（对照）",
    timing: "持续",
    regulators: "BoE/PRA",
    traffic: "https://www.bankofengland.co.uk/prudential-regulation",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "与 FCA 分工",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "GB：PRA",
    trafficRank: "无商店榜口径",
    controller: "PRA",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Autorité de Contrôle Prudentiel et de Résolution｜ACPR｜法国审慎监管局（监管·FR）",
    brands: "ACPR",
    countries: "法国",
    languages: "法/英",
    licenses: "银行保险审慎监管（对照）",
    timing: "持续",
    regulators: "ACPR",
    traffic: "https://acpr.banque-france.fr/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开登记对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "FR：ACPR",
    trafficRank: "无商店榜口径",
    controller: "ACPR",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Autorité des Marchés Financiers｜AMF｜法国金融市场管理局（监管·FR）",
    brands: "AMF France",
    countries: "法国",
    languages: "法/英",
    licenses: "证券市场监管（对照）",
    timing: "持续",
    regulators: "AMF",
    traffic: "https://www.amf-france.org/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "FR：AMF",
    trafficRank: "无商店榜口径",
    controller: "AMF",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "De Nederlandsche Bank｜DNB｜荷兰央行（监管·NL）",
    brands: "DNB",
    countries: "荷兰",
    languages: "荷/英",
    licenses: "央行/审慎监管（对照）",
    timing: "持续",
    regulators: "DNB",
    traffic: "https://www.dnb.nl/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "NL：DNB",
    trafficRank: "无商店榜口径",
    controller: "DNB",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Autoriteit Financiële Markten｜AFM｜荷兰金融市场管理局（监管·NL）",
    brands: "AFM",
    countries: "荷兰",
    languages: "荷/英",
    licenses: "行为监管/市场（对照）",
    timing: "持续",
    regulators: "AFM",
    traffic: "https://www.afm.nl/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "NL：AFM",
    trafficRank: "无商店榜口径",
    controller: "AFM",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Banco de España｜BdE｜西班牙央行（监管·ES）",
    brands: "BdE",
    countries: "西班牙",
    languages: "西/英",
    licenses: "央行/银行监管（对照）",
    timing: "持续",
    regulators: "BdE",
    traffic: "https://www.bde.es/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "ES：BdE",
    trafficRank: "无商店榜口径",
    controller: "BdE",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Banca d'Italia｜BdI｜意大利央行（监管·IT）",
    brands: "Banca d'Italia",
    countries: "意大利",
    languages: "意/英",
    licenses: "央行/银行监管（对照）",
    timing: "持续",
    regulators: "BdI",
    traffic: "https://www.bancaditalia.it/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "IT：BdI",
    trafficRank: "无商店榜口径",
    controller: "Banca d'Italia",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Office of the Superintendent of Financial Institutions｜OSFI｜加拿大金融机构监管署（监管·CA）",
    brands: "OSFI",
    countries: "加拿大",
    languages: "英/法",
    licenses: "联邦金融机构审慎监管（对照）",
    timing: "持续",
    regulators: "OSFI",
    traffic: "https://www.osfi-bsif.gc.ca/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "CA：OSFI",
    trafficRank: "无商店榜口径",
    controller: "OSFI",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Federal Deposit Insurance Corporation｜FDIC｜美国联邦存款保险公司（监管·US）",
    brands: "FDIC",
    countries: "美国",
    languages: "英语",
    licenses: "存款保险/州银行监管（对照）",
    timing: "持续",
    regulators: "FDIC",
    traffic: "https://www.fdic.gov/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "BankFind Suite",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "US：FDIC",
    trafficRank: "无商店榜口径",
    controller: "FDIC",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Financial Crimes Enforcement Network｜FinCEN｜美国金融犯罪执法网络（监管·US）",
    brands: "FinCEN",
    countries: "美国",
    languages: "英语",
    licenses: "反洗钱/MSB 登记（对照）",
    timing: "持续",
    regulators: "FinCEN",
    traffic: "https://www.fincen.gov/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "MSB 注册检索对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "US：FinCEN",
    trafficRank: "无商店榜口径",
    controller: "FinCEN",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Australian Prudential Regulation Authority｜APRA｜澳审慎监管局（监管·AU）",
    brands: "APRA",
    countries: "澳大利亚",
    languages: "英语",
    licenses: "银行保险养老金审慎监管（对照）",
    timing: "持续",
    regulators: "APRA",
    traffic: "https://www.apra.gov.au/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "与 ASIC 分工",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "AU：APRA",
    trafficRank: "无商店榜口径",
    controller: "APRA",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Reserve Bank of Australia｜RBA｜澳大利亚储备银行（监管·AU）",
    brands: "RBA",
    countries: "澳大利亚",
    languages: "英语",
    licenses: "央行/支付系统（对照）",
    timing: "持续",
    regulators: "RBA",
    traffic: "https://www.rba.gov.au/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "AU：RBA",
    trafficRank: "无商店榜口径",
    controller: "RBA",
  },
  // —— 数据服务方 ——
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "百行征信｜百行｜百行征信（数据服务方·CN）",
    brands: "百行征信",
    countries: "中国",
    languages: "中文",
    licenses: "个人征信牌照（公开披露口径）",
    timing: "持牌运营",
    regulators: "中国人民银行",
    traffic: "B端机构接入",
    volume: "—",
    users: "机构客户",
    diandian: "监管+公开新闻",
    note: "公开信息建档·征信数据服务",
    institutionTypes: ["数据服务方"],
    verify: "仅监管",
    licenseReg: "CN：个人征信机构",
    trafficRank: "B端非C端商店榜",
    controller: "百行征信有限公司",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Experian｜Experian｜Experian（数据服务方·全球）",
    brands: "Experian / Serasa Experian",
    countries: "英国总部；美/拉美/亚太等",
    languages: "英语/多本地语",
    licenses: "征信与替代数据服务（各国牌照分拆）",
    timing: "多年；LSE 上市",
    regulators: "各国征信监管",
    traffic: "B端机构接入",
    volume: "公开上市口径",
    users: "机构/消费者查询",
    diandian: "公开信息/IR",
    note: "全球三大征信之一；拉美含 Serasa；生态角色·数据服务方",
    institutionTypes: ["数据服务方"],
    verify: "仅监管",
    licenseReg: "多国征信/信用信息",
    trafficRank: "B端",
    equity: "LSE: EXPN",
    controller: "Experian plc",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Equifax｜Equifax｜Equifax（数据服务方·全球）",
    brands: "Equifax",
    countries: "美国总部；多国",
    languages: "英语/多本地语",
    licenses: "征信与数据分析服务",
    timing: "多年；NYSE 上市",
    regulators: "各国征信监管",
    traffic: "B端",
    volume: "公开上市口径",
    users: "机构/消费者查询",
    diandian: "公开信息/IR",
    note: "全球三大征信之一；生态角色·数据服务方",
    institutionTypes: ["数据服务方"],
    verify: "仅监管",
    licenseReg: "多国征信/信用信息",
    trafficRank: "B端",
    equity: "NYSE: EFX",
    controller: "Equifax Inc.",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Dun & Bradstreet｜D&B｜DNB（数据服务方·US）",
    brands: "Dun & Bradstreet / D&B",
    countries: "美国等",
    languages: "英语",
    licenses: "企业信用与数据服务（B 端）",
    timing: "多年；NYSE 上市",
    regulators: "—",
    traffic: "B端",
    volume: "公开上市口径",
    users: "机构客户",
    diandian: "公开信息",
    note: "企业征信/商业数据；生态角色·数据服务方",
    institutionTypes: ["数据服务方"],
    verify: "仅监管",
    licenseReg: "商业数据服务（非放贷）",
    trafficRank: "B端",
    equity: "NYSE: DNB",
    controller: "Dun & Bradstreet",
  },
  {
    region: "south-asia",
    line: "agent",
    tier: "头部",
    group: "TransUnion CIBIL｜CIBIL｜TransUnion（数据服务方·IN）",
    brands: "CIBIL",
    countries: "印度",
    languages: "英语",
    licenses: "印度征信局（公开）",
    timing: "多年",
    regulators: "RBI相关框架",
    traffic: "B端",
    volume: "—",
    users: "机构/消费者查询",
    diandian: "公开信息",
    note: "公开信息建档；母公司 NYSE: TRU",
    institutionTypes: ["数据服务方"],
    verify: "仅监管",
    licenseReg: "IN：征信局",
    trafficRank: "B端",
    equity: "NYSE: TRU（母公司）",
    controller: "TransUnion CIBIL",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "腰部",
    group: "PEFINDO Biro Kredit｜PEFINDO｜PEFINDO（数据服务方·ID）",
    brands: "PEFINDO Biro Kredit",
    countries: "印尼",
    languages: "印尼语/英语",
    licenses: "印尼征信相关",
    timing: "运营中",
    regulators: "OJK相关",
    traffic: "B端",
    volume: "—",
    users: "机构",
    diandian: "公开信息",
    note: "公开信息建档；未上市本地征信",
    institutionTypes: ["数据服务方"],
    verify: "仅监管",
    licenseReg: "ID：征信/信用信息",
    trafficRank: "B端",
    controller: "PEFINDO",
  },
  // —— 支付服务机构：见 paymentServiceSeeds（官方基建 / 国民级 / 代理服务商） ——
  // —— 资金参与机构 ——
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "招商银行｜招行｜招商银行（资金参与机构·本地银行·CN）",
    brands: "招商银行",
    countries: "中国",
    languages: "中文",
    licenses: "商业银行（亦可作助贷/联合贷资金方）",
    timing: "持续",
    regulators: "国家金融监督管理总局/人行",
    traffic: "对公/零售",
    volume: "—",
    users: "—",
    diandian: "公开信息",
    note: "公开信息：本地银行资金方对照；亦关联招联发起方",
    institutionTypes: ["资金参与机构"],
    fundKinds: ["本地银行"],
    verify: "仅监管",
    licenseReg: "CN：商业银行",
    trafficRank: "银行App另计",
    controller: "招商银行",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "腰部",
    group: "Bank Jago｜Jago｜Bank Jago（资金参与机构·本地银行·ID）",
    brands: "Bank Jago",
    countries: "印尼",
    languages: "印尼语",
    licenses: "数字银行；可合作放贷资金",
    timing: "运营中",
    regulators: "OJK/BI",
    traffic: "App/合作",
    volume: "—",
    users: "—",
    diandian: "公开信息",
    note: "公开信息建档·本地银行",
    institutionTypes: ["资金参与机构"],
    fundKinds: ["本地银行"],
    verify: "仅监管",
    licenseReg: "ID：银行牌照",
    trafficRank: "银行App",
    controller: "Bank Jago",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "某银行助贷通道｜联合贷代理｜银行合作通道（资金参与机构·本地银行代理·CN）",
    brands: "银行助贷/联合贷代理通道（对照）",
    countries: "中国",
    languages: "中文",
    licenses: "银行合作通道/代理放款路径",
    timing: "常见",
    regulators: "金融监管相关",
    traffic: "B端对接",
    volume: "—",
    users: "平台/助贷方",
    diandian: "公开业态",
    note: "公开业态对照·本地银行代理（非自有吸储银行主体）",
    institutionTypes: ["资金参与机构"],
    fundKinds: ["本地银行代理"],
    verify: "待双端",
    licenseReg: "银行合作通道",
    trafficRank: "B端",
    controller: "待核实（通道/代理主体）",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "中金公司｜中金｜中金（资金参与机构·结构化服务商·CN）",
    brands: "中金",
    countries: "中国",
    languages: "中文",
    licenses: "证券/投行；ABS与结构化安排对照",
    timing: "持续",
    regulators: "证监会等",
    traffic: "机构",
    volume: "—",
    users: "机构",
    diandian: "公开信息",
    note: "公开信息建档·结构化服务商对照",
    institutionTypes: ["资金参与机构"],
    fundKinds: ["结构化服务商"],
    verify: "仅监管",
    licenseReg: "CN：证券/投行",
    trafficRank: "B端",
    controller: "中金公司",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "BlackRock｜贝莱德｜BlackRock（资金参与机构·优先投资人·US）",
    brands: "BlackRock",
    countries: "全球",
    languages: "英语",
    licenses: "资管；优先层/固收类投资对照",
    timing: "持续",
    regulators: "SEC等",
    traffic: "机构",
    volume: "公开AUM口径",
    users: "机构",
    diandian: "公开信息",
    note: "公开信息建档·优先投资人对照样本",
    institutionTypes: ["资金参与机构"],
    fundKinds: ["优先投资人"],
    verify: "仅监管",
    licenseReg: "资管/投资顾问",
    trafficRank: "B端",
    equity: "NYSE: BLK",
    controller: "BlackRock",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Avenue Capital｜Avenue｜Avenue Capital Group（资金参与机构·优先投资人·US）",
    brands: "Avenue Capital",
    countries: "美国、欧洲、亚洲（纽约总部；欧亚多办公室）",
    languages: "英语",
    licenses: "私募信贷/特殊情况投资；优先层/专项放贷对照（非银行吸储）",
    timing: "1995 成立；持续",
    regulators: "SEC等（私募基金披露口径）",
    traffic: "机构直投/专项信贷",
    volume: "公开管理规模约 USD 92 亿（官网 Firm 页口径，时点待续核）",
    users: "机构投资人",
    diandian: "https://www.avenuecapital.com",
    note: "优先投资人·官网建档：specialty lending / opportunistic credit / special situations；创始人 Marc Lasry、Sonia Gardner",
    institutionTypes: ["资金参与机构"],
    fundKinds: ["优先投资人"],
    verify: "仅监管",
    licenseReg: "私募信贷/另类投资（非银行牌照叙事）",
    trafficRank: "B端·机构",
    equity: "私人合伙；官网 avenuecapital.com",
    controller: "Avenue Capital Group（Senior Principals: Marc Lasry / Sonia Gardner）",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Apollo｜Apollo｜Apollo（资金参与机构·夹层投资人·US）",
    brands: "Apollo",
    countries: "全球",
    languages: "英语",
    licenses: "另类/私募信贷；夹层对照",
    timing: "持续",
    regulators: "SEC等",
    traffic: "机构",
    volume: "—",
    users: "机构",
    diandian: "公开信息",
    note: "公开信息建档·夹层投资人对照样本",
    institutionTypes: ["资金参与机构"],
    fundKinds: ["夹层投资人"],
    verify: "仅监管",
    licenseReg: "另类投资",
    trafficRank: "B端",
    equity: "NYSE: APO",
    controller: "Apollo Global Management",
  },
  // —— 风险参与机构 ——
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "中国平安｜平安｜平安（风险参与机构·CN）",
    brands: "中国平安",
    countries: "中国",
    languages: "中文",
    licenses: "保险等；信贷增信/风险分担对照",
    timing: "持续",
    regulators: "金融监管总局",
    traffic: "保险/综合金融",
    volume: "—",
    users: "—",
    diandian: "公开信息",
    note: "公开信息建档·风险参与/保险",
    institutionTypes: ["风险参与机构"],
    verify: "仅监管",
    licenseReg: "CN：保险等牌照",
    trafficRank: "综合金融App",
    controller: "中国平安",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "腰部",
    group: "AIA｜AIA｜AIA（风险参与机构·SEA）",
    brands: "AIA",
    countries: "东南亚多国",
    languages: "英语/当地语",
    licenses: "保险",
    timing: "持续",
    regulators: "各国保险监管",
    traffic: "保险渠道",
    volume: "—",
    users: "—",
    diandian: "公开信息",
    note: "公开信息建档",
    institutionTypes: ["风险参与机构"],
    verify: "仅监管",
    licenseReg: "SEA：保险牌照分国",
    trafficRank: "保险App",
    controller: "AIA Group",
  },
  // —— 风控服务方 ——
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "同盾科技｜同盾｜同盾（风控服务方·CN）",
    brands: "同盾",
    countries: "中国及出海客户",
    languages: "中文/英语",
    licenses: "风控技术服务（非放贷）",
    timing: "运营中",
    regulators: "—",
    traffic: "B端SDK/API",
    volume: "—",
    users: "金融机构客户",
    diandian: "公开信息",
    note: "B 端反欺诈/设备指纹/风险决策；公开信息建档·风控服务方（非线上场景 To C 词条）",
    institutionTypes: ["风控服务方"],
    verify: "仅流量",
    licenseReg: "技术服务；各国合规以客户落地为准",
    trafficRank: "B端·反欺诈",
    controller: "同盾科技",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "FICO｜FICO｜FICO（风控服务方·US）",
    brands: "FICO",
    countries: "美国等",
    languages: "英语",
    licenses: "信用评分/决策服务（B 端）",
    timing: "多年",
    regulators: "—",
    traffic: "B端",
    volume: "公开上市口径",
    users: "机构",
    diandian: "公开信息",
    note: "信用评分与决策引擎；归风控服务方，不作 To C「信用管理」场景词条",
    institutionTypes: ["风控服务方"],
    verify: "仅监管",
    licenseReg: "评分服务商（非放贷牌）",
    trafficRank: "B端·评分",
    equity: "NYSE: FICO",
    controller: "Fair Isaac",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "RELX｜LexisNexis｜RELX（风控服务方·全球）",
    brands: "LexisNexis Risk Solutions / RELX",
    countries: "英/美等",
    languages: "英语",
    licenses: "风险数据与反欺诈/身份核验（B 端）",
    timing: "多年；NYSE/LSE 上市",
    regulators: "—",
    traffic: "B端",
    volume: "公开上市口径",
    users: "金融机构与企业客户",
    diandian: "公开信息/IR",
    note: "含 LexisNexis Risk；生态角色·风控服务方",
    institutionTypes: ["风控服务方"],
    verify: "仅监管",
    licenseReg: "风险数据服务（非放贷）",
    trafficRank: "B端·风险数据",
    equity: "NYSE: RELX",
    controller: "RELX plc",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "NICE｜Actimize｜NICE（风控服务方·IL）",
    brands: "NICE Actimize",
    countries: "以色列总部；全球金融机构客户",
    languages: "英语",
    licenses: "反欺诈/AML/金融犯罪合规软件（B 端）",
    timing: "多年；NASDAQ 上市",
    regulators: "—",
    traffic: "B端",
    volume: "公开上市口径",
    users: "银行与支付机构",
    diandian: "公开信息",
    note: "金融犯罪与欺诈管理；生态角色·风控服务方",
    institutionTypes: ["风控服务方"],
    verify: "仅监管",
    licenseReg: "合规/反欺诈软件（非放贷）",
    trafficRank: "B端·反欺诈",
    equity: "NASDAQ: NICE",
    controller: "NICE Ltd.",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "百融云创｜百融｜Bairong（风控服务方·CN）",
    brands: "百融云创 / Bairong",
    countries: "中国；服务机构客户为主",
    languages: "中文/英语",
    licenses: "风控/反欺诈/智能决策与AI Agent技术服务（非放贷）",
    timing: "2014成立；2021港交所上市",
    regulators: "—",
    traffic: "B端API/RaaS",
    volume: "服务机构客户8000+（公开口径）",
    users: "金融机构及泛行业机构客户",
    diandian: "公开信息/投资者关系",
    note: "授信评分与反欺诈、智能风控中台；港股 6608.HK；生态角色·风控服务方",
    institutionTypes: ["风控服务方"],
    verify: "仅监管",
    licenseReg: "技术服务；各国合规以客户落地为准",
    trafficRank: "B端·评分/反欺诈",
    equity: "HKEX: 6608.HK",
    controller: "百融云创（Bairong Inc.）",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "ADVANCE.AI｜Advance AI｜Advance Intelligence（风控服务方·SG）",
    brands: "ADVANCE.AI",
    countries: "新加坡总部；东南亚/南亚/大中华等",
    languages: "英语/多本地语",
    licenses: "数字身份核验/KYC·KYB、反欺诈、风险管理SaaS（非放贷）",
    timing: "2016新加坡成立",
    regulators: "—",
    traffic: "B端SaaS/Open API",
    volume: "企业客户500+（公开口径）",
    users: "银行/金融科技/支付/电商等机构客户",
    diandian: "公开信息",
    note: "eKYC 与反欺诈/风控决策；出海信贷栈常见；归风控服务方",
    institutionTypes: ["风控服务方"],
    verify: "仅流量",
    licenseReg: "技术服务；各国合规以客户落地为准",
    trafficRank: "B端·KYC/反欺诈",
    equity: "私营（集团融资轮次公开）",
    controller: "Advance Intelligence Group",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "数美科技｜数美｜Shumei（风控服务方·CN）",
    brands: "数美科技",
    countries: "中国及出海客户",
    languages: "中文/英语",
    licenses: "内容安全/反欺诈/风控技术服务（非放贷）",
    timing: "运营中",
    regulators: "—",
    traffic: "B端SDK/API",
    volume: "—",
    users: "金融机构/互联网客户",
    diandian: "公开信息",
    note: "反欺诈与内容风控；生态角色·风控服务方",
    institutionTypes: ["风控服务方"],
    verify: "仅流量",
    licenseReg: "技术服务",
    trafficRank: "B端·反欺诈",
    controller: "数美科技",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Sift｜Sift｜Sift（风控服务方·US）",
    brands: "Sift",
    countries: "美国/全球机构客户",
    languages: "英语",
    licenses: "数字信任/反欺诈平台（B 端）",
    timing: "运营中",
    regulators: "—",
    traffic: "B端SaaS",
    volume: "—",
    users: "电商/金融等机构",
    diandian: "公开信息",
    note: "交易与账户反欺诈；归风控服务方，非 To C 场景",
    institutionTypes: ["风控服务方"],
    verify: "仅流量",
    licenseReg: "技术服务",
    trafficRank: "B端·反欺诈",
    controller: "Sift",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Forter｜Forter｜Forter（风控服务方·US）",
    brands: "Forter",
    countries: "美国/全球机构客户",
    languages: "英语",
    licenses: "电商欺诈决策（B 端）",
    timing: "运营中",
    regulators: "—",
    traffic: "B端SaaS",
    volume: "—",
    users: "电商/支付机构",
    diandian: "公开信息",
    note: "支付与电商反欺诈决策；生态角色·风控服务方",
    institutionTypes: ["风控服务方"],
    verify: "仅流量",
    licenseReg: "技术服务",
    trafficRank: "B端·反欺诈",
    controller: "Forter",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "腰部",
    group: "SHIELD｜SHIELD｜SHIELD（风控服务方·SEA）",
    brands: "SHIELD",
    countries: "东南亚等",
    languages: "英语",
    licenses: "设备指纹/反欺诈（B 端）",
    timing: "运营中",
    regulators: "—",
    traffic: "B端SDK/API",
    volume: "—",
    users: "金融/出行等机构",
    diandian: "公开信息",
    note: "设备与账号反欺诈；归风控服务方",
    institutionTypes: ["风控服务方"],
    verify: "仅流量",
    licenseReg: "技术服务",
    trafficRank: "B端·反欺诈",
    controller: "SHIELD",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Feedzai｜Feedzai｜Feedzai（风控服务方·EU）",
    brands: "Feedzai",
    countries: "欧洲/全球机构客户",
    languages: "英语",
    licenses: "金融犯罪/反欺诈 AI（B 端）",
    timing: "运营中",
    regulators: "—",
    traffic: "B端平台",
    volume: "—",
    users: "银行/支付机构",
    diandian: "公开信息",
    note: "金融犯罪与交易反欺诈；生态角色·风控服务方",
    institutionTypes: ["风控服务方"],
    verify: "仅流量",
    licenseReg: "技术服务",
    trafficRank: "B端·反欺诈",
    controller: "Feedzai",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "微众科技｜微众科技香港｜WeBank Tech（风控服务方·HK）",
    brands: "微众科技 / WeBank Technology",
    countries: "中国香港；对外输出金融科技能力",
    languages: "中文/英语",
    licenses: "金融科技/风控与数字化能力输出（非本地吸储银行展业主体）",
    timing: "微众银行关联科技输出臂",
    regulators: "—",
    traffic: "B端科技输出/合作",
    volume: "—",
    users: "金融机构及合作伙伴",
    diandian: "公开信息",
    note: "微众银行科技能力对外输出常用「微众科技/香港」口径；与微众银行持牌银行主体区分",
    institutionTypes: ["风控服务方"],
    verify: "待双端",
    licenseReg: "技术服务主体；银行牌照在微众银行等持牌实体",
    trafficRank: "B端",
    equity: "微众银行关联",
    controller: "微众银行/腾讯系关联生态（公开叙事）",
  },
  // —— 回收机构 ——
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "东方资产｜东方资产｜东方资产（回收机构·CN）",
    brands: "中国东方资产管理",
    countries: "中国",
    languages: "中文",
    licenses: "金融资产管理公司（全国性AMC）",
    timing: "1999设立·持续运营",
    founded: "1999",
    regulators: "国家金融监督管理总局等",
    traffic: "不良收购/处置/重组；对公与零售不良",
    volume: "全国性AMC量级（公开披露口径）",
    users: "银行/非银不良出让方；重组债务人",
    diandian: "公开信息/监管披露",
    note: "四大AMC之一；2025 财政部持股划转中央汇金后仍为国有控股金融机构。对照信贷贷后处置与批量不良转让。",
    institutionTypes: ["回收机构"],
    verify: "仅监管",
    licenseReg: "CN：金融资产管理公司（全国性AMC）",
    trafficRank: "非C端借贷榜",
    controller: "中国东方资产管理股份有限公司（汇金控股口径）",
    equity: "国有控股·汇金体系",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "中国信达｜信达｜中国信达（回收机构·CN）",
    brands: "中国信达 / Cinda",
    countries: "中国；境外平台另计",
    languages: "中文/英语",
    licenses: "金融资产管理公司（全国性AMC）",
    timing: "1999设立·HK上市",
    founded: "1999",
    regulators: "国家金融监督管理总局等",
    traffic: "不良经营/投资/综合金融服务",
    volume: "公开财报与不良经营披露",
    users: "金融机构不良出让方",
    diandian: "公开信息/港交所披露",
    note: "四大AMC之一、港股上市（01359.HK）；2025 控股股东变更为中央汇金。常作银行不良批量转让对手方对照。",
    institutionTypes: ["回收机构"],
    verify: "仅监管",
    licenseReg: "CN：金融资产管理公司（全国性AMC）",
    trafficRank: "非C端借贷榜",
    equity: "HKEX: 1359",
    controller: "中国信达资产管理股份有限公司（汇金控股口径）",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "中信金融资产｜中信金融资产｜中信金融资产（回收机构·CN）",
    brands: "中信金融资产（原中国华融）",
    countries: "中国；境外平台另计",
    languages: "中文/英语",
    licenses: "金融资产管理公司（全国性AMC）",
    timing: "1999华融设立·2024更名",
    founded: "1999",
    regulators: "国家金融监督管理总局等",
    traffic: "不良资产主业重整后的收购/处置",
    volume: "公开财报口径（化险后主业收缩叙事）",
    users: "金融机构不良出让方",
    diandian: "公开信息/港交所披露",
    note: "原中国华融；划入中信集团后更名中信金融资产。历史金租等牌照子公司与回收主业区分建档。",
    institutionTypes: ["回收机构"],
    verify: "仅监管",
    licenseReg: "CN：金融资产管理公司（全国性AMC）",
    trafficRank: "非C端借贷榜",
    equity: "中信集团体系·港股披露主体对照",
    controller: "中国中信金融资产管理股份有限公司",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "长城资产｜长城资产｜长城资产（回收机构·CN）",
    brands: "中国长城资产管理",
    countries: "中国",
    languages: "中文",
    licenses: "金融资产管理公司（全国性AMC）",
    timing: "1999设立·持续运营",
    founded: "1999",
    regulators: "国家金融监督管理总局等",
    traffic: "不良收购/处置；旗下银行/证券等金融牌照另档",
    volume: "全国性AMC量级（公开披露口径）",
    users: "金融机构不良出让方",
    diandian: "公开信息/监管披露",
    note: "四大AMC之一；2025 股权划转中央汇金。不良主业与金租/银行等子公司牌照勿混同。",
    institutionTypes: ["回收机构"],
    verify: "仅监管",
    licenseReg: "CN：金融资产管理公司（全国性AMC）",
    trafficRank: "非C端借贷榜",
    equity: "国有控股·汇金体系",
    controller: "中国长城资产管理股份有限公司（汇金控股口径）",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "粤财资产｜粤财资产｜粤财资产（回收机构·地方AMC·CN）",
    brands: "广东粤财资产管理",
    countries: "中国（广东为主）",
    languages: "中文",
    licenses: "地方资产管理公司（地方AMC）",
    timing: "运营中",
    founded: "成立待核实",
    regulators: "地方金融监管+金融监管总局相关规则",
    traffic: "省内不良收购/纾困/处置",
    volume: "地方AMC量级",
    users: "地方金融机构与企业纾困对象",
    diandian: "公开信息",
    note: "地方AMC样本：对照省内批量不良与纾困处置；展业地域与全国性AMC区分。",
    institutionTypes: ["回收机构"],
    verify: "待双端",
    licenseReg: "CN：地方资产管理公司",
    trafficRank: "非C端借贷榜",
    controller: "广东粤财资产管理有限公司（公开口径）",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "中原资产｜中原资产｜中原资产（回收机构·地方AMC·CN）",
    brands: "河南中原资产管理",
    countries: "中国（河南为主）",
    languages: "中文",
    licenses: "地方资产管理公司（地方AMC）",
    timing: "运营中",
    founded: "成立待核实",
    regulators: "地方金融监管+金融监管总局相关规则",
    traffic: "省内不良收购/处置",
    volume: "地方AMC量级",
    users: "地方金融机构",
    diandian: "公开信息",
    note: "地方AMC样本（华中）。与全国性AMC、委外催收公司分层对照。",
    institutionTypes: ["回收机构"],
    verify: "待双端",
    licenseReg: "CN：地方资产管理公司",
    trafficRank: "非C端借贷榜",
    controller: "河南中原资产管理有限公司（公开口径）",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "Collectius｜Collectius｜Collectius（回收机构·SEA）",
    brands: "Collectius / Collectius Holdings",
    countries: "新加坡/马来/印尼/菲/泰/越/印度",
    languages: "英语/当地语",
    licenses: "NPL购买与债收服务（分国牌照/许可路径）",
    timing: "2016起运营",
    founded: "2016",
    regulators: "分国金融/债收监管（SG公司注册+分国债收许可）",
    traffic: "https://www.collectius.com/",
    volume:
      "公开叙事管理不良资产 AUM 约数十亿美元（历史披露曾报约 USD7–8B；区域覆盖 SG/MY/ID/PH/TH/VN/IN，时点以官网/新闻为准）",
    users: "银行、多金融与持牌数字贷方委托；逾期借款人",
    employees: "约1100+（公开叙事）",
    diandian: "官网/行业新闻/IFC 合作披露",
    note:
      "东南亚数字化债收与 NPL 投资龙头样本；IFC 等发展金融机构合作叙事。菲市场经收购 CJM（见 Collectius PH 分档）。展业看分国委外合同、数据本地化与催收行为监管，勿把集团官网当统一牌照。",
    institutionTypes: ["回收机构"],
    verify: "仅监管",
    licenseReg:
      "SG：集团主体注册；PH/ID/MY/TH/VN/IN：分国债收/不良资管许可或合同路径（以当地执照清单为准，勿把集团官网当统一牌照）；PH 对照：CJM / Collectius PH",
    trafficRank: "B端",
    controller: "Collectius",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "腰部",
    group: "PPA｜印尼国有资产公司｜PPA（回收机构·ID）",
    brands: "Perusahaan Pengelola Aset / PPA",
    countries: "印尼",
    languages: "印尼语/英语",
    licenses: "国有不良资产与资产处置（财政部框架下国有企业）",
    timing: "运营中",
    founded: "成立待核实",
    regulators: "印尼财政部 / 相关国资监管",
    traffic: "https://www.ptppa.com/",
    volume: "公开项目与处置规模以年报/财政部披露为准",
    users: "银行/多金融不良出让方",
    diandian: "官网/监管披露",
    note: "印尼国有不良资产管理对照样本（NAMCO 叙事）；消费贷 NPL 出表/处置链路可对照，非民营催收公司。",
    institutionTypes: ["回收机构"],
    verify: "仅监管",
    licenseReg: "ID：国有资产管理公司（不良/特殊资产处置）；https://www.ptppa.com/",
    trafficRank: "B端",
    controller: "PT Perusahaan Pengelola Aset",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "腰部",
    group: "CJM / Collectius PH｜CJM｜Collectius PH（回收机构·PH）",
    brands: "CJM Strategic Management Solutions / Collectius Philippines",
    countries: "菲律宾",
    languages: "英语/菲律宾语",
    licenses: "债收与 NPL 服务（当地商事/债收合规路径）",
    timing: "Collectius 经收购 CJM 进入菲市场",
    founded: "成立待核实",
    regulators: "菲律宾当地商事与数据/债收相关规则；SEC 借贷平台规则另计",
    traffic: "https://philippines.collectius.com/about",
    volume: "并入 Collectius 区域 AUM 叙事（时点以集团披露为准）",
    users: "银行、融资公司、数字贷方；逾期借款人",
    diandian: "Collectius PH 官网",
    note: "菲律宾本地债收主体对照：Collectius 公开称经收购 CJM 进入菲市场；展业看委外合同与数据合规。",
    institutionTypes: ["回收机构"],
    verify: "仅监管",
    licenseReg: "PH：债收商事主体（非放贷牌）；集团许可分国核验",
    trafficRank: "B端",
    controller: "Collectius / CJM Strategic Management Solutions",
  },
  {
    region: "south-asia",
    line: "agent",
    tier: "头部",
    group: "ARCIL｜ARCIL｜ARCIL（回收机构·IN）",
    brands: "Asset Reconstruction Company (India) / ARCIL",
    countries: "印度",
    languages: "英语/印地语等",
    licenses: "Asset Reconstruction Company（SARFAESI/RBI框架）",
    timing: "2002设立·持续运营",
    founded: "2002",
    regulators: "RBI / SARFAESI相关",
    traffic: "银行不良收购与重建/处置",
    volume: "公开披露AUM与回收额（时点以年报为准）",
    users: "银行/金融机构不良出让方",
    employees: "约190+（公开口径）",
    diandian: "官网/监管披露",
    note: "印度首批ARC对照；零售与对公不良重建。与NBFC/银行不良出表链路相关。",
    institutionTypes: ["回收机构"],
    verify: "仅监管",
    licenseReg: "IN：Asset Reconstruction Company",
    trafficRank: "B端",
    controller: "Asset Reconstruction Company (India) Limited",
  },
  {
    region: "south-asia",
    line: "agent",
    tier: "腰部",
    group: "Edelweiss ARC｜Edelweiss ARC｜Edelweiss ARC（回收机构·IN）",
    brands: "Edelweiss Asset Reconstruction",
    countries: "印度",
    languages: "英语",
    licenses: "Asset Reconstruction Company",
    timing: "运营中",
    founded: "成立待核实",
    regulators: "RBI相关",
    traffic: "不良收购与决议",
    volume: "集团公开披露口径",
    users: "银行/NBFC不良出让方",
    diandian: "公开信息",
    note: "印度市场化ARC样本（Edelweiss体系）。与ARCIL分层对照零售/对公不良。",
    institutionTypes: ["回收机构"],
    verify: "待双端",
    licenseReg: "IN：Asset Reconstruction Company",
    trafficRank: "B端",
    controller: "Edelweiss Asset Reconstruction Company（公开口径）",
    equity: "Edelweiss集团关联",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Encore Capital｜Encore｜Encore Capital（回收机构·US）",
    brands: "Encore Capital / Midland Credit Management",
    countries: "美国；欧洲等市场另计",
    languages: "英语",
    licenses: "债务购买与催收服务（州级许可路径）",
    timing: "上市运营",
    founded: "成立待核实",
    regulators: "CFPB/各州债收许可等",
    traffic: "购买消费不良+自营催收品牌",
    volume: "公开财报口径",
    users: "金融机构债权出让方；逾期消费者",
    diandian: "公开信息/SEC披露",
    note: "美国消费不良购买龙头对照；CFPB合规与州许可敏感。Midland为主要运营品牌。",
    institutionTypes: ["回收机构"],
    verify: "仅监管",
    licenseReg: "US：债务购买/催收·州许可",
    trafficRank: "B端",
    equity: "NASDAQ: ECPG",
    controller: "Encore Capital Group",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "PRA Group｜PRA｜PRA Group（回收机构·US）",
    brands: "PRA Group",
    countries: "美国；欧洲等",
    languages: "英语",
    licenses: "债务购买与催收服务",
    timing: "上市运营",
    founded: "成立待核实",
    regulators: "CFPB/各州等",
    traffic: "消费不良购买与回收",
    volume: "公开财报口径",
    users: "金融机构债权出让方",
    diandian: "公开信息/SEC披露",
    note: "与Encore并列的美国消费债购买商对照样本。",
    institutionTypes: ["回收机构"],
    verify: "仅监管",
    licenseReg: "US：债务购买/催收·州许可",
    trafficRank: "B端",
    equity: "NASDAQ: PRAA",
    controller: "PRA Group, Inc.",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Intrum｜Intrum｜Intrum（回收机构·EU）",
    brands: "Intrum",
    countries: "欧洲多国",
    languages: "英语/当地语",
    licenses: "信用管理与债收服务（分国许可）",
    timing: "上市运营",
    founded: "成立待核实",
    regulators: "欧盟/各国债收与数据保护",
    traffic: "受托催收+不良投资",
    volume: "公开财报口径",
    users: "银行与企业委托方",
    diandian: "公开信息",
    note: "欧洲信用管理/债收龙头对照；GDPR与分国催收规范敏感。",
    institutionTypes: ["回收机构"],
    verify: "仅监管",
    licenseReg: "EU：信用管理/债收·分国",
    trafficRank: "B端",
    equity: "Nasdaq Stockholm: INTRUM",
    controller: "Intrum AB",
  },
  {
    region: "west",
    line: "agent",
    tier: "新兴",
    group: "TrueAccord｜TrueAccord｜TrueAccord（回收机构·US）",
    brands: "TrueAccord",
    countries: "美国",
    languages: "英语",
    licenses: "数字化债收服务（州许可路径）",
    timing: "运营中",
    founded: "成立待核实",
    regulators: "CFPB/各州债收规则",
    traffic: "AI/数字化委外催收SaaS与服务",
    volume: "—",
    users: "金融与消费信贷委托方",
    diandian: "公开信息/融资新闻",
    note: "数字化委外催收样本：对照持牌贷方贷后触达合规，与传统债购买商分层。",
    institutionTypes: ["回收机构"],
    verify: "仅流量",
    licenseReg: "US：数字化债收服务·州许可待核",
    trafficRank: "B端",
    controller: "TrueAccord",
  },
  // —— 权益服务商 ——
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "樊登读书合作权益包｜樊登｜樊登（权益服务商·CN）",
    brands: "权益包/会员（对照样本）",
    countries: "中国",
    languages: "中文",
    licenses: "内容/会员权益供给（非放贷）",
    timing: "常见搭售",
    regulators: "—",
    traffic: "信贷App权益中心",
    volume: "—",
    users: "借款人侧权益",
    diandian: "公开业态",
    note: "公开业态对照·信贷搭售权益",
    institutionTypes: ["权益服务商"],
    verify: "待双端",
    licenseReg: "非金融放贷牌",
    trafficRank: "随宿主App",
    controller: "待核实（权益供给方多样）",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Loyalty｜Points｜Loyalty（权益服务商·US）",
    brands: "积分/返现权益平台（对照）",
    countries: "美国等",
    languages: "英语",
    licenses: "营销权益",
    timing: "常见",
    regulators: "—",
    traffic: "发卡/贷款产品搭售",
    volume: "—",
    users: "C端",
    diandian: "公开业态",
    note: "公开业态对照样本",
    institutionTypes: ["权益服务商"],
    verify: "待双端",
    licenseReg: "非放贷",
    trafficRank: "—",
    controller: "待核实",
  },
  // —— 触达服务机构 ——
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Twilio｜Twilio｜Twilio（触达服务机构·US）",
    brands: "Twilio",
    countries: "全球",
    languages: "英语",
    licenses: "通讯云（短信/语音等）",
    timing: "上市",
    regulators: "各国通讯合规",
    traffic: "API",
    volume: "公开财报",
    users: "企业客户",
    diandian: "公开信息",
    note: "公开信息建档·信贷触达常用基础设施",
    institutionTypes: ["触达服务机构"],
    verify: "仅监管",
    licenseReg: "通讯服务商",
    trafficRank: "B端",
    equity: "NYSE: TWLO",
    controller: "Twilio Inc.",
  },
  {
    region: "mena",
    line: "agent",
    tier: "腰部",
    group: "Central Bank of Bahrain｜CBB｜巴林央行（监管·BH）",
    brands: "CBB",
    countries: "巴林",
    languages: "阿/英",
    licenses: "央行/银行与金融公司监管（对照）",
    timing: "持续",
    regulators: "CBB",
    traffic: "https://www.cbb.gov.bh/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "BH：CBB",
    trafficRank: "无商店榜口径",
    controller: "CBB",
  },
  {
    region: "mena",
    line: "agent",
    tier: "腰部",
    group: "Qatar Central Bank｜QCB｜卡塔尔央行（监管·QA）",
    brands: "QCB",
    countries: "卡塔尔",
    languages: "阿/英",
    licenses: "央行/银行与金融监管（对照）",
    timing: "持续",
    regulators: "QCB",
    traffic: "https://www.qcb.gov.qa/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "QA：QCB",
    trafficRank: "无商店榜口径",
    controller: "QCB",
  },
  {
    region: "mena",
    line: "agent",
    tier: "腰部",
    group: "Central Bank of Kuwait｜CBK｜科威特央行（监管·KW）",
    brands: "CBK Kuwait",
    countries: "科威特",
    languages: "阿/英",
    licenses: "央行/银行监管（对照）",
    timing: "持续",
    regulators: "CBK",
    traffic: "https://www.cbk.gov.kw/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照；与肯尼亚 CBK 缩写同形，以国别区分",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "KW：Central Bank of Kuwait",
    trafficRank: "无商店榜口径",
    controller: "Central Bank of Kuwait",
  },
  {
    region: "mena",
    line: "agent",
    tier: "腰部",
    group: "Central Bank of Oman｜CBO｜阿曼央行（监管·OM）",
    brands: "CBO",
    countries: "阿曼",
    languages: "阿/英",
    licenses: "央行/银行监管（对照）",
    timing: "持续",
    regulators: "CBO",
    traffic: "https://cbo.gov.om/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "OM：CBO",
    trafficRank: "无商店榜口径",
    controller: "CBO",
  },
  {
    region: "mena",
    line: "agent",
    tier: "腰部",
    group: "Bank Al-Maghrib｜BAM｜摩洛哥央行（监管·MA）",
    brands: "Bank Al-Maghrib",
    countries: "摩洛哥",
    languages: "阿/法/英",
    licenses: "央行/信贷机构监管（对照）",
    timing: "持续",
    regulators: "BAM",
    traffic: "https://www.bkam.ma/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "MA：Bank Al-Maghrib",
    trafficRank: "无商店榜口径",
    controller: "Bank Al-Maghrib",
  },
  {
    region: "mena",
    line: "agent",
    tier: "腰部",
    group: "Central Bank of Jordan｜CBJ｜约旦央行（监管·JO）",
    brands: "CBJ",
    countries: "约旦",
    languages: "阿/英",
    licenses: "央行/银行监管（对照）",
    timing: "持续",
    regulators: "CBJ",
    traffic: "https://www.cbj.gov.jo/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "JO：CBJ",
    trafficRank: "无商店榜口径",
    controller: "CBJ",
  },
  {
    region: "africa",
    line: "agent",
    tier: "腰部",
    group: "Bank of Tanzania｜BoT｜坦桑尼亚央行（监管·TZ）",
    brands: "BoT",
    countries: "坦桑尼亚",
    languages: "斯瓦希里/英语",
    licenses: "央行/微金融与支付（对照）",
    timing: "持续",
    regulators: "BoT",
    traffic: "https://www.bot.go.tz/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "TZ：BoT",
    trafficRank: "无商店榜口径",
    controller: "BoT",
  },
  {
    region: "africa",
    line: "agent",
    tier: "腰部",
    group: "Bank of Uganda｜BoU｜乌干达央行（监管·UG）",
    brands: "BoU",
    countries: "乌干达",
    languages: "英语",
    licenses: "央行/微金融与支付（对照）",
    timing: "持续",
    regulators: "BoU",
    traffic: "https://www.bou.or.ug/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "UG：BoU",
    trafficRank: "无商店榜口径",
    controller: "BoU",
  },
  {
    region: "africa",
    line: "agent",
    tier: "腰部",
    group: "National Bank of Rwanda｜BNR｜卢旺达央行（监管·RW）",
    brands: "BNR",
    countries: "卢旺达",
    languages: "英/法/卢旺达语",
    licenses: "央行/支付与银行（对照）",
    timing: "持续",
    regulators: "BNR",
    traffic: "https://www.bnr.rw/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "RW：BNR",
    trafficRank: "无商店榜口径",
    controller: "BNR",
  },
  {
    region: "africa",
    line: "agent",
    tier: "腰部",
    group: "National Bank of Ethiopia｜NBE｜埃塞俄比亚央行（监管·ET）",
    brands: "NBE",
    countries: "埃塞俄比亚",
    languages: "阿姆哈拉语/英语",
    licenses: "央行/银行与支付（对照）",
    timing: "持续",
    regulators: "NBE",
    traffic: "https://nbe.gov.et/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "公开对照",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "ET：NBE",
    trafficRank: "无商店榜口径",
    controller: "NBE",
  },
  {
    region: "africa",
    line: "agent",
    tier: "腰部",
    group: "Banque Centrale des États de l'Afrique de l'Ouest｜BCEAO｜西非央行（监管·CI）",
    brands: "BCEAO",
    countries: "科特迪瓦等西非经货联盟",
    languages: "法语",
    licenses: "区域央行/银行与支付（对照）",
    timing: "持续",
    regulators: "BCEAO",
    traffic: "https://www.bceao.int/",
    volume: "—",
    users: "—",
    diandian: "监管源",
    note: "覆盖 CI/SN/BJ/BF/ML 等 WAEMU；国别筛选以 CI 等为代表",
    institutionTypes: ["监管"],
    verify: "仅监管",
    licenseReg: "CI/WAEMU：BCEAO",
    trafficRank: "无商店榜口径",
    controller: "BCEAO",
  },
  {
    region: "africa",
    line: "agent",
    tier: "腰部",
    group: "Infobip｜Infobip｜Infobip（触达服务机构·全球）",
    brands: "Infobip",
    countries: "全球/新兴市场",
    languages: "英语",
    licenses: "CPaaS 触达",
    timing: "运营中",
    regulators: "各国",
    traffic: "API/WhatsApp等",
    volume: "—",
    users: "企业",
    diandian: "公开信息",
    note: "公开信息建档",
    institutionTypes: ["触达服务机构"],
    verify: "仅流量",
    licenseReg: "CPaaS",
    trafficRank: "B端",
    controller: "Infobip",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "梦网科技｜梦网｜梦网（触达服务机构·CN）",
    brands: "梦网",
    countries: "中国",
    languages: "中文",
    licenses: "短信等触达服务",
    timing: "上市口径",
    regulators: "工信相关",
    traffic: "企业短信",
    volume: "—",
    users: "企业",
    diandian: "公开信息",
    note: "公开信息建档·国内触达",
    institutionTypes: ["触达服务机构"],
    verify: "仅监管",
    licenseReg: "短信服务",
    trafficRank: "B端",
    controller: "梦网科技",
  },
  // —— 公关服务机构 ——
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Edelman｜Edelman｜Edelman（公关服务机构·US）",
    brands: "Edelman",
    countries: "全球",
    languages: "英语等",
    licenses: "公关咨询",
    timing: "运营中",
    regulators: "—",
    traffic: "B端顾问",
    volume: "—",
    users: "企业",
    diandian: "公开信息",
    note: "公开信息建档·金融品牌/危机公关常见服务方",
    institutionTypes: ["公关服务机构"],
    verify: "仅流量",
    licenseReg: "非金融牌照",
    trafficRank: "B端",
    controller: "Edelman",
  },
  // —— 信托服务机构 ——
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "中信信托｜中信信托｜中信（信托服务机构·CN）",
    brands: "中信信托",
    countries: "中国",
    languages: "中文",
    licenses: "信托牌照",
    timing: "运营中",
    regulators: "国家金融监督管理总局等",
    traffic: "机构/高净值",
    volume: "—",
    users: "机构与合格投资者",
    diandian: "公开信息",
    note: "公开信息建档·信托/ABS受托对照",
    institutionTypes: ["信托服务机构"],
    verify: "仅监管",
    licenseReg: "信托公司",
    trafficRank: "B端",
    controller: "中信集团相关",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "平安信托｜平安信托｜平安（信托服务机构·CN）",
    brands: "平安信托",
    countries: "中国",
    languages: "中文",
    licenses: "信托牌照",
    timing: "运营中",
    regulators: "国家金融监督管理总局等",
    traffic: "机构",
    volume: "—",
    users: "机构与合格投资者",
    diandian: "公开信息",
    note: "公开信息建档",
    institutionTypes: ["信托服务机构"],
    verify: "仅监管",
    licenseReg: "信托公司",
    trafficRank: "B端",
    controller: "中国平安",
  },
  // —— 会计师事务所 ——
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "PwC｜普华永道｜PwC（会计师事务所·全球）",
    brands: "普华永道 / PwC",
    countries: "全球（含中国内地/香港成员所）",
    languages: "英语/当地语",
    licenses: "注册会计师审计与鉴证；咨询另计",
    timing: "全球网络持续运营",
    founded: "成立待核实",
    regulators: "各国会计/审计监管（PCAOB/FRC等对照）",
    traffic: "B端：审计/IPO/发债尽调/内控",
    volume: "全球网络公开收入口径",
    users: "上市公司与金融机构",
    diandian: "公开信息",
    note: "四大所。信贷/消金/持牌机构上市与发债财务尽调常用对照；中国内地与香港为分所主体。",
    institutionTypes: ["会计师事务所"],
    verify: "仅监管",
    licenseReg: "各国：注册会计师审计执业",
    trafficRank: "B端",
    controller: "PwC network（分国成员所）",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Deloitte｜德勤｜Deloitte（会计师事务所·全球）",
    brands: "德勤 / Deloitte",
    countries: "全球（含中国内地/香港成员所）",
    languages: "英语/当地语",
    licenses: "注册会计师审计与鉴证；咨询另计",
    timing: "全球网络持续运营",
    founded: "成立待核实",
    regulators: "各国会计/审计监管",
    traffic: "B端：审计/资本市场/风险咨询",
    volume: "全球网络公开收入口径",
    users: "上市公司与金融机构",
    diandian: "公开信息",
    note: "四大所。金融科技与持牌机构审计/内控尽调对照。",
    institutionTypes: ["会计师事务所"],
    verify: "仅监管",
    licenseReg: "各国：注册会计师审计执业",
    trafficRank: "B端",
    controller: "Deloitte network（分国成员所）",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "EY｜安永｜EY（会计师事务所·全球）",
    brands: "安永 / EY",
    countries: "全球（含中国内地/香港成员所）",
    languages: "英语/当地语",
    licenses: "注册会计师审计与鉴证；咨询另计",
    timing: "全球网络持续运营",
    founded: "成立待核实",
    regulators: "各国会计/审计监管",
    traffic: "B端：审计/IPO/财务尽调",
    volume: "全球网络公开收入口径",
    users: "上市公司与金融机构",
    diandian: "公开信息",
    note: "四大所。跨境上市与Fintech融资轮财务尽调常用。",
    institutionTypes: ["会计师事务所"],
    verify: "仅监管",
    licenseReg: "各国：注册会计师审计执业",
    trafficRank: "B端",
    controller: "EY network（分国成员所）",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "KPMG｜毕马威｜KPMG（会计师事务所·全球）",
    brands: "毕马威 / KPMG",
    countries: "全球（含中国内地/香港成员所）",
    languages: "英语/当地语",
    licenses: "注册会计师审计与鉴证；咨询另计",
    timing: "全球网络持续运营",
    founded: "成立待核实",
    regulators: "各国会计/审计监管",
    traffic: "B端：审计/监管合规咨询交叉",
    volume: "全球网络公开收入口径",
    users: "上市公司与金融机构",
    diandian: "公开信息",
    note: "四大所。银行/非银审计与监管报送相关鉴证对照。",
    institutionTypes: ["会计师事务所"],
    verify: "仅监管",
    licenseReg: "各国：注册会计师审计执业",
    trafficRank: "B端",
    controller: "KPMG network（分国成员所）",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "立信会计师事务所｜立信｜立信（会计师事务所·CN）",
    brands: "立信 / BDO China Shu Lun Pan 关联口径另核",
    countries: "中国",
    languages: "中文",
    licenses: "会计师事务所（证券资格等路径以中注协/证监会公示为准）",
    timing: "国内综合所·持续运营",
    founded: "成立待核实",
    regulators: "财政部/中注协；证券业务看证监会备案",
    traffic: "A股/债审计与验资",
    volume: "国内综合所前列（公开排行口径）",
    users: "上市公司与拟上市企业",
    diandian: "公开信息/中注协",
    note: "国内综合所头部样本。信贷系主体发债/IPO审计对照；国际网络加盟关系以当期公示为准。",
    institutionTypes: ["会计师事务所"],
    verify: "仅监管",
    licenseReg: "CN：会计师事务所",
    trafficRank: "B端",
    controller: "立信会计师事务所（特殊普通合伙）",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "天健会计师事务所｜天健｜天健（会计师事务所·CN）",
    brands: "天健",
    countries: "中国",
    languages: "中文",
    licenses: "会计师事务所（证券资格等路径以公示为准）",
    timing: "运营中",
    founded: "成立待核实",
    regulators: "财政部/中注协；证券业务看证监会备案",
    traffic: "A股审计高份额对照",
    volume: "国内综合所前列（公开排行口径）",
    users: "上市公司与拟上市企业",
    diandian: "公开信息/中注协",
    note: "国内综合所；A股审计市占常居前列。金融/消金发债审计对照。",
    institutionTypes: ["会计师事务所"],
    verify: "仅监管",
    licenseReg: "CN：会计师事务所",
    trafficRank: "B端",
    controller: "天健会计师事务所（特殊普通合伙）",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "致同会计师事务所｜致同｜致同（会计师事务所·CN）",
    brands: "致同 / Grant Thornton China",
    countries: "中国",
    languages: "中文/英语",
    licenses: "会计师事务所",
    timing: "运营中",
    founded: "成立待核实",
    regulators: "财政部/中注协等",
    traffic: "审计/税务/咨询",
    volume: "国内综合所中上（公开排行口径）",
    users: "企业与金融机构",
    diandian: "公开信息",
    note: "Grant Thornton 中国成员所口径。跨境与民营金融主体审计对照。",
    institutionTypes: ["会计师事务所"],
    verify: "仅监管",
    licenseReg: "CN：会计师事务所",
    trafficRank: "B端",
    controller: "致同会计师事务所（特殊普通合伙）",
    equity: "Grant Thornton 国际网络成员（公开口径）",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "信永中和｜信永中和｜信永中和（会计师事务所·CN）",
    brands: "信永中和",
    countries: "中国；港澳等分支另计",
    languages: "中文",
    licenses: "会计师事务所",
    timing: "运营中",
    founded: "成立待核实",
    regulators: "财政部/中注协等",
    traffic: "审计与鉴证",
    volume: "国内综合所中上（公开排行口径）",
    users: "上市公司与企业",
    diandian: "公开信息",
    note: "国内综合所样本；金融与城投类审计常见对照。",
    institutionTypes: ["会计师事务所"],
    verify: "仅监管",
    licenseReg: "CN：会计师事务所",
    trafficRank: "B端",
    controller: "信永中和会计师事务所（特殊普通合伙）",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "容诚会计师事务所｜容诚｜容诚（会计师事务所·CN）",
    brands: "容诚",
    countries: "中国",
    languages: "中文",
    licenses: "会计师事务所",
    timing: "运营中",
    founded: "成立待核实",
    regulators: "财政部/中注协等",
    traffic: "审计/IPO申报项目",
    volume: "国内综合所（公开排行口径）",
    users: "拟上市与上市公司",
    diandian: "公开信息",
    note: "国内综合所；近年IPO审计项目量对照样本。",
    institutionTypes: ["会计师事务所"],
    verify: "待双端",
    licenseReg: "CN：会计师事务所",
    trafficRank: "B端",
    controller: "容诚会计师事务所（特殊普通合伙）",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "大华会计师事务所｜大华｜大华（会计师事务所·CN）",
    brands: "大华",
    countries: "中国",
    languages: "中文",
    licenses: "会计师事务所",
    timing: "运营中",
    founded: "成立待核实",
    regulators: "财政部/中注协等",
    traffic: "审计与验资",
    volume: "国内综合所（公开排行口径）",
    users: "企业与金融机构",
    diandian: "公开信息",
    note: "国内综合所样本；与金融租赁/非银发债审计链路可交叉。",
    institutionTypes: ["会计师事务所"],
    verify: "待双端",
    licenseReg: "CN：会计师事务所",
    trafficRank: "B端",
    controller: "大华会计师事务所（特殊普通合伙）",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "BDO｜BDO｜BDO（会计师事务所·全球）",
    brands: "BDO",
    countries: "全球（分国成员所）",
    languages: "英语/当地语",
    licenses: "审计与鉴证（分国执业）",
    timing: "全球网络持续运营",
    founded: "成立待核实",
    regulators: "各国会计监管",
    traffic: "中型上市公司与成长型企业审计",
    volume: "全球五大网络之一（公开口径）",
    users: "企业与金融机构",
    diandian: "公开信息",
    note: "国际网络所；与国内立信等加盟关系按当期成员所名录核验，勿默认同一主体。",
    institutionTypes: ["会计师事务所"],
    verify: "仅监管",
    licenseReg: "各国：注册会计师审计执业",
    trafficRank: "B端",
    controller: "BDO International（分国成员所）",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "RSM｜RSM｜RSM（会计师事务所·全球）",
    brands: "RSM",
    countries: "全球（分国成员所）",
    languages: "英语/当地语",
    licenses: "审计与鉴证（分国执业）",
    timing: "全球网络持续运营",
    founded: "成立待核实",
    regulators: "各国会计监管",
    traffic: "中型企业审计与咨询",
    volume: "国际网络公开口径",
    users: "成长型企业",
    diandian: "公开信息",
    note: "国际网络所样本；新兴市场Fintech审计备选对照。",
    institutionTypes: ["会计师事务所"],
    verify: "待双端",
    licenseReg: "各国：注册会计师审计执业",
    trafficRank: "B端",
    controller: "RSM International（分国成员所）",
  },
  {
    region: "west",
    line: "agent",
    tier: "腰部",
    group: "Mazars｜玛泽｜Mazars（会计师事务所·全球）",
    brands: "玛泽 / Mazars",
    countries: "全球（含中国成员所口径）",
    languages: "英语/当地语",
    licenses: "审计与鉴证（分国执业）",
    timing: "全球网络持续运营",
    founded: "成立待核实",
    regulators: "各国会计监管",
    traffic: "审计/跨境报告",
    volume: "国际网络公开口径",
    users: "企业与金融机构",
    diandian: "公开信息",
    note: "国际网络所；欧洲与新兴市场跨境审计对照。",
    institutionTypes: ["会计师事务所"],
    verify: "待双端",
    licenseReg: "各国：注册会计师审计执业",
    trafficRank: "B端",
    controller: "Mazars network（分国成员所）",
  },
  // —— 律师事务所 ——
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "金杜律师事务所｜金杜｜金杜（律师事务所·CN）",
    brands: "金杜 / King & Wood Mallesons",
    countries: "中国/跨境（含澳洲等网络口径）",
    languages: "中文/英语",
    licenses: "律师执业",
    timing: "运营中",
    founded: "成立待核实",
    regulators: "司法行政/律协",
    traffic: "B端：金融/资本市场/争议解决",
    volume: "国内红圈所量级（公开排名口径）",
    users: "金融机构与企业",
    diandian: "公开信息",
    note: "红圈所。信贷/消金牌照申请、融资与争议解决对照。",
    institutionTypes: ["律师事务所"],
    verify: "仅监管",
    licenseReg: "CN：律师事务所",
    trafficRank: "B端",
    controller: "金杜律师事务所",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "中伦律师事务所｜中伦｜中伦（律师事务所·CN）",
    brands: "中伦 / Zhong Lun",
    countries: "中国/跨境",
    languages: "中文/英语",
    licenses: "律师执业",
    timing: "运营中",
    founded: "成立待核实",
    regulators: "司法行政/律协",
    traffic: "B端：金融与监管合规",
    volume: "国内红圈所量级",
    users: "金融机构与企业",
    diandian: "公开信息",
    note: "红圈所。持牌机构设立、股权融资与合规意见书对照。",
    institutionTypes: ["律师事务所"],
    verify: "仅监管",
    licenseReg: "CN：律师事务所",
    trafficRank: "B端",
    controller: "北京市中伦律师事务所",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "头部",
    group: "方达律师事务所｜方达｜方达（律师事务所·CN）",
    brands: "方达 / Fangda Partners",
    countries: "中国/跨境",
    languages: "中文/英语",
    licenses: "律师执业",
    timing: "运营中",
    founded: "成立待核实",
    regulators: "司法行政/律协",
    traffic: "B端：资本市场/私募与金融监管",
    volume: "国内红圈所量级",
    users: "金融机构与企业",
    diandian: "公开信息",
    note: "红圈所。跨境融资与金融监管事项对照。",
    institutionTypes: ["律师事务所"],
    verify: "仅监管",
    licenseReg: "CN：律师事务所",
    trafficRank: "B端",
    controller: "方达律师事务所",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "通力律师事务所｜通力｜通力（律师事务所·CN）",
    brands: "通力 / Llinks",
    countries: "中国",
    languages: "中文/英语",
    licenses: "律师执业",
    timing: "运营中",
    founded: "成立待核实",
    regulators: "司法行政/律协",
    traffic: "B端：银行与金融市场",
    volume: "精品金融所口径",
    users: "银行与非银",
    diandian: "公开信息",
    note: "金融精品所样本；银行间与非银融资文件对照。",
    institutionTypes: ["律师事务所"],
    verify: "待双端",
    licenseReg: "CN：律师事务所",
    trafficRank: "B端",
    controller: "通力律师事务所",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Clifford Chance｜高伟绅｜Clifford Chance（律师事务所·全球）",
    brands: "Clifford Chance / 高伟绅",
    countries: "全球",
    languages: "英语等",
    licenses: "律师执业（分国）",
    timing: "运营中",
    founded: "成立待核实",
    regulators: "各国律协",
    traffic: "B端：跨境金融与监管",
    volume: "魔圈所量级",
    users: "跨国金融机构",
    diandian: "公开信息",
    note: "国际魔圈所。跨境信贷、结构化与监管调查对照。",
    institutionTypes: ["律师事务所"],
    verify: "仅监管",
    licenseReg: "各国：律师执业",
    trafficRank: "B端",
    controller: "Clifford Chance",
  },
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Latham & Watkins｜瑞生｜Latham（律师事务所·全球）",
    brands: "Latham & Watkins / 瑞生",
    countries: "全球",
    languages: "英语等",
    licenses: "律师执业（分国）",
    timing: "运营中",
    founded: "成立待核实",
    regulators: "各国律协",
    traffic: "B端：融资/资本市场",
    volume: "国际大所量级",
    users: "跨国企业与金融机构",
    diandian: "公开信息",
    note: "国际大所；Fintech融资与跨境上市法律对照。",
    institutionTypes: ["律师事务所"],
    verify: "仅监管",
    licenseReg: "各国：律师执业",
    trafficRank: "B端",
    controller: "Latham & Watkins",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "SSEK｜SSEK Legal Consultants｜SSEK（律师事务所·ID）",
    brands: "SSEK Legal Consultants",
    countries: "印尼（雅加达；跨境事项另计）",
    languages: "英语/印尼语",
    licenses: "律师执业",
    timing: "运营中",
    founded: "成立待核实",
    regulators: "印尼律协/司法行政相关",
    traffic: "https://ssek.com/",
    volume: "印尼精品国际所口径",
    users: "跨国金融机构、Fintech、并购与监管项目方",
    diandian: "官网/公开排名",
    note: "雅加达精品所；银行/多金融/金融科技牌照、融资与争议解决对照样本。",
    institutionTypes: ["律师事务所"],
    verify: "仅监管",
    licenseReg: "ID：律师事务所",
    trafficRank: "B端",
    controller: "SSEK Legal Consultants",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "ABNR｜Ali Budiardjo Nugroho Reksodiputro｜ABNR（律师事务所·ID）",
    brands: "ABNR / Ali Budiardjo, Nugroho, Reksodiputro",
    countries: "印尼（雅加达；跨境事项另计）",
    languages: "英语/印尼语",
    licenses: "律师执业",
    timing: "运营中",
    founded: "1967",
    regulators: "印尼律协/司法行政相关",
    traffic: "https://www.abnrlaw.com/",
    volume: "印尼大型独立全服务所口径（约百余名法律专业人员公开叙事）",
    users: "跨国金融机构、Fintech、并购与监管项目方",
    diandian: "官网/公开排名",
    note: "雅加达老牌独立全服务所；银行/多金融/金融科技牌照、融资与资本市场法律对照样本（与 SSEK 并列，勿并档）。",
    institutionTypes: ["律师事务所"],
    verify: "仅监管",
    licenseReg: "ID：律师事务所",
    trafficRank: "B端",
    controller: "Ali Budiardjo, Nugroho, Reksodiputro (ABNR)",
  },
  // —— 评级机构 ——
  {
    region: "west",
    line: "agent",
    tier: "头部",
    group: "Moody's｜穆迪｜Moody's（评级机构·US）",
    brands: "Moody's",
    countries: "全球",
    languages: "英语",
    licenses: "信用评级机构",
    timing: "上市",
    regulators: "SEC等",
    traffic: "机构订阅",
    volume: "—",
    users: "机构投资者",
    diandian: "公开信息",
    note: "公开信息建档·主体/债项评级对照",
    institutionTypes: ["评级机构"],
    verify: "仅监管",
    licenseReg: "NRSRO等",
    trafficRank: "B端",
    equity: "NYSE: MCO",
    controller: "Moody's Corporation",
  },
  {
    region: "east-asia",
    line: "agent",
    tier: "腰部",
    group: "中诚信｜中诚信｜中诚信（评级机构·CN）",
    brands: "中诚信",
    countries: "中国",
    languages: "中文",
    licenses: "信用评级",
    timing: "运营中",
    regulators: "中国人民银行等",
    traffic: "机构",
    volume: "—",
    users: "机构",
    diandian: "公开信息",
    note: "公开信息建档·国内评级对照",
    institutionTypes: ["评级机构"],
    verify: "仅监管",
    licenseReg: "信用评级机构",
    trafficRank: "B端",
    controller: "中诚信",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "PEFINDO｜PEFINDO｜PEFINDO（评级机构·ID）",
    brands: "PEFINDO / PT Pemeringkat Efek Indonesia",
    countries: "印尼",
    languages: "印尼语/英语",
    licenses: "信用评级机构",
    timing: "运营中",
    founded: "1993",
    regulators: "OJK / 印尼资本市场相关",
    traffic: "https://www.pefindo.com/",
    volume: "印尼债市主流本地评级口径",
    users: "发行人、机构投资者、多金融/银行债项",
    diandian: "官网/监管可核验",
    note: "印尼本地信用评级龙头；多金融/债券发行对照。与同集团征信臂（Biro Kredit）分档，勿并成单一主体。",
    institutionTypes: ["评级机构"],
    verify: "仅监管",
    licenseReg: "ID：信用评级机构",
    trafficRank: "B端",
    controller: "PT Pemeringkat Efek Indonesia (PEFINDO)",
  },
  {
    region: "se-asia",
    line: "agent",
    tier: "头部",
    group: "TRIS｜TRIS Rating｜TRIS（评级机构·TH）",
    brands: "TRIS Rating",
    countries: "泰国",
    languages: "泰语/英语",
    licenses: "信用评级机构",
    timing: "运营中",
    founded: "成立待核实",
    regulators: "泰国证券交易委员会 SEC / 相关资本市场规则",
    traffic: "https://www.trisrating.com/",
    volume: "泰国债市主流本地评级口径",
    users: "发行人、机构投资者、消金/银行债项",
    diandian: "官网/公开披露",
    note: "泰国本地信用评级对照；AEONTS 等消金发债评级可交叉。",
    institutionTypes: ["评级机构"],
    verify: "仅监管",
    licenseReg: "TH：信用评级机构",
    trafficRank: "B端",
    controller: "TRIS Rating Company Limited",
  },
];

const paymentServiceSeeds: CreditDraft[] = PAYMENT_SERVICE_ROSTER.companies.map((c) => ({
  region: c.region as Exclude<Region, "all">,
  line: "agent" as const,
  tier: c.kind === "官方支付基建" ? ("头部" as const) : ("腰部" as const),
  group: c.group,
  brands: c.brands,
  countries: c.countries,
  languages: "当地语/英语",
  licenses: c.licenses,
  timing: "运营中",
  regulators: c.regulators,
  traffic: c.kind === "支付代理服务商" ? "商户API/收单" : "支付基建/钱包",
  volume: "—",
  users: c.kind === "支付代理服务商" ? "商户" : "公众/参与机构",
  diandian: "公开信息",
  note: `支付服务机构·${c.kind}·${PAYMENT_SERVICE_ROSTER.meta.as_of}样本；牌照待当地监管名录核验`,
  institutionTypes: ["支付服务机构"] as InstitutionType[],
  paymentKinds: [c.kind] as PaymentKind[],
  verify: "仅监管" as const,
  licenseReg: c.licenses,
  trafficRank: c.kind === "支付代理服务商" ? "偏B端" : "基建/C端",
  controller: c.controller,
}));

const credits: CreditRow[] = dedupeCreditRows(
  [
    ...creditsCore,
    ...expandCreditSeeds(creditCrmSeeds, "crm"),
    ...expandCreditSeeds(luffyCreditSeeds, "luffy"),
    ...ecoInstitutionSeeds,
    ...paymentServiceSeeds,
    ...equityInvestorSeeds,
  ]
    .map(finalizeCredit)
    .map(withEquityInvestorTagsOnCredit),
);

type VerifyFilter = "all" | VerifyStatus; // 仅用于信源核实展示态，不作筛选标签

function verifyTone(v: VerifyStatus): "success" | "warning" | "info" | "deleted" | "neutral" {
  if (v === "双端通过") return "success";
  if (v === "冲突观察") return "deleted";
  if (v === "仅流量" || v === "仅监管") return "warning";
  if (v === "〔1〕") return "neutral";
  return "info";
}

function filterScenes(
  region: Region,
  country: CountryFilter,
  sceneTag: SceneTag | "all",
  sceneSub: SceneSubTag | "all",
  licenseKind: LicenseKind | "all",
  langZone: LangZoneFilter = "all",
): SceneRow[] {
  return scenes.filter((r) => {
    if (region !== "all" && r.region !== region) return false;
    if (!matchesLanguageZoneFilter(r.group, r.countries, langZone)) return false;
    if (!matchesCountryFilter(r.group, r.countries, country)) return false;
    if (sceneTag !== "all" && !r.tags.includes(sceneTag)) return false;
    if (sceneSub !== "all" && !r.subTags.includes(sceneSub)) return false;
    if (licenseKind !== "all" && !r.licenseKinds.includes(licenseKind)) return false;
    return true;
  });
}

function filterCredits(
  region: Region,
  country: CountryFilter,
  creditL1: CreditProdL1,
  creditL2: CreditProdL2,
  creditL3: CreditProdL3,
  sceneTag: SceneTag | "all",
  licenseKind: LicenseKind | "all",
  langZone: LangZoneFilter = "all",
): CreditRow[] {
  return credits.filter((r) => {
    if (region !== "all" && r.region !== region) return false;
    if (!matchesLanguageZoneFilter(r.group, r.countries, langZone)) return false;
    if (!matchesCountryFilter(r.group, r.countries, country)) return false;
    if (!matchesCreditProductTree(r, creditL1, creditL2, creditL3)) return false;
    // 信贷原生玩家也可按「涉足场景」筛：目前多数无场景标签，仅信用管理横切可命中（映射信贷「信用卡」标签）
    if (sceneTag !== "all") {
      if (sceneTag === "信用管理") {
        if (!r.tags.includes("信用卡")) return false;
      } else {
        return false;
      }
    }
    if (licenseKind !== "all" && !r.licenseKinds.includes(licenseKind)) return false;
    return true;
  });
}

/** 关键词检索：空格分词全命中；统一中文拼音首字母模糊（smy→萨摩耶、kn→快牛）+ 品牌别名 */
const BRAND_SEARCH_ALIASES: Record<string, string[]> = {
  快牛: ["kn", "kuaniu", "kua niu", "mexicash", "快牛智能", "knzn"],
  萨摩耶: ["smy", "samoye", "sa mo ye"],
  奇富: ["qf", "qfin", "360数科"],
  乐信: ["lx", "lexin", "fortaprest"],
  信也: ["xy", "finvolution", "ppdai", "拍拍贷"],
  马上: ["ms", "msxf"],
  度小满: ["dxm"],
  蚂蚁: ["my", "ant", "alipay"],
  美团: ["mt", "meituan"],
  京东: ["jd"],
  滴滴: ["dd", "didi"],
  易鑫: ["yx", "yixin"],
  爱租机: ["azj"],
  人人租: ["rrz"],
  招联: ["zl"],
  数禾: ["sh", "还呗", "hb"],
  中科金: ["zkj"],
  华融: ["中信金融资产", "citic financial assets", "hr"],
  中信金融资产: ["华融", "citic amc"],
  信达: ["cinda", "xd"],
  东方资产: ["东方", "coamc"],
  长城资产: ["长城", "gwamc"],
  普华永道: ["pwc", "pwh"],
  德勤: ["deloitte", "dq"],
  安永: ["ey", "ernst"],
  毕马威: ["kpmg", "bwm"],
  立信: ["bdo立信", "lixin"],
  天健: ["tianjian", "tj"],
};

/** 压缩表：汉字+首字母交替；覆盖本图谱全部用字 */
const CJK_PINYIN_PACK =
  "一y丁d七q万w三s上s下x不b与y专z且q世s业y东d两l严y个g中z串c为w主z丽l举j久j么m义y之z乌w乎h乐l也y习x书s买m了l争z事s二e于y云y互h五w亚y交j亦y产c享x京j亲q人r亿y仅j今j介j仍r从c仓c他t付f代d以y件j价j任r份f仿f企q伊y众z优y伙h会h伟w传c伦l估g伴b伽g但d位w低d住z体t余y作z你n佳j使s例l供g依y侧c侨q便b俗s保b信x借j债z值z偏p做z停t健j储c催c像x僧s元y充c先x光g克k免m兑d入r全q公g六l兰l共g关g兴x其q具j典d兹z兼j内n册c再z冒m写x农n冲c决j况k净j准z凭p出c击j刀d分f切q划h列l则z创c初c判p利l别b到d制z券q前q剩s力l办b功g加j务w动d助z励l劳l势s募m勿w包b化h北b匹p区q医y十s千q升s半b华h协x单d卖m南n占z卡k卢l印y危w即j厅t历l压y原y去q参c叉c及j双s反f发f取q受s变b叙x叠d口k古g另l只z叫j叮d可k台t史s右y叶y号h司s吃c各g合h吉j吊d同t名m后h向x否f吧b含h听t启q吴w吸x告g呗b员y呢n呼h命m和h咚d咨z品p哈h哥g售s唯w商s啰l善s喜x嗒d嘀d嘉j器q四s回h因y团t园y固g国g图t土t在z地d场c均j坊f块k坛t坡p坦t垂c垄l型x埃a城c域y培p基j堂t塔t填t境j增z墨m士s壳k壹y处c备b复f外w多d大d天t太t央y头t夹j奇q奈n契q奖j套t好h如r始s委w威w娱y婚h媒m子z字z存c孟m季j学x宁n宇y安a完w宏h官g宙z定d宜y宝b实s审s客k宣x家j容r宽k宾b宿s密m富f察c寡g对d寺s导d寿s射s将j小x少s尔e尚s尼n尽j尾w局j层c居j屋w展z属s山s岳y岸a峰f崩b嵌q州z工g巨j巩g已y巴b币b市s布b师s希x帐z带d席x帮b常c幅f干g平p年n并b幻h广g序x库k应y店d府f度d康k廊l廷t建j开k异y式s引y张z弱r强q归g当d录l形x影y征z径j待d律l得d循x微w德d心x必b快k忽h态t思s性x总z恋l恒h息x悦y情q想x意y慎s慢m戏x成c我w或h战z截j户h房f所s手s打d托t执z扩k批p找z承c技j把b投t抖d抗k折z护h报b披p抵d押y担d拆c拉l拍p拓t招z拟n择z括k拼p拿n持c挂g指z按a挑t挖w换h据j捷j授s掉d排p探t接j控k推t描m提t揭j搜s搭d携x摘z摩m播b撮c操c支z收s改g放f政z教j数s整z文w斗d料l断d斯s新x方f施s旅l旗q无w既j日r旦d旧j早z时s旺w明m易y星x映y是s显x普p景j晰x智z暂z暴b更g曹c曼m曾c替t最z月y有y服f期q木m未w末m本b术s朴p机j权q杆g材c村c杜d束s杠g条t来l板b极j构g析x林l枚m果g枝z架j某m查c标b栈z栏l树s校x样y核h根g格g框k案a桑s桔j档d桥q梦m梯t检j榜b樊f模m横h次c欧o欺q款k止z正z此c段d母m比b民m水s永y求q汇h汉h池c汽q沃w沙s法f泛f泡p波b注z泰t洁j洋y洲z活h派p流l测c济j浏l海h消x涉s润r涨z淆x淘t深s混h添t清q渠q港g游y湖h湾w溃k源y溢y滑h满m滤l滴d漏l演y澳a灣w火h灰h灼z点d然r照z熟s爱a片p版b牌p牙y牛n物w特t状z独d狮s猪z猫m猿y率l王w玛m玩w环h现x珍z班b球q理l瑞r瓣b瓦w瓴l生s用y由y甲j申s电d画h留l略l疆j疑y疗l病b登d白b百b的d益y盐y监j盒h盖g盘p盟m目m直z相x盾d看k真z眼y着z督d知z矩j短d石s矿k码m研y础c硬y确q碑b示s礼l社s神s票p禁j禄l离l禾h私s种z科k秘m租z积j称c移y稀x程c税s稳w稿g穆m空k穿c突t立l站z竞j端d笔b第d等d策c筛s签q简j算s管g米m类l粉f粗c粘z精j糖t系x素s索s累l红h约y级j纪j纯c纳n线x练l组z绅s细x经j结j给g络l绝j统t继j续x维w综z缓h编b缘y缩s缺q罐g网w罗l置z署s美m群q耀y考k者z而e耕g耳e耶y聆l职z联l聚j股g肯k育y胀z背b能n脉m脏z腰y腾t臂b自z至z航h般b良l色s艺y节j芝z花h苏s若r英y苹p范f草c荐j荔l荣r药y荷h莱l获h菜c菱l菲f萄t营y萨s落l葡p蒙m蓄x蓝l藏c虎h虚x蚁y蚂m蜂f融r行h衍y补b表b衰s被b装z西x要y覆f见j观g规g视s览l角j解j触c言y話h计j订d认r训x议y讯x记j许x论l设s证z评p识s诈z诉s诊z词c译y试s诚c询x详x语y误w说s请q读d课k调d谈t谱p豆d贝b负f财c责z账z货h质z贬b购g贴t贷d贸m费f赁l资z赋f赏s赚z赛s赢y赤c走z赶g起q超c越y趣q足z跃y跌d跑p跟g跨k路l跳t身s车c转z轮l软r轻q载z辅f辆l辑j输s达d迁q过g运y近j返f还h进j违w连l迪d述s追z退t送s适s逆n选x逊x逐z途t通t速s逻l逼b道d遭z避b邦b邮y邻l部b都d酋q配p酒j酷k采c里l重z量l金j鑫x钉d钥y钱q银y铺p链l销x锁s锋f锚m锥z键j长z门m闪s闭b问w闲x间j闻w阅y队d阳y阵z阿a附f际j陆l陌m降j限x院y除c险x陪p随s隐y隶l雄x雅y集j零l需x露l青q静j非f靠k韩h音y页y顶d项x顺s须x顾g预y领l频p额e风f飞f餐c饮y饱b饿e首s香x马m驱q驾j验y高g魔m鱼y鲁l鲜x鸟n鹅e麦m麻m黑h默m齐q龙l龥y";

const CJK_PINYIN_INITIAL: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (let i = 0; i < CJK_PINYIN_PACK.length; i += 2) {
    m[CJK_PINYIN_PACK[i]] = CJK_PINYIN_PACK[i + 1];
  }
  return m;
})();

function cjkInitials(text: string): string {
  let out = "";
  for (const ch of text) {
    if (/[a-zA-Z0-9]/.test(ch)) {
      out += ch.toLowerCase();
      continue;
    }
    const ini = CJK_PINYIN_INITIAL[ch];
    if (ini) out += ini;
  }
  return out;
}

function extractSearchableCnRuns(blob: string): string[] {
  const out: string[] = [];
  for (const seg of blob.match(/[\u4e00-\u9fff][\u4e00-\u9fffa-zA-Z0-9]{0,15}/g) ?? []) {
    if (/[\u4e00-\u9fff]/.test(seg)) out.push(seg);
  }
  return out;
}

function extractCnBrandTokens(...fields: (string | undefined | null)[]): string[] {
  const blob = fields.filter(Boolean).join("\n");
  const out: string[] = [];
  const parenRe = /[（(]([^）)]+)[）)]/g;
  let m: RegExpExecArray | null;
  while ((m = parenRe.exec(blob)) !== null) {
    const head = m[1].split(/[·・/|/]/)[0].trim();
    if (/[\u4e00-\u9fff]/.test(head)) out.push(head);
  }
  for (const brand of Object.keys(BRAND_SEARCH_ALIASES)) {
    if (blob.includes(brand)) out.push(brand);
  }
  out.push(...extractSearchableCnRuns(blob));
  return [...new Set(out.filter((x) => x.length >= 2))];
}

function buildSearchHaystack(...fields: (string | undefined | null)[]): string {
  const base = fields.filter(Boolean).join("\n").toLowerCase();
  const extras: string[] = [];
  const initials: string[] = [];
  for (const brand of extractCnBrandTokens(...fields)) {
    extras.push(brand.toLowerCase());
    const ini = cjkInitials(brand);
    if (ini.length >= 2) {
      extras.push(ini);
      initials.push(ini);
    }
    const aliases = BRAND_SEARCH_ALIASES[brand];
    if (aliases) extras.push(...aliases.map((a) => a.toLowerCase()));
  }
  for (const w of base.match(/[a-z][a-z0-9._-]{1,24}/g) ?? []) extras.push(w);
  extras.push(`__ini__:${initials.join("|")}`);
  return `${base}\n${extras.join("\n")}`;
}

function matchesKeyword(q: string, ...fields: (string | undefined | null)[]): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const tokens = needle.split(/\s+/).filter(Boolean);
  const hay = buildSearchHaystack(...fields);
  const iniBag = (hay.match(/__ini__:(.*)/)?.[1] ?? "").split("|").filter(Boolean);
  return tokens.every((t) => {
    if (hay.includes(t)) return true;
    // 别名反查（精确）：搜 mexicash / knzn / 快牛智能 → 命中含「快牛」的主体
    for (const [brand, aliases] of Object.entries(BRAND_SEARCH_ALIASES)) {
      const keys = [brand.toLowerCase(), ...aliases.map((a) => a.toLowerCase())];
      if (!keys.includes(t)) continue;
      if (keys.some((k) => hay.includes(k))) return true;
    }
    // 纯字母：按拼音首字母全等或前缀（smy / sm → 萨摩耶）；单字母过宽，要求 ≥2
    if (/^[a-z]{2,12}$/.test(t)) {
      return iniBag.some((ini) => ini === t || (t.length >= 2 && ini.startsWith(t)));
    }
    return false;
  });
}

/** 搜索排序：越小越靠前。0=品牌/集团名首段精确，1=核心字段含子串，2=其它字段/别名命中 */
function keywordRelevanceRank(q: string, ...fields: (string | undefined | null)[]): number {
  const needle = q.trim().toLowerCase();
  if (!needle) return 9;
  const core = fields
    .slice(0, 3)
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  const head = (fields[0] || "").toString().split(/[｜|/]/)[0]?.trim().toLowerCase() || "";
  if (head === needle || head.startsWith(needle)) return 0;
  if (core.includes(needle)) return 1;
  if (matchesKeyword(q, ...fields)) return 2;
  return 9;
}

function sceneMatchesKeyword(r: SceneRow, q: string): boolean {
  return matchesKeyword(
    q,
    r.group,
    r.apps,
    r.sceneType,
    r.licenseReg,
    r.equity,
    r.controller,
    r.trafficRank,
    r.countries,
    r.creditAttach,
    r.diandian,
    ...r.tags,
  );
}

function creditMatchesKeyword(r: CreditRow, q: string): boolean {
  return matchesKeyword(
    q,
    r.group,
    r.brands,
    r.licenses,
    r.licenseReg,
    r.note,
    r.equity,
    r.controller,
    r.diandian,
    r.volume,
    r.regulators,
    r.countries,
    r.line,
    r.timing,
    r.traffic,
    r.users,
    ...r.tags,
    ...r.institutionTypes.map((t) => INSTITUTION_TYPE_LABEL[t]),
    ...(r.fundKinds ?? []).map((k) => FUND_KIND_LABEL[k]),
    ...(r.paymentKinds ?? []).map((k) => PAYMENT_KIND_LABEL[k]),
    ...(r.equityKinds ?? []).map((k) => EQUITY_KIND_LABEL[k]),
  );
}

/** 国别宏观：国名/别名/ISO 码 + 快照文案可检索 */
function macroCountryMatchesKeyword(code: Exclude<CountryCode, "all">, q: string): boolean {
  const snap = COUNTRY_MACRO[code];
  return matchesKeyword(
    q,
    code,
    COUNTRY_LABEL[code],
    ...(COUNTRY_ALIASES[code] ?? []),
    snap?.asOf,
    snap?.gdpYoY,
    snap?.policyRate,
    snap?.inflation,
    snap?.cashLoanVerdict,
    snap?.creditNote,
  );
}

/** 创设玩家导入附件（Cursor 式 Composer 附件条） */
type ComposerAttach = {
  id: string;
  kind: "link" | "doc" | "image" | "text";
  label: string;
};

function looksLikeCreatePlayerIntent(text: string): boolean {
  return /创设|创建|新建|录入|建档|添加玩家|新增玩家|想要创设/.test(text.trim());
}

function extractCreatedPlayerName(text: string): string {
  const t = text.trim();
  const patterns = [
    /[-—–]\s*([^\s，,。；;（(/]{2,40})/,
    /(?:叫|名为|名称[是为]?)\s*([^\s，,。；;（(]{2,40})/,
    /公司[：:\s]*([^\s，,。；;（(]{2,40})/,
    /(?:创设|创建|新建|录入|建档)[^，,]{0,24}?([一-龥A-Za-z0-9·]{2,24}(?:集团|公司|科技|控股|金服|金融)?)/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m?.[1]) {
      let name = m[1].replace(/[的了呢吧]$/u, "").trim();
      name = name.replace(/^(一个|一家|一名)/, "");
      if (name.length >= 2 && !/融资租赁|汽车金融|上市公司|持有/.test(name)) return name;
    }
  }
  return "";
}

function draftFromComposerCreate(
  text: string,
  attachments: ComposerAttach[],
): CreditDraft | null {
  if (!looksLikeCreatePlayerIntent(text)) return null;
  const name = extractCreatedPlayerName(text);
  if (!name) return null;

  const blob = `${text} ${attachments.map((a) => a.label).join(" ")}`;
  const inChina = /中国|CN\b|内地/.test(blob);
  const region: Exclude<Region, "all"> = inChina
    ? "east-asia"
    : /印尼|东南亚|菲律宾|越南|马来|泰国|新加坡/.test(blob)
      ? "se-asia"
      : /印度/.test(blob)
        ? "south-asia"
        : /巴西|墨西哥|拉美/.test(blob)
          ? "latam"
          : "east-asia";
  const countries = inChina
    ? "中国"
    : /印尼|印度尼西亚/.test(blob)
      ? "印度尼西亚"
      : "待核实";
  const line: CreditRow["line"] = /融资租赁|信用租赁|租机|汽车金融|车贷|租赁/.test(blob)
    ? "lease"
    : /分期|BNPL|消费贷/.test(blob)
      ? "bnpl"
      : /超市|导流|助贷平台/.test(blob)
        ? "agent"
        : "cash";
  const listed = /上市|HKEX|港股|A股|NYSE|NASDAQ|股票/.test(blob);
  const leaseLic = /融资租赁/.test(blob);
  const short = name.replace(/(集团|公司|控股)$/u, "") || name;
  const group = `${name}/${short}（${short}·${inChina ? "CN" : "XX"}）`;
  const attNote = attachments.length
    ? `；附件：${attachments.map((a) => `${a.kind}:${a.label}`).join(" | ")}`
    : "";

  return {
    region,
    line,
    tier: "腰部",
    group,
    brands: short,
    countries,
    languages: inChina ? "中文" : "待核实",
    licenses: leaseLic ? "融资租赁牌照（录入自述）" : "牌照待核实（录入自述）",
    timing: "人工创设",
    regulators: inChina ? "地方金融监管/银保监路径待核" : "待核实",
    traffic: "待核实",
    volume: "待核实",
    users: "待核实",
    diandian: "人工创设〔1〕核实",
    note: `Composer 创设：${text.trim().slice(0, 180)}${attNote}`,
    institutionTypes: ["玩家"],
    licenseReg: leaseLic
      ? `已持：融资租赁(${countries === "中国" ? "中国" : countries})`
      : "牌照：待核实",
    licenseKinds: leaseLic ? ["其他"] : [],
    equity: listed ? "上市公司（录入自述；代码待核）" : "待核实",
    controller: name,
    trafficRank: "人工创设",
    verify: "待双端",
  };
}

type SpeechRecLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onend: (() => void) | null;
};

let activeSpeechRec: SpeechRecLike | null = null;

function pickLocalFiles(
  accept: string,
  onPick: (files: { name: string; size: number }[]) => void,
): string | null {
  try {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = true;
    input.onchange = () => {
      onPick(Array.from(input.files ?? []).map((f) => ({ name: f.name, size: f.size })));
    };
    input.click();
    return null;
  } catch {
    return "无法打开文件选择器，请改用粘贴链接";
  }
}

function toggleVoiceDictation(
  onChunk: (text: string) => void,
  setListening: (v: boolean) => void,
): string | null {
  const g = globalThis as unknown as {
    SpeechRecognition?: new () => SpeechRecLike;
    webkitSpeechRecognition?: new () => SpeechRecLike;
  };
  const SR = g.SpeechRecognition ?? g.webkitSpeechRecognition;
  if (!SR) {
    setListening(false);
    return "当前环境不支持语音录入";
  }
  if (activeSpeechRec) {
    try {
      activeSpeechRec.stop();
    } catch {
      /* ignore */
    }
    activeSpeechRec = null;
    setListening(false);
    return null;
  }
  const rec = new SR();
  rec.lang = "zh-CN";
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (ev) => {
    const t = ev.results[ev.results.length - 1]?.[0]?.transcript?.trim();
    if (t) onChunk(t);
  };
  rec.onerror = () => {
    activeSpeechRec = null;
    setListening(false);
  };
  rec.onend = () => {
    activeSpeechRec = null;
    setListening(false);
  };
  activeSpeechRec = rec;
  setListening(true);
  try {
    rec.start();
  } catch {
    activeSpeechRec = null;
    setListening(false);
    return "无法启动麦克风";
  }
  return null;
}

/**
 * Cursor Composer 风格输入条：
 * + 附件｜主输入｜Auto(暂不可用)｜语音｜发送
 * 用于首页关键词检索，附件作为创设玩家信息导入。
 */
function CursorStyleComposer({
  value,
  onChange,
  onSubmit,
  sideSlot,
}: {
  value: string;
  onChange: (v: string) => void;
  /** 返回状态文案；由上层决定检索或创设 */
  onSubmit: (payload: { text: string; attachments: ComposerAttach[] }) => string;
  /** 贴在搜索框右侧，高度与搜索框对齐（地图/对照/信源） */
  sideSlot?: ReactNode;
}) {
  const theme = useHostTheme();
  const [menuOpen, setMenuOpen] = useCanvasState("cPlus1", false);
  const [linkVal, setLinkVal] = useCanvasState("cLink1", "");
  const [atts, setAtts] = useCanvasState<ComposerAttach[]>("cAtt1", EMPTY_COMPOSER_ATTS);
  const [listening, setListening] = useCanvasState("cVoice1", false);
  const [status, setStatus] = useCanvasState("cStat1", "");

  function pushAtt(kind: ComposerAttach["kind"], label: string) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setAtts((prev) => [{ id, kind, label }, ...prev].slice(0, 20));
  }

  const createHint = looksLikeCreatePlayerIntent(value);

  return (
    <Stack gap={8}>
      {atts.length ? (
        <Row gap={6} wrap>
          {atts.map((a) => (
            <Pill
              size="sm"
              active
              onClick={() => setAtts((prev) => prev.filter((x) => x.id !== a.id))}
            >
              {a.kind === "link"
                ? "链接"
                : a.kind === "doc"
                  ? "文档"
                  : a.kind === "image"
                    ? "图片"
                    : "文本"}
              · {a.label.length > 28 ? `${a.label.slice(0, 28)}…` : a.label} ×
            </Pill>
          ))}
        </Row>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: 8,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div
          style={mergeStyle({
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "4px 0",
            background: "transparent",
            boxSizing: "border-box",
          })}
        >
          <TextInput
            value={value}
            onChange={onChange}
            placeholder="搜索机构；或写「创设…玩家名」建档（可附链接/文档/图片）"
            type="text"
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
            }}
          />

          <Row gap={6} align="center">
            <IconButton
              title="添加附件"
              variant="circle"
              size="md"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path
                  d="M7 2.5v9M2.5 7h9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </IconButton>

            <div style={{ flex: 1 }} />

            <Text size="small" tone="tertiary">
              Auto
            </Text>

            <IconButton
              title={listening ? "停止语音" : "语音录入"}
              variant="circle"
              size="md"
              onClick={() => {
                const err = toggleVoiceDictation((t) => onChange(t), setListening);
                setStatus(err ?? (listening ? "" : "聆听中…再点麦克风结束"));
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <rect
                  x="5"
                  y="1.5"
                  width="4"
                  height="7"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
                <path
                  d="M3 7a4 4 0 0 0 8 0M7 11v1.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
            </IconButton>

            <IconButton
              title={listening ? "停止" : createHint ? "创设玩家" : "搜索"}
              variant="circle"
              size="md"
              onClick={() => {
                if (listening) {
                  toggleVoiceDictation(() => {}, setListening);
                  setStatus("");
                  return;
                }
                const msg = onSubmit({ text: value, attachments: atts });
                setStatus(msg);
                if (looksLikeCreatePlayerIntent(value) && msg.startsWith("已创设")) {
                  setAtts([]);
                }
              }}
            >
              {listening ? (
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                  <rect x="2" y="2" width="6" height="6" rx="1" fill="currentColor" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path
                    d="M3 7h7.5M7.2 3.8 10.5 7 7.2 10.2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </IconButton>
          </Row>
        </div>

        {sideSlot ? (
          <div
            style={{
              flexShrink: 0,
              width: 88,
              position: "relative",
              /* 不贡献高度：由搜索框决定行高，再 stretch 填满 */
              alignSelf: "stretch",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {sideSlot}
            </div>
          </div>
        ) : null}
      </div>

      {menuOpen ? (
        <div
          style={mergeStyle({
            padding: 12,
            borderRadius: 10,
            background: theme.bg.elevated,
            border: `1px solid ${theme.stroke.tertiary}`,
          })}
        >
          <Stack gap={10}>
            <Text size="small" weight="medium">
              添加上下文 · 创设玩家导入
            </Text>
            <Text size="small" tone="secondary">
              对齐 Cursor Composer：先挂链接/文档/图片，再在输入框描述或检索。移动端可用语音。
            </Text>
            <Row gap={8} wrap>
              <div style={{ flex: 1, minWidth: 160 }}>
                <TextInput
                  value={linkVal}
                  onChange={setLinkVal}
                  placeholder="粘贴链接 https://…"
                  type="url"
                />
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  const u = linkVal.trim();
                  if (!u) {
                    setStatus("请先粘贴链接");
                    return;
                  }
                  pushAtt("link", u);
                  setLinkVal("");
                  setStatus("已添加链接");
                }}
              >
                添加链接
              </Button>
            </Row>
            <Row gap={8} wrap>
              <Button
                variant="secondary"
                onClick={() => {
                  const err = pickLocalFiles(".pdf,.doc,.docx,.txt,.md,.csv", (files) => {
                    for (const f of files) pushAtt("doc", f.name);
                    setStatus(files.length ? `已添加 ${files.length} 个文档` : "");
                  });
                  if (err) setStatus(err);
                }}
              >
                文档
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const err = pickLocalFiles("image/*", (files) => {
                    for (const f of files) pushAtt("image", f.name);
                    setStatus(files.length ? `已添加 ${files.length} 张图片` : "");
                  });
                  if (err) setStatus(err);
                }}
              >
                图片
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (!value.trim()) {
                    setStatus("先在输入框写下线索");
                    return;
                  }
                  pushAtt("text", value.trim().slice(0, 60));
                  setStatus("已收录文本线索");
                }}
              >
                收录当前输入
              </Button>
            </Row>
          </Stack>
        </div>
      ) : null}

      {status ? (
        <Text size="small" tone="tertiary">
          {status}
        </Text>
      ) : null}
    </Stack>
  );
}


/** 全球公开市场：线上场景信贷资产 ABS·ABN·ABT/资产支持计划（不限现金贷）
 * 覆盖：现金贷、消费分期/BNPL、信用卡/分期、车贷、信用租赁、小微线上贷等（公募+私募公开可核验口径）
 */
type AbsSecNote = {
  /** group 名子串匹配（任一命中即挂到该玩家详情） */
  match: string[];
  /** 资产大类标签（详情标题旁展示） */
  kinds: string;
  /** 详情文案：规模/产品线 + 时点 + 出处 */
  text: string;
};

/**
 * 市场背景（多资产）：
 * ·中国2025消费贷ABS（含个人消费贷+信用卡分期ABS统计口径）：联合资信约4650.84亿元/+35%；交易所约2324.60亿、ABN约2003.47亿、信贷ABS约322.77亿。
 * ·中国2025信贷ABS中：车贷ABS约1185.43亿元（联合资信《2025年ABS市场分析》）；信用卡分期ABS约9.39亿元（中国金融信息网发展报告口径）。
 * ·中国2025 ABN：消费类约1935.27亿、小微贷约1039.30亿、融资租赁约739.48亿（同上）。
 * ·美国：信用卡主信托公募连发；BNPL/分期与无抵押消费贷ABS见Affirm/SoFi/Upstart等。
 * ·中国债券交叉：银行间ABN/债务融资工具披露优先核验中国货币网（CHINAMONEY_BOND）；与联合资信/交易所口径冲突时标「〔1〕」。
 */

const ABS_SECURITIZATION_NOTES: AbsSecNote[] = [
  // —— 中国·消费分期/BNPL/场景消费贷（含花呗白条月付等，非仅现金贷）——
  {
    match: ["京东消金", "京东/白条", "京东集团/京东"],
    kinds: "消费分期/BNPL·白条 + 消费贷ABS/ABN",
    text:
      "线上场景：京东白条/消费分期及关联消费贷为主要出表资产。2025年京东系约占国内消费贷ABS总发行规模33.36%；作为发起机构约527.95亿元/54单。ABN侧「京东系列」为头部供给。时点：2025。出处：联合资信《2025年消费贷ABS市场回顾与展望》；标普信评等亦列京东系列。",
  },
  {
    match: ["蚂蚁消金", "蚂蚁/花呗", "蚂蚁集团/支付宝"],
    kinds: "消费分期/BNPL·花呗 + 消费贷ABS/ABN/ABCP",
    text:
      "线上场景：花呗/借呗等分期与消费贷。2025年蚂蚁系约占消费贷ABS总规模18.53%；ABN「蚂蚁消金系列」发行活跃（标普信评等称ABN蚂蚁消金系列占比突出，有材料称约46.85%量级——以该报告口径为准）。时点：2025。出处：联合资信；惠誉博华ABN/ABCP观察；标普信评消费贷ABS观察。",
  },
  {
    match: ["腾讯/分付", "腾讯控股/微信", "财付通"],
    kinds: "消费分期·分付/信用卡合作 + 消费贷ABS/ABN",
    text:
      "线上场景：分付等分期/信贷入口及财付通小贷资产。2025年腾讯系约占消费贷ABS总规模13.93%；ABN「财付通小贷系列」为公开列示供给方。时点：2025。出处：联合资信；标普信评。",
  },
  {
    match: ["美团/美团月付", "美团（美团·CN）"],
    kinds: "消费分期/BNPL·月付 + 消费贷ABS/ABN",
    text:
      "线上场景：美团月付等本地生活分期。联合资信2025列「美团」为互联网资产供应方；ABN「美团系列」公开列示。单体亿元数待Wind逐单。时点：2025。出处：联合资信；标普信评。",
  },
  {
    match: ["字节跳动/抖音月付", "抖音月付", "抖音（抖音·CN）"],
    kinds: "消费分期/BNPL·月付",
    text:
      "线上场景：抖音月付等电商/直播分期。公开消费贷ABS供应方头部名单以京东/蚂蚁/腾讯为主，抖音月付是否独立系列以Wind/中登网逐单为准。时点：待补。出处：待Wind交叉。",
  },
  {
    match: ["度小满", "有钱花"],
    kinds: "消费贷/场景分期ABS/ABN",
    text:
      "线上信贷：度小满/有钱花。联合资信2025互联网资产方名单列示。时点：2025。出处：联合资信。",
  },
  {
    match: ["奇富", "奇富小贷", "Qfin"],
    kinds: "现金贷/助贷资产ABS/ABN",
    text:
      "线上现金贷/助贷资产经信托出表。联合资信2025列「奇富小贷」。时点：2025。出处：联合资信。",
  },
  {
    match: ["唯品花", "唯品会"],
    kinds: "电商分期/BNPL ABS",
    text:
      "线上电商分期（唯品花）。是否有独立ABS/ABN系列以交易所/Wind逐单为准；同属互联网消费分期资产池常见供给类型。时点：待补。出处：待Wind。",
  },
  {
    match: ["苏宁任性付", "苏宁"],
    kinds: "电商分期ABS",
    text:
      "线上电商分期（任性付）。历史有消费分期ABS实践；2024–2025新发以Wind为准。时点：待补。出处：待Wind/评级稿。",
  },
  {
    match: ["携程拿去花", "携程"],
    kinds: "场景分期（酒旅）ABS/ABN",
    text:
      "线上酒旅场景分期。联合资信2025名单列「携程」。时点：2025。出处：联合资信。",
  },
  {
    match: ["桔子分期", "桔子数字"],
    kinds: "消费分期ABS",
    text:
      "线上消费分期。历史多期交易所消费分期ABS；近年新发节奏以Wind为准。时点：待补最新单。出处：待Wind/中登网。",
  },
  {
    match: ["乐信", "分期乐", "Lexin"],
    kinds: "消费分期/助贷ABS/ABN",
    text:
      "线上分期乐等分期资产可经信托ABS/ABN。2025互联网供应前三为京东/蚂蚁/腾讯，乐信未进该报告前三行；逐单待Wind。时点：2025。出处：联合资信；待Wind。",
  },
  {
    match: ["招联"],
    kinds: "消金·消费贷/信用卡分期ABS",
    text:
      "持牌消金：银行间信贷ABS（消费贷；亦可含卡分期资产，视当期基础资产披露）。2025消金与商业银行合计主导信贷ABS消费贷档约323亿元量级。招联单体待央行名录交叉。时点：2025。出处：联合资信；标普信评。",
  },
  {
    match: ["马上", "中科金（中科金·CN）"],
    kinds: "消金·消费贷/分期ABS",
    text:
      "持牌消金「马上消金」：联合资信2025消金发行名单列示。银行间消费贷ABS。时点：2025。出处：联合资信。",
  },
  {
    match: ["中原消费", "中原银行｜中原消费"],
    kinds: "消金·消费贷ABS",
    text:
      "持牌消金「中原消金」：联合资信2025名单列示。时点：2025。出处：联合资信。",
  },
  {
    match: ["海尔消金"],
    kinds: "消金·消费贷/场景分期ABS",
    text:
      "持牌消金「海尔消金」：联合资信2025名单列示。时点：2025。出处：联合资信。",
  },
  {
    match: ["众安"],
    kinds: "互联网小贷·消费贷ABS",
    text:
      "2025新增「众安小贷」等发起机构叙事。时点：2025。出处：联合资信。",
  },
  {
    match: ["宁银消金"],
    kinds: "消金·消费贷ABS",
    text: "联合资信2025消金名单列示「宁银消金」。时点：2025。出处：联合资信。",
  },
  {
    match: ["南银法巴"],
    kinds: "消金·消费贷ABS",
    text: "联合资信2025消金名单列示「南银法巴消金」。时点：2025。出处：联合资信。",
  },
  {
    match: ["温州银行"],
    kinds: "银行·消费贷/信用卡分期ABS",
    text:
      "商业银行银行间消费贷ABS活跃发行人（2025）。信用卡分期ABS为银行间单独小品种（全市场约9.39亿元量级，中金信息网口径）。时点：2025。出处：标普信评；联合资信；中国金融信息网ABS发展报告。",
  },
  {
    match: ["宁波银行"],
    kinds: "银行·消费贷ABS",
    text: "联合资信2025商业银行名单列示「宁波银行」。时点：2025。出处：联合资信。",
  },
  {
    match: ["中信信托"],
    kinds: "信托通道·消费分期/消费贷ABS/ABN",
    text:
      "通道：2025中信信托消费贷ABS约675.00亿元/66单（多为互联网分期与消费贷资产）。时点：2025。出处：联合资信。",
  },
  {
    match: ["外贸信托", "中国对外经济贸易信托"],
    kinds: "信托通道·消费贷/分期ABS/ABN",
    text:
      "通道：2025外贸信托为消费贷ABS头部信托承做人之一。时点：2025。出处：联合资信；标普信评。",
  },

  // —— 中国·车贷 / 汽车金融 ABS（线上申请+经销商场景常见）——
  {
    match: ["大众汽金", "大众汽车金融"],
    kinds: "车贷ABS",
    text:
      "汽车金融公司：个人汽车贷款ABS为2025信贷ABS第一大品种（全市场车贷ABS约1185.43亿元）。主机厂/汽金为典型发起人；大众汽金等公开市场常发车贷ABS，单体以中债/Wind为准。时点：2025市场+持续项目。出处：联合资信《2025年ABS市场分析》；待Wind逐单。",
  },
  {
    match: ["丰田汽金", "丰田汽车金融"],
    kinds: "车贷ABS",
    text:
      "汽车金融·车贷ABS常发主体类型。2025全国车贷ABS约1185.43亿元。单体待Wind。时点：2025。出处：联合资信。",
  },
  {
    match: ["奔驰汽金", "梅赛德斯-奔驰汽车金融"],
    kinds: "车贷ABS",
    text: "汽车金融·车贷ABS。市场背景：2025车贷ABS约1185.43亿元。单体待Wind。出处：联合资信。",
  },
  {
    match: ["宝马汽金", "宝马汽车金融"],
    kinds: "车贷ABS",
    text: "汽车金融·车贷ABS。市场背景：2025车贷ABS约1185.43亿元。单体待Wind。出处：联合资信。",
  },
  {
    match: ["上汽通用汽金", "上汽通用汽车金融"],
    kinds: "车贷ABS",
    text: "汽车金融·车贷ABS头部常客类型。2025全国车贷ABS约1185.43亿元。单体待Wind。出处：联合资信。",
  },
  {
    match: ["比亚迪汽金", "比亚迪汽车金融"],
    kinds: "车贷ABS（含新能源车贷）",
    text:
      "汽车金融·新能源车贷ABS供给上升叙事。2025全国车贷ABS约1185.43亿元。单体待Wind/中债。时点：2025。出处：联合资信。",
  },
  {
    match: ["汽金·CN）", "汽车金融"],
    kinds: "车贷ABS",
    text:
      "汽车金融公司：以个人汽车贷款为基础资产的信贷ABS。2025年车贷ABS发行约1185.43亿元（占信贷ABS约40.66%，同比约-8.58%）。时点：2025。出处：联合资信《2025年ABS市场分析》。",
  },

  // —— 中国·融资租赁 / 小微线上 ——
  {
    match: ["融资租赁", "信用租赁", "汽租", "融资租赁ABS"],
    kinds: "融资租赁ABS/ABN",
    text:
      "信用租赁/融资租赁资产：2025年ABN融资租赁约739.48亿元（同比约+12.82%）；企业ABS中融资租赁类约占20.57%。线上3C/汽车租赁与融资租赁ABS有交叉。时点：2025。出处：联合资信《2025年ABS市场分析》。",
  },
  {
    match: ["小微", "经营贷"],
    kinds: "小微贷ABS/ABN",
    text:
      "线上小微/经营贷：2025年ABN小微贷款约1039.30亿元（同比约+79.59%）；信贷ABS小微贷约586.45亿元。时点：2025。出处：联合资信。",
  },

  // —— 美国/欧洲·BNPL / 信用卡 / 消费贷 / 学生贷 / 车贷 ——
  {
    match: ["Affirm"],
    kinds: "BNPL/消费分期ABS",
    text:
      "线上BNPL：Affirm Master Trust 2025-1；Affirm Asset Securitization Trust 2025-X1（Class A约$5.34亿等）。时点：2025。出处：Morningstar DBRS。",
  },
  {
    match: ["Klarna"],
    kinds: "BNPL ABS/仓库融资",
    text:
      "线上BNPL：Klarna有欧洲ABS/私募证券化与仓库融资史；公开连发透明度低于美国信用卡主信托。时点：待最新单。出处：待DBRS/Fitch。",
  },
  {
    match: ["Afterpay", "Block/Cash App"],
    kinds: "BNPL应收证券化/融资",
    text:
      "线上BNPL（Afterpay）应收融资；公开主品牌ABS活跃度不及Affirm。时点：待补。出处：待EDGAR/评级。",
  },
  {
    match: ["PayPal"],
    kinds: "PayPal Credit/BNPL应收",
    text:
      "线上PayPal Credit/BNPL应收融资与证券化脚注见年报；主品牌ABS因期而异。时点：待10-K交叉。出处：PayPal SEC文件。",
  },
  {
    match: ["SoFi Lending", "SoFi"],
    kinds: "无抵押消费贷ABS + 学生贷历史证券化",
    text:
      "线上消费贷：SCLP 2025系列（如2025-2约$6.90亿）；另有LPB合作证券化约$6.976亿。SoFi亦有学生贷平台历史证券化传统。时点：2025。出处：SoFi IR；DBRS；ASR。",
  },
  {
    match: ["Upstart"],
    kinds: "无抵押消费贷ABS",
    text:
      "线上AI信贷：UPST 2025-3约$4.353亿（平台约第47单）。时点：2025-09。出处：KBRA。",
  },
  {
    match: ["LendingClub"],
    kinds: "平台消费贷证券化/整贷",
    text:
      "线上平台贷：历史ABS+整贷出售；近年主品牌新发弱于SoFi/Upstart。时点：至2025。出处：待EDGAR。",
  },
  {
    match: ["Marlette", "Best Egg"],
    kinds: "无抵押消费贷ABS",
    text: "线上消费贷ABS/整贷出售传统。时点：待2024–2025逐单。出处：待KBRA/DBRS。",
  },
  {
    match: ["Synchrony"],
    kinds: "零售信用卡/店卡ABS",
    text:
      "线上+门店零售信用卡应收ABS（Synchrony Card系列）。公募/144A。时点：持续。出处：SEC EDGAR。",
  },
  {
    match: ["Capital One", "COMET", "COMT"],
    kinds: "信用卡ABS主信托",
    text:
      "信用卡应收：Capital One Multi-asset Execution Trust Card series；例A(2025-1)。时点：2025。出处：SEC 424B5。",
  },
  {
    match: ["Chase Issuance", "JPMorgan Chase", "CHASEseries"],
    kinds: "信用卡ABS主信托",
    text:
      "信用卡应收：Chase Issuance Trust；例Class A(2025-1) $15亿。时点：2025-07。出处：JPM公开招股书补充。",
  },
  {
    match: ["Discover"],
    kinds: "信用卡ABS主信托",
    text:
      "Discover Card Master Trust / Execution Note Trust持续公募。时点：持续。出处：SEC EDGAR。",
  },
  {
    match: ["American Express", "Amex", "美国运通"],
    kinds: "信用卡ABS主信托",
    text:
      "American Express Credit Account Master Trust等持续公募。时点：持续。出处：SEC；Amex IR。",
  },
  {
    match: ["Ally", "GM Financial", "Ford Credit", "Santander Consumer"],
    kinds: "车贷/租赁ABS",
    text:
      "美国车贷/租赁ABS（线上申请+经销商）。Ally/GM Financial/Ford Credit/Santander Consumer等为常发主体；2024汽车ABS为美国消费ABS主力品种之一（SEC DERA等统计口径）。时点：持续。出处：SEC；AB Alert/评级稿。",
  },
  {
    match: ["Home Credit", "FE Credit", "Akulaku", "Atome", "Grab Financial", "Shopee Pinjam", "SeaBank"],
    kinds: "东南亚消费分期/现金贷ABS或整贷出售",
    text:
      "东南亚线上消费贷/分期：本地ABS市场深度不及中美，多见银行间私募、整贷出售或仓库融资；公开主品牌ABS需按国（ID OJK等）逐单。时点：待补。出处：待本地交易所/评级。",
  },
  {
    match: ["Mercado", "Nubank", "Kredito", "Credito"],
    kinds: "拉美信用卡/消费贷证券化",
    text:
      "拉美线上卡贷/消费贷：Nubank等有FIDC/本地证券化工具；Mercado Credito等以本地结构为准。时点：待补。出处：待CVM/本地披露。",
  },
  {
    match: ["Storepay"],
    kinds: "BNPL（蒙古）—公开ABS少见",
    text:
      "线上BNPL。蒙古公开ABS市场有限，多见私募/股权融资；未查到主品牌公募ABS。时点：至2026-08。出处：公开检索未命中。",
  },
];

const ABS_MARKET_BACKDROP =
  "多资产市场：中国2025消费贷ABS（含信用卡分期统计）约4650.84亿；车贷ABS约1185.43亿；ABN消费类约1935.27亿、小微约1039.30亿、融资租赁约739.48亿。美国信用卡主信托+BNPL/消费贷ABS并行。";

function resolveAbsIssuance(group: string): string | undefined {
  const g = group.trim();
  if (!g) return undefined;
  const ranked = [...ABS_SECURITIZATION_NOTES].sort(
    (a, b) => Math.max(...b.match.map((m) => m.length)) - Math.max(...a.match.map((m) => m.length)),
  );
  const hits: AbsSecNote[] = [];
  for (const row of ranked) {
    if (!row.match.some((m) => m.length >= 2 && g.includes(m))) continue;
    // 避免「汽金」泛匹配抢走更具体主机厂条；若已有更长 match 命中则跳过短泛化条
    if (row.match.includes("汽金·CN）") || row.match.includes("汽车金融")) {
      if (hits.some((h) => h.kinds.includes("车贷"))) continue;
    }
    hits.push(row);
    if (hits.length >= 2) break; // 最多拼两条（如分期+卡）
  }
  if (!hits.length) return undefined;
  return hits.map((h) => `【${h.kinds}】${h.text}`).join(" ");
}


function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text size="small" tone="tertiary" weight="medium">
        {label}
      </Text>
      <CitedText text={value} size="small" />
    </Stack>
  );
}

/** 正文中的 〔12〕 可点，跳转信源编号目录 —— 实现见 SourceCite.tsx */

function SourceCiteEntryCard({
  c,
  focusNo,
}: {
  c: ReturnType<typeof getSourceCitationCatalog>[number];
  focusNo: number;
}) {
  const theme = useHostTheme();
  const focused = focusNo === c.no;
  return (
    <div
      id={`cite-${c.no}`}
      style={{
        padding: "10px 12px",
        borderRadius: 8,
        border: `1px solid ${focused ? theme.stroke.secondary : theme.stroke.tertiary}`,
        background: focused ? theme.fill.quaternary : theme.bg.elevated,
      }}
    >
      <Row gap={8} align="center" justify="space-between" wrap>
        <Row gap={8} align="center" wrap>
          <Pill tone={focused ? "info" : "neutral"} size="sm">
            {citeMark(c.no)}
          </Pill>
          <Text size="small" weight="medium">
            {c.title}
          </Text>
          <Pill tone="neutral" size="sm">
            {sourceCiteKindLabel(c.kind)}
          </Pill>
          {c.reportId ? (
            <Pill tone="neutral" size="sm">
              {c.reportId}
            </Pill>
          ) : null}
        </Row>
        {c.url ? (
          <Text size="small">
            <Link href={c.url}>原文</Link>
          </Text>
        ) : null}
      </Row>
      {(c.asOf || c.note) && (
        <div style={{ fontSize: 12, color: theme.text.tertiary, marginTop: 6 }}>
          {[c.asOf, c.note].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}

function SourceCatalogPanel() {
  const catalog = getSourceCitationCatalog();
  const [focus, setFocus] = useCanvasState<string>("sourceCiteFocus", "");
  const focusNo = Number(focus) || 0;
  const theme = useHostTheme();
  const { hasReturn, label, goBack } = useSourceCiteReturn();
  const core = catalog.filter((c) => c.no <= 23);
  const research = catalog.filter((c) => c.no > 23 && !isListedStockCitation(c));
  const listed = catalog.filter((c) => isListedStockCitation(c));
  const listedFocused = listed.some((c) => c.no === focusNo);
  const researchFocused = research.some((c) => c.no === focusNo);

  useEffect(() => {
    if (!focusNo) return;
    const el = document.getElementById(`cite-${focusNo}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusNo]);

  return (
    <Stack gap={16}>
      <Stack gap={8}>
        <Row gap={10} align="center" justify="space-between" wrap>
          <H2>信源 / 研报编号目录</H2>
          <button
            type="button"
            onClick={goBack}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              margin: 0,
              height: 28,
              padding: "0 10px",
              border: `1px solid ${theme.stroke.secondary}`,
              borderRadius: 8,
              background: theme.fill.secondary,
              color: theme.text.primary,
              font: "inherit",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              boxSizing: "border-box",
            }}
          >
            ← {hasReturn ? `返回${label}` : "返回总览"}
          </button>
        </Row>
        <Text size="small" tone="tertiary">
          每条为统一词条：编号〔n〕· 名称 · 类型 · 原文。正文点〔n〕跳转本页并高亮。核心含 TE〔1〕、点点〔2〕、墨腾〔3〕、出海小黑板〔21〕、GlobalPetrolPrices〔22〕、TE零售汽油表〔23〕、新能源关税/增值税〔24〕等。
        </Text>
      </Stack>

      <Stack gap={8}>
        <Text weight="medium">核心信源 · 〔1〕–〔23〕</Text>
        {core.map((c) => (
          <SourceCiteEntryCard key={c.id} c={c} focusNo={focusNo} />
        ))}
      </Stack>

      <SoftFold
        key={researchFocused ? `research-${focusNo}` : "research"}
        title="情报库词条"
        hint="研报与监管/信源包及其 sources[]"
        count={research.length}
        defaultOpen={researchFocused || research.length <= 12}
      >
        <Stack gap={8}>
          {research.map((c) => (
            <SourceCiteEntryCard key={c.id} c={c} focusNo={focusNo} />
          ))}
        </Stack>
      </SoftFold>

      <SoftFold
        key={listedFocused ? `listed-${focusNo}` : "listed"}
        title="上市公司词条"
        hint="交易所门户与观察池已缓存财报/IR；行情总入口见〔16〕"
        count={listed.length}
        defaultOpen={listedFocused}
      >
        <Stack gap={8}>
          {listed.map((c) => (
            <SourceCiteEntryCard key={c.id} c={c} focusNo={focusNo} />
          ))}
        </Stack>
      </SoftFold>

      {focusNo ? (
        <Text size="small" tone="tertiary">
          当前定位〔{focusNo}〕
          <button
            type="button"
            onClick={() => setFocus("")}
            style={{
              marginLeft: 8,
              border: "none",
              background: "transparent",
              color: theme.text.secondary,
              cursor: "pointer",
              font: "inherit",
              fontSize: 12,
            }}
          >
            清除高亮
          </button>
        </Text>
      ) : null}
    </Stack>
  );
}

/** 可点选角标：已选且 clearable 时再点可清除 */

type WideMarket =
  | "中国"
  | "美国"
  | "东南亚"
  | "印度"
  | "拉美"
  | "中东与北非"
  | "非洲"
  | "欧洲"
  | "日韩";

const WIDE_MARKET_ORDER: WideMarket[] = [
  "中国",
  "美国",
  "东南亚",
  "印度",
  "拉美",
  "中东与北非",
  "非洲",
  "欧洲",
  "日韩",
];
const WIDE_MARKET_LABEL: Record<WideMarket, string> = Object.fromEntries(
  WIDE_MARKET_ORDER.map((m) => [m, m]),
) as Record<WideMarket, string>;

/** 全球线上数字化经营场景大宽表（代表平台参考；CRM 仍以信贷派生为准） */
const SCENE_WIDE_TABLE: { l1: SceneTag; l2: SceneSubTag; cells: Record<WideMarket, string> }[] = [
  {
    l1: "电商" as const,
    l2: "综合电商" as const,
    cells: {
      "中国": "淘宝、京东、拼多多",
      "美国": "Amazon、Walmart、Target",
      "东南亚": "Shopee、Lazada、Tokopedia",
      "印度": "Flipkart、Amazon India、Meesho",
      "拉美": "Mercado Libre、Amazon Brazil、Americanas",
      "中东与北非": "Noon、Amazon UAE、Trendyol",
      "非洲": "Jumia、Takealot",
      "欧洲": "Amazon、Zalando、Allegro",
      "日韩": "Rakuten、Yahoo Shopping",
    },
  },
  {
    l1: "电商" as const,
    l2: "垂直电商" as const,
    cells: {
      "中国": "唯品会、得物、寺库",
      "美国": "Chewy、Wayfair、Etsy",
      "东南亚": "iPrice、Sociolla、Orami",
      "印度": "Nykaa、FirstCry、Lenskart",
      "拉美": "Dafiti、Netshoes、Linio",
      "中东与北非": "Namshi、Golden Scent、Sprii",
      "非洲": "Kilimall、Jumia Fashion",
      "欧洲": "ASOS、Boohoo、About You",
      "日韩": "Zozotown、Qoo10",
    },
  },
  {
    l1: "电商" as const,
    l2: "社交电商" as const,
    cells: {
      "中国": "小红书、抖音商城、快手小店",
      "美国": "Poshmark、Depop、Whatnot",
      "东南亚": "TikTok Shop、Shopee Live、Tokopedia Mitra",
      "印度": "Meesho、GlowRoad、Shop101",
      "拉美": "Facily、Vopero、Elenas",
      "中东与北非": "The List、YallaHub、Sary",
      "非洲": "Kapu、Copia、Wasoko",
      "欧洲": "Vinted、Wallapop、Shpock",
      "日韩": "LINE Shopping、Mercari",
    },
  },
  {
    l1: "电商" as const,
    l2: "跨境电商" as const,
    cells: {
      "中国": "速卖通、SHEIN、Temu",
      "美国": "Amazon Global、eBay",
      "东南亚": "Shopee Cross-border、Lazada Global",
      "印度": "Amazon Global Store、Flipkart Wholesale",
      "拉美": "Mercado Libre International、Shopee Brazil",
      "中东与北非": "Amazon.sa、Noon、AliExpress",
      "非洲": "Jumia Global、Kilimall",
      "欧洲": "Zalando、ASOS、Cdiscount",
      "日韩": "Qoo10 Japan、Rakuten Global",
    },
  },
  {
    l1: "电商" as const,
    l2: "二手/闲置" as const,
    cells: {
      "中国": "闲鱼、转转、爱回收",
      "美国": "eBay、ThredUp、OfferUp",
      "东南亚": "Carousell、OLX（东南亚）",
      "印度": "OLX India、Cashify、Quikr",
      "拉美": "OLX Brasil、Enjoei、Rebag",
      "中东与北非": "Melltoo、OpenSooq",
      "非洲": "Jiji、OLX Africa",
      "欧洲": "Back Market、Vinted、Wallapop",
      "日韩": "Mercari、Rakuma",
    },
  },
  {
    l1: "出行" as const,
    l2: "网约车" as const,
    cells: {
      "中国": "滴滴、曹操出行、T3出行",
      "美国": "Uber、Lyft",
      "东南亚": "Grab、Gojek、Bolt",
      "印度": "Ola、Uber India、Namma Yatri",
      "拉美": "99、Cabify、Beat",
      "中东与北非": "Careem、Uber MENA、Jeeny",
      "非洲": "Bolt、Uber、Little",
      "欧洲": "Bolt、Free Now、BlaBlaCar",
      "日韩": "Kakao T、Go Taxi",
    },
  },
  {
    l1: "出行" as const,
    l2: "顺风车/拼车" as const,
    cells: {
      "中国": "嘀嗒出行、哈啰顺风车",
      "美国": "UberPool、Lyft Shared、Waze Carpool",
      "东南亚": "GrabHitch、BlaBlaCar SEA",
      "印度": "Ola Share、Quick Ride",
      "拉美": "BlaBlaCar Brasil",
      "中东与北非": "Carpool Arabia",
      "非洲": "Treepz、BlaBlaCar Africa",
      "欧洲": "BlaBlaCar、Fahrgemeinschaft",
      "日韩": "Line Carpool、Nori Nori",
    },
  },
  {
    l1: "出行" as const,
    l2: "共享单车/电单车" as const,
    cells: {
      "中国": "美团单车、哈啰单车、青桔",
      "美国": "Lime、Bird、Citi Bike",
      "东南亚": "Anywheel、Beam、Neuron",
      "印度": "Yulu、Bounce、Vogo",
      "拉美": "Grin、Yellow（已整合）、Movo",
      "中东与北非": "Careem Bike、Lime MENA",
      "非洲": "SafeBoda、Bolt Bikes",
      "欧洲": "Lime、Tier、Voi",
      "日韩": "Hello Cycling、Luup",
    },
  },
  {
    l1: "出行" as const,
    l2: "地图/导航" as const,
    cells: {
      "中国": "高德地图、百度地图",
      "美国": "Google Maps、Waze、MapQuest",
      "东南亚": "Google Maps、Waze、HERE WeGo",
      "印度": "Google Maps、MapmyIndia",
      "拉美": "Google Maps、Waze",
      "中东与北非": "Google Maps、Waze",
      "非洲": "Google Maps、Waze",
      "欧洲": "Google Maps、Maps.me",
      "日韩": "Google Maps、TomTom",
    },
  },
  {
    l1: "出行" as const,
    l2: "代驾" as const,
    cells: {
      "中国": "e代驾、滴滴代驾",
      "美国": "Uber（整合）、Designated Drivers",
      "东南亚": "极少独立平台",
      "印度": "极少独立平台",
      "拉美": "极少独立平台",
      "中东与北非": "Careem（整合）",
      "非洲": "极少",
      "欧洲": "极少独立平台",
      "日韩": "极少独立平台",
    },
  },
  {
    l1: "外卖" as const,
    l2: "餐饮外卖" as const,
    cells: {
      "中国": "美团外卖、饿了么",
      "美国": "DoorDash、Uber Eats、Grubhub",
      "东南亚": "GrabFood、GoFood（双寡头主市场）；ShopeeFood追赶、Foodpanda收缩",
      "印度": "Swiggy、Zomato、Dunzo",
      "拉美": "Rappi、iFood、Uber Eats",
      "中东与北非": "Talabat、Careem Now、Jahez",
      "非洲": "Glovo、Jumia Food、Bolt Food",
      "欧洲": "Deliveroo、Just Eat Takeaway、Wolt",
      "日韩": "Uber Eats Japan、Demae-can、Baedal Minjok",
    },
  },
  {
    l1: "外卖" as const,
    l2: "即时零售/闪购" as const,
    cells: {
      "中国": "美团闪购、京东到家、蜂鸟即配",
      "美国": "Instacart、Gopuff、Jokr（已关闭）",
      "东南亚": "GrabMart、HappyFresh、AirAsia Fresh",
      "印度": "Blinkit（原Grofers）、Zepto、Dunzo",
      "拉美": "Rappi Turbo、Cornershop（Uber）",
      "中东与北非": "Talabat Mart、Careem Quik",
      "非洲": "Glovo、Jumia、Wasoko",
      "欧洲": "Getir、Gorillas（整合中）、Flink",
      "日韩": "Rakuten Seiyu Netsuper、Amazon Fresh",
    },
  },
  {
    l1: "外卖" as const,
    l2: "生鲜电商" as const,
    cells: {
      "中国": "叮咚买菜、朴朴、盒马",
      "美国": "Amazon Fresh、Whole Foods、Thrive Market",
      "东南亚": "HappyFresh、Sayurbox、TaniHub",
      "印度": "BigBasket、FreshToHome、Licious",
      "拉美": "JOKR（已退出）、Frubana（重组）",
      "中东与北非": "El Grocer、Kibsons、Farmbox",
      "非洲": "Wasoko、Twiga Foods、ChopChop",
      "欧洲": "Ocado、Getir、Flink",
      "日韩": "Oisix、Radish、Amazon Fresh Japan",
    },
  },
  {
    l1: "外卖" as const,
    l2: "药品配送" as const,
    cells: {
      "中国": "美团买药、京东健康、叮当快药",
      "美国": "CVS、Walgreens、Amazon Pharmacy",
      "东南亚": "1mg（Tata）、PharmEasy、Netmeds",
      "印度": "1mg、PharmEasy、Apollo 24",
      "拉美": "待补",
      "中东与北非": "Rappi（含药品）、Farmacity",
      "非洲": "1mg（中东）、Altibbi、Vezeeta",
      "欧洲": "MyDawa、Livia、Pharmacy M",
      "日韩": "Zur Rose、Shop Apotheke、Medino",
    },
  },
  {
    l1: "社交" as const,
    l2: "即时通讯" as const,
    cells: {
      "中国": "微信、QQ",
      "美国": "WhatsApp、Messenger、iMessage",
      "东南亚": "WhatsApp、LINE、Zalo",
      "印度": "WhatsApp、Telegram、JioChat",
      "拉美": "WhatsApp、Telegram",
      "中东与北非": "WhatsApp、Telegram、Botim",
      "非洲": "WhatsApp、Telegram",
      "欧洲": "WhatsApp、Telegram、Signal",
      "日韩": "LINE、KakaoTalk",
    },
  },
  {
    l1: "社交" as const,
    l2: "社区/论坛" as const,
    cells: {
      "中国": "豆瓣、知乎、小红书（社区）",
      "美国": "Reddit、Quora、Discord",
      "东南亚": "Reddit、Discord、Kaskus",
      "印度": "Reddit、Discord、Indiabix",
      "拉美": "Reddit、Discord、Taringa",
      "中东与北非": "Reddit、Discord",
      "非洲": "Reddit、Nairaland",
      "欧洲": "Reddit、Discord、Mumsnet",
      "日韩": "Reddit、5ch、Naver Cafe",
    },
  },
  {
    l1: "社交" as const,
    l2: "陌生人社交" as const,
    cells: {
      "中国": "陌陌、Soul、探探",
      "美国": "Tinder、Bumble、Hinge",
      "东南亚": "Tinder、Bumble、Paktor",
      "印度": "Tinder、Bumble、Aisle",
      "拉美": "Tinder、Bumble、Badoo",
      "中东与北非": "Tinder、Bumble、Hayat",
      "非洲": "Tinder、Bumble",
      "欧洲": "Tinder、Bumble、Happn",
      "日韩": "Tinder、Pairs、Omiai",
    },
  },
  {
    l1: "社交" as const,
    l2: "职场社交" as const,
    cells: {
      "中国": "脉脉、领英中国（已调整）",
      "美国": "LinkedIn、Indeed、Glassdoor",
      "东南亚": "LinkedIn、Glints、JobStreet",
      "印度": "LinkedIn、Naukri、Apna",
      "拉美": "LinkedIn、Vagas.com、Catho",
      "中东与北非": "LinkedIn、Bayt、GulfTalent",
      "非洲": "LinkedIn、Bayt、Naukrigulf",
      "欧洲": "LinkedIn、Jobberman",
      "日韩": "LinkedIn、Xing、StepStone",
    },
  },
  {
    l1: "社交" as const,
    l2: "婚恋/相亲" as const,
    cells: {
      "中国": "珍爱网、百合网、世纪佳缘",
      "美国": "Match.com、eHarmony、Hinge",
      "东南亚": "Paktor、Lunch Actually、Noonswoon",
      "印度": "Shaadi.com、BharatMatrimony、Jeevansathi",
      "拉美": "ParPerfeito、AmoCasar、Match LATAM",
      "中东与北非": "Hawaya（已关闭）、Harmonica（已整合）",
      "非洲": "极少",
      "欧洲": "Match.com、Parship、ElitePartner",
      "日韩": "Omiai、Pairs、Zexy Enmusubi",
    },
  },
  {
    l1: "支付钱包" as const,
    l2: "移动支付" as const,
    cells: {
      "中国": "支付宝、微信支付",
      "美国": "Apple Pay、Google Pay、Venmo",
      "东南亚": "GrabPay、GoPay、Touch 'n Go、Maya",
      "印度": "Paytm、PhonePe、Google Pay",
      "拉美": "Mercado Pago、PicPay、Nubank",
      "中东与北非": "STC Pay、Apple Pay、Careem Pay",
      "非洲": "M-Pesa、Opay、Chipper Cash",
      "欧洲": "Apple Pay、Google Pay、PayPal",
      "日韩": "PayPay、LINE Pay、KakaoPay",
    },
  },
  {
    l1: "支付钱包" as const,
    l2: "跨境支付/汇款" as const,
    cells: {
      "中国": "万里汇、连连支付、PingPong",
      "美国": "Wise、Remitly、Western Union",
      "东南亚": "Wise、Remitly、Singtel Dash",
      "印度": "Wise、Remitly、InstaReM",
      "拉美": "Wise、Remitly、Banco do Brasil",
      "中东与北非": "Wise、Remitly、Al Fardan Exchange",
      "非洲": "Wise、Remitly、WorldRemit",
      "欧洲": "Wise、Remitly、TransferGo",
      "日韩": "Wise、Remitly、Seven Bank",
    },
  },
  {
    l1: "支付钱包" as const,
    l2: "数字银行/虚拟账户" as const,
    cells: {
      "中国": "微众银行、网商银行、百信银行",
      "美国": "Chime、Varo、SoFi",
      "东南亚": "Tonik、UNObank、Maya Bank",
      "印度": "Jupiter、Fi、Niyo",
      "拉美": "Nubank、Inter、C6 Bank",
      "中东与北非": "Liv.、YAP、Nymcard",
      "非洲": "Kuda、Sparkle、FairMoney",
      "欧洲": "Revolut、N26、Monzo",
      "日韩": "Sony Bank、SBI Sumishin Net Bank",
    },
  },
  {
    l1: "支付钱包" as const,
    l2: "预付卡/储值" as const,
    cells: {
      "中国": "美团礼品卡、京东E卡",
      "美国": "Starbucks Card、Amazon Gift Card",
      "东南亚": "GrabGift、ShopeePay礼品卡",
      "印度": "Amazon Pay Gift Card、Flipkart Gift Card",
      "拉美": "iFood Gift Card、Uber Gift Card",
      "中东与北非": "Careem Pay、Noon Gift Card",
      "非洲": "M-Pesa（含储蓄功能）、Opay",
      "欧洲": "Amazon Gift Card、Paysafecard",
      "日韩": "Suica、PASMO、nanaco",
    },
  },
  {
    l1: "支付钱包" as const,
    l2: "聚合支付" as const,
    cells: {
      "中国": "拉卡拉、汇付天下、银联商务",
      "美国": "Stripe、Square、Adyen",
      "东南亚": "2C2P、Omise、Xendit",
      "印度": "Razorpay、PayU、CCAvenue",
      "拉美": "Mercado Pago、PagSeguro、Cielo",
      "中东与北非": "Telr、Checkout.com、PayFort",
      "非洲": "Flutterwave、Paystack、DPO Group",
      "欧洲": "Stripe、Adyen、Checkout.com",
      "日韩": "Stripe Japan、Komoju、GMO Payment",
    },
  },
  {
    l1: "游戏" as const,
    l2: "手游" as const,
    cells: {
      "中国": "王者荣耀、和平精英、原神",
      "美国": "Candy Crush、PUBG Mobile、Roblox",
      "东南亚": "Free Fire、Mobile Legends、Genshin Impact",
      "印度": "Ludo King、Free Fire、Battlegrounds Mobile",
      "拉美": "Free Fire、PUBG Mobile、Garena games",
      "中东与北非": "PUBG Mobile、FIFA Mobile、Call of Duty Mobile",
      "非洲": "Candy Crush、PUBG Mobile、Free Fire",
      "欧洲": "Candy Crush、PUBG Mobile、Coin Master",
      "日韩": "Monster Strike、Fate/Grand Order、Puzzle & Dragons",
    },
  },
  {
    l1: "游戏" as const,
    l2: "端游/页游" as const,
    cells: {
      "中国": "英雄联盟、穿越火线、梦幻西游",
      "美国": "League of Legends、Valorant、World of Warcraft",
      "东南亚": "Dota 2、CS:GO、PUBG PC",
      "印度": "Dota 2、Valorant、BGMI PC",
      "拉美": "League of Legends、Valorant、FIFA",
      "中东与北非": "Dota 2、CS:GO、Fortnite",
      "非洲": "Dota 2、CS:GO",
      "欧洲": "League of Legends、FIFA、Fortnite",
      "日韩": "League of Legends、Final Fantasy XIV、Black Desert",
    },
  },
  {
    l1: "游戏" as const,
    l2: "云游戏" as const,
    cells: {
      "中国": "网易云游戏、腾讯START",
      "美国": "Xbox Cloud Gaming、NVIDIA GeForce NOW",
      "东南亚": "极少",
      "印度": "极少",
      "拉美": "极少",
      "中东与北非": "极少",
      "非洲": "极少",
      "欧洲": "Xbox Cloud Gaming、Boosteroid",
      "日韩": "极少",
    },
  },
  {
    l1: "游戏" as const,
    l2: "游戏平台/分发" as const,
    cells: {
      "中国": "Steam（中国版）、TapTap、WeGame",
      "美国": "Steam、Epic Games Store、itch.io",
      "东南亚": "Steam、Garena、TapTap SEA",
      "印度": "Steam、Epic Games Store",
      "拉美": "Steam、Epic Games Store",
      "中东与北非": "Steam、Epic Games Store",
      "非洲": "Steam、Epic Games Store",
      "欧洲": "Steam、Epic Games Store、GOG",
      "日韩": "Steam、DMM Games、Fanza",
    },
  },
  {
    l1: "游戏" as const,
    l2: "电竞/赛事" as const,
    cells: {
      "中国": "腾讯电竞、英雄体育VSPO",
      "美国": "ESL Gaming、Riot Games、Blizzard",
      "东南亚": "MPL、Garena、ESL One SEA",
      "印度": "MPL India、BGIS、Upthrust Esports",
      "拉美": "Liga Master Flow、Free Fire League",
      "中东与北非": "PUBG Mobile Pro League MENA",
      "非洲": "极少",
      "欧洲": "ESL、LEC、BLAST Premier",
      "日韩": "LJL、LCK、RAGE",
    },
  },
  {
    l1: "直播" as const,
    l2: "娱乐直播" as const,
    cells: {
      "中国": "抖音直播、快手直播、YY直播",
      "美国": "Twitch、YouTube Live、TikTok Live",
      "东南亚": "Bigo Live、Mico、Uplive",
      "印度": "Loco、Rooter、StreamKar",
      "拉美": "Bigo Live、Tango Live、LiveMe",
      "中东与北非": "Tango Live、Bigo Live、StreamKar",
      "非洲": "Bigo Live、StreamKar、Tango Live",
      "欧洲": "Twitch、YouTube Live、Stripchat",
      "日韩": "17LIVE、Pococha、ShowRoom",
    },
  },
  {
    l1: "直播" as const,
    l2: "游戏直播" as const,
    cells: {
      "中国": "斗鱼、虎牙、B站直播",
      "美国": "Twitch、YouTube Gaming、Facebook Gaming",
      "东南亚": "Nimo TV、Facebook Gaming",
      "印度": "Loco、YouTube Gaming",
      "拉美": "Nimo TV、Facebook Gaming",
      "中东与北非": "Nimo TV、Facebook Gaming",
      "非洲": "Facebook Gaming、YouTube Gaming",
      "欧洲": "Twitch、YouTube Gaming、Kick",
      "日韩": "Mildom、OPENREC、Mirrativ",
    },
  },
  {
    l1: "直播" as const,
    l2: "电商直播/带货" as const,
    cells: {
      "中国": "淘宝直播、抖音电商、快手电商",
      "美国": "Amazon Live、YouTube Shopping、TikTok Shop",
      "东南亚": "Shopee Live、LazLive、Tokopedia Play",
      "印度": "Flipkart Live、Myntra Live、Meesho Live",
      "拉美": "Mercado Libre Live、Shopee Live、Magalu Live",
      "中东与北非": "Noon Live、Amazon.sa Live",
      "非洲": "Jumia Live、Kilimall Live",
      "欧洲": "Amazon Live、Zalando Live、Livescale",
      "日韩": "Qoo10 Live、Rakuten Live、BASE Live",
    },
  },
  {
    l1: "直播" as const,
    l2: "教育直播" as const,
    cells: {
      "中国": "猿辅导、作业帮、高途课堂",
      "美国": "Coursera、Udemy、MasterClass",
      "东南亚": "Ruangguru、Zenius、Pahamify",
      "印度": "BYJU'S、Unacademy、Vedantu",
      "拉美": "Descomplica、Provi、EBAC",
      "中东与北非": "Noon Academy、Abwaab、Alison",
      "非洲": "uLesson、Eneza Education、Shupavu291",
      "欧洲": "FutureLearn、OpenClassrooms、Domestika",
      "日韩": "RareJob、Schoo、N High School",
    },
  },
  {
    l1: "直播" as const,
    l2: "企业直播/会议" as const,
    cells: {
      "中国": "腾讯会议、钉钉、企业微信",
      "美国": "Zoom、Microsoft Teams、Webex",
      "东南亚": "Zoom、Google Meet、Microsoft Teams",
      "印度": "Zoom、Microsoft Teams、Google Meet",
      "拉美": "Zoom、Microsoft Teams、Google Meet",
      "中东与北非": "Zoom、Microsoft Teams、Google Meet",
      "非洲": "Zoom、Microsoft Teams、Google Meet",
      "欧洲": "Zoom、Microsoft Teams、Google Meet",
      "日韩": "Zoom、Microsoft Teams、Google Meet",
    },
  },
  {
    l1: "信用管理" as const,
    l2: "征信查询" as const,
    cells: {
      "中国": "央行征信、百行征信、朴道征信",
      "美国": "Experian、Equifax、TransUnion",
      "东南亚": "CIC（菲律宾）、BI Checking（印尼）",
      "印度": "CIBIL、Experian India、Equifax India",
      "拉美": "Serasa Experian、Boa Vista SCPC",
      "中东与北非": "Al Etihad Credit Bureau（阿联酋）",
      "非洲": "Creditinfo、TransUnion Africa",
      "欧洲": "Schufa、Experian、Equifax",
      "日韩": "KSCIC、CIC、NICE",
    },
  },
  {
    l1: "信用管理" as const,
    l2: "债务管理/催收" as const,
    cells: {
      "中国": "永雄集团（已调整）、资易通",
      "美国": "TrueAccord、Encore Capital、Portfolio Recovery",
      "东南亚": "极少",
      "印度": "极少",
      "拉美": "极少",
      "中东与北非": "极少",
      "非洲": "极少",
      "欧洲": "Intrum、Hoist Finance、Arrow Global",
      "日韩": "极少",
    },
  },
  {
    l1: "内容资讯" as const,
    l2: "短视频" as const,
    cells: {
      "中国": "抖音、快手、视频号",
      "美国": "TikTok、YouTube Shorts、Instagram Reels",
      "东南亚": "TikTok、SnackVideo、Likee",
      "印度": "Moj、Josh、Takatak（MX TakaTak）",
      "拉美": "TikTok、Kwai、Instagram Reels",
      "中东与北非": "TikTok、Instagram Reels",
      "非洲": "TikTok、SnackVideo",
      "欧洲": "TikTok、Instagram Reels、Triller",
      "日韩": "TikTok、LINE Voom、MixChannel",
    },
  },
  {
    l1: "内容资讯" as const,
    l2: "中长视频/流媒体" as const,
    cells: {
      "中国": "爱奇艺、腾讯视频、优酷",
      "美国": "Netflix、YouTube、Hulu",
      "东南亚": "Netflix、Disney+ Hotstar、Viu",
      "印度": "Disney+ Hotstar、SonyLIV、ZEE5",
      "拉美": "Netflix、Amazon Prime Video、Globoplay",
      "中东与北非": "Netflix、Shahid、Starzplay",
      "非洲": "Netflix、Showmax、Amazon Prime Video",
      "欧洲": "Netflix、Amazon Prime Video、Disney+",
      "日韩": "Netflix、U-NEXT、Hulu Japan",
    },
  },
  {
    l1: "内容资讯" as const,
    l2: "新闻资讯/聚合" as const,
    cells: {
      "中国": "今日头条、腾讯新闻、网易新闻",
      "美国": "Google News、Apple News、Flipboard",
      "东南亚": "Google News、Detik、Kompas",
      "印度": "Dailyhunt、Inshorts、NewsDog",
      "拉美": "Google News、G1、Infobae",
      "中东与北非": "Google News、Al Jazeera、Gulf News",
      "非洲": "Google News、Pulse Nigeria、News24",
      "欧洲": "Google News、SmartNews、Upday",
      "日韩": "SmartNews、Gunosy、LINE News",
    },
  },
  {
    l1: "内容资讯" as const,
    l2: "知识付费/专栏" as const,
    cells: {
      "中国": "得到、知乎盐选、喜马拉雅",
      "美国": "Substack、Patreon、Medium",
      "东南亚": "极少",
      "印度": "极少",
      "拉美": "极少",
      "中东与北非": "极少",
      "非洲": "极少",
      "欧洲": "Substack、Patreon、Medium",
      "日韩": "note、Stand FM、Voicy",
    },
  },
  {
    l1: "内容资讯" as const,
    l2: "播客/音频" as const,
    cells: {
      "中国": "喜马拉雅、荔枝、小宇宙",
      "美国": "Spotify、Apple Podcasts、Audible",
      "东南亚": "Spotify、Noice、Resso",
      "印度": "Spotify、Gaana、JioSaavn",
      "拉美": "Spotify、Deezer、Podcast Addict",
      "中东与北非": "Anghami、Spotify",
      "非洲": "Spotify、Audiomack",
      "欧洲": "Spotify、Deezer、Podimo",
      "日韩": "Spotify、Audible、Voicy",
    },
  },
  {
    l1: "企业服务" as const,
    l2: "企业通讯/协同" as const,
    cells: {
      "中国": "钉钉、企业微信、飞书",
      "美国": "Slack、Microsoft Teams、Discord",
      "东南亚": "Lark、Slack、Microsoft Teams",
      "印度": "Slack、Microsoft Teams、Zoho Cliq",
      "拉美": "Slack、Microsoft Teams、Google Workspace",
      "中东与北非": "Slack、Microsoft Teams、Google Workspace",
      "非洲": "Slack、Microsoft Teams、Google Workspace",
      "欧洲": "Slack、Microsoft Teams、Google Workspace",
      "日韩": "Slack、LINE Works、Chatwork",
    },
  },
  {
    l1: "企业服务" as const,
    l2: "项目管理" as const,
    cells: {
      "中国": "Teambition、Tower、蓝湖",
      "美国": "Asana、Monday.com、Notion",
      "东南亚": "Asana、Notion、Trello",
      "印度": "Asana、Notion、Jira",
      "拉美": "Asana、Notion、Trello",
      "中东与北非": "Asana、Notion、Trello",
      "非洲": "Asana、Notion、Trello",
      "欧洲": "Asana、Notion、ClickUp",
      "日韩": "Asana、Notion、Backlog",
    },
  },
  {
    l1: "企业服务" as const,
    l2: "云存储/云服务" as const,
    cells: {
      "中国": "阿里云、腾讯云、华为云",
      "美国": "AWS、Google Cloud、Microsoft Azure",
      "东南亚": "AWS、Google Cloud、Alibaba Cloud",
      "印度": "AWS、Google Cloud、Microsoft Azure",
      "拉美": "AWS、Google Cloud、Microsoft Azure",
      "中东与北非": "AWS、Google Cloud、Microsoft Azure",
      "非洲": "AWS、Google Cloud、Microsoft Azure",
      "欧洲": "AWS、Google Cloud、Microsoft Azure",
      "日韩": "AWS、Google Cloud、Microsoft Azure",
    },
  },
  {
    l1: "企业服务" as const,
    l2: "在线文档/表格" as const,
    cells: {
      "中国": "腾讯文档、石墨文档、金山文档",
      "美国": "Google Docs、Notion、Coda",
      "东南亚": "Google Docs、Notion、Quip",
      "印度": "Google Docs、Notion、Zoho Writer",
      "拉美": "Google Docs、Notion、Coda",
      "中东与北非": "Google Docs、Notion、Coda",
      "非洲": "Google Docs、Notion、Coda",
      "欧洲": "Google Docs、Notion、Coda",
      "日韩": "Google Docs、Notion、Coda",
    },
  },
  {
    l1: "法律服务" as const,
    l2: "电子签章" as const,
    cells: {
      "中国": "e签宝、法大大、上上签",
      "美国": "DocuSign、Adobe Sign、HelloSign",
      "东南亚": "DocuSign、SignNow、HelloSign",
      "印度": "DocuSign、Zoho Sign、Leegality",
      "拉美": "DocuSign、ClickSign、SignNow",
      "中东与北非": "DocuSign、Adobe Sign",
      "非洲": "DocuSign、SignNow",
      "欧洲": "DocuSign、Yousign、Signable",
      "日韩": "DocuSign、CloudSign、GMO Sign",
    },
  },
  {
    l1: "法律服务" as const,
    l2: "电子合同" as const,
    cells: {
      "中国": "契约锁、法大大、律师管家合同",
      "美国": "DocuSign CLM、Ironclad、Conga",
      "东南亚": "DocuSign、Pandadoc、Contractbook",
      "印度": "Legistify、SpotDraft、DocuSign",
      "拉美": "DocuSign、D4Sign、ClickSign",
      "中东与北非": "DocuSign、Adobe Sign",
      "非洲": "DocuSign、Contractbook",
      "欧洲": "DocuSign、Legito、Contractbook",
      "日韩": "CloudSign、GMO Sign、DocuSign",
    },
  },
  {
    l1: "法律服务" as const,
    l2: "在线公证/存证" as const,
    cells: {
      "中国": "蚂蚁链存证、至信链、公证云",
      "美国": "Notarize、NotaryCam、Proof",
      "东南亚": "极少独立平台；多嵌签约产品",
      "印度": "eMudhra、NSDL e-Sign 相关路径",
      "拉美": "极少",
      "中东与北非": "极少",
      "非洲": "极少",
      "欧洲": "Scrive、Yousign（含电子公证路径）",
      "日韩": "极少",
    },
  },
  {
    l1: "法律服务" as const,
    l2: "法律咨询/智能法务" as const,
    cells: {
      "中国": "华律网、无讼、法狗狗",
      "美国": "LegalZoom、Rocket Lawyer、DoNotPay",
      "东南亚": "LawPath、Lawyerment",
      "印度": "Vakilsearch、LawRato、MyAdvo",
      "拉美": "LegalTech 分散；少头部",
      "中东与北非": "极少",
      "非洲": "极少",
      "欧洲": "Rocket Lawyer EU、LegalZoom 对照",
      "日韩": "极少独立 To C 平台",
    },
  },
  {
    l1: "本地生活" as const,
    l2: "到店团购" as const,
    cells: {
      "中国": "美团、大众点评、口碑",
      "美国": "Groupon、LivingSocial（已衰退）",
      "东南亚": "Fave、Eatigo、Burpple",
      "印度": "Nearbuy、Littleapp、Dineout",
      "拉美": "Groupon、Peixe Urbano、Cuponatic",
      "中东与北非": "The Entertainer、Cobone",
      "非洲": "极少",
      "欧洲": "Groupon、Wowcher、Travelzoo",
      "日韩": "Hot Pepper、Tabelog、Gurunavi",
    },
  },
  {
    l1: "本地生活" as const,
    l2: "酒店/民宿预订" as const,
    cells: {
      "中国": "携程、美团酒店、飞猪",
      "美国": "Booking.com、Airbnb、Expedia",
      "东南亚": "Agoda、Traveloka、Airbnb",
      "印度": "MakeMyTrip、Goibibo、Oyo",
      "拉美": "Booking.com、Airbnb、Decolar",
      "中东与北非": "Booking.com、Airbnb、Musafir",
      "非洲": "Booking.com、Airbnb、Jumia Travel",
      "欧洲": "Booking.com、Airbnb、Holidu",
      "日韩": "Booking.com、Airbnb、Jalan",
    },
  },
  {
    l1: "本地生活" as const,
    l2: "票务/电影/演出" as const,
    cells: {
      "中国": "猫眼、大麦、淘票票",
      "美国": "Ticketmaster、Fandango、Eventbrite",
      "东南亚": "BookMyShow、Ticketmelon、Peatix",
      "印度": "BookMyShow、Paytm Insider、Townscript",
      "拉美": "Ingresso、Sympla、Ticket360",
      "中东与北非": "Platinumlist、BookMyShow UAE",
      "非洲": "Quicket、Ticketpro",
      "欧洲": "Ticketmaster、Eventim、Dice",
      "日韩": "eplus、Lawson Ticket、Pia",
    },
  },
  {
    l1: "本地生活" as const,
    l2: "家政/保洁服务" as const,
    cells: {
      "中国": "天鹅到家、58到家、京东家政",
      "美国": "TaskRabbit、Handy、Thumbtack",
      "东南亚": "Helpling、Sendhelper、Klean",
      "印度": "Urban Company、Housejoy、Bro4u",
      "拉美": "极少",
      "中东与北非": "Justmop、Matic、ServiceMarket",
      "非洲": "极少",
      "欧洲": "Helpling、Wecasa、Hassle.com",
      "日韩": "极少",
    },
  },
  {
    l1: "本地生活" as const,
    l2: "美容/美发预约" as const,
    cells: {
      "中国": "美团丽人、大众点评",
      "美国": "StyleSeat、Booksy、Treatwell",
      "东南亚": "Vaniday、Klook（含美容）、BeautyBook",
      "印度": "Urban Company、Be U Salons、Zooty",
      "拉美": "极少",
      "中东与北非": "Vaniday、Shedul",
      "非洲": "极少",
      "欧洲": "Treatwell、Fresha、Planity",
      "日韩": "Hot Pepper Beauty、Minimo",
    },
  },
  {
    l1: "在线教育" as const,
    l2: "K12学科辅导" as const,
    cells: {
      "中国": "学而思网校、作业帮、猿辅导",
      "美国": "Khan Academy、IXL、Chegg",
      "东南亚": "Ruangguru、Zenius、Pahamify",
      "印度": "BYJU'S、Vedantu、Unacademy",
      "拉美": "Descomplica、Provi、Me Salva!",
      "中东与北非": "Noon Academy、Abwaab、Alison",
      "非洲": "uLesson、Eneza Education",
      "欧洲": "Photomath、Babbel、Busuu",
      "日韩": "RISU、Z-kai、Sapix",
    },
  },
  {
    l1: "在线教育" as const,
    l2: "语言学习" as const,
    cells: {
      "中国": "流利说、多邻国（中国运营）、英语流利说",
      "美国": "Duolingo、Babbel、Rosetta Stone",
      "东南亚": "Duolingo、Cake、Elsa Speak",
      "印度": "Duolingo、British Council、EnglishScore",
      "拉美": "Duolingo、Babbel、Busuu",
      "中东与北非": "Duolingo、Cambly、Preply",
      "非洲": "Duolingo、Babbel",
      "欧洲": "Duolingo、Babbel、Busuu",
      "日韩": "Duolingo、RareJob、DMM英会話",
    },
  },
  {
    l1: "在线教育" as const,
    l2: "职业教育/考证" as const,
    cells: {
      "中国": "中公教育、华图教育、粉笔",
      "美国": "Coursera、Udacity、LinkedIn Learning",
      "东南亚": "Coursera、Udemy、Alison",
      "印度": "UpGrad、Simplilearn、Great Learning",
      "拉美": "Coursera、Udemy、Digital House",
      "中东与北非": "Coursera、Udemy、LinkedIn Learning",
      "非洲": "Coursera、Udemy、ALX",
      "欧洲": "Coursera、Udemy、FutureLearn",
      "日韩": "Coursera、Udemy、Schoo",
    },
  },
  {
    l1: "在线教育" as const,
    l2: "兴趣/素质教育" as const,
    cells: {
      "中国": "美术宝、编程猫、VIP陪练",
      "美国": "MasterClass、Skillshare、Outschool",
      "东南亚": "极少",
      "印度": "极少",
      "拉美": "极少",
      "中东与北非": "极少",
      "非洲": "极少",
      "欧洲": "MasterClass、Skillshare、Domestika",
      "日韩": "极少",
    },
  },
  {
    l1: "在线教育" as const,
    l2: "企业培训/SaaS化" as const,
    cells: {
      "中国": "云学堂、酷学院、魔学院",
      "美国": "LinkedIn Learning、Udemy Business、Coursera for Business",
      "东南亚": "LinkedIn Learning、Udemy Business",
      "印度": "LinkedIn Learning、Udemy Business、Simplilearn",
      "拉美": "LinkedIn Learning、Udemy Business",
      "中东与北非": "LinkedIn Learning、Udemy Business",
      "非洲": "LinkedIn Learning、Udemy Business",
      "欧洲": "LinkedIn Learning、Udemy Business",
      "日韩": "LinkedIn Learning、Udemy Business",
    },
  },
  {
    l1: "在线医疗" as const,
    l2: "在线问诊" as const,
    cells: {
      "中国": "平安好医生、微医、丁香医生",
      "美国": "Teladoc、Amwell、Doctor on Demand",
      "东南亚": "Halodoc、Alodokter、MyDoc",
      "印度": "Practo、DocsApp、mfine",
      "拉美": "Dr.Consulta、Conexa、Memed",
      "中东与北非": "Vezeeta、Altibbi、Aster Online",
      "非洲": "Helium Health、MyDawa、Livia",
      "欧洲": "Babylon Health（已调整）、Kry、Livi",
      "日韩": "极少",
    },
  },
  {
    l1: "在线医疗" as const,
    l2: "药品电商/配送" as const,
    cells: {
      "中国": "京东健康、阿里健康、叮当快药",
      "美国": "Amazon Pharmacy、CVS、Walgreens",
      "东南亚": "1mg（Tata）、PharmEasy、Netmeds",
      "印度": "1mg、PharmEasy、Apollo 24",
      "拉美": "待补",
      "中东与北非": "Farmacity、Pague Menos、Drogasil",
      "非洲": "1mg（中东）、Altibbi、Vezeeta",
      "欧洲": "MyDawa、Livia、Pharmacy M",
      "日韩": "Zur Rose、Shop Apotheke、Medino",
    },
  },
  {
    l1: "在线医疗" as const,
    l2: "健康管理/慢病" as const,
    cells: {
      "中国": "智云健康、微脉、糖护士",
      "美国": "Livongo（Teladoc）、Omada Health、Noom",
      "东南亚": "极少",
      "印度": "Phable、BeatO、Wellthy",
      "拉美": "极少",
      "中东与北非": "极少",
      "非洲": "极少",
      "欧洲": "MySugr、Ada Health、Kry",
      "日韩": "极少",
    },
  },
  {
    l1: "在线医疗" as const,
    l2: "心理咨询" as const,
    cells: {
      "中国": "壹心理、简单心理、KnowYourself",
      "美国": "BetterHelp、Talkspace、Calm",
      "东南亚": "极少",
      "印度": "YourDOST、InnerHour、Wysa",
      "拉美": "极少",
      "中东与北非": "极少",
      "非洲": "极少",
      "欧洲": "BetterHelp（欧洲）、Kry、Livi",
      "日韩": "极少",
    },
  },
  {
    l1: "在线医疗" as const,
    l2: "体检预约" as const,
    cells: {
      "中国": "美年大健康、爱康国宾、善诊",
      "美国": "LabCorp、Quest Diagnostics、Zocdoc",
      "东南亚": "极少",
      "印度": "Healthians、Thyrocare、1mg",
      "拉美": "极少",
      "中东与北非": "极少",
      "非洲": "极少",
      "欧洲": "极少",
      "日韩": "极少",
    },
  },
];

type Web3WideMarket =
  | "中国"
  | "美国"
  | "印尼"
  | "越南"
  | "巴西"
  | "墨西哥"
  | "印度"
  | "菲律宾"
  | "泰国"
  | "尼日利亚"
  | "阿根廷"
  | "土耳其"
  | "韩国"
  | "日本";

const WEB3_WIDE_MARKET_ORDER: Web3WideMarket[] = [
  "中国",
  "美国",
  "印尼",
  "越南",
  "巴西",
  "墨西哥",
  "印度",
  "菲律宾",
  "泰国",
  "尼日利亚",
  "阿根廷",
  "土耳其",
  "韩国",
  "日本",
];

/** Web3 To C：二级场景 → 用户核心行为 */
const WEB3_USER_BEHAVIOR: Partial<Record<SceneSubTag, string>> = {
  "中心化交易所（CEX）": "注册、KYC、法币入金、币币交易、合约杠杆",
  "去中心化交易所（DEX）": "连接钱包、代币兑换、流动性提供",
  "NFT交易市场": "浏览、出价、购买、挂单、版税收取",
  "自托管钱包": "创建钱包、备份助记词、签名交易",
  "托管钱包": "注册账户、平台代管私钥、便捷交易",
  "硬件钱包": "购买设备、离线存储、物理确认",
  "借贷协议": "抵押资产借款、管理清算风险",
  "稳定币兑换/持有": "兑换USDT/USDC、跨境转账、储蓄",
  "质押生息": "锁仓代币获奖励、流动性质押",
  "流动性挖矿": "提供代币对、赚取手续费和奖励",
  "链游玩赚": "购买游戏NFT、游戏内赚取代币",
  "游戏资产交易": "买卖租赁游戏装备、土地、角色",
  "游戏公会参与": "加入公会、获奖学金、分成收益",
  "去中心化社交": "创建身份、发布内容、积累社交图谱",
  "创作者代币": "购买KOL代币、进入专属社群",
  "内容打赏": "加密货币打赏、订阅付费内容",
  "PFP头像/身份": "购买头像类NFT、展示社交身份",
  "音乐/艺术收藏": "收藏数字艺术品、参与版税分成",
  "品牌会员/权益": "购买品牌NFT、享受线下权益",
  "票务/入场凭证": "购买活动NFT门票、转售",
  "稳定币汇款": "法币换稳定币、跨境转账、本地出金",
  "加密货币支付": "直接用BTC/ETH支付商品服务",
  "抗通胀储蓄": "收入换稳定币/比特币、对抗本币贬值",
};

/** Web2 线上场景：用户行为/目的（词条统一口径：词条名 → 行为/目的 → 玩家名单） */
const SCENE_USER_BEHAVIOR: Partial<Record<SceneSubTag, string>> = {
  综合电商: "浏览选品、下单支付、物流履约与售后",
  垂直电商: "在品类垂类站选购、比价、复购",
  社交电商: "通过内容/社交关系发现商品并成交",
  跨境电商: "跨境选品、跨境支付与清关履约",
  "二手/闲置": "发布/淘闲置、议价成交、回收换新",
  网约车: "叫车出行、行程支付与评价",
  "顺风车/拼车": "匹配同行、分摊费用、完成行程",
  "共享单车/电单车": "扫码开锁、短途骑行、按次/按时计费",
  "地图/导航": "查地点、规划路线、导航到达",
  代驾: "预约代驾、接送与支付",
  餐饮外卖: "点餐下单、配送到家、评价复购",
  "即时零售/闪购": "附近商品分钟级下单配送",
  生鲜电商: "选购生鲜、冷链配送到家",
  药品配送: "购药下单、合规配送到家",
  即时通讯: "聊天沟通、群组协作、文件往来",
  "社区/论坛": "发帖讨论、关注话题、积累社区关系",
  陌生人社交: "发现附近/匹配用户、破冰社交",
  职场社交: "建联职场人脉、求职招聘、内容互动",
  "婚恋/相亲": "匹配对象、沟通约会、关系推进",
  移动支付: "扫码/转账支付、账单管理、绑卡",
  "跨境支付/汇款": "跨境汇款、换汇、到账收款",
  "数字银行/虚拟账户": "开立数字账户、存取转、基础理财入口",
  "预付卡/储值": "充值储值、刷卡/码消费",
  聚合支付: "商户一码接入多通道收款与对账",
  手游: "下载游玩、内购、社交对战",
  "端游/页游": "安装/网页进入、付费成长、社交公会",
  云游戏: "免安装串流开玩、按时长/会员付费",
  "游戏平台/分发": "发现游戏、下载分发、社区与成就",
  "电竞/赛事": "观赛、竞猜互动、赛事门票/周边",
  娱乐直播: "观看直播、打赏互动、关注主播",
  游戏直播: "观看游戏解说、打赏、社群互动",
  "电商直播/带货": "边看边买、下单转化、主播种草",
  教育直播: "听课互动、打卡作业、续费课程",
  "企业直播/会议": "开会协作、投屏演示、录播回看",
  征信查询: "查询本人征信报告、了解信用记录",
  "债务管理/催收": "管理还款计划、协商债务；委外催收触达多归回收机构",
  短视频: "刷短视频、互动创作、关注创作者",
  "中长视频/流媒体": "点播/追剧、会员订阅、续看",
  "新闻资讯/聚合": "阅读新闻、关注栏目、推送订阅",
  "知识付费/专栏": "购买课程/专栏、学习打卡",
  "播客/音频": "收听播客、订阅更新、付费节目",
  "企业通讯/协同": "团队沟通、审批协同、组织通讯",
  项目管理: "拆解任务、跟踪进度、协作交付",
  "云存储/云服务": "存储同步文件、协作共享、算力订阅",
  "在线文档/表格": "多人编辑文档表格、评论修订",
  电子签章: "在线签署文件、加盖电子章、完成法律效力签署",
  电子合同: "在线起草/审批/签署电子合同、归档履约",
  "在线公证/存证": "电子数据存证、在线公证、证据固证",
  "法律咨询/智能法务": "咨询法律问题、生成文书、对接律师服务",
  到店团购: "选团购、到店核销、评价返利",
  "酒店/民宿预订": "搜房比价、预订入住、取消改期",
  "票务/电影/演出": "选座购票、取票入场、改签退票",
  "家政/保洁服务": "预约上门服务、支付与评价",
  "美容/美发预约": "选店预约、到店服务、会员复购",
  K12学科辅导: "选课学习、练习测评、家长督学",
  语言学习: "跟读练习、词汇语法、外教/AI陪练",
  "职业教育/考证": "备考课程、题库刷题、考证辅导",
  "兴趣/素质教育": "兴趣课学习、作品打卡、社群陪练",
  "企业培训/SaaS化": "企业内训、学习管理、考核认证",
  在线问诊: "图文/视频问诊、开方建议、复诊随访",
  "药品电商/配送": "购药下单、处方核验、配送到家",
  "健康管理/慢病": "监测指标、随访提醒、慢病管理",
  心理咨询: "预约咨询、线上疏导、疗程跟进",
  体检预约: "选套餐预约、到检报告、解读随访",
};

/** Web3 To C：二级 → 子域（数字资产交易/钱包/DeFi/GameFi/SocialFi/数字藏品/跨境支付） */
const WEB3_SUB_DOMAIN: Partial<Record<SceneSubTag, string>> = {
  "中心化交易所（CEX）": "数字资产交易",
  "去中心化交易所（DEX）": "数字资产交易",
  "NFT交易市场": "数字资产交易",
  "自托管钱包": "钱包与资产托管",
  "托管钱包": "钱包与资产托管",
  "硬件钱包": "钱包与资产托管",
  "借贷协议": "DeFi服务",
  "稳定币兑换/持有": "DeFi服务",
  "质押生息": "DeFi服务",
  "流动性挖矿": "DeFi服务",
  "链游玩赚": "GameFi",
  "游戏资产交易": "GameFi",
  "游戏公会参与": "GameFi",
  "去中心化社交": "SocialFi",
  "创作者代币": "SocialFi",
  "内容打赏": "SocialFi",
  "PFP头像/身份": "数字藏品",
  "音乐/艺术收藏": "数字藏品",
  "品牌会员/权益": "数字藏品",
  "票务/入场凭证": "数字藏品",
  "稳定币汇款": "跨境支付",
  "加密货币支付": "跨境支付",
  "抗通胀储蓄": "跨境支付",
};

/** Web3 To C 场景大宽表（14 市场） */
const WEB3_SCENE_WIDE_TABLE: {
  l1: "Web3";
  l2: SceneSubTag;
  domain: string;
  cells: Record<Web3WideMarket, string>;
}[] = [
  {
    l1: "Web3" as const,
    l2: "中心化交易所（CEX）" as const,
    domain: "数字资产交易",
    cells: {
      "中国": "币安（原）、OKX、火币HTX、Gate.io",
      "美国": "Coinbase、Kraken、Gemini、Binance.US",
      "印尼": "Indodax、Tokocrypto、Pintu、Rekeningku",
      "越南": "Remitano、Pintu、Foxpay、Nami Exchange",
      "巴西": "Mercado Bitcoin、Foxbit、NovaDAX、BitPreço",
      "墨西哥": "Bitso、Volabit、Bitlem、Tio Crypto",
      "印度": "WazirX（币安）、CoinDCX、ZebPay、Unocoin",
      "菲律宾": "Coins.ph、PDAX、BloomX、Binance P2P",
      "泰国": "Bitkub、Satang Pro、Zipmex（重组）",
      "尼日利亚": "Yellow Card、Quidax、Patricia",
      "阿根廷": "Lemon Cash、Buenbit、Ripio、SatoshiTango",
      "土耳其": "BtcTurk、Paribu、Bitexen",
      "韩国": "Upbit、Bithumb、Coinone、Korbit",
      "日本": "bitFlyer、Coincheck、GMO Coin、Zaif",
    },
  },
  {
    l1: "Web3" as const,
    l2: "去中心化交易所（DEX）" as const,
    domain: "数字资产交易",
    cells: {
      "中国": "dYdX（团队）、1inch（团队）、Tokenlon",
      "美国": "Uniswap、PancakeSwap、dYdX、GMX、Curve",
      "印尼": "用户使用",
      "越南": "用户使用",
      "巴西": "用户使用",
      "墨西哥": "用户使用",
      "印度": "用户使用",
      "菲律宾": "用户使用",
      "泰国": "用户使用",
      "尼日利亚": "用户使用",
      "阿根廷": "用户使用",
      "土耳其": "用户使用",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "NFT交易市场" as const,
    domain: "数字资产交易",
    cells: {
      "中国": "OpenSea（用户）、Blur（用户）、Element、X2Y2",
      "美国": "OpenSea、Blur、Magic Eden、LooksRare、SuperRare",
      "印尼": "用户使用",
      "越南": "用户使用",
      "巴西": "用户使用",
      "墨西哥": "用户使用",
      "印度": "用户使用",
      "菲律宾": "用户使用",
      "泰国": "用户使用",
      "尼日利亚": "用户使用",
      "阿根廷": "用户使用",
      "土耳其": "用户使用",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "自托管钱包" as const,
    domain: "钱包与托管",
    cells: {
      "中国": "imToken、TokenPocket、BitKeep（原）、OneKey",
      "美国": "MetaMask、Phantom、Rainbow、Rabby、Backpack",
      "印尼": "用户使用",
      "越南": "用户使用",
      "巴西": "用户使用",
      "墨西哥": "用户使用",
      "印度": "用户使用",
      "菲律宾": "用户使用",
      "泰国": "用户使用",
      "尼日利亚": "用户使用",
      "阿根廷": "用户使用",
      "土耳其": "用户使用",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "托管钱包" as const,
    domain: "钱包与托管",
    cells: {
      "中国": "交易所钱包、麦子钱包",
      "美国": "Coinbase Wallet、Blockchain.com、Binance Web3 Wallet",
      "印尼": "Pintu、Luno",
      "越南": "Pintu、Luno",
      "巴西": "Mercado Bitcoin Wallet",
      "墨西哥": "Bitso Wallet",
      "印度": "WazirX Wallet、ZebPay",
      "菲律宾": "Coins.ph Wallet",
      "泰国": "Bitkub Wallet",
      "尼日利亚": "Yellow Card Wallet",
      "阿根廷": "Lemon Cash Wallet",
      "土耳其": "BtcTurk Wallet",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "硬件钱包" as const,
    domain: "钱包与托管",
    cells: {
      "中国": "OneKey（原）、Cobo Vault",
      "美国": "Ledger、Trezor、GridPlus、Keystone",
      "印尼": "用户使用",
      "越南": "用户使用",
      "巴西": "用户使用",
      "墨西哥": "用户使用",
      "印度": "用户使用",
      "菲律宾": "用户使用",
      "泰国": "用户使用",
      "尼日利亚": "用户使用",
      "阿根廷": "用户使用",
      "土耳其": "用户使用",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "借贷协议" as const,
    domain: "DeFi服务",
    cells: {
      "中国": "用户使用",
      "美国": "Aave、Compound、MakerDAO、Morpho、Radiant",
      "印尼": "用户使用",
      "越南": "用户使用",
      "巴西": "用户使用",
      "墨西哥": "用户使用",
      "印度": "用户使用",
      "菲律宾": "用户使用",
      "泰国": "用户使用",
      "尼日利亚": "用户使用",
      "阿根廷": "用户使用",
      "土耳其": "用户使用",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "稳定币兑换/持有" as const,
    domain: "DeFi服务",
    cells: {
      "中国": "用户使用",
      "美国": "Curve、Uniswap、USDT/USDC/DAI",
      "印尼": "用户使用",
      "越南": "用户使用",
      "巴西": "用户使用",
      "墨西哥": "用户使用",
      "印度": "用户使用",
      "菲律宾": "用户使用",
      "泰国": "用户使用",
      "尼日利亚": "用户使用",
      "阿根廷": "用户使用",
      "土耳其": "用户使用",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "质押生息" as const,
    domain: "DeFi服务",
    cells: {
      "中国": "用户使用",
      "美国": "Lido、Rocket Pool、Coinbase Staking、EigenLayer",
      "印尼": "用户使用",
      "越南": "用户使用",
      "巴西": "用户使用",
      "墨西哥": "用户使用",
      "印度": "用户使用",
      "菲律宾": "用户使用",
      "泰国": "用户使用",
      "尼日利亚": "用户使用",
      "阿根廷": "用户使用",
      "土耳其": "用户使用",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "流动性挖矿" as const,
    domain: "DeFi服务",
    cells: {
      "中国": "用户使用",
      "美国": "Yearn Finance、Convex Finance、Beefy Finance、Aura Finance",
      "印尼": "用户使用",
      "越南": "用户使用",
      "巴西": "用户使用",
      "墨西哥": "用户使用",
      "印度": "用户使用",
      "菲律宾": "用户使用",
      "泰国": "用户使用",
      "尼日利亚": "用户使用",
      "阿根廷": "用户使用",
      "土耳其": "用户使用",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "链游玩赚" as const,
    domain: "GameFi",
    cells: {
      "中国": "用户使用、StepN（团队）",
      "美国": "Axie Infinity（历史）、The Sandbox、Decentraland、Illuvium、Gods Unchained",
      "印尼": "用户使用",
      "越南": "Sky Mavis（Ronin）、Ancient8、Axie Infinity玩家",
      "巴西": "用户使用",
      "墨西哥": "用户使用",
      "印度": "用户使用",
      "菲律宾": "Yield Guild Games（YGG）、Axie Infinity（历史核心市场）",
      "泰国": "用户使用",
      "尼日利亚": "用户使用",
      "阿根廷": "用户使用",
      "土耳其": "用户使用",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "游戏资产交易" as const,
    domain: "GameFi",
    cells: {
      "中国": "用户使用",
      "美国": "OpenSea、Blur、Immutable X Marketplace、Treasure",
      "印尼": "用户使用",
      "越南": "用户使用",
      "巴西": "用户使用",
      "墨西哥": "用户使用",
      "印度": "用户使用",
      "菲律宾": "用户使用",
      "泰国": "用户使用",
      "尼日利亚": "用户使用",
      "阿根廷": "用户使用",
      "土耳其": "用户使用",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "游戏公会参与" as const,
    domain: "GameFi",
    cells: {
      "中国": "用户使用",
      "美国": "Yield Guild Games、Merit Circle、Avocado DAO、IndiGG",
      "印尼": "用户使用",
      "越南": "用户使用",
      "巴西": "用户使用",
      "墨西哥": "用户使用",
      "印度": "IndiGG",
      "菲律宾": "Yield Guild Games（YGG）核心市场",
      "泰国": "用户使用",
      "尼日利亚": "用户使用",
      "阿根廷": "用户使用",
      "土耳其": "用户使用",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "去中心化社交" as const,
    domain: "SocialFi",
    cells: {
      "中国": "用户使用",
      "美国": "Lens Protocol、Farcaster、Friend.tech、DeSo、Nostr",
      "印尼": "用户使用",
      "越南": "用户使用",
      "巴西": "用户使用",
      "墨西哥": "用户使用",
      "印度": "用户使用",
      "菲律宾": "用户使用",
      "泰国": "用户使用",
      "尼日利亚": "用户使用",
      "阿根廷": "用户使用",
      "土耳其": "用户使用",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "创作者代币" as const,
    domain: "SocialFi",
    cells: {
      "中国": "用户使用",
      "美国": "Friend.tech Keys、Rally（已关闭）、Roll、BitClout（DeSo）",
      "印尼": "用户使用",
      "越南": "用户使用",
      "巴西": "用户使用",
      "墨西哥": "用户使用",
      "印度": "用户使用",
      "菲律宾": "用户使用",
      "泰国": "用户使用",
      "尼日利亚": "用户使用",
      "阿根廷": "用户使用",
      "土耳其": "用户使用",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "内容打赏" as const,
    domain: "SocialFi",
    cells: {
      "中国": "用户使用",
      "美国": "Mirror、Paragraph、Stack、Hypersub、Zora",
      "印尼": "用户使用",
      "越南": "用户使用",
      "巴西": "用户使用",
      "墨西哥": "用户使用",
      "印度": "用户使用",
      "菲律宾": "用户使用",
      "泰国": "用户使用",
      "尼日利亚": "用户使用",
      "阿根廷": "用户使用",
      "土耳其": "用户使用",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "PFP头像/身份" as const,
    domain: "数字藏品",
    cells: {
      "中国": "用户使用",
      "美国": "CryptoPunks、Bored Ape Yacht Club、Azuki、Moonbirds、Doodles",
      "印尼": "用户使用",
      "越南": "用户使用",
      "巴西": "用户使用",
      "墨西哥": "用户使用",
      "印度": "用户使用",
      "菲律宾": "用户使用",
      "泰国": "用户使用",
      "尼日利亚": "用户使用",
      "阿根廷": "用户使用",
      "土耳其": "用户使用",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "音乐/艺术收藏" as const,
    domain: "数字藏品",
    cells: {
      "中国": "用户使用",
      "美国": "Royal、Sound、Catalog、Async Art、SuperRare、Foundation",
      "印尼": "用户使用",
      "越南": "用户使用",
      "巴西": "用户使用",
      "墨西哥": "用户使用",
      "印度": "用户使用",
      "菲律宾": "用户使用",
      "泰国": "用户使用",
      "尼日利亚": "用户使用",
      "阿根廷": "用户使用",
      "土耳其": "用户使用",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "品牌会员/权益" as const,
    domain: "数字藏品",
    cells: {
      "中国": "用户使用",
      "美国": "Nike .SWOOSH、Adidas Originals、Starbucks Odyssey（已关闭）、Reddit Collectible Avatars",
      "印尼": "用户使用",
      "越南": "用户使用",
      "巴西": "用户使用",
      "墨西哥": "用户使用",
      "印度": "用户使用",
      "菲律宾": "用户使用",
      "泰国": "用户使用",
      "尼日利亚": "用户使用",
      "阿根廷": "用户使用",
      "土耳其": "用户使用",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "票务/入场凭证" as const,
    domain: "数字藏品",
    cells: {
      "中国": "用户使用",
      "美国": "YellowHeart、GET Protocol、NFT TiX、Tokenproof",
      "印尼": "用户使用",
      "越南": "用户使用",
      "巴西": "用户使用",
      "墨西哥": "用户使用",
      "印度": "用户使用",
      "菲律宾": "用户使用",
      "泰国": "用户使用",
      "尼日利亚": "用户使用",
      "阿根廷": "用户使用",
      "土耳其": "用户使用",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "稳定币汇款" as const,
    domain: "跨境支付",
    cells: {
      "中国": "用户使用（OTC）",
      "美国": "Circle（USDC）、Tether（USDT）、Strike、Bitso",
      "印尼": "用户使用",
      "越南": "用户使用",
      "巴西": "用户使用",
      "墨西哥": "Bitso（美墨走廊）",
      "印度": "用户使用",
      "菲律宾": "用户使用（海外劳工）",
      "泰国": "用户使用",
      "尼日利亚": "用户使用（侨汇替代）",
      "阿根廷": "用户使用（通胀对冲）",
      "土耳其": "用户使用（里拉贬值）",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "加密货币支付" as const,
    domain: "跨境支付",
    cells: {
      "中国": "用户使用",
      "美国": "BitPay、Coinbase Commerce、Flexa、Strike、Lightning Network",
      "印尼": "用户使用",
      "越南": "用户使用",
      "巴西": "用户使用",
      "墨西哥": "用户使用",
      "印度": "用户使用",
      "菲律宾": "用户使用",
      "泰国": "用户使用",
      "尼日利亚": "用户使用",
      "阿根廷": "用户使用",
      "土耳其": "用户使用",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
  {
    l1: "Web3" as const,
    l2: "抗通胀储蓄" as const,
    domain: "跨境支付",
    cells: {
      "中国": "用户使用（OTC/灰色）",
      "美国": "用户使用",
      "印尼": "用户使用",
      "越南": "用户使用",
      "巴西": "用户使用",
      "墨西哥": "用户使用",
      "印度": "用户使用",
      "菲律宾": "用户使用",
      "泰国": "用户使用",
      "尼日利亚": "用户使用（奈拉贬值）",
      "阿根廷": "核心场景（比索崩溃）",
      "土耳其": "核心场景（里拉暴跌）",
      "韩国": "用户使用",
      "日本": "用户使用",
    },
  },
];

const WEB3_MARKET_NOTES: { market: string; coreScenes: string; examples: string; context: string }[] = [
  {"market": "菲律宾", "coreScenes": "GameFi（历史）、稳定币汇款", "examples": "Yield Guild Games（YGG）、Axie Infinity（2021-2022高峰）、Coins.ph", "context": "海外劳工汇款需求、游戏公会模式发源地"},
  {"market": "越南", "coreScenes": "GameFi开发、公链", "examples": "Sky Mavis（Ronin链）、Ancient8", "context": "开发者密集、Axie Infinity团队来源"},
  {"market": "印尼", "coreScenes": "CEX合规交易、支付整合", "examples": "Indodax、Tokocrypto（币安投资）、Pintu", "context": "Bappebti监管清晰、穆斯林金融需求"},
  {"market": "巴西", "coreScenes": "CEX、数字银行+加密、NFT", "examples": "Mercado Bitcoin、Nubank（加密整合）、Foxbit", "context": "Pix系统便利法币出入金、拉美最大市场"},
  {"market": "墨西哥", "coreScenes": "稳定币汇款、CEX", "examples": "Bitso（Ripple ODL）、Volabit", "context": "美墨汇款走廊、近岸外包金融需求"},
  {"market": "尼日利亚", "coreScenes": "P2P交易、抗通胀储蓄、稳定币汇款", "examples": "Yellow Card、Quidax、Patricia、Paxful（历史）", "context": "奈拉持续贬值、央行曾禁止银行服务加密"},
  {"market": "阿根廷", "coreScenes": "抗通胀储蓄、稳定币支付", "examples": "Lemon Cash、Buenbit、Ripio、SatoshiTango", "context": "比索崩溃、通胀100%+、美元化替代"},
  {"market": "土耳其", "coreScenes": "抗通胀储蓄、CEX", "examples": "BtcTurk、Paribu、Bitexen", "context": "里拉暴跌、资本管制、加密替代美元"},
  {"market": "韩国", "coreScenes": "CEX交易、GameFi、SocialFi", "examples": "Upbit、Bithumb、Wemade（链游）、Kaia（原Klaytn）", "context": "泡菜溢价、游戏强国、监管严格（实名制）"},
  {"market": "日本", "coreScenes": "CEX合规交易、企业NFT", "examples": "bitFlyer、Coincheck、GMO Coin、Sorare（运营）", "context": "金融厅监管严格、法币交易所牌照稀缺"},
];

const WEB3_FINANCE_OPPS: { scene: string; priorityMarkets: string; product: string; players: string }[] = [
  {"scene": "CEX杠杆借贷", "priorityMarkets": "韩国、美国、全球", "product": "保证金借贷、信用卡入金、工资直连", "players": "Binance Margin、Coinbase（历史）、Upbit"},
  {"scene": "NFT BNPL/抵押", "priorityMarkets": "美国、韩国、全球", "product": "先买后付、NFTfi抵押贷款", "players": "Teller、BendDAO、JPEG'd、Blur（Blend）"},
  {"scene": "链游入门金融化", "priorityMarkets": "菲律宾、越南、东南亚", "product": "奖学金模式、游戏资产分期", "players": "YGG、Merit Circle、Avocado DAO、IndiGG"},
  {"scene": "DeFi信用贷", "priorityMarkets": "全球（早期）", "product": "链上信用评分、无抵押借贷", "players": "Arcx、Spectral、Teller、Goldfinch（机构向）"},
  {"scene": "稳定币汇款+储蓄", "priorityMarkets": "阿根廷、土耳其、尼日利亚、墨西哥、菲律宾", "product": "嵌入式储蓄生息、汇款即理财", "players": "Bitso、Strike、Yellow Card、Lemon Cash"},
  {"scene": "流动性质押", "priorityMarkets": "以太坊生态全球", "product": "LST代币、再质押、收益聚合", "players": "Lido、EigenLayer、Ether.fi、Jito"},
  {"scene": "SocialFi创作者金融", "priorityMarkets": "全球（极早期）", "product": "创作者收益预支、代币质押借款", "players": "无成熟产品，Friend.tech探索中"},
];

/**
 * 玩家指标口径（2026-08）：
 * - 共用底盘（弱权重）：规模档、用户、可核验时点、置信度——只作排序辅助
 * - 分型主尺（强权重）：场景原生 / 信贷原生 / 钱包支付 / 数字银行
 * - 缺数标「不可比」，禁止用下载量或单次新闻增速填主尺
 * 进度条仅为组内相对示意，非审计结论。
 */
type PlatformArchetype = "超级平台" | "综合平台" | "垂直平台";
type KpiMetricKind = "scene" | "credit" | "wallet" | "digibank";
type KpiConfidence = "高" | "中" | "低";
type KpiMetricLine = {
  title: string;
  label: string;
  fill: number;
  /** false=缺数/不可核验，展示「不可比」 */
  comparable: boolean;
};
type PlayerKpi = {
  ticker?: string;
  archetype?: PlatformArchetype;
  kind: KpiMetricKind;
  kindLabel: string;
  base: {
    scale: KpiMetricLine;
    users: KpiMetricLine;
    asOf: string;
    confidence: KpiConfidence;
  };
  primary: KpiMetricLine[];
  note?: string;
};

/** 旧版场景 KPI 槽（规模/用户/增速）；resolve 时升为分型口径 */
type LegacySceneKpi = {
  ticker?: string;
  archetype?: PlatformArchetype;
  gmv: string;
  gmvFill: number;
  users: string;
  usersFill: number;
  growth: string;
  growthFill: number;
  note?: string;
};

const KPI_KIND_LABEL: Record<KpiMetricKind, string> = {
  scene: "场景原生主尺",
  credit: "信贷原生主尺",
  wallet: "钱包/支付主尺",
  digibank: "数字银行主尺",
};

function kpiTextMissing(text: string): boolean {
  const s = (text || "").trim();
  if (!s || s === "—" || s === "-") return true;
  return /待核实|未公开|未查到|细数待|不可比|公开.{0,6}未|增速未|规模待|用户待|集团收入YoY待/.test(s);
}

function kpiLine(title: string, label: string, fill: number, comparable?: boolean): KpiMetricLine {
  const missing = comparable === false || kpiTextMissing(label);
  return {
    title,
    label: missing ? (kpiTextMissing(label) ? "不可比" : label) : label,
    fill: missing ? 0 : fill,
    comparable: !missing,
  };
}

function inferKpiConfidence(...parts: string[]): KpiConfidence {
  const blob = parts.join(" ");
  if (/双端通过|招股|20-F|10-K|年报|IR\/披露|监管名录/.test(blob)) return "高";
  if (/待核实|未公开|未查到|冲突|〔1〕/.test(blob)) return "低";
  return "中";
}

function classifySceneKpiKind(r: SceneRow): KpiMetricKind {
  const tags = r.tags || [];
  const onlyWallet =
    tags.includes("支付钱包") && tags.filter((t) => t !== "支付钱包" && t !== "信用管理").length === 0;
  if (onlyWallet || /钱包|Wallet|Pay（|支付（/.test(r.group)) {
    if (/数字银行|虚拟银行|吸储/.test(`${r.group} ${r.licenseReg} ${r.creditAttach}`)) return "digibank";
    return "wallet";
  }
  if (/数字银行|虚拟银行/.test(`${r.group} ${r.licenseReg}`)) return "digibank";
  return "scene";
}

function classifyCreditKpiKind(r: CreditRow): KpiMetricKind {
  const blob = `${r.group} ${r.licenses} ${r.licenseReg} ${r.note} ${r.brands}`;
  if (/数字银行|虚拟银行|digibank|吸储|Digital Bank|Virtual Bank/i.test(blob)) return "digibank";
  if (
    (r.paymentKinds?.length || /钱包|Wallet|EMI|PPI|SVF|电子货币|收单/.test(blob)) &&
    r.line !== "cash" &&
    !/现金贷|消费贷|放款/.test(blob)
  ) {
    return "wallet";
  }
  return "credit";
}

function buildScenePrimary(r: SceneRow, legacy?: LegacySceneKpi): KpiMetricLine[] {
  const attachRaw = (r.creditAttach || "").trim() || "不可比";
  const attach = kpiLine("金融附加 attach", attachRaw, /派生|信贷|月付|分期|借贷|金融/.test(attachRaw) ? 28 : 0);
  const finBlob = `${r.share} ${r.creditAttach} ${legacy?.note || ""} ${legacy?.gmv || ""}`;
  const finHit = finBlob.match(/(金融|信贷|利息|科技服务|支付)[^\n；;]{0,24}/);
  const finLabel = finHit ? finHit[0].slice(0, 48) : "不可比";
  const fin = kpiLine("金融贡献", finLabel, finHit ? 22 : 0);
  const distBlob = `${r.controller} ${r.equity} ${r.creditAttach}`;
  const distLabel = /合作|导流|分发|入口|生态|派生/.test(distBlob)
    ? distBlob.split(/[；;\n]/)[0].slice(0, 48) || "生态/合作分发（粗）"
    : "不可比";
  const dist = kpiLine("分发依赖", distLabel, /不可比/.test(distLabel) ? 0 : 18);
  return [attach, fin, dist];
}

function buildCreditPrimary(r: CreditRow, scale: { label: string; fill: number }, growthLabel: string): KpiMetricLine[] {
  const orig = kpiLine("发放/撮合", scale.label, scale.fill);
  const aumHit = `${r.volume} ${r.note}`.match(/(AUM|余额|贷款余额|在贷|portfolio)[^\n；;]{0,28}/i);
  const aum = kpiLine("AUM/在贷", aumHit ? aumHit[0].slice(0, 48) : "不可比", aumHit ? Math.max(8, scale.fill) : 0);
  const nplHit = `${r.note} ${r.volume}`.match(/(NPL|不良|逾期|vintage|资产质量)[^\n；;]{0,28}/i);
  const npl = kpiLine("资产质量", nplHit ? nplHit[0].slice(0, 48) : "不可比", nplHit ? 20 : 0);
  const fundHit = `${r.note} ${r.licenses} ${r.licenseReg}`.match(/(资金成本|NIM|净息差|ABS|助贷|表内|吸储|同业)[^\n；;]{0,28}/i);
  const fund = kpiLine("资金成本/结构", fundHit ? fundHit[0].slice(0, 48) : "不可比", fundHit ? 18 : 0);
  // 增速不进主尺；若只有增速可核验也不用下载量填洞
  void growthLabel;
  return [orig, aum, npl, fund];
}

function buildWalletPrimary(r: SceneRow | CreditRow, usersLine: KpiMetricLine, scaleLine: KpiMetricLine): KpiMetricLine[] {
  const blob =
    "share" in r
      ? `${r.share} ${r.mau} ${r.creditAttach}`
      : `${r.volume} ${r.note} ${r.traffic}`;
  const tpvHit = blob.match(/(TPV|交易额|流水|支付额|GMV)[^\n；;]{0,28}/i);
  const tpv = kpiLine(
    "TPV/流水",
    tpvHit ? tpvHit[0].slice(0, 48) : scaleLine.comparable ? scaleLine.label : "不可比",
    tpvHit ? 30 : scaleLine.comparable ? Math.min(24, scaleLine.fill) : 0,
  );
  const active = kpiLine("活跃", usersLine.comparable ? usersLine.label : "不可比", usersLine.fill);
  const licBlob = "licenseReg" in r ? `${r.licenseReg}` : "";
  const licExtra = "licenses" in r ? `${(r as CreditRow).licenses}` : "";
  const regHit = `${licBlob} ${licExtra}`.match(/(EMI|PPI|SVF|PJP|电子货币|支付牌照|监管名录|持牌)[^\n；;]{0,24}/i);
  const reg = kpiLine(
    "监管名录/牌照",
    regHit ? regHit[0].slice(0, 48) : licBlob.trim() ? licBlob.split(/[；;\n]/)[0].slice(0, 48) : "不可比",
    regHit || licBlob.trim() ? 24 : 0,
  );
  return [tpv, active, reg];
}

function buildDigibankPrimary(r: SceneRow | CreditRow, scale: { label: string; fill: number }): KpiMetricLine[] {
  const blob =
    "volume" in r
      ? `${r.volume} ${r.note} ${r.licenses} ${r.licenseReg}`
      : `${r.share} ${r.creditAttach} ${r.licenseReg}`;
  const depHit = blob.match(/(存款|吸储|deposit)[^\n；;]{0,28}/i);
  const loanHit = blob.match(/(贷款|放款|loan|credit balance|在贷)[^\n；;]{0,28}/i);
  const nplHit = blob.match(/(NPL|不良|逾期|资产质量)[^\n；;]{0,28}/i);
  return [
    kpiLine("存款/吸储", depHit ? depHit[0].slice(0, 48) : "不可比", depHit ? 28 : 0),
    kpiLine("贷款/在贷", loanHit ? loanHit[0].slice(0, 48) : scale.label && !kpiTextMissing(scale.label) ? scale.label : "不可比", loanHit ? 28 : scale.fill),
    kpiLine("资产质量", nplHit ? nplHit[0].slice(0, 48) : "不可比", nplHit ? 20 : 0),
  ];
}

const SCENE_PLAYER_KPI: Record<string, LegacySceneKpi> = {
  "蚂蚁集团/支付宝（蚂蚁·CN）": {
    archetype: "超级平台",
    gmv: "支付年交易额约¥300万亿级（生态口径；待核最新）",
    gmvFill: 100,
    users: "年活/生态常称10亿+；MAU约6–7亿",
    usersFill: 50,
    growth: "未单独上市披露集团收入YoY",
    growthFill: 0,
    note: "规模为支付流水量级，非商品GMV",
  },
  "腾讯控股/微信（腾讯·CN）": {
    ticker: "0700.HK",
    archetype: "超级平台",
    gmv: "小程序GMV双位数增长（未披露全量绝对值）",
    gmvFill: 40,
    users: "微信MAU约14.1–14.3亿（2025末/2026初）",
    usersFill: 100,
    growth: "腾讯集团收入FY2025约+14%",
    growthFill: 28,
  },
  "美团（美团·CN）": {
    ticker: "3690.HK",
    archetype: "超级平台",
    gmv: "全场景GTV约¥1.2万亿级（历史披露量级；FY2025双位数增长）",
    gmvFill: 100,
    users: "年交易用户创新高（FY2024>7.7亿；FY2025再创新高）",
    usersFill: 55,
    growth: "集团收入FY2025 ¥3649亿 · YoY +8%",
    growthFill: 16,
  },
  "京东集团/京东（京东·CN）": {
    ticker: "JD.US / 9618.HK",
    archetype: "综合平台",
    gmv: "零售GMV约¥3万亿级（第三方/历史口径；待核最新）",
    gmvFill: 100,
    users: "年活用户约6–7亿级",
    usersFill: 48,
    growth: "集团收入YoY中个位数（近年放缓；待核最新年报）",
    growthFill: 8,
  },
  "滴滴出行/滴滴（滴滴·CN）": {
    ticker: "DIDIY.US",
    archetype: "超级平台",
    gmv: "中国出行GTV未稳定披露；Q4'25日均约3890万单",
    gmvFill: 35,
    users: "MAU未稳定披露（以订单规模对照）",
    usersFill: 20,
    growth: "集团收入YoY待核最新年报",
    growthFill: 0,
  },
  "Sea Limited/Shopee（Sea·SEA）": {
    ticker: "SE.US",
    archetype: "综合平台",
    gmv: "Shopee GMV FY2025 $127.4B（+26.8% YoY）",
    gmvFill: 74,
    users: "不披露统一MAU（以订单/GMV对照）",
    usersFill: 25,
    growth: "Sea集团收入FY2025 $22.9B · YoY +36.4%",
    growthFill: 73,
  },
  "Grab Holdings/Grab（Grab·SEA）": {
    ticker: "GRAB.US",
    archetype: "超级平台",
    gmv: "On-Demand GMV FY2025 $22.1B（+21%）",
    gmvFill: 18,
    users: "集团MTU FY2025均约4720万；Q4'25 5050万",
    usersFill: 34,
    growth: "集团收入FY2025 $3.37B · YoY +20%",
    growthFill: 40,
  },
  "GoTo/Gojek（GoTo·ID）": {
    ticker: "GOTO.JK",
    archetype: "综合平台",
    gmv: "集团GTV FY2025约IDR 686万亿（约+$40B级）",
    gmvFill: 25,
    users: "ATU FY2025约6600万",
    usersFill: 47,
    growth: "集团净收入FY2025约+24% YoY",
    growthFill: 48,
  },
  "Delivery Hero/Foodpanda（Foodpanda·SEA）": {
    ticker: "DHER.DE",
    archetype: "垂直平台",
    gmv: "Delivery Hero全球GMV约€40B+级（区域Foodpanda待拆）",
    gmvFill: 30,
    users: "区域用户待拆（东南亚份额承压）",
    usersFill: 15,
    growth: "集团收入YoY个位数–低双位数（待核最新）",
    growthFill: 12,
  },
  "Xanh SM（Xanh SM·VN）": {
    archetype: "垂直平台",
    gmv: "未公开",
    gmvFill: 0,
    users: "未公开",
    usersFill: 0,
    growth: "未公开",
    growthFill: 0,
  },
  "Lazada/Lazada（Lazada·SEA）": {
    archetype: "垂直平台",
    gmv: "SEA电商GMV份额落后Shopee（绝对值未公开）",
    gmvFill: 12,
    users: "未公开统一MAU",
    usersFill: 10,
    growth: "阿里国际数字商业分部口径；单体YoY待核",
    growthFill: 0,
  },
  "ByteDance/TikTok（字节·SEA）": {
    archetype: "超级平台",
    gmv: "TikTok Shop全球GMV高速增长（区域全口径待拆）",
    gmvFill: 45,
    users: "全球月活十余亿级（集团；国别待拆）",
    usersFill: 90,
    growth: "字节集团收入高双位数增长（未上市；估算）",
    growthFill: 60,
  },
  "Akulaku/Akulaku（阿卡拉克·SEA）": {
    archetype: "综合平台",
    gmv: "电商+信贷GMV未统一披露",
    gmvFill: 8,
    users: "注册>4000万（至2024）",
    usersFill: 28,
    growth: "未公开集团收入YoY",
    growthFill: 0,
  },
  "PhonePe/PhonePe（PhonePe·IN）": {
    archetype: "超级平台",
    gmv: "UPI支付流水印度头部（年交易额数十万亿卢比级）",
    gmvFill: 55,
    users: "MAC约2.38亿",
    usersFill: 17,
    growth: "交易笔数/金额双位数增长（收入YoY未上市披露）",
    growthFill: 30,
  },
  "One97/Paytm（Paytm·IN）": {
    ticker: "PAYTM.NS",
    archetype: "综合平台",
    gmv: "支付+信贷GMV待核最新年报",
    gmvFill: 15,
    users: "MTU约7500–7600万",
    usersFill: 54,
    growth: "集团收入YoY近年承压/转正波动（待核最新）",
    growthFill: 5,
  },
  "Flipkart/Flipkart（Flipkart·IN）": {
    archetype: "综合平台",
    gmv: "印度电商GMV头部梯队（沃尔玛控股；绝对值待核）",
    gmvFill: 28,
    users: "年活约2.2–2.4亿",
    usersFill: 17,
    growth: "GMV/收入双位数增长（非独立上市）",
    growthFill: 25,
  },
  "DiDi/99（滴滴·LATAM）": {
    ticker: "DIDIY.US",
    archetype: "综合平台",
    gmv: "拉美出行+外卖GTV待集团拆分披露",
    gmvFill: 16,
    users: "墨约3000万、巴约5500万活跃量级",
    usersFill: 40,
    growth: "国际业务收入YoY待核最新年报",
    growthFill: 0,
  },
  "Mercado Libre/Mercado Libre（美卡多·LATAM）": {
    ticker: "MELI.US",
    archetype: "超级平台",
    gmv: "Commerce GMV FY2025 $65B（+26% YoY）",
    gmvFill: 38,
    users: "年独特买家>1.2亿；Pago MAU近7800万",
    usersFill: 86,
    growth: "集团净收入FY2025约+39% YoY",
    growthFill: 78,
  },
  "Rappi/Rappi（Rappi·LATAM）": {
    archetype: "垂直平台",
    gmv: "拉美即时配送GMV未公开精确值",
    gmvFill: 10,
    users: "宣称活跃3000万+",
    usersFill: 21,
    growth: "未上市；收入YoY待核实",
    growthFill: 0,
  },
  "饿了么（饿了么·CN）": {
    archetype: "垂直平台",
    gmv: "外卖GTV约¥0.4–0.6万亿级（估算/行业对照）",
    gmvFill: 42,
    users: "年活待核实（阿里本地生活分部）",
    usersFill: 25,
    growth: "并入阿里本地生活；单体收入YoY未单列",
    growthFill: 0,
  },
  "Safaricom/M-Pesa（M-Pesa·KE）": {
    ticker: "SCOM.NR",
    archetype: "超级平台",
    gmv: "移动货币年交易额肯尼亚GDP量级占比高",
    gmvFill: 20,
    users: "肯尼亚月活约3600–4400万",
    usersFill: 30,
    growth: "Safaricom集团收入YoY中个位数–低双位数",
    growthFill: 12,
  },
  "OPay/OPay（OPay·NG）": {
    archetype: "综合平台",
    gmv: "尼日利亚支付流水头部（绝对值待核）",
    gmvFill: 12,
    users: "月末交易活跃约3932万",
    usersFill: 28,
    growth: "未上市；交易规模高增长（收入YoY待核）",
    growthFill: 40,
  },
  "Amazon/Amazon（亚马逊·US）": {
    ticker: "AMZN.US",
    archetype: "超级平台",
    gmv: "全球电商+广告等GMV/销售额数万亿美元级",
    gmvFill: 100,
    users: "Prime/账户数亿级",
    usersFill: 70,
    growth: "集团净销售额YoY约+10%级（近年）",
    growthFill: 20,
  },
  "Block/Cash App（Block·US）": {
    ticker: "XYZ.US",
    archetype: "综合平台",
    gmv: "Cash App支付体积数百亿美元级（待核最新）",
    gmvFill: 22,
    users: "月交易活跃约5900万",
    usersFill: 42,
    growth: "Block集团收入YoY约低双位数（待核最新）",
    growthFill: 22,
  },
  "LendMN（LendMN·MN）": {
    ticker: "LEND.MSE",
    archetype: "垂直平台",
    gmv: "净贷款约₮2765亿（2025Q3）；贷款组合约₮3031亿",
    gmvFill: 18,
    users: "总用户约8.1万（2025Q3）",
    usersFill: 6,
    growth: "净贷款同比约+38%；贷款组合约74% CAGR（2023Q3→2025Q3）",
    growthFill: 76,
    note: "出处：capitalmarkets.mn《Lend Teaser_2025Q3》",
  },
  "Storepay（Storepay·MN）": {
    archetype: "垂直平台",
    gmv: "GMV绝对值未披露；2022同比+276%（CEO访谈）",
    gmvFill: 12,
    users: "官网50万+；2023末约45万+（ikon.mn）",
    usersFill: 8,
    growth: "GMV 2022同比+276%（Retail Banker International访谈）",
    growthFill: 100,
    note: "出处：RBI访谈；ikon.mn；storepay.mn",
  },
  "Ard App/Ard Credit（Ard·MN）": {
    archetype: "综合平台",
    gmv: "官网展示放贷约₮1560亿（时点未标）",
    gmvFill: 14,
    users: "官网约140万+用户（时点未标；抓取2026-08）",
    usersFill: 12,
    growth: "增速未在官网指标条披露",
    growthFill: 0,
    note: "出处：ardcredit.com/en 首页；待年报交叉",
  },
  "Pocket/InvesCore（Pocket·MN）": {
    archetype: "垂直平台",
    gmv: "集团总资产约₮3563亿（2022末；ADB）",
    gmvFill: 16,
    users: "集团客户约11.66万（2022末；ADB）",
    usersFill: 8,
    growth: "集团资产CAGR约78.5%（2017–2022；ADB）",
    growthFill: 100,
    note: "出处：ADB RRP 56156-001；Pocket App单列待拆",
  },
  "Hipay（Hipay·MN）": {
    archetype: "垂直平台",
    gmv: "公开规模未查到",
    gmvFill: 0,
    users: "公开用户数未查到",
    usersFill: 0,
    growth: "增速未查到",
    growthFill: 0,
  },
  "Shoppy.mn（Shoppy·MN）": {
    archetype: "垂直平台",
    gmv: "公开GMV未查到",
    gmvFill: 0,
    users: "公开MAU未查到",
    usersFill: 0,
    growth: "增速未查到",
    growthFill: 0,
  },
  "Simple（Simple·MN）": {
    archetype: "垂直平台",
    gmv: "公开GMV未查到",
    gmvFill: 0,
    users: "公开用户数未查到",
    usersFill: 0,
    growth: "增速未查到",
    growthFill: 0,
  },
};

function parseApproxUsersFill(text: string): number {
  const s = text || "";
  const yi = s.match(/([\d.]+)\s*亿/);
  if (yi) return Math.min(100, Math.round((parseFloat(yi[1]) / 14) * 100));
  const wan = s.match(/([\d.]+)\s*万/);
  if (wan) return Math.min(100, Math.round((parseFloat(wan[1]) / 140000) * 100));
  const m = s.match(/([\d.]+)\s*M\b/i) || s.match(/([\d.]+)百万/);
  if (m) return Math.min(100, Math.round((parseFloat(m[1]) / 1400) * 100));
  return 0;
}

function parseGrowthFill(text: string): number {
  const m = text.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
  if (!m) return 0;
  return Math.min(100, Math.round((Math.abs(parseFloat(m[1])) / 50) * 100));
}

function resolveSceneKpi(r: SceneRow): PlayerKpi {
  const legacy = SCENE_PLAYER_KPI[r.group];
  const kind = classifySceneKpiKind(r);
  const usersRaw = legacy?.users
    ? legacy.users
    : r.mau && r.mau !== "未公开"
      ? r.mau
      : r.registered || "不可比";
  const scaleRaw = legacy?.gmv
    ? legacy.gmv
    : /GMV|GTV|交易额|流水|TPV/.test(`${r.share} ${r.mau} ${r.trafficRank}`)
      ? `${r.share || r.mau}`.slice(0, 48)
      : "不可比";
  const scaleFill = legacy?.gmvFill ?? (/不可比|待核实|未公开/.test(scaleRaw) ? 0 : 8);
  const usersFill = legacy?.usersFill ?? parseApproxUsersFill(usersRaw);
  const scale = kpiLine("规模档", scaleRaw, scaleFill);
  const users = kpiLine("用户", usersRaw, usersFill);
  const asOf = "公开粗口径·时点待核";
  const confidence = inferKpiConfidence(r.verify, r.licenseReg, legacy?.note || "", scaleRaw, usersRaw);
  const primary =
    kind === "wallet"
      ? buildWalletPrimary(r, users, scale)
      : kind === "digibank"
        ? buildDigibankPrimary(r, { label: scale.label, fill: scale.fill })
        : buildScenePrimary(r, legacy);
  const growthNote = legacy?.growth && !kpiTextMissing(legacy.growth) ? `底盘增速参考（弱）：${legacy.growth}` : "";
  return {
    ticker: legacy?.ticker,
    archetype: legacy?.archetype,
    kind,
    kindLabel: KPI_KIND_LABEL[kind],
    base: { scale, users, asOf, confidence },
    primary,
    note: [legacy?.note, growthNote, "主尺缺数标不可比；不用下载量/单次新闻增速填洞"].filter(Boolean).join(" · "),
  };
}

function resolveCreditKpi(r: CreditRow): PlayerKpi {
  const kind = classifyCreditKpiKind(r);
  const scale = creditScaleFromVolume(r.volume);
  const usersRaw = (r.users || "").trim() || "不可比";
  const growthSrc = `${r.volume} ${r.note} ${r.timing}`;
  const rev = growthSrc.match(/(收入|营收|revenue)[^\d+-]{0,8}([+-]?\d+(?:\.\d+)?)\s*%/i);
  const yoy = growthSrc.match(/同比(?:约)?\+?([+-]?\d+(?:\.\d+)?)\s*%/);
  const cagr = growthSrc.match(/(?:约)?([\d.]+)\s*%\s*CAGR|CAGR[^\d]{0,12}([\d.]+)\s*%/i);
  const gmvYoy = growthSrc.match(/GMV[^\d+]{0,12}(?:同比)?[^\d+]{0,6}\+?([\d.]+)\s*%/i);
  let growth = "不可比";
  if (rev) growth = `收入YoY ${rev[2]}%（备注摘录）`;
  else if (gmvYoy) growth = `GMV同比约+${gmvYoy[1]}%（备注摘录）`;
  else if (yoy) growth = `规模同比约+${yoy[1]}%（规模摘录）`;
  else if (cagr) growth = `CAGR约${cagr[1] || cagr[2]}%（规模摘录）`;
  const scaleLine = kpiLine("规模档", scale.label, scale.fill);
  const usersLine = kpiLine("用户", /待核实|未公开|未查到/.test(usersRaw) ? "不可比" : usersRaw.split(/[；;]/)[0], parseApproxUsersFill(usersRaw));
  const primary =
    kind === "digibank"
      ? buildDigibankPrimary(r, scale)
      : kind === "wallet"
        ? buildWalletPrimary(r, usersLine, scaleLine)
        : buildCreditPrimary(r, scale, growth);
  return {
    kind,
    kindLabel: KPI_KIND_LABEL[kind],
    base: {
      scale: scaleLine,
      users: usersLine,
      asOf: (r.timing || r.founded || "时点待核").split(/[；;]/)[0].slice(0, 32),
      confidence: inferKpiConfidence(r.verify, r.licenseReg, r.note, r.volume),
    },
    primary,
    note: [
      kpiTextMissing(growth) ? null : `底盘增速参考（弱）：${growth}`,
      "主尺缺数标不可比；不用下载量/单次新闻增速填洞",
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

/** trafficRank 业务名 → 一级场景标签（与 SCENE_TAG_ORDER 对齐） */
const DEPTH_ALIAS_TO_SCENE: Record<string, SceneTag> = {
  外卖: "外卖",
  到店: "本地生活",
  酒旅: "本地生活",
  买菜: "本地生活",
  本地生活: "本地生活",
  打车: "出行",
  出行: "出行",
  电商: "电商",
  游戏: "游戏",
  支付: "支付钱包",
  支付钱包: "支付钱包",
  信用: "信用管理",
  信用管理: "信用管理",
  社交: "社交",
  直播: "直播",
  内容资讯: "内容资讯",
  企业服务: "企业服务",
  法律服务: "法律服务",
  在线教育: "在线教育",
  在线医疗: "在线医疗",
  Web3: "Web3",
};

function parseSceneDepthMap(trafficRank: string): Partial<Record<SceneTag, PlatformBizDepth>> {
  const out: Partial<Record<SceneTag, PlatformBizDepth>> = {};
  const re = /([^\s｜|·●○]+)([●○])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trafficRank)) !== null) {
    const tag = DEPTH_ALIAS_TO_SCENE[m[1].trim()];
    if (!tag) continue;
    const depth: PlatformBizDepth = m[2] === "●" ? "core" : "extend";
    if (out[tag] !== "core") out[tag] = depth;
  }
  return out;
}

function resolveSceneTagDepthMap(
  group: string,
  tags: SceneTag[],
  trafficRank: string,
): Partial<Record<SceneTag, PlatformBizDepth>> {
  const fromTraffic = parseSceneDepthMap(trafficRank);
  const fromConfig = SCENE_TAG_DEPTH_BY_GROUP[group] ?? {};
  const out: Partial<Record<SceneTag, PlatformBizDepth>> = { ...fromTraffic, ...fromConfig };
  for (const t of tags) {
    if (!out[t]) out[t] = "core";
  }
  return out;
}

function formatSceneTagDepthLine(group: string, tags: SceneTag[], trafficRank: string): string {
  const depthMap = resolveSceneTagDepthMap(group, tags, trafficRank);
  return tags
    .map((t) => {
      const d = depthMap[t] ?? "core";
      return `${SCENE_TAG_LABEL[t]}${d === "core" ? "●" : "○"}`;
    })
    .join(" ");
}

/** 信贷规模条：以约 RMB3500 亿/年撮合为满格参照（非审计） */
function creditScaleFromVolume(volume: string): { label: string; fill: number } {
  const v = (volume || "").trim();
  if (!v || /待核实|未公开|细数待/.test(v)) return { label: v || "—", fill: 0 };
  const label = v.split(/[；;]/)[0].trim();
  const rmbYi = v.match(/RMB\s*([\d.]+)\s*亿/i) || v.match(/(?:约|撮合|发起|交易额)?\s*([\d.]+)\s*亿/);
  const usdYi = v.match(/\$\s*([\d.]+)\s*亿/);
  const usdB = v.match(/\$\s*([\d.]+)\s*B\b/i) || v.match(/\$\s*([\d.]+)B\b/i);
  let yi = 0;
  if (rmbYi) yi = parseFloat(rmbYi[1]);
  else if (usdYi) yi = parseFloat(usdYi[1]) * 7;
  else if (usdB) yi = parseFloat(usdB[1]) * 70;
  if (!Number.isFinite(yi) || yi <= 0) return { label, fill: 0 };
  return { label, fill: Math.max(1, Math.min(100, Math.round((yi / 3500) * 100))) };
}

function formatCreditProductDepthLine(r: CreditRow): string {
  const parts: string[] = [`${LINE_LABEL[r.line]}●`];
  for (const t of r.tags) {
    parts.push(`${CREDIT_TAG_LABEL[t]}○`);
  }
  return parts.join(" ");
}

/** 上市公司代码（公开行情代码；优先于 equity 字段解析） */
const LISTED_TICKER_BY_GROUP: Record<string, string> = {
  "FinVolution/信也（信也·CN）": "FINV.N",
  "奇富科技/奇富借条/Qfin（奇富·CN）": "QFIN.O",
  "乐信/分期乐/Lexin（乐信·CN）": "LX.O",
  "嘉银科技/嘉银/Jiayin（嘉银·CN）": "JFIN.O",
  "宜人金科/宜人贷（宜人·CN）": "YRD.N",
  "维信金科/Vcredit（维信·CN）": "2003.HK",
  "Sea Limited/Shopee（Sea·SEA）": "SE.N",
  "Grab Holdings/Grab（Grab·SEA）": "GRAB.O",
  "GoTo/Gojek（GoTo·ID）": "GOTO.JK",
  "Delivery Hero/Foodpanda（Foodpanda·SEA）": "DHER.DE",
  "One97/Paytm（Paytm·IN）": "PAYTM.NS",
  "DiDi/99（滴滴·LATAM）": "DIDIY.O",
  "滴滴出行/滴滴（滴滴·CN）": "DIDIY.O",
  "Mercado Libre/Mercado Libre（美卡多·LATAM）": "MELI.O",
  "美团（美团·CN）": "3690.HK",
  "腾讯控股/微信（腾讯·CN）": "0700.HK",
  "京东集团/京东（京东·CN）": "JD.O / 9618.HK",
  "拼多多（拼多多·CN）": "PDD.O",
  "阿里巴巴/淘宝天猫（淘宝·CN）": "BABA.N / 9988.HK",
  "Amazon/Amazon（亚马逊·US）": "AMZN.O",
  "Block/Cash App（Block·US）": "XYZ.N",
  "Bank Neo Commerce/Neo Pinjam（BNC·ID）": "BBYB.JK",
  "Safaricom/M-Pesa（M-Pesa·KE）": "SCOM.NR",
  "百融云创｜百融｜Bairong（风控服务方·CN）": "6608.HK",
  "FICO｜FICO｜FICO（风控服务方·US）": "FICO.N",
  "Experian｜Experian｜Experian（数据服务方·全球）": "EXPN.L",
  "Equifax｜Equifax｜Equifax（数据服务方·全球）": "EFX.N",
  "TransUnion CIBIL｜CIBIL｜TransUnion（数据服务方·IN）": "TRU.N",
  "Dun & Bradstreet｜D&B｜DNB（数据服务方·US）": "DNB.N",
  "RELX｜LexisNexis｜RELX（风控服务方·全球）": "RELX.N",
  "NICE｜Actimize｜NICE（风控服务方·IL）": "NICE.O",
  "Nu Holdings/Nubank（Nubank·LATAM）": "NU.N",
  "PagSeguro/PagBank（PagBank·LATAM）": "PAGS.N",
  "XP Inc（XP·BR）": "XP.O",
  "Affirm（Affirm·US）": "AFRM.O",
  "Upstart（Upstart·US）": "UPST.O",
  "SoFi（SoFi·US）": "SOFI.O",
  "LendingClub（LendingClub·US）": "LC.N",
  "Klarna（Klarna·EU）": "未上市/私募",
  "Bajaj Finance（·IN）": "BAJFINANCE.NS",
  "Kaspi.kz（Kaspi·KZ）": "KSPI",
};

const LISTED_TICKER_BY_BRAND: Record<string, string> = {
  "信也·CN": "FINV.N",
  "奇富·CN": "QFIN.O",
  "乐信·CN": "LX.O",
  "嘉银·CN": "JFIN.O",
  "美团·CN": "3690.HK",
  "腾讯·CN": "0700.HK",
  "京东·CN": "JD.O / 9618.HK",
  "拼多多·CN": "PDD.O",
  "淘宝·CN": "BABA.N / 9988.HK",
  "Sea·SEA": "SE.N",
  "Grab·SEA": "GRAB.O",
  "GoTo·ID": "GOTO.JK",
  "Paytm·IN": "PAYTM.NS",
  "滴滴·CN": "DIDIY.O",
  "滴滴·LATAM": "DIDIY.O",
  "美卡多·LATAM": "MELI.O",
  "亚马逊·US": "AMZN.O",
  "Block·US": "XYZ.N",
};

function resolveListedTicker(group: string, equity?: string): string | undefined {
  if (LISTED_TICKER_BY_GROUP[group]) return LISTED_TICKER_BY_GROUP[group];
  const brand = creditBrandKey(group);
  if (LISTED_TICKER_BY_BRAND[brand]) return LISTED_TICKER_BY_BRAND[brand];
  const eq = (equity || "").match(
    /(?:NYSE|NASDAQ|HKEX|HK|IDX|NSE|BSE|NYSE American):\s*([A-Z0-9.]+)/i,
  );
  if (eq) return eq[1].toUpperCase();
  const bare = (equity || "").match(/\b([A-Z]{1,5}\.(?:N|O|HK|JK|NS|DE|US))\b/);
  if (bare) return bare[1];
  return undefined;
}

/** 监管官网（上挂详情与列表摘要） */
const REGULATOR_OFFICIAL_URL: Record<string, string> = {
  "中国人民银行｜人行｜PBOC（监管·CN）": "https://www.pbc.gov.cn/",
  "国家金融监督管理总局｜金管总局｜NFRA（监管·CN）": "https://www.nfra.gov.cn/",
  "中国互联网金融协会｜互金协会｜NIFA（监管·CN）": "https://www.nifa.org.cn/",
  "国家市场监督管理总局｜市监总局｜SAMR（监管·CN）": "https://www.samr.gov.cn/",
  "国家税务总局｜税总｜STA（监管·CN）": "https://www.chinatax.gov.cn/",
  "中国证券监督管理委员会｜证监会｜CSRC（监管·CN）": "https://www.csrc.gov.cn/",
  "Bank Indonesia｜BI｜印尼央行（监管·ID）": "https://www.bi.go.id/",
  "Otoritas Jasa Keuangan｜OJK｜金监局（监管·ID）":
    "https://www.ojk.go.id/id/kanal/iknb/data-dan-statistik/direktori/fintech/default.aspx",
  "Reserve Bank of India｜RBI｜印度央行（监管·IN）": "https://www.rbi.org.in/",
  "Bangko Sentral ng Pilipinas｜BSP｜菲律宾央行（监管·PH）": "https://www.bsp.gov.ph/",
  "Securities and Exchange Commission｜SEC｜菲律宾证监会（监管·PH）": "https://www.sec.gov.ph/",
  "Bank Negara Malaysia｜BNM｜马来西亚央行（监管·MY）": "https://www.bnm.gov.my/",
  "Bank of Thailand｜BOT｜泰国央行（监管·TH）": "https://www.bot.or.th/",
  "State Bank of Vietnam｜SBV｜越南央行（监管·VN）": "https://www.sbv.gov.vn/",
  "Banco Central do Brasil｜BCB｜巴西央行（监管·BR）": "https://www.bcb.gov.br/",
  "Banco de México｜Banxico｜墨西哥央行（监管·MX）": "https://www.banxico.org.mx/",
  "Comisión Nacional Bancaria y de Valores｜CNBV｜墨银监（监管·MX）": "https://www.cnbv.gob.mx/",
  "Monetary Authority of Singapore｜MAS｜新加坡金管局（监管·SG）": "https://www.mas.gov.sg/",
  "Hong Kong Monetary Authority｜HKMA｜香港金管局（监管·HK）": "https://www.hkma.gov.hk/",
  "Financial Conduct Authority｜FCA｜英国金融行为监管局（监管·GB）": "https://www.fca.org.uk/",
  "Consumer Financial Protection Bureau｜CFPB｜美国消费者金融保护局（监管·US）":
    "https://www.consumerfinance.gov/",
  "Federal Trade Commission｜FTC｜美国联邦贸易委员会（监管·US）": "https://www.ftc.gov/",
  "Federal Reserve｜Fed｜美联储（监管·US）": "https://www.federalreserve.gov/",
  "Office of the Comptroller of the Currency｜OCC｜美国货币监理署（监管·US）":
    "https://www.occ.gov/",
  "Securities and Exchange Commission｜SEC｜美国证监会（监管·US）": "https://www.sec.gov/",
  "Bundesanstalt für Finanzdienstleistungsaufsicht｜BaFin｜德国金监局（监管·DE）":
    "https://www.bafin.de/",
  "Saudi Central Bank｜SAMA｜沙特央行（监管·SA）": "https://www.sama.gov.sa/",
  "Central Bank of Bahrain｜CBB｜巴林央行（监管·BH）": "https://www.cbb.gov.bh/",
  "Qatar Central Bank｜QCB｜卡塔尔央行（监管·QA）": "https://www.qcb.gov.qa/",
  "Central Bank of Kuwait｜CBK｜科威特央行（监管·KW）": "https://www.cbk.gov.kw/",
  "Central Bank of Oman｜CBO｜阿曼央行（监管·OM）": "https://cbo.gov.om/",
  "Bank Al-Maghrib｜BAM｜摩洛哥央行（监管·MA）": "https://www.bkam.ma/",
  "Central Bank of Jordan｜CBJ｜约旦央行（监管·JO）": "https://www.cbj.gov.jo/",
  "Bank of Tanzania｜BoT｜坦桑尼亚央行（监管·TZ）": "https://www.bot.go.tz/",
  "Bank of Uganda｜BoU｜乌干达央行（监管·UG）": "https://www.bou.or.ug/",
  "National Bank of Rwanda｜BNR｜卢旺达央行（监管·RW）": "https://www.bnr.rw/",
  "National Bank of Ethiopia｜NBE｜埃塞俄比亚央行（监管·ET）": "https://nbe.gov.et/",
  "Banque Centrale des États de l'Afrique de l'Ouest｜BCEAO｜西非央行（监管·CI）": "https://www.bceao.int/",
  "Financial Sector Conduct Authority｜FSCA｜南非金融行业行为监管局（监管·ZA）":
    "https://www.fsca.co.za/",
  "Central Bank of Sri Lanka｜CBSL｜斯里兰卡央行（监管·LK）": "https://www.cbsl.gov.lk/",
  "Bangladesh Bank｜BB｜孟加拉央行（监管·BD）": "https://www.bb.org.bd/",
  "State Bank of Pakistan｜SBP｜巴基斯坦央行（监管·PK）": "https://www.sbp.org.pk/",
  "Securities and Exchange Commission of Pakistan｜SECP｜巴证监（监管·PK）":
    "https://www.secp.gov.pk/",
  "Australian Securities and Investments Commission｜ASIC｜澳证监（监管·AU）":
    "https://asic.gov.au/",
  "Financial Services Agency｜FSA｜日本金融厅（监管·JP）": "https://www.fsa.go.jp/",
  "Financial Supervisory Service｜FSS｜韩国金融监督院（监管·KR）": "https://www.fss.or.kr/",
};

function resolveRegulatorUrl(group: string, traffic?: string): string | undefined {
  if (REGULATOR_OFFICIAL_URL[group]) return REGULATOR_OFFICIAL_URL[group];
  const t = (traffic || "").trim();
  if (/^https?:\/\//i.test(t)) return t;
  return undefined;
}

/** 牌照@国家/地区：从 licenseReg / licenses 解析已持牌照简表 */
const LICENSE_COUNTRY_ALIAS: Record<string, string> = {
  中国: "中国",
  CN: "中国",
  内地: "中国",
  新加坡: "新加坡",
  SG: "新加坡",
  印尼: "印尼",
  印度尼西亚: "印尼",
  ID: "印尼",
  马来: "马来西亚",
  马来西亚: "马来西亚",
  MY: "马来西亚",
  泰国: "泰国",
  TH: "泰国",
  越南: "越南",
  VN: "越南",
  菲律宾: "菲律宾",
  菲: "菲律宾",
  PH: "菲律宾",
  印度: "印度",
  IN: "印度",
  巴西: "巴西",
  BR: "巴西",
  墨西哥: "墨西哥",
  墨: "墨西哥",
  MX: "墨西哥",
  哥伦比亚: "哥伦比亚",
  智利: "智利",
  秘鲁: "秘鲁",
  美国: "美国",
  US: "美国",
  英国: "英国",
  GB: "英国",
  UK: "英国",
  德国: "德国",
  DE: "德国",
  澳大利亚: "澳大利亚",
  澳: "澳大利亚",
  AU: "澳大利亚",
  香港: "中国香港",
  中国香港: "中国香港",
  HK: "中国香港",
  日本: "日本",
  JP: "日本",
  韩国: "韩国",
  KR: "韩国",
  肯尼亚: "肯尼亚",
  尼日利亚: "尼日利亚",
  巴基斯坦: "巴基斯坦",
  PK: "巴基斯坦",
  孟加拉: "孟加拉",
  BD: "孟加拉",
  斯里兰卡: "斯里兰卡",
  LK: "斯里兰卡",
  沙特: "沙特",
  SA: "沙特",
  哈萨克斯坦: "哈萨克斯坦",
  KZ: "哈萨克斯坦",
};

function normalizeLicenseLabel(raw: string): string {
  let s = raw
    .replace(/^已持[:：]?\s*/i, "")
    .replace(/^申请中[:：]?\s*/i, "")
    .replace(/^牌照[:：]?\s*/i, "")
    .trim();
  if (!s || s === "—" || /待核|待核实|合作路径|分发|导流/.test(s)) return "";
  if (/LPBBTI|P2P/i.test(s)) return "P2P";
  if (/数字银行|支付银行|Digital\s*Bank|Payments?\s*Bank/i.test(s)) return "数字银行";
  if (/商业银行|银行牌照|银行大牌照|吸储|Bank\s*licen/i.test(s) && !/非银行|合作银行|银行合作/.test(s))
    return "银行";
  if (/OLP|Lending\s*Company|放贷|融资公司|Financing\s*Company|P-Loan|Nano\s*Finance/i.test(s))
    return /P-Loan|Nano/i.test(s) ? "P-Loan/Nano" : "放贷";
  if (/Multifinance|多金融/i.test(s)) return "多金融";
  if (/NBFC/i.test(s)) return "NBFC";
  if (/SOFOM|SOFIPO/i.test(s)) return "SOFOM";
  if (/消金|消费金融/i.test(s)) return "消金";
  if (/小贷/i.test(s)) return "小贷";
  if (/助贷/i.test(s)) return "助贷";
  if (/保险经纪|保险代理/i.test(s)) return "保险经纪";
  if (/保险/i.test(s)) return "保险";
  if (/基金代销|证券/i.test(s)) return /证券/.test(s) ? "证券" : "基金代销";
  if (/征信/i.test(s)) return "征信";
  if (/信贷|借贷|现金贷/i.test(s)) return "信贷";
  if (/支付|电子货币|e-?money|钱包|UPI|PSP/i.test(s)) return "支付";
  if (/BNPL|分期/i.test(s)) return "BNPL";
  // 过长则截断
  if (s.length > 12) s = s.slice(0, 12);
  return s;
}

function splitCountries(raw: string): string[] {
  return raw
    .split(/[·・/,/、|｜\s]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => LICENSE_COUNTRY_ALIAS[x] ?? (LICENSE_COUNTRY_ALIAS[x.toUpperCase()] ?? x))
    .filter((x, i, arr) => arr.indexOf(x) === i);
}

const LICENSE_COUNTRY_SHORT: Record<string, string> = {
  新加坡: "新",
  印尼: "印",
  马来西亚: "马",
  泰国: "泰",
  越南: "越",
  菲律宾: "菲",
  中国: "中",
  中国香港: "港",
  日本: "日",
  韩国: "韩",
  美国: "美",
  英国: "英",
  印度: "印度",
  巴西: "巴",
  墨西哥: "墨",
  澳大利亚: "澳",
  德国: "德",
  哥伦比亚: "哥",
  智利: "智",
  秘鲁: "秘",
  肯尼亚: "肯",
  尼日利亚: "尼日",
  巴基斯坦: "巴基",
  孟加拉: "孟",
  斯里兰卡: "斯",
  沙特: "沙",
  哈萨克斯坦: "哈",
};

const LICENSE_SHORT_TO_COUNTRY: Record<string, string> = {
  新: "新加坡",
  印: "印尼",
  马: "马来西亚",
  泰: "泰国",
  越: "越南",
  菲: "菲律宾",
  中: "中国",
  港: "中国香港",
  日: "日本",
  韩: "韩国",
  美: "美国",
  英: "英国",
  印度: "印度",
  巴: "巴西",
  墨: "墨西哥",
  澳: "澳大利亚",
  德: "德国",
  哥: "哥伦比亚",
  智: "智利",
  秘: "秘鲁",
  肯: "肯尼亚",
  尼日: "尼日利亚",
  巴基: "巴基斯坦",
  孟: "孟加拉",
  斯: "斯里兰卡",
  沙: "沙特",
  哈: "哈萨克斯坦",
};

const LICENSE_BRIEF_CATEGORY_ORDER = [
  "支付",
  "信贷",
  "数字银行",
  "银行",
  "放贷",
  "P2P",
  "小贷",
  "消金",
  "助贷",
  "BNPL",
  "多金融",
  "NBFC",
  "SOFOM",
  "P-Loan/Nano",
  "保险经纪",
  "保险",
  "基金代销",
  "证券",
  "征信",
] as const;

type LicenseBriefItem = { brand: string; license: string; countryShort: string };
type LicenseBriefGroup = { category: string; items: LicenseBriefItem[] };

function shortCountryName(full: string): string {
  const c = LICENSE_COUNTRY_ALIAS[full] ?? full;
  return LICENSE_COUNTRY_SHORT[c] ?? c;
}

function licenseBriefCategory(license: string): string {
  const s = license.trim();
  if (/^(MPI|PJP|PSP|eMoney|支付|电子货币|钱包)/i.test(s) || /PSP|eMoney|MPI|PJP/i.test(s))
    return "支付";
  if (/PDKB|数字银行|Payments?\s*Bank/i.test(s)) return "数字银行";
  if (/Moneylender|Financing|放贷|信贷|Lending|OLP/i.test(s)) return "信贷";
  if (/^银行$|商业银行|Bank\s*licen/i.test(s)) return "银行";
  if (/P2P|LPBBTI/i.test(s)) return "P2P";
  if (/小贷/i.test(s)) return "小贷";
  if (/消金|消费金融/i.test(s)) return "消金";
  if (/助贷/i.test(s)) return "助贷";
  if (/BNPL|分期/i.test(s)) return "BNPL";
  if (/Multifinance|多金融/i.test(s)) return "多金融";
  if (/NBFC/i.test(s)) return "NBFC";
  if (/SOFOM|SOFIPO/i.test(s)) return "SOFOM";
  if (/P-Loan|Nano/i.test(s)) return "P-Loan/Nano";
  if (/保险经纪|保险代理/i.test(s)) return "保险经纪";
  if (/保险/i.test(s)) return "保险";
  if (/基金代销/i.test(s)) return "基金代销";
  if (/证券/i.test(s)) return "证券";
  if (/征信/i.test(s)) return "征信";
  const norm = normalizeLicenseLabel(s);
  if (norm && norm !== s) return licenseBriefCategory(norm);
  return norm || "其他";
}

function pushLicenseAt(
  out: string[],
  seen: Set<string>,
  license: string,
  country: string,
) {
  const lic = normalizeLicenseLabel(license);
  const c = LICENSE_COUNTRY_ALIAS[country] ?? country;
  if (!lic || !c || /待核|待核实|—/.test(c)) return;
  const line = `${lic}@${c}`;
  if (seen.has(line)) return;
  seen.add(line);
  out.push(line);
}

function pushBriefItem(
  groups: Map<string, LicenseBriefItem[]>,
  seen: Set<string>,
  category: string,
  brand: string,
  license: string,
  countryShort: string,
) {
  const b = brand.trim();
  const lic = license.trim();
  const cs = countryShort.trim();
  if (!lic || !cs || /待核|待核实|—/.test(cs)) return;
  const key = `${category}|${b}|${lic}|${cs}`;
  if (seen.has(key)) return;
  seen.add(key);
  const list = groups.get(category) ?? [];
  list.push({ brand: b, license: lic, countryShort: cs });
  groups.set(category, list);
}

function formatBriefItem(it: LicenseBriefItem): string {
  return it.brand ? `${it.brand}·${it.license}·${it.countryShort}` : `${it.license}·${it.countryShort}`;
}

/** 仅解析「已持」段；无已持标记则解析全文（仍忽略申请中段） */
function heldLicenseTextForBrief(blob: string): string {
  const raw = (blob || "").trim();
  if (!raw) return "";
  const applyIdx = raw.search(/申请中|拟申请/);
  let held = applyIdx >= 0 ? raw.slice(0, applyIdx) : raw;
  const heldMark = held.search(/已持[:：]/);
  if (heldMark >= 0) held = held.slice(heldMark).replace(/^已持[:：]\s*/, "");
  return held.replace(/^牌照[:：]\s*/, "").trim();
}

function brandHintFromRow(group: string, brands?: string): string {
  const m = group.match(/[（(]([^）)]+)[）)]/);
  if (m) {
    const inner = m[1].split(/[·・/|/]/)[0].trim();
    if (inner && inner.length <= 16) return inner;
  }
  if (brands) {
    const first = brands.split(/[、,/|｜]/)[0].trim();
    if (first && first.length <= 16) return first;
  }
  return group.split(/[\/／]/)[0].trim().slice(0, 12);
}

/** 优先解析「支付：Brand·牌照·国 | …」；否则回退到牌照@国家并转成同格式 */
function parseLicenseBriefGroups(
  brandHint: string,
  ...parts: string[]
): LicenseBriefGroup[] {
  const blob = parts.filter(Boolean).join("；");
  const held = heldLicenseTextForBrief(blob);
  if (!held || /〔1〕|待核监管名录|金融牌照未单列|牌照：—/.test(held)) return [];

  const groups = new Map<string, LicenseBriefItem[]>();
  const seen = new Set<string>();
  const catNames = LICENSE_BRIEF_CATEGORY_ORDER.join("|");
  const structuredRe = new RegExp(
    `(${catNames}|其他)\\s*[:：]\\s*([^；;\\n]+)`,
    "gi",
  );
  let m: RegExpExecArray | null;
  let structuredHits = 0;
  while ((m = structuredRe.exec(held)) !== null) {
    const category = m[1];
    const chunk = m[2];
    // 跳过旧写法「支付(新加坡·印尼)」——括号国家枚举，无 Brand·牌照·国
    if (/^[^(（]*[(（][^)）]+[)）]\s*$/.test(chunk.trim()) && !/[|｜]/.test(chunk)) {
      continue;
    }
    const cells = chunk.split(/[|｜]/).map((x) => x.trim()).filter(Boolean);
    for (const cell of cells) {
      const bits = cell.split(/[·・]/).map((x) => x.trim()).filter(Boolean);
      if (bits.length >= 3) {
        const countryShort = bits[bits.length - 1];
        const license = bits[bits.length - 2];
        const brand = bits.slice(0, -2).join("·");
        // 国别简称或可映射全称
        const cs =
          LICENSE_SHORT_TO_COUNTRY[countryShort] || LICENSE_COUNTRY_ALIAS[countryShort]
            ? shortCountryName(LICENSE_SHORT_TO_COUNTRY[countryShort] ?? countryShort)
            : countryShort.length <= 3
              ? countryShort
              : shortCountryName(countryShort);
        pushBriefItem(groups, seen, category, brand, license, cs);
        structuredHits += 1;
      }
    }
  }
  if (structuredHits > 0) {
    return sortLicenseBriefGroups(groups);
  }

  // 回退：旧解析 → BrandHint·牌照粗类·国别简称
  for (const line of parseLicenseAtCountryLines(blob)) {
    const [lic, country] = line.split("@");
    if (!lic || !country) continue;
    pushBriefItem(
      groups,
      seen,
      licenseBriefCategory(lic),
      brandHint,
      lic,
      shortCountryName(country),
    );
  }
  return sortLicenseBriefGroups(groups);
}

function sortLicenseBriefGroups(groups: Map<string, LicenseBriefItem[]>): LicenseBriefGroup[] {
  const order = LICENSE_BRIEF_CATEGORY_ORDER as readonly string[];
  const keys = [...groups.keys()].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  return keys.map((category) => ({ category, items: groups.get(category) ?? [] }));
}

function parseLicenseAtCountryLines(...parts: string[]): string[] {
  const blob = parts.filter(Boolean).join("；");
  const held = heldLicenseTextForBrief(blob);
  if (!held || /〔1〕|待核监管名录|金融牌照未单列|牌照：—/.test(held)) return [];
  const out: string[] = [];
  const seen = new Set<string>();

  // 0) 新格式：支付：Brand·牌照·国 | …
  const catNames = LICENSE_BRIEF_CATEGORY_ORDER.join("|");
  const structuredRe = new RegExp(
    `(${catNames}|其他)\\s*[:：]\\s*([^；;\\n]+)`,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = structuredRe.exec(held)) !== null) {
    const chunk = m[2];
    if (/^[^(（]*[(（][^)）]+[)）]\s*$/.test(chunk.trim()) && !/[|｜]/.test(chunk)) continue;
    for (const cell of chunk.split(/[|｜]/).map((x) => x.trim()).filter(Boolean)) {
      const bits = cell.split(/[·・]/).map((x) => x.trim()).filter(Boolean);
      if (bits.length < 3) continue;
      const countryShort = bits[bits.length - 1];
      const license = bits[bits.length - 2];
      const full =
        LICENSE_SHORT_TO_COUNTRY[countryShort] ??
        LICENSE_COUNTRY_ALIAS[countryShort] ??
        countryShort;
      pushLicenseAt(out, seen, license, full);
    }
  }

  // 1) 名称(国家·国家)——括号内须能映射为地区，避免把（P2P）误当国家
  const parenRe = /([^·；;、，,\n(（]+?)\s*[(（]([^)）]+)[)）]/g;
  while ((m = parenRe.exec(held)) !== null) {
    const name = m[1].replace(/^[\s·；;、，]+/, "").trim();
    // 跳过「支付：…」段里已被结构化吃掉的内容：若 name 含冒号分类头则仍可解析国家枚举旧式
    const countries = splitCountries(m[2]).filter(
      (c) =>
        Boolean(LICENSE_COUNTRY_ALIAS[c]) ||
        Boolean(LICENSE_COUNTRY_ALIAS[c.toUpperCase()]) ||
        Object.values(LICENSE_COUNTRY_ALIAS).includes(c),
    );
    if (!countries.length) continue;
    for (const c of countries) pushLicenseAt(out, seen, name, c);
  }

  // 2) 国家：描述 / CN：描述 / ID：描述
  const colonRe =
    /(中国|新加坡|印尼|印度尼西亚|马来西亚|马来|泰国|越南|菲律宾|菲|印度|巴西|墨西哥|墨|哥伦比亚|智利|秘鲁|美国|英国|德国|澳大利亚|澳|香港|中国香港|日本|韩国|肯尼亚|尼日利亚|巴基斯坦|孟加拉|斯里兰卡|沙特|哈萨克斯坦|CN|ID|PH|IN|MY|TH|VN|SG|BR|MX|US|HK|AU|PK|BD|LK|SA|KZ)\s*[:：]\s*([^；;\n]+)/gi;
  while ((m = colonRe.exec(held)) !== null) {
    const countries = splitCountries(m[1]);
    const desc = m[2];
    const bits = desc.split(/[·・/|/]/).map((x) => x.trim()).filter(Boolean);
    for (const c of countries) {
      if (bits.length) for (const b of bits) pushLicenseAt(out, seen, b, c);
      else pushLicenseAt(out, seen, desc, c);
    }
  }

  // 3) 无括号叙事：印尼OJK LPBBTI / 菲SEC Lending / 中国助贷
  const loose: [RegExp, string, string][] = [
    [/印尼[^；;]*OJK[^；;]*LPBBTI|印尼[^；;]*P2P/i, "P2P", "印尼"],
    [/印尼[^；;]*Multifinance|印尼[^；;]*多金融/i, "多金融", "印尼"],
    [/印尼[^；;]*银行|BNC银行|商业银行大牌照/i, "银行", "印尼"],
    [/菲律宾[^；;]*银行|OwnBank|农村银行/i, "银行", "菲律宾"],
    [/泰国[^；;]*P-Loan|泰国[^；;]*Nano|Akulaku X/i, "P-Loan/Nano", "泰国"],
    [/菲[^；;]*SEC|菲律宾[^；;]*SEC|JuanHand|OLP/i, "放贷", "菲律宾"],
    [/菲律宾[^；;]*数字银行|Maya[^；;]*数字银行|数字银行[^；;]*菲律宾/i, "数字银行", "菲律宾"],
    [/中国[^；;]*助贷|助贷撮合/i, "助贷", "中国"],
    [/中国[^；;]*消金|消费金融/i, "消金", "中国"],
    [/中国[^；;]*小贷/i, "小贷", "中国"],
    [/中国[^；;]*支付|非银行支付/i, "支付", "中国"],
    [/印度[^；;]*NBFC/i, "NBFC", "印度"],
    [/墨西哥[^；;]*SOFOM|墨[^；;]*SOFOM/i, "SOFOM", "墨西哥"],
    [/巴西[^；;]*数字银行|数字银行大牌照/i, "数字银行", "巴西"],
  ];
  for (const [re, lic, c] of loose) {
    if (re.test(held)) pushLicenseAt(out, seen, lic, c);
  }

  return out;
}

function PlayerLicenseBrief({
  licenseReg,
  licenses,
  brandHint = "",
}: {
  licenseReg: string;
  licenses?: string;
  brandHint?: string;
}) {
  const groups = parseLicenseBriefGroups(brandHint, licenseReg, licenses ?? "");
  return (
    <Stack gap={6}>
      <Text size="small" tone="secondary">
        牌照（已持）
      </Text>
      {groups.length ? (
        <Stack gap={8}>
          {groups.map((g) => (
            <Stack gap={2}>
              <Text size="small" weight="medium">
                {g.category}
              </Text>
              <Text size="small">{g.items.map(formatBriefItem).join(" | ")}</Text>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Text size="small" tone="tertiary">
          待核实 / 合作路径未单列自有牌照
        </Text>
      )}
    </Stack>
  );
}

/** 生态机构：市场定位大类 + 服务性质词条（均标●，表示主业定位） */
function formatEcoRoleDepthLine(r: CreditRow): string {
  const roles = (r.institutionTypes.length ? r.institutionTypes : r.ecoRoles).filter(
    (t) => t !== "玩家",
  ) as InstitutionType[];
  const list = roles.length ? roles : (["流量服务商"] as InstitutionType[]);
  return list.map((t) => `${INSTITUTION_TYPE_LABEL[t]}●`).join(" ");
}

function MetricBar({
  title,
  label,
  fill,
  muted,
}: {
  title: string;
  label: string;
  fill: number;
  muted?: boolean;
}) {
  return (
    <UsageBar
      total={100}
      segments={[{ id: title, value: Math.max(0, Math.min(100, fill)), color: muted ? "gray" : "gray" }]}
      topLeftLabel={title}
      topRightLabel={label}
    />
  );
}

function ThreeMetrics({ kpi }: { kpi: PlayerKpi }) {
  return (
    <Stack gap={8}>
      <Stack gap={4}>
        <Row gap={8} align="center" justify="space-between" wrap>
          <Text size="small" weight="medium">
            {kpi.kindLabel}
          </Text>
          <Text size="small" tone="tertiary">
            置信{kpi.base.confidence} · {kpi.base.asOf}
          </Text>
        </Row>
        <Text size="small" tone="tertiary">
          强权重主尺；缺数标「不可比」（不用下载量/单次新闻增速填洞）
        </Text>
        {kpi.primary.map((m) => (
          <MetricBar
            key={m.title}
            title={m.title}
            label={m.comparable ? m.label : "不可比"}
            fill={m.comparable ? m.fill : 0}
            muted={!m.comparable}
          />
        ))}
      </Stack>
      <Stack gap={4}>
        <Text size="small" tone="tertiary">
          共用底盘（弱权重·仅排序辅助）
        </Text>
        <MetricBar
          title="规模档"
          label={kpi.base.scale.comparable ? kpi.base.scale.label : "不可比"}
          fill={kpi.base.scale.comparable ? kpi.base.scale.fill : 0}
          muted
        />
        <MetricBar
          title="用户"
          label={kpi.base.users.comparable ? kpi.base.users.label : "不可比"}
          fill={kpi.base.users.comparable ? kpi.base.users.fill : 0}
          muted
        />
      </Stack>
      {kpi.note ? (
        <Text size="small" tone="tertiary">
          {kpi.note}
        </Text>
      ) : null}
    </Stack>
  );
}

/** 行业情报库命中（研报或监管信源包）；无命中则不渲染 */
function ResearchPlayerBrief({ group }: { group: string }) {
  const hits = resolveResearchHitsForGroup(group);
  if (!hits.length) return null;
  const theme = useHostTheme();
  const hasResearch = hits.some(({ report }) => isResearchReportDoc(report));
  const hasPack = hits.some(({ report }) => !isResearchReportDoc(report));
  const title =
    hasResearch && hasPack ? "研报/监管命中" : hasPack ? "监管信源命中" : "研报命中";
  return (
    <Stack gap={6}>
      <Row gap={8} align="center" justify="space-between" wrap>
        <Text size="small" weight="medium">
          {title}
        </Text>
        <Text size="small" tone="tertiary">
          置信{hits[0].hit.confidence || hits[0].report.confidence}
        </Text>
      </Row>
      {hits.slice(0, 3).map(({ report, hit }) => (
        <div
          key={`${report.id}_${hit.nameZh}`}
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${theme.stroke.tertiary}`,
            background: theme.bg.elevated,
          }}
        >
          <div style={{ fontSize: 11, color: theme.text.tertiary, marginBottom: 4 }}>
            {docKindLabel(report)} · {report.publisher} · {report.period} · {hit.nameZh}
          </div>
          <div style={{ fontSize: 13, color: theme.text.primary, lineHeight: 1.45 }}>
            <CitedText text={softenBriefText(hit.metric)} size="small" />
          </div>
          {hit.actions ? (
            <div style={{ fontSize: 11, color: theme.text.tertiary, marginTop: 4 }}>
              <CitedText text={softenBriefText(hit.actions)} size="small" tone="tertiary" />
            </div>
          ) : null}
          {hit.cashLoanHint ? (
            <div style={{ fontSize: 11, color: theme.text.secondary, marginTop: 4 }}>
              <CitedText text={softenBriefText(hit.cashLoanHint)} size="small" tone="secondary" />
            </div>
          ) : null}
        </div>
      ))}
      <Text size="small" tone="tertiary">
        监管文件≠研报；下载/MAU≠信贷主尺。出处见〔n〕
      </Text>
    </Stack>
  );
}

/** 摘要去装饰符号，便于扫读（中点、箭头、信源角标、井号等） */
function softenBriefDecorations(raw: string): string {
  if (!raw) return raw;
  let s = raw;
  const circled = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
  s = s.replace(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/g, (ch) => {
    const i = circled.indexOf(ch);
    return i >= 0 ? `${i + 1}. ` : ch;
  });
  s = s.replace(/[〔\[]\s*\d+\s*[〕\]]/g, "");
  s = s.replace(/——+|--+|––+/g, "，");
  s = s.replace(/→|➜|➔|⇒|⟶/g, "至");
  s = s.replace(/[|｜]/g, "，");
  s = s.replace(/[·・∙⋅•]/g, "，");
  s = s.replace(/[×✕✖]/g, "与");
  s = s.replace(/[#＃]\s*(?=\d)/g, "第");
  s = s.replace(/[▸▾►◄▶◀▹◃↗↘↖↙←↑↓⇄]+/g, "");
  s = s.replace(/(?<=[\u4e00-\u9fffA-Za-z）〗」』])\s*\/\s*(?=[\u4e00-\u9fffA-Za-z（〖「『])/g, "、");
  s = s.replace(/(?<=[\u4e00-\u9fff])\s*\+\s*(?=[\u4e00-\u9fffA-Za-z])/g, "，");
  const ccZh: Record<string, string> = {
    MX: "墨西哥",
    TH: "泰国",
    ID: "印尼",
    PH: "菲律宾",
    HK: "中国香港",
    IN: "印度",
    BR: "巴西",
    SG: "新加坡",
    MY: "马来西亚",
    VN: "越南",
    PK: "巴基斯坦",
    NG: "尼日利亚",
    KE: "肯尼亚",
    US: "美国",
    CN: "中国",
  };
  s = s.replace(/\b([A-Z]{2})(?:\s*[、,/]\s*([A-Z]{2}))+\b/g, (full) => {
    const codes = full.split(/\s*[、,/]\s*/);
    if (!codes.every((c) => ccZh[c])) return full;
    return codes.map((c) => ccZh[c]).join("、");
  });
  s = s.replace(/\b([A-Z]{2})(?=（)/g, (code) => ccZh[code] || code);
  s = s.replace(/\s*与\s*/g, "与");
  s = s.replace(/\s*，\s*/g, "，");
  s = s.replace(/\s*、\s*/g, "、");
  s = s.replace(/\s*；\s*/g, "；");
  s = s.replace(/\s*：\s*/g, "：");
  s = s.replace(/（\s*）/g, "");
  s = s.replace(/，{2,}/g, "，");
  s = s.replace(/、{2,}/g, "、");
  s = s.replace(/；{2,}/g, "；");
  s = s.replace(/([，、；])\s*\1+/g, "$1");
  s = s.replace(/[，、；]\s*(?=[。！？]|$)/g, "");
  s = s.replace(/\s{2,}/g, " ");
  s = s.replace(/^[，、；。\s]+|[，、；\s]+$/g, "");
  return s.trim();
}

function softenBriefText(raw: string): string {
  if (!raw) return raw;
  return softenBriefDecorations(ensureFlashChinese(raw));
}

function stripFlashShellText(raw: string): string {
  return (raw || "")
    .replace(/^(?:【\s*外媒[^】]*】\s*)+/u, "")
    .replace(/^(?:外媒速览[：:]\s*)+/u, "")
    .replace(/^(?:外媒[：:]\s*)+/u, "")
    .trim();
}

function isGenericFlashShellText(raw: string): boolean {
  const t = stripFlashShellText(raw);
  if (!t) return true;
  if (/^(财经|监管|信贷与金融科技|能源|可持续|财经相关(报道)?|银行与信贷动态)(相关)?$/u.test(t)) return true;
  if (/：财经相关$/.test(t) || /：财经$/.test(t)) return true;
  if (/^(外媒速览|外媒)[：:]/.test(raw) && t.length <= 8) return true;
  return false;
}

function briefParagraphs(raw: string): string[] {
  const soft = softenBriefText(raw);
  const parts = soft
    .split(/(?=\d+\.\s)|[；;\n]+/)
    .map((p) => p.trim().replace(/^[，、]+/, ""))
    .filter(Boolean);
  return parts.length ? parts : soft ? [soft] : [];
}

/** 快讯标准：标题一句说清；展开一段说清（由 what/how/result 收成一段，勿重复标题）。 */
function storyToProse(s: {
  who?: string;
  when?: string;
  what?: string;
  how?: string;
  result?: string;
  title?: string;
  /** 外文原标题：仅作对照，不作展开正文主体 */
  titleEn?: string;
  source?: string;
  published?: string;
  time?: string;
  cashLoanHint?: string;
}): string {
  let who = stripFlashShellText(s.who || "").trim();
  let when = stripFlashShellText(s.when || "").trim();
  let what = stripFlashShellText(s.what || "").trim();
  let how = stripFlashShellText(s.how || "").trim();
  let result = stripFlashShellText(s.result || s.cashLoanHint || "").trim();
  const title = stripFlashShellText(s.title || "").trim();

  if (isGenericFlashShellText(who)) who = "";
  if (isGenericFlashShellText(when)) when = "";
  // published 纯日期不当「于…」主语
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(when) || /^时间\s/.test(when)) when = "";
  if (isGenericFlashShellText(what)) what = "";
  if (how.startsWith("原文") || isGenericFlashShellText(how)) how = "";
  if (isGenericFlashShellText(result)) result = "";

  // 与标题完全相同的 what：展开时会与列表标题重复，不当正文
  if (what && title && what === title) what = "";

  const parts: string[] = [];
  if (what) {
    const ctx = [who, when].filter(Boolean);
    const usefulCtx = ctx.filter(
      (bit) => bit.length >= 2 && !what.includes(bit.slice(0, Math.min(8, bit.length))),
    );
    if (usefulCtx.length) parts.push(`${usefulCtx.join(" · ")}：${what}`);
    else parts.push(what);
  } else if (who || when) {
    parts.push([who, when].filter(Boolean).join(" · "));
  }
  if (how && !parts.some((p) => p.includes(how))) parts.push(how);
  if (result && !parts.some((p) => p.includes(result))) parts.push(result);

  // 去相邻重复句
  const deduped: string[] = [];
  for (const p of parts) {
    const norm = p.replace(/\s+/g, "");
    if (deduped.some((d) => d.replace(/\s+/g, "") === norm)) continue;
    if (deduped.some((d) => d.includes(p) || p.includes(d))) continue;
    deduped.push(p);
  }

  const prose = deduped
    .map((x) => x.replace(/[。；;\s]+$/g, "").trim())
    .filter(Boolean)
    .join("。");
  // 正文已是中文叙述：只做装饰清洗；不把外文原题当展开主体
  return softenBriefDecorations(prose ? `${prose}。` : "");
}

/** 首页统一正文样式：少层级、少字号变化 */
function HomeProse({
  children,
  muted,
  strong,
}: {
  children?: ReactNode;
  muted?: boolean;
  strong?: boolean;
}) {
  const theme = useHostTheme();
  return (
    <div
      style={{
        fontSize: strong ? 14 : 13,
        lineHeight: 1.55,
        fontWeight: strong ? 600 : 400,
        color: muted ? theme.text.secondary : theme.text.primary,
      }}
    >
      {children}
    </div>
  );
}

function HomeMeta({ children }: { children?: ReactNode }) {
  const theme = useHostTheme();
  return (
    <div style={{ fontSize: 12, lineHeight: 1.45, color: theme.text.tertiary, fontWeight: 400 }}>
      {children}
    </div>
  );
}

function HomeSectionTitle({ children }: { children?: ReactNode }) {
  const theme = useHostTheme();
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: theme.text.primary, lineHeight: 1.4 }}>
      {children}
    </div>
  );
}

function ResearchLibraryHomePanel() {
  const research = latestResearchReports(6);
  /** 监管官方材料：有价值的才进研报轨（不作快讯列表） */
  const officialPacks = latestSourcePacks(4).filter((r) => !isResearchReportDoc(r));
  const theme = useHostTheme();
  const [openId, setOpenId] = useState("");
  const docs = [...research, ...officialPacks];
  if (!docs.length) return null;

  /** 对齐 36氪专题：眉题 · 大标题 · 导语 · 分栏文章列表 */
  const renderTopic = (r: (typeof research)[0]) => {
    const open = openId === r.id;
    const lede = softenBriefText(r.thesis || r.analysis.verdict || "");
    const verdict = softenBriefText(r.analysis.verdict || "");
    const bullets = (r.analysis.bullets || []).map(softenBriefText);
    const policy = (r.policyBullets || []).map(softenBriefText);
    const players = r.playerUpdates || [];
    const sources = r.sources || [];
    const regions = (r.regions || []).join("、");
    const isOfficial = !isResearchReportDoc(r);
    const brow = isOfficial ? "监管专题" : "热点专题";

    return (
      <div
        key={r.id}
        style={{
          borderRadius: 10,
          border: `1px solid ${theme.stroke.tertiary}`,
          background: theme.bg.elevated,
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => setOpenId(open ? "" : r.id)}
          style={{
            display: "block",
            width: "100%",
            margin: 0,
            padding: "14px 14px 12px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
            font: "inherit",
            color: "inherit",
          }}
          title={open ? "收起专题" : "进入专题"}
        >
          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.04em",
              color: theme.text.tertiary,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            {brow}
            {r.docKindLabel || docKindLabel(r) ? ` · ${r.docKindLabel || docKindLabel(r)}` : ""}
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              lineHeight: 1.35,
              color: theme.text.primary,
              letterSpacing: "-0.01em",
            }}
          >
            {softenBriefText(r.title)}
          </div>
          {lede ? (
            <div style={{ marginTop: 10 }}>
              <HomeProse muted>
                <GlossedText text={lede} />
              </HomeProse>
            </div>
          ) : null}
          <div style={{ marginTop: 12 }}>
            <HomeMeta>
              {softenBriefText(
                [
                  r.publisher,
                  r.period,
                  r.asOf ? `对照 ${r.asOf}` : "",
                  regions ? `覆盖 ${regions}` : "",
                  r.confidence ? `置信${r.confidence}` : "",
                ]
                  .filter(Boolean)
                  .join(" · "),
              )}
            </HomeMeta>
          </div>
          <div style={{ marginTop: 10 }}>
            <HomeMeta>{open ? "收起专题" : "进入专题"}</HomeMeta>
          </div>
        </button>

        {open ? (
          <div
            style={{
              borderTop: `1px solid ${theme.stroke.tertiary}`,
              padding: "8px 14px 14px",
            }}
          >
            <Stack gap={12}>
              {verdict && verdict !== lede ? (
                <Stack gap={8}>
                  <HomeSectionTitle>「主编导读」</HomeSectionTitle>
                  <HomeProse muted>{verdict}</HomeProse>
                </Stack>
              ) : null}

              {bullets.length ? (
                <Stack gap={8}>
                  <HomeSectionTitle>「核心结论」</HomeSectionTitle>
                  <Stack gap={0}>
                    {bullets.map((b, i) => (
                      <div
                        key={`${r.id}-b-${i}`}
                        style={{
                          padding: "12px 0",
                          borderBottom:
                            i === bullets.length - 1 ? "none" : `1px solid ${theme.stroke.tertiary}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            lineHeight: 1.45,
                            color: theme.text.primary,
                          }}
                        >
                          {i + 1}. {b.length > 36 ? `${b.slice(0, 36)}…` : b}
                        </div>
                        {b.length > 36 ? (
                          <div
                            style={{
                              marginTop: 6,
                              fontSize: 13,
                              lineHeight: 1.65,
                              color: theme.text.secondary,
                            }}
                          >
                            {b}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </Stack>
                </Stack>
              ) : null}

              {policy.length ? (
                <Stack gap={8}>
                  <HomeSectionTitle>「监管对照」</HomeSectionTitle>
                  <Stack gap={0}>
                    {policy.slice(0, 6).map((b, i) => (
                      <div
                        key={`${r.id}-p-${i}`}
                        style={{
                          padding: "10px 0",
                          borderBottom:
                            i === Math.min(policy.length, 6) - 1
                              ? "none"
                              : `1px solid ${theme.stroke.tertiary}`,
                          fontSize: 13,
                          lineHeight: 1.65,
                          color: theme.text.secondary,
                        }}
                      >
                        {b}
                      </div>
                    ))}
                  </Stack>
                </Stack>
              ) : null}

              {players.length ? (
                <Stack gap={8}>
                  <HomeSectionTitle>「相关玩家」</HomeSectionTitle>
                  <Stack gap={0}>
                    {players.slice(0, 12).map((p, i) => (
                      <div
                        key={`${r.id}-pl-${i}`}
                        style={{
                          padding: "12px 0",
                          borderBottom:
                            i === Math.min(players.length, 12) - 1
                              ? "none"
                              : `1px solid ${theme.stroke.tertiary}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: theme.text.primary,
                            lineHeight: 1.4,
                          }}
                        >
                          {p.nameZh}
                          {p.appName ? ` · ${p.appName}` : ""}
                        </div>
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 13,
                            lineHeight: 1.65,
                            color: theme.text.secondary,
                          }}
                        >
                          {softenBriefText(p.metric)}
                        </div>
                      </div>
                    ))}
                  </Stack>
                  {players.length > 12 ? (
                    <HomeMeta>另有 {players.length - 12} 家未展开</HomeMeta>
                  ) : null}
                </Stack>
              ) : null}

              {sources.length ? (
                <Stack gap={8}>
                  <HomeSectionTitle>「信源与附件」</HomeSectionTitle>
                  <Stack gap={0}>
                    {sources.map((s, i) => (
                      <div
                        key={s.id}
                        style={{
                          padding: "10px 0",
                          borderBottom:
                            i === sources.length - 1 ? "none" : `1px solid ${theme.stroke.tertiary}`,
                        }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 600, color: theme.text.primary }}>
                          {s.title}
                          {s.url ? (
                            <>
                              {" "}
                              <Link href={s.url}>原文</Link>
                            </>
                          ) : null}
                        </div>
                        {s.asOf ? <HomeMeta>时点 {s.asOf}</HomeMeta> : null}
                        {(s.bullets || []).slice(0, 2).map((b, j) => (
                          <div
                            key={`${s.id}-${j}`}
                            style={{
                              marginTop: 4,
                              fontSize: 12,
                              lineHeight: 1.55,
                              color: theme.text.tertiary,
                            }}
                          >
                            {softenBriefText(b)}
                          </div>
                        ))}
                      </div>
                    ))}
                  </Stack>
                  {r.localPath ? <HomeMeta>本地稿 {r.localPath}</HomeMeta> : null}
                </Stack>
              ) : null}

              <button
                type="button"
                onClick={() => setOpenId("")}
                style={{
                  alignSelf: "flex-start",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: 12,
                  color: theme.text.tertiary,
                }}
              >
                收起专题
              </button>
            </Stack>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <Stack gap={0}>
      <AtlasStickySub>
        <HomeMeta>
          研报 · {research.length} 篇专题
          {officialPacks.length ? ` · 监管材料 ${officialPacks.length}` : ""}
        </HomeMeta>
      </AtlasStickySub>
      <Stack gap={12} style={{ paddingTop: 12 }}>
        {docs.map(renderTopic)}
      </Stack>
    </Stack>
  );
}

/** 上市定期披露 KPI（T2 信源）；无槽位则不渲染 */
function ListedDisclosureBrief({ group, ticker }: { group: string; ticker?: string }) {
  const d = resolveListedDisclosure(group, ticker);
  const theme = useHostTheme();
  if (!d) return null;
  const filled = d.status === "filled" && d.kpis.length > 0;
  const originLabel = d.origin ? LISTED_ORIGIN_LABEL[d.origin] || d.origin : "";
  const regionLabel = d.region ? LISTED_REGION_LABEL[d.region] || d.region : "";
  return (
    <Stack gap={6}>
      <Row gap={8} align="center" justify="space-between" wrap>
        <Text size="small" weight="medium">
          最近披露 KPI
          {d.period ? ` · ${d.period}` : ""}
        </Text>
        <Text size="small" tone="tertiary">
          T2
          {d.confidence ? ` · ${d.confidence}` : ""}
          {!filled ? " · 待填" : ""}
        </Text>
      </Row>
      <Row gap={6} wrap>
        {regionLabel ? (
          <Pill tone="neutral" size="sm">
            {regionLabel}
          </Pill>
        ) : null}
        {originLabel ? (
          <Pill tone="info" size="sm">
            {originLabel}
          </Pill>
        ) : null}
        {(d.langZones || []).slice(0, 3).map((z) => (
          <Pill key={z} tone="neutral" size="sm">
            {z}
          </Pill>
        ))}
      </Row>
      {filled ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 8,
          }}
        >
          {d.kpis.slice(0, 6).map((k) => (
            <div
              key={k.id}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid ${theme.stroke.tertiary}`,
                background: theme.bg.elevated,
              }}
            >
              <div style={{ fontSize: 11, color: theme.text.tertiary, marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: theme.text.primary }}>{k.value}</div>
              {k.yoy ? (
                <div style={{ fontSize: 11, color: theme.text.tertiary, marginTop: 2 }}>{k.yoy}</div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <Text size="small" tone="tertiary">
          {d.cashLoanHint || "槽位已建，待财报/债项披露填入成交量/在贷/逾期等。"}
        </Text>
      )}
      {filled && d.cashLoanHint ? (
        <Text size="small" tone="secondary">
          {d.cashLoanHint}
        </Text>
      ) : null}
      {d.irUrl ? (
        <Text size="small">
          原文：
          <Link href={d.irUrl}>{d.sourceNote || d.ticker || d.nameZh}</Link>
          {d.reportedAt ? ` · ${d.reportedAt}` : ""}
        </Text>
      ) : null}
    </Stack>
  );
}

/** 招股/年报竞争格局（四层分类）；无情报则不渲染 */
function CompetitiveIntelBrief({ group, ticker }: { group: string; ticker?: string }) {
  const intel = resolveCompetitiveIntel(group, ticker);
  const theme = useHostTheme();
  if (!intel) return null;
  const layers = intel.layers.filter((l) => l.items?.length);
  if (!layers.length) return null;
  return (
    <Stack gap={6}>
      <Row gap={8} align="center" justify="space-between" wrap>
        <Text size="small" weight="medium">
          竞争格局
        </Text>
        <Text size="small" tone="tertiary">
          {intel.chain?.namedByProspectus ? "招股点名链" : "情报"}
          {intel.confidence ? ` · ${intel.confidence}` : ""}
        </Text>
      </Row>
      {intel.marketThesis?.summary ? (
        <Text size="small" tone="secondary">
          {intel.marketThesis.summary}
          {intel.marketThesis.thirdParty ? `（${intel.marketThesis.thirdParty}）` : ""}
        </Text>
      ) : null}
      {layers.map((layer) => (
        <Stack key={layer.id} gap={4}>
          <Text size="small" tone="tertiary">
            {COMPETITIVE_LAYER_LABEL[layer.id] || layer.id}
          </Text>
          <Row gap={6} wrap>
            {layer.items.map((it) => {
              const crm = it.crmStatus || (it.groupKey ? "linked" : "pending");
              const suffix =
                crm === "rail" || crm === "infra"
                  ? " ·轨道"
                  : crm === "pending" || !it.groupKey
                    ? " ·待建档"
                    : "";
              return (
              <span
                key={`${layer.id}-${it.nameZh}`}
                title={it.why}
                style={{
                  fontSize: 12,
                  lineHeight: 1.4,
                  padding: "4px 8px",
                  borderRadius: 8,
                  border: `1px solid ${theme.stroke.tertiary}`,
                  color: it.groupKey || crm === "rail" ? theme.text.primary : theme.text.tertiary,
                  background: theme.bg.elevated,
                }}
              >
                {it.nameZh}
                {suffix}
              </span>
              );
            })}
          </Row>
        </Stack>
      ))}
      {intel.marketThesis && "feeNote" in (intel.marketThesis || {}) && (intel.marketThesis as { feeNote?: string }).feeNote ? (
        <Text size="small" tone="secondary">
          费率：{(intel.marketThesis as { feeNote?: string }).feeNote}
        </Text>
      ) : null}
      {intel.cashLoanHint ? (
        <Text size="small" tone="secondary">
          {intel.cashLoanHint}
        </Text>
      ) : null}
      {intel.sources?.[0]?.url ? (
        <Text size="small">
          信源：
          <Link href={intel.sources[0].url}>{intel.sources[0].title}</Link>
        </Text>
      ) : null}
    </Stack>
  );
}

/** 可点选角标：已选且 clearable 时再点可清除；present=反向映射（该属地已有机构） */
function FilterChip({
  label,
  active,
  present,
  clearable,
  onClick,
}: {
  label: string;
  active: boolean;
  /** 反向亮起：名下已有机构覆盖（未选中时用 info 色提示） */
  present?: boolean;
  clearable?: boolean;
  onClick: () => void;
}) {
  const theme = useHostTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        active && clearable
          ? "点击清除"
          : present && !active
            ? "已有机构覆盖"
            : present === false
              ? "尚无机构（未创设）"
              : undefined
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 28,
        padding: "0 10px",
        borderRadius: 8,
        border: `1px solid ${active ? theme.stroke.secondary : theme.stroke.tertiary}`,
        background: active ? theme.fill.secondary : theme.bg.elevated,
        color: present && !active ? theme.text.link : theme.text.primary,
        cursor: "pointer",
        font: "inherit",
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        lineHeight: 1,
        whiteSpace: "nowrap",
        flexShrink: 0,
        boxSizing: "border-box",
      }}
    >
      {label}
      {active && clearable ? (
        <span style={{ marginLeft: 4, color: theme.text.tertiary, fontWeight: 500 }}>×</span>
      ) : null}
    </button>
  );
}

function countriesCoveredByCreditRow(r: CreditRow): Exclude<CountryCode, "all">[] {
  const codes = (Object.keys(COUNTRY_LABEL) as CountryCode[]).filter((c) => c !== "all");
  if (hasWorldwideCoverage(r.countries)) {
    return codes as Exclude<CountryCode, "all">[];
  }
  return codes.filter((c) =>
    matchesCountry(r.group, r.countries, c),
  ) as Exclude<CountryCode, "all">[];
}

function countriesCoveredBySceneRow(r: SceneRow): Exclude<CountryCode, "all">[] {
  const codes = (Object.keys(COUNTRY_LABEL) as CountryCode[]).filter((c) => c !== "all");
  if (hasWorldwideCoverage(r.countries)) {
    return codes as Exclude<CountryCode, "all">[];
  }
  return codes.filter((c) =>
    matchesCountry(r.group, r.countries, c),
  ) as Exclude<CountryCode, "all">[];
}

function regionForCountry(c: Exclude<CountryCode, "all">): Exclude<Region, "all"> | null {
  for (const reg of Object.keys(COUNTRIES_BY_REGION) as Exclude<Region, "all">[]) {
    if (COUNTRIES_BY_REGION[reg].includes(c)) return reg;
  }
  return null;
}

/** 某机构类型（或玩家池）反向映射：哪些洲际/国家已有机构 */
function collectGeoCoverage(rows: { region: Exclude<Region, "all">; countries: Exclude<CountryCode, "all">[] }[]): {
  regions: Set<Exclude<Region, "all">>;
  countries: Set<Exclude<CountryCode, "all">>;
} {
  const regions = new Set<Exclude<Region, "all">>();
  const countries = new Set<Exclude<CountryCode, "all">>();
  for (const r of rows) {
    regions.add(r.region);
    for (const c of r.countries) {
      countries.add(c);
      const reg = regionForCountry(c);
      if (reg) regions.add(reg);
    }
  }
  return { regions, countries };
}

const GEO_SCOPED_ECO_TYPES: InstitutionType[] = [
  "监管",
  "流量服务商",
  "数据服务方",
  "支付服务机构",
  "回收机构",
  "公关服务机构",
  "信托服务机构",
  "会计师事务所",
  "律师事务所",
  "资金参与机构",
  "风险参与机构",
  "权益服务商",
  "股权投资人",
];

function isGeoScopedEcoType(t: InstitutionType): boolean {
  return GEO_SCOPED_ECO_TYPES.includes(t);
}

function regulatorMatchesLicenseKind(r: CreditRow, kind: LicenseKind): boolean {
  const blob = `${r.group} ${r.brands} ${r.licenses} ${r.licenseReg} ${r.note} ${r.regulators}`;
  if (kind === "银行") {
    return /央行|银行|Bank|BSP|RBI|OJK|NFRA|金管|银保监|PBOC|人民银行|BI｜|Banxico|BCB|SBP|CBSL|SAMA|BOT｜|BNM|SBV/i.test(
      blob,
    );
  }
  if (kind === "支付") {
    return /支付|电子货币|e-?money|Payment|PBOC|人民银行|BI｜|BSP|央行/i.test(blob);
  }
  if (kind === "保险") {
    return /保险|Insurance|OJK|NFRA|金管|银保监/i.test(blob);
  }
  if (kind === "消金小贷") {
    return /消金|小贷|助贷|P2P|LPBBTI|NBFC|SOFOM|Lending|OLP|Multifinance|放贷|金融公司|Nano|P-Loan|SECP|SEC｜/i.test(
      blob,
    );
  }
  // 其他：协会/反垄断/税务等对照主体
  return /协会|自律|反垄断|竞争|税务|税总|市监|SAMR|AFPI|NIFA|DLAI|KPPU|CCI|PCC/i.test(blob);
}



type MacroFactorRow = {
  metric: string;
  definition: string;
  /** 对各场景信贷资产（消费分期、卡、租赁、经营贷等）的判断含义 */
  meaning: string;
  /** 仅国别卡片展示；不进总表备查、不作风险后台调参 */
  alert: string;
};

/** 国别宏观因子总表（总览只展示指标/口径/含义；预警见 CountryMacroPanel） */
const MACRO_FACTOR_GROUPS: { id: string; title: string; note?: string; rows: MacroFactorRow[] }[] = [
  {
    id: "fundamentals",
    title: "一、经济基本面组",
    rows: [
      {
        metric: "实际GDP季度同比",
        definition: "剔除通胀后的GDP；IMF/WB/TE",
        meaning: "居民收入总底盘；下行周期各场景信贷逾期易同步抬升",
        alert: "连续2个季度负增长；明显低于历史中枢",
      },
      {
        metric: "人均GDP（现价美元）",
        definition: "名义人均GDP",
        meaning: "划分发展阶段，间接反映客群基础偿还能力",
        alert: "低于2000美元抗风险偏弱；高于12000美元消费信贷市场较成熟",
      },
      {
        metric: "人均可支配收入（名义与实际）",
        definition: "扣通胀后得实际人均收入",
        meaning: "直接决定可用于还款的现金流，比GDP更贴近普通人",
        alert: "实际人均收入连续2个季度负增长，违约风险上行",
      },
      {
        metric: "CPI通胀（季度）",
        definition: "季度平均通胀",
        meaning: "侵蚀工薪购买力，易推高多头借贷",
        alert: "季度通胀高于12%属高风险；恶性通胀宜回避",
      },
      {
        metric: "零售汽油价格",
        definition: "泵价；优先 TE 国别 Gasoline Prices（USD/升）",
        meaning: "交通与生活成本先行指标；补贴退坡/油价跳升直接挤压中低收入还款现金流；进口国常叠加经常账户与汇率压力",
        alert: "单季显著上行或补贴取消窗口；绝对价＞2美元/升时对照补贴与税负结构（勿与产油国低价简单横比）",
      },
      {
        metric: "居民电价",
        definition: "居民用电含税均价；优先 GlobalPetrolPrices（USD/kWh）",
        meaning: "生活与小微经营成本；补贴改革或旱季水电短缺时跳升，伤还款与商户贷现金流",
        alert: "＞0.25美元/kWh 或补贴取消后跳升；补贴国账面低价≠真实负担（排队/断电成本另计）",
      },
      {
        metric: "油电比",
        definition: "零售汽油(USD/升) ÷ 居民电价(USD/kWh)；须两国读数齐全才测算",
        meaning: "1升汽油约可购多少kWh居民电；越高燃油相对电费越贵，交通燃油对中低收入还款挤出更强（对照补贴/税负，勿跨国绝对横比）",
        alert: "双端齐全且比值显著上行/补贴退坡窗口；缺汽油或电价任一端则不测算",
      },
      {
        metric: "消费者信心指数",
        definition: "季度读数",
        meaning: "收入预期影响借贷意愿与还款意愿",
        alert: "连续下行时，新发放批次逾期往往先行走高",
      },
      {
        metric: "三产结构（一/二/三产占GDP）",
        definition: "季度产业结构",
        meaning: "一产高：农业收入季节性强；二产主：工薪相对稳；三产高：服务业与非正式就业波动大",
        alert: "一产高于30%季节性风险高；三产高于65%需重点核对非正式就业占比",
      },
    ],
  },
  {
    id: "demo",
    title: "二、人口与就业组",
    rows: [
      {
        metric: "总人口、成年人口（18-64）",
        definition: "联合国口径",
        meaning: "市场总规模与可授信人口基数",
        alert: "成年人口持续萎缩，市场天花板偏低",
      },
      {
        metric: "18-45岁占成年人口比重",
        definition: "联合国年龄结构",
        meaning: "零售与消费类信贷核心客群；年轻人口借贷需求通常更强",
        alert: "低于35%内生增长乏力；高于50%需求足但需警惕青年失业率",
      },
      {
        metric: "总就业率 / ILO失业率",
        definition: "官方与ILO；区分正式与非正式就业",
        meaning: "失业率走高则还款来源受损；非正式就业越高，收入越不稳",
        alert: "失业率高于8%；非正式就业高于60%；青年失业率高于20%",
      },
    ],
  },
  {
    id: "credit-heat",
    title: "三、居民信贷过热",
    rows: [
      {
        metric: "家庭债务/GDP",
        definition: "BIS/IMF",
        meaning: "居民整体负债水位",
        alert: "2-3年快速抬升；新兴市场警戒约45%-55%",
      },
      {
        metric: "家庭债务收入比DTI",
        definition: "家庭总债务/可支配收入",
        meaning: "还本付息压力，比单纯杠杆率更精准",
        alert: "DTI高于80%，整体偿债压力大",
      },
      {
        metric: "信贷-GDP缺口",
        definition: "IMF",
        meaning: "私人信贷是否过热；多头的先行指标",
        alert: "缺口高于+5%，后续大规模逾期概率上升",
      },
      {
        metric: "非银消费信贷季度增速",
        definition: "NBFC/Fintech等消费信贷",
        meaning: "非银扩张速度；判断是否过热与多头蔓延",
        alert: "远高于名义GDP增速，视为过热",
      },
      {
        metric: "银行消费贷NPL（季度）",
        definition: "银行业零售不良",
        meaning: "消费信贷资产质量的先行信号",
        alert: "银行消费贷NPL持续上行，线上与非银资产往往恶化更快",
      },
      {
        metric: "多头借贷占比",
        definition: "征信局；持有不少于2笔贷款的客户占比",
        meaning: "多头泛滥程度",
        alert: "高于30%宜审慎进入",
      },
    ],
  },
  {
    id: "fx",
    title: "四、外汇与跨境资本组",
    note: "境外出资方核心风险：业务模型健康，也可能因换汇受限导致资金无法汇回。",
    rows: [
      {
        metric: "经常账户（近季流量 + CA/GDP）",
        definition:
          "近季经常账户绝对值（时效主尺，TE/央行季频）+ CA/GDP 年占比（结构辅尺，常滞后至上年年末）；展示优先近季",
        meaning:
          "近季看外部失衡方向与规模；CA/GDP 看结构性顺逆差。持续大额逆差带来贬值压力与外储消耗。勿把年占比时点误当成最新季",
        alert: "近季赤字显著扩大，或连续多季大额逆差；警惕外汇管制",
      },
      {
        metric: "外汇储备/短期外债",
        definition: "IMF",
        meaning: "抗外部冲击能力；锁汇与利润汇回风险",
        alert: "储备低于短期外债的100%，极端冲击风险上升",
      },
      {
        metric: "季度汇率（本币兑美元涨跌与波动）",
        definition: "季度期末环比与波动率",
        meaning: "资本金换本币、利润换回美元的汇兑损益",
        alert: "单季贬值超过10%；波动率持续走高",
      },
      {
        metric: "央行政策基准利率",
        definition: "季度央行利率",
        meaning: "资金成本；加息推高借款人还款压力",
        alert: "快速加息周期，逾期往往抬升",
      },
    ],
  },
  {
    id: "infra",
    title: "五、基础设施与监管（可行性）",
    rows: [
      {
        metric: "征信覆盖率",
        definition: "可查询信贷人口/成年人口",
        meaning: "识别多头与风控的基础条件",
        alert: "低于30%：传统征信失效，坏账中枢偏高",
      },
      {
        metric: "智能手机与移动互联网渗透率",
        definition: "World Bank等",
        meaning: "线上获客与线上信贷的基础设施",
        alert: "低于60%，线上模式难跑通",
      },
      {
        metric: "司法债务执行效率",
        definition: "世界银行等",
        meaning: "逾期后法律追偿是否有效",
        alert: "判决执行周期超过18个月，法律催收基本失效",
      },
      {
        metric: "利率上限、牌照、外资持股",
        definition: "当地金融监管",
        meaning: "商业是否可持续、外资能否落地",
        alert: "利率上限过低则合规即亏损；外资或牌照壁垒高",
      },
      {
        metric: "催收、数据本地化、隐私法规",
        definition: "监管法案",
        meaning: "影响风控、获客与回款",
        alert: "强制本地存储或催收限制过严，回款能力受损",
      },
      {
        metric: "新能源整车进口关税",
        definition: "BEV/新能源 CBU 进口关税；可含对华附加税/反补贴合计示意；激励与FTA另注",
        meaning: "决定进口整车落地成本与终端价，影响车贷/融资租赁定价与新能源渗透",
        alert: "非FTA/对华税率≥35%或突然取消零关税激励；厂商分化大须标「待双端」",
      },
      {
        metric: "本地出厂新能源车增值税",
        definition: "本地制造/首次销售适用 VAT·GST·IVA 一般税率；不含购置税/首次登记税除非明示",
        meaning: "出厂端间接税负；与进口关税共同决定相对本地组装 vs 进口 CBU 的成本结构",
        alert: "一般税率显著上调或新能源优惠退坡；联邦+州双轨国勿只读单一税率",
      },
      {
        metric: "新能源税差",
        definition: "税差＝进口关税% − 出厂增值税%（百分点）；双端齐全才测算。不是两税相加，也不是有效综合税率。",
        meaning:
          "高（正且大）：进口关税明显高于本地出厂增值税 → CBU 相对本地出厂更吃亏，政策偏抑制整车进口/催本地组装。低或负：进口关税不高于甚至低于出厂增值税 → 进口端关税压力相对轻（如零关税国）。注意：进口落地往往还另征增值税，本指标只比「关税 vs 出厂增值税」两档名义税率，不作完税模型。",
        alert: "税差≥40个百分点或关税陡升/增值税退坡导致税差跳升",
      },
    ],
  },
];

const MACRO_FACTOR_HEADERS = ["指标", "口径", "含义"];

/** 总览备查：宏观因子框架（默认收起，避免打断主流程版面） */
function MacroFactorFrameworkOverview() {
  const n = MACRO_FACTOR_GROUPS.reduce((s, g) => s + g.rows.length, 0);
  return (
    <AtlasFold id="macro_framework_root" title="宏观因子框架（备查）" count={n} defaultOpen={false}>
      <Stack gap={8}>
        <Text size="small" tone="tertiary">
          {CASH_LOAN_MACRO_FRAMEWORK.purpose}。决策序：{CASH_LOAN_MACRO_FRAMEWORK.decisionOrder}
        </Text>
        {MACRO_FACTOR_GROUPS.map((g) => (
          <AtlasFold id={`macro_${g.id}`} title={g.title} count={g.rows.length} defaultOpen={false}>
            <Stack gap={6}>
              {g.note ? (
                <Text size="small" tone="tertiary">
                  {g.note}
                </Text>
              ) : null}
              <Table
                headers={MACRO_FACTOR_HEADERS}
                rows={g.rows.map((r) => [r.metric, r.definition, r.meaning])}
                striped
              />
            </Stack>
          </AtlasFold>
        ))}
      </Stack>
    </AtlasFold>
  );
}

/** TE 读数：`客观数值·评价描述` → 分行展示 */
function splitMacroReading(raw: string): { value: string; note?: string } {
  const s = raw.trim();
  if (!s) return { value: "" };
  const idx = s.indexOf("·");
  if (idx < 0) return { value: s };
  const value = s.slice(0, idx).trim();
  const note = s.slice(idx + 1).trim();
  if (!note) return { value: s };
  return { value, note: note || undefined };
}

function MacroStat({ raw, label }: { raw: string; label: string }) {
  const theme = useHostTheme();
  const { value, note } = splitMacroReading(raw);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
      <div
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: theme.text.primary,
          lineHeight: 1.25,
          wordBreak: "break-word",
          minHeight: 25,
        }}
      >
        {value || "\u00a0"}
      </div>
      {note ? (
        <div style={{ fontSize: 12, color: theme.text.secondary, lineHeight: 1.35 }}>{note}</div>
      ) : null}
      <div style={{ fontSize: 12, color: theme.text.tertiary }}>{label}</div>
    </div>
  );
}

/** 点选单一国家后展示；版式对齐机构 Card（Header + Body + DetailField） */

type CompareMode = "macro" | InstitutionType;

function compareModeLabel(m: CompareMode): string {
  if (m === "macro") return "国别宏观";
  return INSTITUTION_TYPE_LABEL[m];
}

/** 对照：国别宏观 / 玩家 / 其它机构类型并排 */
const COMPARE_MAX = 6;
/** 空搜时只给少量「随便看看」；有关键词时放宽结果条数 */
const COMPARE_BROWSE_HINT = 12;
const COMPARE_SEARCH_LIMIT = 80;

function parseCmpKeys(raw: string): string[] {
  return raw.split("|").map((x) => x.trim()).filter(Boolean);
}

function joinCmpKeys(keys: string[]): string {
  return [...new Set(keys)].slice(0, COMPARE_MAX).join("|");
}

/** 对照芯片：优先短名（法定全称太长会刷屏） */
function compareCreditLabel(r: CreditRow): string {
  const nick = r.group.split("｜")[0]?.trim() || r.group.split("|")[0]?.trim() || r.group;
  const brand = (r.brands || "").trim();
  if (!brand) return nick;
  if (brand.length > 18 && nick && nick.length < brand.length) return nick;
  return brand;
}

function compareSceneLabel(r: SceneRow): string {
  const nick = r.group.split("｜")[0]?.trim() || r.group.split("|")[0]?.trim() || r.group;
  return nick.length <= 28 ? nick : `${nick.slice(0, 26)}…`;
}

/** 对照：国别 / 机构多选并排（最多 6）；CRM 与大屏共用 */
function CompareHubPanel({ dense = false }: { dense?: boolean }) {
  const theme = useHostTheme();
  const [mode, setMode] = useCanvasState<CompareMode>("cmpMode2", "玩家");
  const [macroKeysRaw, setMacroKeysRaw] = useCanvasState<string>("cmpMacroKeys1", "ID|IN");
  const [instKeysRaw, setInstKeysRaw] = useCanvasState<string>("cmpInstKeys1", "");
  const [pickQ, setPickQ] = useCanvasState<string>("cmpPickQ1", "");
  const [createdPlayers] = useCanvasState<CreditDraft[]>("createdPlayers1", EMPTY_CREDIT_DRAFTS);

  const liveCredits = dedupeCreditRows([
    ...credits,
    ...createdPlayers.map((d) => finalizeCredit(d)),
  ]);

  const modes: CompareMode[] = [
    "macro",
    "玩家",
    "资金参与机构",
    "流量服务商",
    "风控服务方",
    "律师事务所",
    "会计师事务所",
    "回收机构",
    "数据服务方",
    "支付服务机构",
    "评级机构",
  ];

  const q = pickQ.trim();
  const macroKeys = parseCmpKeys(macroKeysRaw) as Exclude<CountryCode, "all">[];
  const instKeys = parseCmpKeys(instKeysRaw);

  type InstPick =
    | { kind: "scene"; key: string; label: string; hint: string; row: SceneRow }
    | { kind: "credit"; key: string; label: string; hint: string; row: CreditRow };

  const findPick = (key: string): InstPick | null => {
    if (!key) return null;
    if (key.startsWith("s:")) {
      const bk = key.slice(2);
      const row = scenes.find((r) => creditBrandKey(r.group) === bk);
      return row
        ? { kind: "scene", key, label: compareSceneLabel(row), hint: row.countries || "", row }
        : null;
    }
    if (key.startsWith("c:")) {
      const bk = key.slice(2);
      const row = liveCredits.find((r) => creditBrandKey(r.group) === bk);
      return row
        ? {
            kind: "credit",
            key,
            label: compareCreditLabel(row),
            hint: [row.countries, row.licenseKinds?.join("·")].filter(Boolean).join(" · "),
            row,
          }
        : null;
    }
    return null;
  };

  /** 当前类型下库内全量候选（未截断） */
  const poolAll: InstPick[] = (() => {
    if (mode === "macro") return [];
    const out: InstPick[] = [];
    if (mode === "玩家") {
      for (const r of scenes) {
        const key = `s:${creditBrandKey(r.group)}`;
        out.push({
          kind: "scene",
          key,
          label: compareSceneLabel(r),
          hint: `场景 · ${r.countries || "—"}`,
          row: r,
        });
      }
      for (const r of liveCredits) {
        if (!r.institutionTypes.includes("玩家")) continue;
        const key = `c:${creditBrandKey(r.group)}`;
        out.push({
          kind: "credit",
          key,
          label: compareCreditLabel(r),
          hint: [r.countries, r.licenseReg?.slice(0, 42)].filter(Boolean).join(" · "),
          row: r,
        });
      }
    } else {
      for (const r of liveCredits) {
        if (!r.institutionTypes.includes(mode)) continue;
        const key = `c:${creditBrandKey(r.group)}`;
        out.push({
          kind: "credit",
          key,
          label: compareCreditLabel(r),
          hint: [r.countries, r.licenseReg?.slice(0, 42)].filter(Boolean).join(" · "),
          row: r,
        });
      }
    }
    return out;
  })();

  const poolMatched: InstPick[] = (() => {
    if (mode === "macro") return [];
    const selected = new Set(instKeys);
    let out = poolAll;
    if (q) {
      out = poolAll.filter((p) => {
        if (p.kind === "scene") {
          return sceneMatchesKeyword(p.row, q) || matchesKeyword(q, p.label, p.row.group);
        }
        return (
          creditMatchesKeyword(p.row, q) ||
          matchesKeyword(q, p.label, p.row.group, p.row.brands, p.row.licenseReg)
        );
      });
    }
    out = [...out].sort((a, b) => {
      const as = selected.has(a.key) ? 0 : 1;
      const bs = selected.has(b.key) ? 0 : 1;
      if (as !== bs) return as - bs;
      if (q) {
        const ra = keywordRelevanceRank(
          q,
          a.row.group,
          a.kind === "credit" ? a.row.brands : a.label,
          a.label,
        );
        const rb = keywordRelevanceRank(
          q,
          b.row.group,
          b.kind === "credit" ? b.row.brands : b.label,
          b.label,
        );
        if (ra !== rb) return ra - rb;
      }
      return a.label.localeCompare(b.label, "zh");
    });
    // 空搜：不铺开全库，只给少量浏览提示；有关键词：展示匹配结果（截断上限）
    const limit = q ? COMPARE_SEARCH_LIMIT : COMPARE_BROWSE_HINT;
    return out.slice(0, limit);
  })();

  const matchTotal = (() => {
    if (mode === "macro" || !q) return poolAll.length;
    return poolAll.filter((p) => {
      if (p.kind === "scene") {
        return sceneMatchesKeyword(p.row, q) || matchesKeyword(q, p.label, p.row.group);
      }
      return (
        creditMatchesKeyword(p.row, q) ||
        matchesKeyword(q, p.label, p.row.group, p.row.brands, p.row.licenseReg)
      );
    }).length;
  })();

  const macroCodes = (Object.keys(COUNTRY_LABEL) as CountryCode[]).filter(
    (c) => c !== "all" && COUNTRY_MACRO[c as Exclude<CountryCode, "all">],
  );

  function toggleMacro(code: Exclude<CountryCode, "all">) {
    const cur = [...macroKeys];
    const i = cur.indexOf(code);
    if (i >= 0) cur.splice(i, 1);
    else if (cur.length < COMPARE_MAX) cur.push(code);
    setMacroKeysRaw(joinCmpKeys(cur));
  }

  function toggleInst(key: string) {
    const cur = [...instKeys];
    const i = cur.indexOf(key);
    if (i >= 0) cur.splice(i, 1);
    else if (cur.length < COMPARE_MAX) cur.push(key);
    setInstKeysRaw(joinCmpKeys(cur));
  }

  const selectedInst = instKeys.map(findPick).filter(Boolean) as InstPick[];
  const nShow = mode === "macro" ? macroKeys.length : selectedInst.length;
  const minCard = dense ? 260 : 280;
  const listMaxH = dense ? 220 : 280;

  return (
    <Stack gap={dense ? 12 : 14}>
      <Stack gap={4}>
        <Text size="small" weight="medium">
          对照对象
        </Text>
        <Row gap={6} wrap>
          {modes.map((m) => (
            <FilterChip
              label={compareModeLabel(m)}
              active={mode === m}
              onClick={() => {
                setMode(m);
                setPickQ("");
              }}
            />
          ))}
        </Row>
        <Text size="small" tone="tertiary">
          可多选，最多 {COMPARE_MAX} 个；再点已选项可取消。已选 {nShow}/{COMPARE_MAX}
          {mode !== "macro" ? ` · 本类库内约 ${poolAll.length} 家` : ""}
        </Text>
      </Stack>

      {mode === "macro" ? (
        <Stack gap={12}>
          <Text size="small" tone="tertiary">
            有宏观快照的国家可点选（共 {macroCodes.length}）；不会一次铺开全部对照卡。
          </Text>
          <Row gap={6} wrap>
            {macroCodes.map((c) => {
              const code = c as Exclude<CountryCode, "all">;
              const on = macroKeys.includes(code);
              return (
                <FilterChip
                  label={COUNTRY_LABEL[c]}
                  active={on}
                  clearable={on}
                  present={on}
                  onClick={() => toggleMacro(code)}
                />
              );
            })}
          </Row>
          {macroKeys.length ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(auto-fit, minmax(${minCard}px, 1fr))`,
                gap: 12,
              }}
            >
              {macroKeys.map((code) => (
                <Stack key={code} gap={6}>
                  <Row gap={6} align="center" justify="space-between">
                    <Text size="small" tone="tertiary">
                      {COUNTRY_LABEL[code]}
                    </Text>
                    <Pill tone="neutral" size="sm" onClick={() => toggleMacro(code)}>
                      移除
                    </Pill>
                  </Row>
                  <CountryMacroPanel country={code} />
                </Stack>
              ))}
            </div>
          ) : (
            <Callout tone="neutral">请点选至少一个国家加入对照。</Callout>
          )}
        </Stack>
      ) : (
        <Stack gap={12}>
          <TextInput
            value={pickQ}
            onChange={setPickQ}
            placeholder={`搜索${compareModeLabel(mode)}：品牌 / 法定名 / 牌照 / 国家`}
            type="search"
          />
          {selectedInst.length ? (
            <Row gap={6} wrap>
              {selectedInst.map((p) => (
                <FilterChip
                  key={`sel-${p.key}`}
                  label={p.label}
                  active
                  clearable
                  present
                  onClick={() => toggleInst(p.key)}
                />
              ))}
            </Row>
          ) : null}
          <Callout tone="neutral">
            {q
              ? `匹配 ${matchTotal} 家${matchTotal > poolMatched.length ? `（下列展示前 ${poolMatched.length}）` : ""}；点行加入对照。`
              : `库内约 ${poolAll.length} 家可对照（含监管名录导入的消金/LPBBTI 等）。默认不铺开全部，请搜索后点选；下列为随便看看 ${Math.min(COMPARE_BROWSE_HINT, poolAll.length)} 家。`}
          </Callout>
          <div
            style={{
              maxHeight: listMaxH,
              overflow: "auto",
              border: `1px solid ${theme.stroke.tertiary}`,
              borderRadius: 8,
              background: theme.bg.elevated,
            }}
          >
            {poolMatched.length ? (
              poolMatched.map((p) => {
                const on = instKeys.includes(p.key);
                const full = COMPARE_MAX > 0 && !on && selectedInst.length >= COMPARE_MAX;
                return (
                  <button
                    key={p.key}
                    type="button"
                    disabled={full}
                    onClick={() => toggleInst(p.key)}
                    style={{
                      display: "flex",
                      width: "100%",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: dense ? "8px 10px" : "10px 12px",
                      border: "none",
                      borderBottom: `1px solid ${theme.stroke.tertiary}`,
                      background: on ? theme.fill.tertiary : "transparent",
                      cursor: full ? "not-allowed" : "pointer",
                      textAlign: "left",
                      font: "inherit",
                      opacity: full ? 0.45 : 1,
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 13,
                          fontWeight: on ? 600 : 500,
                          color: theme.text.primary,
                        }}
                      >
                        {p.label}
                      </span>
                      {p.hint ? (
                        <span
                          style={{
                            display: "block",
                            fontSize: 11,
                            color: theme.text.tertiary,
                            marginTop: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.hint}
                        </span>
                      ) : null}
                    </span>
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: 12,
                        color: on ? theme.text.link : theme.text.tertiary,
                      }}
                    >
                      {on ? "已选 · 取消" : full ? "已满" : "加入"}
                    </span>
                  </button>
                );
              })
            ) : (
              <div style={{ padding: 12 }}>
                <Text size="small" tone="tertiary">
                  {q ? "无匹配机构，换个关键词试试。" : "本类暂无机构。"}
                </Text>
              </div>
            )}
          </div>
          {selectedInst.length ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(auto-fit, minmax(${minCard}px, 1fr))`,
                gap: 12,
              }}
            >
              {selectedInst.map((p) => (
                <Stack key={p.key} gap={6}>
                  <Row gap={6} align="center" justify="space-between">
                    <Text size="small" tone="tertiary">
                      {p.label}
                    </Text>
                    <Pill tone="neutral" size="sm" onClick={() => toggleInst(p.key)}>
                      移除
                    </Pill>
                  </Row>
                  {p.kind === "scene" ? <ScenePlayer r={p.row} /> : <CreditPlayer r={p.row} />}
                </Stack>
              ))}
            </div>
          ) : (
            <Callout tone="neutral">搜索并点选机构加入对照（可多选，最多 {COMPARE_MAX}）。</Callout>
          )}
        </Stack>
      )}
    </Stack>
  );
}

function CashLoanFlagDot({ flag }: { flag?: "watch" | "hot" | "ok" }) {
  if (!flag) return null;
  const color = flag === "hot" ? "#E53935" : flag === "watch" ? "#D97706" : "#1B8F4A";
  const label = flag === "hot" ? "高压" : flag === "watch" ? "留意" : "偏稳";
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        fontWeight: 600,
        color,
        marginLeft: 6,
        verticalAlign: "middle",
      }}
    >
      {label}
    </span>
  );
}

function CashLoanMacroGroupBlock({
  group,
  chart,
  defaultOpen,
}: {
  group: CashLoanMacroGroup;
  chart?: ReactNode;
  defaultOpen?: boolean;
}) {
  const theme = useHostTheme();
  const [open, setOpen] = useState(Boolean(defaultOpen && chart));
  return (
    <div
      style={{
        border: `1px solid ${theme.stroke.tertiary}`,
        borderRadius: 8,
        padding: "10px 12px",
        background: theme.bg.elevated,
      }}
    >
      <Row gap={8} align="center" justify="space-between" wrap>
        <Text size="small" weight="medium">
          <span style={{ color: theme.text.tertiary, marginRight: 6 }}>{group.step}</span>
          {group.title}
        </Text>
        {chart ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{
              border: "none",
              background: "transparent",
              color: theme.text.tertiary,
              font: "inherit",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {open ? "收起图 ▾" : "展开图 ▸"}
          </button>
        ) : null}
      </Row>
      <div style={{ fontSize: 12, color: theme.text.secondary, lineHeight: 1.45, marginTop: 4 }}>
        {group.soWhat}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 8,
          marginTop: 10,
        }}
      >
        {group.metrics.map((m) => (
          <div key={`${group.id}-${m.label}`} style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: theme.text.tertiary }}>
              {m.label}
              <CashLoanFlagDot flag={m.flag} />
            </div>
            <div
              style={{
                fontSize: 12,
                color: theme.text.primary,
                lineHeight: 1.4,
                marginTop: 2,
                wordBreak: "break-word",
              }}
            >
              <CitedText text={m.value} size="small" />
              <MacroAsOfLine asOf={m.asOf} fromSnap={m.asOfFromSnap} />
            </div>
          </div>
        ))}
      </div>
      {open && chart ? <div style={{ marginTop: 12 }}>{chart}</div> : null}
    </div>
  );
}

function CountryMacroPanel({ country }: { country: CountryCode }) {
  if (country === "all") return null;
  const code = country as Exclude<CountryCode, "all">;
  const snap = getCountryMacro(code) || COUNTRY_MACRO[code];
  const macroBrief = snap ? synthesizeCashLoanBrief(snap) : "";
  const macroNote = snap ? displayCreditNote(snap) : undefined;
  const langLine = formatCountryLanguageLine(code);
  const langInfo = getCountryLanguage(code);
  const teUrl = teIndicatorsUrl(code);
  const theme = useHostTheme();
  const groups = snap ? buildCashLoanMacroGroups(snap) : [];
  const citeNos = snap ? collectCountryMacroCiteNos(snap) : [];

  const chartById: Record<string, ReactNode> = snap
    ? {
        fx_cross: <FxCaCharts snap={snap} countryLabel={COUNTRY_LABEL[code]} countryCode={code} />,
        borrower: (
          <Stack gap={10}>
            {getVitalCountry(code) ? (
              <VitalPyramid country={code} countryLabel={COUNTRY_LABEL[code]} />
            ) : (
              <Text size="small" tone="tertiary">
                暂无出生队列，人口结构图略。
              </Text>
            )}
            <IncomeSectorCharts snap={snap} countryLabel={COUNTRY_LABEL[code]} countryCode={code} />
          </Stack>
        ),
        credit_heat: <CreditDebtCharts snap={snap} countryLabel={COUNTRY_LABEL[code]} />,
        stress: <StressPricingCharts countryCode={code} countryLabel={COUNTRY_LABEL[code]} />,
      }
    : {};

  return (
    <Stack gap={8}>
      <Card>
        <CardHeader
          trailing={
            <Row gap={6} align="center">
              {countryLanguageZone(code) ? (
                <Pill tone="info" size="sm">
                  {countryLanguageZone(code)}
                </Pill>
              ) : null}
              <Pill tone="neutral" size="sm">
                现金贷视角
              </Pill>
            </Row>
          }
        >
          {COUNTRY_LABEL[code]}
        </CardHeader>
        <CardBody>
          <Stack gap={10}>
            {snap ? (
              <Stack gap={10}>
                <Text size="small" tone="tertiary">
                  对照时点 · {snap.asOf}
                  {langLine ? ` · ${langLine}` : ""}
                  {langInfo?.productHint ? ` · 产品常用语 ${langInfo.productHint}` : ""}
                </Text>
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${theme.stroke.tertiary}`,
                    background: theme.fill.quaternary,
                  }}
                >
                  <div style={{ fontSize: 11, color: theme.text.tertiary, marginBottom: 4 }}>
                    现金贷准入简评 · 决策序 ①监管基建 → ②汇兑 → ③客群 → ④过热 → ⑤压测
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: theme.text.primary }}>
                    <CitedText text={macroBrief} size="small" />
                  </div>
                  <div style={{ fontSize: 11, color: theme.text.tertiary, marginTop: 6 }}>
                    ①牌照/利率上限/催收见「监管」页，宏观卡从②起读。
                  </div>
                </div>
                {groups.map((g) => (
                  <CashLoanMacroGroupBlock
                    key={g.id}
                    group={g}
                    chart={chartById[g.id]}
                    defaultOpen={g.id === "fx_cross"}
                  />
                ))}
                {macroNote ? <DetailField label="补充" value={macroNote} /> : null}
                <MacroSourcesBlock citeNos={citeNos} />
              </Stack>
            ) : (
              <Stack gap={8}>
                {langLine ? (
                  <Text size="small" tone="tertiary">
                    {langLine}
                    {langInfo?.productHint ? ` · 产品常用语 ${langInfo.productHint}` : ""}
                  </Text>
                ) : null}
                <Text size="small" tone="secondary">
                  尚未落该国扩展快照。按总览「国别宏观因子总表」采数后回写 COUNTRY_MACRO。
                </Text>
              </Stack>
            )}
            {teUrl ? (
              <Text size="small" tone="tertiary">
                <Link href={teUrl}>Trading Economics · {COUNTRY_LABEL[code]}指标</Link>
              </Text>
            ) : null}
          </Stack>
        </CardBody>
      </Card>
      <AtlasFold
        id={`macro_alert_${code}`}
        title="预警参照"
        count={MACRO_FACTOR_GROUPS.reduce((n, g) => n + g.rows.length, 0)}
        defaultOpen={false}
      >
        <Stack gap={6}>
          <Text size="small" tone="tertiary">
            对照阈值备查；不作放款硬门槛
          </Text>
          <Table
            headers={["指标", "预警"]}
            rows={MACRO_FACTOR_GROUPS.flatMap((g) => g.rows.map((r) => [r.metric, r.alert]))}
            striped
          />
        </Stack>
      </AtlasFold>
    </Stack>
  );
}

/** 监管页 / 玩家页 / 生态机构页共用：洲际 → 国家 → 牌照粗类；presentSets 反向亮起已覆盖属地 */
function GeoAndLicenseFilters({
  region,
  country,
  langZone = "all",
  licenseKind,
  onRegion,
  onLangZone,
  onCountry,
  onCountryChip,
  onLicenseKind,
  showLicenseKind = true,
  coveredRegions,
  coveredCountries,
}: {
  region: Region;
  country: CountryFilter;
  langZone?: LangZoneFilter;
  licenseKind: LicenseKind | "all";
  onRegion: (r: Region) => void;
  onLangZone?: (z: LangZoneFilter) => void;
  /** 单选回写（旧调用方）；与 onCountryChip 二选一 */
  onCountry?: (c: CountryCode) => void;
  /** 多选芯片；优先于 onCountry */
  onCountryChip?: (c: CountryCode) => void;
  onLicenseKind: (k: LicenseKind | "all") => void;
  showLicenseKind?: boolean;
  /** 反向映射：该机构类型已覆盖的洲际（不含 all） */
  coveredRegions?: Set<Exclude<Region, "all">>;
  /** 反向映射：该机构类型已覆盖的国家 */
  coveredCountries?: Set<Exclude<CountryCode, "all">>;
}) {
  const showPresent = Boolean(coveredRegions || coveredCountries);
  const regionPresent = (k: Region) => {
    if (!showPresent) return undefined;
    if (k === "all") return (coveredRegions?.size ?? 0) > 0;
    return coveredRegions?.has(k) ?? false;
  };
  const countryPresent = (k: CountryCode) => {
    if (!showPresent) return undefined;
    if (k === "all") return (coveredCountries?.size ?? 0) > 0;
    return coveredCountries?.has(k) ?? false;
  };
  const filterHint = formatCountryFilterLabel(country, region);
  const handleCountryChip = (k: CountryCode) => {
    if (onCountryChip) {
      onCountryChip(k);
      return;
    }
    if (onCountry) {
      // 单选：再点同一国则回全部
      const single = countryFilterSingle(country);
      onCountry(k !== "all" && single === k ? "all" : k);
    }
  };
  return (
    <Stack gap={10}>
      <Stack gap={4}>
        <Text size="small" weight="medium">
          涉足洲际
        </Text>
        <Text size="small" tone="tertiary">
          亮起 = 已收录 · 未亮 = 尚未创设
        </Text>
        <Row gap={6} wrap>
          {(Object.keys(REGION_LABEL) as Region[]).map((k) => (
            <FilterChip
              label={REGION_LABEL[k]}
              active={region === k}
              present={regionPresent(k)}
              clearable={k !== "all"}
              onClick={() => onRegion(region === k && k !== "all" ? "all" : k)}
            />
          ))}
        </Row>
      </Stack>

      {onLangZone ? (
        <SoftFold
          title="语言区"
          hint={langZone === "all" ? "按展业语言区收窄；选项随洲际变化" : `已选 ${langZone}`}
          count={languageZonesForRegion(region).length}
          defaultOpen={langZone !== "all"}
        >
          <Text size="small" tone="tertiary">
            按展业语言区收窄；选项随洲际变化
          </Text>
          <Row gap={6} wrap>
            <FilterChip
              label="全部语言区"
              active={langZone === "all"}
              onClick={() => onLangZone("all")}
            />
            {languageZonesForRegion(region).map((z) => (
              <FilterChip
                label={z}
                active={langZone === z}
                clearable
                onClick={() => onLangZone(langZone === z ? "all" : z)}
              />
            ))}
          </Row>
        </SoftFold>
      ) : null}

      <SoftFold
        title="涉足国家/地区"
        hint={
          filterHint
            ? `当前 · ${filterHint}`
            : onCountryChip
              ? "多选收窄；点标题可收起"
              : "点选收窄；再点同一国取消"
        }
        count={countriesForRegionAndLang(region, langZone).length}
        defaultOpen={country !== "all"}
      >
        <Text size="small" tone="tertiary">
          {onCountryChip
            ? "多选：点「全部」后点掉某国 = 除该国以外；再点可加回/去掉"
            : "点选收窄；再点同一国取消"}
        </Text>
        <Row gap={6} wrap>
          {countriesForRegionAndLang(region, langZone).map((k) => (
            <FilterChip
              label={COUNTRY_LABEL[k]}
              active={isCountryChipActive(country, k)}
              present={countryPresent(k)}
              clearable={k !== "all"}
              onClick={() => handleCountryChip(k)}
            />
          ))}
        </Row>
        {filterHint ? (
          <Text size="small" tone="secondary">
            当前筛选 · {filterHint}
          </Text>
        ) : null}
      </SoftFold>

      {showLicenseKind ? (
        <SoftFold
          title="涉及金融牌照"
          hint={
            licenseKind === "all"
              ? "按银行/保险/支付/消金等粗类收窄"
              : `已选 ${LICENSE_KIND_LABEL[licenseKind]}`
          }
          count={LICENSE_KIND_ORDER.length}
          defaultOpen={licenseKind !== "all"}
        >
          <Row gap={6} wrap>
            <FilterChip
              label="全部牌照粗类"
              active={licenseKind === "all"}
              onClick={() => onLicenseKind("all")}
            />
            {LICENSE_KIND_ORDER.map((k) => (
              <FilterChip
                label={LICENSE_KIND_LABEL[k]}
                active={licenseKind === k}
                clearable
                onClick={() => onLicenseKind(licenseKind === k ? "all" : k)}
              />
            ))}
          </Row>
        </SoftFold>
      ) : null}
    </Stack>
  );
}

/** 未登录门禁：受控输入（state + globalThis 双写，重建不丢字） */
function LoginPage() {
  const theme = useHostTheme();
  const [users, setUsers] = useCanvasState<Record<string, AuthUserRecord>>("authUsers1", {});
  const [, setSession] = useCanvasState("authSession1", "");
  const [, setEmail] = useCanvasState("claimEmail1", "");
  const [userSaved, setUserSaved] = useCanvasState("loginUserDraft", "");
  const [passSaved, setPassSaved] = useCanvasState("loginPassDraft", "");
  const [showPass, setShowPass] = useCanvasState("loginShowPw2", false);
  const [err, setErr] = useCanvasState("loginErr1", "");
  const draft = getLoginDraft();

  // 重建后若 state 已恢复而内存草稿空，回填草稿；若草稿比 state 新（竞态），以草稿为准展示
  if (userSaved && !draft.email) draft.email = userSaved;
  if (passSaved && !draft.pass) draft.pass = passSaved;
  const userInput = pickLoginValue(userSaved, draft.email);
  const passInput = pickLoginValue(passSaved, draft.pass);

  function setUserInput(v: string) {
    draft.email = v;
    // 必须即时 setState：仅写 draft 不重渲染，受控 input 会吞字
    setUserSaved(v);
  }
  function setPassInput(v: string) {
    draft.pass = v;
    setPassSaved(v);
  }

  function onLogin() {
    const g = globalThis as unknown as { __crmLoginPersistTimer?: ReturnType<typeof setTimeout> };
    if (g.__crmLoginPersistTimer) clearTimeout(g.__crmLoginPersistTimer);
    setUserSaved(draft.email);
    setPassSaved(draft.pass);
    const emailRaw = pickLoginValue(userSaved, draft.email).trim() || draft.email.trim();
    const pass = pickLoginValue(passSaved, draft.pass) || draft.pass;
    if (!emailRaw || !pass) {
      setErr("请输入邮箱与密码");
      return;
    }
    if (!emailHasClaimPermission(emailRaw)) {
      setErr("邮箱或密码错误");
      return;
    }
    const key = claimLocalPart(emailRaw);
    const u = resolveAuthUser(users, key);
    if (!u.enabled) {
      setErr("账号不可用，请联系管理员");
      return;
    }
    const isAdmin = isClaimAdmin(key);
    if (u.locked && !(isAdmin && pass === CLAIM_DEFAULT_PASSWORD)) {
      setErr("账号已锁定，请联系管理员重置");
      return;
    }
    if (pass !== u.password) {
      if (isAdmin) {
        setErr("邮箱或密码错误");
      } else {
        setUsers((prev) => ({ ...prev, [key]: { ...u, locked: true } }));
        setErr("密码错误，账号已锁定，请联系管理员重置");
      }
      setPassInput("");
      return;
    }
    setUsers((prev) => ({
      ...prev,
      [key]: { ...u, locked: false, password: u.password || CLAIM_DEFAULT_PASSWORD },
    }));
    setSession(key);
    setEmail(normalizeClaimEmail(emailRaw));
    setErr("");
    setPassInput("");
  }

  return (
    <Stack gap={24} style={{ maxWidth: 420 }}>
      <Stack gap={6}>
        <H1>CRM 生态系统</H1>
        <Text size="small" tone="secondary">
          登录后继续
        </Text>
      </Stack>
      <div
        style={mergeStyle({
          padding: 16,
          borderRadius: 10,
          background: theme.bg.elevated,
          border: `1px solid ${theme.stroke.tertiary}`,
        })}
      >
        <Stack gap={12}>
          <Stack gap={4}>
            <Text size="small" weight="medium">
              邮箱
            </Text>
            <input
              type="text"
              placeholder="邮箱"
              autoComplete="username"
              spellCheck={false}
              value={userInput}
              onChange={(e) => {
                const t = e.currentTarget as unknown as { value?: string };
                setUserInput(t.value ?? "");
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData?.getData("text") ?? "";
                if (!pasted) return;
                e.preventDefault();
                const t = e.currentTarget as unknown as {
                  selectionStart?: number | null;
                  selectionEnd?: number | null;
                };
                setUserInput(applyPasteToValue(userInput, t.selectionStart, t.selectionEnd, pasted));
              }}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid ${theme.stroke.tertiary}`,
                background: theme.bg.editor,
                color: theme.text.primary,
                outline: "none",
                fontSize: 13,
              }}
            />
          </Stack>
          <Stack gap={4}>
            <Text size="small" weight="medium">
              密码
            </Text>
            <LoginPasswordField
              value={passInput}
              onChange={setPassInput}
              showPass={showPass}
              onToggle={() => setShowPass(!showPass)}
            />
          </Stack>
          {err ? <Callout tone="danger">{err}</Callout> : null}

          <Row gap={8} wrap>
            <Button variant="primary" onClick={onLogin}>
              登录
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSession("guest");
                setErr("");
              }}
            >
              访客进入
            </Button>
          </Row>
        </Stack>
      </div>
    </Stack>
  );
}

/** Cursor 风格登录后身份条：缩写头像 · 名称 · 角色 · Update · 设置 */
function SessionChrome({ trailing }: { trailing?: ReactNode }) {
  const theme = useHostTheme();
  const [session, setSession] = useCanvasState("authSession1", "");
  const [users, setUsers] = useCanvasState<Record<string, AuthUserRecord>>("authUsers1", {});
  const [, setEmail] = useCanvasState("claimEmail1", "");
  const [panel, setPanel] = useCanvasState<"none" | "password" | "admin">("authPanel1", "none");
  const [oldPw, setOldPw] = useCanvasState("chgOld1", "");
  const [newPw, setNewPw] = useCanvasState("chgNew1", "");
  const [msg, setMsg] = useCanvasState("sessMsg1", "");

  const user = resolveAuthUser(users, session);
  const admin = isClaimAdmin(session);
  const initials = (user.displayLocal || session || "?").slice(0, 2).toUpperCase();

  function logout() {
    setSession("");
    setEmail("");
    setPanel("none");
    setMsg("");
    setOldPw("");
    setNewPw("");
  }

  function changePassword() {
    const u = resolveAuthUser(users, session);
    if (oldPw !== u.password) {
      setMsg("原密码错误");
      return;
    }
    if (newPw.trim().length < 6) {
      setMsg("新密码至少 6 位");
      return;
    }
    setUsers((prev) => ({ ...prev, [session]: { ...u, password: newPw.trim() } }));
    setOldPw("");
    setNewPw("");
    setMsg("密码已更新");
    setPanel("none");
  }

  function adminReset(local: string) {
    const u = resolveAuthUser(users, local);
    setUsers((prev) => ({
      ...prev,
      [local]: { ...u, password: CLAIM_DEFAULT_PASSWORD, locked: false, enabled: true },
    }));
    setMsg(`已重置 ${canonicalClaimLocal(local)}`);
  }

  function adminToggle(local: string) {
    const u = resolveAuthUser(users, local);
    setUsers((prev) => ({ ...prev, [local]: { ...u, enabled: !u.enabled } }));
  }

  return (
    <Stack gap={10}>
      <Row gap={8} align="center" wrap style={{ width: "100%" }}>
        <div
          style={mergeStyle({
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "4px 0",
            background: "transparent",
          })}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: theme.fill.secondary,
              color: theme.text.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text size="small" weight="medium">
              {user.displayLocal}
            </Text>
            <Text size="small" tone="tertiary">
              {admin ? "Admin" : session === "guest" ? "Guest" : "Member"}
            </Text>
          </div>
          <Button
            variant="primary"
            onClick={() => setPanel(panel === "password" ? "none" : "password")}
          >
            Update
          </Button>
          <IconButton
            title="设置"
            size="sm"
            onClick={() => setPanel(panel === "admin" ? "none" : admin ? "admin" : "password")}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.2" />
              <path
                d="M7 1.2v1.4M7 11.4v1.4M1.2 7h1.4M11.4 7h1.4M2.6 2.6l1 1M10.4 10.4l1 1M10.4 2.6l-1 1M2.6 11.4l1-1"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </IconButton>
        </div>
        {trailing ? <div style={{ flexShrink: 0 }}>{trailing}</div> : null}
      </Row>

      {panel === "password" ? (
        <div
          style={mergeStyle({
            padding: 12,
            borderRadius: 10,
            background: theme.bg.elevated,
            border: `1px solid ${theme.stroke.tertiary}`,
          })}
        >
          <Stack gap={8}>
            <Text size="small" weight="medium">
              更改密码
            </Text>
            <TextInput type="password" value={oldPw} onChange={setOldPw} placeholder="原密码" />
            <TextInput
              type="password"
              value={newPw}
              onChange={setNewPw}
              placeholder="新密码（至少 6 位）"
            />
            <Row gap={8}>
              <Button variant="primary" onClick={changePassword}>
                保存
              </Button>
              <Button variant="ghost" onClick={() => setPanel("none")}>
                取消
              </Button>
              <Button variant="secondary" onClick={logout}>
                退出登录
              </Button>
            </Row>
          </Stack>
        </div>
      ) : null}

      {panel === "admin" && admin ? (
        <div
          style={mergeStyle({
            padding: 12,
            borderRadius: 10,
            background: theme.bg.elevated,
            border: `1px solid ${theme.stroke.tertiary}`,
          })}
        >
          <Stack gap={8}>
            <Text size="small" weight="medium">
              用户管理
            </Text>
            <Text size="small" tone="tertiary">
              重置后恢复初始密码并解锁；可停用账号
            </Text>
            {CLAIM_ALLOWED_LOCALS.map((name) => {
              const key = name.toLowerCase();
              const u = resolveAuthUser(users, key);
              return (
                <Row gap={8} align="center" wrap>
                  <Text size="small" weight="medium">
                    {u.displayLocal}
                  </Text>
                  <Text size="small" tone="tertiary">
                    {u.locked ? "已锁定" : u.enabled ? "正常" : "已停用"}
                  </Text>
                  <Button variant="secondary" onClick={() => adminReset(key)}>
                    重置密码
                  </Button>
                  <Button variant="ghost" onClick={() => adminToggle(key)}>
                    {u.enabled ? "停用" : "启用"}
                  </Button>
                </Row>
              );
            })}
            <Row gap={8}>
              <Button variant="ghost" onClick={() => setPanel("none")}>
                关闭
              </Button>
              <Button variant="secondary" onClick={logout}>
                退出登录
              </Button>
            </Row>
          </Stack>
        </div>
      ) : null}

      {msg ? (
        <Text size="small" tone="tertiary">
          {msg}
        </Text>
      ) : null}
    </Stack>
  );
}

function ListMetaRow({
  count,
  unit = "家",
  children,
}: {
  count: number;
  unit?: string;
  children?: string | null;
}) {
  return (
    <Row gap={8} align="center" wrap>
      {children}
      <Text size="small" tone="secondary">
        {count} {unit}
      </Text>
    </Row>
  );
}

function SourceVerifyBlock({
  orgKey,
  verify,
  trafficRank,
  licenseReg,
}: {
  orgKey: string;
  verify: VerifyStatus;
  trafficRank: string;
  licenseReg: string;
}) {
  const [email] = useCanvasState("claimEmail1", "");
  const [session] = useCanvasState("authSession1", "");
  const [claims, setClaims] = useCanvasState<Record<string, ClaimRecord>>("claims1", {});
  const [note, setNote] = useCanvasState("claimNote1", "");
  const [status, setStatus] = useCanvasState("claimStat1", "");
  const claim = claims[orgKey];
  const can =
    Boolean(session) &&
    emailHasClaimPermission(email) &&
    claimLocalPart(email) === session.trim().toLowerCase();
  const channels = inferSourceChannels(verify, trafficRank, licenseReg, Boolean(claim));
  const complete = verify === "双端通过";

  function submitClaim() {
    if (!can) {
      setStatus("无认领权限：请先登录有效账号");
      return;
    }
    const displayName = defaultClaimDisplayName(email);
    const confirmedAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    setClaims((prev) => ({
      ...prev,
      [orgKey]: {
        email: normalizeClaimEmail(email),
        displayName,
        note: note.trim() || "已联系确认；经办对信息质量负责",
        confirmedAt,
      },
    }));
    setNote("");
    setStatus(`已认领 · ${displayName}`);
  }

  function clearClaim() {
    if (!can) {
      setStatus("无认领权限，无法撤销他人认领");
      return;
    }
    if (!claim || normalizeClaimEmail(claim.email) !== normalizeClaimEmail(email)) {
      setStatus("仅本人可撤销自己的认领");
      return;
    }
    setClaims((prev) => {
      const next = { ...prev };
      delete next[orgKey];
      return next;
    });
    setStatus("已撤销认领");
  }

  return (
    <Stack gap={8}>
      <Row gap={8} align="center" wrap>
        <Text size="small" weight="medium">
          信源核实（非经营性征标签）
        </Text>
        {complete ? (
          <Pill tone="success" size="sm">
            完整验证
          </Pill>
        ) : (
          <Pill tone={verifyTone(verify)} size="sm">
            {VERIFY_LABEL[verify]}
          </Pill>
        )}
      </Row>
      <Text size="small" tone="secondary">
        信源一般来自：流量源、监管源、经办认领；宏观对照 Trading Economics〔1〕；国内债券/ABN 交叉中国货币网〔9〕；研报见点点〔2〕/墨腾〔3〕。正文用〔n〕标注，点击跳转「信源编号」目录。
      </Text>
      <Row gap={6} wrap>
        {SOURCE_CHANNEL_ORDER.map((c) => (
          <Pill tone={channels.includes(c) ? "info" : "neutral"} size="sm">
            {channels.includes(c) ? `已接入·${c}` : `未接入·${c}`}
          </Pill>
        ))}
      </Row>
      {complete ? (
        <Callout tone="success">
          多源已交叉核实。建议客户经理在更高质量信源（监管登记号补全、经办认领确认）下继续跟进，巩固机构主档。
        </Callout>
      ) : (
        <Callout tone="warning">
          信源未齐或仅单侧时，在字段旁标注〔n〕出处编号（不再写「待双端」）；点编号打开信源/研报目录核对。
        </Callout>
      )}
      <Grid columns={2} gap={10}>
        <DetailField label={SOURCE_CHANNEL_LABEL.流量源} value={trafficRank} />
        <DetailField label={SOURCE_CHANNEL_LABEL.监管源} value={licenseReg} />
      </Grid>
      <Stack gap={6}>
        <Text size="small" tone="tertiary" weight="medium">
          {SOURCE_CHANNEL_LABEL.经办认领}
        </Text>
        {claim ? (
          <Stack gap={4}>
            <Text size="small">
              已认领 · {claim.displayName}（{claim.email}）· {claim.confirmedAt}
            </Text>
            <Text size="small" tone="secondary">
              {claim.note}
            </Text>
            {can && normalizeClaimEmail(claim.email) === normalizeClaimEmail(email) ? (
              <Button variant="ghost" onClick={clearClaim}>
                撤销我的认领
              </Button>
            ) : null}
          </Stack>
        ) : (
          <Stack gap={6}>
            <Text size="small" tone="secondary">
              待有权限客户经理认领回填（联系确认后对信息质量负责）
            </Text>
            {can ? (
              <>
                <TextInput
                  value={note}
                  onChange={setNote}
                  placeholder="确认摘要（可选）：联系人/要点…"
                />
                <Row gap={8}>
                  <Button variant="primary" onClick={submitClaim}>
                    确认认领（{defaultClaimDisplayName(email)}）
                  </Button>
                </Row>
              </>
            ) : (
              <Callout tone="neutral">
                当前未登录或无认领权限。请先登录后再认领。
              </Callout>
            )}
          </Stack>
        )}
        {status ? (
          <Text size="small" tone="tertiary">
            {status}
          </Text>
        ) : null}
      </Stack>
    </Stack>
  );
}

/** 表卡内「详情」折叠：原生 details，不写 sidecar、不触发整树重挂 */
function CompactDetails({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <details style={{ margin: 0 }}>
      <summary
        style={{
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          width: "fit-content",
          userSelect: "none",
          listStyle: "none",
        }}
      >
        <Text size="small" tone="tertiary" as="span">
          详情
        </Text>
      </summary>
      <Stack gap={6} style={{ marginTop: 6 }}>
        {children}
      </Stack>
    </details>
  );
}

function ScenePlayer({ r, iosFinanceRank }: { r: SceneRow; iosFinanceRank?: number }) {
  const complete = r.verify === "双端通过";
  const kpi = resolveSceneKpi(r);
  const ticker = kpi.ticker || resolveListedTicker(r.group, r.equity);
  const depthLine = formatSceneTagDepthLine(r.group, r.tags, r.trafficRank);
  const { title: listTitle, full: fullName } = cardListTitle(r.group);
  const trailingBits = [
    complete ? "完整验证" : null,
    kpi.archetype ?? null,
    REGION_LABEL[r.region],
  ]
    .filter(Boolean)
    .join(" · ");
  const subtitle = fullName !== listTitle ? fullName.replace(/^[^｜]+｜/, "").replace(/｜/g, " · ") : "";
  const trailing = (
    <Row gap={6} align="center" wrap>
      {iosFinanceRank != null ? (
        <Pill tone="success" size="sm">
          iOS商店·Finance #{iosFinanceRank}
        </Pill>
      ) : null}
      {trailingBits ? <Text size="small" tone="tertiary">{trailingBits}</Text> : null}
    </Row>
  );
  return (
    <Card>
      <CardHeader trailing={trailing}>
        {listTitle}
        {ticker ? ` (${ticker})` : ""}
      </CardHeader>
      <CardBody>
        <Stack gap={8}>
          <Stack gap={4}>
            {subtitle ? (
              <Text size="small" tone="tertiary">
                {subtitle}
              </Text>
            ) : null}
            <Text size="small" tone="secondary">
              业务深度：●核心 ○扩展
            </Text>
            <Text size="small">{depthLine || r.sceneType}</Text>
            <ThreeMetrics kpi={kpi} />
            <ResearchPlayerBrief group={r.group} />
            <ListedDisclosureBrief group={r.group} ticker={ticker} />
            <CompetitiveIntelBrief group={r.group} ticker={ticker} />
            <PlayerLicenseBrief licenseReg={r.licenseReg} />
          </Stack>
          <CompactDetails id={`sc_${r.group}`}>
            <Stack gap={10}>
              <Stack gap={6}>
                <Text size="small" weight="medium">
                  CRM 机构 KYC
                </Text>
                <Grid columns={2} gap={10}>
                  <DetailField label="机构证件号码（唯一识别）" value={r.orgDocNo} />
                  <DetailField label="控股主体/实控线索" value={r.controller} />
                </Grid>
                <Row gap={6} wrap>
                  {r.institutionTypes.map((t) => (
                    <Pill tone="neutral" size="sm">
                      {INSTITUTION_TYPE_LABEL[t]}
                    </Pill>
                  ))}
                </Row>
                <Text size="small" tone="secondary">
                  机构主档以证件号唯一；类型可含玩家与生态角色。控股主体一般为集团金融/金融生态服务核心主体。
                </Text>
              </Stack>
              <Divider />
              <Stack gap={6}>
                <Text size="small" weight="medium">
                  涉足场景（一级）
                </Text>
                <Row gap={6} wrap>
                  {r.tags.map((t) => (
                    <Pill tone="neutral" size="sm">
                      {SCENE_TAG_LABEL[t]}
                    </Pill>
                  ))}
                  {r.subTags.map((t) => (
                    <Pill tone="neutral" size="sm">
                      {SCENE_TAG_LABEL[SCENE_SUB_PARENT[t]]}/{SCENE_SUB_LABEL[t]}
                    </Pill>
                  ))}
                </Row>
              </Stack>
              <Stack gap={6}>
                <Text size="small" weight="medium">
                  涉及金融牌照
                </Text>
                <Row gap={6} wrap>
                  {r.licenseKinds.length ? (
                    r.licenseKinds.map((k) => (
                      <Pill tone="neutral" size="sm">
                        {LICENSE_KIND_LABEL[k]}
                      </Pill>
                    ))
                  ) : (
                    <Text size="small" tone="tertiary">
                      待从牌照信源归类
                    </Text>
                  )}
                </Row>
              </Stack>
              <Divider />
              <SourceVerifyBlock
                orgKey={r.group}
                verify={r.verify}
                trafficRank={r.trafficRank}
                licenseReg={r.licenseReg}
              />
              <Divider />
              <Grid columns={2} gap={10}>
                <DetailField label="股权" value={r.equity} />
                <DetailField label="APP" value={r.apps} />
                <DetailField label="涉足国家/地区" value={r.countries} />
                <DetailField label="语言" value={r.languages} />
                <DetailField label="月活/活跃" value={r.mau} />
                <DetailField label="注册用户" value={r.registered} />
                <DetailField label="细分市占" value={r.share} />
              </Grid>
              <DetailField label="派生金融产品" value={r.creditAttach} />
              {(() => {
                const abs = resolveAbsIssuance(r.group);
                return abs ? (
                  <DetailField label="ABS/ABN/ABT·线上场景信贷资产证券化（现金贷/分期/信用卡/车贷等）" value={abs} />
                ) : null;
              })()}
              {r.diandian !== r.trafficRank ? (
                <DetailField label="点点/路飞摘要（兼容）" value={r.diandian} />
              ) : null}
            </Stack>
          </CompactDetails>
        </Stack>
      </CardBody>
    </Card>
  );
}

/** 列表卡标题：长名「英｜牌｜中（属地）」压成短标，避免挤爆 CardHeader */
function cardListTitle(group: string, brands?: string): { title: string; full: string } {
  const full = group.trim();
  const bare = full.replace(/（[^）]*）\s*$/, "").trim();
  const parts = bare.split("｜").map((s) => s.trim()).filter(Boolean);
  const brand = (brands ?? "").trim();
  const isReg = /（监管[·･.]/.test(full);
  if (isReg && brand && brand.length <= 32) {
    return { title: brand, full };
  }
  if (brand && brand.length <= 28 && brand !== bare) {
    const zh = parts.length >= 2 ? parts[parts.length - 1] : "";
    if (zh && zh !== brand && !/^[A-Za-z0-9 .&'-]+$/.test(zh)) {
      return { title: `${brand}｜${zh}`, full };
    }
    return { title: brand, full };
  }
  if (parts.length >= 3) {
    return { title: `${parts[1]}｜${parts[2]}`, full };
  }
  if (parts.length === 2) {
    return { title: parts[1].length <= 36 ? parts[1] : parts[0], full };
  }
  return { title: bare.length > 42 ? `${bare.slice(0, 40)}…` : bare || full, full };
}

type CoopStage = "验证期" | "扩张期" | "能力期";
const COOP_STAGES: CoopStage[] = ["验证期", "扩张期", "能力期"];
/** 对齐推介材料：接洽预审 NDA 后 1 周内清单 */
const PRESCREEN_ITEMS = [
  "股权结构",
  "管理团队",
  "组织架构",
  "存量债务",
  "产品资产",
  "合规审查",
] as const;

function coopStateKey(group: string): string {
  return group.replace(/[^\w\u4e00-\u9fff]+/g, "_").slice(0, 64);
}

function CreditPlayer({ r, iosFinanceRank }: { r: CreditRow; iosFinanceRank?: number }) {
  const complete = r.verify === "双端通过";
  const isPlayer = r.institutionTypes.includes("玩家");
  const coopKey = coopStateKey(r.group);
  const [coopStage, setCoopStage] = useCanvasState<CoopStage | "">(
    `coopStage_${coopKey}`,
    "",
  );
  const [prescreen, setPrescreen] = useCanvasState<Record<string, boolean>>(
    `prescreen_${coopKey}`,
    {},
  );
  const isRegulator = r.institutionTypes.includes("监管");
  const bucket = primaryInstBucket(r.institutionTypes);
  const hideScaleMetrics = isComplianceIntermediary(r.institutionTypes);
  const kpi = resolveCreditKpi(r);
  const ticker = resolveListedTicker(r.group, r.equity);
  const regulatorUrl = isRegulator ? resolveRegulatorUrl(r.group, r.traffic) : undefined;
  const depthLine = isPlayer ? formatCreditProductDepthLine(r) : formatEcoRoleDepthLine(r);
  const { title: listTitle, full: fullName } = cardListTitle(r.group, r.brands);
  const trailingBits = [complete ? "完整验证" : null, REGION_LABEL[r.region]].filter(Boolean).join(" · ");
  const trafficPolicy = TRAFFIC_CORE_POLICY[r.group];
  const regCashPolicy = REGULATOR_CASH_LENDING_POLICY[r.group];
  const isTrafficVendor = r.institutionTypes.includes("流量服务商");
  const trafficStdSources = isTrafficVendor ? resolveTrafficStandardSources(r) : [];
  const subtitle = (() => {
    if (fullName === listTitle) return "";
    const m = fullName.match(/｜([^｜（]+)（([^）]+)）\s*$/);
    if (m) return `${m[1].trim()}（${m[2].trim()}）`;
    const bare = fullName.replace(/（[^）]*）\s*$/, "");
    const parts = bare.split("｜").map((s) => s.trim()).filter(Boolean);
    return parts.length >= 2 ? parts[parts.length - 1] : fullName;
  })();
  const trailing = (
    <Row gap={6} align="center" wrap>
      {iosFinanceRank != null ? (
        <Pill tone="success" size="sm">
          iOS商店·Finance #{iosFinanceRank}
        </Pill>
      ) : null}
      {trailingBits ? <Text size="small" tone="tertiary">{trailingBits}</Text> : null}
    </Row>
  );
  return (
    <Card>
      <CardHeader trailing={trailing}>
        {listTitle}
        {ticker ? ` (${ticker})` : ""}
      </CardHeader>
      <CardBody>
        <Stack gap={8}>
          <Stack gap={4}>
            {subtitle ? (
              <Text size="small" tone="tertiary">
                {subtitle}
              </Text>
            ) : null}
            {isPlayer ? (
              <>
                <Text size="small" tone="secondary">
                  业务深度：●核心 ○扩展
                </Text>
                <Text size="small">{depthLine}</Text>
              </>
            ) : (
              <Row gap={8} wrap>
                <Text size="small" tone="secondary">
                  {INST_BUCKET_LABEL[bucket]}
                </Text>
                <Text size="small">{depthLine}</Text>
                {r.tier && r.tier !== "腰部" ? (
                  <Text size="small" tone="tertiary">
                    {r.tier}
                  </Text>
                ) : null}
              </Row>
            )}
            {r.trafficKinds.length ? (
              <Row gap={6} wrap>
                {r.trafficKinds.map((k) => (
                  <Pill tone="neutral" size="sm">
                    {TRAFFIC_KIND_LABEL[k]}
                  </Pill>
                ))}
              </Row>
            ) : null}
            {r.paymentKinds.length ? (
              <Row gap={6} wrap>
                {r.paymentKinds.map((k) => (
                  <Pill tone="neutral" size="sm">
                    {PAYMENT_KIND_LABEL[k]}
                  </Pill>
                ))}
              </Row>
            ) : null}
            {r.equityKinds.length ? (
              <Row gap={6} wrap>
                {r.equityKinds.map((k) => (
                  <Pill tone="info" size="sm">
                    股权·{EQUITY_KIND_LABEL[k]}
                  </Pill>
                ))}
              </Row>
            ) : null}
            {trafficPolicy ? (
              <Text size="small" tone="tertiary" style={{ fontSize: 11, lineHeight: 1.35 }}>
                现金贷广告：{trafficPolicy.summary}
              </Text>
            ) : null}
            {regCashPolicy ? (
              <Text size="small" tone="tertiary" style={{ fontSize: 11, lineHeight: 1.35 }}>
                现金贷监管：{regCashPolicy.summary}
              </Text>
            ) : null}
            {regulatorUrl ? (
              <Text size="small">
                官网：<Link href={regulatorUrl}>{regulatorUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}</Link>
              </Text>
            ) : null}
            {!hideScaleMetrics ? <ThreeMetrics kpi={kpi} /> : null}
            <ResearchPlayerBrief group={r.group} />
            <ListedDisclosureBrief group={r.group} ticker={ticker} />
            <CompetitiveIntelBrief group={r.group} ticker={ticker} />
            {isPlayer ? (
              <PlayerLicenseBrief licenseReg={r.licenseReg} licenses={r.licenses} />
            ) : null}
          </Stack>
          <CompactDetails id={`cr_${r.group}`}>
            <Stack gap={10}>
              <Stack gap={6}>
                <Text size="small" weight="medium">
                  CRM 机构 KYC
                </Text>
                <Grid columns={2} gap={10}>
                  <DetailField label="机构证件号码（唯一识别）" value={r.orgDocNo} />
                  <DetailField label="控股主体/实控线索" value={r.controller} />
                </Grid>
                <Row gap={6} wrap>
                  {r.institutionTypes.map((t) => (
                    <Pill tone="neutral" size="sm">
                      {INSTITUTION_TYPE_LABEL[t]}
                    </Pill>
                  ))}
                  {r.fundKinds.map((k) => (
                    <Pill tone="neutral" size="sm">
                      {FUND_KIND_LABEL[k]}
                    </Pill>
                  ))}
                  {r.paymentKinds.map((k) => (
                    <Pill tone="neutral" size="sm">
                      {PAYMENT_KIND_LABEL[k]}
                    </Pill>
                  ))}
                  {r.equityKinds.map((k) => (
                    <Pill tone="info" size="sm">
                      股权·{EQUITY_KIND_LABEL[k]}
                    </Pill>
                  ))}
                </Row>
                <Text size="small" tone="secondary">
                  先有机构再挂类型。中介等生态机构可不含「玩家」；玩家机构可再挂生态角色。
                </Text>
                {hideScaleMetrics ? (
                  <Text size="small" tone="tertiary">
                    监管与合规中介不适用规模 / 用户 / 增速指标
                  </Text>
                ) : null}
              </Stack>
              {isPlayer ? (
                <Stack gap={6}>
                  <Text size="small" weight="medium">
                    合作 · 资产周期
                  </Text>
                  <Row gap={6} wrap>
                    {COOP_STAGES.map((s) => (
                      <FilterChip
                        label={s}
                        active={coopStage === s}
                        clearable
                        onClick={() => setCoopStage(coopStage === s ? "" : s)}
                      />
                    ))}
                  </Row>
                  <Text size="small" tone="tertiary">
                    验证期跑通闭环 · 扩张期放量匹配资金 · 能力期机构化与品牌升级
                  </Text>
                  <Text size="small" weight="medium">
                    接洽预审清单（NDA 后）
                  </Text>
                  <Row gap={6} wrap>
                    {PRESCREEN_ITEMS.map((item) => (
                      <FilterChip
                        label={item}
                        active={Boolean(prescreen[item])}
                        clearable
                        onClick={() =>
                          setPrescreen({ ...prescreen, [item]: !prescreen[item] })
                        }
                      />
                    ))}
                  </Row>
                  <Text size="small" tone="tertiary">
                    已勾选 {PRESCREEN_ITEMS.filter((i) => prescreen[i]).length}/{PRESCREEN_ITEMS.length} · 资料齐可加速 Term Sheet
                  </Text>
                </Stack>
              ) : null}
              {trafficPolicy ? (
                <>
                  <Divider />
                  <Stack gap={6}>
                    <Text size="small" weight="medium">
                      流量服务政策（平台广告政策·公开对照）
                    </Text>
                    <DetailField label="政策现状" value={trafficPolicy.status} />
                    <DetailField label="允许范围" value={trafficPolicy.allow} />
                    <DetailField label="代理商模式" value={trafficPolicy.agentMode} />
                    <Text size="small">
                      政策文件：<Link href={trafficPolicy.docs}>{trafficPolicy.docs}</Link>
                    </Text>
                    <Text size="small" tone="tertiary" style={{ fontSize: 11 }}>
                      说明：以上为平台商业广告政策，不是监管立法。监管对现金贷/金融广告的法定要求见对应监管机构详情。
                    </Text>
                  </Stack>
                </>
              ) : null}
              {isTrafficVendor && !trafficPolicy && r.note ? (
                <>
                  <Divider />
                  <DetailField label="流量服务说明" value={r.note} />
                </>
              ) : null}
              {trafficStdSources.length ? (
                <>
                  <Divider />
                  <Stack gap={6}>
                    <Text size="small" weight="medium">
                      标准可采信源（官方政策 / Partner 目录）
                    </Text>
                    <Text size="small" tone="tertiary" style={{ fontSize: 11, lineHeight: 1.35 }}>
                      授权代理商/经销商负责区域销售、账户与投放服务；≠现金贷流量掮客。即使经代理开户，仍须通过平台金融广告审核。资质以目录最新为准。
                    </Text>
                    {trafficStdSources.map((s) => (
                      <Text size="small">
                        [{s.kind}·{s.platform}] {s.label}：<Link href={s.url}>{s.url}</Link>
                      </Text>
                    ))}
                  </Stack>
                </>
              ) : null}
              {regCashPolicy ? (
                <>
                  <Divider />
                  <Stack gap={6}>
                    <Text size="small" weight="medium">
                      现金贷 / 金融广告监管要求（监管详情）
                    </Text>
                    <DetailField label="要点" value={regCashPolicy.summary} />
                    <DetailField label="公开口径" value={regCashPolicy.detail} />
                    {regCashPolicy.docs ? (
                      <Text size="small">
                        参考：<Link href={regCashPolicy.docs}>{regCashPolicy.docs}</Link>
                      </Text>
                    ) : null}
                  </Stack>
                </>
              ) : null}
              <Divider />
              <Stack gap={6}>
                <Text size="small" weight="medium">
                  涉足信贷产品 / 生态角色
                </Text>
                <Row gap={6} wrap>
                  <Pill tone="neutral" size="sm">
                    {LINE_LABEL[r.line]}
                  </Pill>
                  {r.ecoRoles.map((role) => (
                    <Pill tone="neutral" size="sm">
                      {ECO_ROLE_LABEL[role]}
                    </Pill>
                  ))}
                  {r.tags.map((t) => (
                    <Pill tone="neutral" size="sm">
                      {CREDIT_TAG_LABEL[t]}
                    </Pill>
                  ))}
                </Row>
                <Text size="small" tone="secondary">
                  信贷产品树：个人（消费/住房/汽车）· 企业 · 信贷超市 · 信贷其他；规模条为信贷撮合/放款量级。
                </Text>
              </Stack>
              {isPlayer ? (
                <Stack gap={6}>
                  <Text size="small" weight="medium">
                    信贷资产
                  </Text>
                  {(() => {
                    const sub = inferSubsidy(r);
                    const gar = inferGuarantee(r);
                    return (
                      <Stack gap={8}>
                        <Stack gap={4}>
                          <Text size="small" tone="secondary">
                            是否有贴息
                          </Text>
                          <Row gap={6} wrap>
                            <Pill tone="neutral" size="sm">
                              {sub.has === true ? "有贴息" : sub.has === false ? "无贴息" : "待核实"}
                            </Pill>
                            {sub.has === true
                              ? sub.roles.map((role) => (
                                  <Pill tone="neutral" size="sm">
                                    贴息·{role}
                                  </Pill>
                                ))
                              : null}
                          </Row>
                          <Text size="small" tone="tertiary">
                            贴息角色口径：商户 / 政府 / 平台 / 其他（有贴息时列示）
                          </Text>
                        </Stack>
                        <Stack gap={4}>
                          <Text size="small" tone="secondary">
                            是否有担保
                          </Text>
                          <Row gap={6} wrap>
                            <Pill tone="neutral" size="sm">
                              {gar.has === true ? "有担保" : gar.has === false ? "无担保" : "待核实"}
                            </Pill>
                            {gar.has === true
                              ? gar.roles.map((role) => (
                                  <Pill tone="neutral" size="sm">
                                    担保·{role}
                                  </Pill>
                                ))
                              : null}
                          </Row>
                          <Text size="small" tone="tertiary">
                            担保角色口径：商户 / 政府 / 平台 / 担保/保险公司 / 其他（有担保时列示）
                          </Text>
                        </Stack>
                      </Stack>
                    );
                  })()}
                </Stack>
              ) : null}
              <Stack gap={6}>
                <Text size="small" weight="medium">
                  涉及金融牌照
                </Text>
                <Row gap={6} wrap>
                  {r.licenseKinds.length ? (
                    r.licenseKinds.map((k) => (
                      <Pill tone="neutral" size="sm">
                        {LICENSE_KIND_LABEL[k]}
                      </Pill>
                    ))
                  ) : (
                    <Text size="small" tone="tertiary">
                      待从牌照信源归类
                    </Text>
                  )}
                </Row>
              </Stack>
              <Divider />
              <SourceVerifyBlock
                orgKey={r.group}
                verify={r.verify}
                trafficRank={r.trafficRank}
                licenseReg={r.licenseReg}
              />
              <Divider />
              <Grid columns={2} gap={10}>
                <DetailField label="股权" value={r.equity} />
                <DetailField label="品牌/APP" value={r.brands} />
                <DetailField label="涉足国家/地区" value={r.countries} />
                <DetailField label="语言" value={r.languages} />
                <DetailField label="牌照摘要" value={r.licenses} />
                <DetailField label="展业时点" value={r.timing} />
                <DetailField label="监管机关" value={r.regulators} />
                <DetailField label="流量入口" value={r.traffic} />
                <DetailField label="规模/交易" value={r.volume} />
                <DetailField label="用户" value={r.users} />
                <DetailField label="点点/路飞摘要" value={r.diandian} />
              </Grid>
              {r.note ? <DetailField label="备注" value={r.note} /> : null}
              {(() => {
                const abs = resolveAbsIssuance(r.group);
                return abs ? (
                  <DetailField label="ABS/ABN/ABT·线上场景信贷资产证券化（现金贷/分期/信用卡/车贷等）" value={abs} />
                ) : null;
              })()}
            </Stack>
          </CompactDetails>
        </Stack>
      </CardBody>
    </Card>
  );
}


function compactMarketLine(
  cells: Record<string, string>,
  markets: readonly string[],
): { filled: number; line: string } {
  const bits: string[] = [];
  for (const m of markets) {
    const v = (cells[m] ?? "").trim();
    if (!v || v === "待补" || v === "用户使用") continue;
    bits.push(`${m} ${v}`);
  }
  return { filled: bits.length, line: bits.join(" · ") };
}

type SceneAtlasLayer = "web2" | "web3" | "agent";

type SceneAtlasLeaf = {
  title: string;
  /** 用户行为/目的 */
  hint?: string;
  /** 玩家名单（按市场压缩行） */
  line: string;
};

/** Web3 子域：金融 / 游戏 / 艺术 / 社交（不再挂「信用管理」） */
function web3SceneBucket(l2: SceneSubTag): "金融" | "游戏" | "艺术" | "社交" {
  const p = SCENE_SUB_PARENT[l2];
  if (p === "游戏" || p === "艺术" || p === "社交" || p === "金融") return p;
  return "金融";
}

/** Web2·金融·理财二级（与信贷并列；词条：名称 → 行为/目的 → 玩家口径） */
const WEALTH_SCENE_L1: {
  id: string;
  items: { title: string; hint: string; line: string }[];
}[] = [
  {
    id: "货币与现金管理",
    items: [
      {
        title: "货币基金",
        hint: "闲置资金买入货基、随时赎回、追求流动性与稳健收益",
        line: "玩家名单见「玩家 → 信贷原生/金融场景」公开对照（余额宝类入口等）",
      },
      {
        title: "活期+ / 现金管理",
        hint: "支付账户余额自动申购现金管理、兼顾支付与增值",
        line: "玩家名单见支付钱包/银行现金管理产品公开对照",
      },
      {
        title: "支付账户余额理财",
        hint: "在支付账户内一键理财、消费与理财资金互通",
        line: "玩家名单见头部支付钱包理财入口公开对照",
      },
    ],
  },
  {
    id: "固收理财",
    items: [
      {
        title: "银行理财",
        hint: "购买银行理财产品、按风险等级匹配稳健收益",
        line: "玩家名单见持牌银行理财子公司/代销渠道公开对照",
      },
      {
        title: "债券基金",
        hint: "申购债基、配置利率/信用债资产",
        line: "玩家名单见公募基金/银行代销公开对照",
      },
      {
        title: "存款/大额存单",
        hint: "存定期或大额存单、锁定利率",
        line: "玩家名单见商业银行存款产品公开对照",
      },
      {
        title: "券商固收资管",
        hint: "认购券商固收资管计划、获取票息类收益",
        line: "玩家名单见券商资管公开对照",
      },
    ],
  },
  {
    id: "权益投资",
    items: [
      {
        title: "股票型/混合基金",
        hint: "申购股混基金、承担净值波动追求收益",
        line: "玩家名单见公募基金/互联网代销公开对照",
      },
      {
        title: "指数与 ETF",
        hint: "买入指数/ETF、跟踪市场或行业",
        line: "玩家名单见基金公司/券商交易入口公开对照",
      },
      {
        title: "基金投顾",
        hint: "授权投顾组合、自动再平衡",
        line: "玩家名单见持牌基金投顾机构公开对照",
      },
      {
        title: "证券开户交易",
        hint: "开户、买卖股票/可转债等证券",
        line: "玩家名单见券商 App 公开对照",
      },
    ],
  },
  {
    id: "保险与养老",
    items: [
      {
        title: "分红/万能/投连",
        hint: "投保储蓄型/投资型保险、长期资金规划",
        line: "玩家名单见持牌寿险公司/互联网保险公开对照",
      },
      {
        title: "商业养老金/年金",
        hint: "配置养老金/年金、分期领取养老现金流",
        line: "玩家名单见养老险/商业养老金公开对照",
      },
      {
        title: "增额终身寿",
        hint: "投保增额寿、长期锁定身故/现价利益",
        line: "玩家名单见寿险公司公开对照",
      },
      {
        title: "个税递延养老",
        hint: "参与税延养老账户、享受税收递延",
        line: "玩家名单见税延养老账户管理人公开对照",
      },
    ],
  },
  {
    id: "另类与跨境",
    items: [
      {
        title: "黄金/贵金属",
        hint: "买入实物/账户金、避险或配置",
        line: "玩家名单见银行/黄金 ETF/交易平台公开对照",
      },
      {
        title: "商品与衍生品零售",
        hint: "参与商品/衍生品零售交易（合规范围内）",
        line: "玩家名单见持牌期货/衍生品零售入口公开对照",
      },
      {
        title: "QDII/跨境理财",
        hint: "配置跨境/QDII 产品、分散国别资产",
        line: "玩家名单见 QDII 基金/银行代销公开对照",
      },
      {
        title: "私募/资管计划",
        hint: "合格投资者认购私募/资管、接受封闭与风险披露",
        line: "玩家名单见私募管理人/券商资管公开对照",
      },
    ],
  },
];

const CREDIT_L2_USER_BEHAVIOR: Partial<Record<Exclude<CreditProdL2, "all">, string>> = {
  消费信贷: "为个人消费/周转申请授信、借款或分期还款",
  住房信贷: "购房或抵押住房融资、按揭/抵押还款",
  汽车信贷: "购车融资、按揭或融资租赁还款",
  流贷: "企业补充流动资金、短期周转还款",
  固贷: "企业固定资产投资融资、分期偿还",
  提前收款: "企业基于应收/订单提前回款",
  订单融资: "以订单为依托获取经营周转资金",
  发票融资: "以发票/应收为依托融资回笼",
  学生贷: "学生/教育相关借款、分期偿还",
  农户贷: "农户生产经营借款、季节性还款",
  公务员贷: "面向公务人群的消费/周转借款",
};

/** 顶栏冻结：会话 + 搜索 + 页签（在滚动区外，不随列表滚走） */
const ATLAS_STICKY_H = "--atlas-sticky-h";

function AtlasStickyChrome({ children }: { children?: ReactNode }) {
  const theme = useHostTheme();
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const sync = () => {
      document.documentElement.style.setProperty(ATLAS_STICKY_H, `${el.offsetHeight}px`);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty(ATLAS_STICKY_H);
    };
  }, []);
  return (
    <div
      ref={ref}
      style={{
        position: "sticky",
        top: 0,
        flexShrink: 0,
        zIndex: 40,
        padding: "0 0 8px",
        background: theme.bg.elevated,
        borderBottom: "none",
      }}
    >
      {children}
    </div>
  );
}

/** 页签内容区二级冻结（贴齐顶栏底边，盖住滚动内容） */
function AtlasStickySub({
  children,
  compact,
}: {
  children?: ReactNode;
  /** 更矮内边距，给滚动正文让位 */
  compact?: boolean;
}) {
  const theme = useHostTheme();
  return (
    <div
      style={{
        position: "sticky",
        top: "var(--atlas-sticky-h, 0px)",
        zIndex: 35,
        padding: compact ? "6px 0" : "8px 0",
        background: theme.bg.elevated,
        borderBottom: "none",
      }}
    >
      {children}
    </div>
  );
}

function SoftFold({
  title,
  hint,
  summary,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  /** 收起时内联展示已选项，避免多占一行 hint */
  summary?: string;
  count?: number | string;
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const theme = useHostTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Stack gap={2}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          minHeight: 22,
          width: "100%",
          margin: 0,
          padding: 0,
          border: "none",
          background: "transparent",
          font: "inherit",
          color: "inherit",
          textAlign: "left",
        }}
        aria-expanded={open}
      >
        <Text size="small" weight="medium" as="span" style={{ flex: 1, minWidth: 0 }}>
          {title}
          <span style={{ marginLeft: 6, color: theme.text.tertiary, fontWeight: 400 }}>
            {open ? "收起" : "展开"}
          </span>
          {!open && summary ? (
            <span style={{ marginLeft: 6, color: theme.text.secondary, fontWeight: 400 }}>
              · {summary}
            </span>
          ) : null}
        </Text>
        {count != null ? (
          <Pill size="sm" tone="neutral">
            {String(count)}
          </Pill>
        ) : null}
      </button>
      {!open && hint && !summary ? (
        <Text size="small" tone="tertiary">
          {hint}
        </Text>
      ) : null}
      {open ? <Stack gap={4}>{children}</Stack> : null}
    </Stack>
  );
}

/** 场景树折叠行：原生 details，避免 useCanvasState 写 sidecar 导致滚动回顶 */
function AtlasFold({
  id,
  title,
  count,
  children,
  defaultOpen = false,
  remountKey,
}: {
  id: string;
  title: string;
  count?: number | string;
  children?: ReactNode;
  defaultOpen?: boolean;
  /** 变化时重置展开态（如总览收起 / 进机构页展开） */
  remountKey?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    setOpen(defaultOpen);
  }, [remountKey, defaultOpen]);
  return (
    <div style={{ margin: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          minHeight: 28,
          width: "100%",
          margin: 0,
          padding: 0,
          border: "none",
          background: "transparent",
          font: "inherit",
          color: "inherit",
          textAlign: "left",
        }}
        aria-expanded={open}
      >
        <Text size="small" weight="medium" as="span" style={{ flex: 1, minWidth: 0 }}>
          {title}
          <span style={{ marginLeft: 8, opacity: 0.55, fontWeight: 400 }}>{open ? "收起" : "展开"}</span>
        </Text>
        {count != null ? (
          <Pill size="sm" tone="neutral">
            {String(count)}
          </Pill>
        ) : null}
      </button>
      {open && children ? (
        <Stack gap={4} style={{ paddingLeft: 18, marginTop: 4 }}>
          {children}
        </Stack>
      ) : null}
    </div>
  );
}



type AtlasScrollMem = {
  y: number;
  restoring: boolean;
  installed: boolean;
  shell: HTMLElement | null;
};

function getAtlasScrollMem(): AtlasScrollMem {
  const g = globalThis as unknown as { __crmAtlasScrollMem?: AtlasScrollMem };
  if (!g.__crmAtlasScrollMem) {
    g.__crmAtlasScrollMem = { y: 0, restoring: false, installed: false, shell: null };
  }
  return g.__crmAtlasScrollMem;
}

function findAtlasScroller(shell: HTMLElement | null): HTMLElement | "window" {
  if (!shell || typeof window === "undefined") return "window";
  let best: HTMLElement | null = null;
  let bestDelta = 0;
  let cur: HTMLElement | null = shell.parentElement;
  while (cur && cur !== document.documentElement) {
    const st = window.getComputedStyle(cur);
    const oy = st.overflowY;
    const delta = cur.scrollHeight - cur.clientHeight;
    const scrollable =
      oy === "auto" || oy === "scroll" || oy === "overlay" || cur.scrollTop > 0;
    if (scrollable && delta > bestDelta) {
      best = cur;
      bestDelta = delta;
    }
    cur = cur.parentElement;
  }
  return best && bestDelta > 1 ? best : "window";
}

function readScrollerY(scroller: HTMLElement | "window"): number {
  if (scroller === "window") {
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }
  return scroller.scrollTop;
}

function writeScrollerY(scroller: HTMLElement | "window", y: number) {
  if (y <= 0) return;
  if (scroller === "window") {
    window.scrollTo(0, y);
    return;
  }
  scroller.scrollTop = y;
}

/**
 * 一动就回的根因：误用 window.scrollY（常为 0）+ 延迟 scrollTo 与真实滚动容器对打。
 * 改为：捕获真实 target 的 scrollTop；重挂时只恢复该容器；无延迟定时器。
 */
function ensureAtlasScrollMem() {
  if (typeof window === "undefined") return;
  const mem = getAtlasScrollMem();
  if (mem.installed) return;
  mem.installed = true;
  try {
    document.documentElement.style.overflowAnchor = "none";
  } catch {
    /* ignore */
  }
  document.addEventListener(
    "scroll",
    (e) => {
      if (mem.restoring) return;
      const t = e.target;
      let y = 0;
      if (t === document || t === document.documentElement || t === document.body) {
        y = window.scrollY || document.documentElement.scrollTop || 0;
      } else if (t instanceof HTMLElement) {
        y = t.scrollTop;
      }
      if (y > 0) mem.y = y;
    },
    { capture: true, passive: true },
  );
}

/** 词条玩家名单过长时压成卡片可读行 */
function clipScenePlayerLine(line: string, max = 160): string {
  const t = line.trim();
  if (!t || t === "—") return "—";
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = Math.max(cut.lastIndexOf(" · "), cut.lastIndexOf("、"), cut.lastIndexOf("，"));
  return `${(at > 40 ? cut.slice(0, at) : cut).trim()} …`;
}

/** 场景词条卡：名称 → 行为/目的 → 玩家名单 */
function SceneEntryCard({ leaf }: { leaf: SceneAtlasLeaf }) {
  return (
    <Card style={{ height: "100%" }}>
      <CardHeader>{leaf.title}</CardHeader>
      <CardBody>
        <Stack gap={8}>
          <Stack gap={2}>
            <Text size="small" tone="tertiary" style={{ fontSize: 11 }}>
              行为 / 目的
            </Text>
            <Text size="small" tone="secondary" style={{ fontSize: 12, lineHeight: 1.4 }}>
              {leaf.hint?.trim() || "待补用户行为/目的"}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text size="small" tone="tertiary" style={{ fontSize: 11 }}>
              玩家名单
            </Text>
            <Text size="small" style={{ fontSize: 12, lineHeight: 1.4 }}>
              {clipScenePlayerLine(leaf.line || "—")}
            </Text>
          </Stack>
        </Stack>
      </CardBody>
    </Card>
  );
}

/** 业态入口卡（全部业态一览） */
function SceneIndustryCard({
  title,
  count,
  preview,
  onOpen,
}: {
  title: string;
  count: number;
  preview: string;
  onOpen: () => void;
}) {
  return (
    <div
      style={{ cursor: "pointer", minWidth: 0, height: "100%" }}
      onClick={onOpen}
      onKeyDown={(e: { key: string; preventDefault: () => void }) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      title={`查看「${title}」词条`}
    >
      <Card style={{ height: "100%" }}>
        <CardHeader
          trailing={
            <Pill tone="neutral" size="sm">
              {String(count)}
            </Pill>
          }
        >
          {title}
        </CardHeader>
        <CardBody>
          <Text
            size="small"
            tone="tertiary"
            style={{
              fontSize: 11,
              lineHeight: 1.35,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {preview || "点击查看词条卡片"}
          </Text>
        </CardBody>
      </Card>
    </div>
  );
}

function renderSceneEntryGrid(leaves: SceneAtlasLeaf[]) {
  if (!leaves.length) {
    return (
      <Text size="small" tone="tertiary">
        暂无条目
      </Text>
    );
  }
  return (
    <Grid columns={2} gap={8} align="stretch">
      {leaves.map((leaf) => (
        <div key={leaf.title} style={{ minWidth: 0, height: "100%" }}>
          <SceneEntryCard leaf={leaf} />
        </div>
      ))}
    </Grid>
  );
}

/** 线上数字经济场景：Web2 / Web3 / Agent；信贷+理财在 Web2→金融 下 */
function DigitalSceneAtlasBrowse() {
  const [layer, setLayer] = useCanvasState<SceneAtlasLayer>("atlasLayer3", "web2");
  const [web2Focus, setWeb2Focus] = useCanvasState<string>("atlasW2f2", "all");
  const [web3Focus, setWeb3Focus] = useCanvasState<string>("atlasW3f1", "all");
  const [web2CatalogOpen, setWeb2CatalogOpen] = useCanvasState("atlasW2cat1", "");
  const catalogOpen = web2CatalogOpen === "1";

  const web2IndustryTags = SCENE_TAG_ORDER.filter(
    (t) => t !== "Web3" && t !== "金融" && t !== "艺术" && t !== "信用管理",
  );

  const industryGrouped = SCENE_WIDE_TABLE.filter(
    (r) => r.l1 !== "Web3" && r.l1 !== "信用管理",
  ).reduce((acc, r) => {
    const list = acc.get(r.l1) ?? [];
    list.push(r);
    acc.set(r.l1, list);
    return acc;
  }, new Map<SceneTag, (typeof SCENE_WIDE_TABLE)[number][]>());

  const creditMgmtRows: SceneAtlasLeaf[] = SCENE_WIDE_TABLE.filter(
    (r) => r.l1 === "信用管理" && !SCENE_SUBS_B2B_RISK.has(r.l2),
  ).map((r) => {
    const { line } = compactMarketLine(r.cells, WIDE_MARKET_ORDER);
    return {
      title: r.l2,
      hint: SCENE_USER_BEHAVIOR[r.l2],
      line: line || "—",
    };
  });

  const web3ByBucket: Record<"金融" | "游戏" | "艺术" | "社交", SceneAtlasLeaf[]> = {
    金融: [],
    游戏: [],
    艺术: [],
    社交: [],
  };
  for (const r of WEB3_SCENE_WIDE_TABLE) {
    const bucket = web3SceneBucket(r.l2);
    const { line } = compactMarketLine(r.cells, WEB3_WIDE_MARKET_ORDER);
    web3ByBucket[bucket].push({
      title: r.l2,
      hint: WEB3_USER_BEHAVIOR[r.l2],
      line: line || "—",
    });
  }

  function renderCreditL1Body(l1: Exclude<CreditProdL1, "all">) {
    const l2s = CREDIT_PROD_L2_BY_L1[l1];
    if (!l2s.length) {
      return renderSceneEntryGrid([
        {
          title: l1,
          hint: "用户按信贷超市比价选品、申请导流至持牌放贷方",
          line: "玩家名单见「玩家 → 信贷原生」同口径筛选",
        },
      ]);
    }
    return renderSceneEntryGrid(
      l2s.map((l2) => {
        const l3s = CREDIT_PROD_L3_BY_L2[l2];
        return {
          title: l2,
          hint: CREDIT_L2_USER_BEHAVIOR[l2] ?? "用户申请对应信贷产品并履约还款",
          line: l3s?.length
            ? `子类：${l3s.join(" · ")}；玩家名单见「玩家 → 信贷原生」同口径筛选`
            : "玩家名单见「玩家 → 信贷原生」同口径筛选",
        };
      }),
    );
  }

  const financeSecondLevelCount =
    1 + CREDIT_PROD_L1_ORDER.length + WEALTH_SCENE_L1.length; // 信用管理 + 信贷L1 + 理财L1

  const financeSections: { id: string; title: string; count: number; body: ReactNode }[] = [
    {
      id: "fin_credit_mgmt",
      title: "信用管理",
      count: creditMgmtRows.length,
      body: (
        <Stack gap={8}>
          <Text size="small" tone="tertiary" style={{ fontSize: 11, lineHeight: 1.35 }}>
            To C 场景以征信查询等为主。信用评分/画像、反欺诈为 B 端能力，见机构类型「风控服务方」。
          </Text>
          {renderSceneEntryGrid(creditMgmtRows)}
        </Stack>
      ),
    },
    ...CREDIT_PROD_L1_ORDER.map((l1) => ({
      id: `fin_l1_${l1}`,
      title: l1,
      count: CREDIT_PROD_L2_BY_L1[l1].length || 1,
      body: renderCreditL1Body(l1),
    })),
    ...WEALTH_SCENE_L1.map((w) => ({
      id: `fin_wealth_${w.id}`,
      title: w.id,
      count: w.items.length,
      body: renderSceneEntryGrid(
        w.items.map((item) => ({
          title: item.title,
          hint: item.hint,
          line: item.line,
        })),
      ),
    })),
  ];

  const financeBody = (
    <Stack gap={12}>
      {financeSections.map((sec) => (
        <Stack key={sec.id} gap={8}>
          <Row gap={8} align="center">
            <Text size="small" weight="medium">
              {sec.title}
            </Text>
            <Pill size="sm" tone="neutral">
              {String(sec.count)}
            </Pill>
          </Row>
          {sec.body}
        </Stack>
      ))}
    </Stack>
  );

  return (
    <Stack gap={0}>
      <AtlasStickySub>
        <Stack gap={10}>
          <Stack gap={6}>
            <H2>数字经济场景</H2>
            <Text size="small" tone="tertiary">
              Web2 / Web3 / Agent · 词条：名称 → 行为/目的 → 玩家名单
            </Text>
          </Stack>
          <Row gap={6} wrap>
            {(
              [
                { id: "web2" as const, label: "Web2" },
                { id: "web3" as const, label: "Web3" },
                { id: "agent" as const, label: "Agent" },
              ] as const
            ).map((o) => (
              <FilterChip
                label={o.label}
                active={layer === o.id}
                onClick={() => {
                  setLayer(o.id);
                  if (o.id !== "web2") setWeb2Focus("all");
                  if (o.id !== "web3") setWeb3Focus("all");
                }}
              />
            ))}
          </Row>

          {layer === "web2" ? (
            <Row gap={6} wrap>
              <FilterChip
                label="全部业态"
                active={web2Focus === "all"}
                onClick={() => setWeb2Focus("all")}
              />
              <FilterChip
                label="金融"
                active={web2Focus === "金融"}
                clearable
                onClick={() => setWeb2Focus(web2Focus === "金融" ? "all" : "金融")}
              />
              {web2IndustryTags.map((t) => (
                <FilterChip
                  label={SCENE_TAG_LABEL[t]}
                  active={web2Focus === t}
                  clearable
                  onClick={() => setWeb2Focus(web2Focus === t ? "all" : t)}
                />
              ))}
            </Row>
          ) : null}

          {layer === "web3" ? (
            <Row gap={6} wrap>
              <FilterChip
                label="全部子域"
                active={web3Focus === "all"}
                onClick={() => setWeb3Focus("all")}
              />
              {(["金融", "游戏", "艺术", "社交"] as const).map((bucket) => (
                <FilterChip
                  label={bucket}
                  active={web3Focus === bucket}
                  clearable
                  onClick={() => setWeb3Focus(web3Focus === bucket ? "all" : bucket)}
                />
              ))}
            </Row>
          ) : null}
        </Stack>
      </AtlasStickySub>

      <Stack gap={10} style={{ paddingTop: 8 }}>
      {layer === "web2" ? (
        <Stack gap={10}>
          {web2Focus === "all" ? (
            <Stack gap={8}>
              <button
                type="button"
                onClick={() => setWeb2CatalogOpen(catalogOpen ? "" : "1")}
                style={{
                  alignSelf: "flex-start",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: 12,
                  color: "inherit",
                }}
              >
                <Text size="small" weight="medium" as="span">
                  日常业态
                  <span style={{ marginLeft: 8, opacity: 0.55, fontWeight: 400 }}>
                    {catalogOpen ? "收起" : "展开"}
                  </span>
                </Text>
              </button>
              {catalogOpen ? (
                <Grid columns={3} gap={8} align="stretch">
                  <SceneIndustryCard
                    title="金融"
                    count={financeSecondLevelCount}
                    preview="信用管理 · 信贷产品 · 理财"
                    onOpen={() => setWeb2Focus("金融")}
                  />
                  {Array.from(industryGrouped.entries()).map(([l1, list]) => (
                    <SceneIndustryCard
                      key={l1}
                      title={SCENE_TAG_LABEL[l1]}
                      count={list.length}
                      preview={list
                        .slice(0, 4)
                        .map((r) => r.l2)
                        .join(" · ")}
                      onOpen={() => setWeb2Focus(l1)}
                    />
                  ))}
                </Grid>
              ) : (
                <Text size="small" tone="tertiary">
                  已收起业态一览；点上方展开，或点筛选芯片直达某一业态
                </Text>
              )}
            </Stack>
          ) : web2Focus === "金融" ? (
            <Stack gap={10}>
              <Row gap={8} align="center">
                <Text size="small" weight="medium">
                  金融
                </Text>
                <Pill size="sm" tone="neutral">
                  {String(financeSecondLevelCount)}
                </Pill>
              </Row>
              {financeBody}
            </Stack>
          ) : (
            (() => {
              const list = industryGrouped.get(web2Focus as SceneTag) ?? [];
              const leaves = list.map((r) => {
                const { line } = compactMarketLine(r.cells, WIDE_MARKET_ORDER);
                return {
                  title: r.l2,
                  hint: SCENE_USER_BEHAVIOR[r.l2],
                  line: line || "—",
                };
              });
              return (
                <Stack gap={10}>
                  <Row gap={8} align="center">
                    <Text size="small" weight="medium">
                      {SCENE_TAG_LABEL[web2Focus as SceneTag] ?? web2Focus}
                    </Text>
                    <Pill size="sm" tone="neutral">
                      {String(list.length)}
                    </Pill>
                  </Row>
                  {renderSceneEntryGrid(leaves)}
                </Stack>
              );
            })()
          )}
        </Stack>
      ) : null}

      {layer === "web3" ? (
        <Stack gap={10}>
          {web3Focus === "all" ? (
            <Grid columns={2} gap={8} align="stretch">
              {(["金融", "游戏", "艺术", "社交"] as const).map((bucket) => (
                <SceneIndustryCard
                  key={bucket}
                  title={bucket}
                  count={web3ByBucket[bucket].length}
                  preview={web3ByBucket[bucket]
                    .slice(0, 4)
                    .map((x) => x.title)
                    .join(" · ")}
                  onOpen={() => setWeb3Focus(bucket)}
                />
              ))}
            </Grid>
          ) : (
            <Stack gap={10}>
              <Row gap={8} align="center">
                <Text size="small" weight="medium">
                  {web3Focus}
                </Text>
                <Pill size="sm" tone="neutral">
                  {String(web3ByBucket[web3Focus as keyof typeof web3ByBucket]?.length ?? 0)}
                </Pill>
              </Row>
              {renderSceneEntryGrid(
                web3ByBucket[web3Focus as keyof typeof web3ByBucket] ?? [],
              )}
            </Stack>
          )}
        </Stack>
      ) : null}

      {layer === "agent" ? (
        <Stack gap={10}>
          <Row gap={8} align="center" wrap>
            <Text size="small" weight="medium">
              Agent 词条
            </Text>
            <Pill size="sm" tone="neutral">
              {String(AGENT_SCENE_LEAVES.length)}
            </Pill>
            <Text size="small" tone="tertiary" style={{ fontSize: 11, lineHeight: 1.35 }}>
              来源：36氪AI产品榜（点评/新鲜/热门）+ 首页推荐 · {AI_PRODUCT_RANK_36KR.meta.as_of}
              ；名称 → 行为/目的 → 玩家名单
            </Text>
          </Row>
          {renderSceneEntryGrid(AGENT_SCENE_LEAVES)}
        </Stack>
      ) : null}
      </Stack>
    </Stack>
  );
}

const EMPTY_CREDIT_DRAFTS: CreditDraft[] = [];
const EMPTY_COMPOSER_ATTS: ComposerAttach[] = [];

type AppTab = "crm" | "screen";

function IconMapGlobe() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2.75 8h10.5M8 2.75c1.6 1.7 2.4 3.4 2.4 5.25S9.6 11.55 8 13.25C6.4 11.55 5.6 9.85 5.6 8S6.4 4.45 8 2.75z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 对照：双栏并排 */
function IconCompare() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.75" y="2.75" width="5" height="10.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9.25" y="2.75" width="5" height="10.5" rx="1.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** 信源编号：书签角标 */
function IconSourceCite() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 2.75h7.25A1.5 1.5 0 0 1 12.25 4.25v9L8 11.1 3.75 13.25V4.25A1.5 1.5 0 0 1 5.25 2.75"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M6 5.5h4M6 7.75h2.75" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** 进入/退出地图大屏 */
function MapScreenButton({
  active,
  onClick,
  fillHeight = false,
}: {
  active: boolean;
  onClick: () => void;
  /** 与搜索框同列时拉高，和整列厚度对齐 */
  fillHeight?: boolean;
}) {
  const theme = useHostTheme();
  const label = active ? "返回总览" : "地图";
  return (
    <button
      type="button"
      title={active ? "返回总览" : "打开地图大屏"}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      style={{
        flexShrink: 0,
        flex: fillHeight ? "1 1 0" : undefined,
        width: fillHeight ? "100%" : undefined,
        height: fillHeight ? undefined : 36,
        minHeight: fillHeight ? 0 : 36,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "0 10px",
        borderRadius: 8,
        border: `1px solid ${active ? theme.stroke.secondary : theme.stroke.tertiary}`,
        background: active ? theme.fill.secondary : theme.bg.elevated,
        color: theme.text.primary,
        cursor: "pointer",
        font: "inherit",
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        whiteSpace: "nowrap",
        boxSizing: "border-box",
      }}
    >
      <IconMapGlobe />
      {label}
    </button>
  );
}

/** 搜索框旁：对照 / 信源等侧栏按钮 */
function SideHubButton({
  active,
  onClick,
  title,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  label: string;
  icon: ReactNode;
}) {
  const theme = useHostTheme();
  return (
    <button
      type="button"
      title={title}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      style={{
        flex: "1 1 0",
        width: "100%",
        minHeight: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "0 10px",
        borderRadius: 8,
        border: `1px solid ${active ? theme.stroke.secondary : theme.stroke.tertiary}`,
        background: active ? theme.fill.secondary : theme.bg.elevated,
        color: theme.text.primary,
        cursor: "pointer",
        font: "inherit",
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        whiteSpace: "nowrap",
        boxSizing: "border-box",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function qualityTone(q: NbfcDataQuality): "success" | "warning" | "neutral" | "info" {
  if (q === "official") return "success";
  if (q === "semi-official") return "warning";
  if (q === "secondary") return "info";
  return "neutral";
}

function briefThemeBlurb(id: string, summary: string): string {
  const map: Record<string, string> = {
    reg_license: "先看牌照、名录和催收规则，这直接决定能不能展业。",
    asset_price: "看资产质量和定价，融资热闹不等于风险已经好转。",
    fx_macro: "看利率、汇率和通胀，它们影响资金成本和锁汇。",
    other_weak: "弱相关背景，默认少看。",
    reggeo: "看展业属地监管。",
    macro: "看利率汇率与资金成本。",
    credit: "看信贷与行业整顿。",
    infra: "看支付与结算通道。",
    capital: "看上市募资窗口。",
    overseas: "看出海平台与流量。",
    other: "其余快讯。",
  };
  return map[id] || summary.slice(0, 48);
}

type AtlasRole = "am" | "boss" | "roadshow";

/** 总览不再展示「视角」切换；角色应由后台用户配置下发，前端只读 atlasRole。 */

type WatchVerdictBullet = {
  country: string;
  text: string;
};

type WatchVerdictSection = {
  id: "invested" | "hot" | "other";
  label: string;
  bullets: WatchVerdictBullet[];
};

/** 把 overallVerdict 长句拆成「展业国 / 热点国」要点，便于扫读 */
function parseWatchVerdictSections(verdict: string): WatchVerdictSection[] {
  const soft = softenBriefText(verdict).replace(/\s+/g, " ").trim();
  if (!soft) return [];

  const countryRe =
    /^(印尼|印度|泰国|菲律宾|马来|越南|新加坡|中国香港|香港|墨西哥|巴西|阿根廷|哥伦比亚|肯尼亚|尼日利亚|南非|埃及|加纳|巴基斯坦|孟加拉|斯里兰卡|美国|日本|韩国|中国|沙特|阿联酋|哈萨克|格鲁吉亚|以色列|澳洲|澳大利亚)/;

  const parseBullets = (blob: string): WatchVerdictBullet[] =>
    blob
      .split(/[；;]+/)
      .map((p) => p.trim().replace(/^[，、。]+|[。]+$/g, ""))
      .filter(Boolean)
      .map((p) => {
        const m = p.match(countryRe);
        if (m) {
          return { country: m[1], text: p.slice(m[1].length).replace(/^[\s：:·\-—]+/, "") || p };
        }
        return { country: "", text: p };
      });

  const sections: WatchVerdictSection[] = [];
  const investedMatch = soft.match(/展业国[：:]\s*([\s\S]*?)(?=(?:热点国[：:])|$)/);
  const hotMatch = soft.match(/热点国[：:]\s*([\s\S]*?)$/);

  if (investedMatch?.[1]?.trim()) {
    sections.push({ id: "invested", label: "展业国", bullets: parseBullets(investedMatch[1]) });
  }
  if (hotMatch?.[1]?.trim()) {
    sections.push({ id: "hot", label: "热点国", bullets: parseBullets(hotMatch[1]) });
  }

  if (!sections.length) {
    const bullets = parseBullets(soft.replace(/[。]/g, "；"));
    if (bullets.length) sections.push({ id: "other", label: "本周要点", bullets });
  }
  return sections;
}

/** 电报式短语 → 好读的一句完整话 */
function readableWatchSentence(country: string, raw: string): string {
  let t = softenBriefText(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[：:\s]+/, "")
    .replace(/[。；;！？]+$/g, "");
  if (!t && !country) return "";

  t = t
    .replace(/拟禁\s*/g, "拟禁止 ")
    .replace(/约束仍硬/g, "约束仍然偏硬")
    .replace(/日报落地/g, "日报制度已经落地")
    .replace(/存量竞争$/g, "仍处在存量竞争阶段")
    .replace(/披露加严/g, "披露要求加严")
    .replace(/探索信贷抵押/g, "正在探索把支付能力用于信贷抵押")
    .replace(/持牌扩至约\s*(\d+)/g, "持牌机构扩至约 $1 家")
    .replace(/与(.+?)并行$/g, "与$1在并行推进")
    .replace(/\s+/g, " ")
    .trim();

  // 已是完整叙述则只补句号与国名前缀
  const body = /[。！？]$/.test(t) ? t : `${t}。`;
  if (!country) return softenBriefText(body);
  if (body.startsWith(country)) return softenBriefText(body);
  return softenBriefText(`${country}：${body}`);
}

function BossWatchBar({
  verdict,
  onOpenCountry,
}: {
  verdict: string;
  /** 点某一句 → 打开该国快讯内容 */
  onOpenCountry?: (countryNameZh: string) => void;
}) {
  const theme = useHostTheme();
  const stripBg = solidOverBase(theme.bg.elevated, theme.fill.tertiary);
  const bullets = parseWatchVerdictSections(verdict)
    .flatMap((s) => s.bullets)
    .map((b) => ({
      country: b.country,
      line: readableWatchSentence(b.country, b.text),
      short: b.text
        ? readableWatchSentence("", b.text).replace(/[。！？]$/, "")
        : "",
    }))
    .filter((b) => b.line);

  if (!bullets.length) return null;

  const renderTick = (b: (typeof bullets)[0], keySuffix: string) => {
    const clickable = Boolean(onOpenCountry && b.country);
    return (
      <button
        key={`${b.country || b.line}-${keySuffix}`}
        type="button"
        disabled={!clickable}
        onClick={() => {
          if (clickable && b.country) onOpenCountry?.(b.country);
        }}
        title={clickable ? `查看${b.country}快讯` : b.line}
        style={{
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "baseline",
          gap: 6,
          margin: 0,
          padding: "2px 0",
          border: "none",
          background: "transparent",
          cursor: clickable ? "pointer" : "default",
          font: "inherit",
          fontSize: 12,
          whiteSpace: "nowrap",
          color: theme.text.primary,
        }}
      >
        {b.country ? (
          <span style={{ fontWeight: 700, color: theme.text.secondary }}>{b.country}</span>
        ) : null}
        <span style={{ fontWeight: 500 }}>
          <GlossedText text={b.short || b.line} />
        </span>
      </button>
    );
  };

  return (
    <div
      aria-label="国别速览"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        minHeight: 40,
        maxHeight: 44,
        padding: "6px 10px",
        border: `1px solid ${theme.stroke.tertiary}`,
        borderRadius: 10,
        background: stripBg,
        overflow: "hidden",
      }}
    >
      <Text weight="medium" size="small" style={{ flexShrink: 0, minWidth: 56 }}>
        国别速览
      </Text>
      <div className="fintech-ticker-viewport">
        <div className="fintech-ticker-track fintech-ticker-track--slow" aria-live="off">
          {bullets.map((b) => renderTick(b, "a"))}
          {bullets.map((b) => renderTick(b, "b"))}
        </div>
      </div>
    </div>
  );
}

/** 把带 alpha 的 fill 叠到不透明底上，供 sticky 表头/冻结列用（避免透出滚动内容） */
function solidOverBase(base: string, overlay: string): string {
  const parse = (h: string): [number, number, number, number] => {
    const s = h.replace("#", "");
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    const a = s.length >= 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1;
    return [r, g, b, Number.isFinite(a) ? a : 1];
  };
  const [br, bg, bb] = parse(base);
  const [or, og, ob, oa] = parse(overlay);
  const mix = (o: number, b: number) => Math.round(o * oa + b * (1 - oa));
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(mix(or, br))}${hex(mix(og, bg))}${hex(mix(ob, bb))}`;
}

/** 上市公司 ↔ 快讯股价条：按登录用户各自持久化监控名单 */
function useFintechStockMonitor() {
  const [session] = useCanvasState("authSession1", "");
  const userKey = (session || "guest").trim().toLowerCase() || "guest";
  const storageKey = `fintechMonitorIds2:${userKey}`;
  const defaultRaw = FINTECH_STOCK_MONITOR_DEFAULT_IDS.join("|");
  const [raw, setRaw] = useCanvasState<string>(storageKey, defaultRaw);
  const ids = raw.split("|").map((s) => s.trim()).filter(Boolean);
  const set = new Set(ids);
  const has = (id: string) => set.has(id);
  const toggle = (id: string) => {
    if (!id) return;
    setRaw((prev) => {
      const cur = prev.split("|").map((s) => s.trim()).filter(Boolean);
      if (cur.includes(id)) return cur.filter((x) => x !== id).join("|");
      return [...cur, id].join("|");
    });
  };
  return { ids, has, toggle, count: ids.length, userKey };
}

/** 快讯旁横条：个别重点标的股价监控（非全市场涨跌幅/市值榜） */
function FintechStockMonitorStrip({
  onOpenAll,
  onOpenStock,
}: {
  onOpenAll?: () => void;
  /** 点单只标的 → 进入上市公司并打开该公司 */
  onOpenStock?: (id: string) => void;
}) {
  const theme = useHostTheme();
  const quotes = FINTECH_STOCK_QUOTES;
  const { ids, count, userKey } = useFintechStockMonitor();
  const upColor = "#2f6b3a";
  const downColor = "#b42318";
  const stripBg = solidOverBase(theme.bg.elevated, theme.fill.tertiary);
  const ownerLabel = userKey === "guest" ? "访客" : userKey;

  const rows = fintechStockMonitorQuotes(ids);
  const total = (quotes.items || []).length;

  const renderTick = (it: (typeof rows)[0], keySuffix: string) => {
    const pct = it.changePct;
    const tone =
      pct == null || Number.isNaN(pct) ? theme.text.tertiary : pct >= 0 ? upColor : downColor;
    const clickable = Boolean(onOpenStock && it.id);
    return (
      <button
        key={`${it.id || it.symbol}-${keySuffix}`}
        type="button"
        title={`${it.nameZh} · ${formatQuotePrice(it.price, it.currency)} · 点击查看详情`}
        onClick={() => {
          if (it.id && onOpenStock) onOpenStock(it.id);
        }}
        style={{
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "baseline",
          gap: 6,
          margin: 0,
          padding: "2px 4px",
          border: "none",
          borderRadius: 4,
          background: "transparent",
          cursor: clickable ? "pointer" : "default",
          font: "inherit",
          fontSize: 12,
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
          color: "inherit",
        }}
      >
        <span style={{ fontWeight: 600, color: theme.text.primary }}>{it.nameZh}</span>
        <span style={{ fontWeight: 600, color: tone }}>{formatChangePct(pct)}</span>
      </button>
    );
  };

  return (
    <div
      aria-label={`股价监控 · ${ownerLabel}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        minHeight: 40,
        maxHeight: 44,
        padding: "6px 10px",
        border: `1px solid ${theme.stroke.tertiary}`,
        borderRadius: 10,
        background: stripBg,
        overflow: "hidden",
      }}
    >
      <Text weight="medium" size="small" style={{ flexShrink: 0, minWidth: 56 }} title={`按登录用户隔离 · ${ownerLabel}`}>
        股价监控
      </Text>
      <HomeMeta>
        {count} · {ownerLabel}
      </HomeMeta>

      <div className="fintech-ticker-viewport">
        {rows.length ? (
          <div className="fintech-ticker-track" aria-live="off">
            {rows.map((it) => renderTick(it, "a"))}
            {rows.map((it) => renderTick(it, "b"))}
          </div>
        ) : (
          <HomeMeta>暂无监控 · 去上市公司添加（仅本账号）</HomeMeta>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenAll}
        style={{
          flexShrink: 0,
          height: 24,
          padding: "0 10px",
          borderRadius: 6,
          border: `1px solid ${theme.stroke.tertiary}`,
          background: theme.bg.elevated,
          color: theme.text.primary,
          cursor: onOpenAll ? "pointer" : "default",
          font: "inherit",
          fontSize: 11,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        全部 {total}
      </button>
    </div>
  );
}

/** 上市公司当前筛选结果 → CSV（UTF-8 BOM，Excel 可直接开） */
function downloadFintechStockCsv(
  rows: FintechStockQuote[],
  fundCols: { key: FintechFundSortKey; label: string }[],
  asOf: string,
) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const headers = [
    "名称",
    "代码",
    "交易所",
    "国家",
    "展业国",
    "地区",
    "业务",
    "现价",
    "币种",
    "涨跌幅%",
    "市值USD",
    "市值标签",
    "市盈率TTM",
    ...fundCols.map((c) => c.label),
    "财报期",
    "IR链接",
    "Yahoo",
  ];
  const lines = [headers.map(esc).join(",")];
  for (const it of rows) {
    const earn = resolveFintechStockEarning(it.id);
    lines.push(
      [
        it.nameZh,
        it.symbol,
        it.exchange || "",
        fintechStockCountryLabel(it.country),
        (it.markets || []).map(fintechStockCountryLabel).join("·"),
        fintechStockRegionLabel(it.region),
        fintechStockOriginLabel(it.origin),
        it.price ?? "",
        it.currency || "",
        it.changePct ?? "",
        it.marketCapUsd ?? "",
        (it.marketCapLabel || "").replace(/\$/g, ""),
        it.peRatio ?? "",
        ...fundCols.map((c) => pickFintechFundamental(earn, c.key)),
        earn?.period || "",
        earn?.irUrl || it.url || "",
        it.yahoo || it.symbol || "",
      ]
        .map(esc)
        .join(","),
    );
  }
  const stamp = (asOf.match(/\d{4}-\d{2}-\d{2}/) || [new Date().toISOString().slice(0, 10)])[0];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fintech-listed-${stamp}-${rows.length}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 上市公司详情条：行情 + 财报缓存 + 披露/竞品（有 groupKey 时） */
function FintechStockFocusPanel({
  it,
  onClose,
}: {
  it: FintechStockQuote;
  onClose: () => void;
}) {
  const theme = useHostTheme();
  const upColor = "#2f6b3a";
  const downColor = "#b42318";
  const pct = it.changePct;
  const tone =
    pct == null || Number.isNaN(pct) ? theme.text.tertiary : pct >= 0 ? upColor : downColor;
  const earn = resolveFintechStockEarning(it.id);
  const quoteUrl =
    it.url || `https://finance.yahoo.com/quote/${encodeURIComponent(it.yahoo || it.symbol)}`;
  const group = it.groupKey || "";
  const ticker = it.symbol;

  return (
    <div
      style={{
        border: `1px solid ${theme.stroke.secondary}`,
        borderRadius: 12,
        background: theme.bg.elevated,
        padding: "12px 14px",
        display: "grid",
        gap: 10,
      }}
    >
      <Row gap={10} align="start" justify="space-between" wrap>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 650, color: theme.text.primary, lineHeight: 1.35 }}>
            {it.nameZh}
          </div>
          <Row gap={8} align="center" wrap style={{ marginTop: 4 }}>
            <a
              href={quoteUrl}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 12, color: theme.text.secondary, textDecoration: "underline" }}
            >
              {it.symbol}
              {it.exchange ? ` · ${it.exchange}` : ""}
            </a>
            <HomeMeta>{fintechStockCountryLine(it.country, it.markets)}</HomeMeta>
            {it.origin ? <HomeMeta>{fintechStockOriginLabel(it.origin)}</HomeMeta> : null}
          </Row>
        </div>
        <Row gap={10} align="start">
          <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
            <div style={{ fontSize: 16, fontWeight: 650, color: theme.text.primary }}>
              {formatQuotePrice(it.price, it.currency)}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: tone }}>{formatChangePct(pct)}</div>
            <HomeMeta>
              市值 {formatMarketCap(it.marketCapUsd, it.marketCapLabel)}
              {it.peRatio != null ? ` · PE ${formatPeRatio(it.peRatio)}` : ""}
            </HomeMeta>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭详情"
            style={{
              height: 28,
              padding: "0 10px",
              borderRadius: 8,
              border: `1px solid ${theme.stroke.tertiary}`,
              background: theme.bg.elevated,
              color: theme.text.secondary,
              cursor: "pointer",
              font: "inherit",
              fontSize: 12,
            }}
          >
            关闭
          </button>
        </Row>
      </Row>

      {earn?.kpis?.length ? (
        <div style={{ display: "grid", gap: 6 }}>
          <Row gap={8} align="center" justify="space-between">
            <HomeMeta>
              最近财报
              {earn.period ? ` · ${earn.period}` : ""}
            </HomeMeta>
            {earn.irUrl ? (
              <a
                href={earn.irUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, color: theme.text.secondary, textDecoration: "underline" }}
              >
                IR / 原文
              </a>
            ) : null}
          </Row>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
              gap: 8,
            }}
          >
            {earn.kpis.slice(0, 6).map((k) => (
              <div key={k.id} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: theme.text.tertiary }}>{k.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: theme.text.primary }}>{k.value}</div>
                {k.yoy ? <div style={{ fontSize: 11, color: theme.text.tertiary }}>{k.yoy}</div> : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <HomeMeta>最近财报 KPI 待缓存；可先看行情链接</HomeMeta>
      )}

      {group ? (
        <Stack gap={8}>
          <ListedDisclosureBrief group={group} ticker={ticker} />
          <CompetitiveIntelBrief group={group} ticker={ticker} />
        </Stack>
      ) : (
        <HomeMeta>尚未挂靠 Atlas 玩家档（groupKey）；详情以行情与 IR 为准</HomeMeta>
      )}
    </div>
  );
}

/** 顶栏「上市公司」页：全球金融科技上市观察池（股价+市值+最近财报缓存） */
function FintechStockWatchPanel() {
  const theme = useHostTheme();
  const quotes = FINTECH_STOCK_QUOTES;
  const tableBase = theme.bg.elevated;
  const tableHeadBg = solidOverBase(tableBase, theme.fill.secondary);
  const tableRowEven = tableBase;
  const tableRowOdd = solidOverBase(tableBase, theme.fill.tertiary);
  const [region, setRegion] = useCanvasState<string>("fintechStockRegion1", "");
  const [country, setCountry] = useCanvasState<string>("fintechStockCountry1", "");
  const [countryOpen, setCountryOpen] = useCanvasState<boolean>("fintechStockCountryOpen1", false);
  const [origin, setOrigin] = useCanvasState<string>("fintechStockOrigin1", "");
  const [sortBy, setSortBy] = useCanvasState<string>("fintechStockSortBy1", "marketCap");
  const [sortDir, setSortDir] = useCanvasState<string>("fintechStockSortDir1", "desc");
  /** 卡片 = 详情卡；一览 = 紧凑表阅读模式 */
  const [viewMode, setViewMode] = useCanvasState<"cards" | "read">("fintechStockViewMode1", "cards");
  const [focusId, setFocusId] = useCanvasState<string>("fintechStockFocus1", "");
  const monitor = useFintechStockMonitor();
  const focusRef = useRef<HTMLDivElement | null>(null);

  const focusItem = (quotes.items || []).find((x) => x.id === focusId) || null;

  useEffect(() => {
    if (!focusId || !focusRef.current) return;
    focusRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusId, viewMode]);

  const openFocus = (id: string) => {
    if (!id) return;
    setFocusId(id);
  };

  const monitorBtn = (id: string) => {
    const on = monitor.has(id);
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          monitor.toggle(id);
        }}
        title={on ? "移出股价监控" : "加入股价监控"}
        style={{
          height: 22,
          padding: "0 8px",
          borderRadius: 6,
          border: `1px solid ${on ? theme.stroke.secondary : theme.stroke.tertiary}`,
          background: on ? theme.fill.secondary : theme.bg.elevated,
          color: on ? theme.text.primary : theme.text.secondary,
          cursor: "pointer",
          font: "inherit",
          fontSize: 11,
          fontWeight: on ? 600 : 500,
          lineHeight: 1,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {on ? "监控中" : "加入监控"}
      </button>
    );
  };

  const filtered = (quotes.items || []).filter(
    (it) =>
      (!region || it.region === region) &&
      (!country || it.country === country || (it.markets || []).includes(country)) &&
      (!origin || it.origin === origin),
  );

  const countryOptions = (() => {
    const pool = (quotes.items || []).filter((it) => !region || it.region === region);
    const counts = new Map<string, number>();
    for (const it of pool) {
      if (!it.country) continue;
      counts.set(it.country, (counts.get(it.country) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || fintechStockCountryLabel(a[0]).localeCompare(fintechStockCountryLabel(b[0]), "zh"))
      .map(([code, n]) => ({ code, n }));
  })();

  const fundCols = FINTECH_FUNDAMENTAL_COLS.filter((c) =>
    filtered.some((it) => pickFintechFundamental(resolveFintechStockEarning(it.id), c.key) !== "—"),
  );

  const fundSortKeys = new Set<string>(FINTECH_FUNDAMENTAL_COLS.map((c) => c.key));

  const items = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const nullLast = (av: number | null | undefined, bv: number | null | undefined) => {
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dir;
    };
    if (sortBy === "changePct") return nullLast(a.changePct, b.changePct);
    if (sortBy === "peRatio") return nullLast(a.peRatio, b.peRatio);
    if (fundSortKeys.has(sortBy)) {
      const key = sortBy as FintechFundSortKey;
      return nullLast(
        fintechFundamentalSortValue(resolveFintechStockEarning(a.id), key),
        fintechFundamentalSortValue(resolveFintechStockEarning(b.id), key),
      );
    }
    // marketCap default
    return nullLast(a.marketCapUsd, b.marketCapUsd);
  });

  const upColor = "#2f6b3a";
  const downColor = "#b42318";
  const withChange = items.filter((x) => x.changePct != null).length;
  const withEarn = items.filter((x) => resolveFintechStockEarning(x.id)?.kpis?.length).length;
  const withFund = items.filter((x) => {
    const e = resolveFintechStockEarning(x.id);
    if (!e) return false;
    return FINTECH_FUNDAMENTAL_COLS.some((c) => pickFintechFundamental(e, c.key) !== "—");
  }).length;
  const withPe = items.filter((x) => x.peRatio != null && x.peRatio > 0).length;

  const chipStyle = (active: boolean) => ({
    height: 28,
    padding: "0 10px",
    borderRadius: 8,
    border: `1px solid ${active ? theme.stroke.secondary : theme.stroke.tertiary}`,
    background: active ? theme.fill.secondary : theme.bg.elevated,
    color: theme.text.primary,
    cursor: "pointer" as const,
    font: "inherit",
    fontSize: 12,
    fontWeight: active ? 600 : 500,
  });

  const toggleSort = (key: "marketCap" | "changePct" | "peRatio" | FintechFundSortKey) => {
    if (sortBy === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortBy(key);
      // 负债率默认升序（低杠杆优先）；其余金额/涨跌默认降序
      setSortDir(key === "peRatio" || key === "debtRatio" ? "asc" : "desc");
    }
  };

  const sortArrow = (key: string) => {
    if (sortBy !== key) return "";
    return sortDir === "desc" ? " ↓" : " ↑";
  };

  const marketDate = (() => {
    const raw = quotes.asOf || "";
    const m = raw.match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : raw || "—";
  })();

  return (
    <Stack gap={16}>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 8,
          background: theme.bg.elevated,
          padding: "4px 0 10px",
          borderBottom: `1px solid ${theme.stroke.tertiary}`,
        }}
      >
      <Stack gap={10}>
      <Row gap={8} align="center" justify="space-between" wrap>
        <Text weight="medium">上市公司</Text>
        <Row gap={6} align="center" wrap>
          <span title={`股价监控名单按登录账号隔离 · ${monitor.userKey === "guest" ? "访客" : monitor.userKey}`}>
            <HomeMeta>
              监控 {monitor.count} · {monitor.userKey === "guest" ? "访客" : monitor.userKey}
            </HomeMeta>
          </span>
          <Pill
            tone="neutral"
            size="sm"
            onClick={() => downloadFintechStockCsv(items, fundCols, marketDate)}
            title={`导出当前筛选 ${items.length} 家（CSV，Excel 可开）`}
          >
            导出 CSV
          </Pill>
          <div
            role="group"
            aria-label="显示模式"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0,
              height: 28,
              padding: "0 2px",
              borderRadius: 8,
              border: `1px solid ${theme.stroke.tertiary}`,
              background: theme.bg.elevated,
              color: theme.text.tertiary,
              fontSize: 13,
              lineHeight: 1,
            }}
          >
            <button
              type="button"
              title="卡片"
              aria-label="卡片"
              aria-pressed={viewMode === "cards"}
              onClick={() => setViewMode("cards")}
              style={{
                width: 28,
                height: 24,
                margin: 0,
                padding: 0,
                border: "none",
                borderRadius: 6,
                background: viewMode === "cards" ? theme.fill.secondary : "transparent",
                color: viewMode === "cards" ? theme.text.primary : theme.text.tertiary,
                cursor: "pointer",
                font: "inherit",
                fontSize: 14,
                fontWeight: viewMode === "cards" ? 600 : 400,
              }}
            >
              ▦
            </button>
            <span aria-hidden style={{ width: 1, height: 14, background: theme.stroke.tertiary, margin: "0 1px" }} />
            <button
              type="button"
              title="一览"
              aria-label="一览"
              aria-pressed={viewMode === "read"}
              onClick={() => setViewMode("read")}
              style={{
                width: 28,
                height: 24,
                margin: 0,
                padding: 0,
                border: "none",
                borderRadius: 6,
                background: viewMode === "read" ? theme.fill.secondary : "transparent",
                color: viewMode === "read" ? theme.text.primary : theme.text.tertiary,
                cursor: "pointer",
                font: "inherit",
                fontSize: 14,
                fontWeight: viewMode === "read" ? 600 : 400,
              }}
            >
              ☰
            </button>
          </div>
          <HomeMeta>{marketDate}</HomeMeta>
        </Row>
      </Row>

      {viewMode === "cards" ? (
        <Row gap={6} wrap>
          <HomeMeta>排序</HomeMeta>
          <button type="button" onClick={() => toggleSort("marketCap")} style={chipStyle(sortBy === "marketCap")}>
            市值{sortArrow("marketCap")}
          </button>
          <button type="button" onClick={() => toggleSort("changePct")} style={chipStyle(sortBy === "changePct")}>
            涨跌幅{sortArrow("changePct")}
          </button>
          <button type="button" onClick={() => toggleSort("peRatio")} style={chipStyle(sortBy === "peRatio")}>
            市盈率{sortArrow("peRatio")}
          </button>
        </Row>
      ) : null}

      <Row gap={6} wrap>
        <button type="button" onClick={() => setOrigin("")} style={chipStyle(!origin)}>
          全部业务
        </button>
        {FINTECH_STOCK_ORIGIN_ORDER.map((o) => {
          const active = origin === o;
          return (
            <button
              key={o}
              type="button"
              onClick={() => setOrigin(active ? "" : o)}
              style={chipStyle(active)}
            >
              {fintechStockOriginLabel(o)}
            </button>
          );
        })}
      </Row>

      <Row gap={6} wrap>
        <button type="button" onClick={() => setRegion("")} style={chipStyle(!region)}>
          全部地区
        </button>
        {FINTECH_STOCK_REGION_ORDER.map((r) => {
          const active = region === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRegion(active ? "" : r);
                setCountry("");
              }}
              style={chipStyle(active)}
            >
              {fintechStockRegionLabel(r)}
            </button>
          );
        })}
      </Row>

      <Row gap={6} wrap align="center">
        <button
          type="button"
          onClick={() => setCountryOpen(!countryOpen)}
          style={chipStyle(!!country || countryOpen)}
          aria-expanded={countryOpen}
        >
          {country ? `国家 · ${fintechStockCountryLabel(country)}` : "国家"}
          <span style={{ color: theme.text.tertiary, fontWeight: 500 }}>{countryOpen ? " ▴" : " ▾"}</span>
        </button>
        {country && !countryOpen ? (
          <button type="button" onClick={() => setCountry("")} style={chipStyle(false)}>
            清除
          </button>
        ) : null}
        {countryOpen ? (
          <>
            <button type="button" onClick={() => setCountry("")} style={chipStyle(!country)}>
              全部
            </button>
            {countryOptions.map(({ code, n }) => {
              const active = country === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCountry(active ? "" : code)}
                  style={chipStyle(active)}
                  title={`主市场或展业含 ${fintechStockCountryLabel(code)}`}
                >
                  {fintechStockCountryLabel(code)}
                  <span style={{ color: theme.text.tertiary, fontWeight: 500 }}>{` ${n}`}</span>
                </button>
              );
            })}
          </>
        ) : null}
      </Row>
      </Stack>
      </div>

      {focusItem ? (
        <div ref={focusRef}>
          <FintechStockFocusPanel it={focusItem} onClose={() => setFocusId("")} />
        </div>
      ) : null}

      {viewMode === "read" ? (
        <div
          style={{
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            background: tableBase,
          }}
        >

          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              fontSize: 12,
              fontVariantNumeric: "tabular-nums",
              background: tableBase,
            }}
          >
            <thead>
              <tr style={{ color: theme.text.tertiary, textAlign: "left" }}>
                {[
                  { key: "name", label: "名称", align: "left" as const },
                  { key: "country", label: "国家", align: "left" as const, title: "主市场/总部；≠上市交易所所在国" },
                  { key: "symbol", label: "代码", align: "left" as const },
                  { key: "origin", label: "业务", align: "left" as const },
                  { key: "price", label: "现价", align: "right" as const },
                  { key: "changePct", label: `涨跌${sortArrow("changePct") || ""}`, align: "right" as const, sort: "changePct" as const },
                  { key: "marketCap", label: `市值${sortArrow("marketCap") || ""}`, align: "right" as const, sort: "marketCap" as const },
                  { key: "peRatio", label: `市盈率${sortArrow("peRatio") || ""}`, align: "right" as const, sort: "peRatio" as const },
                  ...fundCols.map((c) => ({
                    key: c.key,
                    label: `${c.label}${sortArrow(c.key)}`,
                    align: "right" as const,
                    title: c.title,
                    sort: c.key as FintechFundSortKey,
                  })),
                  { key: "earn", label: "财报", align: "left" as const },
                  { key: "monitor", label: "监控", align: "center" as const },
                ].map((col) => (
                  <th
                    key={col.key}
                    title={"title" in col ? col.title : undefined}
                    style={{
                      position: "sticky",
                      top: 0,
                      left: col.key === "name" ? 0 : undefined,
                      zIndex: col.key === "name" ? 5 : 3,
                      padding: "8px 10px",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      borderBottom: `1px solid ${theme.stroke.tertiary}`,
                      textAlign: col.align,
                      cursor: "sort" in col && col.sort ? "pointer" : "default",
                      userSelect: "none",
                      background: tableHeadBg,
                      boxShadow:
                        col.key === "name"
                          ? `1px 0 0 ${theme.stroke.tertiary}, 0 1px 0 ${theme.stroke.tertiary}`
                          : `0 1px 0 ${theme.stroke.tertiary}`,
                      minWidth: col.key === "name" ? 120 : undefined,
                      maxWidth: col.key === "name" ? 160 : undefined,
                    }}
                    onClick={"sort" in col && col.sort ? () => toggleSort(col.sort!) : undefined}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((it, idx) => {
                  const pct = it.changePct;
                  const tone =
                    pct == null || Number.isNaN(pct) ? theme.text.tertiary : pct >= 0 ? upColor : downColor;
                  const earn = resolveFintechStockEarning(it.id);
                  const earnHint = earn?.kpis?.length
                    ? earn.period || "有"
                    : "—";
                  const rowBg = idx % 2 ? tableRowOdd : tableRowEven;
                  const cellPad: CSSProperties = {
                    padding: "7px 10px",
                    borderBottom: `1px solid ${theme.stroke.tertiary}`,
                    background: rowBg,
                  };
                  return (
                    <tr
                      key={it.id || it.symbol}
                      onClick={() => openFocus(it.id)}
                      style={{
                        background:
                          focusId === it.id
                            ? solidOverBase(rowBg, theme.fill.secondary)
                            : rowBg,
                        color: theme.text.primary,
                        cursor: "pointer",
                      }}
                      title="点击查看该公司详情"
                    >
                      <td
                        style={{
                          ...cellPad,
                          position: "sticky",
                          left: 0,
                          zIndex: 1,
                          fontWeight: 600,
                          maxWidth: 160,
                          minWidth: 120,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          boxShadow: `1px 0 0 ${theme.stroke.tertiary}`,
                        }}
                        title={it.nameZh}
                      >
                        {it.nameZh}
                      </td>
                      <td
                        style={{
                          ...cellPad,
                          whiteSpace: "nowrap",
                          color: theme.text.secondary,
                          fontWeight: 600,
                        }}
                        title={(it.markets || []).map(fintechStockCountryLabel).join(" · ") || undefined}
                      >
                        {fintechStockCountryLine(it.country, it.markets)}
                      </td>
                      <td style={{ ...cellPad, whiteSpace: "nowrap" }}>
                        <a
                          href={
                            it.url ||
                            `https://finance.yahoo.com/quote/${encodeURIComponent(it.yahoo || it.symbol)}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: theme.text.secondary, textDecoration: "none" }}
                        >
                          {it.symbol}
                        </a>
                        {it.exchange ? (
                          <span style={{ color: theme.text.tertiary }}> · {it.exchange}</span>
                        ) : null}
                      </td>
                      <td style={{ ...cellPad, color: theme.text.secondary, whiteSpace: "nowrap" }}>
                        {fintechStockOriginLabel(it.origin)}
                      </td>
                      <td style={{ ...cellPad, textAlign: "right", whiteSpace: "nowrap" }}>
                        {formatQuotePrice(it.price, it.currency)}
                      </td>
                      <td style={{ ...cellPad, textAlign: "right", color: tone, whiteSpace: "nowrap" }}>
                        {formatChangePct(pct)}
                      </td>
                      <td style={{ ...cellPad, textAlign: "right", whiteSpace: "nowrap" }}>
                        {formatMarketCap(it.marketCapUsd, it.marketCapLabel)}
                      </td>
                      <td style={{ ...cellPad, textAlign: "right", whiteSpace: "nowrap" }}>
                        {formatPeRatio(it.peRatio)}
                      </td>
                      {fundCols.map((c) => {
                        const v = pickFintechFundamental(earn, c.key);
                        return (
                          <td
                            key={c.key}
                            title={c.title}
                            style={{
                              ...cellPad,
                              textAlign: "right",
                              whiteSpace: "nowrap",
                              color: v === "—" ? theme.text.tertiary : theme.text.primary,
                              maxWidth: 110,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {v}
                          </td>
                        );
                      })}
                      <td style={{ ...cellPad, color: theme.text.tertiary, whiteSpace: "nowrap" }}>
                        {earn?.irUrl ? (
                          <a
                            href={earn.irUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ color: theme.text.secondary, textDecoration: "none" }}
                          >
                            {earnHint}
                          </a>
                        ) : (
                          earnHint
                        )}
                      </td>
                      <td style={{ ...cellPad, textAlign: "center", whiteSpace: "nowrap" }}>
                        {monitorBtn(it.id)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10 + fundCols.length} style={{ padding: "12px 10px", color: theme.text.tertiary, background: tableBase }}>
                    暂无符合筛选的标的
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
      <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 10,
        }}
      >
        {items.length ? (
          items.map((it) => {
            const pct = it.changePct;
            const tone =
              pct == null || Number.isNaN(pct) ? theme.text.tertiary : pct >= 0 ? upColor : downColor;
            const earn = resolveFintechStockEarning(it.id);
            const kpis = (earn?.kpis || []).slice(0, 3);
            return (
              <div
                key={it.id || it.symbol}
                role="button"
                tabIndex={0}
                onClick={() => openFocus(it.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openFocus(it.id);
                  }
                }}
                title="点击查看该公司详情"
                style={{
                  border: `1px solid ${
                    focusId === it.id ? theme.stroke.secondary : theme.stroke.tertiary
                  }`,
                  borderRadius: 10,
                  background:
                    focusId === it.id
                      ? solidOverBase(theme.bg.elevated, theme.fill.secondary)
                      : theme.bg.elevated,
                  padding: "10px 12px",
                  display: "grid",
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                <Row gap={8} align="start" justify="space-between">
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: theme.text.primary,
                        lineHeight: 1.35,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {it.nameZh}
                    </div>
                    <a
                      href={
                        it.url ||
                        `https://finance.yahoo.com/quote/${encodeURIComponent(it.yahoo || it.symbol)}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        fontSize: 12,
                        color: theme.text.tertiary,
                        textDecoration: "none",
                      }}
                    >
                      {it.symbol}
                      {it.exchange ? ` · ${it.exchange}` : ""}
                    </a>
                    <div style={{ fontSize: 11, color: theme.text.tertiary, marginTop: 2 }}>
                      {fintechStockCountryLine(it.country, it.markets)}
                      {it.origin ? ` · ${fintechStockOriginLabel(it.origin)}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 6, justifyItems: "end", flexShrink: 0 }}>
                    {monitorBtn(it.id)}
                    <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: theme.text.primary }}>
                        {formatQuotePrice(it.price, it.currency)}
                      </div>
                      <div style={{ fontSize: 12, color: tone }}>{formatChangePct(pct)}</div>
                    </div>
                  </div>
                </Row>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <HomeMeta>市值</HomeMeta>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: theme.text.primary,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatMarketCap(it.marketCapUsd, it.marketCapLabel)}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <HomeMeta>市盈率 TTM</HomeMeta>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: theme.text.primary,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatPeRatio(it.peRatio)}
                  </div>
                </div>
                {kpis.length ? (
                  <div
                    style={{
                      borderTop: `1px solid ${theme.stroke.tertiary}`,
                      paddingTop: 8,
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <Row gap={8} align="center" justify="space-between">
                      <HomeMeta>
                        最近财报
                        {earn?.period ? ` · ${earn.period}` : ""}
                      </HomeMeta>
                      {earn?.irUrl ? (
                        <a
                          href={earn.irUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontSize: 11, color: theme.text.tertiary, textDecoration: "none" }}
                        >
                          原文
                        </a>
                      ) : null}
                    </Row>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: 6,
                      }}
                    >
                      {kpis.map((k) => (
                        <div key={k.id} style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 10,
                              color: theme.text.tertiary,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {k.label}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: theme.text.primary,
                              lineHeight: 1.3,
                            }}
                          >
                            {k.value}
                          </div>
                          {k.yoy ? (
                            <div style={{ fontSize: 10, color: theme.text.tertiary }}>{k.yoy}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <HomeMeta>最近财报 · 待缓存</HomeMeta>
                )}
              </div>
            );
          })
        ) : (
          <HomeMeta>暂无符合筛选的标的</HomeMeta>
        )}
      </div>
      </div>
      )}

      <HomeMeta>
        当前 {items.length} 家
        {quotes.stats?.withMarketCap != null ? ` · 市值 ${quotes.stats.withMarketCap}` : ""}
        {` · 涨跌幅 ${withChange}`}
        {` · 市盈率 ${withPe}`}
        {` · 财报缓存 ${withEarn}`}
        {` · 财务列 ${withFund}`}
        {` · 信源 ${citeMark(16)}${citeMark(17)}${citeMark(18)}${citeMark(20)}`}
        {quotes.source ? ` · ${quotes.source}` : ""}
      </HomeMeta>
      {viewMode === "read" ? (
        <HomeMeta>
          市值/财务列统一美元（现价保留本币）；负债率为百分比。准现金/信贷余额仅在口径对齐时展示
        </HomeMeta>
      ) : null}
      <HomeMeta>
        数据链落库：fintech-stock-source-links（Yahoo/交易所/IR）· T2 listed-player-disclosure
      </HomeMeta>
    </Stack>
  );
}

/** 快讯时点：有钟点显示 HH:MM；有日显示 MM-DD；否则不硬编 */
function flashClock(raw?: string): string {
  if (!raw) return "—";
  const hm = raw.match(/\b(\d{1,2}):(\d{2})\b/);
  if (hm) return `${hm[1].padStart(2, "0")}:${hm[2]}`;
  const day = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (day) return `${day[2]}-${day[3]}`;
  const month = raw.match(/^(\d{4})-(\d{2})$/);
  if (month) return `${month[2]}月`;
  return "—";
}

function flashSortKey(published?: string, fallback = ""): string {
  const raw = (published || fallback || "").trim();
  const day = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (day) return `${day[1]}${day[2]}${day[3]}`;
  const month = raw.match(/^(\d{4})-(\d{2})$/);
  if (month) return `${month[1]}${month[2]}00`;
  const hm = raw.match(/\b(\d{1,2}):(\d{2})\b/);
  if (hm) return `9999${hm[1].padStart(2, "0")}${hm[2]}`;
  return "00000000";
}

type FlashFeedItem = {
  id: string;
  timeLabel: string;
  title: string;
  /** 外文原题：用于把笼统中文钩子升级成可辨识标题 */
  titleEn?: string;
  body: string;
  url?: string;
  source?: string;
  marketCode?: string;
  marketName?: string;
  /** credit=消费贷/监管；disaster=天灾人祸 */
  topic?: "credit" | "disaster";
  kindZh?: string;
  lane: "watch" | "media";
  sortKey: string;
};

/** 对齐 36氪快讯：左时间 · 国别·标题 · 正文 · 原文链接 */
function flashDisplayTitle(item: FlashFeedItem): string {
  // 有外文原题时优先走具体钩子，避免列表仍显示「OJK：金融素养与普惠」这类空壳
  const fromEn = (item.titleEn || "").trim()
    ? flashConcreteTitle(item.titleEn!, item.source)
    : "";
  const preferEn =
    fromEn &&
    !fromEn.endsWith("：财经相关") &&
    fromEn !== "外媒：财经相关报道" &&
    fromEn !== "银行与信贷动态" &&
    fromEn !== "OJK 监管动态" &&
    fromEn !== "金融诈骗警示" &&
    fromEn !== "美联储动态" &&
    fromEn !== "新获牌照动态";
  let title = softenBriefText(preferEn ? fromEn : item.title);
  if (item.topic === "disaster") {
    const tag = item.kindZh || "灾害";
    // 标题已含国别/灾种（如「菲律宾…地震」）时不再套「地震：」前缀，避免看起来像复制粘贴
    if (
      !title.includes(tag) &&
      !/地震|洪涝|林火|火灾|台风|干旱|火山|灾害/.test(title) &&
      !/^灾害/.test(title)
    ) {
      title = `${tag}：${title}`;
    }
  }
  const mkt = (item.marketName || "").trim();
  if (!mkt) return title;
  if (title.includes(mkt)) return title;
  // BOT/OJK/RBI 等缩写开头时，国名必须前置，否则分不清属地
  return `${mkt} · ${title}`;
}

function NewsflashRow({
  item,
  expanded,
  unread,
  onToggle,
}: {
  item: FlashFeedItem;
  expanded: boolean;
  unread?: boolean;
  onToggle: () => void;
}) {
  const theme = useHostTheme();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "44px minmax(0, 1fr)",
        gap: 12,
        padding: "12px 0",
        borderBottom: `1px solid ${theme.stroke.tertiary}`,
      }}
    >
      <div
        style={{
          fontSize: 12,
          lineHeight: 1.4,
          color: theme.text.tertiary,
          fontVariantNumeric: "tabular-nums",
          paddingTop: 2,
        }}
      >
        {item.timeLabel}
      </div>
      <div style={{ position: "relative", minWidth: 0 }}>
        {unread ? <UnreadBadge count={1} dot /> : null}
        <button
          type="button"
          onClick={onToggle}
          style={{
            display: "block",
            width: "100%",
            margin: 0,
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
            font: "inherit",
            color: "inherit",
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.45,
              color: theme.text.primary,
            }}
          >
            <GlossedText text={flashDisplayTitle(item)} />
          </div>
        </button>
        {expanded ? (
          <Stack gap={8} style={{ marginTop: 8 }}>
            <HomeProse muted>
              <GlossedText
                text={
                  softenBriefDecorations(item.body || "").trim() ||
                  "暂无展开摘要（未达「一段话说清」标准）。"
                }
              />
            </HomeProse>
            <Row gap={10} wrap align="center">
              <HomeMeta>
                {[item.marketName, item.source].filter(Boolean).join(" · ") || "快讯"}
              </HomeMeta>
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 12,
                    color: theme.text.primary,
                    textDecoration: "underline",
                  }}
                >
                  原文链接
                </a>
              ) : null}
              <button
                type="button"
                onClick={onToggle}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: 12,
                  color: theme.text.tertiary,
                }}
              >
                收起
              </button>
            </Row>
          </Stack>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            style={{
              marginTop: 6,
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              font: "inherit",
              fontSize: 12,
              color: theme.text.tertiary,
            }}
          >
            展开
          </button>
        )}
      </div>
    </div>
  );
}

function MorningBriefHome({
  role = "am",
  onOpenStocks,
  onOpenStock,
}: {
  role?: AtlasRole;
  onOpenStocks?: () => void;
  onOpenStock?: (id: string) => void;
}) {
  const watch = CC_WATCH_DIGEST;
  const brief = MORNING_BRIEF_36KR;
  const theme = useHostTheme();
  const dayKey = watch.displayDate || brief.displayDate || brief.coverageDate || "na";
  const [filterMkt, setFilterMkt] = useCanvasState<string>(`ccWatchMkt_${dayKey}`, "");
  const [filterTopic, setFilterTopic] = useCanvasState<string>(`ccWatchTopic_${dayKey}`, "");
  const [readMkts, setReadMkts] = useCanvasState<string>(`ccWatchRead_${dayKey}`, "");
  const [openFlash, setOpenFlash] = useCanvasState<string>(`flashOpen_${dayKey}`, "");
  const [readFlash, setReadFlash] = useCanvasState<string>(`flashRead_${dayKey}`, "");
  const readMktSet = new Set(readMkts.split("|").filter(Boolean));
  const readFlashSet = new Set(readFlash.split("|").filter(Boolean));

  const investedMkts = watch.markets.filter((m) => (m.tier ?? "invested") === "invested");
  const hotMkts = watch.markets.filter((m) => m.tier === "diandian_hot");
  const focusMkts = [...investedMkts, ...hotMkts];
  const disasterItems = DISASTER_WATCH_DIGEST.items || [];
  const disasterTotal = disasterItems.length;
  const watchTotal = focusMkts.reduce((n, m) => n + (m.count || 0), 0) + disasterTotal;
  const unreadMktTotal = focusMkts.reduce(
    (n, m) => n + (readMktSet.has(m.code) ? 0 : m.count || 0),
    0,
  );
  const bossVerdict = watch.overallVerdict || brief.overallVerdict || "";
  const dateLabel =
    watch.displayDate || brief.displayDate || DISASTER_WATCH_DIGEST.displayDate || "";

  /** 本周读法 → 挂到国别 chip 的 title，避免再铺一套展业国/热点国卡片 */
  const verdictTipByCode = (() => {
    const map = new Map<string, string>();
    const aliases: Record<string, string[]> = {
      香港: ["中国香港", "香港"],
      中国香港: ["中国香港", "香港"],
      马来: ["马来西亚", "马来"],
      澳洲: ["澳大利亚", "澳洲"],
      澳大利亚: ["澳大利亚", "澳洲"],
    };
    for (const b of parseWatchVerdictSections(bossVerdict).flatMap((s) => s.bullets)) {
      if (!b.country || !b.text) continue;
      const names = aliases[b.country] || [b.country];
      const hit = focusMkts.find((m) => names.some((n) => m.nameZh.includes(n) || n.includes(m.nameZh)));
      if (hit && !map.has(hit.code)) map.set(hit.code, readableWatchSentence(b.country, b.text));
    }
    return map;
  })();

  const watchFeed: FlashFeedItem[] = (() => {
    const creditRows = focusMkts.flatMap((m) =>
      (m.items || []).map((s, i) => {
        const id = `w:${m.code}:${i}:${(s.titleEn || s.title).slice(0, 24)}`;
        const timeRaw = s.published || "";
        return {
          id,
          timeLabel: flashClock(timeRaw),
          title: s.title,
          titleEn: s.titleEn,
          body: storyToProse(s),
          url: s.url,
          source: s.source,
          marketCode: m.code,
          marketName: m.nameZh,
          topic: "credit" as const,
          lane: "watch" as const,
          sortKey: `${flashSortKey(s.published)}|${m.code}|${String(i).padStart(2, "0")}`,
        };
      }),
    );
    const disasterRows: FlashFeedItem[] = disasterItems.map((s, i) => ({
      id: `d:${s.id || i}`,
      timeLabel: flashClock(s.published || ""),
      title: s.title,
      titleEn: s.titleEn,
      body: storyToProse({
        what: s.what,
        how: s.how,
        result: s.result || s.cashLoanHint,
        title: s.title,
        titleEn: s.titleEn,
        source: s.source,
        published: s.published,
        cashLoanHint: s.cashLoanHint,
      }),
      url: s.url,
      source: s.source,
      marketCode: s.country,
      marketName: s.nameZh,
      topic: "disaster" as const,
      kindZh: s.kindZh || disasterKindLabel(s.kind),
      lane: "watch" as const,
      sortKey: `${flashSortKey(s.published)}|d|${s.country}|${String(i).padStart(2, "0")}`,
    }));
    const rows = [...creditRows, ...disasterRows];
    // 同国同标题去重（保留最新一条）；有原文标题时按原文区分
    const seen = new Set<string>();
    const deduped: FlashFeedItem[] = [];
    for (const row of [...rows].sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0))) {
      const key = `${row.marketCode}|${row.topic || ""}|${row.title}|${row.url || row.id}`;
      const loose = `${row.marketCode}|${row.topic || ""}|${row.title}`;
      if (seen.has(key) || seen.has(loose)) continue;
      seen.add(key);
      seen.add(loose);
      deduped.push(row);
    }
    return deduped;
  })();

  const visibleWatch = watchFeed.filter((x) => {
    if (filterMkt && x.marketCode !== filterMkt) return false;
    if (filterTopic === "disaster" && x.topic !== "disaster") return false;
    if (filterTopic === "credit" && x.topic === "disaster") return false;
    return true;
  });

  function selectMarket(code: string) {
    const next = filterMkt === code ? "" : code;
    setFilterMkt(next);
    if (next && !readMktSet.has(next)) {
      setReadMkts([...readMktSet, next].join("|"));
    }
  }

  function selectTopic(topic: string) {
    setFilterTopic(filterTopic === topic ? "" : topic);
  }

  function toggleFlash(id: string, marketCode?: string) {
    const next = openFlash === id ? "" : id;
    setOpenFlash(next);
    if (next) {
      if (!readFlashSet.has(id)) setReadFlash([...readFlashSet, id].join("|"));
      if (marketCode && !readMktSet.has(marketCode)) {
        setReadMkts([...readMktSet, marketCode].join("|"));
      }
    }
  }

  const countryChip = (m: (typeof focusMkts)[0]) => {
    const unread = readMktSet.has(m.code) ? 0 : m.count;
    const active = filterMkt === m.code;
    const tip = verdictTipByCode.get(m.code);
    const dCount = disasterCountForCountry(m.code);
    return (
      <button
        key={m.code}
        type="button"
        title={[tip, dCount ? `灾害 ${dCount} 条` : ""].filter(Boolean).join(" · ") || undefined}
        onClick={() => selectMarket(m.code)}
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          height: 24,
          padding: "0 8px",
          borderRadius: 6,
          border: `1px solid ${active ? theme.stroke.secondary : theme.stroke.tertiary}`,
          background: active ? theme.fill.secondary : theme.bg.elevated,
          color: theme.text.primary,
          cursor: "pointer",
          font: "inherit",
          fontSize: 11,
          fontWeight: active ? 600 : 500,
          lineHeight: 1,
          boxSizing: "border-box",
        }}
      >
        <UnreadBadge count={unread} />
        {m.nameZh}
        {!unread ? (
          <span style={{ color: theme.text.tertiary, fontWeight: 400 }}>{m.count}</span>
        ) : null}
        {dCount ? (
          <span
            title={`灾害 ${dCount}`}
            style={{
              marginLeft: 2,
              minWidth: 14,
              height: 14,
              padding: "0 4px",
              borderRadius: 4,
              background: "rgba(180, 83, 9, 0.14)",
              color: "#92400e",
              fontSize: 10,
              fontWeight: 600,
              lineHeight: "14px",
              textAlign: "center",
            }}
          >
            灾{dCount}
          </span>
        ) : null}
      </button>
    );
  };

  const topicChip = (topic: string, label: string, count: number) => {
    const active = filterTopic === topic;
    return (
      <button
        key={topic}
        type="button"
        onClick={() => selectTopic(topic)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          height: 24,
          padding: "0 8px",
          borderRadius: 6,
          border: `1px solid ${active ? theme.stroke.secondary : theme.stroke.tertiary}`,
          background: active ? theme.fill.secondary : theme.bg.elevated,
          color: theme.text.primary,
          cursor: "pointer",
          font: "inherit",
          fontSize: 11,
          fontWeight: active ? 600 : 500,
          lineHeight: 1,
          boxSizing: "border-box",
        }}
      >
        {label}
        <span style={{ color: theme.text.tertiary, fontWeight: 400 }}>{count}</span>
      </button>
    );
  };

  const briefMeta = softenBriefText(
    [
      "本周关注",
      watchTotal ? `${watchTotal} 条` : "",
      disasterTotal ? `灾害 ${disasterTotal}` : "",
      unreadMktTotal ? `未读 ${unreadMktTotal}` : "",
      dateLabel ? `更新至 ${dateLabel}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
  );

  return (
    <Stack gap={0}>
      <AtlasStickySub>
        <Stack gap={12}>
          {briefMeta ? <HomeMeta>{briefMeta}</HomeMeta> : null}

          <Stack gap={8}>
            {(role === "boss" || role === "am") && bossVerdict ? (
              <BossWatchBar
                verdict={bossVerdict}
                onOpenCountry={(nameZh) => {
                  const aliases: Record<string, string[]> = {
                    香港: ["中国香港", "香港"],
                    中国香港: ["中国香港", "香港"],
                    马来: ["马来西亚", "马来"],
                    澳洲: ["澳大利亚", "澳洲"],
                    澳大利亚: ["澳大利亚", "澳洲"],
                  };
                  const names = aliases[nameZh] || [nameZh];
                  const hit = focusMkts.find((m) => names.some((n) => m.nameZh.includes(n) || n.includes(m.nameZh)));
                  if (!hit) return;
                  setFilterMkt(hit.code);
                  if (!readMktSet.has(hit.code)) setReadMkts([...readMktSet, hit.code].join("|"));
                  const first = watchFeed.find((x) => x.marketCode === hit.code);
                  if (first) {
                    setOpenFlash(first.id);
                    if (!readFlashSet.has(first.id)) setReadFlash([...readFlashSet, first.id].join("|"));
                  } else {
                    setOpenFlash("");
                  }
                }}
              />
            ) : null}
            <FintechStockMonitorStrip onOpenAll={onOpenStocks} onOpenStock={onOpenStock} />
          </Stack>

          <Row gap={10} align="center" wrap>
            <Row gap={5} align="center" wrap>
              <HomeMeta>主题</HomeMeta>
              {topicChip("credit", "信贷/监管", watchFeed.filter((x) => x.topic !== "disaster").length)}
              {topicChip("disaster", "灾害", disasterTotal)}
            </Row>
            {investedMkts.length ? (
              <span
                aria-hidden
                style={{
                  width: 1,
                  alignSelf: "stretch",
                  minHeight: 16,
                  background: theme.stroke.tertiary,
                  flexShrink: 0,
                }}
              />
            ) : null}
            {investedMkts.length ? (
              <Row gap={5} align="center" wrap>
                <HomeMeta>展业国</HomeMeta>
                {investedMkts.map(countryChip)}
              </Row>
            ) : null}
            {investedMkts.length && hotMkts.length ? (
              <span
                aria-hidden
                style={{
                  width: 1,
                  alignSelf: "stretch",
                  minHeight: 16,
                  background: theme.stroke.tertiary,
                  flexShrink: 0,
                }}
              />
            ) : null}
            {hotMkts.length ? (
              <Row gap={5} align="center" wrap>
                <HomeMeta>热点国</HomeMeta>
                {hotMkts.map(countryChip)}
              </Row>
            ) : null}
          </Row>
        </Stack>
      </AtlasStickySub>

      <Stack gap={0} style={{ paddingTop: 8 }}>
        {filterMkt || filterTopic ? (
          <div style={{ marginBottom: 4 }}>
            <HomeMeta>
              {[
                filterMkt
                  ? focusMkts.find((m) => m.code === filterMkt)?.nameZh || filterMkt
                  : "",
                filterTopic === "disaster" ? "灾害" : filterTopic === "credit" ? "信贷/监管" : "",
                visibleWatch.length ? `${visibleWatch.length} 条` : "",
                filterMkt ? verdictTipByCode.get(filterMkt) || "" : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </HomeMeta>
          </div>
        ) : null}
        {visibleWatch.length ? (
          visibleWatch.map((item) => (
            <NewsflashRow
              key={item.id}
              item={item}
              expanded={openFlash === item.id}
              unread={!readFlashSet.has(item.id) && !readMktSet.has(item.marketCode || "")}
              onToggle={() => toggleFlash(item.id, item.marketCode)}
            />
          ))
        ) : (
          <HomeMeta>{filterTopic === "disaster" ? "暂无灾害快讯" : "该国暂无快讯条目"}</HomeMeta>
        )}
      </Stack>
    </Stack>
  );
}

function UnreadBadge({ count, dot }: { count: number; dot?: boolean }) {
  if (count <= 0) return null;
  if (dot) {
    return (
      <span
        style={{
          position: "absolute",
          top: 2,
          right: -2,
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "#fa5151",
        }}
        aria-hidden
      />
    );
  }
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      style={{
        position: "absolute",
        top: -4,
        right: -4,
        minWidth: 14,
        height: 14,
        padding: "0 3px",
        borderRadius: 999,
        background: "#fa5151",
        color: "#fff",
        fontSize: 9,
        fontWeight: 600,
        lineHeight: "14px",
        textAlign: "center",
        boxSizing: "border-box",
      }}
    >
      {label}
    </span>
  );
}

/** 从集团名/品牌抽快讯匹配针（长词优先，减少误挂） */
function briefNeedlesForPlayer(group: string, brands: string): string[] {
  const out = new Set<string>();
  const push = (s: string) => {
    const t = s.trim();
    if (t.length >= 2) out.add(t);
  };
  push(group.split("｜")[0] ?? "");
  const m = group.match(/（([^）]+)）\s*$/);
  if (m) push(m[1].split(/[·・]/)[0] ?? "");
  for (const part of brands.split(/[/／、,，|｜]+/)) push(part);
  for (const brand of Object.keys(BRAND_SEARCH_ALIASES)) {
    if (group.includes(brand) || brands.includes(brand)) {
      push(brand);
      for (const a of BRAND_SEARCH_ALIASES[brand]) {
        if (/[\u4e00-\u9fff]/.test(a) || a.length >= 4) push(a);
      }
    }
  }
  return [...out].sort((a, b) => b.length - a.length);
}

type PlayerBriefHit = {
  key: string;
  label: string;
  group: string;
  items: { themeId: string; title: string; time?: string }[];
};

function buildPlayerBriefHits(
  brief: typeof MORNING_BRIEF_36KR,
  players: CreditRow[],
): PlayerBriefHit[] {
  const catalog = players
    .filter((r) => r.institutionTypes.includes("玩家"))
    .map((r) => ({
      key: creditBrandKey(r.group),
      label: compareCreditLabel(r),
      group: r.group,
      needles: briefNeedlesForPlayer(r.group, r.brands),
    }))
    .filter((p) => p.needles.length > 0);

  const byKey = new Map<string, PlayerBriefHit>();
  for (const theme of brief.themes) {
    for (const src of theme.sources ?? []) {
      const title = src.title || "";
      if (!title) continue;
      const titleLow = title.toLowerCase();
      let best: (typeof catalog)[0] | null = null;
      let bestLen = 0;
      for (const p of catalog) {
        for (const n of p.needles) {
          const hit =
            /[\u4e00-\u9fff]/.test(n) ? title.includes(n) : titleLow.includes(n.toLowerCase());
          if (hit && n.length > bestLen) {
            best = p;
            bestLen = n.length;
          }
        }
      }
      if (!best || bestLen < 2) continue;
      const cur =
        byKey.get(best.key) ??
        ({ key: best.key, label: best.label, group: best.group, items: [] } as PlayerBriefHit);
      if (!cur.items.some((x) => x.title === title && x.themeId === theme.id)) {
        cur.items.push({ themeId: theme.id, title, time: src.time });
      }
      byKey.set(best.key, cur);
    }
  }
  return [...byKey.values()].sort((a, b) => b.items.length - a.items.length);
}

function linkifyText(text: string, linkColor: string): ReactNode[] {
  const re = /(https?:\/\/[^\s；;，,）)\]]+)/g;
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) != null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const url = m[1].replace(/[.,;；]+$/, "");
    parts.push(
      <a
        key={`u-${i++}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        style={{ color: linkColor, wordBreak: "break-all" }}
      >
        {url.replace(/^https?:\/\//, "").length > 42
          ? `${url.replace(/^https?:\/\//, "").slice(0, 40)}…`
          : url.replace(/^https?:\/\//, "")}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}

function NbfcOtherCell({
  otherInfo,
  notes,
}: {
  otherInfo: string;
  notes: string;
}) {
  const theme = useHostTheme();
  const [open, setOpen] = useState(false);
  const hasOther = Boolean(otherInfo.trim());
  const hasNotes = Boolean(notes.trim());
  if (!hasOther && !hasNotes) {
    return <span style={{ color: theme.text.tertiary }}>—</span>;
  }
  const joinedLen = (otherInfo + notes).length;
  const collapsed = !open && joinedLen > 96;
  const block = (label: string, body: string, muted?: boolean): ReactNode => {
    if (!body.trim()) return null;
    const shown = collapsed && body.length > 72 ? `${body.slice(0, 70)}…` : body;
    return (
      <div style={{ marginBottom: hasOther && hasNotes ? 6 : 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.02em",
            color: theme.text.tertiary,
            marginBottom: 2,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.55,
            color: muted ? theme.text.secondary : theme.text.primary,
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            whiteSpace: "pre-wrap",
          }}
        >
          {linkifyText(shown, theme.accent.control)}
        </div>
      </div>
    );
  };
  return (
    <div style={{ minWidth: 0 }}>
      {block("摘要", otherInfo)}
      {block("备注", notes, true)}
      {joinedLen > 96 ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            marginTop: 4,
            padding: 0,
            border: "none",
            background: "transparent",
            color: theme.accent.control,
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          {open ? "收起" : "展开全部"}
        </button>
      ) : null}
    </div>
  );
}

function NbfcStatsSubpage() {
  const theme = useHostTheme();
  const rows = NBFC_STATS.rows;
  const withCount = rows.filter((r) => r.nbfc_count.trim()).length;
  const official = rows.filter((r) => r.data_quality === "official").length;

  const th: CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 1,
    textAlign: "left",
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
    background: theme.bg.elevated,
    borderBottom: `1px solid ${theme.stroke.secondary}`,
    color: theme.text.secondary,
  };
  const td: CSSProperties = {
    padding: "10px 12px",
    fontSize: 12,
    verticalAlign: "top",
    borderBottom: `1px solid ${theme.stroke.tertiary}`,
    color: theme.text.primary,
  };
  const tdCountry: CSSProperties = {
    ...td,
    position: "sticky",
    left: 0,
    zIndex: 2,
    background: theme.bg.elevated,
    whiteSpace: "nowrap",
    width: 96,
    minWidth: 96,
    boxShadow: `1px 0 0 ${theme.stroke.tertiary}`,
  };
  const thCountry: CSSProperties = {
    ...th,
    left: 0,
    zIndex: 3,
    width: 96,
    minWidth: 96,
    boxShadow: `1px 0 0 ${theme.stroke.tertiary}`,
  };
  const tdQuality: CSSProperties = {
    ...td,
    whiteSpace: "nowrap",
    width: 76,
    minWidth: 76,
  };
  const tdNum: CSSProperties = {
    ...td,
    maxWidth: 120,
    overflow: "hidden",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    whiteSpace: "normal",
  };
  const tdClamp: CSSProperties = {
    ...td,
    maxWidth: 148,
    overflow: "hidden",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    whiteSpace: "normal",
  };
  const tdOther: CSSProperties = {
    ...td,
    width: "32%",
    minWidth: 420,
  };

  return (
    <Stack gap={14}>
      <Row gap={8} align="center" justify="space-between" wrap>
        <Stack gap={4}>
          <H2>非银玩家统计信息（监管名单）</H2>
          <Text size="small" tone="secondary">
            {NBFC_STATS.meta.title} · 更新 {NBFC_STATS.meta.updated} · {rows.length} 行 · 有机构数{" "}
            {withCount} · 官方口径 {official}
          </Text>
        </Stack>
        <Pill
          tone="neutral"
          size="sm"
          onClick={downloadNbfcXlsx}
          title="导出非银玩家统计信息（监管名单）.xlsx"
        >
          导出 Excel
        </Pill>
      </Row>

      <Callout tone="info">
        {NBFC_STATS.meta.note}
        {NBFC_STATS.meta.fx_note ? ` ${NBFC_STATS.meta.fx_note}` : ""}
      </Callout>

      <div
        style={{
          width: "100%",
          overflowX: "auto",
        }}
      >
        <table
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            width: "100%",
            minWidth: 1680,
            tableLayout: "fixed",
          }}
        >
          <colgroup>
            <col style={{ width: 96 }} />
            <col style={{ width: 132 }} />
            <col style={{ width: 132 }} />
            <col style={{ width: 88 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 108 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 96 }} />
            <col style={{ width: 88 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 76 }} />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th style={thCountry}>国家</th>
              <th style={th}>NBFC/等效</th>
              <th style={th}>监管机构</th>
              <th style={th}>机构数量</th>
              <th style={th}>放贷总量</th>
              <th style={th}>放贷总量(USD)</th>
              <th style={th}>覆盖人数</th>
              <th style={th}>平均放贷额</th>
              <th style={th}>Default/NPL</th>
              <th style={th}>时点</th>
              <th style={th}>信源</th>
              <th style={{ ...th, width: 76 }}>质量</th>
              <th style={th}>其他</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const zebra = i % 2 === 1 ? theme.fill.tertiary : theme.bg.elevated;
              return (
                <tr key={`${r.country_code}-${r.nbfc_equivalent_name}-${i}`} style={{ background: zebra }}>
                  <td style={{ ...tdCountry, background: zebra }}>
                    <Text size="small" weight="medium" as="span">
                      {r.country_name_zh}
                    </Text>
                    <Text size="small" tone="tertiary" as="span">
                      {" "}
                      {r.country_code}
                    </Text>
                  </td>
                  <td style={tdClamp} title={r.nbfc_equivalent_name || undefined}>
                    {r.nbfc_equivalent_name || "—"}
                  </td>
                  <td style={tdClamp} title={r.regulator || undefined}>
                    {r.regulator || "—"}
                  </td>
                  <td style={tdNum}>{r.nbfc_count || "—"}</td>
                  <td style={tdClamp} title={r.loan_book_total || undefined}>
                    {r.loan_book_total || "—"}
                  </td>
                  <td style={tdNum}>{r.loan_book_usd || "—"}</td>
                  <td style={tdClamp} title={r.borrowers_covered || undefined}>
                    {r.borrowers_covered || "—"}
                  </td>
                  <td style={tdClamp} title={r.avg_loan_size || undefined}>
                    {r.avg_loan_size || "—"}
                  </td>
                  <td style={tdClamp} title={r.default_rate || undefined}>
                    {r.default_rate || "—"}
                  </td>
                  <td style={tdNum}>{r.as_of || "—"}</td>
                  <td style={tdClamp}>
                    {r.source_url ? (
                      <Link href={r.source_url}>{r.source_title || r.source_url}</Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={tdQuality}>
                    <Pill size="sm" tone={qualityTone(r.data_quality)}>
                      {DATA_QUALITY_LABEL[r.data_quality]}
                    </Pill>
                  </td>
                  <td style={tdOther}>
                    <NbfcOtherCell otherInfo={r.other_info || ""} notes={r.notes || ""} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Stack>
  );
}

function MapPanel({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** 地图右上角：线框图标钮 · 全屏 / 退出 */
function MapChromeIconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const theme = useHostTheme();
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        margin: 0,
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${theme.stroke.secondary}`,
        borderRadius: 4,
        background: theme.bg.elevated,
        color: theme.text.secondary,
        cursor: "pointer",
        transition: "border-color 120ms ease, color 120ms ease, background 120ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = theme.stroke.primary;
        e.currentTarget.style.color = theme.text.primary;
        e.currentTarget.style.background = theme.fill.quaternary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = theme.stroke.secondary;
        e.currentTarget.style.color = theme.text.secondary;
        e.currentTarget.style.background = theme.bg.elevated;
      }}
    >
      {children}
    </button>
  );
}

function IconExpand() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCollapse() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 2.5V6H2.5M13.5 6H10V2.5M10 13.5V10h3.5M2.5 10H6v3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MapStage({
  children,
  present,
  onPresent,
  onExit,
  showCornerToggle = false,
}: {
  children: ReactNode;
  present: boolean;
  onPresent: () => void;
  onExit?: () => void;
  /** 大屏：全屏按钮放在地图框右上角 */
  showCornerToggle?: boolean;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: present ? "100%" : undefined,
        minHeight: present ? 0 : undefined,
      }}
    >
      {showCornerToggle ? (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 8,
            display: "flex",
            gap: 2,
            alignItems: "center",
          }}
        >
          {present && onExit ? (
            <MapChromeIconBtn title="退出全屏" onClick={onExit}>
              <IconCollapse />
            </MapChromeIconBtn>
          ) : !present ? (
            <MapChromeIconBtn title="全屏" onClick={onPresent}>
              <IconExpand />
            </MapChromeIconBtn>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** 大屏机构叠层：全球网络落点的主要枢纽（避免「全球」刷满 84 国，又避免只剩中国一颗钉） */
const ECO_MAP_GLOBAL_HUBS: Exclude<CountryCode, "all">[] = [
  "CN",
  "HK",
  "US",
  "GB",
  "SG",
  "JP",
  "IN",
  "ID",
  "TH",
  "PH",
  "MX",
  "BR",
  "DE",
  "FR",
  "CA",
  "KR",
  "MY",
  "VN",
  "TW",
  "AE",
];

/** 大屏地图国别计数：组名国别码 / countries 别名；全球网络另落枢纽国 */
function aggregateEcoCountsByCountry(type: InstitutionType): Record<string, number> {
  const out: Record<string, number> = {};
  const codes = (Object.keys(COUNTRY_LABEL) as CountryCode[]).filter(
    (c): c is Exclude<CountryCode, "all"> => c !== "all",
  );
  const hitCountries = (
    r: { group: string; countries: string },
    covered: () => Exclude<CountryCode, "all">[],
  ) => {
    const hits = new Set<Exclude<CountryCode, "all">>();
    for (const c of codes) {
      if (r.group.includes(`·${c}`) || new RegExp(`[·（(]${c}[）)]`).test(r.group)) {
        hits.add(c);
        continue;
      }
      const aliases = COUNTRY_ALIASES[c] ?? [];
      if (aliases.some((a) => r.countries.includes(a))) hits.add(c);
    }
    if (hasWorldwideCoverage(r.countries)) {
      // 全球网络：保留上文点名国，并落到枢纽，供「市场 × 机构」叠层同时可见
      for (const c of ECO_MAP_GLOBAL_HUBS) hits.add(c);
    } else if (hits.size === 0) {
      for (const c of covered()) hits.add(c);
    }
    return hits;
  };
  for (const r of credits) {
    if (!r.institutionTypes.includes(type)) continue;
    for (const c of hitCountries(r, () => countriesCoveredByCreditRow(r))) {
      out[c] = (out[c] ?? 0) + 1;
    }
  }
  // 玩家含场景原生（对照页同口径），一并落点
  if (type === "玩家") {
    for (const r of scenes) {
      if (!r.institutionTypes.includes("玩家")) continue;
      for (const c of hitCountries(r, () => countriesCoveredBySceneRow(r))) {
        out[c] = (out[c] ?? 0) + 1;
      }
    }
  }
  return out;
}

function mapFullscreenCorner(
  present: boolean,
  onPresent?: () => void,
  onExit?: () => void,
): ReactNode {
  if (onPresent == null) return null;
  return present && onExit ? (
    <MapChromeIconBtn title="退出全屏" onClick={onExit}>
      <IconCollapse />
    </MapChromeIconBtn>
  ) : !present ? (
    <MapChromeIconBtn title="全屏" onClick={onPresent}>
      <IconExpand />
    </MapChromeIconBtn>
  ) : null;
}

/** 大屏地图区域芯片（对齐 CRM 洲际名册） */
const BIG_SCREEN_MAP_REGIONS: { id: Exclude<Region, "all">; label: string }[] = [
  { id: "east-asia", label: "东亚" },
  { id: "se-asia", label: "东南亚" },
  { id: "south-asia", label: "南亚" },
  { id: "central-asia", label: "中亚" },
  { id: "mena", label: "中东与北非" },
  { id: "africa", label: "非洲" },
  { id: "latam", label: "拉丁美洲" },
  { id: "west", label: "欧美" },
];

type ScreenMacroSub = "loanBook" | MacroMapFactorId;
type ScreenTab = "macro" | "eco" | "roster";

/** 大屏：市场在贷面填 × 展业徽章 / 机构样本（绿色面填；可区域缩放） */
function BigScreenOverlay({
  height = 560,
  bare = false,
  present = false,
  onPresent,
  onExit,
  showMarket = true,
  showInvested = true,
  ecoType,
  mapRegion = "",
}: {
  height?: number;
  bare?: boolean;
  present?: boolean;
  onPresent?: () => void;
  onExit?: () => void;
  showMarket?: boolean;
  showInvested?: boolean;
  ecoType?: InstitutionType | "";
  mapRegion?: "" | Exclude<Region, "all">;
}) {
  const ecoOn = Boolean(ecoType);
  const ecoCounts = useMemo(
    () => (ecoType ? aggregateEcoCountsByCountry(ecoType) : undefined),
    [ecoType],
  );
  const ecoTotalUnique = useMemo(() => {
    if (!ecoType) return undefined;
    let n = credits.filter((r) => r.institutionTypes.includes(ecoType)).length;
    if (ecoType === "玩家") {
      n += scenes.filter((r) => r.institutionTypes.includes("玩家")).length;
    }
    return n;
  }, [ecoType]);
  const regionZoomCodes = mapRegion ? COUNTRIES_BY_REGION[mapRegion] : null;

  const corner = mapFullscreenCorner(present, onPresent, onExit);
  return (
    <FullMarketChoropleth
      height={height}
      fill={bare}
      legendPlacement="bottom"
      showMarket={showMarket}
      showInvested={showInvested && !ecoOn}
      showEco={ecoOn}
      ecoCounts={ecoCounts}
      ecoTotalUnique={ecoTotalUnique}
      ecoLabel={ecoType ? INSTITUTION_TYPE_LABEL[ecoType] : undefined}
      mapCorner={corner}
      regionZoomCodes={regionZoomCodes}
    />
  );
}

/** 大屏：宏观因子地域分布（可叠展业徽章 + 区域缩放） */
function BigScreenMacro({
  height = 520,
  bare = false,
  factor,
  showInvested = false,
  present = false,
  onPresent,
  onExit,
  mapRegion = "",
}: {
  height?: number;
  bare?: boolean;
  factor: MacroMapFactorId;
  showInvested?: boolean;
  present?: boolean;
  onPresent?: () => void;
  onExit?: () => void;
  mapRegion?: "" | Exclude<Region, "all">;
}) {
  const corner = mapFullscreenCorner(present, onPresent, onExit);
  const regionZoomCodes = mapRegion ? COUNTRIES_BY_REGION[mapRegion] : null;
  return (
    <MacroHeatGlobe
      height={height}
      factor={factor}
      fill={bare}
      legendPlacement="bottom"
      showInvested={showInvested}
      mapCorner={corner}
      regionZoomCodes={regionZoomCodes}
    />
  );
}

/** 大屏主控：宏观（在贷余额/因子）· 机构 · 非银名单 — 对齐 gh-pages */
function BigScreen() {
  const theme = useHostTheme();
  const [screenTab, setScreenTab] = useCanvasState<ScreenTab>("screenTab4", "macro");
  const [macroSub, setMacroSub] = useCanvasState<ScreenMacroSub>("screenMacroSub2", "loanBook");
  const [ecoType, setEcoType] = useCanvasState<InstitutionType | "">("screenEcoType2", "");
  const [ecoPickerOpen, setEcoPickerOpen] = useCanvasState<boolean>("screenEcoOpen2", false);
  const [present, setPresent] = useCanvasState<boolean>("screenPresent1", false);
  const [mapRegion, setMapRegion] = useCanvasState<"" | Exclude<Region, "all">>("screenMapReg2", "");
  const [, setImfFilter] = useCanvasState<string>("screenImfFilter2", "all");
  const [, setWbFilter] = useCanvasState<string>("screenWbFilter2", "all");
  const [vh, setVh] = useState(800);
  const [vw, setVw] = useState(1200);
  const [paneH, setPaneH] = useState(560);
  const mapPaneRef = useRef<HTMLDivElement | null>(null);

  const isRoster = screenTab === "roster";
  const isMacro = screenTab === "macro";
  const isEco = screenTab === "eco";
  const ecoMode = isEco;

  const countEcoType = (t: InstitutionType) => {
    const nCredit = credits.filter((r) => r.institutionTypes.includes(t)).length;
    if (t !== "玩家") return nCredit;
    return nCredit + scenes.filter((r) => r.institutionTypes.includes("玩家")).length;
  };

  // 进入大屏默认：宏观 · 在贷余额 × 展业 · 全球（与 Pages 一致）
  useEffect(() => {
    setScreenTab("macro");
    setMacroSub("loanBook");
    setMapRegion("");
    setEcoType("");
    setEcoPickerOpen(false);
    setImfFilter("all");
    setWbFilter("all");
  }, [setScreenTab, setMacroSub, setMapRegion, setEcoType, setEcoPickerOpen, setImfFilter, setWbFilter]);

  useEffect(() => {
    const sync = () => {
      if (typeof window === "undefined") return;
      setVh(window.innerHeight);
      setVw(window.innerWidth);
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    if (!present) return;
    const el = mapPaneRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      setPaneH(Math.max(360, Math.round(vh * 0.78)));
      return;
    }
    const apply = () => {
      const h = Math.floor(el.clientHeight);
      if (h > 0) setPaneH(h);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [present, vh, isRoster]);

  useEffect(() => {
    if (!present) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPresent(false);
        if (typeof document !== "undefined" && document.fullscreenElement) {
          void document.exitFullscreen?.().catch(() => undefined);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [present, setPresent]);

  const enterPresent = () => {
    setPresent(true);
    const el = document.documentElement;
    const req = el.requestFullscreen?.bind(el);
    if (req) {
      try {
        void Promise.resolve(req()).catch(() => undefined);
      } catch {
        /* iframe 等环境可能拒绝浏览器全屏 */
      }
    }
  };

  const exitPresent = () => {
    setPresent(false);
    if (typeof document !== "undefined" && document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
    }
  };

  const clearEco = () => {
    setEcoType("");
    setEcoPickerOpen(false);
  };

  const goMacro = () => {
    clearEco();
    setScreenTab("macro");
  };

  const goRoster = () => {
    clearEco();
    setScreenTab("roster");
  };

  const toggleEcoMode = () => {
    if (screenTab === "eco") {
      clearEco();
      setScreenTab("macro");
      return;
    }
    setScreenTab("eco");
    setEcoPickerOpen(true);
  };

  const selectEcoType = (t: InstitutionType) => {
    if (ecoType === t) {
      clearEco();
      setScreenTab("macro");
      return;
    }
    setScreenTab("eco");
    setEcoType(t);
    setEcoPickerOpen(true);
  };

  const compactMap = vw < 1100;
  const normalMapH = compactMap
    ? Math.round(Math.min(Math.max(vh * 0.58, 560), 780))
    : 680;
  const mapH = present ? Math.max(400, paneH) : normalMapH;

  const showLoanBook = isMacro && macroSub === "loanBook";
  const showMacroFactor = isMacro && macroSub !== "loanBook";
  const factorLabel =
    macroSub === "loanBook"
      ? "在贷余额"
      : (MACRO_MAP_FACTORS.find((f) => f.id === macroSub)?.label ?? "");
  const regionLabel =
    mapRegion
      ? (BIG_SCREEN_MAP_REGIONS.find((r) => r.id === mapRegion)?.label ?? "")
      : "全球";

  const modeStatus = isRoster
    ? "非银名单"
    : isMacro
      ? `宏观 · ${factorLabel} × 展业 · ${regionLabel}`
      : isEco
        ? `机构 · ${ecoType ? INSTITUTION_TYPE_LABEL[ecoType] : "选类型"} · ${regionLabel}`
        : "地图";

  const layerTabs = (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "center",
        width: "100%",
        justifyContent: "space-between",
      }}
    >
      <ScreenSegTrack>
        <ScreenSegChip label="宏观" active={isMacro} onClick={goMacro} />
        <ScreenSegChip
          label={ecoType ? INSTITUTION_TYPE_LABEL[ecoType] : "机构"}
          active={ecoMode}
          clearable={ecoMode}
          onClick={toggleEcoMode}
        />
        <ScreenSegChip label="非银名单" active={isRoster} onClick={goRoster} />
      </ScreenSegTrack>
      <ScreenStatusPills
        items={[
          { label: "Atlas", tone: "accent" },
          { label: "Live", tone: "live" },
          { label: modeStatus },
        ]}
      />
    </div>
  );

  const regionChips = (
    <ScreenSegTrack>
      <ScreenSegChip label="全球" active={mapRegion === ""} onClick={() => setMapRegion("")} />
      {BIG_SCREEN_MAP_REGIONS.map((r) => (
        <ScreenSegChip
          key={r.id}
          label={r.label}
          active={mapRegion === r.id}
          clearable={mapRegion === r.id}
          onClick={() => setMapRegion(mapRegion === r.id ? "" : r.id)}
        />
      ))}
    </ScreenSegTrack>
  );

  const mapSubChrome = !isRoster ? (
    <div
      style={{
        minHeight: 36,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "flex-start",
        width: "100%",
        position: "relative",
      }}
    >
      {regionChips}
      {isMacro ? (
        <>
          <ScreenSegTrack>
            <ScreenSegChip
              label="在贷余额"
              active={macroSub === "loanBook"}
              onClick={() => setMacroSub("loanBook")}
            />
            {MACRO_MAP_FACTORS.map((f) => (
              <ScreenSegChip
                key={f.id}
                label={f.label}
                active={macroSub === f.id}
                onClick={() => setMacroSub(f.id)}
              />
            ))}
          </ScreenSegTrack>
          <ScreenImfWbFilterBar />
        </>
      ) : isEco ? (
        <ScreenSegTrack style={{ width: "100%" }}>
          {INST_BUCKET_ORDER.flatMap((bucket) =>
            INST_BUCKET_TYPES[bucket].map((t) => (
              <ScreenSegChip
                key={t}
                label={`${INSTITUTION_TYPE_LABEL[t]} · ${countEcoType(t)}`}
                active={ecoType === t}
                clearable
                onClick={() => selectEcoType(t)}
              />
            )),
          )}
        </ScreenSegTrack>
      ) : null}
    </div>
  ) : null;

  const mapPane = isRoster ? null : showMacroFactor ? (
    <BigScreenMacro
      key={`macro-${macroSub}-${mapRegion || "world"}`}
      height={mapH}
      bare={present}
      factor={macroSub as MacroMapFactorId}
      showInvested
      present={present}
      onPresent={enterPresent}
      onExit={exitPresent}
      mapRegion={mapRegion}
    />
  ) : (
    <BigScreenOverlay
      key={`mkt-${showLoanBook ? 1 : 0}-1-${isEco ? ecoType || "eco" : "none"}-${mapRegion || "world"}`}
      height={mapH}
      bare={present}
      present={present}
      onPresent={enterPresent}
      onExit={exitPresent}
      showMarket={showLoanBook}
      showInvested
      ecoType={isEco ? ecoType : ""}
      mapRegion={mapRegion}
    />
  );

  if (present) {
    const shell = (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          background: theme.bg.chrome,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingLeft: "env(safe-area-inset-left, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div
          aria-hidden
          style={{
            height: 2,
            flexShrink: 0,
            background: theme.accent.primary,
          }}
        />
        <div
          data-screen-chrome
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: "0 0 auto",
            position: "relative",
            zIndex: 100,
            padding: "12px 16px 10px",
            background: theme.bg.elevated,
            borderBottom: `1px solid ${theme.stroke.secondary}`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            pointerEvents: "auto",
            isolation: "isolate",
          }}
        >
          {layerTabs}
          {mapSubChrome}
        </div>
        {isRoster ? (
          <div style={{ flex: 1, overflow: "auto", padding: "12px 16px 16px", position: "relative", zIndex: 1 }}>
            <NbfcStatsSubpage />
          </div>
        ) : (
          <div
            ref={mapPaneRef}
            style={{
              flex: 1,
              minHeight: 0,
              position: "relative",
              zIndex: 1,
              padding: "10px 14px 14px",
              isolation: "isolate",
              background: theme.bg.chrome,
            }}
          >
            {mapPane}
          </div>
        )}
      </div>
    );
    return typeof document !== "undefined" ? createPortal(shell, document.body) : shell;
  }

  return (
    <Stack gap={16} style={{ flexShrink: 0 }}>
      <Stack gap={10} style={{ flexShrink: 0 }}>
        {layerTabs}
        {mapSubChrome}
      </Stack>
      {isRoster ? (
        <NbfcStatsSubpage />
      ) : (
        <div
          style={{
            width: "100%",
            flexShrink: 0,
          }}
        >
          {mapPane}
        </div>
      )}
    </Stack>
  );
}




export default function Canvas() {
  type AtlasHub = "home" | "scenes" | "macro" | "compare" | "sources" | InstitutionType;
  const [appTab, setAppTab] = useCanvasState<AppTab>("appTab1", "crm");
  const [hub, setHub] = useCanvasState<AtlasHub>("hub7", "home");
  const [sourceReturnHub, setSourceReturnHub] = useCanvasState<string>("sourceCiteReturnHub", "");
  const [, setSourceFocus] = useCanvasState<string>("sourceCiteFocus", "");
  // 视角切换已隐藏；后台用户角色接上前固定客户经理（避免本地曾选路演后无法切回）
  const atlasRole: AtlasRole = "am";
  const isInstHub =
    hub !== "home" &&
    hub !== "scenes" &&
    hub !== "macro" &&
    hub !== "compare" &&
    hub !== "sources";
  const [ecoNavOpen, setEcoNavOpen] = useCanvasState("ecoNavOpen1", "");
  /** 情报：快讯 | 研报 | 上市公司 */
  const [intelLane, setIntelLane] = useCanvasState<"flash" | "research" | "stocks">(
    "intelLane1",
    "flash",
  );
  const [, setStockFocus] = useCanvasState<string>("fintechStockFocus1", "");
  /** 生态机构与数字经济 / 国别宏观互斥，不可同时点亮 */
  const ecoNavExpanded =
    (ecoNavOpen === "1" || isInstHub) && hub !== "scenes" && hub !== "macro";
  const ecoTypeCount = INST_BUCKET_ORDER.reduce((n, b) => n + INST_BUCKET_TYPES[b].length, 0);
  const [region, setRegion] = useCanvasState<Region>("region5", "all");
  const [langZone, setLangZone] = useCanvasState<LangZoneFilter>("langZone1", "all");
  const [country, setCountry] = useCanvasState<CountryCode>("country8", "all");
  const [primary, setPrimary] = useCanvasState<Primary>("primary7", "all");
  const [creditL1, setCreditL1] = useCanvasState<CreditProdL1>("credL1a", "all");
  const [creditL2, setCreditL2] = useCanvasState<CreditProdL2>("credL2a", "all");
  const [creditL3, setCreditL3] = useCanvasState<CreditProdL3>("credL3a", "all");
  const [sceneTag, setSceneTag] = useCanvasState<SceneTag | "all">("sceneTag4", "all");
  const [sceneSub, setSceneSub] = useCanvasState<SceneSubTag | "all">("sceneSub3", "all");
  const [licenseKind, setLicenseKind] = useCanvasState<LicenseKind | "all">("license4", "all");
  const [fundKind, setFundKind] = useCanvasState<FundParticipationKind | "all">("fundKind5", "all");
  const [trafficKind, setTrafficKind] = useCanvasState<TrafficServiceKind | "all">("trafficKind2", "all");
  const [paymentKind, setPaymentKind] = useCanvasState<PaymentKind | "all">("paymentKind1", "all");
  const [equityKind, setEquityKind] = useCanvasState<EquityInvestorKind | "all">("equityKind1", "all");
  const [regLicenseId, setRegLicenseId] = useCanvasState<string>("regLic3", "all");
  /** 玩家列表：按 GP Finance 借贷榜名次排序（需先选具体国家） */
  const [storeRankSort, setStoreRankSort] = useCanvasState<StoreRankSortMode>("storeRankSort1", "off");
  const [keywordSaved, setKeywordSaved] = useCanvasState("kw1", "");
  const searchDraft = getSearchDraft();
  // 重建后回填 draft；受控展示取两侧较长者（与登录框同口径）
  if (keywordSaved && !searchDraft.q) searchDraft.q = keywordSaved;
  const keyword = pickLoginValue(keywordSaved, searchDraft.q);
  function setKeyword(v: string) {
    searchDraft.q = v;
    // 必须即时 setState：仅写 draft 不重渲染，受控 Composer 会吞字（「录不进去」）
    setKeywordSaved(v);
  }
  const [createdPlayers, setCreatedPlayers] = useCanvasState<CreditDraft[]>("createdPlayers1", EMPTY_CREDIT_DRAFTS);

  const showScene = primary === "all" || primary === "scene";
  const showCredit = primary === "all" || primary === "credit";
  const kw = keyword.trim();

  const liveCredits = dedupeCreditRows([
    ...credits,
    ...createdPlayers.map((d) => finalizeCredit(d)),
  ]);

  // 总览/场景/宏观页不跑玩家大表过滤，降低重渲染成本（大画布滚动时宿主易重挂）
  const needPlayerLists = hub === "玩家" || (hub === "home" && Boolean(kw));
  const sceneRows = needPlayerLists
    ? filterScenes(region, country, sceneTag, sceneSub, licenseKind, langZone).filter((r) =>
        sceneMatchesKeyword(r, kw),
      )
    : [];
  const creditRows = needPlayerLists
    ? filterCredits(
        region,
        country,
        creditL1,
        creditL2,
        creditL3,
        sceneTag,
        licenseKind,
        langZone,
      )
        .filter((r) => r.institutionTypes.includes("玩家"))
        .filter((r) => creditMatchesKeyword(r, kw))
    : [];
  // filterCredits 基于静态 credits；人工创设需并入
  const creditRowsLive = needPlayerLists
    ? dedupeCreditRows([
        ...creditRows,
        ...liveCredits.filter((r) => {
          if (!r.institutionTypes.includes("玩家")) return false;
          if (!creditMatchesKeyword(r, kw)) return false;
          if (region !== "all" && r.region !== region) return false;
          if (!matchesLanguageZoneFilter(r.group, r.countries, langZone)) return false;
          if (!matchesCountryFilter(r.group, r.countries, country)) return false;
          if (!matchesCreditProductTree(r, creditL1, creditL2, creditL3)) return false;
          if (licenseKind !== "all" && !r.licenseKinds.includes(licenseKind)) return false;
          return !creditRows.some((x) => x.group === r.group);
        }),
      ])
    : [];
  const creditProdLabel = creditProductFilterLabel(creditL1, creditL2, creditL3);

  const storeRankCountry = countryFilterSingle(country);
  const sceneRowsSorted =
    storeRankSort === "off" || !storeRankCountry || primary !== "credit"
      ? sceneRows
      : sceneRows.slice().sort((a, b) =>
          compareByStoreRank(
            storeRankCountry,
            `${a.group} ${a.apps} ${a.trafficRank} ${a.diandian}`,
            `${b.group} ${b.apps} ${b.trafficRank} ${b.diandian}`,
            storeRankSort,
            undefined,
            a.group,
            b.group,
          ),
        );
  const creditRowsSorted = (() => {
    const base =
      storeRankSort === "off" || !storeRankCountry || primary !== "credit"
        ? creditRowsLive.slice()
        : creditRowsLive.slice().sort((a, b) =>
            compareByStoreRank(
              storeRankCountry,
              `${a.group} ${a.brands} ${a.trafficRank} ${a.diandian}`,
              `${b.group} ${b.brands} ${a.trafficRank} ${a.diandian}`,
              storeRankSort,
              undefined,
              a.group,
              b.group,
            ),
          );
    if (!kw.trim()) return base;
    return base.sort(
      (a, b) =>
        keywordRelevanceRank(kw, a.group, a.brands, a.controller, a.note, a.licenseReg) -
        keywordRelevanceRank(kw, b.group, b.brands, b.controller, b.note, b.licenseReg),
    );
  })();
  const storeRankCoverage = storeRankCountry
    ? countRanksForCountry(storeRankCountry)
    : STORE_RANK_FINANCE.entries.length;
  const storeRankHitScene = storeRankCountry && storeRankSort !== "off"
    ? sceneRowsSorted.filter(
        (r) =>
          lookupStoreRank({
            country: storeRankCountry,
            text: `${r.group} ${r.apps} ${r.trafficRank} ${r.diandian}`,
            group: r.group,
          }) != null,
      ).length
    : 0;
  const storeRankHitCredit = storeRankCountry && storeRankSort !== "off"
    ? creditRowsSorted.filter(
        (r) =>
          lookupStoreRank({
            country: storeRankCountry,
            text: `${r.group} ${r.brands} ${r.trafficRank} ${r.diandian}`,
            group: r.group,
          }) != null,
      ).length
    : 0;

  const nSceneNative = scenes.length;
  const nFinanceNative = liveCredits.filter((r) => r.institutionTypes.includes("玩家")).length;

  function countInstitutionType(t: InstitutionType): number {
    if (t === "玩家") return nSceneNative + nFinanceNative;
    return credits.filter((r) => r.institutionTypes.includes(t)).length;
  }

  const regLicenseOptions = licensesForGeo(region, country, licenseKind);
  const activeRegLicense =
    regLicenseId === "all" ? null : (REGULATORY_LICENSE_CATALOG.find((l) => l.id === regLicenseId) ?? null);

  const ecoRows =
    isInstHub && hub !== "玩家"
      ? credits
          .filter((r) => {
            const inst = hub as InstitutionType;
            if (!r.institutionTypes.includes(inst)) return false;
            if (inst === "资金参与机构" && fundKind !== "all" && !r.fundKinds.includes(fundKind)) {
              return false;
            }
            if (inst === "流量服务商" && trafficKind !== "all" && !r.trafficKinds.includes(trafficKind)) {
              return false;
            }
            if (inst === "支付服务机构" && paymentKind !== "all" && !r.paymentKinds.includes(paymentKind)) {
              return false;
            }
            if (inst === "股权投资人" && equityKind !== "all" && !r.equityKinds.includes(equityKind)) {
              return false;
            }
            if (isGeoScopedEcoType(inst)) {
              if (region !== "all" && r.region !== region && !hasWorldwideCoverage(r.countries)) {
                return false;
              }
              if (!matchesLanguageZoneFilter(r.group, r.countries, langZone)) return false;
              if (!matchesCountryFilter(r.group, r.countries, country)) return false;
            }
            if (inst === "监管") {
              if (licenseKind !== "all" && !regulatorMatchesLicenseKind(r, licenseKind)) return false;
              if (activeRegLicense && !regulatorMatchesLicense(r, activeRegLicense)) return false;
            }
            // 机构类型浏览不受顶栏搜索词过滤（搜「快牛」再点流量服务商会误成 0 家）；关键词检索只在总览搜索结果里做
            return true;
          })
          .slice()
          .sort((a, b) => {
            // 流量服务商·全部：按细分顺序，流量平台优先
            if (hub === "流量服务商" && trafficKind === "all") {
              const rank = (r: CreditRow) => {
                const idx = TRAFFIC_KIND_ORDER.findIndex((k) => r.trafficKinds.includes(k));
                return idx === -1 ? TRAFFIC_KIND_ORDER.length : idx;
              };
              const d = rank(a) - rank(b);
              if (d !== 0) return d;
            }
            if (hub === "支付服务机构" && paymentKind === "all") {
              const rank = (r: CreditRow) => {
                const idx = PAYMENT_KIND_ORDER.findIndex((k) => r.paymentKinds.includes(k));
                return idx === -1 ? PAYMENT_KIND_ORDER.length : idx;
              };
              const d = rank(a) - rank(b);
              if (d !== 0) return d;
            }
            if (hub === "股权投资人" && equityKind === "all") {
              const rank = (r: CreditRow) => {
                const idx = EQUITY_KIND_ORDER.findIndex((k) => r.equityKinds.includes(k));
                return idx === -1 ? EQUITY_KIND_ORDER.length : idx;
              };
              const d = rank(a) - rank(b);
              if (d !== 0) return d;
            }
            return 0;
          })
      : [];

  /** 反向映射用池：不受洲际/国家筛选，只看该机构类型（及资金细分）全量覆盖 */
  const hubGeoCoverage = (() => {
    if (hub === "home" || hub === "scenes" || hub === "macro" || hub === "sources") {
      return collectGeoCoverage([]);
    }
    if (hub === "玩家") {
      const sceneBits = scenes.map((r) => ({
        region: r.region,
        countries: countriesCoveredBySceneRow(r),
      }));
      const creditBits = liveCredits
        .filter((r) => r.institutionTypes.includes("玩家"))
        .map((r) => ({
          region: r.region,
          countries: countriesCoveredByCreditRow(r),
        }));
      return collectGeoCoverage([...sceneBits, ...creditBits]);
    }
    const pool = credits.filter((r) => {
      const inst = hub as InstitutionType;
      if (!r.institutionTypes.includes(inst)) return false;
      if (inst === "资金参与机构" && fundKind !== "all" && !r.fundKinds.includes(fundKind)) {
        return false;
      }
      if (inst === "流量服务商" && trafficKind !== "all" && !r.trafficKinds.includes(trafficKind)) {
        return false;
      }
      if (inst === "支付服务机构" && paymentKind !== "all" && !r.paymentKinds.includes(paymentKind)) {
        return false;
      }
      if (inst === "股权投资人" && equityKind !== "all" && !r.equityKinds.includes(equityKind)) {
        return false;
      }
      return true;
    });
    return collectGeoCoverage(
      pool.map((r) => ({
        region: r.region,
        countries: countriesCoveredByCreditRow(r),
      })),
    );
  })();

  const searchSceneHits = kw
    ? scenes
        .filter((r) => sceneMatchesKeyword(r, kw))
        .slice()
        .sort(
          (a, b) =>
            keywordRelevanceRank(kw, a.group, a.apps, a.controller) -
            keywordRelevanceRank(kw, b.group, b.apps, b.controller),
        )
        .slice(0, 40)
    : [];
  const searchCreditHits = kw
    ? collapseCreditHitsByBrandFamily(
        credits
          .filter((r) => r.institutionTypes.includes("玩家") && creditMatchesKeyword(r, kw))
          .slice()
          .sort(
            (a, b) =>
              keywordRelevanceRank(kw, a.group, a.brands, a.controller, a.note) -
              keywordRelevanceRank(kw, b.group, b.brands, b.controller, b.note),
          ),
        kw,
      ).slice(0, 40)
    : [];
  const searchEcoHits = kw
    ? credits
        .filter((r) => !r.institutionTypes.includes("玩家") && creditMatchesKeyword(r, kw))
        .slice()
        .sort(
          (a, b) =>
            keywordRelevanceRank(kw, a.group, a.brands, a.controller, a.note) -
            keywordRelevanceRank(kw, b.group, b.brands, b.controller, b.note),
        )
        .slice(0, 40)
    : [];
  const searchMacroHits = kw
    ? (Object.keys(COUNTRY_MACRO) as Exclude<CountryCode, "all">[])
        .filter((code) => macroCountryMatchesKeyword(code, kw))
        .slice(0, 40)
    : [];
  const searchHitCount =
    searchSceneHits.length +
    searchCreditHits.length +
    searchEcoHits.length +
    searchMacroHits.length;
  /** 搜索块顺序：谁更贴关键词谁在前（快牛等信贷原生不应被场景块压在下面） */
  const searchSceneBest = searchSceneHits.length
    ? Math.min(
        ...searchSceneHits.map((r) => keywordRelevanceRank(kw, r.group, r.apps, r.controller)),
      )
    : 99;
  const searchCreditBest = searchCreditHits.length
    ? Math.min(
        ...searchCreditHits.map((r) =>
          keywordRelevanceRank(kw, r.group, r.brands, r.controller, r.note),
        ),
      )
    : 99;
  const searchCreditBeforeScene = searchCreditBest < searchSceneBest;

  const regLicenseHolders = activeRegLicense
    ? [
        ...scenes.filter((r) => playerHoldsLicense(r, activeRegLicense)),
        ...credits.filter(
          (r) => r.institutionTypes.includes("玩家") && playerHoldsLicense(r, activeRegLicense),
        ),
      ]
    : [];

  function countFundKind(k: FundParticipationKind): number {
    return credits.filter(
      (r) => r.institutionTypes.includes("资金参与机构") && r.fundKinds.includes(k),
    ).length;
  }
  function countEquityKind(k: EquityInvestorKind): number {
    return credits.filter(
      (r) => r.institutionTypes.includes("股权投资人") && r.equityKinds.includes(k),
    ).length;
  }

  function countTrafficKind(k: TrafficServiceKind): number {
    return credits.filter((r) => {
      if (!r.institutionTypes.includes("流量服务商") || !r.trafficKinds.includes(k)) return false;
      if (region !== "all" && r.region !== region && !hasWorldwideCoverage(r.countries)) return false;
      if (!matchesLanguageZoneFilter(r.group, r.countries, langZone)) return false;
      if (!matchesCountryFilter(r.group, r.countries, country)) return false;
      return true;
    }).length;
  }

  function countPaymentKind(k: PaymentKind): number {
    return credits.filter((r) => {
      if (!r.institutionTypes.includes("支付服务机构") || !r.paymentKinds.includes(k)) return false;
      if (region !== "all" && r.region !== region && !hasWorldwideCoverage(r.countries)) return false;
      if (!matchesLanguageZoneFilter(r.group, r.countries, langZone)) return false;
      if (!matchesCountryFilter(r.group, r.countries, country)) return false;
      return true;
    }).length;
  }

  const [authSession] = useCanvasState("authSession1", "");
  const guestNoCite = !canViewSourceCite(authSession);

  useEffect(() => {
    ensureAtlasScrollMem();
    getAtlasScrollMem().shell = null;
  }, []);

  useEffect(() => {
    if (!guestNoCite) return;
    if (hub === "sources") {
      setHub("home");
      setSourceReturnHub("");
      setSourceFocus("");
    }
  }, [guestNoCite, hub, setHub, setSourceReturnHub, setSourceFocus]);

  if (!authSession) {
    return <LoginPage />;
  }

  if (appTab === "screen") {
    return (
      <AtlasSideRail>
        <Stack gap={16} style={{ flexShrink: 0, overflow: "visible" }}>
          <SessionChrome
            trailing={<MapScreenButton active onClick={() => setAppTab("crm")} />}
          />
          <BigScreen />
        </Stack>
      </AtlasSideRail>
    );
  }

  return (
    <AtlasSideRail>
      <AtlasStickyChrome>
      <Stack gap={16}>
      <SessionChrome
        trailing={<MapScreenButton active={false} onClick={() => setAppTab("screen")} />}
      />

      <Row gap={8} align="start">
        <div style={{ flex: 1, minWidth: 0 }}>
          <CursorStyleComposer
            value={keyword}
            onChange={setKeyword}
            sideSlot={
              <>
                <SideHubButton
                  active={hub === "compare"}
                  title="对照"
                  label="对照"
                  icon={<IconCompare />}
                  onClick={() => setHub(hub === "compare" ? "home" : "compare")}
                />
                {!guestNoCite ? (
                  <SideHubButton
                    active={hub === "sources"}
                    title="信源"
                    label="信源"
                    icon={<IconSourceCite />}
                    onClick={() => {
                      if (hub === "sources") {
                        const target =
                          sourceReturnHub && sourceReturnHub !== "sources"
                            ? (sourceReturnHub as AtlasHub)
                            : "home";
                        setHub(target);
                        setSourceReturnHub("");
                        setSourceFocus("");
                      } else {
                        setSourceReturnHub(hub);
                        setHub("sources");
                      }
                    }}
                  />
                ) : null}
              </>
            }
            onSubmit={({ text, attachments }) => {
              const draft = draftFromComposerCreate(text, attachments);
              if (draft) {
                const key = creditBrandKey(draft.group);
                const exists =
                  liveCredits.some((r) => creditBrandKey(r.group) === key) ||
                  createdPlayers.some((d) => creditBrandKey(d.group) === key);
                if (exists) {
                  setKeyword(draft.brands);
                  setHub("玩家");
                  setPrimary("credit");
                  return `已存在相近玩家「${draft.brands}」，已跳转名单并检索`;
                }
                setCreatedPlayers((prev) => [draft, ...prev].slice(0, 50));
                setKeyword(draft.brands);
                setHub("玩家");
                setPrimary("credit");
                return `已创设玩家「${draft.brands}」，已进入信贷原生名单`;
              }
              const q = text.trim();
              if (!q && !attachments.length) {
                return "输入关键词检索，或写「创设…玩家名」建档";
              }
              if (!q && attachments.length) {
                return `已附带 ${attachments.length} 项材料；请补充「创设…玩家名」后发送建档`;
              }
              setHub("home");
              return `检索：${q}`;
            }}
          />
        </div>
      </Row>

      <Stack gap={8}>
        <Row gap={6} wrap align="center">
          <FilterChip
            label="快讯"
            active={hub === "home" && !ecoNavExpanded && intelLane === "flash"}
            onClick={() => {
              setEcoNavOpen("");
              setIntelLane("flash");
              setHub("home");
            }}
          />
          <FilterChip
            label="研报"
            active={hub === "home" && !ecoNavExpanded && intelLane === "research"}
            onClick={() => {
              setEcoNavOpen("");
              setIntelLane("research");
              setHub("home");
            }}
          />
          <FilterChip
            label={`上市公司 ${FINTECH_STOCK_QUOTES.stats?.total ?? FINTECH_STOCK_QUOTES.items.length}`}
            active={hub === "home" && !ecoNavExpanded && intelLane === "stocks"}
            onClick={() => {
              setEcoNavOpen("");
              setIntelLane("stocks");
              setHub("home");
            }}
          />
          <FilterChip
            label={`国别宏观 ${Object.keys(COUNTRY_MACRO).length}`}
            active={hub === "macro"}
            clearable
            onClick={() => setHub(hub === "macro" ? "home" : "macro")}
          />
          <FilterChip
            label={`数字经济 ${SCENE_WIDE_TABLE.length + WEB3_SCENE_WIDE_TABLE.length}`}
            active={hub === "scenes"}
            clearable
            onClick={() => {
              setEcoNavOpen("");
              setHub(hub === "scenes" ? "home" : "scenes");
            }}
          />
          <FilterChip
            label={`生态机构 ${ecoTypeCount}`}
            active={ecoNavExpanded}
            clearable
            onClick={() => {
              if (isInstHub) {
                setHub("home");
                setEcoNavOpen("");
                return;
              }
              if (ecoNavExpanded) {
                setEcoNavOpen("");
                return;
              }
              if (hub === "scenes") setHub("home");
              setEcoNavOpen("1");
            }}
          />
        </Row>
        {ecoNavExpanded ? (
          <Stack gap={6}>
            {INST_BUCKET_ORDER.map((bucket) => (
              <Row key={bucket} gap={8} align="center" wrap>
                <Text
                  size="small"
                  tone="tertiary"
                  weight="medium"
                  style={{
                    flex: "0 0 auto",
                    minWidth: 72,
                    maxWidth: 108,
                    lineHeight: 1.2,
                  }}
                >
                  {INST_BUCKET_LABEL[bucket]}
                </Text>
                <Row gap={6} wrap style={{ flex: 1, minWidth: 0 }}>
                  {INST_BUCKET_TYPES[bucket].map((t) => (
                    <FilterChip
                      key={t}
                      label={`${INSTITUTION_TYPE_LABEL[t]} ${countInstitutionType(t)}`}
                      active={hub === t}
                      clearable
                      onClick={() => setHub(hub === t ? "home" : t)}
                    />
                  ))}
                </Row>
              </Row>
            ))}
          </Stack>
        ) : null}
      </Stack>
      </Stack>
      </AtlasStickyChrome>

      <Stack gap={0} style={{ overflowAnchor: "none", overflow: "visible", flexShrink: 0 }}>

      {hub === "home" ? (
        <Stack gap={16} style={{ paddingTop: kw || ecoNavExpanded ? 12 : 0 }}>
          {kw ? (
            <Stack gap={12}>
              <H2>搜索结果 · {searchHitCount}</H2>
              {searchCreditBeforeScene ? (
                <>
                  {searchCreditHits.length ? (
                    <Stack gap={8}>
                      <Text weight="medium">信贷原生</Text>
                      {searchCreditHits.map((r) => (
                        <CreditPlayer r={r} />
                      ))}
                    </Stack>
                  ) : null}
                  {searchSceneHits.length ? (
                    <Stack gap={8}>
                      <Text weight="medium">场景原生</Text>
                      {searchSceneHits.map((r) => (
                        <ScenePlayer r={r} />
                      ))}
                    </Stack>
                  ) : null}
                </>
              ) : (
                <>
                  {searchSceneHits.length ? (
                    <Stack gap={8}>
                      <Text weight="medium">场景原生</Text>
                      {searchSceneHits.map((r) => (
                        <ScenePlayer r={r} />
                      ))}
                    </Stack>
                  ) : null}
                  {searchCreditHits.length ? (
                    <Stack gap={8}>
                      <Text weight="medium">信贷原生</Text>
                      {searchCreditHits.map((r) => (
                        <CreditPlayer r={r} />
                      ))}
                    </Stack>
                  ) : null}
                </>
              )}
              {searchEcoHits.length ? (
                <Stack gap={8}>
                  <Text weight="medium">生态机构</Text>
                  {searchEcoHits.map((r) => (
                    <CreditPlayer r={r} />
                  ))}
                </Stack>
              ) : null}
              {searchMacroHits.length ? (
                <Stack gap={8}>
                  <Text weight="medium">国别宏观</Text>
                  <Row gap={6} wrap>
                    {searchMacroHits.map((code) => (
                      <FilterChip
                        key={code}
                        label={COUNTRY_LABEL[code]}
                        active={false}
                        onClick={() => {
                          setHub("macro");
                          const reg = regionForCountry(code);
                          if (reg) setRegion(reg);
                          setCountry(code);
                        }}
                      />
                    ))}
                  </Row>
                </Stack>
              ) : null}
              {!searchHitCount ? (
                <Callout tone="neutral">未找到匹配机构或国别。可换关键词，或点 + 导入创设材料。</Callout>
              ) : null}
              <Divider />
            </Stack>
          ) : null}

          {!ecoNavExpanded ? (
            intelLane === "flash" ? (
              <MorningBriefHome
                role={atlasRole}
                onOpenStocks={() => {
                  setStockFocus("");
                  setIntelLane("stocks");
                }}
                onOpenStock={(id) => {
                  setStockFocus(id);
                  setIntelLane("stocks");
                }}
              />
            ) : intelLane === "stocks" ? (
              <FintechStockWatchPanel />
            ) : atlasRole !== "roadshow" ? (
              <ResearchLibraryHomePanel />
            ) : (
              <HomeMeta>路演视角不展示研报明细。</HomeMeta>
            )
          ) : null}
        </Stack>
      ) : null}

      {hub === "sources" && !guestNoCite ? (
        <Stack gap={16} style={{ paddingTop: 12 }}>
          <SourceCatalogPanel />
        </Stack>
      ) : null}

      {hub === "scenes" ? <DigitalSceneAtlasBrowse /> : null}

      {hub === "macro" ? (
        <Stack gap={0}>
          <AtlasStickySub compact>
            <Stack gap={4}>
              <Row gap={6} align="center" wrap>
                <Text size="small" weight="medium" style={{ flex: "0 0 auto" }}>
                  国别宏观
                </Text>
                <Row gap={4} wrap style={{ flex: 1, minWidth: 0 }}>
                  {(Object.keys(REGION_LABEL) as Region[]).map((k) => (
                    <FilterChip
                      label={REGION_LABEL[k]}
                      active={region === k}
                      clearable={k !== "all"}
                      onClick={() => {
                        const next = region === k && k !== "all" ? "all" : k;
                        setRegion(next);
                        if (!countryInRegion(country, next)) setCountry("all");
                        if (!langZoneInRegion(langZone, next)) setLangZone("all");
                      }}
                    />
                  ))}
                </Row>
              </Row>
              <Row gap={12} align="start" wrap>
                <div style={{ flex: "1 1 140px", minWidth: 120 }}>
                  <SoftFold
                    title="语言区"
                    summary={langZone === "all" ? undefined : langZone}
                    count={languageZonesForRegion(region).length}
                    defaultOpen={false}
                  >
                    <Row gap={4} wrap>
                      <FilterChip
                        label="全部语言区"
                        active={langZone === "all"}
                        onClick={() => setLangZone("all")}
                      />
                      {languageZonesForRegion(region).map((z) => (
                        <FilterChip
                          label={z}
                          active={langZone === z}
                          clearable
                          onClick={() => {
                            const next = langZone === z ? "all" : z;
                            setLangZone(next);
                            if (next !== "all") {
                              const allow = new Set(countriesInLanguageZone(next));
                              if (country !== "all" && !allow.has(country as string)) setCountry("all");
                            }
                          }}
                        />
                      ))}
                    </Row>
                  </SoftFold>
                </div>
                <div style={{ flex: "1 1 180px", minWidth: 140 }}>
                  <SoftFold
                    title="国家/地区"
                    summary={country === "all" ? undefined : COUNTRY_LABEL[country]}
                    count={Math.max(0, countriesForRegionAndLang(region, langZone).length - 1)}
                    defaultOpen={false}
                  >
                    <Row gap={4} wrap>
                      {countriesForRegionAndLang(region, langZone).map((k) => (
                        <FilterChip
                          label={COUNTRY_LABEL[k]}
                          active={country === k}
                          clearable={k !== "all"}
                          onClick={() => setCountry(country === k && k !== "all" ? "all" : k)}
                        />
                      ))}
                    </Row>
                  </SoftFold>
                </div>
              </Row>
            </Stack>
          </AtlasStickySub>
          <Stack gap={16} style={{ paddingTop: 8 }}>
            <CountryMacroPanel country={country} />
            {country === "all" ? <MacroFactorFrameworkOverview /> : null}
          </Stack>
        </Stack>
      ) : null}

      {hub === "compare" ? (
        <Stack gap={16}>
          <H2>对照</H2>
          <Text size="small" tone="tertiary">
            国别宏观、玩家及其它机构均可多选并排对照（最多 6 个）。
          </Text>
          <CompareHubPanel />
        </Stack>
      ) : null}


      {hub === "玩家" ? (
        <Stack gap={16}>
          <H2>玩家</H2>
          <Grid columns={2} gap={12}>
            <Stat value={String(nSceneNative)} label="场景原生" />
            <Stat value={String(nFinanceNative)} label="信贷原生" />
          </Grid>

          <Stack gap={10}>
            <Stack gap={4}>
              <Text size="small" weight="medium">
                涉足洲际
              </Text>
              <Row gap={6} wrap>
                {(Object.keys(REGION_LABEL) as Region[]).map((k) => (
                  <FilterChip
                    label={REGION_LABEL[k]}
                    active={region === k}
                    clearable={k !== "all"}
                    onClick={() => {
                      const next = region === k && k !== "all" ? "all" : k;
                      setRegion(next);
                      if (!countryInRegion(country, next)) setCountry("all");
                      if (!langZoneInRegion(langZone, next)) setLangZone("all");
                    }}
                  />
                ))}
              </Row>
            </Stack>

            <SoftFold
              title="语言区"
              hint={langZone === "all" ? "按展业语言区收窄；选项随洲际变化" : `已选 ${langZone}`}
              count={languageZonesForRegion(region).length}
              defaultOpen={langZone !== "all"}
            >
              <Text size="small" tone="tertiary">
                按展业语言区收窄；选项随洲际变化
              </Text>
              <Row gap={6} wrap>
                <FilterChip
                  label="全部语言区"
                  active={langZone === "all"}
                  onClick={() => setLangZone("all")}
                />
                {languageZonesForRegion(region).map((z) => (
                  <FilterChip
                    label={z}
                    active={langZone === z}
                    clearable
                    onClick={() => {
                      const next = langZone === z ? "all" : z;
                      setLangZone(next);
                      if (next !== "all") {
                        const allow = new Set(countriesInLanguageZone(next));
                        if (country !== "all" && !allow.has(country as string)) setCountry("all");
                      }
                    }}
                  />
                ))}
              </Row>
            </SoftFold>

            <SoftFold
              title="涉足国家/地区"
              hint={country === "all" ? "点选收窄；再点同一国取消" : `已选 ${COUNTRY_LABEL[country]}`}
              count={countriesForRegionAndLang(region, langZone).length}
              defaultOpen={country !== "all"}
            >
              <Row gap={6} wrap>
                {countriesForRegionAndLang(region, langZone).map((k) => (
                  <FilterChip
                    label={COUNTRY_LABEL[k]}
                    active={country === k}
                    clearable={k !== "all"}
                    onClick={() => setCountry(country === k && k !== "all" ? "all" : k)}
                  />
                ))}
              </Row>
            </SoftFold>

            <SoftFold
              title="原生路径"
              hint={
                primary === "all"
                  ? "选择「场景原生」或「信贷原生」后展开对应筛选项"
                  : primary === "scene"
                    ? "已选 场景原生"
                    : "已选 信贷原生"
              }
              defaultOpen={primary !== "all"}
            >
              <Row gap={6} wrap>
                {(
                  [
                    { value: "all" as Primary, label: "全部" },
                    { value: "scene" as Primary, label: "场景原生" },
                    { value: "credit" as Primary, label: "信贷原生" },
                  ] as const
                ).map((o) => (
                  <FilterChip
                    label={o.label}
                    active={primary === o.value}
                    clearable={o.value !== "all"}
                    onClick={() => {
                      const next =
                        primary === o.value && o.value !== "all" ? "all" : o.value;
                      setPrimary(next);
                      // 切换原生路径时清空对侧筛选项，避免隐藏态脏过滤
                      if (next !== "scene") {
                        setSceneTag("all");
                        setSceneSub("all");
                      }
                      if (next !== "credit") {
                        setCreditL1("all");
                        setCreditL2("all");
                        setCreditL3("all");
                      }
                    }}
                  />
                ))}
              </Row>
              {primary === "all" ? (
                <Text size="small" tone="secondary">
                  选择「场景原生」或「信贷原生」后，将展开对应的涉足场景 / 信贷产品筛选项
                </Text>
              ) : null}
            </SoftFold>

            {primary === "scene" ? (
              <Stack gap={4}>
                <Stack gap={4}>
                  <Text size="small" weight="medium">
                    涉足场景
                  </Text>
                  <Row gap={6} wrap>
                    <FilterChip
                      label="全部场景"
                      active={sceneTag === "all"}
                      onClick={() => {
                        setSceneTag("all");
                        setSceneSub("all");
                      }}
                    />
                    {SCENE_TAG_ORDER.map((t) => (
                      <FilterChip
                        label={SCENE_TAG_LABEL[t]}
                        active={sceneTag === t}
                        clearable
                        onClick={() => {
                          if (sceneTag === t) {
                            setSceneTag("all");
                            setSceneSub("all");
                          } else {
                            setSceneTag(t);
                            setSceneSub("all");
                          }
                        }}
                      />
                    ))}
                  </Row>
                </Stack>

                {sceneTag !== "all" && sceneSubsForTag(sceneTag).length > 0 ? (
                  <Stack gap={4}>
                    <Text size="small" weight="medium">
                      {SCENE_TAG_LABEL[sceneTag]}·二级
                    </Text>
                    <Row gap={6} wrap>
                      <FilterChip
                        label="全部二级"
                        active={sceneSub === "all"}
                        onClick={() => setSceneSub("all")}
                      />
                      {sceneSubsForTag(sceneTag).map((t) => (
                        <FilterChip
                          label={SCENE_SUB_LABEL[t]}
                          active={sceneSub === t}
                          clearable
                          onClick={() => setSceneSub(sceneSub === t ? "all" : t)}
                        />
                      ))}
                    </Row>
                  </Stack>
                ) : null}
              </Stack>
            ) : null}

            {primary === "credit" ? (
              <Stack gap={10}>
                <Stack gap={4}>
                  <Text size="small" weight="medium">
                    涉足信贷产品
                  </Text>
                  <Row gap={6} wrap>
                    <FilterChip
                      label="全部信贷产品"
                      active={creditL1 === "all"}
                      onClick={() => {
                        setCreditL1("all");
                        setCreditL2("all");
                        setCreditL3("all");
                      }}
                    />
                    {CREDIT_PROD_L1_ORDER.map((k) => (
                      <FilterChip
                        label={k}
                        active={creditL1 === k}
                        clearable
                        onClick={() => {
                          if (creditL1 === k) {
                            setCreditL1("all");
                            setCreditL2("all");
                            setCreditL3("all");
                          } else {
                            setCreditL1(k);
                            setCreditL2("all");
                            setCreditL3("all");
                          }
                        }}
                      />
                    ))}
                  </Row>
                </Stack>

                {creditL1 !== "all" && CREDIT_PROD_L2_BY_L1[creditL1].length > 0 ? (
                  <Stack gap={4}>
                    <Text size="small" weight="medium">
                      {creditL1}·二级
                    </Text>
                    <Row gap={6} wrap>
                      <FilterChip
                        label="全部二级"
                        active={creditL2 === "all"}
                        onClick={() => {
                          setCreditL2("all");
                          setCreditL3("all");
                        }}
                      />
                      {CREDIT_PROD_L2_BY_L1[creditL1].map((k) => (
                        <FilterChip
                          label={k}
                          active={creditL2 === k}
                          clearable
                          onClick={() => {
                            if (creditL2 === k) {
                              setCreditL2("all");
                              setCreditL3("all");
                            } else {
                              setCreditL2(k);
                              setCreditL3("all");
                            }
                          }}
                        />
                      ))}
                    </Row>
                  </Stack>
                ) : null}

                {creditL2 !== "all" && (CREDIT_PROD_L3_BY_L2[creditL2]?.length ?? 0) > 0 ? (
                  <Stack gap={4}>
                    <Text size="small" weight="medium">
                      {creditL2}·三级
                    </Text>
                    <Row gap={6} wrap>
                      <FilterChip
                        label="全部三级"
                        active={creditL3 === "all"}
                        onClick={() => setCreditL3("all")}
                      />
                      {(CREDIT_PROD_L3_BY_L2[creditL2] ?? []).map((k) => (
                        <FilterChip
                          label={k}
                          active={creditL3 === k}
                          clearable
                          onClick={() => setCreditL3(creditL3 === k ? "all" : k)}
                        />
                      ))}
                    </Row>
                  </Stack>
                ) : null}
              </Stack>
            ) : null}

            <SoftFold
              title="涉及金融牌照"
              hint={
                licenseKind === "all"
                  ? "按银行/保险/支付/消金等粗类收窄"
                  : `已选 ${LICENSE_KIND_LABEL[licenseKind]}`
              }
              count={LICENSE_KIND_ORDER.length}
              defaultOpen={licenseKind !== "all"}
            >
              <Row gap={6} wrap>
                <FilterChip
                  label="全部牌照粗类"
                  active={licenseKind === "all"}
                  onClick={() => setLicenseKind("all")}
                />
                {LICENSE_KIND_ORDER.map((k) => (
                  <FilterChip
                    label={LICENSE_KIND_LABEL[k]}
                    active={licenseKind === k}
                    clearable
                    onClick={() => setLicenseKind(licenseKind === k ? "all" : k)}
                  />
                ))}
              </Row>
            </SoftFold>

            {primary === "credit" && storeRankCountry ? (
              <Stack gap={6} style={{ minWidth: 240, maxWidth: 520 }}>
                <Text size="small" weight="medium">
                  商店榜排序 · Finance借贷
                </Text>
                <Select
                  value={storeRankSort}
                  onChange={(v) => setStoreRankSort(v as StoreRankSortMode)}
                  options={storeRankSortOptions()}
                />
                <Text size="small" tone="tertiary">
                  已选 {COUNTRY_LABEL[storeRankCountry]} · iOS Finance 入库 {storeRankCoverage} 条。命中信贷{" "}
                  {storeRankHitCredit} 家（未命中排末尾，不单独标注）。
                </Text>
              </Stack>
            ) : null}
          </Stack>

          <Divider />

          {(() => {
            const sceneBlock = showScene ? (
              <Stack gap={12}>
                <Row gap={8} align="center" wrap>
                  <H2>场景原生机构</H2>
                  <Pill tone="info">{REGION_LABEL[region]}</Pill>
                  {country !== "all" ? <Pill tone="info">{COUNTRY_LABEL[country]}</Pill> : null}
                  {sceneTag !== "all" ? <Pill tone="info">{SCENE_TAG_LABEL[sceneTag]}</Pill> : null}
                  {sceneSub !== "all" ? (
                    <Pill tone="neutral">
                      {SCENE_TAG_LABEL[SCENE_SUB_PARENT[sceneSub]]}/{SCENE_SUB_LABEL[sceneSub]}
                    </Pill>
                  ) : null}
                  {licenseKind !== "all" ? (
                    <Pill tone="success">{LICENSE_KIND_LABEL[licenseKind]}</Pill>
                  ) : null}
                  {primary === "credit" && storeRankSort !== "off" && storeRankCountry ? (
                    <Pill tone="warning">{`商店榜排序 · 命中 ${storeRankHitScene}`}</Pill>
                  ) : null}
                  <Text size="small" tone="secondary">
                    {sceneRowsSorted.length} 家 · 三项：规模(GMV) / 用户 / 增速(收入YoY)；点「详情」展开
                  </Text>
                </Row>
                <Stack gap={8}>
                  {sceneRowsSorted.map((r) => {
                    const hit =
                      storeRankCountry && storeRankSort !== "off" && primary === "credit"
                        ? lookupStoreRank({
                            country: storeRankCountry,
                            text: `${r.group} ${r.apps} ${r.trafficRank} ${r.diandian}`,
                            group: r.group,
                          })
                        : null;
                    return (
                      <ScenePlayer
                        key={`sc_${r.group}`}
                        r={r}
                        iosFinanceRank={hit?.rank}
                      />
                    );
                  })}
                </Stack>
              </Stack>
            ) : null;
            const creditBlock = showCredit ? (
              <Stack gap={12}>
                <Row gap={8} align="center" wrap>
                  <H2>信贷原生机构</H2>
                  <Pill tone="warning">{creditProdLabel}</Pill>
                  {sceneTag !== "all" ? <Pill tone="info">{SCENE_TAG_LABEL[sceneTag]}</Pill> : null}
                  {licenseKind !== "all" ? (
                    <Pill tone="success">{LICENSE_KIND_LABEL[licenseKind]}</Pill>
                  ) : null}
                  <Pill tone="info">{REGION_LABEL[region]}</Pill>
                  {country !== "all" ? <Pill tone="info">{COUNTRY_LABEL[country]}</Pill> : null}
                  {primary === "credit" && storeRankSort !== "off" && storeRankCountry ? (
                    <Pill tone="warning">{`商店榜排序 · 命中 ${storeRankHitCredit}`}</Pill>
                  ) : null}
                  <Text size="small" tone="secondary">
                    {creditRowsSorted.length} 家 · 三项：信贷规模 / 用户 / 增速；点「详情」展开
                  </Text>
                </Row>
                <Stack gap={8}>
                  {creditRowsSorted.map((r) => {
                    const hit =
                      storeRankCountry && storeRankSort !== "off" && primary === "credit"
                        ? lookupStoreRank({
                            country: storeRankCountry,
                            text: `${r.group} ${r.brands} ${r.trafficRank} ${r.diandian}`,
                            group: r.group,
                          })
                        : null;
                    return (
                      <CreditPlayer
                        key={`cr_${r.group}`}
                        r={r}
                        iosFinanceRank={hit?.rank}
                      />
                    );
                  })}
                </Stack>
              </Stack>
            ) : null;
            // 有关键词时：信贷原生命中更强（如快牛）则信贷块置顶；无关键词保持场景在前
            const playerCreditFirst =
              Boolean(kw.trim()) &&
              creditRowsSorted.length > 0 &&
              (sceneRowsSorted.length === 0 ||
                Math.min(
                  ...creditRowsSorted.map((r) =>
                    keywordRelevanceRank(kw, r.group, r.brands, r.controller, r.note),
                  ),
                ) <
                  Math.min(
                    ...sceneRowsSorted.map((r) =>
                      keywordRelevanceRank(kw, r.group, r.apps, r.controller),
                    ),
                  ));
            return playerCreditFirst ? (
              <>
                {creditBlock}
                {sceneBlock}
              </>
            ) : (
              <>
                {sceneBlock}
                {creditBlock}
              </>
            );
          })()}
        </Stack>
      ) : null}

      {isInstHub && hub !== "玩家" ? (
        <Stack gap={12}>
          <H2>{INSTITUTION_TYPE_LABEL[hub]}</H2>
          {kw ? (
            <Callout tone="warning">
              顶栏仍留着搜索「{kw}」，机构类型页已不按该词过滤名单（避免流量平台等被滤成 0 家）。
              关键词请回总览看搜索结果。
              <Row gap={8} style={{ marginTop: 8 }}>
                <Button variant="secondary" onClick={() => setKeyword("")}>
                  清除搜索词
                </Button>
              </Row>
            </Callout>
          ) : null}

          {hub === "监管" ? (
            <Stack gap={12}>
              <Text size="small" tone="secondary">
                市场定位：{INST_BUCKET_LABEL.监管与合规中介} · 先选洲际与具体国家，再选牌照粗类，当地法定牌照按选择展开
              </Text>

              <GeoAndLicenseFilters
                region={region}
                country={country}
                langZone={langZone}
                licenseKind={licenseKind}
                onRegion={(next) => {
                  setRegion(next);
                  if (!countryInRegion(country, next)) setCountry("all");
                  if (!langZoneInRegion(langZone, next)) setLangZone("all");
                  setRegLicenseId("all");
                }}
                onLangZone={(next) => {
                  setLangZone(next);
                  if (next !== "all") {
                    const allow = new Set(countriesInLanguageZone(next));
                    const cur = countryFilterSingle(country);
                    if (cur && !allow.has(cur)) setCountry("all");
                  }
                  setRegLicenseId("all");
                }}
                onCountry={(next) => {
                  setCountry(next);
                  setRegLicenseId("all");
                }}
                onLicenseKind={(next) => {
                  setLicenseKind(next);
                  setRegLicenseId("all");
                }}
              />

              <Stack gap={4}>
                <Text size="small" weight="medium">
                  当地法定牌照（监管对应）
                </Text>
                {country === "all" ? (
                  <Text size="small" tone="tertiary">
                    请先在上方点选具体国家/地区；可选牌照粗类进一步收窄。选中后再展示该地法定牌照对照。
                  </Text>
                ) : (
                  <>
                    <Row gap={6} wrap>
                      <FilterChip
                        label="全部法定牌照"
                        active={regLicenseId === "all"}
                        onClick={() => setRegLicenseId("all")}
                      />
                      {regLicenseOptions.map((lic) => (
                        <FilterChip
                          label={lic.name}
                          active={regLicenseId === lic.id}
                          clearable
                          onClick={() =>
                            setRegLicenseId(regLicenseId === lic.id ? "all" : lic.id)
                          }
                        />
                      ))}
                    </Row>
                    {regLicenseOptions.length === 0 ? (
                      <Text size="small" tone="tertiary">
                        {licenseKind === "all"
                          ? `「${COUNTRY_LABEL[country]}」暂未录入法定牌照对照表。`
                          : `「${COUNTRY_LABEL[country]}」在「${LICENSE_KIND_LABEL[licenseKind]}」下暂无对照条目，可改选「全部牌照粗类」。`}
                      </Text>
                    ) : (
                      <Text size="small" tone="secondary">
                        当前 · {COUNTRY_LABEL[country]}
                        {licenseKind !== "all"
                          ? ` · ${LICENSE_KIND_LABEL[licenseKind]}`
                          : ""}{" "}
                        · {regLicenseOptions.length} 项法定牌照
                      </Text>
                    )}
                  </>
                )}
              </Stack>

              <Row gap={8} align="center" wrap>
                <Pill tone="info">{REGION_LABEL[region]}</Pill>
                {country !== "all" ? <Pill tone="info">{COUNTRY_LABEL[country]}</Pill> : null}
                {licenseKind !== "all" ? (
                  <Pill tone="success">{LICENSE_KIND_LABEL[licenseKind]}</Pill>
                ) : null}
                {activeRegLicense ? (
                  <Pill tone="success">
                    {activeRegLicense.name}@{COUNTRY_LABEL[activeRegLicense.country]}
                  </Pill>
                ) : null}
                <Text size="small" tone="secondary">
                  监管主体 {ecoRows.length} 家
                  {activeRegLicense ? ` · 持牌玩家 ${regLicenseHolders.length} 家` : ""}
                </Text>
              </Row>

              <Divider />
              <Text size="small" weight="medium">
                监管主体
              </Text>
              <Stack gap={8}>
                {ecoRows.map((r) => (
                  <CreditPlayer r={r} />
                ))}
              </Stack>

              {activeRegLicense ? (
                <Stack gap={8}>
                  <Divider />
                  <Row gap={8} align="center" wrap>
                    <Text size="small" weight="medium">
                      持有「{activeRegLicense.name}@{COUNTRY_LABEL[activeRegLicense.country]}」的玩家
                    </Text>
                    <Text size="small" tone="secondary">
                      {regLicenseHolders.length} 家
                    </Text>
                  </Row>
                  {regLicenseHolders.length ? (
                    <Stack gap={8}>
                      {regLicenseHolders.map((r) =>
                        "sceneType" in r ? <ScenePlayer r={r} /> : <CreditPlayer r={r} />,
                      )}
                    </Stack>
                  ) : (
                    <Text size="small" tone="tertiary">
                      当前筛选下暂无已建档持牌玩家（可扩写 licenseReg 后再交叉）。
                    </Text>
                  )}
                </Stack>
              ) : null}
            </Stack>
          ) : hub === "流量服务商" ? (
            <Stack gap={12}>
              <Text size="small" tone="secondary">
                市场定位：{INST_BUCKET_LABEL[INST_TYPE_TO_BUCKET[hub as InstitutionType]]}
              </Text>
              <GeoAndLicenseFilters
                region={region}
                country={country}
                langZone={langZone}
                licenseKind={licenseKind}
                showLicenseKind={false}
                coveredRegions={hubGeoCoverage.regions}
                coveredCountries={hubGeoCoverage.countries}
                onRegion={(next) => {
                  setRegion(next);
                  if (!countryInRegion(country, next)) setCountry("all");
                  if (!langZoneInRegion(langZone, next)) setLangZone("all");
                }}
                onLangZone={(next) => {
                  setLangZone(next);
                  if (next !== "all") {
                    const allow = new Set(countriesInLanguageZone(next));
                    const cur = countryFilterSingle(country);
                    if (cur && !allow.has(cur)) setCountry("all");
                  }
                }}

                onCountry={setCountry}
                onLicenseKind={setLicenseKind}
              />
              <Stack gap={6}>
                <Text size="small" weight="medium">
                  流量服务商细分（点选才生效；当前未单选则看全部）
                </Text>
                <Row gap={6} wrap>
                  <FilterChip
                    label={`全部 · ${TRAFFIC_KIND_ORDER.reduce((n, k) => n + countTrafficKind(k), 0)}`}
                    active={trafficKind === "all"}
                    onClick={() => setTrafficKind("all")}
                  />
                  {TRAFFIC_KIND_ORDER.map((k) => (
                    <FilterChip
                      key={k}
                      label={`${TRAFFIC_KIND_LABEL[k]} · ${countTrafficKind(k)}`}
                      active={trafficKind === k}
                      clearable
                      onClick={() => setTrafficKind(trafficKind === k ? "all" : k)}
                    />
                  ))}
                </Row>
              </Stack>
              <Stack gap={4} style={{ minWidth: 200, maxWidth: 420 }}>
                <Select
                  value={trafficKind}
                  onChange={(v) => setTrafficKind(v as TrafficServiceKind | "all")}
                  options={[
                    { value: "all", label: "全部（未单选细分）" },
                    ...TRAFFIC_KIND_ORDER.map((k) => ({
                      value: k,
                      label: `${TRAFFIC_KIND_LABEL[k]} · ${countTrafficKind(k)}`,
                    })),
                  ]}
                />
              </Stack>
              <Row gap={8} align="center" wrap>
                <Pill tone="info">{REGION_LABEL[region]}</Pill>
                {formatCountryFilterLabel(country, region) ? (
                  <Pill tone="info">{formatCountryFilterLabel(country, region)}</Pill>
                ) : null}
                {trafficKind !== "all" ? (
                  <Pill tone="warning">{TRAFFIC_KIND_LABEL[trafficKind]}</Pill>
                ) : (
                  <Pill tone="neutral">细分未单选</Pill>
                )}
                <Text size="small" tone="secondary">
                  {trafficKind === "all"
                    ? "当前未单选细分，展示全部流量服务商样本。"
                    : TRAFFIC_KIND_BLURB[trafficKind]}{" "}
                  属地筛选后样本 {ecoRows.length} 家。
                </Text>
              </Row>
              <Stack gap={4}>
                {ecoRows.map((r) => (
                  <CreditPlayer r={r} />
                ))}
              </Stack>
            </Stack>
          ) : hub === "资金参与机构" ? (
            <Stack gap={12}>
              <Text size="small" tone="secondary">
                市场定位：{INST_BUCKET_LABEL[INST_TYPE_TO_BUCKET[hub as InstitutionType]]}
              </Text>
              <GeoAndLicenseFilters
                region={region}
                country={country}
                langZone={langZone}
                licenseKind={licenseKind}
                showLicenseKind={false}
                onRegion={(next) => {
                  setRegion(next);
                  if (!countryInRegion(country, next)) setCountry("all");
                  if (!langZoneInRegion(langZone, next)) setLangZone("all");
                }}
                onLangZone={(next) => {
                  setLangZone(next);
                  if (next !== "all") {
                    const allow = new Set(countriesInLanguageZone(next));
                    const cur = countryFilterSingle(country);
                    if (cur && !allow.has(cur)) setCountry("all");
                  }
                }}

                onCountry={setCountry}
                onLicenseKind={setLicenseKind}
              />
              <Grid columns={5} gap={10}>
                {FUND_KIND_ORDER.map((k) => (
                  <Stat value={String(countFundKind(k))} label={FUND_KIND_LABEL[k]} />
                ))}
              </Grid>
              <Stack gap={4} style={{ minWidth: 200, maxWidth: 360 }}>
                <Text size="small" weight="medium">
                  资金参与细分
                </Text>
                <Select
                  value={fundKind}
                  onChange={(v) => setFundKind(v as FundParticipationKind | "all")}
                  options={[
                    { value: "all", label: "全部" },
                    ...FUND_KIND_ORDER.map((k) => ({
                      value: k,
                      label: `${FUND_KIND_LABEL[k]} · ${countFundKind(k)}`,
                    })),
                  ]}
                />
              </Stack>
              <Row gap={8} align="center" wrap>
                <Pill tone="info">{REGION_LABEL[region]}</Pill>
                {country !== "all" ? <Pill tone="info">{COUNTRY_LABEL[country]}</Pill> : null}
                <Text size="small" tone="secondary">
                  {fundKind === "all"
                    ? INSTITUTION_TYPE_BLURB.资金参与机构
                    : FUND_KIND_BLURB[fundKind]}{" "}
                  属地筛选后样本 {ecoRows.length} 家。
                </Text>
              </Row>
              <Stack gap={4}>
                {ecoRows.map((r) => (
                  <CreditPlayer r={r} />
                ))}
              </Stack>
            </Stack>
          ) : hub === "股权投资人" ? (
            <Stack gap={12}>
              <Text size="small" tone="secondary">
                市场定位：{INST_BUCKET_LABEL[INST_TYPE_TO_BUCKET[hub as InstitutionType]]}
              </Text>
              <GeoAndLicenseFilters
                region={region}
                country={country}
                langZone={langZone}
                licenseKind={licenseKind}
                showLicenseKind={false}
                onRegion={(next) => {
                  setRegion(next);
                  if (!countryInRegion(country, next)) setCountry("all");
                  if (!langZoneInRegion(langZone, next)) setLangZone("all");
                }}
                onLangZone={(next) => {
                  setLangZone(next);
                  if (next !== "all") {
                    const allow = new Set(countriesInLanguageZone(next));
                    const cur = countryFilterSingle(country);
                    if (cur && !allow.has(cur)) setCountry("all");
                  }
                }}

                onCountry={setCountry}
                onLicenseKind={setLicenseKind}
              />
              <Grid columns={6} gap={10}>
                {EQUITY_KIND_ORDER.map((k) => (
                  <Stat value={String(countEquityKind(k))} label={EQUITY_KIND_LABEL[k]} />
                ))}
              </Grid>
              <Stack gap={4} style={{ minWidth: 200, maxWidth: 360 }}>
                <Text size="small" weight="medium">
                  股权投资人细分
                </Text>
                <Select
                  value={equityKind}
                  onChange={(v) => setEquityKind(v as EquityInvestorKind | "all")}
                  options={[
                    { value: "all", label: "全部" },
                    ...EQUITY_KIND_ORDER.map((k) => ({
                      value: k,
                      label: `${EQUITY_KIND_LABEL[k]} · ${countEquityKind(k)}`,
                    })),
                  ]}
                />
              </Stack>
              <Row gap={8} align="center" wrap>
                <Pill tone="info">{REGION_LABEL[region]}</Pill>
                {formatCountryFilterLabel(country, region) ? (
                  <Pill tone="info">{formatCountryFilterLabel(country, region)}</Pill>
                ) : null}
                {equityKind !== "all" ? (
                  <Pill tone="warning">{EQUITY_KIND_LABEL[equityKind]}</Pill>
                ) : null}
                <Text size="small" tone="secondary">
                  {equityKind === "all"
                    ? INSTITUTION_TYPE_BLURB.股权投资人
                    : EQUITY_KIND_BLURB[equityKind]}{" "}
                  属地筛选后样本 {ecoRows.length} 家。已有 CRM 主体仅打标不建重档。
                </Text>
              </Row>
              <Stack gap={4}>
                {ecoRows.map((r) => (
                  <CreditPlayer r={r} />
                ))}
              </Stack>
            </Stack>
          ) : hub === "支付服务机构" ? (
            <Stack gap={12}>
              <Text size="small" tone="secondary">
                市场定位：{INST_BUCKET_LABEL[INST_TYPE_TO_BUCKET[hub as InstitutionType]]}
              </Text>
              <GeoAndLicenseFilters
                region={region}
                country={country}
                langZone={langZone}
                licenseKind={licenseKind}
                showLicenseKind={false}
                onRegion={(next) => {
                  setRegion(next);
                  if (!countryInRegion(country, next)) setCountry("all");
                  if (!langZoneInRegion(langZone, next)) setLangZone("all");
                }}
                onLangZone={(next) => {
                  setLangZone(next);
                  if (next !== "all") {
                    const allow = new Set(countriesInLanguageZone(next));
                    const cur = countryFilterSingle(country);
                    if (cur && !allow.has(cur)) setCountry("all");
                  }
                }}

                onCountry={setCountry}
                onLicenseKind={setLicenseKind}
              />
              <Grid columns={3} gap={10}>
                {PAYMENT_KIND_ORDER.map((k) => (
                  <Stat value={String(countPaymentKind(k))} label={PAYMENT_KIND_LABEL[k]} />
                ))}
              </Grid>
              <Stack gap={4} style={{ minWidth: 220, maxWidth: 420 }}>
                <Text size="small" weight="medium">
                  支付服务细分
                </Text>
                <Select
                  value={paymentKind}
                  onChange={(v) => setPaymentKind(v as PaymentKind | "all")}
                  options={[
                    { value: "all", label: "全部" },
                    ...PAYMENT_KIND_ORDER.map((k) => ({
                      value: k,
                      label: `${PAYMENT_KIND_LABEL[k]} · ${countPaymentKind(k)}`,
                    })),
                  ]}
                />
              </Stack>
              <Row gap={8} align="center" wrap>
                <Pill tone="info">{REGION_LABEL[region]}</Pill>
                {country !== "all" ? <Pill tone="info">{COUNTRY_LABEL[country]}</Pill> : null}
                <Text size="small" tone="secondary">
                  {paymentKind === "all"
                    ? INSTITUTION_TYPE_BLURB.支付服务机构
                    : PAYMENT_KIND_BLURB[paymentKind]}{" "}
                  属地筛选后样本 {ecoRows.length} 家。
                </Text>
              </Row>
              <Stack gap={4}>
                {ecoRows.map((r) => (
                  <CreditPlayer r={r} />
                ))}
              </Stack>
            </Stack>
          ) : (
            <Stack gap={12}>
              <Text size="small" tone="secondary">
                市场定位：{INST_BUCKET_LABEL[INST_TYPE_TO_BUCKET[hub as InstitutionType]]}
              </Text>
              {isGeoScopedEcoType(hub as InstitutionType) ? (
                <Stack gap={10}>
                  <Text size="small" tone="secondary">
                    {INSTITUTION_TYPE_BLURB[hub as InstitutionType]} 属地筛选后样本 {ecoRows.length} 家。
                  </Text>
                  <GeoAndLicenseFilters
                    region={region}
                    country={country}
                    langZone={langZone}
                    licenseKind={licenseKind}
                    showLicenseKind={false}
                    onRegion={(next) => {
                      setRegion(next);
                      if (!countryInRegion(country, next)) setCountry("all");
                      if (!langZoneInRegion(langZone, next)) setLangZone("all");
                    }}
                    onLangZone={(next) => {
                      setLangZone(next);
                      if (next !== "all") {
                        const allow = new Set(countriesInLanguageZone(next));
                        const cur = countryFilterSingle(country);
                        if (cur && !allow.has(cur)) setCountry("all");
                      }
                    }}
                    onCountry={setCountry}
                    onLicenseKind={setLicenseKind}
                  />
                  <Row gap={8} align="center" wrap>
                    <Pill tone="info">{REGION_LABEL[region]}</Pill>
                    {langZone !== "all" ? <Pill tone="info">{langZone}</Pill> : null}
                    {country !== "all" ? <Pill tone="info">{COUNTRY_LABEL[country]}</Pill> : null}
                    <Text size="small" tone="secondary">
                      {ecoRows.length} 家
                    </Text>
                  </Row>
                </Stack>
              ) : (
                <Text size="small" tone="secondary">
                  {INSTITUTION_TYPE_BLURB[hub]} 公开信息样本 {ecoRows.length} 家。
                </Text>
              )}
              <Stack gap={4}>
                {ecoRows.map((r) => (
                  <CreditPlayer r={r} />
                ))}
              </Stack>
            </Stack>
          )}
        </Stack>
      ) : null}
      </Stack>
    </AtlasSideRail>
  );
}



