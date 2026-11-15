"""User profile serializers."""

from rest_framework import serializers

from apps.access.models import User
from apps.common.serializers import AppReadOnlyModelSerializer


class UserProfileSerializer(AppReadOnlyModelSerializer):
    """Read-only serializer for the current user profile."""

    created = serializers.DateTimeField(read_only=True)
    last_login = serializers.DateTimeField(read_only=True)

    class Meta(AppReadOnlyModelSerializer.Meta):
        model = User
        fields = [
            "id",
            "uuid",
            "email",
            "full_name",
            "user_type",
            "phone_number",
            "is_active",
            "last_login",
            "created",
        ]
