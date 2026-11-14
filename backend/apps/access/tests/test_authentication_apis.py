from rest_framework import status
from rest_framework.authtoken.models import Token

from apps.common.tests.base import DEFAULT_TEST_PASSWORD, AppAPITestCase, create_user

LOGIN_URL = "/api/auth/login/"
LOGOUT_URL = "/api/auth/logout/"
CHANGE_PASSWORD_URL = "/api/auth/change-password/"


class LoginAPITestCase(AppAPITestCase):
    """Tests the email and password login endpoint."""

    def test_login_with_valid_credentials_returns_token(self):
        """A valid email and password pair issues a usable auth token."""

        user = create_user()
        response = self.client.post(LOGIN_URL, {"email": user.email, "password": DEFAULT_TEST_PASSWORD})
        data = self.assert_success(response)
        self.assertEqual(data["token"], Token.objects.get(user=user).key)
        self.assertEqual(data["user"]["email"], user.email)

    def test_login_with_invalid_password_fails(self):
        """A wrong password is rejected and issues no token."""

        user = create_user()
        response = self.client.post(LOGIN_URL, {"email": user.email, "password": "wrong-password"})
        self.assert_error(response)
        self.assertFalse(Token.objects.filter(user=user).exists())

    def test_login_rotates_the_existing_token(self):
        """Logging in again replaces the previously issued token."""

        user = create_user()
        stale_token = Token.objects.create(user=user)
        response = self.client.post(LOGIN_URL, {"email": user.email, "password": DEFAULT_TEST_PASSWORD})
        data = self.assert_success(response)
        self.assertNotEqual(data["token"], stale_token.key)
        self.assertFalse(Token.objects.filter(key=stale_token.key).exists())

    def test_login_of_inactive_user_fails(self):
        """An inactive account cannot log in."""

        user = create_user(is_active=False)
        response = self.client.post(LOGIN_URL, {"email": user.email, "password": DEFAULT_TEST_PASSWORD})
        self.assert_error(response)


class LogoutAPITestCase(AppAPITestCase):
    """Tests the logout endpoint."""

    def test_logout_deletes_the_token(self):
        """Logging out invalidates the auth token of the requesting user."""

        user = self.authenticate()
        self.assert_success(self.client.post(LOGOUT_URL))
        self.assertFalse(Token.objects.filter(user=user).exists())

    def test_logout_requires_authentication(self):
        """An anonymous request cannot log out."""

        response = self.client.post(LOGOUT_URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class ChangePasswordAPITestCase(AppAPITestCase):
    """Tests the change password endpoint."""

    def test_change_password_updates_and_rotates_token(self):
        """A valid change sets the new password and issues a fresh token."""

        user = self.authenticate()
        old_token = Token.objects.get(user=user)
        payload = {"current_password": DEFAULT_TEST_PASSWORD, "new_password": "new-password-456"}
        data = self.assert_success(self.client.post(CHANGE_PASSWORD_URL, payload))
        user.refresh_from_db()
        self.assertTrue(user.check_password("new-password-456"))
        self.assertNotEqual(data["token"], old_token.key)

    def test_change_password_with_wrong_current_password_fails(self):
        """An incorrect current password leaves the stored password untouched."""

        user = self.authenticate()
        payload = {"current_password": "wrong-password", "new_password": "new-password-456"}
        self.assert_error(self.client.post(CHANGE_PASSWORD_URL, payload))
        user.refresh_from_db()
        self.assertTrue(user.check_password(DEFAULT_TEST_PASSWORD))

    def test_change_password_rejects_reusing_current_password(self):
        """The new password must differ from the current one."""

        self.authenticate()
        payload = {"current_password": DEFAULT_TEST_PASSWORD, "new_password": DEFAULT_TEST_PASSWORD}
        self.assert_error(self.client.post(CHANGE_PASSWORD_URL, payload))
