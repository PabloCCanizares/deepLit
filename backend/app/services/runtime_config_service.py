"""
Servicio de configuración runtime.

Gestiona configuración que puede cambiar en tiempo de ejecución.
"""
import json
from pathlib import Path
from typing import Dict

# Ruta al archivo de configuración runtime
RUNTIME_CONFIG_PATH = Path(__file__).parent / "runtime_config.json"


class RuntimeConfigService:
    """Servicio para gestionar configuración en tiempo de ejecución"""

    @staticmethod
    def _load_config() -> Dict:
        """Carga la configuración desde el archivo JSON"""
        try:
            with open(RUNTIME_CONFIG_PATH, 'r') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            # Si no existe o está corrupto, crear uno por defecto
            default_config = {"offline": True}
            RuntimeConfigService._save_config(default_config)
            return default_config

    @staticmethod
    def _save_config(config: Dict) -> None:
        """Guarda la configuración en el archivo JSON"""
        with open(RUNTIME_CONFIG_PATH, 'w') as f:
            json.dump(config, f, indent=2)

    @staticmethod
    def get_offline_mode() -> bool:
        """Obtiene el modo offline actual"""
        config = RuntimeConfigService._load_config()
        return config.get("offline", True)

    @staticmethod
    def set_offline_mode(offline: bool) -> Dict:
        """Establece el modo offline"""
        config = RuntimeConfigService._load_config()
        config["offline"] = offline
        RuntimeConfigService._save_config(config)
        return config

    @staticmethod
    def get_all_config() -> Dict:
        """Obtiene toda la configuración"""
        return RuntimeConfigService._load_config()
