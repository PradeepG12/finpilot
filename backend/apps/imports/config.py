"""Choice enumerations for the imports app."""

from djchoices import ChoiceItem, DjangoChoices


class ImportTypeChoices(DjangoChoices):
    """Type of data import batch."""

    transactions = ChoiceItem("TRANSACTIONS", "Transactions")
    holdings = ChoiceItem("HOLDINGS", "Holdings Snapshot")
    customers = ChoiceItem("CUSTOMERS", "Customers")
    accounts = ChoiceItem("ACCOUNTS", "Accounts")
    instruments = ChoiceItem("INSTRUMENTS", "Instruments")
    risk_profiles = ChoiceItem("RISK_PROFILES", "Risk Profiles")
    goals = ChoiceItem("GOALS", "Goals")


class ImportStatusChoices(DjangoChoices):
    """Status of a data import batch."""

    pending = ChoiceItem("PENDING", "Pending")
    processing = ChoiceItem("PROCESSING", "Processing")
    completed = ChoiceItem("COMPLETED", "Completed")
    completed_with_errors = ChoiceItem("COMPLETED_WITH_ERRORS", "Completed with Errors")
    failed = ChoiceItem("FAILED", "Failed")
    dry_run = ChoiceItem("DRY_RUN", "Dry Run")


class ImportOutcomeChoices(DjangoChoices):
    """Row-level outcome for an import row error."""

    rejected = ChoiceItem("REJECTED", "Rejected")
    skipped_duplicate = ChoiceItem("SKIPPED_DUPLICATE", "Skipped Duplicate")
