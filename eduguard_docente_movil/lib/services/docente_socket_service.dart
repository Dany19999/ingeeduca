import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:web_socket_channel/web_socket_channel.dart';
import '../config/api_config.dart';
import '../models/telemetria_models.dart';

/// Servicio de red integral: Maneja REST inicial y conexión WebSocket bidireccional con reconexión continua.
class DocenteSocketService {
  final String aulaId;
  final void Function(bool conectado) onConnectionStatusChanged;
  final void Function(List<EstudianteConectado> participantes, int atencionGrupal) onParticipantesUpdated;
  final void Function(AlertaIncidente alerta) onAlertaRecibida;
  final void Function(String estudiante, bool completada) onIntervencionStatus;

  WebSocketChannel? _channelAula;
  WebSocketChannel? _channelAlertas;
  StreamSubscription? _subAula;
  StreamSubscription? _subAlertas;
  Timer? _reconnectTimer;
  Timer? _pingTimer;
  bool _isDisposed = false;
  bool _isConnected = false;

  DocenteSocketService({
    required this.aulaId,
    required this.onConnectionStatusChanged,
    required this.onParticipantesUpdated,
    required this.onAlertaRecibida,
    required this.onIntervencionStatus,
  });

  bool get isConnected => _isConnected;

  /// Inicia la sincronización REST y activa los canales WebSocket en vivo.
  Future<void> connect() async {
    _isDisposed = false;
    _setConnectionStatus(false);
    
    // 1. Cargar estado inicial vía REST desde PostgreSQL / FastAPI
    await syncEstadoInicialRest();

    // 2. Conectar WebSockets persistentes
    _conectarWebSockets();
  }

  void _setConnectionStatus(bool connected) {
    if (_isConnected != connected) {
      _isConnected = connected;
      onConnectionStatusChanged(_isConnected);
    }
  }

  /// Consulta el endpoint REST del backend para cargar estado de sala y alertas activas.
  Future<void> syncEstadoInicialRest() async {
    try {
      final base = ApiConfig.baseUrl;

      // a) Estado de la sala
      final respSala = await http.get(Uri.parse('$base/api/salas/$aulaId/estado')).timeout(const Duration(seconds: 4));
      if (respSala.statusCode == 200) {
        final data = jsonDecode(respSala.body);
        if (data is Map<String, dynamic> && data['participantes'] != null) {
          final listRaw = data['participantes'] as List;
          final ests = listRaw.map((e) => EstudianteConectado.fromJson(Map<String, dynamic>.from(e))).toList();
          final atencionMedia = _calcularAtencionPromedio(ests);
          onParticipantesUpdated(ests, atencionMedia);
        }
      }

      // b) Alertas activas de PostgreSQL
      final respAlertas = await http.get(Uri.parse('$base/api/aulas/$aulaId/alertas')).timeout(const Duration(seconds: 4));
      if (respAlertas.statusCode == 200) {
        final dataAlertas = jsonDecode(respAlertas.body);
        if (dataAlertas is List) {
          for (final a in dataAlertas) {
            final alertaObj = AlertaIncidente.fromJson(Map<String, dynamic>.from(a));
            onAlertaRecibida(alertaObj);
          }
        }
      }
    } catch (_) {
      // Si falla la red temporalmente se continuará intentando vía WebSocket
    }
  }

  void _conectarWebSockets() {
    if (_isDisposed) return;

    try {
      _subAula?.cancel();
      _subAlertas?.cancel();
      _channelAula?.sink.close();
      _channelAlertas?.sink.close();

      final wsAulaUrl = ApiConfig.wsUrlForAula(aulaId);
      final wsAlertasUrl = ApiConfig.wsAlertasUrlForAula(aulaId);

      _channelAula = WebSocketChannel.connect(Uri.parse(wsAulaUrl));
      _channelAlertas = WebSocketChannel.connect(Uri.parse(wsAlertasUrl));

      _subAula = _channelAula!.stream.listen(
        _onMessageAula,
        onDone: () => _handleDisconnect('Aula WS Done'),
        onError: (err) => _handleDisconnect('Aula WS Error: $err'),
      );

      _subAlertas = _channelAlertas!.stream.listen(
        _onMessageAlertas,
        onDone: () => _handleDisconnect('Alertas WS Done'),
        onError: (err) => _handleDisconnect('Alertas WS Error: $err'),
      );

      // Enviar evento de join/presencia como docente
      final joinPayload = {
        'tipo': 'join',
        'user': {
          'id': 'docente_movil_01',
          'nombre': 'Docente Titular (Móvil)',
          'rol': 'docente',
          'aulaId': aulaId,
        }
      };
      _channelAula?.sink.add(jsonEncode(joinPayload));

      _setConnectionStatus(true);
      _iniciarPingPeriodico();
    } catch (e) {
      _handleDisconnect('Connection Exception: $e');
    }
  }

  void _onMessageAula(dynamic message) {
    try {
      final raw = jsonDecode(message.toString());
      if (raw is! Map<String, dynamic>) return;
      _setConnectionStatus(true);

      final tipo = raw['tipo'];

      if (tipo == 'estado_inicial') {
        final estado = raw['estado'];
        if (estado is Map<String, dynamic> && estado['participantes'] != null) {
          final listRaw = estado['participantes'] as List;
          final ests = listRaw.map((e) => EstudianteConectado.fromJson(Map<String, dynamic>.from(e))).toList();
          onParticipantesUpdated(ests, _calcularAtencionPromedio(ests));
        }
      } else if (tipo == 'presencia_actualizada') {
        final parts = raw['participantes'];
        if (parts != null) {
          List<EstudianteConectado> ests = [];
          if (parts is List) {
            ests = parts.map((e) => EstudianteConectado.fromJson(Map<String, dynamic>.from(e))).toList();
          } else if (parts is Map) {
            ests = parts.values.map((e) => EstudianteConectado.fromJson(Map<String, dynamic>.from(e))).toList();
          }
          // Filtrar para mostrar solo alumnos en la lista de monitoreo
          final alumnos = ests.where((p) => (p.correo.isNotEmpty || p.nombre != 'Docente Titular (Móvil)')).toList();
          onParticipantesUpdated(alumnos, _calcularAtencionPromedio(alumnos));
        }
      } else if (tipo == 'alerta_incidente') {
        final alertaData = raw['alerta'];
        if (alertaData is Map<String, dynamic>) {
          onAlertaRecibida(AlertaIncidente.fromJson(alertaData));
        }
      } else if (tipo == 'INTERVENCION_DOCENTE') {
        final est = raw['estudiante']?.toString() ?? '';
        if (est.isNotEmpty) {
          onIntervencionStatus(est, false);
        }
      } else if (tipo == 'INTERVENCION_COMPLETADA') {
        final est = raw['estudiante']?.toString() ?? '';
        if (est.isNotEmpty) {
          onIntervencionStatus(est, true);
        }
      }
    } catch (_) {}
  }

  void _onMessageAlertas(dynamic message) {
    try {
      final raw = jsonDecode(message.toString());
      if (raw is! Map<String, dynamic>) return;
      _setConnectionStatus(true);

      final tipo = raw['tipo'];

      if (tipo == 'CONEXION_ESTABLECIDA') {
        final alertas = raw['alertas_activas'];
        if (alertas is List) {
          for (final a in alertas) {
            onAlertaRecibida(AlertaIncidente.fromJson(Map<String, dynamic>.from(a)));
          }
        }
      } else if (tipo == 'INCIDENTE_CONDUCTA' || tipo == 'alerta_incidente') {
        onAlertaRecibida(AlertaIncidente.fromJson(raw));
      } else if (tipo == 'INTERVENCION_DOCENTE') {
        final est = raw['estudiante']?.toString() ?? '';
        if (est.isNotEmpty) {
          onIntervencionStatus(est, false);
        }
      } else if (tipo == 'INTERVENCION_COMPLETADA') {
        final est = raw['estudiante']?.toString() ?? '';
        if (est.isNotEmpty) {
          onIntervencionStatus(est, true);
        }
      } else if (raw['incidente'] != null || raw['tipo_incidente'] != null) {
        onAlertaRecibida(AlertaIncidente.fromJson(raw));
      }
    } catch (_) {}
  }

  void _iniciarPingPeriodico() {
    _pingTimer?.cancel();
    _pingTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (_isConnected && !_isDisposed) {
        try {
          _channelAula?.sink.add(jsonEncode({'tipo': 'ping', 'timestamp': DateTime.now().millisecondsSinceEpoch}));
        } catch (_) {}
      }
    });
  }

  void _handleDisconnect(String motivo) {
    _setConnectionStatus(false);
    if (_isDisposed) return;

    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 4), () {
      if (!_isDisposed) {
        _conectarWebSockets();
      }
    });
  }

  /// Emite la intervención pedagógica con IA mediante WebSocket hacia la sala web del alumno.
  void enviarIntervencionIA(EstudianteConectado estudiante) {
    final payload = {
      'tipo': 'INTERVENCION_DOCENTE',
      'aula_id': aulaId,
      'estudiante': estudiante.nombre,
      'estudiante_id': estudiante.dbId,
      'docente': 'Docente Titular',
      'mensaje': 'El docente ha solicitado una pausa activa guiada por IA para recuperar el enfoque en ${estudiante.softwareActivo}.',
      'timestamp': DateTime.now().millisecondsSinceEpoch,
    };

    final jsonStr = jsonEncode(payload);

    // Enviar a ambos canales para garantizar recepción instantánea
    try {
      _channelAula?.sink.add(jsonStr);
    } catch (_) {}

    try {
      _channelAlertas?.sink.add(jsonStr);
    } catch (_) {}

    // Fallback REST por si el socket tiene buffer
    try {
      http.post(
        Uri.parse('${ApiConfig.baseUrl}/api/aulas/$aulaId/intervencion'),
        headers: {'Content-Type': 'application/json'},
        body: jsonStr,
      );
    } catch (_) {}
  }

  int _calcularAtencionPromedio(List<EstudianteConectado> ests) {
    if (ests.isEmpty) return 92;
    final total = ests.fold<int>(0, (sum, item) => sum + item.atencion);
    return (total / ests.length).round();
  }

  void dispose() {
    _isDisposed = true;
    _pingTimer?.cancel();
    _reconnectTimer?.cancel();
    _subAula?.cancel();
    _subAlertas?.cancel();
    _channelAula?.sink.close();
    _channelAlertas?.sink.close();
  }
}
