from __future__ import annotations

import io
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from playwright.async_api import Browser, Page, TimeoutError as PlaywrightTimeoutError

try:
    from PIL import Image
    _HAS_PIL = True
except ImportError:
    _HAS_PIL = False

MOBILE_USER_AGENT = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
    "Mobile/15E148 Safari/604.1"
)

# document scrollHeight가 viewport보다 이 비율 이상 크면 playwright full_page 사용
_FULL_PAGE_RATIO = 1.2

_null_logger = logging.getLogger("null")
_null_logger.addHandler(logging.NullHandler())


@dataclass
class CaptureResult:
    page_title: str | None
    final_url: str | None
    http_status: int | None
    status: str
    error_message: str | None
    capture_strategy: str | None = None
    document_scroll_height: int | None = None
    body_scroll_height: int | None = None
    selected_scroll_container: str | None = None
    stitched_segments_count: int | None = None
    final_screenshot_width: int | None = None
    final_screenshot_height: int | None = None


# ── 진단 ─────────────────────────────────────────────────────────────────────

async def _diagnose(page: Page, logger: logging.Logger) -> dict:
    info = await page.evaluate("""() => {
        const candidates = Array.from(document.querySelectorAll('*'))
            .filter(el => {
                const s = window.getComputedStyle(el);
                return (s.overflowY === 'scroll' || s.overflowY === 'auto') &&
                       el.scrollHeight > el.clientHeight + 10;
            })
            .sort((a, b) =>
                (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight)
            )
            .slice(0, 10)
            .map(el => {
                const s = window.getComputedStyle(el);
                return {
                    tag: el.tagName,
                    id: el.id || '',
                    className: (el.className || '').toString().substring(0, 60),
                    overflowY: s.overflowY,
                    position: s.position,
                    clientHeight: el.clientHeight,
                    scrollHeight: el.scrollHeight,
                };
            });
        return {
            innerHeight: window.innerHeight,
            docScrollHeight: document.documentElement.scrollHeight,
            bodyScrollHeight: document.body.scrollHeight,
            scrollingElement: document.scrollingElement
                ? document.scrollingElement.tagName : null,
            candidates,
        };
    }""")

    logger.debug(
        "Diagnostics: innerHeight=%d docScrollHeight=%d bodyScrollHeight=%d scrollingElement=%s",
        info["innerHeight"], info["docScrollHeight"],
        info["bodyScrollHeight"], info["scrollingElement"],
    )
    for i, c in enumerate(info["candidates"]):
        logger.debug(
            "  ScrollCandidate #%d <%s id=%r class=%r> overflowY=%s position=%s "
            "clientH=%d scrollH=%d",
            i + 1, c["tag"], c["id"], c["className"],
            c["overflowY"], c["position"], c["clientHeight"], c["scrollHeight"],
        )
    return info


# ── fixed 요소 숨기기/복원 ─────────────────────────────────────────────────

async def _hide_fixed(page: Page) -> None:
    await page.evaluate("""() => {
        document.querySelectorAll('*').forEach(el => {
            if (window.getComputedStyle(el).position === 'fixed') {
                el.setAttribute('data-ch-vis', el.style.visibility || '');
                el.style.visibility = 'hidden';
            }
        });
    }""")


async def _restore_fixed(page: Page) -> None:
    await page.evaluate("""() => {
        document.querySelectorAll('[data-ch-vis]').forEach(el => {
            el.style.visibility = el.getAttribute('data-ch-vis');
            el.removeAttribute('data-ch-vis');
        });
    }""")


# ── stitch 캡처 ──────────────────────────────────────────────────────────────

async def _stitch_capture(
    page: Page,
    viewport_height: int,
    device_scale_factor: int,
    hide_fixed: bool,
    logger: logging.Logger,
) -> tuple[bytes | None, dict]:
    if not _HAS_PIL:
        raise RuntimeError("pip install Pillow 가 필요합니다")

    container_info = await page.evaluate("""() => {
        const el = Array.from(document.querySelectorAll('*'))
            .filter(el => {
                const s = window.getComputedStyle(el);
                return (s.overflowY === 'scroll' || s.overflowY === 'auto') &&
                       el.scrollHeight > el.clientHeight + 10;
            })
            .sort((a, b) =>
                (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight)
            )[0];
        if (!el) return null;
        el.setAttribute('data-ch-scroll', 'true');
        return {
            tag: el.tagName,
            id: el.id || '',
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
        };
    }""")

    if not container_info:
        logger.warning("Stitch: 스크롤 컨테이너를 찾지 못했습니다")
        return None, {}

    logger.info(
        "Stitch: <%s id=%r> scrollHeight=%d clientHeight=%d",
        container_info["tag"], container_info["id"],
        container_info["scrollHeight"], container_info["clientHeight"],
    )

    total_content = container_info["scrollHeight"]
    stride = viewport_height

    # 스크롤 위치 목록 생성
    positions: list[int] = list(range(0, total_content, stride))
    last_pos = max(0, total_content - viewport_height)
    if not positions or positions[-1] != last_pos:
        positions.append(last_pos)

    if hide_fixed:
        await _hide_fixed(page)

    segments: list[Image.Image] = []
    prev_end = 0

    try:
        for i, pos in enumerate(positions):
            await page.evaluate(
                """(pos) => {
                    const el = document.querySelector('[data-ch-scroll="true"]');
                    if (el) el.scrollTop = pos;
                }""",
                pos,
            )
            await page.wait_for_timeout(200)

            raw = await page.screenshot()
            img = Image.open(io.BytesIO(raw))

            if i == 0:
                segments.append(img)
                prev_end = pos + stride
            else:
                overlap_css = prev_end - pos
                overlap_px = int(overlap_css * device_scale_factor)
                if 0 < overlap_px < img.height:
                    img = img.crop((0, overlap_px, img.width, img.height))
                segments.append(img)
                prev_end = pos + stride

    finally:
        if hide_fixed:
            await _restore_fixed(page)
        await page.evaluate("""() => {
            const el = document.querySelector('[data-ch-scroll="true"]');
            if (el) el.removeAttribute('data-ch-scroll');
        }""")

    total_h = sum(s.height for s in segments)
    total_w = segments[0].width if segments else 0
    stitched = Image.new("RGB", (total_w, total_h))
    y = 0
    for seg in segments:
        stitched.paste(seg, (0, y))
        y += seg.height

    buf = io.BytesIO()
    stitched.save(buf, format="PNG")

    label = f"<{container_info['tag']} id={container_info['id']!r}>"
    return buf.getvalue(), {
        "selected_scroll_container": label,
        "stitched_segments_count": len(segments),
        "final_screenshot_width": total_w,
        "final_screenshot_height": total_h,
    }


# ── 메인 캡처 ────────────────────────────────────────────────────────────────

async def capture_page(
    *,
    browser: Browser,
    target: dict[str, Any],
    run_config: dict[str, Any],
    screenshot_path: Path,
    timeout_ms: int,
    full_page: bool,
    logger: logging.Logger | None = None,
) -> CaptureResult:
    log = logger or _null_logger
    viewport = (
        target.get("viewport")
        or run_config.get("viewport")
        or {"width": 390, "height": 844}
    )
    device_scale_factor = int(
        target.get("device_scale_factor")
        or run_config.get("device_scale_factor", 2)
    )
    hide_fixed = bool(target.get("hide_fixed") or run_config.get("hide_fixed", False))

    context = await browser.new_context(
        viewport=viewport,
        is_mobile=True,
        has_touch=True,
        user_agent=(
            target.get("user_agent")
            or run_config.get("user_agent")
            or MOBILE_USER_AGENT
        ),
        locale="ko-KR",
        timezone_id="Asia/Seoul",
        device_scale_factor=device_scale_factor,
    )
    page = await context.new_page()
    page.set_default_timeout(timeout_ms)
    http_status = None

    try:
        response = await page.goto(
            target["source_url"], wait_until="domcontentloaded", timeout=timeout_ms
        )
        http_status = response.status if response else None

        try:
            await page.wait_for_load_state("networkidle", timeout=min(timeout_ms, 15000))
        except PlaywrightTimeoutError:
            pass

        wait_after_ms = int(
            target.get("wait_after_load_ms")
            or run_config.get("wait_after_load_ms", 1500)
        )
        if wait_after_ms > 0:
            await page.wait_for_timeout(wait_after_ms)

        # 진단
        diag = await _diagnose(page, log)
        doc_h = diag["docScrollHeight"]
        body_h = diag["bodyScrollHeight"]
        vp_h = viewport["height"]

        # 전략 결정
        extra: dict = {
            "document_scroll_height": doc_h,
            "body_scroll_height": body_h,
        }

        screenshot_path.parent.mkdir(parents=True, exist_ok=True)

        if not full_page:
            await page.screenshot(path=str(screenshot_path))
            img = Image.open(str(screenshot_path))
            extra.update({
                "capture_strategy": "viewport_only",
                "final_screenshot_width": img.width,
                "final_screenshot_height": img.height,
            })

        elif doc_h >= vp_h * _FULL_PAGE_RATIO:
            # document 자체가 충분히 길면 playwright full_page 사용
            log.info("Strategy: playwright_full_page (docH=%d vpH=%d)", doc_h, vp_h)
            await page.screenshot(path=str(screenshot_path), full_page=True)
            img = Image.open(str(screenshot_path))
            extra.update({
                "capture_strategy": "playwright_full_page",
                "final_screenshot_width": img.width,
                "final_screenshot_height": img.height,
            })

        else:
            # 내부 스크롤 컨테이너가 있으면 stitch
            log.info("Strategy: stitched_scroll_container (docH=%d vpH=%d)", doc_h, vp_h)
            img_bytes, stitch_info = await _stitch_capture(
                page=page,
                viewport_height=vp_h,
                device_scale_factor=device_scale_factor,
                hide_fixed=hide_fixed,
                logger=log,
            )
            if img_bytes:
                screenshot_path.write_bytes(img_bytes)
                extra.update({"capture_strategy": "stitched_scroll_container"})
                extra.update(stitch_info)
            else:
                # fallback: viewport only
                log.warning("Stitch 실패, viewport 캡처로 대체")
                await page.screenshot(path=str(screenshot_path))
                img = Image.open(str(screenshot_path))
                extra.update({
                    "capture_strategy": "viewport_fallback",
                    "final_screenshot_width": img.width,
                    "final_screenshot_height": img.height,
                })

        return CaptureResult(
            page_title=await page.title(),
            final_url=page.url,
            http_status=http_status,
            status="success",
            error_message=None,
            **extra,
        )

    except Exception as exc:
        log.error("Capture error for %s: %s", target.get("source_url"), exc)
        return CaptureResult(
            page_title=None,
            final_url=page.url if page else None,
            http_status=http_status,
            status="error",
            error_message=f"{type(exc).__name__}: {exc}",
        )
    finally:
        await context.close()
