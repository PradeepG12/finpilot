"""Serializers for import batches and row errors."""

from rest_framework import serializers

from apps.imports.models import ImportBatch, ImportRowError


class ImportRowErrorSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportRowError
        fields = [
            "id",
            "row_number",
            "outcome",
            "error_code",
            "field",
            "message",
            "raw_row",
        ]


class ImportBatchSerializer(serializers.ModelSerializer):
    counts = serializers.SerializerMethodField()

    class Meta:
        model = ImportBatch
        fields = [
            "id",
            "uuid",
            "import_type",
            "file_name",
            "status",
            "is_dry_run",
            "counts",
            "warnings",
            "started_at",
            "finished_at",
        ]

    def get_counts(self, obj):
        return {
            "total": obj.rows_total,
            "imported": obj.rows_imported,
            "skipped_duplicate": obj.rows_skipped_duplicate,
            "rejected": obj.rows_rejected,
        }
