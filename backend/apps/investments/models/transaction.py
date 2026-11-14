"""Transaction model — full ledger of investment activity."""

from django.core.validators import RegexValidator
from django.db.models import CharField, DateField, DecimalField, ForeignKey, Index, PROTECT, Q
from django.db.models.constraints import CheckConstraint, UniqueConstraint

from apps.common.models import AbstractBaseCMModel
from apps.common.models.base import MONEY_DECIMAL_PLACES, MONEY_MAX_DIGITS, PRICE_DECIMAL_PLACES, QUANTITY_DECIMAL_PLACES
from apps.investments.config import TransactionStatusChoices, TransactionTypeChoices


class Transaction(AbstractBaseCMModel):
    """
    Financial transaction in an investment account.

    ********************* Model Fields *********************
        PK          - id
        Unique      - uuid, transaction_code
        FK          - account (PROTECT), instrument (PROTECT), created_by, modified_by
        Char        - transaction_code, transaction_type, status
        Decimal     - quantity, price, amount
        Date        - trade_date
        Datetime    - created, modified
    """

    class Meta(AbstractBaseCMModel.Meta):
        default_related_name = "related_transactions"
        constraints = [
            UniqueConstraint(fields=["transaction_code"], name="uq_transaction_code"),
            CheckConstraint(
                check=Q(transaction_code__regex=r"^T[0-9]{7,}$"),
                name="ck_transaction_code_format",
            ),
            CheckConstraint(
                check=Q(amount__gte=0),
                name="ck_txn_amount_non_negative",
            ),
            CheckConstraint(
                check=Q(quantity__gte=0),
                name="ck_txn_quantity_non_negative",
            ),
            CheckConstraint(
                check=Q(price__gte=0),
                name="ck_txn_price_non_negative",
            ),
            CheckConstraint(
                check=(
                    Q(transaction_type__in=["BUY", "SELL"]) & Q(quantity__gt=0) & Q(price__gt=0)
                    | Q(transaction_type__in=["DIVIDEND", "FEE"]) & Q(quantity=0) & Q(price=0)
                ),
                name="ck_txn_shape",
            ),
        ]
        indexes = [
            Index(fields=["account", "-trade_date", "-id"], name="txn_acc_date_idx"),
            Index(fields=["instrument", "trade_date"], name="txn_inst_date_idx"),
            Index(fields=["trade_date"], name="txn_trade_date_idx"),
            Index(fields=["transaction_type", "status", "trade_date"], name="txn_type_stat_date_idx"),
        ]

    transaction_code = CharField(
        max_length=20,
        unique=True,
        validators=[RegexValidator(r"^T[0-9]{7,}$", "Transaction code must match T followed by 7+ digits.")],
    )
    account = ForeignKey(
        "investments.Account",
        on_delete=PROTECT,
        related_name="transactions",
    )
    instrument = ForeignKey(
        "investments.Instrument",
        on_delete=PROTECT,
        related_name="transactions",
    )
    transaction_type = CharField(max_length=20, choices=TransactionTypeChoices.choices)
    trade_date = DateField()
    quantity = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=QUANTITY_DECIMAL_PLACES)
    price = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=PRICE_DECIMAL_PLACES)
    amount = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    status = CharField(max_length=20, choices=TransactionStatusChoices.choices, default=TransactionStatusChoices.settled)

    def __str__(self):
        return f"{self.transaction_code} ({self.transaction_type})"
