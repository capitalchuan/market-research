/**
 * Cloudflare Worker：访客验证码邮件（Resend）
 *
 * 部署后把 Worker URL 配到前端：
 *   VITE_GUEST_VERIFY_EMAIL_API=https://guest-verify.<your-subdomain>.workers.dev
 *
 * 密钥（wrangler secret）：
 *   RESEND_API_KEY
 *   FROM_EMAIL   例：Atlas <noreply@yourdomain.com>
 *   ALLOWED_ORIGINS  例：https://alliancechuan.github.io,http://127.0.0.1:4192
 */

export interface Env {
  RESEND_API_KEY: string;
  FROM_EMAIL: string;
  ALLOWED_ORIGINS?: string;
}

type Body = {
  email?: string;
  code?: string;
  locale?: string;
  company?: string;
  contactName?: string;
  countryLabel?: string;
  subject?: string;
};

function corsHeaders(origin: string | null, env: Env): HeadersInit {
  const allow = (env.ALLOWED_ORIGINS || "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ok =
    !origin || allow.includes("*") || allow.some((a) => origin === a || origin.startsWith(a));
  return {
    "Access-Control-Allow-Origin": ok && origin ? origin : allow[0] || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(data: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const headers = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405, headers);
    }

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return json({ ok: false, error: "Invalid JSON" }, 400, headers);
    }

    const email = (body.email || "").trim().toLowerCase();
    const code = (body.code || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) {
      return json({ ok: false, error: "Invalid email or code" }, 400, headers);
    }
    if (!env.RESEND_API_KEY || !env.FROM_EMAIL) {
      return json({ ok: false, error: "Server email not configured" }, 500, headers);
    }

    const zh = (body.locale || "zh").toLowerCase().startsWith("zh");
    const subject =
      body.subject || (zh ? "Atlas 访客验证码" : "Atlas guest verification code");
    const who = [body.contactName, body.company, body.countryLabel].filter(Boolean).join(" · ");
    const html = zh
      ? `<p>您好${who ? `（${who}）` : ""}，</p><p>您的 Atlas 访客验证码为：</p><p style="font-size:28px;letter-spacing:6px;font-weight:700">${code}</p><p>15 分钟内有效。如非本人操作请忽略。</p>`
      : `<p>Hello${who ? ` (${who})` : ""},</p><p>Your Atlas guest verification code is:</p><p style="font-size:28px;letter-spacing:6px;font-weight:700">${code}</p><p>Valid for 15 minutes. Ignore if you did not request this.</p>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to: [email],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return json({ ok: false, error: text || `Resend ${res.status}` }, 502, headers);
    }

    // 永不把验证码回传给前端
    return json({ ok: true }, 200, headers);
  },
};
