"""JWT-based authentication views for FinPilot."""

import logging

from django.conf import settings
from django.contrib.auth.models import update_last_login
from rest_framework import status
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.access.serializers.authentication import (
    ChangePasswordSerializer,
    FinPilotTokenObtainPairSerializer,
    LoggedInUserSerializer,
)
from apps.common.views import AppAPIView, NonAuthenticatedAPIMixin

logger = logging.getLogger(__name__)

REFRESH_COOKIE_NAME = "finpilot_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth/"


def _set_refresh_cookie(response, refresh_token_str):
    """Sets the httpOnly refresh token cookie on the response."""

    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh_token_str,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="Lax",
        path=REFRESH_COOKIE_PATH,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
    )
    return response


class LoginAPIView(NonAuthenticatedAPIMixin, AppAPIView):
    """Authenticates a user with email and password and issues JWT access + refresh tokens."""

    serializer_class = FinPilotTokenObtainPairSerializer
    throttle_scope = "login"

    def post(self, request, *args, **kwargs):
        """Validates credentials; returns access token in body and refresh token in httpOnly cookie."""

        serializer = self.get_valid_serializer(data=request.data)
        user = serializer.validated_data["user"]
        update_last_login(None, user)
        refresh = RefreshToken.for_user(user)
        access = str(refresh.access_token)
        logger.info("user.login", extra={"user_id": user.id, "user_type": user.user_type})
        response = self.send_response({"access": access, "user": LoggedInUserSerializer(user).data})
        return _set_refresh_cookie(response, str(refresh))


class RefreshTokenAPIView(NonAuthenticatedAPIMixin, AppAPIView):
    """Rotates the refresh token from the httpOnly cookie and returns a new access token."""

    def post(self, request, *args, **kwargs):
        """Issues new access + refresh tokens; old refresh is blacklisted."""

        raw_refresh = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if not raw_refresh:
            return self.send_response(
                {"detail": "Refresh token not provided."},
                status_code=status.HTTP_401_UNAUTHORIZED,
                action_code="TOKEN_EXPIRED",
            )
        try:
            old_token = RefreshToken(raw_refresh)
            old_token.blacklist()
            user_id = old_token.payload.get("user_id")
            from apps.access.models import User

            user = User.objects.get(pk=user_id)
            new_refresh = RefreshToken.for_user(user)
            access = str(new_refresh.access_token)
            response = self.send_response({"access": access})
            return _set_refresh_cookie(response, str(new_refresh))
        except (TokenError, InvalidToken, Exception):
            response = self.send_response(
                {"detail": "Token expired or invalid."},
                status_code=status.HTTP_401_UNAUTHORIZED,
                action_code="TOKEN_EXPIRED",
            )
            response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)
            return response


class LogoutAPIView(AppAPIView):
    """Blacklists the refresh token and clears the cookie."""

    def post(self, request, *args, **kwargs):
        """Blacklists the current refresh token so both tokens are invalid."""

        raw_refresh = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if raw_refresh:
            try:
                token = RefreshToken(raw_refresh)
                token.blacklist()
            except Exception:
                pass
        response = self.send_response({"detail": "Logged out successfully."})
        response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH)
        return response


class ChangePasswordAPIView(AppAPIView):
    """Changes the authenticated user's password and blacklists all outstanding refresh tokens."""

    serializer_class = ChangePasswordSerializer

    def post(self, request, *args, **kwargs):
        """Verifies current password, sets new one, blacklists all refresh tokens for this user."""

        user = self.get_authenticated_user()
        self.get_valid_serializer(data=request.data)
        user.set_password(request.data.get("new_password"))
        user.save(update_fields=["password"])
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

        OutstandingToken.objects.filter(user=user).delete()
        return self.send_response({"detail": "Password updated successfully."})
