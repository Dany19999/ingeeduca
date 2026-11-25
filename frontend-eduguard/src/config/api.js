/**
 * Configuración centralizada de API y WebSockets para INGEEDUCA
 * Se conecta a Render en producción (https://ingeeduca.onrender.com y wss://ingeeduca.onrender.com)
 * o al entorno local configurado mediante VITE_API_URL / localhost.
 */

export const API_URL =
  import.meta.env.VITE_API_URL || "https://ingeeduca.onrender.com";

export const WS_URL =
  import.meta.env.VITE_WS_URL ||
  (API_URL.startsWith("https://")
    ? API_URL.replace("https://", "wss://")
    : API_URL.replace("http://", "ws://"));

export const getWsAulaUrl = (aulaId = "AULA-101") => {
  const idLimpio = String(aulaId).trim();
  return `${WS_URL}/ws/aula/${idLimpio}`;
};

export const getWsAlertasUrl = (aulaId = "AULA-101") => {
  const idLimpio = String(aulaId).trim();
  return `${WS_URL}/ws/alertas/${idLimpio}`;
};
