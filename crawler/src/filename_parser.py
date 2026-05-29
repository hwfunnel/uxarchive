from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass
class ParsedScreen:
    screen_id: str
    company_code: str
    type_code: str
    subtype_code: str
    screen_type_code: str
    order_no: int = 1


def parse_stem(stem: str) -> ParsedScreen | None:
    """
    파일명 stem을 파싱해 코드를 추출한다.

    규칙:
        parts = stem.split("_")
        company_code    = parts[0]
        type_code       = parts[1]
        subtype_code    = parts[2]
        screen_type_code = "_".join(parts[3:])

    예: SSL_CMN_PRD_TAB_TAB
        → company=SSL  type=CMN  subtype=PRD  screen_type=TAB_TAB

    4토큰 미만이면 None 반환.
    """
    parts = stem.split("_")
    if len(parts) < 4:
        return None
    return ParsedScreen(
        screen_id=stem,
        company_code=parts[0],
        type_code=parts[1],
        subtype_code=parts[2],
        screen_type_code="_".join(parts[3:]),
    )


def parse_png_dir(png_dir: Path) -> tuple[list[ParsedScreen], list[Path]]:
    """디렉토리에서 PNG를 읽어 파싱. (parsed, skipped) 반환."""
    parsed: list[ParsedScreen] = []
    skipped: list[Path] = []
    for png in sorted(png_dir.glob("*.png")):
        result = parse_stem(png.stem)
        if result:
            parsed.append(result)
        else:
            skipped.append(png)
    return parsed, skipped
