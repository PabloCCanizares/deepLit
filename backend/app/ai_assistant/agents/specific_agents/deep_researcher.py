from langchain_community.document_loaders.pdf import PyMuPDFLoader
from langchain_community.document_loaders.parsers import RapidOCRBlobParser
from pathlib import Path
from pymongo import MongoClient
from ..base_agents.rag_agent import RagAgent
from ..prompts import DEEP_RESEARCHER_PROMPT
from ..config import DEEP_RESEARCHER_CONFIG

CLIENT = MongoClient("mongodb://localhost:27017/")
PDF_COLLECTION = CLIENT["deeplit"]["pdfs"]
DOCUMENTOS = []

agent = RagAgent(**DEEP_RESEARCHER_CONFIG, system_prompt=DEEP_RESEARCHER_PROMPT)

def deep_research(state):
	input = state["user_message"]
	history = state.get("history", [])
	input_processed = input + f"El hisotrial es : {history}"

	# RAG
	load_documents()
	agent.process_documents(docs=DOCUMENTOS)
	rag = agent.retrive(user_message=input)
    
	prompt_rag = input + rag

	prompt_final = agent.create_prompt(message=prompt_rag)
	output = agent.invoke(prompt_final)

	new_history = agent.create_history_entry(input, output)
    
	agent.print_agent_execution(agent="DEEP RESEARCHER", input=prompt_final, output=output)

	return {'data': output, 'history': new_history, 'previous_agent': 'deep_researcher', 'next_agent': None}
 

def load_document(record, file_path):
	file_path = Path(file_path)
	loader = PyMuPDFLoader(str(file_path), 
					mode="page", 
					images_inner_format="markdown-img", 
					images_parser=RapidOCRBlobParser(), 
					extract_tables="markdown"
					)
	docs = loader.load()
	for doc in docs:
		if record.get("title"):
			doc.metadata["title"] = record.get("title")
	
	DOCUMENTOS.extend(docs)

def load_documents():
	cursor = PDF_COLLECTION.find({}, {"file_path": 1, "title": 1}) 
	mongo_docs = list(cursor)
	for record in mongo_docs:
		file_path = record.get("file_path")
		load_document(record=record, file_path=file_path)
