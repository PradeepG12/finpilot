"""Admin views for user management (listing, activate, deactivate)."""

from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError

from apps.access.config import UserTypeChoices
from apps.access.models import User
from apps.access.serializers.admin_user import (
    AdminUserListSerializer,
    AdminUserStatusUpdateSerializer,
)
from apps.common.permissions import IsAdminRole
from apps.common.views.base import AppAPIView
from apps.common.views.generic import AppModelListAPIViewSet


class AdminUserListAPIViewSet(AppModelListAPIViewSet):
    """
    ADMIN-only endpoint to list users with server-side pagination,
    filtering by is_active and user_type, and search across full_name/email.
    """

    permission_classes = [IsAdminRole]
    serializer_class = AdminUserListSerializer
    queryset = User.objects.all().order_by("-created")
    filterset_fields = ["is_active", "user_type"]
    search_fields = ["full_name", "email"]
    ordering_fields = ["full_name", "email", "created", "last_login", "user_type"]


class AdminUserStatusAPIView(AppAPIView):
    """
    ADMIN-only endpoint to activate or deactivate a specific user.
    Enforces business guardrails:
    1. An admin cannot deactivate their own account.
    2. Cannot deactivate the final active ADMIN account.
    """

    permission_classes = [IsAdminRole]

    def patch(self, request, uuid, *args, **kwargs):
        try:
            target_user = User.objects.get(uuid=uuid)
        except User.DoesNotExist:
            raise NotFound(detail=f"User with id '{uuid}' not found.")

        serializer = AdminUserStatusUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            raise ValidationError(serializer.errors)

        new_is_active = serializer.validated_data["is_active"]

        # If deactivating, enforce guardrails
        if not new_is_active and target_user.is_active:
            # Guardrail 1: Admin cannot deactivate their own account
            if request.user.id == target_user.id:
                return self.send_error_response(
                    data={"detail": "You cannot deactivate your own admin account."},
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            # Guardrail 2: Cannot deactivate the final active admin
            if target_user.user_type == UserTypeChoices.admin:
                active_admins_count = User.objects.filter(
                    user_type=UserTypeChoices.admin,
                    is_active=True,
                ).count()
                if active_admins_count <= 1:
                    return self.send_error_response(
                        data={"detail": "Cannot deactivate the only remaining active admin account."},
                        status_code=status.HTTP_400_BAD_REQUEST,
                    )

        target_user.is_active = new_is_active
        target_user.save(update_fields=["is_active", "modified"])

        return self.send_response(
            AdminUserListSerializer(target_user).data,
            status_code=status.HTTP_200_OK,
        )
