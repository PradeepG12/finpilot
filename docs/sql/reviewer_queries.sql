-- =============================================================================
-- FinPilot Reviewer Queries
-- Written against reporting views and base tables.
-- Runnable against seeded PostgreSQL database.
-- =============================================================================

-- Query 1: Top 10 Customers by Assets Under Management (AUM)
-- Expected result: 10 rows with customer_code, full_name, market_value, positions_count
SELECT
    c.customer_code,
    c.full_name,
    c.segment,
    aum.market_value,
    aum.cost_value,
    aum.unrealised_pl,
    aum.positions_count
FROM vw_customer_aum aum
JOIN customers_customer c ON c.id = aum.customer_id
ORDER BY aum.market_value DESC
LIMIT 10;

-- Query 2: Asset-Class Allocation for customer C0014 and Firm-Wide
-- Customer C0014 allocation:
SELECT
    asset_class,
    market_value,
    weight_pct
FROM vw_customer_asset_allocation
WHERE customer_id = (SELECT id FROM customers_customer WHERE customer_code = 'C0014')
ORDER BY market_value DESC;

-- Firm-Wide allocation:
WITH total AS (
    SELECT SUM(market_value) AS firm_aum FROM vw_position_valuation
)
SELECT
    pv.asset_class,
    SUM(pv.market_value)::numeric(18,2) AS market_value,
    ROUND((SUM(pv.market_value) / t.firm_aum) * 100, 2) AS firm_weight_pct
FROM vw_position_valuation pv
CROSS JOIN total t
GROUP BY pv.asset_class, t.firm_aum
ORDER BY market_value DESC;

-- Query 3: Monthly Settled Net Flow (Last 12 Months)
-- Net flow = Settled SELL amount - Settled BUY amount (positive = cash returned)
SELECT
    month,
    buy_total,
    sell_total,
    net_flow
FROM vw_monthly_net_flow
ORDER BY month DESC
LIMIT 12;

-- Query 4: Top 10 Instruments by Distinct Account Holders
SELECT
    i.instrument_code,
    i.symbol,
    i.instrument_name,
    i.asset_class,
    COUNT(DISTINCT h.account_id) AS distinct_holders_count
FROM investments_holdingsnapshot h
JOIN investments_instrument i ON i.id = h.instrument_id
GROUP BY i.id, i.instrument_code, i.symbol, i.instrument_name, i.asset_class
ORDER BY distinct_holders_count DESC
LIMIT 10;

-- Query 5: Customers with HIGH-Priority Goals Less Than 25% Funded
SELECT
    c.customer_code,
    c.full_name,
    g.goal_code,
    g.goal_name,
    g.target_amount,
    g.current_funded_amount,
    ROUND((g.current_funded_amount / g.target_amount) * 100, 2) AS funded_percent,
    g.target_date
FROM goals_goal g
JOIN customers_customer c ON c.id = g.customer_id
WHERE g.priority = 'HIGH'
  AND (g.current_funded_amount / g.target_amount) < 0.25
ORDER BY g.target_date ASC;

-- Query 6: Data Quality Exceptions and Rejections Breakdown
-- Ingest rejections (from imports):
SELECT
    outcome,
    error_code,
    COUNT(*) AS count
FROM imports_importrowerror
GROUP BY outcome, error_code
ORDER BY count DESC;

-- Structural ledger and policy exceptions (from SQL view):
SELECT
    exception_code,
    entity_type,
    COUNT(*) AS count
FROM vw_data_quality_exceptions
GROUP BY exception_code, entity_type
ORDER BY count DESC;
