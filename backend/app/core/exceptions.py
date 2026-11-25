class DomainError(Exception):
    """Base para errores de dominio."""


class AulaNoEncontradaError(DomainError):
    def __init__(self, aula_id: str) -> None:
        super().__init__(f"Aula '{aula_id}' no encontrada")


class AulaInactivaError(DomainError):
    def __init__(self, aula_id: str) -> None:
        super().__init__(f"Aula '{aula_id}' no está activa")


class CapacidadExcedidaError(DomainError):
    def __init__(self, aula_id: str, capacidad: int) -> None:
        super().__init__(f"Aula '{aula_id}' alcanzó su capacidad máxima ({capacidad})")


class GeminiServiceError(DomainError):
    """Fallo al comunicarse con el LLM."""

