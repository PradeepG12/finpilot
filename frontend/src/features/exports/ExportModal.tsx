import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { downloadFile } from '@/lib/download';
import {
  ApiResponse,
  CustomerLookupItem,
  AccountLookupItem,
  ExportType,
  ExportInitialFilters,
} from '@/types/api';
import {
  MultiSelectDropdown,
  MultiSelectItem,
} from '@/components/ui/MultiSelectDropdown';
import {
  X,
  Download,
  Loader2,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFilters?: ExportInitialFilters;
  onExportSuccess?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  initialFilters,
  onExportSuccess,
}) => {
  // 1. Export type selector
  const [exportType, setExportType] = useState<ExportType>('transactions');

  // 2. Scope / Filter controls
  const [selectedCustomerCodes, setSelectedCustomerCodes] = useState<string[]>([]);
  const [selectedAccountCodes, setSelectedAccountCodes] = useState<string[]>([]);

  // 3. Type-specific filters
  // Transactions
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [status, setStatus] = useState('');
  const [instrumentSearch, setInstrumentSearch] = useState('');

  // Portfolio positions
  const [assetClass, setAssetClass] = useState('');
  const [snapshotDate, setSnapshotDate] = useState('');

  // Goals
  const [priority, setPriority] = useState('');
  const [targetDateFrom, setTargetDateFrom] = useState('');
  const [targetDateTo, setTargetDateTo] = useState('');

  // Customers
  const [kycStatus, setKycStatus] = useState('');
  const [segment, setSegment] = useState('');

  // Accounts
  const [accountType, setAccountType] = useState('');
  const [provider, setProvider] = useState('');

  // Status & feedback
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initialize filters when opened or initialFilters change
  useEffect(() => {
    if (isOpen) {
      setExportType(initialFilters?.exportType || 'transactions');
      setSelectedCustomerCodes(initialFilters?.customerCodes || []);
      setSelectedAccountCodes(initialFilters?.accountCodes || []);
      setDateFrom(initialFilters?.dateFrom || '');
      setDateTo(initialFilters?.dateTo || '');
      setTransactionType(initialFilters?.transactionType || '');
      setStatus(initialFilters?.status || '');
      setAssetClass(initialFilters?.assetClass || '');
      setPriority(initialFilters?.priority || '');
      setSnapshotDate(initialFilters?.snapshotDate || '');
      setKycStatus(initialFilters?.kycStatus || '');
      setSegment(initialFilters?.segment || '');
      setAccountType(initialFilters?.accountType || '');
      setProvider(initialFilters?.provider || '');
      setInstrumentSearch('');
      setIsProcessing(false);
      setProgressText('');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, initialFilters]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen && !isProcessing) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  // Fetch all customers for multi-select
  const { data: customerLookup = [], isLoading: isLoadingCustomers } = useQuery<CustomerLookupItem[]>({
    queryKey: ['customers-lookup'],
    queryFn: async (): Promise<CustomerLookupItem[]> => {
      try {
        const res = await apiClient.get<ApiResponse<CustomerLookupItem[]>>('/customers/lookup/');
        const data = res.data.data;
        if (Array.isArray(data)) return data;
        if (Array.isArray((data as any)?.results)) return (data as any).results;
        return [];
      } catch {
        return [];
      }
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch all accounts for multi-select
  const { data: accountLookup = [], isLoading: isLoadingAccounts } = useQuery<AccountLookupItem[]>({
    queryKey: ['accounts-lookup'],
    queryFn: async (): Promise<AccountLookupItem[]> => {
      try {
        const res = await apiClient.get<ApiResponse<AccountLookupItem[]>>('/accounts/lookup/');
        const data = res.data.data;
        if (Array.isArray(data)) return data;
        if (Array.isArray((data as any)?.results)) return (data as any).results;
        return [];
      } catch {
        return [];
      }
    },
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  // Format customer items for dropdown
  const customerItems: MultiSelectItem[] = useMemo(() => {
    if (!Array.isArray(customerLookup)) return [];
    return customerLookup.map((c) => ({
      id: c.customer_code,
      label: `${c.full_name} (${c.customer_code})`,
      sublabel: c.email,
    }));
  }, [customerLookup]);

  // Filter accounts constrained to selected customers (case-insensitive & trimmed)
  const availableAccounts = useMemo(() => {
    if (!Array.isArray(accountLookup)) return [];
    if (selectedCustomerCodes.length === 0) {
      return accountLookup;
    }
    const cleanCustomerCodes = new Set(
      selectedCustomerCodes.map((c) => String(c).trim().toUpperCase())
    );
    return accountLookup.filter((acc) => {
      const code = String(acc.customer_code || '').trim().toUpperCase();
      return cleanCustomerCodes.has(code);
    });
  }, [accountLookup, selectedCustomerCodes]);

  const accountItems: MultiSelectItem[] = useMemo(() => {
    return availableAccounts.map((a) => ({
      id: a.account_code,
      label: `${a.account_code} · ${a.account_type}`,
      sublabel: a.provider || a.customer_code,
    }));
  }, [availableAccounts]);

  // Handle customer change and prune orphaned account selections
  const handleCustomersChange = (newCustCodes: string[]) => {
    setSelectedCustomerCodes(newCustCodes);
    if (newCustCodes.length > 0) {
      const validAccountCodes = new Set(
        accountLookup
          .filter((a: AccountLookupItem) => newCustCodes.includes(a.customer_code))
          .map((a: AccountLookupItem) => a.account_code)
      );
      setSelectedAccountCodes((prev) => prev.filter((acc) => validAccountCodes.has(acc)));
    }
  };

  // Validation
  const validationError = useMemo(() => {
    if (exportType === 'transactions') {
      if (dateFrom && dateTo && dateFrom > dateTo) {
        return 'Date From cannot be after Date To.';
      }
    }
    if (exportType === 'goals') {
      if (targetDateFrom && targetDateTo && targetDateFrom > targetDateTo) {
        return 'Target Date From cannot be after Target Date To.';
      }
    }
    return null;
  }, [exportType, dateFrom, dateTo, targetDateFrom, targetDateTo]);

  // Asynchronous export task initiation and status polling
  const handleExport = async () => {
    if (validationError) return;

    setIsProcessing(true);
    setProgressText('Submitting export task...');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload: Record<string, any> = {
        export_type: exportType,
        customer_codes: selectedCustomerCodes,
        account_codes: selectedAccountCodes,
      };

      if (exportType === 'transactions') {
        if (dateFrom) payload.date_from = dateFrom;
        if (dateTo) payload.date_to = dateTo;
        if (transactionType) payload.transaction_type = [transactionType];
        if (status) payload.status = [status];
        if (instrumentSearch.trim()) payload.instrument = instrumentSearch.trim();
      } else if (exportType === 'portfolio_positions') {
        if (assetClass) payload.asset_class = [assetClass];
        if (snapshotDate) payload.snapshot_date = snapshotDate;
      } else if (exportType === 'goals') {
        if (priority) payload.priority = [priority];
        if (targetDateFrom) payload.target_date_from = targetDateFrom;
        if (targetDateTo) payload.target_date_to = targetDateTo;
      } else if (exportType === 'customers') {
        if (kycStatus) payload.kyc_status = [kycStatus];
        if (segment) payload.segment = [segment];
      } else if (exportType === 'accounts') {
        if (accountType) payload.account_type = [accountType];
        if (status) payload.status = [status];
        if (provider.trim()) payload.provider = provider.trim();
      }

      // Step 1: Create export job in model and dispatch Celery task
      const postRes = await apiClient.post<ApiResponse<{ uuid: string; status: string }>>('/exports/', payload);
      const reportUuid = postRes.data.data.uuid;

      setProgressText('Export queued. Generating data with Celery...');

      // Step 2: Poll status until COMPLETED or FAILED
      let attempts = 0;
      const maxAttempts = 60;
      let isDone = false;

      while (attempts < maxAttempts && !isDone && isMountedRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;

        try {
          const statusRes = await apiClient.get<ApiResponse<{
            uuid: string;
            status: string;
            file_name: string;
            row_count: number;
            can_download: boolean;
            error_message?: string;
          }>>(`/exports/${reportUuid}/status/`);

          const statusData = statusRes.data.data;

          if (statusData.status === 'COMPLETED') {
            isDone = true;
            setProgressText('Export ready. Downloading CSV...');
            
            // Step 3: Trigger download and server file removal
            const filename = statusData.file_name || `finpilot_${exportType}.csv`;
            await downloadFile(`/exports/${reportUuid}/download/`, filename);

            if (isMountedRef.current) {
              setSuccessMessage(`Downloaded ${statusData.row_count.toLocaleString()} rows. Server file cleaned.`);
              onExportSuccess?.();
              setTimeout(() => {
                if (isMountedRef.current) {
                  onClose();
                }
              }, 1200);
            }
            return;
          } else if (statusData.status === 'FAILED') {
            throw new Error(statusData.error_message || 'Export task failed on server.');
          } else {
            setProgressText(`Processing ${exportType.replace('_', ' ')} (${statusData.status.toLowerCase()}... ${attempts}s)`);
          }
        } catch (pollErr: any) {
          if (pollErr.message && !pollErr.response) {
            throw pollErr;
          }
          // Retry on transient network blip during polling
        }
      }

      if (!isDone && isMountedRef.current) {
        setProgressText('Export is running in background. You can download it anytime from the Reports list.');
        onExportSuccess?.();
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        const detail =
          err?.response?.data?.error?.message ||
          err?.response?.data?.detail ||
          err?.message ||
          'Failed to generate export. Please check your filters and try again.';
        setErrorMessage(detail);
      }
    } finally {
      if (isMountedRef.current) {
        setIsProcessing(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        onClick={() => !isProcessing && onClose()}
      />

      {/* Modal / Drawer Container */}
      <div className="fixed inset-0 sm:inset-y-6 sm:inset-x-auto sm:right-6 sm:max-w-2xl w-full flex flex-col justify-end sm:justify-center p-0 sm:p-0 pointer-events-none">
        <div className="pointer-events-auto bg-surface w-full h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-2xl border-0 sm:border border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:slide-in-from-right duration-300">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-5 bg-surface shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-main">Export Data</h2>
                <p className="text-xs text-text-muted">
                  Configure filters and generate downloadable CSV reports.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-slate-100 transition-colors disabled:opacity-40"
              aria-label="Close export dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Feedback Alerts */}
            {errorMessage && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 text-loss border border-red-200 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-green-50 text-gain border border-green-200 text-xs">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* 1. Export Type Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-main uppercase tracking-wider">
                1. Select Export Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => setExportType('transactions')}
                  disabled={isProcessing}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    exportType === 'transactions'
                      ? 'border-primary bg-primary/5 text-primary shadow-xs ring-1 ring-primary'
                      : 'border-border bg-surface text-text-main hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-bold truncate">Transactions</p>
                  <p className="text-3xs text-text-muted mt-0.5 truncate">Trades & logs</p>
                </button>

                <button
                  type="button"
                  onClick={() => setExportType('portfolio_positions')}
                  disabled={isProcessing}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    exportType === 'portfolio_positions'
                      ? 'border-primary bg-primary/5 text-primary shadow-xs ring-1 ring-primary'
                      : 'border-border bg-surface text-text-main hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-bold truncate">Portfolio</p>
                  <p className="text-3xs text-text-muted mt-0.5 truncate">Holdings & value</p>
                </button>

                <button
                  type="button"
                  onClick={() => setExportType('customers')}
                  disabled={isProcessing}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    exportType === 'customers'
                      ? 'border-primary bg-primary/5 text-primary shadow-xs ring-1 ring-primary'
                      : 'border-border bg-surface text-text-main hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-bold truncate">Customers</p>
                  <p className="text-3xs text-text-muted mt-0.5 truncate">Profiles & KYC</p>
                </button>

                <button
                  type="button"
                  onClick={() => setExportType('accounts')}
                  disabled={isProcessing}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    exportType === 'accounts'
                      ? 'border-primary bg-primary/5 text-primary shadow-xs ring-1 ring-primary'
                      : 'border-border bg-surface text-text-main hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-bold truncate">Accounts</p>
                  <p className="text-3xs text-text-muted mt-0.5 truncate">Investments</p>
                </button>

                <button
                  type="button"
                  onClick={() => setExportType('goals')}
                  disabled={isProcessing}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    exportType === 'goals'
                      ? 'border-primary bg-primary/5 text-primary shadow-xs ring-1 ring-primary'
                      : 'border-border bg-surface text-text-main hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-bold truncate">Goals</p>
                  <p className="text-3xs text-text-muted mt-0.5 truncate">Target & progress</p>
                </button>
              </div>
            </div>

            {/* 2. Scope Controls: Customer and Account Multi-Select */}
            <div className="space-y-4 pt-1 border-t border-border">
              <label className="text-xs font-semibold text-text-main uppercase tracking-wider block">
                2. Scope & Scope Filters
              </label>

              {/* Customer Multi-Select */}
              <div className="space-y-1.5">
                <MultiSelectDropdown
                  label="Customers"
                  items={customerItems}
                  selectedValues={selectedCustomerCodes}
                  onChange={handleCustomersChange}
                  placeholder="All customers (or select specific)"
                  isLoading={isLoadingCustomers}
                  disabled={isProcessing}
                />
              </div>

              {/* Account Multi-Select (Constrained to Customers if selected, not applicable for Customers or Goals exports) */}
              {exportType !== 'goals' && exportType !== 'customers' && (
                <div className="space-y-1.5">
                  <MultiSelectDropdown
                    label="Accounts"
                    items={accountItems}
                    selectedValues={selectedAccountCodes}
                    onChange={setSelectedAccountCodes}
                    placeholder={
                      selectedCustomerCodes.length > 0
                        ? 'All accounts for selected customer(s)'
                        : 'All accounts (or select specific)'
                    }
                    isLoading={isLoadingAccounts}
                    disabled={isProcessing}
                    emptyMessage={
                      selectedCustomerCodes.length > 0
                        ? 'No accounts registered under the selected customer(s).'
                        : 'No accounts available.'
                    }
                  />
                  {selectedCustomerCodes.length > 0 && (
                    <p className="text-3xs text-primary font-medium">
                      Filtered to accounts of {selectedCustomerCodes.length} selected customer{selectedCustomerCodes.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 3. Type-Specific Filters */}
            <div className="space-y-4 pt-1 border-t border-border">
              <label className="text-xs font-semibold text-text-main uppercase tracking-wider block">
                3. {exportType === 'transactions' ? 'Transaction Filters' : exportType === 'portfolio_positions' ? 'Portfolio Filters' : exportType === 'customers' ? 'Customer Filters' : exportType === 'accounts' ? 'Account Filters' : 'Goal Filters'}
              </label>

              {/* Customers Type Filters */}
              {exportType === 'customers' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-text-muted">KYC Status</label>
                      <select
                        value={kycStatus}
                        onChange={(e) => setKycStatus(e.target.value)}
                        disabled={isProcessing}
                        className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-xs text-text-main focus:outline-hidden focus:ring-1 focus:ring-primary"
                      >
                        <option value="">All KYC Statuses</option>
                        <option value="VERIFIED">VERIFIED</option>
                        <option value="PENDING">PENDING</option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-text-muted">Segment</label>
                      <select
                        value={segment}
                        onChange={(e) => setSegment(e.target.value)}
                        disabled={isProcessing}
                        className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-xs text-text-main focus:outline-hidden focus:ring-1 focus:ring-primary"
                      >
                        <option value="">All Segments</option>
                        <option value="RETAIL">RETAIL</option>
                        <option value="AFFLUENT">AFFLUENT</option>
                        <option value="HNI">HNI</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Accounts Type Filters */}
              {exportType === 'accounts' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-text-muted">Account Type</label>
                      <select
                        value={accountType}
                        onChange={(e) => setAccountType(e.target.value)}
                        disabled={isProcessing}
                        className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-xs text-text-main focus:outline-hidden focus:ring-1 focus:ring-primary"
                      >
                        <option value="">All Types</option>
                        <option value="BROKERAGE">BROKERAGE</option>
                        <option value="MUTUAL_FUND">MUTUAL_FUND</option>
                        <option value="RETIREMENT">RETIREMENT</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-text-muted">Account Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        disabled={isProcessing}
                        className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-xs text-text-main focus:outline-hidden focus:ring-1 focus:ring-primary"
                      >
                        <option value="">All Statuses</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="DORMANT">DORMANT</option>
                        <option value="CLOSED">CLOSED</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-muted">Provider</label>
                    <input
                      type="text"
                      placeholder="e.g. Zerodha, Groww, Vanguard..."
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      disabled={isProcessing}
                      className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-xs text-text-main focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              {/* Transactions Type Filters */}
              {exportType === 'transactions' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-text-muted">Trade Date From</label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        disabled={isProcessing}
                        className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-xs text-text-main focus:outline-hidden focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-text-muted">Trade Date To</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        disabled={isProcessing}
                        className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-xs text-text-main focus:outline-hidden focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-text-muted">Transaction Type</label>
                      <select
                        value={transactionType}
                        onChange={(e) => setTransactionType(e.target.value)}
                        disabled={isProcessing}
                        className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-xs text-text-main focus:outline-hidden focus:ring-1 focus:ring-primary"
                      >
                        <option value="">All Types</option>
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                        <option value="DIVIDEND">DIVIDEND</option>
                        <option value="FEE">FEE</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-text-muted">Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        disabled={isProcessing}
                        className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-xs text-text-main focus:outline-hidden focus:ring-1 focus:ring-primary"
                      >
                        <option value="">All Statuses</option>
                        <option value="SETTLED">SETTLED</option>
                        <option value="PENDING">PENDING</option>
                        <option value="FAILED">FAILED</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-muted">Instrument Search</label>
                    <input
                      type="text"
                      placeholder="Symbol or instrument name (e.g. RELIANCE)..."
                      value={instrumentSearch}
                      onChange={(e) => setInstrumentSearch(e.target.value)}
                      disabled={isProcessing}
                      className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-xs text-text-main focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              {/* Portfolio Positions Type Filters */}
              {exportType === 'portfolio_positions' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-text-muted">Asset Class</label>
                      <select
                        value={assetClass}
                        onChange={(e) => setAssetClass(e.target.value)}
                        disabled={isProcessing}
                        className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-xs text-text-main focus:outline-hidden focus:ring-1 focus:ring-primary"
                      >
                        <option value="">All Asset Classes</option>
                        <option value="EQUITY">EQUITY</option>
                        <option value="MUTUAL_FUND">MUTUAL_FUND</option>
                        <option value="FIXED_INCOME">FIXED_INCOME</option>
                        <option value="COMMODITY">COMMODITY</option>
                        <option value="REAL_ESTATE">REAL_ESTATE</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-text-muted">Snapshot As-Of Date</label>
                      <input
                        type="date"
                        value={snapshotDate}
                        onChange={(e) => setSnapshotDate(e.target.value)}
                        disabled={isProcessing}
                        className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-xs text-text-main focus:outline-hidden focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Goals Type Filters */}
              {exportType === 'goals' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-text-muted">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      disabled={isProcessing}
                      className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-xs text-text-main focus:outline-hidden focus:ring-1 focus:ring-primary"
                    >
                      <option value="">All Priorities</option>
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="LOW">LOW</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-text-muted">Target Date From</label>
                      <input
                        type="date"
                        value={targetDateFrom}
                        onChange={(e) => setTargetDateFrom(e.target.value)}
                        disabled={isProcessing}
                        className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-xs text-text-main focus:outline-hidden focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-text-muted">Target Date To</label>
                      <input
                        type="date"
                        value={targetDateTo}
                        onChange={(e) => setTargetDateTo(e.target.value)}
                        disabled={isProcessing}
                        className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-xs text-text-main focus:outline-hidden focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Filter Summary Before Download */}
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border p-4 space-y-2">
              <h4 className="text-xs font-bold text-text-main flex items-center justify-between">
                <span>Summary & Scope</span>
                <span className="text-3xs uppercase font-semibold text-primary tracking-wider">
                  {exportType.replace('_', ' ')}
                </span>
              </h4>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-text-muted">
                <div>
                  <span className="font-medium text-text-main">Customers: </span>
                  {selectedCustomerCodes.length === 0 ? 'All customers' : `${selectedCustomerCodes.length} selected`}
                </div>
                {exportType !== 'goals' && exportType !== 'customers' && (
                  <div>
                    <span className="font-medium text-text-main">Accounts: </span>
                    {selectedAccountCodes.length === 0
                      ? (selectedCustomerCodes.length > 0 ? 'All accounts for selected customer(s)' : 'All accounts')
                      : `${selectedAccountCodes.length} selected`}
                  </div>
                )}
                {exportType === 'customers' && (
                  <>
                    <div>
                      <span className="font-medium text-text-main">KYC Status: </span>
                      {kycStatus || 'All'}
                    </div>
                    <div>
                      <span className="font-medium text-text-main">Segment: </span>
                      {segment || 'All'}
                    </div>
                  </>
                )}
                {exportType === 'accounts' && (
                  <>
                    <div>
                      <span className="font-medium text-text-main">Type / Status: </span>
                      {accountType || 'All'} / {status || 'All'}
                    </div>
                    <div>
                      <span className="font-medium text-text-main">Provider: </span>
                      {provider || 'Any'}
                    </div>
                  </>
                )}
                {exportType === 'transactions' && (
                  <>
                    <div>
                      <span className="font-medium text-text-main">Date Range: </span>
                      {dateFrom || dateTo ? `${dateFrom || 'Any'} to ${dateTo || 'Any'}` : 'All time'}
                    </div>
                    <div>
                      <span className="font-medium text-text-main">Type / Status: </span>
                      {transactionType || 'Any'} / {status || 'Any'}
                    </div>
                  </>
                )}
                {exportType === 'portfolio_positions' && (
                  <>
                    <div>
                      <span className="font-medium text-text-main">Asset Class: </span>
                      {assetClass || 'All'}
                    </div>
                    <div>
                      <span className="font-medium text-text-main">Snapshot: </span>
                      {snapshotDate || 'Latest'}
                    </div>
                  </>
                )}
                {exportType === 'goals' && (
                  <>
                    <div>
                      <span className="font-medium text-text-main">Priority: </span>
                      {priority || 'All'}
                    </div>
                    <div>
                      <span className="font-medium text-text-main">Target Date: </span>
                      {targetDateFrom || targetDateTo ? `${targetDateFrom || 'Any'} to ${targetDateTo || 'Any'}` : 'All'}
                    </div>
                  </>
                )}
              </div>

              {validationError && (
                <p className="text-xs font-medium text-loss mt-2 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{validationError}</span>
                </p>
              )}
            </div>
          </div>

          {/* Sticky Actions Footer */}
          <div className="border-t border-border p-4 bg-surface flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="text-xs text-text-muted flex items-center gap-2">
              {isProcessing && (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="font-medium text-primary">{progressText}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl border border-border text-xs font-semibold text-text-muted hover:text-text-main hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleExport}
                disabled={isProcessing || Boolean(validationError)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-dark shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary focus:ring-offset-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>Download Report</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
