"""Serializers for ExportReport lifecycle and list presentation."""

import os
from rest_framework import serializers

from apps.reports.models.export_report import ExportReport


class ExportReportSerializer(serializers.ModelSerializer):
    """Serializer for displaying export reports and history."""

    created_by_email = serializers.ReadOnlyField(source="created_by.email")
    can_download = serializers.SerializerMethodField()

    class Meta:
        model = ExportReport
        fields = [
            "uuid",
            "export_type",
            "status",
            "filters",
            "file_name",
            "row_count",
            "error_message",
            "is_downloaded",
            "can_download",
            "started_at",
            "completed_at",
            "downloaded_at",
            "created",
            "created_by_email",
        ]
        read_only_fields = fields

    def get_can_download(self, obj: ExportReport) -> bool:
        if obj.status != "COMPLETED" or obj.is_downloaded:
            return False
        return bool(obj.file_path and os.path.exists(obj.file_path))


class CreateExportRequestSerializer(serializers.Serializer):
    """Validates the input parameters for initiating a new export."""

    export_type = serializers.ChoiceField(
        choices=[
            "transactions",
            "portfolio_positions",
            "goals",
            "customers",
            "accounts",
            "TRANSACTIONS",
            "PORTFOLIO_POSITIONS",
            "GOALS",
            "CUSTOMERS",
            "ACCOUNTS",
        ],
        default="transactions",
    )
    customer_codes = serializers.ListField(
        child=serializers.CharField(max_length=64),
        required=False,
        default=list,
    )
    account_codes = serializers.ListField(
        child=serializers.CharField(max_length=64),
        required=False,
        default=list,
    )
    date_from = serializers.DateField(required=False, allow_null=True)
    date_to = serializers.DateField(required=False, allow_null=True)
    transaction_type = serializers.ListField(
        child=serializers.CharField(max_length=64),
        required=False,
        default=list,
    )
    status = serializers.ListField(
        child=serializers.CharField(max_length=64),
        required=False,
        default=list,
    )
    account_type = serializers.ListField(
        child=serializers.CharField(max_length=64),
        required=False,
        default=list,
    )
    provider = serializers.CharField(required=False, allow_blank=True, max_length=100)
    kyc_status = serializers.ListField(
        child=serializers.CharField(max_length=64),
        required=False,
        default=list,
    )
    segment = serializers.ListField(
        child=serializers.CharField(max_length=64),
        required=False,
        default=list,
    )
    asset_class = serializers.ListField(
        child=serializers.CharField(max_length=64),
        required=False,
        default=list,
    )
    snapshot_date = serializers.DateField(required=False, allow_null=True)
    priority = serializers.ListField(
        child=serializers.CharField(max_length=64),
        required=False,
        default=list,
    )
    target_date_from = serializers.DateField(required=False, allow_null=True)
    target_date_to = serializers.DateField(required=False, allow_null=True)
    instrument = serializers.CharField(required=False, allow_blank=True, max_length=100)
