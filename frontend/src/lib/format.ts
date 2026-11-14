export const formatINR = (valueStr: string | number | null | undefined): string => {
  if (valueStr === null || valueStr === undefined || valueStr === '') return '₹0.00';
  const num = typeof valueStr === 'string' ? parseFloat(valueStr) : valueStr;
  if (isNaN(num)) return '₹0.00';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export const formatPercent = (valueStr: string | number | null | undefined): string => {
  if (valueStr === null || valueStr === undefined || valueStr === '') return '0.00%';
  const num = typeof valueStr === 'string' ? parseFloat(valueStr) : valueStr;
  if (isNaN(num)) return '0.00%';
  return `${num.toFixed(2)}%`;
};

export const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};
