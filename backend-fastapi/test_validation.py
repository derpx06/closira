import asyncio
from app.services.rag_engine import rag_engine

async def main():
    rag_engine.init_client()
    query = "what is the ticket price for bangalore branch and what are the timings?"
    context = "Source Title: [GROUNDED TRUTH] there is branch in banglore\nContent:\nbreakout time is from 9am to 5pm and the price per hour is 500 rs"
    
    prompt = f"""You are a knowledgeable, helpful Support Chatbot.
Your answers must be grounded ONLY in the Context and Sitemap provided below.

STRICT RULES (you MUST follow ALL of these):
1. NEVER invent facts, URLs, page names, or features not present in the Context or Sitemap.
2. If the Context contains relevant facts, answer directly and concretely using those facts.
3. If the Context does not contain the answer, say clearly: "I don't have specific information about that in our knowledge base."

KNOWLEDGE BASE CONTEXT (answer ONLY from this):
{context}

User Question: {query}
"""
    completion = await rag_engine.client.chat.completions.create(
        model=rag_engine.model_name,
        temperature=0.1,
        max_tokens=800,
        messages=[{'role': 'user', 'content': prompt}],
    )
    result = completion.choices[0].message.content
    print("----- LLM OUTPUT -----")
    print(result)

    validator_prompt = f"""You are a strict Verification Guard.
Analyze the following GENERATED ANSWER against the provided CONTEXT.

CONTEXT:
{context}

GENERATED ANSWER:
{result}

TASK:
Does the GENERATED ANSWER contain completely fabricated factual claims, numbers, or URLs that are absent from or contradict the CONTEXT?
If YES, output 'FAIL'.
If the answer is supported by the CONTEXT (even if phrased differently), or if it is just a friendly greeting/pleasantry, output 'PASS'.

Respond with exactly one word: 'PASS' or 'FAIL'. Do not explain."""

    val_completion = await rag_engine.client.chat.completions.create(
        model=rag_engine.model_name,
        temperature=0.0,
        max_tokens=10,
        messages=[{'role': 'user', 'content': validator_prompt}],
    )
    val_result = val_completion.choices[0].message.content
    print("----- VALIDATOR OUTPUT -----")
    print(val_result)

if __name__ == "__main__":
    asyncio.run(main())
