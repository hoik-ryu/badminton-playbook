.DEFAULT_GOAL := help
SHELL := /bin/bash

COMPOSE := docker compose
BE := cd backend &&
FE := cd frontend &&

.PHONY: help setup env dev up down logs ps migrate migration migrate-down users super-admin \
        test test-be test-fe test-db lint lint-be lint-fe typecheck typecheck-be typecheck-fe \
        format build check

help: ## 사용 가능한 명령 목록
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# ---------- Setup ----------
setup: env ## 로컬 의존성 설치 (uv, pnpm 필요)
	$(BE) uv sync --frozen
	$(FE) pnpm install --frozen-lockfile

env: ## .env.example 을 .env 로 복사 (이미 있으면 유지)
	@test -f .env || cp .env.example .env
	@test -f backend/.env || cp backend/.env.example backend/.env
	@test -f frontend/.env || cp frontend/.env.example frontend/.env

# ---------- Docker ----------
dev: env ## DB 기동 → 마이그레이션 → 전체 서비스 실행 (foreground)
	$(COMPOSE) up -d --wait db
	$(MAKE) migrate
	$(COMPOSE) up --build

up: env ## 전체 서비스 백그라운드 실행
	$(COMPOSE) up -d --build --wait

down: ## 컨테이너 중지
	$(COMPOSE) down

logs: ## 컨테이너 로그
	$(COMPOSE) logs -f

ps: ## 컨테이너 상태
	$(COMPOSE) ps

# ---------- Database ----------
migrate: ## Alembic 마이그레이션 적용 (upgrade head)
	$(COMPOSE) run --rm --build backend alembic upgrade head

migration: ## 새 마이그레이션 생성: make migration m="add example table"
	@test -n "$(m)" || (echo 'usage: make migration m="message"' && exit 1)
	$(COMPOSE) run --rm backend alembic revision --autogenerate -m "$(m)"

migrate-down: ## 마이그레이션 1단계 롤백
	$(COMPOSE) run --rm backend alembic downgrade -1

users: ## 사용자 목록: make users [status=pending]
	$(COMPOSE) run --rm backend python -m app.modules.user.cli list $(if $(status),--status $(status),)

super-admin: ## 최초 슈퍼 관리자 지정: make super-admin id=<사용자 UUID>
	@test -n "$(id)" || (echo 'usage: make super-admin id=<user uuid> (make users status=pending 으로 확인)' && exit 1)
	$(COMPOSE) run --rm backend python -m app.modules.user.cli grant-super-admin $(id)

# ---------- Quality ----------
test: test-be test-fe ## FE/BE 단위 테스트 (DB 불필요)

test-be: ## Backend 단위 테스트
	$(BE) uv run pytest

test-fe: ## Frontend 단위 테스트
	$(FE) pnpm test

test-db: ## 실제 PostgreSQL 연동 테스트 (Docker 필요). compose 내부 DB(db)만 TEST_DATABASE_URL로 허용
	$(COMPOSE) run --rm backend sh -c 'TEST_DATABASE_URL="$$DATABASE_URL" pytest -m db'

lint: lint-be lint-fe ## Lint (ruff, eslint)

lint-be:
	$(BE) uv run ruff check . && uv run ruff format --check .

lint-fe:
	$(FE) pnpm lint

typecheck: typecheck-be typecheck-fe ## 타입 검사 (mypy, tsc)

typecheck-be:
	$(BE) uv run mypy app tests

typecheck-fe:
	$(FE) pnpm typecheck

format: ## Backend 코드 포맷/자동 수정 (ruff)
	$(BE) uv run ruff format . && uv run ruff check --fix .

build: ## Frontend 프로덕션 빌드
	$(FE) pnpm build

check: lint typecheck test build ## CI와 동일한 로컬 품질 검사
