import type { UiLang } from "../uiI18n";

/**
 * 国别语言区（现金贷/平台金融展业粗分）。
 * zone = 业务语言区；languages = 官方/通行语；productHint = 产品文案/催收常用语提示。
 */
export type CountryLanguageInfo = {
  /** 语言区（展业粗分，可跨国同区） */
  zone: string;
  /** 官方/通行语言 */
  languages: string;
  /** 产品/客服常用语提示（可选） */
  productHint?: string;
};

/** 语言区中文 → EN（筛选芯片与地图细标共用） */
const ZONE_EN: Record<string, string> = {
  汉语区: "Chinese-speaking",
  "汉语/英语区": "Chinese / English",
  "汉语/葡语区": "Chinese / Portuguese",
  日语区: "Japanese-speaking",
  韩语区: "Korean-speaking",
  蒙古语区: "Mongolian-speaking",
  印尼语区: "Indonesian-speaking",
  越南语区: "Vietnamese-speaking",
  "马来语/英语区": "Malay / English",
  泰语区: "Thai-speaking",
  "他加禄/英语区": "Tagalog / English",
  "英语/多语区": "English / multilingual",
  "印地语/英语区": "Hindi / English",
  孟加拉语区: "Bengali-speaking",
  "乌尔都语/英语区": "Urdu / English",
  "僧伽罗/泰米尔区": "Sinhala / Tamil",
  "突厥语/俄语区": "Turkic / Russian",
  "波斯语族/俄语区": "Persianate / Russian",
  突厥语区: "Turkic-speaking",
  西语区: "Spanish-speaking",
  葡语区: "Portuguese-speaking",
  阿语区: "Arabic-speaking",
  "阿语/法语区": "Arabic / French",
  "阿语/英语区": "Arabic / English",
  希伯来语区: "Hebrew-speaking",
  土耳其语区: "Turkish-speaking",
  波斯语区: "Persian-speaking",
  英语区: "English-speaking",
  "斯瓦希里/英语区": "Swahili / English",
  "英语/法语区": "English / French",
  阿姆哈拉语区: "Amharic-speaking",
  法语区: "French-speaking",
  "法语/英语区": "French / English",
  "马达加斯加语/法语区": "Malagasy / French",
  "德语区": "German-speaking",
  荷兰语区: "Dutch-speaking",
  意大利语区: "Italian-speaking",
  瑞典语区: "Swedish-speaking",
  波兰语区: "Polish-speaking",
  俄语区: "Russian-speaking",
};

const LANG_LINE_PHRASE_EN: readonly [string, string][] = [
  ["简体中文（官方）", "Simplified Chinese (official)"],
  ["繁体中文（官方）", "Traditional Chinese (official)"],
  ["繁体中文、英语（官方）", "Traditional Chinese, English (official)"],
  ["繁体中文、葡萄牙语（官方）", "Traditional Chinese, Portuguese (official)"],
  ["日语（官方）", "Japanese (official)"],
  ["韩语（官方）", "Korean (official)"],
  ["蒙古语（官方）；俄语通行", "Mongolian (official); Russian widely used"],
  ["印尼语（官方）；英语商务", "Indonesian (official); English in business"],
  ["越南语（官方）", "Vietnamese (official)"],
  ["马来语、英语（官方）；华语通行", "Malay, English (official); Chinese widely used"],
  ["泰语（官方）", "Thai (official)"],
  ["菲律宾语、英语（官方）", "Filipino, English (official)"],
  ["英语、马来语、华语、泰米尔语（官方）", "English, Malay, Chinese, Tamil (official)"],
  ["印地语、英语（联邦）；多邦官方语", "Hindi, English (federal); state languages"],
  ["孟加拉语（官方）；英语商务", "Bengali (official); English in business"],
  ["乌尔都语、英语（官方）", "Urdu, English (official)"],
  ["僧伽罗语、泰米尔语（官方）；英语通行", "Sinhala, Tamil (official); English widely used"],
  ["哈萨克语、俄语（官方）", "Kazakh, Russian (official)"],
  ["乌兹别克语（官方）；俄语通行", "Uzbek (official); Russian widely used"],
  ["吉尔吉斯语、俄语（官方）", "Kyrgyz, Russian (official)"],
  ["塔吉克语（官方）；俄语通行", "Tajik (official); Russian widely used"],
  ["土库曼语（官方）；俄语通行", "Turkmen (official); Russian widely used"],
  ["西班牙语（官方）", "Spanish (official)"],
  ["葡萄牙语（官方）", "Portuguese (official)"],
  ["西班牙语、克丘亚语等（官方）", "Spanish, Quechua etc. (official)"],
  ["阿拉伯语（官方）；英语商务", "Arabic (official); English in business"],
  ["阿拉伯语、柏柏尔语（官方）；法语通行", "Arabic, Berber (official); French widely used"],
  ["阿拉伯语（官方）；法语通行", "Arabic (official); French widely used"],
  ["阿拉伯语（官方）", "Arabic (official)"],
  ["阿拉伯语、英语（官方）", "Arabic, English (official)"],
  ["阿拉伯语（官方）；英语商务通行", "Arabic (official); English in business"],
  ["阿拉伯语（官方）；英语通行", "Arabic (official); English widely used"],
  ["阿拉伯语（官方）；法语、英语通行", "Arabic (official); French & English widely used"],
  ["阿拉伯语、库尔德语（官方）", "Arabic, Kurdish (official)"],
  ["希伯来语（官方）；阿拉伯语、英语通行", "Hebrew (official); Arabic & English widely used"],
  ["土耳其语（官方）", "Turkish (official)"],
  ["波斯语（官方）", "Persian (official)"],
  ["英语（官方）；豪萨/约鲁巴/伊博等", "English (official); Hausa/Yoruba/Igbo etc."],
  ["斯瓦希里语、英语（官方）", "Swahili, English (official)"],
  ["英语（官方）", "English (official)"],
  ["英语、南非荷兰语等11种官方语", "English, Afrikaans + 11 official languages"],
  ["英语（官方）；斯瓦希里通行", "English (official); Swahili widely used"],
  ["基尼阿卢旺达语、英语、法语（官方）", "Kinyarwanda, English, French (official)"],
  ["阿姆哈拉语（联邦工作语）；多民族语", "Amharic (federal working); multi-ethnic"],
  ["法语（官方）", "French (official)"],
  ["法语（官方）；沃洛夫通行", "French (official); Wolof widely used"],
  ["法语、英语（官方）", "French, English (official)"],
  ["法语（官方工作语）；多民族语", "French (official working); multi-ethnic"],
  ["法语（官方）；林加拉/斯瓦希里等", "French (official); Lingala/Swahili etc."],
  ["英语（事实官方）；西语通行", "English (de facto); Spanish widely used"],
  ["英语、法语（官方）", "English, French (official)"],
  ["德语（官方）", "German (official)"],
  ["荷兰语（官方）；英语高普及", "Dutch (official); high English proficiency"],
  ["意大利语（官方）", "Italian (official)"],
  ["瑞典语（官方）；英语高普及", "Swedish (official); high English proficiency"],
  ["波兰语（官方）", "Polish (official)"],
  ["爱尔兰语、英语（官方）", "Irish, English (official)"],
  ["俄语（官方）", "Russian (official)"],
  ["英语（官方）；法语、克里奥尔通行", "English (official); French & Creole widely used"],
  ["马达加斯加语、法语（官方）", "Malagasy, French (official)"],
  ["英语（官方）；茨瓦纳语通行", "English (official); Tswana widely used"],
  ["英语等16种官方语", "English + 16 official languages"],
  ["（官方）", " (official)"],
];

const PRODUCT_HINT_EN: Record<string, string> = {
  简中为主: "Simplified Chinese primary",
  "繁中+英语": "Trad. Chinese + English",
  繁中为主: "Trad. Chinese primary",
  繁中: "Trad. Chinese",
  日语: "Japanese",
  韩语: "Korean",
  "蒙古语+俄语": "Mongolian + Russian",
  印尼语为主: "Indonesian primary",
  越南语: "Vietnamese",
  "马来语+英语": "Malay + English",
  泰语: "Thai",
  "英语+他加禄": "English + Tagalog",
  英语为主: "English primary",
  "英语+印地/本地语": "English + Hindi/local",
  孟加拉语: "Bengali",
  "乌尔都语+英语": "Urdu + English",
  "僧伽罗/泰米尔+英语": "Sinhala/Tamil + English",
  "俄语+哈萨克语": "Russian + Kazakh",
  "乌兹别克语+俄语": "Uzbek + Russian",
  "俄语+吉尔吉斯语": "Russian + Kyrgyz",
  "塔吉克语+俄语": "Tajik + Russian",
  "土库曼语+俄语": "Turkmen + Russian",
  西语: "Spanish",
  西语为主: "Spanish primary",
  葡语: "Portuguese",
  阿语: "Arabic",
  "阿语+法语": "Arabic + French",
  "阿语+英语": "Arabic + English",
  "阿语+法/英": "Arabic + FR/EN",
  "希伯来语+英语": "Hebrew + English",
  土耳其语: "Turkish",
  波斯语: "Persian",
  "斯瓦希里+英语": "Swahili + English",
  英语: "English",
  "英语+本地语": "English + local",
  "阿姆哈拉语+英语": "Amharic + English",
  法语: "French",
  "法语+英语": "French + English",
  "英语+法语": "English + French",
  "马达加斯加语+法语": "Malagasy + French",
  德语: "German",
  "荷兰语+英语": "Dutch + English",
  意大利语: "Italian",
  "瑞典语+英语": "Swedish + English",
  波兰语: "Polish",
  俄语: "Russian",
};

function localizeLanguagesLine(languages: string, lang: UiLang): string {
  if (lang !== "en") return languages;
  let out = languages;
  for (const [zh, en] of LANG_LINE_PHRASE_EN) {
    if (out.includes(zh)) out = out.split(zh).join(en);
  }
  return out;
}

export const COUNTRY_LANGUAGE: Record<string, CountryLanguageInfo> = {
  // —— 东亚 ——
  CN: { zone: "汉语区", languages: "简体中文（官方）", productHint: "简中为主" },
  HK: { zone: "汉语/英语区", languages: "繁体中文、英语（官方）", productHint: "繁中+英语" },
  MO: { zone: "汉语/葡语区", languages: "繁体中文、葡萄牙语（官方）", productHint: "繁中为主" },
  TW: { zone: "汉语区", languages: "繁体中文（官方）", productHint: "繁中" },
  JP: { zone: "日语区", languages: "日语（官方）", productHint: "日语" },
  KR: { zone: "韩语区", languages: "韩语（官方）", productHint: "韩语" },
  MN: { zone: "蒙古语区", languages: "蒙古语（官方）；俄语通行", productHint: "蒙古语+俄语" },

  // —— 东南亚 ——
  ID: { zone: "印尼语区", languages: "印尼语（官方）；英语商务", productHint: "印尼语为主" },
  VN: { zone: "越南语区", languages: "越南语（官方）", productHint: "越南语" },
  MY: { zone: "马来语/英语区", languages: "马来语、英语（官方）；华语通行", productHint: "马来语+英语" },
  TH: { zone: "泰语区", languages: "泰语（官方）", productHint: "泰语" },
  PH: { zone: "他加禄/英语区", languages: "菲律宾语、英语（官方）", productHint: "英语+他加禄" },
  SG: { zone: "英语/多语区", languages: "英语、马来语、华语、泰米尔语（官方）", productHint: "英语为主" },

  // —— 南亚 ——
  IN: { zone: "印地语/英语区", languages: "印地语、英语（联邦）；多邦官方语", productHint: "英语+印地/本地语" },
  BD: { zone: "孟加拉语区", languages: "孟加拉语（官方）；英语商务", productHint: "孟加拉语" },
  PK: { zone: "乌尔都语/英语区", languages: "乌尔都语、英语（官方）", productHint: "乌尔都语+英语" },
  LK: { zone: "僧伽罗/泰米尔区", languages: "僧伽罗语、泰米尔语（官方）；英语通行", productHint: "僧伽罗/泰米尔+英语" },

  // —— 中亚 ——
  KZ: { zone: "突厥语/俄语区", languages: "哈萨克语、俄语（官方）", productHint: "俄语+哈萨克语" },
  UZ: { zone: "突厥语/俄语区", languages: "乌兹别克语（官方）；俄语通行", productHint: "乌兹别克语+俄语" },
  KG: { zone: "突厥语/俄语区", languages: "吉尔吉斯语、俄语（官方）", productHint: "俄语+吉尔吉斯语" },
  TJ: { zone: "波斯语族/俄语区", languages: "塔吉克语（官方）；俄语通行", productHint: "塔吉克语+俄语" },
  TM: { zone: "突厥语区", languages: "土库曼语（官方）；俄语通行", productHint: "土库曼语+俄语" },

  // —— 拉美 ——
  MX: { zone: "西语区", languages: "西班牙语（官方）", productHint: "西语" },
  BR: { zone: "葡语区", languages: "葡萄牙语（官方）", productHint: "葡语" },
  CO: { zone: "西语区", languages: "西班牙语（官方）", productHint: "西语" },
  AR: { zone: "西语区", languages: "西班牙语（官方）", productHint: "西语" },
  PE: { zone: "西语区", languages: "西班牙语、克丘亚语等（官方）", productHint: "西语为主" },
  CL: { zone: "西语区", languages: "西班牙语（官方）", productHint: "西语" },

  // —— 中东与北非 ——
  EG: { zone: "阿语区", languages: "阿拉伯语（官方）；英语商务", productHint: "阿语" },
  MA: { zone: "阿语/法语区", languages: "阿拉伯语、柏柏尔语（官方）；法语通行", productHint: "阿语+法语" },
  DZ: { zone: "阿语/法语区", languages: "阿拉伯语、柏柏尔语（官方）；法语通行", productHint: "阿语+法语" },
  TN: { zone: "阿语/法语区", languages: "阿拉伯语（官方）；法语通行", productHint: "阿语+法语" },
  LY: { zone: "阿语区", languages: "阿拉伯语（官方）", productHint: "阿语" },
  SD: { zone: "阿语区", languages: "阿拉伯语、英语（官方）", productHint: "阿语+英语" },
  SA: { zone: "阿语区", languages: "阿拉伯语（官方）；英语商务", productHint: "阿语" },
  AE: { zone: "阿语/英语区", languages: "阿拉伯语（官方）；英语商务通行", productHint: "阿语+英语" },
  BH: { zone: "阿语/英语区", languages: "阿拉伯语（官方）；英语通行", productHint: "阿语+英语" },
  QA: { zone: "阿语/英语区", languages: "阿拉伯语（官方）；英语通行", productHint: "阿语+英语" },
  KW: { zone: "阿语区", languages: "阿拉伯语（官方）；英语通行", productHint: "阿语" },
  OM: { zone: "阿语区", languages: "阿拉伯语（官方）；英语通行", productHint: "阿语" },
  JO: { zone: "阿语区", languages: "阿拉伯语（官方）；英语通行", productHint: "阿语" },
  LB: { zone: "阿语/法语区", languages: "阿拉伯语（官方）；法语、英语通行", productHint: "阿语+法/英" },
  IQ: { zone: "阿语区", languages: "阿拉伯语、库尔德语（官方）", productHint: "阿语" },
  IL: { zone: "希伯来语区", languages: "希伯来语（官方）；阿拉伯语、英语通行", productHint: "希伯来语+英语" },
  PS: { zone: "阿语区", languages: "阿拉伯语（官方）", productHint: "阿语" },
  TR: { zone: "土耳其语区", languages: "土耳其语（官方）", productHint: "土耳其语" },
  YE: { zone: "阿语区", languages: "阿拉伯语（官方）", productHint: "阿语" },
  IR: { zone: "波斯语区", languages: "波斯语（官方）", productHint: "波斯语" },

  // —— 非洲（撒哈拉以南为主）——
  NG: { zone: "英语区", languages: "英语（官方）；豪萨/约鲁巴/伊博等", productHint: "英语为主" },
  KE: { zone: "斯瓦希里/英语区", languages: "斯瓦希里语、英语（官方）", productHint: "斯瓦希里+英语" },
  GH: { zone: "英语区", languages: "英语（官方）", productHint: "英语" },
  ZA: { zone: "英语/多语区", languages: "英语、南非荷兰语等11种官方语", productHint: "英语为主" },
  TZ: { zone: "斯瓦希里/英语区", languages: "斯瓦希里语、英语（官方）", productHint: "斯瓦希里+英语" },
  UG: { zone: "英语区", languages: "英语（官方）；斯瓦希里通行", productHint: "英语" },
  RW: { zone: "英语/法语区", languages: "基尼阿卢旺达语、英语、法语（官方）", productHint: "英语+本地语" },
  ET: { zone: "阿姆哈拉语区", languages: "阿姆哈拉语（联邦工作语）；多民族语", productHint: "阿姆哈拉语+英语" },
  CI: { zone: "法语区", languages: "法语（官方）", productHint: "法语" },
  SN: { zone: "法语区", languages: "法语（官方）；沃洛夫通行", productHint: "法语" },
  CM: { zone: "法语/英语区", languages: "法语、英语（官方）", productHint: "法语+英语" },
  AO: { zone: "葡语区", languages: "葡萄牙语（官方）", productHint: "葡语" },
  MZ: { zone: "葡语区", languages: "葡萄牙语（官方）", productHint: "葡语" },
  ZM: { zone: "英语区", languages: "英语（官方）", productHint: "英语" },
  ZW: { zone: "英语区", languages: "英语等16种官方语", productHint: "英语" },
  BW: { zone: "英语区", languages: "英语（官方）；茨瓦纳语通行", productHint: "英语" },
  NA: { zone: "英语区", languages: "英语（官方）", productHint: "英语" },
  MU: { zone: "英语/法语区", languages: "英语（官方）；法语、克里奥尔通行", productHint: "英语+法语" },
  MG: { zone: "马达加斯加语/法语区", languages: "马达加斯加语、法语（官方）", productHint: "马达加斯加语+法语" },
  BJ: { zone: "法语区", languages: "法语（官方）", productHint: "法语" },
  BF: { zone: "法语区", languages: "法语（官方）", productHint: "法语" },
  ML: { zone: "法语区", languages: "法语（官方工作语）；多民族语", productHint: "法语" },
  CD: { zone: "法语区", languages: "法语（官方）；林加拉/斯瓦希里等", productHint: "法语" },
  GA: { zone: "法语区", languages: "法语（官方）", productHint: "法语" },
  GN: { zone: "法语区", languages: "法语（官方）；马林凯/苏苏等民族语", productHint: "法语" },

  // —— 欧美 ——
  US: { zone: "英语区", languages: "英语（事实官方）；西语通行", productHint: "英语" },
  CA: { zone: "英语/法语区", languages: "英语、法语（官方）", productHint: "英语+法语" },
  GB: { zone: "英语区", languages: "英语（官方）", productHint: "英语" },
  DE: { zone: "德语区", languages: "德语（官方）", productHint: "德语" },
  FR: { zone: "法语区", languages: "法语（官方）", productHint: "法语" },
  NL: { zone: "荷兰语区", languages: "荷兰语（官方）；英语高普及", productHint: "荷兰语+英语" },
  ES: { zone: "西语区", languages: "西班牙语（官方）", productHint: "西语" },
  PT: { zone: "葡语区", languages: "葡萄牙语（官方）", productHint: "葡语" },
  IT: { zone: "意大利语区", languages: "意大利语（官方）", productHint: "意大利语" },
  SE: { zone: "瑞典语区", languages: "瑞典语（官方）；英语高普及", productHint: "瑞典语+英语" },
  PL: { zone: "波兰语区", languages: "波兰语（官方）", productHint: "波兰语" },
  IE: { zone: "英语区", languages: "爱尔兰语、英语（官方）", productHint: "英语" },
  RU: { zone: "俄语区", languages: "俄语（官方）", productHint: "俄语" },
};

export function getCountryLanguage(code: string): CountryLanguageInfo | undefined {
  return COUNTRY_LANGUAGE[code];
}

/** 卡片/地图一行展示：阿语区 · 阿拉伯语（官方） */
export function formatCountryLanguageLine(code: string, lang: UiLang = "zh"): string | undefined {
  const info = getCountryLanguage(code);
  if (!info) return undefined;
  const zone = lang === "en" ? ZONE_EN[info.zone] || info.zone : info.zone;
  const languages = localizeLanguagesLine(info.languages, lang);
  return `${zone} · ${languages}`;
}

/** 短标：仅语言区 */
export function countryLanguageZone(code: string, lang: UiLang = "zh"): string | undefined {
  const zone = getCountryLanguage(code)?.zone;
  if (!zone) return undefined;
  if (lang !== "en") return zone;
  return ZONE_EN[zone] || zone;
}

export function countryProductHint(code: string, lang: UiLang = "zh"): string | undefined {
  const hint = getCountryLanguage(code)?.productHint;
  if (!hint) return undefined;
  if (lang !== "en") return hint;
  return PRODUCT_HINT_EN[hint] || hint;
}

/** 筛选芯片顺序：多国同区优先，其余按名称 */
export const LANGUAGE_ZONE_ORDER: string[] = (() => {
  const counts = new Map<string, number>();
  for (const info of Object.values(COUNTRY_LANGUAGE)) {
    counts.set(info.zone, (counts.get(info.zone) ?? 0) + 1);
  }
  return [...counts.keys()].sort((a, b) => {
    const d = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    return d !== 0 ? d : a.localeCompare(b, "zh");
  });
})();

/** 某语言区覆盖的 ISO 国码（zone 为中文键，与 COUNTRY_LANGUAGE.zone 一致） */
export function countriesInLanguageZone(zone: string): string[] {
  return Object.entries(COUNTRY_LANGUAGE)
    .filter(([, info]) => info.zone === zone)
    .map(([code]) => code);
}

/** 语言区展示名（筛选芯片） */
export function languageZoneLabelUi(zoneZh: string, lang: UiLang): string {
  if (lang !== "en") return zoneZh;
  return ZONE_EN[zoneZh] || zoneZh;
}
