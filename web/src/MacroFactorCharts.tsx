import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { useCanvasState, useHostTheme, Text, Stack, Grid } from "./shims/cursor-canvas";
import { mapChrome } from "./heatMapTheme";
import { GlossedText } from "./GlossedText";
import { en } from "./enSurface";
import {
  FX_HISTORY,
  FX_CHG_PERIODS,
  type FxChgPeriodId,
  resolveFxSeries,
  sliceFxPointsByMonths,
  fxLocalStrengthChgPct as calcFxLocalStrengthChgPct,
  fxPointsSpanLabel,
  type FxHistoryCountry,
} from "./data/fxHistory";
import {
  MACRO_STRESS_HISTORY,
  STRESS_METRIC_META,
  getStressCountry,
  sliceStressByMonths,
  stressChgPct,
  stressSeriesReady,
  type StressMetricId,
  type StressSeries,
} from "./data/macroStressHistory";
import { CA_HISTORY, caChgPctPts, getCaHistory, sliceCaByYears } from "./data/caHistory";
import {
  RESERVES_HISTORY,
  formatReservesYi,
  getReservesHistory,
  reservesChgPct,
  sliceReservesByYears,
} from "./data/reservesHistory";
import {
  getIncomeCompanion,
  incomeChgPct,
  incomeChgPts,
  incomeSeriesReady,
  sliceIncomeByYears,
  type IncomeSeries,
} from "./data/incomeCompanionHistory";

/** 与 Atlas CountryMacroSnap 对齐的最小字段（避免循环依赖） */
export type MacroChartSnap = {
  gdpPerCapitaUsd?: string;
  incomePerCapita?: string;
  sectorMix?: string;
  currentAccount?: string;
  fxReserves?: string;
  fxTrend?: string;
  fxHint?: string;
  fxVolInYear?: string;
  privCreditOrConsumer?: string;
  debtToGdp?: string;
  householdDebtToGdp?: string;
  consumerConfidence?: string;
};

const HH_DEBT_CEIL_LO = 45;
const HH_DEBT_CEIL_HI = 55;
const GOV_DEBT_WATCH = 60;
const TERTIARY_HIGH = 65;
const PRIMARY_HIGH = 30;

function firstNumber(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function parseSector(sectorMix?: string): { agri: number; mfg: number; svc: number } | null {
  if (!sectorMix) return null;
  const agri = sectorMix.match(/农业[^0-9]*([\d.]+)/)?.[1];
  const mfg = sectorMix.match(/制造[^0-9]*([\d.]+)/)?.[1];
  const svc = sectorMix.match(/服务[^0-9]*([\d.]+)/)?.[1];
  if (!agri || !mfg || !svc) return null;
  return { agri: Number(agri), mfg: Number(mfg), svc: Number(svc) };
}

function splitValue(raw: string): string {
  const i = raw.indexOf("·");
  return i > 0 ? raw.slice(0, i) : raw;
}

/** 从字段串提取括号内年月，如（2025-12）/（2026-06） */
function extractAsOf(raw?: string): string | null {
  if (!raw) return null;
  const m = raw.match(/（(\d{4}-\d{2})[^）]*）/);
  return m ? m[1] : null;
}

function parseCaGdp(currentAccount?: string): number | null {
  if (!currentAccount) return null;
  const m = currentAccount.match(/CA\/GDP约?\s*(-?[\d.]+)\s*%/i);
  return m ? Number(m[1]) : null;
}

function parseReservesUsdBn(fxReserves?: string): number | null {
  if (!fxReserves) return null;
  // 优先「亿美元」，避免「AED - 10亿」等本币口径误读
  const usdYi = fxReserves.match(/约?\s*([\d.]+)\s*亿美元/);
  if (usdYi) return Number(usdYi[1]);
  const yi = fxReserves.match(/约?\s*([\d.]+)\s*亿(?!美元)/);
  if (yi && /美元|USD|外汇储备/i.test(fxReserves)) return Number(yi[1]);
  return null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** 汇兑韧性示意分：连续项，避免多国撞同一档 */
function fxResilienceParts(ca: number | null, resBn: number | null, vol: number | null) {
  // CA/GDP：约每 1pct → ±3 分，截断
  const caPts = ca == null ? 0 : clamp(ca * 3, -28, 22);
  // 外储：log10 亿美元；10→−8，50→0，150→+8，1000→+18，10000→+28
  let resPts = 0;
  if (resBn != null && resBn > 0) {
    resPts = clamp((Math.log10(resBn) - Math.log10(50)) * 12, -22, 30);
  }
  // 年内波动：±8% 中性，越大越扣
  let volPts = 0;
  if (vol != null) {
    volPts = clamp(8 - vol, -18, 8);
  }
  const known = [ca, resBn, vol].filter((x) => x != null).length;
  // 缺项时略压向中性，避免「全缺也像中等」
  const base = known === 0 ? 40 : 50;
  const score = Math.round(clamp(base + caPts + resPts + volPts, 0, 100));
  return { score, caPts, resPts, volPts, known };
}

function parseHhDebt(s?: string): number | null {
  if (!s) return null;
  const m = s.match(/([\d.]+)\s*%/);
  return m ? Number(m[1]) : null;
}

function parseGovDebt(s?: string): number | null {
  if (!s) return null;
  const m = s.match(/([\d.]+)\s*%/);
  return m ? Number(m[1]) : null;
}

/** 消费/私营贷款存量解析；允许单边；兼容「私人部门信贷」等别名 */
function parseCreditAmounts(priv?: string): {
  consumerMn: number | null;
  privateMn: number | null;
} {
  if (!priv) return { consumerMn: null, privateMn: null };
  const cons = priv.match(/消费信贷约?\s*([\d.]+)/);
  const privLoan = priv.match(/(?:私营部门贷款|私人部门信贷|私人信贷|私人部门贷款)约?\s*([\d.]+)/);
  let consumerMn = cons ? Number(cons[1]) : null;
  let privateMn = privLoan ? Number(privLoan[1]) : null;
  if (privateMn != null) {
    const idx = priv.search(/私营部门贷款|私人部门信贷|私人信贷|私人部门贷款/);
    const privSeg = idx >= 0 ? priv.slice(idx) : priv;
    const firstSeg = privSeg.split("；")[0] ?? "";
    if (/千/.test(firstSeg) && !/百万/.test(firstSeg)) {
      privateMn = privateMn / 1000;
    }
  }
  return { consumerMn, privateMn };
}

/** @deprecated 双边才返回；新逻辑用 parseCreditAmounts */
function parseCreditPair(priv?: string): { consumerMn: number; privateMn: number } | null {
  const { consumerMn, privateMn } = parseCreditAmounts(priv);
  if (consumerMn == null || privateMn == null) return null;
  return { consumerMn, privateMn };
}

function Panel({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  return (
    <div
      style={{
        minWidth: 0,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "10px 10px 8px",
        border: `1px solid ${c.panelBorder}`,
        borderRadius: 6,
        background: c.panelBg,
      }}
    >
      <div style={{ borderBottom: `1px solid ${c.panelBorder}`, paddingBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: c.textSecondary }}>
          <GlossedText text={title} />
        </div>
        {subtitle ? (
          <div style={{ fontSize: 11, color: c.textTertiary, marginTop: 2 }}>
            <GlossedText text={subtitle} />
          </div>
        ) : null}
      </div>
      {children}
      {footer ? (
        <div style={{ fontSize: 11, color: c.textSecondary, lineHeight: 1.4 }}>
          {typeof footer === "string" ? <GlossedText text={footer} /> : footer}
        </div>
      ) : null}
    </div>
  );
}

function HBar({
  label,
  pct,
  color,
  note,
}: {
  label: string;
  pct: number;
  color: string;
  note?: string;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "56px 1fr 40px", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 11, color: c.textTertiary }}>{en(label)}</span>
      <div style={{ height: 8, background: theme.fill.quaternary, borderRadius: 0 }}>
        <div style={{ width: `${w}%`, height: "100%", background: color }} />
      </div>
      <span style={{ fontSize: 11, color: c.text, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
        {pct.toFixed(0)}%{note ? "" : ""}
      </span>
    </div>
  );
}

export function IncomeSectorCharts({
  snap,
  countryLabel,
  countryCode,
}: {
  snap: MacroChartSnap;
  countryLabel: string;
  countryCode?: string;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  const sec = parseSector(snap.sectorMix);
  const gdpPc = firstNumber(snap.gdpPerCapitaUsd);
  const incomePc = firstNumber(snap.incomePerCapita);
  if (!sec && gdpPc == null && incomePc == null) {
    return (
      <Text size="small" tone="tertiary">
        三产/人均收入字段不足，暂无法作图。
      </Text>
    );
  }
  const tot = sec ? sec.agri + sec.mfg + sec.svc : 0;
  const pA = tot ? (sec!.agri / tot) * 100 : 0;
  const pM = tot ? (sec!.mfg / tot) * 100 : 0;
  const pS = tot ? (sec!.svc / tot) * 100 : 0;
  const highValue =
    pS >= TERTIARY_HIGH ? "服务占比已过附加值偏高阈值" : pS >= 50 ? "服务占主导、制造仍有空间" : "仍偏初级/制造驱动";
  const primaryRisk = pA >= PRIMARY_HIGH;

  const incomeFooter =
    incomePc != null
      ? "主尺为世行 GNI/人 PPP，不是住户可支配收入；与现价人均 GDP 不可直接比大小"
      : gdpPc != null
        ? "缺人均收入（GNI PPP）· 暂用人均 GDP 现价代理"
        : "—";
  const gdpBand =
    gdpPc == null
      ? null
      : gdpPc >= 12000
        ? "人均 GDP 已过成熟阈值 12000"
        : gdpPc >= 2000
          ? "人均 GDP 介于新兴与成熟阈值之间"
          : "人均 GDP 低于准入关注阈值 2000";

  const incomeFooterNode = (
    <>
      <GlossedText text={incomeFooter} />
      {gdpBand ? (
        <>
          ；
          <GlossedText text={gdpBand} />
        </>
      ) : null}
    </>
  );

  return (
    <Stack gap={10}>
      <Grid columns={2} gap={8}>
        <Panel
          title={`${countryLabel} · 产业结构`}
          subtitle="分项占比（Trading Economics 绝对值折算）· 水平快照"
          footer={`${highValue}${
            primaryRisk ? `；农业占比偏高（≥${PRIMARY_HIGH}%阈值）` : ""
          }。服务阈值对照 ${TERTIARY_HIGH}%。单看占比难判人均增减，见下方序时配看。`}
        >
          {sec ? (
            <Stack gap={6}>
              <HBar label="农业" pct={pA} color={theme.fill.primary} />
              <HBar label="制造" pct={pM} color={c.accent} />
              <HBar label="服务" pct={pS} color={c.added} />
            </Stack>
          ) : (
            <Text size="small" tone="tertiary">
              {en("无三产分项")}
            </Text>
          )}
        </Panel>
        <Panel
          title={`${countryLabel} · 收入能力`}
          subtitle="人均收入 · GNI/人 PPP（美元）"
          footer={incomeFooterNode}
        >
          {incomePc != null || gdpPc != null ? (
            <div>
              <div style={{ fontSize: 22, fontWeight: 600, color: c.text }}>
                {Math.round(incomePc ?? gdpPc!).toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: c.textSecondary, marginTop: 4 }}>
                <GlossedText
                  text={incomePc != null ? "人均收入（GNI/人 PPP）" : "人均 GDP（现价·代理）"}
                />
              </div>
              {incomePc != null && gdpPc != null ? (
                <div style={{ fontSize: 11, color: c.textTertiary, marginTop: 6, lineHeight: 1.4 }}>
                  <GlossedText
                    text={`对照人均 GDP 现价 ${Math.round(gdpPc).toLocaleString()} 美元${
                      incomePc > gdpPc * 1.2
                        ? " · PPP 抬升属常见（生活成本折算后购买力高于名义美元）"
                        : ""
                    }`}
                  />
                </div>
              ) : null}
              {gdpPc != null ? (
                <>
                  <div style={{ marginTop: 10, height: 8, background: theme.fill.quaternary }}>
                    <div
                      style={{
                        width: `${Math.min(100, (gdpPc / 12000) * 100)}%`,
                        height: "100%",
                        background: gdpPc >= 12000 ? c.added : c.accent,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 10, color: c.textTertiary, marginTop: 4 }}>
                    <GlossedText text="准入成熟阈值进度按人均 GDP 现价（阈值 12000），不用 PPP 收入硬套" />
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <Text size="small" tone="tertiary">
              —
            </Text>
          )}
        </Panel>
      </Grid>
      <IncomeCompanionPanel countryCode={countryCode} countryLabel={countryLabel} />
    </Stack>
  );
}

function MiniSpark({
  label,
  series,
  format,
  mode,
  years = 10,
}: {
  label: string;
  series?: IncomeSeries | null;
  format: (v: number) => string;
  /** pct=相对变动%；pts=百分点差；level=只看末端 */
  mode: "pct" | "pts";
  years?: number;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  if (!incomeSeriesReady(series)) {
    return (
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: c.textTertiary }}>{en(label)}</div>
        <div style={{ fontSize: 12, color: c.textTertiary, marginTop: 6 }}>{en("序时暂缺")}</div>
      </div>
    );
  }
  const pts = sliceIncomeByYears(series.points, years);
  const last = pts[pts.length - 1]!;
  const delta = mode === "pct" ? incomeChgPct(pts) : incomeChgPts(pts);
  const flat = Math.abs(delta) < (mode === "pct" ? 1 : 0.3);
  const up = delta > 0;
  const stroke = flat ? c.accent : up ? "#1B8F4A" : "#C45C26";
  const W = 140;
  const H = 36;
  const pad = 2;
  const ys = pts.map((p) => p.v);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const span = hi - lo || 1;
  const xAt = (i: number) => pad + (i / Math.max(1, pts.length - 1)) * (W - pad * 2);
  const yAt = (v: number) => pad + (1 - (v - lo) / span) * (H - pad * 2);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p.v).toFixed(1)}`).join(" ");
  const sign = flat ? "" : up ? "+" : "";
  const deltaTxt =
    mode === "pct" ? `${sign}${delta.toFixed(0)}%` : `${sign}${delta.toFixed(1)}pt`;

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "baseline" }}>
        <span style={{ fontSize: 11, color: c.textSecondary }}>{en(label)}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: stroke, fontVariantNumeric: "tabular-nums" }}>
          {deltaTxt}
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: c.text, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
        {en(format(last.v))}
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", marginTop: 4, maxWidth: 160 }}>
        <path d={line} fill="none" stroke={stroke} strokeWidth={1.6} />
      </svg>
      <div style={{ fontSize: 10, color: c.textTertiary }}>
        {pts[0]!.d.slice(0, 4)}–{last.d.slice(0, 4)}
      </div>
    </div>
  );
}

function IncomeCompanionPanel({
  countryCode,
  countryLabel,
}: {
  countryCode?: string;
  countryLabel: string;
}) {
  const companion = countryCode ? getIncomeCompanion(countryCode) : undefined;
  const infl = countryCode ? getStressCountry(countryCode)?.inflation : undefined;
  const hasAny =
    incomeSeriesReady(companion?.gdpPerCapita) ||
    incomeSeriesReady(companion?.remittancesGdp) ||
    incomeSeriesReady(companion?.agriShare) ||
    incomeSeriesReady(companion?.servicesShare) ||
    stressSeriesReady(infl);

  // 结构 vs 人均：简短 so-what
  let soWhat = "三产是形态快照；人均增减看序时，侨汇/通胀会让结构与口袋脱节。";
  if (companion) {
    const gdp = companion.gdpPerCapita;
    const agri = companion.agriShare;
    const svc = companion.servicesShare;
    const remit = companion.remittancesGdp;
    const bits: string[] = [];
    if (incomeSeriesReady(gdp)) {
      const d = incomeChgPct(sliceIncomeByYears(gdp.points, 10));
      bits.push(d > 5 ? "近十年人均GDP上行" : d < -5 ? "近十年人均GDP承压" : "近十年人均GDP大致持平");
    }
    if (incomeSeriesReady(agri) && incomeSeriesReady(svc)) {
      const da = incomeChgPts(sliceIncomeByYears(agri.points, 10));
      const ds = incomeChgPts(sliceIncomeByYears(svc.points, 10));
      if (da > 1 && ds < -1) bits.push("农业份额未降、服务回落→结构改善叙事要打折");
      else if (da < -1 && ds > 1) bits.push("农业降、服务升→结构与人均更易同向");
    }
    if (incomeSeriesReady(remit)) {
      const last = remit.points[remit.points.length - 1]!.v;
      if (last >= 15) bits.push(`侨汇/GDP约${last.toFixed(0)}%，旁路收入权重高`);
    }
    if (bits.length) soWhat = bits.join("；") + "。";
  }

  if (!hasAny) {
    return (
      <Panel
        title={`${countryLabel} · 人均与旁路收入（配看三产）`}
        subtitle="序时暂缺"
        footer="待接入世行人均GDP / 侨汇 / 三产份额序列"
      >
        <Text size="small" tone="tertiary">
          {soWhat}
        </Text>
      </Panel>
    );
  }

  // 通胀转成 IncomeSeries 形态给 MiniSpark
  const inflAsIncome: IncomeSeries | null = stressSeriesReady(infl)
    ? {
        unit: infl.unit,
        source: infl.source,
        points: infl.points.map((p) => ({ d: p.d, v: p.v })),
      }
    : null;

  return (
    <Panel
      title={`${countryLabel} · 人均与旁路收入（配看三产）`}
      subtitle="世行年频 · 近约十年 · 三产静态图请对照本行序时"
      footer={soWhat}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 12,
        }}
      >
        <MiniSpark
          label="人均 GDP"
          series={companion?.gdpPerCapita}
          mode="pct"
          format={(v) => `${Math.round(v).toLocaleString()} 美元`}
        />
        <MiniSpark
          label="侨汇 / GDP"
          series={companion?.remittancesGdp}
          mode="pts"
          format={(v) => `${v.toFixed(1)}%`}
        />
        <MiniSpark
          label="农业占 GDP"
          series={companion?.agriShare}
          mode="pts"
          format={(v) => `${v.toFixed(1)}%`}
        />
        <MiniSpark
          label="服务占 GDP"
          series={companion?.servicesShare}
          mode="pts"
          format={(v) => `${v.toFixed(1)}%`}
        />
        <MiniSpark
          label="通胀（月频）"
          series={inflAsIncome}
          mode="pts"
          years={5}
          format={(v) => `${v.toFixed(1)}%`}
        />
      </div>
    </Panel>
  );
}

function formatFxValue(v: number): string {
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (v >= 100) return v.toFixed(1);
  if (v >= 10) return v.toFixed(2);
  return v.toFixed(3);
}

/** A 股习惯：红涨绿跌；方向按「本币对美元强弱」（报价升≠本币涨） */
const FX_UP = "#E53935";
const FX_DOWN = "#1B8F4A";

function FxChgBadge({ strengthChg }: { strengthChg: number }) {
  const flat = Math.abs(strengthChg) < 0.05;
  const up = strengthChg > 0;
  const color = flat ? undefined : up ? FX_UP : FX_DOWN;
  const arrow = flat ? "–" : up ? "▲" : "▼";
  const sign = flat ? "" : up ? "+" : "";
  const word = flat ? "持平" : up ? "本币升" : "本币贬";
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, fontSize: 12, fontWeight: 600, color: color }}>
      <span aria-hidden style={{ fontSize: 11, lineHeight: 1 }}>
        {arrow}
      </span>
      <span>
        {sign}
        {Math.abs(strengthChg).toFixed(1)}%
      </span>
      <span style={{ fontWeight: 400, opacity: 0.85 }}>{en(word)}</span>
    </span>
  );
}

function seriesDateRange(points: { d: string }[]): string {
  if (points.length < 2) return FX_HISTORY.meta.range;
  return `${points[0]!.d}..${points[points.length - 1]!.d}`;
}

/** 共同货币区说明：避免西非多国「曲线长一样」被当成示意 bug */
function sharedCcyNote(ccy: string): string | null {
  const u = ccy.toUpperCase();
  if (u === "XOF") return "西非法郎共同区（多国同币，曲线会高度相似）";
  if (u === "XAF") return "中非法郎共同区（多国同币，曲线会高度相似）";
  if (u === "NAD") return "与兰特联动较紧（南非兰特区关联）";
  return null;
}

/** Cursor 面板风格：细线 + 浅填充；悬停显示时点刻度；涨跌用 A 股红绿箭头 */
function FxTrendPanel({
  countryLabel,
  series,
}: {
  countryLabel: string;
  series: FxHistoryCountry;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  const [period, setPeriod] = useCanvasState<FxChgPeriodId>("fxChgPeriod1", "all");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const periodMeta = FX_CHG_PERIODS.find((p) => p.id === period) || FX_CHG_PERIODS[FX_CHG_PERIODS.length - 1]!;
  const pts = useMemo(
    () => sliceFxPointsByMonths(series.points, periodMeta.months),
    [series.points, periodMeta.months],
  );

  const strengthChg = calcFxLocalStrengthChgPct(series, pts);
  const flat = Math.abs(strengthChg) < 0.05;
  const up = strengthChg > 0;
  const stroke = flat ? c.accent : up ? FX_UP : FX_DOWN;
  const fill = flat ? "rgba(80,140,180,0.10)" : up ? "rgba(229,57,53,0.10)" : "rgba(27,143,74,0.10)";

  const W = 640;
  const H = 120;
  const padX = 6;
  const padY = 12;
  const ys = useMemo(() => pts.map((p) => p.v), [pts]);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const span = hi - lo || Math.abs(lo) * 0.02 || 1;
  const xAt = (i: number) => padX + (i / Math.max(1, pts.length - 1)) * (W - padX * 2);
  const yAt = (v: number) => padY + (1 - (v - lo) / span) * (H - padY * 2);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L${xAt(pts.length - 1).toFixed(1)},${(H - padY).toFixed(1)} L${xAt(0).toFixed(1)},${(H - padY).toFixed(1)} Z`;

  const activeIdx = hoverIdx != null && hoverIdx < pts.length ? hoverIdx : pts.length - 1;
  const active = pts[activeIdx]!;
  const spanLabel = fxPointsSpanLabel(pts, series.synthetic && period === "all");

  const shared = sharedCcyNote(series.ccy);
  const subtitle = series.synthetic
    ? `示意 · ${series.pair} · 随机游走 · 窗口 ${periodMeta.label}`
    : `周抽样 · ${series.pair} · ${seriesDateRange(pts)} · 窗口 ${periodMeta.label}${shared ? ` · ${shared}` : ""}`;

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const t = (e.clientX - rect.left) / rect.width;
    const i = Math.round(t * (pts.length - 1));
    setHoverIdx(Math.max(0, Math.min(pts.length - 1, i)));
  };

  const tipLeftPct = (activeIdx / Math.max(1, pts.length - 1)) * 100;

  const chip = (id: FxChgPeriodId, label: string) => {
    const active = period === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => {
          setPeriod(id);
          setHoverIdx(null);
        }}
        style={{
          height: 24,
          padding: "0 8px",
          borderRadius: 6,
          border: `1px solid ${active ? c.accent : c.panelBorder}`,
          background: active ? "rgba(80,140,180,0.12)" : c.panelBg,
          color: active ? c.text : c.textSecondary,
          cursor: "pointer",
          font: "inherit",
          fontSize: 11,
          fontWeight: active ? 600 : 500,
        }}
      >
        {en(label)}
      </button>
    );
  };

  return (
    <Panel
      title={`${countryLabel} · 汇率走势`}
      subtitle={subtitle}
      footer={
        series.synthetic
          ? series.note
          : `${series.source ?? "Frankfurter"} · ${series.unit}${series.note ? ` · ${series.note}` : ""} · 箭头按本币强弱（红涨绿跌）· 可选窗口重算 · 悬停看时点`
      }
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {FX_CHG_PERIODS.map((p) => chip(p.id, p.label))}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <span style={{ fontSize: 22, fontWeight: 600, color: hoverIdx != null ? stroke : c.text }}>
            {formatFxValue(active.v)}
          </span>
          <span style={{ fontSize: 11, color: c.textTertiary, marginLeft: 8 }}>{series.unit}</span>
          {hoverIdx != null ? (
            <span style={{ fontSize: 11, color: c.textSecondary, marginLeft: 10 }}>{active.d}</span>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <FxChgBadge strengthChg={strengthChg} />
          <span style={{ fontSize: 11, color: c.textTertiary }}>{en(spanLabel)}</span>
        </div>
      </div>
      <div
        style={{ position: "relative", width: "100%", marginTop: 4, cursor: "crosshair" }}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={112} preserveAspectRatio="none" aria-hidden>
          <line x1={padX} x2={W - padX} y1={H / 2} y2={H / 2} stroke={c.panelBorder} strokeWidth={1} />
          <path d={area} fill={fill} stroke="none" />
          <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
          {hoverIdx != null ? (
            <>
              <line
                x1={xAt(hoverIdx)}
                x2={xAt(hoverIdx)}
                y1={padY}
                y2={H - padY}
                stroke={c.textTertiary}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <circle cx={xAt(hoverIdx)} cy={yAt(pts[hoverIdx]!.v)} r={3.5} fill={stroke} stroke={c.panelBg} strokeWidth={1.5} />
            </>
          ) : null}
        </svg>
        {hoverIdx != null ? (
          <div
            style={{
              position: "absolute",
              top: 4,
              left: `${tipLeftPct}%`,
              transform: tipLeftPct > 72 ? "translateX(-100%)" : tipLeftPct < 28 ? "translateX(0)" : "translateX(-50%)",
              pointerEvents: "none",
              padding: "4px 8px",
              borderRadius: 4,
              border: `1px solid ${c.panelBorder}`,
              background: c.panelBg,
              fontSize: 11,
              color: c.textSecondary,
              whiteSpace: "nowrap",
              boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
              zIndex: 2,
            }}
          >
            <div style={{ fontWeight: 600, color: c.text }}>{active.d}</div>
            <div>
              {formatFxValue(active.v)}
              <span style={{ color: c.textTertiary, marginLeft: 6 }}>{series.unit}</span>
            </div>
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: c.textTertiary }}>
        <span>{pts[0]?.d}</span>
        <span>
          {en("低")} {formatFxValue(lo)} · {en("高")} {formatFxValue(hi)}
        </span>
        <span>{pts[pts.length - 1]?.d}</span>
      </div>
    </Panel>
  );
}

const CA_YEAR_WINDOWS: readonly { id: "5y" | "10y" | "all"; label: string; years: number | null }[] = [
  { id: "5y", label: "5年", years: 5 },
  { id: "10y", label: "10年", years: 10 },
  { id: "all", label: "全区间", years: null },
];

function ReservesTrendPanel({
  countryLabel,
  countryCode,
  snapRes,
  snapResAsOf,
  fxLevelNote,
}: {
  countryLabel: string;
  countryCode?: string;
  snapRes: number | null;
  snapResAsOf?: string | null;
  fxLevelNote?: string | null;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  const [win, setWin] = useCanvasState<"5y" | "10y" | "all">("resHistWin1", "10y");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const series = countryCode ? getReservesHistory(countryCode) : undefined;
  const winMeta = CA_YEAR_WINDOWS.find((w) => w.id === win) || CA_YEAR_WINDOWS[1]!;

  if (!series) {
    return (
      <Panel
        title={`${countryLabel} · 外汇储备`}
        subtitle={`时点 · 亿美元${snapResAsOf ? ` · ${snapResAsOf}` : ""}`}
        footer={fxLevelNote || (snapRes != null ? "序时暂缺" : "—")}
      >
        <div style={{ fontSize: 22, fontWeight: 600, color: c.text }}>
          {snapRes != null ? snapRes.toLocaleString() : "—"}
        </div>
      </Panel>
    );
  }

  const pts = useMemo(() => sliceReservesByYears(series.points, winMeta.years), [series.points, winMeta.years]);
  const chg = reservesChgPct(pts);
  const flat = Math.abs(chg) < 0.5;
  const up = chg > 0;
  const stroke = flat ? c.accent : up ? "#1B8F4A" : "#C45C26";
  const fill = flat ? "rgba(80,140,180,0.10)" : up ? "rgba(27,143,74,0.10)" : "rgba(196,92,38,0.12)";

  const W = 320;
  const H = 88;
  const padX = 4;
  const padY = 10;
  const ys = pts.map((p) => p.v);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const span = hi - lo || Math.abs(lo) * 0.02 || 1;
  const xAt = (i: number) => padX + (i / Math.max(1, pts.length - 1)) * (W - padX * 2);
  const yAt = (v: number) => padY + (1 - (v - lo) / span) * (H - padY * 2);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L${xAt(pts.length - 1).toFixed(1)},${(H - padY).toFixed(1)} L${xAt(0).toFixed(1)},${(H - padY).toFixed(1)} Z`;
  const activeIdx = hoverIdx != null && hoverIdx < pts.length ? hoverIdx : pts.length - 1;
  const active = pts[activeIdx]!;
  const last = pts[pts.length - 1]!;

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const t = (e.clientX - rect.left) / rect.width;
    setHoverIdx(Math.max(0, Math.min(pts.length - 1, Math.round(t * (pts.length - 1)))));
  };

  const attr = flat ? "区间大致持平" : up ? "外储增厚/缓冲改善" : "外储回落/失血压力";

  return (
    <Panel
      title={`${countryLabel} · 外汇储备`}
      subtitle={`年频 · 亿美元 · ${pts[0]!.d.slice(0, 4)}..${last.d.slice(0, 4)} · ${winMeta.label}`}
      footer={`${series.source ?? "World Bank"}${series.note ? ` · ${series.note}` : ""} · ${attr}${fxLevelNote ? ` · ${fxLevelNote}` : ""}`}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {CA_YEAR_WINDOWS.map((w) => {
          const activeWin = win === w.id;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                setWin(w.id);
                setHoverIdx(null);
              }}
              style={{
                height: 22,
                padding: "0 8px",
                borderRadius: 6,
                border: `1px solid ${activeWin ? c.accent : c.panelBorder}`,
                background: activeWin ? "rgba(80,140,180,0.12)" : c.panelBg,
                color: activeWin ? c.text : c.textSecondary,
                cursor: "pointer",
                font: "inherit",
                fontSize: 11,
                fontWeight: activeWin ? 600 : 500,
              }}
            >
              {en(w.label)}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div>
          <span style={{ fontSize: 22, fontWeight: 600, color: hoverIdx != null ? stroke : c.text, fontVariantNumeric: "tabular-nums" }}>
            {formatReservesYi(active.v)}
          </span>
          <span style={{ fontSize: 10, color: c.textTertiary, marginLeft: 6 }}>{en(`亿美元 · ${active.d.slice(0, 7)}`)}</span>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: flat ? c.textTertiary : up ? "#1B8F4A" : "#C45C26",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {flat ? "–" : up ? "▲" : "▼"}
          {flat ? "" : `${up ? "+" : ""}${chg.toFixed(1)}%`}
        </span>
      </div>
      <div
        style={{ position: "relative", width: "100%", marginTop: 2, cursor: "crosshair" }}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={72} preserveAspectRatio="none" aria-hidden>
          <path d={area} fill={fill} stroke="none" />
          <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
          {hoverIdx != null ? (
            <circle cx={xAt(hoverIdx)} cy={yAt(pts[hoverIdx]!.v)} r={2.8} fill={stroke} stroke={c.panelBg} strokeWidth={1.2} />
          ) : null}
        </svg>
      </div>
    </Panel>
  );
}

function CaTrendPanel({
  countryLabel,
  countryCode,
  snapCa,
  snapCaAsOf,
}: {
  countryLabel: string;
  countryCode?: string;
  snapCa: number | null;
  snapCaAsOf?: string | null;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  const [win, setWin] = useCanvasState<"5y" | "10y" | "all">("caHistWin1", "10y");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const series = countryCode ? getCaHistory(countryCode) : undefined;
  const winMeta = CA_YEAR_WINDOWS.find((w) => w.id === win) || CA_YEAR_WINDOWS[1]!;

  if (!series) {
    return (
      <Panel
        title={`${countryLabel} · 经常账户`}
        subtitle={`时点 · CA/GDP${snapCaAsOf ? ` · ${snapCaAsOf}` : ""}`}
        footer={snapCa != null ? (snapCa >= 0 ? "顺差/平衡偏稳" : "逆差") : "序时暂缺"}
      >
        <div style={{ fontSize: 22, fontWeight: 600, color: snapCa != null && snapCa < 0 ? c.removed : c.added }}>
          {snapCa != null ? `${snapCa}%` : "—"}
        </div>
        <div style={{ marginTop: 8, height: 6, background: theme.fill.quaternary, position: "relative" }}>
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: c.panelBorder }} />
          {snapCa != null ? (
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: snapCa < 0 ? `${50 - Math.min(45, Math.abs(snapCa) * 10)}%` : "50%",
                width: `${Math.min(45, Math.abs(snapCa) * 10)}%`,
                background: snapCa < 0 ? c.removed : c.added,
              }}
            />
          ) : null}
        </div>
      </Panel>
    );
  }

  const pts = useMemo(() => sliceCaByYears(series.points, winMeta.years), [series.points, winMeta.years]);
  const delta = caChgPctPts(pts);
  const flat = Math.abs(delta) < 0.05;
  const up = delta > 0; // 顺差扩大或逆差收窄 = 外部缓冲改善
  const stroke = flat ? c.accent : up ? "#1B8F4A" : "#C45C26";
  const fill = flat ? "rgba(80,140,180,0.10)" : up ? "rgba(27,143,74,0.10)" : "rgba(196,92,38,0.12)";

  const W = 320;
  const H = 88;
  const padX = 4;
  const padY = 10;
  const ys = pts.map((p) => p.v);
  const lo = Math.min(0, ...ys);
  const hi = Math.max(0, ...ys);
  const span = hi - lo || 1;
  const xAt = (i: number) => padX + (i / Math.max(1, pts.length - 1)) * (W - padX * 2);
  const yAt = (v: number) => padY + (1 - (v - lo) / span) * (H - padY * 2);
  const zeroY = yAt(0);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p.v).toFixed(1)}`).join(" ");
  const area = `${line} L${xAt(pts.length - 1).toFixed(1)},${zeroY.toFixed(1)} L${xAt(0).toFixed(1)},${zeroY.toFixed(1)} Z`;
  const activeIdx = hoverIdx != null && hoverIdx < pts.length ? hoverIdx : pts.length - 1;
  const active = pts[activeIdx]!;
  const last = pts[pts.length - 1]!;

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const t = (e.clientX - rect.left) / rect.width;
    setHoverIdx(Math.max(0, Math.min(pts.length - 1, Math.round(t * (pts.length - 1)))));
  };

  const attr =
    flat
      ? "区间大致持平"
      : up
        ? delta > 0 && last.v >= 0
          ? "顺差扩大/外部缓冲改善"
          : "逆差收窄/外部压力缓解"
        : last.v < 0
          ? "逆差加深/外部压力上升"
          : "顺差收窄";

  return (
    <Panel
      title={`${countryLabel} · 经常账户`}
      subtitle={`年频 · CA/GDP · ${pts[0]!.d.slice(0, 4)}..${last.d.slice(0, 4)} · ${winMeta.label}`}
      footer={`${series.source ?? "World Bank"}${series.note ? ` · ${series.note}` : ""} · ${attr} · 零轴=平衡`}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {CA_YEAR_WINDOWS.map((w) => {
          const activeWin = win === w.id;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => {
                setWin(w.id);
                setHoverIdx(null);
              }}
              style={{
                height: 22,
                padding: "0 8px",
                borderRadius: 6,
                border: `1px solid ${activeWin ? c.accent : c.panelBorder}`,
                background: activeWin ? "rgba(80,140,180,0.12)" : c.panelBg,
                color: activeWin ? c.text : c.textSecondary,
                cursor: "pointer",
                font: "inherit",
                fontSize: 11,
                fontWeight: activeWin ? 600 : 500,
              }}
            >
              {en(w.label)}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div>
          <span style={{ fontSize: 22, fontWeight: 600, color: active.v < 0 ? c.removed : c.added, fontVariantNumeric: "tabular-nums" }}>
            {active.v.toFixed(1)}%
          </span>
          <span style={{ fontSize: 10, color: c.textTertiary, marginLeft: 6 }}>{active.d.slice(0, 7)}</span>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: flat ? c.textTertiary : up ? "#1B8F4A" : "#C45C26",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {flat ? "–" : up ? "▲" : "▼"}
          {flat ? "" : `${up ? "+" : ""}${delta.toFixed(1)}pt`}
        </span>
      </div>
      <div
        style={{ position: "relative", width: "100%", marginTop: 2, cursor: "crosshair" }}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={72} preserveAspectRatio="none" aria-hidden>
          <line x1={padX} x2={W - padX} y1={zeroY} y2={zeroY} stroke={c.panelBorder} strokeWidth={1} strokeDasharray="3 3" />
          <path d={area} fill={fill} stroke="none" opacity={0.85} />
          <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
          {hoverIdx != null ? (
            <circle cx={xAt(hoverIdx)} cy={yAt(pts[hoverIdx]!.v)} r={2.8} fill={stroke} stroke={c.panelBg} strokeWidth={1.2} />
          ) : null}
        </svg>
      </div>
    </Panel>
  );
}

export function FxCaCharts({
  snap,
  countryLabel,
  countryCode,
}: {
  snap: MacroChartSnap;
  countryLabel: string;
  countryCode?: string;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  const ca = parseCaGdp(snap.currentAccount);
  const res = parseReservesUsdBn(snap.fxReserves);
  const vol = firstNumber(snap.fxVolInYear);
  const { score, caPts, resPts, volPts, known } = fxResilienceParts(ca, res, vol);
  const fxSeries = countryCode
    ? resolveFxSeries(countryCode, {
        fxTrend: snap.fxTrend,
        fxHint: snap.fxHint,
        fxVolInYear: snap.fxVolInYear,
      })
    : undefined;

  const notes: string[] = [];
  if (ca != null) {
    notes.push(
      ca >= 2
        ? `经常账户顺差约 ${ca}%GDP`
        : ca >= 0
          ? `经常账户大致平衡（${ca}%GDP）`
          : ca > -3
            ? `轻度逆差 ${ca}%GDP`
            : `逆差偏深 ${ca}%GDP`,
    );
  }
  if (res != null) {
    notes.push(
      res >= 1000
        ? `外储约 ${res.toLocaleString()} 亿美元，规模很大`
        : res >= 150
          ? `外储约 ${res.toLocaleString()} 亿美元`
          : res >= 50
            ? `外储约 ${res.toLocaleString()} 亿美元，中等`
            : `外储约 ${res.toLocaleString()} 亿美元，偏薄`,
    );
  }
  if (vol != null) {
    notes.push(vol >= 15 ? `年内汇率波动约 ±${vol}%，偏大` : `年内汇率波动约 ±${vol}%`);
  }
  if (known < 2) notes.push("分项不足，示意分仅供对照");

  const stress =
    score >= 75
      ? "示意：外部缓冲相对厚，极端冲击下本币稳定空间更大"
      : score >= 55
        ? "示意：有一定缓冲，极端冲击仍需锁汇/限兑预案"
        : score >= 40
          ? "示意：缓冲一般，融资与汇兑需并排盯"
          : "示意：缓冲偏弱，极端情形本币稳定压力大";

  const partRow = (label: string, pts: number, has: boolean) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: c.textTertiary }}>
      <span style={{ width: 52, flexShrink: 0 }}>{en(label)}</span>
      <div style={{ flex: 1, height: 4, background: theme.fill.quaternary, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            width: 1,
            background: c.panelBorder,
          }}
        />
        {has ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: pts >= 0 ? "50%" : `${50 - Math.min(50, Math.abs(pts) * 1.6)}%`,
              width: `${Math.min(50, Math.abs(pts) * 1.6)}%`,
              background: pts >= 0 ? c.added : c.removed,
            }}
          />
        ) : null}
      </div>
      <span style={{ width: 36, textAlign: "right", color: !has ? c.textTertiary : pts >= 0 ? c.added : c.removed }}>
        {has ? `${pts >= 0 ? "+" : ""}${Math.round(pts)}` : "—"}
      </span>
    </div>
  );

  const resAsOf = extractAsOf(snap.fxReserves);
  const volAsOf = extractAsOf(snap.fxVolInYear);
  const fxLevelAsOf = extractAsOf(snap.fxTrend) || extractAsOf(snap.fxHint);
  const fxLevelNote =
    snap.fxTrend || snap.fxHint
      ? `汇率水平${fxLevelAsOf ? ` · ${fxLevelAsOf}` : ""}：${splitValue(snap.fxTrend || snap.fxHint || "")}`
      : null;
  const hasExtHist = Boolean(
    (countryCode && getCaHistory(countryCode)) || (countryCode && getReservesHistory(countryCode)),
  );

  return (
    <Stack gap={8}>
      {fxSeries ? (
        <FxTrendPanel countryLabel={countryLabel} series={fxSeries} />
      ) : (
        <Panel title={`${countryLabel} · 汇率走势`} subtitle="暂无可用序列" footer={snap.fxTrend || snap.fxHint || "—"}>
          <Text size="small" tone="tertiary">
            {en("缺公开周序列，且宏观卡未同时给出对美元水平与年内波动，无法示意。")}
          </Text>
        </Panel>
      )}
      <Grid columns={3} gap={8}>
        <CaTrendPanel
          countryLabel={countryLabel}
          countryCode={countryCode}
          snapCa={ca}
          snapCaAsOf={extractAsOf(snap.currentAccount)}
        />
        <ReservesTrendPanel
          countryLabel={countryLabel}
          countryCode={countryCode}
          snapRes={res}
          snapResAsOf={resAsOf}
          fxLevelNote={fxLevelNote}
        />
        <Panel
          title={`${countryLabel} · 汇兑韧性`}
          subtitle={`示意分 ${score}/100 · 非评级 · 混用时段+时点`}
          footer={stress}
        >
          <div style={{ height: 8, background: theme.fill.quaternary, marginTop: 4 }}>
            <div
              style={{
                width: `${score}%`,
                height: "100%",
                background: score >= 75 ? c.added : score >= 55 ? c.accent : c.removed,
              }}
            />
          </div>
          <Stack gap={4} style={{ marginTop: 8 }}>
            {partRow("经常账户", caPts, ca != null)}
            {partRow("外储规模", resPts, res != null)}
            {partRow("汇率波动", volPts, vol != null)}
          </Stack>
          <div style={{ fontSize: 11, color: c.textTertiary, marginTop: 8, lineHeight: 1.4 }}>
            {en(
              `${notes.slice(0, 3).join("；")}${
                snap.fxVolInYear ? `；波动 ${splitValue(snap.fxVolInYear)}${volAsOf ? ` · ${volAsOf}` : ""}` : ""
              }`,
            )}
          </div>
        </Panel>
      </Grid>
      {hasExtHist ? (
        <div style={{ fontSize: 10, color: c.textTertiary, lineHeight: 1.4 }}>
          {en(
            `外部缓冲序时：CA/GDP · ${CA_HISTORY.meta.range}；外储 · ${RESERVES_HISTORY.meta.range || "—"}（世行年频，末端可并入国别卡）。与汇率图并读：逆差加深+外储回落常抬本币压力。对照 ${CA_HISTORY.meta.asOf}${
              RESERVES_HISTORY.meta.asOf && RESERVES_HISTORY.meta.asOf !== CA_HISTORY.meta.asOf
                ? ` / 外储 ${RESERVES_HISTORY.meta.asOf}`
                : ""
            }。`,
          )}
        </div>
      ) : null}
    </Stack>
  );
}

export function CreditDebtCharts({ snap, countryLabel }: { snap: MacroChartSnap; countryLabel: string }) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  const { consumerMn, privateMn } = parseCreditAmounts(snap.privCreditOrConsumer);
  const pair =
    consumerMn != null && privateMn != null && privateMn > 0
      ? { consumerMn, privateMn }
      : null;
  const hh = parseHhDebt(snap.householdDebtToGdp);
  const gov = parseGovDebt(snap.debtToGdp);

  let consShare = 0;
  if (pair) {
    consShare = (pair.consumerMn / pair.privateMn) * 100;
  }

  const hhNearCeil = hh != null && hh >= HH_DEBT_CEIL_LO;
  const govHigh = gov != null && gov >= GOV_DEBT_WATCH;
  const hasAnyCredit = consumerMn != null || privateMn != null;

  let creditFooter = "暂无消费/私营信贷存量口径";
  if (pair) {
    creditFooter = `消费约占私营贷款 ${consShare.toFixed(0)}%（单位已粗对齐）。相对关系用于看零售杠杆浓度。`;
  } else if (consumerMn != null) {
    creditFooter = `仅录入消费信贷约 ${consumerMn.toLocaleString()}（缺私营贷款对照）`;
  } else if (privateMn != null) {
    creditFooter = `仅录入私营/私人部门贷款约 ${privateMn.toLocaleString()}（缺消费信贷分项）`;
  }

  return (
    <Grid columns={2} gap={8}>
      <Panel
        title={`${countryLabel} · 信贷结构`}
        subtitle="时段 · 消费信贷 / 私营部门贷款"
        footer={creditFooter}
      >
        {pair ? (
          <Stack gap={8}>
            <HBar label="消费" pct={Math.min(100, consShare)} color={c.removed} />
            <HBar label="其他*" pct={Math.min(100, Math.max(0, 100 - consShare))} color={c.accent} />
            <div style={{ fontSize: 10, color: c.textTertiary }}>{en("*其他≈私营贷款−消费口径")}</div>
          </Stack>
        ) : hasAnyCredit ? (
          <Stack gap={6}>
            <div style={{ fontSize: 22, fontWeight: 600, color: c.text }}>
              {(consumerMn ?? privateMn)!.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: c.textTertiary }}>
              {consumerMn != null ? en("消费信贷存量（单边）") : en("私营/私人部门贷款（单边）")}
            </div>
          </Stack>
        ) : (
          <Text size="small" tone="tertiary">
            —
          </Text>
        )}
      </Panel>
      <Panel
        title={`${countryLabel} · 负债率`}
        subtitle={`时点 · 居民阈值 ${HH_DEBT_CEIL_LO}–${HH_DEBT_CEIL_HI}% · 政府观察线 ${GOV_DEBT_WATCH}%`}
        footer={
          hhNearCeil
            ? "居民杠杆接近/进入新兴市场过热带，需防触顶"
            : hh != null
              ? `居民杠杆 ${hh}% 距过热带仍有空间，整体未触顶`
              : "居民杠杆暂缺"
        }
      >
        <Stack gap={8}>
          <HBar label="居民" pct={hh ?? 0} color={hhNearCeil ? c.removed : c.added} note={hh == null ? "—" : undefined} />
          <HBar label="政府" pct={Math.min(100, gov ?? 0)} color={govHigh ? c.removed : c.accent} />
          <div style={{ fontSize: 10, color: c.textTertiary }}>
            {en(`信心 ${snap.consumerConfidence ?? "—"}${govHigh ? "；政府债务已过观察线" : ""}`)}
          </div>
        </Stack>
      </Panel>
    </Grid>
  );
}

const STRESS_CHG_PERIODS: readonly { id: FxChgPeriodId; label: string; months: number | null }[] = [
  { id: "1y", label: "1年", months: 12 },
  { id: "3y", label: "3年", months: 36 },
  { id: "5y", label: "5年", months: 60 },
  { id: "all", label: "全区间", months: null },
];

function StressSpark({
  label,
  series,
  format,
  accent,
  months,
  metricId,
}: {
  label: string;
  series: StressSeries;
  format: (v: number) => string;
  accent: string;
  months: number | null;
  metricId?: StressMetricId;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const pts = useMemo(() => sliceStressByMonths(series.points, months), [series.points, months]);
  const chg = stressChgPct(pts);
  const flat = Math.abs(chg) < 0.05;
  const up = chg > 0;
  // 默认：升=压力↑暖色，降=缓用绿；通胀读数为负（通缩）则改冷色
  let stroke = flat ? accent : up ? "#C45C26" : "#1B8F4A";
  let fill = flat ? "rgba(80,140,180,0.10)" : up ? "rgba(196,92,38,0.12)" : "rgba(27,143,74,0.10)";

  const W = 320;
  const H = 72;
  const padX = 4;
  const padY = 8;
  const ys = pts.map((p) => p.v);
  const activeIdx = hoverIdx != null && hoverIdx < pts.length ? hoverIdx : pts.length - 1;
  const active = pts[activeIdx]!;
  const inflNeg = metricId === "inflation" && active.v < 0;
  const crossesZero = metricId === "inflation" && Math.min(...ys) < 0 && Math.max(...ys) > 0;
  const hasNeg = metricId === "inflation" && Math.min(...ys) < 0;
  if (inflNeg) {
    stroke = "#2B6CB0";
    fill = "rgba(43,108,176,0.14)";
  }
  const valueColor = inflNeg ? "#2B6CB0" : hoverIdx != null ? stroke : c.text;

  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  if (hasNeg) {
    lo = Math.min(0, lo);
    hi = Math.max(0, hi);
  }
  const span = hi - lo || Math.abs(lo) * 0.02 || 1;
  const xAt = (i: number) => padX + (i / Math.max(1, pts.length - 1)) * (W - padX * 2);
  const yAt = (v: number) => padY + (1 - (v - lo) / span) * (H - padY * 2);
  const zeroY = hasNeg ? yAt(0) : H - padY;
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p.v).toFixed(1)}`).join(" ");
  const area = hasNeg
    ? `${line} L${xAt(pts.length - 1).toFixed(1)},${zeroY.toFixed(1)} L${xAt(0).toFixed(1)},${zeroY.toFixed(1)} Z`
    : `${line} L${xAt(pts.length - 1).toFixed(1)},${(H - padY).toFixed(1)} L${xAt(0).toFixed(1)},${(H - padY).toFixed(1)} Z`;

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const t = (e.clientX - rect.left) / rect.width;
    setHoverIdx(Math.max(0, Math.min(pts.length - 1, Math.round(t * (pts.length - 1)))));
  };

  return (
    <div
      style={{
        minWidth: 0,
        padding: "8px 8px 6px",
        border: `1px solid ${c.panelBorder}`,
        borderRadius: 6,
        background: c.panelBg,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: c.textSecondary }}>
          <GlossedText text={label} />
          {series.synthetic ? (
            <span style={{ marginLeft: 6, fontWeight: 400, color: c.textTertiary }}>{en("示意")}</span>
          ) : null}
          {inflNeg ? (
            <span style={{ marginLeft: 6, fontWeight: 500, color: "#2B6CB0" }}>{en("通缩")}</span>
          ) : null}
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: flat ? c.textTertiary : up ? "#C45C26" : "#1B8F4A",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {flat ? "–" : up ? "▲" : "▼"}
          {flat ? "" : `${up ? "+" : ""}${chg.toFixed(1)}%`}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: valueColor, fontVariantNumeric: "tabular-nums" }}>
          {format(active.v)}
        </span>
        <span style={{ fontSize: 10, color: c.textTertiary }}>{active.d.slice(0, 7)}</span>
      </div>
      <div
        style={{ position: "relative", width: "100%", marginTop: 2, cursor: "crosshair" }}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={64} preserveAspectRatio="none" aria-hidden>
          {crossesZero || hasNeg ? (
            <line
              x1={padX}
              x2={W - padX}
              y1={zeroY}
              y2={zeroY}
              stroke={c.panelBorder}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ) : null}
          <path d={area} fill={fill} stroke="none" />
          <path d={line} fill="none" stroke={stroke} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
          {hoverIdx != null ? (
            <circle cx={xAt(hoverIdx)} cy={yAt(pts[hoverIdx]!.v)} r={2.8} fill={stroke} stroke={c.panelBg} strokeWidth={1.2} />
          ) : null}
        </svg>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: c.textTertiary }}>
        <span>{pts[0]?.d.slice(0, 7)}</span>
        <span>{series.source ?? ""}</span>
        <span>{pts[pts.length - 1]?.d.slice(0, 7)}</span>
      </div>
    </div>
  );
}

/** 景气与定价压测：通胀 / 政策利率 / 零售汽油精要折线（观测；汽油多为示意） */
export function StressPricingCharts({
  countryCode,
  countryLabel,
  hideGasoline = false,
}: {
  countryCode: string;
  countryLabel: string;
  /** 国家基础信息里不放零售汽油示意折线 */
  hideGasoline?: boolean;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  const [period, setPeriod] = useCanvasState<FxChgPeriodId>("stressChgPeriod1", "3y");
  const row = getStressCountry(countryCode);
  const periodMeta = STRESS_CHG_PERIODS.find((p) => p.id === period) || STRESS_CHG_PERIODS[1]!;

  const cards = STRESS_METRIC_META.filter((m) => !(hideGasoline && m.id === "gasolineRetail")).map((m) => {
    const series = row?.[m.id];
    if (!stressSeriesReady(series)) return null;
    return { ...m, series };
  }).filter(Boolean) as { id: StressMetricId; label: string; format: (v: number) => string; series: StressSeries }[];

  if (!cards.length) {
    return (
      <Panel title={`${countryLabel} · 压测趋势`} subtitle="序时暂缺">
        <Text size="small" tone="tertiary">
          {en("该国暂无通胀/政策利率/汽油序时落库（BIS 未覆盖或汽油缺快照）。")}
        </Text>
      </Panel>
    );
  }

  return (
    <Stack gap={8}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: c.textTertiary }}>
          {en(`压测序时 · ${MACRO_STRESS_HISTORY.meta.range} · 窗口`)}
        </span>
        {STRESS_CHG_PERIODS.map((p) => {
          const active = period === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              style={{
                height: 22,
                padding: "0 8px",
                borderRadius: 6,
                border: `1px solid ${active ? c.accent : c.panelBorder}`,
                background: active ? "rgba(80,140,180,0.12)" : c.panelBg,
                color: active ? c.text : c.textSecondary,
                cursor: "pointer",
                font: "inherit",
                fontSize: 11,
                fontWeight: active ? 600 : 500,
              }}
            >
              {en(p.label)}
            </button>
          );
        })}
      </div>
      <Grid columns={cards.length >= 3 ? 3 : cards.length} gap={8}>
        {cards.map((card) => (
          <StressSpark
            key={card.id}
            label={card.label}
            series={card.series}
            format={card.format}
            accent={c.accent}
            months={periodMeta.months}
            metricId={card.id}
          />
        ))}
      </Grid>
      <div style={{ fontSize: 10, color: c.textTertiary, lineHeight: 1.4 }}>
        {en(
          `通胀/政策利率：BIS 月度观测。${
            hideGasoline ? "" : "零售汽油标「示意」时=TE 泵价水平×布伦特月均路径，非官方零售序时。"
          }涨跌按区间首末变动（升=定价压力↑）；通胀负值标通缩冷色并画零轴。对照时点 ${MACRO_STRESS_HISTORY.meta.asOf}。`,
        )}
      </div>
    </Stack>
  );
}
