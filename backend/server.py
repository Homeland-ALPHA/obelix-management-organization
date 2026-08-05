import logging
import os

from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from auth_routes import router as auth_router
from buildings_routes import router as buildings_router
from dashboard_routes import router as dashboard_router
from db import client
from entities import router as entities_router
from finance_routes import router as finance_router
from overview_routes import router as overview_router
from violations_routes import router as violations_router

app = FastAPI(title="Obelix Property Management API")

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "Obelix Property Management API", "status": "ok"}


api_router.include_router(auth_router)
api_router.include_router(buildings_router)
api_router.include_router(dashboard_router)
api_router.include_router(entities_router)
api_router.include_router(finance_router)
api_router.include_router(overview_router)
api_router.include_router(violations_router)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
