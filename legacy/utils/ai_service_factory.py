from config import Config
from .ai_service import BaseAIService
from .gemini_ai_service import GeminiAIService


def create_ai_service() -> BaseAIService:
    """
    Factory function that constructs and returns a concrete BaseAIService.

    Open/Closed Principle: to switch providers (e.g. OpenAI, Anthropic),
    add a new service class that extends BaseAIService and update this
    factory — no other file needs to change.

    Raises:
        RuntimeError: If GEMINI_API_KEY is not configured in the environment.
    """
    if not Config.GEMINI_API_KEY:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured. "
            "Set it in your .env file or environment variables."
        )

    return GeminiAIService(
        api_key=Config.GEMINI_API_KEY,
        model_name=Config.GEMINI_MODEL,
    )
