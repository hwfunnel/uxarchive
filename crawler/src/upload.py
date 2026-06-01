"""
UX Archive Screen Uploader

화면 단위 버전 정책:
  - screen_set은 company/type/subtype 컨테이너로 고정 (V2/V3 생성 없음)
  - 화면별 변경 이력은 screen_revisions로 관리
  - 같은 hash → 기존 imgsrc 재사용, screens 변경 없음
  - 다른 hash → 새 imgsrc 업로드, screens.imgsrc + content_hash 갱신,
                screen_revisions 신규 row 생성
  - 미수집 화면 → screens 변경 없음, screen_revision_checks 기록만
  - storage path는 content-addressed (hash 앞 8자리 포함)

─ 메타데이터 기반:
    python3 -m crawler.src.upload              # dry-run, 최신 run
    python3 -m crawler.src.upload --execute    # 실제 업로드
─ 독립 페이지 모드:
    python3 -m crawler.src.upload --standalone [--png-dir path/] [--execute]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

from .filename_parser import parse_png_dir
from .hash_registry import HashRegistry, ScreenRecord
from .logger import configure_logger
from .storage import build_supabase_storage_path


# ── 화면 상태 ────────────────────────────────────────────────────────────────

CHANGED_UPLOADED = "changed_uploaded"            # hash 달라짐 → 새 PNG 업로드
UNCHANGED_REUSED = "unchanged_reused"            # hash 동일  → 기존 imgsrc 재사용
CARRIED_FORWARD  = "carried_forward_not_crawled" # 이번 run 미포함

# revision action
REV_CREATE_NEW     = "create_new"      # 첫 수집 → screen_revisions 신규 (status=new)
REV_CREATE_CHANGED = "create_changed"  # 변경됨  → screen_revisions 신규 (status=changed)
REV_REUSE_CURRENT  = "reuse_current"   # 동일    → revision 추가 없음
REV_NOT_COLLECTED  = "not_collected"   # 미수집   → revision 추가 없음


# ── 데이터 구조 ──────────────────────────────────────────────────────────────

@dataclass
class ScreenPlan:
    screen_key: str              # 로그·표시용 (company_type_subtype_screentype_order)
    screen_type_code: str
    order_no: int
    status: str                  # CHANGED_UPLOADED / UNCHANGED_REUSED / CARRIED_FORWARD
    new_hash: str | None         # 이번 run의 hash
    prev_hash: str | None        # 이전 hash (DB revision 또는 hash_registry)
    storage_path: str            # DB에 쓸 imgsrc
    png_path: Path | None        # 업로드할 로컬 PNG (없으면 None)
    source_url: str | None
    captured_at: str | None
    master_errors: list[str]
    # revision 추적
    rev_action: str
    check_status: str
    existing_screen_id: str | None    # screens.id (None = 최초 수집)
    current_revision_id: str | None   # 현재 is_current revision.id
    current_version_no: int | None    # 현재 revision.version_no


@dataclass
class GroupPlan:
    """company/type/subtype 단위 업로드 계획."""
    company_code: str
    type_code: str
    subtype_code: str
    set_id: str | None     # 기존 set_id (None = 최초, execute 시 생성)
    crawl_run_id: str
    screens: list[ScreenPlan]


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


# ── Supabase DB 헬퍼 ──────────────────────────────────────────────────────────

def _fetch_latest_set(sb: Any, company: str, type_code: str, subtype: str) -> dict | None:
    """기존 latest screen_set 조회. 없으면 None."""
    res = (
        sb.table("screen_sets")
        .select("id, version")
        .eq("company_code", company)
        .eq("type_code", type_code)
        .eq("subtype_code", subtype)
        .eq("is_latest", True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def _fetch_set_screens(sb: Any, set_id: str) -> list[dict]:
    """set_id에 속한 screens 전체 조회 (content_hash 포함)."""
    res = (
        sb.table("screens")
        .select("id, screen_type_code, order_no, imgsrc, content_hash")
        .eq("set_id", set_id)
        .execute()
    )
    return res.data


def _fetch_current_revisions(sb: Any, screen_ids: list[str]) -> dict[str, dict]:
    """is_current=true revision을 screen_id 기준으로 배치 조회."""
    if not screen_ids:
        return {}
    try:
        res = (
            sb.table("screen_revisions")
            .select("screen_id, id, version_no, content_hash, imgsrc")
            .eq("is_current", True)
            .in_("screen_id", screen_ids)
            .execute()
        )
        return {r["screen_id"]: r for r in res.data}
    except Exception:
        return {}


# ── screen_revisions 헬퍼 ─────────────────────────────────────────────────────

def insert_revision(
    sb: Any,
    screen_id: str,
    prev_revision_id: str | None,
    prev_version_no: int | None,
    imgsrc: str,
    content_hash: str,
    source_url: str | None,
    captured_at: str | None,
    uploaded_at: str,
    status: str,   # 'new' | 'changed'
) -> dict:
    """screen_revisions에 새 버전 row 삽입. 이미지 변경 시에만 호출."""
    if prev_revision_id:
        sb.table("screen_revisions").update({"is_current": False}).eq(
            "id", prev_revision_id
        ).execute()
    version_no = (prev_version_no + 1) if prev_version_no else 1
    return sb.table("screen_revisions").insert({
        "screen_id":        screen_id,
        "version_no":       version_no,
        "imgsrc":           imgsrc,
        "content_hash":     content_hash,
        "source_url":       source_url,
        "captured_at":      captured_at,
        "uploaded_at":      uploaded_at,
        "status":           status,
        "prev_revision_id": prev_revision_id,
        "is_current":       True,
    }).execute().data[0]


def insert_check(
    sb: Any,
    screen_id: str,
    revision_id: str | None,
    crawl_run_id: str,
    status: str,   # 'new' | 'changed' | 'unchanged' | 'not_collected' | 'failed'
    content_hash: str | None = None,
    source_url: str | None = None,
    error_message: str | None = None,
) -> None:
    """screen_revision_checks에 run별 확인 기록 삽입."""
    sb.table("screen_revision_checks").insert({
        "screen_id":     screen_id,
        "revision_id":   revision_id,
        "crawl_run_id":  crawl_run_id,
        "status":        status,
        "content_hash":  content_hash,
        "source_url":    source_url,
        "error_message": error_message,
    }).execute()


def _check_presumed_gone(sb: Any, screen_id: str, threshold: int = 3) -> None:
    """최근 N회 연속 not_collected이면 현재 revision status를 presumed_gone으로 변경."""
    recent = (
        sb.table("screen_revision_checks")
        .select("status")
        .eq("screen_id", screen_id)
        .order("checked_at", desc=True)
        .limit(threshold)
        .execute()
    )
    if (len(recent.data) >= threshold
            and all(r["status"] == "not_collected" for r in recent.data)):
        sb.table("screen_revisions").update({"status": "presumed_gone"}).eq(
            "screen_id", screen_id
        ).eq("is_current", True).execute()


# ── Supabase 마스터 검증 ──────────────────────────────────────────────────────

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

    def validate(
        self, company: str, type_code: str, subtype: str, screen_type: str
    ) -> list[str]:
        errors = []
        if company not in self._fetch("companies", "code"):
            errors.append(f"companies '{company}' 없음")
        if type_code not in self._fetch("types", "code"):
            errors.append(f"types '{type_code}' 없음")
        if subtype not in self._fetch("subtypes", "code"):
            errors.append(f"subtypes '{subtype}' 없음")
        if screen_type not in self._fetch("screen_types", "code"):
            errors.append(f"screen_types '{screen_type}' 없음")
        return errors


def _try_supabase_client() -> Any | None:
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        return None
    try:
        from supabase import create_client
        return create_client(url, key)
    except Exception:
        return None


# ── 업로드 계획 수립 ──────────────────────────────────────────────────────────

def build_plans(
    items: list[dict[str, Any]],
    output_root: Path,
    registry: HashRegistry,
    supabase_client: Any | None,
    standalone: bool,
    validator: MasterValidator | None,
    crawl_run_id: str = "",
) -> list[GroupPlan]:
    """
    company/type/subtype 그룹별 GroupPlan 반환.

    screen_set은 컨테이너로 고정 (버전업 없음).
    화면별로 new / changed / unchanged / not_collected 판단.
    """
    grouped: dict[tuple, list[dict]] = defaultdict(list)
    for item in items:
        key = (
            item.get("company_code", ""),
            item.get("type_code", ""),
            item.get("subtype_code", ""),
        )
        grouped[key].append(item)

    result: list[GroupPlan] = []

    for (company, type_code, subtype), group_items in grouped.items():

        # 1. 기존 latest set 조회 (재사용, 새 버전 생성 없음)
        set_id: str | None = None
        # (screen_type_code, order_no) → {id, imgsrc, content_hash}
        db_existing: dict[tuple[str, int], dict] = {}
        revisions_by_screen: dict[str, dict] = {}

        if supabase_client:
            old_set = _fetch_latest_set(supabase_client, company, type_code, subtype)
            if old_set:
                set_id = old_set["id"]
                for row in _fetch_set_screens(supabase_client, set_id):
                    db_existing[(row["screen_type_code"], int(row["order_no"]))] = row
                # 현재 revision 배치 조회 (N+1 방지)
                screen_ids = [r["id"] for r in db_existing.values()]
                revisions_by_screen = _fetch_current_revisions(supabase_client, screen_ids)

        screens: list[ScreenPlan] = []
        crawled_keys: set[tuple[str, int]] = set()

        # 2. 이번 run에 포함된 화면 처리
        for item in group_items:
            screen_type = item.get("screen_type_code", "")
            order_no    = int(item.get("order_no", 1))
            new_hash    = item.get("content_hash") or item.get("screenshot_hash")
            source_url  = item.get("source_url")
            captured_at = item.get("captured_at")
            crawled_keys.add((screen_type, order_no))

            order_str  = str(order_no).zfill(3)
            screen_key = (
                item.get("screen_id")
                or f"{company}_{type_code}_{subtype}_{screen_type}_{order_str}"
            )

            if standalone:
                png_path = Path(item.get("_png_abs", item.get("screenshot_path", "")))
            else:
                png_path = output_root / item.get("screenshot_path", "")

            existing           = db_existing.get((screen_type, order_no))
            existing_screen_id = existing["id"] if existing else None
            current_rev        = revisions_by_screen.get(existing_screen_id) if existing_screen_id else None

            # prev_hash: DB revision > DB screens.content_hash > hash_registry 순
            prev_reg  = registry.get(company, type_code, subtype, screen_type)
            prev_hash = (
                (current_rev or {}).get("content_hash")
                or (existing or {}).get("content_hash")
                or (prev_reg.content_hash if prev_reg else None)
            )

            if existing is None:
                status       = CHANGED_UPLOADED
                rev_action   = REV_CREATE_NEW
                check_status = "new"
            elif new_hash and prev_hash and new_hash == prev_hash:
                status       = UNCHANGED_REUSED
                rev_action   = REV_REUSE_CURRENT
                check_status = "unchanged"
            else:
                status       = CHANGED_UPLOADED
                rev_action   = REV_CREATE_CHANGED
                check_status = "changed"

            # storage path: content-addressed (hash 앞 8자리)
            if status == CHANGED_UPLOADED:
                storage_path = build_supabase_storage_path(
                    company_code     = company,
                    type_code        = type_code,
                    subtype_code     = subtype,
                    screen_type_code = screen_type,
                    content_hash     = new_hash or "",
                    order_no         = order_no,
                )
            else:
                # 기존 imgsrc 재사용: DB revision > DB screens > hash_registry
                storage_path = (
                    (current_rev or {}).get("imgsrc")
                    or (existing or {}).get("imgsrc")
                    or (prev_reg.imgsrc if prev_reg else "")
                )

            master_errors = (
                validator.validate(company, type_code, subtype, screen_type)
                if validator else []
            )

            screens.append(ScreenPlan(
                screen_key          = screen_key,
                screen_type_code    = screen_type,
                order_no            = order_no,
                status              = status,
                new_hash            = new_hash,
                prev_hash           = prev_hash,
                storage_path        = storage_path,
                png_path            = png_path if (status == CHANGED_UPLOADED and png_path.exists()) else None,
                source_url          = source_url,
                captured_at         = captured_at,
                master_errors       = master_errors,
                rev_action          = rev_action,
                check_status        = check_status,
                existing_screen_id  = existing_screen_id,
                current_revision_id = current_rev["id"] if current_rev else None,
                current_version_no  = current_rev["version_no"] if current_rev else None,
            ))

        # 3. not_collected: DB에 있지만 이번 run에 없는 화면
        for (screen_type, order_no), existing in db_existing.items():
            if (screen_type, order_no) in crawled_keys:
                continue
            existing_screen_id = existing["id"]
            current_rev        = revisions_by_screen.get(existing_screen_id)
            prev_reg           = registry.get(company, type_code, subtype, screen_type)
            order_str          = str(order_no).zfill(3)

            master_errors = (
                validator.validate(company, type_code, subtype, screen_type)
                if validator else []
            )

            screens.append(ScreenPlan(
                screen_key          = f"{company}_{type_code}_{subtype}_{screen_type}_{order_str}",
                screen_type_code    = screen_type,
                order_no            = order_no,
                status              = CARRIED_FORWARD,
                new_hash            = None,
                prev_hash           = (current_rev or {}).get("content_hash") or (prev_reg.content_hash if prev_reg else None),
                storage_path        = (current_rev or {}).get("imgsrc") or existing.get("imgsrc", ""),
                png_path            = None,
                source_url          = None,
                captured_at         = None,
                master_errors       = master_errors,
                rev_action          = REV_NOT_COLLECTED,
                check_status        = "not_collected",
                existing_screen_id  = existing_screen_id,
                current_revision_id = current_rev["id"] if current_rev else None,
                current_version_no  = current_rev["version_no"] if current_rev else None,
            ))

        result.append(GroupPlan(
            company_code = company,
            type_code    = type_code,
            subtype_code = subtype,
            set_id       = set_id,
            crawl_run_id = crawl_run_id,
            screens      = screens,
        ))

    return result


# ── dry-run 출력 ─────────────────────────────────────────────────────────────

_STATUS_ICON = {
    CHANGED_UPLOADED: "↑ changed_uploaded",
    UNCHANGED_REUSED: "= unchanged_reused",
    CARRIED_FORWARD:  "→ not_crawled",
}

_REV_ACTION_LABEL = {
    REV_CREATE_NEW:     "create_new     (screen_revisions 신규, status=new)",
    REV_CREATE_CHANGED: "create_changed (screen_revisions 신규, status=changed)",
    REV_REUSE_CURRENT:  "reuse_current  (screen_revisions 변경 없음)",
    REV_NOT_COLLECTED:  "not_collected  (screen_revisions 변경 없음)",
}


def print_plan(
    plans: list[GroupPlan],
    validator: MasterValidator | None,
    standalone: bool,
    logger: Any,
) -> bool:
    if validator is None:
        print("  [안내] SUPABASE_URL/KEY 미설정 — 마스터 코드 검증 및 DB 조회 건너뜀.")

    all_ok = True
    print()
    print("=" * 76)
    print("  DRY RUN — Supabase에 아무것도 쓰지 않습니다")
    if standalone:
        print("  모드: 독립 페이지 (파일명 기반 파싱)")
    print("  정책: screen_set 컨테이너 고정 / 화면 단위 revision 관리")
    print("=" * 76)

    for group_no, group in enumerate(plans, start=1):
        screens_sorted = sorted(group.screens, key=lambda s: s.order_no)

        n_new      = sum(1 for s in screens_sorted if s.rev_action == REV_CREATE_NEW)
        n_changed  = sum(1 for s in screens_sorted if s.rev_action == REV_CREATE_CHANGED)
        n_unchanged= sum(1 for s in screens_sorted if s.rev_action == REV_REUSE_CURRENT)
        n_notcoll  = sum(1 for s in screens_sorted if s.rev_action == REV_NOT_COLLECTED)

        print(
            f"\n[그룹 {group_no}]  "
            f"{group.company_code} / {group.type_code} / {group.subtype_code}"
        )
        print(f"  set_id     : {group.set_id or '없음 (최초 생성 예정)'}")
        print(
            f"  screens    : {len(screens_sorted)}개  "
            f"(신규 {n_new}  변경 {n_changed}  동일 {n_unchanged}  미수집 {n_notcoll})"
        )

        for plan in screens_sorted:
            icon = _STATUS_ICON[plan.status]
            problems: list[str] = []
            if plan.status == CHANGED_UPLOADED and plan.png_path is None:
                problems.append("PNG 없음")
                all_ok = False
            if plan.master_errors:
                problems.extend(plan.master_errors)
                all_ok = False

            problem_str = f"  ⚠ {', '.join(problems)}" if problems else ""
            rev_label   = _REV_ACTION_LABEL.get(plan.rev_action, plan.rev_action)

            print(f"\n  └─ [{icon}] {plan.screen_key}{problem_str}")
            print(f"       screen_type  : {plan.screen_type_code}")
            print(f"       order_no     : {plan.order_no}")
            print(f"       revision     : {rev_label}")
            if plan.current_revision_id:
                cur_ver = f"r{plan.current_version_no}" if plan.current_version_no else "?"
                print(f"       current_rev  : {cur_ver}  id={plan.current_revision_id[:8]}…")
            else:
                print("       current_rev  : 없음 (첫 수집)")
            print(f"       check_status : {plan.check_status}")

            if plan.status == CHANGED_UPLOADED:
                print(f"       imgsrc(new)  : {plan.storage_path}")
                if plan.new_hash:
                    print(f"       hash(new)    : {plan.new_hash[:16]}…")
                if plan.prev_hash:
                    print(f"       hash(prev)   : {plan.prev_hash[:16]}…")
            else:
                print(f"       imgsrc       : {plan.storage_path}  ← 재사용")
                if plan.prev_hash:
                    print(f"       hash         : {plan.prev_hash[:16]}…")

            logger.info(
                "DRY-RUN: %s status=%s rev_action=%s check_status=%s imgsrc=%s",
                plan.screen_key, plan.status, plan.rev_action,
                plan.check_status, plan.storage_path,
            )

    print()
    print("  --execute 옵션을 추가하면 실제 업로드가 실행됩니다.")
    print("=" * 76)
    print()
    return all_ok


# ── 실제 업로드 ──────────────────────────────────────────────────────────────

def execute_upload(
    plans: list[GroupPlan],
    registry: HashRegistry,
    logger: Any,
) -> int:
    """
    업로드 순서:
    1. screen_set: 기존 재사용 또는 최초(V1) 생성 — 버전업 없음
    2. 화면별:
       - new/changed: PNG 업로드 → screens insert/update → screen_revisions insert
       - unchanged: screen_revision_checks만 기록
       - not_collected: screen_revision_checks만 기록 + presumed_gone 체크
    """
    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "screens")
    from supabase import create_client
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    supabase = create_client(url, key)
    today    = datetime.now(timezone.utc).date().isoformat()
    failures = 0

    for group in plans:
        screens_sorted = sorted(group.screens, key=lambda s: s.order_no)

        if any(s.master_errors for s in screens_sorted):
            logger.error(
                "마스터 코드 오류로 스킵: %s/%s/%s",
                group.company_code, group.type_code, group.subtype_code,
            )
            failures += 1
            continue

        try:
            # 1. screen_set: 기존 재사용 또는 V1 최초 생성 (버전업 없음)
            set_id = group.set_id
            if not set_id:
                set_result = supabase.table("screen_sets").insert({
                    "company_code":   group.company_code,
                    "type_code":      group.type_code,
                    "subtype_code":   group.subtype_code,
                    "version":        "V1",
                    "uploaded_at":    today,
                    "is_latest":      True,
                    "change_summary": None,
                }).execute()
                set_id = set_result.data[0]["id"]
                logger.info("screen_set created: id=%s", set_id)
            else:
                logger.info("screen_set reused: id=%s", set_id)

            for plan in screens_sorted:

                # ── 미수집: screens 변경 없음, check만 기록 ──────────────
                if plan.status == CARRIED_FORWARD:
                    if plan.existing_screen_id:
                        insert_check(
                            supabase,
                            screen_id    = plan.existing_screen_id,
                            revision_id  = plan.current_revision_id,
                            crawl_run_id = group.crawl_run_id,
                            status       = "not_collected",
                            content_hash = plan.prev_hash,
                        )
                        _check_presumed_gone(supabase, plan.existing_screen_id)
                        logger.info(
                            "not_collected: %s (screen_id=%s)",
                            plan.screen_key, plan.existing_screen_id,
                        )
                    continue

                # ── unchanged: screens 변경 없음, check만 기록 ───────────
                if plan.status == UNCHANGED_REUSED:
                    screen_id = plan.existing_screen_id
                    if screen_id:
                        insert_check(
                            supabase,
                            screen_id    = screen_id,
                            revision_id  = plan.current_revision_id,
                            crawl_run_id = group.crawl_run_id,
                            status       = "unchanged",
                            content_hash = plan.new_hash or plan.prev_hash,
                            source_url   = plan.source_url,
                        )
                        logger.info("unchanged: %s (screen_id=%s)", plan.screen_key, screen_id)
                    continue

                # ── changed / new: PNG 업로드 + screens upsert ───────────
                if plan.png_path is None:
                    logger.warning("PNG 없음 스킵: %s", plan.screen_key)
                    continue

                # PNG 업로드 (content-addressed → 같은 hash면 idempotent)
                with plan.png_path.open("rb") as f:
                    supabase.storage.from_(bucket).upload(
                        plan.storage_path,
                        f,
                        {"content-type": "image/png", "upsert": "true"},
                    )
                logger.info("Storage 업로드: %s", plan.storage_path)

                screen_id: str
                if plan.existing_screen_id:
                    # 기존 screen: imgsrc + content_hash 갱신
                    screen_id = plan.existing_screen_id
                    supabase.table("screens").update({
                        "imgsrc":       plan.storage_path,
                        "content_hash": plan.new_hash,
                    }).eq("id", screen_id).execute()
                    logger.info(
                        "screens update: id=%s imgsrc=%s", screen_id, plan.storage_path
                    )
                else:
                    # 신규 screen insert
                    screen_result = supabase.table("screens").insert({
                        "set_id":           set_id,
                        "screen_type_code": plan.screen_type_code,
                        "order_no":         plan.order_no,
                        "imgsrc":           plan.storage_path,
                        "content_hash":     plan.new_hash,
                    }).execute()
                    screen_id = screen_result.data[0]["id"]
                    logger.info(
                        "screens insert: id=%s imgsrc=%s", screen_id, plan.storage_path
                    )

                # screen_revisions insert
                rev_status = "new" if plan.rev_action == REV_CREATE_NEW else "changed"
                rev = insert_revision(
                    supabase,
                    screen_id        = screen_id,
                    prev_revision_id = plan.current_revision_id,
                    prev_version_no  = plan.current_version_no,
                    imgsrc           = plan.storage_path,
                    content_hash     = plan.new_hash or "",
                    source_url       = plan.source_url,
                    captured_at      = plan.captured_at,
                    uploaded_at      = today,
                    status           = rev_status,
                )
                new_revision_id = rev["id"]
                logger.info(
                    "screen_revisions insert: screen_id=%s version_no=%s status=%s",
                    screen_id, rev["version_no"], rev_status,
                )

                # screen_revision_checks insert
                insert_check(
                    supabase,
                    screen_id    = screen_id,
                    revision_id  = new_revision_id,
                    crawl_run_id = group.crawl_run_id,
                    status       = plan.check_status,
                    content_hash = plan.new_hash,
                    source_url   = plan.source_url,
                )
                logger.info(
                    "screen_revision_checks insert: screen_id=%s status=%s",
                    screen_id, plan.check_status,
                )

                # hash_registry 업데이트
                registry.set(
                    group.company_code,
                    group.type_code,
                    group.subtype_code,
                    plan.screen_type_code,
                    ScreenRecord(
                        content_hash = plan.new_hash or "",
                        imgsrc       = plan.storage_path,
                        screen_id    = screen_id,
                        version      = "V1",
                        order_no     = plan.order_no,
                        captured_at  = plan.captured_at or datetime.now(timezone.utc).isoformat(timespec="seconds"),
                        uploaded_at  = today,
                    ),
                )

        except Exception as exc:
            failures += 1
            logger.error(
                "업로드 실패: %s/%s/%s error=%s",
                group.company_code, group.type_code, group.subtype_code, exc,
            )

    registry.save()
    return failures


# ── 독립 페이지 모드 ─────────────────────────────────────────────────────────

def load_standalone_items(png_dir: Path) -> list[dict[str, Any]]:
    """PNG 파일명을 파싱해 아이템 목록 반환."""
    parsed, skipped = parse_png_dir(png_dir)
    if skipped:
        print(f"  [경고] 파일명 파싱 불가 (스킵): {[p.name for p in skipped]}")
    items = []
    for p in parsed:
        png_abs = str(png_dir / f"{p.screen_id}.png")
        items.append({
            "screen_id":         p.screen_id,
            "company_code":      p.company_code,
            "type_code":         p.type_code,
            "subtype_code":      p.subtype_code,
            "screen_type_code":  p.screen_type_code,
            "order_no":          p.order_no,
            "status":            "success",
            "screenshot_path":   png_abs,
            "_png_abs":          png_abs,
        })
    return items


# ── 진입점 ───────────────────────────────────────────────────────────────────

def main() -> None:
    args = parse_args()

    if load_dotenv:
        _env_path = Path(__file__).parent.parent / ".env"
        load_dotenv(_env_path)

    output_root = Path(args.output_dir)
    run_dir     = find_run_dir(output_root, args.run_id)

    log_path = run_dir / "logs" / "uploader.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    logger = configure_logger(log_path, verbose=args.verbose)
    logger.info(
        "Uploader started: run_dir=%s standalone=%s dry_run=%s",
        run_dir.name, args.standalone, not args.execute,
    )

    registry = HashRegistry(output_root / "hash_registry.json")

    if args.standalone:
        png_dir = Path(args.png_dir) if args.png_dir else run_dir / "screenshots"
        if not png_dir.exists():
            print(f"PNG 디렉토리 없음: {png_dir}")
            sys.exit(1)
        items = load_standalone_items(png_dir)
        logger.info("standalone: %d개 파싱", len(items))
    else:
        all_items = load_metadata_files(run_dir)
        items = [i for i in all_items if i.get("status") == "success"]
        logger.info("metadata: 성공 %d개", len(items))

    supabase_client = _try_supabase_client()
    validator = MasterValidator(supabase_client) if supabase_client else None

    plans = build_plans(
        items,
        output_root,
        registry,
        supabase_client = supabase_client,
        standalone      = args.standalone,
        validator       = validator,
        crawl_run_id    = run_dir.name,
    )

    all_ok = print_plan(plans, validator, standalone=args.standalone, logger=logger)

    if not args.execute:
        print("  dry-run 완료.")
        return

    if not all_ok:
        print("  오류 항목이 있습니다. dry-run 결과를 확인 후 재실행하세요.")
        sys.exit(1)

    print("  실제 업로드를 시작합니다...")
    failures = execute_upload(plans, registry, logger)
    logger.info("Uploader finished: failures=%d", failures)
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
