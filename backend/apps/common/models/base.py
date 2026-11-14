import os
import uuid
from contextlib import suppress

from django.conf import settings
from django.core.exceptions import FieldDoesNotExist
from django.db import models

from apps.common.helpers import storage_file_path
from apps.common.managers import BaseObjectManagerQuerySet
from apps.common.model_fields import AppFileField, AppImageField

# top level config
COMMON_NAME_MAX_LENGTH = 100
COMMON_CHAR_FIELD_MAX_LENGTH = 512
COMMON_MIN_LENGTH_PASSWORD = 8
COMMON_NULLABLE_FIELD_CONFIG = {  # user for API based stuff
    "default": None,
    "null": True,
}
COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG = {  # user for Form/app based stuff
    **COMMON_NULLABLE_FIELD_CONFIG,
    "blank": True,
}
COMMON_CHOICE_FIELD_MAX_LENGTH = 64
COMMON_CURRENCY_MAX_DIGITS = 12
COMMON_CURRENCY_DECIMAL_PLACES = 5

# FinPilot money constants — use these for all financial fields; do NOT reuse COMMON_CURRENCY_* above
MONEY_MAX_DIGITS = 18
MONEY_DECIMAL_PLACES = 2  # amounts, targets
PRICE_DECIMAL_PLACES = 4  # price, avg_cost, last_price
QUANTITY_DECIMAL_PLACES = 6


class AbstractBaseModel(models.Model):
    """
    Basemodel to store the common fields for `the project`.

    ********************* Model Fields *********************
        PK          - id
        Unique      - uuid
        Datetime    - created, modified

    Class Methods:
      - get_model_fields, get_all_model_fields, get_model_field_names, get_model_field
    """

    class Meta:
        ordering = ["-created"]
        abstract = True

    uuid = models.UUIDField(default=uuid.uuid4, unique=True)
    created = models.DateTimeField(auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    objects = BaseObjectManagerQuerySet.as_manager()

    @classmethod
    def get_model_fields(cls):
        """
        Returns all the model fields. This does not
        include the defined M2M & related fields.
        """

        return cls._meta.fields

    @classmethod
    def get_all_model_fields(cls):
        """
        Returns all model fields, this includes M2M and related fields.
        Note: The field classes will be different & additional here.
        """

        return cls._meta.get_fields()

    @classmethod
    def get_model_field_names(cls, exclude=[]):  # noqa
        """Return a list of model field names, excluding any names in `exclude`."""

        return [_.name for _ in cls.get_model_fields() if _.name not in exclude]

    @classmethod
    def get_model_field(cls, field_name, fallback=None):
        """Returns a single model field given by `field_name`."""

        with suppress(FieldDoesNotExist):
            return cls._meta.get_field(field_name)

        return fallback

    def __str__(self):
        return f"{self.__class__.__name__} - {self.pk}"


class AbstractBaseCMModel(AbstractBaseModel):
    """
    Basemodel to track the created & modified user for any model.

    ********************* Model Fields *********************
        PK          - id
        Unique      - uuid
        FK          - created_by, modified_by
        Datetime    - created, modified

    Available Class Methods:
        - get_model_fields, get_all_model_fields, get_model_field_names, get_model_field
    """

    class Meta(AbstractBaseModel.Meta):
        abstract = True

    # by whom
    created_by = models.ForeignKey(
        to=settings.AUTH_USER_MODEL,
        related_name="created_%(class)s",
        on_delete=models.SET_DEFAULT,
        **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG,
    )
    modified_by = models.ForeignKey(
        to=settings.AUTH_USER_MODEL,
        related_name="modified_by_%(class)s",
        on_delete=models.SET_DEFAULT,
        **COMMON_BLANK_AND_NULLABLE_FIELD_CONFIG,
    )


class AbstractImageOnlyModel(AbstractBaseCMModel):
    """
    Base Abstract Model for Image Upload.
    Contains a property to return the image url

    ********************* Model Fields *********************
        PK          - id
        Unique      - uuid
        FK          - created_by, modified_by
        ImageField  - image
        Datetime    - created, modified

    Available Class Methods:
        - get_model_fields, get_all_model_fields, get_model_field_names, get_model_field
    Properties:
        - file_url
    """

    class Meta(AbstractBaseCMModel.Meta):
        abstract = True

    image = AppImageField(
        max_length=COMMON_CHAR_FIELD_MAX_LENGTH,
        max_size=5,
        upload_to=storage_file_path,
    )

    @property
    def file_url(self):
        """Returns the image url."""

        return self.image.url


class AbstractFileUploadModel(AbstractBaseCMModel):
    """
    Base Abstract Model for File Upload.
    Contains a property to return the file url

    ********************* Model Fields *********************
        PK          - id
        Unique      - uuid
        FK          - created_by, modified_by
        Char        - identity
        file        - file
        Datetime    - created, modified

    Available Class Methods:
        - get_model_fields, get_all_model_fields, get_model_field_names, get_model_field
    Properties:
        - file_name, file_type, file_size, file_url
    """

    class Meta(AbstractBaseCMModel.Meta):
        abstract = True

    file = AppFileField(
        upload_to=storage_file_path,
        max_size=5,
        max_length=COMMON_CHAR_FIELD_MAX_LENGTH,
    )

    @property
    def file_name(self):
        """Returns the file name without the base folder name."""

        return self.file.name.split("/")[-1]

    @property
    def file_type(self):
        """Returns the file extension."""

        return os.path.splitext(self.file.name)[1].split(".")[-1]

    @property
    def file_size(self):
        """Returns the file size."""

        try:
            return self.file.size
        except Exception:
            return 0

    @property
    def file_url(self):
        """Returns the image url."""

        return self.file.url
