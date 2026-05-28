from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from playwright.async_api import Browser, TimeoutError as PlaywrightTimeoutError


MOBILE_USER_AGENT = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
    "Mobile/15E148 Safari/604.1"
)


@dataclass
class CaptureResult:
    page_title: str | None
    final_url: str | None
    http_status: int | None
    status: str
    error_message: str | None


async def capture_page(
    *,
    browser: Browser,
    target: dict[str, Any],
    run_config: dict[str, Any],
    screenshot_path: Path,
    timeout_ms: int,
    full_page: bool,
) -> CaptureResult:
    viewport = target.get("viewport") or run_config.get("viewport") or {"width": 390, "height": 844}
    context = await browser.new_context(
        viewport=viewport,
        is_mobile=True,
        has_touch=True,
        user_agent=target.get("user_agent") or run_config.get("user_agent") or MOBILE_USER_AGENT,
        locale="ko-KR",
        timezone_id="Asia/Seoul",
        device_scale_factor=2,
    )
    page = await context.new_page()
    page.set_default_timeout(timeout_ms)
    http_status = None

    try:
        response = await page.goto(target["source_url"], wait_until="domcontentloaded", timeout=timeout_ms)
        http_status = response.status if response else None

        try:
            await page.wait_for_load_state("networkidle", timeout=min(timeout_ms, 15000))
        except PlaywrightTimeoutError:
            pass

        wait_after_ms = int(target.get("wait_after_load_ms", run_config.get("wait_after_load_ms", 1500)))
        if wait_after_ms > 0:
            await page.wait_for_timeout(wait_after_ms)

        screenshot_path.parent.mkdir(parents=True, exist_ok=True)
        await page.screenshot(path=str(screenshot_path), full_page=full_page)
        return CaptureResult(
            page_title=await page.title(),
            final_url=page.url,
            http_status=http_status,
            status="success",
            error_message=None,
        )
    except Exception as exc:
        return CaptureResult(
            page_title=None,
            final_url=page.url if page else None,
            http_status=http_status,
            status="error",
            error_message=f"{type(exc).__name__}: {exc}",
        )
    finally:
        await context.close()
