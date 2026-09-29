/**
 * SKU / 资产包测算一致性与「案例污染」静态自检。
 * 对照画布源码约定，不启动 React。
 * 运行：node scripts/verify-sku-cf-consistency.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canvasPath = path.join(root, "ev-asset-portfolio-model.canvas.tsx");
const src = fs.readFileSync(canvasPath, "utf8");

const fails = [];
const warns = [];
const passes = [];

function ok(name) {
  passes.push(name);
}
function fail(name, detail) {
  fails.push(`${name}: ${detail}`);
}
function warn(name, detail) {
  warns.push(`${name}: ${detail}`);
}

/** 从 DEFAULT_ASSET_SKUS 块提取 id */
function extractDefaultSkuIds() {
  const start = src.indexOf("const DEFAULT_ASSET_SKUS");
  const end = src.indexOf("const DEFAULT_VEHICLE_MODELS");
  if (start < 0 || end < 0) return [];
  const block = src.slice(start, end);
  const ids = [
    ...block.matchAll(/^\s+id:\s*"([^"]+)"/gm),
  ].map((m) => m[1]);
  /** 场站在 STATION_TIER / spread 里 */
  const stationIds = ["station-small", "station-medium", "station-large"];
  const set = new Set([...ids, ...stationIds]);
  return [...set];
}

const EXPECTED_SKUS = [
  "aion-es",
  "aion-ut",
  "arcfox-t1",
  "id-escooter-sample",
  "station-small",
  "station-medium",
  "station-large",
];

const skuIds = extractDefaultSkuIds();
for (const id of EXPECTED_SKUS) {
  if (skuIds.includes(id)) ok(`SKU 清单含 ${id}`);
  else fail("SKU 清单", `缺 ${id}`);
}

/** 核心引擎函数须存在且被订单/单位路径引用 */
const ENGINE_FNS = [
  "buildAssetMonthBars",
  "buildOrderLineMonthBars",
  "buildOrderAggregatedUnitCf",
  "buildOrderLineCfContext",
  "modelUnitGrossEngineBook",
  "barsToUnitCfPath",
  "orderDeployRecoverBatches",
  "unitSkuDeployRecoverBatch",
  "buildYohoPkgMonthsFromOrders",
];
for (const fn of ENGINE_FNS) {
  const decl = src.includes(`function ${fn}`);
  const uses = (src.match(new RegExp(fn, "g")) || []).length;
  if (decl && uses >= 2) ok(`引擎 ${fn} 声明+引用×${uses}`);
  else fail(`引擎 ${fn}`, decl ? `引用过少 (${uses})` : "未声明");
}

/** 购物车下单须用 gross（与商详/未税加税一致），勿只用 landed */
{
  const checkout = src.slice(
    src.indexOf("const checkoutCart"),
    src.indexOf("const checkoutCart") + 3500,
  );
  if (checkout.includes("modelUnitGrossEngineBook")) {
    ok("checkoutCart 车辆行用 modelUnitGrossEngineBook");
  } else {
    fail(
      "checkoutCart 购置口径",
      "车辆行未用 modelUnitGrossEngineBook（易与货架含税合计不一致）",
    );
  }
}

/** 投放图勿静默回退 buildModel 年行 */
{
  const fnStart = src.indexOf("function orderDeployRecoverBatches");
  const fnChunk = src.slice(fnStart, fnStart + 4500);
  if (
    fnChunk.includes("无月路径时年柱留空") ||
    !fnChunk.includes("rows.slice(0, 5)")
  ) {
    ok("orderDeployRecoverBatches 无月路径不回退 buildModel");
  } else {
    fail(
      "投放图双引擎",
      "orderDeployRecoverBatches 仍用 rows.slice 回退 buildModel",
    );
  }
}

/** 节奏轨勿写死案例 65 台上限 */
{
  const scopeFn = src.slice(
    src.indexOf("function resolveDeployRhythmScope"),
    src.indexOf("function resolveDeployRhythmScope") + 2200,
  );
  if (
    /unitsCap:\s*\n?\s*planId === YOHO_CREDIT_DRAWDOWN_PLAN_ID\s*\n?\s*\? YOHO_REPORT/.test(
      scopeFn,
    ) ||
    scopeFn.includes("creditUnitsActual")
  ) {
    fail(
      "节奏轨上限",
      "resolveDeployRhythmScope 仍把 YOHO creditUnitsActual 写成 unitsCap",
    );
  } else {
    ok("节奏轨不强制案例 65 台上限");
  }
}

/** 主 UI 角标勿直出案例报告版本号 */
{
  if (src.includes("function displayCreditPlanScopeZh")) {
    ok("存在 displayCreditPlanScopeZh（案例名→当前授信包）");
  } else {
    fail("范围角标", "缺 displayCreditPlanScopeZh");
  }
  const liveHits = [
    ...src.matchAll(/案例授信包（\$\{YOHO_REPORT/g),
  ];
  /** 常量定义允许 1 处；主 UI 应走 display */
  if (liveHits.length <= 1) ok("案例授信包全称仅常量层");
  else warn("案例授信包字面量", `出现 ${liveHits.length} 处模板（请确认非主 UI）`);
}

/** 商详回本区勿钉死 YOHO 权威数字 */
{
  const paybackChunk = src.slice(
    src.indexOf("unitResultFolderTab === \"payback\""),
    src.indexOf("unitResultFolderTab === \"payback\"") + 2500,
  );
  if (
    paybackChunk.includes("YOHO_REPORT_V238.unitUnleveredIrr") ||
    paybackChunk.includes("投委会对外权威")
  ) {
    fail(
      "商详 authorityHint",
      "仍硬编码 YOHO 无债 IRR/回本为权威读数",
    );
  } else if (paybackChunk.includes("杠杆权益切片")) {
    ok("商详回本提示已改为通用杠杆说明");
  } else {
    warn("商详 authorityHint", "未检测到通用杠杆提示（可能结构已变）");
  }
}

/** 默认订单备注勿塞投委会 IRR */
{
  const noteChunk = src.slice(
    src.indexOf("createdByZh:"),
    src.indexOf("createdByZh:") + 800,
  );
  if (/投委会|项目 IRR≈|65\+1/.test(noteChunk)) {
    fail("默认订单 noteZh", "仍含投委会/IRR/65+1 固定说明");
  } else {
    ok("默认订单备注已去案例固定说明");
  }
}

/** 债服来源文案：主路径勿称「报告锁」 */
{
  if (src.includes('labelZh: "债服·报告锁口径"')) {
    fail("债服来源", "仍有「债服·报告锁口径」文案");
  } else if (src.includes("债服·参考样例")) {
    ok("债服参考样例文案已替换报告锁");
  } else {
    warn("债服来源", "未找到参考样例文案");
  }
}

/** pricesIncludeVat：含税 SKU 与未税 SKU 须并存（口径分支有意） */
{
  const vatTrue = (src.match(/pricesIncludeVat:\s*true/g) || []).length;
  if (vatTrue >= 2) ok(`含税列载 SKU 标记 ×${vatTrue}`);
  else warn("pricesIncludeVat", `含税标记仅 ${vatTrue} 处`);
}

/** DSCR 触线变色能力 */
{
  if (
    src.includes("function dscrOverlayPointTone") &&
    src.includes("alertLevels")
  ) {
    ok("DSCR 触线变色 + alertLevels");
  } else {
    fail("DSCR 警色", "缺 dscrOverlayPointTone 或 alertLevels");
  }
}

/** 近期口径/交互：IVA·FX·堆叠同步·紧凑 KPI·图例显隐 */
{
  const need = [
    ["pkgCfadsForDscr", "function pkgCfadsForDscr"],
    ["pkgDscrEffectiveFxBuf", "function pkgDscrEffectiveFxBuf"],
    ["yohoPkgRowsForWfDisplay", "function yohoPkgRowsForWfDisplay"],
    ["PlanStickyKpi", "function PlanStickyKpi"],
    ["含FX开关", "含FX"],
    ["剔FX开关", "剔FX"],
    ["含IVA开关", "含IVA"],
    ["剔IVA开关", "剔IVA"],
    ["DSCR税态键", '"pkgDscrVatModeV1"'],
    ["DSCR汇兑态键", '"pkgDscrFxModeV1"'],
    ["场站IVA入CFADS", "slot.cfads -= ivaUsd"],
    ["IVA图例显隐", '"yohoIvaChartSeriesHiddenV1"'],
    ["分栏自适应", "PlanLiveSplitFrame"],
  ];
  for (const [name, needle] of need) {
    if (src.includes(needle)) ok(`交互落库·${name}`);
    else fail(`交互落库·${name}`, `缺 ${needle}`);
  }
  /** DSCR 条带勿再出现「扣FX」开关文案（VTL「扣FX buffer」另计） */
  if (/\n\s*扣FX\s*\n/.test(src)) {
    fail("DSCR称谓", "仍有「扣FX」开关文案，应统一为含FX/剔FX");
  } else ok("DSCR称谓：无扣FX开关");
  /** 剔IVA须加回，禁止再减 */
  const cfadsFn = src.slice(
    src.indexOf("function pkgCfadsForDscr"),
    src.indexOf("function pkgCfadsForDscr") + 600,
  );
  if (
    cfadsFn.includes("return cfads + iva") ||
    cfadsFn.includes("return cfads + iva;")
  ) {
    ok("剔IVA分子=CFADS+IVA");
  } else {
    fail("剔IVA分子", "pkgCfadsForDscr 未加回 IVA");
  }
  if (/cfads\s*-\s*iva/.test(cfadsFn) || /return cfads - iva/.test(cfadsFn)) {
    fail("剔IVA分子", "仍存在 CFADS−IVA 双重扣路径");
  } else ok("剔IVA无双重扣路径");
}

console.log("=== verify-sku-cf-consistency ===");
console.log(`PASS ${passes.length}`);
for (const p of passes) console.log(`  ✓ ${p}`);
if (warns.length) {
  console.log(`WARN ${warns.length}`);
  for (const w of warns) console.log(`  ! ${w}`);
}
if (fails.length) {
  console.log(`FAIL ${fails.length}`);
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log("全部通过");
process.exit(0);
