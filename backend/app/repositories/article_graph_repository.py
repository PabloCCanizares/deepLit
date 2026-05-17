"""
Repositorio del grafo de artículos en Neo4j.

Encapsula todas las operaciones Cypher contra Neo4j para el grafo
"simple" centrado en artículos (Article -> Author / Keyword / Category / Type).

Cada nodo lleva la propiedad ``user_id`` para aislar los grafos de cada
usuario. Las operaciones de inserción usan ``MERGE`` para garantizar
que no se dupliquen nodos ni relaciones.
"""
from contextlib import contextmanager
from typing import Any, Dict, List, Optional

from app.config import settings


class ArticleGraphRepository:
    """
    Repositorio sincrónico para Neo4j.

    Si Neo4j no está configurado en ``settings`` o no se puede conectar,
    el repositorio queda en estado "no disponible" y todas las operaciones
    se convierten en no-ops seguras.
    """

    # Etiquetas usadas en el grafo (distintas de las del KG basado en LLM)
    ARTICLE_LABEL = "Article"
    AUTHOR_LABEL = "Author"
    KEYWORD_LABEL = "Keyword"
    CATEGORY_LABEL = "Category"
    TYPE_LABEL = "Type"

    REL_WROTE = "WROTE"
    REL_HAS_KEYWORD = "HAS_KEYWORD"
    REL_IN_CATEGORY = "IN_CATEGORY"
    REL_OF_TYPE = "OF_TYPE"

    def __init__(self):
        self._driver = None
        self._gds_support_cache: Optional[bool] = None

    # ------------------------------------------------------------------
    # Conexión
    # ------------------------------------------------------------------
    def is_available(self) -> bool:
        """Indica si Neo4j está configurado y accesible."""
        return self._get_driver() is not None

    def close(self) -> None:
        """Cierra el driver si está abierto."""
        if self._driver is not None:
            try:
                self._driver.close()
            except Exception:
                pass
            self._driver = None

    def _get_driver(self):
        """Obtiene (o crea) el driver de Neo4j de forma perezosa."""
        if self._driver is not None:
            return self._driver

        if not all([
            settings.NEO4J_URL,
            settings.NEO4J_USERNAME,
            settings.NEO4J_PASSWORD,
        ]):
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
        driver = self._get_driver()
        if driver is None:
            yield None
            return
        with driver.session() as session:
            yield session

    # ------------------------------------------------------------------
    # Inserción / Upsert
    # ------------------------------------------------------------------
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
        """
        Inserta (o actualiza) un artículo y todos los nodos/relaciones
        relacionados con él. Devuelve True si se ejecutó la operación,
        False si Neo4j no está disponible.
        """
        if not user_id or not article_id:
            return False

        normalized_title = (title or "").strip() or "Sin título"
        normalized_authors = [a.strip() for a in (authors or []) if isinstance(a, str) and a.strip()]
        normalized_keywords = [k.strip() for k in (keywords or []) if isinstance(k, str) and k.strip()]
        normalized_category = (category or "").strip() or None
        normalized_type = (article_type or "").strip() or None

        with self._session() as session:
            if session is None:
                return False

            session.execute_write(
                self._tx_upsert_article,
                user_id=user_id,
                article_id=article_id,
                title=normalized_title,
                year=year,
                abstract=(abstract or "").strip() or None,
            )

            for author in normalized_authors:
                session.execute_write(
                    self._tx_upsert_author,
                    user_id=user_id,
                    article_id=article_id,
                    name=author,
                )

            for keyword in normalized_keywords:
                session.execute_write(
                    self._tx_upsert_keyword,
                    user_id=user_id,
                    article_id=article_id,
                    keyword=keyword,
                )

            if normalized_category:
                session.execute_write(
                    self._tx_upsert_category,
                    user_id=user_id,
                    article_id=article_id,
                    category=normalized_category,
                )

            if normalized_type:
                session.execute_write(
                    self._tx_upsert_type,
                    user_id=user_id,
                    article_id=article_id,
                    article_type=normalized_type,
                )

        return True

    @staticmethod
    def _tx_upsert_article(tx, user_id: str, article_id: str, title: str, year: Optional[int], abstract: Optional[str] = None):
        tx.run(
            """
            MERGE (a:Article {user_id: $user_id, article_id: $article_id})
            SET a.title = $title,
                a.year = $year,
                a.abstract = $abstract,
                a.updated_at = datetime()
            """,
            user_id=user_id,
            article_id=article_id,
            title=title,
            year=year,
            abstract=abstract,
        )

    @staticmethod
    def _tx_upsert_author(tx, user_id: str, article_id: str, name: str):
        tx.run(
            """
            MERGE (auth:Author {user_id: $user_id, name_lower: $name_lower})
            SET auth.name = $name
            WITH auth
            MATCH (a:Article {user_id: $user_id, article_id: $article_id})
            MERGE (auth)-[:WROTE]->(a)
            """,
            user_id=user_id,
            article_id=article_id,
            name=name,
            name_lower=name.lower(),
        )

    @staticmethod
    def _tx_upsert_keyword(tx, user_id: str, article_id: str, keyword: str):
        tx.run(
            """
            MERGE (k:Keyword {user_id: $user_id, key_lower: $key_lower})
            SET k.key = $keyword
            WITH k
            MATCH (a:Article {user_id: $user_id, article_id: $article_id})
            MERGE (a)-[:HAS_KEYWORD]->(k)
            """,
            user_id=user_id,
            article_id=article_id,
            keyword=keyword,
            key_lower=keyword.lower(),
        )

    @staticmethod
    def _tx_upsert_category(tx, user_id: str, article_id: str, category: str):
        tx.run(
            """
            MERGE (c:Category {user_id: $user_id, name_lower: $name_lower})
            SET c.name = $category
            WITH c
            MATCH (a:Article {user_id: $user_id, article_id: $article_id})
            MERGE (a)-[:IN_CATEGORY]->(c)
            """,
            user_id=user_id,
            article_id=article_id,
            category=category,
            name_lower=category.lower(),
        )

    @staticmethod
    def _tx_upsert_type(tx, user_id: str, article_id: str, article_type: str):
        tx.run(
            """
            MERGE (t:Type {user_id: $user_id, name_lower: $name_lower})
            SET t.name = $article_type
            WITH t
            MATCH (a:Article {user_id: $user_id, article_id: $article_id})
            MERGE (a)-[:OF_TYPE]->(t)
            """,
            user_id=user_id,
            article_id=article_id,
            article_type=article_type,
            name_lower=article_type.lower(),
        )

    # ------------------------------------------------------------------
    # Eliminación
    # ------------------------------------------------------------------
    def delete_article(self, user_id: str, article_id: str) -> bool:
        """
        Elimina el nodo Article y limpia entidades huérfanas (sin más
        relaciones del usuario) creadas exclusivamente para ese artículo.
        """
        if not user_id or not article_id:
            return False

        with self._session() as session:
            if session is None:
                return False

            session.execute_write(self._tx_delete_article, user_id=user_id, article_id=article_id)

        return True

    @staticmethod
    def _tx_delete_article(tx, user_id: str, article_id: str):
        tx.run(
            """
            MATCH (a:Article {user_id: $user_id, article_id: $article_id})
            DETACH DELETE a
            """,
            user_id=user_id,
            article_id=article_id,
        )

        # Limpiar nodos huérfanos del usuario (sin ninguna relación restante)
        tx.run(
            """
            MATCH (n)
            WHERE (n:Author OR n:Keyword OR n:Category OR n:Type)
              AND n.user_id = $user_id
              AND NOT (n)--()
            DELETE n
            """,
            user_id=user_id,
        )

    # ------------------------------------------------------------------
    # Lectura
    # ------------------------------------------------------------------
    def get_user_graph(self, user_id: str, limit: int = 250) -> Dict[str, list]:
        """
        Devuelve los nodos y relaciones del grafo del usuario en un
        formato listo para visualización ({"nodes": [...], "edges": [...]}).
        """
        if not user_id:
            return {"nodes": [], "edges": []}

        with self._session() as session:
            if session is None:
                return {"nodes": [], "edges": []}

            nodes = session.execute_read(self._tx_fetch_nodes, user_id=user_id, limit=limit)
            edges = session.execute_read(self._tx_fetch_edges, user_id=user_id, limit=limit * 4)

        return {"nodes": nodes, "edges": edges}

    @staticmethod
    def _tx_fetch_nodes(tx, user_id: str, limit: int):
        result = tx.run(
            """
            MATCH (n)
            WHERE (n:Article OR n:Author OR n:Keyword OR n:Category OR n:Type)
              AND n.user_id = $user_id
            RETURN
                elementId(n) AS id,
                labels(n) AS labels,
                coalesce(n.title, n.name, n.key, '') AS label,
                n.article_id AS article_id,
                n.year AS year
            LIMIT $limit
            """,
            user_id=user_id,
            limit=int(limit),
        )

        nodes: List[Dict] = []
        for record in result:
            labels = list(record.get("labels") or [])
            primary_label = labels[0] if labels else "Node"
            nodes.append({
                "id": record["id"],
                "type": primary_label,
                "label": record.get("label") or primary_label,
                "article_id": record.get("article_id"),
                "year": record.get("year"),
            })
        return nodes

    @staticmethod
    def _tx_fetch_edges(tx, user_id: str, limit: int):
        result = tx.run(
            """
            MATCH (s)-[r]->(t)
            WHERE s.user_id = $user_id AND t.user_id = $user_id
            RETURN
                elementId(s) AS source,
                elementId(t) AS target,
                type(r) AS type
            LIMIT $limit
            """,
            user_id=user_id,
            limit=int(limit),
        )

        edges: List[Dict] = []
        for record in result:
            edges.append({
                "source": record["source"],
                "target": record["target"],
                "type": record["type"],
            })
        return edges

    def get_user_graph_stats(self, user_id: str) -> Dict[str, int]:
        """Devuelve un resumen de cardinalidad del grafo del usuario."""
        if not user_id:
            return {"articles": 0, "authors": 0, "keywords": 0, "categories": 0, "types": 0, "relationships": 0}

        with self._session() as session:
            if session is None:
                return {"articles": 0, "authors": 0, "keywords": 0, "categories": 0, "types": 0, "relationships": 0}

            return session.execute_read(self._tx_fetch_stats, user_id=user_id)

    @staticmethod
    def _tx_fetch_stats(tx, user_id: str) -> Dict[str, int]:
        articles = tx.run(
            "MATCH (n:Article {user_id: $user_id}) RETURN count(n) AS total",
            user_id=user_id,
        ).single()["total"]
        authors = tx.run(
            "MATCH (n:Author {user_id: $user_id}) RETURN count(n) AS total",
            user_id=user_id,
        ).single()["total"]
        keywords = tx.run(
            "MATCH (n:Keyword {user_id: $user_id}) RETURN count(n) AS total",
            user_id=user_id,
        ).single()["total"]
        categories = tx.run(
            "MATCH (n:Category {user_id: $user_id}) RETURN count(n) AS total",
            user_id=user_id,
        ).single()["total"]
        types = tx.run(
            "MATCH (n:Type {user_id: $user_id}) RETURN count(n) AS total",
            user_id=user_id,
        ).single()["total"]
        relationships = tx.run(
            """
            MATCH (s)-[r]->(t)
            WHERE s.user_id = $user_id AND t.user_id = $user_id
            RETURN count(r) AS total
            """,
            user_id=user_id,
        ).single()["total"]

        return {
            "articles": int(articles or 0),
            "authors": int(authors or 0),
            "keywords": int(keywords or 0),
            "categories": int(categories or 0),
            "types": int(types or 0),
            "relationships": int(relationships or 0),
        }

    EMBEDDING_PROPERTY = "fastrp_embedding"
    TEXT_EMBEDDING_PROPERTY = "text_embedding"
    EMBEDDING_DIM = 128

    @staticmethod
    def _gds_graph_name(user_id: str) -> str:
        """Nombre único y seguro (solo alfanuméricos + _) para la proyección GDS."""
        safe = "".join(c if c.isalnum() else "_" for c in str(user_id))
        return f"ag_sim_{safe}"

    def gds_project_graph(self, user_id: str) -> Dict[str, Any]:
        """
        Proyección dinámica (Cypher Projection) del subgrafo del usuario.
        """
        graph_name = self._gds_graph_name(user_id)
        with self._session() as session:
            if session is None:
                raise RuntimeError("Neo4j no disponible")
            result = session.run(
                """
                CALL gds.graph.project.cypher(
                  $graphName,
                  'MATCH (n) WHERE n.user_id = $uid RETURN id(n) AS id',
                  'MATCH (s)-[r]->(t)
                   WHERE s.user_id = $uid AND t.user_id = $uid
                   RETURN id(s) AS source, id(t) AS target, type(r) AS relType',
                  { parameters: { uid: $userId } }
                )
                YIELD graphName, nodeCount, relationshipCount
                RETURN graphName, nodeCount, relationshipCount
                """,
                graphName=graph_name,
                userId=user_id,
            )
            record = result.single()
            return {
                "graph_name": record["graphName"],
                "node_count": record["nodeCount"],
                "relationship_count": record["relationshipCount"],
            }

    def gds_drop_graph(self, user_id: str) -> None:
        """Elimina la proyección en memoria. Silencioso si no existe."""
        graph_name = self._gds_graph_name(user_id)
        with self._session() as session:
            if session is None:
                return
            session.run(
                "CALL gds.graph.drop($graphName, false) YIELD graphName",
                graphName=graph_name,
            )

    def has_gds_support(self) -> bool:
        """Indica si la instancia Neo4j expone las piezas de GDS usadas aquí. Resultado cacheado."""
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
        self._gds_support_cache = result
        return result

    def get_nodes_needing_embeddings(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Devuelve todos los nodos del usuario sin embeddings calculados.
        Incluye el texto representativo de cada nodo para poder embebarlo.
        """
        prop = self.EMBEDDING_PROPERTY
        with self._session() as session:
            if session is None:
                return []
            result = session.run(
                f"""
                MATCH (n)
                WHERE n.user_id = $userId
                  AND (n:Article OR n:Author OR n:Keyword OR n:Category OR n:Type)
                  AND n.{prop} IS NULL
                RETURN
                  elementId(n)                              AS neo4j_id,
                  labels(n)[0]                              AS label_type,
                  coalesce(n.title, n.name, n.key, '')      AS text
                """,
                userId=user_id,
            )
            return [
                {"neo4j_id": r["neo4j_id"], "label_type": r["label_type"], "text": r["text"]}
                for r in result
            ]

    def get_all_article_embeddings(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Devuelve article_id, título, año y vector embedding de todos los
        artículos del usuario que ya tienen embeddings calculados.
        Prioriza text_embedding (semántico) sobre fastrp_embedding (estructural).
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
                  CASE WHEN a.{text_prop} IS NOT NULL
                       THEN a.{text_prop}
                       ELSE a.{fastrp_prop}
                  END                   AS embedding
                """,
                userId=user_id,
            )
            return [
                {
                    "article_id": str(r["article_id"]),
                    "title": r["title"] or "",
                    "year": r["year"],
                    "embedding": list(r["embedding"]),
                }
                for r in result
            ]

    def get_article_neighborhood(
        self, user_id: str, article_ids: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Obtiene el vecindario estructural de los artículos indicados:
        autores, keywords, categorías y tipos conectados en el grafo.
        """
        if not article_ids:
            return []
        with self._session() as session:
            if session is None:
                return []
            result = session.run(
                """
                MATCH (a:Article {user_id: $userId})
                WHERE a.article_id IN $articleIds
                OPTIONAL MATCH (a)<-[:WROTE]-(author:Author {user_id: $userId})
                OPTIONAL MATCH (a)-[:HAS_KEYWORD]->(kw:Keyword {user_id: $userId})
                OPTIONAL MATCH (a)-[:IN_CATEGORY]->(cat:Category {user_id: $userId})
                OPTIONAL MATCH (a)-[:OF_TYPE]->(typ:Type {user_id: $userId})
                RETURN
                  a.article_id                      AS article_id,
                  coalesce(a.title, '')             AS title,
                  a.year                            AS year,
                  collect(DISTINCT author.name)     AS authors,
                  collect(DISTINCT kw.key)          AS keywords,
                  collect(DISTINCT cat.name)        AS categories,
                  collect(DISTINCT typ.name)        AS types
                """,
                userId=user_id,
                articleIds=article_ids,
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
                }
                for r in result
            ]

    def get_articles_needing_text_embeddings(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Devuelve artículos del usuario sin text_embedding calculado,
        incluyendo title, abstract y keywords para construir el texto semántico.
        """
        prop = self.TEXT_EMBEDDING_PROPERTY
        with self._session() as session:
            if session is None:
                return []
            result = session.run(
                f"""
                MATCH (a:Article {{user_id: $userId}})
                WHERE a.{prop} IS NULL
                OPTIONAL MATCH (a)-[:HAS_KEYWORD]->(kw:Keyword {{user_id: $userId}})
                RETURN
                  elementId(a)                    AS neo4j_id,
                  a.article_id                    AS article_id,
                  coalesce(a.title, '')            AS title,
                  coalesce(a.abstract, '')         AS abstract,
                  collect(DISTINCT kw.key)         AS keywords
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
        """
        Escribe text_embedding en los nodos Article indicados.
        pairs = [{"id": elementId, "vec": [float, ...]}]
        """
        if not pairs:
            return 0
        prop = self.TEXT_EMBEDDING_PROPERTY
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

    def write_node_embeddings(self, pairs: List[Dict[str, Any]]) -> int:
        """
        Escribe embeddings en Neo4j para los nodos indicados.
        pairs = [{"id": elementId, "vec": [float, ...]}]
        """
        if not pairs:
            return 0
        prop = self.EMBEDDING_PROPERTY
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
        """
        Proyecta el grafo, ejecuta FastRP en modo *write* y limpia la
        proyección. Los embeddings quedan persistidos como la propiedad
        ``EMBEDDING_PROPERTY`` en cada nodo de Neo4j.
        """
        if not self.has_gds_support():
            return {
                "node_count": 0,
                "relationship_count": 0,
                "embeddings_written": 0,
                "compute_ms": 0,
                "mode": "neighbor-overlap",
            }

        # Limpiar proyección anterior si quedó colgada
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
            result = session.run(
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
                graphName=graph_name,
                dim=self.EMBEDDING_DIM,
                prop=self.EMBEDDING_PROPERTY,
            )
            record = result.single()
            fastrp = {
                "embeddings_written": record["nodePropertiesWritten"],
                "compute_ms": record["computeMillis"],
            }

        self.gds_drop_graph(user_id)

        return {
            "node_count": projection["node_count"],
            "relationship_count": projection["relationship_count"],
            **fastrp,
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
        """
        Devuelve nodos similares al nodo dado usando similitud coseno sobre
        los embeddings FastRP.

        Genérico: funciona con cualquier label (Article, Author, Keyword…).
        Solo compara y devuelve nodos del mismo label y del mismo usuario.
        """
        if not self.has_gds_support():
            return self._find_similar_nodes_no_gds(
                user_id=user_id,
                node_label=node_label,
                node_id_prop=node_id_prop,
                node_id_value=node_id_value,
                label_prop=label_prop,
                min_similarity=min_similarity,
                top_k=top_k,
            )

        prop = self.EMBEDDING_PROPERTY
        cypher = f"""
            MATCH (source:{node_label} {{user_id: $userId, {node_id_prop}: $idValue}})
            WHERE source.{prop} IS NOT NULL
            MATCH (candidate:{node_label} {{user_id: $userId}})
            WHERE candidate.{node_id_prop} <> $idValue
              AND candidate.{prop} IS NOT NULL
            WITH source, candidate,
                 gds.similarity.cosine(source.{prop}, candidate.{prop}) AS score
            WHERE score > $minSim
            ORDER BY score DESC
            LIMIT $topK
            RETURN
              candidate.{node_id_prop}  AS node_id,
              candidate.{label_prop}    AS label,
              score
        """
        with self._session() as session:
            if session is None:
                raise RuntimeError("Neo4j no disponible")
            result = session.run(
                cypher,
                userId=user_id,
                idValue=node_id_value,
                minSim=float(min_similarity),
                topK=int(top_k),
            )
            return [
                {
                    "node_id": r["node_id"],
                    "label": r["label"],
                    "similarity_score": round(float(r["score"]), 4),
                }
                for r in result
            ]

    def _find_similar_nodes_no_gds(
        self,
        user_id: str,
        node_label: str,
        node_id_prop: str,
        node_id_value: str,
        label_prop: str,
        min_similarity: float = 0.0,
        top_k: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Similitud sin GDS: usa coseno sobre embeddings almacenados en Neo4j.
        Si el nodo fuente todavía no tiene embedding, cae al solapamiento de vecinos.
        """
        prop = self.EMBEDDING_PROPERTY
        # Intentar con embeddings de texto (semánticos)
        cypher = f"""
            MATCH (n:{node_label} {{user_id: $userId}})
            WHERE n.{prop} IS NOT NULL
            RETURN n.{node_id_prop} AS node_id,
                   n.{label_prop}   AS label,
                   n.{prop}         AS embedding
        """
        with self._session() as session:
            if session is None:
                raise RuntimeError("Neo4j no disponible")
            rows = [
                {"node_id": r["node_id"], "label": r["label"], "embedding": list(r["embedding"])}
                for r in session.run(cypher, userId=user_id)
            ]

        # Si hay embeddings, calcular coseno en Python
        if rows:
            import numpy as np

            source = next((r for r in rows if str(r["node_id"]) == str(node_id_value)), None)
            if source is not None:
                sv = np.array(source["embedding"], dtype=np.float32)
                sv_norm = np.linalg.norm(sv)
                if sv_norm > 0:
                    sv = sv / sv_norm
                results = []
                for row in rows:
                    if str(row["node_id"]) == str(node_id_value):
                        continue
                    cv = np.array(row["embedding"], dtype=np.float32)
                    cv_norm = np.linalg.norm(cv)
                    if cv_norm == 0:
                        continue
                    score = float(np.dot(sv, cv / cv_norm))
                    if score >= min_similarity:
                        results.append({
                            "node_id": row["node_id"],
                            "label": row["label"],
                            "similarity_score": round(score, 4),
                        })
                results.sort(key=lambda x: -x["similarity_score"])
                return results[:top_k]

        # Fallback: solapamiento de vecinos (sin embeddings)
        return self._find_similar_nodes_by_neighbor_overlap(
            user_id=user_id,
            node_label=node_label,
            node_id_prop=node_id_prop,
            node_id_value=node_id_value,
            label_prop=label_prop,
            min_similarity=min_similarity,
            top_k=top_k,
        )

    def _find_similar_nodes_by_neighbor_overlap(
        self,
        user_id: str,
        node_label: str,
        node_id_prop: str,
        node_id_value: str,
        label_prop: str,
        min_similarity: float = 0.0,
        top_k: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Fallback sin GDS: similitud Jaccard entre los vecinos directos del nodo.

        Para artículos, esto equivale a comparar autores, keywords, categoría
        y tipo compartidos. Para autores/keywords/categorías/tipos compara los
        artículos a los que están conectados.
        """
        cypher = f"""
            MATCH (source:{node_label} {{user_id: $userId, {node_id_prop}: $idValue}})
            MATCH (candidate:{node_label} {{user_id: $userId}})
            WHERE candidate.{node_id_prop} <> $idValue
            OPTIONAL MATCH (source)--(sourceNeighbor {{user_id: $userId}})
            WITH source, candidate, collect(DISTINCT elementId(sourceNeighbor)) AS sourceNeighbors
            OPTIONAL MATCH (candidate)--(candidateNeighbor {{user_id: $userId}})
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
                userId=user_id,
                idValue=node_id_value,
                minSim=float(min_similarity),
                topK=int(top_k),
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
        """Cuántos nodos del usuario tienen embeddings calculados."""
        prop = self.EMBEDDING_PROPERTY
        with self._session() as session:
            if session is None:
                return {"total": 0, "with_embeddings": 0}
            result = session.run(
                f"""
                MATCH (n {{user_id: $userId}})
                RETURN count(n) AS total, count(n.{prop}) AS with_embeddings
                """,
                userId=user_id,
            )
            record = result.single()
            if not record:
                return {"total": 0, "with_embeddings": 0}
            return {
                "total": int(record["total"]),
                "with_embeddings": int(record["with_embeddings"]),
            }

    def clear_embeddings(self, user_id: str) -> int:
        """
        Elimina la propiedad de embedding de todos los nodos del usuario.
        Devuelve el número de nodos limpiados.
        """
        prop = self.EMBEDDING_PROPERTY
        with self._session() as session:
            if session is None:
                return 0
            result = session.run(
                f"""
                MATCH (n {{user_id: $userId}})
                WHERE n.{prop} IS NOT NULL
                REMOVE n.{prop}
                WITH n
                RETURN count(n) AS cleared
                """,
                userId=user_id,
            )
            record = result.single()
            return int(record["cleared"]) if record else 0
