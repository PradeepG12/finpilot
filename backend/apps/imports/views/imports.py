"""Admin views for CSV imports and rejected row exports."""

import csv

from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser

from apps.common.permissions import IsAdminRole
from apps.common.views.base import AppAPIView
from apps.common.views.generic import AppModelListAPIViewSet, AppModelRetrieveAPIViewSet
from apps.imports.config import ImportTypeChoices
from apps.imports.models import ImportBatch, ImportRowError
from apps.imports.serializers.imports import ImportBatchSerializer, ImportRowErrorSerializer
from apps.imports.services.import_service import ImportService


class AdminImportUploadAPIView(AppAPIView):
    """Admin-only endpoint to upload and import CSV data for any supported entity."""

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

        raw_type = request.data.get("import_type") or request.query_params.get("import_type") or "transactions"
        type_str = str(raw_type).strip().upper()
        if type_str in ["HOLDING", "HOLDINGS", "HOLDING_SNAPSHOT", "HOLDINGS_SNAPSHOT"]:
            import_type = ImportTypeChoices.holdings
        elif type_str in ["TRANSACTION", "TRANSACTIONS"]:
            import_type = ImportTypeChoices.transactions
        elif type_str in ["CUSTOMER", "CUSTOMERS"]:
            import_type = ImportTypeChoices.customers
        elif type_str in ["ACCOUNT", "ACCOUNTS"]:
            import_type = ImportTypeChoices.accounts
        elif type_str in ["INSTRUMENT", "INSTRUMENTS"]:
            import_type = ImportTypeChoices.instruments
        elif type_str in ["RISK_PROFILE", "RISK_PROFILES"]:
            import_type = ImportTypeChoices.risk_profiles
        elif type_str in ["GOAL", "GOALS"]:
            import_type = ImportTypeChoices.goals
        else:
            import_type = ImportTypeChoices.transactions

        dry_run = str(request.data.get("dry_run", "false")).lower() in ["true", "1"]
        is_async = str(request.data.get("async", "true")).lower() in ["true", "1"]
        service = ImportService(user=request.user)

        result = service.import_file(
            import_type=import_type,
            file_obj=file_obj,
            file_name=file_obj.name,
            is_dry_run=dry_run,
            is_async=is_async,
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


AdminImportTransactionsAPIView = AdminImportUploadAPIView


class AdminImportHistoryAPIViewSet(AppModelListAPIViewSet, AppModelRetrieveAPIViewSet):
    """
    Admin-only listing and detail of historical import batches.
    Uses AppModelListAPIViewSet for automatic pagination and filtering.
    """

    permission_classes = [IsAdminRole]
    serializer_class = ImportBatchSerializer
    queryset = ImportBatch.objects.all().order_by("-started_at")
    filterset_fields = ["import_type", "status", "is_dry_run"]
    ordering_fields = ["started_at", "rows_total", "rows_imported", "rows_rejected"]
    lookup_field = "uuid"
    lookup_url_kwarg = "uuid"


class AdminImportRowResultsViewSet(AppModelListAPIViewSet):
    """
    Dedicated ADMIN-only ViewSet for import row results.
    Inherits AppModelListAPIViewSet for built-in pagination, ordering, and filtering.
    Registered via router for nested route: /admin/imports/{batch_uuid}/rows/
    """

    permission_classes = [IsAdminRole]
    serializer_class = ImportRowErrorSerializer
    ordering_fields = ["row_number", "outcome", "error_code"]

    def get_queryset(self):
        batch_uuid = self.kwargs.get("batch_uuid")
        try:
            batch = ImportBatch.objects.get(uuid=batch_uuid)
        except (ImportBatch.DoesNotExist, ValueError):
            raise NotFound(detail=f"Import batch '{batch_uuid}' not found.")

        qs = ImportRowError.objects.filter(batch=batch).order_by("row_number")

        outcome = self.request.query_params.get("outcome")
        if not outcome:
            outcome = "REJECTED"
        if outcome.upper() in {"REJECTED", "SKIPPED_DUPLICATE"}:
            qs = qs.filter(outcome=outcome.upper())

        code = self.request.query_params.get("code")
        if code:
            qs = qs.filter(error_code=code)

        field = self.request.query_params.get("field")
        if field:
            qs = qs.filter(field__icontains=field)

        return qs

    @action(detail=False, methods=["GET"], url_path="codes")
    def codes(self, request, *args, **kwargs):
        """Returns distinct error_code values for the batch, optionally filtered by outcome."""
        batch_uuid = self.kwargs.get("batch_uuid")
        try:
            batch = ImportBatch.objects.get(uuid=batch_uuid)
        except (ImportBatch.DoesNotExist, ValueError):
            raise NotFound(detail=f"Import batch '{batch_uuid}' not found.")

        qs = ImportRowError.objects.filter(batch=batch)

        outcome = request.query_params.get("outcome")
        if outcome and outcome.upper() in {"REJECTED", "SKIPPED_DUPLICATE"}:
            qs = qs.filter(outcome=outcome.upper())

        codes = list(
            qs.exclude(error_code="")
            .exclude(error_code__isnull=True)
            .values_list("error_code", flat=True)
            .distinct()
            .order_by("error_code")
        )
        return self.send_response(codes)

    def list(self, request, *args, **kwargs):
        # CSV Export handling
        if request.query_params.get("export") == "csv":
            queryset = self.filter_queryset(self.get_queryset())
            batch_uuid = self.kwargs.get("batch_uuid")
            outcome = request.query_params.get("outcome", "REJECTED")
            response = HttpResponse(content_type="text/csv")
            response["Content-Disposition"] = f'attachment; filename="batch_{batch_uuid}_{outcome.lower()}_rows.csv"'
            writer = csv.writer(response)
            writer.writerow(["row_number", "outcome", "error_code", "field", "message", "raw_row"])
            for err in queryset:
                writer.writerow([err.row_number, err.outcome, err.error_code, err.field, err.message, err.raw_row])
            return response

        return super().list(request, *args, **kwargs)
