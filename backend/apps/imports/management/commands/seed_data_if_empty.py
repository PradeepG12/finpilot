"""Management command to conditionally run seed_data if customers table is empty."""

from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.customers.models import Customer


class Command(BaseCommand):
    help = "Seeds database with CSV data if no customers exist yet."

    def handle(self, *args, **options):
        if Customer.objects.exists():
            self.stdout.write("Database already contains data; skipping auto-seed.")
        else:
            self.stdout.write("Empty database detected; executing seed_data...")
            call_command("seed_data")
