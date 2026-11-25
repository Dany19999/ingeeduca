import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Copy,
  Check,
  User,
  GraduationCap,
  BookOpen,
  CheckCircle2
} from "lucide-react";

// Limpieza de caracteres LaTeX crudos para una visualización técnica limpia y profesional
function sanitizarTextoMatematico(texto) {
  if (!texto) return "";
  let t = texto;
  // Fracciones LaTeX: \frac{A}{B} -> (A / B)
  t = t.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1 / $2)");
  t = t.replace(/\\frac\s*([0-9a-zA-Z]+)\s*([0-9a-zA-Z]+)/g, "($1 / $2)");
  
  // Símbolos griegos de ingeniería estructural
  t = t.replace(/\\phi/g, "φ");
  t = t.replace(/\\rho_?\{?min\}?/g, "ρ_mín");
  t = t.replace(/\\rho/g, "ρ");
  t = t.replace(/\\theta/g, "θ");
  t = t.replace(/\\sigma/g, "σ");
  t = t.replace(/\\Delta/g, "Δ");
  t = t.replace(/\\lambda/g, "λ");
  t = t.replace(/\\alpha/g, "α");
  t = t.replace(/\\beta/g, "β");
  t = t.replace(/\\gamma/g, "γ");
  t = t.replace(/\\omega/g, "ω");

  // Operadores matemáticos y de cálculo
  t = t.replace(/\\cdot/g, " · ");
  t = t.replace(/\\times/g, " × ");
  t = t.replace(/\\ge(q)?/g, "≥");
  t = t.replace(/\\le(q)?/g, "≤");
  t = t.replace(/\\pm/g, "±");
  t = t.replace(/\\approx/g, "≈");
  t = t.replace(/\\neq/g, "≠");

  // Eliminar delimitadores de LaTeX ($ y $$)
  t = t.replace(/\$\$([^$]+)\$\$/g, "$1");
  t = t.replace(/\$([^$]+)\$/g, "$1");
  
  // Normalizar espacios en operadores
  t = t.replace(/\s*·\s*/g, " · ");
  return t;
}

function renderizarTextoEnriquecido(str, esUsuario) {
  const partes = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let ultimoIndice = 0;
  let match;

  while ((match = regex.exec(str)) !== null) {
    if (match.index > ultimoIndice) {
      partes.push(str.substring(ultimoIndice, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      partes.push(
        <strong key={match.index} className={esUsuario ? "font-bold text-white" : "font-bold text-slate-900"}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      partes.push(
        <code key={match.index} className={esUsuario ? "bg-white/20 text-white px-1.5 py-0.5 rounded font-mono text-[11px]" : "bg-slate-100 border border-slate-200 text-emerald-800 px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold"}>
          {token.slice(1, -1)}
        </code>
      );
    }
    ultimoIndice = regex.lastIndex;
  }
  if (ultimoIndice < str.length) {
    partes.push(str.substring(ultimoIndice));
  }
  return partes;
}

function MensajeContenido({ texto, esUsuario, streaming }) {
  const textoLimpio = sanitizarTextoMatematico(texto);
  const lineas = textoLimpio.split("\n");

  return (
    <div className={`space-y-1.5 text-xs sm:text-[13px] leading-relaxed ${esUsuario ? "text-white" : "text-slate-700"}`}>
      {lineas.map((linea, idx) => {
        const trimmed = linea.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Títulos / Secciones
        if (trimmed.startsWith("### ") || trimmed.startsWith("## ")) {
          const titulo = trimmed.replace(/^#+\s*/, "");
          return (
            <h4 key={idx} className={`font-bold mt-2 pt-1 text-xs sm:text-sm ${esUsuario ? "text-white" : "text-slate-900"}`}>
              {titulo}
            </h4>
          );
        }

        // Pasos numerados (1. , 2. )
        const matchNum = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (matchNum) {
          return (
            <div key={idx} className="flex items-start gap-2.5 my-1">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 ${
                esUsuario ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800 border border-emerald-200"
              }`}>
                {matchNum[1]}
              </span>
              <div className="flex-1">
                {renderizarTextoEnriquecido(matchNum[2], esUsuario)}
              </div>
            </div>
          );
        }

        // Viñetas principales (- o • o *)
        const matchBullet = trimmed.match(/^[-•*]\s+(.*)/);
        if (matchBullet) {
          return (
            <div key={idx} className="flex items-start gap-2 ml-1 my-0.5">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                esUsuario ? "bg-white" : "bg-emerald-500"
              }`} />
              <div className="flex-1">
                {renderizarTextoEnriquecido(matchBullet[1], esUsuario)}
              </div>
            </div>
          );
        }

        // Subviñetas anidadas (con sangría)
        if (linea.startsWith("   -") || linea.startsWith("  -") || linea.startsWith("    -")) {
          return (
            <div key={idx} className="flex items-start gap-2 ml-4 my-0.5 text-[12px] opacity-90">
              <span className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${
                esUsuario ? "bg-white/70" : "bg-slate-400"
              }`} />
              <div className="flex-1">
                {renderizarTextoEnriquecido(trimmed.replace(/^[-•*]\s*/, ""), esUsuario)}
              </div>
            </div>
          );
        }

        // Línea estándar
        return (
          <p key={idx} className="leading-relaxed">
            {renderizarTextoEnriquecido(trimmed, esUsuario)}
          </p>
        );
      })}

      {streaming && (
        <span className="inline-block w-2 h-4 ml-1 bg-emerald-500 animate-pulse align-middle" />
      )}
    </div>
  );
}

export default function ChatAgent({
  rol = "estudiante",
  temaClase = "Modelado BIM & Revit",
  usuario = "participante@ingeeduca.pe"
}) {
  const [softwareActivo, setSoftwareActivo] = useState("Autodesk Revit");
  const [mensajes, setMensajes] = useState([
    {
      id: "bienvenida",
      autor: "bot",
      texto: `¡Hola! Te doy la bienvenida a la clase de **${temaClase}**.\n\nSoy tu asesor académico para esta sesión. Si tienes alguna duda con el modelado en Revit, los análisis de precios unitarios en S10 o la aplicación de la norma técnica peruana E.060, escríbeme con total confianza y lo revisamos paso a paso.\n\n¿En qué procedimiento o cálculo te gustaría que nos enfoquemos hoy?`,
      timestamp: "Ahora",
      software: "Autodesk Revit"
    }
  ]);
  const [nuevoTexto, setNuevoTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [copiadoIdx, setCopiadoIdx] = useState(null);
  const finMensajesRef = useRef(null);

  const sugerencias = {
    "Autodesk Revit": [
      "¿Cómo configuro el recubrimiento de 7.5 cm en zapatas según la norma E.060?",
      "¿Cómo coloco armadura longitudinal y estribos en columnas en Revit?",
      "¿Cómo obtengo el cómputo métrico de concreto y acero para exportar a Excel?"
    ],
    "S10 Costos": [
      "¿Cómo calculo el rendimiento diario de cuadrilla según las tablas CAPECO?",
      "¿Cómo estructuro la fórmula polinómica y agrupo los índices unificados del INEI?",
      "¿Cómo se ingresa el porcentaje de herramientas manuales en el APU?"
    ],
    "Normativa RNE": [
      "¿Cuáles son los factores de reducción de resistencia (φ) en la norma E.060?",
      "¿Cuáles son los límites de distorsión sísmica (drift) según la norma E.030?",
      "¿Qué medidas de seguridad exige la norma G.050 para excavaciones profundas?"
    ]
  };

  const scrollToBottom = () => {
    finMensajesRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mensajes, enviando]);

  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
  const MODELO_DIRECTO = "gemini-3-flash-preview";

  // Stream directo a Google Gemini en caso de que el backend local no esté disponible
  const streamGeminiDirecto = async (consulta, software, tema, onChunk) => {
    const systemPrompt = `Eres un ingeniero civil y docente tutor de INGEDUCA en Perú, especializado en software técnico (Autodesk Revit, S10 Costos, Civil 3D, Navisworks) y normativa peruana (RNE: E.060, E.030, G.050, CAPECO).
Tu misión es acompañar al estudiante de manera clara, didáctica, profesional y cercana.
REGLAS CRÍTICAS DE FORMATO Y ESTILO:
1. Explica paso a paso con viñetas o números y nombres exactos de herramientas o parámetros.
2. Cita artículos y criterios oficiales de la normativa peruana (E.060, E.030, G.050, CAPECO).
3. FORMULAS Y SÍMBOLOS MATEMÁTICOS: Escribe SIEMPRE en texto plano o notación Unicode (ejemplo: φ = 0.90, V = (Z · U · C · S / R) · P, f'c = 210 kg/cm², fy = 4200 kg/cm²). PROHIBIDO usar código o comandos LaTeX sin compilar como \\frac, \\phi, \\rho, \\cdot ni encerrar fórmulas entre signos $.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_DIRECTO}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          { parts: [{ text: `Tema de clase: ${tema} (${software})\nConsulta: ${consulta}` }] }
        ],
        generationConfig: { temperature: 0.3, maxOutputTokens: 900 }
      })
    });

    if (!res.ok) throw new Error(`Google API status ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data:")) {
          const jsonStr = trimmed.replace("data:", "").trim();
          if (!jsonStr) continue;
          try {
            const data = JSON.parse(jsonStr);
            const chunk = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (chunk) onChunk(chunk);
          } catch {
            // Ignorar líneas malformadas
          }
        }
      }
    }
  };

  const simularStreamLocal = async (respuestaFallback, onChunk) => {
    const palabras = respuestaFallback.split(" ");
    for (let i = 0; i < palabras.length; i += 3) {
      const bloque = palabras.slice(i, i + 3).join(" ") + (i + 3 < palabras.length ? " " : "");
      onChunk(bloque);
      await new Promise((r) => setTimeout(r, 25));
    }
  };

  const getFallbackRespuesta = (consulta, software) => {
    const tLower = (consulta || "").toLowerCase();
    if (tLower.includes("revit") || tLower.includes("zapata") || tLower.includes("acero") || software.includes("Revit")) {
      return `¡Hola! Con gusto revisamos el procedimiento para modelar armaduras en **Autodesk Revit**:

1. **Configuración de Recubrimiento Normativo**:
   - Selecciona tu elemento estructural (zapata o columna).
   - En la paleta de *Propiedades*, asigna **7.5 cm (75 mm)** para concreto en contacto con el terreno (Norma Técnica **E.060**, Art. 7.7.1).

2. **Colocación de Armadura (\`Rebar\`)**:
   - Ve a la pestaña **Estructura** -> panel **Refuerzo** -> comando **Armadura**.
   - Elige la barra longitudinal o estribo correspondiente según tus especificaciones de cálculo.

3. **Regla de Distribución**:
   - En la barra de opciones superior, selecciona **Espaciado Máximo** (habitual entre 0.15 m y 0.20 m para zapatas típicas).

4. **Visualización 3D Real**:
   - En la vista 3D, ingresa a *Gráficos de visibilidad de elemento*, haz clic en *Editar* y activa **Ver como sólido** y **Ver no tapado**.

¿Deseas que profundicemos en algún detalle del cómputo métrico o el doblado de varillas?`;
    } else if (tLower.includes("s10") || tLower.includes("apu") || tLower.includes("rendimiento") || software.includes("S10")) {
      return `¡Hola! Excelente consulta sobre el análisis de costos en **S10 Costos y Presupuestos**:

1. **Rendimiento Oficial CAPECO**:
   - Para vaciado de concreto en zapatas con cuadrilla oficial (0.2 Capataz + 2 Operarios + 1 Oficial + 6 Peones), el rendimiento estándar para Costa/Lima es de **25 m³/día**.

2. **Aporte Unitario de Mano de Obra**:
   - Registra cada categoría con su costo Hora-Hombre (HH) vigente. El aporte unitario se calcula automáticamente: Cuadrilla ÷ Rendimiento diario.

3. **Materiales y Desperdicios**:
   - Incorpora el Cemento Portland Tipo I (o Tipo MS en zonas con sulfatos), agregados fino/grueso y agua considerando un **5% de desperdicio técnico**.

4. **Equipos y Herramientas Manuales**:
   - Considera la mezcladora trompo (9-11 p³) y el vibrador de 4HP con su costo Hora-Máquina (HM).
   - Para herramientas manuales, asigna entre el **3% y 5% de la Mano de Obra** (%MO).

¡Avísame si deseas que revisemos el cálculo de la fórmula polinómica o el flete!`;
    } else {
      return `¡Hola! Qué importante revisar el criterio técnico del **Reglamento Nacional de Edificaciones (RNE)**:

• **Norma Técnica E.060 (Concreto Armado)**:
  - Fija el recubrimiento mínimo de **7.5 cm** en zapatas y vigas de cimentación vaciadas en contacto directo con el suelo (Art. 7.7.1).
  - Factores de reducción de resistencia: **φ = 0.90** para flexión y **φ = 0.65** para compresión en columnas con estribos.
  - Cuantía mínima a flexión: **ρ_mín = 14 / fy** (con fy = 4200 kg/cm² equivale a 0.0033).

• **Norma Técnica E.030 (Diseño Sismorresistente)**:
  - Cortante basal en la base: **V = (Z · U · C · S / R) · P**
  - En la Costa central (Lima - Zona 4), el factor de aceleración máxima es **Z = 0.45 g**. El coeficiente C/R nunca debe ser menor a 0.11.

• **Norma Técnica G.050 (Seguridad en Construcción)**:
  - En excavaciones mayores a **1.50 m** de profundidad es obligatorio el uso de taludes de reposo o entibados de contención certificados.

Cualquier duda puntual sobre un artículo de la norma, dime y lo analizamos juntos con todo gusto.`;
    }
  };

  const enviarConsulta = async (textoAEnviar) => {
    const consulta = (textoAEnviar || "").trim();
    if (!consulta || enviando) return;

    // Detección contextual automática de especialidad
    const tLower = consulta.toLowerCase();
    let softwareDetectado = softwareActivo;
    if (tLower.includes("revit") || tLower.includes("acero") || tLower.includes("zapata") || tLower.includes("columna") || tLower.includes("bim")) {
      softwareDetectado = "Autodesk Revit";
    } else if (tLower.includes("s10") || tLower.includes("apu") || tLower.includes("presupuesto") || tLower.includes("capeco") || tLower.includes("rendimiento")) {
      softwareDetectado = "S10 Costos";
    } else if (tLower.includes("norma") || tLower.includes("rne") || tLower.includes("e.060") || tLower.includes("e.030") || tLower.includes("g.050")) {
      softwareDetectado = "Normativa RNE";
    }
    setSoftwareActivo(softwareDetectado);

    setNuevoTexto("");
    const timestampActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const botMsgId = "msg-" + Date.now();

    // 1. Mensaje del usuario + placeholder del bot en streaming inmediato
    setMensajes((prev) => [
      ...prev,
      { id: "usr-" + Date.now(), autor: "usuario", texto: consulta, timestamp: timestampActual },
      { id: botMsgId, autor: "bot", texto: "", timestamp: timestampActual, streaming: true, software: softwareDetectado }
    ]);
    setEnviando(true);

    const appendChunk = (chunk) => {
      setMensajes((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? { ...m, texto: m.texto + chunk }
            : m
        )
      );
    };

    let streamCompletado = false;

    // Intento 1: Backend FastAPI con streaming SSE en tiempo real
    try {
      const response = await fetch("http://localhost:8000/api/agente/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensaje: consulta,
          usuario: usuario,
          rol: rol,
          tema_actual: `${temaClase} (Módulo: ${softwareDetectado})`,
          software: softwareDetectado
        })
      });

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data:")) {
              const jsonStr = trimmed.replace("data:", "").trim();
              if (!jsonStr) continue;
              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed.chunk) {
                  appendChunk(parsed.chunk);
                  streamCompletado = true;
                }
              } catch {
                // ignorar json parcial
              }
            }
          }
        }
      }
    } catch (errBackend) {
      console.info("[Asesor Académico]: Backend local en espera, usando canal directo:", errBackend.message);
    }

    // Intento 2: Si el backend no respondió, invocar Google Gemini directo con streaming
    if (!streamCompletado) {
      try {
        await streamGeminiDirecto(consulta, softwareDetectado, temaClase, (chunk) => {
          appendChunk(chunk);
          streamCompletado = true;
        });
      } catch (errDirect) {
        console.warn("[Asesor Académico]: Conexión remota lenta, activando tutoría local guiada:", errDirect.message);
      }
    }

    // Intento 3: Fallback guiado fluido local instantáneo
    if (!streamCompletado) {
      const fallbackTexto = getFallbackRespuesta(consulta, softwareDetectado);
      await simularStreamLocal(fallbackTexto, (chunk) => {
        appendChunk(chunk);
      });
    }

    // Finalizar estado de streaming
    setMensajes((prev) =>
      prev.map((m) =>
        m.id === botMsgId
          ? { ...m, streaming: false }
          : m
      )
    );
    setEnviando(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    enviarConsulta(nuevoTexto);
  };

  const handleCopiar = (texto, idx) => {
    navigator.clipboard.writeText(texto);
    setCopiadoIdx(idx);
    setTimeout(() => setCopiadoIdx(null), 2000);
  };

  return (
    <div className="card-obsidian flex flex-col h-full shadow-lg overflow-hidden border border-slate-200 bg-white">
      
      {/* 1. Header Humanizado del Tutor de Aula */}
      <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 font-bold shrink-0">
            <GraduationCap size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                Asesor Académico de Aula
              </h3>
              <span className="badge-pill bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                En línea
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Acompañamiento docente para dudas de clase, Revit, S10 y RNE
            </p>
          </div>
        </div>
      </div>

      {/* 2. Área de Conversación */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/70">
        {mensajes.map((m, idx) => {
          const esUsuario = m.autor === "usuario";

          return (
            <div
              key={m.id || idx}
              className={`flex gap-3 items-start ${esUsuario ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm font-bold text-xs ${
                  esUsuario
                    ? "bg-gradient-to-tr from-cyan-600 to-blue-600 text-white"
                    : "bg-gradient-to-tr from-emerald-600 to-teal-700 text-white shadow-emerald-600/20"
                }`}
              >
                {esUsuario ? <User size={15} /> : <GraduationCap size={15} />}
              </div>

              {/* Burbuja de Mensaje */}
              <div
                className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 shadow-xs text-xs sm:text-sm leading-relaxed ${
                  esUsuario
                    ? "bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-tr-xs shadow-sm"
                    : "bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs hover:border-emerald-400/50 transition-colors"
                }`}
              >
                {/* Meta Header */}
                <div
                  className={`flex items-center justify-between text-[11px] pb-1.5 mb-2 border-b ${
                    esUsuario
                      ? "text-emerald-100 border-white/20"
                      : "text-slate-400 border-slate-100"
                  }`}
                >
                  <span className="font-bold flex items-center gap-1.5">
                    {esUsuario ? "Tú" : "Asesor Académico"}
                  </span>
                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    <span>{m.timestamp}</span>
                    {!esUsuario && m.texto && (
                      <button
                        onClick={() => handleCopiar(m.texto, idx)}
                        title="Copiar texto"
                        className="text-slate-400 hover:text-emerald-600 transition-colors p-0.5"
                      >
                        {copiadoIdx === idx ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Contenido con formato pedagógico y enriquecido */}
                <MensajeContenido
                  texto={m.texto}
                  esUsuario={esUsuario}
                  streaming={m.streaming}
                />

                {/* Metadatos amigables */}
                {!esUsuario && !m.streaming && m.texto && (
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-medium text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      Consulta técnica resuelta
                    </span>
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium border border-slate-200">
                      {m.software || softwareActivo}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {enviando && mensajes[mensajes.length - 1]?.autor === "usuario" && (
          <div className="flex gap-3 items-center animate-in fade-in duration-200">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-700 text-white flex items-center justify-center shrink-0">
              <GraduationCap size={15} />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs flex items-center gap-2 text-xs text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="font-medium">El asesor está redactando la explicación paso a paso...</span>
            </div>
          </div>
        )}

        <div ref={finMensajesRef} />
      </div>

      {/* 3. Chips de Sugerencias Rápidas y Preguntas de Clase */}
      <div className="px-4 py-2.5 bg-white border-t border-slate-200 overflow-x-auto flex items-center gap-2 text-xs">
        <span className="text-[11px] font-bold text-slate-500 shrink-0 flex items-center gap-1">
          <BookOpen size={13} className="text-emerald-600" />
          Preguntas de clase:
        </span>
        {(sugerencias[softwareActivo] || sugerencias["Autodesk Revit"]).map((sug, i) => (
          <button
            key={i}
            onClick={() => enviarConsulta(sug)}
            className="shrink-0 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 font-medium text-[11px] transition-all cursor-pointer truncate max-w-[280px]"
            title={sug}
          >
            {sug}
          </button>
        ))}
      </div>

      {/* 4. Barra de Envío */}
      <form onSubmit={handleSubmit} className="p-3.5 sm:p-4 bg-white border-t border-slate-200 flex items-center gap-3">
        <input
          type="text"
          value={nuevoTexto}
          onChange={(e) => setNuevoTexto(e.target.value)}
          placeholder={`Escribe tu consulta sobre ${softwareActivo}, cálculo APU o normas RNE...`}
          className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
        />

        <button
          type="submit"
          disabled={!nuevoTexto.trim() || enviando}
          className="btn-emerald py-2.5 px-4 text-xs font-bold shrink-0 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          <span>Preguntar</span>
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}