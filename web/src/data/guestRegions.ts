/** 访客注册可选国家/地区（与 Atlas 展业国池对齐，中英标签） */

import type { UiLang } from "../uiI18n";

export type GuestRegionCode =
  | "CN"
  | "HK"
  | "MO"
  | "TW"
  | "JP"
  | "KR"
  | "MN"
  | "ID"
  | "VN"
  | "MY"
  | "TH"
  | "PH"
  | "SG"
  | "IN"
  | "BD"
  | "PK"
  | "LK"
  | "KZ"
  | "UZ"
  | "MX"
  | "BR"
  | "CO"
  | "AR"
  | "PE"
  | "CL"
  | "EG"
  | "SA"
  | "AE"
  | "NG"
  | "KE"
  | "GH"
  | "ZA"
  | "US"
  | "CA"
  | "GB"
  | "DE"
  | "FR"
  | "NL"
  | "ES"
  | "PT"
  | "IT"
  | "SE"
  | "PL"
  | "IE"
  | "RU"
  | "AU"
  | "NZ"
  | "OTHER";

const ZH: Record<GuestRegionCode, string> = {
  CN: "中国大陆",
  HK: "中国香港",
  MO: "中国澳门",
  TW: "中国台湾",
  JP: "日本",
  KR: "韩国",
  MN: "蒙古",
  ID: "印度尼西亚",
  VN: "越南",
  MY: "马来西亚",
  TH: "泰国",
  PH: "菲律宾",
  SG: "新加坡",
  IN: "印度",
  BD: "孟加拉",
  PK: "巴基斯坦",
  LK: "斯里兰卡",
  KZ: "哈萨克斯坦",
  UZ: "乌兹别克斯坦",
  MX: "墨西哥",
  BR: "巴西",
  CO: "哥伦比亚",
  AR: "阿根廷",
  PE: "秘鲁",
  CL: "智利",
  EG: "埃及",
  SA: "沙特",
  AE: "阿联酋",
  NG: "尼日利亚",
  KE: "肯尼亚",
  GH: "加纳",
  ZA: "南非",
  US: "美国",
  CA: "加拿大",
  GB: "英国",
  DE: "德国",
  FR: "法国",
  NL: "荷兰",
  ES: "西班牙",
  PT: "葡萄牙",
  IT: "意大利",
  SE: "瑞典",
  PL: "波兰",
  IE: "爱尔兰",
  RU: "俄罗斯",
  AU: "澳大利亚",
  NZ: "新西兰",
  OTHER: "其他 / 未列出",
};

const EN_FALLBACK: Record<GuestRegionCode, string> = {
  CN: "China (Mainland)",
  HK: "Hong Kong SAR",
  MO: "Macao SAR",
  TW: "Taiwan",
  JP: "Japan",
  KR: "South Korea",
  MN: "Mongolia",
  ID: "Indonesia",
  VN: "Vietnam",
  MY: "Malaysia",
  TH: "Thailand",
  PH: "Philippines",
  SG: "Singapore",
  IN: "India",
  BD: "Bangladesh",
  PK: "Pakistan",
  LK: "Sri Lanka",
  KZ: "Kazakhstan",
  UZ: "Uzbekistan",
  MX: "Mexico",
  BR: "Brazil",
  CO: "Colombia",
  AR: "Argentina",
  PE: "Peru",
  CL: "Chile",
  EG: "Egypt",
  SA: "Saudi Arabia",
  AE: "United Arab Emirates",
  NG: "Nigeria",
  KE: "Kenya",
  GH: "Ghana",
  ZA: "South Africa",
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  ES: "Spain",
  PT: "Portugal",
  IT: "Italy",
  SE: "Sweden",
  PL: "Poland",
  IE: "Ireland",
  RU: "Russia",
  AU: "Australia",
  NZ: "New Zealand",
  OTHER: "Other / Not listed",
};

export const GUEST_REGION_CODES = Object.keys(ZH) as GuestRegionCode[];

export function guestRegionLabel(code: string, lang: UiLang): string {
  const key = code as GuestRegionCode;
  if (!(key in ZH)) return code || (lang === "zh" ? "未选择" : "Not selected");
  if (lang === "zh") return ZH[key];
  try {
    if (key !== "OTHER" && key.length === 2) {
      const intl = new Intl.DisplayNames(["en"], { type: "region" });
      const name = intl.of(key);
      if (name) return name;
    }
  } catch {
    /* ignore */
  }
  return EN_FALLBACK[key];
}

export function guestRegionSelectOptions(lang: UiLang): { value: string; label: string }[] {
  return [
    { value: "", label: lang === "zh" ? "请选择国家或地区" : "Select country or region" },
    ...GUEST_REGION_CODES.map((code) => ({
      value: code,
      label: guestRegionLabel(code, lang),
    })),
  ];
}
