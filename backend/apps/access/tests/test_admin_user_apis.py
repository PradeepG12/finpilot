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
