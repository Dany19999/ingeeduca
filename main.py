import os
import json
import asyncio
import time
import httpx
from fastapi import FastAPI, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone

from database import (
    inicializar_base_datos,
    get_db,
    Usuario,
    Clase,
    MetricaAtencion,
    Matricula,
    Intervencion,
    ConsultaChat,
    IncidenteAula,
    SessionLocal,
    hashear_password,
    verificar_password,
    crear_access_token,
    decodificar_token,
    Session,
    engine,
    Base,
    ahora_utc
)
from monitoreo_db import construir_dashboard

app = FastAPI(
    title="INGEDUCA - Campus Virtual & Tutoría Pedagógica",
    description="Backend oficial con Asesor Académico de Ingeniería y acompañamiento en tiempo real",
    version="2.0.0"
)

# Configuración de CORS para enlace con el Frontend en React / Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://ingeeduca-web.onrender.com",
        "https://ingeeduca.onrender.com",
        "http://localhost:5173",
        "http://localhost:3000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Carga de variables de entorno desde archivo .env local si existe
def _cargar_env_local():
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    k, v = k.strip(), v.strip().strip('"').strip("'")
                    if k and k not in os.environ:
                        os.environ[k] = v

_cargar_env_local()

# Creación automática de tablas en PostgreSQL al iniciar el backend
Base.metadata.create_all(bind=engine)
inicializar_base_datos()

# Clave API oficial de Google AI Studio y Modelo verificado ultra-rápido
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

# --------------------------------------------------------------------------
# ESQUEMAS DE DATOS (PYDANTIC)
# --------------------------------------------------------------------------
class LoginRequest(BaseModel):
    email: str
    password: str
    rol: Optional[str] = None

class RegistroRequest(BaseModel):
    nombre: str
    email: str
    password: str
    rol: str = "estudiante"
    especialidad: Optional[str] = "Ingeniería Civil"

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    id: int
    nombre: str
    email: str
    correo: str
    rol: str
    especialidad: Optional[str] = None
class ChatRequest(BaseModel):
    mensaje: str
    usuario: str = "participante@ingeeduca.pe"
    rol: str = "estudiante"
    tema_actual: str = "Modelado BIM & Revit / Costos S10 / Obras Civiles"
    software: Optional[str] = "Revit"

class ChatResponse(BaseModel):
    respuesta: str
    sentimiento: str
    nivel_duda: str
    software_detectado: Optional[str] = None
    tiempo_ms: Optional[int] = None

class EstudianteMonitoreo(BaseModel):
    id: int
    nombre: str
    avatar: str
    clase: str
    tiempoConexion: str
    dudasEmitidas: int
    atencion: str
    estadoConexion: str
    promedio: float
    ultimoRefuerzo: Optional[str] = None

class MetricasDashboard(BaseModel):
    total_asistentes: int
    desconectados: int
    atencion_promedio: int
    dudas_resueltas: int
    tasa_retencion: float
    clases_activas: int

class ClaseMonitoreada(BaseModel):
    id: int
    materia: str
    software: str
    sesionNumero: int
    tema: str
    asistentes: int
    interaccion: int
    enVivo: bool
    docente: str

class MonitoreoResponse(BaseModel):
    metricas: MetricasDashboard
    clases: List[ClaseMonitoreada]
    estudiantes: List[EstudianteMonitoreo]

class IntervencionRequest(BaseModel):
    estudiante_id: int
    accion: str
    nota: Optional[str] = ""

class NuevaClaseRequest(BaseModel):
    id: Optional[str] = None
    nombre: str
    software: Optional[str] = "Autodesk Revit 2026"
    docente: Optional[str] = None
    docente_id: Optional[int] = None
    tema: Optional[str] = ""

class MetricaAtencionRequest(BaseModel):
    estudiante_id: Optional[int] = None
    estudiante_email: Optional[str] = None
    estudiante_nombre: Optional[str] = None
    clase_id: Optional[int] = None
    clase_codigo: Optional[str] = None
    atencion_pct: float
    estado: Optional[str] = "concentrado"
    emocion: Optional[str] = "feliz"

class PresenciaRequest(BaseModel):
    id: Optional[int] = None
    nombre: str
    correo: Optional[str] = None
    email: Optional[str] = None
    rol: Optional[str] = "estudiante"
    emocion: Optional[str] = "Atento"
    atencion: Optional[float] = 95
    softwareActivo: Optional[str] = "Autodesk Revit 2026"

class PantallaCompartidaRequest(BaseModel):
    isSharing: bool
    presentador: Optional[dict] = None
    frame: Optional[str] = None
    software: Optional[str] = "Autodesk Revit 2026"
    titulo: Optional[str] = ""

# --------------------------------------------------------------------------
# INSTRUCCIONES DEL TUTOR: ROL PEDAGÓGICO HUMANO Y CÁLIDO
# --------------------------------------------------------------------------
SYSTEM_PROMPT = """
Eres un ingeniero civil y docente tutor de INGEDUCA en Perú, especializado en software técnico (Autodesk Revit, S10 Costos y Presupuestos, Civil 3D, Navisworks) y normativa técnica peruana (RNE: E.060 Concreto Armado, E.030 Sismorresistente, G.050 Seguridad, CAPECO).

Tu misión es acompañar a los estudiantes y profesionales con un trato humano, cercano, paciente, altamente profesional y pedagógico:
- Saluda con calidez y entusiasmo ("¡Hola! Qué buena pregunta, vamos a revisarlo paso a paso...", "Con gusto te explico cómo resolverlo técnica y normativamente...").
- Explica de forma didáctica, estructurada y práctica, utilizando viñetas o pasos numerados cuando se trate de comandos de software o cálculos.
- Justifica el porqué técnico citando artículos concretos de la normativa peruana aplicable (como los 7.5 cm de recubrimiento en zapatas de la E.060 Art. 7.7.1, factores sísmicos de la E.030 o rendimientos oficiales CAPECO en S10).
- FORMATO DE FÓRMULAS Y SÍMBOLOS MATEMÁTICOS: Escribe SIEMPRE en texto plano o notación Unicode legible (ej: φ = 0.90, V = (Z · U · C · S / R) · P, f'c = 210 kg/cm², fy = 4200 kg/cm²). ESTÁ ESTRICTAMENTE PROHIBIDO emitir código LaTeX sin compilar como \\frac, \\phi, \\rho, \\cdot o encerrar fórmulas en signos $.
- Si el usuario consulta sobre un tema ajeno a la ingeniería o construcción, responde con empatía y buen humor, orientándolo amablemente de vuelta a los temas del curso.
- Cierra con una frase motivadora o invitando a consultar si queda alguna duda del procedimiento.
"""

RESPUESTAS_OFFLINE = {
    "revit": r"""¡Hola! Excelente pregunta sobre el modelado estructural en **Autodesk Revit**. Aquí tienes el procedimiento recomendado paso a paso:

1. **Configuración de Recubrimiento Normativo**:
   - Selecciona el elemento estructural (zapata o columna).
   - En la paleta de *Propiedades*, ubica la sección de recubrimientos y asigna **7.5 cm (75 mm)** para concreto en contacto con el terreno, tal como exige la Norma Técnica Peruana **E.060** (Art. 7.7.1).

2. **Colocación de Armadura (`Rebar`)**:
   - Dirígete a la pestaña **Estructura** -> panel **Refuerzo** -> comando **Armadura**.
   - Elige la barra longitudinal o estribo correspondiente según tus especificaciones de cálculo.

3. **Espaciamiento y Distribución**:
   - En la barra de opciones superior, selecciona la regla de diseño **Espaciado Máximo** (habitual entre 0.15 m y 0.20 m para zapatas típicas).

4. **Visualización Real en 3D**:
   - En la vista 3D, ingresa a *Gráficos de visibilidad de elemento*, haz clic en *Editar* y activa **Ver como sólido** y **Ver no tapado**.

¿Hay alguna sección en particular de la zapata o columna que quieras que revisemos a detalle?""",

    "s10": r"""¡Hola! Con gusto revisamos el procedimiento para estructurar tu partida en **S10 Costos y Presupuestos**:

1. **Definir el Rendimiento Diario de Cuadrilla**:
   - Verifica el rendimiento oficial según las tablas **CAPECO**. Por ejemplo, para vaciado de concreto en zapatas con cuadrilla oficial (0.2 Capataz + 2 Operarios + 1 Oficial + 6 Peones), el estándar para Lima/Costa es de **25 m³/día**.

2. **Ingreso de Recursos de Mano de Obra**:
   - Registra cada categoría con su costo Hora-Hombre (HH) vigente. El aporte unitario se calcula automáticamente dividiendo la cuadrilla entre el rendimiento diario (Cuadrilla ÷ Rendimiento).

3. **Materiales y Aportes Unitarios**:
   - Ingresa el Cemento Portland Tipo I (o Tipo MS en suelos con sales), agregados fino y grueso, y agua potable.
   - Aplica siempre un **5% de desperdicio técnico** habitual para concreto vaciado en obra.

4. **Equipos y Herramientas Manuales**:
   - Considera la mezcladora trompo (9-11 p³) y el vibrador de aguja 4HP con su costo Hora-Máquina (HM).
   - En herramientas manuales, asigna el **3% al 5% de la Mano de Obra** (%MO).

¡Listo! Avísame si deseas que revisemos el cálculo de la fórmula polinómica o el flete terrestre.""",

    "norma": r"""¡Hola! Qué importante revisar el criterio técnico del **Reglamento Nacional de Edificaciones (RNE)**:

• **Norma Técnica E.060 (Concreto Armado)**:
  - Fija el recubrimiento mínimo de **7.5 cm** en zapatas y vigas de cimentación vaciadas en contacto directo con el suelo (Art. 7.7.1).
  - Factores de reducción de resistencia: **φ = 0.90** para flexión y **φ = 0.65** para compresión en columnas con estribos.
  - Cuantía mínima a flexión: **ρ_mín = 14 / fy** (con fy = 4200 kg/cm² equivale a 0.0033).

• **Norma Técnica E.030 (Diseño Sismorresistente)**:
  - Cortante basal en la base: **V = (Z · U · C · S / R) · P**
  - En la Costa central (Lima - Zona 4), el factor de aceleración máxima es **Z = 0.45 g**. El coeficiente C/R nunca debe ser menor a 0.11.

• **Norma Técnica G.050 (Seguridad en Construcción)**:
  - En excavaciones mayores a **1.50 m** de profundidad es obligatorio el uso de taludes de reposo o entibados de contención certificados.

Cualquier duda puntual sobre un artículo de la norma, dime y lo analizamos juntos con todo gusto."""
}

# --------------------------------------------------------------------------
# ENDPOINTS
# --------------------------------------------------------------------------
@app.get("/")
def inicio():
    return {
        "sistema": "INGEDUCA • Campus Virtual API",
        "estado": "Servidor Activo",
        "modelo": GEMINI_MODEL,
        "version": "2.0.0",
        "especialidades": ["Autodesk Revit", "Costos S10", "Civil 3D", "RNE Perú"]
    }

@app.get("/api/dashboard/monitoreo", response_model=MonitoreoResponse)
def obtener_monitoreo(db: Session = Depends(get_db)):
    """Retorna las métricas en tiempo real calculadas directamente sobre PostgreSQL."""
    return construir_dashboard(db)

@app.post("/api/instructor/intervencion")
def registrar_intervencion(req: IntervencionRequest, db: Session = Depends(get_db)):
    """Registra y actualiza el acompañamiento pedagógico en PostgreSQL."""
    matricula = db.query(Matricula).filter(Matricula.id == req.estudiante_id).first()
    if not matricula:
        matricula = db.query(Matricula).filter(Matricula.usuario_id == req.estudiante_id).first()
    
    if matricula:
        nueva_intervencion = Intervencion(
            matricula_id=matricula.id,
            accion=req.accion,
            nota=req.nota or None
        )
        db.add(nueva_intervencion)
        matricula.en_acompanamiento = True
        matricula.ultimo_refuerzo = req.accion
        db.commit()
        db.refresh(matricula)
        return {
            "ok": True,
            "mensaje": f"Refuerzo '{req.accion}' asignado correctamente a {matricula.nombre}",
            "estudiante": {
                "id": matricula.id,
                "nombre": matricula.nombre,
                "atencion": "REGULAR" if matricula.atencion_pct < 40 else "BUENA",
                "estadoConexion": "Acompañamiento Activo (IA)",
                "ultimoRefuerzo": req.accion
            }
        }
    
    usuario = db.query(Usuario).filter(Usuario.id == req.estudiante_id).first()
    if usuario:
        return {
            "ok": True,
            "mensaje": f"Refuerzo '{req.accion}' asignado correctamente a {usuario.nombre}",
            "estudiante": {
                "id": usuario.id,
                "nombre": usuario.nombre,
                "atencion": "BUENA",
                "estadoConexion": "Acompañamiento Activo (IA)",
                "ultimoRefuerzo": req.accion
            }
        }
    raise HTTPException(status_code=404, detail="Estudiante o matrícula no encontrada")

@app.get("/api/clases")
def listar_clases(db: Session = Depends(get_db)):
    """Retorna todas las clases registradas en PostgreSQL con el contrato esperado por el frontend."""
    clases = db.query(Clase).order_by(Clase.id.desc()).all()
    resultado = []
    for c in clases:
        asistentes_count = db.query(Matricula).filter(Matricula.clase_id == c.id).count()
        docente_nombre = (c.docente.nombre if c.docente else None) or c.docente_nombre or "Docente Titular"
        resultado.append({
            "id": f"aula-{c.id}",
            "db_id": c.id,
            "nombre": c.titulo,
            "software": c.software or "Autodesk Revit 2026",
            "asistentes": asistentes_count,
            "atencionPromedio": 90,
            "docente": docente_nombre,
            "enVivo": c.en_vivo and c.estado == "activa",
            "iniciadaEn": c.fecha_inicio.strftime("%H:%M") if c.fecha_inicio else "En curso"
        })
    return resultado

@app.post("/api/clases")
def crear_clase(req: NuevaClaseRequest, db: Session = Depends(get_db)):
    """Crea y persiste una nueva clase en la base de datos PostgreSQL."""
    nueva = Clase(
        titulo=req.nombre.strip(),
        software=req.software or "Autodesk Revit 2026",
        tema=req.tema or "",
        docente_nombre=req.docente or "Docente Titular",
        docente_id=req.docente_id,
        estado="activa",
        en_vivo=True,
        fecha_inicio=ahora_utc()
    )
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return {
        "id": f"aula-{nueva.id}",
        "db_id": nueva.id,
        "nombre": nueva.titulo,
        "software": nueva.software,
        "asistentes": 0,
        "atencionPromedio": 0,
        "docente": nueva.docente_nombre,
        "enVivo": True,
        "iniciadaEn": "Ahora mismo"
    }

@app.post("/api/metricas/atencion")
def registrar_metrica_atencion(req: MetricaAtencionRequest, db: Session = Depends(get_db)):
    """Registra una métrica de atención y emoción biométrica directamente en la tabla metricas_atencion de PostgreSQL."""
    estudiante = None
    if req.estudiante_id:
        estudiante = db.query(Usuario).filter(Usuario.id == req.estudiante_id).first()
    elif req.estudiante_email:
        estudiante = db.query(Usuario).filter(Usuario.email == req.estudiante_email.strip().lower()).first()
    elif req.estudiante_nombre:
        estudiante = db.query(Usuario).filter(Usuario.nombre == req.estudiante_nombre.strip()).first()
    
    if not estudiante:
        estudiante = db.query(Usuario).filter(Usuario.rol == "estudiante").first()
    
    estudiante_id = estudiante.id if estudiante else 1

    clase_id = req.clase_id
    if not clase_id and req.clase_codigo:
        try:
            num_str = req.clase_codigo.replace("aula-", "").strip()
            if num_str.isdigit():
                clase_id = int(num_str)
        except Exception:
            pass
    if not clase_id:
        primera_clase = db.query(Clase).order_by(Clase.id.desc()).first()
        clase_id = primera_clase.id if primera_clase else None

    emocion_str = (req.emocion or "feliz").strip().lower()
    if "distra" in emocion_str:
        estado_calc = "distraido"
    elif "triste" in emocion_str or "fatiga" in emocion_str:
        estado_calc = "fatiga"
    else:
        estado_calc = "concentrado"

    if clase_id:
        metrica = MetricaAtencion(
            estudiante_id=estudiante_id,
            clase_id=clase_id,
            atencion_pct=float(req.atencion_pct),
            estado=req.estado if req.estado in ["concentrado", "distraido", "fatiga"] else estado_calc,
            emocion=emocion_str,
            timestamp=ahora_utc()
        )
        db.add(metrica)

        matricula = db.query(Matricula).filter(
            Matricula.clase_id == clase_id,
            Matricula.usuario_id == estudiante_id
        ).first()
        if not matricula and estudiante:
            matricula = Matricula(
                clase_id=clase_id,
                usuario_id=estudiante_id,
                nombre=estudiante.nombre,
                atencion_pct=int(req.atencion_pct),
                emocion=emocion_str,
                conectado_desde=ahora_utc(),
                ultimo_ping=ahora_utc()
            )
            db.add(matricula)
        elif matricula:
            matricula.atencion_pct = int(req.atencion_pct)
            matricula.emocion = emocion_str
            matricula.ultimo_ping = ahora_utc()

        db.commit()
        db.refresh(metrica)

        return {
            "ok": True,
            "id": metrica.id,
            "estudiante_id": metrica.estudiante_id,
            "clase_id": metrica.clase_id,
            "atencion_pct": metrica.atencion_pct,
            "estado": metrica.estado,
            "emocion": metrica.emocion,
            "timestamp": metrica.timestamp.isoformat()
        }

    return {
        "ok": True,
        "estudiante_id": estudiante_id,
        "atencion_pct": float(req.atencion_pct),
        "estado": estado_calc,
        "emocion": emocion_str,
        "mensaje": "Métrica procesada (sin clase activa)"
    }

@app.get("/api/metricas/atencion/{clase_id}")
def obtener_metricas_clase(clase_id: int, db: Session = Depends(get_db)):
    """Retorna las últimas 50 métricas de atención registradas en PostgreSQL para una clase."""
    filas = (
        db.query(MetricaAtencion)
        .filter(MetricaAtencion.clase_id == clase_id)
        .order_by(MetricaAtencion.timestamp.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": m.id,
            "estudiante_id": m.estudiante_id,
            "clase_id": m.clase_id,
            "atencion_pct": m.atencion_pct,
            "estado": m.estado,
            "emocion": m.emocion,
            "timestamp": m.timestamp.isoformat() if m.timestamp else None
        }
        for m in filas
    ]

@app.get("/api/metricas/reporte/{clase_id}")
def obtener_reporte_consolidado_clase(clase_id: int, db: Session = Depends(get_db)):
    """Genera un reporte analítico consolidado de atención y emociones de una clase para evaluación académica."""
    clase = db.query(Clase).filter(Clase.id == clase_id).first()
    filas = (
        db.query(MetricaAtencion)
        .filter(MetricaAtencion.clase_id == clase_id)
        .order_by(MetricaAtencion.timestamp.asc())
        .all()
    )

    if not filas:
        return {
            "ok": True,
            "clase_id": clase_id,
            "clase_nombre": (clase.titulo if clase and hasattr(clase, "titulo") else (getattr(clase, "nombre", None) or f"Clase #{clase_id}")),
            "software": getattr(clase, "software", "Autodesk Revit 2026") if clase else "Autodesk Revit 2026",
            "docente": getattr(clase, "docente_nombre", None) or getattr(clase, "docente", "Docente Titular") if clase else "Docente Titular",
            "total_muestras": 0,
            "atencion_promedio": 88,
            "distribucion": {"atento": 75, "alegre": 15, "distraido": 7, "triste": 3},
            "estudiantes": [],
            "timeline": [],
            "diagnostico_ia": "Sesión sin registros biométricos directos suficientes aún."
        }

    total_muestras = len(filas)
    suma_atencion = sum(f.atencion_pct for f in filas)
    atencion_promedio = round(suma_atencion / total_muestras, 1)

    conteo_emociones = {"atento": 0, "alegre": 0, "distraido": 0, "triste": 0}
    por_estudiante = {}

    for f in filas:
        emo = (f.emocion or "atento").strip().lower()
        if "distra" in emo:
            conteo_emociones["distraido"] += 1
        elif "triste" in emo:
            conteo_emociones["triste"] += 1
        elif "alegre" in emo or "feliz" in emo:
            conteo_emociones["alegre"] += 1
        else:
            conteo_emociones["atento"] += 1

        est_id = f.estudiante_id or 1
        if est_id not in por_estudiante:
            por_estudiante[est_id] = {
                "id": est_id,
                "atenciones": [],
                "emociones": [],
                "alertas": 0
            }
        por_estudiante[est_id]["atenciones"].append(f.atencion_pct)
        por_estudiante[est_id]["emociones"].append(emo)
        if "distra" in emo or f.atencion_pct < 45:
            por_estudiante[est_id]["alertas"] += 1

    # Obtener nombres de estudiantes
    usuarios_ids = list(por_estudiante.keys())
    usuarios_db = db.query(Usuario).filter(Usuario.id.in_(usuarios_ids)).all()
    mapa_usuarios = {u.id: u for u in usuarios_db}

    lista_estudiantes = []
    for est_id, data in por_estudiante.items():
        u = mapa_usuarios.get(est_id)
        nom = u.nombre if u else f"Estudiante #{est_id}"
        mail = u.email if u else "estudiante@ingeduca.edu.pe"
        avg_est = round(sum(data["atenciones"]) / len(data["atenciones"]), 1)
        # Emoción más frecuente
        from collections import Counter
        top_emo = Counter(data["emociones"]).most_common(1)[0][0] if data["emociones"] else "atento"
        lista_estudiantes.append({
            "id": est_id,
            "nombre": nom,
            "email": mail,
            "muestras": len(data["atenciones"]),
            "atencion_promedio": avg_est,
            "emocion_dominante": top_emo.capitalize(),
            "alertas_distraccion": data["alertas"]
        })

    # Timeline en 8 a 12 puntos cronológicos
    num_puntos = min(12, max(4, total_muestras // 4)) if total_muestras >= 4 else total_muestras
    paso = max(1, total_muestras // num_puntos) if num_puntos > 0 else 1
    timeline = []
    for i in range(0, total_muestras, paso):
        bloque = filas[i:i+paso]
        if bloque:
            avg_b = round(sum(b.atencion_pct for b in bloque) / len(bloque), 1)
            t_str = bloque[0].timestamp.strftime("%H:%M:%S") if bloque[0].timestamp else f"T+{i*2}s"
            timeline.append({
                "tiempo": t_str,
                "atencion": avg_b
            })

    dist_pct = {
        k: round((v / total_muestras) * 100, 1) for k, v in conteo_emociones.items()
    }

    # Diagnóstico IA Pedagógico
    pct_foco_positivo = min(100.0, max(0.0, round(dist_pct.get('atento', 0) + dist_pct.get('alegre', 0), 1)))
    if atencion_promedio >= 80:
        diagnostico = f"La sesión presentó un alto nivel de engagement general ({atencion_promedio}%). El {pct_foco_positivo}% del tiempo los estudiantes mantuvieron foco óptimo en el software."
    elif atencion_promedio >= 65:
        diagnostico = f"Nivel de atención moderado ({atencion_promedio}%). Se observaron episodios aislados de distracción ({dist_pct.get('distraido', 0)}%). Se recomienda incluir dinámicas participativas en la mitad de la clase."
    else:
        diagnostico = f"Atención crítica registrada ({atencion_promedio}%). Tasa de distracción elevada ({dist_pct.get('distraido', 0)}%). Sugerido: micro-pausa activa o revisión con el Tutor IA."

    nombre_clase = getattr(clase, "titulo", None) or getattr(clase, "nombre", None) or f"Clase #{clase_id}"
    docente_clase = getattr(clase, "docente_nombre", None) or getattr(clase, "docente", None) or "Docente Titular"
    software_clase = getattr(clase, "software", None) or "Autodesk Revit 2026"

    return {
        "ok": True,
        "clase_id": clase_id,
        "clase_nombre": nombre_clase,
        "software": software_clase,
        "docente": docente_clase,
        "total_muestras": total_muestras,
        "atencion_promedio": atencion_promedio,
        "distribucion": dist_pct,
        "estudiantes": lista_estudiantes,
        "timeline": timeline,
        "diagnostico_ia": diagnostico
    }

@app.get("/api/metricas/reporte/{clase_id}/csv")
def descargar_reporte_csv_clase(clase_id: int, db: Session = Depends(get_db)):
    """Exporta el historial biométrico completo de la clase en formato CSV para SPSS, Excel o análisis de tesis."""
    clase = db.query(Clase).filter(Clase.id == clase_id).first()
    filas = (
        db.query(MetricaAtencion)
        .filter(MetricaAtencion.clase_id == clase_id)
        .order_by(MetricaAtencion.timestamp.asc())
        .all()
    )

    usuarios_db = db.query(Usuario).all()
    mapa_usuarios = {u.id: u.nombre for u in usuarios_db}

    nombre_clase = (getattr(clase, "titulo", None) or getattr(clase, "nombre", None) or f"Clase #{clase_id}").replace(",", " ")
    software_clase = (getattr(clase, "software", None) or "Revit 2026").replace(",", " ")

    lineas = ["ID_Registro,Timestamp_UTC,Estudiante_ID,Estudiante_Nombre,Clase_ID,Clase_Nombre,Software,Atencion_Pct,Estado,Emocion\n"]
    for m in filas:
        nom = mapa_usuarios.get(m.estudiante_id, f"Estudiante #{m.estudiante_id}")
        t_str = m.timestamp.isoformat() if m.timestamp else ""
        lineas.append(f"{m.id},{t_str},{m.estudiante_id},{nom},{clase_id},{nombre_clase},{software_clase},{m.atencion_pct},{m.estado},{m.emocion}\n")

    contenido_csv = "".join(lineas)
    nombre_archivo = f"reporte_biometrico_clase_{clase_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=contenido_csv,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'}
    )

# --------------------------------------------------------------------------
# GESTOR DE SALAS VIRTUALES: PRESENCIA Y PANTALLA COMPARTIDA EN TIEMPO REAL
# --------------------------------------------------------------------------
class SalaManager:
    def __init__(self):
        self.salas: dict[str, dict] = {}
        self.active_websockets: dict[str, set[WebSocket]] = {}

    def get_or_create_sala(self, aula_id: str) -> dict:
        if aula_id not in self.salas:
            self.salas[aula_id] = {
                "participantes": {},
                "mensajes": [],
                "pantalla": {
                    "isSharing": False,
                    "presentador": None,
                    "frame": None,
                    "software": "Autodesk Revit 2026",
                    "titulo": "",
                    "updated_at": time.time()
                }
            }
        if aula_id not in self.active_websockets:
            self.active_websockets[aula_id] = set()
        if "mensajes" not in self.salas[aula_id]:
            self.salas[aula_id]["mensajes"] = []
        return self.salas[aula_id]

    def agregar_mensaje_chat(self, aula_id: str, mensaje: dict) -> dict:
        sala = self.get_or_create_sala(aula_id)
        if "mensajes" not in sala:
            sala["mensajes"] = []
        sala["mensajes"].append(mensaje)
        if len(sala["mensajes"]) > 100:
            sala["mensajes"] = sala["mensajes"][-100:]
        return mensaje

    def registrar_presencia(self, aula_id: str, usuario: dict) -> list[dict]:
        sala = self.get_or_create_sala(aula_id)
        key = str(usuario.get("id") or usuario.get("correo") or usuario.get("email") or usuario.get("nombre"))
        usuario_info = {
            "id": usuario.get("id"),
            "nombre": usuario.get("nombre") or "Participante",
            "correo": usuario.get("correo") or usuario.get("email") or "",
            "rol": usuario.get("rol") or "estudiante",
            "aulaId": aula_id,
            "softwareActivo": usuario.get("softwareActivo") or "Autodesk Revit 2026",
            "emocion": usuario.get("emocion") or "Atento",
            "atencion": usuario.get("atencion") if usuario.get("atencion") is not None else 95,
            "confianza": usuario.get("confianza") or 95,
            "alertas": usuario.get("alertas") or 0,
            "tiempoConexion": usuario.get("tiempoConexion") or "1m",
            "ultimo_ping": time.time()
        }
        sala["participantes"][key] = usuario_info
        self.limpiar_inactivos(aula_id)
        return list(sala["participantes"].values())

    def remover_presencia(self, aula_id: str, key: str) -> list[dict]:
        sala = self.get_or_create_sala(aula_id)
        if key in sala["participantes"]:
            del sala["participantes"][key]
        return list(sala["participantes"].values())

    def limpiar_inactivos(self, aula_id: str, timeout_seconds: int = 15) -> list[dict]:
        sala = self.get_or_create_sala(aula_id)
        ahora = time.time()
        claves_a_borrar = [
            k for k, p in sala["participantes"].items()
            if ahora - p.get("ultimo_ping", ahora) > timeout_seconds
        ]
        for k in claves_a_borrar:
            del sala["participantes"][k]
        return list(sala["participantes"].values())

    def actualizar_pantalla(self, aula_id: str, pantalla_data: dict) -> dict:
        sala = self.get_or_create_sala(aula_id)
        is_sharing = bool(pantalla_data.get("isSharing"))
        presentador = pantalla_data.get("presentador")
        frame = pantalla_data.get("frame")
        software = pantalla_data.get("software") or "Autodesk Revit 2026"
        titulo = pantalla_data.get("titulo") or ""

        sala["pantalla"] = {
            "isSharing": is_sharing,
            "presentador": presentador if is_sharing else None,
            "frame": frame if is_sharing else None,
            "software": software,
            "titulo": titulo,
            "updated_at": time.time()
        }
        return sala["pantalla"]

    def obtener_estado(self, aula_id: str) -> dict:
        sala = self.get_or_create_sala(aula_id)
        self.limpiar_inactivos(aula_id)
        return {
            "aula_id": aula_id,
            "participantes": list(sala["participantes"].values()),
            "pantalla": sala["pantalla"],
            "mensajes": sala.get("mensajes", [])
        }

    async def broadcast(self, aula_id: str, message: dict):
        if aula_id not in self.active_websockets:
            return
        dead = []
        for ws in list(self.active_websockets[aula_id]):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.active_websockets[aula_id].discard(ws)

sala_manager = SalaManager()

@app.get("/api/salas/{aula_id}/estado")
def obtener_estado_sala(aula_id: str):
    """Retorna el estado de sincronización en tiempo real de la sala (alumnos, pantalla compartida y chat)."""
    return sala_manager.obtener_estado(aula_id)

@app.get("/api/salas/{aula_id}/mensajes")
def obtener_mensajes_sala(aula_id: str):
    """Retorna el historial de mensajes de chat en vivo de la sala sincrónica."""
    sala = sala_manager.get_or_create_sala(aula_id)
    return sala.get("mensajes", [])

@app.post("/api/salas/{aula_id}/mensajes")
async def enviar_mensaje_sala(aula_id: str, req: dict):
    """Envía un mensaje al chat sincrónico y lo retransmite por WebSocket a todos los usuarios."""
    msg_payload = req.get("mensaje") or req
    if not isinstance(msg_payload, dict):
        msg_payload = {"texto": str(msg_payload)}
    if "id" not in msg_payload:
        msg_payload["id"] = f"msg_{int(time.time()*1000)}"
    if "hora" not in msg_payload:
        msg_payload["hora"] = time.strftime("%H:%M")
    if "timestamp" not in msg_payload:
        msg_payload["timestamp"] = time.time()

    guardado = sala_manager.agregar_mensaje_chat(aula_id, msg_payload)
    evento_chat = {
        "tipo": "chat_mensaje",
        "aula_id": aula_id,
        "mensaje": guardado
    }
    await sala_manager.broadcast(aula_id, evento_chat)
    for other_aid in list(sala_manager.active_websockets.keys()):
        if other_aid != aula_id:
            await sala_manager.broadcast(other_aid, evento_chat)
    try:
        await alerta_manager.broadcast(aula_id, evento_chat)
    except Exception:
        pass
    return guardado

@app.post("/api/salas/{aula_id}/presencia")
async def registrar_presencia_sala(aula_id: str, req: PresenciaRequest, db: Session = Depends(get_db)):
    """Registra y mantiene activa la presencia del participante en el aula virtual."""
    datos_usuario = req.dict()
    sala_manager.registrar_presencia(aula_id, datos_usuario)
    
    # Actualizar ping en matrícula si es estudiante
    if req.rol == "estudiante" and req.atencion is not None:
        try:
            usuario = None
            if req.id:
                usuario = db.query(Usuario).filter(Usuario.id == req.id).first()
            if not usuario and (req.correo or req.email):
                mail = (req.correo or req.email).strip().lower()
                usuario = db.query(Usuario).filter(Usuario.email == mail).first()
            if not usuario and req.nombre:
                usuario = db.query(Usuario).filter(Usuario.nombre == req.nombre.strip()).first()
            
            if usuario:
                cid = None
                if "aula-" in aula_id:
                    c_str = aula_id.replace("aula-", "").strip()
                    if c_str.isdigit():
                        cid = int(c_str)
                if not cid:
                    clase_reciente = db.query(Clase).order_by(Clase.id.desc()).first()
                    cid = clase_reciente.id if clase_reciente else None
                
                if cid:
                    mat = db.query(Matricula).filter(Matricula.clase_id == cid, Matricula.usuario_id == usuario.id).first()
                    if mat:
                        mat.ultimo_ping = ahora_utc()
                        mat.atencion_pct = int(req.atencion)
                        mat.emocion = req.emocion or "Atento"
                        db.commit()
        except Exception as e:
            print(f"[Presencia DB]: {e}")

    estado = sala_manager.obtener_estado(aula_id)
    await sala_manager.broadcast(aula_id, {
        "tipo": "presencia_actualizada",
        "participantes": estado["participantes"]
    })
    return estado

@app.post("/api/salas/{aula_id}/pantalla")
async def actualizar_pantalla_sala(aula_id: str, req: PantallaCompartidaRequest):
    """Actualiza el estado y fotograma en vivo de pantalla compartida de la sala."""
    pantalla = sala_manager.actualizar_pantalla(aula_id, req.dict())
    await sala_manager.broadcast(aula_id, {
        "tipo": "pantalla_actualizada",
        "pantalla": pantalla
    })
    return {"ok": True, "pantalla": pantalla}

@app.delete("/api/salas/{aula_id}/presencia/{user_key}")
async def salir_sala(aula_id: str, user_key: str):
    """Notifica la salida de un participante de la sala."""
    participantes = sala_manager.remover_presencia(aula_id, user_key)
    await sala_manager.broadcast(aula_id, {
        "tipo": "presencia_actualizada",
        "participantes": participantes
    })
    return {"ok": True, "participantes": participantes}

@app.websocket("/ws/aula/{aula_id}")
async def websocket_aula(websocket: WebSocket, aula_id: str):
    """Canal WebSocket bidireccional en tiempo real para presencia, telemetría y pantalla compartida."""
    await websocket.accept()
    sala_manager.get_or_create_sala(aula_id)
    sala_manager.active_websockets[aula_id].add(websocket)
    
    # Enviar estado actual al recién conectado
    await websocket.send_json({
        "tipo": "estado_inicial",
        "estado": sala_manager.obtener_estado(aula_id)
    })
    
    user_key = None
    try:
        while True:
            datos = await websocket.receive_json()
            tipo = datos.get("tipo")
            
            if tipo == "join":
                user_info = datos.get("user", {})
                user_key = str(user_info.get("id") or user_info.get("correo") or user_info.get("email") or user_info.get("nombre"))
                sala_manager.registrar_presencia(aula_id, user_info)
                estado = sala_manager.obtener_estado(aula_id)
                await sala_manager.broadcast(aula_id, {
                    "tipo": "presencia_actualizada",
                    "participantes": estado["participantes"]
                })
                
            elif tipo == "ping" or tipo == "telemetria":
                user_info = datos.get("user", {})
                if user_info:
                    sala_manager.registrar_presencia(aula_id, user_info)
                    estado = sala_manager.obtener_estado(aula_id)
                    await sala_manager.broadcast(aula_id, {
                        "tipo": "presencia_actualizada",
                        "participantes": estado["participantes"]
                    })
                    
            elif tipo == "pantalla":
                pantalla_info = datos.get("pantalla", {})
                pantalla = sala_manager.actualizar_pantalla(aula_id, pantalla_info)
                await sala_manager.broadcast(aula_id, {
                    "tipo": "pantalla_actualizada",
                    "pantalla": pantalla
                })

            elif tipo == "reaccion":
                emoji = datos.get("emoji")
                usuario_nombre = datos.get("usuario")
                await sala_manager.broadcast(aula_id, {
                    "tipo": "reaccion",
                    "emoji": emoji,
                    "usuario": usuario_nombre
                })

            elif tipo == "mano":
                levantada = datos.get("levantada")
                usuario_nombre = datos.get("usuario")
                await sala_manager.broadcast(aula_id, {
                    "tipo": "mano",
                    "levantada": levantada,
                    "usuario": usuario_nombre
                })

            elif tipo in ["INTERVENCION_DOCENTE", "INTERVENCION_COMPLETADA"]:
                # Retransmitir intervención pedagógica en tiempo real a sala y alertas
                await sala_manager.broadcast(aula_id, datos)
                try:
                    await alerta_manager.broadcast(aula_id, datos)
                except Exception as ex_b:
                    print(f"[WS Aula Intervencion Broadcast]: {ex_b}")

                # Si el estudiante completó la intervención, actualizar estado en PostgreSQL
                if tipo == "INTERVENCION_COMPLETADA":
                    db_local = SessionLocal()
                    try:
                        est = str(datos.get("estudiante") or "").strip()
                        if est:
                            inc = (
                                db_local.query(IncidenteAula)
                                .filter(IncidenteAula.aula_id == aula_id, IncidenteAula.estudiante.ilike(f"%{est}%"))
                                .order_by(IncidenteAula.creado_en.desc())
                                .first()
                            )
                            if inc:
                                inc.estado = "atendido con éxito"
                                db_local.commit()
                    except Exception as err_db:
                        print(f"[WS Aula Intervencion DB]: {err_db}")
                    finally:
                        db_local.close()

            elif tipo == "chat_mensaje":
                msg_payload = datos.get("mensaje") or {}
                if not msg_payload:
                    msg_payload = {
                        "id": datos.get("id") or f"msg_{int(time.time()*1000)}",
                        "remitente": datos.get("remitente") or datos.get("usuario") or "Participante",
                        "rol": datos.get("rol") or "estudiante",
                        "correo": datos.get("correo") or "",
                        "texto": datos.get("texto") or "",
                        "hora": datos.get("hora") or time.strftime("%H:%M"),
                        "timestamp": datos.get("timestamp") or time.time()
                    }
                guardado = sala_manager.agregar_mensaje_chat(aula_id, msg_payload)
                evento_chat = {
                    "tipo": "chat_mensaje",
                    "aula_id": aula_id,
                    "mensaje": guardado
                }
                await sala_manager.broadcast(aula_id, evento_chat)
                for other_aid in list(sala_manager.active_websockets.keys()):
                    if other_aid != aula_id:
                        await sala_manager.broadcast(other_aid, evento_chat)
                try:
                    await alerta_manager.broadcast(aula_id, evento_chat)
                except Exception:
                    pass

            elif tipo in ["STREAM_VIDEO_DOCENTE", "STREAM_VIDEO_ESTUDIANTE", "pantalla_frame"]:
                # Retransmitir streams de video y pantalla en tiempo real a todos los clientes de la sala y salas vinculadas
                await sala_manager.broadcast(aula_id, datos)
                for other_aid in list(sala_manager.active_websockets.keys()):
                    if other_aid != aula_id:
                        await sala_manager.broadcast(other_aid, datos)

            elif tipo == "leave":
                if user_key:
                    sala_manager.remover_presencia(aula_id, user_key)
                    estado = sala_manager.obtener_estado(aula_id)
                    await sala_manager.broadcast(aula_id, {
                        "tipo": "presencia_actualizada",
                        "participantes": estado["participantes"]
                    })

            else:
                # Retransmitir cualquier otro evento a los clientes de la sala
                await sala_manager.broadcast(aula_id, datos)

    except WebSocketDisconnect:
        sala_manager.active_websockets[aula_id].discard(websocket)
        if user_key:
            sala_manager.remover_presencia(aula_id, user_key)
            estado = sala_manager.obtener_estado(aula_id)
            await sala_manager.broadcast(aula_id, {
                "tipo": "presencia_actualizada",
                "participantes": estado["participantes"]
            })
    except Exception:
        sala_manager.active_websockets[aula_id].discard(websocket)

# --------------------------------------------------------------------------
# GESTOR DE WEBSOCKETS PARA EMISIÓN Y DISTRIBUCIÓN DE ALERTAS (WEB & MÓVIL)
# --------------------------------------------------------------------------
class ConnectionManager:
    """Gestor de clientes WebSocket agrupados por identificador de sala (room_id).
    Permite emitir y distribuir alertas de conducta en tiempo real hacia la app web y móvil."""
    def __init__(self):
        self.active_rooms: dict[str, set[WebSocket]] = {}

    async def connect(self, room_id: str, websocket: WebSocket):
        await websocket.accept()
        rid = str(room_id).strip()
        if rid not in self.active_rooms:
            self.active_rooms[rid] = set()
        self.active_rooms[rid].add(websocket)

    def disconnect(self, room_id: str, websocket: WebSocket):
        rid = str(room_id).strip()
        if rid in self.active_rooms:
            self.active_rooms[rid].discard(websocket)
            if not self.active_rooms[rid]:
                del self.active_rooms[rid]

    async def broadcast(self, room_id: str, message: dict):
        rid = str(room_id).strip()
        if rid not in self.active_rooms:
            return
        dead = []
        for connection in list(self.active_rooms[rid]):
            try:
                await connection.send_json(message)
            except Exception:
                dead.append(connection)
        for connection in dead:
            self.active_rooms[rid].discard(connection)

alerta_manager = ConnectionManager()


async def procesar_alerta_incidente(room_id: str, datos: dict, db: Session) -> dict:
    """Registra la alerta en PostgreSQL (tabla incidentes) y retransmite inmediatamente por broadcast a la sala."""
    rid = str(room_id or datos.get("aula_id") or "AULA-101").strip()
    estudiante = str(datos.get("estudiante") or datos.get("alumno") or "Estudiante Aula").strip()
    incidente_desc = str(datos.get("incidente") or datos.get("descripcion") or "Fatiga detectada por Visión IA").strip()

    # Clasificación del tipo de incidente
    tipo_inc = datos.get("tipo_incidente")
    if not tipo_inc:
        desc_l = (incidente_desc + " " + str(datos.get("tipo", ""))).lower()
        if any(k in desc_l for k in ["fatiga", "sueño", "cansancio", "ojos", "triste", "somnolencia"]):
            tipo_inc = "fatiga"
        elif any(k in desc_l for k in ["distra", "mirada", "desatenc"]):
            tipo_inc = "distraccion"
        elif any(k in desc_l for k in ["inasi", "ausen", "falta"]):
            tipo_inc = "inasistencia"
        elif any(k in desc_l for k in ["aban", "retiro", "salio"]):
            tipo_inc = "abandono"
        else:
            tipo_inc = "fatiga"

    severidad = str(datos.get("severidad", "ALTA")).upper()
    hora = str(datos.get("hora") or datetime.now().strftime("%H:%M:%S"))
    estado = str(datos.get("estado", "pendiente"))
    metricas = datos.get("metricas")
    metricas_str = json.dumps(metricas) if isinstance(metricas, dict) else (str(metricas) if metricas else None)

    # a) Persistencia en PostgreSQL
    nuevo_incidente = IncidenteAula(
        aula_id=rid,
        estudiante=estudiante,
        tipo_incidente=tipo_inc,
        incidente=incidente_desc,
        severidad=severidad,
        hora_registro=hora,
        estado=estado,
        metricas=metricas_str
    )
    db.add(nuevo_incidente)
    db.commit()
    db.refresh(nuevo_incidente)

    # Payload estandarizado de evento
    payload = nuevo_incidente.to_dict()

    # b) Retransmitir mediante broadcast inmediato a los clientes de la sala (app web + app móvil React Native)
    await alerta_manager.broadcast(rid, payload)

    # También retransmitir al canal general de la sala si está activo
    await sala_manager.broadcast(rid, {
        "tipo": "alerta_incidente",
        "alerta": payload
    })

    return payload


@app.websocket("/ws/alertas/{room_id}")
async def websocket_alertas(websocket: WebSocket, room_id: str):
    """Endpoint WebSocket para suscripción, emisión y recepción de alertas en tiempo real por sala (room_id)."""
    rid = str(room_id).strip()
    await alerta_manager.connect(rid, websocket)

    # Handshake: Enviar confirmación y alertas activas no atendidas de PostgreSQL
    db = SessionLocal()
    try:
        alertas_previas = (
            db.query(IncidenteAula)
            .filter(IncidenteAula.aula_id == rid, IncidenteAula.estado.in_(["pendiente", "no atendido"]))
            .order_by(IncidenteAula.creado_en.desc())
            .limit(25)
            .all()
        )
        await websocket.send_json({
            "tipo": "CONEXION_ESTABLECIDA",
            "room_id": rid,
            "mensaje": f"Canal de alertas en vivo conectado para {rid}",
            "alertas_activas": [a.to_dict() for a in alertas_previas]
        })
    except Exception as e:
        print(f"[WS Alertas Handshake]: {e}")
    finally:
        db.close()

    try:
        while True:
            datos = await websocket.receive_json()
            if not isinstance(datos, dict):
                continue
            
            tipo_msg = datos.get("tipo")
            if tipo_msg == "INTERVENCION_DOCENTE":
                await alerta_manager.broadcast(rid, datos)
                await sala_manager.broadcast(rid, datos)
            elif tipo_msg == "INTERVENCION_COMPLETADA":
                db_conn = SessionLocal()
                try:
                    est = str(datos.get("estudiante") or "").strip()
                    if est:
                        inc = (
                            db_conn.query(IncidenteAula)
                            .filter(IncidenteAula.aula_id == rid, IncidenteAula.estudiante.ilike(f"%{est}%"))
                            .order_by(IncidenteAula.creado_en.desc())
                            .first()
                        )
                        if inc:
                            inc.estado = "atendido con éxito"
                            db_conn.commit()
                finally:
                    db_conn.close()
                await alerta_manager.broadcast(rid, datos)
                await sala_manager.broadcast(rid, datos)
            else:
                # Procesar, persistir y hacer broadcast de incidentes de conducta
                db_conn = SessionLocal()
                try:
                    await procesar_alerta_incidente(rid, datos, db_conn)
                finally:
                    db_conn.close()

    except WebSocketDisconnect:
        alerta_manager.disconnect(rid, websocket)
    except Exception:
        alerta_manager.disconnect(rid, websocket)


@app.get("/api/aulas/{room_id}/alertas")
def listar_alertas_aula(room_id: str, db: Session = Depends(get_db)):
    """Endpoint REST de respaldo: consulta las alertas activas no revisadas directo de PostgreSQL."""
    rid = str(room_id).strip()
    incidentes = (
        db.query(IncidenteAula)
        .filter(IncidenteAula.aula_id == rid, IncidenteAula.estado.in_(["pendiente", "no atendido"]))
        .order_by(IncidenteAula.creado_en.desc())
        .limit(50)
        .all()
    )
    return [inc.to_dict() for inc in incidentes]


@app.post("/api/aulas/{room_id}/alertas")
async def emitir_alerta_rest(room_id: str, payload: dict, db: Session = Depends(get_db)):
    """Endpoint REST para emitir una alerta, guardarla en PostgreSQL y retransmitirla vía WebSockets."""
    rid = str(room_id).strip()
    alerta_dict = await procesar_alerta_incidente(rid, payload, db)
    return {"status": "ok", "alerta": alerta_dict}


@app.post("/api/aulas/{room_id}/intervencion")
async def emitir_intervencion_rest(room_id: str, payload: dict, db: Session = Depends(get_db)):
    """Emite una intervención pedagógica con IA hacia la sala y notifica por WebSockets."""
    rid = str(room_id).strip()
    payload["tipo"] = "INTERVENCION_DOCENTE"
    payload["aula_id"] = rid
    await alerta_manager.broadcast(rid, payload)
    await sala_manager.broadcast(rid, payload)
    return {"status": "ok", "intervencion": payload}


@app.post("/api/aulas/{room_id}/intervencion-completada")
async def completar_intervencion_rest(room_id: str, payload: dict, db: Session = Depends(get_db)):
    """Registra la respuesta/cierre de intervención en PostgreSQL y notifica en vivo a docentes."""
    rid = str(room_id).strip()
    est = str(payload.get("estudiante") or "").strip()
    if est:
        inc = (
            db.query(IncidenteAula)
            .filter(IncidenteAula.aula_id == rid, IncidenteAula.estudiante.ilike(f"%{est}%"))
            .order_by(IncidenteAula.creado_en.desc())
            .first()
        )
        if inc:
            inc.estado = "atendido con éxito"
            db.commit()
            payload["alerta_id"] = inc.id

    payload["tipo"] = "INTERVENCION_COMPLETADA"
    payload["aula_id"] = rid
    payload["estado"] = "atendido con éxito"
    await alerta_manager.broadcast(rid, payload)
    await sala_manager.broadcast(rid, payload)
    return {"status": "ok", "resultado": payload}


@app.patch("/api/aulas/{room_id}/alertas/{alerta_id}/estado")
def actualizar_estado_alerta(room_id: str, alerta_id: int, payload: dict, db: Session = Depends(get_db)):
    """Actualiza el estado de una alerta ('atendido', 'revisado') en PostgreSQL."""
    rid = str(room_id).strip()
    nuevo_estado = payload.get("estado", "atendido")
    incidente = db.query(IncidenteAula).filter(IncidenteAula.id == alerta_id, IncidenteAula.aula_id == rid).first()
    if not incidente:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    incidente.estado = nuevo_estado
    db.commit()
    return {"status": "ok", "id": alerta_id, "estado": nuevo_estado}

@app.get("/api/estudiantes/conectados")
def listar_estudiantes_conectados(db: Session = Depends(get_db)):
    """Retorna los estudiantes activos en salas o registrados en PostgreSQL con su telemetría real."""
    estudiantes_activos_salas = {}
    for aula_id, s in sala_manager.salas.items():
        sala_manager.limpiar_inactivos(aula_id)
        for k, p in s.get("participantes", {}).items():
            if p.get("rol") == "estudiante":
                key = str(p.get("id") or p.get("correo") or p.get("nombre"))
                estudiantes_activos_salas[key] = p

    estudiantes = db.query(Usuario).filter(Usuario.rol == "estudiante").all()
    resultado = []
    
    # 1. Estudiantes activos en salas primero
    for key, p in estudiantes_activos_salas.items():
        resultado.append({
            "id": f"est-{p.get('id') or 99}",
            "db_id": p.get("id"),
            "nombre": p.get("nombre"),
            "correo": p.get("correo") or p.get("email"),
            "aulaId": p.get("aulaId", "aula-1"),
            "atencion": int(p.get("atencion", 95)),
            "emocion": str(p.get("emocion", "Atento")),
            "confianza": int(p.get("confianza", 95)),
            "alertas": int(p.get("alertas", 0)),
            "tiempoConexion": p.get("tiempoConexion", "1m"),
            "softwareActivo": p.get("softwareActivo", "Autodesk Revit 2026")
        })

    # 2. Otros estudiantes de la BD que no estén ya en la lista
    correos_o_nombres_listados = {r["correo"] for r in resultado} | {r["nombre"] for r in resultado}
    for est in estudiantes:
        if est.email in correos_o_nombres_listados or est.nombre in correos_o_nombres_listados:
            continue
            
        ultima_metrica = (
            db.query(MetricaAtencion)
            .filter(MetricaAtencion.estudiante_id == est.id)
            .order_by(MetricaAtencion.timestamp.desc())
            .first()
        )
        atencion_val = int(ultima_metrica.atencion_pct) if ultima_metrica else 95
        emocion_val = ultima_metrica.emocion.capitalize() if ultima_metrica else "Atento"
        
        resultado.append({
            "id": f"est-{est.id}",
            "db_id": est.id,
            "nombre": est.nombre,
            "correo": est.email,
            "aulaId": "aula-1",
            "atencion": atencion_val,
            "emocion": emocion_val,
            "confianza": 95,
            "alertas": 0,
            "tiempoConexion": "1m",
            "softwareActivo": "Autodesk Revit 2026"
        })
    return resultado

@app.get("/api/estudiantes/matriz")
def listar_matriz_alumnos(db: Session = Depends(get_db)):
    """Padrón general histórico y académico de estudiantes matriculados en PostgreSQL."""
    from collections import Counter
    estudiantes = db.query(Usuario).filter(Usuario.rol == "estudiante").order_by(Usuario.id.asc()).all()
    resultado = []
    
    for est in estudiantes:
        # Consultar métricas históricas de atención en PostgreSQL
        metricas = db.query(MetricaAtencion).filter(MetricaAtencion.estudiante_id == est.id).all()
        
        if metricas:
            promedio_atencion = round(sum(m.atencion_pct for m in metricas) / len(metricas), 1)
            sesiones_distintas = len(set(m.clase_id for m in metricas))
            total_muestras = len(metricas)
            ultima = max(metricas, key=lambda m: m.timestamp if m.timestamp else datetime.min)
            ultima_fecha = ultima.timestamp.strftime("%d/%m/%Y") if ultima.timestamp else "Hoy"
            estados = [m.emocion.lower() for m in metricas if m.emocion]
            estado_predominante = Counter(estados).most_common(1)[0][0].capitalize() if estados else "Atento"
        else:
            promedio_atencion = 92.0
            sesiones_distintas = 1
            total_muestras = 0
            ultima_fecha = "2026-I"
            estado_predominante = "Atento"
            
        resultado.append({
            "id": est.id,
            "codigo": f"ING-{est.id:04d}",
            "nombre": est.nombre,
            "correo": est.email,
            "estado_matricula": "Regular" if getattr(est, "activo", True) else "Inactivo",
            "especialidad": getattr(est, "especialidad", "Ingeniería Civil") or "Ingeniería Civil",
            "promedio_atencion": promedio_atencion,
            "sesiones_asistidas": max(sesiones_distintas, 1),
            "total_muestras_ia": total_muestras,
            "estado_predominante": estado_predominante,
            "ultima_actividad": ultima_fecha,
            "fecha_registro": est.created_at.strftime("%d/%m/%Y") if getattr(est, "created_at", None) else "2026-I"
        })
        
    return resultado

@app.get("/api/agente/sugerencias")
def sugerencias_preguntas():
    """Retorna sugerencias dinámicas de preguntas técnicas según el software."""
    return [
        {"texto": "¿Cómo configuro el recubrimiento para zapatas según la norma E.060 en Revit?", "categoria": "Revit"},
        {"texto": "¿Cómo calculo el flete terrestre y el costo hora-hombre en S10?", "categoria": "S10"},
        {"texto": "¿Cuál es la cuantía mínima de acero y empalmes según el RNE?", "categoria": "Normativa"},
        {"texto": "¿Cómo genero el reporte de interferencias entre estructuras e instalaciones?", "categoria": "BIM / Navisworks"}
    ]

def _obtener_fallback_local(t_lower: str, software: str) -> str:
    if "revit" in t_lower or "acero" in t_lower or "zapata" in t_lower or "columna" in t_lower or "revit" in software.lower():
        return RESPUESTAS_OFFLINE["revit"]
    elif "s10" in t_lower or "apu" in t_lower or "presupuesto" in t_lower or "s10" in software.lower():
        return RESPUESTAS_OFFLINE["s10"]
    else:
        return RESPUESTAS_OFFLINE["norma"]

@app.post("/api/agente/chat", response_model=ChatResponse)
async def chat_con_gemini(request: ChatRequest):
    texto = request.mensaje.strip()
    if not texto:
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío")

    # Detección de software
    software_detectado = "General"
    t_lower = texto.lower()
    if any(k in t_lower for k in ["revit", "bim", "zapata", "columna", "fierro", "acero", "armadura"]):
        software_detectado = "Autodesk Revit"
    elif any(k in t_lower for k in ["s10", "apu", "presupuesto", "rendimiento", "capeco", "metrado"]):
        software_detectado = "S10 Costos"
    elif any(k in t_lower for k in ["norma", "rne", "e.060", "e.030", "g.050", "sismo"]):
        software_detectado = "Normativa RNE"

    # Clasificación pedagógica constructiva (no robótica)
    palabras_duda = ["error", "falla", "no puedo", "no entiendo", "se traba", "no me sale", "ayuda", "duda"]
    if any(p in t_lower for p in palabras_duda):
        sentimiento = "Acompañamiento Técnico"
        nivel = "Refuerzo práctico"
    else:
        sentimiento = "Consulta de Especialidad"
        nivel = "Formativa"

    texto_generado = ""

    # Invocar Google Gemini de manera asíncrona no bloqueante
    if GEMINI_API_KEY and GEMINI_API_KEY.strip():
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY.strip()}"
        payload = {
            "systemInstruction": {
                "parts": [{"text": SYSTEM_PROMPT}]
            },
            "contents": [
                {
                    "parts": [
                        {"text": f"Contexto de clase: {request.tema_actual} (Especialidad: {software_detectado})\nConsulta del estudiante: {texto}"}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 950
            }
        }
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    cands = data.get("candidates", [])
                    if cands and "content" in cands[0] and "parts" in cands[0]["content"]:
                        texto_generado = cands[0]["content"]["parts"][0].get("text", "").strip()
        except Exception as e:
            print(f"[Asesor Gemini]: Fallback pedagógico activado ({e})")

    if not texto_generado:
        texto_generado = _obtener_fallback_local(t_lower, software_detectado)

    return ChatResponse(
        respuesta=texto_generado,
        sentimiento=sentimiento,
        nivel_duda=nivel,
        software_detectado=software_detectado
    )

@app.post("/api/agente/chat/stream")
async def chat_con_gemini_stream(request: ChatRequest):
    """Endpoint de Server-Sent Events (SSE) para respuesta instantánea palabra por palabra."""
    texto = request.mensaje.strip()
    if not texto:
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío")

    software_detectado = "General"
    t_lower = texto.lower()
    if any(k in t_lower for k in ["revit", "bim", "zapata", "columna", "fierro", "acero", "armadura"]):
        software_detectado = "Autodesk Revit"
    elif any(k in t_lower for k in ["s10", "apu", "presupuesto", "rendimiento", "capeco", "metrado"]):
        software_detectado = "S10 Costos"
    elif any(k in t_lower for k in ["norma", "rne", "e.060", "e.030", "g.050", "sismo"]):
        software_detectado = "Normativa RNE"

    async def event_generator():
        yield f"data: {json.dumps({'tipo': 'inicio', 'software': software_detectado})}\n\n"
        
        texto_acumulado = ""
        transmision_exitosa = False

        if GEMINI_API_KEY and GEMINI_API_KEY.strip():
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:streamGenerateContent?alt=sse&key={GEMINI_API_KEY.strip()}"
            payload = {
                "systemInstruction": {
                    "parts": [{"text": SYSTEM_PROMPT}]
                },
                "contents": [
                    {
                        "parts": [
                            {"text": f"Contexto de clase: {request.tema_actual} (Especialidad: {software_detectado})\nConsulta del estudiante: {texto}"}
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": 950
                }
            }

            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    async with client.stream("POST", url, json=payload) as resp:
                        if resp.status_code == 200:
                            async for raw_line in resp.aiter_lines():
                                line = raw_line.strip()
                                if line.startswith("data:"):
                                    line_data = line[5:].strip()
                                    if not line_data:
                                        continue
                                    try:
                                        chunk_json = json.loads(line_data)
                                        cands = chunk_json.get("candidates", [])
                                        if cands and "content" in cands[0]:
                                            parts = cands[0]["content"].get("parts", [])
                                            for part in parts:
                                                part_text = part.get("text", "")
                                                if part_text:
                                                    texto_acumulado += part_text
                                                    transmision_exitosa = True
                                                    yield f"data: {json.dumps({'chunk': part_text, 'done': False})}\n\n"
                                    except Exception:
                                        pass
            except Exception as e:
                print(f"[Streaming Gemini]: Switch a respuesta local fluida ({e})")

        # Si el stream externo falló o estuvo indisponible, transmitimos el fallback con ritmo natural
        if not transmision_exitosa:
            respuesta_fallback = _obtener_fallback_local(t_lower, software_detectado)
            palabras = respuesta_fallback.split(" ")
            for i in range(0, len(palabras), 3):
                grupo = " ".join(palabras[i:i+3]) + (" " if i+3 < len(palabras) else "")
                yield f"data: {json.dumps({'chunk': grupo, 'done': False})}\n\n"
                await asyncio.sleep(0.02)

        yield f"data: {json.dumps({'chunk': '', 'done': True, 'software': software_detectado})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

# --------------------------------------------------------------------------
# ENDPOINTS DE AUTENTICACIÓN Y GESTIÓN DE USUARIOS (BASE DE DATOS REAL)
# --------------------------------------------------------------------------
@app.post("/api/v1/auth/register", response_model=AuthResponse, tags=["Autenticación"])
def registrar_usuario(datos: RegistroRequest, db: Session = Depends(get_db)):
    """
    Registra un nuevo usuario en la base de datos relacional (SQLite / PostgreSQL).
    Verifica que el email sea único y encripta la contraseña con Bcrypt.
    """
    email_limpio = datos.email.strip().lower()
    if not email_limpio or "@" not in email_limpio:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe proporcionar un correo electrónico válido."
        )

    if len(datos.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña institucional debe tener al menos 6 caracteres."
        )

    # Verificar existencia previa
    usuario_existente = db.query(Usuario).filter(Usuario.email == email_limpio).first()
    if usuario_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El correo '{email_limpio}' ya se encuentra registrado en el sistema institucional."
        )

    rol_normalizado = datos.rol.strip().lower()
    if rol_normalizado not in ["docente", "estudiante"]:
        rol_normalizado = "estudiante"

    nuevo_usuario = Usuario(
        nombre=datos.nombre.strip(),
        email=email_limpio,
        password_hash=hashear_password(datos.password),
        rol=rol_normalizado,
        especialidad=datos.especialidad.strip() if datos.especialidad else "Ingeniería Civil",
        activo=True
    )

    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)

    token = crear_access_token(nuevo_usuario)
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        id=nuevo_usuario.id,
        nombre=nuevo_usuario.nombre,
        email=nuevo_usuario.email,
        correo=nuevo_usuario.email,
        rol=nuevo_usuario.rol,
        especialidad=nuevo_usuario.especialidad
    )

@app.post("/login", response_model=AuthResponse, tags=["Autenticación"])
@app.post("/api/v1/auth/login", response_model=AuthResponse, tags=["Autenticación"])
def login_auth(credenciales: LoginRequest, db: Session = Depends(get_db)):
    """
    Autentica un usuario contra la base de datos relacional verificando hash Bcrypt.
    """
    email_limpio = credenciales.email.strip().lower()
    usuario = db.query(Usuario).filter(Usuario.email == email_limpio).first()

    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El correo electrónico ingresado no está registrado en el sistema institucional."
        )

    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta cuenta institucional se encuentra deshabilitada."
        )

    if not verificar_password(credenciales.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Contraseña incorrecta. Verifique sus credenciales institucionales."
        )

    # Actualizar última fecha de acceso
    usuario.ultimo_acceso = datetime.now(timezone.utc)
    db.commit()

    token = crear_access_token(usuario)
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        id=usuario.id,
        nombre=usuario.nombre,
        email=usuario.email,
        correo=usuario.email,
        rol=usuario.rol,
        especialidad=usuario.especialidad
    )

@app.get("/api/v1/auth/usuarios", tags=["Autenticación"])
def listar_usuarios(db: Session = Depends(get_db)):
    """Retorna la lista de usuarios registrados para auditoría y verificación en tesis."""
    usuarios = db.query(Usuario).all()
    return [u.to_dict() for u in usuarios]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
