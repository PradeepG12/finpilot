from django.contrib.auth.models import AbstractUser
from django.db.models import BooleanField, CharField, EmailField
from django.utils.translation import gettext_lazy as _

from apps.access.config import UserTypeChoices
from apps.common.managers import CustomUserManager
from apps.common.model_fields import AppPhoneNumberField
from apps.common.models import (
    COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG,
    COMMON_CHOICE_FIELD_MAX_LENGTH,
    COMMON_NAME_MAX_LENGTH,
    AbstractBaseCMModel,
)


class User(AbstractUser, AbstractBaseCMModel):
    """
    User model for the entire application.
    Holds the authentication and profile data of a user.

    ********************* Model Fields *********************
        PK          - id
        Unique      - uuid, email, phone_number
        FK          - created_by, modified_by
        Char        - full_name, user_type
        Boolean     - is_active, is_staff, is_superuser
        Datetime    - created, modified
    """

    class Meta(AbstractBaseCMModel.Meta):
        default_related_name = "related_users"

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = CustomUserManager()

    username = date_joined = groups = user_permissions = first_name = last_name = None
    email = EmailField(unique=True)
    phone_number = AppPhoneNumberField(unique=True, **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    full_name = CharField(max_length=COMMON_NAME_MAX_LENGTH, **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG)
    user_type = CharField(
        max_length=COMMON_CHOICE_FIELD_MAX_LENGTH,
        choices=UserTypeChoices.choices,
        default=UserTypeChoices.viewer,
    )
    is_superuser = BooleanField(
        _("superuser status"),
        default=False,
        help_text=_("Designates that this user has all permissions without explicitly assigning them."),
    )
    is_staff = BooleanField(
        _("staff status"),
        default=False,
        help_text=_("Designates whether the user can log into this admin site."),
    )
    is_active = BooleanField(
        _("active"),
        default=True,
        help_text=_("Designates whether this user should be treated as active. Unselect this instead of deleting accounts."),
    )

    def __str__(self):
        return str(self.email)
