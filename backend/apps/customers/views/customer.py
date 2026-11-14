"""Views for customer list and detail."""

from django.db.models import Count, OuterRef, Subquery
from rest_framework.exceptions import NotFound

from apps.common.views.base import AppAPIView
from apps.common.views.generic import AppModelListAPIViewSet
from apps.customers.models import Customer, RiskProfile
from apps.customers.serializers import CustomerDetailSerializer, CustomerListSerializer


class CustomerListAPIViewSet(AppModelListAPIViewSet):
    """Lists customers with search across code/name/email/city and filter by kyc_status/segment/city."""

    serializer_class = CustomerListSerializer
    filterset_fields = ["kyc_status", "segment", "city"]
    search_fields = ["customer_code", "full_name", "email", "city"]
    ordering_fields = ["full_name", "customer_code", "onboarded_at", "created"]

    def get_queryset(self):
        latest_risk = RiskProfile.objects.filter(customer=OuterRef("pk")).order_by("-assessed_at")
        return Customer.objects.annotate(
            risk_level=Subquery(latest_risk.values("risk_level")[:1]),
        )


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
