from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.repositories.aula_repository import InMemoryAulaRepository
from app.services.gemini_agent import GeminiAgent
from app.services.monitoreo_service import MonitoreoService


@lru_cache(maxsize=1)
def get_aula_repository() -> InMemoryAulaRepository:
    return InMemoryAulaRepository()


@lru_cache(maxsize=1)
def get_monitoreo_service() -> MonitoreoService:
    return MonitoreoService(get_aula_repository(), get_settings())


@lru_cache(maxsize=1)
def get_gemini_agent() -> GeminiAgent:
    return GeminiAgent(get_settings())

