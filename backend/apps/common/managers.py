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
        except (
            ObjectDoesNotExist,
            AttributeError,
            ValueError,
            MultipleObjectsReturned,
            ValidationError,
        ):
            return None


class CustomUserManager(UserManager, BaseQuerysetMethods):
    """
    Custom user manager class extending the `UserManager` class.
    Email is used for authentication instead of username.
    """

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("The given email must be set")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.password = make_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.pop("username", None)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        # Accept username if passed as kwarg or arg and discard cleanly
        extra_fields.pop("username", None)
        return self._create_user(email, password, **extra_fields)


class BaseObjectManagerQuerySet(QuerySet, BaseQuerysetMethods):
    """
    Common queryset class for models.
    """
    pass


class BaseObjectManager(CustomUserManager):
    """
    Common object manager class for models.
    """
    pass
