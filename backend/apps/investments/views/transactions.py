"""Transactions view implementation."""

from rest_framework.exceptions import NotFound, ValidationError

from apps.common.views.generic import AppModelListAPIViewSet
from apps.customers.models import Customer
from apps.investments.models import Transaction
from apps.investments.serializers.transaction import TransactionListSerializer


class CustomerTransactionsAPIViewSet(AppModelListAPIViewSet):
    """Paginated transactions for a customer, filterable by date range, account, instrument, type, status."""

    serializer_class = TransactionListSerializer
    filterset_fields = ["transaction_type", "status"]
    ordering_fields = ["trade_date", "amount", "id"]

    def get_queryset(self):
        customer_code = self.kwargs.get("customer_code")
        try:
            customer = Customer.objects.get(customer_code=customer_code)
        except Customer.DoesNotExist:
            raise NotFound(detail=f"Customer '{customer_code}' not found.")

        qs = (
            Transaction.objects.filter(account__customer=customer)
            .select_related("account", "instrument")
            .order_by("-trade_date", "-id")
        )

        params = self.request.query_params
        date_from = params.get("date_from")
        date_to = params.get("date_to")
        account_code = params.get("account")
        instrument_code = params.get("instrument")

        if date_from and date_to and date_from > date_to:
            raise ValidationError({"date_from": ["date_from must be <= date_to."]})

        if date_from:
            qs = qs.filter(trade_date__gte=date_from)
        if date_to:
            qs = qs.filter(trade_date__lte=date_to)
        if account_code:
            qs = qs.filter(account__account_code=account_code)
        if instrument_code:
            qs = qs.filter(instrument__instrument_code=instrument_code)

        return qs
