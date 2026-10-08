/**
 * 与 Atlas 登录同一套：白名单邮箱、初始密码、会话键 authSession1。
 * 访客会话看不了已投平台。
 */
import { createContext, useContext, useState, type ReactNode } from "react";
import { canViewPartnerDetail } from "./authAccess";
import {
  Button,
  Callout,
  Row,
  Stack,
  Text,
  useCanvasState,
  useHostTheme,
} from "./shims/cursor-canvas";

const CLAIM_ALLOWED_DOMAIN = "alliancechuan.com";
const CLAIM_DEFAULT_PASSWORD = "chuan666";
const CLAIM_ADMIN_LOCAL = "leoli";
const CLAIM_ALLOWED_LOCALS: readonly string[] = [
  "leoli",
  "elsawu",
  "AndrewYin",
  "lunayang",
  "yalizhu",
  "Louischau",
  "kevinyung",
  "tunlin",
  "tracytian",
  "taoli",
  "samsoncheng",
];

type AuthUserRecord = {
  local: string;
  displayLocal: string;
  password: string;
  locked: boolean;
  enabled: boolean;
};

type LoginDraft = { email: string; pass: string };

const LoginOpenContext = createContext<() => void>(() => {});

function normalizeClaimEmail(email: string): string {
  return email.trim().toLowerCase();
}

function claimLocalPart(email: string): string {
  return normalizeClaimEmail(email).split("@")[0] ?? "";
}

function canonicalClaimLocal(local: string): string {
  const key = local.trim().toLowerCase();
  return CLAIM_ALLOWED_LOCALS.find((x) => x.toLowerCase() === key) ?? local.trim();
}

function localHasClaimPermission(local: string): boolean {
  const key = local.trim().toLowerCase();
  if (!key) return false;
  return CLAIM_ALLOWED_LOCALS.some((x) => x.toLowerCase() === key);
}

function emailHasClaimPermission(email: string): boolean {
  const e = normalizeClaimEmail(email);
  const m = /^([^\s@]+)@([^\s@]+)$/.exec(e);
  if (!m) return false;
  const [, local, domain] = m;
  if (domain !== CLAIM_ALLOWED_DOMAIN) return false;
  return localHasClaimPermission(local);
}

function isClaimAdmin(local: string): boolean {
  return local.trim().toLowerCase() === CLAIM_ADMIN_LOCAL;
}

function seedAuthUser(localRaw: string): AuthUserRecord {
  const key = localRaw.trim().toLowerCase();
  return {
    local: key,
    displayLocal: canonicalClaimLocal(localRaw),
    password: CLAIM_DEFAULT_PASSWORD,
    locked: false,
    enabled: true,
  };
}

function resolveAuthUser(users: Record<string, AuthUserRecord>, localRaw: string): AuthUserRecord {
  const key = localRaw.trim().toLowerCase();
  return users[key] ?? seedAuthUser(localRaw);
}

function getLoginDraft(): LoginDraft {
  const g = globalThis as unknown as { __crmAtlasLoginDraft?: LoginDraft };
  if (!g.__crmAtlasLoginDraft) g.__crmAtlasLoginDraft = { email: "", pass: "" };
  return g.__crmAtlasLoginDraft;
}

function pickLoginValue(stateVal: string, draftVal: string): string {
  if (draftVal.length > stateVal.length) return draftVal;
  if (stateVal.length > draftVal.length) return stateVal;
  return stateVal || draftVal;
}

function applyPasteToValue(
  value: string,
  selectionStart: number | null | undefined,
  selectionEnd: number | null | undefined,
  pasted: string,
): string {
  const start = selectionStart ?? value.length;
  const end = selectionEnd ?? value.length;
  return value.slice(0, start) + pasted + value.slice(end);
}

export function useCanViewInvested(): boolean {
  const [session] = useCanvasState("authSession1", "");
  const key = (session ?? "").trim();
  if (!key || key.toLowerCase() === "guest") return false;
  return canViewPartnerDetail(key);
}

export function ClaimLoginHost({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <LoginOpenContext.Provider value={() => setOpen(true)}>
      {children}
      {open ? <ClaimLoginDialog onClose={() => setOpen(false)} /> : null}
    </LoginOpenContext.Provider>
  );
}

export function LoginButton() {
  const open = useContext(LoginOpenContext);
  return (
    <Button size="sm" variant="primary" onClick={open}>
      登录
    </Button>
  );
}

/** 已登录展示内容；未登录只留登录按钮。 */
export function InvestedGate({ children }: { children: ReactNode }) {
  const allowed = useCanViewInvested();
  if (allowed) return <>{children}</>;
  return <LoginButton />;
}

function ClaimLoginDialog({ onClose }: { onClose: () => void }) {
  const theme = useHostTheme();
  const [users, setUsers] = useCanvasState<Record<string, AuthUserRecord>>("authUsers1", {});
  const [, setSession] = useCanvasState("authSession1", "");
  const [, setEmail] = useCanvasState("claimEmail1", "");
  const [userSaved, setUserSaved] = useCanvasState("loginUserDraft", "");
  const [passSaved, setPassSaved] = useCanvasState("loginPassDraft", "");
  const [showPass, setShowPass] = useCanvasState("loginShowPw2", false);
  const [err, setErr] = useCanvasState("loginErr1", "");
  const draft = getLoginDraft();

  if (userSaved && !draft.email) draft.email = userSaved;
  if (passSaved && !draft.pass) draft.pass = passSaved;
  const userInput = pickLoginValue(userSaved, draft.email);
  const passInput = pickLoginValue(passSaved, draft.pass);

  function setUserInput(v: string) {
    draft.email = v;
    setUserSaved(v);
  }
  function setPassInput(v: string) {
    draft.pass = v;
    setPassSaved(v);
  }

  function onLogin() {
    const g = globalThis as unknown as { __crmLoginPersistTimer?: ReturnType<typeof setTimeout> };
    if (g.__crmLoginPersistTimer) clearTimeout(g.__crmLoginPersistTimer);
    setUserSaved(draft.email);
    setPassSaved(draft.pass);
    const emailRaw = pickLoginValue(userSaved, draft.email).trim() || draft.email.trim();
    const pass = pickLoginValue(passSaved, draft.pass) || draft.pass;
    if (!emailRaw || !pass) {
      setErr("请输入邮箱与密码");
      return;
    }
    if (!emailHasClaimPermission(emailRaw)) {
      setErr("邮箱或密码错误");
      return;
    }
    const key = claimLocalPart(emailRaw);
    const u = resolveAuthUser(users, key);
    if (!u.enabled) {
      setErr("账号不可用，请联系管理员");
      return;
    }
    const isAdmin = isClaimAdmin(key);
    if (u.locked && !(isAdmin && pass === CLAIM_DEFAULT_PASSWORD)) {
      setErr("账号已锁定，请联系管理员重置");
      return;
    }
    if (pass !== u.password) {
      if (isAdmin) {
        setErr("邮箱或密码错误");
      } else {
        setUsers((prev) => ({ ...prev, [key]: { ...u, locked: true } }));
        setErr("密码错误，账号已锁定，请联系管理员重置");
      }
      setPassInput("");
      return;
    }
    setUsers((prev) => ({
      ...prev,
      [key]: { ...u, locked: false, password: u.password || CLAIM_DEFAULT_PASSWORD },
    }));
    setSession(key);
    setEmail(normalizeClaimEmail(emailRaw));
    setErr("");
    setPassInput("");
    onClose();
  }

  const fieldStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "8px 10px",
    borderRadius: 8,
    border: `1px solid ${theme.stroke.tertiary}`,
    background: theme.bg.editor,
    color: theme.text.primary,
    outline: "none",
    fontSize: 13,
  };

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        background: "rgba(35, 41, 70, 0.28)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "12vh 16px 16px",
      }}
    >
      <div
        role="dialog"
        aria-label="登录"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(420px, 100%)" }}
      >
        <Stack gap={16}>
          <Stack gap={6}>
            <Text weight="semibold">登录后继续</Text>
          </Stack>
          <div
            style={{
              padding: 16,
              borderRadius: 10,
              background: theme.bg.elevated,
              border: `1px solid ${theme.stroke.tertiary}`,
            }}
          >
            <Stack gap={12}>
              <Stack gap={4}>
                <Text size="small" weight="medium">
                  邮箱
                </Text>
                <input
                  type="text"
                  placeholder="邮箱"
                  autoComplete="username"
                  spellCheck={false}
                  value={userInput}
                  onChange={(e) => setUserInput(e.currentTarget.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData?.getData("text") ?? "";
                    if (!pasted) return;
                    e.preventDefault();
                    const t = e.currentTarget;
                    setUserInput(applyPasteToValue(userInput, t.selectionStart, t.selectionEnd, pasted));
                  }}
                  style={fieldStyle}
                />
              </Stack>
              <Stack gap={4}>
                <Text size="small" weight="medium">
                  密码
                </Text>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPass ? "text" : "password"}
                    placeholder="密码"
                    autoComplete={showPass ? "off" : "current-password"}
                    spellCheck={false}
                    value={passInput}
                    onChange={(e) => setPassInput(e.currentTarget.value)}
                    onPaste={(e) => {
                      const pasted = e.clipboardData?.getData("text") ?? "";
                      if (!pasted) return;
                      e.preventDefault();
                      const t = e.currentTarget;
                      setPassInput(applyPasteToValue(passInput, t.selectionStart, t.selectionEnd, pasted));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onLogin();
                    }}
                    style={{ ...fieldStyle, paddingRight: 64 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: "none",
                      background: "transparent",
                      color: theme.text.tertiary,
                      cursor: "pointer",
                      font: "inherit",
                      fontSize: 12,
                    }}
                  >
                    {showPass ? "隐藏" : "显示"}
                  </button>
                </div>
              </Stack>
              {err ? <Callout tone="danger">{err}</Callout> : null}
              <Row gap={8} wrap>
                <Button variant="primary" onClick={onLogin}>
                  登录
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSession("guest");
                    setErr("");
                    onClose();
                  }}
                >
                  访客进入
                </Button>
              </Row>
            </Stack>
          </div>
        </Stack>
      </div>
    </div>
  );
}
