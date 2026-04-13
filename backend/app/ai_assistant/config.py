from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from app.config import settings

DEFAULT_TEXT_SPLITTER = RecursiveCharacterTextSplitter(chunk_size=1500, chunk_overlap=300, add_start_index=True)
DEFAULT_OFFLINE_EMBBEDING_MODEL = "nomic-embed-text"
DEFAULT_ONLINE_EMBBEDING_MODEL = "models/gemini-embedding-001"
DEFAULT_RAG_STRATEGY = {
    "k": 8,
    "use_mmr": True,
    "fetch_k_multiplier": 3,
    "lambda_mult": 0.7,
    "rerank": "query_overlap",
    "max_context_chars": 12000,
    "include_citations": True,
}

def get_embeddings(offline=None):
    if offline is None:
        offline = settings.OFFLINE
    if offline:
        return OllamaEmbeddings(model=DEFAULT_OFFLINE_EMBBEDING_MODEL)
    else:
        if not settings.GOOGLE_API_KEY:
            raise ValueError("GOOGLE_API_KEY no está configurada")
        return GoogleGenerativeAIEmbeddings(
            model= DEFAULT_ONLINE_EMBBEDING_MODEL,
            google_api_key=settings.GOOGLE_API_KEY
        )

def get_model_name(offline=None):
    if offline is None:
        offline = settings.OFFLINE
    if offline:
        return "gemma3:4b"
    else:
        return "gemini-2.0-flash"

def get_chatbot_config():
    offline = settings.OFFLINE
    return {
        "modelo": get_model_name(),
        "temperatura": 0,
        "offline": offline
    }

def get_knowledge_graph_config():
    offline = settings.OFFLINE
    return {
        "modelo": get_model_name(),
        "temperatura": 0,
        "offline": offline
    }

def get_master_config():
    offline = settings.OFFLINE
    return {
        "modelo": get_model_name(),
        "temperatura": 0,
        "valid_outputs": [
            'chatbot',
            'metadata_researcher',
            'deep_researcher',
            'web_searcher',
        ],
        "offline": offline
    }

def get_web_searcher_config():
    offline = settings.OFFLINE
    return {
        "modelo": get_model_name(),
        "temperatura": 0,
        "offline": offline
    }

def get_metadata_config(offline=None):
    if offline is None:
        offline = settings.OFFLINE
    return {
        "modelo": get_model_name(offline),
        "temperatura": 0,
        "text_splitter": DEFAULT_TEXT_SPLITTER,
        "embedding_model": get_embeddings(offline),
        "offline": offline
    }

def get_deep_researcher_config(offline=None):
    if offline is None:
        offline = settings.OFFLINE
    return {
        "modelo": get_model_name(offline),
        "temperatura": 0,
        "text_splitter": DEFAULT_TEXT_SPLITTER,
        "embedding_model": get_embeddings(offline),
        "offline": offline
    }

def get_collection_screening_config(offline=None):
    return get_deep_researcher_config(offline)

def get_collection_synthesis_config(offline=None):
    return get_deep_researcher_config(offline)

def get_rag_strategy_config():
    return DEFAULT_RAG_STRATEGY.copy()
