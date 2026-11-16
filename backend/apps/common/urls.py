"""Common app URL patterns — health checks, schema, Swagger."""

from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.permissions import AllowAny

from apps.common.views import ServerStatusAPIView
from apps.common.views.health import HealthReadyAPIView

urlpatterns = [
    path("health/", ServerStatusAPIView.as_view(), name="health"),
    path("health/ready/", HealthReadyAPIView.as_view(), name="health-ready"),
    path(
        "schema/",
        SpectacularAPIView.as_view(permission_classes=[AllowAny]),
        name="schema",
    ),
    path(
        "docs/",
        SpectacularSwaggerView.as_view(url_name="schema", permission_classes=[AllowAny]),
        name="swagger-ui",
    ),
]
