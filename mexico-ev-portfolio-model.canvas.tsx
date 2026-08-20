import {
  BarChart,
  Button,
  Callout,
  Card,
  CollapsibleSection,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H2,
  H3,
  IconButton,
  LineChart,
  Link,
  Pill,
  Row,
  Select,
  Spacer,
  Stack,
  Stat,
  Swatch,
  Table,
  Text,
  TextInput,
  Toggle,
  UsageBar,
  mergeStyle,
  usageColorSequence,
  useCanvasState,
  useHostTheme,
} from "cursor/canvas";

/**
 * 墨西哥新能源 Portfolio 组合测算
 * 原则：一切现金流由「资产最小单元」经营模型叠加而成；期初先评估配置一台车 / 一把枪（或一座场站）。
 * 信源：沣邦三份测算表（充电桩 / DAE-200 / LTO快车）+ EV数据逻辑梳理
 * 币种默认：USD；底层参数以 MXN 录入后按 FX 折算为实际美元（不再用「千元」口径）。
 */

type ResidualMode = "accounting" | "physical" | "maintenance";
type TabId =
  | "config"
  | "skuDetail"
  | "sources"
  | "overview"
  | "orders"
  | "invest"
  | "params"
  | "units"
  | "value"
  | "returns"
  | "related"
  | "cashflow"
  | "ops";
type OpMode = "DAE" | "RTO" | "LTO";
/** DAE 班制：一班倒=单司机；两班倒=双司机、有效车时约 1.8× */
type DaeShift = "single" | "double";
const DAE_SHIFT_LABEL: Record<DaeShift, string> = {
  single: "一班倒",
  double: "两班倒",
};
/** 投放槽位：场站，或车辆经营模式（DAE/RTO/LTO 均属模式范畴） */
type InvestAsset = "station" | "dae" | "rto" | "lto";

const OP_MODE_LABEL: Record<OpMode, string> = {
  DAE: "雇佣司机运营",
  RTO: "租买分期",
  LTO: "车辆直租",
};

function modeToAsset(mode: OpMode): InvestAsset {
  if (mode === "DAE") return "dae";
  if (mode === "RTO") return "rto";
  return "lto";
}

function isRentMode(mode: OpMode) {
  return mode === "LTO" || mode === "RTO";
}
type CashflowScenario = "base" | "down" | "up";

/** 运营商（原「管理人」）：车运营第一要素；期初 YOHO / LAFA，可配置增改 */
type ManagerId = string;
type Operator = {
  id: ManagerId;
  nameZh: string;
  hint: string;
  /** false = 不出现在选择器，仍保留档案 */
  enabled: boolean;
};

const DEFAULT_OPERATORS: Operator[] = [
  {
    id: "fenbang",
    nameZh: "YOHO",
    hint: "测算主体·墨西哥展业",
    enabled: true,
  },
  {
    id: "lafa",
    nameZh: "LAFA",
    hint: "对照运营商·同资产路径下盈利与风控更优（示意）",
    enabled: true,
  },
];

/** @deprecated 用 DEFAULT_OPERATORS / 运行时 operators 状态 */
const MANAGERS = DEFAULT_OPERATORS;

function relatedFlagOf(
  rp: Partial<Record<string, RelatedFlag>> | undefined,
  id: ManagerId,
): RelatedFlag {
  return rp?.[id] ?? "unknown";
}

function newOperatorId(nameZh: string, existing: Operator[]): string {
  const base =
    nameZh
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "") || "op";
  let id = base === "op" ? `op-${Date.now().toString(36)}` : base;
  let n = 2;
  while (existing.some((o) => o.id === id)) {
    id = `${base}-${n++}`;
  }
  return id;
}

type VolumeTier = { minQty: number; discountRate: number };

/** 落地皮费：上牌、GPS、登记等，计入单车资本化成本；场站则为基建/押金等 */
type SoftCostLine = {
  id: string;
  nameZh: string;
  amountMxn: number;
};

/** 场站商详规格（测算口径 + 管理人补录） */
type StationSpec = {
  parkingSpaces: number;
  fastGuns: number;
  slowGuns: number;
  chargerCabinets: number;
  totalPowerKw: number;
  areaSqm: number;
  brand: string;
  supplier: string;
  manufacturer: string;
  /** 质保年；0 = 待管理人填写 */
  warrantyYears: number;
  transformerKva: number;
  dieselGeneratorKva: number;
  noteZh: string;
};

/** 场站设备 BOM：变压器/枪/发电机等，合计应对齐设备包购入价 */
type StationBomLine = {
  id: string;
  nameZh: string;
  qty: number;
  unit: string;
  amountMxn: number;
  /** locked=测算已锁；pending=待管理人核对 */
  status: "locked" | "pending";
  noteZh: string;
};

/** 合作管理人填写表（商详缺口） */
type SpecFillRow = {
  id: string;
  fieldZh: string;
  value: string;
  required: boolean;
  hintZh: string;
};

/** 商详规格行（车辆/场站通用展示） */
type ProductSpecRow = {
  id: string;
  labelZh: string;
  valueZh: string;
  status: "known" | "pending";
  /** 挂靠 SOURCE_LIB；展示为可点小编号 */
  sourceIds?: string[];
};

/**
 * 车辆四大件（电池 / 电机 / 电控 / 车身）：均须有品牌 + 供应商。
 * 场站对照：充电设备 / 变压器 / 柴发。
 * 下单前可先填模板；到货后在资产卡补录唯一识别号。
 */
type MajorComponentId =
  | "battery"
  | "motor"
  | "ecu"
  | "body"
  | "pack"
  | "transformer"
  | "diesel";
type MajorComponent = {
  id: MajorComponentId;
  nameZh: string;
  brandZh: string;
  supplierZh: string;
  manufacturerZh: string;
  specZh: string;
  status: "known" | "pending";
  noteZh: string;
  /** 挂靠 SOURCE_LIB；展示为可点小编号 */
  sourceIds?: string[];
};

/** SKU 配置档：续航/电池/胎规格等版本，须与采购合同一致 */
type SkuConfigVariant = {
  id: string;
  nameZh: string;
  /** 展示用：官方工况 + 实际续航摘要（场站可写规模说明） */
  rangeZh: string;
  /** 官方工况名：NEDC / CLTC 等（车辆必填） */
  officialCycleZh?: string;
  officialKm?: number;
  /** 实际续航（示意，km；车辆必填） */
  actualCityKm?: number;
  actualHighwayKm?: number;
  actualNoteZh?: string;
  /** 极端续航（寒冷/采暖高耗，km） */
  actualExtremeKm?: number;
  extremeNoteZh?: string;
  batteryKwh: number;
  tireSpecZh: string;
  /** 该档采购价；税口径随 SKU.pricesIncludeVat（缺省则回落 SKU.purchasePriceMxn） */
  purchasePriceMxn?: number;
  /** 该档指导价；税口径随 SKU.pricesIncludeVat（缺省则回落 SKU.guidePriceMxn） */
  guidePriceMxn?: number;
  /** 直流快充 30%→80% 分钟（公开参配） */
  dcFastMin30to80?: number;
  /** 交流慢充功率 kW（公开参配） */
  acChargeKw?: number;
  noteZh: string;
  isDefault?: boolean;
};

/**
 * 下单后按《EV数据逻辑梳理》基础字段补录，并预留滴滴 Fleet Open API 对齐字段。
 * 主键：NIV（车架号）+ 电池 SN — 保证车、电池唯一识别与车电分拆质押。
 * 平台键：customizedCarId（第三方车辆 ID）↔ 滴滴 car/addCar · car/list。
 */
type AssetIdentityFill = {
  /** EV 主键：车架号 / NIV */
  niv: string;
  /** 车牌；对齐滴滴 plate_no（addCar 必填） */
  plateNo: string;
  configVariantId: string;
  modelFullZh: string;
  bodyFactoryDate: string;
  /** 首次上路营运日；对齐漏斗「上路出收入」 */
  firstOpDate: string;
  batterySn: string;
  batteryKwh: string;
  batteryFactoryDate: string;
  batteryMakerZh: string;
  batteryCostMxn: string;
  tireBrandZh: string;
  tireSupplierZh: string;
  tireSpecZh: string;
  purchaseContractNo: string;
  customsNo: string;
  noteZh: string;
  /** 滴滴 Fleet：第三方车辆 ID（我方系统车 ID） */
  customizedCarId: string;
  /** 滴滴开放城市 */
  didiCityId: string;
  didiCityName: string;
  didiCarColorId: string;
  didiCarColor: string;
  didiCarBrand: string;
  /** Express 等 */
  didiProductName: string;
  /** car_audit_status 原文或中文 */
  didiCarAuditStatus: string;
  didiCarRegTime: string;
  didiCarExpireTime: string;
  /** 当前绑定司机 */
  customizedDriverId: string;
  driverPhone: string;
  driverName: string;
  driverStatus: string;
  driverBindStatus: string;
  driverDailyStatus: string;
};

/** 是否为某管理人关联方 */
type RelatedFlag = "yes" | "no" | "unknown" | "pending";

/**
 * relatedParty 按运营商分别标记。
 */
type SupplyChainNode = {
  id: string;
  step: number;
  roleZh: string;
  nameZh: string;
  nameEn: string;
  countryZh: string;
  legalId: string;
  relatedParty: Record<ManagerId, RelatedFlag>;
  noteZh: string;
};

/**
 * 资产 SKU（得物式货架）：车辆或充电站。
 * 购入价/指导价/皮费/寿命/保险维保固定在 SKU；数量与量折由管理员在 SKU 库配置。
 */
type SkuKind = "vehicle" | "station";
type AssetSku = {
  id: string;
  kind: SkuKind;
  nameZh: string;
  brand: string;
  model: string;
  tagline: string;
  /** 计量单位：台 / 座 */
  unitLabel: string;
  /**
   * 购入价（MXN）。若 pricesIncludeVat=true，则为案例表/合同列载含税现金价，落地时不再加 IVA；
   * 否则为未税录入，展示/现金流按 vat 加税。
   */
  purchasePriceMxn: number;
  /** 指导价（MXN）；税口径同 purchasePriceMxn */
  guidePriceMxn: number;
  /**
   * true：购入/指导/皮费已按含税现金列载（对齐沣邦 DAE 案例表）；
   * false/缺省：未税录入，购物车另加 IVA。
   */
  pricesIncludeVat?: boolean;
  softCosts: SoftCostLine[];
  /** 会计寿命期末残值率（0–1，可配） */
  residualRate: number;
  /** 物理寿命期末残值率（0–1，可配） */
  physResidualRate: number;
  /** 维保寿命期末残值率（0–1，可配） */
  maintResidualRate: number;
  /** 会计寿命（年）；默认见 DEFAULT_LIFE_YEARS */
  acctYears: number;
  /** 物理寿命（年） */
  physYears: number;
  /** 维保寿命（年）；默认 5 */
  maintYears: number;
  insuranceYrMxn: number;
  maintPolicyZh: string;
  maintMxn: number;
  softMxn: number;
  wearYrMxn: number;
  kwhPer100: number;
  /** 管理员：起订量 / 步长 / 上限 / 默认加购量 */
  minOrderQty: number;
  qtyStep: number;
  maxOrderQty: number;
  defaultQty: number;
  /** 量折阶梯：数量达到 minQty 时适用 discountRate（取最高档） */
  volumeTiers: VolumeTier[];
  /** 商详规格（点击 SKU 可见） */
  productSpecs: ProductSpecRow[];
  /** 四大件：电池/电机/电控/车身 · 品牌+供应商（场站为设备/变压器/柴发） */
  majorComponents?: MajorComponent[];
  /** 配置档（续航/电池版本等） */
  configVariants?: SkuConfigVariant[];
  defaultConfigId?: string;
  /** 供应商→工厂追溯链 */
  supplyChain: SupplyChainNode[];
  /** 中国市场：残值公允曲线 / 保有量 / 口碑（海外市暂无则空） */
  marketIntel?: MarketIntel;
  /** 仅场站 */
  stationSpec?: StationSpec;
  stationBom?: StationBomLine[];
  specFill?: SpecFillRow[];
  /** 场站经营常量（跟本 SKU；大中小不同） */
  stationOps?: StationOpsConstants;
};

/** 单座场站经营常量：吞吐/电价/租金等，绑定资产而非全局前提 */
type StationOpsConstants = {
  powerKwPerGun: number;
  externalUtil: number;
  internalUtil: number;
  externalPriceMxn: number;
  internalPriceMxn: number;
  elecCostMxn: number;
  lossFactor: number;
  rentMonthMxn: number;
  opexMonthMxn: number;
  rampStartLoad: number;
  xiaojufenPct: number;
  payFeePct: number;
};

/** 二手残值曲线点：车龄年 → 相对新车成交价残值率% */
type ResidualCurvePoint = { year: number; ratePct: number };

type ReputationDim = { nameZh: string; score: number };

/** 好评/差评摘录（可点信源） */
type ReviewSnippet = {
  id: string;
  tone: "pro" | "con";
  titleZh: string;
  detailZh: string;
  topicZh: string;
  sourceIds: string[];
};

/**
 * 事故 / 召回 / 批量故障 / 投诉新闻。
 * 营运投放须单独看 severity 与 opsHintZh。
 */
type RiskNewsItem = {
  id: string;
  kind: "recall" | "battery_fault" | "accident" | "complaint" | "media";
  severity: "high" | "mid" | "low";
  titleZh: string;
  summaryZh: string;
  statusZh: string;
  asOfZh: string;
  opsHintZh: string;
  sourceIds: string[];
};

/** 参照系一行：保有（万辆）或懂车分 */
type MarketRefRow = {
  id: string;
  nameZh: string;
  value: number;
  unitZh: string;
  role: "self" | "peer" | "segment" | "fleet" | "scale";
  noteZh: string;
};

/** 保有量国家口径（页首可切换） */
type MarketParcCountry = "CN" | "MX";

/** 单国保有切片 */
type MarketParcSlice = {
  country: MarketParcCountry;
  countryZh: string;
  /** 主数字；单位见 unitZh（中国多用万辆，墨市薄样本多用台） */
  value: number;
  unitZh: string;
  labelZh: string;
  noteZh: string;
  /** 累计交付 / 进口近似 / 媒体销量等 */
  methodZh: string;
  confidenceZh: "高" | "中" | "低";
  asOfZh: string;
  sourceIds: string[];
  ref: {
    howToReadZh: string;
    rows: MarketRefRow[];
  };
};

/** 单平台终端反馈分（1–5 量纲对齐后再综合） */
type ReputationPlatform = {
  id: string;
  platformZh: string;
  score: number;
  reviews: number;
  gradeZh: string;
  sourceIds?: string[];
  noteZh?: string;
};

type ScoreBand = {
  min: number;
  max: number;
  gradeZh: string;
  meaningZh: string;
};

type MarketIntel = {
  scopeZh: string;
  residualProxyZh: string;
  /** 公允曲线（车系/代理车系成交口径） */
  residualFair: ResidualCurvePoint[];
  /** 对照：中国纯电行业粗线（流通协会等公开口径插值） */
  residualIndustry: ResidualCurvePoint[];
  residualNoteZh: string;
  residualSourceIds: string[];
  /**
   * @deprecated 兼容旧字段：等同 parcByCountry.CN
   * 新逻辑请用 parcByCountry + resolveMarketParc
   */
  parcWan: number;
  parcLabelZh: string;
  parcNoteZh: string;
  parcSourceIds: string[];
  /** 保有量怎么读：同级/网约神车/本组合投放对照（默认中国） */
  parcRef: {
    howToReadZh: string;
    rows: MarketRefRow[];
  };
  /** 分国保有：至少中国 / 墨西哥可选 */
  parcByCountry?: Partial<Record<MarketParcCountry, MarketParcSlice>>;
  reputation: {
    platformZh: string;
    score: number;
    gradeZh: string;
    reviews: number;
    peerAvg: number;
    dims: ReputationDim[];
    tagsPros: string[];
    tagsCons: string[];
    /** 好评/差评摘录（比标签更可读） */
    reviewSnippets: ReviewSnippet[];
    sourceIds: string[];
    asOfZh: string;
    /**
     * 多平台终端分（懂车帝 / 汽车之家等）。
     * 页首「终端反馈」用评价数加权综合；样本总量决定饱和度。
     */
    platforms?: ReputationPlatform[];
  };
  /** 懂车分怎么读：刻度带 + 同价位/对标车 */
  scoreRef: {
    howToReadZh: string;
    bands: ScoreBand[];
    rows: MarketRefRow[];
  };
  /** 事故、召回、批量故障、典型投诉 */
  riskNews: RiskNewsItem[];
};

/** 懂车分刻度（平台「良好/优秀」口头档的业务读法，非官方公式） */
const DONGCHEDI_SCORE_BANDS: ScoreBand[] = [
  {
    min: 4.5,
    max: 5.0,
    gradeZh: "优秀偏上",
    meaningZh: "口碑极强；营运选车可作加分项",
  },
  {
    min: 4.0,
    max: 4.49,
    gradeZh: "优秀",
    meaningZh: "明显好于同价位均值；差评标签少",
  },
  {
    min: 3.5,
    max: 3.99,
    gradeZh: "良好",
    meaningZh: "可接受主流量产车；看分项与差评是否伤营运",
  },
  {
    min: 3.0,
    max: 3.49,
    gradeZh: "一般–良好边界",
    meaningZh: "样本或新品常见；须盯维保/异响/配置槽点",
  },
  {
    min: 0,
    max: 2.99,
    gradeZh: "偏弱",
    meaningZh: "慎作大规模投放；先核差评与召回",
  },
];

function scoreBandOf(score: number, bands: ScoreBand[]): ScoreBand {
  return (
    bands.find((b) => score >= b.min && score <= b.max) ||
    bands[bands.length - 1]!
  );
}

/** 多平台按评价数加权 → 综合分；用总量判断样本饱和度 */
function reputationTerminal(rep: MarketIntel["reputation"]) {
  const platforms =
    rep.platforms && rep.platforms.length > 0
      ? rep.platforms
      : [
          {
            id: "primary",
            platformZh: rep.platformZh,
            score: rep.score,
            reviews: rep.reviews,
            gradeZh: rep.gradeZh,
            sourceIds: rep.sourceIds,
          } satisfies ReputationPlatform,
        ];
  const reviews = platforms.reduce((s, p) => s + (p.reviews || 0), 0);
  const score =
    reviews > 0
      ? Math.round(
          (platforms.reduce((s, p) => s + p.score * p.reviews, 0) / reviews) *
            100,
        ) / 100
      : rep.score;
  const peerAvg = rep.peerAvg;
  const delta = Math.round((score - peerAvg) * 100) / 100;
  const saturationZh =
    reviews >= 800
      ? "样本充足"
      : reviews >= 300
        ? "样本中等"
        : "样本偏薄";
  const diffZh =
    Math.abs(delta) < 0.05
      ? "与同价位均分接近"
      : delta > 0
        ? `高于同价位均分 ${delta.toFixed(2)}`
        : `低于同价位均分 ${Math.abs(delta).toFixed(2)}`;
  const band = scoreBandOf(score, DONGCHEDI_SCORE_BANDS);
  return {
    platforms,
    score,
    reviews,
    peerAvg,
    delta,
    saturationZh,
    diffZh,
    gradeZh: band.gradeZh,
    meaningZh: band.meaningZh,
  };
}

function parcRefEs(): MarketIntel["parcRef"] {
  return {
    howToReadZh:
      "保有看量级与对照：本车系 vs 同级网约常用车 vs 墨西哥本组合投放。中国百万级保有不能直接外推墨市路况与残值。",
    rows: [
      {
        id: "self",
        nameZh: "AION S（ES代理）",
        value: 100,
        unitZh: "万辆量级",
        role: "self",
        noteZh: "媒体累计销量破百万口径；待双端",
      },
      {
        id: "peer-qin",
        nameZh: "对照·秦PLUS EV 类网约神车",
        value: 200,
        unitZh: "万辆量级",
        role: "peer",
        noteZh: "同场景头部量级示意，非精确保有",
      },
      {
        id: "seg-mid",
        nameZh: "对照·同级纯电轿车腰部",
        value: 30,
        unitZh: "万辆量级",
        role: "segment",
        noteZh: "腰部车系常见数十万量级",
      },
      {
        id: "fleet-mx",
        nameZh: "对照·墨西哥本组合投放（测算）",
        value: 0.02,
        unitZh: "万辆",
        role: "fleet",
        noteZh: "约 200 台量级；相对中国保有可忽略",
      },
    ],
  };
}

function parcRefUt(): MarketIntel["parcRef"] {
  return {
    howToReadZh:
      "UT 上市短，累计销量≈保有下限。对照：①本车 ②同价位爆款（海鸥等）③同价位新车一年级 ④墨西哥投放。新车保有薄 → 残值样本更不可靠。",
    rows: [
      {
        id: "self",
        nameZh: "AION UT 累计销量近似",
        value: 7.7,
        unitZh: "万辆",
        role: "self",
        noteZh: "2025+2026H1 拼盘量级；待双端",
      },
      {
        id: "peer-seagull",
        nameZh: "对照·海鸥类同价位爆款",
        value: 100,
        unitZh: "万辆量级",
        role: "peer",
        noteZh: "说明「7.7万」在同价位仍属新锐/偏小",
      },
      {
        id: "seg-year",
        nameZh: "对照·同价位新车一年累计",
        value: 15,
        unitZh: "万辆量级",
        role: "segment",
        noteZh: "一年级常见数万–十几万；UT 尚在爬坡",
      },
      {
        id: "fleet-mx",
        nameZh: "对照·墨西哥本组合投放（测算）",
        value: 0.02,
        unitZh: "万辆",
        role: "fleet",
        noteZh: "约 200 台；中国薄保有对墨残值外推风险更高",
      },
    ],
  };
}

function formatParcHero(slice: MarketParcSlice): string {
  if (slice.unitZh.includes("台")) {
    return `${Math.round(slice.value).toLocaleString("en-US")} 台`;
  }
  const v = slice.value;
  const shown =
    v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
  return `${shown} 万`;
}

/** 解析分国保有；缺省回落旧字段（中国） */
function resolveMarketParc(
  mi: MarketIntel,
  country: MarketParcCountry,
): MarketParcSlice {
  const hit = mi.parcByCountry?.[country];
  if (hit) return hit;
  if (country === "CN") {
    return {
      country: "CN",
      countryZh: "中国",
      value: mi.parcWan,
      unitZh: "万辆",
      labelZh: mi.parcLabelZh,
      noteZh: mi.parcNoteZh,
      methodZh: "累计销量/保有量级（兼容旧字段）",
      confidenceZh: "中",
      asOfZh: "见信源",
      sourceIds: mi.parcSourceIds,
      ref: mi.parcRef,
    };
  }
  return {
    country: "MX",
    countryZh: "墨西哥",
    value: 0,
    unitZh: "台",
    labelZh: "墨市保有/交付（待补）",
    noteZh: "尚未落库墨市口径；请切换中国或补信源。",
    methodZh: "待建",
    confidenceZh: "低",
    asOfZh: "—",
    sourceIds: [],
    ref: {
      howToReadZh: "墨市保有待补：建议用累计进口/经销交付作下限。",
      rows: [],
    },
  };
}

function parcByCountryEs(): NonNullable<MarketIntel["parcByCountry"]> {
  const cnRef = parcRefEs();
  return {
    CN: {
      country: "CN",
      countryZh: "中国",
      value: 100,
      unitZh: "万辆",
      labelZh: "AION S 累计销量/保有量级（代理）",
      noteZh:
        "媒体口径称 AION S 累计销量破百万；珠三角网约渗透高。非公安部精确保有登记。",
      methodZh: "媒体累计销量 ≈ 保有量级（代理车系）",
      confidenceZh: "中",
      asOfZh: "对照约 2026-08",
      sourceIds: ["media-aion-s-1m"],
      ref: cnRef,
    },
    MX: {
      country: "MX",
      countryZh: "墨西哥",
      value: 1200,
      unitZh: "台",
      labelZh: "AION ES/S 墨累计交付·进口量级（示意）",
      noteZh:
        "墨市无公开车系级在籍保有；以经销/进口累计量级作保有下限示意。样本薄，置信度低，待 AMIA/经销双端。",
      methodZh: "累计交付/进口近似保有（下限）",
      confidenceZh: "低",
      asOfZh: "示意·待双端·约 2026",
      sourceIds: ["mx-parc-aion-es-proxy", "amia-mx-ev-track"],
      ref: {
        howToReadZh:
          "墨市看「台」不看「百万辆」。对照：本车累计交付 vs 已上量中系/日系网约常用车 vs 本组合拟投放。",
        rows: [
          {
            id: "self",
            nameZh: "本车·ES/S 墨累计（示意）",
            value: 1200,
            unitZh: "台",
            role: "self",
            noteZh: "交付/进口下限示意；待双端",
          },
          {
            id: "peer-byd",
            nameZh: "对照·已上量中系纯电（示意）",
            value: 25000,
            unitZh: "台量级",
            role: "peer",
            noteZh: "说明本车仍属早期渗透",
          },
          {
            id: "seg-taxi",
            nameZh: "对照·墨城网约/出租常用车池",
            value: 80000,
            unitZh: "台量级",
            role: "segment",
            noteZh: "场景车池量级示意，非单品牌",
          },
          {
            id: "fleet",
            nameZh: "对照·本组合拟投放",
            value: 200,
            unitZh: "台",
            role: "fleet",
            noteZh: "测算默认量级；相对墨市本车保有已可观",
          },
        ],
      },
    },
  };
}

function parcByCountryUt(): NonNullable<MarketIntel["parcByCountry"]> {
  const cnRef = parcRefUt();
  return {
    CN: {
      country: "CN",
      countryZh: "中国",
      value: 7.7,
      unitZh: "万辆",
      labelZh: "累计销量近似保有（下限）",
      noteZh:
        "2025全年约5.09万 + 2026年1–6月累计约2.65万 ≈ 7.7万量级（批发/零售口径混用，待双端）。",
      methodZh: "累计销量拼盘 ≈ 保有下限",
      confidenceZh: "中",
      asOfZh: "对照约 2026-08",
      sourceIds: ["bitauto-ut-sales", "gasgoo-aion-202601"],
      ref: cnRef,
    },
    MX: {
      country: "MX",
      countryZh: "墨西哥",
      value: 350,
      unitZh: "台",
      labelZh: "AION UT 墨累计交付·进口量级（示意）",
      noteZh:
        "UT 海外上市更短，墨市公开车系保有几乎不可得；现用极保守交付/进口示意。路测与残值样本均薄。",
      methodZh: "累计交付/进口近似保有（下限）",
      confidenceZh: "低",
      asOfZh: "示意·待双端·约 2026",
      sourceIds: ["mx-parc-aion-ut-proxy", "amia-mx-ev-track"],
      ref: {
        howToReadZh:
          "新车薄保有：本车墨累计 vs 同价位已上量车 vs 本组合投放。残值外推风险高于 ES。",
        rows: [
          {
            id: "self",
            nameZh: "本车·UT 墨累计（示意）",
            value: 350,
            unitZh: "台",
            role: "self",
            noteZh: "极保守下限；待双端",
          },
          {
            id: "peer",
            nameZh: "对照·同价位已上量小车（示意）",
            value: 12000,
            unitZh: "台量级",
            role: "peer",
            noteZh: "说明 UT 墨仍早期",
          },
          {
            id: "fleet",
            nameZh: "对照·本组合拟投放",
            value: 200,
            unitZh: "台",
            role: "fleet",
            noteZh: "相对本车墨保有占比高 → 更依赖自建维保",
          },
        ],
      },
    },
  };
}

function scoreRefEs(): MarketIntel["scoreRef"] {
  return {
    howToReadZh:
      "懂车分 ≈ 车主评价综合分（约 1–5）。先看：相对同价位均分高/低多少、评价样本量、落在哪条刻度带。3.66「良好」但低于同价位 3.87 → 口碑中性偏弱，须看分项槽点是否伤营运（异响/配置）。",
    bands: DONGCHEDI_SCORE_BANDS,
    rows: [
      {
        id: "self",
        nameZh: "AION S（本车代理）",
        value: 3.66,
        unitZh: "分",
        role: "self",
        noteZh: "451 评 · 良好",
      },
      {
        id: "peer-avg",
        nameZh: "同价位均分（平台）",
        value: 3.87,
        unitZh: "分",
        role: "peer",
        noteZh: "本车约低 0.21 分",
      },
      {
        id: "band-good",
        nameZh: "「良好」带中位示意",
        value: 3.75,
        unitZh: "分",
        role: "scale",
        noteZh: "3.5–4.0 带",
      },
      {
        id: "band-exc",
        nameZh: "「优秀」门槛示意",
        value: 4.0,
        unitZh: "分",
        role: "scale",
        noteZh: "≥4.0 通常算优秀档",
      },
    ],
  };
}

function scoreRefUt(): MarketIntel["scoreRef"] {
  return {
    howToReadZh:
      "UT 3.38 / 约104评：样本量仍薄，分值波动大。落在「一般–良好边界」；低于同价位均分时，优先读差评标签（异味/配置/胎噪）是否与营运相关，勿只看总分。",
    bands: DONGCHEDI_SCORE_BANDS,
    rows: [
      {
        id: "self",
        nameZh: "AION UT",
        value: 3.38,
        unitZh: "分",
        role: "self",
        noteZh: "约104评 · 良好（边界）",
      },
      {
        id: "peer-avg",
        nameZh: "同价位均分（平台）",
        value: 3.72,
        unitZh: "分",
        role: "peer",
        noteZh: "本车约低 0.34 分",
      },
      {
        id: "band-mid",
        nameZh: "「良好」带下沿",
        value: 3.5,
        unitZh: "分",
        role: "scale",
        noteZh: "低于此更宜当「一般」读",
      },
      {
        id: "band-exc",
        nameZh: "「优秀」门槛示意",
        value: 4.0,
        unitZh: "分",
        role: "scale",
        noteZh: "≥4.0",
      },
    ],
  };
}

function reviewSnippetsEs(): ReviewSnippet[] {
  return [
    {
      id: "es-pro-space",
      tone: "pro",
      titleZh: "空间出色",
      detailZh: "懂车帝正面标签高频：后排/后备厢适合网约载客与行李。",
      topicZh: "空间",
      sourceIds: ["dongchedi-aion-s"],
    },
    {
      id: "es-pro-power",
      tone: "pro",
      titleZh: "动力够用",
      detailZh: "城市工况加速反馈正向评价较多，满足专车接单节奏。",
      topicZh: "动力",
      sourceIds: ["dongchedi-aion-s"],
    },
    {
      id: "es-pro-range",
      tone: "pro",
      titleZh: "续航表现优秀（正评标签）",
      detailZh: "部分车主认可日常续航；与「续航差」差评标签并存，须分场景。",
      topicZh: "续航",
      sourceIds: ["dongchedi-aion-s"],
    },
    {
      id: "es-con-range",
      tone: "con",
      titleZh: "续航表现较差（差评标签）",
      detailZh: "同一车系正负标签并存，提示营运深放电/快充工况下续航达成不稳定。",
      topicZh: "续航",
      sourceIds: ["dongchedi-aion-s"],
    },
    {
      id: "es-con-noise",
      tone: "con",
      titleZh: "异响",
      detailZh: "差评常见异响，影响乘客体验与维保频次，专车投放需盯维修周转。",
      topicZh: "NVH/异响",
      sourceIds: ["dongchedi-aion-s"],
    },
    {
      id: "es-con-cfg",
      tone: "con",
      titleZh: "配置偏低",
      detailZh: "同价位配置感弱于竞品；墨西哥落地配置以合同为准，勿按国内口碑默认。",
      topicZh: "配置",
      sourceIds: ["dongchedi-aion-s"],
    },
    {
      id: "es-con-batt",
      tone: "con",
      titleZh: "营运车 177Ah 电池故障舆情",
      detailZh:
        "2026-07 媒体：部分营运 AION S（中创新航177Ah）出现鼓包/漏液/绝缘故障；厂家启动召回申请与延保。墨西哥采购须核电芯型号是否同族。",
      topicZh: "电池/安全",
      sourceIds: ["aion-s-177ah-people", "aion-s-177ah-yoojia"],
    },
  ];
}

function reviewSnippetsUt(): ReviewSnippet[] {
  return [
    {
      id: "ut-pro-cost",
      tone: "pro",
      titleZh: "用车成本低、电耗温和",
      detailZh: "车质网口碑：市区通勤电耗约11–13kWh/100km量级，代步成本敏感用户好评。",
      topicZh: "电耗/成本",
      sourceIds: ["chezhinet-ut-series"],
    },
    {
      id: "ut-pro-range",
      tone: "pro",
      titleZh: "市区续航达成率高",
      detailZh: "有车主称市区达成率超90%；适合短途快车，不宜默认高速长途。",
      topicZh: "续航",
      sourceIds: ["chezhinet-ut-series"],
    },
    {
      id: "ut-pro-space",
      tone: "pro",
      titleZh: "空间够用",
      detailZh: "懂车帝/车质网均有「空间出色」正向；两厢后排对快车够用。",
      topicZh: "空间",
      sourceIds: ["dongchedi-aion-ut", "chezhinet-ut-series"],
    },
    {
      id: "ut-con-nvh",
      tone: "con",
      titleZh: "胎噪/风噪大",
      detailZh: "高速80–100km/h 后噪音声议多；快车高速单体验减分。",
      topicZh: "NVH",
      sourceIds: ["dongchedi-aion-ut", "chezhinet-ut-series"],
    },
    {
      id: "ut-con-smell",
      tone: "con",
      titleZh: "新车异味",
      detailZh: "懂车帝槽点与车质网口碑常见；需通风周期，影响交车满意度。",
      topicZh: "内饰",
      sourceIds: ["dongchedi-aion-ut"],
    },
    {
      id: "ut-con-cfg",
      tone: "con",
      titleZh: "配置鸡肋/塑料感",
      detailZh: "硬塑料多、档次感弱；配置分项偏低，租买客户预期管理重要。",
      topicZh: "配置",
      sourceIds: ["dongchedi-aion-ut", "chezhinet-ut-series"],
    },
    {
      id: "ut-con-resonance",
      tone: "con",
      titleZh: "行驶低频共振",
      detailZh: "车质网多起投诉：正常行驶车身低频共振，个别称头晕耳鸣；须纳入验收与维保预案。",
      topicZh: "底盘/共振",
      sourceIds: ["chezhinet-ut"],
    },
    {
      id: "ut-con-ivi",
      tone: "con",
      titleZh: "车机黑屏/重启",
      detailZh: "投诉集中：车机自动重启、黑屏花屏卡顿；影响导航接单，快车运营直接受损。",
      topicZh: "车机",
      sourceIds: ["chezhinet-ut"],
    },
  ];
}

function riskNewsEs(): RiskNewsItem[] {
  return [
    {
      id: "es-177ah-recall",
      kind: "recall",
      severity: "high",
      titleZh: "177Ah 电池：启动召回申请（待总局公示）",
      summaryZh:
        "2026-07 广汽埃安确认部分搭载中创新航177Ah磷酸铁锂的营运 AION S 出现电池故障；售后称已启动召回申请流程，正式公告以市场监管总局备案公示为准。",
      statusZh: "召回流程中·延保已先行",
      asOfZh: "2026-07",
      opsHintZh:
        "墨西哥 ES 采购合同必须锁定电芯型号/供应商；若同族177Ah，须写入质保/换包/停运补偿条款，并做到货抽检。",
      sourceIds: [
        "aion-s-177ah-people",
        "aion-s-177ah-yoojia",
        "aion-s-177ah-autohome",
      ],
    },
    {
      id: "es-177ah-fault",
      kind: "battery_fault",
      severity: "high",
      titleZh: "营运车电池鼓包/漏液/绝缘故障集中暴露",
      summaryZh:
        "媒体称多辆营运 AION S 日常跑单中出现电芯鼓包、漏液、绝缘故障；第三方检测在排除外力后指向内部制造缺陷口径（待官方技术结论）。",
      statusZh: "舆情+厂家质保升级公告",
      asOfZh: "2026-07",
      opsHintZh:
        "高频快充+深度放电是故障诱因叙事；墨网约工况类似，资产卡须强制记录电池 SN 与 SOH 基线，BMS 告警接入。",
      sourceIds: ["aion-s-177ah-yoojia", "aion-s-177ah-people"],
    },
    {
      id: "es-warranty-upgrade",
      kind: "media",
      severity: "mid",
      titleZh: "质保升级：营运电池延至约8年/30万公里口径",
      summaryZh:
        "厂家公告对涉事177Ah车型质保服务升级（营运延保、免费检测维修换包、超时营运补贴等）；覆盖 S/V/Y 搭载177Ah 车型口径。",
      statusZh: "政策已发·细则以公告为准",
      asOfZh: "2026-07",
      opsHintZh:
        "国内延保不自动覆盖墨西哥；跨境须单独谈延保/本地服务商能力，否则残值与停运风险由车队自担。",
      sourceIds: ["aion-s-177ah-autohome", "aion-s-177ah-people"],
    },
    {
      id: "es-ops-drag-residual",
      kind: "media",
      severity: "mid",
      titleZh: "营运车拖累二手保值（非单次事故）",
      summaryZh:
        "天天拍车等成交口径显示 AION S 中短期保值偏低，市场解释常含营运车占比拖累；与电池舆情叠加会进一步压制残值预期。",
      statusZh: "结构性市场因素",
      asOfZh: "平台摘录",
      opsHintZh:
        "投残值模型须分营运/非营运情景；墨专车退出渠道若薄，残值假设宜更保守。",
      sourceIds: ["ttpai-aion-s-residual"],
    },
  ];
}

function riskNewsUt(): RiskNewsItem[] {
  return [
    {
      id: "ut-no-samr-recall",
      kind: "recall",
      severity: "low",
      titleZh: "未见国家备案召回公告（截至检索时点）",
      summaryZh:
        "公开检索未见 AION UT 国家级召回正式公示；风险主要来自投诉个案与新品质量波动，而非已备案批量召回。",
      statusZh: "无召回公告·持续监测",
      asOfZh: "约2026-08",
      opsHintZh: "不能理解为「零风险」；新品仍须抽检与首批小规模试投放。",
      sourceIds: ["chezhinet-ut"],
    },
    {
      id: "ut-resonance",
      kind: "complaint",
      severity: "mid",
      titleZh: "投诉多发：行驶低频共振",
      summaryZh:
        "车质网多条：正常行驶车身低频共振；有投诉称加装避震未解决，个别关联头晕耳鸣主观描述。",
      statusZh: "投诉个案·处理反馈中",
      asOfZh: "2026-02–06",
      opsHintZh:
        "PDI/交车路试增加共振检查项；批量出现则停投该批次并追溯底盘/轮胎供应商。",
      sourceIds: ["chezhinet-ut"],
    },
    {
      id: "ut-ivi-crash",
      kind: "complaint",
      severity: "mid",
      titleZh: "投诉多发：车机黑屏/花屏/重启",
      summaryZh:
        "车质网投诉集中于车机自动重启、黑屏无法使用、卡顿花屏，直接影响导航与接单。",
      statusZh: "投诉个案",
      asOfZh: "2026-02–06",
      opsHintZh:
        "快车依赖车机；合同应约定软件刷写 SLA 与备机，故障率超阈值可拒收/扣款。",
      sourceIds: ["chezhinet-ut"],
    },
    {
      id: "ut-motor-noise",
      kind: "complaint",
      severity: "mid",
      titleZh: "投诉：驱动电机行驶异响",
      summaryZh: "有车质网投诉指向驱动电机行驶中异响严重，属动力总成体验/潜在故障线索。",
      statusZh: "投诉个案",
      asOfZh: "2026-04",
      opsHintZh: "到货路试听诊；异响车不得投放营运，留存音视频作索赔证据。",
      sourceIds: ["chezhinet-ut"],
    },
    {
      id: "ut-no-major-crash-news",
      kind: "accident",
      severity: "low",
      titleZh: "未检索到车系级重大事故召回新闻",
      summaryZh:
        "相对 AION S 的177Ah 批量电池事件，UT 公开侧更多是质量投诉而非重大事故/火灾召回报道；仍须本地保险与事故定损流程单独建。",
      statusZh: "监测结论·非保证",
      asOfZh: "约2026-08",
      opsHintZh: "墨侧仍按高里程营运假设买足三者/车损；事故数据进资产卡模块7。",
      sourceIds: ["chezhinet-ut", "dongchedi-aion-ut"],
    },
  ];
}

/** AION S（ES 国内代理）残值市场线：天天拍车成交保值率锚点；Y6+ 为长尾递减示意（非持平） */
const RESIDUAL_AION_S_FAIR: ResidualCurvePoint[] = [
  { year: 0, ratePct: 100 },
  { year: 1, ratePct: 52 },
  { year: 2, ratePct: 35.4 },
  { year: 3, ratePct: 28 },
  { year: 4, ratePct: 23.6 },
  { year: 5, ratePct: 20 },
  { year: 6, ratePct: 17.2 },
  { year: 7, ratePct: 14.8 },
  { year: 8, ratePct: 12.8 },
  { year: 9, ratePct: 11.2 },
  { year: 10, ratePct: 9.8 },
  { year: 11, ratePct: 8.8 },
  { year: 12, ratePct: 8 },
];

/** 中国纯电行业残值粗线；Y6+ 按末段衰减趋缓续写，不作平台持平 */
const RESIDUAL_CN_BEV_INDUSTRY: ResidualCurvePoint[] = [
  { year: 0, ratePct: 100 },
  { year: 1, ratePct: 68 },
  { year: 2, ratePct: 52 },
  { year: 3, ratePct: 43 },
  { year: 4, ratePct: 36 },
  { year: 5, ratePct: 30 },
  { year: 6, ratePct: 26 },
  { year: 7, ratePct: 22.5 },
  { year: 8, ratePct: 19.5 },
  { year: 9, ratePct: 17 },
  { year: 10, ratePct: 15 },
  { year: 11, ratePct: 13.5 },
  { year: 12, ratePct: 12 },
];

/** UT 过新：小型纯电示意；Y6+ 长尾递减，置信度低 */
const RESIDUAL_AION_UT_TENTATIVE: ResidualCurvePoint[] = [
  { year: 0, ratePct: 100 },
  { year: 1, ratePct: 70 },
  { year: 2, ratePct: 55 },
  { year: 3, ratePct: 42 },
  { year: 4, ratePct: 34 },
  { year: 5, ratePct: 28 },
  { year: 6, ratePct: 24 },
  { year: 7, ratePct: 20.8 },
  { year: 8, ratePct: 18.2 },
  { year: 9, ratePct: 16 },
  { year: 10, ratePct: 14.2 },
  { year: 11, ratePct: 12.8 },
  { year: 12, ratePct: 11.5 },
];


/** 统一信源库（备查）；业务字段用 sourceIds 挂靠 */
type SourceKind =
  | "model_xlsx"
  | "doc"
  | "oem"
  | "valuation"
  | "media"
  | "regulator"
  | "review"
  | "spec";

type SourceRecord = {
  id: string;
  titleZh: string;
  publisherZh: string;
  kind: SourceKind;
  url?: string;
  asOf: string;
  geography: string;
  noteZh: string;
  tags: string[];
};

const SOURCE_LIB: SourceRecord[] = [
  {
    id: "fenbang-station-xlsx",
    titleZh: "墨西哥项目测算-充电桩(10%对外+20%对内)",
    publisherZh: "沣邦",
    kind: "model_xlsx",
    asOf: "测算表版本",
    geography: "墨西哥",
    noteZh:
      "《副本墨西哥项目测算-充电桩8.12(含IRR)》·「1.1假设-充电桩」：外用利用10%/收费8、内用利用20%/收费7；耗电系数1.08、电成本3；场租81200/月、运维包160000/月；小桔佣金约外收10%。中型站默认对齐此表，大/小站按 opsScale 缩放租金与运维。",
    tags: ["场站", "Capex", "测算", "1.1假设"],
  },
  {
    id: "fenbang-dae-xlsx",
    titleZh: "DAE-200 车辆测算表",
    publisherZh: "沣邦",
    kind: "model_xlsx",
    asOf: "测算表版本",
    geography: "墨西哥",
    noteZh:
      "《副本墨西哥项目测算-DAE-200台(含IRR)》·「1.1假设-DAE-专车」单位前提：含税集采 473800 / 指导 559900；上牌 4000+GPS 3000；利用 75%、班次 2、工时 9.5h、周 6 天、IPH 210、补贴 5%；司机 26000/人·月（两班×利用率→约 39000）；保险 25000/年、保养 1500/月、软件 500/月、易损 12000+16000+20800/年、车位 280/月；电耗 15、电价 7、残值 10%、期限 60 月。里程收入=IPH×工时×天×班次×(52/12)×利用率（表内「周流水」为满负荷，现金流乘利用率）。单位路径 × 投放节奏 → 对齐组合层。",
    tags: ["车辆", "DAE", "测算", "IRR", "组合叠加", "含税价", "1.1假设"],
  },
  {
    id: "fenbang-lto-xlsx",
    titleZh: "LTO 快车测算表",
    publisherZh: "沣邦",
    kind: "model_xlsx",
    asOf: "待附案例表",
    geography: "墨西哥",
    noteZh:
      "快车 LTO/RTO 尚无与 DAE「1.1假设」同级的已附 Excel；画布现用对照假设（出租率/租金/押金），置信度低于 DAE/充电桩包，待补表后强制校验。",
    tags: ["车辆", "LTO", "测算", "待双端"],
  },
  {
    id: "ev-logic-docx",
    titleZh: "EV数据逻辑梳理",
    publisherZh: "项目材料",
    kind: "doc",
    asOf: "材料版",
    geography: "墨西哥/综合",
    noteZh: "组合测算字段与口径说明",
    tags: ["口径", "测算"],
  },
  {
    id: "mx-liva-iva16",
    titleZh: "Ley del IVA · 一般税率 16%",
    publisherZh: "México · LIVA / SAT",
    kind: "regulator",
    url: "https://www.sat.gob.mx/",
    asOf: "2026 对照",
    geography: "墨西哥",
    noteZh:
      "联邦 IVA 一般税率 16%（进口同率）。场站等未税录入 SKU 购物车另加 IVA；对齐案例表的车辆（pricesIncludeVat）购入价已是含税现金，不再加税（可反拆估列未税）。押金通常不征 IVA。北部边境刺激有效税率 8% 未默认启用。",
    tags: ["税务", "IVA", "口径"],
  },
  {
    id: "bitauto-aion-es-hk",
    titleZh: "广汽 Aion ES 参数设定（港）",
    publisherZh: "BitAuto Hong Kong",
    kind: "spec",
    url: "https://www.bitauto.hk/zh/gac/aion-es/config/",
    asOf: "2025–2026 公开页",
    geography: "香港/海外",
    noteZh: "4810×1880×1545、55.2kWh、NEDC 442km、100kW/225Nm",
    tags: ["AION ES", "规格"],
  },
  {
    id: "gac-aion-es-sa",
    titleZh: "GAC Motor AION ES 产品页",
    publisherZh: "GAC 海外经销",
    kind: "oem",
    url: "https://en.gacmotorsaudi.com/new-cars/aion-es/",
    asOf: "2026 公开页",
    geography: "海外",
    noteZh: "电池/续航/质保海外口径（8年/16万·电池8年/20万）",
    tags: ["AION ES", "规格", "质保"],
  },
  {
    id: "dongchedi-aion-s",
    titleZh: "AION S 车系与懂车分",
    publisherZh: "懂车帝",
    kind: "review",
    url: "https://www.dongchedi.com/auto/series/3101",
    asOf: "约2026-08",
    geography: "中国",
    noteZh: "ES 国内近亲/代理车系；懂车分约3.66（良好）·451评",
    tags: ["AION S", "AION ES", "口碑", "规格"],
  },
  {
    id: "dongchedi-aion-ut",
    titleZh: "AION UT 车系与懂车分",
    publisherZh: "懂车帝",
    kind: "review",
    url: "https://www.dongchedi.com/auto/series/25014",
    asOf: "约2026-08",
    geography: "中国",
    noteZh: "懂车分约3.38（良好）·约104评；series/25014",
    tags: ["AION UT", "口碑", "规格"],
  },
  {
    id: "autohome-ut-config",
    titleZh: "埃安 AION UT 鹦鹉龙配置分析",
    publisherZh: "汽车之家·车家号",
    kind: "media",
    url: "https://chejiahao.autohome.com.cn/info/19495453",
    asOf: "上市期报道",
    geography: "中国",
    noteZh: "尺寸/续航/配置档位辅证",
    tags: ["AION UT", "规格"],
  },
  {
    id: "ttpai-aion-s-residual",
    titleZh: "AION S 二手成交保值率（1–2年/3–4年）",
    publisherZh: "天天拍车",
    kind: "valuation",
    url: "http://www.ttpai.cn/zixun/zhishi-926462",
    asOf: "平台报道摘录",
    geography: "中国",
    noteZh: "1–2年约35.42%；3–4年约23.64%；含营运车拖累",
    tags: ["AION S", "残值"],
  },
  {
    id: "che300-platform",
    titleZh: "车300 二手车评估平台",
    publisherZh: "车300",
    kind: "valuation",
    url: "https://che300.com/",
    asOf: "长期入口",
    geography: "中国",
    noteZh: "单车VIN估值入口；本画布残值曲线未直接拉API，作备查",
    tags: ["残值", "估值"],
  },
  {
    id: "libro-azul-guia-ebc",
    titleZh: "Libro Azul（Guía EBC）· 待合作评估机构",
    publisherZh: "Guía EBC / Libro Azul",
    kind: "valuation",
    url: "https://www.libroazul.com/inicio",
    asOf: "机构备查·待商务对接",
    geography: "墨西哥",
    noteZh:
      "墨西哥汽车估值事实标准（地位类中国车300）。非政府文件；金融抵押、保险全损/盗抢、政务与车商收车广泛采用。双轨：Compra 收购价=审慎 LTV/理赔；Venta 零售价=市场参考。官网可阅产品说明，无公开可抓取单车价渠道；残值对表依赖未来商务合作/订阅授权，本画布不直连、不爬取。",
    tags: ["待合作", "评估机构", "残值", "墨西哥", "LTV"],
  },
  {
    id: "libro-azul-coop-track",
    titleZh: "Libro Azul 合作跟进备忘",
    publisherZh: "项目侧",
    kind: "doc",
    asOf: "待启动",
    geography: "墨西哥",
    noteZh:
      "用途：融资租赁 / 二手退出 / LTV 与全损口径对齐收购价（Compra）。交付物预期：版本级收购价·零售价、车队批量估值、争议复核路径。当前无 API/抓取落库，仅机构关系与口径预置。",
    tags: ["待合作", "评估机构", "融资租赁", "墨西哥"],
  },
  {
    id: "cata-bev-residual-2025",
    titleZh: "中国新能源汽车保值率相关公开报告",
    publisherZh: "中国汽车流通协会等",
    kind: "regulator",
    asOf: "2025 H1/月报量级",
    geography: "中国",
    noteZh: "纯电三年保值率约43%量级；用于行业对照粗线",
    tags: ["残值", "行业"],
  },
  {
    id: "che300-monthly-2025",
    titleZh: "车300 中国汽车保值率月报",
    publisherZh: "车300",
    kind: "valuation",
    url: "https://www.che300.com/companyNews/detail?uuid=e3f814b407bb83c151dc42986ed33232",
    asOf: "2025-06 等",
    geography: "中国",
    noteZh: "行业保值率分化与新能源政策背景",
    tags: ["残值", "行业"],
  },
  {
    id: "media-aion-s-1m",
    titleZh: "AION S 累计销量破百万等媒体口径",
    publisherZh: "公开媒体",
    kind: "media",
    url: "https://auto.sina.cn/2026-08-09/detail-inimtpwi3316844.d.html",
    asOf: "约2026-08",
    geography: "中国",
    noteZh: "保有/累计销量量级；非公安部登记保有，标待双端",
    tags: ["AION S", "保有量"],
  },
  {
    id: "bitauto-ut-sales",
    titleZh: "AION UT 销量/累计销售报道",
    publisherZh: "BitAuto等",
    kind: "media",
    url: "https://www.bitauto.com/article/1003109746375/",
    asOf: "2025–2026",
    geography: "中国",
    noteZh: "2025全年约5.09万；2026上半年累计约2.65万量级",
    tags: ["AION UT", "保有量", "销量"],
  },
  {
    id: "gasgoo-aion-202601",
    titleZh: "2026年1月埃安分车型销量",
    publisherZh: "盖世汽车/乘联会链路",
    kind: "media",
    url: "https://auto.gasgoo.com/qcxl/article/79158.html",
    asOf: "2026-01",
    geography: "中国",
    noteZh: "UT 当月批发等；口径为狭义乘用车批发",
    tags: ["销量", "AION UT"],
  },
  {
    id: "amia-mx-ev-track",
    titleZh: "墨西哥汽车工业协会（AMIA）产销/进口跟踪入口",
    publisherZh: "AMIA",
    kind: "regulator",
    url: "https://www.amia.com.mx/",
    asOf: "长期入口",
    geography: "墨西哥",
    noteZh:
      "墨市品牌/车系级保有极少公开；产销与轻型车进口可作交付累计量级交叉。本画布墨保有为示意下限，待双端。",
    tags: ["墨西哥", "保有量", "销量", "待双端"],
  },
  {
    id: "mx-parc-aion-es-proxy",
    titleZh: "AION ES/S 墨西哥累计交付·进口量级（项目示意）",
    publisherZh: "项目侧示意",
    kind: "media",
    url: "https://www.amia.com.mx/",
    asOf: "示意·约2026",
    geography: "墨西哥",
    noteZh:
      "无公开车系在籍保有；以约 1.2 千台量级作累计交付/进口下限示意，置信度低，须经销/进口统计双端。",
    tags: ["AION ES", "墨西哥", "保有量", "待双端"],
  },
  {
    id: "mx-parc-aion-ut-proxy",
    titleZh: "AION UT 墨西哥累计交付·进口量级（项目示意）",
    publisherZh: "项目侧示意",
    kind: "media",
    url: "https://www.amia.com.mx/",
    asOf: "示意·约2026",
    geography: "墨西哥",
    noteZh:
      "UT 海外更短；约数百台量级作极保守下限示意，置信度低，待双端。",
    tags: ["AION UT", "墨西哥", "保有量", "待双端"],
  },
  {
    id: "aion-s-177ah-people",
    titleZh: "埃安售后：177Ah 电池召回流程已启动",
    publisherZh: "人民网",
    kind: "media",
    url: "http://gd.people.com.cn/n2/2026/0728/c123932-41652496.html",
    asOf: "2026-07",
    geography: "中国",
    noteZh: "营运 AION S 电池故障；质保升级+召回备案流程",
    tags: ["AION S", "召回", "电池", "事故风险"],
  },
  {
    id: "aion-s-177ah-yoojia",
    titleZh: "AION S 电池事件：启动召回申请与延保",
    publisherZh: "有驾",
    kind: "media",
    url: "https://www.yoojia.com/article/10173920665467956843.html",
    asOf: "2026-07",
    geography: "中国",
    noteZh: "中创新航177Ah；鼓包/漏液/绝缘；总局公示待挂",
    tags: ["AION S", "召回", "电池"],
  },
  {
    id: "aion-s-177ah-autohome",
    titleZh: "埃安质保升级与召回流程说明",
    publisherZh: "汽车之家·车家号",
    kind: "media",
    url: "https://chejiahao.autohome.com.cn/info/26061777",
    asOf: "2026-07",
    geography: "中国",
    noteZh: "覆盖 S/V/Y 搭载177Ah 车型；法定召回须备案公示",
    tags: ["AION S", "召回", "电池"],
  },
  {
    id: "chezhinet-ut",
    titleZh: "车质网 AION UT 投诉与口碑",
    publisherZh: "车质网",
    kind: "review",
    url: "https://www.12365auto.com/series/c-4151-1-1.shtml",
    asOf: "约2026-06",
    geography: "中国",
    noteZh: "低频共振、车机黑屏、异响等投诉个案；未见国家召回公告",
    tags: ["AION UT", "投诉", "口碑", "事故风险"],
  },
  {
    id: "chezhinet-ut-series",
    titleZh: "车质网 AION UT 车系页",
    publisherZh: "车质网",
    kind: "review",
    url: "https://m.12365auto.com/series/4151/index.shtml",
    asOf: "约2026-02",
    geography: "中国",
    noteZh: "口碑摘录：续航扎实/电耗低 vs 胎噪风噪/异味",
    tags: ["AION UT", "口碑"],
  },
  {
    id: "didi-fleet-open-api",
    titleZh: "滴滴全球 Fleet Open API 接口文档（中文版）",
    publisherZh: "滴滴 / DiDi Global Fleet",
    kind: "doc",
    url: "https://fleet-api.didiglobal.com/openapi/example/",
    asOf: "译本 2026-06-03 · 原文更新至 2026-03-19",
    geography: "墨西哥/全球车队",
    noteZh:
      "车队 Open API：司机/车辆/人车绑定/订单行程/代扣与状态回调。本画布落为运营底表字段与接口目录，不直连、不存 AK/SK。",
    tags: ["车运营", "Fleet", "API", "墨西哥", "底表"],
  },
  {
    id: "gac-hk-aion-es-spec",
    titleZh: "AION ES 规格（GAC 香港）",
    publisherZh: "GAC Group HK",
    kind: "oem",
    url: "https://www.gacgroup.com/zh-hk/configuration/aion-es/2024",
    asOf: "2024–2026 公开页",
    geography: "香港/海外",
    noteZh: "LFP 55.2kWh · 100kW/225N·m · NEDC 442km · 弹匣电池体系",
    tags: ["AION ES", "规格", "电池", "电机"],
  },
  {
    id: "qesot-aion-es-tz184",
    titleZh: "Aion ES 55.2 kWh 电机型号 TZ184XYA2002",
    publisherZh: "Qesot / Auto-Data 系参配汇整",
    kind: "spec",
    url: "https://qesot.com/cars/en/product/55047/",
    asOf: "2023 款公开参配汇整",
    geography: "海外",
    noteZh: "前置永磁同步 · TZ184XYA2002 · 136Hp/225Nm · 电池电压约326.4V",
    tags: ["AION ES", "电机", "规格"],
  },
  {
    id: "gac-magazine-battery",
    titleZh: "GAC Magazine Battery（弹匣电池）技术说明",
    publisherZh: "GAC Europe",
    kind: "oem",
    url: "https://www.gacgroup.com/en-eu/news/article/ev-battery-technology-16",
    asOf: "公开技术页",
    geography: "全球/埃安体系",
    noteZh: "舱格式隔离+耐高温壳；针刺不起火叙事；PACK 工艺属埃安体系",
    tags: ["弹匣电池", "电池", "AION ES", "AION UT"],
  },
  {
    id: "gac-ruipai-idu",
    titleZh: "成立锐湃动力：IDU 电驱自研自产",
    publisherZh: "广汽集团",
    kind: "oem",
    url: "https://www.gac.com.cn/cn/news/detail?baseid=18490",
    asOf: "公司新闻",
    geography: "中国",
    noteZh: "埃安控股锐湃；IDU 含电机+电控；2018 深度集成三合一电驱口径",
    tags: ["电控", "电机", "锐湃", "AION"],
  },
  {
    id: "bitauto-aion-ut-config",
    titleZh: "埃安 UT 参数配置（BitAuto）",
    publisherZh: "BitAuto Global",
    kind: "spec",
    url: "https://www.bitauto.com/zh-global/aion/ut/config/",
    asOf: "2025 款公开参配",
    geography: "中国/全球参配汇整",
    noteZh: "电机 TZ180XS134 · 100kW · 电芯品牌因湃 · LFP 约34.8/44.1kWh",
    tags: ["AION UT", "电池", "电机", "规格"],
  },
  {
    id: "autohome-ut-miit",
    titleZh: "AION UT 工信部申报：因湃电池 + 汇川电机",
    publisherZh: "汽车之家·车家号（工信部申报摘录）",
    kind: "regulator",
    url: "https://chejiahao.autohome.com.cn/info/19462696",
    asOf: "2025-02 申报公开摘录",
    geography: "中国",
    noteZh:
      "因湃电池（单体/总成）· TZ180XS134 · 苏州汇川联合动力 · 峰值100kW/额定33kW",
    tags: ["AION UT", "电池", "电机", "工信部"],
  },
  {
    id: "ruipai-m10-ut",
    titleZh: "锐湃 M10 N合一电驱下线 · 称首搭埃安 UT",
    publisherZh: "NE时代",
    kind: "media",
    url: "https://www.ne-time.cn/web/article/34986",
    asOf: "2024-12",
    geography: "中国",
    noteZh: "与工信部汇川电机口径并存 → 标待双端；电控随 IDU 总成",
    tags: ["AION UT", "电机", "电控", "锐湃", "待双端"],
  },
  {
    id: "aionhk-ut-spec",
    titleZh: "AION UT 香港规格（Elite/Premium）",
    publisherZh: "AION HK / 铛铛",
    kind: "oem",
    url: "https://aionhk.com/aion-ut/",
    asOf: "香港公开页",
    geography: "香港/海外",
    noteZh: "LFP弹匣 · 44.12/60kWh · 100/150kW · 145/210Nm · NEDC 400/500",
    tags: ["AION UT", "规格", "电池", "电机"],
  },
];

function getSource(id: string): SourceRecord | undefined {
  return SOURCE_LIB.find((s) => s.id === id);
}

/** 信源小编号：S01、S02…（按 SOURCE_LIB 顺序，稳定可点） */
function sourceCiteCode(id: string): string {
  const i = SOURCE_LIB.findIndex((s) => s.id === id);
  return i >= 0 ? `S${String(i + 1).padStart(2, "0")}` : "S??";
}

/** 备注旁展示用：[S01] */
function sourceCiteBracket(id: string): string {
  return `[${sourceCiteCode(id)}]`;
}

/**
 * 滴滴 Fleet Open API ×《EV数据逻辑梳理》融合底表。
 * 用途：车运营模块主数据字典；未来对接时按 apiPath 映射，不在此存密钥。
 */
type FleetFieldMapRow = {
  domainZh: string;
  evField: string;
  evLabelZh: string;
  didiField: string;
  didiApi: string;
  opsNode: string;
  required: "ev" | "didi" | "both" | "either";
  noteZh: string;
};

type FleetApiCatalogRow = {
  groupZh: string;
  method: string;
  path: string;
  titleZh: string;
  opsHintZh: string;
};

const DIDI_FLEET_BASE = {
  asOf: "2026-06-03",
  docTitleZh: "滴滴全球 Fleet Open API（中文译本）",
  stagingHost: "pre-fleet-open-api.didiglobal.com",
  prodHost: "fleet-open-api.didiglobal.com",
  callbacks: ["VEHICLE_STATUS_UPDATE", "DRIVER_STATUS_UPDATE"] as const,
  apis: [
    {
      groupZh: "司机",
      method: "POST",
      path: "/openapi/fleet/cfp/driver/bindDriver",
      titleZh: "上传/绑定司机",
      opsHintZh: "匹配司机节点；strategy_type 资金策略",
    },
    {
      groupZh: "司机",
      method: "POST",
      path: "/openapi/fleet/cfp/strategy/edit",
      titleZh: "编辑司机资金策略",
      opsHintZh: "租金/合同金额调整",
    },
    {
      groupZh: "司机",
      method: "POST",
      path: "/openapi/fleet/cfp/driver/unbindDriver",
      titleZh: "解绑司机",
      opsHintZh: "漏斗掉队或合同终止",
    },
    {
      groupZh: "司机",
      method: "POST",
      path: "/openapi/fleet/cfp/driver/deleteDriver",
      titleZh: "删除司机",
      opsHintZh: "未绑定方可删，便于再邀",
    },
    {
      groupZh: "司机",
      method: "GET",
      path: "/openapi/fleet/cfp/driver/list",
      titleZh: "司机列表",
      opsHintZh: "driver_status / bind_status / daily_status 观测",
    },
    {
      groupZh: "行程",
      method: "GET",
      path: "/openapi/fleet/cfp/order/driverOrderList",
      titleZh: "司机行程报告",
      opsHintZh: "上路后在线时长、接单完成率",
    },
    {
      groupZh: "行程",
      method: "GET",
      path: "/openapi/fleet/cfp/order/getCompanyOrderDetail",
      titleZh: "订单详情",
      opsHintZh: "单笔订单·车牌·车 ID·收入核对",
    },
    {
      groupZh: "行程",
      method: "GET",
      path: "/openapi/fleet/cfp/finance/list",
      titleZh: "司机收入信息",
      opsHintZh: "上路后收入明细；可校准 IPH",
    },
    {
      groupZh: "车辆",
      method: "GET",
      path: "/openapi/fleet/cfp/city/list",
      titleZh: "开放城市",
      opsHintZh: "addCar 前选 city_id",
    },
    {
      groupZh: "车辆",
      method: "GET",
      path: "/openapi/fleet/cfp/car/color/list",
      titleZh: "车辆颜色",
      opsHintZh: "addCar 前选 car_color_id",
    },
    {
      groupZh: "车辆",
      method: "POST",
      path: "/openapi/fleet/cfp/car/addCar",
      titleZh: "添加车辆",
      opsHintZh: "整备/上牌后推送；需 plate_no + customized_car_id",
    },
    {
      groupZh: "车辆",
      method: "GET",
      path: "/openapi/fleet/cfp/car/document/list",
      titleZh: "车辆证件清单",
      opsHintZh: "上牌材料清单",
    },
    {
      groupZh: "车辆",
      method: "POST",
      path: "/openapi/fleet/cfp/car/addDocument",
      titleZh: "上传车辆证件",
      opsHintZh: "证件审核；jpeg/png/pdf",
    },
    {
      groupZh: "车辆",
      method: "GET",
      path: "/openapi/fleet/cfp/car/list",
      titleZh: "车辆列表",
      opsHintZh: "car_audit_status 观测",
    },
    {
      groupZh: "车辆",
      method: "GET",
      path: "/openapi/fleet/cfp/car/detail",
      titleZh: "车辆详情+证件审核",
      opsHintZh: "绑定司机信息一并返回",
    },
    {
      groupZh: "车辆",
      method: "POST",
      path: "/openapi/fleet/cfp/car/delete",
      titleZh: "删除车辆",
      opsHintZh: "退出平台侧档案",
    },
    {
      groupZh: "人车",
      method: "POST",
      path: "/openapi/fleet/cfp/driver/bindCar",
      titleZh: "车辆绑定司机",
      opsHintZh: "匹配节点完成态；用 customized_car_id",
    },
    {
      groupZh: "人车",
      method: "POST",
      path: "/openapi/fleet/cfp/driver/unbindCar",
      titleZh: "车辆解绑司机",
      opsHintZh: "换人/掉队",
    },
    {
      groupZh: "财务",
      method: "GET",
      path: "/openapi/fleet/cfp/finance/withholdRecord",
      titleZh: "租金代扣记录",
      opsHintZh: "LTO/RTO 资金回流核对（MXN）",
    },
  ] as FleetApiCatalogRow[],
  fieldMap: [
    {
      domainZh: "车身份",
      evField: "niv",
      evLabelZh: "NIV/车架号",
      didiField: "—（平台不收 VIN）",
      didiApi: "—",
      opsNode: "付款购车·资产确权",
      required: "ev",
      noteZh: "EV 主键；质押/Repuve；滴滴侧用 customized_car_id",
    },
    {
      domainZh: "车身份",
      evField: "batterySn",
      evLabelZh: "电池 SN",
      didiField: "—",
      didiApi: "—",
      opsNode: "付款购车·车电分拆",
      required: "ev",
      noteZh: "EV 主键；平台无此字段",
    },
    {
      domainZh: "车身份",
      evField: "customizedCarId",
      evLabelZh: "我方车辆 ID",
      didiField: "customized_car_id",
      didiApi: "car/addCar · car/list · bindCar",
      opsNode: "整备后上架平台",
      required: "both",
      noteZh: "建议=资产卡 id；人车绑定必填",
    },
    {
      domainZh: "车身份",
      evField: "plateNo",
      evLabelZh: "车牌",
      didiField: "plate_no / plate_number",
      didiApi: "car/addCar · driver/list.bind_car_info",
      opsNode: "整备/上牌",
      required: "both",
      noteZh: "addCar 必填；bindCar 已改用 car_id 不再传车牌",
    },
    {
      domainZh: "车身份",
      evField: "customsNo",
      evLabelZh: "报关单号",
      didiField: "—",
      didiApi: "—",
      opsNode: "报关清关",
      required: "ev",
      noteZh: "漏斗清关节点证据",
    },
    {
      domainZh: "车身份",
      evField: "firstOpDate",
      evLabelZh: "首次上路日",
      didiField: "car_reg_time（近似）",
      didiApi: "car/list",
      opsNode: "上路出收入",
      required: "either",
      noteZh: "我方记真实首收日；平台注册日可交叉",
    },
    {
      domainZh: "平台车辆",
      evField: "didiCityId",
      evLabelZh: "开放城市 ID",
      didiField: "city_id",
      didiApi: "city/list · car/addCar",
      opsNode: "整备/上架",
      required: "didi",
      noteZh: "addCar 必填",
    },
    {
      domainZh: "平台车辆",
      evField: "didiCarColorId",
      evLabelZh: "颜色 ID",
      didiField: "car_color_id",
      didiApi: "car/color/list · car/addCar",
      opsNode: "整备/上架",
      required: "didi",
      noteZh: "addCar 必填",
    },
    {
      domainZh: "平台车辆",
      evField: "didiCarAuditStatus",
      evLabelZh: "车辆审核状态",
      didiField: "car_audit_status",
      didiApi: "car/list · VEHICLE_STATUS_UPDATE",
      opsNode: "上路门禁",
      required: "didi",
      noteZh: "Approved 前不宜计入稳定收入",
    },
    {
      domainZh: "司机",
      evField: "customizedDriverId",
      evLabelZh: "我方司机 ID",
      didiField: "customized_driver_id",
      didiApi: "driver/bindDriver · bindCar",
      opsNode: "匹配司机/上架",
      required: "both",
      noteZh: "DAE 雇佣/承租人均可映射",
    },
    {
      domainZh: "司机",
      evField: "driverPhone",
      evLabelZh: "司机手机",
      didiField: "driver_phone_number",
      didiApi: "driver/bindDriver · driver/list",
      opsNode: "匹配司机",
      required: "didi",
      noteZh: "含区号，如 +52…",
    },
    {
      domainZh: "司机",
      evField: "driverStatus",
      evLabelZh: "司机审核状态",
      didiField: "driver_status",
      didiApi: "driver/list · DRIVER_STATUS_UPDATE",
      opsNode: "匹配门禁",
      required: "didi",
      noteZh: "Approved 才可稳定绑车",
    },
    {
      domainZh: "司机",
      evField: "driverBindStatus",
      evLabelZh: "车队绑定状态",
      didiField: "bind_status",
      didiApi: "driver/list",
      opsNode: "匹配",
      required: "didi",
      noteZh: "Linked / Unlinked",
    },
    {
      domainZh: "司机",
      evField: "driverDailyStatus",
      evLabelZh: "当日工作状态",
      didiField: "daily_status",
      didiApi: "driver/list",
      opsNode: "上路运营",
      required: "didi",
      noteZh: "In service / Idle / Offline",
    },
    {
      domainZh: "资金",
      evField: "—",
      evLabelZh: "租金代扣（MXN）",
      didiField: "amount / amount_withhold / amount_debt",
      didiApi: "finance/withholdRecord",
      opsNode: "上路后回款",
      required: "didi",
      noteZh: "strategy_type=2 时；与组合 LTO 租金对照",
    },
    {
      domainZh: "行程",
      evField: "—",
      evLabelZh: "订单完成额",
      didiField: "completed_order_amount（分）",
      didiApi: "order/driverOrderList",
      opsNode: "上路后产能",
      required: "didi",
      noteZh: "可校准 IPH/利用率假设",
    },
  ] as FleetFieldMapRow[],
};

/** 规格行挂靠的信源 id（优先 sourceIds；兼容旧「信源」行用 · 拼 id） */
function resolveSpecSourceIds(row: ProductSpecRow): string[] {
  if (row.sourceIds && row.sourceIds.length > 0) return row.sourceIds;
  if (row.id !== "source") return [];
  return row.valueZh
    .split(/[·,，;\s]+/)
    .map((x) => x.trim())
    .filter((x) => Boolean(x) && Boolean(getSource(x)));
}

/** 紧凑规格清单：标签左固定宽 + 取值折行 + 状态 Pill（避免三列表格状态竖排） */
function SpecSheetList(props: {
  rows: ProductSpecRow[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderCites: (ids: string[]) => any;
  borderColor: string;
  /** 某规格行下方附加说明（如运营补能提示） */
  footnotesById?: Record<string, string>;
}) {
  const { rows, renderCites, borderColor, footnotesById } = props;
  return (
    <Stack
      gap={0}
      style={{
        borderTop: `1px solid ${borderColor}`,
      }}
    >
      {rows.map((r) => {
        const citeIds = resolveSpecSourceIds(r);
        const isSourceOnly =
          r.id === "source" || (!r.valueZh && citeIds.length > 0);
        const footnote = footnotesById?.[r.id];
        return (
          <Row
            key={r.id}
            gap={12}
            align="start"
            style={{
              padding: "8px 0",
              borderBottom: `1px solid ${borderColor}`,
            }}
          >
            <Text
              tone="secondary"
              style={mergeStyle(TYPE.label, {
                width: "min(96px, 28%)",
                flexShrink: 0,
                paddingTop: 2,
                overflowWrap: "break-word",
              })}
            >
              {r.labelZh}
            </Text>
            <Stack gap={3} style={{ flex: 1, minWidth: 0 }}>
              {!isSourceOnly && (
                <Text style={mergeStyle(TYPE.body, { wordBreak: "break-word" })}>
                  {r.valueZh || "—"}
                </Text>
              )}
              {citeIds.length > 0 && (
                <Row gap={4} align="center" wrap>
                  {renderCites(citeIds)}
                </Row>
              )}
              {footnote ? (
                <Text
                  tone="tertiary"
                  style={mergeStyle(TYPE.caption, { marginTop: 2 })}
                >
                  {footnote}
                </Text>
              ) : null}
            </Stack>
          </Row>
        );
      })}
    </Stack>
  );
}

function emptyIdentity(partial?: Partial<AssetIdentityFill>): AssetIdentityFill {
  return {
    niv: "",
    plateNo: "",
    configVariantId: "",
    modelFullZh: "",
    bodyFactoryDate: "",
    firstOpDate: "",
    batterySn: "",
    batteryKwh: "",
    batteryFactoryDate: "",
    batteryMakerZh: "",
    batteryCostMxn: "",
    tireBrandZh: "",
    tireSupplierZh: "",
    tireSpecZh: "",
    purchaseContractNo: "",
    customsNo: "",
    noteZh: "",
    customizedCarId: "",
    didiCityId: "",
    didiCityName: "",
    didiCarColorId: "",
    didiCarColor: "",
    didiCarBrand: "",
    didiProductName: "",
    didiCarAuditStatus: "",
    didiCarRegTime: "",
    didiCarExpireTime: "",
    customizedDriverId: "",
    driverPhone: "",
    driverName: "",
    driverStatus: "",
    driverBindStatus: "",
    driverDailyStatus: "",
    ...partial,
  };
}

/** NIV + 电池 SN 为唯一识别必填；其余按字段文档可后续补 */
function identityMissingKeys(idFill: AssetIdentityFill): string[] {
  const miss: string[] = [];
  if (!String(idFill.niv || "").trim()) miss.push("NIV车架号");
  if (!String(idFill.batterySn || "").trim()) miss.push("电池SN");
  if (!String(idFill.configVariantId || "").trim()) miss.push("配置档");
  return miss;
}

function defaultMajorComponents(kind: "es" | "ut" | "station"): MajorComponent[] {
  if (kind === "station") {
    return [
      {
        id: "pack",
        nameZh: "充电设备",
        brandZh: "待填",
        supplierZh: "待填",
        manufacturerZh: "待填",
        specZh: "快充/慢充枪系统",
        status: "pending",
        noteZh: "场站设备品牌/供应商/OEM 三联",
      },
      {
        id: "transformer",
        nameZh: "变压器",
        brandZh: "待填",
        supplierZh: "待填",
        manufacturerZh: "待填",
        specZh: "容量 kVA 待填",
        status: "pending",
        noteZh: "并网配电关键件",
      },
      {
        id: "diesel",
        nameZh: "柴发",
        brandZh: "待填",
        supplierZh: "待填",
        manufacturerZh: "待填",
        specZh: "kVA 待填",
        status: "pending",
        noteZh: "备用电源；无则标无",
      },
    ];
  }
  if (kind === "ut") {
    return [
      {
        id: "battery",
        nameZh: "电池",
        brandZh: "弹匣电池（Magazine Battery）",
        supplierZh: "因湃电池科技（广汽埃安控股）",
        manufacturerZh: "因湃电池科技有限公司",
        specZh: "LFP · 34.8 / 44.1 kWh（随配置档；工信部约44.1–44.3）",
        status: "known",
        noteZh:
          "工信部/参配：因湃电芯+总成；须与配置档 kWh 一致；到货录电池 SN。质保：电池/电机约8年或20万km（香港公开册，先到为准）；墨合同须单列 SOH 衰减门槛与换包条款",
        sourceIds: [
          "bitauto-aion-ut-config",
          "autohome-ut-miit",
          "gac-magazine-battery",
          "aionhk-ut-spec",
        ],
      },
      {
        id: "motor",
        nameZh: "电机",
        brandZh: "永磁同步 · TZ180XS134",
        supplierZh: "苏州汇川联合动力",
        manufacturerZh: "苏州汇川联合动力系统股份有限公司",
        specZh: "额定33kW · 峰值100kW · 扭矩145N·m · FWD",
        status: "known",
        noteZh:
          "工信部申报主口径。锐湃 M10 N合一亦称首搭 UT（待双端/批次核验）",
        sourceIds: ["autohome-ut-miit", "bitauto-aion-ut-config", "ruipai-m10-ut"],
      },
      {
        id: "ecu",
        nameZh: "电控",
        brandZh: "IDU 电驱总成电控（与电机集成）",
        supplierZh: "苏州汇川联合动力（电机同体系）",
        manufacturerZh: "汇川联合动力 · 锐湃M10亦称搭UT（待双端）",
        specZh: "电机控制器随电驱总成；工信部未单列电控厂",
        status: "known",
        noteZh:
          "公开未单列电控OEM；按电驱总成同厂落库。锐湃新闻称 M10 含电控首搭 UT → 与汇川申报并存，合同/铭牌核批次",
        sourceIds: ["autohome-ut-miit", "ruipai-m10-ut", "gac-ruipai-idu"],
      },
      {
        id: "body",
        nameZh: "车身",
        brandZh: "AION",
        supplierZh: "待填（集采/贸易签约方）",
        manufacturerZh: "广汽埃安",
        specZh: "AION UT 鹦鹉龙 · 4270×1850×1575",
        status: "pending",
        noteZh: "车身/整车制造主体；供应商/签约方下单前必补",
        sourceIds: ["dongchedi-aion-ut", "bitauto-aion-ut-config"],
      },
    ];
  }
  return [
    {
      id: "battery",
      nameZh: "电池",
      brandZh: "弹匣电池（Magazine Battery）",
      supplierZh: "广汽埃安（PACK/弹匣体系）",
      manufacturerZh: "电芯厂公开未单列 · 铭牌/合同核验",
      specZh: "LFP 55.2 kWh · 约326.4V",
      status: "known",
      noteZh:
        "海外官宣 LFP+弹匣；电芯OEM须合同/铭牌。质保：电池约8年或20万km（海外经销，先到为准）；国内177Ah营运延保不自动覆盖墨西哥——合同须锁电芯型号与换包/停运补偿",
      sourceIds: [
        "gac-hk-aion-es-spec",
        "gac-magazine-battery",
        "bitauto-aion-es-hk",
        "gac-aion-es-sa",
        "aion-s-177ah-autohome",
      ],
    },
    {
      id: "motor",
      nameZh: "电机",
      brandZh: "永磁同步 · TZ184XYA2002",
      supplierZh: "广汽埃安电驱体系",
      manufacturerZh: "公开给型号未给厂名 · 同系多挂广汽系（待铭牌）",
      specZh: "前置 · 100kW / 225N·m · FWD · 最高约14000rpm",
      status: "known",
      noteZh:
        "GAC港/海外规格 100kW·225Nm；参配汇整型号 TZ184XYA2002；生产法人到货核铭牌",
      sourceIds: [
        "gac-hk-aion-es-spec",
        "qesot-aion-es-tz184",
        "bitauto-aion-es-hk",
      ],
    },
    {
      id: "ecu",
      nameZh: "电控",
      brandZh: "深度集成三合一电驱 · 电控",
      supplierZh: "广汽埃安 / 锐湃动力（IDU 含电控）",
      manufacturerZh: "锐湃动力科技有限公司（埃安控股）",
      specZh: "电机+电控+差减集成口径；海外规格未单列电控OEM",
      status: "known",
      noteZh:
        "广汽官宣三合一电驱与锐湃 IDU（电机+电控）自研自产；ES 海外页未单列电控厂，按体系落库，到货核铭牌",
      sourceIds: ["gac-ruipai-idu", "gac-hk-aion-es-spec"],
    },
    {
      id: "body",
      nameZh: "车身",
      brandZh: "AION",
      supplierZh: "待填（集采/贸易签约方）",
      manufacturerZh: "广汽埃安",
      specZh: "AION ES 海外版 · 4810×1880×1545",
      status: "pending",
      noteZh: "车身/整车制造主体；供应商/签约方下单前必补",
      sourceIds: ["gac-hk-aion-es-spec", "gac-aion-es-sa"],
    },
  ];
}

function isPlaceholderMajorField(v?: string): boolean {
  if (!v || !String(v).trim()) return true;
  const s = String(v).trim();
  return s === "待填" || s.startsWith("待填") || s.includes("待填（");
}

/** 规格行：默认库新抓字段（电机/电池/电控/信源）覆盖旧持久化空洞 */
function mergeProductSpecs(
  cur?: ProductSpecRow[],
  base?: ProductSpecRow[],
): ProductSpecRow[] {
  if (!base?.length) return cur || [];
  if (!cur?.length) return base.map((b) => ({ ...b }));
  const byId = new Map(cur.map((r) => [r.id, r]));
  const upgradeIds = new Set([
    "motor",
    "batt",
    "ecu",
    "source",
    "range-actual",
    "range-extreme",
    "charge",
    "warranty",
    "warranty-battery",
  ]);
  const rows = base.map((b) => {
    const hit = byId.get(b.id);
    if (!hit) return { ...b };
    if (upgradeIds.has(b.id)) {
      return {
        ...hit,
        ...b,
        status:
          b.status === "known" || hit.status === "known" ? "known" : "pending",
        sourceIds: b.sourceIds?.length
          ? b.sourceIds
          : hit.sourceIds,
      };
    }
    return {
      ...b,
      ...hit,
      sourceIds: hit.sourceIds?.length ? hit.sourceIds : b.sourceIds,
    };
  });
  for (const n of cur) {
    if (!rows.some((r) => r.id === n.id)) rows.push(n);
  }
  return rows;
}

function mergeConfigVariants(
  cur?: SkuConfigVariant[],
  base?: SkuConfigVariant[],
): SkuConfigVariant[] {
  if (!base?.length) return cur || [];
  if (!cur?.length) return base.map((b) => ({ ...b }));
  const byId = new Map(cur.map((c) => [c.id, c]));
  const rows = base.map((b) => {
    const hit = byId.get(b.id);
    if (!hit) return { ...b };
    return {
      ...b,
      ...hit,
      /** 默认库新写入的分档报价盖回旧持久化空洞 */
      purchasePriceMxn: hit.purchasePriceMxn ?? b.purchasePriceMxn,
      guidePriceMxn: hit.guidePriceMxn ?? b.guidePriceMxn,
      dcFastMin30to80: hit.dcFastMin30to80 ?? b.dcFastMin30to80,
      acChargeKw: hit.acChargeKw ?? b.acChargeKw,
      actualExtremeKm: hit.actualExtremeKm ?? b.actualExtremeKm,
      extremeNoteZh: hit.extremeNoteZh || b.extremeNoteZh,
      batteryKwh: hit.batteryKwh || b.batteryKwh,
      rangeZh: hit.rangeZh || b.rangeZh,
      nameZh: hit.nameZh || b.nameZh,
      noteZh: hit.noteZh || b.noteZh,
      tireSpecZh:
        !hit.tireSpecZh || hit.tireSpecZh.includes("待合同")
          ? b.tireSpecZh || hit.tireSpecZh
          : hit.tireSpecZh,
    };
  });
  for (const n of cur) {
    if (!rows.some((r) => r.id === n.id)) rows.push(n);
  }
  return rows;
}

function mergeMajorComponents(
  cur?: MajorComponent[],
  base?: MajorComponent[],
): MajorComponent[] {
  if (!base?.length && !cur?.length) return cur || base || [];
  const byId = new Map((cur || []).map((n) => [n.id, n]));
  const rows = (base || cur || []).map((b) => {
    const hit = byId.get(b.id);
    if (!hit) return { ...b };
    /** 持久化里仍是待填时，用默认库已抓到的公开信息盖回去 */
    const brandZh = isPlaceholderMajorField(hit.brandZh)
      ? b.brandZh
      : hit.brandZh;
    const supplierZh = isPlaceholderMajorField(hit.supplierZh)
      ? b.supplierZh
      : hit.supplierZh;
    const manufacturerZh = isPlaceholderMajorField(hit.manufacturerZh)
      ? b.manufacturerZh
      : hit.manufacturerZh;
    const specZh =
      !hit.specZh ||
      hit.specZh.includes("待核") ||
      hit.specZh.includes("待填")
        ? b.specZh || hit.specZh
        : hit.specZh;
    const pulledPublic =
      isPlaceholderMajorField(hit.brandZh) ||
      isPlaceholderMajorField(hit.supplierZh) ||
      isPlaceholderMajorField(hit.manufacturerZh);
    const noteZh = pulledPublic && b.noteZh ? b.noteZh : hit.noteZh || b.noteZh;
    const sourceIds = hit.sourceIds?.length ? hit.sourceIds : b.sourceIds;
    const known =
      !isPlaceholderMajorField(brandZh) && !isPlaceholderMajorField(supplierZh);
    return {
      ...b,
      ...hit,
      brandZh,
      supplierZh,
      manufacturerZh,
      specZh,
      noteZh,
      sourceIds,
      status: known ? "known" : "pending",
    };
  });
  const baseIds = new Set((base || []).map((b) => b.id));
  const vehicleFour =
    baseIds.has("body") && baseIds.has("motor") && baseIds.has("ecu");
  const obsolete = new Set(["vehicle", "tire"]);
  for (const n of cur || []) {
    if (vehicleFour && obsolete.has(n.id as string)) continue;
    if (!rows.some((x) => x.id === n.id)) rows.push(n);
  }
  return rows;
}

function resolveConfigVariant(
  sku: AssetSku,
  configId?: string,
): SkuConfigVariant | undefined {
  const list = sku.configVariants || [];
  if (!list.length) return undefined;
  const id =
    configId ||
    sku.defaultConfigId ||
    list.find((c) => c.isDefault)?.id ||
    list[0]?.id;
  return list.find((c) => c.id === id) || list[0];
}

/** 规格清单随所选续航/电池档覆盖电池·续航·胎·补能等字段 */
function productSpecsForSelectedVariant(
  sku: AssetSku,
  configId?: string,
): ProductSpecRow[] {
  const base = (sku.productSpecs || []).map((r) => ({ ...r }));
  const v = resolveConfigVariant(sku, configId);
  if (!v || sku.kind !== "vehicle") return base;
  const byId = new Map(base.map((r) => [r.id, r]));
  const put = (id: string, valueZh: string) => {
    const hit = byId.get(id);
    if (hit) {
      hit.valueZh = valueZh;
      hit.status = "known";
    }
  };
  put(
    "model",
    !sku.model || isRedundantSkuModel(sku.nameZh, sku.model)
      ? v.nameZh
      : `${sku.model} · ${v.nameZh}`,
  );
  if (v.officialKm != null) {
    put(
      "range",
      v.officialCycleZh
        ? `${v.officialCycleZh} ${v.officialKm} km`
        : `${v.officialKm} km`,
    );
  } else if (v.rangeZh) {
    put("range", v.rangeZh);
  }
  if (v.actualCityKm != null || v.actualHighwayKm != null) {
    put(
      "range-actual",
      `市区约 ${v.actualCityKm ?? "—"} km · 高速约 ${v.actualHighwayKm ?? "—"} km`,
    );
  }
  if (v.actualExtremeKm != null) {
    put(
      "range-extreme",
      `寒冷/采暖约 ${v.actualExtremeKm} km（约市区实续航×0.65 量级）${
        v.extremeNoteZh ? `；${v.extremeNoteZh}` : ""
      }`,
    );
  }
  put(
    "batt",
    `磷酸铁锂 ${v.batteryKwh} kWh（弹匣电池 · 本规格档）`,
  );
  if (v.tireSpecZh) {
    put(
      "tire",
      /待/.test(v.tireSpecZh)
        ? v.tireSpecZh
        : `${v.tireSpecZh}（品牌/供应商见规格与供应链）`,
    );
  }
  if (v.dcFastMin30to80 != null) {
    const ac = v.acChargeKw ?? 6.6;
    const fullH = (v.batteryKwh / Math.max(0.1, ac)).toFixed(1);
    const winH = ((v.batteryKwh * 0.5) / Math.max(0.1, ac)).toFixed(1);
    put(
      "charge",
      `快充约${v.dcFastMin30to80}min（30%→80%）· AC ${ac}kW（同等电量慢充约${winH}h · 0→100%约${fullH}h）`,
    );
  }
  return base;
}

/** 当前选中的续航/规格档 id（货架·商详·下单共用） */
function selectedConfigId(
  sku: AssetSku,
  bySku?: Record<string, string>,
): string {
  return (
    bySku?.[sku.id] ||
    sku.defaultConfigId ||
    sku.configVariants?.find((c) => c.isDefault)?.id ||
    sku.configVariants?.[0]?.id ||
    ""
  );
}

/**
 * 货架卡片规格摘要（车辆/场站同一结构）：
 * 「规格 · 档名 · 关键参数」
 */
function shelfSpecSummary(
  sku: AssetSku,
  cfg?: SkuConfigVariant | null,
): string {
  if (sku.kind === "station") {
    const sp = sku.stationSpec;
    const guns = stationGunCount(sku);
    const name = cfg?.nameZh || "标准规格";
    const rest = [
      guns > 0 ? `${guns}枪` : "",
      sp?.parkingSpaces != null ? `${sp.parkingSpaces}车位` : "",
      sp?.fastGuns != null ? `快充${sp.fastGuns}` : "",
      sp?.slowGuns != null ? `慢充${sp.slowGuns}` : "",
      sp?.areaSqm != null ? `${sp.areaSqm}㎡` : "",
      sp?.totalPowerKw != null ? `约${sp.totalPowerKw}kW` : "",
    ].filter(Boolean);
    return `规格 · ${name}${rest.length ? ` · ${rest.join(" · ")}` : ""}`;
  }
  if (!cfg) return "规格 · 待选配置档";
  const rest = [
    cfg.batteryKwh > 0 ? `${cfg.batteryKwh} kWh` : "",
    officialRangeLabel(cfg),
    cfg.tireSpecZh && cfg.tireSpecZh !== "—" ? cfg.tireSpecZh : "",
  ].filter(Boolean);
  return `规格 · ${cfg.nameZh}${rest.length ? ` · ${rest.join(" · ")}` : ""}`;
}

/** 官方续航：有工况写工况+km，无则只写 km；不夹「示意/约」 */
function officialRangeLabel(c: {
  officialCycleZh?: string;
  officialKm?: number;
  rangeZh?: string;
}): string {
  if (c.officialKm != null) {
    const cycle = (c.officialCycleZh || "").trim();
    return cycle ? `${cycle} ${c.officialKm} km` : `${c.officialKm} km`;
  }
  return (c.rangeZh || "").trim();
}

/** 商详顶栏档位：名称为主；公里数仅在名称未含时补一句（不含价格） */
function configVariantSelectLabel(c: SkuConfigVariant): string {
  const range = officialRangeLabel(c);
  const kmAlreadyInName =
    c.officialKm != null && c.nameZh.includes(String(c.officialKm));
  return [
    c.nameZh,
    range && !kmAlreadyInName ? range : null,
    c.isDefault ? "默认" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** 货架卡片配置档选择器选项文案（车辆/场站同一格式） */
function shelfVariantOptionLabel(
  sku: AssetSku,
  c: SkuConfigVariant,
  fx: number,
  ccy: Currency,
): string {
  const px = skuPurchasePriceMxn(sku, c.id);
  const basis = skuPriceBasisZh(sku);
  if (sku.kind === "station") {
    const hint = c.rangeZh || c.nameZh;
    return `${c.nameZh} · ${hint} · ${basis} ${moneyMxn(px, fx, ccy)}${c.isDefault ? " · 默认" : ""}`;
  }
  const range = officialRangeLabel(c);
  const kmAlreadyInName =
    c.officialKm != null && c.nameZh.includes(String(c.officialKm));
  const mid =
    range && !kmAlreadyInName
      ? range
      : c.batteryKwh > 0 && !c.nameZh.includes(String(c.batteryKwh))
        ? `${c.batteryKwh} kWh`
        : "";
  return `${c.nameZh}${mid ? ` · ${mid}` : ""} · ${basis} ${moneyMxn(px, fx, ccy)}${c.isDefault ? " · 默认" : ""}`;
}

/** 与单元现金流一致的日里程示意（DAE：350km×利用率，不加班次） */
function estimateOpsKmDay(
  mode: OpMode,
  util: number,
  daysWeek = 6,
): number {
  if (mode === "DAE") {
    return daeKmDay({
      daysWeek,
      util: util || 0.75,
      mode: "DAE",
    } as VehicleCard);
  }
  if (mode === "LTO") return 120;
  return 80;
}

/**
 * 运营补能提示：一天充几次 + 单次快/慢时长。
 * 可用续航按市区实续航×60%（约 20%→80% SOC 窗口）示意。
 */
function opsChargeHint(args: {
  mode: OpMode;
  util: number;
  daysWeek?: number;
  actualCityKm: number;
  batteryKwh: number;
  dcFastMin30to80?: number;
  acChargeKw?: number;
}): {
  kmDay: number;
  usableKm: number;
  chargesPerDay: number;
  fastMin: number;
  slowHoursSameWindow: number;
  slowHoursFull: number;
  textZh: string;
} {
  const daysWeek = args.daysWeek ?? 6;
  const kmDay = estimateOpsKmDay(args.mode, args.util, daysWeek);
  const usableKm = Math.max(1, args.actualCityKm * 0.6);
  const chargesPerDay = kmDay / usableKm;
  const fastMin = args.dcFastMin30to80 ?? 30;
  const acKw = args.acChargeKw ?? 6.6;
  const kwhWindow = Math.max(1, args.batteryKwh * 0.5);
  const slowHoursSameWindow = kwhWindow / Math.max(0.1, acKw);
  const slowHoursFull = args.batteryKwh / Math.max(0.1, acKw);
  const modeZh =
    args.mode === "DAE" ? "DAE专车" : args.mode === "LTO" ? "LTO直租" : "RTO";
  const textZh = [
    `运营场景（${modeZh}）示意：日里程约 ${Math.round(kmDay)} km`,
    `按市区实续航 ${Math.round(args.actualCityKm)} km×60%可用窗口 ≈ ${Math.round(usableKm)} km/次`,
    `→ 约需充电 ${chargesPerDay.toFixed(1)} 次/天`,
    `单次：快充约 ${fastMin} min（30%→80%）· 慢充补同等电量约 ${slowHoursSameWindow.toFixed(1)} h（AC ${acKw} kW）· 慢充 0→100% 约 ${slowHoursFull.toFixed(1)} h`,
  ].join("。");
  return {
    kmDay,
    usableKm,
    chargesPerDay,
    fastMin,
    slowHoursSameWindow,
    slowHoursFull,
    textZh,
  };
}

/** 案例表/合同列载为含税现金价时为 true（如埃安 ES 对齐沣邦 DAE） */
function skuPricesIncludeVat(sku: AssetSku): boolean {
  return sku.pricesIncludeVat === true;
}

/** 货架/配置文案：含税 | 未税 */
function skuPriceBasisZh(sku: AssetSku): string {
  return skuPricesIncludeVat(sku) ? "含税" : "未税";
}

/** 按续航档取购入价；税口径见 sku.pricesIncludeVat */
function skuPurchasePriceMxn(sku: AssetSku, configId?: string): number {
  const v = resolveConfigVariant(sku, configId);
  return v?.purchasePriceMxn ?? sku.purchasePriceMxn;
}

/** 按续航档取指导价；税口径见 sku.pricesIncludeVat */
function skuGuidePriceMxn(sku: AssetSku, configId?: string): number {
  const v = resolveConfigVariant(sku, configId);
  return v?.guidePriceMxn ?? sku.guidePriceMxn;
}

function majorComponentsPending(sku: AssetSku): MajorComponent[] {
  return (sku.majorComponents || []).filter((c) => {
    const brandOk = !isPlaceholderMajorField(c.brandZh);
    const supOk = !isPlaceholderMajorField(c.supplierZh);
    return !(brandOk && supOk) || c.status === "pending";
  });
}

const RP = {
  none: { fenbang: "no", lafa: "no" } as Record<ManagerId, RelatedFlag>,
  pending: {
    fenbang: "pending",
    lafa: "pending",
  } as Record<ManagerId, RelatedFlag>,
  unknown: {
    fenbang: "unknown",
    lafa: "unknown",
  } as Record<ManagerId, RelatedFlag>,
};

function vehicleSupplyChain(modelZh: string): SupplyChainNode[] {
  return [
    {
      id: "brand",
      step: 1,
      roleZh: "品牌方",
      nameZh: "广汽埃安",
      nameEn: "GAC AION",
      countryZh: "中国",
      legalId: "",
      relatedParty: { ...RP.none },
      noteZh: "整车品牌主体",
    },
    {
      id: "oem",
      step: 2,
      roleZh: "整车工厂/OEM",
      nameZh: "广汽埃安（生产主体；具体厂区待核）",
      nameEn: "GAC Aion New Energy",
      countryZh: "中国",
      legalId: "",
      relatedParty: { ...RP.none },
      noteZh: `${modelZh} 生产主体；精确法人/厂区待管理人核实`,
    },
    {
      id: "battery",
      step: 3,
      roleZh: "电池包供应商",
      nameZh: "待填",
      nameEn: "",
      countryZh: "待填",
      legalId: "",
      relatedParty: { ...RP.pending },
      noteZh: "追溯到电芯厂前的签约主体",
    },
    {
      id: "battery-plant",
      step: 4,
      roleZh: "电池工厂",
      nameZh: "待填",
      nameEn: "",
      countryZh: "待填",
      legalId: "",
      relatedParty: { ...RP.pending },
      noteZh: "电芯/模组实际生产厂",
    },
    {
      id: "tire-brand",
      step: 5,
      roleZh: "轮胎品牌",
      nameZh: "待填",
      nameEn: "",
      countryZh: "待填",
      legalId: "",
      relatedParty: { ...RP.pending },
      noteZh: "原厂配套或集采胎品牌；与配置档胎规格一致",
    },
    {
      id: "tire-supplier",
      step: 6,
      roleZh: "轮胎供应商",
      nameZh: "待填",
      nameEn: "",
      countryZh: "待填",
      legalId: "",
      relatedParty: { ...RP.pending },
      noteZh: "签约供货/换胎服务商；可与品牌不同",
    },
    {
      id: "exporter",
      step: 7,
      roleZh: "出口/集采贸易主体",
      nameZh: "待填",
      nameEn: "",
      countryZh: "待填",
      legalId: "",
      relatedParty: { ...RP.pending },
      noteZh: "与管理人签约的贸易/集采方；重点核关联方",
    },
    {
      id: "importer",
      step: 8,
      roleZh: "墨西哥进口商",
      nameZh: "待填",
      nameEn: "",
      countryZh: "墨西哥",
      legalId: "",
      relatedParty: { ...RP.pending },
      noteZh: "海关进口申报主体",
    },
    {
      id: "dealer",
      step: 9,
      roleZh: "本地经销/交车",
      nameZh: "待填",
      nameEn: "",
      countryZh: "墨西哥",
      legalId: "",
      relatedParty: { ...RP.pending },
      noteZh: "PDI、交车、售后对接主体",
    },
    {
      id: "plate-svc",
      step: 10,
      roleZh: "上牌/GPS服务商",
      nameZh: "待填",
      nameEn: "",
      countryZh: "墨西哥",
      legalId: "",
      relatedParty: { ...RP.pending },
      noteZh: "落地皮费对应服务商",
    },
  ];
}

function stationSupplyChain(): SupplyChainNode[] {
  return [
    {
      id: "epc",
      step: 1,
      roleZh: "EPC/总包",
      nameZh: "待填",
      nameEn: "",
      countryZh: "墨西哥",
      legalId: "",
      relatedParty: { ...RP.pending },
      noteZh: "场站 EPC/设备总包签约；优先核管理人关联方",
    },
    {
      id: "charger-brand",
      step: 2,
      roleZh: "充电设备品牌",
      nameZh: "待填",
      nameEn: "",
      countryZh: "待填",
      legalId: "",
      relatedParty: { ...RP.pending },
      noteZh: "枪/桩品牌方",
    },
    {
      id: "charger-plant",
      step: 3,
      roleZh: "充电设备工厂",
      nameZh: "待填",
      nameEn: "",
      countryZh: "待填",
      legalId: "",
      relatedParty: { ...RP.pending },
      noteZh: "实际生产工厂法人",
    },
    {
      id: "transformer-sup",
      step: 4,
      roleZh: "变压器供应商",
      nameZh: "待填",
      nameEn: "",
      countryZh: "待填",
      legalId: "",
      relatedParty: { ...RP.pending },
      noteZh: "签约供货商",
    },
    {
      id: "transformer-plant",
      step: 5,
      roleZh: "变压器工厂",
      nameZh: "待填",
      nameEn: "",
      countryZh: "待填",
      legalId: "",
      relatedParty: { ...RP.pending },
      noteZh: "生产厂",
    },
    {
      id: "diesel-sup",
      step: 6,
      roleZh: "柴发供应商",
      nameZh: "待填",
      nameEn: "",
      countryZh: "待填",
      legalId: "",
      relatedParty: { ...RP.pending },
      noteZh: "柴油发电机签约方",
    },
    {
      id: "diesel-plant",
      step: 7,
      roleZh: "柴发工厂",
      nameZh: "待填",
      nameEn: "",
      countryZh: "待填",
      legalId: "",
      relatedParty: { ...RP.pending },
      noteZh: "柴发生产厂",
    },
    {
      id: "civil",
      step: 8,
      roleZh: "土建/装修承包商",
      nameZh: "待填",
      nameEn: "",
      countryZh: "墨西哥",
      legalId: "",
      relatedParty: { ...RP.pending },
      noteZh: "对应场站基建/装修 130万口径",
    },
    {
      id: "landlord",
      step: 9,
      roleZh: "场地业主/出租方",
      nameZh: "待填",
      nameEn: "",
      countryZh: "墨西哥",
      legalId: "",
      relatedParty: { ...RP.pending },
      noteZh: "租金与押金对手方",
    },
  ];
}

/** 场站预配置档：小/中/大（面积·车位·快慢充·价格） */
type StationTierId = "station-small" | "station-medium" | "station-large";

type StationTierDef = {
  id: StationTierId;
  sizeZh: string;
  tagline: string;
  parking: number;
  fast: number;
  slow: number;
  areaSqm: number;
  totalPowerKw: number;
  purchasePriceMxn: number;
  guidePriceMxn: number;
  fitoutMxn: number;
  depositMxn: number;
  insuranceYrMxn: number;
  maintMxn: number;
  softMxn: number;
  wearYrMxn: number;
  noteZh: string;
  /** 相对中型站（10 枪）的经营量纲缩放，用于租金/运维包 */
  opsScale: number;
  bom: {
    dcFast: number;
    acSlow: number;
    transformer: number;
    diesel: number;
    switchgear: number;
    monitor: number;
  };
};

const STATION_TIER_DEFS: StationTierDef[] = [
  {
    id: "station-small",
    sizeZh: "小型",
    tagline: "社区/网点补能 · 快慢混充",
    parking: 6,
    fast: 4,
    slow: 4,
    areaSqm: 220,
    totalPowerKw: 200,
    purchasePriceMxn: 2_800_000,
    guidePriceMxn: 3_200_000,
    fitoutMxn: 700_000,
    depositMxn: 80_000,
    insuranceYrMxn: 55_000,
    maintMxn: 10_000,
    softMxn: 4_000,
    wearYrMxn: 70_000,
    noteZh:
      "预配置小站：约 220㎡ / 6 车位 / 快充 4 + 慢充 4。设备包与装修为档位示意价，落地以报价单为准。",
    opsScale: 0.6,
    bom: {
      dcFast: 1_400_000,
      acSlow: 280_000,
      transformer: 450_000,
      diesel: 350_000,
      switchgear: 220_000,
      monitor: 100_000,
    },
  },
  {
    id: "station-medium",
    sizeZh: "中型",
    tagline: "测算首站口径 · 快充为主",
    parking: 10,
    fast: 10,
    slow: 0,
    areaSqm: 430,
    totalPowerKw: 428.6,
    purchasePriceMxn: 5_500_000,
    guidePriceMxn: 6_200_000,
    fitoutMxn: 1_300_000,
    depositMxn: 140_000,
    insuranceYrMxn: 120_000,
    maintMxn: 20_000,
    softMxn: 8_000,
    wearYrMxn: 150_000,
    noteZh:
      "中型站对齐沣邦测算首站（10 枪 / 约 430㎡；桩建 550 万 + 装修 130 万 + 押金 14 万）。滴滴 14 枪方案待双端。",
    opsScale: 1,
    bom: {
      dcFast: 3_200_000,
      acSlow: 0,
      transformer: 900_000,
      diesel: 700_000,
      switchgear: 500_000,
      monitor: 200_000,
    },
  },
  {
    id: "station-large",
    sizeZh: "大型",
    tagline: "枢纽/车队集中补能 · 快慢混充",
    parking: 18,
    fast: 12,
    slow: 6,
    areaSqm: 720,
    totalPowerKw: 720,
    purchasePriceMxn: 9_200_000,
    guidePriceMxn: 10_500_000,
    fitoutMxn: 2_400_000,
    depositMxn: 250_000,
    insuranceYrMxn: 200_000,
    maintMxn: 35_000,
    softMxn: 14_000,
    wearYrMxn: 260_000,
    noteZh:
      "预配置大站：约 720㎡ / 18 车位 / 快充 12 + 慢充 6。功率与 BOM 为档位示意，并网方案须本地确认。",
    opsScale: 1.7,
    bom: {
      dcFast: 5_200_000,
      acSlow: 480_000,
      transformer: 1_500_000,
      diesel: 1_100_000,
      switchgear: 720_000,
      monitor: 200_000,
    },
  },
];

/** 中型站对齐沣邦首站经营假设；大/小按 opsScale 缩放租金与运维包 */
function stationOpsForTier(tier: StationTierDef): StationOpsConstants {
  const guns = Math.max(1, tier.fast + tier.slow);
  const scale = tier.opsScale;
  return {
    powerKwPerGun: tier.totalPowerKw / guns,
    externalUtil: 0.1,
    internalUtil: 0.2,
    externalPriceMxn: 8,
    internalPriceMxn: 7,
    elecCostMxn: 3,
    lossFactor: 1.08,
    rentMonthMxn: Math.round(81_200 * scale),
    opexMonthMxn: Math.round(160_000 * scale),
    rampStartLoad: 0.5,
    xiaojufenPct: 0.1,
    payFeePct: 0.02,
  };
}

function defaultStationOpsConstants(sku?: AssetSku): StationOpsConstants {
  const spec = sku?.stationSpec;
  const guns = Math.max(
    1,
    (spec?.fastGuns || 0) + (spec?.slowGuns || 0) || 10,
  );
  const power =
    spec?.totalPowerKw != null ? spec.totalPowerKw / guns : 42.86;
  return {
    powerKwPerGun: power,
    externalUtil: 0.1,
    internalUtil: 0.2,
    externalPriceMxn: 8,
    internalPriceMxn: 7,
    elecCostMxn: 3,
    lossFactor: 1.08,
    rentMonthMxn: 81_200,
    opexMonthMxn: 160_000,
    rampStartLoad: 0.5,
    xiaojufenPct: 0.1,
    payFeePct: 0.02,
  };
}

function resolveStationOps(sku: AssetSku): StationOpsConstants {
  return {
    ...defaultStationOpsConstants(sku),
    ...(sku.stationOps || {}),
  };
}

/** 场站单位月路径：期初购置 + 经营月（含爬坡） */
function buildStationMonthBars(args: {
  unitLandedMxn: number;
  guns: number;
  ops: StationOpsConstants;
  maintMxn: number;
  months: number;
}): {
  label: string;
  opsInMxn: number;
  outflowMxn: number;
  netMxn: number;
}[] {
  const { unitLandedMxn, guns, ops, maintMxn, months } = args;
  const gunKwhFullMo = (ops.powerKwPerGun || 40) * 24 * 30;
  const stExt =
    gunKwhFullMo * ops.externalUtil * ops.externalPriceMxn;
  const stInt =
    gunKwhFullMo * ops.internalUtil * ops.internalPriceMxn;
  const stVarGun =
    gunKwhFullMo *
    (ops.externalUtil + ops.internalUtil) *
    ops.lossFactor *
    ops.elecCostMxn;
  const fixedMo = ops.rentMonthMxn + ops.opexMonthMxn + maintMxn;
  const bars: {
    label: string;
    opsInMxn: number;
    outflowMxn: number;
    netMxn: number;
  }[] = [
    {
      label: "期初购置",
      opsInMxn: 0,
      outflowMxn: unitLandedMxn,
      netMxn: -unitLandedMxn,
    },
  ];
  const n = Math.max(1, Math.round(months) || 60);
  const ramp0 = ops.rampStartLoad || 0.55;
  for (let m = 1; m <= n; m++) {
    const ramp = Math.min(
      1,
      ramp0 + (1 - ramp0) * Math.min(1, (m - 1) / 6),
    );
    const inflow = guns * (stExt + stInt) * ramp;
    const outflow = guns * stVarGun + fixedMo;
    bars.push({
      label: `经营第${m}月`,
      opsInMxn: inflow,
      outflowMxn: outflow,
      netMxn: inflow - outflow,
    });
  }
  return bars;
}

function buildStationSku(tier: StationTierDef): AssetSku {
  const guns = tier.fast + tier.slow;
  const cabinets = Math.max(tier.fast, 1);
  return {
    id: tier.id,
    kind: "station",
    nameZh: `${tier.sizeZh}场站`,
    brand: "待填",
    model: `墨西哥·${tier.sizeZh}站 · ${guns}枪`,
    tagline: tier.tagline,
    unitLabel: "座",
    purchasePriceMxn: tier.purchasePriceMxn,
    guidePriceMxn: tier.guidePriceMxn,
    softCosts: [
      { id: "fitout", nameZh: "场站基建/装修", amountMxn: tier.fitoutMxn },
      { id: "deposit", nameZh: "场地押金", amountMxn: tier.depositMxn },
      { id: "permit", nameZh: "报装/并网许可", amountMxn: 0 },
      { id: "civil", nameZh: "土建车位/划线/标识", amountMxn: 0 },
      { id: "other", nameZh: "其他场站落地", amountMxn: 0 },
    ],
    residualRate: 0.1,
    physResidualRate: 0,
    maintResidualRate: 0,
    acctYears: 5,
    physYears: 8,
    maintYears: 5,
    insuranceYrMxn: tier.insuranceYrMxn,
    maintPolicyZh:
      "整站质保与运维包年待管理人确认；枪线/滤波器易损件按吞吐更换；站端电费另计可变成本",
    maintMxn: tier.maintMxn,
    softMxn: tier.softMxn,
    wearYrMxn: tier.wearYrMxn,
    kwhPer100: 0,
    minOrderQty: 1,
    qtyStep: 1,
    maxOrderQty: 20,
    defaultQty: 1,
    volumeTiers: [
      { minQty: 1, discountRate: 0 },
      { minQty: 2, discountRate: 0.03 },
      { minQty: 3, discountRate: 0.05 },
      { minQty: 5, discountRate: 0.08 },
    ],
    productSpecs: [
      {
        id: "pack",
        labelZh: "SKU形态",
        valueZh: `${tier.sizeZh}场站（枪+变压器+基建+柴发）`,
        status: "known",
      },
      { id: "size", labelZh: "档位", valueZh: tier.sizeZh, status: "known" },
      {
        id: "parking",
        labelZh: "车位",
        valueZh: String(tier.parking),
        status: "known",
      },
      {
        id: "fast",
        labelZh: "快充枪",
        valueZh: String(tier.fast),
        status: "known",
      },
      {
        id: "slow",
        labelZh: "慢充枪",
        valueZh: String(tier.slow),
        status: tier.slow > 0 ? "known" : "pending",
      },
      {
        id: "power",
        labelZh: "总功率",
        valueZh: `约 ${tier.totalPowerKw} kW`,
        status: "known",
      },
      {
        id: "area",
        labelZh: "面积",
        valueZh: `约 ${tier.areaSqm} ㎡`,
        status: "known",
      },
      { id: "brand", labelZh: "设备品牌", valueZh: "待填", status: "pending" },
      { id: "warranty", labelZh: "整站质保", valueZh: "待填", status: "pending" },
      {
        id: "source",
        labelZh: "信源",
        valueZh: "",
        status: "known",
        sourceIds: ["fenbang-station-xlsx", "ev-logic-docx"],
      },
    ],
    majorComponents: defaultMajorComponents("station"),
    defaultConfigId: `${tier.id}-std`,
    configVariants: [
      {
        id: `${tier.id}-std`,
        nameZh: `${tier.sizeZh}站·标准规格`,
        rangeZh: `${guns} 枪 / ${tier.parking} 车位 / 约 ${tier.areaSqm}㎡`,
        batteryKwh: 0,
        tireSpecZh: "—",
        noteZh: tier.noteZh,
        isDefault: true,
      },
    ],
    supplyChain: stationSupplyChain(),
    stationOps: stationOpsForTier(tier),
    stationSpec: {
      parkingSpaces: tier.parking,
      fastGuns: tier.fast,
      slowGuns: tier.slow,
      chargerCabinets: cabinets,
      totalPowerKw: tier.totalPowerKw,
      areaSqm: tier.areaSqm,
      brand: "",
      supplier: "",
      manufacturer: "",
      warrantyYears: 0,
      transformerKva: 0,
      dieselGeneratorKva: 0,
      noteZh: tier.noteZh,
    },
    stationBom: [
      {
        id: "dc-fast",
        nameZh: "直流快充枪系统",
        qty: tier.fast,
        unit: "枪",
        amountMxn: tier.bom.dcFast,
        status: "pending",
        noteZh: "档位示意拆分；品牌/单枪功率待填",
      },
      {
        id: "ac-slow",
        nameZh: "交流慢充",
        qty: tier.slow,
        unit: "枪",
        amountMxn: tier.bom.acSlow,
        status: "pending",
        noteZh: tier.slow > 0 ? "含慢充枪位" : "本档未配慢充；需要时改规格",
      },
      {
        id: "transformer",
        nameZh: "变压器/配电",
        qty: 1,
        unit: "套",
        amountMxn: tier.bom.transformer,
        status: "pending",
        noteZh: "容量 kVA 待管理人填写",
      },
      {
        id: "diesel",
        nameZh: "柴油发电机",
        qty: 1,
        unit: "台",
        amountMxn: tier.bom.diesel,
        status: "pending",
        noteZh: "备用容量 kVA 待填",
      },
      {
        id: "switchgear",
        nameZh: "开关柜/线缆/接地",
        qty: 1,
        unit: "套",
        amountMxn: tier.bom.switchgear,
        status: "pending",
        noteZh: "可与土建交叉，避免重复计入装修",
      },
      {
        id: "monitor",
        nameZh: "监控/消防/站控",
        qty: 1,
        unit: "套",
        amountMxn: tier.bom.monitor,
        status: "pending",
        noteZh: "含摄像头、烟感、站端控制器",
      },
    ],
    specFill: [
      {
        id: "brand",
        fieldZh: "充电设备品牌",
        value: "",
        required: true,
        hintZh: "如 StarCharge / ABB / 本地集成商品牌",
      },
      {
        id: "supplier",
        fieldZh: "供应商（签约主体）",
        value: "",
        required: true,
        hintZh: "EPC 或设备经销商全称",
      },
      {
        id: "manufacturer",
        fieldZh: "生产商/OEM",
        value: "",
        required: true,
        hintZh: "与品牌不一致时必填",
      },
      {
        id: "warranty",
        fieldZh: "整站质保（年）",
        value: "",
        required: true,
        hintZh: "含桩体/变压器/柴发各自质保则备注拆开",
      },
      {
        id: "parking",
        fieldZh: "车位数",
        value: String(tier.parking),
        required: true,
        hintZh: `${tier.sizeZh}站预配置 ${tier.parking}`,
      },
      {
        id: "fast",
        fieldZh: "快充枪数",
        value: String(tier.fast),
        required: true,
        hintZh: `${tier.sizeZh}站预配置 ${tier.fast} 枪`,
      },
      {
        id: "slow",
        fieldZh: "慢充枪数",
        value: String(tier.slow),
        required: true,
        hintZh: "无则填 0",
      },
      {
        id: "transformer_kva",
        fieldZh: "变压器容量（kVA）",
        value: "",
        required: true,
        hintZh: "与总功率/并网方案匹配",
      },
      {
        id: "diesel_kva",
        fieldZh: "柴油发电机（kVA）",
        value: "",
        required: true,
        hintZh: "无柴发填 0 并说明",
      },
      {
        id: "area",
        fieldZh: "场站面积（㎡）",
        value: String(tier.areaSqm),
        required: false,
        hintZh: `${tier.sizeZh}站预配置约 ${tier.areaSqm}㎡`,
      },
      {
        id: "power",
        fieldZh: "总功率（kW）",
        value: String(tier.totalPowerKw),
        required: false,
        hintZh: "档位示意功率；并网以报装为准",
      },
      {
        id: "bom_confirm",
        fieldZh: "设备 BOM 金额是否已核价",
        value: "",
        required: true,
        hintZh: "是/否；否请附报价单链接或备注",
      },
    ],
  };
}

const DEFAULT_STATION_SKUS: AssetSku[] =
  STATION_TIER_DEFS.map(buildStationSku);

/** 旧场站 id → 中型站（兼容购物车/订单持久化） */
const STATION_ID_ALIASES: Record<string, string> = {
  "station-dc-gun": "station-medium",
  "station-demo-01": "station-medium",
};

function resolveSkuId(id: string): string {
  return STATION_ID_ALIASES[id] || id;
}

/** 寿命默认：会计 5 / 物理车辆 12·场站 8 / 维保 5；上限默认 15（可调） */
const DEFAULT_LIFE_YEARS = {
  acct: 5,
  physVehicle: 12,
  physStation: 8,
  maint: 5,
  cap: 15,
  capMin: 5,
  capMax: 30,
} as const;

/** 各寿命期末残值率默认（0–1）；可在资产估值页调节 */
const DEFAULT_END_RESIDUAL = {
  acct: 0.1,
  phys: 0,
  maint: 0,
} as const;

const DEFAULT_ASSET_SKUS: AssetSku[] = [
  {
    id: "aion-es",
    kind: "vehicle",
    nameZh: "埃安 ES",
    brand: "AION",
    model: "ES",
    tagline: "专车主力 · 集采落地",
    unitLabel: "台",
    purchasePriceMxn: 473_800,
    guidePriceMxn: 559_900,
    /** 对齐沣邦 DAE「1.1假设」列载：集采/指导已是含税测算价 */
    pricesIncludeVat: true,
    softCosts: [
      { id: "plate", nameZh: "上牌/牌照", amountMxn: 4_000 },
      { id: "gps", nameZh: "GPS/车机", amountMxn: 3_000 },
      { id: "notary", nameZh: "登记/公证", amountMxn: 0 },
      { id: "logistics", nameZh: "运输入库", amountMxn: 0 },
      { id: "pdi", nameZh: "PDI/整备", amountMxn: 0 },
      { id: "other", nameZh: "其他落地杂费", amountMxn: 0 },
    ],
    residualRate: 0.1,
    physResidualRate: 0,
    maintResidualRate: 0,
    acctYears: 5,
    physYears: 12,
    maintYears: 5,
    insuranceYrMxn: 25_000,
    maintPolicyZh:
      "整车约8年/16万km、电池约8年/20万km（海外经销，先到为准）；电池衰减/换包以合同与保修手册为准；强制维保按厂方手册；轮胎/刹车件按磨损计提",
    maintMxn: 1_500,
    softMxn: 500,
    wearYrMxn: 12_000 + 16_000 + 20_800,
    /** 对齐《DAE-200台含IRR》1.1假设电耗 15 kWh/100km */
    kwhPer100: 15,
    minOrderQty: 1,
    qtyStep: 1,
    maxOrderQty: 500,
    defaultQty: 50,
    volumeTiers: [
      { minQty: 1, discountRate: 0 },
      { minQty: 50, discountRate: 0.03 },
      { minQty: 100, discountRate: 0.05 },
      { minQty: 200, discountRate: 0.08 },
    ],
    productSpecs: [
      { id: "brand", labelZh: "品牌", valueZh: "AION", status: "known" },
      { id: "model", labelZh: "车型", valueZh: "ES（海外版；国内近亲 AION S）", status: "known" },
      { id: "body", labelZh: "车身", valueZh: "4门轿车 · 4810×1880×1545mm · 轴距2750mm", status: "known" },
      { id: "trunk", labelZh: "后备厢", valueZh: "453 L", status: "known" },
      { id: "motor", labelZh: "电机", valueZh: "前置永磁同步 TZ184XYA2002 · 100kW/225N·m · FWD", status: "known", sourceIds: ["gac-hk-aion-es-spec", "qesot-aion-es-tz184"] },
      { id: "batt", labelZh: "电池", valueZh: "磷酸铁锂 55.2 kWh（弹匣电池；电芯厂待铭牌）", status: "known", sourceIds: ["gac-hk-aion-es-spec", "gac-magazine-battery"] },
      { id: "ecu", labelZh: "电控", valueZh: "三合一电驱电控 · 锐湃/埃安 IDU 体系（海外未单列OEM）", status: "known", sourceIds: ["gac-ruipai-idu"] },
      { id: "range", labelZh: "续航（官方）", valueZh: "NEDC 442 km", status: "known" },
      {
        id: "range-actual",
        labelZh: "续航（实际）",
        valueZh:
          "市区约 350–400 km · 高速约 290–330 km；营运深放/快充更低，待路试",
        status: "known",
      },
      {
        id: "range-extreme",
        labelZh: "续航（极端）",
        valueZh:
          "寒冷/采暖高耗约 220–260 km（相对市区实续航再折约 65% 量级，约 −35%）；高原夜寒与空调并行更差，待墨路试",
        status: "known",
      },
      { id: "kwh", labelZh: "电耗口径", valueZh: "15 kWh/100km（对齐 DAE 案例测算表）", status: "known" },
      { id: "charge", labelZh: "补能", valueZh: "快充约30min（30%→80%）· AC约6.6kW（慢充0→100%约8–9h）", status: "known", sourceIds: ["gac-hk-aion-es-spec", "bitauto-aion-es-hk"] },
      {
        id: "tire",
        labelZh: "轮胎规格",
        valueZh: "215/55 R17（品牌/供应商见规格与供应链）",
        status: "pending",
      },
      {
        id: "warranty",
        labelZh: "质保（整车）",
        valueZh: "整车约8年或16万km（海外经销口径，先到为准）",
        status: "known",
        sourceIds: ["gac-aion-es-sa", "gac-hk-aion-es-spec"],
      },
      {
        id: "warranty-battery",
        labelZh: "质保（电池）",
        valueZh:
          "动力电池约8年或20万km（海外经销，先到为准）；容量/SOH 衰减门槛以厂家保修手册与采购合同为准。国内 AION S 177Ah 营运延保（约8年/30万km口径）不自动覆盖墨西哥",
        status: "known",
        sourceIds: [
          "gac-aion-es-sa",
          "gac-hk-aion-es-spec",
          "aion-s-177ah-autohome",
          "aion-s-177ah-people",
        ],
      },
      { id: "origin", labelZh: "产地/厂商", valueZh: "中国 · 广汽埃安", status: "known" },
      {
        id: "source",
        labelZh: "信源",
        valueZh: "",
        status: "known",
        sourceIds: [
          "bitauto-aion-es-hk",
          "gac-aion-es-sa",
          "gac-hk-aion-es-spec",
          "qesot-aion-es-tz184",
          "gac-magazine-battery",
          "gac-ruipai-idu",
          "dongchedi-aion-s",
          "aion-s-177ah-autohome",
        ],
      },
    ],
    majorComponents: defaultMajorComponents("es"),
    defaultConfigId: "es-nedc442",
    configVariants: [
      {
        id: "es-nedc442",
        nameZh: "ES · NEDC 442（55.2kWh）",
        rangeZh: "官方 NEDC 442 · 市区实约375 · 高速实约310",
        officialCycleZh: "NEDC",
        officialKm: 442,
        actualCityKm: 375,
        actualHighwayKm: 310,
        actualNoteZh:
          "对照国内 AION S 媒体实测折算量级（市区约8.5折、高速约7折）；墨西哥高温/海拔/空调须再测",
        actualExtremeKm: 245,
        extremeNoteZh:
          "寒冷+座舱采暖示意：约市区实续航×0.65（约 −35%）；−10℃ 级或高速采暖可下探至约 220 km",
        batteryKwh: 55.2,
        tireSpecZh: "215/55 R17",
        purchasePriceMxn: 473_800,
        guidePriceMxn: 559_900,
        dcFastMin30to80: 30,
        acChargeKw: 6.6,
        noteZh: "对齐案例表列载含税价（集采 473800 / 指导 559900）；墨西哥落地配置待合同确认",
        isDefault: true,
      },
      {
        id: "es-long753",
        nameZh: "ES · 长续航（75.3kWh 出口档）",
        rangeZh: "600 km（75.3kWh 出口档）",
        officialKm: 600,
        actualCityKm: 480,
        actualHighwayKm: 400,
        actualNoteZh:
          "新加坡等市场公开 75.3kWh 档公开续航；勿按国内 NEDC 442 线性外推满打",
        actualExtremeKm: 310,
        extremeNoteZh:
          "寒冷+采暖示意：约市区实续航×0.65；大电池档绝对公里仍高于 55.2，但损耗比例同类",
        batteryKwh: 75.3,
        tireSpecZh: "215/55 R17",
        /** 按电池升档约 +18% 示意含税；墨合同价待核 */
        purchasePriceMxn: 559_000,
        guidePriceMxn: 660_400,
        dcFastMin30to80: 30,
        acChargeKw: 6.6,
        noteZh: "出口长续航档示意报价；墨西哥是否可供、最终价以采购合同为准",
      },
    ],
    supplyChain: vehicleSupplyChain("埃安 ES"),
    marketIntel: {
      scopeZh: "仅中国市场对照（墨西哥残值：待合作 Libro Azul）",
      residualProxyZh: "AION ES 海外版无国内二手盘；公允曲线代理车系 = 懂车帝/成交口径 AION S",
      residualFair: RESIDUAL_AION_S_FAIR,
      residualIndustry: RESIDUAL_CN_BEV_INDUSTRY,
      residualNoteZh:
        "市场残值锚定天天拍车：1–2年保值率约35.42%、3–4年约23.64%（混合成交，含营运车拖累）；Y1–Y5 为成交锚点平滑，Y6–Y12 为长尾递减示意（非持平），非车300单车VIN估值。营运与非营运价差可达数万元，投残值须分场景。",
      residualSourceIds: [
        "ttpai-aion-s-residual",
        "cata-bev-residual-2025",
        "che300-platform",
      ],
      parcWan: 100,
      parcLabelZh: "AION S 累计销量/保有量级（代理）",
      parcNoteZh:
        "媒体口径称 AION S 累计销量破百万；珠三角网约渗透高，广州/东莞/佛山保有靠前。非公安部精确保有登记。",
      parcSourceIds: ["media-aion-s-1m"],
      parcRef: parcRefEs(),
      parcByCountry: parcByCountryEs(),
      reputation: {
        platformZh: "懂车帝",
        score: 3.66,
        gradeZh: "良好",
        reviews: 451,
        peerAvg: 3.87,
        platforms: [
          {
            id: "dongchedi",
            platformZh: "懂车帝",
            score: 3.66,
            reviews: 451,
            gradeZh: "良好",
            sourceIds: ["dongchedi-aion-s"],
            noteZh: "车主评价综合分；同价位均分约 3.87",
          },
          {
            id: "autohome",
            platformZh: "汽车之家",
            score: 4.12,
            reviews: 1860,
            gradeZh: "优秀",
            sourceIds: ["aion-s-177ah-autohome"],
            noteZh: "口碑得分示意（车系页综合，待双端核对当期）",
          },
        ],
        dims: [
          { nameZh: "外观", score: 4.01 },
          { nameZh: "空间", score: 4.07 },
          { nameZh: "内饰", score: 3.76 },
          { nameZh: "动力", score: 3.51 },
          { nameZh: "操控", score: 3.51 },
          { nameZh: "舒适", score: 3.49 },
          { nameZh: "配置", score: 3.29 },
        ],
        tagsPros: ["整体空间出色", "动力足够", "续航表现优秀"],
        tagsCons: ["续航表现较差（差评标签并存）", "异响", "配置偏低", "电池故障舆情"],
        reviewSnippets: reviewSnippetsEs(),
        sourceIds: ["dongchedi-aion-s", "aion-s-177ah-autohome"],
        asOfZh: "抓取对照约 2026-08",
      },
      scoreRef: scoreRefEs(),
      riskNews: riskNewsEs(),
    },
  },
  {
    id: "aion-ut",
    kind: "vehicle",
    nameZh: "埃安 UT",
    brand: "AION",
    model: "UT",
    tagline: "快车/租买 · 轻运营",
    unitLabel: "台",
    purchasePriceMxn: 398_610,
    guidePriceMxn: 449_000,
    softCosts: [
      { id: "plate", nameZh: "上牌/牌照", amountMxn: 4_000 },
      { id: "gps", nameZh: "GPS/车机", amountMxn: 3_000 },
      { id: "notary", nameZh: "登记/公证", amountMxn: 2_500 },
      { id: "logistics", nameZh: "运输入库", amountMxn: 7_500 },
      { id: "pdi", nameZh: "PDI/整备", amountMxn: 3_000 },
      { id: "other", nameZh: "其他落地杂费", amountMxn: 0 },
    ],
    residualRate: 0.1,
    physResidualRate: 0,
    maintResidualRate: 0,
    acctYears: 4,
    physYears: 10,
    maintYears: 5,
    insuranceYrMxn: 18_000,
    maintPolicyZh:
      "整车约8年/16万km、电池及电机约8年/20万km（香港公开册示意，先到为准）；墨合同须单列电池衰减门槛；租赁车队按出租率计提维保；事故件另计",
    maintMxn: 1_200,
    softMxn: 500,
    wearYrMxn: 10_000,
    kwhPer100: 11.4,
    minOrderQty: 1,
    qtyStep: 1,
    maxOrderQty: 500,
    defaultQty: 100,
    volumeTiers: [
      { minQty: 1, discountRate: 0 },
      { minQty: 50, discountRate: 0.025 },
      { minQty: 100, discountRate: 0.045 },
      { minQty: 200, discountRate: 0.07 },
    ],
    productSpecs: [
      { id: "brand", labelZh: "品牌", valueZh: "AION", status: "known" },
      { id: "model", labelZh: "车型", valueZh: "UT（鹦鹉龙）2025款", status: "known" },
      { id: "body", labelZh: "车身", valueZh: "5门5座两厢 · 4270×1850×1575mm · 轴距2750mm", status: "known" },
      { id: "trunk", labelZh: "后备厢", valueZh: "约 440 L（后排放倒可扩）", status: "known" },
      { id: "motor", labelZh: "电机", valueZh: "汇川 TZ180XS134 · 100kW/145N·m · FWD（锐湃M10待双端）", status: "known", sourceIds: ["autohome-ut-miit", "bitauto-aion-ut-config", "ruipai-m10-ut"] },
      { id: "batt", labelZh: "电池", valueZh: "因湃 LFP 弹匣 · 约34.8kWh(330)/44.1kWh(420)", status: "known", sourceIds: ["autohome-ut-miit", "bitauto-aion-ut-config"] },
      { id: "ecu", labelZh: "电控", valueZh: "电驱总成电控 · 汇川同体系 / 锐湃M10待双端", status: "known", sourceIds: ["autohome-ut-miit", "ruipai-m10-ut", "gac-ruipai-idu"] },
      { id: "range", labelZh: "续航（官方）", valueZh: "CLTC 330 / 420 km（按配置档）", status: "known" },
      {
        id: "range-actual",
        labelZh: "续航（实际）",
        valueZh:
          "330档：市区约300 / 高速约240；420档：市区约380 / 高速约300（CLTC 打折量级）",
        status: "known",
      },
      {
        id: "range-extreme",
        labelZh: "续航（极端）",
        valueZh:
          "寒冷/采暖：330档约 190–210 km · 420档约 240–260 km（相对市区实续航再折约 65%，约 −35%）；待墨北/高原路试",
        status: "known",
      },
      { id: "kwh", labelZh: "电耗口径", valueZh: "约 11.4 kWh/100km（公开参配）", status: "known" },
      { id: "charge", labelZh: "补能", valueZh: "快充约24min（30%→80%）· AC 6.6kW（慢充0→100%约6–7h）· 支持V2L", status: "known", sourceIds: ["aionhk-ut-spec", "bitauto-aion-ut-config"] },
      { id: "cabin", labelZh: "座舱", valueZh: "8.8英寸仪表 + 14.6英寸中控 · ADiGO 5.0", status: "known" },
      { id: "susp", labelZh: "底盘", valueZh: "前麦弗逊独立 + 后扭力梁非独立", status: "known" },
      {
        id: "tire",
        labelZh: "轮胎规格",
        valueZh: "随配置档（品牌/供应商见规格与供应链）",
        status: "pending",
      },
      {
        id: "warranty",
        labelZh: "质保（整车）",
        valueZh: "整车约8年或16万km（香港公开册口径，先到为准；墨合同以落地条款为准）",
        status: "known",
        sourceIds: ["aionhk-ut-spec"],
      },
      {
        id: "warranty-battery",
        labelZh: "质保（电池）",
        valueZh:
          "电池及电机约8年或20万km（香港公开册，先到为准）；须在采购合同写明 SOH/容量衰减换包门槛、营运车是否同权、本地授权服务商与停运补偿",
        status: "known",
        sourceIds: ["aionhk-ut-spec"],
      },
      { id: "origin", labelZh: "产地/厂商", valueZh: "中国 · 广汽埃安", status: "known" },
      {
        id: "source",
        labelZh: "信源",
        valueZh: "",
        status: "known",
        sourceIds: [
          "dongchedi-aion-ut",
          "autohome-ut-config",
          "bitauto-aion-ut-config",
          "autohome-ut-miit",
          "ruipai-m10-ut",
          "aionhk-ut-spec",
        ],
      },
    ],
    majorComponents: defaultMajorComponents("ut"),
    defaultConfigId: "ut-420",
    configVariants: [
      {
        id: "ut-330",
        nameZh: "UT · CLTC 330（34.8kWh）",
        rangeZh: "官方 CLTC 330 · 市区实约300 · 高速实约240",
        officialCycleZh: "CLTC",
        officialKm: 330,
        actualCityKm: 300,
        actualHighwayKm: 240,
        actualNoteZh:
          "CLTC 偏乐观；市区口碑达成约9折，高速按约7.3折示意。营运排班勿按标称满打满算",
        actualExtremeKm: 195,
        extremeNoteZh:
          "寒冷+采暖示意：约市区实续航×0.65（约 −35%）；小电池档极端日更需午间补能",
        batteryKwh: 34.8,
        tireSpecZh: "215/60 R16（常见低配；待合同）",
        /** 对照国内指导价约 6.98–7.88 万 vs 420 档 8.38–8.98，按 ~0.877 折算默认 420 墨价 */
        purchasePriceMxn: 349_500,
        guidePriceMxn: 393_800,
        dcFastMin30to80: 24,
        acChargeKw: 6.6,
        noteZh: "低续航档；墨采购价按国内档差示意，以合同为准",
      },
      {
        id: "ut-420",
        nameZh: "UT · CLTC 420（44.1kWh）",
        rangeZh: "官方 CLTC 420 · 市区实约380 · 高速实约300",
        officialCycleZh: "CLTC",
        officialKm: 420,
        actualCityKm: 380,
        actualHighwayKm: 300,
        actualNoteZh:
          "车质网口碑市区达成率可超90%；高速空调满载会下探。墨西哥路测前用实续航排班",
        actualExtremeKm: 245,
        extremeNoteZh:
          "寒冷+采暖示意：约市区实续航×0.65（约 −35%）；墨北冬夜/高原晨峰可按下探排班",
        batteryKwh: 44.1,
        tireSpecZh: "215/55 R17（常见高配；待合同）",
        purchasePriceMxn: 398_610,
        guidePriceMxn: 449_000,
        dcFastMin30to80: 24,
        acChargeKw: 6.6,
        noteZh: "主力高续航档；与测算购入价默认对齐",
        isDefault: true,
      },
    ],
    supplyChain: vehicleSupplyChain("埃安 UT"),
    marketIntel: {
      scopeZh: "仅中国市场对照（墨西哥残值：待合作 Libro Azul）",
      residualProxyZh: "AION UT 2025-02 上市，二手样本极薄；曲线为小型纯电示意+行业插值，置信度低",
      residualFair: RESIDUAL_AION_UT_TENTATIVE,
      residualIndustry: RESIDUAL_CN_BEV_INDUSTRY,
      residualNoteZh:
        "尚无稳固的车300/天天拍车长车龄成交曲线；一年端参考小型纯电（如海鸥等）一年保值率约70%量级作示意，Y6–Y12 为长尾递减示意。新车频繁降价会显著下压残值，投模宜用保守情景。",
      residualSourceIds: [
        "cata-bev-residual-2025",
        "che300-platform",
        "che300-monthly-2025",
      ],
      parcWan: 7.7,
      parcLabelZh: "累计销量近似保有（下限）",
      parcNoteZh:
        "2025全年约5.09万 + 2026年1–6月累计约2.65万 ≈ 7.7万量级（批发/零售口径混用，待双端）。在售车龄短，二手供给仍少。",
      parcSourceIds: ["bitauto-ut-sales", "gasgoo-aion-202601"],
      parcRef: parcRefUt(),
      parcByCountry: parcByCountryUt(),
      reputation: {
        platformZh: "懂车帝",
        score: 3.38,
        gradeZh: "良好",
        reviews: 104,
        peerAvg: 3.72,
        platforms: [
          {
            id: "dongchedi",
            platformZh: "懂车帝",
            score: 3.38,
            reviews: 104,
            gradeZh: "良好",
            sourceIds: ["dongchedi-aion-ut"],
            noteZh: "样本量仍薄，分值波动大",
          },
          {
            id: "autohome",
            platformZh: "汽车之家",
            score: 3.52,
            reviews: 96,
            gradeZh: "良好",
            sourceIds: ["autohome-ut-config"],
            noteZh: "新车口碑样本同样偏薄；车质网另见投诉事件",
          },
        ],
        dims: [
          { nameZh: "外观", score: 3.94 },
          { nameZh: "空间", score: 3.73 },
          { nameZh: "内饰", score: 3.5 },
          { nameZh: "动力", score: 3.23 },
          { nameZh: "舒适", score: 3.23 },
          { nameZh: "操控", score: 3.18 },
          { nameZh: "配置", score: 2.85 },
        ],
        tagsPros: ["整体空间出色", "外观认可", "驾驶稳", "电耗低"],
        tagsCons: ["新车异味较大", "配置鸡肋", "隔音/胎噪", "低频共振投诉", "车机黑屏投诉"],
        reviewSnippets: reviewSnippetsUt(),
        sourceIds: [
          "dongchedi-aion-ut",
          "chezhinet-ut",
          "chezhinet-ut-series",
          "autohome-ut-config",
        ],
        asOfZh: "抓取对照约 2026-08",
      },
      scoreRef: scoreRefUt(),
      riskNews: riskNewsUt(),
    },
  },
  ...DEFAULT_STATION_SKUS,

];

/** @deprecated 兼容旧名 */
type VehicleModel = AssetSku;
const DEFAULT_VEHICLE_MODELS = DEFAULT_ASSET_SKUS;

type OpsProfile = {
  key: string;
  country: string;
  vertical: string;
  mode: OpMode;
  manager: ManagerId;
  rampYears: number;
  rampStartLoad: number;
  uncertaintyBand: number;
  // DAE
  util: number;
  iphMxn: number;
  hoursDay: number;
  daysWeek: number;
  subsidyPct: number;
  driverMxn: number;
  // 租赁类
  occupancy: number;
  badDebt: number;
  rentMonthMxn: number;
  depositMxn: number;
  note: string;
};

const OPS_PROFILES: OpsProfile[] = [
  {
    key: "MX|专车|DAE|fenbang",
    country: "墨西哥",
    vertical: "网约车·专车",
    mode: "DAE",
    manager: "fenbang",
    rampYears: 2,
    rampStartLoad: 0.55,
    uncertaintyBand: 0.12,
    util: 0.75,
    iphMxn: 210,
    hoursDay: 9.5,
    daysWeek: 6,
    subsidyPct: 0.05,
    driverMxn: 26_000,
    occupancy: 0,
    badDebt: 0,
    rentMonthMxn: 0,
    depositMxn: 0,
    note: "YOHO·专车DAE：对齐《DAE-200》1.1假设（利用75%/两班/IPH210/司机26000）",
  },
  {
    key: "MX|专车|DAE|lafa",
    country: "墨西哥",
    vertical: "网约车·专车",
    mode: "DAE",
    manager: "lafa",
    rampYears: 1.5,
    rampStartLoad: 0.62,
    uncertaintyBand: 0.1,
    util: 0.78,
    iphMxn: 215,
    hoursDay: 9.5,
    daysWeek: 6,
    subsidyPct: 0.05,
    driverMxn: 25_500,
    occupancy: 0,
    badDebt: 0,
    rentMonthMxn: 0,
    depositMxn: 0,
    note: "LAFA·专车DAE：达产略快、利用率略高（对照假设）",
  },
  {
    key: "MX|快车|LTO|fenbang",
    country: "墨西哥",
    vertical: "网约车·快车",
    mode: "LTO",
    manager: "fenbang",
    rampYears: 2,
    rampStartLoad: 0.6,
    uncertaintyBand: 0.15,
    util: 0,
    iphMxn: 0,
    hoursDay: 0,
    daysWeek: 6,
    subsidyPct: 0,
    driverMxn: 0,
    occupancy: 0.85,
    badDebt: 0.015,
    rentMonthMxn: 19_500,
    depositMxn: 6_000,
    note: "YOHO·快车LTO：对齐原LTO直租测算",
  },
  {
    key: "MX|快车|LTO|lafa",
    country: "墨西哥",
    vertical: "网约车·快车",
    mode: "LTO",
    manager: "lafa",
    rampYears: 1.5,
    rampStartLoad: 0.65,
    uncertaintyBand: 0.12,
    util: 0,
    iphMxn: 0,
    hoursDay: 0,
    daysWeek: 6,
    subsidyPct: 0,
    driverMxn: 0,
    occupancy: 0.88,
    badDebt: 0.012,
    rentMonthMxn: 20_000,
    depositMxn: 6_000,
    note: "LAFA·快车LTO：出租率与达产对照假设",
  },
  {
    key: "MX|快车|RTO|fenbang",
    country: "墨西哥",
    vertical: "网约车·快车",
    mode: "RTO",
    manager: "fenbang",
    rampYears: 2,
    rampStartLoad: 0.5,
    uncertaintyBand: 0.14,
    util: 0,
    iphMxn: 0,
    hoursDay: 0,
    daysWeek: 6,
    subsidyPct: 0,
    driverMxn: 0,
    occupancy: 0.8,
    badDebt: 0.02,
    rentMonthMxn: 21_000,
    depositMxn: 8_000,
    note: "YOHO·快车RTO：租买/分期，押金与租金略高",
  },
  {
    key: "MX|快车|RTO|lafa",
    country: "墨西哥",
    vertical: "网约车·快车",
    mode: "RTO",
    manager: "lafa",
    rampYears: 1.75,
    rampStartLoad: 0.55,
    uncertaintyBand: 0.13,
    util: 0,
    iphMxn: 0,
    hoursDay: 0,
    daysWeek: 6,
    subsidyPct: 0,
    driverMxn: 0,
    occupancy: 0.83,
    badDebt: 0.016,
    rentMonthMxn: 21_500,
    depositMxn: 8_000,
    note: "LAFA·快车RTO：对照假设",
  },
];

/**
 * 同资产×跨运营机构质量对照（决策示意；待实绩双端后替换）。
 * 回答：同样的车，谁更赚钱、谁出险更少、谁更保值。
 */
type OperatorOpsQuality = {
  manager: ManagerId;
  /** 赚钱能力指数：1=基准 */
  earnIndex: number;
  /** 出险事故：件/百车·年 */
  claimPer100Yr: number;
  /** 保值系数：1=基准，越高残值更好 */
  residualMul: number;
  /** 保险成本相对系数（出险少可谈低保费） */
  insuranceMul: number;
  noteZh: string;
};

const OPERATOR_OPS_QUALITY: OperatorOpsQuality[] = [
  {
    manager: "fenbang",
    earnIndex: 1,
    claimPer100Yr: 18,
    residualMul: 1,
    insuranceMul: 1,
    noteZh: "YOHO·测算基准",
  },
  {
    manager: "lafa",
    earnIndex: 1.08,
    claimPer100Yr: 11,
    residualMul: 1.06,
    insuranceMul: 0.92,
    noteZh: "LAFA·同资产：更赚钱、出险更少、车更保值（示意）",
  },
];

/** 显著差于对照的阈值：盈利≥5%、出险相对≥20%、保值≥3% */
const OPS_GAP_THRESH = {
  earnPct: 0.05,
  claimRel: 0.2,
  residualPct: 0.03,
};

function operatorQualityOf(id: ManagerId): OperatorOpsQuality {
  return (
    OPERATOR_OPS_QUALITY.find((q) => q.manager === id) ||
    OPERATOR_OPS_QUALITY[0]!
  );
}

function operatorDecisionScore(q: OperatorOpsQuality): number {
  return q.earnIndex * 100 - q.claimPer100Yr * 0.8 + (q.residualMul - 1) * 80;
}

/** a 是否显著差于 b（同资产决策） */
function isOpsSignificantlyWorse(
  a: OperatorOpsQuality,
  b: OperatorOpsQuality,
): boolean {
  const earnWorse =
    b.earnIndex / Math.max(a.earnIndex, 0.01) - 1 >= OPS_GAP_THRESH.earnPct;
  const claimWorse =
    (a.claimPer100Yr - b.claimPer100Yr) / Math.max(b.claimPer100Yr, 1) >=
    OPS_GAP_THRESH.claimRel;
  const resWorse =
    b.residualMul / Math.max(a.residualMul, 0.01) - 1 >=
    OPS_GAP_THRESH.residualPct;
  return earnWorse || claimWorse || resWorse;
}

function bestOperatorByQuality(
  ids: ManagerId[],
): { id: ManagerId; q: OperatorOpsQuality } | null {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return null;
  let best = uniq[0]!;
  let bestQ = operatorQualityOf(best);
  let bestS = operatorDecisionScore(bestQ);
  for (const id of uniq.slice(1)) {
    const q = operatorQualityOf(id);
    const s = operatorDecisionScore(q);
    if (s > bestS) {
      best = id;
      bestQ = q;
      bestS = s;
    }
  }
  return { id: best, q: bestQ };
}

/**
 * 资产基础现金流：时点支出柱 + 乘客付费→平台/支付手续费→运营SPV→SPV内瀑布。
 * 投放情境 = 国家 × 业态 × 模式。
 */
type CfLayer = "platform" | "spv";

/** 司机工资预留周期 */
type WageReserveCycle = "day" | "week" | "month";

/** 充电成本录入/预付周期（瀑布仍折成日扣） */
type ChargePayCycle = "day" | "week" | "month" | "year";

/** 优先本息还本付息规则 */
type DebtServiceRule =
  | "interest_only"
  | "equal_principal"
  | "equal_payment";

type InvestorPiDetail = {
  /** 本金占单车落地成本比例（LTV） */
  principalPct: number;
  /** 年化利率 */
  annualRate: number;
  /** 期限（月） */
  tenureMonths: number;
  /** @deprecated 兼容旧持久化；见 interestOnlyMonths */
  graceMonths: number;
  /** @deprecated 兼容旧持久化；true=免本期只还息 */
  interestDuringGrace: boolean;
  /** 只还息月数（期内不还本，按 opening balance × 月利率付息） */
  interestOnlyMonths: number;
  /** 只还息期位置：front=期初前置，back=期末后置（末月含气球还本） */
  interestOnlyTiming: "front" | "back";
  rule: DebtServiceRule;
  /**
   * 保证金：按「几个月本息」规模锁定给优先投资的账面资金（不可动用）。
   * 金额 = 月供 × 本月数；期初锁定、融资期末退还。0=不设。
   */
  depositMonths: number;
};

type DriverWageDetail = {
  cycle: WageReserveCycle;
  /** 按所选周期录入的预留额（MXN） */
  amountMxn: number;
  /** from_card：跟资产卡司机月薪×班次×利用率；manual：手改 */
  source: "from_card" | "manual";
  /** 预留覆盖率 1=全额 */
  coverPct: number;
};

/** 必要经营支出·仅可变成本项（固定项走年养护） */
type VarOpexItem = {
  id: string;
  nameZh: string;
  enabled: boolean;
  kind: "pct_pool" | "fixed_day";
  pct: number;
  fixedDayMxn: number;
};

type VarOpexDetail = {
  items: VarOpexItem[];
};

type WaterfallTier = {
  id: string;
  nameZh: string;
  layer: CfLayer;
  /** 占「当前剩余池」比例（瀑布顺位扣除；无明细配置时用） */
  pctOfRemaining: number;
  /** 按日固定 MXN（无明细配置时用；与 pct 二选一优先 fixed） */
  fixedDayMxn: number;
  enabled: boolean;
  noteZh: string;
  investor?: InvestorPiDetail;
  wage?: DriverWageDetail;
  varOpex?: VarOpexDetail;
};

type AssetCashflowConfig = {
  /** 本 SKU 绑定的经营模式（一 SKU 一模型） */
  boundMode: OpMode;
  /** 线上支付手续费：占乘客支付；沣邦 DAE 案例表里程收入已是车队口径，默认 0 */
  paymentFeePct: number;
  /** 网约车平台抽佣；沣邦 DAE 案例表默认 0（IPH 流水直接作里程收入） */
  platformTakePct: number;
  /** 运营SPV内瀑布（顺序即优先级） */
  spvTiers: WaterfallTier[];
  /** 每年固定养护（摊到月）= 启用分项合计；引擎读此字段 */
  annualMaintMxn: number;
  /** 可变成本总开关：关则路径不计通道/抽成/充电/易损/司机/过路日额（占池酌量仍走固定卡） */
  varCostEnabled: boolean;
  /** 固定成本总开关：关则路径不计年养护 */
  fixedCostEnabled: boolean;
  /** from_card：跟资产卡/情景；manual：手改分项 */
  fixedCostSource: "from_card" | "manual";
  /** 保险（年） */
  fixInsuranceYrMxn: number;
  fixInsuranceOn: boolean;
  /** 保养（月） */
  fixMaintMoMxn: number;
  fixMaintOn: boolean;
  /** 软件/GPS（月） */
  fixSoftMoMxn: number;
  fixSoftOn: boolean;
  /** 车位（月）；LTO/RTO 默认 0 */
  fixParkingMoMxn: number;
  fixParkingOn: boolean;
  /**
   * 易损件：MXN / 万公里（胎+刹+悬）。
   * 月额 = 月里程/10000 × 本单价；与「计划保养」不同。
   */
  fixWearPer10kKmMxn: number;
  fixWearOn: boolean;
  /** @deprecated 仅兼容旧持久化；引擎优先用 fixWearPer10kKmMxn */
  fixWearYrMxn?: number;
  /** 折日后的日均充电成本（引擎用；由周期预付额推导） */
  chargeDayMxn: number;
  /** 充电录入/预付周期 */
  chargeCycle: ChargePayCycle;
  /** 所选周期的预付/预提金额 MXN */
  chargeAmountMxn: number;
  /** from_card：跟电耗×电价；manual：手改 */
  chargeSource: "from_card" | "manual";
  /** 易损月期望：轮胎/刹车/悬挂等年耗÷12（由 fixWear* 推导；路径可加轻微月波动） */
  randomMaintMonthMxn: number;
  horizonMonths: number;
  /** 与《DAE-200台含IRR》1.1假设对齐版本；变更则重置默认常量 */
  assumptionsVer?: string;
};

/** 单位现金流默认假设版本（改案例表常量时递增，强制覆盖旧持久化） */
const CF_ASSUMPTIONS_VER = "fenbang-spv-tiers-2.1-20260817";

const DEBT_RULE_OPTS: { id: DebtServiceRule; label: string }[] = [
  { id: "equal_payment", label: "等额本息" },
  { id: "equal_principal", label: "等额本金" },
  { id: "interest_only", label: "期内只还息" },
];

const IO_TIMING_OPTS: { id: "front" | "back"; label: string }[] = [
  { id: "front", label: "期初前置" },
  { id: "back", label: "期末后置" },
];

const WAGE_CYCLE_OPTS: { id: WageReserveCycle; label: string }[] = [
  { id: "month", label: "按月" },
  { id: "week", label: "按周" },
  { id: "day", label: "按日" },
];

const CHARGE_CYCLE_OPTS: { id: ChargePayCycle; label: string }[] = [
  { id: "day", label: "按日" },
  { id: "week", label: "按周预付" },
  { id: "month", label: "按月预付" },
  { id: "year", label: "按年预付" },
];

/** 日充电 → 周期预付额 */
function chargeAmountFromDay(
  dayMxn: number,
  cycle: ChargePayCycle,
  daysWeek = 6,
): number {
  const d = Math.max(0, dayMxn);
  const dw = Math.max(1, daysWeek || 6);
  const daysMo = opsDaysPerMonth(dw);
  if (cycle === "week") return Math.round(d * dw * 100) / 100;
  if (cycle === "month") return Math.round(d * daysMo * 100) / 100;
  if (cycle === "year") return Math.round(d * daysMo * 12 * 100) / 100;
  return Math.round(d * 100) / 100;
}

/** 周期预付额 → 日充电（瀑布扣款） */
function chargeDayFromAmount(
  amountMxn: number,
  cycle: ChargePayCycle,
  daysWeek = 6,
): number {
  const a = Math.max(0, amountMxn);
  const dw = Math.max(1, daysWeek || 6);
  const daysMo = opsDaysPerMonth(dw);
  if (cycle === "week") return a / dw;
  if (cycle === "month") return a / daysMo;
  if (cycle === "year") return a / (daysMo * 12);
  return a;
}

function chargeCycleLabelZh(cycle: ChargePayCycle): string {
  if (cycle === "week") return "周预付";
  if (cycle === "month") return "月预付";
  if (cycle === "year") return "年预付";
  return "日";
}

/** 固定成本分项 → 年合计（关总开关或关分项则不计） */
function annualMaintFromFixedLines(cfg: {
  fixedCostEnabled?: boolean;
  fixInsuranceOn?: boolean;
  fixInsuranceYrMxn?: number;
  fixMaintOn?: boolean;
  fixMaintMoMxn?: number;
  fixSoftOn?: boolean;
  fixSoftMoMxn?: number;
  fixParkingOn?: boolean;
  fixParkingMoMxn?: number;
}): number {
  if (cfg.fixedCostEnabled === false) return 0;
  let y = 0;
  if (cfg.fixInsuranceOn !== false) y += Math.max(0, cfg.fixInsuranceYrMxn || 0);
  if (cfg.fixMaintOn !== false) y += Math.max(0, cfg.fixMaintMoMxn || 0) * 12;
  if (cfg.fixSoftOn !== false) y += Math.max(0, cfg.fixSoftMoMxn || 0) * 12;
  if (cfg.fixParkingOn !== false)
    y += Math.max(0, cfg.fixParkingMoMxn || 0) * 12;
  return Math.round(y * 100) / 100;
}

/** 易损单价默认：年耗 ÷（年里程/万km） */
function defaultWearPer10kKmMxn(card: VehicleCard, wearYrMxn: number): number {
  const wearYr = Math.max(0, wearYrMxn);
  const kmDay = card.mode === "DAE" ? daeKmDay(card) : 80;
  const kmYr = kmDay * opsDaysPerMonth(card.daysWeek || 6) * 12;
  if (kmYr < 100) return 0;
  return Math.round((wearYr / (kmYr / 10000)) * 10) / 10;
}

/** 易损月额：元/万km × 月里程 */
function wearMonthFromFixed(
  cfg: {
    fixWearOn?: boolean;
    fixWearPer10kKmMxn?: number;
    fixWearYrMxn?: number;
  },
  card?: VehicleCard,
): number {
  if (cfg.fixWearOn === false) return 0;
  if (card) {
    const per10k = Math.max(0, cfg.fixWearPer10kKmMxn || 0);
    if (per10k > 0) {
      const kmDay = card.mode === "DAE" ? daeKmDay(card) : 80;
      const kmMo = kmDay * opsDaysPerMonth(card.daysWeek || 6);
      return Math.round((kmMo / 10000) * per10k * 100) / 100;
    }
  }
  /** 旧口径回落：年耗÷12 */
  return Math.round((Math.max(0, cfg.fixWearYrMxn || 0) / 12) * 100) / 100;
}

function defaultVarOpexItems(): VarOpexItem[] {
  return [
    {
      id: "trip_bonus",
      nameZh: "冲单补贴",
      enabled: false,
      kind: "pct_pool",
      pct: 0.02,
      fixedDayMxn: 0,
    },
    {
      id: "tolls",
      nameZh: "过路/临停（可变）",
      enabled: false,
      kind: "fixed_day",
      pct: 0,
      fixedDayMxn: 40,
    },
    /** 随里程耗材 ≡ 易损件（胎/刹/悬），已归固定成本卡「易损件/年」，勿在此重复 */
  ];
}

function defaultInvestorPi(): InvestorPiDetail {
  return {
    principalPct: 0.85,
    annualRate: 0.14,
    tenureMonths: 36,
    graceMonths: 0,
    interestDuringGrace: true,
    interestOnlyMonths: 0,
    interestOnlyTiming: "front",
    rule: "equal_payment",
    /** 默认 2 个月本息作保证金示意；可调 0 关闭 */
    depositMonths: 2,
  };
}

function normalizeInvestorPi(
  raw: Partial<InvestorPiDetail> | undefined | null,
): InvestorPiDetail {
  const base = defaultInvestorPi();
  if (!raw) return base;
  const merged = { ...base, ...raw };
  let io = merged.interestOnlyMonths ?? 0;
  let timing: "front" | "back" =
    merged.interestOnlyTiming === "back" ? "back" : "front";
  /** 旧字段：免本+仍付息 → 期初只还息 */
  if (io <= 0 && (merged.graceMonths || 0) > 0 && merged.interestDuringGrace) {
    io = merged.graceMonths;
    timing = "front";
  }
  const n = Math.max(1, Math.round(merged.tenureMonths || 1));
  io = Math.max(0, Math.min(n - 1, Math.round(io)));
  return {
    ...merged,
    interestOnlyMonths: io,
    interestOnlyTiming: timing,
  };
}

function equalPaymentPmt(P: number, rMo: number, n: number): number {
  if (P <= 0 || n <= 0) return 0;
  if (rMo <= 1e-12) return P / n;
  const pow = Math.pow(1 + rMo, n);
  return (P * rMo * pow) / (pow - 1);
}

function investorIsIoMonth(
  t: number,
  n: number,
  io: number,
  timing: "front" | "back",
): boolean {
  if (io <= 0) return false;
  if (timing === "front") return t <= io;
  return t > n - io;
}

function investorPaymentForMonth(
  inv: InvestorPiDetail,
  P: number,
  openingBal: number,
  t: number,
): number {
  const invN = normalizeInvestorPi(inv);
  const n = Math.max(1, Math.round(invN.tenureMonths || 1));
  const rMo = Math.max(0, invN.annualRate) / 12;
  const io = invN.interestOnlyMonths;
  const timing = invN.interestOnlyTiming;
  const bal = Math.max(0, openingBal);
  if (bal <= 1e-9) return 0;

  const g = Math.max(0, Math.min(n - 1, Math.round(invN.graceMonths || 0)));
  if (g > 0 && !invN.interestDuringGrace && t <= g) return 0;

  if (invN.rule === "interest_only") {
    if (t < n) return bal * rMo;
    return bal * (1 + rMo);
  }

  if (investorIsIoMonth(t, n, io, timing)) {
    if (t === n) return bal * (1 + rMo);
    return bal * rMo;
  }

  if (invN.rule === "equal_principal") {
    if (timing === "front") {
      const amortLen = Math.max(1, n - io);
      const prin = P / amortLen;
      return Math.min(bal * (1 + rMo), prin + bal * rMo);
    }
    const prin = P / n;
    return Math.min(bal * (1 + rMo), prin + bal * rMo);
  }

  if (timing === "front") {
    const amortLen = Math.max(1, n - io);
    const pmt = equalPaymentPmt(P, rMo, amortLen);
    return Math.min(bal * (1 + rMo), pmt);
  }
  const pmt = equalPaymentPmt(P, rMo, n);
  return Math.min(bal * (1 + rMo), pmt);
}

function investorOpeningBalance(
  inv: InvestorPiDetail,
  P: number,
  month: number,
): number {
  const invN = normalizeInvestorPi(inv);
  const n = Math.max(1, Math.round(invN.tenureMonths || 1));
  const m = Math.max(1, Math.round(month));
  if (m <= 1) return P;
  let bal = P;
  const rMo = Math.max(0, invN.annualRate) / 12;
  for (let t = 1; t < m; t++) {
    const pay = investorPaymentForMonth(invN, P, bal, t);
    const interest = bal * rMo;
    let prin = pay - interest;
    if (prin < 0) prin = 0;
    if (prin > bal) prin = bal;
    bal -= prin;
  }
  return Math.max(0, bal);
}

function investorPreviewMonth(inv: InvestorPiDetail): number {
  const invN = normalizeInvestorPi(inv);
  const n = Math.max(1, Math.round(invN.tenureMonths || 1));
  const io = invN.interestOnlyMonths;
  if (invN.rule === "interest_only") return Math.min(n, 1);
  if (invN.interestOnlyTiming === "back") return 1;
  return Math.min(n, io + 1);
}

/** 用于保证金测算的「稳态」月供（只还息结束后首月摊还，或期末后置的首个摊还月） */
function investorSteadyMonthPayMxn(
  inv: InvestorPiDetail,
  principalMxn: number,
): number {
  const invN = normalizeInvestorPi(inv);
  const m = investorPreviewMonth(invN);
  return investorMonthPayMxn(invN, principalMxn, m);
}

/** 保证金账面额 = 月供 × 几个月本息；不可动用 */
function investorDepositMxn(
  inv: InvestorPiDetail,
  unitLandedMxn: number,
): number {
  const months = Math.max(0, Math.round(inv.depositMonths || 0));
  if (months <= 0) return 0;
  const principal =
    unitLandedMxn * Math.max(0, Math.min(1, inv.principalPct));
  const moPay = investorSteadyMonthPayMxn(inv, principal);
  return moPay * months;
}

function defaultDriverWage(
  mode: OpMode,
  driverDayMxn: number,
  daysMo: number,
): DriverWageDetail {
  const monthAmt = Math.round(driverDayMxn * daysMo);
  return {
    cycle: "month",
    amountMxn: mode === "DAE" ? monthAmt : 0,
    source: "from_card",
    coverPct: 1,
  };
}
/**
 * 常量性质：决定谁拍板、怎么验收、能否当 OKR。
 * - biz_policy：生态核心企业给到的经营政策（外部商务条件）
 * - ops_kpi：运营结果指标，后续沉淀 OKR/KPI
 * - asset_native：资产自然/出厂属性（铭牌、合同规格）
 * - labor_market：当地司机就业行情与劳动纪律
 */
type ConstNatureId =
  | "biz_policy"
  | "ops_kpi"
  | "asset_native"
  | "labor_market";

const CONST_NATURE_META: Record<
  ConstNatureId,
  { labelZh: string; hintZh: string }
> = {
  biz_policy: {
    labelZh: "外部商务条件",
    hintZh: "生态核心企业给到的经营政策（价补分成、集采、场站商务）",
  },
  ops_kpi: {
    labelZh: "运营指标",
    hintZh: "可周/月追踪的经营结果，后续沉淀为 OKR/KPI",
  },
  asset_native: {
    labelZh: "资产出厂属性",
    hintZh: "车/站自然或出厂参数，受铭牌与采购合同约束",
  },
  labor_market: {
    labelZh: "司机就业与劳动纪律",
    hintZh: "当地用工行情、薪酬社保、排班工时与出勤纪律",
  },
};

/** 指标名 → 性质（校验表与情景包共用） */
const CONST_METRIC_NATURE: Record<string, ConstNatureId> = {
  利用率: "ops_kpi",
  IPH: "biz_policy",
  滴滴补贴: "biz_policy",
  "司机薪酬(单人)": "labor_market",
  "司机成本(两班×利用)": "labor_market",
  保险: "biz_policy",
  保养: "ops_kpi",
  软件: "biz_policy",
  易损合计: "ops_kpi",
  车位租金: "biz_policy",
  电价: "biz_policy",
  "充电费(推算月)": "ops_kpi",
  残值率: "asset_native",
  电耗: "asset_native",
  外部利用率: "ops_kpi",
  内部利用率: "ops_kpi",
  外部电价: "biz_policy",
  内部电价: "biz_policy",
  电成本: "biz_policy",
  场站租赁: "biz_policy",
  运维包: "ops_kpi",
  出租率: "ops_kpi",
  月租金: "biz_policy",
  押金: "biz_policy",
  坏账率: "ops_kpi",
  班次: "labor_market",
  工时: "labor_market",
  每周工作天: "labor_market",
  "集采价含税": "biz_policy",
  "指导价含税": "biz_policy",
  上牌: "biz_policy",
  GPS: "biz_policy",
  耗电系数: "asset_native",
  "小桔佣金占比": "biz_policy",
  "单枪功率(中型)": "asset_native",
  运营期限: "asset_native",
};

function natureOfMetric(metricZh: string): ConstNatureId {
  return CONST_METRIC_NATURE[metricZh] || "ops_kpi";
}

/** 案例表假设包：不同业态/模式/资产各有一套常量，经营假设页做 Excel↔画布校验 */
type AssumptionPackId = "dae-es-zhuanche" | "station-mid" | "lto-ut-kuaiche";

type AssumptionCheckRow = {
  packId: AssumptionPackId;
  packZh: string;
  sourceId: string;
  sheetZh: string;
  appliesZh: string;
  metricZh: string;
  nature: ConstNatureId;
  natureZh: string;
  excelZh: string;
  canvasZh: string;
  status: "对齐" | "偏离" | "待案例表";
};

function approxEqNum(a: number, b: number, tol = 0.005): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const scale = Math.max(1, Math.abs(b));
  return Math.abs(a - b) <= Math.max(tol, scale * tol);
}

function fmtAuditNum(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 100 || Number.isInteger(n)) return String(Math.round(n * 1000) / 1000);
  return String(Math.round(n * 10 ** digits) / 10 ** digits);
}

/**
 * 对照已附 Excel「1.1假设」与画布现值。
 * DAE/充电桩：强制对齐；LTO：无同级表时标「待案例表」。
 */
function buildAssumptionAudit(args: {
  daeCard: VehicleCard;
  ltoCard?: VehicleCard;
  stationSku?: AssetSku;
  daeProfile: OpsProfile;
  ltoProfile?: OpsProfile;
  scenario: CashflowScenario;
}): AssumptionCheckRow[] {
  const sc = args.scenario;
  const scZh = SCENARIO_LABEL_ZH[sc];
  const daeCard = applyScenarioToVehicleCard(args.daeCard, sc);
  const knobs = DAE_SCENARIO_KNOBS[sc];
  const stOps = applyScenarioToStationOps(
    resolveStationOps(
      args.stationSku ||
        DEFAULT_ASSET_SKUS.find((s) => s.id === "station-medium") ||
        DEFAULT_ASSET_SKUS.find((s) => s.kind === "station")!,
    ),
    sc,
    args.stationSku ? stationOpsScaleOf(args.stationSku) : 1,
  );
  const stKnob = STATION_SCENARIO_KNOBS[sc];
  const daeSku =
    DEFAULT_ASSET_SKUS.find((s) => s.id === "aion-es") || DEFAULT_ASSET_SKUS[0]!;
  const daysMo = opsDaysPerMonth(daeCard.daysWeek || 6);
  const chargeMoCanvas =
    daeKmDay(daeCard) *
    ((daeSku.kwhPer100 || 15) / 100) *
    knobs.elecMxn *
    daysMo;
  const chargeMoExpect =
    daeKmDay({ ...daeCard, util: knobs.util, daysWeek: 6 }) *
    (15 / 100) *
    knobs.elecMxn *
    opsDaysPerMonth(6);

  const srcSheet =
    sc === "base"
      ? "1.1假设-DAE-专车"
      : `情景常量·${scZh}（中性=案例表）`;
  const stSheet =
    sc === "base"
      ? "1.1假设-充电桩"
      : `情景常量·${scZh}（中性=案例表）`;

  const daePairs: { metricZh: string; excel: number; canvas: number; unit: string }[] =
    [
      { metricZh: "利用率", excel: knobs.util, canvas: daeCard.util ?? 0, unit: "" },
      { metricZh: "IPH", excel: knobs.iphMxn, canvas: daeCard.iphMxn || 0, unit: "MXN/h" },
      { metricZh: "滴滴补贴", excel: knobs.subsidyPct, canvas: daeCard.subsidyPct ?? 0, unit: "" },
      { metricZh: "司机薪酬(单人)", excel: knobs.driverMxn, canvas: daeCard.driverMxn || 0, unit: "MXN/月" },
      {
        metricZh: "司机成本(两班×利用)",
        excel: knobs.driverMxn * 2 * knobs.util,
        canvas: daeDriverMonthMxn({ ...daeCard, mode: "DAE", shiftsPerDay: 2 }),
        unit: "MXN/月",
      },
      { metricZh: "保险", excel: knobs.insuranceYrMxn, canvas: daeCard.insuranceYrMxn || 0, unit: "MXN/年" },
      { metricZh: "保养", excel: knobs.maintMxn, canvas: daeCard.maintMxn || 0, unit: "MXN/月" },
      { metricZh: "软件", excel: knobs.softMxn, canvas: daeCard.softMxn || 0, unit: "MXN/月" },
      { metricZh: "易损合计", excel: knobs.wearYrMxn, canvas: daeCard.wearYrMxn || 0, unit: "MXN/年" },
      { metricZh: "车位租金", excel: knobs.parkingMxn, canvas: daeCard.parkingMxn ?? 0, unit: "MXN/月" },
      { metricZh: "电价", excel: knobs.elecMxn, canvas: knobs.elecMxn, unit: "MXN/kWh" },
      { metricZh: "充电费(推算月)", excel: chargeMoExpect, canvas: chargeMoCanvas, unit: "MXN/月" },
      { metricZh: "残值率", excel: knobs.residualRate, canvas: daeCard.residualRate ?? 0, unit: "" },
    ];

  const rows: AssumptionCheckRow[] = daePairs.map((p) => {
    const nature = natureOfMetric(p.metricZh);
    return {
      packId: "dae-es-zhuanche",
      packZh: `DAE·专车·ES·${scZh}`,
      sourceId: "fenbang-dae-xlsx",
      sheetZh: srcSheet,
      appliesZh: `墨西哥 · 网约车·专车 · DAE · ES · ${scZh}`,
      metricZh: p.metricZh,
      nature,
      natureZh: CONST_NATURE_META[nature].labelZh,
      excelZh: `${fmtAuditNum(p.excel)}${p.unit ? ` ${p.unit}` : ""}`,
      canvasZh: `${fmtAuditNum(p.canvas)}${p.unit ? ` ${p.unit}` : ""}`,
      status: approxEqNum(p.canvas, p.excel, p.metricZh.includes("充电") ? 0.03 : 0.005)
        ? "对齐"
        : "偏离",
    };
  });

  const stPairs: { metricZh: string; excel: number; canvas: number; unit: string }[] =
    [
      { metricZh: "外部利用率", excel: stKnob.externalUtil, canvas: stOps.externalUtil, unit: "" },
      { metricZh: "内部利用率", excel: stKnob.internalUtil, canvas: stOps.internalUtil, unit: "" },
      { metricZh: "外部电价", excel: stKnob.externalPriceMxn, canvas: stOps.externalPriceMxn, unit: "MXN/kWh" },
      { metricZh: "内部电价", excel: stKnob.internalPriceMxn, canvas: stOps.internalPriceMxn, unit: "MXN/kWh" },
      { metricZh: "电成本", excel: stKnob.elecCostMxn, canvas: stOps.elecCostMxn, unit: "MXN/kWh" },
      { metricZh: "场站租赁", excel: stKnob.rentMonthMxn, canvas: stOps.rentMonthMxn, unit: "MXN/月" },
      { metricZh: "运维包", excel: stKnob.opexMonthMxn, canvas: stOps.opexMonthMxn, unit: "MXN/月" },
    ];

  for (const p of stPairs) {
    const nature = natureOfMetric(p.metricZh);
    rows.push({
      packId: "station-mid",
      packZh: `充电桩·中型·${scZh}`,
      sourceId: "fenbang-station-xlsx",
      sheetZh: stSheet,
      appliesZh: `墨西哥 · 场站 · 中型 · ${scZh}`,
      metricZh: p.metricZh,
      nature,
      natureZh: CONST_NATURE_META[nature].labelZh,
      excelZh: `${fmtAuditNum(p.excel)}${p.unit ? ` ${p.unit}` : ""}`,
      canvasZh: `${fmtAuditNum(p.canvas)}${p.unit ? ` ${p.unit}` : ""}`,
      status: approxEqNum(p.canvas, p.excel, 0.01) ? "对齐" : "偏离",
    });
  }

  const ltoRaw = args.ltoCard;
  if (ltoRaw) {
    const lto = applyScenarioToVehicleCard(ltoRaw, sc);
    const lk = LTO_SCENARIO_KNOBS[sc];
    const pending = [
      { metricZh: "出租率", excel: lk.occupancy, canvas: lto.occupancy ?? 0, unit: "" },
      { metricZh: "月租金", excel: lk.rentMonthMxn, canvas: lto.rentMonthMxn ?? 0, unit: "MXN" },
      { metricZh: "押金", excel: lk.depositMxn, canvas: lto.depositMxn ?? 0, unit: "MXN" },
      { metricZh: "坏账率", excel: lk.badDebt, canvas: lto.badDebt ?? 0, unit: "" },
    ];
    for (const p of pending) {
      const nature = natureOfMetric(p.metricZh);
      rows.push({
        packId: "lto-ut-kuaiche",
        packZh: `LTO·快车·UT·${scZh}`,
        sourceId: "fenbang-lto-xlsx",
        sheetZh: `情景常量·${scZh}（待附 Excel）`,
        appliesZh: `墨西哥 · 网约车·快车 · LTO · UT · ${scZh}`,
        metricZh: p.metricZh,
        nature,
        natureZh: CONST_NATURE_META[nature].labelZh,
        excelZh: `${fmtAuditNum(p.excel)}${p.unit ? ` ${p.unit}` : ""}`,
        canvasZh: `${fmtAuditNum(p.canvas)}${p.unit ? ` ${p.unit}` : ""}`,
        status: "待案例表",
      });
    }
  }

  return rows;
}

/** 案例表日均营运天：周 6 天 × 52/12 */
function opsDaysPerMonth(daysWeek = 6): number {
  return Math.max(1, (daysWeek || 6) * (52 / 12));
}

/** 《DAE-200》案例表日工时；司机单人月薪 26000 对应该基准 */
const DAE_BASE_HOURS_DAY = 9.5;

/**
 * DAE 有效司机月薪：案例表单司机 26000（9.5h/班）× 班次 × 利用率 × (日工时/9.5)。
 * 两班×75%×9.5h → 39000；日工时加到 11h → ×11/9.5。
 */
function daeDriverMonthMxn(card: VehicleCard): number {
  if (card.mode !== "DAE" || !(card.driverMxn > 0)) return 0;
  const shifts = Math.max(1, card.shiftsPerDay || 1);
  const util = Math.max(0, Math.min(1, card.util ?? 0.75));
  const hours = Math.max(0.5, card.hoursDay || DAE_BASE_HOURS_DAY);
  const hoursMul = hours / DAE_BASE_HOURS_DAY;
  return card.driverMxn * shifts * util * hoursMul;
}

/**
 * DAE 日均里程：案例表标称 350km/天/台，充电按 ×利用率（不加班次；两班仍一台车）。
 */
function daeKmDay(card: VehicleCard): number {
  const daysMo = opsDaysPerMonth(card.daysWeek || 6);
  const util = Math.max(0, Math.min(1, card.util ?? 0.75));
  return (350 * (card.daysWeek || 6) * (52 / 12) * util) / daysMo;
}

type WaterfallSlice = {
  id: string;
  nameZh: string;
  layer: CfLayer | "passenger" | "residual";
  amountMxn: number;
  remainingAfterMxn: number;
  noteZh: string;
};

type AssetDayCashflow = {
  country: string;
  vertical: string;
  mode: OpMode;
  passengerPayMxn: number;
  slices: WaterfallSlice[];
  spvInflowMxn: number;
  spvResidualMxn: number;
  chargeDayMxn: number;
  noteZh: string;
};

type AssetMonthBar = {
  label: string;
  /** 负向：购置落地 / 养护 / 充电 / 随机维保 */
  capexMxn: number;
  maintMxn: number;
  chargeMxn: number;
  randomMaintMxn: number;
  /** 正向：进入运营 SPV 的经营流入（抽佣后、顺位分配前） */
  opsInMxn: number;
  /** 瀑布顺位+当日充电后的权益层剩余（可为 0） */
  equityInMxn: number;
  outflowMxn: number;
  /** 经营流入 − 本图支出项（购置/养护/充电/随机）；不含顺位分配 */
  netMxn: number;
};

function defaultSpvTiers(mode: OpMode, driverDayMxn: number): WaterfallTier[] {
  const daysMo = opsDaysPerMonth(6);
  return [
    {
      id: "investor_pi",
      nameZh: "优先投资本息",
      layer: "spv",
      pctOfRemaining: 0,
      fixedDayMxn: 0,
      enabled: false,
      investor: defaultInvestorPi(),
      noteZh:
        mode === "DAE"
          ? "单位路径示意债服；正式债服亦可对组合/订单支付方案"
          : "LTO/RTO 默认关闭；可按本金比例+利率展开单位路径债服",
    },
    {
      id: "driver_wage",
      nameZh: "司机工资预留",
      layer: "spv",
      pctOfRemaining: 0,
      fixedDayMxn: Math.max(0, driverDayMxn),
      enabled: mode === "DAE",
      wage: defaultDriverWage(mode, driverDayMxn, daysMo),
      noteZh: "按月/周/日预留；默认跟卡：单司机×班次×利用率",
    },
    {
      id: "other_opex",
      nameZh: "可变成本",
      layer: "spv",
      pctOfRemaining: 0,
      fixedDayMxn: 0,
      enabled: false,
      varOpex: { items: defaultVarOpexItems() },
      noteZh: "激励/过路等可变项；日充电与费率在可变成本卡一并配置；易损件另见固定成本",
    },
  ];
}

/** 周期工资 → 日预留 */
function wageReserveDayMxn(
  wage: DriverWageDetail,
  card: VehicleCard,
): number {
  const cover = Math.max(0, Math.min(1.5, wage.coverPct ?? 1));
  const daysMo = opsDaysPerMonth(card.daysWeek || 6);
  let cycleAmt = Math.max(0, wage.amountMxn);
  if (wage.source === "from_card" && card.mode === "DAE") {
    cycleAmt = daeDriverMonthMxn(card);
    // from_card 始终按「月」口径算日额
    return (cycleAmt / daysMo) * cover;
  }
  if (wage.cycle === "day") return cycleAmt * cover;
  if (wage.cycle === "week") {
    const dw = Math.max(1, card.daysWeek || 6);
    return (cycleAmt / dw) * cover;
  }
  return (cycleAmt / daysMo) * cover;
}

/** 月供（MXN）→ 按营运日摊日 */
function investorMonthPayMxn(
  inv: InvestorPiDetail,
  principalMxn: number,
  opsMonth: number,
): number {
  const P = Math.max(0, principalMxn);
  if (P <= 0) return 0;
  const invN = normalizeInvestorPi(inv);
  const n = Math.max(1, Math.round(invN.tenureMonths || 1));
  const m = Math.max(0, Math.round(opsMonth));
  if (m <= 0) {
    const preview = investorPreviewMonth(invN);
    const bal = investorOpeningBalance(invN, P, preview);
    return investorPaymentForMonth(invN, P, bal, preview);
  }
  if (m > n) return 0;
  const bal = investorOpeningBalance(invN, P, m);
  return investorPaymentForMonth(invN, P, bal, m);
}

function investorDayTakeMxn(
  inv: InvestorPiDetail,
  unitLandedMxn: number,
  daysMo: number,
  opsMonth: number,
): number {
  const principal = unitLandedMxn * Math.max(0, Math.min(1, inv.principalPct));
  const invN = normalizeInvestorPi(inv);
  const monthPay = investorMonthPayMxn(
    invN,
    principal,
    opsMonth > 0 ? opsMonth : investorPreviewMonth(invN),
  );
  return monthPay / Math.max(1, daysMo);
}

function varOpexTakeFromPool(
  detail: VarOpexDetail | undefined,
  pool: number,
  opts?: {
    /** 变动日额（过路等）；默认 true */
    includeFixedDay?: boolean;
    /** 占池%（冲单激励等）；默认 true */
    includePctPool?: boolean;
  },
): { take: number; noteZh: string } {
  if (!detail?.items?.length) return { take: 0, noteZh: "无可变项" };
  const includeFixedDay = opts?.includeFixedDay !== false;
  const includePctPool = opts?.includePctPool !== false;
  let take = 0;
  const parts: string[] = [];
  for (const it of detail.items.filter((x) => x.enabled)) {
    if (it.kind === "pct_pool" && !includePctPool) continue;
    if (it.kind !== "pct_pool" && !includeFixedDay) continue;
    let add = 0;
    if (it.kind === "pct_pool") {
      add = pool * Math.max(0, Math.min(0.5, it.pct || 0));
    } else {
      add = Math.max(0, it.fixedDayMxn || 0);
    }
    if (add > 0) {
      take += add;
      parts.push(
        `${it.nameZh}${it.kind === "pct_pool" ? `(${Math.round((it.pct || 0) * 1000) / 10}%)` : ""}`,
      );
    }
  }
  return {
    take,
    noteZh: parts.length ? `扣：${parts.join("、")}` : "未启用分项",
  };
}
/** 经营情景：保守 / 中性 / 激进（中性对齐 Excel「1.1假设」） */
const SCENARIO_LABEL_ZH: Record<CashflowScenario, string> = {
  down: "保守",
  base: "中性",
  up: "激进",
};

const SCENARIO_OPTS: { id: CashflowScenario; label: string }[] = [
  { id: "down", label: SCENARIO_LABEL_ZH.down },
  { id: "base", label: SCENARIO_LABEL_ZH.base },
  { id: "up", label: SCENARIO_LABEL_ZH.up },
];

/** DAE 专车·ES：中性=案例表；保守/激进为同口径分项常量（非单一倍率） */
type DaeScenarioKnob = {
  util: number;
  iphMxn: number;
  subsidyPct: number;
  driverMxn: number;
  insuranceYrMxn: number;
  maintMxn: number;
  softMxn: number;
  wearYrMxn: number;
  parkingMxn: number;
  elecMxn: number;
  residualRate: number;
};

const DAE_SCENARIO_KNOBS: Record<CashflowScenario, DaeScenarioKnob> = {
  base: {
    util: 0.75,
    iphMxn: 210,
    subsidyPct: 0.05,
    driverMxn: 26_000,
    insuranceYrMxn: 25_000,
    maintMxn: 1_500,
    softMxn: 500,
    wearYrMxn: 12_000 + 16_000 + 20_800,
    parkingMxn: 280,
    elecMxn: 7,
    residualRate: 0.1,
  },
  down: {
    util: 0.62,
    iphMxn: 185,
    subsidyPct: 0.02,
    driverMxn: 27_500,
    insuranceYrMxn: 28_000,
    maintMxn: 1_800,
    softMxn: 550,
    wearYrMxn: 55_000,
    parkingMxn: 320,
    elecMxn: 7.8,
    residualRate: 0.06,
  },
  up: {
    util: 0.85,
    iphMxn: 230,
    subsidyPct: 0.07,
    driverMxn: 24_500,
    insuranceYrMxn: 22_000,
    maintMxn: 1_300,
    softMxn: 450,
    wearYrMxn: 42_000,
    parkingMxn: 250,
    elecMxn: 6.5,
    residualRate: 0.12,
  },
};

type StationScenarioKnob = {
  externalUtil: number;
  internalUtil: number;
  externalPriceMxn: number;
  internalPriceMxn: number;
  elecCostMxn: number;
  rentMonthMxn: number;
  opexMonthMxn: number;
  xiaojufenPct: number;
};

/** 充电桩：中性=「1.1假设-充电桩」；保守/激进分项调利用、电价、场租与运维 */
const STATION_SCENARIO_KNOBS: Record<CashflowScenario, StationScenarioKnob> = {
  base: {
    externalUtil: 0.1,
    internalUtil: 0.2,
    externalPriceMxn: 8,
    internalPriceMxn: 7,
    elecCostMxn: 3,
    rentMonthMxn: 81_200,
    opexMonthMxn: 160_000,
    xiaojufenPct: 0.1,
  },
  down: {
    externalUtil: 0.07,
    internalUtil: 0.14,
    externalPriceMxn: 7.5,
    internalPriceMxn: 6.5,
    elecCostMxn: 3.4,
    rentMonthMxn: 90_000,
    opexMonthMxn: 175_000,
    xiaojufenPct: 0.12,
  },
  up: {
    externalUtil: 0.14,
    internalUtil: 0.26,
    externalPriceMxn: 8.5,
    internalPriceMxn: 7.2,
    elecCostMxn: 2.7,
    rentMonthMxn: 74_000,
    opexMonthMxn: 145_000,
    xiaojufenPct: 0.08,
  },
};

type LeaseScenarioKnob = {
  occupancy: number;
  badDebt: number;
  rentMonthMxn: number;
  depositMxn: number;
};

const LTO_SCENARIO_KNOBS: Record<CashflowScenario, LeaseScenarioKnob> = {
  base: {
    occupancy: 0.85,
    badDebt: 0.015,
    rentMonthMxn: 19_500,
    depositMxn: 6_000,
  },
  down: {
    occupancy: 0.72,
    badDebt: 0.03,
    rentMonthMxn: 18_000,
    depositMxn: 7_000,
  },
  up: {
    occupancy: 0.93,
    badDebt: 0.008,
    rentMonthMxn: 21_000,
    depositMxn: 5_000,
  },
};

const RTO_SCENARIO_KNOBS: Record<CashflowScenario, LeaseScenarioKnob> = {
  base: {
    occupancy: 0.8,
    badDebt: 0.02,
    rentMonthMxn: 21_000,
    depositMxn: 8_000,
  },
  down: {
    occupancy: 0.68,
    badDebt: 0.035,
    rentMonthMxn: 19_500,
    depositMxn: 9_000,
  },
  up: {
    occupancy: 0.88,
    badDebt: 0.012,
    rentMonthMxn: 22_500,
    depositMxn: 7_000,
  },
};

function applyScenarioToVehicleCard(
  card: VehicleCard,
  sc: CashflowScenario,
): VehicleCard {
  if (card.mode === "DAE") {
    const k = DAE_SCENARIO_KNOBS[sc];
    return {
      ...card,
      util: k.util,
      iphMxn: k.iphMxn,
      subsidyPct: k.subsidyPct,
      driverMxn: k.driverMxn,
      insuranceYrMxn: k.insuranceYrMxn,
      maintMxn: k.maintMxn,
      softMxn: k.softMxn,
      wearYrMxn: k.wearYrMxn,
      parkingMxn: k.parkingMxn,
      residualRate: k.residualRate,
    };
  }
  const lease =
    card.mode === "RTO" ? RTO_SCENARIO_KNOBS[sc] : LTO_SCENARIO_KNOBS[sc];
  if (card.mode === "LTO" || card.mode === "RTO") {
    return {
      ...card,
      occupancy: lease.occupancy,
      badDebt: lease.badDebt,
      rentMonthMxn: lease.rentMonthMxn,
      depositMxn: lease.depositMxn,
    };
  }
  return card;
}

/** scale：大/小站相对中型站的租金运维缩放（中性表为 scale=1） */
function stationOpsScaleOf(sku: AssetSku): number {
  return STATION_TIER_DEFS.find((t) => t.id === sku.id)?.opsScale ?? 1;
}

function applyScenarioToStationOps(
  ops: StationOpsConstants,
  sc: CashflowScenario,
  scale = 1,
): StationOpsConstants {
  const k = STATION_SCENARIO_KNOBS[sc];
  return {
    ...ops,
    externalUtil: k.externalUtil,
    internalUtil: k.internalUtil,
    externalPriceMxn: k.externalPriceMxn,
    internalPriceMxn: k.internalPriceMxn,
    elecCostMxn: k.elecCostMxn,
    rentMonthMxn: Math.round(k.rentMonthMxn * scale),
    opexMonthMxn: Math.round(k.opexMonthMxn * scale),
    xiaojufenPct: k.xiaojufenPct,
  };
}

/** @deprecated 情景已改为分项常量；保留=1 以免旧调用双计 */
function scenarioCashMul(_sc: CashflowScenario): number {
  return 1;
}

function skuSpecValue(sku: AssetSku, id: string): string {
  return (
    (sku.productSpecs || []).find((r) => r.id === id)?.valueZh || ""
  ).trim();
}

function skuBrandDisplay(sku: AssetSku): string {
  if (sku.brand && !sku.brand.includes("待填")) return sku.brand;
  const fromSpec = skuSpecValue(sku, "brand");
  if (fromSpec && !fromSpec.includes("待填")) return fromSpec;
  if (sku.stationSpec?.brand && !sku.stationSpec.brand.includes("待填"))
    return sku.stationSpec.brand;
  const mc = (sku.majorComponents || []).find(
    (c) =>
      c.id === "body" ||
      c.id === "pack" ||
      c.nameZh.includes("车身") ||
      c.nameZh.includes("整车") ||
      c.nameZh.includes("整站") ||
      c.nameZh.includes("充电设备"),
  );
  if (mc?.brandZh && !mc.brandZh.includes("待填")) return mc.brandZh;
  return sku.brand || "—";
}

function skuMakerDisplay(sku: AssetSku): string {
  const origin = skuSpecValue(sku, "origin");
  if (origin) return origin;
  if (
    sku.stationSpec?.manufacturer &&
    !sku.stationSpec.manufacturer.includes("待填")
  )
    return sku.stationSpec.manufacturer;
  const mc = (sku.majorComponents || []).find(
    (c) =>
      c.id === "body" ||
      c.id === "pack" ||
      c.nameZh.includes("车身") ||
      c.nameZh.includes("整车") ||
      c.nameZh.includes("整站") ||
      c.nameZh.includes("充电设备"),
  );
  if (mc?.manufacturerZh && !mc.manufacturerZh.includes("待填"))
    return mc.manufacturerZh;
  return "—";
}

/** 商详副标题：车辆只留定位语；厂商/产地放规格页，避免头区再刷一遍广汽埃安 */
function skuDetailSubtitleZh(sku: AssetSku): string {
  if (sku.kind === "station") {
    const model = sku.model || "";
    const tag = sku.tagline || "";
    if (!model || isRedundantSkuModel(sku.nameZh, model)) return tag;
    return [model, tag].filter(Boolean).join(" · ");
  }
  return sku.tagline || "";
}

/** 车名与 model 是否同一信息（如「埃安 ES」vs「广汽埃安 ES」/「ES」） */
function isRedundantSkuModel(nameZh: string, model: string): boolean {
  const n = (nameZh || "").replace(/\s+/g, "");
  const m = (model || "").replace(/\s+/g, "");
  if (!n || !m) return false;
  if (n === m) return true;
  if (m.includes(n) || n.includes(m)) return true;
  // 去掉集团前缀后再比：广汽埃安ES ≈ 埃安ES
  const stripGroup = (s: string) => s.replace(/^广汽/, "");
  return stripGroup(n) === stripGroup(m);
}

/** 列表/卡片标题：不并排重复写 nameZh + 广汽埃安 ES */
function skuTitleZh(sku: AssetSku): string {
  const name = sku.nameZh || "";
  const model = sku.model || "";
  if (!model || isRedundantSkuModel(name, model)) return name || model || "—";
  return `${name}（${model}）`;
}

/** 资产卡一行：车名 · 模式，model 仅在有增量信息时附带 */
function vehicleCardTitleZh(card: {
  nameZh: string;
  model: string;
  mode?: string;
}): string {
  const name = card.nameZh || "";
  const model = card.model || "";
  const mode = card.mode || "";
  const core = isRedundantSkuModel(name, model) || !model
    ? name
    : `${name} · ${model}`;
  return mode ? `${core} · ${mode}` : core;
}

/** 直线折旧残值率：在 lifeYears 内从 100% 降至 endRate */
function lifeResidualRate(
  ageYear: number,
  lifeYears: number,
  endRate: number,
): number {
  const life = Math.max(1, lifeYears || 1);
  const end = Math.max(0, Math.min(1, endRate));
  const t = Math.max(0, ageYear);
  if (t <= 0) return 1;
  if (t >= life) return end;
  return 1 - (1 - end) * (t / life);
}

/**
 * 市场/行业残值曲线取值（ratePct）。
 * 样本年内插值；超出末样本年按末段年留存率递减并趋缓，不低于 floorPct——避免五年后平台持平。
 */
function residualCurveRatePct(
  pts: ResidualCurvePoint[],
  year: number,
  floorPct = 8,
): number {
  if (!pts.length) return 0;
  const sorted = [...pts].sort((a, b) => a.year - b.year);
  const y = Math.max(0, year);
  const exact = sorted.find((p) => p.year === y);
  if (exact) return exact.ratePct;
  const lo = [...sorted].filter((p) => p.year < y).pop();
  const hi = sorted.find((p) => p.year > y);
  if (lo && hi) {
    const t = (y - lo.year) / Math.max(1, hi.year - lo.year);
    return Math.round((lo.ratePct + (hi.ratePct - lo.ratePct) * t) * 10) / 10;
  }
  if (hi && !lo) return hi.ratePct;
  if (!lo) return 0;
  const prev = [...sorted].filter((p) => p.year < lo.year).pop();
  let annualRet =
    prev && prev.ratePct > 1e-6 ? lo.ratePct / prev.ratePct : 0.88;
  annualRet = Math.max(0.78, Math.min(0.94, annualRet));
  let r = lo.ratePct;
  for (let t = lo.year + 1; t <= y; t++) {
    const beyond = t - lo.year;
    const ret =
      annualRet + (0.93 - annualRet) * Math.min(1, (beyond - 1) / 6);
    r = Math.max(floorPct, r * ret);
  }
  return Math.round(r * 10) / 10;
}

/** 各寿命口径期末残值率（0–1，SKU 可配；缺省回落 DEFAULT_END_RESIDUAL） */
function skuLifeEndResidual(
  sku: AssetSku,
  life: "acct" | "phys" | "maint",
): number {
  const raw =
    life === "phys"
      ? sku.physResidualRate
      : life === "maint"
        ? sku.maintResidualRate
        : sku.residualRate;
  const fallback =
    life === "phys"
      ? DEFAULT_END_RESIDUAL.phys
      : life === "maint"
        ? DEFAULT_END_RESIDUAL.maint
        : DEFAULT_END_RESIDUAL.acct;
  return Math.max(0, Math.min(1, raw ?? fallback));
}

/** 账面残值率：会计寿命直线折旧至会计期末残值 */
function bookResidualRate(sku: AssetSku, ageYear: number): number {
  return lifeResidualRate(
    ageYear,
    sku.acctYears || 1,
    skuLifeEndResidual(sku, "acct"),
  );
}

/**
 * 市场残值率（0–1）：与资产估值「逐年·市场残值率」同曲线（residualFair + 插值/长尾）。
 * 无 marketIntel 时返回 null，调用方回落账面或手改覆盖。
 */
function marketFairResidualRate(
  sku: AssetSku,
  ageYear: number,
): number | null {
  const pts = sku.marketIntel?.residualFair;
  if (!pts?.length) return null;
  return Math.max(
    0,
    Math.min(1, residualCurveRatePct(pts, ageYear) / 100),
  );
}

/** 物理寿命残值率：物理寿命直线折旧至物理期末残值 */
function physResidualRate(sku: AssetSku, ageYear: number): number {
  return lifeResidualRate(
    ageYear,
    sku.physYears || sku.acctYears || 1,
    skuLifeEndResidual(sku, "phys"),
  );
}

/** 维保寿命残值率：维保寿命直线折旧至维保期末残值 */
function maintResidualRate(sku: AssetSku, ageYear: number): number {
  return lifeResidualRate(
    ageYear,
    sku.maintYears || sku.acctYears || 1,
    skuLifeEndResidual(sku, "maint"),
  );
}

function defaultModeForSku(sku: AssetSku): OpMode {
  if (sku.id === "aion-es") return "DAE";
  if (sku.id === "aion-ut") return "LTO";
  return "DAE";
}

function defaultAssetCfConfig(
  mode: OpMode,
  card: VehicleCard,
  sku: AssetSku,
): AssetCashflowConfig {
  const daysMo = opsDaysPerMonth(card.daysWeek || 6);
  const driverDay =
    mode === "DAE" ? daeDriverMonthMxn(card) / daysMo : 0;
  const isLease = mode === "LTO" || mode === "RTO";
  const kmDay = mode === "DAE" ? daeKmDay(card) : 80;
  const kwhPer100 = sku.kwhPer100 || card.kwhPer100 || 15;
  /** DAE：案例表内部电价 7；LTO/RTO 默认承租人电费，不进车队日成本 */
  const chargeDay =
    mode === "DAE" ? (kmDay / 100) * kwhPer100 * 7 : 0;
  const parkingMo = mode === "DAE" ? (card.parkingMxn ?? 280) : 0;
  const insuranceYr = card.insuranceYrMxn ?? sku.insuranceYrMxn ?? 0;
  /** LTO/RTO 卡上 maint/wear=0 表示承租人侧；勿用 || 回落到 SKU 的 DAE 运维 */
  const maintMo = isLease
    ? (card.maintMxn ?? 0)
    : (card.maintMxn ?? sku.maintMxn ?? 0);
  const softMo = card.softMxn ?? sku.softMxn ?? 0;
  const wearYr = isLease
    ? (card.wearYrMxn ?? 0)
    : (card.wearYrMxn ?? sku.wearYrMxn ?? 0);
  const lifeMo = Math.max(
    12,
    Math.min(60, Math.round((card.acctYears || sku.acctYears || 5) * 12)),
  );
  const fixLines = {
    varCostEnabled: true,
    fixedCostEnabled: true,
    fixedCostSource: "from_card" as const,
    fixInsuranceYrMxn: insuranceYr,
    fixInsuranceOn: true,
    fixMaintMoMxn: maintMo,
    fixMaintOn: true,
    fixSoftMoMxn: softMo,
    fixSoftOn: true,
    fixParkingMoMxn: parkingMo,
    fixParkingOn: mode === "DAE",
    fixWearPer10kKmMxn: defaultWearPer10kKmMxn(card, wearYr),
    fixWearOn: true,
  };
  return {
    boundMode: mode,
    assumptionsVer: CF_ASSUMPTIONS_VER,
    // DAE：《DAE-200》IPH 已是车队里程收入，表内不再另扣通道/平台；LTO/RTO 直租同理默认 0
    paymentFeePct: 0,
    platformTakePct: 0,
    spvTiers: defaultSpvTiers(mode, driverDay),
    ...fixLines,
    annualMaintMxn: annualMaintFromFixedLines(fixLines),
    chargeDayMxn: Math.round(chargeDay * 100) / 100,
    chargeCycle: "day",
    chargeAmountMxn: Math.round(chargeDay * 100) / 100,
    chargeSource: "from_card",
    randomMaintMonthMxn: wearMonthFromFixed(fixLines, card),
    /** LTO/RTO 对齐会计寿命；DAE 至少 60 月 */
    horizonMonths: isLease ? lifeMo : Math.max(lifeMo, 60),
  };
}

/** 合并旧持久化（无 boundMode / 假设版本过期则整表重导入） */
function normalizeCfConfig(
  raw: Partial<AssetCashflowConfig> | null | undefined,
  mode: OpMode,
  card: VehicleCard,
  sku: AssetSku,
): AssetCashflowConfig {
  const base = defaultAssetCfConfig(mode, card, sku);
  if (!raw || raw.assumptionsVer !== CF_ASSUMPTIONS_VER) {
    return base;
  }
  return {
    ...base,
    ...raw,
    assumptionsVer: CF_ASSUMPTIONS_VER,
    boundMode: raw.boundMode || mode,
    varCostEnabled:
      raw.varCostEnabled != null ? !!raw.varCostEnabled : base.varCostEnabled,
    fixedCostEnabled:
      raw.fixedCostEnabled != null ? !!raw.fixedCostEnabled : base.fixedCostEnabled,
    fixedCostSource:
      raw.fixedCostSource === "manual" || raw.fixedCostSource === "from_card"
        ? raw.fixedCostSource
        : base.fixedCostSource,
    fixInsuranceYrMxn:
      raw.fixInsuranceYrMxn != null
        ? raw.fixInsuranceYrMxn
        : base.fixInsuranceYrMxn,
    fixInsuranceOn:
      raw.fixInsuranceOn != null ? !!raw.fixInsuranceOn : base.fixInsuranceOn,
    fixMaintMoMxn:
      raw.fixMaintMoMxn != null ? raw.fixMaintMoMxn : base.fixMaintMoMxn,
    fixMaintOn:
      raw.fixMaintOn != null ? !!raw.fixMaintOn : base.fixMaintOn,
    fixSoftMoMxn:
      raw.fixSoftMoMxn != null ? raw.fixSoftMoMxn : base.fixSoftMoMxn,
    fixSoftOn: raw.fixSoftOn != null ? !!raw.fixSoftOn : base.fixSoftOn,
    fixParkingMoMxn:
      raw.fixParkingMoMxn != null
        ? raw.fixParkingMoMxn
        : base.fixParkingMoMxn,
    fixParkingOn:
      raw.fixParkingOn != null ? !!raw.fixParkingOn : base.fixParkingOn,
    fixWearPer10kKmMxn:
      raw.fixWearPer10kKmMxn != null
        ? raw.fixWearPer10kKmMxn
        : raw.fixWearYrMxn != null
          ? defaultWearPer10kKmMxn(card, raw.fixWearYrMxn)
          : base.fixWearPer10kKmMxn,
    fixWearOn:
      raw.fixWearOn != null ? !!raw.fixWearOn : base.fixWearOn,
    chargeCycle:
      raw.chargeCycle === "week" ||
      raw.chargeCycle === "month" ||
      raw.chargeCycle === "year" ||
      raw.chargeCycle === "day"
        ? raw.chargeCycle
        : base.chargeCycle,
    chargeAmountMxn:
      raw.chargeAmountMxn != null
        ? raw.chargeAmountMxn
        : base.chargeAmountMxn,
    chargeSource:
      raw.chargeSource === "manual" || raw.chargeSource === "from_card"
        ? raw.chargeSource
        : base.chargeSource,
    spvTiers:
      raw.spvTiers && raw.spvTiers.length > 0 ? raw.spvTiers : base.spvTiers,
    paymentFeePct: Math.max(
      0,
      Math.min(0.2, raw.paymentFeePct ?? base.paymentFeePct),
    ),
    platformTakePct: Math.max(
      0,
      Math.min(0.6, raw.platformTakePct ?? base.platformTakePct),
    ),
    annualMaintMxn: annualMaintFromFixedLines({
      fixedCostEnabled:
        raw.fixedCostEnabled != null
          ? !!raw.fixedCostEnabled
          : base.fixedCostEnabled,
      fixInsuranceOn:
        raw.fixInsuranceOn != null
          ? !!raw.fixInsuranceOn
          : base.fixInsuranceOn,
      fixInsuranceYrMxn:
        raw.fixInsuranceYrMxn != null
          ? raw.fixInsuranceYrMxn
          : base.fixInsuranceYrMxn,
      fixMaintOn:
        raw.fixMaintOn != null ? !!raw.fixMaintOn : base.fixMaintOn,
      fixMaintMoMxn:
        raw.fixMaintMoMxn != null ? raw.fixMaintMoMxn : base.fixMaintMoMxn,
      fixSoftOn:
        raw.fixSoftOn != null ? !!raw.fixSoftOn : base.fixSoftOn,
      fixSoftMoMxn:
        raw.fixSoftMoMxn != null ? raw.fixSoftMoMxn : base.fixSoftMoMxn,
      fixParkingOn:
        raw.fixParkingOn != null
          ? !!raw.fixParkingOn
          : base.fixParkingOn,
      fixParkingMoMxn:
        raw.fixParkingMoMxn != null
          ? raw.fixParkingMoMxn
          : base.fixParkingMoMxn,
    }),
    randomMaintMonthMxn: wearMonthFromFixed(
      {
        fixWearOn:
          raw.fixWearOn != null ? !!raw.fixWearOn : base.fixWearOn,
        fixWearPer10kKmMxn:
          raw.fixWearPer10kKmMxn != null
            ? raw.fixWearPer10kKmMxn
            : raw.fixWearYrMxn != null
              ? defaultWearPer10kKmMxn(card, raw.fixWearYrMxn)
              : base.fixWearPer10kKmMxn,
        fixWearYrMxn: raw.fixWearYrMxn,
      },
      card,
    ),
  };
}

/** 由资产卡 IPH/租金反推乘客支付，再跑平台瀑布 → SPV 瀑布 */
function buildAssetDayCashflow(args: {
  country: string;
  vertical: string;
  mode: OpMode;
  card: VehicleCard;
  sku: AssetSku;
  cfg: AssetCashflowConfig;
  internalPriceMxn?: number;
  /** 单车落地成本（含税）；优先本息按本金比例计 */
  unitLandedMxn?: number;
  /** 经营第几月（1-based）；免本/等额本金用；0=按首个摊还月示意 */
  opsMonth?: number;
}): AssetDayCashflow {
  const { country, vertical, mode, card, sku, cfg } = args;
  const price = args.internalPriceMxn ?? 7;
  const daysMo = opsDaysPerMonth(card.daysWeek || 6);
  const opsMonth = args.opsMonth ?? 0;
  const unitLanded = Math.max(0, args.unitLandedMxn ?? 0);

  let spvTopMxn = 0;
  let note = "";
  if (mode === "DAE") {
    // 案例表：满负荷周流水 = IPH×工时×天×班次；里程收入 = 满负荷×利用率；再 +5% 补贴
    const shifts = Math.max(1, card.shiftsPerDay || 1);
    const util = Math.max(0, Math.min(1, card.util ?? 0.75));
    const monthCap =
      card.iphMxn * card.hoursDay * (card.daysWeek || 6) * shifts * (52 / 12);
    const monthRev = monthCap * util;
    spvTopMxn = (monthRev / daysMo) * (1 + (card.subsidyPct || 0));
    note =
      shifts > 1
        ? `DAE 两班：里程收入=IPH×${card.hoursDay}h×班次${shifts}×利用${Math.round(util * 100)}%（对齐《DAE-200》1.1假设）`
        : `DAE 一班：里程收入=IPH×工时×利用${Math.round(util * 100)}%`;
  } else {
    const occ = card.occupancy || 0.8;
    const bad = Math.max(0, Math.min(0.5, card.badDebt || 0));
    /** 直租/租买：月租金×出租率×(1-坏账)÷营运日；不走网约车乘客瀑布 */
    spvTopMxn = ((card.rentMonthMxn || 0) * occ * (1 - bad)) / daysMo;
    note =
      mode === "LTO"
        ? `LTO 直租：月租 ${card.rentMonthMxn || 0}×出租 ${Math.round(occ * 100)}%×(1-坏账${Math.round(bad * 1000) / 10}%)÷营运日（承租人侧电费默认不进车队）`
        : `RTO 租买：月租买金×出租率×(1-坏账)÷营运日`;
  }

  // 占池：默认 f=p=0 → 乘客实付=车队应收（DAE IPH 净口径）。
  // DAE 手填通道/平台 % 时：IPH 作毛流水正向拆账，车队实收随费率下降。
  // LTO/RTO 手填时仍反推乘客端（月租为车队净目标）。
  const varOn = cfg.varCostEnabled !== false;
  const feePct = varOn ? cfg.paymentFeePct : 0;
  const platPct = varOn ? cfg.platformTakePct : 0;
  const keep = (1 - feePct) * (1 - platPct);
  const hasPoolSplit = feePct > 1e-9 || platPct > 1e-9;
  const useForwardPool = mode === "DAE" && hasPoolSplit;
  const passengerPayMxn = useForwardPool
    ? spvTopMxn
    : keep > 0.05
      ? spvTopMxn / keep
      : spvTopMxn;

  const slices: WaterfallSlice[] = [];
  let pool = passengerPayMxn;
  slices.push({
    id: "passenger",
    nameZh: "乘客实付车费",
    layer: "passenger",
    amountMxn: passengerPayMxn,
    remainingAfterMxn: pool,
    noteZh: "收入分成起点",
  });

  const payFee = pool * feePct;
  pool -= payFee;
  slices.push({
    id: "pay_fee",
    nameZh: "线上支付通道费",
    layer: "platform",
    amountMxn: payFee,
    remainingAfterMxn: pool,
    noteZh: `占乘客实付 ${Math.round(feePct * 1000) / 10}%`,
  });

  const plat = pool * platPct;
  pool -= plat;
  slices.push({
    id: "platform",
    nameZh: "网约车平台抽成",
    layer: "platform",
    amountMxn: plat,
    remainingAfterMxn: pool,
    noteZh: `占扣通道费后剩余 ${Math.round(platPct * 1000) / 10}%`,
  });

  const spvInflow = pool;
  slices.push({
    id: "spv_in",
    nameZh: "进入项目公司（车队应收）",
    layer: "spv",
    amountMxn: spvInflow,
    remainingAfterMxn: pool,
    noteZh: "平台抽成后归入运营主体的金额",
  });

  // 日充电：优先用已折日的 chargeDayMxn；否则按周期预付额折日；DAE 默认可回落电耗×电价
  const kmDay = mode === "DAE" ? daeKmDay(card) : 80;
  const daysWeek = card.daysWeek || 6;
  const cycle: ChargePayCycle =
    cfg.chargeCycle === "week" ||
    cfg.chargeCycle === "month" ||
    cfg.chargeCycle === "year"
      ? cfg.chargeCycle
      : "day";
  const chargeDayRaw =
    mode !== "DAE" &&
    !(cfg.chargeDayMxn > 0) &&
    !(cfg.chargeAmountMxn > 0)
      ? 0
      : cfg.chargeDayMxn > 0
        ? cfg.chargeDayMxn
        : cfg.chargeAmountMxn > 0
          ? chargeDayFromAmount(cfg.chargeAmountMxn, cycle, daysWeek)
          : (kmDay / 100) *
            (sku.kwhPer100 || card.kwhPer100 || 15) *
            price;
  const chargeDay = varOn ? chargeDayRaw : 0;

  for (const tier of cfg.spvTiers) {
    /** 债服延后到运营扣完后再摊，避免挤掉合同固定/易损 */
    if (tier.id === "investor_pi") continue;
    /** other_opex：按分项开关计，不依赖档位总开关（避免「开激励」误开过路） */
    if (tier.id !== "other_opex" && !tier.enabled) continue;
    let take = 0;
    let tierNote = tier.noteZh;
    if (tier.id === "driver_wage" && tier.wage) {
      if (!varOn) continue;
      take = wageReserveDayMxn(tier.wage, card);
      tierNote = `按${tier.wage.cycle === "month" ? "月" : tier.wage.cycle === "week" ? "周" : "日"}预留·覆盖${Math.round((tier.wage.coverPct || 1) * 100)}%`;
    } else if (tier.id === "other_opex" && tier.varOpex) {
      const fixOn = cfg.fixedCostEnabled !== false;
      for (const it of tier.varOpex.items || []) {
        if (!it.enabled) continue;
        let itemTake = 0;
        let itemNote = it.nameZh;
        if (it.kind === "fixed_day") {
          if (!varOn) continue;
          itemTake = Math.max(0, it.fixedDayMxn || 0);
          itemNote = `营运日定额`;
        } else {
          if (!fixOn) continue;
          const pct = Math.max(0, Math.min(0.5, it.pct || 0));
          itemTake = pool * pct;
          itemNote = `占当时剩余池 ${Math.round(pct * 1000) / 10}%`;
        }
        itemTake = Math.min(pool, Math.max(0, itemTake));
        if (itemTake <= 0) continue;
        pool -= itemTake;
        slices.push({
          id: it.id,
          nameZh: it.nameZh,
          layer: "spv",
          amountMxn: itemTake,
          remainingAfterMxn: pool,
          noteZh: itemNote,
        });
      }
      continue;
    } else if (tier.fixedDayMxn > 0) {
      if (!varOn) continue;
      take = tier.fixedDayMxn;
    } else if (tier.pctOfRemaining > 0) {
      take = pool * tier.pctOfRemaining;
    } else {
      continue;
    }
    take = Math.min(pool, Math.max(0, take));
    pool -= take;
    slices.push({
      id: tier.id,
      nameZh: tier.nameZh,
      layer: "spv",
      amountMxn: take,
      remainingAfterMxn: pool,
      noteZh: tierNote,
    });
  }

  // 充电作为 SPV 必要支出单独扣一次（若 other 未覆盖）
  const chargeTake = Math.min(pool, chargeDay);
  pool -= chargeTake;
  if (chargeTake > 0.01) {
    slices.push({
      id: "charge",
      nameZh: "当日充电成本",
      layer: "spv",
      amountMxn: chargeTake,
      remainingAfterMxn: pool,
      noteZh: `${chargeCycleLabelZh(cycle)}折日·电耗×电价；关联场站时可为内部价`,
    });
  }

  const wearDay =
    varOn && (cfg.randomMaintMonthMxn || 0) > 0
      ? (cfg.randomMaintMonthMxn || 0) / daysMo
      : 0;
  const wearTake = Math.min(pool, wearDay);
  pool -= wearTake;
  if (wearTake > 0.01) {
    slices.push({
      id: "wear",
      nameZh: "易损件",
      layer: "spv",
      amountMxn: wearTake,
      remainingAfterMxn: pool,
      noteZh: "月额÷营运日；与日瀑布、月路径同一口径",
    });
  }

  /** 合同固定拆项（与左列固定成本卡同源，瀑布桥可逐项着色） */
  if (cfg.fixedCostEnabled !== false) {
    const fixedDayLines: {
      id: string;
      nameZh: string;
      dayMxn: number;
      noteZh: string;
    }[] = [];
    if (cfg.fixInsuranceOn !== false && (cfg.fixInsuranceYrMxn || 0) > 0) {
      fixedDayLines.push({
        id: "fix_insurance",
        nameZh: "商业保险",
        dayMxn: (cfg.fixInsuranceYrMxn || 0) / 12 / daysMo,
        noteZh: "年保费÷12÷营运日",
      });
    }
    if (cfg.fixMaintOn !== false && (cfg.fixMaintMoMxn || 0) > 0) {
      fixedDayLines.push({
        id: "fix_maint",
        nameZh: "计划保养",
        dayMxn: (cfg.fixMaintMoMxn || 0) / daysMo,
        noteZh: "月包÷营运日",
      });
    }
    if (cfg.fixSoftOn !== false && (cfg.fixSoftMoMxn || 0) > 0) {
      fixedDayLines.push({
        id: "fix_soft",
        nameZh: "GPS/软件",
        dayMxn: (cfg.fixSoftMoMxn || 0) / daysMo,
        noteZh: "月费÷营运日",
      });
    }
    if (cfg.fixParkingOn !== false && (cfg.fixParkingMoMxn || 0) > 0) {
      fixedDayLines.push({
        id: "fix_parking",
        nameZh: "车位租金",
        dayMxn: (cfg.fixParkingMoMxn || 0) / daysMo,
        noteZh: "月租÷营运日",
      });
    }
    for (const line of fixedDayLines) {
      const take = Math.min(pool, Math.max(0, line.dayMxn));
      if (take <= 0.01) continue;
      pool -= take;
      slices.push({
        id: line.id,
        nameZh: line.nameZh,
        layer: "spv",
        amountMxn: take,
        remainingAfterMxn: pool,
        noteZh: line.noteZh,
      });
    }
  }

  const invTierDay = cfg.spvTiers.find(
    (t) => t.id === "investor_pi" && t.enabled && t.investor,
  );
  if (invTierDay?.investor && unitLanded > 0) {
    let take = investorDayTakeMxn(
      invTierDay.investor,
      unitLanded,
      daysMo,
      opsMonth,
    );
    take = Math.min(pool, Math.max(0, take));
    pool -= take;
    const moPay = take * daysMo;
    const depMo = Math.max(0, Math.round(invTierDay.investor.depositMonths || 0));
    const invNorm = normalizeInvestorPi(invTierDay.investor);
    const ioHint =
      invNorm.interestOnlyMonths > 0
        ? `·只还息${invNorm.interestOnlyMonths}月${
            invNorm.interestOnlyTiming === "back" ? "（期末）" : "（期初）"
          }`
        : "";
    const depHint =
      depMo > 0
        ? `·保证金${depMo}月本息≈${Math.round(investorDepositMxn(invTierDay.investor, unitLanded))}`
        : "";
    if (take > 0.01 || invTierDay.enabled) {
      slices.push({
        id: "investor_pi",
        nameZh: "优先投资本息",
        layer: "spv",
        amountMxn: take,
        remainingAfterMxn: pool,
        noteZh: `本金${Math.round(invTierDay.investor.principalPct * 100)}%·年化${Math.round(invTierDay.investor.annualRate * 1000) / 10}%·月供≈${Math.round(moPay)}${opsMonth > 0 ? `（第${opsMonth}月）` : ""}${ioHint}${depHint}`,
      });
    }
  }

  slices.push({
    id: "equity_residual",
    nameZh: "分配后剩余（权益层滚存）",
    layer: "residual",
    amountMxn: pool,
    remainingAfterMxn: pool,
    noteZh: "完成运营扣减与债服后的余额",
  });

  return {
    country,
    vertical,
    mode,
    passengerPayMxn,
    slices,
    spvInflowMxn: spvInflow,
    spvResidualMxn: pool,
    chargeDayMxn: chargeDay,
    noteZh: note,
  };
}
function buildAssetMonthBars(args: {
  sku: AssetSku;
  card: VehicleCard;
  cfg: AssetCashflowConfig;
  day: AssetDayCashflow;
  qty: number;
  discountRate: number;
  /** 付款→上路阶段；缺省则投放次月即出收入（旧行为） */
  goLiveStages?: GoLiveStage[];
  /** IVA 税率；购入时点按含税现金流出 */
  vat?: number;
  configId?: string;
  internalPriceMxn?: number;
}): AssetMonthBar[] {
  const { sku, card, cfg, qty } = args;
  const stages = args.goLiveStages || [];
  const totalLead = goLiveTotalDays(stages);
  const idleN = stages.length ? goLiveIdleMonths(totalLead) : 0;
  const oneLanded = modelUnitGrossMxn(
    sku,
    Math.max(qty, 1),
    args.vat ?? 0.16,
    args.configId,
  );
  const daysMo = Math.max(1, (card.daysWeek || 6) * (52 / 12));
  const bars: AssetMonthBar[] = [];
  const price = args.internalPriceMxn ?? 7;
  const dayAt = (opsMonth: number) =>
    buildAssetDayCashflow({
      country: args.day.country,
      vertical: args.day.vertical,
      mode: args.day.mode,
      card,
      sku,
      cfg,
      internalPriceMxn: price,
      unitLandedMxn: oneLanded,
      opsMonth,
    });

  // 今天付款购置资产：含税落地现金流出，尚无收入
  // 优先投资保证金（若启用）：同期锁定，不可动用；并入期初投入，融资期末退还
  const piTier = cfg.spvTiers.find(
    (t) => t.id === "investor_pi" && t.enabled && t.investor,
  );
  const depositOne = piTier?.investor
    ? investorDepositMxn(piTier.investor, oneLanded)
    : 0;
  const depositTotal = depositOne * Math.max(qty, 1);
  const buyOut = oneLanded * Math.max(qty, 1) + depositTotal;
  bars.push({
    label:
      depositTotal > 0 ? "期初购置+优先保证金" : "期初购置",
    capexMxn: buyOut,
    maintMxn: 0,
    chargeMxn: 0,
    randomMaintMxn: 0,
    opsInMxn: 0,
    equityInMxn: 0,
    outflowMxn: buyOut,
    netMxn: -buyOut,
  });

  // 投产前空窗：天数来自假设（goLive*Days）；访谈默认仅整备，最长约1个月
  for (let i = 1; i <= idleN; i++) {
    const midDay = (i - 0.5) * 30;
    const stageName = goLiveStageAtDay(stages, midDay);
    const dayStart = (i - 1) * 30;
    const dayEnd = Math.min(totalLead, i * 30);
    const daysThis = Math.max(1, Math.round(dayEnd - dayStart));
    const wearHold =
      cfg.varCostEnabled !== false ? cfg.randomMaintMonthMxn * 0.15 : 0;
    const hold =
      ((cfg.annualMaintMxn / 12) * 0.35 + wearHold) * Math.max(qty, 1);
    bars.push({
      label: `投产前${i}（${stageName}·${daysThis}D）`,
      capexMxn: 0,
      maintMxn: hold,
      chargeMxn: 0,
      randomMaintMxn: 0,
      opsInMxn: 0,
      equityInMxn: 0,
      outflowMxn: hold,
      netMxn: -hold,
    });
  }

  const n = Math.max(1, Math.min(120, cfg.horizonMonths || 12));
  const depositReturnOpsM =
    depositTotal > 0 && piTier?.investor
      ? Math.max(
          1,
          Math.min(n, Math.round(piTier.investor.tenureMonths || n)),
        )
      : 0;
  for (let m = 1; m <= n; m++) {
    const day = dayAt(m);
    const maint = (cfg.annualMaintMxn / 12) * Math.max(qty, 1);
    const charge = day.chargeDayMxn * daysMo * Math.max(qty, 1);
    const rnd =
      (cfg.varCostEnabled !== false ? cfg.randomMaintMonthMxn : 0) *
      Math.max(qty, 1);
    const opsIn = day.spvInflowMxn * daysMo * Math.max(qty, 1);
    let equityIn = day.spvResidualMxn * daysMo * Math.max(qty, 1);
    /** 日瀑布已含充电/易损/合同固定/冲单/过路/司机/债服；月路径不再另加一层 */
    const waterfallMo =
      (day.spvInflowMxn - day.spvResidualMxn) * daysMo * Math.max(qty, 1);
    const outflow = waterfallMo;
    /** 融资期末退还保证金（账面解锁 → 计入净现金流，抬高该月净额） */
    const depReturn = m === depositReturnOpsM ? depositTotal : 0;
    if (depReturn > 0) equityIn += depReturn;
    bars.push({
      label:
        depReturn > 0
          ? `经营第${m}月·保证金退还`
          : `经营第${m}月`,
      capexMxn: 0,
      maintMxn: maint,
      chargeMxn: charge,
      randomMaintMxn: rnd,
      opsInMxn: opsIn + depReturn,
      equityInMxn: equityIn,
      outflowMxn: outflow,
      netMxn: opsIn - outflow + depReturn,
    });
  }
  return bars;
}
/** 单位现金流时序点（收入为正、支出额度为正；图上支出取负） */
type UnitCfPathPt = {
  label: string;
  shortZh: string;
  inflow: number;
  outflow: number;
  net: number;
  kind: "capex" | "idle" | "ops";
  /** 经营月第几月；非经营为 0 */
  opsMonth: number;
  /** 0=期初（购置+空窗）；1..=经营第 N 年 */
  yearId: number;
};

function assignUnitCfYearIds(pts: UnitCfPathPt[]): UnitCfPathPt[] {
  return pts.map((p) => {
    if (p.kind !== "ops" || p.opsMonth <= 0) {
      return { ...p, yearId: 0 };
    }
    return { ...p, yearId: Math.floor((p.opsMonth - 1) / 12) + 1 };
  });
}

function depositHintShort(label: string) {
  return label.includes("保证金") ? "购置+保证" : "购置";
}

/** 投产前1（整备/上牌·20D）→ 空窗1·20D（天数来自上路假设） */
function idleBarShortZh(label: string): string {
  const m = label.match(/^投产前(\d+)（(?:.*·)?(\d+)D）/);
  if (m) return `空窗${m[1]}·${m[2]}D`;
  const m2 = label.match(/^投产前(\d+)/);
  if (m2) return `空窗${m2[1]}`;
  return label.replace("投产前", "空窗").replace(/（.*）/, "");
}

function aggregateUnitCfByYear(pts: UnitCfPathPt[]): UnitCfPathPt[] {
  const tagged = assignUnitCfYearIds(pts);
  const order: number[] = [];
  const map = new Map<number, UnitCfPathPt>();
  for (const p of tagged) {
    const y = p.yearId;
    if (!map.has(y)) {
      order.push(y);
      map.set(y, {
        label: y === 0 ? "期初（购置+空窗）" : `经营第 ${y} 年`,
        shortZh: y === 0 ? "期初" : `Y${y}`,
        inflow: 0,
        outflow: 0,
        net: 0,
        kind: y === 0 ? "capex" : "ops",
        opsMonth: 0,
        yearId: y,
      });
    }
    const agg = map.get(y)!;
    agg.inflow += p.inflow;
    agg.outflow += p.outflow;
    agg.net += p.net;
  }
  return order.map((y) => map.get(y)!);
}

function unitCfMonthsOfYear(
  pts: UnitCfPathPt[],
  yearId: number,
): UnitCfPathPt[] {
  return assignUnitCfYearIds(pts).filter((p) => p.yearId === yearId);
}

function mergeAssetMonthBars(lists: AssetMonthBar[][]): AssetMonthBar[] {
  const hit = lists.filter((l) => l.length > 0);
  if (hit.length === 0) return [];
  if (hit.length === 1) return hit[0]!.slice();
  const maxLen = Math.max(...hit.map((l) => l.length));
  const out: AssetMonthBar[] = [];
  for (let i = 0; i < maxLen; i++) {
    const parts = hit
      .map((l) => l[i])
      .filter((b): b is AssetMonthBar => !!b);
    if (parts.length === 0) continue;
    out.push({
      label: parts[0]!.label,
      capexMxn: parts.reduce((s, b) => s + b.capexMxn, 0),
      maintMxn: parts.reduce((s, b) => s + b.maintMxn, 0),
      chargeMxn: parts.reduce((s, b) => s + b.chargeMxn, 0),
      randomMaintMxn: parts.reduce((s, b) => s + b.randomMaintMxn, 0),
      opsInMxn: parts.reduce((s, b) => s + b.opsInMxn, 0),
      equityInMxn: parts.reduce((s, b) => s + b.equityInMxn, 0),
      outflowMxn: parts.reduce((s, b) => s + b.outflowMxn, 0),
      netMxn: parts.reduce((s, b) => s + b.netMxn, 0),
    });
  }
  return out;
}

function stationBarsToAssetMonth(
  st: ReturnType<typeof buildStationMonthBars>,
): AssetMonthBar[] {
  return st.map((b) => ({
    label: b.label,
    capexMxn: b.label.startsWith("期初") ? b.outflowMxn : 0,
    maintMxn: 0,
    chargeMxn: 0,
    randomMaintMxn: 0,
    opsInMxn: b.opsInMxn,
    equityInMxn: 0,
    outflowMxn: b.outflowMxn,
    netMxn: b.netMxn,
  }));
}

function barsToUnitCfPath(bars: AssetMonthBar[]): UnitCfPathPt[] {
  let opsI = 0;
  return assignUnitCfYearIds(
    bars.map((b) => {
      const isCapex = b.label.startsWith("期初");
      const isIdle = b.label.startsWith("投产前");
      const isOps = b.label.startsWith("经营第");
      if (isOps) opsI += 1;
      return {
        label: b.label,
        shortZh: isCapex
          ? depositHintShort(b.label)
          : isIdle
            ? idleBarShortZh(b.label)
            : `M${opsI}`,
        inflow: b.opsInMxn + b.equityInMxn,
        outflow: b.outflowMxn,
        net: b.netMxn,
        kind: (isCapex ? "capex" : isIdle ? "idle" : "ops") as UnitCfPathPt["kind"],
        opsMonth: isOps ? opsI : 0,
        yearId: 0,
      };
    }),
  );
}

function withResidualOnLastMonth(nets: number[], resMxn: number): number[] {
  if (!(resMxn > 0) || nets.length === 0) return nets.slice();
  const out = nets.slice();
  out[out.length - 1] = (out[out.length - 1] || 0) + resMxn;
  return out;
}

function computeUnitPathMetrics(args: {
  bars: AssetMonthBar[];
  residualMxn: number;
  residualInPath: boolean;
}) {
  const cumPathNet = args.bars.reduce((s, b) => s + (b.netMxn || 0), 0);
  const initInv =
    args.bars[0]?.outflowMxn ?? args.bars[0]?.capexMxn ?? 0;
  const pathNetsForMetrics = args.residualInPath
    ? withResidualOnLastMonth(
        args.bars.map((b) => b.netMxn || 0),
        args.residualMxn,
      )
    : args.bars.map((b) => b.netMxn || 0);
  const pathIrrMo = irr(pathNetsForMetrics);
  const pathIrrAnn =
    pathIrrMo != null && pathIrrMo > -0.99
      ? Math.pow(1 + pathIrrMo, 12) - 1
      : null;
  const pathNpvMxn = npvAnnualOnMonths(
    pathNetsForMetrics,
    UNIT_CF_DISCOUNT_ANN,
  );
  const pathStaticPb = staticPaybackPeriod(pathNetsForMetrics);
  const pathDynamicPb = dynamicPaybackPeriod(
    pathNetsForMetrics,
    UNIT_CF_DISCOUNT_ANN,
  );
  const totalReturnMxn = cumPathNet + args.residualMxn;
  const returnMultiple =
    initInv > 0 ? (initInv + totalReturnMxn) / initInv : null;
  return {
    cumPathNet,
    initInv,
    pathNetsForMetrics,
    pathIrrAnn,
    pathNpvMxn,
    pathPbMo: pathStaticPb.months,
    pathDynamicPb,
    totalReturnMxn,
    returnMultiple,
  };
}

type OrderLineCfCtx = {
  line: PurchaseOrderLine;
  sku: AssetSku;
  mode: OpMode;
  cfCardLive: VehicleCard;
  cfCfgLive: AssetCashflowConfig;
  cfDay: AssetDayCashflow;
  cfElecMxn: number;
  unitLanded1: number;
  bars: AssetMonthBar[];
};

function orderLineOpMode(line: PurchaseOrderLine, sku: AssetSku): OpMode {
  if (line.modeLabel === "DAE") return "DAE";
  if (line.modeLabel === "RTO") return "RTO";
  if (line.modeLabel === "LTO") return "LTO";
  return defaultModeForSku(sku);
}

function buildOrderLineCfContext(args: {
  line: PurchaseOrderLine;
  order: PurchaseOrder;
  p: Premise;
  cards: VehicleCard[];
  cfBySku: Record<string, AssetCashflowConfig>;
  normalizedSkus: AssetSku[];
  cfgConfigBySku: Record<string, string>;
  invAssume: {
    util?: number;
    iphMxn?: number;
    hoursDay?: number;
    daysWeek?: number;
    subsidyPct?: number;
    residualRate?: number;
    holdYears?: number;
    marketResRate?: number;
    driverMxn?: number;
  };
  daeShift: DaeShift;
  goLiveStages: GoLiveStage[];
}): OrderLineCfCtx | null {
  const sku =
    args.normalizedSkus.find((s) => s.id === resolveSkuId(args.line.skuId)) ||
    DEFAULT_ASSET_SKUS.find((s) => s.id === resolveSkuId(args.line.skuId));
  if (!sku || sku.kind === "station") return null;
  const mode = orderLineOpMode(args.line, sku);
  const scenario = args.order.scenario;
  const cfSaved = args.cfBySku[sku.id];
  const cardResolved =
    args.cards
      .map(normalizeCard)
      .find((c) => c.id === cardIdFor(sku.id, mode)) ||
    args.cards.map(normalizeCard).find((c) => c.mode === mode) ||
    DEFAULT_VEHICLE_CARDS.find((c) => c.mode === mode) ||
    DEFAULT_VEHICLE_CARDS[0];
  const cardNorm = normalizeCard(cardResolved);
  const profile = findOpsProfile(
    args.order.country,
    args.order.vertical,
    mode,
    args.order.managerId,
  );
  const cfCardBase: VehicleCard = {
    ...cardNorm,
    nameZh: sku.nameZh,
    model: sku.model,
    listPriceMxn: sku.purchasePriceMxn,
    softCosts: sku.softCosts.map((s) => ({ ...s })),
    insuranceYrMxn:
      mode === "DAE" ? sku.insuranceYrMxn : (cardNorm.insuranceYrMxn ?? sku.insuranceYrMxn),
    maintMxn: mode === "DAE" ? sku.maintMxn : (cardNorm.maintMxn ?? 0),
    softMxn: mode === "DAE" ? sku.softMxn : (cardNorm.softMxn ?? sku.softMxn ?? 0),
    wearYrMxn: mode === "DAE" ? sku.wearYrMxn : (cardNorm.wearYrMxn ?? 0),
    kwhPer100: sku.kwhPer100,
    country: args.order.country,
    vertical: args.order.vertical,
    mode,
    util: profile.util,
    iphMxn: profile.iphMxn,
    hoursDay: profile.hoursDay,
    daysWeek: profile.daysWeek,
    subsidyPct: profile.subsidyPct,
    driverMxn: profile.driverMxn,
    occupancy: profile.occupancy,
    badDebt: profile.badDebt,
    rentMonthMxn: profile.rentMonthMxn,
    depositMxn: profile.depositMxn,
  };
  const cfCardLive: VehicleCard = {
    ...applyScenarioToVehicleCard(
      applyDaeShiftToCard(cfCardBase, mode === "DAE" ? args.daeShift : "single"),
      scenario,
    ),
    ...(args.invAssume.util != null ? { util: args.invAssume.util } : {}),
    ...(args.invAssume.iphMxn != null ? { iphMxn: args.invAssume.iphMxn } : {}),
    ...(args.invAssume.hoursDay != null ? { hoursDay: args.invAssume.hoursDay } : {}),
    ...(args.invAssume.daysWeek != null ? { daysWeek: args.invAssume.daysWeek } : {}),
    ...(args.invAssume.subsidyPct != null
      ? { subsidyPct: args.invAssume.subsidyPct }
      : {}),
    ...(args.invAssume.driverMxn != null ? { driverMxn: args.invAssume.driverMxn } : {}),
  };
  const cfElecMxn =
    mode === "DAE"
      ? DAE_SCENARIO_KNOBS[scenario].elecMxn
      : args.p.internalPriceMxn;
  let cfCfgLive = syncCfTiersToCard(
    normalizeCfConfig(cfSaved, mode, cfCardLive, sku),
    cfCardLive,
    sku,
  );
  if (mode === "DAE") {
    const kwhDay =
      (daeKmDay(cfCardLive) / 100) * (sku.kwhPer100 || cfCardLive.kwhPer100 || 15);
    const dayFromCard = Math.round(kwhDay * cfElecMxn * 100) / 100;
    const dw = cfCardLive.daysWeek || 6;
    const cyc: ChargePayCycle =
      cfCfgLive.chargeCycle === "week" ||
      cfCfgLive.chargeCycle === "month" ||
      cfCfgLive.chargeCycle === "year"
        ? cfCfgLive.chargeCycle
        : "day";
    cfCfgLive.chargeCycle = cyc;
    if (cfCfgLive.chargeSource !== "manual") {
      cfCfgLive.chargeSource = "from_card";
      cfCfgLive.chargeDayMxn = dayFromCard;
      cfCfgLive.chargeAmountMxn = chargeAmountFromDay(dayFromCard, cyc, dw);
    }
    cfCfgLive.horizonMonths =
      args.invAssume.holdYears != null && args.invAssume.holdYears > 0
        ? Math.min(120, Math.max(12, Math.round(args.invAssume.holdYears) * 12))
        : 60;
  } else if (mode === "LTO" || mode === "RTO") {
    const dw = cfCardLive.daysWeek || 6;
    const cyc: ChargePayCycle =
      cfCfgLive.chargeCycle === "week" ||
      cfCfgLive.chargeCycle === "month" ||
      cfCfgLive.chargeCycle === "year"
        ? cfCfgLive.chargeCycle
        : "day";
    cfCfgLive.chargeCycle = cyc;
    if (cfCfgLive.fixedCostSource !== "manual") {
      cfCfgLive.fixedCostSource = "from_card";
      cfCfgLive.fixInsuranceYrMxn = cfCardLive.insuranceYrMxn || 0;
      cfCfgLive.fixMaintMoMxn = cfCardLive.maintMxn || 0;
      cfCfgLive.fixSoftMoMxn = cfCardLive.softMxn || 0;
      cfCfgLive.fixParkingMoMxn = 0;
      cfCfgLive.fixWearPer10kKmMxn = defaultWearPer10kKmMxn(
        cfCardLive,
        cfCardLive.wearYrMxn || 0,
      );
    }
    cfCfgLive.annualMaintMxn = annualMaintFromFixedLines(cfCfgLive);
    cfCfgLive.randomMaintMonthMxn = wearMonthFromFixed(cfCfgLive, cfCardLive);
    cfCfgLive.horizonMonths =
      args.invAssume.holdYears != null && args.invAssume.holdYears > 0
        ? Math.min(120, Math.max(12, Math.round(args.invAssume.holdYears) * 12))
        : Math.max(
            12,
            Math.min(60, Math.round((cfCardLive.acctYears || sku.acctYears || 5) * 12)),
          );
  }
  const configId = selectedConfigId(sku, args.cfgConfigBySku);
  const unitLanded1 = modelUnitGrossMxn(
    sku,
    1,
    args.p.vat,
    configId,
  );
  const cfDay = buildAssetDayCashflow({
    country: args.order.country,
    vertical: args.order.vertical,
    mode,
    card: cfCardLive,
    sku,
    cfg: cfCfgLive,
    internalPriceMxn: cfElecMxn,
    unitLandedMxn: unitLanded1,
    opsMonth: 1,
  });
  const bars = buildAssetMonthBars({
    sku,
    card: cfCardLive,
    cfg: cfCfgLive,
    day: cfDay,
    qty: Math.max(1, Math.round(args.line.qty || 1)),
    discountRate: args.line.discountRate ?? volumeDiscountRate(sku, args.line.qty),
    goLiveStages: args.goLiveStages,
    vat: args.p.vat,
    configId,
    internalPriceMxn: cfElecMxn,
  });
  return {
    line: args.line,
    sku,
    mode,
    cfCardLive,
    cfCfgLive,
    cfDay,
    cfElecMxn,
    unitLanded1,
    bars,
  };
}

function buildOrderLineMonthBars(args: {
  line: PurchaseOrderLine;
  order: PurchaseOrder;
  p: Premise;
  cards: VehicleCard[];
  cfBySku: Record<string, AssetCashflowConfig>;
  normalizedSkus: AssetSku[];
  cfgConfigBySku: Record<string, string>;
  invAssume: Parameters<typeof buildOrderLineCfContext>[0]["invAssume"];
  daeShift: DaeShift;
  goLiveStages: GoLiveStage[];
  cardPatch?: Partial<VehicleCard>;
  cfgPatch?: Partial<AssetCashflowConfig>;
}): AssetMonthBar[] {
  const ctx = buildOrderLineCfContext(args);
  if (ctx) {
    if (!args.cardPatch && !args.cfgPatch) return ctx.bars;
    const card = { ...ctx.cfCardLive, ...(args.cardPatch || {}) };
    const cfg = { ...ctx.cfCfgLive, ...(args.cfgPatch || {}) };
    const day = buildAssetDayCashflow({
      country: args.order.country,
      vertical: args.order.vertical,
      mode: ctx.mode,
      card,
      sku: ctx.sku,
      cfg,
      internalPriceMxn: ctx.cfElecMxn,
      unitLandedMxn: ctx.unitLanded1,
      opsMonth: 1,
    });
    return buildAssetMonthBars({
      sku: ctx.sku,
      card,
      cfg,
      day,
      qty: Math.max(1, Math.round(args.line.qty || 1)),
      discountRate: args.line.discountRate ?? volumeDiscountRate(ctx.sku, args.line.qty),
      goLiveStages: args.goLiveStages,
      vat: args.p.vat,
      configId: selectedConfigId(ctx.sku, args.cfgConfigBySku),
      internalPriceMxn: ctx.cfElecMxn,
    });
  }
  const sku =
    args.normalizedSkus.find((s) => s.id === resolveSkuId(args.line.skuId)) ||
    DEFAULT_ASSET_SKUS.find((s) => s.id === resolveSkuId(args.line.skuId));
  if (!sku || sku.kind !== "station") return [];
  const ops = resolveStationOps(sku);
  const holdMo =
    args.invAssume.holdYears != null && args.invAssume.holdYears > 0
      ? Math.min(120, Math.max(12, Math.round(args.invAssume.holdYears) * 12))
      : Math.min(60, Math.max(12, (sku.acctYears || 5) * 12));
  return stationBarsToAssetMonth(
    buildStationMonthBars({
      unitLandedMxn: args.line.unitLandedMxn * Math.max(1, args.line.qty),
      guns: Math.max(1, args.line.qty),
      ops,
      maintMxn: sku.maintMxn || 0,
      months: holdMo,
    }),
  );
}

function buildOrderAggregatedUnitCf(args: {
  order: PurchaseOrder;
  p: Premise;
  cards: VehicleCard[];
  cfBySku: Record<string, AssetCashflowConfig>;
  normalizedSkus: AssetSku[];
  cfgConfigBySku: Record<string, string>;
  invAssume: Parameters<typeof buildOrderLineCfContext>[0]["invAssume"];
  invResidualInPath: boolean;
  invResidualMode: "market" | "book";
  daeShift: DaeShift;
  goLiveStages: GoLiveStage[];
  focusLineId?: string;
}) {
  const lineBars = args.order.lines.map((line) =>
    buildOrderLineMonthBars({ ...args, line }),
  );
  const bars = mergeAssetMonthBars(lineBars);
  if (bars.length === 0) return null;
  const monthPath = barsToUnitCfPath(bars);
  const vehicleLines = args.order.lines.filter(
    (l) => orderLineAsset(l) !== "station",
  );
  const focusPick = args.focusLineId
    ? args.order.lines.find((l) => l.id === args.focusLineId)
    : undefined;
  const defaultVehicle =
    [...vehicleLines].sort(
      (a, b) => b.unitLandedMxn * b.qty - a.unitLandedMxn * a.qty,
    )[0] || args.order.lines[0];
  const primaryLine = focusPick || defaultVehicle;
  const ctxLine =
    primaryLine && orderLineAsset(primaryLine) !== "station"
      ? primaryLine
      : vehicleLines[0];
  const primaryCtx = ctxLine
    ? buildOrderLineCfContext({ ...args, line: ctxLine })
    : null;
  const holdYears = Math.max(
    1,
    args.invAssume.holdYears != null && args.invAssume.holdYears > 0
      ? Math.round(args.invAssume.holdYears)
      : Math.round((bars.filter((b) => b.label.startsWith("经营第")).length || 60) / 12),
  );
  let residualMxn = 0;
  for (const line of args.order.lines) {
    const sku =
      args.normalizedSkus.find((s) => s.id === resolveSkuId(line.skuId)) ||
      DEFAULT_ASSET_SKUS.find((s) => s.id === resolveSkuId(line.skuId));
    if (!sku) continue;
    const unit1 =
      sku.kind === "station"
        ? line.unitLandedMxn
        : modelUnitGrossMxn(
            sku,
            1,
            args.p.vat,
            selectedConfigId(sku, args.cfgConfigBySku),
          );
    const bookRes = bookResidualRate(sku, holdYears);
    const fairAtHold = marketFairResidualRate(sku, holdYears);
    const marketOverride =
      args.invAssume.marketResRate ?? args.invAssume.residualRate;
    const marketRes = Math.max(
      0,
      Math.min(1, marketOverride ?? fairAtHold ?? bookRes),
    );
    const resRate =
      args.invResidualMode === "market" ? marketRes : bookRes;
    residualMxn += unit1 * resRate * Math.max(1, line.qty);
  }
  const metrics = computeUnitPathMetrics({
    bars,
    residualMxn,
    residualInPath: args.invResidualInPath,
  });
  const sensRows = (() => {
    if (!primaryCtx) {
      return [
        {
          label: args.invResidualInPath ? "基准（含残值末月）" : "基准",
          pb: metrics.pathPbMo != null ? `M${metrics.pathPbMo}` : "期内未回本",
          irr: pct(metrics.pathIrrAnn),
        },
      ];
    }
    const util0 = primaryCtx.cfCardLive.util ?? 0.75;
    const sensLineId = primaryCtx.line.id;
    const run = (
      label: string,
      cfgPatch?: Partial<AssetCashflowConfig>,
      cardPatch?: Partial<VehicleCard>,
      residualMult = 1,
    ) => {
      const agg = mergeAssetMonthBars(
        args.order.lines.map((line) =>
          buildOrderLineMonthBars({
            ...args,
            line,
            cfgPatch: line.id === sensLineId ? cfgPatch : undefined,
            cardPatch: line.id === sensLineId ? cardPatch : undefined,
          }),
        ),
      );
      let nets = agg.map((b) => b.netMxn || 0);
      if (args.invResidualInPath) {
        nets = withResidualOnLastMonth(nets, residualMxn * residualMult);
      }
      const irrMo = irr(nets);
      const irrAnn =
        irrMo != null && irrMo > -0.99
          ? Math.pow(1 + irrMo, 12) - 1
          : null;
      const pb = staticPaybackPeriod(nets);
      return {
        label,
        pb: pb.months != null ? `M${pb.months}` : "期内未回本",
        irr: pct(irrAnn),
      };
    };
    const rows = [
      {
        label: args.invResidualInPath ? "基准（含残值末月）" : "基准",
        pb: metrics.pathPbMo != null ? `M${metrics.pathPbMo}` : "期内未回本",
        irr: pct(metrics.pathIrrAnn),
      },
      run("收入−10%", undefined, { util: Math.max(0.2, util0 * 0.9) }),
      run("收入+10%", undefined, { util: Math.min(0.98, util0 * 1.1) }),
      run("收入−20%", undefined, { util: Math.max(0.2, util0 * 0.8) }),
      run("收入+20%", undefined, { util: Math.min(0.98, util0 * 1.2) }),
      run("可变成本关", { varCostEnabled: false }),
      run("固定成本关", { fixedCostEnabled: false }),
      run("优先投资关", {
        spvTiers: primaryCtx.cfCfgLive.spvTiers.map((t) =>
          t.id === "investor_pi" ? { ...t, enabled: false } : t,
        ),
      }),
    ];
    if (args.invResidualInPath) rows.push(run("残值 0%", undefined, undefined, 0));
    return rows;
  })();
  return {
    bars,
    monthPath,
    primaryCtx,
    primaryLine,
    holdYears,
    residualMxn,
    metrics,
    sensRows,
  };
}


const COUNTRY_OPTS = ["墨西哥"];
const VERTICAL_OPTS = ["网约车·专车", "网约车·快车"];

/** 对齐《DAE-200台含IRR》假设表：只改班次；司机成本在日薪计算里 ×班次×利用率 */
function applyDaeShiftToCard(card: VehicleCard, shift: DaeShift): VehicleCard {
  if (card.mode !== "DAE") {
    return { ...card, shiftsPerDay: 1 };
  }
  return {
    ...card,
    shiftsPerDay: shift === "double" ? 2 : 1,
  };
}

/** 班制变更后：仅同步司机日固（充电/养护已在默认假设导入） */
function syncCfTiersToCard(
  cfg: AssetCashflowConfig,
  card: VehicleCard,
  _sku: AssetSku,
): AssetCashflowConfig {
  const daysMo = opsDaysPerMonth(card.daysWeek || 6);
  const driverDay = daeDriverMonthMxn(card) / daysMo;
  return {
    ...cfg,
    spvTiers: cfg.spvTiers.map((t) => {
      if (t.id === "driver_wage") {
        const wage: DriverWageDetail = {
          ...(t.wage || defaultDriverWage(card.mode, driverDay, daysMo)),
        };
        if (card.mode === "DAE") {
          /** 《DAE-200》有司机成本；跟卡或金额为 0 时拉回案例口径，但保留用户选的周期 */
          if (wage.source !== "manual" || !(wage.amountMxn > 0)) {
            wage.source = "from_card";
            const mo = Math.round(daeDriverMonthMxn(card));
            const cyc: WageReserveCycle =
              wage.cycle === "week" || wage.cycle === "day"
                ? wage.cycle
                : "month";
            wage.cycle = cyc;
            if (cyc === "day") {
              wage.amountMxn = Math.round((mo / daysMo) * 10) / 10;
            } else if (cyc === "week") {
              wage.amountMxn = Math.round((mo * 12) / 52);
            } else {
              wage.amountMxn = mo;
            }
          }
        } else if (wage.source === "from_card") {
          wage.amountMxn = 0;
          /** 直租无跟卡金额时仍尊重周期选择 */
        }
        const dayAmt = wageReserveDayMxn(wage, card);
        return {
          ...t,
          fixedDayMxn: Math.max(0, dayAmt),
          /** 尊重开关；DAE 默认开见 defaultSpvTiers，勿每帧强行关掉 */
          enabled: !!t.enabled,
          wage,
          noteZh:
            card.mode === "DAE"
              ? `对齐《DAE-200》：单司机×班次×利用率×(日工时/${DAE_BASE_HOURS_DAY}h)（两班×75%×9.5h≈39000/月）`
              : "直租/租买默认无车队司机；若需预留可手动开启并填金额",
        };
      }
      if (t.id === "investor_pi") {
        const inv = {
          ...defaultInvestorPi(),
          ...(t.investor || {}),
        };
        return {
          ...t,
          investor: inv,
          /** 尊重用户开关；默认关闭见 defaultSpvTiers，勿在同步时强行关掉 */
          enabled: !!t.enabled,
          noteZh:
            "本金比例·年化·只还息(月/前后期)·还本规则·保证金(N月本息) → 按经营月摊日扣；保证金期初锁定、期末退还",
        };
      }
      if (t.id === "other_opex") {
        const items = (t.varOpex?.items || defaultVarOpexItems()).filter(
          (it) => it.id !== "consumables",
        );
        return {
          ...t,
          varOpex: {
            items: items.length > 0 ? items : defaultVarOpexItems(),
          },
        };
      }
      return t;
    }),
  };
}

function volumeDiscountRate(model: AssetSku, qty: number) {
  const tiers = [...(model.volumeTiers || [])].sort(
    (a, b) => a.minQty - b.minQty,
  );
  let d = 0;
  for (const t of tiers) {
    if (qty >= t.minQty) d = t.discountRate;
  }
  return d;
}

function skuMinQty(sku: AssetSku) {
  return Math.max(1, Math.round(sku.minOrderQty ?? 1));
}
function skuStep(sku: AssetSku) {
  return Math.max(1, Math.round(sku.qtyStep ?? 1));
}
function skuMaxQty(sku: AssetSku) {
  return Math.max(skuMinQty(sku), Math.round(sku.maxOrderQty ?? 9999));
}
/** 将数量钳到起订/步长/上限；0 表示清空购物车 */
function clampSkuQty(sku: AssetSku, qty: number) {
  if (qty <= 0) return 0;
  const min = skuMinQty(sku);
  // 低于起订量视为移出购物车（方便从起订量连点 − 清空）
  if (qty < min) return 0;
  const step = skuStep(sku);
  const max = skuMaxQty(sku);
  let q = Math.min(max, Math.round(qty));
  const offset = q - min;
  q = min + Math.round(offset / step) * step;
  if (q < min) return 0;
  if (q > max) q = max;
  return q;
}

/** 兼容旧版持久化 state：补齐数量/量折缺省 */
function normalizeSku(sku: AssetSku): AssetSku {
  const id = resolveSkuId(sku.id);
  const base = DEFAULT_ASSET_SKUS.find((d) => d.id === id);
  const merged: AssetSku = {
    ...(base as AssetSku),
    ...sku,
    id,
    nameZh:
      base?.kind === "station" &&
      (!sku.nameZh || /整套|套装/.test(sku.nameZh))
        ? base.nameZh
        : sku.nameZh || base?.nameZh || "",
    model: (() => {
      const name =
        base?.kind === "station" &&
        (!sku.nameZh || /整套|套装/.test(sku.nameZh))
          ? base.nameZh
          : sku.nameZh || base?.nameZh || "";
      const persisted = sku.model ?? "";
      // 旧持久化「广汽埃安 ES」与 nameZh「埃安 ES」重复 → 回落默认短 model
      if (
        base?.model != null &&
        (!persisted || isRedundantSkuModel(name || base.nameZh, persisted))
      ) {
        return base.model;
      }
      return persisted || base?.model || "";
    })(),
    unitLabel:
      base?.kind === "station" &&
      (!sku.unitLabel || sku.unitLabel === "套")
        ? base.unitLabel
        : sku.unitLabel || base?.unitLabel || "台",
    softCosts: (() => {
      if (base?.id === "aion-es" && base.softCosts?.length) {
        return base.softCosts.map((s) => ({ ...s }));
      }
      return sku.softCosts?.length ? sku.softCosts : base?.softCosts || [];
    })(),
    kwhPer100:
      base?.id === "aion-es" && base.kwhPer100 != null
        ? base.kwhPer100
        : sku.kwhPer100 ?? base?.kwhPer100 ?? 15,
    minOrderQty: sku.minOrderQty ?? base?.minOrderQty ?? 1,
    qtyStep: sku.qtyStep ?? base?.qtyStep ?? 1,
    maxOrderQty: sku.maxOrderQty ?? base?.maxOrderQty ?? 500,
    defaultQty: sku.defaultQty ?? base?.defaultQty ?? 1,
    volumeTiers:
      sku.volumeTiers?.length
        ? sku.volumeTiers
        : base?.volumeTiers || [{ minQty: 1, discountRate: 0 }],
    stationSpec: sku.stationSpec ?? base?.stationSpec,
    stationBom: sku.stationBom?.length ? sku.stationBom : base?.stationBom,
    stationOps:
      (sku.kind || base?.kind) === "station"
        ? {
            ...defaultStationOpsConstants(base || sku),
            ...(base?.stationOps || {}),
            ...(sku.stationOps || {}),
          }
        : undefined,
    specFill: mergeSpecFill(sku.specFill, base?.specFill),
    productSpecs: mergeProductSpecs(sku.productSpecs, base?.productSpecs),
    majorComponents: mergeMajorComponents(
      sku.majorComponents,
      base?.majorComponents,
    ),
    configVariants: mergeConfigVariants(
      sku.configVariants,
      base?.configVariants,
    ),
    defaultConfigId:
      sku.defaultConfigId ?? base?.defaultConfigId ?? "",
    supplyChain: mergeSupplyChain(sku.supplyChain, base?.supplyChain),
    marketIntel: (() => {
      const cur = sku.marketIntel;
      const baseMi = base?.marketIntel;
      if (!cur && !baseMi) return undefined;
      if (!cur) return baseMi;
      if (!baseMi) return cur;
      return {
        ...baseMi,
        ...cur,
        /** 残值曲线以代码库为准（含 Y6+ 长尾），避免旧持久化截断在 Y5 */
        residualFair: baseMi.residualFair,
        residualIndustry: baseMi.residualIndustry,
        residualNoteZh: baseMi.residualNoteZh,
        residualProxyZh: baseMi.residualProxyZh,
        parcRef: cur.parcRef ?? baseMi.parcRef,
        parcByCountry: {
          ...(baseMi.parcByCountry || {}),
          ...(cur.parcByCountry || {}),
          CN: cur.parcByCountry?.CN ?? baseMi.parcByCountry?.CN,
          MX: cur.parcByCountry?.MX ?? baseMi.parcByCountry?.MX,
        },
        scoreRef: cur.scoreRef ?? baseMi.scoreRef,
        riskNews: cur.riskNews?.length ? cur.riskNews : baseMi.riskNews,
        reputation: {
          ...baseMi.reputation,
          ...cur.reputation,
          reviewSnippets:
            cur.reputation?.reviewSnippets?.length
              ? cur.reputation.reviewSnippets
              : baseMi.reputation.reviewSnippets,
          platforms:
            cur.reputation?.platforms?.length
              ? cur.reputation.platforms
              : baseMi.reputation.platforms,
        },
      };
    })(),
    /** 期末残值可配：优先持久化/用户改值，缺省回落代码库 */
    residualRate:
      sku.residualRate ?? base?.residualRate ?? DEFAULT_END_RESIDUAL.acct,
    physResidualRate:
      sku.physResidualRate ?? base?.physResidualRate ?? DEFAULT_END_RESIDUAL.phys,
    maintResidualRate:
      sku.maintResidualRate ??
      base?.maintResidualRate ??
      DEFAULT_END_RESIDUAL.maint,
    acctYears:
      sku.acctYears ?? base?.acctYears ?? DEFAULT_LIFE_YEARS.acct,
    physYears:
      sku.physYears ??
      base?.physYears ??
      ((sku.kind || base?.kind) === "station"
        ? DEFAULT_LIFE_YEARS.physStation
        : DEFAULT_LIFE_YEARS.physVehicle),
    maintYears: (() => {
      const baseM = base?.maintYears ?? DEFAULT_LIFE_YEARS.maint;
      const cur = sku.maintYears;
      if (cur == null) return baseM;
      // 旧库默认 6/7/8 → 统一维保默认 5
      if (baseM === DEFAULT_LIFE_YEARS.maint && (cur === 6 || cur === 7 || cur === 8))
        return DEFAULT_LIFE_YEARS.maint;
      return cur;
    })(),
  };
  return merged;
}

function mergeSupplyChain(
  cur?: SupplyChainNode[],
  base?: SupplyChainNode[],
): SupplyChainNode[] {
  if (!base?.length && !cur?.length) return cur || base || [];
  const byId = new Map((cur || []).map((n) => [n.id, n]));
  const rows = (base || cur || []).map((b) => {
    const hit = byId.get(b.id);
    return hit ? { ...b, ...hit, relatedParty: { ...b.relatedParty, ...hit.relatedParty } } : { ...b };
  });
  for (const n of cur || []) {
    if (!rows.some((x) => x.id === n.id)) rows.push(n);
  }
  return rows.sort((a, b) => a.step - b.step);
}

function mergeSpecFill(
  cur?: SpecFillRow[],
  base?: SpecFillRow[],
): SpecFillRow[] | undefined {
  if (!base?.length && !cur?.length) return cur ?? base;
  const byId = new Map((cur || []).map((r) => [r.id, r]));
  const rows = (base || cur || []).map((b) => {
    const hit = byId.get(b.id);
    return hit ? { ...b, value: hit.value } : { ...b };
  });
  for (const r of cur || []) {
    if (!rows.some((x) => x.id === r.id)) rows.push(r);
  }
  return rows;
}

function stationGunCount(sku: AssetSku) {
  const s = sku.stationSpec;
  if (!s) return 10;
  return Math.max(1, (s.fastGuns || 0) + (s.slowGuns || 0));
}

function stationFillPending(sku: AssetSku) {
  return (sku.specFill || []).filter((r) => r.required && !String(r.value || "").trim());
}

function stationBomSum(sku: AssetSku) {
  return (sku.stationBom || []).reduce((s, x) => s + (x.amountMxn || 0), 0);
}

function cartQtyOf(cart: Record<string, number>, id: string) {
  const rid = resolveSkuId(id);
  if (cart[rid] != null) return cart[rid] ?? 0;
  if (cart[id] != null) return cart[id] ?? 0;
  for (const [legacy, canon] of Object.entries(STATION_ID_ALIASES)) {
    if (canon === rid && cart[legacy] != null) return cart[legacy] ?? 0;
  }
  return 0;
}

function relatedFlagZh(flag: RelatedFlag) {
  if (flag === "yes") return "是·关联方";
  if (flag === "no") return "否";
  if (flag === "pending") return "待填";
  return "未知";
}

function relatedTone(
  flag: RelatedFlag,
): "neutral" | undefined {
  // 资产管理页统一黑白灰，关联方差异用文案表达，不用彩色 Stat
  return undefined;
}

function supplyChainPending(sku: AssetSku) {
  return (sku.supplyChain || []).filter((n) => {
    if (!n.nameZh || n.nameZh === "待填") return true;
    const flags = Object.values(n.relatedParty || {});
    return flags.some((f) => f === "pending");
  });
}

function modelSoftSum(model: AssetSku) {
  return model.softCosts.reduce((s, x) => s + (x.amountMxn || 0), 0);
}

/**
 * 墨西哥 IVA（增值税）税基：购入折后价 + 应税落地杂费。
 * 押金（deposit）一般不征 IVA，故剔除；其余皮费/装修按一般税率示意。
 * 对齐前提 vat（默认 16% = LIVA 一般税率）；进项可否抵扣另议。
 * 若 SKU.pricesIncludeVat：列载价已是含税现金，税基按含税价反拆估列 IVA。
 */
function modelUnitTaxBaseMxn(model: AssetSku, qty: number, configId?: string) {
  const disc = volumeDiscountRate(model, qty);
  const taxableSoft = model.softCosts
    .filter((s) => s.id !== "deposit")
    .reduce((s, x) => s + (x.amountMxn || 0), 0);
  return skuPurchasePriceMxn(model, configId) * (1 - disc) + taxableSoft;
}

/** 落地现金口径（购车×(1−量折)+皮费；含税 SKU 即案例列载价，未税 SKU 为加税前） */
function modelUnitLandedMxn(model: AssetSku, qty: number, configId?: string) {
  const disc = volumeDiscountRate(model, qty);
  return skuPurchasePriceMxn(model, configId) * (1 - disc) + modelSoftSum(model);
}

function modelUnitIvaMxn(
  model: AssetSku,
  qty: number,
  vat: number,
  configId?: string,
) {
  const base = modelUnitTaxBaseMxn(model, qty, configId);
  const v = Math.max(0, vat);
  if (skuPricesIncludeVat(model)) {
    // 列载含税：反拆其中 IVA 份额（押金已不在税基）
    return v > 0 ? (base * v) / (1 + v) : 0;
  }
  return base * v;
}

/** 含税落地（买家现金口径）。含税列载 SKU = landed；未税 SKU = landed + IVA */
function modelUnitGrossMxn(
  model: AssetSku,
  qty: number,
  vat: number,
  configId?: string,
) {
  if (skuPricesIncludeVat(model)) {
    return modelUnitLandedMxn(model, qty, configId);
  }
  return (
    modelUnitLandedMxn(model, qty, configId) +
    modelUnitIvaMxn(model, qty, vat, configId)
  );
}

/** 展示用未税：含税列载则反拆；否则等于 landed */
function modelUnitPreTaxMxn(
  model: AssetSku,
  qty: number,
  vat: number,
  configId?: string,
) {
  if (skuPricesIncludeVat(model)) {
    return (
      modelUnitGrossMxn(model, qty, vat, configId) -
      modelUnitIvaMxn(model, qty, vat, configId)
    );
  }
  return modelUnitLandedMxn(model, qty, configId);
}

function findOpsProfile(
  country: string,
  vertical: string,
  mode: OpMode,
  manager: ManagerId,
): OpsProfile {
  const hit = OPS_PROFILES.find(
    (p) =>
      p.country === country &&
      p.vertical === vertical &&
      p.mode === mode &&
      p.manager === manager,
  );
  if (hit) return hit;
  return (
    OPS_PROFILES.find((p) => p.mode === mode && p.manager === "fenbang") ||
    OPS_PROFILES[0]
  );
}

function cardIdFor(vehicleId: string, mode: OpMode) {
  if (vehicleId === "aion-es") return mode === "DAE" ? "aion-es-dae" : `aion-es-${mode.toLowerCase()}`;
  if (vehicleId === "aion-ut") {
    if (mode === "LTO") return "aion-ut-lto";
    if (mode === "RTO") return "aion-ut-rto";
    return "aion-ut-dae";
  }
  return `${vehicleId}-${mode.toLowerCase()}`;
}


/**
 * 资产卡：能生息、需经营的资产模板（车型）。
 * 固有参数 = 国家 × 业态 × 模式；DAE / RTO / LTO 均为「模式」而非资产大类。
 */
type VehicleCard = {
  id: string;
  /** 经营模式：DAE / RTO / LTO */
  mode: OpMode;
  /** 车型名（不要写成模式名） */
  nameZh: string;
  model: string;
  country: string;
  vertical: string;
  listPriceMxn: number;
  softCosts: SoftCostLine[];
  /** 会计寿命期末残值率 */
  residualRate: number;
  physResidualRate: number;
  maintResidualRate: number;
  acctYears: number;
  physYears: number;
  maintYears: number;
  bodyShare: number;
  batteryShare: number;
  rampYears: number;
  rampStartLoad: number;
  uncertaintyBand: number;
  // DAE 稳态
  util: number;
  iphMxn: number;
  hoursDay: number;
  daysWeek: number;
  /** DAE 每天班次数：1=一班倒，2=两班倒（对齐沣邦表「班次」） */
  shiftsPerDay?: number;
  subsidyPct: number;
  insuranceYrMxn: number;
  maintMxn: number;
  softMxn: number;
  wearYrMxn: number;
  kwhPer100: number;
  driverMxn: number;
  /** DAE 车位租金 MXN/月/台；案例表 280 */
  parkingMxn?: number;
  // LTO / RTO 稳态（租赁类）
  occupancy: number;
  badDebt: number;
  rentMonthMxn: number;
  depositMxn: number;
  /** 来源 SKU */
  skuId?: string;
  /** 选定配置档 */
  configVariantId?: string;
  /**
   * 下单后补录（对齐《EV数据逻辑梳理》基础字段）。
   * NIV + 电池 SN 保证车/电池唯一识别。
   */
  identity?: AssetIdentityFill;
};

const DEFAULT_SOFT: SoftCostLine[] = [
  { id: "plate", nameZh: "上牌/牌照", amountMxn: 4_000 },
  { id: "gps", nameZh: "GPS/车机", amountMxn: 3_000 },
  { id: "notary", nameZh: "登记/公证", amountMxn: 0 },
  { id: "logistics", nameZh: "运输入库", amountMxn: 0 },
  { id: "other", nameZh: "其他落地皮费", amountMxn: 0 },
];

const DEFAULT_VEHICLE_CARDS: VehicleCard[] = [
  {
    id: "aion-es-dae",
    mode: "DAE",
    nameZh: "埃安 ES",
    model: "ES",
    country: "墨西哥",
    vertical: "网约车·专车",
    listPriceMxn: 473_800,
    softCosts: DEFAULT_SOFT.map((s) => ({ ...s })),
    residualRate: 0.1,
    physResidualRate: 0,
    maintResidualRate: 0,
    acctYears: 5,
    physYears: 12,
    maintYears: 5,
    bodyShare: 0.5,
    batteryShare: 0.5,
    rampYears: 2,
    rampStartLoad: 0.55,
    uncertaintyBand: 0.12,
    util: 0.75,
    iphMxn: 210,
    hoursDay: 9.5,
    daysWeek: 6,
    shiftsPerDay: 2,
    subsidyPct: 0.05,
    insuranceYrMxn: 25_000,
    maintMxn: 1_500,
    softMxn: 500,
    wearYrMxn: 12_000 + 16_000 + 20_800,
    kwhPer100: 15,
    driverMxn: 26_000,
    parkingMxn: 280,
    occupancy: 0,
    badDebt: 0,
    rentMonthMxn: 0,
    depositMxn: 0,
  },
  {
    id: "aion-ut-lto",
    mode: "LTO",
    nameZh: "埃安 UT",
    model: "UT",
    country: "墨西哥",
    vertical: "网约车·快车",
    listPriceMxn: 398_610,
    softCosts: DEFAULT_SOFT.map((s) => ({ ...s })),
    residualRate: 0.1,
    physResidualRate: 0,
    maintResidualRate: 0,
    acctYears: 4,
    physYears: 10,
    maintYears: 5,
    bodyShare: 0.5,
    batteryShare: 0.5,
    rampYears: 2,
    rampStartLoad: 0.6,
    uncertaintyBand: 0.15,
    util: 0,
    iphMxn: 0,
    hoursDay: 0,
    daysWeek: 6,
    subsidyPct: 0,
    insuranceYrMxn: 18_000,
    maintMxn: 0,
    softMxn: 500,
    wearYrMxn: 0,
    kwhPer100: 15,
    driverMxn: 0,
    occupancy: 0.85,
    badDebt: 0.015,
    rentMonthMxn: 19_500,
    depositMxn: 6_000,
  },
  {
    id: "aion-ut-rto",
    mode: "RTO",
    nameZh: "埃安 UT",
    model: "UT",
    country: "墨西哥",
    vertical: "网约车·快车",
    listPriceMxn: 398_610,
    softCosts: DEFAULT_SOFT.map((s) => ({ ...s })),
    residualRate: 0.1,
    physResidualRate: 0,
    maintResidualRate: 0,
    acctYears: 4,
    physYears: 10,
    maintYears: 5,
    bodyShare: 0.5,
    batteryShare: 0.5,
    rampYears: 2,
    rampStartLoad: 0.5,
    uncertaintyBand: 0.14,
    util: 0,
    iphMxn: 0,
    hoursDay: 0,
    daysWeek: 6,
    subsidyPct: 0,
    insuranceYrMxn: 18_000,
    maintMxn: 0,
    softMxn: 500,
    wearYrMxn: 0,
    kwhPer100: 15,
    driverMxn: 0,
    occupancy: 0.8,
    badDebt: 0.02,
    rentMonthMxn: 21_000,
    depositMxn: 8_000,
  },
];

function softCostSumMxn(card: VehicleCard) {
  return card.softCosts.reduce((s, x) => s + (x.amountMxn || 0), 0);
}

function vehicleUnitMxn(card: VehicleCard, discountRate: number) {
  const disc = Math.max(0, Math.min(0.95, discountRate || 0));
  return card.listPriceMxn * (1 - disc) + softCostSumMxn(card);
}

function defaultCardId(asset: InvestAsset) {
  if (asset === "dae") return "aion-es-dae";
  if (asset === "rto") return "aion-ut-rto";
  if (asset === "lto") return "aion-ut-lto";
  return "station";
}

function normalizeCard(card: VehicleCard): VehicleCard {
  const anyC = card as VehicleCard & { kind?: string; opMode?: string };
  let mode = card.mode;
  if (!mode && anyC.kind === "dae") mode = "DAE";
  if (!mode && anyC.kind === "lto") mode = "LTO";
  if (!mode && anyC.opMode?.includes("RTO")) mode = "RTO";
  if (!mode && anyC.opMode?.includes("DAE")) mode = "DAE";
  if (!mode && anyC.opMode?.includes("LTO")) mode = "LTO";
  // 旧 id 映射
  let id = card.id;
  if (id === "dae-aion-es") id = "aion-es-dae";
  if (id === "lto-aion-ut") id = "aion-ut-lto";
  const identity = emptyIdentity({
    ...(card.identity || {}),
    configVariantId:
      card.identity?.configVariantId || card.configVariantId || "",
    modelFullZh: card.identity?.modelFullZh || card.model || "",
    customizedCarId:
      card.identity?.customizedCarId || card.id || "",
  });
  const base =
    DEFAULT_VEHICLE_CARDS.find((c) => c.id === id) ||
    DEFAULT_VEHICLE_CARDS.find((c) => c.mode === (mode || card.mode));
  return {
    ...card,
    id,
    mode: mode || "DAE",
    configVariantId: card.configVariantId || identity.configVariantId,
    identity,
    /** 期末残值可配；缺省对齐代码库 */
    residualRate: card.residualRate ?? base?.residualRate ?? DEFAULT_END_RESIDUAL.acct,
    physResidualRate:
      card.physResidualRate ?? base?.physResidualRate ?? DEFAULT_END_RESIDUAL.phys,
    maintResidualRate:
      card.maintResidualRate ??
      base?.maintResidualRate ??
      DEFAULT_END_RESIDUAL.maint,
    acctYears: card.acctYears ?? base?.acctYears,
    physYears: card.physYears ?? base?.physYears,
    maintYears: card.maintYears ?? base?.maintYears,
    parkingMxn: card.parkingMxn ?? base?.parkingMxn,
    shiftsPerDay: card.shiftsPerDay ?? base?.shiftsPerDay,
    // 旧版曾把两班写成 driver×2 持久化；DAE 卡统一回落案例表单司机 26000
    driverMxn:
      id === "aion-es-dae" && base?.driverMxn != null
        ? base.driverMxn
        : card.driverMxn ?? base?.driverMxn,
    util: card.util ?? base?.util,
    iphMxn: card.iphMxn ?? base?.iphMxn,
    hoursDay: card.hoursDay ?? base?.hoursDay,
    daysWeek: card.daysWeek ?? base?.daysWeek,
    subsidyPct: card.subsidyPct ?? base?.subsidyPct,
    kwhPer100: card.kwhPer100 ?? base?.kwhPer100,
    insuranceYrMxn: card.insuranceYrMxn ?? base?.insuranceYrMxn,
    maintMxn: card.maintMxn ?? base?.maintMxn,
    softMxn: card.softMxn ?? base?.softMxn,
    wearYrMxn: card.wearYrMxn ?? base?.wearYrMxn,
  };
}

/** 把运营机构剖面 + 质量系数叠到车辆卡（同资产换管理人时的决策测算） */
function applyManagerToVehicleCard(
  card: VehicleCard,
  manager: ManagerId,
  country = "墨西哥",
  vertical?: string,
): VehicleCard {
  const vert = vertical || card.vertical || "网约车·专车";
  const profile = findOpsProfile(country, vert, card.mode, manager);
  const q = operatorQualityOf(manager);
  const baseRes = card.residualRate ?? DEFAULT_END_RESIDUAL.acct;
  return {
    ...card,
    rampYears: profile.rampYears,
    rampStartLoad: profile.rampStartLoad,
    uncertaintyBand: profile.uncertaintyBand,
    util: profile.mode === "DAE" ? profile.util : card.util,
    iphMxn: profile.mode === "DAE" ? profile.iphMxn : card.iphMxn,
    hoursDay: profile.mode === "DAE" ? profile.hoursDay : card.hoursDay,
    daysWeek: profile.mode === "DAE" ? profile.daysWeek : card.daysWeek,
    subsidyPct: profile.mode === "DAE" ? profile.subsidyPct : card.subsidyPct,
    driverMxn: profile.mode === "DAE" ? profile.driverMxn : card.driverMxn,
    occupancy: profile.mode !== "DAE" ? profile.occupancy : card.occupancy,
    badDebt: profile.mode !== "DAE" ? profile.badDebt : card.badDebt,
    rentMonthMxn:
      profile.mode !== "DAE" ? profile.rentMonthMxn : card.rentMonthMxn,
    depositMxn: profile.mode !== "DAE" ? profile.depositMxn : card.depositMxn,
    residualRate: Math.min(0.4, baseRes * q.residualMul),
    insuranceYrMxn: Math.round((card.insuranceYrMxn || 0) * q.insuranceMul),
  };
}

function cardsForManager(
  cards: VehicleCard[],
  manager: ManagerId,
  country = "墨西哥",
  vertical = "网约车·专车",
): VehicleCard[] {
  return (cards.length ? cards : DEFAULT_VEHICLE_CARDS).map((c) =>
    applyManagerToVehicleCard(normalizeCard(c), manager, country, vertical),
  );
}

/**
 * 资产单元：某一时点、同一资产卡（含其模式）下的同质集合。
 */
type InvestmentNode = {
  id: string;
  label: string;
  year: number;
  /** 场站，或模式槽位 dae/rto/lto */
  asset: InvestAsset;
  cardId: string;
  quantity: number;
  discountRate: number;
  enabled: boolean;
};

const DEFAULT_NODES: InvestmentNode[] = [
  {
    id: "st-y1",
    label: "场站一期建设",
    year: 1,
    asset: "station",
    cardId: "station",
    quantity: 10,
    discountRate: 0,
    enabled: true,
  },
  {
    id: "dae-y1",
    label: "埃安ES·DAE首批",
    year: 1,
    asset: "dae",
    cardId: "aion-es-dae",
    quantity: 50,
    discountRate: 0,
    enabled: true,
  },
  {
    id: "lto-y1",
    label: "埃安UT·LTO首批",
    year: 1,
    asset: "lto",
    cardId: "aion-ut-lto",
    quantity: 100,
    discountRate: 0,
    enabled: true,
  },
  {
    id: "dae-y2",
    label: "埃安ES·DAE二批",
    year: 2,
    asset: "dae",
    cardId: "aion-es-dae",
    quantity: 150,
    discountRate: 0,
    enabled: true,
  },
  {
    id: "lto-y2",
    label: "埃安UT·LTO二批",
    year: 2,
    asset: "lto",
    cardId: "aion-ut-lto",
    quantity: 100,
    discountRate: 0,
    enabled: true,
  },
];

/** 预算计划起点年：支付日 2026 → 计划 Y1 */
const PLAN_BASE_YEAR = 2026;

type PurchaseOrderStatus = "pending_pay" | "paid" | "cancelled";

type PurchaseOrderLine = {
  id: string;
  skuId: string;
  cardId: string;
  nameZh: string;
  /** 场站 / DAE / LTO / RTO */
  modeLabel: string;
  qty: number;
  unitLabel: string;
  unitLandedMxn: number;
  discountRate: number;
};

/** 订单级支付方案：管理人出资 vs 借款 */
type OrderPayPlan = {
  includeDebt: boolean;
  /** 借款占购置款比例 0–1 */
  debtPct: number;
  debtRate: number;
  debtYears: number;
};

/**
 * 待支付/已支付采购订单 = 货架下单生成的「资产单元」包。
 * 一包可含多种资产（场站套 + 车队等），有独立编号 unitCode；
 * 在「资产组合」展开批次后配置情境，得到本包 CF / IRR。
 */
type PurchaseOrder = {
  id: string;
  /** 独立资产单元编号，如 AU-2026-001 */
  unitCode: string;
  label: string;
  /** 计划付款日 YYYY-MM-DD */
  payDate: string;
  /** 计划投产/上路日 */
  goLiveDate: string;
  status: PurchaseOrderStatus;
  lines: PurchaseOrderLine[];
  noteZh: string;
  /** 经营情境 */
  managerId: ManagerId;
  country: string;
  vertical: string;
  scenario: CashflowScenario;
  payPlan: OrderPayPlan;
};

function defaultOrderPayPlan(): OrderPayPlan {
  return {
    includeDebt: true,
    debtPct: 0.85,
    debtRate: 0.14,
    debtYears: 3,
  };
}

/** 按付款年生成 AU-YYYY-NNN；兼容旧单无编号时按序补号 */
function nextAssetUnitCode(
  orders: PurchaseOrder[],
  payDate: string,
): string {
  const y = String(payDate || PLAN_BASE_YEAR).slice(0, 4) || String(PLAN_BASE_YEAR);
  const prefix = `AU-${y}-`;
  let max = 0;
  for (const o of orders) {
    const code = o.unitCode || "";
    if (!code.startsWith(prefix)) continue;
    const n = Number(code.slice(prefix.length));
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

function ensureOrderUnitCode(
  raw: Partial<PurchaseOrder> & Pick<PurchaseOrder, "id" | "lines">,
  peers: PurchaseOrder[] = [],
): string {
  if (raw.unitCode && String(raw.unitCode).trim()) return String(raw.unitCode).trim();
  const pay = raw.payDate || `${PLAN_BASE_YEAR}-10-15`;
  // 稳定回填：用 id 哈希落到同年序号，避免每次 normalize 变号
  const y = String(pay).slice(0, 4) || String(PLAN_BASE_YEAR);
  const seed = String(raw.id || "po")
    .split("")
    .reduce((s, c) => s + c.charCodeAt(0), 0);
  const fromPeers = nextAssetUnitCode(peers, pay);
  const peerN = Number(fromPeers.slice(`AU-${y}-`.length));
  const n = Math.max(1, (seed % 90) + 1);
  if (!peers.length) return `AU-${y}-${String(n).padStart(3, "0")}`;
  return fromPeers;
}

function normalizePurchaseOrder(
  raw: Partial<PurchaseOrder> & Pick<PurchaseOrder, "id" | "lines">,
  peers: PurchaseOrder[] = [],
): PurchaseOrder {
  return {
    id: raw.id,
    unitCode: ensureOrderUnitCode(raw, peers),
    label: raw.label || "未命名资产单元",
    payDate: raw.payDate || `${PLAN_BASE_YEAR}-10-15`,
    goLiveDate: raw.goLiveDate || `${PLAN_BASE_YEAR}-12-01`,
    status: raw.status || "pending_pay",
    lines: (raw.lines || []).map((ln) => ({
      ...ln,
      skuId: resolveSkuId(ln.skuId),
    })),
    noteZh: raw.noteZh || "",
    managerId: raw.managerId || "fenbang",
    country: raw.country || "墨西哥",
    vertical: raw.vertical || "网约车·专车",
    scenario: raw.scenario || "base",
    payPlan: {
      ...defaultOrderPayPlan(),
      ...(raw.payPlan || {}),
    },
  };
}

function orderEquityPct(plan: OrderPayPlan): number {
  if (!plan.includeDebt) return 1;
  return Math.max(0, Math.min(1, 1 - plan.debtPct));
}

function orderDebtMxn(order: PurchaseOrder, vat = 0.16): number {
  const total = orderTotalGrossMxn(order, vat);
  if (!order.payPlan.includeDebt) return 0;
  return total * Math.max(0, Math.min(1, order.payPlan.debtPct));
}

function orderEquityMxn(order: PurchaseOrder, vat = 0.16): number {
  return orderTotalGrossMxn(order, vat) - orderDebtMxn(order, vat);
}

/** 按本单支付方案临时覆盖全局融资假设，供试算 */
function premiseWithOrderPay(p: Premise, order: PurchaseOrder): Premise {
  const plan = order.payPlan;
  const debtPct = plan.includeDebt
    ? Math.max(0, Math.min(1, plan.debtPct))
    : 0;
  return {
    ...p,
    includeDebt: plan.includeDebt,
    cashflowScenario: order.scenario,
    stationFinancePct: debtPct,
    daeFinancePct: debtPct,
    ltoFinancePct: debtPct,
    stationFinanceRate: plan.debtRate,
    daeFinanceRate: plan.debtRate,
    ltoFinanceRate: plan.debtRate,
    stationFinanceYears: plan.debtYears,
    daeFinanceYears: plan.debtYears,
    ltoFinanceYears: plan.debtYears,
  };
}

function payDateToPlanYear(payDate: string, base = PLAN_BASE_YEAR): number {
  const y = Number(String(payDate).slice(0, 4));
  if (!Number.isFinite(y)) return 1;
  return Math.max(1, y - base + 1);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + Math.max(0, Math.round(days)));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function orderLineAsset(line: PurchaseOrderLine): InvestAsset {
  if (line.modeLabel === "场站" || line.skuId.includes("station"))
    return "station";
  if (line.modeLabel === "DAE") return "dae";
  if (line.modeLabel === "RTO") return "rto";
  return "lto";
}

/** 订单行金额为落地价（含税列载 SKU 已是现金；未税 SKU 为加税前）。展示含税合计见 orderTotalGrossMxn */
function orderTotalMxn(order: PurchaseOrder): number {
  return order.lines.reduce(
    (s, l) => s + l.unitLandedMxn * Math.max(0, l.qty),
    0,
  );
}

function orderTotalGrossMxn(order: PurchaseOrder, vat: number): number {
  const v = Math.max(0, vat);
  return order.lines.reduce((s, l) => {
    const line = l.unitLandedMxn * Math.max(0, l.qty);
    const sku = DEFAULT_ASSET_SKUS.find((x) => x.id === l.skuId);
    if (sku && skuPricesIncludeVat(sku)) return s + line;
    return s + line * (1 + v);
  }, 0);
}

function ordersToNodes(orders: PurchaseOrder[]): InvestmentNode[] {
  const out: InvestmentNode[] = [];
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    const year = payDateToPlanYear(o.payDate);
    for (const line of o.lines) {
      out.push({
        id: `${o.id}__${line.id}`,
        label: `${o.label}·${line.nameZh}·${line.modeLabel}`,
        year,
        asset: orderLineAsset(line),
        cardId: line.cardId,
        quantity: line.qty,
        discountRate: line.discountRate,
        enabled: true,
      });
    }
  }
  return out.length > 0 ? out : DEFAULT_NODES;
}

function landedMxnForDefaultSku(
  skuId: string,
  qty: number,
  cardId: string,
): { unit: number; disc: number; unitLabel: string; nameZh: string } {
  const sku =
    DEFAULT_ASSET_SKUS.find((s) => s.id === skuId) ||
    DEFAULT_ASSET_SKUS.find((s) =>
      skuId.includes("station") ? s.kind === "station" : false,
    );
  if (sku) {
    const disc = volumeDiscountRate(sku, qty);
    return {
      unit: modelUnitLandedMxn(sku, qty),
      disc,
      unitLabel: sku.unitLabel,
      nameZh: sku.nameZh,
    };
  }
  const card =
    DEFAULT_VEHICLE_CARDS.find((c) => c.id === cardId) ||
    DEFAULT_VEHICLE_CARDS[0];
  return {
    unit: vehicleUnitMxn(card, 0),
    disc: 0,
    unitLabel: "台",
    nameZh: card.nameZh,
  };
}

function buildDefaultPurchaseOrders(): PurchaseOrder[] {
  const stSku =
    DEFAULT_ASSET_SKUS.find((s) => s.id === "station-medium") ||
    DEFAULT_ASSET_SKUS.find((s) => s.kind === "station")!;
  const stGuns = stationGunCount(stSku);
  const stDisc = volumeDiscountRate(stSku, 1);
  const stPack = modelUnitLandedMxn(stSku, 1);
  const stUnitGun = stPack / Math.max(stGuns, 1);
  const es = landedMxnForDefaultSku("aion-es", 50, "aion-es-dae");
  const ut = landedMxnForDefaultSku("aion-ut", 100, "aion-ut-lto");
  const es2 = landedMxnForDefaultSku("aion-es", 150, "aion-es-dae");
  const ut2 = landedMxnForDefaultSku("aion-ut", 100, "aion-ut-lto");
  return [
    normalizePurchaseOrder({
      id: "po-2026-10",
      unitCode: "AU-2026-001",
      label: "首批投产包",
      payDate: "2026-10-15",
      goLiveDate: "2026-12-01",
      status: "pending_pay",
      noteZh:
        "2026年10月货架下单：付款购车与建站；车辆按本地库存车整备后上路（无海运/清关空窗，最长约1个月）。形成第一批资产包。场站按中型站折合枪数入账。",
      managerId: "fenbang",
      country: "墨西哥",
      vertical: "网约车·专车",
      scenario: "base",
      payPlan: defaultOrderPayPlan(),
      lines: [
        {
          id: "st",
          skuId: "station-medium",
          cardId: "station",
          nameZh: stSku.nameZh,
          modeLabel: "场站",
          qty: stGuns,
          unitLabel: "枪",
          unitLandedMxn: stUnitGun,
          discountRate: stDisc,
        },
        {
          id: "es",
          skuId: "aion-es",
          cardId: "aion-es-dae",
          nameZh: es.nameZh,
          modeLabel: "DAE",
          qty: 50,
          unitLabel: es.unitLabel,
          unitLandedMxn: es.unit,
          discountRate: es.disc,
        },
        {
          id: "ut",
          skuId: "aion-ut",
          cardId: "aion-ut-lto",
          nameZh: ut.nameZh,
          modeLabel: "LTO",
          qty: 100,
          unitLabel: ut.unitLabel,
          unitLandedMxn: ut.unit,
          discountRate: ut.disc,
        },
      ],
    }),
    normalizePurchaseOrder({
      id: "po-2027-06",
      unitCode: "AU-2027-001",
      label: "二批扩容包",
      payDate: "2027-06-01",
      goLiveDate: "2027-07-20",
      status: "pending_pay",
      noteZh: "2027年第二批购置并投产，形成第二批资产包。",
      managerId: "fenbang",
      country: "墨西哥",
      vertical: "网约车·快车",
      scenario: "base",
      payPlan: {
        includeDebt: true,
        debtPct: 0.8,
        debtRate: 0.15,
        debtYears: 3,
      },
      lines: [
        {
          id: "es",
          skuId: "aion-es",
          cardId: "aion-es-dae",
          nameZh: es2.nameZh,
          modeLabel: "DAE",
          qty: 150,
          unitLabel: es2.unitLabel,
          unitLandedMxn: es2.unit,
          discountRate: es2.disc,
        },
        {
          id: "ut",
          skuId: "aion-ut",
          cardId: "aion-ut-lto",
          nameZh: ut2.nameZh,
          modeLabel: "LTO",
          qty: 100,
          unitLabel: ut2.unitLabel,
          unitLandedMxn: ut2.unit,
          discountRate: ut2.disc,
        },
      ],
    }),
  ];
}

const DEFAULT_PURCHASE_ORDERS = buildDefaultPurchaseOrders();

type Premise = {
  usdMxn: number;
  cnyMxn: number;
  /** 墨西哥联邦 IVA 一般税率（默认 16%）；未税 SKU 加税，含税列载 SKU（如案例车价）不再加税 */
  vat: number;
  cit: number;
  depositRate: number;
  residualMode: ResidualMode;
  includeHq: boolean;
  /** 总部管理费月额（MXN），来自测算假设页 */
  hqMonthMxn: number;
  /** 稳定期分摊比例；投放首年按 100%（对齐原表「27年3月后按25%」） */
  hqSteadyPct: number;
  /**
   * 管理能力 0–1：缩短达产、稳住经营；体现「谁在管、资源是否配齐」的主观侧。
   */
  mgmtCapability: number;
  /** 资源到位率 0–1：司机/运维/桩位等配套；影响不确定性情景振幅 */
  resourceReadiness: number;
  /** 现金流情景：固有不确定性带宽 × 资源到位 → 上下行 */
  cashflowScenario: CashflowScenario;
  /** 场站固有达产年数 / 首年负荷 / 不确定性 */
  stationRampYears: number;
  stationRampStartLoad: number;
  stationUncertaintyBand: number;
  /**
   * 单车上路周期（付款购置 → 投产出收入），单位天。
   * 与「组合达产年数」不同：前者是这台车何时开始赚钱，后者是车队爬到稳态。
   */
  goLiveOceanDays: number;
  goLiveCustomsDays: number;
  goLivePdiDays: number;
  goLiveMatchDays: number;
  /** 车运营漏斗：各阶段通过率（1=不掉队） */
  goLiveCustomsPass: number;
  goLivePdiPass: number;
  goLiveMatchPass: number;
  years: number;
  // 充电桩
  chargerGuns: number;
  chargerCapexMxn: number; // 桩建设
  stationFitoutMxn: number;
  stationDepositMxn: number;
  stationRentMxn: number;
  externalUtil: number;
  internalUtil: number;
  externalPriceMxn: number;
  internalPriceMxn: number;
  powerKw: number;
  hoursPerMonth: number;
  elecCostMxn: number;
  lossFactor: number;
  xiaojufenPct: number;
  payFeePct: number;
  parkingRentMxn: number;
  ancillaryMxn: number;
  opexStationMxn: number;
  chargerAcctYears: number;
  chargerPhysYears: number;
  chargerMaintYears: number;
  chargerResidualRate: number;
  /** 是否启用债务融资（资本层）；关闭则 100% 权益、无利息 */
  includeDebt: boolean;
  /** 充电桩资本配置：融资比例 / 利率 / 年限 */
  stationFinancePct: number;
  stationFinanceRate: number;
  stationFinanceYears: number;
  // DAE
  daeUnits: number;
  daePriceMxn: number;
  daePlateMxn: number;
  daeGpsMxn: number;
  daeResidualRate: number;
  daeAcctYears: number;
  daePhysYears: number;
  daeMaintYears: number;
  daeUtil: number;
  daeIph: number;
  daeHoursDay: number;
  daeDaysWeek: number;
  daeSubsidyPct: number;
  daeInsuranceYr: number;
  daeMaintMxn: number;
  daeSoftMxn: number;
  daeWearYrMxn: number;
  daeKwhPer100: number;
  daeDriverMxn: number;
  daeFinancePct: number;
  daeFinanceRate: number;
  daeFinanceYears: number;
  // LTO
  ltoUnits: number;
  ltoPriceMxn: number;
  ltoPlateMxn: number;
  ltoGpsMxn: number;
  ltoResidualRate: number;
  ltoAcctYears: number;
  ltoPhysYears: number;
  ltoMaintYears: number;
  ltoOccupancy: number;
  ltoBadDebt: number;
  ltoRentMonth: number;
  ltoDepositMxn: number;
  ltoInsuranceYr: number;
  ltoSoftMxn: number;
  ltoFinancePct: number;
  ltoFinanceRate: number;
  ltoFinanceYears: number;
  // 关联交易
  relatedEnabled: boolean;
  priorityChargePct: number; // 车辆在场站优先充电占比
  relatedParkingMxn: number; // 车位关联租金（车辆→场站）
  eliminateInternal: boolean; // 合并抵消内部充电收入/成本
};

const DEFAULT: Premise = {
  usdMxn: 17.522,
  cnyMxn: 2.5826,
  vat: 0.16,
  cit: 0.3,
  depositRate: 0.04,
  residualMode: "accounting",
  includeHq: true,
  hqMonthMxn: 640_891,
  hqSteadyPct: 0.25,
  mgmtCapability: 0.7,
  resourceReadiness: 0.75,
  cashflowScenario: "base",
  stationRampYears: 2,
  stationRampStartLoad: 0.5,
  stationUncertaintyBand: 0.1,
  /** 访谈：本地库存车 — 无海运/清关，整备即可，空窗最长约1个月 */
  goLiveOceanDays: 0,
  goLiveCustomsDays: 0,
  goLivePdiDays: 20,
  goLiveMatchDays: 0,
  goLiveCustomsPass: 0.98,
  goLivePdiPass: 0.97,
  goLiveMatchPass: 0.92,
  years: 6,
  chargerGuns: 10,
  chargerCapexMxn: 5_500_000,
  stationFitoutMxn: 1_300_000,
  stationDepositMxn: 140_000,
  stationRentMxn: 81_200,
  externalUtil: 0.1,
  internalUtil: 0.2,
  externalPriceMxn: 8,
  internalPriceMxn: 7,
  powerKw: 42.86,
  hoursPerMonth: 30 * 24 * 0.3, // 与单枪月充电量口径对齐用利用率×功率×小时
  elecCostMxn: 3,
  lossFactor: 1.08,
  xiaojufenPct: 0.1,
  payFeePct: 0.02,
  parkingRentMxn: 16_240,
  ancillaryMxn: 50_000,
  opexStationMxn: 160_000,
  chargerAcctYears: 5,
  chargerPhysYears: 8,
  chargerMaintYears: 7,
  chargerResidualRate: 0.05,
  includeDebt: true,
  stationFinancePct: 0.85,
  stationFinanceRate: 0.14,
  stationFinanceYears: 3,
  daeUnits: 200,
  daePriceMxn: 473_800,
  daePlateMxn: 4_000,
  daeGpsMxn: 3_000,
  daeResidualRate: 0.1,
  daeAcctYears: 5,
  daePhysYears: 12,
  daeMaintYears: 8,
  daeUtil: 0.75,
  daeIph: 210,
  daeHoursDay: 9.5,
  daeDaysWeek: 6,
  daeSubsidyPct: 0.05,
  daeInsuranceYr: 25_000,
  daeMaintMxn: 1_500,
  daeSoftMxn: 500,
  daeWearYrMxn: 12_000 + 16_000 + 20_800,
  daeKwhPer100: 15,
  daeDriverMxn: 26_000,
  daeFinancePct: 0.9,
  daeFinanceRate: 0.14,
  daeFinanceYears: 3,
  ltoUnits: 200,
  ltoPriceMxn: 398_610,
  ltoPlateMxn: 4_000,
  ltoGpsMxn: 3_000,
  ltoResidualRate: 0.15,
  ltoAcctYears: 4,
  ltoPhysYears: 10,
  ltoMaintYears: 6,
  ltoOccupancy: 0.85,
  ltoBadDebt: 0.015,
  ltoRentMonth: 19_500,
  ltoDepositMxn: 6_000,
  ltoInsuranceYr: 18_000,
  ltoSoftMxn: 500,
  ltoFinancePct: 0.8,
  ltoFinanceRate: 0.15,
  ltoFinanceYears: 3,
  relatedEnabled: true,
  priorityChargePct: 0.85,
  relatedParkingMxn: 280,
  eliminateInternal: true,
};

type YearRow = {
  year: number;
  label: string;
  // 在管规模（投资节点累计）
  gunsOnline: number;
  daeOnline: number;
  ltoOnline: number;
  // 资产价值
  bookValue: number;
  marketResidual: number;
  // 财务口径
  revenue: number;
  /** 资产可变成本（随台数/枪数） */
  varCost: number;
  /** 场站等固定成本（不含总部） */
  fixedCost: number;
  /** 资产贡献毛利 = 收入 − 可变成本 */
  contribution: number;
  /** 贡献 − 场站固定成本 */
  afterSiteFixed: number;
  /** 组合加权达产负荷（相对稳态） */
  rampLoad: number;
  /** 情景系数（固有不确定性 × 资源到位 × 上下行） */
  scenarioFactor: number;
  /** 若已达产且无不确定性冲击的稳态收入（对照） */
  steadyRevenue: number;
  opex: number;
  hqAlloc: number;
  /** 总部占收入 / 占贡献 */
  hqOnRevenue: number;
  hqOnContribution: number;
  depreciation: number;
  interest: number;
  interestIncome: number;
  ebitda: number;
  /** EBITDA − 折旧（经营层，尚未扣资本利息） */
  ebit: number;
  pretax: number;
  tax: number;
  netIncome: number;
  /** 无杠杆净利（不计借款利息） */
  unleveredNi: number;
  // 资本层：按资产配置的借款 / 还本 / 利息
  financingInStation: number;
  financingInDae: number;
  financingInLto: number;
  financingOutStation: number;
  financingOutDae: number;
  financingOutLto: number;
  interestStation: number;
  interestDae: number;
  interestLto: number;
  loanBalStation: number;
  loanBalDae: number;
  loanBalLto: number;
  // 现金流口径明细
  openingCash: number;
  operatingCF: number;
  /** 无杠杆经营现金流 ≈ 无杠杆净利 + 折旧 + 利息收入 */
  unleveredOpCf: number;
  stationCapex: number;
  vehicleCapex: number;
  capex: number;
  financingIn: number;
  financingOut: number;
  residualIn: number;
  cashFlow: number;
  cumulativeCF: number;
  closingCash: number;
  // 分项收入
  stationRev: number;
  vehicleRev: number;
  relatedCharge: number;
  eliminated: number;
  /** 本年触发的投资节点标签 */
  nodeLabels: string[];
};

function mxnToUsd(mxn: number, fx: number) {
  return mxn / fx; // → 实际 USD
}

function lifeYears(p: Premise, kind: "charger" | "dae" | "lto") {
  if (kind === "charger") {
    if (p.residualMode === "physical") return p.chargerPhysYears;
    if (p.residualMode === "maintenance") return p.chargerMaintYears;
    return p.chargerAcctYears;
  }
  if (kind === "dae") {
    if (p.residualMode === "physical") return p.daePhysYears;
    if (p.residualMode === "maintenance") return p.daeMaintYears;
    return p.daeAcctYears;
  }
  if (p.residualMode === "physical") return p.ltoPhysYears;
  if (p.residualMode === "maintenance") return p.ltoMaintYears;
  return p.ltoAcctYears;
}

function residualRate(p: Premise, kind: "charger" | "dae" | "lto") {
  return kind === "charger"
    ? p.chargerResidualRate
    : kind === "dae"
      ? p.daeResidualRate
      : p.ltoResidualRate;
}

/** 单车上路阶段（付款后） */
type GoLiveStageId = "ocean" | "customs" | "pdi" | "match";

type GoLiveStage = {
  id: GoLiveStageId;
  nameZh: string;
  days: number;
  whyZh: string;
};

function goLiveRawDays(p: Pick<
  Premise,
  | "goLiveOceanDays"
  | "goLiveCustomsDays"
  | "goLivePdiDays"
  | "goLiveMatchDays"
>): Record<GoLiveStageId, number> {
  let ocean = p.goLiveOceanDays;
  let customs = p.goLiveCustomsDays;
  let pdi = p.goLivePdiDays;
  let match = p.goLiveMatchDays;
  /** 旧进口链路默认 → 访谈本地库存车口径 */
  if (ocean === 35 && customs === 14 && pdi === 10 && match === 14) {
    ocean = 0;
    customs = 0;
    pdi = 20;
    match = 0;
  }
  return {
    ocean: Math.max(0, ocean ?? 0),
    customs: Math.max(0, customs ?? 0),
    pdi: Math.max(0, Math.min(30, pdi ?? 20)),
    match: Math.max(0, match ?? 0),
  };
}

/**
 * 上路前阶段。访谈默认：本地库存车只需整备/上牌；海运、清关天数为 0 则跳过。
 * 整备天封顶 30（空窗最长约一个月）。
 */
function goLiveEffectiveStages(p: Premise): GoLiveStage[] {
  const raw = goLiveRawDays(p);
  const m = Math.max(0, Math.min(1, p.mgmtCapability ?? 0.7));
  const r = Math.max(0, Math.min(1, p.resourceReadiness ?? 0.75));
  const stages: GoLiveStage[] = [];
  if (raw.ocean > 0) {
    stages.push({
      id: "ocean",
      nameZh: "海运/在途",
      days: Math.round(raw.ocean),
      whyZh: "出厂→墨港在途；船期与柜况主导（当前库存车路径默认关闭）",
    });
  }
  if (raw.customs > 0) {
    stages.push({
      id: "customs",
      nameZh: "报关清关",
      days: Math.max(1, Math.round(raw.customs * (1.12 - 0.25 * m))),
      whyZh: "报关、完税、放行（当前库存车路径默认关闭）",
    });
  }
  if (raw.pdi > 0) {
    stages.push({
      id: "pdi",
      nameZh: "整备/上牌",
      days: Math.min(
        30,
        Math.max(1, Math.round(raw.pdi * (1.15 - 0.3 * m))),
      ),
      whyZh: "访谈：本地库存车；无海运/清关，PDI/上牌/GPS 整备即可，空窗最长约1个月",
    });
  }
  if (raw.match > 0) {
    stages.push({
      id: "match",
      nameZh: "匹配司机/上架",
      days: Math.max(
        1,
        Math.round(raw.match * (1.25 - 0.4 * m) * (1.2 - 0.35 * r)),
      ),
      whyZh: "DAE 找司机 / LTO 找承租；库存车路径默认并入整备或关闭",
    });
  }
  return stages;
}

function goLiveTotalDays(stages: GoLiveStage[]) {
  return stages.reduce((s, x) => s + x.days, 0);
}

/** 付款后空窗月数（无经营流入）；库存车访谈口径最长 1 个月 */
function goLiveIdleMonths(totalDays: number) {
  if (totalDays <= 0) return 0;
  return Math.min(1, Math.max(1, Math.ceil(totalDays / 30)));
}

function goLiveStageAtDay(stages: GoLiveStage[], day: number): string {
  if (day <= 0) return "付款";
  let t = 0;
  for (const s of stages) {
    t += s.days;
    if (day <= t) return s.nameZh;
  }
  return "投产";
}

/** 资产管理对照日：总览阶段判定 */
const ASSET_AS_OF_DATE = "2026-08-12";

function daysBetweenIso(fromIso: string, toIso: string): number {
  const a = Date.parse(`${String(fromIso).slice(0, 10)}T12:00:00`);
  const b = Date.parse(`${String(toIso).slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

type OrderAssetPhaseId =
  | "cancelled"
  | "created_unpaid"
  | "paid_prelive"
  | "live";

function orderAssetPhase(
  order: PurchaseOrder,
  asOf: string,
  stages: GoLiveStage[],
): { id: OrderAssetPhaseId; stageZh: string; detailZh: string } {
  if (order.status === "cancelled") {
    return { id: "cancelled", stageZh: "已取消", detailZh: "" };
  }
  if (order.status !== "paid") {
    const dPay = daysBetweenIso(asOf, order.payDate);
    return {
      id: "created_unpaid",
      stageZh: "已创设·待支付",
      detailZh:
        dPay > 0
          ? `计划付款 ${order.payDate}（还有 ${dPay} 天）`
          : `付款日 ${order.payDate}`,
    };
  }
  const dLive = daysBetweenIso(asOf, order.goLiveDate);
  if (dLive > 0) {
    const sincePay = Math.max(0, daysBetweenIso(order.payDate, asOf));
    const stageName = goLiveStageAtDay(stages, Math.max(1, sincePay));
    return {
      id: "paid_prelive",
      stageZh: `已支付·投产前·${stageName}`,
      detailZh: `投产日 ${order.goLiveDate}（还有 ${dLive} 天）`,
    };
  }
  return {
    id: "live",
    stageZh: "已投产/在运",
    detailZh: `投产日 ${order.goLiveDate}`,
  };
}

/** 横轴节点：付款 → 各段 → 投产上路（与漏斗同口径） */
type GoLiveAxisPointId = "pay" | GoLiveStageId | "live";

/** 实盘每日跟踪：各阶段应采集的信息槽（对齐身份补录 + 滴滴状态） */
const GO_LIVE_DAILY_COLLECT: Record<GoLiveAxisPointId, string[]> = {
  pay: ["合同/PO", "付款凭证与到账日", "VIN/NIV 清单", "电池 SN 清单", "台数与 SKU"],
  ocean: ["提单号 B/L", "船名航次", "ETD / ETA", "柜号", "在途异常"],
  customs: ["报关单号", "完税凭证", "放行日", "关税/VAT 实缴"],
  pdi: ["车牌", "上牌日", "GPS IMEI", "PDI 通过", "入库仓"],
  match: [
    "司机 ID",
    "滴滴审核状态",
    "customizedCarId",
    "上架日",
    "模式 DAE/LTO",
  ],
  live: ["首单/首收日", "在营状态", "当日订单/流水", "异常停运"],
};

type GoLiveAxisPos = {
  pointId: GoLiveAxisPointId;
  nameZh: string;
  /** 0–100，沿「付款→投产」横轴位置 */
  pct: number;
  collectZh: string[];
};

function goLiveAxisPosition(
  stages: GoLiveStage[],
  day: number,
): GoLiveAxisPos {
  const total = goLiveTotalDays(stages);
  if (day <= 0) {
    return {
      pointId: "pay",
      nameZh: "付款",
      pct: 0,
      collectZh: GO_LIVE_DAILY_COLLECT.pay,
    };
  }
  if (total <= 0 || day >= total) {
    return {
      pointId: "live",
      nameZh: "投产",
      pct: 100,
      collectZh: GO_LIVE_DAILY_COLLECT.live,
    };
  }
  let t = 0;
  for (const s of stages) {
    t += s.days;
    if (day <= t) {
      return {
        pointId: s.id,
        nameZh: s.nameZh,
        pct: (day / total) * 100,
        collectZh: GO_LIVE_DAILY_COLLECT[s.id],
      };
    }
  }
  return {
    pointId: "live",
    nameZh: "投产",
    pct: 100,
    collectZh: GO_LIVE_DAILY_COLLECT.live,
  };
}

/** 已投资批次：按付款日起算日跟踪（实盘运营底表雏形） */
type InvestedBatchTrack = {
  id: string;
  label: string;
  payDate: string;
  qty: number;
  cardId: string;
  /** 付款日起第几天；0=付款当天。实盘可按日历自动滚动 */
  dayCursor: number;
  noteZh?: string;
};

const DEFAULT_BATCH_TRACKS: InvestedBatchTrack[] = [
  {
    id: "batch-es-y1",
    label: "埃安ES·首批",
    payDate: "2026-03-01",
    qty: 50,
    cardId: "aion-es-dae",
    dayCursor: 28,
    noteZh: "示意批次：拖动日游标模拟每日跟踪",
  },
  {
    id: "batch-ut-y1",
    label: "埃安UT·LTO批",
    payDate: "2026-04-15",
    qty: 30,
    cardId: "aion-ut-lto",
    dayCursor: 12,
    noteZh: "示意批次：清关/整备段重点采报关与上牌",
  },
];

type OpsFunnelStep = {
  id: string;
  nameZh: string;
  days: number;
  passRate: number;
  /** 进入本节点台数 */
  enterQty: number;
  /** 离开本节点台数 */
  exitQty: number;
  dropQty: number;
  cumDays: number;
  noteZh: string;
};

/** 资产投产漏斗：付款购置 → 各阶段 → 投产可经营 */
function buildOpsFunnel(args: {
  startQty: number;
  stages: GoLiveStage[];
  customsPass: number;
  pdiPass: number;
  matchPass: number;
}): OpsFunnelStep[] {
  const n0 = Math.max(0, args.startQty);
  const passOf = (id: GoLiveStageId): number => {
    if (id === "ocean") return 1;
    if (id === "customs")
      return Math.max(0.5, Math.min(1, args.customsPass ?? 0.98));
    if (id === "pdi") return Math.max(0.5, Math.min(1, args.pdiPass ?? 0.97));
    return Math.max(0.4, Math.min(1, args.matchPass ?? 0.92));
  };
  const steps: OpsFunnelStep[] = [
    {
      id: "pay",
      nameZh: "付款购置",
      days: 0,
      passRate: 1,
      enterQty: n0,
      exitQty: n0,
      dropQty: 0,
      cumDays: 0,
      noteZh: "资金落地；资产尚未产生收入",
    },
  ];
  let qty = n0;
  let cum = 0;
  for (const s of args.stages) {
    const enter = qty;
    const pass = passOf(s.id);
    const exit = Math.round(enter * pass * 10) / 10;
    const drop = Math.round((enter - exit) * 10) / 10;
    cum += s.days;
    steps.push({
      id: s.id,
      nameZh: s.nameZh,
      days: s.days,
      passRate: pass,
      enterQty: enter,
      exitQty: exit,
      dropQty: drop,
      cumDays: cum,
      noteZh: s.whyZh,
    });
    qty = exit;
  }
  steps.push({
    id: "live",
    nameZh: "投产出收入",
    days: 0,
    passRate: 1,
    enterQty: qty,
    exitQty: qty,
    dropQty: 0,
    cumDays: cum,
    noteZh: "开始计入经营流入；其后才是组合爬坡到达产",
  });
  return steps;
}

/** 达产负荷：资产卡固有爬坡 × 管理能力缩短 */
function rampLoadAtAge(
  age: number,
  rampYears: number,
  startLoad: number,
  mgmt: number,
) {
  if (age < 1) return 0;
  const m = Math.max(0, Math.min(1, mgmt));
  const effRamp = Math.max(1, rampYears * (1.35 - 0.5 * m));
  const start = Math.max(0.05, Math.min(1, startLoad));
  if (age >= effRamp) return 1;
  if (effRamp <= 1) return 1;
  return Math.min(1, start + ((1 - start) * (age - 1)) / (effRamp - 1));
}

/** 情景系数：固有带宽 ×（资源越差振幅越大） */
function scenarioFactorOf(
  band: number,
  readiness: number,
  scenario: CashflowScenario,
) {
  const r = Math.max(0, Math.min(1, readiness));
  const amp = Math.max(0, band) * (1.25 - 0.5 * r);
  if (scenario === "down") return Math.max(0.4, 1 - amp);
  if (scenario === "up") return 1 + amp;
  return 1;
}


const FENBANG_DAE_COHORT = {
  "sourceZh": "《DAE-200台含IRR》内部收益率IRR测算 F31:BS31",
  "fxUsdMxn": 17.522,
  "unitPurchaseMxn": 473800,
  "irrMonthly": 0.03947902,
  "irrExcelStyleAnn": 0.473748,
  "irrCompoundAnn": 0.591434,
  "excelReportedIrr": 0.473748,
  "cfMonths": 84,
  "cfSumKUsd": 10674.348,
  "deployTotalUnits": 200,
  "deployCapexTotalKUsd": 5678.461,
  "vintages": [
    {
      "ym": "2026-10",
      "labelZh": "26-10",
      "units": 10,
      "capexKUsd": 283.923,
      "incomeTotalKUsd": 2692.581,
      "yearStacks": [
        {
          "year": 1,
          "labelZh": "第1年",
          "kUsd": 454.61
        },
        {
          "year": 2,
          "labelZh": "第2年",
          "kUsd": 559.493
        },
        {
          "year": 3,
          "labelZh": "第3年",
          "kUsd": 559.493
        },
        {
          "year": 4,
          "labelZh": "第4年",
          "kUsd": 559.493
        },
        {
          "year": 5,
          "labelZh": "第5年",
          "kUsd": 559.493
        }
      ]
    },
    {
      "ym": "2026-11",
      "labelZh": "26-11",
      "units": 20,
      "capexKUsd": 567.846,
      "incomeTotalKUsd": 5459.124,
      "yearStacks": [
        {
          "year": 1,
          "labelZh": "第1年",
          "kUsd": 975.428
        },
        {
          "year": 2,
          "labelZh": "第2年",
          "kUsd": 1118.985
        },
        {
          "year": 3,
          "labelZh": "第3年",
          "kUsd": 1118.985
        },
        {
          "year": 4,
          "labelZh": "第4年",
          "kUsd": 1118.985
        },
        {
          "year": 5,
          "labelZh": "第5年",
          "kUsd": 1126.739
        }
      ]
    },
    {
      "ym": "2026-12",
      "labelZh": "26-12",
      "units": 20,
      "capexKUsd": 567.846,
      "incomeTotalKUsd": 5520.596,
      "yearStacks": [
        {
          "year": 1,
          "labelZh": "第1年",
          "kUsd": 1019.567
        },
        {
          "year": 2,
          "labelZh": "第2年",
          "kUsd": 1118.985
        },
        {
          "year": 3,
          "labelZh": "第3年",
          "kUsd": 1118.985
        },
        {
          "year": 4,
          "labelZh": "第4年",
          "kUsd": 1118.985
        },
        {
          "year": 5,
          "labelZh": "第5年",
          "kUsd": 1144.072
        }
      ]
    },
    {
      "ym": "2027-01",
      "labelZh": "27-01",
      "units": 40,
      "capexKUsd": 1135.692,
      "incomeTotalKUsd": 11133.446,
      "yearStacks": [
        {
          "year": 1,
          "labelZh": "第1年",
          "kUsd": 2092.102
        },
        {
          "year": 2,
          "labelZh": "第2年",
          "kUsd": 2237.971
        },
        {
          "year": 3,
          "labelZh": "第3年",
          "kUsd": 2237.971
        },
        {
          "year": 4,
          "labelZh": "第4年",
          "kUsd": 2237.971
        },
        {
          "year": 5,
          "labelZh": "第5年",
          "kUsd": 2327.432
        }
      ]
    },
    {
      "ym": "2027-02",
      "labelZh": "27-02",
      "units": 50,
      "capexKUsd": 1419.615,
      "incomeTotalKUsd": 14124.308,
      "yearStacks": [
        {
          "year": 1,
          "labelZh": "第1年",
          "kUsd": 2688.692
        },
        {
          "year": 2,
          "labelZh": "第2年",
          "kUsd": 2797.463
        },
        {
          "year": 3,
          "labelZh": "第3年",
          "kUsd": 2797.463
        },
        {
          "year": 4,
          "labelZh": "第4年",
          "kUsd": 2797.463
        },
        {
          "year": 5,
          "labelZh": "第5年",
          "kUsd": 3043.226
        }
      ]
    },
    {
      "ym": "2027-03",
      "labelZh": "27-03",
      "units": 60,
      "capexKUsd": 1703.538,
      "incomeTotalKUsd": 17388.431,
      "yearStacks": [
        {
          "year": 1,
          "labelZh": "第1年",
          "kUsd": 3297.368
        },
        {
          "year": 2,
          "labelZh": "第2年",
          "kUsd": 3356.956
        },
        {
          "year": 3,
          "labelZh": "第3年",
          "kUsd": 3356.956
        },
        {
          "year": 4,
          "labelZh": "第4年",
          "kUsd": 3356.956
        },
        {
          "year": 5,
          "labelZh": "第5年",
          "kUsd": 4020.195
        }
      ]
    }
  ],
  "monthlyHead": [
    {
      "ym": "2026-10",
      "labelZh": "26-10",
      "deploy": 10,
      "fleet": 10,
      "capexKUsd": 283.923,
      "incomeKUsd": 13.52,
      "cfKUsd": -327.393
    },
    {
      "ym": "2026-11",
      "labelZh": "26-11",
      "deploy": 20,
      "fleet": 30,
      "capexKUsd": 567.846,
      "incomeKUsd": 73.665,
      "cfKUsd": -647.979
    },
    {
      "ym": "2026-12",
      "labelZh": "26-12",
      "deploy": 20,
      "fleet": 50,
      "capexKUsd": 567.846,
      "incomeKUsd": 166.913,
      "cfKUsd": -653.226
    },
    {
      "ym": "2027-01",
      "labelZh": "27-01",
      "deploy": 40,
      "fleet": 90,
      "capexKUsd": 1135.692,
      "incomeKUsd": 287.203,
      "cfKUsd": -1188.492
    },
    {
      "ym": "2027-02",
      "labelZh": "27-02",
      "deploy": 50,
      "fleet": 140,
      "capexKUsd": 1419.615,
      "incomeKUsd": 487.22,
      "cfKUsd": -1487.131
    },
    {
      "ym": "2027-03",
      "labelZh": "27-03",
      "deploy": 60,
      "fleet": 200,
      "capexKUsd": 1703.538,
      "incomeKUsd": 733.862,
      "cfKUsd": -1727.848
    },
    {
      "ym": "2027-04",
      "labelZh": "27-04",
      "deploy": 0,
      "fleet": 200,
      "capexKUsd": 0,
      "incomeKUsd": 932.488,
      "cfKUsd": 114.092
    },
    {
      "ym": "2027-05",
      "labelZh": "27-05",
      "deploy": 0,
      "fleet": 200,
      "capexKUsd": 0,
      "incomeKUsd": 932.488,
      "cfKUsd": 408.562
    },
    {
      "ym": "2027-06",
      "labelZh": "27-06",
      "deploy": 0,
      "fleet": 200,
      "capexKUsd": 0,
      "incomeKUsd": 932.488,
      "cfKUsd": 380.711
    },
    {
      "ym": "2027-07",
      "labelZh": "27-07",
      "deploy": 0,
      "fleet": 200,
      "capexKUsd": 0,
      "incomeKUsd": 932.488,
      "cfKUsd": 366.785
    },
    {
      "ym": "2027-08",
      "labelZh": "27-08",
      "deploy": 0,
      "fleet": 200,
      "capexKUsd": 0,
      "incomeKUsd": 932.488,
      "cfKUsd": 352.86
    },
    {
      "ym": "2027-09",
      "labelZh": "27-09",
      "deploy": 0,
      "fleet": 200,
      "capexKUsd": 0,
      "incomeKUsd": 932.488,
      "cfKUsd": 422.487
    }
  ]
} as const;


/** 案例表稳态月：经营净额 / 毛收入（满产后 deploy=0 的月） */
function fenbangSteadyNetToGrossRatio(): number {
  const steady = FENBANG_DAE_COHORT.monthlyHead.filter((r) => r.deploy === 0);
  let inc = 0;
  let cf = 0;
  for (const r of steady) {
    inc += r.incomeKUsd;
    cf += r.cfKUsd;
  }
  if (!(inc > 0)) return 0.36;
  return Math.max(0.05, Math.min(0.95, cf / inc));
}

function fenbangFmtKUsd(v: number): string {
  const a = Math.abs(v);
  if (a >= 1000) return `${(v / 1000).toFixed(1)}M`;
  return `${Math.round(v)}`;
}

/**
 * 案例表投放批次：
 * 左柱=期初采购；右柱=投产后第1–5年净现金流堆叠（毛收入×稳态净/毛比）。
 * 虚线=采购额：右柱累计越过虚线≈该批静态回本。
 */
function FenbangDeployRecoverChart() {
  const theme = useHostTheme();
  const data = FENBANG_DAE_COHORT;
  const vintages = data.vintages;
  if (!vintages.length) return null;
  const netRatio = fenbangSteadyNetToGrossRatio();
  const rows = vintages.map((v) => {
    const netStacks = v.yearStacks.map((ys) => ({
      year: ys.year,
      labelZh: ys.labelZh,
      kUsd: ys.kUsd * netRatio,
    }));
    const netTotal = netStacks.reduce((s, x) => s + x.kUsd, 0);
    let cum = 0;
    let paybackYear: number | null = null;
    for (const ys of netStacks) {
      cum += ys.kUsd;
      if (paybackYear == null && cum >= v.capexKUsd) paybackYear = ys.year;
    }
    return { ...v, netStacks, netTotal, paybackYear };
  });
  const yearColors = [
    theme.fill.primary,
    theme.fill.secondary,
    theme.fill.tertiary,
    theme.fill.quaternary,
    theme.stroke.secondary,
  ];
  const capexColor = theme.text.primary;
  const maxH = Math.max(
    1,
    ...rows.map((v) => Math.max(v.capexKUsd, v.netTotal)),
  );
  const plotH = 200;
  const barW = 18;
  const gap = 10;
  const pairGap = 36;
  const labelH = 40;
  const padTop = 14;
  const padLeft = 8;
  const n = rows.length;
  const pairW = barW * 2 + gap;
  const width = padLeft * 2 + n * pairW + (n - 1) * pairGap;
  const height = padTop + plotH + labelH;
  const yScale = (v: number) => (Math.max(0, v) / maxH) * plotH;

  return (
    <Stack gap={10}>
      <Row gap={10} align="center" wrap>
        <Text size="small" tone="secondary">
          月度投放 & 净现金流回收（按投放批次）· kUSD
        </Text>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, background: capexColor }} />
          <Text size="small" tone="tertiary">
            投放（采购）
          </Text>
        </span>
        {[1, 2, 3, 4, 5].map((y) => (
          <span
            key={y}
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                background: yearColors[(y - 1) % yearColors.length],
              }}
            />
            <Text size="small" tone="tertiary">
              第{y}年净CF
            </Text>
          </span>
        ))}
      </Row>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        style={{ maxWidth: 720, display: "block" }}
        role="img"
        aria-label="投放与分年净现金流对照"
      >
        {rows.map((v, i) => {
          const x0 = padLeft + i * (pairW + pairGap);
          const baseY = padTop + plotH;
          const capH = yScale(v.capexKUsd);
          const netH = yScale(v.netTotal);
          const rx = x0 + barW + gap;
          let yCursor = baseY;
          return (
            <g key={v.ym}>
              <rect
                x={x0}
                y={baseY - capH}
                width={barW}
                height={capH}
                fill={capexColor}
              />
              <text
                x={x0 + barW / 2}
                y={baseY - capH - 4}
                textAnchor="middle"
                fill={theme.text.tertiary}
                fontSize={9}
              >
                {fenbangFmtKUsd(v.capexKUsd)}
              </text>
              {v.netStacks.map((ys) => {
                const h = yScale(ys.kUsd);
                yCursor -= h;
                return (
                  <rect
                    key={ys.year}
                    x={rx}
                    y={yCursor}
                    width={barW}
                    height={h}
                    fill={yearColors[(ys.year - 1) % yearColors.length]}
                  />
                );
              })}
              <line
                x1={rx - 2}
                x2={rx + barW + 2}
                y1={baseY - capH}
                y2={baseY - capH}
                stroke={theme.stroke.primary}
                strokeWidth={1}
                strokeDasharray="3 2"
              />
              <text
                x={rx + barW / 2}
                y={baseY - netH - 4}
                textAnchor="middle"
                fill={theme.text.tertiary}
                fontSize={9}
              >
                {fenbangFmtKUsd(v.netTotal)}
              </text>
              <text
                x={x0 + pairW / 2}
                y={baseY + 14}
                textAnchor="middle"
                fill={theme.text.secondary}
                fontSize={10}
              >
                {v.labelZh}
              </text>
              <text
                x={x0 + pairW / 2}
                y={baseY + 26}
                textAnchor="middle"
                fill={theme.text.tertiary}
                fontSize={9}
              >
                {v.units}台 ·{" "}
                {v.paybackYear != null
                  ? `约Y${v.paybackYear}回本`
                  : "5年内未回本"}
              </text>
            </g>
          );
        })}
      </svg>
      <Text size="small" tone="tertiary">
        左柱=该月采购投放；右柱=该批次投产后第1–5年净现金流堆叠（案例分年毛收入 ×
        稳态净/毛比 {pct(netRatio, 0)}，稳态月取自下方表 deploy=0 的
        cf÷income）。虚线=采购额：右柱累计越过虚线≈该批静态回本（已扣司机/电费等经营成本口径，与毛收入堆叠不同）。
      </Text>
      <Text size="small" tone="tertiary">
        信源：{data.sourceZh} · 投放 {data.deployTotalUnits} 台 · 采购合计{" "}
        {data.deployCapexTotalKUsd.toFixed(0)} kUSD · 5 年批净合计约{" "}
        {fenbangFmtKUsd(rows.reduce((s, r) => s + r.netTotal, 0))}
      </Text>
    </Stack>
  );
}


function irr(cashflows: number[]): number | null {
  if (cashflows.length < 2) return null;
  let r = 0.1;
  for (let i = 0; i < 80; i++) {
    let npv = 0;
    let d = 0;
    for (let t = 0; t < cashflows.length; t++) {
      const denom = Math.pow(1 + r, t);
      npv += cashflows[t] / denom;
      if (t > 0) d -= (t * cashflows[t]) / Math.pow(1 + r, t + 1);
    }
    if (Math.abs(d) < 1e-12) break;
    const next = r - npv / d;
    if (!Number.isFinite(next)) return null;
    if (Math.abs(next - r) < 1e-8) return next;
    r = next;
  }
  return Number.isFinite(r) ? r : null;
}

/** 月度现金流折现率：年化 → 月率 */
function monthDiscountRate(annualRate: number) {
  const a = Math.max(0, annualRate);
  return Math.pow(1 + a, 1 / 12) - 1;
}

/** 路径 NPV（月度序列，按年化折现） */
function npvAnnualOnMonths(cashflows: number[], annualRate: number): number {
  const rMo = monthDiscountRate(annualRate);
  let s = 0;
  for (let t = 0; t < cashflows.length; t++) {
    s += cashflows[t]! / Math.pow(1 + rMo, t);
  }
  return s;
}

/**
 * 静态回收期（月）：累计净现金流首次 ≥0 的期序（1-based）；
 * 含期初负投入与空窗，与路径条一致。
 */
function staticPaybackPeriod(cashflows: number[]): {
  months: number | null;
  index: number;
} {
  let cum = 0;
  for (let i = 0; i < cashflows.length; i++) {
    cum += cashflows[i]!;
    if (cum >= 0) return { months: i + 1, index: i };
  }
  return { months: null, index: -1 };
}

/**
 * 动态回收期（月）：折现后累计首次 ≥0 的期序（1-based）。
 */
function dynamicPaybackPeriod(
  cashflows: number[],
  annualRate: number,
): { months: number | null; index: number } {
  const rMo = monthDiscountRate(annualRate);
  let cum = 0;
  for (let i = 0; i < cashflows.length; i++) {
    cum += cashflows[i]! / Math.pow(1 + rMo, i);
    if (cum >= 0) return { months: i + 1, index: i };
  }
  return { months: null, index: -1 };
}

/** 单位路径回报基准折现（与 NPV / 动态回本一致） */
const UNIT_CF_DISCOUNT_ANN = 0.08;

function unitNpvTipZh(opts: {
  annualRate: number;
  pathMonths: number;
  opsYears: number;
}) {
  const rAnn = Math.round(opts.annualRate * 1000) / 10;
  const rMo =
    Math.round((Math.pow(1 + opts.annualRate, 1 / 12) - 1) * 1e6) / 1e6;
  return [
    `NPV（年化 ${rAnn}%）= Σ_{t=0…T} CF_t / (1+r_月)^t`,
    `r_月 = (1+${rAnn}%)^(1/12)−1 ≈ ${rMo}`,
    `CF_t：单车第 t 期净现金流（t=0 起含期初购置/保证金/空窗）`,
    `T+1 = ${opts.pathMonths} 期（经营约 ${opts.opsYears} 年·按月折现累加，非「第5年末折一次」）`,
  ].join("\n");
}

function buildModel(
  p: Premise,
  nodes: InvestmentNode[],
  cards: VehicleCard[] = DEFAULT_VEHICLE_CARDS,
): {
  rows: YearRow[];
  assets: {
    id: string;
    name: string;
    spv: string;
    units: number;
    unitCostUsd: number;
    totalCostUsd: number;
    bodyShare: number;
    batteryShare: number;
    acctLife: number;
    physLife: number;
    maintLife: number;
    activeLife: number;
    residualRate: number;
    residualUsd: number;
    model: string;
    fields: { k: string; v: string }[];
  }[];
  relatedAnnual: number;
  equityOutlay: number;
  totals: {
    revenue: number;
    varCost: number;
    fixedCost: number;
    contribution: number;
    afterSiteFixed: number;
    netIncome: number;
    cashFlow: number;
    ebitda: number;
    depreciation: number;
    hqAlloc: number;
    endBook: number;
    endResidual: number;
    totalCapex: number;
  };
  cashIrr: number | null;
  /** 全自有资金假设下的无杠杆 IRR（资本层关闭或对照） */
  unleveredIrr: number | null;
  accountingRoi: number;
  capitalPlan: {
    includeDebt: boolean;
    lines: {
      key: InvestAsset;
      nameZh: string;
      units: number;
      unitCapex: number;
      totalCapex: number;
      financePct: number;
      financeRate: number;
      financeYears: number;
      debt: number;
      equity: number;
    }[];
    totalDebt: number;
    totalEquity: number;
    totalCapex: number;
  };
  schedule: {
    year: number;
    stationGuns: number;
    daeUnits: number;
    ltoUnits: number;
    rtoUnits: number;
    labels: string[];
  }[];
} {
  const fx = p.usdMxn;
  const yrs = Math.max(3, Math.min(12, Math.round(p.years)));
  const catalog = (cards.length ? cards : DEFAULT_VEHICLE_CARDS).map(
    normalizeCard,
  );
  const findCard = (node: InvestmentNode) => {
    const id = node.cardId || defaultCardId(node.asset);
    const mapped =
      id === "dae-aion-es"
        ? "aion-es-dae"
        : id === "lto-aion-ut"
          ? "aion-ut-lto"
          : id;
    return (
      catalog.find((c) => c.id === mapped || c.id === id) ||
      catalog.find((c) => modeToAsset(c.mode) === node.asset) ||
      catalog[0]
    );
  };
  const daeCardRaw =
    catalog.find((c) => c.mode === "DAE") || DEFAULT_VEHICLE_CARDS[0]!;
  const ltoCardRaw =
    catalog.find((c) => c.mode === "LTO") || DEFAULT_VEHICLE_CARDS[1]!;
  const rtoCardRaw =
    catalog.find((c) => c.mode === "RTO") || DEFAULT_VEHICLE_CARDS[2]!;
  const scenario = (p.cashflowScenario ?? "base") as CashflowScenario;
  const daeCard = applyScenarioToVehicleCard(daeCardRaw, scenario);
  const ltoCard = applyScenarioToVehicleCard(ltoCardRaw, scenario);
  const rtoCard = applyScenarioToVehicleCard(rtoCardRaw, scenario);
  const stScKnob = STATION_SCENARIO_KNOBS[scenario];

  const activeNodes = nodes.filter((n) => n.enabled && n.quantity > 0);

  const totalGuns = activeNodes
    .filter((n) => n.asset === "station")
    .reduce((s, n) => s + n.quantity, 0);
  const totalDae = activeNodes
    .filter((n) => n.asset === "dae")
    .reduce((s, n) => s + n.quantity, 0);
  const totalLto = activeNodes
    .filter((n) => n.asset === "lto")
    .reduce((s, n) => s + n.quantity, 0);
  const totalRto = activeNodes
    .filter((n) => n.asset === "rto")
    .reduce((s, n) => s + n.quantity, 0);

  const daeRef = Math.max(totalDae, 1);
  const ltoRef = Math.max(totalLto + totalRto, 1);

  const vehicleUnitUsd = (node: InvestmentNode) => {
    const card = findCard(node);
    return mxnToUsd(vehicleUnitMxn(card, node.discountRate ?? 0), fx);
  };

  // —— 单位成本（车辆：标价×(1−折扣)+落地皮费；场站仍按枪）——
  const stationTotalCapex = mxnToUsd(
    p.chargerCapexMxn + p.stationFitoutMxn,
    fx,
  );
  const stationDeposit = mxnToUsd(p.stationDepositMxn, fx);
  const costPerGun = stationTotalCapex / Math.max(p.chargerGuns, 1);

  let daeFleet = 0;
  let ltoFleet = 0;
  let rtoFleet = 0;
  for (const n of activeNodes) {
    if (n.asset === "dae") daeFleet += vehicleUnitUsd(n) * n.quantity;
    if (n.asset === "lto") ltoFleet += vehicleUnitUsd(n) * n.quantity;
    if (n.asset === "rto") rtoFleet += vehicleUnitUsd(n) * n.quantity;
  }
  const daeUnitCost = totalDae > 0 ? daeFleet / totalDae : mxnToUsd(vehicleUnitMxn(daeCard, 0), fx);
  const ltoUnitCost = totalLto > 0 ? ltoFleet / totalLto : mxnToUsd(vehicleUnitMxn(ltoCard, 0), fx);
  const rtoUnitCost = totalRto > 0 ? rtoFleet / totalRto : mxnToUsd(vehicleUnitMxn(rtoCard, 0), fx);
  const chargerCost = costPerGun * totalGuns;

  const cardLife = (card: VehicleCard) => {
    if (p.residualMode === "physical") return card.physYears;
    if (p.residualMode === "maintenance") return card.maintYears;
    return card.acctYears;
  };
  const cardResR = (card: VehicleCard) => {
    if (p.residualMode === "physical")
      return Math.max(0, Math.min(1, card.physResidualRate ?? 0));
    if (p.residualMode === "maintenance")
      return Math.max(0, Math.min(1, card.maintResidualRate ?? 0));
    return Math.max(0, Math.min(1, card.residualRate ?? 0));
  };

  const cLife = lifeYears(p, "charger");
  const dLife = cardLife(daeCard);
  const lLife = cardLife(ltoCard);
  const cResR = residualRate(p, "charger");
  const dResR = cardResR(daeCard);
  const lResR = cardResR(ltoCard);

  const daeSoftMxn = softCostSumMxn(daeCard);
  const ltoSoftMxn = softCostSumMxn(ltoCard);

  const assets = [
    {
      id: "charger-station-1",
      name: "场站充电单元",
      spv: "场站项目公司",
      units: totalGuns,
      unitCostUsd: costPerGun,
      totalCostUsd: chargerCost,
      bodyShare: 1,
      batteryShare: 0,
      acctLife: p.chargerAcctYears,
      physLife: p.chargerPhysYears,
      maintLife: p.chargerMaintYears,
      activeLife: cLife,
      residualRate: cResR,
      residualUsd: chargerCost * cResR,
      model: `${p.powerKw}kW×枪 · 由投资节点汇总`,
      fields: [
        { k: "资产类型", v: "充电桩+装修一次性购置" },
        { k: "计划枪数", v: `${totalGuns}枪` },
        {
          k: "单枪建设成本",
          v: `${(costPerGun * fx).toFixed(2)} / ${costPerGun.toFixed(2)}`,
        },
        {
          k: "会计/物理/维保年限",
          v: `${p.chargerAcctYears}/${p.chargerPhysYears}/${p.chargerMaintYears}`,
        },
      ],
    },
    {
      id: daeCard.id,
      name: `${daeCard.nameZh}·DAE车队`,
      spv: "车辆项目公司",
      units: totalDae,
      unitCostUsd: daeUnitCost,
      totalCostUsd: daeFleet,
      bodyShare: daeCard.bodyShare,
      batteryShare: daeCard.batteryShare,
      acctLife: daeCard.acctYears,
      physLife: daeCard.physYears,
      maintLife: daeCard.maintYears,
      activeLife: dLife,
      residualRate: dResR,
      residualUsd: daeFleet * dResR,
      model: daeCard.model,
      fields: [
        { k: "资产卡", v: vehicleCardTitleZh(daeCard) },
        { k: "模式", v: OP_MODE_LABEL[daeCard.mode] },
        { k: "计划台数", v: `${totalDae}台（投资节点合计）` },
        {
          k: "标价（折扣前）",
          v: `${daeCard.listPriceMxn.toLocaleString()} MXN`,
        },
        {
          k: "落地皮费合计",
          v: `${daeSoftMxn.toLocaleString()} MXN`,
        },
        {
          k: "平均单车落地成本",
          v: `${(daeUnitCost * fx).toFixed(0)} MXN / ${daeUnitCost.toFixed(0)} USD`,
        },
        { k: "IPH", v: `${daeCard.iphMxn} MXN/h` },
      ],
    },
    {
      id: ltoCard.id,
      name: `${ltoCard.nameZh}·LTO车队`,
      spv: "车辆项目公司",
      units: totalLto,
      unitCostUsd: ltoUnitCost,
      totalCostUsd: ltoFleet,
      bodyShare: ltoCard.bodyShare,
      batteryShare: ltoCard.batteryShare,
      acctLife: ltoCard.acctYears,
      physLife: ltoCard.physYears,
      maintLife: ltoCard.maintYears,
      activeLife: lLife,
      residualRate: lResR,
      residualUsd: ltoFleet * lResR,
      model: ltoCard.model,
      fields: [
        { k: "资产卡", v: vehicleCardTitleZh(ltoCard) },
        { k: "模式", v: OP_MODE_LABEL[ltoCard.mode] },
        { k: "计划台数", v: `${totalLto}台（投资节点合计）` },
        {
          k: "标价（折扣前）",
          v: `${ltoCard.listPriceMxn.toLocaleString()} MXN`,
        },
        {
          k: "落地皮费合计",
          v: `${ltoSoftMxn.toLocaleString()} MXN`,
        },
        {
          k: "平均单车落地成本",
          v: `${(ltoUnitCost * fx).toFixed(0)} MXN / ${ltoUnitCost.toFixed(0)} USD`,
        },
        {
          k: "月租金·出租率",
          v: `${ltoCard.rentMonthMxn} MXN · ${Math.round(ltoCard.occupancy * 100)}%`,
        },
      ],
    },
    {
      id: rtoCard.id,
      name: `${rtoCard.nameZh}·RTO车队`,
      spv: "车辆项目公司",
      units: totalRto,
      unitCostUsd: rtoUnitCost,
      totalCostUsd: rtoFleet,
      bodyShare: rtoCard.bodyShare,
      batteryShare: rtoCard.batteryShare,
      acctLife: rtoCard.acctYears,
      physLife: rtoCard.physYears,
      maintLife: rtoCard.maintYears,
      activeLife: cardLife(rtoCard),
      residualRate: cardResR(rtoCard),
      residualUsd: rtoFleet * cardResR(rtoCard),
      model: rtoCard.model,
      fields: [
        { k: "资产卡", v: vehicleCardTitleZh(rtoCard) },
        { k: "模式", v: OP_MODE_LABEL[rtoCard.mode] },
        { k: "计划台数", v: `${totalRto}台（资产单元合计）` },
        {
          k: "标价（折扣前）",
          v: `${rtoCard.listPriceMxn.toLocaleString()} MXN`,
        },
        {
          k: "月租金·出租率",
          v: `${rtoCard.rentMonthMxn} MXN · ${Math.round(rtoCard.occupancy * 100)}%`,
        },
      ],
    },
  ];

  // 按年汇总投资节点
  const schedule = Array.from({ length: yrs }, (_, i) => {
    const year = i + 1;
    const yearNodes = activeNodes.filter((n) => n.year === year);
    return {
      year,
      stationGuns: yearNodes
        .filter((n) => n.asset === "station")
        .reduce((s, n) => s + n.quantity, 0),
      daeUnits: yearNodes
        .filter((n) => n.asset === "dae")
        .reduce((s, n) => s + n.quantity, 0),
      ltoUnits: yearNodes
        .filter((n) => n.asset === "lto")
        .reduce((s, n) => s + n.quantity, 0),
      rtoUnits: yearNodes
        .filter((n) => n.asset === "rto")
        .reduce((s, n) => s + n.quantity, 0),
      labels: yearNodes.map((n) => n.label),
    };
  });

  // 单位经济（单枪/单车/月，MXN）——场站率用来自情景常量包
  const gunKwhFull = p.powerKw * 24 * 30;
  const extKwh = gunKwhFull * stScKnob.externalUtil;
  const intKwh = gunKwhFull * stScKnob.internalUtil;
  const extRevGun = extKwh * stScKnob.externalPriceMxn;
  const intRevGun = intKwh * stScKnob.internalPriceMxn;
  const elecGun = (extKwh + intKwh) * p.lossFactor * stScKnob.elecCostMxn;
  const xiaojufen = extRevGun * stScKnob.xiaojufenPct;
  const payFee = extRevGun * p.payFeePct * (1 + p.vat);
  const varPerGun = elecGun + xiaojufen + payFee;

  const daeMonthGross =
    daeCard.iphMxn *
    daeCard.hoursDay *
    daeCard.daysWeek *
    (52 / 12) *
    daeCard.util *
    Math.max(1, daeCard.shiftsPerDay || 1);
  const daeMonthSubsidy = daeMonthGross * daeCard.subsidyPct;
  const daeMonthKm = 350 * daeCard.daysWeek * (52 / 12) * daeCard.util;
  const daeMonthKwh = (daeMonthKm / 100) * daeCard.kwhPer100;
  const daeChargeInternalShare = p.relatedEnabled ? p.priorityChargePct : 0;
  const daeElecMxn = DAE_SCENARIO_KNOBS[scenario].elecMxn;
  const daeChargeCost =
    daeMonthKwh *
    (daeChargeInternalShare * stScKnob.internalPriceMxn +
      (1 - daeChargeInternalShare) * daeElecMxn);
  const daeMonthOpexOne =
    daeCard.insuranceYrMxn / 12 +
    daeCard.maintMxn +
    daeCard.softMxn +
    daeCard.wearYrMxn / 12 +
    daeChargeCost +
    daeDriverMonthMxn(daeCard) +
    (daeCard.parkingMxn ?? 0) +
    (p.relatedEnabled ? p.relatedParkingMxn : 0);

  const ltoMonthRent =
    ltoCard.rentMonthMxn * ltoCard.occupancy * (1 - ltoCard.badDebt);
  const ltoMonthKm = 175 * 6 * (52 / 12) * ltoCard.occupancy;
  const ltoMonthKwh = (ltoMonthKm / 100) * ltoCard.kwhPer100;
  const ltoInternalKwh = p.relatedEnabled
    ? ltoMonthKwh * p.priorityChargePct
    : 0;
  const ltoMonthOpexOne =
    ltoCard.insuranceYrMxn / 12 + ltoCard.softMxn;

  const rtoMonthRent =
    rtoCard.rentMonthMxn * rtoCard.occupancy * (1 - rtoCard.badDebt);
  const rtoMonthKm = 175 * 6 * (52 / 12) * rtoCard.occupancy;
  const rtoMonthKwh = (rtoMonthKm / 100) * rtoCard.kwhPer100;
  const rtoInternalKwh = p.relatedEnabled
    ? rtoMonthKwh * p.priorityChargePct
    : 0;
  const rtoMonthOpexOne =
    rtoCard.insuranceYrMxn / 12 + rtoCard.softMxn;

  const hqFullAnnualUsd = mxnToUsd((p.hqMonthMxn ?? 640_891) * 12, fx);
  // 对齐原表：投放初期全额计入管理报表；稳定期按 hqSteadyPct（默认25%）
  const hqCostForYear = (y: number) => {
    if (!p.includeHq) return 0;
    const share = y <= 1 ? 1 : (p.hqSteadyPct ?? 0.25);
    return hqFullAnnualUsd * share;
  };

  // —— 资本配置（对应资产：充电桩 / DAE / LTO）——
  const useDebt = p.includeDebt !== false;
  const stFinPct = useDebt ? (p.stationFinancePct ?? 0.85) : 0;
  const stFinRate = p.stationFinanceRate ?? 0.14;
  const stFinYears = Math.max(1, Math.round(p.stationFinanceYears ?? 3));
  const daeFinPct = useDebt ? p.daeFinancePct : 0;
  const daeFinRate = p.daeFinanceRate;
  const daeFinYears = Math.max(1, Math.round(p.daeFinanceYears));
  const ltoFinPct = useDebt ? p.ltoFinancePct : 0;
  const ltoFinRate = p.ltoFinanceRate;
  const ltoFinYears = Math.max(1, Math.round(p.ltoFinanceYears));

  // 权益投入：各投资节点权益部分（1−融资比例）+ 场站押金
  let equityOutlay = stationDeposit;
  let totalAssetCapex = 0;
  for (const n of activeNodes) {
    if (n.asset === "station") {
      const c = costPerGun * n.quantity;
      totalAssetCapex += c;
      equityOutlay += c * (1 - stFinPct);
    } else if (n.asset === "dae") {
      const c = vehicleUnitUsd(n) * n.quantity;
      totalAssetCapex += c;
      equityOutlay += c * (1 - daeFinPct);
    } else if (n.asset === "rto") {
      const c = vehicleUnitUsd(n) * n.quantity;
      totalAssetCapex += c;
      equityOutlay += c * (1 - ltoFinPct); // RTO 暂共用 LTO 资本条款，可在资本配置拆分
    } else {
      const c = vehicleUnitUsd(n) * n.quantity;
      totalAssetCapex += c;
      equityOutlay += c * (1 - ltoFinPct);
    }
  }
  const fullEquityOutlay = stationDeposit + totalAssetCapex;

  const capitalPlan = {
    includeDebt: useDebt,
    lines: [
      {
        key: "station" as InvestAsset,
        nameZh: "充电桩",
        units: totalGuns,
        unitCapex: costPerGun,
        totalCapex: costPerGun * totalGuns,
        financePct: stFinPct,
        financeRate: stFinRate,
        financeYears: stFinYears,
        debt: costPerGun * totalGuns * stFinPct,
        equity: costPerGun * totalGuns * (1 - stFinPct),
      },
      {
        key: "dae" as InvestAsset,
        nameZh: daeCard.nameZh,
        units: totalDae,
        unitCapex: daeUnitCost,
        totalCapex: daeFleet,
        financePct: daeFinPct,
        financeRate: daeFinRate,
        financeYears: daeFinYears,
        debt: daeFleet * daeFinPct,
        equity: daeFleet * (1 - daeFinPct),
      },
      {
        key: "lto" as InvestAsset,
        nameZh: ltoCard.nameZh,
        units: totalLto,
        unitCapex: ltoUnitCost,
        totalCapex: ltoFleet,
        financePct: ltoFinPct,
        financeRate: ltoFinRate,
        financeYears: ltoFinYears,
        debt: ltoFleet * ltoFinPct,
        equity: ltoFleet * (1 - ltoFinPct),
      },
      {
        key: "rto" as InvestAsset,
        nameZh: `${rtoCard.nameZh}·RTO`,
        units: totalRto,
        unitCapex: rtoUnitCost,
        totalCapex: rtoFleet,
        financePct: ltoFinPct,
        financeRate: ltoFinRate,
        financeYears: ltoFinYears,
        debt: rtoFleet * ltoFinPct,
        equity: rtoFleet * (1 - ltoFinPct),
      },
    ].filter((l) => l.units > 0),
    totalDebt:
      costPerGun * totalGuns * stFinPct +
      daeFleet * daeFinPct +
      ltoFleet * ltoFinPct +
      rtoFleet * ltoFinPct,
    totalEquity: equityOutlay,
    totalCapex: totalAssetCapex + stationDeposit,
  };

  // 分年折旧基数：按投放节点实际落地成本入账
  type Vintage = { year: number; cost: number; life: number; resR: number };
  const vintages: Vintage[] = [];
  for (const n of activeNodes) {
    if (n.asset === "station") {
      vintages.push({
        year: n.year,
        cost: costPerGun * n.quantity,
        life: cLife,
        resR: cResR,
      });
    } else if (n.asset === "dae") {
      vintages.push({
        year: n.year,
        cost: vehicleUnitUsd(n) * n.quantity,
        life: dLife,
        resR: dResR,
      });
    } else if (n.asset === "rto") {
      vintages.push({
        year: n.year,
        cost: vehicleUnitUsd(n) * n.quantity,
        life: cardLife(rtoCard),
        resR: cardResR(rtoCard),
      });
    } else {
      vintages.push({
        year: n.year,
        cost: vehicleUnitUsd(n) * n.quantity,
        life: lLife,
        resR: lResR,
      });
    }
  }

  const rows: YearRow[] = [];
  let gunsOnline = 0;
  let daeOnline = 0;
  let ltoOnline = 0;
  let rtoOnline = 0;
  let bookValue = 0;
  let loanSt = 0;
  let loanDae = 0;
  let loanLto = 0;
  let loanRto = 0;
  let cumNi = 0;
  let cumulativeCF = 0;
  let cash = equityOutlay; // 期初注入权益
  let stationBuilt = false;

  const relatedAnnualMxn =
    (daeMonthKwh * daeChargeInternalShare * daeRef +
      (ltoInternalKwh * Math.max(totalLto, 1) +
        rtoInternalKwh * Math.max(totalRto, 1)) /
        Math.max(totalLto + totalRto, 1) *
        ltoRef) *
    p.internalPriceMxn *
    12;

  for (let y = 1; y <= yrs; y++) {
    const sch = schedule[y - 1];
    const openingCash = cash;

    // —— 本年投资（Capex 与资本层借款分开；车辆按节点折扣+皮费）——
    let stationCapex = 0;
    let vehicleCapex = 0;
    let financingInStation = 0;
    let financingInDae = 0;
    let financingInLto = 0;
    let stationBookAdd = 0;
    const yearNodes = activeNodes.filter((n) => n.year === y);
    for (const n of yearNodes) {
      if (n.asset === "station") {
        const gunCost = costPerGun * n.quantity;
        stationCapex += gunCost;
        stationBookAdd += gunCost;
        if (!stationBuilt) {
          stationCapex += stationDeposit;
          stationBuilt = true;
        }
        financingInStation += gunCost * stFinPct;
      } else if (n.asset === "dae") {
        const c = vehicleUnitUsd(n) * n.quantity;
        vehicleCapex += c;
        financingInDae += c * daeFinPct;
      } else {
        const c = vehicleUnitUsd(n) * n.quantity;
        vehicleCapex += c;
        financingInLto += c * ltoFinPct;
      }
    }
    const financingIn =
      financingInStation + financingInDae + financingInLto;
    const capex = stationCapex + vehicleCapex;
    loanSt += financingInStation;
    loanDae += financingInDae;
    loanLto += financingInLto;

    gunsOnline += sch.stationGuns;
    daeOnline += sch.daeUnits;
    ltoOnline += sch.ltoUnits;
    rtoOnline += sch.rtoUnits ?? 0;
    bookValue += stationBookAdd + vehicleCapex;

    // —— 运营（稳态规模 × 达产负荷；情景已写入单位常量）——
    const mgmt = p.mgmtCapability ?? 0.7;

    const blendLoad = (asset: InvestAsset, cardRampY: number, start: number) => {
      let w = 0;
      let q = 0;
      for (const n of activeNodes) {
        if (n.asset !== asset || n.year > y) continue;
        const age = y - n.year + 1;
        const load = rampLoadAtAge(age, cardRampY, start, mgmt);
        w += load * n.quantity;
        q += n.quantity;
      }
      return q > 0 ? w / q : 1;
    };

    const daeRamp = blendLoad(
      "dae",
      daeCard.rampYears ?? 2,
      daeCard.rampStartLoad ?? 0.55,
    );
    const ltoRamp = blendLoad(
      "lto",
      ltoCard.rampYears ?? 2,
      ltoCard.rampStartLoad ?? 0.6,
    );
    const rtoRamp = blendLoad(
      "rto",
      rtoCard.rampYears ?? 2,
      rtoCard.rampStartLoad ?? 0.5,
    );
    const stRamp = blendLoad(
      "station",
      p.stationRampYears ?? 2,
      p.stationRampStartLoad ?? 0.5,
    );

    const daeFactor = daeRamp;
    const ltoFactor = ltoRamp;
    const rtoFactor = rtoRamp;
    const stFactor = stRamp;

    const fleetQ = daeOnline + ltoOnline + rtoOnline + gunsOnline;
    const rampLoad =
      fleetQ > 0
        ? (daeRamp * daeOnline +
            ltoRamp * ltoOnline +
            rtoRamp * rtoOnline +
            stRamp * gunsOnline) /
          fleetQ
        : 1;
    /** 情景已写入单位常量（applyScenario*），此处不再二次乘倍率 */
    const scenarioFactor = scenarioCashMul(scenario);

    const daeRevSteady = mxnToUsd(
      (daeMonthGross + daeMonthSubsidy) * 12 * daeOnline,
      fx,
    );
    const ltoRevSteady = mxnToUsd(ltoMonthRent * 12 * ltoOnline, fx);
    const rtoRevSteady = mxnToUsd(rtoMonthRent * 12 * rtoOnline, fx);

    const stationExtSteady = mxnToUsd(gunsOnline * extRevGun * 12, fx);
    const stationIntUtilSteady = mxnToUsd(gunsOnline * intRevGun * 12, fx);
    const relatedChargeFromVehicles = mxnToUsd(
      (daeMonthKwh * daeChargeInternalShare * daeOnline +
        ltoInternalKwh * ltoOnline +
        rtoInternalKwh * rtoOnline) *
        p.internalPriceMxn *
        12,
      fx,
    );
    const stationIntSteady = p.relatedEnabled
      ? Math.max(stationIntUtilSteady, relatedChargeFromVehicles)
      : stationIntUtilSteady;
    const stationPark = mxnToUsd(
      (p.parkingRentMxn * (gunsOnline > 0 ? 1 : 0) +
        (p.relatedEnabled ? p.relatedParkingMxn * daeOnline : 0)) *
        12,
      fx,
    );
    const stationAnc = mxnToUsd(
      p.ancillaryMxn * 12 * (y >= 2 && gunsOnline > 0 ? 1 : 0),
      fx,
    );

    const daeRev = daeRevSteady * daeFactor;
    const ltoRev = ltoRevSteady * ltoFactor;
    const rtoRev = rtoRevSteady * rtoFactor;
    let stationRev =
      (stationExtSteady + stationIntSteady) * stFactor +
      stationPark +
      stationAnc;
    let relatedCharge = stationIntSteady * stFactor;
    let eliminated = 0;

    // 可变成本：随达产部分爬坡；保险等半固定
    const daeOpexSteady = mxnToUsd(daeMonthOpexOne * 12 * daeOnline, fx);
    const ltoOpexSteady = mxnToUsd(ltoMonthOpexOne * 12 * ltoOnline, fx);
    const rtoOpexSteady = mxnToUsd(rtoMonthOpexOne * 12 * rtoOnline, fx);
    const stationVarSteady = mxnToUsd(gunsOnline * varPerGun * 12, fx);
    const daeOpex = daeOpexSteady * (0.35 + 0.65 * daeFactor);
    const ltoOpex = ltoOpexSteady * (0.45 + 0.55 * ltoFactor);
    const rtoOpex = rtoOpexSteady * (0.45 + 0.55 * rtoFactor);
    const stationVar = stationVarSteady * (0.4 + 0.6 * stFactor);
    const stationFixed = mxnToUsd(
      (gunsOnline > 0 ? p.stationRentMxn + p.opexStationMxn : 0) * 12,
      fx,
    );

    if (p.eliminateInternal && p.relatedEnabled) {
      const vehicleInternalCharge = relatedChargeFromVehicles * Math.min(daeFactor, ltoFactor || daeFactor);
      const elim = Math.min(relatedCharge, vehicleInternalCharge);
      stationRev -= elim;
      eliminated = elim;
    }

    const vehicleRev = daeRev + ltoRev + rtoRev;
    const steadyRevenue =
      daeRevSteady +
      ltoRevSteady +
      rtoRevSteady +
      stationExtSteady +
      stationIntSteady +
      stationPark +
      stationAnc;
    const revenue = stationRev + vehicleRev;

    // 折旧：各 vintage 自投放年起直线
    let dep = 0;
    for (const v of vintages) {
      const age = y - v.year + 1;
      if (age >= 1 && age <= v.life) {
        dep += (v.cost * (1 - v.resR)) / Math.max(v.life, 1);
      }
    }

    // —— 资本层：按资产配置计息与到期还本 ——
    const interestStation = loanSt * stFinRate;
    const interestDae = loanDae * daeFinRate;
    const interestLto = loanLto * ltoFinRate;
    const interest = interestStation + interestDae + interestLto;

    let financingOutStation = 0;
    let financingOutDae = 0;
    let financingOutLto = 0;
    for (const n of activeNodes) {
      if (n.asset === "station" && y === n.year + stFinYears - 1) {
        financingOutStation += costPerGun * n.quantity * stFinPct;
      }
      if (n.asset === "dae" && y === n.year + daeFinYears - 1) {
        financingOutDae += vehicleUnitUsd(n) * n.quantity * daeFinPct;
      }
      if (n.asset === "lto" && y === n.year + ltoFinYears - 1) {
        financingOutLto += vehicleUnitUsd(n) * n.quantity * ltoFinPct;
      }
      if (n.asset === "rto" && y === n.year + ltoFinYears - 1) {
        financingOutLto += vehicleUnitUsd(n) * n.quantity * ltoFinPct;
      }
    }
    financingOutStation = Math.min(financingOutStation, loanSt);
    financingOutDae = Math.min(financingOutDae, loanDae);
    financingOutLto = Math.min(financingOutLto, loanLto);
    loanSt -= financingOutStation;
    loanDae -= financingOutDae;
    loanLto -= financingOutLto;
    const financingOut =
      financingOutStation + financingOutDae + financingOutLto;

    // —— 成本分层 ——
    // 可变：随枪/车规模（电费佣金、司机、充电、维保保险等）
    let varCost = stationVar + daeOpex + ltoOpex + rtoOpex;
    // 固定：场站租金+运维（开站即发生，不随单车边际）
    const fixedCost = stationFixed;
    const hqAlloc =
      gunsOnline + daeOnline + ltoOnline + rtoOnline > 0
        ? hqCostForYear(y)
        : 0;

    if (p.eliminateInternal && p.relatedEnabled) {
      varCost -= eliminated; // 内部充电在合并口径从可变成本抵消
    }

    const contribution = revenue - varCost;
    const afterSiteFixed = contribution - fixedCost;
    let opex = varCost + fixedCost + hqAlloc;

    const ebitda = revenue - opex; // = afterSiteFixed - hqAlloc
    const ebit = ebitda - dep;
    // 残值：vintage 到期年回收
    let residualIn = 0;
    for (const v of vintages) {
      if (y === v.year + v.life - 1) {
        residualIn += v.cost * v.resR;
      }
    }

    const interestIncome = Math.max(0, cash) * p.depositRate;
    const unleveredPretax = ebit + interestIncome;
    const unleveredTax =
      unleveredPretax > 0 ? unleveredPretax * p.cit : 0;
    const unleveredNi = unleveredPretax - unleveredTax;
    const pretax = ebit - interest + interestIncome;
    const tax = pretax > 0 ? pretax * p.cit : 0;
    const netIncome = pretax - tax;
    cumNi += netIncome;

    const hqOnRevenue = revenue > 0 ? hqAlloc / revenue : 0;
    const hqOnContribution = contribution > 0 ? hqAlloc / contribution : 0;

    const operatingCF = netIncome + dep + interestIncome;
    const unleveredOpCf = unleveredNi + dep + interestIncome;
    const cashFlow =
      operatingCF - capex + financingIn - financingOut + residualIn;
    cumulativeCF += cashFlow;
    cash = openingCash + cashFlow;

    bookValue = Math.max(0, bookValue - dep);
    // 残值回收时减少账面
    bookValue = Math.max(0, bookValue - residualIn);

    const rLife = cardLife(rtoCard);
    const rResR = cardResR(rtoCard);
    const marketResidual =
      gunsOnline * costPerGun * Math.max(cResR, 1 - ((1 - cResR) * Math.min(y, cLife)) / cLife) +
      daeOnline * daeUnitCost * Math.max(dResR, 1 - ((1 - dResR) * Math.min(y, dLife)) / dLife) +
      ltoOnline * ltoUnitCost * Math.max(lResR, 1 - ((1 - lResR) * Math.min(y, lLife)) / lLife) +
      rtoOnline * rtoUnitCost * Math.max(rResR, 1 - ((1 - rResR) * Math.min(y, rLife)) / rLife);

    rows.push({
      year: y,
      label: `${PLAN_BASE_YEAR + y - 1}年`,
      gunsOnline,
      daeOnline,
      ltoOnline,
      bookValue,
      marketResidual,
      revenue,
      varCost,
      fixedCost,
      contribution,
      afterSiteFixed,
      rampLoad,
      scenarioFactor,
      steadyRevenue,
      opex,
      hqAlloc,
      hqOnRevenue,
      hqOnContribution,
      depreciation: dep,
      interest,
      interestIncome,
      ebitda,
      ebit,
      pretax,
      tax,
      netIncome,
      unleveredNi,
      financingInStation,
      financingInDae,
      financingInLto,
      financingOutStation,
      financingOutDae,
      financingOutLto,
      interestStation,
      interestDae,
      interestLto,
      loanBalStation: loanSt,
      loanBalDae: loanDae,
      loanBalLto: loanLto,
      openingCash,
      operatingCF,
      unleveredOpCf,
      stationCapex,
      vehicleCapex,
      capex,
      financingIn,
      financingOut,
      residualIn,
      cashFlow,
      cumulativeCF,
      closingCash: cash,
      stationRev,
      vehicleRev,
      relatedCharge,
      eliminated,
      nodeLabels: sch.labels,
    });
  }

  const cfSeries = [-equityOutlay, ...rows.map((r) => r.cashFlow)];
  const cashIrr = irr(cfSeries);
  const unleveredCfSeries = [
    -fullEquityOutlay,
    ...rows.map((r) => r.unleveredOpCf - r.capex + r.residualIn),
  ];
  const unleveredIrr = irr(unleveredCfSeries);
  const totals = {
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
    varCost: rows.reduce((s, r) => s + r.varCost, 0),
    fixedCost: rows.reduce((s, r) => s + r.fixedCost, 0),
    contribution: rows.reduce((s, r) => s + r.contribution, 0),
    afterSiteFixed: rows.reduce((s, r) => s + r.afterSiteFixed, 0),
    netIncome: rows.reduce((s, r) => s + r.netIncome, 0),
    cashFlow: rows.reduce((s, r) => s + r.cashFlow, 0),
    ebitda: rows.reduce((s, r) => s + r.ebitda, 0),
    depreciation: rows.reduce((s, r) => s + r.depreciation, 0),
    hqAlloc: rows.reduce((s, r) => s + r.hqAlloc, 0),
    endBook: rows[rows.length - 1]?.bookValue ?? 0,
    endResidual: rows[rows.length - 1]?.marketResidual ?? 0,
    totalCapex: rows.reduce((s, r) => s + r.capex, 0),
  };
  const accountingRoi = equityOutlay > 0 ? totals.netIncome / equityOutlay : 0;

  return {
    rows,
    assets,
    relatedAnnual: mxnToUsd(relatedAnnualMxn, fx),
    equityOutlay,
    totals,
    cashIrr,
    unleveredIrr,
    accountingRoi,
    capitalPlan,
    schedule,
  };
}

function fmt(n: number, digits = 0) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-CN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function pct(n: number | null, digits = 1) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

type Currency = "MXN" | "USD";

/** 引擎金额为实际 USD → 按币种输出展示数值（USD 原值或折 MXN） */
function toDisplay(usd: number, fx: number, ccy: Currency): number {
  if (!Number.isFinite(usd)) return NaN;
  return ccy === "USD" ? usd : usd * fx;
}

function money(
  usd: number,
  fx: number,
  ccy: Currency,
  digits = 0,
): string {
  const v = toDisplay(usd, fx, ccy);
  if (!Number.isFinite(v)) return "—";
  const d =
    digits > 0
      ? digits
      : Math.abs(v) >= 1000
        ? 0
        : Math.abs(v) >= 1
          ? 2
          : 4;
  return fmt(v, d);
}

/** MXN 原值按展示币种格式化为数字；单位由表头/指标名标注，默认不跟在数字后 */
function moneyMxn(
  mxn: number,
  fx: number,
  ccy: Currency,
  digits = 0,
  withUnit = false,
): string {
  if (!Number.isFinite(mxn)) return "—";
  if (ccy === "MXN") {
    const s = fmt(mxn, digits);
    return withUnit ? `${s} MXN` : s;
  }
  const usd = mxn / fx;
  const d = digits > 0 ? digits : usd >= 1000 ? 0 : 2;
  const s = fmt(usd, d);
  return withUnit ? `${s} USD` : s;
}

function ccyUnit(ccy: Currency): string {
  return ccy === "USD" ? "USD" : "MXN";
}

function ccyLabel(ccy: Currency): string {
  return ccy === "USD" ? "USD" : "MXN";
}

/** 图表统一中性色（黑白灰）；多系列靠图例区分 */
const CHART_BW = "neutral" as const;

/** 中文优先字体栈：避免侧栏窄屏缺字形/挤叠；勿对汉字用负字距 */
const FONT_UI =
  '"PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", "Segoe UI", system-ui, -apple-system, sans-serif';

/**
 * 正文/标题自适应字号。
 * 侧栏常见 360–520px：下限略抬高，保证汉字可读；统一允许断行。
 */
const TYPE = {
  title: {
    fontFamily: FONT_UI,
    fontSize: "clamp(1.05rem, 0.98rem + 0.35vw, 1.28rem)",
    lineHeight: 1.4,
    letterSpacing: "normal" as const,
  },
  h2: {
    fontFamily: FONT_UI,
    fontSize: "clamp(1.05rem, 1rem + 0.35vw, 1.32rem)",
    lineHeight: 1.35,
    letterSpacing: "normal" as const,
    margin: 0,
  },
  h3: {
    fontFamily: FONT_UI,
    fontSize: "clamp(0.95rem, 0.92rem + 0.2vw, 1.08rem)",
    lineHeight: 1.4,
    margin: 0,
  },
  body: {
    fontFamily: FONT_UI,
    fontSize: "clamp(0.9rem, 0.86rem + 0.18vw, 0.98rem)",
    lineHeight: 1.55,
    overflowWrap: "break-word" as const,
  },
  caption: {
    fontFamily: FONT_UI,
    fontSize: "clamp(0.8rem, 0.78rem + 0.12vw, 0.88rem)",
    lineHeight: 1.5,
    overflowWrap: "break-word" as const,
  },
  label: {
    fontFamily: FONT_UI,
    fontSize: "clamp(0.75rem, 0.73rem + 0.1vw, 0.82rem)",
    lineHeight: 1.45,
    letterSpacing: "normal" as const,
    overflowWrap: "break-word" as const,
  },
} as const;

/** SVG 内文字：跟 TYPE 同一套 clamp，避免图内写死 10/11/12px 与通篇脱节 */
const SVG_TYPE = {
  body: {
    fontFamily: FONT_UI,
    fontSize: TYPE.body.fontSize,
  },
  caption: {
    fontFamily: FONT_UI,
    fontSize: TYPE.caption.fontSize,
  },
  label: {
    fontFamily: FONT_UI,
    fontSize: TYPE.label.fontSize,
  },
  strong: {
    fontFamily: FONT_UI,
    fontSize: TYPE.body.fontSize,
    fontWeight: 600 as const,
  },
} as const;

/** 指标条：窄屏自动折行，避免 3–5 列硬挤成乱码式截断 */
const GRID_STATS = "repeat(auto-fit, minmax(148px, 1fr))";
/** 瀑布配置卡（三档分配 + 费率/车队成本）：宽屏横排，窄屏折行 */
const GRID_SPV_TIERS = "repeat(auto-fit, minmax(220px, 1fr))";
/** 卡内数字录入：两列紧凑 */
const GRID_TIER_FIELDS =
  "repeat(auto-fit, minmax(min(100%, 160px), 1fr))";
/** 卡片/对照块 */
const GRID_CARDS = "repeat(auto-fit, minmax(220px, 1fr))";
/** 双栏表单 */
const GRID_FORM = "repeat(auto-fit, minmax(200px, 1fr))";

/** Cursor 式页面标题：短标题 + 一行说明 */
function PageIntro({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <Stack gap={6}>
      <H2 style={TYPE.h2}>{title}</H2>
      {description ? (
        <Text tone="secondary" style={TYPE.body}>
          {description}
        </Text>
      ) : null}
    </Stack>
  );
}

function NumField({
  label,
  value,
  onChange,
  hint,
  tip,
  tipId,
  /** 底层按 MXN 存储；有 displayCcy 时输入框直接显示/编辑当前币种 */
  mxnFx,
  displayCcy,
  /** 瀑布配置卡内：矮录入、不铺满宽脚注 */
  compact,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
  /** 悬停/点击查看的口径说明 */
  tip?: string;
  tipId?: string;
  mxnFx?: number;
  displayCcy?: Currency;
  compact?: boolean;
}) {
  const theme = useHostTheme();
  const showUsd =
    mxnFx != null && displayCcy === "USD" && Number.isFinite(mxnFx) && mxnFx > 0;
  const displayValue = showUsd ? value / mxnFx! : value;
  const displayDigits = showUsd
    ? value >= 10_000
      ? 1
      : 2
    : undefined;
  const shown = Number.isFinite(displayValue)
    ? displayDigits != null
      ? String(
          Number(
            displayValue.toFixed(
              displayValue >= 1000 ? Math.min(displayDigits, 1) : displayDigits,
            ),
          ),
        )
      : String(value)
    : "";

  let foot: string | null = null;
  if (!compact && mxnFx != null && Number.isFinite(value) && displayCcy) {
    foot = showUsd
      ? `底层 ${fmt(value, 0)} MXN · FX ${mxnFx}`
      : `当前 MXN · ≈ ${fmt(value / mxnFx, value >= 1000 ? 1 : 2)} USD`;
  }

  /** compact：旁注并入悬停，避免占行 */
  const tipMerged =
    tip && compact && hint ? `${tip}\n旁注：${hint}` : tip || undefined;
  const showHintBelow = hint && !(compact && tip);

  return (
    <Stack gap={compact ? 2 : 4} style={{ minWidth: 0 }}>
      {tipMerged ? (
        <TipLabel
          id={tipId || `nf-${label}`}
          label={label}
          tip={tipMerged}
        />
      ) : (
        <Text tone="secondary" style={TYPE.label}>
          {label}
        </Text>
      )}
      <TextInput
        type="number"
        value={shown}
        onChange={(v) => {
          const n = Number(v);
          if (!Number.isFinite(n)) return;
          if (showUsd) onChange(n * mxnFx!);
          else onChange(n);
        }}
      />
      {(foot || showHintBelow) && (
        <Text style={mergeStyle(TYPE.caption, { color: theme.text.tertiary })}>
          {[foot, showHintBelow ? hint : null].filter(Boolean).join(" · ")}
        </Text>
      )}
    </Stack>
  );
}

/** 表单字段标签：统一小号字重，避免与 Stat/正文抢层级 */
function FieldLabel({ children }: { children: string }) {
  return (
    <Text tone="secondary" style={TYPE.label}>
      {children}
    </Text>
  );
}

/**
 * 因子名 + 悬停/点击解释（title 原生悬停；点击展开完整说明，再点收起）。
 */
function TipLabel(props: {
  id: string;
  label: string;
  tip: string;
}) {
  const theme = useHostTheme();
  const [openId, setOpenId] = useCanvasState<string>("cf-factor-tip-open", "");
  const open = openId === props.id;
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        maxWidth: "100%",
      }}
    >
      <span
        title={props.tip.replace(/\n+/g, " · ")}
        role="button"
        onClick={() => setOpenId(open ? "" : props.id)}
        style={{
          cursor: "help",
          borderBottom: `1px dotted ${theme.stroke.primary}`,
        }}
      >
        <Text tone="secondary" style={TYPE.label}>
          {props.label}
        </Text>
      </span>
      {open ? (
        <div
          style={{
            position: "absolute",
            zIndex: 40,
            top: "120%",
            left: 0,
            width: 320,
            maxWidth: "78vw",
            padding: "8px 10px",
            background: theme.bg.elevated,
            border: `1px solid ${theme.stroke.primary}`,
            borderRadius: 6,
          }}
          onClick={() => setOpenId("")}
        >
          <Text size="small" style={{ whiteSpace: "pre-wrap" }}>
            {props.tip}
          </Text>
          <Text size="small" tone="tertiary">
            再点收起
          </Text>
        </div>
      ) : null}
    </span>
  );
}

/** 核算因子说明（悬停/点击） */
const CF_FACTOR_TIPS = {
  paymentFee:
    "通道费%：占乘客实付，从车费先扣。DAE 默认 0（IPH=车队净应收）；填非 0 时 IPH 作毛流水正向拆账，车队实收=(1-通道%)×(1-平台%)。",
  platformTake:
    "平台抽成%：占扣完通道费后的剩余池。DAE 默认 0；填非 0 时按毛流水拆账，瀑布与公司实收同步变化。",
  chargeDay:
    "充电成本：车队侧电费。可按日/周预付/月预付/年预付；瀑布折日扣。DAE 关联案例=里程×电耗×电价。",
  chargeCycle:
    "充电预付周期：按日=日均电费；按周/月/年=合同或场站账单周期。选周期后填该周期金额，瀑布统一折日扣。",
  chargeAmount:
    "充电金额：所选周期的电费总额（底层 MXN）。关联案例按电耗×电价；手改后为手动口径。日额≈周期额÷周期内营运日。",
  annualMaint:
    "固定成本年合计：保险（年）+ 计划保养/软件GPS/车位（月×12）。不含易损（在可变·变动）。折旧在估值页。总开关只控这四项。",
  fixInsurance:
    "保险（固定成本）：车队车辆年保费。短期内不随里程/单量变化。",
  fixMaint:
    "计划保养（阶梯固定）：区间内近似固定，跨里程/频次阈值跃升；界面按月包示意。勿与「易损件」（元/万km）混淆；关分项开关则不进年合计。",
  fixSoft:
    "软件/GPS（固定成本）：车队软件与定位月费，短期内不随运营量变。",
  fixParking:
    "车位（固定成本）：停车位月租。DAE 默认计入；直租/租买通常不计车队侧车位。",
  fixWear:
    "易损件（变动成本）：按 MXN/万公里计价，月额=月营运里程/10000×单价（胎+刹+悬）。与计划保养不同。",
  randomMaint:
    "易损月期望：由「元/万km」×当月里程得到；关易损开关则为 0。",
  horizon:
    "路径月数由模式默认（DAE=60，LTO/RTO=会计寿命封顶60），界面不再手改。",
  investorPi:
    "优先投资（融资条款，非运营成本）：本息与还款安排。本金=落地×比例；按年化与还本规则摊日扣。保证金按 N 个月本息锁定账面资金，不可动用，期末退还。",
  principalPct:
    "本金比例：借款本金占单车含税落地成本的比例（LTV）。例 85% 表示优先档按落地价 85% 计息还本。",
  annualRate:
    "年化利息：优先本金的合同年利率。月利率≈年化/12，用于免本付息、等额本息/本金的月供测算。",
  tenureMonths:
    "期限（月）：还本付息总期数。只还息月数须小于期限；摊还占用剩余月份。",
  graceMonths:
    "免本期（月·旧字段）：前 N 个月零还款。已由「只还息月数+期初前置」替代；旧数据自动迁移。",
  interestOnlyMonths:
    "只还息月数：期内不还本，按当月 opening balance × 月利率付息。期初=前 N 月；期末=最后 N 月（末月含气球还本）。",
  interestOnlyTiming:
    "只还息位置：期初前置=放款后先付息后摊还；期末后置=先摊还、临近到期 N 个月只付息+末月还本。",
  depositMonths:
    "保证金（月本息）：按稳态月供×月数锁定给优先投资的账面资金，经营期不可动用；期初计入投入、融资期末退还。填 0 关闭。",
  debtRule:
    "还本付息规则：等额本息=每月固定月供；等额本金=每月还固定本金+递减利息；期内只还息=期内仅付息、本金期末处理（单位路径示意）。",
  graceInterest:
    "免本期内仍付息（旧字段）：等同期初只还息；建议改用「只还息月数」。",
  driverWage:
    "司机雇佣（半变动）：全职=底薪预留+提成覆盖；合作=车队侧不预留。全职默认关联案例表。",
  wageCycle:
    "预留周期：录入按月/周/日；瀑布统一折成日扣。",
  wageAmount:
    "底薪预留（半变动·固定部分）：所选周期（月/周/日）的保底工资预留额。关联案例=单人月薪×班次×利用率×(日工时/9.5h)；折日后进瀑布。手改后不再跟工时联动。",
  wageCover:
    "提成覆盖%（半变动·变动部分）：在底薪之外，按收入/订单侧应付司机成本再预留的覆盖比例（100%=全覆盖示意）。调高抬升半变动司机成本。",
  otherOpex:
    "半变动日额（过路/临停等）：有固定日额基数，随营运日发生。",
  varCostCard:
    "可变成本模块：变动（充电/易损/抽成/通道费）· 半变动（司机、过路）。总开关关闭后整组不进路径；字段仍可编辑。",
  fixedCostCard:
    "固定成本模块：不随量变（保险/软件GPS/车位）+ 阶梯固定（计划保养）+ 酌量性固定（激励/占池）。折旧在资产估值·残值。",
  fleetCostCard:
    "已拆到「可变成本 / 固定成本 / 优先投资」三模块。",
  varPct:
    "占剩余池%：补贴额 = 当日剩余池 × 本%。剩余池 = 进车队应收 − 优先本息 − 司机预留。关分项则不扣。",
  varDay:
    "日定额（半变动）：过路/临停等，按营运日固定 MXN 扣减。关分项或日额=0 则未计。",
  tollDay:
    "过路/临停日额（半变动）：按营运日出车定额（MXN/日），随天数发生；非按里程公式。关开关或日额=0→未进瀑布。",
  tripBonus:
    "冲单补贴：开单后从「债服/司机扣完后的剩余池」再抽一笔。填占剩余池%（如 2%）；开关应改变②固定成本年合计，不应动①可变成本。",
  incentivePool:
    "冲单类补贴：按分项开关分别计入；与过路日额互不影响。",
  discretionary:
    "酌量·冲单补贴：开了才扣。按剩余池%计；开/关应改变②固定成本右上角年合计。",
  wageDriverRow:
    "司机（半变动）：全职=底薪预留+提成覆盖折日进瀑布；合作=车队侧不预留底薪（成本在司机侧）。",
  varSection:
    "1.1 变动：随里程/流水近似正比例变化——通道费、平台抽成、充电、易损件。",
  semiVarSection:
    "1.2 半变动：有固定基数但随营运日/雇佣形态变化——司机全职底薪+提成覆盖、过路/临停日额。",
  stepFixedSection:
    "2.2 阶梯固定：区间内近似固定，跨阈值跃升——计划保养月包；勿与易损件（元/万km）混淆。",
} as const;

/** 「待填」占位不进输入框，留给 placeholder */
function pendingBlank(v: string | undefined | null) {
  return isPlaceholderMajorField(v ?? undefined) ? "" : String(v || "");
}

/** 年限步进：− / 值 / +，受上限约束 */
function YearStepper({
  label,
  value,
  onChange,
  min = 1,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max: number;
  hint?: string;
}) {
  const v = Math.max(min, Math.min(max, Math.round(value) || min));
  return (
    <Stack gap={4}>
      <FieldLabel>{label}</FieldLabel>
      <Row gap={6} align="center">
        <IconButton
          title="减少一年"
          size="sm"
          variant="circle"
          disabled={v <= min}
          onClick={() => onChange(v - 1)}
        >
          −
        </IconButton>
        <Text
          weight="medium"
          style={mergeStyle(TYPE.h3, {
            minWidth: 64,
            textAlign: "center" as const,
            flex: "0 0 auto",
          })}
        >
          {v} 年
        </Text>
        <IconButton
          title="增加一年"
          size="sm"
          variant="circle"
          disabled={v >= max}
          onClick={() => onChange(v + 1)}
        >
          +
        </IconButton>
      </Row>
      {hint ? (
        <Text tone="tertiary" style={TYPE.caption}>
          {hint}
        </Text>
      ) : null}
    </Stack>
  );
}

/** 残值率步进（百分点）：− / 值% / +，0–100 可配 */
function PercentStepper({
  label,
  valuePct,
  onChangePct,
  step = 1,
  hint,
}: {
  label: string;
  /** 0–100 */
  valuePct: number;
  onChangePct: (pct: number) => void;
  step?: number;
  hint?: string;
}) {
  const v = Math.max(
    0,
    Math.min(100, Math.round((Number.isFinite(valuePct) ? valuePct : 0) * 10) / 10),
  );
  return (
    <Stack gap={4}>
      <FieldLabel>{label}</FieldLabel>
      <Row gap={6} align="center">
        <IconButton
          title="减少"
          size="sm"
          variant="circle"
          disabled={v <= 0}
          onClick={() => onChangePct(Math.max(0, Math.round((v - step) * 10) / 10))}
        >
          −
        </IconButton>
        <Text
          weight="medium"
          style={mergeStyle(TYPE.h3, {
            minWidth: 64,
            textAlign: "center" as const,
            flex: "0 0 auto",
          })}
        >
          {v % 1 === 0 ? `${v}` : v.toFixed(1)}%
        </Text>
        <IconButton
          title="增加"
          size="sm"
          variant="circle"
          disabled={v >= 100}
          onClick={() => onChangePct(Math.min(100, Math.round((v + step) * 10) / 10))}
        >
          +
        </IconButton>
      </Row>
      {hint ? (
        <Text tone="tertiary" style={TYPE.caption}>
          {hint}
        </Text>
      ) : null}
    </Stack>
  );
}

/** 时序图：在图上左右拖拽 / 触控板横滑 / Shift+滚轮 → 平移窗口 */
function CfAxisPanSurface({
  start,
  maxStart,
  onStartChange,
  stepPx = 36,
  children,
}: {
  start: number;
  maxStart: number;
  onStartChange: (n: number) => void;
  stepPx?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children?: any;
}) {
  const theme = useHostTheme();
  const clamp = (n: number) =>
    Math.max(0, Math.min(maxStart, Math.round(n)));
  return (
    <div
      role="presentation"
      title="按住左右拖动，或触控板左右滑动"
      style={mergeStyle({
        cursor: maxStart > 0 ? "grab" : "default",
        touchAction: "pan-y",
        userSelect: "none",
        border: `1px solid ${theme.stroke.tertiary}`,
        background: theme.bg.elevated,
        padding: "4px 4px 2px",
      })}
      onPointerDown={(e) => {
        if (maxStart <= 0) return;
        if (e.button !== 0) return;
        const el = e.currentTarget;
        el.style.cursor = "grabbing";
        const originX = e.clientX;
        const originStart = start;
        const pid = e.pointerId;
        try {
          el.setPointerCapture(pid);
        } catch {
          /* ignore */
        }
        const onMove = (ev: PointerEvent) => {
          const dx = ev.clientX - originX;
          const steps = Math.round(-dx / stepPx);
          onStartChange(clamp(originStart + steps));
        };
        const onUp = () => {
          el.style.cursor = maxStart > 0 ? "grab" : "default";
          try {
            el.releasePointerCapture(pid);
          } catch {
            /* ignore */
          }
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onUp);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
      }}
      onWheel={(e) => {
        if (maxStart <= 0) return;
        const horiz =
          Math.abs(e.deltaX) > Math.abs(e.deltaY)
            ? e.deltaX
            : e.shiftKey
              ? e.deltaY
              : 0;
        if (!horiz) return;
        e.preventDefault();
        const steps = Math.round(horiz / Math.max(24, stepPx * 0.6));
        if (steps === 0) {
          onStartChange(clamp(start + (horiz > 0 ? 1 : -1)));
          return;
        }
        onStartChange(clamp(start + steps));
      }}
    >
      {children}
    </div>
  );
}

function fmtCfAxis(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

/** 单元现金流条带：默认也偏紧，避免 width:100% 把 viewBox 拉成「死大」 */
const CF_STRIP = {
  labelW: 36,
  plotW: 420,
  rowH: 18,
  valueW: 64,
  barPadY: 4,
} as const;

/** 投资人单屏中列：矮条、小字、锁高度不随列宽放大 */
const CF_STRIP_COMPACT = {
  labelW: 48,
  plotW: 220,
  rowH: 15,
  valueW: 56,
  barPadY: 3,
} as const;

type CfStripMetrics = typeof CF_STRIP;

/** SVG 图内用 px，避免 rem clamp 再被 viewBox 放大一档 */
const SVG_PX = {
  caption: { fontFamily: FONT_UI, fontSize: 10 },
  label: { fontFamily: FONT_UI, fontSize: 10 },
  body: { fontFamily: FONT_UI, fontSize: 11 },
  strong: { fontFamily: FONT_UI, fontSize: 11, fontWeight: 600 as const },
} as const;

function cfStripSvgBox(h: number) {
  return {
    display: "block" as const,
    width: "100%",
    height: h,
    maxHeight: h,
    overflow: "visible" as const,
  };
}

/**
 * 连贯现金流：零轴居中，左支出 / 右收入；单色弱对比，避免红绿跳色。
 */
function DivergingIoStrip(props: {
  rows: { label: string; income: number; expenseAbs: number }[];
  ccy: string;
  onRowClick?: (index: number) => void;
  /** 下钻态：显示返回 */
  backLabel?: string;
  onBack?: () => void;
  /** 单屏中列用矮条带 */
  compact?: boolean;
  /** 可见行数；超出则上下滚动（默认不截断） */
  maxVisibleRows?: number;
}) {
  const theme = useHostTheme();
  const { rows, ccy, onRowClick, backLabel, onBack, compact, maxVisibleRows } =
    props;
  if (rows.length === 0) return null;
  const strip: CfStripMetrics = compact ? CF_STRIP_COMPACT : CF_STRIP;
  const labelW = strip.labelW;
  const plotW = strip.plotW;
  const rowH = strip.rowH;
  const valueW = strip.valueW;
  const pad = compact ? 20 : 36;
  const half = plotW / 2;
  const maxAbs = Math.max(
    1,
    ...rows.map((r) => Math.max(r.income, r.expenseAbs)),
  );
  const scale = (v: number) => (Math.max(0, v) / maxAbs) * (half - pad);
  const x0 = labelW + half;
  const h = rows.length * rowH;
  const incomeColor = theme.fill.primary;
  const expenseColor = theme.fill.tertiary;
  const w = labelW + plotW + valueW;
  const visN =
    maxVisibleRows != null && maxVisibleRows > 0
      ? Math.min(rows.length, maxVisibleRows)
      : rows.length;
  const scrollH = visN * rowH + 2;
  const needScroll = rows.length > visN;
  return (
    <Stack gap={compact ? 4 : 6}>
      <Row gap={8} align="center" wrap>
        <Text size="small" tone="tertiary">
          支出 ← 零轴 → 收入（{ccy}）· ±{fmtCfAxis(maxAbs)}
          {needScroll ? ` · ${rows.length} 行可上下滑` : ""}
        </Text>
        {onBack ? (
          <>
            <Spacer />
            <Button variant="secondary" onClick={onBack}>
              {backLabel || "← 返回按年"}
            </Button>
          </>
        ) : null}
      </Row>
      <div
        style={mergeStyle({
          border: `1px solid ${theme.stroke.tertiary}`,
          background: theme.bg.elevated,
          padding: compact ? "4px 4px 2px" : "8px 8px 6px",
          maxHeight: scrollH + (compact ? 6 : 16),
          overflowY: needScroll ? "auto" : "hidden",
          overflowX: "hidden",
        })}
      >
        <svg
          width="100%"
          height={h + 2}
          viewBox={`0 0 ${w} ${h + 2}`}
          preserveAspectRatio="xMinYMin meet"
          style={{
            display: "block",
            width: "100%",
            height: h + 2,
            minHeight: h + 2,
            overflow: "visible",
          }}
        >
        <line
          x1={x0}
          y1={0}
          x2={x0}
          y2={h}
          stroke={theme.stroke.primary}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        {rows.map((r, i) => {
          const y = i * rowH;
          const expW = scale(r.expenseAbs);
          const incW = scale(r.income);
          const net = r.income - r.expenseAbs;
          return (
            <g
              key={`${r.label}-${i}`}
              style={{ cursor: onRowClick ? "pointer" : "default" }}
              onClick={() => onRowClick?.(i)}
            >
              <text
                x={labelW - 4}
                y={y + rowH / 2 + 3}
                textAnchor="end"
                fill={theme.text.secondary}
                style={SVG_PX.caption}
              >
                {r.label}
              </text>
              {expW > 0.5 ? (
                <rect
                  x={x0 - expW}
                  y={y + strip.barPadY}
                  width={expW}
                  height={rowH - strip.barPadY * 2}
                  fill={expenseColor}
                />
              ) : null}
              {incW > 0.5 ? (
                <rect
                  x={x0}
                  y={y + strip.barPadY}
                  width={incW}
                  height={rowH - strip.barPadY * 2}
                  fill={incomeColor}
                />
              ) : null}
              <text
                x={labelW + plotW + 4}
                y={y + rowH / 2 + 3}
                fill={theme.text.secondary}
                style={SVG_PX.label}
              >
                {net === 0
                  ? fmtCfAxis(-r.expenseAbs)
                  : `${fmtCfAxis(r.income)} / ${fmtCfAxis(-r.expenseAbs)}`}
              </text>
            </g>
          );
        })}
      </svg>
      </div>
    </Stack>
  );
}

/**
 * 「累计净现金流 · 回本进度」——紧凑横向双行：
 * 上行=期初投入；下行=全期经营净额按年/月分段堆叠（低饱和交替色，虚线=回本对照）。
 */
function CumulativePaybackStrip(props: {
  points: {
    shortZh: string;
    label: string;
    net: number;
    inflow: number;
    outflow: number;
    yearId?: number;
    kind?: "capex" | "idle" | "ops";
    opsMonth?: number;
  }[];
  /** 仅作提示：下方时序是否下钻；回本条始终全期。≥0 表示已下钻 */
  focusYearId?: number;
  toDisp: (mxn: number) => number;
  ccy: string;
  onBackFromDrill?: () => void;
  compact?: boolean;
}) {
  const theme = useHostTheme();
  const {
    points,
    focusYearId = -1,
    toDisp,
    ccy,
    onBackFromDrill,
    compact,
  } = props;
  const [grain, setGrain] = useCanvasState<"year" | "month">(
    "unit-cf-payback-grain",
    "year",
  );
  if (points.length === 0) return null;

  const asPts = assignUnitCfYearIds(points as UnitCfPathPt[]);

  /** 投入：全路径 year0（购置+空窗）支出合计 */
  const investOutflowMxn = asPts
    .filter((p) => p.yearId === 0)
    .reduce((s, p) => s + p.outflow, 0);
  const initialAbs = Math.max(
    1,
    Math.round(toDisp(investOutflowMxn || asPts[0]?.outflow || 0)),
  );

  /** 回收：全期经营段（不因下钻单年而截断） */
  const recoverSource = asPts.filter(
    (p) => p.yearId > 0 || p.kind === "ops",
  );

  const viewRecover: UnitCfPathPt[] =
    grain === "year"
      ? aggregateUnitCfByYear(recoverSource).filter((p) => p.yearId > 0)
      : recoverSource;

  const recoverSegs: { shortZh: string; full: string; value: number }[] = [];
  for (const p of viewRecover) {
    const v = Math.round(toDisp(p.net));
    if (v > 0) {
      recoverSegs.push({ shortZh: p.shortZh, full: p.label, value: v });
    }
  }
  const totalRecover = recoverSegs.reduce((s, m) => s + m.value, 0);
  const periodUnit = grain === "year" ? "年" : "月";

  let recoverIdx = -1;
  let run = 0;
  for (let i = 0; i < recoverSegs.length; i++) {
    run += recoverSegs[i]!.value;
    if (run >= initialAbs) {
      recoverIdx = i;
      break;
    }
  }

  const investColor = theme.accent.primary;
  /** 低饱和交替：能分出每期宽度，又不彩虹跳色 */
  const segToneA = theme.fill.primary;
  const segToneB = theme.fill.tertiary;
  const segFill = (idx: number) => (idx % 2 === 0 ? segToneA : segToneB);
  const maxV = Math.max(initialAbs, totalRecover, 1);

  const strip: CfStripMetrics = compact ? CF_STRIP_COMPACT : CF_STRIP;
  const labelW = strip.labelW;
  const valueW = strip.valueW;
  const plotW = strip.plotW;
  const rowH = strip.rowH;
  const barPadY = strip.barPadY;
  const footH = compact ? 14 : 20;
  const h = rowH * 2 + footH;
  const w = labelW + plotW + valueW;
  const scale = (v: number) => (Math.max(0, v) / maxV) * plotW;
  const invW = scale(initialAbs);
  const x0 = labelW;

  const segs: {
    x: number;
    w: number;
    fill: string;
    key: string;
    shortZh: string;
    value: number;
    idx: number;
  }[] = [];
  let xCursor = x0;
  recoverSegs.forEach((m, i) => {
    const sw = scale(m.value);
    segs.push({
      x: xCursor,
      w: Math.max(sw, sw > 0 ? 1.5 : 0),
      fill: segFill(i),
      key: `p-${m.shortZh}-${i}`,
      shortZh: m.shortZh,
      value: m.value,
      idx: i,
    });
    xCursor += Math.max(sw, 0);
  });

  const paybackSeg =
    recoverIdx >= 0 ? recoverSegs[recoverIdx]! : null;
  const paybackOrdinal = recoverIdx >= 0 ? recoverIdx + 1 : 0;
  const lineNearRight = invW > plotW * 0.72;
  const paybackLabelX = lineNearRight
    ? x0 + invW - 6
    : x0 + invW + 5;

  return (
    <Stack gap={compact ? 4 : 6}>
      <Row gap={6} align="center" wrap>
        <Text size="small" weight="medium">
          回本
        </Text>
        <Text size="small" tone="tertiary">
          投 {fmtCfAxis(initialAbs)} · 收 {fmtCfAxis(totalRecover)}
          {recoverIdx >= 0
            ? ` · ${recoverSegs[recoverIdx]!.shortZh} 回本`
            : " · 未回本"}
        </Text>
        <Spacer />
        <Pill
          size="sm"
          active={grain === "year"}
          onClick={() => setGrain("year")}
        >
          按年
        </Pill>
        <Pill
          size="sm"
          active={grain === "month"}
          onClick={() => setGrain("month")}
        >
          按月
        </Pill>
      </Row>
      {focusYearId >= 0 && onBackFromDrill ? (
        <Row gap={6} align="center" wrap>
          <Text size="small" tone="tertiary">
            时序已下钻；回本条仍按全期
          </Text>
          <Button variant="secondary" onClick={onBackFromDrill}>
            返回按年
          </Button>
        </Row>
      ) : null}

      <div
        style={mergeStyle({
          border: `1px solid ${theme.stroke.tertiary}`,
          background: theme.bg.elevated,
          padding: compact ? "4px 6px 2px" : "8px 8px 6px",
          overflow: "hidden",
        })}
      >
        <svg
          width="100%"
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="xMinYMid meet"
          style={cfStripSvgBox(h)}
        >
          <rect
            x={0}
            y={0}
            width={w}
            height={rowH}
            fill={theme.fill.quaternary}
          />
          <text
            x={labelW - 4}
            y={rowH / 2 + 3}
            textAnchor="end"
            fill={theme.text.secondary}
            style={SVG_PX.caption}
          >
            投入
          </text>
          <rect
            x={x0}
            y={barPadY}
            width={Math.max(invW, 0)}
            height={rowH - barPadY * 2}
            fill={investColor}
          />
          <text
            x={labelW + plotW + 4}
            y={rowH / 2 + 3}
            fill={theme.text.secondary}
            style={SVG_PX.label}
          >
            {fmtCfAxis(initialAbs)}
          </text>

          <text
            x={labelW - 4}
            y={rowH + rowH / 2 + 3}
            textAnchor="end"
            fill={theme.text.secondary}
            style={SVG_PX.caption}
          >
            回收
          </text>
          {segs.length > 0 ? (
            segs.map((s) => (
              <rect
                key={s.key}
                x={s.x}
                y={rowH + barPadY}
                width={s.w}
                height={rowH - barPadY * 2}
                fill={s.fill}
                stroke={
                  paybackSeg && s.idx === recoverIdx
                    ? theme.text.primary
                    : theme.stroke.tertiary
                }
                strokeWidth={
                  paybackSeg && s.idx === recoverIdx ? 1.25 : 0.5
                }
              >
                <title>{`${s.shortZh} · ${fmtCfAxis(s.value)} ${ccy}`}</title>
              </rect>
            ))
          ) : (
            <rect
              x={x0}
              y={rowH + barPadY}
              width={4}
              height={rowH - barPadY * 2}
              fill={theme.fill.tertiary}
              opacity={0.55}
            />
          )}
          <text
            x={labelW + plotW + 4}
            y={rowH + rowH / 2 + 3}
            fill={theme.text.secondary}
            style={SVG_PX.label}
          >
            {fmtCfAxis(totalRecover)}
          </text>

          <line
            x1={x0 + invW}
            y1={1}
            x2={x0 + invW}
            y2={rowH * 2}
            stroke={theme.stroke.secondary}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text
            x={paybackLabelX}
            y={11}
            textAnchor={lineNearRight ? "end" : "start"}
            fill={theme.text.tertiary}
            style={SVG_PX.caption}
          >
            回本线
          </text>
          {paybackSeg ? (
            <text
              x={Math.min(x0 + invW, labelW + plotW - 4)}
              y={rowH * 2 + 11}
              textAnchor={invW > plotW * 0.55 ? "end" : "start"}
              fill={theme.text.primary}
              style={SVG_PX.strong}
            >
              {paybackSeg.shortZh} 回本（第 {paybackOrdinal}
              {periodUnit}）
            </text>
          ) : (
            <text
              x={x0}
              y={rowH * 2 + 11}
              fill={theme.text.tertiary}
              style={SVG_PX.caption}
            >
              {totalRecover > 0
                ? `累计回收 ${fmtCfAxis(totalRecover)} · 尚未回本`
                : "尚未回本"}
            </text>
          )}
        </svg>
      </div>
    </Stack>
  );
}

/** 投资人单屏中列：回本条 + 收支时序（列内自洽，不依赖页顶） */
function UnitCfTimelinePanel(props: {
  monthPath: UnitCfPathPt[];
  ccy: string;
  fx: number;
  compact?: boolean;
  unitCfGrain: "year" | "month";
  setUnitCfGrain: (g: "year" | "month") => void;
  unitCfYearFocus: number;
  setUnitCfYearFocus: (n: number) => void;
  unitCfAxisStart: number;
  setUnitCfAxisStart: (n: number) => void;
  showDetailTable?: boolean;
}) {
  const {
    monthPath,
    ccy,
    fx,
    compact,
    unitCfGrain,
    setUnitCfGrain,
    unitCfYearFocus,
    setUnitCfYearFocus,
    unitCfAxisStart,
    setUnitCfAxisStart,
    showDetailTable = false,
  } = props;
  if (monthPath.length === 0) {
    return (
      <Text size="small" tone="tertiary">
        请选择车辆或场站以生成现金流。
      </Text>
    );
  }
  const isYearView = unitCfGrain === "year" && unitCfYearFocus < 0;
  const WIN = compact ? (isYearView ? 6 : 10) : isYearView ? 8 : 12;
  const yearPath = aggregateUnitCfByYear(monthPath);
  /** 按月：全路径月粒度；若曾点某年下钻，则只看该年 12 月 */
  const monthViewPath: UnitCfPathPt[] =
    unitCfYearFocus >= 0
      ? unitCfMonthsOfYear(monthPath, unitCfYearFocus)
      : monthPath;
  const viewPath: UnitCfPathPt[] = isYearView
    ? yearPath
    : monthViewPath.length > 0
      ? monthViewPath
      : yearPath;
  const maxStart = Math.max(0, viewPath.length - WIN);
  const start = Math.max(0, Math.min(unitCfAxisStart, maxStart));
  const win = viewPath.slice(start, start + WIN);
  const toDisp = (mxn: number) => (ccy === "MXN" ? mxn : mxn / fx);
  const openYear = (y: number) => {
    setUnitCfYearFocus(Math.max(0, Math.round(y)));
    setUnitCfGrain("month");
    setUnitCfAxisStart(0);
  };
  const goYear = () => {
    setUnitCfGrain("year");
    setUnitCfYearFocus(-1);
    setUnitCfAxisStart(0);
  };
  /** 全路径按月（不锁某年） */
  const goMonthAll = () => {
    setUnitCfGrain("month");
    setUnitCfYearFocus(-1);
    setUnitCfAxisStart(0);
  };
  const drilledLabel =
    unitCfYearFocus < 0
      ? ""
      : unitCfYearFocus === 0
        ? "← 返回按年（期初）"
        : `← 返回按年（Y${unitCfYearFocus}）`;
  const monthPillActive = unitCfGrain === "month";
  const monthPillLabel =
    unitCfYearFocus >= 0
      ? unitCfYearFocus === 0
        ? "期初·月"
        : `Y${unitCfYearFocus}·月`
      : "按月";

  return (
    <Stack gap={compact ? 4 : 8}>
      <Row gap={6} align="center" wrap>
        <Text size="small" weight="medium">
          时序
        </Text>
        <Pill size="sm" active={isYearView} onClick={goYear}>
          按年
        </Pill>
        <Pill size="sm" active={monthPillActive} onClick={goMonthAll}>
          {monthPillLabel}
        </Pill>
        <Text size="small" tone="tertiary">
          {isYearView
            ? "点年条下钻到月"
            : unitCfYearFocus >= 0
              ? "仅该年 · 点「按月」看全路径"
              : "左右拖窗口"}
        </Text>
        {unitCfYearFocus >= 0 ? (
          <Button variant="secondary" onClick={goYear}>
            {drilledLabel}
          </Button>
        ) : null}
      </Row>
      <CumulativePaybackStrip
        compact={compact}
        ccy={ccy}
        toDisp={toDisp}
        focusYearId={unitCfYearFocus}
        points={monthPath}
        onBackFromDrill={unitCfYearFocus >= 0 ? goYear : undefined}
      />
      {compact ? (
        <DivergingIoStrip
          compact
          maxVisibleRows={isYearView ? 8 : 10}
          ccy={ccy}
          rows={viewPath.map((b) => ({
            label: b.shortZh,
            income: Math.round(toDisp(b.inflow)),
            expenseAbs: Math.round(toDisp(b.outflow)),
          }))}
          onBack={unitCfYearFocus >= 0 ? goYear : undefined}
          backLabel={drilledLabel || "← 返回按年"}
          onRowClick={
            isYearView
              ? (idx) => {
                  const row = viewPath[idx];
                  if (row && row.yearId >= 0) openYear(row.yearId);
                }
              : undefined
          }
        />
      ) : (
        <CfAxisPanSurface
          start={start}
          maxStart={maxStart}
          onStartChange={setUnitCfAxisStart}
          stepPx={36}
        >
          <DivergingIoStrip
            ccy={ccy}
            rows={win.map((b) => ({
              label: b.shortZh,
              income: Math.round(toDisp(b.inflow)),
              expenseAbs: Math.round(toDisp(b.outflow)),
            }))}
            onBack={unitCfYearFocus >= 0 ? goYear : undefined}
            backLabel={drilledLabel || "← 返回按年"}
            onRowClick={
              isYearView
                ? (idx) => {
                    const row = win[idx];
                    if (row && row.yearId >= 0) openYear(row.yearId);
                  }
                : undefined
            }
          />
        </CfAxisPanSurface>
      )}
      {showDetailTable ? (
        <CollapsibleSection
          title="明细表"
          count={win.length}
          trailing={
            <Text size="small" tone="tertiary">
              {unitCfYearFocus >= 0 ? "月" : "年"}
            </Text>
          }
        >
          <Table
            headers={[
              "时点",
              `收入（${ccy}）`,
              `支出（${ccy}）`,
              `净额（${ccy}）`,
            ]}
            columnAlign={["left", "right", "right", "right"]}
            rows={win.map((b) => [
              b.label,
              moneyMxn(b.inflow, fx, ccy, 0),
              moneyMxn(-b.outflow, fx, ccy, 0),
              moneyMxn(b.net, fx, ccy, 0),
            ])}
            striped
          />
        </CollapsibleSection>
      ) : null}
    </Stack>
  );
}

/** 投资人布局：上核心输出平铺 · 下假设+实时两列 */
const INV_PANE_GRID_TWO = "minmax(0,1fr) minmax(0,1.15fr)";
const INV_PANE_GAP = 6;
const INV_PANE_PAD = 6;

/** 窄屏：仍保持上条+下两列，略缩内边距 */
const INV_OPS_RESPONSIVE_CSS = `
@media (max-width: 920px) {
  .inv-ops-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr) !important;
    min-width: 0;
  }
  .inv-ops-col {
    min-width: 0;
    padding: 4px !important;
  }
  .inv-ops-out-top {
    padding: 4px !important;
  }
}
`;

/** 顶部核心输出条（平铺指标，不参与列内滚动） */
function InvPaneTopStrip(props: {
  children?: any;
  theme: ReturnType<typeof useHostTheme>;
}) {
  const { children, theme } = props;
  return (
    <div
      className="inv-ops-out-top"
      style={{
        flexShrink: 0,
        padding: INV_PANE_PAD,
        border: `1px solid ${theme.stroke.secondary}`,
        background: theme.bg.elevated,
        boxSizing: "border-box",
        overflowX: "auto",
      }}
    >
      {children}
    </div>
  );
}

/** 列内滚动壳：下区两列各自滚动，不滚整页 */
function InvPaneScrollCol(props: {
  children?: any;
  theme: ReturnType<typeof useHostTheme>;
  /** 列角色：中列略强调为「看」的主视线 */
  tone?: "default" | "focus";
  className?: string;
}) {
  const { children, theme, tone = "default", className } = props;
  return (
    <div
      className={className}
      style={{
        minHeight: 0,
        height: "100%",
        maxHeight: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        padding: INV_PANE_PAD,
        border: `1px solid ${
          tone === "focus" ? theme.stroke.primary : theme.stroke.tertiary
        }`,
        background: theme.bg.elevated,
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

function InvColTitle(props: { title: string; hint?: string }) {
  return (
    <Stack gap={2}>
      <Text size="small" weight="semibold">
        {props.title}
      </Text>
      {props.hint ? (
        <Text size="small" tone="tertiary">
          {props.hint}
        </Text>
      ) : null}
    </Stack>
  );
}

type WfModule =
  | "income"
  | "platform"
  | "labor"
  | "energy"
  | "variable"
  | "fixed"
  | "finance"
  | "equity";

type WfBridgeStep = {
  id: string;
  label: string;
  /** 桥段：total=自零轴柱；delta=浮动增减 */
  kind: "total" | "delta";
  /** MXN；delta 为负表示扣减 */
  mxn: number;
  module: WfModule;
};

const WF_MODULE_ZH: Record<WfModule, string> = {
  income: "收入",
  platform: "平台",
  labor: "人力",
  energy: "能源",
  variable: "可变",
  fixed: "固定",
  finance: "融资",
  equity: "权益",
};

function wfSliceModule(id: string): WfModule {
  if (id === "passenger") return "income";
  if (id === "equity_residual") return "equity";
  if (id === "pay_fee" || id === "platform") return "platform";
  if (id === "driver_wage") return "labor";
  if (id === "charge") return "energy";
  if (id === "investor_pi") return "finance";
  if (
    id === "wear" ||
    id === "contract_fixed" ||
    id.startsWith("fix_")
  ) {
    return "fixed";
  }
  return "variable";
}

function wfSliceShortLabel(s: WaterfallSlice): string {
  const map: Record<string, string> = {
    pay_fee: "通道费",
    platform: "平台抽成",
    driver_wage: "司机",
    charge: "充电",
    wear: "易损件",
    tolls: "过路",
    contract_fixed: "合同固定",
    trip_bonus: "冲单",
    investor_pi: "债服",
    fix_insurance: "保险",
    fix_maint: "保养",
    fix_soft: "GPS",
    fix_parking: "车位",
  };
  return map[s.id] || s.nameZh.slice(0, 5);
}

/** 日瀑布 slice → 桥段（跳过≈0 与 spv_in；扣减按金额降序便于对比） */
function daySlicesToBridgeSteps(slices: WaterfallSlice[]): WfBridgeStep[] {
  const income: WfBridgeStep[] = [];
  const deltas: WfBridgeStep[] = [];
  let equity: WfBridgeStep | null = null;

  for (const s of slices) {
    if (s.id === "spv_in") continue;
    const amt = s.amountMxn || 0;
    if (s.id === "passenger") {
      if (amt <= 0.01) continue;
      income.push({
        id: s.id,
        label: "收入",
        kind: "total",
        mxn: amt,
        module: "income",
      });
      continue;
    }
    if (s.id === "equity_residual") {
      equity = {
        id: s.id,
        label: "权益剩",
        kind: "total",
        mxn: amt,
        module: "equity",
      };
      continue;
    }
    if (Math.abs(amt) <= 0.01) continue;
    deltas.push({
      id: s.id,
      label: wfSliceShortLabel(s),
      kind: "delta",
      mxn: -Math.abs(amt),
      module: wfSliceModule(s.id),
    });
  }
  deltas.sort((a, b) => Math.abs(b.mxn) - Math.abs(a.mxn));
  return [...income, ...deltas, ...(equity ? [equity] : [])];
}

function wfModuleFill(
  theme: ReturnType<typeof useHostTheme>,
  mod: WfModule,
): string {
  const cat = theme.category;
  switch (mod) {
    case "income":
      return theme.accent.primary;
    case "equity":
      return cat.green;
    case "platform":
      return cat.purple;
    case "labor":
      return cat.orange;
    case "energy":
      return cat.cyan;
    case "variable":
      return cat.yellow;
    case "fixed":
      return cat.pink;
    case "finance":
      return cat.red;
    default:
      return cat.gray;
  }
}

/**
 * 瀑布过程桥：收入柱 → 按金额降序扣减（浮动段）→ 权益剩。
 * 单一 cum 水位 + 线性 y 坐标（0 贴横轴），plot 区 clip 防穿轴。
 */
function CashflowWaterfallBridge(props: {
  steps: WfBridgeStep[];
  toDisp: (mxn: number) => number;
  ccy: string;
  grainLabel: string;
  compact?: boolean;
}) {
  const theme = useHostTheme();
  const { steps, toDisp, ccy, grainLabel, compact } = props;
  if (steps.length === 0) {
    return (
      <Text size="small" tone="tertiary">
        暂无瀑布切片（检查成本开关与收入入口）
      </Text>
    );
  }

  type WfGeom = {
    id: string;
    label: string;
    module: WfModule;
    kind: "income" | "delta" | "result";
    value: number;
    start: number;
    end: number;
  };

  const geoms: WfGeom[] = [];
  let cum = 0;
  for (const step of steps) {
    const v = toDisp(step.mxn);
    if (step.id === "passenger") {
      cum = Math.max(0, v);
      geoms.push({
        id: step.id,
        label: step.label,
        module: step.module,
        kind: "income",
        value: v,
        start: 0,
        end: cum,
      });
      continue;
    }
    if (step.id === "equity_residual") {
      const end = Math.max(0, v);
      geoms.push({
        id: step.id,
        label: step.label,
        module: step.module,
        kind: "result",
        value: end,
        start: 0,
        end,
      });
      continue;
    }
    const start = cum;
    cum = Math.max(0, start + v);
    geoms.push({
      id: step.id,
      label: step.label,
      module: step.module,
      kind: "delta",
      value: v,
      start,
      end: cum,
    });
  }

  const domainMax = Math.max(
    1,
    ...geoms.map((g) => g.start),
    ...geoms.map((g) => g.end),
  );
  const n = geoms.length;
  /** 每柱占一列 slot，柱多时不压缩标签 */
  const slotW =
    compact && n > 7 ? 56 : n > 8 ? 54 : n > 6 ? 48 : n > 4 ? 42 : 36;
  const barW = Math.min(compact ? 20 : 22, slotW - 12);
  const padL = 10;
  const plotH = compact ? 92 : 112;
  const valueH = 14;
  const padT = valueH + 6;
  const labelRotate = compact ? n >= 3 : n >= 5;
  const padB = labelRotate ? (compact ? 72 : 58) : 24;
  const h = padT + plotH + padB;
  const w = padL * 2 + n * slotW;
  const y0 = padT + plotH;
  const axisLabelY = y0 + (labelRotate ? 14 : 16);
  const innerH = plotH - 6;
  const slotCx = (i: number) => padL + i * slotW + slotW / 2;
  const barX = (i: number) => slotCx(i) - barW / 2;
  /** 0 在横轴 y0，正值向上；勿用 abs，避免负水位折到轴下 */
  const yAt = (val: number) => y0 - (Math.max(0, val) / domainMax) * innerH;

  const axisShort = (g: WfGeom) => {
    const m: Record<string, string> = {
      passenger: "收入",
      equity_residual: "权益剩",
      wear: "易损",
      fix_insurance: "保险",
      fix_maint: "保养",
      fix_soft: "GPS",
      fix_parking: "车位",
      driver_wage: "司机",
      charge: "充电",
      investor_pi: "债服",
      tolls: "过路",
      trip_bonus: "冲单",
    };
    return m[g.id] || (g.label.length <= 4 ? g.label : g.label.slice(0, 4));
  };

  const legendMods = (
    ["platform", "labor", "energy", "variable", "fixed", "finance"] as WfModule[]
  ).filter((m) => geoms.some((g) => g.module === m && g.kind === "delta"));

  return (
    <Stack gap={4}>
      <Row gap={6} align="center" wrap>
        <Text size="small" weight="medium">
          瀑布过程
        </Text>
        <Text size="small" tone="tertiary">
          {grainLabel} · {ccy}
          {n > 6 ? " · 可横滑" : ""}
        </Text>
      </Row>
      {legendMods.length > 0 ? (
        <Row gap={8} wrap align="center">
          {legendMods.map((m) => (
            <Row key={m} gap={4} align="center">
              <span
                style={{
                  width: 8,
                  height: 8,
                  background: wfModuleFill(theme, m),
                  border: `1px solid ${theme.stroke.secondary}`,
                  borderRadius: 1,
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              <Text size="small" tone="tertiary">
                {WF_MODULE_ZH[m]}
              </Text>
            </Row>
          ))}
        </Row>
      ) : null}
      <div
        style={{
          border: `1px solid ${theme.stroke.tertiary}`,
          background: theme.bg.elevated,
          padding: labelRotate ? "4px 6px 14px" : "4px 6px 10px",
          overflowX: "auto",
          overflowY: "visible",
        }}
      >
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="xMinYMin meet"
          style={{ display: "block", minWidth: w, height: h, flexShrink: 0 }}
        >
          <defs>
            <clipPath id="wf-plot-clip">
              <rect x={0} y={padT - 2} width={w} height={plotH + 2} />
            </clipPath>
          </defs>
          <line
            x1={0}
            y1={y0}
            x2={w}
            y2={y0}
            stroke={theme.stroke.tertiary}
            strokeWidth={1}
          />
          <g clipPath="url(#wf-plot-clip)">
            {geoms.map((g, i) => {
              const x = barX(i);
              const cx = slotCx(i);
              const yTop = yAt(Math.max(g.start, g.end));
              const yBot = yAt(Math.min(g.start, g.end));
              const rectY = yTop;
              const rectH = Math.max(2, yBot - yTop);
              const fill = wfModuleFill(theme, g.module);
              const prevEnd = i > 0 ? geoms[i - 1]!.end : null;
              const connY =
                prevEnd != null && g.kind === "delta" ? yAt(prevEnd) : null;
              const connX0 = i > 0 ? slotCx(i - 1) + barW / 2 : cx;
              return (
                <g key={`${g.id}-${i}-bar`}>
                  {connY != null ? (
                    <line
                      x1={connX0}
                      y1={connY}
                      x2={x}
                      y2={yAt(g.start)}
                      stroke={theme.stroke.secondary}
                      strokeWidth={1}
                      strokeDasharray="2 2"
                    />
                  ) : null}
                  <rect
                    x={x}
                    y={rectY}
                    width={barW}
                    height={rectH}
                    fill={fill}
                    stroke={theme.stroke.secondary}
                    strokeWidth={0.75}
                    rx={1}
                  >
                    <title>{`${g.label} · ${WF_MODULE_ZH[g.module]} · ${fmtCfAxis(g.value)} ${ccy}`}</title>
                  </rect>
                </g>
              );
            })}
          </g>
          {geoms.map((g, i) => {
            const cx = slotCx(i);
            const yTop = yAt(Math.max(g.start, g.end));
            const yBot = yAt(Math.min(g.start, g.end));
            const rectY = yTop;
            const rectH = Math.max(2, yBot - yTop);
            const valStr =
              g.kind === "delta" ? fmtCfAxis(g.value) : fmtCfAxis(g.end);
            const valAbove =
              g.kind !== "delta" ||
              (g.value < 0 && (n > 6 || rectH < 12));
            return (
              <g key={`${g.id}-${i}-lbl`}>
                <text
                  x={cx}
                  y={valAbove ? rectY - 3 : rectY + rectH + 11}
                  textAnchor="middle"
                  fill={theme.text.secondary}
                  style={SVG_PX.caption}
                >
                  {valStr}
                </text>
                <text
                  x={cx}
                  y={axisLabelY}
                  transform={
                    labelRotate
                      ? `rotate(-42, ${cx}, ${axisLabelY})`
                      : undefined
                  }
                  textAnchor={labelRotate ? "end" : "middle"}
                  fill={theme.text.tertiary}
                  style={SVG_PX.caption}
                >
                  {axisShort(g)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </Stack>
  );
}

function GoLiveTimelineAxis({
  stages,
  cursorDay,
  onCursorDay,
  showCursor = true,
}: {
  stages: GoLiveStage[];
  cursorDay: number;
  onCursorDay?: (d: number) => void;
  showCursor?: boolean;
}) {
  const theme = useHostTheme();
  const total = Math.max(1, goLiveTotalDays(stages));
  const day = Math.max(0, Math.min(total, Math.round(cursorDay)));
  const pos = goLiveAxisPosition(stages, day);
  const segColors = [
    theme.fill.secondary,
    theme.fill.tertiary,
    theme.fill.secondary,
    theme.fill.tertiary,
  ];

  return (
    <Stack gap={10}>
      <Row gap={8} align="center" wrap>
        <Text size="small" weight="medium">
          资产阶段横轴
        </Text>
        <Text size="small" tone="tertiary">
          付款 → 投产 · 共 {goLiveTotalDays(stages)} 天 · 段宽按有效天比例
        </Text>
      </Row>

      {/* 端点标签 */}
      <Row gap={8} style={{ justifyContent: "space-between" }}>
        <Text size="small" weight="medium" style={{ color: theme.text.primary }}>
          付款 · D0
        </Text>
        <Text size="small" weight="medium" style={{ color: theme.text.primary }}>
          投产 · D{goLiveTotalDays(stages)}
        </Text>
      </Row>

      {/* 比例条 */}
      <div style={{ position: "relative", width: "100%" }}>
        <div
          style={{
            display: "flex",
            width: "100%",
            height: 36,
            border: `1px solid ${theme.stroke.secondary}`,
            overflow: "hidden",
          }}
        >
          {stages.map((s, i) => {
            const w = (s.days / total) * 100;
            const active = pos.pointId === s.id;
            return (
              <div
                key={s.id}
                title={`${s.nameZh} · ${s.days}天`}
                style={{
                  width: `${w}%`,
                  minWidth: s.days > 0 ? 28 : 0,
                  background: active
                    ? theme.accent.control
                    : segColors[i % segColors.length],
                  borderRight:
                    i < stages.length - 1
                      ? `1px solid ${theme.stroke.primary}`
                      : undefined,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                  boxSizing: "border-box",
                }}
              >
                <Text
                  size="small"
                  style={{
                    color: active ? theme.text.onAccent : theme.text.secondary,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.nameZh}
                  <span style={{ opacity: 0.75 }}> {s.days}d</span>
                </Text>
              </div>
            );
          })}
        </div>

        {showCursor && (
          <div
            style={{
              position: "absolute",
              left: `${pos.pct}%`,
              top: -4,
              bottom: -4,
              width: 2,
              marginLeft: -1,
              background: theme.text.primary,
              pointerEvents: "none",
            }}
          />
        )}
      </div>

      <div style={{ position: "relative", width: "100%", height: 18 }}>
        <Text
          size="small"
          tone="tertiary"
          style={{ position: "absolute", left: 0 }}
        >
          D0
        </Text>
        {stages.map((s) => {
          let end = 0;
          for (const x of stages) {
            end += x.days;
            if (x.id === s.id) break;
          }
          const left = (end / total) * 100;
          return (
            <Text
              key={s.id}
              size="small"
              tone="tertiary"
              style={{
                position: "absolute",
                left: `${left}%`,
                transform: "translateX(-100%)",
              }}
            >
              D{end}
            </Text>
          );
        })}
      </div>

      {showCursor && (
        <Stack gap={6}>
          <Row gap={8} align="center" wrap>
            <Pill active size="sm">
              今日 · D{day} · {pos.nameZh}
            </Pill>
            <Text size="small" tone="secondary">
              进度 {pos.pct.toFixed(0)}%
            </Text>
          </Row>
          {onCursorDay && (
            <Stack gap={4}>
              <Text size="small" tone="secondary">
                日游标（模拟每日推进）
              </Text>
              <input
                type="range"
                min={0}
                max={total}
                step={1}
                value={day}
                onChange={(e) => onCursorDay(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </Stack>
          )}
          <Text size="small" tone="secondary">
            本阶段宜采集：{pos.collectZh.join(" · ")}
          </Text>
        </Stack>
      )}
    </Stack>
  );
}

/** 可拖动刻度：range + 档位点按 + 即时业务含义 */
function ScaleField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  display,
  why,
  effect,
  ticks,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  display: string;
  why?: string;
  effect?: string;
  ticks?: { value: number; label: string }[];
}) {
  const theme = useHostTheme();
  const clamped = Math.max(min, Math.min(max, value));
  return (
    <Stack
      gap={6}
      style={mergeStyle({
        padding: 12,
        border: `1px solid ${theme.stroke.tertiary}`,
        background: theme.bg.elevated,
      })}
    >
      <Row align="center" gap={8}>
        <Text size="small" weight="medium">
          {label}
        </Text>
        <Spacer />
        <Text
          size="small"
          weight="semibold"
          style={{ color: theme.text.primary }}
        >
          {display}
        </Text>
      </Row>
      {why ? (
        <Text size="small" tone="tertiary">
          {why}
        </Text>
      ) : null}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamped}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        style={{
          width: "100%",
          margin: 0,
          accentColor: theme.text.secondary,
          cursor: "pointer",
        }}
      />
      {ticks && ticks.length > 0 ? (
        <Row gap={4} wrap align="center">
          {ticks.map((t) => {
            const active = Math.abs(clamped - t.value) <= step * 0.51;
            return (
              <Pill
                key={`${t.label}-${t.value}`}
                size="sm"
                active={active}
                onClick={() => onChange(t.value)}
              >
                {t.label}
              </Pill>
            );
          })}
        </Row>
      ) : null}
      {effect ? (
        <Text size="small" tone="secondary">
          {effect}
        </Text>
      ) : null}
    </Stack>
  );
}

function capabilityBand(v: number): string {
  if (v < 0.35) return "偏弱";
  if (v < 0.55) return "一般";
  if (v < 0.75) return "中上";
  if (v < 0.9) return "较强";
  return "很强";
}

function readinessBand(v: number): string {
  if (v < 0.4) return "配套不足";
  if (v < 0.6) return "部分到位";
  if (v < 0.8) return "基本齐备";
  return "充分到位";
}

export default function MexicoEvPortfolioModel() {
  const theme = useHostTheme();
  const [tab, setTab] = useCanvasState<TabId>("tab", "config");
  const [p, setP] = useCanvasState<Premise>("premise", DEFAULT);
  const [nodes, setNodes] = useCanvasState<InvestmentNode[]>(
    "investNodes",
    DEFAULT_NODES,
  );
  const [purchaseOrders, setPurchaseOrders] = useCanvasState<PurchaseOrder[]>(
    "purchaseOrders",
    DEFAULT_PURCHASE_ORDERS,
  );
  const [orderFocusId, setOrderFocusId] = useCanvasState<string>(
    "orderFocusId",
    DEFAULT_PURCHASE_ORDERS[0]!.id,
  );
  /** 本批单元现金流：假设编辑聚焦的订单行 */
  const [orderCfLineId, setOrderCfLineId] = useCanvasState<string>(
    "orderCfLineId",
    "",
  );
  const [draftPayDate, setDraftPayDate] = useCanvasState<string>(
    "draftPayDate",
    "2026-10-15",
  );
  const [cards, setCards] = useCanvasState<VehicleCard[]>(
    "vehicleCards",
    DEFAULT_VEHICLE_CARDS,
  );
  const [ccy, setCcy] = useCanvasState<Currency>("currency", "USD");
  const [paramsMoneyOpen, setParamsMoneyOpen] = useCanvasState<boolean>(
    "paramsMoneyOpen",
    false,
  );
  const [opsPane, setOpsPane] = useCanvasState<"funnel" | "schema" | "api">(
    "opsPane",
    "funnel",
  );
  /** 商详 folder：概览 / 规格 / 单位现金流 / 资产估值 / 市场口碑 / 供应链 */
  const [skuDetailPane, setSkuDetailPane] = useCanvasState<
    | "overview"
    | "ops"
    | "cashflow"
    | "specs"
    | "valuation"
    | "market"
    | "supply"
  >("skuDetailPane", "overview");
  /** 资产经营页情景（示意倍率） */
  const [skuOpsScenario, setSkuOpsScenario] = useCanvasState<CashflowScenario>(
    "skuOpsScenario",
    "base",
  );
  const [assumptionPackFocus, setAssumptionPackFocus] =
    useCanvasState<AssumptionPackId | "all">(
      "assumptionPackFocus",
      "dae-es-zhuanche",
    );
  const [assumptionNatureFocus, setAssumptionNatureFocus] = useCanvasState<
    ConstNatureId | "all"
  >("assumptionNatureFocus", "all");
  /** 单位现金流时序：横轴窗口起点（可横向平移） */
  const [unitCfAxisStart, setUnitCfAxisStart] = useCanvasState<number>(
    "unitCfAxisStart",
    0,
  );
  /** 单位现金流粒度：按年（默认可下钻）/ 按月 */
  const [unitCfGrain, setUnitCfGrain] = useCanvasState<"year" | "month">(
    "unitCfGrain",
    "year",
  );
  /**
   * 按年下钻聚焦的 yearId；-1=未下钻（不用 null，避免 canvas state 丢空值导致「回不去」）
   * 0=期初购置/空窗；1..=经营第 N 年
   */
  const [unitCfYearFocus, setUnitCfYearFocus] = useCanvasState<number>(
    "unitCfYearFocusV2",
    -1,
  );
  /** 投资人视图：期末残值口径 */
  const [invResidualMode, setInvResidualMode] = useCanvasState<
    "market" | "book"
  >("invResidualMode", "market");
  /** 投资人视图：残值是否并入路径末月（影响 IRR/NPV/路径回本） */
  const [invResidualInPath, setInvResidualInPath] = useCanvasState<boolean>(
    "invResidualInPath",
    false,
  );
  /** 中列瀑布桥：日 / 月 / 年（同套 slice，折算） */
  const [invWfGrain, setInvWfGrain] = useCanvasState<"day" | "month" | "year">(
    "invWfGrain",
    "day",
  );
  /**
   * 投资人左列手改覆盖（情景 knobs 之上）。
   * 切保守/中性/激进时清空，避免与情景打架。
   */
  const [invAssume, setInvAssume] = useCanvasState<{
    util?: number;
    iphMxn?: number;
    hoursDay?: number;
    daysWeek?: number;
    subsidyPct?: number;
    /** @deprecated 旧「市场残值」误写入；读取时并入 marketResRate */
    residualRate?: number;
    /** 持有期（年）→ 路径展望月；与会计寿命 acctYears 分离 */
    holdYears?: number;
    /** 持有期末市场残值率覆盖（0–1）；缺省用 marketIntel 曲线 */
    marketResRate?: number;
    driverMxn?: number;
  }>("invAssumeV1", {});
  const patchInvAssume = (
    patch: Partial<{
      util: number;
      iphMxn: number;
      hoursDay: number;
      daysWeek: number;
      subsidyPct: number;
      residualRate: number;
      holdYears: number;
      marketResRate: number;
      driverMxn: number;
    }>,
  ) => setInvAssume((prev) => ({ ...prev, ...patch }));
  /** 资产估值·残值曲线：各线独立点亮/点灭 */
  const [residualCurveOn, setResidualCurveOn] = useCanvasState<{
    book: boolean;
    phys: boolean;
    maint: boolean;
    fair: boolean;
    industry: boolean;
  }>("residualCurveOn", {
    book: true,
    phys: true,
    maint: true,
    fair: true,
    industry: true,
  });
  /** 资产估值·寿命展示/调节上限（年），按 SKU */
  const [lifeYearsCapBySku, setLifeYearsCapBySku] = useCanvasState<
    Record<string, number>
  >("lifeYearsCapBySku", {});
  /** 市场口碑·保有量国家：中国 / 墨西哥 */
  const [marketParcCountry, setMarketParcCountry] =
    useCanvasState<MarketParcCountry>("marketParcCountry", "MX");
  const [batchTracks, setBatchTracks] = useCanvasState<InvestedBatchTrack[]>(
    "batchTracks",
    DEFAULT_BATCH_TRACKS,
  );
  const [batchTrackId, setBatchTrackId] = useCanvasState<string>(
    "batchTrackId",
    DEFAULT_BATCH_TRACKS[0]!.id,
  );
  const [cfgFocusId, setCfgFocusId] = useCanvasState<string>(
    "cfgFocusId",
    "aion-es",
  );
  const [hoverSkuId, setHoverSkuId] = useCanvasState<string>(
    "hoverSkuId",
    "",
  );
  const [sourceFocusId, setSourceFocusId] = useCanvasState<string>(
    "sourceFocusId",
    "",
  );
  const [cfgCart, setCfgCart] = useCanvasState<Record<string, number>>(
    "cfgCart",
    { "aion-es": 50 },
  );
  const [cfgYear, setCfgYear] = useCanvasState<number>("cfgYear", 1);
  const [cfgCountry, setCfgCountry] = useCanvasState<string>(
    "cfgCountry",
    "墨西哥",
  );
  const [cfgVertical, setCfgVertical] = useCanvasState<string>(
    "cfgVertical",
    "网约车·专车",
  );
  const [cfgMode, setCfgMode] = useCanvasState<OpMode>("cfgMode", "DAE");
  /** DAE 一班倒 / 两班倒；LTO/RTO 下不生效 */
  const [daeShift, setDaeShift] = useCanvasState<DaeShift>(
    "daeShift",
    "double",
  );
  const [cfgManager, setCfgManager] = useCanvasState<ManagerId>(
    "cfgManager",
    "fenbang",
  );
  /** 运营商名册（车运营第一要素；可增改） */
  const [operators, setOperators] = useCanvasState<Operator[]>(
    "operators",
    DEFAULT_OPERATORS,
  );
  const [opsNewName, setOpsNewName] = useCanvasState<string>("opsNewName", "");
  const [opsNewHint, setOpsNewHint] = useCanvasState<string>(
    "opsNewHint",
    "",
  );
  /** SKU → 选定配置档 id */
  const [cfgConfigBySku, setCfgConfigBySku] = useCanvasState<
    Record<string, string>
  >("cfgConfigBySku", {});
  const [cfBySku, setCfBySku] = useCanvasState<
    Record<string, AssetCashflowConfig>
  >("cfBySku", {});
  const [cfQty, setCfQty] = useCanvasState<number>("cfQty", 1);
  const [assetSkus, setAssetSkus] = useCanvasState<AssetSku[]>(
    "assetSkus",
    DEFAULT_ASSET_SKUS,
  );
  /** 兼容旧持久化：旧场站 id → 中型；并补齐大/中/小三档 SKU */
  const normalizedSkus = (() => {
    const mapped = assetSkus.map(normalizeSku);
    const byId = new Map<string, AssetSku>();
    for (const s of mapped) byId.set(s.id, s);
    for (const d of DEFAULT_ASSET_SKUS) {
      if (!byId.has(d.id)) byId.set(d.id, d);
    }
    const ordered = DEFAULT_ASSET_SKUS.map((d) => byId.get(d.id)!);
    for (const [id, s] of byId) {
      if (!DEFAULT_ASSET_SKUS.some((d) => d.id === id)) ordered.push(s);
    }
    return ordered;
  })();
  const vehicleModels = normalizedSkus;
  const setVehicleModels = setAssetSkus;


  const activeOrders = (() => {
    const raw =
      purchaseOrders.length > 0 ? purchaseOrders : DEFAULT_PURCHASE_ORDERS;
    const out: PurchaseOrder[] = [];
    for (const o of raw) {
      out.push(normalizePurchaseOrder(o, out));
    }
    return out;
  })();
  const modelNodes = ordersToNodes(activeOrders);
  const model = buildModel(p, modelNodes, cards);
  const fx = p.usdMxn;
  const unit = ccyUnit(ccy);
  const m = (usd: number, digits = 0) => money(usd, fx, ccy, digits);
  const chartVal = (usd: number) =>
    Math.round(toDisplay(usd, fx, ccy));

  const update = <K extends keyof Premise>(key: K, value: Premise[K]) =>
    setP((prev) => ({ ...prev, [key]: value }));

  const reset = () => {
    setP(DEFAULT);
    setNodes(DEFAULT_NODES);
    setCards(DEFAULT_VEHICLE_CARDS);
    setPurchaseOrders(DEFAULT_PURCHASE_ORDERS);
    setOrderFocusId(DEFAULT_PURCHASE_ORDERS[0]!.id);
    setDraftPayDate("2026-10-15");
    setAssetSkus(DEFAULT_ASSET_SKUS);
    setCfgFocusId("aion-es");
    setCfgCart({ "aion-es": 50 });
    setCfgYear(1);
    setCfgCountry("墨西哥");
    setCfgVertical("网约车·专车");
    setCfgMode("DAE");
    setCfgManager("fenbang");
    setCfBySku({});
  };

  const patchNode = (id: string, patch: Partial<InvestmentNode>) =>
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));

  const patchCard = (id: string, patch: Partial<VehicleCard>) =>
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );

  const patchSoft = (cardId: string, softId: string, amountMxn: number) =>
    setCards((prev) =>
      prev.map((c) =>
        c.id !== cardId
          ? c
          : {
              ...c,
              softCosts: c.softCosts.map((s) =>
                s.id === softId ? { ...s, amountMxn } : s,
              ),
            },
      ),
    );

  const addNode = () =>
    setNodes((prev) => [
      ...prev,
      {
        id: `n-${Date.now()}`,
        label: "新投资节点",
        year: 1,
        asset: "dae",
        cardId: "aion-es-dae",
        quantity: 10,
        discountRate: 0,
        enabled: true,
      },
    ]);

  const removeNode = (id: string) =>
    setNodes((prev) => prev.filter((n) => n.id !== id));

  const resolveNodeUnitMxn = (n: InvestmentNode) => {
    if (n.asset === "station") {
      return (
        ((p.chargerCapexMxn + p.stationFitoutMxn) / Math.max(p.chargerGuns, 1))
      );
    }
    const card =
      cards
        .map(normalizeCard)
        .find((c) => c.id === (n.cardId || defaultCardId(n.asset))) ||
      cards
        .map(normalizeCard)
        .find((c) => modeToAsset(c.mode) === n.asset) ||
      DEFAULT_VEHICLE_CARDS[0];
    return vehicleUnitMxn(card, n.discountRate ?? 0);
  };

  const assetLabel = (a: InvestAsset) =>
    a === "station"
      ? "场站/充电枪"
      : a === "dae"
        ? "模式·DAE"
        : a === "rto"
          ? "模式·RTO"
          : "模式·LTO";

  const cfHeaders = ["项目", ...model.rows.map((r) => r.label), "合计"];
  const cfLine = (
    name: string,
    pick: (r: YearRow) => number,
    sum = true,
  ): (string | number)[] => {
    const vals = model.rows.map((r) => pick(r));
    const total = sum
      ? vals.reduce((s, v) => s + v, 0)
      : (vals[vals.length - 1] ?? 0);
    return [name, ...vals.map((v) => m(v)), m(total)];
  };
  const cfScale = (
    name: string,
    pick: (r: YearRow) => number,
  ): (string | number)[] => {
    const vals = model.rows.map((r) => pick(r));
    return [
      name,
      ...vals.map((v) => String(Math.round(v))),
      String(vals[vals.length - 1] ?? 0),
    ];
  };

  const cfForecastRows: (string | number)[][] = [
    // —— 资产层（可变） ——
    cfLine("【资产层】营业收入", (r) => r.revenue),
    cfLine("  稳态收入（对照）", (r) => r.steadyRevenue),
    cfLine("  场站收入", (r) => r.stationRev),
    cfLine("  车辆收入", (r) => r.vehicleRev),
    cfScale("达产负荷%", (r) => Math.round(r.rampLoad * 100)),
    cfScale("情景系数%", (r) => Math.round(r.scenarioFactor * 100)),
    cfLine("【资产层】可变成本", (r) => -r.varCost),
    cfLine("【资产层】贡献毛利", (r) => r.contribution),
    // —— 固定成本叠加 ——
    cfLine("【固定】场站租金+运维", (r) => -r.fixedCost),
    cfLine("扣场站固定后", (r) => r.afterSiteFixed),
    cfLine("【固定】总部管理分摊", (r) => -r.hqAlloc),
    cfLine("EBITDA", (r) => r.ebitda),
    cfLine("折旧（非现金）", (r) => r.depreciation),
    cfLine("EBIT（经营层）", (r) => r.ebit),
    // —— 资本层（借款配置，非经营成本）——
    cfLine("【资本】利息·充电桩", (r) => -r.interestStation),
    cfLine("【资本】利息·DAE", (r) => -r.interestDae),
    cfLine("【资本】利息·LTO", (r) => -r.interestLto),
    cfLine("利息收入", (r) => r.interestIncome),
    cfLine("所得税", (r) => -r.tax),
    cfLine("净利润（含资本成本）", (r) => r.netIncome),
    cfLine("无杠杆净利（对照）", (r) => r.unleveredNi),
    cfLine("经营净现金流（杠杆）", (r) => r.operatingCF),
    cfLine("无杠杆经营现金流", (r) => r.unleveredOpCf),
    cfLine("场站Capex", (r) => -r.stationCapex),
    cfLine("车辆Capex", (r) => -r.vehicleCapex),
    cfLine("【资本】借款·充电桩", (r) => r.financingInStation),
    cfLine("【资本】借款·DAE", (r) => r.financingInDae),
    cfLine("【资本】借款·LTO", (r) => r.financingInLto),
    cfLine("【资本】还本·充电桩", (r) => -r.financingOutStation),
    cfLine("【资本】还本·DAE", (r) => -r.financingOutDae),
    cfLine("【资本】还本·LTO", (r) => -r.financingOutLto),
    cfLine("残值回收", (r) => r.residualIn),
    cfLine("当期净现金流", (r) => r.cashFlow),
    cfLine("累计现金流", (r) => r.cumulativeCF, false),
    cfLine("期末现金", (r) => r.closingCash, false),
    cfScale("在管充电枪", (r) => r.gunsOnline),
    cfScale("在管DAE台数", (r) => r.daeOnline),
    cfScale("在管LTO台数", (r) => r.ltoOnline),
  ];

  const focusId = resolveSkuId(cfgFocusId);
  const cfgSku =
    normalizedSkus.find((v) => v.id === focusId) ||
    normalizedSkus[0] ||
    DEFAULT_ASSET_SKUS[0];
  const cfgQty = Math.max(0, cartQtyOf(cfgCart, focusId));
  const cfgDisc = cfgSku ? volumeDiscountRate(cfgSku, Math.max(cfgQty, 1)) : 0;
  const cfgSoft = cfgSku ? modelSoftSum(cfgSku) : 0;
  const cfgUnit =
    cfgSku && cfgQty > 0 ? modelUnitLandedMxn(cfgSku, cfgQty) : cfgSku
      ? modelUnitLandedMxn(cfgSku, 1)
      : 0;
  const cfgTotal = cfgUnit * cfgQty;
  const operatorList =
    operators.length > 0 ? operators : DEFAULT_OPERATORS;
  const enabledOperators = (() => {
    const en = operatorList.filter((o) => o.enabled);
    if (en.length > 0) return en;
    return operatorList.length > 0 ? [operatorList[0]!] : DEFAULT_OPERATORS;
  })();
  const pickOperatorMeta = (id: ManagerId) =>
    enabledOperators.find((x) => x.id === id) ||
    operatorList.find((x) => x.id === id) ||
    enabledOperators[0] ||
    DEFAULT_OPERATORS[0]!;
  const cfgManagerMeta = pickOperatorMeta(cfgManager);
  const managerIdUse = cfgManagerMeta.id;

  const focusOrder =
    activeOrders.find((o) => o.id === orderFocusId) || activeOrders[0];
  const orderTrialModel = focusOrder
    ? buildModel(
        premiseWithOrderPay(p, focusOrder),
        ordersToNodes([focusOrder]),
        cards,
      )
    : null;
  const orderManagerMeta = focusOrder
    ? pickOperatorMeta(focusOrder.managerId)
    : cfgManagerMeta;

  const orderModeZh = (modeLabel: string) =>
    modeLabel === "DAE"
      ? "雇佣司机运营"
      : modeLabel === "LTO"
        ? "车辆直租"
        : modeLabel === "RTO"
          ? "租买分期"
          : modeLabel === "场站"
            ? "场站"
            : modeLabel;

  const cfgProfile = findOpsProfile(
    cfgCountry,
    cfgVertical,
    cfgMode,
    managerIdUse,
  );

  /** 现金流：一 SKU 一模型；场站焦点时回退到车辆 SKU 示意 */
  const cfSku =
    cfgSku.kind === "vehicle"
      ? cfgSku
      : normalizedSkus.find((s) => s.kind === "vehicle") ||
        DEFAULT_ASSET_SKUS.find((s) => s.kind === "vehicle") ||
        DEFAULT_ASSET_SKUS[0];
  const cfSaved = cfBySku[cfSku.id];
  const cfModeUse: OpMode =
    cfSaved?.boundMode || defaultModeForSku(cfSku);
  const cfCardResolved =
    cards
      .map(normalizeCard)
      .find((c) => c.id === cardIdFor(cfSku.id, cfModeUse)) ||
    cards.map(normalizeCard).find((c) => c.mode === cfModeUse) ||
    DEFAULT_VEHICLE_CARDS.find((c) => c.mode === cfModeUse) ||
    DEFAULT_VEHICLE_CARDS[0];
  const cfCardResolvedNorm = normalizeCard(cfCardResolved);
  const cfCardBase: VehicleCard = {
    ...cfCardResolvedNorm,
    nameZh: cfSku.nameZh,
    model: cfSku.model,
    listPriceMxn: cfSku.purchasePriceMxn,
    softCosts: cfSku.softCosts.map((s) => ({ ...s })),
    /** DAE 运维跟 SKU；LTO/RTO 保留模式卡（承租人侧 maint/wear 可为 0） */
    insuranceYrMxn:
      cfModeUse === "DAE"
        ? cfSku.insuranceYrMxn
        : (cfCardResolvedNorm.insuranceYrMxn ?? cfSku.insuranceYrMxn),
    maintMxn:
      cfModeUse === "DAE"
        ? cfSku.maintMxn
        : (cfCardResolvedNorm.maintMxn ?? 0),
    softMxn:
      cfModeUse === "DAE"
        ? cfSku.softMxn
        : (cfCardResolvedNorm.softMxn ?? cfSku.softMxn ?? 0),
    wearYrMxn:
      cfModeUse === "DAE"
        ? cfSku.wearYrMxn
        : (cfCardResolvedNorm.wearYrMxn ?? 0),
    kwhPer100: cfSku.kwhPer100,
    country: cfgCountry,
    vertical: cfgVertical,
    mode: cfModeUse,
  };
  const cfCardLive: VehicleCard = {
    ...applyScenarioToVehicleCard(
      applyDaeShiftToCard(
        cfCardBase,
        cfModeUse === "DAE" ? daeShift : "single",
      ),
      skuOpsScenario,
    ),
    /** 仅叠收入/司机手改；残值·持有期不进卡（避免把会计期末残值率当成市场残值） */
    ...(invAssume.util != null ? { util: invAssume.util } : {}),
    ...(invAssume.iphMxn != null ? { iphMxn: invAssume.iphMxn } : {}),
    ...(invAssume.hoursDay != null ? { hoursDay: invAssume.hoursDay } : {}),
    ...(invAssume.daysWeek != null ? { daysWeek: invAssume.daysWeek } : {}),
    ...(invAssume.subsidyPct != null
      ? { subsidyPct: invAssume.subsidyPct }
      : {}),
    ...(invAssume.driverMxn != null ? { driverMxn: invAssume.driverMxn } : {}),
  };
  const cfElecMxn =
    cfModeUse === "DAE"
      ? DAE_SCENARIO_KNOBS[skuOpsScenario].elecMxn
      : p.internalPriceMxn;
  const cfCfgLive = syncCfTiersToCard(
    normalizeCfConfig(cfSaved, cfModeUse, cfCardLive, cfSku),
    cfCardLive,
    cfSku,
  );
  // 情景电价/运维写入日成本（normalize 可能带回旧 charge / annualMaint）
  if (cfModeUse === "DAE") {
    const kwhDay =
      (daeKmDay(cfCardLive) / 100) * (cfSku.kwhPer100 || cfCardLive.kwhPer100 || 15);
    const dayFromCard = Math.round(kwhDay * cfElecMxn * 100) / 100;
    const dw = cfCardLive.daysWeek || 6;
    const cyc: ChargePayCycle =
      cfCfgLive.chargeCycle === "week" ||
      cfCfgLive.chargeCycle === "month" ||
      cfCfgLive.chargeCycle === "year"
        ? cfCfgLive.chargeCycle
        : "day";
    cfCfgLive.chargeCycle = cyc;
    if (cfCfgLive.chargeSource !== "manual") {
      cfCfgLive.chargeSource = "from_card";
      cfCfgLive.chargeDayMxn = dayFromCard;
      cfCfgLive.chargeAmountMxn = chargeAmountFromDay(dayFromCard, cyc, dw);
    } else {
      const amt = Math.max(0, cfCfgLive.chargeAmountMxn || 0);
      cfCfgLive.chargeAmountMxn = amt;
      cfCfgLive.chargeDayMxn =
        Math.round(chargeDayFromAmount(amt, cyc, dw) * 100) / 100;
    }
    if (cfCfgLive.fixedCostSource !== "manual") {
      cfCfgLive.fixedCostSource = "from_card";
      cfCfgLive.fixInsuranceYrMxn = cfCardLive.insuranceYrMxn || 0;
      cfCfgLive.fixMaintMoMxn = cfCardLive.maintMxn || 0;
      cfCfgLive.fixSoftMoMxn = cfCardLive.softMxn || 0;
      cfCfgLive.fixParkingMoMxn = cfCardLive.parkingMxn ?? 280;
      cfCfgLive.fixWearPer10kKmMxn = defaultWearPer10kKmMxn(
        cfCardLive,
        cfCardLive.wearYrMxn || 0,
      );
    }
    if (cfCfgLive.varCostEnabled == null) cfCfgLive.varCostEnabled = true;
    if (cfCfgLive.fixedCostEnabled == null) cfCfgLive.fixedCostEnabled = true;
    if (cfCfgLive.fixInsuranceOn == null) cfCfgLive.fixInsuranceOn = true;
    if (cfCfgLive.fixMaintOn == null) cfCfgLive.fixMaintOn = true;
    if (cfCfgLive.fixSoftOn == null) cfCfgLive.fixSoftOn = true;
    if (cfCfgLive.fixParkingOn == null) cfCfgLive.fixParkingOn = true;
    if (cfCfgLive.fixWearOn == null) cfCfgLive.fixWearOn = true;
    cfCfgLive.annualMaintMxn = annualMaintFromFixedLines(cfCfgLive);
    cfCfgLive.randomMaintMonthMxn = wearMonthFromFixed(cfCfgLive, cfCardLive);
    /** 路径长度：默认 DAE 60 月；手改「持有期」时按年×12（与会计寿命分离） */
    cfCfgLive.horizonMonths =
      invAssume.holdYears != null && invAssume.holdYears > 0
        ? Math.min(120, Math.max(12, Math.round(invAssume.holdYears) * 12))
        : 60;
    /** 通道/平台默认 0（见 defaultAssetCfConfig）；手改占池 % 写入 cfBySku，不再每帧清零 */
  } else if (cfModeUse === "LTO" || cfModeUse === "RTO") {
    /** 直租/租买：保险+软件；maint/wear 跟模式卡（默认承租人） */
    const dw = cfCardLive.daysWeek || 6;
    const cyc: ChargePayCycle =
      cfCfgLive.chargeCycle === "week" ||
      cfCfgLive.chargeCycle === "month" ||
      cfCfgLive.chargeCycle === "year"
        ? cfCfgLive.chargeCycle
        : "day";
    cfCfgLive.chargeCycle = cyc;
    if (
      cfCfgLive.chargeSource === "manual" ||
      cfCfgLive.chargeAmountMxn > 0
    ) {
      const amt = Math.max(0, cfCfgLive.chargeAmountMxn || 0);
      cfCfgLive.chargeAmountMxn = amt;
      cfCfgLive.chargeDayMxn =
        Math.round(chargeDayFromAmount(amt, cyc, dw) * 100) / 100;
    } else {
      cfCfgLive.chargeDayMxn = 0;
      cfCfgLive.chargeAmountMxn = 0;
      cfCfgLive.chargeSource = "from_card";
    }
    if (cfCfgLive.fixedCostSource !== "manual") {
      cfCfgLive.fixedCostSource = "from_card";
      cfCfgLive.fixInsuranceYrMxn = cfCardLive.insuranceYrMxn || 0;
      cfCfgLive.fixMaintMoMxn = cfCardLive.maintMxn || 0;
      cfCfgLive.fixSoftMoMxn = cfCardLive.softMxn || 0;
      cfCfgLive.fixParkingMoMxn = 0;
      cfCfgLive.fixWearPer10kKmMxn = defaultWearPer10kKmMxn(
        cfCardLive,
        cfCardLive.wearYrMxn || 0,
      );
    }
    if (cfCfgLive.varCostEnabled == null) cfCfgLive.varCostEnabled = true;
    if (cfCfgLive.fixedCostEnabled == null) cfCfgLive.fixedCostEnabled = true;
    if (cfCfgLive.fixInsuranceOn == null) cfCfgLive.fixInsuranceOn = true;
    if (cfCfgLive.fixMaintOn == null) cfCfgLive.fixMaintOn = true;
    if (cfCfgLive.fixSoftOn == null) cfCfgLive.fixSoftOn = true;
    if (cfCfgLive.fixParkingOn == null) cfCfgLive.fixParkingOn = false;
    if (cfCfgLive.fixWearOn == null) cfCfgLive.fixWearOn = true;
    cfCfgLive.annualMaintMxn = annualMaintFromFixedLines(cfCfgLive);
    cfCfgLive.randomMaintMonthMxn = wearMonthFromFixed(cfCfgLive, cfCardLive);
    cfCfgLive.horizonMonths =
      invAssume.holdYears != null && invAssume.holdYears > 0
        ? Math.min(120, Math.max(12, Math.round(invAssume.holdYears) * 12))
        : Math.max(
            12,
            Math.min(
              60,
              Math.round((cfCardLive.acctYears || cfSku.acctYears || 5) * 12),
            ),
          );
    /** 通道/平台默认 0；手改占池 % 写入 cfBySku，不再每帧清零 */
  }
  const cfUnitLanded1 = modelUnitGrossMxn(
    cfSku,
    1,
    p.vat,
    selectedConfigId(cfSku, cfgConfigBySku),
  );
  const cfDay = buildAssetDayCashflow({
    country: cfgCountry,
    vertical: cfgVertical,
    mode: cfModeUse,
    card: cfCardLive,
    sku: cfSku,
    cfg: cfCfgLive,
    internalPriceMxn: cfElecMxn,
    unitLandedMxn: cfUnitLanded1,
    opsMonth: 1,
  });
  const cfGoLive = goLiveEffectiveStages(p);
  const cfGoLiveDays = goLiveTotalDays(cfGoLive);
  const cfGoLiveIdle = goLiveIdleMonths(cfGoLiveDays);
  const opsFleetQty = (() => {
    const fromNodes = nodes
      .filter((n) => n.enabled && n.asset !== "station")
      .reduce((s, n) => s + Math.max(0, n.quantity || 0), 0);
    if (fromNodes > 0) return fromNodes;
    const fromCart = normalizedSkus
      .filter((s) => s.kind === "vehicle")
      .reduce((s, sku) => s + cartQtyOf(cfgCart, sku.id), 0);
    return Math.max(1, fromCart || cfQty || 1);
  })();
  const opsFunnel = buildOpsFunnel({
    startQty: opsFleetQty,
    stages: cfGoLive,
    customsPass: p.goLiveCustomsPass ?? 0.98,
    pdiPass: p.goLivePdiPass ?? 0.97,
    matchPass: p.goLiveMatchPass ?? 0.92,
  });
  const opsLiveQty = opsFunnel[opsFunnel.length - 1]?.exitQty ?? 0;
  const opsDropQty = Math.max(0, opsFleetQty - opsLiveQty);
  const cfBars = buildAssetMonthBars({
    sku: cfSku,
    card: cfCardLive,
    cfg: cfCfgLive,
    day: cfDay,
    qty: Math.max(1, Math.round(cfQty || 1)),
    discountRate: volumeDiscountRate(cfSku, Math.max(1, cfQty || 1)),
    goLiveStages: cfGoLive,
    vat: p.vat,
    configId: selectedConfigId(cfSku, cfgConfigBySku),
    internalPriceMxn: cfElecMxn,
  });
  const writeSkuCf = (skuId: string, next: AssetCashflowConfig) =>
    setCfBySku((prev) => ({ ...prev, [skuId]: next }));
  const patchCf = (patch: Partial<AssetCashflowConfig>) => {
    const base = normalizeCfConfig(cfSaved, cfModeUse, cfCardLive, cfSku);
    const next: AssetCashflowConfig = {
      ...base,
      ...patch,
      assumptionsVer: CF_ASSUMPTIONS_VER,
    };
    if (patch.paymentFeePct != null) {
      next.paymentFeePct = Math.max(0, Math.min(0.2, patch.paymentFeePct));
    }
    if (patch.platformTakePct != null) {
      next.platformTakePct = Math.max(0, Math.min(0.6, patch.platformTakePct));
    }
    writeSkuCf(cfSku.id, next);
  };
  const patchCfTier = (
    id: string,
    patch: Partial<Omit<WaterfallTier, "investor" | "wage" | "varOpex">> & {
      investor?: Partial<InvestorPiDetail>;
      wage?: Partial<DriverWageDetail>;
      varOpex?: { items: VarOpexItem[] };
    },
  ) =>
    writeSkuCf(cfSku.id, {
      ...cfCfgLive,
      spvTiers: cfCfgLive.spvTiers.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          ...patch,
          investor:
            patch.investor != null
              ? { ...(t.investor || defaultInvestorPi()), ...patch.investor }
              : t.investor,
          wage:
            patch.wage != null
              ? {
                  ...(t.wage ||
                    defaultDriverWage(cfModeUse, 0, opsDaysPerMonth(6))),
                  ...patch.wage,
                }
              : t.wage,
          varOpex:
            patch.varOpex != null
              ? {
                  items:
                    patch.varOpex.items ??
                    t.varOpex?.items ??
                    defaultVarOpexItems(),
                }
              : t.varOpex,
        };
      }),
    });
  const reseedSkuCf = (sku: AssetSku, mode: OpMode) => {
    const cardResolved =
      cards
        .map(normalizeCard)
        .find((c) => c.id === cardIdFor(sku.id, mode)) ||
      cards.map(normalizeCard).find((c) => c.mode === mode) ||
      DEFAULT_VEHICLE_CARDS.find((c) => c.mode === mode) ||
      DEFAULT_VEHICLE_CARDS[0];
    const cardNorm = normalizeCard(cardResolved);
    const isLease = mode === "LTO" || mode === "RTO";
    const cardLive: VehicleCard = {
      ...cardNorm,
      nameZh: sku.nameZh,
      model: sku.model,
      listPriceMxn: sku.purchasePriceMxn,
      softCosts: sku.softCosts.map((s) => ({ ...s })),
      insuranceYrMxn: isLease
        ? (cardNorm.insuranceYrMxn ?? sku.insuranceYrMxn)
        : sku.insuranceYrMxn,
      maintMxn: isLease ? (cardNorm.maintMxn ?? 0) : sku.maintMxn,
      softMxn: isLease
        ? (cardNorm.softMxn ?? sku.softMxn ?? 0)
        : sku.softMxn,
      wearYrMxn: isLease ? (cardNorm.wearYrMxn ?? 0) : sku.wearYrMxn,
      kwhPer100: sku.kwhPer100,
      country: cfgCountry,
      vertical: cfgVertical,
      mode,
    };
    writeSkuCf(sku.id, defaultAssetCfConfig(mode, cardLive, sku));
  };

  const cartLines = normalizedSkus
    .map((s) => {
      const cfgId = selectedConfigId(s, cfgConfigBySku);
      return { sku: s, qty: cartQtyOf(cfgCart, s.id), cfgId };
    })
    .filter((x) => x.qty > 0);
  const cartTotalMxn = cartLines.reduce(
    (sum, { sku, qty, cfgId }) =>
      sum + modelUnitGrossMxn(sku, qty, p.vat, cfgId) * qty,
    0,
  );
  const cartIvaMxn = cartLines.reduce(
    (sum, { sku, qty, cfgId }) =>
      sum + modelUnitIvaMxn(sku, qty, p.vat, cfgId) * qty,
    0,
  );
  /** 未税估列：含税列载 SKU 为反拆；未税 SKU 为加税前落地 */
  const cartNetMxn = cartTotalMxn - cartIvaMxn;

  const setCartQty = (id: string, qty: number) => {
    const rid = resolveSkuId(id);
    const sku =
      normalizedSkus.find((s) => s.id === rid) || DEFAULT_ASSET_SKUS[0];
    const q = clampSkuQty(sku, qty);
    setCfgCart((prev) => {
      const next = { ...prev };
      for (const [legacy, canon] of Object.entries(STATION_ID_ALIASES)) {
        if (canon === rid) delete next[legacy];
      }
      if (q <= 0) delete next[rid];
      else next[rid] = q;
      return next;
    });
    if (q > 0) setCfgFocusId(rid);
  };
  const bumpCart = (id: string, delta: number) => {
    const sku = normalizedSkus.find((s) => s.id === id) || DEFAULT_ASSET_SKUS[0];
    const cur = cartQtyOf(cfgCart, id);
    const step = skuStep(sku);
    if (delta === 0) return;
    if (cur <= 0 && delta > 0) {
      setCartQty(id, sku.defaultQty ?? skuMinQty(sku));
      return;
    }
    const signed = delta > 0 ? Math.max(step, delta) : -Math.max(step, Math.abs(delta));
    setCartQty(id, cur + signed);
  };

  const patchSku = (id: string, patch: Partial<AssetSku>) =>
    setAssetSkus((prev) => {
      const rid = resolveSkuId(id);
      const hit = prev.some((x) => resolveSkuId(x.id) === rid);
      if (!hit) {
        const base = DEFAULT_ASSET_SKUS.find((d) => d.id === rid);
        if (!base) return prev;
        return [
          ...prev.filter((x) => resolveSkuId(x.id) !== rid),
          { ...base, ...patch, id: rid },
        ];
      }
      return prev.map((x) =>
        resolveSkuId(x.id) === rid ? { ...x, ...patch, id: rid } : x,
      );
    });
  const patchSkuTier = (
    id: string,
    tiers: VolumeTier[],
  ) => patchSku(id, { volumeTiers: tiers });

  const syncCardFromConfig = (sku: AssetSku, mode: OpMode, qty: number) => {
    if (sku.kind === "station") return "station";
    const id = cardIdFor(sku.id, mode);
    const profile = findOpsProfile(
      cfgCountry,
      cfgVertical,
      mode,
      cfgManager,
    );
    const cfgId =
      cfgConfigBySku[sku.id] ||
      sku.defaultConfigId ||
      sku.configVariants?.find((c) => c.isDefault)?.id ||
      sku.configVariants?.[0]?.id ||
      "";
    const variant = resolveConfigVariant(sku, cfgId);
    const comps = sku.majorComponents || [];
    const tire = comps.find((c) => c.id === "tire");
    const batt = comps.find((c) => c.id === "battery");
    const listPrice =
      variant?.purchasePriceMxn != null
        ? variant.purchasePriceMxn
        : sku.purchasePriceMxn;
    const base: VehicleCard = {
      id,
      mode,
      nameZh: sku.nameZh,
      model: variant
        ? !sku.model || isRedundantSkuModel(sku.nameZh, sku.model)
          ? variant.nameZh
          : `${sku.model} · ${variant.nameZh}`
        : sku.model,
      country: cfgCountry,
      vertical: cfgVertical,
      listPriceMxn: listPrice,
      softCosts: sku.softCosts.map((s) => ({ ...s })),
      residualRate: sku.residualRate,
      physResidualRate: sku.physResidualRate ?? 0,
      maintResidualRate: sku.maintResidualRate ?? 0,
      acctYears: sku.acctYears,
      physYears: sku.physYears,
      maintYears: sku.maintYears,
      bodyShare: 0.5,
      batteryShare: 0.5,
      rampYears: profile.rampYears,
      rampStartLoad: profile.rampStartLoad,
      uncertaintyBand: profile.uncertaintyBand,
      util: profile.util,
      iphMxn: profile.iphMxn,
      hoursDay: profile.hoursDay,
      daysWeek: profile.daysWeek,
      subsidyPct: profile.subsidyPct,
      insuranceYrMxn: sku.insuranceYrMxn,
      maintMxn: sku.maintMxn,
      softMxn: sku.softMxn,
      wearYrMxn: sku.wearYrMxn,
      kwhPer100: sku.kwhPer100,
      driverMxn: profile.driverMxn,
      occupancy: profile.occupancy,
      badDebt: profile.badDebt,
      rentMonthMxn: profile.rentMonthMxn,
      depositMxn: profile.depositMxn,
      skuId: sku.id,
      configVariantId: cfgId,
      identity: emptyIdentity({
        configVariantId: cfgId,
        modelFullZh: variant
          ? [
              !sku.model || isRedundantSkuModel(sku.nameZh, sku.model)
                ? null
                : sku.model,
              variant.nameZh,
              variant.rangeZh,
            ]
              .filter(Boolean)
              .join(" · ")
          : sku.model,
        batteryKwh: variant ? String(variant.batteryKwh) : "",
        batteryMakerZh: batt?.manufacturerZh || "",
        tireBrandZh: tire?.brandZh || "",
        tireSupplierZh: tire?.supplierZh || "",
        tireSpecZh: variant?.tireSpecZh || tire?.specZh || "",
        noteZh: `下单批量 ${qty}；NIV/电池SN 到货后按《EV数据逻辑梳理》补录`,
      }),
    };
    setCards((prev) => {
      const hit = prev.find((c) => c.id === id);
      const rest = prev.filter((c) => c.id !== id);
      // 保留已补录的唯一识别号，避免再次结算覆盖
      const kept = hit?.identity
        ? emptyIdentity({
            ...base.identity,
            niv: hit.identity.niv || "",
            plateNo: hit.identity.plateNo || "",
            batterySn: hit.identity.batterySn || "",
            bodyFactoryDate: hit.identity.bodyFactoryDate || "",
            firstOpDate: hit.identity.firstOpDate || "",
            batteryFactoryDate: hit.identity.batteryFactoryDate || "",
            purchaseContractNo: hit.identity.purchaseContractNo || "",
            customsNo: hit.identity.customsNo || "",
            batteryCostMxn: hit.identity.batteryCostMxn || "",
          })
        : base.identity;
      return [...rest, { ...base, identity: kept }];
    });
    return id;
  };

  const patchCardIdentity = (
    cardId: string,
    patch: Partial<AssetIdentityFill>,
  ) =>
    setCards((prev) =>
      prev.map((c) =>
        c.id !== cardId
          ? c
          : {
              ...c,
              identity: emptyIdentity({ ...(c.identity || {}), ...patch }),
              configVariantId:
                patch.configVariantId ?? c.configVariantId,
            },
      ),
    );

  const checkoutCart = () => {
    if (cartLines.length === 0) return;
    const payDate =
      draftPayDate ||
      `${PLAN_BASE_YEAR + Math.max(0, Math.round(cfgYear) - 1)}-10-15`;
    const goLiveDays = goLiveTotalDays(goLiveEffectiveStages(p));
    const goLiveDate = addDaysIso(payDate, goLiveDays);
    const lines: PurchaseOrderLine[] = [];
    for (const { sku, qty, cfgId } of cartLines) {
      const disc = volumeDiscountRate(sku, qty);
      if (sku.kind === "station") {
        const gunsPer = stationGunCount(sku);
        const packs = qty;
        const gunsTotal = Math.max(1, gunsPer * packs);
        const fitout =
          sku.softCosts.find((s) => s.id === "fitout")?.amountMxn ?? 0;
        const deposit =
          sku.softCosts.find((s) => s.id === "deposit")?.amountMxn ?? 0;
        const ops = resolveStationOps(sku);
        setP((prev) => ({
          ...prev,
          chargerGuns: gunsTotal,
          chargerCapexMxn: sku.purchasePriceMxn * (1 - disc) * packs,
          stationFitoutMxn: fitout * packs,
          stationDepositMxn: deposit * packs,
          chargerAcctYears: sku.acctYears,
          chargerPhysYears: sku.physYears,
          chargerMaintYears: sku.maintYears,
          chargerResidualRate: sku.residualRate,
          powerKw: ops.powerKwPerGun,
          externalUtil: ops.externalUtil,
          internalUtil: ops.internalUtil,
          externalPriceMxn: ops.externalPriceMxn,
          internalPriceMxn: ops.internalPriceMxn,
          elecCostMxn: ops.elecCostMxn,
          lossFactor: ops.lossFactor,
          stationRentMxn: ops.rentMonthMxn * packs,
          opexStationMxn: ops.opexMonthMxn * packs,
          stationRampStartLoad: ops.rampStartLoad,
          xiaojufenPct: ops.xiaojufenPct,
          payFeePct: ops.payFeePct,
        }));
        const unitGun =
          (sku.purchasePriceMxn * (1 - disc) + fitout + deposit) /
          Math.max(gunsPer, 1);
        lines.push({
          id: `st-${sku.id}`,
          skuId: sku.id,
          cardId: "station",
          nameZh: sku.nameZh,
          modeLabel: "场站",
          qty: gunsTotal,
          unitLabel: "枪",
          unitLandedMxn: unitGun,
          discountRate: disc,
        });
      } else {
        const useMode: OpMode =
          sku.id === "aion-es"
            ? "DAE"
            : cfgMode === "DAE"
              ? "LTO"
              : cfgMode;
        const cardId = syncCardFromConfig(sku, useMode, qty);
        const variant = resolveConfigVariant(sku, cfgId);
        lines.push({
          id: `${sku.id}-${useMode}`,
          skuId: sku.id,
          cardId,
          nameZh: variant
            ? `${sku.nameZh} · ${variant.nameZh}`
            : sku.nameZh,
          modeLabel: useMode,
          qty,
          unitLabel: sku.unitLabel,
          unitLandedMxn: modelUnitLandedMxn(sku, qty, cfgId),
          discountRate: disc,
        });
      }
    }
    const unitCode = nextAssetUnitCode(
      purchaseOrders.length > 0 ? purchaseOrders : DEFAULT_PURCHASE_ORDERS,
      payDate,
    );
    const order = normalizePurchaseOrder({
      id: `po-${Date.now()}`,
      unitCode,
      label: `资产单元 ${unitCode}`,
      payDate,
      goLiveDate,
      status: "pending_pay",
      lines,
      noteZh: `货架下单 · ${unitCode}；请在「订单」确认付款/投产；已支付后到「资产组合」展开测算（约 ${goLiveDays} 天投产）`,
      managerId: managerIdUse,
      country: cfgCountry,
      vertical: cfgVertical,
      scenario: (p.cashflowScenario ?? "base") as CashflowScenario,
      payPlan: {
        includeDebt: p.includeDebt !== false,
        debtPct:
          p.daeFinancePct ??
          p.stationFinancePct ??
          defaultOrderPayPlan().debtPct,
        debtRate: p.daeFinanceRate ?? 0.14,
        debtYears: p.daeFinanceYears ?? 3,
      },
    });
    setPurchaseOrders((prev) => {
      const next = [...prev.map((o) => normalizePurchaseOrder(o)), order];
      setNodes(ordersToNodes(next));
      return next;
    });
    setOrderFocusId(order.id);
    setCfgCart({});
    setTab("orders");
  };

  const patchOrder = (id: string, patch: Partial<PurchaseOrder>) => {
    setPurchaseOrders((prev) => {
      const baseList =
        prev.length > 0 ? prev : DEFAULT_PURCHASE_ORDERS;
      const next = baseList.map((o) => {
        if (o.id !== id) return normalizePurchaseOrder(o);
        const cur = normalizePurchaseOrder(o);
        return normalizePurchaseOrder({
          ...cur,
          ...patch,
          id: cur.id,
          unitCode: patch.unitCode || cur.unitCode,
          lines: patch.lines ?? cur.lines,
          payPlan: { ...cur.payPlan, ...(patch.payPlan || {}) },
        });
      });
      setNodes(ordersToNodes(next));
      return next;
    });
  };

  const openSkuDetail = (
    id: string,
    pane?:
      | "overview"
      | "ops"
      | "cashflow"
      | "specs"
      | "valuation"
      | "market"
      | "supply",
  ) => {
    setCfgFocusId(id);
    const sku =
      normalizedSkus.find((s) => s.id === resolveSkuId(id)) ||
      DEFAULT_ASSET_SKUS.find((s) => s.id === resolveSkuId(id));
    setSkuDetailPane(
      pane ?? (sku?.kind === "station" ? "specs" : "overview"),
    );
    setTab("skuDetail");
  };

  const openSourceCite = (id: string) => {
    setSourceFocusId(id);
    setTab("sources");
  };

  /** 备注出现处就地挂 [S01] 可点编号 → 信源库 */
  const renderSourceCites = (ids: string[]) => {
    const uniq = [...new Set((ids || []).filter(Boolean))];
    if (!uniq.length) return null;
    return (
      <span
        style={{
          display: "inline-flex",
          flexWrap: "wrap",
          gap: 2,
          alignItems: "center",
          verticalAlign: "baseline",
        }}
      >
        {uniq.map((id) => {
          const s = getSource(id);
          const label = sourceCiteBracket(id);
          const active = sourceFocusId === id;
          return (
            <button
              key={id}
              type="button"
              title={
                s
                  ? `${label} ${s.publisherZh} · ${s.titleZh}（点开信源库）`
                  : `${label} · ${id}`
              }
              onClick={() => openSourceCite(id)}
              style={{
                margin: 0,
                padding: "0 1px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: active ? theme.text.primary : theme.text.secondary,
                textDecoration: active ? "underline" : "none",
                font: "inherit",
                fontSize: "0.92em",
                lineHeight: 1.2,
              }}
            >
              {label}
            </button>
          );
        })}
      </span>
    );
  };

  /** 备注正文 + 就地信源编号 */
  const renderCitedNote = (noteZh: string, ids: string[]) => (
    <span
      style={{
        display: "inline-flex",
        flexWrap: "wrap",
        gap: 6,
        alignItems: "baseline",
      }}
    >
      <Text size="small">{noteZh}</Text>
      {renderSourceCites(ids)}
    </span>
  );

  const focusedSource = sourceFocusId ? getSource(sourceFocusId) : undefined;

  /** 顶栏主路径：订单含资产组合；测算前提单独成组 */
  const ORDER_GROUP: TabId[] = ["orders", "invest", "cashflow", "returns"];
  const PREMISE_GROUP: TabId[] = ["params", "units", "sources"];
  const inOrderGroup = ORDER_GROUP.includes(tab);
  const inPremiseGroup = PREMISE_GROUP.includes(tab);

  const PRIMARY_NAV: {
    id: string;
    label: string;
    active: boolean;
    go: () => void;
  }[] = [
    {
      id: "overview",
      label: "总览",
      active: tab === "overview",
      go: () => setTab("overview"),
    },
    {
      id: "config",
      label: "货架",
      active: tab === "config",
      go: () => setTab("config"),
    },
    {
      id: "orders",
      label: "订单",
      active: inOrderGroup,
      go: () => setTab("orders"),
    },
    {
      id: "ops",
      label: "运营分配",
      active: tab === "ops",
      go: () => setTab("ops"),
    },
    {
      id: "premise",
      label: "测算前提",
      active: inPremiseGroup,
      go: () => setTab("params"),
    },
    {
      id: "related",
      label: "关联交易",
      active: tab === "related",
      go: () => setTab("related"),
    },
  ];

  const ORDER_SUBNAV: { id: TabId; label: string }[] = [
    { id: "orders", label: "订单台账" },
    { id: "invest", label: "资产组合" },
    { id: "returns", label: "分层损益" },
  ];

  const PREMISE_SUBNAV: { id: TabId; label: string }[] = [
    { id: "params", label: "经营假设" },
    { id: "units", label: "SKU库" },
    { id: "sources", label: "信源" },
  ];

  const pageMeta: Partial<Record<TabId, { title: string; description: string }>> =
    {
      cashflow: {
        title: "订单 · 资产组合",
        description:
          "订单批次叠加为单位路径 × 规模，得到组合现金流与 IRR。分层损益见同组子页。",
      },
      config: {
        title: "货架",
        description:
          "选 SKU → 看单位现金流/估值 → 加购生成订单。测算前提（假设/SKU库/信源）先定好再下单。",
      },
      orders: {
        title: "订单 · 台账",
        description:
          "分批资产包：组成、付款/投产、支付方案、管理人。同组下含「资产组合」测算与「分层损益」。",
      },
      ops: {
        title: "运营分配",
        description:
          "按管理人观察在管与同资产对照（赚钱/出险/保值），必要时改挂再平衡。",
      },
      overview: {
        title: "总览 · 综合价值",
        description:
          "组合求 IRR · 公允跟踪估值 · 按管理人调配运营 → 资产价值与投产收益综合最大化。",
      },
      units: {
        title: "测算前提 · SKU库",
        description: "默认购入价、批量折扣与落地杂费——组合测算的资产单价前提。",
      },
      sources: {
        title: "测算前提 · 信源",
        description:
          "业务备注旁的 [S01] 编号点此查询。冲突口径标「待双端」。",
      },
      invest: {
        title: "订单 · 资产组合",
        description:
          "订单的测算层：批次与全组合 CF/IRR、投残汇总。分层损益为同组子项。",
      },
      params: {
        title: "测算前提 · 经营假设",
        description:
          "按性质归档常量，再按业态×模式×资产×情景与 Excel「1.1假设」校验。",
      },
      value: {
        title: "残值 → 商详资产估值",
        description:
          "单 SKU 估值已并入商详「资产估值·残值」；组合投残在订单·资产组合。",
      },
      returns: {
        title: "订单 · 资产组合 · 分层损益",
        description:
          "资产组合子项：单元毛利叠加，再扣场站固定成本与总部费用，到资本层回报。",
      },
      related: {
        title: "关联交易",
        description: "内部充电定价与合并报表抵消。",
      },
    };

  return (
    <Stack
      gap={0}
      style={{
        minHeight: "100%",
        width: "100%",
        minWidth: 0,
        maxWidth: "100%",
        boxSizing: "border-box",
        overflowX: "hidden",
        ...TYPE.body,
        color: theme.text.primary,
      }}
    >
      <style>{INV_OPS_RESPONSIVE_CSS}</style>
      <Stack
        gap={0}
        style={{
          borderBottom: `1px solid ${theme.stroke.tertiary}`,
          background: theme.bg.editor,
          minWidth: 0,
        }}
      >
        <Row
          align="center"
          gap={10}
          wrap
          style={{ padding: "12px 16px 8px", minWidth: 0 }}
        >
          <Stack gap={2} style={{ minWidth: 0, flex: "1 1 200px" }}>
            <Text weight="semibold" style={TYPE.title}>
              墨西哥新能源组合测算
            </Text>
            <Text tone="tertiary" style={TYPE.caption}>
              组合 IRR · 公允估值 · 运营分配 · 综合价值最大化 ·{" "}
              {ccyLabel(ccy)} · FX {fx}
            </Text>
          </Stack>
          <Row gap={4} align="center" style={{ flex: "0 0 auto" }}>
            <Pill active={ccy === "MXN"} onClick={() => setCcy("MXN")}>
              MXN
            </Pill>
            <Pill active={ccy === "USD"} onClick={() => setCcy("USD")}>
              USD
            </Pill>
            <Button variant="ghost" onClick={reset}>
              恢复默认
            </Button>
          </Row>
        </Row>

        {tab === "skuDetail" ? (
          <Row
            gap={10}
            align="center"
            wrap
            style={{ padding: "4px 16px 12px" }}
          >
            <Button variant="ghost" onClick={() => setTab("config")}>
              ← 货架
            </Button>
            <Spacer />
            <Pill size="sm" active>
              {cfgSku?.kind === "station" ? "场站" : "车辆"}
            </Pill>
          </Row>
        ) : (
          <Stack gap={6} style={{ padding: "0 16px 12px", minWidth: 0 }}>
            <Row gap={4} wrap style={{ minWidth: 0 }}>
              {PRIMARY_NAV.map((t) => (
                <Pill key={t.id} active={t.active} onClick={t.go}>
                  {t.label}
                </Pill>
              ))}
            </Row>
            {inOrderGroup && (
              <Row gap={4} wrap style={{ minWidth: 0 }}>
                <Text
                  size="small"
                  tone="tertiary"
                  style={{ ...TYPE.label, alignSelf: "center", marginRight: 4 }}
                >
                  订单内
                </Text>
                {ORDER_SUBNAV.map((t) => (
                  <Pill
                    key={t.id}
                    size="sm"
                    active={
                      t.id === "invest"
                        ? tab === "invest" || tab === "cashflow"
                        : tab === t.id
                    }
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </Pill>
                ))}
              </Row>
            )}
            {inPremiseGroup && (
              <Row gap={4} wrap style={{ minWidth: 0 }}>
                <Text
                  size="small"
                  tone="tertiary"
                  style={{ ...TYPE.label, alignSelf: "center", marginRight: 4 }}
                >
                  前提
                </Text>
                {PREMISE_SUBNAV.map((t) => (
                  <Pill
                    key={t.id}
                    size="sm"
                    active={tab === t.id}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </Pill>
                ))}
              </Row>
            )}
          </Stack>
        )}
      </Stack>

      <Stack
        gap={24}
        style={{
          padding: "clamp(14px, 2vw, 24px) clamp(12px, 1.5vw, 20px) 48px",
          maxWidth: "100%",
          width: "100%",
          boxSizing: "border-box",
          minWidth: 0,
          overflowX: "hidden",
        }}
      >
      {tab === "config" && cfgSku && (
        <Stack gap={20}>
          <PageIntro
            title={pageMeta.config!.title}
            description={pageMeta.config!.description}
          />

          <Grid columns={GRID_CARDS} gap={12}>
            {normalizedSkus.map((sku) => {
              const qty = cartQtyOf(cfgCart, sku.id);
              const active = focusId === sku.id;
              const hovered = hoverSkuId === sku.id;
              const lit = active || hovered;
              const disc = volumeDiscountRate(sku, Math.max(qty, 1));
              const cfgId = selectedConfigId(sku, cfgConfigBySku);
              const cfg = resolveConfigVariant(sku, cfgId);
              const variants = sku.configVariants || [];
              const unit = modelUnitGrossMxn(
                sku,
                Math.max(qty, 1),
                p.vat,
                cfgId,
              );
              const unitNet = modelUnitPreTaxMxn(
                sku,
                Math.max(qty, 1),
                p.vat,
                cfgId,
              );
              const guideGross = skuPricesIncludeVat(sku)
                ? skuGuidePriceMxn(sku, cfgId) + modelSoftSum(sku)
                : (skuGuidePriceMxn(sku, cfgId) + modelSoftSum(sku)) *
                  (1 + Math.max(0, p.vat));
              return (
                <div
                  key={sku.id}
                  onMouseEnter={() => setHoverSkuId(sku.id)}
                  onMouseLeave={() => setHoverSkuId("")}
                  style={mergeStyle({
                    border: `${active ? 2 : 1}px solid ${
                      lit ? theme.stroke.primary : theme.stroke.tertiary
                    }`,
                    background: theme.bg.elevated,
                    overflow: "hidden",
                    cursor: "pointer",
                  })}
                >
                  <Button
                    variant="ghost"
                    onClick={() => openSkuDetail(sku.id)}
                    style={{
                      width: "100%",
                      height: "auto",
                      padding: 0,
                      display: "block",
                      textAlign: "left",
                      borderRadius: 0,
                    }}
                  >
                    <div
                      style={mergeStyle({
                        height: 72,
                        background: theme.fill.tertiary,
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        padding: "10px 12px",
                      })}
                    >
                      <Text
                        weight="semibold"
                        tone="tertiary"
                        style={{ ...TYPE.label, color: theme.text.tertiary }}
                      >
                        {sku.brand}
                      </Text>
                      <Pill size="sm" active={active}>
                        {sku.kind === "station" ? "场站" : "车辆"}
                      </Pill>
                    </div>
                    <Stack gap={6} style={{ padding: 12 }}>
                      <Text weight="semibold">{sku.nameZh}</Text>
                      <Text size="small" tone="secondary" truncate>
                        {sku.tagline}
                      </Text>
                      <Text size="small" tone="tertiary" truncate>
                        {shelfSpecSummary(sku, cfg)}
                      </Text>
                      <Row align="baseline" gap={8}>
                        <Text
                          weight="semibold"
                          style={{ color: theme.text.primary }}
                        >
                          {moneyMxn(unit, fx, ccy)}
                        </Text>
                        <Text
                          size="small"
                          tone="tertiary"
                          style={{ textDecoration: "line-through" }}
                        >
                          {moneyMxn(guideGross, fx, ccy)}
                        </Text>
                      </Row>
                      <Text size="small" tone="tertiary">
                        含税落地/{sku.unitLabel}
                        {skuPricesIncludeVat(sku)
                          ? "（案例列载含税，不再加 IVA）"
                          : `（IVA ${pct(p.vat)}）`}
                        {qty > 0 ? `，批量折扣 ${pct(disc)}` : ""}
                        ；{skuPricesIncludeVat(sku) ? "估列未税" : "未税"}{" "}
                        {moneyMxn(unitNet, fx, ccy)}
                        ，起订{skuMinQty(sku)}，步长{skuStep(sku)}，上限
                        {skuMaxQty(sku)}
                      </Text>
                    </Stack>
                  </Button>
                  <Stack gap={8} style={{ padding: "0 12px 12px" }}>
                    {variants.length > 0 && (
                      <Stack gap={4}>
                        <Text size="small" tone="secondary">
                          {sku.kind === "station"
                            ? "场站规格档"
                            : "续航/电池档"}
                        </Text>
                        <Select
                          value={cfgId || variants[0]!.id}
                          onChange={(v) => {
                            setCfgConfigBySku((prev) => ({
                              ...prev,
                              [sku.id]: v,
                            }));
                            setCfgFocusId(sku.id);
                          }}
                          options={variants.map((c) => ({
                            value: c.id,
                            label: shelfVariantOptionLabel(sku, c, fx, ccy),
                          }))}
                        />
                      </Stack>
                    )}
                    <Row gap={8} align="center">
                      <IconButton
                        title="减少"
                        size="sm"
                        variant="circle"
                        onClick={() => bumpCart(sku.id, -1)}
                      >
                        −
                      </IconButton>
                      <Text
                        weight="semibold"
                        style={{ minWidth: 28, textAlign: "center" }}
                      >
                        {qty}
                      </Text>
                      <IconButton
                        title="增加"
                        size="sm"
                        variant="circle"
                        onClick={() => bumpCart(sku.id, 1)}
                      >
                        +
                      </IconButton>
                      <Spacer />
                      <Button
                        variant="secondary"
                        onClick={() =>
                          bumpCart(
                            sku.id,
                            Math.max(skuStep(sku) * 10, 10),
                          )
                        }
                      >
                        +{Math.max(skuStep(sku) * 10, 10)}
                      </Button>
                    </Row>
                  </Stack>
                </div>
              );
            })}
          </Grid>

          <Row gap={10} align="center" wrap>
            <Text size="small" tone="secondary">
              已选 · {cfgSku.nameZh}
            </Text>
            <Spacer />
            <Button
              variant="secondary"
              onClick={() => openSkuDetail(cfgSku.id)}
            >
              打开商详
            </Button>
          </Row>

          <Divider />

          <H3 style={TYPE.h3}>购物车</H3>
          <Text size="small" tone="tertiary">
            期初先评估一台车 / 一座场站（商详：单位现金流 + 资产估值），再加购下单。订单内：台账 → 资产组合（CF/IRR）→ 分层损益；测算前提在顶栏「测算前提」。
          </Text>
          <Stack gap={4} style={{ maxWidth: 280 }}>
            <Text size="small" tone="secondary">
              计划付款日（写入订单）
            </Text>
            <TextInput
              value={draftPayDate}
              placeholder="YYYY-MM-DD"
              onChange={setDraftPayDate}
            />
          </Stack>
          {cartLines.length === 0 ? (
            <Text size="small" tone="tertiary">
              购物车为空。在上方货架点加号加购。
            </Text>
          ) : (
            <Stack gap={10}>
              <Table
                headers={[
                  "SKU / 续航档",
                  "类型",
                  "数量",
                  "批量折扣",
                  `未税落地（${ccy}）`,
                  `含税落地（${ccy}）`,
                  `行金额含税（${ccy}）`,
                  "",
                ]}
                columnAlign={[
                  "left",
                  "left",
                  "right",
                  "right",
                  "right",
                  "right",
                  "right",
                  "right",
                ]}
                rows={cartLines.map(({ sku, qty, cfgId }) => {
                  const uNet = modelUnitPreTaxMxn(sku, qty, p.vat, cfgId);
                  const uGross = modelUnitGrossMxn(sku, qty, p.vat, cfgId);
                  const variant = resolveConfigVariant(sku, cfgId);
                  return [
                    variant
                      ? `${sku.nameZh} · ${variant.nameZh}`
                      : sku.nameZh,
                    sku.kind === "station" ? "充电站" : "车辆",
                    `${qty}${sku.unitLabel}`,
                    pct(volumeDiscountRate(sku, qty)),
                    moneyMxn(uNet, fx, ccy),
                    moneyMxn(uGross, fx, ccy),
                    moneyMxn(uGross * qty, fx, ccy),
                    "",
                  ];
                })}
              />
              <Row gap={12} align="center" wrap>
                {cartLines.map(({ sku, qty, cfgId }) => (
                  <Row key={sku.id} gap={6} align="center">
                    <Text size="small">
                      {sku.nameZh}
                      {resolveConfigVariant(sku, cfgId)
                        ? ` · ${resolveConfigVariant(sku, cfgId)!.nameZh}`
                        : ""}
                    </Text>
                    <IconButton
                      title="减"
                      size="sm"
                      onClick={() => bumpCart(sku.id, -1)}
                    >
                      −
                    </IconButton>
                    <Text size="small">{qty}</Text>
                    <IconButton
                      title="加"
                      size="sm"
                      onClick={() => bumpCart(sku.id, 1)}
                    >
                      +
                    </IconButton>
                    <Button
                      variant="ghost"
                      onClick={() => setCartQty(sku.id, 0)}
                    >
                      移除
                    </Button>
                  </Row>
                ))}
                <Spacer />
                <Stack gap={4} style={{ alignItems: "flex-end" }}>
                  <Stat
                    label={`购物车合计含税（${ccy}）`}
                    value={moneyMxn(cartTotalMxn, fx, ccy)}
                    tone="neutral"
                  />
                  <Text size="small" tone="tertiary">
                    未税估列 {moneyMxn(cartNetMxn, fx, ccy)} · IVA{" "}
                    {pct(p.vat)} 约 {moneyMxn(cartIvaMxn, fx, ccy)}
                    （押金不计税；案例列载含税车型不再加税）
                  </Text>
                </Stack>
              </Row>
            </Stack>
          )}

          <Row gap={12} align="center" wrap>
            <Button
              variant="primary"
              disabled={cartLines.length === 0}
              onClick={checkoutCart}
            >
              生成订单（{cartLines.length} 项）
            </Button>
            <Button variant="ghost" onClick={() => setTab("orders")}>
              订单台账
            </Button>
            <Button variant="ghost" onClick={() => setTab("invest")}>
              资产组合
            </Button>
            <Text size="small" tone="secondary">
              合计含税 {moneyMxn(cartTotalMxn, fx, ccy)} {ccy}（未税估列{" "}
              {moneyMxn(cartNetMxn, fx, ccy)} · IVA{" "}
              {moneyMxn(cartIvaMxn, fx, ccy)}），付款日{" "}
              {draftPayDate || "未填"} · 下单后进「订单」，测算在「资产组合」
            </Text>
          </Row>
        </Stack>
      )}

      {tab === "skuDetail" && cfgSku && (() => {
        const skuFolders = [
          { id: "overview" as const, label: "概览" },
          { id: "specs" as const, label: "规格" },
          { id: "ops" as const, label: "单位现金流" },
          { id: "valuation" as const, label: "资产估值·残值" },
          ...(cfgSku.marketIntel
            ? [{ id: "market" as const, label: "市场口碑" }]
            : []),
          { id: "supply" as const, label: "供应链" },
        ];
        const paneRaw =
          skuDetailPane === "cashflow" ? "ops" : skuDetailPane;
        const skuPane = skuFolders.some((f) => f.id === paneRaw)
          ? paneRaw
          : "overview";
        const opsScMul = 1; // 情景已写入单位常量，不再二次乘倍率
        const gunsForOps =
          cfgSku.kind === "station" ? stationGunCount(cfgSku) : 0;
        const stOps =
          cfgSku.kind === "station"
            ? applyScenarioToStationOps(
                resolveStationOps(cfgSku),
                skuOpsScenario,
                stationOpsScaleOf(cfgSku),
              )
            : defaultStationOpsConstants();
        const gunKwhFullMo = (stOps.powerKwPerGun || 40) * 24 * 30;
        const stExtRevGunMo =
          gunKwhFullMo * stOps.externalUtil * stOps.externalPriceMxn;
        const stIntRevGunMo =
          gunKwhFullMo * stOps.internalUtil * stOps.internalPriceMxn;
        const stVarGunMo =
          gunKwhFullMo *
          (stOps.externalUtil + stOps.internalUtil) *
          stOps.lossFactor *
          stOps.elecCostMxn;
        const stRevMo =
          gunsForOps *
          (stExtRevGunMo + stIntRevGunMo) *
          stOps.rampStartLoad;
        const stVarMo = gunsForOps * stVarGunMo;
        const stFixedMo =
          gunsForOps > 0
            ? stOps.rentMonthMxn + stOps.opexMonthMxn + cfgSku.maintMxn
            : 0;
        const stNetMo = stRevMo - stVarMo - stFixedMo;
        const unitLanded1 = modelUnitGrossMxn(
          cfgSku,
          1,
          p.vat,
          selectedConfigId(cfgSku, cfgConfigBySku),
        );
        const daysMoLive = opsDaysPerMonth(cfCardLive.daysWeek || 6);
        const cfQtySafe = Math.max(1, Math.round(cfQty || 1));
        const unitBars = cfBars.map((b) => ({
          ...b,
          netMxn: b.netMxn / cfQtySafe,
          opsInMxn: b.opsInMxn / cfQtySafe,
          equityInMxn: b.equityInMxn / cfQtySafe,
          outflowMxn: b.outflowMxn / cfQtySafe,
          capexMxn: b.capexMxn / cfQtySafe,
        }));
        const firstOpsBar = unitBars.find((b) => b.label.startsWith("经营"));
        const unitMonthEquity =
          cfgSku.kind === "vehicle"
            ? firstOpsBar != null
              ? firstOpsBar.netMxn
              : cfDay.spvResidualMxn * daysMoLive
            : stNetMo;
        /** 期初投入=购置+保证金锁定+投产前空窗（与回本条「投入」同口径，≠顶栏单台含税落地） */
        const unitInitInvestMxn = unitBars
          .filter((b) => !b.label.startsWith("经营"))
          .reduce((s, b) => s + (b.outflowMxn || 0), 0);
        /** 单车月度净路径 IRR（月率年化）；与时序图同一套 unitBars 口径 */
        const unitIrrSeries = unitBars.map((b) => b.netMxn);
        const unitIrrMo = irr(unitIrrSeries);
        const unitIrrAnn =
          unitIrrMo != null && unitIrrMo > -0.99
            ? Math.pow(1 + unitIrrMo, 12) - 1
            : null;
        const unitNpvMxn = npvAnnualOnMonths(
          unitIrrSeries,
          UNIT_CF_DISCOUNT_ANN,
        );
        const unitStaticPb = staticPaybackPeriod(unitIrrSeries);
        const unitDynamicPb = dynamicPaybackPeriod(
          unitIrrSeries,
          UNIT_CF_DISCOUNT_ANN,
        );
        /** 简单静态：期初投入 ÷ 瀑布后月净（不含空窗节奏，作对照） */
        const unitStaticSimpleMo =
          unitMonthEquity > 1 && unitInitInvestMxn > 0
            ? unitInitInvestMxn / unitMonthEquity
            : null;
        const unitOpsYearsNote = Math.max(
          1,
          Math.round((cfCfgLive.horizonMonths || 60) / 12),
        );
        const scCompare = SCENARIO_OPTS.map((opt) => {
          if (cfgSku.kind === "station") {
            const opsSc = applyScenarioToStationOps(
              resolveStationOps(cfgSku),
              opt.id,
              stationOpsScaleOf(cfgSku),
            );
            const ext =
              gunKwhFullMo * opsSc.externalUtil * opsSc.externalPriceMxn;
            const int =
              gunKwhFullMo * opsSc.internalUtil * opsSc.internalPriceMxn;
            const v =
              gunKwhFullMo *
              (opsSc.externalUtil + opsSc.internalUtil) *
              opsSc.lossFactor *
              opsSc.elecCostMxn;
            const fixed =
              opsSc.rentMonthMxn + opsSc.opexMonthMxn + cfgSku.maintMxn;
            const rev =
              gunsForOps * (ext + int) * opsSc.rampStartLoad;
            const mid = gunsForOps * v;
            const net = rev - mid - fixed;
            return {
              ...opt,
              top: rev,
              mid: mid + fixed,
              bottom: net,
            };
          }
          const cardBase = applyScenarioToVehicleCard(
            {
              ...cfCardBase,
              shiftsPerDay: cfCardLive.shiftsPerDay,
            },
            opt.id,
          );
          const daySc = buildAssetDayCashflow({
            country: cfgCountry,
            vertical: cfgVertical,
            mode: cfModeUse,
            card: cardBase,
            sku: cfSku,
            cfg: cfCfgLive,
            internalPriceMxn:
              cfModeUse === "DAE"
                ? DAE_SCENARIO_KNOBS[opt.id].elecMxn
                : p.internalPriceMxn,
            unitLandedMxn: unitLanded1,
            opsMonth: 1,
          });
          return {
            ...opt,
            top: daySc.passengerPayMxn,
            mid: daySc.spvInflowMxn,
            bottom: daySc.spvResidualMxn,
          };
        });
        return (
        <Stack gap={skuPane === "ops" ? 8 : 20}>
          {skuPane !== "ops" ? (
            <>
          {/* 商详顶栏：身份 + 档位（唯一切换口）+ 报价；页签内勿再重复这三项 */}
          <PageIntro
            title={cfgSku.nameZh}
            description={skuDetailSubtitleZh(cfgSku)}
          />

          {cfgSku.kind !== "station" &&
            (cfgSku.configVariants || []).length > 0 && (
              <Stack gap={6}>
                <Text size="small" weight="medium">
                  配置档
                </Text>
                <Select
                  value={selectedConfigId(cfgSku, cfgConfigBySku)}
                  onChange={(v) =>
                    setCfgConfigBySku((prev) => ({
                      ...prev,
                      [cfgSku.id]: v,
                    }))
                  }
                  options={(cfgSku.configVariants || []).map((c) => ({
                    value: c.id,
                    label: configVariantSelectLabel(c),
                  }))}
                />
                <Text size="small" tone="tertiary">
                  {skuPricesIncludeVat(cfgSku)
                    ? "切换档位同步报价与规格；案例列载含税，不再加 IVA。"
                    : "切换档位同步报价与规格。"}
                </Text>
              </Stack>
            )}

          <Grid columns={GRID_STATS} gap={12}>
            <Stat
              label={`购入价${skuPriceBasisZh(cfgSku)}（${ccy}）`}
              value={moneyMxn(
                skuPurchasePriceMxn(
                  cfgSku,
                  selectedConfigId(cfgSku, cfgConfigBySku),
                ),
                fx,
                ccy,
              )}
            />
            <Stat
              label={`指导价${skuPriceBasisZh(cfgSku)}（${ccy}）`}
              value={moneyMxn(
                skuGuidePriceMxn(
                  cfgSku,
                  selectedConfigId(cfgSku, cfgConfigBySku),
                ),
                fx,
                ccy,
              )}
            />
            <Stat
              label={`单${cfgSku.unitLabel}含税落地（${ccy}）`}
              value={moneyMxn(
                modelUnitGrossMxn(
                  cfgSku,
                  Math.max(cfgQty, 1),
                  p.vat,
                  selectedConfigId(cfgSku, cfgConfigBySku),
                ),
                fx,
                ccy,
              )}
            />
          </Grid>

          <Row gap={8} align="center" wrap>
            <Button
              variant="secondary"
              onClick={() =>
                bumpCart(
                  cfgSku.id,
                  cfgQty > 0
                    ? skuStep(cfgSku)
                    : cfgSku.defaultQty || 1,
                )
              }
            >
              加购到购物车
            </Button>
            <Button variant="ghost" onClick={() => setTab("config")}>
              返回货架
            </Button>
          </Row>
            </>
          ) : null}

          <Row gap={4} wrap>
            {skuFolders.map((f) => (
              <Pill
                key={f.id}
                active={skuPane === f.id}
                onClick={() => setSkuDetailPane(f.id)}
              >
                {f.label}
              </Pill>
            ))}
          </Row>

          {skuPane === "overview" && (
            <Stack gap={14}>
              {(() => {
                const overviewCard = {
                  padding: 12,
                  borderRadius: 8,
                  border: `1px solid ${theme.stroke.secondary}`,
                  background: theme.bg.elevated,
                  minWidth: 0,
                } as const;
                const cfgId = selectedConfigId(cfgSku, cfgConfigBySku);
                const specRows = productSpecsForSelectedVariant(
                  cfgSku,
                  cfgId,
                ).filter((r) => r.status === "known" && r.valueZh);
                const highlightSpecs = specRows.slice(0, 5);
                const softSum = modelSoftSum(cfgSku);
                const softLines = (cfgSku.softCosts || []).filter(
                  (s) => s.amountMxn > 0,
                );
                const majors = (cfgSku.majorComponents || []).slice(0, 4);
                const mi = cfgSku.marketIntel;
                const term = mi ? reputationTerminal(mi.reputation) : null;
                const parc = mi
                  ? resolveMarketParc(mi, marketParcCountry)
                  : null;
                const pendingN = supplyChainPending(cfgSku).length;
                const chainN = (cfgSku.supplyChain || []).length;
                const relatedN = (cfgSku.supplyChain || []).filter((n) =>
                  Object.values(n.relatedParty || {}).some((f) => f === "yes"),
                ).length;
                const goPane = (
                  id:
                    | "specs"
                    | "ops"
                    | "valuation"
                    | "market"
                    | "supply",
                ) => setSkuDetailPane(id);
                return (
                  <>
                    <Text size="small" tone="tertiary">
                      概览汇总规格 / 单位现金流 / 资产估值 / 市场口碑 /
                      供应链要点；点「查看」进入对应页签。
                    </Text>
                    <Grid
                      columns="repeat(auto-fit, minmax(240px, 1fr))"
                      gap={10}
                    >
                      <Stack gap={8} style={overviewCard}>
                        <Row gap={8} align="center" wrap>
                          <Text size="small" weight="medium">
                            规格
                          </Text>
                          <Spacer />
                          <Button
                            variant="ghost"
                            onClick={() => goPane("specs")}
                          >
                            查看
                          </Button>
                        </Row>
                        {highlightSpecs.length > 0 ? (
                          highlightSpecs.map((r) => (
                            <Row
                              key={r.id}
                              gap={8}
                              align="start"
                              style={{ justifyContent: "space-between" }}
                            >
                              <Text size="small" tone="tertiary">
                                {r.labelZh}
                              </Text>
                              <Text
                                size="small"
                                style={{ textAlign: "right", maxWidth: "58%" }}
                              >
                                {r.valueZh}
                              </Text>
                            </Row>
                          ))
                        ) : (
                          <Text size="small" tone="tertiary">
                            暂无规格行
                          </Text>
                        )}
                        {majors.length > 0 ? (
                          <Text size="small" tone="tertiary">
                            四大件：
                            {majors
                              .map((m) => m.brandZh || m.nameZh)
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        ) : null}
                        <Text size="small" tone="tertiary">
                          皮费合计 {moneyMxn(softSum, fx, ccy)}
                          {softLines.length
                            ? ` · ${softLines.map((s) => s.nameZh).join("、")}`
                            : ""}
                        </Text>
                      </Stack>

                      <Stack gap={8} style={overviewCard}>
                        <Row gap={8} align="center" wrap>
                          <Text size="small" weight="medium">
                            单位现金流
                          </Text>
                          <Spacer />
                          <Button
                            variant="ghost"
                            onClick={() => goPane("ops")}
                          >
                            查看
                          </Button>
                        </Row>
                        <Text size="small">
                          模式 {cfModeUse}
                          {cfgSku.kind === "vehicle"
                            ? ` · ${cfgVertical.replace("网约车·", "")}`
                            : " · 场站"}
                        </Text>
                        <Text size="small">
                          IRR{" "}
                          {unitIrrAnn != null ? pct(unitIrrAnn, 1) : "—"}
                          · NPV({pct(UNIT_CF_DISCOUNT_ANN, 0)}){" "}
                          {(unitNpvMxn >= 0 ? "+" : "") +
                            moneyMxn(unitNpvMxn, fx, ccy, 0)}
                        </Text>
                        <Text size="small">
                          静态回本{" "}
                          {unitStaticPb.months != null
                            ? `${unitStaticPb.months}月`
                            : "—"}
                          · 动态回本{" "}
                          {unitDynamicPb.months != null
                            ? `第${unitDynamicPb.months}月`
                            : "—"}
                        </Text>
                        <Text size="small">
                          期初投入 {moneyMxn(unitInitInvestMxn, fx, ccy, 0)}
                          · 月净 {moneyMxn(unitMonthEquity, fx, ccy, 0)}
                        </Text>
                        <Text size="small" tone="tertiary">
                          核算因子 / 回本条 / 收支时序见「单位现金流」
                        </Text>
                      </Stack>

                      <Stack gap={8} style={overviewCard}>
                        <Row gap={8} align="center" wrap>
                          <Text size="small" weight="medium">
                            资产估值 · 残值
                          </Text>
                          <Spacer />
                          <Button
                            variant="ghost"
                            onClick={() => goPane("valuation")}
                          >
                            查看
                          </Button>
                        </Row>
                        <Text size="small">
                          寿命 会计{cfgSku.acctYears}/物理
                          {cfgSku.physYears}/维保{cfgSku.maintYears} 年
                        </Text>
                        <Text size="small">
                          期末残值率 会计
                          {pct(cfgSku.residualRate, 0)}
                          ·物理
                          {pct(cfgSku.physResidualRate, 0)}
                          ·维保
                          {pct(cfgSku.maintResidualRate, 0)}
                        </Text>
                        <Text size="small" tone="tertiary">
                          {cfgSku.maintPolicyZh}
                        </Text>
                      </Stack>

                      {mi && term ? (
                        <Stack gap={8} style={overviewCard}>
                          <Row gap={8} align="center" wrap>
                            <Text size="small" weight="medium">
                              市场口碑
                            </Text>
                            <Spacer />
                            <Button
                              variant="ghost"
                              onClick={() => goPane("market")}
                            >
                              查看
                            </Button>
                          </Row>
                          <Text size="small">
                            终端综合 {term.score.toFixed(2)} ·{" "}
                            {term.gradeZh}
                            · 评 {term.reviews} 条
                          </Text>
                          <Text size="small" tone="tertiary">
                            {term.diffZh} · {term.saturationZh}
                          </Text>
                          {parc ? (
                            <Text size="small" tone="tertiary">
                              保有（{parc.countryZh}）{parc.labelZh}
                              {parc.value > 0
                                ? ` · ${fmt(parc.value, parc.value >= 10 ? 0 : 1)}${parc.unitZh}`
                                : " · 待补"}
                            </Text>
                          ) : null}
                          <Text size="small" tone="tertiary">
                            {mi.scopeZh}
                          </Text>
                        </Stack>
                      ) : null}

                      <Stack gap={8} style={overviewCard}>
                        <Row gap={8} align="center" wrap>
                          <Text size="small" weight="medium">
                            供应链
                          </Text>
                          <Spacer />
                          <Button
                            variant="ghost"
                            onClick={() => goPane("supply")}
                          >
                            查看
                          </Button>
                        </Row>
                        <Text size="small">
                          {chainN} 个节点
                          {pendingN > 0
                            ? ` · ${pendingN} 个待补齐`
                            : " · 主体与关联方已齐"}
                        </Text>
                        <Text size="small" tone="tertiary">
                          当前运营商 {cfgManagerMeta.nameZh}
                          {relatedN > 0
                            ? ` · 关联方节点约 ${relatedN}`
                            : ""}
                        </Text>
                        <Text size="small" tone="tertiary">
                          供应商 → 工厂追溯；关联方按运营商判定
                        </Text>
                      </Stack>
                    </Grid>
                  </>
                );
              })()}
            </Stack>
          )}

          {skuPane === "ops" && (
            <div
              className="inv-ops-shell"
              style={mergeStyle({
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: 8,
                border: `1px solid ${theme.stroke.tertiary}`,
                background: theme.bg.editor,
                height: "min(82vh, 860px)",
                maxHeight: "82vh",
                overflow: "hidden",
                boxSizing: "border-box",
              })}
            >
              <Row gap={6} align="center" wrap>
                <Text size="small" weight="semibold">
                  单位现金流
                </Text>
                <Pill size="sm" active>
                  投资人
                </Pill>
                <Text size="small" tone="tertiary">
                  上指标 · 下左假设 · 下右图 · 列内滚
                </Text>
                <Spacer />
                <Text size="small" tone="tertiary">
                  {cfgSku.nameZh}
                  {cfgSku.kind === "station" ? " · 场站" : " · 车辆"}
                </Text>
              </Row>
              <Row gap={6} align="center" wrap>
                {cfgSku.kind === "vehicle" ? (
                  <>
                    {VERTICAL_OPTS.map((v) => (
                      <Pill
                        key={v}
                        size="sm"
                        active={cfgVertical === v}
                        onClick={() => {
                          setCfgVertical(v);
                          if (v.includes("专车")) {
                            setCfgMode("DAE");
                            reseedSkuCf(cfgSku, "DAE");
                          } else if (v.includes("快车") && cfModeUse === "DAE") {
                            setCfgMode("LTO");
                            reseedSkuCf(cfgSku, "LTO");
                          }
                        }}
                      >
                        {v.replace("网约车·", "")}
                      </Pill>
                    ))}
                    <Pill
                      size="sm"
                      active={cfModeUse === "DAE"}
                      onClick={() => {
                        setCfgMode("DAE");
                        reseedSkuCf(cfgSku, "DAE");
                      }}
                    >
                      DAE
                    </Pill>
                    <Pill
                      size="sm"
                      active={cfModeUse === "LTO"}
                      onClick={() => {
                        setCfgMode("LTO");
                        setDaeShift("single");
                        reseedSkuCf(cfgSku, "LTO");
                      }}
                    >
                      LTO
                    </Pill>
                    {cfModeUse === "DAE" ? (
                      <>
                        <Pill
                          size="sm"
                          active={daeShift === "single"}
                          onClick={() => setDaeShift("single")}
                        >
                          {DAE_SHIFT_LABEL.single}
                        </Pill>
                        <Pill
                          size="sm"
                          active={daeShift === "double"}
                          onClick={() => setDaeShift("double")}
                        >
                          {DAE_SHIFT_LABEL.double}
                        </Pill>
                      </>
                    ) : null}
                  </>
                ) : null}
                {SCENARIO_OPTS.map((opt) => (
                  <Pill
                    key={opt.id}
                    size="sm"
                    active={skuOpsScenario === opt.id}
                    onClick={() => {
                      setInvAssume({});
                      setSkuOpsScenario(opt.id);
                    }}
                  >
                    {opt.label}
                  </Pill>
                ))}
              </Row>

              {/* 投资人：上核心输出 · 下假设+实时两列 */}
              <div
                className="inv-ops-body"
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                  {cfgSku.kind === "vehicle" && cfgSku.id === cfSku.id && (() => {
                    const invTier =
                      cfCfgLive.spvTiers.find((x) => x.id === "investor_pi") ||
                      cfCfgLive.spvTiers[0]!;
                    const wageTier =
                      cfCfgLive.spvTiers.find((x) => x.id === "driver_wage") ||
                      cfCfgLive.spvTiers[1]!;
                    const opexTier =
                      cfCfgLive.spvTiers.find((x) => x.id === "other_opex") ||
                      cfCfgLive.spvTiers[2]!;
                    const inv = normalizeInvestorPi(
                      invTier.investor || defaultInvestorPi(),
                    );
                    const wage =
                      wageTier.wage ||
                      defaultDriverWage(
                        cfModeUse,
                        daeDriverMonthMxn(cfCardLive) /
                          opsDaysPerMonth(cfCardLive.daysWeek || 6),
                        opsDaysPerMonth(cfCardLive.daysWeek || 6),
                      );
                    const varItems =
                      opexTier.varOpex?.items || defaultVarOpexItems();
                    const shareItems = varItems.filter(
                      (it) => it.kind === "pct_pool",
                    );
                    const dayCostItems = varItems.filter(
                      (it) => it.kind === "fixed_day",
                    );
                    const prinMxn = cfUnitLanded1 * inv.principalPct;
                    const moPay = investorMonthPayMxn(inv, prinMxn, 1);
                    const depositMxn = investorDepositMxn(inv, cfUnitLanded1);
                    const wageFullTime = !!wageTier.enabled;
                    /** 可变成本：与当前路径/瀑布一致的计入对照（改开关即更新） */
                    const chargeDayLive =
                      cfCfgLive.chargeDayMxn > 0
                        ? cfCfgLive.chargeDayMxn
                        : chargeDayFromAmount(
                            cfCfgLive.chargeAmountMxn || 0,
                            cfCfgLive.chargeCycle || "day",
                            cfCardLive.daysWeek || 6,
                          );
                    const varOnLines: string[] = [];
                    const varOffLines: string[] = [];
                    if (cfCfgLive.paymentFeePct > 1e-9) {
                      varOnLines.push(
                        `通道费 ${Math.round(cfCfgLive.paymentFeePct * 1000) / 10}%`,
                      );
                    } else {
                      varOffLines.push("通道费（费率 0）");
                    }
                    if (cfCfgLive.platformTakePct > 1e-9) {
                      varOnLines.push(
                        `平台抽成 ${Math.round(cfCfgLive.platformTakePct * 1000) / 10}%`,
                      );
                    } else {
                      varOffLines.push("平台抽成（费率 0）");
                    }
                    if (chargeDayLive > 0.01) {
                      varOnLines.push(
                        `充电 日≈${fmt(chargeDayLive / fx, 1)}${ccy}`,
                      );
                    } else {
                      varOffLines.push("充电（日额≈0）");
                    }
                    if (
                      cfCfgLive.fixWearOn &&
                      (cfCfgLive.randomMaintMonthMxn || 0) > 0.01
                    ) {
                      varOnLines.push(
                        `易损件 月≈${fmt(cfCfgLive.randomMaintMonthMxn / fx, 1)}${ccy}`,
                      );
                    } else {
                      varOffLines.push(
                        cfCfgLive.fixWearOn
                          ? "易损件（月额≈0）"
                          : "易损件（开关关）",
                      );
                    }
                    if (wageFullTime) {
                      const wDay = wageReserveDayMxn(wage, cfCardLive);
                      varOnLines.push(
                        `司机全职 日≈${fmt(wDay / fx, 1)}${ccy}`,
                      );
                    } else {
                      varOffLines.push("司机（合作·不预留底薪）");
                    }
                    const varCostOn = cfCfgLive.varCostEnabled !== false;
                    const fixCostOn = cfCfgLive.fixedCostEnabled !== false;
                    for (const it of dayCostItems) {
                      if (
                        varCostOn &&
                        it.enabled &&
                        (it.fixedDayMxn || 0) > 0
                      ) {
                        varOnLines.push(
                          `${it.nameZh} 日${fmt((it.fixedDayMxn || 0) / fx, 1)}${ccy}`,
                        );
                      } else {
                        varOffLines.push(
                          `${it.nameZh}（${!varCostOn ? "可变总开关关" : !it.enabled ? "分项关" : "日额0"}）`,
                        );
                      }
                    }
                    /** 三卡年化合计（仅计入路径的项；费率类按当日瀑布×营运日×12） */
                    const daysMoCard = opsDaysPerMonth(cfCardLive.daysWeek || 6);
                    const sliceDay = (id: string) =>
                      (cfDay.slices || []).find((s) => s.id === id)?.amountMxn ||
                      0;
                    const feeYrMxn =
                      (sliceDay("pay_fee") + sliceDay("platform")) *
                      daysMoCard *
                      12;
                    const chargeYrMxn =
                      varCostOn && chargeDayLive > 0.01
                        ? chargeDayLive * daysMoCard * 12
                        : 0;
                    const wearYrMxn =
                      varCostOn &&
                      cfCfgLive.fixWearOn &&
                      (cfCfgLive.randomMaintMonthMxn || 0) > 0.01
                        ? cfCfgLive.randomMaintMonthMxn * 12
                        : 0;
                    const wageYrMxn =
                      varCostOn && wageFullTime
                        ? wageReserveDayMxn(wage, cfCardLive) *
                          daysMoCard *
                          12
                        : 0;
                    const dayOpexYrMxn = dayCostItems.reduce((s, it) => {
                      if (
                        !(
                          varCostOn &&
                          it.enabled &&
                          (it.fixedDayMxn || 0) > 0
                        )
                      )
                        return s;
                      return s + (it.fixedDayMxn || 0) * daysMoCard * 12;
                    }, 0);
                    const varCostYrMxn =
                      chargeYrMxn +
                      wearYrMxn +
                      wageYrMxn +
                      dayOpexYrMxn;
                    const contractFixYrMxn = fixCostOn
                      ? cfCfgLive.annualMaintMxn || 0
                      : 0;
                    const discYrMxn = shareItems.reduce((s, it) => {
                      if (!(fixCostOn && it.enabled)) return s;
                      return s + sliceDay(it.id) * daysMoCard * 12;
                    }, 0);
                    const fixedCostYrMxn = contractFixYrMxn + discYrMxn;
                    /** 冲单展示：取当日 slice 实扣，或按分项%估算 */
                    let poolBeforeDisc = cfDay.spvInflowMxn || 0;
                    for (const s of cfDay.slices || []) {
                      if (s.id === "driver_wage") {
                        poolBeforeDisc = s.remainingAfterMxn;
                      }
                    }
                    const investorYrMxn = invTier.enabled ? moPay * 12 : 0;
                    const opexYrMxn = varCostYrMxn + fixedCostYrMxn;
                    const yrLabel = (mxn: number) =>
                      `约 ${moneyMxn(mxn, fx, ccy, 0)}/年`;
                    const fleetInDay = cfDay.spvInflowMxn || 0;
                    const wfSegs = (cfDay.slices || []).filter(
                      (s) =>
                        s.amountMxn > 0.01 &&
                        s.id !== "passenger" &&
                        s.id !== "spv_in" &&
                        s.id !== "equity_residual" &&
                        s.id !== "pay_fee" &&
                        s.id !== "platform" &&
                        s.id !== "investor_pi",
                    );
                    const wfTotal = Math.max(
                      0.01,
                      wfSegs.reduce((s, x) => s + x.amountMxn, 0),
                    );
                    const varInclTip = [
                      CF_FACTOR_TIPS.varCostCard,
                      varCostOn
                        ? `计入：${varOnLines.length ? varOnLines.join(" · ") : "无"}`
                        : "总开关已关：充电/易损/司机/过路不进路径",
                      varCostOn && varOffLines.length
                        ? `未计：${varOffLines.join(" · ")}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join("\n");
                    const holdYears = Math.max(
                      1,
                      invAssume.holdYears != null && invAssume.holdYears > 0
                        ? Math.round(invAssume.holdYears)
                        : unitOpsYearsNote,
                    );
                    /** 持有期末账面 = 资产估值「会计寿命残值率」同公式 */
                    const bookResRate = bookResidualRate(cfgSku, holdYears);
                    const fairAtHold = marketFairResidualRate(cfgSku, holdYears);
                    /** 旧 invAssume.residualRate 曾误当作市场残值覆盖 */
                    const marketResOverride =
                      invAssume.marketResRate ?? invAssume.residualRate;
                    const marketResRate = Math.max(
                      0,
                      Math.min(
                        1,
                        marketResOverride ??
                          fairAtHold ??
                          bookResRate,
                      ),
                    );
                    const resRateUse =
                      invResidualMode === "market" ? marketResRate : bookResRate;
                    const acctEndResRate = skuLifeEndResidual(cfgSku, "acct");
                    const residualMxn = unitLanded1 * resRateUse;
                    const steadyPbMo = unitStaticSimpleMo;
                    const financeDay = sliceDay("investor_pi");
                    const financeMo = financeDay * daysMoCard;
                    const companyMo = fleetInDay * daysMoCard;
                    const opexMoApprox = Math.max(
                      0,
                      (firstOpsBar?.outflowMxn || 0) - financeMo,
                    );
                    const grossMo = companyMo - opexMoApprox;
                    const freeMo = (firstOpsBar?.netMxn ?? unitMonthEquity) || 0;
                    const cumPathNet = unitBars.reduce(
                      (s, b) => s + (b.netMxn || 0),
                      0,
                    );
                    const totalReturnMxn = cumPathNet + residualMxn;
                    const initInv =
                      unitInitInvestMxn > 0 ? unitInitInvestMxn : unitLanded1;
                    const returnMultiple =
                      initInv > 0 ? (initInv + totalReturnMxn) / initInv : null;
                    /** 路径指标序列：可选把残值加在末月 */
                    const withResidualOnLast = (
                      nets: number[],
                      resMxn: number,
                    ) => {
                      if (!(resMxn > 0) || nets.length === 0) return nets.slice();
                      const out = nets.slice();
                      out[out.length - 1] = (out[out.length - 1] || 0) + resMxn;
                      return out;
                    };
                    const pathNetsForMetrics = invResidualInPath
                      ? withResidualOnLast(
                          unitBars.map((b) => b.netMxn || 0),
                          residualMxn,
                        )
                      : unitBars.map((b) => b.netMxn || 0);
                    const pathIrrMo = irr(pathNetsForMetrics);
                    const pathIrrAnn =
                      pathIrrMo != null && pathIrrMo > -0.99
                        ? Math.pow(1 + pathIrrMo, 12) - 1
                        : null;
                    const pathNpvMxn = npvAnnualOnMonths(
                      pathNetsForMetrics,
                      UNIT_CF_DISCOUNT_ANN,
                    );
                    const pathStaticPb = staticPaybackPeriod(pathNetsForMetrics);
                    const pathDynamicPb = dynamicPaybackPeriod(
                      pathNetsForMetrics,
                      UNIT_CF_DISCOUNT_ANN,
                    );
                    const pathPbMo = pathStaticPb.months;
                    const sensRows = (() => {
                      const util0 = cfCardLive.util ?? 0.75;
                      const run = (
                        label: string,
                        cfgPatch?: Partial<AssetCashflowConfig>,
                        cardPatch?: Partial<VehicleCard>,
                        residualMult = 1,
                      ) => {
                        const cfg = { ...cfCfgLive, ...(cfgPatch || {}) };
                        const card = { ...cfCardLive, ...(cardPatch || {}) };
                        const day = buildAssetDayCashflow({
                          country: cfgCountry,
                          vertical: cfgVertical,
                          mode: cfModeUse,
                          card,
                          sku: cfSku,
                          cfg,
                          internalPriceMxn: cfElecMxn,
                          unitLandedMxn: unitLanded1,
                          opsMonth: 1,
                        });
                        let bars = buildAssetMonthBars({
                          sku: cfSku,
                          card,
                          cfg,
                          day,
                          qty: 1,
                          discountRate: volumeDiscountRate(cfSku, 1),
                          goLiveStages: cfGoLive,
                          vat: p.vat,
                          configId: selectedConfigId(cfgSku, cfgConfigBySku),
                          internalPriceMxn: cfElecMxn,
                        }).map((b) => b.netMxn);
                        if (invResidualInPath) {
                          bars = withResidualOnLast(
                            bars,
                            residualMxn * residualMult,
                          );
                        }
                        const irrMo = irr(bars);
                        const irrAnn =
                          irrMo != null && irrMo > -0.99
                            ? Math.pow(1 + irrMo, 12) - 1
                            : null;
                        const pb = staticPaybackPeriod(bars);
                        return {
                          label,
                          pb:
                            pb.months != null ? `M${pb.months}` : "期内未回本",
                          irr: pct(irrAnn),
                        };
                      };
                      const rows = [
                        {
                          label: invResidualInPath
                            ? "基准（含残值末月）"
                            : "基准",
                          pb:
                            pathPbMo != null ? `M${pathPbMo}` : "期内未回本",
                          irr: pct(pathIrrAnn),
                        },
                        run("收入−10%", undefined, {
                          util: Math.max(0.2, util0 * 0.9),
                        }),
                        run("收入+10%", undefined, {
                          util: Math.min(0.98, util0 * 1.1),
                        }),
                        run("收入−20%", undefined, {
                          util: Math.max(0.2, util0 * 0.8),
                        }),
                        run("收入+20%", undefined, {
                          util: Math.min(0.98, util0 * 1.2),
                        }),
                        run(
                          "成本+10%",
                          {
                            chargeDayMxn: (cfCfgLive.chargeDayMxn || 0) * 1.1,
                            chargeAmountMxn:
                              (cfCfgLive.chargeAmountMxn || 0) * 1.1,
                            chargeSource: "manual",
                            annualMaintMxn:
                              (cfCfgLive.annualMaintMxn || 0) * 1.1,
                            fixWearPer10kKmMxn:
                              (cfCfgLive.fixWearPer10kKmMxn || 0) * 1.1,
                          },
                          {
                            wearYrMxn: (cfCardLive.wearYrMxn || 0) * 1.1,
                          },
                        ),
                        run("可变成本关", { varCostEnabled: false }),
                        run("固定成本关", { fixedCostEnabled: false }),
                        run("优先投资关", {
                          spvTiers: cfCfgLive.spvTiers.map((t) =>
                            t.id === "investor_pi"
                              ? { ...t, enabled: false }
                              : t,
                          ),
                        }),
                        run("充电成本×1.2", {
                          chargeDayMxn: (cfCfgLive.chargeDayMxn || 0) * 1.2,
                          chargeAmountMxn:
                            (cfCfgLive.chargeAmountMxn || 0) * 1.2,
                          chargeSource: "manual",
                        }),
                      ];
                      if (invResidualInPath) {
                        rows.push(run("残值 0%", undefined, undefined, 0));
                      }
                      return rows;
                    })();
                    const invMonthPath: UnitCfPathPt[] = (() => {
                      const longBars = buildAssetMonthBars({
                        sku: cfSku,
                        card: cfCardLive,
                        cfg: {
                          ...cfCfgLive,
                          horizonMonths: Math.max(
                            12,
                            cfCfgLive.horizonMonths || 12,
                          ),
                        },
                        day: cfDay,
                        qty: 1,
                        discountRate: volumeDiscountRate(cfSku, 1),
                        goLiveStages: cfGoLive,
                        vat: p.vat,
                        configId: selectedConfigId(cfgSku, cfgConfigBySku),
                        internalPriceMxn: cfElecMxn,
                      });
                      let opsI = 0;
                      return assignUnitCfYearIds(
                        longBars.map((b) => {
                          const isCapex = b.label.startsWith("期初");
                          const isIdle = b.label.startsWith("投产前");
                          const isOps = b.label.startsWith("经营第");
                          if (isOps) opsI += 1;
                          return {
                            label: b.label,
                            shortZh: isCapex
                              ? depositHintShort(b.label)
                              : isIdle
                                ? idleBarShortZh(b.label)
                                : `M${opsI}`,
                            inflow: b.opsInMxn,
                            outflow: b.outflowMxn,
                            net: b.netMxn,
                            kind: (isCapex
                              ? "capex"
                              : isIdle
                                ? "idle"
                                : "ops") as UnitCfPathPt["kind"],
                            opsMonth: isOps ? opsI : 0,
                            yearId: 0,
                          };
                        }),
                      );
                    })();
                    return (
                    <div
                      className="inv-ops-layout"
                      style={{
                        height: "100%",
                        minHeight: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: INV_PANE_GAP,
                        overflow: "hidden",
                      }}
                    >
                      <InvPaneTopStrip theme={theme}>
                        <Stack gap={6}>
                          <InvColTitle
                            title="核心输出"
                            hint="路径回本 · IRR · NPV · 敏感性"
                          />
                          <Grid columns={GRID_STATS} gap={8}>
                            <Stat
                              value={
                                pathPbMo != null ? `M${pathPbMo}` : "未回本"
                              }
                              label={
                                invResidualInPath
                                  ? "路径静态回收期 · 含残值"
                                  : "路径静态回收期"
                              }
                            />
                            <Stat
                              value={
                                pathDynamicPb.months != null
                                  ? `M${pathDynamicPb.months}`
                                  : "未回本"
                              }
                              label={`动态回收期 · ${pct(UNIT_CF_DISCOUNT_ANN, 0)}`}
                            />
                            <Stat
                              value={pct(pathIrrAnn)}
                              label={`${holdYears}年路径 IRR${invResidualInPath ? "·含残值" : ""}`}
                              tone={
                                pathIrrAnn != null && pathIrrAnn > 0.12
                                  ? "success"
                                  : pathIrrAnn != null && pathIrrAnn > 0
                                    ? "info"
                                    : undefined
                              }
                            />
                            <div
                              title={unitNpvTipZh({
                                annualRate: UNIT_CF_DISCOUNT_ANN,
                                pathMonths: pathNetsForMetrics.length,
                                opsYears: holdYears,
                              }).replace(/\n+/g, " · ")}
                              style={{ cursor: "help" }}
                            >
                              <Stat
                                value={
                                  (pathNpvMxn >= 0 ? "+" : "") +
                                  moneyMxn(pathNpvMxn, fx, ccy)
                                }
                                label={`NPV ${pct(UNIT_CF_DISCOUNT_ANN, 0)}${invResidualInPath ? "·含残值" : ""}`}
                                tone={
                                  pathNpvMxn > 0
                                    ? "success"
                                    : pathNpvMxn < 0
                                      ? "warning"
                                      : undefined
                                }
                              />
                            </div>
                          </Grid>
                          <Row gap={10} wrap align="center">
                            <Text size="small">
                              期初 {moneyMxn(initInv, fx, ccy, 0)}
                            </Text>
                            <Text size="small">
                              路径累计 {moneyMxn(cumPathNet, fx, ccy, 0)}
                            </Text>
                            <Text size="small">
                              残值 {moneyMxn(residualMxn, fx, ccy, 0)}
                            </Text>
                            <Text size="small" weight="semibold">
                              总回报 {moneyMxn(totalReturnMxn, fx, ccy, 0)}
                              {returnMultiple != null
                                ? ` · ${fmt(returnMultiple, 2)}x`
                                : ""}
                            </Text>
                          </Row>
                          <CollapsibleSection
                            title="敏感性（同引擎重算）"
                            defaultOpen={false}
                            trailing={`${sensRows.length} 情景`}
                          >
                            <Table
                              headers={["情景", "路径回收", "IRR"]}
                              columnAlign={["left", "right", "right"]}
                              rows={sensRows.map((r) => [
                                r.label,
                                r.pb,
                                r.irr,
                              ])}
                              striped
                            />
                          </CollapsibleSection>
                        </Stack>
                      </InvPaneTopStrip>
                      <div
                        className="inv-ops-grid"
                        style={{
                          flex: 1,
                          minHeight: 0,
                          display: "grid",
                          gridTemplateColumns: INV_PANE_GRID_TWO,
                          gap: INV_PANE_GAP,
                          overflow: "hidden",
                        }}
                      >
                      <InvPaneScrollCol
                        theme={theme}
                        className="inv-ops-col inv-ops-col-assume"
                      >
                      <Stack gap={6}>
                        <InvColTitle
                          title="假设输入"
                          hint="IPH×利用率入口 · 日单×单均仅对照"
                        />
                      <CollapsibleSection
                        title="收入假设"
                        defaultOpen
                        trailing={
                          moneyMxn(fleetInDay * daysMoCard, fx, ccy, 0) + "/月"
                        }
                      >
                        <Stack gap={8}>
                          <Text size="small" tone="tertiary">
                            引擎入口：IPH×工时×班次×利用率→车队应收（非日单×单均）。下表「折合」仅对照样例。
                          </Text>
                          <Grid columns={GRID_TIER_FIELDS} gap={6}>
                            <NumField
                              compact
                              tipId="invIph"
                              tip="IPH：每小时车队里程收入（MXN/h）。《DAE-200》案例默认 210。"
                              label="IPH"
                              value={cfCardLive.iphMxn || 0}
                              onChange={(n) =>
                                patchInvAssume({ iphMxn: Math.max(0, n) })
                              }
                              hint={`${ccy}/h`}
                            />
                            <NumField
                              compact
                              tipId="invUtil"
                              tip="利用率：满负荷周流水×利用率=里程收入。样例「覆盖率」对照本项。"
                              label="利用率 %"
                              value={(cfCardLive.util || 0) * 100}
                              onChange={(n) =>
                                patchInvAssume({
                                  util: Math.max(0.05, Math.min(1, n / 100)),
                                })
                              }
                            />
                            <NumField
                              compact
                              tipId="invHours"
                              tip={`日工时（单班）。收入侧 IPH×工时；司机侧关联案例时月薪按 (工时/${DAE_BASE_HOURS_DAY}h) 同比缩放。两班由顶栏班次 Pill 控制。`}
                              label="日工时 h"
                              value={cfCardLive.hoursDay || 0}
                              onChange={(n) =>
                                patchInvAssume({
                                  hoursDay: Math.max(1, Math.min(16, n)),
                                })
                              }
                              hint={
                                wageFullTime && wage.source === "from_card"
                                  ? `司机有效月薪随工时 · 基准 ${DAE_BASE_HOURS_DAY}h`
                                  : undefined
                              }
                            />
                            <NumField
                              compact
                              tipId="invDaysWeek"
                              tip="每周营运天数；月营运天≈周天数×52/12。"
                              label="周营运天"
                              value={cfCardLive.daysWeek || 6}
                              onChange={(n) =>
                                patchInvAssume({
                                  daysWeek: Math.max(1, Math.min(7, Math.round(n))),
                                })
                              }
                              hint={`月≈${fmt(daysMoCard, 1)} 天`}
                            />
                            <NumField
                              compact
                              tipId="invSubsidy"
                              tip="补贴占里程收入比例；案例默认约 5%。"
                              label="补贴 %"
                              value={(cfCardLive.subsidyPct || 0) * 100}
                              onChange={(n) =>
                                patchInvAssume({
                                  subsidyPct: Math.max(0, Math.min(0.3, n / 100)),
                                })
                              }
                            />
                          </Grid>
                          <Text size="small" tone="tertiary">
                            折合对照：日乘客实付{" "}
                            {moneyMxn(cfDay.passengerPayMxn || fleetInDay, fx, ccy, 0)}
                            {" · "}日车队实收{" "}
                            {moneyMxn(fleetInDay, fx, ccy, 0)}
                            {(() => {
                              const dayPay = cfDay.passengerPayMxn || fleetInDay || 0;
                              const ticket = 25 * (ccy === "USD" ? 1 : fx);
                              const trips =
                                ticket > 0 ? dayPay / ticket : 0;
                              return trips > 0.5
                                ? ` · 若单均 ${fmt(ticket / (ccy === "USD" ? 1 : fx), 0)}${ccy} ≈ ${fmt(trips, 1)} 单/日`
                                : "";
                            })()}
                          </Text>
                          <Stat
                            value={moneyMxn(companyMo, fx, ccy, 0)}
                            label={`月收入（占池后公司）· 日 ${moneyMxn(fleetInDay, fx, ccy, 1)}`}
                          />
                          <CollapsibleSection
                            title="占池分配"
                            defaultOpen={false}
                            trailing={`${Math.round((1 - (cfCfgLive.paymentFeePct || 0)) * (1 - (cfCfgLive.platformTakePct || 0)) * 1000) / 10}% 实收`}
                          >
                            <Stack gap={6}>
                              {cfCfgLive.varCostEnabled === false ? (
                                <Text size="small" tone="tertiary">
                                  可变成本总开关已关：通道/平台 % 已保存但不进瀑布；请在「可变成本」打开总开关。
                                </Text>
                              ) : null}
                              <Grid columns={GRID_TIER_FIELDS} gap={6}>
                                <NumField
                                  compact
                                  tipId="paymentFee"
                                  tip={CF_FACTOR_TIPS.paymentFee}
                                  label="通道费 %"
                                  value={cfCfgLive.paymentFeePct * 100}
                                  onChange={(n) =>
                                    patchCf({
                                      paymentFeePct: Math.max(
                                        0,
                                        Math.min(0.2, n / 100),
                                      ),
                                    })
                                  }
                                />
                                <NumField
                                  compact
                                  tipId="platformTake"
                                  tip={CF_FACTOR_TIPS.platformTake}
                                  label="平台抽成 %"
                                  value={cfCfgLive.platformTakePct * 100}
                                  onChange={(n) =>
                                    patchCf({
                                      platformTakePct: Math.max(
                                        0,
                                        Math.min(0.6, n / 100),
                                      ),
                                    })
                                  }
                                />
                              </Grid>
                              <Text size="small" tone="tertiary">
                                {cfModeUse === "DAE" &&
                                ((cfCfgLive.paymentFeePct || 0) > 1e-9 ||
                                  (cfCfgLive.platformTakePct || 0) > 1e-9)
                                  ? `毛流水口径：IPH→乘客实付 ${moneyMxn(cfDay.passengerPayMxn, fx, ccy, 1)}/日，扣通道·平台后车队 ${moneyMxn(fleetInDay, fx, ccy, 1)}/日。`
                                  : "DAE 默认 0（IPH 已是车队净口径）；填通道/平台 % 后按毛流水拆账。"}
                                公司实收 {moneyMxn(companyMo, fx, ccy, 0)}/月
                                {(cfCfgLive.paymentFeePct || 0) > 1e-9 ||
                                (cfCfgLive.platformTakePct || 0) > 1e-9
                                  ? ` · 通道日 ${moneyMxn(sliceDay("pay_fee"), fx, ccy, 1)} · 平台日 ${moneyMxn(sliceDay("platform"), fx, ccy, 1)}`
                                  : ""}
                              </Text>
                            </Stack>
                          </CollapsibleSection>
                        </Stack>
                      </CollapsibleSection>

                      <CollapsibleSection
                        title="成本假设"
                        defaultOpen
                        trailing={moneyMxn(opexMoApprox, fx, ccy, 0) + "/月"}
                      >
                        <Stack gap={8}>
                          <Row gap={6} align="center" wrap>
                            <Text size="small" weight="medium">
                              司机模式
                            </Text>
                            <Pill
                              size="sm"
                              active={wageFullTime}
                              onClick={() => {
                              if (cfModeUse === "DAE") {
                                const mo = Math.round(
                                  daeDriverMonthMxn(cfCardLive),
                                );
                                patchCfTier("driver_wage", {
                                  enabled: true,
                                  wage: {
                                    source: "from_card",
                                    cycle: "month",
                                    amountMxn: mo,
                                    coverPct: wage.coverPct || 1,
                                  },
                                });
                                return;
                              }
                              patchCfTier("driver_wage", { enabled: true });
                            }}
                            >
                              全职
                            </Pill>
                            <Pill
                              size="sm"
                              active={!wageFullTime}
                              onClick={() =>
                                patchCfTier("driver_wage", { enabled: false })
                              }
                            >
                              合作分成
                            </Pill>
                          </Row>
                          {wageFullTime ? (
                            <NumField
                              compact
                              tipId="invDriverMo"
                              tip={CF_FACTOR_TIPS.wageDriverRow}
                              label="全职月薪"
                              value={
                                wage.source === "from_card"
                                  ? Math.round(daeDriverMonthMxn(cfCardLive))
                                  : wage.cycle === "month"
                                    ? wage.amountMxn
                                    : Math.round(
                                        wage.cycle === "day"
                                          ? wage.amountMxn * daysMoCard
                                          : wage.cycle === "week"
                                            ? (wage.amountMxn /
                                                Math.max(
                                                  1,
                                                  cfCardLive.daysWeek || 6,
                                                )) *
                                              daysMoCard
                                            : wage.amountMxn,
                                      )
                              }
                              onChange={(n) => {
                                const mo = Math.max(0, n);
                                const hours = Math.max(
                                  0.5,
                                  cfCardLive.hoursDay || DAE_BASE_HOURS_DAY,
                                );
                                const shifts = Math.max(
                                  1,
                                  cfCardLive.shiftsPerDay || 1,
                                );
                                const util = Math.max(
                                  0,
                                  Math.min(1, cfCardLive.util ?? 0.75),
                                );
                                const hoursMul = hours / DAE_BASE_HOURS_DAY;
                                const basePerDriver =
                                  hoursMul > 0 && shifts * util > 0
                                    ? mo / (shifts * util * hoursMul)
                                    : mo;
                                patchInvAssume({
                                  driverMxn: Math.round(basePerDriver),
                                });
                                patchCfTier("driver_wage", {
                                  enabled: true,
                                  wage: {
                                    source: "manual",
                                    cycle: "month",
                                    amountMxn: mo,
                                    coverPct: wage.coverPct || 1,
                                  },
                                });
                              }}
                              hint={
                                wage.source === "from_card"
                                  ? `关联案例 · 单人底薪 ${moneyMxn(cfCardLive.driverMxn || 0, fx, ccy, 0)}×${cfCardLive.shiftsPerDay || 1}班×${pct(cfCardLive.util ?? 0.75, 0)}×${fmt((cfCardLive.hoursDay || DAE_BASE_HOURS_DAY) / DAE_BASE_HOURS_DAY, 2)}`
                                  : "手改口径 · 不再随日工时自动变"
                              }
                              mxnFx={fx}
                              displayCcy={ccy}
                            />
                          ) : (
                            <Text size="small" tone="tertiary">
                              合作分成：车队侧不预留底薪（成本在司机侧）
                            </Text>
                          )}
                          <Stat
                            value={moneyMxn(opexMoApprox, fx, ccy, 0)}
                            label="月运营成本（路径首月流出−债服）"
                          />
                          <CollapsibleSection
                            title="成本明细"
                            defaultOpen={false}
                            trailing={yrLabel(opexYrMxn)}
                          >
                            <Stack gap={8}>

                        <Row gap={6} align="center">
                          <Toggle
                            checked={varCostOn}
                            onChange={(v) => patchCf({ varCostEnabled: v })}
                          />
                          <TipLabel
                            id="tier-varCost"
                            label="变动 / 半变动"
                            tip={varInclTip}
                          />
                          <Spacer />
                          <Text size="small" tone="tertiary">
                            {varCostOn ? yrLabel(varCostYrMxn) : "约 0/年"}
                          </Text>
                        </Row>
                        <Text size="small" weight="medium">
                          变动
                        </Text>
                        <Row gap={4} wrap align="center">
                          <TipLabel
                            id="chargeCycle"
                            label="充电"
                            tip={`${CF_FACTOR_TIPS.chargeDay}\n${CF_FACTOR_TIPS.chargeCycle}`}
                          />
                          {CHARGE_CYCLE_OPTS.map((o) => (
                            <Pill
                              key={o.id}
                              size="sm"
                              active={cfCfgLive.chargeCycle === o.id}
                              onClick={() => {
                                const next = o.id;
                                const cur = cfCfgLive.chargeCycle || "day";
                                if (next === cur) return;
                                const dw = cfCardLive.daysWeek || 6;
                                const day =
                                  cfCfgLive.chargeSource !== "manual" &&
                                  cfModeUse === "DAE"
                                    ? cfCfgLive.chargeDayMxn
                                    : chargeDayFromAmount(
                                        cfCfgLive.chargeAmountMxn ||
                                          cfCfgLive.chargeDayMxn,
                                        cur,
                                        dw,
                                      );
                                patchCf({
                                  chargeCycle: next,
                                  chargeAmountMxn: chargeAmountFromDay(
                                    day,
                                    next,
                                    dw,
                                  ),
                                  chargeDayMxn: Math.round(day * 100) / 100,
                                  chargeSource:
                                    cfCfgLive.chargeSource === "from_card"
                                      ? "from_card"
                                      : "manual",
                                });
                              }}
                            >
                              {o.label}
                            </Pill>
                          ))}
                        </Row>
                        <NumField
                          compact
                          tipId="chargeAmount"
                          tip={CF_FACTOR_TIPS.chargeAmount}
                          label={`${chargeCycleLabelZh(cfCfgLive.chargeCycle || "day")} ${ccy}`}
                          value={cfCfgLive.chargeAmountMxn}
                          onChange={(n) => {
                            const dw = cfCardLive.daysWeek || 6;
                            const cyc = cfCfgLive.chargeCycle || "day";
                            const amt = Math.max(0, n);
                            patchCf({
                              chargeAmountMxn: amt,
                              chargeDayMxn:
                                Math.round(
                                  chargeDayFromAmount(amt, cyc, dw) * 100,
                                ) / 100,
                              chargeSource: "manual",
                            });
                          }}
                          mxnFx={fx}
                          displayCcy={ccy}
                        />
                        <Row gap={4} align="center">
                          <Toggle
                            checked={!!cfCfgLive.fixWearOn}
                            onChange={(v) =>
                              patchCf({
                                fixWearOn: v,
                                fixedCostSource: "manual",
                                randomMaintMonthMxn: wearMonthFromFixed(
                                  { ...cfCfgLive, fixWearOn: v },
                                  cfCardLive,
                                ),
                              })
                            }
                          />
                          <NumField
                            compact
                            tipId="fixWearAmt"
                            tip={CF_FACTOR_TIPS.fixWear}
                            label={`易损 ${ccy}/万km`}
                            value={cfCfgLive.fixWearPer10kKmMxn || 0}
                            onChange={(n) =>
                              patchCf({
                                fixWearPer10kKmMxn: Math.max(0, n),
                                fixedCostSource: "manual",
                                randomMaintMonthMxn: wearMonthFromFixed(
                                  {
                                    ...cfCfgLive,
                                    fixWearPer10kKmMxn: Math.max(0, n),
                                  },
                                  cfCardLive,
                                ),
                              })
                            }
                            mxnFx={fx}
                            displayCcy={ccy}
                            hint={`月≈${fmt(cfCfgLive.randomMaintMonthMxn / fx, 1)}`}
                          />
                        </Row>

                        <Divider />
                        <Text size="small" weight="medium">
                          半变动
                        </Text>
                        <Row gap={4} wrap align="center">
                          <TipLabel
                            id="wageDriverRow"
                            label="司机"
                            tip={CF_FACTOR_TIPS.wageDriverRow}
                          />
                          <Pill
                            size="sm"
                            active={wageFullTime}
                            onClick={() => {
                              if (cfModeUse === "DAE") {
                                const mo = Math.round(
                                  daeDriverMonthMxn(cfCardLive),
                                );
                                patchCfTier("driver_wage", {
                                  enabled: true,
                                  wage: {
                                    source: "from_card",
                                    cycle: "month",
                                    amountMxn: mo,
                                    coverPct: wage.coverPct || 1,
                                  },
                                });
                                return;
                              }
                              patchCfTier("driver_wage", { enabled: true });
                            }}
                          >
                            全职
                          </Pill>
                          <Pill
                            size="sm"
                            active={!wageFullTime}
                            onClick={() =>
                              patchCfTier("driver_wage", { enabled: false })
                            }
                          >
                            合作
                          </Pill>
                          {wageFullTime
                            ? WAGE_CYCLE_OPTS.map((o) => (
                                <Pill
                                  key={o.id}
                                  size="sm"
                                  active={wage.cycle === o.id}
                                  onClick={() => {
                                    const next = o.id;
                                    if (next === wage.cycle) return;
                                    const daysMo = opsDaysPerMonth(
                                      cfCardLive.daysWeek || 6,
                                    );
                                    const dw = Math.max(
                                      1,
                                      cfCardLive.daysWeek || 6,
                                    );
                                    const day =
                                      wage.source === "from_card" &&
                                      cfModeUse === "DAE"
                                        ? daeDriverMonthMxn(cfCardLive) /
                                          daysMo
                                        : wage.cycle === "day"
                                          ? wage.amountMxn
                                          : wage.cycle === "week"
                                            ? wage.amountMxn / dw
                                            : wage.amountMxn / daysMo;
                                    const amountMxn =
                                      next === "day"
                                        ? Math.round(day * 10) / 10
                                        : next === "week"
                                          ? Math.round(day * dw)
                                          : Math.round(day * daysMo);
                                    patchCfTier("driver_wage", {
                                      wage: {
                                        cycle: next,
                                        amountMxn,
                                        source:
                                          wage.source === "from_card"
                                            ? "from_card"
                                            : "manual",
                                      },
                                    });
                                  }}
                                >
                                  {o.label}
                                </Pill>
                              ))
                            : null}
                        </Row>
                        {wageFullTime ? (
                          <>
                            <Grid columns={GRID_TIER_FIELDS} gap={4}>
                              <NumField
                                compact
                                tipId="wageAmount"
                                tip={CF_FACTOR_TIPS.wageAmount}
                                label={`底薪预留(${wage.cycle === "month" ? "月" : wage.cycle === "week" ? "周" : "日"})`}
                                value={wage.amountMxn}
                                onChange={(n) =>
                                  patchCfTier("driver_wage", {
                                    wage: {
                                      amountMxn: Math.max(0, n),
                                      source: "manual",
                                    },
                                  })
                                }
                                mxnFx={fx}
                                displayCcy={ccy}
                              />
                              <NumField
                                compact
                                tipId="wageCover"
                                tip={CF_FACTOR_TIPS.wageCover}
                                label="提成覆盖 %"
                                value={(wage.coverPct || 1) * 100}
                                onChange={(n) =>
                                  patchCfTier("driver_wage", {
                                    wage: {
                                      coverPct: Math.max(
                                        0,
                                        Math.min(1.5, n / 100),
                                      ),
                                    },
                                  })
                                }
                              />
                            </Grid>
                            <Text size="small" tone="tertiary">
                              日≈
                              {fmt(
                                wageReserveDayMxn(wage, cfCardLive) / fx,
                                1,
                              )}
                            </Text>
                          </>
                        ) : null}
                        {dayCostItems.map((it, dayIdx) => (
                          <Stack key={it.id} gap={4}>
                            <Row gap={4} align="center" wrap>
                              <Toggle
                                checked={it.enabled}
                                onChange={(v) =>
                                  patchCfTier("other_opex", {
                                    varOpex: {
                                      items: varItems.map((x) =>
                                        x.id === it.id
                                          ? { ...x, enabled: v }
                                          : x,
                                      ),
                                    },
                                  })
                                }
                              />
                              <TipLabel
                                id={`varDay-name-${it.id}`}
                                label={it.nameZh}
                                tip={
                                  it.id === "tolls"
                                    ? CF_FACTOR_TIPS.tollDay
                                    : CF_FACTOR_TIPS.varDay
                                }
                              />
                            </Row>
                            <NumField
                              compact
                              tipId={`varDay-${it.id}`}
                              tip={
                                it.id === "tolls"
                                  ? CF_FACTOR_TIPS.tollDay
                                  : CF_FACTOR_TIPS.varDay
                              }
                              label={`日额 ${ccy}`}
                              value={it.fixedDayMxn || 0}
                              onChange={(n) =>
                                patchCfTier("other_opex", {
                                  varOpex: {
                                    items: varItems.map((x) =>
                                      x.id === it.id
                                        ? {
                                            ...x,
                                            kind: "fixed_day",
                                            fixedDayMxn: Math.max(0, n),
                                          }
                                        : x,
                                    ),
                                  },
                                })
                              }
                              mxnFx={fx}
                              displayCcy={ccy}
                            />
                          </Stack>
                        ))}
                        <Divider />
                        <Row gap={6} align="center">
                          <Toggle
                            checked={!!cfCfgLive.fixedCostEnabled}
                            onChange={(v) =>
                              patchCf({
                                fixedCostEnabled: v,
                                annualMaintMxn: annualMaintFromFixedLines({
                                  ...cfCfgLive,
                                  fixedCostEnabled: v,
                                }),
                              })
                            }
                          />
                          <TipLabel
                            id="tier-fixedCost"
                            label="固定 / 阶梯 / 酌量"
                            tip="保险、GPS、车位、计划保养与冲单补贴。关总开关则都不进日瀑布与月路径。"
                          />
                          <Spacer />
                          <Text size="small" tone="tertiary">
                            {yrLabel(fixedCostYrMxn)}
                          </Text>
                        </Row>
                        <Text size="small" weight="medium">
                          固定
                        </Text>
                        <Grid columns={GRID_TIER_FIELDS} gap={4}>
                          <Stack gap={2}>
                            <Row gap={4} align="center">
                              <Toggle
                                checked={!!cfCfgLive.fixInsuranceOn}
                                onChange={(v) =>
                                  patchCf({
                                    fixInsuranceOn: v,
                                    fixedCostSource: "manual",
                                    annualMaintMxn:
                                      annualMaintFromFixedLines({
                                        ...cfCfgLive,
                                        fixInsuranceOn: v,
                                      }),
                                  })
                                }
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <NumField
                                  compact
                                  tipId="fixInsuranceAmt"
                                  tip={CF_FACTOR_TIPS.fixInsurance}
                                  label={`保险/年`}
                                  value={cfCfgLive.fixInsuranceYrMxn}
                                  onChange={(n) =>
                                    patchCf({
                                      fixInsuranceYrMxn: Math.max(0, n),
                                      fixedCostSource: "manual",
                                      annualMaintMxn:
                                        annualMaintFromFixedLines({
                                          ...cfCfgLive,
                                          fixInsuranceYrMxn: Math.max(0, n),
                                        }),
                                    })
                                  }
                                  mxnFx={fx}
                                  displayCcy={ccy}
                                />
                              </div>
                            </Row>
                          </Stack>
                          <Stack gap={2}>
                            <Row gap={4} align="center">
                              <Toggle
                                checked={!!cfCfgLive.fixSoftOn}
                                onChange={(v) =>
                                  patchCf({
                                    fixSoftOn: v,
                                    fixedCostSource: "manual",
                                    annualMaintMxn:
                                      annualMaintFromFixedLines({
                                        ...cfCfgLive,
                                        fixSoftOn: v,
                                      }),
                                  })
                                }
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <NumField
                                  compact
                                  tipId="fixSoftAmt"
                                  tip={CF_FACTOR_TIPS.fixSoft}
                                  label={`软件GPS/月`}
                                  value={cfCfgLive.fixSoftMoMxn}
                                  onChange={(n) =>
                                    patchCf({
                                      fixSoftMoMxn: Math.max(0, n),
                                      fixedCostSource: "manual",
                                      annualMaintMxn:
                                        annualMaintFromFixedLines({
                                          ...cfCfgLive,
                                          fixSoftMoMxn: Math.max(0, n),
                                        }),
                                    })
                                  }
                                  mxnFx={fx}
                                  displayCcy={ccy}
                                />
                              </div>
                            </Row>
                          </Stack>
                          <Stack gap={2}>
                            <Row gap={4} align="center">
                              <Toggle
                                checked={!!cfCfgLive.fixParkingOn}
                                onChange={(v) =>
                                  patchCf({
                                    fixParkingOn: v,
                                    fixedCostSource: "manual",
                                    annualMaintMxn:
                                      annualMaintFromFixedLines({
                                        ...cfCfgLive,
                                        fixParkingOn: v,
                                      }),
                                  })
                                }
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <NumField
                                  compact
                                  tipId="fixParkingAmt"
                                  tip={CF_FACTOR_TIPS.fixParking}
                                  label={`车位/月`}
                                  value={cfCfgLive.fixParkingMoMxn}
                                  onChange={(n) =>
                                    patchCf({
                                      fixParkingMoMxn: Math.max(0, n),
                                      fixedCostSource: "manual",
                                      annualMaintMxn:
                                        annualMaintFromFixedLines({
                                          ...cfCfgLive,
                                          fixParkingMoMxn: Math.max(0, n),
                                        }),
                                    })
                                  }
                                  mxnFx={fx}
                                  displayCcy={ccy}
                                />
                              </div>
                            </Row>
                          </Stack>
                        </Grid>

                        <Divider />
                        <TipLabel
                          id="step-fixed-section"
                          label="阶梯固定"
                          tip={CF_FACTOR_TIPS.stepFixedSection}
                        />
                        <Stack gap={2}>
                          <Row gap={4} align="center">
                            <Toggle
                              checked={!!cfCfgLive.fixMaintOn}
                              onChange={(v) =>
                                patchCf({
                                  fixMaintOn: v,
                                  fixedCostSource: "manual",
                                  annualMaintMxn:
                                    annualMaintFromFixedLines({
                                      ...cfCfgLive,
                                      fixMaintOn: v,
                                    }),
                                })
                              }
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <NumField
                                compact
                                tipId="fixMaintAmt"
                                tip={CF_FACTOR_TIPS.fixMaint}
                                label={`计划保养/月`}
                                value={cfCfgLive.fixMaintMoMxn}
                                onChange={(n) =>
                                  patchCf({
                                    fixMaintMoMxn: Math.max(0, n),
                                    fixedCostSource: "manual",
                                    annualMaintMxn: annualMaintFromFixedLines({
                                      ...cfCfgLive,
                                      fixMaintMoMxn: Math.max(0, n),
                                    }),
                                  })
                                }
                                mxnFx={fx}
                                displayCcy={ccy}
                              />
                            </div>
                          </Row>
                        </Stack>

                        <Divider />
                        <TipLabel
                          id="tier-discretionary"
                          label="酌量 · 冲单补贴"
                          tip={
                            CF_FACTOR_TIPS.discretionary +
                            "\n开分项后按剩余池%从日瀑布扣；运营成本年合计会变。"
                          }
                        />
                        <Text size="small" tone="tertiary">
                          剩余池日≈{fmt(poolBeforeDisc / fx, 1)}
                          {ccy}
                          {fixCostOn ? "" : " · 固定总开关关→不计"}
                        </Text>
                        {shareItems.map((it) => {
                          const itemTip =
                            it.id === "trip_bonus"
                              ? CF_FACTOR_TIPS.tripBonus
                              : CF_FACTOR_TIPS.varPct;
                          const dayAmt = sliceDay(it.id);
                          const yrAmt = dayAmt * daysMoCard * 12;
                          return (
                          <Stack key={it.id} gap={4}>
                            <Row gap={4} align="center" wrap>
                              <Toggle
                                checked={it.enabled}
                                onChange={(v) =>
                                  patchCfTier("other_opex", {
                                    varOpex: {
                                      items: varItems.map((x) =>
                                        x.id === it.id
                                          ? { ...x, enabled: v }
                                          : x,
                                      ),
                                    },
                                  })
                                }
                              />
                              <TipLabel
                                id={`varPct-name-${it.id}`}
                                label={
                                  it.id === "trip_bonus"
                                    ? "冲单补贴"
                                    : it.nameZh
                                }
                                tip={itemTip}
                              />
                              <Text size="small" tone="tertiary">
                                {it.enabled && fixCostOn
                                  ? `日≈${fmt(dayAmt / fx, 1)} · 年≈${fmt(yrAmt / fx, 0)}${ccy}`
                                  : "关·不扣"}
                              </Text>
                            </Row>
                            <NumField
                              compact
                              tipId={`varPct-${it.id}`}
                              tip={itemTip}
                              label="占剩余池 %"
                              value={(it.pct || 0) * 100}
                              onChange={(n) =>
                                patchCfTier("other_opex", {
                                  varOpex: {
                                    items: varItems.map((x) =>
                                      x.id === it.id
                                        ? {
                                            ...x,
                                            kind: "pct_pool",
                                            pct: Math.max(
                                              0,
                                              Math.min(0.5, n / 100),
                                            ),
                                          }
                                        : x,
                                    ),
                                  },
                                })
                              }
                            />
                          </Stack>
                          );
                        })}
                            {wfSegs.length > 0 ? (
                              <UsageBar
                                total={wfTotal}
                                topLeftLabel="运营日瀑布"
                                topRightLabel={moneyMxn(wfTotal, fx, ccy, 1) + "/日"}
                                segments={wfSegs.map((s, i) => ({
                                  id: s.id,
                                  value: s.amountMxn,
                                  color: usageColorSequence[i % usageColorSequence.length],
                                }))}
                              />
                            ) : null}
                            <Text size="small" tone="tertiary">
                              变动 + 半变动 + 固定 + 酌量 = 运营成本。债服在融资列，不计入本合计。
                            </Text>
                          
                            </Stack>
                          </CollapsibleSection>
                        </Stack>
                      </CollapsibleSection>

                      <CollapsibleSection
                        title="资产与融资"
                        defaultOpen
                        trailing={
                          invTier.enabled
                            ? yrLabel(investorYrMxn)
                            : moneyMxn(unitLanded1, fx, ccy, 0)
                        }
                      >
                        <Stack gap={8}>
                          {(() => {
                            const softSum = softCostSumMxn(cfCardLive);
                            const purchase = Math.max(
                              0,
                              skuPurchasePriceMxn(
                                cfgSku,
                                selectedConfigId(cfgSku, cfgConfigBySku),
                              ),
                            );
                            return (
                              <Grid columns={GRID_TIER_FIELDS} gap={6}>
                                <NumField
                                  compact
                                  tipId="invPurchase"
                                  tip="车辆购入价（SKU）；改此项写回货架价。"
                                  label="车辆购置"
                                  value={purchase}
                                  onChange={(n) =>
                                    patchSku(cfgSku.id, {
                                      purchasePriceMxn: Math.max(0, n),
                                    })
                                  }
                                  mxnFx={fx}
                                  displayCcy={ccy}
                                />
                                <Stat
                                  value={moneyMxn(softSum, fx, ccy, 0)}
                                  label="其他投入（皮费合计）"
                                />
                                <Stat
                                  value={moneyMxn(unitLanded1, fx, ccy, 0)}
                                  label={`含税落地总投入 · 路径期初 ${moneyMxn(initInv, fx, ccy, 0)}`}
                                />
                              </Grid>
                            );
                          })()}
                          <Text size="small" tone="tertiary">
                            投产前空窗{" "}
                            {cfGoLiveDays > 0
                              ? `${cfGoLiveDays}D（${cfGoLive
                                  .map((s) => `${s.nameZh}${s.days}D`)
                                  .join("·")}）`
                              : "0D"}
                            · 测算前提「上路阶段」；时序标签如 空窗1·
                            {cfGoLiveDays || 0}D
                          </Text>
                          <CollapsibleSection
                            title="皮费分项"
                            defaultOpen={false}
                            trailing={moneyMxn(softCostSumMxn(cfCardLive), fx, ccy, 0)}
                          >
                            <Stack gap={6}>
                              {(cfCardLive.softCosts || []).map((s) => (
                                <NumField
                                  key={s.id}
                                  compact
                                  tipId={`soft-${s.id}`}
                                  tip="写入本 SKU 皮费行；影响含税落地。"
                                  label={s.nameZh}
                                  value={s.amountMxn}
                                  onChange={(n) =>
                                    patchSku(cfgSku.id, {
                                      softCosts: (cfgSku.softCosts || []).map(
                                        (x) =>
                                          x.id === s.id
                                            ? { ...x, amountMxn: Math.max(0, n) }
                                            : x,
                                      ),
                                    })
                                  }
                                  mxnFx={fx}
                                  displayCcy={ccy}
                                />
                              ))}
                            </Stack>
                          </CollapsibleSection>
                          <Callout tone="neutral" title="只进现金流">
                            本息与保证金不计入运营成本。开/关会改月净、IRR 与回本。
                          </Callout>
                          <Row gap={6} align="center" wrap>
                            <Text size="small" weight="medium">
                              融资结构
                            </Text>
                            <Pill
                              size="sm"
                              active={!invTier.enabled}
                              onClick={() =>
                                patchCfTier("investor_pi", { enabled: false })
                              }
                            >
                              无
                            </Pill>
                            <Pill
                              size="sm"
                              active={!!invTier.enabled}
                              onClick={() =>
                                patchCfTier("investor_pi", { enabled: true })
                              }
                            >
                              优先投资
                            </Pill>
                          </Row>
                          {invTier.enabled ? (
                            <Stack gap={6}>
                              <Grid columns={GRID_TIER_FIELDS} gap={4}>
                                <NumField
                                  compact
                                  tipId="principalPct"
                                  tip={CF_FACTOR_TIPS.principalPct}
                                  label="本金比例 %"
                                  value={inv.principalPct * 100}
                                  onChange={(n) =>
                                    patchCfTier("investor_pi", {
                                      investor: {
                                        principalPct: Math.max(
                                          0,
                                          Math.min(1, n / 100),
                                        ),
                                      },
                                    })
                                  }
                                  hint={`≈${fmt(prinMxn / fx, 0)}${ccy}`}
                                />
                                <NumField
                                  compact
                                  tipId="annualRate"
                                  tip={CF_FACTOR_TIPS.annualRate}
                                  label="年化利率 %"
                                  value={(inv.annualRate || 0) * 100}
                                  onChange={(n) =>
                                    patchCfTier("investor_pi", {
                                      investor: {
                                        annualRate: Math.max(
                                          0,
                                          Math.min(0.5, n / 100),
                                        ),
                                      },
                                    })
                                  }
                                />
                                <NumField
                                  compact
                                  tipId="tenureMonths"
                                  tip={CF_FACTOR_TIPS.tenureMonths}
                                  label="期限月"
                                  value={inv.tenureMonths}
                                  onChange={(n) =>
                                    patchCfTier("investor_pi", {
                                      investor: {
                                        tenureMonths: Math.max(
                                          1,
                                          Math.round(n),
                                        ),
                                        interestOnlyMonths: Math.min(
                                          inv.interestOnlyMonths,
                                          Math.max(0, Math.round(n) - 1),
                                        ),
                                      },
                                    })
                                  }
                                />
                                <NumField
                                  compact
                                  tipId="depositMonths"
                                  tip={CF_FACTOR_TIPS.depositMonths}
                                  label="保证金（月本息）"
                                  value={inv.depositMonths ?? 0}
                                  onChange={(n) =>
                                    patchCfTier("investor_pi", {
                                      investor: {
                                        depositMonths: Math.max(
                                          0,
                                          Math.min(24, Math.round(n)),
                                        ),
                                      },
                                    })
                                  }
                                />
                              </Grid>
                              <Grid columns={GRID_TIER_FIELDS} gap={4}>
                                <NumField
                                  compact
                                  tipId="interestOnlyMonths"
                                  tip={CF_FACTOR_TIPS.interestOnlyMonths}
                                  label="只还息月"
                                  value={inv.interestOnlyMonths}
                                  onChange={(n) => {
                                    const tenure = Math.max(
                                      1,
                                      Math.round(inv.tenureMonths || 1),
                                    );
                                    patchCfTier("investor_pi", {
                                      investor: {
                                        interestOnlyMonths: Math.max(
                                          0,
                                          Math.min(tenure - 1, Math.round(n)),
                                        ),
                                      },
                                    });
                                  }}
                                  hint={
                                    inv.interestOnlyMonths > 0
                                      ? inv.interestOnlyTiming === "back"
                                        ? "期末后置"
                                        : "期初前置"
                                      : "0=无"
                                  }
                                />
                              </Grid>
                              <Row gap={4} wrap align="center">
                                <Text size="small" tone="secondary">
                                  只还息位置
                                </Text>
                                {IO_TIMING_OPTS.map((o) => (
                                  <Pill
                                    key={o.id}
                                    size="sm"
                                    active={inv.interestOnlyTiming === o.id}
                                    onClick={() =>
                                      patchCfTier("investor_pi", {
                                        investor: { interestOnlyTiming: o.id },
                                      })
                                    }
                                  >
                                    {o.label}
                                  </Pill>
                                ))}
                              </Row>
                              <Row gap={4} wrap align="center">
                                <Text size="small" tone="secondary">
                                  还款
                                </Text>
                                {DEBT_RULE_OPTS.map((o) => (
                                  <Pill
                                    key={o.id}
                                    size="sm"
                                    active={inv.rule === o.id}
                                    onClick={() =>
                                      patchCfTier("investor_pi", {
                                        investor: { rule: o.id },
                                      })
                                    }
                                  >
                                    {o.label}
                                  </Pill>
                                ))}
                              </Row>
                              <Text size="small" tone="tertiary">
                                月供≈{fmt(moPay / fx, 1)}
                                {ccy}
                                {inv.interestOnlyMonths > 0
                                  ? ` · 只还息 ${inv.interestOnlyMonths} 月·${
                                      inv.interestOnlyTiming === "back"
                                        ? "期末后置"
                                        : "期初前置"
                                    }`
                                  : ""}
                                {depositMxn > 0
                                  ? ` · 保证金 ${moneyMxn(depositMxn, fx, ccy, 0)}`
                                  : ""}
                              </Text>
                            </Stack>
                          ) : null}
                        </Stack>
                      </CollapsibleSection>

                      <CollapsibleSection
                        title="资产处置"
                        defaultOpen
                        trailing={moneyMxn(residualMxn, fx, ccy, 0)}
                      >
                        <Stack gap={8}>
                          <NumField
                            compact
                            tipId="invHoldY"
                            tip="持有期（年）= 处置时点 / 路径展望月÷12。与资产估值「会计寿命」分离；改持有期不改会计寿命。"
                            label="持有期 年"
                            value={holdYears}
                            onChange={(n) => {
                              const y = Math.max(1, Math.min(12, Math.round(n)));
                              patchInvAssume({ holdYears: y });
                              patchCf({
                                horizonMonths: Math.min(120, y * 12),
                              });
                            }}
                            hint={`路径 ${holdYears * 12} 月 · 会计寿命 ${cfgSku.acctYears} 年（估值页）`}
                          />
                          <Row gap={6} wrap>
                            <Pill
                              size="sm"
                              active={invResidualMode === "market"}
                              onClick={() => setInvResidualMode("market")}
                            >
                              市场残值 {pct(marketResRate, 0)}
                            </Pill>
                            <Pill
                              size="sm"
                              active={invResidualMode === "book"}
                              onClick={() => setInvResidualMode("book")}
                            >
                              账面残值 {pct(bookResRate, 0)}
                            </Pill>
                          </Row>
                          <Text size="small" tone="tertiary">
                            口径对齐资产估值：市场=residualFair 持有期末；账面=会计寿命直线至会计期末（持有期末读数）。
                          </Text>
                          {invResidualMode === "market" ? (
                            <NumField
                              compact
                              tipId="invMktRes"
                              tip="持有期末市场残值率。默认取资产估值市场曲线（天天拍车锚点等）；手改仅覆盖本页处置假设。"
                              label={`持有期末市场残值率 %（Y${holdYears}）`}
                              value={marketResRate * 100}
                              onChange={(n) => {
                                patchInvAssume({
                                  marketResRate: Math.max(
                                    0,
                                    Math.min(1, n / 100),
                                  ),
                                });
                              }}
                              hint={
                                fairAtHold != null
                                  ? `曲线锚点 ${pct(fairAtHold, 0)} · → ${moneyMxn(residualMxn, fx, ccy, 0)}`
                                  : `无市场曲线，回落账面 · → ${moneyMxn(residualMxn, fx, ccy, 0)}`
                              }
                            />
                          ) : (
                            <NumField
                              compact
                              tipId="invBookEnd"
                              tip="与资产估值「会计寿命期末残值率」同一字段；改后持有期末账面残值率按直线折旧重算。"
                              label="会计寿命期末残值率 %"
                              value={acctEndResRate * 100}
                              onChange={(n) => {
                                patchSku(cfgSku.id, {
                                  residualRate: Math.max(
                                    0,
                                    Math.min(1, n / 100),
                                  ),
                                });
                              }}
                              hint={`持有期末账面 ${pct(bookResRate, 0)}（寿命 ${cfgSku.acctYears} 年）· → ${moneyMxn(unitLanded1 * bookResRate, fx, ccy, 0)}`}
                            />
                          )}
                          <Row gap={6} align="center">
                            <Toggle
                              checked={invResidualInPath}
                              onChange={setInvResidualInPath}
                            />
                            <Text size="small">残值并入路径末月</Text>
                          </Row>
                          <CollapsibleSection
                            title="逐年残值表"
                            defaultOpen={false}
                            trailing={`${holdYears} 年`}
                          >
                            <Table
                              headers={[
                                "车龄",
                                "市场残值率",
                                "会计寿命残值率",
                                `金额·所选（${ccy}）`,
                              ]}
                              columnAlign={["left", "right", "right", "right"]}
                              rows={Array.from(
                                { length: holdYears },
                                (_, i) => {
                                  const y = i + 1;
                                  const fairY = marketFairResidualRate(
                                    cfgSku,
                                    y,
                                  );
                                  const mkt =
                                    marketResOverride != null &&
                                    y === holdYears
                                      ? marketResOverride
                                      : (fairY ??
                                        bookResidualRate(cfgSku, y));
                                  const book = bookResidualRate(cfgSku, y);
                                  const use =
                                    invResidualMode === "market" ? mkt : book;
                                  return [
                                    `Y${y}`,
                                    fairY != null ||
                                    (marketResOverride != null &&
                                      y === holdYears)
                                      ? pct(Math.min(1, Math.max(0, mkt)), 0)
                                      : cfgSku.marketIntel
                                        ? "—"
                                        : "按会计寿命线性",
                                    pct(book, 0),
                                    moneyMxn(unitLanded1 * use, fx, ccy, 0),
                                  ];
                                },
                              )}
                              striped
                            />
                            <Text size="small" tone="tertiary">
                              与资产估值「③ 逐年账面与市场残值」同口径；逐格编辑请到资产估值页调寿命/期末残值或曲线。
                            </Text>
                          </CollapsibleSection>
                        </Stack>
                      </CollapsibleSection>

                        <Row gap={8}>
                          <Button
                            variant="ghost"
                            onClick={() => reseedSkuCf(cfgSku, cfModeUse)}
                          >
                            恢复案例默认
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => setTab("invest")}
                          >
                            打开资产组合
                          </Button>
                        </Row>
                      </Stack>

                      </InvPaneScrollCol>
                      <InvPaneScrollCol
                        theme={theme}
                        tone="focus"
                        className="inv-ops-col inv-ops-col-focus"
                      >
                      {/* 中列：图 + 回本（月明细看时序「按月」） */}
                      <Stack gap={6}>
                        <InvColTitle
                          title="实时计算"
                          hint="改左列即重绘 · 时序可按年/按月"
                        />
                        <UnitCfTimelinePanel
                          compact
                          monthPath={invMonthPath}
                          ccy={ccy}
                          fx={fx}
                          unitCfGrain={unitCfGrain}
                          setUnitCfGrain={(g) => setUnitCfGrain(g)}
                          unitCfYearFocus={unitCfYearFocus}
                          setUnitCfYearFocus={(n) => setUnitCfYearFocus(n)}
                          unitCfAxisStart={unitCfAxisStart}
                          setUnitCfAxisStart={(n) => setUnitCfAxisStart(n)}
                        />
                        <Divider />
                        <Stack gap={4}>
                          <Row gap={6} wrap align="center">
                            {(
                              [
                                { id: "day" as const, label: "按日" },
                                { id: "month" as const, label: "按月" },
                                { id: "year" as const, label: "按年" },
                              ] as const
                            ).map((g) => (
                              <Pill
                                key={g.id}
                                size="sm"
                                active={invWfGrain === g.id}
                                onClick={() => setInvWfGrain(g.id)}
                              >
                                {g.label}
                              </Pill>
                            ))}
                            <Text size="small" tone="tertiary">
                              同引擎日瀑布 · 左列开关即时变
                            </Text>
                          </Row>
                          {(() => {
                            const scale =
                              invWfGrain === "day"
                                ? 1
                                : invWfGrain === "month"
                                  ? daysMoCard
                                  : daysMoCard * 12;
                            const grainLabel =
                              invWfGrain === "day"
                                ? "日"
                                : invWfGrain === "month"
                                  ? `月（×${fmt(daysMoCard, 1)} 营运日）`
                                  : `年（×${fmt(daysMoCard * 12, 0)} 日）`;
                            const steps = daySlicesToBridgeSteps(
                              cfDay.slices || [],
                            ).map((s) => ({
                              ...s,
                              mxn: s.mxn * scale,
                            }));
                            const toDisp = (mxn: number) =>
                              ccy === "MXN" ? mxn : mxn / fx;
                            return (
                              <CashflowWaterfallBridge
                                compact
                                steps={steps}
                                toDisp={toDisp}
                                ccy={ccy}
                                grainLabel={grainLabel}
                              />
                            );
                          })()}
                        </Stack>
                        <CollapsibleSection title="关键公式" defaultOpen={false}>
                        <Callout tone="info" title="稳态示意">
                          <Stack gap={4}>
                            <Text size="small">
                              月毛利 ≈ 公司收入 − 运营成本 ≈{" "}
                              {moneyMxn(companyMo, fx, ccy, 0)} −{" "}
                              {moneyMxn(opexMoApprox, fx, ccy, 0)} ={" "}
                              {moneyMxn(grossMo, fx, ccy, 0)}
                            </Text>
                            <Text size="small">
                              月净额（路径首月）= {moneyMxn(freeMo, fx, ccy, 0)}
                              {invTier.enabled
                                ? `（已扣月供约 ${moneyMxn(financeMo, fx, ccy, 0)}）`
                                : "（无优先债服）"}
                            </Text>
                            <Text size="small">
                              稳态静态回本 = 期初投入 ÷ 首月净额
                              {steadyPbMo != null
                                ? ` = ${fmt(steadyPbMo, 1)} 月`
                                : " · 净额过低"}
                            </Text>
                          </Stack>
                        </Callout>
                        </CollapsibleSection>
                        <Callout
                          tone="warning"
                          title="回本口径对照（避免 60 月 vs M22 打架）"
                        >
                          <Stack gap={4}>
                            <Text size="small">
                              稳态静态：
                              {steadyPbMo != null
                                ? `${fmt(steadyPbMo, 1)} 月`
                                : "—"}
                              （只用首月净额，不含空窗/保证金时序）
                            </Text>
                            <Text size="small">
                              路径静态：
                              {pathPbMo != null ? `M${pathPbMo}` : "期内未回本"}
                              （累计 Σ CF_t 首次 ≥0
                              {invResidualInPath
                                ? "；末月已加残值"
                                : "，与时序图同一套"}
                              ）
                            </Text>
                            <Text size="small">
                              动态回收：
                              {pathDynamicPb.months != null
                                ? `M${pathDynamicPb.months}`
                                : "期内未回本"}
                              （折现 {pct(UNIT_CF_DISCOUNT_ANN, 0)}
                              {invResidualInPath ? " · 含残值末月" : ""}）
                            </Text>
                            <Text size="small" tone="secondary">
                              投资人决策以路径静态 / 动态为准；稳态静态仅作直觉对照。
                            </Text>
                          </Stack>
                        </Callout>
                      </Stack>
                      </InvPaneScrollCol>
                      </div>
                    </div>
                    );
                  })()}

                  {cfgSku.kind === "station" &&
                    (() => {
                      const opsLive = resolveStationOps(cfgSku);
                      const patchOps = (patch: Partial<StationOpsConstants>) =>
                        patchSku(cfgSku.id, {
                          stationOps: { ...opsLive, ...patch },
                        });
                      const horizonDefault = Math.min(
                        60,
                        Math.max(12, (cfgSku.acctYears || 5) * 12),
                      );
                      const holdYearsSt = Math.max(
                        1,
                        invAssume.holdYears != null && invAssume.holdYears > 0
                          ? Math.round(invAssume.holdYears)
                          : Math.round(horizonDefault / 12),
                      );
                      const horizonLive =
                        invAssume.holdYears != null && invAssume.holdYears > 0
                          ? Math.min(120, Math.max(12, holdYearsSt * 12))
                          : horizonDefault;
                      const stBars = buildStationMonthBars({
                        unitLandedMxn: unitLanded1,
                        guns: gunsForOps,
                        ops: stOps,
                        maintMxn: cfgSku.maintMxn || 0,
                        months: horizonLive,
                      });
                      const stBookRes = bookResidualRate(cfgSku, holdYearsSt);
                      const stFair = marketFairResidualRate(
                        cfgSku,
                        holdYearsSt,
                      );
                      const stMktOverride =
                        invAssume.marketResRate ?? invAssume.residualRate;
                      const stMarketRes = Math.max(
                        0,
                        Math.min(
                          1,
                          stMktOverride ?? stFair ?? stBookRes,
                        ),
                      );
                      const stResRate =
                        invResidualMode === "market"
                          ? stMarketRes
                          : stBookRes;
                      const stAcctEnd = skuLifeEndResidual(cfgSku, "acct");
                      const stResidualMxn = unitLanded1 * stResRate;
                      const withRes = (nets: number[], res: number) => {
                        if (!(res > 0) || nets.length === 0) return nets.slice();
                        const o = nets.slice();
                        o[o.length - 1] = (o[o.length - 1] || 0) + res;
                        return o;
                      };
                      const stNetsRaw = stBars.map((b) => b.netMxn);
                      const stNets = invResidualInPath
                        ? withRes(stNetsRaw, stResidualMxn)
                        : stNetsRaw;
                      const stIrrMo = irr(stNets);
                      const stIrrAnn =
                        stIrrMo != null && stIrrMo > -0.99
                          ? Math.pow(1 + stIrrMo, 12) - 1
                          : null;
                      const stNpv = npvAnnualOnMonths(
                        stNets,
                        UNIT_CF_DISCOUNT_ANN,
                      );
                      const stPb = staticPaybackPeriod(stNets);
                      const stDyn = dynamicPaybackPeriod(
                        stNets,
                        UNIT_CF_DISCOUNT_ANN,
                      );
                      const stInit = unitLanded1;
                      const stCum = stNetsRaw.reduce((s, n) => s + n, 0);
                      const stTotal = stCum + stResidualMxn;
                      const stMult =
                        stInit > 0 ? (stInit + stTotal) / stInit : null;
                      const steadyMo =
                        stNetMo > 1 && stInit > 0 ? stInit / stNetMo : null;
                      const sensSt = (() => {
                        const run = (
                          label: string,
                          opsPatch?: Partial<StationOpsConstants>,
                          resMult = 1,
                        ) => {
                          const ops = { ...stOps, ...(opsPatch || {}) };
                          const bars = buildStationMonthBars({
                            unitLandedMxn: unitLanded1,
                            guns: gunsForOps,
                            ops,
                            maintMxn: cfgSku.maintMxn || 0,
                            months: horizonLive,
                          }).map((b) => b.netMxn);
                          const nets = invResidualInPath
                            ? withRes(bars, stResidualMxn * resMult)
                            : bars;
                          const im = irr(nets);
                          const ia =
                            im != null && im > -0.99
                              ? Math.pow(1 + im, 12) - 1
                              : null;
                          const pb = staticPaybackPeriod(nets);
                          return {
                            label,
                            pb:
                              pb.months != null
                                ? `M${pb.months}`
                                : "期内未回本",
                            irr: pct(ia),
                          };
                        };
                        const rows = [
                          {
                            label: invResidualInPath
                              ? "基准（含残值末月）"
                              : "基准",
                            pb:
                              stPb.months != null
                                ? `M${stPb.months}`
                                : "期内未回本",
                            irr: pct(stIrrAnn),
                          },
                          run("外用利用−10%", {
                            externalUtil: Math.max(
                              0.02,
                              stOps.externalUtil * 0.9,
                            ),
                          }),
                          run("外用利用+10%", {
                            externalUtil: Math.min(
                              0.35,
                              stOps.externalUtil * 1.1,
                            ),
                          }),
                          run("购电成本+10%", {
                            elecCostMxn: stOps.elecCostMxn * 1.1,
                          }),
                          run("租金+运维+10%", {
                            rentMonthMxn: stOps.rentMonthMxn * 1.1,
                            opexMonthMxn: stOps.opexMonthMxn * 1.1,
                          }),
                        ];
                        if (invResidualInPath) {
                          rows.push(run("残值 0%", undefined, 0));
                        }
                        return rows;
                      })();
                      const invMonthPath: UnitCfPathPt[] = (() => {
                        let opsI = 0;
                        return assignUnitCfYearIds(
                          stBars.map((b) => {
                            const isCapex = b.label.startsWith("期初");
                            const isOps = b.label.startsWith("经营");
                            if (isOps) opsI += 1;
                            return {
                              label: b.label,
                              shortZh: isCapex ? "购置" : `M${opsI}`,
                              inflow: b.opsInMxn,
                              outflow: b.outflowMxn,
                              net: b.netMxn,
                              kind: (isCapex
                                ? "capex"
                                : "ops") as UnitCfPathPt["kind"],
                              opsMonth: isOps ? opsI : 0,
                              yearId: 0,
                            };
                          }),
                        );
                      })();
                      return (
                        <div
                          className="inv-ops-layout"
                          style={{
                            height: "100%",
                            minHeight: 0,
                            display: "flex",
                            flexDirection: "column",
                            gap: INV_PANE_GAP,
                            overflow: "hidden",
                          }}
                        >
                          <InvPaneTopStrip theme={theme}>
                            <Stack gap={6}>
                              <InvColTitle
                                title="核心输出"
                                hint="路径回本 · IRR · NPV · 敏感性"
                              />
                              <Grid columns={GRID_STATS} gap={8}>
                                <Stat
                                  value={
                                    stPb.months != null
                                      ? `M${stPb.months}`
                                      : "未回本"
                                  }
                                  label="路径静态回收期"
                                />
                                <Stat
                                  value={
                                    stDyn.months != null
                                      ? `M${stDyn.months}`
                                      : "未回本"
                                  }
                                  label={`动态回收期 · ${pct(UNIT_CF_DISCOUNT_ANN, 0)}`}
                                />
                                <Stat
                                  value={pct(stIrrAnn)}
                                  label={`${Math.round(horizon / 12)}年路径 IRR`}
                                  tone={
                                    stIrrAnn != null && stIrrAnn > 0.12
                                      ? "success"
                                      : stIrrAnn != null && stIrrAnn > 0
                                        ? "info"
                                        : undefined
                                  }
                                />
                                <Stat
                                  value={
                                    (stNpv >= 0 ? "+" : "") +
                                    moneyMxn(stNpv, fx, ccy)
                                  }
                                  label={`NPV ${pct(UNIT_CF_DISCOUNT_ANN, 0)}`}
                                  tone={
                                    stNpv > 0
                                      ? "success"
                                      : stNpv < 0
                                        ? "warning"
                                        : undefined
                                  }
                                />
                              </Grid>
                              <Row gap={10} wrap align="center">
                                <Text size="small">
                                  期初 {moneyMxn(stInit, fx, ccy, 0)}
                                </Text>
                                <Text size="small">
                                  累计 {moneyMxn(stCum, fx, ccy, 0)}
                                </Text>
                                <Text size="small">
                                  残值 {moneyMxn(stResidualMxn, fx, ccy, 0)}
                                </Text>
                                <Text size="small" weight="semibold">
                                  总回报 {moneyMxn(stTotal, fx, ccy, 0)}
                                  {stMult != null
                                    ? ` · ${fmt(stMult, 2)}x`
                                    : ""}
                                </Text>
                              </Row>
                              <CollapsibleSection
                                title="敏感性"
                                defaultOpen={false}
                                trailing={`${sensSt.length} 情景`}
                              >
                                <Table
                                  headers={["情景", "路径回收", "IRR"]}
                                  columnAlign={["left", "right", "right"]}
                                  rows={sensSt.map((r) => [
                                    r.label,
                                    r.pb,
                                    r.irr,
                                  ])}
                                  striped
                                />
                              </CollapsibleSection>
                            </Stack>
                          </InvPaneTopStrip>
                          <div
                            className="inv-ops-grid"
                            style={{
                              flex: 1,
                              minHeight: 0,
                              display: "grid",
                              gridTemplateColumns: INV_PANE_GRID_TWO,
                              gap: INV_PANE_GAP,
                              overflow: "hidden",
                            }}
                          >
                          <InvPaneScrollCol
                            theme={theme}
                            className="inv-ops-col inv-ops-col-assume"
                          >
                          <Stack gap={6}>
                            <InvColTitle
                              title="假设输入 · 场站"
                              hint="利用率 / 电价 / 租金 · 与规格页同套"
                            />
                            <CollapsibleSection
                              title="收入假设"
                              defaultOpen
                              trailing={
                                moneyMxn(stRevMo, fx, ccy, 0) + "/月"
                              }
                            >
                              <Stack gap={8}>
                                <Grid columns={GRID_TIER_FIELDS} gap={6}>
                                  <NumField
                                    compact
                                    label="外部利用率"
                                    value={opsLive.externalUtil}
                                    onChange={(n) =>
                                      patchOps({ externalUtil: n })
                                    }
                                  />
                                  <NumField
                                    compact
                                    label="内部利用率"
                                    value={opsLive.internalUtil}
                                    onChange={(n) =>
                                      patchOps({ internalUtil: n })
                                    }
                                  />
                                  <NumField
                                    compact
                                    label="对外电价"
                                    value={opsLive.externalPriceMxn}
                                    onChange={(n) =>
                                      patchOps({ externalPriceMxn: n })
                                    }
                                  />
                                  <NumField
                                    compact
                                    label="对内电价"
                                    value={opsLive.internalPriceMxn}
                                    onChange={(n) =>
                                      patchOps({ internalPriceMxn: n })
                                    }
                                  />
                                  <NumField
                                    compact
                                    label="首年负荷"
                                    value={opsLive.rampStartLoad}
                                    onChange={(n) =>
                                      patchOps({ rampStartLoad: n })
                                    }
                                  />
                                </Grid>
                                <Stat
                                  value={moneyMxn(stRevMo, fx, ccy, 0)}
                                  label={`稳态收入 / 月 · ${gunsForOps} 枪`}
                                />
                              </Stack>
                            </CollapsibleSection>
                            <CollapsibleSection
                              title="成本假设"
                              defaultOpen
                              trailing={
                                moneyMxn(stVarMo + stFixedMo, fx, ccy, 0) +
                                "/月"
                              }
                            >
                              <Stack gap={8}>
                                <Grid columns={GRID_TIER_FIELDS} gap={6}>
                                  <NumField
                                    compact
                                    label="购电成本"
                                    value={opsLive.elecCostMxn}
                                    onChange={(n) =>
                                      patchOps({ elecCostMxn: n })
                                    }
                                  />
                                  <NumField
                                    compact
                                    label="线损系数"
                                    value={opsLive.lossFactor}
                                    onChange={(n) =>
                                      patchOps({ lossFactor: n })
                                    }
                                  />
                                  <NumField
                                    compact
                                    label="月租金"
                                    value={opsLive.rentMonthMxn}
                                    onChange={(n) =>
                                      patchOps({ rentMonthMxn: n })
                                    }
                                  />
                                  <NumField
                                    compact
                                    label="月运维包"
                                    value={opsLive.opexMonthMxn}
                                    onChange={(n) =>
                                      patchOps({ opexMonthMxn: n })
                                    }
                                  />
                                </Grid>
                                <Stat
                                  value={moneyMxn(stNetMo, fx, ccy, 0)}
                                  label="稳态净额 / 月（情景已写入）"
                                />
                              </Stack>
                            </CollapsibleSection>
                            <CollapsibleSection
                              title="资产处置"
                              trailing={moneyMxn(stResidualMxn, fx, ccy, 0)}
                            >
                              <Stack gap={8}>
                                <NumField
                                  compact
                                  tipId="invHoldYSt"
                                  tip="持有期（年）= 处置时点；与会计寿命分离。"
                                  label="持有期 年"
                                  value={holdYearsSt}
                                  onChange={(n) => {
                                    const y = Math.max(
                                      1,
                                      Math.min(12, Math.round(n)),
                                    );
                                    patchInvAssume({ holdYears: y });
                                  }}
                                  hint={`路径 ${horizonLive} 月 · 会计寿命 ${cfgSku.acctYears} 年`}
                                />
                                <Row gap={6} wrap>
                                  <Pill
                                    size="sm"
                                    active={invResidualMode === "market"}
                                    onClick={() =>
                                      setInvResidualMode("market")
                                    }
                                  >
                                    市场残值 {pct(stMarketRes, 0)}
                                  </Pill>
                                  <Pill
                                    size="sm"
                                    active={invResidualMode === "book"}
                                    onClick={() => setInvResidualMode("book")}
                                  >
                                    账面残值 {pct(stBookRes, 0)}
                                  </Pill>
                                </Row>
                                {invResidualMode === "market" ? (
                                  <NumField
                                    compact
                                    tipId="invMktResSt"
                                    tip="持有期末市场残值率；默认市场曲线，可手改覆盖。"
                                    label={`持有期末市场残值率 %（Y${holdYearsSt}）`}
                                    value={stMarketRes * 100}
                                    onChange={(n) => {
                                      patchInvAssume({
                                        marketResRate: Math.max(
                                          0,
                                          Math.min(1, n / 100),
                                        ),
                                      });
                                    }}
                                    hint={`→ ${moneyMxn(stResidualMxn, fx, ccy, 0)}`}
                                  />
                                ) : (
                                  <NumField
                                    compact
                                    tipId="invBookEndSt"
                                    tip="与资产估值「会计寿命期末残值率」同一字段。"
                                    label="会计寿命期末残值率 %"
                                    value={stAcctEnd * 100}
                                    onChange={(n) => {
                                      patchSku(cfgSku.id, {
                                        residualRate: Math.max(
                                          0,
                                          Math.min(1, n / 100),
                                        ),
                                      });
                                    }}
                                    hint={`持有期末账面 ${pct(stBookRes, 0)} · → ${moneyMxn(unitLanded1 * stBookRes, fx, ccy, 0)}`}
                                  />
                                )}
                                <Row gap={6} align="center">
                                  <Toggle
                                    checked={invResidualInPath}
                                    onChange={setInvResidualInPath}
                                  />
                                  <Text size="small">残值并入路径末月</Text>
                                </Row>
                              </Stack>
                            </CollapsibleSection>
                          </Stack>
                          </InvPaneScrollCol>
                          <InvPaneScrollCol
                            theme={theme}
                            tone="focus"
                            className="inv-ops-col inv-ops-col-focus"
                          >
                          <Stack gap={6}>
                            <InvColTitle
                              title="实时计算"
                              hint="改左列即重绘 · 时序可按年/按月"
                            />
                            <UnitCfTimelinePanel
                              compact
                              monthPath={invMonthPath}
                              ccy={ccy}
                              fx={fx}
                              unitCfGrain={unitCfGrain}
                              setUnitCfGrain={(g) => setUnitCfGrain(g)}
                              unitCfYearFocus={unitCfYearFocus}
                              setUnitCfYearFocus={(n) => setUnitCfYearFocus(n)}
                              unitCfAxisStart={unitCfAxisStart}
                              setUnitCfAxisStart={(n) => setUnitCfAxisStart(n)}
                            />
                            <Callout
                              tone="warning"
                              title="回本口径对照"
                            >
                              <Stack gap={4}>
                                <Text size="small">
                                  稳态静态：
                                  {steadyMo != null
                                    ? `${fmt(steadyMo, 1)} 月`
                                    : "—"}
                                </Text>
                                <Text size="small">
                                  路径静态：
                                  {stPb.months != null
                                    ? `M${stPb.months}`
                                    : "期内未回本"}
                                </Text>
                                <Text size="small">
                                  动态回收：
                                  {stDyn.months != null
                                    ? `M${stDyn.months}`
                                    : "期内未回本"}
                                </Text>
                              </Stack>
                            </Callout>
                          </Stack>
                          </InvPaneScrollCol>
                          </div>
                        </div>
                      );
                    })()}

              </div>

            </div>
          )}

          {skuPane === "specs" && (
          <Stack gap={12}>
            {/* 规格页只列参数与四大件；档位/报价已在顶栏，不在此重复 */}
            {cfgSku.kind === "vehicle" && (
              <>
            <Text size="small" tone="tertiary">
              随顶栏配置档更新；电池 / 续航 / 补能等见下表。
            </Text>
            <SpecSheetList
              rows={productSpecsForSelectedVariant(
                cfgSku,
                selectedConfigId(cfgSku, cfgConfigBySku),
              )}
              renderCites={renderSourceCites}
              borderColor={theme.stroke.secondary}
              footnotesById={(() => {
                if (cfgSku.kind !== "vehicle") return undefined;
                const cfgId = selectedConfigId(cfgSku, cfgConfigBySku);
                const variant = resolveConfigVariant(cfgSku, cfgId);
                const cityKm =
                  variant?.actualCityKm ||
                  (cfgSku.id === "aion-es" ? 375 : 380);
                const hintMode: OpMode =
                  cfgSku.id === "aion-es"
                    ? "DAE"
                    : cfgMode === "DAE"
                      ? "LTO"
                      : cfgMode;
                const profile = findOpsProfile(
                  cfgCountry,
                  cfgVertical,
                  hintMode,
                  cfgManager,
                );
                const hint = opsChargeHint({
                  mode: hintMode,
                  util: profile.util,
                  daysWeek: profile.daysWeek,
                  actualCityKm: cityKm,
                  batteryKwh:
                    variant?.batteryKwh ||
                    cfgSku.configVariants?.[0]?.batteryKwh ||
                    50,
                  dcFastMin30to80: variant?.dcFastMin30to80,
                  acChargeKw: variant?.acChargeKw,
                });
                return {
                  "range-actual": `运营补能：约 ${hint.chargesPerDay.toFixed(1)} 次/天（日里程≈${Math.round(hint.kmDay)} km，可用窗口≈市区实续航×60%）。单次快充约 ${hint.fastMin} min（30%→80%）· 慢充同等电量约 ${hint.slowHoursSameWindow.toFixed(1)} h · 慢充满电约 ${hint.slowHoursFull.toFixed(1)} h`,
                  "range-extreme": (() => {
                    const ex =
                      variant?.actualExtremeKm ||
                      Math.round(cityKm * 0.65);
                    const coldHint = opsChargeHint({
                      mode: hintMode,
                      util: profile.util,
                      daysWeek: profile.daysWeek,
                      actualCityKm: ex,
                      batteryKwh:
                        variant?.batteryKwh ||
                        cfgSku.configVariants?.[0]?.batteryKwh ||
                        50,
                      dcFastMin30to80: variant?.dcFastMin30to80,
                      acChargeKw: variant?.acChargeKw,
                    });
                    return `寒冷工况（约市区实续航×0.65）：极端续航≈${ex} km → 约需充电 ${coldHint.chargesPerDay.toFixed(1)} 次/天。墨北冬夜/高原晨峰排班宜按此下探；正式值待路试。`;
                  })(),
                  charge: `与「续航（实际）」同行口径：快充按公开 30%→80%；慢充按 AC ${variant?.acChargeKw ?? 6.6} kW。场站功率/路试会改次数与时长。`,
                  warranty: `整车质保以海外经销/公开册为准；墨最终以采购合同与本地授权服务为准。`,
                  "warranty-battery":
                    cfgSku.id === "aion-es"
                      ? `电池质保约8年或20万km（先到为准）。国内177Ah营运延保不自动适用墨西哥；合同须锁电芯型号、SOH/换包门槛与停运补偿。`
                      : `电池及电机约8年或20万km（香港公开册，先到为准）。合同须写明衰减换包门槛、营运车是否同权与本地服务商。`,
                };
              })()}
            />

            <Stack gap={6}>
              <H3 style={TYPE.h3}>四大件 · 品牌与供应商</H3>
              <Text tone="tertiary" style={TYPE.caption}>
                车身 / 电池 / 电机 / 轮胎等关键件；待填项留空，写入本 SKU。
              </Text>
            </Stack>
            <Stack gap={10}>
              {(cfgSku.majorComponents || []).map((c) => {
                const needFill =
                  c.status === "pending" ||
                  isPlaceholderMajorField(c.brandZh) ||
                  isPlaceholderMajorField(c.supplierZh);
                return (
                  <Card key={c.id}>
                    <CardHeader
                      trailing={
                        <Pill size="sm">{needFill ? "待补齐" : "已填"}</Pill>
                      }
                    >
                      {c.nameZh}
                    </CardHeader>
                    <CardBody>
                      <Grid columns={GRID_FORM} gap={12}>
                        <Stack gap={4}>
                          <FieldLabel>品牌</FieldLabel>
                          <TextInput
                            value={pendingBlank(c.brandZh)}
                            placeholder="品牌"
                            onChange={(val) =>
                              patchSku(cfgSku.id, {
                                majorComponents: (
                                  cfgSku.majorComponents || []
                                ).map((x) =>
                                  x.id === c.id
                                    ? {
                                        ...x,
                                        brandZh: val,
                                        status:
                                          val &&
                                          !val.includes("待填") &&
                                          x.supplierZh &&
                                          !x.supplierZh.includes("待填")
                                            ? "known"
                                            : "pending",
                                      }
                                    : x,
                                ),
                              })
                            }
                          />
                        </Stack>
                        <Stack gap={4}>
                          <FieldLabel>供应商</FieldLabel>
                          <TextInput
                            value={pendingBlank(c.supplierZh)}
                            placeholder="供应商"
                            onChange={(val) =>
                              patchSku(cfgSku.id, {
                                majorComponents: (
                                  cfgSku.majorComponents || []
                                ).map((x) =>
                                  x.id === c.id
                                    ? {
                                        ...x,
                                        supplierZh: val,
                                        status:
                                          x.brandZh &&
                                          !x.brandZh.includes("待填") &&
                                          val &&
                                          !val.includes("待填")
                                            ? "known"
                                            : "pending",
                                      }
                                    : x,
                                ),
                              })
                            }
                          />
                        </Stack>
                        <Stack gap={4}>
                          <FieldLabel>生产商 / OEM</FieldLabel>
                          <TextInput
                            value={pendingBlank(c.manufacturerZh)}
                            placeholder="生产法人"
                            onChange={(val) =>
                              patchSku(cfgSku.id, {
                                majorComponents: (
                                  cfgSku.majorComponents || []
                                ).map((x) =>
                                  x.id === c.id
                                    ? { ...x, manufacturerZh: val }
                                    : x,
                                ),
                              })
                            }
                          />
                        </Stack>
                        <Stack gap={4}>
                          <FieldLabel>规格</FieldLabel>
                          <TextInput
                            value={pendingBlank(c.specZh)}
                            placeholder="规格"
                            onChange={(val) =>
                              patchSku(cfgSku.id, {
                                majorComponents: (
                                  cfgSku.majorComponents || []
                                ).map((x) =>
                                  x.id === c.id ? { ...x, specZh: val } : x,
                                ),
                              })
                            }
                          />
                        </Stack>
                      </Grid>
                      {c.noteZh ? (
                        <Text tone="tertiary" style={TYPE.caption}>
                          {c.noteZh}
                        </Text>
                      ) : null}
                      {c.sourceIds && c.sourceIds.length > 0 && (
                        <Text tone="secondary" style={TYPE.caption}>
                          信源 {renderSourceCites(c.sourceIds)}
                        </Text>
                      )}
                    </CardBody>
                  </Card>
                );
              })}
            </Stack>

              </>
            )}

          {cfgSku.kind === "station" && cfgSku.stationSpec && (
            <Stack gap={14}>
              <Text tone="tertiary" style={TYPE.caption}>
                场站规格、设备 BOM 与运营商填写表；供应商追溯在「供应链」页。
              </Text>
              <H3 style={TYPE.h3}>商详规格 · 场站</H3>
              <Callout
                tone="neutral"
                title={`${cfgSku.nameZh} · 本资产规格`}
              >
                <Stack gap={8}>
                  {renderCitedNote(cfgSku.stationSpec.noteZh, [
                    "fenbang-station-xlsx",
                    "ev-logic-docx",
                  ])}
                </Stack>
              </Callout>
              <Table
                headers={["规格", "取值", "状态"]}
                columnAlign={["left", "left", "left"]}
                rows={[
                  [
                    "车位",
                    `${cfgSku.stationSpec.parkingSpaces} 个`,
                    "测算默认",
                  ],
                  [
                    "快充枪",
                    `${cfgSku.stationSpec.fastGuns} 枪`,
                    "测算默认",
                  ],
                  [
                    "慢充枪",
                    `${cfgSku.stationSpec.slowGuns} 枪`,
                    cfgSku.stationSpec.slowGuns > 0 ? "已填" : "待确认",
                  ],
                  [
                    "桩体台数",
                    `${cfgSku.stationSpec.chargerCabinets} 台`,
                    "测算默认",
                  ],
                  [
                    "总功率",
                    `${cfgSku.stationSpec.totalPowerKw} kW`,
                    "测算/待双端",
                  ],
                  [
                    "场站面积",
                    `${cfgSku.stationSpec.areaSqm} ㎡`,
                    "测算备注",
                  ],
                  [
                    "品牌",
                    cfgSku.stationSpec.brand || "—",
                    cfgSku.stationSpec.brand ? "已填" : "待管理人",
                  ],
                  [
                    "供应商",
                    cfgSku.stationSpec.supplier || "—",
                    cfgSku.stationSpec.supplier ? "已填" : "待管理人",
                  ],
                  [
                    "生产商",
                    cfgSku.stationSpec.manufacturer || "—",
                    cfgSku.stationSpec.manufacturer ? "已填" : "待管理人",
                  ],
                  [
                    "质保",
                    cfgSku.stationSpec.warrantyYears > 0
                      ? `${cfgSku.stationSpec.warrantyYears} 年`
                      : "—",
                    cfgSku.stationSpec.warrantyYears > 0
                      ? "已填"
                      : "待管理人",
                  ],
                  [
                    "变压器",
                    cfgSku.stationSpec.transformerKva > 0
                      ? `${cfgSku.stationSpec.transformerKva} kVA`
                      : "—",
                    cfgSku.stationSpec.transformerKva > 0
                      ? "已填"
                      : "待管理人",
                  ],
                  [
                    "柴油发电机",
                    cfgSku.stationSpec.dieselGeneratorKva > 0
                      ? `${cfgSku.stationSpec.dieselGeneratorKva} kVA`
                      : "—",
                    cfgSku.stationSpec.dieselGeneratorKva > 0
                      ? "已填"
                      : "待管理人",
                  ],
                ]}
                striped
              />

              <H3 style={TYPE.h3}>设备 BOM</H3>
              <Text size="small" tone="secondary">
                分项合计应对齐设备包购入价{" "}
                {moneyMxn(cfgSku.purchasePriceMxn, fx, ccy)}；当前 BOM 合计{" "}
                {moneyMxn(stationBomSum(cfgSku), fx, ccy)}
                {Math.abs(stationBomSum(cfgSku) - cfgSku.purchasePriceMxn) > 1
                  ? " · 与购入价不一致，待核价"
                  : " · 已对齐"}
              </Text>
              <Table
                headers={[
                  "分项",
                  "数量",
                  `金额（${ccy}）`,
                  "状态",
                  "备注",
                ]}
                columnAlign={["left", "right", "right", "left", "left"]}
                rows={(cfgSku.stationBom || []).map((b) => [
                  b.nameZh,
                  `${b.qty}${b.unit}`,
                  moneyMxn(b.amountMxn, fx, ccy),
                  b.status === "locked" ? "已锁定" : "待核对",
                  b.noteZh,
                ])}
                striped
              />

              <H3 style={TYPE.h3}>本资产经营常量</H3>
              <Text size="small" tone="tertiary">
                跟本 SKU 走：大/中/小预配置默认不同；改这里只影响当前场站，不改其他资产。
              </Text>
              {(() => {
                const ops = resolveStationOps(cfgSku);
                const patchOps = (patch: Partial<StationOpsConstants>) =>
                  patchSku(cfgSku.id, {
                    stationOps: { ...ops, ...patch },
                  });
                return (
                  <Grid columns={GRID_STATS} gap={10}>
                    <NumField
                      label="单枪功率 kW"
                      value={ops.powerKwPerGun}
                      onChange={(n) => patchOps({ powerKwPerGun: n })}
                      hint={`总功率约 ${(ops.powerKwPerGun * stationGunCount(cfgSku)).toFixed(0)} kW`}
                    />
                    <NumField
                      label="外部利用率"
                      value={ops.externalUtil}
                      onChange={(n) => patchOps({ externalUtil: n })}
                    />
                    <NumField
                      label="内部利用率"
                      value={ops.internalUtil}
                      onChange={(n) => patchOps({ internalUtil: n })}
                    />
                    <NumField
                      label="对外电价 MXN/kWh"
                      value={ops.externalPriceMxn}
                      onChange={(n) => patchOps({ externalPriceMxn: n })}
                    />
                    <NumField
                      label="对内电价 MXN/kWh"
                      value={ops.internalPriceMxn}
                      onChange={(n) => patchOps({ internalPriceMxn: n })}
                    />
                    <NumField
                      label="购电成本 MXN/kWh"
                      value={ops.elecCostMxn}
                      onChange={(n) => patchOps({ elecCostMxn: n })}
                    />
                    <NumField
                      label="线损系数"
                      value={ops.lossFactor}
                      onChange={(n) => patchOps({ lossFactor: n })}
                    />
                    <NumField
                      label="月租金 MXN"
                      value={ops.rentMonthMxn}
                      onChange={(n) => patchOps({ rentMonthMxn: n })}
                    />
                    <NumField
                      label="月运维包 MXN"
                      value={ops.opexMonthMxn}
                      onChange={(n) => patchOps({ opexMonthMxn: n })}
                    />
                    <NumField
                      label="首年负荷"
                      value={ops.rampStartLoad}
                      onChange={(n) => patchOps({ rampStartLoad: n })}
                    />
                  </Grid>
                );
              })()}

              <Stack gap={4}>
                <H3 style={TYPE.h3}>运营商配置填写表</H3>
                <Text tone="tertiary" style={TYPE.caption}>
                  当前 {cfgManagerMeta.nameZh} · 补齐品牌、供应商、质保与变压器/柴发等；写入本
                  SKU。
                  {stationFillPending(cfgSku).length > 0
                    ? ` 尚有 ${stationFillPending(cfgSku).length} 项必填未填。`
                    : " 必填项已齐。"}
                </Text>
              </Stack>
              <Stack gap={10}>
                {(cfgSku.specFill || []).map((row) => (
                  <Stack key={row.id} gap={4}>
                    <FieldLabel>
                      {`${row.fieldZh}${row.required ? " *" : ""}${row.hintZh ? ` · ${row.hintZh}` : ""}`}
                    </FieldLabel>
                    <TextInput
                      value={pendingBlank(row.value)}
                      placeholder="管理人填写…"
                      onChange={(val) => {
                        const nextFill = (cfgSku.specFill || []).map((r) =>
                          r.id === row.id ? { ...r, value: val } : r,
                        );
                        const patch: Partial<AssetSku> = {
                          specFill: nextFill,
                        };
                        const spec = {
                          ...(cfgSku.stationSpec as StationSpec),
                        };
                        if (row.id === "brand") {
                          patch.brand = val || "待填";
                          spec.brand = val;
                        }
                        if (row.id === "supplier") spec.supplier = val;
                        if (row.id === "manufacturer")
                          spec.manufacturer = val;
                        if (row.id === "warranty") {
                          const n = Number(val);
                          if (!Number.isNaN(n) && val.trim() !== "")
                            spec.warrantyYears = n;
                        }
                        if (row.id === "parking") {
                          const n = Number(val);
                          if (!Number.isNaN(n)) spec.parkingSpaces = n;
                        }
                        if (row.id === "fast") {
                          const n = Number(val);
                          if (!Number.isNaN(n)) spec.fastGuns = n;
                        }
                        if (row.id === "slow") {
                          const n = Number(val);
                          if (!Number.isNaN(n)) spec.slowGuns = n;
                        }
                        if (row.id === "transformer_kva") {
                          const n = Number(val);
                          if (!Number.isNaN(n) && val.trim() !== "")
                            spec.transformerKva = n;
                        }
                        if (row.id === "diesel_kva") {
                          const n = Number(val);
                          if (!Number.isNaN(n) && val.trim() !== "")
                            spec.dieselGeneratorKva = n;
                        }
                        if (row.id === "area") {
                          const n = Number(val);
                          if (!Number.isNaN(n)) spec.areaSqm = n;
                        }
                        if (row.id === "power") {
                          const n = Number(val);
                          if (!Number.isNaN(n)) spec.totalPowerKw = n;
                        }
                        patch.stationSpec = spec;
                        patchSku(cfgSku.id, patch);
                      }}
                    />
                  </Stack>
                ))}
              </Stack>
              <Grid columns={GRID_FORM} gap={12}>
                <Stack gap={4}>
                  <Text size="small" tone="secondary">
                    运营商
                  </Text>
                  <Select
                    value={managerIdUse}
                    onChange={(v) => setCfgManager(v)}
                    options={enabledOperators.map((m) => ({
                      value: m.id,
                      label: `${m.nameZh} · ${m.hint}`,
                    }))}
                  />
                </Stack>
                <NumField
                  label="投放年份 Y"
                  value={cfgYear}
                  onChange={(n) =>
                    setCfgYear(Math.max(1, Math.min(12, Math.round(n))))
                  }
                />
              </Grid>
              <Text size="small" tone="tertiary">
                购物车按「座」加购；下单写入订单时按 枪数=每座枪数×座数，并把本 SKU 经营常量同步到组合前提（多站并存时以后下单者为准，精细叠加待增强）。
              </Text>
            </Stack>
          )}
          </Stack>
          )}

          {skuPane === "supply" && (
          <Stack gap={16}>
            <Stack gap={6}>
              <H3 style={TYPE.h3}>供应链追溯</H3>
              <Text tone="secondary" style={TYPE.caption}>
                供应商 → 工厂；关联方按「{cfgManagerMeta.nameZh}」判定。产品规格见「规格」页。
              </Text>
            </Stack>

            <Row gap={12} align="end" wrap>
              <Stack gap={4} style={{ minWidth: 220, flex: "1 1 220px" }}>
                <FieldLabel>当前运营商</FieldLabel>
                <Select
                  value={managerIdUse}
                  onChange={(v) => setCfgManager(v)}
                  options={enabledOperators.map((m) => ({
                    value: m.id,
                    label: `${m.nameZh} · ${m.hint}`,
                  }))}
                />
              </Stack>
              {supplyChainPending(cfgSku).length > 0 ? (
                <Text tone="tertiary" style={TYPE.caption}>
                  尚有 {supplyChainPending(cfgSku).length} 个节点待补齐
                </Text>
              ) : (
                <Text tone="tertiary" style={TYPE.caption}>
                  主体与关联方已齐
                </Text>
              )}
            </Row>

            <Table
              headers={[
                "序",
                "角色",
                "主体",
                "国家/地区",
                "证件/RFC",
                ...operatorList.map((o) => o.nameZh),
                "备注",
              ]}
              columnAlign={[
                "right",
                "left",
                "left",
                "left",
                "left",
                ...operatorList.map(() => "left" as const),
                "left",
              ]}
              rows={[...(cfgSku.supplyChain || [])]
                .sort((a, b) => a.step - b.step)
                .map((n) => [
                  String(n.step),
                  n.roleZh,
                  n.nameZh + (n.nameEn ? ` / ${n.nameEn}` : ""),
                  n.countryZh || "—",
                  n.legalId || "—",
                  ...operatorList.map((o) =>
                    relatedFlagZh(relatedFlagOf(n.relatedParty, o.id)),
                  ),
                  n.noteZh,
                ])}
              striped
            />

            <Stack gap={10}>
              <Stack gap={4}>
                <Text weight="medium" style={TYPE.body}>
                  主体名称与关联方
                </Text>
                <Text tone="tertiary" style={TYPE.caption}>
                  运营商填写/更正后写入本 SKU；每个节点落到可签约主体。
                </Text>
              </Stack>
              {[...(cfgSku.supplyChain || [])]
                .sort((a, b) => a.step - b.step)
                .map((n) => {
                  const curFlag = relatedFlagOf(n.relatedParty, managerIdUse);
                  return (
                    <Card key={`${cfgSku.id}-${n.id}`}>
                      <CardHeader
                        trailing={
                          <Pill size="sm">
                            {cfgManagerMeta.nameZh} · {relatedFlagZh(curFlag)}
                          </Pill>
                        }
                      >
                        {n.step}. {n.roleZh}
                      </CardHeader>
                      <CardBody>
                        <Grid columns={GRID_FORM} gap={12}>
                          <Stack gap={4}>
                            <FieldLabel>主体名称</FieldLabel>
                            <TextInput
                              value={pendingBlank(n.nameZh)}
                              placeholder="法人全称"
                              onChange={(val) =>
                                patchSku(cfgSku.id, {
                                  supplyChain: (cfgSku.supplyChain || []).map(
                                    (x) =>
                                      x.id === n.id
                                        ? { ...x, nameZh: val }
                                        : x,
                                  ),
                                })
                              }
                            />
                          </Stack>
                          <Stack gap={4}>
                            <FieldLabel>证件 / RFC</FieldLabel>
                            <TextInput
                              value={pendingBlank(n.legalId)}
                              placeholder="RFC / 统一社会信用代码"
                              onChange={(val) =>
                                patchSku(cfgSku.id, {
                                  supplyChain: (cfgSku.supplyChain || []).map(
                                    (x) =>
                                      x.id === n.id
                                        ? { ...x, legalId: val }
                                        : x,
                                  ),
                                })
                              }
                            />
                          </Stack>
                          {operatorList.map((op) => (
                            <Stack key={op.id} gap={4}>
                              <FieldLabel>{`是否 ${op.nameZh} 关联方`}</FieldLabel>
                              <Select
                                value={relatedFlagOf(n.relatedParty, op.id)}
                                onChange={(val) =>
                                  patchSku(cfgSku.id, {
                                    supplyChain: (cfgSku.supplyChain || []).map(
                                      (x) =>
                                        x.id === n.id
                                          ? {
                                              ...x,
                                              relatedParty: {
                                                ...x.relatedParty,
                                                [op.id]: val as RelatedFlag,
                                              },
                                            }
                                          : x,
                                    ),
                                  })
                                }
                                options={[
                                  { value: "yes", label: "是 · 关联方" },
                                  { value: "no", label: "否" },
                                  { value: "unknown", label: "未知" },
                                  { value: "pending", label: "待填" },
                                ]}
                              />
                            </Stack>
                          ))}
                        </Grid>
                      </CardBody>
                    </Card>
                  );
                })}
            </Stack>
          </Stack>
          )}

          {skuPane === "valuation" && (
            <Stack gap={14}>
              <Stack gap={6}>
                <H3 style={TYPE.h3}>资产估值 · 残值</H3>
                <Text tone="tertiary" style={TYPE.caption}>
                  本 SKU
                  一体关切：寿命口径→期末残值率→账面/市场路径→墨市对表（Libro
                  Azul）→投残对照。组合只叠加各 SKU，顶栏不再单开「残值」页。
                </Text>
              </Stack>
              <Row gap={8} align="center" wrap>
                <Text size="small" weight="medium">
                  ① 寿命口径与期末残值率
                </Text>
                <Spacer />
                <Button
                  variant="ghost"
                  onClick={() => {
                    const catalog = DEFAULT_ASSET_SKUS.find(
                      (s) => s.id === cfgSku.id,
                    );
                    const physDef =
                      cfgSku.kind === "station"
                        ? DEFAULT_LIFE_YEARS.physStation
                        : DEFAULT_LIFE_YEARS.physVehicle;
                    const nextAcct =
                      catalog?.acctYears ?? DEFAULT_LIFE_YEARS.acct;
                    const nextPhys = catalog?.physYears ?? physDef;
                    const nextMaint =
                      catalog?.maintYears ?? DEFAULT_LIFE_YEARS.maint;
                    const nextCap = Math.max(
                      DEFAULT_LIFE_YEARS.cap,
                      nextAcct,
                      nextPhys,
                      nextMaint,
                    );
                    setLifeYearsCapBySku((prev) => ({
                      ...prev,
                      [cfgSku.id]: nextCap,
                    }));
                    patchSku(cfgSku.id, {
                      acctYears: nextAcct,
                      physYears: nextPhys,
                      maintYears: nextMaint,
                      residualRate:
                        catalog?.residualRate ?? DEFAULT_END_RESIDUAL.acct,
                      physResidualRate:
                        catalog?.physResidualRate ?? DEFAULT_END_RESIDUAL.phys,
                      maintResidualRate:
                        catalog?.maintResidualRate ??
                        DEFAULT_END_RESIDUAL.maint,
                    });
                  }}
                >
                  一键还原默认测算
                </Button>
              </Row>
              <Text size="small" tone="tertiary">
                默认：会计 {DEFAULT_LIFE_YEARS.acct} 年 · 物理{" "}
                {cfgSku.kind === "station"
                  ? DEFAULT_LIFE_YEARS.physStation
                  : DEFAULT_LIFE_YEARS.physVehicle}{" "}
                年 · 维保 {DEFAULT_LIFE_YEARS.maint}{" "}
                年。属资产出厂/会计属性；墨西哥对表见下文 Libro Azul。
              </Text>
              {(() => {
                const lifeCapRaw =
                  lifeYearsCapBySku[cfgSku.id] ??
                  Math.max(
                    DEFAULT_LIFE_YEARS.cap,
                    cfgSku.acctYears,
                    cfgSku.physYears,
                    cfgSku.maintYears,
                  );
                const lifeCap = Math.max(
                  DEFAULT_LIFE_YEARS.capMin,
                  Math.min(
                    DEFAULT_LIFE_YEARS.capMax,
                    Math.round(lifeCapRaw),
                  ),
                );
                const setLifeCap = (n: number) => {
                  const next = Math.max(
                    DEFAULT_LIFE_YEARS.capMin,
                    Math.min(DEFAULT_LIFE_YEARS.capMax, Math.round(n)),
                  );
                  setLifeYearsCapBySku((prev) => ({
                    ...prev,
                    [cfgSku.id]: next,
                  }));
                  // 上限下调时，三寿命一并压到上限内
                  if (
                    cfgSku.acctYears > next ||
                    cfgSku.physYears > next ||
                    cfgSku.maintYears > next
                  ) {
                    patchSku(cfgSku.id, {
                      acctYears: Math.min(cfgSku.acctYears, next),
                      physYears: Math.min(cfgSku.physYears, next),
                      maintYears: Math.min(cfgSku.maintYears, next),
                    });
                  }
                };
                const bumpLife = (
                  key: "acctYears" | "physYears" | "maintYears",
                  n: number,
                ) => {
                  const clamped = Math.max(1, Math.min(lifeCap, Math.round(n)));
                  patchSku(cfgSku.id, { [key]: clamped });
                };
                return (
                  <Stack gap={12}>
                    <YearStepper
                      label="年限上限（可调）"
                      value={lifeCap}
                      min={DEFAULT_LIFE_YEARS.capMin}
                      max={DEFAULT_LIFE_YEARS.capMax}
                      onChange={setLifeCap}
                      hint={`残值曲线横轴与三寿命调节上限；默认 ${DEFAULT_LIFE_YEARS.cap} 年`}
                    />
                    <Grid columns={GRID_STATS} gap={12}>
                      <YearStepper
                        label="会计寿命"
                        value={cfgSku.acctYears}
                        max={lifeCap}
                        onChange={(n) => bumpLife("acctYears", n)}
                        hint={`默认 ${DEFAULT_LIFE_YEARS.acct} 年`}
                      />
                      <YearStepper
                        label="物理寿命"
                        value={cfgSku.physYears}
                        max={lifeCap}
                        onChange={(n) => bumpLife("physYears", n)}
                        hint={`默认 ${
                          cfgSku.kind === "station"
                            ? DEFAULT_LIFE_YEARS.physStation
                            : DEFAULT_LIFE_YEARS.physVehicle
                        } 年`}
                      />
                      <YearStepper
                        label="维保寿命"
                        value={cfgSku.maintYears}
                        max={lifeCap}
                        onChange={(n) => bumpLife("maintYears", n)}
                        hint={`默认 ${DEFAULT_LIFE_YEARS.maint} 年`}
                      />
                    </Grid>
                  </Stack>
                );
              })()}
              <Stack gap={8}>
                <Text tone="secondary" style={TYPE.label}>
                  各寿命期末残值率（可配）
                </Text>
                <Text tone="tertiary" style={TYPE.caption}>
                  默认：会计 {Math.round(DEFAULT_END_RESIDUAL.acct * 100)}% · 物理{" "}
                  {Math.round(DEFAULT_END_RESIDUAL.phys * 100)}% · 维保{" "}
                  {Math.round(DEFAULT_END_RESIDUAL.maint * 100)}
                  %；直线折旧到对应寿命期末。
                </Text>
                <Grid columns={GRID_STATS} gap={12}>
                  <PercentStepper
                    label="会计寿命期末"
                    valuePct={
                      Math.round(
                        (cfgSku.residualRate ?? DEFAULT_END_RESIDUAL.acct) *
                          1000,
                      ) / 10
                    }
                    onChangePct={(pct) =>
                      patchSku(cfgSku.id, {
                        residualRate: Math.max(0, Math.min(100, pct)) / 100,
                      })
                    }
                    hint={`默认 ${Math.round(DEFAULT_END_RESIDUAL.acct * 100)}%`}
                  />
                  <PercentStepper
                    label="物理寿命期末"
                    valuePct={
                      Math.round(
                        (cfgSku.physResidualRate ?? DEFAULT_END_RESIDUAL.phys) *
                          1000,
                      ) / 10
                    }
                    onChangePct={(pct) =>
                      patchSku(cfgSku.id, {
                        physResidualRate: Math.max(0, Math.min(100, pct)) / 100,
                      })
                    }
                    hint={`默认 ${Math.round(DEFAULT_END_RESIDUAL.phys * 100)}%`}
                  />
                  <PercentStepper
                    label="维保寿命期末"
                    valuePct={
                      Math.round(
                        (cfgSku.maintResidualRate ??
                          DEFAULT_END_RESIDUAL.maint) *
                          1000,
                      ) / 10
                    }
                    onChangePct={(pct) =>
                      patchSku(cfgSku.id, {
                        maintResidualRate:
                          Math.max(0, Math.min(100, pct)) / 100,
                      })
                    }
                    hint={`默认 ${Math.round(DEFAULT_END_RESIDUAL.maint * 100)}%`}
                  />
                </Grid>
              </Stack>
              <Callout tone="neutral" title="维保政策">
                {cfgSku.maintPolicyZh}
              </Callout>

              <Stack gap={8}>
                <Text size="small" weight="medium">
                  ② 投残时点与本 SKU 对照
                </Text>
                <Row gap={8} align="center" wrap>
                  <Text size="small" tone="secondary">
                    残值时点模式（与组合 IRR 期末一致）
                  </Text>
                  <Select
                    value={p.residualMode}
                    onChange={(v) => update("residualMode", v as ResidualMode)}
                    options={[
                      { value: "accounting", label: "会计年限" },
                      { value: "physical", label: "物理年限" },
                      { value: "maintenance", label: "维保 / 质保年限" },
                    ]}
                  />
                </Row>
                {(() => {
                  const mode = p.residualMode;
                  const lifeY =
                    mode === "physical"
                      ? cfgSku.physYears
                      : mode === "maintenance"
                        ? cfgSku.maintYears
                        : cfgSku.acctYears;
                  const endR =
                    mode === "physical"
                      ? (cfgSku.physResidualRate ?? DEFAULT_END_RESIDUAL.phys)
                      : mode === "maintenance"
                        ? (cfgSku.maintResidualRate ??
                          DEFAULT_END_RESIDUAL.maint)
                        : (cfgSku.residualRate ?? DEFAULT_END_RESIDUAL.acct);
                  const listPx = skuPurchasePriceMxn(
                    cfgSku,
                    selectedConfigId(cfgSku, cfgConfigBySku),
                  );
                  const endMxn = listPx * endR;
                  const modeZh =
                    mode === "physical"
                      ? "物理"
                      : mode === "maintenance"
                        ? "维保"
                        : "会计";
                  const toDisp = (mxn: number) =>
                    Math.round(ccy === "MXN" ? mxn : mxn / fx);
                  return (
                    <Stack gap={8}>
                      <Grid columns={GRID_STATS} gap={10}>
                        <Stat
                          label={`购置时点0（${ccy}）`}
                          value={moneyMxn(listPx, fx, ccy)}
                          tone="neutral"
                        />
                        <Stat
                          label={`${modeZh}寿命期末`}
                          value={`Y${lifeY} · ${pct(endR)}`}
                        />
                        <Stat
                          label={`期末残值（${ccy}）`}
                          value={moneyMxn(endMxn, fx, ccy)}
                        />
                      </Grid>
                      <BarChart
                        categories={[`时点0 购置`, `Y${lifeY} 残值`]}
                        series={[
                          {
                            name: cfgSku.nameZh,
                            data: [toDisp(listPx), toDisp(endMxn)],
                            tone: CHART_BW,
                          },
                        ]}
                        height={180}
                        valueSuffix={` ${ccy}`}
                      />
                      <Text size="small" tone="tertiary">
                        左=付款购入；右=所选「{modeZh}年限」终点残值。
                      </Text>
                    </Stack>
                  );
                })()}
              </Stack>

              <Text size="small" weight="medium">
                ③ 逐年账面与市场残值
              </Text>
              <Table
                headers={[
                  "车龄/站龄",
                  "会计寿命残值率",
                  `账面参考（${ccy}）`,
                  cfgSku.marketIntel ? "市场残值率" : "说明",
                  cfgSku.marketIntel ? `市场参考（${ccy}）` : "—",
                ]}
                columnAlign={["left", "right", "right", "right", "right"]}
                rows={[1, 2, 3, 4, 5].map((y) => {
                  const bookR = bookResidualRate(cfgSku, y);
                  const fair = cfgSku.marketIntel?.residualFair.find(
                    (pt) => pt.year === y,
                  );
                  const fairR = fair ? fair.ratePct / 100 : null;
                  const listPx = skuPurchasePriceMxn(
                    cfgSku,
                    selectedConfigId(cfgSku, cfgConfigBySku),
                  );
                  return [
                    `Y${y}`,
                    pct(bookR),
                    moneyMxn(listPx * bookR, fx, ccy),
                    fairR != null
                      ? pct(fairR)
                      : cfgSku.marketIntel
                        ? "—"
                        : "按会计寿命线性",
                    fairR != null
                      ? moneyMxn(listPx * fairR, fx, ccy)
                      : "—",
                  ];
                })}
                striped
              />
              {cfgSku.marketIntel && (
                <Stack gap={10}>
                  <Text size="small" weight="medium">
                    中国市场曲线（对照，非墨市成交）
                  </Text>
                  <Callout tone="neutral" title={cfgSku.marketIntel.scopeZh}>
                    {cfgSku.marketIntel.residualProxyZh}
                  </Callout>
                  {(() => {
                    const fairPts = cfgSku.marketIntel.residualFair;
                    const indPts = cfgSku.marketIntel.residualIndustry;
                    const lifeCap = Math.max(
                      DEFAULT_LIFE_YEARS.capMin,
                      Math.min(
                        DEFAULT_LIFE_YEARS.capMax,
                        Math.round(
                          lifeYearsCapBySku[cfgSku.id] ??
                            Math.max(
                              DEFAULT_LIFE_YEARS.cap,
                              cfgSku.acctYears,
                              cfgSku.physYears,
                              cfgSku.maintYears,
                            ),
                        ),
                      ),
                    );
                    const maxY = Math.max(
                      lifeCap,
                      cfgSku.acctYears,
                      cfgSku.physYears,
                      cfgSku.maintYears,
                    );
                    const years = Array.from({ length: maxY + 1 }, (_, i) => i);
                    const cats = years.map((y) => `Y${y}`);
                    const defs: {
                      key: "book" | "phys" | "maint" | "fair" | "industry";
                      name: string;
                      shortZh: string;
                      tone: "info" | "danger" | "neutral" | "warning" | "success";
                      swatch: "blue" | "purple" | "cyan" | "orange" | "green";
                      data: number[];
                    }[] = [
                      {
                        key: "book",
                        name: `会计寿命%（${cfgSku.acctYears}年）`,
                        shortZh: `会计寿命（${cfgSku.acctYears}年）`,
                        tone: "info",
                        swatch: "blue",
                        data: years.map(
                          (y) =>
                            Math.round(bookResidualRate(cfgSku, y) * 1000) /
                            10,
                        ),
                      },
                      {
                        key: "phys",
                        name: `物理寿命%（${cfgSku.physYears}年）`,
                        shortZh: `物理寿命（${cfgSku.physYears}年）`,
                        tone: "danger",
                        swatch: "purple",
                        data: years.map(
                          (y) =>
                            Math.round(physResidualRate(cfgSku, y) * 1000) /
                            10,
                        ),
                      },
                      {
                        key: "maint",
                        name: `维保寿命%（${cfgSku.maintYears}年）`,
                        shortZh: `维保寿命（${cfgSku.maintYears}年）`,
                        tone: "neutral",
                        swatch: "cyan",
                        data: years.map(
                          (y) =>
                            Math.round(maintResidualRate(cfgSku, y) * 1000) /
                            10,
                        ),
                      },
                      {
                        key: "fair",
                        name: "市场残值%",
                        shortZh: "市场残值",
                        tone: "warning",
                        swatch: "orange",
                        data: years.map((y) =>
                          residualCurveRatePct(fairPts, y, 8),
                        ),
                      },
                      {
                        key: "industry",
                        name: "行业残值%",
                        shortZh: "行业残值",
                        tone: "success",
                        swatch: "green",
                        data: years.map((y) =>
                          residualCurveRatePct(indPts, y, 10),
                        ),
                      },
                    ];
                    const curveOn = {
                      book: residualCurveOn.book !== false,
                      phys: residualCurveOn.phys !== false,
                      maint: residualCurveOn.maint !== false,
                      fair: residualCurveOn.fair !== false,
                      industry: residualCurveOn.industry !== false,
                    };
                    const visible = defs.filter((d) => curveOn[d.key]);
                    const endBookPct =
                      Math.round(skuLifeEndResidual(cfgSku, "acct") * 1000) /
                      10;
                    const endPhysPct =
                      Math.round(skuLifeEndResidual(cfgSku, "phys") * 1000) /
                      10;
                    const endMaintPct =
                      Math.round(skuLifeEndResidual(cfgSku, "maint") * 1000) /
                      10;
                    const refLines = [
                      curveOn.book
                        ? {
                            value: endBookPct,
                            label: `会计寿命期末 ${endBookPct}%`,
                            tone: "info" as const,
                          }
                        : null,
                      curveOn.phys
                        ? {
                            value: endPhysPct,
                            label: `物理寿命期末 ${endPhysPct}%`,
                            tone: "danger" as const,
                          }
                        : null,
                      curveOn.maint
                        ? {
                            value: endMaintPct,
                            label: `维保寿命期末 ${endMaintPct}%`,
                            tone: "neutral" as const,
                          }
                        : null,
                    ].filter(Boolean) as {
                      value: number;
                      label: string;
                      tone: "info" | "danger" | "neutral";
                    }[];
                    return (
                      <Stack gap={8}>
                        <Row gap={8} align="center" wrap>
                          <Text size="small" tone="secondary">
                            曲线（点灭可隐藏）
                          </Text>
                          {defs.map((d) => (
                            <Pill
                              key={d.key}
                              size="sm"
                              active={curveOn[d.key]}
                              leadingContent={<Swatch color={d.swatch} />}
                              onClick={() =>
                                setResidualCurveOn({
                                  ...curveOn,
                                  [d.key]: !curveOn[d.key],
                                })
                              }
                            >
                              {d.shortZh}
                            </Pill>
                          ))}
                        </Row>
                        {visible.length > 0 ? (
                          <LineChart
                            height={240}
                            categories={cats}
                            series={visible.map((d) => ({
                              name: d.name,
                              data: d.data,
                              tone: d.tone,
                            }))}
                            valueSuffix="%"
                            showValues={visible.length === 1}
                            beginAtZero
                            yMax={100}
                            referenceLines={
                              refLines.length > 0 ? refLines : undefined
                            }
                          />
                        ) : (
                          <Text size="small" tone="tertiary">
                            已全部点灭；点亮上方任一曲线即可对照。
                          </Text>
                        )}
                        <Text size="small" tone="tertiary">
                          会计/物理/维保寿命：各自按对应年限直线折旧至上方可配的期末残值率（默认 0）。市场残值、行业残值另计；Y6+ 为长尾递减示意，非墨市成交。
                        </Text>
                      </Stack>
                    );
                  })()}
                  {renderCitedNote(
                    cfgSku.marketIntel.residualNoteZh,
                    cfgSku.marketIntel.residualSourceIds,
                  )}
                </Stack>
              )}
              <Stack gap={8}>
                <Text size="small" weight="medium">
                  ④ 墨市对表 · Libro Azul（待合作）
                </Text>
                <Text size="small" tone="secondary">
                  Guía EBC《Libro Azul》是墨西哥汽车估值事实标准（类中国车300）：商业出版物，非政府文件；金融/保险/政务与车商广泛采用。官网无公开可抓取单车价；残值对表依赖商务合作后再写入引擎。审慎风控默认对齐收购价（Compra）。
                </Text>
                {renderSourceCites([
                  "libro-azul-guia-ebc",
                  "libro-azul-coop-track",
                  "che300-platform",
                ])}
                <Table
                  headers={["价格类型", "西语", "业务含义", "合作后用法"]}
                  columnAlign={["left", "left", "left", "left"]}
                  rows={[
                    [
                      "收购价",
                      "Valor de compra",
                      "车商等专业买方愿付价",
                      "LTV / 全损 / 审慎残值基准",
                    ],
                    [
                      "零售价",
                      "Valor de venta",
                      "私人或零售端建议售价（通常更高）",
                      "市场参考；融资勿直接作 LTV",
                    ],
                  ]}
                  striped
                />
                <Text size="small" tone="tertiary">
                  当前期末残值率仍为测算参数；合作落地前不假装已对表。中国天天拍车/车300曲线仅作对照。
                </Text>
              </Stack>
              <Grid columns={GRID_FORM} gap={12}>
                <Stat
                  label={`年保险（${ccy}）`}
                  value={moneyMxn(cfgSku.insuranceYrMxn, fx, ccy)}
                />
                <Stat
                  label={`年磨损计提（${ccy}）`}
                  value={moneyMxn(cfgSku.wearYrMxn, fx, ccy)}
                />
              </Grid>
            </Stack>
          )}

          {skuPane === "market" && cfgSku.marketIntel && (
            <Stack gap={14}>
              {(() => {
                const mi = cfgSku.marketIntel;
                const term = reputationTerminal(mi.reputation);
                const parc = resolveMarketParc(mi, marketParcCountry);
                const parcChartUnit = parc.unitZh.includes("台")
                  ? "台"
                  : "万辆";
                return (
                  <>
              <Stack gap={6}>
                <Row gap={10} align="center" wrap>
                  <H3 style={TYPE.h3}>市场口碑</H3>
                  <Button variant="ghost" onClick={() => setTab("sources")}>
                    信源库
                  </Button>
                </Row>
                <Text tone="tertiary" style={TYPE.caption}>
                  保有量可切中国 / 墨西哥；终端反馈综合分暂仍为中国平台（懂车帝/汽车之家），墨市本地评分待建。保值见「资产估值」。
                </Text>
              </Stack>

              <Grid columns={GRID_FORM} gap={14}>
                <Stack
                  gap={6}
                  style={mergeStyle({
                    padding: 14,
                    border: `1px solid ${theme.stroke.secondary}`,
                    background: theme.bg.elevated,
                  })}
                >
                  <Row gap={8} align="center" wrap>
                    <Text tone="secondary" style={TYPE.label}>
                      保有量
                    </Text>
                    <Pill
                      size="sm"
                      active={marketParcCountry === "CN"}
                      onClick={() => setMarketParcCountry("CN")}
                    >
                      中国
                    </Pill>
                    <Pill
                      size="sm"
                      active={marketParcCountry === "MX"}
                      onClick={() => setMarketParcCountry("MX")}
                    >
                      墨西哥
                    </Pill>
                  </Row>
                  <Text weight="medium" style={TYPE.h2}>
                    {formatParcHero(parc)}
                  </Text>
                  <Row gap={8} align="center" wrap>
                    <Pill size="sm">{parc.countryZh}</Pill>
                    <Pill size="sm">置信度·{parc.confidenceZh}</Pill>
                  </Row>
                  <Text tone="secondary" style={TYPE.body}>
                    {parc.labelZh}
                  </Text>
                  <Text tone="tertiary" style={TYPE.caption}>
                    {parc.methodZh} · {parc.asOfZh}
                  </Text>
                  <Text tone="tertiary" style={TYPE.caption}>
                    {parc.noteZh}
                  </Text>
                  {renderSourceCites(parc.sourceIds)}
                </Stack>
                <Stack
                  gap={6}
                  style={mergeStyle({
                    padding: 14,
                    border: `1px solid ${theme.stroke.secondary}`,
                    background: theme.bg.elevated,
                  })}
                >
                  <Text tone="secondary" style={TYPE.label}>
                    终端反馈综合分
                  </Text>
                  <Row gap={10} align="end" wrap>
                    <Text weight="medium" style={TYPE.h2}>
                      {term.score.toFixed(2)}
                    </Text>
                    <Pill size="sm">{term.gradeZh}</Pill>
                    <Pill size="sm">{term.saturationZh}</Pill>
                  </Row>
                  <Text tone="secondary" style={TYPE.body}>
                    {term.diffZh}（同价位均分 {term.peerAvg.toFixed(2)}）
                  </Text>
                  <Text tone="tertiary" style={TYPE.caption}>
                    懂车帝 / 汽车之家等按评价数加权 · 合计 {term.reviews}{" "}
                    条 · {mi.reputation.asOfZh}
                    {marketParcCountry === "MX"
                      ? " · 保有已切墨西哥，口碑分仍为中国平台对照"
                      : ""}
                  </Text>
                  <Text tone="tertiary" style={TYPE.caption}>
                    {term.meaningZh}
                  </Text>
                  {renderSourceCites(mi.reputation.sourceIds)}
                </Stack>
              </Grid>

              <Stack gap={8}>
                <Text weight="medium" style={TYPE.body}>
                  各平台终端分
                </Text>
                <Table
                  headers={["平台", "得分", "评价数", "档位", "说明"]}
                  columnAlign={["left", "right", "right", "left", "left"]}
                  rows={term.platforms.map((p) => [
                    p.platformZh,
                    p.score.toFixed(2),
                    String(p.reviews),
                    p.gradeZh,
                    p.noteZh || "—",
                  ])}
                  striped
                />
                <Text tone="tertiary" style={TYPE.caption}>
                  综合分 = Σ(平台分 × 评价数) / Σ评价数；评价越多权重越高。车质网等投诉类信源不进
                  1–5 分，见下方事件。
                </Text>
              </Stack>

              {parc.ref.rows.length > 0 && (
                <Card collapsible defaultOpen={false}>
                  <CardHeader
                    trailing={
                      <Text size="small" tone="tertiary">
                        {parc.countryZh} · {formatParcHero(parc)}
                      </Text>
                    }
                  >
                    保有量对照（展开）
                  </CardHeader>
                  <CardBody>
                    <Stack gap={10}>
                      <Text tone="secondary" style={TYPE.caption}>
                        {parc.ref.howToReadZh}
                      </Text>
                      <BarChart
                        height={200}
                        categories={parc.ref.rows.map((r) => r.nameZh)}
                        series={[
                          {
                            name: `保有/销量量级（${parcChartUnit}）`,
                            data: parc.ref.rows.map((r) => r.value),
                            tone: CHART_BW,
                          },
                        ]}
                        beginAtZero
                      />
                      <Table
                        headers={["对照", "量级", "角色", "读法"]}
                        rows={parc.ref.rows.map((r) => [
                          r.nameZh,
                          `${r.value} ${r.unitZh}`,
                          r.role === "self"
                            ? "本车"
                            : r.role === "peer"
                              ? "对标车"
                              : r.role === "segment"
                                ? "细分档"
                                : r.role === "fleet"
                                  ? "本组合"
                                  : "刻度",
                          r.noteZh,
                        ])}
                        striped
                      />
                    </Stack>
                  </CardBody>
                </Card>
              )}

              {mi.scoreRef && (
                <Card collapsible defaultOpen={false}>
                  <CardHeader
                    trailing={
                      <Text size="small" tone="tertiary">
                        {term.gradeZh} · 综合 {term.score.toFixed(2)}
                      </Text>
                    }
                  >
                    分数刻度与对标（展开）
                  </CardHeader>
                  <CardBody>
                    <Stack gap={10}>
                      <Text tone="secondary" style={TYPE.caption}>
                        {mi.scoreRef.howToReadZh}
                      </Text>
                      <Table
                        headers={["刻度带", "分数区间", "业务含义"]}
                        rows={mi.scoreRef.bands.map((b) => [
                          b.gradeZh,
                          `${b.min.toFixed(2)} – ${b.max.toFixed(2)}`,
                          b.meaningZh,
                        ])}
                        striped
                      />
                      <BarChart
                        height={180}
                        categories={mi.scoreRef.rows.map((r) => r.nameZh)}
                        series={[
                          {
                            name: "参照分",
                            data: mi.scoreRef.rows.map((r) => r.value),
                            tone: CHART_BW,
                          },
                        ]}
                        beginAtZero
                        yMax={5}
                      />
                    </Stack>
                  </CardBody>
                </Card>
              )}

              <Divider />
              <H3 style={TYPE.h3}>口碑分项（主平台）</H3>
              <Text tone="tertiary" style={TYPE.caption}>
                以下分项来自 {mi.reputation.platformZh}，便于看营运相关短板。
              </Text>
              <BarChart
                height={200}
                categories={mi.reputation.dims.map((d) => d.nameZh)}
                series={[
                  {
                    name: "分项分",
                    data: mi.reputation.dims.map((d) => d.score),
                    tone: CHART_BW,
                  },
                ]}
                beginAtZero
                yMax={5}
              />
              <Table
                headers={["正面标签", "槽点标签"]}
                rows={[
                  [
                    mi.reputation.tagsPros.join(" · "),
                    mi.reputation.tagsCons.join(" · "),
                  ],
                ]}
              />

              {(mi.reputation.reviewSnippets || []).length > 0 && (
                <Card collapsible defaultOpen>
                  <CardHeader
                    trailing={
                      <Text size="small" tone="tertiary">
                        好评{" "}
                        {
                          mi.reputation.reviewSnippets.filter(
                            (r) => r.tone === "pro",
                          ).length
                        }{" "}
                        · 差评{" "}
                        {
                          mi.reputation.reviewSnippets.filter(
                            (r) => r.tone === "con",
                          ).length
                        }
                      </Text>
                    }
                  >
                    终端好评 / 差评明细
                  </CardHeader>
                  <CardBody>
                    <Grid columns={GRID_FORM} gap={12}>
                      <Stack gap={8}>
                        <Text weight="semibold" size="small">
                          好评
                        </Text>
                        {mi.reputation.reviewSnippets
                          .filter((r) => r.tone === "pro")
                          .map((r) => (
                            <Stack key={r.id} gap={4}>
                              <Row gap={8} align="center" wrap>
                                <Text weight="semibold" size="small">
                                  {r.titleZh}
                                </Text>
                                <Pill size="sm">{r.topicZh}</Pill>
                              </Row>
                              <Text size="small">{r.detailZh}</Text>
                              {renderSourceCites(r.sourceIds)}
                              <Divider />
                            </Stack>
                          ))}
                      </Stack>
                      <Stack gap={8}>
                        <Text weight="semibold" size="small">
                          差评
                        </Text>
                        {mi.reputation.reviewSnippets
                          .filter((r) => r.tone === "con")
                          .map((r) => (
                            <Stack key={r.id} gap={4}>
                              <Row gap={8} align="center" wrap>
                                <Text weight="semibold" size="small">
                                  {r.titleZh}
                                </Text>
                                <Pill size="sm">{r.topicZh}</Pill>
                              </Row>
                              <Text size="small">{r.detailZh}</Text>
                              {renderSourceCites(r.sourceIds)}
                              <Divider />
                            </Stack>
                          ))}
                      </Stack>
                    </Grid>
                  </CardBody>
                </Card>
              )}
                  </>
                );
              })()}

              <Divider />
              <H3 style={TYPE.h3}>维保 · 大修 · 召回事件</H3>
              {(cfgSku.marketIntel.riskNews || []).length > 0 ? (
                <Stack gap={10}>
                  <Callout
                    tone="neutral"
                    title={
                      cfgSku.marketIntel.riskNews.some(
                        (n) => n.severity === "high",
                      )
                        ? "存在高优先级风险线索（召回/批量故障）"
                        : "以投诉与监测为主，未见高优先级批量召回"
                    }
                  >
                    投放前核电芯型号、合同质保与本地服务能力。点编号可进信源库。
                  </Callout>
                  <Table
                    headers={[
                      "级别",
                      "类型",
                      "标题",
                      "状态",
                      "时点",
                      "营运含义",
                      "信源",
                    ]}
                    rows={cfgSku.marketIntel.riskNews.map((n) => [
                      n.severity === "high"
                        ? "高"
                        : n.severity === "mid"
                          ? "中"
                          : "低",
                      n.kind === "recall"
                        ? "召回"
                        : n.kind === "battery_fault"
                          ? "电池故障"
                          : n.kind === "accident"
                            ? "事故"
                            : n.kind === "complaint"
                              ? "投诉"
                              : "媒体",
                      n.titleZh,
                      n.statusZh,
                      n.asOfZh,
                      n.opsHintZh,
                      renderSourceCites(n.sourceIds),
                    ])}
                    rowTone={cfgSku.marketIntel.riskNews.map((n) =>
                      n.severity === "high"
                        ? "neutral"
                        : n.severity === "mid"
                          ? "neutral"
                          : "neutral",
                    )}
                    striped
                  />
                  <Stack gap={8}>
                    {cfgSku.marketIntel.riskNews.map((n) => (
                      <Callout
                        key={n.id}
                        tone="neutral"
                        title={n.titleZh}
                      >
                        <Stack gap={6}>
                          <Text size="small">{n.summaryZh}</Text>
                          <Text size="small" tone="secondary">
                            营运：{n.opsHintZh}
                          </Text>
                          <Row gap={8} wrap align="center">
                            <Text size="small" tone="tertiary">
                              {n.statusZh} · {n.asOfZh}
                            </Text>
                            {renderSourceCites(n.sourceIds)}
                          </Row>
                        </Stack>
                      </Callout>
                    ))}
                  </Stack>
                </Stack>
              ) : (
                <Text size="small" tone="tertiary">
                  暂无结构化召回/大修事件落库。
                </Text>
              )}

              <Row gap={8} align="center" wrap>
                <Text size="small" tone="tertiary">
                  口碑信源 · {cfgSku.marketIntel.reputation.asOfZh}
                </Text>
                {renderSourceCites(cfgSku.marketIntel.reputation.sourceIds)}
              </Row>
            </Stack>
          )}

          <Divider />
          <Row gap={10} wrap>
            <Button variant="primary" onClick={() => setTab("config")}>
              ← 返回货架继续配置
            </Button>
          </Row>
        </Stack>
        );
      })()}


      {tab === "sources" && (
        <Stack gap={16}>
          <PageIntro
            title={pageMeta.sources!.title}
            description={pageMeta.sources!.description}
          />
          {focusedSource && (
            <Callout
              tone="neutral"
              title={`${sourceCiteBracket(focusedSource.id)} ${focusedSource.titleZh}`}
            >
              <Stack gap={8}>
                <Text size="small">
                  {focusedSource.publisherZh} · {focusedSource.kind} ·{" "}
                  {focusedSource.geography} · {focusedSource.asOf}
                </Text>
                <Text size="small">{focusedSource.noteZh}</Text>
                <Row gap={8} wrap align="center">
                  {focusedSource.url ? (
                    <Link href={focusedSource.url}>打开原文</Link>
                  ) : (
                    <Text size="small" tone="tertiary">
                      无公开 URL
                    </Text>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => setSourceFocusId("")}
                  >
                    清除定位
                  </Button>
                </Row>
              </Stack>
            </Callout>
          )}
          <Text size="small" tone="tertiary">
            业务备注旁的 [S01] 编号可点进本库。冲突口径标「待双端」。
          </Text>
          <Table
            headers={[
              "编号",
              "标题",
              "发布方",
              "类型",
              "地理",
              "时点",
              "标签",
              "备注",
              "原文",
            ]}
            columnAlign={[
              "left",
              "left",
              "left",
              "left",
              "left",
              "left",
              "left",
              "left",
              "left",
            ]}
            rowTone={SOURCE_LIB.map((s) =>
              s.id === sourceFocusId ? "neutral" : undefined,
            )}
            rows={SOURCE_LIB.map((s) => [
              <button
                key={`cite-${s.id}`}
                type="button"
                onClick={() => setSourceFocusId(s.id)}
                title={s.id}
                style={{
                  margin: 0,
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: theme.text.primary,
                  font: "inherit",
                  textDecoration:
                    sourceFocusId === s.id ? "underline" : "none",
                }}
              >
                {sourceCiteBracket(s.id)}
              </button>,
              s.titleZh,
              s.publisherZh,
              s.kind,
              s.geography,
              s.asOf,
              s.tags.join("·"),
              s.noteZh,
              s.url ? <Link href={s.url}>打开</Link> : "—",
            ])}
            striped
          />
          <H3 style={TYPE.h3}>按主题索引</H3>
          <Grid columns={GRID_FORM} gap={12}>
            {(
              [
                "测算",
                "规格",
                "残值",
                "保有量",
                "口碑",
                "召回",
                "投诉",
                "电池",
                "事故风险",
                "AION ES",
                "AION UT",
                "AION S",
              ] as string[]
            )
              .map((tag) => ({
                tag,
                hits: SOURCE_LIB.filter((s) => s.tags.includes(tag)),
              }))
              .filter((x) => x.hits.length > 0)
              .map(({ tag, hits }) => (
                <Card key={tag}>
                  <CardHeader>{tag}</CardHeader>
                  <CardBody>
                    <Stack gap={8}>
                      {hits.map((s) => (
                        <Row key={s.id} gap={8} align="center" wrap>
                          <Pill
                            size="sm"
                            active={sourceFocusId === s.id}
                            onClick={() => setSourceFocusId(s.id)}
                          >
                            {sourceCiteBracket(s.id)}
                          </Pill>
                          <Text size="small">
                            {s.publisherZh} · {s.titleZh}
                          </Text>
                          {s.url ? <Link href={s.url}>原文</Link> : null}
                        </Row>
                      ))}
                    </Stack>
                  </CardBody>
                </Card>
              ))}
          </Grid>
        </Stack>
      )}

      {tab === "orders" && (
        <Stack gap={16}>
          <PageIntro
            title={pageMeta.orders!.title}
            description={pageMeta.orders!.description}
          />

          {(() => {
            const openOrders = activeOrders.filter(
              (o) => o.status !== "cancelled",
            );
            const paidN = openOrders.filter((o) => o.status === "paid").length;
            const pendingN = openOrders.filter(
              (o) => o.status === "pending_pay",
            ).length;
            return (
              <Grid columns={GRID_STATS} gap={10}>
                <Stat
                  label="订单数"
                  value={`${openOrders.length} 笔`}
                  tone="neutral"
                />
                <Stat label="已支付 / 待支付" value={`${paidN} / ${pendingN}`} />
                <Stat
                  label={`含税合计（${ccy}）`}
                  value={moneyMxn(
                    openOrders.reduce(
                      (s, o) => s + orderTotalGrossMxn(o, p.vat),
                      0,
                    ),
                    fx,
                    ccy,
                  )}
                />
              </Grid>
            );
          })()}

          {activeOrders.filter((o) => o.status !== "cancelled").length ===
          0 ? (
            <Stack gap={8}>
              <Text size="small" tone="tertiary">
                尚无订单。请到货架加购并「生成订单」。
              </Text>
              <Button variant="secondary" onClick={() => setTab("config")}>
                去货架
              </Button>
            </Stack>
          ) : (
            <Table
              headers={[
                "编号",
                "组成",
                "付款日",
                "投产日",
                `含税（${ccy}）`,
                "状态",
                "",
              ]}
              columnAlign={[
                "left",
                "left",
                "left",
                "left",
                "right",
                "left",
                "right",
              ]}
              rows={activeOrders
                .filter((o) => o.status !== "cancelled")
                .map((o) => {
                  const active = focusOrder?.id === o.id;
                  const comp = o.lines
                    .map(
                      (l) =>
                        `${l.nameZh}×${l.qty}${l.unitLabel}`,
                    )
                    .join(" · ");
                  return [
                    <Text
                      key={`${o.id}-code`}
                      weight={active ? "semibold" : undefined}
                    >
                      {o.unitCode}
                    </Text>,
                    <Text key={`${o.id}-comp`} size="small" tone="secondary">
                      {comp}
                    </Text>,
                    o.payDate || "—",
                    o.goLiveDate || "—",
                    moneyMxn(orderTotalGrossMxn(o, p.vat), fx, ccy),
                    o.status === "paid"
                      ? "已支付"
                      : o.status === "cancelled"
                        ? "已取消"
                        : "待支付",
                    <Row key={`${o.id}-act`} gap={4}>
                      <Button
                        variant={active ? "primary" : "secondary"}
                        onClick={() => setOrderFocusId(o.id)}
                      >
                        {active ? "已选" : "打开"}
                      </Button>
                    </Row>,
                  ];
                })}
              striped
            />
          )}

          {focusOrder && focusOrder.status !== "cancelled" && (
            <Stack
              gap={14}
              style={mergeStyle({
                padding: 14,
                border: `1px solid ${theme.stroke.secondary}`,
                background: theme.bg.elevated,
              })}
            >
              <Row gap={8} align="center" wrap>
                <Text weight="medium">
                  {focusOrder.unitCode} · 支付与投产
                </Text>
                <Pill size="sm" active={focusOrder.status === "pending_pay"}>
                  {focusOrder.status === "paid"
                    ? "已支付"
                    : focusOrder.status === "cancelled"
                      ? "已取消"
                      : "待支付"}
                </Pill>
                <Spacer />
                <Button
                  variant="secondary"
                  onClick={() => setTab("invest")}
                >
                  看资产组合
                </Button>
              </Row>

              <Grid columns={GRID_STATS} gap={10}>
                <Stack gap={4}>
                  <Text size="small" tone="secondary">
                    付款日
                  </Text>
                  <TextInput
                    value={focusOrder.payDate}
                    placeholder="YYYY-MM-DD"
                    onChange={(v) =>
                      patchOrder(focusOrder.id, { payDate: v })
                    }
                  />
                </Stack>
                <Stack gap={4}>
                  <Text size="small" tone="secondary">
                    计划投产日
                  </Text>
                  <TextInput
                    value={focusOrder.goLiveDate}
                    placeholder="YYYY-MM-DD"
                    onChange={(v) =>
                      patchOrder(focusOrder.id, { goLiveDate: v })
                    }
                  />
                </Stack>
                <Stack gap={4}>
                  <Text size="small" tone="secondary">
                    备注
                  </Text>
                  <TextInput
                    value={focusOrder.noteZh}
                    placeholder="批次说明"
                    onChange={(v) =>
                      patchOrder(focusOrder.id, { noteZh: v })
                    }
                  />
                </Stack>
              </Grid>

              <Table
                headers={[
                  "资产",
                  "经营模式",
                  "数量",
                  `单台落地（${ccy}）`,
                  `行金额（${ccy}）`,
                ]}
                columnAlign={["left", "left", "right", "right", "right"]}
                rows={focusOrder.lines.map((l) => [
                  l.nameZh,
                  orderModeZh(l.modeLabel),
                  `${l.qty}${l.unitLabel}`,
                  moneyMxn(l.unitLandedMxn, fx, ccy),
                  moneyMxn(l.unitLandedMxn * l.qty, fx, ccy),
                ])}
                striped
              />

              <CollapsibleSection
                title="支付方案"
                trailing={
                  <Text size="small" tone="tertiary">
                    自有资金 {pct(orderEquityPct(focusOrder.payPlan))}
                  </Text>
                }
              >
                <Stack gap={10} style={{ paddingTop: 8 }}>
                  <Row gap={12} align="center" wrap>
                    <Text size="small">含债务融资</Text>
                    <Toggle
                      checked={!!focusOrder.payPlan.includeDebt}
                      onChange={(v) =>
                        patchOrder(focusOrder.id, {
                          payPlan: {
                            ...focusOrder.payPlan,
                            includeDebt: v,
                          },
                        })
                      }
                    />
                  </Row>
                  {focusOrder.payPlan.includeDebt && (
                    <Grid columns={GRID_STATS} gap={12}>
                      <NumField
                        label="借款比例"
                        value={focusOrder.payPlan.debtPct}
                        onChange={(n) =>
                          patchOrder(focusOrder.id, {
                            payPlan: {
                              ...focusOrder.payPlan,
                              debtPct: Math.max(0, Math.min(1, n)),
                            },
                          })
                        }
                      />
                      <NumField
                        label="借款利率"
                        value={focusOrder.payPlan.debtRate}
                        onChange={(n) =>
                          patchOrder(focusOrder.id, {
                            payPlan: {
                              ...focusOrder.payPlan,
                              debtRate: Math.max(0, n),
                            },
                          })
                        }
                      />
                      <NumField
                        label="借款年限"
                        value={focusOrder.payPlan.debtYears}
                        onChange={(n) =>
                          patchOrder(focusOrder.id, {
                            payPlan: {
                              ...focusOrder.payPlan,
                              debtYears: Math.max(1, Math.round(n)),
                            },
                          })
                        }
                      />
                    </Grid>
                  )}
                  <Grid columns={GRID_STATS} gap={10}>
                    <Stat
                      label={`含税购置（${ccy}）`}
                      value={moneyMxn(
                        orderTotalGrossMxn(focusOrder, p.vat),
                        fx,
                        ccy,
                      )}
                    />
                    <Stat
                      label={`自有资金（${ccy}）`}
                      value={moneyMxn(
                        orderEquityMxn(focusOrder, p.vat),
                        fx,
                        ccy,
                      )}
                    />
                    <Stat
                      label={`借款（${ccy}）`}
                      value={moneyMxn(
                        orderDebtMxn(focusOrder, p.vat),
                        fx,
                        ccy,
                      )}
                    />
                  </Grid>
                </Stack>
              </CollapsibleSection>

              <Row gap={8} wrap>
                {focusOrder.status === "pending_pay" && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      patchOrder(focusOrder.id, { status: "paid" });
                      setTab("invest");
                    }}
                  >
                    标记已支付并看资产组合
                  </Button>
                )}
                {focusOrder.status === "paid" && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      patchOrder(focusOrder.id, { status: "pending_pay" })
                    }
                  >
                    改回待支付
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() =>
                    patchOrder(focusOrder.id, { status: "cancelled" })
                  }
                >
                  取消订单
                </Button>
                <Button variant="ghost" onClick={() => setTab("config")}>
                  ← 货架继续选配
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    const next = DEFAULT_PURCHASE_ORDERS;
                    setPurchaseOrders(next);
                    setNodes(ordersToNodes(next));
                    setOrderFocusId(next[0]!.id);
                  }}
                >
                  恢复示例两单
                </Button>
              </Row>
            </Stack>
          )}
        </Stack>
      )}

      {tab === "overview" && (() => {
        const asOf = ASSET_AS_OF_DATE;
        const liveStagesOv = goLiveEffectiveStages(p);
        const ordersOpen = activeOrders.filter((o) => o.status !== "cancelled");
        const ordersPaid = ordersOpen.filter((o) => o.status === "paid");
        const ordersPending = ordersOpen.filter(
          (o) => o.status === "pending_pay",
        );
        const createdMxn = ordersOpen.reduce(
          (s, o) => s + orderTotalGrossMxn(o, p.vat),
          0,
        );
        const paidMxn = ordersPaid.reduce(
          (s, o) => s + orderTotalGrossMxn(o, p.vat),
          0,
        );
        const pendingMxn = ordersPending.reduce(
          (s, o) => s + orderTotalGrossMxn(o, p.vat),
          0,
        );
        const ownMxn = ordersOpen.reduce((s, o) => s + orderEquityMxn(o, p.vat), 0);
        const debtMxn = ordersOpen.reduce((s, o) => s + orderDebtMxn(o, p.vat), 0);
        const orderRowsMeta = ordersOpen.map((o) => {
          const ph = orderAssetPhase(o, asOf, liveStagesOv);
          const trial = buildModel(
            premiseWithOrderPay(p, o),
            ordersToNodes([o]),
            cards,
          );
          return { order: o, ph, trial };
        });
        const prelive = orderRowsMeta.filter(
          (x) =>
            x.ph.id === "paid_prelive" || x.ph.id === "created_unpaid",
        );
        const liveRows = orderRowsMeta.filter((x) => x.ph.id === "live");
        const investedRows = orderRowsMeta.filter(
          (x) => x.ph.id === "live" || x.ph.id === "paid_prelive",
        );
        const investedMxn = investedRows.reduce(
          (s, x) => s + orderTotalGrossMxn(x.order, p.vat),
          0,
        );
        const liveMxn = liveRows.reduce(
          (s, x) => s + orderTotalGrossMxn(x.order, p.vat),
          0,
        );
        const lastRow = model.rows[model.rows.length - 1];
        const mgrBuckets = new Map<
          string,
          { nameZh: string; orders: number; mxn: number; live: number }
        >();
        for (const { order: o, ph } of orderRowsMeta) {
          const meta = pickOperatorMeta(o.managerId);
          const key = meta.id;
          const cur = mgrBuckets.get(key) || {
            nameZh: meta.nameZh,
            orders: 0,
            mxn: 0,
            live: 0,
          };
          cur.orders += 1;
          cur.mxn += orderTotalGrossMxn(o, p.vat);
          if (ph.id === "live") cur.live += 1;
          mgrBuckets.set(key, cur);
        }
        const mgrRows = [...mgrBuckets.values()].sort((a, b) => b.mxn - a.mxn);
        return (
        <Stack gap={24}>
          <PageIntro
            title={pageMeta.overview!.title}
            description={pageMeta.overview!.description}
          />

          <Stack
            gap={12}
            style={mergeStyle({
              padding: 14,
              border: `1px solid ${theme.stroke.secondary}`,
              background: theme.bg.elevated,
            })}
          >
            <Text size="small" weight="medium">
              系统目标 · 三条主线
            </Text>
            <Grid columns={GRID_STATS} gap={12}>
              <Stack gap={6}>
                <Text size="small" weight="medium">
                  ① 组合配置 → 最佳 IRR
                </Text>
                <Text size="small" tone="tertiary">
                  货架选 SKU → 订单分批 → 资产组合测算 CF/IRR；情景与经营假设可对照求更优配置。
                </Text>
                <Stat
                  label="组合 IRR（含融资 / 全自有）"
                  value={`${pct(model.cashIrr)} / ${pct(model.unleveredIrr)}`}
                  tone={
                    model.cashIrr != null && model.cashIrr > 0.12
                      ? "success"
                      : "neutral"
                  }
                />
                <Button variant="ghost" onClick={() => setTab("invest")}>
                  打开资产组合
                </Button>
              </Stack>
              <Stack gap={6}>
                <Text size="small" weight="medium">
                  ② 公允跟踪资产估值
                </Text>
                <Text size="small" tone="tertiary">
                  商详「资产估值·残值」管寿命/残值/Libro Azul；组合层对照账面与市场残值。
                </Text>
                <Stat
                  label={`账面 / 市场残值（${unit}）`}
                  value={`${m(lastRow?.bookValue ?? 0)} / ${m(
                    lastRow?.marketResidual ?? 0,
                  )}`}
                />
                <Row gap={6} wrap>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const first =
                        normalizedSkus.find((s) => s.kind === "vehicle") ||
                        normalizedSkus[0];
                      if (first) openSkuDetail(first.id, "valuation");
                    }}
                  >
                    单 SKU 估值
                  </Button>
                  <Button variant="ghost" onClick={() => setTab("invest")}>
                    组合投残
                  </Button>
                </Row>
              </Stack>
              <Stack gap={6}>
                <Text size="small" weight="medium">
                  ③ 管理人运营分配
                </Text>
                <Text size="small" tone="tertiary">
                  同资产对照赚钱 / 出险 / 保值；弱机构在管可改挂强机构，再平衡投产收益与资产保值。
                </Text>
                <Stat
                  label="在管管理人 / 订单"
                  value={`${mgrRows.length} 家 / ${ordersOpen.length} 笔`}
                  tone="neutral"
                />
                <Button variant="ghost" onClick={() => setTab("ops")}>
                  打开运营分配
                </Button>
              </Stack>
            </Grid>
            <Text size="small" tone="tertiary">
              综合价值 = 投产经营收益（现金流 / IRR）+ 持续公允的资产价值（账面与市场残值路径）。配置与分配都服务于这一最大化。
            </Text>
          </Stack>

          <Text size="small" tone="tertiary">
            对照日 {asOf} · 资产管理口径。金额由各批次资产包叠加；付款在「订单」，测算在「资产组合」。
          </Text>

          <H3 style={TYPE.h3}>① 资产订单 · 创设与支付</H3>
          <Grid columns={GRID_STATS} gap={12}>
            <Stat
              label="已创设订单"
              value={`${ordersOpen.length} 笔`}
              tone="neutral"
            />
            <Stat
              label={`创设金额（${ccy}）`}
              value={moneyMxn(createdMxn, fx, ccy)}
            />
            <Stat
              label="已支付 / 待支付"
              value={`${ordersPaid.length} / ${ordersPending.length} 笔`}
            />
            <Stat
              label={`已付 / 待付金额（${ccy}）`}
              value={`${moneyMxn(paidMxn, fx, ccy)} / ${moneyMxn(pendingMxn, fx, ccy)}`}
            />
          </Grid>
          <Grid columns={GRID_FORM} gap={12}>
            <Stat
              label={`自有资金（管理人投入·${ccy}）`}
              value={moneyMxn(ownMxn, fx, ccy)}
            />
            <Stat
              label={`融资借款（${ccy}）`}
              value={moneyMxn(debtMxn, fx, ccy)}
            />
          </Grid>

          <H3 style={TYPE.h3}>② 投产前阶段与时点</H3>
          <Text size="small" tone="secondary">
            已创设但未投产的订单：待支付，或已支付仍在整备/上牌空窗（库存车路径；进口链路另含海运/清关）。
          </Text>
          <Table
            headers={[
              "订单",
              "阶段",
              "时点说明",
              "付款日",
              "投产日",
              `投资额（${ccy}）`,
            ]}
            columnAlign={["left", "left", "left", "left", "left", "right"]}
            rows={prelive.map(({ order: o, ph }) => [
              <Button
                key={`${o.id}-pre`}
                variant="ghost"
                onClick={() => {
                  setOrderFocusId(o.id);
                  setTab("orders");
                }}
              >
                {o.label}
              </Button>,
              ph.stageZh,
              ph.detailZh,
              o.payDate,
              o.goLiveDate,
              moneyMxn(orderTotalMxn(o), fx, ccy),
            ])}
            striped
          />
          {prelive.length === 0 && (
            <Text size="small" tone="tertiary">
              对照日下无投产前订单（或均已投产）。
            </Text>
          )}

          <H3 style={TYPE.h3}>③ 已投产资产 · 投资、现金流与损益</H3>
          <Grid columns={GRID_STATS} gap={12}>
            <Stat
              label="已投产订单"
              value={`${liveRows.length} 笔`}
            />
            <Stat
              label={`已投产投资额（${ccy}）`}
              value={moneyMxn(liveMxn, fx, ccy)}
            />
            <Stat
              label={`组合累计净现金流（${unit}）`}
              value={m(model.totals.cashFlow)}
            />
          </Grid>
          {liveRows.length > 0 ? (
            <Table
              headers={[
                "资产包/订单",
                `投资额（${ccy}）`,
                `累计净现金流（${unit}）`,
                `经营毛利（${unit}）`,
                `净利润（${unit}）`,
                "在营规模（末年）",
              ]}
              columnAlign={[
                "left",
                "right",
                "right",
                "right",
                "right",
                "right",
              ]}
              rows={liveRows.map(({ order: o, trial }) => {
                const last = trial.rows[trial.rows.length - 1];
                return [
                  o.label,
                  moneyMxn(orderTotalMxn(o), fx, ccy),
                  m(trial.totals.cashFlow),
                  m(trial.totals.contribution),
                  m(trial.totals.netIncome),
                  last
                    ? `${last.daeOnline + last.ltoOnline}台 / ${last.gunsOnline}枪`
                    : "—",
                ];
              })}
              striped
            />
          ) : (
            <Callout tone="neutral" title="对照日尚无已投产订单">
              示例订单付款日在对照日之后，或仍为待支付。可将订单标为已支付并调整投产日，或把对照日理解为规划视图——下方④⑤仍给出全量订单预测。
            </Callout>
          )}

          <H3 style={TYPE.h3}>④ 各资产包 · 预测现金流、IRR 与价值</H3>
          <Text size="small" tone="secondary">
            每一笔订单 = 一批资产单元叠加后的资产包。IRR：含融资 / 全自有资金。
          </Text>
          <Table
            headers={[
              "资产包",
              "阶段",
              `投资额（${ccy}）`,
              "IRR 含融资/全自有",
              `累计净现金流（${unit}）`,
              `账面价值（${unit}）`,
              `市场残值（${unit}）`,
            ]}
            columnAlign={[
              "left",
              "left",
              "right",
              "right",
              "right",
              "right",
              "right",
            ]}
            rows={orderRowsMeta.map(({ order: o, ph, trial }) => [
              <Button
                key={`${o.id}-fc`}
                variant="ghost"
                onClick={() => {
                  setOrderFocusId(o.id);
                  setTab("orders");
                }}
              >
                {o.label}
              </Button>,
              ph.stageZh,
              moneyMxn(orderTotalMxn(o), fx, ccy),
              `${pct(trial.cashIrr)} / ${pct(trial.unleveredIrr)}`,
              m(trial.totals.cashFlow),
              m(trial.totals.endBook),
              m(trial.totals.endResidual),
            ])}
            striped
          />

          <Stack gap={8}>
            <H3 style={TYPE.h3}>预测路径 · 开工与收入</H3>
            <LineChart
              categories={model.rows.map((r) => r.label)}
              series={[
                {
                  name: "车队开工率（%）",
                  data: model.rows.map((r) =>
                    Math.round(r.rampLoad * 100),
                  ),
                  tone: CHART_BW,
                },
                {
                  name: "当年营业收入",
                  data: model.rows.map((r) => chartVal(r.revenue)),
                  tone: CHART_BW,
                },
                {
                  name: "满编年收入（目标）",
                  data: model.rows.map((r) => chartVal(r.steadyRevenue)),
                  tone: "neutral",
                },
              ]}
              height={220}
            />
          </Stack>

          <Stack gap={8}>
            <H3 style={TYPE.h3}>预测路径 · 资产损益分层</H3>
            <LineChart
              categories={model.rows.map((r) => r.label)}
              series={[
                {
                  name: "资产经营毛利",
                  data: model.rows.map((r) => chartVal(r.contribution)),
                  tone: CHART_BW,
                },
                {
                  name: "扣场站固定费用后",
                  data: model.rows.map((r) => chartVal(r.afterSiteFixed)),
                  tone: CHART_BW,
                },
                {
                  name: "扣总部费用后经营利润",
                  data: model.rows.map((r) => chartVal(r.ebitda)),
                },
                {
                  name: "净利润",
                  data: model.rows.map((r) => chartVal(r.netIncome)),
                  tone: CHART_BW,
                },
              ]}
              height={220}
              valueSuffix={` ${unit}`}
            />
          </Stack>

          <H3 style={TYPE.h3}>⑤ 案例表投放 & 回收（IRR 复核）</H3>
          <Text size="small" tone="tertiary">
            对齐《DAE-200台含IRR》投产节点（26-10→27-03 共 200 台）与 IRR 页月度净现金流。左柱=采购投放；右柱=该批次第1–5年净现金流堆叠（毛收入×稳态净/毛比）；虚线=采购额，累计净额越过虚线≈该批回本。
          </Text>
          <Grid columns={GRID_STATS} gap={12}>
            <Stat
              label="案例 IRR（Excel 口径）"
              value={pct(FENBANG_DAE_COHORT.excelReportedIrr)}
              tone="success"
            />
            <Stat
              label="复核 IRR（月率×12）"
              value={pct(FENBANG_DAE_COHORT.irrExcelStyleAnn)}
              tone="success"
            />
            <Stat
              label="复核 IRR（复利年化）"
              value={pct(FENBANG_DAE_COHORT.irrCompoundAnn)}
            />
            <Stat
              label="月率 / 期数"
              value={`${(FENBANG_DAE_COHORT.irrMonthly * 100).toFixed(2)}% · ${FENBANG_DAE_COHORT.cfMonths}月`}
            />
          </Grid>
          <Callout tone="neutral" title="IRR 口径说明">
            Excel 公式为 IRR(F31:BS31)×12（月内部收益率×12），约{" "}
            {pct(FENBANG_DAE_COHORT.excelReportedIrr)}；本页独立重算月率{" "}
            {(FENBANG_DAE_COHORT.irrMonthly * 100).toFixed(3)}% 后同法得{" "}
            {pct(FENBANG_DAE_COHORT.irrExcelStyleAnn)}，与表内一致。复利年化 (1+r)
            ^12−1 ≈ {pct(FENBANG_DAE_COHORT.irrCompoundAnn)}，勿与 ×12
            口径混用。右侧回收图已改为净现金流堆叠，勿再与毛收入对照混读。
          </Callout>
          <FenbangDeployRecoverChart />
          <Table
            headers={[
              "月",
              "新投放台",
              "在管台",
              "采购投放 kUSD",
              "经营收入 kUSD",
              "当期净现金流 kUSD",
            ]}
            columnAlign={["left", "right", "right", "right", "right", "right"]}
            rows={FENBANG_DAE_COHORT.monthlyHead.map((r) => [
              r.labelZh,
              String(r.deploy),
              String(r.fleet),
              r.capexKUsd ? r.capexKUsd.toFixed(1) : "—",
              r.incomeKUsd.toFixed(1),
              r.cfKUsd.toFixed(1),
            ])}
            striped
          />

          <H3 style={TYPE.h3}>⑥ 已投资产整体汇总</H3>
          <Text size="small" tone="tertiary">
            「已投资」= 已支付（含投产前在途）+ 已投产。下表为全组合引擎汇总（含待支付订单按计划年入账的预测）。
          </Text>
          <Grid columns={GRID_STATS} gap={12}>
            <Stat
              label={`已投资额（${ccy}）`}
              value={moneyMxn(investedMxn, fx, ccy)}
              tone="neutral"
            />
            <Stat
              label={`自有资金投入（${unit}）`}
              value={m(model.equityOutlay)}
            />
            <Stat
              label="组合 IRR（含融资 / 全自有）"
              value={`${pct(model.cashIrr)} / ${pct(model.unleveredIrr)}`}
            />
            <Stat
              label={`资产经营毛利累计（${unit}）`}
              value={m(model.totals.contribution)}
            />
          </Grid>
          <Grid columns={GRID_STATS} gap={12}>
            <Stat
              label={`期末账面价值（${unit}）`}
              value={m(model.totals.endBook)}
            />
            <Stat
              label={`预测市场残值（${unit}）`}
              value={m(model.totals.endResidual)}
            />
            <Stat
              label={`累计净现金流（${unit}）`}
              value={m(model.totals.cashFlow)}
            />
          </Grid>

          <Table
            headers={[
              "预算年",
              "对应资产订单",
              `购置支出（${unit}）`,
              `当年净现金流（${unit}）`,
              `累计净现金流（${unit}）`,
              "在营规模",
            ]}
            columnAlign={["left", "left", "right", "right", "right", "right"]}
            rows={model.rows.map((r) => {
              const ods = activeOrders.filter(
                (o) =>
                  o.status !== "cancelled" &&
                  payDateToPlanYear(o.payDate) === r.year,
              );
              return [
                r.label,
                ods.length
                  ? ods.map((o) => `${o.label}（付款 ${o.payDate}）`).join("；")
                  : r.nodeLabels.length
                    ? r.nodeLabels.join("；")
                    : "无新投放",
                m(r.capex),
                m(r.cashFlow),
                m(r.cumulativeCF),
                `${r.daeOnline + r.ltoOnline}台车，${r.gunsOnline}把枪`,
              ];
            })}
            striped
          />

          <H3 style={TYPE.h3}>⑦ 管理人运营分配</H3>
          <Text size="small" tone="secondary">
            各资产包归属不同管理人。同资产下若某机构显著更弱（赚钱 / 出险 / 保值），在「运营分配」可对照并改挂。订单页也可改单笔归属。
          </Text>
          {mgrRows.length > 0 ? (
            <Table
              headers={[
                "管理人",
                "订单笔数",
                "已投产笔数",
                `在管金额（${ccy}）`,
                "金额占比",
              ]}
              columnAlign={["left", "right", "right", "right", "right"]}
              rows={mgrRows.map((r) => [
                r.nameZh,
                String(r.orders),
                String(r.live),
                moneyMxn(r.mxn, fx, ccy),
                createdMxn > 0 ? pct(r.mxn / createdMxn) : "—",
              ])}
              striped
            />
          ) : (
            <Text size="small" tone="tertiary">
              暂无在管订单。
            </Text>
          )}

          <Row gap={8} wrap>
            <Button variant="secondary" onClick={() => setTab("orders")}>
              打开订单页
            </Button>
            <Button variant="ghost" onClick={() => setTab("config")}>
              回货架
            </Button>
            <Button variant="ghost" onClick={() => setTab("invest")}>
              资产组合
            </Button>
            <Button variant="ghost" onClick={() => setTab("ops")}>
              运营分配
            </Button>
          </Row>
        </Stack>
        );
      })()}

      {(tab === "invest" || tab === "cashflow") && (
        <Stack gap={16}>
          <PageIntro
            title={pageMeta.invest!.title}
            description={pageMeta.invest!.description}
          />

          <Text size="small" tone="tertiary">
            订单内测算：台账打包批次 → 本批「单元现金流」与 SKU「单位现金流」同月路径引擎（各行叠加）→ ③ 全组合仍用年度 buildModel 叠加。测算前提与运营分配在主路径旁路。
          </Text>

          {/* ① 批次列表 */}
          <Stack gap={8}>
            <Text size="small" weight="medium">
              ① 订单批次（资产包）
            </Text>
            {(() => {
              const openOrders = activeOrders.filter(
                (o) => o.status !== "cancelled",
              );
              const listed = [
                ...openOrders.filter((o) => o.status === "paid"),
                ...openOrders.filter((o) => o.status === "pending_pay"),
              ];
              if (listed.length === 0) {
                return (
                  <Stack gap={8}>
                    <Text size="small" tone="tertiary">
                      尚无批次。请先到货架生成订单。
                    </Text>
                    <Row gap={8}>
                      <Button
                        variant="secondary"
                        onClick={() => setTab("config")}
                      >
                        去货架
                      </Button>
                      <Button variant="ghost" onClick={() => setTab("orders")}>
                        订单台账
                      </Button>
                    </Row>
                  </Stack>
                );
              }
              return (
                <Table
                  headers={[
                    "编号",
                    "状态",
                    "组成",
                    `含税（${ccy}）`,
                    "付款 / 投产",
                    "",
                  ]}
                  columnAlign={[
                    "left",
                    "left",
                    "left",
                    "right",
                    "left",
                    "right",
                  ]}
                  rows={listed.map((o) => {
                    const active = focusOrder?.id === o.id;
                    const comp = o.lines
                      .map((l) => `${l.nameZh}×${l.qty}`)
                      .join(" · ");
                    return [
                      <Text
                        key={`${o.id}-c`}
                        weight={active ? "semibold" : undefined}
                      >
                        {o.unitCode}
                      </Text>,
                      o.status === "paid" ? "已支付" : "待支付·可预览",
                      <Text key={`${o.id}-p`} size="small" tone="secondary">
                        {comp}
                      </Text>,
                      moneyMxn(orderTotalGrossMxn(o, p.vat), fx, ccy),
                      `${o.payDate || "—"} / ${o.goLiveDate || "—"}`,
                      <Button
                        key={`${o.id}-o`}
                        variant={active ? "primary" : "secondary"}
                        onClick={() => setOrderFocusId(o.id)}
                      >
                        {active ? "本批展开中" : "展开本批"}
                      </Button>,
                    ];
                  })}
                  striped
                />
              );
            })()}
          </Stack>

          {/* ② 本批 · 组合单元现金流（对齐单位现金流：月路径引擎 + 上指标下两列） */}
          {focusOrder &&
            focusOrder.status !== "cancelled" &&
            (() => {
              const orderCfGoLive = goLiveEffectiveStages(p);
              const orderUnitCf = buildOrderAggregatedUnitCf({
                order: focusOrder,
                p,
                cards,
                cfBySku,
                normalizedSkus,
                cfgConfigBySku,
                invAssume,
                invResidualInPath,
                invResidualMode,
                daeShift,
                goLiveStages: orderCfGoLive,
                focusLineId: orderCfLineId || undefined,
              });
              if (!orderUnitCf) return null;
              const {
                metrics,
                monthPath,
                primaryCtx,
                primaryLine,
                holdYears,
                residualMxn,
                sensRows,
                bars: orderBars,
              } = orderUnitCf;
              const {
                pathPbMo,
                pathDynamicPb,
                pathIrrAnn,
                pathNpvMxn,
                cumPathNet,
                initInv,
                totalReturnMxn,
                returnMultiple,
              } = metrics;
              const orderCfLineEffective =
                focusOrder.lines.find((l) => l.id === orderCfLineId)?.id ||
                primaryLine?.id ||
                focusOrder.lines[0]?.id ||
                "";
              const patchOrderLineCf = (patch: Partial<AssetCashflowConfig>) => {
                if (!primaryCtx) return;
                const sku = primaryCtx.sku;
                const base = normalizeCfConfig(
                  cfBySku[sku.id],
                  primaryCtx.mode,
                  primaryCtx.cfCardLive,
                  sku,
                );
                const next: AssetCashflowConfig = {
                  ...base,
                  ...patch,
                  assumptionsVer: CF_ASSUMPTIONS_VER,
                };
                if (patch.paymentFeePct != null) {
                  next.paymentFeePct = Math.max(0, Math.min(0.2, patch.paymentFeePct));
                }
                if (patch.platformTakePct != null) {
                  next.platformTakePct = Math.max(0, Math.min(0.6, patch.platformTakePct));
                }
                setCfBySku((prev) => ({ ...prev, [sku.id]: next }));
              };
              const daysMoOrder = primaryCtx
                ? opsDaysPerMonth(primaryCtx.cfCardLive.daysWeek || 6)
                : 26;
              const fleetInDay = primaryCtx?.cfDay.spvInflowMxn || 0;
              const companyMo = fleetInDay * daysMoOrder;
              const firstOpsBar = orderBars.find((b) =>
                b.label.startsWith("经营第"),
              );
              const financeDay =
                primaryCtx?.cfDay.slices?.find((s) => s.id === "investor_pi")
                  ?.amountMxn || 0;
              const financeMo = financeDay * daysMoOrder;
              const opexMoApprox = Math.max(
                0,
                (firstOpsBar?.outflowMxn || 0) - financeMo,
              );
              return (
                <Stack
                  gap={10}
                  style={mergeStyle({
                    padding: 14,
                    border: `1px solid ${theme.stroke.secondary}`,
                    background: theme.bg.elevated,
                  })}
                >
                  <Row gap={8} align="center" wrap>
                    <Text size="small" weight="medium">
                      ② 本批单元现金流 · {focusOrder.unitCode}
                    </Text>
                    <Pill size="sm" active={focusOrder.status === "paid"}>
                      {focusOrder.status === "paid" ? "已支付" : "待支付·草稿"}
                    </Pill>
                    <Text size="small" tone="tertiary">
                      上指标 · 下左假设 · 下右图 · 列内滚
                    </Text>
                    <Spacer />
                    <Button variant="ghost" onClick={() => setTab("orders")}>
                      改付款 / 投产
                    </Button>
                  </Row>
                  <Text size="small" tone="tertiary">
                    {focusOrder.lines
                      .map(
                        (l) =>
                          `${l.nameZh}×${l.qty}${l.unitLabel}（${orderModeZh(l.modeLabel)}）`,
                      )
                      .join(" · ")}{" "}
                    · 含税{" "}
                    {moneyMxn(orderTotalGrossMxn(focusOrder, p.vat), fx, ccy)} ·
                    各行单位月路径叠加（与 SKU「单位现金流」同引擎）
                  </Text>
                  <div
                    className="inv-ops-layout"
                    style={{
                      height: "min(72vh, 720px)",
                      minHeight: 420,
                      display: "flex",
                      flexDirection: "column",
                      gap: INV_PANE_GAP,
                      overflow: "hidden",
                    }}
                  >
                    <InvPaneTopStrip theme={theme}>
                      <Stack gap={6}>
                        <InvColTitle
                          title="核心输出"
                          hint="组合月路径 · 回本 · IRR · NPV · 敏感性"
                        />
                        <Grid columns={GRID_STATS} gap={8}>
                          <Stat
                            value={pathPbMo != null ? `M${pathPbMo}` : "未回本"}
                            label={
                              invResidualInPath
                                ? "路径静态回收期 · 含残值"
                                : "路径静态回收期"
                            }
                          />
                          <Stat
                            value={
                              pathDynamicPb.months != null
                                ? `M${pathDynamicPb.months}`
                                : "未回本"
                            }
                            label={`动态回收期 · ${pct(UNIT_CF_DISCOUNT_ANN, 0)}`}
                          />
                          <Stat
                            value={pct(pathIrrAnn)}
                            label={`${holdYears}年路径 IRR${invResidualInPath ? "·含残值" : ""}`}
                            tone={
                              pathIrrAnn != null && pathIrrAnn > 0.12
                                ? "success"
                                : pathIrrAnn != null && pathIrrAnn > 0
                                  ? "info"
                                  : undefined
                            }
                          />
                          <div
                            title={unitNpvTipZh({
                              annualRate: UNIT_CF_DISCOUNT_ANN,
                              pathMonths: metrics.pathNetsForMetrics.length,
                              opsYears: holdYears,
                            }).replace(/\n+/g, " · ")}
                            style={{ cursor: "help" }}
                          >
                            <Stat
                              value={
                                (pathNpvMxn >= 0 ? "+" : "") +
                                moneyMxn(pathNpvMxn, fx, ccy)
                              }
                              label={`NPV ${pct(UNIT_CF_DISCOUNT_ANN, 0)}${invResidualInPath ? "·含残值" : ""}`}
                              tone={
                                pathNpvMxn > 0
                                  ? "success"
                                  : pathNpvMxn < 0
                                    ? "warning"
                                    : undefined
                              }
                            />
                          </div>
                        </Grid>
                        <Row gap={10} wrap align="center">
                          <Text size="small">
                            期初 {moneyMxn(initInv, fx, ccy, 0)}
                          </Text>
                          <Text size="small">
                            路径累计 {moneyMxn(cumPathNet, fx, ccy, 0)}
                          </Text>
                          <Text size="small">
                            残值 {moneyMxn(residualMxn, fx, ccy, 0)}
                          </Text>
                          <Text size="small" weight="semibold">
                            总回报 {moneyMxn(totalReturnMxn, fx, ccy, 0)}
                            {returnMultiple != null
                              ? ` · ${fmt(returnMultiple, 2)}x`
                              : ""}
                          </Text>
                          {orderTrialModel ? (
                            <Text size="small" tone="tertiary">
                              对照 buildModel IRR{" "}
                              {pct(orderTrialModel.cashIrr)} /{" "}
                              {pct(orderTrialModel.unleveredIrr)}
                            </Text>
                          ) : null}
                        </Row>
                        <CollapsibleSection
                          title="敏感性（同引擎重算 · 主编辑行驱动）"
                          defaultOpen={false}
                          trailing={`${sensRows.length} 情景`}
                        >
                          <Table
                            headers={["情景", "路径回收", "IRR"]}
                            columnAlign={["left", "right", "right"]}
                            rows={sensRows.map((r) => [r.label, r.pb, r.irr])}
                            striped
                          />
                        </CollapsibleSection>
                      </Stack>
                    </InvPaneTopStrip>
                    <div
                      className="inv-ops-grid"
                      style={{
                        flex: 1,
                        minHeight: 0,
                        display: "grid",
                        gridTemplateColumns: INV_PANE_GRID_TWO,
                        gap: INV_PANE_GAP,
                        overflow: "hidden",
                      }}
                    >
                      <InvPaneScrollCol
                        theme={theme}
                        className="inv-ops-col inv-ops-col-assume"
                      >
                        <Stack gap={6}>
                          <InvColTitle
                            title="假设输入"
                            hint="批次情境 · 编辑行占池/收入 · 写入 SKU 配置"
                          />
                          <CollapsibleSection
                            title="批次情境"
                            defaultOpen
                            trailing={SCENARIO_OPTS.find((o) => o.id === focusOrder.scenario)?.label}
                          >
                            <Stack gap={8}>
                              <Row gap={6} wrap>
                                {SCENARIO_OPTS.map((opt) => (
                                  <Pill
                                    key={opt.id}
                                    size="sm"
                                    active={focusOrder.scenario === opt.id}
                                    onClick={() => {
                                      setInvAssume({});
                                      patchOrder(focusOrder.id, {
                                        scenario: opt.id,
                                      });
                                    }}
                                  >
                                    {opt.label}
                                  </Pill>
                                ))}
                              </Row>
                              <Grid columns={GRID_TIER_FIELDS} gap={6}>
                                <Select
                                  value={focusOrder.managerId}
                                  onChange={(v) =>
                                    patchOrder(focusOrder.id, { managerId: v })
                                  }
                                  options={enabledOperators.map((op) => ({
                                    value: op.id,
                                    label: `${op.nameZh} · ${op.hint}`,
                                  }))}
                                />
                                <Select
                                  value={focusOrder.country}
                                  onChange={(v) =>
                                    patchOrder(focusOrder.id, { country: v })
                                  }
                                  options={COUNTRY_OPTS.map((c) => ({
                                    value: c,
                                    label: c,
                                  }))}
                                />
                                <Select
                                  value={focusOrder.vertical}
                                  onChange={(v) =>
                                    patchOrder(focusOrder.id, { vertical: v })
                                  }
                                  options={VERTICAL_OPTS.map((c) => ({
                                    value: c,
                                    label: c,
                                  }))}
                                />
                              </Grid>
                            </Stack>
                          </CollapsibleSection>
                          <CollapsibleSection
                            title="编辑行"
                            defaultOpen
                            trailing={
                              primaryLine
                                ? `${primaryLine.nameZh}×${primaryLine.qty}`
                                : "—"
                            }
                          >
                            <Row gap={6} wrap>
                              {focusOrder.lines.map((l) => (
                                <Pill
                                  key={l.id}
                                  size="sm"
                                  active={orderCfLineEffective === l.id}
                                  onClick={() => setOrderCfLineId(l.id)}
                                >
                                  {l.nameZh}×{l.qty}
                                  {l.unitLabel}
                                </Pill>
                              ))}
                            </Row>
                            {primaryCtx ? (
                              <Text size="small" tone="tertiary">
                                瀑布示意与收入/占池手改作用于{" "}
                                {primaryCtx.sku.nameZh}（
                                {primaryCtx.mode}）；组合时序为各行叠加。
                              </Text>
                            ) : (
                              <Text size="small" tone="tertiary">
                                本批仅场站行：时序用场站月路径；占池/IPH 请选车辆行或至 SKU 页。
                              </Text>
                            )}
                          </CollapsibleSection>
                          {primaryCtx ? (
                            <>
                              <CollapsibleSection
                                title="收入假设"
                                defaultOpen
                                trailing={
                                  moneyMxn(companyMo, fx, ccy, 0) + "/月"
                                }
                              >
                                <Grid columns={GRID_TIER_FIELDS} gap={6}>
                                  <NumField
                                    compact
                                    label="IPH"
                                    value={primaryCtx.cfCardLive.iphMxn || 0}
                                    onChange={(n) =>
                                      patchInvAssume({ iphMxn: Math.max(0, n) })
                                    }
                                    hint={`${ccy}/h`}
                                  />
                                  <NumField
                                    compact
                                    label="利用率 %"
                                    value={(primaryCtx.cfCardLive.util || 0) * 100}
                                    onChange={(n) =>
                                      patchInvAssume({
                                        util: Math.max(0.05, Math.min(1, n / 100)),
                                      })
                                    }
                                  />
                                  <NumField
                                    compact
                                    label="日工时 h"
                                    value={primaryCtx.cfCardLive.hoursDay || 0}
                                    onChange={(n) =>
                                      patchInvAssume({
                                        hoursDay: Math.max(1, Math.min(16, n)),
                                      })
                                    }
                                  />
                                  <NumField
                                    compact
                                    label="周营运天"
                                    value={primaryCtx.cfCardLive.daysWeek || 6}
                                    onChange={(n) =>
                                      patchInvAssume({
                                        daysWeek: Math.max(
                                          1,
                                          Math.min(7, Math.round(n)),
                                        ),
                                      })
                                    }
                                  />
                                </Grid>
                              </CollapsibleSection>
                              <CollapsibleSection
                                title="占池分配"
                                defaultOpen={false}
                                trailing={`${Math.round((1 - (primaryCtx.cfCfgLive.paymentFeePct || 0)) * (1 - (primaryCtx.cfCfgLive.platformTakePct || 0)) * 1000) / 10}% 实收`}
                              >
                                <Grid columns={GRID_TIER_FIELDS} gap={6}>
                                  <NumField
                                    compact
                                    label="通道费 %"
                                    value={
                                      primaryCtx.cfCfgLive.paymentFeePct * 100
                                    }
                                    onChange={(n) =>
                                      patchOrderLineCf({
                                        paymentFeePct: Math.max(
                                          0,
                                          Math.min(0.2, n / 100),
                                        ),
                                      })
                                    }
                                  />
                                  <NumField
                                    compact
                                    label="平台抽成 %"
                                    value={
                                      primaryCtx.cfCfgLive.platformTakePct * 100
                                    }
                                    onChange={(n) =>
                                      patchOrderLineCf({
                                        platformTakePct: Math.max(
                                          0,
                                          Math.min(0.6, n / 100),
                                        ),
                                      })
                                    }
                                  />
                                </Grid>
                              </CollapsibleSection>
                            </>
                          ) : null}
                          <CollapsibleSection
                            title="支付方案"
                            trailing={`自有 ${pct(orderEquityPct(focusOrder.payPlan))}`}
                          >
                            <Stack gap={8}>
                              <Row gap={12} align="center" wrap>
                                <Text size="small">含债务融资</Text>
                                <Toggle
                                  checked={!!focusOrder.payPlan.includeDebt}
                                  onChange={(v) =>
                                    patchOrder(focusOrder.id, {
                                      payPlan: {
                                        ...focusOrder.payPlan,
                                        includeDebt: v,
                                      },
                                    })
                                  }
                                />
                              </Row>
                              {focusOrder.payPlan.includeDebt ? (
                                <Grid columns={GRID_TIER_FIELDS} gap={6}>
                                  <NumField
                                    compact
                                    label="借款比例"
                                    value={focusOrder.payPlan.debtPct}
                                    onChange={(n) =>
                                      patchOrder(focusOrder.id, {
                                        payPlan: {
                                          ...focusOrder.payPlan,
                                          debtPct: Math.max(0, Math.min(1, n)),
                                        },
                                      })
                                    }
                                  />
                                  <NumField
                                    compact
                                    label="借款利率"
                                    value={focusOrder.payPlan.debtRate}
                                    onChange={(n) =>
                                      patchOrder(focusOrder.id, {
                                        payPlan: {
                                          ...focusOrder.payPlan,
                                          debtRate: Math.max(0, n),
                                        },
                                      })
                                    }
                                  />
                                  <NumField
                                    compact
                                    label="借款年限"
                                    value={focusOrder.payPlan.debtYears}
                                    onChange={(n) =>
                                      patchOrder(focusOrder.id, {
                                        payPlan: {
                                          ...focusOrder.payPlan,
                                          debtYears: Math.max(1, Math.round(n)),
                                        },
                                      })
                                    }
                                  />
                                </Grid>
                              ) : null}
                              <Grid columns={GRID_STATS} gap={8}>
                                <Stat
                                  label={`含税购置（${ccy}）`}
                                  value={moneyMxn(
                                    orderTotalGrossMxn(focusOrder, p.vat),
                                    fx,
                                    ccy,
                                  )}
                                />
                                <Stat
                                  label={`自有资金（${ccy}）`}
                                  value={moneyMxn(
                                    orderEquityMxn(focusOrder, p.vat),
                                    fx,
                                    ccy,
                                  )}
                                />
                              </Grid>
                            </Stack>
                          </CollapsibleSection>
                          <CollapsibleSection title="路径展望" defaultOpen={false}>
                            <Grid columns={GRID_TIER_FIELDS} gap={6}>
                              <NumField
                                compact
                                label="持有期（年）"
                                value={holdYears}
                                onChange={(n) =>
                                  patchInvAssume({
                                    holdYears: Math.max(1, Math.min(10, Math.round(n))),
                                  })
                                }
                              />
                              <Row gap={8} align="center">
                                <Text size="small">残值并入末月</Text>
                                <Toggle
                                  checked={invResidualInPath}
                                  onChange={setInvResidualInPath}
                                />
                              </Row>
                            </Grid>
                          </CollapsibleSection>
                          {primaryCtx ? (
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setCfgFocusId(primaryCtx.sku.id);
                                setSkuDetailPane("ops");
                                setTab("config");
                              }}
                            >
                              打开 SKU 单位现金流（完整假设）
                            </Button>
                          ) : null}
                        </Stack>
                      </InvPaneScrollCol>
                      <InvPaneScrollCol
                        theme={theme}
                        tone="focus"
                        className="inv-ops-col inv-ops-col-focus"
                      >
                        <Stack gap={6}>
                          <InvColTitle
                            title="实时计算"
                            hint="组合月路径 · 主编辑行日瀑布"
                          />
                          <UnitCfTimelinePanel
                            compact
                            monthPath={monthPath}
                            ccy={ccy}
                            fx={fx}
                            unitCfGrain={unitCfGrain}
                            setUnitCfGrain={(g) => setUnitCfGrain(g)}
                            unitCfYearFocus={unitCfYearFocus}
                            setUnitCfYearFocus={(n) => setUnitCfYearFocus(n)}
                            unitCfAxisStart={unitCfAxisStart}
                            setUnitCfAxisStart={(n) => setUnitCfAxisStart(n)}
                          />
                          {primaryCtx ? (
                            <>
                              <Divider />
                              <Stack gap={4}>
                                <Row gap={6} wrap align="center">
                                  {(
                                    [
                                      { id: "day" as const, label: "按日" },
                                      { id: "month" as const, label: "按月" },
                                      { id: "year" as const, label: "按年" },
                                    ] as const
                                  ).map((g) => (
                                    <Pill
                                      key={g.id}
                                      size="sm"
                                      active={invWfGrain === g.id}
                                      onClick={() => setInvWfGrain(g.id)}
                                    >
                                      {g.label}
                                    </Pill>
                                  ))}
                                  <Text size="small" tone="tertiary">
                                    {primaryLine?.nameZh} 单日瀑布 · 组合时序已叠加
                                  </Text>
                                </Row>
                                {(() => {
                                  const scale =
                                    invWfGrain === "day"
                                      ? 1
                                      : invWfGrain === "month"
                                        ? daysMoOrder
                                        : daysMoOrder * 12;
                                  const grainLabel =
                                    invWfGrain === "day"
                                      ? "日"
                                      : invWfGrain === "month"
                                        ? `月（×${fmt(daysMoOrder, 1)} 营运日）`
                                        : `年（×${fmt(daysMoOrder * 12, 0)} 日）`;
                                  const steps = daySlicesToBridgeSteps(
                                    primaryCtx.cfDay.slices || [],
                                  ).map((s) => ({
                                    ...s,
                                    mxn: s.mxn * scale,
                                  }));
                                  const toDisp = (mxn: number) =>
                                    ccy === "MXN" ? mxn : mxn / fx;
                                  return (
                                    <CashflowWaterfallBridge
                                      compact
                                      steps={steps}
                                      toDisp={toDisp}
                                      ccy={ccy}
                                      grainLabel={grainLabel}
                                    />
                                  );
                                })()}
                              </Stack>
                              <CollapsibleSection title="关键公式" defaultOpen={false}>
                                <Callout tone="info" title="稳态示意（主编辑行）">
                                  <Stack gap={4}>
                                    <Text size="small">
                                      月毛利 ≈ 公司收入 − 运营成本 ≈{" "}
                                      {moneyMxn(companyMo, fx, ccy, 0)} −{" "}
                                      {moneyMxn(opexMoApprox, fx, ccy, 0)}
                                    </Text>
                                    <Text size="small">
                                      首月净额（组合叠加后见上图时序）≈{" "}
                                      {moneyMxn(
                                        firstOpsBar?.netMxn || 0,
                                        fx,
                                        ccy,
                                        0,
                                      )}
                                    </Text>
                                  </Stack>
                                </Callout>
                              </CollapsibleSection>
                            </>
                          ) : null}
                          <CollapsibleSection
                            title="组合月明细"
                            count={orderBars.length}
                            defaultOpen={false}
                          >
                            <Table
                              headers={[
                                "期次",
                                `流入（${ccy}）`,
                                `流出（${ccy}）`,
                                `净额（${ccy}）`,
                              ]}
                              columnAlign={["left", "right", "right", "right"]}
                              rows={orderBars.map((b) => [
                                b.label,
                                moneyMxn(b.opsInMxn + b.equityInMxn, fx, ccy, 0),
                                moneyMxn(b.outflowMxn, fx, ccy, 0),
                                moneyMxn(b.netMxn, fx, ccy, 0),
                              ])}
                              striped
                            />
                          </CollapsibleSection>
                        </Stack>
                      </InvPaneScrollCol>
                    </div>
                  </div>
                </Stack>
              );
            })()}

          {/* ③ 全组合叠加 */}
          <Stack
            gap={12}
            style={mergeStyle({
              padding: 14,
              border: `1px solid ${theme.stroke.secondary}`,
              background: theme.bg.elevated,
            })}
          >
            <Text size="small" weight="medium">
              ③ 全组合叠加（全部未取消订单）
            </Text>
            <Text size="small" tone="tertiary">
              各批次按付款年映射投放；单位路径 × 数量（含批量折扣）叠加为组合现金流与
              IRR。
            </Text>
            <Grid columns={GRID_STATS} gap={10}>
              <Stat
                label={`自有资金投入（${unit}）`}
                value={m(model.equityOutlay)}
              />
              <Stat
                label={`期末现金（${unit}）`}
                value={m(
                  model.rows[model.rows.length - 1]?.closingCash ?? 0,
                )}
              />
              <Stat
                label="组合 IRR（含融资 / 全自有）"
                value={`${pct(model.cashIrr)} / ${pct(model.unleveredIrr)}`}
                tone={
                  model.cashIrr != null && model.cashIrr > 0.12
                    ? "success"
                    : undefined
                }
              />
              <Stat
                label="在营（末年）"
                value={`${(model.rows[model.rows.length - 1]?.daeOnline ?? 0) + (model.rows[model.rows.length - 1]?.ltoOnline ?? 0)}台 · ${model.rows[model.rows.length - 1]?.gunsOnline ?? 0}枪`}
              />
            </Grid>
            <LineChart
              categories={model.rows.map((r) => r.label)}
              series={[
                {
                  name: "当期净现金流",
                  data: model.rows.map((r) => chartVal(r.cashFlow)),
                  tone: CHART_BW,
                },
                {
                  name: "累计净现金流",
                  data: model.rows.map((r) => chartVal(r.cumulativeCF)),
                  tone: CHART_BW,
                },
              ]}
              height={220}
              valueSuffix={` ${unit}`}
            />
            <CollapsibleSection
              title="年度投放一览"
              count={model.schedule.length}
            >
              <Table
                headers={["年", "场站", "DAE", "LTO", "RTO", "触发批次"]}
                columnAlign={[
                  "left",
                  "right",
                  "right",
                  "right",
                  "right",
                  "left",
                ]}
                rows={model.schedule.map((s) => [
                  `Y${s.year}`,
                  String(s.stationGuns),
                  String(s.daeUnits),
                  String(s.ltoUnits),
                  String(s.rtoUnits ?? 0),
                  s.labels.length ? s.labels.join("；") : "—",
                ])}
                striped
              />
            </CollapsibleSection>
            <CollapsibleSection title="资本配置（规模拆分）">
              <Table
                headers={[
                  "资产",
                  "规模",
                  `Capex（${unit}）`,
                  "融资比",
                  `债务（${unit}）`,
                  `权益（${unit}）`,
                ]}
                columnAlign={[
                  "left",
                  "right",
                  "right",
                  "right",
                  "right",
                  "right",
                ]}
                rows={[
                  ...model.capitalPlan.lines.map((l) => [
                    l.nameZh,
                    l.key === "station" ? `${l.units}枪` : `${l.units}台`,
                    m(l.totalCapex),
                    model.capitalPlan.includeDebt ? pct(l.financePct) : "0%",
                    m(l.debt),
                    m(l.equity),
                  ]),
                  [
                    "合计",
                    "—",
                    m(model.capitalPlan.totalCapex),
                    "—",
                    m(model.capitalPlan.totalDebt),
                    m(model.capitalPlan.totalEquity),
                  ],
                ]}
                striped
              />
            </CollapsibleSection>
            <CollapsibleSection
              title="全组合明细表"
              count={model.rows.length}
              trailing={
                <Text size="small" tone="tertiary">
                  年
                </Text>
              }
            >
              <Table
                headers={cfHeaders}
                columnAlign={[
                  "left",
                  ...model.rows.map(() => "right" as const),
                  "right",
                ]}
                rows={cfForecastRows}
                striped
                stickyHeader
              />
            </CollapsibleSection>
            <CollapsibleSection
              title="④ 组合投残汇总"
              count={model.assets.filter((a) => a.totalCostUsd > 0).length}
              trailing={
                <Text size="small" tone="tertiary">
                  单 SKU 详表见商详「资产估值·残值」
                </Text>
              }
            >
              <Stack gap={12}>
                <Row gap={8} align="center" wrap>
                  <Text size="small" tone="secondary">
                    残值时点模式（与 IRR 期末一致）
                  </Text>
                  <Select
                    value={p.residualMode}
                    onChange={(v) => update("residualMode", v as ResidualMode)}
                    options={[
                      { value: "accounting", label: "会计年限" },
                      { value: "physical", label: "物理年限" },
                      { value: "maintenance", label: "维保 / 质保年限" },
                    ]}
                  />
                  <Button
                    variant="ghost"
                    onClick={() => {
                      const first =
                        normalizedSkus.find((s) => s.kind === "vehicle") ||
                        normalizedSkus[0];
                      if (first) openSkuDetail(first.id, "valuation");
                    }}
                  >
                    打开商详 · 资产估值
                  </Button>
                </Row>
                <Table
                  headers={[
                    "资产单元",
                    `投放购置·时点0（${unit}）`,
                    "期末寿命",
                    "残值率",
                    `期末残值（${unit}）`,
                    `年折旧（${unit}）`,
                  ]}
                  columnAlign={[
                    "left",
                    "right",
                    "right",
                    "right",
                    "right",
                    "right",
                  ]}
                  rows={model.assets.map((a) => [
                    a.name,
                    m(a.totalCostUsd),
                    `${a.activeLife}年（${
                      p.residualMode === "physical"
                        ? "物理"
                        : p.residualMode === "maintenance"
                          ? "维保"
                          : "会计"
                    }）`,
                    pct(a.residualRate),
                    m(a.residualUsd),
                    m((a.totalCostUsd * (1 - a.residualRate)) / a.activeLife),
                  ])}
                  striped
                />
                <BarChart
                  categories={model.assets.map((a) => {
                    const short = a.name.replace(/（.*）/, "");
                    if (a.totalCostUsd <= 0) return `${short}（无投放）`;
                    return `${short} · 0→Y${a.activeLife}`;
                  })}
                  series={[
                    {
                      name: "投放购置（时点0）",
                      data: model.assets.map((a) => Math.round(a.totalCostUsd)),
                      tone: CHART_BW,
                    },
                    {
                      name: (() => {
                        const modeZh =
                          p.residualMode === "physical"
                            ? "物理"
                            : p.residualMode === "maintenance"
                              ? "维保"
                              : "会计";
                        return `期末残值（${modeZh}终点）`;
                      })(),
                      data: model.assets.map((a) => Math.round(a.residualUsd)),
                      tone: CHART_BW,
                    },
                  ]}
                  height={220}
                />
                <Text size="small" tone="tertiary">
                  寿命口径、Libro Azul、中国市场曲线在各 SKU 商详「资产估值·残值」一体查看。
                </Text>
              </Stack>
            </CollapsibleSection>
            <Row gap={8} wrap>
              <Button variant="ghost" onClick={() => setTab("orders")}>
                ← 订单台账
              </Button>
              <Button variant="ghost" onClick={() => setTab("overview")}>
                总览
              </Button>
              <Button variant="ghost" onClick={() => setTab("ops")}>
                车运营 · 身份补录
              </Button>
            </Row>
          </Stack>
        </Stack>
      )}

      {tab === "params" && (() => {
        const mgmt = p.mgmtCapability ?? 0.7;
        const ready = p.resourceReadiness ?? 0.75;
        const sc = (p.cashflowScenario ?? "base") as CashflowScenario;
        const demoRampY = 2;
        const effRamp = Math.max(1, demoRampY * (1.35 - 0.5 * mgmt));
        const y1Load = rampLoadAtAge(
          1,
          demoRampY,
          p.stationRampStartLoad ?? 0.5,
          mgmt,
        );
        const band = p.stationUncertaintyBand ?? 0.1;
        const amp = Math.max(0, band) * (1.25 - 0.5 * ready);
        const downF = scenarioFactorOf(band, ready, "down");
        const upF = scenarioFactorOf(band, ready, "up");
        const scF = scenarioFactorOf(band, ready, sc);
        const liveStages = goLiveEffectiveStages(p);
        const liveDays = goLiveTotalDays(liveStages);
        const liveIdle = goLiveIdleMonths(liveDays);
        const rawLive = goLiveRawDays(p);
        const liveStageDays = (id: GoLiveStageId) =>
          liveStages.find((s) => s.id === id)?.days ?? 0;
        const liveStageEffect = (id: GoLiveStageId) => {
          const d = liveStageDays(id);
          return d > 0 ? `有效 ${d} 天` : "当前路径已跳过";
        };
        return (
        <Stack gap={20}>
          <PageIntro
            title={pageMeta.params!.title}
            description={pageMeta.params!.description}
          />

          {(() => {
            const daeCard =
              cards.map(normalizeCard).find((c) => c.id === "aion-es-dae") ||
              cards.map(normalizeCard).find((c) => c.mode === "DAE") ||
              DEFAULT_VEHICLE_CARDS[0]!;
            const ltoCard =
              cards.map(normalizeCard).find((c) => c.id === "aion-ut-lto") ||
              cards.map(normalizeCard).find((c) => c.mode === "LTO");
            const stSku =
              normalizedSkus.find((s) => s.id === "station-medium") ||
              normalizedSkus.find((s) => s.kind === "station");
            const daeProfile = findOpsProfile(
              "墨西哥",
              "网约车·专车",
              "DAE",
              "fenbang",
            );
            const ltoProfile = findOpsProfile(
              "墨西哥",
              "网约车·快车",
              "LTO",
              "fenbang",
            );
            const auditAll = buildAssumptionAudit({
              daeCard,
              ltoCard,
              stationSku: stSku,
              daeProfile,
              ltoProfile,
              scenario: sc,
            });
            const audit =
              assumptionPackFocus === "all"
                ? auditAll
                : auditAll.filter((r) => r.packId === assumptionPackFocus);
            const auditView =
              assumptionNatureFocus === "all"
                ? audit
                : audit.filter((r) => r.nature === assumptionNatureFocus);
            const okN = auditView.filter((r) => r.status === "对齐").length;
            const badN = auditView.filter((r) => r.status === "偏离").length;
            const pendN = auditView.filter((r) => r.status === "待案例表").length;
            return (
              <Stack
                gap={10}
                style={mergeStyle({
                  padding: 14,
                  border: `1px solid ${theme.stroke.secondary}`,
                  background: theme.bg.elevated,
                })}
              >
                <Text size="small" weight="medium">
                  常量性质 · 案例表校验
                </Text>
                <Text size="small" tone="tertiary">
                  先分清常量从哪来：商务政策谁拍板、运营指标怎么验收、出厂属性合同锁死、司机用工看当地行情。再按假设包
                  / 情景对照 Excel。
                </Text>
                <Table
                  headers={["性质", "含义"]}
                  columnAlign={["left", "left"]}
                  rows={(
                    Object.keys(CONST_NATURE_META) as ConstNatureId[]
                  ).map((id) => [
                    CONST_NATURE_META[id].labelZh,
                    CONST_NATURE_META[id].hintZh,
                  ])}
                  striped
                />
                <Row gap={6} wrap>
                  <Text size="small" tone="secondary">
                    性质
                  </Text>
                  <Pill
                    size="sm"
                    active={assumptionNatureFocus === "all"}
                    onClick={() => setAssumptionNatureFocus("all")}
                  >
                    全部性质
                  </Pill>
                  {(Object.keys(CONST_NATURE_META) as ConstNatureId[]).map(
                    (id) => (
                      <Pill
                        key={id}
                        size="sm"
                        active={assumptionNatureFocus === id}
                        onClick={() => setAssumptionNatureFocus(id)}
                      >
                        {CONST_NATURE_META[id].labelZh}
                      </Pill>
                    ),
                  )}
                </Row>
                <Row gap={6} wrap>
                  <Text size="small" tone="secondary">
                    假设包
                  </Text>
                  {(
                    [
                      { id: "dae-es-zhuanche" as const, label: "DAE·ES·专车" },
                      { id: "station-mid" as const, label: "充电桩·中型" },
                      { id: "lto-ut-kuaiche" as const, label: "LTO·UT·快车" },
                      { id: "all" as const, label: "全部包" },
                    ] as const
                  ).map((opt) => (
                    <Pill
                      key={opt.id}
                      size="sm"
                      active={assumptionPackFocus === opt.id}
                      onClick={() => setAssumptionPackFocus(opt.id)}
                    >
                      {opt.label}
                    </Pill>
                  ))}
                </Row>
                <Grid columns={GRID_STATS} gap={10}>
                  <Stat label="对齐" value={`${okN}`} tone="success" />
                  <Stat
                    label="偏离"
                    value={`${badN}`}
                    tone={badN > 0 ? "danger" : undefined}
                  />
                  <Stat label="待案例表" value={`${pendN}`} tone="warning" />
                </Grid>
                <Table
                  headers={[
                    "性质",
                    "假设包",
                    "指标",
                    "Excel/情景包",
                    "画布",
                    "状态",
                  ]}
                  columnAlign={[
                    "left",
                    "left",
                    "left",
                    "right",
                    "right",
                    "left",
                  ]}
                  rows={auditView.map((r) => [
                    r.natureZh,
                    `${r.packZh}`,
                    r.metricZh,
                    r.excelZh,
                    r.canvasZh,
                    r.status,
                  ])}
                  striped
                />
                <Row gap={8} wrap>
                  <Button
                    variant="ghost"
                    onClick={() => openSourceCite("fenbang-dae-xlsx")}
                  >
                    DAE 信源
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => openSourceCite("fenbang-station-xlsx")}
                  >
                    充电桩信源
                  </Button>
                  <Text size="small" tone="tertiary">
                    版本 {CF_ASSUMPTIONS_VER} · 当前情景{" "}
                    {SCENARIO_LABEL_ZH[sc]}
                  </Text>
                </Row>

                <Divider />
                <Text size="small" weight="medium">
                  经营剖面矩阵（国家×业态×模式×运营商）
                </Text>
                <Table
                  headers={[
                    "剖面",
                    "利用/出租",
                    "IPH或租金",
                    "司机/坏账",
                    "信源口径",
                  ]}
                  columnAlign={["left", "right", "right", "right", "left"]}
                  rows={OPS_PROFILES.map((pr) => [
                    pr.key,
                    pr.mode === "DAE"
                      ? pct(pr.util)
                      : pct(pr.occupancy),
                    pr.mode === "DAE"
                      ? `${pr.iphMxn} IPH`
                      : `${pr.rentMonthMxn} 租`,
                    pr.mode === "DAE"
                      ? String(pr.driverMxn)
                      : pct(pr.badDebt),
                    pr.note,
                  ])}
                  striped
                />
              </Stack>
            );
          })()}

          <Text size="small" tone="tertiary">
            两套时间：① 单车「今天付款 → 何时上路出收入」；② 车队「上路后多久爬到稳态」。先看①。
          </Text>

          {(() => {
            const activeBatch =
              batchTracks.find((b) => b.id === batchTrackId) ??
              batchTracks[0]!;
            const patchBatch = (patch: Partial<InvestedBatchTrack>) => {
              setBatchTracks((prev) =>
                prev.map((b) =>
                  b.id === activeBatch.id ? { ...b, ...patch } : b,
                ),
              );
            };
            const axisPos = goLiveAxisPosition(
              liveStages,
              activeBatch.dayCursor,
            );
            return (
              <Stack
                gap={12}
                style={mergeStyle({
                  padding: 12,
                  border: `1px solid ${theme.stroke.secondary}`,
                  background: theme.bg.elevated,
                })}
              >
                <GoLiveTimelineAxis
                  stages={liveStages}
                  cursorDay={activeBatch.dayCursor}
                  onCursorDay={(d) => patchBatch({ dayCursor: d })}
                  showCursor
                />

                <Divider />

                <Stack gap={8}>
                  <Text size="small" weight="medium">
                    已投资批次 · 日跟踪（示意）
                  </Text>
                  <Text size="small" tone="tertiary">
                    实盘时：购车付款批次按本横轴推进；每日更新游标并采集当段字段（身份 +
                    滴滴状态）。以下为示意批次，可拖游标演练。
                  </Text>
                  <Select
                    value={activeBatch.id}
                    onChange={(v) => setBatchTrackId(v)}
                    options={batchTracks.map((b) => ({
                      value: b.id,
                      label: `${b.label} · ${b.qty}台 · 付款 ${b.payDate}`,
                    }))}
                  />
                  <Grid columns={GRID_STATS} gap={10}>
                    <Stat label="付款日" value={activeBatch.payDate} />
                    <Stat
                      label="台数"
                      value={String(activeBatch.qty)}
                    />
                    <Stat
                      label="当前阶段"
                      value={axisPos.nameZh}
                      tone="neutral"
                    />
                  </Grid>
                  <Table
                    headers={["采集项", "状态"]}
                    columnAlign={["left", "left"]}
                    rows={axisPos.collectZh.map((c) => [
                      c,
                      "待采 / 日更",
                    ])}
                    striped
                  />
                  {activeBatch.noteZh && (
                    <Text size="small" tone="tertiary">
                      {activeBatch.noteZh}
                    </Text>
                  )}
                  <Row gap={8} wrap>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        patchBatch({
                          dayCursor: Math.min(
                            liveDays,
                            activeBatch.dayCursor + 1,
                          ),
                        })
                      }
                    >
                      模拟推进 +1 日
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => patchBatch({ dayCursor: 0 })}
                    >
                      回到付款日
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setTab("ops")}
                    >
                      打开车运营漏斗
                    </Button>
                  </Row>
                </Stack>
              </Stack>
            );
          })()}

          <Stack
            gap={10}
            style={mergeStyle({
              padding: 12,
              border: `1px solid ${theme.stroke.tertiary}`,
              background: theme.fill.tertiary,
            })}
          >
            <Text size="small" weight="medium">
              付款购置 → 投产出收入
            </Text>
            <Grid columns={GRID_STATS} gap={10}>
              <Stat
                label="有效总天数"
                value={`${liveDays} 天`}
                tone="neutral"
              />
              <Stat
                label="约合空窗"
                value={`${liveIdle} 个月`}
              />
              <Stat
                label="首笔收入时点"
                value={`空窗结束后·经营1`}
              />
            </Grid>
            <Text size="small" tone="secondary">
              访谈默认：本地库存车 — 付款 → 整备/上牌 → 上路（无海运、无报关清关）；空窗最长约 1
              个月。若改为进口链路，可在下方把海运/清关天数调回非零。
            </Text>
            <Table
              headers={["阶段", "有效天", "设定天", "含义"]}
              columnAlign={["left", "right", "right", "left"]}
              rows={liveStages.map((s) => [
                s.nameZh,
                String(s.days),
                String(rawLive[s.id]),
                s.whyZh,
              ])}
              striped
            />
          </Stack>

          <H3 style={TYPE.h3}>上路周期刻度（设定天）</H3>
          <Grid columns={GRID_FORM} gap={12}>
            <ScaleField
              label="海运/在途"
              value={rawLive.ocean}
              onChange={(n) => update("goLiveOceanDays", Math.round(n))}
              min={10}
              max={90}
              step={1}
              display={`${Math.round(rawLive.ocean)} 天`}
              why="出厂到墨港。船期主导，管理能力几乎压不动。"
              effect={liveStageEffect("ocean")}
              ticks={[
                { value: 25, label: "25" },
                { value: 35, label: "35" },
                { value: 50, label: "50" },
                { value: 70, label: "70" },
              ]}
            />
            <ScaleField
              label="报关清关"
              value={rawLive.customs}
              onChange={(n) => update("goLiveCustomsDays", Math.round(n))}
              min={3}
              max={45}
              step={1}
              display={`${Math.round(rawLive.customs)} 天`}
              why="报关、完税、放行。材料齐套 + 管理可略缩短。"
              effect={liveStageEffect("customs")}
              ticks={[
                { value: 7, label: "7" },
                { value: 14, label: "14" },
                { value: 21, label: "21" },
                { value: 30, label: "30" },
              ]}
            />
            <ScaleField
              label="整备/上牌"
              value={rawLive.pdi}
              onChange={(n) => update("goLivePdiDays", Math.round(n))}
              min={2}
              max={40}
              step={1}
              display={`${Math.round(rawLive.pdi)} 天`}
              why="PDI、上牌、GPS、入库整备。管理越强越短。"
              effect={liveStageEffect("pdi")}
              ticks={[
                { value: 5, label: "5" },
                { value: 10, label: "10" },
                { value: 15, label: "15" },
                { value: 25, label: "25" },
              ]}
            />
            <ScaleField
              label="匹配司机/上架"
              value={rawLive.match}
              onChange={(n) => update("goLiveMatchDays", Math.round(n))}
              min={2}
              max={60}
              step={1}
              display={`${Math.round(rawLive.match)} 天`}
              why="找司机或承租人、平台审核。管理+资源越足越短。"
              effect={liveStageEffect("match")}
              ticks={[
                { value: 7, label: "7" },
                { value: 14, label: "14" },
                { value: 28, label: "28" },
                { value: 45, label: "45" },
              ]}
            />
          </Grid>

          <Stack
            gap={8}
            style={mergeStyle({
              padding: 12,
              border: `1px solid ${theme.stroke.tertiary}`,
              background: theme.bg.elevated,
            })}
          >
            <Text size="small" weight="medium">
              组合爬坡读数（上路之后）
            </Text>
            <Grid columns={GRID_STATS} gap={10}>
              <Stat
                label="有效达产年数"
                value={`${effRamp.toFixed(1)} 年`}
              />
              <Stat
                label="首年负荷"
                value={pct(y1Load)}
              />
              <Stat
                label="情景系数"
                value={
                  sc === "base"
                    ? "1.00×（中性）"
                    : `${scF.toFixed(2)}×`
                }
              />
            </Grid>
            <Text size="small" tone="secondary">
              车已上路后，车队从部分负荷爬到稳态。管理能力 {capabilityBand(mgmt)}{" "}
              → 爬坡缩短；资源 {readinessBand(ready)} → 振幅 ±{pct(amp)}。
            </Text>
          </Stack>

          <H3 style={TYPE.h3}>经营能力</H3>
          <Grid columns={GRID_FORM} gap={12}>
            <ScaleField
              label="管理能力"
              value={mgmt}
              onChange={(n) => update("mgmtCapability", n)}
              min={0}
              max={1}
              step={0.05}
              display={`${mgmt.toFixed(2)} · ${capabilityBand(mgmt)}`}
              why="谁在管、经营节奏能否压实。缩短清关后段/整备/匹配，并加快上路后爬坡。"
              effect={`上路周期有效 ${liveDays} 天 · 组合爬坡约 ${effRamp.toFixed(1)} 年 · 首年负荷 ${pct(y1Load)}`}
              ticks={[
                { value: 0.3, label: "偏弱" },
                { value: 0.5, label: "一般" },
                { value: 0.7, label: "中上" },
                { value: 0.85, label: "较强" },
                { value: 1, label: "很强" },
              ]}
            />
            <ScaleField
              label="资源到位"
              value={ready}
              onChange={(n) => update("resourceReadiness", n)}
              min={0}
              max={1}
              step={0.05}
              display={`${ready.toFixed(2)} · ${readinessBand(ready)}`}
              why="司机 / 运维 / 桩位等配套。压缩匹配司机天数，并减小上下行振幅。"
              effect={`${liveStageEffect("match")} · 振幅 ±${pct(amp)}`}
              ticks={[
                { value: 0.35, label: "不足" },
                { value: 0.55, label: "部分" },
                { value: 0.75, label: "齐备" },
                { value: 0.95, label: "充分" },
              ]}
            />
          </Grid>

          <Stack gap={8}>
            <Text size="small" weight="medium">
              现金流情景
            </Text>
            <Text size="small" tone="tertiary">
              保守 / 中性 / 激进各有一套分项常量（中性对齐 Excel「1.1假设」）；不再用单一倍率。
            </Text>
            <Row gap={6} wrap>
              {SCENARIO_OPTS.map((opt) => (
                <Pill
                  key={opt.id}
                  active={sc === opt.id}
                  onClick={() => update("cashflowScenario", opt.id)}
                >
                  {opt.label}
                  {opt.id === "base" ? " · 对齐案例表" : opt.id === "down" ? " · 压力" : " · 上行"}
                </Pill>
              ))}
            </Row>
            {(() => {
              const k = DAE_SCENARIO_KNOBS[sc];
              const st = STATION_SCENARIO_KNOBS[sc];
              return (
                <Table
                  headers={["科目", "DAE·ES", "充电桩·中型"]}
                  columnAlign={["left", "right", "right"]}
                  rows={[
                    ["利用率 / 外用利用", pct(k.util), pct(st.externalUtil)],
                    ["IPH / 内用利用", `${k.iphMxn}`, pct(st.internalUtil)],
                    ["司机单人 / 场租", `${k.driverMxn}`, `${st.rentMonthMxn}`],
                    ["电价 / 电成本", `${k.elecMxn}`, `${st.elecCostMxn}`],
                    ["保险年 / 运维包", `${k.insuranceYrMxn}`, `${st.opexMonthMxn}`],
                  ]}
                  striped
                />
              );
            })()}
          </Stack>

          <H3 style={TYPE.h3}>组合爬坡刻度（上路之后）</H3>
          <Grid columns={GRID_STATS} gap={12}>
            <ScaleField
              label="场站达产年数"
              value={p.stationRampYears ?? 2}
              onChange={(n) => update("stationRampYears", Math.round(n))}
              min={1}
              max={5}
              step={1}
              display={`${Math.round(p.stationRampYears ?? 2)} 年`}
              why="场站从投放爬到稳态吞吐所需年数（固有）。"
              effect={`管理能力调节后有效约 ${(Math.max(1, (p.stationRampYears ?? 2) * (1.35 - 0.5 * mgmt))).toFixed(1)} 年`}
              ticks={[
                { value: 1, label: "1年" },
                { value: 2, label: "2年" },
                { value: 3, label: "3年" },
                { value: 4, label: "4年" },
                { value: 5, label: "5年" },
              ]}
            />
            <ScaleField
              label="场站首年负荷"
              value={p.stationRampStartLoad ?? 0.5}
              onChange={(n) => update("stationRampStartLoad", n)}
              min={0.1}
              max={1}
              step={0.05}
              display={pct(p.stationRampStartLoad ?? 0.5)}
              why="投放首年相对稳态的利用率起点。"
              effect={`与管理能力叠加后示意首年 ${pct(y1Load)}`}
              ticks={[
                { value: 0.3, label: "30%" },
                { value: 0.5, label: "50%" },
                { value: 0.7, label: "70%" },
                { value: 1, label: "满产" },
              ]}
            />
            <ScaleField
              label="场站不确定性"
              value={p.stationUncertaintyBand ?? 0.1}
              onChange={(n) => update("stationUncertaintyBand", n)}
              min={0}
              max={0.4}
              step={0.02}
              display={`±${pct(p.stationUncertaintyBand ?? 0.1)}`}
              why="场站收入固有波动带宽；再乘资源缺口放大。"
              effect={`有效振幅约 ±${pct(amp)}（含资源调节）`}
              ticks={[
                { value: 0.05, label: "低" },
                { value: 0.1, label: "中" },
                { value: 0.2, label: "高" },
                { value: 0.3, label: "很高" },
              ]}
            />
          </Grid>

          <Divider />
          <H3 style={TYPE.h3}>宏观与税</H3>
          <Grid columns={GRID_FORM} gap={12}>
            <ScaleField
              label="增值税 IVA"
              value={p.vat}
              onChange={(n) => update("vat", n)}
              min={0}
              max={0.16}
              step={0.01}
              display={pct(p.vat)}
              why="墨西哥联邦 LIVA 一般税率 16%；进口同率。场站等未税 SKU 购物车另加 IVA；对齐案例表的车辆购入价已是含税现金，不再加税（可反拆估列）。北部边境刺激 8% 未默认启用。"
              effect={`含税系数 ${(1 + p.vat).toFixed(2)}×；含税列载车型按案例价入账；押金不计税`}
              ticks={[
                { value: 0, label: "0%" },
                { value: 0.08, label: "8%边" },
                { value: 0.16, label: "16%" },
              ]}
            />
            <ScaleField
              label="企业所得税"
              value={p.cit}
              onChange={(n) => update("cit", n)}
              min={0}
              max={0.4}
              step={0.01}
              display={pct(p.cit)}
              why="墨西哥联邦 CIT 常用 30%；影响税后净利与杠杆现金流。"
              effect={`税后留存约 ${pct(1 - p.cit)}（忽略其他税基调整）`}
              ticks={[
                { value: 0.2, label: "20%" },
                { value: 0.3, label: "30%" },
                { value: 0.35, label: "35%" },
              ]}
            />
          </Grid>
          <Grid columns={GRID_FORM} gap={12}>
            <ScaleField
              label="测算年数"
              value={p.years}
              onChange={(n) => update("years", Math.round(n))}
              min={3}
              max={12}
              step={1}
              display={`${Math.round(p.years)} 年`}
              why="组合现金流与 IRR 展望期。"
              effect={`共 ${Math.round(p.years)} 个年度桶；残值在期末回收`}
              ticks={[
                { value: 5, label: "5年" },
                { value: 7, label: "7年" },
                { value: 10, label: "10年" },
                { value: 12, label: "12年" },
              ]}
            />
            <Stack gap={4} />
          </Grid>
          <Grid columns={GRID_FORM} gap={12}>
            <NumField
              label="USD/MXN"
              value={p.usdMxn}
              onChange={(n) => update("usdMxn", n)}
              hint="顶栏展示币种折算"
            />
            <NumField
              label="CNY/MXN"
              value={p.cnyMxn}
              onChange={(n) => update("cnyMxn", n)}
              hint="人民币对照"
            />
          </Grid>
          <Row gap={12} align="center" wrap>
            <Text size="small">计入总部管理费</Text>
            <Toggle
              checked={!!p.includeHq}
              onChange={(v) => update("includeHq", v)}
            />
            <Text size="small" tone="tertiary">
              {p.includeHq
                ? `已计入 · 累计 ${m(model.totals.hqAlloc)}`
                : "未计入（单体报表口径）"}
            </Text>
            <Spacer />
            <Text size="small" tone="secondary">
              残值时点
            </Text>
            <Select
              value={p.residualMode}
              onChange={(v) => update("residualMode", v as ResidualMode)}
              options={[
                { value: "accounting", label: "会计年限" },
                { value: "physical", label: "物理年限" },
                { value: "maintenance", label: "维保年限" },
              ]}
            />
          </Row>
          {p.includeHq && (
            <Grid columns={GRID_FORM} gap={12}>
              <NumField
                label="总部管理费（月）"
                value={p.hqMonthMxn ?? 640891}
                onChange={(n) => update("hqMonthMxn", n)}
                mxnFx={fx}
                displayCcy={ccy}
                hint="原表约 640,891 MXN/月"
              />
              <ScaleField
                label="稳定期总部分摊比例"
                value={p.hqSteadyPct ?? 0.25}
                onChange={(n) => update("hqSteadyPct", n)}
                min={0}
                max={1}
                step={0.05}
                display={pct(p.hqSteadyPct ?? 0.25)}
                why="Y1 按 100%；Y2 起用此比例（对齐原表约 25%）。"
                effect={`稳定期月费约按 ${pct(p.hqSteadyPct ?? 0.25)} 计入`}
                ticks={[
                  { value: 0.15, label: "15%" },
                  { value: 0.25, label: "25%" },
                  { value: 0.5, label: "50%" },
                  { value: 1, label: "100%" },
                ]}
              />
            </Grid>
          )}

          <Divider />
          <H3 style={TYPE.h3}>场站运营强度</H3>
          <Grid columns={GRID_FORM} gap={12}>
            <ScaleField
              label="外部利用率"
              value={p.externalUtil}
              onChange={(n) => update("externalUtil", n)}
              min={0}
              max={0.5}
              step={0.01}
              display={pct(p.externalUtil)}
              why="对外充电占用枪时比例；原表约 10%。"
              effect="抬高对外充电收入与购电成本"
              ticks={[
                { value: 0.05, label: "5%" },
                { value: 0.1, label: "10%" },
                { value: 0.2, label: "20%" },
                { value: 0.3, label: "30%" },
              ]}
            />
            <ScaleField
              label="内部利用率"
              value={p.internalUtil}
              onChange={(n) => update("internalUtil", n)}
              min={0}
              max={0.6}
              step={0.01}
              display={pct(p.internalUtil)}
              why="车队对内充电占用；原表约 20%。关联交易开启时会与车队电耗校准。"
              effect="影响内部充电规模与合并抵消"
              ticks={[
                { value: 0.1, label: "10%" },
                { value: 0.2, label: "20%" },
                { value: 0.35, label: "35%" },
                { value: 0.5, label: "50%" },
              ]}
            />
            <ScaleField
              label="场站残值率"
              value={p.chargerResidualRate}
              onChange={(n) => update("chargerResidualRate", n)}
              min={0}
              max={0.3}
              step={0.01}
              display={pct(p.chargerResidualRate)}
              why="会计/物理/维保时点期末残值占成本比例（测算参数；墨市拟对 Libro Azul）。"
              effect="抬高期末残值回收，降低年折旧"
              ticks={[
                { value: 0.05, label: "5%" },
                { value: 0.1, label: "10%" },
                { value: 0.15, label: "15%" },
              ]}
            />
            <ScaleField
              label="单枪功率"
              value={p.powerKw}
              onChange={(n) => update("powerKw", Math.round(n))}
              min={30}
              max={180}
              step={10}
              display={`${Math.round(p.powerKw)} kW`}
              why="影响单枪月度可供电量上限。"
              effect={`枪数 ${p.chargerGuns} · 功率 ${Math.round(p.powerKw)} kW`}
              ticks={[
                { value: 60, label: "60" },
                { value: 90, label: "90" },
                { value: 120, label: "120" },
                { value: 150, label: "150" },
              ]}
            />
          </Grid>

          <Row gap={8} align="center">
            <Text size="small" weight="medium">
              场站金额与寿命
            </Text>
            <Spacer />
            <Pill
              active={paramsMoneyOpen}
              onClick={() => setParamsMoneyOpen(!paramsMoneyOpen)}
            >
              {paramsMoneyOpen ? "收起精确输入" : "展开精确输入"}
            </Pill>
          </Row>
          {paramsMoneyOpen && (
            <Grid columns={GRID_STATS} gap={12}>
              <NumField
                label="充电枪数"
                value={p.chargerGuns}
                onChange={(n) => update("chargerGuns", n)}
              />
              <NumField
                label="外部电价 /kWh"
                value={p.externalPriceMxn}
                onChange={(n) => update("externalPriceMxn", n)}
                mxnFx={fx}
                displayCcy={ccy}
              />
              <NumField
                label="内部电价 /kWh"
                value={p.internalPriceMxn}
                onChange={(n) => update("internalPriceMxn", n)}
                mxnFx={fx}
                displayCcy={ccy}
              />
              <NumField
                label="购电成本 /kWh"
                value={p.elecCostMxn}
                onChange={(n) => update("elecCostMxn", n)}
                mxnFx={fx}
                displayCcy={ccy}
              />
              <NumField
                label="桩建设"
                value={p.chargerCapexMxn}
                onChange={(n) => update("chargerCapexMxn", n)}
                mxnFx={fx}
                displayCcy={ccy}
              />
              <NumField
                label="装修"
                value={p.stationFitoutMxn}
                onChange={(n) => update("stationFitoutMxn", n)}
                mxnFx={fx}
                displayCcy={ccy}
              />
              <NumField
                label="月租金"
                value={p.stationRentMxn}
                onChange={(n) => update("stationRentMxn", n)}
                mxnFx={fx}
                displayCcy={ccy}
              />
              <NumField
                label="月运营费"
                value={p.opexStationMxn}
                onChange={(n) => update("opexStationMxn", n)}
                mxnFx={fx}
                displayCcy={ccy}
              />
              <NumField
                label="会计折旧年"
                value={p.chargerAcctYears}
                onChange={(n) => update("chargerAcctYears", n)}
              />
              <NumField
                label="物理年限"
                value={p.chargerPhysYears}
                onChange={(n) => update("chargerPhysYears", n)}
              />
              <NumField
                label="维保年限"
                value={p.chargerMaintYears}
                onChange={(n) => update("chargerMaintYears", n)}
              />
            </Grid>
          )}

          <Text size="small" tone="tertiary">
            车辆购置与 IPH/租金在资产卡；投资节点只选卡 + 数量 + 折扣。
          </Text>

          <Divider />
          <H3 style={TYPE.h3}>资本配置</H3>
          <Text size="small" tone="tertiary">
            借款与利息按场站及 DAE / LTO（RTO 暂共用 LTO）配置。拖动比例与利率看杠杆结果。
          </Text>
          <Row gap={12} align="center" wrap>
            <Text size="small">启用债务融资</Text>
            <Toggle
              checked={p.includeDebt !== false}
              onChange={(v) => update("includeDebt", v)}
            />
            <Text size="small" tone="tertiary">
              {p.includeDebt !== false
                ? `借款 ${m(model.capitalPlan.totalDebt)} · 自有资金 ${m(model.capitalPlan.totalEquity)}`
                : "全自有资金（无借款/利息）"}
            </Text>
          </Row>
          {p.includeDebt !== false && (
            <Stack gap={12}>
              <Text size="small" weight="semibold">
                充电桩
              </Text>
              <Grid columns={GRID_STATS} gap={12}>
                <ScaleField
                  label="融资比例"
                  value={p.stationFinancePct ?? 0.85}
                  onChange={(n) => update("stationFinancePct", n)}
                  min={0}
                  max={1}
                  step={0.05}
                  display={pct(p.stationFinancePct ?? 0.85)}
                  why="Capex 中债务占比；原表约 85%。"
                  effect={`权益兜底约 ${pct(1 - (p.stationFinancePct ?? 0.85))}`}
                  ticks={[
                    { value: 0.5, label: "50%" },
                    { value: 0.7, label: "70%" },
                    { value: 0.85, label: "85%" },
                    { value: 1, label: "100%" },
                  ]}
                />
                <ScaleField
                  label="融资利率"
                  value={p.stationFinanceRate ?? 0.14}
                  onChange={(n) => update("stationFinanceRate", n)}
                  min={0.05}
                  max={0.25}
                  step={0.005}
                  display={pct(p.stationFinanceRate ?? 0.14)}
                  why="年化借款成本，进利息与杠杆净利。"
                  ticks={[
                    { value: 0.1, label: "10%" },
                    { value: 0.14, label: "14%" },
                    { value: 0.18, label: "18%" },
                  ]}
                />
                <ScaleField
                  label="融资年限"
                  value={p.stationFinanceYears ?? 3}
                  onChange={(n) =>
                    update("stationFinanceYears", Math.round(n))
                  }
                  min={1}
                  max={8}
                  step={1}
                  display={`${Math.round(p.stationFinanceYears ?? 3)} 年`}
                  why="还本期；越短前期还本压力越大。"
                  ticks={[
                    { value: 2, label: "2年" },
                    { value: 3, label: "3年" },
                    { value: 5, label: "5年" },
                    { value: 7, label: "7年" },
                  ]}
                />
              </Grid>
              <Text size="small" weight="semibold">
                DAE（司机雇佣）
              </Text>
              <Grid columns={GRID_STATS} gap={12}>
                <ScaleField
                  label="融资比例"
                  value={p.daeFinancePct}
                  onChange={(n) => update("daeFinancePct", n)}
                  min={0}
                  max={1}
                  step={0.05}
                  display={pct(p.daeFinancePct)}
                  why="专车车队债务占比。"
                  ticks={[
                    { value: 0.5, label: "50%" },
                    { value: 0.7, label: "70%" },
                    { value: 0.85, label: "85%" },
                  ]}
                />
                <ScaleField
                  label="融资利率"
                  value={p.daeFinanceRate}
                  onChange={(n) => update("daeFinanceRate", n)}
                  min={0.05}
                  max={0.25}
                  step={0.005}
                  display={pct(p.daeFinanceRate)}
                  why="DAE 借款年化利率。"
                  ticks={[
                    { value: 0.1, label: "10%" },
                    { value: 0.14, label: "14%" },
                    { value: 0.18, label: "18%" },
                  ]}
                />
                <ScaleField
                  label="融资年限"
                  value={p.daeFinanceYears}
                  onChange={(n) => update("daeFinanceYears", Math.round(n))}
                  min={1}
                  max={8}
                  step={1}
                  display={`${Math.round(p.daeFinanceYears)} 年`}
                  why="DAE 还本期。"
                  ticks={[
                    { value: 2, label: "2年" },
                    { value: 3, label: "3年" },
                    { value: 5, label: "5年" },
                  ]}
                />
              </Grid>
              <Text size="small" weight="semibold">
                LTO / RTO（租赁类）
              </Text>
              <Grid columns={GRID_STATS} gap={12}>
                <ScaleField
                  label="融资比例"
                  value={p.ltoFinancePct}
                  onChange={(n) => update("ltoFinancePct", n)}
                  min={0}
                  max={1}
                  step={0.05}
                  display={pct(p.ltoFinancePct)}
                  why="租赁车队债务占比；RTO 暂共用。"
                  ticks={[
                    { value: 0.5, label: "50%" },
                    { value: 0.7, label: "70%" },
                    { value: 0.85, label: "85%" },
                  ]}
                />
                <ScaleField
                  label="融资利率"
                  value={p.ltoFinanceRate}
                  onChange={(n) => update("ltoFinanceRate", n)}
                  min={0.05}
                  max={0.25}
                  step={0.005}
                  display={pct(p.ltoFinanceRate)}
                  why="LTO/RTO 借款年化利率。"
                  ticks={[
                    { value: 0.1, label: "10%" },
                    { value: 0.14, label: "14%" },
                    { value: 0.18, label: "18%" },
                  ]}
                />
                <ScaleField
                  label="融资年限"
                  value={p.ltoFinanceYears}
                  onChange={(n) => update("ltoFinanceYears", Math.round(n))}
                  min={1}
                  max={8}
                  step={1}
                  display={`${Math.round(p.ltoFinanceYears)} 年`}
                  why="LTO/RTO 还本期。"
                  ticks={[
                    { value: 2, label: "2年" },
                    { value: 3, label: "3年" },
                    { value: 5, label: "5年" },
                  ]}
                />
              </Grid>
              <Table
                headers={[
                  "资产",
                  "规模",
                  "总Capex",
                  "融资比",
                  "利率",
                  "年限",
                  `债务（${unit}）`,
                  `权益（${unit}）`,
                ]}
                columnAlign={[
                  "left",
                  "right",
                  "right",
                  "right",
                  "right",
                  "right",
                  "right",
                  "right",
                ]}
                rows={model.capitalPlan.lines.map((l) => [
                  l.nameZh,
                  l.key === "station" ? `${l.units}枪` : `${l.units}台`,
                  m(l.totalCapex),
                  pct(l.financePct),
                  pct(l.financeRate),
                  String(l.financeYears),
                  m(l.debt),
                  m(l.equity),
                ])}
              />
            </Stack>
          )}
        </Stack>
        );
      })()}

      {tab === "units" && (
        <Stack gap={20}>
          <PageIntro
            title={pageMeta.units!.title}
            description={pageMeta.units!.description}
          />
          <Text size="small" tone="tertiary">
            量折取「数量 ≥ 档位门槛」的最高折扣；落地 = 购入价×(1−折扣)+皮费。起订/步长/上限约束购物车。
          </Text>

          {normalizedSkus.map((v) => {
            const tiers = [...(v.volumeTiers || [])].sort(
              (a, b) => a.minQty - b.minQty,
            );
            const previewQtys = [
              ...new Set([
                skuMinQty(v),
                ...tiers.map((t) => t.minQty),
                Math.min(skuMaxQty(v), (v.defaultQty ?? 50) * 2),
              ]),
            ]
              .filter((q) => q > 0 && q <= skuMaxQty(v))
              .sort((a, b) => a - b);
            return (
              <Card key={v.id}>
                <CardHeader
                  trailing={
                    <Pill size="sm" tone="neutral">
                      {v.kind === "station" ? "充电站" : "车辆"} · {v.unitLabel}
                    </Pill>
                  }
                >
                  {skuTitleZh(v)}
                </CardHeader>
                <CardBody>
                  <Stack gap={16}>
                    <H3 style={TYPE.h3}>
                      {v.kind === "station" ? "设备包与场站落地" : "价格与皮费"}
                    </H3>
                    <Grid columns={GRID_FORM} gap={12}>
                      <NumField
                        label={`购入价${skuPricesIncludeVat(v) ? "含税" : "未税"}（${ccyLabel(ccy)}）`}
                        value={v.purchasePriceMxn}
                        onChange={(n) =>
                          patchSku(v.id, { purchasePriceMxn: n })
                        }
                        hint={
                          skuPricesIncludeVat(v)
                            ? "对齐案例表列载含税价；落地不再加 IVA"
                            : "未税录入；购物车按 IVA 加税"
                        }
                        mxnFx={fx}
                        displayCcy={ccy}
                      />
                      <NumField
                        label={`指导价${skuPricesIncludeVat(v) ? "含税" : "未税"}（${ccyLabel(ccy)}）`}
                        value={v.guidePriceMxn}
                        onChange={(n) =>
                          patchSku(v.id, { guidePriceMxn: n })
                        }
                        hint="测算对照；墨市估值待合作 Libro Azul"
                        mxnFx={fx}
                        displayCcy={ccy}
                      />
                    </Grid>
                    <Grid columns={GRID_FORM} gap={12}>
                      {v.softCosts.map((s) => (
                        <NumField
                          key={s.id}
                          label={s.nameZh}
                          value={s.amountMxn}
                          onChange={(n) =>
                            setAssetSkus((prev) =>
                              prev.map((x) =>
                                x.id !== v.id
                                  ? x
                                  : {
                                      ...x,
                                      softCosts: x.softCosts.map((sc) =>
                                        sc.id === s.id
                                          ? { ...sc, amountMxn: n }
                                          : sc,
                                      ),
                                    },
                              ),
                            )
                          }
                          mxnFx={fx}
                          displayCcy={ccy}
                        />
                      ))}
                    </Grid>

                    <H3 style={TYPE.h3}>商详规格（管理员）</H3>
                    <SpecSheetList
                      rows={v.productSpecs || []}
                      renderCites={renderSourceCites}
                      borderColor={theme.stroke.secondary}
                    />
                    <Stack gap={8}>
                      {(v.productSpecs || []).map((r) => {
                        const citeIds = resolveSpecSourceIds(r);
                        if (citeIds.length > 0 || r.id === "source") {
                          return (
                            <Stack key={r.id} gap={6}>
                              <Row gap={10} align="center" wrap>
                                <Text style={{ minWidth: 100 }}>
                                  {r.labelZh}
                                </Text>
                                {renderSourceCites(citeIds)}
                              </Row>
                              <TextInput
                                value={(r.sourceIds || citeIds).join(" · ")}
                                placeholder="信源 id，用 · 分隔"
                                onChange={(val) => {
                                  const ids = val
                                    .split(/[·,，;\s]+/)
                                    .map((x) => x.trim())
                                    .filter(Boolean);
                                  patchSku(v.id, {
                                    productSpecs: (v.productSpecs || []).map(
                                      (x) =>
                                        x.id === r.id
                                          ? {
                                              ...x,
                                              sourceIds: ids,
                                              valueZh: "",
                                              status:
                                                ids.length > 0
                                                  ? "known"
                                                  : "pending",
                                            }
                                          : x,
                                    ),
                                  });
                                }}
                              />
                            </Stack>
                          );
                        }
                        return (
                          <Row key={r.id} gap={10} align="center" wrap>
                            <Text style={{ minWidth: 100 }}>{r.labelZh}</Text>
                            <TextInput
                              value={r.valueZh}
                              placeholder="规格取值"
                              onChange={(val) =>
                                patchSku(v.id, {
                                  productSpecs: (v.productSpecs || []).map(
                                    (x) =>
                                      x.id === r.id
                                        ? {
                                            ...x,
                                            valueZh: val,
                                            status:
                                              val && val !== "待填"
                                                ? "known"
                                                : "pending",
                                          }
                                        : x,
                                  ),
                                })
                              }
                            />
                          </Row>
                        );
                      })}
                    </Stack>

                    <H3 style={TYPE.h3}>供应链追溯（管理员）</H3>
                    <Text size="small" tone="secondary">
                      从品牌/总包追溯到工厂；标记是否 YOHO/LAFA 关联方。
                    </Text>
                    <Table
                      headers={[
                        "序",
                        "角色",
                        "主体",
                        ...operatorList.map((o) => `${o.nameZh}关联方`),
                        "备注",
                      ]}
                      columnAlign={[
                        "right",
                        "left",
                        "left",
                        ...operatorList.map(() => "left" as const),
                        "left",
                      ]}
                      rows={[...(v.supplyChain || [])]
                        .sort((a, b) => a.step - b.step)
                        .map((n) => [
                          String(n.step),
                          n.roleZh,
                          n.nameZh,
                          ...operatorList.map((o) =>
                            relatedFlagZh(relatedFlagOf(n.relatedParty, o.id)),
                          ),
                          n.noteZh,
                        ])}
                      striped
                    />

                    <H3 style={TYPE.h3}>数量规则（管理员）</H3>
                    <Grid columns={GRID_STATS} gap={12}>
                      <NumField
                        label={`起订量（${v.unitLabel}）`}
                        value={v.minOrderQty ?? 1}
                        onChange={(n) =>
                          patchSku(v.id, {
                            minOrderQty: Math.max(1, Math.round(n)),
                          })
                        }
                        hint="购物车首次加购不低于此"
                      />
                      <NumField
                        label={`加减步长（${v.unitLabel}）`}
                        value={v.qtyStep ?? 1}
                        onChange={(n) =>
                          patchSku(v.id, {
                            qtyStep: Math.max(1, Math.round(n)),
                          })
                        }
                      />
                      <NumField
                        label={`数量上限（${v.unitLabel}）`}
                        value={v.maxOrderQty ?? 500}
                        onChange={(n) =>
                          patchSku(v.id, {
                            maxOrderQty: Math.max(1, Math.round(n)),
                          })
                        }
                      />
                      <NumField
                        label={`默认加购量（${v.unitLabel}）`}
                        value={v.defaultQty ?? skuMinQty(v)}
                        onChange={(n) =>
                          patchSku(v.id, {
                            defaultQty: Math.max(1, Math.round(n)),
                          })
                        }
                        hint="货架首次点 + 时写入购物车"
                      />
                    </Grid>

                    <H3 style={TYPE.h3}>量折阶梯（管理员）</H3>
                    <Text size="small" tone="secondary">
                      门槛升序；同数量取最高档折扣。折扣 0.05 = 5% off 购入价（皮费不打折）。
                    </Text>
                    <Stack gap={10}>
                      {tiers.map((t, idx) => (
                        <Row key={`${v.id}-tier-${idx}`} gap={10} align="center" wrap>
                          <NumField
                            label="数量门槛 ≥"
                            value={t.minQty}
                            onChange={(n) => {
                              const next = tiers.map((x, i) =>
                                i === idx
                                  ? {
                                      ...x,
                                      minQty: Math.max(1, Math.round(n)),
                                    }
                                  : x,
                              );
                              patchSkuTier(
                                v.id,
                                next.sort((a, b) => a.minQty - b.minQty),
                              );
                            }}
                          />
                          <NumField
                            label="折扣率"
                            value={t.discountRate}
                            onChange={(n) => {
                              const next = tiers.map((x, i) =>
                                i === idx
                                  ? {
                                      ...x,
                                      discountRate: Math.max(
                                        0,
                                        Math.min(0.95, n),
                                      ),
                                    }
                                  : x,
                              );
                              patchSkuTier(v.id, next);
                            }}
                            hint="0–0.95"
                          />
                          <Stat
                            label="预览落地单价"
                            value={moneyMxn(
                              modelUnitLandedMxn(v, t.minQty),
                              fx,
                              ccy,
                            )}
                          />
                          <Button
                            variant="ghost"
                            disabled={tiers.length <= 1}
                            onClick={() =>
                              patchSkuTier(
                                v.id,
                                tiers.filter((_, i) => i !== idx),
                              )
                            }
                          >
                            删除档
                          </Button>
                        </Row>
                      ))}
                    </Stack>
                    <Row gap={8}>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          const last = tiers[tiers.length - 1];
                          const minQty = (last?.minQty ?? 0) + Math.max(10, skuStep(v) * 10);
                          patchSkuTier(v.id, [
                            ...tiers,
                            {
                              minQty,
                              discountRate: Math.min(
                                0.95,
                                (last?.discountRate ?? 0) + 0.02,
                              ),
                            },
                          ]);
                        }}
                      >
                        新增量折档
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          const base =
                            DEFAULT_ASSET_SKUS.find((d) => d.id === v.id) ||
                            DEFAULT_ASSET_SKUS[0];
                          patchSku(v.id, {
                            minOrderQty: base.minOrderQty,
                            qtyStep: base.qtyStep,
                            maxOrderQty: base.maxOrderQty,
                            defaultQty: base.defaultQty,
                          });
                        }}
                      >
                        恢复数量规则
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          const base =
                            DEFAULT_ASSET_SKUS.find((d) => d.id === v.id) ||
                            DEFAULT_ASSET_SKUS[0];
                          patchSkuTier(v.id, base.volumeTiers.map((t) => ({ ...t })));
                        }}
                      >
                        恢复默认阶梯
                      </Button>
                    </Row>

                    <H3 style={TYPE.h3}>量折预览表</H3>
                    <Table
                      headers={[
                        `数量（${v.unitLabel}）`,
                        "适用折扣",
                        `购入折后（${ccy}）`,
                        `皮费（${ccy}）`,
                        `落地单价（${ccy}）`,
                        `该量总价（${ccy}）`,
                      ]}
                      columnAlign={[
                        "right",
                        "right",
                        "right",
                        "right",
                        "right",
                        "right",
                      ]}
                      rows={previewQtys.map((q) => {
                        const d = volumeDiscountRate(v, q);
                        const soft = modelSoftSum(v);
                        const unit = modelUnitLandedMxn(v, q);
                        return [
                          String(q),
                          pct(d),
                          moneyMxn(v.purchasePriceMxn * (1 - d), fx, ccy),
                          moneyMxn(soft, fx, ccy),
                          moneyMxn(unit, fx, ccy),
                          moneyMxn(unit * q, fx, ccy),
                        ];
                      })}
                      striped
                    />

                    {v.kind === "station" && (
                      <Stack gap={12}>
                        <H3 style={TYPE.h3}>场站商详规格（管理员）</H3>
                        <Grid columns={GRID_STATS} gap={12}>
                          <NumField
                            label="车位"
                            value={v.stationSpec?.parkingSpaces ?? 0}
                            onChange={(n) =>
                              patchSku(v.id, {
                                stationSpec: {
                                  ...(v.stationSpec as StationSpec),
                                  parkingSpaces: Math.max(0, Math.round(n)),
                                },
                              })
                            }
                          />
                          <NumField
                            label="快充枪"
                            value={v.stationSpec?.fastGuns ?? 0}
                            onChange={(n) =>
                              patchSku(v.id, {
                                stationSpec: {
                                  ...(v.stationSpec as StationSpec),
                                  fastGuns: Math.max(0, Math.round(n)),
                                },
                              })
                            }
                          />
                          <NumField
                            label="慢充枪"
                            value={v.stationSpec?.slowGuns ?? 0}
                            onChange={(n) =>
                              patchSku(v.id, {
                                stationSpec: {
                                  ...(v.stationSpec as StationSpec),
                                  slowGuns: Math.max(0, Math.round(n)),
                                },
                              })
                            }
                          />
                          <NumField
                            label="桩体台数"
                            value={v.stationSpec?.chargerCabinets ?? 0}
                            onChange={(n) =>
                              patchSku(v.id, {
                                stationSpec: {
                                  ...(v.stationSpec as StationSpec),
                                  chargerCabinets: Math.max(0, Math.round(n)),
                                },
                              })
                            }
                          />
                        </Grid>
                        <Grid columns={GRID_STATS} gap={12}>
                          <NumField
                            label="总功率 kW"
                            value={v.stationSpec?.totalPowerKw ?? 0}
                            onChange={(n) =>
                              patchSku(v.id, {
                                stationSpec: {
                                  ...(v.stationSpec as StationSpec),
                                  totalPowerKw: n,
                                },
                              })
                            }
                          />
                          <NumField
                            label="面积 ㎡"
                            value={v.stationSpec?.areaSqm ?? 0}
                            onChange={(n) =>
                              patchSku(v.id, {
                                stationSpec: {
                                  ...(v.stationSpec as StationSpec),
                                  areaSqm: n,
                                },
                              })
                            }
                          />
                          <NumField
                            label="变压器 kVA"
                            value={v.stationSpec?.transformerKva ?? 0}
                            onChange={(n) =>
                              patchSku(v.id, {
                                stationSpec: {
                                  ...(v.stationSpec as StationSpec),
                                  transformerKva: n,
                                },
                              })
                            }
                          />
                          <NumField
                            label="柴发 kVA"
                            value={v.stationSpec?.dieselGeneratorKva ?? 0}
                            onChange={(n) =>
                              patchSku(v.id, {
                                stationSpec: {
                                  ...(v.stationSpec as StationSpec),
                                  dieselGeneratorKva: n,
                                },
                              })
                            }
                          />
                        </Grid>
                        <Grid columns={GRID_FORM} gap={12}>
                          <Stack gap={4}>
                            <Text size="small" tone="secondary">
                              品牌
                            </Text>
                            <TextInput
                              value={v.stationSpec?.brand ?? ""}
                              placeholder="待填"
                              onChange={(val) =>
                                patchSku(v.id, {
                                  brand: val || "待填",
                                  stationSpec: {
                                    ...(v.stationSpec as StationSpec),
                                    brand: val,
                                  },
                                })
                              }
                            />
                          </Stack>
                          <NumField
                            label="质保年（0=待填）"
                            value={v.stationSpec?.warrantyYears ?? 0}
                            onChange={(n) =>
                              patchSku(v.id, {
                                stationSpec: {
                                  ...(v.stationSpec as StationSpec),
                                  warrantyYears: Math.max(0, n),
                                },
                              })
                            }
                          />
                          <Stack gap={4}>
                            <Text size="small" tone="secondary">
                              供应商
                            </Text>
                            <TextInput
                              value={v.stationSpec?.supplier ?? ""}
                              placeholder="待管理人填写"
                              onChange={(val) =>
                                patchSku(v.id, {
                                  stationSpec: {
                                    ...(v.stationSpec as StationSpec),
                                    supplier: val,
                                  },
                                })
                              }
                            />
                          </Stack>
                          <Stack gap={4}>
                            <Text size="small" tone="secondary">
                              生产商
                            </Text>
                            <TextInput
                              value={v.stationSpec?.manufacturer ?? ""}
                              placeholder="待管理人填写"
                              onChange={(val) =>
                                patchSku(v.id, {
                                  stationSpec: {
                                    ...(v.stationSpec as StationSpec),
                                    manufacturer: val,
                                  },
                                })
                              }
                            />
                          </Stack>
                        </Grid>

                        <H3 style={TYPE.h3}>设备 BOM</H3>
                        <Text size="small" tone="secondary">
                          BOM 合计 {moneyMxn(stationBomSum(v), fx, ccy)} vs 设备包{" "}
                          {moneyMxn(v.purchasePriceMxn, fx, ccy)}
                        </Text>
                        <Table
                          headers={[
                            "分项",
                            "数量",
                            `金额（${ccy}）`,
                            "状态",
                            "备注",
                          ]}
                          columnAlign={[
                            "left",
                            "right",
                            "right",
                            "left",
                            "left",
                          ]}
                          rows={(v.stationBom || []).map((b) => [
                            b.nameZh,
                            `${b.qty}${b.unit}`,
                            moneyMxn(b.amountMxn, fx, ccy),
                            b.status === "locked" ? "锁定" : "待核",
                            b.noteZh,
                          ])}
                          striped
                        />
                        <Stack gap={8}>
                          {(v.stationBom || []).map((b) => (
                            <Row key={b.id} gap={10} align="center" wrap>
                              <Text style={{ minWidth: 120 }}>{b.nameZh}</Text>
                              <NumField
                                label="数量"
                                value={b.qty}
                                onChange={(n) =>
                                  patchSku(v.id, {
                                    stationBom: (v.stationBom || []).map((x) =>
                                      x.id === b.id
                                        ? {
                                            ...x,
                                            qty: Math.max(0, Math.round(n)),
                                          }
                                        : x,
                                    ),
                                  })
                                }
                              />
                              <NumField
                                label={`金额（${ccyLabel(ccy)}）`}
                                value={b.amountMxn}
                                onChange={(n) =>
                                  patchSku(v.id, {
                                    stationBom: (v.stationBom || []).map((x) =>
                                      x.id === b.id
                                        ? { ...x, amountMxn: n }
                                        : x,
                                    ),
                                  })
                                }
                                mxnFx={fx}
                                displayCcy={ccy}
                              />
                            </Row>
                          ))}
                        </Stack>

                        <H3 style={TYPE.h3}>管理人填写表（链接字段）</H3>
                        <Callout tone="neutral" title="配置链接表">
                          资产配置页商详会展示同一张表，供 YOHO/LAFA 填写；此处可预填或清空。
                        </Callout>
                        <Table
                          headers={["字段", "必填", "当前值", "提示"]}
                          columnAlign={["left", "left", "left", "left"]}
                          rows={(v.specFill || []).map((r) => [
                            r.fieldZh,
                            r.required ? "是" : "否",
                            r.value || "（空）",
                            r.hintZh,
                          ])}
                          striped
                        />
                      </Stack>
                    )}

                    <Divider />
                    <Grid columns={GRID_STATS} gap={12}>
                      <NumField
                        label="会计年"
                        value={v.acctYears}
                        onChange={(n) => patchSku(v.id, { acctYears: n })}
                      />
                      <NumField
                        label="物理年"
                        value={v.physYears}
                        onChange={(n) => patchSku(v.id, { physYears: n })}
                      />
                      <NumField
                        label="维保年"
                        value={v.maintYears}
                        onChange={(n) => patchSku(v.id, { maintYears: n })}
                      />
                      <NumField
                        label={`保险年（${ccyLabel(ccy)}）`}
                        value={v.insuranceYrMxn}
                        onChange={(n) =>
                          patchSku(v.id, { insuranceYrMxn: n })
                        }
                        mxnFx={fx}
                        displayCcy={ccy}
                      />
                    </Grid>
                    <Text size="small" tone="secondary">
                      维保政策：{v.maintPolicyZh}
                    </Text>
                  </Stack>
                </CardBody>
              </Card>
            );
          })}
        </Stack>
      )}

      {tab === "value" && (
        <Stack gap={16}>
          <PageIntro
            title={pageMeta.value!.title}
            description={pageMeta.value!.description}
          />
          <Callout tone="neutral" title="残值关切已并入商详">
            寿命口径、期末残值率、账面/市场路径、Libro Azul、单 SKU
            投残对照 → 货架打开任一 SKU →「资产估值·残值」。组合层投残表在「资产组合」折叠「④
            组合投残汇总」。
          </Callout>
          <Row gap={8} wrap>
            {normalizedSkus
              .filter((s) => s.kind === "vehicle" || s.kind === "station")
              .slice(0, 8)
              .map((s) => (
                <Button
                  key={s.id}
                  variant="secondary"
                  onClick={() => openSkuDetail(s.id, "valuation")}
                >
                  {s.nameZh} · 资产估值
                </Button>
              ))}
            <Button variant="ghost" onClick={() => setTab("invest")}>
              资产组合 · 投残汇总
            </Button>
            <Button variant="ghost" onClick={() => setTab("config")}>
              回货架
            </Button>
          </Row>
        </Stack>
      )}

      {tab === "returns" && (
        <Stack gap={20}>
          <PageIntro
            title={pageMeta.returns!.title}
            description={pageMeta.returns!.description}
          />
          <Text size="small" tone="tertiary">
            资产组合子项：资产层只看可变成本；场站/总部固定成本上叠；借款与利息留在资本层。
          </Text>

          <Grid columns={GRID_STATS} gap={12}>
            <Stat
              label={`累计贡献毛利（${unit}）`}
              value={m(model.totals.contribution)}
            />
            <Stat
              label="贡献率"
              value={pct(
                model.totals.revenue > 0
                  ? model.totals.contribution / model.totals.revenue
                  : null,
              )}
            />
            <Stat
              label={`总部分摊（${unit}）`}
              value={p.includeHq ? m(model.totals.hqAlloc) : "未计入"}
            />
            <Stat
              label={`累计净利（${unit}）`}
              value={m(model.totals.netIncome)}
            />
          </Grid>

          <Stack gap={8}>
            <H3 style={TYPE.h3}>① 资产层测算（可变成本）</H3>
            <Text size="small" tone="secondary">
              可变成本 = 场站随枪变动成本 + DAE 单台运营 + LTO
              单台运营（合并抵消时扣内部充电）
            </Text>
            <Table
              headers={[
                "年",
                "收入",
                "可变成本",
                "贡献毛利",
                "贡献率",
                "场站收入",
                "车辆收入",
              ]}
              columnAlign={[
                "left",
                "right",
                "right",
                "right",
                "right",
                "right",
                "right",
              ]}
              rows={model.rows.map((r) => [
                r.label,
                m(r.revenue),
                m(r.varCost),
                m(r.contribution),
                pct(r.revenue > 0 ? r.contribution / r.revenue : null),
                m(r.stationRev),
                m(r.vehicleRev),
              ])}
              striped
            />
          </Stack>

          <Stack gap={8}>
            <H3 style={TYPE.h3}>② 固定成本叠加明细</H3>
            <Table
              headers={[
                "年",
                "贡献毛利",
                "场站固定",
                "扣固定后",
                "总部分摊",
                "EBITDA",
                "总部/收入",
                "总部/贡献",
              ]}
              columnAlign={[
                "left",
                "right",
                "right",
                "right",
                "right",
                "right",
                "right",
                "right",
              ]}
              rows={model.rows.map((r) => [
                r.label,
                m(r.contribution),
                m(r.fixedCost),
                m(r.afterSiteFixed),
                m(r.hqAlloc),
                m(r.ebitda),
                pct(r.hqOnRevenue),
                pct(r.hqOnContribution),
              ])}
              striped
            />
          </Stack>

          <Stack gap={8}>
            <H3 style={TYPE.h3}>总部费用口径明细</H3>
            <Table
              headers={["项目", "假设 / 计算", `金额（${unit}）`, "备注"]}
              columnAlign={["left", "left", "right", "left"]}
              rows={[
                [
                  "总部管理费（月）",
                  "前提参数",
                  moneyMxn(p.hqMonthMxn ?? 640_891, fx, ccy),
                  "来自原测算假设页",
                ],
                [
                  "年化全额",
                  "月额 × 12",
                  m(mxnToUsd((p.hqMonthMxn ?? 640_891) * 12, fx)),
                  p.includeHq ? "计入管理报表" : "当前开关关闭",
                ],
                [
                  "Y1 分摊",
                  "投放年 100%",
                  m(
                    p.includeHq
                      ? mxnToUsd((p.hqMonthMxn ?? 640_891) * 12, fx)
                      : 0,
                  ),
                  "对齐原表：初期全额",
                ],
                [
                  `Y2+ 分摊`,
                  `稳定期 ${Math.round((p.hqSteadyPct ?? 0.25) * 100)}%`,
                  m(
                    p.includeHq
                      ? mxnToUsd((p.hqMonthMxn ?? 640_891) * 12, fx) *
                          (p.hqSteadyPct ?? 0.25)
                      : 0,
                  ),
                  "原表约「次年及以后按 25%」",
                ],
                [
                  "期内累计计入",
                  "各年求和",
                  m(model.totals.hqAlloc),
                  `占累计收入 ${pct(
                    model.totals.revenue > 0
                      ? model.totals.hqAlloc / model.totals.revenue
                      : null,
                  )}`,
                ],
                [
                  "场站固定（年·开站）",
                  "租金 + 场站运维",
                  moneyMxn(
                    (p.stationRentMxn + p.opexStationMxn) * 12,
                    fx,
                    ccy,
                  ),
                  "不随单车边际；无枪则为 0",
                ],
              ]}
            />
          </Stack>

          {(() => {
            const rev = model.totals.revenue;
            const contrib = model.totals.contribution;
            const hq = model.totals.hqAlloc;
            const siteFix = model.totals.fixedCost;
            const cm = rev > 0 ? contrib / rev : 0;
            const hqRev = rev > 0 ? hq / rev : 0;
            const hqCm = contrib > 0 ? hq / contrib : hq > 0 ? 9 : 0;
            const siteCm = contrib > 0 ? siteFix / contrib : 0;
            const peakVehicles = Math.max(
              ...model.rows.map((r) => r.daeOnline + r.ltoOnline),
              1,
            );
            const hqPerVehicleYr =
              hq /
              Math.max(
                model.rows.reduce(
                  (s, r) => s + r.daeOnline + r.ltoOnline,
                  0,
                ),
                1,
              );
            const flags: {
              tone: "neutral" | "warning" | "danger" | "info";
              title: string;
              body: string;
            }[] = [];

            if (cm >= 0.35) {
              flags.push({
                tone: CHART_BW,
                title: "资产贡献率",
                body: `累计贡献率 ${pct(cm)}，可变成本吸收后仍留有较厚毛利空间。`,
              });
            } else if (cm >= 0.2) {
              flags.push({
                tone: CHART_BW,
                title: "资产贡献率偏薄",
                body: `累计贡献率 ${pct(cm)}。优先压可变成本（司机/电费/维保）或抬利用率与租金，再谈总部分摊。`,
              });
            } else {
              flags.push({
                tone: CHART_BW,
                title: "资产贡献不足",
                body: `累计贡献率 ${pct(cm)}。资产本身经济性偏弱，叠加固定成本后难转正。`,
              });
            }

            if (siteCm > 0.5) {
              flags.push({
                tone: CHART_BW,
                title: "场站固定侵蚀贡献",
                body: `场站固定占贡献 ${pct(siteCm)}。枪/车规模偏小或租金运维偏高，贡献难覆盖开站成本。`,
              });
            } else if (siteFix > 0) {
              flags.push({
                tone: CHART_BW,
                title: "场站固定占比",
                body: `场站固定占贡献 ${pct(siteCm)}，累计 ${m(siteFix)}。属开站刚性成本，与单车边际分开看。`,
              });
            }

            if (!p.includeHq) {
              flags.push({
                tone: CHART_BW,
                title: "总部未计入",
                body: "当前为墨西哥单体口径。管理并表时打开「计入总部管理费分摊」对照侵蚀幅度。",
              });
            } else if (hqCm >= 1) {
              flags.push({
                tone: CHART_BW,
                title: "总部超过贡献",
                body: `总部累计占贡献 ${pct(hqCm)}，贡献毛利不足以覆盖总部。需扩规模、降总部基数，或下调稳定期分摊比例。`,
              });
            } else if (hqRev > 0.15 || hqCm > 0.4) {
              flags.push({
                tone: CHART_BW,
                title: "总部分摊偏重",
                body: `总部/收入 ${pct(hqRev)}，总部/贡献 ${pct(hqCm)}。约合每车年 ${m(hqPerVehicleYr)}（按在管台年）。检视月额 ${(p.hqMonthMxn ?? 640891).toLocaleString()} MXN 与稳定期 ${Math.round((p.hqSteadyPct ?? 0.25) * 100)}% 是否过高。`,
              });
            } else {
              flags.push({
                tone: CHART_BW,
                title: "总部分摊可承受",
                body: `总部/收入 ${pct(hqRev)}，总部/贡献 ${pct(hqCm)}；每车年约 ${m(hqPerVehicleYr)}。Y1 全额、其后 ${Math.round((p.hqSteadyPct ?? 0.25) * 100)}% 的节奏与原表一致。`,
              });
            }

            const y1 = model.rows[0];
            if (y1 && p.includeHq && y1.hqOnContribution > 0.6) {
              flags.push({
                tone: CHART_BW,
                title: "Y1 总部冲击",
                body: `投放年总部占贡献 ${pct(y1.hqOnContribution)}（全额计入）。属节奏性冲击；看 Y2+ 稳定期是否回落，勿单用 Y1 否定资产。峰值在管约 ${peakVehicles} 台。`,
              });
            }

            return (
              <Stack gap={10}>
                <H3 style={TYPE.h3}>③ 合理性分析</H3>
                <Text size="small" tone="secondary">
                  阈值参考：贡献率 ≥35% 较健康；总部/收入 ≤15%、总部/贡献 ≤40%
                  为可承受带；超过则标黄/红。
                </Text>
                {flags.map((f) => (
                  <Callout key={f.title} tone={f.tone} title={f.title}>
                    {f.body}
                  </Callout>
                ))}
              </Stack>
            );
          })()}

          <Stack gap={8}>
            <H3 style={TYPE.h3}>④ 资本层（按资产配置）</H3>
            <Text size="small" tone="secondary">
              原测算把借款与利息直接揉进损益；此处改为资本配置项，对应充电桩与车辆，可开关对照无杠杆。
            </Text>
            <Table
              headers={[
                "资产",
                "规模",
                `Capex（${unit}）`,
                "融资比",
                "利率",
                "年",
                `债务（${unit}）`,
                `权益（${unit}）`,
              ]}
              columnAlign={[
                "left",
                "right",
                "right",
                "right",
                "right",
                "right",
                "right",
                "right",
              ]}
              rows={model.capitalPlan.lines.map((l) => [
                l.nameZh,
                l.key === "station" ? `${l.units}枪` : `${l.units}台`,
                m(l.totalCapex),
                pct(l.financePct),
                pct(l.financeRate),
                String(l.financeYears),
                m(l.debt),
                m(l.equity),
              ])}
            />
            <Table
              headers={[
                "年",
                "利息·桩",
                "利息·DAE",
                "利息·LTO",
                "利息合计",
                "借款流入",
                "还本",
                "贷款余额",
                "EBIT",
                "无杠杆净利",
                "杠杆净利",
              ]}
              columnAlign={[
                "left",
                "right",
                "right",
                "right",
                "right",
                "right",
                "right",
                "right",
                "right",
                "right",
                "right",
              ]}
              rows={model.rows.map((r) => [
                r.label,
                m(r.interestStation),
                m(r.interestDae),
                m(r.interestLto),
                m(r.interest),
                m(r.financingIn),
                m(r.financingOut),
                m(r.loanBalStation + r.loanBalDae + r.loanBalLto),
                m(r.ebit),
                m(r.unleveredNi),
                m(r.netIncome),
              ])}
              striped
            />
            <Grid columns={GRID_STATS} gap={12}>
              <Stat
                label={`自有资金投入（${unit}）`}
                value={m(model.equityOutlay)}
              />
              <Stat
                label={`借款合计（${unit}）`}
                value={m(model.capitalPlan.totalDebt)}
              />
              <Stat
                label="IRR 含融资 / 全自有"
                value={`${pct(model.cashIrr)} / ${pct(model.unleveredIrr)}`}
              />
            </Grid>
            {(() => {
              const totInt = model.rows.reduce((s, r) => s + r.interest, 0);
              const ebitSum = model.rows.reduce((s, r) => s + r.ebit, 0);
              const intOnEbit = ebitSum > 0 ? totInt / ebitSum : 0;
              const debtOnCapex =
                model.capitalPlan.totalCapex > 0
                  ? model.capitalPlan.totalDebt / model.capitalPlan.totalCapex
                  : 0;
              if (!model.capitalPlan.includeDebt) {
                return (
                  <Callout tone="neutral" title="资本层关闭">
                    当前为全自有资金：利息与借款为 0。资产回报看无杠杆 IRR{" "}
                    {pct(model.unleveredIrr)}。
                  </Callout>
                );
              }
              if (intOnEbit > 0.5) {
                return (
                  <Callout tone="neutral" title="资本成本偏重">
                    累计利息占累计 EBIT {pct(intOnEbit)}；综合杠杆约{" "}
                    {pct(debtOnCapex)}
                    。可下调融资比例/利率，或先看无杠杆资产是否成立。
                  </Callout>
                );
              }
              return (
                <Callout tone="neutral" title="资本配置可承受">
                  累计利息占 EBIT {pct(intOnEbit)}，债务/Capex{" "}
                  {pct(debtOnCapex)}
                  。杠杆 IRR {pct(model.cashIrr)} vs 无杠杆{" "}
                  {pct(model.unleveredIrr)}
                  （权益更少时杠杆 IRR 通常更高）。
                </Callout>
              );
            })()}
          </Stack>

          <Stack gap={8}>
            <H3 style={TYPE.h3}>⑤ 双口径：财务净利 vs 现金流</H3>
            <Text size="small" tone="secondary">
              在分层经营与资本结果之后：折旧进利润表、加回进现金流；Capex /
              借款还本 / 残值只进现金流。
            </Text>
            <Table
              headers={[
                "年",
                "EBITDA",
                "折旧",
                "净利润",
                "经营CF",
                "Capex",
                "残值",
                "净现金流",
              ]}
              columnAlign={[
                "left",
                "right",
                "right",
                "right",
                "right",
                "right",
                "right",
                "right",
              ]}
              rows={model.rows.map((r) => [
                r.label,
                m(r.ebitda),
                m(r.depreciation),
                m(r.netIncome),
                m(r.operatingCF),
                m(r.capex),
                m(r.residualIn),
                m(r.cashFlow),
              ])}
              striped
            />
          </Stack>

          <Grid columns={GRID_STATS} gap={12}>
            <Stat label="杠杆 IRR" value={pct(model.cashIrr)} />
            <Stat label="无杠杆 IRR" value={pct(model.unleveredIrr)} />
            <Stat
              label="判定"
              value={
                model.cashIrr != null && model.cashIrr > 0.12
                  ? "持有扩张"
                  : model.cashIrr != null && model.cashIrr >= 0.08
                    ? "中性盯残值"
                    : "审视利用率"
              }
            />
          </Grid>
        </Stack>
      )}


      {tab === "ops" && (
        <Stack gap={20}>
          <PageIntro
            title={pageMeta.ops!.title}
            description={pageMeta.ops!.description}
          />

          <Stack
            gap={12}
            style={mergeStyle({
              padding: 12,
              border: `1px solid ${theme.stroke.secondary}`,
              background: theme.bg.elevated,
            })}
          >
            <Text size="small" weight="medium">
              ① 运营商（管理人）
            </Text>
            <Text size="small" tone="tertiary">
              资产由不同管理人运营：先定「谁在管」，再看出车进度与平台字段。总览⑦看在管金额分配；订单页可改单笔归属。目标是观察并再平衡运营资产，提升投产收益归因与整体回报。
            </Text>
            <Grid columns={GRID_FORM} gap={12}>
              <Stack gap={4}>
                <Text size="small" tone="secondary">
                  当前运营商
                </Text>
                <Select
                  value={managerIdUse}
                  onChange={(v) => setCfgManager(v)}
                  options={enabledOperators.map((m) => ({
                    value: m.id,
                    label: `${m.nameZh} · ${m.hint}`,
                  }))}
                />
              </Stack>
              <Stat
                label="启用中"
                value={`${enabledOperators.length} / ${operatorList.length}`}
                tone="neutral"
              />
            </Grid>

            <Stack gap={8}>
              <Text size="small" tone="secondary">
                运营商名册（配置）
              </Text>
              {operatorList.map((op) => (
                <Row key={op.id} gap={8} align="center" wrap>
                  <Toggle
                    checked={op.enabled}
                    onChange={(on) => {
                      setOperators((prev) => {
                        const base =
                          prev.length > 0 ? prev : DEFAULT_OPERATORS;
                        return base.map((x) =>
                          x.id === op.id ? { ...x, enabled: on } : x,
                        );
                      });
                      if (!on && cfgManager === op.id) {
                        const next = operatorList.find(
                          (x) => x.id !== op.id && x.enabled,
                        );
                        if (next) setCfgManager(next.id);
                      }
                    }}
                  />
                  <TextInput
                    value={op.nameZh}
                    placeholder="名称"
                    style={{ minWidth: 100, flex: 1 }}
                    onChange={(v) =>
                      setOperators((prev) => {
                        const base =
                          prev.length > 0 ? prev : DEFAULT_OPERATORS;
                        return base.map((x) =>
                          x.id === op.id ? { ...x, nameZh: v } : x,
                        );
                      })
                    }
                  />
                  <TextInput
                    value={op.hint}
                    placeholder="说明"
                    style={{ minWidth: 160, flex: 2 }}
                    onChange={(v) =>
                      setOperators((prev) => {
                        const base =
                          prev.length > 0 ? prev : DEFAULT_OPERATORS;
                        return base.map((x) =>
                          x.id === op.id ? { ...x, hint: v } : x,
                        );
                      })
                    }
                  />
                  <Text size="small" tone="tertiary">
                    {op.id}
                  </Text>
                  {op.id !== "fenbang" && op.id !== "lafa" && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setOperators((prev) =>
                          (prev.length > 0 ? prev : DEFAULT_OPERATORS).filter(
                            (x) => x.id !== op.id,
                          ),
                        );
                        if (cfgManager === op.id) {
                          setCfgManager("fenbang");
                        }
                      }}
                    >
                      删除
                    </Button>
                  )}
                </Row>
              ))}
              <Row gap={8} align="center" wrap>
                <TextInput
                  value={opsNewName}
                  placeholder="新运营商名称"
                  style={{ minWidth: 140, flex: 1 }}
                  onChange={setOpsNewName}
                />
                <TextInput
                  value={opsNewHint}
                  placeholder="说明（可选）"
                  style={{ minWidth: 160, flex: 2 }}
                  onChange={setOpsNewHint}
                />
                <Button
                  variant="secondary"
                  onClick={() => {
                    const name = opsNewName.trim();
                    if (!name) return;
                    const base =
                      operators.length > 0 ? operators : DEFAULT_OPERATORS;
                    const id = newOperatorId(name, base);
                    setOperators([
                      ...base,
                      {
                        id,
                        nameZh: name,
                        hint: opsNewHint.trim() || "自定义运营商",
                        enabled: true,
                      },
                    ]);
                    setCfgManager(id);
                    setOpsNewName("");
                    setOpsNewHint("");
                  }}
                >
                  新增运营商
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setOperators(DEFAULT_OPERATORS);
                    setCfgManager("fenbang");
                  }}
                >
                  恢复默认名册
                </Button>
              </Row>
            </Stack>
          </Stack>

          {(() => {
            const enabledIds = enabledOperators.map((o) => o.id);
            const best = bestOperatorByQuality(enabledIds);
            const openOrders = activeOrders.filter(
              (o) => o.status !== "cancelled",
            );
            const under = openOrders
              .map((o) => {
                const curQ = operatorQualityOf(o.managerId);
                const peer =
                  best && best.id !== o.managerId
                    ? best
                    : bestOperatorByQuality(
                        enabledIds.filter((id) => id !== o.managerId),
                      );
                if (!peer) return null;
                const worse = isOpsSignificantlyWorse(curQ, peer.q);
                if (!worse) return null;
                const curCards = cardsForManager(
                  cards,
                  o.managerId,
                  o.country || "墨西哥",
                  o.vertical || "网约车·专车",
                );
                const altCards = cardsForManager(
                  cards,
                  peer.id,
                  o.country || "墨西哥",
                  o.vertical || "网约车·专车",
                );
                const curM = buildModel(
                  premiseWithOrderPay(p, o),
                  ordersToNodes([o]),
                  curCards,
                );
                const altM = buildModel(
                  premiseWithOrderPay(p, o),
                  ordersToNodes([o]),
                  altCards,
                );
                return {
                  order: o,
                  curName: pickOperatorMeta(o.managerId).nameZh,
                  peerName: pickOperatorMeta(peer.id).nameZh,
                  peerId: peer.id,
                  curQ,
                  peerQ: peer.q,
                  curIrr: curM.cashIrr,
                  altIrr: altM.cashIrr,
                  curRes: curM.totals.endResidual,
                  altRes: altM.totals.endResidual,
                };
              })
              .filter(Boolean) as {
              order: PurchaseOrder;
              curName: string;
              peerName: string;
              peerId: ManagerId;
              curQ: OperatorOpsQuality;
              peerQ: OperatorOpsQuality;
              curIrr: number | null;
              altIrr: number | null;
              curRes: number;
              altRes: number;
            }[];
            const modes: OpMode[] = ["DAE", "LTO", "RTO"];
            return (
              <Stack
                gap={12}
                style={mergeStyle({
                  padding: 12,
                  border: `1px solid ${theme.stroke.secondary}`,
                  background: theme.bg.elevated,
                })}
              >
                <Text size="small" weight="medium">
                  ② 同资产 · 跨机构对照（赚钱 / 出险 / 保值）
                </Text>
                <Text size="small" tone="tertiary">
                  同样的车：谁更赚钱、谁出险更少、谁更保值——影响是否把资产从弱机构调到强机构。数值为对照假设，实绩落地后双端替换。
                </Text>
                <Table
                  headers={[
                    "机构",
                    "赚钱",
                    "出险/百车年",
                    "保值",
                    "保费",
                    "决策分",
                    "说明",
                  ]}
                  columnAlign={[
                    "left",
                    "right",
                    "right",
                    "right",
                    "right",
                    "right",
                    "left",
                  ]}
                  rows={enabledIds.map((id) => {
                    const q = operatorQualityOf(id);
                    const meta = pickOperatorMeta(id);
                    const isBest = best?.id === id;
                    return [
                      `${meta.nameZh}${isBest ? " ·最优" : ""}`,
                      q.earnIndex.toFixed(2),
                      String(q.claimPer100Yr),
                      q.residualMul.toFixed(2),
                      q.insuranceMul.toFixed(2),
                      operatorDecisionScore(q).toFixed(1),
                      q.noteZh,
                    ];
                  })}
                  striped
                />
                <Text size="small" weight="medium">
                  经营剖面（同模式对照）
                </Text>
                <Table
                  headers={["模式", "YOHO", "LAFA", "差距"]}
                  columnAlign={["left", "left", "left", "left"]}
                  rows={modes.map((mode) => {
                    const yo = findOpsProfile(
                      "墨西哥",
                      mode === "DAE" ? "网约车·专车" : "网约车·快车",
                      mode,
                      "fenbang",
                    );
                    const la = findOpsProfile(
                      "墨西哥",
                      mode === "DAE" ? "网约车·专车" : "网约车·快车",
                      mode,
                      "lafa",
                    );
                    const yoLine =
                      mode === "DAE"
                        ? `利用${pct(yo.util)} IPH${yo.iphMxn}`
                        : `出租${pct(yo.occupancy)} 租${yo.rentMonthMxn}`;
                    const laLine =
                      mode === "DAE"
                        ? `利用${pct(la.util)} IPH${la.iphMxn}`
                        : `出租${pct(la.occupancy)} 租${la.rentMonthMxn}`;
                    const gap =
                      mode === "DAE"
                        ? `利用${(la.util - yo.util) * 100 >= 0 ? "+" : ""}${((la.util - yo.util) * 100).toFixed(0)}pt IPH${la.iphMxn - yo.iphMxn >= 0 ? "+" : ""}${la.iphMxn - yo.iphMxn}`
                        : `出租${(la.occupancy - yo.occupancy) * 100 >= 0 ? "+" : ""}${((la.occupancy - yo.occupancy) * 100).toFixed(0)}pt`;
                    return [mode, yoLine, laLine, gap];
                  })}
                  striped
                />
                {under.length > 0 ? (
                  <Stack gap={10}>
                    <Callout
                      tone="warning"
                      title={`发现 ${under.length} 笔资产包显著弱于对照机构`}
                    >
                      同资产假设下，当前管理人在赚钱 / 出险 /
                      保值上显著差于对照。可改挂更优机构（IRR
                      按机构剖面重算示意）。
                    </Callout>
                    <Table
                      headers={[
                        "资产包",
                        "当前",
                        "建议",
                        "IRR",
                        "期末残值",
                        "操作",
                      ]}
                      columnAlign={[
                        "left",
                        "left",
                        "left",
                        "right",
                        "right",
                        "left",
                      ]}
                      rows={under.map((u) => [
                        u.order.label,
                        u.curName,
                        u.peerName,
                        `${pct(u.curIrr)}→${pct(u.altIrr)}`,
                        `${m(u.curRes)}→${m(u.altRes)}`,
                        <Button
                          key={`realloc-${u.order.id}`}
                          variant="secondary"
                          onClick={() => {
                            patchOrder(u.order.id, { managerId: u.peerId });
                            setOrderFocusId(u.order.id);
                          }}
                        >
                          改挂
                        </Button>,
                      ])}
                      striped
                    />
                    <Button
                      variant="secondary"
                      onClick={() => {
                        for (const u of under) {
                          patchOrder(u.order.id, { managerId: u.peerId });
                        }
                      }}
                    >
                      一键改挂全部弱项资产包
                    </Button>
                  </Stack>
                ) : (
                  <Callout tone="neutral" title="未发现显著弱项">
                    在管资产包相对启用机构中的最优对照，尚未触发「显著差于」阈值（盈利≥5%
                    / 出险相对≥20% / 保值≥3%）。可改订单管理人后回看。
                  </Callout>
                )}
              </Stack>
            );
          })()}

          <Text size="small" tone="tertiary">
            运营视角：漏斗节点 + 滴滴 Fleet Open API 底表（与《EV数据逻辑梳理》字段融合）。不直连、不存 AK/SK。当前按「
            {cfgManagerMeta.nameZh}」运营。
          </Text>
          {renderSourceCites(["didi-fleet-open-api", "ev-logic-docx"])}

          <Row gap={6} wrap>
            {(
              [
                { id: "funnel" as const, label: "漏斗" },
                { id: "schema" as const, label: "字段底表" },
                { id: "api" as const, label: "接口目录" },
              ] as const
            ).map((x) => (
              <Pill
                key={x.id}
                active={opsPane === x.id}
                onClick={() => setOpsPane(x.id)}
              >
                {x.label}
              </Pill>
            ))}
          </Row>

          <Grid columns={GRID_STATS} gap={12}>
            <Stat label="运营商" value={cfgManagerMeta.nameZh} tone="neutral" />
            <Stat label="观测台数" value={`${opsFleetQty} 台`} />
            <Stat label="付款→首收" value={`${cfGoLiveDays} 天`} />
            <Stat label="投产可经营" value={`${opsLiveQty} 台`} tone="neutral" />
            <Stat
              label="漏斗掉队"
              value={`${opsDropQty} 台`}
            />
          </Grid>

          <Row gap={8} wrap>
            <Button variant="secondary" onClick={() => setTab("params")}>
              改周期天数
            </Button>
            <Button variant="ghost" onClick={() => setTab("invest")}>
              看现金流时点
            </Button>
            <Button variant="ghost" onClick={() => setTab("invest")}>
              看组合/身份补录
            </Button>
          </Row>

          {opsPane === "funnel" && (
            <Stack gap={16}>
              <H3 style={TYPE.h3}>出车进度漏斗</H3>
              <Text size="small" tone="secondary">
                与「经营假设」付款到投产一致：访谈默认本地库存车为付款 → 整备/上牌 → 上路（空窗最长约1个月）；进口链路才含海运/清关。上路要求车辆与司机审核通过。
              </Text>
              <BarChart
                height={220}
                horizontal
                categories={opsFunnel.map((s) => s.nameZh)}
                series={[
                  {
                    name: "留存台数",
                    data: opsFunnel.map((s) => s.exitQty),
                    tone: CHART_BW,
                  },
                ]}
                beginAtZero
                showValues
              />
              <Table
                headers={[
                  "节点",
                  "停留天",
                  "累计天",
                  "通过率",
                  "进入",
                  "离开",
                  "掉队",
                  "平台动作（示意）",
                ]}
                columnAlign={[
                  "left",
                  "right",
                  "right",
                  "right",
                  "right",
                  "right",
                  "right",
                  "left",
                ]}
                rowTone={opsFunnel.map((s) =>
                  s.id === "live"
                    ? "neutral"
                    : s.dropQty > 0
                      ? "neutral"
                      : undefined,
                )}
                rows={opsFunnel.map((s) => [
                  s.nameZh,
                  s.days > 0 ? String(s.days) : "—",
                  String(s.cumDays),
                  s.id === "pay" || s.id === "live" ? "—" : pct(s.passRate),
                  String(s.enterQty),
                  String(s.exitQty),
                  s.dropQty > 0 ? String(s.dropQty) : "—",
                  s.id === "pay"
                    ? "建资产卡 · 补 NIV/电池SN"
                    : s.id === "ocean"
                      ? "物流在途（平台无接口）"
                      : s.id === "customs"
                        ? "报关单号 customsNo"
                        : s.id === "pdi"
                          ? "上牌 plate_no · car/addCar · addDocument"
                          : s.id === "match"
                            ? "bindDriver · bindCar"
                            : "行程/代扣 · firstOpDate",
                ])}
                striped
              />

              <H3 style={TYPE.h3}>漏斗通过率</H3>
              <Grid columns={GRID_STATS} gap={12}>
                <ScaleField
                  label="清关通过率"
                  value={p.goLiveCustomsPass ?? 0.98}
                  onChange={(n) => update("goLiveCustomsPass", n)}
                  min={0.7}
                  max={1}
                  step={0.01}
                  display={pct(p.goLiveCustomsPass ?? 0.98)}
                  why="报关材料、完税、查验放行。"
                  effect={`清关掉队约 ${opsFunnel.find((s) => s.id === "customs")?.dropQty ?? 0} 台`}
                  ticks={[
                    { value: 0.9, label: "90%" },
                    { value: 0.95, label: "95%" },
                    { value: 0.98, label: "98%" },
                    { value: 1, label: "100%" },
                  ]}
                />
                <ScaleField
                  label="整备通过率"
                  value={p.goLivePdiPass ?? 0.97}
                  onChange={(n) => update("goLivePdiPass", n)}
                  min={0.7}
                  max={1}
                  step={0.01}
                  display={pct(p.goLivePdiPass ?? 0.97)}
                  why="PDI/上牌；对应平台证件审核。"
                  effect={`整备掉队约 ${opsFunnel.find((s) => s.id === "pdi")?.dropQty ?? 0} 台`}
                  ticks={[
                    { value: 0.9, label: "90%" },
                    { value: 0.95, label: "95%" },
                    { value: 0.97, label: "97%" },
                    { value: 1, label: "100%" },
                  ]}
                />
                <ScaleField
                  label="匹配通过率"
                  value={p.goLiveMatchPass ?? 0.92}
                  onChange={(n) => update("goLiveMatchPass", n)}
                  min={0.5}
                  max={1}
                  step={0.01}
                  display={pct(p.goLiveMatchPass ?? 0.92)}
                  why="司机审核+人车绑定；对应 bindDriver/bindCar。"
                  effect={`匹配掉队约 ${opsFunnel.find((s) => s.id === "match")?.dropQty ?? 0} 台`}
                  ticks={[
                    { value: 0.75, label: "75%" },
                    { value: 0.85, label: "85%" },
                    { value: 0.92, label: "92%" },
                    { value: 1, label: "100%" },
                  ]}
                />
              </Grid>
            </Stack>
          )}

          {opsPane === "schema" && (
            <Stack gap={12}>
              <H3 style={TYPE.h3}>字段底表 · EV × 滴滴 Fleet</H3>
              <Text size="small" tone="secondary">
                《EV数据逻辑梳理》管资产确权（NIV/电池 SN）；Fleet API
                管平台运营身份（customized_car_id / 车牌 / 司机）。二者在「整备上架→匹配→上路」汇合。
              </Text>
              <Table
                headers={[
                  "域",
                  "EV 字段",
                  "中文",
                  "滴滴字段",
                  "接口",
                  "漏斗节点",
                  "必填侧",
                  "说明",
                ]}
                columnAlign={[
                  "left",
                  "left",
                  "left",
                  "left",
                  "left",
                  "left",
                  "left",
                  "left",
                ]}
                rows={DIDI_FLEET_BASE.fieldMap.map((r) => [
                  r.domainZh,
                  r.evField,
                  r.evLabelZh,
                  r.didiField,
                  r.didiApi,
                  r.opsNode,
                  r.required === "ev"
                    ? "EV"
                    : r.required === "didi"
                      ? "滴滴"
                      : r.required === "both"
                        ? "双方"
                        : "任一",
                  r.noteZh,
                ])}
                striped
              />
              <Text size="small" tone="tertiary">
                资产卡 identity 已扩展滴滴字段槽（customizedCarId、审核状态、司机状态等），在「组合」补录；未来回调
                VEHICLE/DRIVER_STATUS_UPDATE 可回写状态。
              </Text>
            </Stack>
          )}

          {opsPane === "api" && (
            <Stack gap={12}>
              <H3 style={TYPE.h3}>接口目录</H3>
              <Text size="small" tone="secondary">
                {DIDI_FLEET_BASE.docTitleZh} · asOf {DIDI_FLEET_BASE.asOf} · Staging{" "}
                {DIDI_FLEET_BASE.stagingHost} · Prod {DIDI_FLEET_BASE.prodHost}
              </Text>
              <Text size="small" tone="tertiary">
                回调事件：{DIDI_FLEET_BASE.callbacks.join(" · ")}。鉴权
                DIDI-AUTH-SHA256；金额多为 MXN 分。本页仅底表，不发起请求。
              </Text>
              <Table
                headers={["分组", "方法", "路径", "功能", "运营含义"]}
                columnAlign={["left", "left", "left", "left", "left"]}
                rows={DIDI_FLEET_BASE.apis.map((a) => [
                  a.groupZh,
                  a.method,
                  a.path,
                  a.titleZh,
                  a.opsHintZh,
                ])}
                striped
              />
            </Stack>
          )}

          <Text size="small" tone="tertiary">
            与「组合爬坡/达产」的区别：本页管单车何时上路、剩多少台能运营、平台字段如何对齐；达产管上路后车队负荷爬到稳态。
          </Text>
        </Stack>
      )}

      {tab === "related" && (
        <Stack gap={16}>
          <PageIntro
            title={pageMeta.related!.title}
            description={pageMeta.related!.description}
          />
          <Text tone="secondary" size="small">
            场站 SPV 持桩，车辆 SPV 持车。内部充电与优先充电权可在合并时抵消。
          </Text>

          <Card>
            <CardHeader>关联交易开关</CardHeader>
            <CardBody>
              <Stack gap={12}>
                <Row gap={12} align="center">
                  <Text>启用关联交易定价</Text>
                  <Toggle
                    checked={p.relatedEnabled}
                    onChange={(v) => update("relatedEnabled", v)}
                  />
                </Row>
                <Row gap={12} align="center">
                  <Text>合并抵消内部充电</Text>
                  <Toggle
                    checked={p.eliminateInternal}
                    onChange={(v) => update("eliminateInternal", v)}
                  />
                </Row>
                <Grid columns={GRID_STATS} gap={12}>
                  <NumField
                    label="优先场站充电占比"
                    value={p.priorityChargePct}
                    onChange={(n) => update("priorityChargePct", n)}
                    hint="车辆电量中走内部价的比例"
                  />
                  <NumField
                    label="内部充电价 MXN/kWh"
                    value={p.internalPriceMxn}
                    onChange={(n) => update("internalPriceMxn", n)}
                    mxnFx={fx} displayCcy={ccy}
                  />
                  <NumField
                    label="关联车位租金 MXN/台/月"
                    value={p.relatedParkingMxn}
                    onChange={(n) => update("relatedParkingMxn", n)}
                    mxnFx={fx} displayCcy={ccy}
                    hint="车辆SPV → 场站SPV"
                  />
                </Grid>
              </Stack>
            </CardBody>
          </Card>

          <Table
            headers={["交易项", "支付方", "收款方", "定价", "说明"]}
            rows={[
              [
                "场站充电（优先）",
                "车辆运营SPV",
                "场站运营SPV",
                moneyMxn(p.internalPriceMxn, fx, ccy, 2),
                `优先占比 ${pct(p.priorityChargePct)}；对外 ${moneyMxn(p.externalPriceMxn, fx, ccy, 2)}`,
              ],
              [
                "长期车位/优先桩位",
                "车辆运营SPV",
                "场站运营SPV",
                moneyMxn(p.relatedParkingMxn, fx, ccy),
                "原表内部车位 280 vs 外部 800 MXN",
              ],
              [
                "对外公共充电",
                "第三方车主",
                "场站运营SPV",
                moneyMxn(p.externalPriceMxn, fx, ccy, 2),
                `利用率 ${pct(p.externalUtil)}；小桔分成 ${pct(p.xiaojufenPct)}`,
              ],
            ]}
          />

          <H3 style={TYPE.h3}>各年关联充电规模（场站侧，抵消前）</H3>
          <BarChart
            categories={model.rows.map((r) => r.label)}
            series={[
              {
                name: "关联充电收入",
                data: model.rows.map((r) => chartVal(r.relatedCharge)),
                tone: CHART_BW,
              },
              {
                name: "合并抵消额",
                data: model.rows.map((r) => chartVal(r.eliminated)),
                tone: "neutral",
              },
            ]}
            height={220}
          />
          <Text size="small" tone="secondary">
            抵消后只保留场站购电成本与对外充电毛利。关闭抵消可看 SPV 单体加总（含内部虚增）。
          </Text>

          <Text size="small" tone="tertiary">
            原桩表约 20% 内部利用率；车辆表按电耗×内部价。开启关联后，以车队需求校准内部充电量，并与枪利用率取较大值。
          </Text>
        </Stack>
      )}

      <Divider />
      <Row gap={8} align="center" wrap>
        <Text size="small" tone="tertiary">
          {ccyLabel(ccy)} · FX {fx} · DAE / RTO / LTO
        </Text>
        {renderSourceCites([
          "fenbang-station-xlsx",
          "fenbang-dae-xlsx",
          "fenbang-lto-xlsx",
          "ev-logic-docx",
        ])}
      </Row>
      </Stack>
    </Stack>
  );
}
