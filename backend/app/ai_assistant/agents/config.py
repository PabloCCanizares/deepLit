from langchain_text_splitters import RecursiveCharacterTextSplitter
from pymongo import MongoClient
from langchain_ollama import OllamaEmbeddings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from app.config import settings

CLIENT = MongoClient("mongodb://localhost:27017/")
DATABASE = "deeplit"

DEFAULT_TEXT_SPLITTER = RecursiveCharacterTextSplitter(chunk_size=1000,  chunk_overlap=200, add_start_index=True)
DEFAULT_OFFLINE_EMBBEDING_MODEL = "nomic-embed-text"
DEFAULT_ONLINE_EMBBEDING_MODEL = "models/gemini-embedding-001"

def get_embeddings():
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

def get_model_name():
    offline = settings.OFFLINE
    if offline:
        return "gemma3:12b"
    else:
        return "gemini-2.0-flash"

def get_cleaner_config():
    offline = settings.OFFLINE
    return {
        "modelo": get_model_name(),
        "temperatura": 0,
        "offline": offline
    }

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
        "valid_outputs": ['chatbot', 'metadata_researcher', 'deep_researcher', 'web_searcher', 'nexus'],
        "offline": offline
    }

def get_web_searcher_config():
    offline = settings.OFFLINE
    return {
        "modelo": get_model_name(),
        "temperatura": 0,
        "offline": offline
    }

def get_metadata_config():
    offline = settings.OFFLINE
    return {
        "modelo": get_model_name(),
        "temperatura": 0,
        "text_splitter": DEFAULT_TEXT_SPLITTER,
        "embbedings": get_embeddings(),
        "offline": offline
    }

def get_deep_researcher_config():
    offline = settings.OFFLINE
    return {
        "modelo": get_model_name(),
        "temperatura": 0,
        "text_splitter": DEFAULT_TEXT_SPLITTER,
        "embbedings": get_embeddings(),
        "offline": offline
    }

def get_pdf_processor_config():
    offline = settings.OFFLINE
    return {
        "modelo": get_model_name(),
        "temperatura": 0,
        "text_splitter": DEFAULT_TEXT_SPLITTER,
        "embbedings": get_embeddings(),
        "offline": offline
    }
