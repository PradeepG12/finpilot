from django.urls import path

from apps.customers.views import CustomerDetailAPIView, CustomerListAPIViewSet

customer_list = CustomerListAPIViewSet.as_view({"get": "list"})

urlpatterns = [
    path("customers/", customer_list, name="customer-list"),
    path("customers/<str:customer_code>/", CustomerDetailAPIView.as_view(), name="customer-detail"),
]
