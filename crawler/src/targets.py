from __future__ import annotations

import csv
import io
from pathlib import Path
from typing import Any

try:
    import requests as _requests
    _HAS_REQUESTS = True
except ImportError:
    _HAS_REQUESTS = False

GITHUB_CSV_URL = "https://raw.githubusercontent.com/hwfunnel/uxarchive/main/targets.csv"


def load_from_csv(source: str | None = None) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Return (run_config, targets) from a CSV file or GitHub URL."""
    if source is None:
        source = GITHUB_CSV_URL

    if source.startswith("http"):
        content = _fetch_remote(source)
    else:
        content = Path(source).read_text(encoding="utf-8")

    return _parse(content)


def _fetch_remote(url: str) -> str:
    if not _HAS_REQUESTS:
        raise RuntimeError("pip install requests 가 필요합니다")
    resp = _requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.text


def _parse(content: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    reader = csv.DictReader(io.StringIO(content))
    targets: list[dict[str, Any]] = []

    for i, row in enumerate(reader, start=1):
        url = row.get("url", "").strip()
        if not url or url.startswith("#"):
            continue

        company_code = row.get("company_code", "").strip().upper()
        type_code = (row.get("type_code") or "NEW").strip().upper()
        subtype_code = (row.get("subtype_code") or "").strip().upper()
        screen_type_code = (row.get("screen_type_code") or "MAIN").strip().upper()
        order_no = int(row.get("order_no") or i)
        version = (row.get("version") or "V1").strip().upper()

        screen_id = row.get("screen_id", "").strip()
        if not screen_id:
            screen_id = f"{company_code}-{subtype_code}-{screen_type_code}-{order_no:02d}"

        targets.append({
            "screen_id": screen_id,
            "source_url": url,
            "company_code": company_code,
            "company_name": row.get("company_name", "").strip(),
            "type_code": type_code,
            "subtype_code": subtype_code,
            "screen_type_code": screen_type_code,
            "order_no": order_no,
            "version": version,
            "label": row.get("label", "").strip(),
        })

    run_config = {
        "name": "csv-run",
        "device_type": "mobile",
        "viewport": {"width": 390, "height": 844},
        "full_page": True,
        "wait_after_load_ms": 3000,
        "rate_limit_seconds": 3,
    }
    return run_config, targets
