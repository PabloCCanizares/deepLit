"""Repositorio del grafo de artículos en Neo4j.

Encapsula todas las operaciones Cypher contra Neo4j para el grafo del
usuario (Article, Author, Keyword, Category, Type y nodos semánticos
Entity). Toda la lectura se realiza tratando las aristas como **no
dirigidas** para que el enrutador del frontend no dependa del sentido
de la relación.
"""
from contextlib import contextmanager
from typing import Any, Dict, List, Optional

from app.config import settings


class ArticleGraphRepository:
    """Repositorio sincrónico para Neo4j (no-op si Neo4j no está configurado)."""

    ARTICLE_LABEL = "Article"
    AUTHOR_LABEL = "Author"
    KEYWORD_LABEL = "Keyword"
    CATEGORY_LABEL = "Category"
    TYPE_LABEL = "Type"

    REL_WROTE = "WROTE"
    REL_HAS_KEYWORD = "HAS_KEYWORD"
    REL_IN_CATEGORY = "IN_CATEGORY"
    REL_OF_TYPE = "OF_TYPE"

    EMBEDDING_PROPERTY = "fastrp_embedding"
    TEXT_EMBEDDING_PROPERTY = "text_embedding"
    EMBEDDING_DIM = 128

    SEMANTIC_WEIGHT = 0.8
    STRUCTURAL_WEIGHT = 0.2

    _NODE_LABEL_ES = {
        "Article":  "Artículo",
        "Author":   "Autor",
        "Keyword":  "PalabraClave",
        "Category": "Categoría",
        "Type":     "Tipo",
    }
    _REL_TYPE_ES = {
        "WROTE":        "ESCRIBE",
        "HAS_KEYWORD":  "TIENE_KEYWORD",
        "IN_CATEGORY":  "EN_CATEGORIA",
        "OF_TYPE":      "ES_TIPO",
        "MENTIONS":     "MENCIONA",
    }

    _BASE_NODE_LABELS = ("Article", "Author", "Keyword", "Category", "Type")
    _ORPHAN_LABELS = ("Author", "Keyword", "Category", "Type")

    def __init__(self):
        self._driver = None
        self._gds_support_cache: Optional[bool] = None

    def is_available(self) -> bool:
        """Indica si Neo4j está configurado y accesible."""
        return self._get_driver() is not None

    def close(self) -> None:
        """Cierra el driver si está abierto."""
        if self._driver is None:
            return
        try:
            self._driver.close()
        except Exception:
            pass
        self._driver = None

    def _get_driver(self):
        """Obtiene (o crea) el driver de Neo4j de forma perezosa."""
        if self._driver is not None:
            return self._driver

        if not all([settings.NEO4J_URL, settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD]):
            return None

        try:
            from neo4j import GraphDatabase

            self._driver = GraphDatabase.driver(
                settings.NEO4J_URL,
                auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD),
            )
            self._driver.verify_connectivity()
            return self._driver
        except Exception:
            self._driver = None
            return None

    @contextmanager
    def _session(self):
        """Abre una sesión Neo4j o produce ``None`` si no está disponible."""
        driver = self._get_driver()
        if driver is None:
            yield None
            return
        with driver.session() as session:
            yield session

    def upsert_article_graph(
        self,
        user_id: str,
        article_id: str,
        title: str,
        authors: List[str],
        keywords: List[str],
        category: Optional[str],
        article_type: Optional[str],
        year: Optional[int] = None,
        abstract: Optional[str] = None,
    ) -> bool:
        """Inserta o actualiza un artículo con todos sus nodos relacionados."""
        if not user_id or not article_id:
            return False

        normalized_title = (title or "").strip() or "Sin título"
        normalized_authors = [a.strip() for a in (authors or []) if isinstance(a, str) and a.strip()]
        normalized_keywords = [k.strip() for k in (keywords or []) if isinstance(k, str) and k.strip()]
        normalized_category = (category or "").strip() or None
        normalized_type = (article_type or "").strip() or None
        normalized_abstract = (abstract or "").strip() or None

        with self._session() as session:
            if session is None:
                return False

            session.execute_write(
                self._tx_upsert_article,
                user_id=user_id,
                article_id=article_id,
                title=normalized_title,
                year=year,
                abstract=normalized_abstract,
            )
            for author in normalized_authors:
                session.execute_write(
                    self._tx_upsert_author, user_id=user_id, article_id=article_id, name=author,
                )
            for keyword in normalized_keywords:
                session.execute_write(
                    self._tx_upsert_keyword, user_id=user_id, article_id=article_id, keyword=keyword,
                )
            if normalized_category:
                session.execute_write(
                    self._tx_upsert_category,
                    user_id=user_id, article_id=article_id, category=normalized_category,
                )
            if normalized_type:
                session.execute_write(
                    self._tx_upsert_type,
                    user_id=user_id, article_id=article_id, article_type=normalized_type,
                )

        return True

    @staticmethod
    def _tx_upsert_article(tx, user_id, article_id, title, year, abstract):
        tx.run(
            """
            MERGE (a:Article {user_id: $user_id, article_id: $article_id})
            SET a.title = $title,
                a.year = $year,
                a.abstract = $abstract,
                a.updated_at = datetime()
            """,
            user_id=user_id, article_id=article_id, title=title, year=year, abstract=abstract,
        )

    @staticmethod
    def _tx_upsert_author(tx, user_id, article_id, name):
        tx.run(
            """
            MERGE (auth:Author {user_id: $user_id, name_lower: $name_lower})
            SET auth.name = $name
            WITH auth
            MATCH (a:Article {user_id: $user_id, article_id: $article_id})
            MERGE (auth)-[:WROTE]->(a)
            """,
            user_id=user_id, article_id=article_id, name=name, name_lower=name.lower(),
        )

    @staticmethod
    def _tx_upsert_keyword(tx, user_id, article_id, keyword):
        tx.run(
            """
            MERGE (k:Keyword {user_id: $user_id, key_lower: $key_lower})
            SET k.key = $keyword
            WITH k
            MATCH (a:Article {user_id: $user_id, article_id: $article_id})
            MERGE (a)-[:HAS_KEYWORD]->(k)
            """,
            user_id=user_id, article_id=article_id, keyword=keyword, key_lower=keyword.lower(),
        )

    @staticmethod
    def _tx_upsert_category(tx, user_id, article_id, category):
        tx.run(
            """
            MERGE (c:Category {user_id: $user_id, name_lower: $name_lower})
            SET c.name = $category
            WITH c
            MATCH (a:Article {user_id: $user_id, article_id: $article_id})
            MERGE (a)-[:IN_CATEGORY]->(c)
            """,
            user_id=user_id, article_id=article_id, category=category, name_lower=category.lower(),
        )

    @staticmethod
    def _tx_upsert_type(tx, user_id, article_id, article_type):
        tx.run(
            """
            MERGE (t:Type {user_id: $user_id, name_lower: $name_lower})
            SET t.name = $article_type
            WITH t
            MATCH (a:Article {user_id: $user_id, article_id: $article_id})
            MERGE (a)-[:OF_TYPE]->(t)
            """,
            user_id=user_id, article_id=article_id, article_type=article_type,
            name_lower=article_type.lower(),
        )

    def delete_article(self, user_id: str, article_id: str) -> bool:
        """Elimina un artículo, su Paper semántico asociado y nodos huérfanos."""
        if not user_id or not article_id:
            return False

        with self._session() as session:
            if session is None:
                return False
            session.execute_write(self._tx_delete_article, user_id=user_id, article_id=article_id)
        return True

    @staticmethod
    def _tx_delete_article(tx, user_id, article_id):
        tx.run(
            """
            MATCH (a:Article {user_id: $user_id, article_id: $article_id})
            DETACH DELETE a
            """,
            user_id=user_id, article_id=article_id,
        )
        tx.run(
            """
            MATCH (p:Paper {user_id: $user_id, article_id: $article_id})
            DETACH DELETE p
            """,
            user_id=user_id, article_id=article_id,
        )
        tx.run(
            """
            MATCH (n)
            WHERE (n:Author OR n:Keyword OR n:Category OR n:Type OR n:Entity)
              AND n.user_id = $user_id
              AND NOT (n)--()
            DELETE n
            """,
            user_id=user_id,
        )

    def get_user_graph(self, user_id: str, limit: int = 250) -> Dict[str, list]:
        """Devuelve los nodos y relaciones (no dirigidas) del grafo del usuario."""
        if not user_id:
            return {"nodes": [], "edges": []}

        with self._session() as session:
            if session is None:
                return {"nodes": [], "edges": []}
            nodes = session.execute_read(self._tx_fetch_nodes, user_id=user_id, limit=limit)
            edges = session.execute_read(self._tx_fetch_edges, user_id=user_id, limit=limit * 4)

        return {"nodes": nodes, "edges": edges}

    @staticmethod
    def _tx_fetch_nodes(tx, user_id, limit):
        result = tx.run(
            """
            MATCH (n)
            WHERE (n:Article OR n:Author OR n:Keyword OR n:Category OR n:Type)
              AND n.user_id = $user_id
            RETURN
                elementId(n)                          AS id,
                labels(n)                             AS labels,
                coalesce(n.title, n.name, n.key, '') AS label,
                n.article_id                          AS article_id,
                n.year                                AS year
            LIMIT $limit
            """,
            user_id=user_id, limit=int(limit),
        )
        nodes: List[Dict] = []
        for record in result:
            labels = list(record.get("labels") or [])
            primary_label = labels[0] if labels else "Node"
            primary_label = ArticleGraphRepository._NODE_LABEL_ES.get(primary_label, primary_label)
            nodes.append({
                "id": record["id"],
                "type": primary_label,
                "label": record.get("label") or primary_label,
                "article_id": record.get("article_id"),
                "year": record.get("year"),
            })
        return nodes

    @staticmethod
    def _tx_fetch_edges(tx, user_id, limit):
        result = tx.run(
            """
            MATCH (s)-[r]-(t)
            WHERE s.user_id = $user_id AND t.user_id = $user_id
              AND elementId(s) < elementId(t)
            RETURN
                elementId(s) AS source,
                elementId(t) AS target,
                type(r)      AS type
            LIMIT $limit
            """,
            user_id=user_id, limit=int(limit),
        )
        edges: List[Dict] = []
        for record in result:
            rel_type = ArticleGraphRepository._REL_TYPE_ES.get(record["type"], record["type"])
            edges.append({
                "source": record["source"],
                "target": record["target"],
                "type": rel_type,
            })
        return edges

    def get_kg_nodes_and_edges(self, user_id: str, limit: int = 500) -> Dict[str, list]:
        """Devuelve los nodos Entity del KG semántico y sus aristas no dirigidas."""
        with self._session() as session:
            if session is None:
                return {"nodes": [], "edges": []}

            nodes_result = session.run(
                """
                MATCH (e:Entity {user_id: $user_id})
                RETURN
                    elementId(e)  AS id,
                    e.name        AS label,
                    e.entity_type AS entity_type,
                    e.entity_key  AS entity_key
                LIMIT $limit
                """,
                user_id=user_id, limit=int(limit),
            )
            nodes = [
                {
                    "id": r["id"],
                    "type": r["entity_type"] or "Concepto",
                    "label": r["label"] or "?",
                    "entity_key": r["entity_key"] or "",
                }
                for r in nodes_result
            ]

            edges: List[Dict] = []
            sem_result = session.run(
                """
                MATCH (s:Entity {user_id: $user_id})-[r]-(t:Entity {user_id: $user_id})
                WHERE elementId(s) < elementId(t)
                RETURN
                    elementId(s) AS source,
                    elementId(t) AS target,
                    type(r)      AS rel_type
                LIMIT $limit
                """,
                user_id=user_id, limit=int(limit * 4),
            )
            for r in sem_result:
                edges.append({"source": r["source"], "target": r["target"], "type": r["rel_type"]})

            bridge_result = session.run(
                """
                MATCH (a:Article {user_id: $user_id})
                MATCH (p:Paper {user_id: $user_id})-[:MENTIONS]-(e:Entity {user_id: $user_id})
                WHERE p.article_id = a.article_id
                RETURN elementId(a) AS source, elementId(e) AS target
                LIMIT $limit
                """,
                user_id=user_id, limit=int(limit * 4),
            )
            for r in bridge_result:
                edges.append({"source": r["source"], "target": r["target"], "type": "MENCIONA"})

            return {"nodes": nodes, "edges": edges}

    def get_expanded_article_ids(self, user_id: str) -> set:
        """Devuelve los article_id ya expandidos (Paper con al menos un MENTIONS).

        Los Paper "vacíos" (sin entidades asociadas, generados por intentos
        fallidos previos) no se consideran expandidos, de modo que esos
        artículos se vuelven a procesar en la siguiente expansión.
        """
        with self._session() as session:
            if session is None:
                return set()
            result = session.run(
                """
                MATCH (p:Paper {user_id: $user_id})-[:MENTIONS]->(:Entity)
                RETURN DISTINCT p.article_id AS article_id
                """,
                user_id=user_id,
            )
            return {r["article_id"] for r in result if r["article_id"]}

    def cleanup_naked_papers(self, user_id: str) -> int:
        """Elimina nodos ``Paper`` sin MENTIONS (residuos de expansiones fallidas)."""
        with self._session() as session:
            if session is None:
                return 0
            result = session.run(
                """
                MATCH (p:Paper {user_id: $user_id})
                WHERE NOT (p)-[:MENTIONS]->(:Entity)
                DETACH DELETE p
                """,
                user_id=user_id,
            )
            summary = result.consume()
            return summary.counters.nodes_deleted

    def get_user_graph_stats(self, user_id: str) -> Dict[str, int]:
        """Devuelve un resumen de cardinalidad del grafo del usuario."""
        empty = {"articles": 0, "authors": 0, "keywords": 0, "categories": 0, "types": 0, "relationships": 0}
        if not user_id:
            return empty
        with self._session() as session:
            if session is None:
                return empty
            return session.execute_read(self._tx_fetch_stats, user_id=user_id)

    @staticmethod
    def _tx_fetch_stats(tx, user_id):
        def _count(query):
            return int(tx.run(query, user_id=user_id).single()["total"] or 0)

        return {
            "articles":   _count("MATCH (n:Article {user_id: $user_id}) RETURN count(n) AS total"),
            "authors":    _count("MATCH (n:Author {user_id: $user_id}) RETURN count(n) AS total"),
            "keywords":   _count("MATCH (n:Keyword {user_id: $user_id}) RETURN count(n) AS total"),
            "categories": _count("MATCH (n:Category {user_id: $user_id}) RETURN count(n) AS total"),
            "types":      _count("MATCH (n:Type {user_id: $user_id}) RETURN count(n) AS total"),
            "relationships": _count(
                """
                MATCH (s)-[r]-(t)
                WHERE s.user_id = $user_id AND t.user_id = $user_id
                  AND elementId(s) < elementId(t)
                RETURN count(r) AS total
                """
            ),
        }

    @staticmethod
    def _gds_graph_name(user_id: str) -> str:
        """Nombre único y seguro (alfanumérico + _) para la proyección GDS."""
        safe = "".join(c if c.isalnum() else "_" for c in str(user_id))
        return f"ag_sim_{safe}"

    def gds_project_graph(self, user_id: str) -> Dict[str, Any]:
        """Proyecta el subgrafo del usuario en memoria GDS como no dirigido."""
        graph_name = self._gds_graph_name(user_id)
        with self._session() as session:
            if session is None:
                raise RuntimeError("Neo4j no disponible")
            record = session.run(
                """
                CALL gds.graph.project.cypher(
                  $graphName,
                  'MATCH (n) WHERE n.user_id = $uid RETURN id(n) AS id',
                  'MATCH (s)-[r]->(t)
                   WHERE s.user_id = $uid AND t.user_id = $uid
                   RETURN id(s) AS source, id(t) AS target, type(r) AS relType
                   UNION
                   MATCH (s)-[r]->(t)
                   WHERE s.user_id = $uid AND t.user_id = $uid
                   RETURN id(t) AS source, id(s) AS target, type(r) AS relType',
                  { parameters: { uid: $userId } }
                )
                YIELD graphName, nodeCount, relationshipCount
                RETURN graphName, nodeCount, relationshipCount
                """,
                graphName=graph_name, userId=user_id,
            ).single()
            return {
                "graph_name": record["graphName"],
                "node_count": record["nodeCount"],
                "relationship_count": record["relationshipCount"],
            }

    def gds_drop_graph(self, user_id: str) -> None:
        """Elimina la proyección GDS. Silencioso si no existe."""
        graph_name = self._gds_graph_name(user_id)
        with self._session() as session:
            if session is None:
                return
            session.run(
                "CALL gds.graph.drop($graphName, false) YIELD graphName",
                graphName=graph_name,
            )

    def has_gds_support(self) -> bool:
        """Indica si la instancia Neo4j expone las funciones GDS usadas aquí."""
        if self._gds_support_cache is not None:
            return self._gds_support_cache

        with self._session() as session:
            if session is None:
                self._gds_support_cache = False
                return False
            try:
                procedures = session.run(
                    """
                    SHOW PROCEDURES YIELD name
                    WHERE name IN [
                      'gds.graph.project.cypher',
                      'gds.graph.drop',
                      'gds.fastRP.write'
                    ]
                    RETURN count(*) AS count
                    """
                ).single()
                functions = session.run(
                    """
                    SHOW FUNCTIONS YIELD name
                    WHERE name = 'gds.similarity.cosine'
                    RETURN count(*) AS count
                    """
                ).single()
                result = (procedures and procedures["count"] == 3) and (functions and functions["count"] == 1)
            except Exception:
                result = False

        self._gds_support_cache = bool(result)
        return self._gds_support_cache

    def get_nodes_needing_embeddings(self, user_id: str) -> List[Dict[str, Any]]:
        """Devuelve los nodos del usuario sin embedding FastRP, con texto representativo."""
        prop = self.EMBEDDING_PROPERTY
        with self._session() as session:
            if session is None:
                return []
            result = session.run(
                f"""
                MATCH (n)
                WHERE n.user_id = $userId
                  AND (n:Article OR n:Author OR n:Keyword OR n:Category OR n:Type OR n:Entity)
                  AND n.{prop} IS NULL
                RETURN
                  elementId(n)                         AS neo4j_id,
                  labels(n)[0]                         AS label_type,
                  coalesce(n.title, n.name, n.key, '') AS text
                """,
                userId=user_id,
            )
            return [
                {"neo4j_id": r["neo4j_id"], "label_type": r["label_type"], "text": r["text"]}
                for r in result
            ]

    def get_all_article_embeddings(self, user_id: str) -> List[Dict[str, Any]]:
        """Devuelve metadatos y ambos embeddings de todos los artículos del usuario.

        Retorna ``text_embedding`` (semántico, 80%) y ``fastrp_embedding``
        (estructural de grafo, 20%) por separado para permitir la mezcla ponderada.
        """
        text_prop = self.TEXT_EMBEDDING_PROPERTY
        fastrp_prop = self.EMBEDDING_PROPERTY
        with self._session() as session:
            if session is None:
                return []
            result = session.run(
                f"""
                MATCH (a:Article {{user_id: $userId}})
                WHERE a.{text_prop} IS NOT NULL OR a.{fastrp_prop} IS NOT NULL
                RETURN
                  a.article_id          AS article_id,
                  coalesce(a.title, '') AS title,
                  a.year                AS year,
                  a.{text_prop}         AS text_embedding,
                  a.{fastrp_prop}       AS fastrp_embedding
                """,
                userId=user_id,
            )
            return [
                {
                    "article_id": str(r["article_id"]),
                    "title": r["title"] or "",
                    "year": r["year"],
                    "text_embedding":   list(r["text_embedding"])   if r["text_embedding"]   is not None else None,
                    "fastrp_embedding": list(r["fastrp_embedding"]) if r["fastrp_embedding"] is not None else None,
                }
                for r in result
            ]

    def get_article_neighborhood(
        self, user_id: str, article_ids: List[str],
    ) -> List[Dict[str, Any]]:
        """Devuelve autores, keywords, categorías y tipos conectados a los artículos."""
        if not article_ids:
            return []
        with self._session() as session:
            if session is None:
                return []
            result = session.run(
                """
                MATCH (a:Article {user_id: $userId})
                WHERE a.article_id IN $articleIds
                OPTIONAL MATCH (a)-[:WROTE]-(author:Author {user_id: $userId})
                OPTIONAL MATCH (a)-[:HAS_KEYWORD]-(kw:Keyword {user_id: $userId})
                OPTIONAL MATCH (a)-[:IN_CATEGORY]-(cat:Category {user_id: $userId})
                OPTIONAL MATCH (a)-[:OF_TYPE]-(typ:Type {user_id: $userId})
                OPTIONAL MATCH (p:Paper {user_id: $userId, article_id: a.article_id})-[:MENTIONS]->(e:Entity {user_id: $userId})
                OPTIONAL MATCH (e)-[r2:RESUELVE|CONSTRUYE_SOBRE|USADO_PARA|RELACIONADO_CON|APOYA|CONTRADICE]->(e2:Entity {user_id: $userId})
                RETURN
                  a.article_id                                     AS article_id,
                  coalesce(a.title, '')                            AS title,
                  a.year                                           AS year,
                  collect(DISTINCT author.name)                    AS authors,
                  collect(DISTINCT kw.key)                         AS keywords,
                  collect(DISTINCT cat.name)                       AS categories,
                  collect(DISTINCT typ.name)                       AS types,
                  collect(DISTINCT {name: e.name, type: e.entity_type}) AS entities,
                  collect(DISTINCT {source: e.name, rel: type(r2), target: e2.name}) AS relations
                """,
                userId=user_id, articleIds=article_ids,
            )
            return [
                {
                    "article_id": str(r["article_id"]),
                    "title": r["title"] or "",
                    "year": r["year"],
                    "authors": [x for x in r["authors"] if x],
                    "keywords": [x for x in r["keywords"] if x],
                    "categories": [x for x in r["categories"] if x],
                    "types": [x for x in r["types"] if x],
                    "entities": [
                        {"name": e["name"], "type": e["type"]}
                        for e in (r["entities"] or [])
                        if e and e.get("name")
                    ],
                    "relations": [
                        {"source": rel["source"], "rel": rel["rel"], "target": rel["target"]}
                        for rel in (r["relations"] or [])
                        if rel and rel.get("source") and rel.get("rel") and rel.get("target")
                    ],
                }
                for r in result
            ]

    def get_articles_needing_text_embeddings(self, user_id: str) -> List[Dict[str, Any]]:
        """Devuelve artículos sin ``text_embedding`` con título, abstract y keywords."""
        prop = self.TEXT_EMBEDDING_PROPERTY
        with self._session() as session:
            if session is None:
                return []
            result = session.run(
                f"""
                MATCH (a:Article {{user_id: $userId}})
                WHERE a.{prop} IS NULL
                OPTIONAL MATCH (a)-[:HAS_KEYWORD]-(kw:Keyword {{user_id: $userId}})
                RETURN
                  elementId(a)             AS neo4j_id,
                  a.article_id             AS article_id,
                  coalesce(a.title, '')    AS title,
                  coalesce(a.abstract, '') AS abstract,
                  collect(DISTINCT kw.key) AS keywords
                """,
                userId=user_id,
            )
            return [
                {
                    "neo4j_id": r["neo4j_id"],
                    "article_id": str(r["article_id"]),
                    "title": r["title"] or "",
                    "abstract": r["abstract"] or "",
                    "keywords": [k for k in (r["keywords"] or []) if k],
                }
                for r in result
            ]

    def write_article_text_embeddings(self, pairs: List[Dict[str, Any]]) -> int:
        """Escribe ``text_embedding`` en los nodos Article indicados."""
        return self._write_node_property(pairs, self.TEXT_EMBEDDING_PROPERTY)

    def write_node_embeddings(self, pairs: List[Dict[str, Any]]) -> int:
        """Escribe ``fastrp_embedding`` en los nodos indicados."""
        return self._write_node_property(pairs, self.EMBEDDING_PROPERTY)

    def _write_node_property(self, pairs: List[Dict[str, Any]], prop: str) -> int:
        """Escribe la propiedad ``prop`` con el vector en cada nodo de ``pairs``."""
        if not pairs:
            return 0
        with self._session() as session:
            if session is None:
                return 0
            session.run(
                f"""
                UNWIND $pairs AS pair
                MATCH (n)
                WHERE elementId(n) = pair.id
                SET n.{prop} = pair.vec
                """,
                pairs=pairs,
            )
        return len(pairs)

    def gds_compute_embeddings(self, user_id: str) -> Dict[str, Any]:
        """Proyecta el grafo, ejecuta FastRP en modo *write* y limpia la proyección."""
        if not self.has_gds_support():
            return {
                "node_count": 0,
                "relationship_count": 0,
                "embeddings_written": 0,
                "compute_ms": 0,
                "mode": "neighbor-overlap",
            }

        self.gds_drop_graph(user_id)
        graph_name = self._gds_graph_name(user_id)
        projection = self.gds_project_graph(user_id)

        if projection["node_count"] == 0:
            return {
                "node_count": 0,
                "relationship_count": 0,
                "embeddings_written": 0,
                "compute_ms": 0,
            }

        with self._session() as session:
            if session is None:
                raise RuntimeError("Neo4j no disponible")
            record = session.run(
                """
                CALL gds.fastRP.write(
                  $graphName,
                  {
                    embeddingDimension: $dim,
                    iterationWeights: [0.8, 1.0, 1.0],
                    normalizationStrength: 0.05,
                    randomSeed: 42,
                    writeProperty: $prop
                  }
                )
                YIELD nodePropertiesWritten, computeMillis
                RETURN nodePropertiesWritten, computeMillis
                """,
                graphName=graph_name, dim=self.EMBEDDING_DIM, prop=self.EMBEDDING_PROPERTY,
            ).single()

        self.gds_drop_graph(user_id)

        return {
            "node_count": projection["node_count"],
            "relationship_count": projection["relationship_count"],
            "embeddings_written": record["nodePropertiesWritten"],
            "compute_ms": record["computeMillis"],
        }

    def find_similar_nodes(
        self,
        user_id: str,
        node_label: str,
        node_id_prop: str,
        node_id_value: str,
        label_prop: str,
        min_similarity: float = 0.7,
        top_k: int = 10,
    ) -> List[Dict[str, Any]]:
        """Devuelve nodos similares al nodo dado usando coseno sobre los embeddings."""
        if self.has_gds_support():
            return self._find_similar_with_gds(
                user_id=user_id,
                node_label=node_label,
                node_id_prop=node_id_prop,
                node_id_value=node_id_value,
                label_prop=label_prop,
                min_similarity=min_similarity,
                top_k=top_k,
            )
        return self._find_similar_without_gds(
            user_id=user_id,
            node_label=node_label,
            node_id_prop=node_id_prop,
            node_id_value=node_id_value,
            label_prop=label_prop,
            min_similarity=min_similarity,
            top_k=top_k,
        )

    def _find_similar_with_gds(
        self,
        user_id: str,
        node_label: str,
        node_id_prop: str,
        node_id_value: str,
        label_prop: str,
        min_similarity: float,
        top_k: int,
    ) -> List[Dict[str, Any]]:
        """Similitud combinada usando ``gds.similarity.cosine``.

        Para artículos se mezclan el embedding semántico (texto del PDF) y el
        estructural (FastRP) con pesos :attr:`SEMANTIC_WEIGHT` y
        :attr:`STRUCTURAL_WEIGHT`. Para el resto de tipos de nodo se usa el
        único embedding disponible (``fastrp_embedding``).
        """
        if node_label == self.ARTICLE_LABEL:
            cypher = self._article_similarity_cypher(node_id_prop, label_prop)
        else:
            cypher = self._generic_similarity_cypher(node_label, node_id_prop, label_prop)

        with self._session() as session:
            if session is None:
                raise RuntimeError("Neo4j no disponible")
            result = session.run(
                cypher,
                userId=user_id, idValue=node_id_value,
                minSim=float(min_similarity), topK=int(top_k),
                wSem=float(self.SEMANTIC_WEIGHT),
                wStr=float(self.STRUCTURAL_WEIGHT),
            )
            return [
                {
                    "node_id": r["node_id"],
                    "label": r["label"],
                    "similarity_score": round(float(r["score"]), 4),
                    "semantic_score": (
                        round(float(r["text_score"]), 4) if r.get("text_score") is not None else None
                    ),
                    "structural_score": (
                        round(float(r["struct_score"]), 4) if r.get("struct_score") is not None else None
                    ),
                }
                for r in result
            ]

    def _article_similarity_cypher(self, node_id_prop: str, label_prop: str) -> str:
        """Cypher para similitud combinada (semántica + estructural) entre artículos."""
        text_prop = self.TEXT_EMBEDDING_PROPERTY
        fastrp_prop = self.EMBEDDING_PROPERTY
        return f"""
            MATCH (source:Article {{user_id: $userId, {node_id_prop}: $idValue}})
            WHERE source.{text_prop} IS NOT NULL OR source.{fastrp_prop} IS NOT NULL
            MATCH (candidate:Article {{user_id: $userId}})
            WHERE candidate.{node_id_prop} <> $idValue
              AND (candidate.{text_prop} IS NOT NULL OR candidate.{fastrp_prop} IS NOT NULL)
            WITH source, candidate,
                 CASE
                   WHEN source.{text_prop} IS NOT NULL AND candidate.{text_prop} IS NOT NULL
                     THEN gds.similarity.cosine(source.{text_prop}, candidate.{text_prop})
                   ELSE NULL
                 END AS text_score,
                 CASE
                   WHEN source.{fastrp_prop} IS NOT NULL AND candidate.{fastrp_prop} IS NOT NULL
                     THEN gds.similarity.cosine(source.{fastrp_prop}, candidate.{fastrp_prop})
                   ELSE NULL
                 END AS struct_score
            WITH source, candidate, text_score, struct_score,
                 CASE WHEN text_score   IS NULL OR text_score   < 0 THEN 0 ELSE text_score   END AS sem_clip,
                 CASE WHEN struct_score IS NULL OR struct_score < 0 THEN 0 ELSE struct_score END AS str_clip
            WITH source, candidate, text_score, struct_score, sem_clip, str_clip,
                 CASE
                   WHEN text_score IS NOT NULL AND struct_score IS NOT NULL
                     THEN $wSem * sem_clip + $wStr * str_clip
                   WHEN text_score IS NOT NULL THEN sem_clip
                   WHEN struct_score IS NOT NULL THEN str_clip
                   ELSE NULL
                 END AS score
            WHERE score IS NOT NULL AND score > $minSim
            ORDER BY score DESC
            LIMIT $topK
            RETURN
              candidate.{node_id_prop} AS node_id,
              candidate.{label_prop}   AS label,
              score,
              text_score,
              struct_score
        """

    def _generic_similarity_cypher(
        self, node_label: str, node_id_prop: str, label_prop: str,
    ) -> str:
        """Cypher para similitud sobre el único embedding disponible (no-Articles)."""
        prop = self.EMBEDDING_PROPERTY
        return f"""
            MATCH (source:{node_label} {{user_id: $userId, {node_id_prop}: $idValue}})
            WHERE source.{prop} IS NOT NULL
            MATCH (candidate:{node_label} {{user_id: $userId}})
            WHERE candidate.{node_id_prop} <> $idValue
              AND candidate.{prop} IS NOT NULL
            WITH source, candidate,
                 gds.similarity.cosine(source.{prop}, candidate.{prop}) AS raw_score
            WITH source, candidate,
                 CASE WHEN raw_score < 0 THEN 0 ELSE raw_score END AS score
            WHERE score > $minSim
            ORDER BY score DESC
            LIMIT $topK
            RETURN
              candidate.{node_id_prop} AS node_id,
              candidate.{label_prop}   AS label,
              score,
              NULL AS text_score,
              NULL AS struct_score
        """

    def _find_similar_without_gds(
        self,
        user_id: str,
        node_label: str,
        node_id_prop: str,
        node_id_value: str,
        label_prop: str,
        min_similarity: float,
        top_k: int,
    ) -> List[Dict[str, Any]]:
        """Similitud coseno en Python sobre embeddings almacenados; fallback a Jaccard."""
        if node_label == self.ARTICLE_LABEL:
            similar = self._cosine_top_k_articles(
                user_id=user_id, node_id_prop=node_id_prop, label_prop=label_prop,
                node_id_value=node_id_value, min_similarity=min_similarity, top_k=top_k,
            )
            if similar is not None:
                return similar
        else:
            prop = self.EMBEDDING_PROPERTY
            with self._session() as session:
                if session is None:
                    raise RuntimeError("Neo4j no disponible")
                rows = [
                    {"node_id": r["node_id"], "label": r["label"], "embedding": list(r["embedding"])}
                    for r in session.run(
                        f"""
                        MATCH (n:{node_label} {{user_id: $userId}})
                        WHERE n.{prop} IS NOT NULL
                        RETURN n.{node_id_prop} AS node_id,
                               n.{label_prop}   AS label,
                               n.{prop}         AS embedding
                        """,
                        userId=user_id,
                    )
                ]
            if rows:
                similar = self._cosine_top_k(
                    rows=rows,
                    node_id_value=node_id_value,
                    min_similarity=min_similarity,
                    top_k=top_k,
                )
                if similar is not None:
                    return similar

        return self._find_similar_by_neighbor_overlap(
            user_id=user_id,
            node_label=node_label,
            node_id_prop=node_id_prop,
            node_id_value=node_id_value,
            label_prop=label_prop,
            min_similarity=min_similarity,
            top_k=top_k,
        )

    def _cosine_top_k_articles(
        self,
        user_id: str,
        node_id_prop: str,
        label_prop: str,
        node_id_value: str,
        min_similarity: float,
        top_k: int,
    ) -> Optional[List[Dict[str, Any]]]:
        """Combina coseno semántico y estructural para artículos en Python."""
        import numpy as np

        text_prop = self.TEXT_EMBEDDING_PROPERTY
        fastrp_prop = self.EMBEDDING_PROPERTY

        with self._session() as session:
            if session is None:
                raise RuntimeError("Neo4j no disponible")
            rows = [
                {
                    "node_id": r["node_id"],
                    "label": r["label"],
                    "text_embedding": list(r["text_embedding"]) if r["text_embedding"] is not None else None,
                    "fastrp_embedding": list(r["fastrp_embedding"]) if r["fastrp_embedding"] is not None else None,
                }
                for r in session.run(
                    f"""
                    MATCH (n:Article {{user_id: $userId}})
                    WHERE n.{text_prop} IS NOT NULL OR n.{fastrp_prop} IS NOT NULL
                    RETURN n.{node_id_prop} AS node_id,
                           n.{label_prop}   AS label,
                           n.{text_prop}    AS text_embedding,
                           n.{fastrp_prop}  AS fastrp_embedding
                    """,
                    userId=user_id,
                )
            ]

        source = next((r for r in rows if str(r["node_id"]) == str(node_id_value)), None)
        if source is None:
            return None

        src_text = self._unit_vec(source["text_embedding"])
        src_struct = self._unit_vec(source["fastrp_embedding"])
        if src_text is None and src_struct is None:
            return None

        results: List[Dict[str, Any]] = []
        for row in rows:
            if str(row["node_id"]) == str(node_id_value):
                continue
            cand_text = self._unit_vec(row["text_embedding"])
            cand_struct = self._unit_vec(row["fastrp_embedding"])

            text_score = (
                float(np.dot(src_text, cand_text))
                if src_text is not None and cand_text is not None and src_text.shape == cand_text.shape
                else None
            )
            struct_score = (
                float(np.dot(src_struct, cand_struct))
                if src_struct is not None and cand_struct is not None and src_struct.shape == cand_struct.shape
                else None
            )

            sem_clip = max(0.0, text_score) if text_score is not None else None
            str_clip = max(0.0, struct_score) if struct_score is not None else None

            if sem_clip is not None and str_clip is not None:
                score = self.SEMANTIC_WEIGHT * sem_clip + self.STRUCTURAL_WEIGHT * str_clip
            elif sem_clip is not None:
                score = sem_clip
            elif str_clip is not None:
                score = str_clip
            else:
                continue

            if score < min_similarity:
                continue

            results.append({
                "node_id": row["node_id"],
                "label": row["label"],
                "similarity_score": round(score, 4),
                "semantic_score": round(text_score, 4) if text_score is not None else None,
                "structural_score": round(struct_score, 4) if struct_score is not None else None,
            })
        results.sort(key=lambda x: -x["similarity_score"])
        return results[:top_k]

    @staticmethod
    def _unit_vec(values: Optional[List[float]]):
        """Devuelve el vector normalizado (norma unitaria) o ``None`` si está vacío."""
        if not values:
            return None
        import numpy as np

        vec = np.array(values, dtype=np.float32)
        norm = float(np.linalg.norm(vec))
        if norm < 1e-9:
            return None
        return vec / norm

    @staticmethod
    def _cosine_top_k(
        rows: List[Dict[str, Any]],
        node_id_value: str,
        min_similarity: float,
        top_k: int,
    ) -> Optional[List[Dict[str, Any]]]:
        """Calcula los top_k más similares por coseno; ``None`` si no hay fuente."""
        import numpy as np

        source = next((r for r in rows if str(r["node_id"]) == str(node_id_value)), None)
        if source is None:
            return None

        sv = np.array(source["embedding"], dtype=np.float32)
        sv_norm = float(np.linalg.norm(sv))
        if sv_norm == 0:
            return None
        sv = sv / sv_norm

        results: List[Dict[str, Any]] = []
        for row in rows:
            if str(row["node_id"]) == str(node_id_value):
                continue
            cv = np.array(row["embedding"], dtype=np.float32)
            cv_norm = float(np.linalg.norm(cv))
            if cv_norm == 0:
                continue
            raw = float(np.dot(sv, cv / cv_norm))
            score = max(0.0, raw)
            if score >= min_similarity:
                results.append({
                    "node_id": row["node_id"],
                    "label": row["label"],
                    "similarity_score": round(score, 4),
                })
        results.sort(key=lambda x: -x["similarity_score"])
        return results[:top_k]

    def _find_similar_by_neighbor_overlap(
        self,
        user_id: str,
        node_label: str,
        node_id_prop: str,
        node_id_value: str,
        label_prop: str,
        min_similarity: float,
        top_k: int,
    ) -> List[Dict[str, Any]]:
        """Similitud Jaccard sobre vecinos directos cuando no hay embeddings."""
        cypher = f"""
            MATCH (source:{node_label} {{user_id: $userId, {node_id_prop}: $idValue}})
            MATCH (candidate:{node_label} {{user_id: $userId}})
            WHERE candidate.{node_id_prop} <> $idValue
            OPTIONAL MATCH (source)-[]-(sourceNeighbor {{user_id: $userId}})
            WITH source, candidate, collect(DISTINCT elementId(sourceNeighbor)) AS sourceNeighbors
            OPTIONAL MATCH (candidate)-[]-(candidateNeighbor {{user_id: $userId}})
            WITH candidate,
                 sourceNeighbors,
                 collect(DISTINCT elementId(candidateNeighbor)) AS candidateNeighbors
            WITH candidate,
                 [neighbor IN sourceNeighbors WHERE neighbor IN candidateNeighbors] AS intersection,
                 sourceNeighbors + [neighbor IN candidateNeighbors WHERE NOT neighbor IN sourceNeighbors] AS unionNeighbors
            WITH candidate,
                 CASE
                   WHEN size(unionNeighbors) = 0 THEN 0.0
                   ELSE toFloat(size(intersection)) / toFloat(size(unionNeighbors))
                 END AS score
            WHERE score >= $minSim
            RETURN
              candidate.{node_id_prop} AS node_id,
              candidate.{label_prop}   AS label,
              score
            ORDER BY score DESC
            LIMIT $topK
        """
        with self._session() as session:
            if session is None:
                raise RuntimeError("Neo4j no disponible")
            result = session.run(
                cypher,
                userId=user_id, idValue=node_id_value,
                minSim=float(min_similarity), topK=int(top_k),
            )
            return [
                {
                    "node_id": r["node_id"],
                    "label": r["label"],
                    "similarity_score": round(float(r["score"]), 4),
                }
                for r in result
            ]

    def get_embedding_status(self, user_id: str) -> Dict[str, int]:
        """Devuelve cuántos nodos del usuario tienen embedding calculado."""
        prop = self.EMBEDDING_PROPERTY
        with self._session() as session:
            if session is None:
                return {"total": 0, "with_embeddings": 0}
            record = session.run(
                f"""
                MATCH (n {{user_id: $userId}})
                RETURN count(n) AS total, count(n.{prop}) AS with_embeddings
                """,
                userId=user_id,
            ).single()
            if not record:
                return {"total": 0, "with_embeddings": 0}
            return {
                "total": int(record["total"]),
                "with_embeddings": int(record["with_embeddings"]),
            }

    def clear_embeddings(self, user_id: str) -> int:
        """Elimina la propiedad de embedding de todos los nodos del usuario."""
        prop = self.EMBEDDING_PROPERTY
        with self._session() as session:
            if session is None:
                return 0
            record = session.run(
                f"""
                MATCH (n {{user_id: $userId}})
                WHERE n.{prop} IS NOT NULL
                REMOVE n.{prop}
                WITH n
                RETURN count(n) AS cleared
                """,
                userId=user_id,
            ).single()
            return int(record["cleared"]) if record else 0
