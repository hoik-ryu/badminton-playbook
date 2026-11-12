from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.dbguard import check_test_database_url
from app.core.errors import register_error_handlers
from app.modules.auth.security import signing_key


def create_app() -> FastAPI:
    settings = get_settings()
    signing_key(settings)  # 로컬 밖에서 SESSION_SECRET이 없으면 시작하지 않음
    if settings.app_env == "e2e":
        # E2E 서버는 임시 테스트 DB에만 연결(원본 smapsh·Neon이면 시작하지 않음)
        check_test_database_url(settings.database_url, source="DATABASE_URL(APP_ENV=e2e)")
    app = FastAPI(title=settings.app_name, version=settings.app_version)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)
    app.include_router(api_router)
    return app


app = create_app()
