"""
Se encarga de decidir a qué agentes llamar según la intención del usuario
"""

from typing import Literal
from langchain_core.messages import SystemMessage
from pydantic import BaseModel, Field

from ..config_llm import get_llm 

class RouteQuery(BaseModel):
    """
    Sirve para que el modelo responda con una opción de las disponibles (cada una correspondiente a un agente)
    Con esto nos aseguramos que la respuesta sea un agente
    """
    destination: Literal["chatbot", "meta_data_researcher", "deep_research", "web_search", "nexus"] = Field(
        ...,
        description="Elige el agente indicado según la intención del usuario"
    )


llm = get_llm(temperatura=0) # Temprartura 0 porque no queremos que invente, sino que se ciña a las opciones

structured_llm_router = llm.with_structured_output(RouteQuery)

SYSTEM_PROMPT = """
Eres el encargado de analizar la intención del usuario.
- 'chatbot': Saludos, preguntas personales o sobre la conversación anterior.
- 'meta_data_researcher': Consultas sencillas sobre los articulos del usuario, relacionadas con sus campos que son: titulo, año, categoria, tipo, numero de paginas, palabras clave, url, abstract, resumen, citaciones, citaciones por año.
- 'deep_research': Preguntas que requieren analizar los articulos guardados del usuario.
- 'web_search': Preguntas sobre actualidad, noticias o datos de internet.
- 'nexus': Petición de creación de un ar´ticulo científico a partir de otros artículos.
En el caso de que haya varias intenciones, elige la predominante.
"""

# ---FUNCIÓN QUE DESEMPEÑA EL NODO ---
def master_router_node(state):
    manual_mode = state.get("selected_mode") # Comprobamos si el usuario ha elegido alguna herramienta

    # Lista de agentes válidos para evitar errores
    valid_agents = ["chatbot", "meta_data_researcher", "deep_research", "web_search", "nexus"]

    if manual_mode in valid_agents:
        return {"next_agent": manual_mode}

    messages = state["messages"]
    msg_usuario = messages[-1]
    
    prompt = [SystemMessage(content=SYSTEM_PROMPT), msg_usuario]
    result = structured_llm_router.invoke(prompt)
    
    return {"next_agent": result.destination}