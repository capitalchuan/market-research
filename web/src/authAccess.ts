/** 登录会话权限（访客 vs 白名单成员） */

import type { GuestAccessProfile } from "./data/guestRegistration";
import type { MacroMapFactorId } from "./data/macroMapMetrics";

export const GUEST_SESSION = "guest";

/**
 * 访客邮箱注册/OTP 解锁。false = 访客进入即可浏览公开层（无注册面板）；改 true 即恢复验证闸门。
 * 信源目录 / 〔n〕 / 本卡信源块始终仅白名单成员可见，与本开关无关。
 */
export const GUEST_VERIFY_ENABLED = false;

/** 未验证访客在地图上唯一可点看的宏观因子（仅 GUEST_VERIFY_ENABLED 时生效） */
export const GUEST_LIMITED_MAP_FACTOR: MacroMapFactorId = "hhDebt";

/** 访客脱敏占位（合作机构名、持仓金额等） */
export const SENSITIVE_MASK = "**";

export function isGuestSession(session: string | null | undefined): boolean {
  return (session ?? "").trim().toLowerCase() === GUEST_SESSION;
}

export function isGuestVerified(profile: GuestAccessProfile | null | undefined): boolean {
  if (!GUEST_VERIFY_ENABLED) return true;
  return Boolean(profile?.verified);
}

/** 访客且未完成邮箱验证（验证关闭时恒为 false） */
export function isLimitedGuest(
  session: string | null | undefined,
  profile: GuestAccessProfile | null | undefined,
): boolean {
  if (!GUEST_VERIFY_ENABLED) return false;
  return isGuestSession(session) && !isGuestVerified(profile);
}

/** 访客验证后可浏览公开层（仍为 Guest，非白名单成员）；验证关闭时访客即开公开层（信源仍除外） */
export function canGuestBrowseFull(
  session: string | null | undefined,
  profile: GuestAccessProfile | null | undefined,
): boolean {
  if (!isGuestSession(session)) return true;
  if (!GUEST_VERIFY_ENABLED) return true;
  return isGuestVerified(profile);
}

export function canGuestUseMapLayer(
  session: string | null | undefined,
  profile: GuestAccessProfile | null | undefined,
  layer: "loanBook" | "eco" | "roster" | MacroMapFactorId,
): boolean {
  if (!isGuestSession(session)) return true;
  if (!GUEST_VERIFY_ENABLED || isGuestVerified(profile)) return true;
  return layer === GUEST_LIMITED_MAP_FACTOR;
}

export function canGuestClickMapCountry(
  session: string | null | undefined,
  profile: GuestAccessProfile | null | undefined,
  factor: MacroMapFactorId | "loanBook" | "market",
): boolean {
  if (!isGuestSession(session)) return true;
  if (!GUEST_VERIFY_ENABLED || isGuestVerified(profile)) return true;
  return factor === GUEST_LIMITED_MAP_FACTOR;
}

/** 访客不可见合作机构具名与持仓明细；可看展业国数量等公开层 */
export function canViewPartnerDetail(session: string | null | undefined): boolean {
  return !isGuestSession(session);
}

/** 访客不可见信源目录、〔n〕标注与本卡信源块（含全站浏览模式；仅白名单成员可见） */
export function canViewSourceCite(
  session: string | null | undefined,
  _profile?: GuestAccessProfile | null,
): boolean {
  return !isGuestSession(session);
}

/**
 * 上传文档 / Composer 创设 CRM 机构：仅白名单登录成员。
 * 访客（含已验证邮箱）只读浏览，不可写机构库。
 */
export function canCreateCrmInstitution(session: string | null | undefined): boolean {
  const s = (session ?? "").trim();
  if (!s) return false;
  return !isGuestSession(s);
}

export function maskIfGuest(guest: boolean, value: string): string {
  return guest ? SENSITIVE_MASK : value;
}

/** 合作机构展示名：访客统一「合作机构 **」 */
export function partnerPublicName(guest: boolean, realName: string, index = 0): string {
  if (!guest) return realName;
  return `合作机构 ${SENSITIVE_MASK}`;
}
