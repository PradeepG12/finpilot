"""Model to track asynchronous export requests and their status."""

from django.db import models

from apps.common.models.base import AbstractBaseCMModel, COMMON_CHAR_FIELD_MAX_LENGTH, COMMON_CHOICE_FIELD_MAX_LENGTH
from apps.reports.config import ExportStatusChoices, ExportTypeChoices


class ExportReport(AbstractBaseCMModel):
    """
    Tracks asynchronous export jobs.
    Does NOT store the generated file in the database model.
    Files are stored temporarily on disk and deleted upon download or expiration.
    """

    export_type = models.CharField(
        max_length=COMMON_CHOICE_FIELD_MAX_LENGTH,
        choices=ExportTypeChoices.choices,
        default=ExportTypeChoices.transactions,
        help_text="The category of data exported (Transactions, Portfolio Positions, Goals).",
    )
    status = models.CharField(
        max_length=COMMON_CHOICE_FIELD_MAX_LENGTH,
        choices=ExportStatusChoices.choices,
        default=ExportStatusChoices.pending,
        db_index=True,
        help_text="Current processing lifecycle status.",
    )
    filters = models.JSONField(
        default=dict,
        blank=True,
        help_text="Serialized filters requested by the user.",
    )
    file_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Safe user-facing filename for the exported CSV.",
    )
    file_path = models.CharField(
        max_length=COMMON_CHAR_FIELD_MAX_LENGTH,
        blank=True,
        null=True,
        help_text="Temporary filesystem path on server. Set to null once downloaded and cleaned up.",
    )
    row_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of data rows exported.",
    )
    error_message = models.TextField(
        blank=True,
        null=True,
        help_text="Failure or error message if export generation failed.",
    )
    is_downloaded = models.BooleanField(
        default=False,
        help_text="Whether this export file has been downloaded by the user.",
    )
    started_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Timestamp when background task began generating the file.",
    )
    completed_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Timestamp when export generation was completed (or failed).",
    )
    downloaded_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Timestamp when the file was downloaded and removed from disk.",
    )

    class Meta(AbstractBaseCMModel.Meta):
        db_table = "export_report"
        verbose_name = "Export Report"
        verbose_name_plural = "Export Reports"
        ordering = ["-created"]

    def __str__(self):
        return f"ExportReport {self.uuid} ({self.export_type} - {self.status})"
