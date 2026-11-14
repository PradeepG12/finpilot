import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { ApiResponse, PaginatedData, TransactionItem } from '@/types/api';
import { formatINR, formatDate } from '@/lib/format';

interface Props {
  customerCode: string;
}

export const CustomerTransactionsTab: React.FC<Props> = ({ customerCode }) => {
  const [type, setType] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', customerCode, { type, status, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (type) params.append('transaction_type', type);
      if (status) params.append('status', status);
      params.append('page', page.toString());

      const res = await apiClient.get<ApiResponse<PaginatedData<TransactionItem>>>(
        `/customers/${customerCode}/transactions/?${params.toString()}`
      );
      return res.data.data;
    },
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-surface p-4 rounded-xl border border-border shadow-sm">
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          className="text-sm rounded-lg border border-slate-300 px-3 py-1.5 bg-transparent text-text-main"
        >
          <option value="">All Types</option>
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
          <option value="DIVIDEND">DIVIDEND</option>
          <option value="FEE">FEE</option>
        </select>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="text-sm rounded-lg border border-slate-300 px-3 py-1.5 bg-transparent text-text-main"
        >
          <option value="">All Statuses</option>
          <option value="SETTLED">Settled</option>
          <option value="PENDING">Pending</option>
          <option value="REVERSED">Reversed</option>
        </select>
      </div>

      {/* Transactions Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <table className="min-w-full divide-y divide-border text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-text-muted text-xs font-semibold uppercase">
            <tr>
              <th className="px-4 py-3">Code / Date</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Instrument</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
                  Loading ledger transactions...
                </td>
              </tr>
            ) : data?.results.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
                  No transactions match the selected filters.
                </td>
              </tr>
            ) : (
              data?.results.map((txn) => {
                const isReversed = txn.status === 'REVERSED';
                const isPending = txn.status === 'PENDING';
                return (
                  <tr key={txn.id} className={isReversed ? 'opacity-60 bg-slate-50/50' : 'hover:bg-slate-50/50'}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-text-main">{txn.transaction_code}</div>
                      <div className="text-xs text-text-muted">{formatDate(txn.trade_date)}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{txn.account_code}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-text-main">{txn.instrument_symbol}</div>
                      <div className="text-xs text-text-muted truncate max-w-xs">{txn.instrument_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                        {txn.transaction_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {parseFloat(txn.quantity) > 0 ? parseFloat(txn.quantity).toFixed(2) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {parseFloat(txn.price) > 0 ? formatINR(txn.price) : '—'}
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${isReversed ? 'line-through text-text-muted' : 'text-text-main'}`}>
                      {formatINR(txn.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                          txn.status === 'SETTLED'
                            ? 'bg-green-50 text-gain ring-green-600/20'
                            : isPending
                            ? 'bg-amber-50 text-warning ring-amber-600/20'
                            : 'bg-slate-100 text-slate-600 ring-slate-500/20'
                        }`}
                      >
                        {txn.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
