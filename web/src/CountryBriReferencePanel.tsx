import { Link, Stack, Text, useHostTheme } from "./shims/cursor-canvas";
import { citeMark } from "./data/sourceCitations";
import {
  BRI_META,
  briCountryProfileUrl,
  getCountryBriReference,
  hasBriReference,
  type BriSeriesRow,
} from "./data/countryBriReference";
import { CitedText } from "./SourceCite";
import type { UiLang } from "./uiI18n";

function seriesLabel(s: BriSeriesRow, lang: UiLang): string {
  return lang === "en" ? s.labelEn : s.labelZh;
}

function seriesUnit(s: BriSeriesRow, lang: UiLang): string {
  return lang === "en" ? s.unitEn : s.unitZh;
}

function latestYears(values: Record<string, number>, n = 3): string[] {
  return Object.keys(values)
    .sort()
    .slice(-n);
}

function formatValue(v: number, unit: string, lang: UiLang): string {
  const en = lang === "en";
  if (unit === "%" || unit === "%") return `${v}${en ? "%" : "%"}`;
  if (v >= 1000000) return en ? `${(v / 10000).toFixed(2)} bn` : `${(v / 10000).toFixed(2)}亿`;
  if (v >= 10000) return en ? `${(v / 1000).toFixed(1)} bn` : `${(v / 1000).toFixed(1)}千亿`;
  return en ? `${v.toLocaleString()}` : `${v.toLocaleString()}万`;
}

export function CountryBriReferencePanel({
  code,
  countryLabel,
  uiLang,
  dense = false,
}: {
  code: string;
  countryLabel: string;
  uiLang: UiLang;
  dense?: boolean;
}) {
  if (!hasBriReference(code)) return null;
  const theme = useHostTheme();
  const en = uiLang === "en";
  const entry = getCountryBriReference(code);
  const profileUrl = briCountryProfileUrl(code);
  const cite = citeMark(BRI_META.citeNo);

  const bilateral = entry
    ? en
      ? entry.bilateralEn || entry.bilateralZh
      : entry.bilateralZh || entry.bilateralEn
    : undefined;

  const capital = entry
    ? en
      ? entry.capitalEn || entry.capitalZh
      : entry.capitalZh || entry.capitalEn
    : undefined;

  const pillars = entry
    ? en
      ? entry.pillarsEn || entry.pillarsZh
      : entry.pillarsZh || entry.pillarsEn
    : undefined;

  return (
    <div
      style={{
        marginTop: dense ? 6 : 10,
        padding: dense ? "8px 10px" : "10px 12px",
        borderRadius: 8,
        border: `1px solid ${theme.stroke.tertiary}`,
        background: theme.fill.quaternary,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: theme.text.secondary, marginBottom: 6 }}>
        {en ? "BRI reference" : "一带一路参考"}
        <CitedText text={` ${cite}`} size="small" dense />
      </div>
      {capital ? (
        <Text size="small" tone="tertiary">
          {en ? "Capital" : "首都"} · {capital}
        </Text>
      ) : null}
      {entry?.gdpUsdM ? (
        <Text size="small" tone="tertiary">
          {en ? "GDP" : "GDP"} · {entry.gdpUsdM.value.toLocaleString()} {en ? "m USD" : "百万美元"}（
          {entry.gdpUsdM.year}）
        </Text>
      ) : null}
      {pillars?.length ? (
        <Text size="small" tone="tertiary">
          {en ? "Pillars" : "支柱产业"} · {pillars.join(en ? ", " : "、")}
        </Text>
      ) : null}
      {bilateral ? (
        <div style={{ fontSize: 12, lineHeight: 1.45, color: theme.text.secondary, marginTop: 6 }}>
          {bilateral}
        </div>
      ) : null}
      {entry?.series?.length && !dense ? (
        <Stack gap={6} style={{ marginTop: 8 }}>
          {entry.series.map((s) => {
            const years = latestYears(s.values);
            const note = en ? s.noteEn || s.noteZh : s.noteZh || s.noteEn;
            return (
              <div key={s.id}>
                <div style={{ fontSize: 11, color: theme.text.tertiary, marginBottom: 2 }}>
                  {seriesLabel(s, uiLang)}（{seriesUnit(s, uiLang)}）
                </div>
                <div style={{ fontSize: 12, color: theme.text.primary }}>
                  {years
                    .map((y) => `${y}: ${formatValue(s.values[y]!, seriesUnit(s, uiLang), uiLang)}`)
                    .join(en ? " · " : " · ")}
                </div>
                {note ? (
                  <div style={{ fontSize: 10, color: theme.text.tertiary, marginTop: 2 }}>{note}</div>
                ) : null}
              </div>
            );
          })}
        </Stack>
      ) : null}
      <Stack gap={4} style={{ marginTop: 8 }}>
        {profileUrl ? (
          <Text size="small" tone="tertiary">
            <Link href={profileUrl}>
              {en ? `BRI portal · ${countryLabel}` : `一带一路网 · ${countryLabel}国别`}
            </Link>
          </Text>
        ) : entry?.noProfile ? (
          <Text size="small" tone="tertiary">
            {en ? "No country profile URL — use data chart below." : "暂无国别页直链，请用下方「各国数据」检索。"}
          </Text>
        ) : null}
        <Text size="small" tone="tertiary">
          <Link href={BRI_META.dataChartUrl}>
            {en ? "BRI data chart · China trade series" : "各国数据图说 · 对华进出口等指标"}
          </Link>
        </Text>
      </Stack>
      <Text size="small" tone="tertiary" style={{ marginTop: 6 }}>
        {en ? "As of" : "对照"} · {BRI_META.asOf}
        {en ? " · portal reference, not loan underwriting" : " · 门户参考，不作放款依据"}
      </Text>
    </div>
  );
}
