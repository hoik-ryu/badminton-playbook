"""I3-d4 계약: 실제 API 응답·오류 형태를 골든(키 구조)으로 고정하고 FE가 같은 파일로 대조.

- 응답 키 구조(중첩·목록 원소 합집합): 운영진 목록·상세, 회원 목록·상세, 내 전적, 명단 회원 현황
- 오류: 코드별 HTTP 상태와 details 키 구조(conflict·locked·no_games·not_all_recorded·
  unscored_players·min_players·not_eligible·same_matchup·no_substitute·in_games·
  not_found·club_match_not_found), 인증 401·권한 403·CSRF 403
- 골든: backend/tests/golden/clubmatch_api_shapes.json
  (FE `api.shapes.test.ts`가 TS 타입·Mock과 대조). 의도적으로 계약을 바꿀 때만
  UPDATE_GOLDEN=1 uv run pytest tests/modules/test_clubmatch_api_contract.py
"""

import json
import os
from collections.abc import Callable
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.modules.roster.models import Guest
from tests.modules.authkit import ORIGIN, kakao_login, make_user
from tests.modules.test_clubmatch_flow import (
    BASE,
    crafted,
    err,
    join,
    member,
    new_match,
    ok,
    post,
    result,
    settings,
)

Factory = Callable[[], TestClient]
GOLDEN = Path(__file__).parents[1] / "golden" / "clubmatch_api_shapes.json"
Shape = Any


def shape(value: Any) -> Shape:
    """키 구조: dict → {키: 구조}, list → [원소 구조의 합집합] (빈 목록은 []), 값 → true."""
    if isinstance(value, dict):
        return {k: shape(v) for k, v in sorted(value.items())}
    if isinstance(value, list):
        merged: Shape = None
        for item in value:
            merged = merge(merged, shape(item))
        return [] if merged is None else [merged]
    return True


def merge(a: Shape, b: Shape) -> Shape:
    if a is None or a is True and b is not True:
        return b
    if b is True or b is None:
        return a
    if isinstance(a, dict) and isinstance(b, dict):
        return {k: merge(a.get(k), b.get(k)) for k in sorted(set(a) | set(b))}
    if isinstance(a, list) and isinstance(b, list):
        if not a:
            return b
        if not b:
            return a
        return [merge(a[0], b[0])]
    return a


class Collector:
    def __init__(self) -> None:
        self.responses: dict[str, Shape] = {}
        self.errors: dict[str, dict[str, Any]] = {}

    def response(self, name: str, body: Any) -> Any:
        self.responses[name] = merge(self.responses.get(name), shape(body))
        return body

    def error(self, res: Any, code: str) -> None:
        assert err(res)[1] == code, res.text
        body = res.json()["error"]
        assert set(body) == {"code", "message", "details"}
        entry = {"status": res.status_code, "details": shape(body["details"])}
        prev = self.errors.get(code)
        if prev:
            assert prev["status"] == entry["status"], code
            entry["details"] = (
                merge(prev["details"], entry["details"])
                if prev["details"] is not True
                else entry["details"]
            )
        self.errors[code] = entry


def test_api_shapes_match_golden(make_client: Factory, db: Session) -> None:
    c = Collector()
    admin = make_client()
    me = make_user(db, name="계약관리자", role="admin", kakao_id="9501")
    kakao_login(admin, "9501")

    # ── 확정 전: 점수 미설정·인원 부족·참가 해제 불가 ──
    view = new_match(admin, name="계약")
    keys = [f"member:{me.id}"] + [
        f"member:{member(db, f'계약{i}', '여' if i % 2 else '남').id}" for i in range(4)
    ]
    unscored = make_user(db, name="미설정")
    guest = Guest(name="손님", gender="여", grade="초심", score=4)
    db.add(guest)
    db.commit()
    for key in [*keys, f"member:{unscored.id}", f"guest:{guest.id}"]:
        view = join(admin, view, key)
    view = settings(admin, view, 3)  # 7명·3경기 → 고르지 않음(균등안 제안)
    c.response("ClubMatchView", ok(admin.get(f"{BASE}/{view['id']}")))
    c.error(post(admin, view, "games"), "unscored_players")
    assert (
        admin.put(
            f"/api/roster/members/{me.id}/score", json={"score": 7, "previous": None}
        ).status_code
        == 200
    )
    score = admin.put(
        f"/api/roster/members/{unscored.id}/score", json={"score": 5, "previous": None}
    )
    assert score.status_code == 200, score.text
    small = new_match(admin, name="인원")
    small = join(admin, small, keys[1])
    c.error(post(admin, small, "games"), "min_players")
    c.error(post(admin, small, "confirm"), "no_games")
    view = ok(admin.get(f"{BASE}/{view['id']}"))
    view = c.response("ClubMatchView", ok(post(admin, view, "games")))
    in_game = view["games"][0]["team1"][0]["key"]
    off = admin.put(
        f"{BASE}/{view['id']}/participants/{in_game}",
        json={"participating": False, "version": view["version"]},
    )
    c.error(off, "in_games")
    c.error(admin.post(f"{BASE}/{view['id']}/confirm", json={"version": 0}), "conflict")
    c.error(result(admin, view, 1, 1), "locked")
    outsider = f"member:{make_user(db, name='비활성', status='inactive').id}"
    c.error(
        admin.put(
            f"{BASE}/{view['id']}/participants/{outsider}",
            json={"participating": True, "version": view["version"]},
        ),
        "not_eligible",
    )

    # ── 확정 이후: 결과·되돌리기·종료·종료 후 수정 ──
    view = c.response("ClubMatchView", ok(post(admin, view, "confirm")))
    view = ok(result(admin, view, 1, 1))
    view = ok(result(admin, view, 1, None))
    c.error(post(admin, view, "finish"), "not_all_recorded")
    for g in view["games"]:
        view = ok(result(admin, view, g["no"], 2))
    view = ok(post(admin, view, "finish"))
    view = c.response("ClubMatchView", ok(result(admin, view, 1, 1)))
    assert view["resultModifiedAt"]
    c.error(admin.get(f"{BASE}/{'0' * 8}-0000-0000-0000-{'0' * 12}"), "not_found")
    # 팀전(목록의 team 객체 포함)
    tv = new_match(admin, method="team", name="팀계약")
    for i, key in enumerate(keys):
        tv = join(admin, tv, key, "blue" if i % 2 else "white")
    tv = ok(post(admin, settings(admin, tv, 1), "games"))
    ok(post(admin, tv, "confirm"))
    c.response("ClubMatchListItem[]", ok(admin.get(BASE)))
    c.response("MemberStatus", ok(admin.get(f"/api/roster/members/{me.id}/status")))

    # ── 교체·중도 귀가 정책 오류(P-4·P-4-b) + 완화 사유가 있는 상세 ──
    cv, k = crafted(admin, db, ["남"] * 6, [[0, 1, 2, 3], [0, 1, 2, 4]])
    c.error(post(admin, cv, "games/2/swap", **{"from": k[4], "to": k[3]}), "same_matchup")
    c.error(
        post(admin, cv, f"participants/{k[4]}/leave", assignments=[{"gameNo": 2, "to": k[3]}]),
        "same_matchup",
    )
    c.error(post(admin, cv, f"participants/{k[4]}/leave", assignments=[]), "conflict")
    fv, f = crafted(admin, db, ["남"] * 5, [[0, 1, 2, 3], [0, 1, 2, 4]])
    fv = ok(result(admin, fv, 1, 1))
    fv = ok(post(admin, fv, f"participants/{f[4]}/leave", assignments=[{"gameNo": 2, "to": f[3]}]))
    c.response("ClubMatchView", fv)
    assert fv["games"][1]["relaxations"]
    nv, n = crafted(admin, db, ["남"] * 4, [[0, 1, 2, 3], [0, 1, 2, 3]])
    nv = ok(result(admin, nv, 1, 1))
    c.error(
        post(admin, nv, f"participants/{n[3]}/leave", assignments=[{"gameNo": 2, "to": n[0]}]),
        "no_substitute",
    )

    # ── 회원·내 전적(같은 운영진 계정도 승인 사용자라 회원 API 사용 가능) ──
    c.response("PublicClubMatchItem[]", ok(admin.get("/api/member/club-matches")))
    c.response("PublicClubMatch", ok(admin.get(f"/api/member/club-matches/{view['id']}")))
    c.response("MyRecord", ok(admin.get("/api/me/record")))
    c.error(admin.get("/api/member/club-matches/nope"), "club_match_not_found")

    # ── 인증·권한·CSRF ──
    anon = make_client()
    for path in (BASE, "/api/member/club-matches", "/api/me/record"):
        res = anon.get(path)
        assert res.status_code == 401, path
    c.error(anon.get(BASE), err(anon.get(BASE))[1])
    plain = make_client()
    make_user(db, name="일반회원", kakao_id="9502")
    kakao_login(plain, "9502")
    c.error(plain.get(BASE), err(plain.get(BASE))[1])
    assert plain.get(BASE).status_code == 403
    evil = admin.post(
        BASE,
        json={"method": "individual", "date": "2026-11-20", "name": "x"},
        headers={"Origin": "http://evil.example"},
    )
    assert evil.status_code == 403
    c.error(evil, err(evil)[1])
    assert ORIGIN  # 허용 Origin(테스트 클라이언트 기본값)은 그대로 통과(위 모든 변경 요청)

    actual = {"responses": c.responses, "errors": dict(sorted(c.errors.items()))}
    if os.environ.get("UPDATE_GOLDEN") == "1":
        GOLDEN.write_text(
            json.dumps(actual, ensure_ascii=False, indent=1, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    assert json.loads(GOLDEN.read_text(encoding="utf-8")) == actual


def test_golden_has_no_empty_lists() -> None:
    """빈 목록([])이 있으면 그 안의 키를 대조하지 못하므로 시나리오가 모든 목록을 채워야 함."""

    def walk(node: Shape, path: str) -> None:
        if isinstance(node, dict):
            for k, v in node.items():
                walk(v, f"{path}.{k}")
        elif isinstance(node, list):
            assert node, f"빈 목록: {path}"
            walk(node[0], f"{path}[]")

    walk(json.loads(GOLDEN.read_text(encoding="utf-8"))["responses"], "")
