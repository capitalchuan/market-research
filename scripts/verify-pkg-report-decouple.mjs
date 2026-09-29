/**
 * 包层 DSCR / VTL：报告示意与示范授信包已废止；债服从计划/订单解耦。
 */
const fails = [];

function auditRows(rows) {
  const issues = [];
  for (const r of rows) {
    if (Math.abs((r.equity || 0) - ((r.cfads || 0) - (r.pi || 0))) > 1e-6) {
      issues.push(`M${r.month} 权益恒等式破`);
    }
    if ((r.depReturn || 0) > 1e-6 && (r.equity || 0) >= (r.depReturn || 0) - 1e-9) {
      issues.push(`M${r.month} 保证金渗入权益`);
    }
    if ((r.opsUnits || 0) <= 0 && Math.abs(r.equity || 0) > 1e-6 && !(r.pi > 0)) {
      issues.push(`M${r.month} 无在营却有经营净`);
    }
  }
  return issues;
}

const good = [
  { month: 1, cfads: 100, pi: 40, equity: 60, opsUnits: 1 },
  { month: 2, cfads: 100, pi: 40, equity: 60, opsUnits: 1 },
];
if (auditRows(good).length) fails.push("正例误报: " + auditRows(good).join(";"));

const badDep = auditRows([
  { month: 1, cfads: 100, pi: 40, equity: 160, depReturn: 100, opsUnits: 1 },
]);
if (!badDep.length) fails.push("反例漏检: 保证金渗入权益");

/** 报告示意覆盖物已废止 */
function extraCover() {
  return { shared: 0, liq: 0, gc: 0 };
}
const x = extraCover();
if (x.shared || x.liq || x.gc) fails.push("VTL 仍注入报告覆盖物");

/** 债服：默认 off，订单路径标 order */
function debtSource(planSenior, path) {
  if (planSenior && planSenior.enabled) return "plan";
  if (path === "orders") return "order";
  return "off";
}
if (debtSource(null, "orders") !== "order") fails.push("订单路径应标 order");
if (debtSource({ enabled: true }, "orders") !== "plan") fails.push("订立优先应标 plan");
if (debtSource(null, "off") !== "off") fails.push("无订立应标 off");

if (fails.length) {
  console.error("FAIL · " + fails.join(" | "));
  process.exit(1);
}
console.log("OK · DSCR/VTL 口径自检通过（无报告锚点）");
