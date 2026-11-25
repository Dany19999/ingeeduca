from __future__ import annotations

from collections import Counter

from app.core.config import Settings
from app.core.exceptions import AulaInactivaError, CapacidadExcedidaError
from app.domain.aula import (
    AlertaAula,
    Aula,
    AulaCreate,
    Emocion,
    EstadoAula,
    EstudianteIngreso,
    MetricaEstudiante,
    NivelAtencion,
    ResumenAula,
)
from app.repositories.aula_repository import AulaRepository

_EMOCIONES_CRITICAS: frozenset[Emocion] = frozenset({Emocion.FRUSTRADO, Emocion.CONFUNDIDO})


class MonitoreoService:
    def __init__(self, repo: AulaRepository, settings: Settings) -> None:
        self._repo = repo
        self._s = settings

    async def crear_aula(self, datos: AulaCreate) -> Aula:
        return await self._repo.guardar(Aula(**datos.model_dump()))

    async def listar(self, estado: EstadoAula | None) -> list[Aula]:
        return await self._repo.listar(estado)

    async def obtener(self, aula_id: str) -> Aula:
        return await self._repo.obtener(aula_id)

    async def cambiar_estado(self, aula_id: str, estado: EstadoAula) -> Aula:
        aula = await self._repo.obtener(aula_id)
        cambios: dict[str, object] = {"estado": estado}
        if estado is EstadoAula.FINALIZADA:
            cambios["estudiantes"] = {}
        return await self._repo.guardar(aula.model_copy(update=cambios))

    async def registrar_ingreso(self, aula_id: str, ingreso: EstudianteIngreso) -> Aula:
        aula = await self._repo.obtener(aula_id)
        if aula.estado is not EstadoAula.ACTIVA:
            raise AulaInactivaError(aula_id)
        if ingreso.estudiante_id not in aula.estudiantes and len(aula.estudiantes) >= aula.capacidad:
            raise CapacidadExcedidaError(aula_id, aula.capacidad)
        estudiantes = {
            **aula.estudiantes,
            ingreso.estudiante_id: MetricaEstudiante(
                estudiante_id=ingreso.estudiante_id, nombre=ingreso.nombre, atencion=1.0
            ),
        }
        return await self._repo.guardar(aula.model_copy(update={"estudiantes": estudiantes}))

    async def registrar_salida(self, aula_id: str, estudiante_id: str) -> Aula:
        aula = await self._repo.obtener(aula_id)
        estudiantes = {k: v for k, v in aula.estudiantes.items() if k != estudiante_id}
        return await self._repo.guardar(aula.model_copy(update={"estudiantes": estudiantes}))

    async def actualizar_metrica(self, aula_id: str, metrica: MetricaEstudiante) -> Aula:
        """Punto de entrada del motor de visión."""
        aula = await self._repo.obtener(aula_id)
        if aula.estado is not EstadoAula.ACTIVA:
            raise AulaInactivaError(aula_id)
        metrica = metrica.model_copy(update={"nivel": self.clasificar(metrica.atencion)})
        estudiantes = {**aula.estudiantes, metrica.estudiante_id: metrica}
        return await self._repo.guardar(aula.model_copy(update={"estudiantes": estudiantes}))

    async def resumen(self, aula_id: str) -> ResumenAula:
        aula = await self._repo.obtener(aula_id)
        metricas = list(aula.estudiantes.values())
        total = len(metricas)
        promedio = round(sum(m.atencion for m in metricas) / total, 3) if total else 0.0
        return ResumenAula(
            aula_id=aula.id,
            nombre=aula.nombre,
            estado=aula.estado,
            total_conectados=total,
            atencion_promedio=promedio,
            distribucion_emociones=dict(Counter(m.emocion for m in metricas)),
            alertas=[a for m in metricas if (a := self._evaluar_alerta(m)) is not None],
        )

    def clasificar(self, atencion: float) -> NivelAtencion:
        if atencion < self._s.umbral_atencion_baja:
            return NivelAtencion.BAJA
        if atencion < self._s.umbral_atencion_media:
            return NivelAtencion.MEDIA
        return NivelAtencion.ALTA

    def _evaluar_alerta(self, m: MetricaEstudiante) -> AlertaAula | None:
        if m.emocion is Emocion.AUSENTE:
            motivo, sev = "Estudiante fuera de cámara", NivelAtencion.BAJA
        elif m.emocion in _EMOCIONES_CRITICAS:
            motivo, sev = f"Estado emocional: {m.emocion.value}", NivelAtencion.BAJA
        elif m.nivel is NivelAtencion.BAJA:
            motivo, sev = f"Atención baja ({m.atencion:.0%})", NivelAtencion.MEDIA
        else:
            return None
        return AlertaAula(estudiante_id=m.estudiante_id, nombre=m.nombre, motivo=motivo, severidad=sev)

