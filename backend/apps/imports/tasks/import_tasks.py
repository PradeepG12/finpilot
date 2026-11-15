"""Celery tasks for asynchronous file ingestion."""

import logging

from apps.common.tasks.base import BaseAppTask
from apps.imports.config import ImportTypeChoices
from apps.imports.services.import_service import ImportService

logger = logging.getLogger(__name__)


class ProcessImportBatchTask(BaseAppTask):
    """
    Asynchronous task to process an uploaded CSV file for an ImportBatch.
    Updates row progress dynamically to allow frontend percentage polling.
    """

    name = "apps.imports.tasks.ProcessImportBatchTask"

    def run(self, batch_uuid: str, content_str: str, import_type: str = ImportTypeChoices.transactions, is_dry_run: bool = False, *args, **kwargs):
        logger.info("Starting ProcessImportBatchTask for batch %s", batch_uuid)
        service = ImportService()
        return service.process_batch_content(
            batch_uuid=batch_uuid,
            content_str=content_str,
            import_type=import_type,
            is_dry_run=is_dry_run,
        )


process_import_batch_task = ProcessImportBatchTask()
