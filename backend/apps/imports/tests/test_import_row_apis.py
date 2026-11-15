"""Tests for Import batch detail and paginated row-results APIs."""

from rest_framework import status

from apps.access.config import UserTypeChoices
from apps.common.tests.base import AppAPITestCase, create_user
from apps.imports.config import ImportStatusChoices, ImportTypeChoices
from apps.imports.models import ImportBatch, ImportRowError


class ImportBatchAndRowsAPITestCase(AppAPITestCase):
    """Test suite for Admin batch metadata and row-results ViewSets."""

    def setUp(self):
        super().setUp()
        self.admin = create_user(
            email="import-admin@finpilot.local",
            user_type=UserTypeChoices.admin,
            is_active=True,
        )
        self.viewer = create_user(
            email="import-viewer@finpilot.local",
            user_type=UserTypeChoices.viewer,
            is_active=True,
        )

        self.batch = ImportBatch.objects.create(
            import_type=ImportTypeChoices.transactions,
            file_name="test_transactions.csv",
            file_sha256="dummyhash123",
            status=ImportStatusChoices.completed_with_errors,
            is_dry_run=False,
            rows_total=10,
            rows_processed=10,
            rows_imported=6,
            rows_skipped_duplicate=2,
            rows_rejected=2,
            warnings={"WARNING_HIGH_AMOUNT": 1},
        )

        # Rejected row 1
        ImportRowError.objects.create(
            batch=self.batch,
            row_number=3,
            outcome="REJECTED",
            error_code="INVALID_AMOUNT",
            field="amount",
            message="Amount must be positive.",
            raw_row={"row": 3, "amount": "-10"},
        )
        # Rejected row 2
        ImportRowError.objects.create(
            batch=self.batch,
            row_number=5,
            outcome="REJECTED",
            error_code="CUSTOMER_NOT_FOUND",
            field="customer_code",
            message="Customer C9999 not found.",
            raw_row={"row": 5, "customer_code": "C9999"},
        )
        # Skipped duplicate row 1
        ImportRowError.objects.create(
            batch=self.batch,
            row_number=7,
            outcome="SKIPPED_DUPLICATE",
            error_code="DUPLICATE_TXN",
            field="transaction_code",
            message="Transaction already exists.",
            raw_row={"row": 7, "txn": "T1000001"},
        )
        # Skipped duplicate row 2
        ImportRowError.objects.create(
            batch=self.batch,
            row_number=9,
            outcome="SKIPPED_DUPLICATE",
            error_code="DUPLICATE_TXN",
            field="transaction_code",
            message="Transaction already exists.",
            raw_row={"row": 9, "txn": "T1000002"},
        )

    def test_batch_detail_returns_metadata_only_without_rejected_rows(self):
        """Batch detail API must return counts, timestamps, and NO rejected_rows list."""
        self.authenticate(self.admin)
        url = f"/api/v1/admin/imports/{self.batch.uuid}/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data["data"]
        self.assertEqual(data["uuid"], str(self.batch.uuid))
        self.assertEqual(data["counts"]["total"], 10)
        self.assertEqual(data["counts"]["imported"], 6)
        self.assertEqual(data["counts"]["skipped_duplicate"], 2)
        self.assertEqual(data["counts"]["rejected"], 2)
        self.assertNotIn("rejected_rows", data)

    def test_row_results_defaults_to_rejected_outcome(self):
        """Row-results API defaults outcome to REJECTED."""
        self.authenticate(self.admin)
        url = f"/api/v1/admin/imports/{self.batch.uuid}/rows/"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["data"]["results"]
        self.assertEqual(len(results), 2)
        for r in results:
            self.assertEqual(r["outcome"], "REJECTED")

    def test_row_results_filter_skipped_duplicate(self):
        """Querying with outcome=SKIPPED_DUPLICATE returns skipped rows only."""
        self.authenticate(self.admin)
        url = f"/api/v1/admin/imports/{self.batch.uuid}/rows/?outcome=SKIPPED_DUPLICATE"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["data"]["results"]
        self.assertEqual(len(results), 2)
        for r in results:
            self.assertEqual(r["outcome"], "SKIPPED_DUPLICATE")

    def test_row_results_filter_by_error_code(self):
        """Filtering by code returns only matching error codes."""
        self.authenticate(self.admin)
        url = f"/api/v1/admin/imports/{self.batch.uuid}/rows/?outcome=REJECTED&code=INVALID_AMOUNT"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data["data"]["results"]
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["error_code"], "INVALID_AMOUNT")

    def test_row_results_csv_export_respects_filters(self):
        """Exporting CSV returns text/csv content with filtered rows."""
        self.authenticate(self.admin)
        url = f"/api/v1/admin/imports/{self.batch.uuid}/rows/?outcome=REJECTED&export=csv"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "text/csv")
        content = response.content.decode("utf-8")
        self.assertIn("INVALID_AMOUNT", content)
        self.assertIn("CUSTOMER_NOT_FOUND", content)
        self.assertNotIn("DUPLICATE_TXN", content)

    def test_viewer_denied_access_to_imports(self):
        """Viewer users receive 403 Forbidden on import history, detail, and rows."""
        self.authenticate(self.viewer)
        res_list = self.client.get("/api/v1/admin/imports/")
        self.assertEqual(res_list.status_code, status.HTTP_403_FORBIDDEN)

        res_detail = self.client.get(f"/api/v1/admin/imports/{self.batch.uuid}/")
        self.assertEqual(res_detail.status_code, status.HTTP_403_FORBIDDEN)

        res_rows = self.client.get(f"/api/v1/admin/imports/{self.batch.uuid}/rows/")
        self.assertEqual(res_rows.status_code, status.HTTP_403_FORBIDDEN)
