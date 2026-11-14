"""Choice enumerations for the goals app."""

from djchoices import ChoiceItem, DjangoChoices


class GoalTypeChoices(DjangoChoices):
    """Type of financial goal."""

    retirement = ChoiceItem("RETIREMENT", "Retirement")
    education = ChoiceItem("EDUCATION", "Education")
    emergency_fund = ChoiceItem("EMERGENCY_FUND", "Emergency Fund")
    travel = ChoiceItem("TRAVEL", "Travel")
    wealth_creation = ChoiceItem("WEALTH_CREATION", "Wealth Creation")
    home_purchase = ChoiceItem("HOME_PURCHASE", "Home Purchase")


class GoalPriorityChoices(DjangoChoices):
    """Priority level of a financial goal."""

    low = ChoiceItem("LOW", "Low")
    medium = ChoiceItem("MEDIUM", "Medium")
    high = ChoiceItem("HIGH", "High")
