import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { downloadFile } from '@/lib/download';
import { ApiResponse, ImportBatchResult, ImportBatchDetail, ImportRowResult, PaginatedData } from '@/types/api';
import { formatDate } from '@/lib/format';
import {
  Upload,
  Download,
  ArrowLeft,
  Loader2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  Code,
  Copy,
  Check,
} from 'lucide-react';

export const ImportPage: React.FC = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState('TRANSACTIONS');
  const [dryRun, setDryRun] = useState(false);
  const [activeBatchUuid, setActiveBatchUuid] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Status filter: all results first, then rejected or skipped rows.
  const [activeTab, setActiveTab] = useState<'ALL' | 'REJECTED' | 'SKIPPED_DUPLICATE'>('ALL');
  const [filterCode, setFilterCode] = useState<string>('');
  const pageSize = 25;
  const [page, setPage] = useState<number>(1);

  // Detail Modal / Popover State
  const [selectedRow, setSelectedRow] = useState<ImportRowResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Handle ESC key to close modal/drawer
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (selectedRow) setSelectedRow(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRow]);

  // Poll active batch summary while PROCESSING or PENDING
  const { data: activeBatchDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['importDetail', activeBatchUuid],
    queryFn: async () => {
      if (!activeBatchUuid) return null;
      const res = await apiClient.get<ApiResponse<ImportBatchDetail>>(`/admin/imports/${activeBatchUuid}/`);
      return res.data.data;
    },
    enabled: !!activeBatchUuid,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === 'PROCESSING' || data.status === 'PENDING')) {
        return 1000;
      }
      return false;
    },
  });

  // Query paginated import row results from /admin/imports/{batch_uuid}/rows/
  const { data: rowResults, isLoading: isRowsLoading } = useQuery({
    queryKey: ['importRows', activeBatchUuid, activeTab, filterCode, page, pageSize],
    queryFn: async () => {
      if (!activeBatchUuid) return null;
      const params = new URLSearchParams();
      if (activeTab !== 'ALL') {
        params.append('outcome', activeTab);
      } else {
        params.append('outcome', 'ALL');
      }
      if (filterCode.trim()) {
        params.append('code', filterCode.trim());
      }
      params.append('page', page.toString());
      params.append('page-size', pageSize.toString());

      const res = await apiClient.get<ApiResponse<PaginatedData<ImportRowResult>>>(
        `/admin/imports/${activeBatchUuid}/rows/?${params.toString()}`
      );
      return res.data.data;
    },
    enabled: !!activeBatchUuid,
  });

  const { data: errorCodes = [] } = useQuery({
    queryKey: ['importRowCodes', activeBatchUuid, activeTab],
    queryFn: async () => {
      if (!activeBatchUuid) return [];
      const params = new URLSearchParams();
      if (activeTab !== 'ALL') params.append('outcome', activeTab);
      const res = await apiClient.get<ApiResponse<string[]>>(`/admin/imports/${activeBatchUuid}/rows/codes/?${params.toString()}`);
      return res.data.data;
    },
    enabled: !!activeBatchUuid,
  });

  // Historical import batches list
  const { data: history } = useQuery({
    queryKey: ['importHistory'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PaginatedData<ImportBatchDetail>>>('/admin/imports/');
      return res.data.data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Please select a file.');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('import_type', importType);
      formData.append('dry_run', dryRun.toString());
      formData.append('async', 'true');

      const res = await apiClient.post<ApiResponse<ImportBatchResult>>(
        '/admin/imports/upload/',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      setActiveBatchUuid(data.batch);
      setUploadError(null);
      setPage(1);
      setFilterCode('');
      setActiveTab('ALL');
      queryClient.invalidateQueries({ queryKey: ['importHistory'] });
    },
    onError: (err: any) => {
      const detail = err.response?.data?.data?.detail || err.response?.data?.data?.file?.[0] || 'Upload failed.';
      setUploadError(detail);
    },
  });

  // Authenticated CSV Export via Blob
  const handleDownloadCsv = async (batchUuid: string) => {
    setIsExporting(true);
    setExportError(null);
    try {
      const params = new URLSearchParams();
      if (activeTab !== 'ALL') {
        params.append('outcome', activeTab);
      } else {
        params.append('outcome', 'ALL');
      }
      if (filterCode.trim()) {
        params.append('code', filterCode.trim());
      }
      params.append('export', 'csv');

      const defaultFilename =
        `${activeBatchDetail?.file_name?.replace(/\.csv$/i, '') || 'import'}_${activeTab.toLowerCase()}_rows.csv`;

      await downloadFile(
        `/admin/imports/${batchUuid}/rows/?${params.toString()}`,
        defaultFilename
      );
    } catch (err: any) {
      const msg = err.response?.data?.data?.detail || 'Failed to export CSV. Please try again.';
      setExportError(msg);
      setTimeout(() => setExportError(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyJson = (rawRow: Record<string, any>) => {
    navigator.clipboard.writeText(JSON.stringify(rawRow, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isBatchProcessing = activeBatchDetail?.status === 'PROCESSING' || activeBatchDetail?.status === 'PENDING';
  const progressPercent = activeBatchDetail?.counts?.total
    ? Math.min(100, Math.round(((activeBatchDetail.counts.processed || 0) / activeBatchDetail.counts.total) * 100))
    : (isBatchProcessing ? 15 : 100);

  const warningEntries = Object.entries(activeBatchDetail?.warnings || {}).filter(([, count]) => count > 0);
  const warningCount = warningEntries.reduce((total, [, count]) => total + count, 0);

  // Semantic Status Badges (Subtle tinted)
  const getStatusBadge = (status: string, isDryRun: boolean) => {
    if (isDryRun) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20">
          DRY RUN
        </span>
      );
    }
    if (status === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">
          Completed
        </span>
      );
    }
    if (status === 'COMPLETED_WITH_ERRORS') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20">
          Completed with Notices
        </span>
      );
    }
    if (status === 'PROCESSING' || status === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 animate-pulse">
          Processing...
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-50 text-loss ring-1 ring-inset ring-red-600/20">
        Failed
      </span>
    );
  };

  const rows = rowResults?.results || [];
  const totalRowsCount = rowResults?.count || 0;
  const totalPages = Math.ceil(totalRowsCount / pageSize) || 1;

  // =========================================================================
  // FULL PAGE VIEW: Batch Details & Paginated Row Results
  // =========================================================================
  if (activeBatchUuid) {
    const currentTabCount = activeTab === 'REJECTED'
      ? activeBatchDetail?.counts?.rejected ?? 0
      : activeTab === 'SKIPPED_DUPLICATE'
        ? activeBatchDetail?.counts?.skipped_duplicate ?? 0
        : (activeBatchDetail?.counts?.rejected ?? 0) + (activeBatchDetail?.counts?.skipped_duplicate ?? 0);

    return (
      <div className="space-y-6">
        {/* Back Button matching customer overview pattern */}
        <div>
          <button
            type="button"
            onClick={() => {
              setActiveBatchUuid(null);
              setFilterCode('');
              setPage(1);
              setActiveTab('ALL');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-text-main hover:bg-slate-50 transition-colors shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Imports</span>
          </button>
        </div>

        {/* Export Error Alert */}
        {exportError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-loss flex items-center justify-between shadow-xs">
            <span>{exportError}</span>
            <button onClick={() => setExportError(null)} className="p-1 hover:bg-red-100 rounded">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-text-main">
                {activeBatchDetail?.file_name || 'Loading batch...'}
              </h1>
              {activeBatchDetail && getStatusBadge(activeBatchDetail.status, activeBatchDetail.is_dry_run)}
            </div>
            <p className="text-xs font-mono text-text-muted mt-1">
              UUID: {activeBatchUuid} • Type: {activeBatchDetail?.import_type || '—'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeBatchDetail && currentTabCount > 0 && (
              <button
                type="button"
                onClick={() => handleDownloadCsv(activeBatchUuid)}
                disabled={isExporting}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-text-main hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-xs transition-colors disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Download className="h-4 w-4" />}
                <span>
                  {isExporting
                    ? 'Exporting CSV...'
                    : `Export ${activeTab === 'ALL' ? 'All results' : activeTab === 'REJECTED' ? 'Rejected' : 'Skipped'} CSV`}
                </span>
              </button>
            )}
          </div>
        </div>

        {isDetailLoading && !activeBatchDetail ? (
          <div className="rounded-xl border border-border bg-surface p-12 text-center text-text-muted">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-sm">Loading batch details...</p>
          </div>
        ) : activeBatchDetail ? (
          <div className="space-y-6">
            {/* Background Processing Progress Bar */}
            {isBatchProcessing && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-xs">
                <div className="flex justify-between items-center text-sm font-semibold text-slate-800">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Processing file in background... ({activeBatchDetail.counts.processed || 0} / {activeBatchDetail.counts.total} rows)
                  </span>
                  <span className="text-primary font-bold">{progressPercent}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(5, progressPercent)}%` }}
                  />
                </div>
              </div>
            )}

            {/* KPI Summary Cards (Calm Financial White/Slate Surface) */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {/* Total Rows */}
              <div className="rounded-xl border border-border bg-surface p-5 shadow-xs">
                <div className="text-xs font-semibold text-text-muted uppercase tracking-wider">Total Rows</div>
                <div className="text-2xl font-bold text-text-main mt-1 tabular-nums">
                  {activeBatchDetail.counts.total.toLocaleString()}
                </div>
                <div className="text-xs text-text-muted mt-1">Uploaded in file</div>
              </div>

              {/* Imported */}
              <div className="rounded-xl border border-border bg-surface p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Imported</span>
                  <span className="h-2 w-2 rounded-full bg-gain" />
                </div>
                <div className="text-2xl font-bold text-text-main mt-1 tabular-nums">
                  {activeBatchDetail.counts.imported.toLocaleString()}
                </div>
                <div className="text-xs text-gain font-medium mt-1">Stored successfully</div>
              </div>

              {/* Skipped Duplicates */}
              <div className="rounded-xl border border-border bg-surface p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Skipped</span>
                  <span className="h-2 w-2 rounded-full bg-warning" />
                </div>
                <div className="text-2xl font-bold text-text-main mt-1 tabular-nums">
                  {activeBatchDetail.counts.skipped_duplicate.toLocaleString()}
                </div>
                <div className="text-xs text-warning font-medium mt-1">Duplicate records</div>
              </div>

              {/* Rejected */}
              <div className="rounded-xl border border-border bg-surface p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Rejected</span>
                  <span className="h-2 w-2 rounded-full bg-loss" />
                </div>
                <div className="text-2xl font-bold text-text-main mt-1 tabular-nums">
                  {activeBatchDetail.counts.rejected.toLocaleString()}
                </div>
                <div className="text-xs text-loss font-medium mt-1">Validation errors</div>
              </div>

              {/* Warnings */}
              <div className="col-span-2 sm:col-span-1 rounded-xl border border-border bg-surface p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Warnings</span>
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                </div>
                <div className="text-2xl font-bold text-text-main mt-1 tabular-nums">
                  {warningCount.toLocaleString()}
                </div>
                <div className="text-xs text-text-muted mt-1">Processed notices</div>
              </div>
            </div>

            {/* Batch timing is reference information, not an interactive card. */}
            <div className="grid grid-cols-1 divide-y divide-border rounded-xl border border-border bg-surface text-sm shadow-xs sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="px-5 py-4">
                <div className="text-xs font-medium text-text-muted">Started</div>
                <div className="mt-1 font-semibold text-text-main">{formatDate(activeBatchDetail.started_at?.split('T')[0])}</div>
              </div>
              <div className="px-5 py-4">
                <div className="text-xs font-medium text-text-muted">Finished</div>
                <div className="mt-1 font-semibold text-text-main">{activeBatchDetail.finished_at ? formatDate(activeBatchDetail.finished_at.split('T')[0]) : 'In progress'}</div>
              </div>
              <div className="px-5 py-4">
                <div className="text-xs font-medium text-text-muted">Import mode</div>
                <div className="mt-1 font-semibold text-text-main">{activeBatchDetail.is_dry_run ? 'Validation only' : 'Import and save'}</div>
              </div>
            </div>

            {/* Warnings Summary if present */}
            {warningEntries.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-2">
                <div className="text-xs font-semibold text-text-main flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  <span>Validation Notices Breakdown</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {warningEntries.map(([code, count]) => (
                    <span key={code} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 text-xs text-text-main">
                      <span className="font-mono font-medium">{code}:</span>
                      <span className="font-bold text-amber-700">{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Paginated Row Results Table Section */}
            <section aria-labelledby="row-results-heading" className="rounded-xl border border-border bg-surface p-5 shadow-xs space-y-4 sm:p-6">
              {/* Primary Controls Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border pb-4">
                {/* Status filter: show every row-result outcome by default. */}
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => { setActiveTab('ALL'); setPage(1); }}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${activeTab === 'ALL' ? 'bg-white text-text-main shadow-xs' : 'text-text-muted hover:text-text-main'}`}
                  >
                    <span>All</span>
                    <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-2xs font-bold text-text-main">
                      {(activeBatchDetail.counts.rejected + activeBatchDetail.counts.skipped_duplicate).toLocaleString()}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('REJECTED');
                      setPage(1);
                    }}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      activeTab === 'REJECTED'
                        ? 'bg-white text-loss shadow-xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    <span>Rejected</span>
                    <span className="rounded-full bg-red-100 px-1.5 py-0.2 text-2xs font-bold text-loss">
                      {activeBatchDetail.counts.rejected}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('SKIPPED_DUPLICATE');
                      setPage(1);
                    }}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      activeTab === 'SKIPPED_DUPLICATE'
                        ? 'bg-white text-warning shadow-xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    <span>Skipped Duplicates</span>
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-2xs font-bold text-warning">
                      {activeBatchDetail.counts.skipped_duplicate}
                    </span>
                  </button>
                </div>

                {/* Error code is an exact API filter, not a free-text field. */}
                <div className="w-full sm:w-64">
                  <label htmlFor="error-code-filter" className="sr-only">Filter by error code</label>
                  <select
                    id="error-code-filter"
                    value={filterCode}
                    onChange={(e) => { setFilterCode(e.target.value); setPage(1); }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-text-main focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">All error codes</option>
                    {errorCodes.map((code) => <option key={code} value={code}>{code}</option>)}
                  </select>
                </div>
              </div>

              {/* Table or Loading / Empty States */}
              {isRowsLoading ? (
                <div className="text-center py-12 text-sm text-text-muted">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                  Loading {activeTab === 'ALL' ? 'row results' : activeTab === 'REJECTED' ? 'rejected' : 'skipped'} rows...
                </div>
              ) : rows.length === 0 ? (
                <div className="text-center py-10 text-sm text-text-muted">
                  <CheckCircle2 className="h-8 w-8 text-gain mx-auto mb-2 opacity-80" />
                  No {activeTab === 'ALL' ? 'row results' : activeTab === 'REJECTED' ? 'rejected' : 'skipped duplicate'} records found matching this filter.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="min-w-full divide-y divide-border text-left text-xs">
                      <thead className="bg-slate-50 text-text-muted uppercase font-semibold">
                        <tr>
                          <th className="px-4 py-3 w-16">Row</th>
                          <th className="px-4 py-3 w-44">Code</th>
                          <th className="px-4 py-3 w-32">Field</th>
                          <th className="px-4 py-3">Message</th>
                          <th className="px-4 py-3 text-right w-24">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {rows.map((row, idx) => {
                          const truncatedMessage =
                            row.message.length > 80
                              ? `${row.message.substring(0, 80)}...`
                              : row.message;

                          return (
                            <tr key={`${row.row_number}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-4 py-3 font-mono font-bold text-text-main">
                                {row.row_number}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`font-semibold px-2 py-0.5 rounded text-2xs ${
                                    row.outcome === 'REJECTED'
                                      ? 'text-loss bg-red-50 border border-red-200'
                                      : 'text-warning bg-amber-50 border border-amber-200'
                                  }`}
                                >
                                  {row.error_code}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-mono text-text-muted">{row.field || '—'}</td>
                              <td className="px-4 py-3 text-text-main font-medium">
                                <span
                                  onClick={() => setSelectedRow(row)}
                                  className="cursor-pointer hover:underline text-text-main hover:text-primary transition-colors"
                                  title="Click to view full error and raw payload"
                                >
                                  {truncatedMessage}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => setSelectedRow(row)}
                                  className="inline-flex items-center gap-1 text-primary hover:text-primary-dark font-semibold text-xs transition-colors"
                                >
                                  <Code className="h-3.5 w-3.5" />
                                  <span>Inspect</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Server-Side Pagination Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-text-muted">
                    <div>
                      Showing{' '}
                      <span className="font-semibold text-text-main">
                        {Math.min((page - 1) * pageSize + 1, totalRowsCount)}
                      </span>{' '}
                      to{' '}
                      <span className="font-semibold text-text-main">
                        {Math.min(page * pageSize, totalRowsCount)}
                      </span>{' '}
                      of <span className="font-semibold text-text-main">{totalRowsCount.toLocaleString()}</span> entries
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-text-main hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span>Previous</span>
                      </button>
                      <span className="px-2 font-medium">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-text-main hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                      >
                        <span>Next</span>
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : null}

        {/* Reusable Accessible Inspection Popover / Modal Drawer */}
        {selectedRow && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspect-dialog-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-150 backdrop-blur-xs"
          >
            <div className="w-full max-w-xl rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between border-b border-border pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 id="inspect-dialog-title" className="text-base font-bold text-text-main">
                      Row {selectedRow.row_number} Ingestion Detail
                    </h3>
                    <span
                      className={`text-2xs font-bold px-2 py-0.5 rounded ${
                        selectedRow.outcome === 'REJECTED'
                          ? 'bg-red-50 text-loss border border-red-200'
                          : 'bg-amber-50 text-warning border border-amber-200'
                      }`}
                    >
                      {selectedRow.outcome}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted font-mono">Code: {selectedRow.error_code}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRow(null)}
                  className="rounded-lg p-1 text-text-muted hover:bg-slate-100 hover:text-text-main transition-colors"
                  aria-label="Close dialog"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-semibold text-text-muted block">Field</span>
                  <span className="font-mono text-text-main">{selectedRow.field || 'None'}</span>
                </div>
                <div>
                  <span className="font-semibold text-text-muted block">Full Error Message</span>
                  <p className="text-text-main font-medium mt-0.5">{selectedRow.message}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-text-muted">Raw CSV Record Payload</span>
                    <button
                      type="button"
                      onClick={() => handleCopyJson(selectedRow.raw_row)}
                      className="inline-flex items-center gap-1 text-primary hover:text-primary-dark font-medium transition-colors"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-gain" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copied ? 'Copied!' : 'Copy JSON'}</span>
                    </button>
                  </div>
                  <pre className="max-h-60 overflow-auto rounded-lg bg-slate-900 text-slate-100 p-3 font-mono text-xs">
                    {JSON.stringify(selectedRow.raw_row, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSelectedRow(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-text-main hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // DEFAULT PAGE VIEW: Upload Section + Historical Batches Table
  // =========================================================================
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-main">Data Operations & Import</h1>
        <p className="text-sm text-text-muted">
          Upload a CSV by data type, run validation dry-runs, and review ingestion exceptions.
        </p>
      </div>

      {/* Upload Zone */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-text-main">Upload CSV</h2>
        <p className="text-xs text-text-muted">Choose the data type before selecting its matching CSV file.</p>

        {uploadError && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-loss border border-red-200">
            {uploadError}
          </div>
        )}

        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1 text-xs font-semibold text-text-muted">
            Import type
            <select
              value={importType}
              onChange={(e) => {
                setImportType(e.target.value);
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="min-w-44 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-text-main focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="TRANSACTIONS">Transactions</option>
              <option value="CUSTOMERS">Customers</option>
              <option value="ACCOUNTS">Accounts</option>
              <option value="INSTRUMENTS">Instruments</option>
              <option value="RISK_PROFILES">Risk profiles</option>
              <option value="GOALS">Goals</option>
              <option value="HOLDINGS">Holdings snapshot</option>
            </select>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
            id="csv-file-input"
          />

          {!file ? (
            <label
              htmlFor="csv-file-input"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 cursor-pointer shadow-xs transition-opacity"
            >
              <Upload className="h-4 w-4" />
              <span>Choose File</span>
            </label>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-primary shadow-xs animate-in fade-in duration-150">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold text-text-main truncate max-w-[200px] sm:max-w-[280px]">
                {file.name}
              </span>
              <span className="text-xs text-text-muted font-mono">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="ml-1 p-1 rounded-md text-slate-400 hover:text-loss hover:bg-red-50 transition-colors"
                title="Remove selected file"
                aria-label="Remove selected file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <label className="flex items-center space-x-2 text-sm text-text-main cursor-pointer select-none sm:mb-2">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span className="font-medium">Dry Run (Validate Only)</span>
          </label>

          <button
            onClick={() => uploadMutation.mutate()}
            disabled={!file || uploadMutation.isPending}
            className="flex items-center space-x-2 px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span>{uploadMutation.isPending ? 'Uploading...' : 'Upload & Process'}</span>
          </button>
        </div>
      </div>

      {/* Historical Batches Table */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-text-main">Historical Import Batches</h2>
            <p className="text-xs text-text-muted">Click any row to open the complete batch details and rejected rows view.</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="bg-slate-50 text-text-muted text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">File Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Imported</th>
                <th className="px-4 py-3 text-right">Rejected</th>
                <th className="px-4 py-3">Started At</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history?.results.map((b: ImportBatchDetail) => (
                <tr
                  key={b.id}
                  onClick={() => {
                    setActiveBatchUuid(b.uuid);
                    setPage(1);
                    setFilterCode('');
                    setActiveTab('ALL');
                  }}
                  className="cursor-pointer hover:bg-slate-50/80 transition-colors group"
                >
                  <td className="px-4 py-3 font-medium text-text-main flex items-center gap-2">
                    <FileText className="h-4 w-4 text-text-muted group-hover:text-primary transition-colors" />
                    <span>{b.file_name}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">{b.import_type}</td>
                  <td className="px-4 py-3">
                    {getStatusBadge(b.status, b.is_dry_run)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{b.counts.total.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-gain">{b.counts.imported.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-loss">{b.counts.rejected.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-text-muted">{formatDate(b.started_at?.split('T')[0])}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-primary font-semibold group-hover:underline inline-flex items-center gap-1">
                      View Details
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
