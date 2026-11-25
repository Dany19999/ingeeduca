"""
Script independiente para inicializar tablas y usuarios en PostgreSQL eduguard_tesis_db
"""
from database import inicializar_base_datos, engine
from models import Base

if __name__ == "__main__":
    print("Iniciando creación de tablas e inserción de usuarios semilla...")
    Base.metadata.create_all(bind=engine)
    inicializar_base_datos()
    print("Inicialización completada con éxito.")
