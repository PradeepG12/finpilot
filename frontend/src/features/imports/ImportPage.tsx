import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { ApiResponse, ImportBatchResult, ImportBatchDetail, PaginatedData } from '@/types/api';
import { formatDate } from '@/lib/format';
import { Upload, Download, X, Loader2, ArrowRight } from 'lucide-react';

export const ImportPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const [activeBatchUuid, setActiveBatchUuid] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Poll active batch while PROCESSING or PENDING
  const { data: activeBatchDetail } = useQuery({
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
        return 1000; // Poll every second until completed or failed
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
    refetchInterval: activeBatchUuid && (activeBatchDetail?.status === 'PROCESSING' || activeBatchDetail?.status === 'PENDING') ? 2000 : false,
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

      {/* Inline Detail View Card */}
      {activeBatchDetail && (
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-6 animate-in fade-in duration-200 relative">
          {/* Header with Title and Close 'X' Button */}
          <div className="flex justify-between items-start border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-text-main">
                  Import Batch Summary ({activeBatchDetail.is_dry_run ? 'DRY_RUN' : activeBatchDetail.status})
                </h2>
                {isBatchProcessing && (
                  <span className="flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing {progressPercent}%
                  </span>
                )}
              </div>
              <div className="text-xs font-mono text-text-muted mt-1">
                UUID: {activeBatchDetail.uuid} | File: <span className="font-medium text-text-main">{activeBatchDetail.file_name}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {activeBatchDetail.counts.rejected > 0 && (
                <button
                  onClick={() => handleDownloadCsv(activeBatchDetail.uuid)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Export Rejected Rows CSV</span>
                </button>
              )}
              {/* Cross mark to close inline detail view */}
              <button
                onClick={() => setActiveBatchUuid(null)}
                aria-label="Close details"
                className="p-1.5 rounded-md text-text-muted hover:text-text-main hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Progress Bar (Visible while Processing) */}
          {isBatchProcessing && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-text-muted">
                <span>Row ingestion progress ({activeBatchDetail.counts.processed || 0} / {activeBatchDetail.counts.total || 0} rows)</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(5, progressPercent)}%` }}
                />
              </div>
            </div>
          )}

          {/* Counts Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-border text-center">
              <div className="text-xs font-medium text-text-muted">Total Rows</div>
              <div className="text-2xl font-bold text-text-main mt-1">{activeBatchDetail.counts.total}</div>
            </div>
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-center text-gain">
              <div className="text-xs font-medium">Imported</div>
              <div className="text-2xl font-bold mt-1">{activeBatchDetail.counts.imported}</div>
            </div>
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-center text-warning">
              <div className="text-xs font-medium">Skipped Duplicates</div>
              <div className="text-2xl font-bold mt-1">{activeBatchDetail.counts.skipped_duplicate}</div>
            </div>
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-center text-loss">
              <div className="text-xs font-medium">Rejected</div>
              <div className="text-2xl font-bold mt-1">{activeBatchDetail.counts.rejected}</div>
            </div>
          </div>

          {/* Rejected Rows Table */}
          {activeBatchDetail.rejected_rows && activeBatchDetail.rejected_rows.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-text-main text-sm">Rejected Rows Detail</h3>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full divide-y divide-border text-left text-xs">
                  <thead className="bg-slate-50 text-text-muted uppercase font-semibold">
                    <tr>
                      <th className="px-3 py-2">Row #</th>
                      <th className="px-3 py-2">Error Code</th>
                      <th className="px-3 py-2">Field</th>
                      <th className="px-3 py-2">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {activeBatchDetail.rejected_rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-mono font-medium">{row.row}</td>
                        <td className="px-3 py-2 font-semibold text-loss">{row.code}</td>
                        <td className="px-3 py-2 font-mono">{row.field || '—'}</td>
                        <td className="px-3 py-2 text-text-muted">{row.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Historical Batches Table */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-bold text-text-main">Historical Import Batches</h2>
          <span className="text-xs text-text-muted">Click any batch to view its inline details</span>
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
              {history?.results.map((b: ImportBatchDetail) => {
                const isSelected = activeBatchUuid === b.uuid;
                return (
                  <tr
                    key={b.id}
                    onClick={() => setActiveBatchUuid(b.uuid)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-text-main flex items-center gap-2">
                      <span>{b.file_name}</span>
                      {isSelected && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </td>
                    <td className="px-4 py-3 text-xs">{b.import_type}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-medium ${
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
                    <td className="px-4 py-3 text-right tabular-nums">{b.counts.total}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-gain">{b.counts.imported}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-loss">{b.counts.rejected}</td>
                    <td className="px-4 py-3 text-xs text-text-muted">{formatDate(b.started_at?.split('T')[0])}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveBatchUuid(b.uuid);
                        }}
                        className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
                      >
                        View <ArrowRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
