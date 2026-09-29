import type { CSSProperties } from "react";
import {
  canViewPartnerDetail,
  maskIfGuest,
  partnerPublicName,
  SENSITIVE_MASK,
} from "./authAccess";
import type { InvestedCountry } from "./data/producerHoldings";
import { formatUsdCompact } from "./data/producerHoldings";
import {
  formatProducerListingLine,
  listingsForProducer,
} from "./data/storeListingStatus";
import { MapKV, MapMuted, MapSection, useMapChrome } from "./HeatMapChrome";
import { useCanvasState } from "./shims/cursor-canvas";
import { detectBrowserUiLang, type UiLang } from "./uiI18n";

/** 国别详情里的合作机构/已投生产商块；访客脱敏为 ** */
export function PartnerHoldingsSection({
  invested,
  dense = false,
  showEmpty = false,
  title,
}: {
  invested: InvestedCountry | undefined;
  dense?: boolean;
  /** 无持仓时是否仍渲染空态 */
  showEmpty?: boolean;
  title?: string;
}) {
  const { c } = useMapChrome();
  const [session] = useCanvasState("authSession1", "");
  const [uiLang] = useCanvasState<UiLang>("uiLang1", detectBrowserUiLang());
  const en = uiLang === "en";
  const guest = !canViewPartnerDetail(session);
  const sectionTitle =
    title ?? (guest ? (en ? "Partners" : "合作机构") : en ? "Invested producers" : "已投生产商");

  if (!invested) {
    if (!showEmpty) return null;
    return (
      <MapSection title={sectionTitle} dense={dense}>
        <MapMuted>{en ? "No partner records for this country" : "该国暂无合作机构记录"}</MapMuted>
      </MapSection>
    );
  }

  const cardStyle: CSSProperties = {
    background: c.fillSoft,
    borderRadius: 6,
    border: `1px solid ${c.panelBorder}`,
    padding: "8px 10px",
    fontSize: 12,
  };

  return (
    <MapSection title={sectionTitle} dense={dense}>
      {guest ? (
        <MapMuted>
          {en
            ? `Guests see coverage only; names & holdings masked (${SENSITIVE_MASK})`
            : `访客仅可见展业覆盖；机构名与持仓已脱敏（${SENSITIVE_MASK}）`}
        </MapMuted>
      ) : null}
      <MapKV
        k={en ? "Fund investment total" : "基金投资合计"}
        v={guest ? SENSITIVE_MASK : formatUsdCompact(invested.investment_usd)}
        dense={dense}
      />
      <MapKV
        k={en ? "Heat outstanding total" : "热力在贷合计"}
        v={guest ? SENSITIVE_MASK : formatUsdCompact(invested.outstanding_usd_for_heat)}
        dense={dense}
      />
      <MapKV k={en ? "Platforms" : "平台数"} v={String(invested.producers.length)} dense={dense} />
      {!guest ? (
      <div style={{ marginTop: dense ? 8 : 10, display: "flex", flexDirection: "column", gap: dense ? 8 : 10 }}>
        {invested.producers.map((p, i) => (
          <div key={p.id} style={cardStyle}>
            <div style={{ fontWeight: 600, color: c.accent, marginBottom: 4 }}>
              {partnerPublicName(guest, p.name, i)}
            </div>
            <div style={{ color: c.textTertiary, marginBottom: 6 }}>{p.product_type}</div>
            <MapKV k={en ? "Fund investment" : "基金投资"} v={formatUsdCompact(p.investment_usd)} />
            <MapKV k={en ? "Outstanding" : "在贷余额"} v={p.outstanding_display} />
            <MapKV k={en ? "Customers served" : "服务客户数"} v={p.customers_display} />
            {p.ranking_note ? (
              <MapKV k={en ? "Rank / positioning" : "排名/定位"} v={p.ranking_note} />
            ) : null}
            {(() => {
              const line = formatProducerListingLine(
                listingsForProducer(p.name, invested.country_code),
                en ? "en" : "zh",
              );
              if (!line) return null;
              return <MapKV k={en ? "Store listing" : "商店在架"} v={line} />;
            })()}
          </div>
        ))}
      </div>
      ) : (
        <div style={{ marginTop: dense ? 8 : 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {invested.producers.map((p, i) => (
            <div key={p.id} style={cardStyle}>
              <div style={{ fontWeight: 600, color: c.accent }}>{partnerPublicName(true, p.name, i)}</div>
              <div style={{ color: c.textTertiary, marginTop: 4 }}>
                {en
                  ? `Fund ${SENSITIVE_MASK} · Heat outstanding ${SENSITIVE_MASK}`
                  : `基金投资 ${SENSITIVE_MASK} · 热力在贷 ${SENSITIVE_MASK}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </MapSection>
  );
}

/** 宏观详情里的简短已投对照 */
export function PartnerHoldingsBrief({
  invested,
  dense = false,
}: {
  invested: InvestedCountry | undefined;
  dense?: boolean;
}) {
  const [session] = useCanvasState("authSession1", "");
  const [uiLang] = useCanvasState<UiLang>("uiLang1", detectBrowserUiLang());
  const en = uiLang === "en";
  const guest = !canViewPartnerDetail(session);
  if (!invested) return null;
  return (
    <MapSection
      title={guest ? (en ? "Partners overview" : "合作机构对照") : en ? "Invested overview" : "已投对照"}
      dense={dense}
    >
      {guest ? (
        <MapMuted>{en ? `Guest-masked (${SENSITIVE_MASK})` : `访客已脱敏（${SENSITIVE_MASK}）`}</MapMuted>
      ) : null}
      <MapKV
        k={en ? "Fund investment" : "基金投资"}
        v={guest ? SENSITIVE_MASK : formatUsdCompact(invested.investment_usd)}
        dense={dense}
      />
      <MapKV
        k={en ? "Heat outstanding" : "热力在贷"}
        v={guest ? SENSITIVE_MASK : formatUsdCompact(invested.outstanding_usd_for_heat)}
        dense={dense}
      />
      <MapKV k={en ? "Platforms" : "平台数"} v={String(invested.producers.length)} dense={dense} />
    </MapSection>
  );
}

export function useGuestMask() {
  const [session] = useCanvasState("authSession1", "");
  const guest = !canViewPartnerDetail(session);
  return {
    guest,
    mask: (v: string) => maskIfGuest(guest, v),
    maskUsd: (n: number) => maskIfGuest(guest, formatUsdCompact(n)),
  };
}
