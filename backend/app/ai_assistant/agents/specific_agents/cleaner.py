from ..base_agents.language_agent import LanguageAgent
from ..prompts import CLEANER_PROMPT
from ..config import get_cleaner_config

def clean_text(state):
    config = get_cleaner_config()
    agent = LanguageAgent(**config, system_prompt=CLEANER_PROMPT)

    input = state["user_message"]

    prompt = agent.create_prompt(message=input)

    output = agent.invoke(prompt)

    agent.print_agent_execution(agent="CLEANER", input=input, output=output)

    return {'user_message': output, 'previous_agent': 'cleaner', 'next_agent': 'master'}
