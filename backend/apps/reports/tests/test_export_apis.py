"""Integration tests for Export Report API, background generation, polling, and file cleanup."""

import csv
import datetime
from decimal import Decimal
import io
import os

from rest_framework import status

from apps.access.config import UserTypeChoices
from apps.common.tests.base import AppAPITestCase, create_user
from apps.customers.models import Customer
from apps.goals.models import Goal
from apps.investments.models import Account, HoldingSnapshot, Instrument, Transaction
from apps.reports.config import ExportStatusChoices, ExportTypeChoices
from apps.reports.models.export_report import ExportReport
from apps.reports.services.export_service import ExportService
from apps.reports.tasks.export_tasks import generate_export_report_task

EXPORT_URL = "/api/v1/exports/"


class ExportAPITestCase(AppAPITestCase):
    def setUp(self):
        super().setUp()
        self.admin_user = create_user(
            email="export_admin@finpilot.local",
            full_name="Export Admin",
            user_type=UserTypeChoices.admin,
            is_active=True,
        )
        self.viewer_user = create_user(
            email="export_viewer@finpilot.local",
            full_name="Export Viewer",
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
            customer=self.c2,
            account_type="MUTUAL_FUND",
            provider="BlueRiver MF",
            status="ACTIVE",
            opened_at=datetime.date(2023, 5, 20),
        )

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

        # Transactions
        self.t1 = Transaction.objects.create(
            transaction_code="T0000001",
            account=self.a1,
            instrument=self.i1,
            transaction_type="BUY",
            trade_date=datetime.date(2026, 1, 10),
            quantity=Decimal("10.0000"),
            price=Decimal("2400.00"),
            amount=Decimal("24000.00"),
            status="SETTLED",
        )
        self.t2 = Transaction.objects.create(
            transaction_code="T0000002",
            account=self.a2,
            instrument=self.i2,
            transaction_type="BUY",
            trade_date=datetime.date(2026, 2, 15),
            quantity=Decimal("5.0000"),
            price=Decimal("1400.00"),
            amount=Decimal("7000.00"),
            status="PENDING",
        )

        # Portfolio positions
        HoldingSnapshot.objects.create(
            account=self.a1,
            instrument=self.i1,
            quantity=Decimal("10.0000"),
            avg_cost=Decimal("2400.0000"),
            snapshot_date=datetime.date(2026, 9, 18),
        )
        HoldingSnapshot.objects.create(
            account=self.a2,
            instrument=self.i2,
            quantity=Decimal("5.0000"),
            avg_cost=Decimal("1400.0000"),
            snapshot_date=datetime.date(2026, 9, 18),
        )

        # Goals
        Goal.objects.create(
            goal_code="G00001",
            customer=self.c1,
            goal_name="Retirement Fund",
            goal_type="RETIREMENT",
            target_amount=Decimal("1000000.00"),
            current_funded_amount=Decimal("500000.00"),
            target_date=datetime.date(2035, 1, 1),
            priority="HIGH",
        )

    def test_unauthenticated_request_rejected(self):
        """Unauthenticated export request is denied."""
        response = self.client.get(EXPORT_URL)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        post_response = self.client.post(EXPORT_URL, data={"export_type": "transactions"})
        self.assertEqual(post_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_viewer_and_admin_authorized(self):
        """Both VIEWER and ADMIN roles can list and create exports."""
        self.authenticate(self.viewer_user)
        res_viewer = self.client.get(EXPORT_URL)
        self.assertEqual(res_viewer.status_code, status.HTTP_200_OK)

        self.authenticate(self.admin_user)
        res_admin = self.client.get(EXPORT_URL)
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)

    def test_post_creates_export_report_and_triggers_task(self):
        """POST /api/v1/exports/ stores record in model, triggers task, and returns 202."""
        self.authenticate(self.viewer_user)

        payload = {
            "export_type": "transactions",
            "customer_codes": ["C0001"],
            "account_codes": ["A0001"],
            "date_from": "2026-01-01",
            "date_to": "2026-12-31",
        }
        res = self.client.post(EXPORT_URL, data=payload)
        self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("Export task created", data["message"])
        report_uuid = data["data"]["uuid"]

        # Verify record exists in DB
        report = ExportReport.objects.get(uuid=report_uuid)
        self.assertEqual(report.export_type, ExportTypeChoices.transactions)
        self.assertEqual(report.created_by, self.viewer_user)
        self.assertEqual(report.filters.get("customer_codes"), ["C0001"])

    def test_polling_and_download_flow_with_file_cleanup(self):
        """
        Complete flow:
        1. POST initiates export
        2. Celery task generates file on disk
        3. GET /status/ reports COMPLETED and can_download=True
        4. GET /download/ returns CSV content
        5. File on disk is DELETED immediately after download
        6. Second download attempt returns 410 Gone
        """
        self.authenticate(self.viewer_user)

        # 1. Create export
        res = self.client.post(EXPORT_URL, data={"export_type": "transactions", "customer_codes": ["C0001"]})
        self.assertEqual(res.status_code, status.HTTP_202_ACCEPTED)
        report_uuid = res.json()["data"]["uuid"]

        # 2. Run task synchronously to simulate worker completion
        generate_export_report_task.run(export_uuid=report_uuid)

        # 3. Poll status
        status_url = f"{EXPORT_URL}{report_uuid}/status/"
        status_res = self.client.get(status_url)
        self.assertEqual(status_res.status_code, status.HTTP_200_OK)
        status_data = status_res.json()["data"]
        self.assertEqual(status_data["status"], ExportStatusChoices.completed)
        self.assertEqual(status_data["row_count"], 1)
        self.assertTrue(status_data["can_download"])
        self.assertFalse(status_data["is_downloaded"])

        # Check file exists on disk prior to download
        report = ExportReport.objects.get(uuid=report_uuid)
        file_path = report.file_path
        self.assertTrue(os.path.exists(file_path))

        # 4. Download file
        download_url = f"{EXPORT_URL}{report_uuid}/download/"
        dl_res = self.client.get(download_url)
        self.assertEqual(dl_res.status_code, status.HTTP_200_OK)
        self.assertIn("text/csv", dl_res["Content-Type"])
        self.assertIn("attachment; filename=", dl_res["Content-Disposition"])

        content = dl_res.content.decode("utf-8")
        reader = list(csv.reader(io.StringIO(content)))
        self.assertEqual(len(reader), 2)  # 1 header + 1 row
        self.assertEqual(reader[1][0], "T0000001")
        self.assertEqual(reader[1][2], "C0001")

        # 5. Check file was deleted from disk and model updated
        self.assertFalse(os.path.exists(file_path))
        report.refresh_from_db()
        self.assertTrue(report.is_downloaded)
        self.assertIsNone(report.file_path)
        self.assertIsNotNone(report.downloaded_at)

        # 6. Re-downloading returns 410 GONE
        dl_res2 = self.client.get(download_url)
        self.assertEqual(dl_res2.status_code, status.HTTP_410_GONE)

    def test_export_report_listing(self):
        """GET /api/v1/exports/ lists existing reports with pagination and statuses."""
        self.authenticate(self.viewer_user)

        ExportReport.objects.create(
            export_type=ExportTypeChoices.transactions,
            status=ExportStatusChoices.completed,
            row_count=5,
            file_name="finpilot_transactions_2026-11-16.csv",
            created_by=self.viewer_user,
        )
        ExportReport.objects.create(
            export_type=ExportTypeChoices.portfolio_positions,
            status=ExportStatusChoices.pending,
            created_by=self.viewer_user,
        )

        res = self.client.get(EXPORT_URL)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        payload = res.json()
        data = payload.get("data", payload)
        self.assertIn("results", data)
        self.assertGreaterEqual(data["count"], 2)
        items = data["results"]
        self.assertEqual(items[0]["status"], ExportStatusChoices.pending)
        self.assertEqual(items[1]["status"], ExportStatusChoices.completed)

    def test_direct_sync_export_transactions(self):
        """Direct sync export via ?direct=true streams CSV on the fly."""
        self.authenticate(self.viewer_user)

        res = self.client.get(f"{EXPORT_URL}?direct=true&export_type=transactions&customers=C0001")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("attachment; filename=", res["Content-Disposition"])
        content = res.content.decode("utf-8")
        reader = list(csv.reader(io.StringIO(content)))
        self.assertEqual(len(reader) - 1, 1)

    def test_direct_sync_export_portfolio_positions(self):
        """Portfolio positions direct sync export calculates correct market value."""
        self.authenticate(self.viewer_user)

        res = self.client.get(f"{EXPORT_URL}?direct=true&export_type=portfolio_positions&accounts=A0001")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        reader = list(csv.reader(io.StringIO(res.content.decode("utf-8"))))
        headers = reader[0]
        mv_idx = headers.index("Market Value")
        self.assertEqual(reader[1][mv_idx], "25000.00")

    def test_direct_sync_export_goals(self):
        """Goals direct sync export exports goals with funded percentage."""
        self.authenticate(self.viewer_user)

        res = self.client.get(f"{EXPORT_URL}?direct=true&export_type=goals&customers=C0001")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        reader = list(csv.reader(io.StringIO(res.content.decode("utf-8"))))
        headers = reader[0]
        self.assertIn("Goal Code", headers)
        self.assertIn("Customer Code", headers)
        self.assertGreaterEqual(len(reader), 2)

    def test_direct_sync_export_customers(self):
        """Customers export exports customer profiles, KYC, segment, and account counts."""
        self.authenticate(self.viewer_user)

        res = self.client.get(f"{EXPORT_URL}?direct=true&export_type=customers&customers=C0001")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        reader = list(csv.reader(io.StringIO(res.content.decode("utf-8"))))
        headers = reader[0]
        self.assertIn("Customer Code", headers)
        self.assertIn("KYC Status", headers)
        self.assertIn("Segment", headers)
        self.assertEqual(len(reader), 2)
        self.assertEqual(reader[1][headers.index("Customer Code")], "C0001")

    def test_direct_sync_export_accounts(self):
        """Accounts export exports account list with market value."""
        self.authenticate(self.viewer_user)

        res = self.client.get(f"{EXPORT_URL}?direct=true&export_type=accounts&customers=C0001")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        reader = list(csv.reader(io.StringIO(res.content.decode("utf-8"))))
        headers = reader[0]
        self.assertIn("Account Code", headers)
        self.assertIn("Current Market Value", headers)
        self.assertGreaterEqual(len(reader), 2)
        self.assertEqual(reader[1][headers.index("Account Code")], "A0001")
