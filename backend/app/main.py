import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes import health, project
from app.db.database import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(name)s: %(message)s",
)

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-Driven Project Planning and Optimization System",
    version="0.1.0",
    debug=settings.DEBUG,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(project.router, prefix="/api/project", tags=["project"])



@app.on_event("startup")
async def startup_event():
    await init_db()
    print(f"🚀 {settings.APP_NAME} backend is running")