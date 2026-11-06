"""Import every ORM model here so Alembic autogenerate can discover them.

Example:
    from app.modules.example.models import Example  # noqa: F401
"""

from app.core.db import Base

__all__ = ["Base"]
