from dotenv import load_dotenv
load_dotenv()  # Cargar .env ANTES de crear instancias de Google

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings


# ============================================
# MODELOS DE GOOGLE GEMINI
# ============================================
# Opciones disponibles (2026):
#   - models/gemini-2.0-flash (rápido, económico) ← RECOMENDADO
#   - models/gemini-2.5-flash (más nuevo)
#   - models/gemini-2.5-pro (más potente, más caro)
DEFAULT_MODEL = "models/gemini-2.0-flash"
DEFAULT_TEMPERATURE = 0

# ============================================
# TEXT SPLITTER
# ============================================
DEFAULT_TEXT_SPLITTER = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    add_start_index=True,
)

# ============================================
# EMBEDDINGS
# ============================================
DEFAULT_EMBEDDINGS = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")

# ============================================
# CONFIGURACIONES DE AGENTES
# ============================================
CLEANER_CONFIG = {
    "modelo": "models/gemini-2.0-flash", 
    "temperatura": 0
}

CHATBOT_CONFIG = {
    "modelo": "models/gemini-2.0-flash", 
    "temperatura": 0
}

MASTER_CONFIG = {
    "modelo": "models/gemini-2.0-flash", 
    "temperatura": 0, 
    "valid_outputs": ['chatbot', 'metadata_researcher', 'deep_researcher', 'web_searcher', 'nexus']
}

METADATA_CONFIG = {
    "modelo": "models/gemini-2.0-flash", 
    "temperatura": 0,
    "text_splitter": DEFAULT_TEXT_SPLITTER,
    "embeddings": DEFAULT_EMBEDDINGS,
}

DEEP_RESEARCHER_CONFIG = {
    "modelo": "models/gemini-2.0-flash", 
    "temperatura": 0,
    "text_splitter": DEFAULT_TEXT_SPLITTER,
    "embeddings": DEFAULT_EMBEDDINGS,
}
