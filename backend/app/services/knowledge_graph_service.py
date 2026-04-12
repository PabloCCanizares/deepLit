import logging
from datetime import datetime
from typing import Dict, List, Optional

from langchain_core.documents import Document
from pymongo import MongoClient

from app.ai_assistant.agents.base_agents.base_agent import BaseAgent
from app.ai_assistant.config import get_knowledge_graph_config
from app.ai_assistant.knowledge_graph.schema import (
    KG_NODE_TYPES,
    KG_RELATIONSHIP_SCHEMA,
    KG_RELATIONSHIP_TYPES,
    RELATIONSHIP_RULES,
    get_schema_descriptor,
    node_key,
    normalize_rel_type,
    sanitize_entity_type,
    validate_graph_documents,
)
from app.config import settings

logger = logging.getLogger(__name__)


class KnowledgeGraphService:
    def __init__(self):
        self.mongo = MongoClient(settings.MONGODB_URL)
        self.db = self.mongo[settings.DATABASE_NAME]
        self.articles = self.db["articles"]
        self.quality_logs = self.db["knowledge_graph_quality"]

    def _get_graph(self):
        if not all([settings.NEO4J_URL, settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD]):
            return None
        try:
            from langchain_neo4j import Neo4jGraph

            return Neo4jGraph(
                url=settings.NEO4J_URL,
                username=settings.NEO4J_USERNAME,
                password=settings.NEO4J_PASSWORD,
                refresh_schema=False,
            )
        except Exception as exc:
            logger.warning("No se pudo conectar a Neo4j: %s", exc)
            return None

    def is_available(self) -> bool:
        return self._get_graph() is not None

    def get_schema(self) -> Dict:
        return get_schema_descriptor()

    def _build_transformer(self):
        from langchain_experimental.graph_transformers import LLMGraphTransformer

        config = get_knowledge_graph_config()
        llm = BaseAgent(**config, system_prompt="")
        return LLMGraphTransformer(
            llm=llm.get_model(),
            allowed_nodes=KG_NODE_TYPES,
            allowed_relationships=KG_RELATIONSHIP_SCHEMA,
            strict_mode=True,
            node_properties=False,
            relationship_properties=False,
            additional_instructions=(
                "Extrae relaciones científicas explícitas. "
                "No inventes entidades. Mantén nombres cortos y canónicos."
            ),
        )

    def _truncate_docs(self, docs: List[Document], max_docs: int = 20, max_chars_per_doc: int = 3000) -> List[Document]:
        truncated: List[Document] = []
        for doc in docs[:max_docs]:
            truncated.append(
                Document(
                    page_content=(doc.page_content or "")[:max_chars_per_doc],
                    metadata=doc.metadata or {},
                )
            )
        return truncated

    def _save_quality_log(self, user_id: str, article_id: str, report: Dict) -> None:
        try:
            self.quality_logs.insert_one(
                {
                    "user_id": user_id,
                    "article_id": article_id,
                    "created_at": datetime.utcnow(),
                    **report,
                }
            )
        except Exception as exc:
            logger.warning("No se pudo guardar quality log de KG: %s", exc)

    def _upsert_paper_node(self, graph, user_id: str, article_id: str, title: str, collection_ids: List[str]) -> None:
        graph.query(
            """
            MERGE (p:Paper {user_id: $user_id, article_id: $article_id})
            SET p.title = $title,
                p.collection_ids = $collection_ids,
                p.updated_at = datetime()
            """,
            {
                "user_id": user_id,
                "article_id": article_id,
                "title": title or "Sin titulo",
                "collection_ids": collection_ids or [],
            },
        )

    def _upsert_entity_and_mention(
        self,
        graph,
        user_id: str,
        article_id: str,
        collection_ids: List[str],
        node,
    ) -> None:
        key = node_key(node)
        if not key:
            return
        entity_type = sanitize_entity_type(getattr(node, "type", None))
        entity_name = str(getattr(node, "id", "")).strip()

        graph.query(
            """
            MERGE (e:Entity {user_id: $user_id, entity_key: $entity_key})
            SET e.name = $entity_name,
                e.entity_type = $entity_type,
                e.updated_at = datetime()
            WITH e
            MATCH (p:Paper {user_id: $user_id, article_id: $article_id})
            MERGE (p)-[m:MENTIONS]->(e)
            SET m.user_id = $user_id,
                m.article_id = $article_id,
                m.collection_ids = $collection_ids,
                m.updated_at = datetime()
            """,
            {
                "user_id": user_id,
                "entity_key": key,
                "entity_name": entity_name,
                "entity_type": entity_type,
                "article_id": article_id,
                "collection_ids": collection_ids or [],
            },
        )

    def _upsert_relation(
        self,
        graph,
        user_id: str,
        article_id: str,
        collection_ids: List[str],
        source_node,
        rel_type: str,
        target_node,
    ) -> None:
        source_key = node_key(source_node)
        target_key = node_key(target_node)
        if not source_key or not target_key or not rel_type:
            return

        source_type = sanitize_entity_type(getattr(source_node, "type", None))
        target_type = sanitize_entity_type(getattr(target_node, "type", None))
        if (source_type, rel_type, target_type) not in RELATIONSHIP_RULES:
            return

        query = f"""
        MATCH (s:Entity {{user_id: $user_id, entity_key: $source_key}})
        MATCH (t:Entity {{user_id: $user_id, entity_key: $target_key}})
        MERGE (s)-[r:{rel_type} {{user_id: $user_id, article_id: $article_id}}]->(t)
        SET r.collection_ids = $collection_ids,
            r.updated_at = datetime()
        """
        graph.query(
            query,
            {
                "user_id": user_id,
                "article_id": article_id,
                "source_key": source_key,
                "target_key": target_key,
                "collection_ids": collection_ids or [],
            },
        )

    def ingest_documents(
        self,
        user_id: str,
        article_id: str,
        title: str,
        docs: List[Document],
        collection_ids: Optional[List[str]] = None,
        reprocess: bool = False,
    ) -> Dict:
        graph = self._get_graph()
        if graph is None:
            return {"enabled": False, "message": "Neo4j no configurado"}

        collection_ids = collection_ids or []
        self._upsert_paper_node(graph, user_id, article_id, title, collection_ids)

        if reprocess:
            graph.query(
                """
                MATCH (:Paper {user_id: $user_id, article_id: $article_id})-[m:MENTIONS]->(:Entity)
                DELETE m
                """,
                {"user_id": user_id, "article_id": article_id},
            )
            for rel_type in KG_RELATIONSHIP_TYPES:
                graph.query(
                    f"""
                    MATCH (:Entity {{user_id: $user_id}})-[r:{rel_type} {{article_id: $article_id}}]->(:Entity)
                    DELETE r
                    """,
                    {"user_id": user_id, "article_id": article_id},
                )

        transformer = self._build_transformer()
        docs_for_kg = self._truncate_docs(docs)
        graph_documents = transformer.convert_to_graph_documents(docs_for_kg)
        quality_report = validate_graph_documents(graph_documents)

        for graph_doc in graph_documents:
            for node in (getattr(graph_doc, "nodes", []) or []):
                self._upsert_entity_and_mention(graph, user_id, article_id, collection_ids, node)
            for rel in (getattr(graph_doc, "relationships", []) or []):
                rel_type = normalize_rel_type(getattr(rel, "type", None))
                self._upsert_relation(
                    graph=graph,
                    user_id=user_id,
                    article_id=article_id,
                    collection_ids=collection_ids,
                    source_node=getattr(rel, "source", None),
                    rel_type=rel_type,
                    target_node=getattr(rel, "target", None),
                )

        self._save_quality_log(user_id=user_id, article_id=article_id, report=quality_report)
        return {
            "enabled": True,
            "article_id": article_id,
            "extraction_quality": quality_report,
        }

    def ingest_article_record(self, article: Dict, user_id: str, reprocess: bool = False) -> Dict:
        article_id = str(article.get("_id", ""))
        if not article_id:
            return {"enabled": False, "message": "Articulo sin _id"}

        text = "\n".join(
            [
                f"Titulo: {article.get('title', '')}",
                f"Abstract: {article.get('abstract', '')}",
                f"Keywords: {article.get('keywords', [])}",
                f"Referencias: {article.get('referenced_works', [])}",
                f"Ano: {article.get('year', '')}",
                f"Categoria: {article.get('category', '')}",
            ]
        )
        docs = [Document(page_content=text, metadata={"article_id": article_id, "source": f"article:{article_id}"})]
        return self.ingest_documents(
            user_id=user_id,
            article_id=article_id,
            title=article.get("title", ""),
            docs=docs,
            collection_ids=article.get("collection_ids", []) or [],
            reprocess=reprocess,
        )

    def get_stats(self, user_id: str, collection_id: Optional[str] = None) -> Dict:
        graph = self._get_graph()
        if graph is None:
            return {"enabled": False, "message": "Neo4j no configurado"}

        params = {"user_id": user_id, "collection_id": collection_id}
        papers = graph.query(
            """
            MATCH (p:Paper {user_id: $user_id})
            WHERE $collection_id IS NULL OR $collection_id IN coalesce(p.collection_ids, [])
            RETURN count(DISTINCT p) AS total
            """,
            params,
        )[0]["total"]
        entities = graph.query(
            """
            MATCH (p:Paper {user_id: $user_id})-[m:MENTIONS]->(e:Entity {user_id: $user_id})
            WHERE $collection_id IS NULL OR $collection_id IN coalesce(m.collection_ids, [])
            RETURN count(DISTINCT e) AS total
            """,
            params,
        )[0]["total"]
        relations = graph.query(
            """
            MATCH (:Entity {user_id: $user_id})-[r]->(:Entity {user_id: $user_id})
            WHERE type(r) <> 'MENTIONS'
              AND ($collection_id IS NULL OR $collection_id IN coalesce(r.collection_ids, []))
            RETURN count(r) AS total
            """,
            params,
        )[0]["total"]

        return {
            "enabled": True,
            "papers": papers,
            "entities": entities,
            "relationships": relations,
        }

    def search_entities(self, user_id: str, query: str, collection_id: Optional[str] = None, limit: int = 20) -> List[Dict]:
        graph = self._get_graph()
        if graph is None:
            return []
        return graph.query(
            """
            MATCH (p:Paper {user_id: $user_id})-[m:MENTIONS]->(e:Entity {user_id: $user_id})
            WHERE ($collection_id IS NULL OR $collection_id IN coalesce(m.collection_ids, []))
              AND toLower(e.name) CONTAINS toLower($query)
            RETURN e.name AS name, e.entity_type AS entity_type, count(DISTINCT p) AS papers
            ORDER BY papers DESC, name ASC
            LIMIT $limit
            """,
            {"user_id": user_id, "query": query or "", "collection_id": collection_id, "limit": int(limit)},
        )

    def get_entity_neighbors(
        self,
        user_id: str,
        entity_name: str,
        collection_id: Optional[str] = None,
        limit: int = 25,
    ) -> List[Dict]:
        graph = self._get_graph()
        if graph is None:
            return []
        return graph.query(
            """
            MATCH (e:Entity {user_id: $user_id})
            WHERE toLower(e.name) = toLower($entity_name)
            MATCH (e)-[r]->(n:Entity {user_id: $user_id})
            WHERE type(r) <> 'MENTIONS'
              AND ($collection_id IS NULL OR $collection_id IN coalesce(r.collection_ids, []))
            RETURN e.name AS source, type(r) AS relation, n.name AS target, n.entity_type AS target_type, r.article_id AS article_id
            ORDER BY relation, target
            LIMIT $limit
            """,
            {
                "user_id": user_id,
                "entity_name": entity_name,
                "collection_id": collection_id,
                "limit": int(limit),
            },
        )

    def get_quality_logs(self, user_id: str, article_id: Optional[str] = None, limit: int = 50) -> List[Dict]:
        query: Dict = {"user_id": user_id}
        if article_id:
            query["article_id"] = article_id
        cursor = self.quality_logs.find(query).sort("created_at", -1).limit(int(limit))
        result = []
        for row in cursor:
            row["_id"] = str(row["_id"])
            result.append(row)
        return result

    def backfill(self, user_id: str, collection_id: Optional[str] = None, limit: int = 100, reprocess: bool = False) -> Dict:
        query: Dict = {"id_user": user_id, "status": "ready"}
        if collection_id:
            query["collection_ids"] = {"$in": [collection_id]}

        articles = list(self.articles.find(query).sort("_id", 1).limit(int(limit)))
        processed = 0
        failed = 0
        reports = []
        for article in articles:
            article_id = str(article.get("_id", ""))
            if not article_id:
                continue
            if not reprocess:
                graph = self._get_graph()
                if graph is not None:
                    existing = graph.query(
                        """
                        MATCH (p:Paper {user_id: $user_id, article_id: $article_id})
                        RETURN count(p) AS total
                        """,
                        {"user_id": user_id, "article_id": article_id},
                    )[0]["total"]
                    if existing > 0:
                        continue
            try:
                report = self.ingest_article_record(article=article, user_id=user_id, reprocess=reprocess)
                reports.append({"article_id": article_id, **report})
                processed += 1
            except Exception as exc:
                failed += 1
                reports.append({"article_id": article_id, "error": str(exc)})

        return {
            "processed": processed,
            "failed": failed,
            "requested_limit": int(limit),
            "collection_id": collection_id,
            "reports": reports,
        }
