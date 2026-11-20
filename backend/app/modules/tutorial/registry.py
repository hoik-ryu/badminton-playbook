"""튜토리얼 스테이지 레지스트리(PRD r7 ASM-033·034, C-27·28).

과정(id·이름·순서·코트 분할·출시 여부·입문자 안내형 여부)과 현재 스테이지(id·과정·순번·상황 수),
통과 기준만 둡니다. 시나리오 본문은 `content/<stage_id>.json`(content.py)에 있습니다.
개편 전 스테이지 id는 레지스트리에 없으므로 진행률·현황에서 빠지고 저장은 404입니다(AC-118·119).
"""

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

REGISTRY_PATH = Path(__file__).with_name("stage_registry.json")
GRID_RE = re.compile(r"^grid-(\d+)x(\d+)$")  # grid-<열>x<행>(C-27: 2x3·3x3·5x3)
STAGE_ID_RE = re.compile(r"^([a-z]+)-(\d+)-v(\d+)$")  # <과정>-<순번>-v<콘텐츠 버전>(ASM-033)


@dataclass(frozen=True)
class CourseInfo:
    id: str
    name: str
    order: int
    grid: str
    released: bool
    guided: bool  # 입문자 안내형: 셔틀 연출·허용 칸 없음(ASM-037)
    cols: int  # grid에서 읽음(내 편 반 코트를 열 × 행으로 균등 분할, ASM-035)
    rows: int
    description: str | None = None  # SCR-101 과정 카드 설명(Preview r3 승인 문구)
    icon: str | None = None  # 과정 장식 자산 ID(DD r6 VD-046, AST-035–037)

    @property
    def cells(self) -> int:
        return self.cols * self.rows


@dataclass(frozen=True)
class StageInfo:
    id: str
    course: str
    no: int
    situations: int
    version: int  # 스테이지 id 끝의 v<n>(콘텐츠가 바뀌면 새 id, C-28)


@dataclass(frozen=True)
class Registry:
    courses: tuple[CourseInfo, ...]  # order 순
    stages: dict[str, StageInfo]
    pass_numerator: int
    pass_denominator: int

    def passed(self, score: int, total: int) -> bool:
        """상황 수의 70% 이상(C-22). 서버가 다시 계산 — 클라이언트의 통과 여부는 쓰지 않음."""
        return score * self.pass_denominator >= total * self.pass_numerator

    def course(self, course_id: str) -> CourseInfo:
        return next(c for c in self.courses if c.id == course_id)

    def released_stage(self, stage_id: str) -> StageInfo | None:
        """출시된 과정의 현재 스테이지만(미출시 과정·개편 전 id는 None → '준비 중인 스테이지')."""
        stage = self.stages.get(stage_id)
        return stage if stage is not None and self.course(stage.course).released else None

    def released_courses(self) -> list[CourseInfo]:
        return [c for c in self.courses if c.released]

    def course_stage_ids(self, course: str) -> list[str]:
        ordered = sorted(self.stages.values(), key=lambda s: s.no)
        return [s.id for s in ordered if s.course == course]


def load_registry(raw: dict[str, Any]) -> Registry:
    """JSON → Registry. 형식 오류(알 수 없는 과정, 중복 순번 등)는 서버 시작 시 바로 실패하게 함."""
    parsed: list[CourseInfo] = []
    for c in raw["courses"]:
        g = GRID_RE.fullmatch(c["grid"])
        if g is None:
            raise ValueError(f"course {c['id']}: bad grid {c['grid']}")
        parsed.append(
            CourseInfo(
                c["id"],
                c["name"],
                int(c["order"]),
                c["grid"],
                bool(c["released"]),
                bool(c.get("guided", False)),
                int(g.group(1)),
                int(g.group(2)),
                c.get("description"),
                c.get("icon"),
            )
        )
    courses = tuple(sorted(parsed, key=lambda c: c.order))
    course_ids = {c.id for c in courses}
    if len(course_ids) != len(courses):
        raise ValueError("duplicate course id")
    stages: dict[str, StageInfo] = {}
    for s in raw["stages"]:
        m = STAGE_ID_RE.fullmatch(s["id"])
        if m is None:
            raise ValueError(f"stage id must be <course>-<no>-v<version>: {s['id']}")
        info = StageInfo(s["id"], s["course"], int(s["no"]), int(s["situations"]), int(m.group(3)))
        if info.course not in course_ids:
            raise ValueError(f"stage {info.id}: unknown course {info.course}")
        if (m.group(1), int(m.group(2))) != (info.course, info.no):
            raise ValueError(f"stage {info.id}: id does not match course/no")
        if info.id in stages:
            raise ValueError(f"duplicate stage id {info.id}")
        if len(info.id) > 32:  # tutorial_progress.stage_id 길이(ASM-033)
            raise ValueError(f"stage id too long: {info.id}")
        stages[info.id] = info
    seen = {(s.course, s.no) for s in stages.values()}
    if len(seen) != len(stages):
        raise ValueError("duplicate stage number within a course")
    return Registry(courses, stages, int(raw["passNumerator"]), int(raw["passDenominator"]))


@lru_cache
def get_registry() -> Registry:
    return load_registry(json.loads(REGISTRY_PATH.read_text(encoding="utf-8")))
