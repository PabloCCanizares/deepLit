from langchain_ollama import ChatOllama
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from ...prompts import DEFAULT_SYSTEM_PROMPT
from app.config import settings

class BaseAgent:
    def __init__(self, modelo, temperatura, offline, system_prompt=DEFAULT_SYSTEM_PROMPT):
        if offline:
            self.llm = ChatOllama(model=modelo, temperature=temperatura)
        else:
            if not settings.GOOGLE_API_KEY:
                raise ValueError("GOOGLE_API_KEY no está configurada")
            self.llm = ChatGoogleGenerativeAI(
                model=modelo,
                temperature=temperatura,
                google_api_key=settings.GOOGLE_API_KEY
            )
        self.system_prompt = system_prompt
        self.offline = offline

    def get_model(self):
        return self.llm

    def invoke(self, prompt, web_search=False, structured_output=False):
        result = self.get_model().invoke(prompt)
        if structured_output:
            return result.model_dump()
        if web_search:
            return result.text
        return result.content

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

    def let_web_search(self):
        self.llm = self.llm.bind_tools([{"google_search": {}}])

    def print_agent_execution(self, agent, input, output):
        print("==============================")
        print(agent)
        tipo_ejecucion = "LOCAL" if self.offline else "ONLINE"
        print(f"Ejecutando en: {tipo_ejecucion}")
        print("Recibe:", input)
        print("Envia:", output)
        print("==============================")
