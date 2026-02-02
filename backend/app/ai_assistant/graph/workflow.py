from langgraph.graph import StateGraph, END
from .state import AgentState
from ..agents.specific_agents.master_router import master_decider
from ..agents.specific_agents.cleaner import clean_text
from ..agents.specific_agents.chat_bot import chat_bot
from ..agents.specific_agents.deep_researcher import deep_researcher_node
from ..agents.specific_agents.web_researcher import web_researcher_node
from ..agents.specific_agents.nexus import nexus_node
from ..agents.specific_agents.meta_data_researcher import meta_data_researcher_node
from motor.motor_asyncio import AsyncIOMotorClient
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
workflow.add_node("cleaner", clean_text)
workflow.add_node("chatbot", chat_bot)
workflow.add_node("meta_data_researcher", meta_data_researcher_node)
workflow.add_node("deep_researcher", deep_researcher_node)
workflow.add_node("web_searcher", web_researcher_node)
workflow.add_node("nexus", nexus_node)

workflow.set_entry_point("cleaner") # Que empiece siempre por el nodo master

# Añadimos las aristas
workflow.add_conditional_edges(
    "master",          
    route_decision,    
    {                  
        "chatbot": "chatbot",
        "meta_data_researcher": "meta_data_researcher",
        "deep_researcher": "deep_researcher",
        "web_searcher": "web_searcher",
        "nexus": "nexus"
    }
) # Condicional porque debe ejecutar al funcion para elegir por que arista ir

workflow.add_edge("cleaner", "master")
workflow.add_edge("chatbot", END)
workflow.add_edge("meta_data_researcher", END)
workflow.add_edge("deep_researcher", END)
workflow.add_edge("web_searcher", END)
workflow.add_edge("nexus", END)

app = workflow.compile(checkpointer=checkpointer)