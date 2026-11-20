"""튜토리얼 서버 판정 회차(3단계, D-T4 (b) — 사용자 결정 2026-11-20).

AC-091(정답·허용·오답), AC-092(첫 시도 정답만 1점·재도전 0점·70%), AC-112(입문자 허용 없음),
AC-113(셔틀 도착 칸과 정답 칸은 따로), AC-115(확정 뒤 한 번만 판정 — 첫 판정 고정),
AC-094(저장 멱등·최고 점수 유지), 중복·재전송·순서·만료·다른 회원·콘텐츠 변경·정리 정책, NFR-006.
"""

import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.modules.tutorial.content import cell_center, get_content
from app.modules.tutorial.models import TutorialProgress, TutorialRun
from tests.modules.authkit import kakao_login, make_user
from tests.modules.tutorialkit import cell_for, complete, judge, play_run, save, start

Factory = Callable[[], TestClient]
ST = "starter-2-v1"  # 6칸, 허용 칸 있음


def member(make_client: Factory, db: Session, kid: str) -> TestClient:
    c = make_client()
    make_user(db, name=f"회원{kid}", kakao_id=kid)
    kakao_login(c, kid)
    return c


def verdicts(db: Session, run_id: str) -> str:
    db.expire_all()
    return db.get_one(TutorialRun, uuid.UUID(run_id)).first_verdicts


# ── 점수 규칙 ──


def test_ac_092_first_try_only_and_retry_is_zero(make_client: Factory, db: Session) -> None:
    """첫 시도 정답 1점, 오답 뒤 재도전 정답 0점, 허용 0점 → 2/5 미통과, 틀린 상황 목록."""
    c = member(make_client, db, "9301")
    _, body = play_run(c, ST, ["c", "wc", "a", "c", "ac"])
    assert body["run"] == {
        "score": 2,
        "total": 5,
        "passed": False,
        "wrong": [
            {"no": 2, "kind": "wrong"},
            {"no": 3, "kind": "allow"},
            {"no": 5, "kind": "allow"},
        ],
    }
    assert (body["passed"], body["best"]) == (False, 2)


def test_ac_092_seventy_percent_pass(make_client: Factory, db: Session) -> None:
    c = member(make_client, db, "9302")
    assert save(c, ST, 3)["passed"] is False
    four = save(c, ST, 4)
    assert (four["passed"], four["best"]) == (True, 4)


def test_ac_091_retry_response_reports_verdict_and_zero_points(
    make_client: Factory, db: Session
) -> None:
    """재도전 정답: 이번 판정은 정답이지만 점수에 반영되는 첫 판정은 오답, 0점."""
    c = member(make_client, db, "9303")
    run_id = start(c, ST)
    wrong = judge(c, run_id, 1, cell_for(ST, 1, "w")).json()
    assert (wrong["verdict"], wrong["firstVerdict"], wrong["points"]) == ("wrong", "wrong", 0)
    retry = judge(c, run_id, 1, cell_for(ST, 1, "c")).json()
    assert (retry["verdict"], retry["firstVerdict"], retry["points"]) == ("correct", "wrong", 0)
    assert verdicts(db, run_id) == "w----"


def test_allow_cell_verdict_and_better_explanation(make_client: Factory, db: Session) -> None:
    """허용 칸: 랠리 계속(0점), 해설은 '더 좋은 위치', 정답 칸과 이동 정보도 함께."""
    c = member(make_client, db, "9304")
    run_id = start(c, ST)
    s = get_content()[ST].situations[0]
    res = judge(c, run_id, 1, s.allow[0]).json()
    assert (res["verdict"], res["points"], res["answer"], res["allow"]) == (
        "allow",
        0,
        s.answer,
        s.allow,
    )
    assert res["reason"] == s.explanation.better
    assert res["correctReason"] == s.explanation.correct
    assert res["correctMove"]["cell"] == s.answer
    assert res["correctMove"]["me"] == cell_center(s.answer, 2)  # 칸별 목표점이 없으면 칸 중심
    assert res["correctMove"]["partnerCell"] == s.partnerCell
    assert verdicts(db, run_id) == "a----"


def test_ac_113_landing_cell_is_separate_from_answer(make_client: Factory, db: Session) -> None:
    """셔틀 도착 칸은 판정 뒤 응답에 따로 옴(정답 칸과 같은지 여부와 무관하게 별도 필드)."""
    c = member(make_client, db, "9305")
    run_id = start(c, ST)
    res = judge(c, run_id, 1, cell_for(ST, 1, "c")).json()
    s = get_content()[ST].situations[0]
    assert s.shuttle is not None
    assert (res["landing"], res["landingCell"]) == (s.shuttle.landing, s.shuttle.landingCell)


def test_ac_112_guided_course_has_no_allow_and_no_shuttle(
    make_client: Factory, db: Session
) -> None:
    c = member(make_client, db, "9306")
    run_id = start(c, "intro-1-v1")
    s = get_content()["intro-1-v1"].situations[0]
    near = s.answer + 1 if s.answer % 2 else s.answer - 1  # 옆 칸 → 입문자는 오답
    res = judge(c, run_id, 1, near).json()
    assert (res["verdict"], res["allow"], res["landing"], res["landingCell"]) == (
        "wrong",
        [],
        None,
        None,
    )


# ── 중복·재전송·순서 ──


def test_duplicate_judge_request_returns_identical_response(
    make_client: Factory, db: Session
) -> None:
    """네트워크 재전송: 같은 요청은 같은 응답, 첫 판정·점수 그대로."""
    c = member(make_client, db, "9307")
    run_id = start(c, ST)
    cell = cell_for(ST, 1, "c")
    first = judge(c, run_id, 1, cell)
    again = judge(c, run_id, 1, cell)
    assert first.status_code == again.status_code == 200
    assert first.json() == again.json()
    assert verdicts(db, run_id) == "c----"


def test_first_verdict_cannot_be_rewritten(make_client: Factory, db: Session) -> None:
    """되감기 방지: 오답 뒤 같은 상황을 몇 번 정답으로 보내도 첫 판정은 오답."""
    c = member(make_client, db, "9308")
    run_id = start(c, ST)
    judge(c, run_id, 1, cell_for(ST, 1, "w"))
    for _ in range(3):
        judge(c, run_id, 1, cell_for(ST, 1, "c"))
    assert verdicts(db, run_id) == "w----"


def test_situations_are_judged_in_order(make_client: Factory, db: Session) -> None:
    c = member(make_client, db, "9309")
    run_id = start(c, ST)
    skip = judge(c, run_id, 2, cell_for(ST, 2, "c"))
    assert (skip.status_code, skip.json()["error"]["code"]) == (409, "out_of_order")
    assert skip.json()["error"]["details"] == {"next": 1}
    judge(c, run_id, 1, cell_for(ST, 1, "c"))
    judge(c, run_id, 2, cell_for(ST, 2, "w"))
    back = judge(c, run_id, 1, cell_for(ST, 1, "w"))  # 지난 상황 다시 보기(재도전): 기록 그대로
    assert (back.status_code, back.json()["firstVerdict"]) == (200, "correct")
    assert verdicts(db, run_id) == "cw---"


@pytest.mark.parametrize(
    ("body", "code"),
    [
        ({"situation": 0, "cell": 1}, "invalid_situation"),
        ({"situation": 6, "cell": 1}, "invalid_situation"),
        ({"situation": 1, "cell": 7}, "invalid_cell"),  # 6칸
        ({"situation": 1, "cell": 0}, "invalid_cell"),
        ({"situation": 1, "cell": 1, "points": 1}, "validation_error"),  # 정의되지 않은 필드
        ({"situation": 1}, "validation_error"),
    ],
)
def test_judge_input_validation(
    make_client: Factory, db: Session, body: dict[str, object], code: str
) -> None:
    c = member(make_client, db, "9310")
    run_id = start(c, ST)
    res = c.post(f"/api/me/tutorial/runs/{run_id}/judge", json=body)
    assert (res.status_code, res.json()["error"]["code"]) == (422, code)
    assert verdicts(db, run_id) == "-----"


# ── 완료(진행 기록 저장) ──


def test_complete_requires_all_situations(make_client: Factory, db: Session) -> None:
    c = member(make_client, db, "9311")
    run_id = start(c, ST)
    judge(c, run_id, 1, cell_for(ST, 1, "c"))
    res = complete(c, ST, run_id)
    assert (res.status_code, res.json()["error"]["code"]) == (409, "run_incomplete")
    assert res.json()["error"]["details"] == {"next": 2}
    assert db.scalar(select(func.count()).select_from(TutorialProgress)) == 0


def test_ac_094_complete_is_idempotent(make_client: Factory, db: Session) -> None:
    """같은 완료 요청(재전송·시간 초과 재시도)은 같은 결과, 다시 저장하지 않음, 행 1개."""
    c = member(make_client, db, "9312")
    run_id, first = play_run(c, ST, ["c", "c", "c", "c", "w"])
    again = complete(c, ST, run_id)
    assert again.status_code == 200 and again.json() == first
    assert db.scalar(select(func.count()).select_from(TutorialProgress)) == 1
    after = judge(c, run_id, 5, cell_for(ST, 5, "c"))  # 완료 뒤 판정은 거부
    assert (after.status_code, after.json()["error"]["code"]) == (409, "run_completed")


def test_ac_094_best_and_first_pass_kept_across_runs(make_client: Factory, db: Session) -> None:
    c = member(make_client, db, "9313")
    passed = save(c, ST, 4)
    lower = save(c, ST, 2)
    assert lower == passed  # 낮은 점수 회차가 최고 점수·통과·최초 통과 시각을 바꾸지 않음
    assert c.get("/api/me/tutorial/progress").json() == {ST: passed}


def test_run_cannot_be_completed_under_another_stage(make_client: Factory, db: Session) -> None:
    c = member(make_client, db, "9314")
    run_id = start(c, ST)
    for i in range(1, 6):
        judge(c, run_id, i, cell_for(ST, i, "c"))
    res = complete(c, "starter-1-v1", run_id)
    assert (res.status_code, res.json()["error"]["code"]) == (404, "run_not_found")


# ── 다른 회원·만료·콘텐츠 변경 ──


def test_other_members_run_is_not_found(make_client: Factory, db: Session) -> None:
    a = member(make_client, db, "9315")
    b = member(make_client, db, "9316")
    run_id = start(a, ST)
    res = judge(b, run_id, 1, cell_for(ST, 1, "c"))
    assert (res.status_code, res.json()["error"]["code"]) == (404, "run_not_found")
    res = complete(b, ST, run_id)
    assert (res.status_code, res.json()["error"]["code"]) == (404, "run_not_found")
    assert verdicts(db, run_id) == "-----"


def _expire(db: Session, run_id: str) -> None:
    db.execute(
        update(TutorialRun)
        .where(TutorialRun.id == uuid.UUID(run_id))
        .values(expires_at=datetime.now(UTC) - timedelta(seconds=1))
    )
    db.commit()


def test_expired_run_is_rejected(make_client: Factory, db: Session) -> None:
    c = member(make_client, db, "9317")
    run_id = start(c, ST)
    for i in range(1, 6):
        judge(c, run_id, i, cell_for(ST, i, "c"))
    _expire(db, run_id)
    res = judge(c, run_id, 1, cell_for(ST, 1, "c"))
    assert (res.status_code, res.json()["error"]["code"]) == (410, "run_expired")
    res = complete(c, ST, run_id)
    assert (res.status_code, res.json()["error"]["code"]) == (410, "run_expired")
    assert db.scalar(select(func.count()).select_from(TutorialProgress)) == 0


def test_completed_run_stays_idempotent_until_cleanup(make_client: Factory, db: Session) -> None:
    """완료된 회차는 만료 뒤에도(정리 전까지) 같은 완료 결과를 돌려줌."""
    c = member(make_client, db, "9318")
    run_id, first = play_run(c, ST, ["c", "c", "c", "w", "w"])
    _expire(db, run_id)
    assert complete(c, ST, run_id).json() == first


def test_content_change_during_run_is_detected(make_client: Factory, db: Session) -> None:
    c = member(make_client, db, "9319")
    run_id = start(c, ST)
    db.execute(
        update(TutorialRun).where(TutorialRun.id == uuid.UUID(run_id)).values(content_hash="0" * 16)
    )
    db.commit()
    res = judge(c, run_id, 1, cell_for(ST, 1, "c"))
    assert (res.status_code, res.json()["error"]["code"]) == (409, "content_changed")


# ── 회차 시작·정리 정책 ──


def test_start_replaces_unfinished_run_and_cleans_old_rows(
    make_client: Factory, db: Session
) -> None:
    c = member(make_client, db, "9320")
    old = start(c, ST)
    done, _ = play_run(c, "starter-1-v1", ["c"] * 5)
    # 다른 회원의 아주 오래된 회차(만료 + 1일 경과) → 누구 회차든 시작 때 지움
    other = member(make_client, db, "9321")
    stale = start(other, "basic-1-v1")
    db.execute(
        update(TutorialRun)
        .where(TutorialRun.id == uuid.UUID(stale))
        .values(expires_at=datetime.now(UTC) - timedelta(days=2))
    )
    db.commit()
    new = start(c, ST)
    db.expire_all()
    ids = {str(r) for r in db.scalars(select(TutorialRun.id)).all()}
    assert new in ids and done in ids  # 새 회차, 다른 스테이지의 완료 회차(정리 기간 전)는 남음
    assert old not in ids  # 같은 스테이지의 끝나지 않은 회차는 새 회차로 대체
    assert stale not in ids  # 정리 정책
    res = judge(c, old, 1, cell_for(ST, 1, "c"))
    assert (res.status_code, res.json()["error"]["code"]) == (404, "run_not_found")


def test_start_response_and_unknown_stage(make_client: Factory, db: Session) -> None:
    c = member(make_client, db, "9322")
    res = c.post("/api/me/tutorial/stages/starter-2-v1/runs").json()
    assert set(res) == {"runId", "stageId", "situations", "expiresAt"}  # 정답 데이터 없음
    assert (res["stageId"], res["situations"]) == (ST, 5)
    for sid in ("beginner-1", "mid-1-v1", "nope"):
        bad = c.post(f"/api/me/tutorial/stages/{sid}/runs")
        assert (bad.status_code, bad.json()["error"]["code"]) == (404, "stage_not_found")


# ── 완료된 본인 회차 조회(6단계, SCR-103 새로고침 복구·틀린 상황 다시 보기) ──


def test_run_review_only_for_own_completed_run(make_client: Factory, db: Session) -> None:
    a = member(make_client, db, "9330")
    b = member(make_client, db, "9331")
    run_id = start(a, ST)
    for i in range(1, 6):
        judge(a, run_id, i, cell_for(ST, i, "c"))
    res = a.get(f"/api/me/tutorial/runs/{run_id}")  # 아직 저장 전
    assert (res.status_code, res.json()["error"]["code"]) == (409, "run_incomplete")
    assert complete(a, ST, run_id).status_code == 200
    other = b.get(f"/api/me/tutorial/runs/{run_id}")  # 다른 회원
    assert (other.status_code, other.json()["error"]["code"]) == (404, "run_not_found")
    missing = a.get(f"/api/me/tutorial/runs/{uuid.uuid4()}")
    assert (missing.status_code, missing.json()["error"]["code"]) == (404, "run_not_found")


def test_run_review_restores_result_and_wrong_situations_without_reapplying(
    make_client: Factory, db: Session
) -> None:
    """새로고침 복구: 같은 결과·틀린 상황만의 정답 데이터. 다시 불러도 진행 기록은 그대로."""
    c = member(make_client, db, "9332")
    run_id, saved = play_run(c, ST, ["c", "wc", "a", "c", "c"])
    first = c.get(f"/api/me/tutorial/runs/{run_id}").json()
    again = c.get(f"/api/me/tutorial/runs/{run_id}").json()
    assert first == again
    assert first["run"] == saved["run"]  # 저장 때 결과와 같음
    assert first["run"] == {
        "score": 3,
        "total": 5,
        "passed": False,
        "wrong": [{"no": 2, "kind": "wrong"}, {"no": 3, "kind": "allow"}],
    }
    s2 = get_content()[ST].situations[1]
    r2 = next(r for r in first["review"] if r["no"] == 2)
    assert [r["no"] for r in first["review"]] == [2, 3]  # 첫 시도 정답 상황은 넣지 않음
    assert (r2["kind"], r2["answer"], r2["correctReason"]) == (
        "wrong",
        s2.answer,
        s2.explanation.correct,
    )
    assert r2["correctMove"]["cell"] == s2.answer
    assert set(r2) >= {"description", "start", "shuttle", "landing", "landingCell"}
    assert "cell" not in {k for k in r2 if k != "correctMove"}  # 고른 칸은 어디에도 없음
    prog = c.get("/api/me/tutorial/progress").json()[ST]
    assert (prog["best"], prog["passed"]) == (3, False)
    assert db.scalar(select(func.count()).select_from(TutorialProgress)) == 1
