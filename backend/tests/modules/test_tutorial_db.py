"""튜토리얼 진행(I2)·서버 판정 회차(3단계) — 실제 PostgreSQL 연동.

동시 판정에도 첫 판정은 하나, 동시 완료에도 저장은 한 번(회차 행 잠금 SELECT … FOR UPDATE),
최고 점수·통과·최초 통과 시각은 손상되지 않음. 회차 표 제약·CASCADE.

`make migrate` 후 `make test-db`(또는 DATABASE_URL 지정 `pytest -m db`).
(3단계) 0010 마이그레이션(tutorial_runs)이 적용된 DB가 필요합니다 — 적용은 사용자 승인 뒤.
테스트가 만든 행만 지웁니다.
"""

import uuid
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_sessionmaker
from app.main import create_app
from app.modules.auth.kakao import get_kakao_client
from app.modules.tutorial.models import TutorialProgress, TutorialRun
from app.modules.user.models import User, UserIdentity
from tests.modules.authkit import ORIGIN, FakeKakao, auth_settings, kakao_login, new_kakao_id
from tests.modules.tutorialkit import cell_for, complete, judge, play_run, start

pytestmark = pytest.mark.db
TAG = f"tdb-{uuid.uuid4().hex[:6]}"
ST = "starter-2-v1"


@pytest.fixture
def pg() -> Iterator[Session]:
    with get_sessionmaker()() as session:
        yield session
        session.rollback()
        session.execute(delete(User).where(User.name.startswith(TAG)))  # 진행 기록은 CASCADE
        session.commit()


@pytest.fixture
def member(pg: Session) -> Iterator[tuple[TestClient, uuid.UUID]]:
    app = create_app()
    settings = get_settings()
    app.dependency_overrides[get_settings] = lambda: auth_settings(settings.database_url)
    app.dependency_overrides[get_kakao_client] = lambda: FakeKakao()
    kid = new_kakao_id()
    user = User(name=f"{TAG}회원", gender="여", grade="초심", status="approved")
    user.identities.append(UserIdentity(provider="kakao", provider_user_id=kid))
    pg.add(user)
    pg.commit()
    with TestClient(app, base_url=ORIGIN, follow_redirects=False, headers={"Origin": ORIGIN}) as c:
        kakao_login(c, kid)
        yield c, user.id


def test_db_concurrent_judge_records_one_first_verdict(
    member: tuple[TestClient, uuid.UUID], pg: Session
) -> None:
    """같은 상황을 동시에(정답·오답 섞어) 판정해도 첫 판정은 하나만 기록(행 잠금)."""
    client, _ = member
    run_id = start(client, ST)
    cells = [cell_for(ST, 1, "c"), cell_for(ST, 1, "w")] * 8

    def post(cell: int) -> tuple[int, str]:
        res = judge(client, run_id, 1, cell)
        return res.status_code, res.json().get("firstVerdict", "")

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(post, cells))
    assert {code for code, _ in results} == {200}
    firsts = {fv for _, fv in results}
    assert len(firsts) == 1  # 모든 응답이 같은 첫 판정을 봄
    pg.expire_all()
    run = pg.get_one(TutorialRun, uuid.UUID(run_id))
    assert run.first_verdicts[0] == {"correct": "c", "wrong": "w"}[firsts.pop()]
    assert run.first_verdicts[1:] == "----"


def test_db_concurrent_complete_saves_once(
    member: tuple[TestClient, uuid.UUID], pg: Session
) -> None:
    """같은 회차 완료 요청이 동시에 와도 저장은 한 번, 응답은 모두 같음(멱등)."""
    client, user_id = member
    run_id = start(client, ST)
    for i, kind in enumerate(["c", "c", "c", "c", "w"], 1):
        assert judge(client, run_id, i, cell_for(ST, i, kind)).status_code == 200

    def put(_: int) -> tuple[int, str]:
        res = complete(client, ST, run_id)
        return res.status_code, res.text

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(put, range(12)))
    assert {code for code, _ in results} == {200}
    assert len({body for _, body in results}) == 1
    rows = pg.scalars(select(TutorialProgress).where(TutorialProgress.user_id == user_id)).all()
    assert len(rows) == 1
    assert (rows[0].stage_id, rows[0].passed, rows[0].best) == (ST, True, 4)
    first = rows[0].first_passed_at
    assert first is not None
    # 낮은 점수 회차가 뒤에 와도 최고 점수·최초 통과 시각은 그대로(GREATEST·COALESCE)
    _, low = play_run(client, ST, ["c", "w", "w", "w", "w"])
    assert (low["best"], low["passed"], low["run"]["score"]) == (4, True, 1)
    pg.expire_all()
    again = pg.scalars(select(TutorialProgress).where(TutorialProgress.user_id == user_id)).one()
    assert (again.best, again.first_passed_at) == (4, first)


def test_db_constraints_and_cascade(pg: Session) -> None:
    user = User(name=f"{TAG}제약", gender="남", grade="C조", status="approved")
    pg.add(user)
    pg.commit()
    pg.add(TutorialProgress(user_id=user.id, stage_id="beginner-1", passed=False, best=-1))
    with pytest.raises(IntegrityError):  # CHECK best >= 0
        pg.commit()
    pg.rollback()
    pg.add(TutorialProgress(user_id=user.id, stage_id="beginner-1", passed=True, best=5))
    pg.commit()
    pg.execute(delete(User).where(User.id == user.id))
    pg.commit()
    left = pg.scalar(
        select(func.count())
        .select_from(TutorialProgress)
        .where(TutorialProgress.user_id == user.id)
    )
    assert left == 0  # 회원 삭제 시 진행 기록도 삭제(CASCADE)


def test_db_run_constraints_and_cascade(pg: Session) -> None:
    """회차 표: 첫 판정 문자열 길이 제약, 회원 삭제 시 회차도 삭제(CASCADE)."""
    user = User(name=f"{TAG}회차", gender="남", grade="C조", status="approved")
    pg.add(user)
    pg.commit()
    expires = datetime.now(UTC) + timedelta(hours=2)
    row = dict(user_id=user.id, stage_id=ST, content_hash="0" * 16, expires_at=expires)
    pg.add(TutorialRun(**row, first_verdicts=""))
    with pytest.raises(IntegrityError):  # CHECK length BETWEEN 1 AND 16
        pg.commit()
    pg.rollback()
    pg.add(TutorialRun(**row, first_verdicts="-----"))
    pg.commit()
    pg.execute(delete(User).where(User.id == user.id))
    pg.commit()
    left = pg.scalar(
        select(func.count()).select_from(TutorialRun).where(TutorialRun.user_id == user.id)
    )
    assert left == 0


def test_db_full_flow_save_restore_and_progress(
    member: tuple[TestClient, uuid.UUID], pg: Session
) -> None:
    """실제 PostgreSQL 전체 흐름: 회차 → 판정 5번 → 저장 → 재전송 → 완료 회차 조회 → 진행률.

    재전송·조회를 여러 번 해도 진행 기록은 한 번만 반영.
    저장되는 것은 통과 여부·최고 점수·최초 통과 시각뿐.
    """
    client, user_id = member
    run_id = start(client, ST)
    for i, kind in enumerate(["c", "w", "c", "a", "c"], 1):
        assert judge(client, run_id, i, cell_for(ST, i, kind)).status_code == 200
    retry = judge(client, run_id, 2, cell_for(ST, 2, "c")).json()  # 재도전 정답
    assert (retry["verdict"], retry["points"]) == ("correct", 0)
    saved = complete(client, ST, run_id).json()
    assert saved["run"] == {
        "score": 3,
        "total": 5,
        "passed": False,
        "wrong": [{"no": 2, "kind": "wrong"}, {"no": 4, "kind": "allow"}],
    }
    assert complete(client, ST, run_id).json() == saved  # 재전송: 같은 결과
    review = client.get(f"/api/me/tutorial/runs/{run_id}").json()
    assert review["run"] == saved["run"] and [r["no"] for r in review["review"]] == [2, 4]
    assert client.get(f"/api/me/tutorial/runs/{run_id}").json() == review
    rows = pg.scalars(select(TutorialProgress).where(TutorialProgress.user_id == user_id)).all()
    assert [(r.stage_id, r.passed, r.best, r.first_passed_at) for r in rows] == [
        (ST, False, 3, None)
    ]
    assert client.get("/api/me/tutorial/progress").json() == {
        ST: {"passed": False, "best": 3, "firstPassedAt": None}
    }
    # 더 좋은 회차 → 최고 점수 갱신·최초 통과 시각, 이후 낮은 회차로 나빠지지 않음
    _, better = play_run(client, ST, ["c", "c", "c", "c", "w"])
    assert (better["passed"], better["best"]) == (True, 4)
    _, worse = play_run(client, ST, ["w", "w", "w", "w", "w"])
    assert (worse["passed"], worse["best"], worse["firstPassedAt"]) == (
        True,
        4,
        better["firstPassedAt"],
    )
