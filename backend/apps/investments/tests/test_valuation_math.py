"""Unit tests for investment valuation math, goal percentages, and flags."""

import datetime
from decimal import Decimal
from django.test import SimpleTestCase

from apps.goals.serializers.goal import GoalSerializer
from apps.goals.models import Goal


class ValuationMathUnitTests(SimpleTestCase):
    """Verifies core financial math formulas."""

    def test_market_value_and_unrealised_pl(self):
        # market_value = quantity * last_price
        qty = Decimal("150.500000")
        avg_cost = Decimal("100.0000")
        last_price = Decimal("125.5000")

        cost_value = (qty * avg_cost).quantize(Decimal("0.01"))
        market_value = (qty * last_price).quantize(Decimal("0.01"))
        unrealised_pl = market_value - cost_value
        unrealised_pl_pct = ((unrealised_pl / cost_value) * 100).quantize(Decimal("0.01"))

        self.assertEqual(cost_value, Decimal("15050.00"))
        self.assertEqual(market_value, Decimal("18887.75"))
        self.assertEqual(unrealised_pl, Decimal("3837.75"))
        self.assertEqual(unrealised_pl_pct, Decimal("25.50"))

    def test_negative_pl_calculation(self):
        qty = Decimal("50.000000")
        avg_cost = Decimal("200.0000")
        last_price = Decimal("150.0000")

        cost_value = (qty * avg_cost).quantize(Decimal("0.01"))
        market_value = (qty * last_price).quantize(Decimal("0.01"))
        unrealised_pl = market_value - cost_value
        unrealised_pl_pct = ((unrealised_pl / cost_value) * 100).quantize(Decimal("0.01"))

        self.assertEqual(unrealised_pl, Decimal("-2500.00"))
        self.assertEqual(unrealised_pl_pct, Decimal("-25.00"))


class GoalFlagsUnitTests(SimpleTestCase):
    """Verifies goal funded % and derived flags."""

    def test_goal_funded_and_overdue_flags(self):
        today = datetime.date.today()
        past_date = today - datetime.timedelta(days=10)
        future_date = today + datetime.timedelta(days=100)

        serializer = GoalSerializer()

        # Overdue goal
        goal_overdue = Goal(
            target_amount=Decimal("100000.00"),
            current_funded_amount=Decimal("50000.00"),
            target_date=past_date,
        )
        flags = serializer.get_flags(goal_overdue)
        self.assertIn("OVERDUE", flags)
        self.assertNotIn("FUNDED", flags)

        # Fully funded goal
        goal_funded = Goal(
            target_amount=Decimal("50000.00"),
            current_funded_amount=Decimal("50000.00"),
            target_date=future_date,
        )
        flags = serializer.get_flags(goal_funded)
        self.assertIn("FUNDED", flags)
        self.assertNotIn("OVERDUE", flags)

        # Inconsistent (overfunded) goal
        goal_overfunded = Goal(
            target_amount=Decimal("50000.00"),
            current_funded_amount=Decimal("60000.00"),
            target_date=future_date,
        )
        flags = serializer.get_flags(goal_overfunded)
        self.assertIn("FUNDED", flags)
        self.assertIn("INCONSISTENT", flags)
