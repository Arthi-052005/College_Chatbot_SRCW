"""
Download the text of https://srcw.ac.in/ into backend/knowledge/web/ so the chatbot can use it.

Run from the project root (needs internet):
    pip install requests beautifulsoup4
    python tools/scrape_srcw.py                 # crawl up to 150 pages
    python tools/scrape_srcw.py --max 300       # crawl more
    python tools/scrape_srcw.py --insecure      # if you get SSL certificate errors

Each page becomes one .txt file. PDFs linked on the site (prospectus,
syllabus, etc.) are downloaded into backend/knowledge/pdfs/.
Then restart the backend (or call POST /api/reindex).
"""
import argparse
import re
import time
import urllib.robotparser
from collections import deque
from pathlib import Path
from urllib.parse import urldefrag, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

START = "https://srcw.ac.in/"
OUT = Path(__file__).resolve().parent.parent / "backend" / "knowledge"
HEADERS = {"User-Agent": "SRCW-College-Chatbot/1.0 (student project)"}
SKIP_EXT = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".mp4", ".zip", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx")


def slug(url: str) -> str:
    p = urlparse(url)
    s = re.sub(r"[^a-zA-Z0-9]+", "-", (p.path + ("-" + p.query if p.query else "")).strip("/")) or "home"
    return s[:90].strip("-") or "home"


def clean_text(html: str) -> tuple[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "nav", "footer", "header", "form", "iframe", "svg"]):
        tag.decompose()
    title = (soup.title.string or "").strip() if soup.title and soup.title.string else ""
    lines, seen = [], set()
    for line in soup.get_text("\n").splitlines():
        line = re.sub(r"\s+", " ", line).strip()
        if len(line) > 1 and line not in seen:  # drop blanks and repeated menu items
            seen.add(line)
            lines.append(line)
    return title, "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max", type=int, default=150, help="max pages to crawl")
    ap.add_argument("--delay", type=float, default=0.7, help="seconds between requests")
    ap.add_argument("--insecure", action="store_true", help="skip SSL certificate check")
    args = ap.parse_args()

    host = urlparse(START).netloc.replace("www.", "")
    web_dir, pdf_dir = OUT / "web", OUT / "pdfs"
    web_dir.mkdir(parents=True, exist_ok=True)
    pdf_dir.mkdir(parents=True, exist_ok=True)

    rp = urllib.robotparser.RobotFileParser()
    try:
        rp.set_url(urljoin(START, "/robots.txt")); rp.read()
    except Exception:
        rp = None

    session = requests.Session()
    session.headers.update(HEADERS)
    session.verify = not args.insecure

    queue, seen, pages, pdfs = deque([START]), {START}, 0, 0
    while queue and pages < args.max:
        url = queue.popleft()
        if rp and not rp.can_fetch(HEADERS["User-Agent"], url):
            continue
        try:
            r = session.get(url, timeout=25)
        except Exception as e:
            print(f"[fail] {url}: {e}")
            continue
        ctype = r.headers.get("content-type", "")
        time.sleep(args.delay)

        if "pdf" in ctype or url.lower().endswith(".pdf"):
            name = slug(url) + ".pdf"
            (pdf_dir / name).write_bytes(r.content)
            pdfs += 1
            print(f"[pdf ] {url}")
            continue
        if r.status_code != 200 or "html" not in ctype:
            continue

        title, text = clean_text(r.text)
        if len(text) > 80:
            (web_dir / f"{slug(url)}.txt").write_text(
                f"SOURCE_URL: {url}\n# {title}\n\n{text}", encoding="utf-8"
            )
            pages += 1
            print(f"[page] ({pages}) {url}")

        for a in BeautifulSoup(r.text, "html.parser").find_all("a", href=True):
            link = urldefrag(urljoin(url, a["href"]))[0]
            pu = urlparse(link)
            if pu.scheme not in ("http", "https") or pu.netloc.replace("www.", "") != host:
                continue
            if link.lower().endswith(SKIP_EXT) or link in seen:
                continue
            seen.add(link)
            queue.append(link)

    print(f"\nDone: {pages} pages, {pdfs} PDFs saved under {OUT}")
    print("Now restart the backend (or POST /api/reindex).")


if __name__ == "__main__":
    main()
