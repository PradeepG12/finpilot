"""Management command to initialise the FinPilot application."""

from django.conf import settings
from django.core.management import call_command
from django.db import DEFAULT_DB_ALIAS

from apps.access.config import UserTypeChoices
from apps.access.models import User
from apps.common.management.commands.base import AppBaseCommand


class Command(AppBaseCommand):
    help = "Initialises the app: runs migrations and seeds admin + viewer users."

    def add_arguments(self, parser):
        """Adds optional --seed flag to also run seed_data after user creation."""

        parser.add_argument("--seed", action="store_true", help="Run seed_data after user creation.")

    def handle(self, *args, **kwargs):
        """Runs migrations, creates super admin, creates demo viewer; seeds data if --seed."""

        self.print_styled_message("** Running migrations... **")
        call_command("migrate", database=DEFAULT_DB_ALIAS)
        self.create_super_admin()
        self.create_demo_viewer()
        if kwargs.get("seed"):
            self.print_styled_message("** Running seed_data... **")
            call_command("seed_data")

    def create_super_admin(self):
        """Creates the super admin user if it does not already exist."""

        self.print_styled_message("** Creating super admin... **")
        if User.objects.filter(email=settings.SUPER_ADMIN_EMAIL).exists():
            self.print_styled_message("** Super admin already exists. **")
            return
        User.objects.create_superuser(
            username=None,
            full_name=settings.SUPER_ADMIN_NAME,
            email=settings.SUPER_ADMIN_EMAIL,
            password=settings.SUPER_ADMIN_PASSWORD,
            user_type=UserTypeChoices.admin,
        )
        self.print_styled_message("** Super admin created. **")

    def create_demo_viewer(self):
        """Creates the demo VIEWER user for local development if it does not already exist."""

        email = settings.DEMO_VIEWER_EMAIL
        if User.objects.filter(email=email).exists():
            self.print_styled_message("** Demo viewer already exists. **")
            return
        User.objects.create_user(
            username=None,
            full_name="Demo Viewer",
            email=email,
            password=settings.DEMO_VIEWER_PASSWORD,
            user_type=UserTypeChoices.viewer,
        )
        self.print_styled_message("** Demo viewer created. **")
