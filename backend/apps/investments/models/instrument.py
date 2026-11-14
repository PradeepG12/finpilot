"""Financial instrument model."""

from django.core.validators import RegexValidator
from django.db.models import CharField, DateField, DecimalField, Index, Q
from django.db.models.constraints import CheckConstraint, UniqueConstraint

from apps.common.models import COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG, AbstractBaseCMModel
from apps.common.models.base import MONEY_MAX_DIGITS, PRICE_DECIMAL_PLACES
from apps.investments.config import AssetClassChoices, ExchangeChoices, RiskBandChoices


class Instrument(AbstractBaseCMModel):
    """
    Financial instrument (stock, ETF, mutual fund, bond, REIT, G-Sec).

    ********************* Model Fields *********************
        PK          - id
        Unique      - uuid, instrument_code, symbol
        FK          - created_by, modified_by
        Char        - instrument_code, symbol, instrument_name, asset_class, sector, exchange, currency, risk_band
        Decimal     - last_price
        Date        - price_as_of
        Datetime    - created, modified
    """

    class Meta(AbstractBaseCMModel.Meta):
        default_related_name = "related_instruments"
        constraints = [
            UniqueConstraint(fields=["instrument_code"], name="uq_instrument_code"),
            UniqueConstraint(fields=["symbol"], name="uq_instrument_symbol"),
            CheckConstraint(
                check=Q(instrument_code__regex=r"^I[0-9]{4,}$"),
                name="ck_instrument_code_format",
            ),
            CheckConstraint(
                check=Q(last_price__gt=0),
                name="ck_instrument_price_positive",
            ),
            CheckConstraint(
                check=Q(currency="INR"),
                name="ck_instrument_currency_inr",
            ),
        ]
        indexes = [
            Index(fields=["asset_class"], name="instrument_asset_class_idx"),
        ]

    instrument_code = CharField(
        max_length=20,
        unique=True,
        validators=[RegexValidator(r"^I[0-9]{4,}$", "Instrument code must match I followed by 4+ digits.")],
    )
    symbol = CharField(max_length=50, unique=True)
    instrument_name = CharField(max_length=200)
    asset_class = CharField(max_length=20, choices=AssetClassChoices.choices)
    sector = CharField(max_length=100, **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    exchange = CharField(max_length=10, choices=ExchangeChoices.choices)
    currency = CharField(max_length=3, default="INR")
    last_price = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=PRICE_DECIMAL_PLACES)
    price_as_of = DateField(**COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    risk_band = CharField(max_length=20, choices=RiskBandChoices.choices)

    def __str__(self):
        return f"{self.instrument_code} - {self.symbol}"
