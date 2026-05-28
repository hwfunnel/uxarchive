from __future__ import annotations

from pathlib import Path
from typing import Any


class SupabaseUploadNotEnabled(RuntimeError):
    pass


def prepare_upload_plan(metadata: dict[str, Any], screenshot_path: Path) -> dict[str, Any]:
    candidate = metadata.get("supabase_candidate", {})
    return {
        "dry_run": True,
        "message": "Supabase upload is intentionally disabled in phase 1.",
        "screenshot_path": str(screenshot_path),
        "storage_bucket": candidate.get("storage_bucket"),
        "storage_path": candidate.get("storage_path"),
        "screen_set": candidate.get("screen_set"),
        "screen": candidate.get("screen"),
    }


def upload_to_supabase(*_: Any, **__: Any) -> None:
    raise SupabaseUploadNotEnabled(
        "Supabase upload/insert is disabled for this phase. "
        "Enable it only after explicit user approval."
    )
