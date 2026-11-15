"""URL patterns for imports app."""

from django.urls import path

from apps.common.router import AppSimpleRouter
from apps.imports.views import (
    AdminImportHistoryAPIViewSet,
    AdminImportRowResultsViewSet,
    AdminImportTransactionsAPIView,
    AdminImportUploadAPIView,
)

router = AppSimpleRouter()
router.register(
    r"admin/imports/(?P<batch_uuid>[^/.]+)/rows",
    AdminImportRowResultsViewSet,
    basename="admin-import-rows",
)
router.register(
    r"admin/imports",
    AdminImportHistoryAPIViewSet,
    basename="admin-import-history",
)

urlpatterns = [
    path("admin/imports/upload/", AdminImportUploadAPIView.as_view(), name="admin-import-upload"),
    path("admin/imports/transactions/", AdminImportUploadAPIView.as_view(), name="admin-import-transactions"),
] + router.urls
