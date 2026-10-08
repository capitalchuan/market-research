/**
 * Browser shim for `cursor/canvas` so the Atlas canvas can run as a website.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

/* ---------- theme ---------- */

/** 对齐 chuanx.xyz：奶油底、藏青字、暖沙描边 */
const paletteLight = {
  foreground: "#232946",
  foregroundSecondary: "#404A68",
  foregroundTertiary: "#4A5073",
  foregroundQuaternary: "#8E97BE",
  editor: "#FEF1ED",
  chrome: "#FBF1EE",
  sidebar: "#F5EAE5",
  elevated: "#FFF9F7",
  fillPrimary: "#23294633",
  fillSecondary: "#2329461A",
  fillTertiary: "#23294612",
  fillQuaternary: "#2329460A",
  strokePrimary: "#23294633",
  strokeSecondary: "#D9C8C1",
  strokeTertiary: "#E4D4CF",
  strokeFocused: "#232946",
  accent: "#232946",
  buttonBackground: "#232946",
  buttonForeground: "#FEF1ED",
  buttonHoverBackground: "#404A68",
  link: "#404A68",
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
    },
    diff: {
      insertedLine: p.diffInsertedLine,
      removedLine: p.diffRemovedLine,
      stripAdded: p.diffStripAdded,
      stripRemoved: p.diffStripRemoved,
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
}: {
  children?: ReactNode;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
  size?: "sm" | "md";
  style?: CSSProperties;
  active?: boolean;
  onClick?: () => void;
}) {
  const t = useHostTheme();
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={mergeStyle(
        {
          display: "inline-flex",
          alignItems: "center",
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
}: {
  value?: ReactNode;
  label?: ReactNode;
  tone?: string;
  style?: CSSProperties;
}) {
  const t = useHostTheme();
  return (
    <div style={mergeStyle({ display: "flex", flexDirection: "column", gap: 2 }, style)}>
      <div style={{ fontSize: 20, fontWeight: 600, color: t.text.primary }}>{value}</div>
      {label != null ? (
        <div style={{ fontSize: 12, color: t.text.tertiary }}>{label}</div>
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
  placeholder,
  disabled,
  type = "text",
  style,
}: {
  value?: string;
  onChange?: (value: string) => void;
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

/* stubs for unused exports */
export function BarChart() {
  return null;
}
export function LineChart() {
  return null;
}
export function PieChart() {
  return null;
}
export function Swatch() {
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
