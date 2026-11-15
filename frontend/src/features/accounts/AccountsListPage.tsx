import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '@/lib/api';
import { ApiResponse, AccountListItem, PaginatedData } from '@/types/api';
import { formatINR } from '@/lib/format';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowRight,
  Wallet,
} from 'lucide-react';

const DEFAULT_PROVIDERS = [
  'BlueRiver MF',
  'Harbor Investments',
  'NorthStar Securities',
  'Zenith Broking',
];

export const AccountsListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Read URL query parameters
  const search = searchParams.get('search') || '';
  const accountType = searchParams.get('account_type') || '';
  const status = searchParams.get('status') || '';
  const provider = searchParams.get('provider') || '';
  const ordering = searchParams.get('ordering') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const [searchTerm, setSearchTerm] = useState(search);

  // Sync state when URL param changes
  useEffect(() => {
    setSearchTerm(search);
  }, [search]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentParam = searchParams.get('search') || '';
      if (searchTerm !== currentParam) {
        const newParams = new URLSearchParams(searchParams);
        if (searchTerm) {
          newParams.set('search', searchTerm);
        } else {
          newParams.delete('search');
        }
        newParams.set('page', '1');
        setSearchParams(newParams);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, searchParams, setSearchParams]);

  // Fetch distinct providers for dropdown
  const { data: providersData } = useQuery({
    queryKey: ['account-providers'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<ApiResponse<string[]>>('/accounts/providers/');
        return res.data.data;
      } catch {
        return DEFAULT_PROVIDERS;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const availableProviders = useMemo(() => {
    if (providersData && providersData.length > 0) {
      return providersData;
    }
    return DEFAULT_PROVIDERS;
  }, [providersData]);

  // Accounts list query
  const { data, isLoading, isError } = useQuery({
    queryKey: ['accounts', { search, accountType, status, provider, ordering, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (accountType) params.append('account_type', accountType);
      if (status) params.append('status', status);
      if (provider) params.append('provider', provider);
      if (ordering) params.append('ordering', ordering);
      params.append('page', page.toString());

      const res = await apiClient.get<ApiResponse<PaginatedData<AccountListItem>>>(
        `/accounts/?${params.toString()}`
      );
      return res.data.data;
    },
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (searchTerm) {
      newParams.set('search', searchTerm);
    } else {
      newParams.delete('search');
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handleSort = (field: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (ordering === field) {
      newParams.set('ordering', `-${field}`);
    } else if (ordering === `-${field}`) {
      newParams.delete('ordering');
    } else {
      newParams.set('ordering', field);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const renderSortIcon = (field: string) => {
    if (ordering === field) {
      return <ArrowUp className="h-4 w-4 text-primary" />;
    }
    if (ordering === `-${field}`) {
      return <ArrowDown className="h-4 w-4 text-primary" />;
    }
    return <ArrowUpDown className="h-3.5 w-3.5 text-text-muted opacity-50 group-hover:opacity-100 transition-opacity" />;
  };

  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const clearAllFilters = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('account_type');
    newParams.delete('status');
    newParams.delete('provider');
    newParams.delete('search');
    setSearchTerm('');
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const hasActiveFilters = Boolean(accountType || status || provider || search);

  const totalCount = data?.count || 0;
  const pageSize = 24;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const navigateToPortfolio = (customerCode: string, accountCode: string) => {
    navigate(`/customers/${customerCode}?tab=portfolio&account=${accountCode}`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Description */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-main flex items-center gap-2.5">
          <Wallet className="h-7 w-7 text-primary" />
          <span>Accounts</span>
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Browse customer investment accounts and open their current holdings.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row gap-3 justify-between bg-surface p-4 rounded-xl border border-border shadow-xs">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search by account code, customer, provider..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white text-text-main placeholder:text-text-muted"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-text-muted hover:text-text-main"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2.5 justify-start lg:justify-end">
          {/* Account Type Dropdown */}
          <select
            value={accountType}
            onChange={(e) => handleFilterChange('account_type', e.target.value)}
            className="text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            title="Filter by Account Type"
          >
            <option value="">All Account Types</option>
            <option value="BROKERAGE">Brokerage</option>
            <option value="MUTUAL_FUND">Mutual Fund</option>
            <option value="RETIREMENT">Retirement</option>
          </select>

          {/* Status Dropdown */}
          <select
            value={status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            title="Filter by Status"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DORMANT">Dormant</option>
            <option value="CLOSED">Closed</option>
          </select>

          {/* Provider Dropdown */}
          <select
            value={provider}
            onChange={(e) => handleFilterChange('provider', e.target.value)}
            className="text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-text-main focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            title="Filter by Provider"
          >
            <option value="">All Providers</option>
            {availableProviders.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* Clear Filters Action */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs text-text-muted hover:text-loss transition-colors font-medium px-2 py-1"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Accounts Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-text-muted font-medium">
              <tr>
                {/* Account */}
                <th
                  onClick={() => handleSort('account_code')}
                  className="px-4 py-3.5 cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                  title="Sort by Account Code"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={ordering.includes('account_code') ? 'font-bold text-text-main' : ''}>
                      Account
                    </span>
                    {renderSortIcon('account_code')}
                  </div>
                </th>

                {/* Customer */}
                <th
                  onClick={() => handleSort('customer')}
                  className="px-4 py-3.5 cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                  title="Sort by Customer"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={ordering.includes('customer') ? 'font-bold text-text-main' : ''}>
                      Customer
                    </span>
                    {renderSortIcon('customer')}
                  </div>
                </th>

                {/* Type */}
                <th
                  onClick={() => handleSort('type')}
                  className="px-4 py-3.5 cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                  title="Sort by Account Type"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={ordering.includes('type') ? 'font-bold text-text-main' : ''}>
                      Type
                    </span>
                    {renderSortIcon('type')}
                  </div>
                </th>

                {/* Provider */}
                <th
                  onClick={() => handleSort('provider')}
                  className="px-4 py-3.5 cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                  title="Sort by Provider"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={ordering.includes('provider') ? 'font-bold text-text-main' : ''}>
                      Provider
                    </span>
                    {renderSortIcon('provider')}
                  </div>
                </th>

                {/* Status */}
                <th className="px-4 py-3.5">Status</th>

                {/* Opened */}
                <th
                  onClick={() => handleSort('opened_date')}
                  className="px-4 py-3.5 cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                  title="Sort by Opened Date"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={ordering.includes('opened_date') ? 'font-bold text-text-main' : ''}>
                      Opened
                    </span>
                    {renderSortIcon('opened_date')}
                  </div>
                </th>

                {/* Current Value */}
                <th
                  onClick={() => handleSort('current_market_value')}
                  className="px-4 py-3.5 text-right cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                  title="Sort by Current Market Value"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span className={ordering.includes('current_market_value') ? 'font-bold text-text-main' : ''}>
                      Current value
                    </span>
                    {renderSortIcon('current_market_value')}
                  </div>
                </th>

                {/* Action */}
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-text-muted">
                    Loading accounts...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-loss">
                    Failed to load accounts. Please refresh or try again.
                  </td>
                </tr>
              ) : data?.results.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-text-muted">
                    No accounts found matching the criteria.
                  </td>
                </tr>
              ) : (
                data?.results.map((acc) => (
                  <tr
                    key={acc.id}
                    onClick={() => navigateToPortfolio(acc.customer_code, acc.account_code)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  >
                    {/* Account Code */}
                    <td className="px-4 py-3.5 font-semibold text-primary font-mono text-xs">
                      {acc.account_code}
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-text-main text-sm">
                        {acc.customer_name}
                      </div>
                      <span className="font-mono text-3xs text-text-muted">
                        {acc.customer_code}
                      </span>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                        {acc.account_type.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Provider */}
                    <td className="px-4 py-3.5 text-text-muted text-xs">
                      {acc.provider || '—'}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                          acc.status === 'ACTIVE'
                            ? 'bg-green-50 text-gain ring-green-600/20'
                            : acc.status === 'DORMANT'
                            ? 'bg-amber-50 text-warning ring-amber-600/20'
                            : 'bg-slate-100 text-slate-600 ring-slate-400/20'
                        }`}
                      >
                        {acc.status}
                      </span>
                    </td>

                    {/* Opened */}
                    <td className="px-4 py-3.5 text-text-muted text-xs tabular-nums">
                      {acc.opened_at || '—'}
                    </td>

                    {/* Current Market Value */}
                    <td className="px-4 py-3.5 text-right font-semibold text-text-main tabular-nums">
                      {acc.current_market_value !== null && acc.current_market_value !== undefined
                        ? formatINR(acc.current_market_value)
                        : '—'}
                    </td>

                    {/* Action: View portfolio */}
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToPortfolio(acc.customer_code, acc.account_code);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark transition-colors px-2.5 py-1 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary hover:text-white"
                      >
                        <span>View portfolio</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Bar */}
        {data && totalCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border text-xs text-text-muted bg-surface">
            <div>
              Showing{' '}
              <span className="font-semibold text-text-main">
                {Math.min((page - 1) * pageSize + 1, totalCount)}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-text-main">
                {Math.min(page * pageSize, totalCount)}
              </span>{' '}
              of <span className="font-semibold text-text-main">{totalCount.toLocaleString()}</span> accounts
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set('page', (page - 1).toString());
                  setSearchParams(newParams);
                }}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-text-main font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>

              <span className="px-2 font-medium">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set('page', (page + 1).toString());
                  setSearchParams(newParams);
                }}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-text-main font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
