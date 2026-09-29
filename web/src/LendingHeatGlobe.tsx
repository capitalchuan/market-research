import { useMemo, useState, type ReactNode } from "react";
import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import worldTopology from "world-atlas/countries-110m.json";
import { COUNTRY_LABEL_ZH, NBFC_STATS } from "./data/nbfcCountryStats";
import {
  COUNTRY_ZOOM_BY_CODE,
  playFinanceChartUrl,
  summarizeNbfcForCountry,
} from "./data/countryZoomDetails";
import {
  MapSection,
  MapKV,
  MapDetailShell,
  MapChip,
  MapSvgFrame,
  MapTooltip,
  SteppedLegend,
  MapSideLegend,
  MapMuted,
  MapExtLink,
  useMapChrome,
  Button,
  MapCountryMacroBrief,
  RankBarList,
  type MapLegendPlacement,
  useMapViewport,
  mapFrameWidth,
} from "./HeatMapChrome";
import { heatColorWarm } from "./heatMapTheme";
import { formatCountryLanguageLine } from "./data/countryLanguage";
import { INVESTED_BY_CODE } from "./data/producerHoldings";
import { useCanvasState } from "./shims/cursor-canvas";
import { countryLabelUi, detectBrowserUiLang, type UiLang } from "./uiI18n";

type CountryProps = { name?: string };

/** ISO 3166-1 numeric (as in world-atlas) → CRM alpha-2 */
const N3_TO_A2: Record<string, string> = {
  "356": "IN",
  "156": "CN",
  "392": "JP",
  "360": "ID",
  "764": "TH",
  "458": "MY",
  "484": "MX",
  "050": "BD",
  "50": "BD",
  "710": "ZA",
  "144": "LK",
  "288": "GH",
  "586": "PK",
  "566": "NG",
  "404": "KE",
  "158": "TW",
  "410": "KR",
  "704": "VN",
  "608": "PH",
  "840": "US",
  "124": "CA",
  "826": "GB",
  "076": "BR",
  "76": "BR",
  "170": "CO",
  "032": "AR",
  "32": "AR",
  "604": "PE",
  "152": "CL",
  "818": "EG",
  "504": "MA",
  "682": "SA",
  "784": "AE",
  "792": "TR",
  "368": "IQ",
  "364": "IR",
  "400": "JO",
  "422": "LB",
  "434": "LY",
  "729": "SD",
  "788": "TN",
  "012": "DZ",
  "12": "DZ",
  "048": "BH",
  "48": "BH",
  "414": "KW",
  "512": "OM",
  "634": "QA",
  "887": "YE",
  "275": "PS",
  "376": "IL",
  "496": "MN",
  "398": "KZ",
  "860": "UZ",
  "417": "KG",
  "762": "TJ",
  "795": "TM",
  "834": "TZ",
  "800": "UG",
  "646": "RW",
  "231": "ET",
  "384": "CI",
  "686": "SN",
  "120": "CM",
  "024": "AO",
  "24": "AO",
  "508": "MZ",
  "894": "ZM",
  "716": "ZW",
  "072": "BW",
  "72": "BW",
  "516": "NA",
  "480": "MU",
  "450": "MG",
  "204": "BJ",
  "854": "BF",
  "466": "ML",
  "180": "CD",
  "266": "GA",
  "324": "GN",
  "276": "DE",
  "250": "FR",
  "528": "NL",
  "724": "ES",
  "620": "PT",
  "380": "IT",
  "752": "SE",
  "616": "PL",
  "372": "IE",
  "643": "RU",
  "344": "HK",
  "702": "SG",
};

function normId(id: string | number | undefined): string {
  if (id == null) return "";
  return String(id).replace(/^0+/, "") || "0";
}

/** 按国家汇总放贷 USD(bn) */
export function aggregateLendingUsdBn(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of NBFC_STATS.rows) {
    const bn = r.loan_book_usd_bn;
    if (bn == null || !(bn > 0)) continue;
    out[r.country_code] = (out[r.country_code] ?? 0) + bn;
  }
  return out;
}


type HoverInfo = {
  a2: string;
  name: string;
  usdBn: number;
  x: number;
  y: number;
};

function CountryDetailPanel({
  code,
  onClose,
  overlay = false,
}: {
  code: string;
  onClose: () => void;
  overlay?: boolean;
}) {
  const { c } = useMapChrome();
  const [uiLang] = useCanvasState<UiLang>("uiLang1", detectBrowserUiLang());
  const en = uiLang === "en";
  const zoom = COUNTRY_ZOOM_BY_CODE[code];
  const nbfc = summarizeNbfcForCountry(code);
  const name = countryLabelUi(code, uiLang, COUNTRY_LABEL_ZH[code] ?? code);
  const chartUrl = zoom?.source_url || playFinanceChartUrl(code);
  const langLine = formatCountryLanguageLine(code, uiLang);
  const detailHint = en
    ? "Zoom detail · click Back to world to exit"
    : "放大详情 · 点击「返回全球」退出";

  return (
    <MapDetailShell
      title={`${name} · ${code}`}
      subtitle={langLine ? `${langLine} · ${detailHint}` : detailHint}
      onClose={onClose}
      overlay={overlay}
    >
      <MapSection title={en ? "Population" : "人口情况"}>
        {zoom ? (
          <>
            <MapKV
              k={en ? "Population (approx.)" : "人口（约）"}
              v={
                en
                  ? `${zoom.population_millions.toLocaleString()} m`
                  : `${zoom.population_millions.toLocaleString()} 百万`
              }
            />
            <MapKV k={en ? "Demographics" : "人口结构"} v={zoom.demographic_note} />
            <MapKV k={en ? "Population source" : "人口信源"} v={zoom.population_source} />
          </>
        ) : (
          <MapMuted>{en ? "No population summary" : "暂无人口摘要"}</MapMuted>
        )}
      </MapSection>

      <MapSection title={en ? "NBFC / non-bank peers" : "NBFC / 等效非银"}>
        {nbfc ? (
          <>
            <MapKV
              k={en ? "Lending total (USD)" : "放贷总量(USD)"}
              v={
                nbfc.lendingUsdBn > 0
                  ? `${en ? "~" : "约 "}USD ${nbfc.lendingUsdBn >= 10 ? nbfc.lendingUsdBn.toFixed(1) : nbfc.lendingUsdBn.toFixed(2)} bn`
                  : "—"
              }
            />
            <MapKV k={en ? "Institution count" : "机构数量口径"} v={nbfc.nbfcCountDisplay} />
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {nbfc.rows.map((r) => (
                <div
                  key={`${r.category}-${r.as_of}`}
                  style={{
                    background: c.fillSoft,
                    borderRadius: 6,
                    border: `1px solid ${c.panelBorder}`,
                    padding: "8px 10px",
                    fontSize: 12,
                    color: c.textSecondary,
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ fontWeight: 600, color: c.text }}>{r.category}</div>
                  <div>{en ? "Regulator" : "监管"}：{r.regulator || "—"}</div>
                  <div>{en ? "Institutions" : "机构数"}：{r.nbfc_count || "—"}</div>
                  <div>{en ? "Lending" : "放贷"}：{r.loan_book_total || "—"}</div>
                  <div>USD：{r.loan_book_usd || "—"}</div>
                  {r.default_rate ? <div>Default/NPL：{r.default_rate}</div> : null}
                  <div>{en ? "As of" : "时点"}：{r.as_of || "—"}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <MapMuted>{en ? "No NBFC stats" : "暂无 NBFC 统计"}</MapMuted>
        )}
      </MapSection>

      <MapSection title="Google Play · Finance · Free">
        {zoom?.available === false ? (
          <MapMuted>{zoom.note || (en ? "No official Google Play in this market." : "该地区无官方 Google Play。")}</MapMuted>
        ) : (
          <>
            <div style={{ fontSize: 11, color: c.textTertiary, marginBottom: 6 }}>
              {en ? "Snapshot" : "快照"} {zoom?.as_of || "—"} ·{" "}
              <MapExtLink href={chartUrl}>{en ? "Open Play Finance chart" : "打开 Play Finance 榜单"}</MapExtLink>
            </div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: c.text, lineHeight: 1.65 }}>
              {(zoom?.top_free_finance || []).map((app) => (
                <li key={`${app.rank}-${app.name}`}>
                  {app.url ? <MapExtLink href={app.url}>{app.name}</MapExtLink> : app.name}
                  <span style={{ color: c.textTertiary }}> · {app.developer}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </MapSection>
      <MapCountryMacroBrief code={code} />
    </MapDetailShell>
  );
}

export function LendingHeatGlobe({
  height = 420,
  fill = false,
  legendPlacement = "side",
}: {
  height?: number;
  fill?: boolean;
  legendPlacement?: MapLegendPlacement;
}) {
  const { c } = useMapChrome();
  const [uiLang] = useCanvasState<UiLang>("uiLang1", detectBrowserUiLang());
  const en = uiLang === "en";
  const { aspect } = useMapViewport(fill);
  const width = mapFrameWidth(height, aspect);
  const bottomLegend = fill || legendPlacement === "bottom";
  const place: MapLegendPlacement = bottomLegend ? "bottom" : "side";
  const lending = useMemo(() => aggregateLendingUsdBn(), []);
  const values = useMemo(() => Object.values(lending), [lending]);
  const maxBn = useMemo(() => Math.max(...values, 1), [values]);
  const minBn = useMemo(() => Math.min(...values.filter((v) => v > 0), maxBn), [values, maxBn]);

  const countries = useMemo(() => {
    const topo = worldTopology as {
      type: "Topology";
      objects: { countries: object };
      arcs: unknown;
    };
    return feature(topo as never, topo.objects.countries as never) as unknown as FeatureCollection<
      Geometry,
      CountryProps
    >;
  }, []);

  const [focus, setFocus] = useState<string | null>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  function a2Of(f: Feature<Geometry, CountryProps>): string | null {
    const n3 = String(f.id);
    const stripped = normId(n3);
    return N3_TO_A2[n3] ?? N3_TO_A2[stripped] ?? N3_TO_A2[n3.padStart(3, "0")] ?? null;
  }

  const focusFeature = useMemo(() => {
    if (!focus) return null;
    return countries.features.find((f) => a2Of(f) === focus) ?? null;
  }, [focus, countries]);

  const { pathGen, outline } = useMemo(() => {
    const projection = geoNaturalEarth1();
    if (focusFeature) {
      projection.fitExtent(
        [
          [24, 24],
          [width - 24, height - 24],
        ],
        focusFeature,
      );
    } else {
      projection.fitExtent(
        [
          [12, 12],
          [width - 12, height - 12],
        ],
        { type: "Sphere" },
      );
    }
    const pathGen = geoPath(projection);
    return { pathGen, outline: pathGen({ type: "Sphere" }) };
  }, [width, height, focusFeature]);

  const graticulePath = useMemo(() => pathGen(geoGraticule10()), [pathGen]);

  const intensity = (bn: number) => {
    if (!(bn > 0)) return 0;
    const lo = Math.log10(minBn);
    const hi = Math.log10(maxBn);
    if (hi <= lo) return 1;
    return (Math.log10(bn) - lo) / (hi - lo);
  };

  const ranked = useMemo(
    () => Object.entries(lending).sort((a, b) => b[1] - a[1]),
    [lending],
  );

  type DotPoint = {
    a2: string;
    name: string;
    usdBn: number;
    x: number;
    y: number;
    t: number;
    r: number;
    hasInvested: boolean;
  };

  const dots = useMemo(() => {
    const out: DotPoint[] = [];
    for (const f of countries.features) {
      const a2 = a2Of(f);
      if (!a2) continue;
      const bn = lending[a2] ?? 0;
      if (!(bn > 0)) continue;
      const cen = pathGen.centroid(f);
      if (!cen || !Number.isFinite(cen[0]) || !Number.isFinite(cen[1])) continue;
      const t = intensity(bn);
      out.push({
        a2,
        name: countryLabelUi(a2, uiLang, COUNTRY_LABEL_ZH[a2] ?? f.properties?.name ?? a2),
        usdBn: bn,
        x: cen[0],
        y: cen[1],
        t,
        r: 3.4 + t * (fill ? 8 : 6),
        hasInvested: Boolean(INVESTED_BY_CODE[a2]),
      });
    }
    out.sort((a, b) => a.r - b.r);
    return out;
  }, [countries, lending, pathGen, fill, minBn, maxBn, uiLang]);

  const callouts = useMemo(() => {
    if (focus) return [] as DotPoint[];
    const byCode = new Map(dots.map((d) => [d.a2, d]));
    return ranked
      .slice(0, 3)
      .map(([code]) => byCode.get(code))
      .filter(Boolean) as DotPoint[];
  }, [dots, ranked, focus]);

  return (
    <div
      style={
        bottomLegend
          ? fill
            ? {
                display: "flex",
                flexDirection: "column",
                width: "100%",
                height: "100%",
                minHeight: 0,
                gap: 10,
                overflow: "hidden",
              }
            : {
                display: "flex",
                flexDirection: "column",
                width: "100%",
                gap: 12,
              }
          : fill
            ? {
                position: "relative",
                width: "100%",
                height: "100%",
                minHeight: 0,
                overflow: "hidden",
              }
            : {
                display: "flex",
                flexWrap: "wrap",
                gap: 20,
                alignItems: "stretch",
              }
      }
    >
      <div
        style={
          fill
            ? bottomLegend
              ? {
                  position: "relative",
                  flex: "1 1 0",
                  minHeight: 0,
                  width: "100%",
                  overflow: "hidden",
                  borderRadius: 8,
                }
              : { position: "absolute", inset: 0 }
            : {
                position: "relative",
                width: "100%",
                maxWidth: width,
                margin: "0 auto",
                flex: bottomLegend ? undefined : "1 1 560px",
              }
        }
      >
        {focus ? (
          <div
            style={{
              position: "absolute",
              zIndex: 2,
              left: 12,
              top: 12,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <Button variant="secondary" size="sm" onClick={() => setFocus(null)}>
              {en ? "Back to world" : "返回全球"}
            </Button>
            <MapChip>
              {en
                ? `Zoomed: ${countryLabelUi(focus, uiLang, COUNTRY_LABEL_ZH[focus] ?? focus)}`
                : `已放大：${COUNTRY_LABEL_ZH[focus] ?? focus}`}
            </MapChip>
          </div>
        ) : null}

        <MapSvgFrame width={width} height={height} fill={fill}>
          {outline ? <path d={outline} fill={c.ocean} /> : null}
          {graticulePath ? (
            <path d={graticulePath} fill="none" stroke={c.graticule} strokeWidth={0.45} opacity={0.55} />
          ) : null}
          {countries.features.map((f, i) => {
            const a2 = a2Of(f);
            const bn = a2 ? (lending[a2] ?? 0) : 0;
            const d = pathGen(f);
            if (!d) return null;
            const isFocus = focus != null && a2 === focus;
            const dimmed = focus != null && !isFocus;
            return (
              <path
                key={`land-${f.id ?? i}`}
                d={d}
                fill={isFocus ? "#E8E4DC" : c.emptyLand}
                stroke={isFocus ? c.accent : c.landStroke}
                strokeWidth={isFocus ? 1.35 : 0.35}
                opacity={dimmed ? 0.18 : 1}
                style={{ cursor: bn > 0 ? "pointer" : "default" }}
                onClick={() => {
                  if (a2 && bn > 0) {
                    setFocus(a2);
                    setHover(null);
                  }
                }}
              />
            );
          })}
          {dots.map((p) => {
            const isFocus = focus != null && p.a2 === focus;
            const dimmed = focus != null && !isFocus;
            const rr = isFocus ? p.r * 1.25 : p.r;
            return (
              <g
                key={`dot-${p.a2}`}
                opacity={dimmed ? 0.2 : 1}
                style={{ cursor: "pointer" }}
                onClick={() => {
                  setFocus(p.a2);
                  setHover(null);
                }}
                onMouseEnter={(ev) => {
                  const rect = (ev.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setHover({
                    a2: p.a2,
                    name: p.name,
                    usdBn: p.usdBn,
                    x: ev.clientX - rect.left,
                    y: ev.clientY - rect.top,
                  });
                }}
                onMouseMove={(ev) => {
                  const rect = (ev.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setHover({
                    a2: p.a2,
                    name: p.name,
                    usdBn: p.usdBn,
                    x: ev.clientX - rect.left,
                    y: ev.clientY - rect.top,
                  });
                }}
                onMouseLeave={() => setHover(null)}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={rr}
                  fill={heatColorWarm(p.t)}
                  stroke={isFocus ? c.accent : "#FFFAF5"}
                  strokeWidth={isFocus ? 1.6 : 0.9}
                />
                {p.hasInvested ? (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={rr + 2.4}
                    fill="none"
                    stroke={c.accent}
                    strokeWidth={1.1}
                    opacity={0.9}
                  />
                ) : null}
              </g>
            );
          })}
          {!focus
            ? callouts.map((p, i) => {
                const side = p.x > width * 0.55 ? -1 : 1;
                const lx = p.x + side * (28 + i * 6);
                const ly = Math.max(28, Math.min(height - 36, p.y - 22 - i * 10));
                const label = `${countryLabelUi(p.a2, uiLang, COUNTRY_LABEL_ZH[p.a2] ?? p.a2)} USD ${p.usdBn >= 10 ? p.usdBn.toFixed(1) : p.usdBn.toFixed(2)}bn`;
                const tw = Math.min(148, 12 + label.length * 6.4);
                return (
                  <g key={`call-${p.a2}`} pointerEvents="none">
                    <line
                      x1={p.x}
                      y1={p.y}
                      x2={lx}
                      y2={ly}
                      stroke={c.textTertiary}
                      strokeWidth={0.8}
                      strokeDasharray="2 2"
                    />
                    <circle cx={p.x} cy={p.y} r={p.r + 3.5} fill="none" stroke={c.textSecondary} strokeWidth={0.9} />
                    <rect
                      x={side > 0 ? lx : lx - tw}
                      y={ly - 11}
                      width={tw}
                      height={18}
                      rx={3}
                      fill={c.panelBg}
                      stroke={c.panelBorder}
                      strokeWidth={0.8}
                    />
                    <text
                      x={side > 0 ? lx + 5 : lx - 5}
                      y={ly + 2}
                      textAnchor={side > 0 ? "start" : "end"}
                      fill={c.text}
                      fontSize={10}
                      fontFamily="system-ui, sans-serif"
                    >
                      {label}
                    </text>
                  </g>
                );
              })
            : null}
          {outline ? <path d={outline} fill="none" stroke={c.outline} strokeWidth={1} /> : null}
        </MapSvgFrame>

        {hover && !focus ? (
          <MapTooltip
            left={Math.min(hover.x + 12, width - 180)}
            top={Math.max(8, hover.y - 48)}
            accent="removed"
          >
            <div style={{ fontWeight: 600 }}>{hover.name}</div>
            <div style={{ color: c.textSecondary }}>
              {en ? "Lending total ≈" : "放贷总量 ≈"} USD {hover.usdBn.toFixed(2)} bn
            </div>
            <div style={{ color: c.textTertiary, marginTop: 2 }}>
              {en ? "Click to zoom for details" : "点击放大查看详情"}
            </div>
          </MapTooltip>
        ) : null}

        {focus && bottomLegend ? (
          <CountryDetailPanel code={focus} onClose={() => setFocus(null)} overlay />
        ) : null}
      </div>

      {focus && !bottomLegend ? (
        <CountryDetailPanel code={focus} onClose={() => setFocus(null)} />
      ) : null}
      {!focus ? (
        <MapSideLegend title={en ? "Market · dot legend" : "市场 · 点阵图例"} placement={place}>
          <SteppedLegend
            label={
              en
                ? "NBFC / peer lending (USD) · color/size low → high"
                : "非银/等效放贷(USD) · 点色/点径 少 → 多"
            }
            kind="warm"
            compact={bottomLegend}
          />
          <div style={{ fontSize: 12, color: c.textSecondary, marginBottom: 8, marginTop: bottomLegend ? 8 : 0 }}>
            {en
              ? `Light basemap · ${ranked.length} countries · NBFC/peer book (not AUM) · blue ring = invested · click dots/bars to zoom`
              : `浅底透图 · 色点 ${ranked.length} 国 · NBFC/等效放贷存量粗算（非 AUM）· 蓝细环=已有展业对照 · 点击点/横条放大`}
          </div>
          <RankBarList
            compact={false}
            maxVisible={bottomLegend ? 20 : undefined}
            scaleHint={
              en
                ? "Bar ∝ NBFC lending USD bn (vs list max; not AUM)"
                : "条长 ∝ 非银放贷 USD bn（相对列表最大值；非 AUM）"
            }
            onSelect={(code) => setFocus(code)}
            items={ranked.map(([code, bn]) => ({
              key: code,
              label: countryLabelUi(code, uiLang, COUNTRY_LABEL_ZH[code] ?? code),
              value: bn,
              valueLabel: `USD ${bn >= 10 ? bn.toFixed(1) : bn.toFixed(2)} bn`,
            }))}
          />
        </MapSideLegend>
      ) : null}
    </div>
  );
}
