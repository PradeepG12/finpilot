import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, ChevronDown, Check, Loader2 } from 'lucide-react';

export interface MultiSelectItem {
  id: string;
  label: string;
  sublabel?: string;
}

interface MultiSelectDropdownProps {
  label: string;
  placeholder?: string;
  searchPlaceholder?: string;
  items?: MultiSelectItem[];
  selectedValues?: string[];
  selectedIds?: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  isLoading?: boolean;
  helperText?: string;
  emptyMessage?: string;
}

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  label,
  placeholder = 'Select options...',
  searchPlaceholder = 'Search...',
  items = [],
  selectedValues: propSelectedValues,
  selectedIds,
  onChange,
  disabled = false,
  isLoading = false,
  helperText,
  emptyMessage = 'No options available.',
}) => {
  const selectedValues = propSelectedValues ?? selectedIds ?? [];
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(25);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
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

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Reset pagination on search or items change
  useEffect(() => {
    setVisibleCount(25);
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
      setVisibleCount((prev) => Math.min(prev + 25, filteredItems.length));
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

  const handleClearFiltered = () => {
    const filteredIdSet = new Set(filteredItems.map((i) => i.id));
    onChange(selectedValues.filter((v) => !filteredIdSet.has(v)));
  };

  const removeItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedValues.filter((v) => v !== id));
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const displayedItems = filteredItems.slice(0, visibleCount);

  // Map selected ids to items for chip display
  const itemMap = useMemo(() => {
    const map = new Map<string, MultiSelectItem>();
    items.forEach((item) => map.set(item.id, item));
    return map;
  }, [items]);

  return (
    <div className="space-y-1.5" ref={dropdownRef}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-text-main block">
          {label}
        </label>
        {helperText && <span className="text-3xs text-text-muted">{helperText}</span>}
      </div>

      {/* Selected Items Chips */}
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
          {selectedValues.map((val) => {
            const item = itemMap.get(val);
            const displayLabel = item ? item.label : val;
            return (
              <span
                key={val}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 text-text-main border border-slate-300 dark:border-slate-600 text-xs shadow-2xs font-medium"
              >
                <span className="truncate max-w-[180px]">{displayLabel}</span>
                <button
                  type="button"
                  onClick={(e) => removeItem(val, e)}
                  className="text-text-muted hover:text-loss transition-colors focus:outline-none"
                  aria-label={`Remove ${displayLabel}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={handleClearAll}
            className="text-3xs font-semibold text-text-muted hover:text-loss ml-auto transition-colors px-1"
          >
            Clear all ({selectedValues.length})
          </button>
        </div>
      )}

      {/* Trigger Button */}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between text-xs rounded-lg border px-3 py-2 text-left bg-white dark:bg-slate-800 transition-all ${
            disabled
              ? 'opacity-50 cursor-not-allowed bg-slate-100'
              : selectedValues.length > 0
              ? 'border-primary ring-1 ring-primary/20 text-text-main font-medium'
              : 'border-slate-300 text-text-muted hover:border-slate-400 focus:ring-1 focus:ring-primary focus:border-primary'
          }`}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className="truncate">
            {selectedValues.length === 0
              ? placeholder
              : `${selectedValues.length} selected`}
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

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-border bg-surface p-2 shadow-2xl space-y-2 animate-in fade-in zoom-in-95">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-slate-800 text-text-main placeholder:text-text-muted"
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
              {isLoading ? (
                <span className="inline-flex items-center gap-1 text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading options...</span>
                </span>
              ) : (
                <span>{filteredItems.length} available</span>
              )}
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={isLoading || filteredItems.length === 0}
                  className="text-primary hover:underline font-semibold disabled:opacity-40"
                >
                  Select All
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={handleClearFiltered}
                  disabled={isLoading || selectedValues.length === 0}
                  className="text-text-muted hover:text-loss font-semibold disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Options List */}
            <div
              onScroll={handleScroll}
              className="max-h-48 overflow-y-auto space-y-0.5 pr-1 divide-y divide-slate-100/50"
              role="listbox"
            >
              {isLoading ? (
                <div className="py-6 flex flex-col items-center justify-center gap-1.5 text-xs text-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Loading records...</span>
                </div>
              ) : displayedItems.length === 0 ? (
                <div className="py-4 text-center text-xs text-text-muted">
                  {emptyMessage}
                </div>
              ) : (
                displayedItems.map((item) => {
                  const isSelected = selectedValues.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={0}
                      onClick={() => toggleItem(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleItem(item.id);
                        }
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors outline-hidden focus:bg-slate-100 dark:focus:bg-slate-700 ${
                        isSelected
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-text-main hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${
                            isSelected
                              ? 'bg-primary border-primary text-white'
                              : 'border-slate-300 bg-white dark:bg-slate-800'
                          }`}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                        </div>
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.sublabel && (
                        <span className="text-3xs uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-text-muted font-medium ml-2 shrink-0">
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
