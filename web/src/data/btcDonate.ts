/** Guest 捐赠 / 打赏：按地区分流（中国大陆→人民币，其余→BTC） */

export const BTC_DONATE = {
  /**
   * 收款地址（bech32 `bc1…` 或 legacy `1…`/`3…`）。
   * 留空时面板提示「地址待配置」。
   */
  address: "",
  label: "BTC Donate",
  note: "支持公开版 Atlas 的维护。仅接受链上 Bitcoin。",
  networkHint: "Bitcoin · on-chain",
} as const;

/**
 * 中国大陆人民币打赏。
 * 二维码放到 `web/public/donate/`（如 wechat.png / alipay.png），再填写下方路径。
 */
export const CNY_DONATE = {
  label: "打赏",
  note: "支持公开版 Atlas 的维护。可用微信 / 支付宝扫码打赏。",
  currencyHint: "人民币 · CNY",
  /** 微信收款码；例 "/donate/wechat.png"；空则不展示图 */
  wechatQrSrc: "",
  /** 支付宝收款码；例 "/donate/alipay.png" */
  alipayQrSrc: "",
  /** 可选文案（无图时也可展示，如微信号） */
  wechatHint: "",
  alipayHint: "",
} as const;

export type DonateChannel = "cny" | "btc";

export function btcDonateAddress(): string {
  return (BTC_DONATE.address || "").trim();
}

export function btcDonateReady(): boolean {
  const a = btcDonateAddress();
  return a.length >= 26 && !/\s/.test(a);
}

export function btcDonateUri(): string {
  const a = btcDonateAddress();
  return a ? `bitcoin:${a}` : "";
}

export function cnyDonateHasWechat(): boolean {
  return Boolean((CNY_DONATE.wechatQrSrc || "").trim() || (CNY_DONATE.wechatHint || "").trim());
}

export function cnyDonateHasAlipay(): boolean {
  return Boolean((CNY_DONATE.alipayQrSrc || "").trim() || (CNY_DONATE.alipayHint || "").trim());
}

export function cnyDonateReady(): boolean {
  return cnyDonateHasWechat() || cnyDonateHasAlipay();
}

/**
 * 是否优先人民币打赏。
 * 主信号：时区 Asia/Shanghai 等大陆区；辅：浏览器语言 zh-CN。
 * 港澳台时区不强制人民币（仍默认 BTC，面板可切换）。
 */
export function preferCnyDonate(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (/^Asia\/(Shanghai|Chongqing|Harbin|Urumqi|Kashgar)$/i.test(tz)) return true;
  } catch {
    /* ignore */
  }
  const langs =
    typeof navigator !== "undefined"
      ? [...(navigator.languages || []), navigator.language || ""]
      : [];
  return langs.some((l) => {
    const s = (l || "").toLowerCase();
    if (s.startsWith("zh-tw") || s.startsWith("zh-hk") || s.startsWith("zh-mo")) return false;
    return s === "zh-cn" || s.startsWith("zh-cn") || s === "zh-hans" || s.startsWith("zh-hans");
  });
}
