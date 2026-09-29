/**
 * Browser shim for `cursor/canvas` so the Atlas canvas can run as a website.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/** Re-export React hooks used by canvases that import from `cursor/canvas`. */
export { useEffect, useRef, useState };

/* ---------- theme ---------- */

const paletteLight = {
  foreground: "#141414F0",
  foregroundSecondary: "#141414BD",
  foregroundTertiary: "#1414148A",
  foregroundQuaternary: "#1414145C",
  editor: "#FCFCFC",
  chrome: "#F8F8F8",
  sidebar: "#F3F3F3",
  elevated: "#FCFCFC",
  fillPrimary: "#14141433",
  fillSecondary: "#14141424",
  fillTertiary: "#14141414",
  fillQuaternary: "#1414140F",
  strokePrimary: "#14141433",
  strokeSecondary: "#1414141F",
  strokeTertiary: "#14141414",
  strokeFocused: "#3685BF",
  accent: "#3685BF",
  buttonBackground: "#3685BF",
  buttonForeground: "#FCFCFC",
  buttonHoverBackground: "#2E76AB",
  link: "#3685BF",
  diffInsertedLine: "#1F8A651F",
  diffRemovedLine: "#CF2D5614",
  diffStripAdded: "#1F8A65CC",
  diffStripRemoved: "#CF2D56CC",
} as const;

function tokensFromPalette(p: typeof paletteLight) {
  return {
    text: {
      primary: p.foreground,
      secondary: p.foregroundSecondary,
      tertiary: p.foregroundTertiary,
      quaternary: p.foregroundQuaternary,
      link: p.link,
      onAccent: p.buttonForeground,
    },
    bg: {
      editor: p.editor,
      chrome: p.chrome,
      elevated: p.elevated,
      sidebar: p.sidebar,
    },
    fill: {
      primary: p.fillPrimary,
      secondary: p.fillSecondary,
      tertiary: p.fillTertiary,
      quaternary: p.fillQuaternary,
    },
    stroke: {
      primary: p.strokePrimary,
      secondary: p.strokeSecondary,
      tertiary: p.strokeTertiary,
      focused: p.strokeFocused,
    },
    accent: {
      primary: p.accent,
      control: p.buttonBackground,
      controlHover: p.buttonHoverBackground,
    },
    diff: {
      insertedLine: p.diffInsertedLine,
      removedLine: p.diffRemovedLine,
      stripAdded: p.diffStripAdded,
      stripRemoved: p.diffStripRemoved,
    },
    // Cursor canvas category tokens（状态色：涨跌/未读/灾害等）
    category: {
      gray: "#8A8A8A",
      purple: "#7B64B8",
      green: "#1F8A65",
      yellow: "#B8860B",
      cyan: "#2A9D8F",
      pink: "#C45B8A",
      blue: "#3685BF",
      orange: "#C47A2A",
      red: "#CF2D56",
    },
  };
}

const lightTokens = tokensFromPalette(paletteLight);

export type CanvasHostTheme = typeof lightTokens & {
  kind: string;
  tokens: typeof lightTokens;
  palette: typeof paletteLight;
};

const ThemeContext = createContext<CanvasHostTheme>({
  kind: "light",
  ...lightTokens,
  tokens: lightTokens,
  palette: paletteLight,
});

export function useHostTheme(): CanvasHostTheme {
  return useContext(ThemeContext);
}

export function CanvasThemeProvider({ children }: { children: ReactNode }) {
  const theme = useMemo<CanvasHostTheme>(
    () => ({
      kind: "light",
      ...lightTokens,
      tokens: lightTokens,
      palette: paletteLight,
    }),
    [],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

/* ---------- persistent state (localStorage) ---------- */

const STORE_KEY = "crm-atlas-web-state-v1";

/** 内存镜像：同 key 的多个 useCanvasState 必须共享，否则登录 setSession 无法让父组件离开关门页 */
const memoryStore: Record<string, unknown> = (() => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
})();

const storeListeners = new Map<string, Set<() => void>>();

function readStore(): Record<string, unknown> {
  return memoryStore;
}

function writeStore() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(memoryStore));
  } catch {
    /* ignore quota */
  }
}

function subscribeStore(key: string, listener: () => void) {
  let set = storeListeners.get(key);
  if (!set) {
    set = new Set();
    storeListeners.set(key, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
  };
}

function notifyStore(key: string) {
  const set = storeListeners.get(key);
  if (!set) return;
  for (const listener of set) listener();
}

export type SetCanvasState<T> = (action: T | ((prev: T) => T)) => void;

export function useCanvasState<T>(key: string, defaultValue: T): [T, SetCanvasState<T>] {
  const read = (): T => (key in memoryStore ? (memoryStore[key] as T) : defaultValue);
  const [value, setValue] = useState<T>(read);

  useEffect(() => {
    setValue(read());
    return subscribeStore(key, () => {
      setValue(read());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key/defaultValue identity
  }, [key]);

  const setPersistent = useCallback<SetCanvasState<T>>(
    (action) => {
      const prev = read();
      const next = typeof action === "function" ? (action as (p: T) => T)(prev) : action;
      memoryStore[key] = next;
      writeStore();
      // 先更新本组件，再通知同 key 订阅者，避免仅依赖 notify 时偶发不同步
      setValue(next);
      notifyStore(key);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return [value, setPersistent];
}

export function useCanvasAction() {
  return { type: "noop" as const };
}

/* ---------- helpers ---------- */

export function mergeStyle(base: CSSProperties, override?: CSSProperties): CSSProperties {
  return override ? { ...base, ...override } : { ...base };
}

/* ---------- layout ---------- */

export function Stack({
  children,
  gap = 8,
  style,
}: {
  children?: ReactNode;
  gap?: number;
  style?: CSSProperties;
}) {
  return (
    <div style={mergeStyle({ display: "flex", flexDirection: "column", gap }, style)}>
      {children}
    </div>
  );
}

export function Row({
  children,
  gap = 8,
  align = "center",
  justify = "start",
  wrap,
  style,
}: {
  children?: ReactNode;
  gap?: number;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "space-between";
  wrap?: boolean;
  style?: CSSProperties;
}) {
  const alignMap = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" };
  const justifyMap = {
    start: "flex-start",
    center: "center",
    end: "flex-end",
    "space-between": "space-between",
  };
  return (
    <div
      style={mergeStyle(
        {
          display: "flex",
          flexDirection: "row",
          gap,
          alignItems: alignMap[align],
          justifyContent: justifyMap[justify],
          flexWrap: wrap ? "wrap" : "nowrap",
        },
        style,
      )}
    >
      {children}
    </div>
  );
}

export function Grid({
  children,
  columns,
  gap = 8,
  align = "stretch",
  style,
}: {
  children?: ReactNode;
  columns: number | string;
  gap?: number;
  align?: "start" | "center" | "end" | "stretch";
  style?: CSSProperties;
}) {
  const alignMap = { start: "start", center: "center", end: "end", stretch: "stretch" };
  return (
    <div
      style={mergeStyle(
        {
          display: "grid",
          gridTemplateColumns: typeof columns === "number" ? `repeat(${columns}, minmax(0, 1fr))` : columns,
          gap,
          alignItems: alignMap[align],
        },
        style,
      )}
    >
      {children}
    </div>
  );
}

export function Divider({ style }: { style?: CSSProperties }) {
  const t = useHostTheme();
  return (
    <hr
      style={mergeStyle(
        { border: "none", borderTop: `1px solid ${t.stroke.tertiary}`, margin: "8px 0", width: "100%" },
        style,
      )}
    />
  );
}

export function Spacer() {
  return <div style={{ flex: 1 }} />;
}

/* ---------- typography ---------- */

export function Text({
  children,
  tone = "primary",
  size = "body",
  as,
  weight = "normal",
  italic,
  truncate,
  style,
}: {
  children?: ReactNode;
  tone?: "primary" | "secondary" | "tertiary" | "quaternary";
  size?: "body" | "small";
  as?: "p" | "span";
  weight?: "normal" | "medium" | "semibold" | "bold";
  italic?: boolean;
  truncate?: boolean | "start" | "end";
  style?: CSSProperties;
}) {
  const t = useHostTheme();
  const Tag = as ?? "p";
  const weightMap = { normal: 400, medium: 500, semibold: 600, bold: 700 };
  const truncStyle: CSSProperties =
    truncate === true || truncate === "end"
      ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
      : truncate === "start"
        ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", direction: "rtl" }
        : {};
  return (
    <Tag
      style={mergeStyle(
        {
          margin: 0,
          color: t.text[tone],
          fontSize: size === "small" ? 12 : 14,
          lineHeight: size === "small" ? "16px" : "20px",
          fontWeight: weightMap[weight],
          fontStyle: italic ? "italic" : undefined,
          ...truncStyle,
        },
        style,
      )}
    >
      {children}
    </Tag>
  );
}

export function H1({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  const t = useHostTheme();
  return (
    <h1
      style={mergeStyle(
        { margin: 0, fontSize: 24, lineHeight: "30px", fontWeight: 600, color: t.text.primary },
        style,
      )}
    >
      {children}
    </h1>
  );
}

export function H2({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  const t = useHostTheme();
  return (
    <h2
      style={mergeStyle(
        { margin: 0, fontSize: 18, lineHeight: "24px", fontWeight: 600, color: t.text.primary },
        style,
      )}
    >
      {children}
    </h2>
  );
}

export function H3({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  const t = useHostTheme();
  return (
    <h3
      style={mergeStyle(
        { margin: 0, fontSize: 16, lineHeight: "22px", fontWeight: 600, color: t.text.primary },
        style,
      )}
    >
      {children}
    </h3>
  );
}

export function Code({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  const t = useHostTheme();
  return (
    <code
      style={mergeStyle(
        {
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: "0.9em",
          padding: "1px 4px",
          borderRadius: 4,
          background: t.fill.tertiary,
          color: t.text.primary,
        },
        style,
      )}
    >
      {children}
    </code>
  );
}

export function Link({
  children,
  href,
  style,
}: {
  children?: ReactNode;
  href?: string;
  style?: CSSProperties;
}) {
  const t = useHostTheme();
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={mergeStyle({ color: t.text.link, textDecoration: "underline" }, style)}
    >
      {children}
    </a>
  );
}

/* ---------- surfaces ---------- */

export function Card({
  children,
  style,
}: {
  children?: ReactNode;
  style?: CSSProperties;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const t = useHostTheme();
  return (
    <div
      style={mergeStyle(
        {
          border: `1px solid ${t.stroke.tertiary}`,
          borderRadius: 10,
          background: t.bg.elevated,
          overflow: "hidden",
        },
        style,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  trailing,
  style,
}: {
  children?: ReactNode;
  trailing?: ReactNode;
  style?: CSSProperties;
}) {
  const t = useHostTheme();
  return (
    <div
      style={mergeStyle(
        {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "10px 12px",
          borderBottom: `1px solid ${t.stroke.tertiary}`,
          fontWeight: 600,
          color: t.text.primary,
          fontSize: 14,
        },
        style,
      )}
    >
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {trailing}
    </div>
  );
}

export function CardBody({
  children,
  style,
}: {
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return <div style={mergeStyle({ padding: 12 }, style)}>{children}</div>;
}

export function CollapsibleSection({
  title,
  leading,
  count,
  trailing,
  children,
  defaultOpen = false,
  style,
}: {
  title: string;
  leading?: ReactNode;
  count?: number;
  trailing?: ReactNode;
  children?: ReactNode;
  defaultOpen?: boolean;
  style?: CSSProperties;
}) {
  const t = useHostTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={style}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          gap: 8,
          padding: "8px 0",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: t.text.primary,
          textAlign: "left",
        }}
      >
        <span style={{ width: 16, color: t.text.tertiary }}>{open ? "▾" : "▸"}</span>
        {leading}
        <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
        {count != null ? (
          <span style={{ color: t.text.tertiary, fontSize: 12 }}>{count}</span>
        ) : null}
        <span style={{ flex: 1 }} />
        {trailing}
      </button>
      {open ? <div style={{ paddingLeft: 24, paddingBottom: 8 }}>{children}</div> : null}
    </div>
  );
}

/* ---------- actions / feedback ---------- */

export function Button({
  children,
  onClick,
  variant = "secondary",
  disabled,
  style,
  size,
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  style?: CSSProperties;
  size?: "sm" | "md" | string;
}) {
  const t = useHostTheme();
  const styles: Record<string, CSSProperties> = {
    primary: {
      background: t.accent.control,
      color: t.text.onAccent,
      border: "none",
    },
    secondary: {
      background: t.fill.tertiary,
      color: t.text.primary,
      border: `1px solid ${t.stroke.secondary}`,
    },
    ghost: {
      background: "transparent",
      color: t.text.secondary,
      border: "none",
    },
  };
  const compact = size === "sm";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={mergeStyle(
        {
          ...styles[variant],
          height: compact ? "auto" : 28,
          minHeight: compact ? undefined : 28,
          padding: compact ? "0.32em 0.7em" : "0 10px",
          borderRadius: 8,
          fontSize: compact ? "clamp(11px, 0.75vw + 0.4rem, 12.5px)" : 12,
          fontWeight: 500,
          lineHeight: 1.25,
          whiteSpace: "nowrap",
          flexShrink: 0,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        },
        style,
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  onClick,
  disabled,
  style,
  title,
  size,
}: {
  children?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
  title?: string;
  size?: "sm" | "md" | string;
}) {
  const t = useHostTheme();
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={mergeStyle(
        {
          width: 28,
          height: 28,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          border: "none",
          background: "transparent",
          color: t.text.secondary,
          cursor: disabled ? "not-allowed" : "pointer",
        },
        style,
      )}
    >
      {children}
    </button>
  );
}

export function Pill({
  children,
  tone = "neutral",
  size = "md",
  style,
  active,
  onClick,
  leadingContent,
  title,
}: {
  children?: ReactNode;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
  size?: "sm" | "md";
  style?: CSSProperties;
  active?: boolean;
  onClick?: () => void;
  leadingContent?: ReactNode;
  title?: string;
}) {
  const t = useHostTheme();
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      title={title}
      onClick={onClick}
      style={mergeStyle(
        {
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: size === "sm" ? 20 : 24,
          padding: "0 8px",
          borderRadius: 999,
          fontSize: size === "sm" ? 11 : 12,
          whiteSpace: "nowrap",
          flexShrink: 0,
          border: `1px solid ${t.stroke.secondary}`,
          background: active ? t.fill.secondary : t.fill.quaternary,
          color: t.text.secondary,
          cursor: onClick ? "pointer" : "default",
        },
        style,
      )}
    >
      {leadingContent}
      {children}
    </Tag>
  );
}

export function Callout({
  children,
  tone = "info",
  style,
}: {
  children?: ReactNode;
  tone?: "info" | "success" | "warning" | "danger" | "neutral";
  style?: CSSProperties;
}) {
  const t = useHostTheme();
  return (
    <div
      style={mergeStyle(
        {
          padding: 12,
          borderRadius: 10,
          background: t.fill.tertiary,
          border: `1px solid ${t.stroke.tertiary}`,
          color: t.text.secondary,
          fontSize: 13,
          lineHeight: "18px",
        },
        style,
      )}
    >
      {children}
    </div>
  );
}

export function Stat({
  value,
  label,
  tone,
  style,
  size = "default",
}: {
  value?: ReactNode;
  label?: ReactNode;
  tone?: string;
  style?: CSSProperties;
  /** sm：计划冻结 KPI 等紧凑条 */
  size?: "default" | "sm";
}) {
  const t = useHostTheme();
  const toneColor =
    tone === "success"
      ? t.category?.green
      : tone === "danger"
        ? t.category?.red
        : tone === "warning"
          ? t.category?.orange
          : tone === "info"
            ? t.category?.blue
            : undefined;
  const compact = size === "sm";
  return (
    <div
      style={mergeStyle(
        {
          display: "flex",
          flexDirection: "column",
          gap: compact ? 1 : 2,
          minWidth: 0,
          maxWidth: "100%",
        },
        style,
      )}
    >
      <div
        style={{
          fontSize: compact ? 14 : "clamp(15px, 2.6vw, 20px)",
          fontWeight: 600,
          color: toneColor || t.text.primary,
          overflowWrap: "anywhere",
          wordBreak: "break-word",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      {label != null ? (
        <div
          style={{
            fontSize: compact ? 11 : 12,
            color: t.text.tertiary,
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
}

export function UsageBar({
  segments,
  total,
  topLeftLabel,
  topRightLabel,
  style,
}: {
  segments: readonly { id: string; value: number; color?: string }[];
  total: number;
  topLeftLabel?: ReactNode;
  topRightLabel?: ReactNode;
  style?: CSSProperties;
}) {
  const t = useHostTheme();
  const sum = segments.reduce((a, s) => a + Math.max(0, s.value || 0), 0);
  const safeTotal = total > 0 ? total : Math.max(sum, 1);
  const colors = ["#888", "#7B64B8", "#1F8A65", "#E8C030", "#C85898", "#2E79B5", "#F0A040"];
  return (
    <div style={style}>
      {(topLeftLabel || topRightLabel) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 4,
            fontSize: 12,
            color: t.text.tertiary,
          }}
        >
          <span>{topLeftLabel}</span>
          <span>{topRightLabel}</span>
        </div>
      )}
      <div
        style={{
          display: "flex",
          height: 8,
          borderRadius: 4,
          overflow: "hidden",
          background: t.fill.tertiary,
        }}
      >
        {segments.map((s, i) => {
          const w = (Math.max(0, s.value || 0) / safeTotal) * 100;
          if (w <= 0) return null;
          return (
            <div
              key={s.id}
              style={{
                width: `${w}%`,
                background: s.color || colors[i % colors.length],
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ---------- form ---------- */

export function TextInput({
  value,
  onChange,
  onBlur,
  onKeyDown,
  placeholder,
  disabled,
  type = "text",
  style,
}: {
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: "text" | "email" | "password" | "number" | "url" | "search";
  style?: CSSProperties;
}) {
  const t = useHostTheme();
  return (
    <input
      type={type}
      value={value ?? ""}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={() => onBlur?.()}
      onKeyDown={(e) => onKeyDown?.(e)}
      style={mergeStyle(
        {
          height: 28,
          padding: "0 8px",
          borderRadius: 8,
          border: `1px solid ${t.stroke.secondary}`,
          background: t.bg.editor,
          color: t.text.primary,
          fontSize: 12,
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
        },
        style,
      )}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  disabled,
  rows = 3,
  style,
}: {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  style?: CSSProperties;
}) {
  const t = useHostTheme();
  return (
    <textarea
      value={value ?? ""}
      disabled={disabled}
      placeholder={placeholder}
      rows={rows}
      onChange={(e) => onChange?.(e.target.value)}
      style={mergeStyle(
        {
          padding: 8,
          borderRadius: 8,
          border: `1px solid ${t.stroke.secondary}`,
          background: t.bg.editor,
          color: t.text.primary,
          fontSize: 12,
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
          resize: "vertical",
          fontFamily: "inherit",
        },
        style,
      )}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  disabled,
  style,
}: {
  value?: string;
  onChange?: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const t = useHostTheme();
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      style={mergeStyle(
        {
          height: 28,
          padding: "0 8px",
          borderRadius: 8,
          border: `1px solid ${t.stroke.secondary}`,
          background: t.bg.editor,
          color: t.text.primary,
          fontSize: 12,
          outline: "none",
          width: "100%",
        },
        style,
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({
  checked,
  onChange,
  disabled,
  label,
  style,
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <label style={mergeStyle({ display: "inline-flex", alignItems: "center", gap: 6 }, style)}>
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
  style,
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  return (
    <Checkbox checked={checked} onChange={onChange} disabled={disabled} style={style} />
  );
}

export function Table({
  headers,
  rows,
  style,
  emptyMessage,
}: {
  headers: ReactNode[];
  rows: ReactNode[][];
  columnAlign?: Array<"left" | "center" | "right" | undefined>;
  rowTone?: Array<string | undefined>;
  framed?: boolean;
  striped?: boolean;
  stickyHeader?: boolean;
  style?: CSSProperties;
  emptyMessage?: ReactNode;
}) {
  const t = useHostTheme();
  return (
    <div
      style={mergeStyle(
        {
          overflow: "auto",
          border: `1px solid ${t.stroke.tertiary}`,
          borderRadius: 10,
        },
        style,
      )}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  borderBottom: `1px solid ${t.stroke.tertiary}`,
                  color: t.text.secondary,
                  fontWeight: 600,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} style={{ padding: 12, color: t.text.tertiary }}>
                {emptyMessage ?? "暂无数据"}
              </td>
            </tr>
          ) : (
            rows.map((row, ri) => (
              <tr key={ri}>
                {headers.map((_, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: "8px 10px",
                      borderBottom: `1px solid ${t.stroke.tertiary}`,
                      color: t.text.primary,
                      verticalAlign: "top",
                    }}
                  >
                    {row[ci] ?? null}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- chart stubs (browser) ---------- */

export type Color =
  | "gray"
  | "purple"
  | "green"
  | "yellow"
  | "cyan"
  | "pink"
  | "blue"
  | "orange"
  | "red";

export type ChartTone = Color;

export const usageColorSequence: Color[] = [
  "blue",
  "green",
  "orange",
  "purple",
  "cyan",
  "pink",
  "yellow",
  "red",
  "gray",
];

type ChartSeries = {
  name: string;
  data: number[];
  tone?: ChartTone;
  color?: Color;
};

function chartSeriesColor(
  theme: CanvasHostTheme,
  s: ChartSeries,
  i: number,
): string {
  const key = (s.color || s.tone || usageColorSequence[i % usageColorSequence.length]) as Color;
  return theme.category[key] || theme.category.blue;
}

export function Swatch({
  color,
  style,
}: {
  color?: Color;
  style?: CSSProperties;
}) {
  const t = useHostTheme();
  const fill = color ? t.category[color] : t.category.blue;
  return (
    <span
      style={mergeStyle(
        {
          width: 10,
          height: 10,
          borderRadius: 2,
          background: fill,
          display: "inline-block",
          flexShrink: 0,
          border: `1px solid ${t.stroke.secondary}`,
        },
        style,
      )}
    />
  );
}

export function BarChart({
  categories = [],
  series = [],
  height = 220,
  beginAtZero = true,
  yMax,
}: {
  categories?: string[];
  series?: ChartSeries[];
  height?: number;
  beginAtZero?: boolean;
  yMax?: number;
}) {
  const t = useHostTheme();
  const n = categories.length;
  if (!n || !series.length) return null;
  const allVals = series.flatMap((s) => s.data);
  const maxV = Math.max(
    yMax ?? 0,
    beginAtZero ? 0 : Math.min(...allVals, 0),
    ...allVals,
    1e-6,
  );
  const minV = beginAtZero ? 0 : Math.min(0, ...allVals);
  const span = Math.max(1e-6, maxV - minV);
  const w = Math.max(280, n * 36);
  const pad = { t: 12, r: 12, b: 28, l: 40 };
  const plotH = height - pad.t - pad.b;
  const plotW = w - pad.l - pad.r;
  const groupW = plotW / n;
  const barW = Math.max(4, (groupW * 0.7) / Math.max(1, series.length));
  const yOf = (v: number) => pad.t + plotH - ((v - minV) / span) * plotH;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} style={{ display: "block", maxHeight: height }}>
      {[0, 0.5, 1].map((f) => {
        const v = minV + span * f;
        const y = yOf(v);
        return (
          <g key={f}>
            <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke={t.stroke.tertiary} strokeWidth={1} />
            <text x={pad.l - 4} y={y + 3} textAnchor="end" fill={t.text.tertiary} fontSize={10}>
              {Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v * 10) / 10}
            </text>
          </g>
        );
      })}
      {categories.map((cat, ci) => {
        const gx = pad.l + ci * groupW + groupW / 2;
        return (
          <g key={`${cat}-${ci}`}>
            {series.map((s, si) => {
              const v = s.data[ci] || 0;
              const y0 = yOf(0);
              const y1 = yOf(v);
              const top = Math.min(y0, y1);
              const h = Math.max(1, Math.abs(y1 - y0));
              const x = gx - (series.length * barW) / 2 + si * barW;
              return (
                <rect
                  key={s.name}
                  x={x}
                  y={top}
                  width={barW - 1}
                  height={h}
                  fill={chartSeriesColor(t, s, si)}
                >
                  <title>{`${cat} · ${s.name}: ${v}`}</title>
                </rect>
              );
            })}
            <text x={gx} y={height - 8} textAnchor="middle" fill={t.text.tertiary} fontSize={9}>
              {cat.length > 6 ? `${cat.slice(0, 5)}…` : cat}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({
  categories = [],
  series = [],
  height = 220,
}: {
  categories?: string[];
  series?: ChartSeries[];
  height?: number;
}) {
  const t = useHostTheme();
  const n = categories.length;
  if (!n || !series.length) return null;
  const allVals = series.flatMap((s) => s.data.filter((x) => Number.isFinite(x)));
  const maxV = Math.max(...allVals, 1e-6);
  const minV = Math.min(0, ...allVals);
  const span = Math.max(1e-6, maxV - minV);
  const w = Math.max(320, n * 18);
  const pad = { t: 12, r: 12, b: 28, l: 44 };
  const plotH = height - pad.t - pad.b;
  const plotW = w - pad.l - pad.r;
  const xOf = (i: number) => pad.l + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yOf = (v: number) => pad.t + plotH - ((v - minV) / span) * plotH;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} style={{ display: "block", maxHeight: height }}>
      {[0, 0.5, 1].map((f) => {
        const v = minV + span * f;
        const y = yOf(v);
        return (
          <g key={f}>
            <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke={t.stroke.tertiary} strokeWidth={1} />
            <text x={pad.l - 4} y={y + 3} textAnchor="end" fill={t.text.tertiary} fontSize={10}>
              {Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v * 10) / 10}
            </text>
          </g>
        );
      })}
      {series.map((s, si) => {
        const pts = s.data
          .map((v, i) => `${xOf(i)},${yOf(Number.isFinite(v) ? v : 0)}`)
          .join(" ");
        return (
          <polyline
            key={s.name}
            fill="none"
            stroke={chartSeriesColor(t, s, si)}
            strokeWidth={2}
            points={pts}
          >
            <title>{s.name}</title>
          </polyline>
        );
      })}
      {categories.map((cat, i) =>
        i % Math.max(1, Math.ceil(n / 8)) === 0 || i === n - 1 ? (
          <text
            key={`${cat}-${i}`}
            x={xOf(i)}
            y={height - 8}
            textAnchor="middle"
            fill={t.text.tertiary}
            fontSize={9}
          >
            {cat}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export function PieChart() {
  return null;
}
export function TodoList() {
  return null;
}
export function TodoListCard() {
  return null;
}
export function DiffView() {
  return null;
}
export function DiffStats() {
  return null;
}
export function computeDAGLayout() {
  return { nodes: [], edges: [] };
}
export const canvasPaletteLight = paletteLight;
export const canvasPaletteDark = paletteLight;
export const canvasTokens = lightTokens;
export const canvasTokensLight = lightTokens;
