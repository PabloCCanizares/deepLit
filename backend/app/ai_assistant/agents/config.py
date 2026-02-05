from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings


DEFAULT_MODEL = "llama3.1"
DEFAULT_TEMPERATURE = 0

CLEANER_CONFIG = {
    "modelo": "gemma3:12b", 
    "temperatura": 0
}

CHATBOT_CONFIG = {
    "modelo": "gemma3:12b", 
    "temperatura": 0
}

MASTER_CONFIG = {
    "modelo": "gemma3:12b", 
    "temperatura": 0, 
    "valid_outputs": ['chatbot', 'metadata_researcher', 'deep_researcher', 'web_searcher', 'nexus']
}

METADATA_CONFIG = {
    "modelo": "gemma3:12b", 
    "temperatura": 0,
    "text_splitter": RecursiveCharacterTextSplitter(
		chunk_size=1000,  # chunk size (characters)
		chunk_overlap=200,  # chunk overlap (characters)
		add_start_index=True,  # track index in original document
		),
    "embbedings": OllamaEmbeddings(model="nomic-embed-text"),
}

DEEP_RESEARCHER_CONFIG = {
    "modelo": "gemma3:12b", 
    "temperatura": 0,
    "text_splitter": RecursiveCharacterTextSplitter(
		chunk_size=1000,  # chunk size (characters)
		chunk_overlap=200,  # chunk overlap (characters)
		add_start_index=True,  # track index in original document
		),
    "embbedings": OllamaEmbeddings(model="nomic-embed-text"),
}

PDF_PROCESSOR_CONFIG = {
    "modelo": "gemma3:12b", 
    "temperatura": 0,
    "text_splitter": RecursiveCharacterTextSplitter(
		chunk_size=1000,  # chunk size (characters)
		chunk_overlap=200,  # chunk overlap (characters)
		add_start_index=True,  # track index in original document
		),
    "embbedings": OllamaEmbeddings(model="nomic-embed-text"),
}

