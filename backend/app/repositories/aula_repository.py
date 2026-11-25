from __future__ import annotations

import asyncio
from typing import Protocol

from app.core.exceptions import AulaNoEncontradaError
from app.domain.aula import Aula, EstadoAula


class AulaRepository(Protocol):
    async def guardar(self, aula: Aula) -> Aula: ...
    async def obtener(self, aula_id: str) -> Aula: ...
    async def listar(self, estado: EstadoAula | None = None) -> list[Aula]: ...
    async def eliminar(self, aula_id: str) -> None: ...


class InMemoryAulaRepository:
    def __init__(self) -> None:
        self._data: dict[str, Aula] = {}
        self._lock = asyncio.Lock()

    async def guardar(self, aula: Aula) -> Aula:
        async with self._lock:
            self._data[aula.id] = aula
            return aula

    async def obtener(self, aula_id: str) -> Aula:
        async with self._lock:
            try:
                return self._data[aula_id]
            except KeyError as exc:
                raise AulaNoEncontradaError(aula_id) from exc

    async def listar(self, estado: EstadoAula | None = None) -> list[Aula]:
        async with self._lock:
            aulas = list(self._data.values())
        return [a for a in aulas if estado is None or a.estado == estado]

    async def eliminar(self, aula_id: str) -> None:
        async with self._lock:
            if self._data.pop(aula_id, None) is None:
                raise AulaNoEncontradaError(aula_id)

