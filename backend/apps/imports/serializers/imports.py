"""Serializers for import batches and row errors."""

from rest_framework import serializers

from apps.common.serializers import AppReadOnlyModelSerializer
from apps.imports.models import ImportBatch, ImportRowError


class ImportRowErrorSerializer(AppReadOnlyModelSerializer):
    """Serializer for import row error results."""

    class Meta(AppReadOnlyModelSerializer.Meta):
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


class ImportBatchSerializer(AppReadOnlyModelSerializer):
    """Serializer for import batch metadata."""

    counts = serializers.SerializerMethodField()

    class Meta(AppReadOnlyModelSerializer.Meta):
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
            "processed": obj.rows_processed,
            "imported": obj.rows_imported,
            "skipped_duplicate": obj.rows_skipped_duplicate,
            "rejected": obj.rows_rejected,
        }
