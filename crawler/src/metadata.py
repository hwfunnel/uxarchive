from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .storage import build_supabase_storage_path


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha256_file(path: Path) -> str | None:
    if not path.exists():
        return None
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_metadata(
    *,
    run_id: str,
    run_config: dict[str, Any],
    target: dict[str, Any],
    screenshot_path: Path,
    output_root: Path,
    captured_at: str,
    page_title: str | None,
    final_url: str | None,
    status: str,
    error_message: str | None,
    http_status: int | None,
    full_page: bool,
) -> dict[str, Any]:
    company_code = target.get("company_code") or run_config.get("company_code")
    type_code = target.get("type_code") or run_config.get("type_code")
    subtype_code = target.get("subtype_code") or run_config.get("subtype_code")
    screen_type_code = target.get("screen_type_code")
    version = target.get("version") or run_config.get("version")
    order_no = int(target.get("order_no", 1))
    viewport = target.get("viewport") or run_config.get("viewport") or {"width": 390, "height": 844}

    screenshot_hash = sha256_file(screenshot_path)
    relative_screenshot = screenshot_path.relative_to(output_root)

    storage_path = None
    if all([company_code, type_code, subtype_code, screen_type_code, version]):
        storage_path = build_supabase_storage_path(
            company_code=company_code,
            type_code=type_code,
            subtype_code=subtype_code,
            screen_type_code=screen_type_code,
            version=version,
            order_no=order_no,
        )

    return {
        "screen_id": target["screen_id"],
        "run_id": run_id,
        "company_code": company_code,
        "company_name": target.get("company_name") or run_config.get("company_name"),
        "type_code": type_code,
        "subtype_code": subtype_code,
        "screen_type_code": screen_type_code,
        "order_no": order_no,
        "version": version,
        "label": target.get("label"),
        "source_url": target["source_url"],
        "captured_at": captured_at,
        "viewport": viewport,
        "device_type": target.get("device_type") or run_config.get("device_type", "mobile"),
        "full_page": full_page,
        "screenshot_path": str(relative_screenshot),
        "page_title": page_title,
        "final_url": final_url,
        "http_status": http_status,
        "status": status,
        "error_message": error_message,
        "content_hash": screenshot_hash,
        "screenshot_hash": screenshot_hash,
        "supabase_candidate": {
            "storage_bucket": "screens",
            "storage_path": storage_path,
            "screen_set": {
                "company_code": company_code,
                "type_code": type_code,
                "subtype_code": subtype_code,
                "version": version,
            },
            "screen": {
                "screen_type_code": screen_type_code,
                "order_no": order_no,
                "imgsrc": storage_path,
            },
        },
    }


def write_metadata(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
