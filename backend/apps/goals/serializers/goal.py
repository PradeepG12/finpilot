"""Serializers for goals."""

from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.goals.models import Goal


class GoalSerializer(serializers.ModelSerializer):
    funded_percent = serializers.SerializerMethodField()
    flags = serializers.SerializerMethodField()
    days_to_target = serializers.SerializerMethodField()

    class Meta:
        model = Goal
        fields = [
            "id",
            "uuid",
            "goal_code",
            "goal_type",
            "goal_name",
            "target_amount",
            "current_funded_amount",
            "target_date",
            "priority",
            "funded_percent",
            "flags",
            "days_to_target",
            "created",
            "modified",
        ]
        read_only_fields = ["id", "uuid", "goal_code", "created", "modified"]

    def get_funded_percent(self, obj):
        if obj.target_amount > 0:
            return str(((obj.current_funded_amount / obj.target_amount) * 100).quantize(Decimal("0.01")))
        return "0.00"

    def get_flags(self, obj):
        flags = []
        today = timezone.localdate()
        if obj.current_funded_amount >= obj.target_amount:
            flags.append("FUNDED")
        if obj.current_funded_amount > obj.target_amount:
            flags.append("INCONSISTENT")
        if obj.target_date < today and obj.current_funded_amount < obj.target_amount:
            flags.append("OVERDUE")
        return flags

    def get_days_to_target(self, obj):
        today = timezone.localdate()
        return (obj.target_date - today).days


class GoalCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goal
        fields = [
            "goal_type",
            "goal_name",
            "target_amount",
            "current_funded_amount",
            "target_date",
            "priority",
        ]

    def validate_target_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Target amount must be greater than zero.")
        return value

    def validate_current_funded_amount(self, value):
        if value < 0:
            raise serializers.ValidationError("Funded amount must be non-negative.")
        return value

    def validate(self, attrs):
        target = attrs.get("target_amount")
        funded = attrs.get("current_funded_amount", Decimal("0.00"))
        if target is not None and funded > target:
            raise serializers.ValidationError(
                {"current_funded_amount": ["Funded amount cannot exceed the target amount."]}
            )

        target_date = attrs.get("target_date")
        if target_date and target_date <= timezone.localdate():
            raise serializers.ValidationError({"target_date": ["Target date must be in the future."]})

        return attrs


class GoalUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goal
        fields = [
            "goal_name",
            "goal_type",
            "target_amount",
            "current_funded_amount",
            "target_date",
            "priority",
        ]

    def validate(self, attrs):
        instance = self.instance
        target = attrs.get("target_amount", instance.target_amount if instance else None)
        funded = attrs.get("current_funded_amount", instance.current_funded_amount if instance else None)

        if target is not None and target <= 0:
            raise serializers.ValidationError({"target_amount": ["Target amount must be > 0."]})
        if funded is not None and funded < 0:
            raise serializers.ValidationError({"current_funded_amount": ["Funded amount cannot be negative."]})
        if target is not None and funded is not None and funded > target:
            raise serializers.ValidationError(
                {"current_funded_amount": ["Funded amount cannot exceed the target amount."]}
            )

        target_date = attrs.get("target_date")
        if target_date and instance and target_date != instance.target_date and target_date <= timezone.localdate():
            raise serializers.ValidationError({"target_date": ["Target date must be in the future."]})

        return attrs
