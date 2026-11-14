from rest_framework import status

from apps.access.config import UserTypeChoices
from apps.access.models import User
from apps.common.tests.base import AppAPITestCase, create_user

USER_LIST_URL = "/api/access/user/list/"
USER_CUD_URL = "/api/access/user/cud/"
USER_PROFILE_URL = "/api/access/user/profile/"


class UserListAPITestCase(AppAPITestCase):
    """Tests the user list endpoint."""

    def test_list_returns_users(self):
        """An authenticated request lists the existing users."""

        self.authenticate()
        create_user()
        data = self.assert_success(self.client.get(USER_LIST_URL))
        self.assertEqual(len(data["results"]), User.objects.count())

    def test_list_filters_by_user_type(self):
        """The `user_type` filter narrows the results to the matching users."""

        self.authenticate(create_user(user_type=UserTypeChoices.staff))
        create_user(user_type=UserTypeChoices.admin)
        data = self.assert_success(self.client.get(USER_LIST_URL, {"user_type": UserTypeChoices.admin}))
        self.assertEqual(len(data["results"]), 1)

    def test_list_requires_authentication(self):
        """An anonymous request cannot list users."""

        self.assertEqual(self.client.get(USER_LIST_URL).status_code, status.HTTP_401_UNAUTHORIZED)


class UserCUDAPITestCase(AppAPITestCase):
    """Tests the user create, update and delete endpoints."""

    def test_create_user_hashes_the_password(self):
        """A created user's password is stored as a hash, never as raw text."""

        self.authenticate()
        payload = {
            "email": "new-user@example.com",
            "full_name": "New User",
            "phone_number": "+971500009999",
            "user_type": UserTypeChoices.staff,
            "profile_picture": None,
            "password": "created-password-1",
        }
        self.assert_success(self.client.post(USER_CUD_URL, payload, format="json"), status.HTTP_201_CREATED)
        created_user = User.objects.get(email="new-user@example.com")
        self.assertNotEqual(created_user.password, "created-password-1")
        self.assertTrue(created_user.check_password("created-password-1"))

    def test_create_user_rejects_duplicate_email(self):
        """An email already in use is rejected."""

        self.authenticate()
        existing_user = create_user()
        payload = {
            "email": existing_user.email,
            "full_name": "Duplicate User",
            "phone_number": "+971500008888",
            "user_type": UserTypeChoices.staff,
            "profile_picture": None,
            "password": "created-password-1",
        }
        self.assert_error(self.client.post(USER_CUD_URL, payload, format="json"))

    def test_update_user_changes_full_name(self):
        """An update persists the edited fields."""

        self.authenticate()
        user = create_user()
        payload = {
            "full_name": "Updated Name",
            "phone_number": str(user.phone_number),
            "user_type": UserTypeChoices.staff,
            "profile_picture": None,
            "is_active": True,
        }
        self.assert_success(self.client.put(f"{USER_CUD_URL}{user.uuid}/", payload, format="json"))
        user.refresh_from_db()
        self.assertEqual(user.full_name, "Updated Name")

    def test_delete_user(self):
        """A delete removes the user record."""

        self.authenticate()
        user = create_user()
        self.client.delete(f"{USER_CUD_URL}{user.uuid}/")
        self.assertFalse(User.objects.filter(pk=user.pk).exists())


class UserProfileAPITestCase(AppAPITestCase):
    """Tests the authenticated user's profile endpoint."""

    def test_profile_returns_the_requesting_user(self):
        """The profile endpoint returns the authenticated user's own record."""

        user = self.authenticate()
        data = self.assert_success(self.client.get(USER_PROFILE_URL))
        self.assertEqual(data["email"], user.email)

    def test_profile_requires_authentication(self):
        """An anonymous request cannot read a profile."""

        self.assertEqual(self.client.get(USER_PROFILE_URL).status_code, status.HTTP_401_UNAUTHORIZED)
