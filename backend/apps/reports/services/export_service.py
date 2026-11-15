"""Service for generating CSV exports asynchronously or synchronously."""

import csv
import datetime
from decimal import Decimal
import logging
import os

from django.conf import settings
from django.db.models import DecimalField, F, OuterRef, Q, Subquery, Sum, Value, Count
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.customers.models import Customer
from apps.goals.models import Goal
from apps.investments.models import Account, HoldingSnapshot, Transaction
from apps.reports.config import ExportStatusChoices, ExportTypeChoices
from apps.reports.models.export_report import ExportReport

logger = logging.getLogger(__name__)


def parse_date(date_val, field_name: str) -> datetime.date:
    """Parses date string or returns date directly."""
    if isinstance(date_val, datetime.date):
        return date_val
    if isinstance(date_val, str) and date_val.strip():
        try:
            return datetime.datetime.strptime(date_val.strip(), "%Y-%m-%d").date()
        except (ValueError, AttributeError):
            raise ValidationError({field_name: [f"Invalid date format for '{field_name}'. Expected YYYY-MM-DD."]})
    return None


class ExportService:
    """Service to handle query building, CSV writing, and ExportReport lifecycle."""

    @staticmethod
    def normalize_export_type(raw_type: str) -> str:
        t = str(raw_type or "").strip().lower()
        if t in ["portfolio", "positions", "portfolio_positions"]:
            return ExportTypeChoices.portfolio_positions
        if t in ["goal", "goals"]:
            return ExportTypeChoices.goals
        if t in ["customer", "customers"]:
            return ExportTypeChoices.customers
        if t in ["account", "accounts"]:
            return ExportTypeChoices.accounts
        return ExportTypeChoices.transactions

    @classmethod
    def generate_export_file(cls, export_uuid: str) -> ExportReport:
        """Processes the export report job and writes CSV to disk."""
        try:
            report = ExportReport.objects.get(uuid=export_uuid)
        except ExportReport.DoesNotExist:
            logger.error("ExportReport %s does not exist", export_uuid)
            raise

        report.status = ExportStatusChoices.processing
        report.started_at = timezone.now()
        report.save(update_fields=["status", "started_at", "modified"])

        try:
            filters = report.filters or {}
            headers, rows, summary = cls.build_export_data(report.export_type, filters)

            # Determine storage location
            export_dir = os.path.join(getattr(settings, "MEDIA_ROOT", "media"), "exports")
            os.makedirs(export_dir, exist_ok=True)

            file_path = os.path.join(export_dir, f"finpilot_export_{report.uuid}.csv")
            with open(file_path, mode="w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(headers)
                for row in rows:
                    writer.writerow(row)

            today_str = timezone.localdate().isoformat()
            safe_type = str(report.export_type).lower()
            file_name = f"finpilot_{safe_type}_{today_str}.csv"

            report.file_name = file_name
            report.file_path = file_path
            report.row_count = len(rows)
            report.status = ExportStatusChoices.completed
            report.completed_at = timezone.now()
            report.save(update_fields=["file_name", "file_path", "row_count", "status", "completed_at", "modified"])

            logger.info("ExportReport %s completed: %d rows written to %s", export_uuid, len(rows), file_path)
            return report

        except Exception as exc:
            logger.exception("ExportReport %s failed: %s", export_uuid, exc)
            report.status = ExportStatusChoices.failed
            report.error_message = str(exc)
            report.completed_at = timezone.now()
            report.save(update_fields=["status", "error_message", "completed_at", "modified"])
            raise

    @classmethod
    def build_export_data(cls, export_type: str, filters: dict):
        normalized = cls.normalize_export_type(export_type)
        if normalized == ExportTypeChoices.portfolio_positions:
            return cls._build_portfolio_positions(filters)
        elif normalized == ExportTypeChoices.goals:
            return cls._build_goals(filters)
        elif normalized == ExportTypeChoices.customers:
            return cls._build_customers(filters)
        elif normalized == ExportTypeChoices.accounts:
            return cls._build_accounts(filters)
        else:
            return cls._build_transactions(filters)

    @classmethod
    def _build_customers(cls, filters: dict):
        from apps.customers.models import RiskProfile

        latest_risk = RiskProfile.objects.filter(customer=OuterRef("pk")).order_by("-assessed_at")

        qs = (
            Customer.objects.annotate(
                risk_level_val=Subquery(latest_risk.values("risk_level")[:1]),
                risk_score_val=Subquery(latest_risk.values("risk_score")[:1]),
                accounts_count_val=Count("accounts", distinct=True),
                goals_count_val=Count("goals", distinct=True),
            )
            .order_by("customer_code")
        )

        customer_codes = filters.get("customer_codes") or filters.get("customers") or []
        if isinstance(customer_codes, str):
            customer_codes = [c.strip() for c in customer_codes.split(",") if c.strip()]
        applied = {}
        if customer_codes:
            qs = qs.filter(customer_code__in=customer_codes)
            applied["customers"] = customer_codes

        kyc_statuses = filters.get("kyc_status") or []
        if isinstance(kyc_statuses, str):
            kyc_statuses = [k.strip() for k in kyc_statuses.split(",") if k.strip()]
        if kyc_statuses:
            upper_kyc = [k.upper() for k in kyc_statuses]
            qs = qs.filter(kyc_status__in=upper_kyc)
            applied["kyc_status"] = upper_kyc

        segments = filters.get("segment") or []
        if isinstance(segments, str):
            segments = [s.strip() for s in segments.split(",") if s.strip()]
        if segments:
            upper_segments = [s.upper() for s in segments]
            qs = qs.filter(segment__in=upper_segments)
            applied["segment"] = upper_segments

        headers = [
            "Customer Code",
            "Full Name",
            "Email",
            "Phone",
            "City",
            "State",
            "Date of Birth",
            "KYC Status",
            "Segment",
            "Risk Level",
            "Risk Score",
            "Accounts Count",
            "Goals Count",
            "Onboarded At",
        ]

        rows = []
        for c in qs:
            risk_level = c.risk_level_val or ""
            risk_score = str(c.risk_score_val or "")

            rows.append([
                c.customer_code,
                c.full_name,
                c.email,
                c.phone,
                c.city or "",
                c.state or "",
                str(c.date_of_birth or ""),
                c.kyc_status,
                c.segment,
                risk_level,
                risk_score,
                str(c.accounts_count_val),
                str(c.goals_count_val),
                str(c.onboarded_at or ""),
            ])

        return headers, rows, applied

    @classmethod
    def _build_accounts(cls, filters: dict):
        market_sub = Subquery(
            HoldingSnapshot.objects.filter(account=OuterRef("pk"))
            .order_by()
            .values("account")
            .annotate(val=Sum(F("quantity") * F("instrument__last_price")))
            .values("val")[:1],
            output_field=DecimalField(max_digits=20, decimal_places=4),
        )

        qs = (
            Account.objects.select_related("customer")
            .annotate(current_market_value=Coalesce(market_sub, Value(Decimal("0.0000"))))
            .order_by("account_code")
        )

        customer_codes = filters.get("customer_codes") or filters.get("customers") or []
        if isinstance(customer_codes, str):
            customer_codes = [c.strip() for c in customer_codes.split(",") if c.strip()]
        account_codes = filters.get("account_codes") or filters.get("accounts") or []
        if isinstance(account_codes, str):
            account_codes = [a.strip() for a in account_codes.split(",") if a.strip()]

        applied = {}
        if customer_codes:
            qs = qs.filter(customer__customer_code__in=customer_codes)
            applied["customers"] = customer_codes
        if account_codes:
            qs = qs.filter(account_code__in=account_codes)
            applied["accounts"] = account_codes

        account_types = filters.get("account_type") or filters.get("type") or []
        if isinstance(account_types, str):
            account_types = [t.strip() for t in account_types.split(",") if t.strip()]
        if account_types:
            upper_types = [t.upper() for t in account_types]
            qs = qs.filter(account_type__in=upper_types)
            applied["account_type"] = upper_types

        statuses = filters.get("status") or []
        if isinstance(statuses, str):
            statuses = [s.strip() for s in statuses.split(",") if s.strip()]
        if statuses:
            upper_statuses = [s.upper() for s in statuses]
            qs = qs.filter(status__in=upper_statuses)
            applied["status"] = upper_statuses

        provider = filters.get("provider")
        if provider:
            qs = qs.filter(provider__iexact=provider.strip())
            applied["provider"] = provider.strip()

        headers = [
            "Account Code",
            "Customer Code",
            "Customer Name",
            "Account Type",
            "Provider",
            "Status",
            "Opened At",
            "Current Market Value",
        ]

        rows = []
        for a in qs:
            mv = Decimal(a.current_market_value).quantize(Decimal("0.01"))
            rows.append([
                a.account_code,
                a.customer.customer_code,
                a.customer.full_name,
                a.account_type,
                a.provider or "",
                a.status,
                str(a.opened_at or ""),
                str(mv),
            ])

        return headers, rows, applied

    @classmethod
    def _build_transactions(cls, filters: dict):
        qs = (
            Transaction.objects.select_related("account", "account__customer", "instrument")
            .order_by("-trade_date", "-id")
        )

        customer_codes = filters.get("customer_codes") or filters.get("customers") or []
        if isinstance(customer_codes, str):
            customer_codes = [c.strip() for c in customer_codes.split(",") if c.strip()]
        account_codes = filters.get("account_codes") or filters.get("accounts") or []
        if isinstance(account_codes, str):
            account_codes = [a.strip() for a in account_codes.split(",") if a.strip()]

        applied = {}
        if customer_codes:
            qs = qs.filter(account__customer__customer_code__in=customer_codes)
            applied["customers"] = customer_codes

        if account_codes:
            qs = qs.filter(account__account_code__in=account_codes)
            applied["accounts"] = account_codes

        d_from = parse_date(filters.get("date_from"), "date_from")
        d_to = parse_date(filters.get("date_to"), "date_to")
        if d_from:
            qs = qs.filter(trade_date__gte=d_from)
            applied["date_from"] = str(d_from)
        if d_to:
            qs = qs.filter(trade_date__lte=d_to)
            applied["date_to"] = str(d_to)
        if d_from and d_to and d_from > d_to:
            raise ValidationError({"date_from": ["date_from must be <= date_to."]})

        txn_types = filters.get("transaction_type") or filters.get("type") or []
        if isinstance(txn_types, str):
            txn_types = [t.strip() for t in txn_types.split(",") if t.strip()]
        if txn_types:
            upper_types = [t.upper() for t in txn_types]
            qs = qs.filter(transaction_type__in=upper_types)
            applied["transaction_type"] = upper_types

        statuses = filters.get("status") or []
        if isinstance(statuses, str):
            statuses = [s.strip() for s in statuses.split(",") if s.strip()]
        if statuses:
            upper_statuses = [s.upper() for s in statuses]
            qs = qs.filter(status__in=upper_statuses)
            applied["status"] = upper_statuses

        instrument = filters.get("instrument")
        if instrument:
            qs = qs.filter(
                Q(instrument__instrument_code=instrument)
                | Q(instrument__symbol__icontains=instrument)
            )
            applied["instrument"] = instrument

        headers = [
            "Transaction Code",
            "Trade Date",
            "Customer Code",
            "Customer Name",
            "Account Code",
            "Account Type",
            "Provider",
            "Symbol",
            "Instrument Name",
            "Type",
            "Quantity",
            "Price",
            "Amount",
            "Status",
        ]

        rows = []
        for txn in qs:
            rows.append([
                txn.transaction_code,
                str(txn.trade_date),
                txn.account.customer.customer_code,
                txn.account.customer.full_name,
                txn.account.account_code,
                txn.account.account_type,
                txn.account.provider or "",
                txn.instrument.symbol,
                txn.instrument.instrument_name,
                txn.transaction_type,
                str(txn.quantity),
                str(txn.price),
                str(txn.amount),
                txn.status,
            ])

        return headers, rows, applied

    @classmethod
    def _build_portfolio_positions(cls, filters: dict):
        qs = (
            HoldingSnapshot.objects.select_related("account", "account__customer", "instrument")
            .order_by("account__customer__customer_code", "account__account_code", "instrument__symbol")
        )

        customer_codes = filters.get("customer_codes") or filters.get("customers") or []
        if isinstance(customer_codes, str):
            customer_codes = [c.strip() for c in customer_codes.split(",") if c.strip()]
        account_codes = filters.get("account_codes") or filters.get("accounts") or []
        if isinstance(account_codes, str):
            account_codes = [a.strip() for a in account_codes.split(",") if a.strip()]

        applied = {}
        if customer_codes:
            qs = qs.filter(account__customer__customer_code__in=customer_codes)
            applied["customers"] = customer_codes

        if account_codes:
            qs = qs.filter(account__account_code__in=account_codes)
            applied["accounts"] = account_codes

        asset_classes = filters.get("asset_class") or []
        if isinstance(asset_classes, str):
            asset_classes = [a.strip() for a in asset_classes.split(",") if a.strip()]
        if asset_classes:
            upper_ac = [ac.upper() for ac in asset_classes]
            qs = qs.filter(instrument__asset_class__in=upper_ac)
            applied["asset_class"] = upper_ac

        s_date = parse_date(filters.get("snapshot_date") or filters.get("as_of"), "snapshot_date")
        if s_date:
            qs = qs.filter(snapshot_date=s_date)
            applied["snapshot_date"] = str(s_date)

        headers = [
            "Customer Code",
            "Customer Name",
            "Account Code",
            "Account Type",
            "Provider",
            "Symbol",
            "Instrument Name",
            "Asset Class",
            "Quantity",
            "Average Cost",
            "Last Price",
            "Market Value",
            "Cost Value",
            "Unrealised PL",
            "Unrealised PL %",
            "Snapshot Date",
            "Price As Of",
        ]

        rows = []
        for pos in qs:
            inst = pos.instrument
            qty = pos.quantity
            avg_cost = pos.avg_cost
            last_price = inst.last_price

            mv = (qty * last_price).quantize(Decimal("0.01"))
            cv = (qty * avg_cost).quantize(Decimal("0.01"))
            upl = mv - cv
            upl_pct = ((upl / cv) * 100).quantize(Decimal("0.01")) if cv > 0 else Decimal("0.00")

            rows.append([
                pos.account.customer.customer_code,
                pos.account.customer.full_name,
                pos.account.account_code,
                pos.account.account_type,
                pos.account.provider or "",
                inst.symbol,
                inst.instrument_name,
                inst.asset_class,
                str(qty),
                str(avg_cost),
                str(last_price),
                str(mv),
                str(cv),
                str(upl),
                str(upl_pct),
                str(pos.snapshot_date),
                str(inst.price_as_of or ""),
            ])

        return headers, rows, applied

    @classmethod
    def _build_goals(cls, filters: dict):
        qs = Goal.objects.select_related("customer").order_by("customer__customer_code", "target_date")

        customer_codes = filters.get("customer_codes") or filters.get("customers") or []
        if isinstance(customer_codes, str):
            customer_codes = [c.strip() for c in customer_codes.split(",") if c.strip()]
        applied = {}
        if customer_codes:
            qs = qs.filter(customer__customer_code__in=customer_codes)
            applied["customers"] = customer_codes

        priorities = filters.get("priority") or []
        if isinstance(priorities, str):
            priorities = [p.strip() for p in priorities.split(",") if p.strip()]
        if priorities:
            upper_priorities = [p.upper() for p in priorities]
            qs = qs.filter(priority__in=upper_priorities)
            applied["priority"] = upper_priorities

        td_from = parse_date(filters.get("target_date_from"), "target_date_from")
        td_to = parse_date(filters.get("target_date_to"), "target_date_to")
        if td_from:
            qs = qs.filter(target_date__gte=td_from)
            applied["target_date_from"] = str(td_from)
        if td_to:
            qs = qs.filter(target_date__lte=td_to)
            applied["target_date_to"] = str(td_to)
        if td_from and td_to and td_from > td_to:
            raise ValidationError({"target_date_from": ["target_date_from must be <= target_date_to."]})

        headers = [
            "Goal Code",
            "Customer Code",
            "Customer Name",
            "Goal Name",
            "Goal Type",
            "Target Amount",
            "Current Funded Amount",
            "Funded %",
            "Target Date",
            "Priority",
            "Status Flags",
        ]

        rows = []
        today = timezone.localdate()
        for g in qs:
            funded_pct = (
                f"{((g.current_funded_amount / g.target_amount) * 100):.2f}"
                if g.target_amount > 0
                else "0.00"
            )
            flags = []
            if g.current_funded_amount >= g.target_amount:
                flags.append("FUNDED")
            if g.current_funded_amount > g.target_amount:
                flags.append("INCONSISTENT")
            if g.target_date < today and g.current_funded_amount < g.target_amount:
                flags.append("OVERDUE")

            rows.append([
                g.goal_code,
                g.customer.customer_code,
                g.customer.full_name,
                g.goal_name,
                g.goal_type,
                str(g.target_amount),
                str(g.current_funded_amount),
                funded_pct,
                str(g.target_date),
                g.priority,
                "; ".join(flags),
            ])

        return headers, rows, applied
