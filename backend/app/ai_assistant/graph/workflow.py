from langgraph.graph import StateGraph, END
from .state import AgentState
from ..agents.master_router import master_router_node
from ..agents.chat_bot import chatbot_node
from ..agents.deep_researcher import deep_researcher_node  
from ..agents.web_researcher import web_researcher_node
from ..agents.nexus import nexus_node
from ..agents.meta_data_researcher import meta_data_researcher_node
from motor.motor_asyncio import AsyncIOMotorClient
from langgraph.checkpoint.mongodb.aio import AsyncMongoDBSaver
from app.config import settings

# Así se guardan todas las conversaciones
client = AsyncIOMotorClient(settings.MONGODB_URL)
checkpointer = AsyncMongoDBSaver(client=client)

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
workflow.add_node("master", master_router_node)
workflow.add_node("chatbot", chatbot_node)
workflow.add_node("meta_data_researcher", meta_data_researcher_node)
workflow.add_node("deep_researcher", deep_researcher_node)
workflow.add_node("web_searcher", web_researcher_node)
workflow.add_node("nexus", nexus_node)


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

workflow.add_edge("chatbot", END)
workflow.add_edge("meta_data_researcher", END)
workflow.add_edge("researcher", END)
workflow.add_edge("web_searcher", END)
workflow.add_edge("nexus", END)


workflow.set_entry_point("master") # Que empiece siempre por el nodo master

app = workflow.compile()