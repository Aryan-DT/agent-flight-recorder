import os
from dotenv import load_dotenv
import traceroot
from traceroot import Integration
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openrouter import OpenRouterProvider

load_dotenv()

traceroot.initialize(integrations=[Integration.PYDANTIC_AI])

model = OpenAIChatModel(
    "google/gemma-4-31b-it:free",
    provider=OpenRouterProvider(api_key=os.environ["OPENROUTER_API_KEY"]),
)

agent = Agent(model, system_prompt="You are a helpful assistant.")

result = agent.run_sync("What is the capital of France?")
print(result.output)
traceroot.flush()
