"""Unified CSV Import Pipeline for FinPilot.

Treats data ingestion as a robust ETL pipeline:
1. Intake: SHA-256 idempotency check, size, CSV format validation.
2. Batch tracking: ImportBatch created with status PROCESSING.
3. Row-level validation using exact rules from section 9 of the build plan.
4. Set-based / atomic merge: inserts valid records, captures rejected and duplicate rows.
5. Emits golden counts and warning distributions.
"""

import csv
import datetime
import decimal
import hashlib
import io
import logging
from decimal import Decimal

from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone

from apps.customers.models import Customer, RiskProfile
from apps.goals.models import Goal
from apps.imports.config import ImportOutcomeChoices, ImportStatusChoices, ImportTypeChoices
from apps.imports.models import ImportBatch, ImportRowError
from apps.investments.models import Account, HoldingSnapshot, Instrument, Transaction

logger = logging.getLogger(__name__)


class ImportService:
    """Service handling CSV imports for all entity types."""

    def __init__(self, user=None):
        self.user = user

    def import_file(self, import_type: str, file_obj, file_name: str, is_dry_run: bool = False):
        """Processes an incoming CSV file according to its import_type."""
        # Read content and compute hash
        content = file_obj.read()
        if isinstance(content, str):
            content_bytes = content.encode("utf-8-sig")
            content_str = content
        else:
            content_bytes = content
            content_str = content.decode("utf-8-sig", errors="replace")

        file_sha256 = hashlib.sha256(content_bytes).hexdigest()

        # Idempotency check: if non-dry-run and hash exists in completed batches
        if not is_dry_run:
            existing_batch = ImportBatch.objects.filter(
                import_type=import_type,
                file_sha256=file_sha256,
                is_dry_run=False,
                status__in=[ImportStatusChoices.completed, ImportStatusChoices.completed_with_errors],
            ).first()
            if existing_batch:
                return {
                    "conflict": True,
                    "batch": existing_batch,
                    "message": f"File with identical content already imported (Batch {existing_batch.uuid})",
                }

        # Create batch record
        batch = ImportBatch.objects.create(
            import_type=import_type,
            file_name=file_name,
            file_sha256=file_sha256,
            status=ImportStatusChoices.dry_run if is_dry_run else ImportStatusChoices.processing,
            is_dry_run=is_dry_run,
            triggered_by=self.user,
        )

        try:
            reader = csv.DictReader(io.StringIO(content_str))
            # Dispatch to type-specific importer
            importers = {
                ImportTypeChoices.instruments: self._import_instruments,
                ImportTypeChoices.customers: self._import_customers,
                ImportTypeChoices.risk_profiles: self._import_risk_profiles,
                ImportTypeChoices.accounts: self._import_accounts,
                ImportTypeChoices.goals: self._import_goals,
                ImportTypeChoices.holdings: self._import_holdings,
                ImportTypeChoices.transactions: self._import_transactions,
            }

            if import_type not in importers:
                raise ValueError(f"Unknown import type: {import_type}")

            summary = importers[import_type](batch, reader, is_dry_run)

            # Update batch metadata
            batch.rows_total = summary["total"]
            batch.rows_imported = summary["imported"]
            batch.rows_skipped_duplicate = summary["skipped_duplicate"]
            batch.rows_rejected = summary["rejected"]
            batch.warnings = summary.get("warnings", {})
            batch.finished_at = timezone.now()

            if is_dry_run:
                batch.status = ImportStatusChoices.dry_run
            elif batch.rows_rejected > 0:
                batch.status = ImportStatusChoices.completed_with_errors
            else:
                batch.status = ImportStatusChoices.completed

            batch.save()
            summary["batch"] = batch
            return summary

        except Exception as exc:
            logger.exception("Import batch %s failed unexpectedly", batch.uuid)
            batch.status = ImportStatusChoices.failed
            batch.finished_at = timezone.now()
            batch.save()
            raise

    # ---------------------------------------------------------
    # 1. INSTRUMENTS IMPORTER
    # ---------------------------------------------------------
    def _import_instruments(self, batch, reader, is_dry_run):
        total = 0
        imported = 0
        skipped = 0
        rejected = 0
        row_errors = []
        to_create = []

        seen_codes = set(Instrument.objects.values_list("instrument_code", flat=True))

        for row_idx, row in enumerate(reader, start=2):
            total += 1
            code = (row.get("instrument_id") or "").strip()
            symbol = (row.get("symbol") or "").strip()
            name = (row.get("instrument_name") or "").strip()
            asset_class = (row.get("asset_class") or "").strip().upper()
            sector = (row.get("sector") or "").strip() or None
            exchange = (row.get("exchange") or "").strip().upper()
            currency = (row.get("currency") or "INR").strip().upper()
            last_price_str = (row.get("last_price") or "").strip()
            price_as_of = (row.get("price_as_of") or "").strip() or None
            risk_band = (row.get("risk_band") or "").strip().upper()

            if not code or not symbol or not name or not asset_class:
                rejected += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                        error_code="MISSING_FIELD", message="Required field missing", raw_row=row,
                    )
                )
                continue

            if code in seen_codes:
                skipped += 1
                continue

            try:
                last_price = Decimal(last_price_str)
            except Exception:
                rejected += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                        error_code="INVALID_NUMBER", field="last_price", message=f"Invalid price: {last_price_str}", raw_row=row,
                    )
                )
                continue

            seen_codes.add(code)
            imported += 1
            if not is_dry_run:
                to_create.append(
                    Instrument(
                        instrument_code=code,
                        symbol=symbol,
                        instrument_name=name,
                        asset_class=asset_class,
                        sector=sector,
                        exchange=exchange,
                        currency=currency,
                        last_price=last_price,
                        price_as_of=price_as_of,
                        risk_band=risk_band,
                    )
                )

        if not is_dry_run and to_create:
            with transaction.atomic():
                Instrument.objects.bulk_create(to_create, batch_size=500)
                if row_errors:
                    ImportRowError.objects.bulk_create(row_errors, batch_size=500)

        return {"total": total, "imported": imported, "skipped_duplicate": skipped, "rejected": rejected, "warnings": {}}

    # ---------------------------------------------------------
    # 2. CUSTOMERS IMPORTER
    # ---------------------------------------------------------
    def _import_customers(self, batch, reader, is_dry_run):
        total = 0
        imported = 0
        skipped = 0
        rejected = 0
        row_errors = []
        to_create = []

        seen_codes = set(Customer.objects.values_list("customer_code", flat=True))

        for row_idx, row in enumerate(reader, start=2):
            total += 1
            code = (row.get("customer_id") or "").strip()
            name = (row.get("full_name") or "").strip()
            email = (row.get("email") or "").strip()
            phone = (row.get("phone") or "").strip()
            city = (row.get("city") or "").strip() or None
            state = (row.get("state") or "").strip() or None
            dob = (row.get("date_of_birth") or "").strip() or None
            onboarded = (row.get("onboarded_at") or "").strip() or None
            kyc = (row.get("kyc_status") or "").strip().upper()
            segment = (row.get("segment") or "").strip().upper()

            if not code or not name or not email or not phone:
                rejected += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                        error_code="MISSING_FIELD", message="Missing required customer field", raw_row=row,
                    )
                )
                continue

            if code in seen_codes:
                skipped += 1
                continue

            seen_codes.add(code)
            imported += 1
            if not is_dry_run:
                to_create.append(
                    Customer(
                        customer_code=code,
                        full_name=name,
                        email=email,
                        phone=phone,
                        city=city,
                        state=state,
                        date_of_birth=dob,
                        onboarded_at=onboarded,
                        kyc_status=kyc,
                        segment=segment,
                    )
                )

        if not is_dry_run and to_create:
            with transaction.atomic():
                Customer.objects.bulk_create(to_create, batch_size=500)
                if row_errors:
                    ImportRowError.objects.bulk_create(row_errors, batch_size=500)

        return {"total": total, "imported": imported, "skipped_duplicate": skipped, "rejected": rejected, "warnings": {}}

    # ---------------------------------------------------------
    # 3. RISK PROFILES IMPORTER
    # ---------------------------------------------------------
    def _import_risk_profiles(self, batch, reader, is_dry_run):
        total = 0
        imported = 0
        skipped = 0
        rejected = 0
        row_errors = []
        to_create = []

        customers = dict(Customer.objects.values_list("customer_code", "id"))
        existing_keys = set(RiskProfile.objects.values_list("customer_id", "assessed_at"))

        for row_idx, row in enumerate(reader, start=2):
            total += 1
            cust_code = (row.get("customer_id") or "").strip()
            score_str = (row.get("risk_score") or "").strip()
            level = (row.get("risk_level") or "").strip().upper()
            assessed_at_str = (row.get("assessed_at") or "").strip()
            horizon_str = (row.get("horizon_years") or "").strip()
            liquidity = (row.get("liquidity_need") or "").strip().upper()

            cust_id = customers.get(cust_code)
            if not cust_id:
                rejected += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                        error_code="UNKNOWN_CUSTOMER", message=f"Customer {cust_code} does not exist", raw_row=row,
                    )
                )
                continue

            try:
                assessed_at = datetime.date.fromisoformat(assessed_at_str)
                score = int(score_str)
                horizon = int(horizon_str)
            except Exception:
                rejected += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                        error_code="INVALID_DATA", message="Invalid date or integer format", raw_row=row,
                    )
                )
                continue

            if (cust_id, assessed_at) in existing_keys:
                skipped += 1
                continue

            existing_keys.add((cust_id, assessed_at))
            imported += 1
            if not is_dry_run:
                to_create.append(
                    RiskProfile(
                        customer_id=cust_id,
                        risk_score=score,
                        risk_level=level,
                        assessed_at=assessed_at,
                        horizon_years=horizon,
                        liquidity_need=liquidity,
                    )
                )

        if not is_dry_run and to_create:
            with transaction.atomic():
                RiskProfile.objects.bulk_create(to_create, batch_size=500)
                if row_errors:
                    ImportRowError.objects.bulk_create(row_errors, batch_size=500)

        return {"total": total, "imported": imported, "skipped_duplicate": skipped, "rejected": rejected, "warnings": {}}

    # ---------------------------------------------------------
    # 4. ACCOUNTS IMPORTER
    # ---------------------------------------------------------
    def _import_accounts(self, batch, reader, is_dry_run):
        total = 0
        imported = 0
        skipped = 0
        rejected = 0
        row_errors = []
        to_create = []

        customers = dict(Customer.objects.values_list("customer_code", "id"))
        existing_codes = set(Account.objects.values_list("account_code", flat=True))

        for row_idx, row in enumerate(reader, start=2):
            total += 1
            code = (row.get("account_id") or "").strip()
            cust_code = (row.get("customer_id") or "").strip()
            acc_type = (row.get("account_type") or "").strip().upper()
            provider = (row.get("provider") or "").strip() or None
            opened_at = (row.get("opened_at") or "").strip() or None
            status = (row.get("status") or "").strip().upper()
            currency = (row.get("base_currency") or "INR").strip().upper()

            cust_id = customers.get(cust_code)
            if not cust_id:
                rejected += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                        error_code="UNKNOWN_CUSTOMER", message=f"Customer {cust_code} does not exist", raw_row=row,
                    )
                )
                continue

            if code in existing_codes:
                skipped += 1
                continue

            existing_codes.add(code)
            imported += 1
            if not is_dry_run:
                to_create.append(
                    Account(
                        account_code=code,
                        customer_id=cust_id,
                        account_type=acc_type,
                        provider=provider,
                        opened_at=opened_at,
                        status=status,
                        base_currency=currency,
                    )
                )

        if not is_dry_run and to_create:
            with transaction.atomic():
                Account.objects.bulk_create(to_create, batch_size=500)
                if row_errors:
                    ImportRowError.objects.bulk_create(row_errors, batch_size=500)

        return {"total": total, "imported": imported, "skipped_duplicate": skipped, "rejected": rejected, "warnings": {}}

    # ---------------------------------------------------------
    # 5. GOALS IMPORTER
    # ---------------------------------------------------------
    def _import_goals(self, batch, reader, is_dry_run):
        total = 0
        imported = 0
        skipped = 0
        rejected = 0
        row_errors = []
        to_create = []

        customers = dict(Customer.objects.values_list("customer_code", "id"))
        existing_codes = set(Goal.objects.values_list("goal_code", flat=True))

        for row_idx, row in enumerate(reader, start=2):
            total += 1
            code = (row.get("goal_id") or "").strip()
            cust_code = (row.get("customer_id") or "").strip()
            goal_type = (row.get("goal_type") or "").strip().upper()
            name = (row.get("goal_name") or "").strip()
            target_str = (row.get("target_amount") or "").strip()
            funded_str = (row.get("current_funded_amount") or "").strip()
            target_date = (row.get("target_date") or "").strip()
            priority = (row.get("priority") or "MEDIUM").strip().upper()

            cust_id = customers.get(cust_code)
            if not cust_id:
                rejected += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                        error_code="UNKNOWN_CUSTOMER", message=f"Customer {cust_code} does not exist", raw_row=row,
                    )
                )
                continue

            if code in existing_codes:
                skipped += 1
                continue

            try:
                target_amount = Decimal(target_str)
                funded_amount = Decimal(funded_str) if funded_str else Decimal("0.00")
            except Exception:
                rejected += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                        error_code="INVALID_NUMBER", message="Invalid target or funded amount", raw_row=row,
                    )
                )
                continue

            existing_codes.add(code)
            imported += 1
            if not is_dry_run:
                to_create.append(
                    Goal(
                        goal_code=code,
                        customer_id=cust_id,
                        goal_type=goal_type,
                        goal_name=name,
                        target_amount=target_amount,
                        current_funded_amount=funded_amount,
                        target_date=target_date,
                        priority=priority,
                    )
                )

        if not is_dry_run and to_create:
            with transaction.atomic():
                Goal.objects.bulk_create(to_create, batch_size=500)
                # Ensure sequence is synchronized after loading goals
                with connection.cursor() as cursor:
                    cursor.execute("SELECT setval('goals_goal_code_seq', (SELECT COALESCE(MAX(SUBSTRING(goal_code FROM 2)::integer), 177) + 1 FROM goals_goal));")
                if row_errors:
                    ImportRowError.objects.bulk_create(row_errors, batch_size=500)

        return {"total": total, "imported": imported, "skipped_duplicate": skipped, "rejected": rejected, "warnings": {}}

    # ---------------------------------------------------------
    # 6. HOLDINGS SNAPSHOT IMPORTER
    # ---------------------------------------------------------
    def _import_holdings(self, batch, reader, is_dry_run):
        total = 0
        imported = 0
        skipped = 0
        rejected = 0
        row_errors = []
        to_create = []

        accounts = dict(Account.objects.values_list("account_code", "id"))
        instruments = dict(Instrument.objects.values_list("instrument_code", "id"))
        existing_keys = set(HoldingSnapshot.objects.values_list("account_id", "instrument_id", "snapshot_date"))

        # Track keys within the current batch to detect in-file duplicates (A5 anomaly)
        seen_in_batch = set()

        for row_idx, row in enumerate(reader, start=2):
            total += 1
            acc_code = (row.get("account_id") or "").strip()
            inst_code = (row.get("instrument_id") or "").strip()
            qty_str = (row.get("quantity") or "").strip()
            cost_str = (row.get("avg_cost") or "").strip()
            snapshot_date_str = (row.get("snapshot_date") or "").strip()

            acc_id = accounts.get(acc_code)
            inst_id = instruments.get(inst_code)

            if not acc_id or not inst_id:
                rejected += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                        error_code="UNKNOWN_REFERENCE", message=f"Account {acc_code} or Instrument {inst_code} not found", raw_row=row,
                    )
                )
                continue

            try:
                qty = Decimal(qty_str)
                avg_cost = Decimal(cost_str)
                snap_date = datetime.date.fromisoformat(snapshot_date_str)
            except Exception:
                rejected += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                        error_code="INVALID_DATA", message="Invalid quantity, cost or date", raw_row=row,
                    )
                )
                continue

            holding_key = (acc_id, inst_id, snap_date)

            # In-file or DB duplicate check
            if holding_key in seen_in_batch or holding_key in existing_keys:
                skipped += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.skipped_duplicate,
                        error_code="DUPLICATE_POSITION", message=f"Duplicate holding position for {acc_code}/{inst_code}", raw_row=row,
                    )
                )
                continue

            seen_in_batch.add(holding_key)
            existing_keys.add(holding_key)
            imported += 1

            if not is_dry_run:
                to_create.append(
                    HoldingSnapshot(
                        account_id=acc_id,
                        instrument_id=inst_id,
                        quantity=qty,
                        avg_cost=avg_cost,
                        snapshot_date=snap_date,
                    )
                )

        if not is_dry_run and to_create:
            with transaction.atomic():
                HoldingSnapshot.objects.bulk_create(to_create, batch_size=1000)
                if row_errors:
                    ImportRowError.objects.bulk_create(row_errors, batch_size=1000)

        return {"total": total, "imported": imported, "skipped_duplicate": skipped, "rejected": rejected, "warnings": {}}

    # ---------------------------------------------------------
    # 7. TRANSACTIONS IMPORTER (Anomalies A1, A2, A3, A4)
    # ---------------------------------------------------------
    def _import_transactions(self, batch, reader, is_dry_run):
        total = 0
        imported = 0
        skipped = 0
        rejected = 0
        warnings = {
            "TXN_BEFORE_ACCOUNT_OPEN": 0,
            "TXN_ON_CLOSED_ACCOUNT": 0,
        }
        row_errors = []
        to_create = []

        # Reference caches
        accounts = {acc.account_code: acc for acc in Account.objects.all()}
        instruments = dict(Instrument.objects.values_list("instrument_code", "id"))
        existing_txns = dict(Transaction.objects.values_list("transaction_code", "amount"))

        # In-file duplicate tracking
        seen_in_file = {}

        # Cutoff date in business timezone
        # In Asia/Kolkata timezone, cutoff is the current local date
        today_business = timezone.localdate()

        # Tolerance
        tolerance = Decimal(getattr(settings, "IMPORT_AMOUNT_TOLERANCE", "1.00"))

        for row_idx, row in enumerate(reader, start=2):
            total += 1
            txn_code = (row.get("transaction_id") or "").strip()
            acc_code = (row.get("account_id") or "").strip()
            inst_code = (row.get("instrument_id") or "").strip()
            txn_type = (row.get("transaction_type") or "").strip().upper()
            trade_date_str = (row.get("trade_date") or "").strip()
            qty_str = (row.get("quantity") or "").strip()
            price_str = (row.get("price") or "").strip()
            amount_str = (row.get("amount") or "").strip()
            status = (row.get("status") or "").strip().upper()

            # Rule: Required fields
            if not txn_code or not acc_code or not inst_code or not txn_type or not trade_date_str:
                rejected += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                        error_code="MISSING_FIELD", message="Required field missing", raw_row=row,
                    )
                )
                continue

            # Rule: Enums
            if txn_type not in ["BUY", "SELL", "DIVIDEND", "FEE"] or status not in ["SETTLED", "PENDING", "REVERSED"]:
                rejected += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                        error_code="INVALID_ENUM", message=f"Invalid transaction type ({txn_type}) or status ({status})", raw_row=row,
                    )
                )
                continue

            # Parse numbers and dates
            try:
                trade_date = datetime.date.fromisoformat(trade_date_str)
                qty = Decimal(qty_str)
                price = Decimal(price_str)
                amount = Decimal(amount_str)
            except Exception:
                rejected += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                        error_code="INVALID_NUMBER", message="Unparseable decimal or date", raw_row=row,
                    )
                )
                continue

            # Rule A3: Negative amount
            if amount < 0 or qty < 0 or price < 0:
                rejected += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                        error_code="NEGATIVE_AMOUNT", field="amount",
                        message=f"Amount must be >= 0 (got {amount}).", raw_row=row,
                    )
                )
                continue

            # Rule A4: Future trade date
            if trade_date > today_business:
                rejected += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                        error_code="FUTURE_TRADE_DATE", field="trade_date",
                        message=f"Trade date {trade_date} is in the future.", raw_row=row,
                    )
                )
                continue

            # Rule A2: FK check - unknown instrument or unknown account
            inst_id = instruments.get(inst_code)
            if not inst_id:
                rejected += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                        error_code="UNKNOWN_INSTRUMENT", field="instrument_id",
                        message=f"Instrument '{inst_code}' does not exist.", raw_row=row,
                    )
                )
                continue

            acc = accounts.get(acc_code)
            if not acc:
                rejected += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                        error_code="UNKNOWN_ACCOUNT", field="account_id",
                        message=f"Account '{acc_code}' does not exist.", raw_row=row,
                    )
                )
                continue

            # Rule: Trade shape
            if txn_type in ["BUY", "SELL"] and (qty <= 0 or price <= 0):
                rejected += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                        error_code="INVALID_TRADE_SHAPE", message=f"{txn_type} must have quantity > 0 and price > 0", raw_row=row,
                    )
                )
                continue
            if txn_type in ["DIVIDEND", "FEE"] and (qty != 0 or price != 0):
                rejected += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                        error_code="INVALID_TRADE_SHAPE", message=f"{txn_type} must have quantity = 0 and price = 0", raw_row=row,
                    )
                )
                continue

            # Rule: Amount mismatch tolerance for BUY/SELL
            if txn_type in ["BUY", "SELL"]:
                expected_amount = qty * price
                diff = abs(expected_amount - amount)
                if diff > tolerance:
                    rejected += 1
                    row_errors.append(
                        ImportRowError(
                            batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                            error_code="AMOUNT_MISMATCH", field="amount",
                            message=f"Deviation {diff} exceeds tolerance {tolerance}", raw_row=row,
                        )
                    )
                    continue

            # Rule A1: Duplicate handling
            # In-file duplicate:
            payload_signature = (acc_code, inst_code, txn_type, trade_date_str, qty, price, amount, status)
            if txn_code in seen_in_file:
                first_payload = seen_in_file[txn_code]
                if first_payload == payload_signature:
                    # Identical payload duplicate -> SKIPPED_DUPLICATE
                    skipped += 1
                    row_errors.append(
                        ImportRowError(
                            batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.skipped_duplicate,
                            error_code="DUPLICATE_IN_FILE", message=f"Duplicate transaction {txn_code} skipped", raw_row=row,
                        )
                    )
                    continue
                else:
                    # Conflicting payload with same ID -> REJECTED
                    rejected += 1
                    row_errors.append(
                        ImportRowError(
                            batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.rejected,
                            error_code="TXN_ID_CONFLICT", message=f"Conflicting payload for transaction {txn_code}", raw_row=row,
                        )
                    )
                    continue

            # Existing DB record duplicate:
            if txn_code in existing_txns:
                skipped += 1
                row_errors.append(
                    ImportRowError(
                        batch=batch, row_number=row_idx, outcome=ImportOutcomeChoices.skipped_duplicate,
                        error_code="ALREADY_IMPORTED", message=f"Transaction {txn_code} already in database", raw_row=row,
                    )
                )
                continue

            seen_in_file[txn_code] = payload_signature

            # Warning checks (loaded, not rejected)
            if acc.opened_at and trade_date < acc.opened_at:
                warnings["TXN_BEFORE_ACCOUNT_OPEN"] += 1

            if acc.status == "CLOSED":
                warnings["TXN_ON_CLOSED_ACCOUNT"] += 1

            imported += 1
            if not is_dry_run:
                to_create.append(
                    Transaction(
                        transaction_code=txn_code,
                        account_id=acc.id,
                        instrument_id=inst_id,
                        transaction_type=txn_type,
                        trade_date=trade_date,
                        quantity=qty,
                        price=price,
                        amount=amount,
                        status=status,
                    )
                )

        if not is_dry_run and to_create:
            with transaction.atomic():
                Transaction.objects.bulk_create(to_create, batch_size=1000)
                if row_errors:
                    ImportRowError.objects.bulk_create(row_errors, batch_size=1000)

        return {
            "total": total,
            "imported": imported,
            "skipped_duplicate": skipped,
            "rejected": rejected,
            "warnings": warnings,
            "rejected_rows": [
                {
                    "row": err.row_number,
                    "code": err.error_code,
                    "field": err.field,
                    "message": err.message,
                }
                for err in row_errors if err.outcome == ImportOutcomeChoices.rejected
            ],
        }
