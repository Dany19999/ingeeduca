/// Modelos de datos para el ecosistema INGEEDUCA Docente Móvil sincronizados con FastAPI y PostgreSQL.

class EstudianteConectado {
  final String id;
  final int? dbId;
  final String nombre;
  final String correo;
  final String aulaId;
  int atencion;
  String emocion;
  int confianza;
  int alertas;
  String tiempoConexion;
  String softwareActivo;
  bool intervencionEnviada;
  bool intervencionResuelta;

  EstudianteConectado({
    required this.id,
    this.dbId,
    required this.nombre,
    required this.correo,
    required this.aulaId,
    required this.atencion,
    required this.emocion,
    required this.confianza,
    required this.alertas,
    required this.tiempoConexion,
    required this.softwareActivo,
    this.intervencionEnviada = false,
    this.intervencionResuelta = false,
  });

  factory EstudianteConectado.fromJson(Map<String, dynamic> json) {
    return EstudianteConectado(
      id: (json['id'] ?? json['correo'] ?? json['email'] ?? json['nombre'] ?? '0').toString(),
      dbId: json['db_id'] != null ? int.tryParse(json['db_id'].toString()) : (json['id'] is int ? json['id'] as int : null),
      nombre: (json['nombre'] ?? 'Estudiante').toString(),
      correo: (json['correo'] ?? json['email'] ?? '').toString(),
      aulaId: (json['aulaId'] ?? json['aula_id'] ?? 'AULA-101').toString(),
      atencion: int.tryParse((json['atencion'] ?? 90).toString()) ?? 90,
      emocion: (json['emocion'] ?? 'Atento').toString(),
      confianza: int.tryParse((json['confianza'] ?? 95).toString()) ?? 95,
      alertas: int.tryParse((json['alertas'] ?? 0).toString()) ?? 0,
      tiempoConexion: (json['tiempoConexion'] ?? '1m').toString(),
      softwareActivo: (json['softwareActivo'] ?? 'Autodesk Revit 2026').toString(),
    );
  }
}

class AlertaIncidente {
  final int? id;
  final String aulaId;
  final String estudiante;
  final String tipoIncidente;
  final String incidente;
  final String severidad;
  final String horaRegistro;
  String estado;

  AlertaIncidente({
    this.id,
    required this.aulaId,
    required this.estudiante,
    required this.tipoIncidente,
    required this.incidente,
    required this.severidad,
    required this.horaRegistro,
    required this.estado,
  });

  factory AlertaIncidente.fromJson(Map<String, dynamic> json) {
    return AlertaIncidente(
      id: json['id'] != null ? int.tryParse(json['id'].toString()) : null,
      aulaId: (json['aula_id'] ?? json['aulaId'] ?? 'AULA-101').toString(),
      estudiante: (json['estudiante'] ?? json['alumno'] ?? 'Estudiante').toString(),
      tipoIncidente: (json['tipo_incidente'] ?? json['tipo'] ?? 'fatiga').toString().toLowerCase(),
      incidente: (json['incidente'] ?? json['descripcion'] ?? 'Alerta detectada').toString(),
      severidad: (json['severidad'] ?? 'ALTA').toString().toUpperCase(),
      horaRegistro: (json['hora_registro'] ?? json['hora'] ?? '').toString(),
      estado: (json['estado'] ?? 'pendiente').toString(),
    );
  }
}
