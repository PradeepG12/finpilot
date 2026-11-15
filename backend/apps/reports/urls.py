from django.urls import path

from apps.reports.views import (
    AdminDataQualityAPIViewSet,
    ExportReportDownloadAPIView,
    ExportReportListCreateAPIView,
    ExportReportStatusAPIView,
)

dq_list = AdminDataQualityAPIViewSet.as_view({"get": "list"})

urlpatterns = [
    path("exports/", ExportReportListCreateAPIView.as_view(), name="export-reports"),
    path("exports/<uuid:uuid>/status/", ExportReportStatusAPIView.as_view(), name="export-report-status"),
    path("exports/<uuid:uuid>/download/", ExportReportDownloadAPIView.as_view(), name="export-report-download"),
    path("admin/data-quality/", dq_list, name="admin-data-quality"),
]
