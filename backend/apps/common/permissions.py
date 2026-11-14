"""Shared DRF permission classes for FinPilot."""

from rest_framework.permissions import BasePermission

from apps.access.config import UserTypeChoices


class IsViewerOrAdmin(BasePermission):
    """Grants access to any active authenticated user (VIEWER or ADMIN)."""

    def has_permission(self, request, view):
        """Returns True for any authenticated, active user."""

        return bool(request.user and request.user.is_authenticated and request.user.is_active)


class IsAdminRole(BasePermission):
    """Grants access only to users with the ADMIN role."""

    def has_permission(self, request, view):
        """Returns True only for ADMIN-type users."""

        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_active
            and request.user.user_type == UserTypeChoices.admin
        )
