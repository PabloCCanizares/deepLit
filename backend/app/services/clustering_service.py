import asyncio
import math
import re
from collections import Counter, defaultdict

import numpy as np

from app.ai_assistant.config import get_clustering_config
from app.models import ClusterAssignmentData, ClusterSummary
from app.services.article_extraction_service import ArticleExtractionService
from app.services.cluster_assignment_service import ClusterAssignmentService

CLUSTERING_ALGORITHM_VERSION = "v1.0.0"

STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "from",
    "into",
    "using",
    "based",
    "sobre",
    "para",
    "con",
    "del",
    "las",
    "los",
    "que",
    "una",
    "uno",
    "por",
    "como",
    "study",
    "paper",
    "article",
    "analisis",
    "analysis",
    "methodology",
    "metodologia",
}


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _join_list(values: list[str]) -> str:
    cleaned = [_normalize_text(value) for value in values if _normalize_text(value)]
    return ", ".join(cleaned)


def _tokenize(text: str) -> list[str]:
    tokens = [token.lower() for token in re.findall(r"[A-Za-zÀ-ÿ0-9]{3,}", text or "")]
    return [token for token in tokens if token not in STOPWORDS]


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denominator = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denominator == 0:
        return 0.0
    return float(np.dot(a, b) / denominator)


def _normalize_embeddings(embeddings: np.ndarray) -> np.ndarray:
    if embeddings.size == 0:
        return embeddings
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return embeddings / norms


class ClusteringService:
    def __init__(
        self,
        article_extraction_service: ArticleExtractionService | None = None,
        cluster_assignment_service: ClusterAssignmentService | None = None,
        embedding_model=None,
    ):
        self.article_extraction_service = article_extraction_service or ArticleExtractionService()
        self.cluster_assignment_service = cluster_assignment_service or ClusterAssignmentService()
        if embedding_model is None:
            config = get_clustering_config()
            embedding_model = config["embedding_model"]
        self.embedding_model = embedding_model

    async def run_clustering(
        self,
        *,
        run_id: str,
        user_id: str,
        evidence_extraction_run_id: str,
        requested_cluster_count: int | None = None,
    ) -> dict:
        extractions = await self.article_extraction_service.list_run_extractions(
            user_id=user_id,
            run_id=evidence_extraction_run_id,
        )

        await self.cluster_assignment_service.delete_run_assignments(
            user_id=user_id,
            run_id=run_id,
        )

        if not extractions:
            return {
                "total_articles": 0,
                "processed_articles": 0,
                "selected_cluster_count": 0,
                "algorithm_version": CLUSTERING_ALGORITHM_VERSION,
                "silhouette_score": None,
                "clusters": [],
            }

        profiles = [self._build_article_profile(extraction) for extraction in extractions]
        embeddings = await asyncio.to_thread(self.embedding_model.embed_documents, profiles)
        matrix = np.asarray(embeddings, dtype=float)
        matrix = _normalize_embeddings(matrix)

        selected_k = self._resolve_cluster_count(
            requested_cluster_count=requested_cluster_count,
            article_count=len(extractions),
        )

        if selected_k <= 1:
            labels = np.zeros(len(extractions), dtype=int)
            centroids = np.asarray([matrix.mean(axis=0)], dtype=float)
            silhouette_score = None
        else:
            selected_k, labels, centroids, silhouette_score = self._select_best_k(
                matrix=matrix,
                requested_cluster_count=requested_cluster_count,
                fallback_cluster_count=selected_k,
            )

        clusters = self._build_cluster_summaries(
            labels=labels,
            extractions=extractions,
        )
        cluster_lookup = {cluster.cluster_id: cluster for cluster in clusters}
        numeric_to_cluster_id = self._build_label_map(
            labels=labels,
            clusters=clusters,
        )

        for index, extraction in enumerate(extractions):
            numeric_label = int(labels[index])
            cluster_id = numeric_to_cluster_id[numeric_label]
            cluster = cluster_lookup[cluster_id]
            similarity = _cosine_similarity(matrix[index], centroids[numeric_label])

            await self.cluster_assignment_service.save_assignment(
                user_id=user_id,
                assignment_data=ClusterAssignmentData(
                    run_id=run_id,
                    cluster_id=cluster.cluster_id,
                    cluster_label=cluster.label,
                    article_id=extraction["article_id"],
                    article_title=extraction.get("article_title"),
                    source_type=extraction.get("source_type") or "metadata",
                    objective=extraction.get("objective"),
                    methodology=extraction.get("methodology"),
                    dataset=extraction.get("dataset"),
                    variables=extraction.get("variables") or [],
                    metrics=extraction.get("metrics") or [],
                    similarity_score=similarity,
                ),
            )

        return {
            "total_articles": len(extractions),
            "processed_articles": len(extractions),
            "selected_cluster_count": len(clusters),
            "algorithm_version": CLUSTERING_ALGORITHM_VERSION,
            "silhouette_score": silhouette_score,
            "clusters": [cluster.model_dump() for cluster in clusters],
        }

    def _build_article_profile(self, extraction: dict) -> str:
        sections = [
            f"TITULO: {extraction.get('article_title') or extraction.get('article_id')}",
            f"OBJETIVO: {_normalize_text(extraction.get('objective'))}",
            f"METODOLOGIA: {_normalize_text(extraction.get('methodology'))}",
            f"DATASET: {_normalize_text(extraction.get('dataset'))}",
            f"VARIABLES: {_join_list(extraction.get('variables') or [])}",
            f"METRICAS: {_join_list(extraction.get('metrics') or [])}",
            f"HALLAZGOS: {_join_list(extraction.get('findings') or [])}",
            f"LIMITACIONES: {_join_list(extraction.get('limitations') or [])}",
        ]
        profile = "\n".join(section for section in sections if section.split(": ", 1)[-1].strip())
        return profile or str(extraction.get("article_title") or extraction.get("article_id") or "Articulo")

    def _resolve_cluster_count(
        self,
        *,
        requested_cluster_count: int | None,
        article_count: int,
    ) -> int:
        if article_count <= 1:
            return 1

        max_clusters = max(1, article_count - 1)
        if requested_cluster_count is not None:
            return max(1, min(requested_cluster_count, max_clusters))

        return min(4, max_clusters)

    def _select_best_k(
        self,
        *,
        matrix: np.ndarray,
        requested_cluster_count: int | None,
        fallback_cluster_count: int,
    ) -> tuple[int, np.ndarray, np.ndarray, float | None]:
        article_count = len(matrix)
        if article_count <= 2 or fallback_cluster_count <= 1:
            labels, centroids = self._kmeans(matrix, 1)
            return 1, labels, centroids, None

        if requested_cluster_count and requested_cluster_count > 1:
            fixed_k = self._resolve_cluster_count(
                requested_cluster_count=requested_cluster_count,
                article_count=article_count,
            )
            if fixed_k <= 1:
                labels, centroids = self._kmeans(matrix, 1)
                return 1, labels, centroids, None

            labels, centroids = self._kmeans(matrix, fixed_k)
            score = self._silhouette_score(matrix, labels)
            return fixed_k, labels, centroids, score

        best_k = 1
        best_labels, best_centroids = self._kmeans(matrix, 1)
        best_score = None

        for candidate_k in range(2, min(fallback_cluster_count, article_count - 1) + 1):
            labels, centroids = self._kmeans(matrix, candidate_k)
            score = self._silhouette_score(matrix, labels)
            if score is None:
                continue
            if best_score is None or score > best_score:
                best_k = candidate_k
                best_labels = labels
                best_centroids = centroids
                best_score = score

        return best_k, best_labels, best_centroids, best_score

    def _kmeans(
        self,
        matrix: np.ndarray,
        cluster_count: int,
        max_iterations: int = 40,
    ) -> tuple[np.ndarray, np.ndarray]:
        if cluster_count <= 1 or len(matrix) <= 1:
            centroid = np.asarray([matrix.mean(axis=0)], dtype=float)
            return np.zeros(len(matrix), dtype=int), centroid

        centroids = self._initialize_centroids(matrix, cluster_count)
        labels = np.zeros(len(matrix), dtype=int)

        for _ in range(max_iterations):
            similarities = matrix @ centroids.T
            next_labels = np.argmax(similarities, axis=1)
            if np.array_equal(labels, next_labels):
                break
            labels = next_labels

            next_centroids = []
            for cluster_index in range(cluster_count):
                members = matrix[labels == cluster_index]
                if len(members) == 0:
                    next_centroids.append(centroids[cluster_index])
                    continue
                centroid = members.mean(axis=0)
                norm = np.linalg.norm(centroid)
                if norm == 0:
                    next_centroids.append(centroids[cluster_index])
                else:
                    next_centroids.append(centroid / norm)

            centroids = np.asarray(next_centroids, dtype=float)

        return labels, centroids

    def _initialize_centroids(self, matrix: np.ndarray, cluster_count: int) -> np.ndarray:
        centroids = [matrix[0]]
        selected_indices = {0}

        while len(centroids) < cluster_count:
            best_index = None
            best_distance = -1.0

            for index, vector in enumerate(matrix):
                if index in selected_indices:
                    continue
                similarities = [_cosine_similarity(vector, centroid) for centroid in centroids]
                distance = 1 - max(similarities)
                if distance > best_distance:
                    best_distance = distance
                    best_index = index

            if best_index is None:
                break

            selected_indices.add(best_index)
            centroids.append(matrix[best_index])

        while len(centroids) < cluster_count:
            centroids.append(matrix[len(centroids) % len(matrix)])

        return np.asarray(centroids, dtype=float)

    def _silhouette_score(self, matrix: np.ndarray, labels: np.ndarray) -> float | None:
        unique_labels = np.unique(labels)
        if len(unique_labels) <= 1:
            return None

        similarities = matrix @ matrix.T
        distances = 1 - similarities
        scores = []

        for index in range(len(matrix)):
            own_cluster = labels[index]
            own_mask = labels == own_cluster
            own_indices = np.where(own_mask)[0]

            if len(own_indices) <= 1:
                a_i = 0.0
            else:
                a_i = float(
                    np.mean([distances[index, other] for other in own_indices if other != index])
                )

            b_i = math.inf
            for other_cluster in unique_labels:
                if other_cluster == own_cluster:
                    continue
                other_indices = np.where(labels == other_cluster)[0]
                if len(other_indices) == 0:
                    continue
                distance = float(np.mean(distances[index, other_indices]))
                b_i = min(b_i, distance)

            if not math.isfinite(b_i):
                continue

            denominator = max(a_i, b_i)
            if denominator == 0:
                scores.append(0.0)
            else:
                scores.append((b_i - a_i) / denominator)

        if not scores:
            return None
        return float(np.mean(scores))

    def _build_cluster_summaries(
        self,
        *,
        labels: np.ndarray,
        extractions: list[dict],
    ) -> list[ClusterSummary]:
        grouped: dict[int, list[dict]] = defaultdict(list)
        for index, extraction in enumerate(extractions):
            grouped[int(labels[index])].append(extraction)

        clusters: list[ClusterSummary] = []
        sorted_groups = sorted(
            grouped.items(),
            key=lambda item: (-len(item[1]), item[0]),
        )

        for ordinal, (numeric_label, items) in enumerate(sorted_groups, start=1):
            keywords = self._extract_cluster_keywords(items)
            label = " · ".join(keywords[:2]) if keywords else f"Cluster {ordinal}"
            summary = self._build_cluster_summary(items, keywords)
            clusters.append(
                ClusterSummary(
                    cluster_id=f"cluster_{ordinal}",
                    label=label,
                    summary=summary,
                    size=len(items),
                    keywords=keywords,
                )
            )

        return clusters

    def _build_label_map(
        self,
        *,
        labels: np.ndarray,
        clusters: list[ClusterSummary],
    ) -> dict[int, str]:
        counts = Counter(int(label) for label in labels)
        sorted_numeric_labels = [
            numeric_label
            for numeric_label, _ in sorted(
                counts.items(),
                key=lambda item: (-item[1], item[0]),
            )
        ]
        return {
            numeric_label: clusters[index].cluster_id
            for index, numeric_label in enumerate(sorted_numeric_labels)
        }

    def _extract_cluster_keywords(self, items: list[dict], max_items: int = 4) -> list[str]:
        token_counter = Counter()
        tag_counter = Counter()

        for item in items:
            for value in (item.get("variables") or []) + (item.get("metrics") or []):
                text = _normalize_text(value)
                if text:
                    tag_counter[text] += 1

            combined_text = " ".join(
                [
                    _normalize_text(item.get("objective")),
                    _normalize_text(item.get("methodology")),
                    _normalize_text(item.get("dataset")),
                    _join_list(item.get("findings") or []),
                ]
            )
            token_counter.update(_tokenize(combined_text))

        keywords = [value for value, _ in tag_counter.most_common(max_items)]
        if len(keywords) < max_items:
            keywords.extend(
                token
                for token, _ in token_counter.most_common(max_items)
                if token not in {keyword.casefold() for keyword in keywords}
            )

        deduped: list[str] = []
        seen: set[str] = set()
        for keyword in keywords:
            normalized = keyword.casefold()
            if normalized in seen:
                continue
            seen.add(normalized)
            deduped.append(keyword)
            if len(deduped) >= max_items:
                break

        return deduped

    def _build_cluster_summary(self, items: list[dict], keywords: list[str]) -> str:
        size = len(items)
        if keywords:
            summary = f"Agrupa {size} articulo(s) con foco comun en {', '.join(keywords[:3])}."
        else:
            summary = f"Agrupa {size} articulo(s) con perfiles de evidencia similares."

        methodology_terms = Counter()
        dataset_terms = Counter()
        for item in items:
            methodology_terms.update(_tokenize(_normalize_text(item.get("methodology"))))
            dataset_terms.update(_tokenize(_normalize_text(item.get("dataset"))))

        extras = []
        if methodology_terms:
            extras.append(
                "Metodologia dominante: "
                + ", ".join(token for token, _ in methodology_terms.most_common(2))
            )
        if dataset_terms:
            extras.append(
                "Dataset recurrente: "
                + ", ".join(token for token, _ in dataset_terms.most_common(2))
            )

        if extras:
            return f"{summary} {' '.join(extras)}."
        return summary
