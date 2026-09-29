#!/usr/bin/env python3
"""Daily store listing watch: live / gone for Atlas invested + peer cash-loan apps.

iOS: iTunes Lookup (resultCount>0 = live).
Google Play: Play details page (best-effort; 403 → unknown, do not alert).

Writes web/src/data/store-listing-status.json
Only status flips (live↔gone) become flash events. unknown is ignored.

  python3 web/scripts/fetch_store_listing_status.py
"""
from __future__ import annotations

import json
import ssl
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

CST = timezone(timedelta(hours=8))
ROOT = Path(__file__).resolve().parents[1]
WATCH = ROOT / "src/data/store-listing-watchlist.json"
OUT = ROOT / "src/data/store-listing-status.json"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)
KEEP_EVENTS = 90
EVENT_DAYS_UI = 21
CTX = ssl.create_default_context()

STORE_LABEL = {"ios": "iOS", "gp": "Google Play"}
TIER_HINT = {
    "invested": "已投生产商",
    "peer": "同国对标",
    "incumbent": "在位对照",
    "counterfeit": "仿名/马甲样本",
}


def now_cst() -> datetime:
    return datetime.now(CST)


def now_stamp() -> str:
    return now_cst().strftime("%Y-%m-%d %H:%M")


def today() -> str:
    return now_cst().strftime("%Y-%m-%d")


def http_get(url: str, timeout: int = 12) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return int(resp.status), body
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8", errors="replace")
        except Exception:
            body = ""
        return int(e.code), body
    except Exception as e:
        return 0, str(e)


def probe_ios(app_id: str, store_cc: str) -> dict[str, Any]:
    cc = (store_cc or "us").lower()
    url = f"https://itunes.apple.com/lookup?id={app_id}&country={cc}"
    page = f"https://apps.apple.com/{cc}/app/id{app_id}"
    status_code, body = http_get(url)
    if status_code == 200:
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            data = {}
        count = int(data.get("resultCount") or 0)
        track = ""
        if count and data.get("results"):
            track = str(data["results"][0].get("trackName") or "")
        return {
            "status": "live" if count > 0 else "gone",
            "http": status_code,
            "storeUrl": page,
            "trackName": track,
            "detail": f"itunes lookup resultCount={count}",
        }
    # 404 / empty often means gone; network fail → unknown
    if status_code in (404, 400):
        return {
            "status": "gone",
            "http": status_code,
            "storeUrl": page,
            "detail": f"itunes lookup HTTP {status_code}",
        }
    return {
        "status": "unknown",
        "http": status_code,
        "storeUrl": page,
        "detail": f"itunes lookup HTTP {status_code}",
    }


def probe_gp(pkg: str, store_cc: str) -> dict[str, Any]:
    cc = (store_cc or "us").upper()
    url = f"https://play.google.com/store/apps/details?id={pkg}&hl=en&gl={cc}"
    status_code, body = http_get(url)
    low = body.lower()
    gone_markers = (
        "we're sorry, the requested url was not found",
        "the requested url was not found on this server",
        "item not found",
        "this item isn't available",
        "no longer available",
    )
    live_markers = (
        'itemprop="name"',
        "aria-label=\"install\"",
        "data-item-id=",
        pkg.lower() in low and "play.google.com/store/apps" in low and len(body) > 4000,
    )
    if status_code == 404 or any(m in low for m in gone_markers):
        return {
            "status": "gone",
            "http": status_code,
            "storeUrl": url,
            "detail": f"play details HTTP {status_code} gone-marker",
        }
    if status_code == 200 and (any(live_markers) or "id=\"main-title\"" in low or "<h1" in low):
        return {
            "status": "live",
            "http": status_code,
            "storeUrl": url,
            "detail": f"play details HTTP {status_code}",
        }
    # 403 / bot wall common from datacenters
    return {
        "status": "unknown",
        "http": status_code,
        "storeUrl": url,
        "detail": f"play details HTTP {status_code} (treat as unknown)",
    }


def listing_key(app_id: str, store: str) -> str:
    return f"{app_id}:{store}"


def event_id(day: str, app_id: str, store: str, frm: str, to: str) -> str:
    return f"{day}:{app_id}:{store}:{frm}->{to}"


def severity(tier: str, to: str) -> str:
    if to == "gone":
        return "alert" if tier == "invested" else "watch"
    if to == "live":
        return "notice"
    return "info"


def flip_copy(app: dict[str, Any], store: str, frm: str, to: str, url: str) -> dict[str, str]:
    name = app.get("nameZh") or app.get("name") or app["id"]
    mkt = app.get("nameZhCountry") or app.get("country") or ""
    store_zh = STORE_LABEL.get(store, store)
    tier = app.get("tier") or "peer"
    if to == "gone":
        title = f"{mkt} · {name} {store_zh}下架"
        title_en = f"{app.get('country')} · {app.get('name') or name} {store_zh} delisted"
        what = f"{name} 在 {store_zh} 巡检为不在架（lookup/详情页不可见）。"
        how = (
            "公开接口：iOS 用 iTunes Lookup resultCount；"
            "Google Play 用详情页探测。非苹果/谷歌官方专报。"
        )
        result = (
            "渠道中断：iOS 获客暂停，流量改走安卓或其他包。"
            "对照 Guideline 3.2.2(ix) 个人贷 APR≤36%、不得 60 天内还清，以及 4.1 仿名。"
            "不能把商店下架直接等同当地监管吊牌。"
        )
    else:
        title = f"{mkt} · {name} {store_zh}重新上架"
        title_en = f"{app.get('country')} · {app.get('name') or name} {store_zh} relisted"
        what = f"{name} 在 {store_zh} 巡检恢复可见。"
        how = "同上；重新上架可能换包名/主体，需人工点开商店页核对开发者。"
        result = "获客渠道恢复，但仍需核 APR/主体/是否马甲换皮。"
    hint = app.get("note") or TIER_HINT.get(tier, "")
    return {
        "title": title,
        "titleEn": title_en,
        "what": what,
        "how": how,
        "result": result,
        "cashLoanHint": hint,
        "url": url,
        "source": "商店在架巡检",
    }


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    watch = load_json(WATCH, {})
    prev = load_json(OUT, {})
    prev_listings = {listing_key(x["appId"], x["store"]): x for x in prev.get("listings") or []}
    prev_events = list(prev.get("events") or [])
    seen_ids = {e.get("id") for e in prev_events if e.get("id")}

    listings: list[dict[str, Any]] = []
    events: list[dict[str, Any]] = []
    stats = {"live": 0, "gone": 0, "unknown": 0, "flips": 0, "probed": 0}

    for app in watch.get("apps") or []:
        probes: list[tuple[str, dict[str, Any]]] = []
        if app.get("iosId"):
            probes.append(("ios", probe_ios(str(app["iosId"]), app.get("storeCountry") or "us")))
            time.sleep(0.35)
        if app.get("gpId"):
            probes.append(("gp", probe_gp(str(app["gpId"]), app.get("storeCountry") or "us")))
            time.sleep(0.25)
        for store, probed in probes:
            stats["probed"] += 1
            st = probed["status"]
            stats[st] = stats.get(st, 0) + 1
            key = listing_key(app["id"], store)
            old = prev_listings.get(key)
            old_st = (old or {}).get("status")
            row = {
                "id": key,
                "appId": app["id"],
                "name": app.get("name"),
                "nameZh": app.get("nameZh") or app.get("name"),
                "group": app.get("group"),
                "producerId": app.get("producerId"),
                "country": app.get("country"),
                "nameZhCountry": app.get("nameZhCountry"),
                "tier": app.get("tier") or "peer",
                "store": store,
                "iosId": app.get("iosId") if store == "ios" else None,
                "gpId": app.get("gpId") if store == "gp" else None,
                "status": st,
                "http": probed.get("http"),
                "storeUrl": probed.get("storeUrl"),
                "trackName": probed.get("trackName") or None,
                "detail": probed.get("detail"),
                "checkedAt": now_stamp(),
                "match": app.get("match") or [],
            }
            listings.append(row)
            if old_st in ("live", "gone") and st in ("live", "gone") and old_st != st:
                eid = event_id(today(), app["id"], store, old_st, st)
                if eid not in seen_ids:
                    copy = flip_copy(app, store, old_st, st, probed.get("storeUrl") or "")
                    events.append(
                        {
                            "id": eid,
                            "topic": "store",
                            "appId": app["id"],
                            "nameZh": row["nameZh"],
                            "group": app.get("group"),
                            "producerId": app.get("producerId"),
                            "country": app.get("country"),
                            "nameZhCountry": app.get("nameZhCountry"),
                            "store": store,
                            "from": old_st,
                            "to": st,
                            "severity": severity(app.get("tier") or "peer", st),
                            "published": now_stamp(),
                            "checkedAt": now_stamp(),
                            **copy,
                        }
                    )
                    seen_ids.add(eid)
                    stats["flips"] += 1

    # Keep prior events (dedup), newest first
    merged = events + [e for e in prev_events if e.get("id") not in {x["id"] for x in events}]
    cutoff = now_cst() - timedelta(days=KEEP_EVENTS)

    def event_dt(e: dict[str, Any]) -> datetime:
        raw = str(e.get("published") or e.get("checkedAt") or "")
        for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d"):
            try:
                return datetime.strptime(raw[:16] if ":" in raw else raw[:10], fmt).replace(tzinfo=CST)
            except ValueError:
                continue
        return cutoff

    merged.sort(key=event_dt, reverse=True)
    merged = [e for e in merged if event_dt(e) >= cutoff][:200]

    gone_now = [x for x in listings if x["status"] == "gone"]
    invested_gone = [x for x in gone_now if x.get("tier") == "invested"]
    note_bits = [
        "iOS=iTunes Lookup；GP=Play 详情页（403 记 unknown，不预警）。",
        f"本轮探测 {stats['probed']} 条：在架 {stats['live']} / 下架 {stats['gone']} / 未知 {stats['unknown']} · 翻转 {stats['flips']}。",
    ]
    if invested_gone:
        names = "、".join(f"{x['nameZh']} {STORE_LABEL.get(x['store'], x['store'])}" for x in invested_gone)
        note_bits.append(f"已投下架：{names}。")

    out = {
        "source": "iTunes Lookup · Google Play details",
        "generatedAt": now_stamp(),
        "displayDate": today(),
        "note": " ".join(note_bits),
        "stats": {
            "appCount": len(watch.get("apps") or []),
            "listingCount": len(listings),
            "live": stats["live"],
            "gone": stats["gone"],
            "unknown": stats["unknown"],
            "flips": stats["flips"],
            "eventTotal": len(merged),
            "byCountry": {},
        },
        "listings": listings,
        "events": merged,
    }
    by_c: dict[str, int] = {}
    for e in merged:
        if e.get("to") != "gone":
            continue
        pub = str(e.get("published") or "")
        if pub[:10] < (now_cst() - timedelta(days=EVENT_DAYS_UI)).strftime("%Y-%m-%d"):
            continue
        code = str(e.get("country") or "")
        if code:
            by_c[code] = by_c.get(code, 0) + 1
    out["stats"]["byCountry"] = by_c

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT}")
    print(json.dumps(out["stats"], ensure_ascii=False))
    for e in events:
        print("FLIP", e["id"], e["title"])


if __name__ == "__main__":
    main()
