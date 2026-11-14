"""Access app URL patterns — auth endpoints."""

from django.urls import path

from apps.access.views.authentication import (
    ChangePasswordAPIView,
    LoginAPIView,
    LogoutAPIView,
    RefreshTokenAPIView,
)
from apps.access.views.user import UserProfileAPIView

urlpatterns = [
    path("auth/login/", LoginAPIView.as_view(), name="auth-login"),
    path("auth/refresh/", RefreshTokenAPIView.as_view(), name="auth-refresh"),
    path("auth/logout/", LogoutAPIView.as_view(), name="auth-logout"),
    path("auth/me/", UserProfileAPIView.as_view(), name="auth-me"),
    path("auth/change-password/", ChangePasswordAPIView.as_view(), name="auth-change-password"),
]
