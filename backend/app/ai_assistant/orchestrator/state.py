from typing import Annotated, TypedDict, Optional
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    """
    Define la información con la que se comunican los agentes
    """
    user: Optional[str] 
    user_id: Optional[str]
    collection_id: Optional[str]
    user_message: Optional[str]
    history: Annotated[list[AnyMessage], add_messages]
    data: Optional[str]
    selected_mode: Optional[str]
    runtime_mode: Optional[str]
    web_provider: Optional[str]
    rag_context: Optional[str]
    context_source: Optional[str]
    prompt_version: Optional[str]
    web_search_meta: Optional[dict]
    previous_agent: Optional[str]
    next_agent: Optional[str]
    graph_rag_context: Optional[str]
