"""Admin serializers for user management."""

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.access.config import UserTypeChoices
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


class AdminUserCreateSerializer(AppSerializer):
    """Serializer for ADMIN creating a new user."""

    full_name = serializers.CharField(max_length=255, required=True, allow_blank=False)
    email = serializers.EmailField(required=True)
    user_type = serializers.ChoiceField(choices=UserTypeChoices.choices, default=UserTypeChoices.viewer)
    password = serializers.CharField(write_only=True, required=True)

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return normalized

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data["email"],
            full_name=validated_data["full_name"],
            password=validated_data["password"],
            user_type=validated_data.get("user_type", UserTypeChoices.viewer),
            is_active=True,
        )
        return user


class AdminUserStatusUpdateSerializer(AppSerializer):
    """Serializer for activating or deactivating a user."""

    is_active = serializers.BooleanField(required=True)


class AdminUserUpdateSerializer(AppSerializer):
    """Serializer for ADMIN updating user details (view/edit)."""

    full_name = serializers.CharField(max_length=255, required=False, allow_blank=False)
    email = serializers.EmailField(required=False, allow_blank=False)
    user_type = serializers.ChoiceField(choices=UserTypeChoices.choices, required=False)
    is_active = serializers.BooleanField(required=False)

    def validate_full_name(self, value):
        stripped = value.strip()
        if not stripped:
            raise serializers.ValidationError("Full name is required.")
        return stripped

    def validate_email(self, value):
        normalized = value.strip().lower()
        if not normalized:
            raise serializers.ValidationError("Email address cannot be empty.")
        user = getattr(self, "instance", None) or self.context.get("target_user")
        qs = User.objects.filter(email__iexact=normalized)
        if user:
            qs = qs.exclude(id=user.id)
        if qs.exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return normalized

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save(update_fields=list(validated_data.keys()) + ["modified"])
        return instance
