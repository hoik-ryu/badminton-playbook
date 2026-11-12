"""청백전 계산(프런트 `features/clubmatch/schedule.ts`와 같은 결과 — 골든 JSON으로 양쪽 테스트, D1).

I3-a: 경기 수 분포·균등안·팀 배정안·실력차·집계(순위 U3·U4, 팀 승수).
I3-b: 대진 생성(`generateClubGames`)·난수(mulberry32)·완화 검증(U7).
"""

import math
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass
from itertools import combinations
from math import gcd
from typing import Literal

Method = Literal["individual", "team"]
Relaxation = dict[str, str]  # {"rule": "matchup"|"gender", "reason": ...}
Team = Literal["blue", "white"]


def _lcm(a: int, b: int) -> int:
    return a // gcd(a, b) * b


def distribution(method: Method, counts: dict[str, int], total_games: int) -> dict[str, object]:
    """경기 수 분포 미리보기(UXD-071): 예) 12명 3경기, 2명 2경기."""

    def spread(people: int, slots: int) -> list[tuple[int, int]]:
        if people <= 0:
            return []
        base, extra = divmod(slots, people)
        return [(g, n) for g, n in ((base + 1, extra), (base, people - extra)) if n > 0]

    if method == "team":
        parts = spread(counts["blue"], 2 * total_games) + spread(counts["white"], 2 * total_games)
    else:
        parts = spread(counts["all"], 4 * total_games)
    merged: dict[int, int] = {}
    for games, people in parts:
        merged[games] = merged.get(games, 0) + people
    groups = [{"games": g, "people": merged[g]} for g in sorted(merged, reverse=True)]
    return {"groups": groups, "even": len(groups) <= 1}


def even_proposals(
    method: Method, counts: dict[str, int], total_games: int
) -> list[dict[str, object]]:
    """균등안(AC-074): 모두 같은 경기 수가 되는 가까운 총 경기 수 두 개(아래·위)."""
    if method == "team":
        blue, white = counts["blue"], counts["white"]
        if blue < 2 or white < 2:
            return []
        step = _lcm(blue // gcd(blue, 2), white // gcd(white, 2))
    else:
        if counts["all"] < 4:
            return []
        step = counts["all"] // gcd(counts["all"], 4)
    if total_games % step == 0:
        return []
    lower = total_games // step * step
    upper = lower + step

    def each(g: int) -> dict[str, int]:
        if method == "team":
            return {"blue": 2 * g // counts["blue"], "white": 2 * g // counts["white"]}
        return {"blue": 4 * g // counts["all"], "white": 4 * g // counts["all"]}

    return [{"totalGames": g, "each": each(g)} for g in (lower, upper) if g > 0]


@dataclass(frozen=True)
class TeamCandidate:
    key: str
    gender: str | None
    score: int | None


def propose_teams(players: Iterable[TeamCandidate]) -> dict[str, Team]:
    """팀 배정안(AC-072): 성별마다 점수 높은 순(같으면 키 순) 지그재그.

    인원 적은 쪽, 같으면 점수 합 작은 쪽(같으면 청)으로 보냅니다.
    """
    out: dict[str, Team] = {}
    blue = white = blue_sum = white_sum = 0
    plist = list(players)
    for gender in ("남", "여"):
        group = sorted(
            (p for p in plist if p.gender == gender), key=lambda p: (-(p.score or 0), p.key)
        )
        for p in group:
            to_blue = blue < white or (blue == white and blue_sum <= white_sum)
            out[p.key] = "blue" if to_blue else "white"
            if to_blue:
                blue += 1
                blue_sum += p.score or 0
            else:
                white += 1
                white_sum += p.score or 0
    return out


def gap(team1: Sequence[int | None], team2: Sequence[int | None]) -> int | None:
    """실력차(C-24): 한 명이라도 점수가 없으면 계산 불가(None)."""
    if any(s is None for s in (*team1, *team2)):
        return None
    return abs(sum(s for s in team1 if s is not None) - sum(s for s in team2 if s is not None))


@dataclass(frozen=True)
class GameResult:
    team1: tuple[str, str]
    team2: tuple[str, str]
    winner: int | None


def team_score(games: Iterable[GameResult]) -> dict[str, int]:
    """팀전 승수(C-16, AC-084): 1팀 = 청, 2팀 = 백."""
    glist = list(games)
    return {
        "blue": sum(1 for g in glist if g.winner == 1),
        "white": sum(1 for g in glist if g.winner == 2),
    }


def standings(
    games: Iterable[GameResult], participants: Sequence[str], names: dict[str, str]
) -> list[dict[str, object]]:
    """개인전 순위(C-16, AC-082): 누적 승수, 동률은 공동 순위 1·2·2·4(U3).

    같은 승수 안의 표시 순서: 승률 높은 순 → 이름순(U4). 공동 순위 번호는 그대로.
    """
    glist = list(games)
    wins = {k: 0 for k in participants}
    counts: dict[str, int] = {}
    for g in glist:
        for k in (*g.team1, *g.team2):
            counts[k] = counts.get(k, 0) + 1
        if g.winner:
            for k in g.team1 if g.winner == 1 else g.team2:
                wins[k] = wins.get(k, 0) + 1
    rows = [(k, w, counts.get(k, 0)) for k, w in wins.items()]
    rows.sort(key=lambda r: (-r[1], -(r[1] / r[2] if r[2] else 0.0), names.get(r[0], ""), r[0]))
    out: list[dict[str, object]] = []
    for key, w, n in rows:
        higher = sum(1 for x in rows if x[1] > w)
        same = sum(1 for x in rows if x[1] == w)
        out.append({"key": key, "wins": w, "games": n, "rank": higher + 1, "tied": same > 1})
    return out


# ── 대진 생성(I3-b) ──
# FE `schedule.ts` generateClubGames + `session/lineup.ts` rng·pairKey·matchupKey
#
# 같은 입력·시드·규칙 → TS와 같은 결과(골든 JSON 비교). 맞춘 조건:
# - mulberry32: 모든 정수 연산을 2^32 나머지로(JS Math.imul·>>>·^=의 ToInt32와 비트 단위로 같음)
# - 난수 호출 순서: 경기마다 시도(최대 60) → (팀전) 청 고르기 → 백 고르기 / (개인전) 4명 고르기,
#   고르기마다 '문턱과 같은 사람' 섞기(Fisher–Yates, 뒤에서부터 floor(r()*(i+1)))
# - 정렬: 안정 정렬(JS Array.prototype.sort와 같음), 문자열 키는 ASCII라 비교 결과 같음
# - 참가자 순서 = 입력 순서(서버는 club_match_participants.position)
# - 비용은 정수(1e12·1e9·1e6·1e3 배수, JS double에서도 2^53 안이라 정확)

MASK = 0xFFFFFFFF
MAX_ATTEMPTS = 60
COST_SAME = 10**12
COST_PARTNER = 10**9
COST_GENDER = 10**6
COST_BALANCE = 10**3


def rng(seed: int) -> Callable[[], float]:
    """mulberry32(lineup.ts `rng`)."""
    state = int(seed) & MASK

    def next_float() -> float:
        nonlocal state
        state = (state + 0x6D2B79F5) & MASK
        t = state
        t = ((t ^ (t >> 15)) * (t | 1)) & MASK
        t = (t ^ ((t + (((t ^ (t >> 7)) * (t | 61)) & MASK)) & MASK)) & MASK
        return ((t ^ (t >> 14)) & MASK) / 4294967296

    return next_float


def pair_key(a: str, b: str) -> str:
    return f"{a}|{b}" if a < b else f"{b}|{a}"


def matchup_key(t1: Sequence[str], t2: Sequence[str]) -> str:
    return "#".join(sorted([pair_key(t1[0], t1[1]), pair_key(t2[0], t2[1])]))


def _shuffle[T](items: list[T], r: Callable[[], float]) -> list[T]:
    a = list(items)
    for i in range(len(a) - 1, 0, -1):
        j = math.floor(r() * (i + 1))
        a[i], a[j] = a[j], a[i]
    return a


@dataclass(frozen=True)
class ClubPlayer:
    key: str
    gender: str | None  # 비식별화된 게스트는 None(대진 생성 대상이 아님)
    score: int
    team: Team | None = None


@dataclass
class ClubGame:
    no: int
    team1: tuple[str, str]
    team2: tuple[str, str]
    gender_relaxed: bool
    # U7: 앞선 경기와 같은 4명·같은 팀 구성(생성 시점 기준)
    repeated_matchup: bool = False


def gender_bad(t1: Sequence[ClubPlayer], t2: Sequence[ClubPlayer]) -> bool:
    """성별 조합 규칙(C-03) 위반: 남2·여2면 팀마다 남녀 1명씩(혼복), 남1·남3은 위반."""
    males = sum(1 for p in (*t1, *t2) if p.gender == "남")
    if males == 2:
        return (
            sum(1 for p in t1 if p.gender == "남") != 1
            or sum(1 for p in t2 if p.gender == "남") != 1
        )
    return males in (1, 3)


def _pick_lowest(
    pool: Sequence[ClubPlayer], k: int, counts: dict[str, int], r: Callable[[], float]
) -> list[ClubPlayer]:
    ordered = sorted(pool, key=lambda p: counts.get(p.key, 0))
    threshold = counts.get(ordered[k - 1].key, 0)
    must = [p for p in ordered if counts.get(p.key, 0) < threshold]
    tied = _shuffle([p for p in ordered if counts.get(p.key, 0) == threshold], r)
    return must + tied[: k - len(must)]


@dataclass
class _History:
    counts: dict[str, int]
    partners: dict[str, int]
    matchups: set[str]


def _cost(
    t1: Sequence[ClubPlayer], t2: Sequence[ClubPlayer], h: _History, balance: bool, gender: bool
) -> tuple[int, bool, bool]:
    same = matchup_key([p.key for p in t1], [p.key for p in t2]) in h.matchups
    rep = h.partners.get(pair_key(t1[0].key, t1[1].key), 0) + h.partners.get(
        pair_key(t2[0].key, t2[1].key), 0
    )
    bad = gender_bad(t1, t2)
    diff = abs(t1[0].score + t1[1].score - t2[0].score - t2[1].score)
    cost = (
        (COST_SAME if same else 0)
        + rep * COST_PARTNER
        + (COST_GENDER if gender and bad else 0)
        + (diff * COST_BALANCE if balance else 0)
    )
    return cost, same, bad


def _record(h: _History, t1: Sequence[ClubPlayer], t2: Sequence[ClubPlayer]) -> None:
    for p in (*t1, *t2):
        h.counts[p.key] = h.counts.get(p.key, 0) + 1
    for a, b in (t1, t2):
        k = pair_key(a.key, b.key)
        h.partners[k] = h.partners.get(k, 0) + 1
    h.matchups.add(matchup_key([p.key for p in t1], [p.key for p in t2]))


def generate_club_games(
    players: Sequence[ClubPlayer],
    total_games: int,
    method: Method,
    balance: bool,
    gender: bool,
    seed: int,
) -> list[ClubGame]:
    """전체 대진 생성(C-14·C-19, AC-043·073·075·076). 우선순위: 같은 4명·같은 팀(금지) >
    파트너 반복(최소화) > 성별 조합(켰을 때) > 밸런스(켰을 때). 인원 조건(U8)은 호출 전에 확인."""
    r = rng(seed)
    h = _History({}, {}, set())
    games: list[ClubGame] = []
    blues = [p for p in players if p.team == "blue"]
    whites = [p for p in players if p.team == "white"]
    for no in range(1, total_games + 1):
        best: tuple[list[ClubPlayer], list[ClubPlayer], int, bool, bool] | None = None
        for _ in range(MAX_ATTEMPTS):
            if method == "team":
                splits = [
                    (_pick_lowest(blues, 2, h.counts, r), _pick_lowest(whites, 2, h.counts, r))
                ]
            else:
                f = _pick_lowest(players, 4, h.counts, r)
                splits = [
                    ([f[0], f[1]], [f[2], f[3]]),
                    ([f[0], f[2]], [f[1], f[3]]),
                    ([f[0], f[3]], [f[1], f[2]]),
                ]
            for t1, t2 in splits:
                cost, same, bad = _cost(t1, t2, h, balance, gender)
                if best is None or cost < best[2]:
                    best = (t1, t2, cost, bad, same)
            if best is not None and best[2] == 0:
                break
        assert best is not None
        # 성별 탐색 보강(I3-c, FE와 같음): 60회 결과가 성별을 어기면
        # 경기 수 규칙을 지키는 모든 후보를 고정 순서로 훑어 비용이 더 낮은 것으로
        # (우선순위 그대로, 난수 추가 사용 없음)
        if gender and best[3]:
            for c1, c2 in _candidates(players, method, h.counts):
                cost, same, bad = _cost(c1, c2, h, balance, gender)
                if cost < best[2]:
                    best = (c1, c2, cost, bad, same)
        t1, t2, _, bad, same = best
        _record(h, t1, t2)
        games.append(
            ClubGame(
                no=no,
                team1=(t1[0].key, t1[1].key),
                team2=(t2[0].key, t2[1].key),
                gender_relaxed=gender and bad,
                repeated_matchup=same,
            )
        )
    return games


# ── 완화 검증(U7): 벌점이 붙었다는 사실만으로 '피할 수 없었다'고 하지 않음 ──
#
# 생성 시점의 상태(앞선 경기들의 경기 수·파트너·대진)에서, 경기 수 차이 ≤1 규칙(pick_lowest가
# 고를 수 있는 사람 조합 전체)을 지키는 모든 후보를 빠짐없이 세어 판정합니다.
# - exhausted: 규칙을 지키는 후보가 하나도 없음 → 불가피한 완화
# - higher_priority: (성별) 규칙을 지키는 후보는 있지만, 모두 더 높은 우선순위
#   (같은 대진·파트너 반복)에서 더 나쁨
# - search_limit: 규칙을 지키면서 우선순위도 같거나 나은 후보가 있었는데 60회 탐색에서 못 찾음
#   (= 알고리즘 한계. 발생하면 보고 대상)


def _feasible_sets(
    pool: Sequence[ClubPlayer], k: int, counts: dict[str, int]
) -> list[list[ClubPlayer]]:
    ordered = sorted(pool, key=lambda p: counts.get(p.key, 0))
    threshold = counts.get(ordered[k - 1].key, 0)
    must = [p for p in ordered if counts.get(p.key, 0) < threshold]
    tied = [p for p in ordered if counts.get(p.key, 0) == threshold]
    return [must + list(c) for c in combinations(tied, k - len(must))]


def _candidates(
    players: Sequence[ClubPlayer], method: Method, counts: dict[str, int]
) -> list[tuple[list[ClubPlayer], list[ClubPlayer]]]:
    if method == "team":
        blues = [p for p in players if p.team == "blue"]
        whites = [p for p in players if p.team == "white"]
        return [
            (b, w)
            for b in _feasible_sets(blues, 2, counts)
            for w in _feasible_sets(whites, 2, counts)
        ]
    out = []
    for f in _feasible_sets(players, 4, counts):
        out += [
            ([f[0], f[1]], [f[2], f[3]]),
            ([f[0], f[2]], [f[1], f[3]]),
            ([f[0], f[3]], [f[1], f[2]]),
        ]
    return out


def relaxations(
    players: Sequence[ClubPlayer],
    games: Sequence[ClubGame],
    method: Method,
    gender: bool,
) -> dict[int, list[Relaxation]]:
    """경기 번호 → 완화 목록. 완화가 없는 경기는 빠짐.

    rule: 'matchup'(같은 4명·같은 팀, U7) | 'gender'(성별 조합, C-03)
    reason: 'exhausted' | 'higher_priority' | 'search_limit'
    """
    by_key = {p.key: p for p in players}
    h = _History({}, {}, set())
    out: dict[int, list[Relaxation]] = {}
    for g in games:
        t1 = [by_key[k] for k in g.team1]
        t2 = [by_key[k] for k in g.team2]
        found: list[Relaxation] = []
        if g.repeated_matchup or (gender and g.gender_relaxed):
            cands = _candidates(players, method, h.counts)
            fresh = [(a, b) for a, b in cands if not _same(a, b, h)]
            if g.repeated_matchup:
                found.append(
                    {"rule": "matchup", "reason": "search_limit" if fresh else "exhausted"}
                )
            if gender and g.gender_relaxed:
                # 더 높은 우선순위(같은 대진 > 파트너 반복)가 같거나 나은 성별 정상 후보가 있었는가
                chosen = (int(g.repeated_matchup), _partner_repeats(t1, t2, h))
                ok = [(a, b) for a, b in cands if not gender_bad(a, b)]
                if not ok:
                    reason = "exhausted"
                elif any((int(_same(a, b, h)), _partner_repeats(a, b, h)) <= chosen for a, b in ok):
                    reason = "search_limit"
                else:
                    reason = "higher_priority"
                found.append({"rule": "gender", "reason": reason})
        if found:
            out[g.no] = found
        _record(h, t1, t2)
    return out


def _partner_repeats(t1: Sequence[ClubPlayer], t2: Sequence[ClubPlayer], h: _History) -> int:
    return h.partners.get(pair_key(t1[0].key, t1[1].key), 0) + h.partners.get(
        pair_key(t2[0].key, t2[1].key), 0
    )


def _same(t1: Sequence[ClubPlayer], t2: Sequence[ClubPlayer], h: _History) -> bool:
    return matchup_key([p.key for p in t1], [p.key for p in t2]) in h.matchups


# ── 교체 후 다시 계산(I3-c) ──


@dataclass
class GameState:
    """저장된 경기 상태(교체 반영 후). relaxations는 생성·이전 교체 때 저장한 사유."""

    no: int
    team1: tuple[str, str]
    team2: tuple[str, str]
    manual: bool
    gender_relaxed: bool
    repeated_matchup: bool
    relaxations: list[Relaxation]


def refresh_after_swap(
    games: Sequence[GameState],
    genders: Mapping[str, str | None],
    gender_rule: bool,
    forced_keys: frozenset[str] = frozenset(),
) -> None:
    """선수 교체·중도 귀가 뒤 플래그·사유 다시 계산(제자리 수정).

    - repeated_matchup: 모든 경기를 번호 순으로 다시(앞선 경기와 같은 4명·같은 팀이면 반복)
    - 같은 대진 반복 사유(I3-d P-4):
      - 일반 교체는 같은 대진을 만들 수 없음(서버가 409 same_matchup으로 거부)
      - 중도 귀가에서 서버가 '중복 없는 대체가 없다'고 검증한 대진(forced_keys) →
        'substitute_exhausted'
      - 원래 반복이던 경기(생성 시 소진 등)는 저장된 사유 유지, 반복이 풀렸으면 사유 삭제
      - 그 밖(이전 버전 데이터 등 방어용) → 'manual'
    - 교체한 경기(manual): 성별 완화도 다시 계산, 위반 사유는 'manual'(운영진이 고른 결과)
    - 교체하지 않은 경기: 성별은 그대로(선수가 같음)
    """
    seen: set[str] = set()

    def male(k: str) -> bool:
        return genders.get(k) == "남"

    for g in sorted(games, key=lambda x: x.no):
        key = matchup_key(g.team1, g.team2)
        repeated = key in seen
        seen.add(key)
        old_match = [x for x in g.relaxations if x["rule"] == "matchup"]
        old_gender = [x for x in g.relaxations if x["rule"] == "gender"]
        new: list[Relaxation] = []
        if repeated:
            if key in forced_keys:
                new.append({"rule": "matchup", "reason": "substitute_exhausted"})
            elif g.repeated_matchup and old_match:
                new += old_match
            else:
                new.append({"rule": "matchup", "reason": "manual"})
        if g.manual:
            males = sum(1 for k in (*g.team1, *g.team2) if male(k))
            t1m = sum(1 for k in g.team1 if male(k))
            t2m = sum(1 for k in g.team2 if male(k))
            bad = (t1m != 1 or t2m != 1) if males == 2 else males in (1, 3)
            g.gender_relaxed = gender_rule and bad
            if g.gender_relaxed:
                new.append({"rule": "gender", "reason": "manual"})
        else:
            new += old_gender
        g.repeated_matchup = repeated
        g.relaxations = new


# ── 중도 귀가 대체 판정(I3-d P-4-b) — FE schedule.ts substituteDecision과 같음(골든 JSON) ──

Seats = tuple[tuple[str, str], tuple[str, str]]


def sub_seat(seats: Seats, leaver: str, to: str) -> Seats:
    t1, t2 = seats
    return (
        (to if t1[0] == leaver else t1[0], to if t1[1] == leaver else t1[1]),
        (to if t2[0] == leaver else t2[0], to if t2[1] == leaver else t2[1]),
    )


def substitute_decision(
    seats: Mapping[int, Seats],
    leaver: str,
    picks: Mapping[int, str],
    candidates: Callable[[int], Iterable[str]],
) -> tuple[list[int], set[str]]:
    """최종 대진(모든 대체 반영) 기준 (피할 수 있는 중복 경기 번호, 불가피한 중복 대진 키).

    - 다른 경기와 같은 4명·같은 팀인데 그 경기에 중복 없는 다른 후보가 있음 → avoidable(거부)
    - 그 경기의 모든 후보가 중복 → forced(예외 허용, 사유 substitute_exhausted)
    """
    final = {no: sub_seat(s, leaver, picks[no]) if no in picks else s for no, s in seats.items()}
    keys = {no: matchup_key(*s) for no, s in final.items()}
    avoidable: list[int] = []
    forced: set[str] = set()
    for no in sorted(picks):
        others = {k for o, k in keys.items() if o != no}
        if keys[no] not in others:
            continue
        if any(matchup_key(*sub_seat(seats[no], leaver, c)) not in others for c in candidates(no)):
            avoidable.append(no)
        else:
            forced.add(keys[no])
    return avoidable, forced
