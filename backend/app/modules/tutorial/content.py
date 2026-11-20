"""튜토리얼 콘텐츠(서버 JSON, 사용자 결정 2026-11-19 D-T1).

근거: docs/workflow-proposals/tutorial-mvp-implementation-plan.md

스테이지마다 `content/<stage_id>.json` 한 파일. 형식은 PRD 7.3 ① 상황 데이터 항목을 따릅니다.
- 좌표는 기존 코트 좌표계(가로 0–61, 세로 0–134, 네트 y=67, 내 편 y 67–134, ASM-035)
- 칸 번호는 과정 분할(레지스트리 grid)의 1..열×행, 왼쪽→오른쪽·위→아래(C-27)
- 판정용 데이터(정답·허용 칸, 떨어지는 지점, 파트너 목표, 칸별 이동 목표점, 해설)는 서버 전용입니다.
  공개 조회 API는 schemas.py의 공개 모양만 내보냅니다(router.py).

`validate_content`가 AC-117 검사를 모두 합니다. 어긋나면 첫 사용 때 바로 실패합니다.
전술 정확성은 이 검사가 아니라 제품 소유자의 검수 체크리스트로 확인합니다
(content/REVIEW_CHECKLIST.md, PRD 7.3 ③).
"""

import hashlib
import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.modules.tutorial.registry import Registry, get_registry

CONTENT_DIR = Path(__file__).with_name("content")

COURT_W, COURT_L, NET_Y = 61.0, 134.0, 67.0  # 기존 코트 좌표계(ASM-035)

Pt = Annotated[list[float], Field(min_length=2, max_length=2)]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Start(_Strict):
    me: Pt
    partner: Pt
    opponents: Annotated[list[Pt], Field(min_length=2, max_length=2)]


class Shuttle(_Strict):
    from_: Pt = Field(alias="from")
    stop: Pt
    landing: Pt
    landingCell: int  # noqa: N815 — 도착 방향 칸(PRD 7.3 ①)


class Explanation(_Strict):
    correct: str  # 정답 이유
    better: str | None = None  # 허용 칸을 골랐을 때 '더 좋은 위치' 설명
    wrong: str  # 오답 기본 이유
    wrongByCell: dict[str, str] = {}  # noqa: N815 — 칸별 오답 이유(선택)


class Situation(_Strict):
    no: int
    description: str  # 한 줄, 코트 그림의 대체 글자
    question: str
    start: Start
    shuttle: Shuttle | None  # 입문자 안내형은 없음(ASM-037)
    answer: int  # 정답 칸(정확히 1개)
    allow: list[int]  # 허용 칸(0개 이상)
    partnerCell: int  # noqa: N815 — 정답일 때 파트너가 가는 칸
    partnerByCell: dict[str, int] = {}  # noqa: N815 — 고른 칸별 파트너 칸(선택)
    targets: dict[str, Pt] = {}  # 칸별 이동 목표점(없으면 칸 중심, ASM-036)
    explanation: Explanation


class StageContent(_Strict):
    id: str
    course: str
    no: int
    version: int
    title: str  # 학습 목표(C-27)
    minutes: int  # 예상 학습 시간(분)
    thumbnail: str | None = None  # 목록 썸네일 자산 ID(AST-…, DD r6 VD-046)
    situations: list[Situation]


def cell_of(x: float, y: float, cols: int, rows: int = 3) -> int | None:
    """내 편 반 코트 좌표 → 칸 번호(경계는 낮은 번호 쪽). 내 편 밖이면 None."""
    if not (0 <= x <= COURT_W and NET_Y <= y <= COURT_L):
        return None
    c = min(int(x / (COURT_W / cols)), cols - 1)
    r = min(int((y - NET_Y) / ((COURT_L - NET_Y) / rows)), rows - 1)
    return r * cols + c + 1


def cell_center(cell: int, cols: int, rows: int = 3) -> list[float]:
    """칸 번호 → 칸 중심 좌표(이동 목표점 기본값, ASM-036)."""
    r, c = divmod(cell - 1, cols)
    w, h = COURT_W / cols, (COURT_L - NET_Y) / rows
    return [round(w * c + w / 2, 2), round(NET_Y + h * r + h / 2, 2)]


def content_hash(stage: StageContent) -> str:
    """콘텐츠 지문(회차 중 콘텐츠가 바뀌었는지 감지). 같은 내용이면 같은 값."""
    canonical = json.dumps(stage.model_dump(mode="json", by_alias=True), sort_keys=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]


def _in_court(p: list[float]) -> bool:
    return 0 <= p[0] <= COURT_W and 0 <= p[1] <= COURT_L


def _my_half(p: list[float]) -> bool:
    return 0 <= p[0] <= COURT_W and NET_Y <= p[1] <= COURT_L


def validate_content(registry: Registry, stages: dict[str, StageContent]) -> list[str]:
    """AC-117 + 좌표·번호 정합성. 문제 목록(비어 있으면 통과)."""
    errors: list[str] = []
    if set(stages) != set(registry.stages):
        missing = sorted(set(registry.stages) - set(stages))
        extra = sorted(set(stages) - set(registry.stages))
        errors.append(f"content files must match registry: missing={missing} extra={extra}")
    for sid, st in sorted(stages.items()):
        e = errors.append
        reg = registry.stages.get(sid)
        if reg is None:
            continue
        course = registry.course(reg.course)
        n_cells = course.cells
        if (st.id, st.course, st.no, st.version) != (reg.id, reg.course, reg.no, reg.version):
            e(f"{sid}: id/course/no/version must match registry ({reg})")
        if len(st.situations) != reg.situations:
            e(f"{sid}: {len(st.situations)} situations, registry says {reg.situations}")
        if [s.no for s in st.situations] != list(range(1, len(st.situations) + 1)):
            e(f"{sid}: situation numbers must be 1..n in order")
        if st.minutes <= 0:
            e(f"{sid}: minutes (예상 학습 시간) required")
        if not st.title.strip():
            e(f"{sid}: title required")
        for s in st.situations:
            at = f"{sid}#{s.no}"
            cells = range(1, n_cells + 1)
            if not s.description.strip() or not s.question.strip():
                e(f"{at}: description and question required")
            if s.answer not in cells:
                e(f"{at}: answer {s.answer} out of 1..{n_cells}")
            if any(a not in cells for a in s.allow):
                e(f"{at}: allow {s.allow} out of 1..{n_cells}")
            if len(set(s.allow)) != len(s.allow):
                e(f"{at}: duplicate allow cells")
            if s.answer in s.allow:
                e(f"{at}: allow overlaps answer")
            if course.guided and s.allow:
                e(f"{at}: guided course must have no allow cells (ASM-037)")
            if course.guided and s.shuttle is not None:
                e(f"{at}: guided course has no shuttle (ASM-037)")
            if not course.guided and s.shuttle is None:
                e(f"{at}: shuttle required")
            if not s.explanation.correct.strip() or not s.explanation.wrong.strip():
                e(f"{at}: correct and wrong explanations required")
            if s.allow and not (s.explanation.better or "").strip():
                e(f"{at}: 'better' explanation required when allow cells exist")
            if any(not k.isdigit() or int(k) not in cells for k in s.explanation.wrongByCell):
                e(f"{at}: wrongByCell keys out of range")
            # 좌표·배치
            if not (_my_half(s.start.me) and _my_half(s.start.partner)):
                e(f"{at}: me/partner must start on my half (y 67–134)")
            if not all(_in_court(o) and o[1] <= NET_Y for o in s.start.opponents):
                e(f"{at}: opponents must start on the far half (y 0–67)")
            if s.partnerCell not in cells:
                e(f"{at}: partnerCell out of range")
            for k, v in s.partnerByCell.items():
                if not k.isdigit() or int(k) not in cells or v not in cells:
                    e(f"{at}: partnerByCell {k}->{v} out of range")
            for k, p in s.targets.items():
                if not k.isdigit() or int(k) not in cells:
                    e(f"{at}: targets key {k} out of range")
                elif cell_of(p[0], p[1], course.cols, course.rows) != int(k):
                    e(f"{at}: target for cell {k} must lie inside that cell")
            if s.shuttle is not None:
                sh = s.shuttle
                if not (_in_court(sh.from_) and _in_court(sh.stop)):
                    e(f"{at}: shuttle from/stop out of court")
                if not _my_half(sh.landing):
                    e(f"{at}: shuttle landing must be on my half")
                elif cell_of(sh.landing[0], sh.landing[1], course.cols) != sh.landingCell:
                    e(f"{at}: landingCell {sh.landingCell} does not match landing point")
    return errors


def load_stage_files(content_dir: Path) -> dict[str, StageContent]:
    out: dict[str, StageContent] = {}
    for f in sorted(content_dir.glob("*.json")):
        st = StageContent.model_validate(json.loads(f.read_text(encoding="utf-8")))
        if f.stem != st.id:
            raise ValueError(f"{f.name}: file name must be <stage id>.json")
        if st.id in out:
            raise ValueError(f"duplicate stage id {st.id}")
        out[st.id] = st
    return out


@lru_cache
def get_content() -> dict[str, StageContent]:
    """서버 콘텐츠(검사 통과한 것만). 형식·정합성 오류면 ValueError(잘못된 콘텐츠로 판정 안 함)."""
    stages = load_stage_files(CONTENT_DIR)
    errors = validate_content(get_registry(), stages)
    if errors:
        raise ValueError("tutorial content invalid:\n" + "\n".join(errors))
    return stages
