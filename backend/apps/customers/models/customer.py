"""Customer domain models for FinPilot."""

from django.core.validators import RegexValidator
from django.db.models import CharField, DateField, EmailField, Index, Q
from django.db.models.constraints import CheckConstraint, UniqueConstraint
from django.contrib.postgres.indexes import GinIndex

from apps.common.model_fields import AppPhoneNumberField
from apps.common.models import COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG, AbstractBaseCMModel
from apps.customers.config import KycStatusChoices, SegmentChoices


class Customer(AbstractBaseCMModel):
    """
    Represents a wealth-management firm customer.

    ********************* Model Fields *********************
        PK          - id
        Unique      - uuid, customer_code, email
        FK          - created_by, modified_by
        Char        - customer_code, full_name, email, city, state, kyc_status, segment
        Phone       - phone
        Date        - date_of_birth, onboarded_at
        Datetime    - created, modified
    """

    class Meta(AbstractBaseCMModel.Meta):
        default_related_name = "related_customers"
        indexes = [
            GinIndex(fields=["full_name"], name="cust_fullname_trgm_idx", opclasses=["gin_trgm_ops"]),
            GinIndex(fields=["email"], name="cust_email_trgm_idx", opclasses=["gin_trgm_ops"]),
            GinIndex(fields=["city"], name="cust_city_trgm_idx", opclasses=["gin_trgm_ops"]),
            Index(fields=["kyc_status"], name="cust_kyc_status_idx"),
            Index(fields=["segment"], name="cust_segment_idx"),
        ]
        constraints = [
            UniqueConstraint(fields=["customer_code"], name="uq_customer_code"),
            UniqueConstraint(fields=["email"], name="uq_customer_email"),
            CheckConstraint(
                check=Q(customer_code__regex=r"^C[0-9]{4,}$"),
                name="ck_customer_code_format",
            ),
            CheckConstraint(
                check=Q(state__regex=r"^[A-Z]{2}$") | Q(state__isnull=True) | Q(state=""),
                name="ck_customer_state_format",
            ),
        ]

    customer_code = CharField(
        max_length=20,
        unique=True,
        validators=[RegexValidator(r"^C[0-9]{4,}$", "Customer code must match C followed by 4+ digits.")],
    )
    full_name = CharField(max_length=100)
    email = EmailField(max_length=254, unique=True)
    phone = AppPhoneNumberField()
    city = CharField(max_length=100, **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    state = CharField(max_length=2, **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    date_of_birth = DateField(**COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    onboarded_at = DateField(**COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    kyc_status = CharField(max_length=20, choices=KycStatusChoices.choices, default=KycStatusChoices.pending)
    segment = CharField(max_length=20, choices=SegmentChoices.choices, default=SegmentChoices.mass)

    def __str__(self):
        return f"{self.customer_code} - {self.full_name}"
