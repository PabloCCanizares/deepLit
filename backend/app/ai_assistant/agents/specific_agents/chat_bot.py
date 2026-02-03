from ..base_agents.language_agent import LanguageAgent
from ..prompts import CHATBOT_PROMPT
from ..config import CHATBOT_CONFIG


agent = LanguageAgent(**CHATBOT_CONFIG, system_prompt=CHATBOT_PROMPT)

def chat_bot(state):
    input = state["user_message"]
    history = state.get("history", [])
    input_processed = input + f"El historial es: {history}. " + f"El usuario es: '{state['user']}'"

    prompt = agent.create_prompt(message=input_processed)

    output = agent.invoke(prompt)

    new_history = agent.create_history_entry(input, output)
    
    agent.print_agent_execution(agent="CHATBOT", input=input_processed, output=output)

    return {'data': output, 'history': new_history, 'previous_agent': 'chatbot', 'next_agent': None}
