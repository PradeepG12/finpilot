"""Celery tasks for asynchronous report generation."""

import logging

from apps.common.tasks.base import BaseAppTask
from apps.reports.services.export_service import ExportService

logger = logging.getLogger(__name__)


class GenerateExportReportTask(BaseAppTask):
    """
    Asynchronous task to execute report queries and generate the CSV file on disk.
    Updates the ExportReport model status to COMPLETED or FAILED.
    """

    name = "apps.reports.tasks.GenerateExportReportTask"

    def run(self, export_uuid: str, *args, **kwargs):
        logger.info("Executing GenerateExportReportTask for report %s", export_uuid)
        report = ExportService.generate_export_file(export_uuid=export_uuid)
        return {
            "uuid": str(report.uuid),
            "status": report.status,
            "row_count": report.row_count,
            "file_name": report.file_name,
        }


generate_export_report_task = GenerateExportReportTask()
