"""
Knowledge Graph — conexión lazy a Neo4j con manejo de errores.
"""
import logging
from langchain_experimental.graph_transformers import LLMGraphTransformer
from ..base_agents.language_agent import LanguageAgent
from ..config import get_knowledge_graph_config

logger = logging.getLogger(__name__)

# Referencia links:
# https://medium.com/data-science/building-knowledge-graphs-with-llm-graph-transformer-a91045c49b59
# https://blog.langchain.com/enhancing-rag-based-applications-accuracy-by-constructing-and-leveraging-knowledge-graphs/


def _get_neo4j_graph():
    """
    Inicialización lazy de la conexión Neo4j.
    Devuelve None si Neo4j no está configurado o no está disponible.
    """
    from app.config import settings

    if not all([settings.NEO4J_URL, settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD]):
        logger.info("Neo4j no configurado — se omite la creación del Knowledge Graph.")
        return None

    try:
        from langchain_neo4j import Neo4jGraph
        graph = Neo4jGraph(
            url=settings.NEO4J_URL,
            username=settings.NEO4J_USERNAME,
            password=settings.NEO4J_PASSWORD,
            refresh_schema=False
        )
        return graph
    except Exception as e:
        logger.warning("No se pudo conectar a Neo4j: %s", e)
        return None


def create_knowledge_graph(docs):
    """
    Crea el grafo de conocimiento a partir de los documentos.
    Si Neo4j no está disponible, logea un warning y retorna sin error.
    """
    try:
        graph = _get_neo4j_graph()
        if graph is None:
            return
        config = get_knowledge_graph_config()
        llm = LanguageAgent(**config, system_prompt="")
        agent = LLMGraphTransformer(llm.get_model())
        print("agent")
        graph_documents = agent.convert_to_graph_documents(docs)
        print("graph_documents")
        graph.add_graph_documents(
            graph_documents,
            baseEntityLabel=True,
            include_source=True
        )
        print("Knowledge Graph creado exitosamente con %d documentos.", len(graph_documents))
    except Exception as e:
        print("Error al crear Knowledge Graph (non-blocking): %s", e)
