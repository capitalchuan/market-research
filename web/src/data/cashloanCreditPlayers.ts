import raw from "./cashloanCreditPlayers.json";

export type CreditPlayerLine = "cash" | "bnpl" | "lease";

export type CreditPlayer = {
  id: string;
  name: string;
  line: CreditPlayerLine;
  markets: string[];
  extra: string;
};

const LINE_LABEL: Record<CreditPlayerLine, string> = {
  cash: "现金贷",
  bnpl: "消费分期",
  lease: "信用租赁",
};

export type CreditPlayerCard = {
  id: string;
  name: string;
  lines: string;
  extra: string;
};

/** 某国信贷原生玩家。同名分国卡合并，本地卡优先。 */
export function creditPlayersIn(code: string): CreditPlayerCard[] {
  const grouped = new Map<string, { id: string; name: string; lineSet: Set<CreditPlayerLine>; extra: string; localExtra: string }>();
  for (const p of raw.players as CreditPlayer[]) {
    if (!p.markets.includes(code)) continue;
    const key = p.name.trim().toLowerCase();
    const local = p.id.endsWith(`·${code}`);
    let card = grouped.get(key);
    if (!card) {
      card = { id: p.id, name: p.name, lineSet: new Set(), extra: "", localExtra: "" };
      grouped.set(key, card);
    }
    card.lineSet.add(p.line);
    if (local && p.extra) card.localExtra = p.extra;
    else if (p.extra && !card.extra) card.extra = p.extra;
    if (local) card.id = p.id;
  }
  const lineOrder: CreditPlayerLine[] = ["cash", "bnpl", "lease"];
  return [...grouped.values()]
    .map((card) => ({
      id: card.id,
      name: card.name,
      lines: lineOrder.filter((line) => card.lineSet.has(line)).map((line) => LINE_LABEL[line]).join(" / "),
      extra: card.localExtra || card.extra,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh"));
}
