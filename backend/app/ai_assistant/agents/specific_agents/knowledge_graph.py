from langchain_neo4j import Neo4jGraph
from langchain_experimental.graph_transformers import LLMGraphTransformer
from ..base_agents.language_agent import LanguageAgent
from ..config import get_knowledge_graph_config


# https://medium.com/data-science/building-knowledge-graphs-with-llm-graph-transformer-a91045c49b59
# https://blog.langchain.com/enhancing-rag-based-applications-accuracy-by-constructing-and-leveraging-knowledge-graphs/
# Instalar neo4j desktop
# Crear instancia -> plugins -> instalar APOC
graph = Neo4jGraph(
    url="bolt://127.0.0.1:7687",
    username="neo4j",
    password="deepLit!",
    refresh_schema=False
)

def create_knowledge_graph(docs):
    config = get_knowledge_graph_config()
    llm = LanguageAgent(**config, system_prompt="")
    agent = LLMGraphTransformer(llm.get_model())
    graph_documents = agent.convert_to_graph_documents(docs)
    graph.add_graph_documents(graph_documents, 
                              baseEntityLabel=True, 
                              include_source=True
                              )
    
