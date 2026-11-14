from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import UserManager
from django.core.exceptions import MultipleObjectsReturned, ObjectDoesNotExist, ValidationError
from django.db.models import QuerySet


class BaseQuerysetMethods:
    """
    A base class to include common queryset methods.
    Can be inherited in any queryset class to include these methods.
    """

    def get_or_none(self, *args, **kwargs):
        """
        Get the object based on the given **kwargs. If not present returns None.
        Note: Expects a single instance.
        """

        try:
            return self.get(*args, **kwargs)
        # if does not exist or if idiotic values like id=None is passed
        except (
            ObjectDoesNotExist,
            AttributeError,
            ValueError,
            MultipleObjectsReturned,
            ValidationError,  # invalid UUID
        ):
            return None


class CustomUserManager(UserManager, BaseQuerysetMethods):
    """
    Custom user manager class extending the `UserManager` class.
    Updated the username is not required as email is used for authentication.
    Can add more custom methods if required in the future.
    """

    def _create_user_object(self, username, email, password, **extra_fields):
        """Override to drop the username requirement, as email is used for authentication."""

        if not email:
            raise ValueError("Email must be set")
        user = self.model(email=self.normalize_email(email), **extra_fields)
        user.password = make_password(password)
        return user


class BaseObjectManagerQuerySet(QuerySet, BaseQuerysetMethods):
    """
    The main/base manager for the apps models. This is used for including common
    model filters and methods. This is used just to make things DRY.
    This can be used in both ways:
        1. Model.app_objects.custom_method()
        2. Model.app_objects.filter().custom_method()
    Reference:
    https://stackoverflow.com/questions/2163151/custom-queryset-and-manager-without-breaking-dry#answer-21757519
    Usage on the model class
        objects = BaseObjectManagerQuerySet.as_manager()
    Available methods -
        get_or_none
    """
