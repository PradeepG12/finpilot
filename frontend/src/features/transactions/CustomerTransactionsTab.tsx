import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { ApiResponse, PaginatedData, PortfolioResponse, TransactionItem } from '@/types/api';
import { formatINR, formatDate } from '@/lib/format';
import { ExportModal } from '@/features/exports/ExportModal';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Download,
} from 'lucide-react';

interface Props {
  customerCode: string;
  accounts?: { account_code: string; account_type?: string; provider?: string | null }[];
  initialAccount?: string;
}


export const CustomerTransactionsTab: React.FC<Props> = ({
  customerCode,
  accounts: propAccounts,
  initialAccount,
}) => {
  // Committed filter state (applied to query)
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    initialAccount ? [initialAccount] : []
  );
  const [type, setType] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [ordering, setOrdering] = useState<string>('-trade_date');
  const [page, setPage] = useState<number>(1);

  // Staged / Draft state for Filter Popover (applied only on "Apply Filters")
  const [draftType, setDraftType] = useState<string>('');
  const [draftStatus, setDraftStatus] = useState<string>('');
  const [draftDateFrom, setDraftDateFrom] = useState<string>('');
  const [draftDateTo, setDraftDateTo] = useState<string>('');

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const accountDropdownRef = useRef<HTMLDivElement>(null);

  // Query customer accounts if not provided
  const { data: portfolioData } = useQuery({
    queryKey: ['portfolio', customerCode],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PortfolioResponse>>(
        `/customers/${customerCode}/portfolio/`
      );
      return res.data.data;
    },
    enabled: !propAccounts,
  });

  const availableAccounts = propAccounts || portfolioData?.accounts || [];

  // Update selected accounts if initialAccount prop changes
  useEffect(() => {
    if (initialAccount) {
      setSelectedAccounts([initialAccount]);
      setPage(1);
    }
  }, [initialAccount]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Sync draft state whenever popover opens
  useEffect(() => {
    if (isFilterOpen) {
      setDraftType(type);
      setDraftStatus(status);
      setDraftDateFrom(dateFrom);
      setDraftDateTo(dateTo);
    }
  }, [isFilterOpen, type, status, dateFrom, dateTo]);

  // Prevent background page scrolling when the filter modal is open
  useEffect(() => {
    if (isFilterOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFilterOpen]);

  // Close filter drawer on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isFilterOpen) {
        setIsFilterOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFilterOpen]);

  // Close account dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        accountDropdownRef.current &&
        !accountDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAccountDropdownOpen(false);
      }
    }
    if (isAccountDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAccountDropdownOpen]);

  const { data, isLoading } = useQuery({
    queryKey: [
      'transactions',
      customerCode,
      {
        search: debouncedSearch,
        account: selectedAccounts.join(','),
        type,
        status,
        dateFrom,
        dateTo,
        ordering,
        page,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (selectedAccounts.length > 0) params.append('account', selectedAccounts.join(','));
      if (type) params.append('transaction_type', type);
      if (status) params.append('status', status);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (ordering) params.append('ordering', ordering);
      params.append('page', page.toString());

      const res = await apiClient.get<ApiResponse<PaginatedData<TransactionItem>>>(
        `/customers/${customerCode}/transactions/?${params.toString()}`
      );
      return res.data.data;
    },
  });

  const handleSort = (field: string) => {
    if (ordering === field) {
      setOrdering(`-${field}`);
    } else if (ordering === `-${field}`) {
      setOrdering('');
    } else {
      setOrdering(field);
    }
    setPage(1);
  };

  const renderSortIcon = (field: string) => {
    if (ordering === field) {
      return <ArrowUp className="h-3.5 w-3.5 text-primary" />;
    }
    if (ordering === `-${field}`) {
      return <ArrowDown className="h-3.5 w-3.5 text-primary" />;
    }
    return <ArrowUpDown className="h-3 w-3 text-text-muted opacity-40 group-hover:opacity-100 transition-opacity" />;
  };

  const handleApplyFilters = () => {
    setType(draftType);
    setStatus(draftStatus);
    setDateFrom(draftDateFrom);
    setDateTo(draftDateTo);
    setPage(1);
    setIsFilterOpen(false);
  };

  const handleResetDraft = () => {
    setDraftType('');
    setDraftStatus('');
    setDraftDateFrom('');
    setDraftDateTo('');
  };

  const clearAllFilters = () => {
    setSelectedAccounts([]);
    setType('');
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setSearchTerm('');
    setPage(1);
  };

  const toggleAccountSelection = (accountCode: string) => {
    if (selectedAccounts.includes(accountCode)) {
      setSelectedAccounts(selectedAccounts.filter((a) => a !== accountCode));
    } else {
      setSelectedAccounts([...selectedAccounts, accountCode]);
    }
    setPage(1);
  };

  const activeFiltersCount = [
    type,
    status,
    dateFrom || dateTo,
  ].filter(Boolean).length;
  const hasActiveFilters = Boolean(activeFiltersCount > 0 || selectedAccounts.length > 0 || searchTerm);


  const totalCount = data?.count || 0;
  const pageSize = 24;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-4">
      {/* Consolidated Top Bar: Search + Account Quick Filter on left, Filter on right end */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-4 rounded-xl border border-border shadow-xs">
        {/* Left: Search Bar & Account Quick Filter */}
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5 max-w-2xl">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search by code, symbol, instrument..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-primary bg-white text-text-main placeholder:text-text-muted"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-text-muted hover:text-text-main"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Account Quick Filter Dropdown */}
          <div className="relative" ref={accountDropdownRef}>
            <button
              type="button"
              onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
              className={`inline-flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-xs transition-colors whitespace-nowrap min-w-[140px] ${
                selectedAccounts.length > 0
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-slate-300 bg-white text-text-main hover:bg-slate-50'
              }`}
            >
              <span className="truncate">
                {selectedAccounts.length === 0
                  ? 'All Accounts'
                  : selectedAccounts.length === 1
                  ? `Account: ${selectedAccounts[0]}`
                  : `${selectedAccounts.length} Accounts`}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-text-muted shrink-0" />
            </button>

            {isAccountDropdownOpen && (
              <div className="absolute left-0 mt-1.5 z-40 w-64 rounded-xl border border-border bg-surface p-2 shadow-2xl space-y-1 animate-in fade-in zoom-in-95">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAccounts([]);
                    setPage(1);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                    selectedAccounts.length === 0
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-text-main hover:bg-slate-50'
                  }`}
                >
                  <span>All Accounts</span>
                  {selectedAccounts.length === 0 && <Check className="h-3.5 w-3.5" />}
                </button>

                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1 divide-y divide-slate-100/50">
                  {availableAccounts.map((acc) => {
                    const isSelected = selectedAccounts.includes(acc.account_code);
                    return (
                      <div
                        key={acc.account_code}
                        onClick={() => toggleAccountSelection(acc.account_code)}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                          isSelected
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-text-main hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div
                            className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                              isSelected
                                ? 'bg-primary border-primary text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                          </div>
                          <span className="font-mono">{acc.account_code}</span>
                        </div>
                        {acc.account_type && (
                          <span className="text-3xs px-1.5 py-0.5 rounded bg-slate-100 text-text-muted font-medium ml-2 shrink-0">
                            {acc.account_type}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filter & Export on the Right End */}
        <div className="flex items-center gap-2 justify-end" ref={filterPopoverRef}>
          {/* Export Transactions Button */}
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-text-main shadow-xs hover:bg-slate-50 transition-colors"
          >
            <Download className="h-4 w-4 text-primary" />
            <span>Export transactions</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold shadow-xs transition-colors ${
                activeFiltersCount > 0
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-slate-300 bg-white text-text-main hover:bg-slate-50'
              }`}
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="rounded-full bg-primary text-white text-2xs px-1.5 py-0.2 font-bold">
                  {activeFiltersCount}
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
            </button>

            {/* Fixed Backdrop and Slide-over Drawer Modal (Restricted Width: w-full max-w-sm sm:max-w-md, Opens Right to Left) */}
            {isFilterOpen && (
              <div className="fixed inset-0 z-50 overflow-hidden">
                {/* Fixed Backdrop Overlay */}
                <div
                  className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
                  onClick={() => setIsFilterOpen(false)}
                />

                {/* Drawer Container (Restricted to max-w-md, Never Full Page!) */}
                <div
                  ref={filterPopoverRef}
                  className="fixed inset-y-0 right-0 z-50 w-full max-w-sm sm:max-w-md bg-surface shadow-2xl flex flex-col border-l border-border transition-transform transform duration-300 ease-in-out animate-in slide-in-from-right"
                >
                  {/* Modal Header */}
                  <div className="flex items-start justify-between border-b border-border p-5 pb-4 bg-surface shrink-0 gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-text-main">Filter Transactions</h3>
                      <p className="text-xs text-text-muted mt-0.5">
                        Filter by transaction type, status, and trade date.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(draftType || draftStatus || draftDateFrom || draftDateTo) && (
                        <button
                          type="button"
                          onClick={handleResetDraft}
                          className="text-xs text-primary hover:underline font-semibold whitespace-nowrap"
                        >
                          Clear All
                        </button>
                      )}
                      {/* Cross Button in Top Right to close filter modal */}
                      <button
                        type="button"
                        onClick={() => setIsFilterOpen(false)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-slate-100 transition-colors"
                        aria-label="Close filters"
                        title="Close filters"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Modal Body (Normal Title Case, Not Fully Capital) */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Transaction Type */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-text-main block">
                        Transaction Type
                      </label>
                      <select
                        value={draftType}
                        onChange={(e) => setDraftType(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-text-main focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                      >
                        <option value="">All Types (Buy, Sell, Dividend, Fee)</option>
                        <option value="BUY">Buy</option>
                        <option value="SELL">Sell</option>
                        <option value="DIVIDEND">Dividend</option>
                        <option value="FEE">Fee</option>
                      </select>
                    </div>

                    {/* Status */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-text-main block">
                        Status
                      </label>
                      <select
                        value={draftStatus}
                        onChange={(e) => setDraftStatus(e.target.value)}
                        className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 bg-white text-text-main focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                      >
                        <option value="">All Statuses (Settled, Pending, Reversed)</option>
                        <option value="SETTLED">Settled</option>
                        <option value="PENDING">Pending</option>
                        <option value="REVERSED">Reversed</option>
                      </select>
                    </div>

                    {/* Date Range (Trade Date) */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-text-main block">
                        Date Range (Trade Date)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-3xs text-text-muted block mb-1">From Date</span>
                          <input
                            type="date"
                            value={draftDateFrom}
                            onChange={(e) => setDraftDateFrom(e.target.value)}
                            className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white text-text-main focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                          />
                        </div>
                        <div>
                          <span className="text-3xs text-text-muted block mb-1">To Date</span>
                          <input
                            type="date"
                            value={draftDateTo}
                            onChange={(e) => setDraftDateTo(e.target.value)}
                            className="w-full text-xs rounded-lg border border-slate-300 px-2.5 py-1.5 bg-white text-text-main focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fixed Modal Footer: Apply only when clicked */}
                  <div className="p-4 border-t border-border bg-surface flex items-center justify-between gap-3 shrink-0 shadow-xs">
                    <button
                      type="button"
                      onClick={handleResetDraft}
                      disabled={!draftType && !draftStatus && !draftDateFrom && !draftDateTo}
                      className="text-xs font-semibold text-text-muted hover:text-loss disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      Clear All
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsFilterOpen(false)}
                        className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-text-main hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyFilters}
                        className="px-5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-dark shadow-sm transition-colors"
                      >
                        Apply Filters
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs text-text-muted hover:text-loss transition-colors font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Badges */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {selectedAccounts.map((accCode) => (
            <span
              key={accCode}
              className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200"
            >
              Account: {accCode}
              <button
                type="button"
                onClick={() => toggleAccountSelection(accCode)}
                className="hover:text-blue-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {type && (
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200">
              Type: {type}
              <button onClick={() => setType('')} className="hover:text-blue-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {status && (
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200">
              Status: {status}
              <button onClick={() => setStatus('')} className="hover:text-blue-900">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {(dateFrom || dateTo) && (
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200">
              Date: {dateFrom || 'Start'} to {dateTo || 'End'}
              <button
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
                className="hover:text-blue-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
        <table className="min-w-full divide-y divide-border text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-text-muted font-medium">
            <tr>
              <th
                onClick={() => handleSort('trade_date')}
                className="px-4 py-3.5 cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                title="Sort by Trade Date"
              >
                <div className="flex items-center gap-1.5">
                  <span className={ordering.includes('trade_date') ? 'font-bold text-text-main' : ''}>
                    Code / Date
                  </span>
                  {renderSortIcon('trade_date')}
                </div>
              </th>
              <th className="px-4 py-3.5">Account</th>
              <th className="px-4 py-3.5">Instrument</th>
              <th className="px-4 py-3.5">Type</th>
              <th
                onClick={() => handleSort('quantity')}
                className="px-4 py-3.5 text-right cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                title="Sort by Quantity"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span className={ordering.includes('quantity') ? 'font-bold text-text-main' : ''}>
                    Qty
                  </span>
                  {renderSortIcon('quantity')}
                </div>
              </th>
              <th
                onClick={() => handleSort('price')}
                className="px-4 py-3.5 text-right cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                title="Sort by Price"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span className={ordering.includes('price') ? 'font-bold text-text-main' : ''}>
                    Price
                  </span>
                  {renderSortIcon('price')}
                </div>
              </th>
              <th
                onClick={() => handleSort('amount')}
                className="px-4 py-3.5 text-right cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                title="Sort by Amount"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span className={ordering.includes('amount') ? 'font-bold text-text-main' : ''}>
                    Amount
                  </span>
                  {renderSortIcon('amount')}
                </div>
              </th>
              <th className="px-4 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
                  Loading transactions...
                </td>
              </tr>
            ) : data?.results.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
                  No transactions found matching the criteria.
                </td>
              </tr>
            ) : (
              data?.results.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-text-main">{tx.transaction_code}</div>
                    <div className="text-xs text-text-muted">{formatDate(tx.trade_date)}</div>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-text-muted">{tx.account_code}</td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-text-main">{tx.instrument_symbol}</div>
                    <div className="text-xs text-text-muted truncate max-w-xs">{tx.instrument_name}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-text-muted border border-slate-200">
                      {tx.transaction_type}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums">
                    {parseFloat(tx.quantity).toFixed(2)}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums">
                    {formatINR(tx.price)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold text-text-main tabular-nums">
                    {formatINR(tx.amount)}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                        tx.status === 'SETTLED'
                          ? 'bg-green-50 text-green-700 ring-green-600/20'
                          : tx.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
                          : 'bg-red-50 text-red-700 ring-red-600/20'
                      }`}
                    >
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

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
              of <span className="font-semibold text-text-main">{totalCount.toLocaleString()}</span> transactions
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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

      {/* Shared Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        initialFilters={{
          exportType: 'transactions',
          customerCodes: [customerCode],
          accountCodes: selectedAccounts,
          dateFrom,
          dateTo,
          transactionType: type,
          status,
        }}
      />
    </div>
  );
};
