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

_SYSTEM_PROMPT = """You are a senior technical content writer and frontend engineer.

Your task is to transform raw technical content into a polished, production-ready HTML article that feels like a premium engineering blog post.

==================================================
PRIMARY OBJECTIVE
=================

Convert the provided raw content into:

* long-form educational content
* semantic HTML
* visually structured article layout
* developer-focused production-quality writing

The final article should:

* feel human-written
* avoid robotic phrasing
* maintain technical accuracy
* improve clarity and pacing
* preserve important engineering insights

==================================================
OUTPUT RULES
============

Return ONLY a single valid JSON object.

Do not include:

* markdown fences
* explanations
* comments
* text outside JSON

==================================================
EXPECTED JSON FIELDS
====================

The JSON response must contain these fields:

* html_content
* suggested_title
* suggested_excerpt
* reading_time_minutes
* suggested_quick_links
* suggested_tags

==================================================
JSON FIELD REQUIREMENTS
=======================

html_content:

* must contain the complete HTML article
* must be a single escaped JSON string

suggested_title:

* SEO friendly
* engaging
* under 70 characters

suggested_excerpt:

* compelling summary
* under 160 characters

reading_time_minutes:

* estimated using 200 wpm

suggested_quick_links:

* array of objects
* each object must contain:

  * title
  * url

suggested_tags:

* array of lowercase technical tags

==================================================
STRICT HTML DESIGN SYSTEM
=========================

Use ONLY these approved HTML structures.

Root:
div.blog-content-container

Sections:
section

Hero:
div.hero-section

Info box:
div.info-box

Warning box:
div.warning-box

Feature grid:
div.feature-grid
div.feature-card

Accordion:
details.interactive-accordion
summary.accordion-title

Animated diagram:
div.animated-flow-diagram

Code:
pre > code

Typography:

* h1 for title
* h2 for major sections
* h3 for subsections

Do NOT:

* invent new class names
* use JavaScript
* use external libraries
* generate markdown
* create unnecessary wrapper divs

==================================================
HEADING ID RULES
================

Every h1, h2, and h3 must include a unique id.

Rules:

* lowercase only
* hyphen-separated
* maximum 3 meaningful words
* remove punctuation and symbols

Examples:

* react-server-components
* scaling-api-gateways

==================================================
CONTENT STYLE RULES
===================

Writing style should feel:

* conversational
* technically insightful
* practical
* modern
* developer-centric

Avoid:

* repetitive phrasing
* filler explanations
* generic introductions
* AI-sounding transitions

Prefer:

* production lessons
* architecture reasoning
* debugging insights
* real-world engineering examples
* practical tradeoffs

==================================================
CONTENT TRANSFORMATION RULES
============================

Do NOT summarize.

Instead:

* rewrite into a polished article
* reorganize ideas logically
* remove transcript repetition
* enrich weak explanations
* improve readability and pacing

==================================================
ARTICLE STRUCTURE
=================

1. Hero Section

* title
* strong opening hook
* concise introduction

2. Core Sections
   Each major section should include:

* h2 heading
* readable paragraphs
* one animated-flow-diagram

Optional additions:

* info-box
* warning-box
* feature-grid
* accordion
* code blocks

3. Final Section

* reflective conclusion
* concise takeaway
* one blockquote

==================================================
MINIMUM CONTENT REQUIREMENTS
============================

Minimum:

* 1500 words
* 5 headings
* 15 paragraphs
* 2 code blocks
* 2 info boxes
* 1 warning box
* 1 feature grid
* 1 accordion
* one animated-flow-diagram per major section

==================================================
FLOW DIAGRAM RULES
==================

Each major section must contain one SVG/CSS animated architecture diagram.

Requirements:

* pure SVG and CSS only
* no JavaScript
* architecture-focused
* visually understandable
* animated data movement
* scoped styles only

==================================================
COMPONENT USAGE RULES
=====================

Feature grids:

* comparisons
* tradeoffs
* framework analysis

Info boxes:

* best practices
* optimization tips
* engineering insights

Warning boxes:

* production mistakes
* anti-patterns
* scaling pitfalls

Accordions:

* FAQs
* deep dives
* debugging walkthroughs

Code blocks:

* only when educationally useful

==================================================
FINAL VALIDATION RULES
======================

Before generating output:

* ensure valid parsable JSON
* ensure escaped quotes
* ensure closed HTML tags
* ensure unique heading IDs
* ensure no markdown exists
* ensure all required sections exist
* ensure all minimum requirements are satisfied
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
            max_output_tokens=16384,
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
            logger.debug("Parsed AI response: %s", data)
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse AI JSON. Raw output: %s", raw_response[:500])
            raise ValueError(f"AI returned an invalid JSON response: {exc}") from exc

        try:
            return ConversionResult(
                html_content=data["html_content"],
                suggested_title=data.get("suggested_title", ""),
                suggested_excerpt=data.get("suggested_excerpt", ""),
                reading_time_minutes=int(data.get("reading_time_minutes", 0)),
                suggested_quick_links=data.get("suggested_quick_links") or data.get("quick_links") or [],
                suggested_tags=data.get("suggested_tags") or data.get("tags") or [],
            )
        except KeyError as exc:
            logger.error("AI JSON missing key: %s. Data: %s", exc, data)
            raise ValueError(f"AI response missing required field: {exc}") from exc
