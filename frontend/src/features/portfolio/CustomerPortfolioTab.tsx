import React, { useState, useMemo, useEffect } from 'react';
import { PortfolioResponse } from '@/types/api';
import { formatINR, formatPercent } from '@/lib/format';
import { ExportModal } from '@/features/exports/ExportModal';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  ArrowRight,
  Download,
  Layers,
  Filter,
} from 'lucide-react';

interface Props {
  portfolio: PortfolioResponse | undefined;
  onViewTransactions?: (accountCode: string) => void;
  targetAccount?: string;
  selectedAccount?: string;
  onSelectAccount?: (accountCode: string) => void;
  customerCode?: string;
}

export const CustomerPortfolioTab: React.FC<Props> = ({
  portfolio,
  onViewTransactions,
  targetAccount,
  selectedAccount: propSelectedAccount,
  onSelectAccount,
  customerCode,
}) => {
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const activeAccountCode = propSelectedAccount || targetAccount || '';

  const accounts = useMemo(() => portfolio?.accounts || [], [portfolio?.accounts]);

  useEffect(() => {
    if (activeAccountCode) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`account-card-${activeAccountCode}`);
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          el.classList.add('ring-2', 'ring-primary', 'shadow-md');
          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-primary', 'shadow-md');
          }, 2500);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeAccountCode]);

  // Constrain accounts if filtered to a specific account
  const displayedAccounts = useMemo(() => {
    if (activeAccountCode) {
      const matching = accounts.filter(
        (a) => a.account_code.toLowerCase() === activeAccountCode.toLowerCase()
      );
      return matching.length > 0 ? matching : accounts;
    }
    return accounts;
  }, [accounts, activeAccountCode]);

  const activeAccountInfo = useMemo(() => {
    if (!activeAccountCode) return null;
    return accounts.find(
      (a) => a.account_code.toLowerCase() === activeAccountCode.toLowerCase()
    );
  }, [accounts, activeAccountCode]);

  if (!portfolio) {
    return (
      <div className="flex items-center justify-center p-12 text-text-muted">
        <span>Loading portfolio data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls: Filter Banner & Export Portfolio Action */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {activeAccountCode && activeAccountInfo ? (
          <div className="flex-1 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-900 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <Filter className="h-4 w-4 text-primary shrink-0" />
              <div className="text-xs">
                <span>Viewing filtered account: </span>
                <span className="font-bold font-mono text-sm text-primary">
                  {activeAccountInfo.account_code}
                </span>
                <span className="text-blue-700 ml-1.5 font-medium">
                  ({activeAccountInfo.account_type.replace('_', ' ')} · {activeAccountInfo.provider || 'Direct'})
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectAccount && onSelectAccount('')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-300 bg-white hover:bg-blue-100/50 text-xs font-semibold text-primary transition-colors shadow-2xs cursor-pointer"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>All Accounts</span>
            </button>
          </div>
        ) : (
          <div className="text-xs text-text-muted">
            Showing all {portfolio.accounts.length} linked investment account(s).
          </div>
        )}

        <div className="flex items-center gap-2 justify-end shrink-0">
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-text-main transition-colors shadow-2xs"
          >
            <Download className="h-4 w-4 text-primary" />
            <span>Export portfolio</span>
          </button>
        </div>
      </div>

      {/* Account Cards */}
      <div className="space-y-8">
        {displayedAccounts.map((account) => (
          <AccountPositionsCard
            key={account.account_code}
            account={account}
            onViewTransactions={onViewTransactions}
          />
        ))}
      </div>

      {/* Shared Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        initialFilters={{
          exportType: 'portfolio_positions',
          customerCodes: customerCode ? [customerCode] : [],
          accountCodes: activeAccountCode ? [activeAccountCode] : [],
        }}
      />
    </div>
  );
};

interface AccountPositionsCardProps {
  account: PortfolioResponse['accounts'][0];
  onViewTransactions?: (accountCode: string) => void;
}

const AccountPositionsCard: React.FC<AccountPositionsCardProps> = ({ account, onViewTransactions }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [assetClassFilter, setAssetClassFilter] = useState('');
  const [ordering, setOrdering] = useState<string>('');


  // Available unique asset classes for this account
  const availableAssetClasses = useMemo(() => {
    const set = new Set<string>();
    account.positions.forEach((p) => {
      if (p.asset_class) set.add(p.asset_class);
    });
    return Array.from(set).sort();
  }, [account.positions]);

  const handleSort = (field: string) => {
    if (ordering === field) {
      setOrdering(`-${field}`);
    } else if (ordering === `-${field}`) {
      setOrdering('');
    } else {
      setOrdering(field);
    }
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

  // Filter and sort positions
  const filteredAndSortedPositions = useMemo(() => {
    let list = [...account.positions];

    // Search by symbol or name
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.symbol.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q)
      );
    }

    // Filter by asset class
    if (assetClassFilter) {
      list = list.filter((p) => p.asset_class === assetClassFilter);
    }

    // Sorting
    if (ordering) {
      const isDesc = ordering.startsWith('-');
      const field = isDesc ? ordering.substring(1) : ordering;

      list.sort((a, b) => {
        let valA: any = (a as any)[field];
        let valB: any = (b as any)[field];

        // Numeric fields
        if (['quantity', 'avg_cost', 'last_price', 'market_value', 'unrealised_pl', 'unrealised_pl_pct'].includes(field)) {
          valA = parseFloat(valA) || 0;
          valB = parseFloat(valB) || 0;
          return isDesc ? valB - valA : valA - valB;
        }

        // String fields
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
        if (valA < valB) return isDesc ? 1 : -1;
        if (valA > valB) return isDesc ? -1 : 1;
        return 0;
      });
    }

    return list;
  }, [account.positions, searchTerm, assetClassFilter, ordering]);

  const hasActiveFilters = Boolean(searchTerm.trim() || assetClassFilter);

  const clearFilters = () => {
    setSearchTerm('');
    setAssetClassFilter('');
    setOrdering('');
  };

  return (
    <div
      id={`account-card-${account.account_code}`}
      className="rounded-xl border border-border bg-surface shadow-xs overflow-hidden transition-all"
    >
      {/* Account Header */}
      <div className="bg-slate-50/70 p-4 border-b border-border flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-text-main text-base">{account.account_code}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
              {account.account_type}
            </span>
            <span className="text-xs text-text-muted">· {account.provider || 'Direct'}</span>
          </div>
          <div className="text-xs text-text-muted mt-1">
            Opened: {account.opened_at || '—'} · Status: <span className="font-semibold text-text-main">{account.status}</span>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:gap-4">
          {/* CTA: View Transactions on the left of P/L */}
          {onViewTransactions && (
            <button
              type="button"
              onClick={() => onViewTransactions(account.account_code)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 text-primary bg-primary/5 hover:bg-primary hover:text-white transition-colors text-xs font-semibold shadow-2xs self-start sm:self-center"
            >
              <span>View Transactions</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}

          <div className="text-left sm:text-right">
            <div className="text-base font-bold text-text-main tabular-nums">
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
      </div>

      {/* Account Level Search & Filter Bar */}
      <div className="p-3 bg-surface border-b border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Search holdings by symbol or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-primary bg-white text-text-main placeholder:text-text-muted"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-2 text-text-muted hover:text-text-main"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 justify-end">
          {/* Single Asset Class Dropdown Filter (No filter icon) */}
          <select
            value={assetClassFilter}
            onChange={(e) => setAssetClassFilter(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 px-3 py-1.5 bg-white text-text-main focus:outline-none focus:ring-1 focus:ring-primary shadow-xs font-medium"
            title="Filter by Asset Class"
          >
            <option value="">All Asset Classes</option>
            {availableAssetClasses.map((ac) => (
              <option key={ac} value={ac}>
                {ac}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-2xs font-medium text-text-muted hover:text-loss transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {filteredAndSortedPositions.length === 0 ? (
        <div className="p-8 text-center text-sm text-text-muted">
          {account.positions.length === 0
            ? 'No holdings in this account.'
            : 'No holdings match your search or filter.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-left text-sm">
            <thead className="bg-slate-50/60 text-text-muted text-xs font-semibold uppercase">
              <tr>
                <th
                  onClick={() => handleSort('symbol')}
                  className="px-4 py-3 cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                  title="Sort by Symbol"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={ordering.includes('symbol') ? 'text-text-main font-bold' : ''}>
                      Symbol / Name
                    </span>
                    {renderSortIcon('symbol')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('asset_class')}
                  className="px-4 py-3 cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                  title="Sort by Asset Class"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={ordering.includes('asset_class') ? 'text-text-main font-bold' : ''}>
                      Asset Class
                    </span>
                    {renderSortIcon('asset_class')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('quantity')}
                  className="px-4 py-3 text-right cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                  title="Sort by Quantity"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span className={ordering.includes('quantity') ? 'text-text-main font-bold' : ''}>
                      Qty
                    </span>
                    {renderSortIcon('quantity')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('avg_cost')}
                  className="px-4 py-3 text-right cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                  title="Sort by Avg Cost"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span className={ordering.includes('avg_cost') ? 'text-text-main font-bold' : ''}>
                      Avg Cost
                    </span>
                    {renderSortIcon('avg_cost')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('last_price')}
                  className="px-4 py-3 text-right cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                  title="Sort by Last Price"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span className={ordering.includes('last_price') ? 'text-text-main font-bold' : ''}>
                      Last Price
                    </span>
                    {renderSortIcon('last_price')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('market_value')}
                  className="px-4 py-3 text-right cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                  title="Sort by Market Value"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span className={ordering.includes('market_value') ? 'text-text-main font-bold' : ''}>
                      Market Value
                    </span>
                    {renderSortIcon('market_value')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('unrealised_pl')}
                  className="px-4 py-3 text-right cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                  title="Sort by Unrealised P/L"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span className={ordering.includes('unrealised_pl') ? 'text-text-main font-bold' : ''}>
                      Unrealised P/L
                    </span>
                    {renderSortIcon('unrealised_pl')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredAndSortedPositions.map((pos) => {
                const uplNum = parseFloat(pos.unrealised_pl);
                const isGain = uplNum >= 0;
                return (
                  <tr key={pos.instrument_code} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-text-main">{pos.symbol}</div>
                      <div className="text-xs text-text-muted truncate max-w-xs">{pos.name}</div>
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
  );
};
