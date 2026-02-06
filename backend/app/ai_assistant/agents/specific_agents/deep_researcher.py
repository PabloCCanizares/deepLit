from langchain_core.documents import Document
from langchain_community.vectorstores import FAISS
from ..base_agents.rag_agent import RagAgent
from ..prompts import DEEP_RESEARCHER_PROMPT
from ..config import get_deep_researcher_config, CLIENT, DATABASE

PDF_COLLECTION = CLIENT[DATABASE]["pdfs"]
DOCUMENTOS = []

def deep_research(state):
	config = get_deep_researcher_config()
	agent = RagAgent(**config, system_prompt=DEEP_RESEARCHER_PROMPT)

	input = state["user_message"]
	history = state.get("history", [])
	input_processed = input + f"El hisotrial es : {history}"

	# RAG
	load_documents(agent)
	rag = agent.retrive(user_message=input)

	prompt_rag = input + rag

	prompt_final = agent.create_prompt(message=prompt_rag)
	output = agent.invoke(prompt_final)

	new_history = agent.create_history_entry(input, output)

	agent.print_agent_execution(agent="DEEP RESEARCHER", input=prompt_final, output=output)

	return {'data': output, 'history': new_history, 'previous_agent': 'deep_researcher', 'next_agent': None}

def process_document(agent, embbedings):
	texts = []
	embeddings = []
	metadatas = []

	for e in embbedings.values():
		vector = e["vector"]
		texto = e["text"]
		metadata = e["metadata"]

		texts.append(texto)
		embeddings.append(vector)
		metadatas.append(metadata)

	if agent.vector_store is None:
		agent.vector_store = FAISS.from_embeddings(
			text_embeddings=list(zip(texts, embeddings)),
			embedding=agent.embbedings,
			metadatas=metadatas
		)
	else:
		agent.vector_store.add_embeddings(
			text_embeddings=list(zip(texts, embeddings)),
			metadatas=metadatas
		)

def load_documents(agent):
	cursor = PDF_COLLECTION.find({})
	mongo_docs = list(cursor)
	for record in mongo_docs:
		embbedings = record.get("embbedings")
		if embbedings:
			process_document(agent=agent, embbedings=embbedings)
