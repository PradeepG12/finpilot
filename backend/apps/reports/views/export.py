"""Views for Export Report management, asynchronous task creation, polling, and download."""

import os
from django.http import Http404, HttpResponse
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.common.pagination import AppPagination
from apps.common.views.base import AppAPIView
from apps.reports.config import ExportStatusChoices
from apps.reports.models.export_report import ExportReport
from apps.reports.serializers.export_report import (
    CreateExportRequestSerializer,
    ExportReportSerializer,
)
from apps.reports.services.export_service import ExportService
from apps.reports.tasks.export_tasks import generate_export_report_task


class ExportReportListCreateAPIView(AppAPIView):
    """
    List existing export reports or initiate a new background export task.

    POST:
      - Validates filters and export type
      - Stores new ExportReport model with status=PENDING (no file stored in DB)
      - Tasks Celery / background worker to generate CSV on disk
      - Returns 202 Accepted with report UUID and status message

    GET:
      - Returns paginated list of export reports ordered by newest first
      - If 'direct=true' or export_type is passed with 'direct', streams CSV directly
    """

    permission_classes = [permissions.IsAuthenticated]
    pagination_class = AppPagination

    def get(self, request, *args, **kwargs):
        # Support direct sync export if explicitly requested via ?direct=true
        if request.query_params.get("direct") == "true":
            return self._handle_direct_sync_export(request)

        queryset = ExportReport.objects.select_related("created_by").order_by("-created")

        # Optional filters on report list
        status_filter = request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())

        type_filter = request.query_params.get("export_type")
        if type_filter:
            norm_type = ExportService.normalize_export_type(type_filter)
            queryset = queryset.filter(export_type=norm_type)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = ExportReportSerializer(page, many=True)
        return self.send_response({
            "count": paginator.page.paginator.count,
            "next": paginator.get_next_link(),
            "previous": paginator.get_previous_link(),
            "results": serializer.data,
        })

    def post(self, request, *args, **kwargs):
        # If direct sync export requested in body/query
        if request.query_params.get("direct") == "true" or request.data.get("direct") is True:
            return self._handle_direct_sync_export(request)

        serializer = CreateExportRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data

        export_type = ExportService.normalize_export_type(validated_data.get("export_type"))

        # Convert date objects to ISO strings in filters dict for clean JSON serialization
        filters = {}
        for key, value in validated_data.items():
            if key == "export_type":
                continue
            if value is not None and value != "" and value != []:
                if hasattr(value, "isoformat"):
                    filters[key] = value.isoformat()
                else:
                    filters[key] = value

        # Create ExportReport record in DB (status=PENDING, NO file in model)
        report = ExportReport.objects.create(
            export_type=export_type,
            status=ExportStatusChoices.pending,
            filters=filters,
            created_by=request.user if request.user.is_authenticated else None,
        )

        # Trigger Celery / background worker task
        generate_export_report_task.run_task(export_uuid=str(report.uuid))

        return Response(
            {
                "status": "success",
                "message": "Export task created and queued for processing.",
                "data": {
                    "uuid": str(report.uuid),
                    "export_type": report.export_type,
                    "status": report.status,
                    "created": report.created,
                },
            },
            status=status.HTTP_202_ACCEPTED,
        )

    def _handle_direct_sync_export(self, request):
        """Directly streams CSV without saving file on disk, for immediate download."""
        params = request.query_params
        export_type = params.get("export_type") or request.data.get("export_type") or "transactions"
        export_type = ExportService.normalize_export_type(export_type)

        # Build filters from request
        filters = {}
        for k in ["customer_codes", "account_codes", "customers", "accounts", "date_from", "date_to", "transaction_type", "type", "status", "asset_class", "snapshot_date", "priority", "target_date_from", "target_date_to", "instrument"]:
            val = request.query_params.getlist(k) if hasattr(request.query_params, "getlist") and len(request.query_params.getlist(k)) > 1 else request.query_params.get(k)
            if not val and isinstance(request.data, dict):
                val = request.data.get(k)
            if val:
                filters[k] = val

        headers, rows, _ = ExportService.build_export_data(export_type, filters)
        today_str = timezone.localdate().isoformat()
        filename = f"finpilot_{export_type.lower()}_{today_str}.csv"

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'

        import csv
        writer = csv.writer(response)
        writer.writerow(headers)
        for row in rows:
            writer.writerow(row)
        return response


class ExportReportStatusAPIView(AppAPIView):
    """
    Endpoint for frontend status polling: GET /api/v1/exports/<uuid>/status/
    Returns current progress, row count, and availability for download.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, uuid, *args, **kwargs):
        try:
            report = ExportReport.objects.get(uuid=uuid)
        except (ExportReport.DoesNotExist, ValueError):
            raise Http404("Export report not found.")

        can_download = (
            report.status == ExportStatusChoices.completed
            and not report.is_downloaded
            and bool(report.file_path and os.path.exists(report.file_path))
        )

        return Response(
            {
                "status": "success",
                "data": {
                    "uuid": str(report.uuid),
                    "export_type": report.export_type,
                    "status": report.status,
                    "row_count": report.row_count,
                    "file_name": report.file_name,
                    "is_downloaded": report.is_downloaded,
                    "can_download": can_download,
                    "error_message": report.error_message,
                    "created": report.created,
                    "completed_at": report.completed_at,
                },
            }
        )


class ExportReportDownloadAPIView(AppAPIView):
    """
    Downloads the completed CSV file and removes it from disk upon delivery.
    GET /api/v1/exports/<uuid>/download/
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, uuid, *args, **kwargs):
        try:
            report = ExportReport.objects.get(uuid=uuid)
        except (ExportReport.DoesNotExist, ValueError):
            raise Http404("Export report not found.")

        if report.status != ExportStatusChoices.completed:
            return Response(
                {"error": f"Export is not completed yet (current status: {report.status})."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if report.is_downloaded or not report.file_path or not os.path.exists(report.file_path):
            return Response(
                {"error": "Export file has already been downloaded and removed from server or is no longer available."},
                status=status.HTTP_410_GONE,
            )

        # Read file bytes from disk
        try:
            with open(report.file_path, "rb") as f:
                file_content = f.read()
        except OSError as e:
            return Response(
                {"error": f"Unable to read file: {e}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Delete file from disk immediately per requirement
        try:
            if os.path.exists(report.file_path):
                os.remove(report.file_path)
        except OSError:
            pass

        # Update model record
        report.is_downloaded = True
        report.downloaded_at = timezone.now()
        report.file_path = None
        report.save(update_fields=["is_downloaded", "downloaded_at", "file_path", "modified"])

        filename = report.file_name or f"finpilot_export_{report.uuid}.csv"
        response = HttpResponse(file_content, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
