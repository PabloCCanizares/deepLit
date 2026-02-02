from ..base_agents.decision_agent import DecisionAgent
from ..prompts import MASTER_PROMPT
from ..config import MASTER_CONFIG

agent = DecisionAgent(**MASTER_CONFIG, system_prompt=MASTER_PROMPT)

# ---FUNCIÓN QUE DESEMPEÑA EL CHECKER ---
def master_decider(state):
    output = None
    input = state["user_message"]

    if state["selected_mode"]:
        output = state["selected_mode"]
    else:
        prompt = agent.create_prompt(message=input)
        output = agent.invoke(prompt)

    agent.print_agent_execution(agent="MASTER", input=input, output=output)

    return {'previous_agent': 'master', 'next_agent': output}

    
    