"""Root URL configuration. All app URLs are mounted under /api/v1/."""

from django.conf import settings
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path(settings.ADMIN_URL, admin.site.urls),
    path("api/v1/", include("apps.common.urls")),
    path("api/v1/", include("apps.access.urls")),
    path("api/v1/", include("apps.customers.urls")),
    path("api/v1/", include("apps.investments.urls")),
    path("api/v1/", include("apps.goals.urls")),
    path("api/v1/", include("apps.imports.urls")),
    path("api/v1/", include("apps.reports.urls")),
]
