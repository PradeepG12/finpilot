import datetime
from mimetypes import guess_type

from django.core.exceptions import ValidationError
from django.utils import timezone


def validate_date(value: str):
    """Validates the given value is a valid date."""

    try:
        datetime.date.fromisoformat(value)
        return True, value
    except ValueError:
        return False, "Enter a valid date."


def validate_future_date(value):
    # Check if the date is in the past
    if value and value <= timezone.now().date():
        raise ValidationError("Date must be in the future.")


def validate_past_date(value):
    # Check if the date is in the Future
    if value and value > timezone.now().date():
        raise ValidationError("Date must be in the past.")


def validate_future_today_date(value):
    # Check if the date is in the past and today
    if value and value < timezone.now().date():
        raise ValidationError("Date must be in the future or today.")


def validate_past_today_date(value):
    # Check if the date is in the future and today
    if value and value >= timezone.now().date():
        raise ValidationError("Date must be in the past or today.")


def validate_future_today_date_time(value):
    # Check if the date is in the past and today
    if value and value < timezone.now():
        raise ValidationError("Date and Time must be in the future or today.")


def validate_image(file):
    # Check if file is an image
    mime, _ = guess_type(file.name)

    # If the MIME type is not provided or not an image, raise an error
    if mime is None or not mime.startswith("image/"):
        raise ValidationError("The uploaded file is not a valid image.")
