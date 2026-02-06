from .base_agent import BaseAgent

class LanguageAgent(BaseAgent):
    def __init__(self, modelo, temperatura, system_prompt, offline):
        super().__init__(modelo=modelo, temperatura=temperatura, system_prompt=system_prompt, offline=offline)

    def invoke(self, prompt):
        return self.get_model().invoke(prompt).content