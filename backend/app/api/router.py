from fastapi import APIRouter

from app.api.routes import health

api_router = APIRouter()
api_router.include_router(health.router)

# Register domain module routers here, e.g.:
# from app.modules.example.router import router as example_router
# api_router.include_router(example_router, prefix="/api/examples")
