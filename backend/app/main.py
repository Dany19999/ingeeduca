from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import monitoreo_aulas

settings = get_settings()
app = FastAPI(title=settings.app_name, version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(monitoreo_aulas.router, prefix=settings.api_prefix)


@app.get("/health", tags=["Sistema"])
async def health() -> dict[str, str]:
    return {"status": "ok", "modelo": settings.gemini_model}

