import React, { useState, useEffect, useRef, useCallback } from "react";
import { API_URL, getWsAulaUrl, getWsAlertasUrl } from "../config/api.js";
import * as _tf from "@tensorflow/tfjs";
import * as tmImage from "@teachablemachine/image";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  Hand,
  Smile,
  Users,
  PhoneOff,
  ChevronLeft,
  Grid,
  Layout,
  Clock,
  FileSpreadsheet,
  Building2,
  X,
  Volume2,
  CheckCircle2,
  GraduationCap,
  Camera,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Palette,
  Layers,
  Check,
  Settings,
  Share2,
  Maximize2,
  Minimize2,
  StopCircle,
  Laptop,
  Cast,
  Sparkles,
  Award,
  Eye,
  HelpCircle,
  MessageSquare,
  MoreHorizontal,
  ChevronRight
} from "lucide-react";
import ChatAgent from "./ChatAgent.jsx";
import ChatEnVivo from "./ChatEnVivo.jsx";
import FichaTecnicaModal from "./FichaTecnicaModal.jsx";

export default function AulaVirtual({
  rol = "estudiante", // "docente" o "estudiante"
  clase,
  usuario,
  onSalir,
  estudiantesConectados = [],
  onEmitirMetrica
}) {
  const aulaId = clase?.id ? (String(clase.id).startsWith("aula-") ? String(clase.id) : `aula-${clase.id}`) : "aula-1";

  // Participantes sincronizados en sala en tiempo real y transmisión de fotogramas
  const [participantesEnSala, setParticipantesEnSala] = useState([]);
  const [pantallaFrame, setPantallaFrame] = useState(null);
  const wsRef = useRef(null);
  const frameIntervalRef = useRef(null);
  const canvasCaptureRef = useRef(null);

  // Sincronización de video bidireccional en tiempo real (Cámara Docente y Estudiantes)
  const [streamVideoDocente, setStreamVideoDocente] = useState(null);
  const [streamVideoEstudiantes, setStreamVideoEstudiantes] = useState({});
  const canvasDocenteStreamRef = useRef(null);
  const canvasEstudianteStreamRef = useRef(null);
  const timerStreamDocenteRef = useRef(null);
  const timerStreamEstudianteRef = useRef(null);

  // Participantes sincronizados reales de la clase
  const listaAlumnosEnSala = participantesEnSala.filter((p) => p.rol === "estudiante");
  const listaEstudiantesActivos = listaAlumnosEnSala.length > 0 ? listaAlumnosEnSala : estudiantesConectados;
  const alumnoMuestra = rol === "docente" ? (listaEstudiantesActivos[0] || null) : null;
  const inicialesEstudianteMuestra = alumnoMuestra?.nombre
    ? alumnoMuestra.nombre.split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "--";

  const nombreDocente = (rol === "docente" && usuario?.nombre)
    ? usuario.nombre
    : (clase?.docente || "Mg. Ing. Víctor Huamán (Docente Titular)");
  const nombreEstudianteActivo =
    rol === "estudiante"
      ? (usuario?.nombre || "Estudiante")
      : (alumnoMuestra?.nombre || "Esperando estudiantes...");

  // Controles de Hardware y Conferencia
  const [micActivo, setMicActivo] = useState(true);
  const [camaraActiva, setCamaraActiva] = useState(true);
  const [camaraDocenteActiva, setCamaraDocenteActiva] = useState(true);
  const [pantallaCompartida, setPantallaCompartida] = useState(true);
  const [presentadorActual, setPresentadorActual] = useState({
    id: "docente-titular",
    nombre: clase?.docente
      ? `${clase.docente} (Docente Titular)`
      : rol === "docente" && usuario?.nombre
      ? `${usuario.nombre} (Docente Titular)`
      : "Mg. Ing. Víctor Huamán (Docente Titular)",
    rol: "docente",
    esTuPantalla: rol === "docente",
    tipo: "software", // "real" | "software"
    software: clase?.software || "Autodesk Revit 2026",
    tituloVentana: "Revit 2026 - Modelado de Zapatas y Vigas Confinadas"
  });
  const [streamPantalla, setStreamPantalla] = useState(null);
  const streamPantallaRef = useRef(null);
  const [modalCompartir, setModalCompartir] = useState(false);
  const [pantallaMaximizada, setPantallaMaximizada] = useState(false);
  const [notificacionShare, setNotificacionShare] = useState(null);
  const [tabModalShare, setTabModalShare] = useState("pantalla"); // "pantalla", "software", "ceder"
  const [manoLevantada, setManoLevantada] = useState(false);
  const [reaccionActiva, setReaccionActiva] = useState(null);
  const [mostrarReacciones, setMostrarReacciones] = useState(false);
  const [mostrarHUD, setMostrarHUD] = useState(true);
  const [mostrarConfigCam, setMostrarConfigCam] = useState(false);

  // Selector de tema de fondo (Elimina el fondo negro y permite personalizar)
  // Opciones: "slate" (Estudio Ejecutivo), "campus" (Campus Arquitectónico), "aura" (Aura Tecnológica)
  const [temaFondo, setTemaFondo] = useState("slate");
  const [mostrarTemas, setMostrarTemas] = useState(false);

  // Modos de diseño: "escenario" (BIM / Pantalla al centro), "cuadricula" (Galería de Cámaras)
  const [modoDiseno, setModoDiseno] = useState("escenario");

  // Panel lateral derecho: "chat-vivo" (Chat de Sala en Vivo), "chat-gemini" (Asesor IA), "participantes", null
  // En móvil (< 768px), el chat debe iniciar cerrado por defecto para no aplastar el aula
  const [panelLateral, setPanelLateral] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return null;
    }
    return "chat-vivo";
  });
  const [mensajesChat, setMensajesChat] = useState([]);
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0);

  const handleEnviarMensajeChat = (nuevoMsg) => {
    setMensajesChat((prev) => {
      if (prev.some((m) => m.id === nuevoMsg.id)) return prev;
      return [...prev, nuevoMsg];
    });
  };

  // Software compartido en el escenario virtual: "revit" o "s10"
  const [softwareTab, setSoftwareTab] = useState(
    clase?.software?.includes("S10") ? "s10" : "revit"
  );

  // Controles interactivos del simulador 3D Revit
  const [rotacion3D, setRotacion3D] = useState(15);
  const [vistaAlambre, setVistaAlambre] = useState(false);
  const [mostrarCotas, setMostrarCotas] = useState(true);

  // Telemetría biométrica del estudiante
  const [scoreAtencion, setScoreAtencion] = useState(96);
  const [emocionActual, setEmocionActual] = useState("Atento");
  const [bloquearSimulacionManual, setBloquearSimulacionManual] = useState(false);
  const [notificacionMano, setNotificacionMano] = useState(null);

  // Integración Teachable Machine / TensorFlow.js
  const [modeloCargado, setModeloCargado] = useState(false);
  const [_errorModelo, setErrorModelo] = useState(null);
  const [iaPrediccionInfo, setIaPrediccionInfo] = useState(null);
  const [latenciaMs, setLatenciaMs] = useState(18);
  const [alertaPedagogica, setAlertaPedagogica] = useState(null);
  const [modalFichaTesis, setModalFichaTesis] = useState(false);
  const [intervencionPedagogica, setIntervencionPedagogica] = useState(null);
  const [mostrarModalIntervencion, setMostrarModalIntervencion] = useState(false);
  const [opcionPreguntaSeleccionada, setOpcionPreguntaSeleccionada] = useState(null);
  const [tiempoDescansoVisual, setTiempoDescansoVisual] = useState(15);
  const [intervencionEnviadaA, setIntervencionEnviadaA] = useState(null);
  const [pestanaMovil, setPestanaMovil] = useState("participantes"); // "participantes" | "chat"
  const [mostrarMenuMasMovil, setMostrarMenuMasMovil] = useState(false);

  const enviarIntervencionRapida = async (est) => {
    const stId = est.id || est.nombre;
    setIntervencionEnviadaA(stId);
    const payload = {
      tipo: "INTERVENCION_DOCENTE",
      aula_id: aulaId || "AULA-101",
      estudiante: est.nombre || "Estudiante",
      estudiante_id: est.id || est.db_id || null,
      motivo: "atencion",
      titulo: "¡Pausa Activa de Atención!",
      mensaje: `Estimado(a) ${est.nombre || "Estudiante"}, el docente solicita reforzar la concentración en el modelado técnico.`,
      pregunta_rapida: {
        enunciado: "¿Cuál es el factor de aceleración sísmica (Z) para Zona 4 según la Norma E.030?",
        opciones: ["Z = 0.45", "Z = 0.35", "Z = 0.25"],
        correcta: 0
      }
    };
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(payload));
      } catch (e) {
        console.warn("Error enviando por ws:", e);
      }
    }
    try {
      await fetch(`${API_URL}/api/aulas/${aulaId || "AULA-101"}/intervencion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.warn("Error enviando intervencion:", err);
    }
    setTimeout(() => {
      setIntervencionEnviadaA(null);
    }, 4000);
  };
  const wsAlertasEstudianteRef = useRef(null);
  const conteoDistraccionRef = useRef(0);
  const modeloIaRef = useRef(null);
  const videoEstudianteRef = useRef(null);
  const videoHiddenIaRef = useRef(null);
  const isPredictingRef = useRef(false);
  const ultimoEnvioMetricaRef = useRef(0);
  const ultimoIncidenteEmitidoRef = useRef(0);

  // Estado del flujo de cámara real
  const [streamLocal, setStreamLocal] = useState(null);
  const [estadoCamara, setEstadoCamara] = useState("iniciando"); // "iniciando", "activa", "denegada", "apagada", "virtual"
  const [errorCamaraMsg, setErrorCamaraMsg] = useState("");
  const [nivelAudio, setNivelAudio] = useState(65);
  const [dispositivosVideo, setDispositivosVideo] = useState([]);
  const [dispositivoSeleccionado, setDispositivoSeleccionado] = useState("");

  // Refs de video y audio
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const animAudioRef = useRef(null);
  const videoDocenteDomRef = useRef(null);

  // Callback ref infalible para asignar srcObject a cualquier elemento <video>
  const setVideoRef = useCallback((node) => {
    if (node) {
      node.muted = true;
      if (rol === "estudiante") {
        videoEstudianteRef.current = node;
      } else {
        videoDocenteDomRef.current = node;
      }
      if (streamRef.current && node.srcObject !== streamRef.current) {
        node.srcObject = streamRef.current;
        node.play().catch(() => {});
      }
    }
  }, [rol]);

  // Sincronizar streamLocal con el elemento video del docente en tiempo real
  useEffect(() => {
    if (streamLocal && videoDocenteDomRef.current) {
      if (videoDocenteDomRef.current.srcObject !== streamLocal) {
        videoDocenteDomRef.current.srcObject = streamLocal;
      }
      videoDocenteDomRef.current.muted = true;
      videoDocenteDomRef.current.play().catch(() => {});
    }
  }, [streamLocal, camaraDocenteActiva]);

  const screenVideoDomRef = useRef(null);

  // Callback ref para el video de pantalla compartida WebRTC
  const setScreenVideoRef = useCallback((node) => {
    if (node) {
      screenVideoDomRef.current = node;
      if (streamPantallaRef.current && node.srcObject !== streamPantallaRef.current) {
        node.srcObject = streamPantallaRef.current;
        node.play().catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    if (screenVideoDomRef.current && streamPantalla) {
      if (screenVideoDomRef.current.srcObject !== streamPantalla) {
        screenVideoDomRef.current.srcObject = streamPantalla;
        screenVideoDomRef.current.play().catch(() => {});
      }
    }
  }, [streamPantalla]);

  // Generador de MediaStream en vivo (Canvas 30 FPS) infalible para Cátedra / Estudiante
  const crearStreamEstudioEnVivo = useCallback(({ nombre = "Docente Titular", rol = "docente", fotoUrl = null }) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");

    let img = null;
    if (fotoUrl) {
      img = new Image();
      img.crossOrigin = "anonymous";
      img.src = fotoUrl;
    }

    const palabras = (nombre || "").trim().split(/\s+/);
    const iniciales = palabras.length >= 2
      ? (palabras[0][0] + palabras[1][0]).toUpperCase()
      : (nombre ? nombre.substring(0, 2).toUpperCase() : (rol === "docente" ? "DOC" : "ALU"));

    let frameCount = 0;
    const startTime = Date.now();

    const drawFrame = () => {
      frameCount++;
      const now = Date.now();
      const elapsed = now - startTime;
      const t = elapsed / 1000;

      // Fondo oscuro tecnológico de estudio
      const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      bgGrad.addColorStop(0, "#090d16");
      bgGrad.addColorStop(0.5, "#0f172a");
      bgGrad.addColorStop(1, "#020617");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Rejilla sutil de estudio técnico
      ctx.strokeStyle = "rgba(148, 163, 184, 0.05)";
      ctx.lineWidth = 1;
      const gridSize = 48;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Halo radial de iluminación de estudio
      const haloX = canvas.width / 2;
      const haloY = canvas.height / 2;
      const haloRadius = 380 + Math.sin(t * 1.5) * 20;
      const halo = ctx.createRadialGradient(haloX, haloY, 40, haloX, haloY, haloRadius);
      if (rol === "docente") {
        halo.addColorStop(0, "rgba(16, 185, 129, 0.18)");
        halo.addColorStop(0.6, "rgba(16, 185, 129, 0.04)");
        halo.addColorStop(1, "rgba(0, 0, 0, 0)");
      } else {
        halo.addColorStop(0, "rgba(99, 102, 241, 0.20)");
        halo.addColorStop(0.6, "rgba(99, 102, 241, 0.05)");
        halo.addColorStop(1, "rgba(0, 0, 0, 0)");
      }
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Renderizar imagen fotográfica o avatar central
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save();
        const breathScale = 1 + Math.sin(t * 1.2) * 0.012;
        const targetW = canvas.width * breathScale;
        const targetH = canvas.height * breathScale;
        const targetX = (canvas.width - targetW) / 2;
        const targetY = (canvas.height - targetH) / 2;

        ctx.drawImage(img, targetX, targetY, targetW, targetH);

        const vignette = ctx.createRadialGradient(
          canvas.width / 2, canvas.height / 2, 260,
          canvas.width / 2, canvas.height / 2, 680
        );
        vignette.addColorStop(0, "rgba(15, 23, 42, 0)");
        vignette.addColorStop(0.7, "rgba(15, 23, 42, 0.45)");
        vignette.addColorStop(1, "rgba(2, 6, 23, 0.85)");
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      } else {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2 - 20;
        const r = 110;

        const pulseR = r + 16 + Math.sin(t * 3) * 6;
        ctx.strokeStyle = rol === "docente" ? "rgba(16, 185, 129, 0.45)" : "rgba(99, 102, 241, 0.45)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
        ctx.stroke();

        const circleGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        if (rol === "docente") {
          circleGrad.addColorStop(0, "#059669");
          circleGrad.addColorStop(1, "#047857");
        } else {
          circleGrad.addColorStop(0, "#4f46e5");
          circleGrad.addColorStop(1, "#3730a3");
        }
        ctx.fillStyle = circleGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 72px 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(iniciales, cx, cy);
      }

      // Retículas de encuadre en las 4 esquinas
      ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
      ctx.lineWidth = 2;
      const cornerSize = 28;
      const pad = 36;
      ctx.beginPath();
      ctx.moveTo(pad, pad + cornerSize); ctx.lineTo(pad, pad); ctx.lineTo(pad + cornerSize, pad);
      ctx.moveTo(canvas.width - pad - cornerSize, pad); ctx.lineTo(canvas.width - pad, pad); ctx.lineTo(canvas.width - pad, pad + cornerSize);
      ctx.moveTo(pad, canvas.height - pad - cornerSize); ctx.lineTo(pad, canvas.height - pad); ctx.lineTo(pad + cornerSize, canvas.height - pad);
      ctx.moveTo(canvas.width - pad - cornerSize, canvas.height - pad); ctx.lineTo(canvas.width - pad, canvas.height - pad); ctx.lineTo(canvas.width - pad, canvas.height - pad - cornerSize);
      ctx.stroke();
    };

    drawFrame();
    const intervalId = setInterval(drawFrame, 1000 / 30);
    const stream = canvas.captureStream(30);
    stream._cleanup = () => clearInterval(intervalId);
    stream._isVirtual = true;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const actx = new AudioCtx();
        const osc = actx.createOscillator();
        const dst = actx.createMediaStreamDestination();
        const gain = actx.createGain();
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(dst);
        osc.start();
        const audioTrack = dst.stream.getAudioTracks()[0];
        if (audioTrack) {
          stream.addTrack(audioTrack);
        }
        stream._audioCtx = actx;
      }
    } catch {}

    return stream;
  }, []);

  // Función principal para iniciar la cámara web
  const iniciarCamara = useCallback(async (deviceId = "") => {
    setEstadoCamara("iniciando");
    setErrorCamaraMsg("");
    
    // Detener stream anterior si existía
    if (streamRef.current) {
      if (streamRef.current._cleanup) {
        try { streamRef.current._cleanup(); } catch {}
      }
      if (streamRef.current._audioCtx) {
        try { streamRef.current._audioCtx.close(); } catch {}
      }
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    let stream = null;

    if (navigator?.mediaDevices?.getUserMedia) {
      try {
        const videoOptions = deviceId
          ? { deviceId: { exact: deviceId } }
          : { width: { ideal: 1280, min: 640 }, height: { ideal: 720, min: 480 } };

        stream = await navigator.mediaDevices.getUserMedia({
          video: videoOptions,
          audio: false
        });
      } catch (errOpt) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (errBasico) {
          console.info("[AulaVirtual] Dispositivo físico no detectado o restringido, activando feed en vivo nativo:", errBasico);
          stream = null;
        }
      }
    }

    // Si la cámara física no está conectada o no hay permisos, activar el feed en vivo nativo de alta resolución
    if (!stream) {
      stream = crearStreamEstudioEnVivo({
        nombre: rol === "docente" ? nombreDocente : nombreEstudianteActivo,
        rol: rol,
        fotoUrl: null
      });
    }

    streamRef.current = stream;
    setStreamLocal(stream);
    setEstadoCamara("activa");
    setErrorCamaraMsg("");
    setCamaraDocenteActiva(true);
    setCamaraActiva(true);

    // Conectar inmediatamente a los elementos video del DOM
    const attachVideo = () => {
      if (videoDocenteDomRef.current) {
        videoDocenteDomRef.current.srcObject = stream;
        videoDocenteDomRef.current.muted = true;
        videoDocenteDomRef.current.play().catch(() => {});
      }
      if (videoEstudianteRef.current) {
        videoEstudianteRef.current.srcObject = stream;
        videoEstudianteRef.current.muted = true;
        videoEstudianteRef.current.play().catch(() => {});
      }
      if (videoHiddenIaRef.current) {
        videoHiddenIaRef.current.srcObject = stream;
        videoHiddenIaRef.current.muted = true;
        videoHiddenIaRef.current.play().catch(() => {});
      }
    };
    attachVideo();
    setTimeout(attachVideo, 50);
    setTimeout(attachVideo, 250);

    // Listar cámaras disponibles
    try {
      if (navigator?.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        setDispositivosVideo(videoInputs);
      }
    } catch {
      // ignore
    }

    // Audio no bloqueante en segundo plano
    if (navigator?.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((audioStream) => {
        const audioTrack = audioStream.getAudioTracks()[0];
        if (audioTrack && streamRef.current) {
          streamRef.current.addTrack(audioTrack);
        }
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) {
            const audioCtx = new AudioCtx();
            audioContextRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(audioStream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const updateLevel = () => {
              analyser.getByteFrequencyData(dataArray);
              const avg = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
              setNivelAudio(Math.min(100, Math.round((avg / 128) * 100) + 15));
              animAudioRef.current = requestAnimationFrame(updateLevel);
            };
            updateLevel();
          }
        } catch {
          setNivelAudio(60);
        }
      }).catch((errAudio) => {
        console.warn("Micrófono no accesible, continuando con audio de cátedra:", errAudio);
        setNivelAudio(60);
      });
    } else {
      setNivelAudio(60);
    }
  }, [rol, nombreDocente, nombreEstudianteActivo, crearStreamEstudioEnVivo]);

  // Iniciar cámara al montar el componente
  useEffect(() => {
    iniciarCamara();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (streamPantallaRef.current) {
        streamPantallaRef.current.getTracks().forEach((t) => t.stop());
      }
      if (animAudioRef.current) {
        cancelAnimationFrame(animAudioRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [iniciarCamara]);

  // Manejar cambios en el toggle de cámara y micrófono
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = camaraActiva;
      });
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = micActivo;
      });
    }
  }, [camaraActiva, micActivo]);

  // Manejador centralizado para procesar y desplegar intervenciones pedagógicas del docente
  const procesarEventoIntervencion = useCallback((data) => {
    console.log("Evento intervención recibido en estudiante:", data);
    if (!data) return;

    const payload = data.tipo === "alerta_incidente" && data.alerta ? data.alerta : data;
    if (payload.tipo !== "INTERVENCION_DOCENTE") return;

    const estObjetivo = (payload.estudiante || "").toLowerCase().trim();
    const miNombre = (usuario?.nombre || "").toLowerCase().trim();
    const miCorreo = (usuario?.email || usuario?.correo || "").toLowerCase().trim();
    const miId = String(usuario?.id || "");
    const objId = String(payload.estudiante_id || "");

    const targetAula = String(payload.aula_id || "AULA-101").toUpperCase().trim();
    const miAula = String(aulaId || "AULA-101").toUpperCase().trim();
    const aulaCoincide = !targetAula || targetAula === miAula || targetAula.includes(miAula) || miAula.includes(targetAula);

    // 1. Coincidencia por ID o nombre parcial
    const coincideIdentidad = (
      !estObjetivo ||
      estObjetivo === "todos" ||
      (objId && miId && objId === miId) ||
      (miNombre && (miNombre.includes(estObjetivo) || estObjetivo.includes(miNombre))) ||
      (miCorreo && (miCorreo.includes(estObjetivo) || estObjetivo.includes(miCorreo)))
    );

    // 2. Si el estudiante se encuentra dentro del aula activa ('AULA-101') o coincide identidad
    // En entorno de pruebas/desarrollo, si el aula coincide y rol es estudiante, MOSTRAR directamente
    const debeMostrar = (rol === "estudiante" && (coincideIdentidad || aulaCoincide));

    if (debeMostrar) {
      console.log("-> Mostrando modal de intervención pedagógica en pantalla del estudiante:", payload);
      setIntervencionPedagogica(payload);
      setMostrarModalIntervencion(true);
      setOpcionPreguntaSeleccionada(null);
      setTiempoDescansoVisual(15);
    } else {
      console.log("-> Intervención ignorada por filtro de rol/aula:", { rol, coincideIdentidad, aulaCoincide });
    }
  }, [aulaId, rol, usuario]);

  // Sincronización en tiempo real de la sala (WebSocket + Polling bidireccional)
  useEffect(() => {
    let ws = null;
    let fallbackTimer = null;
    let desmontado = false;

    const datosUsuario = {
      id: usuario?.id,
      nombre: usuario?.nombre || (rol === "docente" ? "Docente" : "Estudiante"),
      correo: usuario?.email || usuario?.correo || "",
      email: usuario?.email || usuario?.correo || "",
      rol: rol,
      emocion: emocionActual,
      atencion: scoreAtencion,
      softwareActivo: clase?.software || "Autodesk Revit 2026"
    };

    const sincronizarPorHTTP = async () => {
      if (desmontado) return;
      try {
        const resPresencia = await fetch(`${API_URL}/api/salas/${aulaId}/presencia`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...datosUsuario,
            emocion: emocionActual,
            atencion: scoreAtencion
          })
        });

        if (resPresencia.ok) {
          const estado = await resPresencia.json();
          if (estado?.participantes && !desmontado) {
            setParticipantesEnSala(estado.participantes);
          }
          if (estado?.pantalla && !desmontado) {
            const p = estado.pantalla;
            if (p.isSharing && p.presentador && p.presentador.id !== usuario?.id) {
              setPantallaCompartida(true);
              setPresentadorActual({
                ...p.presentador,
                esTuPantalla: false,
                tipo: "real",
                software: p.software || "Pantalla Compartida",
                tituloVentana: p.titulo || "Transmisión en Directo"
              });
              if (p.frame) {
                setPantallaFrame(p.frame);
              }
            } else if (!p.isSharing && presentadorActual.tipo === "real" && !presentadorActual.esTuPantalla) {
              setPantallaCompartida(true);
              setPantallaFrame(null);
              setPresentadorActual({
                id: "docente-titular",
                nombre: clase?.docente
                  ? `${clase.docente} (Docente Titular)`
                  : rol === "docente" && usuario?.nombre
                  ? `${usuario.nombre} (Docente Titular)`
                  : "Mg. Ing. Víctor Huamán (Docente Titular)",
                rol: "docente",
                esTuPantalla: false,
                tipo: "software",
                software: clase?.software || "Autodesk Revit 2026",
                tituloVentana: "Revit 2026 - Modelado de Zapatas y Vigas Confinadas"
              });
            }
          }
        }
      } catch (err) {
        console.warn("[Sala Sync HTTP]:", err);
      }
    };

    sincronizarPorHTTP();
    fallbackTimer = setInterval(sincronizarPorHTTP, 2500);

    try {
      const wsUrl = getWsAulaUrl(aulaId);
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!desmontado && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            tipo: "join",
            user: datosUsuario
          }));
        }
      };

      ws.onmessage = (event) => {
        if (desmontado) return;
        try {
          const mensaje = JSON.parse(event.data);
          if (mensaje.tipo === "estado_inicial") {
            if (mensaje.estado?.participantes) {
              setParticipantesEnSala(mensaje.estado.participantes);
            }
            if (mensaje.estado?.mensajes && Array.isArray(mensaje.estado.mensajes)) {
              setMensajesChat((prev) => {
                const mapa = new Map();
                prev.forEach((m) => m.id && mapa.set(m.id, m));
                mensaje.estado.mensajes.forEach((m) => m.id && mapa.set(m.id, m));
                return Array.from(mapa.values()).sort(
                  (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
                );
              });
            }
            if (mensaje.estado?.pantalla?.isSharing) {
              const p = mensaje.estado.pantalla;
              if (p.presentador?.id !== usuario?.id) {
                setPantallaCompartida(true);
                setPresentadorActual({
                  ...p.presentador,
                  esTuPantalla: false,
                  tipo: "real"
                });
                if (p.frame) setPantallaFrame(p.frame);
              }
            }
          } else if (mensaje.tipo === "presencia_actualizada") {
            if (mensaje.participantes) {
              setParticipantesEnSala(mensaje.participantes);
            }
          } else if (mensaje.tipo === "pantalla_actualizada") {
            const p = mensaje.pantalla;
            if (p?.isSharing) {
              const esPropia = p.presentador?.id === usuario?.id;
              if (!esPropia) {
                setPantallaCompartida(true);
                setPresentadorActual({
                  ...p.presentador,
                  esTuPantalla: false,
                  tipo: "real",
                  software: p.software || "Pantalla Compartida",
                  tituloVentana: p.titulo || "Transmisión en Directo"
                });
                if (p.frame) setPantallaFrame(p.frame);
                mostrarNotificacionShare(`¡${p.presentador?.nombre || "Docente"} está transmitiendo su pantalla!`);
              }
            } else {
              if (!presentadorActual.esTuPantalla) {
                setPantallaCompartida(true);
                setPantallaFrame(null);
                setPresentadorActual({
                  id: "docente-titular",
                  nombre: clase?.docente
                    ? `${clase.docente} (Docente Titular)`
                    : rol === "docente" && usuario?.nombre
                    ? `${usuario.nombre} (Docente Titular)`
                    : "Mg. Ing. Víctor Huamán (Docente Titular)",
                  rol: "docente",
                  esTuPantalla: false,
                  tipo: "software",
                  software: clase?.software || "Autodesk Revit 2026",
                  tituloVentana: "Revit 2026 - Modelado de Zapatas y Vigas Confinadas"
                });
                mostrarNotificacionShare("Transmisión de pantalla finalizada.");
              }
            }
          } else if (mensaje.tipo === "STREAM_VIDEO_DOCENTE") {
            if (rol === "estudiante" && mensaje.stream_data) {
              setStreamVideoDocente(mensaje.stream_data);
            }
          } else if (mensaje.tipo === "STREAM_VIDEO_ESTUDIANTE") {
            if (rol === "docente" && mensaje.stream_data) {
              const estId = mensaje.estudiante_id ? String(mensaje.estudiante_id) : "";
              const estNom = mensaje.estudiante || "";
              setStreamVideoEstudiantes((prev) => ({
                ...prev,
                ...(estId ? { [estId]: mensaje.stream_data } : {}),
                ...(estNom ? { [estNom]: mensaje.stream_data } : {}),
                _ultimo: mensaje.stream_data,
                _ultimoNombre: estNom
              }));
            }
          } else if (mensaje.tipo === "pantalla_frame") {
            if (mensaje.frame) {
              setPantallaFrame(mensaje.frame);
              setPantallaCompartida(true);
            }
          } else if (mensaje.tipo === "reaccion") {
            if (mensaje.usuario !== usuario?.nombre) {
              setReaccionActiva(mensaje.emoji);
              setTimeout(() => setReaccionActiva(null), 2500);
            }
          } else if (mensaje.tipo === "mano") {
            if (mensaje.usuario !== usuario?.nombre) {
              setNotificacionMano(`${mensaje.usuario} ha ${mensaje.levantada ? "levantado" : "bajado"} la mano`);
              setTimeout(() => setNotificacionMano(null), 3500);
            }
          } else if (mensaje.tipo === "chat_mensaje" && mensaje.mensaje) {
            setMensajesChat((prev) => {
              if (prev.some((m) => m.id === mensaje.mensaje.id)) return prev;
              return [...prev, mensaje.mensaje];
            });
            if (mensaje.mensaje.remitente !== usuario?.nombre) {
              setMensajesNoLeidos((n) => n + 1);
            }
          } else if (
            mensaje.tipo === "INTERVENCION_DOCENTE" ||
            (mensaje.tipo === "alerta_incidente" && mensaje.alerta?.tipo === "INTERVENCION_DOCENTE")
          ) {
            procesarEventoIntervencion(mensaje);
          }
        } catch (e) {
          console.warn("[WS Mensaje Error]:", e);
        }
      };

      ws.onerror = (e) => {
        console.warn("[WS Error]:", e);
      };
    } catch (wsErr) {
      console.warn("WebSocket fallback:", wsErr);
    }

    return () => {
      desmontado = true;
      if (fallbackTimer) clearInterval(fallbackTimer);
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      const userKey = usuario?.id || usuario?.email || usuario?.correo || usuario?.nombre;
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ tipo: "leave" }));
          } catch {}
        }
        ws.close();
      }
      if (userKey) {
        fetch(`${API_URL}/api/salas/${aulaId}/presencia/${userKey}`, {
          method: "DELETE"
        }).catch(() => {});
      }
    };
  }, [aulaId, usuario, rol, clase]);

  // 1. Transmisión del Docente al Estudiante (STREAM_VIDEO_DOCENTE a 12-15 FPS, calidad 0.5 JPEG)
  useEffect(() => {
    if (rol !== "docente" || !camaraDocenteActiva || !streamLocal) {
      if (timerStreamDocenteRef.current) {
        clearInterval(timerStreamDocenteRef.current);
        timerStreamDocenteRef.current = null;
      }
      return;
    }

    const canvas = canvasDocenteStreamRef.current || document.createElement("canvas");
    canvasDocenteStreamRef.current = canvas;
    canvas.width = 480;
    canvas.height = 270;
    const ctx = canvas.getContext("2d");

    const auxVideo = document.createElement("video");
    auxVideo.srcObject = streamLocal;
    auxVideo.muted = true;
    auxVideo.playsInline = true;
    auxVideo.play().catch(() => {});

    timerStreamDocenteRef.current = setInterval(() => {
      try {
        const vid =
          videoDocenteDomRef.current && videoDocenteDomRef.current.videoWidth > 0
            ? videoDocenteDomRef.current
            : auxVideo.videoWidth > 0
            ? auxVideo
            : null;

        if (vid && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.5);

          wsRef.current.send(
            JSON.stringify({
              tipo: "STREAM_VIDEO_DOCENTE",
              aula_id: aulaId,
              stream_data: dataUrl
            })
          );
        }
      } catch (err) {
        // Silencioso por rendimiento continuo
      }
    }, 75); // ~13.3 FPS

    return () => {
      if (timerStreamDocenteRef.current) {
        clearInterval(timerStreamDocenteRef.current);
        timerStreamDocenteRef.current = null;
      }
      try {
        auxVideo.pause();
        auxVideo.srcObject = null;
      } catch {}
    };
  }, [rol, camaraDocenteActiva, streamLocal, aulaId]);

  // 2. Transmisión del Estudiante al Docente (STREAM_VIDEO_ESTUDIANTE a 10-12 FPS)
  useEffect(() => {
    if (rol !== "estudiante" || !camaraActiva || !streamLocal) {
      if (timerStreamEstudianteRef.current) {
        clearInterval(timerStreamEstudianteRef.current);
        timerStreamEstudianteRef.current = null;
      }
      return;
    }

    const canvas = canvasEstudianteStreamRef.current || document.createElement("canvas");
    canvasEstudianteStreamRef.current = canvas;
    canvas.width = 360;
    canvas.height = 270;
    const ctx = canvas.getContext("2d");

    const auxVideo = document.createElement("video");
    auxVideo.srcObject = streamLocal;
    auxVideo.muted = true;
    auxVideo.playsInline = true;
    auxVideo.play().catch(() => {});

    timerStreamEstudianteRef.current = setInterval(() => {
      try {
        const vid =
          videoEstudianteRef.current && videoEstudianteRef.current.videoWidth > 0
            ? videoEstudianteRef.current
            : auxVideo.videoWidth > 0
            ? auxVideo
            : null;

        if (vid && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.45);

          wsRef.current.send(
            JSON.stringify({
              tipo: "STREAM_VIDEO_ESTUDIANTE",
              aula_id: aulaId,
              estudiante: usuario?.nombre || "Estudiante",
              estudiante_id: usuario?.id || "estudiante",
              stream_data: dataUrl
            })
          );
        }
      } catch (err) {
        // Silencioso por rendimiento continuo
      }
    }, 90); // ~11 FPS

    return () => {
      if (timerStreamEstudianteRef.current) {
        clearInterval(timerStreamEstudianteRef.current);
        timerStreamEstudianteRef.current = null;
      }
      try {
        auxVideo.pause();
        auxVideo.srcObject = null;
      } catch {}
    };
  }, [rol, camaraActiva, streamLocal, aulaId, usuario]);

  // Helper para normalizar y obtener estilos y emojis de los 4 estados requeridos:
  // Atento, Distraído, Triste, Alegre
  const obtenerDatosEstado = (emocion) => {
    const emo = (emocion || "").toUpperCase();
    if (emo.includes("DISTRA")) {
      return {
        id: "Distraído",
        nombre: "Distraído",
        emoji: "📱",
        badge: "bg-amber-50 text-amber-700 border-amber-300",
        pill: "bg-amber-100 text-amber-800 border-amber-200",
        dot: "bg-amber-500",
        colorTexto: "text-amber-700",
        bgSoft: "bg-amber-50"
      };
    }
    if (emo.includes("TRISTE")) {
      return {
        id: "Triste",
        nombre: "Triste",
        emoji: "😢",
        badge: "bg-sky-50 text-sky-700 border-sky-300",
        pill: "bg-sky-100 text-sky-800 border-sky-200",
        dot: "bg-sky-500",
        colorTexto: "text-sky-700",
        bgSoft: "bg-sky-50"
      };
    }
    if (emo.includes("ALEGRE")) {
      return {
        id: "Alegre",
        nombre: "Alegre",
        emoji: "😊",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-300",
        pill: "bg-emerald-100 text-emerald-800 border-emerald-200",
        dot: "bg-emerald-500",
        colorTexto: "text-emerald-700",
        bgSoft: "bg-emerald-50"
      };
    }
    // Por defecto: Atento
    return {
      id: "Atento",
      nombre: "Atento",
      emoji: "🎯",
      badge: "bg-teal-50 text-teal-700 border-teal-300",
      pill: "bg-teal-100 text-teal-800 border-teal-200",
      dot: "bg-teal-500",
      colorTexto: "text-teal-700",
      bgSoft: "bg-teal-50"
    };
  };

  // Sincronizar streamLocal con todos los visores de video del aula e inferencia de IA
  useEffect(() => {
    if (streamLocal) {
      if (videoDocenteDomRef.current && videoDocenteDomRef.current.srcObject !== streamLocal) {
        videoDocenteDomRef.current.srcObject = streamLocal;
        videoDocenteDomRef.current.muted = true;
        videoDocenteDomRef.current.play().catch(() => {});
      }
      if (videoEstudianteRef.current && videoEstudianteRef.current.srcObject !== streamLocal) {
        videoEstudianteRef.current.srcObject = streamLocal;
        videoEstudianteRef.current.muted = true;
        videoEstudianteRef.current.play().catch(() => {});
      }
      if (videoHiddenIaRef.current && videoHiddenIaRef.current.srcObject !== streamLocal) {
        videoHiddenIaRef.current.srcObject = streamLocal;
        videoHiddenIaRef.current.muted = true;
        videoHiddenIaRef.current.play().catch(() => {});
      }
    }
  }, [streamLocal, camaraDocenteActiva, camaraActiva, rol]);

  // Normaliza clases (atento, distraido, triste, alegre) ignorando mayúsculas, minúsculas o tildes
  const normalizarClasePredicha = useCallback((clase) => {
    if (!clase) return "Atento";
    const limpia = String(clase)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    if (limpia.includes("distra")) return "Distraído";
    if (limpia.includes("triste")) return "Triste";
    if (limpia.includes("alegre") || limpia.includes("feliz")) return "Alegre";
    return "Atento";
  }, []);

  // Calcula el porcentaje de atención de forma coherente según clase dominante y certeza
  const calcularScoreAtencion = useCallback((claseNormalizada, certeza) => {
    const prob = typeof certeza === "number" && !isNaN(certeza) ? certeza : 0.9;
    switch (claseNormalizada) {
      case "Atento":
        // Si dominante es atento, refleja certeza alta (85% - 98%)
        return Math.max(85, Math.min(98, Math.round(85 + prob * 13)));
      case "Alegre":
        // Refleja bienestar y alta atención (88% - 98%)
        return Math.max(88, Math.min(98, Math.round(88 + prob * 10)));
      case "Triste":
        // Fatiga / decaimiento (45% - 65%)
        return Math.max(45, Math.min(65, Math.round(65 - prob * 18)));
      case "Distraído":
        // Si es distraído, baja acorde a la métrica (20% - 45%)
        return Math.max(20, Math.min(45, Math.round(48 - prob * 24)));
      default:
        return 95;
    }
  }, []);

  // Obtiene de forma segura el elemento HTMLVideoElement activo con fotogramas listos
  const obtenerVideoWebcamActivo = useCallback(() => {
    const videoVisible = videoEstudianteRef.current;
    if (
      videoVisible &&
      videoVisible.readyState === 4 &&
      videoVisible.videoWidth > 0 &&
      !videoVisible.paused &&
      !videoVisible.ended
    ) {
      return videoVisible;
    }
    const videoAux = videoHiddenIaRef.current;
    if (
      videoAux &&
      videoAux.readyState === 4 &&
      videoAux.videoWidth > 0 &&
      !videoAux.paused &&
      !videoAux.ended
    ) {
      return videoAux;
    }
    // Fallback si readyState está en buffer intermedio (>= 2) pero con dimensiones válidas
    if (videoVisible && videoVisible.readyState >= 2 && videoVisible.videoWidth > 0 && !videoVisible.paused) {
      return videoVisible;
    }
    if (videoAux && videoAux.readyState >= 2 && videoAux.videoWidth > 0 && !videoAux.paused) {
      return videoAux;
    }
    return null;
  }, []);

  // Sincronizar y persistir métricas de atención y emoción en PostgreSQL vía POST /api/metricas/atencion
  const enviarMetricasBackend = useCallback(async (estado, atencion, _certeza = 1.0) => {
    try {
      const apiUrl = API_URL;
      const cid = typeof clase?.id === "number"
        ? clase.id
        : (clase?.id ? parseInt(String(clase.id).replace("aula-", "")) || null : null);

      let estadoCalc = "concentrado";
      if (estado === "Distraído") estadoCalc = "distraido";
      else if (estado === "Triste") estadoCalc = "fatiga";

      await fetch(`${apiUrl}/api/metricas/atencion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estudiante_id: usuario?.id || null,
          estudiante_email: usuario?.email || usuario?.correo || null,
          estudiante_nombre: usuario?.nombre || "Estudiante",
          clase_id: cid,
          clase_codigo: aulaId,
          atencion_pct: Number(atencion),
          estado: estadoCalc,
          emocion: estado.toLowerCase()
        })
      });
    } catch (err) {
      console.warn("[Persistencia Metricas] Error al sincronizar con PostgreSQL:", err);
    }
  }, [clase, aulaId, usuario]);

  // Emisión y distribución de incidentes en tiempo real a PostgreSQL y sockets docentes
  const emitirAlertaIncidente = useCallback(async (tipoIncidente, descripcion, atencionScore) => {
    const ahora = Date.now();
    if (ahora - ultimoIncidenteEmitidoRef.current < 15000) {
      return;
    }
    ultimoIncidenteEmitidoRef.current = ahora;

    const horaStr = new Date().toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });

    const roomTarget = aulaId || "AULA-101";

    const payload = {
      tipo: "INCIDENTE_CONDUCTA",
      aula_id: roomTarget,
      estudiante: usuario?.nombre || "Estudiante",
      incidente: descripcion,
      severidad: "ALTA",
      hora: horaStr,
      metricas: {
        alumnos_conectados: (listaEstudiantesActivos?.length || 0) + 1,
        atencion_promedio: Number(atencionScore) || 50
      }
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }

    try {
      const apiUrl = API_URL;
      await fetch(`${apiUrl}/api/aulas/${roomTarget}/alertas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("[Incidente IA] Alerta distribuida a PostgreSQL y sockets docentes:", payload);
    } catch (err) {
      console.warn("[Incidente IA] Error al notificar alerta al backend:", err);
    }
  }, [aulaId, usuario, listaEstudiantesActivos]);

  // Temporizador para descanso visual guiado en caso de fatiga
  useEffect(() => {
    let t = null;
    if (intervencionPedagogica && intervencionPedagogica.motivo === "fatiga" && tiempoDescansoVisual > 0) {
      t = setInterval(() => {
        setTiempoDescansoVisual((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => {
      if (t) clearInterval(t);
    };
  }, [intervencionPedagogica, tiempoDescansoVisual]);

  // Suscripción al canal de alertas del aula para recibir eventos INTERVENCION_DOCENTE
  useEffect(() => {
    if (rol !== "estudiante") return;
    let activo = true;
    let reconnectT = null;

    const conectarAlertasEstudiante = () => {
      try {
        const wsUrl = getWsAlertasUrl(aulaId || "AULA-101");
        const wsA = new WebSocket(wsUrl);
        wsAlertasEstudianteRef.current = wsA;

        wsA.onmessage = (event) => {
          if (!activo) return;
          try {
            const data = JSON.parse(event.data);
            if (
              data.tipo === "INTERVENCION_DOCENTE" ||
              (data.tipo === "alerta_incidente" && data.alerta?.tipo === "INTERVENCION_DOCENTE")
            ) {
              procesarEventoIntervencion(data);
            } else if (data.tipo === "chat_mensaje" && data.mensaje) {
              setMensajesChat((prev) => {
                if (prev.some((m) => m.id === data.mensaje.id)) return prev;
                return [...prev, data.mensaje];
              });
              if (data.mensaje.remitente !== usuario?.nombre) {
                setMensajesNoLeidos((n) => n + 1);
              }
            }
          } catch (e) {
            console.warn("[WS Alertas Estudiante]:", e);
          }
        };

        wsA.onclose = () => {
          if (activo) {
            reconnectT = setTimeout(conectarAlertasEstudiante, 3500);
          }
        };

        wsA.onerror = () => {
          wsA.close();
        };
      } catch (err) {
        if (activo) {
          reconnectT = setTimeout(conectarAlertasEstudiante, 4000);
        }
      }
    };

    conectarAlertasEstudiante();

    return () => {
      activo = false;
      if (reconnectT) clearTimeout(reconnectT);
      if (wsAlertasEstudianteRef.current) {
        wsAlertasEstudianteRef.current.close();
      }
    };
  }, [aulaId, rol, usuario]);

  // Completar intervención y emitir INTERVENCION_COMPLETADA hacia PostgreSQL y panel docente
  const handleCompletarIntervencion = async (respuestaIndex = null) => {
    // Ocultar el modal de inmediato
    setMostrarModalIntervencion(false);

    if (!intervencionPedagogica) return;

    const payloadCompletado = {
      tipo: "INTERVENCION_COMPLETADA",
      aula_id: aulaId || "AULA-101",
      estudiante: usuario?.nombre || "Estudiante",
      estudiante_id: usuario?.id || null,
      motivo: intervencionPedagogica.motivo || "fatiga",
      respuesta: respuestaIndex !== null ? respuestaIndex : (opcionPreguntaSeleccionada !== null ? opcionPreguntaSeleccionada : "continuar"),
      estado: "atendido con éxito",
      hora: new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
    };

    // Emitir por WebSocket de alertas si está conectado
    if (wsAlertasEstudianteRef.current && wsAlertasEstudianteRef.current.readyState === WebSocket.OPEN) {
      wsAlertasEstudianteRef.current.send(JSON.stringify(payloadCompletado));
    }

    // Emitir por WebSocket de aula si está conectado
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payloadCompletado));
    }

    // Persistir y distribuir vía REST
    try {
      const apiUrl = API_URL;
      await fetch(`${apiUrl}/api/aulas/${aulaId || "AULA-101"}/intervencion-completada`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadCompletado)
      });
      console.log("[Intervencion Completada] Enviada a docente y PostgreSQL:", payloadCompletado);
    } catch (err) {
      console.warn("[Intervencion Completada Fallback REST]:", err);
    }

    setIntervencionPedagogica(null);
    setOpcionPreguntaSeleccionada(null);
  };

  // Carga defensiva del modelo local de Teachable Machine (/model.json y /metadata.json)
  useEffect(() => {
    let montado = true;

    const cargarModeloDefensivo = async () => {
      try {
        console.log("[TeachableMachine] Carga defensiva: inicializando modelo...");
        const baseUrl = window.location.origin;
        const modelPath = `${baseUrl}/model.json`;
        const metadataPath = `${baseUrl}/metadata.json`;

        let model = null;
        try {
          model = await tmImage.load(modelPath, metadataPath);
        } catch (absErr) {
          console.warn("[TeachableMachine] Fallback a rutas relativas directas:", absErr?.message || absErr);
          model = await tmImage.load("/model.json", "/metadata.json");
        }

        if (montado && model) {
          modeloIaRef.current = model;
          setModeloCargado(true);
          console.log("[TeachableMachine] Modelo cargado y listo para inferencia. Clases:", model.getClassLabels());
        }
      } catch (err) {
        // En caso de demora o falla, la cámara continúa operando normalmente sin bloquear la interfaz
        console.warn("[TeachableMachine] Modelo no disponible de inmediato; la cámara opera normalmente:", err?.message || err);
        if (montado) {
          setModeloCargado(false);
          setErrorModelo(err?.message || "Error al cargar modelo");
        }
      }
    };

    cargarModeloDefensivo();

    return () => {
      montado = false;
      if (modeloIaRef.current) {
        try {
          if (typeof modeloIaRef.current.dispose === "function") {
            modeloIaRef.current.dispose();
          }
        } catch {
          // ignore
        }
        modeloIaRef.current = null;
      }
    };
  }, []);

  // Función para cambiar manualmente el estado biométrico del estudiante en vivo
  const cambiarEstadoManual = (nuevoEstado) => {
    setEmocionActual(nuevoEstado);
    let nuevoScore = 95;
    if (nuevoEstado === "Atento") nuevoScore = 96;
    else if (nuevoEstado === "Alegre") nuevoScore = 98;
    else if (nuevoEstado === "Distraído") nuevoScore = 42;
    else if (nuevoEstado === "Triste") nuevoScore = 55;

    setScoreAtencion(nuevoScore);
    setBloquearSimulacionManual(true);

    // Emitir cambio de telemetría por WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        tipo: "telemetria",
        user: {
          id: usuario?.id,
          nombre: usuario?.nombre,
          correo: usuario?.email || usuario?.correo,
          rol,
          emocion: nuevoEstado,
          atencion: nuevoScore,
          softwareActivo: clase?.software || "Autodesk Revit 2026"
        }
      }));
    }

    if (onEmitirMetrica) {
      onEmitirMetrica({
        estudiante: usuario?.nombre || "Estudiante",
        emocion: nuevoEstado,
        atencion: nuevoScore,
        confianza: 98,
        timestamp: new Date().toISOString()
      });
    }

    // Persistir de inmediato en PostgreSQL backend
    enviarMetricasBackend(nuevoEstado, nuevoScore, 1.0);

    // Reanudar la detección automática de IA después de 15 segundos
    setTimeout(() => {
      setBloquearSimulacionManual(false);
    }, 15000);
  };

  // Bucle de inferencia en tiempo real controlado (600ms - 1000ms) con limpieza defensiva
  useEffect(() => {
    // Si no es estudiante, el modelo no cargó o la cámara no está activa, no iniciar bucle
    if (rol !== "estudiante" || !modeloCargado || !camaraActiva || estadoCamara !== "activa") {
      return;
    }

    let intervalId = null;
    let cancelado = false;

    intervalId = setInterval(async () => {
      if (cancelado || isPredictingRef.current || !modeloIaRef.current) return;

      // Obtener video listo con readyState adecuado
      const videoEl = obtenerVideoWebcamActivo();
      if (!videoEl) return;

      isPredictingRef.current = true;
      try {
        const tInicio = performance.now();
        // Inferencia del modelo para las clases: atento, distraido, triste, alegre
        const predicciones = await modeloIaRef.current.predict(videoEl);
        const tFin = performance.now();
        setLatenciaMs(Math.max(8, Math.round(tFin - tInicio)));

        if (cancelado || !predicciones || predicciones.length === 0) return;

        // Seleccionar la clase con mayor probabilidad
        let maxProb = -1;
        let mejorClaseRaw = "";
        for (const p of predicciones) {
          if (p.probability > maxProb) {
            maxProb = p.probability;
            mejorClaseRaw = p.className;
          }
        }

        const claseNormalizada = normalizarClasePredicha(mejorClaseRaw);
        const nuevoScore = calcularScoreAtencion(claseNormalizada, maxProb);
        const certPct = Math.round(maxProb * 100);

        // Control de micro-alertas pedagógicas automáticas y emisión de incidentes en tiempo real
        if (claseNormalizada === "Distraído" || nuevoScore < 45 || claseNormalizada === "Triste") {
          conteoDistraccionRef.current += 1;
          if (conteoDistraccionRef.current >= 3) {
            const desc = claseNormalizada === "Triste"
              ? "Fatiga detectada por Visión IA"
              : "Distracción detectada por Visión IA";

            setAlertaPedagogica({
              titulo: "Micro-Pausa Pedagógica Sugerida",
              mensaje: "EduGuard IA detectó una disminución en tu nivel de atención durante la sesión.",
              sugerencia: "¿Deseas hacer una consulta rápida al Tutor IA o repasar el concepto de zapatas/vigas?"
            });

            // Emitir evento de incidente a PostgreSQL y sockets en tiempo real
            emitirAlertaIncidente("INCIDENTE_CONDUCTA", desc, nuevoScore);
          }
        } else if (claseNormalizada === "Atento" || claseNormalizada === "Alegre") {
          conteoDistraccionRef.current = Math.max(0, conteoDistraccionRef.current - 1);
        }

        setIaPrediccionInfo({
          clase: claseNormalizada,
          confianza: certPct,
          todas: predicciones
        });

        // Si no está temporalmente bloqueado por un clic manual, actualizar UI y persistir
        if (!bloquearSimulacionManual) {
          setEmocionActual(claseNormalizada);
          setScoreAtencion(nuevoScore);

          // Emitir telemetría por WebSocket a los participantes del aula
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              tipo: "telemetria",
              user: {
                id: usuario?.id,
                nombre: usuario?.nombre,
                correo: usuario?.email || usuario?.correo,
                rol,
                emocion: claseNormalizada,
                atencion: nuevoScore,
                softwareActivo: clase?.software || "Autodesk Revit 2026"
              }
            }));
          }

          // Notificar vía onEmitirMetrica
          if (onEmitirMetrica) {
            onEmitirMetrica({
              estudiante: usuario?.nombre || "Estudiante",
              emocion: claseNormalizada,
              atencion: nuevoScore,
              confianza: certPct,
              timestamp: new Date().toISOString()
            });
          }

          // Persistir en PostgreSQL backend cada 3.5 segundos (ventana de 3 a 5 seg)
          const ahora = Date.now();
          if (ahora - ultimoEnvioMetricaRef.current >= 3500) {
            ultimoEnvioMetricaRef.current = ahora;
            enviarMetricasBackend(claseNormalizada, nuevoScore, maxProb);
          }
        }
      } catch (err) {
        console.warn("[TeachableMachine] Inferencia omitida en este ciclo:", err?.message || err);
      } finally {
        isPredictingRef.current = false;
      }
    }, 750); // Intervalo controlado de 750 ms (dentro del rango 600ms - 1000ms)

    return () => {
      cancelado = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
      isPredictingRef.current = false;
    };
  }, [
    rol,
    modeloCargado,
    camaraActiva,
    estadoCamara,
    bloquearSimulacionManual,
    usuario,
    clase,
    onEmitirMetrica,
    enviarMetricasBackend,
    normalizarClasePredicha,
    calcularScoreAtencion,
    obtenerVideoWebcamActivo
  ]);

  // Notificación dinámica de pantalla compartida
  const mostrarNotificacionShare = (texto) => {
    setNotificacionShare(texto);
    setTimeout(() => setNotificacionShare(null), 3800);
  };

  // Iniciar compartir pantalla real de la computadora (Navegador / Ventana / Pantalla Completa)
  const iniciarCompartirReal = async () => {
    try {
      if (navigator.mediaDevices?.getDisplayMedia) {
        let stream = null;
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" },
            audio: true
          });
        } catch (audioErr) {
          if (audioErr.name !== "NotAllowedError" && audioErr.name !== "AbortError") {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: { cursor: "always" },
              audio: false
            });
          } else {
            throw audioErr;
          }
        }

        if (!stream) return;

        streamPantallaRef.current = stream;
        setStreamPantalla(stream);

        const nombrePresentador =
          rol === "docente"
            ? `${usuario?.nombre || clase?.docente || "Docente"} (Docente Titular)`
            : `${usuario?.nombre || "Estudiante"} (Colaborador)`;

        const presentadorInfo = {
          id: usuario?.id || (rol === "docente" ? "docente" : "estudiante"),
          nombre: nombrePresentador,
          rol: rol,
          esTuPantalla: true,
          tipo: "real",
          software:
            rol === "docente"
              ? "Pantalla de Clase del Docente (Escritorio / Ventana)"
              : "Pantalla del Estudiante (Colaborador)",
          tituloVentana: "Transmisión en Directo de tu Equipo"
        };

        setPresentadorActual(presentadorInfo);
        setPantallaCompartida(true);
        setModalCompartir(false);
        mostrarNotificacionShare(
          rol === "docente"
            ? "¡Docente transmitiendo pantalla a toda la clase!"
            : "¡Has comenzado a compartir tu pantalla con la sala!"
        );

        // Notificar inicio de pantalla compartida al backend
        const payloadPantalla = {
          isSharing: true,
          presentador: presentadorInfo,
          software: presentadorInfo.software,
          titulo: presentadorInfo.tituloVentana
        };

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ tipo: "pantalla", pantalla: payloadPantalla }));
        }
        fetch(`${API_URL}/api/salas/${aulaId}/pantalla`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadPantalla)
        }).catch(() => {});

        // Capturar fotogramas en vivo para sincronización de video entre pantallas
        if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
        const canvas = canvasCaptureRef.current || document.createElement("canvas");
        canvasCaptureRef.current = canvas;

        const tempVideo = document.createElement("video");
        tempVideo.srcObject = stream;
        tempVideo.muted = true;
        tempVideo.playsInline = true;
        tempVideo.play().catch(() => {});

        frameIntervalRef.current = setInterval(() => {
          try {
            const vid = screenVideoDomRef.current || tempVideo;
            if (vid && vid.videoWidth > 0 && vid.videoHeight > 0) {
              const maxW = 960;
              const scale = Math.min(1, maxW / vid.videoWidth);
              canvas.width = Math.round(vid.videoWidth * scale);
              canvas.height = Math.round(vid.videoHeight * scale);
              const ctx = canvas.getContext("2d");
              ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
              const frameData = canvas.toDataURL("image/jpeg", 0.65);

              const framePayload = {
                isSharing: true,
                presentador: presentadorInfo,
                frame: frameData,
                software: presentadorInfo.software,
                titulo: presentadorInfo.tituloVentana
              };

              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ tipo: "pantalla", pantalla: framePayload }));
                wsRef.current.send(JSON.stringify({ tipo: "pantalla_frame", frame: frameData }));
              }
            }
          } catch (e) {
            console.warn("Captura de fotograma:", e);
          }
        }, 110);

        if (stream.getVideoTracks().length > 0) {
          stream.getVideoTracks()[0].onended = () => {
            detenerCompartirPantalla();
          };
        }
      } else {
        iniciarCompartirSoftware("revit");
      }
    } catch (err) {
      console.warn("Pantalla compartida cancelada o no disponible:", err);
      if (err.name !== "NotAllowedError" && err.name !== "AbortError") {
        mostrarNotificacionShare("No se pudo iniciar la captura de pantalla: " + (err.message || "Permiso no concedido"));
      }
      setModalCompartir(false);
    }
  };

  // Iniciar compartir espacio de software especializado (BIM / APU / CAD)
  const iniciarCompartirSoftware = (tipoSoftware = "revit") => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (streamPantallaRef.current) {
      streamPantallaRef.current.getTracks().forEach((t) => t.stop());
      streamPantallaRef.current = null;
      setStreamPantalla(null);
    }

    const infoSoftware = {
      revit: {
        nombre: "Autodesk Revit 2026",
        titulo: "Modelado BIM 3D - Zapatas Confinadas & Armadura Longitudinal E.060"
      },
      s10: {
        nombre: "S10 Costos y Presupuestos",
        titulo: "Presupuesto y Análisis de Precios Unitarios (APU) - Concreto f'c=210 kg/cm²"
      },
      civil3d: {
        nombre: "AutoCAD & Civil 3D",
        titulo: "Plano Topográfico y Cuadrícula de Cimentación Estructural"
      }
    };

    const target = infoSoftware[tipoSoftware] || infoSoftware.revit;
    setSoftwareTab(tipoSoftware);

    const nombrePresentador =
      rol === "docente"
        ? `${usuario?.nombre || clase?.docente || "Docente"} (Docente Titular)`
        : `${usuario?.nombre || "Estudiante"} (Colaborador)`;

    const presentadorInfo = {
      id: usuario?.id || (rol === "docente" ? "docente" : "estudiante"),
      nombre: nombrePresentador,
      rol: rol,
      esTuPantalla: true,
      tipo: "software",
      software: target.nombre,
      tituloVentana: target.titulo
    };

    setPresentadorActual(presentadorInfo);
    setPantallaFrame(null);
    setPantallaCompartida(true);
    setModalCompartir(false);
    mostrarNotificacionShare(`${nombrePresentador} está compartiendo: ${target.nombre}`);

    const payloadSoftware = {
      isSharing: true,
      presentador: presentadorInfo,
      software: target.nombre,
      titulo: target.titulo,
      frame: null
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ tipo: "pantalla", pantalla: payloadSoftware }));
    }
    fetch(`${API_URL}/api/salas/${aulaId}/pantalla`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadSoftware)
    }).catch(() => {});
  };

  // Detener transmisión de pantalla compartida
  const detenerCompartirPantalla = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }

    if (streamPantallaRef.current) {
      streamPantallaRef.current.getTracks().forEach((t) => t.stop());
      streamPantallaRef.current = null;
      setStreamPantalla(null);
    }

    const presentadorDefault = {
      id: "docente-titular",
      nombre: clase?.docente
        ? `${clase.docente} (Docente Titular)`
        : rol === "docente" && usuario?.nombre
        ? `${usuario.nombre} (Docente Titular)`
        : "Mg. Ing. Víctor Huamán (Docente Titular)",
      rol: "docente",
      esTuPantalla: false,
      tipo: "software",
      software: "Autodesk Revit 2026",
      tituloVentana: "Revit 2026 - Modelado de Zapatas y Vigas Confinadas"
    };

    setPresentadorActual(presentadorDefault);
    setPantallaFrame(null);
    setSoftwareTab("revit");
    setModalCompartir(false);
    mostrarNotificacionShare("Transmisión de pantalla finalizada.");

    const stopPayload = {
      isSharing: false,
      presentador: null,
      frame: null,
      software: "Autodesk Revit 2026",
      titulo: ""
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ tipo: "pantalla", pantalla: stopPayload }));
    }
    fetch(`${API_URL}/api/salas/${aulaId}/pantalla`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stopPayload)
    }).catch(() => {});
  };

  // Docente cede la pantalla a un estudiante colaborador
  const cederPantallaAEstudiante = (est) => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (streamPantallaRef.current) {
      streamPantallaRef.current.getTracks().forEach((t) => t.stop());
      streamPantallaRef.current = null;
      setStreamPantalla(null);
    }

    const esElMismo = usuario?.correo === est.correo || usuario?.nombre === est.nombre;

    const presentadorCedido = {
      id: est.id,
      nombre: est.nombre,
      rol: "estudiante",
      esTuPantalla: esElMismo,
      tipo: "software",
      software: est.softwareActivo || "Autodesk Revit 2026",
      tituloVentana: `Pantalla de Proyecto del Estudiante: ${est.nombre}`
    };

    setPresentadorActual(presentadorCedido);
    setPantallaFrame(null);
    setPantallaCompartida(true);
    setModalCompartir(false);
    mostrarNotificacionShare(`Pantalla de la sala cedida a ${est.nombre} (Estudiante Colaborador)`);

    const cederPayload = {
      isSharing: true,
      presentador: presentadorCedido,
      software: presentadorCedido.software,
      titulo: presentadorCedido.tituloVentana,
      frame: null
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ tipo: "pantalla", pantalla: cederPayload }));
    }
    fetch(`${API_URL}/api/salas/${aulaId}/pantalla`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cederPayload)
    }).catch(() => {});
  };

  // Docente recupera el control de la pantalla compartida
  const recuperarPantallaDocente = () => {
    detenerCompartirPantalla();
    mostrarNotificacionShare("El docente titular ha retomado la pantalla principal.");
  };

  // Manejar clic en el botón de la barra inferior
  const handleToggleScreenShare = () => {
    if (streamPantallaRef.current || (presentadorActual.tipo === "real" && presentadorActual.esTuPantalla)) {
      detenerCompartirPantalla();
    } else {
      iniciarCompartirReal();
    }
  };

  const handleLevantarMano = () => {
    const nuevoEstado = !manoLevantada;
    setManoLevantada(nuevoEstado);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        tipo: "mano",
        levantada: nuevoEstado,
        usuario: usuario?.nombre || "Participante"
      }));
    }
    if (nuevoEstado) {
      setNotificacionMano(`${usuario?.nombre || "Tú"} has levantado la mano`);
      setTimeout(() => setNotificacionMano(null), 3500);
    }
  };

  const handleToggleCamara = () => {
    if (!streamLocal || estadoCamara !== "activa") {
      setCamaraActiva(true);
      setCamaraDocenteActiva(true);
      iniciarCamara();
    } else {
      const nuevo = !camaraActiva;
      setCamaraActiva(nuevo);
      if (rol === "docente") {
        setCamaraDocenteActiva(nuevo);
      }
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = nuevo;
        });
      }
    }
  };

  const lanzarReaccion = (emoji) => {
    setReaccionActiva(emoji);
    setMostrarReacciones(false);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        tipo: "reaccion",
        emoji,
        usuario: usuario?.nombre || "Participante"
      }));
    }
    setTimeout(() => setReaccionActiva(null), 2500);
  };

  // Manejar salida limpia de la sala
  const handleAbandonarSala = async () => {
    try {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
      if (streamPantallaRef.current) {
        streamPantallaRef.current.getTracks().forEach((t) => t.stop());
        streamPantallaRef.current = null;
      }
      const userKey = usuario?.id || usuario?.email || usuario?.correo || usuario?.nombre;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ tipo: "leave" }));
        wsRef.current.close();
      }
      if (userKey) {
        await fetch(`${API_URL}/api/salas/${aulaId}/presencia/${userKey}`, {
          method: "DELETE"
        });
      }
    } catch {
      // ignore
    }
    onSalir();
  };

  // Clases CSS dinámicas según el tema de fondo elegido (Luminoso, elegante y ejecutivo)
  const getFondoStyles = () => {
    switch (temaFondo) {
      case "campus":
        return "bg-gradient-to-br from-blue-50/70 via-slate-100 to-emerald-50/60 text-slate-800";
      case "aura":
        return "bg-gradient-to-br from-slate-50 via-teal-50/40 to-indigo-50/50 text-slate-800";
      case "slate":
      default:
        return "bg-slate-100/90 text-slate-800";
    }
  };

  return (
    <div
      className={`flex flex-col h-screen w-full ${getFondoStyles()} font-sans overflow-hidden select-none relative transition-colors duration-500`}
    >
      {/* Luces ambientales sutiles de fondo para profundidad visual ejecutiva */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[32rem] h-[32rem] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-10 w-72 h-72 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Reacción flotante animada en pantalla */}
      {reaccionActiva && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-50 animate-bounce text-6xl drop-shadow-2xl pointer-events-none">
          {reaccionActiva}
        </div>
      )}

      {/* Notificación flotante de mano levantada */}
      {notificacionMano && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-white/95 backdrop-blur-md border border-amber-300 text-amber-800 px-5 py-2.5 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-bold animate-in fade-in slide-in-from-top-3 duration-300">
          <Hand className="w-4 h-4 text-amber-500 animate-pulse" />
          <span>{notificacionMano}</span>
        </div>
      )}

      {/* Notificación flotante de compartir pantalla */}
      {notificacionShare && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-white/95 backdrop-blur-md border border-emerald-300 text-emerald-800 px-5 py-2.5 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-bold animate-in fade-in slide-in-from-top-3 duration-300 shadow-emerald-500/10">
          <Share2 className="w-4 h-4 text-emerald-600 animate-pulse" />
          <span>{notificacionShare}</span>
        </div>
      )}

      {/* 1. TOP HEADER MODERNO CON SAFE AREA */}
      <header className="min-h-[56px] pt-[env(safe-area-inset-top)] bg-white/95 backdrop-blur-xl border-b border-slate-200 px-2.5 sm:px-6 flex items-center justify-between shrink-0 z-30 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onSalir}
            className="flex items-center gap-1 sm:gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 px-2 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer border border-slate-200 shadow-xs shrink-0"
            title="Salir del aula"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">Abandonar Sala</span>
            <span className="sm:hidden">Salir</span>
          </button>

          <div className="h-5 w-px bg-slate-200 hidden sm:block shrink-0" />

          {/* Nombre dinámico de la sesión en PostgreSQL y badge EN VIVO */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <h1 className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight truncate">
              <span className="truncate max-w-[140px] xs:max-w-[180px] sm:max-w-md inline-block">
                {clase?.nombre || clase?.titulo || "Modelado BIM"}
              </span>
            </h1>
            <span className="hidden md:inline-flex badge-pill bg-rose-50 text-rose-700 border border-rose-200 text-[9px] sm:text-[10px] font-bold shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              <span className="hidden sm:inline">● EN VIVO </span>DENTRO DEL AULA
            </span>
          </div>
        </div>

        {/* Estado, Modos de Visualización y Selector de Tema */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Selector de Tema de Fondo */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setMostrarTemas(!mostrarTemas)}
              className="p-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Cambiar diseño de fondo"
            >
              <Palette size={14} className="text-indigo-600" />
              <span className="hidden xl:inline text-[11px]">Diseño</span>
            </button>

            {mostrarTemas && (
              <div className="absolute right-0 top-11 bg-white border border-slate-200 rounded-2xl p-2.5 shadow-xl z-50 w-52 space-y-1.5 text-xs">
                <div className="text-[10px] font-bold uppercase text-slate-400 px-2 pb-1">
                  Estilo de Sala Virtual
                </div>
                {[
                  { id: "slate", label: "Estudio Ejecutivo", desc: "Crisp Slate & Blanco" },
                  { id: "campus", label: "Campus Moderno", desc: "Suave Azul & Esmeralda" },
                  { id: "aura", label: "Aura Tecnológica", desc: "Teal Suave & Índigo" }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTemaFondo(t.id);
                      setMostrarTemas(false);
                    }}
                    className={`w-full p-2 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                      temaFondo === t.id
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div>
                      <div>{t.label}</div>
                      <div className="text-[10px] text-slate-500">{t.desc}</div>
                    </div>
                    {temaFondo === t.id && <Check size={14} className="text-emerald-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Toggle de Vistas (Escenario vs Cuadrícula) */}
          <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setModoDiseno("escenario")}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                modoDiseno === "escenario"
                  ? "bg-white text-emerald-700 shadow-xs border border-slate-200/80 font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Vista Escenario con BIM al centro"
            >
              <Layout size={14} />
              <span className="text-[11px] pr-1">Escenario</span>
            </button>
            <button
              onClick={() => setModoDiseno("cuadricula")}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                modoDiseno === "cuadricula"
                  ? "bg-white text-emerald-700 shadow-xs border border-slate-200/80 font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Vista Cuadrícula / Galería de Cámaras"
            >
              <Grid size={14} />
              <span className="text-[11px] pr-1">Galería</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-slate-700 text-xs font-mono bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200">
            <Clock size={13} className="text-emerald-600" />
            <span>00:34:10</span>
          </div>
        </div>
      </header>

      {/* 2. ÁREA PRINCIPAL DE CONTENIDO */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <div className="flex-1 p-2 sm:p-4 flex flex-col gap-3 min-h-0 overflow-y-auto lg:overflow-hidden">
          
          {/* MODO 1: ESCENARIO PRINCIPAL (BIM / REVIT / S10 + TIRA DE CÁMARAS) */}
          {modoDiseno === "escenario" && (
            <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 lg:overflow-hidden">
              
              {/* Pantalla Compartida Principal (Visualizador BIM Interactivo o Screen Share) */}
              <div className={`rounded-2xl bg-white border border-slate-200 overflow-hidden flex flex-col shadow-sm relative ${
                pantallaCompartida ? "w-full aspect-video md:aspect-auto flex-1" : "hidden lg:flex flex-1"
              }`}>
                
                {/* Header del Escenario de Software / Pantalla Compartida (Oculto en móvil) */}
                <div className="hidden md:flex h-12 bg-white border-b border-slate-200 px-4 items-center justify-between shrink-0 gap-3">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Monitor size={16} className={presentadorActual.esTuPantalla ? "text-emerald-600" : "text-indigo-600"} />
                    
                    {presentadorActual.esTuPantalla ? (
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                        <span className="text-xs font-extrabold text-emerald-800 truncate">
                          {rol === "docente"
                            ? "Estás compartiendo tu pantalla (Docente Titular)"
                            : "Estás compartiendo tu pantalla (Estudiante Colaborador)"}
                        </span>
                        <button
                          onClick={detenerCompartirPantalla}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer shrink-0 ml-1"
                        >
                          <StopCircle size={12} />
                          <span>Dejar de Compartir</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                        <span className="text-xs font-bold text-slate-800 truncate">
                          Presentando: <strong className="text-indigo-700">{presentadorActual.nombre}</strong>
                        </span>

                        {rol === "docente" && presentadorActual.rol === "estudiante" && (
                          <button
                            onClick={recuperarPantallaDocente}
                            className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                            title="El docente como moderador puede retomar el control de la transmisión"
                          >
                            <RefreshCw size={11} />
                            <span>Retomar Pantalla</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Selector de Software o Switcher */}
                  <div className="flex items-center gap-2 shrink-0">
                    {presentadorActual.tipo === "software" && (
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                        <button
                          onClick={() => setSoftwareTab("revit")}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            softwareTab === "revit"
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          Autodesk Revit 3D
                        </button>
                        <button
                          onClick={() => setSoftwareTab("s10")}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            softwareTab === "s10"
                              ? "bg-amber-600 text-white shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          S10 Presupuestos & APU
                        </button>
                      </div>
                    )}

                    {/* Botón para abrir modal de compartir */}
                    <button
                      onClick={() => setModalCompartir(true)}
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      title="Opciones de pantalla compartida"
                    >
                      <Cast size={14} className="text-emerald-600" />
                      <span className="hidden xl:inline text-[11px]">Compartir</span>
                    </button>

                    {/* Toggle Maximize / Theater Mode */}
                    <button
                      onClick={() => setPantallaMaximizada(!pantallaMaximizada)}
                      className={`p-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                        pantallaMaximizada
                          ? "bg-emerald-600 text-white border-emerald-500"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border-slate-200"
                      }`}
                      title={pantallaMaximizada ? "Restaurar vista" : "Pantalla completa"}
                    >
                      {pantallaMaximizada ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                  </div>
                </div>

                {/* Contenido Visual del Software Compartido */}
                <div className="flex-1 relative bg-slate-100/70 flex items-center justify-center p-3 sm:p-5 overflow-hidden">
                  {pantallaCompartida ? (
                    presentadorActual.tipo === "real" ? (
                      presentadorActual.esTuPantalla && streamPantalla ? (
                        /* PANTALLA COMPLETA O VENTANA REAL DE LA PC DEL USUARIO LOCAL */
                        <div className="w-full h-full rounded-2xl border border-slate-300 bg-slate-950 relative flex items-center justify-center overflow-hidden shadow-md">
                          <video
                            ref={setScreenVideoRef}
                            autoPlay
                            playsInline
                            muted={presentadorActual.esTuPantalla}
                            className="w-full h-full object-contain"
                          />
                          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-2 text-xs shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-slate-800 font-bold">{presentadorActual.software}</span>
                            <span className="text-slate-500 font-mono text-[11px]">• 1080p 60FPS</span>
                          </div>
                          {presentadorActual.esTuPantalla && (
                            <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-emerald-300 flex items-center gap-2 text-xs shadow-sm">
                              <span className="text-emerald-800 font-bold">Transmitiendo a la sala</span>
                              <button
                                onClick={detenerCompartirPantalla}
                                className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] cursor-pointer"
                              >
                                Detener
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* TRANSMISIÓN RECIBIDA DE LA PANTALLA DEL DOCENTE EN VIVO (VISTA ESTUDIANTE) */
                        <div className="w-full h-full rounded-2xl border border-slate-300 bg-slate-950 relative flex items-center justify-center overflow-hidden shadow-md">
                          {pantallaFrame ? (
                            <img
                              src={pantallaFrame}
                              alt="Transmisión en directo del docente"
                              className="w-full h-full object-contain select-none"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-center p-6 space-y-4">
                              <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center animate-pulse shadow-lg">
                                <Monitor size={32} />
                              </div>
                              <div className="space-y-1">
                                <div className="text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                                  <span className="truncate max-w-[280px] sm:max-w-none">
                                    ¡{nombreDocente || presentadorActual.nombre || "Mg. Ing. Víctor Huamán"} está transmitiendo su pantalla!
                                  </span>
                                </div>
                                <p className="text-slate-400 text-xs">
                                  Sincronizando fotogramas y transmisión en vivo de la clase...
                                </p>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span>Transmisión en directo sincronizada • Modo Colaborativo</span>
                              </div>
                            </div>
                          )}

                          <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-2 text-xs text-white shadow-md">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                            <span className="font-bold">EN VIVO</span>
                            <span className="text-slate-400 font-mono text-[11px]">• {presentadorActual.nombre || "Docente"}</span>
                          </div>

                          <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 flex items-center gap-2 text-xs text-white shadow-md">
                            <span className="text-emerald-400 font-semibold">{presentadorActual.software || "Autodesk Revit 2026"}</span>
                            <span className="text-slate-400 font-mono text-[11px]">• 1080p HD Sincronizado</span>
                          </div>
                        </div>
                      )
                    ) : softwareTab === "revit" ? (
                      /* ESCENARIO LIMPIO Y ESPACIOSO DE CÁTEDRA BIM */
                      <div className="w-full h-full rounded-2xl border border-slate-200 bg-white relative flex flex-col justify-between p-6 shadow-xs overflow-hidden">
                        
                        {/* Lienzo arquitectónico espacioso y minimalista */}
                        <div className="flex-1 flex flex-col items-center justify-center relative my-4">
                          {/* Cuadrícula arquitectónica sutil de fondo */}
                          <div
                            className="absolute inset-0 opacity-15 pointer-events-none"
                            style={{
                              backgroundImage:
                                "radial-gradient(circle at 1px 1px, #94a3b8 1px, transparent 0)",
                              backgroundSize: "32px 32px"
                            }}
                          />

                          <div className="relative z-10 max-w-md text-center p-6 rounded-2xl bg-slate-50/70 border border-slate-200/60 backdrop-blur-xs">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 mx-auto flex items-center justify-center mb-3">
                              <Monitor size={22} />
                            </div>
                            <h3 className="text-sm font-bold text-slate-800 mb-1">
                              Espacio de Trabajo Sincrónico
                            </h3>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              Proyección de clase en vivo. Utiliza los controles superiores para transmitir planos, modelos BIM o compartir pantalla.
                            </p>
                          </div>
                        </div>

                        {/* Barra de estado inferior limpia */}
                        <div className="flex justify-between items-center text-[11px] text-slate-500 pt-3 border-t border-slate-100 font-mono">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Transmisión sincrónica activa
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* SIMULADOR DE S10 COSTOS Y PRESUPUESTOS MODERNO */
                      <div className="w-full h-full rounded-2xl border border-slate-200 bg-white relative flex flex-col justify-between p-4 shadow-xs font-mono text-xs">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2 text-xs">
                          <span className="text-amber-700 font-bold flex items-center gap-1.5 text-sm">
                            <FileSpreadsheet size={16} /> Partida: Concreto f'c=210 kg/cm² en Zapatas
                          </span>
                          <span className="text-slate-700 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                            Rendimiento Oficial CAPECO: <strong>25.00 m³/DÍA</strong>
                          </span>
                        </div>

                        <div className="flex-1 my-3 overflow-y-auto space-y-2">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                              <tr>
                                <th className="p-2.5 rounded-l-lg">Descripción del Insumo</th>
                                <th className="p-2.5">Unidad</th>
                                <th className="p-2.5">Cuadrilla</th>
                                <th className="p-2.5">Cantidad</th>
                                <th className="p-2.5">Precio Unitario</th>
                                <th className="p-2.5 rounded-r-lg">Parcial (S/.)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                              <tr className="hover:bg-slate-50">
                                <td className="p-2.5 font-bold text-slate-900">Capataz de Obra</td>
                                <td className="p-2.5">hh</td>
                                <td className="p-2.5">0.20</td>
                                <td className="p-2.5">0.0640</td>
                                <td className="p-2.5">S/. 32.50</td>
                                <td className="p-2.5 font-bold text-amber-700">S/. 2.08</td>
                              </tr>
                              <tr className="hover:bg-slate-50">
                                <td className="p-2.5 font-bold text-slate-900">Operario Estructuras</td>
                                <td className="p-2.5">hh</td>
                                <td className="p-2.5">2.00</td>
                                <td className="p-2.5">0.6400</td>
                                <td className="p-2.5">S/. 27.80</td>
                                <td className="p-2.5 font-bold text-amber-700">S/. 17.79</td>
                              </tr>
                              <tr className="hover:bg-slate-50">
                                <td className="p-2.5 font-bold text-slate-900">Oficial + Peón</td>
                                <td className="p-2.5">hh</td>
                                <td className="p-2.5">8.00</td>
                                <td className="p-2.5">2.5600</td>
                                <td className="p-2.5">S/. 20.20</td>
                                <td className="p-2.5 font-bold text-amber-700">S/. 51.71</td>
                              </tr>
                              <tr className="hover:bg-slate-50">
                                <td className="p-2.5 font-bold text-slate-900">Cemento Portland Tipo I</td>
                                <td className="p-2.5">bol</td>
                                <td className="p-2.5">-</td>
                                <td className="p-2.5">8.5000</td>
                                <td className="p-2.5">S/. 28.50</td>
                                <td className="p-2.5 font-bold text-amber-700">S/. 242.25</td>
                              </tr>
                              <tr className="hover:bg-slate-50">
                                <td className="p-2.5 font-bold text-slate-900">Piedra Chancada 1/2"</td>
                                <td className="p-2.5">m³</td>
                                <td className="p-2.5">-</td>
                                <td className="p-2.5">0.8500</td>
                                <td className="p-2.5">S/. 78.00</td>
                                <td className="p-2.5 font-bold text-amber-700">S/. 66.30</td>
                              </tr>
                              <tr className="hover:bg-slate-50">
                                <td className="p-2.5 font-bold text-slate-900">Arena Gruesa</td>
                                <td className="p-2.5">m³</td>
                                <td className="p-2.5">-</td>
                                <td className="p-2.5">0.5200</td>
                                <td className="p-2.5">S/. 65.00</td>
                                <td className="p-2.5 font-bold text-amber-700">S/. 33.80</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <div className="flex justify-between items-center text-xs pt-3 border-t border-slate-200 bg-slate-50 p-3 rounded-xl">
                          <span className="text-slate-700 font-semibold">Costo Unitario Directo Total por m³:</span>
                          <span className="text-amber-700 font-black text-base">S/. 428.60 x m³</span>
                        </div>
                      </div>
                    )
                  ) : (
                    /* LOBBY COLABORATIVO CUANDO NADIE COMPARTE PANTALLA */
                    <div className="text-center space-y-4 text-slate-600 max-w-md p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xl">
                      <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-sm">
                        <Monitor size={32} />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900">
                          Espacio de Transmisión Disponible
                        </h4>
                        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                          Tanto el docente como los estudiantes colaboradores pueden proyectar su pantalla de PC o abrir los proyectos BIM/APU en cualquier momento.
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                        <button
                          onClick={iniciarCompartirReal}
                          className="flex-1 btn-emerald text-xs py-2.5 px-3 font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                        >
                          <Laptop size={14} />
                          <span>Compartir mi PC</span>
                        </button>
                        <button
                          onClick={() => iniciarCompartirSoftware("revit")}
                          className="flex-1 btn-obsidian text-xs py-2.5 px-3 font-bold flex items-center justify-center gap-2 text-slate-700 border-slate-200 hover:bg-slate-100 cursor-pointer"
                        >
                          <Building2 size={14} />
                          <span>Abrir Revit 3D</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tira Lateral de Cámaras (Docente y Estudiante) */}
              {!pantallaMaximizada && (
                <div className="w-full lg:w-80 flex flex-col gap-3 shrink-0">
                
                {/* 1. MÓDULO CÁMARA DEL DOCENTE */}
                <div
                  onClick={() => {
                    if (rol === "docente" && !streamLocal) {
                      iniciarCamara();
                    }
                  }}
                  className={`w-full aspect-video md:aspect-auto md:min-h-[240px] md:h-60 rounded-2xl bg-slate-900 border-2 border-emerald-500/70 relative overflow-hidden shadow-sm flex flex-col justify-between p-3.5 group ${
                    rol === "docente" && !streamLocal ? "cursor-pointer hover:border-emerald-400" : ""
                  }`}
                >
                  
                  {camaraDocenteActiva ? (
                    rol === "docente" && streamLocal ? (
                      <video
                        ref={setVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className={`absolute inset-0 w-full h-full object-cover ${streamLocal?._isVirtual ? "" : "scale-x-[-1]"}`}
                      />
                    ) : rol === "docente" && !streamLocal ? (
                      /* Si el docente está en sesión pero la webcam aún no encendió */
                      <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-center p-3 z-0">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-2 shadow-lg shadow-emerald-500/10">
                          <Camera size={22} className="animate-pulse" />
                        </div>
                        <span className="text-xs font-bold text-white mb-0.5">Cámara Web del Docente</span>
                        <p className="text-[10px] text-slate-300 max-w-[210px] mb-2 leading-tight">
                          Haz clic para encender tu cámara en vivo para toda la clase
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            iniciarCamara();
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/30 cursor-pointer active:scale-95 transition-all z-20"
                        >
                          <Camera size={13} />
                          <span>Encender Cámara</span>
                        </button>
                      </div>
                    ) : (
                      /* Feed de Cátedra del Docente para estudiantes */
                      <div className="absolute inset-0 relative overflow-hidden bg-slate-950 flex items-center justify-center">
                        {streamVideoDocente ? (
                          <>
                            <img
                              src={streamVideoDocente}
                              alt={nombreDocente}
                              className="w-full h-full object-cover select-none"
                            />
                            <div className="absolute top-2.5 left-2.5 z-20 bg-rose-600/95 text-white font-mono font-bold text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md border border-white/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              <span>EN DIRECTO</span>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/80 flex flex-col items-center justify-center p-4 text-center select-none">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center font-black text-xl mb-2.5 shadow-lg shadow-emerald-500/10 relative">
                              <span>{nombreDocente ? nombreDocente.substring(0, 2).toUpperCase() : "VH"}</span>
                              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" />
                            </div>
                            <span className="text-xs font-bold text-white mb-0.5">{nombreDocente}</span>
                            <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                              Cátedra en Vivo • Conectado
                            </span>
                          </div>
                        )}
                        {/* Overlay gradiente para legibilidad */}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent pointer-events-none" />
                      </div>
                    )
                  ) : (
                    <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center text-slate-500 text-xs gap-1.5">
                      <VideoOff size={28} className="text-slate-400" />
                      <span>Cámara del docente desactivada</span>
                    </div>
                  )}

                  {/* Etiqueta discreta en móvil: Nombre • En vivo */}
                  <div className="md:hidden absolute bottom-2.5 left-2.5 z-20 bg-slate-900/80 backdrop-blur-md text-white px-2.5 py-1 rounded-xl border border-white/15 flex items-center gap-1.5 text-[11px] font-medium shadow-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold truncate max-w-[170px]">{nombreDocente}</span>
                    <span className="text-slate-300 text-[10px]">• En vivo</span>
                  </div>

                  {/* Badge superior sobre el video del docente (solo desktop) */}
                  <div className="hidden md:flex relative z-10 justify-end items-center text-[10px] font-mono">
                    <span className="bg-white/95 backdrop-blur-md text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5 shadow-xs font-bold">
                      <Volume2 size={12} className="text-emerald-600 animate-bounce" />
                      Audio Activo
                    </span>
                  </div>

                  {/* Badge inferior con nombre del docente y ondas de voz (solo desktop) */}
                  <div className="hidden md:flex relative z-10 justify-between items-center bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-bold text-slate-900 truncate">{nombreDocente}</span>
                    </div>
                    {/* Visualizador de ondas de habla */}
                    <div className="flex items-center gap-0.5">
                      <span className="w-1 h-3 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="w-1 h-5 bg-emerald-500 rounded-full animate-pulse delay-75" />
                      <span className="w-1 h-2 bg-emerald-500 rounded-full animate-pulse delay-150" />
                    </div>
                  </div>
                </div>

                {/* RESUMEN DE ATENCIÓN GRUPAL Y ESTADO DE CABINA (SOLO MODO DOCENTE) */}
                {rol === "docente" && (
                  <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950 text-white p-3.5 border border-emerald-500/40 shadow-sm space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles size={14} className="text-emerald-400" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                          Telemetría de Atención Grupal
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        {listaEstudiantesActivos.length} Alumnos
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-white/5 rounded-xl p-2.5 border border-white/10">
                      <div>
                        <div className="text-2xl font-black text-emerald-400 font-mono">
                          {listaEstudiantesActivos.length > 0
                            ? Math.round(listaEstudiantesActivos.reduce((a, c) => a + (Number(c.atencion) || 85), 0) / listaEstudiantesActivos.length)
                            : 89}%
                        </div>
                        <div className="text-[10px] text-slate-400">Promedio general de atención</div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 text-[10px] font-mono">
                        <span className={`px-2 py-0.5 rounded-md font-bold flex items-center gap-1 ${
                          micActivo ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        }`}>
                          {micActivo ? <Mic size={11} /> : <MicOff size={11} />}
                          <span>{micActivo ? "Mic Activo" : "Silenciado"}</span>
                        </span>
                        <span className={`px-2 py-0.5 rounded-md font-bold flex items-center gap-1 ${
                          camaraActiva ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        }`}>
                          {camaraActiva ? <Video size={11} /> : <VideoOff size={11} />}
                          <span>{camaraActiva ? "Cámara Activa" : "Cámara Off"}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. MÓDULO CÁMARA DEL ESTUDIANTE (TU CÁMARA CON BIOMETRÍA EN VIVO) */}
                <div className="w-full rounded-2xl bg-white border-2 border-indigo-400 hover:border-indigo-500 transition-all relative overflow-hidden shadow-sm flex flex-col justify-between p-3.5 group min-h-[260px]">
                  
                  {/* Visualización de Cámara Web Real del Usuario */}
                  {camaraActiva ? (
                    rol === "estudiante" && estadoCamara === "activa" && streamLocal ? (
                      <>
                        <video
                          ref={setVideoRef}
                          autoPlay
                          muted
                          playsInline
                          className={`absolute inset-0 w-full h-full object-cover ${streamLocal?._isVirtual ? "" : "scale-x-[-1]"}`}
                        />

                        {/* Malla biométrica sutil sobre la cámara con detección facial IA */}
                        {mostrarHUD && (() => {
                          const st = obtenerDatosEstado(emocionActual);
                          return (
                            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                              <div className="w-32 h-36 border-2 border-dashed border-indigo-400/60 rounded-3xl relative flex items-start justify-center p-1.5 shadow-sm">
                                <span className="absolute -top-1.5 -left-1.5 w-3 h-3 border-t-2 border-l-2 border-indigo-500" />
                                <span className="absolute -top-1.5 -right-1.5 w-3 h-3 border-t-2 border-r-2 border-indigo-500" />
                                <span className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-b-2 border-l-2 border-indigo-500" />
                                <span className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-b-2 border-r-2 border-indigo-500" />
                                <div className="bg-slate-900/90 text-white px-2 py-0.5 rounded-full text-[9px] font-mono font-bold flex items-center gap-1 shadow-md border border-white/20">
                                  <span>{st.emoji}</span>
                                  <span>{st.nombre.toUpperCase()} {scoreAtencion}%</span>
                                </div>
                              </div>
                              <div className="mt-2 bg-slate-900/85 backdrop-blur-xs text-white text-[8px] font-mono px-2 py-0.5 rounded-full border border-white/10 flex items-center gap-1 shadow-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span>IA: {latenciaMs}ms • 96x96 MobileNet</span>
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    ) : (() => {
                      const streamEstudiante =
                        (alumnoMuestra && (streamVideoEstudiantes[String(alumnoMuestra.id)] || streamVideoEstudiantes[alumnoMuestra.nombre])) ||
                        streamVideoEstudiantes["_ultimo"] ||
                        null;

                      if (rol === "docente" && streamEstudiante) {
                        return (
                          <div className="absolute inset-0 bg-slate-950 relative overflow-hidden flex items-center justify-center">
                            <img
                              src={streamEstudiante}
                              alt={alumnoMuestra?.nombre || "Estudiante en Vivo"}
                              className="w-full h-full object-cover select-none"
                            />
                            <div className="absolute top-2.5 left-2.5 z-20 bg-indigo-600/95 text-white font-mono font-bold text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md border border-white/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>ALUMNO EN VIVO</span>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent pointer-events-none" />
                          </div>
                        );
                      }

                      return (
                        /* FEED ASISTIDO BIOMÉTRICO (CUANDO LA WEBCAM FÍSICA NO ESTÁ DISPONIBLE O PERMISOS) */
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-indigo-50/50 to-slate-100 flex flex-col items-center justify-center text-center p-3">
                          <div className="relative mb-2">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center font-black text-white text-xl shadow-md shadow-indigo-500/20">
                              {rol === "docente"
                                ? inicialesEstudianteMuestra
                                : (usuario?.nombre ? usuario.nombre.substring(0, 2).toUpperCase() : "ES")}
                            </div>
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                            <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 bg-white rounded-md text-[10px] font-bold border border-slate-200 shadow-xs">
                              {obtenerDatosEstado(rol === "docente" ? (alumnoMuestra?.emocion || "Atento") : emocionActual).emoji}
                            </span>
                          </div>

                          <span className="text-xs font-bold text-slate-900 truncate max-w-[200px]">
                            {rol === "docente"
                              ? (alumnoMuestra?.nombre || "Esperando estudiantes...")
                              : nombreEstudianteActivo}
                          </span>

                          <span className="text-[10px] text-indigo-700 mt-1 flex items-center gap-1 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                            {rol === "docente"
                              ? (alumnoMuestra ? "Alumno Sincronizado en Vivo" : "Esperando conexión de alumnos")
                              : "Cámara Asistida Activa"}
                          </span>

                          {rol === "estudiante" && (
                            <button
                              onClick={() => iniciarCamara()}
                              className="mt-2 text-[10px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-300 flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                            >
                              <Camera size={11} />
                              <span>Encender Cámara</span>
                            </button>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center text-slate-500 text-xs gap-1.5">
                      <VideoOff size={28} className="text-slate-400" />
                      <span>{rol === "docente" ? "Cámara del alumno apagada" : "Tu cámara está apagada"}</span>
                    </div>
                  )}

                  {/* Header sobre video del estudiante con estado detallado */}
                  <div className="relative z-10 flex justify-between items-center text-[10px]">
                    <span className="hidden md:inline-block bg-white/95 backdrop-blur-md text-indigo-700 px-2 py-0.5 rounded-lg border border-indigo-200 font-bold shadow-xs">
                      {rol === "docente" ? "ALUMNO EN VIVO (MUESTRA)" : "TU CÁMARA (ESTUDIANTE)"}
                    </span>
                    {(() => {
                      const st = obtenerDatosEstado(rol === "docente" ? (alumnoMuestra?.emocion || "Atento") : emocionActual);
                      return (
                        <span className={`badge-pill text-[10px] font-bold border ml-auto md:ml-0 ${st.badge}`}>
                          {st.emoji} {st.nombre} • {rol === "docente" ? (alumnoMuestra?.atencion || 95) : scoreAtencion}%
                        </span>
                      );
                    })()}
                  </div>

                  {/* Footer sobre video del estudiante con estado de biometría y selector interactivo */}
                  <div className="relative z-10 flex flex-col gap-1.5 mt-auto pt-2">
                    <div className="hidden md:flex justify-between items-center bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs shadow-xs">
                      <span className="font-bold text-slate-900 truncate max-w-[140px]">
                        {rol === "docente" ? (alumnoMuestra?.nombre || "Esperando estudiantes...") : `${nombreEstudianteActivo} (Tú)`}
                      </span>
                      {(() => {
                        const st = obtenerDatosEstado(rol === "docente" ? (alumnoMuestra?.emocion || "Atento") : emocionActual);
                        return (
                          <span className={`text-[10px] font-bold flex items-center gap-1 ${st.colorTexto}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot} animate-pulse`} />
                            {st.emoji} {st.nombre.toUpperCase()}
                          </span>
                        );
                      })()}
                    </div>

                    {/* SELECTOR INTERACTIVO DE ESTADO SOLO EN EL PANEL DEL ESTUDIANTE */}
                    {rol === "estudiante" && (
                      <div className="bg-white/95 backdrop-blur-md px-2 py-1.5 rounded-xl border border-slate-200 shadow-xs">
                        <div className="hidden md:flex text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1 items-center justify-between">
                          <span className="flex items-center gap-1 text-slate-700">
                            <Sparkles size={10} className="text-emerald-600" />
                            <span>Tu Estado en Vivo:</span>
                            {modeloCargado && (
                              <span className="text-[8px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full border border-emerald-300">
                                IA Activa
                              </span>
                            )}
                          </span>
                          <span className="text-[9px] font-mono text-emerald-700 font-bold">
                            {scoreAtencion}% atención
                            {iaPrediccionInfo?.confianza ? ` (${iaPrediccionInfo.confianza}%)` : ""}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { id: "Atento", label: "Atento", emoji: "🎯" },
                            { id: "Distraído", label: "Distraído", emoji: "📱" },
                            { id: "Triste", label: "Triste", emoji: "😢" },
                            { id: "Alegre", label: "Alegre", emoji: "😊" }
                          ].map((st) => (
                            <button
                              key={st.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                cambiarEstadoManual(st.id);
                              }}
                              className={`py-1 px-0.5 rounded-lg text-[9px] font-bold flex items-center justify-center gap-0.5 transition-all cursor-pointer border ${
                                emocionActual === st.id
                                  ? "bg-slate-900 text-white border-slate-900 shadow-xs font-black scale-[1.02]"
                                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                              }`}
                              title={`Marcar estado: ${st.label}`}
                            >
                              <span>{st.emoji}</span>
                              <span className="truncate">{st.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. NAVEGACIÓN LIMPIA POR PESTAÑAS EN MÓVIL (< md) */}
                <div className="md:hidden flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-2xs w-full">
                  <button
                    onClick={() => setPestanaMovil("participantes")}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      pestanaMovil === "participantes"
                        ? "bg-white text-emerald-800 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <Users size={14} className={pestanaMovil === "participantes" ? "text-emerald-600" : "text-slate-500"} />
                    <span>Participantes ({listaEstudiantesActivos.length + 1})</span>
                  </button>

                  <button
                    onClick={() => {
                      setPestanaMovil("chat");
                      setMensajesNoLeidos(0);
                    }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer relative ${
                      pestanaMovil === "chat"
                        ? "bg-white text-emerald-800 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <MessageSquare size={14} className={pestanaMovil === "chat" ? "text-emerald-600" : "text-slate-500"} />
                    <span>Chat en Vivo</span>
                    {mensajesNoLeidos > 0 && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
                    )}
                  </button>
                </div>

                {/* CONTENIDO DE PESTAÑAS EN MÓVIL (< md) */}
                <div className="md:hidden w-full">
                  {pestanaMovil === "participantes" && (
                    <div className="w-full rounded-2xl bg-white border border-slate-200 p-3.5 space-y-2 shadow-xs">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-800 pb-1 border-b border-slate-100">
                        <span className="flex items-center gap-1.5 text-slate-900">
                          <Users size={14} className="text-emerald-600" />
                          <span>Compañeros en Sala ({listaEstudiantesActivos.length})</span>
                        </span>
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          En vivo
                        </span>
                      </div>

                      {listaEstudiantesActivos.length === 0 ? (
                        <div className="py-4 text-center text-slate-400 text-xs font-medium">
                          Sin otros alumnos conectados aún
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                          {listaEstudiantesActivos.map((est, i) => {
                            const st = obtenerDatosEstado(est.emocion);
                            const estKey = est.id || est.nombre;
                            return (
                              <div
                                key={estKey || i}
                                className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs hover:border-slate-300 transition-all shadow-2xs gap-2"
                              >
                                <div className="flex items-center gap-2 truncate min-w-0">
                                  <span className={`w-2 h-2 rounded-full ${st.dot} shrink-0`} />
                                  <div className="truncate">
                                    <span className="font-bold text-slate-800 block text-xs truncate">{(est.nombre || "Estudiante")}</span>
                                    <span className="text-[10px] text-slate-500 font-mono">{est.atencion}% atención</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`px-1.5 py-0.5 rounded-md font-bold text-[9px] border ${st.badge}`}>
                                    {st.emoji} {st.nombre}
                                  </span>
                                  {rol === "docente" && (
                                    <button
                                      onClick={() => enviarIntervencionRapida(est)}
                                      className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] flex items-center gap-1 transition-all shadow-xs cursor-pointer active:scale-95"
                                      title={`Enviar intervención a ${est.nombre || "Estudiante"}`}
                                    >
                                      <Sparkles size={11} />
                                      <span>{intervencionEnviadaA === estKey ? "¡Enviado!" : "Intervenir"}</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {pestanaMovil === "chat" && (
                    <div className="w-full h-96 rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
                      <ChatEnVivo
                        aulaId={aulaId}
                        usuario={usuario}
                        rol={rol}
                        wsRef={wsRef}
                        mensajes={mensajesChat}
                        onEnviarMensaje={handleEnviarMensajeChat}
                        temaClase={clase?.nombre || "Modelado BIM & Revit"}
                      />
                    </div>
                  )}
                </div>

                {/* 3. RESUMEN RÁPIDO DE PARTICIPANTES EN ESCRITORIO (md:flex) */}
                <div className="hidden md:flex w-full rounded-2xl bg-white border border-slate-200 p-3.5 flex-col justify-between space-y-2 shadow-xs">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-1.5 text-slate-900">
                      <Users size={14} className="text-emerald-600" />
                      {rol === "docente" ? `Alumnos en Sala (${listaEstudiantesActivos.length})` : `Compañeros en Sala (${listaEstudiantesActivos.length})`}
                    </span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      En vivo
                    </span>
                  </div>

                  {listaEstudiantesActivos.length === 0 ? (
                    <div className="py-4 text-center text-slate-400 text-xs font-medium">
                      Sin alumnos conectados en sala aún
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                      {listaEstudiantesActivos.map((est, i) => {
                        const st = obtenerDatosEstado(est.emocion);
                        const estKey = est.id || est.nombre;
                        return (
                          <div
                            key={estKey || i}
                            className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs hover:border-slate-300 transition-all shadow-2xs gap-2"
                          >
                            <div className="flex items-center gap-2 truncate min-w-0">
                              <span className={`w-2 h-2 rounded-full ${st.dot} shrink-0`} />
                              <div className="truncate">
                                <span className="font-bold text-slate-800 block text-xs truncate">{(est.nombre || "Estudiante")}</span>
                                <span className="text-[10px] text-slate-500 font-mono">{est.atencion}% atención</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`px-1.5 py-0.5 rounded-md font-bold text-[9px] border ${st.badge}`}>
                                {st.emoji} {st.nombre}
                              </span>
                              {rol === "docente" && (
                                <button
                                  onClick={() => enviarIntervencionRapida(est)}
                                  className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] flex items-center gap-1 transition-all shadow-xs cursor-pointer active:scale-95"
                                  title={`Enviar intervención pedagógica a ${est.nombre || "Estudiante"}`}
                                >
                                  <Sparkles size={11} />
                                  <span>{intervencionEnviadaA === estKey ? "¡Enviado!" : "Intervenir"}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                </div>
              )}
            </div>
          )}

          {/* MODO 2: GALERÍA CUADRÍCULA (DUAL CAMERAS BIG TILES) */}
          {modoDiseno === "cuadricula" && (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-h-0 overflow-y-auto p-1">
              
              {/* Tile 1: Docente Principal (Cámara Grande) */}
              <div className="rounded-2xl bg-white border-2 border-emerald-500/70 p-4 relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[280px]">
                {camaraDocenteActiva ? (
                  rol === "docente" && streamLocal ? (
                    <video
                      ref={setVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : rol === "docente" && !streamLocal ? (
                    <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center text-center p-4">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-3">
                        <Camera size={26} className="animate-pulse" />
                      </div>
                      <span className="text-sm font-bold text-white mb-1">Cámara Web del Docente</span>
                      <p className="text-xs text-slate-400 max-w-[220px] mb-3">
                        Haz clic para conectar y emitir tu webcam real a los alumnos
                      </p>
                      <button
                        onClick={() => iniciarCamara()}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-500/25 cursor-pointer active:scale-95 transition-all"
                      >
                        <Camera size={14} />
                        <span>Encender Cámara Web</span>
                      </button>
                    </div>
                  ) : (
                    <div className="absolute inset-0 relative overflow-hidden bg-slate-950 flex items-center justify-center">
                      {streamVideoDocente ? (
                        <>
                          <img
                            src={streamVideoDocente}
                            alt={nombreDocente}
                            className="w-full h-full object-cover select-none"
                          />
                          <div className="absolute top-2.5 left-2.5 z-20 bg-rose-600/95 text-white font-mono font-bold text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md border border-white/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            <span>EN DIRECTO</span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/80 flex flex-col items-center justify-center p-4 text-center select-none">
                          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center font-black text-xl mb-2 shadow-lg shadow-emerald-500/10 relative">
                            <span>{nombreDocente ? nombreDocente.substring(0, 2).toUpperCase() : "VH"}</span>
                            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" />
                          </div>
                          <span className="text-xs font-bold text-white mb-0.5">{nombreDocente}</span>
                          <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            Cátedra en Vivo
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent pointer-events-none" />
                    </div>
                  )
                ) : (
                  <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center text-slate-500 text-xs">
                    <VideoOff size={32} className="mb-2 text-slate-400" />
                    <span>Cámara apagada por el docente</span>
                  </div>
                )}

                <div className="relative z-10 flex justify-between items-center text-xs">
                  <span className="badge-pill bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    DOCENTE TITULAR
                  </span>
                  <span className="bg-white/95 backdrop-blur-md text-emerald-800 px-2 py-0.5 rounded-lg border border-slate-200 text-xs font-mono flex items-center gap-1 shadow-xs font-bold">
                    <Volume2 size={13} className="text-emerald-600" /> Hablando
                  </span>
                </div>

                <div className="relative z-10 flex justify-between items-center bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs">
                  <span className="font-bold text-slate-900 text-sm">{nombreDocente}</span>
                  <span className="text-xs font-mono text-emerald-700 font-bold">Moderador</span>
                </div>
              </div>

              {/* Tile 2: Estudiante Activo (Tu Cámara con Biometría en Vivo) */}
              <div className="rounded-2xl bg-white border-2 border-indigo-400 p-4 relative overflow-hidden shadow-sm flex flex-col justify-between min-h-[280px]">
                {camaraActiva ? (
                  rol === "estudiante" && estadoCamara === "activa" && streamLocal ? (
                    <video
                      ref={setVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className={`absolute inset-0 w-full h-full object-cover ${streamLocal?._isVirtual ? "" : "scale-x-[-1]"}`}
                    />
                  ) : (() => {
                    const streamEstudiante =
                      (alumnoMuestra && (streamVideoEstudiantes[String(alumnoMuestra.id)] || streamVideoEstudiantes[alumnoMuestra.nombre])) ||
                      streamVideoEstudiantes["_ultimo"] ||
                      null;

                    if (rol === "docente" && streamEstudiante) {
                      return (
                        <div className="absolute inset-0 bg-slate-950 relative overflow-hidden flex items-center justify-center">
                          <img
                            src={streamEstudiante}
                            alt={alumnoMuestra?.nombre || "Estudiante en Vivo"}
                            className="w-full h-full object-cover select-none"
                          />
                          <div className="absolute top-2.5 left-2.5 z-20 bg-indigo-600/95 text-white font-mono font-bold text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md border border-white/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>ALUMNO EN VIVO</span>
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent pointer-events-none" />
                        </div>
                      );
                    }

                    return (
                      <div className="absolute inset-0 bg-gradient-to-tr from-slate-50 via-indigo-50/50 to-slate-100 flex flex-col items-center justify-center p-4">
                        <div className="relative mb-3">
                          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center font-black text-2xl text-white shadow-md shadow-indigo-500/20">
                            {rol === "docente"
                              ? inicialesEstudianteMuestra
                              : (usuario?.nombre ? usuario.nombre.substring(0, 2).toUpperCase() : "ES")}
                          </div>
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                        </div>
                        <span className="text-sm font-bold text-slate-900">
                          {rol === "docente" ? (alumnoMuestra?.nombre || "Esperando estudiantes...") : nombreEstudianteActivo}
                        </span>
                        <span className="text-xs text-indigo-700 flex items-center gap-1.5 mt-1 font-bold">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                          {rol === "docente" ? (alumnoMuestra ? "Alumno Sincronizado en Vivo" : "Esperando alumnos en sala") : "Cámara Asistida Activa"}
                        </span>
                      </div>
                    );
                  })()
                ) : (
                  <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center text-slate-500 text-xs">
                    <VideoOff size={32} className="mb-2 text-slate-400" />
                    <span>{rol === "docente" ? "Cámara del alumno apagada" : "Tu cámara está apagada"}</span>
                  </div>
                )}

                <div className="relative z-10 flex justify-between items-center text-xs">
                  <span className="badge-pill bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                    {rol === "docente" ? "ALUMNO EN VIVO (MUESTRA)" : "TU FEED (ESTUDIANTE)"}
                  </span>
                  {(() => {
                    const st = obtenerDatosEstado(rol === "docente" ? (alumnoMuestra?.emocion || "Atento") : emocionActual);
                    return (
                      <span className={`badge-pill text-xs font-bold border ${st.badge}`}>
                        {st.emoji} {st.nombre} • {rol === "docente" ? (alumnoMuestra?.atencion || 95) : scoreAtencion}%
                      </span>
                    );
                  })()}
                </div>

                <div className="relative z-10 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs">
                    <span className="font-bold text-slate-900 text-sm">
                      {rol === "docente" ? (alumnoMuestra?.nombre || "Esperando estudiantes...") : nombreEstudianteActivo}
                    </span>
                    {(() => {
                      const st = obtenerDatosEstado(rol === "docente" ? (alumnoMuestra?.emocion || "Atento") : emocionActual);
                      return (
                        <span className={`text-xs font-bold flex items-center gap-1.5 ${st.colorTexto}`}>
                          <span className={`w-2 h-2 rounded-full ${st.dot} animate-pulse`} />
                          {st.emoji} {st.nombre}
                        </span>
                      );
                    })()}
                  </div>

                  {rol === "estudiante" && (
                    <div className="bg-white/95 backdrop-blur-md p-1.5 rounded-xl border border-slate-200 shadow-xs grid grid-cols-4 gap-1">
                      {[
                        { id: "Atento", label: "Atento", emoji: "🎯" },
                        { id: "Distraído", label: "Distraído", emoji: "📱" },
                        { id: "Triste", label: "Triste", emoji: "😢" },
                        { id: "Alegre", label: "Alegre", emoji: "😊" }
                      ].map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => cambiarEstadoManual(st.id)}
                          className={`py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border ${
                            emocionActual === st.id
                              ? "bg-slate-900 text-white border-slate-900 shadow-xs font-black"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <span>{st.emoji}</span>
                          <span>{st.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tiles de otros alumnos conectados */}
              {listaEstudiantesActivos.map((est, i) => {
                const st = obtenerDatosEstado(est.emocion);
                const nombreEst = est.nombre || "Estudiante";
                const iniciales = (nombreEst.split(" ").filter(Boolean).map((n) => n[0]).slice(0, 2).join("") || "ES");
                return (
                  <div
                    key={est.id || i}
                    className="rounded-2xl bg-white border border-slate-200 p-4 relative overflow-hidden shadow-xs flex flex-col justify-between min-h-[280px] hover:border-emerald-400 transition-colors"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-white text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-lg mb-2 shadow-xs">
                        {iniciales}
                      </div>
                      <span className="text-xs font-bold text-slate-900">{nombreEst}</span>
                      <span className="text-[11px] text-slate-500 font-mono mt-0.5">{est.softwareActivo || "Revit 2026"}</span>
                      <span className={`badge-pill mt-2 text-[10px] font-bold border ${st.badge}`}>
                        {st.emoji} {st.nombre} • {est.atencion}%
                      </span>
                    </div>

                  <div className="relative z-10 flex justify-between items-center text-xs">
                    <span className="text-[10px] font-mono text-slate-700 bg-white/95 px-2 py-0.5 rounded-lg border border-slate-200 shadow-xs">
                      Cámara Activa
                    </span>
                  </div>

                  <div className="relative z-10 flex justify-between items-center bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
                    <span className="font-bold text-slate-900 text-xs truncate">{nombreEst}</span>
                    <span className="text-[10px] font-mono text-slate-500">{est.tiempoConexion || "1m"}</span>
                  </div>
                </div>
              );
            })}

            </div>
          )}

          {/* 3. BARRA FLOTANTE DE CONTROL ESTILO DOCK MODERNO (BOTTOM BAR) */}
          <div className="h-16 bg-white/95 backdrop-blur-2xl border border-slate-200/90 rounded-2xl px-2 sm:px-6 flex items-center justify-between shrink-0 shadow-xl relative z-40">
            
            {/* CONTROLES MÓVILES ESENCIALES (md:hidden) - MÁXIMO 5-6 BOTONES BIEN ESPACIADOS */}
            <div className="md:hidden flex items-center justify-around w-full gap-1">
              {/* 1. Micrófono */}
              <button
                onClick={() => setMicActivo(!micActivo)}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                  micActivo
                    ? "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                    : "bg-rose-600 text-white shadow-rose-600/30"
                }`}
                title={micActivo ? "Silenciar micrófono" : "Activar micrófono"}
              >
                {micActivo ? <Mic size={18} /> : <MicOff size={18} />}
              </button>

              {/* 2. Cámara */}
              <button
                onClick={handleToggleCamara}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                  camaraActiva
                    ? "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                    : "bg-rose-600 text-white shadow-rose-600/30"
                }`}
                title={camaraActiva ? "Apagar cámara" : "Encender cámara"}
              >
                {camaraActiva ? <Video size={18} /> : <VideoOff size={18} />}
              </button>

              {/* 3. Compartir Pantalla / Levantar la Mano */}
              {rol === "docente" ? (
                <button
                  onClick={handleToggleScreenShare}
                  className={`relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                    streamPantallaRef.current || (pantallaCompartida && presentadorActual.esTuPantalla && presentadorActual.tipo === "real")
                      ? "bg-rose-600 text-white shadow-rose-600/30 border border-rose-500"
                      : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                  }`}
                  title="Compartir pantalla"
                >
                  <Monitor size={18} />
                  {(streamPantallaRef.current || (pantallaCompartida && presentadorActual.esTuPantalla && presentadorActual.tipo === "real")) && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border-2 border-white animate-pulse" />
                  )}
                </button>
              ) : (
                <button
                  onClick={handleLevantarMano}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                    manoLevantada
                      ? "bg-amber-500 text-white shadow-amber-500/30 animate-pulse"
                      : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                  }`}
                  title={manoLevantada ? "Bajar mano" : "Levantar la mano"}
                >
                  <Hand size={18} />
                </button>
              )}

              {/* 4. Chat con contador */}
              <button
                onClick={() => {
                  setPestanaMovil("chat");
                  setMensajesNoLeidos(0);
                }}
                className={`relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                  pestanaMovil === "chat"
                    ? "bg-emerald-600 text-white shadow-emerald-600/30"
                    : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                }`}
                title="Abrir Chat en Vivo"
              >
                <MessageSquare size={18} />
                {mensajesNoLeidos > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-mono text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-black animate-pulse shadow-xs">
                    {mensajesNoLeidos}
                  </span>
                )}
              </button>

              {/* Botón ••• Más (reacciones, ajustes de cámara, ficha IA) */}
              <div className="relative">
                <button
                  onClick={() => setMostrarMenuMasMovil(!mostrarMenuMasMovil)}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                    mostrarMenuMasMovil
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200"
                  }`}
                  title="Más opciones"
                >
                  <MoreHorizontal size={18} />
                </button>

                {mostrarMenuMasMovil && (
                  <div className="absolute bottom-14 right-0 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl p-3 shadow-2xl z-50 w-64 space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                      <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Opciones Adicionales</span>
                      <button
                        onClick={() => setMostrarMenuMasMovil(false)}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Reacciones */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500">Enviar Reacción:</span>
                      <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                        {["👏", "👍", "💡", "❤️", "🚀"].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              lanzarReaccion(emoji);
                              setMostrarMenuMasMovil(false);
                            }}
                            className="text-xl p-1 hover:scale-125 transition-transform cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Ajustes de cámara */}
                    <button
                      onClick={() => {
                        setMostrarConfigCam(true);
                        setMostrarMenuMasMovil(false);
                      }}
                      className="w-full py-2 px-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-between border border-slate-200 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Settings size={14} className="text-slate-500" />
                        <span>Ajustes de Cámara</span>
                      </span>
                      <ChevronRight size={13} className="text-slate-400" />
                    </button>

                    {/* Ficha Técnica IA */}
                    <button
                      onClick={() => {
                        setModalFichaTesis(true);
                        setMostrarMenuMasMovil(false);
                      }}
                      className="w-full py-2 px-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-between border border-indigo-200 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Award size={14} className="text-indigo-600" />
                        <span>Ficha Técnica IA (Tesis)</span>
                      </span>
                      <ChevronRight size={13} className="text-indigo-400" />
                    </button>
                  </div>
                )}
              </div>

              {/* 5. Botón Rojo: Colgar / Salir */}
              <button
                onClick={handleAbandonarSala}
                className="w-11 h-11 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-md shadow-rose-600/20 transition-all cursor-pointer active:scale-95"
                title="Salir del aula"
              >
                <PhoneOff size={18} />
              </button>
            </div>

            {/* CONTROLES EN ESCRITORIO (hidden md:flex) - COMPLETO Y ESPACIOSO */}
            <div className="hidden md:flex items-center justify-between w-full">
            
            {/* Lado izquierdo: Info de Participante y Nivel de Micrófono */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-800 font-mono">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold">{usuario?.nombre || "Participante"}</span>
                <span className="text-slate-500 font-normal">
                  ({rol === "docente" ? "Docente" : "Estudiante"})
                </span>
              </div>
            </div>

            {/* Controles Centrales de Reunión Web Sincrónica */}
            <div className="flex items-center gap-2 sm:gap-3 mx-auto">
              
              {/* Micrófono Toggle */}
              <button
                onClick={() => setMicActivo(!micActivo)}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                  micActivo
                    ? "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 hover:text-slate-900"
                    : "bg-rose-600 text-white shadow-rose-600/30 hover:bg-rose-700"
                }`}
                title={micActivo ? "Silenciar micrófono" : "Activar micrófono"}
              >
                {micActivo ? <Mic size={18} /> : <MicOff size={18} />}
              </button>

              {/* Cámara Toggle con acceso a opciones */}
              <div className="relative flex items-center">
                <button
                  onClick={handleToggleCamara}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                    camaraActiva
                      ? "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 hover:text-slate-900"
                      : "bg-rose-600 text-white shadow-rose-600/30 hover:bg-rose-700"
                  }`}
                  title={camaraActiva ? "Apagar cámara" : "Encender cámara"}
                >
                  {camaraActiva ? <Video size={18} /> : <VideoOff size={18} />}
                </button>

                {/* Botón de configuración de cámara */}
                <button
                  onClick={() => setMostrarConfigCam(!mostrarConfigCam)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-300 flex items-center justify-center cursor-pointer shadow-xs"
                  title="Configuración de cámara"
                >
                  <Settings size={10} />
                </button>

                {/* Dropdown de opciones de cámara */}
                {mostrarConfigCam && (
                  <div className="absolute bottom-14 left-0 bg-white border border-slate-200 rounded-2xl p-3 shadow-2xl z-50 w-64 space-y-2.5 text-xs text-slate-800">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-1.5">
                      <span className="font-bold text-slate-900 text-[11px] uppercase tracking-wider">Ajustes de Cámara</span>
                      <button
                        onClick={() => setMostrarConfigCam(false)}
                        className="text-slate-400 hover:text-slate-900"
                      >
                        <X size={13} />
                      </button>
                    </div>

                    {/* Selector de dispositivo si hay múltiples cámaras */}
                    {dispositivosVideo.length > 1 && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-semibold">Dispositivo de Video:</label>
                        <select
                          value={dispositivoSeleccionado}
                          onChange={(e) => {
                            setDispositivoSeleccionado(e.target.value);
                            iniciarCamara(e.target.value);
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-[11px] text-slate-900"
                        >
                          {dispositivosVideo.map((d, idx) => (
                            <option key={d.deviceId || idx} value={d.deviceId}>
                              {d.label || `Cámara ${idx + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Toggle de HUD Biométrico */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-700">Malla Biometría Facial:</span>
                      <button
                        onClick={() => setMostrarHUD(!mostrarHUD)}
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] cursor-pointer ${
                          mostrarHUD
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {mostrarHUD ? "Activada" : "Desactivada"}
                      </button>
                    </div>

                    {/* Botón para forzar reconexión de hardware */}
                    <button
                      onClick={() => {
                        iniciarCamara();
                        setMostrarConfigCam(false);
                      }}
                      className="w-full mt-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-indigo-700 font-bold text-[11px] flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer"
                    >
                      <RefreshCw size={11} />
                      <span>Reconectar Webcam</span>
                    </button>

                    {/* Latencia y Ficha Técnica de IA */}
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Latencia IA en vivo:</span>
                        <span className="font-mono font-bold text-emerald-700">{latenciaMs} ms</span>
                      </div>
                      <button
                        onClick={() => {
                          setModalFichaTesis(true);
                          setMostrarConfigCam(false);
                        }}
                        className="w-full py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center gap-1.5 border border-indigo-200 cursor-pointer"
                      >
                        <Award size={11} />
                        <span>Ficha Técnica y Matriz (Tesis)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Botón Ficha Técnica IA para Sustentación de Tesis */}
              <button
                onClick={() => setModalFichaTesis(true)}
                className="h-11 px-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                title="Ficha Técnica y Matriz de Confusión del Modelo IA para Tesis"
              >
                <Award size={16} />
                <span className="hidden md:inline">Ficha IA (Tesis)</span>
              </button>

              {/* Compartir Pantalla Dinámico (Docente y Estudiantes) */}
              <button
                onClick={handleToggleScreenShare}
                className={`relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                  streamPantallaRef.current || (pantallaCompartida && presentadorActual.esTuPantalla && presentadorActual.tipo === "real")
                    ? "bg-rose-600 text-white shadow-rose-600/30 border border-rose-500"
                    : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 hover:text-slate-900"
                }`}
                title={
                  streamPantallaRef.current || (pantallaCompartida && presentadorActual.esTuPantalla && presentadorActual.tipo === "real")
                    ? "Estás transmitiendo tu pantalla (Clic para detener)"
                    : rol === "docente"
                    ? "Compartir pantalla de PC, ventana o simulador del docente"
                    : "Compartir pantalla o simulador de ingeniería"
                }
              >
                <Monitor size={18} />
                {(streamPantallaRef.current || (pantallaCompartida && presentadorActual.esTuPantalla && presentadorActual.tipo === "real")) && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-white animate-pulse" />
                )}
              </button>

              {/* Levantar la mano */}
              <button
                onClick={handleLevantarMano}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                  manoLevantada
                    ? "bg-amber-500 text-white shadow-amber-500/30 animate-pulse"
                    : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 hover:text-slate-900"
                }`}
                title={manoLevantada ? "Bajar mano" : "Levantar la mano"}
              >
                <Hand size={18} />
              </button>

              {/* Reacciones */}
              <div className="relative">
                <button
                  onClick={() => setMostrarReacciones(!mostrarReacciones)}
                  className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer shadow-xs"
                  title="Reaccionar con emoji"
                >
                  <Smile size={18} />
                </button>

                {mostrarReacciones && (
                  <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-2xl p-2 flex items-center gap-2 shadow-2xl z-50">
                    {["👏", "👍", "💡", "❤️", "🚀"].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => lanzarReaccion(emoji)}
                        className="text-xl p-1.5 hover:scale-125 transition-transform cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Botón Rojo: Abandonar Reunión */}
              <button
                onClick={handleAbandonarSala}
                className="h-11 px-4 sm:px-5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-rose-600/20 transition-all cursor-pointer active:scale-95"
                title="Abandonar reunión"
              >
                <PhoneOff size={16} />
                <span className="hidden sm:inline">Salir</span>
              </button>

            </div>

            {/* Lado Derecho: Toggle de Paneles Laterales */}
            <div className="flex items-center gap-2">
              {/* Botón Chat en Vivo */}
              <button
                onClick={() => {
                  setPanelLateral(panelLateral === "chat-vivo" ? null : "chat-vivo");
                  if (panelLateral !== "chat-vivo") setMensajesNoLeidos(0);
                }}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs relative ${
                  panelLateral === "chat-vivo"
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                    : "bg-slate-100 text-slate-700 border border-slate-200 hover:text-slate-900 hover:bg-slate-200"
                }`}
                title="Chat en Vivo con la Clase"
              >
                <MessageSquare size={16} className={panelLateral === "chat-vivo" ? "text-white" : "text-emerald-600"} />
                <span className="hidden xl:inline">Chat en Vivo</span>
                {mensajesNoLeidos > 0 && panelLateral !== "chat-vivo" && (
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-mono text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-black animate-pulse shadow-xs">
                    {mensajesNoLeidos}
                  </span>
                )}
              </button>

              <button
                onClick={() => setPanelLateral(panelLateral === "chat-gemini" ? null : "chat-gemini")}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                  panelLateral === "chat-gemini"
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                    : "bg-slate-100 text-slate-700 border border-slate-200 hover:text-slate-900 hover:bg-slate-200"
                }`}
                title="Asesor Académico IA"
              >
                <GraduationCap size={16} className={panelLateral === "chat-gemini" ? "text-white" : "text-emerald-600"} />
                <span className="hidden xl:inline">Asesor IA</span>
              </button>

              <button
                onClick={() => setPanelLateral(panelLateral === "participantes" ? null : "participantes")}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                  panelLateral === "participantes"
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                    : "bg-slate-100 text-slate-700 border border-slate-200 hover:text-slate-900 hover:bg-slate-200"
                }`}
                title="Ver lista de participantes"
              >
                <Users size={16} />
                <span className="hidden xl:inline">{listaEstudiantesActivos.length + 1}</span>
              </button>
            </div>

            </div>

          </div>

        </div>

        {/* PANEL LATERAL DERECHO DESPLEGABLE (CHAT EN VIVO / ASESOR IA / PARTICIPANTES) */}
        {panelLateral && (
          <aside className="fixed inset-0 z-50 md:static md:w-80 lg:w-96 bg-white border-l border-slate-200 flex flex-col h-full shadow-2xl shrink-0 animate-in slide-in-from-bottom md:slide-in-from-right duration-200 pt-[env(safe-area-inset-top)] md:pt-0">
            
            {/* Header del Panel Lateral con selector de pestaña */}
            <div className="h-14 md:h-12 border-b border-slate-200 px-3 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => {
                    setPanelLateral("chat-vivo");
                    setMensajesNoLeidos(0);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    panelLateral === "chat-vivo"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <MessageSquare size={13} />
                  <span>Chat en Vivo</span>
                  {mensajesNoLeidos > 0 && panelLateral !== "chat-vivo" && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  )}
                </button>

                <button
                  onClick={() => setPanelLateral("chat-gemini")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    panelLateral === "chat-gemini"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <GraduationCap size={13} />
                  <span>Asesor IA</span>
                </button>

                <button
                  onClick={() => setPanelLateral("participantes")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    panelLateral === "participantes"
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Users size={13} />
                  <span>({listaEstudiantesActivos.length + 1})</span>
                </button>
              </div>

              <button
                onClick={() => setPanelLateral(null)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                title="Cerrar panel"
              >
                <X size={16} />
                <span className="md:hidden">Cerrar</span>
              </button>
            </div>

            {/* Contenido según panel activo */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {panelLateral === "chat-vivo" && (
                <ChatEnVivo
                  aulaId={aulaId}
                  usuario={usuario}
                  rol={rol}
                  wsRef={wsRef}
                  mensajes={mensajesChat}
                  onEnviarMensaje={handleEnviarMensajeChat}
                  temaClase={clase?.nombre || "Modelado BIM & Revit"}
                  onCerrar={() => setPanelLateral(null)}
                />
              )}

              {panelLateral === "chat-gemini" && (
                <ChatAgent
                  rol={rol}
                  temaClase={clase?.nombre || "Modelado BIM & Revit"}
                  usuario={usuario?.correo || usuario?.nombre || "participante@ingeeduca.pe"}
                />
              )}

              {panelLateral === "participantes" && (
                <div className="p-4 space-y-4 overflow-y-auto h-full text-xs">
                  {/* Docente Titular */}
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
                    <div className="text-[10px] font-bold uppercase text-emerald-800 tracking-wider">
                      Moderador & Docente
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shadow-xs border border-emerald-500">
                          {nombreDocente ? nombreDocente.substring(0, 2).toUpperCase() : "VH"}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{nombreDocente}</div>
                          <div className="text-[10px] text-slate-500 font-mono">Docente Titular</div>
                        </div>
                      </div>
                      <span className="badge-pill bg-white text-emerald-700 border border-emerald-200 text-[10px] shadow-xs">
                        Cámara HD
                      </span>
                    </div>
                  </div>

                  {/* Lista de Alumnos */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider px-1">
                      Alumnos Sincronizados ({listaEstudiantesActivos.length})
                    </div>

                    {listaEstudiantesActivos.length === 0 ? (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center text-slate-400 text-xs font-medium">
                        Sin otros compañeros conectados en sala aún
                      </div>
                    ) : (
                      listaEstudiantesActivos.map((est, i) => (
                        <div
                          key={est.id || i}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-white text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold text-xs shadow-xs">
                              {est.nombre ? est.nombre.substring(0, 2).toUpperCase() : "ES"}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 truncate max-w-[130px]">{est.nombre || "Estudiante"}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{est.softwareActivo || "Revit 2026"}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {(() => {
                              const st = obtenerDatosEstado(est.emocion);
                              return (
                                <div className="flex items-center gap-1.5">
                                  <span className={`badge-pill text-[10px] font-bold border ${st.badge}`}>
                                    {st.emoji} {st.nombre}
                                  </span>
                                  <span className="badge-pill bg-white text-slate-700 border border-slate-200 text-[10px] font-mono shadow-2xs">
                                    {est.atencion}%
                                  </span>
                                </div>
                              );
                            })()}

                            {rol === "docente" && (
                              <button
                                onClick={() => cederPantallaAEstudiante(est)}
                                className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                                title={`Ceder pantalla a ${est.nombre}`}
                              >
                                <Share2 size={11} />
                                <span className="hidden sm:inline">Ceder</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

          </aside>
        )}

      </div>

      {/* MODAL COLABORATIVO: COMPARTIR PANTALLA (DOCENTE Y ESTUDIANTES) */}
      {modalCompartir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 w-full max-w-xl shadow-2xl space-y-5 text-slate-800">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
                  <Monitor size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Compartir Pantalla • Sala Sincrónica
                  </h3>
                  <p className="text-xs text-slate-500">
                    {rol === "docente"
                      ? "Comparte tu pantalla o cede la transmisión a un estudiante colaborador"
                      : "Presenta tu pantalla o proyecto con el docente y compañeros"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setModalCompartir(false)}
                className="text-slate-400 hover:text-slate-900 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Aviso si ya hay una pantalla transmitiéndose */}
            {pantallaCompartida && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-indigo-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                  <span className="text-slate-700">
                    Transmitiendo actualmente: <strong className="text-slate-900">{presentadorActual.nombre}</strong> ({presentadorActual.software})
                  </span>
                </div>
                <button
                  onClick={detenerCompartirPantalla}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] cursor-pointer shadow-xs"
                >
                  Detener
                </button>
              </div>
            )}

            {/* Tabs del Modal */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <button
                onClick={() => setTabModalShare("pantalla")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  tabModalShare === "pantalla"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Laptop size={14} />
                <span>Tu Computadora (WebRTC)</span>
              </button>

              <button
                onClick={() => setTabModalShare("software")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  tabModalShare === "software"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Building2 size={14} />
                <span>Simuladores de Ingeniería</span>
              </button>

              {rol === "docente" && (
                <button
                  onClick={() => setTabModalShare("ceder")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    tabModalShare === "ceder"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Users size={14} />
                  <span>Ceder a Estudiante</span>
                </button>
              )}
            </div>

            {/* Tab 1: Tu Pantalla Completa / Ventana */}
            {tabModalShare === "pantalla" && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                      <Cast size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        {rol === "docente"
                          ? "Transmitir Pantalla del Docente a la Clase"
                          : "Transmitir Pantalla o Ventana de tu PC"}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {rol === "docente"
                          ? "Proyecta diapositivas, Revit, AutoCAD, planos o ventana completa de tu PC"
                          : "Proyecta Revit, S10, AutoCAD, hojas de cálculo o cualquier ventana abierta"}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Al hacer clic en el botón inferior, tu navegador abrirá el selector del sistema donde podrás elegir compartir tu pantalla completa, una ventana de software o una pestaña con audio en alta resolución.
                  </p>

                  <button
                    onClick={iniciarCompartirReal}
                    className="w-full btn-emerald py-3 text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    <Monitor size={16} />
                    <span>
                      {rol === "docente"
                        ? "Compartir mi Pantalla de Docente Ahora"
                        : "Seleccionar Ventana y Compartir Ahora"}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Simuladores y Proyectos de Ingeniería */}
            {tabModalShare === "software" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div
                  onClick={() => iniciarCompartirSoftware("revit")}
                  className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 hover:border-emerald-400 transition-all cursor-pointer space-y-2 group shadow-xs"
                >
                  <div className="flex justify-between items-center">
                    <Building2 size={20} className="text-indigo-600 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      BIM 3D
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs">Autodesk Revit 2026</h4>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Modelo estructural 3D interactivo con zapatas, vigas y recubrimientos E.060.
                  </p>
                  <div className="pt-2 text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <span>Transmitir este modelo</span>
                    <ChevronLeft size={13} className="rotate-180" />
                  </div>
                </div>

                <div
                  onClick={() => iniciarCompartirSoftware("s10")}
                  className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 hover:border-amber-400 transition-all cursor-pointer space-y-2 group shadow-xs"
                >
                  <div className="flex justify-between items-center">
                    <FileSpreadsheet size={20} className="text-amber-600 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Costos
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs">S10 Costos y Presupuestos</h4>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Plantilla de análisis de precios unitarios (APU), rendimientos e insumos CAPECO.
                  </p>
                  <div className="pt-2 text-xs font-bold text-amber-700 flex items-center gap-1">
                    <span>Transmitir este software</span>
                    <ChevronLeft size={13} className="rotate-180" />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Ceder Pantalla a un Estudiante Colaborador (Docente) */}
            {tabModalShare === "ceder" && rol === "docente" && (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  Selecciona a cualquier estudiante conectado para cederle la transmisión de pantalla principal:
                </p>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {listaEstudiantesActivos.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No hay estudiantes conectados en este momento
                    </div>
                  ) : (
                    listaEstudiantesActivos.map((est, i) => (
                      <div
                        key={est.id || i}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-white text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold text-xs shadow-xs">
                            {(est.nombre || "E").substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs">{est.nombre}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {est.softwareActivo || "Autodesk Revit 2026"} • {Math.round(est.atencion || 0)}% Atención
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => cederPantallaAEstudiante(est)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Share2 size={12} />
                          <span>Ceder Pantalla</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                Resolución: 1080p Full HD • 60 FPS
              </span>
              <button
                onClick={() => setModalCompartir(false)}
                className="btn-obsidian text-xs px-4 py-2 cursor-pointer text-slate-700 border-slate-300 hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Video offscreen para decodificación continua de frames para el modelo Teachable Machine */}
      {rol === "estudiante" && (
        <video
          ref={videoHiddenIaRef}
          autoPlay
          muted
          playsInline
          style={{
            position: "fixed",
            top: -10000,
            left: -10000,
            width: 224,
            height: 224,
            opacity: 0,
            pointerEvents: "none"
          }}
        />
      )}

      {/* Micro-Alerta Pedagógica Flotante de Refuerzo para el Estudiante */}
      {rol === "estudiante" && alertaPedagogica && (
        <div className="fixed bottom-20 right-6 z-50 max-w-sm bg-white/95 backdrop-blur-md border-2 border-amber-400 rounded-3xl p-4 shadow-2xl shadow-amber-500/20 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Sparkles size={18} />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-xs font-black text-slate-900">{alertaPedagogica.titulo}</h4>
              <p className="text-[11px] text-slate-600 leading-snug">{alertaPedagogica.mensaje}</p>
              <p className="text-[10px] text-amber-800 font-medium italic">{alertaPedagogica.sugerencia}</p>
              <div className="flex items-center gap-2 pt-1.5">
                <button
                  onClick={() => {
                    setPanelLateral("chat-gemini");
                    setAlertaPedagogica(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer transition-all shadow-xs"
                >
                  Consultar al Tutor IA
                </button>
                <button
                  onClick={() => setAlertaPedagogica(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer transition-all"
                >
                  Volver a enfocarme
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Flotante de Intervención Pedagógica en Tiempo Real (Docente -> Estudiante) */}
      {rol === "estudiante" && intervencionPedagogica && mostrarModalIntervencion && (
        <div className="fixed bottom-6 right-6 z-[9999] max-w-md w-full bg-slate-900/98 backdrop-blur-md border-2 border-emerald-500/60 rounded-3xl p-5 sm:p-6 shadow-2xl shadow-black/90 text-white animate-in slide-in-from-bottom-5 duration-300 pointer-events-auto">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center font-bold shrink-0">
                <Sparkles size={18} />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                  <span>{intervencionPedagogica.titulo || "💡 Asesor Pedagógico IA • Pausa Activa"}</span>
                </h4>
                <p className="text-[11px] text-emerald-400 font-medium">
                  Acompañamiento docente en vivo • INGEEDUCA
                </p>
              </div>
            </div>
            <button
              onClick={() => handleCompletarIntervencion("cerrado_rapido")}
              className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Cerrar y continuar"
            >
              <X size={16} />
            </button>
          </div>

          <div className="mt-4 space-y-3.5 text-xs">
            <p className="text-slate-200 leading-relaxed font-medium">
              {intervencionPedagogica.mensaje || "Modelar estructuras y metrar partidas requiere alta concentración visual. Aplica la regla 20-20-20: aparta la mirada de los planos por 15 segundos."}
            </p>

            {/* CASO 1: MOTIVO FATIGA (DESCANSO VISUAL GUIADO) */}
            {intervencionPedagogica.motivo === "fatiga" && (
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
                    <Eye size={15} />
                    Descanso Visual Guiado (Regla 20-20-20)
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono font-bold text-[11px]">
                    {tiempoDescansoVisual > 0 ? `${tiempoDescansoVisual}s` : "¡Completado!"}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Aparta la vista de la pantalla y enfoca un objeto a 6 metros durante 15 segundos para aliviar la tensión ocular y muscular de planos.
                </p>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-1000 shadow-xs"
                    style={{ width: `${Math.max(0, 100 - (tiempoDescansoVisual / 15) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 italic">
                  Tip de Obra: Relaja los hombros, respira profundo y parpadea un par de veces lentamente.
                </p>
              </div>
            )}

            {/* CASO 2: MOTIVO DISTRACCIÓN O PREGUNTA RÁPIDA (MICRO-DESAFÍO TÉCNICO INGEEDUCA) */}
            {(intervencionPedagogica.motivo === "distraccion" || intervencionPedagogica.pregunta_rapida) && (
              <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 space-y-2.5">
                <div className="flex items-center gap-1.5 text-indigo-300 font-bold text-xs">
                  <HelpCircle size={15} />
                  <span>Micro-Desafío Técnico INGEEDUCA:</span>
                </div>
                <p className="text-slate-100 font-bold text-[12px] leading-snug">
                  {intervencionPedagogica.pregunta_rapida?.enunciado || "¿Cuál es el recubrimiento libre mínimo para vigas y columnas peraltadas no expuestas a la intemperie?"}
                </p>
                <div className="space-y-1.5 pt-1">
                  {(intervencionPedagogica.pregunta_rapida?.opciones || [
                    "4.0 cm",
                    "2.5 cm",
                    "7.5 cm"
                  ]).map((opc, idx) => {
                    const seleccionada = opcionPreguntaSeleccionada === idx;
                    const correcta = idx === (intervencionPedagogica.pregunta_rapida?.correcta ?? 0);
                    return (
                      <button
                        key={idx}
                        onClick={() => setOpcionPreguntaSeleccionada(idx)}
                        className={`w-full text-left p-2.5 rounded-xl border text-[11px] transition-all cursor-pointer flex items-center justify-between ${
                          seleccionada
                            ? correcta
                              ? "bg-emerald-600/35 border-emerald-400 text-emerald-200 font-bold"
                              : "bg-indigo-600/35 border-indigo-400 text-white font-medium"
                            : "bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300 hover:border-indigo-400/50"
                        }`}
                      >
                        <span>{opc}</span>
                        {seleccionada && <CheckCircle2 size={14} className="text-emerald-400 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
                {opcionPreguntaSeleccionada !== null && (
                  <p className="text-[10px] text-emerald-300 font-medium pt-1">
                    ✓ Respuesta registrada para tu récord académico con IA.
                  </p>
                )}
              </div>
            )}

            {/* CASO 3: REFUERZO CONCEPTUAL (NORMATIVA E.030 Y CONSTRUCCIÓN CIVIL) */}
            {intervencionPedagogica.motivo === "refuerzo" && !intervencionPedagogica.pregunta_rapida && (
              <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 space-y-1.5">
                <span className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
                  <Sparkles size={14} />
                  Resumen Normativo E.030 / E.060
                </span>
                <p className="text-[11px] text-slate-300 leading-snug">
                  Diseño sismorresistente: El cortante basal V = (Z·U·C·S / R)·P considera el factor de zona Z (0.45 en Zona 4 / Costa central), factor de suelo S y amplificación sísmica C aplicable al proyecto en pantalla.
                </p>
              </div>
            )}

            {/* BOTÓN DE CIERRE Y CONFIRMACIÓN */}
            <div className="pt-2">
              <button
                onClick={() => handleCompletarIntervencion()}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/50 transition-all cursor-pointer active:scale-98"
              >
                <CheckCircle2 size={16} />
                <span>Continuar con la sesión de clase</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ficha Técnica y Matriz de Confusión para Sustentación de Tesis */}
      <FichaTecnicaModal
        isOpen={modalFichaTesis}
        onClose={() => setModalFichaTesis(false)}
      />

    </div>
  );
}
