"""
SSE Manager — gestión de conexiones Server-Sent Events por usuario.

Mantiene un dict de user_id → list[asyncio.Queue].
Cuando un artículo termina de procesarse (o falla), se envía un evento
a todas las conexiones activas de ese usuario.
"""
import asyncio
import logging
from typing import Dict, List, Any

logger = logging.getLogger(__name__)


class SSEManager:
    """Singleton para gestionar conexiones SSE por usuario."""

    def __init__(self):
        self._connections: Dict[str, List[asyncio.Queue]] = {}

    def subscribe(self, user_id: str) -> asyncio.Queue:
        """Registrar nueva conexión SSE para un usuario."""
        queue: asyncio.Queue = asyncio.Queue()
        if user_id not in self._connections:
            self._connections[user_id] = []
        self._connections[user_id].append(queue)
        logger.info("SSE: usuario %s conectado (%d conexiones)", user_id, len(self._connections[user_id]))
        return queue

    def unsubscribe(self, user_id: str, queue: asyncio.Queue):
        """Eliminar conexión SSE de un usuario."""
        if user_id in self._connections:
            try:
                self._connections[user_id].remove(queue)
            except ValueError:
                pass
            if not self._connections[user_id]:
                del self._connections[user_id]
            logger.info("SSE: usuario %s desconectado", user_id)

    def notify(self, user_id: str, event: str, data: Any):
        """
        Enviar evento a todas las conexiones activas de un usuario.
        Se llama desde un hilo background (sync), así que usa put_nowait.
        """
        if user_id not in self._connections:
            return

        dead_queues = []
        for queue in self._connections[user_id]:
            try:
                queue.put_nowait({"event": event, "data": data})
            except asyncio.QueueFull:
                dead_queues.append(queue)

        # Limpiar queues que estén llenas (clientes desconectados)
        for q in dead_queues:
            try:
                self._connections[user_id].remove(q)
            except ValueError:
                pass

        logger.info("SSE: evento '%s' enviado a %s", event, user_id)


# Instancia global
sse_manager = SSEManager()
