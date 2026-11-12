"""튜토리얼 진행 기록(SCR-101·103, FR-026, C-23, AC-094, NFR-006).

승인된 본인 것만(경로에 사용자 id 없음).

저장 요청은 {score, total}만 받습니다. 서버가
- 스테이지가 레지스트리에 있는지(없으면 404 stage_not_found),
- total이 서버가 아는 상황 수와 같은지(다르면 409 content_mismatch — 프런트 콘텐츠와 어긋남),
- score가 0..total 정수인지(아니면 422 invalid_score)를 확인하고,
- 통과 여부를 70% 기준으로 다시 계산합니다(클라이언트의 passed·best는 받지 않음).

저장은 한 문장의 원자적 upsert: passed = 기존 OR 이번, best = GREATEST,
first_passed_at = 기존 값이 없고 이번에 통과했을 때만 지금.
같은 결과를 여러 번(재시도·시간 초과 재전송·두 기기 동시) 보내도 결과가 같고,
시도마다 행이 늘지 않습니다(C-23).
"""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import case, func, select
from sqlalchemy.dialects import postgresql, sqlite
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.auth.deps import ApprovedUser, DbSession, now_utc, verify_origin
from app.modules.tutorial.models import TutorialProgress
from app.modules.tutorial.registry import get_registry

router = APIRouter(
    prefix="/api/me/tutorial", tags=["tutorial"], dependencies=[Depends(verify_origin)]
)


class StageProgressRead(BaseModel):
    passed: bool
    best: int
    firstPassedAt: datetime | None  # noqa: N815


class StageResultBody(BaseModel):
    # 알 수 없는 필드(passed, best 등)는 무시 — 서버가 다시 계산
    model_config = ConfigDict(extra="ignore")
    score: int
    total: int


def _read(row: TutorialProgress) -> StageProgressRead:
    return StageProgressRead(passed=row.passed, best=row.best, firstPassedAt=row.first_passed_at)


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


@router.put("/stages/{stage_id}")
def save_stage_result(
    stage_id: str, body: StageResultBody, user: ApprovedUser, db: DbSession
) -> StageProgressRead:
    registry = get_registry()
    stage = registry.stages.get(stage_id)
    if stage is None:
        raise AppError("stage_not_found", "준비 중인 스테이지입니다", 404)
    if body.total != stage.situations:
        raise AppError(
            "content_mismatch",
            "스테이지 내용이 서버와 다릅니다. 새로고침한 뒤 다시 해 주세요",
            409,
            {"expectedTotal": stage.situations},
        )
    if not 0 <= body.score <= stage.situations:
        raise AppError("invalid_score", "점수가 올바르지 않습니다", 422)
    passed = registry.passed(body.score, stage.situations)
    _upsert(
        db,
        {
            "user_id": user.id,
            "stage_id": stage_id,
            "passed": passed,
            "best": body.score,
            "first_passed_at": now_utc() if passed else None,
        },
    )
    db.commit()
    row = db.get(TutorialProgress, (user.id, stage_id), populate_existing=True)
    assert row is not None
    return _read(row)


def passed_counts(db: Session, user_id: object) -> dict[str, int]:
    """운영진 명단 현황(SCR-212, C-23): 난이도별 통과 스테이지 수."""
    registry = get_registry()
    passed_ids = set(
        db.scalars(
            select(TutorialProgress.stage_id).where(
                TutorialProgress.user_id == user_id, TutorialProgress.passed.is_(True)
            )
        ).all()
    )
    return {
        level: sum(1 for sid in registry.level_stage_ids(level) if sid in passed_ids)
        for level in ("beginner", "novice")
    }
