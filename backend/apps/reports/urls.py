from django.urls import path

from apps.reports.views.data_quality import AdminDataQualityAPIViewSet

dq_list = AdminDataQualityAPIViewSet.as_view({"get": "list"})

urlpatterns = [
    path("admin/data-quality/", dq_list, name="admin-data-quality"),
]
