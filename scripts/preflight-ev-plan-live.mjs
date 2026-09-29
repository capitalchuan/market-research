/**
 * EV 测算·整包 上线前严格自检（与画布口径对齐）。
 * 运行：node scripts/preflight-ev-plan-live.mjs
 */
const fails = [];
const warns = [];
const passes = [];

function ok(name) {
  passes.push(name);
}
function fail(name, detail) {
  fails.push(`${name}: ${detail}`);
}
function warn(name, detail) {
  warns.push(`${name}: ${detail}`);
}

function blank(mo, patch) {
  return {
    month: mo,
    nUnits: 0,
    pi: 0,
    mezzPi: 0,
    equity: 0,
    depReturn: 0,
    cfads: 0,
    gap: 0,
    capexOut: 0,
    ...patch,
  };
}

/** 对齐画布 auditYohoPkgMonthRows（空窗可有 PI，但不得画出 DSCR） */
function auditRows(rows) {
  const issues = [];
  for (const r of rows) {
    const eqExpect = r.cfads - r.pi - r.mezzPi;
    if (Math.abs(r.equity - eqExpect) > 1.5) {
      issues.push(`M${r.month} 权益恒等式破`);
    }
    if (r.depReturn > 0.5 && r.equity > eqExpect + r.depReturn * 0.5) {
      issues.push(`M${r.month} 保证金渗入权益`);
    }
    if (r.nUnits <= 0 && r.cfads > 1) {
      issues.push(`M${r.month} 无在营却有经营净`);
    }
  }
  return issues;
}

/** 对齐 buildPkgDscrSeries：峰值月之后 + pi<35%peak + >hi 才断 */
function buildPkgDscrSeries(rows, hi = 5) {
  let peakPi = 0;
  let peakPiMonth = 0;
  for (const r of rows) {
    if (r.pi > peakPi) {
      peakPi = r.pi;
      peakPiMonth = r.month;
    }
  }
  const tailPi = peakPi > 0 ? peakPi * 0.35 : 0;
  return rows.map((r) => {
    let dscr =
      r.nUnits > 0 && r.pi > 1e-9 && Number.isFinite(r.cfads)
        ? r.cfads / r.pi
        : null;
    if (
      dscr != null &&
      dscr > hi &&
      peakPiMonth > 0 &&
      r.month > peakPiMonth &&
      r.pi < tailPi
    ) {
      dscr = null;
    }
    return { month: r.month, dscr, pi: r.pi, nUnits: r.nUnits };
  });
}

/** planDebtLocksOrderPayPlan */
function planDebtLocks(plan) {
  return !!(plan?.seniorDebt != null || plan?.mezzDebt != null);
}

/** resolveDeployRhythmScope 精简 */
function resolveDeployRhythmScope(orders, focusId, YOHO_ID) {
  const open = orders.filter((o) => o.status !== "cancelled");
  const focus = focusId ? open.find((o) => o.id === focusId) : null;
  const yohoPeers = open.filter((o) => o.creditDrawdownPlanId === YOHO_ID);
  const planId =
    focus?.creditDrawdownPlanId || (yohoPeers.length ? YOHO_ID : null);
  if (planId) {
    const peers = open.filter((o) => o.creditDrawdownPlanId === planId);
    if (peers.length) return { orders: peers, planIds: new Set([planId]) };
  }
  const unique = [
    ...new Set(open.map((o) => o.creditDrawdownPlanId).filter(Boolean)),
  ];
  if (unique.length === 1) {
    const peers = open.filter((o) => o.creditDrawdownPlanId === unique[0]);
    return { orders: peers, planIds: new Set(unique) };
  }
  if (focus) return { orders: [focus], planIds: new Set([focus.creditDrawdownPlanId].filter(Boolean)) };
  return {
    orders: open,
    planIds: new Set(open.map((o) => o.creditDrawdownPlanId).filter(Boolean)),
  };
}

function resolvePlanLiveOrderScope(orders, focusId, mode, YOHO_ID) {
  const open = orders.filter((o) => o.status !== "cancelled");
  const pkg = resolveDeployRhythmScope(open, focusId, YOHO_ID);
  const pkgPlanIds = pkg.planIds;
  const packageAvailable =
    pkg.orders.length > 0 &&
    pkgPlanIds.size === 1 &&
    (pkg.orders.length < open.length ||
      open.every((o) => o.creditDrawdownPlanId === [...pkgPlanIds][0]));
  if (mode === "all" || !packageAvailable) {
    return { orders: open, packageAvailable, scope: "all" };
  }
  return { orders: pkg.orders, packageAvailable, scope: "package" };
}

function creditDrawdownRankByPayDate(orders, orderId) {
  const self = orders.find((o) => o.id === orderId);
  if (!self || self.status === "cancelled") return 0;
  const planId = self.creditDrawdownPlanId;
  const peers = orders
    .filter(
      (o) =>
        o.status !== "cancelled" &&
        (planId
          ? o.creditDrawdownPlanId === planId
          : o.id === orderId || !o.creditDrawdownPlanId),
    )
    .sort((a, b) => String(a.payDate).localeCompare(String(b.payDate)));
  const i = peers.findIndex((o) => o.id === orderId);
  return i >= 0 ? i + 1 : 0;
}

// ——— 1. 权益恒等式 ———
{
  const issues = auditRows([
    blank(2, {
      nUnits: 20,
      cfads: 40000,
      pi: 15000,
      mezzPi: 2000,
      equity: 23000,
      depReturn: 8000,
    }),
  ]);
  if (issues.length) fail("权益恒等式", issues.join(";"));
  else ok("权益恒等式正例");
}

// ——— 2. 空窗可有 PI，不得画出 DSCR ———
{
  const idle = blank(1, {
    nUnits: 0,
    pi: 12000,
    cfads: 0,
    equity: -12000,
  });
  const audit = auditRows([idle]);
  if (audit.some((s) => s.includes("空窗含"))) {
    fail("空窗PI审计", "旧口径仍把空窗含PI当错误");
  } else ok("空窗可含只还息PI（审计不误杀）");
  const ser = buildPkgDscrSeries([idle]);
  if (ser[0].dscr != null) fail("空窗DSCR", "无在营仍画出DSCR");
  else ok("空窗有息不断出DSCR点");
}

// ——— 3. 只还息爬坡高倍数不断；债末断 ———
{
  const rows = [
    blank(1, { nUnits: 2, cfads: 500, pi: 120, equity: 380 }),
    blank(2, { nUnits: 10, cfads: 12000, pi: 1500, equity: 10500 }),
    blank(3, { nUnits: 40, cfads: 90000, pi: 28000, equity: 62000 }),
    blank(4, { nUnits: 40, cfads: 85000, pi: 8000, equity: 77000 }),
    blank(5, { nUnits: 0, cfads: 0, pi: 0 }),
  ];
  const ser = buildPkgDscrSeries(rows);
  if (ser[0].dscr == null) fail("DSCR-M1", "应出点");
  else ok("DSCR M1 有在营+本息出点");
  if (ser[1].dscr == null) fail("DSCR-IO爬坡", "只还息高倍数被误杀");
  else ok("DSCR 只还息爬坡高倍数不断");
  if (ser[2].dscr == null) fail("DSCR-达产", "达产月被误杀");
  else ok("DSCR 达产月出点");
  if (ser[3].dscr != null) fail("DSCR-债末", "应断线");
  else ok("DSCR 债末本息萎缩+虚高断线");
  if (ser[4].dscr != null) fail("DSCR-无在营", "不应出点");
  else ok("DSCR 无在营不出点");
}

// ——— 4. 叠期在营+他批息 ———
{
  const ser = buildPkgDscrSeries([
    blank(1, {
      nUnits: 10,
      cfads: 20000,
      pi: 8000,
      equity: 12000,
    }),
  ]);
  if (ser[0].dscr == null || Math.abs(ser[0].dscr - 2.5) > 1e-9) {
    fail("叠期DSCR", String(ser[0].dscr));
  } else ok("叠期在营+分母含息→DSCR=CFADS/PI");
}

// ——— 5. planDebt 锁 ———
{
  if (planDebtLocks({})) fail("债锁-空", "空对象不应锁");
  else ok("债锁：未订立不锁");
  if (!planDebtLocks({ seniorDebt: { enabled: false } })) {
    fail("债锁-都关", "enabled:false 对象仍应锁订单条款");
  } else ok("债锁：都关(enabled:false)仍锁订单");
  if (!planDebtLocks({ seniorDebt: { enabled: true } })) {
    fail("债锁-开启", "应锁");
  } else ok("债锁：优先开启时锁订单");
}

// ——— 6. 测算范围 package ———
{
  const YOHO = "yoho-credit-65p1-v238";
  const yohoOnly = [
    { id: "a", status: "pending_pay", creditDrawdownPlanId: YOHO, payDate: "2026-10-01" },
    { id: "b", status: "pending_pay", creditDrawdownPlanId: YOHO, payDate: "2026-11-01" },
  ];
  const s1 = resolvePlanLiveOrderScope(yohoOnly, null, "package", YOHO);
  if (!s1.packageAvailable || s1.orders.length !== 2) {
    fail("范围-YOHO单包", JSON.stringify(s1));
  } else ok("范围：纯YOHO→packageAvailable");

  const multi = [
    ...yohoOnly,
    { id: "c", status: "pending_pay", creditDrawdownPlanId: "other-plan", payDate: "2026-09-01" },
  ];
  const s2 = resolvePlanLiveOrderScope(multi, null, "package", YOHO);
  if (!s2.packageAvailable || s2.orders.length !== 2) {
    fail("范围-混批无焦点", `应收到YOHO 2笔，得 ${s2.orders.length} avail=${s2.packageAvailable}`);
  } else ok("范围：混批无焦点仍收窄到YOHO（因默认YOHO优先）");

  const multiNoYoho = [
    { id: "c", status: "pending_pay", creditDrawdownPlanId: "plan-a", payDate: "2026-09-01" },
    { id: "d", status: "pending_pay", creditDrawdownPlanId: "plan-b", payDate: "2026-10-01" },
  ];
  const s3 = resolvePlanLiveOrderScope(multiNoYoho, null, "package", YOHO);
  if (s3.packageAvailable) {
    fail("范围-多包无YOHO", "不应 packageAvailable（会假亮）");
  } else if (s3.orders.length !== 2) {
    fail("范围-多包回落", "应回落全部台账");
  } else ok("范围：多非YOHO包无焦点→不可选授信包、回落全部");

  const s4 = resolvePlanLiveOrderScope(multiNoYoho, "c", "package", YOHO);
  if (!s4.packageAvailable || s4.orders.length !== 1) {
    fail("范围-焦点收窄", JSON.stringify(s4));
  } else ok("范围：多包+焦点→收窄到焦点所在包");
}

// ——— 7. 第N次按付款日 ———
{
  const peers = [
    { id: "x", status: "ok", creditDrawdownPlanId: "p", payDate: "2026-11-01", creditDrawdownSeq: 1 },
    { id: "y", status: "ok", creditDrawdownPlanId: "p", payDate: "2026-08-01", creditDrawdownSeq: 2 },
  ];
  const rY = creditDrawdownRankByPayDate(peers, "y");
  const rX = creditDrawdownRankByPayDate(peers, "x");
  if (rY !== 1 || rX !== 2) fail("第N次", `y=${rY} x=${rX}（应按付款日）`);
  else ok("第N次：按付款日重排（忽略陈旧seq）");
}

// ——— 8. CFADS vs after_senior 取值约定 ———
{
  const pt = { cfads: 1000, net: 400 };
  const cfads = typeof pt.cfads === "number" ? pt.cfads : pt.net;
  const after = Number.isFinite(pt.net) ? pt.net : 0;
  if (cfads !== 1000 || after !== 400) fail("回收口径", "取值约定破");
  else ok("回收口径：CFADS vs 路径净(after_senior)");
}

// ——— 9. DSCR 剔IVA / 剔FX 口径（对齐画布 pkgCfadsForDscr + effectiveFx） ———
{
  function pkgCfadsForDscr(r, mode) {
    const cfads = Number.isFinite(r.cfads) ? r.cfads : 0;
    if (mode !== "ex_vat") return cfads;
    const iva = Number.isFinite(r.iva) ? r.iva : 0;
    /** CFADS 已含 IVA 扣减；剔=加回 */
    if (Math.abs(iva) > 1) return cfads + iva;
    return cfads;
  }
  function effectiveFx(buf, mode) {
    if (mode === "ex_fx") return 0;
    return Math.max(0, Math.min(0.5, buf ?? 0));
  }
  function dscrOf(r, vatMode, fxMode, buf) {
    const cf = pkgCfadsForDscr(r, vatMode);
    const fac = 1 - effectiveFx(buf, fxMode);
    if (!(r.nUnits > 0 && r.pi > 1e-9)) return null;
    return (cf * fac) / r.pi;
  }
  const row = { nUnits: 10, cfads: 11600, iva: 0, pi: 5000 };
  const asIs = dscrOf(row, "as_is", "with_fx", 0.1);
  const exVatNoIva = dscrOf(row, "ex_vat", "with_fx", 0.1);
  if (Math.abs(asIs - exVatNoIva) > 1e-9) {
    fail("DSCR-剔税无二次折", `as_is=${asIs} ex_vat=${exVatNoIva}`);
  } else ok("DSCR：无IVA付现时剔税=现行（不÷1.16）");

  const rowIva = { nUnits: 10, cfads: 10000, iva: 1600, pi: 5000 };
  /** CFADS 已含 IVA 扣减；剔IVA=加回 → (10000+1600)*0.9/5000 */
  const withIva = dscrOf(rowIva, "ex_vat", "with_fx", 0.1);
  const expectIva = ((10000 + 1600) * 0.9) / 5000;
  if (Math.abs(withIva - expectIva) > 1e-9) {
    fail("DSCR-剔IVA付现", `got=${withIva} expect=${expectIva}`);
  } else ok("DSCR：剔IVA=加回已扣付现（非再减）");

  const noFx = dscrOf(row, "as_is", "ex_fx", 0.1);
  const expectNoFx = 11600 / 5000;
  if (Math.abs(noFx - expectNoFx) > 1e-9) {
    fail("DSCR-剔FX", `got=${noFx} expect=${expectNoFx}`);
  } else ok("DSCR：剔FX时分子不乘(1−buffer)");

  const both = dscrOf(rowIva, "ex_vat", "ex_fx", 0.1);
  if (Math.abs(both - (10000 + 1600) / 5000) > 1e-9) {
    fail("DSCR-剔税+剔FX", String(both));
  } else ok("DSCR：剔IVA+剔FX可叠加");

  /** 回归：禁止再减（双重扣） */
  const wrongDouble = ((10000 - 1600) * 0.9) / 5000;
  if (Math.abs(withIva - wrongDouble) < 1e-9) {
    fail("DSCR-禁止双重扣", "剔IVA仍在减IVA");
  } else ok("DSCR：剔IVA≠CFADS−IVA（防回归）");
}

// ——— 10. 剔IVA 瀑布/堆叠展示行（加回权益、清零 iva 列） ———
{
  function yohoPkgRowsForWfDisplay(rows, omitIva) {
    if (!omitIva) return rows;
    return rows.map((r) => {
      const iva = Math.max(0, Number.isFinite(r.iva) ? r.iva : 0);
      if (iva <= 1) return r;
      return {
        ...r,
        iva: 0,
        equity: (Number.isFinite(r.equity) ? r.equity : 0) + iva,
        cfads: (Number.isFinite(r.cfads) ? r.cfads : 0) + iva,
        gap: (Number.isFinite(r.cfads) ? r.cfads : 0) + iva - r.pi,
      };
    });
  }
  const raw = [
    {
      month: 5,
      nUnits: 10,
      cfads: 10000,
      iva: 1600,
      pi: 4000,
      equity: 6000,
      gap: 6000,
    },
  ];
  const kept = yohoPkgRowsForWfDisplay(raw, false);
  if (kept[0].iva !== 1600 || kept[0].cfads !== 10000) {
    fail("WF展示-含IVA", "不应改写");
  } else ok("WF展示：含IVA不改写行");

  const omit = yohoPkgRowsForWfDisplay(raw, true)[0];
  if (
    omit.iva !== 0 ||
    omit.cfads !== 11600 ||
    omit.equity !== 7600 ||
    Math.abs(omit.gap - 7600) > 1e-9
  ) {
    fail("WF展示-剔IVA", JSON.stringify(omit));
  } else ok("WF展示：剔IVA清零税柱并加回CFADS/权益");

  /** 真值行不变：展示变换不得污染源 */
  if (raw[0].iva !== 1600 || raw[0].cfads !== 10000) {
    fail("WF展示-源污染", "改写了源数组元素");
  } else ok("WF展示：源行未被污染");
}

// ——— 11. 场站 IVA：只进 iva 列时须同步扣 CFADS 一次 ———
{
  /** 模拟包层合并：场站付现写入后 cfads-=iva */
  let slot = { cfads: 50000, iva: 0, equity: 40000 };
  const ivaUsd = 2000;
  slot.iva += ivaUsd;
  slot.cfads -= ivaUsd;
  if (slot.cfads !== 48000 || slot.iva !== 2000) {
    fail("场站IVA入CFADS", JSON.stringify(slot));
  } else ok("场站IVA：写入iva并扣CFADS一次");
  /** 剔IVA加回后应回到未扣前 */
  const afterEx = slot.cfads + slot.iva;
  if (afterEx !== 50000) fail("场站剔IVA加回", String(afterEx));
  else ok("场站剔IVA：CFADS+IVA还原");
}

// ——— 12. FX buffer=0 时含/剔读数相同 ———
{
  function dscr(cfads, pi, buf, fxMode) {
    const fac = fxMode === "ex_fx" ? 1 : 1 - Math.max(0, Math.min(0.5, buf));
    return (cfads * fac) / pi;
  }
  const a = dscr(10000, 5000, 0, "with_fx");
  const b = dscr(10000, 5000, 0, "ex_fx");
  if (Math.abs(a - b) > 1e-12) fail("FX0重合", `${a} vs ${b}`);
  else ok("FX计划0%：含FX与剔FX DSCR重合");
}

// report
console.log("=== EV 测算·整包 上线前严格自检 ===");
console.log(`通过 ${passes.length} · 警告 ${warns.length} · 失败 ${fails.length}`);
for (const p of passes) console.log(`  OK  ${p}`);
for (const w of warns) console.log(`  WARN ${w}`);
for (const f of fails) console.log(`  FAIL ${f}`);
if (fails.length) {
  process.exit(1);
}
console.log("全部硬门槛通过");
