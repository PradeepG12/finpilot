"""Holdings snapshot model — source of truth for portfolio value."""

from django.db.models import DateField, DecimalField, ForeignKey, Index, PROTECT, Q
from django.db.models.constraints import CheckConstraint, UniqueConstraint

from apps.common.models import AbstractBaseCMModel
from apps.common.models.base import MONEY_MAX_DIGITS, PRICE_DECIMAL_PLACES, QUANTITY_DECIMAL_PLACES


class HoldingSnapshot(AbstractBaseCMModel):
    """
    Point-in-time snapshot of a position in an account.
    Source of truth for portfolio valuation; never rebuilt from transactions.

    ********************* Model Fields *********************
        PK          - id
        Unique      - uuid, (account, instrument, snapshot_date)
        FK          - account (PROTECT), instrument (PROTECT), created_by, modified_by
        Decimal     - quantity, avg_cost
        Date        - snapshot_date
        Datetime    - created, modified
    """

    class Meta(AbstractBaseCMModel.Meta):
        default_related_name = "related_holding_snapshots"
        constraints = [
            UniqueConstraint(
                fields=["account", "instrument", "snapshot_date"],
                name="uq_holding_account_instrument_date",
            ),
            CheckConstraint(check=Q(quantity__gt=0), name="ck_holding_quantity_positive"),
            CheckConstraint(check=Q(avg_cost__gt=0), name="ck_holding_avg_cost_positive"),
        ]
        indexes = [
            Index(fields=["account", "snapshot_date"], name="holding_account_date_idx"),
            Index(fields=["instrument"], name="holding_instrument_idx"),
        ]

    account = ForeignKey(
        "investments.Account",
        on_delete=PROTECT,
        related_name="holding_snapshots",
    )
    instrument = ForeignKey(
        "investments.Instrument",
        on_delete=PROTECT,
        related_name="holding_snapshots",
    )
    quantity = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=QUANTITY_DECIMAL_PLACES)
    avg_cost = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=PRICE_DECIMAL_PLACES)
    snapshot_date = DateField()

    def __str__(self):
        return f"{self.account.account_code} / {self.instrument.instrument_code} @ {self.snapshot_date}"
