import type { CSSProperties, ElementType } from "react";
import { splitGlossParts } from "./data/financeAbbrGlossary";
import { en } from "./enSurface";

/** 英文缩写 / 固定称谓：悬停显示中文释义；生僻缩写可展开为全称（如 TE→Trading Economics） */
export function GlossedText({
  text,
  as: Tag = "span",
  style,
}: {
  text: string;
  as?: ElementType;
  style?: CSSProperties;
}) {
  if (!text) return null;
  const parts = splitGlossParts(en(text));
  return (
    <Tag style={style}>
      {parts.map((p, i) => {
        const next = parts[i + 1]?.text || "";
        let shown = p.display || p.text;
        // 「Trading Economics」紧贴中文国名时加间隔点，避免黏成 Trading Economics印尼
        if (p.display && p.text === "TE" && /^[\u4e00-\u9fff]/.test(next)) {
          shown = `${p.display}·`;
        }
        if (p.gloss) {
          return (
            <span
              key={`${i}-${p.text}`}
              title={p.gloss}
              style={{
                borderBottom: "1px dotted currentColor",
                cursor: "help",
              }}
            >
              {shown}
            </span>
          );
        }
        return <span key={`${i}-${p.text.slice(0, 24)}`}>{shown}</span>;
      })}
    </Tag>
  );
}
