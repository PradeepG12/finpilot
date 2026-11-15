import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { downloadFile } from '@/lib/download';
import { ExportModal } from '@/features/exports/ExportModal';
import {
  ExportInitialFilters,
  ExportReportItem,
  ExportType,
} from '@/types/api';
import {
  FileSpreadsheet,
  Download,
  TrendingUp,
  Target,
  Users,
  CreditCard,
  ShieldCheck,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';

type TypeFilterTab = 'ALL' | 'TRANSACTIONS' | 'PORTFOLIO_POSITIONS' | 'CUSTOMERS' | 'ACCOUNTS' | 'GOALS';

export const ExportCenterPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFilters, setModalFilters] = useState<ExportInitialFilters | undefined>(undefined);
  const [selectedTypeTab, setSelectedTypeTab] = useState<TypeFilterTab>('ALL');
  const [page, setPage] = useState(1);
  const [downloadingUuid, setDownloadingUuid] = useState<string | null>(null);

  // Fetch paginated export reports list with resilient response handling
  const {
    data: reportsData,
    isLoading: isLoadingReports,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['export-reports', page, selectedTypeTab],
    queryFn: async () => {
      const url =
        selectedTypeTab === 'ALL'
          ? `/exports/?page=${page}`
          : `/exports/?page=${page}&export_type=${selectedTypeTab}`;
      const res = await apiClient.get<any>(url);
      const raw = res.data;

      // Handle ApiResponse envelope: { status: 'success', data: { count, results } }
      if (raw?.data && Array.isArray(raw.data.results)) {
        return raw.data;
      }
      // Handle raw DRF paginated response: { count, results }
      if (raw?.results && Array.isArray(raw.results)) {
        return raw;
      }
      return { results: [], count: 0 };
    },
    // Auto-poll every 2.5s if any report is actively processing or pending
    refetchInterval: (query) => {
      const results = query.state.data?.results || [];
      const hasActive = results.some((r: ExportReportItem) => r.status === 'PENDING' || r.status === 'PROCESSING');
      return hasActive ? 2500 : false;
    },
  });

  const reports: ExportReportItem[] = reportsData?.results || [];
  const totalCount = reportsData?.count || 0;
  const totalPages = Math.ceil(totalCount / 24) || 1;

  const handleOpenExport = (type?: ExportType) => {
    setModalFilters(type ? { exportType: type } : undefined);
    setIsModalOpen(true);
  };

  const handleDownloadReport = async (report: ExportReportItem) => {
    if (!report.can_download || downloadingUuid) return;

    setDownloadingUuid(report.uuid);
    try {
      await downloadFile(`/exports/${report.uuid}/download/`, report.file_name);
      await refetch();
    } catch (err) {
      console.error('Download failed', err);
    } finally {
      setDownloadingUuid(null);
    }
  };

  // Helper to format filters summary
  const renderFilterSummary = (report: ExportReportItem) => {
    const f = report.filters || {};
    const parts: string[] = [];

    if (f.customer_codes && f.customer_codes.length > 0) {
      parts.push(`${f.customer_codes.length} customer${f.customer_codes.length > 1 ? 's' : ''}`);
    }
    if (f.account_codes && f.account_codes.length > 0) {
      parts.push(`${f.account_codes.length} account${f.account_codes.length > 1 ? 's' : ''}`);
    }
    if (f.date_from || f.date_to) {
      parts.push(`${f.date_from || 'Any'} → ${f.date_to || 'Any'}`);
    }
    if (f.transaction_type && f.transaction_type.length > 0) {
      parts.push(`Type: ${f.transaction_type.join(', ')}`);
    }
    if (f.kyc_status && f.kyc_status.length > 0) {
      parts.push(`KYC: ${f.kyc_status.join(', ')}`);
    }
    if (f.segment && f.segment.length > 0) {
      parts.push(`Segment: ${f.segment.join(', ')}`);
    }
    if (f.account_type && f.account_type.length > 0) {
      parts.push(`Type: ${f.account_type.join(', ')}`);
    }
    if (f.provider) {
      parts.push(`Provider: ${f.provider}`);
    }
    if (f.asset_class && f.asset_class.length > 0) {
      parts.push(`Asset: ${f.asset_class.join(', ')}`);
    }
    if (f.priority && f.priority.length > 0) {
      parts.push(`Priority: ${f.priority.join(', ')}`);
    }

    if (parts.length === 0) {
      return <span className="text-text-muted italic">All records (unfiltered)</span>;
    }
    return <span>{parts.join(' · ')}</span>;
  };

  // Icon for export type
  const renderTypeIcon = (type: string) => {
    switch (type) {
      case 'TRANSACTIONS':
        return <FileSpreadsheet className="h-4 w-4 text-blue-600 shrink-0" />;
      case 'PORTFOLIO_POSITIONS':
        return <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0" />;
      case 'CUSTOMERS':
        return <Users className="h-4 w-4 text-indigo-600 shrink-0" />;
      case 'ACCOUNTS':
        return <CreditCard className="h-4 w-4 text-amber-600 shrink-0" />;
      case 'GOALS':
        return <Target className="h-4 w-4 text-purple-600 shrink-0" />;
      default:
        return <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />;
    }
  };

  // Helper for status badge
  const renderStatusBadge = (report: ExportReportItem) => {
    if (report.is_downloaded) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-3xs font-semibold bg-slate-100 dark:bg-slate-800 text-text-muted">
          <CheckCircle className="h-3 w-3 text-slate-500" />
          <span>Downloaded</span>
        </span>
      );
    }

    switch (report.status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-3xs font-semibold bg-green-50 text-gain border border-green-200">
            <span className="h-1.5 w-1.5 rounded-full bg-gain" />
            <span>Ready for Download</span>
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-3xs font-semibold bg-blue-50 text-primary border border-blue-200">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span>Generating...</span>
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-3xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Queued</span>
          </span>
        );
      case 'FAILED':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-3xs font-semibold bg-red-50 text-loss border border-red-200"
            title={report.error_message || 'Generation failed'}
          >
            <AlertTriangle className="h-3 w-3 text-loss" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-3xs font-semibold bg-slate-100 text-text-muted">
            {report.status}
          </span>
        );
    }
  };

  const tabs: { key: TypeFilterTab; label: string }[] = [
    { key: 'ALL', label: 'All Exports' },
    { key: 'TRANSACTIONS', label: 'Transactions' },
    { key: 'PORTFOLIO_POSITIONS', label: 'Portfolio' },
    { key: 'CUSTOMERS', label: 'Customers' },
    { key: 'ACCOUNTS', label: 'Accounts' },
    { key: 'GOALS', label: 'Goals' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-main">Exports</h1>
          <p className="text-sm text-text-muted mt-1">
            Download filtered portfolio and transaction data.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleOpenExport()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark shadow-sm transition-colors focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            <span>Create export</span>
          </button>
        </div>
      </div>

      {/* Reports List Section (Hero / Front & Center) */}
      <div className="space-y-4">
        {/* Controls Toolbar: Title, Filter Pills & Refresh */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-text-main">Generated Reports</h2>
            <p className="text-3xs text-text-muted">
              History of export tasks, processing status, and available downloads.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Tab Filter Pills */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-border/60">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setSelectedTypeTab(tab.key);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    selectedTypeTab === tab.key
                      ? 'bg-surface text-text-main shadow-xs'
                      : 'text-text-muted hover:text-text-main hover:bg-surface/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Refresh Action */}
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-text-muted hover:text-text-main hover:bg-slate-50 transition-colors disabled:opacity-50"
              title="Refresh reports list"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-slate-50/75 dark:bg-slate-800/50 text-text-muted uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Export Type</th>
                  <th className="py-3 px-4">Scope & Filters</th>
                  <th className="py-3 px-4">Rows</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoadingReports && reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-text-muted">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span>Loading export reports...</span>
                      </div>
                    </td>
                  </tr>
                ) : reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-text-muted">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileSpreadsheet className="h-8 w-8 text-text-muted/50" />
                        <span className="font-semibold text-text-main">No exports requested yet</span>
                        <span className="text-3xs">
                          Click "Create export" above to generate your first downloadable report.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr
                      key={report.uuid}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-semibold text-text-main whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {renderTypeIcon(report.export_type)}
                          <span>{report.export_type.replace('_', ' ')}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-text-muted max-w-xs truncate">
                        {renderFilterSummary(report)}
                      </td>
                      <td className="py-3.5 px-4 text-text-main whitespace-nowrap font-medium">
                        {report.status === 'COMPLETED' ? report.row_count.toLocaleString() : '—'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderStatusBadge(report)}
                      </td>
                      <td className="py-3.5 px-4 text-text-muted whitespace-nowrap">
                        {new Date(report.created).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {report.can_download ? (
                          <button
                            type="button"
                            onClick={() => handleDownloadReport(report)}
                            disabled={downloadingUuid === report.uuid}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-dark shadow-xs transition-colors disabled:opacity-50"
                          >
                            {downloadingUuid === report.uuid ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Downloading...</span>
                              </>
                            ) : (
                              <>
                                <Download className="h-3 w-3" />
                                <span>Download</span>
                              </>
                            )}
                          </button>
                        ) : report.is_downloaded ? (
                          <span className="text-3xs text-text-muted italic">File cleaned</span>
                        ) : report.status === 'FAILED' ? (
                          <span className="text-3xs text-loss font-medium" title={report.error_message || ''}>
                            Check error
                          </span>
                        ) : (
                          <span className="text-3xs text-primary font-medium flex items-center justify-end gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Processing...</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-border p-3.5 flex items-center justify-between text-xs text-text-muted bg-surface">
              <span>
                Page {page} of {totalPages} ({totalCount} reports total)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1 rounded-lg border border-border text-text-muted hover:text-text-main disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1 rounded-lg border border-border text-text-muted hover:text-text-main disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Information & Compliance Banner */}
      <div className="rounded-2xl border border-border bg-slate-50 dark:bg-slate-800/40 p-4 shadow-2xs space-y-2">
        <div className="flex items-center gap-2 text-text-main font-semibold text-xs">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span>Security & Data Compliance</span>
        </div>
        <p className="text-3xs text-text-muted leading-relaxed">
          All exports are processed asynchronously via Celery workers with strict server-side access control. Generated CSV files are held temporarily on disk until download, then automatically deleted immediately. Model metadata retains the audit record without storing customer file contents.
        </p>
      </div>

      {/* Shared Export Modal */}
      <ExportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialFilters={modalFilters}
        onExportSuccess={() => refetch()}
      />
    </div>
  );
};
