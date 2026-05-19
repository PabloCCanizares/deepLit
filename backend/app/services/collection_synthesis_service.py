from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
import logging
import re
from typing import Optional

from app.ai_assistant.agents.base_agents.base_agent import BaseAgent
from app.ai_assistant.agents.base_agents.rag_engine import RagEngine
from app.ai_assistant.config import (
    get_collection_synthesis_config,
    get_rag_strategy_config,
)
from app.ai_assistant.retrieval.faiss_loader import load_faiss_indexes
from app.core.exceptions import ValidationError
from app.repositories import ArticleRepository
from app.services.storage_service import StorageService

logger = logging.getLogger(__name__)

FULL_TEXT_CONTEXT = "full_text"
COLLECTION_SYNTHESIS_PROMPT_VERSION = "v2.0.0"
COLLECTION_SYNTHESIS_NO_PDF_MESSAGE = (
    "Esta colección no contiene ningún artículo con PDF procesado. "
    "La síntesis necesita al menos un PDF para producir un resultado fiable. "
    "Procesa al menos un PDF de los artículos de esta colección, o utiliza el "
    "asistente conversacional para hacer preguntas sobre los metadatos."
)
COLLECTION_SYNTHESIS_SYSTEM_PROMPT = """
Eres un sintetizador de colecciones cientificas.
Trabajas sobre una sola coleccion del usuario y debes convertir varios documentos en una sintesis util.

OBJETIVO:
- resumir el estado del arte de la coleccion
- comparar evidencia entre documentos
- detectar acuerdos, contradicciones y vacios
- cerrar con una recomendacion accionable

REGLAS:
- Usa solo el contexto recuperado.
- Responde exactamente a lo que pide el prompt del usuario. No fuerces una plantilla larga si la pregunta es concreta.
- Prioriza respuestas concisas y claras salvo que el usuario pida expresamente una revision amplia o formato paper.
- No uses markdown, no uses titulos con # y no abras cada frase con etiquetas innecesarias.
- Si necesitas estructura, usa titulos breves en texto plano.
- Incluye citas [Paper N: Titulo] en afirmaciones importantes siempre que el titulo aparezca en el contexto.
- Si el contexto proviene solo de metadatos, no afirmes detalles metodologicos no soportados.
- Si falta evidencia suficiente, dilo de forma explicita.
- Si la pregunta del usuario es puntual o de identificacion, responde de forma directa.
- Cuando identifiques un articulo concreto, menciona su titulo si aparece en el contexto.
- Si el usuario pide convertir la respuesta a formato paper o manuscrito, usa esta estructura exacta en texto plano:
  TITULO
  RESUMEN
  INTRODUCCION
  METODOS Y ALCANCE
  SINTESIS DE EVIDENCIA
  DISCUSION
  CONCLUSIONES
  REFERENCIAS CITADAS
- En ese modo paper, las referencias deben nombrar los articulos citados cuando sea posible.
""".strip()
_LLM_TIMEOUT_SECONDS = 45
_PAPER_SECTIONS = (
    "TITULO",
    "RESUMEN",
    "INTRODUCCION",
    "METODOS Y ALCANCE",
    "SINTESIS DE EVIDENCIA",
    "DISCUSION",
    "CONCLUSIONES",
    "REFERENCIAS CITADAS",
)
_NO_CONTEXT_MARKERS = (
    "NO HAY CONTEXTO DISPONIBLE",
    "NO SE ENCONTR",
)


def rag_has_context(rag_context: Optional[str]) -> bool:
    if not rag_context:
        return False
    return all(marker not in rag_context for marker in _NO_CONTEXT_MARKERS)


class CollectionSynthesisService:
    def __init__(
        self,
        article_repository: ArticleRepository | None = None,
        storage_service: StorageService | None = None,
    ):
        self.article_repository = (
            article_repository if article_repository is not None else ArticleRepository()
        )
        self.storage_service = (
            storage_service if storage_service is not None else StorageService()
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
        raise ValidationError(COLLECTION_SYNTHESIS_NO_PDF_MESSAGE)

    def _build_agents(self) -> tuple[BaseAgent, RagEngine]:
        config = get_collection_synthesis_config()
        llm_agent = BaseAgent(
            modelo=config["modelo"],
            temperatura=config["temperatura"],
            offline=config["offline"],
            system_prompt=COLLECTION_SYNTHESIS_SYSTEM_PROMPT,
        )
        rag_engine = RagEngine(
            modelo=config["modelo"],
            temperatura=config["temperatura"],
            offline=config["offline"],
            system_prompt="",
            text_splitter=config["text_splitter"],
            embedding_model=config["embedding_model"],
        )
        return llm_agent, rag_engine

    def _build_paper_prompt(self, *, original_prompt: str, synthesis_response: str) -> str:
        return "\n".join(
            [
                "Convierte la coleccion activa en un texto con formato de paper academico breve.",
                f"Pregunta original del usuario: {original_prompt}",
                f"Respuesta previa disponible: {synthesis_response}",
                "Requisitos obligatorios:",
                "- Responde en espanol.",
                "- Usa texto plano, sin markdown y sin simbolos #.",
                (
                    "- Usa exactamente estas cabeceras, cada una en su propia linea: "
                    "TITULO, RESUMEN, INTRODUCCION, METODOS Y ALCANCE, SINTESIS DE EVIDENCIA, "
                    "DISCUSION, CONCLUSIONES, REFERENCIAS CITADAS."
                ),
                "- La sintesis debe estar bien formada, sonar a manuscrito academico y responder a la pregunta original.",
                "- En REFERENCIAS CITADAS, nombra los articulos citados de la coleccion cuando sea posible usando el formato [Paper N: Titulo].",
                "- No inventes estudios, citas ni detalles no presentes en el contexto recuperado.",
            ]
        )

    def _get_collection_strategy(self) -> dict:
        strategy = get_rag_strategy_config()
        strategy["k"] = max(10, int(strategy.get("k", 8)))
        strategy["max_context_chars"] = max(16000, int(strategy.get("max_context_chars", 12000)))
        strategy["group_by_article"] = True
        strategy["max_chunks_per_article"] = 2
        return strategy

    async def _retrieve_collection_context(
        self,
        *,
        agent: RagEngine,
        user_message: str,
        user_id: str,
        collection_id: str,
    ) -> tuple[str, Optional[str]]:
        strategy = self._get_collection_strategy()

        await load_faiss_indexes(agent=agent, user_id=user_id, collection_id=collection_id)
        rag_context = agent.retrieve(user_message=user_message, strategy=strategy)
        if rag_has_context(rag_context):
            return rag_context, FULL_TEXT_CONTEXT

        return rag_context, None

    def _build_prompt_input(
        self,
        *,
        user_message: str,
        collection_id: str,
        context_source: str,
    ) -> str:
        return (
            f"Coleccion activa: {collection_id}\n"
            f"Solicitud del usuario: {user_message}\n"
            f"Fuente principal disponible: texto completo indexado\n\n"
        )

    def _normalize_output(self, raw_output: str) -> str:
        if not raw_output:
            return raw_output

        cleaned_lines = []
        for line in str(raw_output).replace("\r\n", "\n").split("\n"):
            normalized = line.rstrip()
            normalized = re.sub(r"^\s{0,3}#{1,6}\s*", "", normalized)
            normalized = normalized.replace("**", "")
            cleaned_lines.append(normalized)

        cleaned_text = "\n".join(cleaned_lines)
        cleaned_text = re.sub(r"\n{3,}", "\n\n", cleaned_text)
        return cleaned_text.strip()

    def _extract_paper_title(self, paper_response: str) -> str | None:
        lines = [line.strip() for line in self._normalize_output(paper_response).split("\n") if line.strip()]
        if not lines:
            return None

        for index, line in enumerate(lines):
            if line.upper() == "TITULO" and index + 1 < len(lines):
                return lines[index + 1].strip() or None

        first_line = lines[0]
        if first_line.upper() not in _PAPER_SECTIONS:
            return first_line
        return None

    async def synthesize_collection(
        self,
        *,
        user_message: str,
        user_id: Optional[str],
        collection_id: Optional[str],
        fail_on_timeout: bool = False,
    ) -> dict:
        if not user_id:
            return {
                "reply": "No puedo sintetizar una coleccion sin un usuario autenticado.",
                "prompt_version": COLLECTION_SYNTHESIS_PROMPT_VERSION,
                "context_source": None,
            }

        if not collection_id:
            return {
                "reply": (
                    "Para usar la sintesis de coleccion, primero selecciona una coleccion activa "
                    "en la barra superior."
                ),
                "prompt_version": COLLECTION_SYNTHESIS_PROMPT_VERSION,
                "context_source": None,
            }

        await self.ensure_collection_has_processed_pdfs(
            user_id=user_id,
            collection_id=collection_id,
        )

        llm_agent, rag_engine = self._build_agents()

        rag_context, context_source = await self._retrieve_collection_context(
            agent=rag_engine,
            user_message=user_message,
            user_id=user_id,
            collection_id=collection_id,
        )

        if not context_source:
            output = (
                "No encuentro suficiente contenido en la coleccion seleccionada para hacer una "
                "sintesis fiable. Necesito articulos con PDF procesado o al menos metadatos utiles."
            )
            return {
                "reply": output,
                "prompt_version": COLLECTION_SYNTHESIS_PROMPT_VERSION,
                "context_source": None,
            }

        prompt_final = llm_agent.create_prompt(
            message=self._build_prompt_input(
                user_message=user_message,
                collection_id=collection_id,
                context_source=context_source,
            ) + rag_context
        )

        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(llm_agent.invoke, prompt_final)
                output = future.result(timeout=_LLM_TIMEOUT_SECONDS)
        except FuturesTimeoutError as exc:
            logger.warning("Timeout en collection_synthesis para user_id=%s", user_id)
            timeout_message = "La sintesis de la coleccion tarda demasiado. Intenta acotar mas la consulta."
            if fail_on_timeout:
                raise RuntimeError(timeout_message) from exc
            output = timeout_message

        output = self._normalize_output(output)
        llm_agent.print_agent_execution(
            agent="COLLECTION SYNTHESIS",
            input=prompt_final,
            output=output,
        )

        return {
            "reply": output,
            "prompt_version": COLLECTION_SYNTHESIS_PROMPT_VERSION,
            "context_source": context_source,
        }

    async def generate_paper(
        self,
        *,
        user_id: str,
        collection_id: str,
        original_prompt: str,
        synthesis_response: str,
    ) -> dict:
        result = await self.synthesize_collection(
            user_message=self._build_paper_prompt(
                original_prompt=original_prompt,
                synthesis_response=synthesis_response,
            ),
            user_id=user_id,
            collection_id=collection_id,
            fail_on_timeout=True,
        )
        paper_response = result["reply"]
        return {
            "paper_response": paper_response,
            "paper_title": self._extract_paper_title(paper_response) or "Paper de coleccion",
        }
