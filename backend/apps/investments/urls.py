from django.urls import path

from apps.investments.views import (
    AccountListAPIViewSet,
    CustomerPortfolioAPIView,
    CustomerTransactionsAPIViewSet,
)

txn_list = CustomerTransactionsAPIViewSet.as_view({"get": "list"})
account_list = AccountListAPIViewSet.as_view({"get": "list"})
account_providers = AccountListAPIViewSet.as_view({"get": "providers"})
account_lookup = AccountListAPIViewSet.as_view({"get": "lookup"})

urlpatterns = [
    path("accounts/", account_list, name="account-list"),
    path("accounts/providers/", account_providers, name="account-providers"),
    path("accounts/lookup/", account_lookup, name="account-lookup"),
    path("customers/<str:customer_code>/portfolio/", CustomerPortfolioAPIView.as_view(), name="customer-portfolio"),
    path("customers/<str:customer_code>/transactions/", txn_list, name="customer-transactions"),
]
