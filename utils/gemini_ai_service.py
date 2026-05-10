import json
import logging
import re

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableSequence

from .ai_service import BaseAIService, ConversionResult

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompt — server-side only, never exposed to the client.
# User input is injected into the "human" slot, NOT into this string,
# which prevents prompt injection attacks.
# ---------------------------------------------------------------------------
# _SYSTEM_PROMPT = """You are a professional technical blog editor.
# Convert the user's raw text or markdown into clean, semantic HTML.

# Rules:
# - Use ONLY these tags: <h2>, <h3>, <h4>, <p>, <ul>, <ol>, <li>,
#   <strong>, <em>, <code>, <pre>, <blockquote>, <a>, <hr>
# - Do NOT include <html>, <head>, <body>, or <style> tags
# - Wrap inline code in <code>; wrap multi-line code blocks in <pre><code>
# - Preserve all technical terms, names, and commands exactly as written
# - Structure content logically: headings → paragraphs → lists → code
# - Respond ONLY with valid JSON — no markdown fences, no extra text:
# {{
#   "html_content": "<h2>...</h2><p>...</p>",
#   "suggested_title": "A catchy, SEO-friendly title under 70 characters",
#   "suggested_excerpt": "One compelling sentence (max 160 chars) summarising the post."
# }}"""

_SYSTEM_PROMPT = """ You are a senior technical content writer AND frontend engineer.

Your task is to convert the given raw blog content (or podcast transcript) into a highly presentable, production-ready HTML blog using a STRICT predefined design system.

--------------------------------------------------
🎯 GOAL
--------------------------------------------------
- Convert content into a visually structured, readable, developer-friendly blog
- Maintain a natural, human writing tone (NOT AI-like)
- Output MUST be clean, structured HTML (no random divs or inline chaos)

--------------------------------------------------
🚨 STRICT HTML STRUCTURE RULES (VERY IMPORTANT)
--------------------------------------------------

You MUST ONLY use the following layout patterns:

1. Root container:
<div class="blog-content-container">

2. Sections:
<section> ... </section>

3. Hero section:
<div class="hero-section">

4. Highlight boxes:
<div class="info-box">...</div>
<div class="warning-box">...</div>

5. Grid layout:
<div class="feature-grid">
    <div class="feature-card">...</div>
</div>

6. Code blocks:
<pre><code>...</code></pre>

7. Typography:
- h1 → main title
- h2 → section titles
- h3 → sub-points

❌ DO NOT:
- Create new CSS classes
- Add random inline styles (except minimal spacing if needed)
- Break the structure
- Use unnecessary wrappers

--------------------------------------------------
🆔 SECTION ID RULES (CRITICAL)
--------------------------------------------------

EVERY <h2> MUST HAVE A UNIQUE id ATTRIBUTE.

Format rules:
- lowercase only
- words separated by hyphens
- no spaces, no special characters
- keep it short but meaningful

Examples:
"The Illusion of Learning" → id="illusion"
"Libraries Make Things Easy" → id="libraries"
"The Real Difficulty: Data, Not Models" → id="data-problem"

❌ DO NOT:
- leave any <h2> without id
- use duplicate ids
- use long sentence-like ids
- use camelCase or spaces

--------------------------------------------------
🎨 DESIGN INTENT (IMPORTANT)
--------------------------------------------------
The layout should feel like:
- Modern dev blog (Medium / Notion / Dev.to hybrid)
- Clean spacing, readable hierarchy
- Mix of:
  - explanation
  - cards
  - callouts (info/warning)
  - code snippets

--------------------------------------------------
🧠 CONTENT TRANSFORMATION RULES
--------------------------------------------------

1. DO NOT summarize — rewrite as a proper article
2. Make it conversational and slightly opinionated
3. Remove repetition from transcript
4. Add clarity where needed
5. Keep it engaging (hooks, insights, developer tone)
6. Add real-world examples where helpful

--------------------------------------------------
🧱 STRUCTURE TO FOLLOW
--------------------------------------------------

1. Hero Section
   - Title
   - Short intro (hook)

2. Core Sections (repeat pattern)
   Each section MUST include:
   - <h2 id="..."> heading
   - paragraph explanation
   - OPTIONAL:
     - feature-grid (for comparisons)
     - info-box (tips)
     - warning-box (mistakes)
     - code block (if relevant)

3. Final Section
   - Must also have id (e.g., id="final-thought")
   - Key takeaway (blockquote)
   - Closing paragraph

4. Blog/Article length:
   — Must be atleast 1500 words
   — Must have atleast 5 headings
   — Must have atleast 15 paragraphs
   — Must have atleast 2 code blocks
   — Must have atleast 2 info boxes
   — Must have atleast 1 feature grids

--------------------------------------------------
💡 SMART FORMATTING RULES
--------------------------------------------------

- Use feature-grid ONLY when comparing concepts
- Use warning-box for mistakes
- Use info-box for pro tips
- Use code blocks ONLY when necessary
- Keep sections visually balanced (not text-heavy)

--------------------------------------------------
⚠️ OUTPUT FORMAT
--------------------------------------------------

Return ONLY a valid JSON object — no markdown fences, no extra text, no HTML outside the json value:

{{
  "html_content": "<div class=\"blog-content-container\">...</div>",
  "suggested_title": "A catchy, SEO-friendly title (max 70 characters)",
  "suggested_excerpt": "One compelling sentence that summarises the post (max 160 characters)",
  "reading_time_minutes": 5
}}

Notes:
- reading_time_minutes: estimate based on ~200 words per minute for technical readers
- suggested_title: must be unique, engaging, and NOT start with generic words like 'Understanding' or 'Exploring'
- suggested_excerpt: must hook the reader in one sentence

DO NOT:
- Add explanations before or after the JSON
- Wrap the JSON in markdown fences (```)
- Add HTML comments outside the html_content value
- Add explanations
- Add markdown
- Add comments outside HTML
"""





class GeminiAIService(BaseAIService):
    """
    LangChain-backed Google Gemini implementation of BaseAIService.

    Single Responsibility: this class only orchestrates the LangChain
    prompt → LLM → parser chain. It does not handle HTTP, validation,
    or database concerns.

    Open/Closed: the prompt template and model are injected at construction
    time, so behaviour can be extended without modifying this class.
    """

    def __init__(self, api_key: str, model_name: str = "gemini-1.5-flash") -> None:
        self._llm = ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=api_key,
            temperature=0.3,        # Low temperature → deterministic, structured HTML
            max_output_tokens=8192,
        )
        self._chain: RunnableSequence = self._build_chain()

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _build_chain(self) -> RunnableSequence:
        """Compose the LangChain LCEL pipeline: prompt | llm | parser."""
        prompt = ChatPromptTemplate.from_messages([
            ("system", _SYSTEM_PROMPT),
            ("human", "Convert this content:\n\n{raw_text}"),
        ])
        return prompt | self._llm | StrOutputParser()



    # ------------------------------------------------------------------
    # Public interface (satisfies BaseAIService contract)
    # ------------------------------------------------------------------

    def convert_to_html(self, raw_text: str, system_prompt: str | None = None) -> ConversionResult:
        """
        Invoke the Gemini model via LangChain and return a ConversionResult.

        Args:
            raw_text:      The raw text/markdown to convert.
            system_prompt: Optional override. When provided, a fresh LangChain
                           chain is built with this prompt instead of the default.

        Raises:
            ValueError: If the model returns unparseable JSON or is missing required keys.
            Exception:  Propagated as-is for upstream API / network failures.
        """
        # Build a one-off chain when a custom prompt is requested;
        # fall back to the pre-built default chain otherwise.
        if system_prompt:
            prompt_template = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                ("human", "Convert this content:\n\n{raw_text}"),
            ])
            chain = prompt_template | self._llm | StrOutputParser()
        else:
            chain = self._chain

        try:
            raw_response: str = chain.invoke({"raw_text": raw_text})
        except Exception as exc:
            logger.error("Gemini API call failed: %s", exc, exc_info=True)
            raise

        # Strip markdown fences the model sometimes wraps around JSON
        fence_re = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)
        cleaned = fence_re.sub("", raw_response).strip()

        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse AI JSON. Raw output: %s", raw_response[:500])
            raise ValueError(f"AI returned an invalid JSON response: {exc}") from exc

        try:
            return ConversionResult(
                html_content=data["html_content"],
                suggested_title=data.get("suggested_title", ""),
                suggested_excerpt=data.get("suggested_excerpt", ""),
                reading_time_minutes=int(data.get("reading_time_minutes", 0)),
            )
        except KeyError as exc:
            logger.error("AI JSON missing key: %s. Data: %s", exc, data)
            raise ValueError(f"AI response missing required field: {exc}") from exc
