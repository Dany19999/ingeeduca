from __future__ import annotations

import logging
from typing import Final

from google import genai
from google.genai import errors as genai_errors
from pydantic import BaseModel, Field
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import Settings
from app.core.exceptions import GeminiServiceError
from app.domain.aula import Emocion, NivelAtencion

logger = logging.getLogger(__name__)

_EMOCIONES_INTERVENCION: Final[frozenset[Emocion]] = frozenset(
    {Emocion.FRUSTRADO, Emocion.CONFUNDIDO, Emocion.ABURRIDO}
)

_SYSTEM_BASE: Final[str] = """\
Eres el Agente de Acompañamiento Académico de INGEEDUCACORP.
Audiencia: profesionales del sector construcción (ingenieros civiles, arquitectos, técnicos).
Ámbito permitido: Revit, S10, AutoCAD, Civil 3D, Navisworks, RNE (E.060, E.030, E.020, G.050),
metrados, APU, expedientes técnicos.
Reglas:
- Rechaza con cortesía cualquier tema fuera del ámbito.
- Respuestas breves, técnicas, en español, con pasos numerados cuando sea un procedimiento.
- Adapta el tono al estado emocional detectado del estudiante sin mencionarle que es monitoreado por cámara.
"""


class ContextoVision(BaseModel):
    estudiante_id: str
    nombre: str
    curso: str
    tema_actual: str = ""
    emocion: Emocion = Emocion.NEUTRAL
    atencion: float = Field(default=1.0, ge=0.0, le=1.0)
    nivel: NivelAtencion = NivelAtencion.ALTA


class RespuestaAgente(BaseModel):
    texto: str
    interaction_id: str | None
    modelo: str
    proactiva: bool = False


class GeminiAgent:
    def __init__(self, settings: Settings) -> None:
        if not settings.gemini_api_key:
            raise GeminiServiceError("GEMINI_API_KEY no configurada")
        self._client = genai.Client(api_key=settings.gemini_api_key)
        self._model = settings.gemini_model
        self._timeout = settings.gemini_timeout_s

    async def responder(
        self,
        mensaje: str,
        contexto: ContextoVision,
        previous_interaction_id: str | None = None,
    ) -> RespuestaAgente:
        texto, interaction_id = await self._invocar(
            entrada=mensaje,
            system=self._system_instruction(contexto),
            previous_interaction_id=previous_interaction_id,
        )
        return RespuestaAgente(texto=texto, interaction_id=interaction_id, modelo=self._model)

    async def intervenir_proactivamente(
        self, contexto: ContextoVision
    ) -> RespuestaAgente | None:
        if not self.requiere_intervencion(contexto):
            return None
        disparador = (
            f"[EVENTO_SISTEMA] El estudiante muestra '{contexto.emocion.value}' "
            f"con atención {contexto.atencion:.0%} durante el tema '{contexto.tema_actual}'. "
            "Redacta un mensaje corto (máx. 3 líneas) ofreciendo ayuda concreta sobre el tema."
        )
        texto, interaction_id = await self._invocar(
            entrada=disparador, system=self._system_instruction(contexto)
        )
        return RespuestaAgente(
            texto=texto, interaction_id=interaction_id, modelo=self._model, proactiva=True
        )

    @staticmethod
    def requiere_intervencion(ctx: ContextoVision) -> bool:
        return ctx.emocion in _EMOCIONES_INTERVENCION or ctx.nivel is NivelAtencion.BAJA

    async def _invocar(
        self,
        entrada: str,
        system: str,
        previous_interaction_id: str | None = None,
    ) -> tuple[str, str | None]:
        kwargs: dict[str, object] = {
            "model": self._model,
            "input": entrada,
            "system_instruction": system,  # interaction-scoped: se reenvía cada turno
            "generation_config": {"temperature": 0.3, "max_output_tokens": 1024},
        }
        if previous_interaction_id:
            kwargs["previous_interaction_id"] = previous_interaction_id

        try:
            async for intento in AsyncRetrying(
                retry=retry_if_exception_type(genai_errors.ServerError),
                stop=stop_after_attempt(3),
                wait=wait_exponential(multiplier=0.5, max=4),
                reraise=True,
            ):
                with intento:
                    interaction = await self._client.aio.interactions.create(
                        timeout=self._timeout, **kwargs
                    )
        except genai_errors.ClientError as exc:
            logger.warning("Gemini ClientError: %s", exc)
            raise GeminiServiceError(f"Solicitud inválida al LLM: {exc}") from exc
        except genai_errors.APIError as exc:
            logger.error("Gemini APIError: %s", exc)
            raise GeminiServiceError("LLM no disponible temporalmente") from exc
        except Exception as exc:  # timeout / red
            logger.exception("Fallo de red con Gemini")
            raise GeminiServiceError("Error de conexión con el LLM") from exc

        texto = (interaction.output_text or "").strip()
        if not texto:
            raise GeminiServiceError("El LLM devolvió una respuesta vacía")
        return texto, getattr(interaction, "id", None)

    @staticmethod
    def _system_instruction(ctx: ContextoVision) -> str:
        return (
            f"{_SYSTEM_BASE}\n"
            f"CONTEXTO_CLASE: curso='{ctx.curso}', tema='{ctx.tema_actual}'.\n"
            f"CONTEXTO_ESTUDIANTE: nombre='{ctx.nombre}', emocion='{ctx.emocion.value}', "
            f"atencion={ctx.atencion:.2f}, nivel='{ctx.nivel.value}'."
        )

