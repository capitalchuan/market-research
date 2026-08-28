import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import worldTopology from "world-atlas/countries-110m.json";
import { COUNTRY_LABEL_ZH } from "./data/nbfcCountryStats";
import {
  buildMacroMetric,
  formatMacroValue,
  MACRO_MAP_FACTORS,
  type MacroMapFactorId,
} from "./data/macroMapMetrics";
import { formatCountryLanguageLine } from "./data/countryLanguage";
import {
  MapChip,
  MapSvgFrame,
  MapTooltip,
  SteppedLegend,
  MapSideLegend,
  MapDetailShell,
  MapCountryMacroBrief,
  MapSection,
  MapKV,
  MapMetricBlock,
  useMapChrome,
  Button,
  useMapViewport,
  mapFrameWidth,
  type MapLegendPlacement,
} from "./HeatMapChrome";
import { MapMacroKV } from "./SourceCite";
import { enrichMacroField } from "./data/macroFieldProvenance";
import { getCountryMacro } from "./data/countryMacro";
import { heatColorWarm, heatColorGreen, heatColorCool } from "./heatMapTheme";
import { summarizeNbfcForCountry } from "./data/countryZoomDetails";
import {
  INVESTED_BY_CODE,
  PRODUCER_HOLDINGS,
} from "./data/producerHoldings";
import { PartnerHoldingsBrief } from "./PartnerHoldingsSection";
import { passesImfWbFilters } from "./data/countryImfWb";
import { useCanvasState } from "./shims/cursor-canvas";

/** 与全市场图对齐的顶栏占位，避免图层切换画幅跳动 */
const MAP_TOP_CHROME = 64;

type CountryProps = { name?: string };

/** 展业徽章钉点（与全市场图一致） */
const INVESTED_BADGE_LL: Record<string, [number, number]> = {
  MX: [-102.5, 23.6],
  TH: [100.5, 15.2],
  ID: [113.5, -2.5],
  PH: [121.8, 12.3],
  HK: [114.17, 22.32],
  IN: [78.9, 22.0],
};

/** ISO 3166-1 numeric → CRM alpha-2（与放贷/已投图对齐） */
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
  "344": "HK",
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
  "276": "DE",
  "250": "FR",
  "528": "NL",
  "724": "ES",
  "620": "PT",
  "380": "IT",
  "752": "SE",
  "616": "PL",
  "372": "IE",
  "036": "AU",
  "36": "AU",
  "554": "NZ",
  "702": "SG",
  "704": "VN",
  "012": "DZ",
  "818": "EG",
  "434": "LY",
  "788": "TN",
  "686": "SN",
  "384": "CI",
  "120": "CM",
  "566": "NG",
  "288": "GH",
  "404": "KE",
  "800": "UG",
  "834": "TZ",
  "231": "ET",
  "710": "ZA",
  "508": "MZ",
  "894": "ZM",
  "716": "ZW",
  "072": "BW",
  "516": "NA",
  "478": "MR",
  "480": "MU",
  "450": "MG",
  "646": "RW",
  "024": "AO",
  "178": "CG",
  "180": "CD",
  "266": "GA",
  "854": "BF",
  "466": "ML",
  "204": "BJ",
  "368": "IQ",
  "364": "IR",
  "760": "SY",
  "887": "YE",
  "400": "JO",
  "422": "LB",
  "275": "PS",
  "376": "IL",
  "414": "KW",
  "512": "OM",
  "048": "BH",
  "634": "QA",
  "398": "KZ",
  "860": "UZ",
  "417": "KG",
  "762": "TJ",
  "795": "TM",
  "496": "MN",
  "643": "RU",
  "804": "UA",
};

function normId(id: string | number | undefined): string {
  if (id == null) return "";
  return String(id).replace(/^0+/, "") || "0";
}

type HoverInfo = {
  a2: string;
  name: string;
  value: number;
  raw: string;
  x: number;
  y: number;
};

function MacroDetailPanel({
  code,
  factorId,
  onClose,
  overlay = false,
}: {
  code: string;
  factorId: MacroMapFactorId;
  onClose: () => void;
  overlay?: boolean;
}) {
  const metric = buildMacroMetric(factorId);
  const name = COUNTRY_LABEL_ZH[code] ?? code;
  const nbfc = summarizeNbfcForCountry(code);
  const invested = INVESTED_BY_CODE[code];
  const v = metric.byCode[code];
  const langLine = formatCountryLanguageLine(code);
  const snap = getCountryMacro(code);
  const fieldMeta = MACRO_MAP_FACTORS.find((f) => f.id === factorId);
  const raw = fieldMeta ? metric.rawByCode[code] : undefined;
  const prov =
    fieldMeta?.field && raw ? enrichMacroField(fieldMeta.field, raw, snap?.asOf) : null;
  const reading =
    prov?.value ||
    (v != null
      ? factorId === "fxVol"
        ? `${formatMacroValue(factorId, v)}（年内高低/均价）`
        : factorId === "fxChg"
          ? `${formatMacroValue(factorId, v)}（近1年本币对美元）`
          : `${formatMacroValue(factorId, v)}${metric.unit ? ` · ${metric.unit}` : ""}`
      : "暂无数值");
  return (
    <MapDetailShell
      title={`${name} · ${code}`}
      subtitle={[langLine, metric.label].filter(Boolean).join(" · ") || undefined}
      onClose={onClose}
      overlay={overlay}
    >
      <MapSection title="当前读数" dense={overlay}>
        <MapMacroKV
          k={metric.label}
          v={reading}
          asOf={prov?.asOf}
          asOfFromSnap={prov?.asOfFromSnap}
          dense={overlay}
        />
      </MapSection>
      <MapCountryMacroBrief code={code} dense={overlay} />
      <PartnerHoldingsBrief invested={invested} dense={overlay} />
      {nbfc && nbfc.lendingUsdBn > 0 ? (
        <MapSection title="市场放贷" dense={overlay}>
          <MapKV
            k="放贷总量(USD)"
            v={`约 USD ${nbfc.lendingUsdBn >= 10 ? nbfc.lendingUsdBn.toFixed(1) : nbfc.lendingUsdBn.toFixed(2)} bn`}
            dense={overlay}
          />
        </MapSection>
      ) : null}
    </MapDetailShell>
  );
}

/**
 * 宏观因子地域分布图：单因子色阶面填（容量向绿色 / 风险向琥珀）。
 * 可读叠展业：深蓝描边 + 数字徽章（已投生产商数）；无点阵。
 * 读数来自国别宏观快照（IMF / 世行 / TE 等）。
 */
export function MacroHeatGlobe({
  height = 420,
  factor = "hhDebt",
  fill = false,
  legendPlacement = "side",
  showInvested = false,
  mapCorner,
  regionZoomCodes = null,
}: {
  height?: number;
  factor?: MacroMapFactorId;
  fill?: boolean;
  legendPlacement?: MapLegendPlacement;
  /** 叠展业已投：深蓝描边 + 数字徽章 */
  showInvested?: boolean;
  /** 叠在地图框右上角（全屏按钮等） */
  mapCorner?: ReactNode;
  /** 大屏区域缩放：ISO2 列表；空/null 为全球 */
  regionZoomCodes?: string[] | null;
}) {
  const { theme, c } = useMapChrome();
  const { aspect, focusRightFrac, focusMapMinFrac, compact } = useMapViewport(fill);
  const width = mapFrameWidth(height, aspect);
  const bottomLegend = fill || legendPlacement === "bottom";
  const place: MapLegendPlacement = bottomLegend ? "bottom" : "side";
  const headerFlow = !fill && bottomLegend;
  const [imfFilter] = useCanvasState<string>("screenImfFilter2", "all");
  const [wbFilter] = useCanvasState<string>("screenWbFilter2", "all");
  const regionSet = useMemo(
    () => (regionZoomCodes?.length ? new Set(regionZoomCodes) : null),
    [regionZoomCodes],
  );
  const metricBase = useMemo(() => buildMacroMetric(factor), [factor]);
  const metric = useMemo(() => {
    const byCode: Record<string, number> = {};
    for (const [code, n] of Object.entries(metricBase.byCode)) {
      if (regionSet && !regionSet.has(code)) continue;
      if (!passesImfWbFilters(code, imfFilter, wbFilter)) continue;
      byCode[code] = n;
    }
    const vals = Object.values(byCode);
    return {
      ...metricBase,
      byCode,
      count: vals.length,
      min: vals.length ? Math.min(...vals) : 0,
      max: vals.length ? Math.max(...vals) : 1,
    };
  }, [metricBase, regionSet, imfFilter, wbFilter]);
  const vals = useMemo(() => Object.values(metric.byCode), [metric]);
  const minV = useMemo(() => (vals.length ? Math.min(...vals) : 0), [vals]);
  const maxV = useMemo(() => (vals.length ? Math.max(...vals) : 1), [vals]);
  const warmRisk = metric.sense === "high_risk";
  const factorMeta = MACRO_MAP_FACTORS.find((f) => f.id === factor);
  const diverging0 = factorMeta?.scale === "diverging0";
  /** 负/正各自归一：负值色阶不被 US/CA 等大额正值压扁 */
  const negSpan = minV < 0 ? Math.abs(minV) : 0;
  const posSpan = maxV > 0 ? maxV : 0;

  const intensity = (v: number) => {
    if (diverging0) {
      if (v < 0 && negSpan > 0) return Math.min(1, Math.max(0, Math.abs(v) / negSpan));
      if (v > 0 && posSpan > 0) return Math.min(1, Math.max(0, v / posSpan));
      return 0;
    }
    if (!(maxV > minV)) return 1;
    return Math.min(1, Math.max(0, (v - minV) / (maxV - minV)));
  };

  const landFill = (v: number) => {
    const t = intensity(v);
    if (diverging0) {
      if (v < 0) {
        return factorMeta?.divergeNegTone === "cool" ? heatColorCool(t) : heatColorGreen(t);
      }
      if (v > 0) return heatColorWarm(t);
      return c.emptyLand;
    }
    return warmRisk ? heatColorWarm(t) : heatColorGreen(t);
  };

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
  const mapTopPad = focus ? 12 : fill || !bottomLegend ? MAP_TOP_CHROME + 4 : 12;
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [yaw, setYaw] = useState(0);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    yaw0: number;
    moved: boolean;
    capturing: boolean;
  } | null>(null);
  const regionKey = regionZoomCodes?.slice().sort().join(",") ?? "";
  useEffect(() => {
    setFocus(null);
    setYaw(0);
    setHover(null);
  }, [regionKey]);

  function a2Of(f: Feature<Geometry, CountryProps>): string | null {
    const n3 = String(f.id);
    const stripped = normId(n3);
    return N3_TO_A2[n3] ?? N3_TO_A2[stripped] ?? N3_TO_A2[n3.padStart(3, "0")] ?? null;
  }

  const focusFeature = useMemo(() => {
    if (!focus) return null;
    return countries.features.find((f) => a2Of(f) === focus) ?? null;
  }, [focus, countries]);

  const regionFeature = useMemo(() => {
    if (!regionZoomCodes?.length) return null;
    const set = new Set(regionZoomCodes);
    const feats = countries.features.filter((f) => {
      const a2 = a2Of(f);
      return a2 != null && set.has(a2);
    });
    return feats.length
      ? ({ type: "FeatureCollection", features: feats } as FeatureCollection<Geometry, CountryProps>)
      : null;
  }, [regionZoomCodes, countries]);

  const { pathGen, outline, graticulePath, projection } = useMemo(() => {
    const proj = geoNaturalEarth1();
    if (focusFeature) {
      const rightPad = bottomLegend || compact ? Math.round(width * focusRightFrac) : 24;
      proj.fitExtent(
        [
          [24, mapTopPad],
          [Math.max(width - rightPad, width * focusMapMinFrac), height - 24],
        ],
        focusFeature,
      );
    } else if (regionFeature) {
      proj.fitExtent(
        [
          [28, mapTopPad + 4],
          [width - 28, height - 28],
        ],
        regionFeature,
      );
    } else {
      proj.rotate([yaw, 0, 0]);
      proj.fitExtent(
        [
          [12, mapTopPad],
          [width - 12, height - 12],
        ],
        { type: "Sphere" },
      );
    }
    const path = geoPath(proj);
    return {
      pathGen: path,
      outline: path({ type: "Sphere" }) ?? "",
      graticulePath: path(geoGraticule10()) ?? "",
      projection: proj,
    };
  }, [focusFeature, regionFeature, width, height, yaw, bottomLegend, compact, focusRightFrac, focusMapMinFrac, mapTopPad]);

  const investedBadges = useMemo(() => {
    if (!showInvested) return [] as { a2: string; x: number; y: number; n: number }[];
    const out: { a2: string; x: number; y: number; n: number }[] = [];
    for (const country of PRODUCER_HOLDINGS.countries) {
      const a2 = country.country_code;
      if (regionSet && !regionSet.has(a2)) continue;
      const n = country.producers.length;
      if (n <= 0) continue;
      const ll = INVESTED_BADGE_LL[a2];
      if (!ll) continue;
      const p = projection(ll);
      if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
      if (p[0] < -20 || p[0] > width + 20 || p[1] < -20 || p[1] > height + 20) continue;
      out.push({ a2, x: p[0], y: p[1], n });
    }
    return out;
  }, [showInvested, projection, width, height, regionSet]);

  const mapMetricsInner = !focus ? (
    <div style={{ minWidth: 0 }}>
      <MapMetricBlock
        label={metric.label}
        value={`${formatMacroValue(factor, metric.min)} – ${formatMacroValue(factor, metric.max)}`}
      />
      <div
        style={{
          fontSize: 10,
          color: c.textTertiary,
          marginTop: 3,
          letterSpacing: "0.02em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {metric.unit} · 有读数 {metric.count} 国
        {showInvested ? " · 展业锚点开" : ""}
      </div>
    </div>
  ) : null;

  return (
    <div
      style={
        fill
          ? {
              position: "relative",
              width: "100%",
              height: "100%",
              minHeight: 0,
              overflow: "hidden",
            }
          : bottomLegend
            ? { display: "flex", flexDirection: "column", width: "100%", gap: headerFlow ? 8 : 12, flexShrink: 0 }
            : { display: "flex", flexWrap: "wrap", gap: 20, alignItems: "stretch" }
      }
    >
      {headerFlow && mapMetricsInner ? (
        <div
          data-no-drag
          style={{
            position: "relative",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "4px 0 8px",
            boxSizing: "border-box",
          }}
        >
          {mapMetricsInner}
          {mapCorner ? (
            <div style={{ flexShrink: 0, display: "flex", gap: 2, alignItems: "center" }}>{mapCorner}</div>
          ) : null}
        </div>
      ) : null}
      <div
        style={
          fill
            ? {
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                borderRadius: 0,
                border: "none",
                cursor: focus ? "default" : "grab",
                touchAction: "none",
                background: c.mapBg,
              }
            : {
                position: "relative",
                width: "100%",
                flex: bottomLegend ? "0 0 auto" : "1 1 560px",
                flexShrink: 0,
                cursor: focus ? "default" : "grab",
                touchAction: "pan-y",
                border: "none",
                borderRadius: 0,
                overflow: "visible",
                background: "transparent",
              }
        }
        onPointerDown={(e) => {
          if (focus) return;
          if ((e.target as Element).closest?.("button,a,[data-no-drag]")) return;
          dragRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            yaw0: yaw,
            moved: false,
            capturing: false,
          };
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d || d.pointerId !== e.pointerId) return;
          const dx = e.clientX - d.startX;
          if (!d.moved && Math.abs(dx) < 8) return;
          d.moved = true;
          if (!d.capturing) {
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
            d.capturing = true;
            e.currentTarget.style.cursor = "grabbing";
          }
          setYaw(d.yaw0 + dx * 0.32);
          setHover(null);
        }}
        onPointerUp={(e) => {
          const d = dragRef.current;
          if (!d || d.pointerId !== e.pointerId) return;
          const wasMoved = d.moved;
          if (d.capturing) {
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
          }
          dragRef.current = null;
          e.currentTarget.style.cursor = focus ? "default" : "grab";
          if (wasMoved) return;
          const hit =
            typeof document !== "undefined"
              ? document.elementFromPoint(e.clientX, e.clientY)
              : null;
          const el = ((hit ?? e.target) as Element | null)?.closest?.("[data-a2]");
          const a2 = el?.getAttribute("data-a2");
          if (a2 && (metric.byCode[a2] != null || (showInvested && INVESTED_BY_CODE[a2]))) {
            setFocus(a2);
            setHover(null);
          }
        }}
        onPointerCancel={(e) => {
          const d = dragRef.current;
          if (d?.capturing) {
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
          }
          dragRef.current = null;
          e.currentTarget.style.cursor = focus ? "default" : "grab";
        }}
      >
        {!headerFlow && mapMetricsInner ? (
          <div
            data-no-drag
            style={{
              position: "absolute",
              zIndex: 3,
              left: 0,
              right: 0,
              top: 0,
              height: MAP_TOP_CHROME,
              display: "flex",
              alignItems: "center",
              padding: "8px 44px 8px 14px",
              boxSizing: "border-box",
              background: "transparent",
              pointerEvents: "none",
            }}
          >
            {mapMetricsInner}
          </div>
        ) : null}

        {mapCorner && (!headerFlow || focus) ? (
          <div
            data-no-drag
            style={{
              position: "absolute",
              zIndex: 8,
              top: focus ? 8 : Math.round((MAP_TOP_CHROME - 32) / 2),
              right: 8,
              display: "flex",
              gap: 2,
              alignItems: "center",
            }}
          >
            {mapCorner}
          </div>
        ) : null}

        {focus ? (
          <div
            data-no-drag
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
            {bottomLegend ? null : (
              <Button variant="secondary" size="sm" onClick={() => setFocus(null)}>
                返回全球
              </Button>
            )}
            {!bottomLegend ? <MapChip>已放大：{COUNTRY_LABEL_ZH[focus] ?? focus}</MapChip> : null}
          </div>
        ) : null}

        <MapSvgFrame width={width} height={height} fill={fill}>
          {outline ? <path d={outline} fill={c.ocean} /> : null}
          {graticulePath ? (
            <path d={graticulePath} fill="none" stroke={c.graticule} strokeWidth={0.6} />
          ) : null}
          {countries.features.map((f, i) => {
            const a2 = a2Of(f);
            const v = a2 != null ? metric.byCode[a2] : undefined;
            const d = pathGen(f);
            if (!d) return null;
            const isFocus = focus != null && a2 === focus;
            const dimmed = focus != null && !isFocus;
            const has = v != null;
            const invested = a2 ? INVESTED_BY_CODE[a2] : undefined;
            const showStroke = Boolean(showInvested && invested);
            const fillColor = has ? landFill(v) : c.emptyLand;
            return (
              <path
                key={`${f.id ?? i}`}
                data-a2={a2 ?? undefined}
                d={d}
                fill={fillColor}
                stroke={showStroke ? "#1e3a5f" : isFocus ? c.accent : c.landStroke}
                strokeWidth={showStroke ? 1.6 : isFocus ? 1.4 : has ? 0.55 : 0.35}
                opacity={dimmed ? 0.22 : 1}
                style={{ cursor: has || (showInvested && invested) ? "pointer" : focus ? "default" : "inherit" }}
                onMouseEnter={(ev) => {
                  if (dragRef.current?.moved || dragRef.current?.capturing) return;
                  if (!a2 || (v == null && !(showInvested && invested))) {
                    setHover(null);
                    return;
                  }
                  const rect = (ev.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setHover({
                    a2,
                    name: COUNTRY_LABEL_ZH[a2] ?? f.properties?.name ?? a2,
                    value: v ?? 0,
                    raw: metric.rawByCode[a2] ?? "",
                    x: ev.clientX - rect.left,
                    y: ev.clientY - rect.top,
                  });
                }}
                onMouseMove={(ev) => {
                  if (dragRef.current?.moved || dragRef.current?.capturing) return;
                  if (!a2 || (v == null && !(showInvested && invested))) return;
                  const rect = (ev.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setHover({
                    a2,
                    name: COUNTRY_LABEL_ZH[a2] ?? f.properties?.name ?? a2,
                    value: v ?? 0,
                    raw: metric.rawByCode[a2] ?? "",
                    x: ev.clientX - rect.left,
                    y: ev.clientY - rect.top,
                  });
                }}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
          {showInvested && INVESTED_BY_CODE.HK
            ? (() => {
                const p = projection([114.17, 22.32]);
                if (!p) return null;
                return (
                  <g data-a2="HK" style={{ cursor: "pointer" }}>
                    <circle
                      cx={p[0]}
                      cy={p[1]}
                      r={5}
                      fill={c.emptyLand}
                      stroke="#1e3a5f"
                      strokeWidth={1.5}
                    />
                  </g>
                );
              })()
            : null}
          {investedBadges.map((b) => (
            <g key={`badge-${b.a2}`} data-a2={b.a2} data-invested-badge={b.a2} style={{ cursor: "pointer" }}>
              <circle cx={b.x} cy={b.y} r={9} fill="#1e4a7a" stroke="#fff" strokeWidth={1.2} />
              <text
                x={b.x}
                y={b.y + 3.5}
                textAnchor="middle"
                fill="#fff"
                fontSize={10}
                fontWeight={700}
                fontFamily="system-ui, sans-serif"
                style={{ pointerEvents: "none" }}
              >
                {b.n}
              </text>
            </g>
          ))}
          {outline ? <path d={outline} fill="none" stroke={c.outline} strokeWidth={1} /> : null}
        </MapSvgFrame>

        {hover && !focus ? (
          <MapTooltip
            left={Math.min(hover.x + 12, width - 200)}
            top={Math.max(8, hover.y - 56)}
            accent={
              diverging0
                ? hover.value < 0
                  ? "added"
                  : hover.value > 0
                    ? "removed"
                    : "neutral"
                : warmRisk
                  ? "removed"
                  : "added"
            }
          >
            <div style={{ fontWeight: 600 }}>{hover.name}</div>
            {hover.raw || metric.byCode[hover.a2] != null ? (
              <div style={{ color: c.textSecondary }}>
                {metric.label} · {formatMacroValue(factor, hover.value)}
              </div>
            ) : null}
            {showInvested && INVESTED_BY_CODE[hover.a2] ? (
              <div style={{ color: c.accent }}>
                展业平台 {INVESTED_BY_CODE[hover.a2].producers.length} 家
              </div>
            ) : null}
          </MapTooltip>
        ) : null}

        {focus && bottomLegend ? (
          <MacroDetailPanel
            code={focus}
            factorId={factor}
            onClose={() => setFocus(null)}
            overlay
          />
        ) : null}
      </div>

      {focus && !bottomLegend ? (
        <MacroDetailPanel code={focus} factorId={factor} onClose={() => setFocus(null)} />
      ) : null}
      {!focus ? (
        <MapSideLegend title={fill ? undefined : metric.label} placement={place} overlay={fill}>
          {diverging0 ? (
            <>
              <SteppedLegend
                label={factorMeta?.divergeLegend?.neg ?? "负"}
                kind={factorMeta?.divergeNegTone === "cool" ? "cool" : "green"}
                compact={bottomLegend}
                low="0"
                high={formatMacroValue(factor, minV < 0 ? minV : 0)}
              />
              <SteppedLegend
                label={factorMeta?.divergeLegend?.pos ?? "正"}
                kind="warm"
                compact={bottomLegend}
                low="0"
                high={formatMacroValue(factor, maxV > 0 ? maxV : 0)}
              />
            </>
          ) : (
            <SteppedLegend
              label={metric.label}
              kind={warmRisk ? "warm" : "green"}
              compact={bottomLegend}
              low={formatMacroValue(factor, metric.min)}
              high={formatMacroValue(factor, metric.max)}
            />
          )}
        </MapSideLegend>
      ) : null}
    </div>
  );
}
