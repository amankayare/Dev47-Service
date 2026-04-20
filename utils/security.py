import html

def sanitize_input(value: str) -> str:
    """Escape HTML to prevent XSS."""
    if not isinstance(value, str):
        return value
    return html.escape(value)
