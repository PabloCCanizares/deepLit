from ..base_agents.language_agent import LanguageAgent
from ..prompts import WEB_SEARCHER_PROMPT
from ..config import get_web_searcher_config

def web_search(state):
    config = get_web_searcher_config()
    if config["offline"]:
        output = "Estando en modo local, no puedo acceder a internet" 
    else:
        agent = LanguageAgent(**config, system_prompt=WEB_SEARCHER_PROMPT)
        agent.let_web_search() # Para que pueda buscar por internet

        input = state["user_message"]

        prompt = agent.create_prompt(message=input)

        output = agent.invoke(prompt, web_search=True)

        agent.print_agent_execution(agent="WEB SEARCHER", input=input, output=output)

    return {'data': output, 'previous_agent': 'web_searcher', 'next_agent': None}
