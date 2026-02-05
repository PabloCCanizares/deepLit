from langchain_ollama import ChatOllama
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from ..config import DEFAULT_MODEL, DEFAULT_TEMPERATURE
from ..prompts import DEFAULT_SYSTEM_PROMPT

class BaseAgent:
    def __init__(self, modelo=DEFAULT_MODEL, temperatura=DEFAULT_TEMPERATURE, system_prompt=DEFAULT_SYSTEM_PROMPT):
        self.llm = ChatOllama(model=modelo, temperature=temperatura) 
        self.system_prompt = system_prompt
    
    def get_model(self):
        return self.llm
    
    def set_structured_output(self, esquema):
        self.llm = self.llm.with_structured_output(esquema)
        
    def create_prompt(self, message):
        prompt = [
            SystemMessage(content=self.system_prompt), 
            HumanMessage(content=message)
        ]
        return prompt
    
    def create_history_entry(self, user_input, ai_output):
        """
        Crea los objetos de mensaje necesarios para actualizar el historial en LangGraph.
        """
        return [
            HumanMessage(content=user_input),
            AIMessage(content=ai_output)
        ]
    
    def print_agent_execution(self, agent, input, output):
        print("==============================")
        print(agent)
        print("Recibe:", input)
        print("Envia:", output)
        print("==============================")

