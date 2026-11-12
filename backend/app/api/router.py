from fastapi import APIRouter

from app.api.routes import health
from app.modules.approval.router import router as approval_router
from app.modules.auth.router import router as auth_router
from app.modules.clubmatch.member import record_router as my_record_router
from app.modules.clubmatch.member import router as clubmatch_member_router
from app.modules.clubmatch.router import router as clubmatch_router
from app.modules.role.router import router as role_router
from app.modules.roster.router import router as roster_router
from app.modules.tutorial.router import router as tutorial_router
from app.modules.user.router import router as user_router

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth_router)
api_router.include_router(approval_router)
api_router.include_router(role_router)
api_router.include_router(user_router)
api_router.include_router(roster_router)
api_router.include_router(tutorial_router)
api_router.include_router(clubmatch_router)
api_router.include_router(clubmatch_member_router)
api_router.include_router(my_record_router)
