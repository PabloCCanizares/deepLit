import os
from langchain_ollama import ChatOllama

def get_llm(temperatura=0):
    """
    Devuelve el modelo  según el proveedor que tenemos configurado
    """
    proveedor = os.getenv("LLM_PROVIDER", "ollama") 

    if proveedor == "openai":
        pass 

    else:
        model = ChatOllama(model="llama3.1", temperature=temperatura)        
        return model