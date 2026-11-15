"""Integration tests for Customer APIs: listing, multi-select filtering, and locations."""

from rest_framework import status

from apps.access.config import UserTypeChoices
from apps.common.tests.base import AppAPITestCase, create_user
from apps.customers.models import Customer

CUSTOMERS_URL = "/api/v1/customers/"
LOCATIONS_URL = "/api/v1/customers/locations/"


class CustomerAPITestCase(AppAPITestCase):
    def setUp(self):
        super().setUp()
        self.user = create_user(
            email="advisor@finpilot.local",
            full_name="Wealth Advisor",
            user_type=UserTypeChoices.admin,
            is_active=True,
        )
        self.authenticate(self.user)

        self.c1 = Customer.objects.create(
            customer_code="C0001",
            full_name="Aarav Sharma",
            email="aarav@test.local",
            phone="+919876543210",
            city="Mumbai",
            state="MH",
            kyc_status="VERIFIED",
            segment="HNI",
        )
        self.c2 = Customer.objects.create(
            customer_code="C0002",
            full_name="Deepa Patel",
            email="deepa@test.local",
            phone="+919876543211",
            city="Chennai",
            state="TN",
            kyc_status="PENDING",
            segment="MASS",
        )

    def test_list_customers_with_annotations(self):
        response = self.client.get(CUSTOMERS_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["data"]["results"]
        self.assertGreaterEqual(len(results), 2)
        codes = [c["customer_code"] for c in results]
        self.assertIn("C0001", codes)
        self.assertIn("C0002", codes)

    def test_filter_by_multi_state_and_city(self):
        response = self.client.get(f"{CUSTOMERS_URL}?state=MH,TN&city=Mumbai")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["data"]["results"]
        codes = [c["customer_code"] for c in results]
        self.assertIn("C0001", codes)
        self.assertNotIn("C0002", codes)

    def test_customer_locations_endpoint(self):
        response = self.client.get(LOCATIONS_URL)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["data"]
        self.assertIn("states", data)
        self.assertIn("cities", data)
        state_codes = [s["code"] for s in data["states"]]
        self.assertIn("MH", state_codes)
        self.assertIn("TN", state_codes)
        city_names = [c["name"] for c in data["cities"]]
        self.assertIn("Mumbai", city_names)
        self.assertIn("Chennai", city_names)
