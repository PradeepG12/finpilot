"""Serializers for Account model."""

from rest_framework import serializers

from apps.investments.models import Account


class AccountListSerializer(serializers.ModelSerializer):
    """Serializer for paginated account listing."""

    customer_code = serializers.CharField(source="customer.customer_code", read_only=True)
    customer_name = serializers.CharField(source="customer.full_name", read_only=True)
    current_market_value = serializers.DecimalField(
        max_digits=20,
        decimal_places=2,
        coerce_to_string=True,
        required=False,
        allow_null=True,
        read_only=True,
    )

    class Meta:
        model = Account
        fields = [
            "id",
            "uuid",
            "account_code",
            "customer_code",
            "customer_name",
            "account_type",
            "provider",
            "status",
            "opened_at",
            "current_market_value",
        ]
