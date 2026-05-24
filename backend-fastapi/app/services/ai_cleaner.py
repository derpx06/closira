import os
from google import genai
from google.genai import types
from app.core.config import settings


class AICleaner:
    def __init__(self):
        api_key = settings.gemini_api_key or os.getenv("GEMINI_API_KEY")
        self.client = genai.Client(api_key=api_key) if api_key else None
        self.model_name = settings.gemini_model or os.getenv("GEMINI_MODEL") or "gemini-2.0-flash"

    async def extract_knowledge(self, raw_text: str, url: str) -> str:
        if not self.client:
            return raw_text
        if len(raw_text) < 200:
            return raw_text

        template = f"""You are an expert at extracting core knowledge from raw web page text.
Below is the raw text from the webpage: {url}

YOUR TASK:
1. Extract only the core factual information, instructions, and meaningful content.
2. Remove all UI boilerplate: navigation menus, "Click here", "Sign up", copyright notices, cookie banners.
3. Remove repeated/duplicate content.
4. Keep the text structured and professional.
5. Preserve concrete business facts whenever present:
   - locations/cities/addresses
   - pricing, packages, durations, timings
   - contact channels and booking steps
   - office/branch/service availability
6. If the page contains no meaningful content, return exactly: NO_CONTENT

Raw Text:
{raw_text[:10000]}

Cleaned Knowledge:"""

        try:
            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=template,
                config=types.GenerateContentConfig(temperature=0.0),
            )
            result = (response.text or '').strip()
            return "" if result == "NO_CONTENT" else result
        except Exception as e:
            print("AI Cleaning error:", e)
            return raw_text

    async def extract_knowledge_with_privacy(self, raw_text: str, url: str) -> str:
        if not self.client:
            return "Failed to summarize page safely."

        template = f"""You are a privacy-first AI knowledge extractor.
Below is raw text from a page: {url}

YOUR TASK:
1. Summarize the PURPOSE and GENERAL CONTENT of this page for a company knowledge base.
2. CRITICAL: Strip out all Personally Identifiable Information (PII): names, emails, account IDs, balances, private settings.
3. If this is a private dashboard or profile, describe the TYPE of page (e.g. "User account settings page") but DO NOT capture the actual values.
4. If it contains general documentation or features, summarize them clearly.
5. Goal: Help the RAG model know *what* is on this page without knowing *who* it belongs to.

Raw Text:
{raw_text[:8000]}

Privacy-Preserving Summary:"""

        try:
            response = await self.client.aio.models.generate_content(
                model=self.model_name,
                contents=template,
                config=types.GenerateContentConfig(temperature=0.0),
            )
            result = (response.text or '').strip()
            return "" if result == "NO_CONTENT" else result
        except Exception as e:
            print("AI Privacy Cleaning error:", e)
            return "Failed to summarize page safely."


ai_cleaner = AICleaner()
