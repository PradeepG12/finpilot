"""Admin serializers for user management."""

from rest_framework import serializers

from apps.access.models import User
from apps.common.serializers import AppReadOnlyModelSerializer, AppSerializer


class AdminUserListSerializer(AppReadOnlyModelSerializer):
    """Serializer for Admin User Management table listing."""

    created = serializers.DateTimeField(read_only=True)
    last_login = serializers.DateTimeField(read_only=True)

    class Meta(AppReadOnlyModelSerializer.Meta):
        model = User
        fields = [
            "id",
            "uuid",
            "full_name",
            "email",
            "user_type",
            "is_active",
            "last_login",
            "created",
        ]


class AdminUserStatusUpdateSerializer(AppSerializer):
    """Serializer for activating or deactivating a user."""

    is_active = serializers.BooleanField(required=True)
