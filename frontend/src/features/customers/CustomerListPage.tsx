import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '@/lib/api';
import { ApiResponse, Customer, CustomerLocations, PaginatedData } from '@/types/api';
import { formatPercent } from '@/lib/format';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  ChevronDown,
  Check,
} from 'lucide-react';

interface DropdownItem {
  id: string;
  label: string;
  sublabel?: string;
  state?: string;
}

const DEFAULT_STATES = [
  { code: 'DL', name: 'Delhi (DL)' },
  { code: 'GJ', name: 'Gujarat (GJ)' },
  { code: 'KA', name: 'Karnataka (KA)' },
  { code: 'KL', name: 'Kerala (KL)' },
  { code: 'MH', name: 'Maharashtra (MH)' },
  { code: 'RJ', name: 'Rajasthan (RJ)' },
  { code: 'TN', name: 'Tamil Nadu (TN)' },
  { code: 'TS', name: 'Telangana (TS)' },
  { code: 'WB', name: 'West Bengal (WB)' },
];

const DEFAULT_CITIES = [
  { name: 'Ahmedabad', state: 'GJ' },
  { name: 'Bengaluru', state: 'KA' },
  { name: 'Chennai', state: 'TN' },
  { name: 'Delhi', state: 'DL' },
  { name: 'Hyderabad', state: 'TS' },
  { name: 'Jaipur', state: 'RJ' },
  { name: 'Kochi', state: 'KL' },
  { name: 'Kolkata', state: 'WB' },
  { name: 'Mumbai', state: 'MH' },
  { name: 'Pune', state: 'MH' },
];

interface SearchableDropdownProps {
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  items: DropdownItem[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  helperText?: string;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  label,
  placeholder,
  searchPlaceholder,
  items,
  selectedValues,
  onChange,
  helperText,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Reset pagination when search query or items change
  useEffect(() => {
    setVisibleCount(20);
  }, [searchQuery, items]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.sublabel && item.sublabel.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 30) {
      setVisibleCount((prev) => Math.min(prev + 20, filteredItems.length));
    }
  };

  const toggleItem = (id: string) => {
    if (selectedValues.includes(id)) {
      onChange(selectedValues.filter((v) => v !== id));
    } else {
      onChange([...selectedValues, id]);
    }
  };

  const handleSelectAll = () => {
    const allFilteredIds = filteredItems.map((item) => item.id);
    const combined = Array.from(new Set([...selectedValues, ...allFilteredIds]));
    onChange(combined);
  };

  const handleClear = () => {
    const filteredIdSet = new Set(filteredItems.map((i) => i.id));
    onChange(selectedValues.filter((v) => !filteredIdSet.has(v)));
  };

  const displayedItems = filteredItems.slice(0, visibleCount);

  return (
    <div className="space-y-1.5" ref={dropdownRef}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-text-main block">
          {label}
        </label>
        {helperText && <span className="text-3xs text-primary font-medium">{helperText}</span>}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between text-xs rounded-lg border px-3 py-2 text-left bg-white transition-all ${
            selectedValues.length > 0
              ? 'border-primary ring-1 ring-primary/20 text-text-main font-medium'
              : 'border-slate-300 text-text-muted hover:border-slate-400'
          }`}
        >
          <span className="truncate">
            {selectedValues.length === 0
              ? placeholder
              : `${selectedValues.length} selected (${selectedValues.slice(0, 2).join(', ')}${
                  selectedValues.length > 2 ? '...' : ''
                })`}
          </span>
          <div className="flex items-center gap-1.5 ml-2 shrink-0">
            {selectedValues.length > 0 && (
              <span className="rounded-full bg-primary text-white text-3xs px-1.5 py-0.2 font-bold">
                {selectedValues.length}
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
          </div>
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-border bg-surface p-2 shadow-2xl space-y-2 animate-in fade-in zoom-in-95">
            {/* Search Input inside Dropdown */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-primary bg-white text-text-main placeholder:text-text-muted"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-text-muted hover:text-text-main"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between px-1 text-3xs text-text-muted">
              <span>{filteredItems.length} available</span>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-primary hover:underline font-semibold"
                >
                  Select All
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-text-muted hover:text-loss font-semibold"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Scrollable list with infinite scroll */}
            <div
              onScroll={handleScroll}
              className="max-h-44 overflow-y-auto space-y-0.5 pr-1 divide-y divide-slate-100/50"
            >
              {displayedItems.length === 0 ? (
                <div className="py-4 text-center text-xs text-text-muted">
                  No matching options found.
                </div>
              ) : (
                displayedItems.map((item) => {
                  const isSelected = selectedValues.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                        isSelected
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-text-main hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${
                            isSelected
                              ? 'bg-primary border-primary text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                        </div>
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.sublabel && (
                        <span className="text-3xs uppercase px-1.5 py-0.5 rounded bg-slate-100 text-text-muted font-medium ml-2 shrink-0">
                          {item.sublabel}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
              {visibleCount < filteredItems.length && (
                <div className="py-1 text-center text-3xs text-text-muted italic">
                  Scroll for more...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const CustomerListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Active query parameters
  const search = searchParams.get('search') || '';
  const kyc = searchParams.get('kyc_status') || '';
  const segment = searchParams.get('segment') || '';
  const city = searchParams.get('city') || '';
  const state = searchParams.get('state') || '';
  const risk = searchParams.get('risk_level') || '';
  const ordering = searchParams.get('ordering') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const [searchTerm, setSearchTerm] = useState(search);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  // Staged / Draft Filter state for the filter card (only applied when "Apply Filters" is clicked)
  const [draftKyc, setDraftKyc] = useState<string[]>([]);
  const [draftSegment, setDraftSegment] = useState<string[]>([]);
  const [draftRisk, setDraftRisk] = useState<string[]>([]);
  const [draftStates, setDraftStates] = useState<string[]>([]);
  const [draftCities, setDraftCities] = useState<string[]>([]);

  // Sync state if URL search param changes
  useEffect(() => {
    setSearchTerm(search);
  }, [search]);

  // Debounced search on every keystroke
  useEffect(() => {
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

  // Initialize draft states whenever the filter card opens
  useEffect(() => {
    if (isFilterOpen) {
      setDraftKyc(kyc ? kyc.split(',').map((s) => s.trim()).filter(Boolean) : []);
      setDraftSegment(segment ? segment.split(',').map((s) => s.trim()).filter(Boolean) : []);
      setDraftRisk(risk ? risk.split(',').map((s) => s.trim()).filter(Boolean) : []);
      setDraftStates(state ? state.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : []);
      setDraftCities(city ? city.split(',').map((s) => s.trim()).filter(Boolean) : []);
    }
  }, [isFilterOpen, kyc, segment, risk, state, city]);

  // Prevent background page scrolling when the filter modal is open
  useEffect(() => {
    if (isFilterOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFilterOpen]);

  // Close filter drawer on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isFilterOpen) {
        setIsFilterOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFilterOpen]);

  // Fetch location data from API
  const { data: locationsData } = useQuery({
    queryKey: ['customer-locations'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<CustomerLocations>>('/customers/locations/');
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Available states
  const allStates: DropdownItem[] = useMemo(() => {
    if (locationsData?.states && locationsData.states.length > 0) {
      return locationsData.states.map((s) => ({
        id: s.code,
        label: s.name,
        sublabel: s.code,
      }));
    }
    return DEFAULT_STATES.map((s) => ({
      id: s.code,
      label: s.name,
      sublabel: s.code,
    }));
  }, [locationsData]);

  // Available cities with their state mapping
  const allCities: (DropdownItem & { state: string })[] = useMemo(() => {
    if (locationsData?.cities && locationsData.cities.length > 0) {
      return locationsData.cities.map((c) => ({
        id: c.name,
        label: c.name,
        sublabel: c.state,
        state: c.state,
      }));
    }
    return DEFAULT_CITIES.map((c) => ({
      id: c.name,
      label: c.name,
      sublabel: c.state,
      state: c.state,
    }));
  }, [locationsData]);

  // Cities dynamically filtered based on selected state(s)
  const availableCities = useMemo(() => {
    if (draftStates.length > 0) {
      return allCities.filter((c) => draftStates.includes(c.state));
    }
    return allCities;
  }, [allCities, draftStates]);

  // When state changes, prune any selected city that doesn't belong to the newly selected states
  const handleDraftStatesChange = (newStates: string[]) => {
    setDraftStates(newStates);
    if (newStates.length > 0) {
      const validCityIds = new Set(
        allCities.filter((c) => newStates.includes(c.state)).map((c) => c.id)
      );
      setDraftCities((prev) => prev.filter((cityName) => validCityIds.has(cityName)));
    }
  };

  // Toggle draft chips for KYC, Segment, Risk
  const toggleDraftChip = (
    currentList: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string
  ) => {
    if (currentList.includes(value)) {
      setter(currentList.filter((v) => v !== value));
    } else {
      setter([...currentList, value]);
    }
  };

  // Customers list query
  const { data, isLoading, isError } = useQuery({
    queryKey: ['customers', { search, kyc, segment, city, state, risk, ordering, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (kyc) params.append('kyc_status', kyc);
      if (segment) params.append('segment', segment);
      if (city) params.append('city', city);
      if (state) params.append('state', state);
      if (risk) params.append('risk_level', risk);
      if (ordering) params.append('ordering', ordering);
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

  const handleSort = (field: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (ordering === field) {
      newParams.set('ordering', `-${field}`);
    } else if (ordering === `-${field}`) {
      newParams.delete('ordering');
    } else {
      newParams.set('ordering', field);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const renderSortIcon = (field: string) => {
    if (ordering === field) {
      return <ArrowUp className="h-4 w-4 text-primary" />;
    }
    if (ordering === `-${field}`) {
      return <ArrowDown className="h-4 w-4 text-primary" />;
    }
    return <ArrowUpDown className="h-3.5 w-3.5 text-text-muted opacity-50 group-hover:opacity-100 transition-opacity" />;
  };

  // Commit draft filters to URL parameters when clicking "Apply Filters"
  const handleApplyFilters = () => {
    const newParams = new URLSearchParams(searchParams);
    if (draftKyc.length > 0) newParams.set('kyc_status', draftKyc.join(','));
    else newParams.delete('kyc_status');

    if (draftSegment.length > 0) newParams.set('segment', draftSegment.join(','));
    else newParams.delete('segment');

    if (draftRisk.length > 0) newParams.set('risk_level', draftRisk.join(','));
    else newParams.delete('risk_level');

    if (draftStates.length > 0) newParams.set('state', draftStates.join(','));
    else newParams.delete('state');

    if (draftCities.length > 0) newParams.set('city', draftCities.join(','));
    else newParams.delete('city');

    newParams.set('page', '1');
    setSearchParams(newParams);
    setIsFilterOpen(false);
  };

  // Reset all drafts inside the popover
  const handleResetDraft = () => {
    setDraftKyc([]);
    setDraftSegment([]);
    setDraftRisk([]);
    setDraftStates([]);
    setDraftCities([]);
  };

  // Remove individual active filter from URL
  const removeActiveFilter = (paramKey: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    const existing = newParams.get(paramKey) || '';
    const currentList = existing ? existing.split(',').map((s) => s.trim()) : [];
    const updated = currentList.filter((item) => item !== value);

    if (updated.length > 0) {
      newParams.set(paramKey, updated.join(','));
    } else {
      newParams.delete(paramKey);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const clearAllFilters = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('kyc_status');
    newParams.delete('segment');
    newParams.delete('city');
    newParams.delete('state');
    newParams.delete('risk_level');
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const selectedKyc = kyc ? kyc.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const selectedSegment = segment ? segment.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const selectedCities = city ? city.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const selectedStates = state ? state.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean) : [];
  const selectedRisk = risk ? risk.split(',').map((s) => s.trim()).filter(Boolean) : [];

  const totalActiveFilterCount =
    selectedKyc.length +
    selectedSegment.length +
    selectedCities.length +
    selectedStates.length +
    selectedRisk.length;

  const totalDraftCount =
    draftKyc.length +
    draftSegment.length +
    draftRisk.length +
    draftStates.length +
    draftCities.length;

  const totalCount = data?.count || 0;
  const pageSize = 24;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-main">Customers</h1>
        <p className="text-sm text-text-muted">
          Browse, search, and monitor wealth accounts across all active segments.
        </p>
      </div>

      {/* Filter and Search Bar: Search on left, Filter on right end */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between bg-surface p-4 rounded-xl border border-border shadow-xs">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search by code, name, email, city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary bg-white text-text-main placeholder:text-text-muted"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-text-muted hover:text-text-main"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          {/* Single Filter Dropdown Card */}
          <div className="relative" ref={filterPopoverRef}>
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold shadow-xs transition-colors ${
                totalActiveFilterCount > 0
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-slate-300 bg-white text-text-main hover:bg-slate-50'
              }`}
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              {totalActiveFilterCount > 0 && (
                <span className="rounded-full bg-primary text-white text-2xs px-1.5 py-0.2 font-bold">
                  {totalActiveFilterCount}
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
            </button>

            {/* Fixed Backdrop and Slide-over Drawer Modal (Opens Right to Left) */}
            {isFilterOpen && (
              <div className="fixed inset-0 z-50 overflow-hidden">
                {/* Fixed Backdrop Overlay */}
                <div
                  className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
                  onClick={() => setIsFilterOpen(false)}
                />

                {/* Drawer Container (Sliding in from Right to Left) */}
                <div
                  ref={filterPopoverRef}
                  className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-surface shadow-2xl flex flex-col border-l border-border transition-transform transform duration-300 ease-in-out animate-in slide-in-from-right"
                >
                  {/* Modal Header */}
                  <div className="flex items-start justify-between border-b border-border p-5 pb-4 bg-surface shrink-0 gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-text-main">Filter Customers</h3>
                      <p className="text-xs text-text-muted mt-0.5">
                        Refine customer list by status, segment, and geography.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {totalDraftCount > 0 && (
                        <button
                          type="button"
                          onClick={handleResetDraft}
                          className="text-xs text-primary hover:underline font-semibold whitespace-nowrap"
                        >
                          Clear All
                        </button>
                      )}
                      {/* Cross Button in Top Right to close filter modal */}
                      <button
                        type="button"
                        onClick={() => setIsFilterOpen(false)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-slate-100 transition-colors"
                        aria-label="Close filters"
                        title="Close filters"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Modal Body */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* KYC Status Multi-select Chips */}
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-text-main block">
                        KYC Status
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { key: 'VERIFIED', label: 'Verified' },
                          { key: 'PENDING', label: 'Pending' },
                          { key: 'REVIEW', label: 'Review' },
                        ].map(({ key, label }) => {
                          const isSelected = draftKyc.includes(key);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => toggleDraftChip(draftKyc, setDraftKyc, key)}
                              className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${
                                isSelected
                                  ? 'bg-primary text-white border-primary shadow-xs'
                                  : 'bg-white text-text-main border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Segment Multi-select Chips */}
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-text-main block">
                        Segment
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { key: 'MASS', label: 'Mass' },
                          { key: 'AFFLUENT', label: 'Affluent' },
                          { key: 'HNI', label: 'HNI' },
                        ].map(({ key, label }) => {
                          const isSelected = draftSegment.includes(key);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => toggleDraftChip(draftSegment, setDraftSegment, key)}
                              className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${
                                isSelected
                                  ? 'bg-primary text-white border-primary shadow-xs'
                                  : 'bg-white text-text-main border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Risk Level Multi-select Chips */}
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-text-main block">
                        Risk Level
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { key: 'CONSERVATIVE', label: 'Conservative' },
                          { key: 'MODERATE', label: 'Moderate' },
                          { key: 'GROWTH', label: 'Growth' },
                          { key: 'AGGRESSIVE', label: 'Aggressive' },
                        ].map(({ key, label }) => {
                          const isSelected = draftRisk.includes(key);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => toggleDraftChip(draftRisk, setDraftRisk, key)}
                              className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${
                                isSelected
                                  ? 'bg-primary text-white border-primary shadow-xs'
                                  : 'bg-white text-text-main border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* STATE DROPDOWN (ORDERED FIRST) */}
                    <SearchableDropdown
                      label="State"
                      placeholder="All States (Select to filter)"
                      searchPlaceholder="Search states..."
                      items={allStates}
                      selectedValues={draftStates}
                      onChange={handleDraftStatesChange}
                    />

                    {/* CITY DROPDOWN (ORDERED SECOND - DYNAMICALLY FILTERED BY STATE) */}
                    <SearchableDropdown
                      label="City"
                      placeholder={
                        draftStates.length > 0
                          ? `Select cities in ${draftStates.join(', ')}...`
                          : 'All Cities (Select to filter)'
                      }
                      searchPlaceholder="Search cities..."
                      items={availableCities}
                      selectedValues={draftCities}
                      onChange={setDraftCities}
                      helperText={
                        draftStates.length > 0
                          ? `Filtered by ${draftStates.length} state(s)`
                          : undefined
                      }
                    />
                  </div>

                  {/* Fixed Modal Footer: Apply only when clicked */}
                  <div className="p-4 border-t border-border bg-surface flex items-center justify-between gap-3 shrink-0 shadow-xs">
                    <button
                      type="button"
                      onClick={handleResetDraft}
                      disabled={totalDraftCount === 0}
                      className="text-xs font-semibold text-text-muted hover:text-loss disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      Clear All
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsFilterOpen(false)}
                        className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-text-main hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyFilters}
                        className="px-5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-dark shadow-sm transition-colors"
                      >
                        Apply Filters
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {totalActiveFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs text-text-muted hover:text-loss transition-colors font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Selected Filter Badges */}
      {totalActiveFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {selectedKyc.map((k) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200"
            >
              KYC: {k}
              <button
                type="button"
                onClick={() => removeActiveFilter('kyc_status', k)}
                className="hover:text-blue-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {selectedSegment.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200"
            >
              Segment: {s}
              <button
                type="button"
                onClick={() => removeActiveFilter('segment', s)}
                className="hover:text-blue-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {selectedRisk.map((r) => (
            <span
              key={r}
              className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 border border-purple-200"
            >
              Risk: {r}
              <button
                type="button"
                onClick={() => removeActiveFilter('risk_level', r)}
                className="hover:text-purple-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {selectedStates.map((st) => (
            <span
              key={st}
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-300"
            >
              State: {st}
              <button
                type="button"
                onClick={() => removeActiveFilter('state', st)}
                className="hover:text-slate-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {selectedCities.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-300"
            >
              City: {c}
              <button
                type="button"
                onClick={() => removeActiveFilter('city', c)}
                className="hover:text-slate-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
        <table className="min-w-full divide-y divide-border text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-text-muted font-medium">
            <tr>
              <th
                onClick={() => handleSort('customer_code')}
                className="px-4 py-3.5 cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                title="Sort by Customer Code"
              >
                <div className="flex items-center gap-1.5">
                  <span className={ordering.includes('customer_code') ? 'font-bold text-text-main' : ''}>
                    Code
                  </span>
                  {renderSortIcon('customer_code')}
                </div>
              </th>
              <th
                onClick={() => handleSort('full_name')}
                className="px-4 py-3.5 cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                title="Sort by Full Name"
              >
                <div className="flex items-center gap-1.5">
                  <span className={ordering.includes('full_name') ? 'font-bold text-text-main' : ''}>
                    Full Name
                  </span>
                  {renderSortIcon('full_name')}
                </div>
              </th>
              <th className="px-4 py-3.5">City / State</th>
              <th className="px-4 py-3.5">Segment</th>
              <th className="px-4 py-3.5">KYC Status</th>
              <th className="px-4 py-3.5">Risk Level</th>
              <th
                onClick={() => handleSort('accounts_count')}
                className="px-4 py-3.5 text-right cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                title="Sort by Accounts Count"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span className={ordering.includes('accounts_count') ? 'font-bold text-text-main' : ''}>
                    Accounts
                  </span>
                  {renderSortIcon('accounts_count')}
                </div>
              </th>
              <th
                onClick={() => handleSort('unrealised_pl_pct')}
                className="px-4 py-3.5 text-right cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                title="Sort by Unrealised P/L %"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span className={ordering.includes('unrealised_pl_pct') ? 'font-bold text-text-main' : ''}>
                    P/L %
                  </span>
                  {renderSortIcon('unrealised_pl_pct')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
                  Loading customers...
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-loss">
                  Failed to load customers.
                </td>
              </tr>
            ) : data?.results.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
                  No customers found matching the criteria.
                </td>
              </tr>
            ) : (
              data?.results.map((cust) => {
                const plPctNum =
                  cust.unrealised_pl_pct !== null && cust.unrealised_pl_pct !== undefined
                    ? parseFloat(cust.unrealised_pl_pct)
                    : null;
                const isGain = plPctNum !== null && plPctNum >= 0;

                return (
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
                    <td className="px-4 py-3.5 text-right font-medium text-text-main tabular-nums">
                      {cust.accounts_count ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold">
                      {plPctNum !== null ? (
                        <span className={isGain ? 'text-gain' : 'text-loss'}>
                          {isGain ? '+' : ''}{formatPercent(plPctNum)}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Server-Side Pagination Bar */}
        {data && totalCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border text-xs text-text-muted bg-surface">
            <div>
              Showing{' '}
              <span className="font-semibold text-text-main">
                {Math.min((page - 1) * pageSize + 1, totalCount)}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-text-main">
                {Math.min(page * pageSize, totalCount)}
              </span>{' '}
              of <span className="font-semibold text-text-main">{totalCount.toLocaleString()}</span> customers
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set('page', (page - 1).toString());
                  setSearchParams(newParams);
                }}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-text-main font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>

              <span className="px-2 font-medium">
                Page {page} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set('page', (page + 1).toString());
                  setSearchParams(newParams);
                }}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-text-main font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
