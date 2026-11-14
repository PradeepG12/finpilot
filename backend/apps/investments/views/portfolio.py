"""Portfolio view implementation."""

import datetime
from decimal import Decimal

from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import NotFound

from apps.common.views.base import AppAPIView
from apps.customers.models import Customer
from apps.investments.models import Account, HoldingSnapshot


class CustomerPortfolioAPIView(AppAPIView):
    """Retrieves consolidated customer portfolio in <= 3 SQL queries."""

    def get(self, request, customer_code, *args, **kwargs):
        try:
            customer = Customer.objects.get(customer_code=customer_code)
        except Customer.DoesNotExist:
            raise NotFound(detail=f"Customer '{customer_code}' not found.")

        # Query 1: Accounts list with account metadata
        accounts = list(
            Account.objects.filter(customer=customer)
            .values("id", "account_code", "account_type", "provider", "status", "opened_at")
            .order_by("account_code")
        )

        account_ids = [acc["id"] for acc in accounts]

        # Query 2: All positions for this customer's accounts with instrument details
        positions_qs = (
            HoldingSnapshot.objects.filter(account_id__in=account_ids)
            .select_related("instrument", "account")
            .order_by("instrument__instrument_code")
        )

        positions_by_account = {acc["id"]: [] for acc in accounts}
        total_market_value = Decimal("0.00")
        total_cost_value = Decimal("0.00")
        latest_price_date = None
        latest_snapshot_date = None

        allocation_dict = {}

        for pos in positions_qs:
            inst = pos.instrument
            qty = pos.quantity
            avg_cost = pos.avg_cost
            last_price = inst.last_price
            mv = (qty * last_price).quantize(Decimal("0.01"))
            cv = (qty * avg_cost).quantize(Decimal("0.01"))
            upl = mv - cv
            upl_pct = ((upl / cv) * 100).quantize(Decimal("0.01")) if cv > 0 else Decimal("0.00")

            total_market_value += mv
            total_cost_value += cv

            if inst.price_as_of and (latest_price_date is None or inst.price_as_of > latest_price_date):
                latest_price_date = inst.price_as_of
            if pos.snapshot_date and (latest_snapshot_date is None or pos.snapshot_date > latest_snapshot_date):
                latest_snapshot_date = pos.snapshot_date

            asset_class = inst.asset_class
            allocation_dict[asset_class] = allocation_dict.get(asset_class, Decimal("0.00")) + mv

            positions_by_account[pos.account_id].append(
                {
                    "instrument_code": inst.instrument_code,
                    "symbol": inst.symbol,
                    "name": inst.instrument_name,
                    "asset_class": inst.asset_class,
                    "quantity": str(qty),
                    "avg_cost": str(avg_cost),
                    "last_price": str(last_price),
                    "market_value": str(mv),
                    "unrealised_pl": str(upl),
                    "unrealised_pl_pct": str(upl_pct),
                }
            )

        accounts_data = []
        for acc in accounts:
            acc_id = acc["id"]
            acc_positions = positions_by_account[acc_id]
            acc_mv = sum(Decimal(p["market_value"]) for p in acc_positions) if acc_positions else Decimal("0.00")
            acc_cv = sum(Decimal(p["quantity"]) * Decimal(p["avg_cost"]) for p in acc_positions).quantize(Decimal("0.01")) if acc_positions else Decimal("0.00")
            acc_upl = acc_mv - acc_cv
            acc_upl_pct = ((acc_upl / acc_cv) * 100).quantize(Decimal("0.01")) if acc_cv > 0 else Decimal("0.00")

            accounts_data.append(
                {
                    "account_code": acc["account_code"],
                    "account_type": acc["account_type"],
                    "provider": acc["provider"],
                    "status": acc["status"],
                    "opened_at": str(acc["opened_at"]) if acc["opened_at"] else None,
                    "totals": {
                        "market_value": str(acc_mv),
                        "cost_value": str(acc_cv),
                        "unrealised_pl": str(acc_upl),
                        "unrealised_pl_pct": str(acc_upl_pct),
                    },
                    "positions": acc_positions,
                }
            )

        total_upl = total_market_value - total_cost_value
        total_upl_pct = (
            ((total_upl / total_cost_value) * 100).quantize(Decimal("0.01"))
            if total_cost_value > 0
            else Decimal("0.00")
        )

        allocation_list = []
        for ac, ac_mv in sorted(allocation_dict.items()):
            weight = ((ac_mv / total_market_value) * 100).quantize(Decimal("0.01")) if total_market_value > 0 else Decimal("0.00")
            allocation_list.append(
                {
                    "asset_class": ac,
                    "market_value": str(ac_mv),
                    "weight_pct": str(weight),
                }
            )

        today = timezone.localdate()
        reference_date = latest_price_date or datetime.date(2026, 9, 18)
        age_days = (today - reference_date).days if today > reference_date else 0
        stale_threshold = getattr(settings, "STALE_DATA_DAYS", 7)
        is_stale = age_days > stale_threshold

        response_payload = {
            "customer_code": customer.customer_code,
            "currency": "INR",
            "as_of": {
                "snapshot_date": str(latest_snapshot_date or "2026-09-18"),
                "price_date": str(latest_price_date or "2026-09-18"),
                "stale": is_stale,
                "age_days": age_days,
            },
            "totals": {
                "market_value": str(total_market_value),
                "cost_value": str(total_cost_value),
                "unrealised_pl": str(total_upl),
                "unrealised_pl_pct": str(total_upl_pct),
            },
            "allocation": allocation_list,
            "accounts": accounts_data,
        }

        return self.send_response(response_payload)
