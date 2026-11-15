"""Views for managing financial goals."""

from django.db import connection, transaction
from django.db.models import Q
from rest_framework import status
from rest_framework.exceptions import NotFound


from apps.common.views.base import AppAPIView
from apps.customers.models import Customer
from apps.goals.models import Goal
from apps.goals.serializers.goal import GoalCreateSerializer, GoalSerializer, GoalUpdateSerializer


class CustomerGoalsAPIView(AppAPIView):
    """Lists or creates goals for a specific customer."""

    def get(self, request, customer_code, *args, **kwargs):
        try:
            customer = Customer.objects.get(customer_code=customer_code)
        except Customer.DoesNotExist:
            raise NotFound(detail=f"Customer '{customer_code}' not found.")

        goals = Goal.objects.filter(customer=customer).order_by("target_date")

        priority = request.query_params.get("priority")
        if priority:
            goals = goals.filter(priority=priority.upper())

        search = request.query_params.get("search")
        if search:
            goals = goals.filter(
                Q(goal_name__icontains=search)
                | Q(goal_code__icontains=search)
                | Q(goal_type__icontains=search)
            )

        serializer = GoalSerializer(goals, many=True)
        return self.send_response(serializer.data)

    def post(self, request, customer_code, *args, **kwargs):
        try:
            customer = Customer.objects.get(customer_code=customer_code)
        except Customer.DoesNotExist:
            raise NotFound(detail=f"Customer '{customer_code}' not found.")

        serializer = GoalCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("SELECT nextval('goals_goal_code_seq');")
                next_val = cursor.fetchone()[0]
                goal_code = f"G{next_val:05d}"

            goal = Goal.objects.create(
                goal_code=goal_code,
                customer=customer,
                created_by=request.user if request.user and request.user.is_authenticated else None,
                **serializer.validated_data,
            )

        return self.send_response(GoalSerializer(goal).data, status_code=status.HTTP_201_CREATED)


class GoalDetailAPIView(AppAPIView):
    """Partially updates a goal by its UUID."""

    def patch(self, request, uuid, *args, **kwargs):
        try:
            goal = Goal.objects.get(uuid=uuid)
        except Goal.DoesNotExist:
            raise NotFound(detail=f"Goal '{uuid}' does not exist.")

        serializer = GoalUpdateSerializer(goal, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            goal = serializer.save(
                modified_by=request.user if request.user and request.user.is_authenticated else None
            )

        return self.send_response(GoalSerializer(goal).data)
