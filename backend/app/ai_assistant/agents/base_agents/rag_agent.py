from langchain_core.vectorstores import InMemoryVectorStore
from .base_agent import BaseAgent

class RagAgent(BaseAgent):
    def __init__(self, modelo, temperatura, system_prompt, text_splitter, embbedings):
        super().__init__(modelo=modelo, temperatura=temperatura, system_prompt=system_prompt)
        self.text_splitter = text_splitter
        self.embbedings = embbedings
        self.vector_store = InMemoryVectorStore(embedding=embbedings)
        self.documents = []
    
    def invoke(self, prompt):
        return self.get_model().invoke(prompt).content

    def process_documents(self, docs):
        splits = self.text_splitter.split_documents(docs)
        self.vector_store.add_documents(documents=splits)

    def retrive(self, user_message, docs):
        self.process_documents(docs)
        retrieved_docs = self.vector_store.similarity_search(user_message, k=5) # k -> Cuantos chunks recuperar
        retrieved_text = "\n\n".join(
            (f"[Fuente: Pág {doc.metadata.get('page', '?')}] {doc.page_content}")
            for doc in retrieved_docs
        )
        rag = (
            f"\nInformación de contexto recuperada del artículo:\n"
            f"{retrieved_text}\n\n"
        )

        return rag