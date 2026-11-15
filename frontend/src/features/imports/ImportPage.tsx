import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { ApiResponse, ImportBatchResult, ImportBatchDetail, PaginatedData } from '@/types/api';
import { formatDate } from '@/lib/format';
import {
  Upload,
  Download,
  ArrowLeft,
  Loader2,
  FileText,
  Filter,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const ImportPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const [activeBatchUuid, setActiveBatchUuid] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [filterCode, setFilterCode] = useState<string>('ALL');

  // Poll active batch while PROCESSING or PENDING
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
      formData.append('dry_run', dryRun.toString());
      formData.append('async', 'true');

      const res = await apiClient.post<ApiResponse<ImportBatchResult>>(
        '/admin/imports/transactions/',
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
      queryClient.invalidateQueries({ queryKey: ['importHistory'] });
    },
    onError: (err: any) => {
      const detail = err.response?.data?.data?.detail || err.response?.data?.data?.file?.[0] || 'Upload failed.';
      setUploadError(detail);
    },
  });

  const handleDownloadCsv = (batchUuid: string) => {
    window.open(`/api/v1/admin/imports/${batchUuid}/rejected-rows/?export=csv`, '_blank');
  };

  const isBatchProcessing = activeBatchDetail?.status === 'PROCESSING' || activeBatchDetail?.status === 'PENDING';
  const progressPercent = activeBatchDetail?.counts?.total
    ? Math.min(100, Math.round(((activeBatchDetail.counts.processed || 0) / activeBatchDetail.counts.total) * 100))
    : (isBatchProcessing ? 15 : 100);

  // Filter rejected rows by error code
  const rejectedRows = activeBatchDetail?.rejected_rows || [];
  const uniqueErrorCodes = Array.from(new Set(rejectedRows.map((r) => r.code)));
  const filteredRows = filterCode === 'ALL'
    ? rejectedRows
    : rejectedRows.filter((r) => r.code === filterCode);

  // =========================================================================
  // FULL PAGE VIEW: Batch Details & Rejected Rows
  // =========================================================================
  if (activeBatchUuid) {
    return (
      <div className="space-y-6">
        {/* Navigation Bar / Back button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface p-4 rounded-xl border border-border shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setActiveBatchUuid(null);
                setFilterCode('ALL');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-text-main hover:bg-slate-50 transition-colors shadow-xs"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Batches</span>
            </button>
            <div className="h-5 w-px bg-border hidden sm:block" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-text-main">
                Import Batch: {activeBatchDetail?.file_name || 'Loading...'}
              </h1>
              <p className="text-xs font-mono text-text-muted mt-0.5">
                UUID: {activeBatchUuid}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {activeBatchDetail && activeBatchDetail.counts.rejected > 0 && (
              <button
                onClick={() => handleDownloadCsv(activeBatchUuid)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-text-main hover:bg-slate-50 transition-colors shadow-xs"
              >
                <Download className="h-4 w-4" />
                <span>Export Rejected Rows CSV</span>
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
            {/* Batch Status Banner & Progress */}
            {isBatchProcessing && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-5 space-y-3">
                <div className="flex justify-between items-center text-sm font-semibold text-blue-900">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Processing file in background... ({activeBatchDetail.counts.processed || 0} / {activeBatchDetail.counts.total} rows)
                  </span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full bg-blue-200/60 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-primary h-3 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(5, progressPercent)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Counts Overview Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-xl bg-surface border border-border shadow-xs text-center">
                <div className="text-xs font-semibold text-text-muted uppercase tracking-wide">Total Rows</div>
                <div className="text-3xl font-extrabold text-text-main mt-2">{activeBatchDetail.counts.total.toLocaleString()}</div>
                <div className="text-xs text-text-muted mt-1">In uploaded CSV</div>
              </div>
              <div className="p-5 rounded-xl bg-green-50/60 border border-green-200 shadow-xs text-center text-gain">
                <div className="text-xs font-semibold uppercase tracking-wide">Imported</div>
                <div className="text-3xl font-extrabold mt-2">{activeBatchDetail.counts.imported.toLocaleString()}</div>
                <div className="text-xs text-green-700 mt-1">Successfully stored</div>
              </div>
              <div className="p-5 rounded-xl bg-amber-50/60 border border-amber-200 shadow-xs text-center text-warning">
                <div className="text-xs font-semibold uppercase tracking-wide">Skipped Duplicates</div>
                <div className="text-3xl font-extrabold mt-2">{activeBatchDetail.counts.skipped_duplicate.toLocaleString()}</div>
                <div className="text-xs text-amber-700 mt-1">Duplicate keys ignored</div>
              </div>
              <div className="p-5 rounded-xl bg-red-50/60 border border-red-200 shadow-xs text-center text-loss">
                <div className="text-xs font-semibold uppercase tracking-wide">Rejected</div>
                <div className="text-3xl font-extrabold mt-2">{activeBatchDetail.counts.rejected.toLocaleString()}</div>
                <div className="text-xs text-red-700 mt-1">Validation errors</div>
              </div>
            </div>

            {/* Batch Metadata Card */}
            <div className="rounded-xl border border-border bg-surface p-5 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-xs font-medium text-text-muted block">Import Type</span>
                <span className="font-semibold text-text-main">{activeBatchDetail.import_type}</span>
              </div>
              <div>
                <span className="text-xs font-medium text-text-muted block">Status</span>
                <span
                  className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-bold mt-0.5 ${
                    activeBatchDetail.status === 'COMPLETED'
                      ? 'bg-green-100 text-gain'
                      : activeBatchDetail.status === 'COMPLETED_WITH_ERRORS'
                      ? 'bg-amber-100 text-warning'
                      : activeBatchDetail.status === 'DRY_RUN'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-loss'
                  }`}
                >
                  {activeBatchDetail.is_dry_run ? 'DRY_RUN' : activeBatchDetail.status}
                </span>
              </div>
              <div>
                <span className="text-xs font-medium text-text-muted block">Started At</span>
                <span className="font-medium text-text-main">{formatDate(activeBatchDetail.started_at?.split('T')[0])}</span>
              </div>
              <div>
                <span className="text-xs font-medium text-text-muted block">Finished At</span>
                <span className="font-medium text-text-main">
                  {activeBatchDetail.finished_at ? formatDate(activeBatchDetail.finished_at.split('T')[0]) : 'In progress'}
                </span>
              </div>
            </div>

            {/* Warnings Breakdown */}
            {activeBatchDetail.warnings && Object.keys(activeBatchDetail.warnings).length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5 space-y-2">
                <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Warnings Breakdown (Imported with Notices)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {Object.entries(activeBatchDetail.warnings).map(([code, count]) => (
                    <div key={code} className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-amber-200 text-xs">
                      <span className="font-mono text-text-main">{code}</span>
                      <span className="font-bold text-amber-800">{count} rows</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rejected Rows Full Detail Section */}
            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border pb-4">
                <div>
                  <h2 className="text-base font-bold text-text-main">
                    Rejected Rows & Validation Failures ({filteredRows.length} shown)
                  </h2>
                  <p className="text-xs text-text-muted">
                    Exact row numbers, error codes, and failure causes from ingestion.
                  </p>
                </div>

                {/* Filter by Error Code */}
                {uniqueErrorCodes.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-text-muted" />
                    <select
                      value={filterCode}
                      onChange={(e) => setFilterCode(e.target.value)}
                      className="text-xs rounded-lg border-slate-300 py-1.5 px-3 bg-white text-text-main focus:ring-primary focus:border-primary"
                    >
                      <option value="ALL">All Errors ({rejectedRows.length})</option>
                      {uniqueErrorCodes.map((code) => (
                        <option key={code} value={code}>
                          {code} ({rejectedRows.filter((r) => r.code === code).length})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {filteredRows.length === 0 ? (
                <div className="text-center py-10 text-sm text-text-muted">
                  <CheckCircle2 className="h-8 w-8 text-gain mx-auto mb-2 opacity-80" />
                  No rejected rows found for this batch.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="min-w-full divide-y divide-border text-left text-xs">
                    <thead className="bg-slate-50 text-text-muted uppercase font-semibold">
                      <tr>
                        <th className="px-3.5 py-3 w-16">Row #</th>
                        <th className="px-3.5 py-3 w-40">Error Code</th>
                        <th className="px-3.5 py-3 w-32">Field</th>
                        <th className="px-3.5 py-3">Message</th>
                        <th className="px-3.5 py-3">Raw Row Payload</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-3.5 py-2.5 font-mono font-bold text-text-main">{row.row}</td>
                          <td className="px-3.5 py-2.5">
                            <span className="font-semibold text-loss bg-red-50 border border-red-200 px-2 py-0.5 rounded text-2xs">
                              {row.code}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-text-muted">{row.field || '—'}</td>
                          <td className="px-3.5 py-2.5 text-text-main font-medium">{row.message}</td>
                          <td className="px-3.5 py-2.5 font-mono text-text-muted max-w-md truncate">
                            {row.raw_row && Object.keys(row.raw_row).length > 0 ? (
                              <span title={JSON.stringify(row.raw_row, null, 2)}>
                                {JSON.stringify(row.raw_row)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}
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
          Upload transactions CSV, execute validation dry-runs with background processing, and review ingestion exceptions.
        </p>
      </div>

      {/* Upload Zone */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-text-main">Upload Transactions CSV</h2>

        {uploadError && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-loss border border-red-200">
            {uploadError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:opacity-90 cursor-pointer"
          />

          <label className="flex items-center space-x-2 text-sm text-text-main cursor-pointer select-none">
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
                  onClick={() => setActiveBatchUuid(b.uuid)}
                  className="cursor-pointer hover:bg-slate-50/80 transition-colors group"
                >
                  <td className="px-4 py-3 font-medium text-text-main flex items-center gap-2">
                    <FileText className="h-4 w-4 text-text-muted group-hover:text-primary transition-colors" />
                    <span>{b.file_name}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">{b.import_type}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        b.status === 'COMPLETED'
                          ? 'bg-green-100 text-gain'
                          : b.status === 'COMPLETED_WITH_ERRORS'
                          ? 'bg-amber-100 text-warning'
                          : b.status === 'PROCESSING' || b.status === 'PENDING'
                          ? 'bg-blue-100 text-blue-700 animate-pulse'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {b.status}
                    </span>
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
