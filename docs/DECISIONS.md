# FinPilot — Decisions & Assumptions

## Architecture decisions

### Celery/Redis omitted
**Decision:** Synchronous CSV import; no Celery or Redis. LocMemCache is used for caching.
**Reason:** The assignment CSV files contain ~5k rows. Synchronous import completes in <5 seconds — well under the gunicorn 60 s timeout. Fewer moving parts = fewer failure modes for a reviewer running from scratch.
**Future path:** At larger scale (>50k rows, object storage, background jobs), move to: file upload -> S3/object storage -> Celery task -> result via WebSocket or polling. Documented in architecture report.

### JWT (simplejwt) replaces DRF Token Auth
**Decision:** `djangorestframework-simplejwt` with token_blacklist.
**Reason:** Plan §5 specifies JWT with 15-min access token (memory-only in React state) + 7-day rotated refresh token (httpOnly, Secure, SameSite=Lax cookie at `/api/v1/auth/`). DRF token auth has no built-in expiry or rotation.

### Roles: ADMIN and VIEWER only
**Decision:** `UserTypeChoices` changed from `admin|staff` to `ADMIN|VIEWER`.
**Reason:** Plan §3.2 requirement. VIEWER = any active authenticated staff member (read everything + goal create/edit). ADMIN = operations staff (VIEWER rights + CSV imports, data-quality view, import history).

### Holdings snapshot is source of truth
**Decision:** Portfolio valuation is calculated from `holdings_snapshot` only. Transaction history is NOT used to reconstruct positions.
**Reason:** Plan §1.1 structural fact #2 — holdings do not reconcile with transactions (they were generated independently). Using transactions would produce incorrect numbers.

### No unique constraint on (customer, account_type, provider)
**Decision:** Multiple same-type accounts per customer are valid.
**Reason:** Plan §1.1 structural fact #1 — 4 customers (C0014, C0026, C0058, C0090) legitimately have multiple accounts of the same type and provider. Accounts are identified and aggregated by `account_code`.

### Warnings vs. Rejects policy
**Decision:** The following are treated as warnings and loaded, not rejected:
- ~1,069 transactions dated before their account's `opened_at` (measured: exact 1,069 after rejects).
- ~115 transactions on CLOSED accounts (measured: exact 115 after rejects).
**Reason:** Plan §1.1 structural fact #3 — rejecting them would drop ~23% of the ledger. They are loaded and surfaced in the data-quality views and import warning counts.

### Amount tolerance
**Decision:** `IMPORT_AMOUNT_TOLERANCE = 1.00` INR.
**Measured:** Real max deviation between BUY/SELL `quantity * price` and `amount` is `0.0050` INR.
**Reason:** Plan §1.1 structural fact #4 — tolerance of 1.00 INR is safely above the observed 0.0050 INR deviation, accommodating rounding differences.

### Money is always Decimal, never float
**Decision:** All financial fields use `DecimalField` (18 digits, 2 dp for money; 4 dp for price/cost; 6 dp for quantity). DRF default `COERCE_DECIMAL_TO_STRING=True` is maintained. Frontend never parses money strings to float for arithmetic. All aggregation is done in SQL.
**Reason:** Plan §0 and §3.2.

### Stale-data banner behaviour
**Decision:** Freshness banner displays "Prices as of 18 Sep 2026 · Holdings snapshot 18 Sep 2026" and shows an amber warning tag when data is older than `STALE_DATA_DAYS` (default 7 days).
**Reason:** Plan §1.1 structural fact #8 — the seed data is from 2026-09-18. Today is later, so showing the stale indicator is intentional.

### Goal name vs. Goal type
**Decision:** Both fields are displayed independently. `goal_name` is free text and is never used to infer `goal_type`.
**Reason:** Plan §1.1 structural fact #5.

### Color contrast limitation (accessibility)
**Decision:** In the asset-class donut chart, Okabe-Ito colors for ETF (`#56B4E9`, 2.3:1) and BOND (`#E69F00`, 2.3:1) are below 3:1 against white.
**Mitigation:** 2px white borders between slices, direct percentage labels, clear legend, and an always-available data-table fallback view. Hue is never the sole indicator.

## Data anomalies handled

| # | Location | Row | Problem | Handling |
|---|---|---|---|---|
| A1 | transactions | T0000026 (rows 25 & 4550), identical | duplicate ID | 2nd occurrence -> SKIPPED_DUPLICATE |
| A2 | transactions | T0004551 (I9999 not found) | unknown instrument FK | REJECTED: UNKNOWN_INSTRUMENT |
| A3 | transactions | T0004552 (amount -75) | negative amount | REJECTED: NEGATIVE_AMOUNT |
| A4 | transactions | T0004553 (trade date 2027-01-05) | future trade date | REJECTED: FUTURE_TRADE_DATE |
| A5 | holdings | A00145/I0036, A00146/I0010, A00147/I0049 each appear twice | duplicate position | 2nd occurrence -> SKIPPED_DUPLICATE |

## Golden totals (acceptance benchmarks)
- transactions: 4554 rows -> 4550 imported + 1 skipped duplicate + 3 rejected = 4554
- holdings: 985 rows -> 982 imported + 3 skipped duplicates = 985
- customers: 120 imported, 0 rejected
- accounts: 167 imported, 0 rejected
- instruments: 80 imported, 0 rejected
- risk_profiles: 120 imported, 0 rejected
- goals: 177 imported, 0 rejected
