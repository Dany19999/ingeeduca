"""
=============================================================================
INGEDUCA CORP / AulaPredict - Módulo de Conexión a Base de Datos (PostgreSQL)
=============================================================================
Conexión oficial con SQLAlchemy para PostgreSQL 16:
  postgresql://postgres:dany2005@localhost:5432/eduguard_tesis_db
Incluye autenticación Bcrypt y generación de tokens JWT (HS256).
=============================================================================
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
import bcrypt
import jwt

# Importar modelos oficiales desde models.py
from models import (
    Base,
    Usuario,
    Clase,
    MetricaAtencion,
    Matricula,
    Intervencion,
    ConsultaChat,
    IncidenteAula,
    ahora_utc
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------------------
# CARGA DE VARIABLES DE ENTORNO
# ---------------------------------------------------------------------------
def cargar_env_local(env_path: Optional[str] = None) -> None:
    env_path = env_path or os.path.join(BASE_DIR, ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k and k not in os.environ:
                    os.environ[k] = v


cargar_env_local()


# ---------------------------------------------------------------------------
# CADENA DE CONEXIÓN OFICIAL A POSTGRESQL 16
# ---------------------------------------------------------------------------
# Cadena requerida: postgresql://postgres:dany2005@localhost:5432/eduguard_tesis_db
DEFAULT_POSTGRES_URL = "postgresql://postgres:dany2005@localhost:5432/eduguard_tesis_db"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_POSTGRES_URL)

# Asegurar compatibilidad de driver si viene con postgres:// (Render) o con sqlite
# Soporta tanto psycopg (v3) como psycopg2
if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    elif DATABASE_URL.startswith("sqlite"):
        DATABASE_URL = DEFAULT_POSTGRES_URL
else:
    DATABASE_URL = DEFAULT_POSTGRES_URL

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ---------------------------------------------------------------------------
# SEGURIDAD CRIPTOGRÁFICA (BCRYPT & JWT)
# ---------------------------------------------------------------------------
JWT_SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY",
    "INGEEDUCA_CAMPUS_VIRTUAL_SUPER_SECRET_KEY_PROD_2026_THESIS_SECURITY_KEY_32BYTES"
)
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24


def hashear_password(password: str) -> str:
    """Genera hash Bcrypt seguro con sal aleatoria (12 rounds)."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verificar_password(password: str, password_hash: str) -> bool:
    """Verifica si la contraseña en texto plano coincide con el hash almacenado."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def crear_access_token(usuario: Usuario, horas_validez: int = JWT_EXPIRATION_HOURS) -> str:
    """Genera un token JWT firmado criptográficamente para la sesión."""
    ahora = datetime.now(timezone.utc)
    expiracion = ahora + timedelta(hours=horas_validez)
    payload = {
        "sub": str(usuario.id),
        "id": usuario.id,
        "email": usuario.email,
        "nombre": usuario.nombre,
        "rol": usuario.rol,
        "iat": int(ahora.timestamp()),
        "exp": int(expiracion.timestamp())
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decodificar_token(token: str) -> Optional[dict]:
    """Decodifica y valida la firma y expiración del token JWT."""
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except (jwt.PyJWTError, Exception):
        return None


# ---------------------------------------------------------------------------
# DEPENDENCIAS Y FUNCIONES DE INICIALIZACIÓN
# ---------------------------------------------------------------------------
def get_db() -> Generator[Session, None, None]:
    """Generador de sesiones de base de datos para inyección de dependencias en FastAPI."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def inicializar_base_datos():
    """
    1. Ejecuta Base.metadata.create_all(bind=engine) para crear las tablas en PostgreSQL.
    2. Inserta dos usuarios semilla institucionales si no existen:
       - Docente: docente@ingeeduca.edu.pe con contraseña password123 (rol: docente)
       - Estudiante: estudiante@ingeeduca.edu.pe con contraseña password123 (rol: estudiante)
    """
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 1. Semilla Docente
        docente = db.query(Usuario).filter(Usuario.email == "docente@ingeeduca.edu.pe").first()
        if not docente:
            docente = Usuario(
                nombre="Mg. Ing. Víctor Huamán",
                email="docente@ingeeduca.edu.pe",
                hashed_password=hashear_password("password123"),
                rol="docente",
                especialidad="Modelado BIM, Revit 2026 & Estructuras",
                activo=True
            )
            db.add(docente)
            db.commit()
            db.refresh(docente)
            print("[PostgreSQL] Usuario Docente creado: docente@ingeeduca.edu.pe (password123)")

        # 2. Semilla Estudiante
        estudiante = db.query(Usuario).filter(Usuario.email == "estudiante@ingeeduca.edu.pe").first()
        if not estudiante:
            estudiante = Usuario(
                nombre="Bach. María Paucar",
                email="estudiante@ingeeduca.edu.pe",
                hashed_password=hashear_password("password123"),
                rol="estudiante",
                especialidad="Costos y Presupuestos S10",
                activo=True
            )
            db.add(estudiante)
            db.commit()
            db.refresh(estudiante)
            print("[PostgreSQL] Usuario Estudiante creado: estudiante@ingeeduca.edu.pe (password123)")

        # 3. Semilla Clases de Especialidad en Ingeniería Civil
        clase1 = db.query(Clase).filter(Clase.titulo.ilike("%Modelado Estructural con Revit 2026%")).first()
        if not clase1:
            clase1 = Clase(
                titulo="Modelado Estructural con Revit 2026",
                software="Autodesk Revit 2026",
                tema="Modelado y Armado de Elementos Estructurales",
                docente_id=docente.id if docente else None,
                docente_nombre=docente.nombre if docente else "Mg. Ing. Víctor Huamán",
                estado="activa",
                en_vivo=True,
                fecha_inicio=ahora_utc()
            )
            db.add(clase1)

        clase2 = db.query(Clase).filter(Clase.titulo.ilike("%Diseño Geométrico de Vías con Civil 3D%")).first()
        if not clase2:
            clase2 = Clase(
                titulo="Diseño Geométrico de Vías con Civil 3D",
                software="AutoCAD Civil 3D",
                tema="Alineamientos y Secciones Transversales",
                docente_id=docente.id if docente else None,
                docente_nombre=docente.nombre if docente else "Mg. Ing. Víctor Huamán",
                estado="activa",
                en_vivo=True,
                fecha_inicio=ahora_utc()
            )
            db.add(clase2)
        db.commit()

        print(f"[PostgreSQL]: Base de datos 'eduguard_tesis_db', usuarios y salas oficiales listos.")
    except Exception as e:
        db.rollback()
        print(f"[PostgreSQL Error]: Error al inicializar semillas: {e}")
    finally:
        db.close()
