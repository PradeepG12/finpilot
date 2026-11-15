# pylint: disable=no-member
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("finpilot")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
