import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { ApiResponse, CustomerDetail, PortfolioResponse } from '@/types/api';
import { DataFreshnessBanner } from '@/components/layout/DataFreshnessBanner';
import { formatINR, formatPercent } from '@/lib/format';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Layers, ShieldCheck } from 'lucide-react';
import { CustomerPortfolioTab } from '@/features/portfolio/CustomerPortfolioTab';
import { CustomerTransactionsTab } from '@/features/transactions/CustomerTransactionsTab';
import { CustomerGoalsTab } from '@/features/goals/CustomerGoalsTab';

export const CustomerOverviewPage: React.FC = () => {
  const { customerCode } = useParams<{ customerCode: string }>();
  const [activeTab, setActiveTab] = useState<'overview' | 'portfolio' | 'transactions' | 'goals'>('overview');

  const { data: customer } = useQuery({
    queryKey: ['customer', customerCode],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<CustomerDetail>>(`/customers/${customerCode}/`);
      return res.data.data;
    },
    enabled: !!customerCode,
  });

  const { data: portfolio } = useQuery({
    queryKey: ['portfolio', customerCode],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PortfolioResponse>>(
        `/customers/${customerCode}/portfolio/`
      );
      return res.data.data;
    },
    enabled: !!customerCode,
  });

  if (!customer) {
    return <div className="text-text-muted animate-pulse p-4">Loading customer record...</div>;
  }

  const isGain = parseFloat(portfolio?.totals?.unrealised_pl || '0') >= 0;

  return (
    <div className="space-y-6">
      {/* Back Button to Customer List */}
      <div>
        <Link
          to="/customers"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-text-main hover:bg-slate-50 transition-colors shadow-xs"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Customers</span>
        </Link>
      </div>

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold tracking-tight text-text-main">
              {customer.full_name}
            </h1>
            <span className="font-mono text-sm px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-300">
              {customer.customer_code}
            </span>
          </div>
          <p className="text-sm text-text-muted mt-1">
            {customer.city || '—'} · {customer.email} · {customer.phone}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span
            className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
              customer.kyc_status === 'VERIFIED'
                ? 'bg-green-50 text-gain ring-green-600/20'
                : 'bg-amber-50 text-warning ring-amber-600/20'
            }`}
          >
            KYC: {customer.kyc_status}
          </span>
          <span className="inline-flex items-center rounded-md bg-blue-50 text-primary ring-1 ring-inset ring-blue-600/20 px-2.5 py-1 text-xs font-semibold uppercase">
            Segment: {customer.segment}
          </span>
        </div>
      </div>

      {/* Freshness Banner */}
      {portfolio && (
        <DataFreshnessBanner
          stale={portfolio.as_of.stale}
          ageDays={portfolio.as_of.age_days}
          priceDate={portfolio.as_of.price_date}
          snapshotDate={portfolio.as_of.snapshot_date}
        />
      )}

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="text-sm font-medium text-text-muted">Total Portfolio Value (AUM)</div>
          <div className="text-2xl font-bold text-text-main mt-1 tabular-nums">
            {formatINR(portfolio?.totals?.market_value)}
          </div>
          <div className="text-xs text-text-muted mt-1">
            Cost: {formatINR(portfolio?.totals?.cost_value)}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="text-sm font-medium text-text-muted">Unrealised P/L</div>
          <div
            className={`text-2xl font-bold mt-1 flex items-center tabular-nums ${
              isGain ? 'text-gain' : 'text-loss'
            }`}
          >
            {isGain ? <ArrowUpRight className="h-5 w-5 mr-1" /> : <ArrowDownRight className="h-5 w-5 mr-1" />}
            {isGain ? '+' : ''}
            {formatINR(portfolio?.totals?.unrealised_pl)}
          </div>
          <div
            className={`text-xs mt-1 font-semibold ${isGain ? 'text-gain' : 'text-loss'}`}
          >
            {isGain ? '▲ +' : '▼ '}
            {formatPercent(portfolio?.totals?.unrealised_pl_pct)}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="text-sm font-medium text-text-muted flex items-center justify-between">
            <span>Risk Profile</span>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <div className="text-xl font-bold text-text-main mt-1">
            {customer.risk_profile?.risk_level || 'Not Assessed'}
          </div>
          <div className="text-xs text-text-muted mt-1">
            Score: {customer.risk_profile?.risk_score ?? '—'}/100 · Horizon: {customer.risk_profile?.horizon_years ?? '—'} yrs
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="text-sm font-medium text-text-muted flex items-center justify-between">
            <span>Linked Accounts</span>
            <Layers className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-text-main mt-1">
            {customer.accounts_count}
          </div>
          <div className="text-xs text-text-muted mt-1">
            Goals: {customer.goals_count} recorded
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex space-x-8">
          {(['overview', 'portfolio', 'transactions', 'goals'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 text-sm font-medium border-b-2 capitalize transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-text-muted hover:text-text-main hover:border-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Account Summaries */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
              <h3 className="font-semibold text-text-main text-base">Account Holdings Overview</h3>
              <div className="space-y-3">
                {portfolio?.accounts.map((acc) => (
                  <div
                    key={acc.account_code}
                    className="p-3.5 rounded-lg border border-border bg-slate-50 dark:bg-slate-800/40 flex justify-between items-center"
                  >
                    <div>
                      <div className="font-semibold text-text-main text-sm">
                        {acc.account_code} — {acc.provider || acc.account_type}
                      </div>
                      <div className="text-xs text-text-muted mt-0.5">
                        Status: {acc.status} · {acc.positions.length} position(s)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-text-main text-sm tabular-nums">
                        {formatINR(acc.totals.market_value)}
                      </div>
                      <div
                        className={`text-xs tabular-nums ${
                          parseFloat(acc.totals.unrealised_pl) >= 0 ? 'text-gain' : 'text-loss'
                        }`}
                      >
                        {parseFloat(acc.totals.unrealised_pl) >= 0 ? '▲ +' : '▼ '}
                        {formatINR(acc.totals.unrealised_pl)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Asset Allocation */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
              <h3 className="font-semibold text-text-main text-base">Asset Allocation</h3>
              <div className="space-y-2.5">
                {portfolio?.allocation.map((item) => (
                  <div key={item.asset_class} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-text-main">
                      <span>{item.asset_class}</span>
                      <span>{formatPercent(item.weight_pct)} ({formatINR(item.market_value)})</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${item.weight_pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'portfolio' && <CustomerPortfolioTab portfolio={portfolio} />}
      {activeTab === 'transactions' && <CustomerTransactionsTab customerCode={customer.customer_code} />}
      {activeTab === 'goals' && <CustomerGoalsTab customerCode={customer.customer_code} />}
    </div>
  );
};
