import React from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  stale: boolean;
  ageDays: number;
  priceDate: string;
  snapshotDate: string;
}

export const DataFreshnessBanner: React.FC<Props> = ({
  stale,
  ageDays,
  priceDate,
  snapshotDate,
}) => {
  return (
    <div
      className={`rounded-lg p-3 text-sm flex items-center justify-between border ${
        stale
          ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-slate-50 border-border text-text-muted'
      }`}
    >
      <div className="flex items-center space-x-2">
        {stale && <AlertCircle className="h-4 w-4 text-warning" />}
        <span>
          Prices as of <strong className="font-semibold">{priceDate}</strong> · Holdings snapshot{' '}
          <strong className="font-semibold">{snapshotDate}</strong>
        </span>
      </div>

      {stale && (
        <span className="inline-flex items-center rounded-full bg-warning/20 px-2.5 py-0.5 text-xs font-medium text-warning">
          {ageDays} days old
        </span>
      )}
    </div>
  );
};
