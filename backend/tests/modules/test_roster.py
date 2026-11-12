"""명단·게스트·점수(SCR-211–214, I1).

AC 매핑: AC-010 직접 추가·수정 / AC-011 회원 접근 불가 / AC-012 게스트 등록 /
AC-013 게스트 삭제(소프트) /
AC-015 게스트 랭크 없음 / AC-016 점수 1–10 정수 / AC-017·066 회원 응답에 점수 없음 /
AC-054·098 본인 프로필 변경이 명단에 반영 / AC-099 급수 필수·지인은 운영진만 / AC-100 회원 현황
"""

import uuid
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.roster.models import Guest, MemberRating
from app.modules.user.models import User
from tests.modules.authkit import kakao_login, make_user

Factory = Callable[[], TestClient]


def login_as(make_client: Factory, db: Session, role: str, kid: str, **kw: str) -> TestClient:
    c = make_client()
    make_user(db, name=kw.get("name", f"{role}-{kid}"), role=role, kakao_id=kid)
    kakao_login(c, kid)
    return c


@pytest.fixture
def admin(make_client: Factory, db: Session) -> TestClient:
    return login_as(make_client, db, "admin", "8001", name="운영진")


def row(roster: dict[str, list[dict[str, object]]], name: str) -> dict[str, object]:
    return next(p for p in roster["members"] + roster["guests"] if p["name"] == name)


# ── 조회 ──


def test_list_roster_members_and_guests(admin: TestClient, db: Session) -> None:
    make_user(db, name="가회원", kakao_id="8101")
    make_user(db, name="대기자", status="pending", kakao_id="8102")
    db.add(Guest(name="손님", gender="여", grade="초심", score=4))
    db.add(Guest(name="지운손님", gender="남", grade="D조", deleted_at=None))
    db.commit()
    gone = db.scalars(select(Guest).where(Guest.name == "지운손님")).one()
    admin.delete(f"/api/roster/guests/{gone.id}")
    roster = admin.get("/api/roster").json()
    names = [m["name"] for m in roster["members"]]
    assert names == sorted(names) and "가회원" in names and "운영진" in names
    assert "대기자" not in names  # 승인된 회원만
    assert [g["name"] for g in roster["guests"]] == ["손님"]  # 삭제된 게스트 제외
    g = row(roster, "손님")
    assert (g["kind"], g["score"], g["tutorialRecommendedUnpassed"]) == ("guest", 4, False)
    assert isinstance(g["version"], str) and g["version"]


# ── AC-010: 직접 추가·수정 ──


def test_ac_010_add_member_directly_and_edit(admin: TestClient, db: Session) -> None:
    body = {"name": " 직접회원 ", "gender": "남", "grade": "C조", "score": 6, "referrer": "운영진"}
    res = admin.post("/api/roster/members", json=body)
    assert res.status_code == 201
    created = res.json()
    assert (created["name"], created["score"]) == ("직접회원", 6)
    user = db.get(User, uuid.UUID(created["id"]))
    assert user is not None and (user.status, user.role, user.identities) == (
        "approved",
        "member",
        [],
    )
    upd = {"name": "직접회원2", "gender": "남", "grade": "B조", "score": 7}
    res = admin.put(
        f"/api/roster/members/{created['id']}", json={**upd, "version": created["version"]}
    )
    assert res.status_code == 200
    assert (res.json()["name"], res.json()["grade"], res.json()["score"]) == ("직접회원2", "B조", 7)
    rating = db.get(MemberRating, uuid.UUID(created["id"]))
    assert rating is not None and rating.score == 7


@pytest.mark.parametrize(
    "body",
    [
        {"name": "급수없음", "gender": "남", "score": None},  # AC-099 급수 필수
        {"name": " ", "gender": "남", "grade": "C조"},
        {"name": "가" * 31, "gender": "남", "grade": "C조"},
        {"name": "성별", "gender": "x", "grade": "C조"},
    ],
)
def test_ac_099_required_fields(admin: TestClient, body: dict[str, object]) -> None:
    for path in ("/api/roster/members", "/api/roster/guests"):
        res = admin.post(path, json=body)
        assert res.status_code == 422 and res.json()["error"]["code"] == "validation_error"


# ── AC-016: 점수 1–10 정수 ──


@pytest.mark.parametrize("score", [0, 11, -1])
def test_ac_016_score_out_of_range(admin: TestClient, score: int) -> None:
    res = admin.post(
        "/api/roster/guests", json={"name": "범위", "gender": "남", "grade": "C조", "score": score}
    )
    assert res.status_code == 422 and res.json()["error"]["code"] == "invalid_score"


def test_ac_016_non_integer_score_rejected(admin: TestClient) -> None:
    res = admin.post(
        "/api/roster/guests", json={"name": "소수", "gender": "남", "grade": "C조", "score": 5.5}
    )
    assert res.status_code == 422


def test_ac_016_score_7_saved_and_unset(admin: TestClient, db: Session) -> None:
    m = admin.post(
        "/api/roster/members", json={"name": "점수", "gender": "여", "grade": "D조", "score": 7}
    ).json()
    assert m["score"] == 7
    # 미설정으로 되돌리기 = 평가 행 삭제
    res = admin.put(
        f"/api/roster/members/{m['id']}",
        json={
            "name": "점수",
            "gender": "여",
            "grade": "D조",
            "score": None,
            "version": m["version"],
        },
    )
    assert res.json()["score"] is None
    assert db.get(MemberRating, uuid.UUID(m["id"])) is None


# ── AC-012·013·015: 게스트 ──


def test_ac_012_013_guest_create_edit_soft_delete(admin: TestClient, db: Session) -> None:
    g = admin.post(
        "/api/roster/guests", json={"name": "게스트", "gender": "여", "grade": "왕초심"}
    ).json()
    assert (g["kind"], g["score"]) == ("guest", None)
    edited = admin.put(
        f"/api/roster/guests/{g['id']}",
        json={
            "name": "게스트2",
            "gender": "여",
            "grade": "초심",
            "score": 3,
            "version": g["version"],
        },
    ).json()
    assert (edited["name"], edited["score"]) == ("게스트2", 3)
    assert admin.get(f"/api/roster/guests/{g['id']}/delete-info").json() == {"kind": "none"}
    assert admin.delete(f"/api/roster/guests/{g['id']}").status_code == 204
    row_ = db.get(Guest, uuid.UUID(g["id"]))
    assert (
        row_ is not None and row_.deleted_at is not None and row_.deleted_by_id is not None
    )  # 행은 남음(D2)
    # 비식별화(AC-013 확장, U5·C안): 이름·급수·성별·점수 모두 지움. 행·id는 남아 지난 기록 참조 유지
    assert (row_.name, row_.grade, row_.gender, row_.score) == (None, None, None, None)
    assert admin.delete(f"/api/roster/guests/{g['id']}").status_code == 404
    assert (
        admin.put(
            f"/api/roster/guests/{g['id']}",
            json={
                "name": "x",
                "gender": "여",
                "grade": "초심",
                "score": None,
                "version": edited["version"],
            },
        ).status_code
        == 404
    )
    assert all(x["id"] != g["id"] for x in admin.get("/api/roster").json()["guests"])


def test_ac_015_guest_has_no_member_status(admin: TestClient) -> None:
    g = admin.post(
        "/api/roster/guests", json={"name": "랭크없음", "gender": "남", "grade": "C조"}
    ).json()
    assert admin.get(f"/api/roster/members/{g['id']}/status").status_code == 404


# ── AC-100: 회원 현황 ──


def test_ac_100_member_status(admin: TestClient, db: Session) -> None:
    m = admin.post(
        "/api/roster/members",
        json={"name": "현황", "gender": "남", "grade": "C조", "score": 2, "referrer": "지인A"},
    ).json()
    s = admin.get(f"/api/roster/members/{m['id']}/status").json()
    assert s["referrer"] == "지인A" and s["recommended"] is True  # 점수 3 이하(C-23)
    assert s["rank"] is None and s["record"] == {"games": 0, "wins": 0, "losses": 0}  # I3 전
    assert s["tutorial"] == {"beginner": 0, "novice": 0, "total": 3}  # I2 전


# ── 동시 수정 ──


def test_conflict_between_two_admins(make_client: Factory, db: Session) -> None:
    a = login_as(make_client, db, "admin", "8201")
    b = login_as(make_client, db, "admin", "8202")
    m = a.post(
        "/api/roster/members", json={"name": "공유", "gender": "남", "grade": "C조", "score": 5}
    ).json()
    first = a.put(
        f"/api/roster/members/{m['id']}",
        json={"name": "공유", "gender": "남", "grade": "B조", "score": 5, "version": m["version"]},
    )
    assert first.status_code == 200
    stale = b.put(
        f"/api/roster/members/{m['id']}",
        json={"name": "공유", "gender": "남", "grade": "A조", "score": 9, "version": m["version"]},
    )
    assert stale.status_code == 409 and stale.json()["error"]["code"] == "conflict"
    user = db.get(User, uuid.UUID(m["id"]))
    db.refresh(user)
    assert user is not None and user.grade == "B조"  # 늦은 저장이 덮어쓰지 않음


def test_ac_054_098_member_profile_edit_reflects_and_detects_conflict(
    make_client: Factory, db: Session, admin: TestClient
) -> None:
    member = login_as(make_client, db, "member", "8301", name="본인")
    before = row(admin.get("/api/roster").json(), "본인")
    assert (
        member.put(
            "/api/me/profile", json={"name": "본인", "gender": "남", "grade": "B조"}
        ).status_code
        == 200
    )
    after = row(admin.get("/api/roster").json(), "본인")
    assert after["grade"] == "B조" and after["version"] != before["version"]  # 명단에 반영
    stale = admin.put(
        f"/api/roster/members/{before['id']}",
        json={
            "name": "본인",
            "gender": "남",
            "grade": "D조",
            "score": None,
            "version": before["version"],
        },
    )
    assert stale.status_code == 409


def test_score_only_uses_previous_value(
    admin: TestClient, make_client: Factory, db: Session
) -> None:
    g = admin.post(
        "/api/roster/guests", json={"name": "연속", "gender": "남", "grade": "C조"}
    ).json()
    ok = admin.put(f"/api/roster/guests/{g['id']}/score", json={"score": 5, "previous": None})
    assert ok.status_code == 200 and ok.json()["score"] == 5
    again = admin.put(f"/api/roster/guests/{g['id']}/score", json={"score": 6, "previous": None})
    assert again.status_code == 409  # 그사이 다른 사람이 5로 매김
    m = admin.post(
        "/api/roster/members", json={"name": "연속회원", "gender": "여", "grade": "D조"}
    ).json()
    assert (
        admin.put(
            f"/api/roster/members/{m['id']}/score", json={"score": 4, "previous": None}
        ).json()["score"]
        == 4
    )
    assert (
        admin.put(f"/api/roster/members/{m['id']}/score", json={"score": 12, "previous": 4}).json()[
            "error"
        ]["code"]
        == "invalid_score"
    )


# ── 권한·계약 ──


@pytest.mark.parametrize(
    ("role", "status", "code"),
    [
        (None, None, "unauthenticated"),
        ("member", "approved", "forbidden"),
        ("admin", "pending", "account_restricted"),
    ],
)
def test_ac_011_roster_permissions(
    make_client: Factory, db: Session, role: str | None, status: str | None, code: str
) -> None:
    c = make_client()
    if role and status:
        make_user(db, role=role, status=status, kakao_id="8401")
        kakao_login(c, "8401")
    some = str(uuid.uuid4())
    for method, path, body in [
        ("GET", "/api/roster", None),
        ("GET", f"/api/roster/members/{some}/status", None),
        ("POST", "/api/roster/guests", {"name": "x", "gender": "남", "grade": "C조"}),
        (
            "PUT",
            f"/api/roster/members/{some}",
            {"name": "x", "gender": "남", "grade": "C조", "version": "v"},
        ),
        ("PUT", f"/api/roster/guests/{some}/score", {"score": 5, "previous": None}),
        ("DELETE", f"/api/roster/guests/{some}", None),
    ]:
        res = c.request(method, path, json=body)
        assert res.json()["error"]["code"] == code, (method, path)


def test_csrf_on_roster_writes(admin: TestClient) -> None:
    res = admin.post(
        "/api/roster/guests",
        json={"name": "외부", "gender": "남", "grade": "C조"},
        headers={"Origin": "https://evil.example"},
    )
    assert res.json()["error"]["code"] == "csrf_origin_mismatch"


def test_ac_017_066_member_responses_never_include_score(
    make_client: Factory, db: Session, admin: TestClient
) -> None:
    member = login_as(make_client, db, "member", "8501", name="점수숨김")
    target = row(admin.get("/api/roster").json(), "점수숨김")
    admin.put(f"/api/roster/members/{target['id']}/score", json={"score": 8, "previous": None})
    for path in ("/api/auth/me", "/api/me/profile"):
        data = member.get(path).json()
        assert "score" not in data and "rating" not in data, path
        assert set(data) <= {"id", "name", "role", "status", "gender", "grade"}, path
