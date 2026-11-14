"""Unmanaged Django models mapping to SQL views for FinPilot reporting."""

from django.db.models import CharField, DateField, DecimalField, IntegerField, Model

from apps.common.models.base import MONEY_DECIMAL_PLACES, MONEY_MAX_DIGITS, PRICE_DECIMAL_PLACES, QUANTITY_DECIMAL_PLACES


class PositionValuation(Model):
    class Meta:
        managed = False
        db_table = "vw_position_valuation"

    account_id = IntegerField(primary_key=True)
    account_code = CharField(max_length=20)
    customer_id = IntegerField()
    instrument_id = IntegerField()
    instrument_code = CharField(max_length=20)
    symbol = CharField(max_length=50)
    instrument_name = CharField(max_length=200)
    asset_class = CharField(max_length=20)
    quantity = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=QUANTITY_DECIMAL_PLACES)
    avg_cost = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=PRICE_DECIMAL_PLACES)
    last_price = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=PRICE_DECIMAL_PLACES)
    market_value = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    cost_value = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    unrealised_pl = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    unrealised_pl_pct = DecimalField(max_digits=10, decimal_places=4)
    snapshot_date = DateField()
    price_as_of = DateField()


class AccountTotal(Model):
    class Meta:
        managed = False
        db_table = "vw_account_totals"

    account_id = IntegerField(primary_key=True)
    account_code = CharField(max_length=20)
    customer_id = IntegerField()
    market_value = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    cost_value = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    unrealised_pl = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    unrealised_pl_pct = DecimalField(max_digits=10, decimal_places=4)
    positions_count = IntegerField()
    snapshot_date = DateField()


class CustomerAUM(Model):
    class Meta:
        managed = False
        db_table = "vw_customer_aum"

    customer_id = IntegerField(primary_key=True)
    market_value = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    cost_value = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    unrealised_pl = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    positions_count = IntegerField()


class CustomerAssetAllocation(Model):
    class Meta:
        managed = False
        db_table = "vw_customer_asset_allocation"

    customer_id = IntegerField(primary_key=True)
    asset_class = CharField(max_length=20)
    market_value = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    weight_pct = DecimalField(max_digits=8, decimal_places=4)


class DataQualityException(Model):
    class Meta:
        managed = False
        db_table = "vw_data_quality_exceptions"

    exception_code = CharField(max_length=50, primary_key=True)
    entity_type = CharField(max_length=50)
    entity_id = CharField(max_length=50)
    description = CharField(max_length=500)
    detected_at = DateField()
