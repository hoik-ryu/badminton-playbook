"""튜토리얼 스테이지 레지스트리(D4) — 서버가 아는 것은 스테이지 id·난이도·상황 수와 통과 기준뿐."""

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

REGISTRY_PATH = Path(__file__).with_name("stage_registry.json")


@dataclass(frozen=True)
class StageInfo:
    id: str
    level: str
    situations: int


@dataclass(frozen=True)
class Registry:
    stages: dict[str, StageInfo]
    pass_numerator: int
    pass_denominator: int

    def passed(self, score: int, total: int) -> bool:
        """상황 수의 70% 이상(C-22). 서버가 다시 계산 — 클라이언트의 통과 여부는 쓰지 않음."""
        return score * self.pass_denominator >= total * self.pass_numerator

    def level_stage_ids(self, level: str) -> list[str]:
        return [s.id for s in self.stages.values() if s.level == level]


@lru_cache
def get_registry() -> Registry:
    raw = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    stages = {s["id"]: StageInfo(s["id"], s["level"], int(s["situations"])) for s in raw["stages"]}
    return Registry(stages, int(raw["passNumerator"]), int(raw["passDenominator"]))
