from langchain_community.vectorstores import FAISS
from .base_agent import BaseAgent

class RagAgent(BaseAgent):
    def __init__(self, modelo, temperatura, system_prompt, text_splitter, embbedings, offline):
        super().__init__(modelo=modelo, temperatura=temperatura, system_prompt=system_prompt, offline=offline)
        self.text_splitter = text_splitter
        self.embbedings = embbedings
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
        splits = self.text_splitter.split_documents(docs)
        if self.vector_store is None:
            self.vector_store = FAISS.from_documents(documents=splits, embedding=self.embbedings)
        else:
            self.vector_store.add_documents(documents=splits)

        embbedings_dict = {}
        for idx, split in enumerate(splits):
            vector = self.embbedings.embed_query(split.page_content)
            split.metadata["page"] = split.metadata["page"] + 1
            embbedings_dict[str(idx)] = {
                "vector": vector,
                "text": split.page_content,
                "metadata": split.metadata
            }

        return embbedings_dict

    def retrive(self, user_message):
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