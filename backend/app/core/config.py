from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

# 개발용 운영진 로그인을 켤 수 있는 환경.
# e2e는 서버 시작 시 테스트 DB 검사를 통과해야 함(app/main.py)
DEV_LOGIN_ENVS = frozenset({"local", "e2e"})


class Settings(BaseSettings):
    """Application settings loaded from environment variables (and an optional .env file)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "badminton-playbook"
    app_env: str = "local"
    app_version: str = "0.1.0"

    database_url: str = "postgresql+psycopg://app:app@localhost:5432/app"
    # Comma-separated list of allowed CORS origins. Also used for the CSRF Origin check.
    cors_origins: str = "http://localhost:5173"

    # --- Kakao OAuth (values live only in backend/.env) ---
    kakao_rest_api_key: SecretStr = SecretStr("")
    kakao_client_secret: SecretStr = SecretStr("")
    # Must equal the URI registered in the Kakao console (served through the Vite proxy locally).
    kakao_redirect_uri: str = "http://localhost:5173/api/auth/kakao/callback"

    # --- App session ---
    # Signs the short-lived OAuth state / signup-ticket cookies. Required outside local.
    session_secret: SecretStr = SecretStr("")
    session_ttl_days: int = 30
    # True in any HTTPS environment. Local http://localhost must stay False.
    session_cookie_secure: bool = False

    # --- 개발용 운영진 ID/PW 로그인(로컬 전용) ---
    # 기본 꺼짐. APP_ENV=local·e2e 일 때만 켤 수 있음(그 밖에서 켜면 서버가 시작하지 않음).
    # e2e는 임시 테스트 DB에만 연결할 수 있음(app/core/dbguard.py).
    dev_login_enabled: bool = False
    dev_admin_username: str = ""
    dev_admin_password: SecretStr = SecretStr("")

    @property
    def dev_login_active(self) -> bool:
        return (
            self.dev_login_enabled
            and self.app_env in DEV_LOGIN_ENVS
            and bool(self.dev_admin_username)
            and bool(self.dev_admin_password.get_secret_value())
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def kakao_configured(self) -> bool:
        return bool(self.kakao_rest_api_key.get_secret_value() and self.kakao_redirect_uri)


@lru_cache
def get_settings() -> Settings:
    return Settings()
