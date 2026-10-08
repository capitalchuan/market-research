/**
 * 标的总览 · 生态：按原机构设计的四类归这一国已有主体。
 * 玩家（下场）不在这里，留在可选标的。
 */
import { LICENSE_CREDIT_PRIORITY } from "./countryLicenseCreditPriority";
import { EQUITY_INVESTOR_ROSTER } from "./equityInvestorRoster";
import { FINTECH_STOCK_QUOTES } from "./fintechStockQuotes";
import { NBFC_STATS } from "./nbfcCountryStats";
import { PAYMENT_SERVICE_ROSTER } from "./paymentServiceRoster";

export const INST_ECO_BUCKETS = [
  {
    id: "compliance",
    label: "合规中介",
    types: ["监管", "会计师事务所", "律师事务所", "评级机构"],
  },
  {
    id: "capital",
    label: "资本风险方",
    types: ["资金参与机构", "风险参与机构", "股权投资人"],
  },
  {
    id: "ops",
    label: "业务运营服务商",
    types: ["流量服务商", "回收机构", "权益服务商", "触达服务机构", "公关服务机构"],
  },
  {
    id: "infra",
    label: "基础设施服务商",
    types: ["数据服务方", "风控服务方", "支付服务机构", "信托服务机构"],
  },
] as const;

export type InstEcoBucketId = (typeof INST_ECO_BUCKETS)[number]["id"];

const ECO_TYPES = INST_ECO_BUCKETS.flatMap((b) => [...b.types]);

const TYPE_RE = new RegExp(`（(${ECO_TYPES.join("|")})(?:·([^）]*))?）`);

export type InstEcoItem = {
  name: string;
  type: string;
  extra: string;
};

function normName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

function keyName(groupKey: string): string {
  const head = groupKey.split("（")[0] ?? groupKey;
  const parts = head.split("｜").map((s) => s.trim()).filter(Boolean);
  return parts[0] || head.trim();
}

function parseTypedKey(groupKey: string): { name: string; type: string; detail: string; market: string } | null {
  const m = groupKey.match(TYPE_RE);
  if (!m) return null;
  const rest = (m[2] ?? "").split("·").filter(Boolean);
  const market = rest.length ? rest[rest.length - 1]! : "";
  const detail = rest.length > 1 ? rest.slice(0, -1).join("·") : "";
  return { name: keyName(groupKey), type: m[1]!, detail, market };
}

function pushItem(bag: Map<string, InstEcoItem>, item: InstEcoItem) {
  const key = `${item.type}\0${normName(item.name)}`;
  const prev = bag.get(key);
  if (!prev) {
    bag.set(key, item);
    return;
  }
  if (!prev.extra && item.extra) bag.set(key, item);
}

export function instEcoForCountry(code: string): Record<InstEcoBucketId, InstEcoItem[]> {
  const bag = new Map<string, InstEcoItem>();

  for (const row of NBFC_STATS.rows) {
    if (row.country_code !== code || !row.regulator?.trim()) continue;
    pushItem(bag, {
      name: row.regulator.trim(),
      type: "监管",
      extra: row.nbfc_equivalent_name || "",
    });
  }

  for (const e of LICENSE_CREDIT_PRIORITY.entries) {
    if (e.market !== code || !e.groupKey) continue;
    const parsed = parseTypedKey(e.groupKey);
    if (!parsed || (parsed.market && parsed.market !== code && parsed.market !== "全球")) continue;
    pushItem(bag, {
      name: parsed.name,
      type: parsed.type,
      extra: parsed.detail,
    });
  }

  for (const row of EQUITY_INVESTOR_ROSTER.rows) {
    if (row.locCode !== code) continue;
    pushItem(bag, {
      name: row.name,
      type: "股权投资人",
      extra: row.equityKind || "",
    });
  }

  for (const company of PAYMENT_SERVICE_ROSTER.companies) {
    const iso = company.group.match(/·([A-Z]{2})）\s*$/)?.[1];
    if (iso !== code) continue;
    pushItem(bag, {
      name: company.brands || keyName(company.group),
      type: "支付服务机构",
      extra: company.kind,
    });
  }

  for (const it of FINTECH_STOCK_QUOTES.items) {
    if (!it.groupKey) continue;
    const parsed = parseTypedKey(it.groupKey);
    if (!parsed) continue;
    const inMarket = it.country === code || it.markets?.includes(code);
    if (!inMarket) continue;
    pushItem(bag, {
      name: it.nameZh,
      type: parsed.type,
      extra: [parsed.detail, it.symbol].filter(Boolean).join(" · "),
    });
  }

  const out = {} as Record<InstEcoBucketId, InstEcoItem[]>;
  for (const bucket of INST_ECO_BUCKETS) {
    const types = new Set<string>(bucket.types);
    out[bucket.id] = [...bag.values()]
      .filter((item) => types.has(item.type))
      .sort((a, b) => bucket.types.indexOf(a.type as never) - bucket.types.indexOf(b.type as never) || a.name.localeCompare(b.name, "zh"));
  }
  return out;
}
