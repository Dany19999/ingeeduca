import React, { useState } from "react";
import {
  Mail,
  Lock,
  ArrowRight,
  GraduationCap,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Eye,
  EyeOff,
  Building2,
  Activity,
  User,
  UserPlus,
  LogIn,
  Database
} from "lucide-react";
import heroImg from "./assets/image.png";

export default function Login({ onLoginSuccess }) {
  const [modo, setModo] = useState("login"); // 'login' | 'registro'
  const [rol, setRol] = useState("docente");
  const [nombre, setNombre] = useState("");
  const [especialidad, setEspecialidad] = useState("Modelado BIM & Estructuras");
  const [email, setEmail] = useState("docente@ingeeduca.edu.pe");
  const [password, setPassword] = useState("password123");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [mensajeExito, setMensajeExito] = useState("");

  const cambiarModo = (nuevoModo) => {
    setModo(nuevoModo);
    setError("");
    setMensajeExito("");
    if (nuevoModo === "registro") {
      setNombre("");
      setEmail("");
      setPassword("");
      setRol("estudiante");
      setEspecialidad("Ingeniería Civil & BIM");
    } else {
      setRol("docente");
      setEmail("docente@ingeeduca.edu.pe");
      setPassword("password123");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMensajeExito("");

    if (modo === "registro") {
      if (!nombre.trim() || nombre.trim().length < 3) {
        setError("Por favor ingresa tu nombre y apellido (mínimo 3 caracteres).");
        return;
      }
      if (!email.trim() || !email.includes("@")) {
        setError("Por favor ingresa un correo electrónico institucional válido.");
        return;
      }
      if (password.length < 6) {
        setError("La contraseña de acceso debe tener al menos 6 caracteres.");
        return;
      }

      setCargando(true);
      try {
        const res = await fetch("http://localhost:8000/api/v1/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: nombre.trim(),
            email: email.trim().toLowerCase(),
            password,
            rol,
            especialidad: especialidad.trim() || "Ingeniería Civil"
          })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.detail || "Error al registrar la cuenta.");
        }

        setMensajeExito("¡Cuenta registrada exitosamente en la base de datos! Conectando...");
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("usuario", JSON.stringify(data));
        setTimeout(() => {
          onLoginSuccess(data);
        }, 900);
      } catch (err) {
        if (err.message.includes("Failed to fetch") || err.name === "TypeError") {
          setError("No se pudo conectar con el backend (FastAPI en puerto 8000). Asegúrate de iniciar 'iniciar_backend.bat'.");
        } else {
          setError(err.message || "Error al registrar la cuenta.");
        }
      } finally {
        setCargando(false);
      }
    } else {
      // MODO INICIAR SESIÓN
      if (!email.trim() || !password.trim()) {
        setError("Ingresa tu correo y contraseña institucional.");
        return;
      }

      setCargando(true);
      try {
        const res = await fetch("http://localhost:8000/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
            rol
          })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.detail || "Credenciales incorrectas.");
        }

        localStorage.setItem("token", data.access_token);
        localStorage.setItem("usuario", JSON.stringify(data));
        onLoginSuccess(data);
      } catch (err) {
        if (err.message.includes("Failed to fetch") || err.name === "TypeError") {
          setError("No se pudo conectar con el backend (FastAPI en puerto 8000). Asegúrate de iniciar 'iniciar_backend.bat'.");
        } else {
          setError(err.message || "Error de autenticación.");
        }
      } finally {
        setCargando(false);
      }
    }
  };

  const seleccionarDemo = (tipoRol, correoDemo) => {
    setModo("login");
    setRol(tipoRol);
    setEmail(correoDemo);
    setPassword("password123");
    setError("");
    setMensajeExito("");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-slate-50 via-slate-100/70 to-indigo-50/40 font-sans text-slate-800 relative overflow-hidden">
      {/* Luces ambientales suaves */}
      <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-emerald-500/8 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-500/6 rounded-full blur-[130px] pointer-events-none" />

      {/* Contenedor Principal Split Executive */}
      <div className="relative z-10 w-full max-w-5xl bg-white border border-slate-200/90 rounded-3xl shadow-xl shadow-slate-200/70 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        
        {/* Columna Izquierda: Showcase Visual & Tecnológico de INGEDUCA */}
        <div className="lg:col-span-6 relative p-8 sm:p-10 flex flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 text-white border-b lg:border-b-0 lg:border-r border-slate-200/80">
          {/* Imagen de fondo con gradiente elegante */}
          <div className="absolute inset-0 z-0">
            <img
              src={heroImg}
              alt="INGEDUCA Construcción y BIM"
              className="w-full h-full object-cover opacity-25 filter brightness-100 contrast-110 scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/85 to-transparent" />
          </div>

          {/* Header Superior del Banner */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/35 px-3.5 py-1.5 rounded-full text-xs font-bold text-emerald-300 mb-6 shadow-xs">
              <GraduationCap size={16} className="text-emerald-300" />
              <span>INGEDUCA • Campus Virtual</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
              Formación Profesional en <span className="text-emerald-400">Ingeniería & Construcción</span>
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm mt-3 leading-relaxed">
              Aprende modelado BIM con Revit, análisis de costos en S10 y diseño con normativas peruanas del RNE, con el acompañamiento docente continuo de nuestros especialistas.
            </p>
          </div>

          {/* Chips de Capacidades Técnicas */}
          <div className="relative z-10 my-8 space-y-3">
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/10 border border-white/15 shadow-sm backdrop-blur-md hover:border-emerald-400/40 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center shrink-0">
                <Database size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Persistencia con Base de Datos Relacional</h4>
                <p className="text-[11px] text-slate-300">SQLAlchemy + SQLite / PostgreSQL con encriptación Bcrypt</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/10 border border-white/15 shadow-sm backdrop-blur-md hover:border-amber-400/40 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center justify-center shrink-0">
                <GraduationCap size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Acompañamiento Docente Continuo</h4>
                <p className="text-[11px] text-slate-300">Consultas técnicas en vivo con normativas peruanas (E.060, E.030, G.050)</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/10 border border-white/15 shadow-sm backdrop-blur-md hover:border-cyan-400/40 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 flex items-center justify-center shrink-0">
                <Activity size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Aulas Virtuales Interactivas</h4>
                <p className="text-[11px] text-slate-300">Clases sincrónicas, telemetría biométrica y seguimiento de avance</p>
              </div>
            </div>
          </div>

          {/* Footer de la columna izquierda */}
          <div className="relative z-10 flex items-center gap-2 text-[11px] text-slate-300 border-t border-white/15 pt-4">
            <ShieldCheck size={15} className="text-emerald-400" />
            <span>Plataforma Oficial de Capacitación Técnica y Especializada</span>
          </div>
        </div>

        {/* Columna Derecha: Formulario de Autenticación / Registro */}
        <div className="lg:col-span-6 p-8 sm:p-10 flex flex-col justify-between bg-white text-slate-800">
          <div>
            {/* Selector de Modo: Login vs Registro */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Base de Datos Activa
              </span>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                SQLAlchemy • JWT
              </span>
            </div>

            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200 mb-6">
              <button
                type="button"
                onClick={() => cambiarModo("login")}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  modo === "login"
                    ? "bg-white text-emerald-700 shadow-sm border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <LogIn size={14} />
                <span>Iniciar Sesión</span>
              </button>
              <button
                type="button"
                onClick={() => cambiarModo("registro")}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  modo === "registro"
                    ? "bg-white text-emerald-700 shadow-sm border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <UserPlus size={14} />
                <span>Crear Cuenta</span>
              </button>
            </div>

            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {modo === "login" ? "Iniciar Sesión" : "Crear Nueva Cuenta"}
            </h1>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              {modo === "login"
                ? "Ingresa tus credenciales registradas en la base de datos"
                : "Regístrate con tus datos reales para acceder al Campus Virtual"}
            </p>

            {/* Selector de Perfil/Rol */}
            <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-100 border border-slate-200 mb-5">
              <button
                type="button"
                onClick={() => {
                  setRol("docente");
                  if (modo === "login") {
                    seleccionarDemo("docente", "docente@ingeeduca.edu.pe");
                  }
                }}
                className={`py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  rol === "docente"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25 border border-emerald-500"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                <UserCheck size={14} />
                <span>Docente / Asesor</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRol("estudiante");
                  if (modo === "login") {
                    seleccionarDemo("estudiante", "estudiante@ingeeduca.edu.pe");
                  }
                }}
                className={`py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  rol === "estudiante"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25 border border-emerald-500"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                <GraduationCap size={14} />
                <span>Estudiante</span>
              </button>
            </div>

            {/* Mensajes de Alerta */}
            {error && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs mb-4">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {mensajeExito && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs mb-4">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                <span>{mensajeExito}</span>
              </div>
            )}

            {/* Formulario Dinámico */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {modo === "registro" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nombres y Apellidos Completos
                  </label>
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                    <User size={16} className="text-slate-400 mr-2.5 shrink-0" />
                    <input
                      type="text"
                      required
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 outline-none font-medium"
                      placeholder={rol === "docente" ? "Ej: Mg. Ing. Fernando Castro" : "Ej: Bach. Roberto Silva"}
                    />
                  </div>
                </div>
              )}

              {modo === "registro" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Especialidad Principal
                  </label>
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                    <Building2 size={16} className="text-slate-400 mr-2.5 shrink-0" />
                    <input
                      type="text"
                      value={especialidad}
                      onChange={(e) => setEspecialidad(e.target.value)}
                      className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 outline-none font-medium"
                      placeholder="Ej: Modelado BIM con Revit / Costos S10"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Correo Institucional o Personal
                </label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                  <Mail size={16} className="text-slate-400 mr-2.5 shrink-0" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 outline-none font-medium"
                    placeholder="usuario@ingeeduca.edu.pe"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">Contraseña</label>
                  {modo === "login" && (
                    <span className="text-[11px] text-slate-400">Mínimo 6 caracteres</span>
                  )}
                </div>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                  <Lock size={16} className="text-slate-400 mr-2.5 shrink-0" />
                  <input
                    type={mostrarPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 outline-none font-medium"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword(!mostrarPassword)}
                    className="text-slate-400 hover:text-slate-600 ml-2 cursor-pointer"
                  >
                    {mostrarPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={cargando}
                className="w-full btn-emerald py-3 px-4 text-xs tracking-wide uppercase font-bold mt-2"
              >
                <span>
                  {cargando
                    ? "Procesando en Base de Datos..."
                    : modo === "login"
                    ? "Ingresar a la Plataforma"
                    : "Crear Cuenta en Base de Datos"}
                </span>
                <ArrowRight size={15} />
              </button>
            </form>

            {/* Accesos Rápidos de Evaluación (Semillas Oficiales de BD) */}
            {modo === "login" && (
              <div className="mt-5 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-2.5">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider text-slate-600">
                    <Sparkles size={13} className="text-amber-500" />
                    Cuentas Pre-cargadas en BD (Tesis)
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold font-mono border border-emerald-200">
                    1 Clic
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => seleccionarDemo("docente", "docente@ingeeduca.edu.pe")}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                      rol === "docente" && email === "docente@ingeeduca.edu.pe"
                        ? "bg-emerald-50/80 border-emerald-500/50 text-emerald-900 shadow-sm"
                        : "bg-slate-50/70 border-slate-200 text-slate-600 hover:border-emerald-400 hover:bg-slate-100/70"
                    }`}
                  >
                    <div className="flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <UserCheck size={13} />
                      <span>Docente Titular</span>
                    </div>
                    <span className="text-[11px] text-slate-800 font-semibold mt-0.5">Mg. Víctor Huamán</span>
                    <span className="text-[10px] text-slate-500">password123</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => seleccionarDemo("estudiante", "estudiante@ingeeduca.edu.pe")}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                      rol === "estudiante" && email === "estudiante@ingeeduca.edu.pe"
                        ? "bg-emerald-50/80 border-emerald-500/50 text-emerald-900 shadow-sm"
                        : "bg-slate-50/70 border-slate-200 text-slate-600 hover:border-emerald-400 hover:bg-slate-100/70"
                    }`}
                  >
                    <div className="flex items-center gap-1 text-xs font-bold text-teal-700">
                      <CheckCircle2 size={13} />
                      <span>Estudiante</span>
                    </div>
                    <span className="text-[11px] text-slate-800 font-semibold mt-0.5">Bach. María Paucar</span>
                    <span className="text-[10px] text-slate-500">password123</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Seguridad al pie */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-5 pt-3 border-t border-slate-100">
            <span className="flex items-center gap-1.5 text-slate-500">
              <ShieldCheck size={13} className="text-emerald-600" />
              Autenticación Criptográfica Bcrypt & JWT
            </span>
            <span>© {new Date().getFullYear()} INGEDUCA CORP</span>
          </div>
        </div>
      </div>
    </div>
  );
}