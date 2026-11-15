"""Views for customer list and detail."""

from decimal import Decimal

from django.db.models import (
    Case,
    Count,
    DecimalField,
    F,
    OuterRef,
    Q,
    Subquery,
    Sum,
    Value,
    When,
)
from django.db.models.functions import Coalesce
from rest_framework.exceptions import NotFound

from apps.common.views.base import AppAPIView
from apps.common.views.generic import AppModelListAPIViewSet
from apps.customers.models import Customer, RiskProfile
from apps.customers.serializers import CustomerDetailSerializer, CustomerListSerializer
from apps.investments.models import HoldingSnapshot


class CustomerListAPIViewSet(AppModelListAPIViewSet):
    """
    Lists customers with search across code/name/email/city,
    and filter by kyc_status, segment, city, state, risk_level (supports comma-separated multi-select).
    Includes accounts_count and unrealised_pl_pct.
    """

    serializer_class = CustomerListSerializer
    search_fields = ["customer_code", "full_name", "email", "city"]
    ordering_fields = [
        "full_name",
        "customer_code",
        "onboarded_at",
        "created",
        "accounts_count",
        "unrealised_pl_pct",
    ]

    def get_queryset(self):
        latest_risk = RiskProfile.objects.filter(customer=OuterRef("pk")).order_by("-assessed_at")

        # Subquery for holding snapshot total cost and total market value
        cost_sub = Subquery(
            HoldingSnapshot.objects.filter(account__customer=OuterRef("pk"))
            .order_by()
            .values("account__customer")
            .annotate(val=Sum(F("quantity") * F("avg_cost")))
            .values("val")[:1],
            output_field=DecimalField(max_digits=20, decimal_places=4),
        )

        market_sub = Subquery(
            HoldingSnapshot.objects.filter(account__customer=OuterRef("pk"))
            .order_by()
            .values("account__customer")
            .annotate(val=Sum(F("quantity") * F("instrument__last_price")))
            .values("val")[:1],
            output_field=DecimalField(max_digits=20, decimal_places=4),
        )

        qs = Customer.objects.annotate(
            risk_level=Subquery(latest_risk.values("risk_level")[:1]),
            accounts_count=Count("accounts", distinct=True),
            total_cost=Coalesce(cost_sub, Value(Decimal("0.0000"))),
            total_market=Coalesce(market_sub, Value(Decimal("0.0000"))),
        ).annotate(
            unrealised_pl_pct=Case(
                When(
                    total_cost__gt=0,
                    then=(F("total_market") - F("total_cost")) * Value(100) / F("total_cost"),
                ),
                default=Value(None),
                output_field=DecimalField(max_digits=10, decimal_places=4),
            )
        )

        # Filters with multi-select support (comma-separated or single)
        params = getattr(self.request, "query_params", getattr(self.request, "GET", {}))

        kyc_status = params.get("kyc_status")
        if kyc_status:
            kyc_list = [k.strip() for k in kyc_status.split(",") if k.strip()]
            qs = qs.filter(kyc_status__in=kyc_list)

        segment = params.get("segment")
        if segment:
            seg_list = [s.strip() for s in segment.split(",") if s.strip()]
            qs = qs.filter(segment__in=seg_list)

        city = params.get("city")
        if city:
            city_list = [c.strip() for c in city.split(",") if c.strip()]
            qs = qs.filter(city__in=city_list)

        state = params.get("state")
        if state:
            state_list = [st.strip().upper() for st in state.split(",") if st.strip()]
            qs = qs.filter(state__in=state_list)

        risk_level = params.get("risk_level")
        if risk_level:
            risk_list = [r.strip().upper() for r in risk_level.split(",") if r.strip()]
            qs = qs.filter(risk_level__in=risk_list)

        if not params.get("ordering"):
            qs = qs.order_by("customer_code")

        return qs


class CustomerDetailAPIView(AppAPIView):
    """Retrieves full profile for a customer by customer_code."""

    def get(self, request, customer_code, *args, **kwargs):
        try:
            customer = Customer.objects.annotate(
                accounts_count=Count("accounts", distinct=True),
                goals_count=Count("goals", distinct=True),
            ).get(customer_code=customer_code)
        except Customer.DoesNotExist:
            raise NotFound(detail=f"Customer '{customer_code}' not found.")

        serializer = CustomerDetailSerializer(customer)
        return self.send_response(serializer.data)


class CustomerLocationsAPIView(AppAPIView):
    """Returns distinct states and cities from customer data for filtering."""

    def get(self, request, *args, **kwargs):
        state_names = {
            "DL": "Delhi (DL)",
            "GJ": "Gujarat (GJ)",
            "KA": "Karnataka (KA)",
            "KL": "Kerala (KL)",
            "MH": "Maharashtra (MH)",
            "RJ": "Rajasthan (RJ)",
            "TN": "Tamil Nadu (TN)",
            "TS": "Telangana (TS)",
            "WB": "West Bengal (WB)",
        }

        locations = (
            Customer.objects.exclude(city__isnull=True)
            .exclude(city="")
            .values("state", "city")
            .distinct()
            .order_by("state", "city")
        )

        states_dict = {}
        cities = []

        for item in locations:
            st = item["state"]
            ct = item["city"]
            if st:
                st_code = st.upper()
                if st_code not in states_dict:
                    states_dict[st_code] = {
                        "code": st_code,
                        "name": state_names.get(st_code, f"{st_code} ({st_code})"),
                    }
            if ct:
                cities.append({
                    "name": ct,
                    "state": st.upper() if st else "",
                })

        return self.send_response({
            "states": sorted(list(states_dict.values()), key=lambda x: x["name"]),
            "cities": sorted(cities, key=lambda x: x["name"]),
        })


class CustomerLookupAPIView(AppAPIView):
    """Returns lightweight customer list for multi-select dropdowns."""

    def get(self, request, *args, **kwargs):
        qs = Customer.objects.all().order_by("full_name")
        search = request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(customer_code__icontains=search)
                | Q(full_name__icontains=search)
                | Q(email__icontains=search)
            )
        data = [
            {
                "customer_code": c.customer_code,
                "full_name": c.full_name,
                "email": c.email,
            }
            for c in qs
        ]
        return self.send_response(data)


