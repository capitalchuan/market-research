/**
 * 从 Atlas 信贷档抽出「信贷原生」玩家（现金贷 / 消费分期 / 信用租赁）。
 * 不含场景原生，不含信贷超市（agent / 流量服务商）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const atlas = readFileSync(join(root, "src/Atlas.tsx"), "utf8");

const REGION_LOC = {
  SEA: ["ID", "VN", "MY", "TH", "PH", "SG"],
  LATAM: ["MX", "BR", "CO", "AR", "PE", "CL"],
  GCC: ["SA", "AE", "BH", "QA", "KW", "OM"],
  MENA: ["EG", "MA", "DZ", "TN", "LY", "SD", "SA", "AE", "BH", "QA", "KW", "OM", "JO", "LB", "IQ", "IL", "PS", "TR", "YE", "IR"],
  MEA: ["EG", "MA", "DZ", "TN", "LY", "SD", "SA", "AE", "BH", "QA", "KW", "OM", "JO", "LB", "IQ", "IL", "PS", "TR", "YE", "IR"],
  EU: ["DE", "FR", "NL", "ES", "PT", "IT", "SE", "PL", "IE"],
  UK: ["GB"],
  非洲: ["NG", "KE", "GH", "ZA", "TZ", "UG", "RW", "ET", "CI", "SN", "CM", "AO", "MZ", "ZM", "ZW", "BW", "NA", "MU", "MG", "BJ", "BF", "ML", "CD", "GA"],
};

const ALIASES = {
  CN: ["中国大陆", "中国"],
  HK: ["中国香港", "香港", "Hong Kong"],
  MO: ["中国澳门", "澳门", "Macau", "Macao"],
  TW: ["中国台湾", "台湾", "台灣", "Taiwan"],
  JP: ["日本"],
  KR: ["韩国"],
  MN: ["外蒙古", "蒙古国", "Mongolia"],
  ID: ["印度尼西亚", "印尼"],
  VN: ["越南"],
  MY: ["马来西亚", "马来"],
  TH: ["泰国"],
  PH: ["菲律宾"],
  SG: ["新加坡", "Singapore"],
  IN: ["印度"],
  BD: ["孟加拉"],
  PK: ["巴基斯坦"],
  LK: ["斯里兰卡"],
  KZ: ["哈萨克斯坦"],
  UZ: ["乌兹别克斯坦"],
  KG: ["吉尔吉斯斯坦", "吉尔吉斯"],
  TJ: ["塔吉克斯坦"],
  TM: ["土库曼斯坦"],
  MX: ["墨西哥"],
  BR: ["巴西"],
  CO: ["哥伦比亚"],
  AR: ["阿根廷"],
  PE: ["秘鲁"],
  CL: ["智利"],
  EG: ["埃及"],
  MA: ["摩洛哥", "Morocco"],
  DZ: ["阿尔及利亚", "Algeria"],
  TN: ["突尼斯", "Tunisia"],
  LY: ["利比亚", "Libya"],
  SD: ["苏丹", "Sudan"],
  SA: ["沙特", "沙特阿拉伯"],
  AE: ["阿联酋", "阿拉伯联合酋长国", "UAE"],
  BH: ["巴林", "Bahrain"],
  QA: ["卡塔尔", "Qatar"],
  KW: ["科威特", "Kuwait"],
  OM: ["阿曼", "Oman"],
  JO: ["约旦", "Jordan"],
  LB: ["黎巴嫩", "Lebanon"],
  IQ: ["伊拉克", "Iraq"],
  IL: ["以色列", "Israel"],
  PS: ["巴勒斯坦", "Palestine"],
  TR: ["土耳其", "Türkiye", "Turkey"],
  YE: ["也门", "Yemen"],
  IR: ["伊朗", "Iran"],
  NG: ["尼日利亚", "Nigeria"],
  KE: ["肯尼亚", "Kenya"],
  GH: ["加纳", "Ghana"],
  ZA: ["南非", "South Africa"],
  TZ: ["坦桑尼亚", "Tanzania"],
  UG: ["乌干达", "Uganda"],
  RW: ["卢旺达", "Rwanda"],
  ET: ["埃塞俄比亚", "Ethiopia"],
  CI: ["科特迪瓦", "Ivory Coast", "Côte d'Ivoire", "Cote d'Ivoire"],
  SN: ["塞内加尔", "Senegal"],
  CM: ["喀麦隆", "Cameroon"],
  AO: ["安哥拉", "Angola"],
  MZ: ["莫桑比克", "Mozambique"],
  ZM: ["赞比亚", "Zambia"],
  ZW: ["津巴布韦", "Zimbabwe"],
  BW: ["博茨瓦纳", "Botswana"],
  NA: ["纳米比亚", "Namibia"],
  MU: ["毛里求斯", "Mauritius"],
  MG: ["马达加斯加", "Madagascar"],
  BJ: ["贝宁", "Benin"],
  BF: ["布基纳法索", "Burkina Faso"],
  ML: ["马里", "Mali"],
  CD: ["刚果（金）", "刚果金", "DRC", "Congo"],
  GA: ["加蓬", "Gabon"],
  US: ["美国"],
  CA: ["加拿大", "Canada"],
  GB: ["英国", "UK", "United Kingdom", "Britain"],
  DE: ["德国", "Germany"],
  FR: ["法国", "France"],
  NL: ["荷兰", "Netherlands"],
  ES: ["西班牙", "Spain"],
  PT: ["葡萄牙", "Portugal"],
  IT: ["意大利", "Italy"],
  SE: ["瑞典", "Sweden"],
  PL: ["波兰", "Poland"],
  IE: ["爱尔兰", "Ireland"],
  RU: ["俄罗斯", "Russia", "俄国", "俄联邦"],
  AU: ["澳大利亚", "Australia"],
};

function sliceArray(name) {
  const idx = atlas.indexOf(`const ${name}`);
  if (idx < 0) throw new Error(`missing ${name}`);
  const eq = atlas.indexOf("= [", idx);
  const start = eq >= 0 ? eq + 2 : atlas.indexOf("[", idx);
  let depth = 0;
  for (let i = start; i < atlas.length; i++) {
    const ch = atlas[i];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return atlas.slice(start, i + 1);
    }
  }
  throw new Error(`unclosed ${name}`);
}

function unescape(s) {
  return s.replace(/\\"/g, '"').replace(/\\n/g, " ");
}

function field(block, key) {
  const m = block.match(new RegExp(`${key}:\\s*"((?:\\\\.|[^"\\\\])*)"`));
  return m ? unescape(m[1]) : "";
}

function topObjects(src) {
  const out = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        out.push(src.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return out;
}

function locToken(group) {
  const m = group.match(/（([^）]+)）\s*$/);
  if (!m) return "";
  return m[1].split("·").pop().trim();
}

function aliasHit(blob, alias) {
  if (!alias) return false;
  if (alias === "印度") return /印度(?!尼)/.test(blob);
  if (alias === "马来") return /马来(?!西亚)/.test(blob);
  if (alias === "UK") return /(?:^|[^A-Za-z])UK(?:$|[^A-Za-z])/.test(blob);
  if (alias === "Congo") return /(?:^|[^A-Za-z])Congo(?:$|[^A-Za-z])/i.test(blob);
  return blob.includes(alias);
}

function marketsFrom(group, countries) {
  const codes = new Set();
  const loc = locToken(group);
  if (/^[A-Z]{2}$/.test(loc)) codes.add(loc);
  else if (REGION_LOC[loc]) for (const c of REGION_LOC[loc]) codes.add(c);
  const text = (countries || "").trim();
  const worldwide = /^全球(\s|$|（|\(|\/|多国|及)/.test(text) || /^Worldwide\b/i.test(text);
  if (text && !worldwide) {
    const blob = `${group} ${text}`;
    for (const [code, aliases] of Object.entries(ALIASES)) {
      if (code === "CN") continue;
      if (aliases.some((a) => aliasHit(blob, a))) codes.add(code);
    }
    const cnBlob = blob;
    const hk = /中国香港|香港|Hong Kong/.test(cnBlob) || group.includes("·HK");
    const mo = /中国澳门|澳门|Macau|Macao/.test(cnBlob) || group.includes("·MO");
    const tw = /中国台湾|台湾|台灣|Taiwan/.test(cnBlob) || group.includes("·TW");
    if (group.includes("·CN") || /中国大陆/.test(cnBlob) || (/中国(?!台湾|香港|澳门)/.test(cnBlob) && !(hk || mo || tw))) {
      codes.add("CN");
    }
  }
  return [...codes];
}

function displayName(group) {
  const m = group.match(/（([^）]*)）\s*$/);
  if (m) {
    const before = m[1].split("·")[0].trim();
    if (before) return before;
  }
  const head = group.replace(/（[^）]*）\s*$/, "").trim();
  return head.split(/[/｜|]/)[0].trim() || group;
}

function brandKey(group) {
  const m = group.match(/（([^）]+)）\s*$/);
  return (m ? m[1] : group).trim();
}

const rows = [];
const seen = new Set();

function push(row) {
  if (!row.group || row.line === "agent") return;
  if (!["cash", "bnpl", "lease"].includes(row.line)) return;
  const key = `${row.line}|${brandKey(row.group)}`;
  if (seen.has(key)) return;
  const markets = marketsFrom(row.group, row.countries || "");
  if (!markets.length) return;
  seen.add(key);
  const name = displayName(row.group);
  let extra = (row.extra || "").replace(/\s+/g, " ").trim();
  if (!extra || extra === row.group || extra === name) extra = "";
  if (extra.length > 80) extra = `${extra.slice(0, 79)}…`;
  rows.push({
    id: key,
    name,
    line: row.line,
    markets,
    extra,
  });
}

for (const block of topObjects(sliceArray("creditsCore"))) {
  push({
    line: field(block, "line"),
    group: field(block, "group"),
    countries: field(block, "countries"),
    extra: field(block, "brands"),
  });
}

const tupleRe = /\["[a-z-]+",\s*"(cash|bnpl|lease|agent)",\s*"((?:\\.|[^"\\])*)"\]/g;
for (const name of ["creditCrmSeedTuples", "luffyCreditSeedTuples"]) {
  const src = sliceArray(name);
  for (const m of src.matchAll(tupleRe)) {
    push({ line: m[1], group: unescape(m[2]), countries: "", extra: "" });
  }
}

for (const name of [
  "NFRA_CONSUMER_FINANCE_HOLDERS",
  "NFRA_AUTO_FINANCE_HOLDERS",
  "NFRA_FIN_LEASE_HOLDERS",
  "OJK_LPBBTI_HOLDERS",
  "PH_DIGITAL_BANK_HOLDERS",
]) {
  for (const block of topObjects(sliceArray(name))) {
    push({
      line: field(block, "line"),
      group: field(block, "group"),
      countries: "",
      extra: field(block, "licenseKindLabel"),
    });
  }
}

for (const file of ["ph-sec-lending-roster.json", "in-nbfc-digital-roster.json"]) {
  const data = JSON.parse(readFileSync(join(root, "src/data", file), "utf8"));
  for (const c of data.companies) {
    push({ line: c.line, group: c.group, countries: "", extra: c.kind });
  }
}

rows.sort((a, b) => a.name.localeCompare(b.name, "zh") || a.line.localeCompare(b.line));

const out = {
  note: "信贷原生玩家（现金贷、消费分期/BNPL、信用租赁）。不含场景原生，不含信贷超市。",
  players: rows,
};
writeFileSync(join(root, "src/data/cashloanCreditPlayers.json"), `${JSON.stringify(out, null, 2)}\n`);

const by = {};
for (const p of rows) for (const m of p.markets) (by[m] ??= []).push(p.name);
console.log("players", rows.length);
for (const code of ["ID", "PH", "MX", "IN", "CN", "TH"]) {
  const names = by[code] ?? [];
  console.log(code, names.length, names.slice(0, 12).join(" | "));
}
