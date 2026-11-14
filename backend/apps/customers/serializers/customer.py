"""Serializers for customer resources."""

from rest_framework import serializers

from apps.customers.models import Customer, RiskProfile


class RiskProfileSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = RiskProfile
        fields = ["id", "risk_score", "risk_level", "assessed_at", "horizon_years", "liquidity_need"]


class CustomerListSerializer(serializers.ModelSerializer):
    risk_level = serializers.CharField(read_only=True)

    class Meta:
        model = Customer
        fields = [
            "id",
            "uuid",
            "customer_code",
            "full_name",
            "email",
            "phone",
            "city",
            "state",
            "date_of_birth",
            "onboarded_at",
            "kyc_status",
            "segment",
            "risk_level",
        ]


class CustomerDetailSerializer(serializers.ModelSerializer):
    risk_profile = serializers.SerializerMethodField()
    accounts_count = serializers.IntegerField(read_only=True)
    goals_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Customer
        fields = [
            "id",
            "uuid",
            "customer_code",
            "full_name",
            "email",
            "phone",
            "city",
            "state",
            "date_of_birth",
            "onboarded_at",
            "kyc_status",
            "segment",
            "risk_profile",
            "accounts_count",
            "goals_count",
        ]

    def get_risk_profile(self, obj):
        latest = obj.risk_profiles.order_by("-assessed_at").first()
        if latest:
            return RiskProfileSummarySerializer(latest).data
        return None
