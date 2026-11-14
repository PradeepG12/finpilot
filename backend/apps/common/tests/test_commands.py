from io import StringIO

from django.core.management import call_command
from django.test import override_settings

from apps.access.models import User
from apps.common.tests.base import AppTestCase

SUPER_ADMIN_EMAIL = "super-admin@example.com"


@override_settings(SUPER_ADMIN_EMAIL=SUPER_ADMIN_EMAIL)
class InitAppCommandTestCase(AppTestCase):
    """Tests the `init_app` command's super admin bootstrapping."""

    def test_creates_super_admin_once(self):
        """Running the command twice leaves exactly one super admin behind."""

        call_command("init_app", stdout=StringIO())
        call_command("init_app", stdout=StringIO())
        super_admins = User.objects.filter(email=SUPER_ADMIN_EMAIL)
        self.assertEqual(super_admins.count(), 1)
        self.assertTrue(super_admins.first().is_superuser)
