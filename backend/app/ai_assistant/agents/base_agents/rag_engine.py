from typing import Dict, List

from .base_agent import BaseAgent


class RagEngine(BaseAgent):
    def __init__(self, modelo, temperatura, system_prompt, text_splitter, embedding_model, offline):
        super().__init__(modelo=modelo, temperatura=temperatura, system_prompt=system_prompt, offline=offline)
        self.text_splitter = text_splitter
        self.embedding_model = embedding_model
        self.vector_store = None
    
    def invoke(self, prompt, structured_output=False):
        result = self.get_model().invoke(prompt)
        if structured_output:
            return result.model_dump()
        return result.content

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

    def _get_doc_group_key(self, doc) -> str:
        metadata = doc.metadata or {}
        return (
            str(metadata.get("article_id") or "").strip()
            or str(metadata.get("source") or "").strip()
            or "unknown"
        )

    def _group_docs_by_article(self, docs: List, max_chunks_per_article: int) -> List:
        grouped_docs = []
        article_counts: Dict[str, int] = {}

        for doc in docs:
            group_key = self._get_doc_group_key(doc)
            current_count = article_counts.get(group_key, 0)
            if current_count >= max_chunks_per_article:
                continue
            grouped_docs.append(doc)
            article_counts[group_key] = current_count + 1

        return grouped_docs

    def _build_citation(self, doc, paper_number: int) -> str:
        metadata = doc.metadata or {}
        page = metadata.get("page", "?")
        source = metadata.get("source", metadata.get("article_id", "Desconocido"))
        article_title = (
            metadata.get("article_title")
            or metadata.get("title")
            or metadata.get("article_id")
            or "Sin titulo"
        )
        return f"[Paper {paper_number} | Pag {page} | Titulo: {article_title} | Fuente: {source}]"

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
        group_by_article = bool(strategy.get("group_by_article", False))
        max_chunks_per_article = max(1, int(strategy.get("max_chunks_per_article", 1)))

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

        if group_by_article:
            retrieved_docs = self._group_docs_by_article(
                docs=retrieved_docs,
                max_chunks_per_article=max_chunks_per_article,
            )

        context_blocks = []
        total_chars = 0
        paper_numbers: Dict[str, int] = {}
        next_paper_number = 1

        for doc in retrieved_docs:
            group_key = self._get_doc_group_key(doc)
            if group_key not in paper_numbers:
                paper_numbers[group_key] = next_paper_number
                next_paper_number += 1

            citation = self._build_citation(doc, paper_numbers[group_key])
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
