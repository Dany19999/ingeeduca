import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:vibration/vibration.dart';
import 'config/api_config.dart';
import 'models/telemetria_models.dart';
import 'services/docente_socket_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ),
  );
  runApp(const EduGuardDocenteApp());
}

class EduGuardDocenteApp extends StatelessWidget {
  const EduGuardDocenteApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'INGEEDUCA • Control Docente',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        fontFamily: 'Roboto',
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF10B981),
          primary: const Color(0xFF10B981),
          surface: Colors.white,
        ),
        useMaterial3: true,
      ),
      home: const MonitoreoDocenteScreen(),
    );
  }
}

class MonitoreoDocenteScreen extends StatefulWidget {
  const MonitoreoDocenteScreen({super.key});

  @override
  State<MonitoreoDocenteScreen> createState() => _MonitoreoDocenteScreenState();
}

class _MonitoreoDocenteScreenState extends State<MonitoreoDocenteScreen> {
  final String aulaId = "AULA-101";
  late DocenteSocketService _socketService;

  bool _isWsConnected = false;
  int _atencionGrupal = 94;
  List<EstudianteConectado> _estudiantes = [];
  final List<AlertaIncidente> _alertas = [];
  final Set<String> _alertasIdentificadores = {};

  @override
  void initState() {
    super.initState();
    _inicializarServicio();
  }

  void _inicializarServicio() {
    _socketService = DocenteSocketService(
      aulaId: aulaId,
      onConnectionStatusChanged: (conectado) {
        if (mounted) {
          setState(() {
            _isWsConnected = conectado;
          });
        }
      },
      onParticipantesUpdated: (participantes, atencionGrupal) {
        if (mounted) {
          setState(() {
            _estudiantes = participantes;
            _atencionGrupal = atencionGrupal;
          });
        }
      },
      onAlertaRecibida: (alerta) {
        _procesarNuevaAlerta(alerta);
      },
      onIntervencionStatus: (nombreEstudiante, completada) {
        if (mounted) {
          setState(() {
            for (final est in _estudiantes) {
              if (est.nombre.toLowerCase().contains(nombreEstudiante.toLowerCase()) ||
                  nombreEstudiante.toLowerCase().contains(est.nombre.toLowerCase())) {
                if (completada) {
                  est.intervencionEnviada = false;
                  est.intervencionResuelta = true;
                  est.emocion = 'Atento';
                  est.atencion = (est.atencion + 15).clamp(70, 98);
                } else {
                  est.intervencionEnviada = true;
                  est.intervencionResuelta = false;
                }
              }
            }
          });

          if (completada) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Row(
                  children: [
                    const Icon(Icons.check_circle_outline, color: Colors.white),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '✓ $nombreEstudiante ha completado la intervención con éxito en la plataforma web.',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
                backgroundColor: const Color(0xFF10B981),
                behavior: SnackBarBehavior.floating,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            );
          }
        }
      },
    );

    _socketService.connect();
  }

  void _procesarNuevaAlerta(AlertaIncidente alerta) async {
    final key = '${alerta.estudiante}_${alerta.tipoIncidente}_${alerta.horaRegistro}';
    if (_alertasIdentificadores.contains(key)) return;
    _alertasIdentificadores.add(key);

    if (mounted) {
      setState(() {
        _alertas.insert(0, alerta);
        if (_alertas.length > 50) _alertas.removeLast();

        // Actualizar el estudiante correspondiente en la lista en vivo
        for (final est in _estudiantes) {
          if (est.nombre.toLowerCase().contains(alerta.estudiante.toLowerCase()) ||
              alerta.estudiante.toLowerCase().contains(est.nombre.toLowerCase())) {
            est.alertas += 1;
            if (alerta.tipoIncidente.contains('fatiga')) {
              est.emocion = 'Fatiga';
              if (est.atencion > 65) est.atencion = 62;
            } else if (alerta.tipoIncidente.contains('distra')) {
              est.emocion = 'Distraído';
              if (est.atencion > 68) est.atencion = 65;
            }
          }
        }
      });

      // Vibración de alerta háptica en dispositivo
      try {
        final hasVibrator = await Vibration.hasVibrator();
        if (hasVibrator == true) {
          Vibration.vibrate(duration: 600);
        }
      } catch (_) {}

      // Notificación visual en Snackbar
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.warning_amber_rounded, color: Colors.white),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Alerta: ${alerta.estudiante} - ${alerta.incidente}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          backgroundColor: const Color(0xFFEF4444),
          duration: const Duration(seconds: 4),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }

  void _abrirModalConfiguracionServidor() {
    final ipController = TextEditingController(text: ApiConfig.host);
    bool useHttpsLocal = ApiConfig.useHttps;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              padding: EdgeInsets.only(
                top: 24,
                left: 24,
                right: 24,
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Ajustes de Servidor',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Modifica la dirección IP del backend para sustentación en red LAN o nube sin recompilar.',
                    style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 20),
                  TextField(
                    controller: ipController,
                    decoration: InputDecoration(
                      labelText: 'IP / Host del Servidor',
                      hintText: 'ej. 192.168.1.45:8000',
                      prefixIcon: const Icon(Icons.dns_rounded, color: Color(0xFF10B981)),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFF10B981), width: 2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  SwitchListTile(
                    title: const Text('Usar protocolo HTTPS / WSS'),
                    subtitle: const Text('Activar en túneles Ngrok o Render'),
                    value: useHttpsLocal,
                    activeColor: const Color(0xFF10B981),
                    onChanged: (val) {
                      setModalState(() {
                        useHttpsLocal = val;
                      });
                    },
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        ApiConfig.host = ipController.text.trim();
                        ApiConfig.useHttps = useHttpsLocal;
                        Navigator.pop(context);
                        _socketService.dispose();
                        _inicializarServicio();
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        elevation: 0,
                      ),
                      icon: const Icon(Icons.save_rounded),
                      label: const Text(
                        'Guardar y Reconectar',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  void dispose() {
    _socketService.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final alertCount = _alertas.where((a) => a.estado != 'atendido con éxito').length;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'INGEEDUCA • Control Docente',
              style: TextStyle(
                color: Color(0xFF0F172A),
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _isWsConnected ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  _isWsConnected ? '● Conectado (Sala $aulaId)' : '● Reconectando...',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: _isWsConnected ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            onPressed: _abrirModalConfiguracionServidor,
            icon: const Icon(Icons.settings_outlined, color: Color(0xFF475569)),
            tooltip: 'Ajustes de Servidor',
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          color: const Color(0xFF10B981),
          onRefresh: () async {
            await _socketService.syncEstadoInicialRest();
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. SECCIÓN SUPERIOR: KPIS EN VIVO
                Row(
                  children: [
                    Expanded(
                      child: _buildKpiCard(
                        title: 'Atención Grupal',
                        value: '$_atencionGrupal%',
                        subtext: 'Promedio en aula',
                        icon: Icons.psychology_outlined,
                        iconColor: const Color(0xFF10B981),
                        trend: 'Óptimo',
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: _buildKpiCard(
                        title: 'Alertas Activas',
                        value: '$alertCount',
                        subtext: 'Incidentes en vivo',
                        icon: Icons.notifications_active_outlined,
                        iconColor: alertCount > 0 ? const Color(0xFFEF4444) : const Color(0xFF64748B),
                        trend: alertCount > 0 ? 'Requiere acción' : 'Estable',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // 2. TÍTULO DE SECCIÓN: TELEMETRÍA DE ESTUDIANTES
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Telemetría y Estado en Vivo',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE2E8F0),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '${_estudiantes.length} Conectados',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF475569),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // 3. BANDEJA DE ESTUDIANTES CONECTADOS
                if (_estudiantes.isEmpty)
                  _buildEmptyState()
                else
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _estudiantes.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final estudiante = _estudiantes[index];
                      return _buildEstudianteCard(estudiante);
                    },
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required String subtext,
    required IconData icon,
    required Color iconColor,
    required String trend,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF64748B),
                ),
              ),
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: iconColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 18, color: iconColor),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: const TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subtext,
            style: const TextStyle(
              fontSize: 11,
              color: Color(0xFF94A3B8),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEstudianteCard(EstudianteConectado estudiante) {
    Color estadoColor;
    Color estadoBg;
    String estadoTexto = estudiante.emocion;

    if (estudiante.atencion < 70 || estadoTexto.toLowerCase().contains('fatiga')) {
      estadoColor = const Color(0xFFEF4444);
      estadoBg = const Color(0xFFFEE2E2);
      estadoTexto = 'Fatiga';
    } else if (estudiante.atencion < 80 || estadoTexto.toLowerCase().contains('distra')) {
      estadoColor = const Color(0xFFF59E0B);
      estadoBg = const Color(0xFFFEF3C7);
      estadoTexto = 'Distraído';
    } else {
      estadoColor = const Color(0xFF10B981);
      estadoBg = const Color(0xFFD1FAE5);
      estadoTexto = 'Atento';
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: estudiante.intervencionEnviada
              ? const Color(0xFF38BDF8)
              : const Color(0xFFF1F5F9),
          width: 1.5,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // CABECERA: NOMBRE, SOFTWARE Y BADGE
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 20,
                backgroundColor: const Color(0xFFF1F5F9),
                child: Text(
                  estudiante.nombre.isNotEmpty ? estudiante.nombre[0].toUpperCase() : 'E',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF334155),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      estudiante.nombre,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        const Icon(Icons.laptop_chromebook, size: 14, color: Color(0xFF64748B)),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            estudiante.softwareActivo,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF64748B),
                              fontWeight: FontWeight.w500,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: estadoBg,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  estadoTexto,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: estadoColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // BARRA DE NIVEL DE ATENCIÓN INDIVIDUAL
          Row(
            children: [
              Text(
                'Atención: ${estudiante.atencion}%',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: estadoColor,
                ),
              ),
              const Spacer(),
              if (estudiante.alertas > 0)
                Text(
                  '${estudiante.alertas} Alertas',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFFEF4444),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: (estudiante.atencion / 100).clamp(0.0, 1.0),
              backgroundColor: const Color(0xFFF1F5F9),
              valueColor: AlwaysStoppedAnimation<Color>(estadoColor),
              minHeight: 6,
            ),
          ),
          const SizedBox(height: 14),

          // BOTÓN DE ACCIÓN BIDIRECCIONAL: INTERVENIR CON IA
          if (estudiante.intervencionResuelta)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFD1FAE5),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.check_circle_rounded, size: 18, color: Color(0xFF10B981)),
                  SizedBox(width: 6),
                  Text(
                    '✓ Intervención Resuelta',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF065F46),
                    ),
                  ),
                ],
              ),
            )
          else if (estudiante.intervencionEnviada)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFE0F2FE),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF0284C7)),
                    ),
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Intervención enviada • Esperando respuesta...',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF0369A1),
                    ),
                  ),
                ],
              ),
            )
          else
            SizedBox(
              width: double.infinity,
              height: 40,
              child: ElevatedButton.icon(
                onPressed: () {
                  setState(() {
                    estudiante.intervencionEnviada = true;
                  });
                  _socketService.enviarIntervencionIA(estudiante);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F172A),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                icon: const Icon(Icons.bolt_rounded, size: 18, color: Color(0xFFFBBF24)),
                label: const Text(
                  '⚡ Intervenir con IA',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
      ),
      child: const Column(
        children: [
          Icon(Icons.sensor_occupied_outlined, size: 48, color: Color(0xFF94A3B8)),
          SizedBox(height: 12),
          Text(
            'Esperando conexión de estudiantes',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: Color(0xFF475569),
            ),
          ),
          SizedBox(height: 6),
          Text(
            'Conectando en tiempo real con FastAPI y la base de datos de AULA-101...',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              color: Color(0xFF94A3B8),
            ),
          ),
        ],
      ),
    );
  }
}
