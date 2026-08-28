#!/usr/bin/env python3
"""Fetch natural / man-made disaster signals for Atlas invested + hot markets.

Sources (public, no key):
  - USGS GeoJSON earthquakes (展业六国 M≥4.8，其余 M≥5.0，近 7 日)
  - GDACS RSS (cyclone / flood / volcano / drought / quake alerts)
  - ReliefWeb disasters API (ongoing / alert；需预审 appname)

Writes web/src/data/disaster-watch-digest.json for flash UI merge.
同国同类合并为一条可读中文标题，避免「巴西火灾：Green forest fire…」刷屏。
Cash-loan so-what is templated by hazard kind — not a substitute for local ops judgment.

  python3 web/scripts/fetch_disaster_watch.py
"""
from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

CST = timezone(timedelta(hours=8))
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/data/disaster-watch-digest.json"
UA = (
    "Mozilla/5.0 (compatible; AtlasDisasterWatch/1.0; +https://capitalchuan.github.io/market-research/)"
)

# ISO → (lat_min, lat_max, lon_min, lon_max) 粗框，用于震中落点
MARKET_BOXES: dict[str, tuple[float, float, float, float]] = {
    "MX": (14.5, 32.7, -118.5, -86.5),
    "TH": (5.5, 20.5, 97.3, 105.7),
    "ID": (-11.0, 6.1, 95.0, 141.0),
    "PH": (4.5, 21.2, 116.9, 126.6),
    "HK": (22.13, 22.57, 113.82, 114.41),
    "IN": (6.5, 35.5, 68.0, 97.5),
    "BR": (-34.0, 5.3, -74.0, -34.7),
    "VN": (8.3, 23.4, 102.1, 109.5),
    "MY": (0.8, 7.4, 99.6, 119.3),
    "SG": (1.15, 1.48, 103.6, 104.1),
    "PK": (23.6, 37.1, 60.9, 77.8),
    "BD": (20.7, 26.6, 88.0, 92.7),
    "NG": (4.2, 13.9, 2.7, 14.7),
    "KE": (-4.7, 5.0, 33.9, 41.9),
    "US": (24.5, 49.4, -125.0, -66.9),
    "JP": (24.0, 46.0, 123.0, 146.0),
    "KR": (33.0, 38.7, 124.5, 132.0),
    "TW": (21.8, 25.4, 119.3, 122.1),
    "CN": (18.0, 54.0, 73.0, 135.0),
}

NAME_ZH: dict[str, str] = {
    "MX": "墨西哥",
    "TH": "泰国",
    "ID": "印尼",
    "PH": "菲律宾",
    "HK": "中国香港",
    "IN": "印度",
    "BR": "巴西",
    "VN": "越南",
    "MY": "马来西亚",
    "SG": "新加坡",
    "PK": "巴基斯坦",
    "BD": "孟加拉",
    "NG": "尼日利亚",
    "KE": "肯尼亚",
    "US": "美国",
    "JP": "日本",
    "KR": "韩国",
    "TW": "中国台湾",
    "CN": "中国",
}

# 国名/别名 → ISO（GDACS / ReliefWeb 文本匹配）
NAME_TO_CODE: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"Mexico|México|墨西哥", re.I), "MX"),
    (re.compile(r"Thailand|ไทย|泰国", re.I), "TH"),
    (re.compile(r"Indonesia|印尼|印度尼西亚", re.I), "ID"),
    (re.compile(r"Philippines|菲律宾", re.I), "PH"),
    (re.compile(r"Hong Kong|香港", re.I), "HK"),
    (re.compile(r"\bIndia\b|印度(?!尼西亚)", re.I), "IN"),
    (re.compile(r"Brazil|Brasil|巴西", re.I), "BR"),
    (re.compile(r"Vietnam|Việt Nam|越南", re.I), "VN"),
    (re.compile(r"Malaysia|马来", re.I), "MY"),
    (re.compile(r"Singapore|新加坡", re.I), "SG"),
    (re.compile(r"Pakistan|巴基斯坦", re.I), "PK"),
    (re.compile(r"Bangladesh|孟加拉", re.I), "BD"),
    (re.compile(r"Nigeria|尼日利亚", re.I), "NG"),
    (re.compile(r"Kenya|肯尼亚", re.I), "KE"),
    (re.compile(r"United States|\bUSA\b|\bUS\b|美国", re.I), "US"),
    (re.compile(r"Japan|日本", re.I), "JP"),
    (re.compile(r"Korea|韩国|南韩", re.I), "KR"),
    (re.compile(r"Taiwan|台湾|臺灣", re.I), "TW"),
    (re.compile(r"China|中国(?!香港|台湾)", re.I), "CN"),
]

KIND_ZH = {
    "earthquake": "地震",
    "flood": "洪涝",
    "cyclone": "台风/气旋",
    "wildfire": "火灾",
    "volcano": "火山",
    "drought": "干旱",
    "conflict": "冲突/动荡",
    "other": "灾害",
}

SOWHAT = {
    "earthquake": "展业区先核催收可达与网点/抵押物受损；短暂停催与区域风险定价上调要同步评估。",
    "flood": "洪涝易冲击还款能力与物流催收；低洼展业仓要盯断供与逾期抬头。",
    "cyclone": "台风路径上的展业城可能停工停运；额度投放与上门催收应临时收紧。",
    "wildfire": "局地火灾影响住房/商户经营与保险缺口；相关资产池要标区域风险。",
    "volcano": "火山喷发与灰霾可中断交通与户外催收；周边省邦先做展业暂停清单。",
    "drought": "干旱抬升农业与水电成本，间接压消费贷偿还；农村/县域组合要加压测。",
    "conflict": "冲突动荡直接威胁人员与资金通道安全；展业与催收以人员安全为先。",
    "other": "灾害事件可能扰动还款与运营；先核影响城邦再决定是否暂停投放。",
}


def _get(url: str, timeout: int = 28) -> bytes | None:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except Exception as e:
        print("get fail", url[:80], e)
        return None


def _in_box(lat: float, lon: float, box: tuple[float, float, float, float]) -> bool:
    la0, la1, lo0, lo1 = box
    return la0 <= lat <= la1 and lo0 <= lon <= lo1


def _code_from_point(lat: float, lon: float) -> str | None:
    # 小国优先（HK/SG 框在大国内）
    for code in ("HK", "SG", "TW", "KR", "JP", "TH", "VN", "MY", "PH", "BD", "PK", "KE", "NG", "MX", "ID", "IN", "BR", "US", "CN"):
        box = MARKET_BOXES.get(code)
        if box and _in_box(lat, lon, box):
            return code
    return None


def _code_from_text(*texts: str) -> str | None:
    blob = " ".join(t for t in texts if t)
    for pat, code in NAME_TO_CODE:
        if pat.search(blob):
            return code
    return None


def _kind_from_text(text: str) -> str:
    t = text.lower()
    if re.search(r"earthquake|quake|seismic|地震", t):
        return "earthquake"
    if re.search(r"flood|inundat|洪涝|洪水|水灾", t):
        return "flood"
    if re.search(r"cyclone|typhoon|hurricane|tropical storm|台风|气旋|飓风", t):
        return "cyclone"
    if re.search(r"wildfire|bushfire|forest fire|火灾|山火", t):
        return "wildfire"
    if re.search(r"volcano|eruption|火山", t):
        return "volcano"
    if re.search(r"drought|干旱", t):
        return "drought"
    if re.search(r"conflict|riot|unrest|warfare|冲突|骚乱|暴乱", t):
        return "conflict"
    return "other"


def _iso_day(raw: str | None) -> str:
    if not raw:
        return ""
    s = str(raw).strip()
    try:
        if s.endswith("Z") or "+" in s[10:] or s.endswith("+00:00"):
            dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            return dt.astimezone(CST).strftime("%Y-%m-%d")
        return parsedate_to_datetime(s).astimezone(CST).strftime("%Y-%m-%d")
    except Exception:
        m = re.search(r"(\d{4}-\d{2}-\d{2})", s)
        return m.group(1) if m else s[:10]


def _md(published: str) -> str:
    """YYYY-MM-DD → MM-DD，用于标题去重感。"""
    if len(published) >= 10 and published[4] == "-":
        return published[5:10]
    return published[:5]


def _alert_level(*texts: str) -> str:
    blob = " ".join(t for t in texts if t)
    if re.search(r"\bRed\b|红色", blob, re.I):
        return "Red"
    if re.search(r"\bOrange\b|橙色", blob, re.I):
        return "Orange"
    if re.search(r"\bGreen\b|绿色", blob, re.I):
        return "Green"
    return ""


def _level_zh(level: str | None) -> str:
    return {"Red": "红色", "Orange": "橙色", "Green": "绿色"}.get(level or "", "")


def _short_place(place: str) -> str:
    """压短 USGS place，去掉冗长国名后缀。"""
    s = re.sub(r"\s+", " ", (place or "").strip())
    s = re.sub(
        r",?\s*(Philippines|Indonesia|Japan|China|India|Mexico|Brazil|Pakistan|Thailand|United States|Taiwan|Korea).*$",
        "",
        s,
        flags=re.I,
    )
    s = re.sub(r"^\d+\s*km\s+[NSEW]{1,3}\s+of\s+", "", s, flags=re.I)
    return s.strip(" ,")[:36]


def _zh_title(
    *,
    kind: str,
    code: str,
    published: str,
    mag: float | None = None,
    place: str = "",
    level: str | None = None,
    cyclone_name: str = "",
) -> str:
    name = NAME_ZH.get(code, code)
    day = _md(published)
    lv = _level_zh(level)
    if kind == "earthquake" and mag is not None:
        loc = _short_place(place)
        base = f"{name}{_md(published)}发生约 M{mag:.1f} 地震"
        return f"{base}（{loc}）" if loc else base
    if kind == "flood":
        return f"{name}洪涝{lv}预警·{day}" if day else f"{name}洪涝{lv}预警"
    if kind == "wildfire":
        return f"{name}林火{lv}通报·{day}" if day else f"{name}林火{lv}通报"
    if kind == "drought":
        return f"{name}干旱持续·{day}" if day else f"{name}干旱持续"
    if kind == "cyclone":
        cn = cyclone_name or "热带气旋"
        return f"{name}台风/气旋「{cn}」{lv}·{day}" if day else f"{name}台风/气旋「{cn}」{lv}"
    if kind == "volcano":
        return f"{name}火山活动{lv}·{day}" if day else f"{name}火山活动{lv}"
    kind_zh = KIND_ZH.get(kind, "灾害")
    return f"{name}{kind_zh}动态·{day}" if day else f"{name}{kind_zh}动态"


def _cyclone_name(text: str) -> str:
    m = re.search(r"(?:tropical cyclone|typhoon|hurricane)\s+([A-Z0-9-]{3,})", text, re.I)
    return (m.group(1) if m else "").upper()


def _item(
    *,
    kind: str,
    code: str,
    title: str,
    what: str,
    url: str,
    published: str,
    source: str,
    mag: float | None = None,
    lat: float | None = None,
    lon: float | None = None,
    severity: str | None = None,
    place: str = "",
) -> dict:
    kind_zh = KIND_ZH.get(kind, "灾害")
    name = NAME_ZH.get(code, code)
    level = severity if severity in ("Red", "Orange", "Green") else _alert_level(title, what, severity or "")
    title_en = title if not re.search(r"[\u4e00-\u9fff]{4,}", title) else ""
    title_zh = _zh_title(
        kind=kind,
        code=code,
        published=published,
        mag=mag,
        place=place or title_en or title,
        level=level or None,
        cyclone_name=_cyclone_name(f"{title} {what}"),
    )
    if len(title_zh) > 72:
        title_zh = title_zh[:70] + "…"
    result = SOWHAT.get(kind, SOWHAT["other"])
    if mag is not None and "震级" not in what and "M" not in what[:20]:
        what = f"{what}（震级约 M{mag:.1f}）"
    return {
        "id": f"{kind}:{code}:{published}:{abs(hash(url)) % 10_000_000:07d}",
        "topic": "disaster",
        "kind": kind,
        "kindZh": kind_zh,
        "country": code,
        "nameZh": name,
        "title": title_zh,
        "titleEn": title_en,
        "what": what.rstrip("。") + "。",
        "how": "",
        "result": result,
        "url": url,
        "published": published,
        "source": source,
        "query": f"disaster:{kind}",
        "mag": mag,
        "lat": lat,
        "lon": lon,
        "severity": level or severity,
        "cashLoanHint": result,
    }


# 展业六国：略降门槛；其余市场只留更显著地震，减少「同国多条 M4.x」观感
INVESTED_EQ = {"MX", "TH", "ID", "PH", "HK", "IN"}
EQ_MIN_INVESTED = 4.8
EQ_MIN_OTHER = 5.0


def fetch_usgs() -> list[dict]:
    url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson"
    raw = _get(url)
    if not raw:
        return []
    try:
        data = json.loads(raw.decode("utf-8"))
    except Exception as e:
        print("usgs json fail", e)
        return []
    out: list[dict] = []
    for feat in data.get("features") or []:
        props = feat.get("properties") or {}
        geom = feat.get("geometry") or {}
        coords = geom.get("coordinates") or []
        if len(coords) < 2:
            continue
        lon, lat = float(coords[0]), float(coords[1])
        code = _code_from_point(lat, lon)
        if not code:
            continue
        mag = props.get("mag")
        try:
            mag_f = float(mag) if mag is not None else None
        except (TypeError, ValueError):
            mag_f = None
        if mag_f is None:
            continue
        min_mag = EQ_MIN_INVESTED if code in INVESTED_EQ else EQ_MIN_OTHER
        if mag_f < min_mag:
            continue
        place = props.get("place") or "unknown"
        ts = props.get("time")
        if isinstance(ts, (int, float)):
            published = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).astimezone(CST).strftime("%Y-%m-%d")
        else:
            published = datetime.now(CST).strftime("%Y-%m-%d")
        detail = props.get("url") or "https://earthquake.usgs.gov/"
        what = (
            f"USGS 监测到{NAME_ZH.get(code, code)}相关区域发生显著地震，"
            f"震中附近 {_short_place(place) or place}，震级约 M{mag_f:.1f}"
        )
        out.append(
            _item(
                kind="earthquake",
                code=code,
                title=f"M{mag_f:.1f} {place}",
                what=what,
                url=detail,
                published=published,
                source="USGS",
                mag=mag_f,
                lat=lat,
                lon=lon,
                severity=f"M{mag_f:.1f}",
                place=place,
            )
        )
    print("usgs hits", len(out))
    return out


def fetch_gdacs() -> list[dict]:
    url = "https://www.gdacs.org/xml/rss.xml"
    raw = _get(url)
    if not raw:
        return []
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as e:
        print("gdacs xml fail", e)
        return []
    out: list[dict] = []
    for item in root.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        desc = (item.findtext("description") or "").strip()
        pub = _iso_day(item.findtext("pubDate"))
        if not title or not link:
            continue
        blob = f"{title} {desc}"
        code = _code_from_text(blob)
        if not code:
            continue
        kind = _kind_from_text(blob)
        level = _alert_level(title, desc)
        # 绿色林火多为例行通报，几乎同文刷屏——只留橙/红
        if kind == "wildfire" and level == "Green":
            continue
        # GDACS 地震通常不如 USGS 精细，且易与 USGS 重复；有震级信息才收
        if kind == "earthquake":
            continue
        desc_plain = re.sub(r"<[^>]+>", " ", desc)
        desc_plain = re.sub(r"\s+", " ", desc_plain).strip()
        name = NAME_ZH.get(code, code)
        kind_zh = KIND_ZH.get(kind, "灾害")
        lv = _level_zh(level)
        if kind == "wildfire":
            what = f"GDACS 对{name}发布林火{lv or ''}通报（{pub or '近日'}）"
        elif kind == "flood":
            what = f"GDACS 对{name}发布洪涝{lv or ''}预警（{pub or '近日'}）"
            if desc_plain:
                what += f"。{desc_plain[:120]}"
        elif kind == "drought":
            what = f"GDACS 显示{name}及相关邻国干旱仍在持续"
            if desc_plain:
                what += f"。{desc_plain[:100]}"
        elif kind == "cyclone":
            cn = _cyclone_name(blob) or "热带气旋"
            what = f"GDACS 对{name}发布台风/气旋「{cn}」{lv or ''}通报"
            if desc_plain:
                what += f"。{desc_plain[:120]}"
        else:
            what = desc_plain[:180] if len(desc_plain) >= 20 else f"GDACS {kind_zh}警报：{title}"
        # 绿色洪涝也易同文：若正文毫无增量且已有同国同类，交给 collapse；此处仍入库
        out.append(
            _item(
                kind=kind,
                code=code,
                title=title[:160],
                what=what,
                url=link,
                published=pub or datetime.now(CST).strftime("%Y-%m-%d"),
                source="GDACS",
                severity=level or None,
            )
        )
    print("gdacs hits", len(out))
    return out


def fetch_reliefweb() -> list[dict]:
    """Ongoing disasters via ReliefWeb list API (GET)."""
    params = urllib.parse.urlencode(
        {
            "appname": "atlas-cashloan-watch",
            "limit": "40",
            "sort[]": "date.created:desc",
            "filter[field]": "status",
            "filter[value]": "ongoing",
            "filter[operator]": "OR",
        }
    )
    # status ongoing OR alert — two requests merged
    out: list[dict] = []
    for status in ("ongoing", "alert"):
        q = urllib.parse.urlencode(
            {
                "appname": "atlas-cashloan-watch",
                "limit": "30",
                "sort[]": "date.created:desc",
                "filter[field]": "status",
                "filter[value]": status,
            }
        )
        # v1 已下线(410)；v2 需预审 appname，未通过时 _get 返回空并跳过
        raw = _get(f"https://api.reliefweb.int/v2/disasters?{q}")
        if not raw:
            continue
        try:
            data = json.loads(raw.decode("utf-8"))
        except Exception as e:
            print("reliefweb json fail", status, e)
            continue
        for row in data.get("data") or []:
            fields = row.get("fields") or {}
            name = fields.get("name") or ""
            countries = fields.get("country") or []
            types = fields.get("type") or []
            href = fields.get("url")
            if isinstance(href, dict):
                url = href.get("alias") or href.get("self") or ""
            else:
                url = str(href or "")
            if not url:
                url = f"https://reliefweb.int/disaster/{row.get('id', '')}"
            date = fields.get("date") or {}
            published = _iso_day((date.get("created") if isinstance(date, dict) else None) or "")
            cnames = []
            for c in countries if isinstance(countries, list) else []:
                if isinstance(c, dict):
                    cnames.append(c.get("name") or "")
                else:
                    cnames.append(str(c))
            code = _code_from_text(name, " ".join(cnames))
            if not code:
                continue
            type_names = []
            for t in types if isinstance(types, list) else []:
                if isinstance(t, dict):
                    type_names.append(t.get("name") or "")
                else:
                    type_names.append(str(t))
            kind = _kind_from_text(" ".join(type_names) + " " + name)
            st = fields.get("status") or status
            what = f"ReliefWeb 标注{NAME_ZH.get(code, code)}相关灾害「{name}」状态 {st}"
            out.append(
                _item(
                    kind=kind,
                    code=code,
                    title=name[:160],
                    what=what,
                    url=str(url),
                    published=published or datetime.now(CST).strftime("%Y-%m-%d"),
                    source="ReliefWeb",
                    severity=st or None,
                )
            )
        time.sleep(0.25)
    print("reliefweb hits", len(out))
    return out


INVESTED_PRIORITY = ("MX", "TH", "ID", "PH", "HK", "IN", "BR", "VN", "MY", "SG", "PK", "BD", "NG", "KE")
LEVEL_RANK = {"Red": 0, "Orange": 1, "Green": 2, "": 3}


def collapse_by_country_kind(items: list[dict]) -> list[dict]:
    """同国同灾害类型只留 1 条，标题/正文写清「另有 N 条已合并」。"""
    buckets: dict[tuple[str, str], list[dict]] = {}
    for it in items:
        key = (it.get("country") or "", it.get("kind") or "other")
        buckets.setdefault(key, []).append(it)

    out: list[dict] = []
    for (code, kind), group in buckets.items():
        if not code:
            continue
        # 地震：只保留有震级的（USGS）；同组取最强
        if kind == "earthquake":
            with_mag = [x for x in group if isinstance(x.get("mag"), (int, float))]
            pool = with_mag or group
            ranked = sorted(
                pool,
                key=lambda x: (
                    -float(x["mag"]) if isinstance(x.get("mag"), (int, float)) else 0.0,
                    -(
                        int((x.get("published") or "1970-01-01").replace("-", "")[:8])
                        if (x.get("published") or "").count("-") == 2
                        else 0
                    ),
                ),
            )
        else:
            ranked = sorted(
                group,
                key=lambda x: (
                    LEVEL_RANK.get(
                        (
                            x.get("severity")
                            if x.get("severity") in LEVEL_RANK
                            else _alert_level(str(x.get("severity") or ""), x.get("title") or "")
                        ),
                        3,
                    ),
                    -(
                        int((x.get("published") or "1970-01-01").replace("-", "")[:8])
                        if (x.get("published") or "").count("-") == 2
                        else 0
                    ),
                ),
            )
        best = dict(ranked[0])
        n_extra = len(group) - 1
        mag = best.get("mag") if isinstance(best.get("mag"), (int, float)) else None
        level = (
            best.get("severity")
            if best.get("severity") in LEVEL_RANK
            else _alert_level(str(best.get("severity") or ""), best.get("title") or "", best.get("what") or "")
        )
        place = best.get("titleEn") or ""
        m_place = re.search(r"震中附近\s+([^，,。]+)", best.get("what") or "")
        if m_place:
            place = m_place.group(1).strip()
        best["title"] = _zh_title(
            kind=kind,
            code=code,
            published=best.get("published") or "",
            mag=float(mag) if mag is not None else None,
            place=place,
            level=level or None,
            cyclone_name=_cyclone_name(f"{best.get('titleEn') or ''} {best.get('what') or ''}"),
        )
        # 清掉历史「含N起」角标（合并说明只留正文）
        best["title"] = re.sub(r"（含\d+起）", "", best["title"]).strip()
        if n_extra > 0:
            if kind == "earthquake":
                mags = [float(x["mag"]) for x in group if isinstance(x.get("mag"), (int, float))]
                tip = f"同国近7日另监测到 {n_extra} 次达标地震"
                if mags:
                    tip += f"（区间约 M{min(mags):.1f}–M{max(mags):.1f}）"
                tip += "，本条取最强合并展示。"
            else:
                tip = f"同国同类另有 {n_extra} 条通报已合并，本条取级别最高或最新。"
            what = (best.get("what") or "").rstrip("。")
            if tip not in what:
                best["what"] = f"{what}。{tip}"
            # 合并数量只写正文，避免标题「含35起」更像刷屏
        out.append(best)
    return out


def dedupe(items: list[dict], cap: int = 28) -> list[dict]:
    """先同国同类合并，再按展业优先级截断。"""
    collapsed = collapse_by_country_kind(items)
    seen_url: set[str] = set()
    out: list[dict] = []

    def rank(it: dict) -> tuple:
        code = it.get("country") or ""
        pri = INVESTED_PRIORITY.index(code) if code in INVESTED_PRIORITY else 80
        day = it.get("published") or ""
        mag = it.get("mag")
        mag_v = -float(mag) if isinstance(mag, (int, float)) else 0.0
        level = it.get("severity") if it.get("severity") in LEVEL_RANK else ""
        return (pri, LEVEL_RANK.get(level or "", 3), day, mag_v)

    for it in sorted(collapsed, key=rank):
        url = (it.get("url") or "").strip()
        if url and url in seen_url:
            continue
        if url:
            seen_url.add(url)
        out.append(it)
        if len(out) >= cap:
            break
    out.sort(key=lambda x: x.get("published") or "", reverse=True)
    return out


def main() -> None:
    prior: dict = {}
    if OUT.exists():
        try:
            prior = json.loads(OUT.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            prior = {}

    fresh: list[dict] = []
    fresh.extend(fetch_usgs())
    time.sleep(0.3)
    fresh.extend(fetch_gdacs())
    time.sleep(0.3)
    fresh.extend(fetch_reliefweb())

    # 仅保留近 10 天 prior，且只吸收人工改过的 what/result（避免旧英文标题回灌）
    cutoff = (datetime.now(CST) - timedelta(days=10)).strftime("%Y-%m-%d")
    by_url = {
        it.get("url"): it
        for it in (prior.get("items") or [])
        if it.get("url") and (it.get("published") or "") >= cutoff
    }
    merged_fresh: list[dict] = []
    for it in fresh:
        old = by_url.get(it.get("url") or "")
        if old and old.get("_manual"):
            it = {
                **it,
                "what": old.get("what") or it.get("what"),
                "result": old.get("result") or it.get("result"),
                "cashLoanHint": old.get("cashLoanHint") or it.get("cashLoanHint"),
                "title": old.get("title") or it.get("title"),
                "_manual": True,
            }
        merged_fresh.append(it)

    items = dedupe(merged_fresh, cap=28)
    by_country: dict[str, int] = {}
    by_kind: dict[str, int] = {}
    for it in items:
        by_country[it["country"]] = by_country.get(it["country"], 0) + 1
        by_kind[it["kind"]] = by_kind.get(it["kind"], 0) + 1

    now = datetime.now(CST)
    payload = {
        "source": "USGS·GDACS·ReliefWeb",
        "generatedAt": now.strftime("%Y-%m-%d %H:%M"),
        "displayDate": now.strftime("%Y-%m-%d"),
        "note": "展业/热点国天灾人祸扫描；同国同类已合并。用于信贷资产与展业运营压力提示，不能替代当地应急与贷后处置。",
        "stats": {
            "itemTotal": len(items),
            "byCountry": by_country,
            "byKind": by_kind,
        },
        "items": items,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("wrote", OUT, "items", len(items), "countries", sorted(by_country))


if __name__ == "__main__":
    main()
