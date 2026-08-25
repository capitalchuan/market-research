import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart,
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
  H3,
  IconButton,
  Pill,
  Row,
  Spacer,
  Stack,
  Stat,
  Table,
  Text,
  TextInput,
  useCanvasState,
  useHostTheme,
} from "cursor/canvas";

/**
 * 跨境保函项下转贷测算（多国可配）
 *
 * 公式对齐桌面《保函测算菲律宾 2.xlsx》：
 * 离岸美元存款 + 利息前置 → 保函面额 → 本币贷款（折扣、覆盖本息）→ 转贷息差折回美元。
 * 定价横梁：存款价格、保函手续费、贷款价格、转贷价格、保函折扣率、本币保证金、货币对政策利率差。
 * 菲律宾 = 表内已谈妥报价；尼日利亚 = CBN 2026-06 各银行 prime/max 贷款价（AbokiForex 信源）；其余国家 = 宏观政策利率 + 菲律宾点差外推。
 */

type CountryId = "PH" | "NG" | "ID" | "MX" | "KE";

type CountryPreset = {
  id: CountryId;
  nameZh: string;
  ccy: string;
  ccyName: string;
  regulator: string;
  quoted: boolean;
  depositUsd: number;
  depositRatePct: number;
  depositDays: number;
  guaranteeFeePct: number;
  loanRatePct: number;
  loanDays: number;
  fx: number;
  discountPct: number;
  onlendPct: number;
  localPolicyPct: number;
  usdPolicyPct: number;
  fxVolHint: string;
  asOf: string;
  loanNote: string;
  /** 本币保证金 = 转贷金额 × 比例；在当地行议定较好存款利率 */
  marginPct: number;
  localDepositRatePct: number;
  /** 保证金存款利息预扣/最终税率 %（国别默认，可改） */
  marginInterestTaxPct: number;
};

/** 菲律宾表内点差：贷款−政策 = 1.45pp；转贷−贷款 = 5.80pp。外推国沿用，并标明待报价。 */
const PH_LOAN_OVER_POLICY = 1.45;
const PH_ONLEND_OVER_LOAN = 5.8;
const USD_POLICY = 3.75; // TE 美国政策利率 2026-07
const HK_DEPOSIT = 4.5; // 表内保函存款美元报价（历史香港行报价）
const GUARANTEE_FEE = 0.9; // 全额质押 0.8–1.0% 取中
const DISCOUNT = 250;

/** AbokiForex 转载 CBN Money Market Indicators · 2026-06 分项 prime/max 贷款价 */
const NG_CBN_LENDING_SOURCE = {
  label: "AbokiForex · CBN Money Market Indicators",
  url: "https://abokiforex.app/show-news/1721555-access-uba-zenith-banks-lending-rates-customers-drop-cbn-release-figures",
  published: "2026-07-27",
  dataMonth: "2026-06",
  avgMaxLendingPct: 33.16,
  mprPct: 26.5,
};

type NgLoanTier = "prime" | "max";

type NgBankQuote = {
  id: string;
  name: string;
  primePct: number;
  maxPct: number;
  merchant?: boolean;
};

const NG_BANK_QUOTES: NgBankQuote[] = [
  { id: "access", name: "Access Bank", primePct: 25.5, maxPct: 32 },
  { id: "alpha-morgan", name: "Alpha Morgan Bank", primePct: 27, maxPct: 33, merchant: true },
  { id: "citi", name: "Citi Bank", primePct: 19, maxPct: 20 },
  { id: "coronation", name: "Coronation Merchant Bank", primePct: 25, maxPct: 28, merchant: true },
  { id: "ecobank", name: "Ecobank", primePct: 26.75, maxPct: 48 },
  { id: "quest", name: "Quest Merchant Bank", primePct: 5, maxPct: 32.5, merchant: true },
  { id: "fcmb", name: "FCMB", primePct: 31, maxPct: 46 },
  { id: "fidelity", name: "Fidelity Bank", primePct: 30, maxPct: 36 },
  { id: "firstbank", name: "First Bank of Nigeria", primePct: 26, maxPct: 38 },
  { id: "fsdh", name: "FSDH Merchant Bank", primePct: 22, maxPct: 33, merchant: true },
  { id: "globus", name: "Globus Bank", primePct: 28.5, maxPct: 33 },
  { id: "greenwich", name: "Greenwich Merchant Bank", primePct: 23.6, maxPct: 29.5, merchant: true },
  { id: "gtb", name: "Guaranty Trust Bank", primePct: 21, maxPct: 32 },
  { id: "keystone", name: "Keystone Bank", primePct: 30.5, maxPct: 36 },
  { id: "nova", name: "Nova Bank", primePct: 33.78, maxPct: 39 },
  { id: "optimus", name: "Optimus Bank", primePct: 28.5, maxPct: 35 },
  { id: "parallex", name: "Parallex Bank", primePct: 30, maxPct: 32.5 },
  { id: "polaris", name: "Polaris Bank", primePct: 29, maxPct: 41 },
  { id: "premium-trust", name: "Premium Trust Bank", primePct: 28, maxPct: 36 },
  { id: "providus", name: "Providus Bank", primePct: 26.5, maxPct: 35 },
  { id: "rmb", name: "Rand Merchant Bank Nigeria", primePct: 19.5, maxPct: 19.5, merchant: true },
  { id: "stanbic", name: "Stanbic IBTC", primePct: 1, maxPct: 60 },
  { id: "scb", name: "Standard Chartered Bank", primePct: 27, maxPct: 29 },
  { id: "sterling", name: "Sterling Bank", primePct: 26, maxPct: 33.5 },
  { id: "suntrust", name: "SunTrust Bank", primePct: 22, maxPct: 37 },
  { id: "tatum", name: "Tatum Bank", primePct: 41.65, maxPct: 46.65 },
  { id: "uba", name: "United Bank for Africa", primePct: 28.5, maxPct: 32 },
  { id: "union", name: "Union Bank", primePct: 16.95, maxPct: 38 },
  { id: "unity", name: "Unity Bank", primePct: 30, maxPct: 38 },
  { id: "wema", name: "Wema Bank", primePct: 32.5, maxPct: 34.5 },
  { id: "zenith", name: "Zenith Bank", primePct: 23.62, maxPct: 32 },
];

function ngLoanPct(bank: NgBankQuote, tier: NgLoanTier) {
  return tier === "prime" ? bank.primePct : bank.maxPct;
}

function ngOnlendFromLoan(loanPct: number) {
  return round2(loanPct + PH_ONLEND_OVER_LOAN);
}

function ngRatesMatch(inputs: Inputs, bank: NgBankQuote, tier: NgLoanTier) {
  const loan = ngLoanPct(bank, tier);
  const onlend = ngOnlendFromLoan(loan);
  return (
    Math.abs(inputs.loanRatePct - loan) < 0.015 &&
    Math.abs(inputs.onlendPct - onlend) < 0.015
  );
}

/** 同一贷款行：保证金存款利率应低于贷款价格 */
const LOCAL_DEP_LOAN_MIN_SPREAD_PP = 2;

type LocalDepLoanCheck = {
  applies: boolean;
  inverted: boolean;
  tight: boolean;
  spreadPp: number;
};

function localBankDepositCheck(inputs: Inputs): LocalDepLoanCheck {
  const spreadPp = inputs.loanRatePct - inputs.localDepositRatePct;
  const applies = inputs.marginPct > 0;
  return {
    applies,
    inverted: applies && spreadPp <= 0,
    tight: applies && spreadPp > 0 && spreadPp < LOCAL_DEP_LOAN_MIN_SPREAD_PP,
    spreadPp,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function inferredLoan(policy: number) {
  return round2(policy + PH_LOAN_OVER_POLICY);
}
function inferredOnlend(loan: number) {
  return round2(loan + PH_ONLEND_OVER_LOAN);
}

const PRESETS: Record<CountryId, CountryPreset> = {
  PH: {
    id: "PH",
    nameZh: "菲律宾",
    ccy: "PHP",
    ccyName: "比索",
    regulator: "BSP",
    quoted: true,
    depositUsd: 100,
    depositRatePct: HK_DEPOSIT,
    depositDays: 365,
    guaranteeFeePct: GUARANTEE_FEE,
    loanRatePct: 6.2,
    loanDays: 360,
    fx: 60,
    discountPct: DISCOUNT,
    onlendPct: 12,
    localPolicyPct: 4.75,
    usdPolicyPct: USD_POLICY,
    fxVolHint: "±3.5% · USD/PHP 年内高低/均价",
    asOf: "Excel 已谈妥 · 宏观 TE/BSP 2026-06/08",
    loanNote:
      "优质中资客户保函项下最优谈妥利率（比索年化）。挂钩汇率 60 为表内 BSP 中间价口径；TE 约 60.67（2026-08）。",
    marginPct: 25,
    localDepositRatePct: 5,
    /** BSP 比索存款利息最终预扣税常见 20% · 待当地核验 */
    marginInterestTaxPct: 20,
  },
  NG: {
    id: "NG",
    nameZh: "尼日利亚",
    ccy: "NGN",
    ccyName: "奈拉",
    regulator: "CBN",
    quoted: false,
    depositUsd: 100,
    depositRatePct: HK_DEPOSIT,
    depositDays: 365,
    guaranteeFeePct: GUARANTEE_FEE,
    loanRatePct: ngLoanPct(NG_BANK_QUOTES.find((b) => b.id === "uba")!, "prime"),
    loanDays: 360,
    fx: 1362,
    discountPct: DISCOUNT,
    onlendPct: ngOnlendFromLoan(ngLoanPct(NG_BANK_QUOTES.find((b) => b.id === "uba")!, "prime")),
    localPolicyPct: 26.5,
    usdPolicyPct: USD_POLICY,
    fxVolHint: "±6.7% · USD/NGN 年内高低/均价",
    asOf: `CBN 分项贷款价 · ${NG_CBN_LENDING_SOURCE.dataMonth} · AbokiForex`,
    loanNote:
      "贷款价取自 CBN Money Market Indicators 2026-06 各银行 prime/max 分项（AbokiForex 转载）。转贷默认 = 贷款 + 5.80pp（菲律宾表内点差，可改）。美元侧仍用保函存款报价；CBN 该表为贷款价分项，不含各行本币吸储报价。",
    marginPct: 25,
    localDepositRatePct: 22,
    /** 尼日利亚存款利息 WHT 常见 10% · 待当地核验 */
    marginInterestTaxPct: 10,
  },
  ID: {
    id: "ID",
    nameZh: "印尼",
    ccy: "IDR",
    ccyName: "盾",
    regulator: "BI",
    quoted: false,
    depositUsd: 100,
    depositRatePct: HK_DEPOSIT,
    depositDays: 365,
    guaranteeFeePct: GUARANTEE_FEE,
    loanRatePct: inferredLoan(5.75),
    loanDays: 360,
    fx: 17916,
    discountPct: DISCOUNT,
    onlendPct: inferredOnlend(inferredLoan(5.75)),
    localPolicyPct: 5.75,
    usdPolicyPct: USD_POLICY,
    fxVolHint: "±2.6% · USD/IDR 年内高低/均价",
    asOf: "待当地报价 · 宏观 TE 2026-07/08",
    loanNote: "BI 政策利率 5.75% + 菲律宾点差外推。汇率 TE 约 17,916（2026-08）。",
    marginPct: 25,
    localDepositRatePct: 5.25,
    /** 印尼存款利息最终税 PPh 4(2) 常见 20% · 待当地核验 */
    marginInterestTaxPct: 20,
  },
  MX: {
    id: "MX",
    nameZh: "墨西哥",
    ccy: "MXN",
    ccyName: "比索",
    regulator: "Banxico",
    quoted: false,
    depositUsd: 100,
    depositRatePct: HK_DEPOSIT,
    depositDays: 365,
    guaranteeFeePct: GUARANTEE_FEE,
    loanRatePct: inferredLoan(6.5),
    loanDays: 360,
    fx: 17.25,
    discountPct: DISCOUNT,
    onlendPct: inferredOnlend(inferredLoan(6.5)),
    localPolicyPct: 6.5,
    usdPolicyPct: USD_POLICY,
    fxVolHint: "±8% · USD/MXN 年内高低/均价",
    asOf: "待当地报价 · 宏观 TE 2026-06/08",
    loanNote: "Banxico 6.5% + 菲律宾点差外推。汇率 TE 约 17.25（2026-08）。",
    marginPct: 25,
    localDepositRatePct: 6,
    /** 墨西哥存款利息 ISR 预扣近似 15% · 待当地核验 */
    marginInterestTaxPct: 15,
  },
  KE: {
    id: "KE",
    nameZh: "肯尼亚",
    ccy: "KES",
    ccyName: "先令",
    regulator: "CBK",
    quoted: false,
    depositUsd: 100,
    depositRatePct: HK_DEPOSIT,
    depositDays: 365,
    guaranteeFeePct: GUARANTEE_FEE,
    loanRatePct: inferredLoan(8.75),
    loanDays: 360,
    fx: 129,
    discountPct: DISCOUNT,
    onlendPct: inferredOnlend(inferredLoan(8.75)),
    localPolicyPct: 8.75,
    usdPolicyPct: USD_POLICY,
    fxVolHint: "±0.6% · USD/KES 年内高低/均价",
    asOf: "待当地报价 · 宏观 TE 2026-06/08",
    loanNote: "CBK 8.75% + 菲律宾点差外推。汇率 TE 约 129（2026-08）。",
    marginPct: 25,
    localDepositRatePct: 8,
    /** 肯尼亚存款利息 WHT 常见 15% · 待当地核验 */
    marginInterestTaxPct: 15,
  },
};

type Inputs = {
  countryId: CountryId;
  depositUsd: number;
  depositRatePct: number;
  depositDays: number;
  guaranteeFeePct: number;
  loanRatePct: number;
  loanDays: number;
  fx: number;
  discountPct: number;
  onlendPct: number;
  localPolicyPct: number;
  usdPolicyPct: number;
  fxShockPct: number;
  marginPct: number;
  localDepositRatePct: number;
  /** 保证金存款利息预扣/最终税率 % */
  marginInterestTaxPct: number;
  /** CHUAN 占 JV 股权 %；本币存款端收益仅按此比例计入 CHUAN 口径 */
  chuanJvPct: number;
};

function jvShareOf(i: Inputs) {
  return Math.max(0, Math.min(100, i.chuanJvPct ?? 70)) / 100;
}

/** 预设收益率反推：含 JV 时存款端 × 股权；不含时只计美元侧 + 本币贷款端 */
function jvShareForTarget(i: Inputs, includeJvDeposit: boolean) {
  return includeJvDeposit ? jvShareOf(i) : 0;
}

function chuanMergeMetrics(
  calc: Calc,
  inputs: Inputs,
  includeJv: boolean,
  shocked = false,
) {
  const depositUsd = Math.max(inputs.depositUsd, 1e-9);
  const jvShare = includeJv ? jvShareOf(inputs) : 0;
  const spreadUsd = shocked ? calc.spreadUsdShock : calc.spreadUsdSpot;
  const marginChuanUsd =
    (shocked ? calc.marginInterestUsdShock : calc.marginInterestUsd) * jvShare;
  const netUsd =
    calc.depositInterestUsd +
    spreadUsd +
    marginChuanUsd -
    calc.guaranteeFeeUsd;
  return {
    netUsd,
    yieldPct: netUsd / depositUsd,
    usdLegUsd: calc.usdLegNetUsd,
    localUsd: spreadUsd + marginChuanUsd,
    marginChuanUsd,
    spreadUsd,
    suffix: includeJv ? "含 JV" : "不含 JV",
  };
}

function fromPreset(p: CountryPreset): Inputs {
  return {
    countryId: p.id,
    depositUsd: p.depositUsd,
    depositRatePct: p.depositRatePct,
    depositDays: p.depositDays,
    guaranteeFeePct: p.guaranteeFeePct,
    loanRatePct: p.loanRatePct,
    loanDays: p.loanDays,
    fx: p.fx,
    discountPct: p.discountPct,
    onlendPct: p.onlendPct,
    localPolicyPct: p.localPolicyPct,
    usdPolicyPct: p.usdPolicyPct,
    fxShockPct: 0,
    marginPct: p.marginPct,
    localDepositRatePct: p.localDepositRatePct,
    marginInterestTaxPct: p.marginInterestTaxPct,
    chuanJvPct: 70,
  };
}

function pct(n: number, d = 2) {
  return `${n.toFixed(d)}%`;
}
function num(n: number, d = 2) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

const CCY_SYMBOL: Record<CountryId, string> = {
  PH: "₱",
  NG: "₦",
  ID: "Rp",
  MX: "MX$",
  KE: "KSh",
};

/** open.er-api.com · USD 基准即期（无 key） */
const FX_SPOT_API = "https://open.er-api.com/v6/latest/USD";

function roundFxSpot(fx: number, id: CountryId) {
  if (id === "ID" || id === "NG" || id === "KE") return Math.round(fx);
  return round2(fx);
}

async function fetchSpotFx(localCcy: string): Promise<number> {
  const res = await fetch(FX_SPOT_API);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as {
    result?: string;
    rates?: Record<string, number>;
  };
  if (data.result !== "success" || !data.rates) {
    throw new Error("汇率接口返回异常");
  }
  const rate = data.rates[localCcy];
  if (!rate || !Number.isFinite(rate)) {
    throw new Error(`暂无 ${localCcy}/USD 即期`);
  }
  return rate;
}

/** 顶栏 Stat：货币符号 + 万/亿，避免「万奈拉」换行 */
function formatLocalWanStat(wan: number, id: CountryId) {
  const sym = CCY_SYMBOL[id];
  const a = Math.abs(wan);
  if (a >= 10000) return `${sym}${(wan / 10000).toFixed(2)}亿`;
  if (a >= 100) return `${sym}${Math.round(wan).toLocaleString("en-US")}万`;
  return `${sym}${wan.toFixed(2)}万`;
}

function formatUsdWanStat(wanUsd: number) {
  const usd = wanUsd * 10000;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 10_000) return `$${(usd / 1000).toFixed(1)}k`;
  return `$${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

type IncomeLegKey = "usd" | "deposit" | "loan";

function incomeLegColor(
  theme: ReturnType<typeof useHostTheme>,
  leg: IncomeLegKey,
): string {
  switch (leg) {
    case "usd":
      return theme.accent.primary;
    case "deposit":
      return theme.palette.diffStripAdded;
    case "loan":
      return theme.text.secondary;
  }
}

function StatValue({
  children,
  color,
  size = "large",
}: {
  children: string;
  color?: string;
  size?: "large" | "medium";
}) {
  return (
    <Text
      as="span"
      weight="semibold"
      style={{
        fontSize: size === "large" ? 28 : 22,
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        ...(color ? { color } : {}),
      }}
    >
      {children}
    </Text>
  );
}

function pieSlicePath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
) {
  const sweep = endDeg - startDeg;
  if (sweep >= 359.99) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
  }
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

/** CHUAN 净收益 · 美元侧 / 本币存款端 / 本币贷款端 三端占比（折美元） */
function IncomeLegMiniPie({
  usdLegUsd,
  marginUsd,
  spreadUsd,
  localCcy,
}: {
  usdLegUsd: number;
  marginUsd: number;
  spreadUsd: number;
  localCcy: string;
}) {
  const theme = useHostTheme();
  const slices = (
    [
      {
        key: "usd" as const,
        label: "美元侧 · 保函存款",
        value: Math.max(0, usdLegUsd),
      },
      {
        key: "deposit" as const,
        label: `本币存款端 · ${localCcy} · JV`,
        value: Math.max(0, marginUsd),
      },
      {
        key: "loan" as const,
        label: `本币贷款端 · ${localCcy}`,
        value: Math.max(0, spreadUsd),
      },
    ] as const
  )
    .map((s) => ({ ...s, fill: incomeLegColor(theme, s.key) }))
    .filter((s) => s.value > 1e-6);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total < 1e-6) return null;

  const size = 52;
  const r = size / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  let angle = 0;
  const titleParts = slices.map(
    (s) => `${s.label} ${Math.round((s.value / total) * 100)}%`,
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={titleParts.join(" · ")}
      style={{ flexShrink: 0 }}
    >
      <title>{titleParts.join("\n")}</title>
      {slices.map((slice) => {
        const sweep = (slice.value / total) * 360;
        const start = angle;
        angle += sweep;
        if (sweep < 1e-6) return null;
        return (
          <path
            key={slice.key}
            d={pieSlicePath(cx, cy, r, start, start + sweep)}
            fill={slice.fill}
          />
        );
      })}
    </svg>
  );
}

function formatUsdDepositPrincipal(depositUsdWan: number) {
  return formatUsdWanStat(depositUsdWan);
}

function LegKpiColumn({
  leg,
  title,
  principal,
  principalLabel,
  principalUsd,
  income,
  incomeUsd,
  incomeLabel = "净收益",
  yieldPct,
}: {
  leg: IncomeLegKey;
  title: string;
  principal: string;
  principalLabel: string;
  /** 本币本金旁展示折美元 */
  principalUsd?: string;
  income: string;
  /** 本币净收益旁展示折美元（万美元 Stat 格式） */
  incomeUsd?: string;
  incomeLabel?: string;
  yieldPct: number | null;
}) {
  const theme = useHostTheme();
  const color = incomeLegColor(theme, leg);

  return (
    <Stack gap={10}>
      <Text weight="semibold" style={{ color }}>
        {title}
      </Text>
      <Stat
        value={
          principalUsd && principal !== "—" ? (
            <Row gap={10} align="baseline" wrap>
              <StatValue color={color}>{principal}</StatValue>
              <Text size="small" tone="tertiary">
                ≈ {principalUsd}
              </Text>
            </Row>
          ) : (
            <StatValue color={color}>{principal}</StatValue>
          )
        }
        label={principalLabel}
      />
      <Stat
        value={
          incomeUsd && income !== "—" ? (
            <Row gap={10} align="baseline" wrap>
              <StatValue color={color}>{income}</StatValue>
              <Text size="small" tone="tertiary">
                ≈ {incomeUsd}
              </Text>
            </Row>
          ) : (
            <StatValue color={color}>{income}</StatValue>
          )
        }
        label={incomeLabel}
      />
      <Stat
        value={
          yieldPct != null ? (
            <StatValue color={color} size="medium">
              {pct(yieldPct * 100, 2)}
            </StatValue>
          ) : (
            "—"
          )
        }
        label={`当期收益率 · ÷ ${principalLabel}`}
      />
    </Stack>
  );
}

function parseNum(raw: string, fallback: number) {
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

type Calc = {
  depositInterestUsd: number;
  guaranteeUsd: number;
  guaranteeFeeUsd: number;
  loanLocal: number;
  onlendInterestLocal: number;
  loanInterestLocal: number;
  spreadLocal: number;
  spreadUsdSpot: number;
  spreadUsdShock: number;
  /** 保证金 = 转贷金额 × 比例 */
  marginLocal: number;
  /** 保证金利息毛额（税前） */
  marginInterestGrossLocal: number;
  /** 保证金利息税 */
  marginInterestTaxLocal: number;
  /** 保证金利息净额（扣税后） */
  marginInterestLocal: number;
  marginInterestUsd: number;
  marginInterestUsdShock: number;
  /** 转贷息差 + 保证金存款利息 */
  localLegNetLocal: number;
  localLegNetUsd: number;
  localLegNetUsdShock: number;
  usdYield: number;
  usdYieldShock: number;
  /** 全折美元净收益（三端 100% 折回） */
  netUsdFull: number;
  /** 全折美元收益率 ÷ CHUAN 保函存款本金（本币存款端 100% 计入） */
  usdYieldFull: number;
  marginInterestUsdChuan: number;
  netUsdChuan: number;
  usdYieldChuan: number;
  usdYieldChuanShock: number;
  chuanJvShare: number;
  /** 美元侧：存款利息 − 保函费（本币侧未折入） */
  usdLegNetUsd: number;
  usdLegYield: number;
  /** 本币存款端 / 保证金本金（当期） */
  localDepositLegYield: number;
  /** 本币贷款端 / 助贷本金（当期） */
  localLoanLegYield: number;
  /** 贷款金额 = 转贷金额；折美元仅用于对照 */
  loanPrincipalUsd: number;
  depositCarry: number;
  feeDrag: number;
  spreadContrib: number;
  onlendGrossUsd: number;
  loanCostUsd: number;
  onlendGrossContrib: number;
  loanCostContrib: number;
  pairDiff: number;
  loanOverPolicy: number;
  onlendOverLoan: number;
  excessVsDeposit: number;
  excessVsUsdPolicy: number;
  excessVsPairDiff: number;
  /** 本币高利率会吃掉保函可支撑的美元本金 */
  principalHaircutVsPh: number;
};

function compute(i: Inputs): Calc {
  const depR = i.depositRatePct / 100;
  const feeR = i.guaranteeFeePct / 100;
  const loanR = i.loanRatePct / 100;
  const onlendR = i.onlendPct / 100;
  const disc = i.discountPct / 100;
  const marginR = Math.max(i.marginPct, 0) / 100;
  const localDepR = Math.max(i.localDepositRatePct, 0) / 100;
  const fx = Math.max(i.fx, 1e-9);
  const shockFx = fx * (1 + i.fxShockPct / 100);

  const depositInterestUsd = (i.depositUsd * depR * i.depositDays) / 360;
  const guaranteeUsd = i.depositUsd + depositInterestUsd;
  const guaranteeFeeUsd = guaranteeUsd * feeR;
  const loanLocal =
    (guaranteeUsd * disc * fx) / (1 + (loanR * i.loanDays) / 365);
  const onlendInterestLocal = (loanLocal * onlendR * i.loanDays) / 360;
  const loanInterestLocal = (loanLocal * loanR * i.loanDays) / 360;
  const spreadLocal = onlendInterestLocal - loanInterestLocal;
  const marginLocal = loanLocal * marginR;
  const taxR =
    Math.max(
      i.marginInterestTaxPct ??
        PRESETS[i.countryId]?.marginInterestTaxPct ??
        0,
      0,
    ) / 100;
  const marginInterestGrossLocal =
    (marginLocal * localDepR * i.loanDays) / 360;
  const marginInterestTaxLocal = marginInterestGrossLocal * taxR;
  const marginInterestLocal =
    marginInterestGrossLocal - marginInterestTaxLocal;
  const localLegNetLocal = spreadLocal + marginInterestLocal;
  const spreadUsdSpot = spreadLocal / fx;
  const spreadUsdShock = spreadLocal / shockFx;
  const marginInterestUsd = marginInterestLocal / fx;
  const marginInterestUsdShock = marginInterestLocal / shockFx;
  const localLegNetUsd = localLegNetLocal / fx;
  const localLegNetUsdShock = localLegNetLocal / shockFx;
  const onlendGrossUsd = onlendInterestLocal / fx;
  const loanCostUsd = loanInterestLocal / fx;
  const netUsdFull =
    depositInterestUsd + localLegNetUsd - guaranteeFeeUsd;
  const netUsdShock =
    depositInterestUsd + localLegNetUsdShock - guaranteeFeeUsd;
  const jvShare = jvShareOf(i);
  const marginInterestUsdChuan = marginInterestUsd * jvShare;
  const marginInterestUsdChuanShock = marginInterestUsdShock * jvShare;
  const netUsdChuan =
    depositInterestUsd +
    spreadUsdSpot +
    marginInterestUsdChuan -
    guaranteeFeeUsd;
  const netUsdChuanShock =
    depositInterestUsd +
    spreadUsdShock +
    marginInterestUsdChuanShock -
    guaranteeFeeUsd;
  const usdLegNetUsd = depositInterestUsd - guaranteeFeeUsd;
  const usdYieldFull = i.depositUsd > 0 ? netUsdFull / i.depositUsd : 0;
  const usdYield = usdYieldFull;
  const usdYieldShock = i.depositUsd > 0 ? netUsdShock / i.depositUsd : 0;
  const usdYieldChuan = i.depositUsd > 0 ? netUsdChuan / i.depositUsd : 0;
  const usdYieldChuanShock =
    i.depositUsd > 0 ? netUsdChuanShock / i.depositUsd : 0;
  const usdLegYield = i.depositUsd > 0 ? usdLegNetUsd / i.depositUsd : 0;
  const localDepositLegYield =
    marginLocal > 0 ? marginInterestLocal / marginLocal : 0;
  const localLoanLegYield = loanLocal > 0 ? spreadLocal / loanLocal : 0;
  const loanPrincipalUsd = loanLocal / fx;
  const pairDiff = (i.localPolicyPct - i.usdPolicyPct) / 100;
  const phLoanR = PRESETS.PH.loanRatePct / 100;
  const phLoanLocalUsd =
    (guaranteeUsd * disc) / (1 + (phLoanR * i.loanDays) / 365);
  const thisLoanUsd = loanLocal / fx;
  const principalHaircutVsPh =
    phLoanLocalUsd > 0 ? 1 - thisLoanUsd / phLoanLocalUsd : 0;

  return {
    depositInterestUsd,
    guaranteeUsd,
    guaranteeFeeUsd,
    loanLocal,
    onlendInterestLocal,
    loanInterestLocal,
    spreadLocal,
    spreadUsdSpot,
    spreadUsdShock,
    marginLocal,
    marginInterestGrossLocal,
    marginInterestTaxLocal,
    marginInterestLocal,
    marginInterestUsd,
    marginInterestUsdShock,
    localLegNetLocal,
    localLegNetUsd,
    localLegNetUsdShock,
    netUsdFull,
    usdYield,
    usdYieldShock,
    usdYieldFull,
    marginInterestUsdChuan,
    netUsdChuan,
    usdYieldChuan,
    usdYieldChuanShock,
    chuanJvShare: jvShare,
    usdLegNetUsd,
    usdLegYield,
    localDepositLegYield,
    localLoanLegYield,
    loanPrincipalUsd,
    depositCarry: i.depositUsd > 0 ? depositInterestUsd / i.depositUsd : 0,
    feeDrag: i.depositUsd > 0 ? guaranteeFeeUsd / i.depositUsd : 0,
    spreadContrib: i.depositUsd > 0 ? localLegNetUsd / i.depositUsd : 0,
    onlendGrossUsd,
    loanCostUsd,
    onlendGrossContrib: i.depositUsd > 0 ? onlendGrossUsd / i.depositUsd : 0,
    loanCostContrib: i.depositUsd > 0 ? loanCostUsd / i.depositUsd : 0,
    pairDiff,
    loanOverPolicy: (i.loanRatePct - i.localPolicyPct) / 100,
    onlendOverLoan: (i.onlendPct - i.loanRatePct) / 100,
    excessVsDeposit: usdYieldChuan - depR,
    excessVsUsdPolicy: usdYieldChuan - i.usdPolicyPct / 100,
    excessVsPairDiff: usdYieldChuan - pairDiff,
    principalHaircutVsPh,
  };
}

function presetCalc(id: CountryId) {
  return compute(fromPreset(PRESETS[id]));
}

/** 菲律宾表内 C19，作跨国外报价的美元门槛默认值 */
const PH_EXCEL_YIELD_PCT = 9.0508;
const TARGET_YIELD_STEP = 0.25;
const TARGET_YIELD_MAX = 50;

type ImpliedQuote = {
  impliedOnlendPct: number;
  neededSpreadUsd: number;
  loanUsd: number;
  nimPct: number;
  floorUsdYieldPct: number;
};

/**
 * 锁 CHUAN 综合收益率，反解本币对外转贷报价（年化）。
 * 贷款价格、保函费、折扣、天数不动：报价只覆盖「还差多少息差折美元」。
 */
function invertOnlendPct(
  i: Inputs,
  targetYieldPct: number,
  includeJvDeposit = true,
): ImpliedQuote | null {
  const depR = i.depositRatePct / 100;
  const feeR = i.guaranteeFeePct / 100;
  const loanR = i.loanRatePct / 100;
  const disc = i.discountPct / 100;
  const marginR = Math.max(i.marginPct, 0) / 100;
  const localDepR = Math.max(i.localDepositRatePct, 0) / 100;
  const fx = Math.max(i.fx, 1e-9);
  const depositInterestUsd = (i.depositUsd * depR * i.depositDays) / 360;
  const guaranteeUsd = i.depositUsd + depositInterestUsd;
  const guaranteeFeeUsd = guaranteeUsd * feeR;
  const loanLocal =
    (guaranteeUsd * disc * fx) / (1 + (loanR * i.loanDays) / 365);
  const marginLocal = loanLocal * marginR;
  const taxR =
    Math.max(
      i.marginInterestTaxPct ??
        PRESETS[i.countryId]?.marginInterestTaxPct ??
        0,
      0,
    ) / 100;
  const marginInterestUsd =
    ((marginLocal * localDepR * i.loanDays) / 360) * (1 - taxR) / fx;
  const jvShare = jvShareForTarget(i, includeJvDeposit);
  const marginInterestUsdChuan = marginInterestUsd * jvShare;
  const loanUsd =
    (guaranteeUsd * disc) / (1 + (loanR * i.loanDays) / 365);
  if (loanUsd <= 0 || i.loanDays <= 0 || i.depositUsd <= 0) return null;
  const floorUsdYieldPct =
    ((depositInterestUsd - guaranteeFeeUsd + marginInterestUsdChuan) /
      i.depositUsd) *
    100;
  const neededSpreadUsd =
    (targetYieldPct / 100) * i.depositUsd -
    depositInterestUsd +
    guaranteeFeeUsd -
    marginInterestUsdChuan;
  const impliedOnlend =
    loanR + (neededSpreadUsd * 360) / (loanUsd * i.loanDays);
  return {
    impliedOnlendPct: impliedOnlend * 100,
    neededSpreadUsd,
    loanUsd,
    nimPct: (impliedOnlend - loanR) * 100,
    floorUsdYieldPct,
  };
}

function Field({
  label,
  value,
  onChange,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  hint?: string;
}) {
  return (
    <Stack gap={4}>
      <Text size="small" tone="secondary">
        {label}
        {suffix ? ` · ${suffix}` : ""}
      </Text>
      <TextInput
        type="number"
        value={String(value)}
        onChange={(v) => onChange(parseNum(v, value))}
      />
      {hint ? (
        <Text size="small" tone="tertiary">
          {hint}
        </Text>
      ) : null}
    </Stack>
  );
}

function FxSpotField({
  country,
  value,
  onChange,
  loading,
  error,
  asOf,
  onRefresh,
}: {
  country: CountryPreset;
  value: number;
  onChange: (n: number) => void;
  loading: boolean;
  error: string | null;
  asOf: string | null;
  onRefresh: () => void;
}) {
  return (
    <Stack gap={4}>
      <Row gap={8} align="center" wrap justify="space-between">
        <Text size="small" tone="secondary">
          挂钩汇率 · {country.ccy}/USD
        </Text>
        <Button variant="ghost" size="sm" disabled={loading} onClick={onRefresh}>
          {loading ? "拉取中…" : "实时更新"}
        </Button>
      </Row>
      <TextInput
        type="number"
        value={String(value)}
        onChange={(v) => onChange(parseNum(v, value))}
      />
      <Text size="small" tone="tertiary">
        {asOf
          ? `${asOf} · open.er-api 即期 · 与当地挂钩价冲突时以双端为准`
          : "可手动改；点「实时更新」拉取即期中间价"}
      </Text>
      {error ? (
        <Text size="small" tone="tertiary">
          拉取失败 · {error}
        </Text>
      ) : null}
    </Stack>
  );
}

function StepStat({
  value,
  label,
  onStep,
  step = TARGET_YIELD_STEP,
  min = 0,
  max = TARGET_YIELD_MAX,
  tone,
  formatValue = (v) => pct(v, 2),
  stepUnit = "个百分点",
}: {
  value: number;
  label: string;
  onStep: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
  tone?: "success" | "danger" | "warning" | "info";
  formatValue?: (v: number) => string;
  stepUnit?: string;
}) {
  const bump = (delta: number) => {
    const next = value + delta;
    const clamped = Math.min(max, Math.max(min, next));
    onStep(stepUnit === "个百分点" ? round2(clamped) : Math.round(clamped));
  };

  return (
    <Stat
      tone={tone}
      label={label}
      value={
        <Row gap={6} align="center">
          <StatValue>{formatValue(value)}</StatValue>
          <Stack gap={0}>
            <IconButton
              title={`提高 ${step}${stepUnit}`}
              size="sm"
              onClick={() => bump(step)}
              disabled={value >= max - 1e-9}
            >
              ▲
            </IconButton>
            <IconButton
              title={`降低 ${step}${stepUnit}`}
              size="sm"
              onClick={() => bump(-step)}
              disabled={value <= min + 1e-9}
            >
              ▼
            </IconButton>
          </Stack>
        </Row>
      }
    />
  );
}

type PnlKind = "income" | "cost" | "total";

type PnlStep = {
  label: string;
  sublabel: string;
  basis: string;
  formula: string;
  kind: PnlKind;
  amount: number;
  running: number;
};

function withRunning(
  items: Omit<PnlStep, "running">[],
): PnlStep[] {
  let running = 0;
  return items.map((d) => {
    const step = { ...d, running };
    if (d.kind !== "total") running += d.amount;
    return step;
  });
}

function buildLocalDepositPnlWaterfall(calc: Calc, ccyName: string): PnlStep[] {
  return withRunning([
    {
      label: "保证金利息",
      sublabel: "税前",
      basis:
        calc.marginLocal > 0
          ? `保证金 ${num(calc.marginLocal, 2)} 万${ccyName}`
          : "保证金比例 0",
      formula: "转贷金额 × 保证金比例 × 本币存款利率 × 天数 ÷ 360",
      kind: "income",
      amount: calc.marginInterestGrossLocal,
    },
    {
      label: "利息税",
      sublabel: "预扣/最终税",
      basis: `税前利息 ${num(calc.marginInterestGrossLocal, 2)} 万${ccyName}`,
      formula: "税前利息 × 税率",
      kind: "cost",
      amount: -calc.marginInterestTaxLocal,
    },
    {
      label: "存款端小计",
      sublabel: "扣税后",
      basis: "保证金金额",
      formula: "税前 − 税",
      kind: "total",
      amount: calc.marginInterestLocal,
    },
  ]);
}

function buildLocalLoanPnlWaterfall(calc: Calc, ccyName: string): PnlStep[] {
  return withRunning([
    {
      label: "转贷利息",
      sublabel: "对外转贷价",
      basis: `转贷金额 ${num(calc.loanLocal, 2)} 万${ccyName}`,
      formula: "转贷金额 × 转贷利率 × 天数 ÷ 360",
      kind: "income",
      amount: calc.onlendInterestLocal,
    },
    {
      label: "贷款利息",
      sublabel: "贷款价格",
      basis: `贷款金额 ${num(calc.loanLocal, 2)} 万${ccyName}`,
      formula: "贷款金额 × 贷款利率 × 天数 ÷ 360",
      kind: "cost",
      amount: -calc.loanInterestLocal,
    },
    {
      label: "贷款端小计",
      sublabel: "转贷 − 贷款",
      basis: "转贷金额 = 贷款金额",
      formula: "转贷利息 − 贷款利息",
      kind: "total",
      amount: calc.spreadLocal,
    },
  ]);
}

function buildUsdLegWaterfall(calc: Calc, depositUsd: number): PnlStep[] {
  return withRunning([
    {
      label: "保函存款利息",
      sublabel: "收入",
      basis: `保函存款本金 ${num(depositUsd)} 万美元`,
      formula: "保函存款本金 × 存款利率 × 天数 ÷ 360",
      kind: "income",
      amount: calc.depositInterestUsd,
    },
    {
      label: "保函手续费",
      sublabel: "成本",
      basis: `保函金额 ${num(calc.guaranteeUsd)} 万美元`,
      formula: "保函金额 × 保函费率",
      kind: "cost",
      amount: -calc.guaranteeFeeUsd,
    },
    {
      label: "美元侧小计",
      sublabel: "利息 − 手续费",
      basis: "保函存款本金 / 保函金额",
      formula: "保函存款利息 − 保函手续费",
      kind: "total",
      amount: calc.usdLegNetUsd,
    },
  ]);
}

function buildCombinedUsdWaterfall(calc: Calc, ccyName: string, fx: number): PnlStep[] {
  const flow: Omit<PnlStep, "running">[] = [
    {
      label: "保函存款利息",
      sublabel: "美元侧 · 收入",
      basis: "保函存款本金",
      formula: "保函存款本金 × 存款利率 × 天数 ÷ 360",
      kind: "income",
      amount: calc.depositInterestUsd,
    },
    {
      label: "保函手续费",
      sublabel: "美元侧 · 成本",
      basis: "保函金额",
      formula: "保函金额 × 保函费率",
      kind: "cost",
      amount: -calc.guaranteeFeeUsd,
    },
    {
      label: "本币贷款端",
      sublabel: `息差折美元 · 1=${num(fx, fx >= 100 ? 0 : 2)}`,
      basis: `本币贷款端 ${num(calc.spreadLocal, 2)} 万${ccyName}`,
      formula: "本币贷款端小计 ÷ 挂钩汇率",
      kind: "income",
      amount: calc.spreadUsdSpot,
    },
  ];
  if (calc.marginInterestGrossLocal > 1e-9) {
    const grossUsd = calc.marginInterestGrossLocal / fx;
    const taxUsd = calc.marginInterestTaxLocal / fx;
    flow.push({
      label: "保证金利息",
      sublabel: "税前折美元",
      basis: `税前 ${num(calc.marginInterestGrossLocal, 2)} 万${ccyName}`,
      formula: "税前利息 ÷ 挂钩汇率",
      kind: "income",
      amount: grossUsd,
    });
    if (taxUsd > 1e-9) {
      flow.push({
        label: "利息税",
        sublabel: "扣税折美元",
        basis: `税 ${num(calc.marginInterestTaxLocal, 2)} 万${ccyName}`,
        formula: "利息税 ÷ 挂钩汇率",
        kind: "cost",
        amount: -taxUsd,
      });
    }
  }
  flow.push({
    label: "全折净收益",
    sublabel: "÷ 保函存款本金 · 已扣税",
    basis: "美元侧 + 本币存款端（扣税后）+ 本币贷款端",
    formula:
      "(保函存款利息 − 保函手续费 + 保证金税前利息 − 利息税 + 本币息差) ÷ 保函存款本金",
    kind: "total",
    amount:
      calc.depositInterestUsd + calc.localLegNetUsd - calc.guaranteeFeeUsd,
  });
  return withRunning(flow);
}

function PnlWaterfall({
  title,
  valueUnit,
  steps,
}: {
  title: string;
  valueUnit: string;
  steps: PnlStep[];
}) {
  const theme = useHostTheme();
  const flowSteps = steps.filter((s) => s.kind !== "total");
  const totalStep = steps.find((s) => s.kind === "total")!;
  const plotSteps = [...flowSteps, totalStep];

  const ends = flowSteps.flatMap((s) => [s.running, s.running + s.amount]);
  const yMax = Math.max(totalStep.amount, ...ends, 0);
  const yMin = Math.min(0, ...ends, totalStep.amount);
  const ySpan = Math.max(yMax - yMin, 1);
  const padY = ySpan * 0.14;
  const yTop = yMax + padY;
  const yBottom = yMin - padY;

  const n = plotSteps.length;
  const marginLeft = 40;
  const marginRight = 10;
  const marginTop = 18;
  const marginBottom = 4;
  const slotW = Math.max(88, Math.min(110, Math.floor(520 / Math.max(n, 1))));
  const innerW = n * slotW;
  const plotW = marginLeft + marginRight + innerW;
  const plotH = 156;
  const barW = Math.min(32, slotW * 0.38);
  const innerH = plotH - marginTop - marginBottom;

  const yScale = (v: number) =>
    marginTop + ((yTop - v) / (yTop - yBottom)) * innerH;

  const incomeFill = theme.palette.diffStripAdded;
  const costFill = theme.palette.diffStripRemoved;
  const totalFill = theme.accent.primary;

  const lastFlowEnd =
    flowSteps.length > 0
      ? flowSteps[flowSteps.length - 1].running +
        flowSteps[flowSteps.length - 1].amount
      : 0;

  return (
    <Stack gap={10}>
      <H3>{title}</H3>
      <div style={{ overflowX: "auto", width: "100%", WebkitOverflowScrolling: "touch" }}>
        <div style={{ width: plotW, minWidth: plotW }}>
          <svg
            viewBox={`0 0 ${plotW} ${plotH}`}
            width={plotW}
            height={plotH}
            style={{ display: "block" }}
            role="img"
            aria-label={`${title}瀑布图`}
          >
            <line
              x1={marginLeft}
              x2={plotW - marginRight}
              y1={yScale(0)}
              y2={yScale(0)}
              stroke={theme.stroke.tertiary}
            />
            <text
              x={8}
              y={marginTop + innerH / 2}
              fill={theme.text.quaternary}
              fontSize={10}
              transform={`rotate(-90 10 ${marginTop + innerH / 2})`}
              textAnchor="middle"
            >
              {valueUnit}
            </text>
            {plotSteps.map((step, i) => {
              const cx = marginLeft + slotW * i + slotW / 2;
              const x = cx - barW / 2;
              const prev = i > 0 ? plotSteps[i - 1] : null;
              const bridgeY =
                prev && prev.kind !== "total"
                  ? prev.running + prev.amount
                  : lastFlowEnd;
              let y0: number;
              let y1: number;
              let fill: string;
              if (step.kind === "total") {
                y0 = yScale(0);
                y1 = yScale(step.amount);
                fill = totalFill;
              } else if (step.kind === "income") {
                y0 = yScale(step.running);
                y1 = yScale(step.running + step.amount);
                fill = incomeFill;
              } else {
                y0 = yScale(step.running);
                y1 = yScale(step.running + step.amount);
                fill = costFill;
              }
              const top = Math.min(y0, y1);
              const h = Math.max(Math.abs(y1 - y0), 2);
              const amtLabel =
                step.kind === "total"
                  ? num(step.amount, 2)
                  : `${step.amount >= 0 ? "+" : "−"}${num(Math.abs(step.amount), 2)}`;
              return (
                <g key={`${title}-${step.label}`}>
                  {i > 0 ? (
                    <line
                      x1={marginLeft + slotW * (i - 1) + slotW / 2 + barW / 2}
                      x2={x}
                      y1={yScale(bridgeY)}
                      y2={yScale(
                        step.kind === "total" ? step.amount : step.running,
                      )}
                      stroke={theme.stroke.secondary}
                    />
                  ) : null}
                  <rect x={x} y={top} width={barW} height={h} fill={fill} rx={2} />
                  <text
                    x={cx}
                    y={top - 4}
                    textAnchor="middle"
                    fill={theme.text.secondary}
                    fontSize={10}
                    fontWeight={600}
                  >
                    {amtLabel}
                  </text>
                </g>
              );
            })}
          </svg>
          <div
            style={{
              display: "flex",
              paddingLeft: marginLeft,
              paddingRight: marginRight,
              boxSizing: "border-box",
              width: plotW,
            }}
          >
            {plotSteps.map((step) => (
              <div
                key={`${title}-lbl-${step.label}`}
                style={{
                  width: slotW,
                  minWidth: slotW,
                  maxWidth: slotW,
                  padding: "6px 6px 0",
                  boxSizing: "border-box",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    lineHeight: "16px",
                    color: theme.text.primary,
                    whiteSpace: "normal",
                    wordBreak: "break-word",
                  }}
                >
                  {step.label}
                </div>
                {step.sublabel ? (
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 10,
                      lineHeight: "13px",
                      color: theme.text.tertiary,
                      whiteSpace: "normal",
                      wordBreak: "break-word",
                    }}
                  >
                    {step.sublabel}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
      <CollapsibleSection title="明细表" defaultOpen={false}>
        <Table
          headers={["项目", "类型", "金额", "计息基数", "公式"]}
          columnAlign={["left", "left", "right", "left", "left"]}
          striped
          rowTone={steps.map((s) =>
            s.kind === "cost" ? "danger" : s.kind === "income" ? "success" : "info",
          )}
          rows={steps.map((s) => [
            s.label,
            s.kind === "cost" ? "成本" : s.kind === "income" ? "收入" : "合计",
            `${s.amount >= 0 ? "" : "−"}${num(Math.abs(s.amount), 2)} ${valueUnit}`,
            s.basis,
            s.formula,
          ])}
        />
      </CollapsibleSection>
    </Stack>
  );
}

function BasisTable({
  calc,
  inputs,
  country,
}: {
  calc: Calc;
  inputs: Inputs;
  country: CountryPreset;
}) {
  return (
    <Table
      headers={["定价项", "利率/费率", "计息基数", "基数金额", "公式"]}
      columnAlign={["left", "right", "left", "right", "left"]}
      striped
      stickyHeader
      rows={[
        [
          "保函存款利率",
          pct(inputs.depositRatePct),
          "保函存款本金",
          `${num(inputs.depositUsd)} 万美元`,
          "基数 × 利率 × 天数 ÷ 360",
        ],
        [
          "保函手续费率",
          pct(inputs.guaranteeFeePct),
          "保函金额",
          `${num(calc.guaranteeUsd)} 万美元`,
          "基数 × 费率（一次性）",
        ],
        [
          "贷款利率",
          pct(inputs.loanRatePct),
          "贷款金额",
          `${num(calc.loanLocal, 2)} 万${country.ccyName}`,
          "基数 × 利率 × 天数 ÷ 360",
        ],
        [
          "转贷利率",
          pct(inputs.onlendPct),
          "转贷金额 = 贷款金额",
          `${num(calc.loanLocal, 2)} 万${country.ccyName}`,
          "基数 × 利率 × 天数 ÷ 360",
        ],
        [
          "保证金比例",
          pct(inputs.marginPct),
          "转贷金额",
          `${num(calc.marginLocal, 2)} 万${country.ccyName}`,
          "转贷金额 × 比例（在当地行存放）",
        ],
        [
          "本币保证金存款利率",
          pct(inputs.localDepositRatePct),
          "保证金金额",
          `${num(calc.marginLocal, 2)} 万${country.ccyName}`,
          "基数 × 利率 × 天数 ÷ 360（税前）",
        ],
        [
          "保证金利息税率",
          pct(
            inputs.marginInterestTaxPct ?? country.marginInterestTaxPct ?? 0,
          ),
          "税前利息",
          `${num(calc.marginInterestGrossLocal, 2)} → 扣税后 ${num(calc.marginInterestLocal, 2)} 万${country.ccyName}`,
          "税前 × 税率；净额计入本币存款端",
        ],
        [
          "当期挂钩汇率",
          `1 USD = ${num(inputs.fx, inputs.fx >= 100 ? 0 : 2)} ${country.ccy}`,
          "本币两侧合计",
          `本币贷款端 ${num(calc.spreadLocal, 2)} + 本币存款端（扣税后）${num(calc.marginInterestLocal, 2)} 万${country.ccyName}`,
          "（本币贷款端 + 本币存款端）÷ 汇率 → 万美元",
        ],
      ]}
    />
  );
}

export default function CrossBorderGuaranteeOnlend() {
  const theme = useHostTheme();
  const [inputs, setInputs] = useCanvasState<Inputs>(
    "guarantee-onlend-v3",
    fromPreset(PRESETS.PH),
  );
  const country = PRESETS[inputs.countryId] ?? PRESETS.PH;
  const calc = useMemo(() => compute(inputs), [inputs]);
  const depLoanCheck = useMemo(() => localBankDepositCheck(inputs), [inputs]);
  const [targetUsdYieldPct, setTargetUsdYieldPct] = useCanvasState(
    "guarantee-target-usd-yield-v1",
    PH_EXCEL_YIELD_PCT,
  );
  const [chuanIncludeJv, setChuanIncludeJv] = useCanvasState(
    "guarantee-chuan-include-jv-v1",
    true,
  );
  const [ngBankId, setNgBankId] = useCanvasState("guarantee-ng-bank-v1", "uba");
  const [ngLoanTier, setNgLoanTier] = useCanvasState<NgLoanTier>(
    "guarantee-ng-tier-v1",
    "prime",
  );
  const implied = useMemo(
    () => invertOnlendPct(inputs, targetUsdYieldPct, chuanIncludeJv),
    [inputs, targetUsdYieldPct, chuanIncludeJv],
  );
  const chuanMerge = useMemo(
    () => chuanMergeMetrics(calc, inputs, chuanIncludeJv),
    [calc, inputs, chuanIncludeJv],
  );
  const chuanMergeShock = useMemo(
    () => chuanMergeMetrics(calc, inputs, chuanIncludeJv, true),
    [calc, inputs, chuanIncludeJv],
  );
  const onlendPremiumPp = round2(inputs.onlendPct - calc.pairDiff * 100);
  const patch = (p: Partial<Inputs>) => setInputs((prev) => ({ ...prev, ...p }));

  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState<string | null>(null);
  const [fxAsOf, setFxAsOf] = useState<string | null>(null);

  useEffect(() => {
    setFxAsOf(null);
    setFxError(null);
  }, [inputs.countryId]);

  const refreshSpotFx = useCallback(async () => {
    setFxLoading(true);
    setFxError(null);
    try {
      const rate = await fetchSpotFx(country.ccy);
      const rounded = roundFxSpot(rate, inputs.countryId);
      setInputs((prev) => ({ ...prev, fx: rounded }));
      setFxAsOf(
        new Date().toLocaleString("zh-CN", {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      );
    } catch (e) {
      setFxError(e instanceof Error ? e.message : "拉取失败，请稍后重试");
    } finally {
      setFxLoading(false);
    }
  }, [country.ccy, inputs.countryId, setInputs]);

  const selectedNgBank =
    NG_BANK_QUOTES.find((b) => b.id === ngBankId) ??
    NG_BANK_QUOTES.find((b) => b.id === "uba")!;

  const applyNgBank = (bankId: string, tier: NgLoanTier = ngLoanTier) => {
    const bank = NG_BANK_QUOTES.find((b) => b.id === bankId);
    if (!bank) return;
    const loan = ngLoanPct(bank, tier);
    setNgBankId(bankId);
    patch({ loanRatePct: loan, onlendPct: ngOnlendFromLoan(loan) });
  };

  const loadCountry = (id: CountryId) => {
    if (id === "NG") {
      const bank =
        NG_BANK_QUOTES.find((b) => b.id === ngBankId) ??
        NG_BANK_QUOTES.find((b) => b.id === "uba")!;
      const loan = ngLoanPct(bank, ngLoanTier);
      setInputs({
        ...fromPreset(PRESETS.NG),
        loanRatePct: loan,
        onlendPct: ngOnlendFromLoan(loan),
      });
      return;
    }
    setInputs(fromPreset(PRESETS[id]));
  };

  const countryCalcs = (Object.keys(PRESETS) as CountryId[]).map((id) => {
    const p = PRESETS[id];
    const inp = fromPreset(p);
    return {
      id,
      p,
      c: compute(inp),
      q: invertOnlendPct(inp, targetUsdYieldPct, chuanIncludeJv),
    };
  });

  const phExcelYield = 0.090508;
  const matchesExcel =
    inputs.countryId === "PH" &&
    inputs.marginPct === 0 &&
    Math.abs(calc.usdYield - phExcelYield) < 0.00005;

  return (
    <Stack gap={20} style={{ padding: 24, maxWidth: 1120 }}>
      <Stack gap={8}>
        <H1>跨境保函项下转贷测算</H1>
        <Text tone="secondary">
          出美元开保函、帮当地机构融本币。正向：给定转贷价算 CHUAN 综合收益率 / 全折美元收益率。倒推：锁 CHUAN 综合收益率门槛，反解本币融资对外转贷报价。公式对齐《保函测算菲律宾
          2.xlsx》。换国家只换本币横梁与汇率；美元侧仍用保函存款报价。
        </Text>
        <Row gap={8} align="center" wrap>
          {(Object.keys(PRESETS) as CountryId[]).map((id) => (
            <Pill
              key={id}
              active={inputs.countryId === id}
              onClick={() => loadCountry(id)}
            >
              {PRESETS[id].nameZh}
              {PRESETS[id].quoted
                ? " · 表内报价"
                : id === "NG"
                  ? " · CBN分项"
                  : " · 外推"}
            </Pill>
          ))}
          <Spacer />
          <Button variant="ghost" onClick={() => loadCountry(inputs.countryId)}>
            恢复该国预设
          </Button>
        </Row>
        <Row gap={8} wrap>
          <Pill size="sm" active={country.quoted || inputs.countryId === "NG"}>
            {country.quoted
              ? "已谈妥报价"
              : inputs.countryId === "NG"
                ? "CBN 分项贷款价"
                : "宏观外推 · 待报价"}
          </Pill>
          <Pill size="sm">
            {country.regulator} · {country.ccy}
          </Pill>
          <Pill size="sm">{country.asOf}</Pill>
        </Row>
      </Stack>

      {inputs.countryId === "NG" ? (
        <CollapsibleSection
          title={`CBN 分项贷款报价 · ${NG_CBN_LENDING_SOURCE.dataMonth}`}
          defaultOpen={false}
          trailing={
            <Text size="small" tone="tertiary">
              {selectedNgBank.name} · {ngLoanTier} · {pct(ngLoanPct(selectedNgBank, ngLoanTier))}
            </Text>
          }
        >
          <Stack gap={8}>
            <Row gap={8} align="center" wrap>
              <Text size="small" tone="tertiary">
                prime / max 档位
              </Text>
              <Pill
                active={ngLoanTier === "prime"}
                onClick={() => {
                  setNgLoanTier("prime");
                  applyNgBank(ngBankId, "prime");
                }}
              >
                prime
              </Pill>
              <Pill
                active={ngLoanTier === "max"}
                onClick={() => {
                  setNgLoanTier("max");
                  applyNgBank(ngBankId, "max");
                }}
              >
                max
              </Pill>
            </Row>
            <Row gap={6} wrap>
              {NG_BANK_QUOTES.map((bank) => {
                const active =
                  ngBankId === bank.id &&
                  ngRatesMatch(inputs, bank, ngLoanTier);
                return (
                  <Pill
                    key={bank.id}
                    size="sm"
                    active={active}
                    onClick={() => applyNgBank(bank.id)}
                  >
                    {bank.name}
                    {bank.merchant ? " · 商" : ""}
                  </Pill>
                );
              })}
            </Row>
          </Stack>
        </CollapsibleSection>
      ) : null}

      <Grid columns={3} gap={20}>
        <LegKpiColumn
          leg="usd"
          title="美元侧 · 保函存款"
          principal={formatUsdDepositPrincipal(inputs.depositUsd)}
          principalLabel="保函存款本金"
          income={formatUsdWanStat(calc.usdLegNetUsd)}
          incomeLabel="保函存款利息 − 保函手续费"
          yieldPct={calc.usdLegYield}
        />
        <LegKpiColumn
          leg="deposit"
          title={`本币存款端 · ${country.ccy} · JV`}
          principal={
            calc.marginLocal > 0
              ? formatLocalWanStat(calc.marginLocal, inputs.countryId)
              : "—"
          }
          principalUsd={
            calc.marginLocal > 0
              ? formatUsdWanStat(calc.marginLocal / inputs.fx)
              : undefined
          }
          principalLabel="保证金本金"
          income={
            calc.marginLocal > 0
              ? formatLocalWanStat(calc.marginInterestLocal, inputs.countryId)
              : "—"
          }
          incomeUsd={
            calc.marginLocal > 0 ? formatUsdWanStat(calc.marginInterestUsd) : undefined
          }
          incomeLabel="保证金存款利息（扣税）"
          yieldPct={calc.marginLocal > 0 ? calc.localDepositLegYield : null}
        />
        <LegKpiColumn
          leg="loan"
          title={`本币贷款端 · ${country.ccy}`}
          principal={formatLocalWanStat(calc.loanLocal, inputs.countryId)}
          principalUsd={formatUsdWanStat(calc.loanPrincipalUsd)}
          principalLabel="助贷本金"
          income={formatLocalWanStat(calc.spreadLocal, inputs.countryId)}
          incomeUsd={formatUsdWanStat(calc.spreadUsdSpot)}
          incomeLabel="本币息差"
          yieldPct={calc.loanLocal > 0 ? calc.localLoanLegYield : null}
        />
      </Grid>

      <Divider />

      <Card>
        <CardHeader trailing={<Text size="small">合并折美元</Text>}>
          CHUAN 合并口径
        </CardHeader>
        <CardBody>
          <Stack gap={12}>
            <Row gap={8} wrap align="center">
              <Pill
                size="sm"
                active={chuanIncludeJv}
                onClick={() => setChuanIncludeJv(true)}
              >
                含 JV
              </Pill>
              <Pill
                size="sm"
                active={!chuanIncludeJv}
                onClick={() => setChuanIncludeJv(false)}
              >
                不含 JV
              </Pill>
              {chuanIncludeJv ? (
                <StepStat
                  value={inputs.chuanJvPct ?? 70}
                  label="CHUAN 占 JV 股权"
                  tone="info"
                  step={1}
                  min={0}
                  max={100}
                  stepUnit="%"
                  formatValue={(v) => `${Math.round(v)}%`}
                  onStep={(n) => patch({ chuanJvPct: n })}
                />
              ) : (
                <Text size="small" tone="tertiary">
                  仅美元侧 + 本币贷款端，不计 JV 保证金利息
                </Text>
              )}
            </Row>
            <Grid columns={2} gap={12}>
              <Stat
                value={
                  <Row gap={10} align="center">
                    <StatValue>{formatUsdWanStat(chuanMerge.netUsd)}</StatValue>
                    <IncomeLegMiniPie
                      usdLegUsd={chuanMerge.usdLegUsd}
                      marginUsd={chuanMerge.marginChuanUsd}
                      spreadUsd={chuanMerge.spreadUsd}
                      localCcy={country.ccy}
                    />
                  </Row>
                }
                label={`CHUAN 口径净收益 · ${chuanMerge.suffix} · 三端占比`}
                tone="success"
              />
              <Stat
                value={pct(chuanMerge.yieldPct * 100, 2)}
                label={`CHUAN 综合收益率 · ${chuanMerge.suffix}`}
                tone="warning"
              />
            </Grid>
            <Row gap={8} wrap align="center">
              <Pill size="sm">
                全折参照 · 净收益 {formatUsdWanStat(calc.netUsdFull)} · 收益率{" "}
                {pct(calc.usdYieldFull * 100, 2)}
              </Pill>
              <Pill size="sm">
                参考 · {country.ccy}/USD 政策利差 {pct(calc.pairDiff * 100, 2)}
              </Pill>
              {chuanIncludeJv && calc.marginInterestUsd > 0 ? (
                <Text size="small" tone="tertiary">
                  含 JV 计入保证金折美元 {formatUsdWanStat(chuanMerge.marginChuanUsd)}（股权{" "}
                  {pct((inputs.chuanJvPct ?? 70), 0)}）；不含则少{" "}
                  {formatUsdWanStat(chuanMerge.marginChuanUsd)}。
                </Text>
              ) : !chuanIncludeJv && calc.marginInterestUsd > 0 ? (
                <Text size="small" tone="tertiary">
                  相对含 JV（{pct((inputs.chuanJvPct ?? 70), 0)} 股权）少计保证金折美元{" "}
                  {formatUsdWanStat(calc.marginInterestUsd * jvShareOf(inputs))}。
                </Text>
              ) : null}
            </Row>
          </Stack>
        </CardBody>
      </Card>

      <CollapsibleSection
        title="预设收益率的本币融资对外报价"
        defaultOpen={false}
        trailing={
          implied ? (
            <Text size="small" tone="tertiary">
              目标 {pct(targetUsdYieldPct)} → 报价 {pct(implied.impliedOnlendPct)}
            </Text>
          ) : (
            <Text size="small" tone="tertiary">
              锁 CHUAN 综合收益率反解本币转贷价
            </Text>
          )
        }
      >
        <Stack gap={12}>
          <Text size="small" tone="secondary">
            按预设 CHUAN 综合收益率反解本币对外转贷报价。JV 含否与股权见上方「CHUAN 合并口径」。贷款价格、保函费、折扣不动，只动转贷报价。
          </Text>
          <Grid columns={2} gap={20}>
            <Stack gap={10}>
              <Text weight="semibold">收益基准</Text>
              <StepStat
                value={targetUsdYieldPct}
                label={
                  chuanIncludeJv
                    ? "目标 CHUAN 综合收益率 · 含 JV"
                    : "目标 CHUAN 综合收益率 · 不含 JV"
                }
                tone="warning"
                onStep={setTargetUsdYieldPct}
              />
              <Text size="small" tone="tertiary">
                {chuanIncludeJv
                  ? `当前 CHUAN 综合收益率 ${pct(chuanMerge.yieldPct * 100, 2)}（含 JV · 股权 ${pct((inputs.chuanJvPct ?? 70), 0)}）。`
                  : `当前 CHUAN 综合收益率 ${pct(chuanMerge.yieldPct * 100, 2)}（不含 JV）。`}
                ▲▼ 收益率步长 {pct(TARGET_YIELD_STEP)}
              </Text>
            </Stack>
            <Stack gap={10}>
              <Text weight="semibold">对外报价 · {country.ccy}</Text>
              <Stat
                value={
                  implied ? (
                    <StatValue>{pct(implied.impliedOnlendPct, 2)}</StatValue>
                  ) : (
                    "—"
                  )
                }
                label="本币对外转贷报价"
                tone="info"
              />
              {implied ? (
                <Text size="small" tone="tertiary">
                  相对当前转贷横梁{" "}
                  {implied.impliedOnlendPct - inputs.onlendPct >= 0 ? "+" : ""}
                  {pct(implied.impliedOnlendPct - inputs.onlendPct, 2)} · 所需息差{" "}
                  {num(implied.neededSpreadUsd)} 万美元
                </Text>
              ) : null}
            </Stack>
          </Grid>
          {implied ? (
            <Row gap={8} align="center" wrap>
              <Button
                variant="primary"
                onClick={() => patch({ onlendPct: round2(implied.impliedOnlendPct) })}
              >
                将对外报价写入转贷横梁
              </Button>
              <Text size="small" tone="tertiary">
                所需息差 {num(implied.neededSpreadUsd)} 万美元 · 可放本金折美元{" "}
                {num(implied.loanUsd)} 万 · 零息差时美元收益下限{" "}
                {pct(implied.floorUsdYieldPct)}
                {implied.nimPct < 0
                  ? "。基准低于存款净利息，报价会落到贷款价格以下。"
                  : ""}
              </Text>
            </Row>
          ) : null}
        </Stack>
      </CollapsibleSection>

      <CollapsibleSection
        title="定价横梁"
        defaultOpen={true}
        trailing={
          <Text size="small" tone="tertiary">
            存 {pct(inputs.depositRatePct)} · 费 {pct(inputs.guaranteeFeePct)} · 贷{" "}
            {pct(inputs.loanRatePct)} · 转贷 {pct(inputs.onlendPct)} · 折扣{" "}
            {pct(inputs.discountPct, 0)} · 保证金 {pct(inputs.marginPct, 0)}
          </Text>
        }
      >
        <Stack gap={12}>
          <Text size="small" tone="secondary">
            四条价格 + 保函折扣率 + 本币保证金 + 综合成本参照。改横梁即重算。保函存款与展业国无关；保证金按转贷金额比例存当地行，争取较好本币存款利率。
          </Text>
          <Grid columns={5} gap={12}>
        <Card>
          <CardHeader trailing={<Text size="small">保函存款</Text>}>
            存款价格
          </CardHeader>
          <CardBody>
            <Field
              label="年利率"
              suffix="%"
              value={inputs.depositRatePct}
              onChange={(n) => patch({ depositRatePct: n })}
              hint="表内 4.50% · 量级不同利率不同"
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Text size="small">保函行</Text>}>
            保函手续费
          </CardHeader>
          <CardBody>
            <Field
              label="费率"
              suffix="%"
              value={inputs.guaranteeFeePct}
              onChange={(n) => patch({ guaranteeFeePct: n })}
              hint="无质押 1.5–2%；全额质押 0.8–1.0%"
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Text size="small">{country.ccy}</Text>}>
            贷款价格
          </CardHeader>
          <CardBody>
            <Field
              label="年利率"
              suffix="%"
              value={inputs.loanRatePct}
              onChange={(n) => patch({ loanRatePct: n })}
              hint={
                inputs.countryId === "NG"
                  ? `${selectedNgBank.name} · ${ngLoanTier === "prime" ? "prime" : "max"} · CBN ${NG_CBN_LENDING_SOURCE.dataMonth}`
                  : country.quoted
                    ? "表内已给定 6.20%"
                    : `外推 ${country.localPolicyPct}%+1.45pp`
              }
            />
            {depLoanCheck.applies ? (
              <Text size="small" tone="tertiary">
                同存同贷基准 · 贷款 {pct(inputs.loanRatePct)}
                {depLoanCheck.inverted
                  ? ` · 存贷倒挂 ${pct(Math.abs(depLoanCheck.spreadPp))}`
                  : ` · 存贷利差 ${pct(depLoanCheck.spreadPp)}`}
              </Text>
            ) : null}
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Text size="small">借款客户</Text>}>
            转贷价格
          </CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Field
                label="年利率"
                suffix="%"
                value={inputs.onlendPct}
                onChange={(n) => patch({ onlendPct: n })}
                hint={
                  implied
                    ? `倒推 ${pct(implied.impliedOnlendPct)} 可写入`
                    : inputs.countryId === "NG"
                      ? `默认 贷款+5.80pp → ${pct(inputs.onlendPct)}`
                      : country.quoted
                        ? "表内靠谈 12%"
                        : "外推 贷款+5.80pp"
                }
              />
              <Text size="small" tone="secondary">
                加点基准 · {country.ccy}/USD 政策利差{" "}
                {pct(calc.pairDiff * 100, 2)} · 加点{" "}
                {onlendPremiumPp >= 0 ? "+" : ""}
                {pct(onlendPremiumPp, 2)}
              </Text>
            </Stack>
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Text size="small">参照物</Text>}>
            货币对利差
          </CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Field
                label={`${country.regulator} 政策利率`}
                suffix="%"
                value={inputs.localPolicyPct}
                onChange={(n) => patch({ localPolicyPct: n })}
              />
              <Field
                label="USD 政策利率"
                suffix="%"
                value={inputs.usdPolicyPct}
                onChange={(n) => patch({ usdPolicyPct: n })}
                hint="TE 美国 3.75%（2026-07）"
              />
              <Text weight="semibold">差值 {pct(calc.pairDiff * 100, 2)}</Text>
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      <Grid columns={3} gap={12}>
        <Card>
          <CardHeader trailing={<Text size="small">{country.ccy}</Text>}>
            保函折扣率
          </CardHeader>
          <CardBody>
            <Field
              label="折扣"
              suffix="%"
              value={inputs.discountPct}
              onChange={(n) => patch({ discountPct: n })}
              hint={`折扣在覆盖贷款行利息之前：名义可放 = 保函面额 × 折扣（默认 ${pct(DISCOUNT, 0)}）→ 约 ${num(calc.guaranteeUsd * (inputs.discountPct / 100))} 万美元；助贷本金再 ÷ (1+贷款利率×天数÷365) → 实际 ${num(calc.loanLocal, 2)} 万${country.ccyName}（≈ ${formatUsdWanStat(calc.loanPrincipalUsd)}）`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Text size="small">{country.ccy}</Text>}>
            本币保证金
          </CardHeader>
          <CardBody>
            <Field
              label="保证金比例"
              suffix="%"
              value={inputs.marginPct}
              onChange={(n) => patch({ marginPct: Math.max(0, n) })}
              hint={`基数 = 转贷金额 ${num(calc.loanLocal, 2)} 万${country.ccyName} → 保证金 ${num(calc.marginLocal, 2)} 万`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader trailing={<Text size="small">当地议定 · {country.ccy}</Text>}>
            保证金存款利率
          </CardHeader>
          <CardBody>
            <Stack gap={8}>
              <Field
                label="年利率"
                suffix="%"
                value={inputs.localDepositRatePct}
                onChange={(n) => patch({ localDepositRatePct: Math.max(0, n) })}
                hint={
                  inputs.marginPct <= 0
                    ? "设保证金比例后生效；须低于同家银行贷款价"
                    : depLoanCheck.inverted
                      ? `高于贷款价 ${pct(inputs.loanRatePct)}，请调低或确认是否跨行报价`
                      : `须低于贷款价 ${pct(inputs.loanRatePct)}（利差 ${pct(depLoanCheck.spreadPp)}）；税前利息 ${num(calc.marginInterestGrossLocal, 2)} 万 → 扣税后 ${num(calc.marginInterestLocal, 2)} 万${country.ccyName} ≈ ${num(calc.marginInterestUsd, 2)} 万美元`
                }
              />
              <Field
                label="利息税率"
                suffix="%"
                value={
                  inputs.marginInterestTaxPct ??
                  country.marginInterestTaxPct ??
                  0
                }
                onChange={(n) =>
                  patch({ marginInterestTaxPct: Math.max(0, Math.min(100, n)) })
                }
                hint={`国别默认 ${pct(country.marginInterestTaxPct)} · 待当地税则核验；当前税 ${num(calc.marginInterestTaxLocal, 2)} 万${country.ccyName}`}
              />
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      {depLoanCheck.inverted ? (
        <Callout tone="danger" title="本币存贷价倒挂 · 同一银行">
          保证金存款利率 {pct(inputs.localDepositRatePct)} 不低于贷款价格{" "}
          {pct(inputs.loanRatePct)}
          {inputs.countryId === "NG"
            ? `（${selectedNgBank.name} · ${ngLoanTier}）`
            : ""}
          。同存同贷时吸储价应低于放款价，否则银行息差为负；请下调存款利率、上调贷款价，或确认两项来自不同行/不同产品口径。测算仍继续，但结果不宜直接对外。
        </Callout>
      ) : depLoanCheck.tight ? (
        <Callout tone="warning" title="本币存贷利差偏窄">
          贷款 {pct(inputs.loanRatePct)} vs 保证金存款 {pct(inputs.localDepositRatePct)}，利差仅{" "}
          {pct(depLoanCheck.spreadPp)}（一般建议 ≥ {pct(LOCAL_DEP_LOAN_MIN_SPREAD_PP)}）。
          请核对是否同一家行、同一客户档位的报价。
        </Callout>
      ) : null}

      {country.quoted && matchesExcel ? (
        <Callout tone="success" title="与菲律宾 Excel 对账一致">
          美元收益率 9.05%（表内 C19）。利息金额 27.38 万美元；保函面额 627.38
          万；贷款约 33,699.62 万比索。
        </Callout>
      ) : null}
        </Stack>
      </CollapsibleSection>

      <Card>
        <CardHeader>汇率冲击（息差折回时点）</CardHeader>
        <CardBody>
          <Stack gap={8}>
            <Field
              label="本币贬值"
              suffix="%（正=更多本币兑 1 美元）"
              value={inputs.fxShockPct}
              onChange={(n) => patch({ fxShockPct: n })}
              hint={`${country.fxVolHint}。Excel 用同一挂钩汇率折回，隐含汇率不变。`}
            />
            <Grid columns={2} gap={12}>
              <Stat
                value={
                  <Row gap={10} align="center">
                    <StatValue>
                      {formatUsdWanStat(chuanMergeShock.netUsd)}
                    </StatValue>
                    <IncomeLegMiniPie
                      usdLegUsd={chuanMergeShock.usdLegUsd}
                      marginUsd={chuanMergeShock.marginChuanUsd}
                      spreadUsd={chuanMergeShock.spreadUsd}
                      localCcy={country.ccy}
                    />
                  </Row>
                }
                label={`CHUAN 口径净收益 · ${chuanMergeShock.suffix} · 三端占比 · 冲击后`}
                tone="success"
              />
              <Stat
                value={pct(chuanMergeShock.yieldPct * 100, 2)}
                label={`CHUAN 综合收益率 · ${chuanMergeShock.suffix} · 冲击后`}
                tone={
                  chuanMergeShock.yieldPct >= chuanMerge.yieldPct
                    ? "success"
                    : "warning"
                }
              />
            </Grid>
          </Stack>
        </CardBody>
      </Card>

      <H2>收益分列 · 计息基数</H2>
      <Text size="small" tone="secondary">
        本币拆成存款端（保证金利息税前 − 利息税）与贷款端（转贷 − 贷款利息）；保函存款为美元侧。全折美元图单独列出利息税折回。
      </Text>
      <CollapsibleSection title="计息基数对照" defaultOpen={false}>
        <BasisTable calc={calc} inputs={inputs} country={country} />
      </CollapsibleSection>
      <Grid columns={2} gap={16}>
        <PnlWaterfall
          title={`本币存款端 · ${country.ccy}`}
          valueUnit={`万${country.ccyName}`}
          steps={buildLocalDepositPnlWaterfall(calc, country.ccyName)}
        />
        <PnlWaterfall
          title={`本币贷款端 · ${country.ccy}`}
          valueUnit={`万${country.ccyName}`}
          steps={buildLocalLoanPnlWaterfall(calc, country.ccyName)}
        />
        <PnlWaterfall
          title="美元侧收益"
          valueUnit="万美元"
          steps={buildUsdLegWaterfall(calc, inputs.depositUsd)}
        />
        <PnlWaterfall
          title="全折美元（当期汇率）"
          valueUnit="万美元"
          steps={buildCombinedUsdWaterfall(calc, country.ccyName, inputs.fx)}
        />
      </Grid>
      <Callout tone="neutral" title="口径对照">
        美元侧 = 保函存款利息 − 保函手续费（{pct(calc.usdLegYield * 100, 2)} ÷ 保函存款本金）。本币贷款端{" "}
        {num(calc.spreadLocal, 2)} 万 + 本币存款端扣税后 {num(calc.marginInterestLocal, 2)} 万（税前{" "}
        {num(calc.marginInterestGrossLocal, 2)} − 税 {num(calc.marginInterestTaxLocal, 2)}）→ 折美元{" "}
        {num(calc.localLegNetUsd, 2)} 万。全折美元净收益 {formatUsdWanStat(calc.netUsdFull)}，收益率{" "}
        {pct(calc.usdYieldFull * 100, 2)}。CHUAN 综合收益率按 JV 股权 {pct(calc.chuanJvShare * 100, 0)} 折算存款端 →{" "}
        {pct(calc.usdYieldChuan * 100, 2)}。
      </Callout>

      <Grid columns={2} gap={16}>
        <CollapsibleSection title="Excel 流水（当前国）" defaultOpen={false}>
          <Stack gap={8}>
            <Table
              headers={["项目", "机构", "数值", "计息基数", "口径"]}
              columnAlign={["left", "left", "right", "left", "left"]}
              striped
              stickyHeader
              rows={[
                ["保函存款本金", "CHUAN", `${num(inputs.depositUsd)} 万美元`, "—", "可配置本金"],
                ["保函存款利率", "存款行", pct(inputs.depositRatePct), "保函存款本金", "保函存款报价"],
                ["存款天数", "存款行", String(inputs.depositDays), "—", "固定约定"],
                [
                  "利息金额",
                  "—",
                  `${num(calc.depositInterestUsd)} 万美元`,
                  `${num(inputs.depositUsd)} 万美元`,
                  "本金×利率×天数÷360",
                ],
                [
                  "保函金额（前置）",
                  "—",
                  `${num(calc.guaranteeUsd)} 万美元`,
                  "存款+利息",
                  "本金+利息，按可前置",
                ],
                [
                  "保函手续费",
                  "保函行",
                  `${num(calc.guaranteeFeeUsd)} 万美元`,
                  `${num(calc.guaranteeUsd)} 万美元`,
                  "保函金额×费率",
                ],
                ["贷款利率", "贷款行", pct(inputs.loanRatePct), "贷款金额", `${country.ccy} 年化`],
                ["贷款天数", "贷款行", String(inputs.loanDays), "—", "存款 365 天、操作 5 天"],
                [
                  `挂钩汇率（${country.ccyName}/美元）`,
                  "贷款行",
                  num(inputs.fx, inputs.fx >= 100 ? 0 : 2),
                  "息差折美元",
                  country.quoted ? "表内 60；TE 约 60.67" : country.asOf,
                ],
                ["保函折扣率", "贷款行", pct(inputs.discountPct, 0), "保函面额", "覆盖利息前；实际本金再÷(1+贷款利率×天÷365)"],
                ["转贷利率", "借款客户", pct(inputs.onlendPct), "转贷金额=贷款金额", "靠谈"],
                [
                  `贷款/转贷金额（万${country.ccyName}）`,
                  "—",
                  num(calc.loanLocal, 2),
                  "保函×折扣×汇率÷(1+贷款利率×天数/365)",
                  "助贷本金与贷款本金相同",
                ],
                [
                  `转贷利息（万${country.ccyName}）`,
                  "—",
                  num(calc.onlendInterestLocal, 2),
                  `${num(calc.loanLocal, 2)} 万${country.ccyName}`,
                  "贷款金额×转贷利率×天数÷360",
                ],
                [
                  `贷款利息（万${country.ccyName}）`,
                  "—",
                  num(calc.loanInterestLocal, 2),
                  `${num(calc.loanLocal, 2)} 万${country.ccyName}`,
                  "贷款金额×贷款利率×天数÷360",
                ],
              [
                `本币贷款端（万${country.ccyName}）`,
                "—",
                num(calc.spreadLocal, 2),
                "转贷−贷款利息",
                "转贷利息−贷款利息",
              ],
              [
                `保证金（万${country.ccyName}）`,
                "贷款行",
                num(calc.marginLocal, 2),
                `${pct(inputs.marginPct)} × 转贷金额`,
                "转贷金额×保证金比例",
              ],
              [
                `本币存款端（万${country.ccyName}）`,
                "贷款行",
                num(calc.marginInterestLocal, 2),
                `${num(calc.marginLocal, 2)} 万${country.ccyName}`,
                "保证金×本币存款利率×天数÷360",
              ],
              [
                `本币两侧合计（万${country.ccyName}）`,
                "—",
                num(calc.localLegNetLocal, 2),
                "本币贷款端+本币存款端",
                "合计后折美元",
              ],
              [
                "本币两侧折万美元",
                "—",
                num(calc.localLegNetUsd, 2),
                `${num(calc.localLegNetLocal, 2)} 万${country.ccyName}`,
                "÷当期挂钩汇率",
              ],
                [
                  "美元侧净收益",
                  "—",
                  `${num(calc.usdLegNetUsd)} 万美元`,
                  "保函存款本金/保函金额",
                  "保函存款利息−保函手续费",
                ],
              [
                "全折美元净收益",
                "—",
                `${num(calc.depositInterestUsd + calc.localLegNetUsd - calc.guaranteeFeeUsd, 2)} 万美元`,
                "美元侧+本币两侧折回",
                `(利息+本币两侧−保函费)÷保函存款本金 = ${pct(calc.usdYield * 100, 4)}`,
              ],
              ]}
            />
            <Text size="small" tone="tertiary">
              表内混用 360/365：利息用 360，贷款本金覆盖用 365。本画布不改日算，便于对账。
            </Text>
          </Stack>
        </CollapsibleSection>

        <CollapsibleSection title="综合成本衡量" defaultOpen={false}>
          <Stack gap={8}>
            <Text size="small" tone="secondary">
              参照物是货币对基础利率差（当地政策利率 − 美元政策利率）。结构赚的是全折美元收益率，不是把奈拉/比索利差直接装进口袋——除非息差留在本币、不即期折回。
            </Text>
            <Table
              headers={["尺子", "读数", "怎么读"]}
              columnAlign={["left", "right", "left"]}
              striped
              rows={[
                ["全折美元收益率", pct(calc.usdYield * 100), "结构全部折回美元后的账本收益"],
                ["存款价格", pct(inputs.depositRatePct), "不做保函、只放保函存款的机会成本"],
                ["USD 政策利率", pct(inputs.usdPolicyPct), "无风险美元底"],
                [`${country.ccy}/USD 政策利差`, pct(calc.pairDiff * 100), "教科书套息；未对冲汇率"],
                ["贷款−当地政策", pct(calc.loanOverPolicy * 100), "保函项下相对政策的点差"],
                ["转贷−贷款", pct(calc.onlendOverLoan * 100), "对借款客户的净利差（本币）"],
              ...(inputs.marginPct > 0
                ? [
                    [
                      "保证金比例",
                      pct(inputs.marginPct),
                      "× 转贷金额，存当地行",
                    ],
                    [
                      "保证金存款利率",
                      pct(inputs.localDepositRatePct),
                      `本币利息 ${num(calc.marginInterestLocal, 2)} 万${country.ccyName}`,
                    ],
                  ]
                : []),
                ...(implied
                  ? [
                      [
                        `倒推报价（锁 ${pct(targetUsdYieldPct)} 美元）`,
                        pct(implied.impliedOnlendPct),
                        "给当地机构的本币融资对外报价",
                      ],
                      [
                        "倒推报价 − 政策利率",
                        pct(implied.impliedOnlendPct - inputs.localPolicyPct),
                        "对外报价相对当地政策的点差",
                      ],
                    ]
                  : []),
                ["超额 vs 存款", pct(calc.excessVsDeposit * 100), "做这单比只存款多赚多少"],
                [
                  "超额 vs 货币对利差",
                  pct(calc.excessVsPairDiff * 100),
                  "正值=美元账本收益高于套息差；高息国常为负——利差在本币侧",
                ],
                [
                  "相对菲律宾的本金折损",
                  pct(calc.principalHaircutVsPh * 100),
                  "同样保函、更高贷款利率 → 可放本金更薄",
                ],
              ]}
            />
          </Stack>
        </CollapsibleSection>
      </Grid>

      <H2>结构参数</H2>
      <Grid columns={4} gap={12}>
        <Field
          label="保函存款本金"
          suffix="万美元"
          value={inputs.depositUsd}
          onChange={(n) => patch({ depositUsd: n })}
        />
        <Field
          label="保函存款天数"
          suffix="天"
          value={inputs.depositDays}
          onChange={(n) => patch({ depositDays: n })}
        />
        <Field
          label="贷款天数"
          suffix="天"
          value={inputs.loanDays}
          onChange={(n) => patch({ loanDays: n })}
        />
        <FxSpotField
          country={country}
          value={inputs.fx}
          onChange={(n) => patch({ fx: n })}
          loading={fxLoading}
          error={fxError}
          asOf={fxAsOf}
          onRefresh={refreshSpotFx}
        />
      </Grid>

      <Divider />

      <CollapsibleSection
        title="五国预设对照"
        count={5}
        trailing={<Text size="small" tone="tertiary">各用本国横梁 · 未含未保存改动</Text>}
        defaultOpen={false}
      >
        <Stack gap={12}>
          <Text size="small" tone="secondary">
            同一 100 万美元、同一保函存款价 4.50%、同一保函费 0.90%、同一保函折扣{" "}
            {pct(DISCOUNT, 0)}、同一保证金比例 25%。倒推报价按上方美元门槛反解；高贷款利率国要报更高本币价，才能锁住同一全折美元收益率。
          </Text>
          <BarChart
            height={240}
            categories={countryCalcs.map((x) => x.p.nameZh)}
            series={[
              {
                name: "全折美元收益率 %",
                data: countryCalcs.map((x) => round2(x.c.usdYield * 100)),
                tone: "success",
              },
              {
                name: "货币对政策利差 %",
                data: countryCalcs.map((x) => round2(x.c.pairDiff * 100)),
                tone: "info",
              },
            ]}
            valueSuffix="%"
            beginAtZero
            referenceLines={[
              { value: HK_DEPOSIT, label: "保函存款 4.50%", tone: "neutral" },
              {
                value: targetUsdYieldPct,
                label: `美元门槛 ${pct(targetUsdYieldPct)}`,
                tone: "warning",
              },
            ]}
          />
          <BarChart
            height={240}
            categories={countryCalcs.map((x) => x.p.nameZh)}
            series={[
              {
                name: "当前转贷 %",
                data: countryCalcs.map((x) => round2(x.p.onlendPct)),
                tone: "neutral",
              },
              {
                name: `倒推本币报价（锁 ${pct(targetUsdYieldPct)} 美元）`,
                data: countryCalcs.map((x) =>
                  x.q ? round2(x.q.impliedOnlendPct) : 0,
                ),
                tone: "info",
              },
            ]}
            valueSuffix="%"
            beginAtZero
          />
          <Table
            headers={[
              "国家",
              "报价状态",
              "政策利率",
              "贷款",
              "当前转贷",
              `倒推报价（锁 ${pct(targetUsdYieldPct)} 美元）`,
              "全折美元收益率",
              "本金折损 vs PH",
            ]}
            columnAlign={["left", "left", "right", "right", "right", "right", "right", "right"]}
            rowTone={countryCalcs.map((x) =>
              x.id === inputs.countryId ? "info" : x.p.quoted ? "success" : "neutral",
            )}
            striped
            rows={countryCalcs.map((x) => [
              `${x.p.nameZh} ${x.p.ccy}`,
              x.p.quoted ? "表内" : "外推",
              pct(x.p.localPolicyPct),
              pct(x.p.loanRatePct),
              pct(x.p.onlendPct),
              x.q ? pct(x.q.impliedOnlendPct) : "—",
              pct(x.c.usdYield * 100),
              pct(x.c.principalHaircutVsPh * 100),
            ])}
          />
        </Stack>
      </CollapsibleSection>

      <CollapsibleSection title="口径与信源" defaultOpen={false}>
        <Table
          headers={["项", "口径"]}
          rows={[
            ["结构", "CHUAN 离岸美元存款 → 利息可前置进保函面额 → 当地行按折扣放本币 → 转贷；另按转贷金额比例存本币保证金"],
          [
            "本币保证金",
            "保证金 = 转贷金额 × 比例；利息 = 保证金 × 当地议定本币存款利率 × 天数 ÷ 360，与转贷息差一并折美元",
          ],
          [
            "CHUAN / JV",
            "本币存款端主体为 JV；CHUAN 口径 = 美元侧 + 本币贷款端 + 本币存款端 × CHUAN 占 JV 股权（默认 70%），再 ÷ CHUAN 保函存款本金。倒推门槛用 CHUAN 口径。",
          ],
          [
            "同存同贷校验",
            "保证金存款利率须低于同家银行贷款价；倒挂或利差 <2pp 时提示，测算不阻断",
          ],
            ["菲律宾数字", "桌面《保函测算菲律宾 2.xlsx》C3–C19；挂钩汇率表内 60"],
            [
              "尼日利亚贷款价",
              `${NG_CBN_LENDING_SOURCE.label}（${NG_CBN_LENDING_SOURCE.published}）· CBN ${NG_CBN_LENDING_SOURCE.dataMonth} 各行 prime/max；${NG_CBN_LENDING_SOURCE.url}`,
            ],
            [
              "宏观利率/汇率",
              "Atlas COUNTRY_MACRO / Trading Economics 2026-06–08：PH BSP 4.75% · NG CBN MPR 26.5% · ID BI 5.75% · MX Banxico 6.5% · KE CBK 8.75% · US 3.75%；FX PHP 60.67 / NGN 1362 / IDR 17916 / MXN 17.25 / KES 129",
            ],
            [
              "外推规则",
              "印尼/墨西哥/肯尼亚：贷款 = 当地政策 + 1.45pp；转贷 = 贷款 + 5.80pp。尼日利亚改用上表 CBN 分项，转贷默认仍 +5.80pp。",
            ],
          [
            "倒推报价",
            "转贷 = 贷款 +（目标美元收益×存款 − 存款利息 + 保函费 − 保证金利息折美元）×360 ÷（可放本金折美元 × 贷款天数）。保函费、保证金利息留在本币/美元侧，不叠进转贷报价。",
          ],
            [
              "勿做",
              "勿把政策利差当成已实现美元收益；勿把地方企业债/无保函的现金贷定价混进本表；宏观不能替代当地保函行与贷款行报价。",
            ],
          ]}
        />
      </CollapsibleSection>
      <Text size="small" tone="tertiary" style={{ color: theme.text.tertiary }}>
        改数会保存在画布侧车，刷新后仍在。点「恢复该国预设」回到该国默认横梁。
      </Text>
    </Stack>
  );
}
