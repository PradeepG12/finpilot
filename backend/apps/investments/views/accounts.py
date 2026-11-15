"""Views for investment accounts."""

from decimal import Decimal

from django.db.models import DecimalField, F, OuterRef, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from rest_framework import permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.views.generic import AppModelListAPIViewSet
from apps.investments.models import Account, HoldingSnapshot
from apps.investments.serializers import AccountListSerializer


class AccountListAPIViewSet(AppModelListAPIViewSet):
    """
    Paginated account list viewset.
    Supports server-side search across account_code, customer_code, customer_name, and provider.
    Supports filtering by account_type, status, provider, and customer.
    Supports sorting by account_code, customer, type, provider, opened_date, and current_market_value.
    Calculates current_market_value without N+1 queries.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = AccountListSerializer
    search_fields = ["account_code", "customer__customer_code", "customer__full_name", "provider"]
    ordering_fields = [
        "account_code",
        "customer__full_name",
        "customer__customer_code",
        "customer",
        "account_type",
        "type",
        "provider",
        "opened_at",
        "opened_date",
        "current_market_value",
    ]

    def get_queryset(self):
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
        )

        params = getattr(self.request, "query_params", getattr(self.request, "GET", {}))

        # Filter by account_type
        account_type = params.get("account_type") or params.get("type")
        if account_type:
            types = [t.strip().upper() for t in account_type.split(",") if t.strip()]
            if types:
                qs = qs.filter(account_type__in=types)

        # Filter by status
        status_param = params.get("status") or params.get("account_status")
        if status_param:
            statuses = [s.strip().upper() for s in status_param.split(",") if s.strip()]
            if statuses:
                qs = qs.filter(status__in=statuses)

        # Filter by provider
        provider_param = params.get("provider")
        if provider_param:
            providers = [p.strip() for p in provider_param.split(",") if p.strip()]
            if providers:
                qs = qs.filter(provider__in=providers)

        # Filter by customer code
        customer_code = params.get("customer") or params.get("customer_code")
        if customer_code:
            cust_list = [c.strip() for c in customer_code.split(",") if c.strip()]
            if cust_list:
                qs = qs.filter(customer__customer_code__in=cust_list)

        # Custom sorting aliases
        ordering = params.get("ordering")
        if ordering:
            ordering_map = {
                "customer": "customer__full_name",
                "-customer": "-customer__full_name",
                "customer_name": "customer__full_name",
                "-customer_name": "-customer__full_name",
                "customer_code": "customer__customer_code",
                "-customer_code": "-customer__customer_code",
                "type": "account_type",
                "-type": "-account_type",
                "opened_date": "opened_at",
                "-opened_date": "-opened_at",
            }
            if ordering in ordering_map:
                qs = qs.order_by(ordering_map[ordering])
        else:
            qs = qs.order_by("account_code")

        return qs

    @action(methods=["GET"], detail=False, url_path="providers")
    def providers(self, request, *args, **kwargs):
        """Returns distinct non-empty provider names."""
        providers = list(
            Account.objects.exclude(provider__isnull=True)
            .exclude(provider="")
            .values_list("provider", flat=True)
            .distinct()
            .order_by("provider")
        )
        return Response({"status": "success", "data": providers})

    @action(methods=["GET"], detail=False, url_path="lookup")
    def lookup(self, request, *args, **kwargs):
        """Returns lightweight accounts lookup for multi-selects."""
        qs = Account.objects.select_related("customer").order_by("account_code")
        customer_codes = request.query_params.get("customers") or request.query_params.get("customer_codes")
        if customer_codes:
            code_list = [c.strip() for c in customer_codes.split(",") if c.strip()]
            if code_list:
                qs = qs.filter(customer__customer_code__in=code_list)

        data = [
            {
                "account_code": a.account_code,
                "customer_code": a.customer.customer_code,
                "customer_name": a.customer.full_name,
                "account_type": a.account_type,
                "provider": a.provider,
                "status": a.status,
            }
            for a in qs
        ]
        return Response({"status": "success", "data": data})
