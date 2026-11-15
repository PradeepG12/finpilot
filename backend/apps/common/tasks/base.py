import logging
from concurrent.futures import ThreadPoolExecutor

from celery import Task
from django.conf import settings
from kombu.exceptions import OperationalError

logger = logging.getLogger(__name__)
_thread_pool = ThreadPoolExecutor(max_workers=4)


class BaseAppTask(Task):
    """
    Base celery task class for the entire application.
    Supports asynchronous execution via Celery when available,
    or falls back to an asynchronous background thread pool if Redis/Celery is unavailable.
    """

    name = None
    perform_run_task = True
    logger = logger

    def __init__(self, *args, **kwargs):
        if not self.name:
            self.name = f"{self.__module__}.{self.__class__.__name__}"
        super().__init__(*args, **kwargs)

    def run(self, *args, **kwargs):
        raise NotImplementedError

    def run_task(self, **kwargs):
        """
        The main entry point for running any app task.
        Attempts Celery first; if Redis broker is unreachable, executes in background thread.
        """
        if not self.perform_run_task:
            return

        if getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False):
            return self.run(**kwargs)

        try:
            self.delay(**kwargs)
        except (OperationalError, Exception) as exc:
            logger.info("Celery broker unreachable or disabled (%s), offloading to thread pool", exc)
            _thread_pool.submit(self.run, **kwargs)
