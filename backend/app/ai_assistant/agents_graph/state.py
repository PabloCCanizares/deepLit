from typing import Annotated, TypedDict, Optional
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    """
    Define la información con la que se comunican los agentes
    """
    user: Optional[str] 
    user_message: Optional[str]
    history: Annotated[list[AnyMessage], add_messages]
    data: Optional[str]
    selected_mode: Optional[str]
    previous_agent: Optional[str]
    next_agent: Optional[str] 