# EXPLAIN (ANALYZE, BUFFERS) Analysis: Position Valuation Query

## Target Query
```sql
SELECT
    h.account_id,
    a.account_code,
    i.instrument_code,
    i.symbol,
    i.asset_class,
    h.quantity,
    h.avg_cost,
    i.last_price,
    (h.quantity * i.last_price)::numeric(18,2) AS market_value,
    (h.quantity * i.last_price - h.quantity * h.avg_cost)::numeric(18,2) AS unrealised_pl
FROM investments_holdingsnapshot h
JOIN investments_account a ON a.id = h.account_id
JOIN investments_instrument i ON i.id = h.instrument_id
WHERE a.customer_id = 14;
```

## Before Index Optimization
Without composite index on `investments_holdingsnapshot (account_id, snapshot_date)`:
```text
Hash Join  (cost=35.12..62.80 rows=18 width=96) (actual time=0.820..1.140 rows=18 loops=1)
  Hash Cond: (h.instrument_id = i.id)
  Buffers: shared hit=42 read=18
  ->  Nested Loop  (cost=0.15..26.40 rows=18 width=48) (actual time=0.080..0.340 rows=18 loops=1)
        Buffers: shared hit=28 read=12
        ->  Seq Scan on investments_account a (cost=0.00..8.20 rows=2 width=12) (actual time=0.020..0.040 rows=2 loops=1)
              Filter: (customer_id = 14)
        ->  Seq Scan on investments_holdingsnapshot h (cost=0.00..8.80 rows=9 width=40) (actual time=0.030..0.120 rows=9 loops=2)
              Filter: (account_id = a.id)
  ->  Hash  (cost=28.50..28.50 rows=80 width=56) (actual time=0.620..0.620 rows=80 loops=1)
        Buckets: 1024  Batches: 1  Memory Usage: 14kB
        Buffers: shared hit=14 read=6
        ->  Seq Scan on investments_instrument i (cost=0.00..28.50 rows=80 width=56) (actual time=0.020..0.450 rows=80 loops=1)
Planning Time: 0.350 ms
Execution Time: 1.210 ms
```

## After Composite Index Optimization
Index created:
```sql
CREATE INDEX holding_account_date_idx ON investments_holdingsnapshot (account_id, snapshot_date);
CREATE INDEX account_customer_idx ON investments_account (customer_id);
```

```text
Nested Loop  (cost=0.42..32.10 rows=18 width=96) (actual time=0.035..0.085 rows=18 loops=1)
  Buffers: shared hit=18
  ->  Nested Loop  (cost=0.28..15.20 rows=18 width=48) (actual time=0.022..0.045 rows=18 loops=1)
        Buffers: shared hit=8
        ->  Index Scan using account_customer_idx on investments_account a (cost=0.15..8.18 rows=2 width=12) (actual time=0.010..0.012 rows=2 loops=1)
              Index Cond: (customer_id = 14)
        ->  Index Scan using holding_account_date_idx on investments_holdingsnapshot h (cost=0.14..3.40 rows=9 width=40) (actual time=0.005..0.012 rows=9 loops=2)
              Index Cond: (account_id = a.id)
  ->  Index Scan using investments_instrument_pkey on investments_instrument i (cost=0.14..0.92 rows=1 width=56) (actual time=0.001..0.002 rows=1 loops=18)
        Index Cond: (id = h.instrument_id)
        Buffers: shared hit=10
Planning Time: 0.180 ms
Execution Time: 0.098 ms
```

## Architectural Conclusion
- Execution time dropped from **1.210 ms** to **0.098 ms** (~12x faster).
- Replaced sequential table scans with indexed B-tree lookups.
- Memory usage for in-memory hashing was eliminated.
