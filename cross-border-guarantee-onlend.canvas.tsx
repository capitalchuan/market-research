import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  BarChart,
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
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
 * 离岸美元存款 →（可选利息前置进面额）保函面额 → 本币贷款（折扣、覆盖本息）→ 转贷息差折回美元。
 * 定价横梁：存款价格、保函手续费、贷款价格、转贷价格、保函折扣率、本币保证金、货币对政策利率差。
 * 菲律宾 = 表内已谈妥报价；尼日利亚 = CBN 2026-06 各银行 prime/max 贷款价（AbokiForex 信源）；其余国家 = 宏观政策利率 + 菲律宾点差外推。
 */

type CountryId = "PH" | "NG" | "ID" | "MX" | "KE" | "RU";

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

/** 画布因 useCanvasState 落盘/热更重挂时，滚动常被重置到页首；跨挂载记住位置 */
const SCROLL_STORAGE_KEY = "guarantee-onlend-canvas-scroll-y";

function findScrollParent(start: HTMLElement | null): HTMLElement | null {
  let el: HTMLElement | null = start;
  while (el) {
    const { overflowY } = getComputedStyle(el);
    if (
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      el.scrollHeight > el.clientHeight + 1
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

function readSavedScroll(): number {
  try {
    const n = Number(sessionStorage.getItem(SCROLL_STORAGE_KEY) ?? "");
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeSavedScroll(y: number) {
  try {
    sessionStorage.setItem(SCROLL_STORAGE_KEY, String(Math.max(0, Math.round(y))));
  } catch {
    /* ignore */
  }
}

function usePreserveCanvasScroll() {
  const anchorRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const y = readSavedScroll();
    if (y <= 0) return;
    const apply = () => {
      const scroller = findScrollParent(anchorRef.current);
      if (scroller) {
        scroller.scrollTop = y;
      } else {
        window.scrollTo(0, y);
        document.documentElement.scrollTop = y;
        document.body.scrollTop = y;
      }
    };
    apply();
    const raf = requestAnimationFrame(apply);
    const t = window.setTimeout(apply, 50);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const scroller = findScrollParent(anchorRef.current);
    const save = () => {
      const y = scroller
        ? scroller.scrollTop
        : window.scrollY || document.documentElement.scrollTop;
      writeSavedScroll(y);
    };
    const opts: AddEventListenerOptions = { passive: true, capture: true };
    scroller?.addEventListener("scroll", save, opts);
    window.addEventListener("scroll", save, opts);
    document.addEventListener("pointerdown", save, opts);
    document.addEventListener("keydown", save, opts);
    return () => {
      scroller?.removeEventListener("scroll", save, opts);
      window.removeEventListener("scroll", save, opts);
      document.removeEventListener("pointerdown", save, opts);
      document.removeEventListener("keydown", save, opts);
    };
  }, []);

  return anchorRef;
}

/** 展开状态落盘，避免画布热更重挂后 PersistCollapsibleSection 被 defaultOpen 重置 */
function PersistCollapsibleSection({
  title,
  leading,
  count,
  trailing,
  children,
  defaultOpen = false,
  style,
}: {
  title: string;
  leading?: ReactNode;
  count?: number;
  trailing?: ReactNode;
  children?: ReactNode;
  defaultOpen?: boolean;
  style?: CSSProperties;
}) {
  const t = useHostTheme();
  const [open, setOpen] = useCanvasState(
    `guarantee-onlend-collapsible-v1-${title}`,
    defaultOpen,
  );
  return (
    <div style={style}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          gap: 8,
          padding: "8px 0",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: t.text.primary,
          textAlign: "left",
        }}
      >
        <span style={{ width: 16, color: t.text.tertiary }}>{open ? "▾" : "▸"}</span>
        {leading}
        <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
        {count != null ? (
          <span style={{ color: t.text.tertiary, fontSize: 12 }}>{count}</span>
        ) : null}
        <span style={{ flex: 1 }} />
        {trailing}
      </button>
      {open ? <div style={{ paddingLeft: 24, paddingBottom: 8 }}>{children}</div> : null}
    </div>
  );
}

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

/** 保函金额 = 利息前置 ? 存款本金×(1+存款利率×天数/360) : 存款本金 */
function depositInterestFactor(depositRatePct: number, depositDays: number) {
  return 1 + ((depositRatePct / 100) * depositDays) / 360;
}

function isInterestUpfront(i: { interestUpfront?: boolean }) {
  return i.interestUpfront !== false;
}

function depositUsdFromGuaranteeFace(
  guaranteeUsd: number,
  depositRatePct: number,
  depositDays: number,
  interestUpfront = true,
): number {
  if (!interestUpfront) return Math.max(guaranteeUsd, 0);
  const factor = depositInterestFactor(depositRatePct, depositDays);
  return Math.max(guaranteeUsd / Math.max(factor, 1e-9), 0);
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
  RU: {
    id: "RU",
    nameZh: "俄罗斯",
    ccy: "RUB",
    ccyName: "卢布",
    regulator: "CBR",
    quoted: false,
    depositUsd: 100,
    depositRatePct: HK_DEPOSIT,
    depositDays: 365,
    guaranteeFeePct: GUARANTEE_FEE,
    loanRatePct: inferredLoan(14),
    loanDays: 360,
    fx: 82.3,
    discountPct: DISCOUNT,
    onlendPct: inferredOnlend(inferredLoan(14)),
    localPolicyPct: 14,
    usdPolicyPct: USD_POLICY,
    fxVolHint: "±18% · USD/RUB 年内高低/均价",
    asOf: "待当地报价 · 宏观 TE/CBR 2026-07/08",
    loanNote:
      "俄央行关键利率 14% + 菲律宾点差外推。汇率 TE 约 82.3（2026-08）；制裁/结算通道与本地报价须单独核验。",
    marginPct: 25,
    localDepositRatePct: 13,
    /** 俄罗斯存款利息 NDFL 常见 13% · 待当地核验 */
    marginInterestTaxPct: 13,
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
  /**
   * 利息前置：开立含利息的保函须先将存款利息计入面额。
   * 关闭时保函金额=存款本金（不含利息），存款利息仍作收益但不进面额。
   */
  interestUpfront: boolean;
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
    interestUpfront: true,
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
  RU: "₽",
};

/** open.er-api.com · USD 基准即期（无 key） */
const FX_SPOT_API = "https://open.er-api.com/v6/latest/USD";

function roundFxSpot(fx: number, id: CountryId) {
  if (id === "ID" || id === "NG" || id === "KE" || id === "RU") return Math.round(fx);
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
        fontSize: size === "large" ? 22 : 18,
        lineHeight: 1.15,
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
  const guaranteeUsd = isInterestUpfront(i)
    ? i.depositUsd + depositInterestUsd
    : i.depositUsd;
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

/**
 * 分配侧：把一笔投资看成横向资金条。
 * 保函位置核心区别：
 * - 帮小贷劣后：保证主体保函 **节降** JV 代小贷出具的保证金（无保函对照 % → 节降后 %）
 * - 帮银行缓释：保函挡在银行敞口前；JV 保证金 **不因保函节降**，仍按无保函全额缴
 */
type GuaranteePlacement = "none" | "help_mfi" | "help_bank";

type AllocParams = {
  placement: GuaranteePlacement;
  /** 预估 Vintage / EL = 银行风险敞口，占助贷本金 %（与本金直接比例） */
  vintageElPct: number;
  /** 代偿备付占助贷本金 % · 日常代偿；画在固收当量区，不占本金轴结构 */
  compensatoryPct: number;
  /**
   * 小贷净资产（占助贷本金 %）· 按实际情况配置；
   * 银行风险敞口 = 本金 − 保证金 − 保函 − 小贷净资产（缓释后纯敞口）。
   */
  mfiCreditPct: number;
  /**
   * 保函层展示厚度；0=按测算 保函金额/助贷本金。
   * 展示厚度；0=按测算 保函金额/助贷本金。保证主体无或有虚线。
   */
  guaranteeTranchePct: number;
  /** 无保函对照保证金 %（帮小贷情景对照） */
  marginWithoutGuaranteePct: number;
  /** JV 代小贷服务费，占银行助贷本金 %（默认 0.2） */
  jvServiceFeePct: number;
};

const DEFAULT_ALLOC: AllocParams = {
  placement: "help_bank",
  vintageElPct: 10,
  compensatoryPct: 3,
  mfiCreditPct: 12,
  guaranteeTranchePct: 0, // 0 → 用保函金额/助贷本金
  marginWithoutGuaranteePct: 40,
  jvServiceFeePct: 0.2,
};

function normalizeAlloc(raw: AllocParams): AllocParams {
  return { ...DEFAULT_ALLOC, ...raw };
}

/** 瀑布/分配侧实际计入的 JV 保证金比例（%·助贷本金） */
function effectiveMarginPct(alloc: AllocParams, inputs: Inputs): number {
  if (alloc.placement === "help_bank") {
    return Math.max(alloc.marginWithoutGuaranteePct, 0);
  }
  return Math.max(inputs.marginPct, 0);
}

type StripLayer = {
  id: string;
  label: string;
  entity: string;
  /** 占助贷本金比例 0–1 */
  thickness: number;
  /** 左端起点 0–1（0=最优先/左，1=最劣后/右） */
  start: number;
  priority: number;
  kind: "funding" | "first_loss" | "mezz" | "senior_residual" | "credit";
  active: boolean;
};

type PartyAlloc = {
  party: "chuan" | "jv" | "bank";
  nameZh: string;
  fundingRole: string;
  creditRole: string;
  incomeUsd: number;
  costUsd: number;
  netUsd: number;
  riskPremiumUsd: number;
  carryUsd: number;
  note: string;
};

type Allocation = {
  loanUsd: number;
  vintageFromLeft: number;
  layers: StripLayer[];
  parties: PartyAlloc[];
  thesis: string;
  pricingHint: string;
  marginReliefPp: number;
  guaranteeCoverageUsd: number;
  bankNetInterestUsd: number;
  jvFirstLossUsd: number;
  chuanCreditSliceUsd: number;
};

function buildRiskLayers(
  alloc: AllocParams,
  marginPct: number,
): StripLayer[] {
  const place = alloc.placement;
  const c = Math.max(alloc.compensatoryPct, 0) / 100;
  const m = Math.max(marginPct, 0) / 100;
  const g =
    place === "none" ? 0 : Math.max(alloc.guaranteeTranchePct, 0) / 100;
  const mfi = Math.max(alloc.mfiCreditPct, 0) / 100;

  // 自右（劣后）向左堆叠；帮小贷图示：敞口 | 小贷 | [EL] | 保函 | 保证金
  type Piece = Omit<StripLayer, "start">;
  const juniorFirst: Piece[] = [
    {
      id: "compensatory",
      label: "代偿备付金",
      entity: "JV 代小贷",
      thickness: c,
      priority: 1,
      kind: "first_loss",
      active: c > 0,
    },
    {
      id: "margin",
      label: "保证金",
      entity: "JV 代小贷",
      thickness: m,
      priority: 2,
      kind: "first_loss",
      active: m > 0,
    },
  ];
  if (place === "help_mfi") {
    juniorFirst.push({
      id: "guarantee",
      label: "保函",
      entity: "保证主体",
      thickness: g,
      priority: 3,
      kind: "mezz",
      active: g > 0,
    });
  }
  juniorFirst.push({
    id: "mfi-credit",
    label: "小贷公司信用",
    entity: "小贷公司",
    thickness: mfi,
    priority: place === "help_mfi" ? 4 : 3,
    kind: "credit",
    active: mfi > 0,
  });
  if (place === "help_bank") {
    juniorFirst.push({
      id: "guarantee",
      label: "保函",
      entity: "保证主体",
      thickness: g,
      priority: 4,
      kind: "mezz",
      active: g > 0,
    });
  }

  let used = juniorFirst.reduce((s, x) => s + (x.active ? x.thickness : 0), 0);
  if (used > 0.95) {
    const scale = 0.95 / used;
    for (const x of juniorFirst) {
      if (x.active) x.thickness *= scale;
    }
    used = 0.95;
  }
  const residual = Math.max(1 - used, 0.05);
  const bankLayer: Piece = {
    id: "bank-residual",
    label: "本金损失（残余）",
    entity: "本地银行",
    thickness: residual,
    priority: 5,
    kind: "senior_residual",
    active: true,
  };

  // 图示：左=优先，右=劣后
  const leftToRight = [
    bankLayer,
    ...[...juniorFirst].reverse().filter((x) => x.active),
  ];

  let cursor = 0;
  return leftToRight.map((p) => {
    const start = cursor;
    cursor += p.thickness;
    return { ...p, start };
  });
}

function computeAllocation(
  inputs: Inputs,
  calc: Calc,
  allocIn: AllocParams,
): Allocation {
  const fmtUsd = (wan: number) =>
    `${num(wan, wan >= 100 ? 1 : 2)} 万美元`;
  const loanUsd = Math.max(calc.loanPrincipalUsd, 1e-9);
  const alloc = allocIn;
  const marginPct = effectiveMarginPct(alloc, inputs);
  const layers = buildRiskLayers(alloc, marginPct);
  const vintageFromLeft = Math.max(0, Math.min(1, 1 - alloc.vintageElPct / 100));

  const guaranteeCoverageUsd =
    alloc.placement === "none"
      ? 0
      : Math.max(alloc.guaranteeTranchePct, 0) > 0
        ? (loanUsd * Math.max(alloc.guaranteeTranchePct, 0)) / 100
        : Math.max(calc.guaranteeUsd, 0);
  const jvFirstLossUsd =
    (loanUsd *
      (Math.max(alloc.compensatoryPct, 0) + marginPct)) /
    100;
  const chuanCreditSliceUsd = guaranteeCoverageUsd;

  const gLivePct =
    alloc.placement === "none"
      ? 0
      : (Math.max(calc.guaranteeUsd, 0) / loanUsd) * 100;
  const jvServiceUsd =
    (loanUsd * Math.max(alloc.jvServiceFeePct ?? 0.2, 0)) / 100;

  /**
   * 三主体当期收入（分配口径，与 CHUAN 合并账本可不同）：
   * - 保证主体：开保函承担风险 → 赚取「转贷−银行贷款报价」息差 + 保函存款利息 + 保函费（风险溢价）
   * - JV：本地服务费 + 或有保证金存款利息（视谈判）
   * - 银行：收入=发放本金的贷款固收利息；成本=代付 JV 保证金存款利息（可核验的存款成本；不含无法考证的吸储成本）
   */
  const guarantorSpreadUsd =
    alloc.placement === "none" ? 0 : Math.max(calc.spreadUsdSpot, 0);
  const guarantorDepositUsd = Math.max(calc.depositInterestUsd, 0);
  const guarantorFeeUsd =
    alloc.placement === "none" ? 0 : Math.max(calc.guaranteeFeeUsd, 0);
  const guarantorIncome =
    guarantorSpreadUsd + guarantorDepositUsd + guarantorFeeUsd;

  const jvMarginIncome = Math.max(calc.marginInterestUsd, 0);
  const jvIncome = jvServiceUsd + jvMarginIncome;

  const bankInterestUsd = calc.loanCostUsd;
  /** 可核验存款成本=代付 JV 保证金存款利息；净额=固收利息−该成本（仍不含吸储成本） */
  const bankDepositCostUsd = jvMarginIncome;
  const bankNimUsd = Math.max(bankInterestUsd - bankDepositCostUsd, 0);

  const marginReliefPp =
    alloc.placement === "help_mfi"
      ? Math.max(0, alloc.marginWithoutGuaranteePct - inputs.marginPct)
      : 0;

  let thesis: string;
  let pricingHint: string;
  if (alloc.placement === "none") {
    thesis =
      "不开保函：保证主体无信用义务与息差分成；JV 可收服务费及或有保证金利息；银行赚贷款利息扣除代付保证金存款利息后的场景息差。";
    pricingHint =
      "无保函时转贷−贷款息差不归保证主体。若需增信，再选「帮小贷」或「帮银行」。";
  } else if (alloc.placement === "help_mfi") {
    thesis =
      "帮小贷劣后：保证主体保函置换/节降 JV 代小贷保证金（无保函对照 → 节降后实缴）；保函劣后帮小贷、不进银行敞口倒算；转贷差价归保证主体。";
    pricingHint = `保函节降保证金 ${pct(alloc.marginWithoutGuaranteePct, 0)} → ${pct(inputs.marginPct, 0)}（−${pct(marginReliefPp, 0)}）；应向小贷收更高报价。保函约 ${fmtUsd(guaranteeCoverageUsd)}；息差 ${fmtUsd(guarantorSpreadUsd)} 归保证主体。`;
  } else {
    thesis =
      "帮银行缓释：保函挡在银行敞口前；JV 保证金不因保函节降，仍按无保函对照全额缴存；转贷差价归保证主体。";
    pricingHint = `JV 保证金全额 ${pct(marginPct, 0)}（保函不节降）。保函约 ${fmtUsd(guaranteeCoverageUsd)}缓释银行；息差 ${fmtUsd(guarantorSpreadUsd)} 归保证主体；银行场景息差 ${fmtUsd(bankNimUsd)}。`;
  }

  const parties: PartyAlloc[] = [
    {
      party: "chuan",
      nameZh: "保证主体",
      fundingRole:
        alloc.placement === "none"
          ? "可不出资"
          : `保函存款质押 ${fmtUsd(inputs.depositUsd)}${
              isInterestUpfront(inputs)
                ? "（利息前置进面额）"
                : "（利息未前置·面额=本金）"
            }`,
      creditRole:
        alloc.placement === "none"
          ? "无保函信用义务"
          : alloc.placement === "help_mfi"
            ? `保函 ${pct(gLivePct, 1)} · 节降 JV 保证金 ${pct(marginReliefPp, 0)}`
            : `保函 ${pct(gLivePct, 1)} · 缓释银行（保证金不节降）`,
      incomeUsd: guarantorIncome,
      costUsd: 0,
      netUsd: guarantorIncome,
      riskPremiumUsd: guarantorFeeUsd,
      carryUsd: guarantorSpreadUsd + guarantorDepositUsd,
      note:
        alloc.placement === "none"
          ? "未开保函：无息差分成、无保函费"
          : "收入=转贷相对银行报价的差价 + 保函存款利息 + 保函费（风险溢价）",
    },
    {
      party: "jv",
      nameZh: "JV",
      fundingRole: `代小贷存出保证金 ${fmtUsd(calc.marginLocal / inputs.fx)}（${pct(marginPct, 0)}·本金${
        alloc.placement === "help_mfi" && marginReliefPp > 0
          ? ` · 保函节降 ${pct(marginReliefPp, 0)}`
          : alloc.placement === "help_bank"
            ? " · 全额不节降"
            : ""
      }）+ 代偿备付 ${pct(alloc.compensatoryPct, 1)}`,
      creditRole: "先损：代偿备付、保证金（视结构）",
      incomeUsd: jvIncome,
      costUsd: 0,
      netUsd: jvIncome,
      riskPremiumUsd: 0,
      carryUsd: jvIncome,
      note: `服务费 ${fmtUsd(jvServiceUsd)}（助贷本金×${pct(alloc.jvServiceFeePct ?? 0.2)}）+ 或有保证金利息 ${fmtUsd(jvMarginIncome)}（视谈判）`,
    },
    {
      party: "bank",
      nameZh: "本地银行",
      fundingRole: `发放本金 ${fmtUsd(loanUsd)}`,
      creditRole: "信用增级耗尽后的本金残余",
      incomeUsd: bankInterestUsd,
      costUsd: bankDepositCostUsd,
      netUsd: bankNimUsd,
      riskPremiumUsd: 0,
      carryUsd: bankNimUsd,
      note: `收入=发放本金固收利息 ${fmtUsd(bankInterestUsd)}；成本=代付保证金存款利息 ${fmtUsd(bankDepositCostUsd)}（付 JV）；净额=固收·场景息差 ${fmtUsd(bankNimUsd)}`,
    },
  ].sort((a, b) => b.incomeUsd - a.incomeUsd);

  return {
    loanUsd,
    vintageFromLeft,
    layers,
    parties,
    thesis,
    pricingHint,
    marginReliefPp,
    guaranteeCoverageUsd,
    bankNetInterestUsd: bankNimUsd,
    jvFirstLossUsd,
    chuanCreditSliceUsd,
  };
}

type ExportFormat = "excel" | "pdf";

type GuaranteeExportContext = {
  inputs: Inputs;
  calc: Calc;
  allocation: Allocation;
  allocParams: AllocParams;
  country: CountryPreset;
  chuanMerge: ReturnType<typeof chuanMergeMetrics>;
  chuanIncludeJv: boolean;
  targetUsdYieldPct: number;
  generatedAt: string;
};

function xmlEsc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function exportStamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function placementLabelZh(p: GuaranteePlacement) {
  if (p === "help_mfi") return "帮小贷劣后";
  if (p === "help_bank") return "帮银行缓释";
  return "不开保函";
}

function downloadTextFile(filename: string, mime: string, content: string) {
  const blob = new Blob(["\uFEFF", content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function htmlEsc(s: string) {
  return xmlEsc(s);
}

/** Excel HTML 行：B 列放数值/公式（x:fmla），兼容中文版 Excel / WPS */
function excelHtmlRow(
  label: string,
  value: string | number,
  unit: string,
  opts?: { formula?: string; kind?: "input" | "calc" | "text" },
) {
  const kind = opts?.kind ?? "text";
  const cls =
    kind === "input" ? "input" : kind === "calc" ? "calc" : "";
  const fmla = opts?.formula
    ? ` x:fmla="${htmlEsc(opts.formula)}"`
    : "";
  const numAttr = typeof value === "number" ? ' x:num=""' : "";
  const display =
    typeof value === "number" ? String(value) : htmlEsc(String(value));
  return `<tr>
    <td>${htmlEsc(label)}</td>
    <td class="${cls}"${fmla}${numAttr}>${display}</td>
    <td>${htmlEsc(unit)}</td>
  </tr>`;
}

function excelHtmlSection(title: string) {
  return `<tr><td colspan="3" class="section">${htmlEsc(title)}</td></tr>`;
}

function excelHtmlBlankRow() {
  return "<tr><td colspan=\"3\">&nbsp;</td></tr>";
}

function bankExposurePct(ctx: GuaranteeExportContext) {
  const loanUsd = Math.max(ctx.calc.loanPrincipalUsd, 1e-9);
  const gPct = (ctx.calc.guaranteeUsd / loanUsd) * 100;
  const marginPct = effectiveMarginPct(ctx.allocParams, ctx.inputs);
  return (
    100 -
    marginPct -
    ctx.allocParams.mfiCreditPct -
    (ctx.allocParams.placement === "help_bank" ? gPct : 0)
  );
}

function buildGuaranteeExcelHtml(ctx: GuaranteeExportContext) {
  const { inputs: i, calc: c, allocation: a, allocParams: ap, country, chuanMerge } =
    ctx;
  const upfront = isInterestUpfront(i) ? 1 : 0;
  const chuanFormula = ctx.chuanIncludeJv
    ? "=B22+B34+B35*B18/100-B24"
    : "=B22+B34-B24";

  const structureRows = [
    excelHtmlRow("跨境保函项下转贷测算", "", "", { kind: "text" }),
    excelHtmlRow("国家", country.nameZh, ""),
    excelHtmlRow("生成时间", ctx.generatedAt, ""),
    excelHtmlBlankRow(),
    excelHtmlSection("【结构参数 · 黄底可改】"),
    excelHtmlRow("保函存款本金", i.depositUsd, "万美元", { kind: "input" }),
    excelHtmlRow("存款利率", i.depositRatePct, "%", { kind: "input" }),
    excelHtmlRow("存款天数", i.depositDays, "天", { kind: "input" }),
    excelHtmlRow("保函手续费", i.guaranteeFeePct, "%", { kind: "input" }),
    excelHtmlRow("贷款价格", i.loanRatePct, "%", { kind: "input" }),
    excelHtmlRow("贷款天数", i.loanDays, "天", { kind: "input" }),
    excelHtmlRow(`汇率 · ${country.ccy}/USD`, i.fx, "", { kind: "input" }),
    excelHtmlRow("保函折扣率", i.discountPct, "%", { kind: "input" }),
    excelHtmlRow("转贷价格", i.onlendPct, "%", { kind: "input" }),
    excelHtmlRow("本币保证金(瀑布实缴)", i.marginPct, "%·助贷本金", { kind: "input" }),
    excelHtmlRow("本币存款利率", i.localDepositRatePct, "%", { kind: "input" }),
    excelHtmlRow("保证金利息税率", i.marginInterestTaxPct, "%", { kind: "input" }),
    excelHtmlRow("CHUAN占JV股权", i.chuanJvPct, "%", { kind: "input" }),
    excelHtmlRow("利息前置(1=是)", upfront, "", { kind: "input" }),
    excelHtmlBlankRow(),
    excelHtmlSection("【测算结果 · 蓝底含公式】"),
    excelHtmlRow("保函存款利息", c.depositInterestUsd, "万美元", {
      kind: "calc",
      formula: "=B6*B7/100*B8/360",
    }),
    excelHtmlRow("保函面额", c.guaranteeUsd, "万美元", {
      kind: "calc",
      formula: "=IF(B19=1,B6+B22,B6)",
    }),
    excelHtmlRow("保函手续费", c.guaranteeFeeUsd, "万美元", {
      kind: "calc",
      formula: "=B23*B9/100",
    }),
    excelHtmlRow("助贷本金(本币)", c.loanLocal, `万${country.ccyName}`, {
      kind: "calc",
      formula: "=B23*B13/100*B12/(1+B10/100*B11/365)",
    }),
    excelHtmlRow("转贷利息", c.onlendInterestLocal, `万${country.ccyName}`, {
      kind: "calc",
      formula: "=B25*B14/100*B11/360",
    }),
    excelHtmlRow("贷款利息", c.loanInterestLocal, `万${country.ccyName}`, {
      kind: "calc",
      formula: "=B25*B10/100*B11/360",
    }),
    excelHtmlRow("本币息差", c.spreadLocal, `万${country.ccyName}`, {
      kind: "calc",
      formula: "=B26-B27",
    }),
    excelHtmlRow("保证金本金", c.marginLocal, `万${country.ccyName}`, {
      kind: "calc",
      formula: "=B25*B15/100",
    }),
    excelHtmlRow("保证金利息(税前)", c.marginInterestGrossLocal, `万${country.ccyName}`, {
      kind: "calc",
      formula: "=B29*B16/100*B11/360",
    }),
    excelHtmlRow("利息税", c.marginInterestTaxLocal, `万${country.ccyName}`, {
      kind: "calc",
      formula: "=B30*B17/100",
    }),
    excelHtmlRow("保证金利息(税后)", c.marginInterestLocal, `万${country.ccyName}`, {
      kind: "calc",
      formula: "=B30-B31",
    }),
    excelHtmlRow("本币侧小计", c.localLegNetLocal, `万${country.ccyName}`, {
      kind: "calc",
      formula: "=B28+B32",
    }),
    excelHtmlRow("息差折美元", c.spreadUsdSpot, "万美元", {
      kind: "calc",
      formula: "=B28/B12",
    }),
    excelHtmlRow("保证金利息折美元", c.marginInterestUsd, "万美元", {
      kind: "calc",
      formula: "=B32/B12",
    }),
    excelHtmlRow("本币侧折美元", c.localLegNetUsd, "万美元", {
      kind: "calc",
      formula: "=B33/B12",
    }),
    excelHtmlRow("助贷本金折美元", c.loanPrincipalUsd, "万美元", {
      kind: "calc",
      formula: "=B25/B12",
    }),
    excelHtmlRow("全折美元净收益", c.netUsdFull, "万美元", {
      kind: "calc",
      formula: "=B22+B36-B24",
    }),
    excelHtmlRow("全折美元收益率", c.usdYieldFull, "", {
      kind: "calc",
      formula: "=B38/B6",
    }),
    excelHtmlRow("美元侧净收益", c.usdLegNetUsd, "万美元", {
      kind: "calc",
      formula: "=B22-B24",
    }),
    excelHtmlRow(
      `CHUAN口径净收益 · ${chuanMerge.suffix}`,
      chuanMerge.netUsd,
      "万美元",
      { kind: "calc", formula: chuanFormula },
    ),
    excelHtmlRow("CHUAN口径收益率", chuanMerge.yieldPct, "", {
      kind: "calc",
      formula: "=B41/B6",
    }),
  ].join("");

  const expPct = bankExposurePct(ctx);
  const effMargin = effectiveMarginPct(ap, i);
  const allocRows = [
    excelHtmlSection("【分配侧 · 权利义务快照】"),
    excelHtmlRow("保函位置", placementLabelZh(ap.placement), ""),
    excelHtmlRow("利息前置", isInterestUpfront(i) ? "是" : "否", ""),
    excelHtmlRow("保证金", effMargin, "%·助贷本金", { kind: "input" }),
    ...(ap.placement === "help_mfi"
      ? [
          excelHtmlRow("节降前保证金", ap.marginWithoutGuaranteePct, "%·助贷本金", {
            kind: "input",
          }),
          excelHtmlRow("保函节降", a.marginReliefPp, "pp", { kind: "calc" }),
        ]
      : []),
    excelHtmlRow("EL", ap.vintageElPct, "%·本金", { kind: "input" }),
    excelHtmlRow("小贷净资产", ap.mfiCreditPct, "%·助贷本金", { kind: "input" }),
    excelHtmlRow("代偿备付", ap.compensatoryPct, "%·助贷本金", { kind: "input" }),
    excelHtmlRow("JV服务费", ap.jvServiceFeePct ?? 0.2, "%·助贷本金", { kind: "input" }),
    excelHtmlRow("银行风险敞口(倒算)", expPct, "%·助贷本金", { kind: "calc" }),
    excelHtmlRow("银行固收利息(收入)", a.parties.find((p) => p.party === "bank")?.incomeUsd ?? 0, "万美元", { kind: "calc" }),
    excelHtmlRow("银行存款成本", a.parties.find((p) => p.party === "bank")?.costUsd ?? 0, "万美元", { kind: "calc" }),
    excelHtmlRow("固收·场景息差(净额)", a.bankNetInterestUsd, "万美元", { kind: "calc" }),
    excelHtmlBlankRow(),
    excelHtmlSection("三主体当期收入（万美元）"),
    ...a.parties.map((p) => excelHtmlRow(p.nameZh, p.incomeUsd, p.note, { kind: "calc" })),
    excelHtmlBlankRow(),
    excelHtmlRow("情景说明", a.thesis, ""),
    excelHtmlRow("定价提示", a.pricingHint, ""),
  ].join("");

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<!--[if gte mso 9]><xml>
<x:ExcelWorkbook>
<x:ExcelWorksheets>
<x:ExcelWorksheet>
<x:Name>结构测算</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet>
</x:ExcelWorksheets>
</x:ExcelWorkbook>
</xml><![endif]-->
<style>
table { border-collapse: collapse; }
td, th { border: 1px solid #ccc; padding: 4px 8px; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 11pt; }
.section { font-weight: bold; background: #e8e8e8; }
.input { background: #FFF8E8; mso-number-format: "General"; }
.calc { background: #EEF6FF; mso-number-format: "General"; }
</style>
</head>
<body>
<table cellspacing="0" cellpadding="0">
<colgroup><col width="220"/><col width="140"/><col width="120"/></colgroup>
<tbody>
${structureRows}
</tbody>
</table>
<br/>
<table cellspacing="0" cellpadding="0">
<colgroup><col width="220"/><col width="140"/><col width="280"/></colgroup>
<tbody>
${allocRows}
</tbody>
</table>
</body>
</html>`;
}

function buildGuaranteePdfHtml(ctx: GuaranteeExportContext) {
  const { inputs: i, calc: c, allocation: a, allocParams: ap, country, chuanMerge } =
    ctx;
  const expPct = bankExposurePct(ctx);
  const effMargin = effectiveMarginPct(ap, i);
  const paramRows: [string, string][] = [
    ["国家", `${country.nameZh} · ${country.regulator} · ${country.ccy}`],
    ["保函存款本金", `${num(i.depositUsd)} 万美元`],
    ["存款利率 / 天数", `${pct(i.depositRatePct)} · ${i.depositDays} 天`],
    ["保函手续费", pct(i.guaranteeFeePct)],
    ["贷款价格 / 天数", `${pct(i.loanRatePct)} · ${i.loanDays} 天`],
    ["汇率", `${num(i.fx, i.fx >= 100 ? 0 : 2)} ${country.ccy}/USD`],
    ["保函折扣率", pct(i.discountPct)],
    ["转贷价格", pct(i.onlendPct)],
    ["本币保证金(瀑布实缴)", pct(effMargin)],
    ["本币存款利率", pct(i.localDepositRatePct)],
    ["保证金利息税率", pct(i.marginInterestTaxPct)],
    ["CHUAN占JV股权", pct(i.chuanJvPct, 0)],
    ["利息前置", isInterestUpfront(i) ? "是" : "否"],
  ];
  const resultRows: [string, string][] = [
    ["保函面额", `${num(c.guaranteeUsd)} 万美元`],
    ["助贷本金", `${num(c.loanLocal)} 万${country.ccyName} · ≈ ${num(c.loanPrincipalUsd)} 万美元`],
    ["本币息差", `${num(c.spreadLocal)} 万${country.ccyName} · ≈ ${num(c.spreadUsdSpot)} 万美元`],
    ["保证金利息(税后)", `${num(c.marginInterestLocal)} 万${country.ccyName} · ≈ ${num(c.marginInterestUsd)} 万美元`],
    ["全折美元净收益", `${num(c.netUsdFull)} 万美元`],
    ["全折美元收益率", pct(c.usdYieldFull * 100, 2)],
    [`CHUAN口径收益率 · ${chuanMerge.suffix}`, pct(chuanMerge.yieldPct * 100, 2)],
    ["银行固收利息(收入)", `${num(a.parties.find((p) => p.party === "bank")?.incomeUsd ?? 0)} 万美元`],
    ["银行存款成本", `${num(a.parties.find((p) => p.party === "bank")?.costUsd ?? 0)} 万美元`],
    ["固收·场景息差(净额)", `${num(a.bankNetInterestUsd)} 万美元`],
  ];
  const allocParamRows: [string, string][] = [
    ["保函位置", placementLabelZh(ap.placement)],
    ["保证金", pct(effMargin)],
    ...(ap.placement === "help_mfi"
      ? [
          ["节降前保证金", pct(ap.marginWithoutGuaranteePct, 0)],
          ["保函节降", pct(a.marginReliefPp, 0)],
        ]
      : []),
    ["EL", pct(ap.vintageElPct, 0)],
    ["小贷净资产", pct(ap.mfiCreditPct, 0)],
    ["代偿备付", pct(ap.compensatoryPct, 1)],
    ["JV 服务费", pct(ap.jvServiceFeePct ?? 0.2, 2)],
    ["银行风险敞口(倒算)", pct(expPct, 1)],
  ];
  const partyRows: [string, string, string][] = a.parties.map((p) => [
    p.nameZh,
    `${num(p.incomeUsd)} 万美元`,
    p.note,
  ]);

  const table = (title: string, head: string[], rows: string[][]) => `
    <h2>${xmlEsc(title)}</h2>
    <table>
      <thead><tr>${head.map((h) => `<th>${xmlEsc(h)}</th>`).join("")}</tr></thead>
      <tbody>${rows
        .map(
          (r) =>
            `<tr>${r.map((cell) => `<td>${xmlEsc(cell)}</td>`).join("")}</tr>`,
        )
        .join("")}</tbody>
    </table>`;

  return `<!DOCTYPE html>
<html lang="zh-CN"><head>
<meta charset="utf-8"/>
<title>保函转贷测算 · ${xmlEsc(country.nameZh)}</title>
<style>
  body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 12px; color: #111; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #666; margin-bottom: 16px; }
  h2 { font-size: 13px; margin: 18px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; width: 28%; }
  .note { color: #444; line-height: 1.5; margin: 8px 0; }
  @media print { body { margin: 12mm; } }
</style>
</head><body>
  <h1>跨境保函项下转贷测算表</h1>
  <div class="meta">${xmlEsc(ctx.generatedAt)} · ${xmlEsc(country.asOf)}</div>
  ${table("结构参数", ["项目", "取值"], paramRows)}
  ${table("测算结果", ["项目", "结果"], resultRows)}
  ${table("分配侧 · 结构参数", ["项目", "取值"], allocParamRows)}
  <table>
    <tbody>
      <tr><th>情景说明</th><td>${xmlEsc(a.thesis)}</td></tr>
      <tr><th>定价提示</th><td>${xmlEsc(a.pricingHint)}</td></tr>
    </tbody>
  </table>
  ${table("三主体当期收入", ["主体", "收入", "说明"], partyRows)}
  <p class="note">银行收入=发放本金固收利息；成本=代付 JV 保证金存款利息；净额=固收·场景息差。不含无法考证的吸储成本。Excel 含公式版（黄底改参数、蓝底公式）可复算。</p>
</body></html>`;
}

function openGuaranteePdfPrint(html: string, title: string) {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    throw new Error("请允许弹出窗口，或在浏览器设置中放行后重试");
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.document.title = title;
  window.setTimeout(() => {
    w.focus();
    w.print();
  }, 350);
}

function exportGuaranteeReport(ctx: GuaranteeExportContext, format: ExportFormat) {
  const base = `保函转贷测算-${ctx.country.nameZh}-${exportStamp()}`;
  if (format === "excel") {
    downloadTextFile(
      `${base}.xls`,
      "application/vnd.ms-excel",
      buildGuaranteeExcelHtml(ctx),
    );
    return "已下载 Excel（含公式），请用 Excel / WPS 打开；黄底改参数、蓝底自动重算";
  }
  openGuaranteePdfPrint(
    buildGuaranteePdfHtml(ctx),
    `保函转贷测算 · ${ctx.country.nameZh}`,
  );
  return "已打开打印预览，请选择「另存为 PDF」";
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
  const guaranteeUsd = isInterestUpfront(i)
    ? i.depositUsd + depositInterestUsd
    : i.depositUsd;
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
  step = 1,
  min = 0,
  max = 1e12,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  hint?: string;
  /** 上下微调步长；默认 1 */
  step?: number;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState(() => String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  const commit = (raw: string) => {
    const trimmed = String(raw).trim().replace(/,/g, "");
    if (trimmed === "" || trimmed === "-" || trimmed === ".") {
      setText(raw);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      setText(raw);
      return;
    }
    const clamped = Math.min(max, Math.max(min, n));
    setText(String(clamped));
    onChange(round2(clamped));
  };
  const bump = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    onChange(round2(next));
  };
  return (
    <Stack gap={4}>
      <Text size="small" tone="secondary">
        {label}
        {suffix ? ` · ${suffix}` : ""}
      </Text>
      <Row gap={6} align="center">
        <TextInput
          type="text"
          value={text}
          onChange={commit}
          style={{ flex: 1, minWidth: 88 }}
        />
        <Stack gap={0} style={{ flexShrink: 0 }}>
          <IconButton
            title={`提高 ${step}`}
            size="sm"
            onClick={() => bump(step)}
            disabled={value >= max - 1e-9}
          >
            +
          </IconButton>
          <IconButton
            title={`降低 ${step}`}
            size="sm"
            onClick={() => bump(-step)}
            disabled={value <= min + 1e-9}
          >
            −
          </IconButton>
        </Stack>
      </Row>
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
              +
            </IconButton>
            <IconButton
              title={`降低 ${step}${stepUnit}`}
              size="sm"
              onClick={() => bump(-step)}
              disabled={value <= min + 1e-9}
            >
              −
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
      <PersistCollapsibleSection title="明细表" defaultOpen={false}>
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
      </PersistCollapsibleSection>
    </Stack>
  );
}

type PartyKey = "bank" | "jv" | "mfi" | "chuan";

function partyColor(
  party: PartyKey,
  theme: ReturnType<typeof useHostTheme>,
): string {
  const c = theme.category;
  if (party === "bank") return c.blue;
  if (party === "jv") return c.cyan;
  if (party === "mfi") return c.orange;
  return c.purple;
}

function partyName(party: PartyKey): string {
  if (party === "bank") return "银行";
  if (party === "jv") return "JV代小贷";
  if (party === "mfi") return "小贷";
  return "保证主体";
}

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];

type MapLeg = {
  id: string;
  party: PartyKey;
  label: string;
  entityLabel: string;
  oblRank: number | null;
  rightRank: number | null;
  rightLabel: string;
  /** 义务位置：占银行助贷本金 0–1（义务轨独立轴=本金100%） */
  start: number;
  actual: number;
  /** 虚线范围（仅非 bridge 行使用） */
  scope: number;
  scopeStart: number;
  /** 义务条下方短注 */
  oblNote?: string;
  /** 义务条延伸至权利侧，覆盖银行固收利息 */
  bridgeBankRight?: boolean;
  incomeUsd: number;
  incomeStart: number;
  incomeShare: number;
  /** 同条多段（如代偿+保证金合并），颜色区分 */
  segments?: {
    id: string;
    label: string;
    start: number;
    width: number;
    color: "cyan" | "green" | "blue" | "orange" | "purple";
    mark: string;
  }[];
};

/**
 * 本币贷款端权利义务瀑布：
 * - 保函=保函/本金；保证金、小贷净资产按配置；银行风险敞口=缓释后剩余纯敞口
 * - 银行出资行固定 0–100% 轴；保函/保证金可超出 100% 时仅拉伸下方叠层轴，非银行增出资
 * - EL 仅作 Vintage 刻度线，不决定银行色块长度
 * - 代偿备付落固收当量区（日常代偿，不占本金轴）
 * - JV/小贷虚线延伸至权利侧覆盖银行固收
 */
function buildWaterfallLegs(
  allocIn: AllocParams,
  allocation: Allocation,
  calc: Calc,
  inputs: Inputs,
): {
  legs: MapLeg[];
  interestOfLoan: number;
  axisMin: number;
  axisMax: number;
  emptyReason?: string;
} {
  const alloc = normalizeAlloc(allocIn);
  /** 真实助贷本金；为 0 时不画任何义务色块（避免 % 配置与 $0 脱节） */
  const loanLive = Math.max(calc.loanPrincipalUsd, 0);
  if (loanLive < 1e-6) {
    return {
      legs: [
        {
          id: "funding",
          party: "bank",
          label: "本金",
          entityLabel: "银行",
          oblRank: null,
          rightRank: null,
          rightLabel: "",
          start: 0,
          actual: 0,
          scope: 0,
          scopeStart: 0,
          oblNote:
            calc.guaranteeUsd < 1e-6
              ? "保函金额为 0 → 助贷本金为 0 · 无义务/权利色块"
              : "助贷本金为 0 · 无义务/权利色块",
          incomeUsd: 0,
          incomeStart: 0,
          incomeShare: 0,
        },
      ],
      interestOfLoan: 0,
      axisMin: 0,
      axisMax: 1,
      emptyReason:
        calc.guaranteeUsd < 1e-6
          ? "保函归零，助贷本金联动为 0，色块已清空"
          : "助贷本金为 0，色块已清空",
    };
  }

  const loan = loanLive;
  const bankInterest = Math.max(calc.loanCostUsd, 0);
  const interestOfLoan = bankInterest / loan;

  const c = Math.max(alloc.compensatoryPct, 0) / 100;
  const mActual = Math.max(effectiveMarginPct(alloc, inputs), 0) / 100;
  /** 保证色块厚度=保函/本金，可>100%（折扣<覆盖利率时） */
  const gFromCalc = Math.max(calc.guaranteeUsd / loan, 0);
  const g = alloc.placement === "none" ? 0 : gFromCalc;
  const mfiWant = Math.max(alloc.mfiCreditPct, 0) / 100;

  /**
   * 本金轴：左=优先/银行，右=劣后。
   * - 帮小贷（见示意图）：敞口 | 小贷信用 | [Vintage] | 保函 | 保证金（保函在 EL 右侧，把保证金往右推）
   * - 帮银行：保证金 | 小贷净资产 | 保函 | 银行敞口
   */
  type Slot = {
    id: string;
    party: PartyKey;
    label: string;
    entityLabel: string;
    start: number;
    actual: number;
    scope: number;
    scopeStart: number;
    oblRank: number;
    oblNote?: string;
    bridgeBankRight?: boolean;
    segments?: MapLeg["segments"];
  };

  const slots: Slot[] = [];
  let rank = 0;
  const m = mActual;
  const mfi = mfiWant;
  const vintageLine = Math.max(0, Math.min(1, 1 - alloc.vintageElPct / 100));
  const mFull =
    alloc.placement === "help_mfi"
      ? Math.max(alloc.marginWithoutGuaranteePct, 0) / 100
      : m;
  const marginRelief =
    alloc.placement === "help_mfi" ? Math.max(mFull - m, 0) : 0;

  if (alloc.placement === "help_mfi") {
    const v = vintageLine;
    const gStart = v;
    const mStartJv = v + g;
    const mfiStart = Math.max(0, v - mfi);
    const bankResidual = 1 - m - mfi;

    if (m > 0 || c > 0) {
      rank += 1;
      const segments: NonNullable<MapLeg["segments"]> = [];
      if (m > 0) {
        segments.push({
          id: "margin",
          label: "保证金",
          start: mStartJv,
          width: m,
          color: "cyan",
          mark: "",
        });
      }
      slots.push({
        id: "jv-first-loss",
        party: "jv",
        label: m > 0 ? "保证金" : "代偿备付",
        entityLabel: "JV代小贷",
        start: mStartJv,
        actual: m,
        scope: 0,
        scopeStart: 0,
        oblRank: rank,
        bridgeBankRight: true,
        segments: segments.length > 0 ? segments : undefined,
        oblNote: [
          m > 0
            ? `保函在 EL 右侧 · 节降后 ${pct(m * 100, 1)}（无保函对照 ${pct(mFull * 100, 1)}）`
            : "",
          c > 0 ? `代偿备付 ${pct(c * 100, 1)} 在固收当量区` : "",
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      });
    }

    if (g > 0) {
      rank += 1;
      slots.push({
        id: "guarantee",
        party: "chuan",
        label: "保证",
        entityLabel: "保证主体",
        start: gStart,
        actual: g,
        scope: 0,
        scopeStart: 0,
        oblRank: rank,
        oblNote: `帮小贷 · 保函贴 EL 线右侧 ${pct(g * 100, 1)} · 置换保证金 ${pct(marginRelief * 100, 1)} · 不进银行敞口倒算`,
      });
    }

    if (mfi > 0) {
      rank += 1;
      slots.push({
        id: "mfi-credit",
        party: "mfi",
        label: "净资产",
        entityLabel: "小贷",
        start: mfiStart,
        actual: mfi,
        scope: 0,
        scopeStart: 0,
        oblRank: rank,
        bridgeBankRight: true,
        oblNote: `小贷信用 ${pct(mfi * 100, 1)} · EL 线左侧`,
      });
    }

    if (bankResidual > 1e-9) {
      rank += 1;
      slots.push({
        id: "bank-residual",
        party: "bank",
        label: "风险敞口",
        entityLabel: "银行",
        start: 0,
        actual: bankResidual,
        scope: 0,
        scopeStart: 0,
        oblRank: rank,
        oblNote: `敞口 = 本金 − 节降后保证金 − 小贷净资产 → ${pct(bankResidual * 100, 1)}（保函不进倒算）`,
      });
    } else if (bankResidual < -1e-9) {
      rank += 1;
      slots.push({
        id: "bank-residual",
        party: "bank",
        label: "负敞口",
        entityLabel: "银行",
        start: bankResidual,
        actual: -bankResidual,
        scope: 0,
        scopeStart: 0,
        oblRank: rank,
        oblNote: `缓释合计超过本金 → 敞口 ${pct(bankResidual * 100, 1)}`,
      });
    }
  } else {
    const mStart = 1 - m;

    if (m > 0 || c > 0) {
      rank += 1;
      const segments: NonNullable<MapLeg["segments"]> = [];
      if (m > 0) {
        segments.push({
          id: "margin",
          label: "保证金",
          start: mStart,
          width: m,
          color: "cyan",
          mark: "",
        });
      }
      slots.push({
        id: "jv-first-loss",
        party: "jv",
        label: m > 0 ? "保证金" : "代偿备付",
        entityLabel: "JV代小贷",
        start: mStart,
        actual: m,
        scope: 0,
        scopeStart: 0,
        oblRank: rank,
        bridgeBankRight: true,
        segments: segments.length > 0 ? segments : undefined,
        oblNote: [
          m > 0 && alloc.placement === "help_bank"
            ? `全额 ${pct(m * 100, 1)}（保函不节降保证金）`
            : m > 0
              ? `保证金 ${pct(m * 100, 1)}`
              : "",
          c > 0 ? `代偿备付 ${pct(c * 100, 1)} 在固收当量区` : "",
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      });
    }

    if (mfi > 0) {
      rank += 1;
      const mfiStart = mStart - mfi;
      slots.push({
        id: "mfi-credit",
        party: "mfi",
        label: "净资产",
        entityLabel: "小贷",
        start: mfiStart,
        actual: mfi,
        scope: 0,
        scopeStart: 0,
        oblRank: rank,
        bridgeBankRight: true,
        oblNote: `配置净资产 ${pct(mfi * 100, 1)} · 义务延伸至银行固收`,
      });
    }

    if (alloc.placement === "help_bank" && g > 0) {
      rank += 1;
      const gStart = mStart - mfi - g;
      slots.push({
        id: "guarantee",
        party: "chuan",
        label: "保证",
        entityLabel: "保证主体",
        start: gStart,
        actual: g,
        scope: 0,
        scopeStart: 0,
        oblRank: rank,
        oblNote:
          gStart < -1e-6
            ? `帮银行缓释 · 保函 ${pct(g * 100, 1)}；左侧超出 ${pct(-gStart * 100, 1)}`
            : `帮银行缓释 · 保函 ${pct(g * 100, 1)} · 挡在银行敞口前`,
      });
    }

    const bankResidual =
      alloc.placement === "help_bank" ? 1 - m - mfi - g : 1 - m - mfi;
    if (bankResidual > 1e-9) {
      rank += 1;
      slots.push({
        id: "bank-residual",
        party: "bank",
        label: "风险敞口",
        entityLabel: "银行",
        start: 0,
        actual: bankResidual,
        scope: 0,
        scopeStart: 0,
        oblRank: rank,
        oblNote:
          alloc.placement === "help_bank"
            ? `缓释后纯敞口 = 本金 − 保证金 − 小贷净资产 − 保函 → ${pct(bankResidual * 100, 1)}`
            : `缓释后纯敞口 = 本金 − 保证金 − 小贷净资产 → ${pct(bankResidual * 100, 1)}`,
      });
    } else if (bankResidual < -1e-9) {
      rank += 1;
      slots.push({
        id: "bank-residual",
        party: "bank",
        label: "负敞口",
        entityLabel: "银行",
        start: bankResidual,
        actual: -bankResidual,
        scope: 0,
        scopeStart: 0,
        oblRank: rank,
        oblNote: `缓释合计超过本金 → 敞口 ${pct(bankResidual * 100, 1)}（负向色块，向左超出 0%）`,
      });
    }
  }

  const order = ["jv-first-loss", "mfi-credit", "guarantee", "bank-residual"];
  slots.sort(
    (a, b) =>
      order.indexOf(a.id) - order.indexOf(b.id) || a.start - b.start,
  );
  const byJunior = [...slots].sort(
    (a, b) => b.start + b.actual - (a.start + a.actual),
  );
  byJunior.forEach((s, i) => {
    s.oblRank = i + 1;
  });

  const jvService = (loan * Math.max(alloc.jvServiceFeePct, 0)) / 100;
  const chuanFee =
    alloc.placement === "none" ? 0 : Math.max(calc.guaranteeFeeUsd, 0);
  const guarantorSpread =
    alloc.placement === "none" ? 0 : Math.max(calc.spreadUsdSpot, 0);
  const guarantorRight = chuanFee + guarantorSpread;

  const bankGrossInterest = Math.max(calc.loanCostUsd, 0);
  const rightOrder: {
    party: PartyKey;
    label: string;
    amount: number;
    rank: number;
  }[] = [
    { party: "bank", label: "固收利息", amount: bankGrossInterest, rank: 1 },
    { party: "jv", label: "服务费（收入）", amount: jvService, rank: 2 },
    { party: "chuan", label: "息差+风险收益", amount: guarantorRight, rank: 3 },
  ].filter((x) => x.amount > 1e-9);

  let cursor = 0;
  const rightByParty = new Map<
    PartyKey,
    { start: number; share: number; amount: number; rank: number; label: string }
  >();
  for (const r of rightOrder) {
    const share = r.amount / loan;
    rightByParty.set(r.party, {
      start: cursor,
      share,
      amount: r.amount,
      rank: r.rank,
      label: r.label,
    });
    cursor += share;
  }

  const bankRight = rightByParty.get("bank");

  const funding: MapLeg = {
    id: "funding",
    party: "bank",
    label: "本金",
    entityLabel: "银行",
    oblRank: null,
    rightRank: bankRight?.rank ?? 1,
    rightLabel: bankRight?.label ?? "固收利息",
    start: 0,
    actual: 1,
    scope: 0,
    scopeStart: 0,
    incomeUsd: bankRight?.amount ?? 0,
    incomeStart: bankRight?.start ?? 0,
    incomeShare: bankRight?.share ?? 0,
  };

  const legs: MapLeg[] = [funding];
  for (const p of slots) {
    const rb = rightByParty.get(p.party);
    const attachRight =
      p.party === "jv"
        ? p.id === "jv-first-loss"
        : p.party === "bank"
          ? false
          : p.id === "guarantee";
    const useRight = Boolean(attachRight && rb && rb.amount > 0);
    legs.push({
      id: p.id,
      party: p.party,
      label: p.label,
      entityLabel: p.entityLabel,
      oblRank: p.oblRank,
      rightRank: useRight ? rb!.rank : null,
      rightLabel: useRight ? rb!.label : "",
      start: p.start,
      actual: p.actual,
      scope: p.scope,
      scopeStart: p.scopeStart,
      oblNote: p.oblNote,
      bridgeBankRight: p.bridgeBankRight,
      incomeUsd: useRight ? rb!.amount : 0,
      incomeStart: useRight ? rb!.start : 0,
      incomeShare: useRight ? rb!.share : 0,
      segments: p.segments,
    });
  }

  let axisMin = 0;
  let axisMax = 1;
  for (const leg of legs) {
    if (leg.id === "funding") continue;
    axisMin = Math.min(axisMin, leg.start);
    axisMax = Math.max(axisMax, leg.start + leg.actual);
    for (const seg of leg.segments ?? []) {
      axisMin = Math.min(axisMin, seg.start);
      axisMax = Math.max(axisMax, seg.start + seg.width);
    }
  }
  // 略留左边距，负向色块不贴边
  if (axisMin < -1e-9) axisMin = Math.min(axisMin * 1.05, axisMin - 0.02);

  if (axisMax > 1.001) {
    funding.oblNote = `银行出资仍为助贷本金 100%；轴延伸至 ${pct(axisMax * 100, 0)}% 仅因保函/保证金叠层（非银行增出资）`;
  }

  return { legs, interestOfLoan, axisMin, axisMax, emptyReason: undefined };
}

const OBL_COL_FR = 1;
const RIGHT_COL_FR = 1;
const FR_SUM = OBL_COL_FR + RIGHT_COL_FR;
/** 义务/权利两轨之间：细缝即可，虚线跨列时不宜拉开 */
const COL_GAP_PX = 4;
const DIVIDER_W_PX = 1;
const BRIDGE_GAP_PX = COL_GAP_PX * 2 + DIVIDER_W_PX;

/**
 * 权利轨与义务轨同轴：分母=助贷本金。
 * 固收利息 share=贷款利息/本金（贷款价×天数/360，如 25%），条长应按 100:25 对齐本金条。
 */
function bankRightColFrac(bankIncomeShare: number): number {
  return Math.min(Math.max(bankIncomeShare, 0), 1);
}

function bridgeSpanWidth(bankFracOnRightCol: number): string {
  const obl = OBL_COL_FR / FR_SUM;
  const right = RIGHT_COL_FR / FR_SUM;
  return `calc((100% - ${BRIDGE_GAP_PX}px) * ${obl} + ${BRIDGE_GAP_PX}px + (100% - ${BRIDGE_GAP_PX}px) * ${right} * ${bankFracOnRightCol})`;
}

/** 虚线框内 · 本金侧（义务列宽度） */
function bridgePrincipalZoneWidth(): string {
  const obl = OBL_COL_FR / FR_SUM;
  return `calc((100% - ${BRIDGE_GAP_PX}px) * ${obl})`;
}

/** 虚线框内 · 固收当量区（权利列银行固收段） */
function bridgeInterestZoneWidth(bankFracOnRightCol: number): string {
  const right = RIGHT_COL_FR / FR_SUM;
  return `calc((100% - ${BRIDGE_GAP_PX}px) * ${right} * ${bankFracOnRightCol})`;
}

function bridgeInterestZoneLeft(bankFracOnRightCol: number): string {
  const obl = OBL_COL_FR / FR_SUM;
  return `calc((100% - ${BRIDGE_GAP_PX}px) * ${obl} + ${BRIDGE_GAP_PX}px)`;
}

function JvBridgeSegmentLayer({
  bankRightFrac,
  rankMark,
  theme,
  marginFrac,
  marginStartFrac,
  compensatoryFrac,
  interestOfLoan,
  axisMin = 0,
  axisMax = 1,
}: {
  bankRightFrac: number;
  rankMark: string;
  theme: ReturnType<typeof useHostTheme>;
  /** 保证金占助贷本金比例 0–1（节降后实缴） */
  marginFrac: number;
  /** 保证金起点（0–1）；默认贴右端 1−m */
  marginStartFrac?: number;
  /** 代偿备付占助贷本金比例 0–1 */
  compensatoryFrac: number;
  interestOfLoan: number;
  axisMin?: number;
  axisMax?: number;
}) {
  const barTop = 25;
  const barH = 20;
  const obl = OBL_COL_FR / FR_SUM;
  const right = RIGHT_COL_FR / FR_SUM;
  const m = Math.max(marginFrac, 0);
  const c = Math.min(Math.max(compensatoryFrac, 0), 1);
  const iol = Math.max(interestOfLoan, 1e-9);
  const span = Math.max(axisMax - axisMin, 1e-9);
  const mStart = marginStartFrac ?? 1 - m;
  const mLeftFrac = (mStart - axisMin) / span;
  const mWidthFrac = m / span;
  const marginLeft = `calc((100% - ${BRIDGE_GAP_PX}px) * ${obl} * ${mLeftFrac})`;
  const marginWidth = `calc((100% - ${BRIDGE_GAP_PX}px) * ${obl} * ${mWidthFrac})`;
  const compInInterest = Math.min(c / iol, 1);
  const compWidth = `calc((100% - ${BRIDGE_GAP_PX}px) * ${right} * ${bankRightFrac} * ${compInInterest})`;
  /** 代偿备付画在银行固收当量区**左侧**，避免与 JV 服务费条贴在一起 */
  const compLeft = `calc((100% - ${BRIDGE_GAP_PX}px) * ${obl} + ${BRIDGE_GAP_PX}px)`;

  return (
    <>
      {m > 1e-9 ? (
        <div
          title={`保证金 ${pct(m * 100, 1)} · 本金侧`}
          style={{
            position: "absolute",
            left: marginLeft,
            top: barTop,
            height: barH,
            width: marginWidth,
            background: theme.category.cyan,
            borderRadius: 2,
            zIndex: 2,
            pointerEvents: "none",
          }}
        />
      ) : null}
      {c > 1e-9 ? (
        <div
          title={`代偿备付 ${pct(c * 100, 1)} · 义务备付（非收入），落固收当量区`}
          style={{
            position: "absolute",
            left: compLeft,
            top: barTop,
            height: barH,
            width: compWidth,
            background: theme.category.green,
            borderRadius: 2,
            zIndex: 2,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            paddingLeft: 4,
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              lineHeight: "12px",
              color: theme.text.primary,
              whiteSpace: "nowrap",
            }}
          >
            代偿 {pct(c * 100, 1)}
          </span>
        </div>
      ) : null}
      {rankMark ? (
        <span
          style={{
            position: "absolute",
            left: marginLeft,
            top: barTop + barH / 2,
            transform: "translate(calc(-100% - 4px), -50%)",
            fontSize: 11,
            fontWeight: 700,
            lineHeight: "14px",
            color: theme.text.primary,
            zIndex: 3,
            pointerEvents: "none",
          }}
        >
          {rankMark}
        </span>
      ) : null}
    </>
  );
}

function BarRankLabel({
  mark,
  side,
  anchorPct,
}: {
  mark: string;
  side: "left" | "right";
  anchorPct: number;
}) {
  const theme = useHostTheme();
  if (!mark) return null;
  const clamped = Math.min(Math.max(anchorPct, 0), 100);
  return (
    <span
      style={{
        position: "absolute",
        top: "50%",
        left: `${clamped}%`,
        transform:
          side === "left"
            ? "translate(calc(-100% - 4px), -50%)"
            : "translate(4px, -50%)",
        fontSize: 11,
        fontWeight: 700,
        lineHeight: "14px",
        color: theme.text.primary,
        whiteSpace: "nowrap",
        zIndex: 3,
        pointerEvents: "none",
      }}
    >
      {mark}
    </span>
  );
}

function WaterfallTrack({
  kind,
  party,
  label,
  rankMark,
  start,
  actual,
  scope,
  scopeStart,
  amountLabel,
  axisMin = 0,
  axisMax,
  vintagePct,
  showVintage,
  segments,
  note,
  negativeTone,
}: {
  kind: "obligation" | "right";
  party: PartyKey;
  label: string;
  rankMark: string;
  start: number;
  actual: number;
  scope: number;
  scopeStart: number;
  amountLabel: string;
  axisMin?: number;
  axisMax: number;
  vintagePct: number;
  showVintage: boolean;
  segments?: MapLeg["segments"];
  note?: string;
  /** 负敞口：条纹提示 */
  negativeTone?: boolean;
}) {
  const theme = useHostTheme();
  const color = partyColor(party, theme);
  const isObl = kind === "obligation";
  const span = Math.max(axisMax - axisMin, 1e-9);
  const toPct = (x: number) => ((x - axisMin) / span) * 100;
  const segColor = (key: NonNullable<MapLeg["segments"]>[number]["color"]) =>
    theme.category[key];
  const barLeftPct =
    segments && segments.length > 0
      ? toPct(Math.min(...segments.map((s) => s.start)))
      : toPct(start);
  const barRightPct =
    segments && segments.length > 0
      ? toPct(
          Math.max(...segments.map((s) => s.start + s.width)),
        )
      : toPct(start + actual);
  const zeroPct = toPct(0);
  const showZero = isObl && axisMin < -1e-6 && axisMax > 1e-6;

  return (
    <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
      <Row gap={6} align="center" wrap>
        <Text size="small" weight="semibold">
          {label}
        </Text>
        <Text size="small" tone="tertiary">
          {amountLabel}
        </Text>
      </Row>
      <div
        style={{
          position: "relative",
          height: 30,
          width: "100%",
          borderRadius: 3,
          background: theme.fill.tertiary,
          boxSizing: "border-box",
          overflow: "visible",
        }}
      >
        {showZero ? (
          <div
            title="本金 0%"
            style={{
              position: "absolute",
              left: `${zeroPct}%`,
              top: 0,
              bottom: 0,
              borderLeft: `1.5px solid ${theme.stroke.primary}`,
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
        ) : null}
        {isObl && scope > 0.0001 ? (
          <div
            style={{
              position: "absolute",
              left: `${toPct(scopeStart)}%`,
              width: `${Math.max(toPct(scopeStart + Math.min(scope, span)) - toPct(scopeStart), 0.8)}%`,
              top: 1,
              bottom: 1,
              border: `1.5px dashed ${color}`,
              borderRadius: 2,
              boxSizing: "border-box",
              pointerEvents: "none",
            }}
          />
        ) : null}
        {segments && segments.length > 0
          ? segments.map((seg) => (
              <div
                key={seg.id}
                title={seg.label}
                style={{
                  position: "absolute",
                  left: `${toPct(seg.start)}%`,
                  width: `${Math.max(toPct(seg.start + seg.width) - toPct(seg.start), 0.8)}%`,
                  top: 3,
                  bottom: 3,
                  background: segColor(seg.color),
                  borderRadius: 2,
                }}
              />
            ))
          : actual > 0 ? (
              <div
                style={{
                  position: "absolute",
                  left: `${toPct(start)}%`,
                  width: `${Math.max(toPct(start + actual) - toPct(start), 0.8)}%`,
                  top: isObl && scope > 0.0001 ? 5 : 3,
                  bottom: isObl && scope > 0.0001 ? 5 : 3,
                  background: color,
                  borderRadius: 2,
                  opacity: negativeTone ? 0.75 : 1,
                  outline: negativeTone
                    ? `1.5px dashed ${theme.stroke.primary}`
                    : undefined,
                  outlineOffset: negativeTone ? -1 : undefined,
                }}
              />
            ) : null}
        {isObl && rankMark && (actual > 0 || (segments && segments.length > 0)) ? (
          <BarRankLabel mark={rankMark} side="left" anchorPct={barLeftPct} />
        ) : null}
        {!isObl && rankMark && actual > 0 ? (
          <BarRankLabel mark={rankMark} side="right" anchorPct={barRightPct} />
        ) : null}
        {showVintage && isObl ? (
          <div
            style={{
              position: "absolute",
              left: `${toPct(Math.max(0, 1 - vintagePct / 100))}%`,
              top: 0,
              bottom: 0,
              borderLeft: `1.5px dashed ${theme.text.tertiary}`,
              pointerEvents: "none",
            }}
          />
        ) : null}
      </div>
      {note ? (
        <Text size="small" tone="tertiary">
          {note}
        </Text>
      ) : null}
    </Stack>
  );
}

function AxisScale({
  leftLabel,
  midLabel,
  midAtPct,
  rightLabel,
}: {
  leftLabel: string;
  midLabel: string;
  /** 中点位置 0–100；缺省 50 */
  midAtPct?: number;
  rightLabel: string;
}) {
  const theme = useHostTheme();
  const midLeft = midAtPct ?? 50;
  return (
    <div
      style={{
        position: "relative",
        height: 14,
        marginTop: 2,
        borderTop: `1px solid ${theme.stroke.tertiary}`,
      }}
    >
      <Text
        size="small"
        tone="tertiary"
        style={{ position: "absolute", left: 0, top: 2 }}
      >
        {leftLabel}
      </Text>
      {midLabel ? (
        <Text
          size="small"
          tone="tertiary"
          style={{
            position: "absolute",
            left: `${midLeft}%`,
            top: 2,
            transform: "translateX(-50%)",
          }}
        >
          {midLabel}
        </Text>
      ) : null}
      <Text
        size="small"
        tone="tertiary"
        style={{ position: "absolute", right: 0, top: 2 }}
      >
        {rightLabel}
      </Text>
    </div>
  );
}

function RightsObligationsMap({
  alloc: allocIn,
  allocation,
  calc,
  inputs,
}: {
  alloc: AllocParams;
  allocation: Allocation;
  calc: Calc;
  inputs: Inputs;
}) {
  const theme = useHostTheme();
  const alloc = normalizeAlloc(allocIn);
  const { legs, interestOfLoan, axisMin, axisMax, emptyReason } = useMemo(
    () => buildWaterfallLegs(alloc, allocation, calc, inputs),
    [alloc, allocation, calc, inputs],
  );
  const parties: PartyKey[] = ["bank", "jv", "mfi", "chuan"];
  const loan = Math.max(calc.loanPrincipalUsd, 0);
  const bankLeg = legs.find((l) => l.id === "funding");
  const bankRightFrac = bankRightColFrac(
    bankLeg?.incomeShare ?? interestOfLoan,
  );
  const gFrac =
    alloc.placement === "none" ? 0 : Math.max(calc.guaranteeUsd / Math.max(loan, 1e-9), 0);
  const vintageLine = Math.max(0, Math.min(1, 1 - alloc.vintageElPct / 100));
  const marginPctEff = effectiveMarginPct(alloc, inputs) / 100;
  const axisSpan = Math.max(axisMax - axisMin, 1e-9);
  const zeroAtPct = ((0 - axisMin) / axisSpan) * 100;
  const principal100AtPct = ((1 - axisMin) / axisSpan) * 100;
  const axisExtendsPast100 = axisMax > 1.001;
  const oblLeftLabel =
    axisMin < -1e-6 ? pct(axisMin * 100, 0) : "0%";
  const oblMidLabel = axisMin < -1e-6 ? "0%" : axisExtendsPast100 ? "100%" : "50%";
  const oblMidAtPct = axisMin < -1e-6 ? zeroAtPct : axisExtendsPast100 ? principal100AtPct : 50;
  const oblRightLabel = axisExtendsPast100 ? pct(axisMax * 100, 0) : "100%";

  if (emptyReason) {
    return (
      <Callout tone="warning" title="本金轴已清空">
        {emptyReason}
        。调高保函金额或开启利息前置并填入存款本金后，色块随助贷本金重新联动。
      </Callout>
    );
  }

  return (
    <Stack gap={12}>
      <Row gap={10} align="center" wrap style={{ rowGap: 6 }}>
        <Text
          size="small"
          weight="semibold"
          style={{ whiteSpace: "nowrap", flexShrink: 0 }}
        >
          本币贷款端 · 权利义务瀑布
        </Text>
        <Text size="small" tone="tertiary" style={{ flexShrink: 0 }}>
          ·
        </Text>
        {parties.map((p) => (
          <Row key={p} gap={4} align="center" style={{ flexShrink: 0 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: partyColor(p, theme),
              }}
            />
            <Text size="small" tone="tertiary" style={{ whiteSpace: "nowrap" }}>
              {partyName(p)}
            </Text>
          </Row>
        ))}
        {legs.some((l) => l.id === "jv-first-loss") ? (
          <>
            <Text size="small" tone="tertiary" style={{ flexShrink: 0 }}>
              ·
            </Text>
            <Text
              size="small"
              tone="tertiary"
              style={{ whiteSpace: "nowrap", flexShrink: 0 }}
            >
              JV分段
            </Text>
            <Row gap={4} align="center" style={{ flexShrink: 0 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: theme.category.cyan,
                }}
              />
              <Text size="small" tone="tertiary" style={{ whiteSpace: "nowrap" }}>
                保证金·本金轴 {pct(marginPctEff * 100, 1)}
              </Text>
            </Row>
            <Row gap={4} align="center" style={{ flexShrink: 0 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: theme.category.green,
                }}
              />
              <Text size="small" tone="tertiary" style={{ whiteSpace: "nowrap" }}>
                代偿备付（义务）{pct(alloc.compensatoryPct, 1)}
              </Text>
            </Row>
          </>
        ) : null}
        <Spacer />
        <Text
          size="small"
          tone="tertiary"
          style={{ whiteSpace: "nowrap", flexShrink: 0 }}
        >
          同轴=助贷本金 · 固收条长=贷款利息/本金（如 25%）
        </Text>
      </Row>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `108px minmax(0, ${OBL_COL_FR}fr) ${DIVIDER_W_PX}px minmax(0, ${RIGHT_COL_FR}fr)`,
          columnGap: COL_GAP_PX,
          alignItems: "end",
        }}
      >
        <div />
        <Stack gap={0}>
          <Text size="small" weight="semibold">
            义务 · 本金
          </Text>
          <AxisScale
            leftLabel={oblLeftLabel}
            midLabel={oblMidLabel}
            midAtPct={oblMidAtPct}
            rightLabel={oblRightLabel}
          />
        </Stack>
        <div />
        <Stack gap={0}>
          <Text size="small" weight="semibold">
            权利 · 同本金比例
          </Text>
          <AxisScale
            leftLabel="0%"
            midLabel=""
            rightLabel={
              interestOfLoan > 1e-6
                ? `固收 ${pct(interestOfLoan * 100, 1)}`
                : "100%"
            }
          />
        </Stack>
      </div>

      <Stack gap={14}>
        {legs.map((leg) => {
          const oblMark =
            leg.oblRank == null
              ? ""
              : CIRCLED[leg.oblRank - 1] ?? String(leg.oblRank);
          const rightMark =
            leg.rightRank != null
              ? CIRCLED[leg.rightRank - 1] ?? String(leg.rightRank)
              : "";
          const oblAmt =
            leg.id === "funding"
              ? `100% · ${formatUsdWanStat(loan)}`
              : leg.id === "guarantee"
                ? `保函 ${pct(leg.actual * 100, 1)} · ${formatUsdWanStat(calc.guaranteeUsd)}`
              : leg.id === "bank-residual" && leg.start < -1e-9
                ? `−${pct(leg.actual * 100, 1)} · ${formatUsdWanStat(loan * leg.actual)}`
              : leg.id === "jv-first-loss" && leg.segments
                ? leg.segments
                    .map((s) => `${s.label} ${pct(s.width * 100, 1)}`)
                    .join(" · ")
                : `${pct(leg.actual * 100, 1)} · ${formatUsdWanStat(loan * leg.actual)}`;
          const rightAmt =
            leg.incomeShare > 0
              ? `${pct((leg.incomeUsd / loan) * 100, 2)} · ${formatUsdWanStat(leg.incomeUsd)}`
              : "";

          return (
            <div
              key={leg.id}
              style={{
                display: "grid",
                gridTemplateColumns: `108px minmax(0, ${OBL_COL_FR}fr) ${DIVIDER_W_PX}px minmax(0, ${RIGHT_COL_FR}fr)`,
                columnGap: COL_GAP_PX,
                alignItems: "start",
              }}
            >
              <Stack gap={2} style={{ paddingTop: 18 }}>
                <Text size="small" weight="semibold">
                  {leg.entityLabel}
                </Text>
                <Text size="small" tone="tertiary">
                  {leg.rightRank != null
                    ? leg.rightLabel
                    : leg.id === "funding"
                      ? "出资 100%"
                        : leg.id === "bank-residual"
                        ? leg.start < -1e-9
                          ? "缓释超额·负敞口"
                          : "缓释后纯敞口"
                        : leg.id === "mfi-credit"
                          ? "净资产（配置）"
                          : leg.id === "jv-first-loss"
                            ? "保证金 · 代偿备付"
                            : "仅义务"}
                </Text>
              </Stack>
              {leg.bridgeBankRight ? (
                <div
                  style={{
                    gridColumn: "2 / 5",
                    display: "flex",
                    gap: COL_GAP_PX,
                    alignItems: "start",
                    position: "relative",
                  }}
                >
                  <div style={{ flex: OBL_COL_FR, minWidth: 0 }}>
                    <WaterfallTrack
                      kind="obligation"
                      party={leg.party}
                      label={leg.label}
                      rankMark={leg.id === "jv-first-loss" ? "" : oblMark}
                      start={leg.id === "jv-first-loss" ? 0 : leg.start}
                      actual={leg.id === "jv-first-loss" ? 0 : leg.actual}
                      scope={0}
                      scopeStart={0}
                      amountLabel={oblAmt}
                      axisMin={axisMin}
                      axisMax={axisMax}
                      vintagePct={alloc.vintageElPct}
                      showVintage
                      segments={
                        leg.id === "jv-first-loss" ? undefined : leg.segments
                      }
                      note={leg.oblNote}
                      negativeTone={
                        leg.id === "bank-residual" && leg.start < -1e-9
                      }
                    />
                  </div>
                  <div
                    style={{
                      width: DIVIDER_W_PX,
                      marginTop: 22,
                      height: 30,
                      background: theme.stroke.secondary,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: RIGHT_COL_FR, minWidth: 0 }}>
                    {leg.incomeShare > 0 ? (
                      <WaterfallTrack
                        kind="right"
                        party={leg.party}
                        label={leg.rightLabel}
                        rankMark={rightMark}
                        start={leg.incomeStart}
                        actual={leg.incomeShare}
                        scope={0}
                        scopeStart={0}
                        amountLabel={rightAmt}
                        axisMax={1}
                        vintagePct={0}
                        showVintage={false}
                        note={
                          leg.id === "jv-first-loss" &&
                          alloc.compensatoryPct > 1e-6
                            ? `同轨左侧绿条=代偿备付 ${pct(alloc.compensatoryPct, 1)}（义务备付，非收入）`
                            : undefined
                        }
                      />
                  ) : (
                    <div style={{ minHeight: 48 }} />
                  )}
                  </div>
                  {leg.id === "jv-first-loss" ? (
                    <JvBridgeSegmentLayer
                      bankRightFrac={bankRightFrac}
                      rankMark={oblMark}
                      theme={theme}
                      marginFrac={marginPctEff}
                      marginStartFrac={
                        alloc.placement === "help_mfi"
                          ? vintageLine + gFrac
                          : undefined
                      }
                      compensatoryFrac={Math.max(alloc.compensatoryPct, 0) / 100}
                      interestOfLoan={interestOfLoan}
                      axisMin={axisMin}
                      axisMax={axisMax}
                    />
                  ) : null}
                </div>
              ) : (
                <>
                  <WaterfallTrack
                    kind="obligation"
                    party={leg.party}
                    label={
                      leg.id === "funding" ? `出资 · ${leg.label}` : leg.label
                    }
                    rankMark={oblMark}
                    start={leg.start}
                    actual={leg.actual}
                    scope={leg.scope}
                    scopeStart={leg.scopeStart}
                    amountLabel={oblAmt}
                    axisMin={leg.id === "funding" ? 0 : axisMin}
                    axisMax={leg.id === "funding" ? 1 : axisMax}
                    vintagePct={alloc.vintageElPct}
                    showVintage={leg.id !== "funding"}
                    segments={leg.segments}
                    note={leg.oblNote}
                    negativeTone={
                      leg.id === "bank-residual" && leg.start < -1e-9
                    }
                  />
                  <div
                    style={{
                      width: DIVIDER_W_PX,
                      marginTop: 22,
                      height: 30,
                      background: theme.stroke.secondary,
                      justifySelf: "center",
                    }}
                  />
                  {leg.incomeShare > 0 ? (
                    <WaterfallTrack
                      kind="right"
                      party={leg.party}
                      label={leg.rightLabel}
                      rankMark={rightMark}
                      start={leg.incomeStart}
                      actual={leg.incomeShare}
                      scope={0}
                      scopeStart={0}
                      amountLabel={rightAmt}
                      axisMax={1}
                      vintagePct={0}
                      showVintage={false}
                    />
                  ) : (
                    <div style={{ minHeight: 48 }} />
                  )}
                </>
              )}
            </div>
          );
        })}
      </Stack>

      <Row gap={8} wrap>
        <Text size="small" tone="tertiary">
          义务序号=色条左 · 权利序号=色条右
        </Text>
        <Text size="small" tone="tertiary">
          ·
        </Text>
        <Text size="small" tone="tertiary">
          义务①=先损
        </Text>
        <Text size="small" tone="tertiary">
          ·
        </Text>
        <Text size="small" tone="tertiary">
          权利①=先分
        </Text>
        <Text size="small" tone="tertiary">
          ·
        </Text>
        <Text size="small" tone="tertiary">
          EL 竖虚线=Vintage 刻度 · 帮小贷：小贷在左、保函贴线右、保证金再右
        </Text>
      </Row>
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
  const scrollAnchorRef = usePreserveCanvasScroll();
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
  const [allocParams, setAllocParams] = useCanvasState<AllocParams>(
    "guarantee-alloc-v1",
    DEFAULT_ALLOC,
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
  const allocNorm = useMemo(
    () => normalizeAlloc(allocParams),
    [allocParams],
  );
  const effectiveMargin = useMemo(
    () => effectiveMarginPct(allocNorm, inputs),
    [allocNorm, inputs],
  );
  const allocInputs = useMemo(
    () => ({ ...inputs, marginPct: effectiveMargin }),
    [inputs, effectiveMargin],
  );
  const allocCalc = useMemo(() => compute(allocInputs), [allocInputs]);
  const allocation = useMemo(
    () => computeAllocation(allocInputs, allocCalc, allocNorm),
    [allocInputs, allocCalc, allocNorm],
  );
  const patchAlloc = (p: Partial<AllocParams>) =>
    setAllocParams((prev) => normalizeAlloc({ ...prev, ...p }));
  const onlendPremiumPp = round2(inputs.onlendPct - calc.pairDiff * 100);
  const patch = (p: Partial<Inputs>) => setInputs((prev) => ({ ...prev, ...p }));

  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState<string | null>(null);
  const [fxAsOf, setFxAsOf] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useCanvasState<ExportFormat>(
    "guarantee-export-format-v1",
    "excel",
  );
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const runExport = useCallback(() => {
    try {
      const msg = exportGuaranteeReport(
        {
          inputs: allocInputs,
          calc: allocCalc,
          allocation,
          allocParams: allocNorm,
          country,
          chuanMerge,
          chuanIncludeJv,
          targetUsdYieldPct,
          generatedAt: new Date().toLocaleString("zh-CN"),
        },
        exportFormat,
      );
      setExportNotice(msg);
      window.setTimeout(() => setExportNotice(null), 8000);
    } catch (e) {
      setExportNotice(e instanceof Error ? e.message : "导出失败");
    }
  }, [
    allocInputs,
    allocCalc,
    allocation,
    allocNorm,
    country,
    chuanMerge,
    chuanIncludeJv,
    targetUsdYieldPct,
    exportFormat,
  ]);

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
      setInputs((prev) => ({
        ...fromPreset(PRESETS.NG),
        loanRatePct: loan,
        onlendPct: ngOnlendFromLoan(loan),
        interestUpfront: prev.interestUpfront !== false,
      }));
      return;
    }
    setInputs((prev) => ({
      ...fromPreset(PRESETS[id]),
      interestUpfront: prev.interestUpfront !== false,
    }));
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
    <div ref={scrollAnchorRef}>
    <Stack gap={20} style={{ padding: 24, maxWidth: 1120 }}>
      <Stack gap={8}>
        <H1>跨境保函项下转贷测算</H1>
        <Text tone="secondary">
          出美元开保函、帮当地机构融本币。正向算 CHUAN 综合收益率；倒推锁门槛反解转贷报价。
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
                ? " · 表内"
                : id === "NG"
                  ? " · CBN"
                  : " · 外推"}
            </Pill>
          ))}
          <Spacer />
          <Button variant="ghost" onClick={() => loadCountry(inputs.countryId)}>
            恢复预设
          </Button>
        </Row>
        <Row gap={8} wrap align="center">
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

      <Stat
        tone="success"
        label={`CHUAN 综合收益率 · ${chuanMerge.suffix}`}
        value={pct(chuanMerge.yieldPct * 100, 2)}
      />

      <Row gap={8} align="center" wrap>
        <Text size="small" weight="semibold">
          满意本次测算？
        </Text>
        <Pill
          active={exportFormat === "excel"}
          onClick={() => setExportFormat("excel")}
        >
          Excel · 含公式
        </Pill>
        <Pill active={exportFormat === "pdf"} onClick={() => setExportFormat("pdf")}>
          PDF
        </Pill>
        <Button variant="secondary" onClick={runExport}>
          生成测算表
        </Button>
        {exportNotice ? (
          <Text size="small" tone="tertiary">
            {exportNotice}
          </Text>
        ) : (
          <Text size="small" tone="tertiary">
            {exportFormat === "excel"
              ? "下载 .xls，黄底可改参数、蓝底为公式"
              : "打开打印预览后另存为 PDF"}
          </Text>
        )}
      </Row>

      {inputs.countryId === "NG" ? (
        <PersistCollapsibleSection
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
        </PersistCollapsibleSection>
      ) : null}

      <PersistCollapsibleSection
        title="三端拆分"
        defaultOpen={false}
        trailing={
          <Text size="small" tone="tertiary">
            美元侧 · 本币存款 · 本币贷款
          </Text>
        }
      >
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
              calc.marginLocal > 0
                ? formatUsdWanStat(calc.marginInterestUsd)
                : undefined
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
      </PersistCollapsibleSection>

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

      <Divider />

      <Stack gap={12}>
        <Stack gap={4}>
          <H2>分配侧 · 权利义务对照</H2>
          <Text tone="secondary">
            左义务、右权利；同色=同一主体。价格/折扣在「定价横梁」，保函面额在「结构参数」——此处配分配、缓释与保证金。
          </Text>
        </Stack>

        <Row gap={8} wrap align="center">
          {(
            [
              { id: "none" as const, label: "不开保函" },
              { id: "help_mfi" as const, label: "帮小贷劣后" },
              { id: "help_bank" as const, label: "帮银行缓释" },
            ] as const
          ).map((opt) => (
            <Pill
              key={opt.id}
              active={allocParams.placement === opt.id}
              onClick={() => patchAlloc({ placement: opt.id })}
            >
              {opt.label}
            </Pill>
          ))}
          <Pill
            active={isInterestUpfront(inputs)}
            onClick={() =>
              patch({ interestUpfront: !isInterestUpfront(inputs) })
            }
          >
            利息前置
          </Pill>
          <Spacer />
          <Text size="small" tone="tertiary">
            {allocParams.placement === "none"
              ? "无保证义务 · 无风险收益"
              : allocParams.placement === "help_mfi"
                ? "保函节降 JV 保证金 · 应向小贷收更高报价"
                : "保函缓释银行 · JV 保证金不节降"}
            {isInterestUpfront(inputs)
              ? " · 面额含息"
              : " · 面额不含息（开不出含息保函）"}
          </Text>
        </Row>

        <Grid columns={4} gap={12}>
          <Stack gap={4}>
            <Text size="small" tone="tertiary">
              保函面额
            </Text>
            <Text size="small" weight="semibold">
              {formatUsdWanStat(calc.guaranteeUsd)}
            </Text>
            <Text size="small" tone="tertiary">
              改「结构参数」
            </Text>
          </Stack>
          <Stack gap={4}>
            <Text size="small" tone="tertiary">
              折扣率
            </Text>
            <Text size="small" weight="semibold">
              {pct(inputs.discountPct, 0)}
            </Text>
            <Text size="small" tone="tertiary">
              改「定价横梁」
            </Text>
          </Stack>
          <Stack gap={4}>
            <Text size="small" tone="tertiary">
              助贷本金（联动）
            </Text>
            <Text size="small" weight="semibold">
              {formatUsdWanStat(calc.loanPrincipalUsd)}
            </Text>
            <Text size="small" tone="tertiary">
              = 保函×折扣÷(1+贷款价×天/365)
            </Text>
          </Stack>
          <Stack gap={4}>
            <Text size="small" tone="tertiary">
              保函/本金
            </Text>
            <Text size="small" weight="semibold">
              {pct(
                (calc.guaranteeUsd / Math.max(calc.loanPrincipalUsd, 1e-9)) *
                  100,
                1,
              )}
            </Text>
            <Text size="small" tone="tertiary">
              保证色块厚度（测算）
            </Text>
          </Stack>
        </Grid>
        <Row gap={8} wrap align="center">
          {allocParams.placement === "help_mfi" ? (
            <Pill size="sm">
              节降后保证金 {pct(inputs.marginPct, 0)}（定价横梁）· 保证金{" "}
              {pct(allocParams.marginWithoutGuaranteePct, 0)} · 节降{" "}
              {pct(allocation.marginReliefPp, 0)}
            </Pill>
          ) : allocParams.placement === "help_bank" ? (
            <Pill size="sm">
              JV 全额保证金 {pct(effectiveMargin, 0)}（保函不节降）
            </Pill>
          ) : (
            <Pill size="sm">
              保证金 {pct(inputs.marginPct, 0)}
            </Pill>
          )}
          <Pill size="sm">
            贷款 {pct(inputs.loanRatePct)} · 转贷 {pct(inputs.onlendPct)}
          </Pill>
          {allocCalc.marginLocal > 0 ? (
            <Text size="small" tone="tertiary">
              保证金本金 {num(allocCalc.marginLocal, 2)} 万{country.ccyName}
            </Text>
          ) : null}
        </Row>
        <Grid columns={4} gap={12}>
          <Field
            label="保证金"
            suffix="%·助贷本金"
            value={
              allocParams.placement === "help_mfi" ||
              allocParams.placement === "help_bank"
                ? allocParams.marginWithoutGuaranteePct
                : inputs.marginPct
            }
            step={1}
            onChange={(n) => {
              if (
                allocParams.placement === "help_mfi" ||
                allocParams.placement === "help_bank"
              ) {
                patchAlloc({ marginWithoutGuaranteePct: n });
              } else {
                patch({ marginPct: Math.max(0, n) });
              }
            }}
            hint={
              allocParams.placement === "help_mfi"
                ? `保函可节降 → 实缴 ${pct(inputs.marginPct, 0)} 在定价横梁`
                : allocParams.placement === "help_bank"
                  ? "JV 按此全额缴，保函不节降"
                  : "JV 代存保证金"
            }
          />
          <Field
            label="EL"
            suffix="%·本金"
            value={allocParams.vintageElPct}
            onChange={(n) => patchAlloc({ vintageElPct: n })}
            hint="Vintage 预期损失刻度；不决定银行色块"
          />
          <Field
            label="小贷净资产"
            suffix="%·助贷本金"
            value={allocParams.mfiCreditPct}
            onChange={(n) => patchAlloc({ mfiCreditPct: n })}
            hint="按实际情况配置"
          />
          <Field
            label="代偿备付"
            suffix="%·助贷本金"
            value={allocParams.compensatoryPct}
            onChange={(n) => patchAlloc({ compensatoryPct: n })}
            hint="日常代偿；落固收当量区，不占本金轴"
          />
        </Grid>
        <Grid columns={1} gap={12}>
          <Field
            label="JV 服务费"
            suffix="%·助贷本金"
            value={allocParams.jvServiceFeePct ?? 0.2}
            step={0.1}
            onChange={(n) => patchAlloc({ jvServiceFeePct: n })}
            hint="默认 0.2%"
          />
        </Grid>
        <Row gap={12} wrap align="center">
          <Text size="small" tone="tertiary">
            银行风险敞口（倒算）
          </Text>
          <Text size="small" weight="semibold">
            {pct(
              100 -
                effectiveMargin -
                allocParams.mfiCreditPct -
                (allocParams.placement === "help_bank"
                  ? (allocCalc.guaranteeUsd /
                      Math.max(allocation.loanUsd, 1e-9)) *
                    100
                  : 0),
              1,
            )}
          </Text>
          <Text size="small" tone="tertiary">
            {allocParams.placement === "help_mfi"
              ? "= 本金 − 保证金 − 小贷净资产（保函不进银行倒算）"
              : allocParams.placement === "help_bank"
                ? "= 本金 − 保证金 − 小贷净资产 − 保函"
                : "= 本金 − 保证金 − 小贷净资产"}
          </Text>
        </Row>

        <RightsObligationsMap
          alloc={allocNorm}
          allocation={allocation}
          calc={allocCalc}
          inputs={allocInputs}
        />

        <H3>三主体当期（折美元）</H3>
        <Text size="small" tone="secondary">
          按收入从高到低。保证主体赚转贷相对银行报价的差价；JV 赚服务费与或有保证金利息；银行收入=发放本金固收利息，成本=代付保证金存款利息。
        </Text>
        <Grid columns={3} gap={12}>
          {allocation.parties.map((p) => (
            <Card key={p.party}>
              <CardHeader
                trailing={
                  <Pill size="sm">
                    {p.party === "chuan"
                      ? "保证"
                      : p.party === "jv"
                        ? "服务"
                        : "息差"}
                  </Pill>
                }
              >
                {p.nameZh}
              </CardHeader>
              <CardBody>
                <Stack gap={8}>
                  <Stat
                    value={formatUsdWanStat(p.incomeUsd)}
                    label="收入 · 万美元"
                    tone="success"
                  />
                  {p.costUsd > 1e-9 ? (
                    <Stat
                      value={formatUsdWanStat(p.costUsd)}
                      label={
                        p.party === "bank"
                          ? "成本 · 保证金存款利息"
                          : "成本 · 万美元"
                      }
                      tone="warning"
                    />
                  ) : null}
                  {p.costUsd > 1e-9 ? (
                    <Stat
                      value={formatUsdWanStat(p.netUsd)}
                      label="净额 · 万美元"
                      tone="info"
                    />
                  ) : null}
                  <Row gap={8} wrap>
                    {p.riskPremiumUsd > 1e-9 ? (
                      <Pill size="sm">
                        风险溢价 {formatUsdWanStat(p.riskPremiumUsd)}
                      </Pill>
                    ) : null}
                    <Pill size="sm">
                      {p.party === "bank" ? "息差" : "Carry"}{" "}
                      {formatUsdWanStat(p.carryUsd)}
                    </Pill>
                  </Row>
                  <Text size="small" tone="secondary">
                    出资：{p.fundingRole}
                  </Text>
                  <Text size="small" tone="secondary">
                    信用：{p.creditRole}
                  </Text>
                  {p.note ? (
                    <Text size="small" tone="tertiary">
                      {p.note}
                    </Text>
                  ) : null}
                </Stack>
              </CardBody>
            </Card>
          ))}
        </Grid>

        <Table
          headers={[
            "主体",
            "收入",
            "成本",
            "净额",
            "其中风险溢价",
            "出资义务",
            "信用义务",
          ]}
          columnAlign={[
            "left",
            "right",
            "right",
            "right",
            "right",
            "left",
            "left",
          ]}
          striped
          rows={allocation.parties.map((p) => [
            p.nameZh,
            formatUsdWanStat(p.incomeUsd),
            formatUsdWanStat(p.costUsd),
            formatUsdWanStat(p.netUsd),
            formatUsdWanStat(p.riskPremiumUsd),
            p.fundingRole,
            p.creditRole,
          ])}
        />

        <PersistCollapsibleSection title="分配口径" defaultOpen={false}>
          <Table
            headers={["项", "口径"]}
            rows={[
              [
                "列示顺序",
                "三主体按当期收入从高到低排列。",
              ],
              [
                "保证主体",
                "开保函参与银行风险 → 收入=转贷相对银行贷款报价的差价 + 保函存款利息 + 保函费（风险溢价）。不定向指具体机构。",
              ],
              [
                "JV",
                "收入=本地服务费（助贷本金×可配比例）+ 或有保证金存款利息（视谈判）。",
              ],
              [
                "本地银行",
                "收入=发放本金的贷款固收利息；成本=代付 JV 保证金存款利息（可核验存款成本）；净额=固收·场景息差。不含无法考证的吸储成本。",
              ],
              [
                "保函位置",
                "帮小贷劣后：保函节降 JV 代缴保证金（无保函对照 % → 定价横梁节降后 %），保函不进银行敞口倒算。帮银行缓释：JV 按无保函对照全额缴保证金，保函挡在银行敞口前。",
              ],
              [
                "图读法",
                "助贷本金=保函×折扣÷(1+贷款价×天/365)。保证色块=保函/本金。银行敞口=缓释后剩余。",
              ],
            ]}
          />
        </PersistCollapsibleSection>
      </Stack>

      <PersistCollapsibleSection
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
                +/− 收益率步长 {pct(TARGET_YIELD_STEP)}
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
      </PersistCollapsibleSection>

      <PersistCollapsibleSection
        title="定价横梁"
        defaultOpen={false}
        trailing={
          <Text size="small" tone="tertiary">
            存 {pct(inputs.depositRatePct)} · 费 {pct(inputs.guaranteeFeePct)} · 贷{" "}
            {pct(inputs.loanRatePct)} · 转贷 {pct(inputs.onlendPct)} · 折扣{" "}
            {pct(inputs.discountPct, 0)} · 保证金 {pct(inputs.marginPct, 0)}
          </Text>
        }
      >
        <Stack gap={16}>
          <Text size="small" tone="secondary">
            四条价格 + 保函折扣 + 本币保证金（全页唯一入口）。改横梁即重算；保函存款与展业国无关。
          </Text>
          <Grid columns={4} gap={12}>
            <Field
              label="存款价格"
              suffix="% · 保函存款"
              value={inputs.depositRatePct}
              step={0.1}
              onChange={(n) => patch({ depositRatePct: n })}
              hint="表内 4.50%"
            />
            <Field
              label="保函手续费"
              suffix="% · 保函行"
              value={inputs.guaranteeFeePct}
              step={0.1}
              onChange={(n) => patch({ guaranteeFeePct: n })}
              hint="全额质押约 0.8–1.0%"
            />
            <Field
              label={`贷款价格 · ${country.ccy}`}
              suffix="%"
              value={inputs.loanRatePct}
              step={0.1}
              onChange={(n) => patch({ loanRatePct: n })}
              hint={
                inputs.countryId === "NG"
                  ? `${selectedNgBank.name} · ${ngLoanTier}`
                  : country.quoted
                    ? "表内 6.20%"
                    : `外推 ${country.localPolicyPct}%+1.45pp`
              }
            />
            <Field
              label="转贷价格"
              suffix="% · 借款客户"
              value={inputs.onlendPct}
              step={0.1}
              onChange={(n) => patch({ onlendPct: n })}
              hint={
                implied
                  ? `倒推 ${pct(implied.impliedOnlendPct)} 可写入`
                  : `政策利差 ${pct(calc.pairDiff * 100, 2)} · 加点 ${onlendPremiumPp >= 0 ? "+" : ""}${pct(onlendPremiumPp, 2)}`
              }
            />
          </Grid>
          <Grid columns={4} gap={12}>
            <Field
              label={`${country.regulator} 政策利率`}
              suffix="%"
              value={inputs.localPolicyPct}
              step={0.1}
              onChange={(n) => patch({ localPolicyPct: n })}
            />
            <Field
              label="USD 政策利率"
              suffix="%"
              value={inputs.usdPolicyPct}
              step={0.1}
              onChange={(n) => patch({ usdPolicyPct: n })}
              hint={`利差 ${pct(calc.pairDiff * 100, 2)}`}
            />
            <Field
              label="保函折扣率"
              suffix="%"
              value={inputs.discountPct}
              step={10}
              onChange={(n) => patch({ discountPct: n })}
              hint={`助贷本金 ≈ ${formatUsdWanStat(calc.loanPrincipalUsd)}`}
            />
            <Field
              label="本币保证金比例"
              suffix="%"
              value={inputs.marginPct}
              step={1}
              onChange={(n) => patch({ marginPct: Math.max(0, n) })}
              hint={`→ ${num(calc.marginLocal, 2)} 万${country.ccyName}`}
            />
          </Grid>
          <Grid columns={2} gap={12}>
            <Field
              label={`保证金存款利率 · ${country.ccy}`}
              suffix="%"
              value={inputs.localDepositRatePct}
              step={0.1}
              onChange={(n) => patch({ localDepositRatePct: Math.max(0, n) })}
              hint={
                inputs.marginPct <= 0
                  ? "设保证金比例后生效"
                  : depLoanCheck.inverted
                    ? `高于贷款价 ${pct(inputs.loanRatePct)}`
                    : `须低于贷款价（利差 ${pct(depLoanCheck.spreadPp)}）`
              }
            />
            <Field
              label="保证金利息税率"
              suffix="%"
              value={
                inputs.marginInterestTaxPct ??
                country.marginInterestTaxPct ??
                0
              }
              step={1}
              onChange={(n) =>
                patch({ marginInterestTaxPct: Math.max(0, Math.min(100, n)) })
              }
              hint={`国别默认 ${pct(country.marginInterestTaxPct)}`}
            />
          </Grid>

          {depLoanCheck.inverted ? (
            <Callout tone="danger" title="本币存贷价倒挂 · 同一银行">
              保证金存款利率 {pct(inputs.localDepositRatePct)} 不低于贷款价格{" "}
              {pct(inputs.loanRatePct)}
              {inputs.countryId === "NG"
                ? `（${selectedNgBank.name} · ${ngLoanTier}）`
                : ""}
              。同存同贷时吸储价应低于放款价；测算仍继续，但结果不宜直接对外。
            </Callout>
          ) : depLoanCheck.tight ? (
            <Callout tone="warning" title="本币存贷利差偏窄">
              贷款 {pct(inputs.loanRatePct)} vs 保证金存款{" "}
              {pct(inputs.localDepositRatePct)}，利差仅 {pct(depLoanCheck.spreadPp)}
              （一般建议 ≥ {pct(LOCAL_DEP_LOAN_MIN_SPREAD_PP)}）。
            </Callout>
          ) : null}

          {country.quoted && matchesExcel ? (
            <Callout tone="success" title="与菲律宾 Excel 对账一致">
              美元收益率 9.05%（表内 C19）。
            </Callout>
          ) : null}
        </Stack>
      </PersistCollapsibleSection>

      <PersistCollapsibleSection
        title="汇率冲击"
        defaultOpen={false}
        trailing={
          <Text size="small" tone="tertiary">
            贬值 {pct(inputs.fxShockPct, 1)} · 冲击后{" "}
            {pct(chuanMergeShock.yieldPct * 100, 2)}
          </Text>
        }
      >
        <Stack gap={12}>
          <Field
            label="本币贬值"
            suffix="%（正=更多本币兑 1 美元）"
            value={inputs.fxShockPct}
            step={1}
            onChange={(n) => patch({ fxShockPct: n })}
            hint={country.fxVolHint}
          />
          <Grid columns={2} gap={12}>
            <Stat
              value={formatUsdWanStat(chuanMergeShock.netUsd)}
              label={`CHUAN 净收益 · ${chuanMergeShock.suffix} · 冲击后`}
              tone="success"
            />
            <Stat
              value={pct(chuanMergeShock.yieldPct * 100, 2)}
              label={`CHUAN 综合收益率 · 冲击后`}
              tone={
                chuanMergeShock.yieldPct >= chuanMerge.yieldPct
                  ? "success"
                  : "warning"
              }
            />
          </Grid>
        </Stack>
      </PersistCollapsibleSection>

      <PersistCollapsibleSection
        title="收益分列 · 计息基数"
        defaultOpen={false}
        trailing={
          <Text size="small" tone="tertiary">
            四端瀑布 · Excel 流水
          </Text>
        }
      >
        <Stack gap={16}>
          <Text size="small" tone="secondary">
            本币拆存款端与贷款端；保函存款为美元侧。
          </Text>
          <PersistCollapsibleSection title="计息基数对照" defaultOpen={false}>
            <BasisTable calc={calc} inputs={inputs} country={country} />
          </PersistCollapsibleSection>
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
            美元侧 {pct(calc.usdLegYield * 100, 2)} ÷ 保函存款本金；全折美元{" "}
            {pct(calc.usdYieldFull * 100, 2)}；CHUAN（JV 股权{" "}
            {pct(calc.chuanJvShare * 100, 0)}）→ {pct(calc.usdYieldChuan * 100, 2)}。
          </Callout>
          <PersistCollapsibleSection title="Excel 流水（当前国）" defaultOpen={false}>
            <Stack gap={8}>
              <Table
                headers={["项目", "机构", "数值", "计息基数", "口径"]}
                columnAlign={["left", "left", "right", "left", "left"]}
                striped
                stickyHeader
                rows={[
                  [
                    "保函存款本金",
                    "CHUAN",
                    `${num(inputs.depositUsd)} 万美元`,
                    "—",
                    "可配置本金",
                  ],
                  [
                    "保函存款利率",
                    "存款行",
                    pct(inputs.depositRatePct),
                    "保函存款本金",
                    "保函存款报价",
                  ],
                  [
                    "利息金额",
                    "—",
                    `${num(calc.depositInterestUsd)} 万美元`,
                    `${num(inputs.depositUsd)} 万美元`,
                    "本金×利率×天数÷360",
                  ],
                  [
                    isInterestUpfront(inputs)
                      ? "保函金额（利息前置）"
                      : "保函金额（未前置）",
                    "—",
                    `${num(calc.guaranteeUsd)} 万美元`,
                    isInterestUpfront(inputs) ? "存款+利息" : "仅存款本金",
                    isInterestUpfront(inputs)
                      ? "本金+利息，按可前置"
                      : "利息未前置则面额不含息",
                  ],
                  [
                    "保函手续费",
                    "保函行",
                    `${num(calc.guaranteeFeeUsd)} 万美元`,
                    `${num(calc.guaranteeUsd)} 万美元`,
                    "保函金额×费率",
                  ],
                  [
                    `贷款/转贷金额（万${country.ccyName}）`,
                    "—",
                    num(calc.loanLocal, 2),
                    "保函×折扣×汇率÷(1+贷款利率×天数/365)",
                    "助贷本金",
                  ],
                  [
                    "全折美元净收益",
                    "—",
                    `${num(calc.depositInterestUsd + calc.localLegNetUsd - calc.guaranteeFeeUsd, 2)} 万美元`,
                    "美元侧+本币两侧折回",
                    pct(calc.usdYield * 100, 4),
                  ],
                ]}
              />
              <Text size="small" tone="tertiary">
                表内混用 360/365：利息用 360，贷款本金覆盖用 365。
              </Text>
            </Stack>
          </PersistCollapsibleSection>
          <PersistCollapsibleSection title="综合成本衡量" defaultOpen={false}>
            <Table
              headers={["尺子", "读数", "怎么读"]}
              columnAlign={["left", "right", "left"]}
              striped
              rows={[
                [
                  "全折美元收益率",
                  pct(calc.usdYield * 100),
                  "结构全部折回美元后的账本收益",
                ],
                ["存款价格", pct(inputs.depositRatePct), "只放保函存款的机会成本"],
                [
                  `${country.ccy}/USD 政策利差`,
                  pct(calc.pairDiff * 100),
                  "教科书套息；未对冲汇率",
                ],
                [
                  "超额 vs 存款",
                  pct(calc.excessVsDeposit * 100),
                  "做这单比只存款多赚多少",
                ],
              ]}
            />
          </PersistCollapsibleSection>
        </Stack>
      </PersistCollapsibleSection>

      <H2>结构参数</H2>
      <Text size="small" tone="secondary">
        保函存款本金/面额、天数与汇率。面额联动助贷本金；折扣与保证金在「定价横梁」。
      </Text>
      <Grid columns={4} gap={12}>
        <Field
          label="保函存款本金"
          suffix="万美元"
          value={round2(inputs.depositUsd)}
          step={10}
          onChange={(n) => patch({ depositUsd: n })}
          hint={
            isInterestUpfront(inputs)
              ? "调高→保函金额=本金+利息同步变大"
              : "调高→保函金额=本金（利息未进面额）"
          }
        />
        <Field
          label="保函金额"
          suffix="万美元"
          value={round2(calc.guaranteeUsd)}
          step={10}
          onChange={(n) =>
            patch({
              depositUsd: depositUsdFromGuaranteeFace(
                n,
                inputs.depositRatePct,
                inputs.depositDays,
                isInterestUpfront(inputs),
              ),
            })
          }
          hint={
            isInterestUpfront(inputs)
              ? "调高→反解保函存款本金（÷(1+存款价×天/360)）"
              : "调高→同步存款本金（利息未前置，面额=本金）"
          }
        />
        <Field
          label="保函存款天数"
          suffix="天"
          value={inputs.depositDays}
          step={1}
          onChange={(n) => patch({ depositDays: n })}
        />
        <Field
          label="贷款天数"
          suffix="天"
          value={inputs.loanDays}
          step={1}
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

      <PersistCollapsibleSection
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
      </PersistCollapsibleSection>

      <PersistCollapsibleSection title="口径与信源" defaultOpen={false}>
        <Table
          headers={["项", "口径"]}
          rows={[
            [
              "分配侧",
              "助贷本金横向资金条。保函位置 none / help_mfi / help_bank。三主体按收入列示：保证主体拿转贷差价，JV 拿服务费与或有存款利息，银行拿场景息差。",
            ],
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
              "Atlas COUNTRY_MACRO / Trading Economics 2026-06–08：PH BSP 4.75% · NG CBN MPR 26.5% · ID BI 5.75% · MX Banxico 6.5% · KE CBK 8.75% · RU CBR 14% · US 3.75%；FX PHP 60.67 / NGN 1362 / IDR 17916 / MXN 17.25 / KES 129 / RUB 82.3",
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
      </PersistCollapsibleSection>
      <Text size="small" tone="tertiary" style={{ color: theme.text.tertiary }}>
        改数会保存在画布侧车，刷新后仍在。点「恢复该国预设」回到该国默认横梁。
      </Text>
    </Stack>
    </div>
  );
}
