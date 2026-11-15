# pylint: disable=no-member
import os

from celery import Celery
from django.utils.module_loading import import_string

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("finpilot")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


# Register class based tasks are not auto registered by default.
# Ref: https://github.com/celery/celery/issues/5992#issuecomment-781857785
@app.on_after_finalize.connect
def register_custom_tasks(sender, **kwargs):
    """Registers class based tasks. Add the dotted path of each AppTask subclass here."""

    for _import_string in [
        "apps.imports.tasks.ProcessImportBatchTask",
        "apps.reports.tasks.GenerateExportReportTask",
    ]:
        sender.register_task(import_string(_import_string)())
