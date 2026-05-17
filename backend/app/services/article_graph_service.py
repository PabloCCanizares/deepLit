"""
Servicio del grafo de artículos (Neo4j).

Construye un grafo simple a partir de los metadatos de cada artículo:

- Cada artículo se representa con un nodo ``Article``.
- Cada autor se representa con un nodo ``Author`` y queda conectado al
  artículo mediante la relación ``WROTE``.
- Cada palabra clave se representa con un nodo ``Keyword`` enlazado al
  artículo con la relación ``HAS_KEYWORD``.
- La categoría se representa con un nodo ``Category`` (relación
  ``IN_CATEGORY``) y el tipo con un nodo ``Type`` (relación ``OF_TYPE``).

Las operaciones se realizan con ``MERGE`` para evitar duplicar nodos o
relaciones cuando se ingieren artículos repetidos.

Si Neo4j no está configurado el servicio se comporta como no-op para no
romper el flujo principal de la aplicación.

Al arrancar la API se ejecuta una sincronización MongoDB → Neo4j para
recuperar artículos añadidos antes de existir esta integración (MERGE
idempotente).
"""
import asyncio
import logging
import re
from typing import Any, Dict, List, Optional

from app.repositories.article_graph_repository import ArticleGraphRepository
from app.repositories.article_repository import ArticleRepository

logger = logging.getLogger(__name__)


class ArticleGraphService:

    def __init__(self):
        self.repo = ArticleGraphRepository()

    # ------------------------------------------------------------------
    # API pública
    # ------------------------------------------------------------------
    def is_available(self) -> bool:
        """Indica si Neo4j está disponible."""
        return self.repo.is_available()

    def ingest_article(self, article: Dict[str, Any], user_id: Optional[str] = None) -> bool:
        """
        Incorpora un artículo al grafo. Tolera errores y nunca lanza
        excepciones para no afectar al flujo principal.
        """
        if not article:
            return False

        article_id = article.get("_id") or article.get("id")
        if not article_id:
            return False

        owner_id = user_id or article.get("id_user")
        if not owner_id:
            return False

        try:
            return self.repo.upsert_article_graph(
                user_id=str(owner_id),
                article_id=str(article_id),
                title=article.get("title") or "",
                authors=self._extract_authors(article.get("authors")),
                keywords=self._extract_keywords(article.get("keywords")),
                category=self._extract_string(article.get("category")),
                article_type=self._extract_string(article.get("type")),
                year=self._extract_year(article.get("year")),
                abstract=article.get("abstract") or "",
            )
        except Exception as exc:
            logger.warning(
                "No se pudo ingerir el articulo %s en el grafo: %s",
                article_id,
                exc,
            )
            return False

    def remove_article(self, article_id: str, user_id: str) -> bool:
        """Elimina un artículo y sus huérfanos del grafo."""
        if not article_id or not user_id:
            return False

        try:
            return self.repo.delete_article(user_id=str(user_id), article_id=str(article_id))
        except Exception as exc:
            logger.warning(
                "No se pudo eliminar el articulo %s del grafo: %s",
                article_id,
                exc,
            )
            return False

    def get_user_graph(self, user_id: str, limit: int = 250) -> Dict[str, Any]:
        """Devuelve el grafo del usuario para visualización."""
        if not user_id:
            return self._empty_graph()

        if not self.repo.is_available():
            return self._empty_graph(message="Neo4j no configurado")

        try:
            graph = self.repo.get_user_graph(user_id=str(user_id), limit=limit)
            stats = self.repo.get_user_graph_stats(user_id=str(user_id))
            return {
                "enabled": True,
                "nodes": graph.get("nodes", []),
                "edges": graph.get("edges", []),
                "stats": stats,
            }
        except Exception as exc:
            logger.warning("No se pudo recuperar el grafo del usuario %s: %s", user_id, exc)
            return self._empty_graph(message="Error consultando el grafo")

    def build_user_graph_text(self, user_id: str, max_chars: int = 6000) -> str:
        """
        Devuelve el grafo del usuario como texto plano orientado a
        **relaciones cruzadas** entre artículos.

        El objetivo es dar al agente de IA un contexto que permita razonar
        en términos de "estos artículos comparten autor / categoría /
        keyword", no un simple listado de metadatos por artículo.

        Estructura del texto:
          1. Listado breve de artículos.
          2. Conexiones cruzadas: entidades (autor, categoría, keyword, tipo)
             que enlazan 2+ artículos, con los títulos a los que conectan.
          3. Atributos completos por artículo (autores, categoría, etc.).

        Devuelve cadena vacía si Neo4j no está disponible o no hay datos.
        El texto se trunca a ``max_chars`` caracteres.
        """
        if not user_id or not self.repo.is_available():
            return ""

        try:
            graph = self.repo.get_user_graph(user_id=str(user_id), limit=500)
        except Exception as exc:
            logger.warning("No se pudo construir texto del grafo para user %s: %s", user_id, exc)
            return ""

        nodes = graph.get("nodes") or []
        edges = graph.get("edges") or []
        if not nodes:
            return ""

        nodes_by_id = {n["id"]: n for n in nodes}
        articles = [n for n in nodes if n.get("type") == "Article"]
        if not articles:
            return ""

        # Título legible por artículo
        def article_title(node: Dict[str, Any]) -> str:
            title = (node.get("label") or "Sin título").strip()
            year = node.get("year")
            return f'"{title}"' + (f" ({year})" if year else "")

        # ── Construcción de adyacencias ─────────────────────────────────
        # per_article[article_id] = {WROTE, HAS_KEYWORD, IN_CATEGORY, OF_TYPE}
        per_article: Dict[str, Dict[str, List[str]]] = {
            n["id"]: {"WROTE": [], "HAS_KEYWORD": [], "IN_CATEGORY": [], "OF_TYPE": []}
            for n in articles
        }
        # entity_to_articles[(rel_type, entity_label)] = [article_id, ...]
        entity_to_articles: Dict[tuple, List[str]] = {}

        def register(rel_type: str, entity_label: str, article_id: str):
            if not entity_label:
                return
            per_article.setdefault(
                article_id,
                {"WROTE": [], "HAS_KEYWORD": [], "IN_CATEGORY": [], "OF_TYPE": []},
            )
            per_article[article_id][rel_type].append(entity_label)
            key = (rel_type, entity_label)
            bucket = entity_to_articles.setdefault(key, [])
            if article_id not in bucket:
                bucket.append(article_id)

        for edge in edges:
            src = nodes_by_id.get(edge.get("source"))
            tgt = nodes_by_id.get(edge.get("target"))
            rel = edge.get("type")
            if not src or not tgt or not rel:
                continue

            if rel == "WROTE" and tgt.get("type") == "Article":
                register("WROTE", str(src.get("label") or "").strip(), tgt["id"])
            elif src.get("type") == "Article" and rel in ("HAS_KEYWORD", "IN_CATEGORY", "OF_TYPE"):
                register(rel, str(tgt.get("label") or "").strip(), src["id"])

        # ── 1. Listado breve de artículos ───────────────────────────────
        lines: List[str] = ["GRAFO DE CONOCIMIENTO DEL USUARIO (Neo4j):", ""]
        lines.append(f"ARTÍCULOS ({len(articles)} en total):")
        for article in articles:
            lines.append(f"- {article_title(article)}")

        # ── 2. Conexiones cruzadas: entidades compartidas por 2+ artículos ──
        rel_section_titles = {
            "WROTE":       "Artículos que comparten autor",
            "IN_CATEGORY": "Artículos que comparten categoría",
            "OF_TYPE":     "Artículos que comparten tipo",
            "HAS_KEYWORD": "Artículos que comparten keyword",
        }

        any_shared = False
        connection_blocks: List[str] = []
        for rel_type, section_title in rel_section_titles.items():
            shared_items = [
                (label, article_ids)
                for (r, label), article_ids in entity_to_articles.items()
                if r == rel_type and len(article_ids) >= 2
            ]
            if not shared_items:
                continue
            any_shared = True
            shared_items.sort(key=lambda item: (-len(item[1]), item[0].lower()))
            block_lines = [f"{section_title}:"]
            for label, article_ids in shared_items:
                titles = [article_title(nodes_by_id[aid]) for aid in article_ids if aid in nodes_by_id]
                block_lines.append(f"- «{label}» → {', '.join(titles)}")
            connection_blocks.append("\n".join(block_lines))

        if any_shared:
            lines.append("")
            lines.append("CONEXIONES CRUZADAS (entidades compartidas entre varios artículos):")
            lines.append("")
            lines.append("\n\n".join(connection_blocks))
        else:
            lines.append("")
            lines.append("CONEXIONES CRUZADAS: no se han detectado entidades compartidas entre artículos.")

        # ── 3. Atributos completos por artículo ─────────────────────────
        lines.append("")
        lines.append("ATRIBUTOS POR ARTÍCULO:")
        for article in articles:
            relations = per_article.get(article["id"], {})
            authors    = sorted({a for a in relations.get("WROTE", []) if a})
            keywords   = sorted({k for k in relations.get("HAS_KEYWORD", []) if k})
            categories = sorted({c for c in relations.get("IN_CATEGORY", []) if c})
            types      = sorted({t for t in relations.get("OF_TYPE", []) if t})

            attrs = []
            if authors:    attrs.append(f"Autores: {', '.join(authors)}")
            if categories: attrs.append(f"Categoría: {', '.join(categories)}")
            if types:      attrs.append(f"Tipo: {', '.join(types)}")
            if keywords:   attrs.append(f"Keywords: {', '.join(keywords)}")
            attrs_text = " | ".join(attrs) if attrs else "(sin metadatos)"
            lines.append(f"- {article_title(article)} — {attrs_text}")

        text = "\n".join(lines)
        if len(text) > max_chars:
            text = text[:max_chars].rsplit("\n", 1)[0] + "\n[... grafo truncado ...]"
        return text

    def get_user_graph_stats(self, user_id: str) -> Dict[str, Any]:
        """Devuelve el resumen del grafo del usuario."""
        if not user_id:
            return {"enabled": False, "stats": self._empty_stats()}

        if not self.repo.is_available():
            return {"enabled": False, "stats": self._empty_stats(), "message": "Neo4j no configurado"}

        try:
            stats = self.repo.get_user_graph_stats(user_id=str(user_id))
            return {"enabled": True, "stats": stats}
        except Exception as exc:
            logger.warning("No se pudieron leer stats del grafo: %s", exc)
            return {"enabled": False, "stats": self._empty_stats(), "message": "Error consultando el grafo"}

    async def sync_all_from_mongo(self) -> Dict[str, Any]:
        """
        Lee todos los artículos elegibles en MongoDB y los vuelca al grafo
        con MERGE (no duplica; cubre artículos antiguos sin pasar por el hook).

        Pensado para ejecutarse una vez al iniciar el servidor.
        """
        if not self.is_available():
            logger.info(
                "Sincronización grafo-artículos omitida: Neo4j no configurado o no accesible",
            )
            return {
                "ran": False,
                "reason": "neo4j_unavailable",
                "total": 0,
                "ingested_ok": 0,
                "failed": 0,
            }

        article_repo = ArticleRepository()
        try:
            articles = await article_repo.find_all_for_article_graph_sync()
        except Exception as exc:
            logger.warning("No se pudo leer artículos para sincronizar el grafo: %s", exc)
            return {
                "ran": False,
                "reason": "mongo_error",
                "error": str(exc),
                "total": 0,
                "ingested_ok": 0,
                "failed": 0,
            }

        ingested_ok = 0
        failed = 0
        for article in articles:
            try:
                ok = await asyncio.to_thread(self.ingest_article, article)
                if ok:
                    ingested_ok += 1
                else:
                    failed += 1
            except Exception as exc:
                failed += 1
                logger.warning(
                    "Fallo al sincronizar articulo %s en Neo4j: %s",
                    article.get("_id"),
                    exc,
                )

        logger.info(
            "Sincronización grafo-artículos completada: %s documentos MongoDB, %s ingestados en Neo4j, %s fallidos",
            len(articles),
            ingested_ok,
            failed,
        )

        return {
            "ran": True,
            "total": len(articles),
            "ingested_ok": ingested_ok,
            "failed": failed,
        }

    def _empty_graph(self, message: Optional[str] = None) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "enabled": False,
            "nodes": [],
            "edges": [],
            "stats": self._empty_stats(),
        }
        if message:
            payload["message"] = message
        return payload

    def _empty_stats(self) -> Dict[str, int]:
        return {
            "articles": 0,
            "authors": 0,
            "keywords": 0,
            "categories": 0,
            "types": 0,
            "relationships": 0,
        }

    def compute_embeddings(self, user_id: str) -> Dict[str, Any]:
        """
        Proyecta el grafo del usuario, ejecuta FastRP (write mode) y
        limpia la proyección en memoria.

        Los embeddings quedan persistidos en Neo4j como propiedad de cada
        nodo. Pueden reutilizarse en llamadas sucesivas a find_similar_nodes
        sin necesidad de recomputar, hasta que se llame a clear_embeddings.
        """
        if not self.repo.is_available():
            return {"success": False, "reason": "Neo4j no disponible"}

        if not self.repo.has_gds_support():
            try:
                nodes = self.repo.get_nodes_needing_embeddings(user_id=str(user_id))
                if nodes:
                    from app.ai_assistant.config import get_embeddings as get_emb_model
                    embedding_model = get_emb_model()
                    texts = [n["text"].strip() or "(sin texto)" for n in nodes]
                    vectors = embedding_model.embed_documents(texts)
                    pairs = [{"id": n["neo4j_id"], "vec": v} for n, v in zip(nodes, vectors)]
                    self.repo.write_node_embeddings(pairs)
            except Exception as exc:
                logger.error("Error computando embeddings de nodos para usuario %s: %s", user_id, exc)

            text_written = self._compute_article_text_embeddings(str(user_id))
            return {"success": True, "mode": "text", "embeddings_written": text_written}

        try:
            result = self.repo.gds_compute_embeddings(user_id=str(user_id))
        except Exception as exc:
            logger.error("Error computando embeddings para usuario %s: %s", user_id, exc)
            try:
                self.repo.gds_drop_graph(str(user_id))
            except Exception:
                pass
            return {"success": False, "reason": str(exc)}

        text_written = self._compute_article_text_embeddings(str(user_id))
        return {"success": True, **result, "text_embeddings_written": text_written}

    def _compute_article_text_embeddings(self, user_id: str) -> int:
        """
        Calcula embeddings semánticos de texto (título + abstract + keywords)
        para artículos que todavía no tienen text_embedding en Neo4j.
        Devuelve el número de artículos procesados.
        """
        try:
            articles = self.repo.get_articles_needing_text_embeddings(user_id)
            if not articles:
                return 0

            from app.ai_assistant.config import get_embeddings as get_emb_model
            embedding_model = get_emb_model()

            texts = []
            for a in articles:
                parts = [a["title"]]
                if a["abstract"]:
                    parts.append(a["abstract"][:600])
                if a["keywords"]:
                    parts.append(", ".join(a["keywords"][:15]))
                texts.append(" | ".join(filter(None, parts)) or "(sin texto)")

            vectors = embedding_model.embed_documents(texts)
            pairs = [{"id": a["neo4j_id"], "vec": v} for a, v in zip(articles, vectors)]
            count = self.repo.write_article_text_embeddings(pairs)
            logger.info(
                "text_embedding calculado para %s artículos del usuario %s",
                count, user_id,
            )
            return count
        except Exception as exc:
            logger.warning(
                "No se pudieron calcular text_embeddings para usuario %s: %s",
                user_id, exc,
            )
            return 0

    def find_similar_nodes(
        self,
        user_id: str,
        node_label: str,
        node_id_prop: str,
        node_id_value: str,
        label_prop: str,
        min_similarity: float = 0.7,
        top_k: int = 10,
    ) -> Dict[str, Any]:
        """
        Devuelve nodos similares (por embedding coseno) al nodo dado.
        Genérico: funciona con cualquier etiqueta Neo4j del grafo.
        Requiere que los embeddings estén ya computados
        """
        if not self.repo.is_available():
            return {"success": False, "reason": "Neo4j no disponible", "results": []}

        try:
            results = self.repo.find_similar_nodes(
                user_id=str(user_id),
                node_label=node_label,
                node_id_prop=node_id_prop,
                node_id_value=node_id_value,
                label_prop=label_prop,
                min_similarity=min_similarity,
                top_k=top_k,
            )
            return {
                "success": True,
                "node_label": node_label,
                "node_id": node_id_value,
                "min_similarity": min_similarity,
                "results": results,
            }
        except Exception as exc:
            logger.error(
                "Error buscando nodos similares a %s=%s (usuario %s): %s",
                node_id_prop, node_id_value, user_id, exc,
            )
            return {"success": False, "reason": str(exc), "results": []}

    def get_hybrid_graph_context(
        self,
        user_id: str,
        seed_article_ids: List[str],
        top_similar_per_seed: int = 4,
        min_similarity: float = 0.50,
        max_total_articles: int = 12,
    ) -> Dict[str, Any]:
        """
        Búsqueda híbrida: expande los artículos semilla (del RAG vectorial FAISS)
        usando el grafo Neo4j para obtener:
          - Vecindario estructural (autores, keywords, categorías, tipos).
          - Artículos semánticamente similares por embeddings coseno.
        """
        fallback: Dict[str, Any] = {
            "formatted_context": "",
            "similarity_pairs": [],
        }

        if not user_id or not seed_article_ids or not self.repo.is_available():
            return fallback

        try:
            neighborhood = self._safe_get_neighborhood(user_id, seed_article_ids)

            similarity_pairs, _ = self._compute_similar_articles(
                user_id=user_id,
                seed_ids=seed_article_ids,
                top_k_per_seed=top_similar_per_seed,
                min_score=min_similarity,
            )

            formatted = self._format_graph_context(
                neighborhood=neighborhood,
                similarity_pairs=similarity_pairs,
            )

            return {
                "formatted_context": formatted,
                "similarity_pairs": similarity_pairs,
            }

        except Exception as exc:
            logger.warning(
                "get_hybrid_graph_context falló para user_id=%s: %s", user_id, exc, exc_info=True
            )
            return fallback

    def _safe_get_neighborhood(
        self, user_id: str, article_ids: List[str]
    ) -> List[Dict[str, Any]]:
        """Obtiene el vecindario estructural de los artículos dados, tolerando errores."""
        if not article_ids:
            return []
        try:
            return self.repo.get_article_neighborhood(user_id=user_id, article_ids=article_ids)
        except Exception as exc:
            logger.warning("Error obteniendo vecindario de artículos: %s", exc)
            return []

    def _compute_similar_articles(
        self,
        user_id: str,
        seed_ids: List[str],
        top_k_per_seed: int,
        min_score: float,
    ) -> tuple:
        """
        Calcula similitud coseno ENTRE los artículos semilla (los del RAG)
        usando los embeddings almacenados en Neo4j.
        """
        import numpy as np

        try:
            all_embeddings = self.repo.get_all_article_embeddings(user_id)
        except Exception as exc:
            logger.warning("No se pudieron cargar embeddings para GraphRAG: %s", exc)
            return [], []

        if len(all_embeddings) < 2:
            return [], []

        seed_set = set(seed_ids)
        # Filtrar solo los artículos que son semillas y tienen embedding
        id_list: List[str] = []
        vec_list: List[Any] = []
        meta: Dict[str, Dict[str, Any]] = {}
        for ae in all_embeddings:
            aid = str(ae.get("article_id") or "")
            if not aid or aid not in seed_set:
                continue
            v = np.array(ae["embedding"], dtype=np.float32)
            norm = float(np.linalg.norm(v))
            vec_list.append(v / norm if norm > 1e-9 else v)
            id_list.append(aid)
            meta[aid] = ae

        if len(id_list) < 2:
            return [], []

        pairs: List[Dict[str, Any]] = []

        for i in range(len(id_list)):
            for j in range(i + 1, len(id_list)):
                score = float(np.dot(vec_list[i], vec_list[j]))
                if score < min_score:
                    continue
                aid_i, aid_j = id_list[i], id_list[j]
                da, db = meta[aid_i], meta[aid_j]
                pairs.append({
                    "article_id_a": aid_i,
                    "title_a": da.get("title") or aid_i,
                    "year_a": da.get("year"),
                    "article_id_b": aid_j,
                    "title_b": db.get("title") or aid_j,
                    "year_b": db.get("year"),
                    "score": round(score, 4),
                })

        pairs.sort(key=lambda p: -p["score"])
        max_pairs = top_k_per_seed * max(1, len(seed_set))
        return pairs[:max_pairs], []

    @staticmethod
    def _format_graph_context(
        neighborhood: List[Dict[str, Any]],
        similarity_pairs: List[Dict[str, Any]],
    ) -> str:
        """
        Serializa el subgrafo en un bloque de texto estructurado para el LLM.
        """
        if not neighborhood and not similarity_pairs:
            return ""

        lines: List[str] = [
            "=== CONTEXTO DEL GRAFO DE CONOCIMIENTO ===",
            "(Relaciones entre los artículos recuperados por el RAG."
            " Úsalas para comparar, contrastar e identificar conexiones.)",
            "",
        ]

        if neighborhood:
            lines.append("CONEXIONES ESTRUCTURALES DE LOS ARTÍCULOS:")
            lines.append("")
            for item in neighborhood:
                aid = item.get("article_id", "?")
                title = item.get("title") or aid
                year = item.get("year")
                year_str = f" ({year})" if year else ""
                lines.append(f'  "{title}"{year_str}')
                authors: List[str] = item.get("authors") or []
                keywords: List[str] = item.get("keywords") or []
                categories: List[str] = item.get("categories") or []
                types: List[str] = item.get("types") or []
                if authors:
                    lines.append(f"    Autores   : {', '.join(authors)}")
                if categories:
                    lines.append(f"    Categoría : {', '.join(categories)}")
                if types:
                    lines.append(f"    Tipo      : {', '.join(types)}")
                if keywords:
                    kw_str = ", ".join(keywords[:10])
                    if len(keywords) > 10:
                        kw_str += f" (+{len(keywords) - 10} más)"
                    lines.append(f"    Keywords  : {kw_str}")
                lines.append("")

        if similarity_pairs:
            lines.append("SIMILITUD SEMÁNTICA ENTRE LOS ARTÍCULOS RECUPERADOS:")
            lines.append("")
            for pair in similarity_pairs:
                pct = int(round(pair["score"] * 100))
                label = "MUY SIMILAR" if pct >= 85 else ("SIMILAR" if pct >= 65 else "RELACIONADO")
                ta = f'"{pair["title_a"]}"' + (f' ({pair["year_a"]})' if pair.get("year_a") else "")
                tb = f'"{pair["title_b"]}"' + (f' ({pair["year_b"]})' if pair.get("year_b") else "")
                lines.append(f"  {ta}")
                lines.append(f"    ↔ {tb}")
                lines.append(f"    [{label} — {pct}% similitud semántica]")
                lines.append("")

        lines.append("=== FIN DEL CONTEXTO DEL GRAFO ===")
        return "\n".join(lines)

    def get_embedding_status(self, user_id: str) -> Dict[str, Any]:
        if not self.repo.is_available():
            return {"available": False}

        try:
            status = self.repo.get_embedding_status(user_id=str(user_id))
            return {"available": True, **status}
        except Exception as exc:
            logger.error("Error obteniendo estado de embeddings: %s", exc)
            return {"available": False, "reason": str(exc)}

    def clear_embeddings(self, user_id: str) -> Dict[str, Any]:
        """
        Elimina los embeddings de todos los nodos del usuario.
        """
        if not self.repo.is_available():
            return {"success": False, "reason": "Neo4j no disponible"}

        try:
            self.repo.gds_drop_graph(str(user_id))
            cleared = self.repo.clear_embeddings(user_id=str(user_id))
            return {"success": True, "cleared": cleared}
        except Exception as exc:
            logger.error("Error limpiando embeddings para usuario %s: %s", user_id, exc)
            return {"success": False, "reason": str(exc)}

    def _extract_string(self, value: Any) -> Optional[str]:
        if value is None:
            return None
        if isinstance(value, str):
            text = value.strip()
            return text or None
        return None

    def _extract_year(self, value: Any) -> Optional[int]:
        if value is None:
            return None
        if isinstance(value, int):
            return value if 1000 <= value <= 9999 else None
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return None
            if stripped[:4].isdigit():
                return int(stripped[:4])
        return None

    def _extract_authors(self, value: Any) -> List[str]:
        if value is None:
            return []
        if isinstance(value, str):
            return [part.strip() for part in value.split(",") if part.strip()]
        if not isinstance(value, list):
            return []

        authors: List[str] = []
        for item in value:
            if item is None:
                continue
            if isinstance(item, str):
                text = item.strip()
                if text:
                    authors.append(text)
                continue
            if isinstance(item, dict):
                raw = (
                    item.get("display_name")
                    or item.get("name")
                    or item.get("author")
                )
                if raw is None:
                    nested = item.get("author")
                    if isinstance(nested, dict):
                        raw = nested.get("display_name") or nested.get("name")
                if raw is not None:
                    text = str(raw).strip()
                    if text:
                        authors.append(text)
        return authors

    def _extract_keywords(self, value: Any) -> List[str]:
        if value is None:
            return []
        if isinstance(value, str):
            parts = re.split(r"[;,]", value)
            return [p.strip() for p in parts if p.strip()]
        if not isinstance(value, list):
            return []

        keywords: List[str] = []
        for item in value:
            if item is None:
                continue
            if isinstance(item, str):
                text = item.strip()
                if text:
                    keywords.append(text)
                continue
            if isinstance(item, dict):
                raw = item.get("key") or item.get("display_name") or item.get("name")
                if raw is None:
                    continue
                text = str(raw).strip()
                if text:
                    keywords.append(text)

        seen = set()
        unique_keywords: List[str] = []
        for kw in keywords:
            lowered = kw.lower()
            if lowered not in seen:
                seen.add(lowered)
                unique_keywords.append(kw)
        return unique_keywords
