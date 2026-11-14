"""Goal model for FinPilot."""

from decimal import Decimal

from django.core.validators import RegexValidator
from django.db.models import CharField, DateField, DecimalField, ForeignKey, Index, PROTECT, Q
from django.db.models.constraints import CheckConstraint, UniqueConstraint

from apps.common.models import AbstractBaseCMModel
from apps.common.models.base import MONEY_DECIMAL_PLACES, MONEY_MAX_DIGITS
from apps.goals.config import GoalPriorityChoices, GoalTypeChoices


class Goal(AbstractBaseCMModel):
    """
    Financial goal for a customer — e.g. retirement, education, home purchase.
    funded_percent and flags are always computed server-side, never stored.

    ********************* Model Fields *********************
        PK          - id
        Unique      - uuid, goal_code
        FK          - customer (PROTECT), created_by, modified_by
        Char        - goal_code, goal_name, goal_type, priority
        Decimal     - target_amount, current_funded_amount
        Date        - target_date
        Datetime    - created, modified
    """

    class Meta(AbstractBaseCMModel.Meta):
        default_related_name = "related_goals"
        constraints = [
            UniqueConstraint(fields=["goal_code"], name="uq_goal_code"),
            CheckConstraint(
                check=Q(goal_code__regex=r"^G[0-9]{5,}$"),
                name="ck_goal_code_format",
            ),
            CheckConstraint(check=Q(target_amount__gt=0), name="ck_goal_target_positive"),
            CheckConstraint(check=Q(current_funded_amount__gte=0), name="ck_goal_funded_non_negative"),
        ]
        indexes = [
            Index(fields=["customer", "priority"], name="goal_cust_priority_idx"),
        ]

    goal_code = CharField(
        max_length=20,
        unique=True,
        validators=[RegexValidator(r"^G[0-9]{5,}$", "Goal code must match G followed by 5+ digits.")],
    )
    customer = ForeignKey(
        "customers.Customer",
        on_delete=PROTECT,
        related_name="goals",
    )
    goal_type = CharField(max_length=30, choices=GoalTypeChoices.choices)
    goal_name = CharField(max_length=100)
    target_amount = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES)
    current_funded_amount = DecimalField(max_digits=MONEY_MAX_DIGITS, decimal_places=MONEY_DECIMAL_PLACES, default=Decimal("0.00"))
    target_date = DateField()
    priority = CharField(max_length=10, choices=GoalPriorityChoices.choices, default=GoalPriorityChoices.medium)

    def __str__(self):
        return f"{self.goal_code} - {self.goal_name}"
