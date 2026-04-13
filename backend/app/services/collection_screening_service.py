import logging
from typing import List, Tuple

from app.ai_assistant.agents.base_agents.base_agent import BaseAgent
from app.ai_assistant.agents.base_agents.rag_engine import RagEngine
from app.ai_assistant.config import (
    get_collection_screening_config,
    get_rag_strategy_config,
)
from app.models import (
    ScreeningDecisionData,
    ScreeningDecisionLLMResult,
)
from app.repositories import ArticleRepository
from app.services.collection_service import CollectionService
from app.services.screening_decision_service import ScreeningDecisionService
from app.services.storage_service import StorageService
from app.services.vector_index_service import VectorIndexService

logger = logging.getLogger(__name__)

SCREENING_SYSTEM_PROMPT = """
Eres un asistente de cribado bibliografico.
Tu tarea es decidir si un articulo debe incluirse, revisarse manualmente o excluirse
respecto a una pregunta de investigacion.

REGLAS:
1. Usa solo el contexto proporcionado.
2. Si el articulo encaja claramente, usa include.
3. Si el articulo contradice claramente la pregunta o los criterios, usa exclude.
4. Si falta informacion o hay ambiguedad, usa review.
5. La razon debe ser breve, concreta y basada en el contexto.
6. Devuelve siempre la razon en espanol, aunque el contexto fuente este en ingles.
7. La confianza debe ir de 0 a 1.
""".strip()

NO_CONTEXT_MARKERS = (
    "NO HAY CONTEXTO DISPONIBLE",
    "NO SE ENCONTR",
)


def _criteria_block(label: str, items: List[str]) -> str:
    if not items:
        return f"{label}: ninguno"
    return f"{label}: " + "; ".join(item.strip() for item in items if item and item.strip())


def _build_screening_query(
    research_question: str,
    inclusion_criteria: List[str],
    exclusion_criteria: List[str],
) -> str:
    return "\n".join(
        [
            f"Pregunta de investigacion: {research_question}",
            _criteria_block("Criterios de inclusion", inclusion_criteria),
            _criteria_block("Criterios de exclusion", exclusion_criteria),
        ]
    )


def _has_rag_context(rag_context: str) -> bool:
    if not rag_context:
        return False
    return all(marker not in rag_context for marker in NO_CONTEXT_MARKERS)


def _build_metadata_context(article: dict) -> str:
    return (
        f"TITULO: {article.get('title')}\n"
        f"ANO: {article.get('year')}\n"
        f"AUTORES: {article.get('authors')}\n"
        f"CATEGORIA: {article.get('category')}\n"
        f"TIPO: {article.get('type')}\n"
        f"ABSTRACT: {article.get('abstract')}\n"
        f"SUMMARY: {article.get('summary')}\n"
        f"KEYWORDS: {article.get('keywords')}\n"
        f"OBSERVACIONES: {article.get('observations')}\n"
    )


class CollectionScreeningService:
    def __init__(self):
        self.article_repo = ArticleRepository()
        self.collection_service = CollectionService()
        self.screening_decision_service = ScreeningDecisionService()
        self.storage_service = StorageService()

    def _build_agents(self) -> Tuple[BaseAgent, RagEngine, VectorIndexService]:
        config = get_collection_screening_config()
        llm_agent = BaseAgent(
            modelo=config["modelo"],
            temperatura=config["temperatura"],
            offline=config["offline"],
            system_prompt=SCREENING_SYSTEM_PROMPT,
        )
        llm_agent.set_structured_output(ScreeningDecisionLLMResult)

        rag_engine = RagEngine(
            modelo=config["modelo"],
            temperatura=config["temperatura"],
            offline=config["offline"],
            system_prompt="",
            text_splitter=config["text_splitter"],
            embedding_model=config["embedding_model"],
        )

        vector_index_service = VectorIndexService(
            embedding_model=config["embedding_model"],
            text_splitter=config["text_splitter"],
        )
        return llm_agent, rag_engine, vector_index_service

    def _load_article_context(
        self,
        *,
        rag_engine: RagEngine,
        vector_index_service: VectorIndexService,
        user_id: str,
        article: dict,
        screening_query: str,
    ) -> Tuple[str, str]:
        article_id = str(article.get("_id"))
        faiss_dir = self.storage_service.get_faiss_article_dir(
            user_id=user_id,
            article_id=article_id,
        )
        faiss_file = faiss_dir / "index.faiss"

        if faiss_file.exists():
            try:
                rag_engine.vector_store = vector_index_service.load_index(str(faiss_dir))
                strategy = get_rag_strategy_config()
                strategy["k"] = max(4, int(strategy.get("k", 8)))
                strategy["max_context_chars"] = max(6000, int(strategy.get("max_context_chars", 12000)))
                rag_context = rag_engine.retrieve(
                    user_message=screening_query,
                    strategy=strategy,
                )
                if _has_rag_context(rag_context):
                    return rag_context, "full_text"
            except Exception as exc:
                logger.warning("No se pudo cargar contexto FAISS para %s: %s", article_id, exc)

        return _build_metadata_context(article), "metadata"

    def _build_prompt(
        self,
        *,
        article: dict,
        research_question: str,
        inclusion_criteria: List[str],
        exclusion_criteria: List[str],
        context: str,
        source_type: str,
    ) -> str:
        return (
            f"Articulo: {article.get('title') or article.get('_id')}\n"
            f"Fuente principal usada: {source_type}\n"
            f"Pregunta de investigacion: {research_question}\n"
            f"{_criteria_block('Criterios de inclusion', inclusion_criteria)}\n"
            f"{_criteria_block('Criterios de exclusion', exclusion_criteria)}\n\n"
            f"Contexto disponible:\n{context}"
        )

    async def run_collection_screening(
        self,
        *,
        run_id: str,
        user_id: str,
        collection_id: str,
        research_question: str,
        inclusion_criteria: List[str] | None = None,
        exclusion_criteria: List[str] | None = None,
    ) -> dict:
        inclusion_criteria = inclusion_criteria or []
        exclusion_criteria = exclusion_criteria or []

        exists = await self.collection_service.collection_exists(user_id=user_id, collection_id=collection_id)
        if not exists:
            raise ValueError("La coleccion no existe o no pertenece al usuario")

        mongo_articles = await self.article_repo.get_articles_for_metadata_index(
            user_id=user_id,
            collection_id=collection_id,
        )
        articles = [
            article
            for article in mongo_articles
            if article.get("status") not in {"processing", "error"}
        ]

        if not articles:
            return {
                "run_id": run_id,
                "collection_id": collection_id,
                "research_question": research_question,
                "total_articles": 0,
                "processed_articles": 0,
                "counts": {"include": 0, "review": 0, "exclude": 0},
            }

        llm_agent, rag_engine, vector_index_service = self._build_agents()
        screening_query = _build_screening_query(
            research_question=research_question,
            inclusion_criteria=inclusion_criteria,
            exclusion_criteria=exclusion_criteria,
        )

        counts = {"include": 0, "review": 0, "exclude": 0}
        processed_articles = 0

        for article in articles:
            context, source_type = self._load_article_context(
                rag_engine=rag_engine,
                vector_index_service=vector_index_service,
                user_id=user_id,
                article=article,
                screening_query=screening_query,
            )

            try:
                prompt = llm_agent.create_prompt(
                    self._build_prompt(
                        article=article,
                        research_question=research_question,
                        inclusion_criteria=inclusion_criteria,
                        exclusion_criteria=exclusion_criteria,
                        context=context,
                        source_type=source_type,
                    )
                )
                result = ScreeningDecisionLLMResult.model_validate(
                    llm_agent.invoke(prompt, structured_output=True)
                )
            except Exception as exc:
                logger.warning(
                    "Fallo analizando screening para article_id=%s: %s",
                    article.get("_id"),
                    exc,
                )
                result = ScreeningDecisionLLMResult(
                    decision="review",
                    reason="No se pudo analizar el articulo de forma fiable. Requiere revision manual.",
                    confidence=0.0,
                )

            decision_data = ScreeningDecisionData(
                run_id=run_id,
                article_id=str(article.get("_id")),
                article_title=article.get("title"),
                decision=result.decision,
                reason=result.reason,
                confidence=result.confidence,
                source_type=source_type,
            )
            await self.screening_decision_service.save_decision(
                user_id=user_id,
                decision_data=decision_data,
            )

            counts[result.decision] += 1
            processed_articles += 1

        return {
            "run_id": run_id,
            "collection_id": collection_id,
            "research_question": research_question,
            "total_articles": len(articles),
            "processed_articles": processed_articles,
            "counts": counts,
        }
