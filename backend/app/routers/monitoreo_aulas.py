from __future__ import annotations

import asyncio
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status

from app.api.deps import get_monitoreo_service
from app.core.config import get_settings
from app.core.exceptions import (
    AulaInactivaError,
    AulaNoEncontradaError,
    CapacidadExcedidaError,
    DomainError,
)
from app.domain.aula import Aula, AulaCreate, CambioEstado, EstadoAula, EstudianteIngreso, ResumenAula
from app.services.monitoreo_service import MonitoreoService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/aulas", tags=["Monitoreo de Aulas"])
Service = Annotated[MonitoreoService, Depends(get_monitoreo_service)]

_HTTP_MAP: dict[type[DomainError], int] = {
    AulaNoEncontradaError: status.HTTP_404_NOT_FOUND,
    AulaInactivaError: status.HTTP_409_CONFLICT,
    CapacidadExcedidaError: status.HTTP_409_CONFLICT,
}


def _http(exc: DomainError) -> HTTPException:
    return HTTPException(status_code=_HTTP_MAP.get(type(exc), status.HTTP_400_BAD_REQUEST), detail=str(exc))


@router.post("", response_model=Aula, status_code=status.HTTP_201_CREATED)
async def crear_aula(datos: AulaCreate, svc: Service) -> Aula:
    return await svc.crear_aula(datos)


@router.get("", response_model=list[Aula])
async def listar_aulas(svc: Service, estado: Annotated[EstadoAula | None, Query()] = None) -> list[Aula]:
    return await svc.listar(estado)


@router.get("/{aula_id}", response_model=Aula)
async def obtener_aula(aula_id: str, svc: Service) -> Aula:
    try:
        return await svc.obtener(aula_id)
    except DomainError as exc:
        raise _http(exc) from exc


@router.patch("/{aula_id}/estado", response_model=Aula)
async def cambiar_estado(aula_id: str, cambio: CambioEstado, svc: Service) -> Aula:
    try:
        return await svc.cambiar_estado(aula_id, cambio.estado)
    except DomainError as exc:
        raise _http(exc) from exc


@router.post("/{aula_id}/estudiantes", response_model=Aula)
async def ingresar_estudiante(aula_id: str, ingreso: EstudianteIngreso, svc: Service) -> Aula:
    try:
        return await svc.registrar_ingreso(aula_id, ingreso)
    except DomainError as exc:
        raise _http(exc) from exc


@router.delete("/{aula_id}/estudiantes/{estudiante_id}", response_model=Aula)
async def retirar_estudiante(aula_id: str, estudiante_id: str, svc: Service) -> Aula:
    try:
        return await svc.registrar_salida(aula_id, estudiante_id)
    except DomainError as exc:
        raise _http(exc) from exc


@router.get("/{aula_id}/resumen", response_model=ResumenAula)
async def resumen_aula(aula_id: str, svc: Service) -> ResumenAula:
    try:
        return await svc.resumen(aula_id)
    except DomainError as exc:
        raise _http(exc) from exc


@router.websocket("/{aula_id}/ws")
async def stream_resumen(websocket: WebSocket, aula_id: str) -> None:
    """Push periódico del ResumenAula al dashboard."""
    svc = get_monitoreo_service()
    intervalo = get_settings().ws_intervalo_s
    await websocket.accept()
    try:
        while True:
            resumen = await svc.resumen(aula_id)
            await websocket.send_json(resumen.model_dump(mode="json"))
            await asyncio.sleep(intervalo)
    except AulaNoEncontradaError as exc:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason=str(exc))
    except WebSocketDisconnect:
        logger.info("Dashboard desconectado del aula %s", aula_id)
    except Exception:
        logger.exception("Error en stream del aula %s", aula_id)
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)

