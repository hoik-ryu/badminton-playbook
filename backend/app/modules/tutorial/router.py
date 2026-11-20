"""튜토리얼 콘텐츠 조회와 진행 기록(SCR-101·102·103, FR-025·026, C-23, AC-094, NFR-006).

승인된 본인 것만(경로에 사용자 id 없음).

콘텐츠 조회(사용자 결정 2026-11-19 D-T1, 서버 JSON — content.py):
- GET /courses: 과정 5개(순서·분할·출시 여부)와 출시 과정의 스테이지 목록.
  진행 기록은 GET /progress 그대로
- GET /stages/{id}: 한 스테이지의 공개 콘텐츠. 판정 데이터(정답·허용 칸·해설 등)는 넣지 않음
- 레지스트리에 없거나(개편 전 id 포함) 미출시 과정의 스테이지는
  404 stage_not_found('준비 중인 스테이지')

서버 판정 회차(3단계, D-T4 (b) — 사용자 결정 2026-11-20, 표 tutorial_runs):
- POST /stages/{id}/runs: 회차 시작(서버 UUID, 2시간). 같은 스테이지의 끝나지 않은 회차는 대체,
  만료 + 1일 지난 회차는 지움(정리 정책)
- POST /runs/{runId}/judge {situation, cell}: 서버가 정답·허용·오답을 판정. 상황마다 **첫 판정만**
  기록(상황 순서대로), 이미 판정한 상황(재도전·재전송)은 기록을 바꾸지 않음 → 재도전 정답 0점,
  같은 요청은 같은 응답. 판정 뒤에만 정답 데이터 공개
- PUT /stages/{id} {runId}: 5개 상황이 모두 판정된 회차의 점수(첫 판정 정답 수)·통과(70%)를
  서버가 계산해 저장. 이미 완료한 회차를 다시 보내면 다시 저장하지 않고 같은 결과(멱등).
  클라이언트가 보내는 점수({score, total})는 받지 않음(422)
- GET /runs/{runId}: 완료된 본인 회차의 결과와 틀린 상황 다시 보기 데이터(SCR-103 복구, 6단계).
  끝나지 않은 회차는 409 run_incomplete, 없거나 남의 회차는 404.
  읽기만 하므로 다시 불러도 점수가 두 번 반영되지 않음
- 회차 행은 SELECT … FOR UPDATE로 잠그고 판정·완료 → 동시 요청에도 첫 판정·저장은 한 번만
- 고른 칸 번호·시도 기록은 저장하지 않음. 첫 판정(c/a/w/-)만 회차 유효기간 동안 임시 보관
  (NFR-006 해석)

진행 기록 저장은 한 문장의 원자적 upsert: passed = 기존 OR 이번, best = GREATEST,
first_passed_at = 기존 값이 없고 이번에 통과했을 때만 지금.
같은 결과를 여러 번(재시도·시간 초과 재전송·두 기기 동시) 보내도 결과가 같고,
시도마다 행이 늘지 않습니다(C-23).
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import case, delete, func, select
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.auth.deps import ApprovedUser, DbSession, now_utc, verify_origin
from app.modules.tutorial.content import (
    Situation,
    StageContent,
    cell_center,
    content_hash,
    get_content,
)
from app.modules.tutorial.models import TutorialProgress, TutorialRun
from app.modules.tutorial.registry import CourseInfo, Registry, StageInfo, get_registry
from app.modules.tutorial.schemas import (
    CompleteBody,
    CoursePassCount,
    CourseRead,
    CoursesRead,
    CourseStageRead,
    GridRead,
    JudgeBody,
    JudgeRead,
    MoveRead,
    PassRule,
    ReviewSituationRead,
    RunResultRead,
    RunReviewRead,
    RunStartRead,
    ShuttleRead,
    SituationRead,
    StageRead,
    StageSaveRead,
    StartRead,
    Verdict,
    WrongRead,
)

router = APIRouter(
    prefix="/api/me/tutorial", tags=["tutorial"], dependencies=[Depends(verify_origin)]
)


class StageProgressRead(BaseModel):
    passed: bool
    best: int
    firstPassedAt: datetime | None  # noqa: N815


RUN_TTL = timedelta(hours=2)  # 한 스테이지 약 2–4분(C-27 예상 시간)
RUN_RETENTION = timedelta(days=1)  # 만료 뒤 이만큼 지나면 회차 시작 때 지움(무기한 누적 방지)
_CODE: dict[str, Verdict] = {"c": "correct", "a": "allow", "w": "wrong"}
_CHAR: dict[Verdict, str] = {v: k for k, v in _CODE.items()}


def _read(row: TutorialProgress) -> StageProgressRead:
    return StageProgressRead(passed=row.passed, best=row.best, firstPassedAt=row.first_passed_at)


def _grid(c: CourseInfo) -> GridRead:
    return GridRead(id=c.grid, cols=c.cols, rows=c.rows)


def _pass_rule(r: Registry) -> PassRule:
    return PassRule(numerator=r.pass_numerator, denominator=r.pass_denominator)


def _released_stage_or_404(stage_id: str) -> StageInfo:
    stage = get_registry().released_stage(stage_id)
    if stage is None:
        raise AppError("stage_not_found", "준비 중인 스테이지입니다", 404)
    return stage


@router.get("/courses")
def courses(_: ApprovedUser) -> CoursesRead:
    """SCR-101 목록(AC-093·120): 과정 순서대로, 출시 과정만 스테이지 목록(미출시는 '준비 중')."""
    registry = get_registry()
    content = get_content()
    out = []
    for c in registry.courses:
        stages: list[CourseStageRead] = []
        if c.released:
            for sid in registry.course_stage_ids(c.id):
                st: StageContent = content[sid]
                stages.append(
                    CourseStageRead(
                        id=sid,
                        no=st.no,
                        version=st.version,
                        title=st.title,
                        minutes=st.minutes,
                        thumbnail=st.thumbnail,
                        situations=len(st.situations),
                    )
                )
        out.append(
            CourseRead(
                id=c.id,
                name=c.name,
                order=c.order,
                grid=_grid(c),
                released=c.released,
                guided=c.guided,
                description=c.description,
                icon=c.icon,
                stages=stages,
            )
        )
    return CoursesRead(courses=out, passRule=_pass_rule(registry))


@router.get("/stages/{stage_id}")
def stage(stage_id: str, _: ApprovedUser) -> StageRead:
    """SCR-102 한 스테이지의 공개 콘텐츠. 판정 데이터는 서버에만 둠(D-T2)."""
    info = _released_stage_or_404(stage_id)
    registry = get_registry()
    course = registry.course(info.course)
    st = get_content()[stage_id]
    return StageRead(
        id=st.id,
        course=course.id,
        courseName=course.name,
        no=st.no,
        version=st.version,
        title=st.title,
        minutes=st.minutes,
        thumbnail=st.thumbnail,
        guided=course.guided,
        grid=_grid(course),
        passRule=_pass_rule(registry),
        situations=[
            SituationRead(
                no=s.no,
                description=s.description,
                question=s.question,
                start=StartRead(
                    me=s.start.me, partner=s.start.partner, opponents=s.start.opponents
                ),
                shuttle=(
                    ShuttleRead(from_=s.shuttle.from_, stop=s.shuttle.stop)
                    if s.shuttle is not None
                    else None
                ),
            )
            for s in st.situations
        ],
    )


@router.get("/progress")
def my_progress(user: ApprovedUser, db: DbSession) -> dict[str, StageProgressRead]:
    rows = db.scalars(select(TutorialProgress).where(TutorialProgress.user_id == user.id)).all()
    known = get_registry().stages
    return {r.stage_id: _read(r) for r in rows if r.stage_id in known}


def _merge_set(excluded: Any, greatest: Any) -> dict[str, Any]:
    """병합 규칙(SQL 안에서 계산 — 동시 요청에도 기록이 나빠지지 않음)."""
    return {
        "passed": TutorialProgress.passed | excluded.passed,
        "best": greatest,
        "first_passed_at": func.coalesce(
            TutorialProgress.first_passed_at,
            case((excluded.passed, excluded.first_passed_at), else_=None),
        ),
        "updated_at": func.now(),
    }


def _upsert(db: Session, values: dict[str, object]) -> None:
    """방언별 INSERT … ON CONFLICT DO UPDATE(PostgreSQL 실서비스, SQLite 단위 테스트)."""
    dialect = db.get_bind().dialect.name
    keys = ["user_id", "stage_id"]
    if dialect == "postgresql":
        pg = postgresql.insert(TutorialProgress).values(**values)
        best = func.greatest(TutorialProgress.best, pg.excluded.best)
        db.execute(
            pg.on_conflict_do_update(index_elements=keys, set_=_merge_set(pg.excluded, best))
        )
    elif dialect == "sqlite":
        lite = sqlite.insert(TutorialProgress).values(**values)
        best = func.max(TutorialProgress.best, lite.excluded.best)
        db.execute(
            lite.on_conflict_do_update(index_elements=keys, set_=_merge_set(lite.excluded, best))
        )
    else:  # pragma: no cover
        raise RuntimeError(f"unsupported dialect {dialect}")


def _aware(dt: datetime) -> datetime:
    """SQLite는 시간대 없는 값을 돌려줌(UTC로 저장) → 비교 전에 UTC로 맞춤."""
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _stage_content(stage_id: str) -> StageContent:
    _released_stage_or_404(stage_id)
    return get_content()[stage_id]


def _verdict_of(s: Situation, cell: int) -> Verdict:
    if cell == s.answer:
        return "correct"
    return "allow" if cell in s.allow else "wrong"


def _move(s: Situation, course: CourseInfo, cell: int) -> MoveRead:
    me = s.targets.get(str(cell)) or cell_center(cell, course.cols, course.rows)
    partner_cell = s.partnerByCell.get(str(cell), s.partnerCell)
    return MoveRead(
        cell=cell,
        me=me,
        partnerCell=partner_cell,
        partner=cell_center(partner_cell, course.cols, course.rows),
    )


def _reason(s: Situation, verdict: Verdict, cell: int) -> str:
    e = s.explanation
    if verdict == "correct":
        return e.correct
    if verdict == "allow":
        return e.better or e.correct
    return e.wrongByCell.get(str(cell), e.wrong)


def _locked_run(db: Session, run_id: uuid.UUID, user_id: uuid.UUID) -> TutorialRun:
    """회차 행을 잠그고 가져옴(PostgreSQL FOR UPDATE). 없거나 남의 회차면 404(존재 여부 숨김)."""
    run = db.scalars(
        select(TutorialRun).where(TutorialRun.id == run_id).with_for_update()
    ).one_or_none()
    if run is None or run.user_id != user_id:
        raise AppError(
            "run_not_found", "진행 중인 회차를 찾을 수 없습니다. 처음부터 다시 해 주세요", 404
        )
    return run


def _check_content(run: TutorialRun) -> StageContent:
    st = _stage_content(run.stage_id)
    if content_hash(st) != run.content_hash:
        raise AppError(
            "content_changed", "스테이지 내용이 바뀌었습니다. 처음부터 다시 해 주세요", 409
        )
    return st


def _run_result(run: TutorialRun) -> RunResultRead:
    verdicts = [_CODE[ch] for ch in run.first_verdicts]
    score = verdicts.count("correct")
    return RunResultRead(
        score=score,
        total=len(verdicts),
        passed=get_registry().passed(score, len(verdicts)),
        wrong=[
            WrongRead(no=i, kind="allow" if v == "allow" else "wrong")
            for i, v in enumerate(verdicts, 1)
            if v != "correct"
        ],
    )


@router.post("/stages/{stage_id}/runs")
def start_run(stage_id: str, user: ApprovedUser, db: DbSession) -> RunStartRead:
    """회차 시작. 같은 스테이지의 끝나지 않은 내 회차는 새 회차로 대체(다시 하기·재시작)."""
    st = _stage_content(stage_id)
    now = now_utc()
    # 정리 정책: 만료 + 1일이 지난 회차는 누구 것이든 지움(완료 회차 포함)
    db.execute(delete(TutorialRun).where(TutorialRun.expires_at < now - RUN_RETENTION))
    db.execute(
        delete(TutorialRun).where(
            TutorialRun.user_id == user.id,
            TutorialRun.stage_id == stage_id,
            TutorialRun.completed_at.is_(None),
        )
    )
    run = TutorialRun(
        id=uuid.uuid4(),
        user_id=user.id,
        stage_id=stage_id,
        content_hash=content_hash(st),
        first_verdicts="-" * len(st.situations),
        expires_at=now + RUN_TTL,
    )
    db.add(run)
    db.commit()
    return RunStartRead(
        runId=run.id, stageId=stage_id, situations=len(st.situations), expiresAt=run.expires_at
    )


@router.post("/runs/{run_id}/judge")
def judge(run_id: uuid.UUID, body: JudgeBody, user: ApprovedUser, db: DbSession) -> JudgeRead:
    run = _locked_run(db, run_id, user.id)
    if run.completed_at is not None:
        raise AppError("run_completed", "이미 결과를 저장한 회차입니다", 409)
    if _aware(run.expires_at) <= now_utc():
        raise AppError("run_expired", "회차 시간이 지났습니다. 처음부터 다시 해 주세요", 410)
    st = _check_content(run)
    course = get_registry().course(st.course)
    n = len(st.situations)
    if not 1 <= body.situation <= n:
        raise AppError("invalid_situation", "상황 번호가 올바르지 않습니다", 422)
    if not 1 <= body.cell <= course.cells:
        raise AppError("invalid_cell", "칸 번호가 올바르지 않습니다", 422)
    idx = body.situation - 1
    s = st.situations[idx]
    verdict = _verdict_of(s, body.cell)
    verdicts = list(run.first_verdicts)
    if verdicts[idx] == "-":
        # 첫 판정은 상황 순서대로만(앞 상황을 건너뛸 수 없음)
        if "-" in verdicts[:idx]:
            raise AppError(
                "out_of_order",
                "앞 상황부터 차례로 진행해 주세요",
                409,
                {"next": verdicts.index("-") + 1},
            )
        verdicts[idx] = _CHAR[verdict]
        run.first_verdicts = "".join(verdicts)
    # 이미 첫 판정이 있으면(재도전·재전송) 기록은 그대로 — 점수는 첫 판정으로만 정해짐
    db.commit()
    first = _CODE[verdicts[idx]]
    return JudgeRead(
        situation=body.situation,
        verdict=verdict,
        firstVerdict=first,
        points=1 if first == "correct" else 0,
        answer=s.answer,
        allow=s.allow,
        landing=s.shuttle.landing if s.shuttle else None,
        landingCell=s.shuttle.landingCell if s.shuttle else None,
        move=_move(s, course, body.cell),
        correctMove=_move(s, course, s.answer),
        reason=_reason(s, verdict, body.cell),
        correctReason=s.explanation.correct,
        judged=sum(1 for v in verdicts if v != "-"),
    )


@router.get("/runs/{run_id}")
def run_review(run_id: uuid.UUID, user: ApprovedUser, db: DbSession) -> RunReviewRead:
    """완료된 본인 회차만. 틀린 상황의 정답 칸·동선·해설은 판정 때 이미 공개한 것과 같음(D-T2)."""
    run = db.scalars(select(TutorialRun).where(TutorialRun.id == run_id)).one_or_none()
    if run is None or run.user_id != user.id:
        raise AppError(
            "run_not_found", "진행 중인 회차를 찾을 수 없습니다. 처음부터 다시 해 주세요", 404
        )
    if run.completed_at is None:
        raise AppError("run_incomplete", "아직 결과를 저장하지 않은 회차입니다", 409)
    st = _check_content(run)
    course = get_registry().course(st.course)
    review = []
    for s, ch in zip(st.situations, run.first_verdicts, strict=True):
        if ch == "c":
            continue
        review.append(
            ReviewSituationRead(
                no=s.no,
                kind="allow" if ch == "a" else "wrong",
                description=s.description,
                start=StartRead(
                    me=s.start.me, partner=s.start.partner, opponents=s.start.opponents
                ),
                shuttle=(
                    ShuttleRead(from_=s.shuttle.from_, stop=s.shuttle.stop) if s.shuttle else None
                ),
                answer=s.answer,
                allow=s.allow,
                landing=s.shuttle.landing if s.shuttle else None,
                landingCell=s.shuttle.landingCell if s.shuttle else None,
                correctMove=_move(s, course, s.answer),
                correctReason=s.explanation.correct,
            )
        )
    return RunReviewRead(runId=run.id, stageId=run.stage_id, run=_run_result(run), review=review)


@router.put("/stages/{stage_id}")
def save_stage_result(
    stage_id: str, body: CompleteBody, user: ApprovedUser, db: DbSession
) -> StageSaveRead:
    """회차 완료 → 서버가 계산한 점수로 진행 기록 저장(멱등)."""
    _released_stage_or_404(stage_id)
    run = _locked_run(db, body.runId, user.id)
    if run.stage_id != stage_id:
        raise AppError(
            "run_not_found", "진행 중인 회차를 찾을 수 없습니다. 처음부터 다시 해 주세요", 404
        )
    if run.completed_at is None:
        if _aware(run.expires_at) <= now_utc():
            raise AppError("run_expired", "회차 시간이 지났습니다. 처음부터 다시 해 주세요", 410)
        _check_content(run)
        if "-" in run.first_verdicts:
            raise AppError(
                "run_incomplete",
                "아직 판정하지 않은 상황이 있습니다",
                409,
                {"next": run.first_verdicts.index("-") + 1},
            )
        result = _run_result(run)
        _upsert(
            db,
            {
                "user_id": user.id,
                "stage_id": stage_id,
                "passed": result.passed,
                "best": result.score,
                "first_passed_at": now_utc() if result.passed else None,
            },
        )
        run.completed_at = now_utc()
        db.commit()
    # 이미 완료한 회차(재전송·중복 요청): 다시 저장하지 않고 같은 회차 결과
    result = _run_result(run)
    db.commit()
    row = db.get(TutorialProgress, (user.id, stage_id), populate_existing=True)
    assert row is not None
    return StageSaveRead(
        passed=row.passed, best=row.best, firstPassedAt=row.first_passed_at, run=result
    )


def passed_counts(db: Session, user_id: object) -> list[CoursePassCount]:
    """운영진 명단 현황(SCR-212, C-23·28): 출시된 과정별 통과 스테이지 수 / 스테이지 수.

    레지스트리의 현재 스테이지만 셉니다 — 개편 전 스테이지 기록은 들어가지 않습니다(AC-118).
    """
    registry = get_registry()
    passed_ids = set(
        db.scalars(
            select(TutorialProgress.stage_id).where(
                TutorialProgress.user_id == user_id, TutorialProgress.passed.is_(True)
            )
        ).all()
    )
    out = []
    for course in registry.released_courses():
        ids = registry.course_stage_ids(course.id)
        out.append(
            CoursePassCount(
                course=course.id,
                name=course.name,
                passed=sum(1 for sid in ids if sid in passed_ids),
                total=len(ids),
            )
        )
    return out
