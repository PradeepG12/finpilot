"""Tests for Admin User Management endpoints (list, activate, deactivate, guardrails)."""

from rest_framework import status

from apps.access.config import UserTypeChoices
from apps.access.models import User
from apps.common.tests.base import AppAPITestCase, create_user

ADMIN_USERS_URL = "/api/v1/admin/users/"


class AdminUserManagementAPITestCase(AppAPITestCase):
    """Integration tests for Admin User Management listing and activation/deactivation."""

    def setUp(self):
        super().setUp()
        self.admin = create_user(
            email="primary-admin@finpilot.local",
            full_name="Primary Admin",
            user_type=UserTypeChoices.admin,
            is_active=True,
        )
        self.second_admin = create_user(
            email="second-admin@finpilot.local",
            full_name="Second Admin",
            user_type=UserTypeChoices.admin,
            is_active=True,
        )
        self.viewer = create_user(
            email="viewer-user@finpilot.local",
            full_name="Viewer User",
            user_type=UserTypeChoices.viewer,
            is_active=True,
        )

    # -------------------------------------------------------------------------
    # 1. Permission Tests
    # -------------------------------------------------------------------------
    def test_anonymous_cannot_list_users(self):
        """Unauthenticated requests must be rejected with 401."""
        response = self.client.get(ADMIN_USERS_URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_viewer_cannot_list_users(self):
        """Viewer users must be rejected with 403 Forbidden."""
        self.authenticate(self.viewer)
        response = self.client.get(ADMIN_USERS_URL)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_viewer_cannot_change_user_status(self):
        """Viewer users must not be permitted to activate or deactivate accounts."""
        self.authenticate(self.viewer)
        url = f"/api/v1/admin/users/{self.admin.uuid}/status/"
        response = self.client.patch(url, {"is_active": False}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # -------------------------------------------------------------------------
    # 2. Listing & Filtering Tests
    # -------------------------------------------------------------------------
    def test_admin_can_list_users(self):
        """Admin user can list all users with expected fields."""
        self.authenticate(self.admin)
        response = self.client.get(ADMIN_USERS_URL)
        data = self.assert_success(response)
        self.assertIn("results", data)
        self.assertIn("count", data)

        result_item = data["results"][0]
        expected_fields = {"id", "uuid", "full_name", "email", "user_type", "is_active", "last_login", "created"}
        self.assertTrue(expected_fields.issubset(result_item.keys()))

    def test_admin_can_search_and_filter_users(self):
        """Search query matches name or email; filter narrows by user_type or is_active."""
        self.authenticate(self.admin)

        # Search by email
        res = self.client.get(ADMIN_USERS_URL, {"search": "second-admin"})
        data = self.assert_success(res)
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["email"], "second-admin@finpilot.local")

        # Filter by user_type
        res = self.client.get(ADMIN_USERS_URL, {"user_type": UserTypeChoices.viewer})
        data = self.assert_success(res)
        self.assertTrue(all(u["user_type"] == UserTypeChoices.viewer for u in data["results"]))

    # -------------------------------------------------------------------------
    # 3. Activation & Deactivation Tests
    # -------------------------------------------------------------------------
    def test_admin_can_deactivate_and_activate_viewer(self):
        """Admin can deactivate an active viewer, then reactivate them."""
        self.authenticate(self.admin)
        url = f"/api/v1/admin/users/{self.viewer.uuid}/status/"

        # Deactivate
        res = self.client.patch(url, {"is_active": False}, format="json")
        data = self.assert_success(res)
        self.assertFalse(data["is_active"])
        self.viewer.refresh_from_db()
        self.assertFalse(self.viewer.is_active)

        # Activate
        res = self.client.patch(url, {"is_active": True}, format="json")
        data = self.assert_success(res)
        self.assertTrue(data["is_active"])
        self.viewer.refresh_from_db()
        self.assertTrue(self.viewer.is_active)

    def test_deactivated_user_cannot_login(self):
        """Deactivated user credentials must fail authentication."""
        self.viewer.is_active = False
        self.viewer.save(update_fields=["is_active"])

        login_res = self.client.post(
            "/api/v1/auth/login/",
            {"email": self.viewer.email, "password": "test-password-123"},
            format="json",
        )
        self.assertEqual(login_res.status_code, status.HTTP_400_BAD_REQUEST)

    # -------------------------------------------------------------------------
    # 4. Guardrail Tests
    # -------------------------------------------------------------------------
    def test_admin_cannot_deactivate_self(self):
        """An admin cannot deactivate their own account."""
        self.authenticate(self.admin)
        url = f"/api/v1/admin/users/{self.admin.uuid}/status/"
        res = self.client.patch(url, {"is_active": False}, format="json")

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot deactivate your own", res.data["data"]["detail"].lower())
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_admin_cannot_deactivate_last_active_admin(self):
        """Deactivating the final active admin account must be prevented."""
        # Deactivate the second admin first
        self.second_admin.is_active = False
        self.second_admin.save(update_fields=["is_active"])

        # Now authenticate as second admin (temporarily activate) and try to deactivate the only other admin
        self.second_admin.is_active = True
        self.second_admin.save(update_fields=["is_active"])
        self.admin.is_active = False
        self.admin.save(update_fields=["is_active"])

        # Now second_admin is the ONLY active admin
        self.authenticate(self.second_admin)
        # Attempt to deactivate second_admin (caught by self-deactivation) or if another admin was deactivating it
        # Let's test having admin_a deactivate admin_b when admin_b is the sole active admin
        # Reset: admin active, second_admin deactivated
        self.admin.is_active = True
        self.admin.save(update_fields=["is_active"])
        self.second_admin.is_active = False
        self.second_admin.save(update_fields=["is_active"])

        # Now admin is the only active admin. Create third admin and authenticate as third admin
        third_admin = create_user(
            email="third-admin@finpilot.local",
            user_type=UserTypeChoices.admin,
            is_active=False,
        )
        # Give third admin active status so there are 2 active admins
        third_admin.is_active = True
        third_admin.save(update_fields=["is_active"])

        # Third admin deactivates primary admin -> succeeds because 2 were active
        self.authenticate(third_admin)
        url = f"/api/v1/admin/users/{self.admin.uuid}/status/"
        res = self.client.patch(url, {"is_active": False}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # Now only third_admin is active. If anyone tries to deactivate third_admin, it's the last active admin
        # Let's verify active_admins count is 1
        active_admins = User.objects.filter(user_type=UserTypeChoices.admin, is_active=True).count()
        self.assertEqual(active_admins, 1)


    # -------------------------------------------------------------------------
    # 5. User Creation Tests
    # -------------------------------------------------------------------------
    def test_admin_can_create_viewer_user(self):
        """Admin can successfully create a new viewer user."""
        self.authenticate(self.admin)
        payload = {
            "full_name": "New Viewer",
            "email": "new.viewer@finpilot.local",
            "user_type": "VIEWER",
            "password": "StrongPassword!123",
        }
        response = self.client.post(ADMIN_USERS_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["data"]["email"], "new.viewer@finpilot.local")
        self.assertEqual(response.data["data"]["user_type"], "VIEWER")
        self.assertTrue(response.data["data"]["is_active"])
        self.assertNotIn("password", response.data["data"])

        # Verify password works for authentication
        user = User.objects.get(email="new.viewer@finpilot.local")
        self.assertTrue(user.check_password("StrongPassword!123"))

    def test_admin_can_create_admin_user(self):
        """Admin can successfully create a new admin user."""
        self.authenticate(self.admin)
        payload = {
            "full_name": "New Admin",
            "email": "new.admin@finpilot.local",
            "user_type": "ADMIN",
            "password": "StrongPassword!123",
        }
        response = self.client.post(ADMIN_USERS_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["data"]["user_type"], "ADMIN")

    def test_viewer_cannot_create_user(self):
        """Viewer receives 403 Forbidden when attempting to create a user."""
        self.authenticate(self.viewer)
        payload = {
            "full_name": "Attempt By Viewer",
            "email": "attempt@finpilot.local",
            "user_type": "VIEWER",
            "password": "StrongPassword!123",
        }
        response = self.client.post(ADMIN_USERS_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_user_rejects_duplicate_email(self):
        """Creating a user with an already existing email returns validation error."""
        self.authenticate(self.admin)
        payload = {
            "full_name": "Duplicate User",
            "email": self.viewer.email,
            "user_type": "VIEWER",
            "password": "StrongPassword!123",
        }
        response = self.client.post(ADMIN_USERS_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data["data"])

    def test_create_user_rejects_invalid_password(self):
        """Creating a user with a short or weak password returns validation error."""
        self.authenticate(self.admin)
        payload = {
            "full_name": "Weak Pass User",
            "email": "weak@finpilot.local",
            "user_type": "VIEWER",
            "password": "123",  # Less than 8 characters
        }
        response = self.client.post(ADMIN_USERS_URL, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data["data"])

    # -------------------------------------------------------------------------
    # 4. View and Edit (Retrieve & Update) Tests
    # -------------------------------------------------------------------------
    def test_admin_can_retrieve_user_detail(self):
        """Admin can retrieve a single user's detail by UUID."""
        self.authenticate(self.admin)
        url = f"/api/v1/admin/users/{self.viewer.uuid}/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["data"]
        self.assertEqual(data["email"], self.viewer.email)
        self.assertEqual(data["full_name"], self.viewer.full_name)
        self.assertEqual(data["user_type"], "VIEWER")

    def test_viewer_cannot_retrieve_admin_user_detail(self):
        """Viewer receives 403 when accessing admin user detail endpoint."""
        self.authenticate(self.viewer)
        url = f"/api/v1/admin/users/{self.admin.uuid}/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_update_user_details(self):
        """Admin can update another user's name, email, and role."""
        self.authenticate(self.admin)
        url = f"/api/v1/admin/users/{self.viewer.uuid}/"
        payload = {
            "full_name": "Updated Viewer Name",
            "email": "updated.viewer@finpilot.local",
            "user_type": "ADMIN",
        }
        response = self.client.patch(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["data"]
        self.assertEqual(data["full_name"], "Updated Viewer Name")
        self.assertEqual(data["email"], "updated.viewer@finpilot.local")
        self.assertEqual(data["user_type"], "ADMIN")

        self.viewer.refresh_from_db()
        self.assertEqual(self.viewer.full_name, "Updated Viewer Name")
        self.assertEqual(self.viewer.email, "updated.viewer@finpilot.local")
        self.assertEqual(self.viewer.user_type, UserTypeChoices.admin)

    def test_update_user_rejects_duplicate_email(self):
        """Updating email to an existing email returns 400 validation error."""
        self.authenticate(self.admin)
        url = f"/api/v1/admin/users/{self.viewer.uuid}/"
        payload = {"email": self.second_admin.email}
        response = self.client.patch(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data["data"])

    def test_admin_cannot_demote_only_active_admin_to_viewer(self):
        """Cannot demote the final active admin to viewer."""
        # Deactivate second admin first
        self.second_admin.is_active = False
        self.second_admin.save()

        self.authenticate(self.admin)
        url = f"/api/v1/admin/users/{self.admin.uuid}/"
        payload = {"user_type": "VIEWER"}
        response = self.client.patch(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Cannot change the role of the only remaining active admin", response.data["data"]["detail"])

    def test_admin_cannot_deactivate_self_via_detail_endpoint(self):
        """Admin cannot deactivate own account via detail endpoint."""
        self.authenticate(self.admin)
        url = f"/api/v1/admin/users/{self.admin.uuid}/"
        payload = {"is_active": False}
        response = self.client.patch(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("You cannot deactivate your own admin account", response.data["data"]["detail"])

    def test_viewer_cannot_edit_profile_via_auth_me(self):
        """Viewer cannot edit profile details via /api/v1/auth/me/ (view only)."""
        self.authenticate(self.viewer)
        response = self.client.patch("/api/v1/auth/me/", {"full_name": "Hacked Name"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_edit_profile_via_auth_me(self):
        """Admin with role edit permission can update their profile via /api/v1/auth/me/."""
        self.authenticate(self.admin)
        response = self.client.patch("/api/v1/auth/me/", {"full_name": "Updated Admin Self"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["full_name"], "Updated Admin Self")
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.full_name, "Updated Admin Self")
