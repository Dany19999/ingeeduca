from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


class EstadoAula(StrEnum):
    ACTIVA = "activa"
    INACTIVA = "inactiva"
    FINALIZADA = "finalizada"


class NivelAtencion(StrEnum):
    ALTA = "alta"
    MEDIA = "media"
    BAJA = "baja"


class Emocion(StrEnum):
    CONCENTRADO = "concentrado"
    NEUTRAL = "neutral"
    CONFUNDIDO = "confundido"
    FRUSTRADO = "frustrado"
    ABURRIDO = "aburrido"
    AUSENTE = "ausente"


class MetricaEstudiante(BaseModel):
    model_config = ConfigDict(frozen=True)

    estudiante_id: str
    nombre: str
    atencion: float = Field(ge=0.0, le=1.0)
    emocion: Emocion = Emocion.NEUTRAL
    nivel: NivelAtencion = NivelAtencion.MEDIA
    actualizado_en: datetime = Field(default_factory=_ahora)


class AulaCreate(BaseModel):
    nombre: str = Field(min_length=3, max_length=120)
    curso: str = Field(min_length=2, max_length=120)
    tema_actual: str = Field(default="", max_length=200)
    docente_id: str
    capacidad: int = Field(default=50, ge=1, le=500)


class Aula(AulaCreate):
    id: str = Field(default_factory=lambda: uuid4().hex[:12])
    estado: EstadoAula = EstadoAula.INACTIVA
    creada_en: datetime = Field(default_factory=_ahora)
    estudiantes: dict[str, MetricaEstudiante] = Field(default_factory=dict)


class EstudianteIngreso(BaseModel):
    estudiante_id: str
    nombre: str = Field(min_length=2, max_length=120)


class CambioEstado(BaseModel):
    estado: EstadoAula


class AlertaAula(BaseModel):
    estudiante_id: str
    nombre: str
    motivo: str
    severidad: NivelAtencion
    emitida_en: datetime = Field(default_factory=_ahora)


class ResumenAula(BaseModel):
    aula_id: str
    nombre: str
    estado: EstadoAula
    total_conectados: int
    atencion_promedio: float
    distribucion_emociones: dict[Emocion, int]
    alertas: list[AlertaAula]
    generado_en: datetime = Field(default_factory=_ahora)

