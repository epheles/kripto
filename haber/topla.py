#!/usr/bin/env python3
"""Güvenilir kaynakların RSS akışlarından son haberleri toplar.

Kullanım: python3 haber/topla.py [saat]   (varsayılan: son 18 saat)
Çıktı: kaynak, tarih, başlık, kısa açıklama ve link içeren JSON (stdout).
Sadece Python standart kütüphanesi kullanır.
"""
import json, re, sys, html
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

FEEDS = [
    # Kripto odaklı
    ("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss"),
    ("The Block", "https://www.theblock.co/rss.xml"),
    ("Cointelegraph", "https://cointelegraph.com/rss"),
    ("Decrypt", "https://decrypt.co/feed"),
    ("Bitcoin Magazine", "https://bitcoinmagazine.com/.rss/full/"),
    # Dünya / makro (Reuters, Bloomberg, FT, WSJ başlıkları Google News üzerinden)
    ("Google News: kripto", "https://news.google.com/rss/search?q=(bitcoin+OR+crypto)+(site:reuters.com+OR+site:bloomberg.com+OR+site:ft.com+OR+site:wsj.com+OR+site:cnbc.com)+when:1d&hl=en-US&gl=US&ceid=US:en"),
    ("Google News: makro", "https://news.google.com/rss/search?q=(Federal+Reserve+OR+inflation+OR+Treasury+yields+OR+tariffs)+(site:reuters.com+OR+site:bloomberg.com+OR+site:cnbc.com)+when:1d&hl=en-US&gl=US&ceid=US:en"),
]

UA = {"User-Agent": "Mozilla/5.0 (KriptoCizelge news collector)"}


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()


def clean(s, n=320):
    s = html.unescape(re.sub(r"<[^>]+>", " ", s or ""))
    s = re.sub(r"\s+", " ", s).strip()
    return s[:n]


def parse_date(s):
    if not s:
        return None
    try:
        d = parsedate_to_datetime(s)
    except Exception:
        try:
            d = datetime.fromisoformat(s.replace("Z", "+00:00"))
        except Exception:
            return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def main():
    hours = float(sys.argv[1]) if len(sys.argv) > 1 else 18
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    out, errors, seen = [], [], set()
    for name, url in FEEDS:
        try:
            root = ET.fromstring(fetch(url))
        except Exception as e:
            errors.append(f"{name}: {e}")
            continue
        for it in root.iter("item"):
            title = clean(it.findtext("title"), 200)
            link = (it.findtext("link") or "").strip()
            d = parse_date(it.findtext("pubDate"))
            if not title or not d or d < since:
                continue
            if title.startswith("Watch ") or "Trending News" in title or title.count(" - ") > 1 and len(title) < 40:
                continue  # video ve bölüm sayfaları
            key = re.sub(r"\W+", "", title.lower())[:60]
            if key in seen:
                continue
            seen.add(key)
            src = name
            s = it.find("source")
            if s is not None and s.text:
                src = s.text.strip()  # Google News: asıl yayıncı
            out.append({
                "kaynak": src,
                "tarih": d.astimezone(timezone.utc).isoformat(timespec="minutes"),
                "baslik": title,
                "aciklama": "" if name.startswith("Google") else clean(it.findtext("description")),
                "link": link,
            })
    out.sort(key=lambda x: x["tarih"], reverse=True)
    json.dump({"adet": len(out), "hatalar": errors, "haberler": out}, sys.stdout, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
