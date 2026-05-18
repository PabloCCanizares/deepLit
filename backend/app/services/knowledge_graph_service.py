"""Servicio de expansión semántica del grafo mediante LLM.

A partir de un artículo construye nodos ``Paper`` y ``Entity`` y sus
relaciones semánticas en Neo4j, utilizando ``LLMGraphTransformer`` con
el esquema definido en :mod:`app.ai_assistant.knowledge_graph.schema`.

El texto que se envía al LLM proviene íntegramente del PDF del artículo.
Si un artículo no tiene PDF asociado se omite.

Se invoca desde :class:`ArticleGraphService.expand_articles`.
"""
import logging
from pathlib import Path
from typing import Dict, List, Optional

from langchain_core.documents import Document
from pymongo import MongoClient

from app.ai_assistant.agents.base_agents.base_agent import BaseAgent
from app.ai_assistant.config import get_knowledge_graph_config
from app.ai_assistant.knowledge_graph.schema import (
    KG_LLM_ALLOWED_RELATIONSHIPS,
    KG_NODE_TYPES,
    KG_RELATIONSHIP_TYPES,
    RELATIONSHIP_RULES,
    node_key,
    normalize_rel_type,
    sanitize_entity_type,
)
from app.config import settings

MAX_LLM_CHUNK_CHARS = 30000
MAX_LLM_CHUNKS = 4

logger = logging.getLogger(__name__)


class KnowledgeGraphService:
    """Pipeline de expansión semántica artículo → grafo."""

    def __init__(self):
        self.mongo = MongoClient(settings.MONGODB_URL)
        self.db = self.mongo[settings.DATABASE_NAME]
        self.articles = self.db["articles"]
        self.pdfs = self.db["pdfs"]

    def close(self) -> None:
        """Cierra la conexión a MongoDB."""
        try:
            self.mongo.close()
        except Exception:
            pass

    def _get_graph(self):
        """Crea un ``Neo4jGraph`` o devuelve ``None`` si Neo4j no está configurado."""
        if not all([settings.NEO4J_URL, settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD]):
            logger.warning("[KG] Neo4j no configurado: NEO4J_URL=%s, user=%s",
                           bool(settings.NEO4J_URL), bool(settings.NEO4J_USERNAME))
            return None
        try:
            from langchain_neo4j import Neo4jGraph

            graph = Neo4jGraph(
                url=settings.NEO4J_URL,
                username=settings.NEO4J_USERNAME,
                password=settings.NEO4J_PASSWORD,
                refresh_schema=False,
            )
            logger.info("[KG] Neo4jGraph conectado a %s", settings.NEO4J_URL)
            return graph
        except Exception as exc:
            logger.warning("[KG] No se pudo conectar a Neo4j via langchain-neo4j: %s", exc)
            return None

    def _build_transformer(self, type_limits: Optional[Dict[str, int]] = None):
        """Construye un ``LLMGraphTransformer`` con el esquema permitido.

        Si se pasa ``type_limits`` se inyecta en las instrucciones para que el
        LLM no devuelva más entidades de las solicitadas por cada tipo.
        """
        from langchain_experimental.graph_transformers import LLMGraphTransformer

        config = get_knowledge_graph_config()
        logger.info(
            "[KG] Construyendo transformer — modelo=%s offline=%s limits=%s",
            config.get("modelo"), config.get("offline"), type_limits,
        )
        llm = BaseAgent(**config, system_prompt="")
        return LLMGraphTransformer(
            llm=llm.get_model(),
            allowed_nodes=KG_NODE_TYPES,
            allowed_relationships=KG_LLM_ALLOWED_RELATIONSHIPS,
            strict_mode=True,
            node_properties=False,
            relationship_properties=False,
            additional_instructions=self._build_llm_instructions(type_limits),
        )

    @staticmethod
    def _build_llm_instructions(type_limits: Optional[Dict[str, int]]) -> str:
        """Genera las instrucciones adicionales al LLM, opcionalmente con cuotas."""
        base = (
            "Estás procesando el texto completo de un artículo científico. "
            "Extrae únicamente entidades y relaciones científicas que aparezcan "
            "explícitamente en el texto (problemas abordados, conceptos, métodos, "
            "modelos, datasets, métricas, hallazgos, limitaciones y organizaciones). "
            "Cada entidad debe usar uno de los tipos permitidos. "
            "El nombre de cada entidad (campo 'id') debe ser una etiqueta lo más "
            "DESCRIPTIVA posible: una frase corta y autoexplicativa en lugar de "
            "una sola palabra (por ejemplo: 'Detección de intrusiones en redes IoT' "
            "en vez de 'detección'). No uses solo el acrónimo si tienes la forma "
            "completa; combina acrónimo y forma completa cuando sea natural "
            "(por ejemplo: 'Transformer multimodal (ViT)'). Evita nombres "
            "genéricos como 'modelo', 'método' o 'algoritmo' sin más contexto."
        )

        if not type_limits:
            return base + (
                " Devuelve únicamente las entidades realmente respaldadas por el "
                "texto: si solo encuentras una entidad de un tipo, devuelve una; "
                "no inventes contenido para rellenar."
            )

        ordered = ", ".join(
            f"{node_type}: máximo {limit}"
            for node_type, limit in type_limits.items()
            if limit is not None
        )
        return base + (
            f" CUOTAS POR TIPO: no devuelvas más entidades de las indicadas por cada "
            f"tipo ({ordered}). Si el texto no contiene suficientes entidades de un "
            "tipo, devuelve menos: si te pido 10 y solo encuentras 5, devuelve 5; "
            "PROHIBIDO inventar entidades para llegar a la cuota. Prioriza las "
            "entidades más importantes y mejor sustentadas por el texto y "
            "ponlas en primer lugar."
        )

    @staticmethod
    def _chunk_text_for_llm(
        text: str,
        article_id: str,
        max_chars: int = MAX_LLM_CHUNK_CHARS,
        max_chunks: int = MAX_LLM_CHUNKS,
    ) -> List[Document]:
        """Trocea el texto del PDF en documentos del tamaño adecuado para el LLM."""
        clean = (text or "").strip()
        if not clean:
            return []
        chunks: List[Document] = []
        for index in range(0, len(clean), max_chars):
            piece = clean[index: index + max_chars].strip()
            if not piece:
                continue
            chunks.append(
                Document(
                    page_content=piece,
                    metadata={
                        "article_id": article_id,
                        "source": f"article:{article_id}",
                        "chunk_index": len(chunks),
                    },
                )
            )
            if len(chunks) >= max_chunks:
                break
        return chunks

    def _resolve_pdf_path(self, article: Dict) -> Optional[Path]:
        """Devuelve la ruta absoluta del PDF asociado al artículo o ``None``."""
        article_id = str(article.get("_id", ""))
        pdf_id = article.get("id_pdf")
        if (
            not pdf_id
            and article.get("source") != "excel"
            and article_id.startswith("article_")
        ):
            pdf_id = article_id[len("article_"):]
        if not pdf_id:
            return None

        pdf_record = self.pdfs.find_one({"_id": pdf_id})
        if not pdf_record:
            return None

        file_path = pdf_record.get("file_path")
        if file_path:
            candidate = Path(file_path)
            if candidate.exists():
                return candidate

        filename = pdf_record.get("filename") or f"{pdf_id}.pdf"
        try:
            from app.services.storage_service import StorageService

            fallback = StorageService().get_path(filename, "uploads")
            if fallback.exists():
                return fallback
        except Exception:
            pass
        return None

    @staticmethod
    def _load_pdf_text(pdf_path: Path) -> str:
        """Extrae el texto íntegro del PDF concatenando todas las páginas."""
        from langchain_community.document_loaders.pdf import PyMuPDFLoader

        loader = PyMuPDFLoader(str(pdf_path), mode="page", extract_tables="markdown")
        pages = loader.load()
        return "\n\n".join((p.page_content or "").strip() for p in pages if p.page_content)

    @staticmethod
    def _upsert_paper_node(
        graph, user_id: str, article_id: str, title: str, collection_ids: List[str],
    ) -> None:
        """Crea o actualiza el nodo ``Paper`` asociado al artículo."""
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

    @staticmethod
    def _upsert_entity_and_mention(
        graph, user_id: str, article_id: str, collection_ids: List[str], node,
    ) -> bool:
        """Crea o actualiza una ``Entity`` y la relación ``MENTIONS`` desde el Paper."""
        key = node_key(node)
        if not key:
            return False
        entity_type = sanitize_entity_type(getattr(node, "type", None))
        entity_name = str(getattr(node, "id", "")).strip()
        if not entity_name:
            return False

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
        return True

    @staticmethod
    def _upsert_relation(
        graph,
        user_id: str,
        article_id: str,
        collection_ids: List[str],
        source_node,
        rel_type: str,
        target_node,
    ) -> bool:
        """Crea o actualiza una relación semántica entre dos entidades."""
        source_key = node_key(source_node)
        target_key = node_key(target_node)
        if not source_key or not target_key or not rel_type:
            return False

        source_type = sanitize_entity_type(getattr(source_node, "type", None))
        target_type = sanitize_entity_type(getattr(target_node, "type", None))
        if (source_type, rel_type, target_type) not in RELATIONSHIP_RULES:
            return False

        graph.query(
            f"""
            MATCH (s:Entity {{user_id: $user_id, entity_key: $source_key}})
            MATCH (t:Entity {{user_id: $user_id, entity_key: $target_key}})
            MERGE (s)-[r:{rel_type} {{user_id: $user_id, article_id: $article_id}}]->(t)
            SET r.collection_ids = $collection_ids,
                r.updated_at = datetime()
            """,
            {
                "user_id": user_id,
                "article_id": article_id,
                "source_key": source_key,
                "target_key": target_key,
                "collection_ids": collection_ids or [],
            },
        )
        return True

    def ingest_documents(
        self,
        user_id: str,
        article_id: str,
        title: str,
        docs: List[Document],
        collection_ids: Optional[List[str]] = None,
        reprocess: bool = False,
        type_limits: Optional[Dict[str, int]] = None,
    ) -> Dict:
        """Convierte los documentos en nodos/relaciones y los persiste en Neo4j.

        Si se pasa ``type_limits`` se aplican dos veces:
          * Como instrucción al LLM (cuotas blandas).
          * Como post-filtro determinista tras la extracción, truncando cada
            tipo al máximo solicitado y descartando las relaciones cuyos
            extremos se hayan eliminado.
        """
        graph = self._get_graph()
        if graph is None:
            logger.warning("[KG] ingest_documents abortado: Neo4j no disponible (article_id=%s)", article_id)
            return {"enabled": False, "message": "Neo4j no configurado"}

        if not docs:
            return {"enabled": False, "message": "Sin documentos para procesar", "article_id": article_id}

        collection_ids = collection_ids or []
        logger.info(
            "[KG] Llamando al LLM para artículo '%s' (article_id=%s, docs=%d, chars=%d, limits=%s)",
            (title or "")[:60], article_id, len(docs),
            sum(len(d.page_content or "") for d in docs), type_limits,
        )

        try:
            transformer = self._build_transformer(type_limits)
        except Exception as exc:
            logger.error("[KG] No se pudo construir el transformer (article_id=%s): %s", article_id, exc)
            return {"enabled": False, "message": f"Transformer: {exc}", "article_id": article_id}

        try:
            graph_documents = transformer.convert_to_graph_documents(docs)
        except Exception as exc:
            logger.error("[KG] Error en convert_to_graph_documents (article_id=%s): %s", article_id, exc)
            return {"enabled": False, "message": f"Error LLM: {exc}", "article_id": article_id}

        nodes, relations = self._collect_unique_nodes_and_relations(graph_documents)
        logger.info(
            "[KG] LLM devolvió %d nodos únicos y %d relaciones únicas (article_id=%s)",
            len(nodes), len(relations), article_id,
        )

        nodes, relations = self._apply_type_limits(nodes, relations, type_limits)
        if type_limits:
            logger.info(
                "[KG] Tras aplicar cuotas: %d nodos, %d relaciones (article_id=%s)",
                len(nodes), len(relations), article_id,
            )

        if not nodes:
            return {
                "enabled": True, "article_id": article_id,
                "nodes": 0, "relations": 0,
                "message": "El LLM no extrajo entidades",
            }

        self._upsert_paper_node(graph, user_id, article_id, title, collection_ids)
        if reprocess:
            self._clear_paper_relations(graph, user_id, article_id)

        persisted_nodes = 0
        for node in nodes:
            if self._upsert_entity_and_mention(graph, user_id, article_id, collection_ids, node):
                persisted_nodes += 1

        persisted_rels = 0
        for rel in relations:
            if self._upsert_relation(
                graph=graph,
                user_id=user_id,
                article_id=article_id,
                collection_ids=collection_ids,
                source_node=getattr(rel, "source", None),
                rel_type=normalize_rel_type(getattr(rel, "type", None)),
                target_node=getattr(rel, "target", None),
            ):
                persisted_rels += 1

        return {
            "enabled": True, "article_id": article_id,
            "nodes": persisted_nodes, "relations": persisted_rels,
        }

    @staticmethod
    def _collect_unique_nodes_and_relations(graph_documents):
        """Deduplica nodos por ``node_key`` y relaciones por (src,rel,tgt)."""
        seen_nodes = {}
        nodes = []
        for graph_doc in graph_documents:
            for node in (getattr(graph_doc, "nodes", []) or []):
                key = node_key(node)
                if not key or key in seen_nodes:
                    continue
                seen_nodes[key] = True
                nodes.append(node)

        seen_rels = set()
        relations = []
        for graph_doc in graph_documents:
            for rel in (getattr(graph_doc, "relationships", []) or []):
                src_key = node_key(getattr(rel, "source", None))
                tgt_key = node_key(getattr(rel, "target", None))
                rel_type = (getattr(rel, "type", None) or "").upper()
                if not src_key or not tgt_key or not rel_type:
                    continue
                triple = (src_key, rel_type, tgt_key)
                if triple in seen_rels:
                    continue
                seen_rels.add(triple)
                relations.append(rel)
        return nodes, relations

    @staticmethod
    def _apply_type_limits(nodes, relations, type_limits: Optional[Dict[str, int]]):
        """Trunca cada tipo de nodo al máximo solicitado y limpia relaciones colgantes."""
        if not type_limits:
            return nodes, relations

        counts: Dict[str, int] = {}
        kept_keys = set()
        kept_nodes = []
        for node in nodes:
            entity_type = sanitize_entity_type(getattr(node, "type", None))
            limit = type_limits.get(entity_type)
            current = counts.get(entity_type, 0)
            if limit is not None and current >= limit:
                continue
            counts[entity_type] = current + 1
            kept_keys.add(node_key(node))
            kept_nodes.append(node)

        kept_relations = [
            rel for rel in relations
            if node_key(getattr(rel, "source", None)) in kept_keys
            and node_key(getattr(rel, "target", None)) in kept_keys
        ]
        return kept_nodes, kept_relations

    @staticmethod
    def _clear_paper_relations(graph, user_id: str, article_id: str) -> None:
        """Borra MENTIONS y aristas semánticas asociadas a un artículo."""
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

    def ingest_article_record(
        self,
        article: Dict,
        user_id: str,
        reprocess: bool = False,
        type_limits: Optional[Dict[str, int]] = None,
    ) -> Dict:
        """Expande semánticamente un artículo usando el contenido completo de su PDF.

        Si el artículo no tiene PDF asociado (o el archivo ya no existe) se
        devuelve ``{"enabled": False, "skipped": True, ...}`` para que el
        orquestador lo trate como omitido y siga con el siguiente artículo.
        """
        article_id = str(article.get("_id", ""))
        if not article_id:
            return {"enabled": False, "skipped": True, "message": "Articulo sin _id"}

        pdf_path = self._resolve_pdf_path(article)
        if pdf_path is None:
            logger.info("[KG] Artículo %s sin PDF asociado: se omite", article_id)
            return {
                "enabled": False, "skipped": True, "article_id": article_id,
                "message": "Sin PDF asociado",
            }

        try:
            text = self._load_pdf_text(pdf_path)
        except Exception as exc:
            logger.warning("[KG] No se pudo leer el PDF %s del artículo %s: %s",
                           pdf_path, article_id, exc)
            return {
                "enabled": False, "skipped": True, "article_id": article_id,
                "message": f"Error leyendo PDF: {exc}",
            }

        if not text.strip():
            logger.info("[KG] PDF de artículo %s vacío tras la extracción: se omite", article_id)
            return {
                "enabled": False, "skipped": True, "article_id": article_id,
                "message": "PDF sin texto extraíble",
            }

        docs = self._chunk_text_for_llm(text=text, article_id=article_id)
        if not docs:
            return {
                "enabled": False, "skipped": True, "article_id": article_id,
                "message": "Sin contenido para procesar",
            }

        return self.ingest_documents(
            user_id=user_id,
            article_id=article_id,
            title=article.get("title", ""),
            docs=docs,
            collection_ids=article.get("collection_ids", []) or [],
            reprocess=reprocess,
            type_limits=type_limits,
        )

    def diagnose(self) -> Dict:
        """Ejecuta checks paso a paso y devuelve un informe de diagnóstico."""
        report: Dict = {}

        # 1. Neo4j config present?
        report["neo4j_config"] = {
            "url":      bool(settings.NEO4J_URL),
            "username": bool(settings.NEO4J_USERNAME),
            "password": bool(settings.NEO4J_PASSWORD),
        }

        # 2. Neo4j langchain connection
        try:
            graph = self._get_graph()
            report["neo4j_langchain"] = "ok" if graph is not None else "fallo: _get_graph() devolvió None"
        except Exception as exc:
            report["neo4j_langchain"] = f"excepción: {exc}"
            graph = None

        # 3. Build transformer (LLM config)
        try:
            config = get_knowledge_graph_config()
            report["llm_config"] = {"modelo": config.get("modelo"), "offline": config.get("offline")}
            transformer = self._build_transformer()
            report["transformer_build"] = "ok"
        except Exception as exc:
            report["transformer_build"] = f"excepción: {exc}"
            transformer = None

        # 4. Test extraction on trivial text
        if transformer is not None:
            test_text = (
                "Este paper propone un modelo Transformer para resolver el problema de "
                "clasificación de texto usando el dataset IMDB. "
                "El modelo construye sobre BERT y fue evaluado con F1-score."
            )
            try:
                docs = [Document(page_content=test_text)]
                graph_docs = transformer.convert_to_graph_documents(docs)
                nodes = [{"id": getattr(n, "id", ""), "type": getattr(n, "type", "")}
                         for gd in graph_docs for n in (getattr(gd, "nodes", []) or [])]
                rels  = [{"source": getattr(getattr(r, "source", None), "id", ""),
                          "type":   getattr(r, "type", ""),
                          "target": getattr(getattr(r, "target", None), "id", "")}
                         for gd in graph_docs for r in (getattr(gd, "relationships", []) or [])]
                report["test_extraction"] = {"nodes": nodes, "relations": rels, "error": None}
            except Exception as exc:
                report["test_extraction"] = {"nodes": [], "relations": [], "error": str(exc)}
        else:
            report["test_extraction"] = {"nodes": [], "relations": [], "error": "transformer no disponible"}

        return report

