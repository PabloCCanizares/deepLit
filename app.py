from flask import Flask
from config import Config
from extensions import mongo
from routes.documents import documents_bp
from routes.config_routes import config_bp
from routes.scholar import scholar_bp
from routes.dashboard import dashboard_bp
from routes.uploads import uploads_bp
from routes.completion_queue import completion_bp

import click
import unittest

app = Flask(__name__)
app.config.from_object(Config)
mongo.init_app(app)

# Registrar Blueprints
app.register_blueprint(dashboard_bp)            # Dashboard (ruta raíz)
app.register_blueprint(documents_bp)              # Rutas de documentos
app.register_blueprint(config_bp)                 # Rutas de configuración
app.register_blueprint(scholar_bp)                # Rutas de búsqueda Scholar
app.register_blueprint(uploads_bp)  # Rutas de subida
app.register_blueprint(completion_bp)

# Comando CLI para ejecutar tests
@app.cli.command("test")
def test():
    """Ejecuta los tests unitarios."""
    tests = unittest.TestLoader().discover("tests")
    result = unittest.TextTestRunner(verbosity=2).run(tests)
    if result.wasSuccessful():
        exit(0)
    else:
        exit(1)

if __name__ == '__main__':
    app.run(debug=True, port=5001)
