"""튜토리얼 서버 콘텐츠와 조회 API(2단계, 사용자 결정 2026-11-19 D-T1·D-T2).

- AC-117: 콘텐츠 형식·정합성 자동 검사(정답 1개, 칸 범위, 허용·정답 겹침 없음, 입문자 허용 없음,
  해설, 5상황, 레지스트리 일치, 예상 학습 시간) + 좌표 범위·도착 칸·콘텐츠 버전·파일 이름
- AC-116: 15칸(grid-5x3) 시험 데이터도 같은 코드로 검사·조회(출시 목록에서는 계속 '준비 중')
- AC-093: 과정 5단계 순서와 MVP 8스테이지, 미출시 과정은 스테이지 없음
- 공개 조회 응답에 판정 데이터(정답·허용 칸, 떨어지는 지점, 파트너 목표, 이동 목표점, 해설)가 없음
- 레지스트리에 없거나 미출시 과정의 스테이지는 404 stage_not_found, 권한은 기존과 같음
"""

import copy
import json
import uuid
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.modules.tutorial import router as tutorial_router
from app.modules.tutorial.content import (
    CONTENT_DIR,
    StageContent,
    cell_of,
    get_content,
    load_stage_files,
    validate_content,
)
from app.modules.tutorial.registry import REGISTRY_PATH, Registry, get_registry, load_registry
from tests.modules.authkit import kakao_login, make_user
from tests.modules.tutorialkit import save

Factory = Callable[[], TestClient]
SECRET_KEYS = {
    "answer",
    "allow",
    "landing",
    "landingCell",
    "partnerCell",
    "partnerByCell",
    "targets",
    "explanation",
}


def member(make_client: Factory, db: Session, kid: str, role: str = "member") -> TestClient:
    c = make_client()
    make_user(db, name=f"회원{kid}", role=role, kakao_id=kid)
    kakao_login(c, kid)
    return c


def raw_registry() -> dict[str, Any]:
    return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))  # type: ignore[no-any-return]


def raw_stage(stage_id: str) -> dict[str, Any]:
    return json.loads((CONTENT_DIR / f"{stage_id}.json").read_text(encoding="utf-8"))  # type: ignore[no-any-return]


def errors_for(
    mutate: Callable[[dict[str, Any]], None], stage_id: str = "starter-2-v1"
) -> list[str]:
    """실제 콘텐츠 한 스테이지를 고친 뒤 검사 결과."""
    stages = dict(get_content())
    raw = raw_stage(stage_id)
    mutate(raw)
    stages[stage_id] = StageContent.model_validate(raw)
    return validate_content(get_registry(), stages)


def keys_deep(o: object) -> set[str]:
    if isinstance(o, dict):
        return set(o) | {k for v in o.values() for k in keys_deep(v)}
    if isinstance(o, list):
        return {k for v in o for k in keys_deep(v)}
    return set()


# ── AC-117: 실제 MVP 콘텐츠 ──


def test_ac_117_mvp_content_passes_all_checks() -> None:
    """AC-117: 8스테이지·40상황이 레지스트리와 일치하고 모든 검사를 통과."""
    content = get_content()
    assert sorted(content) == sorted(get_registry().stages)
    assert sum(len(s.situations) for s in content.values()) == 40
    assert validate_content(get_registry(), content) == []


def _set_sit(i: int, key: str, value: object) -> Callable[[dict[str, Any]], None]:
    def m(raw: dict[str, Any]) -> None:
        raw["situations"][i][key] = value

    return m


@pytest.mark.parametrize(
    ("stage_id", "mutate", "expect"),
    [
        ("starter-2-v1", _set_sit(0, "answer", 7), "answer 7 out of 1..6"),  # 6칸 범위 밖
        ("starter-2-v1", _set_sit(0, "answer", 0), "answer 0 out of 1..6"),
        ("basic-1-v1", _set_sit(0, "allow", [10]), "out of 1..9"),  # 9칸 범위 밖
        ("starter-2-v1", _set_sit(0, "allow", [6]), "allow overlaps answer"),
        ("starter-2-v1", _set_sit(0, "allow", [4, 4]), "duplicate allow"),
        ("intro-1-v1", _set_sit(0, "allow", [2]), "guided course must have no allow"),
        (
            "starter-2-v1",
            lambda r: r["situations"][0]["explanation"].update(correct=" "),
            "explanations required",
        ),
        (
            "starter-2-v1",
            lambda r: r["situations"][0]["explanation"].update(wrong=""),
            "explanations required",
        ),
        (
            "starter-2-v1",
            lambda r: r["situations"][0]["explanation"].update(better=None),
            "'better' explanation",
        ),
        ("starter-2-v1", lambda r: r["situations"].pop(), "4 situations, registry says 5"),
        ("starter-2-v1", lambda r: r.update(minutes=0), "minutes"),
        ("starter-2-v1", lambda r: r.update(version=2), "version must match registry"),
        ("starter-2-v1", lambda r: r.update(course="basic"), "version must match registry"),
        ("starter-2-v1", lambda r: r["situations"][1].update(no=1), "situation numbers"),
    ],
)
def test_ac_117_each_rule_is_enforced(
    stage_id: str, mutate: Callable[[dict[str, Any]], None], expect: str
) -> None:
    errors = errors_for(mutate, stage_id)
    assert any(expect in e for e in errors), errors


@pytest.mark.parametrize(
    ("mutate", "expect"),
    [
        (
            lambda r: r["situations"][0]["start"].update(me=[40, 60]),
            "me/partner must start on my half",
        ),
        (lambda r: r["situations"][0]["start"].update(partner=[70, 100]), "me/partner must start"),
        (lambda r: r["situations"][0]["start"].update(opponents=[[18, 26], [43, 90]]), "opponents"),
        (
            lambda r: r["situations"][0]["shuttle"].update(stop=[-1, 82]),
            "shuttle from/stop out of court",
        ),
        (
            lambda r: r["situations"][0]["shuttle"].update(landing=[49, 50]),
            "landing must be on my half",
        ),
        (
            lambda r: r["situations"][0]["shuttle"].update(landingCell=5),
            "does not match landing point",
        ),
        (lambda r: r["situations"][0].update(partnerCell=9), "partnerCell out of range"),
        (lambda r: r["situations"][0].update(partnerByCell={"8": 1}), "partnerByCell"),
        (lambda r: r["situations"][0].update(targets={"1": [50, 120]}), "inside that cell"),
        (lambda r: r["situations"][0].update(shuttle=None), "shuttle required"),
    ],
)
def test_court_coordinates_and_cells_are_checked(
    mutate: Callable[[dict[str, Any]], None], expect: str
) -> None:
    """좌표 범위(가로 0–61·세로 0–134), 내 편·상대 편 배치, 도착 칸·이동 목표점이 칸과 맞는지."""
    errors = errors_for(mutate)
    assert any(expect in e for e in errors), errors


def test_guided_course_has_no_shuttle() -> None:
    """ASM-037: 입문자 안내형에는 셔틀 연출이 없음."""
    shuttle = raw_stage("starter-2-v1")["situations"][0]["shuttle"]
    errors = errors_for(_set_sit(0, "shuttle", shuttle), "intro-1-v1")
    assert any("guided course has no shuttle" in e for e in errors)


def test_content_files_match_registry_ids_and_names(tmp_path: Path) -> None:
    """빠진 파일·남는 파일·파일 이름 불일치·같은 ID 중복·알 수 없는 필드는 거부."""
    content = dict(get_content())
    del content["basic-3-v1"]
    assert any("missing=['basic-3-v1']" in e for e in validate_content(get_registry(), content))

    extra = dict(get_content())
    extra["basic-4-v1"] = get_content()["basic-3-v1"].model_copy(update={"id": "basic-4-v1"})
    assert any("extra=['basic-4-v1']" in e for e in validate_content(get_registry(), extra))

    raw = raw_stage("intro-1-v1")
    (tmp_path / "intro-9-v1.json").write_text(json.dumps(raw), encoding="utf-8")
    with pytest.raises(ValueError, match="file name"):
        load_stage_files(tmp_path)

    bad = copy.deepcopy(raw)
    bad["situations"][0]["secretNote"] = "x"  # 정의되지 않은 필드
    (tmp_path / "intro-9-v1.json").unlink()
    (tmp_path / "intro-1-v1.json").write_text(json.dumps(bad), encoding="utf-8")
    with pytest.raises(ValueError):
        load_stage_files(tmp_path)


def test_registry_stage_id_must_carry_course_no_version() -> None:
    """ASM-033: 스테이지 ID = <과정>-<순번>-v<버전>, 과정·순번과 일치."""
    for bad_id in ("intro-1", "intro-2-v1"):
        raw = raw_registry()
        raw["stages"][0]["id"] = bad_id
        with pytest.raises(ValueError):
            load_registry(raw)
    assert {s.version for s in get_registry().stages.values()} == {1}


# ── AC-116: 15칸 시험 데이터 ──


def _grid15_fixture() -> tuple[Registry, dict[str, StageContent]]:
    """출시 콘텐츠가 아닌 시험 데이터: 미출시 중급(grid-5x3)에 스테이지 1개를 더함."""
    raw = raw_registry()
    raw["stages"].append({"id": "mid-1-v1", "course": "mid", "no": 1, "situations": 5})
    registry = load_registry(raw)
    stage = raw_stage("basic-1-v1")
    stage.update(id="mid-1-v1", course="mid", no=1, title="시험용 15칸")
    for s, (answer, allow, landing) in zip(
        stage["situations"],
        [
            (5, [4], [55, 74]),
            (15, [10], [55, 126]),
            (11, [6], [5, 126]),
            (1, [2], [5, 74]),
            (8, [13], [30, 100]),
        ],
        strict=True,
    ):
        s.update(answer=answer, allow=allow, partnerCell=6)
        s["shuttle"].update(landing=landing, landingCell=cell_of(landing[0], landing[1], 5))
    content = dict(get_content())
    content["mid-1-v1"] = StageContent.model_validate(stage)
    return registry, content


def test_ac_116_grid15_numbering_and_validation() -> None:
    """15칸 번호 1–5 / 6–10 / 11–15(왼→오, 위→아래), 같은 검사 코드로 통과."""
    w = 61 / 5
    rows = [67 + 22.33 * r + 11 for r in range(3)]
    assert [[cell_of(w * c + w / 2, y, 5) for c in range(5)] for y in rows] == [
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15],
    ]
    registry, content = _grid15_fixture()
    assert validate_content(registry, content) == []
    assert registry.course("mid").cells == 15


# ── 조회 API ──


def test_ac_093_courses_api_lists_released_stages_in_order(
    make_client: Factory, db: Session
) -> None:
    c = member(make_client, db, "9201")
    body = c.get("/api/me/tutorial/courses").json()
    assert body["passRule"] == {"numerator": 7, "denominator": 10}
    assert [(x["id"], x["name"], x["released"], x["guided"]) for x in body["courses"]] == [
        ("intro", "입문자", True, True),
        ("starter", "왕초급", True, False),
        ("basic", "초급", True, False),
        ("mid", "중급", False, False),
        ("high", "고급", False, False),
    ]
    grids = {x["id"]: (x["grid"]["cols"], x["grid"]["rows"]) for x in body["courses"]}
    assert [(x["description"], x["icon"]) for x in body["courses"]] == [
        ("처음 시작하는 분을 위한 코트와 번호", "AST-035"),
        ("기본 수비 대형과 위치 판단", "AST-036"),
        ("공격·수비 전환과 복귀 위치", "AST-037"),
        (None, None),
        (None, None),
    ]
    assert grids == {
        "intro": (2, 3),
        "starter": (2, 3),
        "basic": (3, 3),
        "mid": (5, 3),
        "high": (5, 3),
    }
    stages = {x["id"]: [s["id"] for s in x["stages"]] for x in body["courses"]}
    assert stages == {
        "intro": ["intro-1-v1", "intro-2-v1"],
        "starter": ["starter-1-v1", "starter-2-v1", "starter-3-v1"],
        "basic": ["basic-1-v1", "basic-2-v1", "basic-3-v1"],
        "mid": [],
        "high": [],
    }
    first = body["courses"][1]["stages"][1]
    assert first == {
        "id": "starter-2-v1",
        "no": 2,
        "version": 1,
        "title": "담당 영역 나누기",
        "minutes": 3,
        "thumbnail": "AST-030",
        "situations": 5,
    }


def test_stage_api_returns_public_content_only(make_client: Factory, db: Session) -> None:
    """공개 응답에는 판정 데이터가 없음(D-T2). 재생에 필요한 시작 배치·셔틀 출발/멈춤만."""
    c = member(make_client, db, "9202")
    for sid in get_registry().stages:
        res = c.get(f"/api/me/tutorial/stages/{sid}")
        assert res.status_code == 200, res.text
        body = res.json()
        assert not (keys_deep(body) & SECRET_KEYS), sid
        for s in get_content()[sid].situations:  # 해설 문장도 응답 어디에도 없음
            assert s.explanation.correct not in res.text and s.explanation.wrong not in res.text
    body = c.get("/api/me/tutorial/stages/starter-2-v1").json()
    assert set(body) == {
        "id", "course", "courseName", "no", "version", "title", "minutes", "thumbnail",
        "guided", "grid", "passRule", "situations",
    }  # fmt: skip
    s1 = body["situations"][0]
    assert set(s1) == {"no", "description", "question", "start", "shuttle"}
    assert s1["start"] == {"me": [40, 102], "partner": [24, 84], "opponents": [[18, 26], [43, 38]]}
    assert s1["shuttle"] == {"from": [43, 38], "stop": [47, 82]}
    intro = c.get("/api/me/tutorial/stages/intro-1-v1").json()
    assert intro["guided"] is True and all(s["shuttle"] is None for s in intro["situations"])


@pytest.mark.parametrize("stage_id", ["beginner-1", "novice-1", "intro-9-v1", "intro-1-v2", "x"])
def test_unknown_or_old_stage_is_404(make_client: Factory, db: Session, stage_id: str) -> None:
    c = member(make_client, db, "9203")
    res = c.get(f"/api/me/tutorial/stages/{stage_id}")
    assert (res.status_code, res.json()["error"]["code"]) == (404, "stage_not_found")


def test_unreleased_course_stage_is_not_served_or_saved(
    make_client: Factory, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """미출시 과정(중급)에 콘텐츠가 있어도 조회·저장 모두 '준비 중인 스테이지'(AC-116)."""
    registry, content = _grid15_fixture()
    monkeypatch.setattr(tutorial_router, "get_registry", lambda: registry)
    monkeypatch.setattr(tutorial_router, "get_content", lambda: content)
    c = member(make_client, db, "9204")
    res = c.get("/api/me/tutorial/stages/mid-1-v1")
    assert (res.status_code, res.json()["error"]["code"]) == (404, "stage_not_found")
    put = c.put("/api/me/tutorial/stages/mid-1-v1", json={"runId": str(uuid.uuid4())})
    assert (put.status_code, put.json()["error"]["code"]) == (404, "stage_not_found")
    run = c.post("/api/me/tutorial/stages/mid-1-v1/runs")
    assert (run.status_code, run.json()["error"]["code"]) == (404, "stage_not_found")
    mid = next(x for x in c.get("/api/me/tutorial/courses").json()["courses"] if x["id"] == "mid")
    assert (mid["released"], mid["stages"], mid["grid"]["cols"]) == (False, [], 5)


@pytest.mark.parametrize(
    ("role", "status", "code"),
    [(None, None, "unauthenticated"), ("member", "pending", "account_restricted")],
)
def test_content_api_permissions(
    make_client: Factory, db: Session, role: str | None, status: str | None, code: str
) -> None:
    c = make_client()
    if role and status:
        make_user(db, role=role, status=status, kakao_id="9205")
        kakao_login(c, "9205")
    assert c.get("/api/me/tutorial/courses").json()["error"]["code"] == code
    assert c.get("/api/me/tutorial/stages/intro-1-v1").json()["error"]["code"] == code


def test_existing_progress_api_unchanged(make_client: Factory, db: Session) -> None:
    """기존 진행률 조회 계약은 그대로. 저장은 3단계부터 서버 판정 회차로(tutorialkit.save)."""
    c = member(make_client, db, "9206", role="admin")  # 운영진도 본인 튜토리얼
    assert c.get("/api/me/tutorial/progress").json() == {}
    saved = save(c, "basic-2-v1", 4)
    assert saved["passed"] is True and saved["best"] == 4
    assert set(c.get("/api/me/tutorial/progress").json()) == {"basic-2-v1"}
