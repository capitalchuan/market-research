import { ABS_MATURITY_DIMENSIONS } from "./data/cashloanAbsMaturity";
import {
  ABS_ORDINANCE_REVIEWED,
  ABS_ORDINANCE_SCOPE,
  absVehicles,
  type AbsReading,
  type AbsVehicle,
} from "./data/cashloanAbsOrdinance";
import { FigureText, useMapChrome } from "./HeatMapChrome";
import { useLocale } from "./locale";
import { en } from "./enSurface";

function readingOf(vehicle: AbsVehicle, clause: string, lens: AbsReading["lens"]): AbsReading | undefined {
  return vehicle.readings.find((row) => row.clause === clause && row.lens === lens);
}

function Lens({ label, row }: { label: string; row: AbsReading | undefined }) {
  const { c } = useMapChrome();
  const { t } = useLocale();
  if (!row) return null;
  const article = row.article !== "—" ? row.article : "";
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 13, color: c.textTertiary, marginBottom: 6 }}>{t(label)}</div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 400,
          lineHeight: 1.55,
          color: row.cited ? c.text : c.textSecondary,
        }}
      >
        <FigureText text={row.finding} />
      </div>
      {article ? (
        <div style={{ marginTop: 6, fontSize: 12, color: c.textSecondary, lineHeight: 1.45 }}>{en(article)}</div>
      ) : null}
      {row.gap ? (
        <div style={{ marginTop: 4, fontSize: 12, color: c.textTertiary, lineHeight: 1.45 }}>{en(row.gap)}</div>
      ) : null}
    </div>
  );
}

function VehicleBlock({ vehicle }: { vehicle: AbsVehicle }) {
  const { c } = useMapChrome();
  const { t } = useLocale();
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 16, fontWeight: 650, color: c.text, lineHeight: 1.4 }}>{en(vehicle.name)}</div>
      <div style={{ marginTop: 4, fontSize: 13, fontWeight: 400, color: c.textSecondary, lineHeight: 1.5 }}>
        <FigureText text={vehicle.asOf} />
      </div>
      <a
        href={vehicle.url}
        target="_blank"
        rel="noreferrer"
        style={{ display: "inline-block", marginTop: 4, fontSize: 13, color: c.link, lineHeight: 1.45 }}
      >
        {en(vehicle.source)}
      </a>
      {ABS_MATURITY_DIMENSIONS.map((d) => (
        <div key={d.id} style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${c.panelBorder}` }}>
          <div style={{ fontSize: 15, fontWeight: 650, color: c.text, marginBottom: 10 }}>{t(d.title)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20, alignItems: "start" }}>
            <Lens label="本地" row={readingOf(vehicle, d.id, "local")} />
            <Lens label="国际" row={readingOf(vehicle, d.id, "intl")} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AbsMaturitySection({ code }: { code: string }) {
  const { c } = useMapChrome();
  const { lang, t } = useLocale();
  const vehicles = absVehicles(code);
  if (!vehicles) {
    return (
      <div style={{ fontSize: 15, fontWeight: 400, color: c.textSecondary, lineHeight: 1.55 }}>
        {lang === "en"
          ? `Reviewed ${ABS_ORDINANCE_REVIEWED}. ${t(ABS_ORDINANCE_SCOPE)} The local statute for this country was not opened in this pass.`
          : `核定期 ${ABS_ORDINANCE_REVIEWED}。${ABS_ORDINANCE_SCOPE}该国专法本次没有打开。`}
      </div>
    );
  }
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 400, color: c.textTertiary, lineHeight: 1.5, marginBottom: 8 }}>
        {lang === "en"
          ? `Reviewed ${ABS_ORDINANCE_REVIEWED}. ${t(ABS_ORDINANCE_SCOPE)} Dark text is a rule written in the statute. Light text is a reading the statute does not give.`
          : `核定期 ${ABS_ORDINANCE_REVIEWED}。${ABS_ORDINANCE_SCOPE}深色是条文里写明的规则，浅色是条例没有给出的读数。`}
      </div>
      {vehicles.map((vehicle) => (
        <VehicleBlock key={vehicle.name} vehicle={vehicle} />
      ))}
    </div>
  );
}
