"""Migration to create SQL views for FinPilot reporting."""

from django.db import migrations


CREATE_TRGM_EXTENSION = "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
DROP_TRGM_EXTENSION = ""

CREATE_VW_POSITION_VALUATION = """
CREATE OR REPLACE VIEW vw_position_valuation AS
SELECT
    h.id,
    h.account_id,
    a.account_code,
    a.customer_id,
    h.instrument_id,
    i.instrument_code,
    i.symbol,
    i.instrument_name,
    i.asset_class,
    h.quantity,
    h.avg_cost,
    i.last_price,
    (h.quantity * i.last_price)::numeric(18,2)                                       AS market_value,
    (h.quantity * h.avg_cost)::numeric(18,2)                                         AS cost_value,
    (h.quantity * i.last_price - h.quantity * h.avg_cost)::numeric(18,2)             AS unrealised_pl,
    CASE
        WHEN h.avg_cost = 0 THEN NULL
        ELSE ROUND(
            (h.quantity * i.last_price - h.quantity * h.avg_cost)
            / (h.quantity * h.avg_cost) * 100,
        4)
    END                                                                               AS unrealised_pl_pct,
    h.snapshot_date,
    i.price_as_of
FROM investments_holdingsnapshot h
JOIN investments_account a   ON a.id = h.account_id
JOIN investments_instrument i ON i.id = h.instrument_id;
"""
DROP_VW_POSITION_VALUATION = "DROP VIEW IF EXISTS vw_position_valuation;"

CREATE_VW_ACCOUNT_TOTALS = """
CREATE OR REPLACE VIEW vw_account_totals AS
SELECT
    a.id                                              AS account_id,
    a.account_code,
    a.customer_id,
    COALESCE(SUM(pv.market_value), 0)::numeric(18,2)  AS market_value,
    COALESCE(SUM(pv.cost_value), 0)::numeric(18,2)    AS cost_value,
    COALESCE(SUM(pv.unrealised_pl), 0)::numeric(18,2) AS unrealised_pl,
    CASE
        WHEN COALESCE(SUM(pv.cost_value), 0) = 0 THEN NULL
        ELSE ROUND(COALESCE(SUM(pv.unrealised_pl), 0) / SUM(pv.cost_value) * 100, 4)
    END                                               AS unrealised_pl_pct,
    COUNT(pv.id)                                      AS positions_count,
    MAX(pv.snapshot_date)                             AS snapshot_date
FROM investments_account a
LEFT JOIN vw_position_valuation pv ON pv.account_id = a.id
GROUP BY a.id, a.account_code, a.customer_id;
"""
DROP_VW_ACCOUNT_TOTALS = "DROP VIEW IF EXISTS vw_account_totals;"

CREATE_VW_CUSTOMER_AUM = """
CREATE OR REPLACE VIEW vw_customer_aum AS
SELECT
    at.customer_id,
    COALESCE(SUM(at.market_value), 0)::numeric(18,2)  AS market_value,
    COALESCE(SUM(at.cost_value), 0)::numeric(18,2)    AS cost_value,
    COALESCE(SUM(at.unrealised_pl), 0)::numeric(18,2) AS unrealised_pl,
    SUM(at.positions_count)                            AS positions_count
FROM vw_account_totals at
GROUP BY at.customer_id;
"""
DROP_VW_CUSTOMER_AUM = "DROP VIEW IF EXISTS vw_customer_aum;"

CREATE_VW_CUSTOMER_ASSET_ALLOCATION = """
CREATE OR REPLACE VIEW vw_customer_asset_allocation AS
WITH totals AS (
    SELECT customer_id, SUM(market_value) AS total_mv
    FROM vw_account_totals
    GROUP BY customer_id
)
SELECT
    pv.customer_id,
    pv.asset_class,
    SUM(pv.market_value)::numeric(18,2)              AS market_value,
    CASE
        WHEN t.total_mv = 0 THEN 0
        ELSE ROUND(SUM(pv.market_value) / t.total_mv * 100, 4)
    END                                              AS weight_pct
FROM vw_position_valuation pv
JOIN totals t ON t.customer_id = pv.customer_id
GROUP BY pv.customer_id, pv.asset_class, t.total_mv;
"""
DROP_VW_CUSTOMER_ASSET_ALLOCATION = "DROP VIEW IF EXISTS vw_customer_asset_allocation;"

CREATE_VW_MONTHLY_NET_FLOW = """
CREATE OR REPLACE VIEW vw_monthly_net_flow AS
SELECT
    DATE_TRUNC('month', t.trade_date)::date            AS month,
    COALESCE(SUM(CASE WHEN t.transaction_type = 'BUY'  THEN t.amount ELSE 0 END), 0)::numeric(18,2) AS buy_total,
    COALESCE(SUM(CASE WHEN t.transaction_type = 'SELL' THEN t.amount ELSE 0 END), 0)::numeric(18,2) AS sell_total,
    COALESCE(
        SUM(CASE WHEN t.transaction_type = 'SELL' THEN t.amount ELSE 0 END)
        - SUM(CASE WHEN t.transaction_type = 'BUY'  THEN t.amount ELSE 0 END),
        0
    )::numeric(18,2)                                   AS net_flow
FROM investments_transaction t
WHERE t.status = 'SETTLED'
  AND t.transaction_type IN ('BUY', 'SELL')
GROUP BY DATE_TRUNC('month', t.trade_date);
"""
DROP_VW_MONTHLY_NET_FLOW = "DROP VIEW IF EXISTS vw_monthly_net_flow;"

CREATE_VW_DATA_QUALITY_EXCEPTIONS = """
CREATE OR REPLACE VIEW vw_data_quality_exceptions AS
-- Transactions dated before their account opened
SELECT
    'TXN_BEFORE_ACCOUNT_OPEN'            AS exception_code,
    'TRANSACTION'                        AS entity_type,
    t.transaction_code                   AS entity_id,
    'Trade date ' || t.trade_date::text || ' precedes account open date ' || a.opened_at::text AS description,
    t.trade_date                         AS detected_at
FROM investments_transaction t
JOIN investments_account a ON a.id = t.account_id
WHERE t.trade_date < a.opened_at

UNION ALL

-- Transactions on closed accounts
SELECT
    'TXN_ON_CLOSED_ACCOUNT',
    'TRANSACTION',
    t.transaction_code,
    'Transaction on CLOSED account ' || a.account_code,
    t.trade_date
FROM investments_transaction t
JOIN investments_account a ON a.id = t.account_id
WHERE a.status = 'CLOSED'

UNION ALL

-- Overdue goals
SELECT
    'GOAL_OVERDUE',
    'GOAL',
    g.goal_code,
    'Goal ' || g.goal_code || ' target date ' || g.target_date::text || ' passed and not fully funded',
    CURRENT_DATE
FROM goals_goal g
WHERE g.target_date < CURRENT_DATE
  AND g.current_funded_amount < g.target_amount

UNION ALL

-- Over-funded goals
SELECT
    'GOAL_OVERFUNDED',
    'GOAL',
    g.goal_code,
    'Goal ' || g.goal_code || ' funded amount ' || g.current_funded_amount::text || ' exceeds target ' || g.target_amount::text,
    CURRENT_DATE
FROM goals_goal g
WHERE g.current_funded_amount > g.target_amount

UNION ALL

-- Risk level/score mismatch (Conservative <=34, Moderate 35-54, Growth 55-74, Aggressive >=75)
SELECT
    'RISK_LEVEL_SCORE_MISMATCH',
    'RISK_PROFILE',
    rp.id::text,
    'Score ' || rp.risk_score::text || ' does not match level ' || rp.risk_level,
    rp.assessed_at
FROM customers_riskprofile rp
WHERE NOT (
    (rp.risk_level = 'CONSERVATIVE' AND rp.risk_score <= 34) OR
    (rp.risk_level = 'MODERATE'     AND rp.risk_score BETWEEN 35 AND 54) OR
    (rp.risk_level = 'GROWTH'       AND rp.risk_score BETWEEN 55 AND 74) OR
    (rp.risk_level = 'AGGRESSIVE'   AND rp.risk_score >= 75)
)

UNION ALL

-- Stale prices (price_as_of older than the most recent snapshot)
SELECT
    'STALE_PRICE',
    'INSTRUMENT',
    i.instrument_code,
    'Price as of ' || i.price_as_of::text || ' is older than latest snapshot',
    i.price_as_of
FROM investments_instrument i
CROSS JOIN (SELECT MAX(snapshot_date) AS max_snap FROM investments_holdingsnapshot) s
WHERE i.price_as_of < s.max_snap;
"""
DROP_VW_DATA_QUALITY_EXCEPTIONS = "DROP VIEW IF EXISTS vw_data_quality_exceptions;"


class Migration(migrations.Migration):

    dependencies = [
        ("investments", "0001_initial"),
        ("customers", "0001_initial"),
        ("goals", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(CREATE_TRGM_EXTENSION, reverse_sql=DROP_TRGM_EXTENSION),
        migrations.RunSQL(CREATE_VW_POSITION_VALUATION, reverse_sql=DROP_VW_POSITION_VALUATION),
        migrations.RunSQL(CREATE_VW_ACCOUNT_TOTALS, reverse_sql=DROP_VW_ACCOUNT_TOTALS),
        migrations.RunSQL(CREATE_VW_CUSTOMER_AUM, reverse_sql=DROP_VW_CUSTOMER_AUM),
        migrations.RunSQL(CREATE_VW_CUSTOMER_ASSET_ALLOCATION, reverse_sql=DROP_VW_CUSTOMER_ASSET_ALLOCATION),
        migrations.RunSQL(CREATE_VW_MONTHLY_NET_FLOW, reverse_sql=DROP_VW_MONTHLY_NET_FLOW),
        migrations.RunSQL(CREATE_VW_DATA_QUALITY_EXCEPTIONS, reverse_sql=DROP_VW_DATA_QUALITY_EXCEPTIONS),
    ]
