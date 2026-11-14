"""Initial migration for investments app."""

import uuid

import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("customers", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Instrument",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("uuid", models.UUIDField(default=uuid.uuid4, unique=True)),
                ("created", models.DateTimeField(auto_now_add=True)),
                ("modified", models.DateTimeField(auto_now=True)),
                ("instrument_code", models.CharField(max_length=20, unique=True, validators=[django.core.validators.RegexValidator("^I[0-9]{4,}$", "Instrument code must match I followed by 4+ digits.")])),
                ("symbol", models.CharField(max_length=50, unique=True)),
                ("instrument_name", models.CharField(max_length=200)),
                ("asset_class", models.CharField(choices=[("EQUITY", "Equity"), ("ETF", "ETF"), ("MUTUAL_FUND", "Mutual Fund"), ("BOND", "Bond"), ("REIT", "REIT"), ("GSEC", "G-Sec")], max_length=20)),
                ("sector", models.CharField(blank=True, default=None, max_length=100, null=True)),
                ("exchange", models.CharField(choices=[("NSE", "NSE"), ("BSE", "BSE"), ("OTC", "OTC")], max_length=10)),
                ("currency", models.CharField(default="INR", max_length=3)),
                ("last_price", models.DecimalField(decimal_places=4, max_digits=18)),
                ("price_as_of", models.DateField(blank=True, default=None, null=True)),
                ("risk_band", models.CharField(choices=[("LOW", "Low"), ("MEDIUM", "Medium"), ("HIGH", "High")], max_length=20)),
                ("created_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="created_%(class)s", to=settings.AUTH_USER_MODEL)),
                ("modified_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="modified_by_%(class)s", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created"],
                "abstract": False,
                "default_related_name": "related_instruments",
            },
        ),
        migrations.CreateModel(
            name="Account",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("uuid", models.UUIDField(default=uuid.uuid4, unique=True)),
                ("created", models.DateTimeField(auto_now_add=True)),
                ("modified", models.DateTimeField(auto_now=True)),
                ("account_code", models.CharField(max_length=20, unique=True, validators=[django.core.validators.RegexValidator("^A[0-9]{4,}$", "Account code must match A followed by 4+ digits.")])),
                ("account_type", models.CharField(choices=[("BROKERAGE", "Brokerage"), ("MUTUAL_FUND", "Mutual Fund"), ("RETIREMENT", "Retirement")], max_length=20)),
                ("provider", models.CharField(blank=True, default=None, max_length=200, null=True)),
                ("opened_at", models.DateField(blank=True, default=None, null=True)),
                ("status", models.CharField(choices=[("ACTIVE", "Active"), ("DORMANT", "Dormant"), ("CLOSED", "Closed")], default="ACTIVE", max_length=20)),
                ("base_currency", models.CharField(default="INR", max_length=3)),
                ("customer", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="accounts", to="customers.customer")),
                ("created_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="created_%(class)s", to=settings.AUTH_USER_MODEL)),
                ("modified_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="modified_by_%(class)s", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created"],
                "abstract": False,
                "default_related_name": "related_accounts",
            },
        ),
        migrations.CreateModel(
            name="HoldingSnapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("uuid", models.UUIDField(default=uuid.uuid4, unique=True)),
                ("created", models.DateTimeField(auto_now_add=True)),
                ("modified", models.DateTimeField(auto_now=True)),
                ("quantity", models.DecimalField(decimal_places=6, max_digits=18)),
                ("avg_cost", models.DecimalField(decimal_places=4, max_digits=18)),
                ("snapshot_date", models.DateField()),
                ("account", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="holding_snapshots", to="investments.account")),
                ("instrument", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="holding_snapshots", to="investments.instrument")),
                ("created_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="created_%(class)s", to=settings.AUTH_USER_MODEL)),
                ("modified_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="modified_by_%(class)s", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created"],
                "abstract": False,
                "default_related_name": "related_holding_snapshots",
            },
        ),
        migrations.CreateModel(
            name="Transaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("uuid", models.UUIDField(default=uuid.uuid4, unique=True)),
                ("created", models.DateTimeField(auto_now_add=True)),
                ("modified", models.DateTimeField(auto_now=True)),
                ("transaction_code", models.CharField(max_length=20, unique=True, validators=[django.core.validators.RegexValidator("^T[0-9]{7,}$", "Transaction code must match T followed by 7+ digits.")])),
                ("transaction_type", models.CharField(choices=[("BUY", "Buy"), ("SELL", "Sell"), ("DIVIDEND", "Dividend"), ("FEE", "Fee")], max_length=20)),
                ("trade_date", models.DateField()),
                ("quantity", models.DecimalField(decimal_places=6, max_digits=18)),
                ("price", models.DecimalField(decimal_places=4, max_digits=18)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=18)),
                ("status", models.CharField(choices=[("SETTLED", "Settled"), ("PENDING", "Pending"), ("REVERSED", "Reversed")], default="SETTLED", max_length=20)),
                ("account", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="transactions", to="investments.account")),
                ("instrument", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="transactions", to="investments.instrument")),
                ("created_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="created_%(class)s", to=settings.AUTH_USER_MODEL)),
                ("modified_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="modified_by_%(class)s", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created"],
                "abstract": False,
                "default_related_name": "related_transactions",
            },
        ),
        migrations.AddIndex(
            model_name="instrument",
            index=models.Index(fields=["asset_class"], name="instrument_asset_class_idx"),
        ),
        migrations.AddConstraint(
            model_name="instrument",
            constraint=models.UniqueConstraint(fields=("instrument_code",), name="uq_instrument_code"),
        ),
        migrations.AddConstraint(
            model_name="instrument",
            constraint=models.UniqueConstraint(fields=("symbol",), name="uq_instrument_symbol"),
        ),
        migrations.AddConstraint(
            model_name="instrument",
            constraint=models.CheckConstraint(check=models.Q(instrument_code__regex="^I[0-9]{4,}$"), name="ck_instrument_code_format"),
        ),
        migrations.AddConstraint(
            model_name="instrument",
            constraint=models.CheckConstraint(check=models.Q(last_price__gt=0), name="ck_instrument_price_positive"),
        ),
        migrations.AddConstraint(
            model_name="instrument",
            constraint=models.CheckConstraint(check=models.Q(currency="INR"), name="ck_instrument_currency_inr"),
        ),
        migrations.AddIndex(
            model_name="account",
            index=models.Index(fields=["customer"], name="account_customer_idx"),
        ),
        migrations.AddIndex(
            model_name="account",
            index=models.Index(fields=["status"], name="account_status_idx"),
        ),
        migrations.AddConstraint(
            model_name="account",
            constraint=models.UniqueConstraint(fields=("account_code",), name="uq_account_code"),
        ),
        migrations.AddConstraint(
            model_name="account",
            constraint=models.CheckConstraint(check=models.Q(account_code__regex="^A[0-9]{4,}$"), name="ck_account_code_format"),
        ),
        migrations.AddConstraint(
            model_name="account",
            constraint=models.CheckConstraint(check=models.Q(base_currency="INR"), name="ck_account_currency_inr"),
        ),
        migrations.AddIndex(
            model_name="holdingsnapshot",
            index=models.Index(fields=["account", "snapshot_date"], name="holding_account_date_idx"),
        ),
        migrations.AddIndex(
            model_name="holdingsnapshot",
            index=models.Index(fields=["instrument"], name="holding_instrument_idx"),
        ),
        migrations.AddConstraint(
            model_name="holdingsnapshot",
            constraint=models.UniqueConstraint(fields=("account", "instrument", "snapshot_date"), name="uq_holding_account_instrument_date"),
        ),
        migrations.AddConstraint(
            model_name="holdingsnapshot",
            constraint=models.CheckConstraint(check=models.Q(quantity__gt=0), name="ck_holding_quantity_positive"),
        ),
        migrations.AddConstraint(
            model_name="holdingsnapshot",
            constraint=models.CheckConstraint(check=models.Q(avg_cost__gt=0), name="ck_holding_avg_cost_positive"),
        ),
        migrations.AddIndex(
            model_name="transaction",
            index=models.Index(fields=["account", "-trade_date", "-id"], name="txn_acc_date_idx"),
        ),
        migrations.AddIndex(
            model_name="transaction",
            index=models.Index(fields=["instrument", "trade_date"], name="txn_inst_date_idx"),
        ),
        migrations.AddIndex(
            model_name="transaction",
            index=models.Index(fields=["trade_date"], name="txn_trade_date_idx"),
        ),
        migrations.AddIndex(
            model_name="transaction",
            index=models.Index(fields=["transaction_type", "status", "trade_date"], name="txn_type_stat_date_idx"),
        ),
        migrations.AddConstraint(
            model_name="transaction",
            constraint=models.UniqueConstraint(fields=("transaction_code",), name="uq_transaction_code"),
        ),
        migrations.AddConstraint(
            model_name="transaction",
            constraint=models.CheckConstraint(check=models.Q(transaction_code__regex="^T[0-9]{7,}$"), name="ck_transaction_code_format"),
        ),
        migrations.AddConstraint(
            model_name="transaction",
            constraint=models.CheckConstraint(check=models.Q(amount__gte=0), name="ck_txn_amount_non_negative"),
        ),
        migrations.AddConstraint(
            model_name="transaction",
            constraint=models.CheckConstraint(check=models.Q(quantity__gte=0), name="ck_txn_quantity_non_negative"),
        ),
        migrations.AddConstraint(
            model_name="transaction",
            constraint=models.CheckConstraint(check=models.Q(price__gte=0), name="ck_txn_price_non_negative"),
        ),
        migrations.AddConstraint(
            model_name="transaction",
            constraint=models.CheckConstraint(check=(models.Q(transaction_type__in=["BUY", "SELL"]) & models.Q(quantity__gt=0) & models.Q(price__gt=0) | models.Q(transaction_type__in=["DIVIDEND", "FEE"]) & models.Q(quantity=0) & models.Q(price=0)), name="ck_txn_shape"),
        ),
    ]
