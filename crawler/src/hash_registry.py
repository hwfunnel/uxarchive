"""
로컬 hash_registry.json 기반 content_hash 추적기.

screens 테이블에 content_hash 컬럼이 없는 현재 구조에서,
"이전 업로드된 이미지와 동일한가?"를 판단하기 위한 로컬 레지스트리.

파일 위치: crawler_output/hash_registry.json

한계:
- 로컬 파일 기반이므로 파일 유실 시 재사용 판단 불가 (전체 재업로드)
- 여러 머신에서 공유 불가
→ 향후 screens 테이블에 content_hash 컬럼 추가로 마이그레이션 권장
"""
from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REGISTRY_VERSION = 1


@dataclass
class ScreenRecord:
    content_hash: str
    imgsrc: str          # 현재 Storage path (재사용 시 이 값을 그대로 씀)
    screen_id: str
    version: str
    captured_at: str
    uploaded_at: str
    order_no: int = 1    # 과거 레지스트리 호환을 위해 기본값 1 유지


class HashRegistry:
    def __init__(self, path: Path):
        self._path = path
        self._data: dict[str, dict] = {}
        self._load()

    # ── key: "company|type|subtype|screen_type" ───────────────────────────

    @staticmethod
    def _key(company: str, type_code: str, subtype: str, screen_type: str) -> str:
        return f"{company}|{type_code}|{subtype}|{screen_type}"

    def get(
        self, company: str, type_code: str, subtype: str, screen_type: str
    ) -> ScreenRecord | None:
        raw = self._data.get(self._key(company, type_code, subtype, screen_type))
        if raw is None:
            return None
        # order_no 없는 과거 데이터 호환: 기본값 1 적용
        raw.setdefault("order_no", 1)
        return ScreenRecord(**raw)

    def known_screen_types(
        self, company: str, type_code: str, subtype: str
    ) -> list[str]:
        """해당 subtype 그룹에서 레지스트리에 기록된 모든 screen_type_code 반환."""
        prefix = f"{company}|{type_code}|{subtype}|"
        return [k[len(prefix):] for k in self._data if k.startswith(prefix)]

    def set(
        self,
        company: str,
        type_code: str,
        subtype: str,
        screen_type: str,
        record: ScreenRecord,
    ) -> None:
        self._data[self._key(company, type_code, subtype, screen_type)] = asdict(record)

    def save(self) -> None:
        payload = {
            "registry_version": REGISTRY_VERSION,
            "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "screens": self._data,
        }
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    # ── 내부 ─────────────────────────────────────────────────────────────

    def _load(self) -> None:
        if not self._path.exists():
            return
        raw = json.loads(self._path.read_text(encoding="utf-8"))
        self._data = raw.get("screens", {})
