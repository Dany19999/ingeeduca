import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  MessageSquare,
  Users,
  GraduationCap,
  Sparkles,
  Volume2,
  VolumeX,
  Check,
  Clock,
  User
} from "lucide-react";

/**
 * Componente de Chat en Vivo Sincrónico para el Aula Virtual y Dashboard Docente
 * Permite comunicación bidireccional en tiempo real entre docentes y estudiantes
 * mediante WebSocket (/ws/aula/{aula_id}) con persistencia en memoria y API REST.
 */
export default function ChatEnVivo({
  aulaId = "aula-1",
  usuario = null,
  rol = "estudiante", // "docente" | "estudiante"
  wsRef = null,
  mensajes = [],
  onEnviarMensaje = null,
  temaClase = "Modelado BIM & Revit"
}) {
  const [textoMensaje, setTextoMensaje] = useState("");
  const [mensajesLocales, setMensajesLocales] = useState(mensajes || []);
  const [sonidoHabilitado, setSonidoHabilitado] = useState(true);
  const finMensajesRef = useRef(null);
  const inputRef = useRef(null);

  // Sincronizar mensajes entrantes
  useEffect(() => {
    if (Array.isArray(mensajes) && mensajes.length > 0) {
      setMensajesLocales(mensajes);
    }
  }, [mensajes]);

  // Cargar historial inicial desde el backend REST como fallback
  useEffect(() => {
    let activo = true;
    const cargarHistorial = async () => {
      try {
        const aid = String(aulaId).trim();
        const res = await fetch(`http://localhost:8000/api/salas/${aid}/mensajes`);
        if (res.ok) {
          const data = await res.json();
          if (activo && Array.isArray(data) && data.length > 0) {
            setMensajesLocales((prev) => {
              const mapa = new Map();
              prev.forEach((m) => m.id && mapa.set(m.id, m));
              data.forEach((m) => m.id && mapa.set(m.id, m));
              return Array.from(mapa.values()).sort(
                (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
              );
            });
          }
        }
      } catch (err) {
        console.warn("[ChatEnVivo] No se pudo cargar historial REST:", err);
      }
    };

    cargarHistorial();
    return () => {
      activo = false;
    };
  }, [aulaId]);

  // Auto-scroll al final en cada mensaje nuevo
  useEffect(() => {
    if (finMensajesRef.current) {
      finMensajesRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [mensajesLocales]);

  // Reproducir un suave sonido síntesis Web Audio al recibir mensaje de otro usuario
  const reproducirChimeNotificacion = () => {
    if (!sonidoHabilitado) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // Mi5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // La5

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.26);
    } catch {}
  };

  const handleEnviar = (e) => {
    if (e) e.preventDefault();
    const textoLimpio = textoMensaje.trim();
    if (!textoLimpio) return;

    const remitenteNombre =
      usuario?.nombre || (rol === "docente" ? "Docente Titular" : "Estudiante");
    const remitenteCorreo = usuario?.correo || usuario?.email || "";

    const nuevoMsg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      remitente: remitenteNombre,
      rol: rol,
      correo: remitenteCorreo,
      texto: textoLimpio,
      hora: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      timestamp: Date.now()
    };

    // 1. Agregar inmediatamente al estado local
    setMensajesLocales((prev) => [...prev, nuevoMsg]);
    setTextoMensaje("");

    // 2. Transmitir por WebSocket si está disponible
    if (wsRef?.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            tipo: "chat_mensaje",
            aula_id: aulaId,
            mensaje: nuevoMsg
          })
        );
      } catch (err) {
        console.warn("[ChatEnVivo] Error enviando por WebSocket:", err);
      }
    }

    // 3. Fallback / redundancia vía REST
    try {
      fetch(`http://localhost:8000/api/salas/${aulaId}/mensajes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoMsg)
      }).catch(() => {});
    } catch {}

    // 4. Notificar a componente padre si hay callback
    if (typeof onEnviarMensaje === "function") {
      onEnviarMensaje(nuevoMsg);
    }

    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Canned chips según el rol
  const chipsSugeridos =
    rol === "docente"
      ? [
          "📢 Revisen el plano en Revit",
          "❓ ¿Tienen alguna duda de la sesión?",
          "⏱️ 5 minutos para completar el ejercicio",
          "👏 Buen trabajo con el modelado"
        ]
      : [
          "🙋‍♂️ Tengo una consulta, profesor",
          "👍 Todo claro con la explicación",
          "📐 ¿Qué recubrimiento aplicamos?",
          "✅ Ejercicio terminado"
        ];

  return (
    <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200 select-none overflow-hidden">
      {/* Header del Chat */}
      <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-700 text-white flex items-center justify-center font-bold shadow-xs">
            <MessageSquare size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-slate-900 leading-tight">
                Chat en Vivo de Sala
              </h3>
              <span className="flex items-center gap-1 font-mono text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded-full font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                ONLINE
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]">
              {temaClase}
            </p>
          </div>
        </div>

        <button
          onClick={() => setSonidoHabilitado(!sonidoHabilitado)}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
            sonidoHabilitado
              ? "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
              : "bg-rose-50 text-rose-600 border-rose-200"
          }`}
          title={sonidoHabilitado ? "Silenciar notificaciones" : "Activar sonido"}
        >
          {sonidoHabilitado ? <Volume2 size={13} /> : <VolumeX size={13} />}
        </button>
      </div>

      {/* Área de Mensajes */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 min-h-0 bg-slate-50/60">
        {mensajesLocales.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-emerald-600 flex items-center justify-center mb-2.5 shadow-xs">
              <MessageSquare size={22} />
            </div>
            <h4 className="text-xs font-bold text-slate-800 mb-1">
              Sala de Conversación Abierta
            </h4>
            <p className="text-[11px] text-slate-500 max-w-[220px] leading-relaxed">
              Docentes y estudiantes pueden enviar mensajes, preguntas e indicaciones en vivo
              durante la clase.
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5 justify-center max-w-[240px]">
              <span className="text-[9.5px] bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                ⚡ Sincronización instantánea
              </span>
              <span className="text-[9.5px] bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                🔒 Canal seguro de cátedra
              </span>
            </div>
          </div>
        ) : (
          mensajesLocales.map((msg, idx) => {
            const esMio =
              (usuario?.email && msg.correo && usuario.email.toLowerCase() === msg.correo.toLowerCase()) ||
              (usuario?.correo && msg.correo && usuario.correo.toLowerCase() === msg.correo.toLowerCase()) ||
              (usuario?.nombre && msg.remitente && usuario.nombre.trim() === msg.remitente.trim()) ||
              (msg.rol === rol && msg.remitente?.includes("Tú"));

            const esDocente = msg.rol === "docente";

            return (
              <div
                key={msg.id || idx}
                className={`flex flex-col ${esMio ? "items-end" : "items-start"} animate-in fade-in duration-200`}
              >
                {/* Cabecera del Mensaje (Nombre + Rol + Hora) */}
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px]">
                  {esDocente ? (
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <GraduationCap size={12} className="text-emerald-600" />
                      {esMio ? "Tú (Docente Titular)" : msg.remitente}
                    </span>
                  ) : (
                    <span className="font-bold text-slate-700 flex items-center gap-1">
                      <User size={11} className="text-slate-400" />
                      {esMio ? "Tú" : msg.remitente}
                    </span>
                  )}
                  <span className="text-slate-400 font-mono text-[9px]">
                    {msg.hora || "Ahora"}
                  </span>
                </div>

                {/* Burbuja del Mensaje */}
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed break-words shadow-2xs select-text ${
                    esMio
                      ? "bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-tr-xs"
                      : esDocente
                      ? "bg-emerald-50/90 border border-emerald-300 text-slate-900 rounded-tl-xs"
                      : "bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs"
                  }`}
                >
                  {msg.texto}
                </div>
              </div>
            );
          })
        )}
        <div ref={finMensajesRef} />
      </div>

      {/* Chips Rápidos de Conversación */}
      <div className="px-3 py-1.5 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1 font-medium">
          <Sparkles size={11} className="text-amber-500" />
          Rápido:
        </span>
        {chipsSugeridos.map((chip, i) => (
          <button
            key={i}
            onClick={() => setTextoMensaje(chip)}
            className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-slate-200 shrink-0 transition-colors cursor-pointer active:scale-95"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input de Mensaje */}
      <form
        onSubmit={handleEnviar}
        className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
      >
        <input
          ref={inputRef}
          type="text"
          value={textoMensaje}
          onChange={(e) => setTextoMensaje(e.target.value)}
          placeholder={
            rol === "docente"
              ? "Instrucción o mensaje a la clase..."
              : "Pregunta al docente y compañeros..."
          }
          className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-xs bg-slate-50/70 text-slate-800 placeholder-slate-400 transition-all"
        />

        <button
          type="submit"
          disabled={!textoMensaje.trim()}
          className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
          title="Enviar mensaje"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}

