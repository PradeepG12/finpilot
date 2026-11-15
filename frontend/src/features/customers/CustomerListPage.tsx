import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '@/lib/api';
import { ApiResponse, Customer, PaginatedData } from '@/types/api';
import { Search } from 'lucide-react';

export const CustomerListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const search = searchParams.get('search') || '';
  const kyc = searchParams.get('kyc_status') || '';
  const segment = searchParams.get('segment') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const [searchTerm, setSearchTerm] = useState(search);

  // Sync state if URL search param changes
  React.useEffect(() => {
    setSearchTerm(search);
  }, [search]);

  // Debounced search on every keystroke
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const currentParam = searchParams.get('search') || '';
      if (searchTerm !== currentParam) {
        const newParams = new URLSearchParams(searchParams);
        if (searchTerm) {
          newParams.set('search', searchTerm);
        } else {
          newParams.delete('search');
        }
        newParams.set('page', '1');
        setSearchParams(newParams);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, searchParams, setSearchParams]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['customers', { search, kyc, segment, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (kyc) params.append('kyc_status', kyc);
      if (segment) params.append('segment', segment);
      params.append('page', page.toString());

      const res = await apiClient.get<ApiResponse<PaginatedData<Customer>>>(
        `/customers/?${params.toString()}`
      );
      return res.data.data;
    },
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (searchTerm) {
      newParams.set('search', searchTerm);
    } else {
      newParams.delete('search');
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-main">Customers</h1>
        <p className="text-sm text-text-muted">
          Browse, search, and monitor wealth accounts across all active segments.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between bg-surface p-4 rounded-xl border border-border shadow-sm">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search by code, name, email, city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-transparent text-text-main"
          />
        </form>

        <div className="flex gap-2">
          <select
            value={kyc}
            onChange={(e) => {
              const newParams = new URLSearchParams(searchParams);
              if (e.target.value) newParams.set('kyc_status', e.target.value);
              else newParams.delete('kyc_status');
              newParams.set('page', '1');
              setSearchParams(newParams);
            }}
            className="text-sm rounded-lg border border-slate-300 px-3 py-2 bg-transparent text-text-main"
          >
            <option value="">All KYC</option>
            <option value="VERIFIED">Verified</option>
            <option value="PENDING">Pending</option>
            <option value="REVIEW">Review</option>
          </select>

          <select
            value={segment}
            onChange={(e) => {
              const newParams = new URLSearchParams(searchParams);
              if (e.target.value) newParams.set('segment', e.target.value);
              else newParams.delete('segment');
              newParams.set('page', '1');
              setSearchParams(newParams);
            }}
            className="text-sm rounded-lg border border-slate-300 px-3 py-2 bg-transparent text-text-main"
          >
            <option value="">All Segments</option>
            <option value="MASS">Mass</option>
            <option value="AFFLUENT">Affluent</option>
            <option value="HNI">HNI</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <table className="min-w-full divide-y divide-border text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-text-muted font-medium">
            <tr>
              <th className="px-4 py-3.5">Code</th>
              <th className="px-4 py-3.5">Full Name</th>
              <th className="px-4 py-3.5">City / State</th>
              <th className="px-4 py-3.5">Segment</th>
              <th className="px-4 py-3.5">KYC Status</th>
              <th className="px-4 py-3.5">Risk Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  Loading customers...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-loss">
                  Failed to load customers.
                </td>
              </tr>
            ) : data?.results.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                  No customers found matching the criteria.
                </td>
              </tr>
            ) : (
              data?.results.map((cust) => (
                <tr
                  key={cust.id}
                  onClick={() => navigate(`/customers/${cust.customer_code}`)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3.5 font-semibold text-primary">{cust.customer_code}</td>
                  <td className="px-4 py-3.5 text-text-main font-medium">{cust.full_name}</td>
                  <td className="px-4 py-3.5 text-text-muted">
                    {cust.city || '—'}{cust.state ? `, ${cust.state}` : ''}
                  </td>
                  <td className="px-4 py-3.5 text-text-main capitalize">
                    {cust.segment.toLowerCase()}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                        cust.kyc_status === 'VERIFIED'
                          ? 'bg-green-50 text-green-700 ring-green-600/20'
                          : cust.kyc_status === 'PENDING'
                          ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
                          : 'bg-red-50 text-red-700 ring-red-600/20'
                      }`}
                    >
                      {cust.kyc_status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-text-muted">
                    {cust.risk_level || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
