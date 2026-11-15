from django.urls import path

from apps.customers.views import (
    CustomerDetailAPIView,
    CustomerListAPIViewSet,
    CustomerLocationsAPIView,
    CustomerLookupAPIView,
)

customer_list = CustomerListAPIViewSet.as_view({"get": "list"})

urlpatterns = [
    path("customers/", customer_list, name="customer-list"),
    path("customers/locations/", CustomerLocationsAPIView.as_view(), name="customer-locations"),
    path("customers/lookup/", CustomerLookupAPIView.as_view(), name="customer-lookup"),
    path("customers/<str:customer_code>/", CustomerDetailAPIView.as_view(), name="customer-detail"),
]
