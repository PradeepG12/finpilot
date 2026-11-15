export interface ApiResponse<T> {
  data: T;
  status: 'success' | 'error';
  action_code: string;
  request_id?: string;
}

export interface PaginatedData<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface User {
  id: number;
  uuid?: string;
  email: string;
  full_name: string | null;
  user_type: 'ADMIN' | 'VIEWER';
  is_active?: boolean;
}

export interface AdminUserListItem {
  id: number;
  uuid: string;
  email: string;
  full_name: string | null;
  user_type: 'ADMIN' | 'VIEWER';
  is_active: boolean;
  last_login: string | null;
  created: string;
}

export interface Customer {
  id: number;
  uuid: string;
  customer_code: string;
  full_name: string;
  email: string;
  phone: string;
  city: string | null;
  state: string | null;
  date_of_birth: string | null;
  onboarded_at: string | null;
  kyc_status: 'VERIFIED' | 'PENDING' | 'REVIEW';
  segment: 'MASS' | 'AFFLUENT' | 'HNI';
  risk_level?: string | null;
}

export interface RiskProfile {
  id: number;
  risk_score: number;
  risk_level: string;
  assessed_at: string;
  horizon_years: number;
  liquidity_need: string;
}

export interface CustomerDetail extends Customer {
  risk_profile: RiskProfile | null;
  accounts_count: number;
  goals_count: number;
}

export interface Position {
  instrument_code: string;
  symbol: string;
  name: string;
  asset_class: string;
  quantity: string;
  avg_cost: string;
  last_price: string;
  market_value: string;
  unrealised_pl: string;
  unrealised_pl_pct: string;
}

export interface AccountData {
  account_code: string;
  account_type: string;
  provider: string | null;
  status: 'ACTIVE' | 'DORMANT' | 'CLOSED';
  opened_at: string | null;
  totals: {
    market_value: string;
    cost_value: string;
    unrealised_pl: string;
    unrealised_pl_pct: string;
  };
  positions: Position[];
}

export interface AssetAllocation {
  asset_class: string;
  market_value: string;
  weight_pct: string;
}

export interface PortfolioResponse {
  customer_code: string;
  currency: string;
  as_of: {
    snapshot_date: string;
    price_date: string;
    stale: boolean;
    age_days: number;
  };
  totals: {
    market_value: string;
    cost_value: string;
    unrealised_pl: string;
    unrealised_pl_pct: string;
  };
  allocation: AssetAllocation[];
  accounts: AccountData[];
}

export interface TransactionItem {
  id: number;
  uuid: string;
  transaction_code: string;
  account_code: string;
  instrument_code: string;
  instrument_symbol: string;
  instrument_name: string;
  transaction_type: 'BUY' | 'SELL' | 'DIVIDEND' | 'FEE';
  trade_date: string;
  quantity: string;
  price: string;
  amount: string;
  status: 'SETTLED' | 'PENDING' | 'REVERSED';
}

export interface GoalItem {
  id: number;
  uuid: string;
  goal_code: string;
  goal_type: string;
  goal_name: string;
  target_amount: string;
  current_funded_amount: string;
  target_date: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  funded_percent: string;
  flags: string[];
  days_to_target: number;
  created: string;
  modified: string;
}

export interface ImportBatchResult {
  batch: string;
  import_type: string;
  dry_run: boolean;
  status: string;
  counts: {
    total: number;
    processed?: number;
    imported: number;
    skipped_duplicate: number;
    rejected: number;
  };
  warnings: Record<string, number>;
  rejected_rows?: Array<{
    row: number;
    outcome?: string;
    code: string;
    field: string | null;
    message: string;
    raw_row?: Record<string, any>;
  }>;
}

export interface ImportBatchDetail {
  id: number;
  uuid: string;
  import_type: string;
  file_name: string;
  status: string;
  is_dry_run: boolean;
  counts: {
    total: number;
    processed: number;
    imported: number;
    skipped_duplicate: number;
    rejected: number;
  };
  warnings: Record<string, number>;
  started_at: string;
  finished_at: string | null;
  rejected_rows?: Array<{
    row: number;
    outcome?: string;
    code: string;
    field: string | null;
    message: string;
    raw_row?: Record<string, any>;
  }>;
}
