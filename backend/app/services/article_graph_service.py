"""Servicio del grafo de artículos (Neo4j).

Construye y consulta un grafo por usuario en Neo4j a partir de los
metadatos de cada artículo (Article, Author, Keyword, Category, Type) y
opcionalmente un KG semántico (Entity) generado mediante LLM. Las
operaciones de escritura son idempotentes (``MERGE``) y las de lectura
tratan las aristas como **no dirigidas** para que el enrutador del
frontend no dependa del sentido de la relación.

Si Neo4j no está configurado, el servicio se comporta como no-op para
no romper el flujo principal de la aplicación.
"""
import asyncio
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from app.repositories.article_graph_repository import ArticleGraphRepository
from app.repositories.article_repository import ArticleRepository

logger = logging.getLogger(__name__)

_EXPANSION_PROGRESS: Dict[str, Dict[str, Any]] = {}
_EMPTY_STATS: Dict[str, int] = {
    "articles": 0, "authors": 0, "keywords": 0,
    "categories": 0, "types": 0, "relationships": 0,
}


class ArticleGraphService:
    """Capa de servicio para el grafo de artículos."""

    def __init__(self):
        self.repo = ArticleGraphRepository()

    def is_available(self) -> bool:
        """Indica si Neo4j está disponible."""
        return self.repo.is_available()

    def ingest_article(self, article: Dict[str, Any], user_id: Optional[str] = None) -> bool:
        """Incorpora un artículo al grafo, tolerando errores silenciosamente."""
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
            logger.warning("No se pudo ingerir el articulo %s en el grafo: %s", article_id, exc)
            return False

    def remove_article(self, article_id: str, user_id: str) -> bool:
        """Elimina un artículo y sus nodos huérfanos del grafo."""
        if not article_id or not user_id:
            return False
        try:
            return self.repo.delete_article(user_id=str(user_id), article_id=str(article_id))
        except Exception as exc:
            logger.warning("No se pudo eliminar el articulo %s del grafo: %s", article_id, exc)
            return False

    def get_user_graph(self, user_id: str, limit: int = 250) -> Dict[str, Any]:
        """Devuelve el grafo del usuario unificando el grafo base y el KG semántico."""
        if not user_id:
            return self._empty_graph()
        if not self.repo.is_available():
            return self._empty_graph(message="Neo4j no configurado")

        try:
            graph = self.repo.get_user_graph(user_id=str(user_id), limit=limit)
            stats = self.repo.get_user_graph_stats(user_id=str(user_id))
            kg = self.repo.get_kg_nodes_and_edges(user_id=str(user_id), limit=limit)

            existing_ids = {n["id"] for n in graph.get("nodes", [])}
            new_kg_nodes = [n for n in kg.get("nodes", []) if n["id"] not in existing_ids]

            return {
                "enabled": True,
                "nodes": graph.get("nodes", []) + new_kg_nodes,
                "edges": graph.get("edges", []) + kg.get("edges", []),
                "stats": stats,
            }
        except Exception as exc:
            logger.warning("No se pudo recuperar el grafo del usuario %s: %s", user_id, exc)
            return self._empty_graph(message="Error consultando el grafo")

    def get_user_graph_stats(self, user_id: str) -> Dict[str, Any]:
        """Devuelve un resumen del grafo del usuario."""
        if not user_id:
            return {"enabled": False, "stats": dict(_EMPTY_STATS)}
        if not self.repo.is_available():
            return {"enabled": False, "stats": dict(_EMPTY_STATS), "message": "Neo4j no configurado"}

        try:
            return {"enabled": True, "stats": self.repo.get_user_graph_stats(user_id=str(user_id))}
        except Exception as exc:
            logger.warning("No se pudieron leer stats del grafo: %s", exc)
            return {"enabled": False, "stats": dict(_EMPTY_STATS), "message": "Error consultando el grafo"}

    def expand_articles(
        self,
        user_id: str,
        type_limits: Optional[Dict[str, int]] = None,
    ) -> None:
        """Expande el KG semántico para todos los artículos del usuario aún no expandidos.

        ``type_limits`` (opcional) restringe cuántos nodos de cada tipo puede
        generar el LLM por artículo. Si es ``None`` o ``{}`` no se aplica límite.
        """
        from app.services.knowledge_graph_service import KnowledgeGraphService
        from pymongo import MongoClient
        from app.config import settings as _settings

        uid = str(user_id)
        _EXPANSION_PROGRESS[uid] = {
            "status": "running", "total": 0, "current": 0, "article": "",
            "type_limits": dict(type_limits or {}),
        }

        kg_service = KnowledgeGraphService()
        mongo = MongoClient(_settings.MONGODB_URL)
        try:
            try:
                removed = self.repo.cleanup_naked_papers(user_id=uid)
                if removed:
                    logger.info("[KG] Limpiados %d Paper sin entidades antes de expandir (uid=%s)", removed, uid)
            except Exception as exc:
                logger.warning("[KG] No se pudieron limpiar Paper huérfanos (uid=%s): %s", uid, exc)

            db = mongo[_settings.DATABASE_NAME]
            articles = list(
                db["articles"].find(
                    {"id_user": uid},
                    {
                        "_id": 1, "title": 1, "id_pdf": 1, "source": 1,
                        "collection_ids": 1,
                    },
                )
            )
            expanded_ids = self.repo.get_expanded_article_ids(user_id=uid)
            pending = [a for a in articles if str(a["_id"]) not in expanded_ids]
            total = len(pending)
            _EXPANSION_PROGRESS[uid]["total"] = total

            if total == 0:
                _EXPANSION_PROGRESS[uid] = {
                    "status": "done", "total": 0, "current": 0, "article": "",
                    "ok": 0, "failed": 0, "skipped": 0,
                }
                return

            ok_count = 0
            fail_count = 0
            skipped_count = 0
            for index, article in enumerate(pending):
                _EXPANSION_PROGRESS[uid]["current"] = index
                _EXPANSION_PROGRESS[uid]["article"] = (article.get("title") or "")[:60]
                article["_id"] = str(article["_id"])
                try:
                    result = kg_service.ingest_article_record(
                        article=article, user_id=uid, type_limits=type_limits,
                    )
                    if result.get("skipped"):
                        skipped_count += 1
                        logger.info("[KG] Artículo %s omitido: %s",
                                    article["_id"], result.get("message", "sin razón"))
                    elif result.get("enabled", True):
                        ok_count += 1
                        logger.info("[KG] Artículo %s expandido: %d nodos, %d relaciones",
                                    article["_id"], result.get("nodes", 0), result.get("relations", 0))
                    else:
                        fail_count += 1
                        logger.warning("[KG] Artículo %s NO expandido: %s",
                                       article["_id"], result.get("message", "desconocido"))
                except Exception as exc:
                    fail_count += 1
                    logger.warning("Error expandiendo artículo %s: %s", article["_id"], exc)

            _EXPANSION_PROGRESS[uid] = {
                "status": "done", "total": total, "current": total, "article": "",
                "ok": ok_count, "failed": fail_count, "skipped": skipped_count,
            }
        except Exception as exc:
            logger.error("Expansión fallida para usuario %s: %s", user_id, exc)
            _EXPANSION_PROGRESS[uid] = {"status": "error", "total": 0, "current": 0, "article": ""}
        finally:
            mongo.close()
            kg_service.close()

    def get_expansion_status(self, user_id: str) -> Dict[str, Any]:
        """Devuelve el estado actual de expansión del usuario."""
        default = {
            "status": "idle", "total": 0, "current": 0, "article": "",
            "ok": 0, "failed": 0, "skipped": 0,
        }
        return dict(_EXPANSION_PROGRESS.get(str(user_id), default))

    async def sync_all_from_mongo(self) -> Dict[str, Any]:
        """Vuelca todos los artículos de MongoDB al grafo con MERGE (idempotente)."""
        if not self.is_available():
            logger.info("Sincronización grafo-artículos omitida: Neo4j no configurado o no accesible")
            return {"ran": False, "reason": "neo4j_unavailable", "total": 0, "ingested_ok": 0, "failed": 0}

        article_repo = ArticleRepository()
        try:
            articles = await article_repo.find_all_for_article_graph_sync()
        except Exception as exc:
            logger.warning("No se pudo leer artículos para sincronizar el grafo: %s", exc)
            return {
                "ran": False, "reason": "mongo_error", "error": str(exc),
                "total": 0, "ingested_ok": 0, "failed": 0,
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
                    "Fallo al sincronizar articulo %s en Neo4j: %s", article.get("_id"), exc,
                )

        logger.info(
            "Sincronización grafo-artículos completada: %s documentos, %s ingestados, %s fallidos",
            len(articles), ingested_ok, failed,
        )
        return {"ran": True, "total": len(articles), "ingested_ok": ingested_ok, "failed": failed}

    def compute_embeddings(self, user_id: str) -> Dict[str, Any]:
        """Calcula embeddings estructurales (FastRP) y semánticos (texto) en Neo4j."""
        if not self.repo.is_available():
            return {"success": False, "reason": "Neo4j no disponible"}

        if not self.repo.has_gds_support():
            self._compute_node_text_embeddings(str(user_id))
            written = self._compute_article_text_embeddings(str(user_id))
            return {"success": True, "mode": "text", "embeddings_written": written}

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

    def _compute_node_text_embeddings(self, user_id: str) -> None:
        """Genera y persiste embeddings de texto para los nodos sin embedding FastRP."""
        try:
            nodes = self.repo.get_nodes_needing_embeddings(user_id=user_id)
            if not nodes:
                return
            from app.ai_assistant.config import get_embeddings

            embedding_model = get_embeddings()
            texts = [(n["text"] or "").strip() or "(sin texto)" for n in nodes]
            vectors = embedding_model.embed_documents(texts)
            pairs = [{"id": n["neo4j_id"], "vec": v} for n, v in zip(nodes, vectors)]
            self.repo.write_node_embeddings(pairs)
        except Exception as exc:
            logger.error("Error computando embeddings de nodos para usuario %s: %s", user_id, exc)

    def _compute_article_text_embeddings(self, user_id: str) -> int:
        """Calcula embeddings semánticos para artículos sin ``text_embedding`` en Neo4j."""
        try:
            articles = self.repo.get_articles_needing_text_embeddings(user_id)
            if not articles:
                return 0

            from app.services.storage_service import StorageService

            storage = StorageService()
            faiss_base = storage.get_directory("faiss_indexes") / str(user_id)

            pairs, articles_needing_text = self._compute_faiss_based_embeddings(
                articles=articles, faiss_base=faiss_base,
            )

            if articles_needing_text:
                pairs.extend(self._compute_pure_text_embeddings(articles_needing_text))

            if not pairs:
                return 0

            count = self.repo.write_article_text_embeddings(pairs)
            logger.info(
                "text_embedding calculado para %s artículos del usuario %s "
                "(%s desde FAISS, %s desde texto)",
                count, user_id,
                count - len(articles_needing_text),
                len(articles_needing_text),
            )
            return count
        except Exception as exc:
            logger.warning("No se pudieron calcular text_embeddings para usuario %s: %s", user_id, exc)
            return 0

    @staticmethod
    def _compute_faiss_based_embeddings(
        articles: List[Dict[str, Any]],
        faiss_base,
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Promedia los vectores FAISS por artículo cuando existen en disco."""
        import faiss as faiss_lib
        import numpy as np

        pairs: List[Dict[str, Any]] = []
        pending: List[Dict[str, Any]] = []

        for article in articles:
            faiss_file = faiss_base / article["article_id"] / "index.faiss"
            if not faiss_file.exists():
                pending.append(article)
                continue
            try:
                index = faiss_lib.read_index(str(faiss_file))
                if index.ntotal <= 0:
                    pending.append(article)
                    continue
                vectors = index.reconstruct_n(0, index.ntotal)
                mean_vec = vectors.mean(axis=0).astype(np.float32)
                norm = float(np.linalg.norm(mean_vec))
                if norm > 1e-9:
                    mean_vec = mean_vec / norm
                pairs.append({"id": article["neo4j_id"], "vec": mean_vec.tolist()})
            except Exception as exc:
                logger.warning(
                    "No se pudo leer FAISS para artículo %s, usando fallback: %s",
                    article["article_id"], exc,
                )
                pending.append(article)

        return pairs, pending

    @staticmethod
    def _compute_pure_text_embeddings(articles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Genera embeddings a partir de título, abstract y keywords."""
        from app.ai_assistant.config import get_embeddings

        embedding_model = get_embeddings()
        texts = []
        for article in articles:
            parts = [article["title"]]
            if article["abstract"]:
                parts.append(article["abstract"][:600])
            if article["keywords"]:
                parts.append(", ".join(article["keywords"][:15]))
            texts.append(" | ".join(filter(None, parts)) or "(sin texto)")
        vectors = embedding_model.embed_documents(texts)
        return [{"id": a["neo4j_id"], "vec": v} for a, v in zip(articles, vectors)]

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
        """Devuelve nodos similares (coseno) al nodo dado para cualquier label del grafo."""
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
        """Devuelve contexto del grafo (vecindario + similitudes) para los artículos semilla."""
        fallback: Dict[str, Any] = {"formatted_context": "", "similarity_pairs": []}
        if not user_id or not seed_article_ids or not self.repo.is_available():
            return fallback

        try:
            neighborhood = self._safe_get_neighborhood(user_id, seed_article_ids)
            similarity_pairs = self._compute_similar_articles(
                user_id=user_id,
                seed_ids=seed_article_ids,
                top_k_per_seed=top_similar_per_seed,
                min_score=min_similarity,
            )
            formatted = self._format_graph_context(neighborhood, similarity_pairs)
            return {"formatted_context": formatted, "similarity_pairs": similarity_pairs}
        except Exception as exc:
            logger.warning(
                "get_hybrid_graph_context falló para user_id=%s: %s", user_id, exc, exc_info=True,
            )
            return fallback

    def _safe_get_neighborhood(
        self, user_id: str, article_ids: List[str],
    ) -> List[Dict[str, Any]]:
        """Devuelve el vecindario estructural de los artículos, tolerando errores."""
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
    ) -> List[Dict[str, Any]]:
        """Similitud entre artículos semilla: 80% texto completo + 20% estructura de grafo."""
        import numpy as np

        W_TEXT   = 0.80
        W_STRUCT = 0.20

        try:
            all_embeddings = self.repo.get_all_article_embeddings(user_id)
        except Exception as exc:
            logger.warning("No se pudieron cargar embeddings para GraphRAG: %s", exc)
            return []

        if len(all_embeddings) < 2:
            return []

        def _unit(v: List[float]) -> Any:
            arr = np.array(v, dtype=np.float32)
            norm = float(np.linalg.norm(arr))
            return arr / norm if norm > 1e-9 else arr

        seed_set = set(seed_ids)
        id_list:     List[str]           = []
        text_vecs:   Dict[str, Any]      = {}
        struct_vecs: Dict[str, Any]      = {}
        meta:        Dict[str, Dict[str, Any]] = {}

        for entry in all_embeddings:
            aid = str(entry.get("article_id") or "")
            if not aid or aid not in seed_set:
                continue
            tv = entry.get("text_embedding")
            sv = entry.get("fastrp_embedding")
            if tv is None and sv is None:
                continue
            id_list.append(aid)
            meta[aid] = entry
            if tv is not None:
                text_vecs[aid]   = _unit(tv)
            if sv is not None:
                struct_vecs[aid] = _unit(sv)

        if len(id_list) < 2:
            return []

        pairs: List[Dict[str, Any]] = []
        for i in range(len(id_list)):
            for j in range(i + 1, len(id_list)):
                aid_i, aid_j = id_list[i], id_list[j]

                t_score = (
                    float(np.dot(text_vecs[aid_i], text_vecs[aid_j]))
                    if aid_i in text_vecs and aid_j in text_vecs else None
                )
                s_score = (
                    float(np.dot(struct_vecs[aid_i], struct_vecs[aid_j]))
                    if aid_i in struct_vecs and aid_j in struct_vecs else None
                )

                if t_score is not None and s_score is not None:
                    score = W_TEXT * t_score + W_STRUCT * s_score
                elif t_score is not None:
                    score = t_score          # solo texto disponible
                elif s_score is not None:
                    score = s_score          # solo estructura disponible
                else:
                    continue

                if score < min_score:
                    continue

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
        return pairs[:max_pairs]

    @staticmethod
    def _format_graph_context(
        neighborhood: List[Dict[str, Any]],
        similarity_pairs: List[Dict[str, Any]],
    ) -> str:
        """Serializa el subgrafo en un bloque de texto estructurado para el LLM."""
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
                authors = item.get("authors") or []
                keywords = item.get("keywords") or []
                categories = item.get("categories") or []
                types = item.get("types") or []
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
                # Entidades semánticas del KG (si el grafo fue expandido)
                entities = item.get("entities") or []
                if entities:
                    by_type: Dict[str, List[str]] = {}
                    for ent in entities:
                        etype = ent.get("type") or "Entidad"
                        name  = ent.get("name") or "?"
                        by_type.setdefault(etype, []).append(name)
                    for etype in sorted(by_type):
                        names = by_type[etype]
                        names_str = ", ".join(names[:8])
                        if len(names) > 8:
                            names_str += f" (+{len(names) - 8} más)"
                        lines.append(f"    {etype:<12}: {names_str}")
                # Relaciones semánticas entre entidades
                _REL_LABEL = {
                    "RESUELVE":        "resuelve",
                    "CONSTRUYE_SOBRE": "construye sobre",
                    "USADO_PARA":      "usado para",
                    "RELACIONADO_CON": "relacionado con",
                    "APOYA":           "apoya",
                    "CONTRADICE":      "contradice",
                }
                relations = item.get("relations") or []
                if relations:
                    lines.append("    Relaciones   :")
                    for rel in relations[:15]:
                        verb = _REL_LABEL.get(rel["rel"], rel["rel"].lower())
                        lines.append(f"      · {rel['source']} {verb} {rel['target']}")
                    if len(relations) > 15:
                        lines.append(f"      … (+{len(relations) - 15} más)")
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
        """Devuelve cuántos nodos del usuario tienen embedding calculado."""
        if not self.repo.is_available():
            return {"available": False}
        try:
            return {"available": True, **self.repo.get_embedding_status(user_id=str(user_id))}
        except Exception as exc:
            logger.error("Error obteniendo estado de embeddings: %s", exc)
            return {"available": False, "reason": str(exc)}

    def clear_embeddings(self, user_id: str) -> Dict[str, Any]:
        """Elimina los embeddings de todos los nodos del usuario."""
        if not self.repo.is_available():
            return {"success": False, "reason": "Neo4j no disponible"}
        try:
            self.repo.gds_drop_graph(str(user_id))
            cleared = self.repo.clear_embeddings(user_id=str(user_id))
            return {"success": True, "cleared": cleared}
        except Exception as exc:
            logger.error("Error limpiando embeddings para usuario %s: %s", user_id, exc)
            return {"success": False, "reason": str(exc)}

    @staticmethod
    def _empty_graph(message: Optional[str] = None) -> Dict[str, Any]:
        """Construye una respuesta vacía estándar para el grafo."""
        payload: Dict[str, Any] = {
            "enabled": False,
            "nodes": [],
            "edges": [],
            "stats": dict(_EMPTY_STATS),
        }
        if message:
            payload["message"] = message
        return payload

    @staticmethod
    def _extract_string(value: Any) -> Optional[str]:
        """Devuelve la cadena saneada o ``None``."""
        if isinstance(value, str):
            text = value.strip()
            return text or None
        return None

    @staticmethod
    def _extract_year(value: Any) -> Optional[int]:
        """Parsea un año válido (1000–9999) o devuelve ``None``."""
        if isinstance(value, int):
            return value if 1000 <= value <= 9999 else None
        if isinstance(value, str):
            stripped = value.strip()
            if stripped[:4].isdigit():
                return int(stripped[:4])
        return None

    @staticmethod
    def _extract_authors(value: Any) -> List[str]:
        """Normaliza autores desde string, lista de strings o lista de dicts."""
        if value is None:
            return []
        if isinstance(value, str):
            return [part.strip() for part in value.split(",") if part.strip()]
        if not isinstance(value, list):
            return []

        authors: List[str] = []
        for item in value:
            if isinstance(item, str):
                text = item.strip()
                if text:
                    authors.append(text)
                continue
            if isinstance(item, dict):
                raw = item.get("display_name") or item.get("name") or item.get("author")
                if isinstance(raw, dict):
                    raw = raw.get("display_name") or raw.get("name")
                if raw is None:
                    nested = item.get("author")
                    if isinstance(nested, dict):
                        raw = nested.get("display_name") or nested.get("name")
                if raw is not None:
                    text = str(raw).strip()
                    if text:
                        authors.append(text)
        return authors

    @staticmethod
    def _extract_keywords(value: Any) -> List[str]:
        """Normaliza keywords desde string, lista de strings o lista de dicts (sin duplicados)."""
        if value is None:
            return []
        if isinstance(value, str):
            parts = re.split(r"[;,]", value)
            return [p.strip() for p in parts if p.strip()]
        if not isinstance(value, list):
            return []

        keywords: List[str] = []
        for item in value:
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
        unique: List[str] = []
        for kw in keywords:
            lowered = kw.lower()
            if lowered not in seen:
                seen.add(lowered)
                unique.append(kw)
        return unique
