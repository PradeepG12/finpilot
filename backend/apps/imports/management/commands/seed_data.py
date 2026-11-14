"""Management command to populate database with seed CSVs or perform selective imports.

Usage:
  python manage.py seed_data [--path data/seed] [--only customers,accounts,...]
"""

from pathlib import Path

from django.core.management.base import BaseCommand

from apps.imports.config import ImportTypeChoices
from apps.imports.services.import_service import ImportService


class Command(BaseCommand):
    help = "Seeds database from CSV files with golden total guarantees."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            type=str,
            default="data/seed",
            help="Directory path containing seed CSVs (default: data/seed)",
        )
        parser.add_argument(
            "--only",
            type=str,
            default="",
            help="Comma-separated list of entities to seed (e.g. customers,accounts)",
        )

    def handle(self, *args, **options):
        base_path = Path(options["path"])
        if not base_path.is_absolute():
            # If relative, anchor from current workdir or parent of backend
            if not base_path.exists():
                alt_path = Path(__file__).resolve().parent.parent.parent.parent.parent / options["path"]
                if alt_path.exists():
                    base_path = alt_path

        self.stdout.write(self.style.NOTICE(f"Seeding data from: {base_path}"))

        # Strict FK-safe import sequence
        import_sequence = [
            (ImportTypeChoices.instruments, "instruments.csv"),
            (ImportTypeChoices.customers, "customers.csv"),
            (ImportTypeChoices.risk_profiles, "risk_profiles.csv"),
            (ImportTypeChoices.accounts, "accounts.csv"),
            (ImportTypeChoices.goals, "goals.csv"),
            (ImportTypeChoices.holdings, "holdings_snapshot.csv"),
            (ImportTypeChoices.transactions, "transactions.csv"),
        ]

        only_filter = [x.strip().lower() for x in options["only"].split(",") if x.strip()]
        service = ImportService()

        for import_type, file_name in import_sequence:
            entity_name = import_type.lower()
            if only_filter and entity_name not in only_filter:
                continue

            file_path = base_path / file_name
            if not file_path.exists():
                self.stdout.write(self.style.WARNING(f"File not found: {file_path}. Skipping."))
                continue

            self.stdout.write(f"Importing {file_name}...")
            with open(file_path, "rb") as f:
                result = service.import_file(import_type=import_type, file_obj=f, file_name=file_name)

            if result.get("conflict"):
                self.stdout.write(self.style.WARNING(f"  -> {result['message']}"))
            else:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  -> Total: {result['total']} | Imported: {result['imported']} | "
                        f"Skipped: {result['skipped_duplicate']} | Rejected: {result['rejected']}"
                    )
                )
                if result.get("warnings"):
                    self.stdout.write(f"     Warnings: {result['warnings']}")

        self.stdout.write(self.style.SUCCESS("All seed operations completed."))
