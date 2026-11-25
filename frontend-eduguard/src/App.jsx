import React, { useState, useEffect } from "react";
import Login from "./Login.jsx";
import DashboardDocente from "./pages/DashboardDocente.jsx";
import DashboardEstudiante from "./pages/DashboardEstudiante.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { API_URL } from "./config/api.js";

export default function App() {
  const [usuarioActivo, setUsuarioActivo] = useState(() => {
    try {
      const stored = localStorage.getItem("usuario");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("No se pudo cargar sesión previa:", e);
    }
    return null;
  });

  // Estado compartido global de Clases en Vivo (Persistido en PostgreSQL)
  const [clasesActivas, setClasesActivas] = useState([]);

  // Telemetría en tiempo real de los estudiantes conectados (Persistido en PostgreSQL)
  const [estudiantesConectados, setEstudiantesConectados] = useState([]);

  // Cargar clases y telemetría de estudiantes desde la base de datos PostgreSQL (con polling continuo)
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [resClases, resEstudiantes] = await Promise.all([
          fetch(`${API_URL}/api/clases`),
          fetch(`${API_URL}/api/estudiantes/conectados`)
        ]);
        if (resClases.ok) {
          const dataClases = await resClases.json();
          setClasesActivas(Array.isArray(dataClases) ? dataClases : []);
        }
        if (resEstudiantes.ok) {
          const dataEst = await resEstudiantes.json();
          setEstudiantesConectados(Array.isArray(dataEst) ? dataEst : []);
        }
      } catch (err) {
        console.warn("Conexión con PostgreSQL en espera:", err);
      }
    };

    cargarDatos();
    const intervaloPolling = setInterval(cargarDatos, 3000);
    return () => clearInterval(intervaloPolling);
  }, []);

  // Manejar creación de nueva clase por el Docente (Persistida en PostgreSQL)
  const handleCrearClase = async (nuevaClase) => {
    try {
      const res = await fetch(`${API_URL}/api/clases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nuevaClase.nombre,
          software: nuevaClase.software,
          docente: nuevaClase.docente || usuarioActivo?.nombre || "Docente Titular",
          docente_id: usuarioActivo?.id || null
        })
      });
      if (res.ok) {
        const guardada = await res.json();
        setClasesActivas((prev) => [guardada, ...prev]);
        return;
      }
    } catch (err) {
      console.warn("Error persistiendo clase en PostgreSQL:", err);
    }
    setClasesActivas((prev) => [nuevaClase, ...prev]);
  };

  // Manejar unión de estudiante a clase
  const handleUnirseClase = async (clase) => {
    if (!usuarioActivo) return;

    const aulaId = clase?.id ? (String(clase.id).startsWith("aula-") ? clase.id : `aula-${clase.id}`) : "aula-1";

    // Notificar presencia al backend inmediatamente
    try {
      await fetch(`${API_URL}/api/salas/${aulaId}/presencia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: usuarioActivo.id,
          nombre: usuarioActivo.nombre,
          correo: usuarioActivo.email || usuarioActivo.correo,
          rol: usuarioActivo.rol || "estudiante",
          emocion: "Atento",
          atencion: 96,
          softwareActivo: clase?.software || "Autodesk Revit 2026"
        })
      });
    } catch (e) {
      console.warn("Error notificando presencia al backend:", e);
    }

    // Verificar si ya está en la lista de conectados local
    setEstudiantesConectados((prev) => {
      const existe = prev.some(
        (e) =>
          (usuarioActivo.correo && e.correo === usuarioActivo.correo) ||
          (usuarioActivo.email && e.correo === usuarioActivo.email) ||
          e.nombre === usuarioActivo.nombre
      );
      if (existe) {
        return prev.map((e) =>
          (usuarioActivo.correo && e.correo === usuarioActivo.correo) ||
            (usuarioActivo.email && e.correo === usuarioActivo.email) ||
            e.nombre === usuarioActivo.nombre
            ? { ...e, aulaId: clase.id, emocion: "Atento", atencion: 96 }
            : e
        );
      }
      return [
        {
          id: `est-${usuarioActivo.id || Date.now().toString().slice(-4)}`,
          nombre: usuarioActivo.nombre || "Estudiante",
          correo: usuarioActivo.email || usuarioActivo.correo || "estudiante@ingeeduca.edu.pe",
          aulaId: clase.id,
          atencion: 95,
          emocion: "Atento",
          confianza: 95,
          alertas: 0,
          tiempoConexion: "1m",
          softwareActivo: clase.software
        },
        ...prev
      ];
    });

    // Incrementar conteo en clase activa
    setClasesActivas((prev) =>
      prev.map((c) =>
        c.id === clase.id ? { ...c, asistentes: (c.asistentes || 0) + 1 } : c
      )
    );
  };

  // Manejar telemetría emitida desde el Detector de Visión
  const handleEmitirMetrica = async (metrica) => {
    // 1. Persistir métrica biométrica en la base de datos PostgreSQL eduguard_tesis_db
    try {
      await fetch(`${API_URL}/api/metricas/atencion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estudiante_id: usuarioActivo?.id || null,
          estudiante_email: usuarioActivo?.email || usuarioActivo?.correo || null,
          estudiante_nombre: metrica.estudiante || usuarioActivo?.nombre || null,
          atencion_pct: metrica.atencion,
          emocion: metrica.emocion
        })
      });
    } catch (err) {
      console.warn("No se pudo persistir métrica en PostgreSQL:", err);
    }

    // 2. Actualizar estado reactivo local
    setEstudiantesConectados((prev) =>
      prev.map((e) => {
        if (
          e.nombre === metrica.estudiante ||
          (usuarioActivo?.correo && e.correo === usuarioActivo.correo) ||
          (usuarioActivo?.email && e.correo === usuarioActivo.email)
        ) {
          const esDistraido = (metrica.emocion || "").toUpperCase().includes("DISTRA");
          const esTriste = (metrica.emocion || "").toUpperCase().includes("TRISTE");
          return {
            ...e,
            emocion: metrica.emocion,
            atencion: metrica.atencion,
            confianza: metrica.confianza,
            alertas: esDistraido || esTriste ? (e.alertas || 0) + 1 : (e.alertas || 0)
          };
        }
        return e;
      })
    );
  };

  const handleIntervenirEstudiante = (estudiante) => {
    // Intervención rápida del docente
    console.log("Intervención pedagógica iniciada para:", estudiante.nombre);
  };

  const handleLogout = () => {
    localStorage.clear();
    setUsuarioActivo(null);
  };

  if (!usuarioActivo) {
    return <Login onLoginSuccess={(user) => setUsuarioActivo(user)} />;
  }

  // Vista de Docente
  if (usuarioActivo.rol === "docente") {
    return (
      <ErrorBoundary>
        <DashboardDocente
          usuarioActivo={usuarioActivo}
          onLogout={handleLogout}
          clasesActivas={clasesActivas}
          onCrearClase={handleCrearClase}
          estudiantesConectados={estudiantesConectados}
          onIntervenirEstudiante={handleIntervenirEstudiante}
          onEmitirMetrica={handleEmitirMetrica}
        />
      </ErrorBoundary>
    );
  }

  // Vista de Estudiante
  return (
    <ErrorBoundary>
      <DashboardEstudiante
        usuarioActivo={usuarioActivo}
        onLogout={handleLogout}
        clasesActivas={clasesActivas}
        onUnirseClase={handleUnirseClase}
        estudiantesConectados={estudiantesConectados}
        onEmitirMetrica={handleEmitirMetrica}
      />
    </ErrorBoundary>
  );
}