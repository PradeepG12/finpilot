"""Configuration and choices for reports and exports."""

from djchoices import ChoiceItem, DjangoChoices


class ExportStatusChoices(DjangoChoices):
    """Lifecycle status of an asynchronous report export."""

    pending = ChoiceItem("PENDING", "Pending")
    processing = ChoiceItem("PROCESSING", "Processing")
    completed = ChoiceItem("COMPLETED", "Completed")
    failed = ChoiceItem("FAILED", "Failed")


class ExportTypeChoices(DjangoChoices):
    """Types of data exports supported."""

    transactions = ChoiceItem("TRANSACTIONS", "Transactions")
    portfolio_positions = ChoiceItem("PORTFOLIO_POSITIONS", "Portfolio Positions")
    goals = ChoiceItem("GOALS", "Goals")
    customers = ChoiceItem("CUSTOMERS", "Customers")
    accounts = ChoiceItem("ACCOUNTS", "Accounts")
