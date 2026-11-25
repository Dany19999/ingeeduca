"""
=============================================================================
INGEDUCA CORP - Router Oficial de Autenticación con Base de Datos
=============================================================================
Implementación para arquitectura modular y defensa de tesis de grado.
Valida contra base de datos relacional y genera tokens seguros JWT (HS256).
"""

from datetime import datetime, timezone
from enum import StrEnum
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

import database
from database import (
    get_db,
    Usuario,
    hashear_password,
    verificar_password,
    crear_access_token
)

router = APIRouter(prefix="/auth", tags=["Autenticación"])

class RolUsuario(StrEnum):
    DOCENTE = "docente"
    ESTUDIANTE = "estudiante"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    rol: Optional[RolUsuario] = None

class RegistroRequest(BaseModel):
    nombre: str
    email: EmailStr
    password: str
    rol: RolUsuario = RolUsuario.ESTUDIANTE
    especialidad: Optional[str] = "Ingeniería Civil"

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    id: int
    rol: str
    nombre: str
    email: str
    correo: str
    especialidad: Optional[str] = None

@app_router := router

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def registrar(datos: RegistroRequest, db: Session = Depends(get_db)):
    """Registra un nuevo usuario en la base de datos relacional verificando email único."""
    email_limpio = datos.email.strip().lower()
    if len(datos.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe contener al menos 6 caracteres."
        )

    existente = db.query(Usuario).filter(Usuario.email == email_limpio).first()
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El correo '{email_limpio}' ya está registrado en la institución."
        )

    nuevo = Usuario(
        nombre=datos.nombre.strip(),
        email=email_limpio,
        password_hash=hashear_password(datos.password),
        rol=datos.rol.value,
        especialidad=datos.especialidad.strip() if datos.especialidad else "Ingeniería Civil",
        activo=True
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    token = crear_access_token(nuevo)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        id=nuevo.id,
        rol=nuevo.rol,
        nombre=nuevo.nombre,
        email=nuevo.email,
        correo=nuevo.email,
        especialidad=nuevo.especialidad
    )

@router.post("/login", response_model=TokenResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """Autentica credenciales contra la base de datos relacional y devuelve JWT."""
    email_limpio = credentials.email.strip().lower()
    user = db.query(Usuario).filter(Usuario.email == email_limpio).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales institucionales no registradas en la base de datos."
        )

    if not user.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La cuenta institucional se encuentra inactiva."
        )

    if not verificar_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña incorrecta. Verifique sus credenciales institucionales."
        )

    user.ultimo_acceso = datetime.now(timezone.utc)
    db.commit()

    token = crear_access_token(user)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        id=user.id,
        rol=user.rol,
        nombre=user.nombre,
        email=user.email,
        correo=user.email,
        especialidad=user.especialidad
    )
