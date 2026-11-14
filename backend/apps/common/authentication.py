from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication

from apps.common.exceptions import TokenExpiredError


class AppTokenAuthentication(TokenAuthentication):
    """
    Token authentication with optional idle expiry.
    Rejects and clears tokens older than `AUTH_TOKEN_VALIDITY_IN_HOURS` when that setting is non-zero.
    """

    keyword = "Token"

    def authenticate_credentials(self, key):
        """Returns the user and token, rejecting the token once it has outlived its validity window."""

        user, token = super().authenticate_credentials(key)
        validity_in_hours = settings.AUTH_TOKEN_VALIDITY_IN_HOURS
        if validity_in_hours and timezone.now() > token.created + timedelta(hours=validity_in_hours):
            token.delete()
            raise TokenExpiredError()
        return user, token
