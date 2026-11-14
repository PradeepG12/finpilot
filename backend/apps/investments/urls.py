from django.urls import path

from apps.investments.views import CustomerPortfolioAPIView, CustomerTransactionsAPIViewSet

txn_list = CustomerTransactionsAPIViewSet.as_view({"get": "list"})

urlpatterns = [
    path("customers/<str:customer_code>/portfolio/", CustomerPortfolioAPIView.as_view(), name="customer-portfolio"),
    path("customers/<str:customer_code>/transactions/", txn_list, name="customer-transactions"),
]
