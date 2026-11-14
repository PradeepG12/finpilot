"""Staging table for transaction import — temporary raw rows before validation."""

from django.db.models import CharField, DateField, DecimalField, ForeignKey, Index, IntegerField, PROTECT

from apps.common.models import COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG, AbstractBaseCMModel
from apps.common.models.base import MONEY_DECIMAL_PLACES, MONEY_MAX_DIGITS, PRICE_DECIMAL_PLACES, QUANTITY_DECIMAL_PLACES


class StagingTransaction(AbstractBaseCMModel):
    """
    Temporary staging row for a CSV transaction import.
    All CSV columns stored as text; typed columns are null until parsed.
    Deleted after batch completes (failed batches retained 7 days).

    ********************* Model Fields *********************
        PK          - id
        Unique      - uuid
        FK          - batch (PROTECT), created_by, modified_by
        Int         - row_number
        Char        - raw_transaction_id, raw_account_id, raw_instrument_id, raw_type,
                      raw_trade_date, raw_quantity, raw_price, raw_amount, raw_status,
                      row_status, error_code
        Datetime    - created, modified
    """

    class Meta(AbstractBaseCMModel.Meta):
        default_related_name = "related_staging_transactions"
        indexes = [
            Index(fields=["batch", "row_number"], name="stg_txn_batch_row_idx"),
            Index(fields=["batch", "row_status"], name="stg_txn_batch_status_idx"),
        ]

    # FK
    batch = ForeignKey(
        "imports.ImportBatch",
        on_delete=PROTECT,
        related_name="staging_transactions",
    )
    row_number = IntegerField()

    # Raw text columns from CSV
    raw_transaction_id = CharField(max_length=50, **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    raw_account_id = CharField(max_length=50, **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    raw_instrument_id = CharField(max_length=50, **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    raw_type = CharField(max_length=50, **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    raw_trade_date = CharField(max_length=50, **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    raw_quantity = CharField(max_length=50, **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    raw_price = CharField(max_length=50, **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    raw_amount = CharField(max_length=50, **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    raw_status = CharField(max_length=50, **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)

    # Parsed/typed columns (null until validated)
    parsed_trade_date = DateField(**COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    parsed_quantity = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=QUANTITY_DECIMAL_PLACES, **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    parsed_price = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=PRICE_DECIMAL_PLACES, **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    parsed_amount = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)

    # Validation state
    row_status = CharField(max_length=30, default="PENDING")
    error_code = CharField(max_length=50, **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)

    def __str__(self):
        return f"Staging row {self.row_number} [{self.row_status}]"
