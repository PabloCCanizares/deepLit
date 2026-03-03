import logging
from pathlib import Path
from typing import Dict, List
from langchain_community.vectorstores import FAISS
from .base_agent import BaseAgent

logger = logging.getLogger(__name__)


class RagAgent(BaseAgent):
    def __init__(self, modelo, temperatura, system_prompt, text_splitter, embedding_model, offline):
        super().__init__(modelo=modelo, temperatura=temperatura, system_prompt=system_prompt, offline=offline)
        self.text_splitter = text_splitter
        self.embedding_model = embedding_model
        self.vector_store = None
        self.documents = []

    def get_vector_store(self):
        return self.vector_store
    
    def invoke(self, prompt, structured_output=False):
        result = self.get_model().invoke(prompt)
        if structured_output:
            return result.model_dump()
        return result.content

    def process_documents(self, docs):
        """Divide docs en chunks y construye/actualiza el FAISS vector store."""
        splits = self.text_splitter.split_documents(docs)
        if self.vector_store is None:
            self.vector_store = FAISS.from_documents(documents=splits, embedding=self.embedding_model)
        else:
            self.vector_store.add_documents(documents=splits)

    def save_index(self, save_path: str) -> None:
        """Persiste el FAISS vector store a disco."""
        if self.vector_store is None:
            logger.warning("No hay vector store para guardar.")
            return
        Path(save_path).mkdir(parents=True, exist_ok=True)
        self.vector_store.save_local(save_path)
        logger.info("FAISS index guardado en: %s", save_path)

    @classmethod
    def load_index(cls, load_path: str, embeddings) -> FAISS:
        """Carga un FAISS vector store previamente guardado."""
        return FAISS.load_local(
            load_path, embeddings,
            allow_dangerous_deserialization=True
        )

    def _rerank_by_query_overlap(self, docs: List, user_message: str) -> List:
        query_tokens = {token for token in user_message.lower().split() if len(token) >= 3}
        if not query_tokens:
            return docs

        scored_docs = []
        for idx, doc in enumerate(docs):
            content = (doc.page_content or "").lower()
            overlap = sum(1 for token in query_tokens if token in content)
            scored_docs.append((overlap, idx, doc))

        scored_docs.sort(key=lambda item: (-item[0], item[1]))
        return [item[2] for item in scored_docs]

    def retrieve(self, user_message: str, strategy: Dict = None):
        """
        Recupera chunks relevantes del vector store con estrategia RAG unificada.
        """
        strategy = strategy or {}
        k = int(strategy.get("k", 8))
        use_mmr = bool(strategy.get("use_mmr", True))
        fetch_k_multiplier = max(1, int(strategy.get("fetch_k_multiplier", 3)))
        lambda_mult = float(strategy.get("lambda_mult", 0.7))
        rerank = strategy.get("rerank", "query_overlap")
        max_context_chars = max(500, int(strategy.get("max_context_chars", 12000)))
        include_citations = bool(strategy.get("include_citations", True))

        if self.vector_store is None:
            return "\n--- NO HAY CONTEXTO DISPONIBLE (sin documentos indexados) ---\n\n"

        if use_mmr:
            retrieved_docs = self.vector_store.max_marginal_relevance_search(
                user_message, k=k, fetch_k=k * fetch_k_multiplier, lambda_mult=lambda_mult
            )
        else:
            retrieved_docs = self.vector_store.similarity_search(user_message, k=k)

        if not retrieved_docs:
            return "\n--- NO SE ENCONTRÓ CONTEXTO RELEVANTE ---\n\n"

        if rerank == "query_overlap":
            retrieved_docs = self._rerank_by_query_overlap(retrieved_docs, user_message)

        context_blocks = []
        total_chars = 0
        for idx, doc in enumerate(retrieved_docs, start=1):
            page = doc.metadata.get("page", "?")
            source = doc.metadata.get("source", doc.metadata.get("article_id", "Desconocido"))
            citation = f"[Doc {idx} | Pag {page} | Fuente: {source}]"
            content = doc.page_content or ""
            block = f"{citation}\n{content}" if include_citations else content

            if total_chars + len(block) > max_context_chars:
                remaining = max_context_chars - total_chars
                if remaining <= 0:
                    break
                block = block[:remaining]
            context_blocks.append(block)
            total_chars += len(block)
            if total_chars >= max_context_chars:
                break

        retrieved_text = "\n\n".join(context_blocks)

        rag = (
            f"\n--- CONTEXTO RECUPERADO (RAG) ---\n"
            f"{retrieved_text}\n"
            f"--- FIN DEL CONTEXTO ---\n\n"
        )

        return rag

    def retrive(self, user_message, k=8, use_mmr=True):
        # Compatibilidad hacia atrás con llamadas antiguas.
        return self.retrieve(
            user_message=user_message,
            strategy={"k": k, "use_mmr": use_mmr},
        )
