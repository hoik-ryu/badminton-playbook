"""운영용 명령(서버·DB에 접근할 수 있는 사람만 실행).

최초 슈퍼 관리자 지정(ASM-015):
  1) 지정할 사람이 실제 카카오 로그인 → 가입 신청(승인 대기 상태가 됨)
  2) 서버에서 `python -m app.modules.user.cli list --status pending` 로 사용자 ID 확인
  3) `python -m app.modules.user.cli grant-super-admin <user_id>` → 승인 + 슈퍼 관리자
이메일·카카오 닉네임 같은 값으로 자동 부여하지 않습니다.
이미 슈퍼 관리자가 있으면 `--additional` 없이는 거부합니다.
Makefile: `make users status=pending`, `make super-admin id=<user_id>`
"""

import argparse
import sys
import uuid
from collections.abc import Sequence

from sqlalchemy import func, select

from app.core.db import get_sessionmaker
from app.modules.auth.deps import now_utc
from app.modules.user.models import STATUSES, User


def _list(status: str | None) -> int:
    with get_sessionmaker()() as db:
        query = select(User).order_by(User.created_at)
        if status:
            query = query.where(User.status == status)
        users = db.scalars(query).all()
        if not users:
            print("(없음)")
        for u in users:
            kakao = "카카오" if u.identities else "직접 추가"
            joined = f"{u.created_at:%Y-%m-%d %H:%M}"
            print(f"{u.id}  {u.status:<9} {u.role:<12} {u.name} ({kakao}, {joined})")
    return 0


def _grant(user_id: str, additional: bool) -> int:
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        print("사용자 ID 형식이 아닙니다(list 명령의 첫 열 UUID).", file=sys.stderr)
        return 2
    with get_sessionmaker()() as db:
        user = db.get(User, uid, with_for_update=True)
        if user is None:
            print("해당 사용자가 없습니다.", file=sys.stderr)
            return 1
        existing = db.scalar(
            select(func.count()).select_from(User).where(User.role == "super_admin")
        )
        if existing and user.role != "super_admin" and not additional:
            print(
                "이미 슈퍼 관리자가 있습니다. 추가로 지정하려면 --additional 을 붙이세요.",
                file=sys.stderr,
            )
            return 1
        if user.status in ("rejected", "inactive"):
            print(f"{user.status} 상태 사용자는 지정하지 않습니다.", file=sys.stderr)
            return 1
        user.role = "super_admin"
        if user.status != "approved":
            user.status = "approved"
            user.decided_at = now_utc()
        db.commit()
        print(f"슈퍼 관리자로 지정했습니다: {user.name} ({user.id})")
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.modules.user.cli")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p_list = sub.add_parser("list", help="사용자 목록")
    p_list.add_argument("--status", choices=STATUSES)
    p_grant = sub.add_parser("grant-super-admin", help="사용자를 승인하고 슈퍼 관리자로 지정")
    p_grant.add_argument("user_id")
    p_grant.add_argument("--additional", action="store_true", help="이미 있어도 추가 지정")
    args = parser.parse_args(argv)
    if args.cmd == "list":
        return _list(args.status)
    return _grant(args.user_id, args.additional)


if __name__ == "__main__":
    raise SystemExit(main())
