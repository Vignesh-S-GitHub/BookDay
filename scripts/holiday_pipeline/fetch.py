"""Polite conditional fetching. Errors never replace approved records."""

import hashlib
import shutil
import time
from datetime import UTC, datetime
from urllib import error, request
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

from .storage import DATA, read, write

AGENT = "BookDayHolidayReview/1.0"
LIMIT = 8 * 1024 * 1024


def fetch(
    source: dict, cache, opener=request.urlopen, sleeper=time.sleep
) -> tuple[bytes, dict]:
    url = source["url"]
    if (
        not url
        or not url.startswith("https://")
        or source.get("collection") != "public-notice"
    ):
        raise ValueError("Source pending verification or collection authorization")
    base = urlsplit(url)
    robots_url = f"{base.scheme}://{base.netloc}/robots.txt"
    try:
        with opener(
            request.Request(robots_url, headers={"User-Agent": AGENT}), timeout=20
        ) as response:
            robots = RobotFileParser()
            robots.parse(
                response.read(256000).decode("utf-8", errors="replace").splitlines()
            )
            if not robots.can_fetch(AGENT, url):
                raise ValueError("robots.txt disallows collection")
            sleeper(min(60, robots.crawl_delay(AGENT) or 1))
    except error.HTTPError as exc:
        if exc.code != 404:
            raise ValueError("Cannot verify source collection rules") from exc
    meta_path, body_path = cache / f"{source['id']}.json", cache / f"{source['id']}.bin"
    previous = (
        read(meta_path)
        if meta_path.exists()
        else {
            "sha256": source.get("checksum"),
            "etag": source.get("etag"),
            "last_modified": source.get("last_modified"),
            "retrieved": source.get("retrieval_date"),
            "source_id": source["id"],
            "url": url,
        }
    )
    if not body_path.exists() and source.get("checksum"):
        archived = DATA / "documents" / f"{source['id']}-{source['checksum'][:16]}.pdf"
        if archived.exists():
            cache.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(archived, body_path)
    if body_path.exists() and hashlib.sha256(
        body_path.read_bytes()
    ).hexdigest() != previous.get("sha256"):
        previous = {}
    headers = {"User-Agent": AGENT, "Accept": "application/pdf,text/html"}
    for header, key in [
        ("If-None-Match", "etag"),
        ("If-Modified-Since", "last_modified"),
    ]:
        if previous.get(key) and body_path.exists():
            headers[header] = previous[key]
    for attempt in range(3):
        try:
            with opener(request.Request(url, headers=headers), timeout=30) as response:
                content = response.read(LIMIT + 1)
                if len(content) > LIMIT or not content.startswith(b"%PDF"):
                    raise ValueError(
                        "Unsupported/oversized content or CAPTCHA; manual review required"
                    )
                meta = {
                    "source_id": source["id"],
                    "url": url,
                    "sha256": hashlib.sha256(content).hexdigest(),
                    "retrieved": datetime.now(UTC).isoformat(),
                    "etag": response.headers.get("ETag"),
                    "last_modified": response.headers.get("Last-Modified"),
                    "changed": hashlib.sha256(content).hexdigest()
                    != previous.get("sha256"),
                }
                cache.mkdir(parents=True, exist_ok=True)
                body_path.write_bytes(content)
                write(meta_path, meta)
                return content, meta
        except error.HTTPError as exc:
            if exc.code == 304 and body_path.exists():
                return body_path.read_bytes(), {**previous, "changed": False}
            if exc.code not in {429, 500, 502, 503, 504} or attempt == 2:
                raise
            sleeper(
                min(
                    60,
                    max(
                        2 ** (attempt + 1),
                        int(exc.headers.get("Retry-After", "0"))
                        if exc.headers.get("Retry-After", "").isdigit()
                        else 0,
                    ),
                )
            )
        except (error.URLError, TimeoutError):
            if attempt == 2:
                raise
            sleeper(2 ** (attempt + 1))
    raise RuntimeError("Fetch exhausted")
