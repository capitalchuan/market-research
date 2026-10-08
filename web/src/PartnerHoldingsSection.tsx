import type { CSSProperties } from "react";
import {
  canViewPartnerDetail,
  maskIfGuest,
  partnerPublicName,
  SENSITIVE_MASK,
} from "./authAccess";
import type { InvestedCountry } from "./data/producerHoldings";
import { formatUsdCompact } from "./data/producerHoldings";
import { MapKV, MapMuted, MapSection, useMapChrome } from "./HeatMapChrome";
import { useCanvasState } from "./shims/cursor-canvas";

/** 国别详情里的合作机构/已投生产商块；访客脱敏为 ** */
export function PartnerHoldingsSection({
  invested,
  dense = false,
  showEmpty = false,
  title,
  unmasked = false,
  large = false,
}: {
  invested: InvestedCountry | undefined;
  dense?: boolean;
  /** 无持仓时是否仍渲染空态 */
  showEmpty?: boolean;
  title?: string;
  /** 独立入口不读登录态，机构名与金额原样显示 */
  unmasked?: boolean;
  large?: boolean;
}) {
  const { c } = useMapChrome();
  const [session] = useCanvasState("authSession1", "");
  const guest = unmasked ? false : !canViewPartnerDetail(session);
  const sectionTitle = title ?? (guest ? "合作机构" : "已投生产商");

  if (!invested) {
    if (!showEmpty) return null;
    return (
      <MapSection title={sectionTitle} dense={dense} large={large}>
        <MapMuted>该国暂无合作机构记录</MapMuted>
      </MapSection>
    );
  }

  const cardStyle: CSSProperties = {
    background: c.fillSoft,
    borderRadius: 6,
    border: `1px solid ${c.panelBorder}`,
    padding: large ? "16px 18px" : "8px 10px",
    fontSize: large ? 17 : 12,
  };

  return (
    <MapSection title={sectionTitle} dense={dense} large={large}>
      {guest ? (
        <MapMuted>访客仅可见展业覆盖；机构名与持仓已脱敏（{SENSITIVE_MASK}）</MapMuted>
      ) : null}
      <MapKV k="基金投资合计" v={guest ? SENSITIVE_MASK : formatUsdCompact(invested.investment_usd)} dense={dense} large={large} />
      <MapKV
        k="热力在贷合计"
        v={guest ? SENSITIVE_MASK : formatUsdCompact(invested.outstanding_usd_for_heat)}
        dense={dense}
        large={large}
      />
      <MapKV k="平台数" v={String(invested.producers.length)} dense={dense} large={large} />
      {!guest ? (
      <div style={{ marginTop: dense ? 8 : 10, display: "flex", flexDirection: "column", gap: dense ? 8 : 10 }}>
        {invested.producers.map((p, i) => (
          <div key={p.id} style={cardStyle}>
            <div style={{ fontWeight: 600, color: c.accent, marginBottom: 4, fontSize: large ? 20 : undefined }}>
              {partnerPublicName(guest, p.name, i)}
            </div>
            <div style={{ color: c.textTertiary, marginBottom: 6 }}>{p.product_type}</div>
            <MapKV k="基金投资" v={formatUsdCompact(p.investment_usd)} large={large} />
            <MapKV k="在贷余额" v={p.outstanding_display} large={large} />
            <MapKV k="服务客户数" v={p.customers_display} large={large} />
            {p.ranking_note ? <MapKV k="排名/定位" v={p.ranking_note} large={large} /> : null}
          </div>
        ))}
      </div>
      ) : (
        <div style={{ marginTop: dense ? 8 : 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {invested.producers.map((p, i) => (
            <div key={p.id} style={cardStyle}>
              <div style={{ fontWeight: 600, color: c.accent }}>{partnerPublicName(true, p.name, i)}</div>
              <div style={{ color: c.textTertiary, marginTop: 4 }}>
                基金投资 {SENSITIVE_MASK} · 热力在贷 {SENSITIVE_MASK}
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
  const guest = !canViewPartnerDetail(session);
  if (!invested) return null;
  return (
    <MapSection title={guest ? "合作机构对照" : "已投对照"} dense={dense}>
      {guest ? <MapMuted>访客已脱敏（{SENSITIVE_MASK}）</MapMuted> : null}
      <MapKV k="基金投资" v={guest ? SENSITIVE_MASK : formatUsdCompact(invested.investment_usd)} dense={dense} />
      <MapKV
        k="热力在贷"
        v={guest ? SENSITIVE_MASK : formatUsdCompact(invested.outstanding_usd_for_heat)}
        dense={dense}
      />
      <MapKV k="平台数" v={String(invested.producers.length)} dense={dense} />
    </MapSection>
  );
}

export function useGuestMask(unmasked = false) {
  const [session] = useCanvasState("authSession1", "");
  const guest = unmasked ? false : !canViewPartnerDetail(session);
  return {
    guest,
    mask: (v: string) => maskIfGuest(guest, v),
    maskUsd: (n: number) => maskIfGuest(guest, formatUsdCompact(n)),
  };
}
