"""
=============================================================================
INGEDUCA CORP / AulaPredict - Modelos de Base de Datos Relacional (SQLAlchemy)
=============================================================================
Modelos oficiales para PostgreSQL 16 (eduguard_tesis_db) para tesis de grado.
Tablas requeridas:
  - usuarios: id, nombre, email (único), hashed_password, rol, created_at.
  - clases: id, titulo, docente_id, estado (activa, finalizada), fecha_inicio.
  - metricas_atencion: id, estudiante_id, clase_id, atencion_pct, estado, emocion, timestamp.
=============================================================================
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


def ahora_utc() -> datetime:
    """Retorna la fecha y hora actual en zona horaria UTC."""
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# TABLA 1: USUARIOS
# ---------------------------------------------------------------------------
class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    rol = Column(String(50), nullable=False)  # 'docente' o 'estudiante'
    created_at = Column(DateTime(timezone=True), default=ahora_utc, nullable=False)

    # Campos complementarios para compatibilidad con el ecosistema de la tesis
    especialidad = Column(String(150), nullable=True, default="Ingeniería Civil")
    activo = Column(Boolean, default=True, nullable=False)
    ultimo_acceso = Column(DateTime(timezone=True), nullable=True)

    @property
    def password_hash(self) -> str:
        """Alias para máxima compatibilidad con código existente."""
        return self.hashed_password

    @password_hash.setter
    def password_hash(self, value: str):
        self.hashed_password = value

    def to_dict(self) -> dict:
        """Serializa la entidad a diccionario seguro sin contraseñas."""
        return {
            "id": self.id,
            "nombre": self.nombre,
            "email": self.email,
            "correo": self.email,
            "rol": self.rol,
            "especialidad": self.especialidad or "Ingeniería Civil",
            "activo": self.activo,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "ultimo_acceso": self.ultimo_acceso.isoformat() if self.ultimo_acceso else None
        }


# ---------------------------------------------------------------------------
# TABLA 2: CLASES
# ---------------------------------------------------------------------------
class Clase(Base):
    __tablename__ = "clases"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    titulo = Column(String(255), nullable=False)
    docente_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True, index=True)
    estado = Column(String(50), default="activa", nullable=False)  # 'activa' o 'finalizada'
    fecha_inicio = Column(DateTime(timezone=True), default=ahora_utc, nullable=False)

    # Campos complementarios para los simuladores BIM y S10
    software = Column(String(150), nullable=True, default="Autodesk Revit 2026")
    sesion_numero = Column(Integer, nullable=True, default=1)
    tema = Column(String(255), nullable=True, default="")
    docente_nombre = Column(String(150), nullable=True)
    en_vivo = Column(Boolean, default=True, nullable=False)

    docente = relationship("Usuario", foreign_keys=[docente_id])
    metricas = relationship("MetricaAtencion", back_populates="clase", cascade="all, delete-orphan")
    matriculas = relationship("Matricula", back_populates="clase", cascade="all, delete-orphan")

    @property
    def materia(self) -> str:
        return self.titulo

    @materia.setter
    def materia(self, value: str):
        self.titulo = value


# ---------------------------------------------------------------------------
# TABLA 3: MÉTRICAS DE ATENCIÓN
# ---------------------------------------------------------------------------
class MetricaAtencion(Base):
    __tablename__ = "metricas_atencion"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    estudiante_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False, index=True)
    clase_id = Column(Integer, ForeignKey("clases.id", ondelete="CASCADE"), nullable=False, index=True)
    atencion_pct = Column(Float, nullable=False)  # Nivel de atención 0.0 - 100.0
    estado = Column(String(50), nullable=False)  # 'concentrado', 'distraido', 'fatiga'
    emocion = Column(String(50), nullable=False)  # 'feliz', 'neutral', 'triste'
    timestamp = Column(DateTime(timezone=True), default=ahora_utc, nullable=False)

    estudiante = relationship("Usuario", foreign_keys=[estudiante_id])
    clase = relationship("Clase", back_populates="metricas")


# ---------------------------------------------------------------------------
# TABLAS COMPLEMENTARIAS DEL ECOSISTEMA ACADÉMICO
# ---------------------------------------------------------------------------
class Matricula(Base):
    __tablename__ = "matriculas"
    __table_args__ = (UniqueConstraint("clase_id", "usuario_id", name="uq_matricula_clase_usuario"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    clase_id = Column(Integer, ForeignKey("clases.id", ondelete="CASCADE"), nullable=False, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True, index=True)
    nombre = Column(String(150), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    promedio = Column(Float, nullable=False, default=0.0)
    atencion_pct = Column(Integer, nullable=False, default=100)
    emocion = Column(String(50), nullable=True)
    conectado_desde = Column(DateTime(timezone=True), nullable=True)
    ultimo_ping = Column(DateTime(timezone=True), nullable=True)
    en_acompanamiento = Column(Boolean, nullable=False, default=False)
    ultimo_refuerzo = Column(String(255), nullable=True)
    creado_en = Column(DateTime(timezone=True), default=ahora_utc, nullable=False)

    clase = relationship("Clase", back_populates="matriculas")
    usuario = relationship("Usuario", foreign_keys=[usuario_id])
    intervenciones = relationship("Intervencion", back_populates="matricula", cascade="all, delete-orphan")


class Intervencion(Base):
    __tablename__ = "intervenciones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    matricula_id = Column(Integer, ForeignKey("matriculas.id", ondelete="CASCADE"), nullable=False, index=True)
    docente_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    accion = Column(String(255), nullable=False)
    nota = Column(Text, nullable=True)
    creado_en = Column(DateTime(timezone=True), default=ahora_utc, nullable=False)

    matricula = relationship("Matricula", back_populates="intervenciones")


class ConsultaChat(Base):
    __tablename__ = "consultas_chat"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True, index=True)
    usuario_email = Column(String(150), nullable=True, index=True)
    rol = Column(String(50), nullable=True)
    tema = Column(String(255), nullable=True)
    software = Column(String(100), nullable=True)
    mensaje = Column(Text, nullable=False)
    respuesta = Column(Text, nullable=False, default="")
    sentimiento = Column(String(100), nullable=True)
    nivel_duda = Column(String(100), nullable=True)
    origen = Column(String(20), nullable=False, default="gemini")
    tiempo_ms = Column(Integer, nullable=True)
    creado_en = Column(DateTime(timezone=True), default=ahora_utc, nullable=False, index=True)


# ---------------------------------------------------------------------------
# TABLA 6: INCIDENTES / ALERTAS DE AULA EN TIEMPO REAL
# ---------------------------------------------------------------------------
class IncidenteAula(Base):
    __tablename__ = "incidentes"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    aula_id = Column(String(100), nullable=False, index=True)  # ej. 'AULA-101'
    estudiante = Column(String(150), nullable=False, index=True)
    tipo_incidente = Column(String(100), nullable=False)  # 'fatiga', 'distraccion', 'inasistencia', 'abandono'
    incidente = Column(String(255), nullable=True)  # ej. 'Fatiga detectada por Visión IA'
    severidad = Column(String(50), nullable=False, default="ALTA")  # 'ALTA', 'MEDIA', 'BAJA'
    hora_registro = Column(String(50), nullable=True)  # 'HH:MM:SS'
    estado = Column(String(50), nullable=False, default="pendiente", index=True)  # 'pendiente', 'no atendido', 'atendido'
    metricas = Column(Text, nullable=True)  # JSON string con metricas: alumnos_conectados, atencion_promedio
    creado_en = Column(DateTime(timezone=True), default=ahora_utc, nullable=False, index=True)

    def to_dict(self) -> dict:
        import json
        metricas_obj = None
        if self.metricas:
            try:
                metricas_obj = json.loads(self.metricas)
            except Exception:
                metricas_obj = self.metricas
        return {
            "id": self.id,
            "tipo": "INCIDENTE_CONDUCTA",
            "aula_id": self.aula_id,
            "estudiante": self.estudiante,
            "tipo_incidente": self.tipo_incidente,
            "incidente": self.incidente or f"{self.tipo_incidente.capitalize()} detectada por Visión IA",
            "severidad": self.severidad,
            "hora": self.hora_registro or (self.creado_en.strftime("%H:%M:%S") if self.creado_en else ""),
            "hora_registro": self.hora_registro,
            "estado": self.estado,
            "metricas": metricas_obj or {},
            "creado_en": self.creado_en.isoformat() if self.creado_en else None
        }
