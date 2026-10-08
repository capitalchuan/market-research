/**
 * 个人现金贷主入口：国家总览 → 标的总览 → 已投平台。
 * 首页公开总量、已投国家和打分。底层平台名称仍要登录。登录与原先邮箱密码同一套。
 */
import { useMemo, useState, type CSSProperties } from "react";
import { ClaimLoginHost, InvestedGate, LoginButton, useCanViewInvested } from "./ClaimLogin";
import { COMPANY_CHANNEL_LABEL, COMPANY_TAG_ORDER, companiesIn, type CompanyCard, type CompanyFact } from "./data/cashloanCompanies";
import { INST_ECO_BUCKETS, instEcoForCountry, type InstEcoItem } from "./data/cashloanInstEco";
import { scoreCashloanMacro } from "./data/cashloanMacroScore";
import { COUNTRY_MACRO } from "./data/countryMacro";
import {
  LICENSE_CREDIT_PRIORITY,
  type LicenseCreditEntry,
} from "./data/countryLicenseCreditPriority";
import { FINTECH_STOCK_QUOTES } from "./data/fintechStockQuotes";
import { COUNTRY_LABEL_ZH, NBFC_STATS } from "./data/nbfcCountryStats";
import {
  formatUsdCompact,
  formatUsdZh,
  INVESTED_BY_CODE,
  PRODUCER_HOLDINGS,
  type HoldingFacility,
  type HoldingProducer,
} from "./data/producerHoldings";
import { STORE_RANK_FINANCE, type StoreRankEntry } from "./data/storeRankFinance";
import { summarizeNbfcForCountry } from "./data/countryZoomDetails";
import { FullMarketChoropleth } from "./FullMarketChoropleth";
import { FigureText, ScreenSegChip, ScreenSegTrack } from "./HeatMapChrome";
import { Button, Row, Stack, Text, useCanvasState, useHostTheme } from "./shims/cursor-canvas";

type Step = "size" | "screen" | "book";

const STORE_TOP_N = 20;

type CountryRow = {
  code: string;
  name: string;
  loanBn: number;
  score: number | null;
  candidateCount: number;
  investedCount: number;
};

function countryName(code: string): string {
  return COUNTRY_LABEL_ZH[code] ?? code;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "").replace(/[（(].*$/, "");
}

function namesTouch(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (na.length >= 2 && nb.length >= 2 && (na.includes(nb) || nb.includes(na))) return true;
  const tokens = (s: string) => s.split(/[^a-z0-9\u4e00-\u9fff]+/).filter((t) => t.length >= 4);
  const ta = tokens(na);
  const tb = tokens(nb);
  return ta.some((t) => tb.some((u) => t === u || t.includes(u) || u.includes(t)));
}

function loanBookByCode(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of NBFC_STATS.rows) {
    const bn = row.loan_book_usd_bn;
    if (bn != null && bn > 0) out[row.country_code] = (out[row.country_code] ?? 0) + bn;
  }
  return out;
}

function rosterIn(code: string): LicenseCreditEntry[] {
  return LICENSE_CREDIT_PRIORITY.entries
    .filter((e) => e.market === code && e.crmStatus !== "rail")
    .sort((a, b) => (a.priority ?? 9) - (b.priority ?? 9) || a.nameZh.localeCompare(b.nameZh, "zh"));
}

function producersIn(code: string): HoldingProducer[] {
  return PRODUCER_HOLDINGS.producers.filter((p) => p.countries.includes(code));
}

function matchesInvested(code: string, label: string): HoldingProducer | undefined {
  return producersIn(code).find(
    (p) => namesTouch(label, p.name) || namesTouch(label, p.entity) || namesTouch(label, p.id),
  );
}

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function fmtX(n: number | null): string {
  if (n == null) return "—";
  return `${n.toFixed(2)}x`;
}

export function MicroloanDesk() {
  return (
    <ClaimLoginHost>
      <MicroloanDeskBody />
    </ClaimLoginHost>
  );
}

function MicroloanDeskBody() {
  const theme = useHostTheme();
  const canSeeInvested = useCanViewInvested();
  const [, setSession] = useCanvasState("authSession1", "");
  const [, setEmail] = useCanvasState("claimEmail1", "");
  const [step, setStep] = useState<Step>("size");
  const [country, setCountry] = useState<string | null>(null);
  const [producerId, setProducerId] = useState<string | null>(null);
  const [macroCode, setMacroCode] = useState<string | null>(null);

  const loan = useMemo(() => loanBookByCode(), []);
  const storeByCountry = useMemo(() => {
    const out: Record<string, StoreRankEntry[]> = {};
    for (const e of STORE_RANK_FINANCE.entries) {
      if (e.rank > STORE_TOP_N || (e.store !== "ios" && e.store !== "gp")) continue;
      (out[e.country] ??= []).push(e);
    }
    for (const list of Object.values(out)) list.sort((a, b) => a.rank - b.rank);
    return out;
  }, []);

  const rows = useMemo<CountryRow[]>(() => {
    const codes = new Set<string>([
      ...NBFC_STATS.rows.map((r) => r.country_code),
      ...Object.keys(COUNTRY_MACRO),
    ]);
    const list: CountryRow[] = [];
    for (const code of codes) {
      const score = scoreCashloanMacro(code);
      const stocks = FINTECH_STOCK_QUOTES.items.filter(
        (it) => it.country === code || it.markets?.includes(code),
      ).length;
      const apps = storeByCountry[code]?.length ?? 0;
      const roster = rosterIn(code).length;
      list.push({
        code,
        name: countryName(code),
        loanBn: loan[code] ?? 0,
        score,
        candidateCount: roster + stocks + apps,
        investedCount: producersIn(code).length,
      });
    }
    list.sort((a, b) => {
      if (canSeeInvested) {
        const invested = Number(b.investedCount > 0) - Number(a.investedCount > 0);
        if (invested !== 0) return invested;
      }
      const as = a.score ?? -1;
      const bs = b.score ?? -1;
      if (bs !== as) return bs - as;
      return a.name.localeCompare(b.name, "zh");
    });
    return list;
  }, [loan, storeByCountry, canSeeInvested]);

  const noUsd = rows.filter((r) => r.loanBn <= 0);
  const selected = rows.find((r) => r.code === country) ?? null;

  const border = `1px solid ${theme.stroke.tertiary}`;
  const panel: CSSProperties = {
    border,
    borderRadius: 8,
    background: theme.bg.elevated,
    padding: 12,
  };

  function openIdentify(code: string) {
    setCountry(code);
    setStep("screen");
  }

  function openBook(id: string) {
    setProducerId(id);
    setStep("book");
  }

  return (
    <Stack gap={14}>
      <Row gap={12} align="center" wrap>
        <span className="cashloan-title">个人现金贷</span>
        <ScreenSegTrack>
          <ScreenSegChip label="国家总览" active={step === "size"} onClick={() => setStep("size")} />
          <ScreenSegChip
            label="标的总览"
            active={step === "screen"}
            onClick={() => {
              setStep("screen");
              if (!country && rows[0]) setCountry(rows[0].code);
            }}
          />
          <ScreenSegChip label="已投平台" active={step === "book"} onClick={() => setStep("book")} />
        </ScreenSegTrack>
        {canSeeInvested ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSession("");
              setEmail("");
            }}
          >
            退出
          </Button>
        ) : (
          <LoginButton />
        )}
        {country ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCountry(null);
              setProducerId(null);
              setMacroCode(null);
            }}
          >
            清除国家 · {countryName(country)}
          </Button>
        ) : (
          <Text size="small" tone="tertiary">
            全球 · 未选国家
          </Text>
        )}
      </Row>

      {step === "size" ? (
        <SizeStep
          noUsd={noUsd}
          selected={selected}
          macroCode={macroCode}
          onMacroClose={() => setMacroCode(null)}
          onSelect={setCountry}
          onIdentify={openIdentify}
        />
      ) : null}

      {step === "screen" ? (
        <ScreenStep
          rows={rows}
          selected={selected}
          onSelect={setCountry}
          onMonitor={openBook}
          onOpenMacro={(code) => {
            setCountry(code);
            setMacroCode(code);
            setStep("size");
          }}
          panel={panel}
        />
      ) : null}

      {step === "book" ? (
        <InvestedGate>
          <BookStep
            country={country}
            producerId={producerId}
            onPickProducer={setProducerId}
            onClearProducer={() => setProducerId(null)}
            panel={panel}
          />
        </InvestedGate>
      ) : null}
    </Stack>
  );
}

function SizeStep({
  noUsd,
  selected,
  macroCode,
  onMacroClose,
  onSelect,
  onIdentify,
}: {
  noUsd: CountryRow[];
  selected: CountryRow | null;
  macroCode: string | null;
  onMacroClose: () => void;
  onSelect: (code: string) => void;
  onIdentify: (code: string) => void;
}) {
  const theme = useHostTheme();
  const summary = selected ? summarizeNbfcForCountry(selected.code) : null;
  return (
    <Stack gap={10}>
      {selected ? (
        <Row gap={8} align="center" wrap>
          <Text weight="semibold">
            {selected.name} · {selected.loanBn > 0 ? formatUsdZh(selected.loanBn * 1e9) : "无美元在贷"}
          </Text>
          <Button size="sm" variant="primary" onClick={() => onIdentify(selected.code)}>
            拿这国去识别
          </Button>
        </Row>
      ) : null}
      {summary && summary.rows.length > 1 ? (
        <Text size="small" tone="tertiary">
          {summary.rows
            .map((r) => `${r.category} ${r.loan_book_usd || "在贷未入美元"}`)
            .join(" · ")}
        </Text>
      ) : null}
      <div style={{ width: "100%", overflow: "hidden" }}>
        <FullMarketChoropleth
          height={520}
          legendPlacement="bottom"
          showMarket
          showInvested
          unmasked
          defaultYaw={-165}
          investedMarker="name"
          tone="chuan"
          detailFill
          detailCode={macroCode}
          onDetailClose={onMacroClose}
          onCountrySelect={onSelect}
        />
      </div>
      {noUsd.length ? (
        <div style={{ fontSize: 12, color: theme.text.tertiary, lineHeight: 1.6 }}>
          有名录、无美元在贷 {noUsd.length} 国：
          {noUsd.map((r) => (
            <button
              key={r.code}
              type="button"
              onClick={() => onIdentify(r.code)}
              style={{
                marginLeft: 8,
                padding: 0,
                border: "none",
                background: "transparent",
                color: theme.text.link,
                cursor: "pointer",
                font: "inherit",
                fontSize: 12,
              }}
            >
              {r.name}
            </button>
          ))}
        </div>
      ) : null}
    </Stack>
  );
}

function CompanyFactLines({ label, facts }: { label: string; facts: CompanyFact[] }) {
  const theme = useHostTheme();
  if (!facts.length) return null;
  return (
    <div style={{ fontSize: 13, fontWeight: 400, color: theme.text.secondary, lineHeight: 1.5 }}>
      <span style={{ color: theme.text.tertiary }}>{label} </span>
      {facts.map((fact, index) => (
        <span key={`${label}-${index}`}>
          {index ? " · " : null}
          <FigureText text={fact.text} />
          <span style={{ color: theme.text.tertiary }}>（{fact.source}）</span>
        </span>
      ))}
    </div>
  );
}

const HOLDING_SOURCE = /已投|投委会|持仓|Potential Investment|IC Report|monthly_summary|授信报告|投资案例/;

function isHoldingFact(fact: CompanyFact): boolean {
  return HOLDING_SOURCE.test(fact.source) || fact.text.startsWith("本基金投资");
}

function isPublicCompany(card: CompanyCard): boolean {
  if (card.channels.some((ch) => ch !== "invested")) return true;
  return card.iosRanks.length > 0 || card.listing != null;
}

function CompanyCardView({
  card,
  onMonitor,
}: {
  card: CompanyCard;
  onMonitor: (producerId: string) => void;
}) {
  const theme = useHostTheme();
  const canSeeInvested = useCanViewInvested();
  const invested = canSeeInvested && card.investedId
    ? PRODUCER_HOLDINGS.producers.find((p) => p.id === card.investedId)
    : undefined;
  const tags = COMPANY_TAG_ORDER.filter((ch) => card.channels.includes(ch) && (canSeeInvested || ch !== "invested"));
  const license = canSeeInvested ? card.license : card.license.filter((fact) => !isHoldingFact(fact));
  const scale = canSeeInvested ? card.scale : card.scale.filter((fact) => !isHoldingFact(fact));
  const quality = canSeeInvested ? card.quality : card.quality.filter((fact) => !isHoldingFact(fact));
  const book = canSeeInvested ? card.book : card.book.filter((fact) => !isHoldingFact(fact));
  const holdingHidden = !canSeeInvested && (card.investedId != null || card.channels.includes("invested"));
  return (
    <div style={{ padding: "4px 0 16px" }}>
      <Row gap={8} align="center" wrap>
        <Text weight="semibold">{card.name}</Text>
        {tags.map((ch) => (
          <span
            key={ch}
            style={{
              fontSize: 11,
              lineHeight: "18px",
              padding: "0 6px",
              borderRadius: 4,
              border: `1px solid ${theme.stroke.tertiary}`,
              color: theme.text.secondary,
              whiteSpace: "nowrap",
            }}
          >
            {COMPANY_CHANNEL_LABEL[ch]}
          </span>
        ))}
        {holdingHidden ? <LoginButton /> : null}
        {invested ? (
          <Button size="sm" variant="primary" onClick={() => onMonitor(invested.id)}>
            {`去监控 · ${invested.name}`}
          </Button>
        ) : null}
      </Row>
      {card.identity ? (
        <div style={{ fontSize: 13, fontWeight: 400, color: theme.text.secondary, lineHeight: 1.5 }}>
          <FigureText text={card.identity} />
        </div>
      ) : null}
      <CompanyFactLines
        label="iOS商店排名"
        facts={card.iosRanks.map((rank) => ({
          text: `#${rank.rank} ${rank.appName} · ${rank.asOf}`,
          source: rank.source,
        }))}
      />
      <CompanyFactLines label="牌照" facts={license} />
      <CompanyFactLines label="规模" facts={scale} />
      <CompanyFactLines label="质量" facts={quality} />
      <CompanyFactLines label="财报" facts={card.filing} />
      {card.listing ? <CompanyFactLines label="上市" facts={[card.listing]} /> : null}
      <CompanyFactLines label="关系" facts={book} />
    </div>
  );
}

function ScreenStep({
  rows,
  selected,
  onSelect,
  onMonitor,
  onOpenMacro,
  panel,
}: {
  rows: CountryRow[];
  selected: CountryRow | null;
  onSelect: (code: string) => void;
  onMonitor: (producerId: string) => void;
  onOpenMacro: (code: string) => void;
  panel: CSSProperties;
}) {
  const theme = useHostTheme();
  const [query, setQuery] = useState("");
  const [pane, setPane] = useState<"target" | "eco">("target");
  const [ecoBucket, setEcoBucket] = useState<(typeof INST_ECO_BUCKETS)[number]["id"]>("compliance");
  const q = query.trim().toLowerCase();
  const visible = q
    ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q))
    : rows;
  const canSeeInvested = useCanViewInvested();
  const companies = selected
    ? companiesIn(selected.code)
        .filter((card) => canSeeInvested || isPublicCompany(card))
        .sort((a, b) => {
          if (canSeeInvested && a.investedId !== b.investedId) {
            return Number(b.investedId != null) - Number(a.investedId != null);
          }
          const pa = a.priority ?? 9;
          const pb = b.priority ?? 9;
          if (pa !== pb) return pa - pb;
          return a.name.localeCompare(b.name, "zh");
        })
    : [];
  const androidMissing = selected
    ? !STORE_RANK_FINANCE.entries.some((e) => e.country === selected.code && e.store === "gp" && e.rank <= STORE_TOP_N)
    : false;

  return (
    <Stack gap={10}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 280px) minmax(0, 1fr)", gap: 12 }}>
        <div style={{ ...panel, maxHeight: "72vh", overflow: "auto", padding: 0 }}>
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 1,
              padding: 8,
              background: theme.bg.elevated,
              borderBottom: `1px solid ${theme.stroke.tertiary}`,
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索国家"
              aria-label="搜索国家"
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: `1px solid ${theme.stroke.secondary}`,
                borderRadius: 6,
                background: theme.bg.editor,
                color: theme.text.primary,
                font: "inherit",
                fontSize: 13,
                padding: "6px 8px",
              }}
            />
          </div>
          {visible.length ? null : (
            <div style={{ padding: "10px 12px", fontSize: 13, color: theme.text.tertiary }}>无匹配国家</div>
          )}
          {visible.map((r) => {
            const on = r.code === selected?.code;
            return (
              <button
                key={r.code}
                type="button"
                onClick={() => onSelect(r.code)}
                style={{
                  display: "flex",
                  width: "100%",
                  gap: 8,
                  alignItems: "baseline",
                  textAlign: "left",
                  padding: "8px 10px",
                  border: "none",
                  borderBottom: `1px solid ${theme.stroke.tertiary}`,
                  background: on ? theme.fill.tertiary : "transparent",
                  color: theme.text.primary,
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: 13,
                }}
              >
                <span style={{ flex: 1 }}>{r.name}</span>
                <span style={{ width: 36, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {r.score == null ? "—" : Math.round(r.score)}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ minWidth: 0 }}>
        <Stack gap={10}>
          {!selected ? null : (
            <>
              <Row gap={10} align="center" wrap>
                <Text weight="semibold">
                  {selected.name} · 国家综合打分 {selected.score == null ? "—" : Math.round(selected.score)}
                </Text>
                <Button size="sm" variant="primary" onClick={() => onOpenMacro(selected.code)}>
                  国家宏观
                </Button>
                <Text size="small" tone="tertiary">
                  公司 {companies.length}
                  {canSeeInvested ? ` · 已投 ${selected.investedCount}` : ""}
                </Text>
              </Row>
              <ScreenSegTrack>
                <ScreenSegChip label="标的" active={pane === "target"} onClick={() => setPane("target")} />
                <ScreenSegChip label="生态" active={pane === "eco"} onClick={() => setPane("eco")} />
              </ScreenSegTrack>
              {pane === "target" ? (
                <Stack gap={8}>
                  {androidMissing ? (
                    <Text size="small" tone="tertiary">
                      Android 商店排名本地未收录，下面只列 iOS Finance 免费榜。
                    </Text>
                  ) : null}
                  {companies.length ? (
                    <Stack gap={6}>
                      {companies.map((card) => (
                        <CompanyCardView key={card.id} card={card} onMonitor={onMonitor} />
                      ))}
                    </Stack>
                  ) : (
                    <Text size="small" tone="tertiary">这一国没有对上的公司。</Text>
                  )}
                </Stack>
              ) : (
                <Stack gap={8}>
                  <ScreenSegTrack>
                    {INST_ECO_BUCKETS.map((bucket) => (
                      <ScreenSegChip
                        key={bucket.id}
                        label={bucket.label}
                        active={ecoBucket === bucket.id}
                        onClick={() => setEcoBucket(bucket.id)}
                      />
                    ))}
                  </ScreenSegTrack>
                  <EcoBuckets code={selected.code} bucketId={ecoBucket} panel={panel} onMonitor={onMonitor} />
                </Stack>
              )}
            </>
          )}
        </Stack>
        </div>
      </div>
    </Stack>
  );
}

function EcoBuckets({
  code,
  bucketId,
  panel,
  onMonitor,
}: {
  code: string;
  bucketId: (typeof INST_ECO_BUCKETS)[number]["id"];
  panel: CSSProperties;
  onMonitor: (producerId: string) => void;
}) {
  const bucket = INST_ECO_BUCKETS.find((b) => b.id === bucketId) ?? INST_ECO_BUCKETS[0];
  const items = instEcoForCountry(code)[bucket.id];
  const byType = new Map<string, InstEcoItem[]>();
  for (const item of items) {
    const list = byType.get(item.type) ?? [];
    list.push(item);
    byType.set(item.type, list);
  }
  const missing = bucket.types.filter((type) => !byType.has(type));
  return (
    <Stack gap={8}>
      {bucket.types.filter((type) => byType.has(type)).map((type) => (
        <Stack key={type} gap={6}>
          <Text size="small" tone="secondary">
            {type}
          </Text>
          {byType.get(type)!.map((item) => {
            const hit = matchesInvested(code, item.name);
            return (
              <div key={`${type}-${item.name}`} style={{ ...panel, padding: "8px 10px" }}>
                <Row gap={8} align="center" wrap>
                  <Text weight="semibold">{item.name}</Text>
                  {hit ? (
                    <InvestedGate>
                      <Button size="sm" variant="primary" onClick={() => onMonitor(hit.id)}>
                        {`去监控 · ${hit.name}`}
                      </Button>
                    </InvestedGate>
                  ) : null}
                </Row>
                {item.extra ? (
                  <Text size="small" tone="tertiary">
                    {item.extra}
                  </Text>
                ) : null}
              </div>
            );
          })}
        </Stack>
      ))}
      {missing.length ? (
        <Text size="small" tone="tertiary">
          {missing.join("、")}未收录
        </Text>
      ) : null}
    </Stack>
  );
}

function BookStep({
  country,
  producerId,
  onPickProducer,
  onClearProducer,
  panel,
}: {
  country: string | null;
  producerId: string | null;
  onPickProducer: (id: string) => void;
  onClearProducer: () => void;
  panel: CSSProperties;
}) {
  const theme = useHostTheme();
  const visible = country
    ? PRODUCER_HOLDINGS.facilities.filter((f) => facilityInCountry(f, country))
    : PRODUCER_HOLDINGS.facilities;
  const focus = producerId
    ? visible.filter((f) => facilityProducer(f)?.id === producerId)
    : visible;
  const producer = PRODUCER_HOLDINGS.producers.find((p) => p.id === producerId) ?? null;
  const money = (n: number | null | undefined) => formatUsdCompact(n);

  return (
    <Stack gap={10}>
      <Text size="small" tone="secondary">
        已投合计 {formatUsdCompact(PRODUCER_HOLDINGS.total_investment_usd)} ·{" "}
        {PRODUCER_HOLDINGS.countries.length} 国 · {PRODUCER_HOLDINGS.producers.length} 家生产商 · 时点{" "}
        {PRODUCER_HOLDINGS.as_of}
        {country ? ` · 已按 ${countryName(country)} 过滤` : " · 全组合"}
      </Text>
      {producer ? (
        <Row gap={8} align="center" wrap>
          <Button size="sm" variant="ghost" onClick={onClearProducer}>
            清除生产商
          </Button>
        </Row>
      ) : null}
      <div style={{ overflowX: "auto", ...panel, padding: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["生产商", "国家", "产品", "投资", "优先收益", "基准覆盖", "当前覆盖", "起始"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "8px 10px",
                    borderBottom: `1px solid ${theme.stroke.secondary}`,
                    color: theme.text.tertiary,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {focus.map((f) => {
              const prod = facilityProducer(f);
              const on = prod?.id === producerId;
              return (
                <tr
                  key={f.code}
                  onClick={() => prod && onPickProducer(prod.id)}
                  style={{ cursor: "pointer", background: on ? theme.fill.tertiary : "transparent" }}
                >
                  <td style={td(theme)}>{prod?.name ?? f.producer_short}</td>
                  <td style={td(theme)}>{f.country_zh}</td>
                  <td style={td(theme)}>{f.product_type}</td>
                  <td style={td(theme)}>{money(f.investment_usd)}</td>
                  <td style={td(theme)}>{fmtPct(f.priority_yield)}</td>
                  <td style={td(theme)}>{fmtX(f.benchmark_coverage)}</td>
                  <td style={td(theme)}>{fmtX(f.current_coverage)}</td>
                  <td style={td(theme)}>{f.start_date ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {producer ? (
        <div style={panel}>
          <Text weight="semibold">{producer.name}</Text>
          <Text size="small" tone="secondary">
            {producer.countries_zh} · {producer.product_type}
          </Text>
          <Text size="small">在贷 {money(producer.outstanding_usd)} · {producer.outstanding_note ?? ""}</Text>
          <Text size="small">客户 {producer.customers_note ?? producer.customers ?? "—"}</Text>
          {producer.yield_note ? <Text size="small">收益 {producer.yield_note}</Text> : null}
          {producer.benchmark_coverage_note ? (
            <Text size="small">覆盖 {producer.benchmark_coverage_note}</Text>
          ) : null}
          {producer.license_note ? <Text size="small">牌照 {producer.license_note}</Text> : null}
          {producer.ranking_note ? <Text size="small">定位 {producer.ranking_note}</Text> : null}
        </div>
      ) : null}
      {focus.length === 0 && country ? (
        <Text size="small" tone="tertiary">
          {countryName(country)} 没有已投设施。
        </Text>
      ) : null}
    </Stack>
  );
}

function facilityProducer(f: HoldingFacility): HoldingProducer | undefined {
  return PRODUCER_HOLDINGS.producers.find(
    (p) => namesTouch(f.producer_short, p.name) || namesTouch(f.producer_short, p.id) || f.entity.includes(p.name),
  );
}

function facilityInCountry(f: HoldingFacility, code: string): boolean {
  const invested = INVESTED_BY_CODE[code];
  if (!invested) return false;
  if (invested.country_zh && f.country_zh === invested.country_zh) return true;
  const prod = facilityProducer(f);
  return Boolean(prod && prod.countries.includes(code) && f.country_zh === invested.country_zh);
}

function td(theme: ReturnType<typeof useHostTheme>): CSSProperties {
  return {
    padding: "8px 10px",
    borderBottom: `1px solid ${theme.stroke.tertiary}`,
    verticalAlign: "top",
    whiteSpace: "nowrap",
  };
}
