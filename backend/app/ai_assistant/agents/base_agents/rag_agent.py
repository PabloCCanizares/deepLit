import logging
from pathlib import Path
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

    def retrive(self, user_message, k=8, use_mmr=True):
        """
        Recupera chunks relevantes del vector store.
        
        - MMR (Maximum Marginal Relevance) balancea relevancia y diversidad,
          evitando devolver chunks casi idénticos de la misma sección.
        - fetch_k=k*3: pool más grande de candidatos para que MMR elija los más diversos.
        - lambda_mult=0.7: prioriza relevancia (1.0) pero filtra redundancia (0.0).
        """
        if self.vector_store is None:
            return "\n--- NO HAY CONTEXTO DISPONIBLE (sin documentos indexados) ---\n\n"

        if use_mmr:
            retrieved_docs = self.vector_store.max_marginal_relevance_search(
                user_message, k=k, fetch_k=k * 3, lambda_mult=0.7
            )
        else:
            retrieved_docs = self.vector_store.similarity_search(user_message, k=k)

        if not retrieved_docs:
            return "\n--- NO SE ENCONTRÓ CONTEXTO RELEVANTE ---\n\n"

        retrieved_text = "\n\n".join(
            f"[Fuente: Pág {doc.metadata.get('page', '?')} | "
            f"Archivo: {doc.metadata.get('source', 'Desconocido')}]\n"
            f"{doc.page_content}"
            for doc in retrieved_docs
        )

        rag = (
            f"\n--- CONTEXTO RECUPERADO (RAG) ---\n"
            f"{retrieved_text}\n"
            f"--- FIN DEL CONTEXTO ---\n\n"
        )

        return rag