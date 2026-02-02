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
    "valid_outputs": ['chatbot', 'meta_data_researcher', 'deep_researcher', 'web_searcher', 'nexus']
}
