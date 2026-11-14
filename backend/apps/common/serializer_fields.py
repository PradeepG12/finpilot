from django.contrib.auth.password_validation import validate_password
from django.contrib.postgres.fields import ArrayField
from phonenumber_field.serializerfields import PhoneNumberField as PhoneNumberSerializerField
from rest_framework import serializers

from apps.common.validators import MinYearValidator


class PasswordField(serializers.CharField):
    """Custom Password Field Having max_length attributes and password validation function."""

    def __init__(self, *args, **kwargs):
        """Overridden to assign validators."""

        kwargs["validators"] = [validate_password]
        kwargs["write_only"] = True
        super().__init__(*args, **kwargs)


class DateOfBirthField(serializers.DateField):
    """Custom DOB Field to validate the age."""

    def __init__(self, limit_value, *args, **kwargs):
        """Overridden to assign validators."""

        kwargs["validators"] = [
            MinYearValidator(
                limit_value=limit_value,
                message=f"You must be at least {limit_value} years old.",
            ),
        ]
        super().__init__(*args, **kwargs)


class ChoiceDisplayField(serializers.Field):
    """Serializer field to represent choice field as {id: value, label: display}"""

    def to_representation(self, value):
        """Method to represent choice field as {id: value, label: display}"""

        if value in (None, "", []):
            return None if value in (None, "") else []
        model = self.parent.Meta.model
        model_field = model._meta.get_field(self.field_name)
        if isinstance(model_field, ArrayField):
            choices = dict(model_field.base_field.choices)
            return [{"id": item, "identity": choices.get(item, item)} for item in value]
        choices = dict(model_field.choices)
        return {"id": value, "identity": choices.get(value, value)}


class AppPhoneNumberSerializerField(PhoneNumberSerializerField):
    """Applications version of the PhoneNumberField. To define app's functions."""
