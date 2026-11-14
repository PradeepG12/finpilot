"""Health check views for FinPilot."""

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from rest_framework import status

from apps.common.views.base import AppAPIView, NonAuthenticatedAPIMixin


class HealthReadyAPIView(NonAuthenticatedAPIMixin, AppAPIView):
    """Readiness check: DB reachable + all migrations applied. Returns 503 when not ready."""

    def get(self, request, *args, **kwargs):
        """Returns 200 when DB is reachable and migrations are current, 503 otherwise."""

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            executor = MigrationExecutor(connection)
            plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
            if plan:
                return self.send_response(
                    {"status": "not_ready", "detail": "Pending migrations"},
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
        except Exception:
            return self.send_response(
                {"status": "not_ready", "detail": "DB unavailable"},
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return self.send_response({"status": "ok"})
