/**
 * 静态校验保函测算导出 HTML（公式行号、必要字段、XML 转义）
 * 运行：node scripts/verify-guarantee-export.mjs
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(
  join(root, "cross-border-guarantee-onlend.canvas.tsx"),
  "utf8",
);

const errors = [];
const warnings = [];

function expect(pattern, msg) {
  if (!pattern.test(src)) errors.push(msg);
}

function warn(pattern, msg) {
  if (!pattern.test(src)) warnings.push(msg);
}

const formulaChecks = [
  ["=B6\\*B7/100\\*B8/360", "B22 存款利息"],
  ["=IF\\(B19=1,B6\\+B22,B6\\)", "B23 保函面额"],
  ["=B23\\*B9/100", "B24 手续费"],
  ["=B23\\*B13/100\\*B12/\\(1\\+B10/100\\*B11/365\\)", "B25 助贷本金"],
  ["=B25\\*B14/100\\*B11/360", "B26 转贷利息"],
  ["=B25\\*B10/100\\*B11/360", "B27 贷款利息"],
  ["=B28/B12", "B34 息差折美元"],
  ["=B22\\+B36-B24", "B38 全折净收益"],
  ["=B38/B6", "B39 收益率"],
  ["=B41/B6", "B42 CHUAN收益率"],
];

for (const [f, label] of formulaChecks) {
  expect(new RegExp(f), `缺少 Excel 公式：${label}`);
}

expect(/inputs:\s*allocInputs/, "导出应传入 allocInputs（含有效保证金）");
expect(/calc:\s*allocCalc/, "导出应传入 allocCalc");
expect(/excelHtmlRow\("保函位置"/, "Excel 缺保函位置");
expect(/excelHtmlRow\("银行风险敞口\(倒算\)"/, "Excel 缺银行敞口");
expect(/excelHtmlRow\("保证金"/, "Excel 分配侧应含保证金");
expect(/excelHtmlRow\("EL"/, "Excel 分配侧应含 EL");
expect(/固收·场景息差/, "导出应含固收·场景息差");
expect(/buildGuaranteePdfHtml/, "缺少 PDF 构建");
expect(/openGuaranteePdfPrint/, "缺少 PDF 打印");
expect(/<!DOCTYPE html>/, "PDF 应含 DOCTYPE");
expect(/@media print/, "PDF 应含打印样式");
expect(/xmlns:x="urn:schemas-microsoft-com:office:excel"/, "Excel 缺 office 命名空间");
expect(/x:fmla=/, "Excel 缺 x:fmla 公式属性");
expect(/application\/vnd\.ms-excel/, "Excel MIME 类型");
expect(/function xmlEsc/, "缺少 xmlEsc");
expect(/function htmlEsc/, "缺少 htmlEsc");
expect(/allocParamRows/, "PDF 应含分配侧结构参数表");

const structureRowMatches = src.match(
  /const structureRows = \[[\s\S]*?\]\.join\(""\);/,
);
if (structureRowMatches) {
  const block = structureRowMatches[0];
  const rowCalls = (block.match(/excelHtmlRow\(/g) || []).length;
  const sections = (block.match(/excelHtmlSection\(/g) || []).length;
  const blanks = (block.match(/excelHtmlBlankRow\(/g) || []).length;
  const totalDataRows = rowCalls + sections + blanks;
  if (totalDataRows !== 42) {
    warnings.push(
      `结构表行数=${totalDataRows}（预期 42），若改结构请同步公式 B 列行号`,
    );
  }
}

console.log("=== 保函测算导出校验 ===");
if (errors.length) {
  console.error("错误:");
  errors.forEach((e) => console.error("  ✗", e));
}
if (warnings.length) {
  console.warn("警告:");
  warnings.forEach((w) => console.warn("  !", w));
}
if (!errors.length && !warnings.length) {
  console.log("全部通过");
}
process.exit(errors.length ? 1 : 0);
