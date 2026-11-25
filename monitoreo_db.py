"""
=============================================================================
INGEDUCA CORP - Servicio de Monitoreo sobre Base de Datos Relacional
=============================================================================
Calcula las métricas del dashboard docente a partir de datos persistidos
(clases, matrículas, telemetría de conexión, intervenciones y consultas IA).
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from database import Clase, ConsultaChat, Intervencion, Matricula, Usuario, SessionLocal, ahora_utc

# Un estudiante se considera "conectado" si envió un ping en esta ventana.
VENTANA_CONEXION_S = int(os.getenv("VENTANA_CONEXION_S", "300"))
UMBRAL_ATENCION_BAJA = 40
UMBRAL_ATENCION_BUENA = 75


# ---------------------------------------------------------------------------
# UTILIDADES
# ---------------------------------------------------------------------------
def _utc(dt: Optional[datetime]) -> Optional[datetime]:
    """SQLite devuelve fechas sin zona horaria; las normalizamos a UTC."""
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def esta_conectado(m: Matricula, ahora: Optional[datetime] = None) -> bool:
    ping = _utc(m.ultimo_ping)
    if ping is None:
        return False
    return ((ahora or ahora_utc()) - ping).total_seconds() <= VENTANA_CONEXION_S


def etiqueta_atencion(pct: int) -> str:
    if pct < UMBRAL_ATENCION_BAJA:
        return "BAJA"
    if pct < UMBRAL_ATENCION_BUENA:
        return "REGULAR"
    return "BUENA"


def _duracion(delta: timedelta) -> str:
    minutos = max(0, int(delta.total_seconds() // 60))
    horas, minutos = divmod(minutos, 60)
    return f"{horas}h {minutos}m" if horas else f"{minutos}m"


def _estado_conexion(m: Matricula, conectado: bool, ahora: datetime) -> str:
    if m.en_acompanamiento:
        return "Acompañamiento Activo (IA)"
    if conectado:
        return "Conectado"
    ping = _utc(m.ultimo_ping)
    if ping is None:
        return "Sin conexión registrada"
    return f"Inactivo hace {_duracion(ahora - ping)}"


# ---------------------------------------------------------------------------
# SERIALIZACIÓN (mismo contrato JSON que la versión en memoria)
# ---------------------------------------------------------------------------
def serializar_estudiante(m: Matricula, dudas: int, ahora: Optional[datetime] = None) -> dict:
    ahora = ahora or ahora_utc()
    conectado = esta_conectado(m, ahora)
    desde = _utc(m.conectado_desde)
    return {
        "id": m.id,
        "nombre": m.nombre,
        "avatar": m.avatar_url or "",
        "clase": m.clase.materia if m.clase else "",
        "tiempoConexion": _duracion(ahora - desde) if conectado and desde else "0m",
        "dudasEmitidas": dudas,
        "atencion": etiqueta_atencion(m.atencion_pct),
        "estadoConexion": _estado_conexion(m, conectado, ahora),
        "promedio": round(m.promedio or 0.0, 1),
        "ultimoRefuerzo": m.ultimo_refuerzo,
    }


def _dudas_por_usuario(db: Session) -> dict[int, int]:
    filas = (
        db.query(ConsultaChat.usuario_id, func.count(ConsultaChat.id))
        .filter(ConsultaChat.usuario_id.isnot(None))
        .group_by(ConsultaChat.usuario_id)
        .all()
    )
    return {uid: total for uid, total in filas}


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------
def construir_dashboard(db: Session) -> dict:
    ahora = ahora_utc()
    clases = db.query(Clase).options(joinedload(Clase.docente)).order_by(Clase.id).all()
    matriculas = (
        db.query(Matricula).options(joinedload(Matricula.clase)).order_by(Matricula.id).all()
    )
    dudas = _dudas_por_usuario(db)

    por_clase: dict[int, list[Matricula]] = {}
    for m in matriculas:
        por_clase.setdefault(m.clase_id, []).append(m)

    clases_vivo = {c.id for c in clases if c.en_vivo}
    en_vivo = [m for m in matriculas if m.clase_id in clases_vivo]
    conectados = [m for m in en_vivo if esta_conectado(m, ahora)]
    desconectados = [
        m for m in en_vivo
        if not esta_conectado(m, ahora) or m.atencion_pct < UMBRAL_ATENCION_BAJA
    ]

    def promedio_atencion(ms: list[Matricula]) -> int:
        return round(sum(m.atencion_pct for m in ms) / len(ms)) if ms else 0

    clases_json = []
    for c in clases:
        conectados_c = [m for m in por_clase.get(c.id, []) if esta_conectado(m, ahora)]
        clases_json.append({
            "id": c.id,
            "materia": c.materia,
            "software": c.software,
            "sesionNumero": c.sesion_numero,
            "tema": c.tema,
            "asistentes": len(conectados_c),
            "interaccion": promedio_atencion(conectados_c),
            "enVivo": c.en_vivo,
            "docente": (c.docente.nombre if c.docente else None) or c.docente_nombre or "Sin asignar",
        })

    return {
        "metricas": {
            "total_asistentes": len(conectados),
            "desconectados": len(desconectados),
            "atencion_promedio": promedio_atencion(conectados),
            "dudas_resueltas": db.query(func.count(ConsultaChat.id)).scalar() or 0,
            "tasa_retencion": round(len(conectados) / len(en_vivo) * 100, 1) if en_vivo else 0.0,
            "clases_activas": len(clases_vivo),
        },
        "clases": clases_json,
        "estudiantes": [
            serializar_estudiante(m, dudas.get(m.usuario_id, 0), ahora) for m in matriculas
        ],
    }


# ---------------------------------------------------------------------------
# TELEMETRÍA (PING) E INTERVENCIONES
# ---------------------------------------------------------------------------
def registrar_ping(db: Session, m: Matricula, atencion: Optional[int], emocion: Optional[str]) -> Matricula:
    ahora = ahora_utc()
    if not esta_conectado(m, ahora) or m.conectado_desde is None:
        m.conectado_desde = ahora  # nueva sesión de conexión
    m.ultimo_ping = ahora
    if atencion is not None:
        m.atencion_pct = max(0, min(100, int(atencion)))
    if emocion:
        m.emocion = emocion[:50]
    db.commit()
    db.refresh(m)
    return m


def registrar_intervencion(db: Session, m: Matricula, accion: str, nota: str, docente_id: Optional[int]) -> Matricula:
    db.add(Intervencion(matricula_id=m.id, docente_id=docente_id, accion=accion, nota=nota or None))
    m.en_acompanamiento = True
    m.ultimo_refuerzo = accion
    db.commit()
    db.refresh(m)
    return m


def contar_dudas(db: Session, usuario_id: Optional[int]) -> int:
    if usuario_id is None:
        return 0
    return db.query(func.count(ConsultaChat.id)).filter(ConsultaChat.usuario_id == usuario_id).scalar() or 0


# ---------------------------------------------------------------------------
# CONSULTAS AL TUTOR IA
# ---------------------------------------------------------------------------
def guardar_consulta(
    *, usuario_email: Optional[str], rol: Optional[str], tema: Optional[str], software: Optional[str],
    mensaje: str, respuesta: str, sentimiento: Optional[str], nivel_duda: Optional[str],
    origen: str, tiempo_ms: Optional[int],
) -> None:
    """Persiste una consulta en su propia sesión (usable desde generadores SSE y hilos)."""
    db = SessionLocal()
    try:
        email = (usuario_email or "").strip().lower() or None
        usuario = db.query(Usuario).filter(Usuario.email == email).first() if email else None
        db.add(ConsultaChat(
            usuario_id=usuario.id if usuario else None,
            usuario_email=email,
            rol=rol,
            tema=(tema or "")[:255] or None,
            software=(software or "")[:100] or None,
            mensaje=mensaje,
            respuesta=respuesta,
            sentimiento=sentimiento,
            nivel_duda=nivel_duda,
            origen=origen,
            tiempo_ms=tiempo_ms,
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Base de Datos]: No se pudo guardar la consulta del tutor IA ({e})")
    finally:
        db.close()
