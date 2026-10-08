/**
 * 大屏热力图（内敛）：
 * - 市场放贷：不透明灰阶面填（浅→深），分档可辨
 * - 已投在贷：比例符号（圆点大小）+ 主题强调色，不用红绿语义
 *
 * 注意：Cursor fill.* 多为带 alpha 的半透明色，不能直接当 choropleth 端点，
 * 否则会整图压成死黑（此前「仅红」全黑的根因）。
 */
import type { CanvasHostTheme } from "./shims/cursor-canvas";

function stripAlpha(hex: string): string {
  const h = hex.replace("#", "");
  return `#${h.slice(0, 6)}`;
}

function hexRgb(h: string): [number, number, number] {
  const s = h.replace("#", "").slice(0, 6);
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

function rgbStr(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = hexRgb(a);
  const pb = hexRgb(b);
  const u = Math.min(1, Math.max(0, t));
  return rgbStr(pa[0] + (pb[0] - pa[0]) * u, pa[1] + (pb[1] - pa[1]) * u, pa[2] + (pb[2] - pa[2]) * u);
}

function ink(theme: CanvasHostTheme): string {
  return stripAlpha(theme.palette.foreground);
}

/** 无数据陆地（须浅于热力最低档，否则肯尼亚等会“隐身”） */
const GRAY_EMPTY = "#F0F0F0";
/** 面填专用：不透明浅灰 → 墨色（5 档，大屏一眼可辨） */
const GRAY_STOPS = ["#D0D0D0", "#A8A8A8", "#787878", "#4A4A4A", "#1A1A1A"] as const;

/** 连续灰阶（0→1），低端远离 emptyLand 的半透明 token */
export function heatGray(t: number, _theme?: CanvasHostTheme): string {
  const x = Math.min(1, Math.max(0, t));
  const n = GRAY_STOPS.length - 1;
  const i = Math.min(n - 1, Math.floor(x * n));
  const local = x * n - i;
  return lerpHex(GRAY_STOPS[i], GRAY_STOPS[i + 1], local);
}

/** 分档灰阶：把连续强度压成 5 类，拉开印尼/肯尼亚与印度的视觉差 */
export function heatGrayClass(t: number, _theme?: CanvasHostTheme): string {
  const x = Math.min(1, Math.max(0, t));
  const idx = Math.min(GRAY_STOPS.length - 1, Math.floor(x * GRAY_STOPS.length));
  return GRAY_STOPS[Math.max(0, idx)];
}

/** @deprecated 兼容：面填改用分档灰阶 */
export function heatColorRemoved(t: number, theme: CanvasHostTheme): string {
  return heatGrayClass(t, theme);
}

/** 已投符号色：浅灰 → 主题蓝（非绿） */
export function heatColorAdded(t: number, theme: CanvasHostTheme): string {
  const x = Math.min(1, Math.max(0, t));
  const tip = stripAlpha(theme.accent.primary);
  return lerpHex("#D9E6F0", tip, 0.25 + x * 0.75);
}

/** 全市场面填：鼠尾草绿（对齐大屏原图；非 Material 鲜绿） */
const SAGE_STOPS = ["#C9D4BC", "#B0C0A4", "#97AD8C", "#7E9674", "#667E5E"] as const;
/** 展业已投国强调：深绿（原图 MX/IN/SEA） */
const FOREST_INVESTED = "#1A4730";

export function heatColorGreen(t: number): string {
  const x = Math.min(1, Math.max(0, t));
  const n = SAGE_STOPS.length - 1;
  const i = Math.min(n - 1, Math.floor(x * n));
  const local = x * n - i;
  return lerpHex(SAGE_STOPS[i], SAGE_STOPS[i + 1], local);
}

/** 展业叠层：已投国深绿面填 */
export function heatColorInvestedForest(): string {
  return FOREST_INVESTED;
}

/** chuanx.xyz：奶油底上的藏青阶，浅沙 → 墨蓝 */
const CHUAN_STOPS = ["#E4D4CF", "#C9D0EA", "#8E97BE", "#4A5073", "#2E3653"] as const;
export const CHUAN_INK = "#232946";
export const CHUAN_CREAM = "#FEF1ED";
export const CHUAN_SAND = "#E4D4CF";
export const CHUAN_OCEAN = "#F7EFEA";

export function heatColorChuan(t: number): string {
  const x = Math.min(1, Math.max(0, t));
  const n = CHUAN_STOPS.length - 1;
  const i = Math.min(n - 1, Math.floor(x * n));
  const local = x * n - i;
  return lerpHex(CHUAN_STOPS[i], CHUAN_STOPS[i + 1], local);
}

export function heatStopsChuan(): string[] {
  return [...CHUAN_STOPS];
}

export function heatStopsGreen(): string[] {
  return [...SAGE_STOPS];
}

/**
 * 宏观点阵风险色：浅沙 → 琥珀 → 锈橙（不透明）。
 * 用于「浅底 + 点阵」大屏，避免整国 choropleth 压死底图。
 */
const WARM_STOPS = ["#E8DCC8", "#D4A574", "#C07840", "#9A4A22", "#6B2C12"] as const;

export function heatColorWarm(t: number): string {
  const x = Math.min(1, Math.max(0, t));
  const n = WARM_STOPS.length - 1;
  const i = Math.min(n - 1, Math.floor(x * n));
  const local = x * n - i;
  return lerpHex(WARM_STOPS[i], WARM_STOPS[i + 1], local);
}

export function heatStopsWarm(): string[] {
  return [...WARM_STOPS];
}

/** 通缩/负向：浅冰蓝 → 深蓝（与通胀暖色对仗） */
const COOL_STOPS = ["#D6E8F5", "#9BBFDC", "#5B8FBF", "#2B6CB0", "#1A4A7A"] as const;

export function heatColorCool(t: number): string {
  const x = Math.min(1, Math.max(0, t));
  const n = COOL_STOPS.length - 1;
  const i = Math.min(n - 1, Math.floor(x * n));
  const local = x * n - i;
  return lerpHex(COOL_STOPS[i], COOL_STOPS[i + 1], local);
}

export function heatStopsCool(): string[] {
  return [...COOL_STOPS];
}

export function heatStopsGray(_theme?: CanvasHostTheme): string[] {
  return [...GRAY_STOPS];
}

export function heatStopsAccent(theme: CanvasHostTheme): string[] {
  return [0, 0.25, 0.5, 0.75, 1].map((t) => heatColorAdded(t, theme));
}

export function heatStopsRemoved(theme: CanvasHostTheme): string[] {
  return heatStopsGray(theme);
}

export function heatStopsAdded(theme: CanvasHostTheme): string[] {
  return heatStopsAccent(theme);
}

/** log10 归一化：适合跨 3 个数量级的放贷规模 */
export function logHeatNorm(value: number, minPositive: number, max: number): number {
  if (!(value > 0)) return 0;
  const lo = Math.log10(Math.max(minPositive, 1e-9));
  const hi = Math.log10(Math.max(max, minPositive * 1.01));
  if (hi <= lo) return 1;
  return Math.min(1, Math.max(0, (Math.log10(value) - lo) / (hi - lo)));
}

export function mapChrome(theme: CanvasHostTheme) {
  const black = ink(theme);
  const accent = stripAlpha(theme.accent.primary);
  return {
    mapBg: theme.bg.chrome,
    ocean: theme.bg.editor,
    /** 无数据陆地：不透明浅灰，勿用半透明 fill token */
    emptyLand: GRAY_EMPTY,
    landStroke: theme.stroke.tertiary,
    outline: theme.stroke.secondary,
    graticule: theme.stroke.tertiary,
    panelBg: theme.bg.elevated,
    panelBorder: theme.stroke.tertiary,
    text: theme.text.primary,
    textSecondary: theme.text.secondary,
    textTertiary: theme.text.tertiary,
    link: theme.text.link,
    accent,
    ink: black,
    removed: black,
    added: accent,
    removedSoft: "#F0F0F0",
    addedSoft: "#E8F0F6",
    fillSoft: "#F0F0F0",
    buttonBg: theme.bg.elevated,
    buttonBorder: theme.stroke.secondary,
  };
}
