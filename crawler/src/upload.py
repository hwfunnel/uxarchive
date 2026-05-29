"""
UX Archive Phase 2 Uploader

─ 메타데이터 기반 (크롤러 run 결과 사용):
    python3 -m crawler.src.upload                              # dry-run, 최신 run
    python3 -m crawler.src.upload --run-id csv-run_...        # dry-run, 특정 run
    python3 -m crawler.src.upload --execute                   # 실제 업로드

─ 독립 페이지 모드 (PNG 파일명에서 코드 자동 파싱):
    python3 -m crawler.src.upload --standalone                 # dry-run, 최신 run screenshots/
    python3 -m crawler.src.upload --standalone --png-dir path/ # dry-run, 특정 디렉토리
    python3 -m crawler.src.upload --standalone --execute       # 실제 업로드

실제 --execute 실행은 명시적 승인 후에만 사용하세요.
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

from .filename_parser import parse_stem, parse_png_dir
from .logger import configure_logger
from .storage import build_supabase_storage_path


# ── CLI ──────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="UX Archive Supabase uploader")
    parser.add_argument("--run-id", default=None,
                        help="업로드할 run ID (기본값: 최신 run)")
    parser.add_argument("--output-dir", default="crawler_output")
    parser.add_argument("--standalone", action="store_true",
                        help="독립 페이지 모드: PNG 파일명에서 코드 자동 파싱")
    parser.add_argument("--png-dir", default=None,
                        help="[standalone] PNG 파일 디렉토리 (기본값: 최신 run screenshots/)")
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


# ── 독립 페이지 모드: PNG 파일명 파싱 ────────────────────────────────────────

def load_standalone_items(png_dir: Path, version: str) -> list[dict[str, Any]]:
    parsed, skipped = parse_png_dir(png_dir)

    if skipped:
        print(f"  [경고] 파일명 파싱 불가 (스킵): {[p.name for p in skipped]}")

    items = []
    for p in parsed:
        storage_path = build_supabase_storage_path(
            company_code=p.company_code,
            type_code=p.type_code,
            subtype_code=p.subtype_code,
            screen_type_code=p.screen_type_code,
            version=version,
            order_no=p.order_no,
        )
        png_path = png_dir / f"{p.screen_id}.png"
        items.append({
            "screen_id": p.screen_id,
            "company_code": p.company_code,
            "type_code": p.type_code,
            "subtype_code": p.subtype_code,
            "screen_type_code": p.screen_type_code,
            "order_no": p.order_no,
            "version": version,
            "status": "success",
            "screenshot_path": str(png_path),
            "supabase_candidate": {
                "storage_bucket": "screens",
                "storage_path": storage_path,
            },
            "_png_abs": str(png_path),  # standalone에서는 절대 경로 사용
        })
    return items


# ── 마스터 코드 검증 ─────────────────────────────────────────────────────────

class MasterValidator:
    def __init__(self, supabase: Any):
        self._sb = supabase
        self._cache: dict[str, set[str]] = {}

    def _fetch(self, table: str, col: str) -> set[str]:
        key = f"{table}.{col}"
        if key not in self._cache:
            res = self._sb.table(table).select(col).execute()
            self._cache[key] = {row[col] for row in res.data}
        return self._cache[key]

    def validate(self, company: str, type_code: str, subtype: str, screen_type: str) -> list[str]:
        """누락된 마스터 코드 목록 반환. 정상이면 빈 리스트."""
        errors = []
        if company not in self._fetch("companies", "code"):
            errors.append(f"companies.code '{company}' 없음")
        if type_code not in self._fetch("types", "code"):
            errors.append(f"types.code '{type_code}' 없음")
        if subtype not in self._fetch("subtypes", "code"):
            errors.append(f"subtypes.code '{subtype}' 없음")
        if screen_type not in self._fetch("screen_types", "code"):
            errors.append(f"screen_types.code '{screen_type}' 없음")
        return errors


def _try_make_validator() -> MasterValidator | None:
    """Supabase 자격증명이 있으면 MasterValidator 반환, 없으면 None."""
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        return None
    try:
        from supabase import create_client
        return MasterValidator(create_client(url, key))
    except Exception:
        return None


# ── dry-run 출력 ─────────────────────────────────────────────────────────────

def print_plan(
    groups: dict[tuple, list],
    output_root: Path,
    logger: Any,
    standalone: bool = False,
    validator: MasterValidator | None = None,
) -> bool:
    if validator is None:
        print("  [안내] SUPABASE_URL/KEY 미설정 — 마스터 코드 검증을 건너뜁니다.")

    all_ok = True
    print()
    print("=" * 64)
    print("  DRY RUN — Supabase에 아무것도 쓰지 않습니다")
    if standalone:
        print("  모드: 독립 페이지 (파일명 기반 파싱)")
    print("=" * 64)

    for set_no, ((company, type_code, subtype, version), screens) in enumerate(
        groups.items(), start=1
    ):
        master_errors = validator.validate(company, type_code, subtype,
                                           screens[0].get("screen_type_code", "")) \
                        if validator else []
        master_ok = not master_errors

        print(f"\n[screen_set {set_no}]")
        print(f"  company_code : {company}")
        print(f"  type_code    : {type_code}")
        print(f"  subtype_code : {subtype}")
        print(f"  version      : {version}")
        print(f"  is_latest    : true  ← 기존 동일 subtype 세트는 false 처리")
        print(f"  screens      : {len(screens)}개")

        if not master_ok:
            all_ok = False
            for err in master_errors:
                print(f"  ⚠ 마스터 코드 없음: {err}")

        for item in sorted(screens, key=lambda x: int(x.get("order_no", 0))):
            candidate = item.get("supabase_candidate", {})
            storage_path = candidate.get("storage_path", "")

            # standalone은 절대경로, 메타 기반은 output_root 기준 상대경로
            if standalone:
                png_path = Path(item.get("_png_abs", item.get("screenshot_path", "")))
            else:
                png_path = output_root / item.get("screenshot_path", "")
            png_exists = png_path.exists()

            icons = []
            if not png_exists:
                icons.append("✗ PNG 없음")
                all_ok = False
            else:
                icons.append("✓")
            if not master_ok:
                icons.append("✗ 마스터 코드 없음")

            status_str = " | ".join(icons)
            print(f"\n  └─ [{status_str}] {item['screen_id']}")
            print(f"       bucket       : {candidate.get('storage_bucket', 'screens')}")
            print(f"       storage_path : {storage_path}")
            print(f"       screen_type  : {item.get('screen_type_code')}")
            print(f"       order_no     : {item.get('order_no')}")
            print(f"       imgsrc       : {storage_path}")

            logger.info("DRY-RUN: %s → %s master_ok=%s",
                        item["screen_id"], storage_path, master_ok)

    print()
    print("  --execute 옵션을 추가하면 실제 업로드가 실행됩니다.")
    print("=" * 64)
    print()
    return all_ok


# ── 실제 업로드 ──────────────────────────────────────────────────────────────

def _supabase_client() -> Any:
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
    standalone: bool,
    logger: Any,
) -> None:
    today = datetime.now(timezone.utc).date().isoformat()

    supabase.table("screen_sets").update({"is_latest": False}).eq(
        "company_code", company
    ).eq("type_code", type_code).eq("subtype_code", subtype).execute()
    logger.info("screen_sets is_latest=false: company=%s subtype=%s", company, subtype)

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

    for item in sorted(screens, key=lambda x: int(x.get("order_no", 0))):
        screen_id = item["screen_id"]
        candidate = item.get("supabase_candidate", {})
        storage_path = candidate.get("storage_path", "")

        png_path = (
            Path(item.get("_png_abs", ""))
            if standalone
            else output_root / item.get("screenshot_path", "")
        )

        if not png_path.exists():
            logger.warning("PNG 없음, 스킵: %s", screen_id)
            continue

        existing = supabase.table("screens").select("id").eq("imgsrc", storage_path).execute()
        if existing.data:
            logger.info("이미 존재, 스킵: %s → %s", screen_id, storage_path)
            continue

        with png_path.open("rb") as f:
            supabase.storage.from_(bucket).upload(
                storage_path, f, {"content-type": "image/png", "upsert": "true"},
            )
        logger.info("Storage 업로드 완료: %s", storage_path)

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
    standalone: bool,
    validator: MasterValidator | None,
    logger: Any,
) -> int:
    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "screens")
    supabase = _supabase_client()
    failures = 0

    for (company, type_code, subtype, version), screens in groups.items():
        # 마스터 코드 검증 실패 시 스킵
        if validator:
            errors = validator.validate(
                company, type_code, subtype,
                screens[0].get("screen_type_code", ""),
            )
            if errors:
                logger.error("마스터 코드 없음, 스킵: company=%s subtype=%s errors=%s",
                             company, subtype, errors)
                failures += 1
                continue

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
                standalone=standalone,
                logger=logger,
            )
        except Exception as exc:
            failures += 1
            logger.error("업로드 실패: company=%s subtype=%s error=%s", company, subtype, exc)

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
    logger.info("Uploader started: run_dir=%s standalone=%s dry_run=%s",
                run_dir.name, args.standalone, not args.execute)

    # 독립 페이지 모드
    if args.standalone:
        if args.png_dir:
            png_dir = Path(args.png_dir)
        else:
            png_dir = run_dir / "screenshots"
        if not png_dir.exists():
            print(f"PNG 디렉토리 없음: {png_dir}")
            sys.exit(1)

        today_ver = "V" + datetime.now().strftime("%Y%m%d")
        items = load_standalone_items(png_dir, version=today_ver)
        logger.info("standalone: PNG %d개 파싱 완료 (version=%s)", len(items), today_ver)

    # 메타데이터 기반 모드
    else:
        items = load_metadata_files(run_dir)
        items = [i for i in items if i.get("status") == "success"]
        logger.info("metadata: 성공 %d개", len(items))

    groups = group_by_set(items)
    validator = _try_make_validator()

    all_ok = print_plan(
        groups, output_root, logger,
        standalone=args.standalone,
        validator=validator,
    )

    if not args.execute:
        print("  dry-run 완료.")
        return

    if not all_ok:
        print("  오류 항목이 있습니다. dry-run 결과를 확인 후 재실행하세요.")
        sys.exit(1)

    print("  실제 업로드를 시작합니다...")
    failures = execute_upload(groups, output_root, args.standalone, validator, logger)
    logger.info("Uploader finished: failures=%d", failures)
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
