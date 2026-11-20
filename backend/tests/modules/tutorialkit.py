"""튜토리얼 서버 판정 회차를 API로 진행하는 테스트 도우미(3단계).

계획 문자: c = 첫 시도 정답, a = 허용 칸, w = 오답,
wc = 오답 뒤 재도전 정답(점수 0), ac = 허용 뒤 재도전 정답.
"""

from typing import Any

from fastapi.testclient import TestClient

from app.modules.tutorial.content import get_content
from app.modules.tutorial.registry import get_registry

BASE = "/api/me/tutorial"


def cell_for(stage_id: str, situation: int, kind: str) -> int:
    """그 상황에서 정답(c)·허용(a)·오답(w) 칸 하나."""
    s = get_content()[stage_id].situations[situation - 1]
    if kind == "c":
        return s.answer
    if kind == "a":
        assert s.allow, f"{stage_id}#{situation}: no allow cell"
        return s.allow[0]
    cells = get_registry().course(get_content()[stage_id].course).cells
    return next(n for n in range(1, cells + 1) if n != s.answer and n not in s.allow)


def start(c: TestClient, stage_id: str) -> str:
    res = c.post(f"{BASE}/stages/{stage_id}/runs")
    assert res.status_code == 200, res.text
    return str(res.json()["runId"])


def judge(c: TestClient, run_id: str, situation: int, cell: int) -> Any:
    return c.post(f"{BASE}/runs/{run_id}/judge", json={"situation": situation, "cell": cell})


def complete(c: TestClient, stage_id: str, run_id: str) -> Any:
    return c.put(f"{BASE}/stages/{stage_id}", json={"runId": run_id})


def play_run(c: TestClient, stage_id: str, plan: list[str]) -> tuple[str, dict[str, Any]]:
    """계획대로 판정하고 완료. (회차 ID, 완료 응답 전체)."""
    run_id = start(c, stage_id)
    for i, step in enumerate(plan, 1):
        for kind in step:  # 'wc'면 오답 → 정답 재도전
            res = judge(c, run_id, i, cell_for(stage_id, i, kind))
            assert res.status_code == 200, res.text
    res = complete(c, stage_id, run_id)
    assert res.status_code == 200, res.text
    return run_id, res.json()


def save(c: TestClient, stage_id: str, score: int) -> dict[str, Any]:
    """첫 시도 정답 score개 + 나머지 오답 회차를 완료하고 저장 후 진행 기록을 돌려줌."""
    n = len(get_content()[stage_id].situations)
    _, body = play_run(c, stage_id, ["c"] * score + ["w"] * (n - score))
    assert body["run"]["score"] == score
    return {k: body[k] for k in ("passed", "best", "firstPassedAt")}
