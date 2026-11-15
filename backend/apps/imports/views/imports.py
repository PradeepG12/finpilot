"""Admin views for CSV imports and rejected row exports."""

import csv

from django.http import HttpResponse
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser

from apps.common.permissions import IsAdminRole
from apps.common.views.base import AppAPIView
from apps.common.views.generic import AppModelListAPIViewSet
from apps.imports.config import ImportTypeChoices
from apps.imports.models import ImportBatch, ImportRowError
from apps.imports.serializers.imports import ImportBatchSerializer, ImportRowErrorSerializer
from apps.imports.services.import_service import ImportService


class AdminImportTransactionsAPIView(AppAPIView):
    """Admin-only endpoint to upload and import transactions CSV."""

    permission_classes = [IsAdminRole]
    parser_classes = [MultiPartParser, FormParser]
    throttle_scope = "import"

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get("file")
        if not file_obj:
            raise ValidationError({"file": ["CSV file is required."]})

        if not file_obj.name.lower().endswith(".csv"):
            return self.send_error_response(
                {"file": ["Only .csv files are supported."]},
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            )

        dry_run = str(request.data.get("dry_run", "false")).lower() in ["true", "1"]
        is_async = str(request.data.get("async", "true")).lower() in ["true", "1"]
        service = ImportService(user=request.user)

        result = service.import_file(
            import_type=ImportTypeChoices.transactions,
            file_obj=file_obj,
            file_name=file_obj.name,
            is_dry_run=dry_run,
            is_async=is_async,
        )

        if result.get("conflict"):
            return self.send_error_response(
                {
                    "detail": result["message"],
                    "batch": str(result["batch"].uuid),
                },
                status_code=status.HTTP_409_CONFLICT,
            )

        batch = result["batch"]
        response_data = {
            "batch": str(batch.uuid),
            "import_type": batch.import_type,
            "dry_run": batch.is_dry_run,
            "status": batch.status,
            "counts": {
                "total": batch.rows_total,
                "processed": batch.rows_processed,
                "imported": batch.rows_imported,
                "skipped_duplicate": batch.rows_skipped_duplicate,
                "rejected": batch.rows_rejected,
            },
            "warnings": batch.warnings,
            "rejected_rows": result.get("rejected_rows", []),
        }

        return self.send_response(response_data, status_code=status.HTTP_201_CREATED)


class AdminImportHistoryAPIViewSet(AppModelListAPIViewSet):
    """Admin-only listing of historical import batches."""

    permission_classes = [IsAdminRole]
    serializer_class = ImportBatchSerializer
    queryset = ImportBatch.objects.all().order_by("-started_at")
    filterset_fields = ["import_type", "status", "is_dry_run"]
    ordering_fields = ["started_at", "rows_total", "rows_imported", "rows_rejected"]


class AdminImportDetailAPIView(AppAPIView):
    """Admin-only detail view for a specific import batch."""

    permission_classes = [IsAdminRole]

    def get(self, request, uuid, *args, **kwargs):
        try:
            batch = ImportBatch.objects.get(uuid=uuid)
        except ImportBatch.DoesNotExist:
            raise NotFound(detail=f"Import batch '{uuid}' not found.")

        serializer = ImportBatchSerializer(batch)
        data = dict(serializer.data)
        
        # Include top 500 rejected rows directly in detail response with raw_row
        rejected_qs = ImportRowError.objects.filter(batch=batch).order_by("row_number")[:500]
        data["rejected_rows"] = [
            {
                "row": err.row_number,
                "outcome": err.outcome,
                "code": err.error_code,
                "field": err.field,
                "message": err.message,
                "raw_row": err.raw_row,
            }
            for err in rejected_qs
        ]
        return self.send_response(data)


class AdminImportRejectedRowsAPIView(AppAPIView):
    """Admin-only list of rejected rows for a batch, supporting ?export=csv streaming."""

    permission_classes = [IsAdminRole]

    def get(self, request, uuid, *args, **kwargs):
        try:
            batch = ImportBatch.objects.get(uuid=uuid)
        except ImportBatch.DoesNotExist:
            raise NotFound(detail=f"Import batch '{uuid}' not found.")

        qs = ImportRowError.objects.filter(batch=batch).order_by("row_number")

        error_code = request.query_params.get("code")
        if error_code:
            qs = qs.filter(error_code=error_code)

        if request.query_params.get("export") == "csv":
            response = HttpResponse(content_type="text/csv")
            response["Content-Disposition"] = f'attachment; filename="batch_{uuid}_rejected_rows.csv"'
            writer = csv.writer(response)
            writer.writerow(["row_number", "outcome", "error_code", "field", "message", "raw_row"])
            for err in qs:
                writer.writerow([err.row_number, err.outcome, err.error_code, err.field, err.message, err.raw_row])
            return response

        serializer = ImportRowErrorSerializer(qs[:200], many=True)
        return self.send_response(serializer.data)
