import uuid

from django.core import checks
from django.core.validators import MinLengthValidator
from django.db import models
from phonenumber_field.modelfields import PhoneNumberField

from apps.common.validators import MaxSizeValidator


class BaseField:
    """Base field for the application defined model fields."""


class AppPhoneNumberField(BaseField, PhoneNumberField):
    """Applications version of the PhoneNumberField. To define app's functions."""


class AppSingleFileField(BaseField, models.FileField):
    """Field for uploading a single file. Sets the default upload path."""

    def __init__(self, *args, **kwargs):
        from apps.common.models import COMMON_CHAR_FIELD_MAX_LENGTH

        kwargs.setdefault("upload_to", "files/")
        kwargs.setdefault("max_length", COMMON_CHAR_FIELD_MAX_LENGTH)
        super().__init__(*args, **kwargs)

    def pre_save(self, model_instance, add):
        # Generate a new filename with UUID and keep the existing path
        if model_instance.file:
            extension = model_instance.file.name.split(".")[-1]
            new_filename = f"{uuid.uuid4().hex}.{extension}"

            # Set the new filename without changing the path
            model_instance.file.name = f"{new_filename}"

        return super().pre_save(model_instance, add)


class AppFileField(BaseField, models.FileField):
    """Custom File Field with max_size attribute, and validations."""

    def __init__(self, max_size=None, *args, **kwargs):
        """Overridden to include custom validation."""

        self.max_size = max_size  # attribute initialization
        kwargs.setdefault("upload_to", "files/")
        super().__init__(*args, **kwargs)
        # custom validation to validate the file size
        self.validators.append(MaxSizeValidator(self.max_size))

    def deconstruct(self):
        """Using deconstruct method to reconstruct the "max_size" attribute to model argument value."""

        name, path, args, kwargs = super().deconstruct()
        kwargs["max_size"] = self.max_size
        return name, path, args, kwargs

    def check(self, **kwargs):
        """Check whether the max_size attribute is set."""

        return [
            # check the inbuilt attribute validations
            *super().check(**kwargs),
            # check the max_size attribute is present or not
            *self._check_max_size_attribute(**kwargs),
        ]

    def _check_max_size_attribute(self, **kwargs):
        """Function checks the max_size attribute presents or not & validate the type & size validations."""

        if self.max_size is None:
            return [
                checks.Error(
                    f"{self.__class__.__name__} must define a 'max_size' attribute.",
                    obj=self,
                ),
            ]
        if not isinstance(self.max_size, int) or isinstance(self.max_size, bool) or self.max_size <= 0:
            return [
                checks.Error(
                    "'max_size' must be a positive number of MB",
                    obj=self,
                ),
            ]
        return []


class AppImageField(AppFileField, models.ImageField):
    """Custom image field which inherits the AppFileField functionalities, as well as the ImageField."""

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("upload_to", "files/")
        super().__init__(*args, **kwargs)


class CustomCharField(models.CharField):
    """Custom Char Field Having min_length attributes."""

    def __init__(self, min_length=None, actual_length=None, *args, **kwargs):
        """Overridden to set min_length attributes & validation"""

        self.min_length = min_length
        self.actual_length = actual_length
        super().__init__(*args, **kwargs)
        # custom validation to validate the length
        if self.min_length is not None:
            self.validators.append(MinLengthValidator(self.min_length))

    def deconstruct(self):
        """Using deconstruct method to reconstruct the `min_length` attribute to model argument value."""

        name, path, args, kwargs = super().deconstruct()
        kwargs["min_length"] = self.min_length
        return name, path, args, kwargs

    def check(self, **kwargs):
        """Check whether the `min_length` attribute is set."""

        return [
            # check the inbuilt attribute validations
            *super().check(**kwargs),
            # validates min_length attribute
            *self._check_min_length_attribute(**kwargs),
        ]

    def _check_min_length_attribute(self, **kwargs):
        """Function to validate the type & size of `min_length` attribute."""

        if self.min_length is None:
            return []
        if not isinstance(self.min_length, int) or isinstance(self.min_length, bool) or self.min_length <= 0:
            return [
                checks.Error(
                    "'min_length' must be a positive integer.",
                    obj=self,
                    id="fields.E121",
                ),
            ]
        return []
