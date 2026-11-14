"""Base test cases and helpers for the FinPilot test suite."""

import itertools

from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.access.config import UserTypeChoices
from apps.access.models import User

DEFAULT_TEST_PASSWORD = "test-password-123"
BASE_TEST_PHONE_NUMBER = 971500000000

_user_counter = itertools.count(1)


def create_user(**overrides):
    """Creates and returns a persisted user with test-safe defaults for the required fields."""

    unique_suffix = next(_user_counter)
    defaults = {
        "email": f"test-user-{unique_suffix}@example.com",
        "phone_number": f"+{BASE_TEST_PHONE_NUMBER + unique_suffix}",
        "user_type": UserTypeChoices.viewer,
        "full_name": "Test User",
        "password": DEFAULT_TEST_PASSWORD,
    }
    defaults.update(overrides)
    return User.objects.create_user(username=None, **defaults)


class AppTestCase(APITestCase):
    """Base test case for model and serializer tests that need database access without authentication."""


class AppAPITestCase(AppTestCase):
    """Base test case for API tests, providing JWT authentication and response-envelope assertions."""

    def authenticate(self, user=None):
        """Authenticates the test client as the given user using a JWT access token."""

        user = user or create_user()
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
        return user

    def logout(self):
        """Clears any authentication credentials from the test client."""

        self.client.credentials()

    def assert_success(self, response, status_code=status.HTTP_200_OK):
        """Asserts a successful response envelope and returns its data payload."""

        self.assertEqual(response.status_code, status_code, response.data)
        self.assertEqual(response.data["status"], "success", response.data)
        return response.data["data"]

    def assert_error(self, response, status_code=status.HTTP_400_BAD_REQUEST):
        """Asserts an error response envelope and returns its data payload."""

        self.assertEqual(response.status_code, status_code, response.data)
        self.assertEqual(response.data["status"], "error", response.data)
        return response.data["data"]
