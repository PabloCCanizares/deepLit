from .base_agent import BaseAgent

class DecisionAgent(BaseAgent):
    """
    Agente que decide entre múltiples opciones.
    Usa parsing manual para compatibilidad con Gemini (no soporta bien with_structured_output).
    """
    def __init__(self, valid_outputs, modelo, temperatura, system_prompt):
        super().__init__(modelo=modelo, temperatura=temperatura, system_prompt=system_prompt)
        self.valid_outputs = valid_outputs
         
    def invoke(self, prompt):
        # Añadir instrucción clara al prompt para que responda solo con una palabra
        decision_prompt = self.create_prompt(
            f"{prompt}\n\nIMPORTANTE: Responde ÚNICAMENTE con una de estas opciones, sin explicación: {', '.join(self.valid_outputs)}"
        )
        
        # Obtener respuesta del modelo
        response = self.llm.invoke(decision_prompt).content.strip().lower()
        
        # Buscar cuál de las opciones válidas está en la respuesta
        for option in self.valid_outputs:
            if option.lower() in response:
                return option
        
        # Fallback: primera opción (chatbot)
        return self.valid_outputs[0]
    