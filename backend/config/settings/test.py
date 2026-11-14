"""Test settings."""

from config.settings.base import *  # noqa: F401, F403

DEBUG = False
ALLOWED_HOSTS = ["*"]

# Faster password hashing in tests
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Disable throttling in tests
REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] = []  # noqa: F405

DATABASES["default"]["NAME"] = env.str("TEST_POSTGRES_DB", default="finpilot_test")  # noqa: F405
DATABASES["default"]["HOST"] = env.str("TEST_POSTGRES_HOST", default=DATABASES["default"]["HOST"])  # noqa: F405
DATABASES["default"]["PORT"] = env.str("TEST_POSTGRES_PORT", default=DATABASES["default"]["PORT"])  # noqa: F405
DATABASES["default"]["USER"] = env.str("TEST_POSTGRES_USER", default=DATABASES["default"]["USER"])  # noqa: F405
DATABASES["default"]["PASSWORD"] = env.str("TEST_POSTGRES_PASSWORD", default=DATABASES["default"]["PASSWORD"])  # noqa: F405
