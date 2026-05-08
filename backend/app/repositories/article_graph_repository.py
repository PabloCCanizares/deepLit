"""
Repositorio del grafo de artículos en Neo4j.

Encapsula todas las operaciones Cypher contra Neo4j para el grafo
"simple" centrado en artículos (Article -> Author / Keyword / Category / Type).

Cada nodo lleva la propiedad ``user_id`` para aislar los grafos de cada
usuario. Las operaciones de inserción usan ``MERGE`` para garantizar
que no se dupliquen nodos ni relaciones.
"""
from contextlib import contextmanager
from typing import Dict, List, Optional

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
    def _tx_upsert_article(tx, user_id: str, article_id: str, title: str, year: Optional[int]):
        tx.run(
            """
            MERGE (a:Article {user_id: $user_id, article_id: $article_id})
            SET a.title = $title,
                a.year = $year,
                a.updated_at = datetime()
            """,
            user_id=user_id,
            article_id=article_id,
            title=title,
            year=year,
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
