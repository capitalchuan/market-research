import { COUNTRY_MACRO } from "./data/countryMacro";
import { COUNTRY_LABEL_ZH } from "./data/nbfcCountryStats";

const COUNTRY_HASH = /^#\/country\/([A-Za-z]{2})$/;

export function countryHash(code: string): string {
  return `#/country/${code.toUpperCase()}`;
}

/** 可复制、可单独打开的国家详情地址。 */
export function countryPageHref(code: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = countryHash(code);
  return url.href;
}

export function readCountryCodeFromHash(hash = window.location.hash): string | null {
  const match = COUNTRY_HASH.exec(hash);
  if (!match) return null;
  const code = match[1].toUpperCase();
  if (!COUNTRY_LABEL_ZH[code] && !COUNTRY_MACRO[code]) return null;
  return code;
}

export function writeCountryHash(code: string | null) {
  const next = code ? countryHash(code) : "";
  const current = window.location.hash;
  if (code) {
    if (current.toUpperCase() === next.toUpperCase()) return;
    window.location.hash = next;
    return;
  }
  if (COUNTRY_HASH.test(current)) {
    history.pushState(null, "", window.location.pathname + window.location.search);
  }
}
