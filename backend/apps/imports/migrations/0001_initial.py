"""Initial migration for imports app."""

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ImportBatch",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("uuid", models.UUIDField(default=uuid.uuid4, unique=True)),
                ("created", models.DateTimeField(auto_now_add=True)),
                ("modified", models.DateTimeField(auto_now=True)),
                ("import_type", models.CharField(choices=[("TRANSACTIONS", "Transactions"), ("HOLDINGS", "Holdings Snapshot"), ("CUSTOMERS", "Customers"), ("ACCOUNTS", "Accounts"), ("INSTRUMENTS", "Instruments"), ("RISK_PROFILES", "Risk Profiles"), ("GOALS", "Goals")], max_length=30)),
                ("file_name", models.CharField(max_length=255)),
                ("file_sha256", models.CharField(max_length=64)),
                ("status", models.CharField(choices=[("PROCESSING", "Processing"), ("COMPLETED", "Completed"), ("COMPLETED_WITH_ERRORS", "Completed with Errors"), ("FAILED", "Failed"), ("DRY_RUN", "Dry Run")], default="PROCESSING", max_length=30)),
                ("is_dry_run", models.BooleanField(default=False)),
                ("rows_total", models.IntegerField(default=0)),
                ("rows_imported", models.IntegerField(default=0)),
                ("rows_skipped_duplicate", models.IntegerField(default=0)),
                ("rows_rejected", models.IntegerField(default=0)),
                ("warnings", models.JSONField(default=dict)),
                ("started_at", models.DateTimeField(auto_now_add=True)),
                ("finished_at", models.DateTimeField(blank=True, default=None, null=True)),
                ("created_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="created_%(class)s", to=settings.AUTH_USER_MODEL)),
                ("modified_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="modified_by_%(class)s", to=settings.AUTH_USER_MODEL)),
                ("triggered_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="import_batches", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created"],
                "abstract": False,
                "default_related_name": "related_import_batches",
            },
        ),
        migrations.CreateModel(
            name="StagingTransaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("uuid", models.UUIDField(default=uuid.uuid4, unique=True)),
                ("created", models.DateTimeField(auto_now_add=True)),
                ("modified", models.DateTimeField(auto_now=True)),
                ("row_number", models.IntegerField()),
                ("raw_transaction_id", models.CharField(blank=True, default=None, max_length=50, null=True)),
                ("raw_account_id", models.CharField(blank=True, default=None, max_length=50, null=True)),
                ("raw_instrument_id", models.CharField(blank=True, default=None, max_length=50, null=True)),
                ("raw_type", models.CharField(blank=True, default=None, max_length=50, null=True)),
                ("raw_trade_date", models.CharField(blank=True, default=None, max_length=50, null=True)),
                ("raw_quantity", models.CharField(blank=True, default=None, max_length=50, null=True)),
                ("raw_price", models.CharField(blank=True, default=None, max_length=50, null=True)),
                ("raw_amount", models.CharField(blank=True, default=None, max_length=50, null=True)),
                ("raw_status", models.CharField(blank=True, default=None, max_length=50, null=True)),
                ("parsed_trade_date", models.DateField(blank=True, default=None, null=True)),
                ("parsed_quantity", models.DecimalField(blank=True, decimal_places=6, default=None, max_digits=18, null=True)),
                ("parsed_price", models.DecimalField(blank=True, decimal_places=4, default=None, max_digits=18, null=True)),
                ("parsed_amount", models.DecimalField(blank=True, decimal_places=2, default=None, max_digits=18, null=True)),
                ("row_status", models.CharField(default="PENDING", max_length=30)),
                ("error_code", models.CharField(blank=True, default=None, max_length=50, null=True)),
                ("batch", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="staging_transactions", to="imports.importbatch")),
                ("created_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="created_%(class)s", to=settings.AUTH_USER_MODEL)),
                ("modified_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="modified_by_%(class)s", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created"],
                "abstract": False,
                "default_related_name": "related_staging_transactions",
            },
        ),
        migrations.CreateModel(
            name="ImportRowError",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("uuid", models.UUIDField(default=uuid.uuid4, unique=True)),
                ("created", models.DateTimeField(auto_now_add=True)),
                ("modified", models.DateTimeField(auto_now=True)),
                ("row_number", models.IntegerField()),
                ("outcome", models.CharField(choices=[("REJECTED", "Rejected"), ("SKIPPED_DUPLICATE", "Skipped Duplicate")], max_length=30)),
                ("error_code", models.CharField(max_length=50)),
                ("field", models.CharField(blank=True, default=None, max_length=100, null=True)),
                ("message", models.CharField(max_length=500)),
                ("raw_row", models.JSONField(default=dict)),
                ("batch", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="row_errors", to="imports.importbatch")),
                ("created_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="created_%(class)s", to=settings.AUTH_USER_MODEL)),
                ("modified_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="modified_by_%(class)s", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created"],
                "abstract": False,
                "default_related_name": "related_import_row_errors",
            },
        ),
        migrations.AddConstraint(
            model_name="importbatch",
            constraint=models.UniqueConstraint(condition=models.Q(("is_dry_run", False), ("status__in", ["COMPLETED", "COMPLETED_WITH_ERRORS"])), fields=("import_type", "file_sha256"), name="uq_import_type_sha256_completed"),
        ),
        migrations.AddIndex(
            model_name="stagingtransaction",
            index=models.Index(fields=["batch", "row_number"], name="stg_txn_batch_row_idx"),
        ),
        migrations.AddIndex(
            model_name="stagingtransaction",
            index=models.Index(fields=["batch", "row_status"], name="stg_txn_batch_status_idx"),
        ),
        migrations.AddIndex(
            model_name="importrowerror",
            index=models.Index(fields=["batch", "row_number"], name="imp_row_err_batch_row_idx"),
        ),
        migrations.AddIndex(
            model_name="importrowerror",
            index=models.Index(fields=["batch", "error_code"], name="imp_row_err_batch_code_idx"),
        ),
    ]
