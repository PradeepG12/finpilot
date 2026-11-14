import pytz
from django.core.exceptions import ValidationError
from django.core.validators import BaseValidator
from django.utils import timezone
from django.utils.deconstruct import deconstructible
from django.utils.translation import gettext_lazy as _
from django.utils.translation import ngettext_lazy

from config.settings import TIME_ZONE


@deconstructible
class MaxSizeValidator(BaseValidator):
    """Custom Max size validator for file fields."""

    message = ngettext_lazy(
        "Ensure this file has not more than %(limit_value)d MB.",
        "Ensure this file has not more than %(limit_value)d MB.",
        "limit_value",
    )
    code = "max_size"

    def compare(self, a, b):
        """Bytes to mb conversion and comparison between given input and default value."""

        a /= 1048576
        return a > b

    def clean(self, x):
        return len(x)


@deconstructible
class MinYearValidator(BaseValidator):
    """Custom validator to validate the date is older or equal to the specified year limit."""

    message = _("Ensure that the date is more than the specified year limit")
    code = "year_limit"

    def compare(self, a, b):
        """Finds the year limit with current time and compares with the specified limit."""

        today = timezone.now().date()
        return (today - a).days / 365 < b


@deconstructible
class FutureOrTodayDateValidator:
    """Custom validator to validate the date is in the future."""

    message = _("Ensure that the date is either today or in the future.")

    def __call__(self, value):
        """Validates the date is in the future."""

        # TODO: Need to handle the date validation properly from user's timezone.

        if value < timezone.now().astimezone(tz=pytz.timezone(TIME_ZONE)).date():
            raise ValidationError(self.message)
