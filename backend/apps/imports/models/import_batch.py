"""Import batch and row-error models."""

from django.db.models import (
    BooleanField,
    CharField,
    DateTimeField,
    ForeignKey,
    IntegerField,
    JSONField,
    SET_NULL,
)
from apps.common.models import COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG, AbstractBaseCMModel
from apps.imports.config import ImportStatusChoices, ImportTypeChoices


class ImportBatch(AbstractBaseCMModel):
    """
    Tracks a single CSV import execution — either a dry run or a real import.

    ********************* Model Fields *********************
        PK          - id
        Unique      - uuid
        FK          - triggered_by (SET_NULL), created_by, modified_by
        Char        - import_type, file_name, file_sha256, status
        Boolean     - is_dry_run
        Int         - rows_total, rows_imported, rows_skipped_duplicate, rows_rejected
        JSON        - warnings
        Datetime    - started_at, finished_at, created, modified
    """

    class Meta(AbstractBaseCMModel.Meta):
        default_related_name = "related_import_batches"
    import_type = CharField(max_length=30, choices=ImportTypeChoices.choices)
    file_name = CharField(max_length=255)
    file_sha256 = CharField(max_length=64)
    status = CharField(max_length=30, choices=ImportStatusChoices.choices, default=ImportStatusChoices.processing)
    is_dry_run = BooleanField(default=False)
    rows_total = IntegerField(default=0)
    rows_processed = IntegerField(default=0)
    rows_imported = IntegerField(default=0)
    rows_skipped_duplicate = IntegerField(default=0)
    rows_rejected = IntegerField(default=0)
    warnings = JSONField(default=dict)
    started_at = DateTimeField(auto_now_add=True)
    finished_at = DateTimeField(**COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    triggered_by = ForeignKey(
        "access.User",
        on_delete=SET_NULL,
        related_name="import_batches",
        **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG,
    )

    def __str__(self):
        return f"{self.import_type} batch {self.uuid} ({self.status})"
