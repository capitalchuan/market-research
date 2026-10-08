import raw from "./cashloanAbsOrdinance.json";

export type AbsReading = {
  clause: string;
  lens: "local" | "intl";
  finding: string;
  article: string;
  gap: string;
  cited: boolean;
};

export type AbsVehicle = {
  name: string;
  source: string;
  asOf: string;
  url: string;
  readings: AbsReading[];
};

export const ABS_ORDINANCE_REVIEWED = raw.reviewed;
export const ABS_ORDINANCE_SCOPE = raw.scope;

const byCode = raw.byCode as Record<string, AbsVehicle[]>;

export function absVehicles(code: string): AbsVehicle[] | null {
  const rows = byCode[code];
  return rows?.length ? rows : null;
}
