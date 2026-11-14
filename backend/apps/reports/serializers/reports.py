"""Serializers for reporting models."""

from rest_framework import serializers

from apps.reports.models.reports import DataQualityException


class DataQualityExceptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataQualityException
        fields = [
            "exception_code",
            "entity_type",
            "entity_id",
            "description",
            "detected_at",
        ]
