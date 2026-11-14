from django.urls import path

from apps.goals.views import CustomerGoalsAPIView, GoalDetailAPIView

urlpatterns = [
    path("customers/<str:customer_code>/goals/", CustomerGoalsAPIView.as_view(), name="customer-goals"),
    path("goals/<uuid:uuid>/", GoalDetailAPIView.as_view(), name="goal-detail"),
]
