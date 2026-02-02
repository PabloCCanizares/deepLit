from .base_agent import BaseAgent

class LanguageAgent(BaseAgent):
    def __init__(self, modelo, temperatura, system_prompt):
        super().__init__(modelo=modelo, temperatura=temperatura, system_prompt=system_prompt)
    
    def invoke(self, prompt):
        return self.get_model().invoke(prompt).content