/// Configuración centralizada de red y conectividad para INGEEDUCA Docente Móvil.
/// Permite alternar y editar dinámicamente el host IP y el switch HTTPS en caliente.
class ApiConfig {
  /// Dirección IPv4 de la PC local (ej. "192.168.1.45:8000" o "192.168.1.100:8000") o servidor nube.
  static String host = "192.168.1.45:8000";

  /// Define si se utiliza protocolo seguro SSL/TLS (HTTPS y WSS).
  static bool useHttps = false;

  /// Retorna la URL base HTTP o HTTPS para las peticiones REST.
  static String get baseUrl {
    final scheme = useHttps ? "https" : "http";
    return "$scheme://$host";
  }

  /// Retorna la URL WebSocket (WS o WSS) para la sala de clase sincrónica especificada.
  static String wsUrlForAula(String aulaId) {
    final scheme = useHttps ? "wss" : "ws";
    return "$scheme://$host/ws/aula/$aulaId";
  }

  /// Retorna la URL WebSocket para el canal exclusivo de alertas en tiempo real.
  static String wsAlertasUrlForAula(String aulaId) {
    final scheme = useHttps ? "wss" : "ws";
    return "$scheme://$host/ws/alertas/$aulaId";
  }
}
