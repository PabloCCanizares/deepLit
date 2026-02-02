from ..base_agents.language_agent import LanguageAgent
from ..prompts import CLEANER_PROMPT
from ..config import CLEANER_CONFIG

agent = LanguageAgent(**CLEANER_CONFIG, system_prompt=CLEANER_PROMPT)

# ---FUNCIÓN QUE DESEMPEÑA EL CLEANER ---
def clean_text(state):
    input = state["user_message"]
    
    prompt = agent.create_prompt(message=input)

    output = agent.invoke(prompt)

    agent.print_agent_execution(agent="CLEANER", input=input, output=output)

    return {'user_message': output, 'previous_agent': 'cleaner', 'next_agent': 'master'}
