#!/usr/bin/env python3
"""Fetch monthly inflation / policy-rate / retail-gasoline / residential-electricity
series for Atlas stress charts.

  python3 web/scripts/fetch_macro_stress_history.py
  python3 web/scripts/fetch_macro_stress_history.py --elec-only   # only refresh electricity

Writes web/src/data/macro-stress-history.json

Sources:
  - inflation: BIS WS_LONG_CPI (UNIT_MEASURE=771, YoY %)
  - policyRate: BIS WS_CBPOL (monthly policy rate %)
  - gasolineRetail: country-macro TE snapshot level × Brent path (FRED/datasets),
    marked synthetic — pump-price level from TE, shape from Brent YoY proxy.
  - electricityResidential:
      * US: FRED APU000072610 (monthly USD/kWh)
      * EU overlap geos: Eurostat nrg_pc_204 band DC (bi-annual EUR/kWh → USD via FRED EXUSEU)
      * else (含展业六国 MX/TH/ID/PH/HK/IN): GPP 快照水平，不铺持平假曲线
"""
from __future__ import annotations

import csv
import io
import json
import re
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/data/macro-stress-history.json"
MACRO = ROOT / "src/data/country-macro.json"
START = "2021-01"
UA = {"User-Agent": "crm-atlas-macro-stress/1.0", "Accept": "text/csv,application/json,*/*"}

# BIS long-CPI YoY unit code (annual % change)
CPI_YOY_UNIT = "771"

# Free residential electricity time series (Atlas geo overlap)
FRED_US_ELEC = "APU000072610"  # Average Price: Electricity per kWh in U.S. City Average
FRED_EURUSD_M = "EXUSEU"  # U.S. Dollars to Euro Spot Rate, monthly
# Eurostat household electricity bi-annual, band DC (2.5–5 MWh), all taxes, EUR/kWh
EUROSTAT_ELEC_GEOS = ("DE", "ES", "FR", "IE", "IT", "NL", "PL", "PT", "SE")
# 展业六国：无免费公开月/半年序时，保持 GPP 快照卡
INVESTED_SIX = frozenset({"MX", "TH", "ID", "PH", "HK", "IN"})


def http_get(url: str, timeout: int = 180, retries: int = 3) -> bytes:
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except Exception as e:
            last_err = e
            print(f"  http retry {attempt + 1}/{retries}: {e}", flush=True)
            time.sleep(1.2 * (attempt + 1))
    # curl often survives where urllib SSL stalls
    try:
        import subprocess

        r = subprocess.run(
            ["curl", "-sL", "--connect-timeout", "20", "--max-time", str(timeout), url],
            capture_output=True,
            check=False,
        )
        if r.returncode == 0 and r.stdout:
            print("  http via curl fallback", flush=True)
            return r.stdout
    except Exception as e:
        print(f"  curl fallback fail: {e}", flush=True)
    assert last_err is not None
    raise last_err


def bis_csv(dataset: str, key: str = "M", start: str = START) -> list[dict]:
    url = f"https://stats.bis.org/api/v1/data/{dataset}/{key}?format=csv&startPeriod={start}"
    text = http_get(url).decode("utf-8", "replace")
    return list(csv.DictReader(io.StringIO(text)))


def month_end(ym: str) -> str:
    """2024-01 -> mid-month day 15 for chart axis."""
    return f"{ym}-15"


def series_from_rows(rows: list[dict], area_field: str = "REF_AREA") -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for r in rows:
        area = (r.get(area_field) or "").strip()
        period = (r.get("TIME_PERIOD") or "").strip()
        raw = (r.get("OBS_VALUE") or "").strip()
        if not area or not period or not raw:
            continue
        try:
            v = float(raw)
        except ValueError:
            continue
        if v != v:  # NaN
            continue
        if re.fullmatch(r"\d{4}-\d{2}", period):
            d = month_end(period)
        elif re.fullmatch(r"\d{4}-\d{2}-\d{2}", period):
            d = period
        else:
            continue
        out.setdefault(area, []).append({"d": d, "v": round(v, 4)})
    for code, pts in out.items():
        pts.sort(key=lambda p: p["d"])
        dedup: dict[str, float] = {}
        for p in pts:
            dedup[p["d"]] = p["v"]
        out[code] = [{"d": d, "v": dedup[d]} for d in sorted(dedup)]
    return out


def parse_gas_usd(s: str | None) -> float | None:
    if not s:
        return None
    m = re.search(r"([\d.]+)\s*美元", s) or re.search(r"([\d.]+)", s.replace(",", ""))
    return float(m.group(1)) if m else None


def parse_elec_usd_kwh(s: str | None) -> float | None:
    """Parse『约0.075美元/kWh』from country-macro electricityResidential."""
    if not s:
        return None
    m = re.search(r"([\d.]+)\s*美元\s*/\s*kWh", s, re.I)
    if not m:
        m = re.search(r"([\d.]+)\s*美元", s)
    if not m:
        m = re.search(r"([\d.]+)", s.replace(",", ""))
    if not m:
        return None
    try:
        v = float(m.group(1))
    except ValueError:
        return None
    # sanity: residential kWh rarely > 1.5 USD
    if v <= 0 or v > 2.5:
        return None
    return v


def fetch_fred_csv(series_id: str, cosd: str = f"{START}-01") -> list[dict]:
    """FRED graph CSV → [{d: YYYY-MM-15, v}] monthly (or daily averaged by month)."""
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}&cosd={cosd}"
    # FRED often stalls urllib; prefer curl
    text = ""
    try:
        import subprocess

        r = subprocess.run(
            ["curl", "-sL", "--connect-timeout", "25", "--max-time", "90", url],
            capture_output=True,
            check=False,
        )
        if r.returncode == 0 and r.stdout:
            text = r.stdout.decode("utf-8", "replace")
    except Exception as e:
        print(f"  fred curl fail {series_id}: {e}", flush=True)
    if not text or "observation_date" not in text[:80]:
        text = http_get(url, timeout=60, retries=2).decode("utf-8", "replace")
    lines = [ln for ln in text.strip().splitlines() if ln and not ln.startswith("#")]
    if len(lines) < 2:
        return []
    buckets: dict[str, list[float]] = {}
    for ln in lines[1:]:
        parts = [p.strip() for p in ln.split(",")]
        if len(parts) < 2:
            continue
        d, raw = parts[0], parts[1]
        if raw in ("", ".", "NA", "null"):
            continue
        try:
            v = float(raw)
        except ValueError:
            continue
        if v != v:
            continue
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", d):
            ym = d[:7]
        elif re.fullmatch(r"\d{4}-\d{2}", d):
            ym = d
        else:
            continue
        if ym < START:
            continue
        buckets.setdefault(ym, []).append(v)
    out = []
    for ym in sorted(buckets):
        vals = buckets[ym]
        out.append({"d": month_end(ym), "v": round(sum(vals) / len(vals), 4)})
    return out


def semester_to_mid(sem: str) -> str | None:
    """2021-S1 → 2021-03-15, 2021-S2 → 2021-09-15."""
    m = re.fullmatch(r"(\d{4})-S([12])", sem)
    if not m:
        return None
    y, s = m.group(1), m.group(2)
    return f"{y}-{'03' if s == '1' else '09'}-15"


def parse_eurostat_json(d: dict) -> dict[str, list[dict]]:
    """SDMX-JSON flat value index → {geo: [{d,v}, ...]} for nrg_pc_204-style payloads."""
    vals = d.get("value") or {}
    if not vals:
        return {}
    ids: list[str] = list(d.get("id") or [])
    sizes: list[int] = list(d.get("size") or [])
    dims = d.get("dimension") or {}
    if not ids or len(ids) != len(sizes):
        return {}
    strides = [1] * len(sizes)
    for i in range(len(sizes) - 2, -1, -1):
        strides[i] = strides[i + 1] * sizes[i + 1]

    def labels_for(dim: str) -> list[str]:
        cat = (dims.get(dim) or {}).get("category") or {}
        index = cat.get("index") or {}
        # index maps code -> position
        inv = [""] * sizes[ids.index(dim)]
        for code, pos in index.items():
            if isinstance(pos, int) and 0 <= pos < len(inv):
                inv[pos] = code
        return inv

    geo_labs = labels_for("geo") if "geo" in ids else [""]
    time_labs = labels_for("time") if "time" in ids else [""]
    geo_i = ids.index("geo") if "geo" in ids else -1
    time_i = ids.index("time") if "time" in ids else -1

    out: dict[str, list[dict]] = {}
    for key, raw in vals.items():
        try:
            idx = int(key)
            v = float(raw)
        except (TypeError, ValueError):
            continue
        if v != v:
            continue
        coords = []
        rem = idx
        for s in strides:
            coords.append(rem // s)
            rem %= s
        geo = geo_labs[coords[geo_i]] if geo_i >= 0 else ""
        period = time_labs[coords[time_i]] if time_i >= 0 else ""
        mid = semester_to_mid(period)
        if not geo or not mid or mid[:7] < START:
            continue
        out.setdefault(geo, []).append({"d": mid, "v": round(v, 4)})
    for code, pts in out.items():
        pts.sort(key=lambda p: p["d"])
        dedup: dict[str, float] = {}
        for p in pts:
            dedup[p["d"]] = p["v"]
        out[code] = [{"d": d, "v": dedup[d]} for d in sorted(dedup)]
    return out


def fetch_eurostat_elec_eur() -> dict[str, list[dict]]:
    """Bi-annual household electricity EUR/kWh (band DC) for EUROSTAT_ELEC_GEOS."""
    q = urllib.parse.urlencode(
        [
            ("format", "JSON"),
            ("lang", "en"),
            ("nrg_cons", "KWH2500-4999"),
            ("currency", "EUR"),
            ("tax", "I_TAX"),
            ("unit", "KWH"),
            ("siec", "E7000"),
            *[("geo", g) for g in EUROSTAT_ELEC_GEOS],
        ]
    )
    url = f"https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nrg_pc_204?{q}"
    last_err: Exception | None = None
    for attempt in range(3):
        try:
            raw = http_get(url, timeout=120)
            d = json.loads(raw.decode("utf-8", "replace"))
            by = parse_eurostat_json(d)
            print(
                f"  eurostat nrg_pc_204 geos={len(by)} "
                f"pts={sum(len(v) for v in by.values())}",
                flush=True,
            )
            return by
        except Exception as e:
            last_err = e
            print(f"  eurostat attempt {attempt + 1} fail: {e}", flush=True)
            time.sleep(1.2 * (attempt + 1))
    if last_err:
        print(f"  eurostat unavailable: {last_err}", flush=True)
    return {}


def eurusd_lookup(eurusd: list[dict]) -> dict[str, float]:
    """YYYY-MM → USD per EUR."""
    return {p["d"][:7]: p["v"] for p in eurusd if p.get("v")}


def eur_to_usd_series(eur_pts: list[dict], fx: dict[str, float]) -> list[dict]:
    if not eur_pts or not fx:
        return []
    # fallback: nearest available FX month
    fx_months = sorted(fx)
    out = []
    for p in eur_pts:
        ym = p["d"][:7]
        rate = fx.get(ym)
        if rate is None:
            earlier = [m for m in fx_months if m <= ym]
            later = [m for m in fx_months if m >= ym]
            pick = earlier[-1] if earlier else (later[0] if later else None)
            rate = fx.get(pick) if pick else None
        if not rate or rate <= 0:
            continue
        out.append({"d": p["d"], "v": round(p["v"] * rate, 4)})
    return out


def fetch_brent_monthly() -> list[dict]:
    """Monthly average Brent USD/bbl. Tries several open mirrors."""
    urls = [
        "https://cdn.jsdelivr.net/gh/datasets/oil-prices@master/data/brent-daily.csv",
        "https://raw.githubusercontent.com/datasets/oil-prices/master/data/brent-daily.csv",
        "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU&cosd=2021-01-01",
    ]
    daily: list[tuple[str, float]] = []
    last_err: Exception | None = None
    for url in urls:
        try:
            text = http_get(url, timeout=60).decode("utf-8", "replace")
            lines = [ln for ln in text.strip().splitlines() if ln and not ln.startswith("#")]
            if len(lines) < 10:
                continue
            header = lines[0].lower()
            start_i = 1 if ("date" in header or "observation" in header) else 0
            for ln in lines[start_i:]:
                parts = [p.strip() for p in ln.split(",")]
                if len(parts) < 2:
                    continue
                d, raw = parts[0], parts[1]
                if raw in ("", ".", "NA", "null"):
                    continue
                try:
                    v = float(raw)
                except ValueError:
                    continue
                if v != v:
                    continue
                if re.fullmatch(r"\d{4}-\d{2}-\d{2}", d):
                    daily.append((d, v))
                elif re.fullmatch(r"\d{4}-\d{2}", d):
                    daily.append((month_end(d), v))
            if daily:
                print(f"  brent from {url.split('/')[-1]} n_daily={len(daily)}", flush=True)
                break
        except Exception as e:
            last_err = e
            print(f"  brent fail {url[:48]}: {e}", flush=True)
            time.sleep(0.3)
    if not daily:
        if last_err:
            print(f"  brent unavailable: {last_err}", flush=True)
        return []

    buckets: dict[str, list[float]] = {}
    for d, v in daily:
        if d < f"{START}-01":
            continue
        ym = d[:7]
        buckets.setdefault(ym, []).append(v)
    out = []
    for ym in sorted(buckets):
        vals = buckets[ym]
        out.append({"d": month_end(ym), "v": round(sum(vals) / len(vals), 4)})
    return out


def scale_gas_to_brent(level: float, brent: list[dict]) -> list[dict]:
    if not brent or level <= 0:
        return []
    clean = [p for p in brent if isinstance(p.get("v"), (int, float)) and p["v"] == p["v"] and p["v"] > 0]
    if not clean:
        return []
    last = clean[-1]["v"]
    out = []
    for p in clean:
        v = round(level * (p["v"] / last), 4)
        if v == v:
            out.append({"d": p["d"], "v": v})
    return out


def monthly_sample(points: list[dict]) -> list[dict]:
    return sorted(points, key=lambda p: p["d"])


def build_elec_payload(
    code: str,
    snap: dict,
    us_elec: list[dict],
    eu_elec_usd: dict[str, list[dict]],
) -> dict | None:
    """Return electricityResidential block or None if no reading."""
    elec_level = parse_elec_usd_kwh(snap.get("electricityResidential"))
    elec_pts: list[dict] = []
    elec_meta: dict = {}
    elec_source = "GPP snapshot"

    if code == "US" and len(us_elec) >= 2:
        elec_pts = us_elec
        elec_meta = {
            "synthetic": False,
            "method": "fred_APU000072610",
            "note": "美国城市平均居民电价，FRED 月度 USD/kWh。",
        }
        elec_source = "FRED APU000072610"
    elif code in eu_elec_usd and len(eu_elec_usd[code]) >= 2:
        elec_pts = eu_elec_usd[code]
        elec_meta = {
            "synthetic": False,
            "method": "eurostat_nrg_pc_204",
            "note": "Eurostat 居民电价半年频（消费档 DC 2.5–5 MWh，含税 EUR/kWh），按 FRED EXUSEU 折 USD。",
        }
        elec_source = "Eurostat nrg_pc_204 × EXUSEU"
    elif elec_level is not None:
        as_of = date.today().isoformat()
        m = re.search(r"（(\d{4}-\d{2})", snap.get("electricityResidential") or "")
        if m:
            as_of = month_end(m.group(1))
        elec_pts = [{"d": as_of, "v": round(elec_level, 4)}]
        note = "仅 GlobalPetrolPrices 快照时点；公开月/半年序时未接上，不画走势。"
        if code in INVESTED_SIX:
            note = "展业国：仅 GPP 快照；无免费公开序时，不画走势。"
        elec_meta = {
            "synthetic": False,
            "method": "gpp_level_snapshot",
            "levelUsdPerKwh": elec_level,
            "note": note,
        }
        elec_source = "GPP snapshot"
    else:
        return None

    return {
        "unit": "USD/kWh",
        "source": elec_source,
        "points": elec_pts,
        **elec_meta,
    }


def fetch_elec_open_series() -> tuple[list[dict], dict[str, list[dict]]]:
    print("FRED US residential electricity + EURUSD …", flush=True)
    us_elec: list[dict] = []
    eurusd_m: list[dict] = []
    try:
        us_elec = fetch_fred_csv(FRED_US_ELEC)
    except Exception as e:
        print(f"  US elec FRED fail: {e}", flush=True)
    try:
        eurusd_m = fetch_fred_csv(FRED_EURUSD_M)
    except Exception as e:
        print(f"  EURUSD FRED fail: {e}", flush=True)
    fx = eurusd_lookup(eurusd_m)
    print(f"  US elec pts={len(us_elec)} EURUSD months={len(fx)}", flush=True)

    print("Eurostat nrg_pc_204 household electricity …", flush=True)
    eu_elec_eur = fetch_eurostat_elec_eur()
    eu_elec_usd: dict[str, list[dict]] = {
        g: eur_to_usd_series(pts, fx) for g, pts in eu_elec_eur.items()
    }
    return us_elec, eu_elec_usd


def patch_elec_only() -> None:
    """Refresh electricityResidential on existing JSON; keep inflation/rates/gas."""
    if not OUT.exists():
        raise SystemExit(f"missing {OUT}; run full fetch first")
    payload = json.loads(OUT.read_text(encoding="utf-8"))
    macro = json.loads(MACRO.read_text(encoding="utf-8"))
    us_elec, eu_elec_usd = fetch_elec_open_series()
    countries = payload.setdefault("countries", {})
    n_series = n_snap = 0
    for code, snap in macro.items():
        block = build_elec_payload(code, snap or {}, us_elec, eu_elec_usd)
        if not block:
            continue
        row = countries.setdefault(code, {})
        row["electricityResidential"] = block
        if block.get("method") in ("fred_APU000072610", "eurostat_nrg_pc_204"):
            n_series += 1
        else:
            n_snap += 1

    today = date.today().isoformat()
    meta = payload.setdefault("meta", {})
    meta["asOf"] = today
    meta["sample"] = "monthly (EU elec bi-annual)"
    meta["note"] = (
        "景气与定价压测序时：通胀/政策利率为 BIS；零售汽油多为 TE×布伦特示意；"
        "居民电价：美 FRED 月度、欧 Eurostat 半年频折 USD；其余（含展业六国）为 GPP 快照不画曲线。"
    )
    sources = meta.setdefault("sources", {})
    sources["electricityResidential"] = (
        "US FRED APU000072610; EU Eurostat nrg_pc_204 band DC × FRED EXUSEU; "
        "else GPP snapshot (no flat series)"
    )
    OUT.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False),
        encoding="utf-8",
    )
    print(
        f"patched elec → {OUT} series_countries={n_series} snapshot_countries={n_snap}",
        flush=True,
    )


def main() -> None:
    import sys

    if "--elec-only" in sys.argv:
        patch_elec_only()
        return

    macro = json.loads(MACRO.read_text(encoding="utf-8"))
    codes = sorted(macro.keys())
    print(f"macro countries {len(codes)}", flush=True)

    print("BIS WS_CBPOL …", flush=True)
    cbpol_rows = bis_csv("WS_CBPOL")
    policy_by = series_from_rows(cbpol_rows)
    print(f"  policy areas {len(policy_by)}", flush=True)

    print("BIS WS_LONG_CPI (YoY unit) …", flush=True)
    cpi_rows = [
        r for r in bis_csv("WS_LONG_CPI") if (r.get("UNIT_MEASURE") or "").strip() == CPI_YOY_UNIT
    ]
    infl_by = series_from_rows(cpi_rows)
    print(f"  inflation areas {len(infl_by)}", flush=True)

    print("Brent path for gasoline proxy …", flush=True)
    brent = fetch_brent_monthly()

    us_elec, eu_elec_usd = fetch_elec_open_series()

    countries: dict[str, dict] = {}
    for code in codes:
        snap = macro.get(code) or {}
        infl = monthly_sample(infl_by.get(code) or [])
        rate = monthly_sample(policy_by.get(code) or [])
        gas_level = parse_gas_usd(snap.get("gasolineRetail"))
        gas_pts: list[dict] = []
        gas_meta: dict = {}
        if gas_level is not None and brent:
            gas_pts = scale_gas_to_brent(gas_level, brent)
            gas_meta = {
                "synthetic": True,
                "method": "te_level_x_brent",
                "levelUsdPerL": gas_level,
                "note": "泵价水平取自国别卡 TE 快照；走势按布伦特月均同比示意，非官方零售汽油序时。",
            }
        elif gas_level is not None:
            as_of = date.today().isoformat()
            m = re.search(r"（(\d{4}-\d{2})", snap.get("gasolineRetail") or "")
            if m:
                as_of = month_end(m.group(1))
            gas_pts = [{"d": as_of, "v": gas_level}]
            gas_meta = {
                "synthetic": False,
                "note": "仅快照时点；布伦特路径暂不可用，未做示意回填。",
            }

        elec_block = build_elec_payload(code, snap, us_elec, eu_elec_usd)
        elec_pts = (elec_block or {}).get("points") or []

        if not infl and not rate and len(gas_pts) < 2 and len(elec_pts) < 2:
            if len(elec_pts) < 1:
                continue

        countries[code] = {
            "inflation": {
                "unit": "% YoY",
                "source": "BIS WS_LONG_CPI",
                "points": infl,
            },
            "policyRate": {
                "unit": "%",
                "source": "BIS WS_CBPOL",
                "points": rate,
            },
            "gasolineRetail": {
                "unit": "USD/L",
                "source": "TE snapshot × Brent" if gas_meta.get("synthetic") else "TE snapshot",
                "points": gas_pts,
                **gas_meta,
            },
        }
        if elec_block:
            countries[code]["electricityResidential"] = elec_block

    today = date.today().isoformat()
    payload = {
        "meta": {
            "asOf": today,
            "range": f"{START}..{today[:7]}",
            "sample": "monthly (EU elec bi-annual)",
            "note": (
                "景气与定价压测序时：通胀/政策利率为 BIS；零售汽油多为 TE×布伦特示意；"
                "居民电价：美 FRED 月度、欧 Eurostat 半年频折 USD；其余（含展业六国）为 GPP 快照不画曲线。"
            ),
            "sources": {
                "inflation": "BIS WS_LONG_CPI UNIT_MEASURE=771",
                "policyRate": "BIS WS_CBPOL",
                "gasolineRetail": "country-macro TE level × Brent monthly (synthetic when path available)",
                "electricityResidential": (
                    "US FRED APU000072610; EU Eurostat nrg_pc_204 band DC × FRED EXUSEU; "
                    "else GPP snapshot (no flat series)"
                ),
            },
        },
        "countries": countries,
    }
    OUT.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False),
        encoding="utf-8",
    )
    print(
        f"wrote {OUT} countries={len(countries)} "
        f"infl={sum(1 for c in countries.values() if c['inflation']['points'])} "
        f"rate={sum(1 for c in countries.values() if c['policyRate']['points'])} "
        f"gas={sum(1 for c in countries.values() if len(c['gasolineRetail']['points']) >= 2)} "
        f"elec={sum(1 for c in countries.values() if len((c.get('electricityResidential') or {}).get('points') or []) >= 2)}",
        flush=True,
    )


if __name__ == "__main__":
    main()
