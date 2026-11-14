import pytest
from apps.investments.tests.test_valuation_math import ValuationMathUnitTests, GoalFlagsUnitTests

def test_math_runner():
    t = ValuationMathUnitTests()
    t.test_market_value_and_unrealised_pl()
    t.test_negative_pl_calculation()

def test_goal_flags_runner():
    g = GoalFlagsUnitTests()
    g.test_goal_funded_and_overdue_flags()
