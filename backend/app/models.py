"""Import every ORM model here so Alembic autogenerate can discover them."""

from app.core.db import Base
from app.modules.auth.models import AuthSession
from app.modules.clubmatch.models import (
    ClubMatch,
    ClubMatchGame,
    ClubMatchGamePlayer,
    ClubMatchParticipant,
)
from app.modules.roster.models import Guest, MemberRating
from app.modules.tutorial.models import TutorialProgress
from app.modules.user.models import User, UserIdentity

__all__ = [
    "AuthSession",
    "Base",
    "ClubMatch",
    "ClubMatchGame",
    "ClubMatchGamePlayer",
    "ClubMatchParticipant",
    "Guest",
    "MemberRating",
    "TutorialProgress",
    "User",
    "UserIdentity",
]
