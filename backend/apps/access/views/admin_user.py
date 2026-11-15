"""Admin views for user management (listing, creation, activate, deactivate)."""

from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError

from apps.access.config import UserTypeChoices
from apps.access.models import User
from apps.access.serializers.admin_user import (
    AdminUserCreateSerializer,
    AdminUserListSerializer,
    AdminUserStatusUpdateSerializer,
    AdminUserUpdateSerializer,
)
from apps.common.permissions import IsAdminRole
from apps.common.views.base import AppAPIView
from apps.common.views.generic import AppModelListAPIViewSet


class AdminUserListAPIViewSet(AppModelListAPIViewSet):
    """
    ADMIN-only endpoint to list users with server-side pagination,
    filtering by is_active and user_type, and search across full_name/email.
    Also supports POST to create a new user (ADMIN or VIEWER).
    """

    permission_classes = [IsAdminRole]
    serializer_class = AdminUserListSerializer
    queryset = User.objects.all().order_by("-created")
    filterset_fields = ["is_active", "user_type"]
    search_fields = ["full_name", "email"]
    ordering_fields = ["full_name", "email", "created", "last_login", "user_type"]

    def create(self, request, *args, **kwargs):
        serializer = AdminUserCreateSerializer(data=request.data, context=self.get_serializer_context())
        if not serializer.is_valid():
            raise ValidationError(serializer.errors)

        new_user = serializer.save()
        return self.send_response(
            AdminUserListSerializer(new_user).data,
            status_code=status.HTTP_201_CREATED,
        )


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


class AdminUserDetailAPIView(AppAPIView):
    """
    ADMIN-only endpoint to retrieve and update a specific user (view/edit).
    Enforces business guardrails:
    1. An admin cannot deactivate their own account.
    2. Cannot deactivate the final active ADMIN account.
    3. Cannot demote the final active ADMIN to VIEWER.
    """

    permission_classes = [IsAdminRole]

    def get_object(self, uuid):
        try:
            return User.objects.get(uuid=uuid)
        except User.DoesNotExist:
            raise NotFound(detail=f"User with id '{uuid}' not found.")

    def get(self, request, uuid, *args, **kwargs):
        target_user = self.get_object(uuid)
        return self.send_response(AdminUserListSerializer(target_user).data)

    def patch(self, request, uuid, *args, **kwargs):
        target_user = self.get_object(uuid)
        serializer = AdminUserUpdateSerializer(
            instance=target_user,
            data=request.data,
            partial=True,
            context={"target_user": target_user},
        )
        if not serializer.is_valid():
            raise ValidationError(serializer.errors)

        new_is_active = serializer.validated_data.get("is_active", target_user.is_active)
        new_user_type = serializer.validated_data.get("user_type", target_user.user_type)

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

        # Guardrail 3: Cannot change role of the final active admin to viewer
        if (
            target_user.user_type == UserTypeChoices.admin
            and new_user_type == UserTypeChoices.viewer
            and target_user.is_active
        ):
            active_admins_count = User.objects.filter(
                user_type=UserTypeChoices.admin,
                is_active=True,
            ).count()
            if active_admins_count <= 1:
                return self.send_error_response(
                    data={"detail": "Cannot change the role of the only remaining active admin account."},
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

        updated_user = serializer.save()
        return self.send_response(
            AdminUserListSerializer(updated_user).data,
            status_code=status.HTTP_200_OK,
        )
