"""
UX Archive Phase 2 Uploader

Dry-run (기본값, Supabase에 아무것도 쓰지 않음):
    python3 -m crawler.src.upload
    python3 -m crawler.src.upload --run-id csv-run_2026-05-28_165915

실제 업로드 (명시적 승인 후에만):
    python3 -m crawler.src.upload --execute
    python3 -m crawler.src.upload --run-id csv-run_2026-05-28_165915 --execute
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

from .logger import configure_logger


# ── CLI ──────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="UX Archive Supabase uploader")
    parser.add_argument("--run-id", default=None,
                        help="업로드할 run ID (기본값: 최신 run)")
    parser.add_argument("--output-dir", default="crawler_output")
    parser.add_argument("--execute", action="store_true",
                        help="실제 Supabase 업로드 실행. 없으면 dry-run.")
    parser.add_argument("--verbose", action="store_true")
    return parser.parse_args()


# ── 파일 탐색 ────────────────────────────────────────────────────────────────

def find_run_dir(output_dir: Path, run_id: str | None) -> Path:
    runs_dir = output_dir / "runs"
    if run_id:
        run_dir = runs_dir / run_id
        if not run_dir.exists():
            raise FileNotFoundError(f"run_id 폴더 없음: {run_dir}")
        return run_dir
    runs = sorted(p for p in runs_dir.iterdir() if p.is_dir())
    if not runs:
        raise FileNotFoundError(f"runs 폴더가 비어있음: {runs_dir}")
    return runs[-1]


def load_metadata_files(run_dir: Path) -> list[dict[str, Any]]:
    meta_dir = run_dir / "metadata"
    if not meta_dir.exists():
        raise FileNotFoundError(f"metadata 폴더 없음: {meta_dir}")
    return [
        json.loads(f.read_text(encoding="utf-8"))
        for f in sorted(meta_dir.glob("*.json"))
    ]


def group_by_set(
    items: list[dict[str, Any]],
) -> dict[tuple[str, str, str, str], list[dict[str, Any]]]:
    """(company_code, type_code, subtype_code, version) 기준으로 묶음"""
    groups: dict[tuple, list] = defaultdict(list)
    for item in items:
        key = (
            item.get("company_code", ""),
            item.get("type_code", ""),
            item.get("subtype_code", ""),
            item.get("version", "V1"),
        )
        groups[key].append(item)
    return groups


# ── dry-run 출력 ─────────────────────────────────────────────────────────────

def print_plan(
    groups: dict[tuple, list],
    output_root: Path,
    logger: Any,
) -> bool:
    """업로드 계획을 출력. PNG 누락이 있으면 False 반환."""
    all_ok = True
    print()
    print("=" * 64)
    print("  DRY RUN — Supabase에 아무것도 쓰지 않습니다")
    print("=" * 64)

    for set_no, ((company, type_code, subtype, version), screens) in enumerate(
        groups.items(), start=1
    ):
        print(f"\n[screen_set {set_no}]")
        print(f"  company_code : {company}")
        print(f"  type_code    : {type_code}")
        print(f"  subtype_code : {subtype}")
        print(f"  version      : {version}")
        print(f"  is_latest    : true  ← 기존 동일 subtype 세트는 false 처리")
        print(f"  screens      : {len(screens)}개")

        for item in sorted(screens, key=lambda x: int(x.get("order_no", 0))):
            candidate = item.get("supabase_candidate", {})
            storage_path = candidate.get("storage_path", "")
            png_path = output_root / item.get("screenshot_path", "")
            png_exists = png_path.exists()

            status = "✓" if png_exists else "✗ PNG 없음"
            if not png_exists:
                all_ok = False

            print(f"\n  └─ [{status}] {item['screen_id']}")
            print(f"       bucket       : {candidate.get('storage_bucket', 'screens')}")
            print(f"       storage_path : {storage_path}")
            print(f"       screen_type  : {item.get('screen_type_code')}")
            print(f"       order_no     : {item.get('order_no')}")
            print(f"       imgsrc       : {storage_path}")

            logger.info("DRY-RUN: %s → %s", item["screen_id"], storage_path)

    print()
    print("  --execute 옵션을 추가하면 실제 업로드가 실행됩니다.")
    print("=" * 64)
    print()
    return all_ok


# ── 실제 업로드 ──────────────────────────────────────────────────────────────

def _supabase_client():
    try:
        from supabase import create_client
    except ImportError:
        raise RuntimeError("pip install supabase 가 필요합니다")

    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise RuntimeError(".env에 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다")
    return create_client(url, key)


def _upload_set(
    supabase: Any,
    company: str,
    type_code: str,
    subtype: str,
    version: str,
    screens: list[dict[str, Any]],
    output_root: Path,
    bucket: str,
    logger: Any,
) -> None:
    today = datetime.now(timezone.utc).date().isoformat()

    # 1. 기존 같은 subtype 세트 is_latest → false
    supabase.table("screen_sets").update({"is_latest": False}).eq(
        "company_code", company
    ).eq("type_code", type_code).eq("subtype_code", subtype).execute()
    logger.info("screen_sets is_latest=false: company=%s subtype=%s", company, subtype)

    # 2. 새 screen_set insert
    set_result = (
        supabase.table("screen_sets")
        .insert({
            "company_code": company,
            "type_code": type_code,
            "subtype_code": subtype,
            "version": version,
            "uploaded_at": today,
            "is_latest": True,
            "change_summary": None,
        })
        .execute()
    )
    set_id = set_result.data[0]["id"]
    logger.info("screen_set inserted: id=%s version=%s", set_id, version)

    # 3. 각 화면 처리
    for item in sorted(screens, key=lambda x: int(x.get("order_no", 0))):
        screen_id = item["screen_id"]
        candidate = item.get("supabase_candidate", {})
        storage_path = candidate.get("storage_path", "")
        png_path = output_root / item.get("screenshot_path", "")

        if not png_path.exists():
            logger.warning("PNG 없음, 스킵: %s", screen_id)
            continue

        # 중복 체크 (같은 imgsrc가 이미 있으면 스킵)
        existing = (
            supabase.table("screens")
            .select("id")
            .eq("imgsrc", storage_path)
            .execute()
        )
        if existing.data:
            logger.info("이미 존재, 스킵: %s → %s", screen_id, storage_path)
            continue

        # Storage 업로드
        with png_path.open("rb") as f:
            supabase.storage.from_(bucket).upload(
                storage_path,
                f,
                {"content-type": "image/png", "upsert": "true"},
            )
        logger.info("Storage 업로드 완료: %s", storage_path)

        # screens row insert
        supabase.table("screens").insert({
            "set_id": set_id,
            "screen_type_code": item.get("screen_type_code"),
            "order_no": item.get("order_no"),
            "imgsrc": storage_path,
        }).execute()
        logger.info("screens insert 완료: %s", screen_id)


def execute_upload(
    groups: dict[tuple, list],
    output_root: Path,
    logger: Any,
) -> int:
    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "screens")
    supabase = _supabase_client()
    failures = 0

    for (company, type_code, subtype, version), screens in groups.items():
        try:
            _upload_set(
                supabase=supabase,
                company=company,
                type_code=type_code,
                subtype=subtype,
                version=version,
                screens=screens,
                output_root=output_root,
                bucket=bucket,
                logger=logger,
            )
        except Exception as exc:
            failures += 1
            logger.error(
                "업로드 실패: company=%s subtype=%s error=%s",
                company, subtype, exc,
            )

    return failures


# ── 진입점 ───────────────────────────────────────────────────────────────────

def main() -> None:
    args = parse_args()

    if load_dotenv:
        load_dotenv(Path("crawler/.env"))

    output_root = Path(args.output_dir)
    run_dir = find_run_dir(output_root, args.run_id)

    log_path = run_dir / "logs" / "uploader.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    logger = configure_logger(log_path, verbose=args.verbose)

    logger.info("Uploader started: run_dir=%s dry_run=%s", run_dir.name, not args.execute)

    items = load_metadata_files(run_dir)
    success_items = [i for i in items if i.get("status") == "success"]
    logger.info("metadata: 전체 %d개, 성공 %d개", len(items), len(success_items))

    groups = group_by_set(success_items)
    all_ok = print_plan(groups, output_root, logger)

    if not args.execute:
        print("  dry-run 완료. 실제 업로드하려면 --execute 옵션을 추가하세요.")
        return

    if not all_ok:
        print("  PNG 누락 파일이 있습니다. 확인 후 다시 실행하세요.")
        sys.exit(1)

    print("  실제 업로드를 시작합니다...")
    failures = execute_upload(groups, output_root, logger)
    logger.info("Uploader finished: failures=%d", failures)

    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
