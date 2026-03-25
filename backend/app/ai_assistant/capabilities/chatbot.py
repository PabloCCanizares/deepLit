from ..agents.base_agents.language_agent import LanguageAgent
from ..agents.prompts import CHATBOT_PROMPT
from ..agents.config import get_chatbot_config

def chat_bot(state):
    config = get_chatbot_config()
    agent = LanguageAgent(**config, system_prompt=CHATBOT_PROMPT)

    input = state["user_message"]
    history = state.get("history", [])
    input_processed = input + f"El historial es: {history}. " + f"El usuario es: '{state['user']}'"

    prompt = agent.create_prompt(message=input_processed)

    output = agent.invoke(prompt)

    new_history = agent.create_history_entry(input, output)

    agent.print_agent_execution(agent="CHATBOT", input=input_processed, output=output)

    return {'data': output, 'history': new_history, 'previous_agent': 'chatbot', 'next_agent': None}
