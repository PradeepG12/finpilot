"""Initial migration for access app — FinPilot User model (JWT, no token auth)."""

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

from apps.common.model_fields import AppPhoneNumberField


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.CreateModel(
            name="User",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("password", models.CharField(max_length=128, verbose_name="password")),
                ("last_login", models.DateTimeField(blank=True, null=True, verbose_name="last login")),
                ("uuid", models.UUIDField(default=uuid.uuid4, unique=True)),
                ("created", models.DateTimeField(auto_now_add=True)),
                ("modified", models.DateTimeField(auto_now=True)),
                ("email", models.EmailField(max_length=254, unique=True)),
                (
                    "phone_number",
                    AppPhoneNumberField(
                        blank=True, default=None, max_length=128, null=True, region=None, unique=True
                    ),
                ),
                ("full_name", models.CharField(blank=True, default=None, max_length=100, null=True)),
                ("user_type", models.CharField(choices=[("ADMIN", "Admin"), ("VIEWER", "Viewer")], default="VIEWER", max_length=64)),
                ("is_superuser", models.BooleanField(default=False, help_text="Designates that this user has all permissions without explicitly assigning them.", verbose_name="superuser status")),
                ("is_staff", models.BooleanField(default=False, help_text="Designates whether the user can log into this admin site.", verbose_name="staff status")),
                ("is_active", models.BooleanField(default=True, help_text="Designates whether this user should be treated as active. Unselect this instead of deleting accounts.", verbose_name="active")),
                ("created_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="created_%(class)s", to=settings.AUTH_USER_MODEL)),
                ("modified_by", models.ForeignKey(blank=True, default=None, null=True, on_delete=django.db.models.deletion.SET_DEFAULT, related_name="modified_by_%(class)s", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created"],
                "abstract": False,
                "default_related_name": "related_users",
            },
        ),
    ]
