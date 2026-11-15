"""Integration tests for Account listing, search, filtering, and sorting."""

import datetime
from decimal import Decimal

from rest_framework import status

from apps.access.config import UserTypeChoices
from apps.common.tests.base import AppAPITestCase, create_user
from apps.customers.models import Customer
from apps.investments.models import Account, HoldingSnapshot, Instrument

ACCOUNTS_URL = "/api/v1/accounts/"


class AccountAPITestCase(AppAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin_user = create_user(
            email="admin_acc@finpilot.local",
            full_name="Admin Acc",
            user_type=UserTypeChoices.admin,
            is_active=True,
        )
        self.viewer_user = create_user(
            email="viewer_acc@finpilot.local",
            full_name="Viewer Acc",
            user_type=UserTypeChoices.viewer,
            is_active=True,
        )

        self.c1 = Customer.objects.create(
            customer_code="C0001",
            full_name="Aarav Sharma",
            email="aarav@test.local",
            phone="+919876543210",
            kyc_status="VERIFIED",
            segment="HNI",
        )
        self.c2 = Customer.objects.create(
            customer_code="C0002",
            full_name="Deepa Patel",
            email="deepa@test.local",
            phone="+919876543211",
            kyc_status="PENDING",
            segment="MASS",
        )

        self.a1 = Account.objects.create(
            account_code="A0001",
            customer=self.c1,
            account_type="BROKERAGE",
            provider="Harbor Investments",
            status="ACTIVE",
            opened_at=datetime.date(2022, 1, 15),
        )
        self.a2 = Account.objects.create(
            account_code="A0002",
            customer=self.c1,
            account_type="MUTUAL_FUND",
            provider="BlueRiver MF",
            status="DORMANT",
            opened_at=datetime.date(2023, 5, 20),
        )
        self.a3 = Account.objects.create(
            account_code="A0003",
            customer=self.c2,
            account_type="RETIREMENT",
            provider="NorthStar Securities",
            status="CLOSED",
            opened_at=datetime.date(2024, 8, 10),
        )

        # Instruments and Holdings for a1 and a2
        self.i1 = Instrument.objects.create(
            instrument_code="I0001",
            symbol="RELIANCE",
            instrument_name="Reliance Industries",
            asset_class="EQUITY",
            exchange="NSE",
            last_price=Decimal("2500.00"),
            risk_band="MEDIUM",
        )
        self.i2 = Instrument.objects.create(
            instrument_code="I0002",
            symbol="HDFCBANK",
            instrument_name="HDFC Bank",
            asset_class="EQUITY",
            exchange="NSE",
            last_price=Decimal("1500.00"),
            risk_band="LOW",
        )

        # a1 has 10 of i1 (10 * 2500 = 25000.00)
        HoldingSnapshot.objects.create(
            account=self.a1,
            instrument=self.i1,
            quantity=Decimal("10.0000"),
            avg_cost=Decimal("2400.0000"),
            snapshot_date=datetime.date(2026, 9, 18),
        )
        # a2 has 5 of i2 (5 * 1500 = 7500.00)
        HoldingSnapshot.objects.create(
            account=self.a2,
            instrument=self.i2,
            quantity=Decimal("5.0000"),
            avg_cost=Decimal("1450.0000"),
            snapshot_date=datetime.date(2026, 9, 18),
        )

    def test_unauthenticated_request_rejected(self):
        """Unauthenticated requests are denied."""
        response = self.client.get(ACCOUNTS_URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_can_list_accounts(self):
        """ADMIN user can list accounts and receives correct payload."""
        self.authenticate(self.admin_user)
        response = self.client.get(ACCOUNTS_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["data"]["results"]
        self.assertEqual(len(results), 3)

        a1_data = next(r for r in results if r["account_code"] == "A0001")
        self.assertEqual(a1_data["customer_code"], "C0001")
        self.assertEqual(a1_data["customer_name"], "Aarav Sharma")
        self.assertEqual(a1_data["account_type"], "BROKERAGE")
        self.assertEqual(a1_data["provider"], "Harbor Investments")
        self.assertEqual(a1_data["status"], "ACTIVE")
        self.assertEqual(a1_data["opened_at"], "2022-01-15")
        self.assertEqual(Decimal(a1_data["current_market_value"]), Decimal("25000.00"))

    def test_viewer_can_list_accounts(self):
        """VIEWER user can also list accounts."""
        self.authenticate(self.viewer_user)
        response = self.client.get(ACCOUNTS_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["data"]["results"]), 3)

    def test_search_by_account_code_customer_name_code_and_provider(self):
        """Search matches account code, customer code, customer name, and provider."""
        self.authenticate(self.viewer_user)

        # By account code
        res = self.client.get(f"{ACCOUNTS_URL}?search=A0003")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        codes = [r["account_code"] for r in res.data["data"]["results"]]
        self.assertEqual(codes, ["A0003"])

        # By customer code
        res = self.client.get(f"{ACCOUNTS_URL}?search=C0002")
        codes = [r["account_code"] for r in res.data["data"]["results"]]
        self.assertEqual(codes, ["A0003"])

        # By customer name
        res = self.client.get(f"{ACCOUNTS_URL}?search=Aarav")
        codes = [r["account_code"] for r in res.data["data"]["results"]]
        self.assertIn("A0001", codes)
        self.assertIn("A0002", codes)
        self.assertNotIn("A0003", codes)

        # By provider
        res = self.client.get(f"{ACCOUNTS_URL}?search=NorthStar")
        codes = [r["account_code"] for r in res.data["data"]["results"]]
        self.assertEqual(codes, ["A0003"])

    def test_filter_by_type_status_and_provider(self):
        """Filters by account_type, status, and provider."""
        self.authenticate(self.viewer_user)

        # By type
        res = self.client.get(f"{ACCOUNTS_URL}?account_type=BROKERAGE")
        codes = [r["account_code"] for r in res.data["data"]["results"]]
        self.assertEqual(codes, ["A0001"])

        # By status
        res = self.client.get(f"{ACCOUNTS_URL}?status=DORMANT")
        codes = [r["account_code"] for r in res.data["data"]["results"]]
        self.assertEqual(codes, ["A0002"])

        # By provider
        res = self.client.get(f"{ACCOUNTS_URL}?provider=BlueRiver MF")
        codes = [r["account_code"] for r in res.data["data"]["results"]]
        self.assertEqual(codes, ["A0002"])

    def test_sorting(self):
        """Sorting works for account_code, customer, current_market_value, and opened_at."""
        self.authenticate(self.viewer_user)

        # Sort by current_market_value descending
        res = self.client.get(f"{ACCOUNTS_URL}?ordering=-current_market_value")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        codes = [r["account_code"] for r in res.data["data"]["results"]]
        self.assertEqual(codes[0], "A0001")  # 25000 is highest

        # Sort by opened_at ascending
        res = self.client.get(f"{ACCOUNTS_URL}?ordering=opened_at")
        codes = [r["account_code"] for r in res.data["data"]["results"]]
        self.assertEqual(codes, ["A0001", "A0002", "A0003"])

    def test_providers_and_lookup_endpoints(self):
        """The providers and lookup actions return expected collections."""
        self.authenticate(self.viewer_user)

        res = self.client.get(f"{ACCOUNTS_URL}providers/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        providers = res.data["data"]
        self.assertIn("Harbor Investments", providers)
        self.assertIn("BlueRiver MF", providers)
        self.assertIn("NorthStar Securities", providers)

        res = self.client.get(f"{ACCOUNTS_URL}lookup/?customers=C0001")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        items = res.data["data"]
        codes = [i["account_code"] for i in items]
        self.assertIn("A0001", codes)
        self.assertIn("A0002", codes)
        self.assertNotIn("A0003", codes)
