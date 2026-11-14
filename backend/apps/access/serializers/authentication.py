"""Authentication serializers for FinPilot JWT auth."""

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.access.models import User
from apps.common.serializers import AppSerializer


class FinPilotTokenObtainPairSerializer(AppSerializer):
    """Validates email + password; returns user object — tokens are built in the view."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        """Returns {'user': <User>} or raises generic 400 to prevent user enumeration."""

        user = authenticate(
            request=self.get_request(),
            email=attrs["email"],
            password=attrs["password"],
        )
        if not user or not user.is_active:
            raise serializers.ValidationError({"detail": "Invalid email or password."})
        attrs["user"] = user
        return attrs


class LoggedInUserSerializer(serializers.ModelSerializer):
    """Read-only serializer for the currently authenticated user."""

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "user_type"]


class ChangePasswordSerializer(AppSerializer):
    """Validates current and new passwords for the change-password endpoint."""

    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        """Checks current password is correct and new password meets Django validators."""

        request = self.get_request()
        user = request.user
        if not user.check_password(attrs["current_password"]):
            raise serializers.ValidationError({"current_password": ["Incorrect password."]})
        validate_password(attrs["new_password"], user=user)
        return attrs
