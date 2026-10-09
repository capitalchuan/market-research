import { useHostTheme, Text, Stack, Grid } from "./shims/cursor-canvas";
import { mapChrome } from "./heatMapTheme";
import { en } from "./enSurface";
import {
  COUNTRY_EMPLOYED_STOCK,
  LABOR_FLOW_AGES,
  analyzePostPeakTrend,
  buildLaborFlowSeries,
  entryAgeForCountry,
  findEmploymentPeak,
  forecastEmploymentStock,
  forecastLaborNet,
  formatPersonsWan,
  formatYi,
  getVitalCountry,
  type EmploymentForecastRow,
  type LaborFlowRow,
} from "./data/vitalSeries";

type Props = {
  country: string;
  countryLabel: string;
  recentYears?: number;
  forecastYears?: number;
  /** 就业存量外延年数（找拐点后走势） */
  employmentHorizonYears?: number;
  entryAge?: number;
  retireAge?: number;
};

/** Cursor 扁平面板：细描边、无阴影、无强调色外框 */
function Panel({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  return (
    <div
      style={{
        minWidth: 0,
        height: "100%",
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
      <div
        style={{
          borderBottom: `1px solid ${c.panelBorder}`,
          paddingBottom: 6,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: c.textSecondary, lineHeight: 1.3 }}>
          {en(title)}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 11, color: c.textTertiary, marginTop: 2, lineHeight: 1.35 }}>
            {en(subtitle)}
          </div>
        ) : null}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      {footer ? (
        <div style={{ fontSize: 11, color: c.textSecondary, lineHeight: 1.4 }}>{footer}</div>
      ) : null}
    </div>
  );
}

/**
 * 三图横排（各约 1/3）：入职/退休 | 队列净增 | 就业存量
 */
export function VitalPyramid({
  country,
  countryLabel,
  recentYears = 24,
  forecastYears = 10,
  employmentHorizonYears = 20,
  entryAge: entryAgeProp,
  retireAge = LABOR_FLOW_AGES.retire,
}: Props) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  const vital = getVitalCountry(country);
  if (!vital) return null;

  const entryAge = entryAgeProp ?? entryAgeForCountry(country);
  const asOfBirthYear = vital.latest.y;

  const fullFlow = buildLaborFlowSeries(vital.series, {
    entryAge,
    retireAge,
    toYear: asOfBirthYear,
  });
  if (fullFlow.length === 0) return null;
  const series = fullFlow.slice(-recentYears);
  const maxVal = Math.max(
    1,
    ...series.map((r) => Math.max(r.entrants ?? 0, r.retirees ?? 0)),
  );

  const latest = series[series.length - 1]!;
  const forecast = forecastLaborNet(vital.series, {
    entryAge,
    retireAge,
    asOfYear: asOfBirthYear,
    years: forecastYears,
  });

  const anchor = COUNTRY_EMPLOYED_STOCK[country];
  const emp = anchor
    ? forecastEmploymentStock(vital.series, {
        employed0: anchor.employed,
        asOfYear: Math.min(anchor.asOfYear, asOfBirthYear),
        entryAge,
        retireAge,
        years: employmentHorizonYears,
      })
    : null;

  const rowH = 11;
  const chartH = series.length * rowH;
  const halfW = 70;
  const yearW = 34;

  return (
    <Stack gap={8}>
      <Grid columns={3} gap={8}>
        <Panel
          title={`${countryLabel} · 入职/退休`}
          subtitle={`右入职 ${entryAge}岁 · 左退休 ${retireAge}岁${
            country === "MX" ? " · 墨最低劳动年龄15" : ""
          }`}
          footer={
            <>
              {latest.y}：{en("入职")} {latest.entrants != null ? en(formatPersonsWan(latest.entrants)) : "—"} −
              {en("退休")} {latest.retirees != null ? en(formatPersonsWan(latest.retirees)) : "—"}
              {latest.net != null ? ` = ${en("净增")} ${en(formatPersonsWan(latest.net))}` : ""}
            </>
          }
        >
          <div style={{ overflowX: "auto" }}>
            <div
              style={{
                position: "relative",
                width: halfW + yearW + halfW,
                height: chartH,
                margin: "0 auto",
              }}
            >
              {/* 中轴细线替代强调色外框 */}
              <div
                style={{
                  position: "absolute",
                  left: halfW + yearW / 2,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: c.panelBorder,
                  pointerEvents: "none",
                }}
              />
              {series.map((r, i) => {
                const e = r.entrants ?? 0;
                const ret = r.retirees ?? 0;
                return (
                  <div
                    key={r.y}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: i * rowH,
                      width: halfW + yearW + halfW,
                      height: rowH,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ width: halfW, display: "flex", justifyContent: "flex-end" }}>
                      <div
                        title={`退休 ${ret.toLocaleString()}`}
                        style={{
                          width: (ret / maxVal) * halfW,
                          height: 7,
                          background: theme.fill.primary,
                          borderRadius: 0,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        width: yearW,
                        textAlign: "center",
                        fontSize: 10,
                        color: c.textTertiary,
                        fontVariantNumeric: "tabular-nums",
                        flexShrink: 0,
                      }}
                    >
                      {r.y}
                    </div>
                    <div style={{ width: halfW, display: "flex", justifyContent: "flex-start" }}>
                      <div
                        title={`入职 ${e.toLocaleString()}`}
                        style={{
                          width: (e / maxVal) * halfW,
                          height: 7,
                          background: c.removed,
                          opacity: 0.85,
                          borderRadius: 0,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>

        {forecast.length > 0 ? (
          <LaborForecastChart rows={forecast} countryLabel={countryLabel} />
        ) : (
          <div />
        )}

        {emp && anchor ? (
          <EmploymentStockForecastChart
            countryLabel={countryLabel}
            k={emp.k}
            cohortStock={emp.cohortStock}
            employed0={anchor.employed}
            rows={emp.rows}
          />
        ) : (
          <Panel title={`${countryLabel} · 就业存量`} subtitle="暂无就业锚点">
            <Text size="small" tone="tertiary">
              —
            </Text>
          </Panel>
        )}
      </Grid>

      <div style={{ fontSize: 11, color: c.textTertiary, lineHeight: 1.4 }}>
        {en(
          `三图横排各约 1/3 · 队列达龄推算 · k=就业/适龄出生队列示意存量 · 源 OWID/UN WPP${
            anchor ? " + 就业锚点" : ""
          }`,
        )}
      </div>
    </Stack>
  );
}

function LaborForecastChart({
  rows,
  countryLabel,
}: {
  rows: LaborFlowRow[];
  countryLabel: string;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  const nets = rows.map((r) => r.net ?? 0);
  const maxAbs = Math.max(1, ...nets.map((n) => Math.abs(n)));
  const barMaxH = 52;
  const y0 = rows[0]?.y;
  const y1 = rows[rows.length - 1]?.y;

  return (
    <Panel
      title={`${countryLabel} · 队列净增 ${rows.length}年`}
      subtitle="入职 − 退休 · 上正下负"
      footer={
        <>
          {y0}–{y1} {en("合计")} {en(formatPersonsWan(nets.reduce((a, b) => a + b, 0)))}
        </>
      }
    >
      <div style={{ position: "relative", height: barMaxH * 2 + 28 }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: barMaxH,
            borderTop: `1px solid ${c.panelBorder}`,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 2,
            height: barMaxH * 2 + 28,
          }}
        >
          {rows.map((r) => {
            const net = r.net ?? 0;
            const h = (Math.abs(net) / maxAbs) * barMaxH;
            const positive = net >= 0;
            return (
              <div
                key={r.y}
                title={`${r.y}: ${net.toLocaleString()}`}
                style={{
                  flex: "1 1 0",
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: barMaxH * 2 + 28,
                }}
              >
                <div
                  style={{
                    height: barMaxH,
                    width: "100%",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                  }}
                >
                  {positive ? (
                    <div
                      style={{
                        width: "70%",
                        maxWidth: 14,
                        height: Math.max(1, h),
                        background: c.added,
                      }}
                    />
                  ) : null}
                </div>
                <div
                  style={{
                    height: barMaxH,
                    width: "100%",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                  }}
                >
                  {!positive ? (
                    <div
                      style={{
                        width: "70%",
                        maxWidth: 14,
                        height: Math.max(1, h),
                        background: c.removed,
                      }}
                    />
                  ) : null}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: c.textTertiary,
                    fontVariantNumeric: "tabular-nums",
                    marginTop: 4,
                  }}
                >
                  {String(r.y).slice(2)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function EmploymentStockForecastChart({
  countryLabel,
  k,
  cohortStock,
  employed0,
  rows,
}: {
  countryLabel: string;
  k: number;
  cohortStock: number;
  employed0: number;
  rows: EmploymentForecastRow[];
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  const peak = findEmploymentPeak(rows);
  const post = peak ? analyzePostPeakTrend(rows, peak.idx) : null;
  const levels = rows.map((r) => r.employed);
  // 存量图必须含 0 基线；旧逻辑按 min~max 拉伸，会把小幅回落画成「贴地归零」假象
  const minE = 0;
  const maxE = Math.max(...levels, 1);
  const span = maxE - minE;
  const h = 88;
  const last = rows[rows.length - 1]!;
  const w = Math.max(280, rows.length * 14);
  const padL = 34;
  const pad = 6;

  const xAt = (i: number) => padL + (i / Math.max(1, rows.length - 1)) * (w - padL - pad);
  const yAt = (e: number) => pad + (1 - (e - minE) / span) * h;

  return (
    <Panel
      title={`${countryLabel} · 就业存量`}
      subtitle={`k=${k.toFixed(3)} · ${formatYi(employed0)} / ${formatYi(cohortStock)} · 纵轴自 0`}
      footer={
        <>
          {rows[0]?.y} {en(formatYi(employed0))} → {last.y} {en(formatYi(last.employed))}（Δ
          {en(formatPersonsWan(last.employed - employed0))}）
          {peak ? en(` · 拐点 ${peak.y} ${formatYi(peak.employed)}`) : ""}
          {post ? ` · ${en(post.note)}` : ""}
        </>
      }
    >
      <svg
        width="100%"
        viewBox={`0 0 ${w} ${h + 36}`}
        style={{ display: "block", maxHeight: h + 36 }}
      >
        <line
          x1={padL}
          y1={pad + h}
          x2={w - pad}
          y2={pad + h}
          stroke={c.panelBorder}
          strokeWidth={1}
        />
        <text x={2} y={pad + 8} fontSize={8} fill={c.textTertiary}>
          {en(formatYi(maxE))}
        </text>
        <text x={2} y={pad + h} fontSize={8} fill={c.textTertiary}>
          0
        </text>
        {rows.length > 1
          ? rows.map((r, i) => {
              if (i === 0) return null;
              const prev = rows[i - 1]!;
              return (
                <line
                  key={`l-${r.y}`}
                  x1={xAt(i - 1)}
                  y1={yAt(prev.employed)}
                  x2={xAt(i)}
                  y2={yAt(r.employed)}
                  stroke={c.accent}
                  strokeWidth={1.5}
                />
              );
            })
          : null}
        {rows.map((r, i) => (
          <g key={r.y}>
            <circle
              cx={xAt(i)}
              cy={yAt(r.employed)}
              r={peak && peak.idx === i ? 4 : 2}
              fill={peak && peak.idx === i ? c.removed : c.accent}
            />
            <text x={xAt(i)} y={h + 16} textAnchor="middle" fontSize={8} fill={c.textTertiary}>
              {String(r.y).slice(2)}
            </text>
          </g>
        ))}
        {peak ? (
          <g>
            <line
              x1={xAt(peak.idx)}
              y1={yAt(peak.employed)}
              x2={xAt(peak.idx)}
              y2={pad}
              stroke={c.removed}
              strokeWidth={1}
              strokeDasharray="3 2"
            />
            <text
              x={Math.min(w - 4, xAt(peak.idx) + 4)}
              y={Math.max(12, yAt(peak.employed) - 6)}
              fontSize={9}
              fill={c.removed}
            >
              {en(`${peak.y} 拐点 ${formatYi(peak.employed)}`)}
            </text>
          </g>
        ) : null}
      </svg>
    </Panel>
  );
}
