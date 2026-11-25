import React, { useState } from "react";
import {
  Compass,
  FileText,
  Activity,
  LogOut,
  Radio,
  Play,
  Users,
  Clock,
  ArrowRight,
  CheckCircle2,
  Video,
  Bot,
  Sparkles
} from "lucide-react";
import AulaVirtual from "../components/AulaVirtual.jsx";
import ErrorBoundary from "../components/ErrorBoundary.jsx";

export default function DashboardEstudiante({
  usuarioActivo,
  onLogout,
  clasesActivas = [],
  onUnirseClase,
  estudiantesConectados = [],
  onEmitirMetrica
}) {
  const [seccionActiva, setSeccionActiva] = useState("clases");
  const [claseSeleccionada, setClaseSeleccionada] = useState(null);
  const [normaActiva, setNormaActiva] = useState("E.060");

  const obtenerDatosEstado = (emocion) => {
    const emo = (emocion || "").toUpperCase();
    if (emo.includes("DISTRA")) {
      return {
        id: "Distraído",
        nombre: "Distraído",
        emoji: "📱",
        badge: "bg-amber-50 text-amber-800 border-amber-300",
        dot: "bg-amber-500",
        colorTexto: "text-amber-700"
      };
    }
    if (emo.includes("TRISTE")) {
      return {
        id: "Triste",
        nombre: "Triste",
        emoji: "😢",
        badge: "bg-sky-50 text-sky-800 border-sky-300",
        dot: "bg-sky-500",
        colorTexto: "text-sky-700"
      };
    }
    if (emo.includes("ALEGRE")) {
      return {
        id: "Alegre",
        nombre: "Alegre",
        emoji: "😊",
        badge: "bg-emerald-50 text-emerald-800 border-emerald-300",
        dot: "bg-emerald-500",
        colorTexto: "text-emerald-700"
      };
    }
    return {
      id: "Atento",
      nombre: "Atento",
      emoji: "🎯",
      badge: "bg-teal-50 text-teal-800 border-teal-300",
      dot: "bg-teal-500",
      colorTexto: "text-teal-700"
    };
  };

  const handleUnirse = (clase) => {
    if (clase) {
      if (onUnirseClase) {
        onUnirseClase(clase);
      }
      setClaseSeleccionada(clase);
    }
  };

  const handleSalirDeClase = () => {
    setClaseSeleccionada(null);
  };

  // Si el estudiante ingresó a una clase en vivo, desplegamos el Aula Virtual Sincrónica Nativa a pantalla completa
  if (claseSeleccionada) {
    return (
      <ErrorBoundary>
        <AulaVirtual
          rol="estudiante"
          clase={claseSeleccionada}
          usuario={usuarioActivo}
          onSalir={handleSalirDeClase}
          estudiantesConectados={estudiantesConectados}
          onEmitirMetrica={onEmitirMetrica}
        />
      </ErrorBoundary>
    );
  }

  const normativasData = {
    "E.060": {
      titulo: "Norma Técnica E.060 - Concreto Armado",
      resumen: "Requisitos mínimos para el análisis, diseño y detallado de elementos estructurales de concreto reforzado.",
      puntosClave: [
        "Recubrimiento mínimo para zapatas y vigas en contacto con terreno: 7.5 cm (75 mm).",
        "Cuantía mínima a flexión: ρ_min = 14 / fy para f'c = 210 kg/cm² y fy = 4200 kg/cm².",
        "Espaciamiento máximo de estribos en zonas de confinamiento: s = d/4 o 8 veces el diámetro de barra longitudinal.",
        "Factor de reducción de resistencia a flexión sin carga axial: φ = 0.90."
      ]
    },
    "E.030": {
      titulo: "Norma Técnica E.030 - Diseño Sismorresistente",
      resumen: "Condiciones de filosofía sismorresistente y cálculo de fuerzas sísmicas para edificaciones peruanas.",
      puntosClave: [
        "Fórmula de Cortante Basal: V = (Z · U · C · S / R) · P.",
        "Factor de zona (Z): Zona 4 (costa de alta sismicidad, ej. Lima) = 0.45 g.",
        "Límite de distorsión de entrepiso (Drift) en concreto armado: 0.007.",
        "El factor C/R no debe ser menor a 0.11 en ningún caso."
      ]
    },
    "G.050": {
      titulo: "Norma Técnica G.050 - Seguridad durante la Construcción",
      resumen: "Estándares y protocolos de seguridad y salud en obras civiles y edificación.",
      puntosClave: [
        "Uso estricto de EPP básico: Casco clase A/B, zapatos de seguridad con puntera y lentes UV.",
        "Protección en excavaciones mayores a 1.50 m: Taludes o entibados certificados.",
        "Trabajo en altura: Obligatorio arnés de cuerpo entero a partir de 1.80 m.",
        "Plan de seguridad y salud en obra aprobado antes del inicio de partidas preliminares."
      ]
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800 font-sans antialiased">
      {/* 1. SIDEBAR IZQUIERDO EJECUTIVO DEL ESTUDIANTE */}
      <aside className="w-64 min-w-[256px] bg-white border-r border-slate-200 text-slate-700 flex flex-col justify-between h-screen sticky top-0 z-40 select-none shadow-xs">
        <div>
          {/* Logo y Branding */}
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-emerald-500/20">
              IE
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight text-slate-900 leading-tight">
                INGE<span className="text-emerald-600">EDUCA</span>
              </div>
              <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Portal del Estudiante
              </div>
            </div>
          </div>

          {/* Menú de Navegación Vertical */}
          <nav className="p-4 space-y-1.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 py-2">
              Aprendizaje Sincrónico
            </div>

            <button
              onClick={() => {
                setSeccionActiva("clases");
                if (claseSeleccionada) setClaseSeleccionada(null);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                seccionActiva === "clases"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25 border border-emerald-500"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Video size={16} />
                <span>Clases en Vivo</span>
              </div>
              <span className={`w-2 h-2 rounded-full ${seccionActiva === "clases" ? "bg-white" : "bg-emerald-500"} animate-ping`} />
            </button>

            <button
              onClick={() => {
                setSeccionActiva("especialidades");
                if (claseSeleccionada) setClaseSeleccionada(null);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                seccionActiva === "especialidades"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25 border border-emerald-500"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Compass size={16} />
                <span>Especialidades BIM</span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${seccionActiva === "especialidades" ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-700 border border-slate-200"}`}>
                3
              </span>
            </button>

            <button
              onClick={() => {
                setSeccionActiva("normativas");
                if (claseSeleccionada) setClaseSeleccionada(null);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                seccionActiva === "normativas"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25 border border-emerald-500"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText size={16} />
                <span>Biblioteca RNE</span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${seccionActiva === "normativas" ? "bg-emerald-700 text-white" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                RNE
              </span>
            </button>

            <button
              onClick={() => {
                setSeccionActiva("rendimiento");
                if (claseSeleccionada) setClaseSeleccionada(null);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                seccionActiva === "rendimiento"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25 border border-emerald-500"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Activity size={16} />
                <span>Mi Progreso</span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${seccionActiva === "rendimiento" ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                Constante
              </span>
            </button>

            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 pt-5 pb-2">
              Asesoría Continua
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Bot size={15} className="text-emerald-600" />
                <span>Asesor Académico en Vivo</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Acompañamiento en tiempo real durante tus ejercicios de modelado y costos.
              </p>
              <div className="text-[10px] font-mono text-emerald-700 flex items-center gap-1.5 pt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Disponible en Aula
              </div>
            </div>
          </nav>
        </div>

        {/* Perfil del Estudiante & Salir */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                {usuarioActivo?.nombre ? usuarioActivo.nombre.substring(0, 2).toUpperCase() : "ES"}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-slate-900 truncate max-w-[130px]">
                  {usuarioActivo?.nombre || "Estudiante"}
                </div>
                <div className="text-[10px] text-slate-500 capitalize truncate">
                  {usuarioActivo?.rol || "Alumno"} • INGEDUCA
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="p-2 rounded-xl bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer shrink-0"
              title="Cerrar Sesión"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* 2. ÁREA DE CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-slate-200 bg-white/95 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              {seccionActiva === "clases" && "Portal del Estudiante • Clases en Vivo"}
              {seccionActiva === "especialidades" && "Rutas de Especialización en Ingeniería BIM"}
              {seccionActiva === "normativas" && "Normativas del Reglamento Nacional de Edificaciones"}
              {seccionActiva === "rendimiento" && "Mi Registro de Asistencia y Progreso"}
            </h2>
            <span className="badge-pill bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              Conexión Estable
            </span>
          </div>
        </header>

        {/* Contenido según pestaña */}
        <main className="p-6 sm:p-8 space-y-8 max-w-[1440px] w-full">
          
          {/* Banner de Bienvenida */}
          <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 text-white p-7 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-2xl space-y-2 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/35 text-emerald-300 text-xs font-bold">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                Plataforma de Acompañamiento Sincrónico
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Bienvenido, <span className="text-emerald-400">{usuarioActivo?.nombre || "Estimado Estudiante"}</span>
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                Ingresa a tu clase activa para participar en las sesiones en vivo y resolver tus dudas técnicas sobre Revit, análisis de precios unitarios (APU) y normativas RNE con tu asesor docente.
              </p>
            </div>
          </div>

          {/* Vista 1: Clases en Vivo */}
          {seccionActiva === "clases" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Columna Izquierda: Clases Disponibles */}
              <div className="lg:col-span-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <Play className="w-4 h-4 text-emerald-600 fill-emerald-600/20" />
                      <span>Clases en Transmisión Sincrónica</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Salas en vivo con docente titular y resolución de consultas paso a paso
                    </p>
                  </div>
                  <span className="badge-pill bg-slate-100 border border-slate-200 text-slate-700">
                    {clasesActivas.length} Sesiones Activas
                  </span>
                </div>

                {clasesActivas.length === 0 ? (
                  <div className="card-obsidian p-12 text-center space-y-3">
                    <Video className="w-12 h-12 text-slate-400 mx-auto" />
                    <h4 className="text-base font-bold text-slate-800">No hay clases en vivo en este momento</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      El docente titular aún no ha iniciado una nueva clase. En cuanto se abra la sala, aparecerá aquí automáticamente.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {clasesActivas.map((clase) => (
                      <div
                        key={clase.id}
                        className="card-obsidian p-6 flex flex-col justify-between"
                      >
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                              EN VIVO
                            </span>
                            <span className="text-[11px] font-mono text-cyan-800 font-bold bg-cyan-50 px-2.5 py-0.5 rounded-md border border-cyan-200">
                              {clase.id}
                            </span>
                          </div>

                          <div>
                            <h4 className="text-base font-bold text-slate-900 line-clamp-2 leading-snug">
                              {clase.nombre}
                            </h4>
                            <p className="text-xs text-emerald-700 font-bold mt-1">
                              {clase.software}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-500">
                            <div className="flex items-center gap-1.5 font-medium">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              <span><strong className="text-slate-800">{clase.asistentes || 1}</strong> alumnos</span>
                            </div>
                            <div className="flex items-center gap-1.5 font-medium">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{clase.iniciadaEn || "En curso"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 pt-2">
                          <button
                            onClick={() => handleUnirse(clase)}
                            className="w-full btn-emerald py-2.5 text-xs font-bold"
                          >
                            <span>Ingresar al Aula Virtual</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* PANEL DE ESTUDIANTES EN CLASES EN VIVO: ATENTO, DISTRAÍDO, TRISTE, ALEGRE */}
                <div className="card-obsidian p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        <Users className="w-5 h-5 text-emerald-600" />
                        <span>Estudiantes en Clases en Vivo • Telemetría IA</span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Monitoreo del estado de concentración y bienestar en tiempo real: Atento, Distraído, Triste y Alegre
                      </p>
                    </div>

                    {/* Contadores rápidos de los 4 estados requeridos */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 shadow-2xs">
                        <span>🎯 Atento</span>
                        <span className="font-mono bg-white px-1.5 py-0.2 rounded text-[10px]">
                          {estudiantesConectados.filter(e => {
                            const em = (e.emocion || "").toUpperCase();
                            return em.includes("ATENTO") || em.includes("CONCENTRADO");
                          }).length}
                        </span>
                      </span>

                      <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 shadow-2xs">
                        <span>📱 Distraído</span>
                        <span className="font-mono bg-white px-1.5 py-0.2 rounded text-[10px]">
                          {estudiantesConectados.filter(e => (e.emocion || "").toUpperCase().includes("DISTRA")).length}
                        </span>
                      </span>

                      <span className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 border border-sky-200 flex items-center gap-1 shadow-2xs">
                        <span>😢 Triste</span>
                        <span className="font-mono bg-white px-1.5 py-0.2 rounded text-[10px]">
                          {estudiantesConectados.filter(e => (e.emocion || "").toUpperCase().includes("TRISTE")).length}
                        </span>
                      </span>

                      <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 flex items-center gap-1 shadow-2xs">
                        <span>😊 Alegre</span>
                        <span className="font-mono bg-white px-1.5 py-0.2 rounded text-[10px]">
                          {estudiantesConectados.filter(e => (e.emocion || "").toUpperCase().includes("ALEGRE")).length}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Selector rápido para el estudiante activo */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-50 to-indigo-50/40 border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                        {usuarioActivo?.nombre ? usuarioActivo.nombre.substring(0, 2).toUpperCase() : "TÚ"}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          {usuarioActivo?.nombre || "Tu Perfil"} (Estudiante)
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Selecciona cómo te sientes durante la clase para calibrar la telemetría:
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {[
                        { id: "Atento", label: "Atento", emoji: "🎯", score: 96 },
                        { id: "Distraído", label: "Distraído", emoji: "📱", score: 42 },
                        { id: "Triste", label: "Triste", emoji: "😢", score: 55 },
                        { id: "Alegre", label: "Alegre", emoji: "😊", score: 98 }
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (onEmitirMetrica) {
                              onEmitirMetrica({
                                estudiante: usuarioActivo?.nombre || "Estudiante",
                                emocion: item.id,
                                atencion: item.score,
                                confianza: 98,
                                timestamp: new Date().toISOString()
                              });
                            }
                          }}
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer transition-all shadow-2xs hover:scale-105 active:scale-95"
                          title={`Marcar mi estado como ${item.label}`}
                        >
                          <span>{item.emoji}</span>
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grid de tarjetas de estudiantes conectados */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {estudiantesConectados.length === 0 ? (
                      <div className="col-span-full py-8 text-center text-slate-400 text-xs font-medium bg-slate-50 rounded-2xl border border-slate-200">
                        Sin compañeros conectados en este momento.
                      </div>
                    ) : (
                      estudiantesConectados.map((est, i) => {
                        const st = obtenerDatosEstado(est.emocion);
                        const nombreEst = est.nombre || "Estudiante";
                        const iniciales = (nombreEst.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("") || "ES");
                        return (
                          <div
                            key={est.id || i}
                            className="p-3.5 rounded-2xl bg-white border border-slate-200/90 hover:border-slate-300 transition-all flex flex-col justify-between space-y-2.5 shadow-2xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-center font-bold text-xs">
                                  {iniciales}
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-slate-900 truncate max-w-[130px]">
                                    {nombreEst}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    {est.softwareActivo || "Revit 2026"} • {est.tiempoConexion || "15m"}
                                  </div>
                                </div>
                              </div>

                              <span className={`px-2 py-0.5 rounded-lg font-bold text-[11px] border flex items-center gap-1 ${st.badge}`}>
                                <span>{st.emoji}</span>
                                <span>{st.nombre}</span>
                              </span>
                            </div>

                            <div className="space-y-1 pt-1">
                              <div className="flex justify-between items-center text-[10px] text-slate-600">
                                <span className="font-semibold">Nivel de Atención:</span>
                                <span className="font-mono font-bold text-slate-800">{est.atencion}%</span>
                              </div>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                                <div
                                  className={`h-full rounded-full ${
                                    est.atencion >= 85
                                      ? "bg-emerald-500"
                                      : est.atencion >= 60
                                      ? "bg-sky-500"
                                      : "bg-amber-500"
                                  }`}
                                  style={{ width: `${Math.min(est.atencion, 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Resumen de Capacidades Técnicas */}
                <div className="card-obsidian p-6 space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Compass className="w-4 h-4 text-emerald-600" />
                    <span>Módulos de Práctica Profesional</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 hover:border-emerald-500/40 transition-colors">
                      <div className="font-bold text-xs text-slate-900">Autodesk Revit 2026</div>
                      <div className="text-[11px] text-slate-600 leading-relaxed">
                        Modelado estructural BIM y colocación de armaduras según norma E.060.
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 hover:border-amber-500/40 transition-colors">
                      <div className="font-bold text-xs text-slate-900">S10 Costos & APU</div>
                      <div className="text-[11px] text-slate-600 leading-relaxed">
                        Análisis de precios unitarios y rendimientos según la tabla oficial CAPECO.
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 hover:border-cyan-500/40 transition-colors">
                      <div className="font-bold text-xs text-slate-900">Autodesk Civil 3D</div>
                      <div className="text-[11px] text-slate-600 leading-relaxed">
                        Diseño geométrico de carreteras y cálculo volumétrico de explanaciones.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Columna Derecha: Estado de Conexión & Sugerencias */}
              <div className="lg:col-span-4 space-y-6">
                {/* Estado de Telemetría */}
                <div className="card-obsidian p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-600" />
                      <span>Mi Enfoque y Ritmo de Estudio</span>
                    </h4>
                    <span className="badge-pill bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Constante
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-600 font-semibold">Índice Promedio de Atención:</span>
                      <span className="font-bold text-emerald-700 font-mono text-sm">94%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full shadow-xs" style={{ width: "94%" }} />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 pt-1 font-medium">
                      <span>Sesiones completadas: 12</span>
                      <span>Consultas al tutor: 18</span>
                    </div>
                  </div>
                </div>

                {/* Tutor Gemini */}
                <div className="card-obsidian p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold">
                      <Sparkles size={17} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Asesor Académico en Vivo</h4>
                      <p className="text-[11px] text-slate-500">Disponible dentro del aula virtual</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Dentro del aula interactiva podrás hacer consultas técnicas directas paso a paso.
                  </p>
                  <div className="space-y-2 pt-1 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium leading-relaxed hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors">
                      💡 "¿Cómo calcular la longitud de anclaje según la norma E.060?"
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium leading-relaxed hover:border-amber-400 hover:bg-amber-50/30 transition-colors">
                      💡 "¿Cómo se agrupan los subpresupuestos en S10?"
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Vista 2: Especialidades BIM */}
          {seccionActiva === "especialidades" && (
            <div className="space-y-6">
              <div className="card-obsidian p-7 space-y-6">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <Compass className="w-5 h-5 text-emerald-600" />
                    <span>Rutas de Especialización en Construcción y Software BIM</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Programas homologados con normas del Reglamento Nacional de Edificaciones
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 hover:border-emerald-400 hover:shadow-md transition-all shadow-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-mono font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                        BIM-REVIT
                      </span>
                      <span className="badge-pill badge-optimal">Activo</span>
                    </div>
                    <h4 className="text-base font-bold text-slate-900">Autodesk Revit Estructural 2026</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Modelado de cimentaciones, vigas, columnas, muros pantalla y colocación de acero de refuerzo cumpliendo recubrimientos de la norma E.060.
                    </p>
                    <div className="pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500 font-medium">
                      <span>16 Módulos Prácticos</span>
                      <span className="text-emerald-700 font-bold">Nivel Intermedio</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 hover:border-amber-400 hover:shadow-md transition-all shadow-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        COSTOS-S10
                      </span>
                      <span className="badge-pill badge-optimal">Activo</span>
                    </div>
                    <h4 className="text-base font-bold text-slate-900">S10 Costos, Presupuestos & APU</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Elaboración de hojas de metrados, análisis de precios unitarios con rendimientos CAPECO, fórmula polinómica y cronograma valorizado.
                    </p>
                    <div className="pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500 font-medium">
                      <span>12 Módulos Prácticos</span>
                      <span className="text-amber-700 font-bold">Nivel Avanzado</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4 hover:border-cyan-400 hover:shadow-md transition-all shadow-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        CIVIL-3D
                      </span>
                      <span className="badge-pill badge-cyan">Próximamente</span>
                    </div>
                    <h4 className="text-base font-bold text-slate-900">Autodesk Civil 3D Vial</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Trazado de ejes viales, perfiles longitudinales, secciones transversales y cálculo de volúmenes de corte y relleno según norma DG-2018.
                    </p>
                    <div className="pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500 font-medium">
                      <span>14 Módulos Prácticos</span>
                      <span className="text-cyan-700 font-bold">Nivel Integral</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Vista 3: Biblioteca de Normativas RNE */}
          {seccionActiva === "normativas" && (
            <div className="space-y-6">
              <div className="card-obsidian p-7 space-y-6">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-600" />
                    <span>Compendio Técnico de Normativas de Construcción (Perú)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Criterios normativos integrados con la base de conocimiento del Tutor IA
                  </p>
                </div>

                {/* Selector de Norma */}
                <div className="flex gap-2 border-b border-slate-100 pb-3">
                  {["E.060", "E.030", "G.050"].map((normaKey) => (
                    <button
                      key={normaKey}
                      onClick={() => setNormaActiva(normaKey)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        normaActiva === normaKey
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-200/60"
                      }`}
                    >
                      Norma {normaKey}
                    </button>
                  ))}
                </div>

                {/* Detalle de la norma seleccionada */}
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-base font-extrabold text-slate-900">
                        {normativasData[normaActiva].titulo}
                      </h4>
                      <p className="text-xs text-slate-600 mt-1">
                        {normativasData[normaActiva].resumen}
                      </p>
                    </div>
                    <span className="badge-pill bg-cyan-50 text-cyan-800 border border-cyan-200">Vigente SENCICO</span>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                      Puntos Críticos de Cumplimiento Técnico:
                    </div>
                    <ul className="space-y-2 text-xs text-slate-700">
                      {normativasData[normaActiva].puntosClave.map((pt, idx) => (
                        <li key={idx} className="flex items-start gap-2 bg-white p-3 rounded-xl border border-slate-200 font-medium shadow-2xs">
                          <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Vista 4: Mi Rendimiento */}
          {seccionActiva === "rendimiento" && (
            <div className="space-y-6">
              <div className="card-obsidian p-7 space-y-6">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-600" />
                    <span>Historial de Atención Biometría Personal</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Métricas recopiladas en tus sesiones de software para prevenir la fatiga cognitiva
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Atención Media</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">94%</div>
                    <div className="text-[11px] text-emerald-700 font-bold mt-1">Rango Óptimo</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Horas de Modelado</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">28.5 hrs</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1">Este mes</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Alertas de Fatiga</div>
                    <div className="text-2xl font-black text-amber-700 mt-1">2</div>
                    <div className="text-[11px] text-amber-700 font-bold mt-1">Baja incidencia</div>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Dudas Resueltas IA</div>
                    <div className="text-2xl font-black text-cyan-800 mt-1">42</div>
                    <div className="text-[11px] text-cyan-800 font-bold mt-1">Gemini Flash</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
