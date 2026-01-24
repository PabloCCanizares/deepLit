"""
Agente que se encarga de interactuar con el usuario y recordar las conversaciones
"""

from langgraph.graph import MessagesState
from langchain.chat_models import init_chat_model
from langchain.tools import tool
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_core.messages import SystemMessage
from ..config_llm import get_llm


llm = get_llm(temperature=0.7) # Temperatura mas alta porque queremos que sea creativo y simpático, como un ser humano

SYSTEM_PROMPT = """
Eres un asistente de IA útil, simpático y profesional.
Tu objetivo es mantener una conversación fluida con el usuario.

DIRECTRICES:
- Si el usuario te saluda, responde amablemente.
- Si te preguntan quién eres, preséntate como el Asistente Inteligente de DeepLit.
- Sé conciso, no hace falta que escribas mucho texto si no es necesario.
- Si el usuario te pregunta algo que no sabes, sugiere amablemente que intente ser más específico.
"""

def chatbot_node(state):
    """
    Recibe el historial de mensajes y genera una respuesta conversacional.
    """
    messages = state["messages"]
    prompt = [SystemMessage(content=SYSTEM_PROMPT)] + messages
    response = llm.invoke(prompt)

    return {"messages": [response]} # Devolvemos la respuesta como una lista para qeu se haga un append automático al historial global