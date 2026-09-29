import { useMemo, useRef, useState } from "react";
import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import worldTopology from "world-atlas/countries-110m.json";
import { COUNTRY_LABEL_ZH } from "./data/nbfcCountryStats";
import { aggregateLendingUsdBn } from "./LendingHeatGlobe";
import {
  COUNTRY_ZOOM_BY_CODE,
  playFinanceChartUrl,
  summarizeNbfcForCountry,
} from "./data/countryZoomDetails";
import {
  INVESTED_BY_CODE,
  PRODUCER_HOLDINGS,
  TOTAL_OUTSTANDING_HEAT_USD,
  formatUsdCompact,
} from "./data/producerHoldings";
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
  heatColorAdded,
  MapCountryMacroBrief,
  RankBarList,
  type MapLegendPlacement,
  useMapViewport,
  mapFrameWidth,
} from "./HeatMapChrome";
import { heatColorWarm } from "./heatMapTheme";
import { formatCountryLanguageLine } from "./data/countryLanguage";
import { PartnerHoldingsSection, useGuestMask } from "./PartnerHoldingsSection";
import { SENSITIVE_MASK } from "./authAccess";
import { useCanvasState } from "./shims/cursor-canvas";
import { countryLabelUi, detectBrowserUiLang, type UiLang } from "./uiI18n";

type CountryProps = { name?: string };

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
  "324": "GN",
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
  "643": "RU",
  "702": "SG",
};

function normId(id: string | number | undefined): string {
  if (id == null) return "";
  return String(id).replace(/^0+/, "") || "0";
}

/** 110m 底图无独立香港面：用小框作焦点拟合 + 地图锚点 */
const HK_FOCUS_FEATURE: Feature<Geometry, CountryProps> = {
  type: "Feature",
  properties: { name: "Hong Kong" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [113.82, 22.15],
        [114.45, 22.15],
        [114.45, 22.58],
        [113.82, 22.58],
        [113.82, 22.15],
      ],
    ],
  },
};
const HK_LONLAT: [number, number] = [114.17, 22.32];

type HoverInfo = {
  a2: string;
  name: string;
  lendingBn: number;
  invested: boolean;
  outstandingUsd: number;
  investmentUsd: number;
  /** 生态机构样本数（其他机构图层） */
  ecoCount: number;
  x: number;
  y: number;
};

function DetailPanel({
  code,
  onClose,
  overlay = false,
}: {
  code: string;
  onClose: () => void;
  overlay?: boolean;
}) {
  const [uiLang] = useCanvasState<UiLang>("uiLang1", detectBrowserUiLang());
  const en = uiLang === "en";
  const invested = INVESTED_BY_CODE[code];
  const zoom = COUNTRY_ZOOM_BY_CODE[code];
  const nbfc = summarizeNbfcForCountry(code);
  const name = countryLabelUi(code, uiLang, COUNTRY_LABEL_ZH[code] ?? invested?.country_zh ?? code);
  const chartUrl = zoom?.source_url || playFinanceChartUrl(code);
  const langLine = formatCountryLanguageLine(code, uiLang);
  const baseSub = invested
    ? en
      ? "Invested · fill = market lending / dots = invested outstanding"
      : "已投国家 · 面填=市场放贷 / 圆点大小=已投在贷"
    : en
      ? "Market lending detail"
      : "市场放贷详情";

  return (
    <MapDetailShell
      title={`${name} · ${code}`}
      subtitle={langLine ? `${langLine} · ${baseSub}` : baseSub}
      onClose={onClose}
      overlay={overlay}
    >
      <PartnerHoldingsSection invested={invested} dense={overlay} />

      <MapSection title={en ? "Market lending" : "市场放贷"}>
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
          </>
        ) : (
          <MapMuted>{en ? "No NBFC lending total" : "暂无 NBFC 放贷总量"}</MapMuted>
        )}
      </MapSection>

      {zoom ? (
        <MapSection title={en ? "Population / Play Finance" : "人口 / Play Finance"}>
          <MapKV
            k={en ? "Population (approx.)" : "人口（约）"}
            v={
              en
                ? `${zoom.population_millions.toLocaleString()} m`
                : `${zoom.population_millions.toLocaleString()} 百万`
            }
          />
          {zoom.available !== false ? (
            <div style={{ fontSize: 12, marginTop: 4 }}>
              <MapExtLink href={chartUrl}>{en ? "Play Finance free chart" : "Play Finance 免费榜"}</MapExtLink>
            </div>
          ) : null}
        </MapSection>
      ) : null}
      <MapCountryMacroBrief code={code} />
    </MapDetailShell>
  );
}

/** 叠加热力：浅底透图 + 点阵（市场琥珀 / 展业蓝 / 生态蓝） */
export function CombinedHeatGlobe({
  height = 420,
  fill = false,
  legendPlacement = "side",
  showMarket = true,
  showInvested = true,
  showEco = false,
  ecoCounts,
  ecoLabel,
}: {
  height?: number;
  /** 投屏全屏：地图铺满容器 */
  fill?: boolean;
  legendPlacement?: MapLegendPlacement;
  /** 市场放贷面填 */
  showMarket?: boolean;
  /** 展业圆点 / 展业面填（仅展业时） */
  showInvested?: boolean;
  /** 生态其他机构：按国别样本数打点/面填 */
  showEco?: boolean;
  ecoCounts?: Record<string, number>;
  ecoLabel?: string;
}) {
  const { theme, c } = useMapChrome();
  const { aspect, focusRightFrac, focusMapMinFrac } = useMapViewport(fill);
  const width = mapFrameWidth(height, aspect);
  const bottomLegend = fill || legendPlacement === "bottom";
  const place: MapLegendPlacement = bottomLegend ? "bottom" : "side";
  const { guest, maskUsd } = useGuestMask();
  const [uiLang] = useCanvasState<UiLang>("uiLang1", detectBrowserUiLang());
  const en = uiLang === "en";
  const marketOn = showMarket;
  const investedOn = showInvested && !showEco;
  const ecoOn = Boolean(showEco && ecoCounts);
  const bothOn = marketOn && investedOn;
  const marketEcoOn = marketOn && ecoOn;
  const investedOnly = investedOn && !marketOn;
  const ecoOnly = ecoOn && !marketOn;
  const lending = useMemo(() => aggregateLendingUsdBn(), []);
  const lendVals = useMemo(() => Object.values(lending), [lending]);
  const maxBn = useMemo(() => Math.max(...lendVals, 1), [lendVals]);
  const minBn = useMemo(
    () => Math.min(...lendVals.filter((v) => v > 0), maxBn),
    [lendVals, maxBn],
  );

  const investedOutstanding = useMemo(() => {
    const out: Record<string, number> = {};
    for (const country of PRODUCER_HOLDINGS.countries) {
      if (country.outstanding_usd_for_heat > 0) out[country.country_code] = country.outstanding_usd_for_heat;
    }
    return out;
  }, []);
  const invVals = useMemo(() => Object.values(investedOutstanding), [investedOutstanding]);
  const maxInv = useMemo(() => Math.max(...invVals, 1), [invVals]);
  const minInv = useMemo(
    () => Math.min(...invVals.filter((v) => v > 0), maxInv),
    [invVals, maxInv],
  );

  const ecoMap = ecoCounts ?? {};
  const ecoVals = useMemo(() => Object.values(ecoMap).filter((v) => v > 0), [ecoMap]);
  const maxEco = useMemo(() => Math.max(...ecoVals, 1), [ecoVals]);
  const minEco = useMemo(
    () => Math.min(...ecoVals.filter((v) => v > 0), maxEco),
    [ecoVals, maxEco],
  );
  const ecoRanked = useMemo(
    () =>
      Object.entries(ecoMap)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1]),
    [ecoMap],
  );

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
  /** 横向旋转角（经度，度）；拖动地图左右转动 */
  const [yaw, setYaw] = useState(0);
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    yaw0: number;
    moved: boolean;
    capturing: boolean;
  } | null>(null);

  function a2Of(f: Feature<Geometry, CountryProps>): string | null {
    const n3 = String(f.id);
    const stripped = normId(n3);
    return N3_TO_A2[n3] ?? N3_TO_A2[stripped] ?? N3_TO_A2[n3.padStart(3, "0")] ?? null;
  }

  const focusFeature = useMemo(() => {
    if (!focus) return null;
    const found = countries.features.find((f) => a2Of(f) === focus) ?? null;
    if (found) return found;
    if (focus === "HK") return HK_FOCUS_FEATURE;
    return null;
  }, [focus, countries]);

  const { pathGen, outline, projection } = useMemo(() => {
    const proj = geoNaturalEarth1();
    if (focusFeature) {
      // 焦点态：左侧放大国土，右侧留给详情浮层；上下留出顶栏
      const rightPad = bottomLegend ? Math.round(width * focusRightFrac) : 28;
      proj.fitExtent(
        [
          [28, 64],
          [Math.max(width - rightPad, width * focusMapMinFrac), height - 36],
        ],
        focusFeature,
      );
    } else {
      proj.rotate([yaw, 0, 0]);
      proj.fitExtent(
        [
          [12, 12],
          [width - 12, height - 12],
        ],
        { type: "Sphere" },
      );
    }
    const pathGen = geoPath(proj);
    return { pathGen, outline: pathGen({ type: "Sphere" }), projection: proj };
  }, [width, height, focusFeature, yaw, bottomLegend, focusRightFrac, focusMapMinFrac]);

  const graticulePath = useMemo(() => pathGen(geoGraticule10()), [pathGen]);

  function pointerToLocal(clientX: number, clientY: number): { x: number; y: number } {
    const rect = mapWrapRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function tryFocusFromTarget(target: EventTarget | null) {
    const el = (target as Element | null)?.closest?.("[data-a2]");
    const a2 = el?.getAttribute("data-a2");
    if (a2 && interactive(a2)) {
      setFocus(a2);
      setHover(null);
    }
  }

  const lendIntensity = (bn: number) => {
    if (!(bn > 0)) return 0;
    const lo = Math.log10(minBn);
    const hi = Math.log10(maxBn);
    if (hi <= lo) return 1;
    return (Math.log10(bn) - lo) / (hi - lo);
  };

  const invIntensity = (usd: number) => {
    if (!(usd > 0)) return 0;
    const lo = Math.log10(minInv);
    const hi = Math.log10(maxInv);
    if (hi <= lo) return 1;
    return (Math.log10(usd) - lo) / (hi - lo);
  };

  const ecoIntensity = (n: number) => {
    if (!(n > 0)) return 0;
    if (maxEco <= 1) return 1;
    const lo = Math.log10(Math.max(minEco, 1));
    const hi = Math.log10(maxEco);
    if (hi <= lo) return 1;
    return (Math.log10(n) - lo) / (hi - lo);
  };

  const investedRanked = useMemo(
    () =>
      [...PRODUCER_HOLDINGS.countries].sort(
        (a, b) => b.outstanding_usd_for_heat - a.outstanding_usd_for_heat,
      ),
    [],
  );

  const mapCodes = useMemo(() => {
    const set = new Set<string>();
    for (const f of countries.features) {
      const a2 = a2Of(f);
      if (a2) set.add(a2);
    }
    return set;
  }, [countries]);

  const marketMarkers = useMemo(() => {
    if (!marketOn) return [] as { a2: string; x: number; y: number; r: number; fill: string; bn: number }[];
    const items: { a2: string; x: number; y: number; r: number; fill: string; bn: number }[] = [];
    for (const f of countries.features) {
      const a2 = a2Of(f);
      if (!a2) continue;
      const bn = lending[a2] ?? 0;
      if (!(bn > 0)) continue;
      const t = lendIntensity(bn);
      const centroid = pathGen.centroid(f);
      if (!centroid || !Number.isFinite(centroid[0]) || !Number.isFinite(centroid[1])) continue;
      const r = (bothOn ? 2.8 : 3.4) + t * (fill ? 7.5 : 5.8);
      items.push({ a2, x: centroid[0], y: centroid[1], r, fill: heatColorWarm(t), bn });
    }
    items.sort((a, b) => a.r - b.r);
    return items;
  }, [marketOn, bothOn, countries, lending, pathGen, minBn, maxBn, fill]);

  const markers = useMemo(() => {
    if (!investedOn) return [] as { a2: string; x: number; y: number; r: number; fill: string; usd: number }[];
    const items: { a2: string; x: number; y: number; r: number; fill: string; usd: number }[] = [];
    for (const f of countries.features) {
      const a2 = a2Of(f);
      if (!a2 || !INVESTED_BY_CODE[a2]) continue;
      const usd = investedOutstanding[a2] ?? 0;
      const t = invIntensity(Math.max(usd, 1e-6));
      const centroid = pathGen.centroid(f);
      if (!centroid || !Number.isFinite(centroid[0]) || !Number.isFinite(centroid[1])) continue;
      const r = (bothOn ? 2.6 : 3.6) + t * (fill ? 8 : 6.2);
      items.push({
        a2,
        x: centroid[0],
        y: centroid[1],
        r,
        fill: heatColorAdded(t, theme),
        usd,
      });
    }
    items.sort((a, b) => a.r - b.r);
    return items;
  }, [investedOn, bothOn, countries, investedOutstanding, pathGen, minInv, maxInv, theme, fill]);

  const ecoMarkers = useMemo(() => {
    if (!ecoOn) return [] as { a2: string; x: number; y: number; r: number; fill: string; n: number }[];
    const items: { a2: string; x: number; y: number; r: number; fill: string; n: number }[] = [];
    for (const f of countries.features) {
      const a2 = a2Of(f);
      if (!a2) continue;
      const n = ecoMap[a2] ?? 0;
      if (!(n > 0)) continue;
      const t = ecoIntensity(n);
      const centroid = pathGen.centroid(f);
      if (!centroid || !Number.isFinite(centroid[0]) || !Number.isFinite(centroid[1])) continue;
      const r = (marketEcoOn ? 2.8 : 3.4) + t * (fill ? 7.5 : 5.8);
      items.push({
        a2,
        x: centroid[0],
        y: centroid[1],
        r,
        fill: heatColorAdded(t, theme),
        n,
      });
    }
    items.sort((a, b) => a.r - b.r);
    return items;
  }, [ecoOn, marketEcoOn, countries, ecoMap, pathGen, minEco, maxEco, theme, fill]);

  const interactive = (a2: string | null) => {
    if (!a2) return false;
    const hasMkt = marketOn && (lending[a2] ?? 0) > 0;
    const hasInv = investedOn && Boolean(INVESTED_BY_CODE[a2]);
    const hasEco = ecoOn && (ecoMap[a2] ?? 0) > 0;
    return hasMkt || hasInv || hasEco;
  };

  const hoverPayload = (a2: string, name: string, x: number, y: number): HoverInfo => {
    const inv = INVESTED_BY_CODE[a2];
    return {
      a2,
      name,
      lendingBn: lending[a2] ?? 0,
      invested: Boolean(inv),
      outstandingUsd: inv?.outstanding_usd_for_heat ?? 0,
      investmentUsd: inv?.investment_usd ?? 0,
      ecoCount: ecoMap[a2] ?? 0,
      x,
      y,
    };
  };

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
        ref={mapWrapRef}
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
                  cursor: focus ? "default" : dragRef.current?.capturing ? "grabbing" : "grab",
                  touchAction: "none",
                }
              : {
                  position: "absolute",
                  inset: 0,
                  cursor: focus ? "default" : dragRef.current?.capturing ? "grabbing" : "grab",
                  touchAction: "none",
                }
            : {
                position: "relative",
                width: "100%",
                maxWidth: width,
                margin: "0 auto",
                flex: bottomLegend ? undefined : "1 1 560px",
                cursor: focus ? "default" : "grab",
                touchAction: "none",
              }
        }
        onPointerDown={(e) => {
          if (focus) return;
          if ((e.target as Element).closest?.("button,a,[data-no-drag]")) return;
          // 延迟 capture：先允许国家 path 收到点击，移动超过阈值才进入拖拽旋转
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
          // elementFromPoint 比 event.target 更稳（全屏 letterbox / 捕获边界）
          const hit =
            typeof document !== "undefined"
              ? document.elementFromPoint(e.clientX, e.clientY)
              : null;
          tryFocusFromTarget(hit ?? e.target);
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
        {focus ? (
          <div
            data-no-drag
            style={{
              position: "absolute",
              zIndex: 5,
              left: 12,
              /* 全屏时顶栏有「市场/展业」图层按钮，焦点条下移避免叠字 */
              top: fill ? 52 : 12,
              display: "flex",
              gap: 8,
              alignItems: "center",
              maxWidth: "48%",
            }}
          >
            {/* Detail shell already has Back to world; chip only to avoid double CTA */}
            <MapChip>
              {en
                ? `Zoomed: ${countryLabelUi(focus, uiLang, COUNTRY_LABEL_ZH[focus] ?? INVESTED_BY_CODE[focus]?.country_zh ?? focus)}`
                : `已放大：${COUNTRY_LABEL_ZH[focus] ?? INVESTED_BY_CODE[focus]?.country_zh ?? focus}`}
            </MapChip>
            {!bottomLegend ? (
              <Button variant="secondary" size="sm" onClick={() => setFocus(null)}>
                {en ? "Back to world" : "返回全球"}
              </Button>
            ) : null}
          </div>
        ) : null}

        <MapSvgFrame width={width} height={height} fill={fill}>
          {outline ? <path d={outline} fill={c.ocean} /> : null}
          {graticulePath ? (
            <path d={graticulePath} fill="none" stroke={c.graticule} strokeWidth={0.6} />
          ) : null}

          {/* 浅色底图：不再 choropleth 面填 */}
          {countries.features.map((f, i) => {
            const a2 = a2Of(f);
            const d = pathGen(f);
            if (!d) return null;
            const isFocus = focus != null && a2 === focus;
            const dimmed = focus != null && !isFocus;
            return (
              <path
                key={`base-${f.id ?? i}`}
                d={d}
                data-a2={a2 ?? undefined}
                fill={isFocus ? (investedOn || ecoOn ? "#E4EAF0" : "#E8E4DC") : c.emptyLand}
                stroke={isFocus ? c.accent : c.landStroke}
                strokeWidth={isFocus ? 1.25 : 0.35}
                opacity={dimmed ? 0.18 : 1}
                style={{ cursor: interactive(a2) ? "pointer" : "inherit" }}
                onMouseEnter={(ev) => {
                  if (dragRef.current?.moved || dragRef.current?.capturing) return;
                  if (!a2 || !interactive(a2)) {
                    setHover(null);
                    return;
                  }
                  const inv = INVESTED_BY_CODE[a2];
                  const loc = pointerToLocal(ev.clientX, ev.clientY);
                  setHover(
                    hoverPayload(
                      a2,
                      countryLabelUi(a2, uiLang, COUNTRY_LABEL_ZH[a2] ?? inv?.country_zh ?? f.properties?.name ?? a2),
                      loc.x,
                      loc.y,
                    ),
                  );
                }}
                onMouseMove={(ev) => {
                  if (dragRef.current?.moved || dragRef.current?.capturing) return;
                  if (!a2 || !interactive(a2)) return;
                  const inv = INVESTED_BY_CODE[a2];
                  const loc = pointerToLocal(ev.clientX, ev.clientY);
                  setHover(
                    hoverPayload(
                      a2,
                      countryLabelUi(a2, uiLang, COUNTRY_LABEL_ZH[a2] ?? inv?.country_zh ?? f.properties?.name ?? a2),
                      loc.x,
                      loc.y,
                    ),
                  );
                }}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}

          {/* 市场点阵 */}
          {!focus && marketOn
            ? marketMarkers.map((m) => {
                const dimmed = focus != null && m.a2 !== focus;
                return (
                  <g key={`mkt-${m.a2}`} style={{ pointerEvents: "none" }} opacity={dimmed ? 0.2 : 0.95}>
                    <circle
                      cx={m.x}
                      cy={m.y}
                      r={m.r}
                      fill={m.fill}
                      stroke="#FFFAF5"
                      strokeWidth={0.9}
                    />
                  </g>
                );
              })
            : null}

          {/* 展业点阵（单独或叠在市场上） */}
          {!focus && investedOn
            ? markers.map((m) => {
                const dimmed = focus != null && m.a2 !== focus;
                return (
                  <g key={`inv-${m.a2}`} style={{ pointerEvents: "none" }} opacity={dimmed ? 0.2 : 0.95}>
                    <circle
                      cx={m.x}
                      cy={m.y}
                      r={m.r}
                      fill={m.fill}
                      stroke="#F5FAFF"
                      strokeWidth={bothOn ? 1.2 : 0.9}
                    />
                    {bothOn && (lending[m.a2] ?? 0) > 0 ? (
                      <circle
                        cx={m.x}
                        cy={m.y}
                        r={m.r + 2.2}
                        fill="none"
                        stroke={c.ink}
                        strokeWidth={1}
                        opacity={0.55}
                      />
                    ) : null}
                  </g>
                );
              })
            : null}

          {/* 生态机构点阵 */}
          {!focus && ecoOn
            ? ecoMarkers.map((m) => {
                const dimmed = focus != null && m.a2 !== focus;
                return (
                  <g key={`eco-m-${m.a2}`} style={{ pointerEvents: "none" }} opacity={dimmed ? 0.2 : 0.95}>
                    <circle
                      cx={m.x}
                      cy={m.y}
                      r={m.r}
                      fill={m.fill}
                      stroke="#F5FAFF"
                      strokeWidth={marketEcoOn ? 1.2 : 0.9}
                    />
                  </g>
                );
              })
            : null}

          {/* 中国香港：110m 无面，锚点可点 */}
          {(() => {
            if (!interactive("HK") || mapCodes.has("HK")) return null;
            const pt = projection(HK_LONLAT);
            if (!pt || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) return null;
            const isFocus = focus === "HK";
            const dimmed = focus != null && !isFocus;
            if (dimmed) return null;
            const usd = investedOutstanding.HK ?? 0;
            const ecoN = ecoMap.HK ?? 0;
            const mktBn = lending.HK ?? 0;
            const r =
              ecoOn && ecoN > 0
                ? (marketEcoOn ? 2.8 : 3.4) + ecoIntensity(ecoN) * (fill ? 7.5 : 5.8)
                : investedOn
                  ? (bothOn ? 2.6 : 3.6) + invIntensity(Math.max(usd, 1e-6)) * (fill ? 8 : 6.2)
                  : marketOn && mktBn > 0
                    ? (bothOn ? 2.8 : 3.4) + lendIntensity(mktBn) * (fill ? 7.5 : 5.8)
                    : 7;
            const dotFill =
              ecoOn && ecoN > 0
                ? heatColorAdded(ecoIntensity(ecoN), theme)
                : investedOn
                  ? heatColorAdded(invIntensity(Math.max(usd, 1e-6)), theme)
                  : heatColorWarm(lendIntensity(Math.max(mktBn, 1e-6)));
            return (
              <g
                data-a2="HK"
                style={{ cursor: "pointer" }}
                onMouseEnter={(ev) => {
                  if (dragRef.current?.moved || dragRef.current?.capturing) return;
                  const inv = INVESTED_BY_CODE.HK;
                  const loc = pointerToLocal(ev.clientX, ev.clientY);
                  setHover(
                    hoverPayload(
                      "HK",
                      countryLabelUi("HK", uiLang, COUNTRY_LABEL_ZH.HK ?? inv?.country_zh ?? "中国香港"),
                      loc.x,
                      loc.y,
                    ),
                  );
                }}
                onMouseLeave={() => setHover(null)}
              >
                <circle
                  cx={pt[0]}
                  cy={pt[1]}
                  r={r + 6}
                  fill="transparent"
                  stroke={c.accent}
                  strokeWidth={isFocus ? 2 : 1.25}
                  opacity={0.9}
                />
                <circle
                  cx={pt[0]}
                  cy={pt[1]}
                  r={r}
                  fill={dotFill}
                  stroke={c.panelBg}
                  strokeWidth={1}
                  opacity={0.95}
                />
                {!focus ? (
                  <text
                    x={pt[0] + r + 8}
                    y={pt[1] + 4}
                    fill={c.text}
                    fontSize={11}
                    fontWeight={600}
                    style={{ pointerEvents: "none" }}
                  >
                    {countryLabelUi("HK", uiLang, COUNTRY_LABEL_ZH.HK ?? "中国香港")}
                  </text>
                ) : null}
              </g>
            );
          })()}

          {outline ? <path d={outline} fill="none" stroke={c.outline} strokeWidth={1} /> : null}
        </MapSvgFrame>

        {hover && !focus ? (
          <MapTooltip
            left={Math.min(hover.x + 12, (mapWrapRef.current?.clientWidth ?? width) - 210)}
            top={Math.max(8, hover.y - 64)}
            accent={hover.invested && investedOn ? "added" : "removed"}
          >
            <div style={{ fontWeight: 600 }}>{hover.name}</div>
            {marketOn ? (
              hover.lendingBn > 0 ? (
                <div style={{ color: c.removed }}>
                  {en ? "Market lending ≈" : "市场放贷 ≈"} USD {hover.lendingBn.toFixed(2)} bn
                </div>
              ) : (
                <div style={{ color: c.textTertiary }}>
                  {en ? "No market lending total" : "市场放贷总量暂无"}
                </div>
              )
            ) : null}
            {investedOn && hover.invested ? (
              <div style={{ color: c.added }}>
                {en ? "Invested outstanding" : "展业在贷"} {maskUsd(hover.outstandingUsd)} ·{" "}
                {en ? "Fund" : "基金"} {maskUsd(hover.investmentUsd)}
              </div>
            ) : null}
            {ecoOn && hover.ecoCount > 0 ? (
              <div style={{ color: c.added }}>
                {ecoLabel ?? (en ? "Eco institutions" : "生态机构")} · {hover.ecoCount}{" "}
                {en ? "samples" : "家样本"}
              </div>
            ) : null}
          </MapTooltip>
        ) : null}

        {focus && bottomLegend ? (
          <DetailPanel code={focus} onClose={() => setFocus(null)} overlay />
        ) : null}
      </div>

      {focus && !bottomLegend ? (
        <DetailPanel code={focus} onClose={() => setFocus(null)} />
      ) : null}
      {!focus ? (
        <MapSideLegend
          title={
            marketEcoOn
              ? en
                ? `Market × ${ecoLabel ?? "other institutions"}`
                : `市场 × ${ecoLabel ?? "其他机构"}`
              : ecoOnly
                ? en
                  ? `${ecoLabel ?? "Other institutions"} map`
                  : `${ecoLabel ?? "其他机构"}分布`
                : bothOn
                  ? en
                    ? "Market × invested"
                    : "市场 × 展业"
                  : marketOn
                    ? en
                      ? "Market legend"
                      : "市场图例"
                    : en
                      ? "Invested legend"
                      : "展业图例"
          }
          placement={place}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: bottomLegend ? 12 : 0,
              marginBottom: bottomLegend ? 8 : 0,
            }}
          >
            {marketOn ? (
              <SteppedLegend
                label={
                  en
                    ? "Dots · NBFC/peer lending (amber size; not AUM)"
                    : "点阵 · 非银/等效放贷（琥珀点色/点径；非 AUM）"
                }
                kind="warm"
                compact={bottomLegend}
              />
            ) : null}
            {investedOn ? (
              <SteppedLegend
                label={en ? "Dots · invested outstanding (blue)" : "点阵 · 展业在贷（蓝点色/点径）"}
                kind="accent"
                compact={bottomLegend}
              />
            ) : null}
            {ecoOn ? (
              <SteppedLegend
                label={
                  en
                    ? `Dots · ${ecoLabel ?? "other institutions"} sample count`
                    : `点阵 · ${ecoLabel ?? "其他机构"}样本数`
                }
                kind="accent"
                compact={bottomLegend}
              />
            ) : null}
          </div>
          {ecoOn ? (
            <div style={{ fontSize: 12, color: c.textSecondary, marginBottom: 8 }}>
              {en
                ? `Light basemap · ${ecoLabel ?? "other institutions"} in ${ecoRanked.length} countries · ${ecoRanked.reduce((s, [, n]) => s + n, 0)} samples · click bars to zoom`
                : `浅底透图 · ${ecoLabel ?? "其他机构"}覆盖 ${ecoRanked.length} 国 · 样本 ${ecoRanked.reduce((s, [, n]) => s + n, 0)} 家 · 点击横条放大`}
            </div>
          ) : investedOn ? (
            <div style={{ fontSize: 12, color: c.textSecondary, marginBottom: 8, lineHeight: 1.45 }}>
              {en
                ? `Light basemap · invested ${investedRanked.length} countries · heat outstanding ${guest ? SENSITIVE_MASK : formatUsdCompact(TOTAL_OUTSTANDING_HEAT_USD)} · fund total ${guest ? SENSITIVE_MASK : formatUsdCompact(PRODUCER_HOLDINGS.total_investment_usd)} · click dots/bars to zoom`
                : `浅底透图 · 展业 ${investedRanked.length} 国 · 在贷热力合计 ${guest ? SENSITIVE_MASK : formatUsdCompact(TOTAL_OUTSTANDING_HEAT_USD)} · 基金合计 ${guest ? SENSITIVE_MASK : formatUsdCompact(PRODUCER_HOLDINGS.total_investment_usd)} · 点击点/横条放大`}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: c.textSecondary, marginBottom: 8 }}>
              {en
                ? "Light basemap · market lending dots · click dots/bars to zoom"
                : "浅底透图 · 市场放贷色点 · 点击点/横条可放大"}
            </div>
          )}
          <RankBarList
            compact={bottomLegend}
            maxVisible={bottomLegend ? 20 : undefined}
            scaleHint={
              ecoOn
                ? en
                  ? `Bar ∝ ${ecoLabel ?? "other institutions"} samples`
                  : `条长 ∝ ${ecoLabel ?? "其他机构"}样本数`
                : investedOn
                  ? en
                    ? "Bar ∝ invested producer outstanding (≠ fund principal; fund used if missing)"
                    : "条长 ∝ 已投生产商在贷（非本基金本金；缺数国用基金投资额近似）"
                  : en
                    ? "Bar ∝ market lending USD bn (vs list max)"
                    : "条长 ∝ 市场放贷 USD bn（相对列表最大值）"
            }
            onSelect={(code) => setFocus(code)}
            items={
              ecoOn
                ? ecoRanked.map(([code, n]) => ({
                    key: code,
                    label: countryLabelUi(code, uiLang, COUNTRY_LABEL_ZH[code] ?? code),
                    value: n,
                    valueLabel: en ? `${n}` : `${n} 家`,
                    secondaryLabel:
                      marketEcoOn && lending[code]
                        ? en
                          ? `Market ~ USD ${lending[code].toFixed(1)} bn`
                          : `市场约 USD ${lending[code].toFixed(1)} bn`
                        : undefined,
                  }))
                : investedOn
                  ? investedRanked.map((row) => {
                      const fundBit = guest
                        ? en
                          ? `Fund ${SENSITIVE_MASK}`
                          : `基金 ${SENSITIVE_MASK}`
                        : en
                          ? `Fund ${formatUsdCompact(row.investment_usd)}`
                          : `基金 ${formatUsdCompact(row.investment_usd)}`;
                      const proxyBit =
                        !guest && row.outstanding_known === false
                          ? en
                            ? "Outstanding ≈ fund"
                            : "在贷暂用基金近似"
                          : null;
                      const mkt =
                        bothOn && lending[row.country_code]
                          ? en
                            ? `Market ~ USD ${lending[row.country_code].toFixed(1)} bn`
                            : `市场约 USD ${lending[row.country_code].toFixed(1)} bn`
                          : null;
                      return {
                        key: row.country_code,
                        label: countryLabelUi(
                          row.country_code,
                          uiLang,
                          COUNTRY_LABEL_ZH[row.country_code] ?? row.country_zh,
                        ),
                        value: row.outstanding_usd_for_heat,
                        valueLabel: guest
                          ? SENSITIVE_MASK
                          : formatUsdCompact(row.outstanding_usd_for_heat),
                        secondaryLabel: [fundBit, proxyBit, mkt].filter(Boolean).join(" · "),
                      };
                    })
                  : Object.entries(lending)
                      .filter(([, bn]) => bn > 0)
                      .sort((a, b) => b[1] - a[1])
                      .map(([code, bn]) => ({
                        key: code,
                        label: countryLabelUi(code, uiLang, COUNTRY_LABEL_ZH[code] ?? code),
                        value: bn,
                        valueLabel: `USD ${bn >= 10 ? bn.toFixed(1) : bn.toFixed(2)} bn`,
                      }))
            }
          />
          {(investedOn || ecoOn) && (INVESTED_BY_CODE.HK || (ecoMap.HK ?? 0) > 0) && !mapCodes.has("HK") ? (
            <div style={{ marginTop: 10, fontSize: 11, color: c.textSecondary, lineHeight: 1.5 }}>
              {en
                ? "Hong Kong has no separate polygon on this basemap; shown as an anchor. Listed below — click to zoom."
                : "中国香港在底图无独立面，地图上以锚点标出；下表含香港一行，可点击放大。"}
            </div>
          ) : null}
          <div style={{ marginTop: 12 }}>
            <MapMuted>
              {marketEcoOn
                ? en
                  ? `Amber = market lending; blue = ${ecoLabel ?? "other institutions"} samples. Layer switch keeps basemap.`
                  : `琥珀点=市场放贷；蓝点=${ecoLabel ?? "其他机构"}样本数。切换图层不重载底图。`
                : bothOn
                  ? en
                    ? "Amber = market lending; blue = invested outstanding (≠ fund principal). Layer switch keeps basemap."
                    : "琥珀点=市场放贷；蓝点=已投生产商在贷（≠基金本金）。切换图层不重载底图。"
                  : marketOn
                    ? en
                      ? "Amber size = market lending strength."
                      : "琥珀点色/点径=市场放贷强弱。"
                    : ecoOnly
                      ? en
                        ? `Blue size = ${ecoLabel ?? "other institutions"} sample strength.`
                        : `蓝点色/点径=${ecoLabel ?? "其他机构"}样本数强弱。`
                      : en
                        ? "Blue size = invested outstanding strength (≠ fund principal)."
                        : "蓝点色/点径=已投生产商在贷强弱（≠基金本金）。"}
            </MapMuted>
          </div>
        </MapSideLegend>
      ) : null}
    </div>
  );
}
