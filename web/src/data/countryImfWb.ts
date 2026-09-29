import raw from "./country-imf-wb.json";

export type ImfDevTag = "advanced" | "emerging";
export type WbIncomeId = "high" | "upper_middle" | "lower_middle" | "low" | "unknown";

export type CountryImfWbRow = {
  imfDevTag: ImfDevTag;
  imfDevTagZh: string;
  wbIncome: WbIncomeId;
  wbIncomeZh: string;
  wbIncomeEn?: string | null;
  iso3?: string | null;
};

export type CountryImfWbDataset = {
  asOf: string;
  note: string;
  imfOptions: { id: string; labelZh: string; labelEn?: string }[];
  wbOptions: { id: string; labelZh: string; labelEn?: string }[];
  byCode: Record<string, CountryImfWbRow>;
};

export const COUNTRY_IMF_WB = raw as CountryImfWbDataset;

export function getCountryImfWb(code: string): CountryImfWbRow | undefined {
  return COUNTRY_IMF_WB.byCode[code];
}

export function passesImfWbFilters(
  code: string,
  imfId: string,
  wbId: string,
): boolean {
  const row = COUNTRY_IMF_WB.byCode[code];
  if (!row) return imfId === "all" && wbId === "all";
  if (imfId !== "all" && row.imfDevTag !== imfId) return false;
  if (wbId !== "all" && row.wbIncome !== wbId) return false;
  return true;
}
