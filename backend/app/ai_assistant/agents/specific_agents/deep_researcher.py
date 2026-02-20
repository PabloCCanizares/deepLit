import logging
from pathlib import Path
from langchain_community.vectorstores import FAISS
from ..base_agents.rag_agent import RagAgent
from ..prompts import DEEP_RESEARCHER_PROMPT
from ..config import get_deep_researcher_config

logger = logging.getLogger(__name__)

# Ruta base de los índices FAISS
FAISS_INDEXES_DIR = Path(__file__).resolve().parents[4] / "storage" / "faiss_indexes"

# Caché por usuario: {user_id: {"store": FAISS, "index_dirs": set()}}
_user_cache = {}


def deep_research(state):
	config = get_deep_researcher_config()
	agent = RagAgent(**config, system_prompt=DEEP_RESEARCHER_PROMPT)

	input = state["user_message"]
	history = state.get("history", [])
	user_id = state.get("user_id")
	input_processed = input + f" El historial es: {history}"

	# RAG — cargar índices FAISS del usuario (con caché)
	load_faiss_indexes(agent, user_id=user_id)
	rag = agent.retrive(user_message=input)

	prompt_rag = input_processed + rag

	prompt_final = agent.create_prompt(message=prompt_rag)
	output = agent.invoke(prompt_final)

	new_history = agent.create_history_entry(input, output)

	agent.print_agent_execution(agent="DEEP RESEARCHER", input=prompt_final, output=output)

	return {'data': output, 'history': new_history, 'previous_agent': 'deep_researcher', 'next_agent': None}


def load_faiss_indexes(agent, user_id=None):
	"""
	Carga los índices FAISS del usuario especificado.
	
	Estructura esperada en disco:
	  storage/faiss_indexes/{user_id}/{article_id}/index.faiss
	
	Usa caché por usuario: solo recarga si se han añadido nuevos artículos.
	"""
	global _user_cache

	if not FAISS_INDEXES_DIR.exists():
		logger.warning("No se encontró el directorio de índices FAISS: %s", FAISS_INDEXES_DIR)
		return

	# Determinar el directorio del usuario
	if user_id:
		user_faiss_dir = FAISS_INDEXES_DIR / str(user_id)
	else:
		# Fallback: si no hay user_id, cargar todos (compatibilidad)
		user_faiss_dir = FAISS_INDEXES_DIR
		user_id = "__global__"

	if not user_faiss_dir.exists():
		logger.warning("No hay índices FAISS para el usuario %s", user_id)
		return

	# Detectar qué directorios de índice existen
	current_index_dirs = set()
	for index_dir in user_faiss_dir.iterdir():
		if index_dir.is_dir() and (index_dir / "index.faiss").exists():
			current_index_dirs.add(index_dir.name)

	if not current_index_dirs:
		logger.warning("No se encontraron índices FAISS en %s", user_faiss_dir)
		return

	# Comprobar caché del usuario
	cache_key = str(user_id)
	if cache_key in _user_cache and _user_cache[cache_key]["index_dirs"] == current_index_dirs:
		agent.vector_store = _user_cache[cache_key]["store"]
		logger.info("FAISS caché reutilizada para usuario %s (%d índices)", user_id, len(current_index_dirs))
		return

	# Detectar índices nuevos
	cached_dirs = _user_cache.get(cache_key, {}).get("index_dirs", set())
	new_dirs = current_index_dirs - cached_dirs

	# Si hay caché parcial, solo cargar los nuevos
	if cache_key in _user_cache and new_dirs:
		merged_store = _user_cache[cache_key]["store"]
		for dir_name in new_dirs:
			index_dir = user_faiss_dir / dir_name
			try:
				loaded_store = FAISS.load_local(
					str(index_dir), agent.embedding_model,
					allow_dangerous_deserialization=True
				)
				merged_store.merge_from(loaded_store)
				logger.info("FAISS index nuevo cargado para usuario %s: %s", user_id, dir_name)
			except Exception as e:
				logger.warning("Error cargando FAISS index de %s: %s", dir_name, e)
	else:
		# Primera carga: cargar todos desde cero
		merged_store = None
		for dir_name in current_index_dirs:
			index_dir = user_faiss_dir / dir_name
			try:
				loaded_store = FAISS.load_local(
					str(index_dir), agent.embedding_model,
					allow_dangerous_deserialization=True
				)
				if merged_store is None:
					merged_store = loaded_store
				else:
					merged_store.merge_from(loaded_store)
				logger.info("FAISS index cargado para usuario %s: %s", user_id, dir_name)
			except Exception as e:
				logger.warning("Error cargando FAISS index de %s: %s", dir_name, e)

	# Actualizar caché del usuario
	_user_cache[cache_key] = {"store": merged_store, "index_dirs": current_index_dirs}
	agent.vector_store = merged_store
	logger.info("FAISS caché actualizada para usuario %s: %d índices", user_id, len(current_index_dirs))
