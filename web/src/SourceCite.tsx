import type { CSSProperties, ReactNode } from "react";
import { Link, useCanvasState, useHostTheme } from "cursor/canvas";
import { detectBrowserUiLang } from "./uiI18n";
import { canViewSourceCite } from "./authAccess";
import type { GuestAccessProfile } from "./data/guestRegistration";
import {
  SOURCE_CITE_RE,
  citeMark,
  getSourceCitation,
  parseCiteNos,
  sourceCiteKindLabel,
} from "./data/sourceCitations";
import { GlossedText } from "./GlossedText";

const HUB_RETURN_LABEL: Record<string, string> = {
  home: "总览",
  scenes: "线上数字经济",
  macro: "国别宏观",
  compare: "对照",
  sources: "信源",
};

const HUB_RETURN_LABEL_EN: Record<string, string> = {
  home: "Overview",
  scenes: "Digital economy",
  macro: "Country macro",
  compare: "Compare",
  sources: "Sources",
};

function useCanCite() {
  const [session] = useCanvasState("authSession1", "");
  const [guestAccess] = useCanvasState<GuestAccessProfile | null>("guestAccess1", null);
  return canViewSourceCite(session, guestAccess);
}

/** 去掉正文中的 〔n〕 标记（访客展示用） */
function stripCiteMarks(text: string): string {
  return text.replace(new RegExp(SOURCE_CITE_RE.source, "g"), "").replace(/\s{2,}/g, " ").trim();
}

/** 点 〔n〕 / 本卡信源：记下当前 hub 再进信源，便于回退 */
export function useGoToSourceCite() {
  const [hub, setHub] = useCanvasState<string>("hub7", "home");
  const [, setFocus] = useCanvasState<string>("sourceCiteFocus", "");
  const [, setReturnHub] = useCanvasState<string>("sourceCiteReturnHub", "");
  const canCite = useCanCite();

  return (no: number) => {
    if (!canCite) return;
    if (hub && hub !== "sources") {
      setReturnHub(hub);
    }
    setFocus(String(no));
    setHub("sources");
  };
}

export function useSourceCiteReturn() {
  const [, setHub] = useCanvasState<string>("hub7", "home");
  const [returnHub, setReturnHub] = useCanvasState<string>("sourceCiteReturnHub", "");
  const [, setFocus] = useCanvasState<string>("sourceCiteFocus", "");
  const [uiLang] = useCanvasState<"zh" | "en">("uiLang1", detectBrowserUiLang());

  const labelMap = uiLang === "en" ? HUB_RETURN_LABEL_EN : HUB_RETURN_LABEL;
  const label = returnHub
    ? labelMap[returnHub] || (returnHub.length <= 16 ? returnHub : uiLang === "en" ? "Previous" : "上一页")
    : labelMap.home;

  const goBack = () => {
    const target = returnHub && returnHub !== "sources" ? returnHub : "home";
    setHub(target);
    setReturnHub("");
    setFocus("");
  };

  return {
    returnHub,
    label,
    goBack,
    hasReturn: Boolean(returnHub && returnHub !== "sources"),
  };
}

/** 正文中的 〔12〕 可点，跳转信源编号目录；访客去掉编号、不可点 */
export function CitedText({
  text,
  size = "small",
  tone,
  dense,
}: {
  text: string;
  size?: "small" | "normal";
  tone?: "primary" | "secondary" | "tertiary";
  dense?: boolean;
}) {
  const theme = useHostTheme();
  const goCite = useGoToSourceCite();
  const canCite = useCanCite();
  const [uiLang] = useCanvasState<"zh" | "en">("uiLang1", detectBrowserUiLang());
  if (!text) return null;
  const color =
    tone === "tertiary" ? theme.text.tertiary : tone === "secondary" ? theme.text.secondary : theme.text.primary;
  const fontSize = dense ? 11 : size === "small" ? 12 : 14;

  if (!canCite) {
    const plain = stripCiteMarks(text) || text;
    return (
      <span style={{ fontSize, lineHeight: 1.5, color }}>
        <GlossedText text={plain} />
      </span>
    );
  }

  const parts: Array<string | number> = [];
  let last = 0;
  const re = new RegExp(SOURCE_CITE_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(Number(m[1] || m[2]));
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  if (parts.length === 1 && typeof parts[0] === "string" && !parseCiteNos(text).length) {
    return (
      <span style={{ fontSize, lineHeight: 1.5, color }}>
        <GlossedText text={text} />
      </span>
    );
  }
  return (
    <span style={{ fontSize, lineHeight: 1.5, color }}>
      {parts.map((p, i) =>
        typeof p === "number" ? (
          <button
            key={`c-${i}-${p}`}
            type="button"
            title={getSourceCitation(p)?.title || (uiLang === "en" ? `Source ${p}` : `信源 ${p}`)}
            onClick={() => goCite(p)}
            style={{
              display: "inline",
              padding: dense ? "0 1px" : "0 2px",
              margin: "0 1px",
              border: `1px solid ${theme.stroke.tertiary}`,
              borderRadius: 4,
              background: theme.fill.quaternary,
              color: theme.text.secondary,
              font: "inherit",
              fontSize: dense ? 10 : 11,
              cursor: "pointer",
              verticalAlign: "baseline",
            }}
          >
            {citeMark(p)}
          </button>
        ) : (
          <GlossedText key={`t-${i}`} text={p} />
        ),
      )}
    </span>
  );
}

/** 时点 + 可选兜底说明 */
export function MacroAsOfLine({
  asOf,
  fromSnap,
  dense,
}: {
  asOf?: string;
  fromSnap?: boolean;
  dense?: boolean;
}) {
  const theme = useHostTheme();
  const [uiLang] = useCanvasState<"zh" | "en">("uiLang1", detectBrowserUiLang());
  const en = uiLang === "en";
  if (!asOf) {
    return (
      <div style={{ fontSize: dense ? 10 : 11, color: theme.text.tertiary, marginTop: 2 }}>
        {en ? "As-of pending" : "时点待核"}
      </div>
    );
  }
  return (
    <div style={{ fontSize: dense ? 10 : 11, color: theme.text.tertiary, marginTop: 2 }}>
      {en ? "As of" : "时点"} {asOf}
      {fromSnap ? (en ? " · snapshot pack" : " · 对照包") : ""}
    </div>
  );
}

/** 宏观卡底部：本卡用到的信源编号，点号进统一目录；访客不展示 */
export function MacroSourcesBlock({
  citeNos,
  dense,
  title,
  style,
}: {
  citeNos: number[];
  dense?: boolean;
  title?: string;
  style?: CSSProperties;
}) {
  const theme = useHostTheme();
  const goCite = useGoToSourceCite();
  const canCite = useCanCite();
  const [uiLang] = useCanvasState<"zh" | "en">("uiLang1", detectBrowserUiLang());
  const en = uiLang === "en";
  const heading = title ?? (en ? "Card sources" : "本卡信源");
  if (!canCite || !citeNos.length) return null;
  return (
    <div
      style={{
        marginTop: dense ? 8 : 12,
        paddingTop: dense ? 6 : 10,
        borderTop: `1px solid ${theme.stroke.tertiary}`,
        ...style,
      }}
    >
      <div
        style={{
          fontSize: dense ? 10 : 11,
          fontWeight: 600,
          color: theme.text.tertiary,
          marginBottom: dense ? 4 : 6,
        }}
      >
        {heading}
        <span style={{ fontWeight: 400 }}>
          {en ? " · tap IDs for index" : " · 点编号进目录"}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: dense ? 4 : 6 }}>
        {citeNos.map((n) => {
          const c = getSourceCitation(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => goCite(n)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                margin: 0,
                padding: dense ? "4px 6px" : "6px 8px",
                border: `1px solid ${theme.stroke.tertiary}`,
                borderRadius: 6,
                background: theme.bg.elevated,
                cursor: "pointer",
                textAlign: "left",
                font: "inherit",
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  fontSize: dense ? 10 : 11,
                  fontWeight: 700,
                  color: theme.text.secondary,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {citeMark(n)}
              </span>
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: dense ? 11 : 12,
                    color: theme.text.primary,
                    lineHeight: 1.35,
                  }}
                >
                  {c?.title || (en ? `Source ${n}` : `信源 ${n}`)}
                </span>
                <span style={{ fontSize: dense ? 9 : 10, color: theme.text.tertiary }}>
                  {[c ? sourceCiteKindLabel(c.kind) : null, c?.asOf, c?.note].filter(Boolean).join(" · ")}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 地图 KV：读数 + 时点行；value 内 〔n〕可点 */
export function MapMacroKV({
  k,
  v,
  asOf,
  asOfFromSnap,
  dense = false,
}: {
  k: string;
  v: string;
  asOf?: string;
  asOfFromSnap?: boolean;
  dense?: boolean;
}) {
  const theme = useHostTheme();
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        fontSize: dense ? 12 : 13,
        lineHeight: 1.55,
        marginBottom: dense ? 4 : 6,
      }}
    >
      <span style={{ color: theme.text.tertiary, minWidth: dense ? 88 : 96, flexShrink: 0 }}>{k}</span>
      <span style={{ color: theme.text.primary, wordBreak: "break-word", minWidth: 0 }}>
        <CitedText text={v} size="small" dense={dense} />
        <MacroAsOfLine asOf={asOf} fromSnap={asOfFromSnap} dense={dense} />
      </span>
    </div>
  );
}

export function MacroSourcesLinkHint({ children }: { children?: ReactNode }) {
  const canCite = useCanCite();
  const [uiLang] = useCanvasState<"zh" | "en">("uiLang1", detectBrowserUiLang());
  if (!canCite) {
    return children ? <span>{children}</span> : null;
  }
  return (
    <span>
      {children}
      {children ? " · " : null}
      <Link href="#cite-1">{uiLang === "en" ? "Source index" : "信源目录"}</Link>
    </span>
  );
}
