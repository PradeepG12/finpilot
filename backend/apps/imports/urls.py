from django.urls import path

from apps.imports.views import (
    AdminImportDetailAPIView,
    AdminImportHistoryAPIViewSet,
    AdminImportRejectedRowsAPIView,
    AdminImportTransactionsAPIView,
)

batch_list = AdminImportHistoryAPIViewSet.as_view({"get": "list"})

urlpatterns = [
    path("admin/imports/transactions/", AdminImportTransactionsAPIView.as_view(), name="admin-import-transactions"),
    path("admin/imports/", batch_list, name="admin-import-history"),
    path("admin/imports/<uuid:uuid>/", AdminImportDetailAPIView.as_view(), name="admin-import-detail"),
    path("admin/imports/<uuid:uuid>/rejected-rows/", AdminImportRejectedRowsAPIView.as_view(), name="admin-import-rejected-rows"),
]
