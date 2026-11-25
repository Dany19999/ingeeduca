from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache


@dataclass(frozen=True, slots=True)
class Settings:
    app_name: str = "INGEEDUCACORP - Monitoreo de Clases"
    api_prefix: str = "/api/v1"
    cors_origins: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        )
    )
    gemini_api_key: str | None = field(
        default_factory=lambda: os.getenv("GEMINI_API_KEY", "")
    )
    gemini_model: str = field(default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-3.6-flash"))
    gemini_timeout_s: float = field(default_factory=lambda: float(os.getenv("GEMINI_TIMEOUT_S", "30")))
    umbral_atencion_baja: float = 0.40
    umbral_atencion_media: float = 0.70
    ws_intervalo_s: float = 2.0


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

