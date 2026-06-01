from __future__ import annotations

from pathlib import Path


def ensure_run_dirs(run_dir: Path) -> dict[str, Path]:
    dirs = {
        "screenshots": run_dir / "screenshots",
        "metadata": run_dir / "metadata",
        "logs": run_dir / "logs",
    }
    for path in dirs.values():
        path.mkdir(parents=True, exist_ok=True)
    return dirs


def build_supabase_storage_path(
    *,
    company_code: str,
    type_code: str,
    subtype_code: str,
    screen_type_code: str,
    content_hash: str,
    order_no: int,
    ext: str = "png",
) -> str:
    """content-addressed storage path.
    같은 content_hash → 항상 같은 경로 (idempotent 업로드).
    다른 content_hash → 다른 경로 (기존 파일 덮어쓰기 없음).
    """
    order = str(order_no).zfill(3)
    hash_prefix = content_hash[:8] if content_hash else "00000000"
    filename = (
        f"{company_code}_{type_code}_{subtype_code}_"
        f"{screen_type_code}_{order}_{hash_prefix}.{ext}"
    )
    return f"{company_code}/{type_code}/{subtype_code}/{filename}"
