"""User profile views."""

from rest_framework import status
from rest_framework.exceptions import ValidationError

from apps.access.config import UserTypeChoices
from apps.access.models import User
from apps.access.serializers.admin_user import AdminUserUpdateSerializer
from apps.access.serializers.user import UserProfileSerializer
from apps.common.views import AppAPIView


class UserProfileAPIView(AppAPIView):
    """Returns or updates the profile of the currently authenticated user."""

    def get(self, request, *args, **kwargs):
        """Returns the authenticated user's profile data."""
        user = self.get_authenticated_user()
        return self.send_response(UserProfileSerializer(user).data)

    def patch(self, request, *args, **kwargs):
        """Updates the authenticated user's profile data if role edit permission is granted."""
        user = self.get_authenticated_user()
        if user.user_type != UserTypeChoices.admin:
            return self.send_error_response(
                data={"detail": "You do not have permission to edit user details."},
                status_code=status.HTTP_403_FORBIDDEN,
            )

        serializer = AdminUserUpdateSerializer(
            instance=user,
            data=request.data,
            partial=True,
            context={"target_user": user},
        )
        if not serializer.is_valid():
            raise ValidationError(serializer.errors)

        # Guardrail check: admin cannot deactivate self
        new_is_active = serializer.validated_data.get("is_active", user.is_active)
        if not new_is_active:
            return self.send_error_response(
                data={"detail": "You cannot deactivate your own admin account."},
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        new_user_type = serializer.validated_data.get("user_type", user.user_type)
        if new_user_type == UserTypeChoices.viewer and user.is_active:
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
        return self.send_response(UserProfileSerializer(updated_user).data)
