from pymongo import MongoClient
from langchain_core.documents import Document
from ..base_agents.rag_agent import RagAgent
from ..prompts import METADATA_RESEARCHER
from ..config import METADATA_CONFIG

CLIENT = MongoClient("mongodb://localhost:27017/")
ARTICLES_COLLECTION = CLIENT["deeplit"]["articles"]
DOCUMENTOS = []

agent = RagAgent(**METADATA_CONFIG, system_prompt=METADATA_RESEARCHER)

def metadata_research(state):
	input = state["user_message"]
	history = state.get("history", [])
	load_documents()

	agent.process_documents(DOCUMENTOS)

	prompt_rag = agent.retrive(user_message=input, docs=[])

	prompt_final = agent.create_prompt(message=prompt_rag)
	output = agent.invoke(prompt_final)

	new_history = agent.create_history_entry(input, output)

	agent.print_agent_execution(agent="METADATA RESEARCHER", input=prompt_final, output=output)

	return {"data": output, "history": new_history, "previous_agent": "metadata_researcher", "next_agent": None,}
 

def load_documents():
	mongo_docs = list(ARTICLES_COLLECTION.find({}))
	for doc in mongo_docs:
		content = (
			f"TÍTULO: {doc.get('title')}\n"
			f"AUTORES: {doc.get('authors')}\n"
			f"AÑO: {doc.get('year', 'Desconocido')}\n"
			f"CATEGORÍA: {doc.get('category')}\n"
			f"TIPO: {doc.get('type', 'Documento')}\n"
			f"RESUMEN: {doc.get('summary', doc.get('abstract'))}\n"
			f"NOTAS DEL USUARIO: {doc.get('observations')}\n"
			f"KEYWORDS: {doc.get('keywords', [])}\n"
			f"LINK: {doc.get('link', doc.get('pdf_url'))}\n"
		)

		doc_final = Document(page_content=content)
		DOCUMENTOS.append(doc_final)
            
