import operator
from typing import Annotated, List, TypedDict, Union, Optional
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    """
    Define la información con la que se comunican los agentes
    """
    messages: Annotated[List[AnyMessage], add_messages] # Historial de conversaciones entre los agentes
    
    # Esto es importante porque el master no es quien toma las decisiones, sino el workflow.py (el grafo)
    next_agent: Optional[str] # La decisión del máster
    selected_mode: Optional[str] # La herramineta 
    
    data: Optional[str] # Datos extra que podrían compartir (opcional)