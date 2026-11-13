import html

def sanitize_input(value: str) -> str:
    """Basic string cleaning. React handles XSS protection on the frontend."""
    if not isinstance(value, str):
        return value
    return value.strip()
