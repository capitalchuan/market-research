/**
 * 大屏与 CRM 共用的 Cursor 扁平 UI 零件（无阴影 / 无渐变 / 主题 token）。
 * 大屏另含指挥台分段控件（ScreenSeg*），强调操作反馈与指标可读性。
 */
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useCanvasState, useHostTheme, Text, Button, Link, Stack, Row, mergeStyle } from "./shims/cursor-canvas";
import {
  heatStopsAdded,
  heatStopsRemoved,
  heatStopsWarm,
  heatStopsGreen,
  heatStopsCool,
  mapChrome,
  heatColorAdded,
  heatColorRemoved,
} from "./heatMapTheme";
import {
  displayCreditNote,
  getCountryMacro,
  synthesizeCashLoanBrief,
  buildCashLoanMacroGroups,
  collectCountryMacroCiteNos,
} from "./data/countryMacro";
import { formatCountryLanguageLine, getCountryLanguage } from "./data/countryLanguage";
import {
  resolveFxSeries,
  FX_CHG_PERIODS,
  type FxChgPeriodId,
  sliceFxPointsByMonths,
  fxLocalStrengthChgPct,
  fxPointsSpanLabel,
} from "./data/fxHistory";
import { MapMacroKV, MacroSourcesBlock, CitedText } from "./SourceCite";
import { citeMark } from "./data/sourceCitations";

/** 宽屏 Natural Earth 画幅；窄屏改矮胖比，避免 SVG height:auto 被压成一条 */
export const MAP_ASPECT_WIDE = 2.05;

/** 视口驱动的地图画幅：小屏更高、详情卡更窄，给底图让位 */
export function useMapViewport(fill?: boolean) {
  const [vw, setVw] = useState(1200);
  const [vh, setVh] = useState(800);
  useEffect(() => {
    const sync = () => {
      if (typeof window === "undefined") return;
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);
  const narrow = vw < 720;
  const compact = vw < 1100;
  /** 全屏铺容器仍用宽画幅；嵌入小屏用更「竖」的 viewBox，同宽下更高 */
  const aspect = fill ? MAP_ASPECT_WIDE : narrow ? 1.2 : compact ? 1.4 : MAP_ASPECT_WIDE;
  /** 国别聚焦时右侧留给详情的比例（越小地图越大） */
  const focusRightFrac = fill
    ? narrow
      ? 0.36
      : compact
        ? 0.4
        : 0.46
    : narrow
      ? 0.32
      : compact
        ? 0.36
        : 0.46;
  const focusMapMinFrac = narrow ? 0.62 : compact ? 0.56 : 0.48;
  return { vw, vh, narrow, compact, aspect, focusRightFrac, focusMapMinFrac };
}

export function mapFrameWidth(height: number, aspect: number = MAP_ASPECT_WIDE): number {
  return Math.round(height * aspect);
}

/** 嵌入/总览内容区：左右边线 + 与页缘留白（无上下框） */
export const ATLAS_SIDE_RAIL_INSET = 12;

export function atlasSideRailStyle(panelBorder: string, inset = ATLAS_SIDE_RAIL_INSET): CSSProperties {
  return {
    marginLeft: inset,
    marginRight: inset,
    paddingLeft: 14,
    paddingRight: 14,
    borderLeft: `1px solid ${panelBorder}`,
    borderRight: `1px solid ${panelBorder}`,
    boxSizing: "border-box",
  };
}

/** @deprecated 用 atlasSideRailStyle / AtlasSideRail */
export function mapSideRailStyle(panelBorder: string): CSSProperties {
  return atlasSideRailStyle(panelBorder);
}

export function AtlasSideRail({
  children,
  style,
}: {
  children?: ReactNode;
  style?: CSSProperties;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  return <div style={mergeStyle(atlasSideRailStyle(c.panelBorder), style)}>{children}</div>;
}

/** 大屏分段轨道：图层/因子共用，弱化糖果胶囊感 */
export function ScreenSegTrack({
  children,
  style,
}: {
  children?: ReactNode;
  style?: CSSProperties;
}) {
  const theme = useHostTheme();
  return (
    <div
      style={mergeStyle(
        {
          display: "inline-flex",
          flexWrap: "wrap",
          alignItems: "stretch",
          border: `1px solid ${theme.stroke.secondary}`,
          borderRadius: 4,
          overflow: "hidden",
          background: theme.bg.editor,
        },
        style,
      )}
    >
      {children}
    </div>
  );
}

/** 大屏分段钮：矩形、底边高亮、等宽数字 */
export function ScreenSegChip({
  label,
  active,
  clearable,
  onClick,
  title,
}: {
  label: string;
  active?: boolean;
  clearable?: boolean;
  onClick: () => void;
  title?: string;
}) {
  const theme = useHostTheme();
  const accent = theme.accent.primary;
  return (
    <button
      type="button"
      title={title ?? (active && clearable ? "点击清除" : undefined)}
      onClick={onClick}
      style={{
        margin: 0,
        height: 30,
        padding: "0 12px",
        border: "none",
        borderRight: `1px solid ${theme.stroke.tertiary}`,
        borderBottom: active ? `2px solid ${accent}` : "2px solid transparent",
        borderRadius: 0,
        background: active ? theme.fill.tertiary : "transparent",
        color: active ? theme.text.primary : theme.text.tertiary,
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        letterSpacing: "0.03em",
        fontVariantNumeric: "tabular-nums",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background 120ms ease, color 120ms ease, border-color 120ms ease",
      }}
      onMouseEnter={(e) => {
        if (active) return;
        e.currentTarget.style.background = theme.fill.quaternary;
        e.currentTarget.style.color = theme.text.secondary;
      }}
      onMouseLeave={(e) => {
        if (active) return;
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = theme.text.tertiary;
      }}
    >
      {label}
      {active && clearable ? (
        <span style={{ marginLeft: 6, opacity: 0.55, fontWeight: 500 }}>×</span>
      ) : null}
    </button>
  );
}

/** 大屏状态微标：MODE · LIVE */
export function ScreenStatusPills({
  items,
}: {
  items: { label: string; tone?: "neutral" | "live" | "accent" }[];
}) {
  const theme = useHostTheme();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {items.map((it) => {
        const live = it.tone === "live";
        const acc = it.tone === "accent";
        return (
          <span
            key={it.label}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: 20,
              padding: "0 8px",
              borderRadius: 3,
              border: `1px solid ${theme.stroke.tertiary}`,
              background: acc ? theme.fill.tertiary : theme.bg.elevated,
              color: acc ? theme.text.primary : theme.text.tertiary,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {live ? (
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: theme.accent.primary,
                  flexShrink: 0,
                }}
              />
            ) : null}
            {it.label}
          </span>
        );
      })}
    </div>
  );
}

/** 地图指标条：小标签 + 等宽主数 */
export function MapMetricBlock({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: c.textTertiary,
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "clamp(18px, 1.25vw + 0.55rem, 26px)",
          fontWeight: 700,
          color: accent ? c.accent : c.text,
          lineHeight: 1.12,
          marginTop: 2,
          fontVariantNumeric: "tabular-nums",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
    </div>
  );
}


export function MapSection({
  title,
  children,
  dense = false,
}: {
  title: string;
  children: ReactNode;
  dense?: boolean;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  return (
    <div style={{ marginBottom: dense ? 10 : 16 }}>
      <div
        style={{
          fontSize: dense ? 12 : 13,
          fontWeight: 600,
          color: c.textSecondary,
          marginBottom: 6,
          borderBottom: `1px solid ${c.panelBorder}`,
          paddingBottom: 4,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

export function MapKV({
  k,
  v,
  dense = false,
}: {
  k: string;
  v: string;
  dense?: boolean;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        fontSize: dense ? 12 : 13,
        lineHeight: 1.55,
        marginBottom: dense ? 2 : 4,
      }}
    >
      <span style={{ color: c.textTertiary, minWidth: dense ? 88 : 96, flexShrink: 0 }}>{k}</span>
      <span style={{ color: c.text, wordBreak: "break-word" }}>{v}</span>
    </div>
  );
}

export function MapDetailShell({
  title,
  subtitle,
  onClose,
  closeLabel = "返回全球",
  children,
  overlay = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  closeLabel?: string;
  children: ReactNode;
  /** 全屏地图：浮在地图右侧，不挤占底图宽度 */
  overlay?: boolean;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  const { narrow, compact } = useMapViewport(overlay);
  return (
    <div
      data-no-drag
      style={
        overlay
          ? {
              position: "absolute",
              top: narrow ? 48 : 56,
              right: narrow ? 8 : 12,
              bottom: narrow ? 8 : 12,
              // 小屏收窄详情卡，给地图留出主体；不再强制 max(50vw, 420)
              width: narrow
                ? "min(300px, 42vw)"
                : compact
                  ? "min(360px, 34vw)"
                  : "min(480px, 34vw)",
              maxWidth: narrow ? "44vw" : compact ? "36vw" : "40vw",
              zIndex: 4,
              overflow: "auto",
              border: `1px solid ${c.panelBorder}`,
              borderRadius: 8,
              background: c.panelBg,
              padding: narrow ? 10 : "clamp(12px, 1.4vw, 20px)",
              fontSize: "clamp(13px, 0.9vw + 0.35rem, 15px)",
              lineHeight: 1.55,
            }
          : {
              flex: "1 1 420px",
              minWidth: 360,
              maxWidth: 640,
              maxHeight: 560,
              overflow: "auto",
              border: `1px solid ${c.panelBorder}`,
              borderRadius: 8,
              background: c.panelBg,
              padding: 16,
            }
      }
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 12, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: overlay ? "clamp(16px, 1.2vw + 0.45rem, 20px)" : 15,
              fontWeight: 600,
              color: c.text,
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                fontSize: overlay ? "clamp(11px, 0.7vw + 0.35rem, 13px)" : 11,
                color: c.textTertiary,
                marginTop: 4,
                lineHeight: 1.45,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        <Button variant="secondary" size="sm" onClick={onClose}>
          {closeLabel}
        </Button>
      </div>
      {children}
    </div>
  );
}

export function MapFloatingBar({ children }: { children: ReactNode }) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  return (
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
      {children}
      {/* spacer for typed children that need chrome colors via context */}
      <span style={{ display: "none" }} data-map-chrome={c.text} />
    </div>
  );
}

export function MapChip({ children }: { children: ReactNode }) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  return (
    <span
      style={{
        fontSize: "clamp(11px, 0.75vw + 0.4rem, 12.5px)",
        lineHeight: 1.25,
        color: c.text,
        background: c.panelBg,
        borderRadius: 6,
        padding: "0.32em 0.7em",
        border: `1px solid ${c.panelBorder}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function MapSvgFrame({
  width,
  height,
  fill = false,
  children,
}: {
  width: number;
  height: number;
  /** 铺满父容器（投屏全屏） */
  fill?: boolean;
  children: ReactNode;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={fill ? "100%" : "auto"}
      preserveAspectRatio="xMidYMid meet"
      style={{
        display: "block",
        background: c.mapBg,
        borderRadius: 0,
        border: "none",
        ...(fill
          ? {
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              background: c.mapBg,
            }
          : {
              aspectRatio: `${width} / ${height}`,
              background: "transparent",
            }),
      }}
    >
      <rect width={width} height={height} fill={fill ? c.mapBg : c.ocean} />
      {children}
    </svg>
  );
}

export function MapTooltip({
  left,
  top,
  accent,
  children,
}: {
  left: number;
  top: number;
  accent?: "removed" | "added" | "neutral";
  children: ReactNode;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  const border =
    accent === "removed" ? c.removed : accent === "added" ? c.added : c.panelBorder;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        background: c.panelBg,
        color: c.text,
        border: `1px solid ${border}`,
        padding: "8px 10px",
        borderRadius: 6,
        fontSize: 12,
        pointerEvents: "none",
        minWidth: 170,
      }}
    >
      {children}
    </div>
  );
}

/** 离散色阶（禁止 linear-gradient） */
export function SteppedLegend({
  label,
  kind,
  compact = false,
  low,
  high,
}: {
  label: string;
  kind: "removed" | "added" | "gray" | "accent" | "warm" | "green" | "cool";
  /** 底部/融入图例时更扁 */
  compact?: boolean;
  /** 色阶左端（低） */
  low?: string;
  /** 色阶右端（高） */
  high?: string;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  const stops =
    kind === "warm"
      ? heatStopsWarm()
      : kind === "green"
        ? heatStopsGreen()
        : kind === "cool"
          ? heatStopsCool()
          : kind === "added" || kind === "accent"
            ? heatStopsAdded(theme)
            : heatStopsRemoved(theme);
  return (
    <div
      style={{
        marginBottom: compact ? 0 : 12,
        flex: compact ? "1 1 200px" : undefined,
        minWidth: compact ? 160 : undefined,
        maxWidth: compact ? 320 : undefined,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: c.textTertiary, marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          display: "flex",
          height: compact ? 7 : 9,
          borderRadius: 2,
          overflow: "hidden",
          border: `1px solid ${c.panelBorder}`,
        }}
      >
        {stops.map((color, i) => (
          <div key={i} style={{ flex: 1, background: color }} />
        ))}
      </div>
      {low != null || high != null ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            marginTop: 4,
            fontSize: 11,
            color: c.textSecondary,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span>{low ?? ""}</span>
          <span>{high ?? ""}</span>
        </div>
      ) : null}
    </div>
  );
}

export type MapLegendPlacement = "side" | "bottom";

export function MapSideLegend({
  title,
  children,
  placement = "side",
  overlay = false,
}: {
  title?: string;
  children: ReactNode;
  /** side=右侧栏；bottom=地图框外下方横栏（不叠底图） */
  placement?: MapLegendPlacement;
  /** 大屏：叠在地图底边，不挤占画幅高度 */
  overlay?: boolean;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  if (placement === "bottom") {
    return (
      <div
        data-no-drag
        style={
          overlay
            ? {
                position: "absolute",
                left: 12,
                right: 12,
                bottom: 10,
                zIndex: 3,
                background: c.panelBg,
                border: `1px solid ${c.panelBorder}`,
                borderRadius: 4,
                padding: "8px 12px",
                pointerEvents: "auto",
                backdropFilter: "none",
              }
            : {
                flex: "0 0 auto",
                width: "100%",
                padding: "8px 0 0",
                overflow: "visible",
              }
        }
      >
        {title ? (
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              marginBottom: overlay ? 4 : 8,
              color: c.textSecondary,
            }}
          >
            {title}
          </div>
        ) : null}
        {children}
      </div>
    );
  }
  return (
    <div style={{ flex: "1 1 220px", minWidth: 200, alignSelf: "flex-start" }}>
      {title ? (
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: c.textSecondary }}>{title}</div>
      ) : null}
      {children}
    </div>
  );
}

export function MapMuted({ children }: { children: ReactNode }) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  return (
    <div style={{ fontSize: 12, color: c.textTertiary, lineHeight: 1.5 }}>{children}</div>
  );
}

export type RankBarItem = {
  key: string;
  label: string;
  value: number;
  valueLabel: string;
  /** 次要说明（如双图层下的市场读数） */
  secondaryLabel?: string;
};

/**
 * 国别排行横条图：替代密文列表，便于比较相对规模。
 * 条长按线性比例（相对当前列表最大值）；点击行可联动地图。
 */
export function RankBarList({
  items,
  onSelect,
  compact = false,
  scaleHint = "条长 ∝ 数值（相对列表最大值）",
  maxVisible,
}: {
  items: RankBarItem[];
  onSelect?: (key: string) => void;
  compact?: boolean;
  scaleHint?: string;
  /** 仅展示前 N 条，其余以脚注说明 */
  maxVisible?: number;
}) {
  const theme = useHostTheme();
  const c = mapChrome(theme);
  if (!items.length) return null;
  const shown = maxVisible && maxVisible > 0 ? items.slice(0, maxVisible) : items;
  const max = Math.max(...shown.map((i) => i.value), Number.EPSILON);
  const barInk = c.ink;
  const track = c.fillSoft;

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: c.textTertiary,
          marginBottom: compact ? 4 : 6,
          lineHeight: 1.4,
        }}
      >
        {scaleHint}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: compact ? 4 : 6,
          maxHeight: compact ? 280 : 360,
          overflow: "auto",
          paddingRight: 2,
        }}
      >
        {shown.map((item, idx) => {
          const pct = Math.max(1.5, (item.value / max) * 100);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect?.(item.key)}
              title={`${item.label} · ${item.valueLabel}`}
              style={{
                display: "block",
                width: "100%",
                margin: 0,
                padding: compact ? "2px 0" : "3px 0",
                border: "none",
                background: "none",
                cursor: onSelect ? "pointer" : "default",
                textAlign: "left",
                font: "inherit",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 8,
                  fontSize: compact ? 11 : 12,
                  lineHeight: 1.35,
                  marginBottom: 2,
                }}
              >
                <span style={{ color: c.link, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span style={{ color: c.textTertiary, marginRight: 4 }}>{idx + 1}</span>
                  {item.label}
                </span>
                <span
                  style={{
                    color: c.text,
                    flexShrink: 0,
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                  }}
                >
                  {item.valueLabel}
                </span>
              </div>
              <div
                style={{
                  height: compact ? 5 : 7,
                  borderRadius: 2,
                  background: track,
                  overflow: "hidden",
                  border: `1px solid ${c.panelBorder}`,
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: barInk,
                    opacity: 0.72,
                  }}
                />
              </div>
              {item.secondaryLabel ? (
                <div
                  style={{
                    fontSize: 10,
                    color: c.removed,
                    marginTop: 2,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {item.secondaryLabel}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
      {maxVisible && items.length > shown.length ? (
        <div style={{ fontSize: 11, color: c.textTertiary, marginTop: 6 }}>
          另有 {items.length - shown.length} 国未展示；点地图或放大国家查看
        </div>
      ) : null}
    </div>
  );
}

export function MapExtLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href}>{children}</Link>;
}

/** 国别详情：按现金贷决策序分组（与 CRM 宏观卡同逻辑） */
export function MapCountryMacroBrief({ code, dense = false }: { code: string; dense?: boolean }) {
  const snap = getCountryMacro(code);
  const theme = useHostTheme();
  const c = mapChrome(theme);
  if (!snap) {
    return (
      <MapSection title="宏观因子" dense={dense}>
        <MapMuted>暂无宏观快照</MapMuted>
      </MapSection>
    );
  }
  const lang = getCountryLanguage(code);
  const fx = resolveFxSeries(code, {
    fxTrend: snap.fxTrend,
    fxHint: snap.fxHint,
    fxVolInYear: snap.fxVolInYear,
  });
  const [fxPeriod, setFxPeriod] = useCanvasState<FxChgPeriodId>("fxChgPeriod1", "all");
  const fxPeriodMeta = FX_CHG_PERIODS.find((p) => p.id === fxPeriod) || FX_CHG_PERIODS[FX_CHG_PERIODS.length - 1]!;
  const fxPts = useMemo(
    () => (fx?.points?.length ? sliceFxPointsByMonths(fx.points, fxPeriodMeta.months) : []),
    [fx?.points, fxPeriodMeta.months],
  );
  const groups = buildCashLoanMacroGroups(snap);
  const brief = dense ? "" : synthesizeCashLoanBrief(snap);
  const note = displayCreditNote(snap);
  const citeNos = collectCountryMacroCiteNos(snap);

  let spark: ReactNode = null;
  if (fx && fxPts.length >= 2) {
    const pts = fxPts;
    const W = 240;
    const H = 44;
    const ys = pts.map((p) => p.v);
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    const span = hi - lo || 1;
    const line = pts
      .map((p, i) => {
        const x = (i / Math.max(1, pts.length - 1)) * W;
        const y = 2 + (1 - (p.v - lo) / span) * (H - 4);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    const strengthChg = fxLocalStrengthChgPct(fx, pts);
    const flat = Math.abs(strengthChg) < 0.05;
    const up = strengthChg > 0;
    const FX_UP = "#E53935";
    const FX_DOWN = "#1B8F4A";
    const stroke = flat ? c.accent : up ? FX_UP : FX_DOWN;
    const arrow = flat ? "–" : up ? "▲" : "▼";
    const word = flat ? "持平" : up ? "本币升" : "本币贬";
    const spanHint = fxPointsSpanLabel(pts, fx.synthetic && fxPeriod === "all");
    const fxCite = fx.synthetic ? "" : citeMark(13);
    spark = (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11, color: c.textTertiary, marginBottom: 4 }}>
          <span>
            汇率走势 · {fx.pair}
            {fx.synthetic ? "（示意）" : ""}
            {fxCite ? <CitedText text={` ${fxCite}`} size="small" dense /> : null}
          </span>
          <span
            style={{
              color: stroke,
              fontWeight: 600,
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "flex-end",
              lineHeight: 1.25,
              textAlign: "right",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 3 }}>
              <span aria-hidden>{arrow}</span>
              {flat ? "" : up ? "+" : ""}
              {Math.abs(strengthChg).toFixed(1)}%
              <span style={{ fontWeight: 400 }}>{word}</span>
            </span>
            <span style={{ fontWeight: 500, color: c.textTertiary, fontSize: 10 }}>
              {spanHint}累计 · {fxPeriodMeta.label}
            </span>
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
          {FX_CHG_PERIODS.map((p) => {
            const active = fxPeriod === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setFxPeriod(p.id)}
                style={{
                  height: 22,
                  padding: "0 7px",
                  borderRadius: 5,
                  border: `1px solid ${active ? stroke : c.panelBorder}`,
                  background: active ? "rgba(80,140,180,0.12)" : "transparent",
                  color: active ? c.text : c.textTertiary,
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: 10,
                  fontWeight: active ? 600 : 500,
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={40} preserveAspectRatio="none" aria-hidden>
          <path d={line} fill="none" stroke={stroke} strokeWidth={1.4} strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  return (
    <MapSection title="信贷宏观" dense={dense}>
      {spark}
      <MapMacroKV k="对照时点" v={snap.asOf || "—"} dense={dense} />
      {!dense && formatCountryLanguageLine(code) ? (
        <MapMacroKV k="语言区" v={formatCountryLanguageLine(code)!} dense={dense} />
      ) : null}
      {!dense && lang?.productHint ? <MapMacroKV k="产品常用语" v={lang.productHint} dense={dense} /> : null}
      {brief ? (
        <div style={{ margin: "8px 0", fontSize: 12, lineHeight: 1.5, color: c.textSecondary }}>
          <CitedText text={brief} size="small" dense={dense} />
        </div>
      ) : null}
      {groups.map((g) => (
        <div key={g.id} style={{ marginBottom: dense ? 6 : 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: c.textSecondary, marginBottom: 2 }}>
            {g.step} {g.title}
          </div>
          {!dense ? (
            <div style={{ fontSize: 11, color: c.textTertiary, marginBottom: 4, lineHeight: 1.4 }}>{g.soWhat}</div>
          ) : null}
          {g.metrics.map((m) => (
            <MapMacroKV
              key={`${g.id}-${m.label}`}
              k={m.label}
              v={m.value}
              asOf={m.asOf}
              asOfFromSnap={m.asOfFromSnap}
              dense={dense}
            />
          ))}
        </div>
      ))}
      {!dense && note ? <MapMacroKV k="补充" v={note} dense={dense} /> : null}
      <MacroSourcesBlock citeNos={citeNos} dense={dense} />
    </MapSection>
  );
}

export function useMapChrome() {
  const theme = useHostTheme();
  return { theme, c: mapChrome(theme) };
}

export function producerCardStyle(theme: ReturnType<typeof useHostTheme>): CSSProperties {
  const c = mapChrome(theme);
  return mergeStyle({
    background: c.addedSoft,
    border: `1px solid ${c.panelBorder}`,
    borderRadius: 6,
    padding: "10px 12px",
    fontSize: 12,
    color: c.textSecondary,
    lineHeight: 1.55,
  });
}

export { Stack, Row, Text, Button, Link, useHostTheme, heatColorAdded, heatColorRemoved, mapChrome };
