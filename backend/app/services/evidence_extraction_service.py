import asyncio
import logging
import re
from typing import Tuple

from app.ai_assistant.agents.base_agents.base_agent import BaseAgent
from app.ai_assistant.agents.base_agents.rag_engine import RagEngine
from app.ai_assistant.config import (
    get_evidence_extraction_config,
    get_rag_strategy_config,
)
from app.core import ValidationError
from app.models import (
    ArticleExtractionData,
    EvidenceExtractionFindingsResult,
    EvidenceExtractionLLMResult,
    EvidenceExtractionMethodsResult,
    EvidenceExtractionObjectiveResult,
    SupportSnippetReference,
)
from app.repositories import ArticleRepository
from app.services.article_extraction_service import ArticleExtractionService
from app.services.collection_service import CollectionService
from app.services.screening_decision_service import ScreeningDecisionService
from app.services.screening_run_service import ScreeningRunService
from app.services.storage_service import StorageService
from app.services.vector_index_service import VectorIndexService

logger = logging.getLogger(__name__)

EVIDENCE_EXTRACTION_PROMPT_VERSION = "v1.4.0"
EVIDENCE_EXTRACTION_SCHEMA_VERSION = "v1.0.0"
EVIDENCE_EXTRACTION_SYSTEM_PROMPT = """
Eres un extractor de evidencia cientifica.
Tu tarea es transformar un articulo en una ficha estructurada y reutilizable.

REGLAS:
1. Usa solo el contexto proporcionado.
2. Devuelve todos los campos descriptivos en espanol.
3. Si un campo no puede inferirse con fiabilidad, dejalo vacio.
4. `support_snippets` debe contener hasta 3 fragmentos breves del contexto que respalden la extraccion.
5. Si el contexto esta en ingles, puedes resumir en espanol, pero los snippets pueden conservar el idioma original.
6. `confidence` debe ir de 0 a 1 y no debe quedar vacio.
7. No inventes datasets, metricas ni hallazgos.
8. Si el contexto viene separado por bloques, aprovecha esa estructura para cubrir el mayor numero de campos posible.
9. Prioriza extraer tambien metodologia, findings, limitations y future_work cuando haya evidencia suficiente.
10. Mantén los `support_snippets` breves, idealmente de una sola frase o hasta 220 caracteres.
""".strip()

EVIDENCE_EXTRACTION_FACETS = (
    {
        "key": "objective",
        "label": "OBJETIVO Y PREGUNTAS",
        "query": (
            "Identifica el objetivo principal del articulo, sus research questions, "
            "hipotesis o motivacion del estudio."
        ),
    },
    {
        "key": "methods",
        "label": "METODOLOGIA Y DATOS",
        "query": (
            "Identifica la metodologia, el diseno del estudio, dataset o fuente de datos, "
            "variables analizadas y metricas de evaluacion."
        ),
    },
    {
        "key": "findings",
        "label": "HALLAZGOS Y LIMITACIONES",
        "query": (
            "Identifica findings, resultados principales, limitaciones del estudio y future work."
        ),
    },
)

LOW_SIGNAL_CONTEXT_MARKERS = (
    "acknowledgement",
    "acknowledgements",
    "acknowledgment",
    "references",
    "author contributions",
    "conflicts of interest",
    "declaration of competing interest",
    "data availability statement",
)

NO_CONTEXT_MARKERS = (
    "NO HAY CONTEXTO DISPONIBLE",
    "NO SE ENCONTR",
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


def _normalize_rag_context(rag_context: str) -> str:
    cleaned = rag_context.replace("\n--- CONTEXTO RECUPERADO (RAG) ---\n", "")
    cleaned = cleaned.replace("\n--- FIN DEL CONTEXTO ---\n\n", "")
    return cleaned.strip()


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _filter_low_signal_context(context: str) -> str:
    if not context:
        return context

    blocks = [block.strip() for block in context.split("\n\n") if block.strip()]
    filtered_blocks = []

    for block in blocks:
        lowered = block.lower()
        if any(marker in lowered for marker in LOW_SIGNAL_CONTEXT_MARKERS):
            continue
        filtered_blocks.append(block)

    if filtered_blocks:
        return "\n\n".join(filtered_blocks)
    return context


def _filter_low_signal_docs(docs: list) -> list:
    filtered_docs = []
    for doc in docs:
        content = _normalize_text(getattr(doc, "page_content", ""))
        lowered = content.lower()
        if any(marker in lowered for marker in LOW_SIGNAL_CONTEXT_MARKERS):
            continue
        filtered_docs.append(doc)

    return filtered_docs or docs


def _combine_context_sections(context_sections: dict[str, str]) -> str:
    combined_sections = []
    for facet in EVIDENCE_EXTRACTION_FACETS:
        key = facet["key"]
        text = str(context_sections.get(key) or "").strip()
        if not text:
            continue
        combined_sections.append(f"### {facet['label']}\n{text}")
    return "\n\n".join(combined_sections).strip()


def _trim_items(values: list[str], max_items: int) -> list[str]:
    cleaned = []
    for value in values:
        text = str(value or "").strip()
        if text:
            cleaned.append(text)
    return cleaned[:max_items]


def _coerce_optional_int(value) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _shorten_snippet(text: str, max_chars: int = 220) -> str:
    cleaned = _normalize_text(text)
    cleaned = re.sub(r"^\[[^\]]+\]\s*", "", cleaned)
    cleaned = cleaned.lstrip("-• ").strip()

    if len(cleaned) <= max_chars:
        return cleaned

    truncated = cleaned[:max_chars].rsplit(" ", 1)[0].strip()
    return f"{truncated or cleaned[:max_chars].strip()}..."


def _score_snippet_against_doc(snippet: str, doc_text: str) -> tuple[int, int]:
    snippet_norm = _normalize_text(snippet).lower()
    doc_norm = _normalize_text(doc_text).lower()

    if not snippet_norm or not doc_norm:
        return (0, 0)

    if snippet_norm in doc_norm:
        return (10_000, len(snippet_norm))

    snippet_tokens = {token for token in re.findall(r"\w+", snippet_norm) if len(token) >= 4}
    if not snippet_tokens:
        return (0, 0)

    overlap = sum(1 for token in snippet_tokens if token in doc_norm)
    return (overlap, len(snippet_tokens))


def _build_support_references(
    snippets: list[str],
    *,
    facet: str,
    docs: list,
    max_items: int = 3,
) -> list[SupportSnippetReference]:
    references: list[SupportSnippetReference] = []
    seen: set[str] = set()

    for raw_snippet in snippets:
        snippet = _shorten_snippet(raw_snippet)
        if not snippet:
            continue

        dedupe_key = snippet.casefold()
        if dedupe_key in seen:
            continue

        best_doc = None
        best_score = (0, 0)

        for doc in docs:
            score = _score_snippet_against_doc(snippet, getattr(doc, "page_content", ""))
            if score > best_score:
                best_score = score
                best_doc = doc

        metadata = getattr(best_doc, "metadata", {}) if best_doc else {}
        references.append(
            SupportSnippetReference(
                text=snippet,
                facet=facet,
                page=_coerce_optional_int(metadata.get("page")),
                start_index=_coerce_optional_int(metadata.get("start_index")),
            )
        )
        seen.add(dedupe_key)

        if len(references) >= max_items:
            break

    return references


def _trim_support_references(
    references: list[SupportSnippetReference],
    max_items: int,
) -> list[SupportSnippetReference]:
    merged: list[SupportSnippetReference] = []
    seen: set[tuple[str, str, int | None, int | None]] = set()

    for item in references:
        key = (
            item.facet,
            item.text.casefold(),
            item.page,
            item.start_index,
        )
        if key in seen:
            continue

        seen.add(key)
        merged.append(item)

        if len(merged) >= max_items:
            return merged

    return merged


def _estimate_confidence(result: EvidenceExtractionLLMResult) -> float:
    coverage_signals = 0

    if result.objective:
        coverage_signals += 1
    if result.methodology:
        coverage_signals += 1
    if result.dataset:
        coverage_signals += 1
    if result.research_questions:
        coverage_signals += 1
    if result.variables:
        coverage_signals += 1
    if result.metrics:
        coverage_signals += 1
    if result.findings:
        coverage_signals += 1
    if result.limitations:
        coverage_signals += 1
    if result.future_work:
        coverage_signals += 1
    if coverage_signals == 0:
        return 0.0

    return min(0.95, round(0.2 + coverage_signals * 0.07, 2))


class EvidenceExtractionService:
    def __init__(
        self,
        article_repo: ArticleRepository | None = None,
        article_extraction_service: ArticleExtractionService | None = None,
        collection_service: CollectionService | None = None,
        screening_decision_service: ScreeningDecisionService | None = None,
        screening_run_service: ScreeningRunService | None = None,
        storage_service: StorageService | None = None,
    ):
        self.article_repo = article_repo if article_repo is not None else ArticleRepository()
        self.article_extraction_service = (
            article_extraction_service
            if article_extraction_service is not None
            else ArticleExtractionService()
        )
        self.collection_service = (
            collection_service if collection_service is not None else CollectionService()
        )
        self.screening_decision_service = (
            screening_decision_service
            if screening_decision_service is not None
            else ScreeningDecisionService()
        )
        self.screening_run_service = (
            screening_run_service if screening_run_service is not None else ScreeningRunService()
        )
        self.storage_service = storage_service if storage_service is not None else StorageService()

    def _build_structured_agent(self, *, config: dict, schema) -> BaseAgent:
        llm_agent = BaseAgent(
            modelo=config["modelo"],
            temperatura=config["temperatura"],
            offline=config["offline"],
            system_prompt=EVIDENCE_EXTRACTION_SYSTEM_PROMPT,
        )
        llm_agent.set_structured_output(schema)
        return llm_agent

    def _build_agents(self) -> Tuple[dict[str, BaseAgent], RagEngine, VectorIndexService]:
        config = get_evidence_extraction_config()
        extraction_agents = {
            "objective": self._build_structured_agent(
                config=config,
                schema=EvidenceExtractionObjectiveResult,
            ),
            "methods": self._build_structured_agent(
                config=config,
                schema=EvidenceExtractionMethodsResult,
            ),
            "findings": self._build_structured_agent(
                config=config,
                schema=EvidenceExtractionFindingsResult,
            ),
        }

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
        return extraction_agents, rag_engine, vector_index_service

    async def _resolve_target_articles(
        self,
        *,
        user_id: str,
        collection_id: str,
        screening_run_id: str | None,
        selection_mode: str,
    ) -> list[dict]:
        exists = await self.collection_service.collection_exists(
            user_id=user_id,
            collection_id=collection_id,
        )
        if not exists:
            raise ValidationError("La coleccion no existe o no pertenece al usuario")

        mongo_articles = await self.article_repo.get_articles_for_metadata_index(
            user_id=user_id,
            collection_id=collection_id,
        )
        articles = [
            article
            for article in mongo_articles
            if article.get("status") not in {"processing", "error"}
        ]

        if selection_mode == "all":
            return articles

        if not screening_run_id:
            raise ValidationError("Este modo de seleccion requiere un screening run")

        screening_run = await self.screening_run_service.get_run(
            run_id=screening_run_id,
            user_id=user_id,
        )
        if screening_run.get("collection_id") != collection_id:
            raise ValidationError("El screening seleccionado no pertenece a la coleccion activa")

        decisions = await self.screening_decision_service.list_run_decisions(
            user_id=user_id,
            run_id=screening_run_id,
        )
        if selection_mode == "screening_include":
            allowed = {"include"}
        elif selection_mode == "screening_include_review":
            allowed = {"include", "review"}
        else:
            raise ValidationError("Modo de seleccion no soportado")

        allowed_article_ids = {
            str(item.get("article_id"))
            for item in decisions
            if item.get("decision") in allowed
        }
        return [
            article
            for article in articles
            if str(article.get("_id")) in allowed_article_ids
        ]

    def _load_article_context(
        self,
        *,
        rag_engine: RagEngine,
        vector_index_service: VectorIndexService,
        user_id: str,
        article: dict,
    ) -> Tuple[dict[str, str], dict[str, list], str]:
        article_id = str(article.get("_id"))
        faiss_dir = self.storage_service.get_faiss_article_dir(
            user_id=user_id,
            article_id=article_id,
        )
        faiss_file = faiss_dir / "index.faiss"

        if faiss_file.exists():
            try:
                rag_engine.vector_store = vector_index_service.load_index(str(faiss_dir))
                facet_contexts: dict[str, str] = {}
                facet_docs: dict[str, list] = {}

                for facet in EVIDENCE_EXTRACTION_FACETS:
                    strategy = get_rag_strategy_config()
                    strategy["k"] = 4
                    strategy["max_context_chars"] = 3600
                    docs = rag_engine.search_docs(
                        user_message=facet["query"],
                        strategy=strategy,
                    )
                    docs = _filter_low_signal_docs(docs)
                    rag_context = rag_engine.format_docs_as_context(docs, strategy=strategy)
                    if _has_rag_context(rag_context):
                        facet_docs[facet["key"]] = docs
                        facet_contexts[facet["key"]] = _filter_low_signal_context(
                            _normalize_rag_context(rag_context)
                        )

                if facet_contexts:
                    combined_context = _combine_context_sections(facet_contexts)
                    for facet in EVIDENCE_EXTRACTION_FACETS:
                        facet_contexts.setdefault(facet["key"], combined_context)
                        facet_docs.setdefault(facet["key"], [])
                    return facet_contexts, facet_docs, "full_text"
            except Exception as exc:
                logger.warning("No se pudo cargar contexto FAISS para %s: %s", article_id, exc)

        metadata_context = _build_metadata_context(article)
        return {
            facet["key"]: metadata_context
            for facet in EVIDENCE_EXTRACTION_FACETS
        }, {
            facet["key"]: []
            for facet in EVIDENCE_EXTRACTION_FACETS
        }, "metadata"

    def _build_objective_prompt(self, *, article: dict, context: str, source_type: str) -> str:
        return (
            f"Articulo: {article.get('title') or article.get('_id')}\n"
            f"Fuente principal usada: {source_type}\n"
            "Extrae solo los campos objective, research_questions y support_snippets.\n"
            "Los support_snippets deben ser fragmentos breves y literales del contexto que apoyen el objetivo o las preguntas, idealmente hasta 220 caracteres.\n"
            "No inventes preguntas de investigacion si no aparecen o no pueden inferirse con claridad.\n\n"
            f"Contexto disponible:\n{context}"
        )

    def _build_methods_prompt(self, *, article: dict, context: str, source_type: str) -> str:
        return (
            f"Articulo: {article.get('title') or article.get('_id')}\n"
            f"Fuente principal usada: {source_type}\n"
            "Extrae solo methodology, dataset, variables, metrics y support_snippets.\n"
            "Los support_snippets deben ser fragmentos breves y literales del contexto que apoyen la metodologia o los datos, idealmente hasta 220 caracteres.\n"
            "Si algun campo no aparece de forma fiable, dejalo vacio.\n"
            "Evita listas infladas: incluye solo variables y metricas relevantes.\n\n"
            f"Contexto disponible:\n{context}"
        )

    def _build_findings_prompt(self, *, article: dict, context: str, source_type: str) -> str:
        return (
            f"Articulo: {article.get('title') or article.get('_id')}\n"
            f"Fuente principal usada: {source_type}\n"
            "Extrae solo findings, limitations, future_work y support_snippets.\n"
            "Los support_snippets deben ser fragmentos breves y literales del contexto que apoyen findings, limitations o future_work, idealmente hasta 220 caracteres y maximo 3.\n"
            "Ignora bloques de referencias, acknowledgements o author contributions si aparecen.\n\n"
            f"Contexto disponible:\n{context}"
        )

    async def _invoke_structured(
        self,
        *,
        llm_agent: BaseAgent,
        schema,
        prompt_builder,
        article: dict,
        context: str,
        source_type: str,
        task_name: str,
    ):
        try:
            prompt = llm_agent.create_prompt(
                prompt_builder(
                    article=article,
                    context=context,
                    source_type=source_type,
                )
            )
            raw_output = await asyncio.to_thread(
                llm_agent.invoke, prompt, structured_output=True
            )
            return schema.model_validate(raw_output)
        except Exception as exc:
            logger.warning(
                "Fallo extrayendo bloque %s para article_id=%s: %s",
                task_name,
                article.get("_id"),
                exc,
            )
            return schema()

    async def run_evidence_extraction(
        self,
        *,
        run_id: str,
        user_id: str,
        collection_id: str,
        screening_run_id: str | None = None,
        selection_mode: str = "all",
    ) -> dict:
        articles = await self._resolve_target_articles(
            user_id=user_id,
            collection_id=collection_id,
            screening_run_id=screening_run_id,
            selection_mode=selection_mode,
        )

        if not articles:
            return {
                "run_id": run_id,
                "collection_id": collection_id,
                "screening_run_id": screening_run_id,
                "selection_mode": selection_mode,
                "total_articles": 0,
                "processed_articles": 0,
                "prompt_version": EVIDENCE_EXTRACTION_PROMPT_VERSION,
                "schema_version": EVIDENCE_EXTRACTION_SCHEMA_VERSION,
            }

        extraction_agents, rag_engine, vector_index_service = self._build_agents()
        processed_articles = 0

        for article in articles:
            objective_support: list[SupportSnippetReference] = []
            methods_support: list[SupportSnippetReference] = []
            findings_support: list[SupportSnippetReference] = []
            combined_support: list[SupportSnippetReference] = []

            context_sections, facet_docs, source_type = self._load_article_context(
                rag_engine=rag_engine,
                vector_index_service=vector_index_service,
                user_id=user_id,
                article=article,
            )

            try:
                objective_result = await self._invoke_structured(
                    llm_agent=extraction_agents["objective"],
                    schema=EvidenceExtractionObjectiveResult,
                    prompt_builder=self._build_objective_prompt,
                    article=article,
                    context=context_sections["objective"],
                    source_type=source_type,
                    task_name="objective",
                )

                methods_result = await self._invoke_structured(
                    llm_agent=extraction_agents["methods"],
                    schema=EvidenceExtractionMethodsResult,
                    prompt_builder=self._build_methods_prompt,
                    article=article,
                    context=context_sections["methods"],
                    source_type=source_type,
                    task_name="methods",
                )

                findings_result = await self._invoke_structured(
                    llm_agent=extraction_agents["findings"],
                    schema=EvidenceExtractionFindingsResult,
                    prompt_builder=self._build_findings_prompt,
                    article=article,
                    context=context_sections["findings"],
                    source_type=source_type,
                    task_name="findings",
                )

                objective_support = _build_support_references(
                    objective_result.support_snippets,
                    facet="objective",
                    docs=facet_docs["objective"],
                )
                methods_support = _build_support_references(
                    methods_result.support_snippets,
                    facet="methods",
                    docs=facet_docs["methods"],
                )
                findings_support = _build_support_references(
                    findings_result.support_snippets,
                    facet="findings",
                    docs=facet_docs["findings"],
                )
                result = EvidenceExtractionLLMResult(
                    objective=objective_result.objective,
                    research_questions=objective_result.research_questions,
                    methodology=methods_result.methodology,
                    dataset=methods_result.dataset,
                    variables=methods_result.variables,
                    metrics=methods_result.metrics,
                    findings=findings_result.findings,
                    limitations=findings_result.limitations,
                    future_work=findings_result.future_work,
                )
            except Exception as exc:
                logger.warning(
                    "Fallo extrayendo evidencia para article_id=%s: %s",
                    article.get("_id"),
                    exc,
                )
                result = EvidenceExtractionLLMResult(
                    findings=[],
                    limitations=["No se pudo extraer evidencia de forma fiable. Requiere revision manual."],
                    confidence=0.0,
                )

            confidence = (
                result.confidence
                if result.confidence is not None
                else _estimate_confidence(result)
            )

            extraction_data = ArticleExtractionData(
                run_id=run_id,
                article_id=str(article.get("_id")),
                article_title=article.get("title"),
                source_type=source_type,
                objective=result.objective,
                objective_support=_trim_support_references(objective_support, 3),
                research_questions=_trim_items(result.research_questions, 5),
                methodology=result.methodology,
                methods_support=_trim_support_references(methods_support, 3),
                dataset=result.dataset,
                variables=_trim_items(result.variables, 8),
                metrics=_trim_items(result.metrics, 6),
                findings=_trim_items(result.findings, 6),
                limitations=_trim_items(result.limitations, 4),
                future_work=_trim_items(result.future_work, 4),
                findings_support=_trim_support_references(findings_support, 3),
                confidence=confidence,
            )
            await self.article_extraction_service.save_extraction(
                user_id=user_id,
                extraction_data=extraction_data,
            )
            processed_articles += 1

        return {
            "run_id": run_id,
            "collection_id": collection_id,
            "screening_run_id": screening_run_id,
            "selection_mode": selection_mode,
            "total_articles": len(articles),
            "processed_articles": processed_articles,
            "prompt_version": EVIDENCE_EXTRACTION_PROMPT_VERSION,
            "schema_version": EVIDENCE_EXTRACTION_SCHEMA_VERSION,
        }
