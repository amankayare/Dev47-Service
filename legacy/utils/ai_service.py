from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ConversionResult:
    """
    Value object holding the result of an AI content conversion.
    Dependency Inversion: route and service layers share this contract,
    not a concrete model tied to any specific AI provider.
    """
    html_content: str
    suggested_title: str
    suggested_excerpt: str
    reading_time_minutes: int = 0
    suggested_quick_links: list = None
    suggested_tags: list = None


class BaseAIService(ABC):
    """
    Abstract base for all AI content conversion services.
    Liskov Substitution: any concrete implementation (Gemini, OpenAI, etc.)
    can be dropped in wherever BaseAIService is expected.
    """

    @abstractmethod
    def convert_to_html(self, raw_text: str, system_prompt: str | None = None) -> ConversionResult:
        """
        Convert plain text or markdown into structured HTML.

        Args:
            raw_text: Raw content (plain text or markdown).

        Returns:
            ConversionResult with html_content, suggested_title, suggested_excerpt, reading_time_minutes.

        Raises:
            ValueError: If the AI returns an unparseable response.
            Exception:  For upstream API failures.
        """
        ...
