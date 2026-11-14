"""Choice enumerations for the customers app."""

from djchoices import ChoiceItem, DjangoChoices


class KycStatusChoices(DjangoChoices):
    """KYC verification status for a customer."""

    verified = ChoiceItem("VERIFIED", "Verified")
    pending = ChoiceItem("PENDING", "Pending")
    review = ChoiceItem("REVIEW", "Under Review")


class SegmentChoices(DjangoChoices):
    """Customer wealth segment."""

    mass = ChoiceItem("MASS", "Mass")
    affluent = ChoiceItem("AFFLUENT", "Affluent")
    hni = ChoiceItem("HNI", "HNI")


class RiskLevelChoices(DjangoChoices):
    """Risk appetite level for a customer."""

    conservative = ChoiceItem("CONSERVATIVE", "Conservative")
    moderate = ChoiceItem("MODERATE", "Moderate")
    growth = ChoiceItem("GROWTH", "Growth")
    aggressive = ChoiceItem("AGGRESSIVE", "Aggressive")


class LiquidityNeedChoices(DjangoChoices):
    """Liquidity requirement for a customer's risk profile."""

    low = ChoiceItem("LOW", "Low")
    medium = ChoiceItem("MEDIUM", "Medium")
    high = ChoiceItem("HIGH", "High")
