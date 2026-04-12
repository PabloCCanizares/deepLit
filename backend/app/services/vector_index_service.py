"""
Servicio para construir, guardar y cargar indices vectoriales.
"""
import logging
from pathlib import Path
from typing import Optional

from langchain_community.vectorstores import FAISS

logger = logging.getLogger(__name__)


class VectorIndexService:
    def __init__(self, embedding_model, text_splitter=None):
        self.embedding_model = embedding_model
        self.text_splitter = text_splitter

    def index_documents(self, docs, vector_store: Optional[FAISS] = None) -> FAISS:
        """
        Divide documentos en chunks y construye o actualiza el vector store.
        """
        if self.text_splitter is None:
            raise ValueError("text_splitter es obligatorio para indexar documentos")

        splits = self.text_splitter.split_documents(docs)
        if vector_store is None:
            return FAISS.from_documents(documents=splits, embedding=self.embedding_model)

        vector_store.add_documents(documents=splits)
        return vector_store

    def save_index(self, vector_store: Optional[FAISS], save_path: str) -> None:
        """
        Guarda un indice FAISS a disco.
        """
        if vector_store is None:
            logger.warning("No hay vector store para guardar.")
            return

        Path(save_path).mkdir(parents=True, exist_ok=True)
        vector_store.save_local(save_path)
        logger.info("FAISS index guardado en: %s", save_path)

    def load_index(self, load_path: str) -> FAISS:
        """
        Carga un indice FAISS previamente guardado.
        """
        return FAISS.load_local(
            load_path,
            self.embedding_model,
            allow_dangerous_deserialization=True,
        )
