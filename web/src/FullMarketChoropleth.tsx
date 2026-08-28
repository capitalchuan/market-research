/**
 * 大屏全市场在贷 · 绿色面填（无点阵）
 * 顶栏：合计；IMF/世行筛选在大屏第二行（ScreenImfWbFilterBar）
 * 展业国：深蓝描边 + 圆心数字（已投生产商数）
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
  formatUsdCompact,
} from "./data/producerHoldings";
import {
  COUNTRY_IMF_WB,
  passesImfWbFilters,
} from "./data/countryImfWb";
import { formatCountryLanguageLine } from "./data/countryLanguage";
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
  MapMetricBlock,
  useMapChrome,
  Button,
  MapCountryMacroBrief,
  type MapLegendPlacement,
  useMapViewport,
  mapFrameWidth,
} from "./HeatMapChrome";
import { heatColorGreen, heatColorInvestedForest, logHeatNorm } from "./heatMapTheme";
import { useCanvasState, useHostTheme } from "./shims/cursor-canvas";
import { PartnerHoldingsSection, useGuestMask } from "./PartnerHoldingsSection";
import { SENSITIVE_MASK } from "./authAccess";

type CountryProps = { name?: string };

/** 大屏顶栏第二行：IMF / 世行筛选（与地图共用 canvas state，避免塞进地图导致画幅跳动） */
export function ScreenImfWbFilterBar() {
  const theme = useHostTheme();
  const [imfFilter, setImfFilter] = useCanvasState<string>("screenImfFilter2", "all");
  const [wbFilter, setWbFilter] = useCanvasState<string>("screenWbFilter2", "all");
  const selectStyle: CSSProperties = {
    fontSize: 12,
    padding: "5px 8px",
    borderRadius: 3,
    border: `1px solid ${theme.stroke.secondary}`,
    background: theme.bg.editor,
    color: theme.text.primary,
    maxWidth: 168,
    fontVariantNumeric: "tabular-nums",
  };
  const labelStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.text.tertiary,
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
      <label style={labelStyle}>
        IMF
        <select value={imfFilter} onChange={(e) => setImfFilter(e.target.value)} style={selectStyle}>
          {COUNTRY_IMF_WB.imfOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.labelZh}
            </option>
          ))}
        </select>
      </label>
      <label style={labelStyle}>
        世行
        <select value={wbFilter} onChange={(e) => setWbFilter(e.target.value)} style={selectStyle}>
          {COUNTRY_IMF_WB.wbOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.labelZh}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

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

function formatUsdTn(bn: number): string {
  if (!(bn > 0)) return "—";
  const tn = bn / 1000;
  if (tn >= 10) return `USD ${tn.toFixed(2)} tn`;
  if (tn >= 1) return `USD ${tn.toFixed(2)} tn`;
  return `USD ${bn.toFixed(1)} bn`;
}

type HoverInfo = {
  a2: string;
  name: string;
  usdBn: number;
  investedUsd: number;
  investedInvestmentUsd: number;
  investedCount: number;
  /** 机构叠层（含玩家）该国样本数 */
  ecoCount: number;
  nbfcCount: string;
  defaultRate: string;
  x: number;
  y: number;
};

const HK_FOCUS_FEATURE = {
  type: "Feature",
  properties: { name: "Hong Kong" },
  geometry: {
    type: "Point",
    coordinates: [114.17, 22.32],
  },
} as unknown as Feature<Geometry, CountryProps>;

/** 地图顶栏高度：合计/小指标专用条，避免叠在球面图上 */
const MAP_TOP_CHROME = 64;
const INVESTED_BADGE_LL: Record<string, [number, number]> = {
  MX: [-102.5, 23.6],
  TH: [100.5, 15.2],
  ID: [113.5, -2.5],
  PH: [121.8, 12.3],
  HK: [114.17, 22.32],
  IN: [78.9, 22.0],
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
  const { theme } = useMapChrome();
  const invested = INVESTED_BY_CODE[code];
  const zoom = COUNTRY_ZOOM_BY_CODE[code];
  const nbfc = summarizeNbfcForCountry(code);
  const imfWb = COUNTRY_IMF_WB.byCode[code];
  const name = COUNTRY_LABEL_ZH[code] ?? invested?.country_zh ?? code;
  const chartUrl = zoom?.source_url || playFinanceChartUrl(code);
  const langLine = formatCountryLanguageLine(code);

  return (
    <MapDetailShell
      title={`${name} · ${code}`}
      subtitle={langLine || undefined}
      onClose={onClose}
      overlay={overlay}
    >
      {imfWb ? (
        <MapSection title="IMF / 世行" dense={overlay}>
          <MapKV k="IMF" v={imfWb.imfDevTagZh} dense={overlay} />
          <MapKV k="世行" v={imfWb.wbIncomeZh} dense={overlay} />
        </MapSection>
      ) : null}
      <PartnerHoldingsSection invested={invested} dense={overlay} />
      <MapSection title="市场放贷" dense={overlay}>
        {nbfc ? (
          <>
            <MapKV
              k="放贷总量(USD)"
              v={
                nbfc.lendingUsdBn > 0
                  ? `约 USD ${nbfc.lendingUsdBn >= 10 ? nbfc.lendingUsdBn.toFixed(1) : nbfc.lendingUsdBn.toFixed(2)} bn`
                  : "—"
              }
              dense={overlay}
            />
            <MapKV k="机构数量" v={nbfc.nbfcCountDisplay} dense={overlay} />
          </>
        ) : (
          <MapMuted>暂无放贷总量</MapMuted>
        )}
      </MapSection>
      {zoom && !overlay ? (
        <MapSection title="人口 / Play Finance">
          <MapKV k="人口（约）" v={`${zoom.population_millions.toLocaleString()} 百万`} />
          {zoom.available !== false ? (
            <div style={{ fontSize: 12, marginTop: 4 }}>
              <a href={chartUrl} target="_blank" rel="noreferrer" style={{ color: theme.text.link }}>
                Play Finance 免费榜
              </a>
            </div>
          ) : null}
        </MapSection>
      ) : null}
      <MapCountryMacroBrief code={code} dense={overlay} />
    </MapDetailShell>
  );
}

export function FullMarketChoropleth({
  height = 520,
  fill = false,
  legendPlacement = "bottom",
  showMarket = true,
  showInvested = true,
  showEco = false,
  ecoCounts,
  ecoTotalUnique,
  ecoLabel,
  mapCorner,
  regionZoomCodes = null,
}: {
  height?: number;
  fill?: boolean;
  legendPlacement?: MapLegendPlacement;
  showMarket?: boolean;
  showInvested?: boolean;
  showEco?: boolean;
  ecoCounts?: Record<string, number>;
  /** 去重后的机构家数（顶栏用；避免全球枢纽落点按国加总虚高） */
  ecoTotalUnique?: number;
  ecoLabel?: string;
  /** 叠在地图框右上角（全屏按钮等） */
  mapCorner?: ReactNode;
  /** 大屏区域缩放：ISO2 列表；空/null 为全球 */
  regionZoomCodes?: string[] | null;
}) {
  const { theme, c } = useMapChrome();
  const { aspect, focusRightFrac, focusMapMinFrac } = useMapViewport(fill);
  const width = mapFrameWidth(height, aspect);
  const bottomLegend = fill || legendPlacement === "bottom";
  const place: MapLegendPlacement = bottomLegend ? "bottom" : "side";
  /** 大屏嵌入：指标栏在地图上方自然排版，避免 absolute 叠层 + overflow 裁切 */
  const headerFlow = !fill && bottomLegend;
  const { guest, maskUsd } = useGuestMask();

  const [imfFilter, setImfFilter] = useCanvasState<string>("screenImfFilter2", "all");
  const [wbFilter, setWbFilter] = useCanvasState<string>("screenWbFilter2", "all");
  const [focus, setFocus] = useState<string | null>(null);
  const mapTopPad = focus ? 12 : fill || !bottomLegend ? MAP_TOP_CHROME + 4 : 12;
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

  const regionSet = useMemo(
    () => (regionZoomCodes?.length ? new Set(regionZoomCodes) : null),
    [regionZoomCodes],
  );
  const regionKey = regionZoomCodes?.slice().sort().join(",") ?? "";
  useEffect(() => {
    setFocus(null);
    setYaw(0);
    setHover(null);
  }, [regionKey]);

  const lendingAll = useMemo(() => aggregateLendingUsdBn(), []);
  const lending = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [code, bn] of Object.entries(lendingAll)) {
      if (regionSet && !regionSet.has(code)) continue;
      if (!passesImfWbFilters(code, imfFilter, wbFilter)) continue;
      out[code] = bn;
    }
    return out;
  }, [lendingAll, imfFilter, wbFilter, regionSet]);

  const investedOutstanding = useMemo(() => {
    const out: Record<string, number> = {};
    for (const country of PRODUCER_HOLDINGS.countries) {
      if (country.outstanding_usd_for_heat > 0) {
        // 展业层不受 IMF/世行筛选影响（筛选只收窄市场面填）
        out[country.country_code] = country.outstanding_usd_for_heat;
      }
    }
    return out;
  }, []);

  const ecoMap = ecoCounts ?? {};
  const marketOn = showMarket && !showEco;
  const marketWithEco = showMarket && Boolean(showEco && ecoCounts);
  const investedOn = showInvested && !showEco;
  const ecoOn = Boolean(showEco && ecoCounts) && !showMarket;
  const both = marketOn && investedOn;

  /** 面填主层数值：市场放贷 bn / 展业在贷 usd / 生态样本数 */
  const fillValues = useMemo(() => {
    if (ecoOn) {
      const out: Record<string, number> = {};
      for (const [code, n] of Object.entries(ecoMap)) {
        if (n > 0 && (!regionSet || regionSet.has(code)) && passesImfWbFilters(code, imfFilter, wbFilter)) {
          out[code] = n;
        }
      }
      return out;
    }
    if (marketOn || marketWithEco) return lending;
    return Object.fromEntries(
      Object.entries(investedOutstanding)
        .filter(([k]) => !regionSet || regionSet.has(k))
        .map(([k, v]) => [k, v / 1e9]),
    );
  }, [ecoOn, marketOn, marketWithEco, lending, investedOutstanding, ecoMap, imfFilter, wbFilter, regionSet]);

  const fillVals = useMemo(() => Object.values(fillValues).filter((v) => v > 0), [fillValues]);
  const maxV = useMemo(() => Math.max(...fillVals, 1e-9), [fillVals]);
  const minV = useMemo(() => Math.min(...fillVals, maxV), [fillVals, maxV]);

  const intensity = (v: number) => {
    if (ecoOn) {
      if (!(maxV > minV)) return 1;
      return Math.min(1, Math.max(0, (v - minV) / (maxV - minV)));
    }
    return logHeatNorm(v, Math.max(minV, 1e-6), maxV);
  };

  const filteredSumBn = useMemo(
    () => Object.values(lending).reduce((s, v) => s + v, 0),
    [lending],
  );
  const marketAllSumBn = useMemo(
    () => Object.values(lendingAll).reduce((s, v) => s + v, 0),
    [lendingAll],
  );
  const investedSumUsd = useMemo(
    () => Object.values(investedOutstanding).reduce((s, n) => s + n, 0),
    [investedOutstanding],
  );
  const ecoSum = useMemo(() => {
    if (ecoTotalUnique != null && ecoTotalUnique >= 0) return ecoTotalUnique;
    return Object.entries(ecoMap).reduce((s, [code, n]) => {
      if (!(n > 0)) return s;
      if (marketWithEco && !passesImfWbFilters(code, imfFilter, wbFilter)) return s;
      return s + n;
    }, 0);
  }, [ecoMap, marketWithEco, imfFilter, wbFilter, ecoTotalUnique]);
  const ecoCountryCount = useMemo(
    () =>
      Object.entries(ecoMap).filter(([code, n]) => {
        if (!(n > 0)) return false;
        if (marketWithEco && !passesImfWbFilters(code, imfFilter, wbFilter)) return false;
        return true;
      }).length,
    [ecoMap, marketWithEco, imfFilter, wbFilter],
  );
  const coveredCountries = useMemo(() => Object.keys(COUNTRY_IMF_WB.byCode).length, []);
  const dataCountries = useMemo(
    () => Object.keys(lending).filter((code) => (lending[code] ?? 0) > 0).length,
    [lending],
  );
  const investedCountryCount = PRODUCER_HOLDINGS.countries.length;

  const marketVsInvestedPct =
    (marketOn || marketWithEco ? filteredSumBn : marketAllSumBn) > 0
      ? (investedSumUsd / 1e9 / (marketOn || marketWithEco ? filteredSumBn : marketAllSumBn)) * 100
      : null;
  const filterActive = imfFilter !== "all" || wbFilter !== "all";
  const imfLabel =
    COUNTRY_IMF_WB.imfOptions.find((o) => o.id === imfFilter)?.labelZh ?? "";
  const wbLabel = COUNTRY_IMF_WB.wbOptions.find((o) => o.id === wbFilter)?.labelZh ?? "";

  const legendLowHigh = useMemo(() => {
    if (!(fillVals.length > 0)) return { low: undefined as string | undefined, high: undefined as string | undefined };
    if (ecoOn) {
      return {
        low: `${Math.round(minV)} 家`,
        high: `${Math.round(maxV)} 家`,
      };
    }
    if (marketOn || marketWithEco) {
      return {
        low: formatUsdTn(minV),
        high: formatUsdTn(maxV),
      };
    }
    // 仅展业面填：色阶为热力在贷，访客不可见具体金额区间
    if (guest) {
      return { low: SENSITIVE_MASK, high: SENSITIVE_MASK };
    }
    return {
      low: formatUsdCompact(minV * 1e9),
      high: formatUsdCompact(maxV * 1e9),
    };
  }, [fillVals.length, ecoOn, marketOn, marketWithEco, minV, maxV, guest]);

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

  const { pathGen, outline, projection } = useMemo(() => {
    const proj = geoNaturalEarth1();
    if (focusFeature) {
      const rightPad = bottomLegend ? Math.round(width * focusRightFrac) : 28;
      proj.fitExtent(
        [
          [28, mapTopPad],
          [Math.max(width - rightPad, width * focusMapMinFrac), height - 36],
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
    return { pathGen: path, outline: path({ type: "Sphere" }) ?? "", projection: proj };
  }, [focusFeature, regionFeature, width, height, bottomLegend, yaw, focusRightFrac, focusMapMinFrac, mapTopPad]);

  const graticulePath = useMemo(() => pathGen(geoGraticule10()) ?? "", [pathGen]);

  const interactiveCountry = (a2: string | null) => {
    if (!a2) return false;
    if ((fillValues[a2] ?? 0) > 0) return true;
    if (investedOn && INVESTED_BY_CODE[a2]) return true;
    if (marketWithEco && (ecoMap[a2] ?? 0) > 0) return true;
    return false;
  };

  function tryFocusFromTarget(target: EventTarget | null) {
    const el = (target as Element | null)?.closest?.("[data-a2]");
    const a2 = el?.getAttribute("data-a2");
    if (a2 && interactiveCountry(a2)) {
      setFocus(a2);
      setHover(null);
    }
  }

  const investedBadges = useMemo(() => {
    if (!investedOn) return [] as { a2: string; x: number; y: number; n: number }[];
    const out: { a2: string; x: number; y: number; n: number }[] = [];
    for (const country of PRODUCER_HOLDINGS.countries) {
      const a2 = country.country_code;
      const n = country.producers.length;
      if (n <= 0) continue;
      const ll = INVESTED_BADGE_LL[a2];
      if (!ll) continue;
      const p = projection(ll);
      if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
      // 投影到球外/背面时跳过，避免 NaN 幽灵标
      if (p[0] < -20 || p[0] > width + 20 || p[1] < -20 || p[1] > height + 20) continue;
      out.push({ a2, x: p[0], y: p[1], n });
    }
    return out;
  }, [investedOn, projection, width, height]);

  const ecoBadges = useMemo(() => {
    if (!marketWithEco) return [] as { a2: string; x: number; y: number; n: number }[];
    const out: { a2: string; x: number; y: number; n: number }[] = [];
    for (const [a2, n] of Object.entries(ecoMap)) {
      if (!(n > 0)) continue;
      // 机构叠层跟随市场筛选
      if (!passesImfWbFilters(a2, imfFilter, wbFilter)) continue;
      let x: number | null = null;
      let y: number | null = null;
      const pin = INVESTED_BADGE_LL[a2];
      if (pin) {
        const p = projection(pin);
        if (p && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
          x = p[0];
          y = p[1];
        }
      }
      if (x == null || y == null) {
        const f = countries.features.find((ft) => a2Of(ft) === a2);
        if (!f) continue;
        const cxy = pathGen.centroid(f);
        if (!cxy || !Number.isFinite(cxy[0]) || !Number.isFinite(cxy[1])) continue;
        x = cxy[0];
        y = cxy[1];
      }
      if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue;
      out.push({ a2, x, y, n });
    }
    return out;
  }, [marketWithEco, ecoMap, countries, pathGen, projection, imfFilter, wbFilter, width, height]);

  const mapMetricsInner = (
    <div style={{ minWidth: 0, flex: 1 }}>
      {both || marketWithEco ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px 32px",
            alignItems: "flex-end",
          }}
        >
          <MapMetricBlock
            label={`全市场 · 在贷${filterActive ? " · 筛选后" : ""}`}
            value={formatUsdTn(filteredSumBn)}
          />
          {both ? (
            <MapMetricBlock label="展业 · 在贷" value={maskUsd(investedSumUsd)} accent />
          ) : null}
          {marketWithEco ? (
            <MapMetricBlock label={`${ecoLabel ?? "机构"} · 样本`} value={`${ecoSum} 家`} accent />
          ) : null}
        </div>
      ) : (
        <MapMetricBlock
          label={
            ecoOn
              ? `${ecoLabel ?? "其他机构"}`
              : marketOn
                ? `全市场 · 在贷${filterActive ? " · 筛选后" : ""}`
                : "展业 · 已投在贷"
          }
          value={
            ecoOn ? `${ecoSum} 家` : marketOn ? formatUsdTn(filteredSumBn) : maskUsd(investedSumUsd)
          }
        />
      )}
      <div
        style={{
          fontSize: 10,
          color: c.textTertiary,
          marginTop: 3,
          lineHeight: 1.25,
          letterSpacing: "0.02em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {ecoOn
          ? `落点 ${Object.keys(fillValues).filter((k) => (fillValues[k] ?? 0) > 0).length} 国 · 样本去重 ${ecoSum} 家${filterActive ? ` · ${[imfLabel, wbLabel].filter((x) => x && !x.startsWith("全部")).join(" · ")}` : ""}`
          : investedOn && !marketOn && !marketWithEco
            ? `展业 ${investedCountryCount} 国 · 对照全市场 ${formatUsdTn(marketAllSumBn)}${
                !guest && marketVsInvestedPct != null ? ` · 约 ${marketVsInvestedPct.toFixed(2)}%` : ""
              }`
            : marketWithEco
              ? `覆盖 ${coveredCountries} 国 · 有数据 ${dataCountries} 国 · ${ecoLabel ?? "机构"}落点 ${ecoCountryCount} 国 · 样本去重 ${ecoSum} 家${
                  filterActive
                    ? ` · ${[imfFilter !== "all" ? imfLabel : "", wbFilter !== "all" ? wbLabel : ""].filter(Boolean).join(" · ")}`
                    : ""
                }`
              : both
                ? `覆盖 ${coveredCountries} 国 · 有数据 ${dataCountries} 国 · 展业 ${investedCountryCount} 国${
                    !guest && marketVsInvestedPct != null ? ` · 占比约 ${marketVsInvestedPct.toFixed(2)}%` : ""
                  }${filterActive ? ` · ${[imfFilter !== "all" ? imfLabel : "", wbFilter !== "all" ? wbLabel : ""].filter(Boolean).join(" · ")}` : ""}`
                : `覆盖 ${coveredCountries} 国 · 有数据 ${dataCountries} 国${
                    filterActive
                      ? ` · ${[imfFilter !== "all" ? imfLabel : "", wbFilter !== "all" ? wbLabel : ""].filter(Boolean).join(" · ")}`
                      : ""
                  }`}
      </div>
    </div>
  );

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
      {/* 大屏：指标栏在地图上方自然排版；全屏/CRM 仍叠在 SVG 顶栏 */}
      {headerFlow && !focus ? (
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
        ref={mapWrapRef}
        style={
          fill
            ? {
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                borderRadius: 0,
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
          if ((e.target as Element).closest?.("button,a,select,label,[data-no-drag]")) return;
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
        {!headerFlow && !focus ? (
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
              justifyContent: "space-between",
              gap: 12,
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
            <path d={graticulePath} fill="none" stroke={c.graticule} strokeWidth={0.55} />
          ) : null}
          {countries.features.map((f, i) => {
            const a2 = a2Of(f);
            const d = pathGen(f);
            if (!d) return null;
            const v = a2 ? (fillValues[a2] ?? 0) : 0;
            const has = v > 0;
            const isFocus = focus != null && a2 === focus;
            const dimmed = focus != null && !isFocus;
            const invested = a2 ? INVESTED_BY_CODE[a2] : undefined;
            const showInvestedMark = Boolean(investedOn && invested);
            const ecoN = a2 ? ecoMap[a2] ?? 0 : 0;
            const showEcoMark = Boolean(marketWithEco && ecoN > 0);
            const showStroke = showInvestedMark || showEcoMark;
            const landColor = showInvestedMark
              ? heatColorInvestedForest()
              : has
                ? heatColorGreen(intensity(v))
                : c.emptyLand;
            return (
              <path
                key={`${f.id ?? i}`}
                data-a2={a2 ?? undefined}
                d={d}
                fill={landColor}
                stroke={showInvestedMark ? "#1e3a5f" : showEcoMark ? "#1e4a7a" : isFocus ? c.accent : c.landStroke}
                strokeWidth={showInvestedMark ? 1.6 : showEcoMark ? 1.35 : isFocus ? 1.35 : has ? 0.45 : 0.3}
                opacity={dimmed ? 0.2 : 1}
                style={{
                  cursor:
                    has || showInvestedMark || showEcoMark
                      ? "pointer"
                      : focus
                        ? "default"
                        : "inherit",
                }}
                onMouseEnter={(ev) => {
                  if (!a2 || dragRef.current?.moved || dragRef.current?.capturing) return;
                  const bn = lendingAll[a2] ?? 0;
                  const inv = INVESTED_BY_CODE[a2];
                  if (!(bn > 0) && !inv && !(marketWithEco && ecoN > 0)) return;
                  const nbfc = summarizeNbfcForCountry(a2);
                  const rect = (ev.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setHover({
                    a2,
                    name: COUNTRY_LABEL_ZH[a2] ?? f.properties?.name ?? a2,
                    usdBn: bn,
                    investedUsd: inv?.outstanding_usd_for_heat ?? 0,
                    investedInvestmentUsd: inv?.investment_usd ?? 0,
                    investedCount: inv?.producers.length ?? 0,
                    ecoCount: marketWithEco || ecoOn ? ecoN : 0,
                    nbfcCount: nbfc?.nbfcCountDisplay ?? "",
                    defaultRate: nbfc?.rows.find((r) => r.default_rate.trim())?.default_rate ?? "",
                    x: ev.clientX - rect.left,
                    y: ev.clientY - rect.top,
                  });
                }}
                onMouseMove={(ev) => {
                  if (!a2 || dragRef.current?.moved || dragRef.current?.capturing) return;
                  const bn = lendingAll[a2] ?? 0;
                  const inv = INVESTED_BY_CODE[a2];
                  const ecoN = ecoMap[a2] ?? 0;
                  if (!(bn > 0) && !inv && !(marketWithEco && ecoN > 0)) return;
                  const nbfc = summarizeNbfcForCountry(a2);
                  const rect = (ev.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setHover({
                    a2,
                    name: COUNTRY_LABEL_ZH[a2] ?? f.properties?.name ?? a2,
                    usdBn: bn,
                    investedUsd: inv?.outstanding_usd_for_heat ?? 0,
                    investedInvestmentUsd: inv?.investment_usd ?? 0,
                    investedCount: inv?.producers.length ?? 0,
                    ecoCount: marketWithEco || ecoOn ? ecoN : 0,
                    nbfcCount: nbfc?.nbfcCountDisplay ?? "",
                    defaultRate: nbfc?.rows.find((r) => r.default_rate.trim())?.default_rate ?? "",
                    x: ev.clientX - rect.left,
                    y: ev.clientY - rect.top,
                  });
                }}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
          {/* 香港锚点（底图无独立面；徽章另绘，此处仅可点面） */}
          {INVESTED_BY_CODE.HK && investedOn
            ? (() => {
                const p = projection([114.17, 22.32]);
                if (!p) return null;
                const has = (fillValues.HK ?? 0) > 0 || Boolean(INVESTED_BY_CODE.HK);
                return (
                  <g data-a2="HK" style={{ cursor: "pointer" }}>
                    <circle
                      cx={p[0]}
                      cy={p[1]}
                      r={has ? 5 : 3}
                      fill={heatColorInvestedForest()}
                      stroke="#1e3a5f"
                      strokeWidth={1.5}
                    />
                  </g>
                );
              })()
            : null}
          {/* 展业数字徽章 / 机构叠层数字（展业层永不被 IMF/世行筛掉） */}
          {(investedOn ? investedBadges : ecoBadges).map((b) => (
            <g key={`badge-${b.a2}`} data-a2={b.a2} data-invested-badge={b.a2} style={{ cursor: "pointer" }}>
              <circle
                cx={b.x}
                cy={b.y}
                r={marketWithEco ? 11 : 9}
                fill="#1e4a7a"
                stroke="#fff"
                strokeWidth={1.4}
              />
              <text
                x={b.x}
                y={b.y + 3.8}
                textAnchor="middle"
                fill="#fff"
                fontSize={marketWithEco && b.n >= 10 ? 9 : 10}
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
            left={Math.min(hover.x + 12, width - 260)}
            top={Math.max(MAP_TOP_CHROME + 4, hover.y - 96)}
            accent="added"
          >
            <div style={{ fontWeight: 600 }}>{hover.name}</div>
            {hover.usdBn > 0 ? (
              <div style={{ color: c.textSecondary }}>
                在贷余额（全市场）≈ USD{" "}
                {hover.usdBn >= 10 ? hover.usdBn.toFixed(1) : hover.usdBn.toFixed(2)} bn
              </div>
            ) : null}
            {hover.nbfcCount ? (
              <div style={{ color: c.textTertiary }}>机构数 {hover.nbfcCount}</div>
            ) : null}
            {hover.defaultRate ? (
              <div style={{ color: c.textTertiary }}>违约/不良 {hover.defaultRate}</div>
            ) : null}
            {(marketWithEco || ecoOn) && hover.ecoCount > 0 ? (
              <div style={{ color: c.accent }}>
                {ecoLabel ?? "机构"} {hover.ecoCount} 家
              </div>
            ) : null}
            {investedOn && hover.investedUsd > 0 ? (
              <div style={{ color: c.accent }}>展业在贷 {maskUsd(hover.investedUsd)}</div>
            ) : null}
            {investedOn && hover.investedInvestmentUsd > 0 ? (
              <div style={{ color: c.textTertiary }}>
                基金投资 {maskUsd(hover.investedInvestmentUsd)}
              </div>
            ) : null}
            {investedOn && !guest && hover.investedUsd > 0 && hover.usdBn > 0 ? (
              <div style={{ color: c.textTertiary }}>
                展业 / 全市场 ≈ {((hover.investedUsd / 1e9 / hover.usdBn) * 100).toFixed(2)}%
              </div>
            ) : null}
            {investedOn && hover.investedCount > 0 ? (
              <div style={{ color: c.textTertiary }}>展业平台 {hover.investedCount} 家</div>
            ) : null}
          </MapTooltip>
        ) : null}

        {focus && bottomLegend ? (
          <DetailPanel code={focus} onClose={() => setFocus(null)} overlay />
        ) : null}
      </div>

      {focus && !bottomLegend ? <DetailPanel code={focus} onClose={() => setFocus(null)} /> : null}

      {!focus ? (
        <MapSideLegend
          title={
            fill
              ? undefined
              : ecoOn
                ? (ecoLabel ?? "机构")
                : marketWithEco
                  ? `全市场 × ${ecoLabel ?? "机构"}`
                  : both
                    ? "市场 × 展业"
                    : marketOn
                      ? "全市场"
                      : "展业"
          }
          placement={place}
          overlay={fill}
        >
          <SteppedLegend
            label={ecoOn ? "样本数" : "在贷余额"}
            kind="green"
            compact={bottomLegend}
            low={legendLowHigh.low}
            high={legendLowHigh.high}
          />
          {marketWithEco ? (
            <div style={{ fontSize: 11, color: c.textTertiary, marginTop: 6, lineHeight: 1.4 }}>
              深蓝描边 + 圆点数字 = {ecoLabel ?? "机构"}样本（含全球网络枢纽落点）
            </div>
          ) : null}
        </MapSideLegend>
      ) : null}
    </div>
  );
}
