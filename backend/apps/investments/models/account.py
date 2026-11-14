"""Investment account model."""

from django.core.validators import RegexValidator
from django.db.models import CharField, DateField, ForeignKey, Index, PROTECT, Q
from django.db.models.constraints import CheckConstraint, UniqueConstraint

from apps.common.models import COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG, AbstractBaseCMModel
from apps.investments.config import AccountStatusChoices, AccountTypeChoices


class Account(AbstractBaseCMModel):
    """
    Investment account belonging to a customer.

    ********************* Model Fields *********************
        PK          - id
        Unique      - uuid, account_code
        FK          - customer (PROTECT), created_by, modified_by
        Char        - account_code, account_type, provider, status, base_currency
        Date        - opened_at
        Datetime    - created, modified
    """

    class Meta(AbstractBaseCMModel.Meta):
        default_related_name = "related_accounts"
        constraints = [
            UniqueConstraint(fields=["account_code"], name="uq_account_code"),
            CheckConstraint(
                check=Q(account_code__regex=r"^A[0-9]{4,}$"),
                name="ck_account_code_format",
            ),
            CheckConstraint(
                check=Q(base_currency="INR"),
                name="ck_account_currency_inr",
            ),
        ]
        indexes = [
            Index(fields=["customer"], name="account_customer_idx"),
            Index(fields=["status"], name="account_status_idx"),
        ]

    account_code = CharField(
        max_length=20,
        unique=True,
        validators=[RegexValidator(r"^A[0-9]{4,}$", "Account code must match A followed by 4+ digits.")],
    )
    customer = ForeignKey(
        "customers.Customer",
        on_delete=PROTECT,
        related_name="accounts",
    )
    account_type = CharField(max_length=20, choices=AccountTypeChoices.choices)
    provider = CharField(max_length=200, **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    opened_at = DateField(**COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    status = CharField(max_length=20, choices=AccountStatusChoices.choices, default=AccountStatusChoices.active)
    base_currency = CharField(max_length=3, default="INR")

    def __str__(self):
        return f"{self.account_code} ({self.account_type})"
