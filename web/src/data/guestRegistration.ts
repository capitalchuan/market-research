/**
 * 访客注册 · 邮箱验证码解锁全站浏览（静态站经 VITE_GUEST_VERIFY_EMAIL_API / EmailJS 发信）。
 * 总开关：`authAccess.GUEST_VERIFY_ENABLED`（当前 false 时本文件闲置，改 true 即恢复 OTP）。
 * 信源目录 / 〔n〕 始终仅白名单成员可见，与 OTP 开关无关。
 */

import type { UiLang } from "../uiI18n";
import { guestRegionLabel, type GuestRegionCode } from "./guestRegions";

export type GuestAccessProfile = {
  verified: boolean;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  /** ISO 国家/地区码（含 OTHER）；旧会话可能缺省 */
  countryCode?: string;
  countryLabel?: string;
  verifiedAt?: string;
};

export type GuestVerifyPending = {
  company: string;
  contactName: string;
  email: string;
  phone: string;
  countryCode: string;
  countryLabel: string;
  /** SHA-256 十六进制；持久化态不得存明文验证码 */
  codeHash: string;
  expiresAt: number;
  sentAt: number;
};

/** 内存态（发信前）可带明文；落库前必须 seal 成 GuestVerifyPending */
export type GuestVerifyPendingDraft = Omit<GuestVerifyPending, "codeHash"> & {
  code: string;
  codeHash?: string;
};

const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const HASH_PREFIX = "atlas-guest-verify:v1:";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s+\-()]{7,20}$/;

export function normalizeGuestEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateGuestRegistrationForm(
  input: {
    company: string;
    contactName: string;
    email: string;
    phone: string;
    countryCode: string;
  },
  lang: UiLang = "zh",
): string | null {
  const zh = lang === "zh";
  if (!input.company.trim()) return zh ? "请填写公司名称" : "Please enter company name";
  if (!input.contactName.trim()) return zh ? "请填写姓名" : "Please enter your name";
  if (!input.countryCode.trim()) {
    return zh ? "请选择国家 / 地区" : "Please select country / region";
  }
  const email = normalizeGuestEmail(input.email);
  if (!email || !EMAIL_RE.test(email)) {
    return zh ? "请填写有效邮箱地址" : "Please enter a valid email address";
  }
  const phone = input.phone.trim();
  if (!phone || !PHONE_RE.test(phone)) {
    return zh ? "请填写有效联系电话" : "Please enter a valid phone number";
  }
  return null;
}

export function generateVerificationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function hashGuestVerifyCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(`${HASH_PREFIX}${code.trim()}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createGuestVerifyPending(
  input: {
    company: string;
    contactName: string;
    email: string;
    phone: string;
    countryCode: string;
  },
  lang: UiLang = "zh",
): GuestVerifyPendingDraft {
  const now = Date.now();
  const countryCode = input.countryCode.trim().toUpperCase();
  return {
    company: input.company.trim(),
    contactName: input.contactName.trim(),
    email: normalizeGuestEmail(input.email),
    phone: input.phone.trim(),
    countryCode,
    countryLabel: guestRegionLabel(countryCode as GuestRegionCode, lang),
    code: generateVerificationCode(),
    sentAt: now,
    expiresAt: now + CODE_TTL_MS,
  };
}

/** 发信成功后落库：去掉明文 code */
export async function sealGuestVerifyPending(
  draft: GuestVerifyPendingDraft,
): Promise<GuestVerifyPending> {
  const codeHash = await hashGuestVerifyCode(draft.code);
  return {
    company: draft.company,
    contactName: draft.contactName,
    email: draft.email,
    phone: draft.phone,
    countryCode: draft.countryCode,
    countryLabel: draft.countryLabel,
    codeHash,
    sentAt: draft.sentAt,
    expiresAt: draft.expiresAt,
  };
}

/** 清理旧会话里误存的明文 code（若仍挂在对象上） */
export function stripLegacyPlainCode(
  pending: (GuestVerifyPending & { code?: string }) | null | undefined,
): { changed: boolean; pending: GuestVerifyPending | null } {
  if (!pending) return { changed: false, pending: null };
  const legacy = pending as GuestVerifyPending & { code?: string };
  if (typeof legacy.code === "string" && legacy.code.length > 0) {
    if (!legacy.codeHash) {
      // 仅有明文、无哈希：无法安全校验，作废
      return { changed: true, pending: null };
    }
    const { code: _drop, ...rest } = legacy;
    return { changed: true, pending: rest as GuestVerifyPending };
  }
  return { changed: false, pending };
}

export function guestVerifyResendCooldownMs(pending: GuestVerifyPending | null | undefined): number {
  if (!pending?.sentAt) return 0;
  const left = RESEND_COOLDOWN_MS - (Date.now() - pending.sentAt);
  return left > 0 ? left : 0;
}

export async function verifyGuestCode(
  pending: (GuestVerifyPending & { code?: string }) | null | undefined,
  input: string,
  lang: UiLang = "zh",
): Promise<{ ok: true; profile: GuestAccessProfile } | { ok: false; error: string }> {
  const zh = lang === "zh";
  if (!pending) return { ok: false, error: zh ? "请先发送验证码" : "Please send a code first" };
  if (Date.now() > pending.expiresAt) {
    return { ok: false, error: zh ? "验证码已过期，请重新发送" : "Code expired — please resend" };
  }
  const code = input.trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: zh ? "请输入 6 位数字验证码" : "Enter the 6-digit code" };
  }

  let match = false;
  if (pending.codeHash) {
    match = (await hashGuestVerifyCode(code)) === pending.codeHash;
  } else if (pending.code) {
    // 兼容极旧明文会话（随即应被 strip）
    match = code === pending.code;
  }
  if (!match) {
    return { ok: false, error: zh ? "验证码错误" : "Incorrect verification code" };
  }

  return {
    ok: true,
    profile: {
      verified: true,
      company: pending.company,
      contactName: pending.contactName,
      email: pending.email,
      phone: pending.phone,
      countryCode: pending.countryCode,
      countryLabel: pending.countryLabel,
      verifiedAt: new Date().toISOString().slice(0, 19).replace("T", " "),
    },
  };
}

export type GuestVerifyEmailMeta = {
  locale: UiLang;
  company?: string;
  contactName?: string;
  countryCode?: string;
  countryLabel?: string;
};

export type GuestVerifyEmailResult = {
  ok: boolean;
  error?: string;
};

async function dispatchViaEmailJs(
  email: string,
  code: string,
  meta: GuestVerifyEmailMeta,
): Promise<GuestVerifyEmailResult | null> {
  const serviceId = (import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined)?.trim();
  const templateId = (import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined)?.trim();
  const publicKey = (import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined)?.trim();
  if (!serviceId || !templateId || !publicKey) return null;

  const zh = meta.locale === "zh";
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          to_email: email,
          email,
          code,
          company: meta.company ?? "",
          contact_name: meta.contactName ?? "",
          country: meta.countryLabel ?? meta.countryCode ?? "",
          subject: zh ? "Atlas 访客验证码" : "Atlas guest verification code",
          message: zh
            ? `您的验证码是 ${code}，15 分钟内有效。`
            : `Your verification code is ${code}. It expires in 15 minutes.`,
        },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: text || `EmailJS error (${res.status})` };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: zh ? "邮件服务暂不可用，请稍后重试" : "Email service unavailable — try again later",
    };
  }
}

/**
 * 自动发送验证码到访客邮箱。
 * 优先级：VITE_GUEST_VERIFY_EMAIL_API → EmailJS →（仅 DEV）控制台日志，绝不回传验证码给页面。
 */
export async function dispatchGuestVerificationEmail(
  email: string,
  code: string,
  meta: GuestVerifyEmailMeta = { locale: "zh" },
): Promise<GuestVerifyEmailResult> {
  const zh = meta.locale === "zh";
  const api = (import.meta.env.VITE_GUEST_VERIFY_EMAIL_API as string | undefined)?.trim();

  if (api) {
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          code,
          locale: meta.locale,
          company: meta.company,
          contactName: meta.contactName,
          countryCode: meta.countryCode,
          countryLabel: meta.countryLabel,
          subject: zh ? "Atlas 访客验证码" : "Atlas guest verification code",
          template: "guest-verify",
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return {
          ok: false,
          error: text || (zh ? `邮件发送失败（${res.status}）` : `Email send failed (${res.status})`),
        };
      }
      return { ok: true };
    } catch {
      return {
        ok: false,
        error: zh ? "邮件服务暂不可用，请稍后重试" : "Email service unavailable — try again later",
      };
    }
  }

  const viaJs = await dispatchViaEmailJs(email, code, meta);
  if (viaJs) return viaJs;

  // DEV：仅写控制台，永不向游客 UI / localStorage 回传验证码
  if (import.meta.env.DEV) {
    console.info(
      "[guest-verify][DEV only] code for",
      email,
      "— browser console only; never shown in guest UI or persisted plaintext.",
    );
    console.info("[guest-verify][DEV only] code:", code);
    return { ok: true };
  }

  return {
    ok: false,
    error: zh
      ? "邮件服务未配置：请管理员设置 VITE_GUEST_VERIFY_EMAIL_API 或 EmailJS 环境变量后重新部署"
      : "Email not configured: set VITE_GUEST_VERIFY_EMAIL_API or EmailJS env vars and redeploy",
  };
}
