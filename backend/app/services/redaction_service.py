import logging
from typing import Optional

from app.ai_assistant.agents.base_agents.base_agent import BaseAgent
from app.ai_assistant.agents.base_agents.rag_engine import RagEngine
from app.ai_assistant.config import (
    get_collection_synthesis_config,
    get_rag_strategy_config,
)
from app.ai_assistant.retrieval.faiss_loader import load_faiss_indexes
from app.core.exceptions import ValidationError
from app.models import (
    RedactionLLMResult,
    RedactionResult,
    RedactionRunRequest,
)
from app.models.redaction import RedactionTextType
from app.repositories import (
    ArticleExtractionRepository,
    ArticleRepository,
    CollectionSynthesisRepository,
    EvidenceExtractionRunRepository,
    RedactionRunRepository,
)
from app.services.storage_service import StorageService

logger = logging.getLogger(__name__)

REDACTION_PROMPT_VERSION = "v1.0.0"
REDACTION_SCHEMA_VERSION = "v1.0.0"

REDACTION_NO_PDF_MESSAGE = (
    "Esta colección no contiene ningún artículo con PDF procesado. "
    "La redacción asistida necesita al menos un PDF para producir un resultado con apoyo documental. "
    "Procesa al menos un PDF de los artículos de esta colección antes de continuar."
)
REDACTION_PARENT_NOT_FOUND_MESSAGE = (
    "El borrador anterior referenciado no existe o no pertenece al usuario."
)
REDACTION_SYNTHESIS_NOT_FOUND_MESSAGE = (
    "La síntesis referenciada no existe, no pertenece al usuario o no se completó con éxito."
)
REDACTION_EVIDENCE_NOT_FOUND_MESSAGE = (
    "La extracción de evidencia referenciada no existe, no pertenece al usuario o no se completó con éxito."
)

REDACTION_RAG_STRATEGY = {
    "k": 10,
    "max_context_chars": 16000,
    "group_by_article": True,
    "max_chunks_per_article": 2,
}

TEXT_TYPE_INSTRUCTIONS: dict[str, str] = {
    "summary": (
        "Produce un resumen académico conciso de entre 200 y 400 palabras que sintetice "
        "la aportación del usuario y los hallazgos principales sustentados por los "
        "materiales disponibles. Estructura: un párrafo de planteamiento, uno o dos de "
        "hallazgos clave, un párrafo de cierre. No incluyas secciones explícitas con "
        "encabezados."
    ),
    "introduction": (
        "Produce una introducción académica que (1) plantee el problema o tema, "
        "(2) justifique su relevancia, (3) sitúe el contexto inmediato a partir del "
        "estado del corpus disponible, (4) anuncie la aportación del usuario y la "
        "estructura del trabajo posterior. Longitud aproximada entre 500 y 900 palabras. "
        "Usa subsecciones con encabezados cuando el desarrollo lo justifique."
    ),
    "state_of_the_art": (
        "Produce una revisión del estado de la cuestión apoyándote en los artículos del "
        "corpus disponibles. Organiza el texto por bloques temáticos o cronológicos. "
        "Cita los artículos del corpus de manera explícita cuando uses información de "
        "ellos. Cierra identificando vacíos o líneas abiertas en la literatura revisada "
        "que justifican la aportación del usuario."
    ),
    "conclusions": (
        "Produce un texto de conclusiones que (1) recupere los puntos principales de la "
        "aportación del usuario y de los hallazgos sustentados por el corpus, (2) los "
        "presente de manera ordenada y jerarquizada, (3) reconozca limitaciones "
        "aplicables a partir de la evidencia disponible, (4) apunte líneas futuras de "
        "trabajo. Longitud aproximada entre 300 y 600 palabras."
    ),
    "full_draft": (
        "Produce un borrador completo de texto académico que combine, en este orden: "
        "introducción, estado de la cuestión, desarrollo o análisis basado en la "
        "aportación del usuario, y conclusiones. Estructúralo con secciones explícitas "
        "marcadas con encabezados. Cita los artículos del corpus cuando uses información "
        "de ellos. El texto debe ser internamente coherente y leerse como un único "
        "documento."
    ),
}

REDACTION_SYSTEM_PROMPT = """
Eres un asistente de redacción científica. Tu tarea es ayudar al usuario a producir un borrador de texto académico a partir de su aportación intelectual y de los materiales documentales que se te proporcionan. Sigue estas reglas:

1. La aportación intelectual del usuario es la idea central del borrador. No la sustituyas, formálizala.
2. Apoya cada afirmación relevante en los artículos del corpus disponibles. Cita los artículos como "[Autor et al. (Año)]" o equivalente cuando uses información de ellos.
3. Estructura el borrador en secciones académicas reconocibles: planteamiento o introducción, contexto del estado del arte, análisis o desarrollo, y conclusiones. Adapta los títulos al contenido pero mantén la estructura general.
4. No inventes datos, métodos, resultados ni referencias. Si un dato no aparece en el contexto proporcionado, no lo escribas.
5. El borrador debe ser revisable: usa lenguaje claro, evita afirmaciones cerradas cuando la evidencia no las sustenta, y deja espacio para que el usuario edite y refine.
6. Devuelve el resultado en formato JSON estructurado con los siguientes campos: título del borrador, texto completo del borrador, lista de secciones con su título y nivel jerárquico, lista de referencias citadas con su identificador interno y la forma exacta en que aparecen en el texto, y lista de puntos a revisar manualmente (afirmaciones potencialmente débiles, secciones con poco apoyo documental o decisiones de redacción que conviene validar).
""".strip()


def _format_evidence_block(extractions: list[dict]) -> str:
    if not extractions:
        return ""

    blocks: list[str] = []
    for item in extractions:
        title = item.get("article_title") or item.get("article_id") or "Articulo sin titulo"
        lines = [f"- Articulo: {title}"]
        if item.get("objective"):
            lines.append(f"  Objetivo: {item['objective']}")
        if item.get("methodology"):
            lines.append(f"  Metodologia: {item['methodology']}")
        findings = [str(f).strip() for f in (item.get("findings") or []) if str(f).strip()]
        if findings:
            lines.append("  Hallazgos: " + "; ".join(findings))
        limitations = [str(l).strip() for l in (item.get("limitations") or []) if str(l).strip()]
        if limitations:
            lines.append("  Limitaciones: " + "; ".join(limitations))
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


class RedactionService:
    def __init__(
        self,
        article_repository: ArticleRepository | None = None,
        storage_service: StorageService | None = None,
        collection_synthesis_repo: CollectionSynthesisRepository | None = None,
        evidence_extraction_run_repo: EvidenceExtractionRunRepository | None = None,
        article_extraction_repo: ArticleExtractionRepository | None = None,
        redaction_run_repo: RedactionRunRepository | None = None,
    ):
        self.article_repository = (
            article_repository if article_repository is not None else ArticleRepository()
        )
        self.storage_service = (
            storage_service if storage_service is not None else StorageService()
        )
        self.collection_synthesis_repo = (
            collection_synthesis_repo
            if collection_synthesis_repo is not None
            else CollectionSynthesisRepository()
        )
        self.evidence_extraction_run_repo = (
            evidence_extraction_run_repo
            if evidence_extraction_run_repo is not None
            else EvidenceExtractionRunRepository()
        )
        self.article_extraction_repo = (
            article_extraction_repo
            if article_extraction_repo is not None
            else ArticleExtractionRepository()
        )
        self.redaction_run_repo = (
            redaction_run_repo if redaction_run_repo is not None else RedactionRunRepository()
        )

    async def ensure_collection_has_processed_pdfs(
        self,
        *,
        user_id: str,
        collection_id: str,
    ) -> None:
        article_ids = await self.article_repository.get_scope_article_ids(
            user_id=user_id,
            collection_id=collection_id,
        )
        for article_id in article_ids:
            faiss_file = (
                self.storage_service.get_faiss_article_dir(
                    user_id=user_id,
                    article_id=article_id,
                )
                / "index.faiss"
            )
            if faiss_file.exists():
                return
        raise ValidationError(REDACTION_NO_PDF_MESSAGE)

    async def validate_referenced_artifacts(
        self,
        *,
        user_id: str,
        request: RedactionRunRequest,
    ) -> None:
        if request.synthesis_run_id:
            run = await self.collection_synthesis_repo.find_by_id(request.synthesis_run_id)
            if not run or run.get("id_user") != user_id or run.get("status") != "completed":
                raise ValidationError(REDACTION_SYNTHESIS_NOT_FOUND_MESSAGE)

        if request.evidence_extraction_run_id:
            run = await self.evidence_extraction_run_repo.find_by_id(
                request.evidence_extraction_run_id
            )
            if not run or run.get("id_user") != user_id or run.get("status") != "completed":
                raise ValidationError(REDACTION_EVIDENCE_NOT_FOUND_MESSAGE)

        if request.parent_run_id:
            run = await self.redaction_run_repo.find_by_id(request.parent_run_id)
            if not run or run.get("id_user") != user_id or run.get("status") != "completed":
                raise ValidationError(REDACTION_PARENT_NOT_FOUND_MESSAGE)

    async def _load_synthesis_content(
        self,
        *,
        user_id: str,
        synthesis_run_id: Optional[str],
    ) -> Optional[str]:
        if not synthesis_run_id:
            return None
        run = await self.collection_synthesis_repo.find_by_id(synthesis_run_id)
        if not run or run.get("id_user") != user_id:
            return None
        response = run.get("response")
        return response if response else None

    async def _load_evidence_extractions(
        self,
        *,
        user_id: str,
        evidence_extraction_run_id: Optional[str],
    ) -> list[dict]:
        if not evidence_extraction_run_id:
            return []
        return await self.article_extraction_repo.list_by_run(
            user_id=user_id,
            run_id=evidence_extraction_run_id,
        )

    async def _load_parent_draft_text(
        self,
        *,
        user_id: str,
        parent_run_id: Optional[str],
    ) -> Optional[str]:
        if not parent_run_id:
            return None
        run = await self.redaction_run_repo.find_by_id(parent_run_id)
        if not run or run.get("id_user") != user_id:
            return None
        result = run.get("result") or {}
        draft_text = result.get("draft_text")
        return draft_text if draft_text else None

    def _build_user_prompt(
        self,
        *,
        user_idea: str,
        text_type: RedactionTextType,
        synthesis_content: Optional[str],
        evidence_extractions: list[dict],
        parent_draft_text: Optional[str],
        rag_context: str,
    ) -> str:
        blocks: list[str] = []

        blocks.append("### APORTACION DEL USUARIO\n" + user_idea.strip())

        if synthesis_content:
            blocks.append("### SINTESIS DE REFERENCIA\n" + synthesis_content.strip())
        else:
            blocks.append("### SINTESIS DE REFERENCIA\nNo se ha proporcionado sintesis previa.")

        evidence_block = _format_evidence_block(evidence_extractions)
        if evidence_block:
            blocks.append("### EVIDENCIA UTILIZADA\n" + evidence_block)
        else:
            blocks.append(
                "### EVIDENCIA UTILIZADA\nNo se ha proporcionado evidence extraction previa."
            )

        if parent_draft_text:
            blocks.append(
                "### BORRADOR ANTERIOR (REVISION)\n"
                "El siguiente texto es el borrador previo. Produce una revision que incorpore "
                "la nueva aportacion del usuario manteniendo el tono y estructura academica.\n\n"
                + parent_draft_text.strip()
            )

        blocks.append("### CONTEXTO DE LOS DOCUMENTOS\n" + rag_context.strip())

        blocks.append(
            "### TIPO DE TEXTO SOLICITADO\n" + TEXT_TYPE_INSTRUCTIONS[text_type]
        )

        blocks.append(
            "### TAREA\n"
            "Produce un borrador siguiendo las reglas indicadas en el system prompt. "
            "Devuelve titulo, texto completo del borrador, lista de secciones, lista de "
            "referencias citadas y lista explicita de puntos a revisar manualmente."
        )

        return "\n\n".join(blocks)

    def _build_agents(self) -> tuple[BaseAgent, RagEngine]:
        config = get_collection_synthesis_config()
        llm_agent = BaseAgent(
            modelo=config["modelo"],
            temperatura=config["temperatura"],
            offline=config["offline"],
            system_prompt=REDACTION_SYSTEM_PROMPT,
        )
        llm_agent.set_structured_output(RedactionLLMResult)
        rag_engine = RagEngine(
            modelo=config["modelo"],
            temperatura=config["temperatura"],
            offline=config["offline"],
            system_prompt="",
            text_splitter=config["text_splitter"],
            embedding_model=config["embedding_model"],
        )
        return llm_agent, rag_engine

    def _get_rag_strategy(self) -> dict:
        strategy = get_rag_strategy_config()
        for key, value in REDACTION_RAG_STRATEGY.items():
            strategy[key] = value
        return strategy

    async def generate_redaction(
        self,
        *,
        user_id: str,
        collection_id: str,
        request: RedactionRunRequest,
    ) -> RedactionResult:
        await self.ensure_collection_has_processed_pdfs(
            user_id=user_id,
            collection_id=collection_id,
        )
        await self.validate_referenced_artifacts(user_id=user_id, request=request)

        synthesis_content = await self._load_synthesis_content(
            user_id=user_id,
            synthesis_run_id=request.synthesis_run_id,
        )
        evidence_extractions = await self._load_evidence_extractions(
            user_id=user_id,
            evidence_extraction_run_id=request.evidence_extraction_run_id,
        )
        parent_draft_text = await self._load_parent_draft_text(
            user_id=user_id,
            parent_run_id=request.parent_run_id,
        )

        llm_agent, rag_engine = self._build_agents()
        await load_faiss_indexes(
            agent=rag_engine,
            user_id=user_id,
            collection_id=collection_id,
        )
        rag_context = rag_engine.retrieve(
            user_message=request.user_idea,
            strategy=self._get_rag_strategy(),
        )

        user_prompt = self._build_user_prompt(
            user_idea=request.user_idea,
            text_type=request.text_type,
            synthesis_content=synthesis_content,
            evidence_extractions=evidence_extractions,
            parent_draft_text=parent_draft_text,
            rag_context=rag_context,
        )

        prompt_final = llm_agent.create_prompt(message=user_prompt)
        raw_output = llm_agent.invoke(prompt_final, structured_output=True)
        llm_result = RedactionLLMResult.model_validate(raw_output)

        return RedactionResult(
            title=llm_result.title,
            draft_text=llm_result.draft_text,
            sections=llm_result.sections,
            references=llm_result.references,
            review_points=llm_result.review_points,
        )
