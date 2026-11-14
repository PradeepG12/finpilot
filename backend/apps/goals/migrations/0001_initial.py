"""Initial migration for goals app."""

import decimal
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
        migrations.RunSQL(
            sql="CREATE SEQUENCE IF NOT EXISTS goals_goal_code_seq START 178;",
            reverse_sql="DROP SEQUENCE IF EXISTS goals_goal_code_seq;",
        ),
        migrations.CreateModel(
            name="Goal",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("uuid", models.UUIDField(default=uuid.uuid4, unique=True)),
                ("created", models.DateTimeField(auto_now_add=True)),
                ("modified", models.DateTimeField(auto_now=True)),
                ("goal_code", models.CharField(max_length=20, unique=True, validators=[django.core.validators.RegexValidator("^G[0-9]{5,}$", "Goal code must match G followed by 5+ digits.")])),
                ("goal_type", models.CharField(choices=[("RETIREMENT", "Retirement"), ("EDUCATION", "Education"), ("EMERGENCY_FUND", "Emergency Fund"), ("TRAVEL", "Travel"), ("WEALTH_CREATION", "Wealth Creation"), ("HOME_PURCHASE", "Home Purchase")], max_length=30)),
                ("goal_name", models.CharField(max_length=100)),
                ("target_amount", models.DecimalField(decimal_places=2, max_digits=18)),
                ("current_funded_amount", models.DecimalField(decimal_places=2, default=decimal.Decimal("0.00"), max_digits=18)),
                ("target_date", models.DateField()),
                ("priority", models.CharField(choices=[("LOW", "Low"), ("MEDIUM", "Medium"), ("HIGH", "High")], default="MEDIUM", max_length=10)),
                ("customer", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="goals", to="customers.customer")),
                ("created_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="created_%(class)s", to=settings.AUTH_USER_MODEL)),
                ("modified_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="modified_by_%(class)s", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created"],
                "abstract": False,
                "default_related_name": "related_goals",
            },
        ),
        migrations.AddIndex(
            model_name="goal",
            index=models.Index(fields=["customer", "priority"], name="goal_cust_priority_idx"),
        ),
        migrations.AddConstraint(
            model_name="goal",
            constraint=models.UniqueConstraint(fields=("goal_code",), name="uq_goal_code"),
        ),
        migrations.AddConstraint(
            model_name="goal",
            constraint=models.CheckConstraint(check=models.Q(goal_code__regex="^G[0-9]{5,}$"), name="ck_goal_code_format"),
        ),
        migrations.AddConstraint(
            model_name="goal",
            constraint=models.CheckConstraint(check=models.Q(target_amount__gt=0), name="ck_goal_target_positive"),
        ),
        migrations.AddConstraint(
            model_name="goal",
            constraint=models.CheckConstraint(check=models.Q(current_funded_amount__gte=0), name="ck_goal_funded_non_negative"),
        ),
    ]
