from .base_agent import BaseAgent
from enum import Enum
from pydantic import create_model, Field

class DecisionAgent(BaseAgent):
    def __init__(self, valid_outputs, modelo, temperatura, system_prompt):
        super().__init__(modelo=modelo, temperatura=temperatura, system_prompt=system_prompt)
        esquema = self.create_schema(valid_outputs)
        self.llm = self.llm.with_structured_output(esquema)
    
    def create_schema(self, valid_outputs):
        DynamicEnum = Enum('DynamicEnum', {opt: opt for opt in valid_outputs}, type=str)

        RouteQuery = create_model(
            'RouteQuery',
            destination=(
                DynamicEnum, 
                Field(..., description=f"Decide una opción entre: {', '.join(valid_outputs)}")
            )
        )

        return RouteQuery 
         
    def invoke(self, prompt):
        return self.get_model().invoke(prompt).destination.value
    