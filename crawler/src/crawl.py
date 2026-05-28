from __future__ import annotations

import argparse
import asyncio
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None

from playwright.async_api import async_playwright

from .capture import capture_page
from .logger import configure_logger
from .metadata import build_metadata, utc_now_iso, write_metadata
from .storage import ensure_run_dirs
from .targets import load_from_csv


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def make_run_id(prefix: str | None = None) -> str:
    stamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    return f"{prefix}_{stamp}" if prefix else stamp


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="UX Archive mobile screenshot crawler")
    parser.add_argument("--targets", default=None, help="로컬 JSON 타겟 파일 경로")
    parser.add_argument("--csv", nargs="?", const="github", metavar="PATH_OR_URL",
                        help="CSV에서 타겟 로드. 값 없으면 GitHub에서 자동으로 읽음")
    parser.add_argument("--output-dir", default=None)
    parser.add_argument("--run-id", default=None)
    parser.add_argument("--headful", action="store_true", help="Run browser with a visible window")
    parser.add_argument("--above-fold", action="store_true", help="Capture viewport only instead of full page")
    parser.add_argument("--timeout-ms", type=int, default=None)
    parser.add_argument("--verbose", action="store_true")
    return parser.parse_args()


async def run() -> int:
    args = parse_args()
    if load_dotenv:
        load_dotenv(Path("crawler/.env"))

    if args.csv is not None:
        csv_source = None if args.csv == "github" else args.csv
        run_config, targets = load_from_csv(csv_source)
    else:
        target_path = Path(args.targets or "crawler/config/targets.samsung.json")
        config = load_json(target_path)
        run_config = config.get("run", {})
        targets = config.get("targets", [])
    if not targets:
        raise ValueError("타겟이 없습니다. --csv 또는 --targets 옵션을 확인하세요")

    output_root = Path(args.output_dir or os.getenv("CRAWLER_OUTPUT_DIR", "crawler_output"))
    run_id = args.run_id or make_run_id(run_config.get("name"))
    run_dir = output_root / "runs" / run_id
    dirs = ensure_run_dirs(run_dir)
    logger = configure_logger(dirs["logs"] / "crawler.log", verbose=args.verbose)

    full_page = not args.above_fold and bool(run_config.get("full_page", True))
    timeout_ms = args.timeout_ms or int(os.getenv("CRAWLER_DEFAULT_TIMEOUT_MS", run_config.get("timeout_ms", 45000)))
    rate_limit_seconds = float(run_config.get("rate_limit_seconds", 3))

    logger.info("Crawler started: run_id=%s targets=%s full_page=%s", run_id, len(targets), full_page)
    failures = 0

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=not args.headful)
        try:
            for index, target in enumerate(targets):
                screen_id = target["screen_id"]
                screenshot_path = dirs["screenshots"] / f"{screen_id}.png"
                metadata_path = dirs["metadata"] / f"{screen_id}.json"
                captured_at = utc_now_iso()

                logger.info("Capturing %s: %s", screen_id, target["source_url"])
                result = await capture_page(
                    browser=browser,
                    target=target,
                    run_config=run_config,
                    screenshot_path=screenshot_path,
                    timeout_ms=timeout_ms,
                    full_page=full_page,
                )

                if result.status != "success":
                    failures += 1
                    logger.error("Capture failed for %s: %s", screen_id, result.error_message)
                else:
                    logger.info("Capture succeeded for %s: %s", screen_id, screenshot_path)

                metadata = build_metadata(
                    run_id=run_id,
                    run_config=run_config,
                    target=target,
                    screenshot_path=screenshot_path,
                    output_root=output_root,
                    captured_at=captured_at,
                    page_title=result.page_title,
                    final_url=result.final_url,
                    status=result.status,
                    error_message=result.error_message,
                    http_status=result.http_status,
                    full_page=full_page,
                )
                write_metadata(metadata_path, metadata)
                logger.info("Metadata written for %s: %s", screen_id, metadata_path)

                if index < len(targets) - 1 and rate_limit_seconds > 0:
                    await asyncio.sleep(rate_limit_seconds)
        finally:
            await browser.close()

    logger.info("Crawler finished: run_id=%s failures=%s", run_id, failures)
    return 1 if failures else 0


def main() -> None:
    raise SystemExit(asyncio.run(run()))


if __name__ == "__main__":
    main()
