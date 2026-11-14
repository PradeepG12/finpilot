import React from 'react';
import { PortfolioResponse } from '@/types/api';
import { formatINR, formatPercent } from '@/lib/format';

interface Props {
  portfolio: PortfolioResponse | undefined;
}

export const CustomerPortfolioTab: React.FC<Props> = ({ portfolio }) => {
  if (!portfolio) return null;

  return (
    <div className="space-y-8">
      {portfolio.accounts.map((account) => (
        <div key={account.account_code} className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 border-b border-border flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-text-main text-base">{account.account_code}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-medium">
                  {account.account_type}
                </span>
                <span className="text-xs text-text-muted">· {account.provider || 'Direct'}</span>
              </div>
              <div className="text-xs text-text-muted mt-1">
                Opened: {account.opened_at || '—'} · Status: {account.status}
              </div>
            </div>

            <div className="text-left sm:text-right">
              <div className="text-sm font-bold text-text-main tabular-nums">
                {formatINR(account.totals.market_value)}
              </div>
              <div className="text-xs text-text-muted">
                Unrealised P/L:{' '}
                <span
                  className={`font-semibold tabular-nums ${
                    parseFloat(account.totals.unrealised_pl) >= 0 ? 'text-gain' : 'text-loss'
                  }`}
                >
                  {parseFloat(account.totals.unrealised_pl) >= 0 ? '▲ +' : '▼ '}
                  {formatINR(account.totals.unrealised_pl)} ({formatPercent(account.totals.unrealised_pl_pct)})
                </span>
              </div>
            </div>
          </div>

          {account.positions.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-muted">
              No holdings in this account.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-left text-sm">
                <thead className="bg-slate-50/50 text-text-muted text-xs font-semibold uppercase">
                  <tr>
                    <th className="px-4 py-3">Symbol / Name</th>
                    <th className="px-4 py-3">Asset Class</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Avg Cost</th>
                    <th className="px-4 py-3 text-right">Last Price</th>
                    <th className="px-4 py-3 text-right">Market Value</th>
                    <th className="px-4 py-3 text-right">Unrealised P/L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {account.positions.map((pos) => {
                    const uplNum = parseFloat(pos.unrealised_pl);
                    const isGain = uplNum >= 0;
                    return (
                      <tr key={pos.instrument_code} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-text-main">{pos.symbol}</div>
                          <div className="text-xs text-text-muted">{pos.name}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-muted">{pos.asset_class}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{parseFloat(pos.quantity).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatINR(pos.avg_cost)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatINR(pos.last_price)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-text-main tabular-nums">
                          {formatINR(pos.market_value)}
                        </td>
                        <td className={`px-4 py-3 text-right tabular-nums font-medium ${isGain ? 'text-gain' : 'text-loss'}`}>
                          <div>{isGain ? '▲ +' : '▼ '}{formatINR(pos.unrealised_pl)}</div>
                          <div className="text-xs">{formatPercent(pos.unrealised_pl_pct)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
