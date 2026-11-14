"""Admin view for inspecting data-quality exceptions."""

from apps.common.permissions import IsAdminRole
from apps.common.views.generic import AppModelListAPIViewSet
from apps.reports.models.reports import DataQualityException
from apps.reports.serializers.reports import DataQualityExceptionSerializer


class AdminDataQualityAPIViewSet(AppModelListAPIViewSet):
    """Admin-only listing of data quality exceptions from vw_data_quality_exceptions."""

    permission_classes = [IsAdminRole]
    serializer_class = DataQualityExceptionSerializer
    queryset = DataQualityException.objects.all().order_by("-detected_at")
    filterset_fields = ["exception_code", "entity_type"]
    ordering_fields = ["detected_at", "exception_code", "entity_type"]
