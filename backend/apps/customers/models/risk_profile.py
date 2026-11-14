"""Risk profile model for FinPilot customers."""

from django.db.models import CharField, DateField, ForeignKey, Index, IntegerField, PROTECT, Q
from django.db.models.constraints import CheckConstraint, UniqueConstraint

from apps.common.models import AbstractBaseCMModel
from apps.customers.config import LiquidityNeedChoices, RiskLevelChoices


class RiskProfile(AbstractBaseCMModel):
    """
    Risk profile for a customer. Supports multiple historical assessments;
    the latest (by assessed_at) is the active one.

    ********************* Model Fields *********************
        PK          - id
        Unique      - uuid
        FK          - customer (PROTECT), created_by, modified_by
        SmallInt    - risk_score, horizon_years
        Char        - risk_level, liquidity_need
        Date        - assessed_at
        Datetime    - created, modified
    """

    class Meta(AbstractBaseCMModel.Meta):
        default_related_name = "related_risk_profiles"
        constraints = [
            UniqueConstraint(fields=["customer", "assessed_at"], name="uq_risk_profile_customer_date"),
            CheckConstraint(check=Q(risk_score__gte=0, risk_score__lte=100), name="ck_risk_score_range"),
            CheckConstraint(check=Q(horizon_years__gte=1, horizon_years__lte=60), name="ck_risk_horizon_range"),
        ]
        indexes = [
            Index(fields=["customer", "-assessed_at"], name="risk_prof_cust_date_idx"),
        ]

    customer = ForeignKey(
        "customers.Customer",
        on_delete=PROTECT,
        related_name="risk_profiles",
    )
    risk_score = IntegerField()
    risk_level = CharField(max_length=20, choices=RiskLevelChoices.choices)
    assessed_at = DateField()
    horizon_years = IntegerField()
    liquidity_need = CharField(max_length=20, choices=LiquidityNeedChoices.choices)

    def __str__(self):
        return f"{self.customer.customer_code} risk profile {self.assessed_at}"
