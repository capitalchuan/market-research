import { COUNTRY_MACRO } from "./data/countryMacro";
import { COUNTRY_LABEL_ZH } from "./data/nbfcCountryStats";

export type SiteLang = "zh" | "en";

const SITE_HASH = /^#(?:\/([Ee][Nn]))?(?:\/country\/([A-Za-z]{2}))?$/;

function knownCountry(code: string): boolean {
  return Boolean(COUNTRY_LABEL_ZH[code] || COUNTRY_MACRO[code]);
}

export function readSiteHash(hash = window.location.hash): { lang: SiteLang; code: string | null } {
  if (!hash || hash === "#") return { lang: "zh", code: null };
  const match = SITE_HASH.exec(hash);
  if (!match) return { lang: "zh", code: null };
  const lang: SiteLang = match[1] ? "en" : "zh";
  if (!match[2]) return { lang, code: null };
  const code = match[2].toUpperCase();
  if (!knownCountry(code)) return { lang, code: null };
  return { lang, code };
}

export function siteHash(lang: SiteLang, code: string | null): string {
  const country = code ? `/country/${code.toUpperCase()}` : "";
  if (lang === "en") return `#/en${country}`;
  return code ? `#/country/${code}` : "";
}

export function countryHash(code: string): string {
  return siteHash(readSiteHash().lang, code);
}

/** 可复制、可单独打开的国家详情地址。英文版带 /en。 */
export function countryPageHref(code: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = countryHash(code);
  return url.href;
}

export function readCountryCodeFromHash(hash = window.location.hash): string | null {
  return readSiteHash(hash).code;
}

export function writeSiteHash(patch: { lang?: SiteLang; code?: string | null }) {
  const current = readSiteHash();
  const lang = patch.lang ?? current.lang;
  const code = patch.code !== undefined ? patch.code : current.code;
  const next = siteHash(lang, code);
  const hash = window.location.hash;
  if (next) {
    if (hash.toLowerCase() === next.toLowerCase()) return;
    window.location.hash = next;
    return;
  }
  if (!hash || hash === "#") return;
  if (SITE_HASH.test(hash)) {
    history.pushState(null, "", window.location.pathname + window.location.search);
  }
}

export function writeCountryHash(code: string | null) {
  writeSiteHash({ code });
}
