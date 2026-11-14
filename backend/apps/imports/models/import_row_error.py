"""Import row error model — records rejected/skipped rows per batch."""

from django.db.models import CharField, ForeignKey, Index, IntegerField, JSONField, PROTECT

from apps.common.models import COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG, AbstractBaseCMModel
from apps.imports.config import ImportOutcomeChoices


class ImportRowError(AbstractBaseCMModel):
    """
    Records a single rejected or skipped-duplicate row within an import batch.

    ********************* Model Fields *********************
        PK          - id
        Unique      - uuid
        FK          - batch (PROTECT), created_by, modified_by
        Int         - row_number
        Char        - outcome, error_code, field, message
        JSON        - raw_row
        Datetime    - created, modified
    """

    class Meta(AbstractBaseCMModel.Meta):
        default_related_name = "related_import_row_errors"
        indexes = [
            Index(fields=["batch", "row_number"], name="imp_row_err_batch_row_idx"),
            Index(fields=["batch", "error_code"], name="imp_row_err_batch_code_idx"),
        ]

    batch = ForeignKey(
        "imports.ImportBatch",
        on_delete=PROTECT,
        related_name="row_errors",
    )
    row_number = IntegerField()
    outcome = CharField(max_length=30, choices=ImportOutcomeChoices.choices)
    error_code = CharField(max_length=50)
    field = CharField(max_length=100, **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    message = CharField(max_length=500)
    raw_row = JSONField(default=dict)

    def __str__(self):
        return f"Row {self.row_number} - {self.outcome}: {self.error_code}"
