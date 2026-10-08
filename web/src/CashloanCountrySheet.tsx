/**
 * 点开国家后的全屏档案：基础信息 → 已投生产商。
 * 对比时按同一模块左右各一列，模块标题保持同行。
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { InvestedGate, useCanViewInvested } from "./ClaimLogin";
import { Button } from "./shims/cursor-canvas";
import { cashloanMacroScoreDetail, scoreCashloanMacro } from "./data/cashloanMacroScore";
import {
  buildCashLoanMacroGroups,
  getCountryMacro,
  type CashLoanMacroMetric,
} from "./data/countryMacro";
import { COUNTRY_IMF_WB } from "./data/countryImfWb";
import { AbsMaturitySection } from "./AbsMaturitySection";
import { cashloanInfraRows, type InfraRegRow, type InfraScoreBar } from "./data/cashloanInfraReg";
import { getCountryLanguage } from "./data/countryLanguage";
import { COUNTRY_ZOOM_BY_CODE, summarizeNbfcForCountry } from "./data/countryZoomDetails";
import { COUNTRY_LABEL_ZH } from "./data/nbfcCountryStats";
import { INVESTED_BY_CODE } from "./data/producerHoldings";
import { getSourceCitation, parseCiteNos } from "./data/sourceCitations";
import { FigureText, MapKV, MapSection, rewriteZhUnits, useMapChrome } from "./HeatMapChrome";
import { CreditDebtCharts, FxCaCharts, IncomeSectorCharts, StressPricingCharts } from "./MacroFactorCharts";
import { VitalPyramid } from "./VitalPyramid";
import { PartnerHoldingsSection } from "./PartnerHoldingsSection";

function stripCites(value: string): string {
  return value.replace(/〔\d+〕|\[S\d+\]/g, "").replace(/[ \t]{2,}/g, " ").trim();
}

/** 正文里已经写了的日期不再在行尾重复。 */
function metricText(m: CashLoanMacroMetric): string {
  const text = stripCites(m.value);
  if (!m.asOf) return text;
  const date = m.asOf.match(/(?:19|20)\d{2}(?:[-–/.]\d{1,2})?/)?.[0];
  if ((date && text.includes(date)) || text.includes(m.asOf)) return text;
  return `${text} · ${m.asOf}`;
}

function dateAlreadyIn(texts: string[], asOf: string): boolean {
  const date = asOf.match(/(?:19|20)\d{2}(?:[-–/.]\d{1,2})?/)?.[0];
  const blob = texts.filter(Boolean).join(" ");
  return Boolean((date && blob.includes(date)) || blob.includes(asOf));
}

function metricLinks(m: CashLoanMacroMetric): string[] {
  const nos = m.citeNos?.length ? m.citeNos : parseCiteNos(m.value);
  const seen = new Set<string>();
  const hrefs: string[] = [];
  for (const no of nos) {
    const href = getSourceCitation(no)?.url;
    if (!href || seen.has(href)) continue;
    seen.add(href);
    hrefs.push(href);
  }
  return hrefs;
}

function MetricTiles({
  items,
}: {
  items: { key: string; label: string; value: string; links?: string[] }[];
}) {
  const { c } = useMapChrome();
  if (!items.length) return <MapKV k="读数" v="暂无" large />;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 16,
      }}
    >
      {items.map((item) => {
        const hrefs = [...new Set((item.links ?? []).filter(Boolean))];
        return (
          <div key={item.key} style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, color: c.textTertiary, marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 18, fontWeight: 400, color: c.text, lineHeight: 1.35, wordBreak: "break-word" }}>
              <FigureText text={item.value} />
            </div>
            {hrefs.length ? (
              <div style={{ marginTop: 4 }}>
                {hrefs.map((href) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "block", fontSize: 13, color: c.link, wordBreak: "break-all" }}
                  >
                    {href}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function scoreText(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  const text = rounded.toFixed(2);
  return text.endsWith("0") ? text.slice(0, -1) : text;
}

function ScoreBars({ bars }: { bars: InfraScoreBar[] }) {
  const { c, theme } = useMapChrome();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {bars.map((bar) => {
        const width = bar.max > 0 ? Math.max(0, Math.min(100, (bar.value / bar.max) * 100)) : 0;
        return (
          <div
            key={`${bar.depth ?? 0}-${bar.label}`}
            style={{
              display: "grid",
              gridTemplateColumns: "8.5em 1fr 5.4em",
              gap: 8,
              alignItems: "center",
              paddingLeft: bar.depth ? 16 : 0,
            }}
          >
            <span style={{ fontSize: 13, color: c.textTertiary, lineHeight: 1.3 }}>{bar.label}</span>
            <div style={{ height: 8, background: theme.fill.quaternary }}>
              <div style={{ width: `${width}%`, height: "100%", background: c.accent }} />
            </div>
            <span style={{ fontSize: 13, color: c.text, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
              {scoreText(bar.value)}/{scoreText(bar.max)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function InfraRows({ rows }: { rows: InfraRegRow[] }) {
  const { c } = useMapChrome();
  const facts = rows.filter((row) => !row.bars?.length);
  const charts = rows.filter((row) => row.bars?.length);
  return (
    <>
      <MetricTiles
        items={facts.map((row) => ({
          key: row.label,
          label: row.label,
          value: row.value,
          links: row.links,
        }))}
      />
      {charts.length ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 16,
            marginTop: 16,
            alignItems: "start",
          }}
        >
          {charts.map((row) => {
            const hrefs = [...new Set(row.links.filter(Boolean))];
            return (
              <div
                key={row.label}
                style={{
                  minWidth: 0,
                  padding: "10px 12px 8px",
                  border: `1px solid ${c.panelBorder}`,
                  borderRadius: 6,
                  background: c.panelBg,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 650, color: c.text, marginBottom: 10 }}>{row.label}</div>
                <ScoreBars bars={row.bars!} />
                <div style={{ marginTop: 10, fontSize: 13, fontWeight: 400, color: c.textSecondary, lineHeight: 1.5 }}>
                  <FigureText text={row.value} />
                </div>
                {hrefs.length ? (
                  <div style={{ marginTop: 6 }}>
                    {hrefs.map((href) => (
                      <a
                        key={href}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: "block", fontSize: 12, color: c.link, wordBreak: "break-all" }}
                      >
                        {href}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}

function metricTiles(metrics: CashLoanMacroMetric[]) {
  return metrics.map((m) => ({
    key: m.label,
    label: m.label,
    value: metricText(m),
    links: metricLinks(m),
  }));
}

const SHEET_SECTIONS = [
  "basic",
  "imf",
  "market",
  "economy",
  "people",
  "credit",
  "fx",
  "infra",
  "abs",
  "holdings",
] as const;

type SheetSection = (typeof SHEET_SECTIONS)[number];

const COMPARE_OPTIONS = Object.entries(COUNTRY_LABEL_ZH)
  .map(([code, name]) => ({ code, name, invested: Boolean(INVESTED_BY_CODE[code]) }))
  .sort((a, b) => Number(b.invested) - Number(a.invested) || a.name.localeCompare(b.name, "zh"));

function sheetModel(code: string) {
  const snap = getCountryMacro(code);
  const groups = snap ? buildCashLoanMacroGroups(snap) : [];
  const byId = new Map(groups.map((g) => [g.id, g]));
  const pick = (id: string, labels: string[]) =>
    (byId.get(id)?.metrics ?? []).filter((m) => labels.includes(m.label));
  const invested = INVESTED_BY_CODE[code];
  return {
    code,
    snap,
    lang: getCountryLanguage(code),
    zoom: COUNTRY_ZOOM_BY_CODE[code],
    nbfc: summarizeNbfcForCountry(code),
    invested,
    infra: cashloanInfraRows(code),
    imf: COUNTRY_IMF_WB.byCode[code],
    countryLabel: COUNTRY_LABEL_ZH[code] ?? invested?.country_zh ?? code,
    economy: [
      ...pick("stress", ["GDP同比", "通胀"]),
      ...pick("borrower", ["人均收入", "人均GDP", "三产结构", "消费者信心"]),
      ...pick("fx_cross", ["政策利率"]),
      ...pick("credit_heat", ["政府债务/GDP"]),
    ],
    people: pick("borrower", ["总人口", "年龄结构", "失业率", "就业/人口", "就业备注"]),
    credit: pick("credit_heat", ["居民杠杆率", "消费/私营信贷"]),
    fx: pick("fx_cross", ["外汇储备", "经常账户", "年内汇率波动", "汇率水平"]),
  };
}

function CountrySheetBlock({ code, section }: { code: string; section: SheetSection }) {
  const canSeeInvested = useCanViewInvested();
  const m = sheetModel(code);
  if (section === "basic") {
    return (
      <MapSection title="基础信息" large>
        <MetricTiles
          items={[
            { key: "code", label: "代码", value: m.code },
            ...(m.lang ? [{ key: "lang", label: "语言", value: `${m.lang.zone} · ${m.lang.languages}` }] : []),
            ...(m.lang?.productHint ? [{ key: "hint", label: "产品常用语", value: m.lang.productHint }] : []),
            ...(m.zoom
              ? [{ key: "pop", label: "人口（约）", value: rewriteZhUnits(`${m.zoom.population_millions}百万`) }]
              : []),
          ]}
        />
      </MapSection>
    );
  }
  if (section === "imf") {
    return (
      <MapSection title="IMF / 世行" large>
        {m.imf ? (
          <MetricTiles
            items={[
              { key: "imf", label: "IMF", value: m.imf.imfDevTagZh, links: ["https://www.imf.org/"] },
              { key: "wb", label: "世行", value: m.imf.wbIncomeZh, links: ["https://data.worldbank.org/"] },
            ]}
          />
        ) : (
          <MapKV k="分类" v="暂无" large />
        )}
      </MapSection>
    );
  }
  if (section === "market") {
    return (
      <MapSection title="信贷市场总览" large>
        {m.nbfc ? (
          <>
            <MapKV
              k="放贷总量"
              v={
                m.nbfc.lendingUsdBn > 0
                  ? `约 USD ${m.nbfc.lendingUsdBn >= 10 ? m.nbfc.lendingUsdBn.toFixed(1) : m.nbfc.lendingUsdBn.toFixed(2)} bn`
                  : "—"
              }
              large
            />
            {m.nbfc.rows.map((r) => (
              <div key={r.category} style={{ marginTop: 14 }}>
                <MapKV k="口径" v={r.category} large />
                <MapKV k="在贷" v={r.loan_book_usd || r.loan_book_total || "—"} large />
                <MapKV k="机构数" v={r.nbfc_count || "—"} large />
                {r.default_rate ? <MapKV k="违约/不良" v={r.default_rate} large /> : null}
                {r.as_of && !dateAlreadyIn([r.nbfc_count, r.loan_book_usd, r.loan_book_total, r.default_rate], r.as_of) ? (
                  <MapKV k="时点" v={r.as_of} large />
                ) : null}
                {r.regulator ? <MapKV k="监管" v={r.regulator} large /> : null}
                {r.source_url ? <MapKV k="来源" v="" links={[r.source_url]} large /> : null}
              </div>
            ))}
          </>
        ) : (
          <MapKV k="放贷" v="暂无" large />
        )}
      </MapSection>
    );
  }
  if (section === "economy") {
    return (
      <MapSection title="经济基本面" large>
        <MetricTiles items={metricTiles(m.economy)} />
        {m.snap ? (
          <div style={{ marginTop: 16 }}>
            <IncomeSectorCharts snap={m.snap} countryLabel={m.countryLabel} countryCode={m.code} />
            <div style={{ marginTop: 16 }}>
              <StressPricingCharts countryCode={m.code} countryLabel={m.countryLabel} hideGasoline />
            </div>
          </div>
        ) : null}
      </MapSection>
    );
  }
  if (section === "people") {
    return (
      <MapSection title="人口与就业" large>
        <MetricTiles items={metricTiles(m.people)} />
        <div style={{ marginTop: 16 }}>
          <VitalPyramid country={m.code} countryLabel={m.countryLabel} />
        </div>
      </MapSection>
    );
  }
  if (section === "credit") {
    return (
      <MapSection title="居民信贷" large>
        <MetricTiles items={metricTiles(m.credit)} />
        {m.snap ? (
          <div style={{ marginTop: 16 }}>
            <CreditDebtCharts snap={m.snap} countryLabel={m.countryLabel} />
          </div>
        ) : null}
      </MapSection>
    );
  }
  if (section === "fx") {
    return (
      <MapSection title="外汇与跨境资本" large>
        <MetricTiles items={metricTiles(m.fx)} />
        {m.snap ? (
          <div style={{ marginTop: 16 }}>
            <FxCaCharts snap={m.snap} countryLabel={m.countryLabel} countryCode={m.code} />
          </div>
        ) : null}
      </MapSection>
    );
  }
  if (section === "infra") {
    return (
      <MapSection title="基础设施与监管" large>
        {m.infra ? (
          <InfraRows rows={m.infra} />
        ) : (
          <MapKV
            k="读数"
            v="本地信源未收录该国的征信覆盖率、智能机与移动互联网、司法执行、利率上限/牌照/外资、催收与数据法。"
            large
          />
        )}
      </MapSection>
    );
  }
  if (section === "abs") {
    return (
      <MapSection title="ABS成熟度" large>
        <AbsMaturitySection code={m.code} />
      </MapSection>
    );
  }
  if (!canSeeInvested) {
    return (
      <MapSection title="已投生产商" large>
        <InvestedGate>
          <span />
        </InvestedGate>
      </MapSection>
    );
  }
  return <PartnerHoldingsSection invested={m.invested} unmasked large showEmpty title="已投生产商" />;
}

export function MacroScoreRadar({ code, size = 128 }: { code: string; size?: number }) {
  const { c } = useMapChrome();
  const detail = cashloanMacroScoreDetail(code);
  if (!detail || detail.groups.every((group) => group.score == null)) return null;
  const n = detail.groups.length;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.3;
  const angle = (index: number) => -Math.PI / 2 + (index * 2 * Math.PI) / n;
  const at = (index: number, ratio: number) => {
    const a = angle(index);
    return [cx + Math.cos(a) * radius * ratio, cy + Math.sin(a) * radius * ratio];
  };
  const ring = (ratio: number) => detail.groups.map((_, index) => at(index, ratio).map((n) => n.toFixed(1)).join(",")).join(" ");
  const closed = detail.groups.every((group) => group.score != null);
  const shape = closed
    ? detail.groups
        .map((group, index) => at(index, Math.min(100, group.score ?? 0) / 100).map((n) => n.toFixed(1)).join(","))
        .join(" ")
    : null;
  const caption = detail.groups
    .map((group) => `${group.label}${group.score == null ? "无读数" : Math.round(group.score)}`)
    .join("，");
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`维度 ${caption}`}
      style={{ flexShrink: 0, overflow: "visible" }}
    >
      {[1, 0.85, 0.55].map((ratio) => (
        <polygon key={ratio} points={ring(ratio)} fill="none" stroke={c.panelBorder} strokeWidth={1} />
      ))}
      {detail.groups.map((group, index) => {
        const [x, y] = at(index, 1);
        return <line key={group.id} x1={cx} y1={cy} x2={x} y2={y} stroke={c.panelBorder} strokeWidth={1} />;
      })}
      {shape ? <polygon points={shape} fill={c.text} fillOpacity={0.12} stroke={c.text} strokeWidth={1.5} /> : null}
      {detail.groups.map((group, index) => {
        if (group.score == null) return null;
        const [x, y] = at(index, Math.min(100, group.score) / 100);
        return <circle key={group.id} cx={x} cy={y} r={2.4} fill={c.text} />;
      })}
      {detail.groups.map((group, index) => {
        const [x, y] = at(index, 1);
        const a = angle(index);
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const anchor = cos > 0.35 ? "start" : cos < -0.35 ? "end" : "middle";
        const dx = cos > 0.35 ? 5 : cos < -0.35 ? -5 : 0;
        const dy = sin > 0.35 ? 12 : sin < -0.35 ? -6 : 3;
        return (
          <text
            key={`${group.id}-label`}
            x={x + dx}
            y={y + dy}
            textAnchor={anchor}
            fill={c.textSecondary}
            fontSize={10}
            fontWeight={400}
          >
            {group.label}
          </text>
        );
      })}
    </svg>
  );
}

export function MacroScoreBreakdown({
  code,
  align = "end",
}: {
  code: string;
  align?: "start" | "end";
}) {
  const { c } = useMapChrome();
  const detail = cashloanMacroScoreDetail(code);
  if (!detail) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "end" ? "flex-end" : "flex-start",
        gap: 3,
        marginTop: 6,
      }}
    >
      {detail.groups.map((group) => (
        <div
          key={group.id}
          style={{ fontSize: 12, fontWeight: 400, color: c.textSecondary, lineHeight: 1.45, textAlign: align }}
        >
          <span style={{ color: c.text }}>{group.label} </span>
          <span style={{ fontWeight: 700, color: c.text, fontVariantNumeric: "tabular-nums" }}>
            {group.score == null ? "—" : Math.round(group.score)}
          </span>
          {group.items.map((item, index) => (
            <span key={item.label}>
              {index === 0 ? " " : " · "}
              {item.label}{" "}
              <span style={{ fontWeight: 700, color: c.text, fontVariantNumeric: "tabular-nums" }}>
                {item.score == null ? "—" : item.score}
              </span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function ColumnHead({ code }: { code: string }) {
  const { c } = useMapChrome();
  const name = COUNTRY_LABEL_ZH[code] ?? INVESTED_BY_CODE[code]?.country_zh ?? code;
  const score = scoreCashloanMacro(code);
  return (
    <div style={{ minWidth: 0, padding: "2px 8px 14px" }}>
      <div style={{ fontSize: 22, fontWeight: 650, color: c.text }}>{name} · {code}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <MacroScoreRadar code={code} size={112} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, color: c.textTertiary }}>
            国家综合打分 {score == null ? "—" : Math.round(score)}
          </div>
          <MacroScoreBreakdown code={code} align="start" />
        </div>
      </div>
    </div>
  );
}

export function CashloanCountrySheet({ code }: { code: string }) {
  return (
    <div>
      {SHEET_SECTIONS.map((section) => (
        <CountrySheetBlock key={section} code={code} section={section} />
      ))}
    </div>
  );
}

export function CashloanCountryCompare({ left, right }: { left: string; right: string }) {
  const { c } = useMapChrome();
  const cell = (edge: boolean): CSSProperties => ({
    minWidth: 0,
    height: "100%",
    boxSizing: "border-box",
    padding: "16px 18px 8px",
    borderBottom: `1px solid ${c.panelBorder}`,
    borderRight: edge ? `1px solid ${c.panelBorder}` : undefined,
  });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 0, alignItems: "stretch" }}>
      <div style={cell(true)}>
        <ColumnHead code={left} />
      </div>
      <div style={cell(false)}>
        <ColumnHead code={right} />
      </div>
      {SHEET_SECTIONS.flatMap((section) => [
        <div key={`${section}-l`} style={cell(true)}>
          <CountrySheetBlock code={left} section={section} />
        </div>,
        <div key={`${section}-r`} style={cell(false)}>
          <CountrySheetBlock code={right} section={section} />
        </div>,
      ])}
    </div>
  );
}

export function CountryCompareButton({
  current,
  value,
  onChange,
}: {
  current: string;
  value: string | null;
  onChange: (code: string | null) => void;
}) {
  const { c } = useMapChrome();
  const canSeeInvested = useCanViewInvested();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const picked = value ? COMPARE_OPTIONS.find((row) => row.code === value) : undefined;
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COMPARE_OPTIONS.filter((row) => row.code !== current)
      .filter((row) => {
        if (!q) return true;
        return row.name.toLowerCase().includes(q) || row.code.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (canSeeInvested) {
          const invested = Number(b.invested) - Number(a.invested);
          if (invested !== 0) return invested;
        }
        return a.name.localeCompare(b.name, "zh");
      });
  }, [current, query, canSeeInvested]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: 8 }}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setOpen((v) => !v);
          setQuery("");
        }}
      >
        {picked ? `对比 · ${picked.name}` : "对比"}
      </Button>
      {picked ? (
        <Button variant="secondary" size="sm" onClick={() => onChange(null)}>
          退出对比
        </Button>
      ) : null}
      {open ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 280,
            zIndex: 6,
            borderRadius: 8,
            border: `1px solid ${c.panelBorder}`,
            background: c.panelBg,
            boxShadow: "0 8px 24px rgba(35, 41, 70, 0.12)",
            overflow: "hidden",
          }}
        >
          <input
            autoFocus
            value={query}
            placeholder="搜索国家"
            aria-label="搜索对比国家"
            onChange={(event) => setQuery(event.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "none",
              borderBottom: `1px solid ${c.panelBorder}`,
              background: "transparent",
              color: c.text,
              font: "inherit",
              fontSize: 14,
              padding: "10px 12px",
              outline: "none",
            }}
          />
          <div style={{ maxHeight: 320, overflow: "auto" }}>
            {options.length ? (
              options.map((row) => (
                <button
                  key={row.code}
                  type="button"
                  onClick={() => {
                    onChange(row.code);
                    setOpen(false);
                  }}
                  style={{
                    display: "flex",
                    width: "100%",
                    justifyContent: "space-between",
                    gap: 8,
                    border: "none",
                    background: row.code === value ? c.fillSoft : "transparent",
                    color: c.text,
                    font: "inherit",
                    fontSize: 14,
                    textAlign: "left",
                    padding: "8px 12px",
                    cursor: "pointer",
                  }}
                >
                  <span>{row.name}</span>
                  <span style={{ color: c.textTertiary }}>{canSeeInvested && row.invested ? "已投" : row.code}</span>
                </button>
              ))
            ) : (
              <div style={{ padding: "12px", fontSize: 13, color: c.textTertiary }}>没有匹配的国家</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
