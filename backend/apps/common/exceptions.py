from rest_framework.exceptions import AuthenticationFailed


class TokenExpiredError(AuthenticationFailed):
    """Raised when an auth token has outlived the configured validity window."""

    default_code = "token_expired"
    default_detail = "Session expired. Please log in again."
