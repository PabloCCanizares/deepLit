from langgraph.graph import StateGraph, END
from .state import AgentState
from .router import master_decider
from ..capabilities.chatbot import chat_bot
from ..capabilities.deep_researcher import deep_research
from ..capabilities.web_searcher import web_search
from ..capabilities.metadata_researcher import metadata_research
from pymongo import MongoClient 
from langgraph.checkpoint.mongodb import MongoDBSaver 
from app.config import settings

# CHANGE: Use the synchronous MongoClient
client = MongoClient(settings.MONGODB_URL)
checkpointer = MongoDBSaver(client=client)

def route_decision(state: AgentState):
    """
    Lee lo que decidió el Master y devuelve el nombre del siguiente nodo.
    """
    destination = state["next_agent"]
    if not destination: # Si por algún error llega algo vacío, terminamos
        return END
        
    return destination

# Creamos el grafo
workflow = StateGraph(AgentState)

# Añadimos los nodos (los agentes)
workflow.add_node("master", master_decider)
workflow.add_node("chatbot", chat_bot)
workflow.add_node("metadata_researcher", metadata_research)
workflow.add_node("deep_researcher", deep_research)
workflow.add_node("web_searcher", web_search)

workflow.set_entry_point("master")

# Añadimos las aristas
workflow.add_conditional_edges(
    "master",          
    route_decision,    
    {                  
        "chatbot": "chatbot",
        "metadata_researcher": "metadata_researcher",
        "deep_researcher": "deep_researcher",
        "web_searcher": "web_searcher",
    }
) # Condicional porque debe ejecutar al funcion para elegir por que arista ir

workflow.add_edge("chatbot", END)
workflow.add_edge("metadata_researcher", END)
workflow.add_edge("deep_researcher", END)
workflow.add_edge("web_searcher", END)

app = workflow.compile(checkpointer=checkpointer)
