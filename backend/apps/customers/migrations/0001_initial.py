"""Initial migration for customers app."""

import uuid

import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations, models

from apps.common.model_fields import AppPhoneNumberField


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        TrigramExtension(),
        migrations.CreateModel(
            name="Customer",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("uuid", models.UUIDField(default=uuid.uuid4, unique=True)),
                ("created", models.DateTimeField(auto_now_add=True)),
                ("modified", models.DateTimeField(auto_now=True)),
                ("customer_code", models.CharField(max_length=20, unique=True, validators=[django.core.validators.RegexValidator("^C[0-9]{4,}$", "Customer code must match C followed by 4+ digits.")])),
                ("full_name", models.CharField(max_length=100)),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("phone", AppPhoneNumberField(max_length=128, region=None)),
                ("city", models.CharField(blank=True, default=None, max_length=100, null=True)),
                ("state", models.CharField(blank=True, default=None, max_length=2, null=True)),
                ("date_of_birth", models.DateField(blank=True, default=None, null=True)),
                ("onboarded_at", models.DateField(blank=True, default=None, null=True)),
                ("kyc_status", models.CharField(choices=[("VERIFIED", "Verified"), ("PENDING", "Pending"), ("REVIEW", "Under Review")], default="PENDING", max_length=20)),
                ("segment", models.CharField(choices=[("MASS", "Mass"), ("AFFLUENT", "Affluent"), ("HNI", "HNI")], default="MASS", max_length=20)),
                ("created_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="created_%(class)s", to=settings.AUTH_USER_MODEL)),
                ("modified_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="modified_by_%(class)s", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created"],
                "abstract": False,
                "default_related_name": "related_customers",
            },
        ),
        migrations.CreateModel(
            name="RiskProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("uuid", models.UUIDField(default=uuid.uuid4, unique=True)),
                ("created", models.DateTimeField(auto_now_add=True)),
                ("modified", models.DateTimeField(auto_now=True)),
                ("risk_score", models.IntegerField()),
                ("risk_level", models.CharField(choices=[("CONSERVATIVE", "Conservative"), ("MODERATE", "Moderate"), ("GROWTH", "Growth"), ("AGGRESSIVE", "Aggressive")], max_length=20)),
                ("assessed_at", models.DateField()),
                ("horizon_years", models.IntegerField()),
                ("liquidity_need", models.CharField(choices=[("LOW", "Low"), ("MEDIUM", "Medium"), ("HIGH", "High")], max_length=20)),
                ("created_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="created_%(class)s", to=settings.AUTH_USER_MODEL)),
                ("modified_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="modified_by_%(class)s", to=settings.AUTH_USER_MODEL)),
                ("customer", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="risk_profiles", to="customers.customer")),
            ],
            options={
                "ordering": ["-created"],
                "abstract": False,
                "default_related_name": "related_risk_profiles",
            },
        ),
        migrations.AddIndex(
            model_name="customer",
            index=GinIndex(fields=["full_name"], name="cust_fullname_trgm_idx", opclasses=["gin_trgm_ops"]),
        ),
        migrations.AddIndex(
            model_name="customer",
            index=GinIndex(fields=["email"], name="cust_email_trgm_idx", opclasses=["gin_trgm_ops"]),
        ),
        migrations.AddIndex(
            model_name="customer",
            index=GinIndex(fields=["city"], name="cust_city_trgm_idx", opclasses=["gin_trgm_ops"]),
        ),
        migrations.AddIndex(
            model_name="customer",
            index=models.Index(fields=["kyc_status"], name="cust_kyc_status_idx"),
        ),
        migrations.AddIndex(
            model_name="customer",
            index=models.Index(fields=["segment"], name="cust_segment_idx"),
        ),
        migrations.AddConstraint(
            model_name="customer",
            constraint=models.UniqueConstraint(fields=("customer_code",), name="uq_customer_code"),
        ),
        migrations.AddConstraint(
            model_name="customer",
            constraint=models.UniqueConstraint(fields=("email",), name="uq_customer_email"),
        ),
        migrations.AddConstraint(
            model_name="customer",
            constraint=models.CheckConstraint(check=models.Q(customer_code__regex="^C[0-9]{4,}$"), name="ck_customer_code_format"),
        ),
        migrations.AddConstraint(
            model_name="customer",
            constraint=models.CheckConstraint(check=models.Q(state__regex="^[A-Z]{2}$") | models.Q(state__isnull=True) | models.Q(state=""), name="ck_customer_state_format"),
        ),
        migrations.AddIndex(
            model_name="riskprofile",
            index=models.Index(fields=["customer", "-assessed_at"], name="risk_prof_cust_date_idx"),
        ),
        migrations.AddConstraint(
            model_name="riskprofile",
            constraint=models.UniqueConstraint(fields=("customer", "assessed_at"), name="uq_risk_profile_customer_date"),
        ),
        migrations.AddConstraint(
            model_name="riskprofile",
            constraint=models.CheckConstraint(check=models.Q(risk_score__gte=0, risk_score__lte=100), name="ck_risk_score_range"),
        ),
        migrations.AddConstraint(
            model_name="riskprofile",
            constraint=models.CheckConstraint(check=models.Q(horizon_years__gte=1, horizon_years__lte=60), name="ck_risk_horizon_range"),
        ),
    ]
