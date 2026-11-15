"""Access app URL patterns — auth and admin user management endpoints."""

from django.urls import path

from apps.access.views.admin_user import (
    AdminUserDetailAPIView,
    AdminUserListAPIViewSet,
    AdminUserStatusAPIView,
)
from apps.access.views.authentication import (
    ChangePasswordAPIView,
    LoginAPIView,
    LogoutAPIView,
    RefreshTokenAPIView,
)
from apps.access.views.user import UserProfileAPIView

urlpatterns = [
    # Auth endpoints
    path("auth/login/", LoginAPIView.as_view(), name="auth-login"),
    path("auth/refresh/", RefreshTokenAPIView.as_view(), name="auth-refresh"),
    path("auth/logout/", LogoutAPIView.as_view(), name="auth-logout"),
    path("auth/me/", UserProfileAPIView.as_view(), name="auth-me"),
    path("auth/change-password/", ChangePasswordAPIView.as_view(), name="auth-change-password"),

    # Admin User Management endpoints
    path(
        "admin/users/",
        AdminUserListAPIViewSet.as_view({"get": "list", "post": "create"}),
        name="admin-user-list",
    ),
    path(
        "admin/users/<uuid:uuid>/",
        AdminUserDetailAPIView.as_view(),
        name="admin-user-detail",
    ),
    path(
        "admin/users/<uuid:uuid>/status/",
        AdminUserStatusAPIView.as_view(),
        name="admin-user-status",
    ),
]
