from langchain_core.documents import Document
from ..base_agents.rag_agent import RagAgent
from ..prompts import METADATA_RESEARCHER
from ..config import get_metadata_config, CLIENT, DATABASE

ARTICLES_COLLECTION = CLIENT[DATABASE]["articles"]

def metadata_research(state):
	config = get_metadata_config()
	agent = RagAgent(**config, system_prompt=METADATA_RESEARCHER)

	input = state["user_message"]
	history = state.get("history", [])
	user_id = state.get("user_id")

	# Cargar solo documentos del usuario actual
	documentos = load_documents(user_id=user_id)
	agent.process_documents(documentos)

	prompt_rag = agent.retrive(user_message=input)

	prompt_final = agent.create_prompt(message=prompt_rag)
	output = agent.invoke(prompt_final)

	new_history = agent.create_history_entry(input, output)

	agent.print_agent_execution(agent="METADATA RESEARCHER", input=prompt_final, output=output)

	return {"data": output, "history": new_history, "previous_agent": "metadata_researcher", "next_agent": None,}


def load_documents(user_id=None):
	"""
	Carga documentos de la colección articles de MongoDB.
	Si se proporciona user_id, filtra solo los artículos de ese usuario.
	"""
	query = {"id_user": user_id} if user_id else {}
	mongo_docs = list(ARTICLES_COLLECTION.find(query))

	documentos = []
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
		documentos.append(doc_final)

	return documentos
